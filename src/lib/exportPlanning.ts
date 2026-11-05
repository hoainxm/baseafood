// ============================================================
// Tên file: src/lib/exportPlanning.ts
// Tên tiếng Việt: Luật Phòng Kế hoạch · Xuất khẩu — hợp đồng, chuyến, 6 bước, khép kín
// Description: Pure rules for the export planning module (wave 1): contract totals,
//              effective revision, shipment month, step evidence, actuals, tolerance closure,
//              coverage, lateness, search, month plan and Excel layout.
// ============================================================
// Oracle: docs/app-map/41-export-planning.ba-spec.md (R1…R15, AC-1…AC-29). Hàm THUẦN — màn chỉ
// gọi, không tự tính lại. Đổi luật ⇒ sửa test cùng thư mục (exportPlanning.test.ts).
import { formatDateVN } from "./format";
import { containerCountOf, filesOfContainer, isContainerKind, shipmentContainers } from "./exportContainers";
import type {
  AttachmentDeferral,
  Customer,
  ExportContract,
  ExportShipmentLine,
  ExportShipmentContainer,
  ExportActivity,
  ExportContractApproval,
  ExportContractAttachmentKind,
  ExportContractLine,
  GoodsType,
  ExportContractRevision,
  ExportContractTerms,
  ExportDeadlineExtension,
  ExportDocumentKind,
  ExportDocumentKindRow,
  SystemExportDocumentKind,
  ExportFile,
  ExportItemState,
  ExportPayment,
  ExportShipment,
  ExportShipmentKind,
  ExportStep,
  ExportStepItem,
  Product,
  CustomerProductName,
} from "@/types";
import { extractCustomerNames, looseNameKey, nameKey, productsByCustomerName } from "./customerProductNames";

/* ---------- Đính kèm hồ sơ HĐ (bước Đính kèm, mig 0079) ---------- */

export const CONTRACT_ATTACHMENT_LABELS: Record<ExportContractAttachmentKind, string> = {
  "signed-contract": "Hợp đồng đã ký",
  lc: "L/C",
  proforma: "Proforma invoice",
  other: "Hồ sơ khác",
};

/* ---------- Danh sách cố định + nhãn ---------- */

export const SHIPMENT_KINDS: { value: ExportShipmentKind; label: string; short: string }[] = [
  { value: "40RF", label: "Cont 40' lạnh (40RF)", short: "40" },
  { value: "40HC-RF", label: "Cont 40' cao lạnh (40HC-RF)", short: "40HC" },
  { value: "20RF", label: "Cont 20' lạnh (20RF)", short: "20" },
  { value: "truck", label: "Xe tải", short: "Xe tải" },
  { value: "consolidated", label: "Đóng ghép", short: "Đóng ghép" },
];
export const shipmentKindLabel = (k: ExportShipmentKind) => SHIPMENT_KINDS.find((x) => x.value === k)?.label ?? k;
const shipmentKindShort = (k: ExportShipmentKind) => SHIPMENT_KINDS.find((x) => x.value === k)?.short ?? k;
export { isContainerKind };

/** 10 loại chứng từ HỆ THỐNG (luật riêng gắn theo id). Tên hiển thị đổi được ở danh mục (mig 0081). */
export const DOCUMENT_KINDS: { value: SystemExportDocumentKind; label: string }[] = [
  { value: "commercial-invoice", label: "Commercial Invoice" },
  { value: "packing-list", label: "Packing List" },
  { value: "bill-of-lading", label: "Bill of Lading (B/L)" },
  { value: "health-certificate", label: "Health Certificate (H/C)" },
  { value: "certificate-of-origin", label: "C/O" },
  { value: "expiry-list", label: "Expiry Date List" },
  { value: "sample-invoice", label: "Hóa đơn hàng mẫu (M)" },
  { value: "insurance", label: "Bảo hiểm (CIF/CIP)" },
  { value: "microbiology-report", label: "Kết quả kiểm vi sinh" },
  { value: "other", label: "Chứng từ khác" },
];

/* ---------- Danh mục loại chứng từ (mig 0081, ba-spec 41 §0b R37) ---------- */

/** Một loại chứng từ để chọn: hệ thống (tên có thể đã đổi) hoặc tự thêm. */
export interface DocumentKindOption {
  id: string;
  name: string;
  isSystem: boolean;
  note: string;
  sortOrder: number;
}

const SYSTEM_KIND_IDS = new Set<string>(DOCUMENT_KINDS.map((k) => k.value));
export const isSystemDocumentKind = (id: string): id is SystemExportDocumentKind => SYSTEM_KIND_IDS.has(id);
/** Thứ tự loại tự thêm bắt đầu sau 10 loại hệ thống. */
const CUSTOM_ORDER_BASE = 100;

/**
 * Danh sách loại chứng từ đầy đủ: 10 loại hệ thống (dòng danh mục cùng id ⇒ đổi tên) rồi loại tự thêm
 * (theo thứ tự, rồi tên). Dòng tự thêm tên rỗng bị bỏ.
 */
export function documentKindList(rows: readonly ExportDocumentKindRow[] = []): DocumentKindOption[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const system = DOCUMENT_KINDS.map((k, i) => {
    const o = byId.get(k.value);
    return { id: k.value, name: o?.name.trim() || k.label, isSystem: true, note: o?.note ?? "", sortOrder: i };
  });
  const custom = rows
    .filter((r) => !isSystemDocumentKind(r.id) && r.name.trim())
    .map((r) => ({ id: r.id, name: r.name.trim(), isSystem: false, note: r.note, sortOrder: r.sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));
  return [...system, ...custom];
}

/** Đổi danh sách đầy đủ (màn danh mục sửa) về dòng cần lưu: loại tự thêm + loại hệ thống ĐÃ đổi tên / có ghi chú. */
export function documentKindRowsFromList(list: readonly DocumentKindOption[]): ExportDocumentKindRow[] {
  const defaults = new Map<string, string>(DOCUMENT_KINDS.map((k) => [k.value, k.label]));
  return list
    .filter((k) => !isSystemDocumentKind(k.id) || k.name.trim() !== defaults.get(k.id) || !!k.note.trim())
    .map((k) => ({ id: k.id, name: k.name.trim(), sortOrder: k.sortOrder, note: k.note }));
}

/**
 * Thêm loại chứng từ theo tên gõ trong ô chọn. Trùng tên (không phân hoa thường, kể cả loại hệ thống)
 * ⇒ trả loại có sẵn, không đẻ bản trùng (README § Ô chọn danh mục).
 */
export function findOrCreateDocumentKind(
  name: string,
  rows: readonly ExportDocumentKindRow[],
  newId: () => string,
): { id: string; rows: ExportDocumentKindRow[]; created: boolean } {
  const n = name.trim();
  const key = n.toLocaleLowerCase("vi");
  const found = documentKindList(rows).find((k) => k.name.toLocaleLowerCase("vi") === key);
  if (found || !n) return { id: found?.id ?? "", rows: [...rows], created: false };
  const maxOrder = Math.max(CUSTOM_ORDER_BASE - 1, ...rows.filter((r) => !isSystemDocumentKind(r.id)).map((r) => r.sortOrder));
  const row: ExportDocumentKindRow = { id: `doc-${newId()}`, name: n, sortOrder: maxOrder + 1, note: "" };
  return { id: row.id, rows: [...rows, row], created: true };
}

/** Tên loại chứng từ theo id (danh mục nếu có). Id lạ (bảng chưa nạp / đã gỡ) ⇒ "Chứng từ khác". */
export function documentKindLabel(k: ExportDocumentKind | "", rows: readonly ExportDocumentKindRow[] = []): string {
  if (!k) return "Chứng từ";
  return documentKindList(rows).find((x) => x.id === k)?.name ?? "Chứng từ khác";
}
/** Nhãn đầy đủ một chứng từ yêu cầu: "C/O form VJ", "Health Certificate (H/C) · công ty tự cấp". */
export function requiredDocumentLabel(
  d: { kind: ExportDocumentKind | ""; form: string; issuer: string },
  rows: readonly ExportDocumentKindRow[] = [],
): string {
  return [documentKindLabel(d.kind, rows) + (d.form.trim() ? ` form ${d.form.trim()}` : ""), d.issuer.trim()].filter(Boolean).join(" · ");
}

export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export const PAYMENT_METHODS: { value: "ttr" | "lc" | "other"; label: string }[] = [
  { value: "ttr", label: "TTR (chuyển khoản)" },
  { value: "lc", label: "L/C" },
  { value: "other", label: "Khác" },
];

export const STEP_TITLES = ["Hợp đồng", "Lệnh sản xuất", "Bao bì", "Đóng cont", "Bộ chứng từ", "Gửi chứng từ · tiền về"] as const;
export type StepNo = 1 | 2 | 3 | 4 | 5 | 6;
export const STEP_NOS: StepNo[] = [1, 2, 3, 4, 5, 6];

export const SUB_STEP_LABELS: Record<ExportStep, string> = {
  "production-order": "Lệnh sản xuất",
  packaging: "Bao bì",
  "loading-plan": "Sơ đồ container",
  "loading-photos": "Hình ảnh đóng cont",
  "customs-declaration": "Tờ khai",
  "export-order": "Lệnh xuất",
  document: "Chứng từ",
};
/** Mục con của bước 4 (đóng cont), theo thứ tự 4a → 4d. */
/** Mục của bước 4 theo trình tự đóng cont thật (chị Vi 2026-11-03): lệnh xuất → sơ đồ → hình ảnh → tờ khai. */
export const LOADING_STEPS: ExportStep[] = ["export-order", "loading-plan", "loading-photos", "customs-declaration"];
/** Hai mục người đóng hàng (U4) đính được — trạng thái tự suy từ file (R10). */
export const LOADING_UPLOAD_STEPS: ExportStep[] = ["loading-plan", "loading-photos"];

export const ITEM_STATE_LABELS: Record<ExportItemState, string> = {
  "not-started": "Chưa làm",
  "in-progress": "Đang làm",
  done: "Xong",
  "not-applicable": "Không áp dụng",
};

/**
 * Quy trình hợp đồng (chủ dự án chốt 2026-10-29 — bỏ bước duyệt HĐ đầu, chỉ còn duyệt cuối):
 * Lập HĐ → Chờ đính kèm → (đủ hồ sơ) → Đang giao hàng → (xuất đủ trong dung sai) → Chờ duyệt cuối →
 * (Trưởng / Phó phòng KH duyệt cuối) → Đã đóng HĐ.
 */
export type ContractState = "attaching" | "shipping" | "final-review" | "closed" | "cancelled";
export const CONTRACT_STATE_LABELS: Record<ContractState, string> = {
  attaching: "Chờ đính kèm",
  // Trước 2026-11-05 là "Đang ghi chuyến" — người dùng tưởng ghi chuyến xong là xong chặng (HĐ 68/2025).
  shipping: "Đang giao hàng",
  "final-review": "Chờ duyệt cuối",
  closed: "Đã đóng HĐ",
  cancelled: "Đã hủy",
};
/** Nhãn trạng thái HĐ cho người đọc (giữ chữ ký hàm cũ cho các màn). */
export function contractStateLabel(state: ContractState, _contract?: Pick<ExportContract, "status">): string {
  return CONTRACT_STATE_LABELS[state];
}

/** HĐ còn đang chạy (chưa đóng / chưa hủy). */
export const isLiveContractState = (st: ContractState) => st !== "closed" && st !== "cancelled";

/** Các chặng của quy trình HĐ — thanh chặng ở hồ sơ HĐ, tour, hộp "?". */
export const CONTRACT_FLOW_STAGES: readonly { state: Exclude<ContractState, "cancelled">; title: string; who: string; hint: string }[] = [
  { state: "attaching", title: "Đính kèm", who: "Nhân viên Kế hoạch", hint: "Lập HĐ xong là vào bước này. Đính kèm đủ hồ sơ bắt buộc: hợp đồng đã ký, L/C (nếu thanh toán L/C). Đủ hồ sơ mới ghi chuyến lẻ được; lịch xuất hàng (chuyến dự kiến) tạo được ngay." },
  { state: "shipping", title: "Giao hàng", who: "Nhân viên Kế hoạch", hint: "Ghi chuyến rồi làm từng chuyến qua Lệnh sản xuất, Bao bì, Đóng cont, Bộ chứng từ. Chặng này xong khi mọi chuyến xong đủ 5 bước và đã giao đủ hàng trong dung sai — ghi chuyến xong chưa phải là xong chặng." },
  { state: "final-review", title: "Duyệt cuối", who: "Trưởng / Phó phòng KH", hint: "Xuất đủ trong dung sai ⇒ Trưởng hoặc Phó phòng Kế hoạch xem lại hồ sơ, đồng ý thì đóng HĐ; chưa ổn thì trả về kèm lý do." },
  { state: "closed", title: "Đóng HĐ", who: "", hint: "Hợp đồng đã đóng. Mở lại được (Trưởng / Phó phòng) nếu cần sửa." },
];

/** "thừa 16,9%" / "thiếu 3,2%" — biết chiều để giao bù hay điều chỉnh invoice. */
export function deviationText(pct: number): string {
  const r = Math.round(Math.abs(pct) * 10) / 10;
  return `${pct >= 0 ? "thừa" : "thiếu"} ${r.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

export const APPROVAL_LABELS: Record<"pending" | "approved" | "needs-revision" | "rejected", string> = {
  pending: "Chờ duyệt",
  approved: "Đồng ý",
  "needs-revision": "Yêu cầu sửa",
  rejected: "Từ chối",
};

/** Nhãn kết quả duyệt cuối (mig 0079). Duyệt cuối không có "từ chối" — trả về để sửa hồ sơ chuyến. */
export const FINAL_REVIEW_LABELS: Record<"approved" | "needs-revision", string> = {
  approved: "Đồng ý — đóng hợp đồng",
  "needs-revision": "Trả về — sửa hồ sơ",
};

/** Đường dẫn giữ chỗ của bộ demo — không có file thật, chỉ tính là bằng chứng trong `site-demo` (R14). */
export const DEMO_PLACEHOLDER_PREFIX = "demo-placeholder/";

/* ---------- Dữ liệu của module ---------- */

export interface ExportData {
  contracts: readonly ExportContract[];
  revisions: readonly ExportContractRevision[];
  approvals: readonly ExportContractApproval[];
  extensions: readonly ExportDeadlineExtension[];
  shipments: readonly ExportShipment[];
  items: readonly ExportStepItem[];
  files: readonly ExportFile[];
  payments: readonly ExportPayment[];
  /** Nhật ký thao tác của hợp đồng (mig 0079) — chỉ thêm. */
  activities: readonly ExportActivity[];
  /** Danh mục loại chứng từ (mig 0081) — đổi tên loại hệ thống + loại tự thêm. Bỏ trống ⇒ 10 loại gốc. */
  documentKinds?: readonly ExportDocumentKindRow[];
  /**
   * Chuyến có ≥ 1 Lệnh sản xuất "Đã phát hành" gắn kèm (mig 0088, ba-spec 48 R6) — bước 2 của chuyến
   * xong. Tính bằng `issuedShipmentIds` (lib/productionOrder.ts). Bỏ trống ⇒ chỉ luật cũ (file / dùng chung).
   */
  issuedOrderShipmentIds?: ReadonlySet<string>;
  /** Hàng của chuyến (mig 0096, ba-spec 63). Bỏ trống ⇒ chuyến chưa có dòng hàng chi tiết. */
  shipmentLines?: readonly ExportShipmentLine[];
  /** Cont THÊM của chuyến (mig 0106, ba-spec 73). Bỏ trống ⇒ mỗi chuyến chỉ có cont 1 (trên chuyến). */
  shipmentContainers?: readonly ExportShipmentContainer[];
  /** Máy chủ đã chạy 0103 (ba-spec 72) ⇒ mục SI là mục bắt buộc của bước 4. Bỏ trống ⇒ chưa có mục SI. */
  shippingInstructionEnabled?: boolean;
}

export const EMPTY_EXPORT_DATA: ExportData = {
  contracts: [],
  revisions: [],
  approvals: [],
  extensions: [],
  shipments: [],
  items: [],
  files: [],
  payments: [],
  activities: [],
};

/** Tùy chọn chung: chạy không nối máy chủ thì không bắt file làm bằng chứng (như /documents). */
export interface EvidenceOptions {
  filesAvailable: boolean;
}
const WITH_FILES: EvidenceOptions = { filesAvailable: true };

const round2 = (v: number) => Math.round(v * 100) / 100;
const numOr0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const EPS = 1e-6;

export function emptyTerms(): ExportContractTerms {
  return {
    incoterm: "",
    portOfLoading: "",
    portOfDischarge: "",
    paymentMethod: "ttr",
    paymentOther: "",
    depositPct: null,
    lcNo: "",
    lcExpiry: "",
    lcLatestShipment: "",
    currency: "USD",
    tolerancePct: null,
    latestShipmentDate: "",
    containerCount: null,
    containerType: "",
    requiredDocuments: [],
  };
}

/* ---------- R2: tổng hợp đồng ---------- */

/** Số thùng của một dòng: dòng đếm theo kiện ⇒ kiện × thùng/kiện. */
export function lineCartons(l: ExportContractLine): number {
  const q = numOr0(l.quantity);
  return l.unitKind === "bundle" ? q * Math.max(1, numOr0(l.cartonsPerUnit) || 1) : q;
}

/** kg tự tính = số thùng × kg tịnh/thùng (null khi chưa đủ số). */
/**
 * Chép một dòng hàng HĐ (chủ dự án 2026-10-30: "mọi thông tin như cũ, chỉ khác mỗi size" — khỏi gõ lại).
 * Id mới; ô Size để trống cho người gõ size mới; mặt hàng, quy cách, số lượng, đơn giá… giữ nguyên.
 */
export function copyContractLine(l: ExportContractLine, id: string): ExportContractLine {
  return { ...l, id, size: "" };
}

/** Chèn bản chép ngay dưới dòng gốc (giữ thứ tự dòng như trên HĐ). */
export function insertCopiedLine<T extends { id: string }>(lines: readonly T[], sourceId: string, copy: T): T[] {
  const i = lines.findIndex((l) => l.id === sourceId);
  return i < 0 ? [...lines, copy] : [...lines.slice(0, i + 1), copy, ...lines.slice(i + 1)];
}

export function computedLineKg(l: ExportContractLine): number | null {
  if (l.quantity == null || l.netKgPerCarton == null) return null;
  return round2(lineCartons(l) * l.netKgPerCarton);
}

/** kg của dòng: ô kg gõ tay thắng, trống thì tự tính. */
export const lineKg = (l: ExportContractLine): number => numOr0(l.kg ?? computedLineKg(l));
export const lineAmount = (l: ExportContractLine): number => round2(lineKg(l) * numOr0(l.unitPrice));

export interface ContractTotals {
  /** Σ số lượng theo đơn vị của dòng (khớp HĐ giấy: thùng lẫn kiện). */
  units: number;
  /** Σ quy về thùng. */
  cartons: number;
  kg: number;
  amount: number;
}

export function contractTotals(lines: readonly ExportContractLine[]): ContractTotals {
  return lines.reduce<ContractTotals>(
    (t, l) => ({
      units: t.units + numOr0(l.quantity),
      cartons: t.cartons + lineCartons(l),
      kg: round2(t.kg + lineKg(l)),
      amount: round2(t.amount + lineAmount(l)),
    }),
    { units: 0, cartons: 0, kg: 0, amount: 0 },
  );
}

/* ---------- Kiểm hợp đồng (R9) ---------- */

export interface ValidationIssue {
  key: string;
  label: string;
  message: string;
}

const normalizeNo = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Số HĐ duy nhất theo khách — không phân hoa thường, bỏ khoảng trắng đầu/cuối. */
export function findDuplicateContract(
  contracts: readonly ExportContract[],
  customerId: string,
  contractNo: string,
  exceptId = "",
): string | undefined {
  const no = normalizeNo(contractNo);
  if (!no) return undefined;
  return contracts.find((c) => c.id !== exceptId && c.customerId === customerId && normalizeNo(c.contractNo) === no)?.id;
}

export function validateContract(
  input: { id: string; customerId: string; contractNo: string; signedOn: string; terms: ExportContractTerms; lines: readonly ExportContractLine[] },
  contracts: readonly ExportContract[],
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!input.customerId) out.push({ key: "customerId", label: "Khách hàng", message: "Chưa chọn khách hàng" });
  if (!input.contractNo.trim()) out.push({ key: "contractNo", label: "Số hợp đồng", message: "Chưa ghi số hợp đồng" });
  else if (input.customerId && findDuplicateContract(contracts, input.customerId, input.contractNo, input.id))
    out.push({ key: "contractNo", label: "Số hợp đồng", message: "Khách này đã có hợp đồng cùng số" });
  if (!input.signedOn) out.push({ key: "signedOn", label: "Ngày ký", message: "Chưa chọn ngày ký" });
  if (!input.terms.latestShipmentDate)
    out.push({ key: "latestShipmentDate", label: "Hạn giao muộn nhất", message: "Chưa chọn hạn giao — hợp đồng không có hạn sẽ không hiện ở tháng nào" });
  const t = input.terms.tolerancePct;
  if (t != null && (t < 0 || t > 100)) out.push({ key: "tolerancePct", label: "Dung sai", message: "Dung sai phải từ 0 đến 100%" });
  if (input.terms.paymentMethod === "other" && !(input.terms.paymentOther ?? "").trim())
    out.push({ key: "paymentOther", label: "Hình thức thanh toán", message: "Thanh toán Khác thì ghi hình thức (VD D/P, nhờ thu)" });
  if (input.terms.paymentMethod === "lc" && !input.terms.lcNo.trim())
    out.push({ key: "lcNo", label: "Số L/C", message: "Thanh toán L/C thì ghi số L/C" });
  const filled = input.lines.filter((l) => l.description.trim() || l.quantity != null || l.kg != null);
  if (!filled.some((l) => lineKg(l) > 0)) out.push({ key: "lines", label: "Dòng hàng", message: "Cần ít nhất một dòng hàng có số kg" });
  filled.forEach((l, i) => {
    if (!l.description.trim()) out.push({ key: `line-${i}`, label: `Dòng ${i + 1}`, message: "Chưa ghi tên hàng" });
    if (l.unitKind === "bundle" && !(numOr0(l.cartonsPerUnit) >= 1))
      out.push({ key: `line-${i}`, label: `Dòng ${i + 1}`, message: "Đếm theo kiện thì ghi số thùng mỗi kiện" });
  });
  return out;
}

/* ---------- R3: bản hợp đồng + duyệt gắn bản ---------- */

export function revisionsOf(d: Pick<ExportData, "revisions">, contractId: string): ExportContractRevision[] {
  return d.revisions.filter((r) => r.contractId === contractId).sort((a, b) => a.revisionNo - b.revisionNo);
}

export function nextRevisionNo(d: Pick<ExportData, "revisions">, contractId: string): number {
  const rs = revisionsOf(d, contractId);
  return rs.length ? rs[rs.length - 1].revisionNo + 1 : 0;
}

/**
 * Lượt duyệt BẢN hợp đồng (không gồm duyệt cuối — `stage: "final"`). Từ 2026-10-29 không còn bước duyệt
 * bản: chỉ còn lượt ghi CŨ (BGĐ ký giấy trước 0079, hoặc duyệt HĐ 28–29/10) — để xem lịch sử, và
 * "từ chối" cũ vẫn loại bản đó khỏi hiệu lực.
 */
export function approvalsOf(d: Pick<ExportData, "approvals">, revisionId: string): ExportContractApproval[] {
  return d.approvals
    .filter((a) => a.revisionId === revisionId && a.stage !== "final")
    .sort((a, b) => (a.decidedOn + a.createdAt).localeCompare(b.decidedOn + b.createdAt));
}

/** Trạng thái duyệt của MỘT bản = lần ghi gần nhất (chưa ghi ⇒ chờ duyệt). */
export function approvalState(d: Pick<ExportData, "approvals">, revisionId: string): "pending" | "approved" | "needs-revision" | "rejected" {
  const xs = approvalsOf(d, revisionId);
  return xs.length ? xs[xs.length - 1].decision : "pending";
}

/**
 * Trạng thái HIỂN THỊ của một bản: BGĐ "yêu cầu sửa" mà bản đã được sửa SAU lần ghi đó ⇒ "Chờ duyệt"
 * (đã sửa, chờ ký lại). Luật bản hiệu lực vẫn dùng `approvalState`.
 */
export function revisionApprovalLabelState(
  d: Pick<ExportData, "approvals">,
  rev: Pick<ExportContractRevision, "id" | "createdAt">,
): "pending" | "approved" | "needs-revision" | "rejected" {
  const xs = approvalsOf(d, rev.id);
  const last = xs[xs.length - 1];
  if (!last) return "pending";
  return last.decision === "needs-revision" && rev.createdAt > last.createdAt ? "pending" : last.decision;
}

/**
 * Bản hiệu lực = bản MỚI NHẤT (ghi là có hiệu lực ngay — bỏ bước duyệt HĐ 2026-10-29), trừ bản từng bị
 * từ chối theo cách cũ. Mọi bản sửa được Trưởng / Phó phòng xem lại một lần ở bước duyệt cuối.
 */
export function effectiveRevision(d: Pick<ExportData, "revisions" | "approvals">, contractId: string): ExportContractRevision | null {
  const rs = revisionsOf(d, contractId).filter((r) => approvalState(d, r.id) !== "rejected");
  return rs.length ? rs[rs.length - 1] : null;
}

/** Bản mới nhất (kể cả bản bị từ chối theo cách cũ). */
export function latestRevision(d: Pick<ExportData, "revisions">, contractId: string): ExportContractRevision | null {
  const rs = revisionsOf(d, contractId);
  return rs.length ? rs[rs.length - 1] : null;
}

/** Bản dùng để tính: bản hiệu lực; chưa có (mọi bản bị từ chối kiểu cũ) thì bản mới nhất. */
export function workingRevision(d: Pick<ExportData, "revisions" | "approvals">, contractId: string): ExportContractRevision | null {
  return effectiveRevision(d, contractId) ?? latestRevision(d, contractId);
}

export const termsOf = (d: Pick<ExportData, "revisions" | "approvals">, contractId: string): ExportContractTerms =>
  workingRevision(d, contractId)?.terms ?? emptyTerms();

/** R15 + NV6: hạn giao hiệu lực = gia hạn mới nhất, không có thì hạn của bản đang dùng. */
export function effectiveDeadline(d: Pick<ExportData, "revisions" | "approvals" | "extensions">, contractId: string): string {
  const ext = d.extensions
    .filter((e) => e.contractId === contractId && e.newDeadline)
    .sort((a, b) => (a.confirmedOn + a.createdAt).localeCompare(b.confirmedOn + b.createdAt));
  if (ext.length) return ext[ext.length - 1].newDeadline;
  return termsOf(d, contractId).latestShipmentDate;
}

/* ---------- R1 + R8: tháng của chuyến, thứ tự ngày ---------- */

export function shipmentMonth(s: Pick<ExportShipment, "loadingDate" | "etd" | "planMonth">): string {
  return (s.loadingDate || s.etd || "").slice(0, 7) || s.planMonth;
}

/**
 * Số container chuẩn ISO 6346 (chị Vi 2026-11-03): 11 ký tự = 4 chữ cái (mã chủ + loại) + 7 chữ số (6 số
 * seri + 1 số kiểm), VD SZLU2030326. Gõ có khoảng trắng / gạch / chữ thường ⇒ chuẩn hóa trước khi kiểm.
 */
export const normalizeContainerNo = (v: string) => v.replace(/[\s\-./]/g, "").toUpperCase();
export const isValidContainerNo = (v: string) => /^[A-Z]{4}\d{7}$/.test(normalizeContainerNo(v));

export function validateShipment(
  s: Pick<ExportShipment, "planMonth" | "loadingDate" | "etd" | "eta" | "plannedKg"> & Partial<Pick<ExportShipment, "kind" | "containerNo">>,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  // Xe tải ghi biển số, đóng ghép không có cont riêng ⇒ chỉ kiểm cont lạnh (20RF · 40RF · 40HC-RF).
  if (s.kind && isContainerKind(s.kind) && s.containerNo?.trim() && !isValidContainerNo(s.containerNo))
    out.push({ key: "containerNo", label: "Số container", message: "Số container gồm 11 ký tự: 4 chữ cái đầu + 7 chữ số (VD SZLU2030326)" });
  if (!s.planMonth && !s.loadingDate && !s.etd)
    out.push({ key: "planMonth", label: "Tháng kế hoạch", message: "Chọn tháng kế hoạch (hoặc ngày đóng / ETD)" });
  if (s.loadingDate && s.etd && s.loadingDate > s.etd)
    out.push({ key: "loadingAfterEtd", label: "Ngày đóng cont", message: "Ngày đóng cont phải trước hoặc bằng ETD" });
  if (s.etd && s.eta && s.etd > s.eta) out.push({ key: "etdAfterEta", label: "ETA", message: "ETA phải sau hoặc bằng ETD" });
  if (s.plannedKg != null && s.plannedKg < 0) out.push({ key: "plannedKg", label: "Kg kế hoạch", message: "Kg không được âm" });
  return out;
}

/**
 * Cont thêm của chuyến (ba-spec 73 R3): số cont theo luật 11 ký tự (gõ sau cũng được — để trống không lỗi); hai cont
 * trong một chuyến không trùng số (so cả cont 1). Khóa lỗi `container-<id>` / `container-duplicate`.
 */
export function validateExtraContainers(
  first: Pick<ExportShipment, "containerNo">,
  extras: readonly Pick<ExportShipmentContainer, "id" | "containerNo">[],
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  extras.forEach((c, i) => {
    if (c.containerNo.trim() && !isValidContainerNo(c.containerNo))
      out.push({ key: `container-${c.id}`, label: `Số cont ${i + 2}`, message: "Số container gồm 11 ký tự: 4 chữ cái đầu + 7 chữ số (VD SZLU2030326)" });
  });
  const nos = [first.containerNo, ...extras.map((c) => c.containerNo)].map(normalizeContainerNo).filter(Boolean);
  const dup = nos.find((n, i) => nos.indexOf(n) !== i);
  if (dup) out.push({ key: "container-duplicate", label: "Số cont", message: `Số cont ${dup} ghi hai lần trong một chuyến` });
  return out;
}

/* ---------- Mục bước 5 sinh từ chứng từ yêu cầu (R6) ---------- */

const sameDoc = (a: { docKind: string; docForm: string }, b: { kind: string; form: string }) =>
  a.docKind === b.kind && a.docForm.trim().toLowerCase() === b.form.trim().toLowerCase();

/**
 * Mục chứng từ còn THIẾU của chuyến theo chứng từ yêu cầu của `terms` (+ Commercial Invoice nếu HĐ
 * chưa liệt kê — thực xuất lấy từ đó). Trả mục MỚI để ghi thêm; không xóa mục đã có.
 */
export const needsInsurance = (incoterm: string | undefined) => /^(CIF|CIP)$/i.test((incoterm ?? "").trim());

/** Chứng từ khách yêu cầu theo điều khoản (kể cả Commercial Invoice + bảo hiểm CIF/CIP tự thêm) — mục này KHÔNG xóa được. */
export function isRequiredDocumentItem(terms: Pick<ExportContractTerms, "requiredDocuments" | "incoterm">, item: Pick<ExportStepItem, "docKind" | "docForm">): boolean {
  if (item.docKind === "commercial-invoice") return true;
  if (item.docKind === "insurance" && needsInsurance(terms.incoterm)) return true;
  return terms.requiredDocuments.some((w) => sameDoc(item, w));
}

export function missingDocumentItems(
  shipmentId: string,
  terms: Pick<ExportContractTerms, "requiredDocuments"> & { incoterm?: string },
  existing: readonly ExportStepItem[],
  makeId: () => string,
  now = new Date().toISOString(),
): ExportStepItem[] {
  const mine = existing.filter((i) => i.shipmentId === shipmentId && i.step === "document");
  const wanted = [...terms.requiredDocuments];
  if (!wanted.some((w) => w.kind === "commercial-invoice")) wanted.unshift({ kind: "commercial-invoice", form: "", issuer: "" });
  // CIF / CIP: người bán buộc mua bảo hiểm ⇒ luôn có mục bảo hiểm (bỏ được bằng Không áp dụng + lý do).
  if (needsInsurance(terms.incoterm) && !wanted.some((w) => w.kind === "insurance")) wanted.push({ kind: "insurance", form: "", issuer: "" });
  const out: ExportStepItem[] = [];
  for (const w of wanted) {
    if ([...mine, ...out].some((i) => sameDoc(i, w))) continue;
    out.push({ ...blankItem(shipmentId, "document", makeId(), now), docKind: w.kind, docForm: w.form, docIssuer: w.issuer });
  }
  return out;
}

export function blankItem(shipmentId: string, step: ExportStep, id: string, now = new Date().toISOString()): ExportStepItem {
  return {
    id,
    shipmentId,
    step,
    docKind: "",
    docForm: "",
    docIssuer: "",
    state: "not-started",
    number: "",
    issuedOn: "",
    note: "",
    naReason: "",
    sharedFromId: "",
    cartons: null,
    netKg: null,
    amount: null,
    onBoardDate: "",
    createdAt: now,
  };
}

export function documentItems(d: Pick<ExportData, "items">, shipmentId: string): ExportStepItem[] {
  const order = new Map<string, number>(DOCUMENT_KINDS.map((k, i) => [k.value, i]));
  return d.items
    .filter((i) => i.shipmentId === shipmentId && i.step === "document")
    .sort((a, b) => (order.get(a.docKind) ?? 99) - (order.get(b.docKind) ?? 99) || a.createdAt.localeCompare(b.createdAt));
}

/** Mục duy nhất của một bước không phải chứng từ (bước 2, 3, 4a–4d) — chưa có thì undefined. */
export function stepItem(d: Pick<ExportData, "items">, shipmentId: string, step: ExportStep): ExportStepItem | undefined {
  return d.items.find((i) => i.shipmentId === shipmentId && i.step === step);
}

export function filesOfItem(d: Pick<ExportData, "files">, itemId: string): ExportFile[] {
  return d.files.filter((f) => f.stepItemId === itemId);
}

/** File của bước đóng cont 4a / 4b (gắn theo bước, không cần mục). */
/**
 * File booking của MỘT chuyến (ba-spec 60 R1, R2): mới nhất trước. Chuyến "dùng chung" KHÔNG mượn file của chuyến
 * nguồn (R5). Không gắn mục bước ⇒ không làm bước nào tự xong (R3).
 */
/** File chỉ-của-chuyến (không mục bước) theo loại: booking (0094), ảnh thực đóng / bao bì + cân gross (0097). Mới nhất đầu. */
export function shipmentFilesOf(d: Pick<ExportData, "files">, shipmentId: string, step: ExportFile["step"]): ExportFile[] {
  return d.files
    .filter((f) => f.shipmentId === shipmentId && f.step === step)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.fileName.localeCompare(b.fileName, "vi"));
}

export function bookingFilesOf(d: Pick<ExportData, "files">, shipmentId: string): ExportFile[] {
  return d.files
    .filter((f) => f.shipmentId === shipmentId && f.step === "booking")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.fileName.localeCompare(b.fileName, "vi"));
}

export function filesOfStep(d: Pick<ExportData, "files">, shipmentId: string, step: ExportStep): ExportFile[] {
  return d.files
    .filter((f) => f.shipmentId === shipmentId && f.step === step)
    .sort((a, b) => (a.layerNo ?? 9999) - (b.layerNo ?? 9999) || a.createdAt.localeCompare(b.createdAt));
}

/* ---------- R5: bằng chứng, dùng chung, trạng thái mục ---------- */

const shipmentById = (d: Pick<ExportData, "shipments">, id: string) => d.shipments.find((s) => s.id === id);

/** Mục gốc của một mục "dùng chung" — null nếu gốc mất / chuyến gốc đã hủy. */
export function sharedSource(d: Pick<ExportData, "items" | "shipments">, item: ExportStepItem): ExportStepItem | null {
  if (!item.sharedFromId) return null;
  const src = d.items.find((i) => i.id === item.sharedFromId);
  if (!src || src.sharedFromId) return null;
  const sh = shipmentById(d, src.shipmentId);
  return sh && sh.status === "open" ? src : null;
}

/** Trạng thái thật của một mục: dùng chung ⇒ theo mục gốc (gốc chưa xong / hủy ⇒ chưa làm). */
export function itemState(d: Pick<ExportData, "items" | "shipments">, item: ExportStepItem): ExportItemState {
  if (item.sharedFromId) return sharedSource(d, item)?.state === "done" ? "done" : "not-started";
  return item.state;
}

/** Mục được trỏ "dùng chung" tới: cùng bước (cùng loại chứng từ), đã xong, của chuyến khác cùng HĐ hoặc cùng booking. */
export function shareCandidates(d: Pick<ExportData, "items" | "shipments">, shipment: ExportShipment, item: ExportStepItem): ExportStepItem[] {
  const peers = d.shipments.filter(
    (s) =>
      s.id !== shipment.id &&
      s.status === "open" &&
      (s.contractId === shipment.contractId || (!!shipment.bookingNo.trim() && normalizeNo(s.bookingNo) === normalizeNo(shipment.bookingNo))),
  );
  const peerIds = new Set(peers.map((s) => s.id));
  return d.items.filter(
    (i) =>
      peerIds.has(i.shipmentId) &&
      !i.sharedFromId &&
      i.state === "done" &&
      i.step === item.step &&
      (item.step !== "document" || i.docKind === item.docKind),
  );
}

export interface MarkCheck {
  ok: boolean;
  reason?: "contract-not-approved" | "lines-unmapped" | "derived-from-files" | "missing-evidence" | "shared-source-not-done";
  /** Ô còn thiếu (khóa ổn định — màn đổi ra câu chữ). */
  missing: string[];
}

export const MISSING_LABELS: Record<string, string> = {
  file: "file đính kèm",
  fileOrNote: "file hoặc ghi chú",
  declarationNo: "số tờ khai",
  number: "số chứng từ",
  issuedOn: "ngày chứng từ",
  cartons: "tổng số thùng",
  netKg: "tổng kg tịnh",
  amount: "tổng tiền",
  onBoardDate: "ngày on board",
};

/** Mục có đủ bằng chứng để đánh dấu XONG chưa (bảng NV8 của ba-spec). */
export function canMarkDone(
  item: ExportStepItem,
  d: Pick<ExportData, "items" | "shipments" | "files" | "revisions" | "approvals">,
  opts: EvidenceOptions = WITH_FILES,
): MarkCheck {
  const shipment = shipmentById(d, item.shipmentId);
  if (item.step === "production-order" && shipment && !effectiveRevision(d, shipment.contractId))
    return { ok: false, reason: "contract-not-approved", missing: [] };
  // Lệnh SX phải biết mặt hàng thật: mọi dòng hàng của bản hiệu lực đã nối danh mục.
  if (item.step === "production-order" && shipment && unmappedLines(effectiveRevision(d, shipment.contractId)?.lines ?? []).length)
    return { ok: false, reason: "lines-unmapped", missing: [] };
  if (item.sharedFromId) {
    return sharedSource(d, item)?.state === "done"
      ? { ok: true, missing: [] }
      : { ok: false, reason: "shared-source-not-done", missing: [] };
  }
  if (item.step === "loading-plan" || item.step === "loading-photos") return { ok: false, reason: "derived-from-files", missing: [] };

  const hasFile = d.files.some((f) => f.stepItemId === item.id);
  const fileOk = hasFile || !opts.filesAvailable;
  const missing: string[] = [];
  switch (item.step) {
    case "production-order":
    case "export-order":
      if (!hasFile && !(!opts.filesAvailable && item.note.trim())) missing.push(opts.filesAvailable ? "file" : "fileOrNote");
      break;
    case "packaging":
      if (!hasFile && !item.note.trim()) missing.push("fileOrNote");
      break;
    case "customs-declaration":
      if (!item.number.trim()) missing.push("declarationNo");
      if (!fileOk) missing.push("file");
      break;
    case "document":
      // Chứng từ công ty tự cấp (VD H/C) thường không in số — khỏi bắt bịa số.
      if (!item.number.trim() && !isSelfIssued(item)) missing.push("number");
      if (!item.issuedOn) missing.push("issuedOn");
      if (!fileOk) missing.push("file");
      if (item.docKind === "commercial-invoice") {
        if (item.cartons == null) missing.push("cartons");
        if (item.netKg == null) missing.push("netKg");
        if (item.amount == null) missing.push("amount");
      }
      if (item.docKind === "bill-of-lading" && !item.onBoardDate) missing.push("onBoardDate");
      break;
  }
  return missing.length ? { ok: false, reason: "missing-evidence", missing } : { ok: true, missing };
}

export const isSelfIssued = (item: Pick<ExportStepItem, "docIssuer">) => /tự cấp/i.test(item.docIssuer);

/** Dòng hàng chưa nối mặt hàng danh mục (có nội dung mà chưa có productId). */
export function unmappedLines(lines: readonly ExportContractLine[]): ExportContractLine[] {
  return lines.filter((l) => (l.description.trim() || l.quantity != null) && !l.productId);
}

/**
 * "Trích xuất từ chứng từ" (NV16 · R26, chủ dự án 2026-10-22): quét MỌI hợp đồng xuất khẩu chưa hủy
 * của khách (bản đang dùng: hiệu lực, chưa có thì bản mới nhất), HĐ ký trước xét trước; dòng đã nối
 * mặt hàng mà (khách, mặt hàng) chưa có tên ⇒ tạo dòng tên. Không ghi đè; chặn trùng tên + size (R23).
 */
export function extractCustomerNamesFromContracts(
  d: Pick<ExportData, "contracts" | "revisions" | "approvals">,
  existing: readonly CustomerProductName[],
  customerId: string,
  newId: () => string,
): { created: CustomerProductName[]; contractCount: number } {
  const contracts = d.contracts
    .filter((c) => c.customerId === customerId && c.status !== "cancelled")
    .sort((a, b) => (a.signedOn || a.createdAt).localeCompare(b.signedOn || b.createdAt) || a.contractNo.localeCompare(b.contractNo));
  const created: CustomerProductName[] = [];
  for (const c of contracts) {
    const rev = workingRevision(d, c.id);
    if (!rev) continue;
    created.push(...extractCustomerNames([...existing, ...created], customerId, rev.lines, c.contractNo, newId));
  }
  return { created, contractCount: contracts.length };
}

/** Mặt hàng có tên tiếng Anh MẶC ĐỊNH (`products.trade_name`) khớp tên hàng trên HĐ (R23 bậc 4). */
export function productsByTradeName<P extends Pick<Product, "id" | "tradeName">>(description: string, products: readonly P[]): P[] {
  const key = nameKey(description);
  return key ? products.filter((p) => nameKey(p.tradeName) === key) : [];
}

/** Ngữ cảnh gợi ý theo khách (v6): size của dòng + danh sách tên hàng theo khách. */
export interface LineMatchContext {
  size?: string;
  names?: readonly Pick<CustomerProductName, "customerId" | "productId" | "tradeName" | "sizeText">[];
}

/**
 * Gợi ý mặt hàng cho một dòng hàng (R16 + R23 v6), lấy bậc đầu tiên ra ĐÚNG MỘT mặt hàng:
 * (1) tên của khách khớp tên + size · (2) tên của khách khớp tên · (3) lịch sử nối ở HĐ trước
 * (cùng khách trước, rồi bản mới nhất) · (4) tên tiếng Anh mặc định khớp. Không dịch máy.
 */
/** Nguồn của gợi ý mặt hàng — để người dùng biết vì sao app chọn (soát lại khi "gần giống"). */
export type ProductMatchSource = "customer-name" | "previous-contract" | "trade-name";
export interface ProductMatch {
  productId: string;
  source: ProductMatchSource;
  /** Khớp theo khóa GẦN ĐÚNG (bỏ dấu, dấu câu, "gr" = "g"…) chứ không trùng nguyên văn. */
  loose: boolean;
}

export const PRODUCT_MATCH_SOURCE_LABELS: Record<ProductMatchSource, string> = {
  "customer-name": "tên hàng của khách",
  "previous-contract": "hợp đồng trước",
  "trade-name": "tên thương mại của mặt hàng",
};

/**
 * Gợi ý mặt hàng cho một dòng HĐ: (1) tên hàng của khách (+ size) → (2) dòng HĐ trước cùng tên (+ size), ưu tiên cùng
 * khách, mới nhất → (3) tên thương mại. Mỗi bậc thử nguyên văn trước (`nameKey`), rồi gần đúng (`looseNameKey`).
 * Nhiều mặt hàng cùng khớp ở một bậc ⇒ không đoán (null).
 */
export function suggestProductMatch(
  d: Pick<ExportData, "contracts" | "revisions">,
  description: string,
  customerId: string,
  products: readonly Pick<Product, "id" | "tradeName">[] = [],
  ctx: LineMatchContext = {},
): ProductMatch | null {
  if (!nameKey(description)) return null;
  for (const [keyOf, loose] of [[nameKey, false], [looseNameKey, true]] as const) {
    const key = keyOf(description);
    const byCustomer = productsByCustomerName(ctx.names ?? [], customerId, description, ctx.size ?? "", keyOf);
    if (byCustomer.productIds.length === 1) return { productId: byCustomer.productIds[0], source: "customer-name", loose };
    if (byCustomer.productIds.length > 1) return null;
    const customerOf = new Map(d.contracts.map((c) => [c.id, c.customerId]));
    let best: { productId: string; score: number; at: string } | null = null;
    const lineSize = keyOf(ctx.size ?? "");
    for (const r of d.revisions) {
      for (const l of r.lines) {
        if (!l.productId || keyOf(l.description) !== key) continue;
        // Cùng tên khác size ⇒ thường là mặt hàng khác (iwadako 5-5.5 gr ≠ 6-7 gr) — không lấy làm gợi ý.
        if (lineSize && keyOf(l.size) && keyOf(l.size) !== lineSize) continue;
        const score = customerOf.get(r.contractId) === customerId ? 1 : 0;
        if (!best || score > best.score || (score === best.score && r.createdAt > best.at)) best = { productId: l.productId, score, at: r.createdAt };
      }
    }
    if (best) return { productId: best.productId, source: "previous-contract", loose };
    const byTrade = products.filter((p) => keyOf(p.tradeName) === key);
    if (byTrade.length === 1) return { productId: byTrade[0].id, source: "trade-name", loose };
    if (byTrade.length > 1) return null;
  }
  return null;
}

export function suggestProductId(
  d: Pick<ExportData, "contracts" | "revisions">,
  description: string,
  customerId: string,
  products: readonly Pick<Product, "id" | "tradeName">[] = [],
  ctx: LineMatchContext = {},
): string {
  return suggestProductMatch(d, description, customerId, products, ctx)?.productId ?? "";
}

/**
 * Ghi nối dòng hàng ↔ mặt hàng vào MỘT bản (thông tin nội bộ, không phải bản sửa HĐ):
 * - Dòng không có trong `map` (nháp cũ mở lại sau khi bản đã đổi) GIỮ nối đang có — không xóa nhầm.
 * - Các bản MỚI HƠN của cùng HĐ (bản số lớn hơn) nhận nối cho dòng cùng tên + size đang TRỐNG — bản sửa
 *   không bị "chưa nối" lại. Dòng đã nối khác giữ nguyên.
 */
export function applyProductMapping(
  revisions: readonly ExportContractRevision[],
  revisionId: string,
  map: Readonly<Record<string, string>>,
): ExportContractRevision[] {
  const target = revisions.find((r) => r.id === revisionId);
  if (!target) return [...revisions];
  const mapped = target.lines.map((l) => (l.id in map ? { ...l, productId: map[l.id] || undefined } : l));
  const lineKey = (l: Pick<ExportContractLine, "description" | "size">) => `${nameKey(l.description)}|${nameKey(l.size)}`;
  const byKey = new Map(mapped.filter((l) => l.productId).map((l) => [lineKey(l), l.productId as string]));
  return revisions.map((r) => {
    if (r.id === revisionId) return { ...r, lines: mapped };
    if (r.contractId !== target.contractId || r.revisionNo <= target.revisionNo) return r;
    return { ...r, lines: r.lines.map((l) => (l.productId || !byKey.has(lineKey(l)) ? l : { ...l, productId: byKey.get(lineKey(l)) })) };
  });
}

/** Danh sách chọn mặt hàng cho một dòng: mục khớp tên của khách, rồi khớp tên mặc định, đứng đầu (R23). */
export function rankProductsForLine<P extends Pick<Product, "id" | "tradeName">>(
  description: string,
  products: readonly P[],
  customerId = "",
  ctx: LineMatchContext = {},
): P[] {
  const first = new Set([
    ...productsByCustomerName(ctx.names ?? [], customerId, description, ctx.size ?? "").productIds,
    ...productsByTradeName(description, products).map((p) => p.id),
  ]);
  return [...products.filter((p) => first.has(p.id)), ...products.filter((p) => !first.has(p.id))];
}

export function canMarkNotApplicable(_item: ExportStepItem, reason: string): { ok: boolean } {
  return { ok: reason.trim().length > 0 };
}

/* ---------- Trạng thái bước ---------- */

/** Chuyến tạo trước ngày này mà đã xong bước 4 cũ / có B/L ⇒ mục SI "Không áp dụng" (ba-spec 72 R14). */
export const SHIPPING_INSTRUCTION_SINCE = "2026-11-05";
const SI_KINDS: ReadonlySet<ExportShipment["kind"]> = new Set(["20RF", "40RF", "40HC-RF"]);

/**
 * Vì sao mục SI "Không áp dụng" (ba-spec 72 R10, R14) — null = SI là mục phải làm (hoặc đã có file):
 * `kind` xe tải / đóng ghép · `old-bl` chuyến tạo trước `SHIPPING_INSTRUCTION_SINCE` đã có B/L Xong ·
 * `old-loading` chuyến tạo trước mốc đã xong 4 mục cũ của bước 4 + số cont / seal. Chuyến cũ vẫn lập SI được.
 */
export type ShippingInstructionExemption = "kind" | "old-bl" | "old-loading";
export function shippingInstructionExemption(
  d: Pick<ExportData, "items" | "shipments" | "files" | "issuedOrderShipmentIds">,
  shipment: ExportShipment,
): ShippingInstructionExemption | null {
  if (!SI_KINDS.has(shipment.kind)) return "kind";
  if (shipmentFilesOf(d, shipment.id, "shipping-instruction").length) return null;
  if (!shipment.createdAt || shipment.createdAt >= SHIPPING_INSTRUCTION_SINCE) return null;
  if (documentItems(d, shipment.id).some((i) => i.docKind === "bill-of-lading" && itemState(d, i) === "done")) return "old-bl";
  if (LOADING_STEPS.every((st) => settled(subStepState(d, shipment.id, st))) && containerIdentityOk(shipment)) return "old-loading";
  return null;
}

/**
 * Mục SI của bước 4 (ba-spec 72 R10, R13, R14): Xong khi có file SI; xe tải / đóng ghép ⇒ Không áp dụng; chuyến cũ
 * (tạo trước `SHIPPING_INSTRUCTION_SINCE`) đã xong 4 mục cũ + số cont / seal, hoặc đã có B/L Xong ⇒ Không áp dụng
 * cho tới khi lập SI (lập rồi ⇒ Xong).
 */
export function shippingInstructionState(
  d: Pick<ExportData, "items" | "shipments" | "files" | "issuedOrderShipmentIds">,
  shipment: ExportShipment,
): ExportItemState {
  if (shippingInstructionExemption(d, shipment)) return "not-applicable";
  return shipmentFilesOf(d, shipment.id, "shipping-instruction").length ? "done" : "not-started";
}

/** Cont + seal đã điền (xe tải: biển số; đóng ghép: không cần). */
export function containerIdentityOk(s: Pick<ExportShipment, "kind" | "containerNo" | "sealNo">): boolean {
  if (s.kind === "consolidated") return true;
  if (s.kind === "truck") return !!s.containerNo.trim();
  return !!s.containerNo.trim() && !!s.sealNo.trim();
}

const settled = (st: ExportItemState) => st === "done" || st === "not-applicable";

/** Mốc bắt ảnh cont / seal (ba-spec 72 R8 v1.7, Phòng KH 2026-11-04) — chuyến tạo trước mốc đã đóng xong thì không bắt. */
export const CONTAINER_SEAL_PHOTO_SINCE = "2026-11-05";

type SealData = Pick<ExportData, "items" | "shipments" | "files" | "issuedOrderShipmentIds" | "shippingInstructionEnabled" | "shipmentContainers">;

/**
 * Hàng Số cont + seal phải có ≥ 1 ảnh mới Xong (R8 v1.7). Không bắt: đóng ghép · máy chủ chưa chạy 0103 (chưa đính được
 * ảnh) · chuyến tạo trước `CONTAINER_SEAL_PHOTO_SINCE` đã có B/L Xong hoặc đã xong 4 mục cũ của bước 4 + số cont / seal.
 */
export function containerSealPhotoRequired(d: SealData, s: ExportShipment): boolean {
  if (s.kind === "consolidated" || !d.shippingInstructionEnabled) return false;
  if (!s.createdAt || s.createdAt >= CONTAINER_SEAL_PHOTO_SINCE) return true;
  if (documentItems(d, s.id).some((i) => i.docKind === "bill-of-lading" && itemState(d, i) === "done")) return false;
  return !(LOADING_STEPS.every((st) => settled(subStepState(d, s.id, st))) && containerIdentityOk(s));
}

/**
 * Hàng Số cont + seal (biển số xe): Xong khi đã điền số VÀ (đã đính ảnh hoặc không bắt ảnh). Chuyến nhiều cont
 * (ba-spec 73 R6): MỌI cont đủ số + seal + (≥ 1 ảnh của cont đó khi bắt ảnh); ảnh không gắn cont = cont 1.
 */
export function containerSealState(d: SealData, s: ExportShipment): ExportItemState {
  if (s.kind === "consolidated") return "not-applicable";
  const conts = shipmentContainers(d, s);
  const photos = shipmentFilesOf(d, s.id, "container-seal-photos");
  const needPhoto = containerSealPhotoRequired(d, s);
  const per = conts.map((c) => ({
    filled: containerIdentityOk({ kind: s.kind === "truck" ? "truck" : c.kind, containerNo: c.containerNo, sealNo: c.sealNo }),
    photo: filesOfContainer(photos, conts, c.id).length > 0,
    touched: !!c.containerNo.trim() || !!c.sealNo.trim(),
  }));
  if (per.every((c) => c.filled && (c.photo || !needPhoto))) return "done";
  return per.some((c) => c.filled || c.photo || c.touched) ? "in-progress" : "not-started";
}

/** Trạng thái một mục con (bước 2, 3, 4a–4d). 4a / 4b tự xong khi có file (R10). */
export function subStepState(
  d: Pick<ExportData, "items" | "shipments" | "files" | "issuedOrderShipmentIds">,
  shipmentId: string,
  step: ExportStep,
): ExportItemState {
  // R6 (ba-spec 48, Q6 = A): Lệnh sản xuất đã phát hành gắn chuyến ⇒ xong; không thì luật cũ (file / dùng chung).
  if (step === "production-order" && d.issuedOrderShipmentIds?.has(shipmentId)) return "done";
  const item = stepItem(d, shipmentId, step);
  if (step === "loading-plan" || step === "loading-photos") {
    if (filesOfStep(d, shipmentId, step).length) return "done";
    return item?.state === "not-applicable" ? "not-applicable" : "not-started";
  }
  if (!item) return "not-started";
  return itemState(d, item);
}

function aggregate(states: ExportItemState[]): ExportItemState {
  if (!states.length) return "not-started";
  if (states.every((s) => s === "not-applicable")) return "not-applicable";
  if (states.every(settled)) return "done";
  return states.some((s) => s !== "not-started") ? "in-progress" : "not-started";
}

/** Hồ sơ đính kèm cấp HĐ (bước Đính kèm), cũ trước. */
export function contractAttachments(d: Pick<ExportData, "files">, contractId: string): ExportFile[] {
  return d.files.filter((f) => f.contractId === contractId && f.step === "contract").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Loại hồ sơ BẮT BUỘC theo điều khoản: hợp đồng đã ký luôn có; L/C khi thanh toán bằng L/C. */
export function requiredAttachmentKinds(terms: Pick<ExportContractTerms, "paymentMethod">): ExportContractAttachmentKind[] {
  return terms.paymentMethod === "lc" ? ["signed-contract", "lc"] : ["signed-contract"];
}

/**
 * HĐ đã có hợp đồng ký theo quy trình CŨ (trước mig 0079: nhân viên ghi kết quả BGĐ ký giấy — lượt duyệt
 * không có `stage`): một bản BẤT KỲ của HĐ được duyệt kiểu cũ và có file (bản HĐ hoặc bản ký scan).
 * Xét mọi bản, không chỉ bản hiệu lực — bản sửa duyệt theo cách mới sau 0079 không làm HĐ cũ tụt về
 * "Chờ đính kèm".
 */
function hasLegacySignedContract(d: Pick<ExportData, "revisions" | "approvals">, contractId: string): boolean {
  return revisionsOf(d, contractId).some((rev) => {
    const xs = approvalsOf(d, rev.id).filter((a) => a.decision === "approved" && !a.stage);
    return xs.length > 0 && (!!rev.filePath || xs.some((a) => !!a.filePath));
  });
}

/** File đã có trên HĐ có thể là `kind` mà đính khác loại: file đính loại "khác" · file của các bản HĐ (thường là bản ký). */
export interface AttachmentCandidate {
  source: "attachment" | "revision";
  /** id file đính (source attachment) — đổi loại tại chỗ. */
  fileId: string;
  path: string;
  fileName: string;
  /** "Phụ lục / file kèm" · "File của bản 1"… — để người dùng nhận ra file. */
  where: string;
}

/**
 * Ứng viên cho loại hồ sơ còn thiếu (Phòng KH 2026-11-04: đính hợp đồng ký nhầm loại "Phụ lục / file kèm", hoặc đã
 * đính ở file của bản HĐ ⇒ app vẫn báo Thiếu). Bỏ file đã đính đúng loại (cùng đường dẫn); bản HĐ cùng file ⇒ một lần.
 */
export function attachmentCandidates(d: Pick<ExportData, "files" | "revisions">, contractId: string, kind: ExportContractAttachmentKind): AttachmentCandidate[] {
  const atts = contractAttachments(d, contractId);
  const taken = new Set(atts.filter((f) => f.attachmentKind === kind).map((f) => f.path));
  const out: AttachmentCandidate[] = [];
  for (const f of atts)
    if ((f.attachmentKind ?? "other") === "other" && !taken.has(f.path))
      out.push({ source: "attachment", fileId: f.id, path: f.path, fileName: f.fileName, where: CONTRACT_ATTACHMENT_LABELS.other });
  for (const r of revisionsOf(d, contractId).reverse())
    if (r.filePath && !taken.has(r.filePath) && !out.some((x) => x.path === r.filePath))
      out.push({ source: "revision", fileId: "", path: r.filePath, fileName: r.fileName || "File hợp đồng", where: `File của bản ${r.revisionNo}` });
  return out;
}

/**
 * Loại hồ sơ bắt buộc CÒN THIẾU của bản hiệu lực. Chưa có bản hiệu lực ⇒ chưa tới bước này (rỗng).
 * Chạy không nối máy chủ ⇒ không tải được file ⇒ không bắt (như các bước khác).
 */
export function missingAttachmentKinds(
  d: Pick<ExportData, "files" | "revisions" | "approvals">,
  contractId: string,
  opts: EvidenceOptions = WITH_FILES,
): ExportContractAttachmentKind[] {
  const eff = effectiveRevision(d, contractId);
  if (!eff || !opts.filesAvailable) return [];
  const have = new Set<string>(contractAttachments(d, contractId).map((f) => f.attachmentKind ?? ""));
  if (hasLegacySignedContract(d, contractId)) have.add("signed-contract");
  return requiredAttachmentKinds(eff.terms).filter((k) => !have.has(k));
}

/* ---------- ba-spec 58: hồ sơ bắt buộc "bổ sung sau" (mig 0093) ---------- */

/** Tình trạng một loại hồ sơ bắt buộc của HĐ: Có file · Bổ sung sau (có lý do) · Thiếu (R1). */
export type AttachmentStatus = "has-file" | "deferred" | "missing";

export const ATTACHMENT_STATUS_LABELS: Record<AttachmentStatus, string> = {
  "has-file": "Có file",
  deferred: "Bổ sung sau",
  missing: "Thiếu",
};

/** Chữ của bước 1 trên thanh tiến độ khi hồ sơ đang "bổ sung sau" (R5). */
export const DEFERRED_STEP_TEXT: Partial<Record<ExportContractAttachmentKind, string>> = {
  "signed-contract": "chờ HĐ ký",
  lc: "chờ L/C",
};

const deferralsOf = (d: Pick<ExportData, "contracts">, contractId: string) => d.contracts.find((c) => c.id === contractId)?.attachmentDeferrals ?? {};

/** Loại bắt buộc chưa có file NHƯNG đã ghi "bổ sung sau" (có lý do). */
export function deferredAttachmentKinds(
  d: Pick<ExportData, "contracts" | "files" | "revisions" | "approvals">,
  contractId: string,
  opts: EvidenceOptions = WITH_FILES,
): ExportContractAttachmentKind[] {
  const def = deferralsOf(d, contractId);
  return missingAttachmentKinds(d, contractId, opts).filter((k) => !!def[k]?.reason.trim());
}

/** Loại bắt buộc chưa có file VÀ chưa ghi "bổ sung sau" — CHỈ những loại này chặn ghi chuyến (R3, R4). */
export function blockingAttachmentKinds(
  d: Pick<ExportData, "contracts" | "files" | "revisions" | "approvals">,
  contractId: string,
  opts: EvidenceOptions = WITH_FILES,
): ExportContractAttachmentKind[] {
  const def = deferralsOf(d, contractId);
  return missingAttachmentKinds(d, contractId, opts).filter((k) => !def[k]?.reason.trim());
}

/** Tình trạng một loại hồ sơ bắt buộc (R1). Loại không bắt buộc theo điều khoản ⇒ "has-file" (không cần). */
export function attachmentStatus(
  d: Pick<ExportData, "contracts" | "files" | "revisions" | "approvals">,
  contractId: string,
  kind: ExportContractAttachmentKind,
  opts: EvidenceOptions = WITH_FILES,
): AttachmentStatus {
  if (!missingAttachmentKinds(d, contractId, opts).includes(kind)) return "has-file";
  return deferralsOf(d, contractId)[kind]?.reason.trim() ? "deferred" : "missing";
}

/** Kiểm lý do "bổ sung sau" (R2): bắt buộc, không rỗng. */
export function validateDeferral(reason: string): ValidationIssue[] {
  return reason.trim() ? [] : [{ key: "reason", label: "Lý do", message: "Ghi lý do chưa có hồ sơ (vd khách chưa gửi bản ký, L/C chưa mở)" }];
}

/** HĐ sau khi ghi (deferral) hoặc gỡ (null) dấu "bổ sung sau" của MỘT loại. Gỡ hết ⇒ `{}` (vẫn gửi cột để xóa trên máy chủ). */
export function withDeferral(c: ExportContract, kind: ExportContractAttachmentKind, deferral: AttachmentDeferral | null): ExportContract {
  const next = { ...(c.attachmentDeferrals ?? {}) };
  if (deferral) next[kind] = { ...deferral, reason: deferral.reason.trim() };
  else delete next[kind];
  return { ...c, attachmentDeferrals: next };
}

/** Bước 1 của chuyến theo HĐ: có bản hiệu lực VÀ đã đính kèm đủ hồ sơ bắt buộc (mig 0079; trước là "có file ký" — A4). */
export function contractStepState(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ExportItemState {
  const eff = effectiveRevision(d, contractId);
  if (eff && !missingAttachmentKinds(d, contractId, opts).length) return "done";
  return latestRevision(d, contractId) ? "in-progress" : "not-started";
}

export function stepState(d: ExportData, shipment: ExportShipment, step: StepNo, opts: EvidenceOptions = WITH_FILES): ExportItemState {
  switch (step) {
    case 1:
      // Chuyến gộp: bước Hợp đồng xong khi MỌI HĐ của chuyến đủ hồ sơ (ba-spec 70 R5).
      return aggregate(shipmentContractIds(d, shipment).map((id) => contractStepState(d, id, opts)));
    case 2:
      return subStepState(d, shipment.id, "production-order");
    case 3:
      return subStepState(d, shipment.id, "packaging");
    case 4: {
      const subs = LOADING_STEPS.map((s) => subStepState(d, shipment.id, s));
      if (d.shippingInstructionEnabled) subs.push(shippingInstructionState(d, shipment));
      const agg = aggregate(subs);
      const seal = containerSealState(d, shipment);
      if (agg === "done" || agg === "not-applicable") return settled(seal) ? "done" : "in-progress";
      return agg === "not-started" && (seal === "in-progress" || seal === "done") ? "in-progress" : agg;
    }
    case 5:
      return aggregate(documentItems(d, shipment.id).map((i) => itemState(d, i)));
    case 6: {
      const ps = d.payments.filter((p) => p.shipmentId === shipment.id);
      if (!ps.length) return "not-started";
      const sent = ps.some((p) => p.kind === "documents-sent");
      const paid = shipmentPaymentSummary(d, shipment).received;
      const due = shipmentActuals(d, shipment.id).amount;
      return sent && due > 0 && paid + EPS >= due ? "done" : "in-progress";
    }
  }
}

/** Chuyến khép khi bước 2–5 xong / không áp dụng (bước 6 không tính — Q5). */
export function isShipmentClosed(d: ExportData, shipment: ExportShipment, opts: EvidenceOptions = WITH_FILES): boolean {
  if (shipment.status !== "open") return false;
  return ([2, 3, 4, 5] as StepNo[]).every((n) => settled(stepState(d, shipment, n, opts)));
}

/* ---------- Thực xuất (R7), tiền về ---------- */

export interface Actuals {
  cartons: number;
  kg: number;
  amount: number;
}

/** Thực xuất của chuyến = Σ Commercial Invoice CỦA CHUYẾN (không hàng mẫu "M", không B/L, không mục dùng chung). */
export function shipmentActuals(d: Pick<ExportData, "items">, shipmentId: string): Actuals {
  return d.items
    .filter((i) => i.shipmentId === shipmentId && i.step === "document" && i.docKind === "commercial-invoice" && !i.sharedFromId)
    .reduce<Actuals>(
      (t, i) => ({ cartons: t.cartons + numOr0(i.cartons), kg: round2(t.kg + numOr0(i.netKg)), amount: round2(t.amount + numOr0(i.amount)) }),
      { cartons: 0, kg: 0, amount: 0 },
    );
}

/* ---------- ba-spec 70: một chuyến chở hàng của nhiều HĐ cùng khách ---------- */

type LineData = Pick<ExportData, "shipmentLines">;
const lineContractsCache = new WeakMap<readonly ExportShipmentLine[], Map<string, Set<string>>>();
const NO_LINE_CONTRACTS = new Map<string, Set<string>>();

/** id chuyến → HĐ của các dòng hàng (dòng không ghi HĐ bỏ qua). Nhớ theo mảng dòng để vòng lặp báo cáo không lọc lại. */
function lineContractsByShipment(lines: readonly ExportShipmentLine[] | undefined): Map<string, Set<string>> {
  if (!lines?.length) return NO_LINE_CONTRACTS;
  let m = lineContractsCache.get(lines);
  if (m) return m;
  m = new Map();
  for (const l of lines) {
    if (!l.contractId) continue;
    let set = m.get(l.shipmentId);
    if (!set) m.set(l.shipmentId, (set = new Set()));
    set.add(l.contractId);
  }
  lineContractsCache.set(lines, m);
  return m;
}

/** HĐ của chuyến (R1): HĐ chính của chuyến đứng đầu, rồi HĐ của các dòng hàng. Chuyến cũ chưa có dòng ⇒ chỉ HĐ chính (R2). */
export function shipmentContractIds(d: LineData, s: Pick<ExportShipment, "id" | "contractId">): string[] {
  const ids = [s.contractId];
  for (const id of lineContractsByShipment(d.shipmentLines).get(s.id) ?? []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export const isMultiContractShipment = (d: LineData, s: Pick<ExportShipment, "id" | "contractId">) => shipmentContractIds(d, s).length > 1;

/** Chuyến có hàng của HĐ: là HĐ chính của chuyến hoặc có ≥ 1 dòng thuộc HĐ. */
export function carriesContract(d: LineData, s: Pick<ExportShipment, "id" | "contractId">, contractId: string): boolean {
  return s.contractId === contractId || !!lineContractsByShipment(d.shipmentLines).get(s.id)?.has(contractId);
}

/** Chuyến còn mở có hàng của HĐ (kể cả chuyến gộp mà HĐ chỉ là một phần — R6), cũ trước. */
export function openShipmentsOf(d: Pick<ExportData, "shipments" | "shipmentLines">, contractId: string): ExportShipment[] {
  return d.shipments
    .filter((s) => s.status === "open" && carriesContract(d, s, contractId))
    .sort((a, b) => (a.loadingDate || a.etd || a.planMonth).localeCompare(b.loadingDate || b.etd || b.planMonth) || a.createdAt.localeCompare(b.createdAt));
}

const ZERO_ACTUALS: Actuals = { cartons: 0, kg: 0, amount: 0 };
const linePerUnitKg = (l: Pick<ExportShipmentLine, "unitKind" | "cartonsPerUnit" | "netKgPerCarton">) =>
  l.netKgPerCarton == null ? null : (l.unitKind === "bundle" ? l.cartonsPerUnit || 1 : 1) * l.netKgPerCarton;

/**
 * Phần của MỘT HĐ trong chuyến (R3). Chuyến chỉ một HĐ ⇒ cả chuyến theo Commercial Invoice (41 R7, như cũ). Chuyến gộp ⇒
 * cộng từ dòng hàng của HĐ: kiện = thực đóng ?? kế hoạch, kg = kiện × kg/kiện, tiền = kg × đơn giá (sửa ở phần lập invoice
 * ⇒ số đó, không ⇒ đơn giá dòng HĐ đang dùng). Invoice gộp không tách được theo HĐ nên không dùng ở đây.
 */
export function shipmentContractActuals(d: Pick<ExportData, "items" | "shipmentLines" | "revisions" | "approvals">, s: ExportShipment, contractId: string): Actuals {
  if (!isMultiContractShipment(d, s)) return s.contractId === contractId ? shipmentActuals(d, s.id) : ZERO_ACTUALS;
  const comp = d.items.find((i) => i.shipmentId === s.id && i.step === "document" && i.docKind === "commercial-invoice" && !i.sharedFromId)?.invoiceComposition;
  const prices = new Map((workingRevision(d, contractId)?.lines ?? []).map((l) => [l.id, l.unitPrice]));
  return (d.shipmentLines ?? [])
    .filter((l) => l.shipmentId === s.id && (l.contractId || s.contractId) === contractId)
    .reduce<Actuals>((t, l) => {
      const units = l.loadedUnits ?? l.plannedUnits;
      const per = linePerUnitKg(l);
      if (units == null) return t;
      const kg = per == null ? 0 : units * per;
      const own = comp?.unitPrices[l.id];
      const price = typeof own === "number" && Number.isFinite(own) ? own : (prices.get(l.contractLineId) ?? null);
      const cartons = units * (l.unitKind === "bundle" ? l.cartonsPerUnit || 1 : 1);
      return { cartons: t.cartons + cartons, kg: round2(t.kg + kg), amount: round2(t.amount + (price == null ? 0 : kg * price)) };
    }, ZERO_ACTUALS);
}

export function contractActuals(d: Pick<ExportData, "items" | "shipments" | "shipmentLines" | "revisions" | "approvals">, contractId: string): Actuals {
  return openShipmentsOf(d, contractId).reduce<Actuals>((t, s) => {
    const a = shipmentContractActuals(d, s, contractId);
    return { cartons: t.cartons + a.cartons, kg: round2(t.kg + a.kg), amount: round2(t.amount + a.amount) };
  }, ZERO_ACTUALS);
}

export type AddContractGate = { ok: true } | { ok: false; reason: "customer-mismatch" | "same-contract" | "not-open" | "no-revision" | "attachments-missing"; missing: ExportContractAttachmentKind[] };

/**
 * Thêm hàng của HĐ khác vào chuyến (R1, R4): HĐ phải cùng khách với HĐ chính của chuyến và qua cổng ghi chuyến
 * (`shipmentGate`: còn mở, có bản hiệu lực, không còn hồ sơ bắt buộc "Thiếu").
 */
export function addContractGate(d: ExportData, s: Pick<ExportShipment, "contractId">, contractId: string, opts: EvidenceOptions = WITH_FILES): AddContractGate {
  if (contractId === s.contractId) return { ok: false, reason: "same-contract", missing: [] };
  const main = d.contracts.find((c) => c.id === s.contractId);
  const other = d.contracts.find((c) => c.id === contractId);
  if (!main || !other || main.customerId !== other.customerId) return { ok: false, reason: "customer-mismatch", missing: [] };
  const g = shipmentGate(d, contractId, opts);
  return g.ok ? { ok: true } : { ok: false, reason: g.reason, missing: g.missing };
}

/** Kg kế hoạch của HĐ trên chuyến: chuyến một HĐ ⇒ kg kế hoạch của chuyến; chuyến gộp ⇒ Σ kiện kế hoạch × kg/kiện của dòng HĐ. */
export function shipmentContractPlannedKg(d: LineData, s: ExportShipment, contractId: string): number {
  if (!isMultiContractShipment(d, s)) return s.contractId === contractId ? numOr0(s.plannedKg) : 0;
  return round2(
    (d.shipmentLines ?? [])
      .filter((l) => l.shipmentId === s.id && (l.contractId || s.contractId) === contractId)
      .reduce((t, l) => t + numOr0(l.plannedUnits) * numOr0(linePerUnitKg(l)), 0),
  );
}

const lineKey = (l: ExportContractLine) => [l.productId ?? "", l.size, l.description].map((x) => x.trim().toLowerCase()).join("|");

/**
 * Dòng của bản HĐ `to` tương ứng dòng `lineId` của bản `from` — trước 2026-11-04 mỗi bản sửa cấp id mới cho mọi dòng
 * (hàng của chuyến lập trước bản sửa mất nối ⇒ đơn giá 0, KAISEI 04-26-KMP). Khớp mặt hàng + size + tên; không duy nhất
 * thì cùng vị trí khi cùng mặt hàng hoặc cùng tên; không được ⇒ null.
 */
export function matchLineAcrossRevisions(from: readonly ExportContractLine[], to: readonly ExportContractLine[], lineId: string): ExportContractLine | null {
  const idx = from.findIndex((l) => l.id === lineId);
  if (idx < 0) return null;
  const old = from[idx];
  const same = to.filter((l) => lineKey(l) === lineKey(old));
  if (same.length === 1) return same[0];
  const at = to[idx];
  if (at && ((old.productId && at.productId === old.productId) || at.description.trim().toLowerCase() === old.description.trim().toLowerCase())) return at;
  return null;
}

/** Id dòng của bản HĐ đang dùng ứng với `lineId` (có thể là id của bản cũ); không khớp được ⇒ giữ `lineId`. */
export function currentContractLineId(d: Pick<ExportData, "revisions" | "approvals">, contractId: string, lineId: string): string {
  const cur = workingRevision(d, contractId);
  if (!lineId || !cur || cur.lines.some((x) => x.id === lineId)) return lineId;
  const from = revisionsOf(d, contractId)
    .filter((r) => r.id !== cur.id)
    .reverse()
    .find((r) => r.lines.some((x) => x.id === lineId));
  return (from && matchLineAcrossRevisions(from.lines, cur.lines, lineId)?.id) || lineId;
}

/**
 * Hàng của chuyến còn trỏ id dòng của bản HĐ cũ ⇒ trỏ sang dòng tương ứng của bản đang dùng, để đơn giá / size / HS /
 * đã giao theo dòng HĐ đúng. Lần lưu sau ghi id mới. Không khớp được ⇒ giữ nguyên.
 */
export function remapLegacyContractLineIds(
  d: Pick<ExportData, "revisions" | "approvals" | "shipments">,
  lines: readonly ExportShipmentLine[],
): ExportShipmentLine[] {
  const shipContract = new Map(d.shipments.map((s) => [s.id, s.contractId]));
  let changed = false;
  const out = lines.map((l) => {
    const to = currentContractLineId(d, l.contractId || shipContract.get(l.shipmentId) || "", l.contractLineId);
    if (to === l.contractLineId) return l;
    changed = true;
    return { ...l, contractLineId: to };
  });
  return changed ? out : (lines as ExportShipmentLine[]);
}

/** Dòng HĐ (bản đang dùng) của mọi HĐ trên chuyến — tra đơn giá, nối dòng invoice. Id dòng HĐ không trùng giữa các HĐ. */
export function shipmentContractLines(d: Pick<ExportData, "shipmentLines" | "revisions" | "approvals">, s: Pick<ExportShipment, "id" | "contractId">): ExportContractLine[] {
  return shipmentContractIds(d, s).flatMap((id) => workingRevision(d, id)?.lines ?? []);
}

/**
 * Dòng chuyến để in chứng từ (Q3 ba-spec 70: một bộ cho chuyến, mỗi dòng ghi số HĐ gốc): chuyến gộp ⇒ tên hàng thêm
 * "(Contract No. …)"; chuyến một HĐ ⇒ giữ nguyên.
 */
export function linesWithContractNo(d: Pick<ExportData, "shipmentLines" | "contracts">, s: Pick<ExportShipment, "id" | "contractId">, lines: readonly ExportShipmentLine[]): ExportShipmentLine[] {
  if (!isMultiContractShipment(d, s)) return [...lines];
  const noOf = new Map(d.contracts.map((c) => [c.id, c.contractNo.trim()]));
  return lines.map((l) => {
    const no = noOf.get(l.contractId || s.contractId);
    return no ? { ...l, description: `${l.description} (Contract No. ${no})` } : l;
  });
}

/** id dòng HĐ → id HĐ, cho mọi HĐ trên chuyến — dòng đóng cont tự tạo ghi đúng HĐ (ba-spec 70 R9). */
export function lineContractOf(d: Pick<ExportData, "shipmentLines" | "revisions" | "approvals">, s: Pick<ExportShipment, "id" | "contractId">): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of shipmentContractIds(d, s)) for (const l of workingRevision(d, id)?.lines ?? []) out[l.id] = id;
  return out;
}

/** HĐ khác của cùng khách thêm hàng vào chuyến được — cho hộp Hàng của chuyến. Đã có trong chuyến thì bỏ. */
export function addableContracts(d: ExportData, s: ExportShipment, opts: EvidenceOptions = WITH_FILES): ExportContract[] {
  const inShip = new Set(shipmentContractIds(d, s));
  return d.contracts
    .filter((c) => !inShip.has(c.id) && addContractGate(d, s, c.id, opts).ok)
    .sort((a, b) => a.contractNo.localeCompare(b.contractNo, "vi"));
}

export function shipmentPaymentSummary(d: Pick<ExportData, "payments" | "items">, shipment: Pick<ExportShipment, "id">): { received: number; expected: number; documentsSentOn: string } {
  const ps = d.payments.filter((p) => p.shipmentId === shipment.id);
  const sent = ps.filter((p) => p.kind === "documents-sent").map((p) => p.date).sort();
  return {
    received: round2(ps.filter((p) => p.kind === "payment").reduce((t, p) => t + numOr0(p.amount), 0)),
    expected: shipmentActuals(d, shipment.id).amount,
    documentsSentOn: sent[sent.length - 1] ?? "",
  };
}

/** Tiền về của cả HĐ (cọc cấp HĐ + các chuyến) so với tổng tiền thực xuất. */
export function contractPaymentSummary(d: ExportData, contractId: string): { received: number; expected: number } {
  // Tiền về ghi theo chuyến; chuyến gộp ⇒ phần của HĐ = tiền về × tiền dòng của HĐ ÷ tiền cả chuyến (ba-spec 70 NL7).
  const share = new Map<string, number>();
  for (const s of d.shipments) {
    if (!carriesContract(d, s, contractId)) continue;
    if (!isMultiContractShipment(d, s)) share.set(s.id, 1);
    else {
      const all = shipmentContractIds(d, s).reduce((t, id) => t + shipmentContractActuals(d, s, id).amount, 0);
      share.set(s.id, all > 0 ? shipmentContractActuals(d, s, contractId).amount / all : 0);
    }
  }
  const received = d.payments
    .filter((p) => p.kind === "payment")
    .reduce((t, p) => {
      if (p.shipmentId) return t + numOr0(p.amount) * (share.get(p.shipmentId) ?? 0);
      return p.contractId === contractId ? t + numOr0(p.amount) : t;
    }, 0);
  return { received: round2(received), expected: contractActuals(d, contractId).amount };
}

/* ---------- R15: trễ hạn ---------- */

/** Ngày giao thực tế của chuyến: ngày on board trên B/L (của chuyến hoặc mục dùng chung), chưa có thì ETD. */
export function shipmentDeliveryDate(d: Pick<ExportData, "items" | "shipments">, shipment: ExportShipment): string {
  for (const i of documentItems(d, shipment.id)) {
    if (i.docKind !== "bill-of-lading") continue;
    const src = i.sharedFromId ? sharedSource(d, i) : i;
    if (src?.onBoardDate) return src.onBoardDate;
  }
  return shipment.etd;
}

/** Hạn giao của chuyến: chuyến gộp ⇒ hạn SỚM nhất trong các HĐ của chuyến (trễ với HĐ nào là chuyến trễ — ba-spec 70 R7). */
export function shipmentDeadline(d: ExportData, shipment: ExportShipment): string {
  const deadlines = shipmentContractIds(d, shipment).map((id) => effectiveDeadline(d, id)).filter(Boolean).sort();
  return deadlines[0] ?? "";
}

export function isShipmentLate(d: ExportData, shipment: ExportShipment): boolean {
  const ref = shipmentDeliveryDate(d, shipment);
  const deadline = shipmentDeadline(d, shipment);
  return !!ref && !!deadline && ref > deadline;
}

/** Trễ bao nhiêu ngày (R15) + hai ngày so — để thẻ "Trễ hạn giao n ngày" nói một nghĩa ở mọi chỗ. */
export function shipmentLateInfo(d: ExportData, shipment: ExportShipment): { late: boolean; days: number; deadline: string; deliveredOn: string } {
  const deliveredOn = shipmentDeliveryDate(d, shipment);
  const deadline = shipmentDeadline(d, shipment);
  const late = !!deliveredOn && !!deadline && deliveredOn > deadline;
  const days = late ? Math.round((Date.parse(deliveredOn) - Date.parse(deadline)) / 86400000) : 0;
  return { late, days, deadline, deliveredOn };
}

/* ---------- Độ phủ + khép HĐ (NV12, R7) ---------- */

export interface Coverage {
  missingKg: number;
  missingContainers: number;
  covered: boolean;
}

/** HĐ đã lên đủ chuyến chưa: Σ kg kế hoạch ≥ kg × (1 − dung sai) và số chuyến cont ≥ số cont trên HĐ. */
export function contractCoverage(d: ExportData, contractId: string): Coverage {
  const rev = workingRevision(d, contractId);
  if (!rev) return { missingKg: 0, missingContainers: 0, covered: true };
  const tol = numOr0(rev.terms.tolerancePct) / 100;
  const target = contractTotals(rev.lines).kg * (1 - tol);
  const ships = openShipmentsOf(d, contractId);
  const planned = ships.reduce((t, s) => t + shipmentContractPlannedKg(d, s, contractId), 0);
  const missingKg = Math.max(0, round2(target - planned));
  // ba-spec 73 R10: đếm CONT của các chuyến (chuyến nhiều cont đếm đủ), không đếm số chuyến.
  const missingContainers = Math.max(0, numOr0(rev.terms.containerCount) - ships.reduce((t, s) => t + containerCountOf(d, s), 0));
  return { missingKg, missingContainers, covered: missingKg < EPS && missingContainers === 0 };
}

export interface Closure {
  closed: boolean;
  reason?: "cancelled" | "manual" | "no-effective-revision" | "no-shipment" | "shipments-open" | "out-of-tolerance";
  kgDeviationPct: number;
  amountDeviationPct: number;
  actuals: Actuals;
  target: { kg: number; amount: number };
}

const pctDiff = (actual: number, target: number) => (target > 0 ? ((actual - target) / target) * 100 : 0);
const within = (actual: number, target: number, tol: number) => actual >= target * (1 - tol) - EPS && actual <= target * (1 + tol) + EPS;

/** HĐ khép khi mọi chuyến khép VÀ Σ kg lẫn Σ tiền thực xuất nằm trong dung sai (cả hai đầu). */
export function contractClosure(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): Closure {
  const c = d.contracts.find((x) => x.id === contractId);
  const eff = effectiveRevision(d, contractId);
  const totals = eff ? contractTotals(eff.lines) : { kg: 0, amount: 0 };
  const actuals = contractActuals(d, contractId);
  const base = {
    kgDeviationPct: pctDiff(actuals.kg, totals.kg),
    amountDeviationPct: pctDiff(actuals.amount, totals.amount),
    actuals,
    target: { kg: totals.kg, amount: totals.amount },
  };
  if (!c || c.status === "cancelled") return { closed: false, reason: "cancelled", ...base };
  if (c.status === "closed") return { closed: true, reason: "manual", ...base };
  if (!eff) return { closed: false, reason: "no-effective-revision", ...base };
  const ships = openShipmentsOf(d, contractId);
  if (!ships.length) return { closed: false, reason: "no-shipment", ...base };
  if (!ships.every((s) => isShipmentClosed(d, s, opts))) return { closed: false, reason: "shipments-open", ...base };
  const tol = numOr0(eff.terms.tolerancePct) / 100;
  if (!within(actuals.kg, totals.kg, tol) || !within(actuals.amount, totals.amount, tol)) return { closed: false, reason: "out-of-tolerance", ...base };
  return { closed: true, ...base };
}

/** Trạng thái HĐ (xem `ContractState`). `contractClosure().closed` = đã xuất đủ / đã đóng. */
export function contractState(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ContractState {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status === "cancelled") return "cancelled";
  if (c.status === "closed") return "closed";
  // Chỉ loại "Thiếu" giữ HĐ ở Chờ đính kèm; "Bổ sung sau" cho đi tiếp (ba-spec 58 R4).
  if (!effectiveRevision(d, contractId) || blockingAttachmentKinds(d, contractId, opts).length) return "attaching";
  return contractClosure(d, contractId, opts).closed ? "final-review" : "shipping";
}

/**
 * Dòng tiến độ dưới chặng Giao hàng (2026-11-05, HĐ 68/2025: ghi đủ chuyến mà người dùng tưởng còn lỗi):
 * còn thiếu ⇒ "Còn … chưa ghi chuyến"; đủ ⇒ "Đã ghi đủ chuyến · k/n chuyến xong"; xong hết mà lệch ⇒ nói lệch dung sai.
 * HĐ không ở chặng Giao hàng ⇒ "".
 */
export function shippingProgressText(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): string {
  if (contractState(d, contractId, opts) !== "shipping") return "";
  const cov = contractCoverage(d, contractId);
  if (!cov.covered) {
    const parts = [cov.missingKg > 0 && `${cov.missingKg.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kg`, cov.missingContainers > 0 && `${cov.missingContainers} cont`].filter(Boolean);
    return `Còn ${parts.join(" / ")} chưa ghi chuyến`;
  }
  const ships = openShipmentsOf(d, contractId);
  const done = ships.filter((s) => isShipmentClosed(d, s, opts)).length;
  if (ships.length && done === ships.length) return "Mọi chuyến đã xong · số đã giao lệch dung sai, xem thẻ Ngoài dung sai";
  return `Đã ghi đủ chuyến · ${done}/${ships.length} chuyến xong`;
}

/** Chặng hiện tại trên thanh quy trình (0 = Đính kèm … 3 = Đóng HĐ); HĐ hủy ⇒ -1. */
export function contractFlowIndex(state: ContractState): number {
  return CONTRACT_FLOW_STAGES.findIndex((s) => s.state === state);
}

/**
 * Đổi khách của HĐ (ba-spec 41 R44, chủ dự án 2026-11-03): được đổi — kể cả khi HĐ đã có bản duyệt, đã lên
 * lịch xuất hàng — tới khi MỘT chuyến chưa hủy của HĐ xong bước 4 Đóng cont (cont đã đóng = hàng đã đi theo
 * khách đó); từ đó khóa. Chuyến đã hủy không tính.
 */
export type CustomerChangeGate = { ok: true } | { ok: false; shipment: ExportShipment };

export function customerChangeGate(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): CustomerChangeGate {
  const loaded = d.shipments.find((s) => {
    if (s.status === "cancelled" || !carriesContract(d, s, contractId)) return false;
    const st = stepState(d, s, 4, opts);
    return st === "done" || st === "not-applicable";
  });
  return loaded ? { ok: false, shipment: loaded } : { ok: true };
}

export type ShipmentGate =
  | { ok: true }
  | { ok: false; reason: "not-open" | "no-revision" | "attachments-missing"; missing: ExportContractAttachmentKind[] };

/**
 * Ghi chuyến mới: chỉ khi HĐ còn mở và ĐÃ ĐÍNH KÈM ĐỦ hồ sơ bắt buộc (không còn bước duyệt HĐ — 2026-10-29).
 * Chuyến ghi từ trước giữ nguyên (không chặn sửa / theo dõi bước).
 */
export function shipmentGate(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ShipmentGate {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status !== "open") return { ok: false, reason: "not-open", missing: [] };
  if (!effectiveRevision(d, contractId)) return { ok: false, reason: "no-revision", missing: [] };
  // "Bổ sung sau" mở cổng; chỉ loại còn Thiếu mới chặn (ba-spec 58 R3).
  const missing = blockingAttachmentKinds(d, contractId, opts);
  return missing.length ? { ok: false, reason: "attachments-missing", missing } : { ok: true };
}

/** Câu giải thích vì sao chưa ghi chuyến được — cho nút / thẻ / tour. */
export function shipmentGateText(g: ShipmentGate): string {
  if (g.ok) return "";
  if (g.reason === "not-open") return "Hợp đồng đã đóng hoặc đã hủy.";
  if (g.reason === "no-revision") return "Hợp đồng chưa có bản hiệu lực (mọi bản đã bị từ chối) — ghi bản sửa.";
  return `Còn thiếu hồ sơ đính kèm: ${g.missing.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}.`;
}

/* ---------- NV19: lịch xuất hàng theo HĐ (ba-spec 41 §0d, R39–R41) ---------- */

/** Một chuyến dự kiến của lịch — chỉ tháng + kg, phần còn lại theo HĐ. */
export interface ScheduleRow {
  planMonth: string;
  plannedKg: number | null;
  /** R43 (v9.4): ô chuyến tùy chọn gõ ngay ở form Lập HĐ — trống = chuyến còn trống (R41). */
  bookingNo?: string;
  loadingDate?: string;
  etd?: string;
  eta?: string;
}

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const monthText = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
/** Lịch dài nhất app dựng sẵn — số cont gõ nhầm (VD 600) không sinh hàng trăm chuyến. */
export const MAX_SCHEDULE_ROWS = 60;

/**
 * R39: N = số cont (trống / 0 ⇒ 1); kg chia đều làm tròn 2 số lẻ, chuyến cuối nhận phần dư; tháng rải đều từ
 * tháng SAU tháng ký (thiếu ngày ký ⇒ tháng của `today`) tới tháng hạn giao.
 */
export function buildSchedule(p: { signedOn: string; latestShipmentDate: string; containerCount: number | null; totalKg: number; today: string }): ScheduleRow[] {
  const n = Math.min(MAX_SCHEDULE_ROWS, Math.max(1, Math.round(p.containerCount ?? 0) || 1));
  const startRaw = p.signedOn ? monthIndex(p.signedOn) + 1 : monthIndex(p.today);
  const end = p.latestShipmentDate ? monthIndex(p.latestShipmentDate) : startRaw;
  const start = Math.min(startRaw, end);
  const span = end - start + 1;
  const each = p.totalKg > 0 ? round2(p.totalKg / n) : null;
  return Array.from({ length: n }, (_, i) => ({
    planMonth: monthText(n === 1 ? end : start + Math.floor((i * (span - 1)) / (n - 1))),
    plannedKg: each == null ? null : i === n - 1 ? round2(p.totalKg - each * (n - 1)) : each,
  }));
}

export type ScheduleGate = { ok: true } | { ok: false; reason: "not-open" | "no-revision" | "has-shipments" };

/** R40: tạo lịch KHÔNG cần đủ hồ sơ — chỉ cần HĐ còn mở, có bản hiệu lực, chưa có chuyến còn mở. */
export function scheduleGate(d: ExportData, contractId: string): ScheduleGate {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status !== "open") return { ok: false, reason: "not-open" };
  if (!effectiveRevision(d, contractId)) return { ok: false, reason: "no-revision" };
  return openShipmentsOf(d, contractId).length ? { ok: false, reason: "has-shipments" } : { ok: true };
}

/** Lịch dự kiến của HĐ theo bản hiệu lực (R39). */
export function scheduleFor(d: ExportData, contractId: string, today: string): ScheduleRow[] {
  const c = d.contracts.find((x) => x.id === contractId);
  const rev = effectiveRevision(d, contractId);
  if (!c || !rev) return [];
  return buildSchedule({
    signedOn: c.signedOn,
    latestShipmentDate: termsOf(d, contractId).latestShipmentDate,
    containerCount: rev.terms.containerCount,
    totalKg: contractTotals(rev.lines).kg,
    today,
  });
}

/** Chuyến của lịch: chuyến thường còn trống (chưa MSL / booking / ngày / số cont). */
export function shipmentsFromSchedule(
  rows: readonly ScheduleRow[],
  base: Pick<ExportShipment, "contractId" | "kind" | "portOfDischarge">,
  newId: () => string,
  createdAt: string,
): ExportShipment[] {
  return rows.map((r) => ({
    id: newId(),
    contractId: base.contractId,
    planMonth: r.planMonth,
    kind: base.kind,
    goodsSummary: "",
    plannedKg: r.plannedKg,
    lotCode: "",
    portOfDischarge: base.portOfDischarge,
    bookingNo: r.bookingNo?.trim() ?? "",
    loadingDate: r.loadingDate ?? "",
    etd: r.etd ?? "",
    eta: r.eta ?? "",
    vesselVoyage: "",
    containerNo: "",
    sealNo: "",
    status: "open",
    cancelReason: "",
    note: "",
    createdAt,
  }));
}

/**
 * R42 + R43: kiểm lịch trong form Lập HĐ — ≥ 1 chuyến, mỗi chuyến có tháng (hoặc ngày đóng / ETD, R1), thứ tự
 * ngày đóng ≤ ETD ≤ ETA (R8). Lỗi ghi rõ chuyến số mấy.
 */
export function validateScheduleRows(rows: readonly ScheduleRow[]): ValidationIssue[] {
  if (!rows.length) return [{ key: "schedule", label: "Lịch xuất hàng", message: "Lịch cần ít nhất 1 chuyến — hoặc chọn Không tạo lịch" }];
  return rows.flatMap((r, i) =>
    validateShipment({ planMonth: /^\d{4}-\d{2}$/.test(r.planMonth) ? r.planMonth : "", loadingDate: r.loadingDate ?? "", etd: r.etd ?? "", eta: r.eta ?? "", plannedKg: r.plannedKg }).map(
      (x) => ({ ...x, key: `schedule-${i}-${x.key}`, label: `Chuyến ${i + 1} · ${x.label}` }),
    ),
  );
}

/**
 * R42: lịch trong form Lập HĐ tự dựng lại theo các ô của HĐ (R39) cho tới khi người dùng sửa tay một chuyến;
 * đã sửa tay ⇒ giữ bản đã sửa.
 */
export function formSchedule(
  state: { edited: boolean; rows: readonly ScheduleRow[] },
  p: Parameters<typeof buildSchedule>[0],
): ScheduleRow[] {
  return state.edited ? [...state.rows] : buildSchedule(p);
}

/** R41: chuyến còn trống = chưa có thông tin chuyến thật, không file, không mục nào Xong. */
export function isBlankShipment(d: Pick<ExportData, "files" | "items">, s: ExportShipment): boolean {
  const head = [s.lotCode, s.bookingNo, s.loadingDate, s.etd, s.eta, s.vesselVoyage, s.containerNo, s.sealNo];
  return head.every((v) => !v.trim()) && canDeleteShipment(d, s.id);
}

/** R35 sửa theo R41: mọi chuyến của HĐ đều còn trống ⇒ "Sửa hợp đồng" vẫn sửa thẳng bản đang dùng. */
export function canEditContractDirectly(d: ExportData, contractId: string): boolean {
  return d.shipments.filter((s) => carriesContract(d, s, contractId)).every((s) => isBlankShipment(d, s));
}

/** Các lượt duyệt cuối của HĐ, cũ trước. */
export function finalReviewsOf(d: Pick<ExportData, "approvals">, contractId: string): ExportContractApproval[] {
  return d.approvals
    .filter((a) => a.contractId === contractId && a.stage === "final")
    .sort((a, b) => (a.decidedOn + a.createdAt).localeCompare(b.decidedOn + b.createdAt));
}

/**
 * Duyệt cuối được khi HĐ còn mở, đã qua bước Đính kèm và có ít nhất một chuyến còn mở. HĐ chưa xuất đủ
 * trong dung sai (đóng sớm: khách giảm lượng, phụ kiện…) ⇒ bắt lý do.
 */
export function finalReviewGate(
  d: ExportData,
  contractId: string,
  opts: EvidenceOptions = WITH_FILES,
): { ok: boolean; needsReason: boolean; missingAttachments: ExportContractAttachmentKind[] } {
  const st = contractState(d, contractId, opts);
  if (st !== "shipping" && st !== "final-review") return { ok: false, needsReason: false, missingAttachments: [] };
  if (!openShipmentsOf(d, contractId).length) return { ok: false, needsReason: false, missingAttachments: [] };
  // Đóng HĐ phải đủ FILE hồ sơ bắt buộc — "bổ sung sau" cũng chặn (ba-spec 58 R6).
  const missingAttachments = missingAttachmentKinds(d, contractId, opts);
  if (missingAttachments.length) return { ok: false, needsReason: false, missingAttachments };
  return { ok: true, needsReason: st !== "final-review", missingAttachments: [] };
}

/** Nhật ký thao tác của MỘT hợp đồng, MỚI trước. */
export function activitiesOf(d: Pick<ExportData, "activities">, contractId: string): ExportActivity[] {
  return d.activities.filter((a) => a.contractId === contractId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- NV13: hủy / xóa ---------- */

/** "Chuyến đã đóng cont" = đã có số cont (hoặc biển số xe) — A9. */
export const isShipmentLoaded = (s: Pick<ExportShipment, "containerNo">) => !!s.containerNo.trim();

export function canDeleteContract(d: ExportData, contractId: string): { ok: boolean; reason?: string } {
  // R41: chuyến còn trống (lịch chưa làm gì) không chặn xóa — xóa HĐ xóa luôn các chuyến đó.
  if (d.shipments.some((s) => carriesContract(d, s, contractId) && !isBlankShipment(d, s))) return { ok: false, reason: "has-shipments" };
  const revIds = new Set(revisionsOf(d, contractId).map((r) => r.id));
  if (d.approvals.some((a) => revIds.has(a.revisionId) && a.decision === "approved")) return { ok: false, reason: "was-approved" };
  return { ok: true };
}

export function canCancel(d: ExportData, contractId: string): { ok: boolean; reason?: "shipment-loaded" | "not-open" } {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status !== "open") return { ok: false, reason: "not-open" };
  if (openShipmentsOf(d, contractId).some(isShipmentLoaded)) return { ok: false, reason: "shipment-loaded" };
  return { ok: true };
}

/** Hủy HĐ ⇒ mọi chuyến còn mở của HĐ hủy cùng lý do. Trả bản mới của hai bảng (màn ghi). */
export function cancelContract(
  d: Pick<ExportData, "contracts" | "shipments">,
  contractId: string,
  reason: string,
): { contracts: ExportContract[]; shipments: ExportShipment[] } {
  return {
    contracts: d.contracts.map((c) => (c.id === contractId ? { ...c, status: "cancelled" as const, cancelReason: reason } : c)),
    shipments: d.shipments.map((s) => (s.contractId === contractId && s.status === "open" ? { ...s, status: "cancelled" as const, cancelReason: reason } : s)),
  };
}

export function canDeleteShipment(d: Pick<ExportData, "files" | "items">, shipmentId: string): boolean {
  if (d.files.some((f) => f.shipmentId === shipmentId)) return false;
  return !d.items.some((i) => i.shipmentId === shipmentId && i.state === "done");
}

/* ---------- ba-spec 73 R13: gộp chuyến thành cont thêm của chuyến khác ---------- */

export type MergeShipmentGate = { ok: true } | { ok: false; reason: "same" | "not-open" | "other-contract" | "not-container" | "has-progress" | "other-booking" };

/** Gộp chuyến `from` vào `into` làm cont thêm: cùng HĐ chính, đều mở, đều cont lạnh, `from` chưa file / chưa bước Xong, booking không khác nhau. */
export function mergeShipmentGate(d: Pick<ExportData, "files" | "items">, into: ExportShipment, from: ExportShipment): MergeShipmentGate {
  if (into.id === from.id) return { ok: false, reason: "same" };
  if (into.status !== "open" || from.status !== "open") return { ok: false, reason: "not-open" };
  if (into.contractId !== from.contractId) return { ok: false, reason: "other-contract" };
  if (!isContainerKind(into.kind) || !isContainerKind(from.kind)) return { ok: false, reason: "not-container" };
  if (!canDeleteShipment(d, from.id)) return { ok: false, reason: "has-progress" };
  const a = normalizeNo(into.bookingNo);
  const b = normalizeNo(from.bookingNo);
  if (a && b && a !== b) return { ok: false, reason: "other-booking" };
  return { ok: true };
}

/**
 * Kết quả gộp (R13): `from` thành cont thêm cuối của `into` (loại, số, seal, ngày đóng của `from`); dòng hàng của `from`
 * sang `into`, gán cont mới, xếp sau dòng của `into`; chuyến `from` + mục bước của nó bị bỏ. Màn ghi một lần + Hoàn tác.
 */
export function mergeShipmentInto(
  d: Pick<ExportData, "shipments" | "items" | "shipmentLines" | "shipmentContainers">,
  into: ExportShipment,
  from: ExportShipment,
  newContainerId: string,
  now: string,
): { shipments: ExportShipment[]; items: ExportStepItem[]; shipmentLines: ExportShipmentLine[]; shipmentContainers: ExportShipmentContainer[] } {
  const extras = (d.shipmentContainers ?? []).filter((c) => c.shipmentId === into.id);
  const container: ExportShipmentContainer = {
    id: newContainerId,
    shipmentId: into.id,
    sortOrder: extras.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1,
    kind: from.kind === "20RF" || from.kind === "40RF" || from.kind === "40HC-RF" ? from.kind : "20RF",
    containerNo: from.containerNo,
    sealNo: from.sealNo,
    loadingDate: from.loadingDate === into.loadingDate ? "" : from.loadingDate,
    note: from.note,
    createdAt: now,
  };
  const lines = d.shipmentLines ?? [];
  const base = lines.filter((l) => l.shipmentId === into.id).reduce((m, l) => Math.max(m, l.sortOrder), 0);
  return {
    shipments: d.shipments.filter((s) => s.id !== from.id),
    items: d.items.filter((i) => i.shipmentId !== from.id),
    shipmentLines: lines.map((l) => (l.shipmentId === from.id ? { ...l, shipmentId: into.id, containerId: newContainerId, sortOrder: base + 1 + l.sortOrder } : l)),
    // Cont thêm của `from` (nếu có) đi theo, xếp sau cont mới.
    shipmentContainers: [
      ...(d.shipmentContainers ?? []).map((c) => (c.shipmentId === from.id ? { ...c, shipmentId: into.id, sortOrder: container.sortOrder + c.sortOrder } : c)),
      container,
    ],
  };
}

/* ---------- Tra cứu (NV11) ---------- */

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Tìm chuyến theo MSL / booking / số cont / seal / số HĐ / số invoice / số B/L / tên khách. */
export function searchShipments(d: ExportData, query: string, customers: readonly Pick<Customer, "id" | "name">[] = []): ExportShipment[] {
  const q = squash(query);
  if (!q) return [];
  const contractById = new Map(d.contracts.map((c) => [c.id, c]));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  return d.shipments.filter((s) => {
    const c = contractById.get(s.contractId);
    const docNos = d.items.filter((i) => i.shipmentId === s.id && i.step === "document").map((i) => i.number);
    const hay = [s.lotCode, s.bookingNo, s.containerNo, s.sealNo, c?.contractNo ?? "", c?.orderRef ?? "", customerName.get(c?.customerId ?? "") ?? "", ...docNos];
    return hay.some((h) => h && squash(h).includes(q));
  });
}

/* ---------- Tháng (NV11) ---------- */

export interface MonthShipmentRow {
  shipment: ExportShipment;
  contract: ExportContract;
  steps: Record<StepNo, ExportItemState>;
  closed: boolean;
  late: boolean;
  actuals: Actuals;
  deadline: string;
}

export interface MonthGroup {
  customerId: string;
  customerName: string;
  rows: MonthShipmentRow[];
  plannedKg: number;
  actualKg: number;
}

export interface PendingContractRow {
  contract: ExportContract;
  customerName: string;
  deadline: string;
  overdue: boolean;
  coverage: Coverage;
  hasShipments: boolean;
}

export interface MonthPlan {
  month: string;
  /** Kỳ đang xem (tháng / tuần / khoảng ngày). `month` = tháng của ngày đầu kỳ. */
  period: Period;
  groups: MonthGroup[];
  /** HĐ chưa lên đủ chuyến cần nhìn trong tháng (chưa chuyến nào, hoặc còn thiếu kg / cont). */
  pendingContracts: PendingContractRow[];
  stats: {
    shipments: number;
    closed: number;
    missingSteps: number;
    lateShipments: number;
    overdueContractsWithoutShipment: number;
  };
}

/** Tìm HĐ theo số HĐ / số đơn khách / tên khách / MSL của chuyến — để ra cả HĐ chưa lên chuyến. */
export function searchContracts(d: ExportData, query: string, customers: readonly Pick<Customer, "id" | "name">[] = []): ExportContract[] {
  const q = squash(query);
  if (!q) return [];
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  return d.contracts.filter((c) => {
    const lots = d.shipments.filter((s) => s.contractId === c.id).map((s) => s.lotCode);
    return [c.contractNo, c.orderRef, customerName.get(c.customerId) ?? "", ...lots].some((h) => h && squash(h).includes(q));
  });
}

/* ---------- Kỳ xem: tháng · tuần · khoảng ngày ---------- */

export interface Period {
  kind: "month" | "week" | "range";
  /** ISO yyyy-mm-dd, tính cả hai đầu. */
  from: string;
  to: string;
  label: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
const lastDayOfMonth = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function monthPeriod(month: string): Period {
  return { kind: "month", from: `${month}-01`, to: `${month}-${pad2(lastDayOfMonth(month))}`, label: monthLabel(month) };
}

/** Tuần lịch Thứ 2 → Chủ nhật chứa `date` (như sổ Kế hoạch xuất hàng). */
export function weekPeriod(date: string): Period {
  const d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const back = (d.getDay() + 6) % 7; // T2 = 0 … CN = 6
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const from = isoOf(mon.getFullYear(), mon.getMonth() + 1, mon.getDate());
  const to = isoOf(sun.getFullYear(), sun.getMonth() + 1, sun.getDate());
  return { kind: "week", from, to, label: `Tuần ${shortDate(from)} – ${shortDate(to)}/${to.slice(0, 4)}` };
}

export function rangePeriod(from: string, to: string): Period {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { kind: "range", from: a, to: b, label: a === b ? `Ngày ${formatDateVN(a)}` : `${formatDateVN(a)} – ${formatDateVN(b)}` };
}

/** Kỳ kế tiếp / trước cùng loại (tháng ± 1, tuần ± 7 ngày, khoảng ± độ dài khoảng). */
export function shiftPeriod(p: Period, delta: number): Period {
  if (p.kind === "month") return monthPeriod(shiftMonth(p.from.slice(0, 7), delta));
  const days = p.kind === "week" ? 7 : Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86400000) + 1;
  const move = (iso: string) => {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + delta * days);
    return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  return p.kind === "week" ? weekPeriod(move(p.from)) : rangePeriod(move(p.from), move(p.to));
}

/**
 * Chuyến thuộc kỳ khi ngày đóng cont (chưa có thì ETD) nằm trong kỳ; chuyến chỉ có tháng kế
 * hoạch thì thuộc mọi kỳ chạm tới tháng đó (R1 — xem theo tháng y như trước).
 */
export function shipmentInPeriod(s: Pick<ExportShipment, "loadingDate" | "etd" | "planMonth">, p: Pick<Period, "from" | "to">): boolean {
  const d = s.loadingDate || s.etd;
  if (d) return d >= p.from && d <= p.to;
  if (!s.planMonth) return false;
  return `${s.planMonth}-01` <= p.to && `${s.planMonth}-${pad2(lastDayOfMonth(s.planMonth))}` >= p.from;
}

export function buildMonthPlan(
  month: string,
  d: ExportData,
  customers: readonly Pick<Customer, "id" | "name">[],
  today: string,
  opts: EvidenceOptions = WITH_FILES,
): MonthPlan {
  return buildPeriodPlan(monthPeriod(month), d, customers, today, opts);
}

/**
 * Dữ liệu một kỳ: chuyến gom theo khách + HĐ chưa lên đủ chuyến + 4 con số. Có `customerId`
 * thì CẢ danh sách LẪN 4 con số chỉ tính khách đó (trước đây thẻ số vẫn đếm cả tháng).
 */
export function buildPeriodPlan(
  period: Period,
  d: ExportData,
  customers: readonly Pick<Customer, "id" | "name">[],
  today: string,
  opts: EvidenceOptions = WITH_FILES,
  customerId = "",
): MonthPlan {
  const contractById = new Map(d.contracts.map((c) => [c.id, c]));
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";
  const groups = new Map<string, MonthGroup>();
  let closed = 0;
  let late = 0;
  let count = 0;
  for (const s of d.shipments) {
    if (s.status !== "open" || !shipmentInPeriod(s, period)) continue;
    const c = contractById.get(s.contractId);
    if (!c || c.status === "cancelled" || (customerId && c.customerId !== customerId)) continue;
    const steps = Object.fromEntries(STEP_NOS.map((n) => [n, stepState(d, s, n, opts)])) as Record<StepNo, ExportItemState>;
    const row: MonthShipmentRow = {
      shipment: s,
      contract: c,
      steps,
      closed: isShipmentClosed(d, s, opts),
      late: isShipmentLate(d, s),
      actuals: shipmentActuals(d, s.id),
      deadline: effectiveDeadline(d, c.id),
    };
    count++;
    if (row.closed) closed++;
    if (row.late) late++;
    const g = groups.get(c.customerId) ?? { customerId: c.customerId, customerName: nameOf(c.customerId), rows: [], plannedKg: 0, actualKg: 0 };
    g.rows.push(row);
    g.plannedKg = round2(g.plannedKg + numOr0(s.plannedKg));
    g.actualKg = round2(g.actualKg + row.actuals.kg);
    groups.set(c.customerId, g);
  }
  const byDate = (r: MonthShipmentRow) => r.shipment.loadingDate || r.shipment.etd || "9999";
  const sortedGroups = [...groups.values()]
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => byDate(a).localeCompare(byDate(b)) || a.shipment.createdAt.localeCompare(b.shipment.createdAt)) }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName, "vi"));

  const todayInPeriod = today >= period.from && today <= period.to;
  const pendingContracts: PendingContractRow[] = [];
  for (const c of d.contracts) {
    if (c.status !== "open" || (customerId && c.customerId !== customerId) || contractClosure(d, c.id, opts).closed) continue;
    const deadline = effectiveDeadline(d, c.id);
    const ships = openShipmentsOf(d, c.id);
    const coverage = contractCoverage(d, c.id);
    if (ships.length && coverage.covered) continue;
    const overdue = !!deadline && deadline < today;
    const inPeriod = (!!deadline && deadline >= period.from && deadline <= period.to) || (overdue && todayInPeriod && !ships.length);
    if (!inPeriod) continue;
    pendingContracts.push({ contract: c, customerName: nameOf(c.customerId), deadline, overdue, coverage, hasShipments: ships.length > 0 });
  }
  pendingContracts.sort((a, b) => a.deadline.localeCompare(b.deadline));

  return {
    month: period.from.slice(0, 7),
    period,
    groups: sortedGroups,
    pendingContracts,
    stats: {
      shipments: count,
      closed,
      missingSteps: count - closed,
      lateShipments: late,
      overdueContractsWithoutShipment: pendingContracts.filter((p) => p.overdue && !p.hasShipments).length,
    },
  };
}

/** Tháng kế tiếp / trước ("2026-10" ± n). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/* ---------- Excel theo bố cục sổ "Kế hoạch xuất hàng" (Q10) ---------- */

export const MONTH_EXCEL_HEADER = [
  "CONT",
  "Khách hàng",
  "Mặt hàng",
  "Lượng (kg)",
  "MSL",
  "Cảng đến",
  "Số booking",
  "Ngày đóng cont",
  "ETD",
  "Đơn giá",
  "Bao bì",
  "Thực xuất (kg)",
  "Giá trị (USD)",
  "Ghi chú",
  // Thêm 2026-10-30 (mig 0089) — CUỐI bảng để cột sổ cũ giữ đúng vị trí; lọc Excel theo "chứa".
  "Loại hàng",
] as const;

/** Tên các loại hàng của một bản HĐ (theo thứ tự dòng, không lặp) — cột Loại hàng của Excel. */
export function lineGoodsTypeNames(lines: readonly ExportContractLine[], goodsTypes: readonly GoodsType[]): string {
  const names = lines.map((l) => goodsTypes.find((g) => g.id === l.goodsTypeId)?.name.trim() ?? "").filter(Boolean);
  return [...new Set(names)].join("; ");
}

export type ExcelCell = string | number | null;
export interface MonthExcelRow {
  kind: "week" | "shipment" | "section" | "pending";
  cells: ExcelCell[];
}

/** Tuần trong tháng theo TUẦN LỊCH (Thứ 2 → Chủ nhật), nhãn kiểu sổ cũ "T2 (06-12/01)". */
function weekOf(date: string): { key: string; label: string } {
  if (!date) return { key: "9999", label: "Chưa có ngày đóng" };
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  const offset = (new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1).getDay() + 6) % 7; // ngày 1 là thứ mấy (T2 = 0)
  const w = Math.floor((day - 1 + offset) / 7) + 1;
  const from = Math.max(1, (w - 1) * 7 - offset + 1);
  const to = Math.min(lastDayOfMonth(month), w * 7 - offset);
  return { key: `${month}-${w}`, label: `T${w} (${pad2(from)}-${pad2(to)}/${date.slice(5, 7)})` };
}

const stateWord = (s: ExportItemState) => (s === "done" ? "Đã xong" : s === "not-applicable" ? "Không áp dụng" : s === "in-progress" ? "Đang làm" : "");

export function buildMonthExcel(plan: MonthPlan, d: ExportData, goodsTypes: readonly GoodsType[] = []): { header: string[]; rows: MonthExcelRow[] } {
  type Bucket = { rows: MonthShipmentRow[]; customerName: string };
  const merged = new Map<string, Bucket>();
  for (const g of plan.groups) {
    for (const r of g.rows) {
      const booking = normalizeNo(r.shipment.bookingNo);
      const key = booking ? `${g.customerId}|b|${booking}` : `s|${r.shipment.id}`;
      const b = merged.get(key) ?? { rows: [], customerName: g.customerName };
      b.rows.push(r);
      merged.set(key, b);
    }
  }
  const lines = [...merged.values()].map((b) => {
    const rs = b.rows;
    const first = rs[0];
    const date = rs.map((r) => r.shipment.loadingDate).filter(Boolean).sort()[0] ?? "";
    const rev = workingRevision(d, first.contract.id);
    const totals = rev ? contractTotals(rev.lines) : null;
    const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
    const packaging = rs.map((r) => r.steps[3]);
    const cells: ExcelCell[] = [
      rs.map((r) => shipmentKindShort(r.shipment.kind)).join("+"),
      b.customerName,
      uniq(rs.map((r) => r.shipment.goodsSummary)).join("; "),
      round2(rs.reduce((t, r) => t + numOr0(r.shipment.plannedKg), 0)) || null,
      uniq(rs.map((r) => r.shipment.lotCode)).join("+"),
      uniq(rs.map((r) => r.shipment.portOfDischarge || rev?.terms.portOfDischarge || "")).join(", "),
      uniq(rs.map((r) => r.shipment.bookingNo)).join(", ") || "Chờ booking",
      date ? formatDateVN(date) : "",
      first.shipment.etd ? formatDateVN(first.shipment.etd) : "",
      totals && totals.kg > 0 ? round2(totals.amount / totals.kg) : null,
      packaging.every((p) => p === "done" || p === "not-applicable") ? "Đã xong" : stateWord(packaging.find((p) => p !== "done") ?? "not-started"),
      round2(rs.reduce((t, r) => t + r.actuals.kg, 0)) || null,
      round2(rs.reduce((t, r) => t + r.actuals.amount, 0)) || null,
      uniq(rs.map((r) => r.shipment.note)).join("; "),
      uniq(rs.map((r) => lineGoodsTypeNames(workingRevision(d, r.contract.id)?.lines ?? [], goodsTypes))).join("; "),
    ];
    return { date, cells };
  });
  lines.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  const rows: MonthExcelRow[] = [];
  let lastWeek = "";
  for (const l of lines) {
    const w = weekOf(l.date);
    if (w.key !== lastWeek) {
      rows.push({ kind: "week", cells: [w.label] });
      lastWeek = w.key;
    }
    rows.push({ kind: "shipment", cells: l.cells });
  }
  if (plan.pendingContracts.length) {
    rows.push({ kind: "section", cells: ["Hợp đồng chưa ghi đủ chuyến"] });
    for (const p of plan.pendingContracts) {
      const rev = workingRevision(d, p.contract.id);
      // HĐ đã có chuyến ⇒ ghi phần CÒN THIẾU (không phải cả HĐ), không ghi "Chờ booking".
      const missingCont = p.hasShipments ? p.coverage.missingContainers : numOr0(rev?.terms.containerCount);
      rows.push({
        kind: "pending",
        cells: [
          missingCont ? `${missingCont} cont` : "",
          p.customerName,
          `HĐ ${p.contract.contractNo}${p.hasShipments ? " (phần còn thiếu)" : ""}`,
          p.hasShipments ? p.coverage.missingKg || null : rev ? contractTotals(rev.lines).kg : null,
          "",
          rev?.terms.portOfDischarge ?? "",
          p.hasShipments ? "" : "Chờ booking",
          "",
          "",
          null,
          "",
          null,
          null,
          `Hạn giao ${formatDateVN(p.deadline)}${p.overdue ? " — đã quá hạn" : ""}`,
          lineGoodsTypeNames(rev?.lines ?? [], goodsTypes),
        ],
      });
    }
  }
  return { header: [...MONTH_EXCEL_HEADER], rows };
}

/* ---------- Nhật ký sửa hợp đồng (ba-spec 68) ---------- */

const CONTRACT_FIELD_LABELS: readonly [keyof ExportContract, string][] = [
  ["contractNo", "Số HĐ"],
  ["customerId", "Khách"],
  ["signedOn", "Ngày ký"],
  ["orderRef", "Số đơn / PO"],
  ["note", "Ghi chú"],
];
const TERM_FIELD_LABELS: readonly [keyof ExportContractTerms, string][] = [
  ["incoterm", "Điều kiện giao"],
  ["portOfLoading", "Cảng xếp"],
  ["portOfDischarge", "Cảng đích"],
  ["paymentMethod", "Thanh toán"],
  ["paymentOther", "Hình thức thanh toán khác"],
  ["depositPct", "Đặt cọc %"],
  ["lcNo", "Số L/C"],
  ["lcExpiry", "Hạn L/C"],
  ["lcLatestShipment", "Hạn giao theo L/C"],
  ["currency", "Tiền tệ"],
  ["tolerancePct", "Dung sai %"],
  ["latestShipmentDate", "Hạn giao muộn nhất"],
  ["containerCount", "Số cont"],
  ["containerType", "Loại container"],
];
const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const shown = (v: unknown) => (v == null || v === "" ? "(trống)" : isIsoDate(v) ? formatDateVN(v) : String(v));
const lineLabel = (l: ExportContractLine) => [l.description, l.size].filter((x) => x.trim()).join(" ") || "(chưa tên)";
const LINE_KEYS: readonly (keyof ExportContractLine)[] = ["description", "size", "packing", "unitKind", "cartonsPerUnit", "netKgPerCarton", "quantity", "kg", "unitPrice", "productId"];

/**
 * Các thay đổi của một lần lưu hợp đồng (Sửa / Ghi bản sửa) — ghi vào nhật ký Xuất khẩu để tra lại (ba-spec 68 R3).
 * Bản sửa không lưu riêng Số HĐ ⇒ nhật ký là nơi duy nhất giữ số cũ khi đổi số.
 */
export function contractChangeSummary(
  before: { contract: ExportContract; revision?: ExportContractRevision } | undefined,
  after: { contract: ExportContract; revision: ExportContractRevision },
  customerName: (id: string) => string,
): string[] {
  if (!before) return [];
  const out: string[] = [];
  for (const [k, label] of CONTRACT_FIELD_LABELS) {
    const a = before.contract[k];
    const b = after.contract[k];
    if (String(a ?? "").trim() === String(b ?? "").trim()) continue;
    out.push(k === "customerId" ? `${label}: ${customerName(String(a)) || "(trống)"} → ${customerName(String(b)) || "(trống)"}` : `${label}: ${shown(a)} → ${shown(b)}`);
  }
  const ta = before.revision?.terms;
  const tb = after.revision.terms;
  if (ta) {
    for (const [k, label] of TERM_FIELD_LABELS) {
      if (String(ta[k] ?? "") === String(tb[k] ?? "")) continue;
      const pm = (v: unknown) => PAYMENT_METHODS.find((m) => m.value === v)?.label ?? shown(v);
      out.push(k === "paymentMethod" ? `${label}: ${pm(ta[k])} → ${pm(tb[k])}` : `${label}: ${shown(ta[k])} → ${shown(tb[k])}`);
    }
    if (JSON.stringify(ta.requiredDocuments ?? []) !== JSON.stringify(tb.requiredDocuments ?? [])) out.push("Chứng từ khách yêu cầu: đổi");
  }
  const la = before.revision?.lines ?? [];
  const lb = after.revision.lines;
  // Ghi bản sửa chép dòng sang id MỚI ⇒ ghép dòng cũ ↔ mới theo id, không có thì theo tên + size (không phân hoa thường).
  const keyOf = (l: ExportContractLine) => `${l.description.trim().toLowerCase()}|${l.size.trim().toLowerCase()}`;
  const unused = [...la];
  const pairs = lb.map((l) => {
    const i = unused.findIndex((x) => x.id === l.id);
    const j = i >= 0 ? i : unused.findIndex((x) => keyOf(x) === keyOf(l));
    return { line: l, old: j >= 0 ? unused.splice(j, 1)[0] : undefined };
  });
  const added = pairs.filter((p) => !p.old).map((p) => p.line);
  const removed = unused;
  const changed = pairs
    .filter((p) => p.old && LINE_KEYS.some((k) => String(p.old?.[k] ?? "") !== String(p.line[k] ?? "")))
    .map((p) => p.line);
  if (before.revision && (added.length || removed.length || changed.length)) {
    const names = [...added.map((l) => `+${lineLabel(l)}`), ...removed.map((l) => `−${lineLabel(l)}`), ...changed.map((l) => `sửa ${lineLabel(l)}`)];
    out.push(`Dòng hàng: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` … (${names.length} dòng)` : ""}`);
  }
  return out;
}
