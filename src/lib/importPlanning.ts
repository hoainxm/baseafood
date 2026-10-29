// ============================================================
// Tên file: src/lib/importPlanning.ts
// Tên tiếng Việt: Luật Phòng Kế hoạch · Nhập khẩu — hợp đồng, lần nhập, chứng từ, thực nhập
// Description: Pure rules for the import planning module (wave 1): contract totals, validation,
//              receipt month, required documents, receipt / contract state, remaining kg,
//              close gate, delete gates, search and month view.
// ============================================================
// Oracle: docs/app-map/45-import-planning.ba-spec.md (R1…R22, AC-3…AC-18, AC-25…AC-33). Hàm THUẦN — màn chỉ
// gọi, không tự tính lại. Đổi luật ⇒ sửa test cùng thư mục (importPlanning.test.ts).
import type {
  ImportContract,
  ImportContractLine,
  ImportDocument,
  ImportDocumentKind,
  ImportFile,
  ImportReceipt,
  ImportReceiptLine,
  ImportSampleCheck,
  ImportSupplier,
  ImportTransport,
  ImportType,
  Product,
} from "@/types";

/* ---------- Nhãn ---------- */

export const IMPORT_TYPES: { value: ImportType; label: string }[] = [
  { value: "export-production", label: "Sản xuất xuất khẩu" },
  { value: "trading", label: "Kinh doanh" },
  { value: "processing", label: "Gia công" },
];
export const importTypeLabel = (t: ImportType | "") => IMPORT_TYPES.find((x) => x.value === t)?.label ?? "";

export const IMPORT_TRANSPORTS: { value: ImportTransport; label: string }[] = [
  { value: "20RF", label: "Cont lạnh 20" },
  { value: "40RF", label: "Cont lạnh 40" },
  { value: "lcl", label: "Hàng lẻ ghép cont" },
];
export const transportLabel = (t: ImportTransport) => IMPORT_TRANSPORTS.find((x) => x.value === t)?.label ?? t;

export const IMPORT_DOCUMENT_KINDS: { value: ImportDocumentKind; label: string }[] = [
  { value: "commercial-invoice", label: "Commercial Invoice" },
  { value: "packing-list", label: "Packing List" },
  { value: "import-declaration", label: "Tờ khai nhập khẩu" },
  { value: "certificate-of-origin", label: "C/O" },
  { value: "quarantine-certificate", label: "Giấy kiểm dịch" },
  { value: "bill-of-lading", label: "B/L" },
  { value: "other", label: "Chứng từ khác" },
];
export function documentLabel(d: Pick<ImportDocument, "kind" | "customName">): string {
  if (d.kind === "other" && d.customName.trim()) return d.customName.trim();
  return IMPORT_DOCUMENT_KINDS.find((x) => x.value === d.kind)?.label ?? d.kind;
}

/** R4 — chứng từ bắt buộc của mọi lần nhập, theo thứ tự. */
export const REQUIRED_DOCUMENT_KINDS: readonly ImportDocumentKind[] = ["commercial-invoice", "packing-list", "import-declaration"];
export const isRequiredKind = (k: ImportDocumentKind) => REQUIRED_DOCUMENT_KINDS.includes(k);

export type ReceiptState = "missing-docs" | "awaiting-quantity" | "complete" | "cancelled";
export const RECEIPT_STATE_LABELS: Record<ReceiptState, string> = {
  "missing-docs": "Thiếu chứng từ",
  "awaiting-quantity": "Chờ thực nhập",
  complete: "Đủ hồ sơ",
  cancelled: "Đã hủy",
};

export type ImportContractState = "no-receipts" | "receiving" | "closed" | "cancelled";
export const CONTRACT_STATE_LABELS: Record<ImportContractState, string> = {
  "no-receipts": "Chưa có lần nhập",
  receiving: "Đang nhập",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

/* ---------- Dữ liệu gộp ---------- */

export interface ImportData {
  contracts: ImportContract[];
  lines: ImportContractLine[];
  receipts: ImportReceipt[];
  receiptLines: ImportReceiptLine[];
  documents: ImportDocument[];
  files: ImportFile[];
  /**
   * `false` = chạy không nối máy chủ (không đính được file) ⇒ số chứng từ / ghi chú tính thay file
   * (như EvidenceOptions của Xuất khẩu). Bỏ trống = có kho file.
   */
  filesAvailable?: boolean;
  /** `false` = máy chủ chưa chạy 0084 (chưa có cột mặt hàng của dòng) ⇒ không bắt nối khi đóng HĐ (R22). */
  productLinkAvailable?: boolean;
  /** Danh mục Mặt hàng (R20) — có thì dòng trỏ mặt hàng đã xóa tính là chưa nối, tra số theo tên mặt hàng. */
  products?: readonly ImportProductRef[];
  /** Kiểm mẫu của kho theo lần nhập (v4, mig 0085) — chỉ lưu, không vào luật trạng thái (R23). */
  sampleChecks?: readonly ImportSampleCheck[];
}

/** Phần của mặt hàng danh mục mà Nhập khẩu cần (R20, R21). */
export type ImportProductRef = Pick<Product, "id" | "name" | "tradeName">;

export const EMPTY_IMPORT_DATA: ImportData = { contracts: [], lines: [], receipts: [], receiptLines: [], documents: [], files: [] };

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const key = (s: string) => s.trim().toLowerCase();

/* ---------- Hợp đồng (R2, R3) ---------- */

export function linesOf(d: Pick<ImportData, "lines">, contractId: string): ImportContractLine[] {
  return d.lines.filter((l) => l.contractId === contractId).sort((a, b) => a.lineNo - b.lineNo);
}

/* ---------- Nối mặt hàng (R20, R21 — v3) ---------- */

const nameKey = (v: string | undefined | null) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Mặt hàng đã nối của dòng; trỏ mặt hàng không còn trong danh mục ⇒ undefined (R20). */
export function lineProduct(d: Pick<ImportData, "products">, line: Pick<ImportContractLine, "productId">): ImportProductRef | undefined {
  if (!line.productId) return undefined;
  if (!d.products) return { id: line.productId, name: "", tradeName: "" };
  return d.products.find((p) => p.id === line.productId);
}

/** Dòng hàng của HĐ chưa nối mặt hàng (kể cả trỏ mặt hàng đã xóa). */
export function unlinkedLines(d: Pick<ImportData, "lines" | "products">, contractId: string): ImportContractLine[] {
  return linesOf(d, contractId).filter((l) => !lineProduct(d, l));
}

/**
 * R21 — gợi ý mặt hàng cho tên hàng (bậc đầu tiên ra đúng MỘT): (1) cùng tên đã nối ở HĐ nhập trước,
 * cùng NCC thắng rồi HĐ mới nhất; (2) tên tiếng Anh mặc định trùng; (3) tên mặt hàng trùng. Không ra ⇒ "".
 */
export function suggestImportProductId(
  d: Pick<ImportData, "contracts" | "lines">,
  productName: string,
  supplierId: string,
  products: readonly ImportProductRef[],
  excludeContractId = "",
): string {
  const key = nameKey(productName);
  if (!key) return "";
  const known = new Set(products.map((p) => p.id));
  const contractOf = new Map(d.contracts.map((c) => [c.id, c]));
  let best: { productId: string; score: number; at: string } | null = null;
  for (const l of d.lines) {
    if (!l.productId || !known.has(l.productId) || l.contractId === excludeContractId || nameKey(l.productName) !== key) continue;
    const c = contractOf.get(l.contractId);
    if (!c || c.status === "cancelled") continue;
    const score = supplierId && c.supplierId === supplierId ? 1 : 0;
    const at = c.signedDate || c.createdAt;
    if (!best || score > best.score || (score === best.score && at > best.at)) best = { productId: l.productId, score, at };
  }
  if (best) return best.productId;
  const byTrade = products.filter((p) => nameKey(p.tradeName) === key);
  if (byTrade.length) return byTrade.length === 1 ? byTrade[0].id : "";
  const byName = products.filter((p) => nameKey(p.name) === key);
  return byName.length === 1 ? byName[0].id : "";
}

/** Chọn mặt hàng khi ô tên hàng còn trống ⇒ tên tiếng Anh mặc định, không có thì tên mặt hàng (R21). */
export const productNameAfterPick = (current: string, product: ImportProductRef | undefined) =>
  current.trim() || !product ? current : product.tradeName?.trim() || product.name;

/** R2 — thành tiền dòng = kg × đơn giá (2 số lẻ); không có giá ⇒ null. */
export function lineAmount(line: Pick<ImportContractLine, "id" | "kg">, prices: Record<string, number | null>): number | null {
  const price = prices[line.id];
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return round2(num(line.kg) * price);
}

export interface ImportContractTotals {
  totalKg: number;
  /** null khi không dòng nào có giá (HĐ gia công). */
  totalAmount: number | null;
}

export function contractTotals(lines: readonly Pick<ImportContractLine, "id" | "kg">[], prices: Record<string, number | null>): ImportContractTotals {
  let totalKg = 0;
  let totalAmount: number | null = null;
  for (const l of lines) {
    totalKg += num(l.kg);
    const a = lineAmount(l, prices);
    if (a !== null) totalAmount = round2((totalAmount ?? 0) + a);
  }
  return { totalKg: round2(totalKg), totalAmount };
}

export interface ImportIssue {
  code: string;
  message: string;
}

/**
 * Kiểm HĐ trước khi lưu. `others` = các HĐ khác đã có (để chặn trùng số theo đối tác, R3).
 * `d` (nếu có) ⇒ chặn bỏ dòng hàng đã có thực nhập (R8).
 */
export function validateContract(
  c: Pick<ImportContract, "id" | "supplierId" | "contractNo" | "signedDate" | "importType">,
  lines: readonly Pick<ImportContractLine, "id" | "productName" | "kg">[],
  others: readonly Pick<ImportContract, "id" | "supplierId" | "contractNo" | "status">[],
  d?: Pick<ImportData, "lines" | "receipts" | "receiptLines">,
): ImportIssue[] {
  const out: ImportIssue[] = [];
  if (!c.supplierId) out.push({ code: "supplier", message: "Chọn đối tác (NCC nhập khẩu)." });
  if (!c.contractNo.trim()) out.push({ code: "contract-no", message: "Nhập số hợp đồng." });
  if (!c.signedDate) out.push({ code: "signed-date", message: "Nhập ngày ký." });
  if (!c.importType) out.push({ code: "import-type", message: "Chọn loại hình nhập." });
  if (lines.length === 0) out.push({ code: "no-lines", message: "Hợp đồng cần ít nhất một dòng hàng." });
  lines.forEach((l, i) => {
    if (!l.productName.trim()) out.push({ code: "line-name", message: `Dòng ${i + 1}: nhập tên hàng.` });
    if (!(num(l.kg) > 0)) out.push({ code: "line-kg", message: `Dòng ${i + 1}: số lượng (kg) phải lớn hơn 0.` });
  });
  if (c.supplierId && c.contractNo.trim()) {
    const dup = others.some(
      (o) => o.id !== c.id && o.status !== "cancelled" && o.supplierId === c.supplierId && key(o.contractNo) === key(c.contractNo),
    );
    if (dup) out.push({ code: "duplicate-no", message: "Đối tác này đã có hợp đồng cùng số." });
  }
  if (d) {
    const keep = new Set(lines.map((l) => l.id));
    const removed = d.lines.filter((l) => l.contractId === c.id && !keep.has(l.id));
    const hit = removed.find((l) => receivedKg(d, l.id) > 0);
    if (hit) out.push({ code: "line-has-receipts", message: `Dòng "${hit.productName}" đã có thực nhập, không bỏ được.` });
  }
  return out;
}

export function findContract(d: Pick<ImportData, "contracts">, id: string): ImportContract | undefined {
  return d.contracts.find((c) => c.id === id);
}

/* ---------- Lần nhập (R1) ---------- */

/** R1 — tháng của lần nhập = tháng(ngày về kho) ?? tháng(ngày dự kiến về). */
export function importMonth(r: Pick<ImportReceipt, "arrivalDate" | "expectedDate">): string {
  return (r.arrivalDate || r.expectedDate || "").slice(0, 7);
}

export function validateReceipt(
  r: Pick<ImportReceipt, "contractId" | "arrivalDate" | "expectedDate">,
  contract: Pick<ImportContract, "status"> | undefined,
  isNew: boolean,
): ImportIssue[] {
  const out: ImportIssue[] = [];
  if (!r.contractId || !contract) out.push({ code: "contract", message: "Chọn hợp đồng." });
  else if (isNew && contract.status !== "open") out.push({ code: "contract-closed", message: "Hợp đồng đã đóng hoặc đã hủy, không ghi lần nhập mới." });
  if (!r.arrivalDate && !r.expectedDate) out.push({ code: "no-date", message: "Nhập ngày về kho hoặc ngày dự kiến về." });
  return out;
}

export function receiptsOf(d: Pick<ImportData, "receipts">, contractId: string, includeCancelled = false): ImportReceipt[] {
  return d.receipts
    .filter((r) => r.contractId === contractId && (includeCancelled || r.status !== "cancelled"))
    .sort((a, b) => importMonth(a).localeCompare(importMonth(b)) || a.createdAt.localeCompare(b.createdAt));
}

/** Mục chứng từ bắt buộc cho lần nhập mới (R4) — màn ghi cùng lúc với lần nhập. */
export function requiredDocumentStubs(receiptId: string, importType: ImportType | "", makeId: () => string, now: string): ImportDocument[] {
  return REQUIRED_DOCUMENT_KINDS.map((kind) => ({
    id: makeId(),
    receiptId,
    kind,
    customName: "",
    docNo: "",
    docDate: "",
    importType: kind === "import-declaration" ? importType : "",
    notApplicable: false,
    naReason: "",
    note: "",
    createdAt: now,
  }));
}

/* ---------- Chứng từ (R4) ---------- */

export function documentsOf(d: Pick<ImportData, "documents">, receiptId: string): ImportDocument[] {
  const order = (k: ImportDocumentKind) => IMPORT_DOCUMENT_KINDS.findIndex((x) => x.value === k);
  return d.documents.filter((x) => x.receiptId === receiptId).sort((a, b) => order(a.kind) - order(b.kind) || a.createdAt.localeCompare(b.createdAt));
}

export function filesOfDocument(d: Pick<ImportData, "files">, documentId: string): ImportFile[] {
  return d.files.filter((f) => f.documentId === documentId);
}

export function contractFiles(d: Pick<ImportData, "files">, contractId: string): ImportFile[] {
  // File của lần nhập không thuộc mục chứng từ (báo cáo kiểm mẫu của kho, v4) không phải file HĐ.
  return d.files.filter((f) => f.contractId === contractId && !f.documentId && !f.receiptId);
}

/** R4 — mục "Đã có": ≥ 1 file (không nối máy chủ: số hoặc ghi chú); tờ khai thêm số + loại hình. */
export function documentHasEvidence(d: Pick<ImportData, "files" | "filesAvailable">, doc: ImportDocument): boolean {
  const proof = d.filesAvailable === false ? !!doc.docNo.trim() || !!doc.note.trim() : filesOfDocument(d, doc.id).length > 0;
  if (!proof) return false;
  if (doc.kind === "import-declaration") return !!doc.docNo.trim() && !!doc.importType;
  return true;
}

/** Mục đã xong cho việc tính đủ chứng từ: "Đã có", hoặc "Không áp dụng" có lý do. */
export function documentSatisfied(d: Pick<ImportData, "files" | "filesAvailable">, doc: ImportDocument): boolean {
  if (doc.notApplicable) return !!doc.naReason.trim();
  return documentHasEvidence(d, doc);
}

/** "Không áp dụng" chỉ được khi có lý do (R4). */
export function canMarkNotApplicable(reason: string): { ok: boolean } {
  return { ok: !!reason.trim() };
}

/** R4 — các loại bắt buộc chưa xong (thiếu mục cũng tính là thiếu). */
export function missingDocs(d: Pick<ImportData, "documents" | "files" | "filesAvailable">, receiptId: string): ImportDocumentKind[] {
  const docs = documentsOf(d, receiptId);
  return REQUIRED_DOCUMENT_KINDS.filter((k) => !docs.some((x) => x.kind === k && documentSatisfied(d, x)));
}

/** Mục bắt buộc không xóa được (R4). */
export const canDeleteDocument = (doc: Pick<ImportDocument, "kind">) => !isRequiredKind(doc.kind);

/* ---------- Thực nhập (R5) ---------- */

export function receiptLinesOf(d: Pick<ImportData, "receiptLines">, receiptId: string): ImportReceiptLine[] {
  return d.receiptLines.filter((x) => x.receiptId === receiptId);
}

/** Σ kg thực nhập của một dòng HĐ ở các lần nhập chưa hủy. */
export function receivedKg(d: Pick<ImportData, "receipts" | "receiptLines">, contractLineId: string): number {
  const live = new Set(d.receipts.filter((r) => r.status !== "cancelled").map((r) => r.id));
  return round2(d.receiptLines.filter((x) => x.contractLineId === contractLineId && live.has(x.receiptId)).reduce((s, x) => s + num(x.kg), 0));
}

/** Còn lại = kg HĐ − Σ thực nhập; âm = vượt HĐ. */
export function remainingKg(d: Pick<ImportData, "lines" | "receipts" | "receiptLines">, contractLineId: string): number {
  const line = d.lines.find((l) => l.id === contractLineId);
  return round2(num(line?.kg) - receivedKg(d, contractLineId));
}

export interface ContractProgress {
  totalKg: number;
  receivedKg: number;
  /** Σ phần còn thiếu của các dòng chưa đủ (không trừ phần vượt của dòng khác). */
  shortKg: number;
  lines: { line: ImportContractLine; receivedKg: number; remainingKg: number }[];
}

export function contractProgress(d: ImportData, contractId: string): ContractProgress {
  const lines = linesOf(d, contractId).map((line) => ({ line, receivedKg: receivedKg(d, line.id), remainingKg: remainingKg(d, line.id) }));
  return {
    totalKg: round2(lines.reduce((s, x) => s + num(x.line.kg), 0)),
    receivedKg: round2(lines.reduce((s, x) => s + x.receivedKg, 0)),
    shortKg: round2(lines.reduce((s, x) => s + Math.max(0, x.remainingKg), 0)),
    lines,
  };
}

export interface QuantityWarning {
  code: "over-contract";
  contractLineId: string;
  overKg: number;
  blocking: false;
}

/** R5 — vượt kg HĐ chỉ cảnh báo, không chặn. Tính trên dữ liệu ĐÃ gồm lần ghi đang kiểm. */
export function quantityWarnings(d: Pick<ImportData, "lines" | "receipts" | "receiptLines">, receiptId: string): QuantityWarning[] {
  const ids = new Set(d.receiptLines.filter((x) => x.receiptId === receiptId).map((x) => x.contractLineId));
  const out: QuantityWarning[] = [];
  for (const id of ids) {
    const rem = remainingKg(d, id);
    if (rem < 0) out.push({ code: "over-contract", contractLineId: id, overKg: round2(-rem), blocking: false });
  }
  return out;
}

/* ---------- Trạng thái (R6) ---------- */

export function receiptState(d: Pick<ImportData, "documents" | "files" | "receiptLines" | "filesAvailable">, r: ImportReceipt): ReceiptState {
  if (r.status === "cancelled") return "cancelled";
  if (missingDocs(d, r.id).length > 0) return "missing-docs";
  if (!receiptLinesOf(d, r.id).some((x) => num(x.kg) > 0)) return "awaiting-quantity";
  return "complete";
}

export function contractState(d: Pick<ImportData, "receipts">, c: Pick<ImportContract, "id" | "status">): ImportContractState {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "closed") return "closed";
  return d.receipts.some((r) => r.contractId === c.id && r.status !== "cancelled") ? "receiving" : "no-receipts";
}

/* ---------- Đóng HĐ (R7) ---------- */

export interface CloseGate {
  ok: boolean;
  needsReason: boolean;
  reason?: "no-receipts" | "not-open" | "unlinked-lines";
  /** Dòng chưa nối mặt hàng khi `reason == "unlinked-lines"` (R7 v3). */
  unlinkedLines?: ImportContractLine[];
}

export function closeGate(d: ImportData, contractId: string): CloseGate {
  const c = findContract(d, contractId);
  if (!c || c.status !== "open") return { ok: false, needsReason: false, reason: "not-open" };
  if (contractState(d, c) === "no-receipts") return { ok: false, needsReason: false, reason: "no-receipts" };
  if (d.productLinkAvailable !== false) {
    const unlinked = unlinkedLines(d, contractId);
    if (unlinked.length) return { ok: false, needsReason: false, reason: "unlinked-lines", unlinkedLines: unlinked };
  }
  return { ok: true, needsReason: contractProgress(d, contractId).shortKg > 0 };
}

/** Đóng được với lý do đã gõ? (bắt lý do khi còn dòng chưa về đủ). */
export function canClose(d: ImportData, contractId: string, reason: string): { ok: boolean; needsReason: boolean } {
  const g = closeGate(d, contractId);
  if (!g.ok) return { ok: false, needsReason: g.needsReason };
  return { ok: !g.needsReason || !!reason.trim(), needsReason: g.needsReason };
}

/* ---------- Xóa / hủy (NI9) ---------- */

export function canDeleteReceipt(d: Pick<ImportData, "files" | "receiptLines" | "sampleChecks">, receiptId: string): boolean {
  if (d.files.some((f) => f.receiptId === receiptId)) return false;
  if (d.sampleChecks?.some((x) => x.receiptId === receiptId)) return false;
  return !d.receiptLines.some((x) => x.receiptId === receiptId && num(x.kg) > 0);
}

export function canDeleteContract(d: Pick<ImportData, "receipts">, contractId: string): boolean {
  return !d.receipts.some((r) => r.contractId === contractId);
}

/** Hủy cần lý do. */
export const canCancel = (reason: string) => ({ ok: !!reason.trim() });

/* ---------- Tra cứu + tháng (NI7) ---------- */

export interface SearchHit {
  kind: "receipt" | "contract";
  id: string;
  contractId: string;
}

/** Tra mọi tháng theo số HĐ / invoice / tờ khai / số cont / B/L (không phân hoa thường, bỏ khoảng trắng). */
export function searchImports(d: ImportData, query: string): SearchHit[] {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (!q) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const hits: SearchHit[] = [];
  for (const r of d.receipts) {
    const docs = d.documents.filter((x) => x.receiptId === r.id).map((x) => x.docNo);
    if ([r.containerNo, r.blNo, ...docs].some((s) => s && norm(s).includes(q))) hits.push({ kind: "receipt", id: r.id, contractId: r.contractId });
  }
  for (const c of d.contracts) {
    // v3: cả tên hàng trên HĐ và tên mặt hàng đã nối (R20).
    const names = linesOf(d, c.id).flatMap((l) => {
      const p = lineProduct(d, l);
      return [l.productName, p?.name ?? "", p?.tradeName ?? ""];
    });
    if ([c.contractNo, ...names].some((s) => s && norm(s).includes(q))) hits.push({ kind: "contract", id: c.id, contractId: c.id });
  }
  return hits;
}

export interface MonthGroup {
  supplierName: string;
  receipts: { receipt: ImportReceipt; state: ReceiptState; missing: ImportDocumentKind[] }[];
}

export interface MonthView {
  groups: MonthGroup[];
  stats: { total: number; complete: number; incomplete: number };
}

/** Lần nhập chưa hủy của tháng, gom theo đối tác (A → Z); `supplierId` lọc theo đối tác. */
export function monthView(d: ImportData, month: string, supplierId = ""): MonthView {
  const byContract = new Map(d.contracts.map((c) => [c.id, c]));
  const rows = d.receipts
    .filter((r) => r.status !== "cancelled" && importMonth(r) === month)
    .filter((r) => !supplierId || byContract.get(r.contractId)?.supplierId === supplierId)
    .sort((a, b) => (a.arrivalDate || a.expectedDate).localeCompare(b.arrivalDate || b.expectedDate));
  const map = new Map<string, MonthGroup>();
  let complete = 0;
  for (const r of rows) {
    const name = byContract.get(r.contractId)?.supplierName || r.supplierName || "—";
    const g = map.get(name) ?? { supplierName: name, receipts: [] };
    const state = receiptState(d, r);
    if (state === "complete") complete += 1;
    g.receipts.push({ receipt: r, state, missing: missingDocs(d, r.id) });
    map.set(name, g);
  }
  const groups = [...map.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName, "vi"));
  return { groups, stats: { total: rows.length, complete, incomplete: rows.length - complete } };
}

/* ---------- Danh mục NCC nhập khẩu (v2 — R15–R17) ---------- */

export function emptyImportSupplier(id: string): ImportSupplier {
  return {
    id,
    code: "",
    shortName: "",
    fullName: "",
    country: "",
    address: "",
    taxId: "",
    mainProducts: "",
    loadingPort: "",
    contactName: "",
    contactTitle: "",
    email: "",
    phone: "",
    website: "",
    bankName: "",
    bankAccount: "",
    swiftCode: "",
    bankAddress: "",
    status: "active",
    note: "",
  };
}

/** R16 — tên gọi tắt bắt buộc, không trùng (không phân hoa thường, bỏ khoảng trắng đầu / cuối). */
export function validateImportSupplier(x: Pick<ImportSupplier, "id" | "shortName">, rows: readonly Pick<ImportSupplier, "id" | "shortName">[]): ImportIssue[] {
  if (!x.shortName.trim()) return [{ code: "name", message: "Nhập tên gọi tắt của nhà cung cấp." }];
  if (rows.some((r) => r.id !== x.id && key(r.shortName) === key(x.shortName))) return [{ code: "duplicate-name", message: "Đã có nhà cung cấp cùng tên gọi tắt." }];
  return [];
}

/** R17 — NCC đã có HĐ nhập (kể cả đã hủy) không xóa được, chỉ chuyển Ngừng giao dịch. */
export const canDeleteImportSupplier = (contracts: readonly Pick<ImportContract, "supplierId">[], supplierId: string) => !contracts.some((c) => c.supplierId === supplierId);

/** NCC chọn được cho HĐ: đang giao dịch, cộng NCC đang gắn với HĐ đang sửa (giữ tên HĐ cũ). */
export function selectableImportSuppliers<T extends Pick<ImportSupplier, "id" | "status">>(rows: readonly T[], currentId = ""): T[] {
  return rows.filter((r) => r.status !== "inactive" || r.id === currentId);
}
