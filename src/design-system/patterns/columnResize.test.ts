import { describe, expect, test } from "vitest";
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, clampColumnWidth, sanitizeColumnWidths } from "./columnResize";

describe("Kéo giãn cột kiểu Excel — bề rộng nhớ theo máy", () => {
  test("kẹp bề rộng trong khoảng cho phép, làm tròn px", () => {
    expect(clampColumnWidth(5)).toBe(MIN_COLUMN_WIDTH);
    expect(clampColumnWidth(5000)).toBe(MAX_COLUMN_WIDTH);
    expect(clampColumnWidth(120.6)).toBe(121);
  });

  test("cài đặt cũ hỏng / lạ trên máy không làm vỡ bảng", () => {
    expect(sanitizeColumnWidths(null)).toEqual({});
    expect(sanitizeColumnWidths([1, 2])).toEqual({});
    expect(sanitizeColumnWidths("abc")).toEqual({});
    expect(sanitizeColumnWidths({ day: 90, donGia: "100", tyLe: -3, name: Number.NaN, wide: 9999 })).toEqual({
      day: 90,
      wide: MAX_COLUMN_WIDTH,
    });
  });
});
