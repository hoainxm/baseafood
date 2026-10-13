import { describe, expect, test } from "vitest";
import { formatDisplayDate } from "./einvoiceReconciliation";

describe("formatDisplayDate", () => {
  test("Date SheetJS lệch giây múi giờ (23:59:30 hôm trước) ⇒ đúng ngày trong ô", () => {
    expect(formatDisplayDate(new Date(2026, 6, 31, 23, 59, 30))).toBe("01/08/2026");
    expect(formatDisplayDate(new Date(2025, 11, 31, 23, 59, 30))).toBe("01/01/2026");
  });
  test("ô có giờ thật giữ nguyên ngày", () => {
    expect(formatDisplayDate(new Date(2026, 7, 1, 0, 0, 0))).toBe("01/08/2026");
    expect(formatDisplayDate(new Date(2026, 7, 1, 14, 0, 0))).toBe("01/08/2026");
    expect(formatDisplayDate(new Date(2026, 7, 1, 23, 50, 0))).toBe("01/08/2026");
    // giờ thật sát nửa đêm (23:56) KHÔNG được nhảy sang hôm sau
    expect(formatDisplayDate(new Date(2026, 7, 1, 23, 56, 0))).toBe("01/08/2026");
  });
  test("số serial + chuỗi", () => {
    expect(formatDisplayDate(46235)).toBe("01/08/2026");
    expect(formatDisplayDate("1/8/2026")).toBe("01/08/2026");
  });
});
