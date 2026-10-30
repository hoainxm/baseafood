// ============================================================
// Tên file: src/lib/productionOrderDemo.ts
// Tên tiếng Việt: Bộ demo Lệnh sản xuất — dựng theo khuôn LSX 19.10 trên HĐ / lần nhập của bộ demo
// Description: Demo production orders (ba-spec 48, mig 0088) built on the demo export contract and import
//              receipts: one issued order shaped like LSX 19.10 (cartons × 12 kg, 3 production days, strap
//              colour per day, linked to a shipment, imported material reserved) and one draft. Numbers are
//              made up from the demo set, not copied from real orders.
// ============================================================
import type {
  Customer,
  Product,
  ProductionOrder,
  ProductionOrderLine,
  ProductionOrderMaterial,
  ProductionOrderShipment,
} from "@/types";
import { effectiveRevision, type ExportData } from "./exportPlanning";
import type { ImportData } from "./importPlanning";
import { formatDateVN } from "./format";
import { emptyRequirements, lineFromContract, lineKg, nextOrderNumber } from "./productionOrder";

export interface ProductionOrderDemoSet {
  orders: ProductionOrder[];
  lines: ProductionOrderLine[];
  materials: ProductionOrderMaterial[];
  shipments: ProductionOrderShipment[];
}

const EMPTY: ProductionOrderDemoSet = { orders: [], lines: [], materials: [], shipments: [] };

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function buildProductionOrderDemo(
  today: string,
  exportSet: Pick<ExportData, "contracts" | "revisions" | "approvals" | "shipments">,
  importSet: Pick<ImportData, "receipts" | "receiptLines">,
  products: readonly Pick<Product, "id" | "name">[],
  customers: readonly Pick<Customer, "id" | "name">[],
): ProductionOrderDemoSet {
  const at = `${today}T08:00:00.000Z`;
  // HĐ đầu tiên còn mở, có bản hiệu lực và ≥ 1 dòng đã nối mặt hàng.
  const pick = exportSet.contracts
    .filter((c) => c.status === "open")
    .map((c) => ({ c, rev: effectiveRevision(exportSet, c.id) }))
    .find((x) => x.rev?.lines.some((l) => l.productId));
  if (!pick?.rev) return EMPTY;
  const { c, rev } = pick;
  const mapped = rev.lines.filter((l) => l.productId);
  const productName = (id = "") => products.find((p) => p.id === id)?.name ?? "";
  const customerName = customers.find((x) => x.id === c.customerId)?.name ?? "";
  const shipment = exportSet.shipments.find((s) => s.contractId === c.id && s.status === "open");

  const base = (id: string, over: Partial<ProductionOrder>): ProductionOrder => ({
    id,
    orderNo: "",
    orderDate: today,
    contractId: c.id,
    contractRevisionId: rev.id,
    contractNo: c.contractNo,
    customerName,
    market: "",
    lotCode: "",
    productionDates: [],
    deliveryDate: "",
    shelfLifeMonths: 24,
    requirements: emptyRequirements(),
    note: "",
    status: "draft",
    issuedAt: "",
    issuedBy: "",
    revisionNo: 0,
    revisionReason: "",
    cancelReason: "",
    staleAckRevisionId: "",
    staleAckReason: "",
    createdBy: "Phòng Kế hoạch (demo)",
    createdAt: at,
    ...over,
  });

  const firstNo = nextOrderNumber([], today);
  const issued = base("lsx-demo-1", {
    orderNo: firstNo,
    lotCode: shipment?.lotCode.trim() || "205",
    productionDates: [addDays(today, 3), addDays(today, 4), addDays(today, 5)],
    deliveryDate: addDays(today, 16),
    status: "issued",
    issuedAt: at,
    issuedBy: "Phòng Kế hoạch (demo)",
    requirements: {
      ...emptyRequirements(),
      packagingReady: "ready",
      cartonLayers: "5 lớp",
      strapNote: "Mỗi ngày sản xuất một màu dây đai (xanh dương, đỏ, vàng)",
      cartonMarking: "Mã số lô, NSX, HSD",
      nafiTests: ["Vi sinh"],
      processNote: "Theo quy trình SX của Phòng Kỹ thuật",
    },
    note: "Đóng hàng lên cont theo ngày sản xuất thực tế HACCP",
  });
  const draft = base("lsx-demo-2", {
    orderNo: nextOrderNumber([issued], today),
    lotCode: "",
    productionDates: [addDays(today, 10)],
    deliveryDate: addDays(today, 20),
    note: "Nháp — chờ booking chuyến kế tiếp",
  });

  const units = (q: number | null) => Math.max(1, Math.min(1000, Math.round((q ?? 0) / 2) || 100));
  const l1 = { ...lineFromContract(mapped[0], productName(mapped[0].productId), { id: "lsx-demo-1-l1", orderId: issued.id, lineNo: 1 }) };
  l1.units = units(mapped[0].quantity);
  l1.kg = lineKg(l1);
  const src2 = mapped[1] ?? mapped[0];
  const l2 = { ...lineFromContract(src2, productName(src2.productId), { id: "lsx-demo-2-l1", orderId: draft.id, lineNo: 1 }) };
  l2.units = Math.max(1, Math.round(units(src2.quantity) / 2));
  l2.kg = lineKg(l2);

  // NL dự kiến: dòng thực nhập đầu tiên của lần nhập còn mở, dành ≤ nửa số đã về.
  const open = new Set(importSet.receipts.filter((r) => r.status !== "cancelled").map((r) => r.id));
  const rl = importSet.receiptLines.find((x) => open.has(x.receiptId) && (x.kg ?? 0) > 0);
  const receipt = rl && importSet.receipts.find((r) => r.id === rl.receiptId);
  const materials: ProductionOrderMaterial[] =
    rl && receipt
      ? [
          {
            id: "lsx-demo-1-m1",
            orderId: issued.id,
            orderLineId: l1.id,
            receiptId: rl.receiptId,
            importLineId: rl.contractLineId,
            label: [`HĐ nhập ${receipt.contractNo}`, receipt.supplierName, formatDateVN(receipt.arrivalDate), receipt.containerNo].filter(Boolean).join(" · "),
            kg: Math.round((rl.kg ?? 0) / 2),
          },
        ]
      : [];

  return {
    orders: [issued, draft],
    lines: [l1, l2],
    materials,
    shipments: shipment ? [{ id: "lsx-demo-1-s1", orderId: issued.id, shipmentId: shipment.id, createdAt: at }] : [],
  };
}
