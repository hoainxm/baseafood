import { describe, expect, test } from "vitest";
import { ngayHienThi } from "./doiSoatHddt";

describe("ngayHienThi", () => {
  test("Date SheetJS lệch giây múi giờ (23:59:30 hôm trước) ⇒ đúng ngày trong ô", () => {
    expect(ngayHienThi(new Date(2026, 6, 31, 23, 59, 30))).toBe("01/08/2026");
    expect(ngayHienThi(new Date(2025, 11, 31, 23, 59, 30))).toBe("01/01/2026");
  });
  test("ô có giờ thật giữ nguyên ngày", () => {
    expect(ngayHienThi(new Date(2026, 7, 1, 0, 0, 0))).toBe("01/08/2026");
    expect(ngayHienThi(new Date(2026, 7, 1, 14, 0, 0))).toBe("01/08/2026");
    expect(ngayHienThi(new Date(2026, 7, 1, 23, 50, 0))).toBe("01/08/2026");
  });
  test("số serial + chuỗi", () => {
    expect(ngayHienThi(46235)).toBe("01/08/2026");
    expect(ngayHienThi("1/8/2026")).toBe("01/08/2026");
  });
});
