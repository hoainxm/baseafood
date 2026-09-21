import { describe, it, expect } from "vitest";
import { num, kg, viDate, todayISO } from "@/lib/format";

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

describe("kg", () => {
  it("kèm đơn vị, rỗng khi null", () => {
    expect(kg(5)).toBe("5 kg");
    expect(kg(null)).toBe("");
  });
});

describe("viDate", () => {
  it("yyyy-mm-dd ⇒ dd/mm/yyyy", () => {
    expect(viDate("2026-09-21")).toBe("21/09/2026");
  });
});

describe("todayISO", () => {
  it("trả yyyy-mm-dd hợp lệ", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
