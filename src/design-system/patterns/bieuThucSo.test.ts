import { describe, expect, it } from "vitest";
import { laBieuThuc, parseSo, parseSoHoacBieuThuc, tinhBieuThuc } from "./bieuThucSo";

describe("parseSo — số thường vi-VN", () => {
  it("dấu chấm phân nghìn, phẩy thập phân", () => {
    expect(parseSo("1.234,5")).toBe(1234.5);
    expect(parseSo("1 250")).toBe(1250);
    expect(parseSo("")).toBeNull();
    expect(parseSo("abc")).toBeNull();
  });
});

describe("tinhBieuThuc — kiểu Excel", () => {
  it("cộng trừ nhân chia, ưu tiên + ngoặc", () => {
    expect(tinhBieuThuc("250+300")).toBe(550);
    expect(tinhBieuThuc("2+3*4")).toBe(14);
    expect(tinhBieuThuc("(3+4)*2")).toBe(14);
    expect(tinhBieuThuc("10/4")).toBe(2.5);
  });
  it("nhận dấu = đầu như Excel", () => {
    expect(tinhBieuThuc("=1+2")).toBe(3);
    expect(tinhBieuThuc("= 1.000 + 250")).toBe(1250);
    expect(tinhBieuThuc("=1250")).toBe(1250);
  });
  it("x × : ÷ thay cho * /", () => {
    expect(tinhBieuThuc("12x5")).toBe(60);
    expect(tinhBieuThuc("12×5")).toBe(60);
    expect(tinhBieuThuc("100:4")).toBe(25);
    expect(tinhBieuThuc("100÷4")).toBe(25);
  });
  it("phần trăm hậu tố", () => {
    expect(tinhBieuThuc("1000*5%")).toBe(50);
  });
  it("số vi-VN trong biểu thức + khử nhiễu phẩy động", () => {
    expect(tinhBieuThuc("250,5*2")).toBe(501);
    expect(tinhBieuThuc("0,1+0,2")).toBe(0.3);
  });
  it("dở / sai / chia 0 ⇒ null", () => {
    expect(tinhBieuThuc("250+")).toBeNull();
    expect(tinhBieuThuc("(1+2")).toBeNull();
    expect(tinhBieuThuc("5/0")).toBeNull();
    expect(tinhBieuThuc("2+a")).toBeNull();
  });
});

describe("parseSoHoacBieuThuc + laBieuThuc", () => {
  it("số âm và số có phân nghìn KHÔNG bị coi là biểu thức", () => {
    expect(laBieuThuc("-5")).toBe(false);
    expect(laBieuThuc("1.234,5")).toBe(false);
    expect(parseSoHoacBieuThuc("-5")).toBe(-5);
    expect(parseSoHoacBieuThuc("1.234,5")).toBe(1234.5);
  });
  it("biểu thức dở không rơi về số rác", () => {
    expect(laBieuThuc("250+")).toBe(true);
    expect(parseSoHoacBieuThuc("250+")).toBeNull();
    expect(parseSoHoacBieuThuc("=")).toBeNull();
  });
});
