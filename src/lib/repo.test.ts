import { describe, expect, it, vi } from "vitest";

// Test phần THUẦN của hàng chờ — không cần máy chủ.
vi.mock("@/lib/supabase", () => ({ supabase: null, hasSupabase: false, SITE_ID: "test" }));

import {
  CUSTOMER_TABLE,
  PRODUCT_TABLE,
  EXPORT_CONTRACT_REVISION_TABLE,
  RECONCILIATION_RUN_TABLE,
  WIP_PRODUCTION_TABLE,
  dropSentKeys,
  docCho,
  compactForAudit,
  pushQueue,
  mergeServerAndLocal,
  type UploadPort,
  type PushError,
} from "@/lib/repo";

interface Row {
  id: string;
  kg: number;
  file?: string;
}
const mapping = {
  getKey: (x: Row) => x.id,
  toRow: (x: Row) => ({ id: x.id, quantity_kg: x.kg, ...(x.file ? { file: x.file } : {}) }),
};
const jsonOf = (rows: Row[]) =>
  new Map(rows.map((x) => [x.id, JSON.stringify(mapping.toRow(x))]));

/** Cổng giả: ghi lại mọi lượt gửi; `tuChoi(row)` trả lỗi cho dòng hỏng. */
function fakeGateway(tuChoi: (row: Record<string, unknown>) => PushError | null = () => null) {
  const upsertBatches: Record<string, unknown>[][] = [];
  const deleteCalls: string[][] = [];
  const gateway: UploadPort = {
    upsert: async (rows) => {
      upsertBatches.push(rows);
      for (const r of rows) {
        const e = tuChoi(r);
        if (e) return e; // cả lượt bị từ chối như PostgREST
      }
      return null;
    },
    remove: async (keys) => {
      deleteCalls.push(keys);
      return null;
    },
  };
  return { gateway, upsertBatches, deleteCalls };
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
    let rows: Row[] = [
      { id: "A", kg: 1 },
      { id: "C", kg: 3 },
    ];
    let open!: () => void;
    const cho = new Promise<void>((r) => (open = r));
    const gateway: UploadPort = {
      upsert: async () => {
        await cho; // lượt 1 đang treo trên mạng
        return null;
      },
      remove: async () => null,
    };
    const sendPromise = pushQueue(mapping, { them: ["A", "C"], xoa: [] }, rows, gateway);

    // Trong lúc gửi: sửa A lần nữa + thêm B (useBang.ghi đưa vào hàng chờ).
    rows = [{ id: "A", kg: 10 }, { id: "C", kg: 3 }, { id: "B", kg: 2 }];
    const pendingAfterWrite = { them: ["A", "C", "B"], xoa: [] };
    open();
    const result = await sendPromise;

    const remaining = dropSentKeys(pendingAfterWrite, result, jsonOf(rows));
    expect(remaining.them.sort()).toEqual(["A", "B"]); // C đã lên đúng bản ⇒ ra khỏi hàng chờ
  });

  it("khóa không còn dòng nào ⇒ bỏ; tab khác thêm lại dòng đó trong lúc gửi ⇒ giữ", () => {
    const result = { sentUpserts: new Map<string, string | null>([["X", null], ["Y", null]]), deleted: [] };
    const remaining = dropSentKeys({ them: ["X", "Y"], xoa: [] }, result, jsonOf([{ id: "Y", kg: 1 }]));
    expect(remaining.them).toEqual(["Y"]);
  });

  it("xóa đã gửi thì bỏ tombstone; tombstone mới thêm lúc đang gửi vẫn giữ", () => {
    const remaining = dropSentKeys(
      { them: [], xoa: ["D", "E"] },
      { sentUpserts: new Map(), deleted: ["D"] },
      new Map(),
    );
    expect(remaining.xoa).toEqual(["E"]);
  });
});

describe("kịch bản 2 — một dòng lỗi trong lô", () => {
  it("lượt gộp bị 23505 ⇒ gửi lại từng dòng: dòng lành lên, chỉ dòng hỏng ở lại", async () => {
    const rows: Row[] = [
      { id: "A", kg: 1 },
      { id: "HONG", kg: 2 },
      { id: "C", kg: 3 },
    ];
    const { gateway, upsertBatches } = fakeGateway((r) =>
      r.id === "HONG" ? { code: "23505", message: "duplicate key value" } : null,
    );
    const result = await pushQueue(mapping, { them: ["A", "HONG", "C"], xoa: [] }, rows, gateway);

    expect(result.generalError).toBeUndefined();
    expect(result.rowErrors).toEqual([{ key: "HONG", msg: "23505 duplicate key value" }]);
    expect(upsertBatches.length).toBe(4); // 1 lượt gộp + 3 lượt từng dòng
    const remaining = dropSentKeys({ them: ["A", "HONG", "C"], xoa: [] }, result, jsonOf(rows));
    expect(remaining.them).toEqual(["HONG"]);
  });

  it("lỗi mạng / lỗi chung ⇒ KHÔNG gửi từng dòng, giữ nguyên cả hàng chờ", async () => {
    const rows: Row[] = [
      { id: "A", kg: 1 },
      { id: "B", kg: 2 },
    ];
    const { gateway, upsertBatches } = fakeGateway(() => ({ message: "TypeError: Failed to fetch" }));
    const result = await pushQueue(mapping, { them: ["A", "B"], xoa: ["Z"] }, rows, gateway);
    expect(result.generalError).toContain("Failed to fetch");
    expect(upsertBatches.length).toBe(1);
    const remaining = dropSentKeys({ them: ["A", "B"], xoa: ["Z"] }, result, jsonOf(rows));
    expect(remaining).toEqual({ them: ["A", "B"], xoa: ["Z"] });
  });

  it("gom upsert theo bộ cột — dòng thiếu cột không bị gộp với dòng có cột (tránh DEFAULT đè)", async () => {
    const rows: Row[] = [
      { id: "A", kg: 1, file: "abc" },
      { id: "B", kg: 2 },
    ];
    const { gateway, upsertBatches } = fakeGateway();
    await pushQueue(mapping, { them: ["A", "B"], xoa: [] }, rows, gateway);
    expect(upsertBatches.map((l) => l.map((r) => r.id))).toEqual([["A"], ["B"]]);
  });
});

describe("kịch bản 3 — tải lại khi còn hàng chờ (mergeServerAndLocal)", () => {
  it("nền server; dòng chờ gửi thắng; dòng chờ xóa không hồi sinh; dòng local lạ bị bỏ", () => {
    const may: Row[] = [
      { id: "A", kg: 1 },
      { id: "B", kg: 2 },
      { id: "S", kg: 9 }, // máy khác vừa thêm
    ];
    const local: Row[] = [
      { id: "A", kg: 100 }, // sửa dưới máy chưa lên
      { id: "B", kg: 2 },
      { id: "C", kg: 3 }, // thêm dưới máy chưa lên
      { id: "D", kg: 4 }, // máy khác đã xóa trên server, không trong hàng chờ
    ];
    const result = mergeServerAndLocal(may, local, { them: ["A", "C"], xoa: ["B"] }, (x) => x.id);
    expect(result.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "A", kg: 100 },
      { id: "C", kg: 3 },
      { id: "S", kg: 9 },
    ]);
  });

  it("dòng chờ thiếu trường không-cache ⇒ lấy lại từ server", () => {
    const result = mergeServerAndLocal<Row>(
      [{ id: "A", kg: 1, file: "FILE" }],
      [{ id: "A", kg: 2, file: "" }],
      { them: ["A"], xoa: [] },
      (x) => x.id,
      ["file"],
    );
    expect(result).toEqual([{ id: "A", kg: 2, file: "FILE" }]);
  });
});

describe("compactForAudit — không chép file/chuỗi khổng lồ vào nhật ký", () => {
  it("thay fileB64 + chuỗi > 10KB bằng nhãn, giữ trường khác", () => {
    const x = { id: "r1", title: "Bản T9", fileB64: "x".repeat(50), options: { note: "y".repeat(20_000) } };
    const g = compactForAudit(x) as Record<string, unknown>;
    expect(g.id).toBe("r1");
    expect(g.title).toBe("Bản T9");
    expect(g.fileB64).toBe("[file 50 ký tự — không ghi nhật ký]");
    expect((g.options as Record<string, unknown>).note).toBe("[chuỗi 20000 ký tự — không ghi nhật ký]");
    expect(compactForAudit("", "fileB64")).toBe("");
  });
});

describe("đọc dữ liệu đã lưu trước khi đổi tên trường (2026-10-14)", () => {
  it("bản đối soát trên máy chủ: summary/options tên cũ + chế độ cũ", () => {
    const run = RECONCILIATION_RUN_TABLE.fromRow({
      id: "r1", threshold: 1, status: "draft",
      options: { soChuanTen: "PMEM", benThue: ["HDDT"], cheDo: "haiBan", edits: { "a|1|2": 5 } },
      summary: { soHoaDon: 10, khop: 7, lech: 1, thieu: 2, nguong: 1, savedAt: "t" },
    });
    expect(run.options).toEqual({ ledgerSheetName: "PMEM", taxSideSheets: ["HDDT"], mode: "twoVersion", edits: { "a|1|2": 5 } });
    expect(run.summary).toMatchObject({ invoiceCount: 10, matched: 7, mismatched: 1, missing: 2, threshold: 1 });
  });
  it("bộ đệm máy: dòng đối soát + dòng SX mang tên cũ", () => {
    const run = RECONCILIATION_RUN_TABLE.patchLegacy!({ id: "r1", options: { cheDo: "so" }, summary: { khop: 3 } } as never);
    expect(run.options.mode).toBe("ledger");
    expect(run.summary.matched).toBe(3);
    const wip = WIP_PRODUCTION_TABLE.patchLegacy!({ id: "w1", status: "da-nhap", componentRauKg: 4, componentBaoTuKg: 1 } as never);
    expect(wip).toMatchObject({ tentacleKg: 4, stomachKg: 1, status: "stocked" });
    expect("componentRauKg" in wip).toBe(false);
  });
});

describe("kịch bản 4 — bị từ chối vì quyền (42501, phân quyền Đợt 6)", () => {
  it("một dòng 42501 KHÔNG còn chặn cả bảng: dòng được phép lên, dòng bị từ chối ở lại hàng chờ (có cờ permission)", async () => {
    const rows: Row[] = [
      { id: "A", kg: 1 },
      { id: "CAM", kg: 2 },
      { id: "C", kg: 3 },
    ];
    const { gateway } = fakeGateway((r) =>
      r.id === "CAM" ? { code: "42501", message: "new row violates row-level security policy" } : null,
    );
    const result = await pushQueue(mapping, { them: ["A", "CAM", "C"], xoa: [] }, rows, gateway);
    expect(result.generalError).toBeUndefined();
    expect(result.rowErrors).toEqual([{ key: "CAM", msg: "42501 new row violates row-level security policy", permission: true }]);
    const remaining = dropSentKeys({ them: ["A", "CAM", "C"], xoa: [] }, result, jsonOf(rows));
    expect(remaining.them).toEqual(["CAM"]); // không bỏ — được cấp quyền sẽ tự gửi
  });

  it("cả bảng bị từ chối (tài khoản không có quyền): chỉ thử vài dòng lẻ rồi giữ nguyên, không bắn hàng trăm yêu cầu", async () => {
    const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: `R${i}`, kg: i }));
    const { gateway, upsertBatches } = fakeGateway(() => ({ code: "42501", message: "permission denied" }));
    const result = await pushQueue(mapping, { them: rows.map((r) => r.id), xoa: [] }, rows, gateway);
    expect(result.generalError).toBeUndefined();
    expect(result.rowErrors).toHaveLength(40);
    expect(result.rowErrors.every((e) => e.permission)).toBe(true);
    expect(upsertBatches.length).toBe(1 + 5); // 1 lượt gộp + 5 dòng thử
    const remaining = dropSentKeys({ them: rows.map((r) => r.id), xoa: [] }, result, jsonOf(rows));
    expect(remaining.them).toHaveLength(40);
  });
});

describe("khách hàng — cột xuất khẩu (mig 0075)", () => {
  it("máy chủ chưa có cột ⇒ đọc ra undefined, ghi KHÔNG gửi cột (khỏi kẹt hàng chờ)", () => {
    const c = CUSTOMER_TABLE.fromRow({ id: "k1", code: "1", name: "Seachemot", market: "Nhật" });
    expect(c.country).toBeUndefined();
    expect(Object.keys(CUSTOMER_TABLE.toRow(c)).sort()).toEqual(["code", "id", "market", "name"]);
  });
  it("máy chủ đã có cột ⇒ đọc + gửi đủ 6 cột", () => {
    const c = CUSTOMER_TABLE.fromRow({ id: "k1", code: "", name: "SCM", market: "", country: "Nhật Bản", address: "", default_port: "Tokyo", payment_terms: "", contact_name: "", contact_email: "" });
    expect(c).toMatchObject({ country: "Nhật Bản", defaultPort: "Tokyo", address: "" });
    expect(CUSTOMER_TABLE.toRow(c)).toMatchObject({ country: "Nhật Bản", default_port: "Tokyo", payment_terms: "", contact_email: "" });
  });
});

describe("mặt hàng — tên thương mại (mig 0076, ba-spec 41 AC-41)", () => {
  const base = { id: "p1", code: "", name: "Bạch tuộc 2 da cắt luộc 5,5gr", finishedGoodCode: "" };
  it("máy chủ chưa có cột ⇒ đọc ra undefined, ghi KHÔNG gửi trade_name", () => {
    const p = PRODUCT_TABLE.fromRow({ id: "p1", name: "a" });
    expect(p.tradeName).toBeUndefined();
    expect("trade_name" in PRODUCT_TABLE.toRow({ ...base, tradeName: undefined })).toBe(false);
  });
  it("máy chủ có cột ⇒ đọc (null về chuỗi rỗng) và gửi", () => {
    expect(PRODUCT_TABLE.fromRow({ id: "p1", name: "a", trade_name: null }).tradeName).toBe("");
    expect(PRODUCT_TABLE.fromRow({ id: "p1", name: "a", trade_name: "Frozen iwadako boiled cut" }).tradeName).toBe("Frozen iwadako boiled cut");
    expect(PRODUCT_TABLE.toRow({ ...base, tradeName: "X" }).trade_name).toBe("X");
    expect(PRODUCT_TABLE.toRow({ ...base, tradeName: "" }).trade_name).toBe("");
  });
});

describe("bản hợp đồng xuất khẩu — dòng hàng đọc lại từ máy chủ giữ mặt hàng đã nối (R16)", () => {
  it("productId còn sau vòng toRow → fromRow; dòng chưa nối không có productId", () => {
    const line = { id: "l1", description: "Frozen iwadako boiled cut", hsCode: "", size: "6-7 gr/pc", packing: "", unitKind: "carton" as const, cartonsPerUnit: 1, netKgPerCarton: 10, quantity: 100, kg: null, unitPrice: 11.2, microSpec: "" };
    const rev = { id: "r0", contractId: "c1", revisionNo: 0, revisedOn: "2026-07-30", changeSummary: "", terms: {} as never, lines: [{ ...line, productId: "p-67" }, { ...line, id: "l2" }], filePath: "", fileName: "", recordedBy: "", createdAt: "" };
    const row = EXPORT_CONTRACT_REVISION_TABLE.toRow(rev);
    const back = EXPORT_CONTRACT_REVISION_TABLE.fromRow({ ...row, created_at: "", lines: JSON.parse(JSON.stringify(row.lines)) });
    expect(back.lines[0].productId).toBe("p-67");
    expect("productId" in back.lines[1]).toBe(false);
  });
});
