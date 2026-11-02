import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null, hasSupabase: false, SITE_ID: "test" }));

import { drainAuditBuffer, toVnDayBoundsUtc, type AuditEntry, type AuditSendResult } from "@/lib/audit";

describe("toVnDayBoundsUtc — lọc nhật ký theo ngày giờ Việt Nam", () => {
  it("từ 00:00 VN = 17:00Z hôm trước; đến 23:59:59.999 VN = 16:59:59.999Z", () => {
    expect(toVnDayBoundsUtc("2026-10-12", "2026-10-12")).toEqual({
      fromDate: "2026-10-11T17:00:00.000Z",
      toDate: "2026-10-12T16:59:59.999Z",
    });
  });
  it("thao tác 06:30 sáng VN ngày 12 (= 23:30Z ngày 11) nằm TRONG lọc ngày 12", () => {
    const at = "2026-10-11T23:30:00.000Z";
    const b = toVnDayBoundsUtc("2026-10-12", "2026-10-12");
    expect(at >= b.fromDate! && at <= b.toDate!).toBe(true);
  });
  it("bỏ trống ⇒ không giới hạn", () => {
    expect(toVnDayBoundsUtc()).toEqual({ fromDate: undefined, toDate: undefined });
  });
});

const entry = (id: string): AuditEntry => ({ id, at: "2026-11-02T00:52:24Z", actorId: "u", actorUsername: "tghung", deviceId: "d", action: "create", entity: "export_files", entityKey: id, summary: "" });

/** Buffer + máy chủ giả: `server` giữ id đã lên; `onSend` chạy giữa lúc gửi (giả thao tác ghi tiếp). */
function fakeIo(initial: string[], opts: { failIds?: string[]; onSend?: (n: number) => void; offline?: boolean } = {}) {
  let buf = initial.map(entry);
  const server = new Set<string>();
  let calls = 0;
  return {
    server,
    get buf() {
      return buf;
    },
    io: {
      read: () => [...buf],
      write: (rows: AuditEntry[]) => {
        buf = rows;
      },
      add: (id: string) => {
        buf = [...buf, entry(id)];
      },
      send: async (rows: AuditEntry[]): Promise<AuditSendResult> => {
        opts.onSend?.(++calls);
        if (opts.offline) return { ok: false };
        if (rows.some((r) => server.has(r.id))) return { ok: false, duplicate: true };
        if (rows.some((r) => opts.failIds?.includes(r.id))) return { ok: false };
        rows.forEach((r) => server.add(r.id));
        return { ok: true };
      },
    },
  };
}

describe("drainAuditBuffer — đẩy nhật ký không để dòng kẹt dưới máy", () => {
  it("thao tác ghi 2 bảng liền nhau: dòng thêm LÚC ĐANG GỬI cũng lên trong cùng lượt (lỗi file Lệnh xuất 2026-11-02)", async () => {
    const f = fakeIo(["item"]);
    f.io.send = ((orig) => async (rows: AuditEntry[]) => {
      const r = await orig(rows);
      if (rows[0].id === "item") f.io.add("file"); // saveFiles ghi xong trong lúc lô đầu đang bay
      return r;
    })(f.io.send);
    expect(await drainAuditBuffer(f.io)).toBe(true);
    expect([...f.server].sort()).toEqual(["file", "item"]);
    expect(f.buf).toEqual([]);
  });
  it("chia lô: 450 dòng, lô 200 ⇒ 3 lần gửi, buffer sạch", async () => {
    let sends = 0;
    const f = fakeIo(Array.from({ length: 450 }, (_, i) => `e${i}`), { onSend: () => sends++ });
    expect(await drainAuditBuffer(f.io, 200)).toBe(true);
    expect(sends).toBe(3);
    expect(f.server.size).toBe(450);
  });
  it("trùng khóa (lần trước đã lên mà mất phản hồi): gửi lại từng dòng, dòng trùng coi như đã lên", async () => {
    const f = fakeIo(["a", "b", "c"]);
    f.server.add("b");
    expect(await drainAuditBuffer(f.io)).toBe(true);
    expect([...f.server].sort()).toEqual(["a", "b", "c"]);
    expect(f.buf).toEqual([]);
  });
  it("mất mạng: giữ nguyên buffer, báo chưa sạch để hẹn thử lại", async () => {
    const f = fakeIo(["a", "b"], { offline: true });
    expect(await drainAuditBuffer(f.io)).toBe(false);
    expect(f.buf.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
