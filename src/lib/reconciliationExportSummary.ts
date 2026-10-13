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
import type { TwoVersionResult, SameDayGroup } from "./twoVersionReconciliation";
import { groupSameTaxCodeSameDay, resolveTaxSideSheets, compareTwoInvoiceVersions } from "./twoVersionReconciliation";
import { FILL_COLORS, columnIndexToLetter as chuCot, solidFill as to } from "./reconciliationCommon";

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
/** `orderNo` quyết định thứ tự tab lúc ghi — có thật lúc chạy nhưng thiếu trong .d.ts của exceljs. */
type ThuTu = { orderNo: number };

/** Tên các sheet tự dựng — phải nằm trong `GENERATED_SHEET_NAMES` để đọc lại bỏ qua, xuất lại xóa đi. */
const TEN = {
  ketLuan: "KẾT LUẬN CHUNG",
  kiemChung: "KIỂM CHỨNG",
  chuaKe: "HÓA ĐƠN CHƯA KÊ",
  haiBan: "SO HAI BẢN HĐĐT",
  cungNgay: "CÙNG MST CÙNG NGÀY",
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

const BG_HEADING = FILL_COLORS.tieuDe;
const NEN_TITLE = FILL_COLORS.title;
const BG_PASS = FILL_COLORS.xanh;
const NEN_TRUOT = FILL_COLORS.do;
const NEN_NGHI = FILL_COLORS.vang;

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
/** Địa chỉ nội bộ tới một ô, dạng `#'Sheet'!A1` — đích của hàm HYPERLINK. */
const lienKet = (sheet: string, o = "A1") => `#'${sheet.replace(/'/g, "''")}'!${o}`;
/**
 * Ô link bấm được bằng CÔNG THỨC `HYPERLINK` — không dùng kiểu link của exceljs vì nó
 * ghi lai (quan hệ ngoài + `location` còn dính dấu #), không chắc mọi bản Excel đọc đúng.
 */
const oLink = (linkTarget: string, chu: string) => {
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  return { formula: `HYPERLINK(${q(linkTarget)},${q(chu)})`, result: chu };
};

/** Cộng ba cột tiền + đếm dòng cho một tập dòng hóa đơn. */
interface SumTotals {
  chua: number;
  thue: number;
  tong: number;
  n: number;
}
const ZERO_SUM: SumTotals = { chua: 0, thue: 0, tong: 0, n: 0 };
function sum(sheets: readonly InvoiceSheet[], filter: (d: InvoiceSheet["dong"][number]) => boolean): SumTotals {
  const r = { ...ZERO_SUM };
  for (const sh of sheets)
    for (const d of sh.dong)
      if (filter(d)) {
        r.chua += d.chuaThueVnd;
        r.thue += d.thueVnd;
        r.tong += d.tongTtVnd;
        r.n++;
      }
  return r;
}

/** Cộng ba cột tiền + đếm dòng cho các dòng SỔ thỏa điều kiện. */
function sumLedger(kq: ReconciliationResult, filter: (d: NonNullable<ReconciliationResult["sheetPhanMem"]>["dong"][number]) => boolean = () => true): SumTotals {
  const r = { ...ZERO_SUM };
  for (const d of kq.sheetPhanMem?.dong ?? [])
    if (filter(d)) {
      r.chua += d.chuaThue;
      r.thue += d.thue;
      r.tong += d.tongCong;
      r.n++;
    }
  return r;
}

/** Bỏ ô SỐ DÒNG: dòng suy ra (hiệu/tổng) thì đếm dòng vô nghĩa. */
const withoutCount = (c: SumTotals): SumTotals => ({ ...c, n: 0 });
const am = (c: SumTotals): SumTotals => ({ chua: -c.chua, thue: -c.thue, tong: -c.tong, n: -c.n });
const subtract = (a: SumTotals, b: SumTotals): SumTotals => ({
  chua: a.chua - b.chua,
  thue: a.thue - b.thue,
  tong: a.tong - b.tong,
  n: a.n - b.n,
});

function writeTableHeader(ws: Worksheet, hang: number, columns: readonly string[]): void {
  columns.forEach((t, i) => {
    const o = ws.getCell(hang, i + 1);
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
  o.fill = to(NEN_TITLE);
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
function oChu(ws: Worksheet, r: number, c1: number, c2: number, v: CellValue, font?: Font, nen?: string): number {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
  const o = ws.getCell(r, c1);
  o.value = v as never;
  o.alignment = { vertical: "top", wrapText: true };
  if (font) o.font = font;
  if (typeof v === "number") o.numFmt = "#,##0";
  if (nen) for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = to(nen);
  const width = EMPTY_MARKS.slice(c1 - 1, c2).reduce((a, b) => a + b, 0);
  const chu = typeof v === "string" ? v : v && typeof v === "object" ? v.result : String(v ?? "");
  return chu.split("\n").reduce((n, x) => n + Math.max(1, Math.ceil((x.length * 1.1) / width)), 0);
}
const setRowHeight = (ws: Worksheet, r: number, rowCount: number) => (ws.getRow(r).height = Math.max(15, rowCount * 15));

/** Một câu gộp hết chiều ngang. */
function cau(ws: Worksheet, r: number, v: CellValue, font?: Font, nen?: string): number {
  setRowHeight(ws, r, oChu(ws, r, 1, HET, v, font, nen));
  return r + 1;
}

/** Tiêu đề bảng: mỗi phần tử là [chữ, số cột chiếm]. */
function writeHeaderSpans(ws: Worksheet, r: number, columns: readonly (readonly [string, number])[]): void {
  let c = 1;
  let cao = 1;
  for (const [ten, width] of columns) {
    cao = Math.max(cao, oChu(ws, r, c, c + width - 1, ten, { bold: true }, BG_HEADING));
    for (let k = c; k < c + width; k++)
      ws.getCell(r, k).border = {
        left: { style: "thin" }, right: { style: "thin" }, top: { style: "thin" }, bottom: { style: "thin" },
      };
    c += width;
  }
  setRowHeight(ws, r, cao);
}

/** Một hàng dữ liệu theo đúng bố cục cột của `tieuDe8`. */
function hang8(ws: Worksheet, r: number, columns: readonly (readonly [CellValue, number])[], nen?: string, bold = false): void {
  let c = 1;
  let cao = 1;
  for (const [v, width] of columns) {
    const la = typeof v === "object" && v !== null;
    cao = Math.max(cao, oChu(ws, r, c, c + width - 1, v, la ? { color: { argb: "FF0563C1" }, underline: true, bold: bold } : bold ? { bold: true } : undefined, nen));
    c += width;
  }
  setRowHeight(ws, r, cao);
}

function writeBlockTitle(ws: Worksheet, r: number, ten: string): number {
  return cau(ws, r, ten, { bold: true, size: 13, color: { argb: "FF17529C" } });
}

/** Một dòng chỉ tiêu ở khối SỐ LIỆU ĐỐI CHIẾU. */
type CriterionRow = [string, SumTotals | null, string, string, boolean?];

function criteriaTable(ws: Worksheet, fromRow: number, dong: readonly CriterionRow[]): number {
  let r = fromRow;
  for (const [ten, so, source, cach, bold] of dong) {
    if (ten === "") {
      r++;
      continue;
    }
    hang8(ws, r, [
      [ten, 1],
      [so ? so.chua : null, 1], [so ? so.thue : null, 1], [so ? so.tong : null, 1],
      [so && so.n !== 0 ? so.n : null, 1],
      [source, 2], [cach, 1],
    ], undefined, bold);
    r++;
  }
  return r;
}

/** Khối SỐ LIỆU ĐỐI CHIẾU VỚI SỔ (trước v6.4 là sheet `ĐỐI CHIẾU TỔNG`) — chỉ khi có sổ. */
function writeCompareBlock(ws: Worksheet, r0: number, kq: ReconciliationResult): number {
  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const ledgerName = kq.sheetPhanMem?.ten ?? "";
  const A = sum(hd, () => true);
  const K = sum(hd, (d) => d.trangThai === "KHOP");
  const L = sum(hd, (d) => d.trangThai === "LECH");
  const T = sum(hd, (d) => d.trangThai === "THIEU");
  // Tách riêng phần "chưa vào sổ nhưng ĐÚNG là không cần vào sổ" (hóa đơn đã bị
  // thay thế/hủy) — không đổi nhóm đếm, chỉ cho kế toán biết phải rà bao nhiêu thật.
  const Tkhong = sum(hd, (d) => d.trangThai === "THIEU" && d.khongCanVaoSo);
  const checkDiff = subtract(A, { chua: K.chua + L.chua + T.chua, thue: K.thue + L.thue + T.thue, tong: K.tong + L.tong + T.tong, n: K.n + L.n + T.n });

  const B = sumLedger(kq);
  const Bco = sumLedger(kq, (d) => d.trangThai === "CO");
  const Bthieu = sumLedger(kq, (d) => d.trangThai === "THIEU");

  const unlisted = subtract(subtract(A, K), L);
  const calcDiff = subtract(unlisted, T);
  const crossSubtract = subtract(A, Bco);
  const crossDiff = subtract(crossSubtract, unlisted);
  const crossCheck = subtract({ chua: K.chua + L.chua, thue: K.thue + L.thue, tong: K.tong + L.tong, n: 0 }, Bco);
  let diffColumnTotal = 0;
  for (const sh of hd) for (const d of sh.dong) if (d.chenh != null) diffColumnTotal += d.chenh;

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
    ['   Kiểm chứng tiếp: tổng cột "Chênh lệch"', { chua: 0, thue: 0, tong: diffColumnTotal, n: 0 }, 'Cộng cột "Chênh lệch" của các sheet.', "Chỉ áp dụng cho cột Tổng thanh toán."],
  ]);

  if (kq.cauNoi.bocTach.length) {
    r = cau(ws, r + 1, "BÓC TÁCH PHẦN CHÊNH — đến từ những hóa đơn nào", { bold: true });
    writeHeaderSpans(ws, r, [["HÓA ĐƠN / LÝ DO", 3], ["SỐ TIỀN", 1], ["", 4]]);
    r++;
    for (const b of kq.cauNoi.bocTach) hang8(ws, r++, [[b.mo, 3], [b.tien, 1], ["", 4]]);
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
  ten: string;
  tien: number;
  loai: "that" | "phi" | "chietKhau" | "lamTron" | "khac";
  phaiSua: string;
}

/** Con số kế toán đang nhìn + các phần cộng lại đúng bằng nó. */
function analyzeMismatch(sh: InvoiceSheet): { V: number; phan: DiffPart[] } {
  const cd = sh.canDoiCot;
  const o = cd.oTuDat;
  const includeFees = o?.congPhi ?? false;
  const deductDiscount = o?.truCk ?? false;
  const V = cd.lech - (includeFees ? cd.sumPhi : 0) + (deductDiscount ? cd.sumCk : 0);
  const parts: DiffPart[] = [
    { ten: "Hóa đơn ghi SAI tiền (chưa thuế + thuế khác tổng thanh toán)", tien: cd.boc.lechThat, loai: "that", phaiSua: "CÓ — xem bảng DÒNG PHẢI SỬA ngay dưới." },
    { ten: includeFees ? "Phí không khớp cột phí" : "Phí — công thức chưa cộng cột phí", tien: cd.boc.phi - (includeFees ? cd.sumPhi : 0), loai: "phi", phaiSua: "Không — phí là một phần hợp lệ của tổng thanh toán." },
    { ten: deductDiscount ? "Chiết khấu không khớp cột chiết khấu" : "Chiết khấu — công thức chưa trừ cột chiết khấu", tien: cd.boc.chietKhau + (deductDiscount ? cd.sumCk : 0), loai: "chietKhau", phaiSua: "Không — chiết khấu hợp lệ. Muốn ô tổng về đúng thì công thức trừ thêm cột chiết khấu." },
    { ten: "Làm tròn 1 đồng của bên bán", tien: cd.boc.lamTron, loai: "lamTron", phaiSua: "Không — sai số làm tròn trên hóa đơn." },
  ].filter((p) => Math.abs(p.tien) > 0.5) as DiffPart[];
  const con = V - parts.reduce((t, p) => t + p.tien, 0);
  if (Math.abs(con) > 0.5)
    parts.push({ ten: "Phí / chiết khấu ghi ở cột nhưng không nằm trong tổng thanh toán", tien: con, loai: "khac", phaiSua: "Soát các dòng có phí/chiết khấu ở bảng dưới." });
  return { V, phan: parts };
}

const formatAmount = (n: number) => Math.round(n).toLocaleString("vi-VN");

/** Câu trả lời một dòng cho một sheet — đặt ở bảng TRẢ LỜI đầu trang. */
function columnSumAnswer(sh: InvoiceSheet, outputColumn: OutputColumnMapper): { cau: string; sai: boolean } {
  const cd = sh.canDoiCot;
  const { V, phan } = analyzeMismatch(sh);
  const wrongRows = cd.dongLech.filter((d) => d.loai === "that");
  if (!wrongRows.length && Math.abs(V) <= 0.5)
    return { cau: `Khớp — chưa thuế + thuế bằng tổng thanh toán${cd.dongLech.length ? " (lệch từng dòng chỉ do phí/chiết khấu/làm tròn, bình thường)" : ""}.`, sai: false };
  const o = cd.oTuDat;
  const dau = o ? `Ô ${chuCot(outputColumn(sh, o.cot))}${o.dongFile} = ${formatAmount(o.giaTri)} đ` : `Cộng cả cột lệch ${formatAmount(V)} đ`;
  const errorLocation = wrongRows.length
    ? `do ${wrongRows.length} hóa đơn ghi sai tiền ở ${wrongRows.length <= 3 ? wrongRows.map((d) => `dòng ${d.dongFile}`).join(", ") : `${wrongRows.length} dòng (danh sách bên dưới)`} (${formatAmount(cd.boc.lechThat)} đ)`
    : "KHÔNG có hóa đơn nào ghi sai";
  const extraParts = phan
    .filter((p) => p.loai !== "that")
    .map((p) => `${p.tien < 0 ? "trừ" : "cộng"} ${p.loai === "phi" ? "phí" : p.loai === "chietKhau" ? "chiết khấu" : p.loai === "lamTron" ? "làm tròn" : "phần phí/chiết khấu khác"} ${formatAmount(Math.abs(p.tien))} đ`);
  return { cau: `${dau}: ${errorLocation}${extraParts.length ? `, ${extraParts.join(", ")}` : ""}.`, sai: wrongRows.length > 0 };
}

/** Khối dò lệch của MỘT sheet. */
function writeDiffBlock(ws: Worksheet, r0: number, sh: InvoiceSheet, outputColumn: OutputColumnMapper): number {
  const cd = sh.canDoiCot;
  const columns = (c: number) => (c >= 0 ? chuCot(outputColumn(sh, c)) : "");
  const oCua = (c: number, dong: number) => (c >= 0 ? `${columns(c)}${dong}` : "");
  const { V, phan } = analyzeMismatch(sh);
  const o = cd.oTuDat;
  const cellAddress = o ? `${columns(o.cot)}${o.dongFile}` : "";

  let r = writeBlockTitle(ws, r0, `SHEET ${sh.ten} — ${o ? `ô ${cellAddress} = ${formatAmount(o.giaTri)} đ` : `cộng cả cột lệch ${formatAmount(V)} đ`}`);
  const colLabel = (c: number, ten: string) => (c >= 0 ? `${ten} (cột ${columns(c)})` : "");
  const calcExplanation = o
    ? `Ô ${cellAddress} là ô tự tính ở cuối sheet: tổng cột tổng thanh toán (${columns(cd.cotTong)}) trừ đi tổng ${[colLabel(cd.cotChua, "chưa thuế"), colLabel(cd.cotThue, "thuế"), o.congPhi ? colLabel(cd.cotPhi, "phí") : ""].filter(Boolean).join(" + ")}${o.truCk ? `, rồi cộng lại chiết khấu (cột ${columns(cd.cotCk)})` : ""}.${o.dau < 0 ? " Ô tính ngược chiều nên mang dấu âm; bảng dưới dùng số dương." : ""}`
    : `Tổng cột tổng thanh toán (${columns(cd.cotTong)}) trừ đi tổng ${[colLabel(cd.cotChua, "chưa thuế"), colLabel(cd.cotThue, "thuế")].filter(Boolean).join(" + ")}.`;
  r = cau(ws, r, calcExplanation, { italic: true });
  r = cau(ws, r, `Số ${formatAmount(V)} đ này gồm ${phan.length} phần dưới đây, cộng lại đúng bằng nó:`, { bold: true });

  // --- các phần cộng lại ra đúng con số ---
  const wrongRows = cd.dongLech.filter((d) => d.loai === "that");
  const khac = cd.dongLech.filter((d) => d.loai !== "that");
  const lineLocations = (kind: DiffPart["loai"]): CellValue => {
    const ds = cd.dongLech.filter((d) => d.loai === kind);
    if (!ds.length) return "";
    if (ds.length === 1) return oLink(lienKet(sh.ten, oCua(cd.cotChua, ds[0]!.dongFile)), `dòng ${ds[0]!.dongFile} (bấm để tới)`);
    return `${ds.length} dòng: ${ds.slice(0, 8).map((d) => d.dongFile).join(", ")}${ds.length > 8 ? "…" : ""} — xem bảng dưới`;
  };
  writeHeaderSpans(ws, r++, [["PHẦN LỆCH", 1], ["SỐ TIỀN (đ)", 1], ["SỐ DÒNG", 1], ["Ở DÒNG NÀO", 4], ["CÓ PHẢI SỬA KHÔNG", 1]]);
  for (const p of phan) {
    const n = p.loai === "khac" ? "" : cd.dongLech.filter((d) => d.loai === p.loai).length;
    hang8(ws, r++, [[p.ten, 1], [p.tien, 1], [n, 1], [p.loai === "khac" ? "" : lineLocations(p.loai), 4], [p.phaiSua, 1]], p.loai === "that" ? NEN_TRUOT : undefined, p.loai === "that");
  }
  const total = phan.reduce((t, p) => t + p.tien, 0);
  hang8(ws, r++, [["CỘNG", 1], [total, 1], ["", 1], [o ? `= đúng ô ${cellAddress} ✓` : "= đúng số lệch khi cộng cả cột ✓", 4], ["", 1]], BG_PASS, true);
  if (o?.congPhi && cd.sumPhi)
    r = cau(ws, r, `Phí ${formatAmount(cd.sumPhi)} đ (${cd.soDong.phi} dòng) đã được công thức của ô ${cellAddress} cộng vào nên không gây lệch. Các dòng đó vẫn liệt kê ở bảng cuối để cộng lại cho đủ.`, { italic: true });
  r++;

  // --- từng dòng, có địa chỉ ô ---
  const writeRowHeader = () =>
    writeHeaderSpans(ws, r++, [
      ["DÒNG (bấm để tới)", 1], ["KÝ HIỆU – SỐ HĐ", 1], ["NGÀY LẬP", 1],
      [cd.cotChua >= 0 ? `CHƯA THUẾ (cột ${columns(cd.cotChua)})` : "CHƯA THUẾ", 1],
      [cd.cotThue >= 0 ? `THUẾ (cột ${columns(cd.cotThue)})` : "THUẾ", 1],
      [cd.cotTong >= 0 ? `TỔNG TT (cột ${columns(cd.cotTong)})` : "TỔNG TT", 1],
      ["LỆCH = TỔNG TT − (CHƯA THUẾ + THUẾ)", 1],
      ["NGƯỜI BÁN · GIẢI THÍCH", 1],
    ]);
  const writeDiffRow = (d: (typeof cd.dongLech)[number], explanation: string, nen?: string) =>
    hang8(ws, r++, [
      [oLink(lienKet(sh.ten, oCua(cd.cotChua, d.dongFile)), `${sh.ten} dòng ${d.dongFile}`), 1],
      [d.ma, 1], [d.ngay, 1], [d.chua, 1], [d.thue, 1], [d.tong, 1], [d.lech, 1],
      [`${d.ban}\n${explanation}`, 1],
    ], nen);
  const MAX_ROWS = 300;

  if (wrongRows.length) {
    r = cau(ws, r, `DÒNG PHẢI SỬA — ${wrongRows.length} hóa đơn ghi tiền không khớp nhau`, { bold: true, color: { argb: "FF9C0006" } });
    writeRowHeader();
    for (const d of wrongRows.slice(0, MAX_ROWS)) {
      const expectedPreTax = d.tong - d.thue - d.phi + d.ck;
      const correctTotal = d.chua + d.thue + d.phi - d.ck;
      writeDiffRow(
        d,
        `Chưa thuế + thuế${d.phi ? " + phí" : ""}${d.ck ? " − chiết khấu" : ""} = ${formatAmount(correctTotal)} nhưng tổng thanh toán ghi ${formatAmount(d.tong)}. ` +
          `Nếu tổng thanh toán đúng thì ô chưa thuế ${oCua(cd.cotChua, d.dongFile)} phải là ${formatAmount(expectedPreTax)}; ` +
          `nếu chưa thuế đúng thì ô tổng ${oCua(cd.cotTong, d.dongFile)} phải là ${formatAmount(correctTotal)}. Mở hóa đơn gốc để biết ô nào gõ sai.`,
        NEN_TRUOT
      );
    }
    if (wrongRows.length > MAX_ROWS) r = cau(ws, r, `… còn ${wrongRows.length - MAX_ROWS} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.ten}.`, { italic: true });
    r++;
  }
  if (khac.length) {
    r = cau(ws, r, `DÒNG LỆCH BÌNH THƯỜNG — ${khac.length} dòng, không phải sửa (liệt kê để cộng lại cho đủ)`, { bold: true });
    writeRowHeader();
    const reasonOf = (d: (typeof khac)[number]) =>
      d.loai === "phi" ? `Có phí ${formatAmount(d.phi)} đ${cd.cotPhi >= 0 ? ` (ô ${oCua(cd.cotPhi, d.dongFile)})` : ""} — tổng thanh toán đã gồm phí.`
      : d.loai === "chietKhau" ? `Chiết khấu ${formatAmount(d.ck)} đ${cd.cotCk >= 0 ? ` (ô ${oCua(cd.cotCk, d.dongFile)})` : ""} — tổng thanh toán đã trừ chiết khấu.`
      : "Làm tròn 1 đồng của bên bán.";
    for (const d of khac.slice(0, MAX_ROWS)) writeDiffRow(d, reasonOf(d), NEN_NGHI);
    if (khac.length > MAX_ROWS) r = cau(ws, r, `… còn ${khac.length - MAX_ROWS} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.ten}.`, { italic: true });
  }
  return r + 1;
}

/** Khối CHỖ CẦN SOÁT LẠI (trước v6.4 là sheet `NGHI VẤN SỐ LIỆU`) — chỉ khi có. */
function writeSuspectBlock(ws: Worksheet, r0: number, kq: ReconciliationResult): number {
  const hasLedger = !!kq.sheetPhanMem;
  let r = writeBlockTitle(ws, r0, `CHỖ CẦN SOÁT LẠI — ${kq.nghiVan.length + kq.nghiVanGop.length} ô nghi sai số liệu (máy KHÔNG tự sửa ô nào)`);
  writeHeaderSpans(ws, r++, [["VỊ TRÍ (trong chính file này)", 1], ["SỐ ĐANG CÓ", 1], ["SỐ ĐỐI CHỨNG", 1], ["NHÓM", 2], ["SAI Ở CHỖ NÀO", 2], ["ẢNH HƯỞNG · AI LÀM GÌ", 1]]);
  kq.nghiVan.forEach((nv, i) =>
    hang8(ws, r++, [
      // file không sổ KHÔNG chèn cột A (v6.5) ⇒ địa chỉ theo file gốc
      [`${i + 1}. ${hasLedger ? (nv.viTriXuat ?? nv.viTri) : nv.viTri}`, 1], [nv.soDangCo, 1], [nv.soDoiChung, 1],
      [`Nhóm ${nv.nhom} · ${GROUP_NAMES[nv.nhom] ?? ""}`, 2],
      [`${nv.saiOCho}\nSố đối chứng lấy từ: ${nv.nguonDoiChung}`, 2],
      [`${nv.anhHuong}\n→ ${nv.giaTriDung != null
        ? "Máy suy được số đúng — bấm Sửa trên màn hình nếu xác nhận, giá trị cũ vẫn giữ ở sheet NHẬT KÝ SỬA."
        : "Không suy được số đúng — hỏi lại người bán hoặc xin lại bản xuất gốc từ cổng thuế."}`, 1],
    ])
  );
  kq.nghiVanGop.forEach((g, i) =>
    hang8(ws, r++, [
      [`${kq.nghiVan.length + i + 1}. ${g.ten}`, 1], [`${g.soDong} dòng`, 1], [vnd(g.tongTien), 1],
      [`Nhóm ${g.nhom} · ${GROUP_NAMES[g.nhom] ?? ""}`, 2],
      [`${g.canhBao}\n(gộp thống kê — chi tiết từng dòng xem trên màn hình)`, 2],
      ["Soát theo cảnh báo rồi xác nhận bản chốt.", 1],
    ])
  );
  return r;
}

/** Khối TỰ KIỂM TRA — bằng chứng máy tự chấm, đứng CUỐI. */
function writeSelfCheckBlock(ws: Worksheet, r0: number, kq: ReconciliationResult): number {
  const passedCount = kq.phepThu.filter((p) => p.dat).length;
  const total = kq.phepThu.length;
  let r = writeBlockTitle(ws, r0, `MÁY TỰ KIỂM TRA — ${total} phép thử chấm lúc xuất file`);
  r = cau(ws, r, passedCount === total ? `ĐẠT TẤT CẢ ${passedCount}/${total}` : `CÓ ${total - passedCount} PHÉP CHƯA ĐẠT (${passedCount}/${total}) — soát trước khi tin con số tổng`, { bold: true }, passedCount === total ? BG_PASS : NEN_TRUOT);
  writeHeaderSpans(ws, r++, [["NỘI DUNG PHÉP THỬ", 1], ["KỲ VỌNG", 1], ["KẾT QUẢ", 1], ["ĐÁNH GIÁ", 1], ["PHÉP THỬ NÀY BẮT LỖI GÌ", 4]]);
  for (const p of kq.phepThu) {
    hang8(ws, r, [[p.ten, 1], [p.mong, 1], [p.thuc, 1], [p.dat ? "ĐẠT" : "KHÔNG ĐẠT", 1], [p.batLoiGi, 4]]);
    ws.getCell(r, 4).fill = to(p.dat ? BG_PASS : NEN_TRUOT);
    r++;
  }
  return r;
}

/** Một câu trả lời ở đầu sheet KẾT LUẬN CHUNG. */
interface TraLoi {
  viec: string;
  ketLuan: string;
  /** Chỗ xem tiếp: sheet khác (+ ô) hoặc một khối ngay trong sheet này. */
  xem?: { chu: string; sheet?: string; o?: string; khoi?: string };
  lamGi: string;
  muc: "do" | "vang" | "xanh";
}

/** Mốc dòng trong sheet HÓA ĐƠN CHƯA KÊ — để link nhảy thẳng tới đúng mục. */
interface UnlistedAnchors {
  nghiSaiSo?: number;
  soThieu?: number;
}

/**
 * SO TỔNG 2 FILE (bản GỌN cho sheet KẾT LUẬN): chỉ 3 dòng — tổng hóa đơn điện tử,
 * tổng sổ, chênh — đủ 3 cột trước thuế/thuế/tổng. Chi tiết cách tính + tự kiểm đẩy
 * sang sheet KIỂM CHỨNG (khối `khoiDoiChieu`).
 */
function writeSummaryBlock(ws: Worksheet, r0: number, kq: ReconciliationResult): number {
  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const A = sum(hd, () => true);
  const B = sumLedger(kq);
  const chenh = subtract(A, B);
  const ledgerName = kq.sheetPhanMem?.ten ?? "PMEM";
  const r = writeBlockTitle(ws, r0, `SO TỔNG 2 FILE — HÓA ĐƠN ĐIỆN TỬ ⇄ SỔ "${ledgerName}"`);
  writeHeaderSpans(ws, r, [["CHỈ TIÊU", 1], ["TRƯỚC THUẾ", 1], ["THUẾ", 1], ["TỔNG THANH TOÁN", 1], ["SỐ DÒNG", 1], ["NGUỒN SỐ LIỆU", 2], ["CÁCH TỰ KIỂM TRA LẠI", 1]]);
  return criteriaTable(ws, r + 1, [
    [`A. Hóa đơn điện tử (${hd.map((s) => s.ten).join(" + ")})`, A, "Cộng 3 cột tiền của các sheet hóa đơn.", "Bôi đen cột, đọc ô Sum dưới thanh trạng thái.", true],
    [`B. Sổ kế toán "${ledgerName}"`, B, "Cộng tiền hàng + tiền thuế của mọi dòng sổ.", "Bôi đen cột tổng cộng của sổ.", true],
    ["Chênh A − B", chenh, `Chủ yếu là hóa đơn CHƯA KÊ vào sổ — xem sheet ${TEN.chuaKe}.`, `Bóc tách đầy đủ + 9 phép tự kiểm ở sheet ${TEN.kiemChung}.`],
  ]);
}

/**
 * Dựng HAI sheet: KẾT LUẬN CHUNG (chỉ VIỆC PHẢI LÀM + SO TỔNG gọn) và KIỂM CHỨNG
 * (số liệu đối chiếu đầy đủ, bóc tách, cân đối cột, ô nghi sai, 9 phép tự kiểm).
 * Tách 2 sheet để kế toán mở KẾT LUẬN là thấy ngay việc phải làm, không bị chôn giữa
 * phần chứng minh. `ds` cho biết sheet danh sách nào THẬT SỰ được dựng (để chỉ đường).
 */
function sheetKetLuan(
  wb: Workbook,
  kq: ReconciliationResult,
  ds: { chuaKe: UnlistedAnchors | null; haiBan: TwoVersionResult | null; cungNgay: readonly SameDayGroup[] },
  outputColumn: OutputColumnMapper
): { ketLuan: Worksheet; kiemChung: Worksheet } {
  const ws = wb.addWorksheet(TEN.ketLuan);
  EMPTY_MARKS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const phu = kq.sheetsHoaDon.filter((s) => s.laPhu);
  const hasLedger = !!kq.sheetPhanMem;
  const ledgerName = kq.sheetPhanMem?.ten ?? "";
  const tenHd = hd.map((s) => `"${s.ten}"`).join(", ");
  const dong = hd.flatMap((s) => s.dong);
  // Sheet có gì để dò lệch cộng cột (lệch khác 0 hoặc có dòng ghi sai).
  const canDo = hd.filter((s) => s.canDoiCot.dongLech.some((d) => d.loai === "that") || Math.abs(analyzeMismatch(s).V) > 0.5);

  // --- Câu trả lời. Thứ tự theo việc chính của file: có sổ ⇒ chưa kê; hai bản ⇒ so
  // hai bản; chỉ bảng kê ⇒ cộng cột. Tự kiểm luôn cuối. ---
  const traLoi: TraLoi[] = [];
  const columnSums: TraLoi[] = hd.map((s) => {
    const t = columnSumAnswer(s, outputColumn);
    const hasBlock = canDo.includes(s);
    return {
      viec: `Sheet ${s.ten}: chưa thuế + thuế có bằng tổng thanh toán?`,
      ketLuan: t.cau,
      xem: hasBlock ? { chu: `Chi tiết sheet ${s.ten} bên dưới`, khoi: `doLech:${s.ten}` } : undefined,
      lamGi: t.sai ? "Sửa các dòng tô đỏ theo bảng DÒNG PHẢI SỬA (có ghi rõ ô nào, số đúng là bao nhiêu)." : "",
      muc: t.sai ? "do" : hasBlock ? "vang" : "xanh",
    };
  });

  if (!hasLedger && !ds.haiBan) traLoi.push(...columnSums);

  if (hasLedger) {
    const thieu = dong.filter((d) => d.trangThai === "THIEU");
    const toDeclare = thieu.filter((d) => !d.khongCanVaoSo && !d.ganKhopMoTa);
    const suspected = thieu.filter((d) => !d.khongCanVaoSo && d.ganKhopMoTa);
    const skipped = thieu.filter((d) => d.khongCanVaoSo);
    traLoi.push({
      viec: `Hóa đơn chưa kê vào sổ "${ledgerName}"`,
      ketLuan: toDeclare.length
        ? `${toDeclare.length} hóa đơn · ${vnd(toDeclare.reduce((t, d) => t + d.tongTtVnd, 0))} chưa có trong sổ.${skipped.length ? ` Đã loại ${skipped.length} hóa đơn bị thay thế/hủy (không cần kê).` : ""}`
        : `Không có — mọi hóa đơn cần kê đều đã vào sổ.${skipped.length ? ` (${skipped.length} hóa đơn bị thay thế/hủy — đúng là không vào sổ.)` : ""}`,
      xem: ds.chuaKe ? { chu: `Sheet ${TEN.chuaKe}`, sheet: TEN.chuaKe } : undefined,
      lamGi: toDeclare.length ? "Kê bổ sung vào sổ theo danh sách (đã xếp theo ngày lập, có dòng cộng)." : "",
      muc: toDeclare.length ? "do" : "xanh",
    });
    if (suspected.length)
      traLoi.push({
        viec: "Nghi đã kê nhưng gõ sai số hóa đơn ở sổ",
        ketLuan: `${suspected.length} hóa đơn cùng MST + cùng số tiền với một dòng sổ không ghép được.`,
        xem: ds.chuaKe?.nghiSaiSo ? { chu: `${TEN.chuaKe} · mục tô vàng`, sheet: TEN.chuaKe, o: `A${ds.chuaKe.nghiSaiSo}` } : undefined,
        lamGi: "Xác nhận rồi SỬA SỐ Ở SỔ — đừng kê thêm lần nữa.",
        muc: "vang",
      });
    const amountMismatches = dong.filter((d) => d.ketLuan === "LỆCH TIỀN");
    const amountMismatchSheets = hd.filter((s) => s.dong.some((d) => d.ketLuan === "LỆCH TIỀN"));
    traLoi.push({
      viec: "Hóa đơn đã vào sổ nhưng LỆCH TIỀN (tổng thanh toán)",
      ketLuan: amountMismatches.length
        ? `${amountMismatches.length} hóa đơn · chênh ${vnd(amountMismatches.reduce((t, d) => t + (d.chenh ?? 0), 0))}.`
        : "Không có — hóa đơn nào đã vào sổ đều khớp tổng thanh toán.",
      xem: amountMismatchSheets.length
        ? { chu: `Lọc cột A = "LỆCH TIỀN" ở sheet ${amountMismatchSheets.map((s) => s.ten).join(", ")}`, sheet: amountMismatchSheets[0]!.ten }
        : undefined,
      lamGi: amountMismatches.length ? 'Soát cột "Chênh lệch" và "BẰNG CHỨNG ĐỐI CHIẾU" trên chính dòng đó.' : "",
      muc: amountMismatches.length ? "do" : "xanh",
    });
    const lechThue = dong.filter((d) => d.ketLuan === "LỆCH THUẾ");
    const sheetLechThue = hd.filter((s) => s.dong.some((d) => d.ketLuan === "LỆCH THUẾ"));
    traLoi.push({
      viec: "Hóa đơn KHỚP tổng nhưng LỆCH THUẾ",
      ketLuan: lechThue.length
        ? `${lechThue.length} hóa đơn: tổng thanh toán đúng nhưng SỐ THUẾ ở sổ khác hóa đơn — nghi sai thuế suất / số thuế.`
        : "Không có — số thuế trên sổ khớp hóa đơn ở mọi dòng đã kê.",
      xem: sheetLechThue.length
        ? { chu: `Lọc cột A = "LỆCH THUẾ" ở sheet ${sheetLechThue.map((s) => s.ten).join(", ")}`, sheet: sheetLechThue[0]!.ten }
        : undefined,
      lamGi: lechThue.length ? 'Soát cột "BẰNG CHỨNG ĐỐI CHIẾU" — sửa số thuế ở sổ cho khớp hóa đơn (tiền thanh toán vẫn đúng).' : "",
      muc: lechThue.length ? "do" : "xanh",
    });
    const soThieu = (kq.sheetPhanMem?.dong ?? []).filter((d) => d.trangThai === "THIEU");
    traLoi.push({
      viec: "Dòng sổ không tìm thấy hóa đơn điện tử",
      ketLuan: soThieu.length
        ? `${soThieu.length} dòng sổ · ${vnd(soThieu.reduce((t, d) => t + d.tongCong, 0))}.`
        : "Không có — mọi dòng sổ đều có hóa đơn điện tử.",
      xem: soThieu.length && ds.chuaKe?.soThieu
        ? { chu: `${TEN.chuaKe} · mục cuối`, sheet: TEN.chuaKe, o: `A${ds.chuaKe.soThieu}` }
        : undefined,
      lamGi: soThieu.length ? "Kiểm lại số/ký hiệu hóa đơn gõ ở sổ, hoặc hóa đơn chưa lên cổng thuế." : "",
      muc: soThieu.length ? "vang" : "xanh",
    });
  }

  if (ds.haiBan) {
    const t = ds.haiBan.tong;
    const viec = t.chiThue + t.chiTai + t.lechTien;
    traLoi.push({
      viec: "So hai bản hóa đơn điện tử (thuế gửi ⇄ tự tải)",
      ketLuan: `Bản tự tải THIẾU ${t.chiThue} hóa đơn (${vnd(t.tienChiThue)}) · thuế không gửi ${t.chiTai} (${vnd(t.tienChiTai)}) · lệch tiền ${t.lechTien} · khớp ${t.caHai - t.lechTien - t.khongSoDuocTien}.`,
      xem: { chu: `Sheet ${TEN.haiBan}`, sheet: TEN.haiBan },
      lamGi: viec ? "Xử theo cột PHẢI LÀM GÌ, dòng tô đỏ (bản tự tải thiếu) trước." : "",
      muc: viec ? "do" : "xanh",
    });
  }

  if (hasLedger || ds.haiBan) traLoi.push(...columnSums);

  if (ds.cungNgay.length) {
    const nghi = ds.cungNgay.filter((g) => g.trungSoTien).length;
    traLoi.push({
      viec: "Hóa đơn cùng MST cùng ngày",
      ketLuan: `${ds.cungNgay.length} nhóm · ${ds.cungNgay.reduce((s, g) => s + g.soHoaDon, 0)} hóa đơn. ${nghi ? `${nghi} nhóm có hóa đơn TRÙNG KHÍT số tiền — chỗ dễ kê hai lần.` : "Không nhóm nào trùng khít số tiền."}`,
      xem: { chu: `Sheet ${TEN.cungNgay} (cuối file)`, sheet: TEN.cungNgay },
      lamGi: nghi ? "Chỉ để soát bằng mắt khi cần: nhóm tô vàng xếp đầu sheet. Nhiều hóa đơn một ngày chưa chắc là sai." : "Chỉ để soát bằng mắt khi cần — không phải lỗi.",
      muc: "xanh",
    });
  }

  const soNghi = kq.nghiVan.length + kq.nghiVanGop.length;
  traLoi.push({
    viec: "Ô số liệu nghi sai trong file",
    ketLuan: soNghi ? `${soNghi} chỗ cần soát (máy không tự sửa ô nào).` : "Không có chỗ nào nghi vấn.",
    xem: soNghi ? { chu: "Khối CHỖ CẦN SOÁT LẠI bên dưới", khoi: "nghiVan" } : undefined,
    lamGi: soNghi ? 'Mỗi dòng trỏ đúng ô trong file này; máy suy được số đúng thì bấm "Sửa" trên màn hình.' : "",
    muc: soNghi ? "vang" : "xanh",
  });

  // "Không cần vào sổ" đã nói ở dòng chưa kê; không có sổ thì "thiếu sổ" đã nói ở
  // đầu trang. Trùng khóa KHÔNG lọc ở đây: engine đã chỉ báo trùng thật (cùng một bản,
  // hoặc có sổ mà bị cộng hai lần) — giấu đi là giấu đúng dấu hiệu đếm đôi.
  const alreadyStated = new Set(hasLedger ? ["Hóa đơn không cần vào sổ"] : ["Thiếu dữ liệu", "Hóa đơn không cần vào sổ"]);
  const byType = new Map<string, string[]>();
  for (const c of kq.canhBao)
    if (!alreadyStated.has(c.loai))
      byType.set(c.loai, [...(byType.get(c.loai) ?? []), c.chiTiet]);
  for (const [kind, ct] of byType)
    traLoi.push({
      viec: `⚠ ${kind}`,
      ketLuan: ct.length > 1 ? `${ct[0]} (và ${ct.length - 1} cảnh báo cùng loại — xem trên màn hình)` : ct[0]!,
      lamGi: "",
      muc: "vang",
    });

  const passedCount = kq.phepThu.filter((p) => p.dat).length;
  traLoi.push({
    viec: "Máy tự kiểm lại kết quả",
    ketLuan: passedCount === kq.phepThu.length ? `ĐẠT ${passedCount}/${kq.phepThu.length} phép thử.` : `CÓ ${kq.phepThu.length - passedCount} PHÉP CHƯA ĐẠT (${passedCount}/${kq.phepThu.length}) — soát trước khi tin con số tổng.`,
    xem: { chu: "Khối MÁY TỰ KIỂM TRA cuối sheet", khoi: "tuKiem" },
    lamGi: "",
    muc: passedCount === kq.phepThu.length ? "xanh" : "do",
  });

  // --- Đầu trang (KẾT LUẬN CHUNG) ---
  const title = hasLedger
    ? `KẾT QUẢ ĐỐI SOÁT HÓA ĐƠN ĐIỆN TỬ VỚI SỔ "${ledgerName}"`
    : ds.haiBan
      ? "KẾT QUẢ SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ"
      : "KẾT QUẢ DÒ: CHƯA THUẾ + THUẾ CÓ BẰNG TỔNG THANH TOÁN KHÔNG";
  const cheDo = hasLedger
    ? `Đối chiếu ${hd.length} sheet hóa đơn điện tử (${tenHd}) với sổ kế toán "${ledgerName}". Cột A của các sheet là cột KẾT QUẢ mới chèn nên cột gốc dời sang phải 1 cột.`
    : ds.haiBan
      ? `File có HAI BẢN hóa đơn điện tử (thuế gửi: ${ds.haiBan.sheetThue.join(" + ")} · tự tải: ${ds.haiBan.sheetTai.join(" + ")}), không có sổ kế toán. Mọi ô vẫn ở đúng địa chỉ cũ.`
      : `File chỉ có bảng kê hóa đơn (${tenHd}), không có sổ kế toán. Mọi ô vẫn ở ĐÚNG ĐỊA CHỈ CŨ; kết quả kiểm từng dòng nằm ở 3 cột mới nối cuối mỗi sheet, dòng có lệch được tô màu.`;
  let r = cau(ws, 1, title, { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, NEN_TITLE);
  r = cau(ws, r, `${cheDo}${phu.length ? ` Sheet ${phu.map((s) => `"${s.ten}"`).join(", ")} trùng lặp (tập con) nên không cộng vào tổng.` : ""}`, { italic: true });
  r = cau(ws, r, `Sheet này chỉ ghi VIỆC PHẢI LÀM và SO TỔNG. Bóc tách, cân đối cột, tự kiểm nằm ở sheet "${TEN.kiemChung}". Không ô số liệu gốc nào bị sửa; chữ xanh gạch chân bấm được.`, { italic: true });
  r++;

  // Chia câu trả lời: VIỆC PHẢI LÀM (kế toán hành động) ở KẾT LUẬN; GHI CHÚ / TỰ KIỂM
  // (cân đối cột, cùng MST, cảnh báo, 9 phép thử) dồn sang KIỂM CHỨNG.
  const isVerifyItem = (t: TraLoi) =>
    /chưa thuế \+ thuế/.test(t.viec) ||
    t.viec === "Hóa đơn cùng MST cùng ngày" ||
    t.viec.startsWith("⚠") ||
    t.viec === "Máy tự kiểm lại kết quả";
  const actionItems = traLoi.filter((t) => !isVerifyItem(t));
  const verifyItems = traLoi.filter(isVerifyItem);
  const hangTL = new Map<TraLoi, { ws: Worksheet; hang: number }>();

  r = writeBlockTitle(ws, r, "VIỆC PHẢI LÀM");
  writeHeaderSpans(ws, r++, [["VIỆC", 1], ["KẾT LUẬN", 4], ["XEM Ở ĐÂU", 2], ["PHẢI LÀM GÌ", 1]]);
  for (const t of actionItems) hangTL.set(t, { ws, hang: r++ });
  r++;
  if (hasLedger) writeSummaryBlock(ws, r, kq);

  // --- Sheet KIỂM CHỨNG ---
  const ws2 = wb.addWorksheet(TEN.kiemChung);
  EMPTY_MARKS.forEach((w, i) => (ws2.getColumn(i + 1).width = w));
  let r2 = cau(ws2, 1, "KIỂM CHỨNG & CHI TIẾT — phần chứng minh máy làm đúng", { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, NEN_TITLE);
  r2 = cau(ws2, r2, `Số liệu đối chiếu đầy đủ, bóc tách phần chênh, cân đối cột, ô nghi sai và 9 phép máy tự kiểm. Mở khi cần đối chiếu sâu — việc phải làm đã tóm ở sheet "${TEN.ketLuan}".`, { italic: true });
  r2++;
  if (verifyItems.length) {
    r2 = writeBlockTitle(ws2, r2, "GHI CHÚ & TỰ KIỂM");
    writeHeaderSpans(ws2, r2++, [["MỤC", 1], ["KẾT LUẬN", 4], ["XEM Ở ĐÂU", 2], ["GHI CHÚ", 1]]);
    for (const t of verifyItems) hangTL.set(t, { ws: ws2, hang: r2++ });
    r2++;
  }

  // --- Khối chi tiết (đều nằm ở KIỂM CHỨNG) — ghi trước để biết hàng rồi điền link ---
  const moc = new Map<string, number>();
  for (const s of !hasLedger ? canDo : []) {
    moc.set(`doLech:${s.ten}`, r2);
    r2 = writeDiffBlock(ws2, r2, s, outputColumn) + 1;
  }
  if (hasLedger) {
    r2 = writeCompareBlock(ws2, r2, kq) + 2;
    for (const s of canDo) {
      moc.set(`doLech:${s.ten}`, r2);
      r2 = writeDiffBlock(ws2, r2, s, outputColumn) + 1;
    }
  }
  if (soNghi) {
    moc.set("nghiVan", r2);
    r2 = writeSuspectBlock(ws2, r2, kq) + 2;
  }
  moc.set("tuKiem", r2);
  writeSelfCheckBlock(ws2, r2, kq);

  // --- Điền link vào hai bảng trả lời (khối chi tiết đều ở KIỂM CHỨNG) ---
  const BG_BY_LEVEL = { do: NEN_TRUOT, vang: NEN_NGHI, xanh: BG_PASS } as const;
  for (const [t, { ws: wsx, hang }] of hangTL) {
    let viewCell: CellValue = "";
    if (t.xem) {
      const linkTarget = t.xem.khoi ? (moc.has(t.xem.khoi) ? lienKet(TEN.kiemChung, `A${moc.get(t.xem.khoi)}`) : null) : lienKet(t.xem.sheet!, t.xem.o);
      viewCell = linkTarget ? oLink(linkTarget, t.xem.chu) : t.xem.chu;
    }
    hang8(wsx, hang, [[t.viec, 1], [t.ketLuan, 4], [viewCell, 2], [t.lamGi, 1]], BG_BY_LEVEL[t.muc]);
    wsx.getCell(hang, 1).font = { bold: true };
  }
  return { ketLuan: ws, kiemChung: ws2 };
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
function buildUndeclaredSheet(wb: Workbook, kq: ReconciliationResult): { ws: Worksheet; moc: UnlistedAnchors } | null {
  const hd = kq.sheetsHoaDon.filter((sh) => !sh.laPhu);
  const allMissing = hd.flatMap((sh) => sh.dong.filter((d) => d.trangThai === "THIEU"));
  const soThieu = (kq.sheetPhanMem?.dong ?? []).filter((d) => d.trangThai === "THIEU");
  // Cả hai chiều đều sạch ⇒ không có gì để lọc, đừng đẻ sheet rỗng.
  if (!allMissing.length && !soThieu.length) return null;
  const moc: UnlistedAnchors = {};
  const ws = wb.addWorksheet(TEN.chuaKe);
  [6, 12, 14, 12, 18, 42, 18, 16, 18, 20, 20, 56].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const byDate = (a: (typeof allMissing)[number], b: (typeof allMissing)[number]) =>
    dateKey(a.ngayLap).localeCompare(dateKey(b.ngayLap)) || a.tenBan.localeCompare(b.tenBan, "vi");
  // Có "gần khớp" (cùng MST + cùng số tiền với một dòng sổ không ghép được) ⇒ nhiều
  // khả năng ĐÃ KÊ, chỉ gõ sai số hóa đơn ở sổ. Tách riêng kẻo kế toán đi kê trùng.
  // Vẫn để trong sheet này (chỉ là gợi ý của máy, người phải xác nhận).
  const toDeclare = allMissing.filter((d) => !d.khongCanVaoSo && !d.ganKhopMoTa).sort(byDate);
  const suspectedInLedger = allMissing.filter((d) => !d.khongCanVaoSo && d.ganKhopMoTa).sort(byDate);
  const skipped = allMissing.filter((d) => d.khongCanVaoSo);
  const ledgerName = kq.sheetPhanMem?.ten ?? "sổ kế toán";
  const declaredTotal = toDeclare.reduce((t, d) => t + d.tongTtVnd, 0);

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
  const writeDiffRow = (d: (typeof allMissing)[number], stt: number, nen?: string) => {
    const o = [
      stt, d.kyHieu, d.soHoaDon, d.ngayLap, d.mstBan, d.tenBan,
      d.chuaThueVnd, d.thueVnd, d.tongTtVnd, d.trangThaiHd,
      `${d.sheet} dòng ${d.dongFile}`, d.ganKhopMoTa ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
      if (nen) cell.fill = to(nen);
    });
    r++;
  };
  toDeclare.forEach((d, i) => writeDiffRow(d, i + 1));

  // dòng cộng
  ws.getCell(r, 6).value = `CỘNG ${toDeclare.length} hóa đơn`;
  const columnTotals: [number, number][] = [
    [7, toDeclare.reduce((t, d) => t + d.chuaThueVnd, 0)],
    [8, toDeclare.reduce((t, d) => t + d.thueVnd, 0)],
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
    moc.nghiSaiSo = r;
    ws.getCell(r, 1).value = `NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN Ở SỔ — ${suspectedInLedger.length} hóa đơn (cùng MST + cùng số tiền với một dòng sổ ở mục cuối). Xác nhận rồi SỬA SỐ Ở SỔ, đừng kê thêm lần nữa.`;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FF9C6500" } };
    r++;
    writeTableHeader(ws, r, columns);
    r++;
    suspectedInLedger.forEach((d, i) => writeDiffRow(d, i + 1, NEN_NGHI));
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
  moc.soThieu = r;
  ws.getCell(r, 1).value = `DÒNG SỔ KHÔNG CÓ HÓA ĐƠN ĐIỆN TỬ — ${soThieu.length} dòng (đã kê nhưng không tìm thấy hóa đơn trên cổng thuế)`;
  ws.getCell(r, 1).font = { bold: true };
  r++;
  writeTableHeader(ws, r, [
    "STT", "Ký hiệu", "Số hóa đơn", "Ngày HĐ", "MST người bán", "Tên người bán",
    "Số phiếu", "CTGS", "Tổng cộng (VND)", "", "Vị trí trong file", "Ghi chú",
  ]);
  r++;
  soThieu.forEach((d, i) => {
    const o = [
      i + 1, d.kyHieu, d.soHoaDon, d.ngayHd, d.mstBan, d.tenBan,
      d.phieu, d.ctgs, d.tongCong, "", `${d.sheet} dòng ${d.dongFile}`, d.ganKhopMoTa ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c === 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
    });
    r++;
  });
  if (!soThieu.length) ws.getCell(r, 1).value = "Không có — mọi dòng sổ đều tìm thấy hóa đơn điện tử.";

  ws.views = [{ state: "frozen", ySplit: tableStartRow }];
  return { ws, moc };
}

/** Sheet SO HAI BẢN — chỉ dựng khi file có cả bản thuế gửi lẫn bản tự tải. */
function buildVersionCompareSheet(wb: Workbook, so: TwoVersionResult): Worksheet {
  const ws = wb.addWorksheet(TEN.haiBan);
  [26, 16, 16, 14, 40, 18, 18, 18, 16, 26, 26, 64].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  writePageTitle(ws, "SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ — bản cơ quan thuế gửi ⇄ bản tự tải", [
    `Bản THUẾ: ${so.sheetThue.join(" + ")} (${so.tong.soThue} hóa đơn)  ·  Bản TỰ TẢI: ${so.sheetTai.join(" + ")} (${so.tong.soTai} hóa đơn)`,
    `Ghép theo khóa MST người bán | ký hiệu | số hóa đơn. Dòng xếp theo mức độ phải xử: thiếu ở bản tự tải lên trước.`,
  ]);
  const t = so.tong;
  const summary: [string, string][] = [
    ["CHỈ bản THUẾ có — bản tự tải THIẾU", `${t.chiThue} hóa đơn · ${Math.round(t.tienChiThue).toLocaleString("vi-VN")} đ`],
    ["CHỈ bản TỰ TẢI có — thuế không gửi", `${t.chiTai} hóa đơn · ${Math.round(t.tienChiTai).toLocaleString("vi-VN")} đ`],
    ["Có cả hai bản nhưng LỆCH TIỀN", `${t.lechTien} hóa đơn`],
    ["Có cả hai bản, KHÔNG so được tiền (dòng lệch bố cục cột)", `${t.khongSoDuocTien} hóa đơn`],
    ["Khớp cả hai bản", `${t.caHai - t.lechTien - t.khongSoDuocTien} hóa đơn`],
    ["Tổng tiền hai bản", `thuế ${Math.round(t.tienThue).toLocaleString("vi-VN")} đ / tự tải ${Math.round(t.tienTai).toLocaleString("vi-VN")} đ / chênh ${Math.round(t.chenhTongTien).toLocaleString("vi-VN")} đ`],
  ];
  summary.forEach(([a, b], i) => {
    ws.getCell(4 + i, 1).value = a;
    ws.getCell(4 + i, 1).font = { bold: true };
    ws.getCell(4 + i, 2).value = b;
  });

  const hang = 4 + summary.length + 1;
  writeTableHeader(ws, hang, [
    "KẾT QUẢ", "Ký hiệu", "Số hóa đơn", "Ngày lập", "Người bán", "MST người bán",
    "Tổng TT bản THUẾ", "Tổng TT bản TỰ TẢI", "Chênh", "Vị trí bản THUẾ", "Vị trí bản TỰ TẢI", "PHẢI LÀM GÌ",
  ]);
  const label: Record<string, string> = {
    CHI_THUE: "BẢN TỰ TẢI THIẾU", CHI_TAI: "THUẾ KHÔNG GỬI", CA_HAI: "CÓ CẢ HAI",
  };
  so.dong.forEach((d, i) => {
    const r = hang + 1 + i;
    const o = [
      d.ben === "CA_HAI" ? (d.khongSoDuocTien ? "KHÔNG SO ĐƯỢC TIỀN" : d.lechTien ? "LỆCH TIỀN" : "KHỚP") : label[d.ben],
      d.kyHieu, d.soHoaDon, d.ngayLap, d.tenBan, d.mstBan,
      d.tongT, d.tongX, d.chenhTong, d.viTriT, d.viTriX, d.ghiChu,
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v ?? null) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0.00";
      cell.alignment = { vertical: "top", wrapText: c === 4 || c >= 9 };
    });
    const nen =
      d.ben === "CHI_THUE" ? NEN_TRUOT
      : d.ben === "CHI_TAI" ? NEN_NGHI
      : d.lechTien ? NEN_NGHI
      : d.khongSoDuocTien ? "FFE7E6E6"
      : BG_PASS;
    for (let c = 1; c <= 12; c++) ws.getCell(r, c).fill = to(nen);
  });
  ws.autoFilter = { from: { row: hang, column: 1 }, to: { row: hang, column: 12 } };
  ws.views = [{ state: "frozen", ySplit: hang }];
  return ws;
}

/** Sheet CÙNG MST + CÙNG NGÀY — lọc hóa đơn nghi trùng / nghi tách đơn. */
function buildSameDaySheet(wb: Workbook, nhom: readonly SameDayGroup[]): Worksheet {
  const ws = wb.addWorksheet(TEN.cungNgay);
  [22, 14, 40, 20, 10, 20, 16, 18, 22, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const nghi = nhom.filter((g) => g.trungSoTien).length;
  writePageTitle(ws, "HÓA ĐƠN CÙNG MỘT NHÀ CUNG CẤP, CÙNG MỘT NGÀY", [
    `${nhom.length} nhóm · ${nhom.reduce((s, g) => s + g.soHoaDon, 0)} hóa đơn. Trong đó ${nghi} nhóm có hóa đơn TRÙNG KHÍT số tiền (tô vàng) — chỗ dễ kê hai lần nhất.`,
    "Nhiều hóa đơn cùng nhà cung cấp trong một ngày KHÔNG có nghĩa là sai (xăng dầu, siêu thị…). Đây chỉ là danh sách để soát bằng mắt.",
  ]);
  writeTableHeader(ws, 5, [
    "NGHI TRÙNG", "Ngày lập", "Người bán", "MST người bán", "Số HĐ trong ngày",
    "Tổng tiền cả nhóm", "Ký hiệu", "Số hóa đơn", "Tổng thanh toán (VND)", "Vị trí · kết quả đối soát",
  ]);
  let r = 6;
  for (const g of nhom) {
    const dau = r;
    g.dong.forEach((d, i) => {
      const o = [
        i === 0 ? (g.trungSoTien ? `CÓ — ${g.moTaTrung}` : "") : "",
        i === 0 ? g.ngay : "", i === 0 ? g.tenBan : "", i === 0 ? g.mstBan : "",
        i === 0 ? g.soHoaDon : "", i === 0 ? g.tongTien : "",
        d.kyHieu, d.soHoaDon, d.tongTtVnd, `${d.sheet} dòng ${d.dongFile} · ${d.ketLuan}`,
      ];
      o.forEach((v, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value = (v === "" ? null : v) as never;
        if (c === 5 || c === 8) cell.numFmt = "#,##0";
        cell.alignment = { vertical: "top", wrapText: c === 0 || c === 2 || c === 9 };
      });
      if (g.trungSoTien) for (let c = 1; c <= 10; c++) ws.getCell(r, c).fill = to(NEN_NGHI);
      r++;
    });
    // viền dưới cho hết một nhóm, nhìn ra ranh giới
    for (let c = 1; c <= 10; c++) ws.getCell(r - 1, c).border = { bottom: { style: "thin" } };
    if (dau === r) r++;
  }
  if (!nhom.length) {
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
export function addSummarySheets(wb: Workbook, kq: ReconciliationResult, outputColumn: OutputColumnMapper): void {
  // Chạy lại trên file đã xuất: bỏ mọi sheet tự dựng (kể cả tên cũ trước v6.4)
  // rồi dựng lại, kẻo trùng tên hoặc sót sheet cũ nằm lại.
  for (const w of [...wb.worksheets]) if (GENERATED_SHEET_NAMES.has(w.name) && w.name !== "NHẬT KÝ SỬA") wb.removeWorksheet(w.id);
  // Sheet gốc lùi về sau; sheet tổng hợp chiếm các chỗ đầu.
  wb.worksheets.forEach((w, i) => ((w as unknown as ThuTu).orderNo = 10 + i));

  const { benThue } = resolveTaxSideSheets(kq.sheetsHoaDon.map((s) => s.ten), kq.benThue);
  const versionCompare = compareTwoInvoiceVersions(kq.sheetsHoaDon, kq.nguong, benThue);
  const sameDayGroups = groupSameTaxCodeSameDay(kq.sheetsHoaDon.filter((s) => !s.laPhu), benThue);
  const unlisted = kq.sheetPhanMem ? buildUndeclaredSheet(wb, kq) : null;
  const twoVersionSheet = versionCompare ? buildVersionCompareSheet(wb, versionCompare) : null;
  const sameDaySheet = sameDayGroups.length ? buildSameDaySheet(wb, sameDayGroups) : null;
  const { ketLuan, kiemChung } = sheetKetLuan(wb, kq, { chuaKe: unlisted?.moc ?? null, haiBan: versionCompare, cungNgay: sameDayGroups }, outputColumn);

  [ketLuan, unlisted?.ws, kiemChung, twoVersionSheet].forEach((w, i) => w && ((w as unknown as ThuTu).orderNo = i));
  // CÙNG MST CÙNG NGÀY là danh sách THAM KHẢO (nhiều hóa đơn một ngày chưa chắc
  // sai), không phải kết quả đối soát ⇒ xếp sau các sheet gốc, trước nhật ký sửa.
  if (sameDaySheet) (sameDaySheet as unknown as ThuTu).orderNo = 1000;
  const nk = wb.worksheets.find((w) => w.name === "NHẬT KÝ SỬA");
  if (nk) (nk as unknown as ThuTu).orderNo = 2000;
}
