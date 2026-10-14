/**
 * Xuất Excel đối soát **GIỮ NGUYÊN ĐỊNH DẠNG FILE GỐC**.
 *
 * Vì sao có file này: bản cũ (`exportReconciliationExcel` trong `einvoiceReconciliation.ts`) dựng
 * workbook MỚI từ giá trị, nên font / khung / định dạng số / ô gộp / độ rộng cột
 * của file cổng thuế đều biến mất — kế toán mở ra thấy một file lạ, không soi
 * song song với bản gốc được nữa.
 *
 * Cách làm ở đây: **nạp lại chính bytes file người dùng tải lên rồi sửa tại chỗ**
 * bằng `exceljs` (thư viện đọc-ghi giữ được font/khung/numFmt/merge/công thức —
 * `xlsx-js-style` chỉ giữ mỗi màu nền khi đọc). Hai nguyên tắc bất di bất dịch:
 *
 * 1. **Bố cục bám đúng file mẫu kế toán đang dùng**: chèn cột `KẾT QUẢ` làm cột A,
 *    dữ liệu gốc dời sang phải 1 cột, khối cột phân tích nằm SAU vùng dữ liệu
 *    (chừa 1 cột trống ngăn cách), và sheet `KẾT LUẬN CHUNG` đứng đầu workbook
 *    (+ sheet danh sách chỉ khi có dữ liệu — xem `reconciliationExportSummary.ts`).
 *    Chèn cột thì **bắt buộc phải dịch tham chiếu công thức** — xem `reconciliationExportShift.ts`.
 * 2. Chỉ ghi đè hai thứ trong vùng dữ liệu: **màu nền dòng** (để nhìn ra khớp/lệch/
 *    thiếu) và **ô người dùng bấm Sửa**. Font, khung, canh lề, định dạng số, ô gộp,
 *    độ rộng cột, chiều cao dòng của file gốc giữ nguyên.
 *
 * Chạy lại trên chính file đã xuất thì ghi đè đúng khối cột cũ (không đẻ thêm cột)
 * — `goCotDoiSoatCu` bên `einvoiceReconciliation.ts` lo phần gỡ khỏi dữ liệu đọc vào.
 */
import type {
  InvoiceRow,
  LedgerRow,
  ReconciliationResult,
  InvoiceSheet,
  LedgerSheet,
  SourceCellCoord,
} from "./einvoiceReconciliation";
import {
  NOTES,
  LEDGER_NOTE,
  EXPORT_COLUMN_SHIFT,
  INVOICE_EXTRA_HEADERS,
  COLUMN_SUM_CHECK_HEADERS,
  SUM_MISMATCH_LABELS,
  base64ToXlsx,
  LEDGER_EXTRA_HEADERS,
  aoaToExcelColumn,
  formatDisplayDate,
} from "./einvoiceReconciliation";
import { FILL_COLORS, columnIndexToLetter, solidFill as to, parseEditKey } from "./reconciliationCommon";
import { insertLeadingColumns, shiftCrossSheetRefs, deleteTrailingColumns } from "./reconciliationExportShift";
import { addSummarySheets } from "./reconciliationExportSummary";

// exceljs nạp động: chunk /doi-soat đã nặng, không kéo thêm vào bundle chính.
type Worksheet = import("exceljs").Worksheet;

/** 1 cột trống ngăn giữa dữ liệu gốc và khối cột đối soát. */
const SHORT_COL = 1;

/** Ô là công thức sống: `{r}` thay bằng số dòng thật lúc ghi. */
type FormulaCell = { ct: string };
const isFormula = (v: unknown): v is FormulaCell =>
  typeof v === "object" && v !== null && typeof (v as FormulaCell).ct === "string";

function toExportCell(v: unknown): string | number | null {
  if (v instanceof Date) return formatDisplayDate(v);
  if (typeof v === "number" || typeof v === "string") return v;
  if (v == null || v === "") return null;
  return String(v);
}

/**
 * Ghi khối đối soát vào một sheet CÓ SẴN của file gốc.
 * @param width  số cột dữ liệu gốc (đã trừ cột đối soát của lần chạy trước)
 */
function writeReconcileBlock(
  ws: Worksheet,
  origin: SourceCellCoord,
  hIdx: number,
  width: number,
  note: string,
  extraHeaders: readonly string[],
  row: readonly { fileRow: number; conclusion: string; fill: string | null; extra: readonly unknown[] }[],
  editedCells: readonly { fileRow: number; column: number; value: number }[],
  /** Tiêu đề cột A. */
  columnALabel = "KẾT QUẢ",
  /**
   * false = KHÔNG có cột A chèn thêm (file chỉ có bảng kê — v6.5): địa chỉ mọi ô giữ
   * nguyên như file của kế toán, chỉ nối khối kiểm ở cuối.
   */
  hasColumnA = true,
  /** Cột AOA → cột trong file ra lệch bao nhiêu (tính cả cột A cũ/mới) — để ghi ô Sửa đúng chỗ. */
  columnShift: number = EXPORT_COLUMN_SHIFT
): void {
  const D = hasColumnA ? EXPORT_COLUMN_SHIFT : 0;
  // Dữ liệu gốc đã dời sang phải D cột ⇒ khối thêm bắt đầu sau nó, chừa 1 cột trống.
  const cot1 = origin.c0 + width + D + SHORT_COL + 1; // 1-based
  const lastColumn = cot1 + extraHeaders.length - 1;
  const headerRow = origin.r0 + hIdx + 1;
  const RESULT_COL = 1; // cột "KẾT QUẢ" vừa chèn vào đầu sheet
  const firstShadedColumn = hasColumnA ? RESULT_COL : origin.c0 + 1; // tô nền từ cột này

  // --- tiêu đề: lấy dáng từ chính tiêu đề gốc để nhìn liền mạch ---
  const styleCell = ws.getCell(headerRow, origin.c0 + D + 1);
  const buildHeader = (o: ReturnType<Worksheet["getCell"]>, name: string) => {
    o.value = name;
    if (styleCell.font) o.font = { ...styleCell.font, bold: true };
    if (styleCell.border) o.border = { ...styleCell.border };
    o.alignment = { ...(styleCell.alignment ?? {}), vertical: "middle", wrapText: true };
    o.fill = to(FILL_COLORS.header);
  };
  if (hasColumnA) {
    buildHeader(ws.getCell(headerRow, RESULT_COL), columnALabel);
    ws.getColumn(RESULT_COL).width = 24;
  }
  extraHeaders.forEach((name, i) => {
    buildHeader(ws.getCell(headerRow, cot1 + i), name);
    const c = ws.getColumn(cot1 + i);
    if (!c.width) c.width = Math.min(Math.max(name.length + 2, 12), 42);
  });

  // --- chú thích màu: ô A ngay trên hàng tiêu đề (đúng chỗ file mẫu đặt) ---
  if (headerRow > 1) {
    const oCt = ws.getCell(headerRow - 1, hasColumnA ? RESULT_COL : cot1);
    if (oCt.value == null || oCt.value === "") {
      oCt.value = note;
      oCt.font = { italic: true, size: 10 };
    }
  }

  // --- từng dòng: nhãn ở cột A + giá trị khối thêm + tô nền cả dòng ---
  for (const d of row) {
    if (hasColumnA) ws.getCell(d.fileRow, RESULT_COL).value = d.conclusion;
    d.extra.forEach((v, i) => {
      const o = ws.getCell(d.fileRow, cot1 + i);
      // Công thức sống trỏ thẳng ô gốc: bấm vào là thấy số được TÍNH ra, không phải
      // số chép tay — bằng chứng file xuất không sửa số liệu của thuế.
      if (isFormula(v)) o.value = { formula: v.ct.replaceAll("{r}", String(d.fileRow)) };
      else o.value = toExportCell(v);
    });
    // nen null = dòng không có gì đáng nói ⇒ để nguyên màu gốc, mắt chỉ dừng ở dòng có vấn đề
    if (d.fill) {
      const fill = to(d.fill);
      for (let c = firstShadedColumn; c <= lastColumn; c++) ws.getCell(d.fileRow, c).fill = fill;
    }
  }

  // --- ô người dùng đã bấm Sửa: ghi đè giá trị + đánh dấu vàng để soát lại ---
  for (const e of editedCells) {
    const o = ws.getCell(e.fileRow, aoaToExcelColumn(origin, e.column) + columnShift + 1);
    o.value = e.value;
    o.fill = to(FILL_COLORS.edited);
  }

  // Bộ lọc: nới vùng lọc sẵn có sang hết khối mới, giữ nguyên ô bắt đầu.
  const autoFilter = ws.autoFilter as string | { from?: { row?: number; column?: number } } | undefined;
  const start =
    typeof autoFilter === "object" && autoFilter?.from?.row != null && autoFilter.from.column != null
      ? { row: autoFilter.from.row, column: autoFilter.from.column }
      : { row: headerRow, column: firstShadedColumn };
  ws.autoFilter = { from: start, to: { row: headerRow, column: lastColumn } };
}

const invoiceFill = (d: InvoiceRow) => (d.status === "MATCHED" ? FILL_COLORS.green : d.status === "MISMATCHED" ? FILL_COLORS.yellow : FILL_COLORS.red);

const addInvoiceRow = (d: InvoiceRow): unknown[] => [
  d.exchangeRate, d.normalizedNumber, d.key, d.preTaxVnd, d.taxVnd, d.totalVnd,
  d.ledgerMatchCount, d.ledgerTotal, d.difference, d.conclusion, d.ledgerVoucher, d.ctgs, d.postingDate,
  d.debitCreditAccounts, d.ledgerDescription, d.postedAmount, d.evidence,
];

const addLedgerRow = (d: LedgerRow): unknown[] => [
  d.normalizedNumber, d.key, d.einvoiceMatchCount, d.conclusion, d.einvoiceSource, d.einvoiceRow, d.invoiceIssueDate,
  d.einvoiceSellerName, d.einvoiceTotal, d.evidence,
];

/**
 * Tiêu đề khối cột thêm. Hai chỗ đổi theo file để trùng cách gọi của kế toán:
 * tên sheet sổ (mẫu ghi "PMEM" chứ không phải "PMKT") và cặp cột TK — sổ mã máy
 * không có TK Nợ/Có mà là thuế suất / loại.
 */
const invoiceHeader = (ledgerName: string, tenTk: string): string[] =>
  INVOICE_EXTRA_HEADERS.map((h) =>
    h === "Số dòng khớp PMKT" ? `Số dòng khớp ${ledgerName}`
    : h === "Tổng TT bên PMKT" ? `Tổng TT bên ${ledgerName}`
    : h === "TK Nợ / TK Có" ? tenTk
    : h
  );
const LEDGER_HEADER = [...LEDGER_EXTRA_HEADERS];

/**
 * Ba ô kiểm "chưa thuế + thuế = tổng thanh toán" cho một dòng, viết bằng CÔNG THỨC
 * trỏ vào chính ô gốc (đã dời sang phải `EXPORT_COLUMN_SHIFT` cột). Kế toán dò TRỰC TIẾP
 * trên sheet, không phải lật qua sheet tổng hợp.
 */
function sumCheckCells(sh: InvoiceSheet, d: InvoiceRow, shift: number): unknown[] {
  const cd = sh.columnSum;
  if (cd.preTaxColumn < 0 || cd.totalColumn < 0) return ["", "", ""];
  const A = columnIndexToLetter(aoaToExcelColumn(sh.origin, cd.preTaxColumn) + shift);
  const T = columnIndexToLetter(aoaToExcelColumn(sh.origin, cd.totalColumn) + shift);
  const sumFormula = cd.taxColumn >= 0 ? `${A}{r}+${columnIndexToLetter(aoaToExcelColumn(sh.origin, cd.taxColumn) + shift)}{r}` : `${A}{r}`;
  // exceljs tự thêm dấu "=" — đừng viết sẵn, không là ra "==N3+O3".
  return [
    { ct: sumFormula },
    { ct: `${T}{r}-(${sumFormula})` },
    d.sumMismatch ? SUM_MISMATCH_LABELS[d.sumMismatch.kind] : "",
  ];
}

/**
 * Màu dòng khi file CHỈ có bảng kê: CHỈ tô dòng có lệch (đỏ = sai thật, vàng = phí /
 * chiết khấu / làm tròn). Dòng khớp để nguyên — tô xanh 3.000 dòng thì mắt không biết dừng đâu.
 */
const shouldCheck = (d: InvoiceRow) =>
  !d.sumMismatch ? null : d.sumMismatch.kind === "real" ? FILL_COLORS.red : FILL_COLORS.yellow;

/** Các ô người dùng bấm Sửa, gom theo sheet (key `edits` = `sheet#soDong#cot`). */
function editsBySheet(
  edits: Record<string, number> | undefined,
  rowByLineNo: Map<number, number>,
  name: string
): { fileRow: number; column: number; value: number }[] {
  if (!edits) return [];
  const result: { fileRow: number; column: number; value: number }[] = [];
  for (const [k, v] of Object.entries(edits)) {
    const { sheet, rowIndex: rowNo, column: col } = parseEditKey(k);
    if (sheet !== name) continue;
    const fileRow = rowByLineNo.get(rowNo);
    if (fileRow != null && Number.isFinite(col)) result.push({ fileRow, column: col, value: v });
  }
  return result;
}

function downloadFile(bytes: ArrayBuffer, tenFile: string): void {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = tenFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Xuất workbook đối soát dựa trên **chính file gốc** (base64 người dùng đã tải lên).
 * Ném lỗi nếu không nạp được file — nơi gọi bắt lấy để lùi về bản dựng-mới.
 */
export async function exportExcelPreserveFormat(
  result: ReconciliationResult,
  originalFileB64: string,
  tenFile = "doi-soat-hddt.xlsx",
  edits?: Record<string, number>
): Promise<void> {
  // exceljs là gói CJS: tùy bundler mà nằm ở `default` hay ngay trên namespace.
  const mod = (await import("exceljs")) as unknown as Record<string, unknown>;
  const ExcelJS = ((mod.default as Record<string, unknown> | undefined)?.Workbook ? mod.default : mod) as typeof import("exceljs");
  const wb = new ExcelJS.Workbook();
  // `base64ToXlsx` đổi vỏ .xls → .xlsx: exceljs chỉ đọc được .xlsx, đưa .xls vào
  // là nó trả workbook RỖNG (không ném lỗi) rồi ta báo "không tìm thấy sheet".
  const bytes = base64ToXlsx(originalFileB64);
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  const findSheet = (name: string): Worksheet | undefined =>
    wb.worksheets.find((w) => w.name === name) ?? wb.getWorksheet(name);

  const missingSheets: string[] = [];
  for (const sh of [...result.invoiceSheets, result.ledgerSheet, ...result.extraLedgerSheets])
    if (sh && !findSheet(sh.name)) missingSheets.push(sh.name);
  if (missingSheets.length)
    throw new Error(`Không tìm thấy sheet ${missingSheets.map((t) => `"${t}"`).join(", ")} trong file gốc.`);

  // --- B1. Dọn khối cột của lần chạy trước, rồi chèn cột "KẾT QUẢ" làm cột A ---
  const sheetList = [...result.invoiceSheets, result.ledgerSheet, ...result.extraLedgerSheets].filter(
    (x): x is InvoiceSheet | LedgerSheet => !!x
  );
  // File đã qua một lần xuất thì cột A của nó ĐANG là "KẾT QUẢ": engine gỡ cột
  // đó khỏi dữ liệu đọc vào, nên `aoaToExcelColumn` của cột gốc đầu tiên lệch sẵn 1.
  // Trường hợp đó chỉ ghi đè cột A, KHÔNG chèn thêm — nếu không mỗi lần xuất lại
  // đẻ thêm một cột "KẾT QUẢ" nữa.
  const hasResultColumn = (sh: InvoiceSheet | LedgerSheet) => aoaToExcelColumn(sh.origin, 0) - sh.origin.c0 >= EXPORT_COLUMN_SHIFT;
  // File CHỈ có bảng kê (không sổ) thì KHÔNG chèn cột A (v6.5): kế toán dò theo địa
  // chỉ ô của chính họ (VD Q3049) — dời sang R3049 là họ lạc. File xuất từ bản cũ
  // đã có cột A thì GỠ nó ra để địa chỉ trở về như file gốc.
  const hasNoColumnA = !result.ledgerSheet;
  const canChen = hasNoColumnA ? [] : sheetList.filter((sh) => !hasResultColumn(sh));
  const tenChen = new Set(canChen.map((sh) => sh.name));
  const skippedNames = new Set(hasNoColumnA ? sheetList.filter(hasResultColumn).map((sh) => sh.name) : []);

  for (const sh of sheetList) {
    const ws = findSheet(sh.name)!;
    // dữ liệu gốc chiếm các cột [lech+1 … lech+rong]; mọi cột sau đó là của lần xuất trước
    const colShift = hasResultColumn(sh) ? EXPORT_COLUMN_SHIFT : 0;
    deleteTrailingColumns(ws, sh.origin.c0 + colShift + sh.width + 1);
  }
  for (const ws of wb.worksheets)
    if (tenChen.has(ws.name)) insertLeadingColumns(ws, EXPORT_COLUMN_SHIFT, tenChen);
    else if (tenChen.size) shiftCrossSheetRefs(ws, EXPORT_COLUMN_SHIFT, tenChen);
  for (const ws of wb.worksheets)
    if (skippedNames.has(ws.name)) insertLeadingColumns(ws, -EXPORT_COLUMN_SHIFT, skippedNames);
    else if (skippedNames.size) shiftCrossSheetRefs(ws, -EXPORT_COLUMN_SHIFT, skippedNames);
  /** Cột (0-based) trong FILE RA của cột AOA `c` — cho công thức kiểm + địa chỉ ở sheet kết luận. */
  const outputShift = (sh: InvoiceSheet | LedgerSheet) =>
    hasNoColumnA ? (hasResultColumn(sh) ? -EXPORT_COLUMN_SHIFT : 0) : hasResultColumn(sh) ? 0 : EXPORT_COLUMN_SHIFT;
  const outputColumn = (sh: InvoiceSheet, c: number) => aoaToExcelColumn(sh.origin, c) + outputShift(sh);

  // --- B2. Ghi khối đối soát ---
  const ledgerName = result.ledgerSheet?.name ?? "PMKT";
  const tenTk = result.ledgerSheet?.accountHeader ?? "TK Nợ / TK Có";
  // File CHỈ có bảng kê thuế, không có sheet sổ ⇒ mọi cột đối soát với sổ đều rỗng,
  // in ra chỉ tổ rối. Khi đó chuyển sang CHẾ ĐỘ KIỂM BẢNG KÊ: cột A và màu dòng nói
  // về phép kiểm "chưa thuế + thuế = tổng thanh toán", khối thêm chỉ 3 cột kiểm.
  const checkListing = !result.ledgerSheet;
  // Có sổ: cột kiểm xuống CUỐI khối, giữ nguyên thứ tự cột theo file mẫu kế toán.
  const INVOICE_HEADERS = checkListing ? [...COLUMN_SUM_CHECK_HEADERS] : [...invoiceHeader(ledgerName, tenTk), ...COLUMN_SUM_CHECK_HEADERS];

  const writeInvoiceSheet = (sh: InvoiceSheet) => {
    const ws = findSheet(sh.name)!;
    const note = checkListing
      ? `Dòng ĐỎ = chưa thuế + thuế KHÁC tổng thanh toán, phải soát · dòng VÀNG = lệch do phí / chiết khấu / làm tròn, bình thường · dòng không tô = khớp. 3 cột này là công thức tính từ ô gốc, không ô gốc nào bị sửa.`
      : sh.isSubset
        ? `${NOTES} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)`
        : NOTES;
    writeReconcileBlock(
      ws, sh.origin, sh.headerIndex, sh.width, note, INVOICE_HEADERS,
      sh.rows.map((d) => ({
        fileRow: d.fileRow,
        conclusion: checkListing ? (d.sumMismatch ? SUM_MISMATCH_LABELS[d.sumMismatch.kind] : "khớp") : d.conclusion,
        fill: checkListing ? shouldCheck(d) : invoiceFill(d),
        extra: checkListing
          ? sumCheckCells(sh, d, outputShift(sh))
          : [...addInvoiceRow(d), ...sumCheckCells(sh, d, outputShift(sh))],
      })),
      editsBySheet(edits, new Map(sh.rows.map((d) => [d.rowIndex, d.fileRow])), sh.name),
      checkListing ? "KIỂM CỘNG" : "KẾT QUẢ",
      !hasNoColumnA,
      outputShift(sh)
    );
  };

  const writeLedgerSheet = (sh: LedgerSheet) => {
    const ws = findSheet(sh.name)!;
    writeReconcileBlock(
      ws, sh.origin, sh.headerIndex, sh.width,
      sh.isSubset ? `${LEDGER_NOTE} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : LEDGER_NOTE,
      LEDGER_HEADER,
      sh.rows.map((d) => ({
        fileRow: d.fileRow,
        conclusion: d.conclusion,
        fill: d.status === "FOUND" ? FILL_COLORS.green : FILL_COLORS.red,
        extra: addLedgerRow(d),
      })),
      editsBySheet(edits, new Map(sh.rows.map((d) => [d.rowIndex, d.fileRow])), sh.name),
      "KẾT QUẢ",
      true,
      outputShift(sh)
    );
  };

  for (const sh of result.invoiceSheets) writeInvoiceSheet(sh);
  if (result.ledgerSheet) writeLedgerSheet(result.ledgerSheet);
  for (const p of result.extraLedgerSheets) writeLedgerSheet(p);

  // --- B3. Sheet phụ trợ: KẾT LUẬN CHUNG (+ danh sách có dữ liệu) lên ĐẦU, nhật ký sửa xuống cuối ---
  if (result.editLog.length) {
    const name = "NHẬT KÝ SỬA";
    const prev = findSheet(name);
    if (prev) wb.removeWorksheet(prev.id);
    const nk = wb.addWorksheet(name);
    nk.addRow(["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"]);
    nk.addRow(["Vị trí", "Giá trị cũ", "Giá trị mới"]);
    nk.getRow(2).font = { bold: true };
    nk.getRow(2).fill = to(FILL_COLORS.header);
    for (const n of result.editLog) nk.addRow([n.location, n.previous, n.next]);
    nk.columns.forEach((c, i) => (c.width = i === 0 ? 54 : 22));
    (nk as unknown as { orderNo: number }).orderNo = 99;
  }
  addSummarySheets(wb, result, (sh, c) => outputColumn(sh, c));

  // Công thức trong file đã bị dịch cột ⇒ ép Excel tính lại lúc mở, đừng tin
  // giá trị cache của lần lưu trước.
  wb.calcProperties.fullCalcOnLoad = true;

  downloadFile(await wb.xlsx.writeBuffer(), tenFile);
}
