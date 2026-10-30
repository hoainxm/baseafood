// ============================================================
// Tên file: src/lib/supplierInvoice.ts
// Tên tiếng Việt: Gắn hóa đơn đại lý vào chuyến nhập — đọc sổ chi tiết NL + PDF, ghép, trạng thái
// Description: Pure rules for ba-spec 51 (docs/app-map/51-supplier-invoice-matching.ba-spec.md):
//              parse the accounting "sổ chi tiết NL" sheets, parse VAT-invoice PDF text, match ledger
//              rows ⇄ trip lines (R4/R5), plan re-imports without duplicates (R9), match PDF ⇄ invoice
//              (R7), trip invoice status (R11), build the "updated from invoice" edit and the
//              trip-from-invoice. No I/O — files are opened by lib/supplierInvoiceFiles.ts.
// ============================================================
import type {
  AccountingCodeMap,
  Category,
  ImportShipment,
  MaterialImportItem,
  Supplier,
  SupplierInvoice,
  SupplierInvoiceLine,
  SupplierInvoicePdfLine,
  Workshop,
} from "@/types";
import { formatDateVN, num } from "./format";

// ---------- Nhãn ----------

/** Kết quả ghép của một dòng sổ chi tiết (design-spec 52 §4). */
export type InvoiceLineState =
  | "matched"
  | "price-mismatch"
  | "quantity-mismatch"
  | "no-trip"
  | "not-trip"
  | "unmapped"
  | "updated"
  | "explained";

export const SUPPLIER_INVOICE_LINE_STATE_LABELS: Record<InvoiceLineState, string> = {
  matched: "Khớp",
  "price-mismatch": "Lệch giá",
  "quantity-mismatch": "Lệch kg",
  "no-trip": "Không có chuyến",
  "not-trip": "Không thuộc chuyến",
  unmapped: "Chưa ánh xạ",
  updated: "Đã cập nhật theo HĐ",
  explained: "Lệch đã giải trình",
};

/** Trạng thái hóa đơn của một chuyến (R11). */
export type TripInvoiceStatus = "awaiting" | "partial" | "mismatch" | "complete";

export const TRIP_INVOICE_STATUS_LABELS: Record<TripInvoiceStatus, string> = {
  awaiting: "Chờ HĐ",
  partial: "Thiếu HĐ một phần",
  mismatch: "Lệch HĐ",
  complete: "Đã có HĐ",
};

/** Nạp lại: dòng so với lần nạp trước (R9). */
export type ImportChange = "new" | "changed" | "same" | "missing";

export const IMPORT_CHANGE_LABELS: Record<ImportChange, string> = {
  new: "Mới",
  changed: "Đổi",
  same: "Như cũ",
  missing: "Không còn trong file",
};

// ---------- Tiện ích ----------

const digits = (s: string) => s.replace(/\D/g, "");
export const normalizePlateKey = (s: string) => s.replace(/[\s.\-']/g, "").toUpperCase();
const normHeader = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9<>]/g, "");

/** Số kiểu Việt: "1.707" = 1707 · "1.707,5" = 1707.5 · số thật giữ nguyên. */
export function parseVnAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v ?? "").trim();
  if (!t) return null;
  const x = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

/** Ô ngày của Excel (số serial, Date, "dd/mm/yyyy" hoặc "yyyy-mm-dd") ⇒ yyyy-mm-dd. */
export function excelDateToIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v + 0.0001) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS dựng Date lệch vài chục giây theo múi giờ (37-doi-soat) ⇒ làm tròn tới phút rồi lấy ngày địa phương.
    const d = new Date(Math.round(v.getTime() / 600000) * 600000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

/** id cố định của HĐ (R1) — nạp lại / hai máy cùng nạp ⇒ cùng một bản ghi. */
export const supplierInvoiceId = (accountingCode: string, year: number, invoiceNo: string) =>
  `sinv:${accountingCode}:${year}:${invoiceNo}`;
export const accountingCodeMapId = (kind: AccountingCodeMap["kind"], code: string) => `acm:${kind}:${code}`;

// ---------- 1. Sổ chi tiết NL (Excel kế toán) ----------

export interface LedgerRow {
  sheet: string;
  /** Số dòng trên sheet (1 = dòng đầu) — để báo lỗi. */
  rowNo: number;
  postingDate: string;
  voucherNo: string;
  content: string;
  supplierCode: string;
  materialCode: string;
  quantityKg: number;
  unitPrice: number;
  amount: number;
  invoiceNo: string;
  deliveryDate: string;
  driverName: string;
  licensePlate: string;
}

export interface LedgerParse {
  rows: LedgerRow[];
  /** Câu báo cho người dùng (sheet không nhận ra, dòng thiếu số HĐ…). */
  warnings: string[];
}

/** Tài xế + biển số trong cột NOI DUNG: "… (người giao Phạm Hoàng Khánh - số xe 72B 04168)". */
export function parseDeliveryNote(content: string): { driverName: string; licensePlate: string } {
  const m = content.match(/người giao\s+(.+?)\s*-\s*số xe\s+([^)]+)/i);
  return m ? { driverName: m[1].trim(), licensePlate: m[2].trim() } : { driverName: "", licensePlate: "" };
}

const LEDGER_COLUMNS = {
  postingDate: "ngay",
  voucherNo: "phieu",
  content: "noidung",
  supplierCode: "madm",
  unitPrice: "dgnhap",
  quantityKg: "slnhap",
  amount: "stiennhap",
  materialCode: "dmno",
  invoiceNo: "sohd",
  deliveryDate: "ngayhd",
} as const;

/** Đọc các sheet của file sổ chi tiết NL. Sheet nhận ra nhờ dòng tiêu đề có PHIEU + MADM + Số HĐ (A5). */
export function parseLedgerSheets(sheets: readonly { name: string; rows: readonly (readonly unknown[])[] }[]): LedgerParse {
  const rows: LedgerRow[] = [];
  const warnings: string[] = [];
  for (const sh of sheets) {
    const headerIdx = sh.rows.findIndex((r) => {
      const h = r.map(normHeader);
      return h.includes("phieu") && h.includes("madm") && h.includes("sohd");
    });
    if (headerIdx < 0) {
      if (sh.rows.length) warnings.push(`Sheet "${sh.name}" không có dòng tiêu đề PHIEU · MADM · Số HĐ — bỏ qua.`);
      continue;
    }
    const header = sh.rows[headerIdx].map(normHeader);
    const col = Object.fromEntries(Object.entries(LEDGER_COLUMNS).map(([k, v]) => [k, header.indexOf(v)])) as Record<keyof typeof LEDGER_COLUMNS, number>;
    const missing = Object.entries(col).filter(([, i]) => i < 0).map(([k]) => k);
    if (missing.length) {
      warnings.push(`Sheet "${sh.name}" thiếu cột: ${missing.join(", ")} — bỏ qua.`);
      continue;
    }
    for (let i = headerIdx + 1; i < sh.rows.length; i++) {
      const r = sh.rows[i];
      const get = (k: keyof typeof LEDGER_COLUMNS) => r[col[k]];
      const quantityKg = parseVnAmount(get("quantityKg")) ?? 0;
      if (quantityKg <= 0) continue; // dòng xuất / dòng trống / dòng cộng
      const invoiceNo = String(get("invoiceNo") ?? "").trim();
      const supplierCode = String(get("supplierCode") ?? "").trim();
      if (!invoiceNo || !supplierCode) {
        warnings.push(`Sheet "${sh.name}" dòng ${i + 1}: thiếu ${!invoiceNo ? "số HĐ" : "mã đại lý"} — bỏ qua.`);
        continue;
      }
      const content = String(get("content") ?? "");
      const deliveryDate = excelDateToIso(get("deliveryDate"));
      const postingDate = excelDateToIso(get("postingDate"));
      if (!deliveryDate || !postingDate) {
        warnings.push(`Sheet "${sh.name}" dòng ${i + 1}: không đọc được ${!deliveryDate ? "Ngày HĐ" : "NGAY"} — bỏ qua.`);
        continue;
      }
      const unitPrice = parseVnAmount(get("unitPrice")) ?? 0;
      rows.push({
        sheet: sh.name,
        rowNo: i + 1,
        postingDate,
        voucherNo: String(get("voucherNo") ?? "").trim(),
        content,
        supplierCode,
        materialCode: String(get("materialCode") ?? "").trim(),
        quantityKg,
        unitPrice,
        amount: parseVnAmount(get("amount")) ?? quantityKg * unitPrice,
        invoiceNo,
        deliveryDate,
        ...parseDeliveryNote(content),
      });
    }
  }
  return { rows, warnings };
}

// ---------- 2. PDF hóa đơn GTGT ----------

export interface PdfInvoice {
  invoiceNo: string;
  invoiceSymbol: string;
  issueDate: string;
  sellerTaxId: string;
  buyerTaxId: string;
  lines: SupplierInvoicePdfLine[];
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
}

/** Tên file kiểu cổng HĐĐT: `936_1C26THP_3500424838.pdf` ⇒ số · ký hiệu · MST người bán. */
export function parseInvoiceFileName(fileName: string): { invoiceNo: string; invoiceSymbol: string; sellerTaxId: string } | null {
  const m = fileName.match(/^0*(\d+)_([0-9A-Z]{4,10})_(\d{10}(?:-?\d{3})?)\.pdf$/i);
  return m ? { invoiceNo: m[1], invoiceSymbol: m[2].toUpperCase(), sellerTaxId: digits(m[3]) } : null;
}

const MONEY = "([\\d.]+(?:,\\d+)?)";

/** Đọc chữ của PDF hóa đơn GTGT (mỗi phần tử = một dòng chữ). Thiếu trường ⇒ để trống / null. */
export function parseVatInvoiceText(lines: readonly string[]): PdfInvoice {
  const text = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const all = text.join("\n");
  const pick = (re: RegExp) => all.match(re)?.[1] ?? "";
  const date = all.match(/Ngày\s*(?:\(Date\))?\s*(\d{1,2})\s*tháng\s*(?:\(month\))?\s*(\d{1,2})\s*năm\s*(?:\(year\))?\s*(\d{4})/i);
  const taxIds = [...all.matchAll(/Mã số thuế[^:\n]*:\s*([\d -]{10,24})/gi)].map((m) => digits(m[1])).filter((t) => t.length >= 10);
  const pdfLines: SupplierInvoicePdfLine[] = [];
  const lineRe = new RegExp(`^\\d{1,3}\\s+(.+?)\\s+(kg|kgs|kilogam|tấn|con)\\s+${MONEY}\\s+${MONEY}\\s+${MONEY}$`, "i");
  for (const l of text) {
    const m = l.match(lineRe);
    if (!m) continue;
    pdfLines.push({
      name: m[1].trim(),
      unit: m[2],
      quantity: parseVnAmount(m[3]) ?? 0,
      unitPrice: parseVnAmount(m[4]) ?? 0,
      amount: parseVnAmount(m[5]) ?? 0,
    });
  }
  return {
    invoiceNo: pick(/Số\s*\(No\.?\)\s*:?\s*0*(\d+)/i) || pick(/\bSố\s*:\s*0*(\d+)/i),
    invoiceSymbol: (pick(/Ký hiệu\s*(?:\(Serial\))?\s*:?\s*([0-9A-Z]{6,10})/i) || "").toUpperCase(),
    issueDate: date ? `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}` : "",
    sellerTaxId: taxIds[0] ?? "",
    buyerTaxId: taxIds[1] ?? "",
    lines: pdfLines,
    subtotal: parseVnAmount(pick(new RegExp(`Cộng tiền hàng[^:\\n]*:\\s*${MONEY}`, "i"))),
    vatAmount: parseVnAmount(pick(new RegExp(`Tiền thuế GTGT[^:\\n]*:\\s*${MONEY}`, "i"))),
    totalAmount: parseVnAmount(pick(new RegExp(`Tổng cộng tiền thanh toán[^:\\n]*:\\s*${MONEY}`, "i"))),
  };
}

// ---------- 3. Ánh xạ mã ----------

export interface CodeMaps {
  supplierByCode: Map<string, string>;
  materialByCode: Map<string, string>;
}

export function buildCodeMaps(maps: readonly AccountingCodeMap[]): CodeMaps {
  const supplierByCode = new Map<string, string>();
  const materialByCode = new Map<string, string>();
  for (const m of maps) {
    if (!m.targetName) continue;
    (m.kind === "supplier" ? supplierByCode : materialByCode).set(m.code, m.targetName);
  }
  return { supplierByCode, materialByCode };
}

/** Mã kế toán trong file chưa có ánh xạ (NV2). */
export function unmappedCodes(rows: readonly LedgerRow[], maps: CodeMaps): { suppliers: string[]; materials: string[] } {
  const s = new Set<string>();
  const m = new Set<string>();
  for (const r of rows) {
    if (!maps.supplierByCode.has(r.supplierCode)) s.add(r.supplierCode);
    if (!maps.materialByCode.has(r.materialCode)) m.add(r.materialCode);
  }
  return { suppliers: [...s].sort(), materials: [...m].sort() };
}

/** Gợi ý đại lý cho một mã kế toán: tên ngắn / tên hóa đơn chứa phần chữ của mã (HONG-PHU ~ "Hồng Phú"). */
export function suggestSupplierForCode(code: string, suppliers: readonly Supplier[]): string {
  const key = normHeader(code);
  if (!key) return "";
  const hit = suppliers.find((s) => [s.shortName, s.billingName, s.code].some((x) => x && normHeader(x).includes(key)));
  return hit?.shortName ?? "";
}

// ---------- 4. Ghép dòng sổ chi tiết ⇄ dòng chuyến (R4, R5) ----------

export interface LineMatch {
  state: InvoiceLineState;
  tripLineId: string;
  tripKg: number | null;
  tripPrice: number | null;
}

interface MatchInput {
  key: string;
  supplierName: string;
  materialName: string;
  deliveryDate: string;
  quantityKg: number;
  unitPrice: number;
  licensePlate: string;
  driverName: string;
  /** Liên kết đã có từ lần nạp trước — giữ nếu dòng chuyến còn (ổn định khi nạp lại). */
  keepTripLineId?: string;
}

/**
 * Ghép từng dòng vào dòng chuyến cùng đại lý + ngày giao == "Ngày HĐ" + cùng loại (R4).
 * Thứ tự ưu tiên: liên kết cũ → kg + giá bằng → kg bằng → biển số / tài xế trùng → ứng viên duy nhất.
 * `taken` = dòng chuyến đã gắn dòng HĐ khác (ngoài lần ghép này) ⇒ không dùng lại (R5).
 */
export function matchLinesToTrips(
  inputs: readonly MatchInput[],
  tripLines: readonly MaterialImportItem[],
  taken: ReadonlySet<string> = new Set(),
): Map<string, LineMatch> {
  const out = new Map<string, LineMatch>();
  const used = new Set(taken);
  const byId = new Map(tripLines.map((t) => [t.id, t]));
  const bucketKey = (sup: string, date: string, mat: string) => `${sup}|${date}|${mat}`;
  const buckets = new Map<string, MaterialImportItem[]>();
  for (const t of tripLines) {
    const k = bucketKey(t.supplierName, t.deliveryDate, t.materialTypeName);
    buckets.set(k, [...(buckets.get(k) ?? []), t]);
  }
  const set = (inp: MatchInput, t: MaterialImportItem | undefined, mismatch: "price" | "quantity" | null) => {
    if (!t) {
      out.set(inp.key, { state: "no-trip", tripLineId: "", tripKg: null, tripPrice: null });
      return;
    }
    used.add(t.id);
    const state: InvoiceLineState =
      mismatch === "quantity" || t.quantityKg !== inp.quantityKg ? "quantity-mismatch" : (t.unitPrice ?? null) !== inp.unitPrice ? "price-mismatch" : "matched";
    out.set(inp.key, { state, tripLineId: t.id, tripKg: t.quantityKg, tripPrice: t.unitPrice ?? null });
  };
  const free = (inp: MatchInput) => (buckets.get(bucketKey(inp.supplierName, inp.deliveryDate, inp.materialName)) ?? []).filter((t) => !used.has(t.id));
  let pending = [...inputs];
  // Pass 0: giữ liên kết cũ.
  pending = pending.filter((inp) => {
    const t = inp.keepTripLineId ? byId.get(inp.keepTripLineId) : undefined;
    if (!t || used.has(t.id)) return true;
    set(inp, t, null);
    return false;
  });
  // Pass 1: kg + giá bằng nhau. Pass 2: kg bằng nhau.
  for (const exactPrice of [true, false]) {
    pending = pending.filter((inp) => {
      const t = free(inp).find((c) => c.quantityKg === inp.quantityKg && (!exactPrice || c.unitPrice === inp.unitPrice));
      if (!t) return true;
      set(inp, t, null);
      return false;
    });
  }
  // Pass 3: kg khác — biển số / tài xế trùng, hoặc ứng viên duy nhất cho dòng duy nhất còn lại của nhóm.
  for (const inp of pending) {
    const cands = free(inp);
    const plate = normalizePlateKey(inp.licensePlate);
    const byPlate = plate ? cands.filter((c) => normalizePlateKey(c.licensePlate) === plate) : [];
    const byDriver = inp.driverName ? cands.filter((c) => c.driverName.trim().toLowerCase() === inp.driverName.trim().toLowerCase()) : [];
    const sameBucketLeft = pending.filter((p) => p.supplierName === inp.supplierName && p.deliveryDate === inp.deliveryDate && p.materialName === inp.materialName && !out.has(p.key));
    const pick = byPlate.length === 1 ? byPlate[0] : byDriver.length === 1 ? byDriver[0] : cands.length === 1 && sameBucketLeft.length === 1 ? cands[0] : undefined;
    set(inp, pick, pick ? "quantity" : null);
  }
  return out;
}

// ---------- 5. Kế hoạch nạp (R9) ----------

export interface PlannedLine {
  line: SupplierInvoiceLine;
  invoiceId: string;
  state: InvoiceLineState;
  change: ImportChange;
  tripKg: number | null;
  tripPrice: number | null;
  /** Tên loại NL xưởng (theo ánh xạ) — "" khi chưa ánh xạ. */
  materialName: string;
}

export interface ImportPlan {
  invoices: SupplierInvoice[];
  lines: PlannedLine[];
  unmapped: { suppliers: string[]; materials: string[] };
}

const blankInvoice = (id: string, p: Partial<SupplierInvoice>): SupplierInvoice => ({
  id,
  supplierName: "",
  accountingCode: "",
  invoiceNo: "",
  invoiceYear: 0,
  invoiceSymbol: "",
  issueDate: "",
  postingDate: "",
  voucherNo: "",
  sellerTaxId: "",
  subtotal: null,
  vatAmount: null,
  totalAmount: null,
  classification: "trip",
  classificationNote: "",
  pdfLines: [],
  filePath: "",
  fileName: "",
  note: "",
  ...p,
});

/**
 * Dựng HĐ + dòng từ sổ chi tiết, ghép vào chuyến, so với lần nạp trước. KHÔNG xóa gì:
 * dòng cũ không còn trong file ⇒ `missingFromFile` (liên kết giữ, A6).
 */
export function planLedgerImport(args: {
  ledgerRows: readonly LedgerRow[];
  maps: readonly AccountingCodeMap[];
  tripLines: readonly MaterialImportItem[];
  existingInvoices: readonly SupplierInvoice[];
  existingLines: readonly SupplierInvoiceLine[];
}): ImportPlan {
  const codeMaps = buildCodeMaps(args.maps);
  const invById = new Map(args.existingInvoices.map((x) => [x.id, x]));
  const oldLineById = new Map(args.existingLines.map((x) => [x.id, x]));
  const invoices = new Map<string, SupplierInvoice>();
  const fresh: { line: SupplierInvoiceLine; row: LedgerRow }[] = [];
  const ordinal = new Map<string, number>();
  for (const r of args.ledgerRows) {
    const year = Number(r.postingDate.slice(0, 4));
    const invoiceId = supplierInvoiceId(r.supplierCode, year, r.invoiceNo);
    const seen = invoices.get(invoiceId);
    if (seen) {
      // Dòng sau của cùng HĐ: giữ NGAY sớm nhất.
      if (r.postingDate < seen.postingDate) invoices.set(invoiceId, { ...seen, postingDate: r.postingDate });
    } else {
      const prev = invById.get(invoiceId);
      const fromFile = { supplierName: codeMaps.supplierByCode.get(r.supplierCode) ?? prev?.supplierName ?? "", postingDate: r.postingDate, voucherNo: r.voucherNo || prev?.voucherNo || "" };
      invoices.set(
        invoiceId,
        prev ? { ...prev, ...fromFile } : blankInvoice(invoiceId, { ...fromFile, accountingCode: r.supplierCode, invoiceNo: r.invoiceNo, invoiceYear: year }),
      );
    }
    const base = `${r.deliveryDate}|${r.materialCode}|${r.unitPrice}|${normalizePlateKey(r.licensePlate)}`;
    const ord = (ordinal.get(`${invoiceId}#${base}`) ?? 0) + 1;
    ordinal.set(`${invoiceId}#${base}`, ord);
    const rowKey = `${base}|${ord}`;
    const id = `${invoiceId}#${rowKey}`;
    const old = oldLineById.get(id);
    fresh.push({
      row: r,
      line: {
        id,
        invoiceId,
        deliveryDate: r.deliveryDate,
        materialCode: r.materialCode,
        quantityKg: r.quantityKg,
        unitPrice: r.unitPrice,
        amount: r.amount,
        driverName: r.driverName,
        licensePlate: r.licensePlate,
        rowKey,
        tripLineId: old?.tripLineId ?? "",
        resolution: old?.resolution ?? "",
        resolutionReason: old?.resolutionReason ?? "",
        resolvedBy: old?.resolvedBy ?? "",
        resolvedAt: old?.resolvedAt ?? "",
        missingFromFile: false,
      },
    });
  }
  const freshIds = new Set(fresh.map((f) => f.line.id));
  const missing = args.existingLines.filter((l) => invoices.has(l.invoiceId) && !freshIds.has(l.id)).map((l) => ({ ...l, missingFromFile: true }));
  // Dòng chuyến đã gắn dòng HĐ KHÁC (không thuộc lần ghép này) ⇒ khỏi dùng lại.
  const taken = new Set(args.existingLines.filter((l) => l.tripLineId && !freshIds.has(l.id)).map((l) => l.tripLineId));
  const matchable = fresh.filter(({ line, row }) => {
    const inv = invoices.get(line.invoiceId)!;
    return inv.classification === "trip" && codeMaps.supplierByCode.has(row.supplierCode) && codeMaps.materialByCode.has(row.materialCode);
  });
  const matches = matchLinesToTrips(
    matchable.map(({ line, row }) => ({
      key: line.id,
      supplierName: codeMaps.supplierByCode.get(row.supplierCode)!,
      materialName: codeMaps.materialByCode.get(row.materialCode)!,
      deliveryDate: line.deliveryDate,
      quantityKg: line.quantityKg,
      unitPrice: line.unitPrice,
      licensePlate: line.licensePlate,
      driverName: line.driverName,
      keepTripLineId: line.tripLineId || undefined,
    })),
    args.tripLines,
    taken,
  );
  const lines: PlannedLine[] = fresh.map(({ line, row }) => {
    const inv = invoices.get(line.invoiceId)!;
    const old = oldLineById.get(line.id);
    const change: ImportChange = !old ? "new" : old.quantityKg !== line.quantityKg || old.amount !== line.amount ? "changed" : "same";
    const materialName = codeMaps.materialByCode.get(row.materialCode) ?? "";
    if (inv.classification === "not-trip")
      return { line: { ...line, tripLineId: "" }, invoiceId: inv.id, state: "not-trip", change, tripKg: null, tripPrice: null, materialName };
    if (!codeMaps.supplierByCode.has(row.supplierCode) || !materialName)
      return { line: { ...line, tripLineId: "" }, invoiceId: inv.id, state: "unmapped", change, tripKg: null, tripPrice: null, materialName };
    const m = matches.get(line.id)!;
    const linked = { ...line, tripLineId: m.tripLineId };
    return { line: linked, invoiceId: inv.id, state: displayState(m.state, linked.resolution), change, tripKg: m.tripKg, tripPrice: m.tripPrice, materialName };
  });
  for (const l of missing)
    lines.push({ line: l, invoiceId: l.invoiceId, state: "no-trip", change: "missing", tripKg: null, tripPrice: null, materialName: codeMaps.materialByCode.get(l.materialCode) ?? "" });
  return { invoices: [...invoices.values()], lines, unmapped: unmappedCodes(args.ledgerRows, codeMaps) };
}

/** Trạng thái hiển thị khi đã có quyết định của kế toán. */
function displayState(raw: InvoiceLineState, resolution: SupplierInvoiceLine["resolution"]): InvoiceLineState {
  if (resolution === "explained" && (raw === "price-mismatch" || raw === "quantity-mismatch")) return "explained";
  if (resolution === "updated" && raw === "matched") return "updated";
  return raw;
}

/** Trạng thái hiện tại của một dòng HĐ đã lưu, so với sổ Nhập hàng ngay lúc này. */
export function lineStateNow(
  line: SupplierInvoiceLine,
  invoice: SupplierInvoice | undefined,
  tripById: ReadonlyMap<string, MaterialImportItem>,
): InvoiceLineState {
  if (invoice?.classification === "not-trip") return "not-trip";
  if (!invoice?.supplierName) return "unmapped";
  const t = line.tripLineId ? tripById.get(line.tripLineId) : undefined;
  if (!t) return "no-trip";
  const raw: InvoiceLineState = t.quantityKg !== line.quantityKg ? "quantity-mismatch" : (t.unitPrice ?? null) !== line.unitPrice ? "price-mismatch" : "matched";
  return displayState(raw, line.resolution);
}

export const isOpenMismatch = (s: InvoiceLineState) => s === "price-mismatch" || s === "quantity-mismatch";

// ---------- 6. PDF ⇄ HĐ (R7) ----------

export type PdfWarning = "no-invoice" | "tax-id-mismatch" | "pdf-mismatch" | "ambiguous";

export const PDF_WARNING_LABELS: Record<PdfWarning, string> = {
  "no-invoice": "PDF chưa có trong sổ kế toán",
  "tax-id-mismatch": "MST danh mục khác hóa đơn",
  "pdf-mismatch": "PDF lệch sổ kế toán",
  ambiguous: "Nhiều HĐ cùng số — chưa biết của đại lý nào",
};

export interface PdfMatch {
  invoiceId: string;
  warnings: PdfWarning[];
}

/** Tìm HĐ của một PDF: số + năm + MST→đại lý; MST lệch danh mục mà chỉ một HĐ cùng số ⇒ vẫn ghép, kèm cảnh báo. */
export function matchPdfToInvoice(
  pdf: PdfInvoice,
  invoices: readonly SupplierInvoice[],
  lines: readonly SupplierInvoiceLine[],
  suppliers: readonly Supplier[],
): PdfMatch {
  const year = Number(pdf.issueDate.slice(0, 4)) || 0;
  const sameNo = invoices.filter((i) => i.invoiceNo === pdf.invoiceNo && (!year || i.invoiceYear === year || i.invoiceYear === year - 1));
  const byTax = suppliers.filter((s) => s.nationalId && digits(s.nationalId) === pdf.sellerTaxId).map((s) => s.shortName);
  const exact = sameNo.filter((i) => byTax.includes(i.supplierName));
  const warnings: PdfWarning[] = [];
  let inv: SupplierInvoice | undefined;
  if (exact.length === 1) inv = exact[0];
  else if (exact.length === 0 && sameNo.length === 1) {
    inv = sameNo[0];
    warnings.push("tax-id-mismatch");
  } else if (sameNo.length > 1) return { invoiceId: "", warnings: ["ambiguous"] };
  if (!inv) return { invoiceId: "", warnings: ["no-invoice"] };
  if (!pdfAgreesWithLedger(pdf, lines.filter((l) => l.invoiceId === inv.id && !l.missingFromFile))) warnings.push("pdf-mismatch");
  return { invoiceId: inv.id, warnings };
}

/** Kiểm chéo: Σkg theo từng đơn giá và cộng tiền hàng của PDF == sổ kế toán (gộp dòng vẫn khớp). */
export function pdfAgreesWithLedger(pdf: PdfInvoice, lines: readonly SupplierInvoiceLine[]): boolean {
  const sum = (xs: readonly { price: number; kg: number }[]) => {
    const m = new Map<number, number>();
    for (const x of xs) m.set(x.price, (m.get(x.price) ?? 0) + x.kg);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([p, k]) => `${p}:${Math.round(k * 1000)}`).join(",");
  };
  const kgOk = !pdf.lines.length || sum(pdf.lines.map((l) => ({ price: l.unitPrice, kg: l.quantity }))) === sum(lines.map((l) => ({ price: l.unitPrice, kg: l.quantityKg })));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const moneyOk = pdf.subtotal == null || Math.abs(pdf.subtotal - total) < 1;
  return kgOk && moneyOk;
}

/** Ghi thông tin PDF vào HĐ (không đổi số kế toán). */
export function applyPdfToInvoice(inv: SupplierInvoice, pdf: PdfInvoice, file: { filePath: string; fileName: string }): SupplierInvoice {
  return {
    ...inv,
    invoiceSymbol: pdf.invoiceSymbol || inv.invoiceSymbol,
    issueDate: pdf.issueDate || inv.issueDate,
    sellerTaxId: pdf.sellerTaxId || inv.sellerTaxId,
    subtotal: pdf.subtotal ?? inv.subtotal,
    vatAmount: pdf.vatAmount ?? inv.vatAmount,
    totalAmount: pdf.totalAmount ?? inv.totalAmount,
    pdfLines: pdf.lines.length ? pdf.lines : inv.pdfLines,
    filePath: file.filePath || inv.filePath,
    fileName: file.fileName || inv.fileName,
  };
}

// ---------- 7. Trạng thái HĐ của chuyến (R8, R11) ----------

export interface TripInvoiceInfo {
  status: TripInvoiceStatus;
  invoiceNos: string[];
  noFile: boolean;
}

/**
 * Trạng thái HĐ của một chuyến. Chỉ xét dòng có loại NL đã ánh xạ (`mappedMaterials`) — dòng loại kế toán
 * không xuất (Nút…) không làm chuyến "thiếu". Chuyến không có dòng nào được xét ⇒ null (không hiện nhãn).
 */
export function tripInvoiceInfo(
  tripLines: readonly MaterialImportItem[],
  linesByTripLine: ReadonlyMap<string, SupplierInvoiceLine>,
  invoiceById: ReadonlyMap<string, SupplierInvoice>,
  mappedMaterials: ReadonlySet<string>,
): TripInvoiceInfo | null {
  const considered = tripLines.filter((t) => mappedMaterials.has(t.materialTypeName));
  if (!considered.length) return null;
  const tripById = new Map(tripLines.map((t) => [t.id, t]));
  const linked = considered.map((t) => linesByTripLine.get(t.id)).filter((l): l is SupplierInvoiceLine => Boolean(l));
  const invs = [...new Set(linked.map((l) => l.invoiceId))].map((id) => invoiceById.get(id)).filter((x): x is SupplierInvoice => Boolean(x));
  const mismatch = linked.some((l) => isOpenMismatch(lineStateNow(l, invoiceById.get(l.invoiceId), tripById)));
  const status: TripInvoiceStatus = mismatch ? "mismatch" : !linked.length ? "awaiting" : linked.length < considered.length ? "partial" : "complete";
  return { status, invoiceNos: invs.map((i) => i.invoiceNo).sort((a, b) => Number(a) - Number(b)), noFile: invs.some((i) => !i.filePath) };
}

/** Chỉ mục dòng HĐ đang hiệu lực theo dòng chuyến (R5: một dòng chuyến ⇄ một dòng HĐ). */
export function indexLinesByTripLine(lines: readonly SupplierInvoiceLine[]): Map<string, SupplierInvoiceLine> {
  const m = new Map<string, SupplierInvoiceLine>();
  for (const l of lines) if (l.tripLineId && !m.has(l.tripLineId)) m.set(l.tripLineId, l);
  return m;
}

// ---------- 8. Cập nhật theo HĐ (NV4) ----------

/** Đổi kg / giá dòng chuyến bằng số HĐ + dòng vết `[Sửa theo HĐ …]` (cùng kiểu sửa từ Cân đối). */
export function applyInvoiceToTripLine(
  trip: MaterialImportItem,
  line: SupplierInvoiceLine,
  ctx: { invoiceNo: string; stamp: string; editor: string; dayLocked: boolean },
): MaterialImportItem {
  const parts = [
    trip.quantityKg !== line.quantityKg ? `kg ${num(trip.quantityKg)} → ${num(line.quantityKg)}` : "",
    trip.unitPrice !== line.unitPrice ? `giá ${trip.unitPrice == null ? "—" : num(trip.unitPrice)} → ${num(line.unitPrice)}` : "",
  ].filter(Boolean);
  if (!parts.length) return trip;
  const afterLock = ctx.dayLocked ? ` · SAU KHI CHỐT NGÀY ${formatDateVN(trip.deliveryDate)}` : "";
  const trace = `[Sửa theo HĐ ${ctx.invoiceNo}${afterLock} · ${ctx.stamp}${ctx.editor ? ` · ${ctx.editor}` : ""}] ${parts.join("; ")}`;
  return { ...trip, quantityKg: line.quantityKg, unitPrice: line.unitPrice, note: trip.note ? `${trip.note}\n${trace}` : trace };
}

// ---------- 9. Tạo chuyến từ HĐ (NV5) ----------

export interface TripFromInvoice {
  shipment: ImportShipment;
  items: MaterialImportItem[];
  /** id dòng HĐ ⇒ id dòng chuyến vừa tạo. */
  links: Map<string, string>;
}

/**
 * Chuyến ghi bù từ các dòng HĐ chưa có chuyến — mỗi (ngày hàng về + biển số) một chuyến.
 * Lý do ghi bù điền sẵn "Theo HĐ <số> (phiếu kế toán <PHIEU>)" (R13).
 */
export function buildTripsFromInvoice(args: {
  invoice: SupplierInvoice;
  lines: readonly SupplierInvoiceLine[];
  materialByCode: ReadonlyMap<string, string>;
  categoryOf: (materialName: string) => Category;
  workshop: Workshop;
  postingDate: string;
  operator: string;
  lotCodeFor: (deliveryDate: string, already: number) => string;
  newId: () => string;
}): TripFromInvoice[] {
  const groups = new Map<string, SupplierInvoiceLine[]>();
  for (const l of args.lines) {
    if (!args.materialByCode.has(l.materialCode)) continue;
    const k = `${l.deliveryDate}|${normalizePlateKey(l.licensePlate)}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const perDate = new Map<string, number>();
  const reason = `Theo HĐ ${args.invoice.invoiceNo}${args.invoice.voucherNo ? ` (phiếu kế toán ${args.invoice.voucherNo})` : ""}`;
  return [...groups.values()]
    .sort((a, b) => a[0].deliveryDate.localeCompare(b[0].deliveryDate))
    .map((ls) => {
      const first = ls[0];
      const n = perDate.get(first.deliveryDate) ?? 0;
      perDate.set(first.deliveryDate, n + 1);
      const shipment: ImportShipment = {
        id: args.newId(),
        deliveryDate: first.deliveryDate,
        postingDate: args.postingDate < first.deliveryDate ? first.deliveryDate : args.postingDate,
        backdateReason: reason,
        workshop: args.workshop,
        supplierName: args.invoice.supplierName,
        driverName: first.driverName,
        licensePlate: first.licensePlate,
        note: "",
        lotCode: args.lotCodeFor(first.deliveryDate, n),
        ssccCode: "",
        scanPath: "",
        operator: args.operator,
      };
      const links = new Map<string, string>();
      const items = ls.map((l) => {
        const materialTypeName = args.materialByCode.get(l.materialCode)!;
        const id = args.newId();
        links.set(l.id, id);
        return {
          id,
          shipmentId: shipment.id,
          deliveryDate: l.deliveryDate,
          workshop: args.workshop,
          category: args.categoryOf(materialTypeName),
          supplierName: args.invoice.supplierName,
          materialTypeName,
          quantityKg: l.quantityKg,
          unitPrice: l.unitPrice,
          driverName: l.driverName,
          licensePlate: l.licensePlate,
          note: "",
          balancingPeriodId: "",
        } satisfies MaterialImportItem;
      });
      return { shipment, items, links };
    });
}
