import { describe, it, expect } from "vitest";
import { dongSXRong, laTach, tongDong, dongDayDu, dongTrong, type DongSX } from "./wipHelpers";

// Luật "tách râu + bao tử (cùng giá)": đã nhập một trong hai thành phần thì
// tổng dòng = râu + bao tử (bỏ qua ô Số lượng); chưa tách thì tổng = Số lượng.

const d = (p: Partial<DongSX>): DongSX => ({ ...dongSXRong("g1"), ...p });

describe("dongSXRong", () => {
  it("dòng trống mang nhãn nhóm, chưa có mặt hàng/kg", () => {
    const r = dongSXRong("g1", "luộc", "Peacock");
    expect(r.groupId).toBe("g1");
    expect(r.processingType).toBe("luộc");
    expect(r.customerName).toBe("Peacock");
    expect(r.productId).toBe("");
    expect(tongDong(r)).toBe(0);
    expect(r.key).not.toBe(dongSXRong("g1").key); // key React ổn định, khác nhau mỗi dòng
  });
});

describe("laTach / tongDong", () => {
  it("chưa nhập râu/bao tử ⇒ không tách, tổng = quantityKg", () => {
    const r = d({ productId: "p", quantityKg: 120 });
    expect(laTach(r)).toBe(false);
    expect(tongDong(r)).toBe(120);
  });
  it("nhập râu hoặc bao tử ⇒ tách, tổng = râu + bao tử (bỏ qua quantityKg)", () => {
    expect(tongDong(d({ rauKg: 30, baoTuKg: 0, quantityKg: 999 }))).toBe(30);
    expect(tongDong(d({ rauKg: 30, baoTuKg: 20, quantityKg: 999 }))).toBe(50);
    expect(laTach(d({ baoTuKg: 5 }))).toBe(true);
  });
});

describe("dongDayDu / dongTrong", () => {
  it("đủ để lưu = có mặt hàng + tổng > 0", () => {
    expect(dongDayDu(d({ productId: "p", quantityKg: 10 }))).toBe(true);
    expect(dongDayDu(d({ productId: "p", quantityKg: 0 }))).toBe(false);
    expect(dongDayDu(d({ productId: "", quantityKg: 10 }))).toBe(false);
    expect(dongDayDu(d({ productId: "p", rauKg: 1 }))).toBe(true); // tách vẫn tính
  });
  it("dòng trống chờ gõ = chưa có mặt hàng lẫn kg — dù đã mang nhãn nhóm", () => {
    expect(dongTrong(d({ processingType: "luộc", customerName: "A" }))).toBe(true);
    expect(dongTrong(d({ productId: "p" }))).toBe(false);
    expect(dongTrong(d({ quantityKg: 1 }))).toBe(false);
  });
});
