// ============================================================
// Tên file: src/lib/dashboardAttention.ts
// Tên tiếng Việt: Tổng quan — khối Phòng Kế hoạch + việc cần đốc của module mới
// Description: Pure aggregations for the dashboard's planning block (import → production order →
//              export) and the extra "to follow up" rows from those modules and supplier invoices.
//              Re-reads each module's own report function, never re-implements its rules.
// ============================================================
/**
 * Oracle: docs/app-map/55-dashboard-modules.ba-spec.md. Số + việc lấy từ CHÍNH hàm báo cáo của
 * từng module (R1): `buildImportReport` · `buildOrderReport` · `buildExportReport` · `tripInvoiceInfo`.
 * Kiểu riêng, KHÔNG thêm vào `FlowWarningKind` — thêm vào đó thì Việc của tôi đổi số (R8).
 */
import type { Customer, ImportShipment, MaterialImportItem, SupplierInvoice, SupplierInvoiceLine, Workshop } from "@/types";
import type { ExportData } from "@/lib/exportPlanning";
import { deviationText, monthLabel } from "@/lib/exportPlanning";
import { ATTENTION_LABELS, attentionDetail, buildExportReport, type AttentionKind, type ExportReport, type ReportPeriod } from "@/lib/exportReports";
import type { ImportData } from "@/lib/importPlanning";
import { IMPORT_DOCUMENT_KINDS } from "@/lib/importPlanning";
import { IMPORT_ATTENTION_LABELS, buildImportReport, type ImportAttentionKind, type ImportReport } from "@/lib/importReports";
import { ORDER_ATTENTION_LABELS, buildOrderReport, type OrderAttentionKind, type OrderReport, type OrderReportInput } from "@/lib/productionOrderReports";
import { indexLinesByTripLine, tripInvoiceInfo } from "@/lib/supplierInvoice";
import { formatDateVN, formatMoney, num } from "@/lib/format";

/** Chuyến đã về quá số ngày này mà chưa có HĐ đại lý thì đốc (ba-spec 51 §8). */
export const SUPPLIER_INVOICE_WAIT_DAYS = 10;

export type PlanningModule = "import" | "production-order" | "export" | "supplier-invoice";

export const PLANNING_MODULE_LABELS: Record<PlanningModule, string> = {
  import: "Nhập khẩu",
  "production-order": "Lệnh sản xuất",
  export: "Xuất khẩu",
  "supplier-invoice": "Hóa đơn đại lý",
};

export type SupplierInvoiceAttentionKind = "awaiting" | "mismatch";

export type PlanningAttentionKind =
  | `export-${AttentionKind}`
  | `import-${ImportAttentionKind}`
  | `order-${OrderAttentionKind}`
  | `invoice-${SupplierInvoiceAttentionKind}`;

/** Nhãn loại việc — trùng nguyên văn nhãn ở tab Báo cáo / tab Hóa đơn của màn gốc (R3). */
export const PLANNING_ATTENTION_LABELS: Record<PlanningAttentionKind, string> = {
  "export-overdue": ATTENTION_LABELS.overdue,
  "export-over-tolerance": ATTENTION_LABELS["over-tolerance"],
  "export-under-tolerance": ATTENTION_LABELS["under-tolerance"],
  "export-unpaid": ATTENTION_LABELS.unpaid,
  "export-deferred-attachment": ATTENTION_LABELS["deferred-attachment"],
  "import-missing-docs": IMPORT_ATTENTION_LABELS["missing-docs"],
  "import-awaiting-quantity": IMPORT_ATTENTION_LABELS["awaiting-quantity"],
  "order-draft-overdue": ORDER_ATTENTION_LABELS["draft-overdue"],
  "order-stale-revision": ORDER_ATTENTION_LABELS["stale-revision"],
  "order-unlinked": ORDER_ATTENTION_LABELS.unlinked,
  "invoice-awaiting": "Chuyến chờ HĐ đại lý",
  "invoice-mismatch": "Chuyến lệch HĐ đại lý",
};

/** Mức (cùng thang với việc chuỗi): "error" = sổ sai · "reminder" = chưa làm · "info" = để biết (R3). */
export const PLANNING_ATTENTION_LEVELS: Record<PlanningAttentionKind, "error" | "reminder" | "info"> = {
  "export-overdue": "reminder",
  "export-over-tolerance": "info",
  "export-under-tolerance": "info",
  "export-unpaid": "reminder",
  "export-deferred-attachment": "reminder",
  "import-missing-docs": "reminder",
  "import-awaiting-quantity": "reminder",
  "order-draft-overdue": "reminder",
  "order-stale-revision": "error",
  "order-unlinked": "reminder",
  "invoice-awaiting": "reminder",
  "invoice-mismatch": "error",
};

export interface PlanningAttention {
  id: string;
  module: PlanningModule;
  kind: PlanningAttentionKind;
  level: "error" | "reminder" | "info";
  title: string;
  detail: string;
  date: string;
  /** Rỗng = cả công ty (hợp đồng / lệnh / chuyến xuất không có xưởng). */
  workshop: Workshop | "";
  path: string;
}

/** Người xem thấy module nào (R4); tiền chưa về cần thêm quyền xem giá (R7). */
export interface PlanningAccess {
  import: boolean;
  productionOrder: boolean;
  export: boolean;
  exportPrice: boolean;
  supplierInvoice: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDayOf = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

/**
 * Kỳ báo cáo gồm mọi THÁNG chạm khoảng ngày (R2) — hàm báo cáo 3 module tính theo tháng, nên kỳ
 * Ngày / Tuần / Tự chọn mở rộng ra trọn tháng thay vì tính lại theo ngày.
 */
export function planningPeriodFor(fromDate: string, toDate: string): ReportPeriod {
  const first = (fromDate <= toDate ? fromDate : toDate).slice(0, 7);
  const last = (fromDate <= toDate ? toDate : fromDate).slice(0, 7);
  const months: string[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  while (months.length < 240) {
    const key = `${y}-${pad2(m)}`;
    months.push(key);
    if (key >= last) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const end = months[months.length - 1];
  const label = months.length === 1 ? monthLabel(first) : `${monthLabel(first)} – ${monthLabel(end)}`;
  return { kind: months.length === 1 ? "month" : "quarter", key: months.length === 1 ? first : end, from: `${first}-01`, to: `${end}-${pad2(lastDayOf(end))}`, label, months };
}

export interface PlanningReports {
  import: ImportReport | null;
  productionOrder: OrderReport | null;
  export: ExportReport | null;
}

export interface PlanningReportInput {
  importData: ImportData;
  /** Lệnh đã qua `visibleOrders` (người chỉ xem thấy lệnh đã phát hành). */
  orderData: OrderReportInput;
  exportData: ExportData;
  customers: readonly Customer[];
  exportFilesAvailable: boolean;
}

/** Gọi hàm báo cáo của từng module người xem được thấy — cùng tham số như tab Báo cáo (R1). */
export function buildPlanningReports(input: PlanningReportInput, period: ReportPeriod, today: string, access: PlanningAccess): PlanningReports {
  return {
    import: access.import ? buildImportReport(input.importData, period, { today }) : null,
    productionOrder: access.productionOrder ? buildOrderReport(input.orderData, period, { today }) : null,
    export: access.export
      ? buildExportReport(input.exportData, period, { customers: input.customers, today, evidence: { filesAvailable: input.exportFilesAvailable } })
      : null,
  };
}

export interface PlanningSummary {
  import: { receipts: number; containers: number; loose: number; receivedKg: number; complete: number; missingDocs: number; awaitingQuantity: number } | null;
  productionOrder: { orders: number; issued: number; drafts: number; cartons: number; kg: number } | null;
  /** `outstanding` = null khi không có quyền xem giá. */
  export: { shipments: number; containers: number; actualKg: number; delivered: number; late: number; outstanding: number | null } | null;
}

export function buildPlanningSummary(reports: PlanningReports, access: PlanningAccess): PlanningSummary {
  const i = reports.import?.totals;
  const o = reports.productionOrder?.totals;
  const e = reports.export?.totals;
  return {
    import: i
      ? { receipts: i.receipts, containers: i.containers, loose: i.loose, receivedKg: i.receivedKg, complete: i.complete, missingDocs: i.missingDocs, awaitingQuantity: i.awaitingQuantity }
      : null,
    productionOrder: o ? { orders: o.orders, issued: o.issued, drafts: o.drafts, cartons: o.cartons, kg: o.kg } : null,
    export: e
      ? { shipments: e.shipments, containers: e.containers, actualKg: e.actualKg, delivered: e.delivered, late: e.late, outstanding: access.exportPrice ? e.outstanding : null }
      : null,
  };
}

const documentName = (kind: string) => IMPORT_DOCUMENT_KINDS.find((x) => x.value === kind)?.label ?? kind;

/** Đổi `attention[]` của 3 báo cáo thành dòng việc (R3). Không quyền xem giá ⇒ bỏ "Còn tiền chưa về". */
export function buildPlanningAttention(reports: PlanningReports, access: PlanningAccess): PlanningAttention[] {
  const rows: PlanningAttention[] = [];
  const push = (r: Omit<PlanningAttention, "level">) => rows.push({ ...r, level: PLANNING_ATTENTION_LEVELS[r.kind] });

  for (const a of reports.import?.attention ?? []) {
    push({
      id: `plan|import|${a.kind}|${a.receiptId}`,
      module: "import",
      kind: `import-${a.kind}`,
      title: `HĐ nhập ${a.contractNo || "(chưa số)"} · ${a.supplierName || "(NCC chưa rõ)"}`,
      detail: a.kind === "missing-docs" ? `thiếu ${a.missing.map(documentName).join(", ")}` : "hàng đã về, chưa ghi kg thực nhập",
      date: a.date,
      workshop: "",
      path: `/planning-import?contract=${encodeURIComponent(a.contractId)}&receipt=${encodeURIComponent(a.receiptId)}`,
    });
  }
  for (const a of reports.productionOrder?.attention ?? []) {
    push({
      id: `plan|order|${a.kind}|${a.orderId}`,
      module: "production-order",
      kind: `order-${a.kind}`,
      title: `Lệnh ${a.orderNo || "(chưa số)"} · ${a.customerName || "(khách chưa rõ)"}`,
      detail:
        a.kind === "draft-overdue"
          ? "còn nháp mà ngày sản xuất đã tới"
          : a.kind === "stale-revision"
            ? "hợp đồng đã có bản sửa mới, lệnh vẫn theo bản trước"
            : "đã phát hành, chưa gắn chuyến xuất",
      date: a.firstProductionDate,
      workshop: "",
      path: `/planning-production?order=${encodeURIComponent(a.orderId)}`,
    });
  }
  for (const a of reports.export?.attention ?? []) {
    if (a.kind === "unpaid" && !access.exportPrice) continue;
    push({
      id: `plan|export|${a.kind}|${a.contractId}`,
      module: "export",
      kind: `export-${a.kind}`,
      title: `HĐ xuất ${a.contractNo || "(chưa số)"} · ${a.customerName || "(khách chưa rõ)"}`,
      detail: attentionDetail(a, { viewPrice: access.exportPrice, deviationText, formatNumber: num, formatMoney, formatDate: formatDateVN }),
      date: a.kind === "overdue" ? a.deadline : "",
      workshop: "",
      path: `/planning-export?contract=${encodeURIComponent(a.contractId)}`,
    });
  }
  return rows;
}

export interface SupplierInvoiceAttentionInput {
  trips: readonly MaterialImportItem[];
  shipments: readonly ImportShipment[];
  invoices: readonly SupplierInvoice[];
  lines: readonly SupplierInvoiceLine[];
  /** Tên loại NL đã ánh xạ mã kế toán (`buildCodeMaps(...).materialByCode.values()`). */
  mappedMaterials: ReadonlySet<string>;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Chuyến trong khoảng + xưởng: "Lệch HĐ" luôn đốc; "Chờ HĐ" / "Thiếu HĐ một phần" chỉ khi đã về quá
 * `waitDays` ngày (ba-spec 51 §8). Trạng thái tính bằng `tripInvoiceInfo` — cùng luật tab Hóa đơn.
 */
export function buildSupplierInvoiceAttention(
  input: SupplierInvoiceAttentionInput,
  range: { fromDate: string; toDate: string; workshop?: Workshop | "" },
  today: string,
  waitDays = SUPPLIER_INVOICE_WAIT_DAYS,
): PlanningAttention[] {
  const byTripLine = indexLinesByTripLine(input.lines);
  const invoiceById = new Map(input.invoices.map((v) => [v.id, v]));
  const tripsByShipment = new Map<string, MaterialImportItem[]>();
  for (const t of input.trips) {
    if (!t.shipmentId) continue;
    tripsByShipment.set(t.shipmentId, [...(tripsByShipment.get(t.shipmentId) ?? []), t]);
  }
  const rows: PlanningAttention[] = [];
  for (const s of input.shipments) {
    if (s.deliveryDate < range.fromDate || s.deliveryDate > range.toDate) continue;
    if (range.workshop && s.workshop !== range.workshop) continue;
    const tripLines = tripsByShipment.get(s.id);
    if (!tripLines) continue;
    const info = tripInvoiceInfo(tripLines, byTripLine, invoiceById, input.mappedMaterials);
    if (!info) continue;
    const waited = daysBetween(s.deliveryDate, today);
    let kind: SupplierInvoiceAttentionKind | null = null;
    if (info.status === "mismatch") kind = "mismatch";
    else if ((info.status === "awaiting" || info.status === "partial") && waited > waitDays) kind = "awaiting";
    if (!kind) continue;
    rows.push({
      id: `plan|invoice|${kind}|${s.id}`,
      module: "supplier-invoice",
      kind: `invoice-${kind}`,
      level: PLANNING_ATTENTION_LEVELS[`invoice-${kind}`],
      title: `Chuyến ${s.supplierName || "(đại lý chưa rõ)"}${s.lotCode ? ` · ${s.lotCode}` : ""}`,
      detail:
        kind === "mismatch"
          ? `HĐ ${info.invoiceNos.join(", ")} lệch sổ chuyến, chưa xử lý`
          : `${info.status === "partial" ? "thiếu HĐ một phần" : "chưa có HĐ"} · đã về ${waited} ngày`,
      date: s.deliveryDate,
      workshop: s.workshop,
      path: "/imports?tab=invoices",
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
