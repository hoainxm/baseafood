import { describe, expect, it } from "vitest";
import { fitColumnWidth, fitTextColumnWidth, formattedWidthCh, longestFormattedWidthCh, textWidthCh } from "./gridFitWidth";

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

describe("gridFitWidth — cột ô điều khiển vừa chữ dài nhất", () => {
  it("chữ hoa / rộng tính rộng hơn chữ thường, chữ hẹp và khoảng trắng chưa tới nửa", () => {
    expect(textWidthCh("ab")).toBe(1.9);
    expect(textWidthCh("AB")).toBe(2.1);
    expect(textWidthCh("Mw")).toBe(2.7);
    expect(textWidthCh("i l")).toBe(1.35);
  });

  it("luôn DƯ hơn bề rộng đo thật (Be Vietnam Pro 500, đơn vị ch) — không bao giờ cắt chữ", () => {
    const measured: Record<string, number> = { "SEACHEMOT CO., LTD": 15.78, Hanwa: 4.95, "Chọn khách": 8.47, Peacock: 6.26, JFDA: 3.69, Sasano: 5.31 };
    for (const [name, real] of Object.entries(measured)) {
      expect(textWidthCh(name)).toBeGreaterThanOrEqual(real);
      expect(textWidthCh(name) - real).toBeLessThan(1.1); // dư tối đa ~11px ở chữ 15px
    }
  });

  it("dấu tiếng Việt không làm chữ rộng thêm", () => {
    expect(textWidthCh("Chọn khách")).toBe(textWidthCh("Chon khach"));
  });

  it("tên dài nhất quyết định bề rộng, cộng khung ô chọn + đệm ô", () => {
    const longest = textWidthCh("SEACHEMOT CO., LTD");
    expect(fitTextColumnWidth(["Hanwa", "SEACHEMOT CO., LTD", null, "Chọn khách"], "3.25rem")).toBe(
      `calc(${longest}ch + 3.25rem + 1rem + 2px)`
    );
    expect(fitTextColumnWidth([], "3.25rem")).toBe("calc(0ch + 3.25rem + 1rem + 2px)");
  });
});
