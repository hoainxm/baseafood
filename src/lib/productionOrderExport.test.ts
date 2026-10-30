// Oracle: docs/app-map/48-production-order.ba-spec.md — AC-7 (phát hành ⇒ bước 2 của chuyến xong),
// AC-8 (chuyến cũ xong bằng file vẫn xong), AC-12 (hủy ⇒ bước 2 tính lại). Luật R6 ở exportPlanning.subStepState.
import { describe, expect, test } from "vitest";
import type { ExportFile, ExportShipment, ProductionOrder, ProductionOrderShipment } from "@/types";
import { EMPTY_EXPORT_DATA, blankItem, subStepState, type ExportData } from "./exportPlanning";
import { emptyRequirements, issuedShipmentIds } from "./productionOrder";

const T0 = "2026-10-01T00:00:00.000Z";
const shipment = (id: string): ExportShipment => ({
  id,
  contractId: "c1",
  planMonth: "2026-11",
  kind: "40RF",
  goodsSummary: "",
  plannedKg: null,
  lotCode: "",
  portOfDischarge: "",
  bookingNo: "",
  loadingDate: "",
  etd: "",
  eta: "",
  vesselVoyage: "",
  containerNo: "",
  sealNo: "",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: T0,
});
const order = (id: string, status: ProductionOrder["status"]): ProductionOrder => ({
  id,
  orderNo: id,
  orderDate: "2026-10-27",
  contractId: "c1",
  contractRevisionId: "r0",
  contractNo: "01-26-HAT",
  customerName: "",
  market: "",
  lotCode: "205",
  productionDates: ["2026-11-02"],
  deliveryDate: "2026-11-15",
  shelfLifeMonths: 24,
  requirements: emptyRequirements(),
  note: "",
  status,
  issuedAt: status === "draft" ? "" : T0,
  issuedBy: "",
  revisionNo: 0,
  revisionReason: "",
  cancelReason: "",
  staleAckRevisionId: "",
  staleAckReason: "",
  createdBy: "",
  createdAt: T0,
});
const link = (orderId: string, shipmentId: string): ProductionOrderShipment => ({ id: `${orderId}-${shipmentId}`, orderId, shipmentId, createdAt: T0 });

function data(orders: ProductionOrder[], links: ProductionOrderShipment[], over: Partial<ExportData> = {}): ExportData {
  return {
    ...EMPTY_EXPORT_DATA,
    shipments: [shipment("S1"), shipment("S2"), shipment("S3")],
    items: ["S1", "S2", "S3"].map((s, i) => blankItem(s, "production-order", `it-${i}`, T0)),
    issuedOrderShipmentIds: issuedShipmentIds(orders, links),
    ...over,
  };
}

describe("R6 — bước 2 của chuyến theo Lệnh sản xuất", () => {
  test("AC-7: lệnh phát hành gắn S1 + S2 ⇒ S1, S2 xong; S3 không gắn ⇒ chưa", () => {
    const d = data([order("A", "issued")], [link("A", "S1"), link("A", "S2")]);
    expect(subStepState(d, "S1", "production-order")).toBe("done");
    expect(subStepState(d, "S2", "production-order")).toBe("done");
    expect(subStepState(d, "S3", "production-order")).toBe("not-started");
  });
  test("lệnh nháp gắn chuyến ⇒ chưa xong", () => {
    const d = data([order("B", "draft")], [link("B", "S1")]);
    expect(subStepState(d, "S1", "production-order")).toBe("not-started");
  });
  test("AC-12: lệnh đã hủy ⇒ bước 2 tính lại theo luật cũ", () => {
    const d = data([order("C", "cancelled")], [link("C", "S1")]);
    expect(subStepState(d, "S1", "production-order")).toBe("not-started");
  });
  test("AC-8: chuyến cũ xong bằng file, không có lệnh ⇒ vẫn xong; không có tập lệnh ⇒ luật cũ y nguyên", () => {
    const base = data([], []);
    const it = base.items[0];
    const file: ExportFile = { id: "f1", contractId: "c1", shipmentId: "S1", stepItemId: it.id, step: "production-order", path: "x/lsx.pdf", fileName: "lsx.pdf", layerNo: null, attachmentKind: "", uploadedBy: "", createdAt: T0 } as ExportFile;
    const withFile = { ...base, items: [{ ...it, state: "done" as const }, ...base.items.slice(1)], files: [file] };
    expect(subStepState(withFile, "S1", "production-order")).toBe("done");
    const { issuedOrderShipmentIds: _drop, ...legacy } = withFile;
    expect(subStepState(legacy, "S1", "production-order")).toBe("done");
    expect(subStepState(legacy, "S2", "production-order")).toBe("not-started");
  });
  test("chỉ bước 2 theo lệnh — bước Bao bì của chuyến không đổi", () => {
    const d = data([order("A", "issued")], [link("A", "S1")], { items: [blankItem("S1", "packaging", "p1", T0)] });
    expect(subStepState(d, "S1", "packaging")).toBe("not-started");
  });
});
