import { describe, it, expect } from "vitest";
import { num, kg, formatDateVN, todayISO, chuan0, formatMoney } from "@/lib/format";

describe("num", () => {
  it("null/undefined/NaN ⇒ chuỗi rỗng (không phải '0')", () => {
    expect(num(null)).toBe("");
    expect(num(undefined)).toBe("");
    expect(num(NaN)).toBe("");
  });
  it("nhóm hàng nghìn theo locale vi-VN", () => {
    expect(num(1000)).toBe("1.000");
    expect(num(1234567)).toBe("1.234.567");
  });
});

describe("không in -0", () => {
  it("vụn âm cực nhỏ / −0 / làm tròn ra 0 ⇒ '0'", () => {
    expect(num(-5.55e-17)).toBe("0");
    expect(num(-0)).toBe("0");
    expect(num(-0.004)).toBe("0");
    expect(kg(-1e-12)).toBe("0 kg");
    expect(num(-0.01)).toBe("-0,01");
    expect(chuan0(-1e-9)).toBe(0);
  });
});

describe("kg", () => {
  it("kèm đơn vị, rỗng khi null", () => {
    expect(kg(5)).toBe("5 kg");
    expect(kg(null)).toBe("");
  });
});

describe("formatDateVN", () => {
  it("yyyy-mm-dd ⇒ dd/mm/yyyy", () => {
    expect(formatDateVN("2026-09-21")).toBe("21/09/2026");
  });
});

describe("todayISO", () => {
  it("trả yyyy-mm-dd hợp lệ", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatMoney", () => {
  it("đủ 2 số lẻ kiểu vi-VN", () => {
    expect(formatMoney(194557.6)).toBe("194.557,60");
    expect(formatMoney(10.5)).toBe("10,50");
    expect(formatMoney(0)).toBe("0,00");
    expect(formatMoney(null)).toBe("");
  });
});
