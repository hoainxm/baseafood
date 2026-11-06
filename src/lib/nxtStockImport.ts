/**
 * Nạp báo cáo XUẤT–NHẬP–TỒN của phần mềm kế toán (PDF in ra hoặc Excel cùng mẫu) vào SỔ KHO THÁNG.
 *
 * Báo cáo theo MÃ HÀNG kế toán ("PXĐ.BTNL.TĐ 1001"); sổ đặt tên lô theo cách gọi của kho. Ghép một lần
 * bằng `accountingCode` trên dòng sổ (mig 0107), dồn kỳ mang theo ⇒ các tháng sau tự khớp.
 *
 * Ba bước, đều là hàm thuần (màn hình chỉ hiển thị + giữ lựa chọn của người dùng):
 *   1. Đọc: `parseNxtPdfItems` (chữ + toạ độ từ pdfjs) · `reportFromNxtExcel` (bộ đọc Excel sẵn có).
 *   2. Kiểm + đối chiếu: `checkNxtReport` (lỗi của chính file) · `buildNxtPlan` (từng mã ↔ dòng sổ).
 *   3. Ghi: `applyNxtPlan` — đặt nhập/xuất theo file (THAY, không cộng ⇒ nạp lại cùng file không đổi gì).
 *
 * Mọi chỗ lệch phải có lựa chọn của người dùng trước khi ghi (`listNxtBlockers`) — không tự quyết thay.
 * Đặc tả: docs/app-map/36-so-kho-thang.md § Nạp báo cáo XNT.
 */
import type { MonthlyStockLine } from "@/types";
import { BSF1_WAREHOUSES } from "@/types";
import { carryForwardIntoLedger, getPrevMonth } from "./monthlyStock";
import type { NxtExcelReportData } from "./nxtExcel";

const EPS = 0.001;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

/* ======================= 1. Đọc file ======================= */

export interface NxtReportRow {
  code: string;
  name: string;
  openKg: number;
  inKg: number;
  outKg: number;
  /** Tồn cuối IN TRÊN FILE (sổ tự suy, cột này chỉ để kiểm file có cân không). */
  closeKg: number;
}

export interface NxtReport {
  source: "pdf" | "xlsx";
  createdText: string;
  /** yyyy-mm-dd */
  dateFrom: string;
  dateTo: string;
  /** "KHO TP - KHO 1000" — đúng như in. */
  warehouseText: string;
  rows: NxtReportRow[];
  /** Dòng "SL mặt hàng: n" + tổng in ở cuối bảng (chỉ PDF có) — để kiểm đọc đủ, đọc đúng. */
  declared?: { count: number; openKg: number; inKg: number; outKg: number; closeKg: number };
}

/** Một mẩu chữ của trang PDF (pdfjs `getTextContent`): toạ độ góc trái dưới, trục y hướng LÊN. */
export interface PdfTextPiece {
  str: string;
  x: number;
  y: number;
  width: number;
  page: number;
}

const NUMBER_RE = /^-?\(?[\d.,]+\)?$/;

/** "229,812" → 229812 · "1,234.5" → 1234.5 · "(360)" → -360. Không phải số ⇒ null. */
export function parseReportNumber(s: string): number | null {
  const t = s.trim();
  if (!NUMBER_RE.test(t) || !/\d/.test(t)) return null;
  const negative = t.startsWith("-") || t.startsWith("(");
  const n = Number(t.replace(/[(),-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** dd/mm/yyyy … dd/mm/yyyy → [yyyy-mm-dd, yyyy-mm-dd]. */
export function parseReportDateRange(text: string): [string, string] | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return [`${m[3]}-${m[2]}-${m[1]}`, `${m[6]}-${m[5]}-${m[4]}`];
}

/** Nối các dòng của một ô: dòng trước tận cùng bằng "100-" (gạch dính chữ) ⇒ nối liền ("100-200"). */
export function joinCellLines(lines: string[]): string {
  let out = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) out = line;
    else if (/\S-$/.test(out)) out += line;
    else out += " " + line;
  }
  return out.replace(/\s+/g, " ").trim();
}

type ColumnKey = "code" | "name" | "openKg" | "openValue" | "inKg" | "inValue" | "outKg" | "outValue" | "closeKg" | "closeValue";

/** Nhận cột theo chữ tiêu đề (bỏ dấu, viết thường). */
function columnOfHeader(text: string): ColumnKey | null {
  const k = text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();
  const map: Record<string, ColumnKey> = {
    "ma hang": "code",
    "ten hang": "name",
    "ton dau ky": "openKg",
    "gia tri dau ky": "openValue",
    "sl nhap": "inKg",
    "gia tri nhap": "inValue",
    "sl xuat": "outKg",
    "gia tri xuat": "outValue",
    "ton cuoi ky": "closeKg",
    "gia tri cuoi ky": "closeValue",
  };
  return map[k] ?? null;
}

interface Line {
  y: number;
  pieces: PdfTextPiece[];
}

/** Gom mẩu chữ cùng hàng (lệch y ≤ 1.5) — trên xuống dưới, trái sang phải. */
function groupLines(pieces: PdfTextPiece[]): Line[] {
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const p of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - p.y) <= 1.5) last.pieces.push(p);
    else lines.push({ y: p.y, pieces: [p] });
  }
  for (const l of lines) l.pieces.sort((a, b) => a.x - b.x);
  return lines;
}

const lineText = (l: Line) => l.pieces.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();

/** Cụm chữ trên một hàng, tách khi khoảng trống > `gap` (tiêu đề cột "Tồn đầu kỳ" = 3 mẩu). */
function phrases(l: Line, gap = 8): { text: string; left: number; right: number }[] {
  const out: { text: string; left: number; right: number }[] = [];
  for (const p of l.pieces) {
    const last = out[out.length - 1];
    if (last && p.x - last.right <= gap) {
      last.text += " " + p.str;
      last.right = p.x + p.width;
    } else out.push({ text: p.str, left: p.x, right: p.x + p.width });
  }
  return out;
}

/**
 * Đọc báo cáo XNT từ chữ PDF. Mẫu "Báo cáo xuất nhập tồn" (phần mềm kế toán xí nghiệp): mỗi trang
 * lặp tiêu đề cột + dòng "SL mặt hàng"; số canh phải theo cột; tên hàng (và đôi khi mã) xuống nhiều
 * dòng, canh giữa theo dòng số ⇒ gom chữ cột mã / tên thành KHỐI (khoảng cách dòng) rồi gán khối cho
 * dòng số gần tâm khối nhất.
 * Lỗi mẫu (không thấy tiêu đề cột, không có dòng nào) ⇒ ném Error có lời giải thích.
 */
export function parseNxtPdfItems(pieces: PdfTextPiece[]): NxtReport {
  const pages = [...new Set(pieces.map((p) => p.page))].sort((a, b) => a - b);
  let createdText = "";
  let rangeText = "";
  let warehouseText = "";
  let declared: NxtReport["declared"];
  const rows: NxtReportRow[] = [];

  for (const page of pages) {
    const lines = groupLines(pieces.filter((p) => p.page === page && p.str.trim()));
    const headerIdx = lines.findIndex((l) => phrases(l).filter((ph) => columnOfHeader(ph.text)).length >= 6);
    if (headerIdx < 0) continue;
    // Phần đầu trang (trên tiêu đề cột): ngày lập · khoảng ngày · chi nhánh — lấy ở trang đầu có.
    for (const l of lines.slice(0, headerIdx)) {
      const t = lineText(l);
      if (!createdText && /^Ngày lập/i.test(t)) createdText = t;
      else if (!rangeText && /^Từ ngày/i.test(t)) rangeText = t;
      else if (!warehouseText && /^Chi nhánh/i.test(t)) warehouseText = t.replace(/^Chi nhánh\s*:\s*/i, "").trim();
    }
    const header = lines[headerIdx];
    const cols = phrases(header)
      .map((ph) => ({ key: columnOfHeader(ph.text), left: ph.left, right: ph.right }))
      .filter((c): c is { key: ColumnKey; left: number; right: number } => c.key != null);
    const nameCol = cols.find((c) => c.key === "name");
    const numberCols = cols.filter((c) => c.key !== "code" && c.key !== "name");
    if (!nameCol || numberCols.length < 4) throw new Error("Không nhận ra các cột của báo cáo (thiếu cột Tên hàng / cột số).");
    const firstNumberLeft = Math.min(...numberCols.map((c) => c.left)) - 15;
    /** Số canh phải ⇒ gán cột theo mép phải gần nhất. */
    const numberColumnOf = (p: PdfTextPiece): ColumnKey | null => {
      const right = p.x + p.width;
      let best: { key: ColumnKey; d: number } | null = null;
      for (const c of numberCols) {
        const d = Math.abs(c.right - right);
        if (!best || d < best.d) best = { key: c.key, d };
      }
      return best && best.d <= 25 ? best.key : null;
    };
    // Chân trang: "Trang:x/y" + địa chỉ kho — mọi thứ thấp hơn đều bỏ.
    const footerY = Math.max(...lines.filter((l) => /Trang\s*:/i.test(lineText(l))).map((l) => l.y), -Infinity);
    const body = lines.slice(headerIdx + 1).filter((l) => l.y > footerY + 2);

    type Anchor = { y: number; nums: Partial<Record<ColumnKey, number>>; codeLines: { y: number; text: string }[]; nameLines: { y: number; text: string }[] };
    const anchors: Anchor[] = [];
    const textPieces: { y: number; piece: PdfTextPiece; col: "code" | "name" }[] = [];
    for (const l of body) {
      const nums: Partial<Record<ColumnKey, number>> = {};
      let numCount = 0;
      for (const p of l.pieces) {
        if (p.x < firstNumberLeft) continue;
        const n = parseReportNumber(p.str);
        const key = n == null ? null : numberColumnOf(p);
        if (key && n != null) {
          nums[key] = n;
          numCount++;
        }
      }
      const t = lineText(l);
      if (/^SL mặt hàng/i.test(t)) {
        if (!declared) {
          const count = Number(t.match(/SL mặt hàng\s*:\s*(\d+)/i)?.[1] ?? NaN);
          declared = { count, openKg: nums.openKg ?? 0, inKg: nums.inKg ?? 0, outKg: nums.outKg ?? 0, closeKg: nums.closeKg ?? 0 };
        }
        continue;
      }
      if (numCount >= 4) anchors.push({ y: l.y, nums, codeLines: [], nameLines: [] });
      for (const p of l.pieces) {
        if (p.x >= firstNumberLeft) continue;
        textPieces.push({ y: l.y, piece: p, col: p.x < nameCol.left - 4 ? "code" : "name" });
      }
    }
    if (!anchors.length) continue;

    // Gom chữ mỗi cột thành khối theo khoảng cách dòng, rồi gán khối cho dòng số gần tâm nhất.
    for (const col of ["code", "name"] as const) {
      const byLine = new Map<number, PdfTextPiece[]>();
      for (const t of textPieces.filter((t) => t.col === col)) {
        const arr = byLine.get(t.y) ?? [];
        arr.push(t.piece);
        byLine.set(t.y, arr);
      }
      const ys = [...byLine.keys()].sort((a, b) => b - a);
      const blocks: number[][] = [];
      for (const y of ys) {
        const last = blocks[blocks.length - 1];
        // Trong một ô dòng cách nhau ~10pt; giữa hai ô ≥ 16pt. Khối không được trùm qua hai dòng số.
        const crossesAnchor = last && anchors.some((a) => a.y < last[last.length - 1] - 1 && a.y > y + 1 && last.some((ly) => Math.abs(ly - a.y) < 1.5));
        if (last && last[last.length - 1] - y <= 13 && !crossesAnchor) last.push(y);
        else blocks.push([y]);
      }
      for (const block of blocks) {
        const center = (block[0] + block[block.length - 1]) / 2;
        let best = anchors[0];
        for (const a of anchors) if (Math.abs(a.y - center) < Math.abs(best.y - center)) best = a;
        for (const y of block) {
          const text = (byLine.get(y) ?? []).sort((a, b) => a.x - b.x).map((p) => p.str).join(" ");
          (col === "code" ? best.codeLines : best.nameLines).push({ y, text });
        }
      }
    }

    for (const a of anchors) {
      const ordered = (xs: { y: number; text: string }[]) => xs.sort((p, q) => q.y - p.y).map((x) => x.text);
      const code = joinCellLines(ordered(a.codeLines)).replace(/-\s+/g, "-");
      const name = joinCellLines(ordered(a.nameLines));
      if (!code && !name) continue;
      rows.push({
        code,
        name,
        openKg: a.nums.openKg ?? 0,
        inKg: a.nums.inKg ?? 0,
        outKg: a.nums.outKg ?? 0,
        closeKg: a.nums.closeKg ?? (a.nums.openKg ?? 0) + (a.nums.inKg ?? 0) - (a.nums.outKg ?? 0),
      });
    }
  }

  if (!rows.length) throw new Error("Không đọc được dòng hàng nào — file không phải mẫu \"Báo cáo xuất nhập tồn\", hoặc PDF là ảnh chụp (scan).");
  const range = parseReportDateRange(rangeText);
  return {
    source: "pdf",
    createdText,
    dateFrom: range?.[0] ?? "",
    dateTo: range?.[1] ?? "",
    warehouseText,
    rows,
    declared,
  };
}

/** Excel cùng mẫu (đọc bằng `parseNxtExcelFile` sẵn có) → cùng dạng báo cáo. */
export function reportFromNxtExcel(data: NxtExcelReportData): NxtReport {
  const range = parseReportDateRange(data.dateRangeText);
  return {
    source: "xlsx",
    createdText: data.createdDateText,
    dateFrom: range?.[0] ?? "",
    dateTo: range?.[1] ?? "",
    warehouseText: data.warehouseText.replace(/^\s*Chi nh[aá]nh\s*:\s*/i, "").trim(),
    rows: data.items.map((it) => ({ code: it.code, name: it.name, openKg: it.openingKg, inKg: it.inKg, outKg: it.outKg, closeKg: it.closingKg })),
  };
}

/* ======================= 2. Kiểm file ======================= */

export interface NxtReportIssue {
  level: "error" | "warning";
  text: string;
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Khoảng ngày của file đúng TRỌN một tháng dương lịch ⇒ 'YYYY-MM'; không ⇒ null. */
export function monthOfReport(r: Pick<NxtReport, "dateFrom" | "dateTo">): string | null {
  const a = r.dateFrom.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const b = r.dateTo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!a || !b) return null;
  if (a[1] !== b[1] || a[2] !== b[2] || a[3] !== "01") return null;
  if (Number(b[3]) !== lastDayOfMonth(Number(b[1]), Number(b[2]))) return null;
  return `${a[1]}-${a[2]}`;
}

/** "KHO TP - KHO 1000" → "Kho 1000 tấn" (theo số kho trong 5 kho hệ thống). Không đoán được ⇒ "". */
export function warehouseOfReport(text: string): string {
  const nums = [...text.matchAll(/\bKHO\s+(\d{3,5})\b/gi)].map((m) => m[1]);
  for (const n of nums.reverse()) {
    const w = BSF1_WAREHOUSES.find((x) => x.code.includes(n) || x.name.includes(n));
    if (w) return w.name;
  }
  return "";
}

const sumRows = (rows: NxtReportRow[]) =>
  rows.reduce((s, r) => ({ openKg: s.openKg + r.openKg, inKg: s.inKg + r.inKg, outKg: s.outKg + r.outKg, closeKg: s.closeKg + r.closeKg }), {
    openKg: 0,
    inKg: 0,
    outKg: 0,
    closeKg: 0,
  });

/** Lỗi của CHÍNH file (trước khi so với sổ). error ⇒ không cho nạp. */
export function checkNxtReport(r: NxtReport): NxtReportIssue[] {
  const issues: NxtReportIssue[] = [];
  if (!monthOfReport(r)) {
    issues.push({
      level: "error",
      text: r.dateFrom
        ? `Khoảng ngày của file (${r.dateFrom} → ${r.dateTo}) không phải trọn một tháng — sổ kho ghi theo tháng, chỉ nạp được báo cáo từ ngày 01 tới ngày cuối tháng.`
        : "Không đọc được khoảng ngày (dòng \"Từ ngày … đến ngày …\").",
    });
  }
  const counts = new Map<string, number>();
  for (const row of r.rows) counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
  const dupes = [...counts].filter(([c, n]) => c && n > 1).map(([c]) => c);
  if (dupes.length) issues.push({ level: "error", text: `Mã hàng lặp trong file: ${dupes.join(", ")} — không biết lấy dòng nào.` });
  const noCode = r.rows.filter((x) => !x.code).length;
  if (noCode) issues.push({ level: "error", text: `${noCode} dòng không đọc được mã hàng.` });
  if (r.declared) {
    const t = sumRows(r.rows);
    const d = r.declared;
    if (Number.isFinite(d.count) && d.count !== r.rows.length)
      issues.push({ level: "error", text: `File ghi "SL mặt hàng: ${d.count}" nhưng đọc được ${r.rows.length} dòng — đọc thiếu hoặc thừa, không nạp.` });
    const diffs = (["openKg", "inKg", "outKg", "closeKg"] as const).filter((k) => !near(t[k], d[k]));
    if (diffs.length)
      issues.push({ level: "error", text: `Tổng đọc được khác dòng tổng in trên file (${diffs.map((k) => COLUMN_LABEL[k]).join(", ")}) — đọc sai số, không nạp.` });
  }
  return issues;
}

export const COLUMN_LABEL = { openKg: "tồn đầu", inKg: "nhập", outKg: "xuất", closeKg: "tồn cuối" } as const;

/* ======================= 3. Đối chiếu với sổ ======================= */

/** Ô chọn dòng sổ cho một mã: id dòng, hoặc thêm dòng mới / bỏ mã. */
export const MAP_NEW = "__new__";
export const MAP_SKIP = "__skip__";

export type NxtStatus =
  | "match" // tồn đầu khớp — chỉ điền nhập/xuất
  | "new" // file tồn đầu 0, sổ chưa có ⇒ thêm dòng
  | "opening-diff" // tồn đầu file ≠ sổ — PHẢI chọn
  | "missing" // file có tồn đầu, sổ không có dòng — PHẢI chọn
  | "unbalanced" // dòng file tự không cân (đầu + nhập − xuất ≠ cuối) — PHẢI chọn
  | "skipped";

export type NxtChoice = "file" | "ledger" | "skip";

export interface NxtDecision {
  /** Dòng sổ ghép với mã (id dòng · MAP_NEW · MAP_SKIP). Bỏ trống = theo gợi ý / mã đã lưu. */
  target?: string;
  choice?: NxtChoice;
  /** Tên dòng mới (mặc định: tên trên file đã gọn). */
  newName?: string;
}

export interface NxtPlanItem {
  code: string;
  fileName: string;
  file: NxtReportRow;
  /** Cách ghép: mã đã lưu · ghi chú "mã KT" cũ · gợi ý theo số · không có. */
  mapSource: "code" | "note" | "suggest" | "user" | "none";
  /** Dòng sổ (tháng đích, kho đích) mang mã này. */
  rowIds: string[];
  ledgerOpenKg: number;
  status: NxtStatus;
  /** Lựa chọn đang áp (mặc định: chưa chọn ⇒ chặn nạp nếu trạng thái cần chọn). */
  choice?: NxtChoice;
  /** Nhập/xuất đang có trên sổ khác số sẽ ghi ⇒ GHI ĐÈ (cảnh báo). */
  overwrite: { inKg: number; outKg: number } | null;
  /** Kg xuất trên các dòng này do Cân đối ghi (vết ⟦CĐ:…⟧) — file có thể đã tính ⇒ cảnh báo. */
  balancingOutKg: number;
  /** Tồn cuối trên sổ sau khi ghi (theo lựa chọn hiện tại). */
  resultCloseKg: number;
  /** Lời giải thích chỗ lệch, hiện ngay dưới dòng. */
  warnings: string[];
}

export interface NxtPlan {
  month: string;
  warehouse: string;
  /** Tháng chưa mở ở kho này ⇒ sẽ kế thừa tồn cuối tháng trước trước khi nạp. */
  opensMonth: boolean;
  /** Sổ sau bước mở tháng (nếu có) — nền để ghi. */
  baseLines: MonthlyStockLine[];
  items: NxtPlanItem[];
  /** Dòng sổ mang mã mà file không có. */
  ledgerOnly: { rowId: string; code: string; itemName: string; closeKg: number }[];
  /** Dòng sổ của tháng/kho chưa ghép mã nào — để chọn tay. */
  candidates: { id: string; label: string; openKg: number }[];
}

const normalizeCode = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
const NOTE_CODE_RE = /mã\s*KT\s*:\s*([^\n—;]+)/i;
const BALANCING_TRACE_RE = /⟦CĐ:[^:⟧]+:(-?[\d.]+)⟧/g;

/** Mã kế toán ghi trong ghi chú kiểu cũ ("… mã KT: PXĐ.BTNL.TĐ 015") — lần nạp tay T10/2026. */
export function codeFromNote(note: string): string {
  const m = (note ?? "").match(NOTE_CODE_RE);
  return m ? normalizeCode(m[1]) : "";
}

/** Tên trên file cho gọn làm tên dòng mới: bỏ "(KG)", viết hoa chữ đầu. */
export function tidyItemName(name: string): string {
  const t = name.replace(/\(\s*kg\s*\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

const lineLabel = (l: MonthlyStockLine) => [l.itemName, l.size, l.origin].filter(Boolean).join(" · ");
const isAdjustmentRow = (id: string) => id.startsWith("nxt-adj|") || id.includes("adj|");

const warehouseCode = (warehouse: string) => BSF1_WAREHOUSES.find((w) => w.name === warehouse)?.code ?? warehouse.replace(/\s+/g, "-");
export const newRowId = (warehouse: string, month: string, code: string) => `nxt|${warehouseCode(warehouse)}|${month}|${code}`;
export const adjustmentRowId = (warehouse: string, month: string, code: string) => `nxt-adj|${warehouseCode(warehouse)}|${month}|${code}`;

/** Kg xuất do Cân đối ghi (cộng các vết ⟦CĐ:id:kg⟧ trong ghi chú). */
export function balancingOutOf(note: string): number {
  let s = 0;
  for (const m of (note ?? "").matchAll(BALANCING_TRACE_RE)) s += Number(m[1]) || 0;
  return s;
}

/**
 * Chia nhập / xuất của một mã cho các dòng sổ mang mã đó: nhập vào dòng chính (dòng đầu không phải
 * điều chỉnh); xuất trừ lần lượt theo tồn có của từng dòng (dòng chính trước), phần dư dồn dòng chính.
 */
function distribute(rows: MonthlyStockLine[], inKg: number, outKg: number): Map<string, { inKg: number; outKg: number }> {
  const ordered = [...rows].sort((a, b) => Number(isAdjustmentRow(a.id)) - Number(isAdjustmentRow(b.id)) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const result = new Map(ordered.map((r) => [r.id, { inKg: 0, outKg: 0 }]));
  if (!ordered.length) return result;
  result.get(ordered[0].id)!.inKg = inKg;
  let left = outKg;
  for (const r of ordered) {
    if (left <= EPS) break;
    const available = r.openKg + result.get(r.id)!.inKg;
    const take = Math.max(0, Math.min(available, left));
    result.get(r.id)!.outKg += take;
    left -= take;
  }
  if (left > EPS) result.get(ordered[0].id)!.outKg += left;
  return result;
}

export interface NxtPlanOptions {
  warehouse: string;
  month: string;
  decisions?: Record<string, NxtDecision>;
}

/** Đối chiếu từng mã của file với sổ (tháng + kho đích). Không ghi gì. */
export function buildNxtPlan(lines: MonthlyStockLine[], report: NxtReport, opts: NxtPlanOptions): NxtPlan {
  const { warehouse, month } = opts;
  const decisions = opts.decisions ?? {};
  const inScope = (l: MonthlyStockLine) => l.period === month && l.warehouse === warehouse;
  const prev = getPrevMonth(month);
  const opensMonth = !lines.some(inScope) && lines.some((l) => l.period === prev && l.warehouse === warehouse);
  const baseLines = opensMonth ? carryForwardIntoLedger(lines, month, warehouse).lines : lines;
  const scope = baseLines.filter(inScope);

  const codeOfLine = (l: MonthlyStockLine) => normalizeCode(l.accountingCode || "") || codeFromNote(l.note);
  const fileCodes = new Set(report.rows.map((r) => normalizeCode(r.code)));

  // Ghép tay của người dùng giữ chỗ trước — dòng đã bị chọn cho mã A thì không gợi ý cho mã B.
  const claimedByUser = new Map<string, string>();
  for (const [code, d] of Object.entries(decisions)) if (d.target && d.target !== MAP_NEW && d.target !== MAP_SKIP) claimedByUser.set(d.target, normalizeCode(code));
  const claimed = new Set<string>(claimedByUser.keys());
  for (const l of scope) if (codeOfLine(l) && fileCodes.has(codeOfLine(l))) claimed.add(l.id);

  const items: NxtPlanItem[] = [];
  for (const file of report.rows) {
    const code = normalizeCode(file.code);
    const d = decisions[file.code] ?? decisions[code] ?? {};
    let mapSource: NxtPlanItem["mapSource"] = "none";
    let rows: MonthlyStockLine[] = [];
    /** Số dòng chưa ghép có tồn đầu trùng đúng số file (> 1 ⇒ không đoán). */
    let sameCount = 0;

    if (d.target === MAP_SKIP) {
      // bỏ mã
    } else if (d.target && d.target !== MAP_NEW) {
      const picked = scope.find((l) => l.id === d.target);
      if (picked) {
        rows = [picked, ...scope.filter((l) => l.id !== picked.id && codeOfLine(l) === code && claimedByUser.get(l.id) == null)];
        mapSource = "user";
      }
    } else if (d.target !== MAP_NEW) {
      const byCode = scope.filter((l) => normalizeCode(l.accountingCode || "") === code);
      const byNote = byCode.length ? [] : scope.filter((l) => codeFromNote(l.note) === code);
      // Dòng đã bị ghép tay cho mã khác thì thôi.
      const owned = (xs: MonthlyStockLine[]) => xs.filter((l) => !claimedByUser.has(l.id) || claimedByUser.get(l.id) === code);
      if (owned(byCode).length) {
        rows = owned(byCode);
        mapSource = "code";
      } else if (owned(byNote).length) {
        rows = owned(byNote);
        mapSource = "note";
      } else if (file.openKg > EPS) {
        // Gợi ý: dòng chưa ghép có tồn đầu trùng đúng số (và duy nhất).
        const same = scope.filter((l) => !claimed.has(l.id) && near(l.openKg, file.openKg));
        sameCount = same.length;
        if (same.length === 1) {
          rows = same;
          mapSource = "suggest";
          claimed.add(same[0].id);
        }
      }
    }

    const ledgerOpenKg = rows.reduce((s, l) => s + l.openKg, 0);
    const unbalanced = !near(file.openKg + file.inKg - file.outKg, file.closeKg);
    let status: NxtStatus;
    if (d.target === MAP_SKIP) status = "skipped";
    else if (unbalanced) status = "unbalanced";
    else if (!rows.length) status = file.openKg > EPS ? "missing" : "new";
    else status = near(ledgerOpenKg, file.openKg) ? "match" : "opening-diff";

    // Lần nạp trước đã "Theo file" với đúng cặp số này (ghi chú xuất điều chỉnh còn trên lô) ⇒ nhớ lựa chọn.
    const adjustedBefore =
      status === "opening-diff" && rows.some((l) => (l.note ?? "").includes(negativeAdjustmentNote(file.openKg - ledgerOpenKg, ledgerOpenKg, file.openKg)));
    const choice = d.choice ?? (adjustedBefore ? "file" : undefined);
    const warnings: string[] = [];
    const diff = file.openKg - ledgerOpenKg;
    if (status === "opening-diff")
      warnings.push(
        `Tồn đầu lệch: file ${fmt(file.openKg)} kg, sổ ${fmt(ledgerOpenKg)} kg (${diff > 0 ? "file nhiều hơn" : "sổ nhiều hơn"} ${fmt(Math.abs(diff))} kg).`
      );
    if (status === "missing") {
      const hints = similarRows(scope.filter((l) => !claimed.has(l.id) || rows.some((r) => r.id === l.id)), file.name);
      warnings.push(
        (sameCount > 1
          ? `Chưa ghép được dòng sổ nào: có ${sameCount} dòng sổ cùng tồn đầu ${fmt(file.openKg)} kg — không tự chọn, chọn đúng lô.`
          : `Chưa ghép được dòng sổ nào: file có tồn đầu ${fmt(file.openKg)} kg nhưng không dòng sổ chưa ghép nào có đúng số này.`) +
          (hints.length
            ? ` Có thể là: ${hints.map((l) => `${lineLabel(l)} (${fmt(l.openKg)} kg)`).join("; ")} — chọn ở ô "Ghép mã … với dòng sổ" rồi xử phần lệch.`
            : ` Sổ có lô này thì chọn ở ô "Ghép mã … với dòng sổ"; chưa có thì "Theo file" để thêm dòng.`)
      );
    }
    if (status === "unbalanced")
      warnings.push(`Dòng trên file không cân: ${fmt(file.openKg)} + ${fmt(file.inKg)} − ${fmt(file.outKg)} ≠ ${fmt(file.closeKg)} (tồn cuối in trên file).`);
    if (adjustedBefore && !d.choice) warnings.push("Lần nạp trước đã chọn Theo file cho đúng chỗ lệch này — giữ lựa chọn đó.");
    if (mapSource === "suggest") warnings.push("Ghép theo số tồn đầu trùng nhau — kiểm lại đúng lô chưa.");
    // Tồn cuối sau khi ghi + nhập/xuất sẽ ghi (để báo ghi đè).
    const acting = isActing(status, choice);
    const extraOut = status === "opening-diff" && choice === "file" && diff < 0 ? -diff : 0;
    const effectiveOpen = status === "opening-diff" && choice === "ledger" ? ledgerOpenKg : file.openKg;
    const currentClose = ledgerOpenKg + rows.reduce((s, l) => s + l.inKg - l.outKg, 0);
    const resultCloseKg = acting ? effectiveOpen + file.inKg - file.outKg : currentClose;
    if (acting && resultCloseKg < -EPS) warnings.push(`Ghi theo lựa chọn này thì tồn cuối ÂM ${fmt(resultCloseKg)} kg (xuất vượt tồn).`);
    const curIn = rows.reduce((s, l) => s + l.inKg, 0);
    const curOut = rows.reduce((s, l) => s + l.outKg, 0);
    const overwrite =
      acting && (curIn > EPS || curOut > EPS) && (!near(curIn, file.inKg) || !near(curOut, file.outKg + extraOut)) ? { inKg: curIn, outKg: curOut } : null;
    if (overwrite) warnings.push(`Sổ đang có nhập ${fmt(curIn)} · xuất ${fmt(curOut)} — sẽ THAY bằng số của file.`);
    const balancingOutKg = rows.reduce((s, l) => s + balancingOutOf(l.note), 0);
    if (balancingOutKg > EPS)
      warnings.push(`Cân đối đã ghi xuất ${fmt(balancingOutKg)} kg từ lô này (lấy xả đông). Nếu báo cáo kế toán đã tính phần đó thì đúng; chưa tính thì sẽ thiếu.`);

    items.push({ code: file.code, fileName: file.name, file, mapSource, rowIds: rows.map((l) => l.id), ledgerOpenKg, status, choice, overwrite, balancingOutKg, resultCloseKg, warnings });
  }

  const usedRowIds = new Set(items.flatMap((i) => i.rowIds));
  const ledgerOnly = scope
    .filter((l) => codeOfLine(l) && !fileCodes.has(codeOfLine(l)) && !usedRowIds.has(l.id))
    .map((l) => ({ rowId: l.id, code: codeOfLine(l), itemName: lineLabel(l), closeKg: l.openKg + l.inKg - l.outKg }));
  const candidates = scope
    .filter((l) => !codeOfLine(l) || !fileCodes.has(codeOfLine(l)))
    .map((l) => ({ id: l.id, label: `${lineLabel(l)} — tồn đầu ${fmt(l.openKg)} kg`, openKg: l.openKg }));

  return { month, warehouse, opensMonth, baseLines, items, ledgerOnly, candidates };
}

const foldWords = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\(\s*kg\s*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !["nl", "nguyen", "lieu", "kg"].includes(w));

/** Tối đa 3 dòng sổ có tên gần giống tên trên file (chỉ để GỢI Ý trong cảnh báo, không tự ghép). */
function similarRows(rows: MonthlyStockLine[], fileName: string): MonthlyStockLine[] {
  const target = new Set(foldWords(fileName));
  if (!target.size) return [];
  return rows
    .map((l) => {
      const words = new Set(foldWords(`${l.itemName} ${l.size} ${l.origin}`));
      let hit = 0;
      for (const w of words) if (target.has(w)) hit++;
      return { l, score: words.size ? hit / Math.max(words.size, 2) : 0, hit };
    })
    .filter((x) => x.hit >= 2 && x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.hit - a.hit)
    .slice(0, 3)
    .map((x) => x.l);
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString("vi-VN");

/** Ghi chú trên lô khi sổ nhiều hơn file và chọn Theo file — cũng là dấu để lần nạp sau nhớ lựa chọn. */
const negativeAdjustmentNote = (diff: number, ledgerOpenKg: number, fileOpenKg: number) =>
  `Xuất gồm ${fmt(-diff)} kg điều chỉnh tồn đầu theo XNT (sổ ${fmt(ledgerOpenKg)}, file ${fmt(fileOpenKg)}).`;

/** Trạng thái cần người dùng chọn trước khi nạp. */
export const needsChoice = (s: NxtStatus) => s === "opening-diff" || s === "missing" || s === "unbalanced";

/** Lựa chọn mỗi trạng thái được phép (dòng file không cân chỉ có thể bỏ — sửa file rồi nạp lại). */
export const CHOICES_OF: Record<NxtStatus, NxtChoice[]> = {
  match: [],
  new: [],
  "opening-diff": ["file", "ledger", "skip"],
  missing: ["file", "skip"],
  unbalanced: ["skip"],
  skipped: [],
};

/** Mã này có được ghi không (theo trạng thái + lựa chọn). */
export function isActing(status: NxtStatus, choice?: NxtChoice): boolean {
  if (status === "match" || status === "new") return true;
  if (status === "opening-diff") return choice === "file" || choice === "ledger";
  if (status === "missing") return choice === "file";
  return false;
}

/** Mọi lý do chưa cho nạp — hiện ở ErrorSummary khi bấm Nạp. Rỗng ⇒ nạp được. */
export function listNxtBlockers(plan: NxtPlan, reportIssues: NxtReportIssue[]): string[] {
  const out = reportIssues.filter((i) => i.level === "error").map((i) => i.text);
  for (const it of plan.items) {
    const allowedChoices = CHOICES_OF[it.status];
    if (needsChoice(it.status) && (!it.choice || !allowedChoices.includes(it.choice)))
      out.push(`${it.code}: ${STATUS_LABEL[it.status].toLowerCase()} — chọn ${allowedChoices.map((c) => `"${CHOICE_LABEL[c]}"`).join(" / ")}.`);
    if (isActing(it.status, it.choice) && it.resultCloseKg < -EPS) out.push(`${it.code}: tồn cuối sẽ âm ${fmt(it.resultCloseKg)} kg — đổi lựa chọn hoặc bỏ mã này.`);
  }
  const owner = new Map<string, string>();
  for (const it of plan.items) {
    if (!isActing(it.status, it.choice)) continue;
    for (const id of it.rowIds) {
      const o = owner.get(id);
      if (o && o !== it.code) out.push(`Một dòng sổ đang ghép cho cả ${o} và ${it.code} — mỗi dòng chỉ thuộc một mã.`);
      owner.set(id, it.code);
    }
  }
  return [...new Set(out)];
}

export const CHOICE_LABEL: Record<NxtChoice, string> = { file: "Theo file", ledger: "Giữ sổ", skip: "Bỏ mã này" };

export const STATUS_LABEL: Record<NxtStatus, string> = {
  match: "Khớp",
  new: "Mã mới",
  "opening-diff": "Lệch tồn đầu",
  missing: "Chưa có dòng sổ",
  unbalanced: "File không cân",
  skipped: "Bỏ qua",
};

export interface NxtApplyOptions {
  /** Nhóm hàng cho dòng mới. */
  category: string;
  decisions?: Record<string, NxtDecision>;
  /** Ghi chú gắn vào dòng mới / dòng điều chỉnh, VD "Nạp XNT 'file.pdf' (lập 02/11/2026)". */
  sourceNote: string;
}

export interface NxtApplyResult {
  lines: MonthlyStockLine[];
  updated: number;
  added: number;
  adjusted: number;
  skipped: number;
}

/** Ghi kế hoạch vào sổ: THAY nhập/xuất theo file, lưu mã kế toán, thêm dòng mới / dòng điều chỉnh. */
export function applyNxtPlan(plan: NxtPlan, opts: NxtApplyOptions): NxtApplyResult {
  const decisions = opts.decisions ?? {};
  const byId = new Map(plan.baseLines.map((l) => [l.id, l]));
  const changed = new Map<string, MonthlyStockLine>();
  const added: MonthlyStockLine[] = [];
  let adjusted = 0;
  let skipped = 0;
  let sortOrder = Math.max(0, ...plan.baseLines.filter((l) => l.period === plan.month && l.warehouse === plan.warehouse).map((l) => l.sortOrder || 0));
  const template = (code: string, name: string, id: string): MonthlyStockLine => ({
    id,
    period: plan.month,
    category: opts.category,
    warehouse: plan.warehouse,
    itemName: name,
    size: "",
    origin: "",
    importDate: "",
    storageLocation: "",
    kgPerCtn: null,
    unitPrice: null,
    openCtn: 0,
    openKg: 0,
    inCtn: 0,
    inKg: 0,
    outCtn: 0,
    outKg: 0,
    carriedFromId: "",
    sortOrder: ++sortOrder,
    note: `${opts.sourceNote} — mã KT: ${code}`,
    accountingCode: code,
  });

  for (const it of plan.items) {
    const d = decisions[it.code] ?? {};
    if (!isActing(it.status, it.choice)) {
      skipped++;
      continue;
    }
    const code = normalizeCode(it.code);
    const rows = it.rowIds.map((id) => changed.get(id) ?? byId.get(id)!).filter(Boolean);
    const name = (d.newName ?? "").trim() || tidyItemName(it.fileName) || code;

    if (!rows.length) {
      // Mã mới (tồn đầu 0) hoặc sổ thiếu dòng + "Theo file": một dòng mới mang luôn tồn đầu của file.
      const line = template(code, name, newRowId(plan.warehouse, plan.month, code));
      added.push({ ...line, openKg: it.file.openKg, inKg: it.file.inKg, outKg: it.file.outKg });
      continue;
    }

    let working = rows;
    let extraOut = 0;
    const diff = it.file.openKg - it.ledgerOpenKg;
    if (it.status === "opening-diff" && it.choice === "file") {
      adjusted++;
      if (diff > 0) {
        // Phần thiếu: dòng điều chỉnh riêng mang tồn đầu = phần chênh (dồn kỳ mang theo như lô thường).
        const adj = { ...template(code, `${rows[0].itemName} · điều chỉnh XNT`, adjustmentRowId(plan.warehouse, plan.month, code)), openKg: diff };
        adj.note = `Điều chỉnh tồn đầu +${fmt(diff)} kg theo XNT (sổ ${fmt(it.ledgerOpenKg)}, file ${fmt(it.file.openKg)}) — ${opts.sourceNote} — mã KT: ${code}`;
        added.push(adj);
        working = [...rows, adj];
      } else {
        // Phần thừa: không làm dòng âm — ghi thành xuất điều chỉnh trên chính lô (ghi chú nói rõ).
        extraOut = -diff;
      }
    }
    const split = distribute(working, it.file.inKg, it.file.outKg);
    for (const r of working) {
      const s = split.get(r.id)!;
      const isNew = added.some((a) => a.id === r.id);
      const outKg = s.outKg + (r.id === working[0].id ? extraOut : 0);
      const adjNote = r.id === working[0].id && extraOut > EPS ? negativeAdjustmentNote(diff, it.ledgerOpenKg, it.file.openKg) : "";
      const note = adjNote && !(r.note ?? "").includes(adjNote) ? [r.note, adjNote].filter(Boolean).join("\n") : r.note;
      const next = { ...r, inKg: s.inKg, outKg, accountingCode: code, note };
      if (isNew) added[added.findIndex((a) => a.id === r.id)] = next;
      else changed.set(r.id, next);
    }
  }

  const addedIds = new Set(added.map((a) => a.id));
  const lines = plan.baseLines.filter((l) => !addedIds.has(l.id)).map((l) => changed.get(l.id) ?? l).concat(added);
  const updated = [...changed.values()].filter((l) => JSON.stringify(l) !== JSON.stringify(byId.get(l.id))).length;
  return { lines, updated, added: added.length, adjusted, skipped };
}
