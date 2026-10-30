// ============================================================
// Tên file: src/lib/productionOrderReports.ts
// Tên tiếng Việt: Số báo cáo Lệnh sản xuất theo kỳ — lệnh, thùng, kg, khách, mặt hàng, NL nhập khẩu đã dành
// Description: Pure figures for the Production order report tab (ba-spec 50 RP2, R4–R5): orders of a
//              period by first production date (orderMonth), cancelled only counted, per month / customer /
//              product, imported material reserved per receipt line, orders needing attention, Excel rows.
// ============================================================
import type { ImportReceiptLine, ProductionOrder, ProductionOrderLine, ProductionOrderMaterial, ProductionOrderShipment } from "@/types";
import type { ExportData } from "./exportPlanning";
import type { ReportPeriod } from "./exportReports";
import { lineCartons, linesOfOrder, orderLineKg, orderMonth, staleRevision } from "./productionOrder";

const round2 = (x: number) => Math.round(x * 100) / 100;

export interface OrderFigures {
  orders: number;
  cartons: number;
  kg: number;
}
export interface OrderTotals extends OrderFigures {
  issued: number;
  drafts: number;
  cancelled: number;
  revised: number;
  reservedKg: number;
}
export interface OrderMonthRow extends OrderFigures {
  month: string;
}
export interface OrderCustomerRow extends OrderFigures {
  customerName: string;
  contracts: number;
}
export interface OrderProductRow extends OrderFigures {
  key: string;
  name: string;
}
export interface OrderMaterialRow {
  key: string;
  label: string;
  /** Dành cho lệnh chưa hủy của kỳ. */
  reservedKg: number;
  /** Dành cho mọi lệnh chưa hủy (mọi kỳ) — để so với thực nhập (48 R5). */
  reservedAllKg: number;
  receivedKg: number;
  overKg: number;
}
export type OrderAttentionKind = "draft-overdue" | "stale-revision" | "unlinked";
export interface OrderAttentionRow {
  orderId: string;
  orderNo: string;
  customerName: string;
  kind: OrderAttentionKind;
  firstProductionDate: string;
}

export interface OrderReport {
  totals: OrderTotals;
  byMonth: OrderMonthRow[];
  byCustomer: OrderCustomerRow[];
  byProduct: OrderProductRow[];
  materials: OrderMaterialRow[];
  attention: OrderAttentionRow[];
}

export const ORDER_ATTENTION_LABELS: Record<OrderAttentionKind, string> = {
  "draft-overdue": "Nháp quá ngày SX",
  "stale-revision": "Theo bản HĐ trước",
  unlinked: "Chưa gắn chuyến",
};

export interface OrderReportInput {
  /** Lệnh người xem thấy (đã qua `visibleOrders`). */
  orders: readonly ProductionOrder[];
  lines: readonly ProductionOrderLine[];
  materials: readonly ProductionOrderMaterial[];
  links: readonly ProductionOrderShipment[];
  receiptLines: readonly ImportReceiptLine[];
  exportData: Pick<ExportData, "revisions" | "approvals">;
}

const empty = (): OrderFigures => ({ orders: 0, cartons: 0, kg: 0 });
const firstDate = (o: ProductionOrder) => [...o.productionDates].filter(Boolean).sort()[0] ?? "";

export function buildOrderReport(d: OrderReportInput, period: ReportPeriod, opts: { customerName?: string; today: string }): OrderReport {
  const months = new Set(period.months);
  const inScope = d.orders.filter((o) => months.has(orderMonth(o)) && (!opts.customerName || o.customerName === opts.customerName));
  const live = inScope.filter((o) => o.status !== "cancelled");
  const liveIds = new Set(live.map((o) => o.id));
  const allLiveIds = new Set(d.orders.filter((o) => o.status !== "cancelled").map((o) => o.id));
  const linked = new Set(d.links.map((l) => l.orderId));

  const totals: OrderTotals = { ...empty(), issued: 0, drafts: 0, cancelled: inScope.length - live.length, revised: 0, reservedKg: 0 };
  const byMonth = new Map<string, OrderMonthRow>();
  const byCustomer = new Map<string, OrderCustomerRow & { contractIds: Set<string> }>();
  const byProduct = new Map<string, OrderProductRow & { orderIds: Set<string> }>();
  const attention: OrderAttentionRow[] = [];

  for (const o of live) {
    const ls = linesOfOrder(d.lines, o.id);
    const cartons = ls.reduce((s, l) => s + (lineCartons(l) ?? 0), 0);
    const kg = round2(ls.reduce((s, l) => s + orderLineKg(l), 0));
    const add = (f: OrderFigures) => {
      f.orders += 1;
      f.cartons += cartons;
      f.kg = round2(f.kg + kg);
    };
    add(totals);
    if (o.status === "issued") totals.issued += 1;
    else totals.drafts += 1;
    if (o.revisionNo > 0) totals.revised += 1;

    const m = orderMonth(o);
    const mr = byMonth.get(m) ?? { month: m, ...empty() };
    add(mr);
    byMonth.set(m, mr);

    const cn = o.customerName || "(chưa rõ)";
    const cr = byCustomer.get(cn) ?? { customerName: cn, contracts: 0, contractIds: new Set<string>(), ...empty() };
    add(cr);
    cr.contractIds.add(o.contractId);
    byCustomer.set(cn, cr);

    for (const l of ls) {
      const key = l.productId || `name:${l.productName || l.description}`;
      const pr = byProduct.get(key) ?? { key, name: l.productName || l.description || "(chưa rõ)", orderIds: new Set<string>(), ...empty() };
      if (!pr.orderIds.has(o.id)) {
        pr.orderIds.add(o.id);
        pr.orders += 1;
      }
      pr.cartons += lineCartons(l) ?? 0;
      pr.kg = round2(pr.kg + orderLineKg(l));
      byProduct.set(key, pr);
    }

    const first = firstDate(o);
    if (o.status === "draft" && first && first <= opts.today) attention.push({ orderId: o.id, orderNo: o.orderNo, customerName: cn, kind: "draft-overdue", firstProductionDate: first });
    if (staleRevision(o, d.exportData)) attention.push({ orderId: o.id, orderNo: o.orderNo, customerName: cn, kind: "stale-revision", firstProductionDate: first });
    if (o.status === "issued" && !linked.has(o.id)) attention.push({ orderId: o.id, orderNo: o.orderNo, customerName: cn, kind: "unlinked", firstProductionDate: first });
  }

  // NL nhập khẩu đã dành (R5): theo dòng thực nhập (lần nhập + dòng HĐ nhập).
  const mats = new Map<string, OrderMaterialRow>();
  for (const m of d.materials) {
    if (!allLiveIds.has(m.orderId)) continue;
    const key = `${m.receiptId}|${m.importLineId}`;
    const row = mats.get(key) ?? { key, label: m.label || "Lần nhập", reservedKg: 0, reservedAllKg: 0, receivedKg: 0, overKg: 0 };
    row.reservedAllKg = round2(row.reservedAllKg + (m.kg ?? 0));
    if (liveIds.has(m.orderId)) row.reservedKg = round2(row.reservedKg + (m.kg ?? 0));
    mats.set(key, row);
  }
  const materials = [...mats.values()]
    .filter((r) => r.reservedKg > 0)
    .map((r) => {
      const [receiptId, importLineId] = r.key.split("|");
      const receivedKg = d.receiptLines.find((x) => x.receiptId === receiptId && x.contractLineId === importLineId)?.kg ?? 0;
      return { ...r, receivedKg, overKg: round2(Math.max(0, r.reservedAllKg - receivedKg)) };
    })
    .sort((a, b) => b.reservedKg - a.reservedKg);
  totals.reservedKg = round2(materials.reduce((s, r) => s + r.reservedKg, 0));

  const KIND_ORDER: OrderAttentionKind[] = ["draft-overdue", "stale-revision", "unlinked"];
  return {
    totals,
    byMonth: period.months.filter((m) => byMonth.has(m)).map((m) => byMonth.get(m)!),
    byCustomer: [...byCustomer.values()]
      .map(({ contractIds, ...r }) => ({ ...r, contracts: contractIds.size }))
      .sort((a, b) => b.kg - a.kg || a.customerName.localeCompare(b.customerName, "vi")),
    byProduct: [...byProduct.values()].map(({ orderIds: _ids, ...r }) => r).sort((a, b) => b.kg - a.kg),
    materials,
    attention: attention.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.firstProductionDate.localeCompare(b.firstProductionDate)),
  };
}

/* ---------- Excel ---------- */

export type OrderReportCell = string | number | null;

export function buildOrderReportExcel(r: OrderReport, opts: { periodLabel: string; customerName?: string }): OrderReportCell[][] {
  const t = r.totals;
  return [
    [`BÁO CÁO LỆNH SẢN XUẤT — ${opts.periodLabel}${opts.customerName ? ` — ${opts.customerName}` : ""}`],
    [],
    ["Tổng kỳ", "Lệnh", "Đã phát hành", "Nháp", "Đã hủy", "Đã sửa", "Thùng", "Kg", "NL nhập khẩu đã dành (kg)"],
    ["", t.orders, t.issued, t.drafts, t.cancelled, t.revised, t.cartons, t.kg, t.reservedKg],
    [],
    ["Theo tháng", "Lệnh", "Thùng", "Kg"],
    ...r.byMonth.map((m) => [m.month, m.orders, m.cartons, m.kg]),
    [],
    ["Theo khách", "Lệnh", "HĐ", "Thùng", "Kg"],
    ...r.byCustomer.map((c) => [c.customerName, c.orders, c.contracts, c.cartons, c.kg]),
    [],
    ["Theo mặt hàng", "Lệnh", "Thùng", "Kg"],
    ...r.byProduct.map((p) => [p.name, p.orders, p.cartons, p.kg]),
    [],
    ["NL nhập khẩu đã dành", "Dành trong kỳ (kg)", "Tổng đã dành (kg)", "Thực nhập (kg)", "Vượt (kg)"],
    ...r.materials.map((m) => [m.label, m.reservedKg, m.reservedAllKg, m.receivedKg, m.overKg]),
    [],
    ["Lệnh cần chú ý", "Khách", "Ngày SX đầu", "Vấn đề"],
    ...r.attention.map((a) => [a.orderNo, a.customerName, a.firstProductionDate, ORDER_ATTENTION_LABELS[a.kind]]),
  ];
}
