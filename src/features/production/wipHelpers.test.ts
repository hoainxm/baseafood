import { describe, it, expect } from "vitest";
import {
  isDomesticSaleLineComplete,
  isDomesticSaleLineEmpty,
  createEmptyDomesticSaleLine,
  createEmptyProductionLine,
  isSplitLine,
  getLineTotalKg,
  isLineComplete,
  isLineEmpty,
  type ProductionLine,
} from "./wipHelpers";

// Luật "tách râu + bao tử (cùng giá)": đã nhập một trong hai thành phần thì
// tổng dòng = râu + bao tử (bỏ qua ô Số lượng); chưa tách thì tổng = Số lượng.

const d = (p: Partial<ProductionLine>): ProductionLine => ({ ...createEmptyProductionLine("g1"), ...p });

describe("createEmptyProductionLine", () => {
  it("dòng trống mang nhãn nhóm, chưa có mặt hàng/kg", () => {
    const r = createEmptyProductionLine("g1", "luộc", "Peacock");
    expect(r.groupId).toBe("g1");
    expect(r.processingType).toBe("luộc");
    expect(r.customerName).toBe("Peacock");
    expect(r.productId).toBe("");
    expect(r.botKg).toEqual({});
    expect(getLineTotalKg(r)).toBe(0);
    expect(r.key).not.toBe(createEmptyProductionLine("g1").key); // key React ổn định, khác nhau mỗi dòng
  });
});

describe("isSplitLine / sumMonthlyStockRows", () => {
  it("chưa nhập râu/bao tử ⇒ không tách, tổng = quantityKg", () => {
    const r = d({ productId: "p", quantityKg: 120 });
    expect(isSplitLine(r)).toBe(false);
    expect(getLineTotalKg(r)).toBe(120);
  });
  it("nhập râu hoặc bao tử ⇒ tách, tổng = râu + bao tử (bỏ qua quantityKg)", () => {
    expect(getLineTotalKg(d({ tentacleKg: 30, stomachKg: 0, quantityKg: 999 }))).toBe(30);
    expect(getLineTotalKg(d({ tentacleKg: 30, stomachKg: 20, quantityKg: 999 }))).toBe(50);
    expect(isSplitLine(d({ stomachKg: 5 }))).toBe(true);
  });
});

describe("bột tẩm không cộng vào thành phẩm", () => {
  it("tổng dòng chỉ tính thành phẩm, bỏ qua kg bột", () => {
    expect(getLineTotalKg(d({ productId: "p", quantityKg: 470, botKg: { "Bột 24V": 47 } }))).toBe(470);
    expect(isLineComplete(d({ productId: "p", botKg: { "Bột 24V": 5 } }))).toBe(false); // chỉ có bột, chưa có TP
  });
});

describe("isLineComplete / isLineEmpty", () => {
  it("đủ để lưu = có mặt hàng + tổng > 0", () => {
    expect(isLineComplete(d({ productId: "p", quantityKg: 10 }))).toBe(true);
    expect(isLineComplete(d({ productId: "p", quantityKg: 0 }))).toBe(false);
    expect(isLineComplete(d({ productId: "", quantityKg: 10 }))).toBe(false);
    expect(isLineComplete(d({ productId: "p", tentacleKg: 1 }))).toBe(true); // tách vẫn tính
  });
  it("dòng trống chờ gõ = chưa có mặt hàng lẫn kg — dù đã mang nhãn nhóm", () => {
    expect(isLineEmpty(d({ processingType: "luộc", customerName: "A" }))).toBe(true);
    expect(isLineEmpty(d({ productId: "p" }))).toBe(false);
    expect(isLineEmpty(d({ quantityKg: 1 }))).toBe(false);
  });
});

describe("dòng bán nội địa (NL bán thẳng — sổ riêng, không cộng vào thành phẩm)", () => {
  it("đủ để lưu = có loại NL + kg > 0", () => {
    expect(isDomesticSaleLineComplete({ ...createEmptyDomesticSaleLine("Bạch tuộc 2 da"), quantityKg: 987 })).toBe(true);
    expect(isDomesticSaleLineComplete({ ...createEmptyDomesticSaleLine(" "), quantityKg: 987 })).toBe(false);
    expect(isDomesticSaleLineComplete(createEmptyDomesticSaleLine("Bạch tuộc 2 da"))).toBe(false);
  });
  it("trống hẳn = chưa gõ gì — có giá hay khách là không còn trống", () => {
    expect(isDomesticSaleLineEmpty(createEmptyDomesticSaleLine())).toBe(true);
    expect(isDomesticSaleLineEmpty({ ...createEmptyDomesticSaleLine(), unitPrice: 145000 })).toBe(false);
    expect(isDomesticSaleLineEmpty({ ...createEmptyDomesticSaleLine(), customerName: "Chợ Bà Rịa" })).toBe(false);
    expect(isDomesticSaleLineEmpty(createEmptyDomesticSaleLine("Bạch tuộc 2 da"))).toBe(false);
  });
});
