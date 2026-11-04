import { describe, expect, it } from "vitest";
import { isExpression, parseVnNumber, parseNumberOrExpression, evaluateExpression, formatNumber, formatNumberInput, roundInputNumber } from "./numberExpression";

describe("parseVnNumber — số thường vi-VN", () => {
  it("dấu chấm phân nghìn, phẩy thập phân", () => {
    expect(parseVnNumber("1.234,5")).toBe(1234.5);
    expect(parseVnNumber("1 250")).toBe(1250);
    // Số chép từ chứng từ tiếng Anh (audit Xuất khẩu 2026-10-20: "10.50" từng bị đọc thành 1.050)
    expect(parseVnNumber("10.50")).toBe(10.5);
    expect(parseVnNumber("4.05")).toBe(4.05);
    expect(parseVnNumber("194,557.60")).toBe(194557.6);
    expect(parseVnNumber("22,214.00")).toBe(22214);
    // Kiểu Việt giữ nguyên
    expect(parseVnNumber("1.234")).toBe(1234);
    expect(parseVnNumber("1.234.567")).toBe(1234567);
    expect(parseVnNumber("2,5")).toBe(2.5);
    expect(parseVnNumber("-1.234")).toBe(-1234);
    expect(parseVnNumber("")).toBeNull();
    expect(parseVnNumber("abc")).toBeNull();
  });
});

describe("evaluateExpression — kiểu Excel", () => {
  it("cộng trừ nhân chia, ưu tiên + ngoặc", () => {
    expect(evaluateExpression("250+300")).toBe(550);
    expect(evaluateExpression("2+3*4")).toBe(14);
    expect(evaluateExpression("(3+4)*2")).toBe(14);
    expect(evaluateExpression("10/4")).toBe(2.5);
  });
  it("nhận dấu = đầu như Excel", () => {
    expect(evaluateExpression("=1+2")).toBe(3);
    expect(evaluateExpression("= 1.000 + 250")).toBe(1250);
    expect(evaluateExpression("=1250")).toBe(1250);
  });
  it("x × : ÷ thay cho * /", () => {
    expect(evaluateExpression("12x5")).toBe(60);
    expect(evaluateExpression("12×5")).toBe(60);
    expect(evaluateExpression("100:4")).toBe(25);
    expect(evaluateExpression("100÷4")).toBe(25);
  });
  it("phần trăm hậu tố", () => {
    expect(evaluateExpression("1000*5%")).toBe(50);
  });
  it("số vi-VN trong biểu thức + khử nhiễu phẩy động", () => {
    expect(evaluateExpression("250,5*2")).toBe(501);
    expect(evaluateExpression("0,1+0,2")).toBe(0.3);
  });
  it("dở / sai / chia 0 ⇒ null", () => {
    expect(evaluateExpression("250+")).toBeNull();
    expect(evaluateExpression("(1+2")).toBeNull();
    expect(evaluateExpression("5/0")).toBeNull();
    expect(evaluateExpression("2+a")).toBeNull();
  });
});

describe("parseNumberOrExpression + isExpression", () => {
  it("số âm và số có phân nghìn KHÔNG bị coi là biểu thức", () => {
    expect(isExpression("-5")).toBe(false);
    expect(isExpression("1.234,5")).toBe(false);
    expect(parseNumberOrExpression("-5")).toBe(-5);
    expect(parseNumberOrExpression("1.234,5")).toBe(1234.5);
  });
  it("biểu thức dở không rơi về số rác", () => {
    expect(isExpression("250+")).toBe(true);
    expect(parseNumberOrExpression("250+")).toBeNull();
    expect(parseNumberOrExpression("=")).toBeNull();
  });
});

describe("formatNumberInput — ô nhập giữ tới 6 số lẻ (chị Thảo 2026-11-04)", () => {
  it("giữ đủ 6 số lẻ, không thêm số 0 thừa", () => {
    expect(formatNumberInput(12.345678)).toBe("12,345678");
    expect(formatNumberInput(1234.5)).toBe("1.234,5");
    expect(formatNumberInput(7)).toBe("7");
    expect(formatNumberInput(null)).toBe("");
  });
  it("gõ → hiện lại → đọc lại vẫn đúng số (không mất số lẻ khi sửa lại)", () => {
    for (const n of [12.345678, 0.000001, 1234567.123456]) expect(parseVnNumber(formatNumberInput(n))).toBe(n);
  });
  it("quá 6 số lẻ ⇒ làm tròn về 6", () => {
    expect(roundInputNumber(1.23456789)).toBe(1.234568);
    expect(roundInputNumber(parseNumberOrExpression("0,1+0,2") ?? 0)).toBe(0.3);
  });
  it("formatNumber (hiển thị bảng) giữ 3 số lẻ như cũ", () => {
    expect(formatNumber(12.345678)).toBe("12,346");
  });
});
