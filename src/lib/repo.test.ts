import { describe, expect, it, vi } from "vitest";

// Test phần THUẦN của hàng chờ — không cần máy chủ.
vi.mock("@/lib/supabase", () => ({ supabase: null, hasSupabase: false, SITE_ID: "test" }));

import {
  boKhoaDaGui,
  docCho,
  gonChoNhatKy,
  guiHangCho,
  hoaDuLieu,
  type CongGui,
  type LoiGui,
} from "@/lib/repo";

interface Dong {
  id: string;
  kg: number;
  file?: string;
}
const bang = {
  layKhoa: (x: Dong) => x.id,
  toRow: (x: Dong) => ({ id: x.id, quantity_kg: x.kg, ...(x.file ? { file: x.file } : {}) }),
};
const jsonCua = (rows: Dong[]) =>
  new Map(rows.map((x) => [x.id, JSON.stringify(bang.toRow(x))]));

/** Cổng giả: ghi lại mọi lượt gửi; `tuChoi(row)` trả lỗi cho dòng hỏng. */
function fakeGateway(tuChoi: (row: Record<string, unknown>) => LoiGui | null = () => null) {
  const luotUpsert: Record<string, unknown>[][] = [];
  const deleteCalls: string[][] = [];
  const gateway: CongGui = {
    upsert: async (rows) => {
      luotUpsert.push(rows);
      for (const r of rows) {
        const e = tuChoi(r);
        if (e) return e; // cả lượt bị từ chối như PostgREST
      }
      return null;
    },
    xoa: async (keys) => {
      deleteCalls.push(keys);
      return null;
    },
  };
  return { cong: gateway, luotUpsert, luotXoa: deleteCalls };
}

describe("docCho — đọc hàng chờ dạng cũ", () => {
  it("dạng {them, xoa} từ bản trước đọc nguyên", () => {
    expect(docCho('{"them":["a","b"],"xoa":["c"]}')).toEqual({ them: ["a", "b"], xoa: ["c"] });
  });
  it("rỗng / hỏng / thiếu mảng ⇒ hàng chờ rỗng, không ném lỗi", () => {
    expect(docCho(null)).toEqual({ them: [], xoa: [] });
    expect(docCho("{hỏng")).toEqual({ them: [], xoa: [] });
    expect(docCho("null")).toEqual({ them: [], xoa: [] });
    expect(docCho('{"them":["a"]}')).toEqual({ them: ["a"], xoa: [] });
  });
});

describe("kịch bản 1 — ghi chồng trong lúc đang gửi", () => {
  it("chỉ bỏ khóa đã gửi mà dòng chưa đổi; dòng sửa tiếp + dòng thêm mới ở lại hàng chờ", async () => {
    let rows: Dong[] = [
      { id: "A", kg: 1 },
      { id: "C", kg: 3 },
    ];
    let mo!: () => void;
    const cho = new Promise<void>((r) => (mo = r));
    const gateway: CongGui = {
      upsert: async () => {
        await cho; // lượt 1 đang treo trên mạng
        return null;
      },
      xoa: async () => null,
    };
    const sendPromise = guiHangCho(bang, { them: ["A", "C"], xoa: [] }, rows, gateway);

    // Trong lúc gửi: sửa A lần nữa + thêm B (useBang.ghi đưa vào hàng chờ).
    rows = [{ id: "A", kg: 10 }, { id: "C", kg: 3 }, { id: "B", kg: 2 }];
    const pendingAfterWrite = { them: ["A", "C", "B"], xoa: [] };
    mo();
    const kq = await sendPromise;

    const remaining = boKhoaDaGui(pendingAfterWrite, kq, jsonCua(rows));
    expect(remaining.them.sort()).toEqual(["A", "B"]); // C đã lên đúng bản ⇒ ra khỏi hàng chờ
  });

  it("khóa không còn dòng nào ⇒ bỏ; tab khác thêm lại dòng đó trong lúc gửi ⇒ giữ", () => {
    const kq = { daGuiThem: new Map<string, string | null>([["X", null], ["Y", null]]), daXoa: [] };
    const remaining = boKhoaDaGui({ them: ["X", "Y"], xoa: [] }, kq, jsonCua([{ id: "Y", kg: 1 }]));
    expect(remaining.them).toEqual(["Y"]);
  });

  it("xóa đã gửi thì bỏ tombstone; tombstone mới thêm lúc đang gửi vẫn giữ", () => {
    const remaining = boKhoaDaGui(
      { them: [], xoa: ["D", "E"] },
      { daGuiThem: new Map(), daXoa: ["D"] },
      new Map(),
    );
    expect(remaining.xoa).toEqual(["E"]);
  });
});

describe("kịch bản 2 — một dòng lỗi trong lô", () => {
  it("lượt gộp bị 23505 ⇒ gửi lại từng dòng: dòng lành lên, chỉ dòng hỏng ở lại", async () => {
    const rows: Dong[] = [
      { id: "A", kg: 1 },
      { id: "HONG", kg: 2 },
      { id: "C", kg: 3 },
    ];
    const { cong, luotUpsert } = fakeGateway((r) =>
      r.id === "HONG" ? { code: "23505", message: "duplicate key value" } : null,
    );
    const kq = await guiHangCho(bang, { them: ["A", "HONG", "C"], xoa: [] }, rows, cong);

    expect(kq.loiChung).toBeUndefined();
    expect(kq.dongLoi).toEqual([{ khoa: "HONG", msg: "23505 duplicate key value" }]);
    expect(luotUpsert.length).toBe(4); // 1 lượt gộp + 3 lượt từng dòng
    const remaining = boKhoaDaGui({ them: ["A", "HONG", "C"], xoa: [] }, kq, jsonCua(rows));
    expect(remaining.them).toEqual(["HONG"]);
  });

  it("lỗi mạng / lỗi chung ⇒ KHÔNG gửi từng dòng, giữ nguyên cả hàng chờ", async () => {
    const rows: Dong[] = [
      { id: "A", kg: 1 },
      { id: "B", kg: 2 },
    ];
    const { cong, luotUpsert } = fakeGateway(() => ({ message: "TypeError: Failed to fetch" }));
    const kq = await guiHangCho(bang, { them: ["A", "B"], xoa: ["Z"] }, rows, cong);
    expect(kq.loiChung).toContain("Failed to fetch");
    expect(luotUpsert.length).toBe(1);
    const remaining = boKhoaDaGui({ them: ["A", "B"], xoa: ["Z"] }, kq, jsonCua(rows));
    expect(remaining).toEqual({ them: ["A", "B"], xoa: ["Z"] });
  });

  it("gom upsert theo bộ cột — dòng thiếu cột không bị gộp với dòng có cột (tránh DEFAULT đè)", async () => {
    const rows: Dong[] = [
      { id: "A", kg: 1, file: "abc" },
      { id: "B", kg: 2 },
    ];
    const { cong, luotUpsert } = fakeGateway();
    await guiHangCho(bang, { them: ["A", "B"], xoa: [] }, rows, cong);
    expect(luotUpsert.map((l) => l.map((r) => r.id))).toEqual([["A"], ["B"]]);
  });
});

describe("kịch bản 3 — tải lại khi còn hàng chờ (hoaDuLieu)", () => {
  it("nền server; dòng chờ gửi thắng; dòng chờ xóa không hồi sinh; dòng local lạ bị bỏ", () => {
    const may: Dong[] = [
      { id: "A", kg: 1 },
      { id: "B", kg: 2 },
      { id: "S", kg: 9 }, // máy khác vừa thêm
    ];
    const local: Dong[] = [
      { id: "A", kg: 100 }, // sửa dưới máy chưa lên
      { id: "B", kg: 2 },
      { id: "C", kg: 3 }, // thêm dưới máy chưa lên
      { id: "D", kg: 4 }, // máy khác đã xóa trên server, không trong hàng chờ
    ];
    const kq = hoaDuLieu(may, local, { them: ["A", "C"], xoa: ["B"] }, (x) => x.id);
    expect(kq.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "A", kg: 100 },
      { id: "C", kg: 3 },
      { id: "S", kg: 9 },
    ]);
  });

  it("dòng chờ thiếu trường không-cache ⇒ lấy lại từ server", () => {
    const kq = hoaDuLieu<Dong>(
      [{ id: "A", kg: 1, file: "FILE" }],
      [{ id: "A", kg: 2, file: "" }],
      { them: ["A"], xoa: [] },
      (x) => x.id,
      ["file"],
    );
    expect(kq).toEqual([{ id: "A", kg: 2, file: "FILE" }]);
  });
});

describe("gonChoNhatKy — không chép file/chuỗi khổng lồ vào nhật ký", () => {
  it("thay fileB64 + chuỗi > 10KB bằng nhãn, giữ trường khác", () => {
    const x = { id: "r1", title: "Bản T9", fileB64: "x".repeat(50), options: { note: "y".repeat(20_000) } };
    const g = gonChoNhatKy(x) as Record<string, unknown>;
    expect(g.id).toBe("r1");
    expect(g.title).toBe("Bản T9");
    expect(g.fileB64).toBe("[file 50 ký tự — không ghi nhật ký]");
    expect((g.options as Record<string, unknown>).note).toBe("[chuỗi 20000 ký tự — không ghi nhật ký]");
    expect(gonChoNhatKy("", "fileB64")).toBe("");
  });
});
