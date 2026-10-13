import { describe, expect, it } from "vitest";
import { isExpression, parseVnNumber, parseNumberOrExpression, evaluateExpression } from "./numberExpression";

describe("parseVnNumber — số thường vi-VN", () => {
  it("dấu chấm phân nghìn, phẩy thập phân", () => {
    expect(parseVnNumber("1.234,5")).toBe(1234.5);
    expect(parseVnNumber("1 250")).toBe(1250);
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
