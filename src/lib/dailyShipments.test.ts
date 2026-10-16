import { describe, expect, it } from "vitest";
import type { MaterialImportItem } from "@/types";
import { groupDailyShipments, groupImportsBySupplier, groupImportsByMaterialType, countDailyShipments, summarizeImportsByDay } from "./dailyShipments";

const row = (p: Partial<MaterialImportItem> & Pick<MaterialImportItem, "id">): MaterialImportItem => ({
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

describe("summarizeImportsByDay", () => {
  it("đếm chuyến (theo shipmentId) và cộng kg từng ngày", () => {
    const r = summarizeImportsByDay([
      row({ id: "1", shipmentId: "s1" }),
      row({ id: "2", shipmentId: "s1", quantityKg: 50 }),
      row({ id: "3", shipmentId: "s2" }),
      row({ id: "4", shipmentId: "s3", deliveryDate: "2026-09-03", quantityKg: 30 }),
    ]);
    expect(r.get("2026-09-02")).toEqual({ shipmentCount: 2, kg: 250 });
    expect(r.get("2026-09-03")).toEqual({ shipmentCount: 1, kg: 30 });
  });
});

describe("groupDailyShipments", () => {
  const imports = [
    row({ id: "1", shipmentId: "s1", supplierName: "Đại lý A", quantityKg: 100, licensePlate: "72C-123", driverName: "Hùng" }),
    row({ id: "2", shipmentId: "s1", supplierName: "Đại lý A", materialTypeName: "Bạch tuộc nhỏ", quantityKg: 40, unitPrice: 30000 }),
    row({ id: "3", shipmentId: "s2", supplierName: "Đại lý A", quantityKg: 60 }),
    row({ id: "4", shipmentId: "s3", supplierName: "Đại lý B", quantityKg: 500, unitPrice: null }),
    row({ id: "5", shipmentId: "s4", supplierName: "Đại lý A", deliveryDate: "2026-09-03" }),
  ];

  it("gom đại lý → chuyến → dòng của đúng ngày, đại lý nhiều kg trước", () => {
    const r = groupDailyShipments(imports, "2026-09-02", [{ id: "s1", lotCode: "Đ-260902-01" }]);
    expect(r.map((d) => [d.supplier, d.kg, d.shipments.length])).toEqual([
      ["Đại lý B", 500, 1],
      ["Đại lý A", 200, 2],
    ]);
    const a = r[1];
    expect(a.shipments.map((c) => [c.label, c.kg, c.lines.length, c.vehicle])).toEqual([
      ["Đ-260902-01", 140, 2, "72C-123 · Hùng"],
      ["Chuyến 2", 60, 1, ""],
    ]);
    // Thành tiền = kg × giá; giá trống tính 0.
    expect(a.shipments[0].amount).toBe(100 * 50000 + 40 * 30000);
    expect(r[0].amount).toBe(0);
  });

  it("dòng cũ không có chuyến: mỗi dòng là một chuyến; đại lý trống có nhãn riêng", () => {
    const r = groupDailyShipments(
      [row({ id: "x" }), row({ id: "y", supplierName: " " })],
      "2026-09-02"
    );
    expect(r.map((d) => d.supplier).sort()).toEqual(["(chưa ghi đại lý)", "Đại lý A"]);
    expect(r.every((d) => d.shipments.length === 1)).toBe(true);
  });

  it("ngày không có chuyến ⇒ rỗng", () => {
    expect(groupDailyShipments(imports, "2026-09-10")).toEqual([]);
  });
});

describe("groupImportsBySupplier", () => {
  it("gom theo đại lý, kg theo ngày, tổng các đại lý = tổng dòng cha", () => {
    const imports = [
      row({ id: "1", shipmentId: "s1", supplierName: "A", quantityKg: 100 }),
      row({ id: "2", shipmentId: "s1", supplierName: "A", quantityKg: 40, unitPrice: 30000 }),
      row({ id: "3", shipmentId: "s2", supplierName: "A", quantityKg: 60, deliveryDate: "2026-09-03" }),
      row({ id: "4", shipmentId: "s3", supplierName: "B", quantityKg: 500, unitPrice: null }),
    ];
    const r = groupImportsBySupplier(imports);
    expect(r.map((d) => [d.supplier, d.kg, d.dailyAmounts, d.ids])).toEqual([
      ["B", 500, { "2026-09-02": 500 }, ["4"]],
      ["A", 200, { "2026-09-02": 140, "2026-09-03": 60 }, ["1", "2", "3"]],
    ]);
    expect(r[1].amount).toBe(100 * 50000 + 40 * 30000 + 60 * 50000);
    expect(r.reduce((s, d) => s + d.kg, 0)).toBe(imports.reduce((s, x) => s + x.quantityKg, 0));
  });
});

describe("countDailyShipments", () => {
  it("đếm chuyến khác nhau trong ngày; dòng không chuyến tính riêng", () => {
    const imports = [
      row({ id: "1", shipmentId: "s1" }),
      row({ id: "2", shipmentId: "s1" }),
      row({ id: "3", shipmentId: "" }),
      row({ id: "4", shipmentId: "s2", deliveryDate: "2026-09-03" }),
    ];
    expect(countDailyShipments(imports, "2026-09-02")).toBe(2);
    expect(countDailyShipments(imports, "2026-09-03")).toBe(1);
    expect(countDailyShipments(imports, "2026-09-09")).toBe(0);
  });
});

describe("groupImportsByMaterialType — tách 2 da lớn / 2 da nhỏ của một dòng lưới", () => {
  it("mỗi loại một nhóm (kg theo ngày + đại lý của loại); tổng các loại = dòng cha", () => {
    const imports = [
      row({ id: "1", materialTypeName: "2 da lớn", supplierName: "A", quantityKg: 300 }),
      row({ id: "2", materialTypeName: "2 da nhỏ", supplierName: "A", quantityKg: 100, deliveryDate: "2026-09-03" }),
      row({ id: "3", materialTypeName: "2 da lớn", supplierName: "B", quantityKg: 200, deliveryDate: "2026-09-03" }),
    ];
    const r = groupImportsByMaterialType(imports);
    expect(r.map((t) => [t.materialTypeName, t.kg, t.dailyAmounts])).toEqual([
      ["2 da lớn", 500, { "2026-09-02": 300, "2026-09-03": 200 }],
      ["2 da nhỏ", 100, { "2026-09-03": 100 }],
    ]);
    expect(r[0].suppliers.map((d) => [d.supplier, d.kg])).toEqual([["A", 300], ["B", 200]]);
    expect(r.reduce((s, t) => s + t.kg, 0)).toBe(600);
    expect(r[0].amount).toBe(500 * 50000);
  });
});
