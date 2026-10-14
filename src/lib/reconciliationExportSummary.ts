/**
 * Sheet tổng hợp đứng ĐẦU file xuất (v6.4 — ít sheet, một chỗ trả lời).
 *
 * Kế toán gửi file kèm MỘT câu hỏi ("lọc hóa đơn chưa kê", "cộng cột lệch ở đâu"…).
 * Mở file ra thấy 6 sheet lạ là không biết nhìn đâu. Nên:
 *  - `KẾT LUẬN CHUNG` luôn đứng đầu: trả lời trước (kết luận + xem ở đâu, có đường
 *    link bấm được), số liệu sau, bằng chứng máy tự kiểm ở cuối. Mọi thứ mang tính
 *    TRẢ LỜI/BẰNG CHỨNG gộp vào đây — đối chiếu tổng, cộng cột, chỗ nghi vấn, tự kiểm.
 *  - Sheet riêng CHỈ dành cho danh sách hóa đơn cần lọc/gửi đi, và CHỈ dựng khi kỳ đó
 *    có dữ liệu: `HÓA ĐƠN CHƯA KÊ` · `SO HAI BẢN HĐĐT` · `CÙNG MST CÙNG NGÀY`.
 *  - Chỗ nào dò được trên chính sheet gốc (cột A, cột "Nguyên nhân lệch") thì chỉ
 *    đường tới đó, không chép thành danh sách mới.
 *
 * Số liệu lấy từ chính kết quả engine (`ReconciliationResult`) nên luôn khớp với màn hình.
 */
import type { ReconciliationResult, InvoiceSheet } from "./einvoiceReconciliation";
import { GENERATED_SHEET_NAMES } from "./einvoiceReconciliation";
import type { VersionPresence, TwoVersionResult, SameDayGroup } from "./twoVersionReconciliation";
import { groupSameTaxCodeSameDay, resolveTaxSideSheets, compareTwoInvoiceVersions } from "./twoVersionReconciliation";
import { FILL_COLORS, columnIndexToLetter, solidFill as to } from "./reconciliationCommon";

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
/** `orderNo` quyết định thứ tự tab lúc ghi — có thật lúc chạy nhưng thiếu trong .d.ts của exceljs. */
type WithOrder = { orderNo: number };

/** Tên các sheet tự dựng — phải nằm trong `GENERATED_SHEET_NAMES` để đọc lại bỏ qua, xuất lại xóa đi. */
const SHEET_NAMES = {
  conclusion: "KẾT LUẬN CHUNG",
  verification: "KIỂM CHỨNG",
  unlisted: "HÓA ĐƠN CHƯA KÊ",
  twoVersion: "SO HAI BẢN HĐĐT",
  sameDay: "CÙNG MST CÙNG NGÀY",
} as const;

const GROUP_NAMES: Record<number, string> = {
  1: "CỘNG KHÔNG KHỚP",
  2: "THIẾU Ô CHƯA THUẾ/THUẾ",
  3: "GẦN KHỚP",
  4: "THIẾU CẢ CỤM",
  5: "TỔNG BỊ XÓA",
  6: "CỘT QUY ĐỔI PHỤ",
  7: "SHEET TRÙNG LẶP",
};

const BG_HEADING = FILL_COLORS.header;
const TITLE_FILL = FILL_COLORS.title;
const BG_PASS = FILL_COLORS.green;
const UNMATCHED_FILL = FILL_COLORS.red;
const SUSPECT_FILL = FILL_COLORS.yellow;

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
/** Địa chỉ nội bộ tới một ô, dạng `#'Sheet'!A1` — đích của hàm HYPERLINK. */
const link = (sheet: string, o = "A1") => `#'${sheet.replace(/'/g, "''")}'!${o}`;
/**
 * Ô link bấm được bằng CÔNG THỨC `HYPERLINK` — không dùng kiểu link của exceljs vì nó
 * ghi lai (quan hệ ngoài + `location` còn dính dấu #), không chắc mọi bản Excel đọc đúng.
 */
const oLink = (linkTarget: string, text: string) => {
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  return { formula: `HYPERLINK(${q(linkTarget)},${q(text)})`, result: text };
};

/** Cộng ba cột tiền + đếm dòng cho một tập dòng hóa đơn. */
interface SumTotals {
  preTax: number;
  tax: number;
  total: number;
  n: number;
}
const ZERO_SUM: SumTotals = { preTax: 0, tax: 0, total: 0, n: 0 };
function sum(sheets: readonly InvoiceSheet[], filter: (d: InvoiceSheet["rows"][number]) => boolean): SumTotals {
  const r = { ...ZERO_SUM };
  for (const sh of sheets)
    for (const d of sh.rows)
      if (filter(d)) {
        r.preTax += d.preTaxVnd;
        r.tax += d.taxVnd;
        r.total += d.totalVnd;
        r.n++;
      }
  return r;
}

/** Cộng ba cột tiền + đếm dòng cho các dòng SỔ thỏa điều kiện. */
function sumLedger(result: ReconciliationResult, filter: (d: NonNullable<ReconciliationResult["ledgerSheet"]>["rows"][number]) => boolean = () => true): SumTotals {
  const r = { ...ZERO_SUM };
  for (const d of result.ledgerSheet?.rows ?? [])
    if (filter(d)) {
      r.preTax += d.preTax;
      r.tax += d.tax;
      r.total += d.total;
      r.n++;
    }
  return r;
}

/** Bỏ ô SỐ DÒNG: dòng suy ra (hiệu/tổng) thì đếm dòng vô nghĩa. */
const withoutCount = (c: SumTotals): SumTotals => ({ ...c, n: 0 });
const am = (c: SumTotals): SumTotals => ({ preTax: -c.preTax, tax: -c.tax, total: -c.total, n: -c.n });
const subtract = (a: SumTotals, b: SumTotals): SumTotals => ({
  preTax: a.preTax - b.preTax,
  tax: a.tax - b.tax,
  total: a.total - b.total,
  n: a.n - b.n,
});

function writeTableHeader(ws: Worksheet, rows: number, columns: readonly string[]): void {
  columns.forEach((t, i) => {
    const o = ws.getCell(rows, i + 1);
    o.value = t;
    o.font = { bold: true };
    o.fill = to(BG_HEADING);
    o.alignment = { vertical: "middle", wrapText: true };
    o.border = {
      left: { style: "thin" }, right: { style: "thin" },
      top: { style: "thin" }, bottom: { style: "thin" },
    };
  });
}

function writePageTitle(ws: Worksheet, title: string, description: readonly string[]): void {
  const o = ws.getCell(1, 1);
  o.value = title;
  o.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  o.fill = to(TITLE_FILL);
  description.forEach((m, i) => {
    ws.getCell(2 + i, 1).value = m;
    ws.getCell(2 + i, 1).font = { italic: true, size: 10 };
  });
}

// ---------------------------------------------------------------------------
// Sheet KẾT LUẬN CHUNG dùng chung 8 cột: A chữ · B–G số · H chữ giải thích.
// Câu dài thì GỘP ô cho đủ chỗ, và tự đặt chiều cao hàng (Excel không tự giãn
// hàng có ô gộp — không đặt là chữ bị cắt, người đọc tưởng thiếu).
// ---------------------------------------------------------------------------
const EMPTY_MARKS = [36, 17, 17, 17, 17, 17, 17, 58] as const;
const HET = EMPTY_MARKS.length;

type CellValue = string | number | null | { formula: string; result: string };
type Font = { bold?: boolean; italic?: boolean; size?: number; color?: { argb: string }; underline?: boolean };

/** Ghi một ô (gộp c1→c2 nếu cần); trả số dòng chữ ước tính để đặt chiều cao hàng. */
function textCell(ws: Worksheet, r: number, c1: number, c2: number, v: CellValue, font?: Font, fill?: string): number {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
  const o = ws.getCell(r, c1);
  o.value = v as never;
  o.alignment = { vertical: "top", wrapText: true };
  if (font) o.font = font;
  if (typeof v === "number") o.numFmt = "#,##0";
  if (fill) for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = to(fill);
  const width = EMPTY_MARKS.slice(c1 - 1, c2).reduce((a, b) => a + b, 0);
  const text = typeof v === "string" ? v : v && typeof v === "object" ? v.result : String(v ?? "");
  return text.split("\n").reduce((n, x) => n + Math.max(1, Math.ceil((x.length * 1.1) / width)), 0);
}
const setRowHeight = (ws: Worksheet, r: number, rowCount: number) => (ws.getRow(r).height = Math.max(15, rowCount * 15));

/** Một câu gộp hết chiều ngang. */
function writeTextRow(ws: Worksheet, r: number, v: CellValue, font?: Font, fill?: string): number {
  setRowHeight(ws, r, textCell(ws, r, 1, HET, v, font, fill));
  return r + 1;
}

/** Tiêu đề bảng: mỗi phần tử là [chữ, số cột chiếm]. */
function writeHeaderSpans(ws: Worksheet, r: number, columns: readonly (readonly [string, number])[]): void {
  let c = 1;
  let height = 1;
  for (const [name, width] of columns) {
    height = Math.max(height, textCell(ws, r, c, c + width - 1, name, { bold: true }, BG_HEADING));
    for (let k = c; k < c + width; k++)
      ws.getCell(r, k).border = {
        left: { style: "thin" }, right: { style: "thin" }, top: { style: "thin" }, bottom: { style: "thin" },
      };
    c += width;
  }
  setRowHeight(ws, r, height);
}

/** Một hàng dữ liệu theo đúng bố cục cột của `tieuDe8`. */
function hang8(ws: Worksheet, r: number, columns: readonly (readonly [CellValue, number])[], fill?: string, bold = false): void {
  let c = 1;
  let height = 1;
  for (const [v, width] of columns) {
    const la = typeof v === "object" && v !== null;
    height = Math.max(height, textCell(ws, r, c, c + width - 1, v, la ? { color: { argb: "FF0563C1" }, underline: true, bold } : bold ? { bold: true } : undefined, fill));
    c += width;
  }
  setRowHeight(ws, r, height);
}

function writeBlockTitle(ws: Worksheet, r: number, name: string): number {
  return writeTextRow(ws, r, name, { bold: true, size: 13, color: { argb: "FF17529C" } });
}

/** Một dòng chỉ tiêu ở khối SỐ LIỆU ĐỐI CHIẾU. */
type CriterionRow = [string, SumTotals | null, string, string, boolean?];

function criteriaTable(ws: Worksheet, fromRow: number, row: readonly CriterionRow[]): number {
  let r = fromRow;
  for (const [name, num, source, method, bold] of row) {
    if (name === "") {
      r++;
      continue;
    }
    hang8(ws, r, [
      [name, 1],
      [num ? num.preTax : null, 1], [num ? num.tax : null, 1], [num ? num.total : null, 1],
      [num && num.n !== 0 ? num.n : null, 1],
      [source, 2], [method, 1],
    ], undefined, bold);
    r++;
  }
  return r;
}

/** Khối SỐ LIỆU ĐỐI CHIẾU VỚI SỔ (trước v6.4 là sheet `ĐỐI CHIẾU TỔNG`) — chỉ khi có sổ. */
function writeCompareBlock(ws: Worksheet, r0: number, result: ReconciliationResult): number {
  const invoiceSheets = result.invoiceSheets.filter((s) => !s.isSubset);
  const ledgerName = result.ledgerSheet?.name ?? "";
  const A = sum(invoiceSheets, () => true);
  const K = sum(invoiceSheets, (d) => d.status === "MATCHED");
  const L = sum(invoiceSheets, (d) => d.status === "MISMATCHED");
  const T = sum(invoiceSheets, (d) => d.status === "MISSING");
  // Tách riêng phần "chưa vào sổ nhưng ĐÚNG là không cần vào sổ" (hóa đơn đã bị
  // thay thế/hủy) — không đổi nhóm đếm, chỉ cho kế toán biết phải rà bao nhiêu thật.
  const Tkhong = sum(invoiceSheets, (d) => d.status === "MISSING" && d.notRequiredInLedger);
  const checkDiff = subtract(A, { preTax: K.preTax + L.preTax + T.preTax, tax: K.tax + L.tax + T.tax, total: K.total + L.total + T.total, n: K.n + L.n + T.n });

  const B = sumLedger(result);
  const Bco = sumLedger(result, (d) => d.status === "FOUND");
  const Bthieu = sumLedger(result, (d) => d.status === "MISSING");

  const unlisted = subtract(subtract(A, K), L);
  const calcDiff = subtract(unlisted, T);
  const crossSubtract = subtract(A, Bco);
  const crossDiff = subtract(crossSubtract, unlisted);
  const crossCheck = subtract({ preTax: K.preTax + L.preTax, tax: K.tax + L.tax, total: K.total + L.total, n: 0 }, Bco);
  let diffColumnTotal = 0;
  for (const sh of invoiceSheets) for (const d of sh.rows) if (d.difference != null) diffColumnTotal += d.difference;

  let r = writeBlockTitle(ws, r0, `SỐ LIỆU ĐỐI CHIẾU VỚI SỔ "${ledgerName}"`);
  writeHeaderSpans(ws, r, [["CHỈ TIÊU", 1], ["TRƯỚC THUẾ", 1], ["THUẾ", 1], ["TỔNG THANH TOÁN", 1], ["SỐ DÒNG", 1], ["NGUỒN SỐ LIỆU", 2], ["CÁCH TỰ KIỂM TRA LẠI", 1]]);

  r = criteriaTable(ws, r + 1, [
    ["A. Tổng các sheet hóa đơn điện tử", A, 'Cộng cột "Chưa thuế (VND)", "Thuế (VND)", "Tổng thanh toán (VND)" của các sheet hóa đơn.', "Mở từng sheet, bôi đen cột cần cộng từ dòng đầu dữ liệu tới dòng cuối, đọc ô Sum dưới thanh trạng thái.", true],
    ["   – nhóm KHỚP (số trên hóa đơn)", K, 'Cộng ba cột VND với điều kiện cột A (KẾT QUẢ) = "KHỚP".', "Lọc cột A = KHỚP rồi cộng cột VND tương ứng."],
    ["   – nhóm LỆCH (số trên hóa đơn)", L, 'Điều kiện cột A = "LỆCH TIỀN" hoặc "LỆCH THUẾ".', "Lọc cột A = LỆCH TIỀN / LỆCH THUẾ, soát cột Chênh lệch + Bằng chứng."],
    [`   – nhóm CHƯA CÓ TRONG ${ledgerName}`, T, `Điều kiện cột A = "CHƯA CÓ TRONG ${ledgerName}".`, "Lọc cột A = CHƯA CÓ. Đây là danh sách cần rà để hạch toán."],
    ["        trong đó: đã bị thay thế/hủy — ĐÚNG là không vào sổ", Tkhong, 'Trong nhóm CHƯA CÓ, lọc cột A = "…KHÔNG CẦN VÀO SỔ".', "Trừ dòng này ra khỏi danh sách phải đi hạch toán — hóa đơn đã bị thay thế thì kế toán ghi bản thay thế, không ghi bản này."],
    ["        ⇒ CÒN LẠI THẬT SỰ PHẢI RÀ", subtract(T, Tkhong), "Nhóm CHƯA CÓ trừ dòng ngay trên.", "Đây mới là con số đi làm việc.", true],
    ["KIỂM TRA: dòng A trừ ba nhóm phải bằng 0", withoutCount(checkDiff), "Mỗi hóa đơn chỉ mang một nhãn.", "Khác 0 nghĩa là có dòng bị thêm, bị xóa, hoặc ô KẾT QUẢ bị ghi đè.", true],
    ["", null, "", ""],
    [`B. Sổ kế toán (sheet "${ledgerName}")`, B, "Cộng cột tổng cộng của sổ.", "Bôi đen cột tổng cộng và đọc ô Sum.", true],
    ["   – dòng sổ ĐÃ CÓ hóa đơn điện tử", Bco, 'Điều kiện cột A của sổ = "ĐÃ CÓ HĐĐT".', "Mỗi dòng có cột BẰNG CHỨNG ĐỐI CHIẾU ghi rõ khớp hóa đơn nào, sheet nào."],
    ["   – dòng sổ CHƯA CÓ hóa đơn điện tử", Bthieu, 'Điều kiện cột A của sổ = "CHƯA CÓ HĐĐT".', "Lọc cột A của sổ để ra danh sách đầy đủ."],
    ["", null, "", ""],
    ["C. CÁCH TÍNH ĐÚNG PHẦN CHƯA KÊ", null, "", "Phải trừ SỐ TRÊN HÓA ĐƠN của các nhóm đã đối chiếu được, không trừ số bên sổ.", true],
    ["   Tổng các sheet", withoutCount(A), "Lấy lại dòng A.", ""],
    ["   trừ nhóm KHỚP (số trên hóa đơn)", withoutCount(am(K)), "Đổi dấu dòng nhóm KHỚP.", ""],
    ["   trừ nhóm LỆCH (tiền / thuế — số trên hóa đơn)", withoutCount(am(L)), "Đổi dấu dòng nhóm LỆCH.", ""],
    ["   = PHẦN CHƯA KÊ", withoutCount(unlisted), "Cộng ba dòng trên.", "", true],
    ["   Đối chiếu với tổng nhóm CHƯA CÓ", withoutCount(T), "Lấy lại dòng nhóm CHƯA CÓ.", ""],
    ["   CHÊNH LỆCH – phải bằng 0", withoutCount(calcDiff), "Hai cách tính phải cho cùng một số.", "Bằng 0 thì con số phần chưa kê là đáng tin.", true],
    ["", null, "", ""],
    ['D. VÌ SAO KHÔNG LẤY "TỔNG TRỪ TỔNG SỔ"', null, "", "Bốn dòng dưới chỉ rõ phần chênh đến từ đâu.", true],
    ["   Tổng các sheet trừ sổ (dòng sổ đã có HĐĐT)", withoutCount(crossSubtract), 'Dòng A trừ dòng B "ĐÃ CÓ HĐĐT".', ""],
    ["   Phần chưa kê thật", withoutCount(unlisted), 'Lấy lại dòng "= PHẦN CHƯA KÊ".', ""],
    ["   Chênh", withoutCount(crossDiff), "Hiệu hai dòng trên.", "KHÔNG phải hóa đơn bị sót, mà là chênh giữa số trên hóa đơn và số trên sổ của những hóa đơn ĐÃ đối chiếu được."],
    ["   Kiểm chứng: (KHỚP + LỆCH phía hóa đơn) trừ sổ", withoutCount(crossCheck), "Cách tính khác cho cùng con số.", "Hai dòng này phải giống hệt nhau."],
    ['   Kiểm chứng tiếp: tổng cột "Chênh lệch"', { preTax: 0, tax: 0, total: diffColumnTotal, n: 0 }, 'Cộng cột "Chênh lệch" của các sheet.', "Chỉ áp dụng cho cột Tổng thanh toán."],
  ]);

  if (result.bridge.breakdown.length) {
    r = writeTextRow(ws, r + 1, "BÓC TÁCH PHẦN CHÊNH — đến từ những hóa đơn nào", { bold: true });
    writeHeaderSpans(ws, r, [["HÓA ĐƠN / LÝ DO", 3], ["SỐ TIỀN", 1], ["", 4]]);
    r++;
    for (const b of result.bridge.breakdown) hang8(ws, r++, [[b.label, 3], [b.amount, 1], ["", 4]]);
  }
  return r;
}

// ---------------------------------------------------------------------------
// DÒ LỆCH CỘNG CỘT — trả lời "chưa thuế + thuế phải bằng tổng thanh toán, lệch
// mấy triệu, sót dòng nào". Nói bằng ĐÚNG con số kế toán đang nhìn (ô lệch họ tự
// đặt cuối sheet, nếu máy nhận ra), bóc ra từng phần cộng lại đúng bằng số đó,
// rồi liệt kê từng dòng kèm địa chỉ ô — bấm là nhảy tới.
// ---------------------------------------------------------------------------

/** Cột AOA → cột 0-based trong FILE RA (tính cả cột A chèn/gỡ). */
export type OutputColumnMapper = (sh: InvoiceSheet, c: number) => number;

interface DiffPart {
  name: string;
  amount: number;
  kind: "real" | "fee" | "discount" | "rounding" | "other";
  fix: string;
}

/** Con số kế toán đang nhìn + các phần cộng lại đúng bằng nó. */
function analyzeMismatch(sh: InvoiceSheet): { V: number; parts: DiffPart[] } {
  const cd = sh.columnSum;
  const o = cd.userDiffCell;
  const includeFees = o?.addsFee ?? false;
  const deductDiscount = o?.subtractsDiscount ?? false;
  const V = cd.diff - (includeFees ? cd.feeSum : 0) + (deductDiscount ? cd.discountSum : 0);
  const parts: DiffPart[] = (
    [
    { name: "Hóa đơn ghi SAI tiền (chưa thuế + thuế khác tổng thanh toán)", amount: cd.breakdown.realDiff, kind: "real", fix: "CÓ — xem bảng DÒNG PHẢI SỬA ngay dưới." },
    { name: includeFees ? "Phí không khớp cột phí" : "Phí — công thức chưa cộng cột phí", amount: cd.breakdown.fee - (includeFees ? cd.feeSum : 0), kind: "fee", fix: "Không — phí là một phần hợp lệ của tổng thanh toán." },
    { name: deductDiscount ? "Chiết khấu không khớp cột chiết khấu" : "Chiết khấu — công thức chưa trừ cột chiết khấu", amount: cd.breakdown.discount + (deductDiscount ? cd.discountSum : 0), kind: "discount", fix: "Không — chiết khấu hợp lệ. Muốn ô tổng về đúng thì công thức trừ thêm cột chiết khấu." },
    { name: "Làm tròn 1 đồng của bên bán", amount: cd.breakdown.rounding, kind: "rounding", fix: "Không — sai số làm tròn trên hóa đơn." },
    ] satisfies DiffPart[]
  ).filter((p) => Math.abs(p.amount) > 0.5);
  const unexplained = V - parts.reduce((t, p) => t + p.amount, 0);
  if (Math.abs(unexplained) > 0.5)
    parts.push({ name: "Phí / chiết khấu ghi ở cột nhưng không nằm trong tổng thanh toán", amount: unexplained, kind: "other", fix: "Soát các dòng có phí/chiết khấu ở bảng dưới." });
  return { V, parts };
}

const formatAmount = (n: number) => Math.round(n).toLocaleString("vi-VN");

/** Câu trả lời một dòng cho một sheet — đặt ở bảng TRẢ LỜI đầu trang. */
function columnSumAnswer(sh: InvoiceSheet, outputColumn: OutputColumnMapper): { answer: string; isWrong: boolean } {
  const cd = sh.columnSum;
  const { V, parts } = analyzeMismatch(sh);
  const wrongRows = cd.mismatchRows.filter((d) => d.kind === "real");
  if (!wrongRows.length && Math.abs(V) <= 0.5)
    return { answer: `Khớp — chưa thuế + thuế bằng tổng thanh toán${cd.mismatchRows.length ? " (lệch từng dòng chỉ do phí/chiết khấu/làm tròn, bình thường)" : ""}.`, isWrong: false };
  const o = cd.userDiffCell;
  const lead = o ? `Ô ${columnIndexToLetter(outputColumn(sh, o.column))}${o.fileRow} = ${formatAmount(o.value)} đ` : `Cộng cả cột lệch ${formatAmount(V)} đ`;
  const errorLocation = wrongRows.length
    ? `do ${wrongRows.length} hóa đơn ghi sai tiền ở ${wrongRows.length <= 3 ? wrongRows.map((d) => `dòng ${d.fileRow}`).join(", ") : `${wrongRows.length} dòng (danh sách bên dưới)`} (${formatAmount(cd.breakdown.realDiff)} đ)`
    : "KHÔNG có hóa đơn nào ghi sai";
  const extraParts = parts
    .filter((p) => p.kind !== "real")
    .map((p) => `${p.amount < 0 ? "trừ" : "cộng"} ${p.kind === "fee" ? "phí" : p.kind === "discount" ? "chiết khấu" : p.kind === "rounding" ? "làm tròn" : "phần phí/chiết khấu khác"} ${formatAmount(Math.abs(p.amount))} đ`);
  return { answer: `${lead}: ${errorLocation}${extraParts.length ? `, ${extraParts.join(", ")}` : ""}.`, isWrong: wrongRows.length > 0 };
}

/** Khối dò lệch của MỘT sheet. */
function writeDiffBlock(ws: Worksheet, r0: number, sh: InvoiceSheet, outputColumn: OutputColumnMapper): number {
  const cd = sh.columnSum;
  const columns = (c: number) => (c >= 0 ? columnIndexToLetter(outputColumn(sh, c)) : "");
  const cellRefAt = (c: number, row: number) => (c >= 0 ? `${columns(c)}${row}` : "");
  const { V, parts } = analyzeMismatch(sh);
  const o = cd.userDiffCell;
  const cellAddress = o ? `${columns(o.column)}${o.fileRow}` : "";

  let r = writeBlockTitle(ws, r0, `SHEET ${sh.name} — ${o ? `ô ${cellAddress} = ${formatAmount(o.value)} đ` : `cộng cả cột lệch ${formatAmount(V)} đ`}`);
  const colLabel = (c: number, name: string) => (c >= 0 ? `${name} (cột ${columns(c)})` : "");
  const calcExplanation = o
    ? `Ô ${cellAddress} là ô tự tính ở cuối sheet: tổng cột tổng thanh toán (${columns(cd.totalColumn)}) trừ đi tổng ${[colLabel(cd.preTaxColumn, "chưa thuế"), colLabel(cd.taxColumn, "thuế"), o.addsFee ? colLabel(cd.feeColumn, "phí") : ""].filter(Boolean).join(" + ")}${o.subtractsDiscount ? `, rồi cộng lại chiết khấu (cột ${columns(cd.discountColumn)})` : ""}.${o.sign < 0 ? " Ô tính ngược chiều nên mang dấu âm; bảng dưới dùng số dương." : ""}`
    : `Tổng cột tổng thanh toán (${columns(cd.totalColumn)}) trừ đi tổng ${[colLabel(cd.preTaxColumn, "chưa thuế"), colLabel(cd.taxColumn, "thuế")].filter(Boolean).join(" + ")}.`;
  r = writeTextRow(ws, r, calcExplanation, { italic: true });
  r = writeTextRow(ws, r, `Số ${formatAmount(V)} đ này gồm ${parts.length} phần dưới đây, cộng lại đúng bằng nó:`, { bold: true });

  // --- các phần cộng lại ra đúng con số ---
  const wrongRows = cd.mismatchRows.filter((d) => d.kind === "real");
  const otherRows = cd.mismatchRows.filter((d) => d.kind !== "real");
  const lineLocations = (kind: DiffPart["kind"]): CellValue => {
    const items = cd.mismatchRows.filter((d) => d.kind === kind);
    if (!items.length) return "";
    if (items.length === 1) return oLink(link(sh.name, cellRefAt(cd.preTaxColumn, items[0]!.fileRow)), `dòng ${items[0]!.fileRow} (bấm để tới)`);
    return `${items.length} dòng: ${items.slice(0, 8).map((d) => d.fileRow).join(", ")}${items.length > 8 ? "…" : ""} — xem bảng dưới`;
  };
  writeHeaderSpans(ws, r++, [["PHẦN LỆCH", 1], ["SỐ TIỀN (đ)", 1], ["SỐ DÒNG", 1], ["Ở DÒNG NÀO", 4], ["CÓ PHẢI SỬA KHÔNG", 1]]);
  for (const p of parts) {
    const n = p.kind === "other" ? "" : cd.mismatchRows.filter((d) => d.kind === p.kind).length;
    hang8(ws, r++, [[p.name, 1], [p.amount, 1], [n, 1], [p.kind === "other" ? "" : lineLocations(p.kind), 4], [p.fix, 1]], p.kind === "real" ? UNMATCHED_FILL : undefined, p.kind === "real");
  }
  const total = parts.reduce((t, p) => t + p.amount, 0);
  hang8(ws, r++, [["CỘNG", 1], [total, 1], ["", 1], [o ? `= đúng ô ${cellAddress} ✓` : "= đúng số lệch khi cộng cả cột ✓", 4], ["", 1]], BG_PASS, true);
  if (o?.addsFee && cd.feeSum)
    r = writeTextRow(ws, r, `Phí ${formatAmount(cd.feeSum)} đ (${cd.rowCounts.fee} dòng) đã được công thức của ô ${cellAddress} cộng vào nên không gây lệch. Các dòng đó vẫn liệt kê ở bảng cuối để cộng lại cho đủ.`, { italic: true });
  r++;

  // --- từng dòng, có địa chỉ ô ---
  const writeRowHeader = () =>
    writeHeaderSpans(ws, r++, [
      ["DÒNG (bấm để tới)", 1], ["KÝ HIỆU – SỐ HĐ", 1], ["NGÀY LẬP", 1],
      [cd.preTaxColumn >= 0 ? `CHƯA THUẾ (cột ${columns(cd.preTaxColumn)})` : "CHƯA THUẾ", 1],
      [cd.taxColumn >= 0 ? `THUẾ (cột ${columns(cd.taxColumn)})` : "THUẾ", 1],
      [cd.totalColumn >= 0 ? `TỔNG TT (cột ${columns(cd.totalColumn)})` : "TỔNG TT", 1],
      ["LỆCH = TỔNG TT − (CHƯA THUẾ + THUẾ)", 1],
      ["NGƯỜI BÁN · GIẢI THÍCH", 1],
    ]);
  const writeDiffRow = (d: (typeof cd.mismatchRows)[number], explanation: string, fill?: string) =>
    hang8(ws, r++, [
      [oLink(link(sh.name, cellRefAt(cd.preTaxColumn, d.fileRow)), `${sh.name} dòng ${d.fileRow}`), 1],
      [d.invoice, 1], [d.date, 1], [d.preTax, 1], [d.tax, 1], [d.total, 1], [d.diff, 1],
      [`${d.seller}\n${explanation}`, 1],
    ], fill);
  const MAX_ROWS = 300;

  if (wrongRows.length) {
    r = writeTextRow(ws, r, `DÒNG PHẢI SỬA — ${wrongRows.length} hóa đơn ghi tiền không khớp nhau`, { bold: true, color: { argb: "FF9C0006" } });
    writeRowHeader();
    for (const d of wrongRows.slice(0, MAX_ROWS)) {
      const expectedPreTax = d.total - d.tax - d.fee + d.discount;
      const correctTotal = d.preTax + d.tax + d.fee - d.discount;
      writeDiffRow(
        d,
        `Chưa thuế + thuế${d.fee ? " + phí" : ""}${d.discount ? " − chiết khấu" : ""} = ${formatAmount(correctTotal)} nhưng tổng thanh toán ghi ${formatAmount(d.total)}. ` +
          `Nếu tổng thanh toán đúng thì ô chưa thuế ${cellRefAt(cd.preTaxColumn, d.fileRow)} phải là ${formatAmount(expectedPreTax)}; ` +
          `nếu chưa thuế đúng thì ô tổng ${cellRefAt(cd.totalColumn, d.fileRow)} phải là ${formatAmount(correctTotal)}. Mở hóa đơn gốc để biết ô nào gõ sai.`,
        UNMATCHED_FILL
      );
    }
    if (wrongRows.length > MAX_ROWS) r = writeTextRow(ws, r, `… còn ${wrongRows.length - MAX_ROWS} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.name}.`, { italic: true });
    r++;
  }
  if (otherRows.length) {
    r = writeTextRow(ws, r, `DÒNG LỆCH BÌNH THƯỜNG — ${otherRows.length} dòng, không phải sửa (liệt kê để cộng lại cho đủ)`, { bold: true });
    writeRowHeader();
    const reasonOf = (d: (typeof otherRows)[number]) =>
      d.kind === "fee" ? `Có phí ${formatAmount(d.fee)} đ${cd.feeColumn >= 0 ? ` (ô ${cellRefAt(cd.feeColumn, d.fileRow)})` : ""} — tổng thanh toán đã gồm phí.`
      : d.kind === "discount" ? `Chiết khấu ${formatAmount(d.discount)} đ${cd.discountColumn >= 0 ? ` (ô ${cellRefAt(cd.discountColumn, d.fileRow)})` : ""} — tổng thanh toán đã trừ chiết khấu.`
      : "Làm tròn 1 đồng của bên bán.";
    for (const d of otherRows.slice(0, MAX_ROWS)) writeDiffRow(d, reasonOf(d), SUSPECT_FILL);
    if (otherRows.length > MAX_ROWS) r = writeTextRow(ws, r, `… còn ${otherRows.length - MAX_ROWS} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.name}.`, { italic: true });
  }
  return r + 1;
}

/** Khối CHỖ CẦN SOÁT LẠI (trước v6.4 là sheet `NGHI VẤN SỐ LIỆU`) — chỉ khi có. */
function writeSuspectBlock(ws: Worksheet, r0: number, result: ReconciliationResult): number {
  const hasLedger = !!result.ledgerSheet;
  let r = writeBlockTitle(ws, r0, `CHỖ CẦN SOÁT LẠI — ${result.suspects.length + result.mergedSuspects.length} ô nghi sai số liệu (máy KHÔNG tự sửa ô nào)`);
  writeHeaderSpans(ws, r++, [["VỊ TRÍ (trong chính file này)", 1], ["SỐ ĐANG CÓ", 1], ["SỐ ĐỐI CHỨNG", 1], ["NHÓM", 2], ["SAI Ở CHỖ NÀO", 2], ["ẢNH HƯỞNG · AI LÀM GÌ", 1]]);
  result.suspects.forEach((nv, i) =>
    hang8(ws, r++, [
      // file không sổ KHÔNG chèn cột A (v6.5) ⇒ địa chỉ theo file gốc
      [`${i + 1}. ${hasLedger ? (nv.exportLocation ?? nv.location) : nv.location}`, 1], [nv.currentValue, 1], [nv.expectedValue, 1],
      [`Nhóm ${nv.group} · ${GROUP_NAMES[nv.group] ?? ""}`, 2],
      [`${nv.wrongAt}\nSố đối chứng lấy từ: ${nv.expectedSource}`, 2],
      [`${nv.impact}\n→ ${nv.correctValue != null
        ? "Máy suy được số đúng — bấm Sửa trên màn hình nếu xác nhận, giá trị cũ vẫn giữ ở sheet NHẬT KÝ SỬA."
        : "Không suy được số đúng — hỏi lại người bán hoặc xin lại bản xuất gốc từ cổng thuế."}`, 1],
    ])
  );
  result.mergedSuspects.forEach((g, i) =>
    hang8(ws, r++, [
      [`${result.suspects.length + i + 1}. ${g.name}`, 1], [`${g.rowCount} dòng`, 1], [vnd(g.totalAmount), 1],
      [`Nhóm ${g.group} · ${GROUP_NAMES[g.group] ?? ""}`, 2],
      [`${g.warning}\n(gộp thống kê — chi tiết từng dòng xem trên màn hình)`, 2],
      ["Soát theo cảnh báo rồi xác nhận bản chốt.", 1],
    ])
  );
  return r;
}

/** Khối TỰ KIỂM TRA — bằng chứng máy tự chấm, đứng CUỐI. */
function writeSelfCheckBlock(ws: Worksheet, r0: number, result: ReconciliationResult): number {
  const passedCount = result.trialChecks.filter((p) => p.passed).length;
  const total = result.trialChecks.length;
  let r = writeBlockTitle(ws, r0, `MÁY TỰ KIỂM TRA — ${total} phép thử chấm lúc xuất file`);
  r = writeTextRow(ws, r, passedCount === total ? `ĐẠT TẤT CẢ ${passedCount}/${total}` : `CÓ ${total - passedCount} PHÉP CHƯA ĐẠT (${passedCount}/${total}) — soát trước khi tin con số tổng`, { bold: true }, passedCount === total ? BG_PASS : UNMATCHED_FILL);
  writeHeaderSpans(ws, r++, [["NỘI DUNG PHÉP THỬ", 1], ["KỲ VỌNG", 1], ["KẾT QUẢ", 1], ["ĐÁNH GIÁ", 1], ["PHÉP THỬ NÀY BẮT LỖI GÌ", 4]]);
  for (const p of result.trialChecks) {
    hang8(ws, r, [[p.name, 1], [p.expected, 1], [p.actual, 1], [p.passed ? "ĐẠT" : "KHÔNG ĐẠT", 1], [p.catches, 4]]);
    ws.getCell(r, 4).fill = to(p.passed ? BG_PASS : UNMATCHED_FILL);
    r++;
  }
  return r;
}

/** Một câu trả lời ở đầu sheet KẾT LUẬN CHUNG. */
interface Answer {
  task: string;
  conclusion: string;
  /** Chỗ xem tiếp: sheet khác (+ ô) hoặc một khối ngay trong sheet này. */
  link?: { text: string; sheet?: string; cell?: string; block?: string };
  action: string;
  level: "red" | "yellow" | "green";
}

/** Mốc dòng trong sheet HÓA ĐƠN CHƯA KÊ — để link nhảy thẳng tới đúng mục. */
interface UnlistedAnchors {
  suspectedErrors?: number;
  missingCount?: number;
}

/**
 * SO TỔNG 2 FILE (bản GỌN cho sheet KẾT LUẬN): chỉ 3 dòng — tổng hóa đơn điện tử,
 * tổng sổ, chênh — đủ 3 cột trước thuế/thuế/tổng. Chi tiết cách tính + tự kiểm đẩy
 * sang sheet KIỂM CHỨNG (khối `khoiDoiChieu`).
 */
function writeSummaryBlock(ws: Worksheet, r0: number, result: ReconciliationResult): number {
  const invoiceSheets = result.invoiceSheets.filter((s) => !s.isSubset);
  const A = sum(invoiceSheets, () => true);
  const B = sumLedger(result);
  const diff = subtract(A, B);
  const ledgerName = result.ledgerSheet?.name ?? "PMEM";
  const r = writeBlockTitle(ws, r0, `SO TỔNG 2 FILE — HÓA ĐƠN ĐIỆN TỬ ⇄ SỔ "${ledgerName}"`);
  writeHeaderSpans(ws, r, [["CHỈ TIÊU", 1], ["TRƯỚC THUẾ", 1], ["THUẾ", 1], ["TỔNG THANH TOÁN", 1], ["SỐ DÒNG", 1], ["NGUỒN SỐ LIỆU", 2], ["CÁCH TỰ KIỂM TRA LẠI", 1]]);
  return criteriaTable(ws, r + 1, [
    [`A. Hóa đơn điện tử (${invoiceSheets.map((s) => s.name).join(" + ")})`, A, "Cộng 3 cột tiền của các sheet hóa đơn.", "Bôi đen cột, đọc ô Sum dưới thanh trạng thái.", true],
    [`B. Sổ kế toán "${ledgerName}"`, B, "Cộng tiền hàng + tiền thuế của mọi dòng sổ.", "Bôi đen cột tổng cộng của sổ.", true],
    ["Chênh A − B", diff, `Chủ yếu là hóa đơn CHƯA KÊ vào sổ — xem sheet ${SHEET_NAMES.unlisted}.`, `Bóc tách đầy đủ + 9 phép tự kiểm ở sheet ${SHEET_NAMES.verification}.`],
  ]);
}

/**
 * Dựng HAI sheet: KẾT LUẬN CHUNG (chỉ VIỆC PHẢI LÀM + SO TỔNG gọn) và KIỂM CHỨNG
 * (số liệu đối chiếu đầy đủ, bóc tách, cân đối cột, ô nghi sai, 9 phép tự kiểm).
 * Tách 2 sheet để kế toán mở KẾT LUẬN là thấy ngay việc phải làm, không bị chôn giữa
 * phần chứng minh. `ds` cho biết sheet danh sách nào THẬT SỰ được dựng (để chỉ đường).
 */
function buildConclusionSheet(
  wb: Workbook,
  result: ReconciliationResult,
  items: { unlisted: UnlistedAnchors | null; twoVersion: TwoVersionResult | null; sameDay: readonly SameDayGroup[] },
  outputColumn: OutputColumnMapper
): { conclusion: Worksheet; verification: Worksheet } {
  const ws = wb.addWorksheet(SHEET_NAMES.conclusion);
  EMPTY_MARKS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const invoiceSheets = result.invoiceSheets.filter((s) => !s.isSubset);
  const phu = result.invoiceSheets.filter((s) => s.isSubset);
  const hasLedger = !!result.ledgerSheet;
  const ledgerName = result.ledgerSheet?.name ?? "";
  const invoiceSheetNames = invoiceSheets.map((s) => `"${s.name}"`).join(", ");
  const row = invoiceSheets.flatMap((s) => s.rows);
  // Sheet có gì để dò lệch cộng cột (lệch khác 0 hoặc có dòng ghi sai).
  const canDo = invoiceSheets.filter((s) => s.columnSum.mismatchRows.some((d) => d.kind === "real") || Math.abs(analyzeMismatch(s).V) > 0.5);

  // --- Câu trả lời. Thứ tự theo việc chính của file: có sổ ⇒ chưa kê; hai bản ⇒ so
  // hai bản; chỉ bảng kê ⇒ cộng cột. Tự kiểm luôn cuối. ---
  const answers: Answer[] = [];
  const columnSums: Answer[] = invoiceSheets.map((s) => {
    const t = columnSumAnswer(s, outputColumn);
    const hasBlock = canDo.includes(s);
    return {
      task: `Sheet ${s.name}: chưa thuế + thuế có bằng tổng thanh toán?`,
      conclusion: t.answer,
      link: hasBlock ? { text: `Chi tiết sheet ${s.name} bên dưới`, block: `doLech:${s.name}` } : undefined,
      action: t.isWrong ? "Sửa các dòng tô đỏ theo bảng DÒNG PHẢI SỬA (có ghi rõ ô nào, số đúng là bao nhiêu)." : "",
      level: t.isWrong ? "red" : hasBlock ? "yellow" : "green",
    };
  });

  if (!hasLedger && !items.twoVersion) answers.push(...columnSums);

  if (hasLedger) {
    const missingRows = row.filter((d) => d.status === "MISSING");
    const toDeclare = missingRows.filter((d) => !d.notRequiredInLedger && !d.nearMatchNote);
    const suspected = missingRows.filter((d) => !d.notRequiredInLedger && d.nearMatchNote);
    const skipped = missingRows.filter((d) => d.notRequiredInLedger);
    answers.push({
      task: `Hóa đơn chưa kê vào sổ "${ledgerName}"`,
      conclusion: toDeclare.length
        ? `${toDeclare.length} hóa đơn · ${vnd(toDeclare.reduce((t, d) => t + d.totalVnd, 0))} chưa có trong sổ.${skipped.length ? ` Đã loại ${skipped.length} hóa đơn bị thay thế/hủy (không cần kê).` : ""}`
        : `Không có — mọi hóa đơn cần kê đều đã vào sổ.${skipped.length ? ` (${skipped.length} hóa đơn bị thay thế/hủy — đúng là không vào sổ.)` : ""}`,
      link: items.unlisted ? { text: `Sheet ${SHEET_NAMES.unlisted}`, sheet: SHEET_NAMES.unlisted } : undefined,
      action: toDeclare.length ? "Kê bổ sung vào sổ theo danh sách (đã xếp theo ngày lập, có dòng cộng)." : "",
      level: toDeclare.length ? "red" : "green",
    });
    if (suspected.length)
      answers.push({
        task: "Nghi đã kê nhưng gõ sai số hóa đơn ở sổ",
        conclusion: `${suspected.length} hóa đơn cùng MST + cùng số tiền với một dòng sổ không ghép được.`,
        link: items.unlisted?.suspectedErrors ? { text: `${SHEET_NAMES.unlisted} · mục tô vàng`, sheet: SHEET_NAMES.unlisted, cell: `A${items.unlisted.suspectedErrors}` } : undefined,
        action: "Xác nhận rồi SỬA SỐ Ở SỔ — đừng kê thêm lần nữa.",
        level: "yellow",
      });
    const amountMismatches = row.filter((d) => d.conclusion === "LỆCH TIỀN");
    const amountMismatchSheets = invoiceSheets.filter((s) => s.rows.some((d) => d.conclusion === "LỆCH TIỀN"));
    answers.push({
      task: "Hóa đơn đã vào sổ nhưng LỆCH TIỀN (tổng thanh toán)",
      conclusion: amountMismatches.length
        ? `${amountMismatches.length} hóa đơn · chênh ${vnd(amountMismatches.reduce((t, d) => t + (d.difference ?? 0), 0))}.`
        : "Không có — hóa đơn nào đã vào sổ đều khớp tổng thanh toán.",
      link: amountMismatchSheets.length
        ? { text: `Lọc cột A = "LỆCH TIỀN" ở sheet ${amountMismatchSheets.map((s) => s.name).join(", ")}`, sheet: amountMismatchSheets[0]!.name }
        : undefined,
      action: amountMismatches.length ? 'Soát cột "Chênh lệch" và "BẰNG CHỨNG ĐỐI CHIẾU" trên chính dòng đó.' : "",
      level: amountMismatches.length ? "red" : "green",
    });
    const taxDiffRows = row.filter((d) => d.conclusion === "LỆCH THUẾ");
    const taxMismatchSheets = invoiceSheets.filter((s) => s.rows.some((d) => d.conclusion === "LỆCH THUẾ"));
    answers.push({
      task: "Hóa đơn KHỚP tổng nhưng LỆCH THUẾ",
      conclusion: taxDiffRows.length
        ? `${taxDiffRows.length} hóa đơn: tổng thanh toán đúng nhưng SỐ THUẾ ở sổ khác hóa đơn — nghi sai thuế suất / số thuế.`
        : "Không có — số thuế trên sổ khớp hóa đơn ở mọi dòng đã kê.",
      link: taxMismatchSheets.length
        ? { text: `Lọc cột A = "LỆCH THUẾ" ở sheet ${taxMismatchSheets.map((s) => s.name).join(", ")}`, sheet: taxMismatchSheets[0]!.name }
        : undefined,
      action: taxDiffRows.length ? 'Soát cột "BẰNG CHỨNG ĐỐI CHIẾU" — sửa số thuế ở sổ cho khớp hóa đơn (tiền thanh toán vẫn đúng).' : "",
      level: taxDiffRows.length ? "red" : "green",
    });
    const missingLedgerRows = (result.ledgerSheet?.rows ?? []).filter((d) => d.status === "MISSING");
    answers.push({
      task: "Dòng sổ không tìm thấy hóa đơn điện tử",
      conclusion: missingLedgerRows.length
        ? `${missingLedgerRows.length} dòng sổ · ${vnd(missingLedgerRows.reduce((t, d) => t + d.total, 0))}.`
        : "Không có — mọi dòng sổ đều có hóa đơn điện tử.",
      link: missingLedgerRows.length && items.unlisted?.missingCount
        ? { text: `${SHEET_NAMES.unlisted} · mục cuối`, sheet: SHEET_NAMES.unlisted, cell: `A${items.unlisted.missingCount}` }
        : undefined,
      action: missingLedgerRows.length ? "Kiểm lại số/ký hiệu hóa đơn gõ ở sổ, hoặc hóa đơn chưa lên cổng thuế." : "",
      level: missingLedgerRows.length ? "yellow" : "green",
    });
  }

  if (items.twoVersion) {
    const t = items.twoVersion.totals;
    const actionCount = t.sentOnlyCount + t.downloadedOnlyCount + t.amountMismatchCount;
    answers.push({
      task: "So hai bản hóa đơn điện tử (thuế gửi ⇄ tự tải)",
      conclusion: `Bản tự tải THIẾU ${t.sentOnlyCount} hóa đơn (${vnd(t.sentOnlyAmount)}) · thuế không gửi ${t.downloadedOnlyCount} (${vnd(t.downloadedOnlyAmount)}) · lệch tiền ${t.amountMismatchCount} · khớp ${t.bothCount - t.amountMismatchCount - t.uncomparableCount}.`,
      link: { text: `Sheet ${SHEET_NAMES.twoVersion}`, sheet: SHEET_NAMES.twoVersion },
      action: actionCount ? "Xử theo cột PHẢI LÀM GÌ, dòng tô đỏ (bản tự tải thiếu) trước." : "",
      level: actionCount ? "red" : "green",
    });
  }

  if (hasLedger || items.twoVersion) answers.push(...columnSums);

  if (items.sameDay.length) {
    const sameAmountCount = items.sameDay.filter((g) => g.sameAmount).length;
    answers.push({
      task: "Hóa đơn cùng MST cùng ngày",
      conclusion: `${items.sameDay.length} nhóm · ${items.sameDay.reduce((s, g) => s + g.invoiceCount, 0)} hóa đơn. ${sameAmountCount ? `${sameAmountCount} nhóm có hóa đơn TRÙNG KHÍT số tiền — chỗ dễ kê hai lần.` : "Không nhóm nào trùng khít số tiền."}`,
      link: { text: `Sheet ${SHEET_NAMES.sameDay} (cuối file)`, sheet: SHEET_NAMES.sameDay },
      action: sameAmountCount ? "Chỉ để soát bằng mắt khi cần: nhóm tô vàng xếp đầu sheet. Nhiều hóa đơn một ngày chưa chắc là sai." : "Chỉ để soát bằng mắt khi cần — không phải lỗi.",
      level: "green",
    });
  }

  const suspectCount = result.suspects.length + result.mergedSuspects.length;
  answers.push({
    task: "Ô số liệu nghi sai trong file",
    conclusion: suspectCount ? `${suspectCount} chỗ cần soát (máy không tự sửa ô nào).` : "Không có chỗ nào nghi vấn.",
    link: suspectCount ? { text: "Khối CHỖ CẦN SOÁT LẠI bên dưới", block: "nghiVan" } : undefined,
    action: suspectCount ? 'Mỗi dòng trỏ đúng ô trong file này; máy suy được số đúng thì bấm "Sửa" trên màn hình.' : "",
    level: suspectCount ? "yellow" : "green",
  });

  // "Không cần vào sổ" đã nói ở dòng chưa kê; không có sổ thì "thiếu sổ" đã nói ở
  // đầu trang. Trùng khóa KHÔNG lọc ở đây: engine đã chỉ báo trùng thật (cùng một bản,
  // hoặc có sổ mà bị cộng hai lần) — giấu đi là giấu đúng dấu hiệu đếm đôi.
  const alreadyStated = new Set(hasLedger ? ["Hóa đơn không cần vào sổ"] : ["Thiếu dữ liệu", "Hóa đơn không cần vào sổ"]);
  const byType = new Map<string, string[]>();
  for (const c of result.warnings)
    if (!alreadyStated.has(c.kind))
      byType.set(c.kind, [...(byType.get(c.kind) ?? []), c.detail]);
  for (const [kind, ct] of byType)
    answers.push({
      task: `⚠ ${kind}`,
      conclusion: ct.length > 1 ? `${ct[0]} (và ${ct.length - 1} cảnh báo cùng loại — xem trên màn hình)` : ct[0]!,
      action: "",
      level: "yellow",
    });

  const passedCount = result.trialChecks.filter((p) => p.passed).length;
  answers.push({
    task: "Máy tự kiểm lại kết quả",
    conclusion: passedCount === result.trialChecks.length ? `ĐẠT ${passedCount}/${result.trialChecks.length} phép thử.` : `CÓ ${result.trialChecks.length - passedCount} PHÉP CHƯA ĐẠT (${passedCount}/${result.trialChecks.length}) — soát trước khi tin con số tổng.`,
    link: { text: "Khối MÁY TỰ KIỂM TRA cuối sheet", block: "tuKiem" },
    action: "",
    level: passedCount === result.trialChecks.length ? "green" : "red",
  });

  // --- Đầu trang (KẾT LUẬN CHUNG) ---
  const title = hasLedger
    ? `KẾT QUẢ ĐỐI SOÁT HÓA ĐƠN ĐIỆN TỬ VỚI SỔ "${ledgerName}"`
    : items.twoVersion
      ? "KẾT QUẢ SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ"
      : "KẾT QUẢ DÒ: CHƯA THUẾ + THUẾ CÓ BẰNG TỔNG THANH TOÁN KHÔNG";
  const mode = hasLedger
    ? `Đối chiếu ${invoiceSheets.length} sheet hóa đơn điện tử (${invoiceSheetNames}) với sổ kế toán "${ledgerName}". Cột A của các sheet là cột KẾT QUẢ mới chèn nên cột gốc dời sang phải 1 cột.`
    : items.twoVersion
      ? `File có HAI BẢN hóa đơn điện tử (thuế gửi: ${items.twoVersion.sentSheets.join(" + ")} · tự tải: ${items.twoVersion.downloadedSheets.join(" + ")}), không có sổ kế toán. Mọi ô vẫn ở đúng địa chỉ cũ.`
      : `File chỉ có bảng kê hóa đơn (${invoiceSheetNames}), không có sổ kế toán. Mọi ô vẫn ở ĐÚNG ĐỊA CHỈ CŨ; kết quả kiểm từng dòng nằm ở 3 cột mới nối cuối mỗi sheet, dòng có lệch được tô màu.`;
  let r = writeTextRow(ws, 1, title, { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, TITLE_FILL);
  r = writeTextRow(ws, r, `${mode}${phu.length ? ` Sheet ${phu.map((s) => `"${s.name}"`).join(", ")} trùng lặp (tập con) nên không cộng vào tổng.` : ""}`, { italic: true });
  r = writeTextRow(ws, r, `Sheet này chỉ ghi VIỆC PHẢI LÀM và SO TỔNG. Bóc tách, cân đối cột, tự kiểm nằm ở sheet "${SHEET_NAMES.verification}". Không ô số liệu gốc nào bị sửa; chữ xanh gạch chân bấm được.`, { italic: true });
  r++;

  // Chia câu trả lời: VIỆC PHẢI LÀM (kế toán hành động) ở KẾT LUẬN; GHI CHÚ / TỰ KIỂM
  // (cân đối cột, cùng MST, cảnh báo, 9 phép thử) dồn sang KIỂM CHỨNG.
  const isVerifyItem = (t: Answer) =>
    /chưa thuế \+ thuế/.test(t.task) ||
    t.task === "Hóa đơn cùng MST cùng ngày" ||
    t.task.startsWith("⚠") ||
    t.task === "Máy tự kiểm lại kết quả";
  const actionItems = answers.filter((t) => !isVerifyItem(t));
  const verifyItems = answers.filter(isVerifyItem);
  const hangTL = new Map<Answer, { ws: Worksheet; row: number }>();

  r = writeBlockTitle(ws, r, "VIỆC PHẢI LÀM");
  writeHeaderSpans(ws, r++, [["VIỆC", 1], ["KẾT LUẬN", 4], ["XEM Ở ĐÂU", 2], ["PHẢI LÀM GÌ", 1]]);
  for (const t of actionItems) hangTL.set(t, { ws, row: r++ });
  r++;
  if (hasLedger) writeSummaryBlock(ws, r, result);

  // --- Sheet KIỂM CHỨNG ---
  const ws2 = wb.addWorksheet(SHEET_NAMES.verification);
  EMPTY_MARKS.forEach((w, i) => (ws2.getColumn(i + 1).width = w));
  let r2 = writeTextRow(ws2, 1, "KIỂM CHỨNG & CHI TIẾT — phần chứng minh máy làm đúng", { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, TITLE_FILL);
  r2 = writeTextRow(ws2, r2, `Số liệu đối chiếu đầy đủ, bóc tách phần chênh, cân đối cột, ô nghi sai và 9 phép máy tự kiểm. Mở khi cần đối chiếu sâu — việc phải làm đã tóm ở sheet "${SHEET_NAMES.conclusion}".`, { italic: true });
  r2++;
  if (verifyItems.length) {
    r2 = writeBlockTitle(ws2, r2, "GHI CHÚ & TỰ KIỂM");
    writeHeaderSpans(ws2, r2++, [["MỤC", 1], ["KẾT LUẬN", 4], ["XEM Ở ĐÂU", 2], ["GHI CHÚ", 1]]);
    for (const t of verifyItems) hangTL.set(t, { ws: ws2, row: r2++ });
    r2++;
  }

  // --- Khối chi tiết (đều nằm ở KIỂM CHỨNG) — ghi trước để biết hàng rồi điền link ---
  const anchor = new Map<string, number>();
  for (const s of !hasLedger ? canDo : []) {
    anchor.set(`doLech:${s.name}`, r2);
    r2 = writeDiffBlock(ws2, r2, s, outputColumn) + 1;
  }
  if (hasLedger) {
    r2 = writeCompareBlock(ws2, r2, result) + 2;
    for (const s of canDo) {
      anchor.set(`doLech:${s.name}`, r2);
      r2 = writeDiffBlock(ws2, r2, s, outputColumn) + 1;
    }
  }
  if (suspectCount) {
    anchor.set("nghiVan", r2);
    r2 = writeSuspectBlock(ws2, r2, result) + 2;
  }
  anchor.set("tuKiem", r2);
  writeSelfCheckBlock(ws2, r2, result);

  // --- Điền link vào hai bảng trả lời (khối chi tiết đều ở KIỂM CHỨNG) ---
  const BG_BY_LEVEL = { red: UNMATCHED_FILL, yellow: SUSPECT_FILL, green: BG_PASS } as const;
  for (const [t, { ws: wsx, row: rows }] of hangTL) {
    let viewCell: CellValue = "";
    if (t.link) {
      const linkTarget = t.link.block ? (anchor.has(t.link.block) ? link(SHEET_NAMES.verification, `A${anchor.get(t.link.block)}`) : null) : link(t.link.sheet!, t.link.cell);
      viewCell = linkTarget ? oLink(linkTarget, t.link.text) : t.link.text;
    }
    hang8(wsx, rows, [[t.task, 1], [t.conclusion, 4], [viewCell, 2], [t.action, 1]], BG_BY_LEVEL[t.level]);
    wsx.getCell(rows, 1).font = { bold: true };
  }
  return { conclusion: ws, verification: ws2 };
}

/** "dd/mm/yyyy" → "yyyymmdd" để xếp theo ngày. */
const dateKey = (s: string): string => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.trim());
  return m ? `${m[3]}${m[2]!.padStart(2, "0")}${m[1]!.padStart(2, "0")}` : s;
};

/**
 * Sheet HÓA ĐƠN CHƯA KÊ — danh sách LỌC SẴN, không bắt kế toán tự lọc cột A.
 *
 * Kế toán phản ánh "không thấy lọc chưa kê": nhãn có sẵn ở cột A từng sheet, nhưng
 * phải biết mà lọc, lại rải qua nhiều sheet. Đây là thứ họ cần nhất — danh sách đi
 * hạch toán — nên dựng riêng, xếp theo ngày lập, có dòng cộng.
 *
 * LOẠI hóa đơn `khongCanVaoSo` (đã bị thay thế/hủy — quy tắc 2026-09-16): liệt kê vào
 * đây là bắt người ta đi kê oan. Chúng được nêu riêng ở cuối cho minh bạch.
 * Phần 2: dòng sổ KHÔNG có hóa đơn điện tử (chiều ngược lại).
 */
function buildUndeclaredSheet(wb: Workbook, result: ReconciliationResult): { ws: Worksheet; anchors: UnlistedAnchors } | null {
  const invoiceSheets = result.invoiceSheets.filter((sh) => !sh.isSubset);
  const allMissing = invoiceSheets.flatMap((sh) => sh.rows.filter((d) => d.status === "MISSING"));
  const missingRows = (result.ledgerSheet?.rows ?? []).filter((d) => d.status === "MISSING");
  // Cả hai chiều đều sạch ⇒ không có gì để lọc, đừng đẻ sheet rỗng.
  if (!allMissing.length && !missingRows.length) return null;
  const anchor: UnlistedAnchors = {};
  const ws = wb.addWorksheet(SHEET_NAMES.unlisted);
  [6, 12, 14, 12, 18, 42, 18, 16, 18, 20, 20, 56].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const byDate = (a: (typeof allMissing)[number], b: (typeof allMissing)[number]) =>
    dateKey(a.issueDate).localeCompare(dateKey(b.issueDate)) || a.sellerName.localeCompare(b.sellerName, "vi");
  // Có "gần khớp" (cùng MST + cùng số tiền với một dòng sổ không ghép được) ⇒ nhiều
  // khả năng ĐÃ KÊ, chỉ gõ sai số hóa đơn ở sổ. Tách riêng kẻo kế toán đi kê trùng.
  // Vẫn để trong sheet này (chỉ là gợi ý của máy, người phải xác nhận).
  const toDeclare = allMissing.filter((d) => !d.notRequiredInLedger && !d.nearMatchNote).sort(byDate);
  const suspectedInLedger = allMissing.filter((d) => !d.notRequiredInLedger && d.nearMatchNote).sort(byDate);
  const skipped = allMissing.filter((d) => d.notRequiredInLedger);
  const ledgerName = result.ledgerSheet?.name ?? "sổ kế toán";
  const declaredTotal = toDeclare.reduce((t, d) => t + d.totalVnd, 0);

  writePageTitle(ws, `HÓA ĐƠN CHƯA KÊ — ${toDeclare.length} hóa đơn · ${Math.round(declaredTotal).toLocaleString("vi-VN")} đ`, [
    `Hóa đơn có trên cổng thuế nhưng CHƯA có trong sheet "${ledgerName}". Xếp theo ngày lập. Đây là danh sách đi hạch toán.`,
    [
      suspectedInLedger.length
        ? `Tách riêng ${suspectedInLedger.length} hóa đơn NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN ở sổ (cùng MST + cùng số tiền) — xem mục ngay dưới bảng chính, xác nhận rồi sửa số ở sổ, đừng kê thêm.`
        : "",
      skipped.length ? `Loại ${skipped.length} hóa đơn đã bị thay thế/hủy (không cần kê) — nêu ở cuối sheet.` : "",
    ].filter(Boolean).join(" ") || "Không có hóa đơn nào nghi gõ sai số hay bị thay thế/hủy trong nhóm này.",
  ]);

  const tableStartRow = 5;
  const columns = [
    "STT", "Ký hiệu", "Số hóa đơn", "Ngày lập", "MST người bán", "Tên người bán",
    "Chưa thuế (VND)", "Thuế (VND)", "Tổng thanh toán (VND)", "Trạng thái hóa đơn",
    "Vị trí trong file", "Ghi chú",
  ];
  writeTableHeader(ws, tableStartRow, columns);
  let r = tableStartRow + 1;
  const writeDiffRow = (d: (typeof allMissing)[number], stt: number, fill?: string) => {
    const o = [
      stt, d.series, d.invoiceNumber, d.issueDate, d.sellerTaxCode, d.sellerName,
      d.preTaxVnd, d.taxVnd, d.totalVnd, d.invoiceStatus,
      `${d.sheet} dòng ${d.fileRow}`, d.nearMatchNote ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
      if (fill) cell.fill = to(fill);
    });
    r++;
  };
  toDeclare.forEach((d, i) => writeDiffRow(d, i + 1));

  // dòng cộng
  ws.getCell(r, 6).value = `CỘNG ${toDeclare.length} hóa đơn`;
  const columnTotals: [number, number][] = [
    [7, toDeclare.reduce((t, d) => t + d.preTaxVnd, 0)],
    [8, toDeclare.reduce((t, d) => t + d.taxVnd, 0)],
    [9, declaredTotal],
  ];
  for (const [c, v] of columnTotals) {
    ws.getCell(r, c).value = v;
    ws.getCell(r, c).numFmt = "#,##0";
  }
  for (let c = 1; c <= columns.length; c++) {
    ws.getCell(r, c).font = { bold: true };
    ws.getCell(r, c).border = { top: { style: "thin" } };
  }
  if (!toDeclare.length) {
    ws.getCell(tableStartRow + 1, 1).value = "Không có hóa đơn nào chưa kê.";
    ws.getCell(tableStartRow + 1, 1).font = { italic: true };
  }
  ws.autoFilter = { from: { row: tableStartRow, column: 1 }, to: { row: tableStartRow, column: columns.length } };
  r += 2;

  if (suspectedInLedger.length) {
    anchor.suspectedErrors = r;
    ws.getCell(r, 1).value = `NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN Ở SỔ — ${suspectedInLedger.length} hóa đơn (cùng MST + cùng số tiền với một dòng sổ ở mục cuối). Xác nhận rồi SỬA SỐ Ở SỔ, đừng kê thêm lần nữa.`;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FF9C6500" } };
    r++;
    writeTableHeader(ws, r, columns);
    r++;
    suspectedInLedger.forEach((d, i) => writeDiffRow(d, i + 1, SUSPECT_FILL));
    r += 1;
  }

  if (skipped.length) {
    ws.getCell(r, 1).value = `KHÔNG CẦN KÊ — ${skipped.length} hóa đơn đã bị thay thế/hủy (kế toán hạch toán bản thay thế)`;
    ws.getCell(r, 1).font = { bold: true };
    r++;
    writeTableHeader(ws, r, columns);
    r++;
    skipped.forEach((d, i) => writeDiffRow(d, i + 1, "FFE7E6E6"));
    r += 1;
  }

  // Phần 2 — chiều ngược: dòng sổ không có hóa đơn điện tử
  anchor.missingCount = r;
  ws.getCell(r, 1).value = `DÒNG SỔ KHÔNG CÓ HÓA ĐƠN ĐIỆN TỬ — ${missingRows.length} dòng (đã kê nhưng không tìm thấy hóa đơn trên cổng thuế)`;
  ws.getCell(r, 1).font = { bold: true };
  r++;
  writeTableHeader(ws, r, [
    "STT", "Ký hiệu", "Số hóa đơn", "Ngày HĐ", "MST người bán", "Tên người bán",
    "Số phiếu", "CTGS", "Tổng cộng (VND)", "", "Vị trí trong file", "Ghi chú",
  ]);
  r++;
  missingRows.forEach((d, i) => {
    const o = [
      i + 1, d.series, d.invoiceNumber, d.invoiceDate, d.sellerTaxCode, d.sellerName,
      d.voucher, d.ctgs, d.total, "", `${d.sheet} dòng ${d.fileRow}`, d.nearMatchNote ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c === 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
    });
    r++;
  });
  if (!missingRows.length) ws.getCell(r, 1).value = "Không có — mọi dòng sổ đều tìm thấy hóa đơn điện tử.";

  ws.views = [{ state: "frozen", ySplit: tableStartRow }];
  return { ws, anchors: anchor };
}

/** Sheet SO HAI BẢN — chỉ dựng khi file có cả bản thuế gửi lẫn bản tự tải. */
function buildVersionCompareSheet(wb: Workbook, num: TwoVersionResult): Worksheet {
  const ws = wb.addWorksheet(SHEET_NAMES.twoVersion);
  [26, 16, 16, 14, 40, 18, 18, 18, 16, 26, 26, 64].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  writePageTitle(ws, "SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ — bản cơ quan thuế gửi ⇄ bản tự tải", [
    `Bản THUẾ: ${num.sentSheets.join(" + ")} (${num.totals.sentCount} hóa đơn)  ·  Bản TỰ TẢI: ${num.downloadedSheets.join(" + ")} (${num.totals.downloadedCount} hóa đơn)`,
    `Ghép theo khóa MST người bán | ký hiệu | số hóa đơn. Dòng xếp theo mức độ phải xử: thiếu ở bản tự tải lên trước.`,
  ]);
  const t = num.totals;
  const summary: [string, string][] = [
    ["CHỈ bản THUẾ có — bản tự tải THIẾU", `${t.sentOnlyCount} hóa đơn · ${Math.round(t.sentOnlyAmount).toLocaleString("vi-VN")} đ`],
    ["CHỈ bản TỰ TẢI có — thuế không gửi", `${t.downloadedOnlyCount} hóa đơn · ${Math.round(t.downloadedOnlyAmount).toLocaleString("vi-VN")} đ`],
    ["Có cả hai bản nhưng LỆCH TIỀN", `${t.amountMismatchCount} hóa đơn`],
    ["Có cả hai bản, KHÔNG so được tiền (dòng lệch bố cục cột)", `${t.uncomparableCount} hóa đơn`],
    ["Khớp cả hai bản", `${t.bothCount - t.amountMismatchCount - t.uncomparableCount} hóa đơn`],
    ["Tổng tiền hai bản", `thuế ${Math.round(t.sentAmount).toLocaleString("vi-VN")} đ / tự tải ${Math.round(t.downloadedAmount).toLocaleString("vi-VN")} đ / chênh ${Math.round(t.totalAmountDiff).toLocaleString("vi-VN")} đ`],
  ];
  summary.forEach(([a, b], i) => {
    ws.getCell(4 + i, 1).value = a;
    ws.getCell(4 + i, 1).font = { bold: true };
    ws.getCell(4 + i, 2).value = b;
  });

  const rows = 4 + summary.length + 1;
  writeTableHeader(ws, rows, [
    "KẾT QUẢ", "Ký hiệu", "Số hóa đơn", "Ngày lập", "Người bán", "MST người bán",
    "Tổng TT bản THUẾ", "Tổng TT bản TỰ TẢI", "Chênh", "Vị trí bản THUẾ", "Vị trí bản TỰ TẢI", "PHẢI LÀM GÌ",
  ]);
  const label: Record<VersionPresence, string> = {
    SENT_ONLY: "BẢN TỰ TẢI THIẾU", DOWNLOADED_ONLY: "THUẾ KHÔNG GỬI", BOTH: "CÓ CẢ HAI",
  };
  num.rows.forEach((d, i) => {
    const r = rows + 1 + i;
    const o = [
      d.ben === "BOTH" ? (d.amountUncomparable ? "KHÔNG SO ĐƯỢC TIỀN" : d.amountMismatch ? "LỆCH TIỀN" : "KHỚP") : label[d.ben],
      d.series, d.invoiceNumber, d.issueDate, d.sellerName, d.sellerTaxCode,
      d.totalSent, d.totalDownloaded, d.totalDiff, d.sentLocation, d.downloadedLocation, d.note,
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v ?? null) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0.00";
      cell.alignment = { vertical: "top", wrapText: c === 4 || c >= 9 };
    });
    const fill =
      d.ben === "SENT_ONLY" ? UNMATCHED_FILL
      : d.ben === "DOWNLOADED_ONLY" ? SUSPECT_FILL
      : d.amountMismatch ? SUSPECT_FILL
      : d.amountUncomparable ? "FFE7E6E6"
      : BG_PASS;
    for (let c = 1; c <= 12; c++) ws.getCell(r, c).fill = to(fill);
  });
  ws.autoFilter = { from: { row: rows, column: 1 }, to: { row: rows, column: 12 } };
  ws.views = [{ state: "frozen", ySplit: rows }];
  return ws;
}

/** Sheet CÙNG MST + CÙNG NGÀY — lọc hóa đơn nghi trùng / nghi tách đơn. */
function buildSameDaySheet(wb: Workbook, group: readonly SameDayGroup[]): Worksheet {
  const ws = wb.addWorksheet(SHEET_NAMES.sameDay);
  [22, 14, 40, 20, 10, 20, 16, 18, 22, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const sameAmountCount = group.filter((g) => g.sameAmount).length;
  writePageTitle(ws, "HÓA ĐƠN CÙNG MỘT NHÀ CUNG CẤP, CÙNG MỘT NGÀY", [
    `${group.length} nhóm · ${group.reduce((s, g) => s + g.invoiceCount, 0)} hóa đơn. Trong đó ${sameAmountCount} nhóm có hóa đơn TRÙNG KHÍT số tiền (tô vàng) — chỗ dễ kê hai lần nhất.`,
    "Nhiều hóa đơn cùng nhà cung cấp trong một ngày KHÔNG có nghĩa là sai (xăng dầu, siêu thị…). Đây chỉ là danh sách để soát bằng mắt.",
  ]);
  writeTableHeader(ws, 5, [
    "NGHI TRÙNG", "Ngày lập", "Người bán", "MST người bán", "Số HĐ trong ngày",
    "Tổng tiền cả nhóm", "Ký hiệu", "Số hóa đơn", "Tổng thanh toán (VND)", "Vị trí · kết quả đối soát",
  ]);
  let r = 6;
  for (const g of group) {
    const lead = r;
    g.rows.forEach((d, i) => {
      const o = [
        i === 0 ? (g.sameAmount ? `CÓ — ${g.duplicateNote}` : "") : "",
        i === 0 ? g.date : "", i === 0 ? g.sellerName : "", i === 0 ? g.sellerTaxCode : "",
        i === 0 ? g.invoiceCount : "", i === 0 ? g.totalAmount : "",
        d.series, d.invoiceNumber, d.totalVnd, `${d.sheet} dòng ${d.fileRow} · ${d.conclusion}`,
      ];
      o.forEach((v, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value = (v === "" ? null : v) as never;
        if (c === 5 || c === 8) cell.numFmt = "#,##0";
        cell.alignment = { vertical: "top", wrapText: c === 0 || c === 2 || c === 9 };
      });
      if (g.sameAmount) for (let c = 1; c <= 10; c++) ws.getCell(r, c).fill = to(SUSPECT_FILL);
      r++;
    });
    // viền dưới cho hết một nhóm, nhìn ra ranh giới
    for (let c = 1; c <= 10; c++) ws.getCell(r - 1, c).border = { bottom: { style: "thin" } };
    if (lead === r) r++;
  }
  if (!group.length) {
    ws.getCell(6, 1).value = "Không có nhà cung cấp nào xuất từ 2 hóa đơn trở lên trong cùng một ngày.";
    ws.getCell(6, 1).font = { italic: true };
  }
  ws.views = [{ state: "frozen", ySplit: 5 }];
  return ws;
}

/**
 * Dựng các sheet tổng hợp và đẩy chúng lên ĐẦU workbook.
 *
 * `KẾT LUẬN CHUNG` luôn có; ba sheet danh sách CHỈ dựng khi kỳ đó có dữ liệu. Thứ
 * tự: KẾT LUẬN → chưa kê (có sổ) / so hai bản → các sheet gốc → cùng MST cùng ngày
 * (tham khảo) → nhật ký sửa.
 */
export function addSummarySheets(wb: Workbook, result: ReconciliationResult, outputColumn: OutputColumnMapper): void {
  // Chạy lại trên file đã xuất: bỏ mọi sheet tự dựng (kể cả tên cũ trước v6.4)
  // rồi dựng lại, kẻo trùng tên hoặc sót sheet cũ nằm lại.
  for (const w of [...wb.worksheets]) if (GENERATED_SHEET_NAMES.has(w.name) && w.name !== "NHẬT KÝ SỬA") wb.removeWorksheet(w.id);
  // Sheet gốc lùi về sau; sheet tổng hợp chiếm các chỗ đầu.
  wb.worksheets.forEach((w, i) => ((w as unknown as WithOrder).orderNo = 10 + i));

  const { taxSide: taxSides } = resolveTaxSideSheets(result.invoiceSheets.map((s) => s.name), result.taxSideSheets);
  const versionCompare = compareTwoInvoiceVersions(result.invoiceSheets, result.threshold, taxSides);
  const sameDayGroups = groupSameTaxCodeSameDay(result.invoiceSheets.filter((s) => !s.isSubset), taxSides);
  const unlisted = result.ledgerSheet ? buildUndeclaredSheet(wb, result) : null;
  const twoVersionSheet = versionCompare ? buildVersionCompareSheet(wb, versionCompare) : null;
  const sameDaySheet = sameDayGroups.length ? buildSameDaySheet(wb, sameDayGroups) : null;
  const { conclusion, verification } = buildConclusionSheet(wb, result, { unlisted: unlisted?.anchors ?? null, twoVersion: versionCompare, sameDay: sameDayGroups }, outputColumn);

  [conclusion, unlisted?.ws, verification, twoVersionSheet].forEach((w, i) => w && ((w as unknown as WithOrder).orderNo = i));
  // CÙNG MST CÙNG NGÀY là danh sách THAM KHẢO (nhiều hóa đơn một ngày chưa chắc
  // sai), không phải kết quả đối soát ⇒ xếp sau các sheet gốc, trước nhật ký sửa.
  if (sameDaySheet) (sameDaySheet as unknown as WithOrder).orderNo = 1000;
  const nk = wb.worksheets.find((w) => w.name === "NHẬT KÝ SỬA");
  if (nk) (nk as unknown as WithOrder).orderNo = 2000;
}
