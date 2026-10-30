// ============================================================
// Tên file: src/lib/productionOrder.ts
// Tên tiếng Việt: Luật Lệnh sản xuất — kg từ thùng, còn chưa ra lệnh, NL nhập khẩu dự kiến, HSD, sửa / hủy
// Description: Pure rules for production orders (ba-spec docs/app-map/48-production-order.ba-spec.md R1–R12):
//              line kg from cartons, create gate (effective revision, mapped line), validation (unique order
//              number, dates), ordered vs contract kg with tolerance, import material reservation, expiry date,
//              issue / revise / cancel, stale-revision flag, MSL copy to shipments, next-number suggestion.
//              No I/O — screens call these and save through lib/catalogRepo.ts.
// ============================================================
import type {
  ExportContract,
  ExportContractLine,
  ExportShipment,
  ImportReceipt,
  ImportReceiptLine,
  ProductionOrder,
  ProductionOrderLine,
  ProductionOrderMaterial,
  ProductionOrderRequirements,
  ProductionOrderShipment,
} from "@/types";
import { effectiveRevision, lineKg as contractLineKg, type ExportData } from "./exportPlanning";
import { num } from "./format";

export const ORDER_STATUS_LABELS: Record<ProductionOrder["status"], string> = {
  draft: "Nháp",
  issued: "Đã phát hành",
  cancelled: "Đã hủy",
};
/** Cờ R12 — tên đúng như trên sản phẩm. */
export const STALE_REVISION_LABEL = "Theo bản HĐ trước";

export const DEFAULT_SHELF_LIFE_MONTHS = 24;

export const emptyRequirements = (): ProductionOrderRequirements => ({
  packagingReady: "",
  cartonLayers: "",
  strapNote: "",
  peBagNote: "",
  cartonMarking: "",
  bagMarking: "",
  nafiTests: [],
  nafiNote: "",
  processNote: "",
});

const round2 = (x: number) => Math.round(x * 100) / 100;
const normNo = (x: string) => x.trim().toLowerCase();
const isLive = (o: Pick<ProductionOrder, "status">) => o.status !== "cancelled";

/* ---------- R2: kg của dòng ---------- */

/** Số thùng: dòng đếm kiện ⇒ kiện × thùng/kiện. */
export function lineCartons(l: Pick<ProductionOrderLine, "units" | "unitKind" | "cartonsPerUnit">): number | null {
  if (l.units == null) return null;
  return l.unitKind === "bundle" ? l.units * Math.max(1, l.cartonsPerUnit || 1) : l.units;
}

/** kg tự tính = thùng × kg tịnh/thùng; thiếu kg tịnh/thùng ⇒ null (gõ kg tay). */
export function lineKg(l: Pick<ProductionOrderLine, "units" | "unitKind" | "cartonsPerUnit" | "netKgPerCarton">): number | null {
  const c = lineCartons(l);
  return c == null || l.netKgPerCarton == null ? null : round2(c * l.netKgPerCarton);
}

/** kg dòng dùng để tính: ô kg đã lưu, trống thì tự tính. */
export const orderLineKg = (l: ProductionOrderLine): number => l.kg ?? lineKg(l) ?? 0;

/** Quy cách dòng lệnh từ dòng HĐ (R17): Size · Dài · Số miếng · Tỉ lệ · Packing — như ô Quy cách của LSX giấy. */
export function contractLineSpec(cl: Pick<ExportContractLine, "size" | "packing" | "pieceLength" | "partRatio" | "piecesPerKg">): string {
  const t = (v: string | undefined) => (v ?? "").trim();
  const pieces = t(cl.piecesPerKg);
  return [
    t(cl.size) && `Size ${t(cl.size)}`,
    t(cl.pieceLength) && `Dài ${t(cl.pieceLength)}`,
    // Đã ghi đơn vị (VD "590 – 770 pcs/kg") thì giữ nguyên, chỉ gõ số thì thêm "miếng/kg".
    pieces && (/\/\s*kg/i.test(pieces) ? pieces : `${pieces} miếng/kg`),
    t(cl.partRatio) && `Tỉ lệ ${t(cl.partRatio)}`,
    t(cl.packing),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Dòng lệnh mới chép từ dòng HĐ xuất (tên tiếng Việt từ mặt hàng danh mục). */
export function lineFromContract(
  cl: ExportContractLine,
  productName: string,
  ids: { id: string; orderId: string; lineNo: number },
): ProductionOrderLine {
  const spec = contractLineSpec(cl);
  return {
    ...ids,
    contractLineId: cl.id,
    productId: cl.productId ?? "",
    productName,
    description: cl.description,
    spec,
    unitKind: cl.unitKind,
    cartonsPerUnit: cl.cartonsPerUnit,
    netKgPerCarton: cl.netKgPerCarton,
    units: null,
    kg: null,
    note: (cl.note ?? "").trim(),
  };
}

/* ---------- R1: lập được lệnh không ---------- */

export type CreateBlock = "contract-cancelled" | "contract-closed" | "no-effective-revision" | "line-unmapped";

export function canCreateOrder(
  d: Pick<ExportData, "revisions" | "approvals">,
  contract: Pick<ExportContract, "id" | "status">,
  contractLineIds: readonly string[] = [],
): { ok: true } | { ok: false; reason: CreateBlock; lineIds?: string[] } {
  if (contract.status === "cancelled") return { ok: false, reason: "contract-cancelled" };
  if (contract.status === "closed") return { ok: false, reason: "contract-closed" };
  const rev = effectiveRevision(d, contract.id);
  if (!rev) return { ok: false, reason: "no-effective-revision" };
  const unmapped = contractLineIds.filter((id) => !rev.lines.find((l) => l.id === id)?.productId);
  return unmapped.length ? { ok: false, reason: "line-unmapped", lineIds: unmapped } : { ok: true };
}

/* ---------- R3, R8: kiểm lệnh ---------- */

export interface OrderIssue {
  field: string;
  message: string;
}

export function validateOrder(
  order: ProductionOrder,
  lines: readonly ProductionOrderLine[],
  others: readonly ProductionOrder[],
): { errors: OrderIssue[]; warnings: OrderIssue[] } {
  const errors: OrderIssue[] = [];
  const warnings: OrderIssue[] = [];
  const rest = others.filter((o) => o.id !== order.id);
  if (!order.orderNo.trim()) errors.push({ field: "number", message: "Ghi số lệnh" });
  else if (rest.some((o) => normNo(o.orderNo) === normNo(order.orderNo)))
    errors.push({ field: "number", message: `Số lệnh ${order.orderNo.trim()} đã có` });
  if (!order.contractId) errors.push({ field: "contract", message: "Chọn hợp đồng xuất" });
  if (!order.productionDates.length) errors.push({ field: "productionDates", message: "Ghi ít nhất một ngày sản xuất" });
  const lastProduction = [...order.productionDates].sort().at(-1) ?? "";
  if (!order.deliveryDate) errors.push({ field: "deliveryDate", message: "Ghi ngày giao hàng" });
  else if (lastProduction && order.deliveryDate < lastProduction)
    errors.push({ field: "deliveryDate", message: "Ngày giao phải từ ngày sản xuất cuối trở đi" });
  if (!lines.length) errors.push({ field: "lines", message: "Lệnh cần ít nhất một dòng hàng" });
  lines.forEach((l, i) => {
    if (!l.contractLineId) errors.push({ field: `lines.${i}.contractLine`, message: `Dòng ${i + 1}: chọn dòng hàng hợp đồng` });
    if (l.units == null || l.units <= 0) errors.push({ field: `lines.${i}.units`, message: `Dòng ${i + 1}: ghi số ${l.unitKind === "bundle" ? "kiện" : "thùng"}` });
    if (orderLineKg(l) <= 0) errors.push({ field: `lines.${i}.kg`, message: `Dòng ${i + 1}: ghi kg (hợp đồng chưa có kg tịnh mỗi thùng)` });
  });
  const lot = order.lotCode.trim();
  if (lot && rest.some((o) => o.status === "issued" && o.lotCode.trim() === lot))
    warnings.push({ field: "lotCode", message: `MSL ${lot} đã có ở lệnh khác đang phát hành` });
  return { errors, warnings };
}

/* ---------- R4: còn chưa ra lệnh của dòng HĐ ---------- */

export interface ContractLineCoverage {
  contractKg: number;
  orderedKg: number;
  remainingKg: number;
  /** Đã ra lệnh vượt kg HĐ × (1 + dung sai). */
  overTolerance: boolean;
}

export function contractLineCoverage(
  cl: ExportContractLine,
  tolerancePct: number | null,
  orders: readonly ProductionOrder[],
  lines: readonly ProductionOrderLine[],
): ContractLineCoverage {
  const live = new Set(orders.filter(isLive).map((o) => o.id));
  const orderedKg = round2(lines.filter((l) => l.contractLineId === cl.id && live.has(l.orderId)).reduce((s, l) => s + orderLineKg(l), 0));
  const contractKg = contractLineKg(cl);
  return {
    contractKg,
    orderedKg,
    remainingKg: round2(contractKg - orderedKg),
    overTolerance: orderedKg > round2(contractKg * (1 + (tolerancePct ?? 0) / 100)),
  };
}

/* ---------- R5: NL nhập khẩu dự kiến ---------- */

/** Dòng thực nhập chọn được: lần nhập chưa hủy, đã có thực nhập > 0. */
export function materialOptions(receipts: readonly ImportReceipt[], receiptLines: readonly ImportReceiptLine[]): ImportReceiptLine[] {
  const open = new Set(receipts.filter((r) => r.status !== "cancelled").map((r) => r.id));
  return receiptLines.filter((l) => open.has(l.receiptId) && (l.kg ?? 0) > 0);
}

export interface ReservationState {
  receivedKg: number;
  reservedKg: number;
  freeKg: number;
  overReceived: boolean;
}

/** Đã dành của một dòng thực nhập (lần nhập + dòng HĐ nhập) = Σ kg dự kiến ở lệnh chưa hủy. */
export function reservationOf(
  receiptLine: Pick<ImportReceiptLine, "receiptId" | "contractLineId" | "kg">,
  materials: readonly ProductionOrderMaterial[],
  orders: readonly ProductionOrder[],
): ReservationState {
  const live = new Set(orders.filter(isLive).map((o) => o.id));
  const reservedKg = round2(
    materials
      .filter((m) => m.receiptId === receiptLine.receiptId && m.importLineId === receiptLine.contractLineId && live.has(m.orderId))
      .reduce((s, m) => s + (m.kg ?? 0), 0),
  );
  const receivedKg = receiptLine.kg ?? 0;
  return { receivedKg, reservedKg, freeKg: round2(receivedKg - reservedKg), overReceived: reservedKg > receivedKg };
}

/* ---------- R7: hạn sử dụng ---------- */

/** HSD = tháng của ngày SX sớm nhất + N tháng, về ngày 01. Chưa có ngày SX ⇒ "". */
export function expiryDate(productionDates: readonly string[], months: number): string {
  const first = [...productionDates].filter(Boolean).sort()[0];
  if (!first) return "";
  const [y, m] = first.split("-").map(Number);
  const total = y * 12 + (m - 1) + Math.max(0, Math.round(months));
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/* ---------- R6: chuyến có lệnh phát hành ---------- */

/** Chuyến có ≥ 1 lệnh "Đã phát hành" gắn kèm — bước 2 của chuyến xong (ráp vào exportPlanning ở pha P4). */
export function issuedShipmentIds(orders: readonly ProductionOrder[], links: readonly ProductionOrderShipment[]): Set<string> {
  const issued = new Set(orders.filter((o) => o.status === "issued").map((o) => o.id));
  return new Set(links.filter((l) => issued.has(l.orderId)).map((l) => l.shipmentId));
}

/** MSL của chuyến khác MSL của lệnh (chuyến đã có MSL riêng). */
export const lotMismatch = (shipment: Pick<ExportShipment, "lotCode">, order: Pick<ProductionOrder, "lotCode">): boolean =>
  Boolean(shipment.lotCode.trim() && order.lotCode.trim() && shipment.lotCode.trim() !== order.lotCode.trim());

/** Phát hành / gắn chuyến: chuyến chưa có MSL nhận MSL của lệnh; chuyến đã có giữ nguyên. Trả các chuyến ĐỔI. */
export function shipmentsWithLot(order: Pick<ProductionOrder, "lotCode">, shipments: readonly ExportShipment[]): ExportShipment[] {
  const lot = order.lotCode.trim();
  return lot ? shipments.filter((s) => !s.lotCode.trim()).map((s) => ({ ...s, lotCode: lot })) : [];
}

/* ---------- LS3, LS5: phát hành · sửa · hủy ---------- */

export function issueOrder(order: ProductionOrder, by: string, at: string): ProductionOrder {
  return { ...order, status: "issued", issuedAt: order.issuedAt || at, issuedBy: order.issuedBy || by };
}

export type ChangeResult = { ok: true; order: ProductionOrder; changes: string[] } | { ok: false; field: string; message: string };

const fmtKg = (x: number | null) => (x == null ? "—" : num(x));

/** Các thay đổi đọc được (nhật ký + lý do sửa): số thùng / kg từng dòng, ngày, MSL. */
export function describeChanges(
  prev: { order: ProductionOrder; lines: readonly ProductionOrderLine[] },
  next: { order: ProductionOrder; lines: readonly ProductionOrderLine[] },
): string[] {
  const out: string[] = [];
  const name = (l: ProductionOrderLine) => l.productName || l.description || `Dòng ${l.lineNo}`;
  for (const n of next.lines) {
    const p = prev.lines.find((x) => x.id === n.id);
    if (!p) out.push(`Thêm dòng ${name(n)}: ${fmtKg(n.units)} ${n.unitKind === "bundle" ? "kiện" : "thùng"}`);
    else if (p.units !== n.units) out.push(`${name(n)}: ${fmtKg(p.units)} → ${fmtKg(n.units)} ${n.unitKind === "bundle" ? "kiện" : "thùng"}`);
    else if (orderLineKg(p) !== orderLineKg(n)) out.push(`${name(n)}: ${fmtKg(orderLineKg(p))} → ${fmtKg(orderLineKg(n))} kg`);
  }
  for (const p of prev.lines) if (!next.lines.some((x) => x.id === p.id)) out.push(`Bỏ dòng ${name(p)}`);
  const a = prev.order;
  const b = next.order;
  if (a.lotCode !== b.lotCode) out.push(`MSL: ${a.lotCode || "—"} → ${b.lotCode || "—"}`);
  if (a.productionDates.join(",") !== b.productionDates.join(",")) out.push(`Ngày SX: ${a.productionDates.join(", ")} → ${b.productionDates.join(", ")}`);
  if (a.deliveryDate !== b.deliveryDate) out.push(`Ngày giao: ${a.deliveryDate || "—"} → ${b.deliveryDate || "—"}`);
  return out;
}

/** Sửa lệnh đã phát hành: bắt lý do, tăng lần sửa (R10). Lệnh nháp sửa thẳng, không tăng. */
export function reviseOrder(
  prev: { order: ProductionOrder; lines: readonly ProductionOrderLine[] },
  next: { order: ProductionOrder; lines: readonly ProductionOrderLine[] },
  reason: string,
): ChangeResult {
  const changes = describeChanges(prev, next);
  if (prev.order.status !== "issued") return { ok: true, order: next.order, changes };
  if (!reason.trim()) return { ok: false, field: "revisionReason", message: "Ghi lý do sửa lệnh đã phát hành" };
  return { ok: true, order: { ...next.order, revisionNo: prev.order.revisionNo + 1, revisionReason: reason.trim() }, changes };
}

/** Hủy: bắt lý do (R11). Chuyến gắn và kg dành tự nhả vì mọi phép tính bỏ lệnh đã hủy. */
export function cancelOrder(order: ProductionOrder, reason: string): ChangeResult {
  if (!reason.trim()) return { ok: false, field: "cancelReason", message: "Ghi lý do hủy lệnh" };
  return { ok: true, order: { ...order, status: "cancelled", cancelReason: reason.trim() }, changes: [`Hủy lệnh: ${reason.trim()}`] };
}

/* ---------- R12: theo bản HĐ trước ---------- */

/** Lệnh đã phát hành mà HĐ đã có bản hiệu lực khác bản lệnh đang theo, chưa ai xác nhận giữ nguyên. */
export function staleRevision(order: ProductionOrder, d: Pick<ExportData, "revisions" | "approvals">): boolean {
  if (order.status !== "issued") return false;
  const eff = effectiveRevision(d, order.contractId);
  if (!eff || eff.id === order.contractRevisionId) return false;
  return order.staleAckRevisionId !== eff.id;
}

/** "Giữ nguyên theo bản cũ" — bắt lý do; cờ hết cho tới khi HĐ có bản mới nữa. */
export function keepOldRevision(order: ProductionOrder, d: Pick<ExportData, "revisions" | "approvals">, reason: string): ChangeResult {
  if (!reason.trim()) return { ok: false, field: "staleAckReason", message: "Ghi lý do giữ nguyên lệnh theo bản cũ" };
  const eff = effectiveRevision(d, order.contractId);
  return { ok: true, order: { ...order, staleAckRevisionId: eff?.id ?? "", staleAckReason: reason.trim() }, changes: [`Giữ nguyên theo bản cũ: ${reason.trim()}`] };
}

/* ---------- A4, Q10: gợi ý ---------- */

/** Số lệnh kế tiếp dạng "<thứ tự>.<tháng>" như LSX 19.10 (lệnh thứ 19 của tháng 10), theo tháng của `date`. */
export function nextOrderNumber(orders: readonly ProductionOrder[], date: string): string {
  const [y, m] = date.split("-");
  if (!y || !m) return "";
  const seqs = orders
    .filter((o) => o.orderDate.slice(0, 7) === `${y}-${m}`)
    .map((o) => /^\s*(\d+)\.(\d{1,2})\s*$/.exec(o.orderNo))
    .filter((x): x is RegExpExecArray => x != null && Number(x[2]) === Number(m))
    .map((x) => Number(x[1]));
  return `${(seqs.length ? Math.max(...seqs) : 0) + 1}.${m}`;
}

/** Lệnh gần nhất (chưa hủy) cùng khách có dòng cùng mặt hàng — để chép yêu cầu bao bì / Nafi / lưu ý. */
export function previousOrderFor(
  orders: readonly ProductionOrder[],
  lines: readonly ProductionOrderLine[],
  customerName: string,
  productId: string,
  excludeId = "",
): ProductionOrder | null {
  const withProduct = new Set(lines.filter((l) => l.productId === productId).map((l) => l.orderId));
  const hits = orders
    .filter((o) => isLive(o) && o.id !== excludeId && o.customerName === customerName && withProduct.has(o.id))
    .sort((a, b) => (a.orderDate + a.createdAt).localeCompare(b.orderDate + b.createdAt));
  return hits.at(-1) ?? null;
}

/* ---------- Gom cho màn (design-spec 49) ---------- */

/** Tháng của lệnh = tháng của ngày SX sớm nhất; chưa có ngày SX thì tháng của ngày lệnh. */
export function orderMonth(o: Pick<ProductionOrder, "productionDates" | "orderDate">): string {
  const first = [...o.productionDates].filter(Boolean).sort()[0];
  return (first || o.orderDate).slice(0, 7);
}

export const linesOfOrder = (lines: readonly ProductionOrderLine[], orderId: string): ProductionOrderLine[] =>
  lines.filter((l) => l.orderId === orderId).sort((a, b) => a.lineNo - b.lineNo);

/** Tổng thùng (sau quy đổi kiện) và kg của lệnh. */
export function orderTotals(lines: readonly ProductionOrderLine[]): { cartons: number; kg: number } {
  return lines.reduce((t, l) => ({ cartons: t.cartons + (lineCartons(l) ?? 0), kg: round2(t.kg + orderLineKg(l)) }), { cartons: 0, kg: 0 });
}

/** Người chỉ có quyền Xem chỉ thấy lệnh đã từng phát hành (như RLS 0088 — chạy không nối máy chủ vẫn đúng). */
export const visibleOrders = (orders: readonly ProductionOrder[], canWrite: boolean): ProductionOrder[] =>
  canWrite ? [...orders] : orders.filter((o) => Boolean(o.issuedAt));
