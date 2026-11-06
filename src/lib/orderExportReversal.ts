// ============================================================
// HỦY LỆNH XUẤT của đơn đặt (gỡ được việc làm nhầm — audit chủ dự án 2026-11-06).
// Lệnh xuất đã trừ tồn kho dự trữ (dòng `export_items`) và đẻ một phiếu bán kênh Xuất
// khẩu ở sổ Bán hàng. Hủy = đảo NGƯỢC đúng các hiệu ứng đó, KHÔNG xóa dấu vết:
//   • xóa các dòng lệnh xuất ⇒ tồn từng lô trả về đúng số kg đã trừ;
//   • xóa phiếu bán + dòng bán đẻ từ lệnh (như sổ Bán hàng xóa phiếu);
//   • xóa dấu "đã quét kiểm" (lot_dispatches doc export_item) của các dòng đó;
//   • GIỮ đầu lệnh, đổi trạng thái `cancelled` + ghi chú lý do / ai hủy / lúc nào / đã gỡ gì;
//   • trạng thái đơn tính lại theo các lệnh còn hiệu lực.
// Chặn khi phiếu bán đã bị Cân đối kỳ hút (dòng thành phẩm có `salesItemId`).
// Hàm thuần — màn gọi lo ghi sổ + toast Hoàn tác (khôi phục nguyên các mảng trước đó).
// ============================================================
import type {
  BalancingOutputItem,
  ExportItem,
  ExportOrder,
  LotDispatch,
  OrderItem,
  SalesInvoice,
  SalesItem,
  SalesOrder,
  SalesOrderStatus,
} from "@/types";

/** Nguồn kho đánh dấu dòng bán đẻ từ lệnh xuất (xem SalesOrderScreen.createExportOrder). */
export const ORDER_HANDOFF_SOURCE = "Đơn đặt";

export const isCancelledExport = (e: Pick<ExportOrder, "status">) => e.status === "cancelled";

const KG_EPSILON = 0.001;

/** Khóa so dòng: mặt hàng × quy cách × kg (làm tròn gram). */
const lineKey = (productId: string, spec: string, quantityKg: number) =>
  `${productId}|${spec}|${Math.round((quantityKg || 0) * 1000)}`;

const sameMultiset = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
};

export type LinkedInvoiceResult =
  | { kind: "direct"; invoice: SalesInvoice }
  | { kind: "legacy"; invoice: SalesInvoice }
  | { kind: "none" }
  /** Lệnh cũ mà nhiều phiếu (hoặc nhiều lệnh) giống hệt nhau ⇒ không biết phiếu nào của lệnh này. */
  | { kind: "ambiguous"; candidates: SalesInvoice[] };

/**
 * Phiếu bán đẻ từ lệnh xuất.
 *  - Lệnh lập từ bản 2026-11-06: phiếu mang ĐÚNG id của lệnh (tất định, khỏi thêm cột).
 *  - Lệnh cũ (phiếu id ngẫu nhiên): dò phiếu kênh Xuất khẩu, cùng khách, ngày giao = ngày xuất,
 *    mọi dòng nguồn "Đơn đặt" và khớp đúng bộ (mặt hàng × quy cách × kg) của lệnh. Bỏ qua phiếu
 *    đã thuộc một lệnh khác (id trùng id lệnh khác).
 *  - MƠ HỒ ⇒ KHÔNG nhận phiếu nào (gỡ nhầm phiếu của lệnh khác là mất sổ): khớp > 1 phiếu, hoặc
 *    còn một lệnh cũ khác (chưa hủy, cùng khách, cùng ngày, cùng bộ hàng) cũng khớp được phiếu đó.
 */
export function resolveLinkedSalesInvoice(
  exportOrder: ExportOrder,
  order: Pick<SalesOrder, "customerId">,
  data: Pick<ExportReversalData, "exportItems" | "exportOrders" | "salesOrders" | "salesInvoices" | "salesItems">,
): LinkedInvoiceResult {
  const direct = data.salesInvoices.find((v) => v.id === exportOrder.id);
  if (direct) return { kind: "direct", invoice: direct };
  const bagOf = (exportId: string) =>
    data.exportItems.filter((d) => d.exportId === exportId).map((d) => lineKey(d.productId, d.spec, d.quantityKg));
  const wanted = bagOf(exportOrder.id);
  if (wanted.length === 0) return { kind: "none" };
  const exportIds = new Set(data.exportOrders.map((e) => e.id));
  const candidates = data.salesInvoices.filter((v) => {
    if (exportIds.has(v.id)) return false; // phiếu của lệnh khác (id = id lệnh) hoặc của chính lệnh (đã xét ở trên)
    if (v.channel !== "Xuất khẩu" || v.customerId !== order.customerId) return false;
    if (v.deliveryDate !== exportOrder.exportDate) return false;
    const lines = data.salesItems.filter((b) => b.invoiceId === v.id);
    if (lines.length === 0 || lines.some((b) => b.sourceWarehouse !== ORDER_HANDOFF_SOURCE)) return false;
    return sameMultiset(lines.map((b) => lineKey(b.productId, b.spec, b.quantityKg)), wanted);
  });
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  const customerOf = (orderId: string) => data.salesOrders.find((d) => d.id === orderId)?.customerId;
  const hasRival = data.exportOrders.some(
    (e) =>
      e.id !== exportOrder.id &&
      !isCancelledExport(e) &&
      e.exportDate === exportOrder.exportDate &&
      customerOf(e.orderId) === order.customerId &&
      !data.salesInvoices.some((v) => v.id === e.id) &&
      sameMultiset(bagOf(e.id), wanted),
  );
  return hasRival ? { kind: "ambiguous", candidates } : { kind: "legacy", invoice: candidates[0]! };
}

/** Phiếu bán chắc chắn thuộc lệnh (undefined khi không có hoặc mơ hồ). */
export function findLinkedSalesInvoice(
  exportOrder: ExportOrder,
  order: Pick<SalesOrder, "customerId">,
  data: Pick<ExportReversalData, "exportItems" | "exportOrders" | "salesOrders" | "salesInvoices" | "salesItems">,
): SalesInvoice | undefined {
  const r = resolveLinkedSalesInvoice(exportOrder, order, data);
  return r.kind === "direct" || r.kind === "legacy" ? r.invoice : undefined;
}

/** Trạng thái đơn theo các lệnh còn hiệu lực: đủ hết ⇒ "closed", còn thiếu ⇒ `whenMissing`. */
export function orderStatusFromExports(
  orderId: string,
  orderItems: readonly OrderItem[],
  exportOrders: readonly ExportOrder[],
  exportItems: readonly ExportItem[],
  whenMissing: SalesOrderStatus = "collecting",
): SalesOrderStatus {
  const active = new Set(exportOrders.filter((e) => e.orderId === orderId && !isCancelledExport(e)).map((e) => e.id));
  const lines = orderItems.filter((x) => x.orderId === orderId);
  const exported = (productId: string, spec: string) =>
    exportItems
      .filter((d) => active.has(d.exportId) && d.productId === productId && d.spec === spec)
      .reduce((s, d) => s + (d.quantityKg || 0), 0);
  const hasMissing = lines.some((x) => x.requiredQuantityKg - exported(x.productId, x.spec) > KG_EPSILON);
  return hasMissing ? whenMissing : "closed";
}

export interface ExportReversalData {
  salesOrders: SalesOrder[];
  orderItems: OrderItem[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesInvoices: SalesInvoice[];
  salesItems: SalesItem[];
  lotDispatches: LotDispatch[];
  balancingOutputs: readonly Pick<BalancingOutputItem, "salesItemId" | "periodId">[];
  /** Sổ Cân đối đã tải xong từ máy chủ. Chưa xong ⇒ KHÔNG biết phiếu đã bị hút chưa ⇒ chặn. */
  balancingOutputsReady: boolean;
}

export interface ExportReversalPreview {
  exportOrder: ExportOrder;
  order: SalesOrder;
  items: ExportItem[];
  totalKg: number;
  lotCount: number;
  invoice: SalesInvoice | undefined;
  /** > 0 ⇒ lệnh cũ khớp mơ hồ với chừng này phiếu: KHÔNG tự gỡ, người dùng xóa tay ở Bán hàng. */
  ambiguousInvoiceCount: number;
  invoiceLines: SalesItem[];
  /** Số dòng bán đã có đơn giá (sẽ mất theo phiếu — Hoàn tác vẫn trả lại). */
  pricedLineCount: number;
  checkCount: number;
}

export type ExportReversalCheck =
  | { ok: true; preview: ExportReversalPreview }
  | { ok: false; reason: string };

/** Xem trước + kiểm điều kiện hủy một lệnh xuất. */
export function checkExportReversal(exportOrderId: string, data: ExportReversalData): ExportReversalCheck {
  const exportOrder = data.exportOrders.find((e) => e.id === exportOrderId);
  if (!exportOrder) return { ok: false, reason: "Không tìm thấy lệnh xuất này (có thể đã bị xóa ở máy khác)." };
  if (isCancelledExport(exportOrder)) return { ok: false, reason: "Lệnh xuất này đã hủy rồi." };
  const order = data.salesOrders.find((d) => d.id === exportOrder.orderId);
  if (!order) return { ok: false, reason: "Không tìm thấy đơn của lệnh xuất này." };
  if (!data.balancingOutputsReady) {
    return {
      ok: false,
      reason: "Đang tải sổ Cân đối kỳ — chưa kiểm được phiếu bán của lệnh đã bị hút vào kỳ nào chưa. Đợi trang tải xong (hoặc có mạng lại) rồi thử lại.",
    };
  }
  const items = data.exportItems.filter((d) => d.exportId === exportOrder.id);
  const link = resolveLinkedSalesInvoice(exportOrder, order, data);
  const invoice = link.kind === "direct" || link.kind === "legacy" ? link.invoice : undefined;
  const invoiceLines = invoice ? data.salesItems.filter((b) => b.invoiceId === invoice.id) : [];
  const lineIds = new Set(invoiceLines.map((b) => b.id));
  const pulledBy = data.balancingOutputs.filter((o) => o.salesItemId && lineIds.has(o.salesItemId));
  if (pulledBy.length > 0) {
    return {
      ok: false,
      reason:
        "Phiếu bán của lệnh này đã được Cân đối kỳ hút vào khối thành phẩm. Gỡ các dòng đó ở màn Cân đối trước, rồi mới hủy lệnh xuất được.",
    };
  }
  const itemIds = new Set(items.map((d) => d.id));
  return {
    ok: true,
    preview: {
      exportOrder,
      order,
      items,
      totalKg: items.reduce((s, d) => s + (d.quantityKg || 0), 0),
      lotCount: new Set(items.map((d) => d.wipId)).size,
      invoice,
      ambiguousInvoiceCount: link.kind === "ambiguous" ? link.candidates.length : 0,
      invoiceLines,
      pricedLineCount: invoiceLines.filter((b) => b.unitPrice != null).length,
      checkCount: data.lotDispatches.filter((x) => x.docKind === "export_item" && itemIds.has(x.docId)).length,
    },
  };
}

export interface ExportReversalResult {
  salesOrders: SalesOrder[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesInvoices: SalesInvoice[];
  salesItems: SalesItem[];
  lotDispatches: LotDispatch[];
  preview: ExportReversalPreview;
}

/**
 * Hủy lệnh xuất: trả các mảng MỚI (không sửa mảng vào). Ném lỗi nếu bị chặn — màn phải
 * gọi `checkExportReversal` trước để báo lý do.
 */
export function reverseExportOrder(
  exportOrderId: string,
  data: ExportReversalData,
  meta: { reason: string; cancelledBy: string; cancelledAt: string },
): ExportReversalResult {
  const check = checkExportReversal(exportOrderId, data);
  if (!check.ok) throw new Error(check.reason);
  const { preview } = check;
  const itemIds = new Set(preview.items.map((d) => d.id));
  const invoiceId = preview.invoice?.id;
  const by = meta.cancelledBy ? ` · ${meta.cancelledBy}` : "";
  const removed =
    `đã trả ${preview.totalKg.toLocaleString("vi-VN")} kg về ${preview.lotCount} lô` +
    (invoiceId
      ? `, gỡ phiếu bán ${preview.invoiceLines.length} dòng`
      : preview.ambiguousInvoiceCount
        ? `, phiếu bán CHƯA gỡ: ${preview.ambiguousInvoiceCount} phiếu giống nhau, xóa tay đúng một phiếu ở Bán hàng`
        : ", không thấy phiếu bán đi kèm");
  const cancelNote = `Đã hủy ${meta.cancelledAt.slice(0, 10)}${by}: ${meta.reason.trim()} (${removed})`;
  const exportOrders = data.exportOrders.map((e) =>
    e.id === preview.exportOrder.id
      ? { ...e, status: "cancelled" as const, note: e.note ? `${e.note} · ${cancelNote}` : cancelNote }
      : e,
  );
  const exportItems = data.exportItems.filter((d) => !itemIds.has(d.id));
  const nextStatus = orderStatusFromExports(preview.order.id, data.orderItems, exportOrders, exportItems);
  return {
    salesOrders: data.salesOrders.map((d) => (d.id === preview.order.id ? { ...d, status: nextStatus } : d)),
    exportOrders,
    exportItems,
    salesInvoices: invoiceId ? data.salesInvoices.filter((v) => v.id !== invoiceId) : data.salesInvoices,
    salesItems: invoiceId ? data.salesItems.filter((b) => b.invoiceId !== invoiceId) : data.salesItems,
    lotDispatches: data.lotDispatches.filter((x) => !(x.docKind === "export_item" && itemIds.has(x.docId))),
    preview,
  };
}

export type OrderDeleteCheck =
  | { ok: true; cancelledExportIds: string[] }
  | { ok: false; reason: string };

/**
 * Xóa đơn chỉ khi KHÔNG còn lệnh xuất hiệu lực — còn lệnh thì tồn kho + sổ Bán hàng đang
 * mang hiệu ứng của đơn, xóa đơn sẽ để lại lệnh / phiếu mồ côi. Đầu lệnh đã hủy đi theo đơn.
 */
export function checkOrderDelete(orderId: string, exportOrders: readonly ExportOrder[]): OrderDeleteCheck {
  const own = exportOrders.filter((e) => e.orderId === orderId);
  const active = own.filter((e) => !isCancelledExport(e));
  if (active.length > 0) {
    return {
      ok: false,
      reason: `Đơn đã có ${active.length} lệnh xuất đang hiệu lực (đã trừ tồn kho và ghi sổ Bán hàng). Mở đơn, bấm Hủy lệnh xuất ở từng lệnh trước, rồi mới xóa đơn được.`,
    };
  }
  return { ok: true, cancelledExportIds: own.map((e) => e.id) };
}

/** Mở lại đơn đã "Xác nhận đủ" về Đang gom. Đơn đã xuất (closed) không mở lại kiểu này. */
export function canReopenOrder(order: Pick<SalesOrder, "status">): boolean {
  return order.status === "complete";
}
