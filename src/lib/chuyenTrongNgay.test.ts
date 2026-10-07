import { describe, expect, it } from "vitest";
import type { MaterialImportItem } from "@/types";
import { chuyenTrongNgay, daiLyTrongKy, soChuyenNgay, tomTatTheoNgay } from "./chuyenTrongNgay";

const dong = (p: Partial<MaterialImportItem> & Pick<MaterialImportItem, "id">): MaterialImportItem => ({
  shipmentId: "",
  deliveryDate: "2026-09-02",
  workshop: "Đông",
  category: "Thủy sản" as MaterialImportItem["category"],
  supplierName: "Đại lý A",
  materialTypeName: "Bạch tuộc lớn",
  quantityKg: 100,
  unitPrice: 50000,
  driverName: "",
  licensePlate: "",
  note: "",
  ...p,
});

describe("tomTatTheoNgay", () => {
  it("đếm chuyến (theo shipmentId) và cộng kg từng ngày", () => {
    const r = tomTatTheoNgay([
      dong({ id: "1", shipmentId: "s1" }),
      dong({ id: "2", shipmentId: "s1", quantityKg: 50 }),
      dong({ id: "3", shipmentId: "s2" }),
      dong({ id: "4", shipmentId: "s3", deliveryDate: "2026-09-03", quantityKg: 30 }),
    ]);
    expect(r.get("2026-09-02")).toEqual({ soChuyen: 2, kg: 250 });
    expect(r.get("2026-09-03")).toEqual({ soChuyen: 1, kg: 30 });
  });
});

describe("chuyenTrongNgay", () => {
  const nhap = [
    dong({ id: "1", shipmentId: "s1", supplierName: "Đại lý A", quantityKg: 100, licensePlate: "72C-123", driverName: "Hùng" }),
    dong({ id: "2", shipmentId: "s1", supplierName: "Đại lý A", materialTypeName: "Bạch tuộc nhỏ", quantityKg: 40, unitPrice: 30000 }),
    dong({ id: "3", shipmentId: "s2", supplierName: "Đại lý A", quantityKg: 60 }),
    dong({ id: "4", shipmentId: "s3", supplierName: "Đại lý B", quantityKg: 500, unitPrice: null }),
    dong({ id: "5", shipmentId: "s4", supplierName: "Đại lý A", deliveryDate: "2026-09-03" }),
  ];

  it("gom đại lý → chuyến → dòng của đúng ngày, đại lý nhiều kg trước", () => {
    const r = chuyenTrongNgay(nhap, "2026-09-02", [{ id: "s1", lotCode: "Đ-260902-01" }]);
    expect(r.map((d) => [d.daiLy, d.kg, d.chuyen.length])).toEqual([
      ["Đại lý B", 500, 1],
      ["Đại lý A", 200, 2],
    ]);
    const a = r[1];
    expect(a.chuyen.map((c) => [c.nhan, c.kg, c.dong.length, c.xe])).toEqual([
      ["Đ-260902-01", 140, 2, "72C-123 · Hùng"],
      ["Chuyến 2", 60, 1, ""],
    ]);
    // Thành tiền = kg × giá; giá trống tính 0.
    expect(a.chuyen[0].tien).toBe(100 * 50000 + 40 * 30000);
    expect(r[0].tien).toBe(0);
  });

  it("dòng cũ không có chuyến: mỗi dòng là một chuyến; đại lý trống có nhãn riêng", () => {
    const r = chuyenTrongNgay(
      [dong({ id: "x" }), dong({ id: "y", supplierName: " " })],
      "2026-09-02"
    );
    expect(r.map((d) => d.daiLy).sort()).toEqual(["(chưa ghi đại lý)", "Đại lý A"]);
    expect(r.every((d) => d.chuyen.length === 1)).toBe(true);
  });

  it("ngày không có chuyến ⇒ rỗng", () => {
    expect(chuyenTrongNgay(nhap, "2026-09-10")).toEqual([]);
  });
});

describe("daiLyTrongKy", () => {
  it("gom theo đại lý, kg theo ngày, tổng các đại lý = tổng dòng cha", () => {
    const nhap = [
      dong({ id: "1", shipmentId: "s1", supplierName: "A", quantityKg: 100 }),
      dong({ id: "2", shipmentId: "s1", supplierName: "A", quantityKg: 40, unitPrice: 30000 }),
      dong({ id: "3", shipmentId: "s2", supplierName: "A", quantityKg: 60, deliveryDate: "2026-09-03" }),
      dong({ id: "4", shipmentId: "s3", supplierName: "B", quantityKg: 500, unitPrice: null }),
    ];
    const r = daiLyTrongKy(nhap);
    expect(r.map((d) => [d.daiLy, d.kg, d.theoNgay, d.ids])).toEqual([
      ["B", 500, { "2026-09-02": 500 }, ["4"]],
      ["A", 200, { "2026-09-02": 140, "2026-09-03": 60 }, ["1", "2", "3"]],
    ]);
    expect(r[1].tien).toBe(100 * 50000 + 40 * 30000 + 60 * 50000);
    expect(r.reduce((s, d) => s + d.kg, 0)).toBe(nhap.reduce((s, x) => s + x.quantityKg, 0));
  });
});

describe("soChuyenNgay", () => {
  it("đếm chuyến khác nhau trong ngày; dòng không chuyến tính riêng", () => {
    const nhap = [
      dong({ id: "1", shipmentId: "s1" }),
      dong({ id: "2", shipmentId: "s1" }),
      dong({ id: "3", shipmentId: "" }),
      dong({ id: "4", shipmentId: "s2", deliveryDate: "2026-09-03" }),
    ];
    expect(soChuyenNgay(nhap, "2026-09-02")).toBe(2);
    expect(soChuyenNgay(nhap, "2026-09-03")).toBe(1);
    expect(soChuyenNgay(nhap, "2026-09-09")).toBe(0);
  });
});
