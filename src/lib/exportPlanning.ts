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
import type {
  Customer,
  ExportContract,
  ExportActivity,
  ExportContractApproval,
  ExportContractAttachmentKind,
  ExportContractLine,
  ExportContractRevision,
  ExportContractTerms,
  ExportDeadlineExtension,
  ExportDocumentKind,
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
import { extractCustomerNames, nameKey, productsByCustomerName } from "./customerProductNames";

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
/** Chuyến đi bằng container riêng (đếm vào số cont của HĐ, cần số cont + seal). */
export const isContainerKind = (k: ExportShipmentKind) => k !== "truck" && k !== "consolidated";

export const DOCUMENT_KINDS: { value: ExportDocumentKind; label: string }[] = [
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
export const documentKindLabel = (k: ExportDocumentKind | "") => DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? "Chứng từ";
/** Nhãn đầy đủ một chứng từ yêu cầu: "C/O form VJ", "Health Certificate (H/C) · công ty tự cấp". */
export function requiredDocumentLabel(d: { kind: ExportDocumentKind | ""; form: string; issuer: string }): string {
  return [documentKindLabel(d.kind) + (d.form.trim() ? ` form ${d.form.trim()}` : ""), d.issuer.trim()].filter(Boolean).join(" · ");
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
export const LOADING_STEPS: ExportStep[] = ["loading-plan", "loading-photos", "customs-declaration", "export-order"];
/** Hai mục người đóng hàng (U4) đính được — trạng thái tự suy từ file (R10). */
export const LOADING_UPLOAD_STEPS: ExportStep[] = ["loading-plan", "loading-photos"];

export const ITEM_STATE_LABELS: Record<ExportItemState, string> = {
  "not-started": "Chưa làm",
  "in-progress": "Đang làm",
  done: "Xong",
  "not-applicable": "Không áp dụng",
};

/**
 * Quy trình hợp đồng (mig 0079, chủ dự án chốt 2026-10-28):
 * Chờ duyệt → (Trưởng / Phó phòng KH duyệt) → Chờ đính kèm → (đủ hồ sơ) → Đang ghi chuyến →
 * (xuất đủ trong dung sai) → Chờ duyệt cuối → (Trưởng / Phó duyệt cuối) → Đã đóng HĐ.
 */
export type ContractState = "pending" | "attaching" | "shipping" | "final-review" | "closed" | "cancelled";
export const CONTRACT_STATE_LABELS: Record<ContractState, string> = {
  pending: "Chờ duyệt",
  attaching: "Chờ đính kèm",
  shipping: "Đang ghi chuyến",
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
  { state: "pending", title: "Duyệt HĐ", who: "Trưởng / Phó phòng KH", hint: "Nhân viên Kế hoạch lập HĐ; Trưởng hoặc Phó phòng Kế hoạch xem và duyệt bản hợp đồng." },
  { state: "attaching", title: "Đính kèm", who: "Nhân viên Kế hoạch", hint: "Đính kèm đủ hồ sơ bắt buộc: hợp đồng đã ký, L/C (nếu thanh toán L/C). Đủ hồ sơ mới ghi chuyến được." },
  { state: "shipping", title: "Ghi chuyến", who: "Nhân viên Kế hoạch", hint: "Ghi từng chuyến (container) và theo dõi các bước lệnh SX → chứng từ, tới khi xuất đủ hợp đồng." },
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

/** Lượt duyệt BẢN hợp đồng (không gồm duyệt cuối — `stage: "final"`). */
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

/** Bản hiệu lực = bản `approved` có số bản lớn nhất. */
export function effectiveRevision(d: Pick<ExportData, "revisions" | "approvals">, contractId: string): ExportContractRevision | null {
  const rs = revisionsOf(d, contractId).filter((r) => approvalState(d, r.id) === "approved");
  return rs.length ? rs[rs.length - 1] : null;
}

/** Bản mới nhất (có thể đang chờ duyệt). */
export function latestRevision(d: Pick<ExportData, "revisions">, contractId: string): ExportContractRevision | null {
  const rs = revisionsOf(d, contractId);
  return rs.length ? rs[rs.length - 1] : null;
}

/** Bản sửa đang chờ / bị yêu cầu sửa (mới hơn bản hiệu lực). Bản bị từ chối thì bỏ qua. */
export function pendingRevision(d: Pick<ExportData, "revisions" | "approvals">, contractId: string): ExportContractRevision | null {
  const eff = effectiveRevision(d, contractId);
  const latest = latestRevision(d, contractId);
  if (!latest || (eff && latest.revisionNo <= eff.revisionNo)) return null;
  return approvalState(d, latest.id) === "rejected" ? null : latest;
}

/** Bản dùng để tính: bản hiệu lực; chưa có thì bản mới nhất (HĐ chờ duyệt vẫn lên chuyến kế hoạch — A3). */
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

export function validateShipment(s: Pick<ExportShipment, "planMonth" | "loadingDate" | "etd" | "eta" | "plannedKg">): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!s.planMonth && !s.loadingDate && !s.etd)
    out.push({ key: "planMonth", label: "Tháng kế hoạch", message: "Chọn tháng kế hoạch (hoặc ngày đóng / ETD)" });
  if (s.loadingDate && s.etd && s.loadingDate > s.etd)
    out.push({ key: "loadingAfterEtd", label: "Ngày đóng cont", message: "Ngày đóng cont phải trước hoặc bằng ETD" });
  if (s.etd && s.eta && s.etd > s.eta) out.push({ key: "etdAfterEta", label: "ETA", message: "ETA phải sau hoặc bằng ETD" });
  if (s.plannedKg != null && s.plannedKg < 0) out.push({ key: "plannedKg", label: "Kg kế hoạch", message: "Kg không được âm" });
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
  const order = new Map(DOCUMENT_KINDS.map((k, i) => [k.value, i]));
  return d.items
    .filter((i) => i.shipmentId === shipmentId && i.step === "document")
    .sort((a, b) => (order.get(a.docKind as ExportDocumentKind) ?? 99) - (order.get(b.docKind as ExportDocumentKind) ?? 99) || a.createdAt.localeCompare(b.createdAt));
}

/** Mục duy nhất của một bước không phải chứng từ (bước 2, 3, 4a–4d) — chưa có thì undefined. */
export function stepItem(d: Pick<ExportData, "items">, shipmentId: string, step: ExportStep): ExportStepItem | undefined {
  return d.items.find((i) => i.shipmentId === shipmentId && i.step === step);
}

export function filesOfItem(d: Pick<ExportData, "files">, itemId: string): ExportFile[] {
  return d.files.filter((f) => f.stepItemId === itemId);
}

/** File của bước đóng cont 4a / 4b (gắn theo bước, không cần mục). */
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
export function suggestProductId(
  d: Pick<ExportData, "contracts" | "revisions">,
  description: string,
  customerId: string,
  products: readonly Pick<Product, "id" | "tradeName">[] = [],
  ctx: LineMatchContext = {},
): string {
  const key = nameKey(description);
  if (!key) return "";
  const byCustomer = productsByCustomerName(ctx.names ?? [], customerId, description, ctx.size ?? "");
  if (byCustomer.productIds.length === 1) return byCustomer.productIds[0];
  if (byCustomer.productIds.length > 1) return "";
  const customerOf = new Map(d.contracts.map((c) => [c.id, c.customerId]));
  let best: { productId: string; score: number; at: string } | null = null;
  const lineSize = nameKey(ctx.size ?? "");
  for (const r of d.revisions) {
    for (const l of r.lines) {
      if (!l.productId || nameKey(l.description) !== key) continue;
      // Cùng tên khác size ⇒ thường là mặt hàng khác (iwadako 5-5.5 gr ≠ 6-7 gr) — không lấy làm gợi ý.
      if (lineSize && nameKey(l.size) && nameKey(l.size) !== lineSize) continue;
      const score = customerOf.get(r.contractId) === customerId ? 1 : 0;
      if (!best || score > best.score || (score === best.score && r.createdAt > best.at)) best = { productId: l.productId, score, at: r.createdAt };
    }
  }
  if (best) return best.productId;
  const byTrade = productsByTradeName(description, products);
  return byTrade.length === 1 ? byTrade[0].id : "";
}

/**
 * Ghi nối dòng hàng ↔ mặt hàng vào MỘT bản (thông tin nội bộ, không phải bản sửa HĐ):
 * - Dòng không có trong `map` (nháp cũ mở lại sau khi bản đã đổi) GIỮ nối đang có — không xóa nhầm.
 * - Các bản KHÁC còn chờ duyệt của cùng HĐ (bản số lớn hơn) nhận nối cho dòng cùng tên + size đang
 *   TRỐNG — duyệt bản sửa xong không bị "chưa nối" lại. Dòng đã nối khác giữ nguyên.
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

/** Cont + seal đã điền (xe tải: biển số; đóng ghép: không cần). */
export function containerIdentityOk(s: Pick<ExportShipment, "kind" | "containerNo" | "sealNo">): boolean {
  if (s.kind === "consolidated") return true;
  if (s.kind === "truck") return !!s.containerNo.trim();
  return !!s.containerNo.trim() && !!s.sealNo.trim();
}

const settled = (st: ExportItemState) => st === "done" || st === "not-applicable";

/** Trạng thái một mục con (bước 2, 3, 4a–4d). 4a / 4b tự xong khi có file (R10). */
export function subStepState(d: Pick<ExportData, "items" | "shipments" | "files">, shipmentId: string, step: ExportStep): ExportItemState {
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

/** Bước 1 của chuyến theo HĐ: có bản hiệu lực VÀ đã đính kèm đủ hồ sơ bắt buộc (mig 0079; trước là "có file ký" — A4). */
export function contractStepState(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ExportItemState {
  const eff = effectiveRevision(d, contractId);
  if (eff && !missingAttachmentKinds(d, contractId, opts).length) return "done";
  return latestRevision(d, contractId) ? "in-progress" : "not-started";
}

export function stepState(d: ExportData, shipment: ExportShipment, step: StepNo, opts: EvidenceOptions = WITH_FILES): ExportItemState {
  switch (step) {
    case 1:
      return contractStepState(d, shipment.contractId, opts);
    case 2:
      return subStepState(d, shipment.id, "production-order");
    case 3:
      return subStepState(d, shipment.id, "packaging");
    case 4: {
      const subs = LOADING_STEPS.map((s) => subStepState(d, shipment.id, s));
      const agg = aggregate(subs);
      if (agg === "done" || agg === "not-applicable") return containerIdentityOk(shipment) ? "done" : "in-progress";
      return agg === "not-started" && (shipment.containerNo.trim() || shipment.sealNo.trim()) ? "in-progress" : agg;
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

export function openShipmentsOf(d: Pick<ExportData, "shipments">, contractId: string): ExportShipment[] {
  return d.shipments
    .filter((s) => s.contractId === contractId && s.status === "open")
    .sort((a, b) => (a.loadingDate || a.etd || a.planMonth).localeCompare(b.loadingDate || b.etd || b.planMonth) || a.createdAt.localeCompare(b.createdAt));
}

export function contractActuals(d: Pick<ExportData, "items" | "shipments">, contractId: string): Actuals {
  return openShipmentsOf(d, contractId).reduce<Actuals>(
    (t, s) => {
      const a = shipmentActuals(d, s.id);
      return { cartons: t.cartons + a.cartons, kg: round2(t.kg + a.kg), amount: round2(t.amount + a.amount) };
    },
    { cartons: 0, kg: 0, amount: 0 },
  );
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
  const shipIds = new Set(d.shipments.filter((s) => s.contractId === contractId).map((s) => s.id));
  const received = d.payments
    .filter((p) => p.kind === "payment" && (p.contractId === contractId || shipIds.has(p.shipmentId)))
    .reduce((t, p) => t + numOr0(p.amount), 0);
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

export function isShipmentLate(d: ExportData, shipment: ExportShipment): boolean {
  const ref = shipmentDeliveryDate(d, shipment);
  const deadline = effectiveDeadline(d, shipment.contractId);
  return !!ref && !!deadline && ref > deadline;
}

/** Trễ bao nhiêu ngày (R15) + hai ngày so — để thẻ "Trễ hạn giao n ngày" nói một nghĩa ở mọi chỗ. */
export function shipmentLateInfo(d: ExportData, shipment: ExportShipment): { late: boolean; days: number; deadline: string; deliveredOn: string } {
  const deliveredOn = shipmentDeliveryDate(d, shipment);
  const deadline = effectiveDeadline(d, shipment.contractId);
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
  const planned = ships.reduce((t, s) => t + numOr0(s.plannedKg), 0);
  const missingKg = Math.max(0, round2(target - planned));
  const missingContainers = Math.max(0, numOr0(rev.terms.containerCount) - ships.filter((s) => isContainerKind(s.kind)).length);
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

/** Trạng thái HĐ theo quy trình mig 0079 (xem `ContractState`). `contractClosure().closed` = đã xuất đủ / đã đóng. */
export function contractState(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ContractState {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status === "cancelled") return "cancelled";
  if (c.status === "closed") return "closed";
  if (!effectiveRevision(d, contractId)) return "pending";
  if (missingAttachmentKinds(d, contractId, opts).length) return "attaching";
  return contractClosure(d, contractId, opts).closed ? "final-review" : "shipping";
}

/** Chặng hiện tại trên thanh quy trình (0 = Duyệt HĐ … 4 = Đóng HĐ); HĐ hủy ⇒ -1. */
export function contractFlowIndex(state: ContractState): number {
  return CONTRACT_FLOW_STAGES.findIndex((s) => s.state === state);
}

export type ShipmentGate =
  | { ok: true }
  | { ok: false; reason: "not-open" | "not-approved" | "attachments-missing"; missing: ExportContractAttachmentKind[] };

/**
 * Ghi chuyến mới (mig 0079): chỉ khi HĐ còn mở, ĐÃ DUYỆT và ĐÃ ĐÍNH KÈM ĐỦ hồ sơ bắt buộc.
 * Chuyến ghi từ trước giữ nguyên (không chặn sửa / theo dõi bước).
 */
export function shipmentGate(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): ShipmentGate {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || c.status !== "open") return { ok: false, reason: "not-open", missing: [] };
  if (!effectiveRevision(d, contractId)) return { ok: false, reason: "not-approved", missing: [] };
  const missing = missingAttachmentKinds(d, contractId, opts);
  return missing.length ? { ok: false, reason: "attachments-missing", missing } : { ok: true };
}

/** Câu giải thích vì sao chưa ghi chuyến được — cho nút / thẻ / tour. */
export function shipmentGateText(g: ShipmentGate): string {
  if (g.ok) return "";
  if (g.reason === "not-open") return "Hợp đồng đã đóng hoặc đã hủy.";
  if (g.reason === "not-approved") return "Hợp đồng chưa được Trưởng / Phó phòng Kế hoạch duyệt.";
  return `Còn thiếu hồ sơ đính kèm: ${g.missing.map((k) => CONTRACT_ATTACHMENT_LABELS[k]).join(", ")}.`;
}

/** Các lượt duyệt cuối của HĐ, cũ trước. */
export function finalReviewsOf(d: Pick<ExportData, "approvals">, contractId: string): ExportContractApproval[] {
  return d.approvals
    .filter((a) => a.contractId === contractId && a.stage === "final")
    .sort((a, b) => (a.decidedOn + a.createdAt).localeCompare(b.decidedOn + b.createdAt));
}

/**
 * Duyệt cuối được khi HĐ còn mở, đã qua bước Đính kèm, có ít nhất một chuyến còn mở và KHÔNG còn bản
 * sửa chờ duyệt. HĐ chưa
 * xuất đủ trong dung sai (đóng sớm: khách giảm lượng, phụ kiện…) ⇒ bắt lý do.
 */
export function finalReviewGate(d: ExportData, contractId: string, opts: EvidenceOptions = WITH_FILES): { ok: boolean; needsReason: boolean } {
  const st = contractState(d, contractId, opts);
  if (st !== "shipping" && st !== "final-review") return { ok: false, needsReason: false };
  if (!openShipmentsOf(d, contractId).length) return { ok: false, needsReason: false };
  // Còn bản sửa chờ duyệt ⇒ duyệt bản sửa trước (đóng HĐ khi bản sửa còn treo là bỏ qua nó).
  if (pendingRevision(d, contractId)) return { ok: false, needsReason: false };
  return { ok: true, needsReason: st !== "final-review" };
}

/** Nhật ký thao tác của MỘT hợp đồng, MỚI trước. */
export function activitiesOf(d: Pick<ExportData, "activities">, contractId: string): ExportActivity[] {
  return d.activities.filter((a) => a.contractId === contractId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- NV13: hủy / xóa ---------- */

/** "Chuyến đã đóng cont" = đã có số cont (hoặc biển số xe) — A9. */
export const isShipmentLoaded = (s: Pick<ExportShipment, "containerNo">) => !!s.containerNo.trim();

export function canDeleteContract(d: ExportData, contractId: string): { ok: boolean; reason?: string } {
  if (d.shipments.some((s) => s.contractId === contractId)) return { ok: false, reason: "has-shipments" };
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

export function canDeleteShipment(d: ExportData, shipmentId: string): boolean {
  if (d.files.some((f) => f.shipmentId === shipmentId)) return false;
  return !d.items.some((i) => i.shipmentId === shipmentId && i.state === "done");
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
] as const;

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

export function buildMonthExcel(plan: MonthPlan, d: ExportData): { header: string[]; rows: MonthExcelRow[] } {
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
        ],
      });
    }
  }
  return { header: [...MONTH_EXCEL_HEADER], rows };
}
