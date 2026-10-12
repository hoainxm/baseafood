/**
 * Chèn thêm cột vào một sheet Excel mà **không làm hỏng công thức** — phần khó
 * nhất của việc xuất file giữ nguyên định dạng gốc.
 *
 * File hóa đơn cổng thuế có công thức sống (`=SUM(K7:K462)`, `=O463-L463`,
 * `='T6-KMA'!K144`). Chèn một cột ở đầu mà chỉ dời ô thì công thức vẫn trỏ cột
 * cũ ⇒ **số sai âm thầm**. Nên ở đây dời ô XONG là dịch luôn mọi tham chiếu.
 */

import { chuCotExcel, soCotExcel } from "./doiSoatChung";

/** Dời chữ cột `c` sang phải `dich` cột ("Q", 1 → "R"). */
const dichChuCot = (c: string, dich: number): string => chuCotExcel(soCotExcel(c) + dich - 1);

/**
 * Dịch mọi tham chiếu ô trong một công thức sang phải `dich` cột.
 *
 * Đi từng ký tự chứ không `replace` bằng regex trần, để KHÔNG đụng vào:
 * chuỗi trong nháy kép (`"KHỚP"`), tên sheet trong nháy đơn (`'T6-KMA'`), và
 * tên hàm (`SUM(`). Tham chiếu sang sheet KHÁC chỉ dịch khi sheet đó cũng bị chèn cột.
 */
export function dichCongThuc(
  ct: string,
  dich: number,
  sheetDaDich: ReadonlySet<string>,
  /** Sheet chứa công thức này có bị chèn cột không — quyết định số phận tham chiếu KHÔNG ghi tên sheet. */
  sheetChuaCongThucCoDich = true
): string {
  let ra = "";
  let i = 0;
  let sheetNay = sheetChuaCongThucCoDich; // tham chiếu đang xét thuộc sheet có dịch hay không
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
        sheetNay = sheetDaDich.has(ten);
      }
      continue;
    }
    const dinhDanh = /^([A-Za-z_\\][A-Za-z0-9_.\\]*)/.exec(ct.slice(i));
    if (dinhDanh) {
      const tok = dinhDanh[1]!;
      if (ct[i + tok.length] === "(") {
        ra += tok; // tên hàm
        i += tok.length;
        continue;
      }
      if (ct[i + tok.length] === "!") {
        ra += `${tok}!`; // tên sheet không nháy
        i += tok.length + 1;
        sheetNay = sheetDaDich.has(tok);
        continue;
      }
      const o = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_])/.exec(ct.slice(i));
      if (o) {
        ra += o[1]! + (sheetNay ? dichChuCot(o[2]!, dich) : o[2]!) + o[3]! + o[4]!;
        i += o[0].length;
        // Ô ĐẦU của vùng `Sheet!A1:B9`: nửa sau vẫn thuộc sheet đó — giữ `sheetNay`,
        // reset ngay là `HDDT!Q3:Q3047` dịch thành `R3:Q3047` (lệch vùng âm thầm).
        if (ct[i] !== ":") sheetNay = sheetChuaCongThucCoDich;
        continue;
      }
      const cot = /^(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![A-Za-z0-9_])/.exec(ct.slice(i));
      if (cot) {
        const a = sheetNay ? dichChuCot(cot[2]!, dich) : cot[2]!;
        const b = sheetNay ? dichChuCot(cot[4]!, dich) : cot[4]!;
        ra += `${cot[1]!}${a}:${cot[3]!}${b}`;
        i += cot[0].length;
        sheetNay = sheetChuaCongThucCoDich;
        continue;
      }
      ra += tok;
      i += tok.length;
      continue;
    }
    if (ch !== ":" && ch !== "$") sheetNay = sheetChuaCongThucCoDich;
    ra += ch;
    i++;
  }
  return ra;
}

/** Dịch một vùng kiểu `B3:T3` sang phải `dich` cột. */
export const dichVung = (ref: string, dich: number): string =>
  ref.replace(/([A-Z]+)(\d+)/g, (_m, c: string, r: string) => `${dichChuCot(c, dich)}${r}`);

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
export function boCongThucDungChung(ws: Worksheet): void {
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
export function xoaCotDuoi(ws: Worksheet, tuCot: number): void {
  const cuoi = ws.columnCount;
  if (cuoi < tuCot) return;
  boCongThucDungChung(ws);
  ws.spliceColumns(tuCot, cuoi - tuCot + 1);
}

export function chenCotDau(ws: Worksheet, dich: number, sheetDaDich: ReadonlySet<string>): void {
  boCongThucDungChung(ws);

  const gop = Object.keys((ws as unknown as { _merges?: Record<string, unknown> })._merges ?? {}).map(
    (k) => {
      const m = (ws as unknown as { _merges: Record<string, { range?: string }> })._merges[k];
      return m?.range ?? k;
    }
  );
  const loc = ws.autoFilter;

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
  if (dich >= 0) ws.spliceColumns(1, 0, ...Array.from({ length: dich }, () => []));
  else ws.spliceColumns(1, -dich);

  vietLaiCongThuc(ws, (ct) => dichCongThuc(ct, dich, sheetDaDich));

  for (const g of gop) {
    if (!g) continue;
    // vùng gộp nằm (một phần) trong cột vừa gỡ thì bỏ, đừng dựng ra địa chỉ cột âm
    if (dich < 0 && /(^|:)\$?A\d/.test(g)) continue;
    try {
      ws.mergeCells(dichVung(g, dich));
    } catch {
      /* chồng vùng khác — bỏ qua, không đáng làm hỏng cả file xuất */
    }
  }
  if (typeof loc === "string") ws.autoFilter = dichVung(loc, dich);
}

/**
 * Vá tham chiếu chéo sheet cho sheet KHÔNG bị chèn cột: nó vẫn có thể trỏ sang
 * sheet bị chèn (`='T6'!K144`) nên phải dịch riêng những tham chiếu có tên sheet.
 */
export function dichThamChieuCheoSheet(
  ws: Worksheet,
  dich: number,
  sheetDaDich: ReadonlySet<string>
): void {
  vietLaiCongThuc(ws, (ct) => dichCongThuc(ct, dich, sheetDaDich, false));
}

/** Viết lại mọi ô công thức của sheet (giữ kết quả cache). */
function vietLaiCongThuc(ws: Worksheet, doi: (ct: string) => string): void {
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as { formula?: string; result?: unknown } | null;
      if (v && typeof v === "object" && typeof v.formula === "string")
        cell.value = { formula: doi(v.formula), result: v.result as never };
    })
  );
}
