// ============================================================
// Tên file: src/lib/contractReader.ts
// Tên tiếng Việt: Đọc chữ của file hợp đồng / phụ lục ⇒ điền sẵn form hợp đồng Xuất khẩu, Nhập khẩu
// Description: Pure parser + form fill for ba-spec 66. Input = rows of text (a .docx paragraph is a
//              one-cell row, a table row keeps its cells; a PDF line keeps its text runs — loaders in
//              contractFileReader.ts). Reads parties, contract / annex number + dates, terms, the
//              product-line table; fills ONLY empty fields, lists fields that differ (R7), never
//              writes on its own (R12).
// ============================================================
// Vì sao (Phòng Kế hoạch, chủ dự án chốt 2026-11-03): HĐ xuất do Baseafood soạn bằng Word ⇒ đọc
// chữ chính xác, khỏi gõ lại. Bản scan KHÔNG đọc (giống invoice 41 NV17). Bố cục canh theo
// "ANNEX 2 OF CONTRACT 01-26-HAT" (HYAKUSAIBOU): bảng Ratio · Size · … · Price · Quantity · Amount.
import type { Customer, ExportContractLine, ExportContractTerms, ExportOption, ExportOptionListKind, ImportSupplier } from "@/types";
import { nameKey } from "./customerProductNames";
import { INCOTERMS } from "./exportPlanning";
import { exportOptionListMeta, exportOptionsOf, optionKey } from "./exportOptions";
import { formatDateVN, formatMoney, formatUnitPrice, num } from "./format";
import { parseInvoiceDate, parseInvoiceNumber, rowsFromTextItems, sizeKey, type PdfTextItem } from "./invoiceReader";

/* ---------- Kết quả đọc ---------- */

/** Vai của form đang mở: Xuất khẩu ⇒ đối tác là bên mua; Nhập khẩu ⇒ bên bán (R3). */
export type ContractRole = "export" | "import";

export type ContractReadFailure = "scan" | "unsupported" | "empty" | "error";

export const CONTRACT_FAILURE_MESSAGES: Record<ContractReadFailure, string> = {
  scan: "File là bản scan (ảnh), không có chữ để đọc. Vẫn đính được làm bằng chứng; muốn tự điền thì chọn file Word (.docx, .doc) hoặc PDF xuất từ Word.",
  unsupported: "Chỉ đọc được file Word (.docx, .doc) hoặc PDF có chữ. Ảnh, Excel, zip không đọc.",
  empty: "Không thấy thông tin hợp đồng nào trong file (số hợp đồng, hai bên, bảng dòng hàng).",
  error: "Không mở được file.",
};

export const isReadableContractFile = (name: string) => /\.(docx|doc|pdf)$/i.test(name);

/** Loại file không đọc được ⇒ lý do (R1); đọc được ⇒ null. */
export function contractFileProblem(name: string): ContractReadFailure | null {
  return isReadableContractFile(name) ? null : "unsupported";
}

export interface ReadContractLine {
  description: string;
  size: string;
  packing: string;
  netKgPerCarton: number | null;
  /** Số thùng — khi cột lượng tính theo thùng, hoặc kg chia hết cho kg tịnh / thùng. */
  cartons: number | null;
  kg: number | null;
  unitPrice: number | null;
  amount: number | null;
  piecesPerKg: string;
  pieceLength: string;
  partRatio: string;
  hsCode: string;
  /** Các cột form không có ô (Assortment, Average gr/pc, Dao động…) — "tiêu đề: giá trị · …". */
  note: string;
}

/** Dòng ghi tiền khác kg × đơn giá (R6) — `diff` = tiền trên file − tính lại. */
export interface ReadLineIssue {
  lineIndex: number;
  expected: number;
  actual: number;
  diff: number;
}

export interface ReadContract {
  isAnnex: boolean;
  contractNo: string;
  signedOn: string;
  annexNo: string;
  annexDate: string;
  changeSummary: string;
  sellerName: string;
  buyerName: string;
  partnerName: string;
  /** Địa chỉ của đối tác — dòng "Add / Address / Địa chỉ" ngay dưới tên bên (Phòng KH 2026-11-04). */
  partnerAddress: string;
  partnerSide: "seller" | "buyer" | "";
  orderRef: string;
  incoterm: string;
  /** Chữ gốc trên file (VD "CNF" khi đã ghi thành CFR). */
  incotermRaw: string;
  portOfLoading: string;
  portOfDischarge: string;
  currency: string;
  tolerancePct: number | null;
  latestShipmentDate: string;
  /** Hạn giao suy ra từ tháng ("to April, 2027" ⇒ 30/04/2027) — cần soát lại. */
  latestShipmentInferred: boolean;
  /** Hạn hợp đồng — "binding on from date of signing to May 31, 2027" (ba-spec 69 R5). */
  contractValidUntil: string;
  containerCount: number | null;
  containerType: string;
  paymentMethod: "ttr" | "lc" | "";
  lcNo: string;
  depositPct: number | null;
  lines: ReadContractLine[];
  totalKg: number | null;
  totalAmount: number | null;
  lineIssues: ReadLineIssue[];
  /** Cảnh báo không chứa giá. */
  warnings: string[];
  /** Cảnh báo có số tiền — chỉ hiện cho người xem được giá (R14). */
  priceWarnings: string[];
}

export type ContractReadResult = { ok: true; contract: ReadContract } | { ok: false; reason: ContractReadFailure; message: string };

const fail = (reason: ContractReadFailure): ContractReadResult => ({ ok: false, reason, message: CONTRACT_FAILURE_MESSAGES[reason] });

/* ---------- Chữ ---------- */

const clean = (s: string | null | undefined) => (s ?? "").replace(/[\s ]+/g, " ").trim();
const rowText = (r: readonly string[]) => r.map(clean).filter(Boolean).join(" ");
const isOurs = (name: string) => /baseafood/i.test(name);
const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthOf = (w: string) => MONTHS.findIndex((m) => m.startsWith(w.toLowerCase().slice(0, 3)));
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Hạn giao (R5): "not later than 30/04/2027" / "ON OR BEFORE 25 OCTOBER, 2026" ⇒ ngày đó;
 * "from November, 2026 to April, 2027" / "within January and March, 2027" ⇒ ngày cuối tháng cuối,
 * đánh dấu suy ra. Chữ trong ngoặc bỏ ("(accept date of shipment before issue date of LC)").
 */
export function parseShipmentDeadline(text: string): { date: string; inferred: boolean } | null {
  const body = text.replace(/^.*?(shipment|delivery)[^:：]*[:：]/i, "").replace(/\([^)]*\)/g, " ");
  for (const seg of body.split(/\bto\b|\buntil\b|\btill\b|\band\b|–|—/i).reverse()) {
    const exact = parseInvoiceDate(seg);
    if (exact) return { date: exact, inferred: false };
    const monthYear = [...seg.matchAll(/\b([a-z]{3,9})\.?,?\s*(\d{4})\b/gi)].filter((m) => monthOf(m[1]) >= 0).pop();
    const numeric = seg.match(/\b(\d{1,2})[/.-](\d{4})\b/);
    const [y, mo] = monthYear
      ? [Number(monthYear[2]), monthOf(monthYear[1]) + 1]
      : numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12
        ? [Number(numeric[2]), Number(numeric[1])]
        : [0, 0];
    if (y) return { date: `${y}-${pad(mo)}-${pad(lastDay(y, mo))}`, inferred: true };
  }
  return null;
}

/** Kg tịnh mỗi thùng từ quy cách (R6): "1kg/PE x 12/ctn" = 12 · "10kg/ctn" = 10 · "6 x 2kg" = 12 · "500g x 20" = 10. */
export function packingNetKg(packing: string): number | null {
  const t = packing.toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
  const unit = t.match(/(\d+(?:\.\d+)?)\s*(kgs?|grs?|g)\b/);
  if (!unit) return null;
  let kg = Number(unit[1]) * (unit[2].startsWith("k") ? 1 : 0.001);
  const after = t.slice((unit.index ?? 0) + unit[0].length);
  for (const m of after.matchAll(/[x×*]\s*(\d+)(?!\s*(?:kgs?|grs?|g)\b)(?![.\d])/g)) kg *= Number(m[1]);
  const before = t.slice(0, (unit.index ?? 0) + unit[0].length).match(/(\d+)\s*[x×*]\s*\d+(?:\.\d+)?\s*(?:kgs?|grs?|g)\b/);
  if (before) kg *= Number(before[1]);
  return Math.round(kg * 1000) / 1000;
}

/* ---------- Bảng dòng hàng ---------- */

type Col =
  | "description"
  | "size"
  | "packing"
  | "price"
  | "quantity"
  | "cartons"
  | "amount"
  | "pcsPerKg"
  | "length"
  | "ratio"
  | "hs"
  | "serial"
  | "extra";

/** Thứ tự quan trọng: "Price (usd/kg)" có chữ kg ⇒ xét giá trước lượng; "pcs/kg" trước lượng. */
const COLUMN_RULES: readonly [Col, RegExp][] = [
  ["serial", /^(no\.?|stt|#|items?|itemno\.?|mark|marks|s\/n)$/],
  ["pcsPerKg", /pcs\/kg|pieces\/kg|pc\/kg|miếng\/kg/],
  ["extra", /average|avg|trungbình|daođộng|range|variation|assortment|cơcấu/],
  ["length", /length|chiềudài/],
  ["ratio", /ratio|tentacle|tỉlệ/],
  ["packing", /packing|packaging|quycách|đónggói/],
  ["price", /price|đơngiá/],
  ["amount", /amount|value|thànhtiền|trịgiá/],
  ["cartons", /^(?!.*kg).*(ctns?|cartons?|sốthùng)/],
  ["quantity", /quantity|q'?ty|weight|khốilượng|sốlượng|^kgs?$/],
  ["hs", /^hs|hscode|mãhs/],
  ["size", /size|^cỡ/],
  ["description", /commodit|description|product|goods|tênhàng|mặthàng|specification/],
];

const colOf = (header: string): Col | null => {
  const k = header.toLowerCase().replace(/\s+/g, "");
  if (!k) return null;
  return COLUMN_RULES.find(([, re]) => re.test(k))?.[0] ?? "extra";
};

interface Table {
  start: number;
  end: number;
  lines: ReadContractLine[];
  totalKg: number | null;
  totalAmount: number | null;
  warnings: string[];
  /** Chữ của dòng tiêu đề (tìm incoterm, tiền tệ trong "Price (usd/kg) CNF Hakata"). */
  headerText: string;
  /** Dòng tổng của dạng nhãn : giá trị — có dung sai "(+/-10% in Amount & Quantity Allowed)". */
  freeText?: string[];
}

const TOTAL_ROW = /^(total|grand total|tổng|cộng|says?\b)/i;
const SIZE_LIKE = /\d\s*(gr|g|pcs|cut|up|cm|\/|-|–)|\b(s|m|l|xl|2l|3l)\b/i;
const PACKING_LIKE = /ctn|carton|\bpe\b|bag|block|iqf|tray|box/i;

function findTable(rows: readonly (readonly string[])[]): Table | null {
  for (let h = 0; h < rows.length; h++) {
    const cols = rows[h].map((c) => colOf(clean(c)));
    const kinds = new Set(cols.filter((c): c is Col => !!c && c !== "extra" && c !== "serial"));
    const known = kinds.size;
    if (known < 3 || !(kinds.has("size") || kinds.has("description")) || !(kinds.has("quantity") || kinds.has("price") || kinds.has("cartons"))) continue;
    const headers = rows[h].map(clean);
    // Tiêu đề 2 tầng: dòng ngay dưới chỉ có nhãn ngắn, không số ("Ctns", "Kgs", "(usd/kg CFR)") ⇒ gộp vào cột
    // trên; ô gộp ngang để trống thì lấy tên cột bên trái ("Quantity" | "" ⇒ "Quantity Ctns" | "Quantity Kgs").
    let bodyStart = h + 1;
    const sub = rows[h + 1]?.map(clean);
    if (sub && sub.length === cols.length && sub.some(Boolean) && sub.every((c) => !c || (c.length <= 24 && parseInvoiceNumber(c) == null))) {
      sub.forEach((c, at) => {
        if (!c) return;
        const parent = headers.slice(0, at + 1).reverse().find(Boolean) ?? "";
        const own = colOf(c);
        cols[at] = own && own !== "extra" ? own : colOf(`${parent} ${c}`);
        headers[at] = `${parent} ${c}`.trim();
      });
      bodyStart = h + 2;
    }
    const qtyHeader = headers[cols.indexOf("quantity")]?.toLowerCase() ?? "";
    const qtyFactor = /\bmt\b|tons?|tấn/.test(qtyHeader) ? 1000 : 1;
    const priceHeader = headers[cols.indexOf("price")]?.toLowerCase() ?? "";
    const pricePerCarton = /\/\s*(ctn|carton|thùng)/.test(priceHeader);
    const warnings: string[] = [];
    if (pricePerCarton) warnings.push("Đơn giá trên file tính theo thùng — app ghi giá theo kg nên không điền đơn giá.");
    const lines: ReadContractLine[] = [];
    let totalKg: number | null = null;
    let totalAmount: number | null = null;
    let i = bodyStart;
    let prev: ReadContractLine | null = null;
    // Tên hàng chung của các spec bên dưới (hàng chỉ có tên, không số — HĐ Peacock).
    let title = "";
    for (; i < rows.length; i++) {
      const r = rows[i].map(clean);
      const first = r.find(Boolean) ?? "";
      const nums = r.map((c) => parseInvoiceNumber(c)).filter((n): n is number => n != null);
      if (TOTAL_ROW.test(first)) {
        if (nums.length >= 2) [totalKg, totalAmount] = nums.slice(-2);
        else if (nums.length === 1) totalKg = nums[0];
        if (totalKg != null) totalKg *= qtyFactor;
        i++;
        break;
      }
      if (r.filter(Boolean).length < 2) {
        // Mô tả tiếp của spec phía trên ⇒ ghép vào dòng đó (như Chép dòng), không coi là hết bảng.
        if (prev && SPEC_CONTINUATION.test(first)) {
          const d = specificationDetails(first);
          prev.pieceLength ||= d.pieceLength;
          prev.partRatio ||= d.partRatio;
          prev.piecesPerKg ||= d.piecesPerKg;
          prev.size ||= d.size;
          prev.note = [prev.note, first].filter(Boolean).join(" ");
          continue;
        }
        if (lines.length) break;
        continue;
      }
      const cell = (c: Col) => {
        const at = cols.indexOf(c);
        return at >= 0 && r.length === cols.length ? r[at] : "";
      };
      let size = cell("size");
      let packing = cell("packing");
      let description = cell("description");
      let kg = parseInvoiceNumber(cell("quantity"));
      let price = parseInvoiceNumber(cell("price"));
      let amount = parseInvoiceNumber(cell("amount"));
      let cartons = parseInvoiceNumber(cell("cartons"));
      const extras: string[] = [];
      if (r.length === cols.length) {
        cols.forEach((c, at) => {
          if (c === "extra" && r[at]) extras.push(`${headers[at] || "Cột " + (at + 1)}: ${r[at]}`);
        });
      } else {
        // PDF lệch cột: 3 số cuối dòng = đơn giá · lượng · tiền; ô chữ nhận theo dáng (R6).
        const texts = r.filter((c) => c && parseInvoiceNumber(c) == null);
        [price, kg, amount] = nums.length >= 3 ? nums.slice(-3) : [null, nums[0] ?? null, nums[1] ?? null];
        cartons = null;
        size = texts.find((t) => SIZE_LIKE.test(t) && !PACKING_LIKE.test(t)) ?? "";
        packing = texts.find((t) => PACKING_LIKE.test(t)) ?? "";
        description = texts.find((t) => t !== size && t !== packing && /[a-z]{3}/i.test(t)) ?? "";
      }
      if (kg != null) kg *= qtyFactor;
      // "Tên hàng Specification 1: …" ⇒ tên hàng + chữ spec; hàng chỉ có tên (không số) ⇒ nhớ làm tên chung.
      const split = splitSpecification(description);
      if (split.spec || SPEC_START.test(description)) {
        if (split.title) title = split.title;
        description = title || split.title;
      }
      if (kg == null && price == null && cartons == null && !size) {
        if (description && !split.spec) title = description;
        continue;
      }
      const spec = split.spec ? specificationDetails(split.spec) : null;
      if (!size && spec?.size) size = spec.size;
      // Ô gộp dọc (Packing chung cho mọi spec) chỉ có ở hàng đầu ⇒ chép từ dòng trên.
      if (!packing && prev && title && prev.description === description) packing = prev.packing;
      const ratio = cell("ratio") || prev?.partRatio || "";
      if (!description && prev && cols.includes("description")) description = prev.description;
      // Không có cột Size: lấy "size 1.3 – 1.8 cm" trong tên hàng (tên giữ nguyên như trên HĐ).
      if (!size && !cols.includes("size")) size = clean(description.match(/\bsize\s*:?\s*([^,;(]+)/i)?.[1]);
      const netKg = packingNetKg(packing);
      if (cartons == null && kg != null && netKg) {
        const q = kg / netKg;
        if (Math.abs(q - Math.round(q)) < 1e-6) cartons = Math.round(q);
      }
      if (kg == null && cartons != null && netKg) kg = round2(cartons * netKg);
      const line: ReadContractLine = {
        description,
        size,
        packing,
        netKgPerCarton: netKg,
        cartons,
        kg,
        unitPrice: pricePerCarton ? null : price,
        amount,
        piecesPerKg: cell("pcsPerKg") || spec?.piecesPerKg || "",
        pieceLength: cell("length") || spec?.pieceLength || "",
        partRatio: cell("ratio") || spec?.partRatio || ratio,
        hsCode: cell("hs"),
        note: [extras.join(" · "), split.spec].filter(Boolean).join(" · "),
      };
      lines.push(line);
      prev = line;
    }
    if (!lines.length) continue;
    return { start: h, end: i, lines, totalKg, totalAmount, warnings, headerText: headers.filter(Boolean).join(" ") };
  }
  return null;
}

/* ---------- HĐ ghi tên hàng một lần rồi liệt kê "Specification 1, 2…" (Peacock 02-26-PC, 2026-11-04) ---------- */

const SPEC_START = /\b(?:specification|spec\.?|quy\s*cách)\s*\d*\s*[:：]/i;
/** Hàng chỉ một ô là mô tả tiếp của spec phía trên ("- Length: max 3.5 cm.") — không phải hết bảng. */
const SPEC_CONTINUATION = /^\s*[-–•*]|^(?:size|length|ratio|pcs|bacteria|e\.?\s*coli|coliform|salmonella|tpc|chiều dài|tỉ lệ|số miếng)\b/i;

/** Tách "Frozen Blanched cut Octopus Specification 1: - Size …" ⇒ tên hàng + chữ của spec. */
export function splitSpecification(text: string): { title: string; spec: string } {
  const m = SPEC_START.exec(text);
  if (!m) return { title: text, spec: "" };
  return { title: clean(text.slice(0, m.index)), spec: clean(text.slice(m.index + m[0].length)) };
}

/** Size · số miếng / kg · chiều dài · tỉ lệ trong chữ của spec ("- Size 1.3 – 1.4 gr (700-750 pcs/kg) - Length: max 3.5 cm."). */
export function specificationDetails(spec: string): { size: string; piecesPerKg: string; pieceLength: string; partRatio: string } {
  const part = (re: RegExp) => clean(spec.match(re)?.[1]).replace(/[.;,]$/, "");
  return {
    size: part(/\bsize\s*:?\s*([\d.,]+\s*[-–~]\s*[\d.,]+\s*(?:grs?|gr|g|cm|kg)?\b\.?)/i),
    piecesPerKg: part(/([\d.,]+\s*[-–~]\s*[\d.,]+)\s*(?:pcs|pieces|pc)\s*\/\s*kg/i),
    pieceLength: part(/\blength\s*:?\s*(.+?)(?=\s+[-–]\s|\s*\bratio\b|$)/i),
    partRatio: part(/\bratio\b[^:]*:\s*(.+?)(?=\s+[-–]\s|\s*\bbacteria\b|$)/i),
  };
}

/* ---------- Bảng của PDF xuất từ Word: ghép lại theo tọa độ ---------- */

interface PdfCell {
  text: string;
  x0: number;
  x1: number;
}
interface PdfLine {
  page: number;
  y: number;
  h: number;
  cells: PdfCell[];
}

/** Mẩu chữ ⇒ dòng (cùng đường chữ) ⇒ ô (cách ≤ `gap` điểm) — như rowsFromTextItems nhưng giữ tọa độ. */
function pdfLines(items: readonly (PdfTextItem & { page?: number })[], gap = 3): PdfLine[] {
  const xs = items.filter((i) => i.str.trim()).map((i) => ({ ...i, page: i.page ?? 1, h: i.height && i.height > 0 ? i.height : 10 }));
  xs.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const groups: (typeof xs)[] = [];
  for (const it of xs) {
    const last = groups[groups.length - 1];
    if (last && last[0].page === it.page && Math.abs(last[0].y - it.y) <= Math.max(2, last[0].h * 0.4)) last.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const cells: PdfCell[] = [];
    for (const it of g) {
      const prev = cells[cells.length - 1];
      if (prev && it.x - prev.x1 <= gap) {
        prev.text += it.x - prev.x1 > 0.5 && !prev.text.endsWith(" ") && !it.str.startsWith(" ") ? ` ${it.str}` : it.str;
        prev.x1 = Math.max(prev.x1, it.x + it.width);
      } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.width });
    }
    return { page: g[0].page, y: g[0].y, h: g[0].h, cells: cells.map((c) => ({ ...c, text: clean(c.text) })).filter((c) => c.text) };
  });
}

const knownHeader = (t: string) => {
  const k = colOf(t);
  return !!k && k !== "extra" && k !== "serial";
};
const numericCells = (l: PdfLine) => l.cells.filter((c) => parseInvoiceNumber(c.text) != null).length;
const overlap = (a: { x0: number; x1: number }, b: { x0: number; x1: number }) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);

/**
 * PDF xuất từ Word tách mỗi ô bảng nhiều dòng thành nhiều dòng chữ rời (R6): "Frozen iidako raw cut," /
 * "size 1.3 – 1.8 cm, standard grade" / "(including paper skin)", tiêu đề "Price" / "CNF main" / "port".
 * Ghép lại: cột = cụm chữ chồng nhau theo chiều ngang của phần dữ liệu; dòng hàng = dòng có ≥ 2 số, các dòng
 * chữ quanh nó (Word căn giữa theo chiều dọc) về dòng hàng gần nhất; dòng tiêu đề nằm trên. Không nhận ra
 * bảng ⇒ trả đúng như rowsFromTextItems.
 */
export function rowsFromPdfItems(items: readonly (PdfTextItem & { page?: number })[]): string[][] {
  const lines = pdfLines(items);
  const plain = (ls: readonly PdfLine[]) => ls.map((l) => l.cells.map((c) => c.text));
  for (let hs = 0; hs < lines.length; hs++) {
    if (lines[hs].cells.filter((c) => knownHeader(c.text)).length < 2) continue;
    const page = lines[hs].page;
    const a0 = lines.findIndex((l, i) => i > hs && i <= hs + 8 && l.page === page && numericCells(l) >= 2 && !TOTAL_ROW.test(l.cells[0]?.text ?? ""));
    if (a0 < 0) continue;
    let top = hs;
    while (top > 0) {
      const up = lines[top - 1];
      if (up.page !== page || up.y - lines[top].y > 1.3 * Math.max(up.h, lines[top].h) || up.cells.some((c) => c.text.length > 24 || /[:：]$/.test(c.text))) break;
      top--;
    }
    // Phần thân: tới dòng TOTAL (gồm), hoặc tới dòng đầu tiên cách xa / là đoạn văn dài.
    let end = a0 + 1;
    let total = -1;
    for (; end < lines.length; end++) {
      const l = lines[end];
      if (l.page !== page) break;
      if (TOTAL_ROW.test(l.cells[0]?.text ?? "")) {
        total = end;
        end++;
        break;
      }
      if (lines[end - 1].y - l.y > 2.2 * l.h || l.cells.some((c) => c.text.length > 60)) break;
    }
    const bodyEnd = total >= 0 ? total : end;
    const anchors = lines.slice(a0, bodyEnd).flatMap((l, k) => (numericCells(l) >= 2 ? [a0 + k] : []));
    const owner = new Map<number, number>();
    for (let i = a0; i < bodyEnd; i++) {
      const near = anchors.reduce((best, a) => (Math.abs(lines[a].y - lines[i].y) < Math.abs(lines[best].y - lines[i].y) ? a : best), anchors[0]);
      owner.set(i, near);
    }
    // Dòng chữ nằm trên dòng hàng đầu: thuộc dòng hàng khi gần bằng phần chữ của nó ở dưới (căn giữa).
    const below = [...owner].filter(([i, a]) => a === a0 && i > a0).map(([i]) => lines[a0].y - lines[i].y);
    const ext = below.length ? Math.max(...below) : 0;
    let dataTop = a0;
    while (dataTop - 1 > hs && lines[dataTop - 1].y - lines[a0].y <= ext + 0.3 * lines[a0].h) {
      dataTop--;
      owner.set(dataTop, a0);
    }
    const head = lines.slice(top, dataTop);
    const body = lines.slice(dataTop, total >= 0 ? total + 1 : bodyEnd);
    // Cột = cụm các ô chồng nhau theo chiều ngang của phần thân.
    const spans = body.flatMap((l) => l.cells.map((c) => ({ x0: c.x0, x1: c.x1 }))).sort((a, b) => a.x0 - b.x0);
    const cols: { x0: number; x1: number }[] = [];
    for (const sp of spans) {
      const last = cols[cols.length - 1];
      if (last && sp.x0 <= last.x1 + 1) last.x1 = Math.max(last.x1, sp.x1);
      else cols.push({ ...sp });
    }
    if (cols.length < 3) continue;
    const colFor = (c: PdfCell) => {
      let best = 0;
      cols.forEach((col, k) => {
        const o = overlap(col, c);
        const b = overlap(cols[best], c);
        if (o > b || (o <= 0 && b <= 0 && Math.abs((col.x0 + col.x1) / 2 - (c.x0 + c.x1) / 2) < Math.abs((cols[best].x0 + cols[best].x1) / 2 - (c.x0 + c.x1) / 2))) best = k;
      });
      return best;
    };
    const headerTexts = cols.map(() => [] as string[]);
    for (const l of head)
      for (const c of l.cells) {
        const hit = cols.flatMap((col, k) => (overlap(col, c) > 0 ? [k] : []));
        for (const k of hit.length ? hit : [colFor(c)]) headerTexts[k].push(c.text);
      }
    const rowOf = (ls: readonly PdfLine[]) => {
      const out = cols.map(() => [] as string[]);
      for (const l of ls) for (const c of l.cells) out[colFor(c)].push(c.text);
      return out.map((t) => t.join(" "));
    };
    const records = anchors.map((a) => rowOf(body.filter((l) => owner.get(lines.indexOf(l)) === a)));
    const synth = [headerTexts.map((t) => t.join(" ")), ...records, ...(total >= 0 ? [rowOf([lines[total]])] : [])];
    return [...plain(lines.slice(0, top)), ...synth, ...plain(lines.slice(total >= 0 ? total + 1 : bodyEnd))];
  }
  return rowsFromTextItems(items);
}

/* ---------- Dòng hàng dạng "nhãn : giá trị" (HĐ nhập của NCC Ấn Độ) ---------- */

const KV_LABEL = /^\s*(?:-\s*)?(?:\d+\s*\/?\.\s*)?(commodity|commodities|product|description|size|quantity|q'?ty|unit price|price|packing|total)\s*[:：]/i;

/** Giá trị sau dấu ":" của dòng — mỗi ô một giá trị (PDF tách ô theo khoảng trống; .docx tách theo tab). */
function kvValues(cells: readonly string[]): string[] {
  const at = cells.findIndex((c) => /[:：]/.test(c));
  if (at < 0) return [];
  const rest = clean(cells[at].slice(cells[at].search(/[:：]/) + 1));
  return [rest, ...cells.slice(at + 1).map(clean)].filter(Boolean);
}

/**
 * HĐ không có bảng mà ghi từng nhãn (R6): "1/. Commodity : FROZEN OCTOPUS…" · "Size : 100/200 200/300" ·
 * "Quantity : 18,000.00 5,000 1,000 (KGS)" · "Unit Price : 4.00 (USD/KG CFR…)" · "Packing : 4Kgs … x 5 per
 * Carton" · "Total : 96,000.00 USD", rồi dòng "Total: USD 96,000.00 (24,000.00 KGS / 1,200 Ctns)". Nhiều
 * size ⇒ mỗi size một dòng hàng, lượng theo thứ tự.
 */
function findKeyValueLines(rows: readonly (readonly string[])[]): Table | null {
  interface Block {
    description: string;
    sizes: string[];
    qty: number[];
    qtyUnit: string;
    prices: number[];
    priceText: string;
    packing: string;
    amount: number | null;
  }
  const blocks: Block[] = [];
  let start = -1;
  let end = -1;
  let totalKg: number | null = null;
  let totalAmount: number | null = null;
  let headerText = "";
  const freeText: string[] = [];
  const numbersIn = (vals: readonly string[]) =>
    vals.flatMap((v) => v.split(/\s+/)).map((t) => parseInvoiceNumber(t.replace(/[()]/g, ""))).filter((n): n is number => n != null);
  rows.forEach((row, i) => {
    const m = rowText(row).match(KV_LABEL);
    if (!m) return;
    const label = m[1].toLowerCase();
    const vals = kvValues(row);
    const block = blocks[blocks.length - 1];
    if (/commodit|product|description/.test(label)) {
      blocks.push({ description: vals.join(" "), sizes: [], qty: [], qtyUnit: "", prices: [], priceText: "", packing: "", amount: null });
      if (start < 0) start = i;
      end = i + 1;
      return;
    }
    if (!block) return;
    end = i + 1;
    const joined = vals.join(" ");
    if (label === "size") block.sizes = vals.flatMap((v) => (/\s{2,}/.test(v) ? v.split(/\s{2,}/) : [v])).map(clean).filter(Boolean);
    else if (/quantity|q'?ty/.test(label)) {
      block.qty = numbersIn(vals);
      block.qtyUnit = joined.match(/\b(kgs?|mt|tons?|ctns?|cartons?)\b/i)?.[1].toLowerCase() ?? "kg";
    } else if (/price/.test(label)) {
      block.prices = numbersIn(vals);
      block.priceText = joined;
      headerText = headerText || joined;
    } else if (label === "packing") block.packing = joined;
    else if (label === "total") {
      const kg = joined.match(/([\d.,]+)\s*kgs?\b/i);
      if (kg) {
        freeText.push(joined);
        totalKg = parseInvoiceNumber(kg[1]);
        totalAmount = parseInvoiceNumber(joined.match(/(?:USD|JPY|EUR)\s*([\d.,]+)|([\d.,]+)\s*(?:USD|JPY|EUR)/i)?.slice(1).find(Boolean) ?? "");
      } else block.amount = numbersIn(vals)[0] ?? null;
    }
  });
  if (!blocks.length) return null;
  const warnings: string[] = [];
  const lines = blocks.flatMap((b) => {
    const n = Math.max(b.sizes.length, b.qty.length, 1);
    const factor = /mt|ton/.test(b.qtyUnit) ? 1000 : 1;
    const byCarton = /ctn|carton/.test(b.qtyUnit);
    const perCarton = /\/\s*(ctn|carton)/i.test(b.priceText);
    if (perCarton) warnings.push("Đơn giá trên file tính theo thùng — app ghi giá theo kg nên không điền đơn giá.");
    const netKg = packingNetKg(b.packing);
    return Array.from({ length: n }, (_, k): ReadContractLine => {
      const q = b.qty[k] ?? null;
      let cartons = byCarton ? q : null;
      let kg = byCarton ? null : q == null ? null : round2(q * factor);
      if (cartons == null && kg != null && netKg) {
        const c = kg / netKg;
        if (Math.abs(c - Math.round(c)) < 1e-6) cartons = Math.round(c);
      }
      if (kg == null && cartons != null && netKg) kg = round2(cartons * netKg);
      return {
        description: b.description,
        size: b.sizes[k] ?? (b.sizes.length === 1 ? b.sizes[0] : ""),
        packing: b.packing,
        netKgPerCarton: netKg,
        cartons,
        kg,
        unitPrice: perCarton ? null : (b.prices[k] ?? b.prices[0] ?? null),
        amount: n === 1 ? b.amount : null,
        piecesPerKg: "",
        pieceLength: "",
        partRatio: "",
        hsCode: "",
        note: "",
      };
    });
  });
  return { start, end, lines, totalKg, totalAmount, warnings, headerText, freeText };
}

/* ---------- Đầu HĐ, điều khoản ---------- */

const INCOTERM_RE = /\b(EXW|FCA|FAS|FOB|CFR|CNF|C\s*&\s*F|CIF|CPT|CIP|DAP|DPU|DDP)\b\.?\s*,?\s*([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ .'-]*?)?\s*(?=,|\(|\)|$|\s{2}|\s+port\b|\s+incoterms?\b)/i;
const LOADING_TERMS = new Set(["EXW", "FCA", "FAS", "FOB"]);

function firstMatch(texts: readonly string[], re: RegExp): RegExpMatchArray | null {
  for (const t of texts) {
    const m = t.match(re);
    if (m) return m;
  }
  return null;
}

/** Đọc các dòng chữ của một file hợp đồng / phụ lục. Không ghi gì. */
export function parseContractRows(rows: readonly (readonly string[])[], role: ContractRole): ContractReadResult {
  const table = findTable(rows) ?? findKeyValueLines(rows);
  const outside = rows
    .filter((_, i) => !table || i < table.start || i >= table.end)
    .map(rowText)
    .filter(Boolean);
  const warnings: string[] = [...(table?.warnings ?? [])];
  const priceWarnings: string[] = [];

  // Hai bên (R3).
  let sellerName = "";
  let buyerName = "";
  let sellerAddress = "";
  let buyerAddress = "";
  // Bên đang đọc (dòng địa chỉ ngay sau tên bên thuộc về bên đó; gặp Tel / Fax / bên khác thì thôi).
  let side: "seller" | "buyer" | "" = "";
  for (const t of outside) {
    const m = t.match(/^(?:the\s*)?(seller|buyer|bên bán|bên mua)\b\s*(?:\([^)]*\))?\s*[:：]\s*(.+)$/i);
    if (m) {
      const isSeller = /seller|bán/i.test(m[1]);
      side = isSeller ? "seller" : "buyer";
      if (isSeller && !sellerName) sellerName = clean(m[2]);
      if (!isSeller && !buyerName) buyerName = clean(m[2]);
      continue;
    }
    const addr = side ? t.match(/^(?:add(?:ress)?|địa\s*chỉ)\.?\s*[:：]?\s*(.+)$/i) : null;
    if (addr && side === "seller" && !sellerAddress) sellerAddress = clean(addr[1]);
    else if (addr && side === "buyer" && !buyerAddress) buyerAddress = clean(addr[1]);
    else if (!addr) side = "";
  }
  let partnerName = "";
  let partnerSide: ReadContract["partnerSide"] = "";
  const wantSide = role === "export" ? "buyer" : "seller";
  const wanted = role === "export" ? buyerName : sellerName;
  const other = role === "export" ? sellerName : buyerName;
  let partnerAddress = "";
  if (wanted && !isOurs(wanted)) {
    partnerName = wanted;
    partnerAddress = role === "export" ? buyerAddress : sellerAddress;
    partnerSide = wantSide;
  } else if (wanted && isOurs(wanted) && other && !isOurs(other)) {
    warnings.push(
      role === "export"
        ? `File có vẻ là HĐ nhập: Baseafood là bên mua, bên bán là ${other} — không điền khách.`
        : `File có vẻ là HĐ xuất: Baseafood là bên bán, bên mua là ${other} — không điền đối tác.`,
    );
  }

  // Phụ lục: "ANNEX OF CONTRACT 01-26-HAT DATED April 20, 2026" rồi "No: 01 dated October 10, 2026" (R4).
  let isAnnex = false;
  let contractNo = "";
  let signedOn = "";
  let annexNo = "";
  let annexDate = "";
  const annexAt = outside.findIndex((t) => /\bannex\b|phụ lục/i.test(t) && /\bcontract\b|hợp đồng/i.test(t));
  if (annexAt >= 0) {
    const m = outside[annexAt].match(/\b(?:of|to)\s+(?:the\s+)?(?:sales\s+)?(?:contract|hợp đồng)\s*(?:no\.?|số)?\s*[:：]?\s*([A-Z0-9][\w./-]*)\s*,?\s*(?:dated|date|ngày)?\s*(.*)$/i);
    if (m) {
      isAnnex = true;
      contractNo = m[1];
      signedOn = parseInvoiceDate(m[2]);
      annexNo = outside[annexAt].match(/annex\s*no\.?\s*(\d+)/i)?.[1] ?? "";
      const next = outside.slice(annexAt + 1, annexAt + 3).map((t) => t.match(/^no\.?\s*[:：]?\s*([\w./-]+)\s*,?\s*(?:dated|date|ngày)\s*(.+)$/i)).find(Boolean);
      if (next) {
        annexNo = annexNo || next[1];
        annexDate = parseInvoiceDate(next[2]);
      }
    }
  }
  if (!contractNo) {
    for (const [i, t] of outside.entries()) {
      const m =
        t.match(/\b(?:sales\s+|purchase\s+)?contract\s*(?:no\.?|number|#)\s*[:：]?\s*([A-Z0-9][\w./-]*)\s*(.*)$/i) ??
        t.match(/\bsố\s*(?:hợp đồng|hđ)\s*[:：]?\s*(\S+)\s*(.*)$/i) ??
        (i > 0 && /contract|hợp đồng/i.test(outside[i - 1]) ? t.match(/^no\.?\s*[:：]?\s*([A-Z0-9][\w./-]*)\s*(.*)$/i) : null);
      if (!m) continue;
      contractNo = m[1];
      signedOn = parseInvoiceDate(m[2]);
      break;
    }
  }
  if (!signedOn) {
    const dated = firstMatch(outside.slice(0, 12), /^(?:date|dated|ngày ký|ngày)\s*[:：]?\s*(.+)$/i);
    if (dated) signedOn = parseInvoiceDate(dated[1]);
  }

  const purpose =
    firstMatch(outside, /for the purpose(?: of)?\s*[“"‘']([^”"’']+)[”"’']/i) ?? firstMatch(outside, /for the purpose(?: of)?\s+(.+?)(?:\s+as (?:below|follows))?\s*:?$/i);
  const changeSummary = purpose ? clean(purpose[1]) : "";
  const orderRef = firstMatch(outside, /\b(?:P\.?\s?O\.?|order|your ref)\s*(?:no\.?|number|ref\.?|#)?\s*[:：]\s*(#?[A-Z0-9][\w./-]*)/i)?.[1] ?? "";

  // Điều khoản (R5): tìm ở dòng tiêu đề bảng trước (Price … CNF Hakata), rồi tới chữ ngoài bảng.
  const termTexts = [...(table ? [table.headerText] : []), ...outside];
  let incoterm = "";
  let incotermRaw = "";
  let portOfLoading = "";
  let portOfDischarge = "";
  const inc = firstMatch(termTexts, INCOTERM_RE);
  if (inc) {
    incotermRaw = inc[1].toUpperCase().replace(/\s+/g, "");
    incoterm = incotermRaw === "CNF" || incotermRaw === "C&F" ? "CFR" : incotermRaw;
    const port = clean(inc[2]);
    if (port && !/^(incoterms?|price|usd|jpy|eur|terms?|main|any)\b/i.test(port)) {
      if (LOADING_TERMS.has(incoterm)) portOfLoading = port;
      else portOfDischarge = port;
    }
  }
  portOfLoading = portOfLoading || clean(firstMatch(outside, /port of loading\s*[:：]\s*([^,;]+)/i)?.[1]);
  portOfDischarge = portOfDischarge || clean(firstMatch(outside, /port of (?:discharge|destination)\s*[:：]\s*([^,;]+)/i)?.[1]);
  portOfDischarge =
    portOfDischarge ||
    clean(firstMatch(outside.filter((t) => /shipment/i.test(t)), /\bto\s+([A-Z][A-Za-z .'-]+?(?:,\s*[A-Z][A-Za-z .'-]+?)?)\s+(?:within|before|in|on|by|not|during|from|latest)\b/)?.[1]);
  const cur = firstMatch(termTexts, /\b(USD|JPY|EUR|GBP|AUD|CNY)\b|US\$/i);
  const currency = cur ? (cur[1] ?? "USD").toUpperCase() : "";
  const terms = [...outside, ...(table?.freeText ?? [])];
  const tol =
    firstMatch(terms, /(\d+(?:[.,]\d+)?)\s*%\s*(?:more or less|\+\/-|±)/i) ??
    firstMatch(terms, /(?:more or less|±|\+\/-)\s*(\d+(?:[.,]\d+)?)\s*%/i) ??
    firstMatch(terms, /tolerance[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*%/i);
  const tolerancePct = tol ? parseInvoiceNumber(tol[1]) : null;
  let latestShipmentDate = "";
  let latestShipmentInferred = false;
  for (const t of outside) {
    if (!/time of (?:shipment|delivery)|shipment (?:time|date|period)|date of shipment|latest (?:date of )?shipment|delivery time|\bshipment\s*[:：]/i.test(t) || /\bannex\b/i.test(t)) continue;
    const d = parseShipmentDeadline(t);
    if (!d) continue;
    latestShipmentDate = d.date;
    latestShipmentInferred = d.inferred;
    break;
  }
  // Hạn HĐ (69 R5): binding / valid / validity / effective / hiệu lực … to / until / till / through <ngày>.
  const validity = firstMatch([outside.join(" ")], /\b(?:binding|valid|validity|effective|hiệu lực)\b[^.;]*?\b(?:to|until|till|through|đến)\s+(?:late|latest|the end of)?\s*([^.;]{6,40})/i);
  const contractValidUntil = validity ? parseInvoiceDate(validity[1]) : "";
  const cont = firstMatch(outside, /(\d+)\s*(?:x\s*)?(?:(?:20|40)\s*['’]?\s*(?:ft|feet)?\s*(?:hc|rf|rh|reefers?|dc)?\s*)?(?:containers?|conts?)\b/i) ?? firstMatch(outside, /(\d+)\s*x\s*(?:20|40)\s*['’]/i);
  const containerCount = cont ? Number(cont[1]) : null;
  const ctype = firstMatch(outside, /\b(20|40)\s*['’]?\s*(?:ft|feet)?\s*(hc)?\s*-?\s*(rf|rh|reefers?)\b/i);
  const containerType = ctype ? `${ctype[1]}${ctype[2] ? "HC-" : ""}RF` : "";
  const payTexts = outside.filter((t) => /payment|thanh toán/i.test(t));
  const paymentMethod: ReadContract["paymentMethod"] = payTexts.some((t) => /\bL\s*\/\s*C\b|\bLC\b|letter of credit/i.test(t))
    ? "lc"
    : payTexts.some((t) => /\bT\s*\/\s*T\b|\bTTR\b|telegraphic|wire transfer|bank transfer/i.test(t))
      ? "ttr"
      : "";
  const lcNo = firstMatch(outside, /L\s*\/\s*C\s*No\.?\s*[:：]?\s*([A-Z0-9][\w/-]*)/i)?.[1] ?? "";
  const dep = firstMatch(payTexts, /(\d+(?:[.,]\d+)?)\s*%\s*(?:of [\w\s]+?\s+)?(?:deposit|in advance|advance)/i);
  const depositPct = dep ? parseInvoiceNumber(dep[1]) : null;

  // Kiểm tiền từng dòng + dòng Total (R6).
  const lines = table?.lines ?? [];
  const lineIssues: ReadLineIssue[] = [];
  lines.forEach((l, i) => {
    if (l.kg == null || l.unitPrice == null || l.amount == null) return;
    const expected = round2(l.kg * l.unitPrice);
    const diff = round2(l.amount - expected);
    if (Math.abs(diff) <= 0.01) return;
    lineIssues.push({ lineIndex: i, expected, actual: l.amount, diff });
    priceWarnings.push(
      `Dòng ${i + 1}${l.size ? ` (${l.size})` : ""}: ${num(l.kg)} kg × ${formatUnitPrice(l.unitPrice)} = ${formatMoney(expected)}, file ghi ${formatMoney(l.amount)} (chênh ${formatMoney(diff)}) — kiểm lại file.`,
    );
  });
  const sumKg = round2(lines.reduce((s, l) => s + (l.kg ?? 0), 0));
  const sumAmount = round2(lines.reduce((s, l) => s + (l.amount ?? 0), 0));
  if (table?.totalKg != null && Math.abs(table.totalKg - sumKg) > 0.01) warnings.push(`Dòng Total ghi ${num(table.totalKg)} kg, cộng các dòng ra ${num(sumKg)} kg.`);
  if (table?.totalAmount != null && lines.some((l) => l.amount != null) && Math.abs(table.totalAmount - sumAmount) > 0.01)
    priceWarnings.push(`Dòng Total ghi ${formatMoney(table.totalAmount)}, cộng tiền các dòng ra ${formatMoney(sumAmount)}.`);
  const sumPriced = round2(lines.reduce((s, l) => s + (l.kg ?? 0) * (l.unitPrice ?? 0), 0));
  if (table?.totalAmount != null && !lines.some((l) => l.amount != null) && lines.every((l) => l.kg != null && l.unitPrice != null) && Math.abs(table.totalAmount - sumPriced) > 0.01)
    priceWarnings.push(`Tổng tiền trên file ${formatMoney(table.totalAmount)}, kg × đơn giá các dòng ra ${formatMoney(sumPriced)}.`);
  lines.forEach((l, i) => {
    if (l.kg != null && l.netKgPerCarton && l.cartons == null)
      warnings.push(`Dòng ${i + 1}${l.size ? ` (${l.size})` : ""}: ${num(l.kg)} kg không chia hết ${num(l.netKgPerCarton)} kg/thùng — ghi kg tay, số thùng để trống.`);
  });
  if (latestShipmentInferred) warnings.push(`Hạn giao muộn nhất suy ra từ tháng (${formatDateVN(latestShipmentDate)}) — soát lại theo hợp đồng.`);

  if (!contractNo && !partnerName && !sellerName && !buyerName && !lines.length) return fail("empty");
  return {
    ok: true,
    contract: {
      isAnnex,
      contractNo,
      signedOn,
      annexNo,
      annexDate,
      changeSummary,
      sellerName,
      buyerName,
      partnerName,
      partnerAddress,
      partnerSide,
      orderRef,
      incoterm: (INCOTERMS as readonly string[]).includes(incoterm) ? incoterm : "",
      incotermRaw,
      portOfLoading,
      portOfDischarge,
      currency,
      tolerancePct,
      latestShipmentDate,
      latestShipmentInferred,
      contractValidUntil,
      containerCount,
      containerType,
      paymentMethod,
      lcNo,
      depositPct,
      lines,
      totalKg: table?.totalKg ?? null,
      totalAmount: table?.totalAmount ?? null,
      lineIssues,
      warnings,
      priceWarnings,
    },
  };
}

/* ---------- Ghép danh mục (R8) ---------- */

const PARTY_NOISE = /\b(co|ltd|limited|company|corp|corporation|inc|jsc|llc|pte|plc|gmbh|sa|bv|kk|cty|tnhh)\b/g;

/** Tên đối tác chuẩn hóa: bỏ dấu câu, bỏ CO / LTD / JSC…, không phân hoa thường. */
export const partyKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[.,()&'’"]/g, " ")
    .replace(PARTY_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();

const wordsContain = (whole: string, part: string) => !!part && ` ${whole} `.includes(` ${part} `);

/** Mục danh mục khớp tên trên file: bằng (ưu tiên) — không có thì tên này chứa trọn tên kia. Ra đúng một mới điền. */
export function matchParty<T>(name: string, rows: readonly T[], namesOf: (r: T) => string[]): { match: T | null; candidates: T[] } {
  const k = partyKey(name);
  if (!k) return { match: null, candidates: [] };
  const equal = rows.filter((r) => namesOf(r).some((n) => partyKey(n) === k));
  if (equal.length) return { match: equal.length === 1 ? equal[0] : null, candidates: equal };
  const near = rows.filter((r) => namesOf(r).some((n) => wordsContain(partyKey(n), k) || wordsContain(k, partyKey(n))));
  return { match: near.length === 1 ? near[0] : null, candidates: near };
}

/** Mục của danh sách chọn (cảng, loại cont, tiền tệ — ba-spec 62) khớp chữ trên file; so cả phần trước dấu phẩy ("Hakata" ↔ "Hakata, Japan"). */
export function matchOption(raw: string, options: readonly ExportOption[], kind: ExportOptionListKind): { name: string; candidates: number } {
  const k = optionKey(raw);
  if (!k) return { name: "", candidates: 0 };
  const head = (v: string) => optionKey(v.split(",")[0]);
  const all = exportOptionsOf(options, kind);
  const hits = all.filter((o) => optionKey(o.name) === k);
  const near = hits.length ? hits : all.filter((o) => head(o.name) === head(raw) || optionKey(o.name).replace(/[\s-]/g, "") === k.replace(/[\s-]/g, ""));
  return { name: near.length === 1 ? near[0].name : "", candidates: near.length };
}

/* ---------- Điền form (R7, R9, R10) ---------- */

/** Một ô có giá trị khác file — chưa đổi; U1 chọn dùng giá trị trên file. `path` để áp lại (applyConflicts). */
export interface FillConflict {
  path: string;
  label: string;
  current: string;
  file: string;
  value: unknown;
  /** Ô tiền / giá — không hiện cho người không xem được giá. */
  isPrice?: boolean;
}

export interface ContractFill<T> {
  values: T;
  /** Nhãn các ô vừa điền. */
  filled: string[];
  /** Số ô đã điền (kể cả từng ô của dòng hàng mới) — đo "≥ 15 ô" của ba-spec 66 §8. */
  filledCells: number;
  conflicts: FillConflict[];
  /** Mục chưa có trong danh mục / ra nhiều lựa chọn / không đọc được. */
  notes: string[];
  /** R9: file là phụ lục của HĐ khác ⇒ không điền gì, chờ U1 xác nhận. */
  blocked: string;
  lines: { matched: number; added: number; notOnFile: string[] };
}

type Show = (v: unknown) => string;
const showText: Show = (v) => String(v ?? "");
const showNumber: Show = (v) => (typeof v === "number" ? num(v) : String(v ?? ""));
const showDate: Show = (v) => (v ? formatDateVN(String(v)) : "");
const showMoney: Show = (v) => (typeof v === "number" ? formatMoney(v) : String(v ?? ""));

const isBlank = (v: unknown) => v == null || (typeof v === "string" && !v.trim());
const same = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-6 : nameKey(String(a ?? "")) === nameKey(String(b ?? ""));

class Acc {
  filled: string[] = [];
  cells = 0;
  conflicts: FillConflict[] = [];
  notes: string[] = [];
  /** Dòng mới từ file: đếm từng ô có giá trị. */
  countLine(values: readonly unknown[]) {
    this.cells += values.filter((x) => !isBlank(x)).length;
  }
  /** Đặt một ô: trống (hoặc đúng giá trị mặc định chưa ai sửa) ⇒ điền; khác ⇒ liệt kê; bằng ⇒ thôi. */
  put<V>(path: string, label: string, current: V, file: V | null | undefined, opts: { baseline?: V; show?: Show; isPrice?: boolean } = {}): V {
    if (isBlank(file)) return current;
    const show = opts.show ?? showText;
    if (isBlank(current) || (opts.baseline !== undefined && same(current, opts.baseline) && !same(current, file))) {
      this.filled.push(label);
      this.cells++;
      return file as V;
    }
    if (same(current, file)) return current;
    this.conflicts.push({ path, label, current: show(current), file: show(file), value: file, isPrice: opts.isPrice });
    return current;
  }
}

const contractNoKey = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");

const lineLabel = (l: { size?: string; description?: string }, i: number) => (l.size || l.description ? [l.description, l.size].filter(Boolean).join(" · ") : `dòng ${i + 1}`);

/** Dòng file khớp dòng form: cùng size, và cùng tên / tỉ lệ khi cả hai có (R10). */
function pairLines<F>(fileLines: readonly ReadContractLine[], formLines: readonly F[], keyOf: (f: F) => { size: string; name: string; ratio: string }): (number | null)[] {
  const used = new Set<number>();
  return fileLines.map((l) => {
    const at = formLines.findIndex((f, i) => {
      if (used.has(i)) return false;
      const k = keyOf(f);
      if (l.size || k.size) {
        if (sizeKey(k.size) !== sizeKey(l.size)) return false;
      } else if (!k.name || nameKey(k.name) !== nameKey(l.description)) return false;
      if (k.name && l.description && nameKey(k.name) !== nameKey(l.description)) return false;
      if (k.ratio && l.partRatio && nameKey(k.ratio) !== nameKey(l.partRatio)) return false;
      return true;
    });
    if (at < 0) return null;
    used.add(at);
    return at;
  });
}

/** Giá trị form HĐ xuất mà bộ đọc điền được. */
export interface ExportContractFillValues {
  customerId: string;
  /** Địa chỉ khách đang hiện ở form (form rỗng ⇒ địa chỉ trong danh mục khách). */
  customerAddress?: string;
  contractNo: string;
  signedOn: string;
  orderRef: string;
  revisedOn: string;
  changeSummary: string;
  terms: ExportContractTerms;
  lines: ExportContractLine[];
}

export interface ExportFillContext {
  mode: "create" | "edit" | "revise";
  /** Giá trị mặc định lúc mở form (ngày ký = hôm nay, TTR, USD…) — chưa ai sửa thì coi như trống. */
  baseline: Pick<ExportContractFillValues, "signedOn" | "revisedOn"> & Pick<ExportContractTerms, "paymentMethod" | "currency">;
  customers: readonly Pick<Customer, "id" | "name" | "code">[];
  options: readonly ExportOption[];
  canSeePrice: boolean;
  /** Khách không đổi được nữa (R44) ⇒ không điền khách. */
  customerLocked?: boolean;
  /** R9: U1 đã xác nhận dùng phụ lục của HĐ khác. */
  force?: boolean;
  newLineId: () => string;
  /** Gợi ý mặt hàng cho dòng mới (41 R23) — "" = không ra đúng một. */
  suggestProduct?: (description: string, size: string, customerId: string) => string;
}

/** Điền form HĐ xuất từ kết quả đọc (NV1, NV2). Không ghi sổ. */
export function fillExportContract(values: ExportContractFillValues, read: ReadContract, ctx: ExportFillContext): ContractFill<ExportContractFillValues> {
  const empty = { matched: 0, added: 0, notOnFile: [] as string[] };
  if (ctx.mode !== "create" && read.contractNo && values.contractNo && contractNoKey(read.contractNo) !== contractNoKey(values.contractNo) && !ctx.force) {
    return {
      values,
      filled: [],
      conflicts: [],
      notes: [],
      filledCells: 0,
      blocked: `File là ${read.isAnnex ? "phụ lục" : "hợp đồng"} của HĐ ${read.contractNo}, đang ${ctx.mode === "revise" ? "ghi bản sửa" : "sửa"} HĐ ${values.contractNo}.`,
      lines: empty,
    };
  }
  const a = new Acc();
  const v: ExportContractFillValues = { ...values, terms: { ...values.terms }, lines: values.lines.map((l) => ({ ...l })) };
  if (ctx.mode !== "create" && !read.contractNo) a.notes.push("File không ghi số hợp đồng — kiểm lại đúng hợp đồng đang sửa.");

  // Đầu HĐ: bản sửa khóa khách / số / ngày ký (41 R3) ⇒ chỉ điền ngày + nội dung của bản sửa.
  if (ctx.mode !== "revise") {
    if (read.partnerName && !ctx.customerLocked) {
      const { match, candidates } = matchParty(read.partnerName, ctx.customers, (c) => [c.name, c.code]);
      if (match) v.customerId = a.put("customerId", "Khách hàng", v.customerId, match.id, { show: (id) => ctx.customers.find((c) => c.id === id)?.name ?? "" });
      else if (candidates.length) a.notes.push(`Khách "${read.partnerName}" khớp ${candidates.length} khách trong danh mục (${candidates.map((c) => c.name).join(", ")}) — chọn tay.`);
      else a.notes.push(`Khách "${read.partnerName}" chưa có trong danh mục khách hàng — thêm ở ô Khách hàng.`);
    }
    if (read.partnerAddress && !ctx.customerLocked) v.customerAddress = a.put("customerAddress", "Địa chỉ khách hàng", v.customerAddress ?? "", read.partnerAddress);
    v.contractNo = a.put("contractNo", "Số hợp đồng", v.contractNo, read.contractNo);
    v.signedOn = a.put("signedOn", "Ngày ký", v.signedOn, read.signedOn, { baseline: ctx.mode === "create" ? ctx.baseline.signedOn : undefined, show: showDate });
    v.orderRef = a.put("orderRef", "Số PO của khách", v.orderRef, read.orderRef);
  }
  if (ctx.mode !== "create") {
    v.revisedOn = a.put("revisedOn", "Ngày của bản này", v.revisedOn, read.isAnnex ? read.annexDate : "", { baseline: ctx.mode === "revise" ? ctx.baseline.revisedOn : undefined, show: showDate });
    v.changeSummary = a.put("changeSummary", "Nội dung sửa", v.changeSummary, read.changeSummary);
  }

  // Điều khoản (R5) — ô danh sách chọn chỉ điền khi khớp đúng một mục (R8).
  const t = v.terms;
  const optionFor = (raw: string, kind: ExportOptionListKind) => {
    if (!raw) return "";
    const m = matchOption(raw, ctx.options, kind);
    const meta = exportOptionListMeta(kind);
    if (!m.name) a.notes.push(m.candidates ? `${meta.title} "${raw}" khớp ${m.candidates} mục — chọn tay.` : `${meta.title} "${raw}" chưa có trong danh sách — thêm ở ô ${meta.title}.`);
    return m.name;
  };
  t.incoterm = a.put("terms.incoterm", "Incoterm", t.incoterm, read.incoterm);
  if (read.incotermRaw && read.incoterm && read.incotermRaw !== read.incoterm) a.notes.push(`File ghi ${read.incotermRaw} — app ghi theo Incoterms 2020 là ${read.incoterm}.`);
  t.portOfLoading = a.put("terms.portOfLoading", "Cảng xếp", t.portOfLoading, optionFor(read.portOfLoading, "loading-port"));
  t.portOfDischarge = a.put("terms.portOfDischarge", "Cảng đích", t.portOfDischarge, optionFor(read.portOfDischarge, "discharge-port"));
  t.currency = a.put("terms.currency", "Tiền tệ", t.currency, optionFor(read.currency, "currency"), { baseline: ctx.mode === "create" ? ctx.baseline.currency : undefined });
  t.tolerancePct = a.put("terms.tolerancePct", "Dung sai ±", t.tolerancePct, read.tolerancePct, { show: showNumber });
  t.latestShipmentDate = a.put("terms.latestShipmentDate", "Hạn giao muộn nhất", t.latestShipmentDate, read.latestShipmentDate, { show: showDate });
  t.contractValidUntil = a.put("terms.contractValidUntil", "Hạn hợp đồng", t.contractValidUntil ?? "", read.contractValidUntil, { show: showDate });
  t.containerCount = a.put("terms.containerCount", "Số container", t.containerCount, read.containerCount, { show: showNumber });
  t.containerType = a.put("terms.containerType", "Loại container", t.containerType, optionFor(read.containerType, "container-type"));
  if (read.paymentMethod)
    t.paymentMethod = a.put("terms.paymentMethod", "Thanh toán", t.paymentMethod, read.paymentMethod, {
      baseline: ctx.mode === "create" ? ctx.baseline.paymentMethod : undefined,
      show: (x) => (x === "lc" ? "L/C" : x === "ttr" ? "TTR" : "Khác"),
    });
  t.lcNo = a.put("terms.lcNo", "Số L/C", t.lcNo, read.lcNo);
  t.depositPct = a.put("terms.depositPct", "Đặt cọc", t.depositPct, read.depositPct, { show: showNumber });

  // Dòng hàng (R6, R10).
  const toLine = (l: ReadContractLine): ExportContractLine => {
    const pid = ctx.suggestProduct?.(l.description, l.size, v.customerId) ?? "";
    const unitPrice = ctx.canSeePrice ? l.unitPrice : null;
    a.countLine([l.description, l.hsCode, l.size, l.packing, l.netKgPerCarton, l.cartons, l.cartons != null && l.netKgPerCarton ? null : l.kg, unitPrice, l.pieceLength, l.partRatio, l.piecesPerKg, l.note, pid]);
    return {
      id: ctx.newLineId(),
      description: l.description,
      hsCode: l.hsCode,
      size: l.size,
      packing: l.packing,
      unitKind: "carton",
      cartonsPerUnit: 1,
      netKgPerCarton: l.netKgPerCarton,
      quantity: l.cartons,
      kg: l.cartons != null && l.netKgPerCarton ? null : l.kg,
      unitPrice,
      microSpec: "",
      pieceLength: l.pieceLength,
      partRatio: l.partRatio,
      piecesPerKg: l.piecesPerKg,
      note: l.note,
      ...(pid ? { productId: pid } : {}),
    };
  };
  const hasContent = (l: ExportContractLine) => !!l.description.trim() || l.quantity != null || l.kg != null || !!l.size.trim();
  const lines = { matched: 0, added: 0, notOnFile: [] as string[] };
  if (read.lines.length) {
    if (!v.lines.some(hasContent)) {
      v.lines = read.lines.map(toLine);
      lines.added = v.lines.length;
      a.filled.push(`${v.lines.length} dòng hàng`);
    } else {
      const pairs = pairLines(read.lines, v.lines, (f) => ({ size: f.size, name: f.description, ratio: f.partRatio ?? "" }));
      const added: ExportContractLine[] = [];
      read.lines.forEach((rl, i) => {
        const at = pairs[i];
        if (at == null) {
          added.push(toLine(rl));
          return;
        }
        lines.matched++;
        const f = v.lines[at];
        const tag = (field: string) => `line:${f.id}:${field}`;
        const lbl = (name: string) => `${name} · ${lineLabel(f, at)}`;
        const fileQty = rl.cartons;
        const fileKg = rl.cartons != null && rl.netKgPerCarton ? null : rl.kg;
        f.description = a.put(tag("description"), lbl("Tên hàng"), f.description, rl.description);
        f.packing = a.put(tag("packing"), lbl("Quy cách"), f.packing, rl.packing);
        f.netKgPerCarton = a.put(tag("netKgPerCarton"), lbl("Kg tịnh / thùng"), f.netKgPerCarton, rl.netKgPerCarton, { show: showNumber });
        f.quantity = a.put(tag("quantity"), lbl("Số lượng"), f.quantity, fileQty, { show: showNumber });
        if (fileKg != null) f.kg = a.put(tag("kg"), lbl("Kg"), f.kg, fileKg, { show: showNumber });
        if (ctx.canSeePrice) f.unitPrice = a.put(tag("unitPrice"), lbl("Đơn giá"), f.unitPrice, rl.unitPrice, { show: showMoney, isPrice: true });
        f.piecesPerKg = a.put(tag("piecesPerKg"), lbl("Số miếng / kg"), f.piecesPerKg ?? "", rl.piecesPerKg);
        f.pieceLength = a.put(tag("pieceLength"), lbl("Chiều dài"), f.pieceLength ?? "", rl.pieceLength);
        f.partRatio = a.put(tag("partRatio"), lbl("Tỉ lệ râu / thân / cổ"), f.partRatio ?? "", rl.partRatio);
        f.hsCode = a.put(tag("hsCode"), lbl("Mã HS"), f.hsCode, rl.hsCode);
        f.note = a.put(tag("note"), lbl("Ghi chú dòng"), f.note ?? "", rl.note);
      });
      const matchedAt = new Set(pairs.filter((x): x is number => x != null));
      lines.notOnFile = v.lines.flatMap((l, i) => (hasContent(l) && !matchedAt.has(i) ? [lineLabel(l, i)] : []));
      lines.added = added.length;
      if (added.length) {
        v.lines = [...v.lines.filter(hasContent), ...added];
        a.filled.push(`${added.length} dòng hàng mới`);
      }
    }
  }
  return { values: v, filled: a.filled, filledCells: a.cells, conflicts: a.conflicts, notes: a.notes, blocked: "", lines };
}

/** Áp các ô U1 chọn "dùng giá trị trên file" (đường dẫn `path` của FillConflict). */
export function applyExportConflicts(values: ExportContractFillValues, picks: readonly FillConflict[]): ExportContractFillValues {
  const v: ExportContractFillValues = { ...values, terms: { ...values.terms }, lines: values.lines.map((l) => ({ ...l })) };
  for (const c of picks) {
    const [head, a, b] = c.path.split(/[.:]/);
    if (head === "terms") (v.terms as unknown as Record<string, unknown>)[a] = c.value;
    else if (head === "line") {
      const l = v.lines.find((x) => x.id === a);
      if (l) (l as unknown as Record<string, unknown>)[b] = c.value;
    } else (v as unknown as Record<string, unknown>)[head] = c.value;
  }
  return v;
}

/* ---------- HĐ nhập (NV3) ---------- */

export interface ImportLineFillValues {
  id: string;
  productName: string;
  productId: string;
  goodsTypeId: string;
  kg: number | null;
  unitPrice: number | null;
}

export interface ImportContractFillValues {
  supplierId: string;
  contractNo: string;
  signedDate: string;
  /** Hạn hợp đồng (ba-spec 69) — undefined = máy chủ chưa có cột ⇒ không điền. */
  validUntil?: string;
  currency: string;
  lines: ImportLineFillValues[];
}

export interface ImportFillContext {
  mode: "create" | "edit";
  /** Tiền tệ mặc định lúc mở form (USD) — chưa ai sửa thì coi như trống. */
  baselineCurrency: string;
  suppliers: readonly Pick<ImportSupplier, "id" | "shortName" | "fullName" | "code">[];
  newLineId: () => string;
  /** Gợi ý mặt hàng (45 R21) — "" = không ra đúng một. */
  suggestProduct?: (productName: string, supplierId: string) => string;
}

/** Điền form HĐ nhập từ kết quả đọc (NV3). Loại hình KHÔNG đọc từ file. Không ghi sổ. */
export function fillImportContract(values: ImportContractFillValues, read: ReadContract, ctx: ImportFillContext): ContractFill<ImportContractFillValues> {
  const a = new Acc();
  const v: ImportContractFillValues = { ...values, lines: values.lines.map((l) => ({ ...l })) };
  if (read.partnerName) {
    const { match, candidates } = matchParty(read.partnerName, ctx.suppliers, (s) => [s.shortName, s.fullName, s.code]);
    if (match) v.supplierId = a.put("supplierId", "Đối tác", v.supplierId, match.id, { show: (id) => ctx.suppliers.find((s) => s.id === id)?.shortName ?? "" });
    else if (candidates.length) a.notes.push(`Đối tác "${read.partnerName}" khớp ${candidates.length} NCC (${candidates.map((s) => s.shortName).join(", ")}) — chọn tay.`);
    else a.notes.push(`Đối tác "${read.partnerName}" chưa có trong danh mục NCC nhập khẩu — thêm ở ô Đối tác.`);
  }
  v.contractNo = a.put("contractNo", "Số hợp đồng", v.contractNo, read.contractNo);
  v.signedDate = a.put("signedDate", "Ngày ký", v.signedDate, read.signedOn, { show: showDate });
  if (v.validUntil !== undefined) v.validUntil = a.put("validUntil", "Hạn hợp đồng", v.validUntil, read.contractValidUntil, { show: showDate });
  v.currency = a.put("currency", "Tiền tệ", v.currency, read.currency, { baseline: ctx.mode === "create" ? ctx.baselineCurrency : undefined });
  const toLine = (l: ReadContractLine): ImportLineFillValues => {
    const line: ImportLineFillValues = {
      id: ctx.newLineId(),
      productName: [l.description, l.size].filter(Boolean).join(" "),
      productId: ctx.suggestProduct?.(l.description, v.supplierId) ?? "",
      goodsTypeId: "",
      kg: l.kg,
      unitPrice: l.unitPrice,
    };
    a.countLine([line.productName, line.productId, line.kg, line.unitPrice]);
    return line;
  };
  const hasContent = (l: ImportLineFillValues) => !!l.productName.trim() || l.kg != null;
  const lines = { matched: 0, added: 0, notOnFile: [] as string[] };
  if (read.lines.length) {
    if (!v.lines.some(hasContent)) {
      v.lines = read.lines.map(toLine);
      lines.added = v.lines.length;
      a.filled.push(`${v.lines.length} dòng hàng`);
    } else {
      const used = new Set<number>();
      const added: ImportLineFillValues[] = [];
      read.lines.forEach((rl) => {
        const name = nameKey([rl.description, rl.size].filter(Boolean).join(" "));
        const at = v.lines.findIndex((f, i) => !used.has(i) && (nameKey(f.productName) === name || nameKey(f.productName) === nameKey(rl.description)));
        if (at < 0) {
          added.push(toLine(rl));
          return;
        }
        used.add(at);
        lines.matched++;
        const f = v.lines[at];
        f.kg = a.put(`line:${f.id}:kg`, `Số lượng · ${f.productName}`, f.kg, rl.kg, { show: showNumber });
        f.unitPrice = a.put(`line:${f.id}:unitPrice`, `Đơn giá · ${f.productName}`, f.unitPrice, rl.unitPrice, { show: showMoney, isPrice: true });
      });
      lines.notOnFile = v.lines.flatMap((l, i) => (hasContent(l) && !used.has(i) ? [l.productName || `dòng ${i + 1}`] : []));
      lines.added = added.length;
      if (added.length) {
        v.lines = [...v.lines.filter(hasContent), ...added];
        a.filled.push(`${added.length} dòng hàng mới`);
      }
    }
  }
  return { values: v, filled: a.filled, filledCells: a.cells, conflicts: a.conflicts, notes: a.notes, blocked: "", lines };
}

export function applyImportConflicts(values: ImportContractFillValues, picks: readonly FillConflict[]): ImportContractFillValues {
  const v: ImportContractFillValues = { ...values, lines: values.lines.map((l) => ({ ...l })) };
  for (const c of picks) {
    const [head, a, b] = c.path.split(":");
    if (head === "line") {
      const l = v.lines.find((x) => x.id === a);
      if (l) (l as unknown as Record<string, unknown>)[b] = c.value;
    } else (v as unknown as Record<string, unknown>)[head] = c.value;
  }
  return v;
}
