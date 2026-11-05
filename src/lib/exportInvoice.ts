// ============================================================
// Tên file: src/lib/exportInvoice.ts
// Tên tiếng Việt: Hàng của chuyến xuất + lập Commercial Invoice / Packing list từ app
// Description: Shipment goods lines, loaded counts and invoice / packing list / expiry list layout (ba-spec 63)
// ============================================================
// Chị Vi — Phòng Kế hoạch (Zalo 2026-11-02): chuyến chỉ ghi tổng thùng, invoice làm tay bằng Excel.
// Ở đây: dòng hàng chi tiết của chuyến (chọn từ dòng HĐ đã nối danh mục), số kiện THỰC ĐÓNG kho điền,
// và bố cục 3 bảng in theo mẫu INV 236/26 · INVOICE 275/26 (Invoice · Packing list · Expiry date list).
// Hàm thuần — file Excel ghi ở lib/exportInvoiceExcel.ts. Bảng Invoice dựng ra đọc lại được bằng
// `parseInvoiceRows` (lib/invoiceReader.ts, R27 ba-spec 41) ⇒ test vòng tròn giữ hai bên khớp nhau.
import type {
  Customer,
  ExportContractLine,
  ExportOption,
  ExportShipment,
  ExportShipmentLine,
  InvoiceComposition,
} from "@/types";
import type { InvoiceCell } from "./invoiceReader";
import { linesByContainer, type ContainerView } from "./exportContainers";
import type { CompanySeller } from "./companyProfile";

/**
 * Người bán MẶC ĐỊNH (mẫu INV 236/26) — khi chưa có Thông tin công ty (ba-spec 67 R1). Chứng từ dùng `input.seller`
 * (`companySellerOf(profile)`), hằng này chỉ còn làm giá trị dự phòng.
 */
export const SELLER = {
  name: "BASEAFOOD 1 COMPANY LIMITED",
  address: "321 TRAN XUAN DO STREET, QUARTER 2, BA RIA WARD, HO CHI MINH CITY, VIETNAM",
  place: "Ba Ria",
  signature: "BASEAFOOD 1 CO.,LTD",
} as const;

export const DEFAULT_ORIGIN_NOTE = "Produced in Vietnam";

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/* ---------- Dòng hàng của chuyến ---------- */

export const shipmentLinesOf = (lines: readonly ExportShipmentLine[], shipmentId: string): ExportShipmentLine[] =>
  lines.filter((l) => l.shipmentId === shipmentId).sort((a, b) => a.sortOrder - b.sortOrder);

/** Kg tịnh của MỘT kiện: kiện = bó ⇒ số thùng/bó × kg/thùng; kiện = thùng ⇒ kg/thùng. */
export function netKgPerUnit(l: Pick<ExportShipmentLine, "unitKind" | "cartonsPerUnit" | "netKgPerCarton">): number | null {
  if (l.netKgPerCarton == null) return null;
  return round((l.unitKind === "bundle" ? l.cartonsPerUnit || 1 : 1) * l.netKgPerCarton, 3);
}

/** Số kiện dùng cho chứng từ: kho đã điền số thực đóng ⇒ số đó; chưa ⇒ số kế hoạch. */
export const lineUnits = (l: Pick<ExportShipmentLine, "loadedUnits" | "plannedUnits">): number | null => l.loadedUnits ?? l.plannedUnits;

export function lineNetKg(l: ExportShipmentLine): number | null {
  const u = lineUnits(l);
  const per = netKgPerUnit(l);
  return u == null || per == null ? null : round(u * per, 3);
}

export function lineGrossKg(l: ExportShipmentLine): number | null {
  const u = lineUnits(l);
  return u == null || l.grossKgPerUnit == null ? null : round(u * l.grossKgPerUnit, 3);
}

/** Dòng chuyến mới chép từ một dòng HĐ (bản đang dùng) — tên, size, quy cách, kiện, kg/thùng, mặt hàng. */
export function shipmentLineFromContract(
  cl: ExportContractLine,
  ctx: { id: string; shipmentId: string; contractId: string; sortOrder: number; plannedUnits?: number | null },
): ExportShipmentLine {
  return {
    id: ctx.id,
    shipmentId: ctx.shipmentId,
    contractId: ctx.contractId,
    sortOrder: ctx.sortOrder,
    contractLineId: cl.id,
    productId: cl.productId ?? "",
    description: cl.description,
    size: cl.size,
    packing: cl.packing,
    unitKind: cl.unitKind,
    cartonsPerUnit: cl.unitKind === "bundle" ? cl.cartonsPerUnit || 1 : 1,
    netKgPerCarton: cl.netKgPerCarton,
    grossKgPerUnit: null,
    plannedUnits: ctx.plannedUnits ?? null,
    loadedUnits: null,
    loadedBy: "",
    loadedAt: "",
    expiry: "",
    note: "",
  };
}

export interface LoadingCountSummary {
  lineCount: number;
  /** Dòng kho đã điền số thực đóng. */
  filledCount: number;
  plannedUnits: number;
  loadedUnits: number;
  /** Mọi dòng đã có số thực đóng (và có ≥ 1 dòng). */
  complete: boolean;
  /** Σ thực đóng − Σ kế hoạch của các dòng đã điền CÓ kế hoạch (0 = khớp). */
  diffUnits: number;
  /** Dòng đã điền mà không có số kế hoạch (đóng cont tự tạo từ dòng HĐ — mig 0098) ⇒ không so kế hoạch. */
  unplannedCount: number;
}

export function loadingCountSummary(lines: readonly ExportShipmentLine[]): LoadingCountSummary {
  let planned = 0;
  let loaded = 0;
  let filled = 0;
  let diff = 0;
  let unplanned = 0;
  for (const l of lines) {
    planned += l.plannedUnits ?? 0;
    if (l.loadedUnits != null) {
      filled += 1;
      loaded += l.loadedUnits;
      if (l.plannedUnits != null) diff += l.loadedUnits - l.plannedUnits;
      else unplanned += 1;
    }
  }
  return {
    lineCount: lines.length,
    filledCount: filled,
    plannedUnits: planned,
    loadedUnits: loaded,
    complete: lines.length > 0 && filled === lines.length,
    diffUnits: round(diff, 3),
    unplannedCount: unplanned,
  };
}

/** Id dòng TẠM của hộp Số thực đóng — dòng HĐ chưa có dòng trong chuyến. */
const DRAFT_LINE_PREFIX = "draft:";
export const isDraftLoadingLine = (l: Pick<ExportShipmentLine, "id">) => l.id.startsWith(DRAFT_LINE_PREFIX);

/**
 * Dòng của hộp Số thực đóng (feedback 2026-11-03: đóng cont điền số SAU khi đóng hàng, không chờ Phòng KH nhập
 * Hàng của chuyến): dòng đã có của chuyến + mỗi dòng HĐ chưa có dòng trong chuyến một dòng TẠM (id `draft:<id dòng HĐ>`).
 */
export function loadingCountRows(
  lines: readonly ExportShipmentLine[],
  contractLines: readonly ExportContractLine[],
  ctx: { shipmentId: string; contractId: string; /** Chuyến gộp nhiều HĐ: id dòng HĐ → id HĐ (ba-spec 70). Thiếu ⇒ HĐ của chuyến. */ lineContract?: Readonly<Record<string, string>> },
): ExportShipmentLine[] {
  const had = new Set(lines.map((l) => l.contractLineId));
  let order = Math.max(0, ...lines.map((l) => l.sortOrder));
  const extra = contractLines
    .filter((cl) => !had.has(cl.id))
    .map((cl) =>
      shipmentLineFromContract(cl, { id: `${DRAFT_LINE_PREFIX}${cl.id}`, shipmentId: ctx.shipmentId, contractId: ctx.lineContract?.[cl.id] ?? ctx.contractId, sortOrder: (order += 1) }),
    );
  return [...lines, ...extra];
}

/**
 * Lưu hộp Số thực đóng ⇒ các dòng cần ghi: dòng đã có đổi số ⇒ cập nhật người / lúc điền; dòng TẠM có số ⇒ dòng mới
 * (id thật, không số kế hoạch — luật mig 0098); dòng TẠM để trống ⇒ bỏ (hàng đó không đóng vào chuyến này).
 */
export function applyLoadingCounts(
  rows: readonly ExportShipmentLine[],
  counts: Readonly<Record<string, number | null>>,
  ctx: { by: string; at: string; newId: () => string },
): ExportShipmentLine[] {
  const out: ExportShipmentLine[] = [];
  for (const l of rows) {
    const v = counts[l.id] ?? null;
    if (isDraftLoadingLine(l)) {
      if (v != null) out.push({ ...l, id: ctx.newId(), loadedUnits: v, loadedBy: ctx.by, loadedAt: ctx.at });
    } else if (v !== l.loadedUnits) {
      out.push({ ...l, loadedUnits: v, loadedBy: v == null ? "" : ctx.by, loadedAt: v == null ? "" : ctx.at });
    }
  }
  return out;
}

/* ---------- Lập invoice ---------- */

export const EMPTY_COMPOSITION: InvoiceComposition = { bankOptionId: "", unitPrices: {}, tradeTerms: "", originNote: DEFAULT_ORIGIN_NOTE, specialNotes: "", blNo: "" };

/** Đơn giá của dòng chuyến: sửa ở phần lập invoice ⇒ số đó; không ⇒ đơn giá dòng HĐ đã chọn. */
export function invoiceUnitPrice(
  line: ExportShipmentLine,
  comp: InvoiceComposition | undefined,
  contractLines: readonly ExportContractLine[],
): number | null {
  const own = comp?.unitPrices[line.id];
  if (typeof own === "number" && Number.isFinite(own)) return own;
  return contractLines.find((c) => c.id === line.contractLineId)?.unitPrice ?? null;
}

/** "CFR Tokyo, Japan" — incoterm của HĐ + cảng đích (chuyến ?? HĐ). */
export const defaultTradeTerms = (incoterm: string, portOfDischarge: string) => [incoterm.trim(), portOfDischarge.trim()].filter(Boolean).join(" ");

/** Tài khoản mặc định: tài khoản đầu danh sách. */
export const bankAccountsOf = (options: readonly ExportOption[]) =>
  options.filter((o) => o.listKind === "bank-account").sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));

/** Khối in dưới "Please make TT to:" — `note` của tài khoản, mỗi dòng một dòng; trống ⇒ tên tài khoản. */
export const bankBlockLines = (bank: ExportOption | undefined): string[] =>
  bank ? (bank.note.trim() ? bank.note.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [bank.name]) : [];

/** Ghi chú riêng của khách: mỗi dòng một hàng; ô cách nhau bằng Tab (dán từ Excel) hoặc "|". */
export function specialNoteRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => (l.includes("\t") ? l.split("\t") : l.split("|")).map((c) => c.trim()));
}

/* ---------- Đọc số thành chữ tiếng Anh ("Says: …") ---------- */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", " thousand", " million", " billion"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} hundred` : "", rest].filter(Boolean).join(" ");
}

/** Số nguyên ≥ 0 thành chữ tiếng Anh, viết thường ("forty two thousand four hundred forty two"). */
export function integerToWords(n: number): string {
  let v = Math.floor(Math.abs(n));
  if (v === 0) return "zero";
  const parts: string[] = [];
  for (let i = 0; v > 0 && i < SCALES.length; i++) {
    const chunk = v % 1000;
    if (chunk) parts.unshift(`${below1000(chunk)}${SCALES[i]}`);
    v = Math.floor(v / 1000);
  }
  return parts.join(" ");
}

const CURRENCY_WORDS: Record<string, string> = { USD: "United States Dollars", JPY: "Japanese Yen", EUR: "Euros" };
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "United States Dollars Forty two thousand four hundred forty two only." — có xu ⇒ "and seventy one cents". */
export function amountInWords(amount: number, currency: string): string {
  const cur = CURRENCY_WORDS[currency.toUpperCase()] ?? currency.toUpperCase();
  const cents = Math.round(round(Math.abs(amount), 2) * 100) % 100;
  const whole = integerToWords(Math.floor(round(Math.abs(amount), 2)));
  return `${cur} ${capitalize(whole)}${cents ? ` and ${integerToWords(cents)} cents` : ""} only.`;
}

/* ---------- Bố cục chứng từ ---------- */

/** Vai trò của một hàng in — lib/exportInvoiceExcel.ts định dạng theo vai trò. */
export type InvoiceRowRole = "company" | "title" | "head" | "table-head" | "item" | "line" | "packing" | "total" | "text" | "blank" | "signature";

export interface InvoiceSheetRow {
  role: InvoiceRowRole;
  cells: InvoiceCell[];
}

export interface InvoiceSheet {
  /** Tên sheet Excel. */
  name: string;
  /** Bề rộng 6 cột A–F (ký tự). */
  widths: number[];
  /** Định dạng số theo cột (chỉ ô số). */
  numFmts: (string | null)[];
  rows: InvoiceSheetRow[];
}

export interface InvoiceDocInput {
  invoiceNo: string;
  /** Ngày lập (ISO). */
  issuedOn: string;
  customer: Pick<Customer, "name" | "address">;
  shipment: Pick<ExportShipment, "loadingDate" | "etd" | "vesselVoyage" | "containerNo" | "sealNo">;
  blNo: string;
  portOfLoading: string;
  portOfDischarge: string;
  currency: string;
  tradeTerms: string;
  originNote: string;
  lines: readonly ExportShipmentLine[];
  unitPrice: (line: ExportShipmentLine) => number | null;
  bankLines: readonly string[];
  specialNotes: string;
  /** Người bán từ Thông tin công ty (ba-spec 67); không có ⇒ `SELLER` mặc định. */
  seller?: CompanySeller;
  /** Gross (kg) của dòng theo SI đã lưu — Packing list lấy gross theo SI (Phòng KH 2026-11-04); null ⇒ kg cả bì × số kiện. */
  siGrossKg?: (line: ExportShipmentLine) => number | null;
  /** Mọi cont của chuyến (ba-spec 73 R8). ≥ 2 cont ⇒ đầu trang kê từng cont, Packing list nhóm hàng theo cont. */
  containers?: readonly ContainerView[];
}

/** Số liệu một cont trên Packing list (ba-spec 73 R8). */
export interface ContainerTotals {
  containerId: string;
  units: number;
  netKg: number;
  grossKg: number;
}

/** "SZLU2030326 / VN48840AW" cho từng cont, nối bằng ", " (dòng CONTAINER NO. & SEAL NO.). */
export const containerSealText = (conts: readonly Pick<ContainerView, "containerNo" | "sealNo">[]) =>
  conts.map((c) => [c.containerNo.trim(), c.sealNo.trim()].filter(Boolean).join(" / ")).filter(Boolean).join(", ");

export interface InvoiceTotals {
  units: number;
  netKg: number;
  grossKg: number;
  amount: number;
}

export interface InvoiceDocument {
  sheets: InvoiceSheet[];
  totals: InvoiceTotals;
  /** Dòng chuyến chưa đủ số để in (thiếu số kiện / kg / đơn giá). */
  incompleteLineIds: string[];
  /** Như trên, kèm thiếu gì — để báo đích danh từng dòng. */
  incompleteLines: { lineId: string; missing: ("units" | "netKg" | "unitPrice")[] }[];
  /** Chuyến nhiều cont: tổng từng cont theo Packing list (cộng các cont == `totals`). Một cont ⇒ []. */
  containerTotals: ContainerTotals[];
  fileName: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-11-02" ⇒ "November 02, 2026" (mẫu invoice). Trống / sai ⇒ "". */
export function englishDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${m[3]}, ${m[1]}`;
}

const withPrefix = (text: string, prefix: string) => {
  const t = text.trim();
  if (!t) return "";
  return new RegExp(`^${prefix}\\b`, "i").test(t) ? t : `${prefix}: ${t}`;
};
const groupKey = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

/** Nhãn kiện trên cột số kiện: toàn bó ⇒ BDLS; toàn thùng ⇒ CTNS; lẫn ⇒ PKGS. */
export function packageLabel(lines: readonly Pick<ExportShipmentLine, "unitKind">[]): { short: string; long: string; word: string } {
  const kinds = new Set(lines.map((l) => l.unitKind));
  if (kinds.size === 1 && kinds.has("bundle")) return { short: "BDLS", long: "BUNDLES", word: "bundles" };
  if (kinds.size <= 1) return { short: "CTNS", long: "CARTONS", word: "cartons" };
  return { short: "PKGS", long: "PACKAGES", word: "packages" };
}

interface PrintedLine {
  line: ExportShipmentLine;
  units: number | null;
  netKg: number | null;
  grossKg: number | null;
  unitPrice: number | null;
  amount: number | null;
}

/** Gom dòng liền nhau cùng tên hàng thành một mục (ITEM 1, 2…) như mẫu. */
function groupLines(printed: readonly PrintedLine[]): PrintedLine[][] {
  const groups: PrintedLine[][] = [];
  for (const p of printed) {
    const last = groups[groups.length - 1];
    if (last && groupKey(last[0].line.description) === groupKey(p.line.description)) last.push(p);
    else groups.push([p]);
  }
  return groups;
}

/**
 * Hàng của bảng hàng hóa cho một nhóm: dòng tên (số thứ tự) · mỗi dòng "Size: …" mang số · dòng
 * "Packing: …" (chung một dòng cuối nhóm khi mọi dòng cùng quy cách — mẫu 275/26; riêng từng size — mẫu 236/26).
 * `numbers(p)` trả các ô số từ cột C trở đi.
 */
function groupRows(group: readonly PrintedLine[], no: number, numbers: (p: PrintedLine) => InvoiceCell[]): InvoiceSheetRow[] {
  const rows: InvoiceSheetRow[] = [];
  const first = group[0].line;
  const samePacking = group.every((p) => groupKey(p.line.packing) === groupKey(first.packing));
  const single = group.length === 1 && !first.size.trim();
  if (single) {
    rows.push({ role: "item", cells: [no, first.description, ...numbers(group[0])] });
    if (first.packing.trim()) rows.push({ role: "packing", cells: [null, withPrefix(first.packing, "Packing")] });
    return rows;
  }
  rows.push({ role: "item", cells: [no, first.description] });
  for (const p of group) {
    const sizeText = withPrefix(p.line.size, "Size") || withPrefix(p.line.packing, "Packing");
    rows.push({ role: "line", cells: [null, sizeText, ...numbers(p)] });
    if (!samePacking && p.line.size.trim() && p.line.packing.trim()) rows.push({ role: "packing", cells: [null, withPrefix(p.line.packing, "Packing")] });
  }
  if (samePacking && first.packing.trim() && group.some((p) => p.line.size.trim())) rows.push({ role: "packing", cells: [null, withPrefix(first.packing, "Packing")] });
  return rows;
}

const blank = (): InvoiceSheetRow => ({ role: "blank", cells: [] });
const text = (t: string, col = 0): InvoiceSheetRow => {
  const cells: InvoiceCell[] = [];
  cells[col] = t;
  return { role: "text", cells };
};
const company = (seller: CompanySeller): InvoiceSheetRow[] => [
  { role: "company", cells: [null, seller.name] },
  { role: "company", cells: [null, seller.address] },
  blank(),
];

/**
 * Địa chỉ bên mua thành các dòng in: có xuống dòng ⇒ theo đó; một dòng dài (ô Địa chỉ của danh mục khách là
 * ô một dòng) ⇒ ngắt theo từ, mỗi dòng ≤ `max` ký tự — cột A in tràn sang B, cột C đã có chữ ("Vessel's
 * name"…) nên dòng dài bị che. Mẫu 275/26: 3 dòng địa chỉ dưới tên khách.
 */
export function addressLines(address: string, max = 40): string[] {
  const raw = address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (raw.length !== 1 || raw[0].length <= max) return raw;
  const out: string[] = [];
  let cur = "";
  for (const word of raw[0].split(/\s+/)) {
    if (cur && (cur + " " + word).length > max) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/** Phần đầu (bên mua trái — chuyến phải), dùng chung Invoice + Packing list. */
function headRows(input: InvoiceDocInput, title: string): InvoiceSheetRow[] {
  const addr = addressLines(input.customer.address ?? "");
  const shipOn = englishDate(input.shipment.etd || input.shipment.loadingDate).toUpperCase();
  const right: [string, string][] = [
    ["Shipment on/about:", shipOn],
    ["Vessel's name:", input.shipment.vesselVoyage],
    ["B/L NO.:", input.blNo],
    ["Port of loading:", input.portOfLoading.toUpperCase()],
    ["Port of discharge:", input.portOfDischarge.toUpperCase()],
  ];
  // ba-spec 73 R8: chuyến nhiều cont ⇒ mỗi cont một dòng "Container / Seal" (chuyến một cont giữ như mẫu).
  const conts = input.containers ?? [];
  if (conts.length > 1) conts.forEach((c, i) => right.push([i === 0 ? "Container / Seal:" : "", [`${c.kind}`, containerSealText([c])].filter(Boolean).join(" · ")]));
  const left = [`Applicant: ${input.customer.name}`, ...addr];
  const rows: InvoiceSheetRow[] = [
    { role: "head", cells: [null, null, null, `${sellerOf(input).place},`, englishDate(input.issuedOn)] },
    { role: "title", cells: [title, null, null, null, input.invoiceNo] },
    blank(),
  ];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    rows.push({ role: "head", cells: [left[i] ?? null, null, right[i]?.[0] ?? null, null, right[i]?.[1] ?? null] });
  }
  rows.push(blank());
  return rows;
}

/** "INVOICE 275.26" — tên file theo cách phòng KH đang đặt; số trống ⇒ "INVOICE". */
export const invoiceFileName = (invoiceNo: string) => `INVOICE ${invoiceNo.trim().replace(/[\\/:*?"<>|]+/g, ".")}`.trim() + ".xlsx";

/** Dựng Invoice + Packing list (+ Expiry date list khi có dòng ghi hạn dùng) cho một chuyến. */
const sellerOf = (input: InvoiceDocInput): CompanySeller => input.seller ?? SELLER;

export function buildInvoiceDocument(input: InvoiceDocInput): InvoiceDocument {
  const seller = sellerOf(input);
  const cur = (input.currency || "USD").toUpperCase();
  const printed: PrintedLine[] = input.lines.map((line) => {
    const units = lineUnits(line);
    const netKg = lineNetKg(line);
    const unitPrice = input.unitPrice(line);
    const grossKg = input.siGrossKg?.(line) ?? lineGrossKg(line);
    return { line, units, netKg, grossKg, unitPrice, amount: netKg != null && unitPrice != null ? round(netKg * unitPrice, 2) : null };
  });
  const totals: InvoiceTotals = {
    units: round(printed.reduce((t, p) => t + (p.units ?? 0), 0), 3),
    netKg: round(printed.reduce((t, p) => t + (p.netKg ?? 0), 0), 3),
    grossKg: round(printed.reduce((t, p) => t + (p.grossKg ?? 0), 0), 3),
    amount: round(printed.reduce((t, p) => t + (p.amount ?? 0), 0), 2),
  };
  const pkg = packageLabel(input.lines);
  const groups = groupLines(printed);

  // Invoice
  const inv: InvoiceSheetRow[] = [...company(seller), ...headRows(input, "COMMERCIAL INVOICE")];
  inv.push(
    { role: "table-head", cells: ["ITEMS", "DESCRIPTION OF GOODS", "NUMBER OF", "NET", cur === "USD" ? "IN US. DOLLARS" : `IN ${cur}`] },
    { role: "table-head", cells: [null, null, "PACKAGES", "WEIGHT", "UNIT PRICE", "AMOUNT"] },
    { role: "table-head", cells: [null, input.originNote.trim() || null, null, null, input.tradeTerms.trim() ? `Trade Terms: ${input.tradeTerms.trim()}` : null] },
    { role: "table-head", cells: [null, null, pkg.short, "KGS", `${cur}/KG`, cur] },
  );
  groups.forEach((g, i) => inv.push(...groupRows(g, i + 1, (p) => [p.units, p.netKg, p.unitPrice, p.amount])));
  inv.push({ role: "total", cells: [null, "TOTAL", totals.units, totals.netKg, null, totals.amount] }, blank());
  inv.push(text(`Says: ${amountInWords(totals.amount, cur)}`));
  const notes = specialNoteRows(input.specialNotes);
  if (notes.length) {
    inv.push(blank());
    for (const r of notes) inv.push({ role: "text", cells: r });
  }
  inv.push(blank(), { role: "signature", cells: [null, null, null, seller.signature] }, blank(), blank(), blank());
  if (input.bankLines.length) {
    inv.push(text("Please make TT to:"));
    for (const l of input.bankLines) inv.push(text(l));
  }

  // Packing list
  const pl: InvoiceSheetRow[] = [...company(seller), ...headRows(input, "PACKING LIST")];
  pl.push(
    { role: "table-head", cells: ["ITEMS", "DESCRIPTION", "KIND OF PACKAGES", "NUMBER OF", "TOTAL WEIGHT"] },
    { role: "table-head", cells: [null, null, "N.W / G.W", "PACKAGES", "NET", "GROSS"] },
    { role: "table-head", cells: [null, input.originNote.trim() ? input.originNote.trim().replace(/^produced/i, "Manufactured") : null] },
    { role: "table-head", cells: [null, null, `KGS/${pkg.short === "BDLS" ? "BDL" : pkg.short === "CTNS" ? "CTN" : "PKG"}`, pkg.long, "KGS", "KGS"] },
  );
  const nwgw = (p: PrintedLine): InvoiceCell => {
    const net = netKgPerUnit(p.line);
    if (net == null) return null;
    // Gross mỗi kiện: theo Hàng của chuyến; chỉ có gross theo SI ⇒ gross ÷ số kiện.
    const gpu = p.line.grossKgPerUnit ?? (p.grossKg != null && p.units ? round(p.grossKg / p.units, 2) : null);
    return gpu != null ? `${net}kgs/${gpu}kgs` : `${net}kgs`;
  };
  const containerTotals: ContainerTotals[] = [];
  const conts = input.containers ?? [];
  if (conts.length > 1) {
    // ba-spec 73 R8: mỗi cont một nhóm (dòng tiêu đề cont · các mục · dòng cộng của cont); số mục chạy tiếp.
    let no = 0;
    for (const { container: c, lines } of linesByContainer(conts, printed.map((p) => ({ ...p, containerId: p.line.containerId })))) {
      const sub = { units: 0, netKg: 0, grossKg: 0 };
      for (const p of lines) {
        sub.units += p.units ?? 0;
        sub.netKg += p.netKg ?? 0;
        sub.grossKg += p.grossKg ?? 0;
      }
      const t = { containerId: c.id, units: round(sub.units, 3), netKg: round(sub.netKg, 3), grossKg: round(sub.grossKg, 3) };
      containerTotals.push(t);
      // Dòng "item" (đậm, nằm trong bảng ở cả Excel / Word / PDF) — "total" sẽ cắt bảng ở bản Word.
      pl.push({ role: "item", cells: [null, `CONTAINER ${c.no}: ${[c.kind, containerSealText([c])].filter(Boolean).join(" · ")}`] });
      for (const g of groupLines(lines)) pl.push(...groupRows(g, ++no, (p) => [nwgw(p), p.units, p.netKg, p.grossKg]));
      pl.push({ role: "item", cells: [null, `Sub-total container ${c.no}`, null, t.units, t.netKg, t.grossKg || null] });
    }
  } else groups.forEach((g, i) => pl.push(...groupRows(g, i + 1, (p) => [nwgw(p), p.units, p.netKg, p.grossKg])));
  pl.push({ role: "total", cells: [null, "TOTAL", null, totals.units, totals.netKg, totals.grossKg || null] }, blank());
  pl.push(text(`Say: ${capitalize(integerToWords(totals.units))} ${pkg.word} only.`));
  pl.push(blank(), { role: "signature", cells: [null, null, null, seller.signature] });

  const sheets: InvoiceSheet[] = [
    { name: "INVOICE", widths: [7, 52, 13, 13, 14, 16], numFmts: [null, null, "#,##0", "#,##0.00", "#,##0.00####", "#,##0.00"], rows: inv },
    { name: "PACKING LIST", widths: [7, 52, 16, 13, 13, 13], numFmts: [null, null, null, "#,##0", "#,##0.00", "#,##0.00"], rows: pl },
  ];

  // Expiry date list — chỉ khi có dòng ghi hạn dùng.
  if (input.lines.some((l) => l.expiry.trim())) {
    const ex: InvoiceSheetRow[] = [...company(seller)];
    ex.push(
      { role: "title", cells: ["EXPIRY DATE LIST"] },
      blank(),
      { role: "head", cells: [null, "TO CONSIGNEE:", input.customer.name] },
      ...addressLines(input.customer.address ?? "").map((l): InvoiceSheetRow => ({ role: "head", cells: [null, null, l] })),
      { role: "head", cells: [null, "INVOICE NO.:", input.invoiceNo, `dated ${englishDate(input.issuedOn)}`] },
      { role: "head", cells: [null, "VESSEL NAME:", input.shipment.vesselVoyage] },
      { role: "head", cells: [null, "DATE OF SHIPMENT:", englishDate(input.shipment.etd || input.shipment.loadingDate).toUpperCase()] },
      { role: "head", cells: [null, "BILL OF LADING NO.:", input.blNo] },
      { role: "head", cells: [null, "CONTAINER NO. & SEAL NO.:", conts.length > 1 ? containerSealText(conts) : [input.shipment.containerNo, input.shipment.sealNo].filter(Boolean).join(" / ")] },
      blank(),
      { role: "table-head", cells: ["ITEMS", "DESCRIPTION", "UNIT WEIGHT", "EXPIRY DATE", "TOTAL QUANTITY", "TOTAL WEIGHT"] },
      { role: "table-head", cells: [null, null, "N.W / G.W", "(yyyy.mm)", pkg.long, "NET", "GROSS"] },
    );
    groups.forEach((g, i) => ex.push(...groupRows(g, i + 1, (p) => [nwgw(p), p.line.expiry || null, p.units, p.netKg, p.grossKg])));
    ex.push({ role: "total", cells: [null, "TOTAL", null, null, totals.units, totals.netKg, totals.grossKg || null] }, blank());
    ex.push({ role: "head", cells: [null, null, null, null, `${seller.place.toUpperCase()},`, englishDate(input.issuedOn)] });
    ex.push({ role: "signature", cells: [null, null, null, seller.signature] });
    sheets.push({ name: "EXPIRY DATE", widths: [7, 48, 16, 13, 14, 12, 12], numFmts: [null, null, null, null, "#,##0", "#,##0.00", "#,##0.00"], rows: ex });
  }

  return {
    sheets,
    totals,
    incompleteLineIds: printed.filter((p) => p.units == null || p.netKg == null || p.unitPrice == null).map((p) => p.line.id),
    incompleteLines: printed
      .map((p) => ({
        lineId: p.line.id,
        missing: [p.units == null && "units", p.units != null && p.netKg == null && "netKg", p.unitPrice == null && "unitPrice"].filter(
          (x): x is "units" | "netKg" | "unitPrice" => !!x,
        ),
      }))
      .filter((x) => x.missing.length),
    containerTotals,
    fileName: invoiceFileName(input.invoiceNo),
  };
}
