import { describe, expect, it } from "vitest";
import { fitColumnWidth, formattedWidthCh, longestFormattedWidthCh } from "./gridFitWidth";

describe("gridFitWidth — cột số vừa giá trị dài nhất", () => {
  it("chữ số 1ch, dấu chấm / phẩy 0,5ch, dấu trừ 0,75ch", () => {
    expect(formattedWidthCh("29.442")).toBe(5.5);
    expect(formattedWidthCh("-4.500.000")).toBe(7 + 1 + 0.75);
    expect(formattedWidthCh("10,43")).toBe(4.5);
  });

  it("lấy giá trị dài nhất theo chuỗi hiển thị vi-VN", () => {
    expect(longestFormattedWidthCh([15000, 29442, 8003])).toBe(5.5);
    expect(longestFormattedWidthCh([-4500000, 2077935000])).toBe(10 + 1.5);
  });

  it("bỏ ô trống / 0 (ô đó hiện —) và số không hữu hạn", () => {
    expect(longestFormattedWidthCh([null, undefined, 0, Number.NaN])).toBe(0);
  });

  it("cột trống vẫn chừa 1 ký tự; có số thì đúng bề rộng số + đệm ô", () => {
    expect(fitColumnWidth([])).toBe("calc(1ch + 1rem + 2px)");
    expect(fitColumnWidth([3051, 34])).toBe("calc(4.5ch + 1rem + 2px)");
  });

  it("cột tiền rộng hơn cột kg theo đúng độ dài số", () => {
    expect(longestFormattedWidthCh([4121880000, 1068751000])).toBeGreaterThan(longestFormattedWidthCh([29442, 8003]));
  });
});
