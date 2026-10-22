// ============================================================
// Tên file: src/lib/invoiceReader.ts
// Tên tiếng Việt: Đọc Commercial Invoice — từ file Excel gốc / PDF xuất từ Excel ra dòng hàng + tổng
// Description: Pure rules (ba-spec 41 v7 NV17 · R27): turn the rows of an invoice (cells of an
//              Excel sheet, or text items of a PDF regrouped into rows) into invoice no / date /
//              buyer / lines (name · size · packing · cartons · kg · price · amount) / totals;
//              match lines to the contract + customer names; compare with the contract and with the
//              totals already typed. File loading (xlsx / pdf.js) lives in invoiceFileReader.ts.
// ============================================================
// Vì sao (chủ dự án 2026-10-22): bỏ gõ tay 3 số tổng của Commercial Invoice và lấy tên hàng của
// khách từ invoice. Bản scan (ảnh) KHÔNG đọc — chỉ file gốc (Excel) hoặc PDF xuất từ Excel (có chữ).
// Bố cục canh theo invoice 234/26 (Seachemot, lô 165): dòng tên hàng (in đậm) → các dòng "SIZE:"
// (thùng · kg · đơn giá · tiền) → dòng "Packing:" → … → "TOTAL".
import type { CustomerProductName, ExportContractLine, ExportFile, ExportStepItem, Product } from "@/types";
import { nameKey, productsByCustomerName } from "./customerProductNames";
import { productsByTradeName, workingRevision, type ExportData } from "./exportPlanning";

/** Một ô: chữ, hoặc số (ô số của Excel). */
export type InvoiceCell = string | number | null | undefined;

export interface InvoiceLine {
  /** Tên hàng như in trên invoice (dòng tên của nhóm). */
  description: string;
  /** Chữ size như in ("2-3 gr/pc"), đã bỏ chữ "SIZE:" ở đầu; rỗng nếu nhóm không ghi size. */
  size: string;
  /** Quy cách đóng gói ("IQF, 1KG/PE x 10/CTN"), đã bỏ chữ "Packing:" ở đầu. */
  packing: string;
  cartons: number | null;
  netKg: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface InvoiceTotals {
  cartons: number | null;
  netKg: number | null;
  amount: number | null;
}

export interface CommercialInvoice {
  invoiceNo: string;
  /** yyyy-mm-dd, rỗng nếu không đọc được. */
  issuedOn: string;
  buyer: string;
  currency: string;
  lines: InvoiceLine[];
  /** Dòng TOTAL của invoice; không có dòng TOTAL ⇒ tổng các dòng (kèm cảnh báo). */
  totals: InvoiceTotals;
}

export type InvoiceReadFailure = "scan" | "unsupported" | "no-table" | "error";

export type InvoiceReadResult =
  | { ok: true; invoice: CommercialInvoice; warnings: string[] }
  | { ok: false; reason: InvoiceReadFailure; message: string };

/** Câu báo theo lý do không đọc được (dùng chung cho màn + test). */
export const INVOICE_FAILURE_MESSAGES: Record<InvoiceReadFailure, string> = {
  scan: "File này là bản scan (ảnh), không có chữ để đọc. Đính thêm file Excel hoặc PDF xuất từ Excel của invoice để tự điền.",
  unsupported: "Chỉ đọc được file Excel (.xlsx, .xls) hoặc PDF xuất từ Excel. Ảnh, Word, zip không đọc.",
  "no-table": "Không nhận ra bảng hàng của Commercial Invoice (cần dòng tiêu đề có chữ DESCRIPTION, các dòng hàng và dòng TOTAL).",
  error: "Không mở được file.",
};

/* ---------- Số ---------- */

/**
 * Số trên invoice (R22 — giống ô số của app): có cả "." lẫn "," ⇒ dấu sau cùng là phần lẻ
 * ("194,557.60"); chỉ "." đúng nhóm nghìn kiểu Việt ("1.234") ⇒ phân nghìn, còn lại là phần lẻ
 * ("10.50"); chỉ "," đúng nhóm nghìn kiểu Anh ("3,000") ⇒ phân nghìn, còn lại là phần lẻ ("2,5").
 */
export function parseInvoiceNumber(raw: InvoiceCell): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const t = String(raw ?? "").replace(/[\s ]/g, "").replace(/^\$|^USD/i, "");
  if (!/^[-+]?[\d.,]*\d[\d.,]*$/.test(t)) return null;
  const hasDot = t.includes(".");
  const hasComma = t.includes(",");
  let s: string;
  if (hasDot && hasComma) s = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (hasDot) s = /^[-+]?\d{1,3}(\.\d{3})+$/.test(t) || t.split(".").length > 2 ? t.replace(/\./g, "") : t;
  else if (hasComma) s = /^[-+]?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  else s = t;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------- Dựng hàng từ PDF ---------- */

/** Một mẩu chữ của PDF (pdf.js `getTextContent`): x, y góc dưới trái (đơn vị điểm), bề ngang. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height?: number;
}

/**
 * Gom mẩu chữ PDF thành hàng (cùng đường chữ, lệch ≤ 40% cỡ chữ) rồi thành ô (hai mẩu cách nhau
 * ≤ `gap` điểm ⇒ cùng một ô). Trang trước đứng trước (truyền `page`); trên xuống, trái sang phải.
 */
export function rowsFromTextItems(items: readonly (PdfTextItem & { page?: number })[], gap = 3): string[][] {
  const xs = items.filter((i) => i.str.trim()).map((i) => ({ ...i, page: i.page ?? 1, h: i.height && i.height > 0 ? i.height : 10 }));
  xs.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: (typeof xs)[] = [];
  for (const it of xs) {
    const last = rows[rows.length - 1];
    if (last && last[0].page === it.page && Math.abs(last[0].y - it.y) <= Math.max(2, last[0].h * 0.4)) last.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.x - b.x);
    const cells: { text: string; end: number }[] = [];
    for (const it of r) {
      const prev = cells[cells.length - 1];
      if (prev && it.x - prev.end <= gap) {
        prev.text += it.x - prev.end > 0.5 && !prev.text.endsWith(" ") && !it.str.startsWith(" ") ? ` ${it.str}` : it.str;
        prev.end = Math.max(prev.end, it.x + it.width);
      } else cells.push({ text: it.str, end: it.x + it.width });
    }
    return cells.map((c) => c.text.replace(/\s+/g, " ").trim()).filter(Boolean);
  });
}

/* ---------- Đọc bảng ---------- */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "September 25, 2026" · "25 Sep 2026" · "25/09/2026" ⇒ yyyy-mm-dd; không đọc được ⇒ "". */
export function parseInvoiceDate(text: string): string {
  const t = text.toLowerCase();
  const mon = (w: string) => MONTHS.findIndex((m) => m.startsWith(w.slice(0, 3)));
  let m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && mon(m[1]) >= 0) return `${m[3]}-${pad(mon(m[1]) + 1)}-${pad(Number(m[2]))}`;
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?,?[\s-]+(\d{4})\b/);
  if (m && mon(m[2]) >= 0) return `${m[3]}-${pad(mon(m[2]) + 1)}-${pad(Number(m[1]))}`;
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (m && Number(m[2]) <= 12) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** Excel lưu ngày là số ngày từ 1899-12-30. */
function excelSerialDate(n: number): string {
  if (n < 30000 || n > 80000) return "";
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const cellText = (c: InvoiceCell) => (c == null ? "" : String(c).replace(/\s+/g, " ").trim());
const isNumberCell = (c: InvoiceCell) => (typeof c === "number" ? Number.isFinite(c) : parseInvoiceNumber(c) != null);

/** Chữ của dòng tiêu đề cột / dòng ghi chú trong bảng — không phải tên hàng. */
const NOISE =
  /^(country of origin|origin|trade terms?|cfr|cif|cip|cpt|fob|exw|fca|usd(\/kgs?)?|us\.? dollars?|in us\.? dollars|kgs?|cartons?|ctns?|unit price|amount|net weight|gross weight|number of|packages?|quantity|qty|description|items?|no\.?|marks?)\b/i;

interface Row {
  texts: string[];
  /** Số đứng SAU ô chữ đầu tiên (số thứ tự hàng ở đầu dòng bị bỏ). */
  nums: number[];
  joined: string;
}

function toRow(cells: readonly InvoiceCell[]): Row {
  const texts: string[] = [];
  const nums: number[] = [];
  for (const c of cells) {
    const t = cellText(c);
    if (!t) continue;
    if (isNumberCell(c)) {
      if (texts.length) nums.push(parseInvoiceNumber(c) as number);
    } else texts.push(t);
  }
  return { texts, nums, joined: cells.map(cellText).filter(Boolean).join(" ") };
}

/** Gán số của một dòng: 4+ số = thùng · kg · đơn giá · tiền; 3 = thùng · kg · tiền; 2 = thùng · kg. */
function assign(nums: readonly number[]): Pick<InvoiceLine, "cartons" | "netKg" | "unitPrice" | "amount"> {
  if (nums.length >= 4) return { cartons: nums[0], netKg: nums[1], unitPrice: nums[nums.length - 2], amount: nums[nums.length - 1] };
  if (nums.length === 3) return { cartons: nums[0], netKg: nums[1], unitPrice: null, amount: nums[2] };
  return { cartons: nums[0] ?? null, netKg: nums[1] ?? null, unitPrice: null, amount: null };
}

const stripLabel = (t: string, label: RegExp) => t.replace(label, "").replace(/^[\s:.-]+/, "").trim();
const SIZE_LABEL = /^size\b\s*:?/i;
const PACKING_LABEL = /^pack(?:ing)?\b\s*:?/i;

function readHeader(rows: readonly Row[], rawRows: readonly (readonly InvoiceCell[])[], tableAt: number) {
  let invoiceNo = "";
  let issuedOn = "";
  let buyer = "";
  let currency = "";
  const head = rows.slice(0, tableAt + 1);
  for (let i = 0; i < head.length; i++) {
    const r = head[i];
    if (!invoiceNo) {
      const m = r.joined.match(/invoice\s*(?:no|number|#)\.?\s*[:#]?\s*([A-Z0-9][\w/.-]*)/i);
      if (m && /\d/.test(m[1])) invoiceNo = m[1];
    }
    if (!invoiceNo && /commercial\s+invoice/i.test(r.joined)) {
      const near = [...r.texts, ...(head[i + 1]?.texts ?? [])].find((t) => /^\d{1,6}\s*[/-]\s*\d{2,4}[A-Z]?$/i.test(t));
      if (near) invoiceNo = near.replace(/\s+/g, "");
    }
    if (!issuedOn && !/deliver|etd|eta|shipment|expir|on board/i.test(r.joined)) {
      issuedOn = parseInvoiceDate(r.joined);
      if (!issuedOn && /date/i.test(r.joined)) {
        const serial = rawRows[i]?.find((c) => typeof c === "number" && excelSerialDate(c));
        if (typeof serial === "number") issuedOn = excelSerialDate(serial);
      }
    }
    if (!buyer) {
      const idx = r.texts.findIndex((t) => /^(applicant|buyer|consignee|messrs|sold to|bill to)\b/i.test(t));
      if (idx >= 0) {
        const t = r.texts[idx];
        const after = stripLabel(t, /^(applicant|buyer|consignee|messrs|sold to|bill to)\.?/i);
        buyer = after || r.texts[idx + 1] || "";
      }
    }
  }
  // Tiền tệ: cả trang (tiêu đề cột "IN US. DOLLARS" có khi nằm dưới dòng DESCRIPTION, hoặc dòng "Says: … Dollars").
  for (const r of rows) {
    if (/\b(usd|us\.? dollars?|united states dollars?)\b/i.test(r.joined)) currency = "USD";
    else if (/\b(jpy|japanese yen)\b/i.test(r.joined)) currency = "JPY";
    else if (/\b(eur|euros?)\b/i.test(r.joined)) currency = "EUR";
    if (currency) break;
  }
  return { invoiceNo, issuedOn, buyer, currency };
}

/**
 * Đọc bảng của một Commercial Invoice (NV17 · R27). `rows` = từng hàng, mỗi hàng là các ô (Excel)
 * hoặc các cụm chữ (PDF qua `rowsFromTextItems`). Không ghi gì — chỉ trả kết quả để người dùng soát.
 */
export function parseInvoiceRows(rawRows: readonly (readonly InvoiceCell[])[]): InvoiceReadResult {
  const rows = rawRows.map(toRow);
  const tableAt = rows.findIndex((r) => /description/i.test(r.joined));
  if (tableAt < 0) return { ok: false, reason: "no-table", message: INVOICE_FAILURE_MESSAGES["no-table"] };
  const header = readHeader(rows, rawRows, tableAt);
  const lines: InvoiceLine[] = [];
  const warnings: string[] = [];
  let totals: InvoiceTotals | null = null;
  let heading: { text: string; nums: number[]; start: number } | null = null;
  let pendingSize = "";
  let packFrom = 0;

  const closeHeading = () => {
    if (heading && lines.length === heading.start && heading.nums.length >= 2) {
      lines.push({ description: heading.text, size: pendingSize, packing: "", ...assign(heading.nums) });
    }
    pendingSize = "";
  };

  for (let i = tableAt + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.texts.length && !r.nums.length) continue;
    const first = r.texts[0] ?? "";
    if (/^sub-?\s*total\b/i.test(first)) continue;
    if (/^(grand\s+)?total\b/i.test(first)) {
      const n = r.nums;
      totals = { cartons: n[0] ?? null, netKg: n.length >= 2 ? n[1] : null, amount: n.length >= 3 ? n[n.length - 1] : null };
      break;
    }
    if (/^(says?|say:|amount in words|total amount in words)\b/i.test(first)) break;
    if (SIZE_LABEL.test(first)) {
      const size = stripLabel(r.texts.join(" "), SIZE_LABEL);
      if (!heading) continue;
      if (r.nums.length >= 2) {
        lines.push({ description: heading.text, size, packing: "", ...assign(r.nums) });
        pendingSize = "";
      } else pendingSize = size;
      continue;
    }
    if (PACKING_LABEL.test(first)) {
      const packing = stripLabel(r.texts.join(" "), PACKING_LABEL);
      if (!heading) continue;
      if (r.nums.length >= 2) {
        lines.push({ description: heading.text, size: pendingSize, packing, ...assign(r.nums) });
        pendingSize = "";
      } else {
        for (let k = Math.max(packFrom, heading.start); k < lines.length; k++) if (!lines[k].packing) lines[k].packing = packing;
      }
      packFrom = lines.length;
      continue;
    }
    if (r.texts.every((t) => NOISE.test(t))) continue;
    // Dòng tên hàng (nhóm mới).
    closeHeading();
    heading = { text: r.texts.join(" "), nums: r.nums, start: lines.length };
    packFrom = lines.length;
  }
  closeHeading();

  if (!lines.length) return { ok: false, reason: "no-table", message: INVOICE_FAILURE_MESSAGES["no-table"] };

  const sum = sumInvoiceLines(lines);
  if (!totals) {
    warnings.push("Không thấy dòng TOTAL — tổng lấy bằng cộng các dòng hàng.");
    totals = sum;
  } else {
    const off = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) > 0.005;
    if (off(totals.cartons, sum.cartons)) warnings.push(`Dòng TOTAL ghi ${totals.cartons} thùng, cộng các dòng ra ${sum.cartons} thùng.`);
    if (off(totals.netKg, sum.netKg)) warnings.push(`Dòng TOTAL ghi ${totals.netKg} kg, cộng các dòng ra ${sum.netKg} kg.`);
    if (off(totals.amount, sum.amount)) warnings.push(`Dòng TOTAL ghi ${totals.amount} tiền, cộng các dòng ra ${sum.amount}.`);
  }
  if (!header.invoiceNo) warnings.push("Không đọc được số invoice.");
  return { ok: true, invoice: { ...header, lines, totals }, warnings };
}

/** Cộng các dòng (làm tròn 2 số lẻ để khỏi vệt số thực). */
export function sumInvoiceLines(lines: readonly Pick<InvoiceLine, "cartons" | "netKg" | "amount">[]): InvoiceTotals {
  const add = (k: "cartons" | "netKg" | "amount") => {
    const xs = lines.map((l) => l[k]).filter((v): v is number => v != null);
    return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) * 100) / 100 : null;
  };
  return { cartons: add("cartons"), netKg: add("netKg"), amount: add("amount") };
}

/* ---------- Nối dòng invoice ↔ hợp đồng ↔ mặt hàng ---------- */

/** So size: không phân hoa thường, bỏ chữ "size:", bỏ mọi khoảng trắng ("2-3 GR/PC" = "2-3gr/pc"). */
export const sizeKey = (v: string | undefined | null) => nameKey(v).replace(SIZE_LABEL, "").replace(/\s+/g, "");

export type InvoiceMatchSource = "contract" | "customer-name" | "trade-name" | "";

export interface InvoiceLineMatch {
  productId: string;
  source: InvoiceMatchSource;
  /** Dòng hàng của hợp đồng khớp tên (+ size) — để so đơn giá; rỗng nếu không có trong HĐ. */
  contractLineId: string;
}

/**
 * Nối một dòng invoice với mặt hàng (R27), lấy bậc đầu ra ĐÚNG MỘT mặt hàng: (1) dòng HĐ cùng tên +
 * size (dòng HĐ không ghi size thì cùng tên) · (2) tên của khách khớp tên + size — invoice không ghi
 * size mới nhận khớp tên (R23) · (3) tên tiếng Anh mặc định. Không đoán theo lịch sử tên-không-size
 * (hai size cùng tên dễ nối nhầm).
 */
export function matchInvoiceLine(
  line: Pick<InvoiceLine, "description" | "size">,
  contractLines: readonly Pick<ExportContractLine, "id" | "description" | "size" | "productId">[],
  customerId: string,
  names: readonly Pick<CustomerProductName, "customerId" | "productId" | "tradeName" | "sizeText">[],
  products: readonly Pick<Product, "id" | "tradeName">[],
): InvoiceLineMatch {
  const key = nameKey(line.description);
  const sk = sizeKey(line.size);
  const sameName = contractLines.filter((l) => nameKey(l.description) === key);
  const sameSize = sameName.filter((l) => sizeKey(l.size) === sk);
  // Dòng HĐ không ghi size (VD "Frozen tako tip raw") khớp theo tên; dòng HĐ có size khác thì KHÔNG khớp.
  const sizeless = sameName.filter((l) => !sizeKey(l.size));
  const contractLine = sameSize[0] ?? (sizeless.length === 1 ? sizeless[0] : undefined);
  const ids = (xs: readonly { productId?: string }[]) => [...new Set(xs.map((l) => l.productId).filter((v): v is string => !!v))];
  const fromContract = ids(sameSize.length ? sameSize : sizeless);
  if (fromContract.length === 1) return { productId: fromContract[0], source: "contract", contractLineId: contractLine?.id ?? "" };
  const byCustomer = productsByCustomerName(names, customerId, line.description, line.size);
  // Invoice có size ⇒ chỉ nhận tên của khách khớp CẢ size (khớp tên không size dễ nối nhầm size khác).
  if (byCustomer.productIds.length === 1 && (byCustomer.tier === 1 || !sk)) {
    return { productId: byCustomer.productIds[0], source: "customer-name", contractLineId: contractLine?.id ?? "" };
  }
  const byTrade = productsByTradeName(line.description, products);
  if (byTrade.length === 1) return { productId: byTrade[0].id, source: "trade-name", contractLineId: contractLine?.id ?? "" };
  return { productId: "", source: "", contractLineId: contractLine?.id ?? "" };
}

export interface InvoiceLineIssue {
  lineIndex: number;
  kind: "not-in-contract" | "price-differs";
  message: string;
}

/** Dòng invoice lệch hợp đồng (R27): không có trong HĐ (tên + size), hoặc đơn giá khác HĐ. */
export function compareInvoiceToContract(
  lines: readonly InvoiceLine[],
  matches: readonly InvoiceLineMatch[],
  contractLines: readonly Pick<ExportContractLine, "id" | "unitPrice">[],
): InvoiceLineIssue[] {
  const out: InvoiceLineIssue[] = [];
  lines.forEach((l, i) => {
    const cl = contractLines.find((c) => c.id === matches[i]?.contractLineId);
    const label = [l.description, l.size].filter(Boolean).join(" · ");
    if (!cl) out.push({ lineIndex: i, kind: "not-in-contract", message: `${label}: không có dòng cùng tên + size trong hợp đồng` });
    else if (l.unitPrice != null && cl.unitPrice != null && Math.abs(l.unitPrice - cl.unitPrice) > 0.005) {
      out.push({ lineIndex: i, kind: "price-differs", message: `${label}: đơn giá invoice ${l.unitPrice}, hợp đồng ${cl.unitPrice}` });
    }
  });
  return out;
}

export type InvoiceTotalField = "number" | "issuedOn" | "cartons" | "netKg" | "amount";

export interface InvoiceFill {
  /** Mục sau khi điền các ô đang TRỐNG theo invoice. */
  item: ExportStepItem;
  filled: InvoiceTotalField[];
  /** Ô đã có số / chữ KHÁC invoice — không ghi đè, hỏi người dùng (R27). */
  conflicts: { field: InvoiceTotalField; current: string | number; invoice: string | number }[];
}

/** Điền số invoice, ngày, 3 số tổng vào mục Commercial Invoice: ô trống thì điền, ô khác thì báo. */
export function fillInvoiceItem(item: ExportStepItem, inv: CommercialInvoice): InvoiceFill {
  const next: ExportStepItem = { ...item };
  const filled: InvoiceTotalField[] = [];
  const conflicts: InvoiceFill["conflicts"] = [];
  const text = (field: "number" | "issuedOn", v: string) => {
    if (!v) return;
    const cur = next[field].trim();
    if (!cur) {
      next[field] = v;
      filled.push(field);
    } else if (nameKey(cur).replace(/\s+/g, "") !== nameKey(v).replace(/\s+/g, "")) conflicts.push({ field, current: cur, invoice: v });
  };
  const num = (field: "cartons" | "netKg" | "amount", v: number | null) => {
    if (v == null) return;
    const cur = next[field];
    if (cur == null) {
      next[field] = v;
      filled.push(field);
    } else if (Math.abs(cur - v) > 0.005) conflicts.push({ field, current: cur, invoice: v });
  };
  text("number", inv.invoiceNo);
  text("issuedOn", inv.issuedOn);
  num("cartons", inv.totals.cartons);
  num("netKg", inv.totals.netKg);
  num("amount", inv.totals.amount);
  return { item: next, filled, conflicts };
}

/** Dòng invoice đã có mặt hàng ⇒ dạng dòng hàng cho `extractCustomerNames` (mã HS: invoice không in). */
export function invoiceNameLines(
  lines: readonly InvoiceLine[],
  productIds: readonly string[],
): Pick<ExportContractLine, "productId" | "description" | "size" | "packing" | "hsCode">[] {
  return lines.map((l, i) => ({ productId: productIds[i] || undefined, description: l.description, size: l.size, packing: l.packing, hsCode: "" }));
}

/** Đuôi file đọc được (R27): Excel gốc hoặc PDF. Ảnh / Word / zip không đọc. */
export const isReadableInvoiceFile = (name: string) => /\.(xlsx|xls|pdf)$/i.test(name);

/** Nối mọi dòng invoice ⇒ mặt hàng (thứ tự như `invoice.lines`; "" = chưa nối). */
export function matchInvoiceLines(
  invoice: Pick<CommercialInvoice, "lines">,
  contractLines: Parameters<typeof matchInvoiceLine>[1],
  customerId: string,
  names: Parameters<typeof matchInvoiceLine>[3],
  products: Parameters<typeof matchInvoiceLine>[4],
): InvoiceLineMatch[] {
  return invoice.lines.map((l) => matchInvoiceLine(l, contractLines, customerId, names, products));
}

export interface CustomerInvoiceFile {
  contractId: string;
  contractNo: string;
  file: ExportFile;
  /** Dòng hàng của bản đang dùng của HĐ — để nối dòng invoice. */
  contractLines: ExportContractLine[];
}

/**
 * File Commercial Invoice ĐỌC ĐƯỢC (Excel / PDF) của mọi HĐ chưa hủy của khách — nguồn thứ hai của
 * "Trích xuất từ chứng từ" (NV16 (b) · R27). HĐ ký trước đứng trước; trong HĐ file đính trước đứng trước.
 */
export function invoiceFilesOfCustomer(
  d: Pick<ExportData, "contracts" | "revisions" | "approvals" | "items" | "files">,
  customerId: string,
): CustomerInvoiceFile[] {
  const invoiceItems = new Set(d.items.filter((i) => i.docKind === "commercial-invoice").map((i) => i.id));
  const contracts = d.contracts
    .filter((c) => c.customerId === customerId && c.status !== "cancelled")
    .sort((a, b) => (a.signedOn || a.createdAt).localeCompare(b.signedOn || b.createdAt) || a.contractNo.localeCompare(b.contractNo));
  return contracts.flatMap((c) => {
    const lines = workingRevision(d, c.id)?.lines ?? [];
    return d.files
      .filter((f) => f.contractId === c.id && invoiceItems.has(f.stepItemId) && isReadableInvoiceFile(f.fileName))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((file) => ({ contractId: c.id, contractNo: c.contractNo, file, contractLines: lines }));
  });
}
