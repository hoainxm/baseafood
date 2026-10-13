/**
 * Chèn thêm cột vào một sheet Excel mà **không làm hỏng công thức** — phần khó
 * nhất của việc xuất file giữ nguyên định dạng gốc.
 *
 * File hóa đơn cổng thuế có công thức sống (`=SUM(K7:K462)`, `=O463-L463`,
 * `='T6-KMA'!K144`). Chèn một cột ở đầu mà chỉ dời ô thì công thức vẫn trỏ cột
 * cũ ⇒ **số sai âm thầm**. Nên ở đây dời ô XONG là dịch luôn mọi tham chiếu.
 */

import { columnIndexToLetter, columnLetterToNumber } from "./reconciliationCommon";

/** Dời chữ cột `c` sang phải `dich` cột ("Q", 1 → "R"). */
const shiftColumnLetter = (c: string, shift: number): string => columnIndexToLetter(columnLetterToNumber(c) + shift - 1);

/**
 * Dịch mọi tham chiếu ô trong một công thức sang phải `dich` cột.
 *
 * Đi từng ký tự chứ không `replace` bằng regex trần, để KHÔNG đụng vào:
 * chuỗi trong nháy kép (`"KHỚP"`), tên sheet trong nháy đơn (`'T6-KMA'`), và
 * tên hàm (`SUM(`). Tham chiếu sang sheet KHÁC chỉ dịch khi sheet đó cũng bị chèn cột.
 */
export function shiftFormula(
  ct: string,
  shift: number,
  shiftedSheets: ReadonlySet<string>,
  /** Sheet chứa công thức này có bị chèn cột không — quyết định số phận tham chiếu KHÔNG ghi tên sheet. */
  isFormulaSheetShifted = true
): string {
  let ra = "";
  let i = 0;
  let isCurrentSheetShifted = isFormulaSheetShifted; // tham chiếu đang xét thuộc sheet có dịch hay không
  const n = ct.length;
  while (i < n) {
    const ch = ct[i]!;
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (ct[j] === '"') {
          if (ct[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      ra += ct.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (ct[j] === "'") {
          if (ct[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      const ten = ct.slice(i + 1, j).replace(/''/g, "'");
      ra += ct.slice(i, j + 1);
      i = j + 1;
      if (ct[i] === "!") {
        ra += "!";
        i++;
        isCurrentSheetShifted = shiftedSheets.has(ten);
      }
      continue;
    }
    const identifier = /^([A-Za-z_\\][A-Za-z0-9_.\\]*)/.exec(ct.slice(i));
    if (identifier) {
      const tok = identifier[1]!;
      if (ct[i + tok.length] === "(") {
        ra += tok; // tên hàm
        i += tok.length;
        continue;
      }
      if (ct[i + tok.length] === "!") {
        ra += `${tok}!`; // tên sheet không nháy
        i += tok.length + 1;
        isCurrentSheetShifted = shiftedSheets.has(tok);
        continue;
      }
      const o = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_])/.exec(ct.slice(i));
      if (o) {
        ra += o[1]! + (isCurrentSheetShifted ? shiftColumnLetter(o[2]!, shift) : o[2]!) + o[3]! + o[4]!;
        i += o[0].length;
        // Ô ĐẦU của vùng `Sheet!A1:B9`: nửa sau vẫn thuộc sheet đó — giữ `sheetNay`,
        // reset ngay là `HDDT!Q3:Q3047` dịch thành `R3:Q3047` (lệch vùng âm thầm).
        if (ct[i] !== ":") isCurrentSheetShifted = isFormulaSheetShifted;
        continue;
      }
      const columnMatch = /^(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![A-Za-z0-9_])/.exec(ct.slice(i));
      if (columnMatch) {
        const a = isCurrentSheetShifted ? shiftColumnLetter(columnMatch[2]!, shift) : columnMatch[2]!;
        const b = isCurrentSheetShifted ? shiftColumnLetter(columnMatch[4]!, shift) : columnMatch[4]!;
        ra += `${columnMatch[1]!}${a}:${columnMatch[3]!}${b}`;
        i += columnMatch[0].length;
        isCurrentSheetShifted = isFormulaSheetShifted;
        continue;
      }
      ra += tok;
      i += tok.length;
      continue;
    }
    if (ch !== ":" && ch !== "$") isCurrentSheetShifted = isFormulaSheetShifted;
    ra += ch;
    i++;
  }
  return ra;
}

/** Dịch một vùng kiểu `B3:T3` sang phải `dich` cột. */
export const shiftRange = (ref: string, shift: number): string =>
  ref.replace(/([A-Z]+)(\d+)/g, (_m, c: string, r: string) => `${shiftColumnLetter(c, shift)}${r}`);

type Worksheet = import("exceljs").Worksheet;

/**
 * Chèn `dich` cột trống vào TRƯỚC cột A của sheet: dời ô (kèm dáng), độ rộng cột,
 * ô gộp, vùng lọc — và dịch công thức của CHÍNH sheet này.
 *
 * Gọi `dichCongThucToanBo` sau, cho mọi sheet, để vá tham chiếu chéo sheet.
 */
/**
 * Tách công thức dùng chung (shared formula) thành công thức riêng từng ô.
 * Bắt buộc làm trước mọi thao tác thêm/bớt cột, nếu không exceljs ném lỗi
 * "Shared Formula master must exist above and or left of clone" lúc ghi.
 */
export function unshareFormulas(ws: Worksheet): void {
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as { formula?: string; sharedFormula?: string } | null;
      if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v))
        cell.value = { formula: cell.formula, result: cell.result as never };
    })
  );
}

/**
 * Xóa các cột từ `tuCot` (1-based) tới hết sheet — dùng để dọn khối cột đối soát
 * của lần chạy trước. Cắt ở ĐUÔI nên không ô nào bên trái bị dời ⇒ công thức
 * của dữ liệu gốc không cần dịch.
 */
export function deleteTrailingColumns(ws: Worksheet, fromColumn: number): void {
  const last = ws.columnCount;
  if (last < fromColumn) return;
  unshareFormulas(ws);
  ws.spliceColumns(fromColumn, last - fromColumn + 1);
}

export function insertLeadingColumns(ws: Worksheet, shift: number, shiftedSheets: ReadonlySet<string>): void {
  unshareFormulas(ws);

  const gop = Object.keys((ws as unknown as { _merges?: Record<string, unknown> })._merges ?? {}).map(
    (k) => {
      const m = (ws as unknown as { _merges: Record<string, { range?: string }> })._merges[k];
      return m?.range ?? k;
    }
  );
  const autoFilter = ws.autoFilter;

  // Gỡ ô gộp TRƯỚC khi dời cột. Gỡ sau thì vùng gộp cũ đã lệch chỗ, exceljs xóa
  // luôn giá trị của ô đã dời sang (tiêu đề "DANH SÁCH HÓA ĐƠN" biến mất).
  for (const g of gop) {
    if (!g) continue;
    try {
      ws.unMergeCells(g);
    } catch {
      /* vùng không còn — bỏ qua */
    }
  }

  // dich < 0: GỠ bớt cột đầu (file xuất từ bản cũ còn cột "KIỂM CỘNG" ở A — v6.5)
  if (shift >= 0) ws.spliceColumns(1, 0, ...Array.from({ length: shift }, () => []));
  else ws.spliceColumns(1, -shift);

  rewriteFormulas(ws, (ct) => shiftFormula(ct, shift, shiftedSheets));

  for (const g of gop) {
    if (!g) continue;
    // vùng gộp nằm (một phần) trong cột vừa gỡ thì bỏ, đừng dựng ra địa chỉ cột âm
    if (shift < 0 && /(^|:)\$?A\d/.test(g)) continue;
    try {
      ws.mergeCells(shiftRange(g, shift));
    } catch {
      /* chồng vùng khác — bỏ qua, không đáng làm hỏng cả file xuất */
    }
  }
  if (typeof autoFilter === "string") ws.autoFilter = shiftRange(autoFilter, shift);
}

/**
 * Vá tham chiếu chéo sheet cho sheet KHÔNG bị chèn cột: nó vẫn có thể trỏ sang
 * sheet bị chèn (`='T6'!K144`) nên phải dịch riêng những tham chiếu có tên sheet.
 */
export function shiftCrossSheetRefs(
  ws: Worksheet,
  shift: number,
  shiftedSheets: ReadonlySet<string>
): void {
  rewriteFormulas(ws, (ct) => shiftFormula(ct, shift, shiftedSheets, false));
}

/** Viết lại mọi ô công thức của sheet (giữ kết quả cache). */
function rewriteFormulas(ws: Worksheet, doi: (ct: string) => string): void {
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as { formula?: string; result?: unknown } | null;
      if (v && typeof v === "object" && typeof v.formula === "string")
        cell.value = { formula: doi(v.formula), result: v.result as never };
    })
  );
}
