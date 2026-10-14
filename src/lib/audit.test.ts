import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null, hasSupabase: false, SITE_ID: "test" }));

import { toVnDayBoundsUtc } from "@/lib/audit";

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
