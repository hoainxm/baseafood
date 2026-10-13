// ============================================================
// Tên file: src/lib/doiSoatHddt.ts
// Tên tiếng Việt: Đối soát Hóa đơn điện tử (cổng thuế) ⇄ Phần mềm kế toán — v3
// Description: Parse an invoice workbook (e-invoice sheets + accounting-software
//   sheet) and reconcile them by (MST bán | ký hiệu chuẩn | số HĐ chuẩn).
// ============================================================
//
// NGUYÊN TẮC (spec v3): KHÔNG tự sửa dữ liệu (chỉ báo + người dùng bấm Sửa từng
// dòng, giữ giá trị cũ); mỗi số truy được về nguồn; không đoán ("chưa xác định");
// kết quả độc lập locale; tự kiểm trước khi kết luận.
//
// v3 thêm so với v2: chuẩn hóa KÝ HIỆU bỏ chữ số mẫu số gộp đầu (sổ 1C26TTN ↔
// HĐ C26TTN); GẦN KHỚP (dò cùng MST + cùng số tiền ±1đ cho dòng chưa ghép — chú
// thích trên dòng THIẾU, KHÔNG tạo bucket đếm mới); gộp sheet HĐĐT trùng (tập
// con → không cộng đôi); GỠ cột đối soát cũ nếu file đã xử lý (idempotent); 7
// nhóm nghi vấn; 9 phép tự kiểm; XUẤT FILE MẪU cho người dùng.
//
// Toàn bộ dữ liệu nằm trong file Excel upload — KHÔNG đọc DB / repo (tier GREEN).

import * as XLSX from "xlsx-js-style";
import { num } from "@/lib/format";
import { MAU_NEN, chuCotExcel, chuanChu as chuan, khoaSua, tachKhoaSua } from "./doiSoatChung";
import { phanBenThue } from "./doiSoatHaiBan";

// ---------- Kiểu dữ liệu ----------

export type TrangThaiHoaDon = "KHOP" | "LECH" | "THIEU";
export type TrangThaiPhanMem = "CO" | "THIEU";
/** 1 cộng sai · 2 thiếu chưa thuế · 3 gần khớp · 4 thiếu tách thuế · 5 tổng bị xóa · 6 cột quy đổi phụ · 7 sheet trùng. */
export type NhomNghiVan = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface NghiVan {
  nhom: NhomNghiVan;
  /** Vị trí trong FILE NGƯỜI DÙNG TẢI LÊN (dùng trên màn hình). */
  viTri: string;
  /** Cùng vị trí đó nhưng theo FILE XUẤT (đã chèn cột "KẾT QUẢ" ⇒ lệch 1 cột). */
  viTriXuat?: string;
  soDangCo: string;
  soDoiChung: string; // "chưa xác định" nếu không suy được
  nguonDoiChung: string;
  saiOCho: string;
  anhHuong: string;
  // Để áp SỬA (chỉ khi suy được số đúng determinate):
  sheet?: string;
  soDong?: number;
  cot?: number;
  tenCot?: string;
  giaTriCu?: number | null;
  giaTriDung?: number;
}

export interface NghiVanGop {
  nhom: NhomNghiVan;
  ten: string;
  soDong: number;
  tongTien: number;
  canhBao: string;
  chiTiet: NghiVan[];
}

export interface PhepThu {
  ten: string;
  batLoiGi: string;
  mong: string;
  thuc: string;
  dat: boolean;
}

export interface CauNoi {
  tongFile: number;
  khopFile: number;
  lechFile: number;
  chuaCoBenSo: number;
  chuaCoBenSoTrucTiep: number;
  soKhopSo: number;
  duTruCheo: number;
  bocTach: { mo: string; tien: number }[];
}

export interface DongHoaDon {
  sheet: string;
  /** Cột "Trạng thái hóa đơn" của cổng thuế, nguyên văn. */
  trangThaiHd: string;
  /**
   * Dòng RỘNG HƠN hàng tiêu đề ⇒ thuộc bố cục khác đã bị dán chung sheet. Cột tiền
   * của nó KHÔNG đáng tin (bản "không mã" để tổng thanh toán ở cột khác, hóa đơn
   * ngoại tệ còn để số gốc và số quy đổi ở hai cột khác hẳn). Chỉ khóa (ký hiệu ·
   * số HĐ · MST) là tin được vì nằm trước chỗ lệch.
   */
  boCucLech: boolean;
  /**
   * Hóa đơn **không cần vào sổ**: bản đã bị THAY THẾ, hoặc bị xóa bỏ/hủy. Kế toán
   * cố ý không hạch toán bản này (hạch toán bản thay thế) ⇒ báo "chưa kê" là báo oan.
   * LƯU Ý: "đã bị ĐIỀU CHỈNH" thì KHÁC — hóa đơn gốc vẫn có hiệu lực, vẫn phải vào
   * sổ, hóa đơn điều chỉnh chỉ ghi thêm phần chênh. Đừng gộp hai loại này.
   */
  khongCanVaoSo: boolean;
  /** Chỉ số dòng trong AOA (+1) — KHÓA của Map `edits`, KHÔNG đổi kẻo hỏng bản đã lưu. */
  soDong: number;
  /** Dòng thật trong file Excel — dùng cho mọi chuỗi hiển thị cho người dùng. */
  dongFile: number;
  /** Kết quả kiểm "chưa thuế + thuế = tổng thanh toán" của CHÍNH dòng này. null = khớp. */
  lechCong: { lech: number; loai: LoaiLechCong } | null;
  cells: unknown[];
  kyHieu: string;
  soHoaDon: string;
  soChuan: string;
  ngayLap: string;
  mstBan: string;
  tenBan: string;
  dvt: string;
  /**
   * Tỷ giá ÁP DỤNG khi quy về VND (1 = không nhân). Ban đầu = tỷ giá đọc trên hóa đơn;
   * tầng đối soát có thể hạ về 1 nếu tự dò ra cổng thuế đã quy sẵn VND (xem
   * `phatHienQuyUocNgoaiTe`). Cột "Tỷ giá áp dụng" khi xuất lấy đúng số này.
   */
  tyGia: number;
  /** Tiền tệ khác VND mà ô tỷ giá trống/0 ⇒ KHÔNG quy đổi được (đang để nguyên số trên hóa đơn). */
  thieuTyGia?: boolean;
  /** Số tiền GỐC trên hóa đơn (CHƯA nhân tỷ giá) — giữ để tự dò quy ước ngoại tệ. */
  chuaThueRaw: number;
  thueRaw: number;
  tongTtRaw: number;
  chuaThueVnd: number;
  thueVnd: number;
  tongTtVnd: number;
  khoa: string;
  soDongKhopPm: number;
  tongTtPm: number;
  chenh: number | null;
  trangThai: TrangThaiHoaDon;
  ketLuan: string;
  bangChung: string;
  phieuKe: string;
  ctgs: string;
  ngayGhiSo: string;
  tkNoCo: string;
  dienGiaiPm: string;
  soTienHachToan: number | null;
  ganKhopMoTa?: string; // v3 §5.4: gợi ý cặp gần khớp cho dòng THIẾU
}

/**
 * CÂN ĐỐI CỘT của một sheet hóa đơn: kế toán hay cộng cột "chưa thuế" + cột "thuế"
 * rồi so với cột "tổng thanh toán"; lệch thì phải chỉ ra lệch ở đâu. Bóc phần lệch
 * thành 4 nguyên nhân để biết cái nào phải đi sửa, cái nào là bình thường.
 */
/** Nguyên nhân một dòng có chưa thuế + thuế ≠ tổng thanh toán. */
export type LoaiLechCong = "phi" | "chietKhau" | "lamTron" | "that";

export const NHAN_LECH_CONG: Record<LoaiLechCong, string> = {
  phi: "có phí — bình thường",
  chietKhau: "có chiết khấu — bình thường",
  lamTron: "làm tròn ±1đ — bình thường",
  that: "LỆCH THẬT — phải soát",
};

export interface CanDoiCot {
  /** Chỉ số cột (trong AOA) của ba cột tiền — để dựng công thức kiểm ngay trên sheet. */
  cotChua: number;
  cotThue: number;
  cotTong: number;
  tenChua: string;
  tenThue: string;
  tenTong: string;
  sumChua: number;
  sumThue: number;
  sumCk: number;
  sumPhi: number;
  sumTong: number;
  /** sumTong − (sumChua + sumThue) — đúng con số kế toán nhìn thấy. */
  lech: number;
  /** Bóc `lech` theo nguyên nhân; bốn số này cộng lại đúng bằng `lech`. */
  boc: { phi: number; chietKhau: number; lamTron: number; lechThat: number };
  soDong: { phi: number; chietKhau: number; lamTron: number; lechThat: number };
  /** Danh sách dòng lệch KHÔNG giải thích được — chỗ phải đi sửa. */
  dongLechThat: { dongFile: number; ma: string; ngay: string; ban: string; lech: number }[];
  /** Cột phí / chiết khấu (chỉ số AOA, −1 = không có). */
  cotPhi: number;
  cotCk: number;
  /**
   * MỌI dòng có chưa thuế + thuế ≠ tổng thanh toán, kèm số thô từng ô — để kế toán
   * cộng tay lại đúng bằng ô lệch của họ ("sót dòng nào mà tổng không ra").
   */
  dongLech: DongLechCong[];
  /**
   * Ô LỆCH kế toán tự đặt dưới bảng (VD Q3049 = Σ tổng − (Σ chưa thuế + Σ thuế + Σ phí)).
   * Máy nhận ra bằng cách so giá trị ô với các cách tính quen thuộc; null = không thấy.
   */
  oTuDat: OTuDat | null;
}

export interface DongLechCong {
  dongFile: number;
  ma: string;
  ngay: string;
  ban: string;
  chua: number;
  thue: number;
  phi: number;
  ck: number;
  tong: number;
  /** tong − (chua + thue) */
  lech: number;
  loai: LoaiLechCong;
}

export interface OTuDat {
  /** Dòng Excel + chỉ số cột AOA — lớp xuất tự quy ra địa chỉ trong file ra (VD "Q3049"). */
  dongFile: number;
  cot: number;
  giaTri: number;
  /** Công thức kế toán đã cộng phí / đã trừ chiết khấu chưa — suy từ giá trị ô. */
  congPhi: boolean;
  truCk: boolean;
  /** −1 nếu ô tính ngược chiều: (chưa thuế + thuế) − tổng. */
  dau: 1 | -1;
}

export interface SheetHoaDon {
  ten: string;
  header: string[];
  preRows: unknown[][];
  dong: DongHoaDon[];
  laPhu?: boolean; // v3 §1.4: sheet HĐĐT là tập con của sheet khác → không vào tổng
  /** Tọa độ trong file gốc — để xuất file GIỮ NGUYÊN định dạng ghi đúng ô. */
  goc: ToaDoGoc;
  /** Chỉ số hàng tiêu đề trong AOA. */
  hIdx: number;
  /** Số cột dữ liệu gốc (sau khi gỡ cột đối soát lần trước). */
  rong: number;
  /** Cộng cột chưa thuế + thuế có bằng cột tổng thanh toán không, lệch thì do đâu. */
  canDoiCot: CanDoiCot;
}

export interface DongPhanMem {
  sheet: string;
  /** Chỉ số dòng trong AOA (+1) — KHÓA của Map `edits`. */
  soDong: number;
  /** Dòng thật trong file Excel. */
  dongFile: number;
  cells: unknown[];
  ctgs: string;
  phieu: string;
  kyHieu: string;
  soHoaDon: string;
  soChuan: string;
  mstBan: string;
  tenBan: string;
  tongCong: number;
  /** Tiền hàng / tiền thuế trên sổ — để dựng bảng ĐỐI CHIẾU TỔNG đủ 3 cột. */
  chuaThue: number;
  thue: number;
  ngayHd: string;
  tkNo: string;
  tkCo: string;
  dienGiai: string;
  khoa: string;
  soHddtKhop: number;
  trangThai: TrangThaiPhanMem;
  ketLuan: string;
  bangChung: string;
  nguonHddt: string;
  dongHddt: number | null;
  ngayLapHd: string;
  tenBanHddt: string;
  tongTtHddt: number | null;
  ganKhopMoTa?: string; // v3 §5.4
}

export interface SheetPhanMem {
  ten: string;
  header: string[];
  dong: DongPhanMem[];
  /** Tiêu đề thật của cặp cột "TK Nợ / TK Có" (sổ mã máy là "TS% / LOAI"). */
  tenTk: string;
  /** false = bản xuất chi tiết mặt hàng, không có cột tổng — tổng tự cộng tiền hàng + thuế. */
  coCotTong: boolean;
  /** false = sổ không có cột MST người bán ⇒ khóa ghép thiếu MST, gần như không khớp được. */
  coCotMst: boolean;
  laPhu?: boolean;
  goc: ToaDoGoc;
  hIdx: number;
  rong: number;
}

export interface CanhBao {
  loai: string;
  chiTiet: string;
}

export interface KetQuaDoiSoat {
  sheetsHoaDon: SheetHoaDon[];
  sheetPhanMem: SheetPhanMem | null;
  sheetsPhanMemPhu: SheetPhanMem[];
  tong: {
    soHoaDon: number;
    khop: number;
    lech: number;
    /** Hóa đơn KHỚP tổng thanh toán nhưng LỆCH THUẾ (nghi sai thuế suất/số thuế ở sổ). */
    lechThue: number;
    thieu: number;
    /** Trong số `thieu`: hóa đơn đã bị thay thế/hủy — ĐÚNG là không có trong sổ. */
    thieuKhongCanVaoSo: number;
    ganKhop: number; // số dòng THIẾU có gợi ý gần khớp (là con của thieu)
    soDongPm: number;
    pmCo: number;
    pmThieu: number;
    tongChenh: number;
    soLoiParse: number;
  };
  nghiVan: NghiVan[]; // nhóm 1,2,3,6 — per dòng
  nghiVanGop: NghiVanGop[]; // nhóm 4,5,7 — gộp thống kê
  cauNoi: CauNoi;
  phepThu: PhepThu[];
  canhBao: CanhBao[];
  canChonSo: boolean;
  daGoCotCu: boolean; // v3 §1.5: đã gỡ cột đối soát của lần chạy trước
  nhatKySua: { viTri: string; cu: string; moi: string }[];
  nguong: number;
  /**
   * Sheet hóa đơn thuộc bản CƠ QUAN THUẾ gửi, do người dùng chỉ định trên màn
   * (undefined = máy tự nhận theo tên sheet, xem `phanBenThue`). Engine KHÔNG dùng —
   * chỉ chở sang lớp xuất để sheet SO HAI BẢN chia bên giống màn hình.
   */
  benThue?: string[];
}

export interface TuyChonDoiSoat {
  nguong: number; // chênh ≤ ngưỡng vẫn coi KHỚP (VND). v3 §5.3 mặc định 1đ.
  edits?: Record<string, number>;
  nghiVanBanDau?: number;
  soChuanTen?: string;
  /** Sheet thuộc bản THUẾ GỬI do người dùng chỉ định (undefined = máy tự nhận, xem `phanBenThue`). */
  benThue?: string[];
}

// ---------- Cột phân tích engine tự thêm (để nhận & GỠ khi chạy lại) ----------

export /**
 * Trạng thái khiến hóa đơn KHÔNG cần có mặt trong sổ (so khớp sau khi bỏ dấu).
 * Chỉ gồm loại đã bị thay thế / xóa bỏ / hủy — KHÔNG gồm "đã bị điều chỉnh".
 */
/**
 * Đọc ô theo NỘI DUNG khi dò theo vị trí hụt.
 *
 * Bảng kê tải từ cổng hay bị TRỘN HAI BỐ CỤC trong cùng một sheet: phần "có mã"
 * 19 cột, phần "không mã" 20 cột (dư một cột trống ở khúc đơn vị tiền tệ). Tiêu đề
 * chỉ có một bộ ⇒ những dòng bố cục kia bị lệch ô từ chỗ đó trở đi: trạng thái hóa
 * đơn rơi vào ô tỷ giá, tiền tệ rơi vào ô kế bên… Các cột TIỀN vẫn đúng chỗ.
 *
 * Nên chỉ vá đúng mấy ô chữ, và chỉ khi dò theo vị trí ra rỗng/sai kiểu — không
 * đoán bừa đè lên giá trị đọc được.
 */
const laTrangThaiHd = (v: unknown): boolean => chuan(v).startsWith("hoa don ");
/** Mã tiền tệ 3 chữ cái viết hoa (VND/USD/JPY…). */
const isCurrencyCode = (v: unknown): boolean => /^[A-Z]{3}$/.test(String(v ?? "").trim().toUpperCase()) ;

/** Trạng thái hóa đơn: ưu tiên ô theo tiêu đề, hụt thì dò trong dòng. */
function readInvoiceStatus(row: unknown[], columns: number): string {
  if (columns >= 0 && laTrangThaiHd(row[columns])) return String(row[columns] ?? "").trim();
  const v = row.find(laTrangThaiHd);
  return v == null ? (columns >= 0 ? String(row[columns] ?? "").trim() : "") : String(v).trim();
}

/** Đơn vị tiền tệ + tỷ giá: hụt thì tìm mã tiền tệ trong dòng, tỷ giá là ô ngay sau. */
function readCurrency(row: unknown[], cDvt: number, cExchangeRate: number): { dvt: string; tyGiaRaw: unknown } {
  if (cDvt >= 0 && isCurrencyCode(row[cDvt])) return { dvt: String(row[cDvt]).trim(), tyGiaRaw: row[cExchangeRate] };
  const i = row.findIndex(isCurrencyCode);
  if (i < 0) return { dvt: cDvt >= 0 ? cellStr(row, cDvt) : "", tyGiaRaw: cExchangeRate >= 0 ? row[cExchangeRate] : null };
  return { dvt: String(row[i]).trim(), tyGiaRaw: row[i + 1] };
}

/** Lệch tới mức này coi là làm tròn, không phải sai (đồng). */
export const TOL_LAM_TRON = 1;
/**
 * Dung sai làm tròn của dòng ngoại tệ để NGUYÊN TỆ (đơn vị ô là USD…, không phải đồng):
 * ±1 xu. Dùng `TOL_LAM_TRON` ở đây là coi lệch 1 USD (~25.000 đ) là "làm tròn".
 */
export const TOL_NGUYEN_TE = 0.01;
/** |x| ≤ dung sai (chừa sai số dấu phẩy động khi cộng số lẻ ngoại tệ). */
const withinTolerance = (x: number, tol: number): boolean => Math.abs(x) <= tol + 1e-9;

const NON_LEDGER_STATUSES = ["da bi thay the", "bi xoa bo", "da bi huy", "bi huy"];
const isNotBookable = (tt: unknown): boolean => {
  const k = chuan(tt);
  return k !== "" && NON_LEDGER_STATUSES.some((x) => k.includes(x));
};

/**
 * Sheet do chính engine dựng ở file xuất (v6.4 + tên cũ trước đó). Đọc lại file đã
 * xuất thì BỎ QUA hẳn các sheet này — chữ trong đó (số hóa đơn, tổng cộng…) dễ bị
 * dò nhầm thành bảng kê/sổ; xuất lại thì xóa rồi dựng mới. Đổi/thêm tên sheet tự
 * dựng nào PHẢI thêm vào đây, không là xuất lại đẻ thêm sheet.
 */
export const SHEET_TU_DUNG: ReadonlySet<string> = new Set([
  "KẾT LUẬN CHUNG", "KIỂM CHỨNG", "HÓA ĐƠN CHƯA KÊ", "SO HAI BẢN HĐĐT", "CÙNG MST CÙNG NGÀY", "NHẬT KÝ SỬA",
  // tên cũ (≤ v6.3) — gộp vào KẾT LUẬN CHUNG từ v6.4
  "ĐỐI CHIẾU TỔNG", "TỰ KIỂM TRA", "NGHI VẤN SỐ LIỆU",
]);

/** Ba cột KIỂM CỘNG dựng ngay trên sheet bảng kê (công thức sống trỏ ô gốc). */
export const HEADER_KIEM = ["Chưa thuế + Thuế", "Lệch với tổng thanh toán", "Nguyên nhân lệch"] as const;

export const HEADER_HD_THEM = [
  "Tỷ giá áp dụng", "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Chưa thuế (VND)", "Thuế (VND)",
  "Tổng thanh toán (VND)", "Số dòng khớp PMKT", "Tổng TT bên PMKT", "Chênh lệch", "KẾT LUẬN",
  "Số phiếu kế toán", "Chứng từ ghi sổ", "Ngày ghi sổ", "TK Nợ / TK Có", "Diễn giải trên phần mềm",
  "Số tiền đã hạch toán", "BẰNG CHỨNG ĐỐI CHIẾU",
];
export const HEADER_PM_THEM = [
  "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Số HĐĐT khớp", "KẾT LUẬN", "Nguồn hóa đơn điện tử",
  "Dòng trên sheet HĐĐT", "Ngày lập HĐ", "Tên người bán trên HĐĐT", "Tổng TT trên HĐĐT (VND)",
  "BẰNG CHỨNG ĐỐI CHIẾU",
];

// ---------- Tiện ích parse ----------

const columnLetter = (i: number): string => (i < 0 ? "?" : chuCotExcel(i));

/**
 * Parse số kiểu Việt/US KHÔNG phụ thuộc locale (v3 §3.1). number→giữ. Chuỗi:
 *  - có cả "." lẫn "," ⇒ dấu ở VỊ TRÍ CUỐI là thập phân, dấu kia ngăn nghìn ("27.500,75", "1,234.56");
 *  - một loại dấu, xuất hiện NHIỀU lần ⇒ ngăn nghìn ("1.234.567", "1,234,567");
 *  - một dấu DUY NHẤT theo sau đúng 3 chữ số, phần nguyên 1–3 chữ số khác 0 ⇒ ngăn nghìn
 *    ("25.420" tỷ giá gõ kiểu VN, "123,456"); còn lại là thập phân ("1.5", "0,25", "0.250");
 *  - trong ngoặc ⇒ số âm ("(1.234)" = −1234, cách kế toán ghi số âm).
 * Lỗi → null (TUYỆT ĐỐI không mặc định 0/1).
 */
export function soVN(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  const ngoac = /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const am = ngoac || s.startsWith("-");
  s = s.replace(/^-/, "");
  const coCham = s.includes(".");
  const coPhay = s.includes(",");
  if (coCham && coPhay) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousand = decimal === "." ? "," : ".";
    s = s.split(thousand).join("").replace(decimal, ".");
  } else if (coCham || coPhay) {
    const parts = s.split(coCham ? "." : ",");
    const hasThousandsSep = parts.length > 2 || (parts[1]!.length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]!));
    s = parts.join(hasThousandsSep ? "" : ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (am ? -n : n) : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Độ lệch tối đa của Date SheetJS dựng ra (thực tế vài chục giây) — xem `ngayHienThi`. */
const SAT_NUA_DEM = 2 * 60 * 1000;

export function ngayHienThi(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS (cellDates) dựng Date lệch vài chục giây theo múi giờ: ô 01/08/2026 ở VN ra
    // 31/07/2026 23:59:30 ⇒ lấy ngày thẳng là LÙI 1 NGÀY (gặp ở mọi ô ngày file cổng thuế).
    // Chỉ đẩy sang ngày sau khi giờ đọc được SÁT nửa đêm (≤ 2 phút) — làm tròn rộng hơn
    // (bản cũ 10 phút) thì ô có giờ thật 23:56 bị nhảy sang hôm sau.
    const d = new Date(v.getTime() + SAT_NUA_DEM);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime()))
      return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${pad2(Number(m[1]))}/${pad2(Number(m[2]))}/${m[3]}`;
    const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return v.trim();
  }
  return "";
}

/** Số HĐ chuẩn: bỏ khoảng trắng + số 0 ở đầu ("00000098" → "98"). v3 §4.1 */
export function soHoaDonChuan(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\s+/g, "");
  const bo0 = s.replace(/^0+/, "");
  return bo0 || (s ? "0" : "");
}

/**
 * Ký hiệu chuẩn: cắt chữ số MẪU SỐ gộp ở đầu (sổ ghi `1C26TTN`, cổng thuế tách
 * thành mẫu số `1` + ký hiệu `C26TTN`). Ký hiệu thật luôn bắt đầu bằng chữ cái
 * nên cắt số đầu là an toàn. Áp cả hai bên. v3 §4.2
 */
export function kyHieuChuan(v: unknown): string {
  const s = String(v ?? "").trim();
  const cat = s.replace(/^\d+/, "");
  return cat || s; // toàn số (hiếm) → giữ nguyên
}

/**
 * MST để so khớp: CHỈ giữ chữ số (`0301234567-001` = `0301234567001`), và bù số 0 đầu
 * khi còn 9 / 12 số — Excel nuốt số 0 đầu khi ô MST là kiểu số (`301234567`). Ô không có
 * chữ số nào thì giữ chữ đã chuẩn hóa.
 */
export function mstChuan(v: unknown): string {
  const so = String(v ?? "").replace(/\D/g, "");
  if (!so) return chuan(v);
  return so.length === 9 || so.length === 12 ? `0${so}` : so;
}

function makeKey(mstBan: string, kyHieu: string, soChuan: string): string {
  return `${mstChuan(mstBan)}|${chuan(kyHieuChuan(kyHieu))}|${soChuan.toLowerCase()}`;
}

const cellStr = (row: unknown[], i: number): string =>
  i < 0 ? "" : String(row[i] ?? "").trim();


/**
 * Tọa độ gốc của một sheet: đổi chỉ số trong mảng AOA sang **ô Excel thật**.
 * Cần vì `sheet_to_json` bắt đầu từ ô đầu vùng dữ liệu (sheet cổng thuế hay bắt
 * đầu ở A3), còn `goCotDoiSoatCu` thì bỏ bớt cột ⇒ chỉ số AOA lệch với file.
 */
export interface ToaDoGoc {
  r0: number;
  c0: number;
  /** cột AOA (sau khi gỡ) → cột AOA gốc; rỗng = ánh xạ 1-1. */
  giuCot: number[];
}
/** Cột AOA → cột Excel (0-based). */
export const cotExcel = (g: ToaDoGoc, c: number): number => g.c0 + (g.giuCot[c] ?? c);
/** Dòng AOA (`soDong` = chỉ số + 1) → dòng Excel (1-based). */
export const dongExcel = (g: ToaDoGoc, rowNo: number): number => g.r0 + rowNo;
/**
 * Địa chỉ ô Excel thật, ví dụ `K430`. `dich` = số cột lệch của FILE XUẤT so với
 * file vào (bản xuất chèn 1 cột "KẾT QUẢ" ở đầu nên mọi cột gốc dời sang phải 1).
 */
const oExcel = (g: ToaDoGoc, rowNo: number, c: number, target = 0): string =>
  `${columnLetter(cotExcel(g, c) + target)}${dongExcel(g, rowNo)}`;
/** Số cột mà file XUẤT dời dữ liệu gốc sang phải (cột "KẾT QUẢ" chèn ở đầu). */
export const DICH_COT_XUAT = 1;

// ---------- Dò cột theo tên (xử lý cột trùng — v3 §2.2) ----------

function findAllColumns(header: unknown[], ...tens: string[]): number[] {
  const norm = header.map((h) => chuan(h));
  const ra: number[] = [];
  for (const t of tens) {
    const k = chuan(t);
    norm.forEach((h, i) => {
      if (h === k && !ra.includes(i)) ra.push(i);
    });
  }
  if (ra.length) return ra;
  for (const t of tens) {
    const k = chuan(t);
    norm.forEach((h, i) => {
      if (h.startsWith(k) && !ra.includes(i)) ra.push(i);
    });
  }
  return ra;
}

const cot1 = (header: unknown[], ...tens: string[]): number => {
  const c = findAllColumns(header, ...tens);
  return c.length ? c[0] : -1;
};

/** Chọn cột chưa thuế/thuế/tổng khi trùng tên: tổ hợp khớp `a+b(−ck+phí)=tổng` nhất. */
function pickConsistentColumns(
  rows: unknown[][],
  dataStart: number,
  preTaxCandidates: number[],
  ucThue: number[],
  totalCandidates: number[],
  cCk: number,
  cPhi: number
): { chua: number; thue: number; tong: number; phu: number[] } {
  const list = <T,>(a: T[]) => (a.length ? a : [-1]);
  let best: { chua: number; thue: number; tong: number } | null = null;
  let bestErr = Infinity;
  for (const preTax of list(preTaxCandidates))
    for (const thue of list(ucThue))
      for (const total of list(totalCandidates)) {
        let err = 0;
        let n = 0;
        for (let i = dataStart; i < rows.length; i++) {
          const r = rows[i] ?? [];
          const a = soVN(r[preTax]);
          const b = soVN(r[thue]);
          const t = soVN(r[total]);
          if (a == null || b == null || t == null) continue;
          const ck = soVN(r[cCk]) ?? 0;
          const phi = soVN(r[cPhi]) ?? 0;
          err += Math.abs(a + b - ck + phi - t);
          n++;
        }
        if (n === 0) continue;
        if (err < bestErr) {
          bestErr = err;
          best = { chua: preTax, thue, tong: total };
        }
      }
  const chosen = best ?? { chua: preTaxCandidates[0] ?? -1, thue: ucThue[0] ?? -1, tong: totalCandidates[0] ?? -1 };
  const phu = [...preTaxCandidates, ...ucThue, ...totalCandidates].filter(
    (c) => c !== chosen.chua && c !== chosen.thue && c !== chosen.tong
  );
  return { ...chosen, phu: [...new Set(phu)] };
}

function findHeaderRow(rows: unknown[][], tuKhoa: string[]): number {
  let best = -1;
  let bestScore = 0;
  const gioiHan = Math.min(rows.length, 15);
  for (let i = 0; i < gioiHan; i++) {
    const cells = (rows[i] ?? []).map((c) => chuan(c));
    let score = 0;
    for (const k of tuKhoa) if (cells.some((c) => c.includes(k))) score++;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 2 ? best : -1;
}

function isTotalRow(row: unknown[]): boolean {
  const s = chuan(row[0]) || chuan(row[1]);
  return /^(tong|cong)\b/.test(s);
}

/**
 * MST người bán HỢP LỆ: đúng 10 hoặc 13 chữ số (bỏ mọi ký tự khác). Kế toán hay để
 * khối GHI CHÚ TAY cuối sheet HĐĐT ("CHÊNH LỆCH THUẾ VAT", "HOÁ ĐƠN CTY KHÔNG SỬ
 * DỤNG", "SỐ CỦA LINH 6 THÁNG"…) với con số 9–12 chữ số rơi vào ô MST — KHÔNG phải MST.
 */
function isValidTaxCode(v: unknown): boolean {
  const so = String(v ?? "").replace(/\D/g, "");
  return so.length === 10 || so.length === 13;
}

// ---------- Đọc workbook thô ----------

interface SheetTho {
  ten: string;
  rows: unknown[][];
  /** Hàng đầu vùng dữ liệu trong file Excel (0-based) — `sheet_to_json` bắt đầu từ đây. */
  r0: number;
  /** Cột đầu vùng dữ liệu trong file Excel (0-based). */
  c0: number;
  /** Số cột của vùng dữ liệu gốc. */
  rong: number;
}

function docSheetsTuBuffer(buf: ArrayBuffer | Uint8Array): SheetTho[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((ten) => {
    const ws = wb.Sheets[ten]!;
    const rg = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    return {
      ten,
      r0: rg.s.r,
      c0: rg.s.c,
      rong: rg.e.c - rg.s.c + 1,
      rows: XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        blankrows: true,
        defval: null,
      }),
    };
  }).filter((s) => s.rows.length > 0);
}

export async function docWorkbook(file: File): Promise<SheetTho[]> {
  return docSheetsTuBuffer(chuanHoaSangXlsx(new Uint8Array(await file.arrayBuffer())));
}

/**
 * Chuẩn hoá bytes workbook về **`.xlsx`**.
 *
 * Cổng thuế còn gửi bản `.xls` (BIFF cũ, kiểu "Composite Document"). SheetJS đọc
 * được nhưng `exceljs` — thứ lo phần xuất giữ định dạng — CHỈ đọc `.xlsx`; đưa
 * thẳng `.xls` vào là nó trả về workbook rỗng, phần xuất rơi về bản dựng-mới và
 * mất sạch bố cục. Nên đổi vỏ ngay từ lúc nạp, rồi MỌI khâu sau (đọc dữ liệu,
 * lưu bản, xuất file) đều dùng đúng một bộ bytes — khỏi lệch toạ độ giữa hai lần đọc.
 *
 * Bản `.xls` cổng thuế xuất ra là dữ liệu trần (không font/khung/công thức) nên
 * đổi vỏ không mất gì. `.xls` có định dạng thì định dạng sẽ rụng — không tránh được,
 * thư viện chạy trong trình duyệt không có cái nào đọc nổi dáng của BIFF.
 */
export function chuanHoaSangXlsx(u: Uint8Array): Uint8Array {
  // "PK" = đã là .xlsx (zip). Còn lại (D0CF11E0 = CFB/BIFF, hoặc .xlsb…) thì đổi vỏ.
  if (u[0] === 0x50 && u[1] === 0x4b) return u;
  const wb = XLSX.read(u, { type: "array", cellDates: true, cellNF: true });
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
}

/** File Excel → base64 (để LƯU file gốc theo tài khoản). Mã hoá theo khối, an toàn file lớn. */
export async function fileSangBase64(file: File): Promise<string> {
  const u = chuanHoaSangXlsx(new Uint8Array(await file.arrayBuffer()));
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u.length; i += CHUNK)
    bin += String.fromCharCode(...u.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** base64 → bytes workbook, đã chuẩn hoá về `.xlsx`. */
export function base64SangXlsx(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return chuanHoaSangXlsx(u);
}

/**
 * base64 (bản đã lưu) → các sheet thô, để MỞ LẠI chạy lại đối soát.
 * Chuẩn hoá `.xls` ở đây luôn: bản lưu từ trước khi có bước đổi vỏ vẫn là BIFF,
 * mà phần xuất thì đọc cùng bộ bytes này — hai bên phải thấy y hệt nhau.
 */
export function sheetsTuBase64(b64: string): SheetTho[] {
  return docSheetsTuBuffer(base64SangXlsx(b64));
}

/**
 * GỠ cột đối soát của lần chạy trước (v3 §1.5): nếu có hàng tiêu đề bắt đầu bằng
 * "KẾT QUẢ", bỏ cột KẾT QUẢ (0) + mọi cột có tiêu đề thuộc bộ cột engine tự thêm.
 * Trả rows đã sạch + cờ đã-gỡ. Chỉ bỏ CỘT (giữ số dòng để `soDong` không đổi).
 */
const ADDED_HEADERS_NORM = new Set(
  [...HEADER_HD_THEM, ...HEADER_PM_THEM, ...HEADER_KIEM, "KẾT QUẢ", "KIỂM CỘNG"].map(chuan)
);
/** Tiền tố của những cột engine tự thêm mà phần đuôi thay đổi theo file (tên sheet sổ…). */
const ADDED_HEADER_PREFIXES = ["so dong khop", "tong tt ben"].map(chuan);
/** Ô tiêu đề này có phải cột do engine thêm ở lần chạy trước không. */
const isExtraColumn = (h: unknown): boolean => {
  const k = chuan(h);
  return k !== "" && (ADDED_HEADERS_NORM.has(k) || ADDED_HEADER_PREFIXES.some((p) => k.startsWith(p)));
};
function stripOldReconcileCols(
  rows: unknown[][]
): { rows: unknown[][]; daGo: boolean; giuCot: number[] } {
  // Dò hàng tiêu đề của lần chạy trước: có ô "KẾT QUẢ" + ít nhất 3 cột engine thêm.
  let hIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i] ?? [];
    const hasLabelInA = ["ket qua", "kiem cong"].includes(chuan(h[0]));
    // v6.5: file chỉ có bảng kê xuất KHÔNG chèn cột A — nhận ra bằng đủ 3 cột kiểm.
    const hasAllCheckColumns = HEADER_KIEM.every((k) => h.some((c) => chuan(c) === chuan(k)));
    if ((hasLabelInA || hasAllCheckColumns || h.some((c) => chuan(c) === "ket qua")) && h.filter((c) => isExtraColumn(c)).length >= 3) {
      hIdx = i;
      break;
    }
  }
  if (hIdx < 0) return { rows, daGo: false, giuCot: [] };
  const header = rows[hIdx] ?? [];
  const width = Math.max(header.length, ...rows.map((r) => (r ?? []).length));
  const drop = new Set<number>();
  if (["ket qua", "kiem cong"].includes(chuan(header[0]))) drop.add(0); // cột nhãn chèn ở đầu

  // Khối cột thêm nằm LIỀN MẠCH ở cuối ⇒ gỡ từ cột thêm đầu tiên tới hết. Bền hơn
  // dò từng tên, vì vài tên đổi theo file (tên sheet sổ, cặp cột TK/thuế suất).
  let dau = -1;
  for (let c = 1; c < width; c++)
    if (isExtraColumn(header[c])) {
      dau = c;
      break;
    }
  if (dau < 0 && drop.size === 0) return { rows, daGo: false, giuCot: [] };
  if (dau > 0) {
    // cột đệm trống ngay trước khối → gỡ luôn, kẻo mỗi lần chạy lại đẻ thêm một cột
    const dem = dau - 1;
    const demTrong =
      dem > 0 && !chuan(header[dem]) && rows.every((r) => (r ?? [])[dem] == null || (r ?? [])[dem] === "");
    for (let c = demTrong ? dem : dau; c < width; c++) drop.add(c);
  }
  const keptColumns: number[] = [];
  for (let c = 0; c < width; c++) if (!drop.has(c)) keptColumns.push(c);
  const cleaned = rows.map((r) => (r ?? []).filter((_, c) => !drop.has(c)));
  return { rows: cleaned, daGo: true, giuCot: keptColumns };
}

/**
 * Dò sheet bị TRỘN HAI BỐ CỤC CỘT: dán hai bản xuất khác nhau (VD "có mã" 19 cột
 * + "không mã" 20 cột) vào cùng một sheet, trong khi chỉ có MỘT hàng tiêu đề.
 *
 * Hậu quả: những dòng thuộc bố cục kia lệch ô kể từ chỗ dư cột — trạng thái hóa
 * đơn, đơn vị tiền tệ, tỷ giá đọc sang ô bên cạnh. Engine có vá bằng cách dò theo
 * nội dung (`docTrangThaiHd`/`docTienTe`), nhưng vẫn phải BÁO: cách chữa đúng là
 * tách ra hai sheet rồi chạy lại, đừng để máy đoán.
 */
function detectMixedLayout(
  rows: unknown[][],
  hIdx: number
): { lech: number; binhThuong: number; cotHeader: number; cotLech: number } | null {
  const lastFilledIndex = (r: unknown[]) => {
    let k = -1;
    for (let c = 0; c < r.length; c++) if (r[c] != null && r[c] !== "") k = c;
    return k;
  };
  const headerLastColumn = lastFilledIndex(rows[hIdx] ?? []);
  if (headerLastColumn < 0) return null;
  const dem = new Map<number, number>();
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const k = lastFilledIndex(r);
    if (k < 0) continue;
    dem.set(k, (dem.get(k) ?? 0) + 1);
  }
  let lech = 0;
  let diffColumn = -1;
  for (const [k, n] of dem)
    if (k > headerLastColumn) {
      lech += n;
      diffColumn = Math.max(diffColumn, k);
    }
  if (!lech) return null;
  return { lech, binhThuong: [...dem].reduce((s, [k, n]) => s + (k > headerLastColumn ? 0 : n), 0), cotHeader: headerLastColumn, cotLech: diffColumn };
}

// ---------- Nhận diện sheet ----------

const invoiceHeaderRow = (rows: unknown[][]) =>
  findHeaderRow(rows, ["so hoa don", "ky hieu hoa don"]);

/**
 * Sheet SỔ: neo "so hd" (HĐĐT ghi "số hóa đơn" nên không nhận nhầm) + phần tiền.
 *
 * Phần tiền chấp nhận HAI kiểu xuất của phần mềm kế toán:
 *  - có cột TỔNG CỘNG (`Tổng cộng` / `TONGCONG`) — bản cũ, 1 dòng / hóa đơn;
 *  - KHÔNG có cột tổng, chỉ có tiền hàng + tiền thuế (`TIENHANG_CHUATHUE` +
 *    `TIEN_THUE`) — bản xuất CHI TIẾT MẶT HÀNG, 1 dòng / mặt hàng. Tổng khi đó
 *    phải tự cộng (`coCotTong = false` ở `parseSheetPhanMem`).
 */
function ledgerHeaderRow(rows: unknown[][]): number {
  const gioiHan = Math.min(rows.length, 15);
  for (let i = 0; i < gioiHan; i++) {
    const cells = (rows[i] ?? []).map((c) => chuan(c));
    const hasInvoiceNo = cells.some((c) => c.includes("so hd"));
    const hasTotal = cells.some((c) => c === "tongcong" || c.includes("tong cong"));
    const hasNetAmount = cells.some((c) => c.startsWith("tienhang") || c.startsWith("tien hang") || c.startsWith("st chua thue"));
    const hasTaxAmount = cells.some((c) => c === "tienthue" || c === "tien thue");
    if (hasInvoiceNo && (hasTotal || (hasNetAmount && hasTaxAmount))) return i;
  }
  return -1;
}

function layO(
  row: unknown[],
  columns: number,
  sheet: string,
  rowNo: number,
  edits?: Record<string, number>
): unknown {
  if (columns < 0) return null;
  const k = khoaSua(sheet, rowNo, columns);
  if (edits && k in edits) return edits[k];
  return row[columns];
}

function applyFixToRow(
  row: unknown[],
  header: string[],
  sheet: string,
  rowNo: number,
  edits: Record<string, number> | undefined,
  changeLog: { viTri: string; cu: string; moi: string }[],
  g: ToaDoGoc
): unknown[] {
  if (!edits) return row;
  let clone: unknown[] | null = null;
  for (const [k, v] of Object.entries(edits)) {
    const { sheet: sh, soDong: sd, cot: c } = tachKhoaSua(k);
    if (sh !== sheet || sd !== rowNo) continue;
    if (!clone) clone = [...row];
    const prev = row[c];
    clone[c] = v;
    changeLog.push({
      viTri: `${sheet} · ô ${oExcel(g, rowNo, c)} (${header[c] ?? ""})`,
      cu: prev == null || prev === "" ? "(trống)" : String(prev),
      moi: String(v),
    });
  }
  return clone ?? row;
}

// ---------- Nghi vấn cộng/thiếu (nhóm 1,2,4,5) ----------

interface SumColumns {
  /**
   * Hóa đơn BÁN HÀNG (ký hiệu mẫu số = 2): không có thuế GTGT ⇒ ô thuế để TRỐNG là
   * ĐÚNG, và chưa thuế phải bằng tổng thanh toán. Không có cờ này thì engine coi ô
   * thuế trống là "thiếu", rồi suy ngược tổng − chưa thuế thành số thuế — sai nguy
   * hiểm: kế toán bấm Sửa là khai khống thuế đầu vào cho hóa đơn vốn không có thuế.
   * (Bắt trên file thuế 6 tháng: 302/328 nghi vấn là báo oan kiểu này.)
   */
  banHang: boolean;
  chua: number;
  thue: number;
  tong: number;
  ck: number;
  phi: number;
  tenChua: string;
  tenThue: string;
  tenTong: string;
}

function suspectColumnSum(
  sheet: string,
  rowNo: number,
  row: unknown[],
  columns: SumColumns,
  edits: Record<string, number> | undefined,
  g: ToaDoGoc,
  /** Dung sai làm tròn theo ĐƠN VỊ của ô (đồng, hoặc nguyên tệ — `TOL_NGUYEN_TE`). */
  sumTolerance = TOL_LAM_TRON
): NghiVan | null {
  const a = soVN(layO(row, columns.chua, sheet, rowNo, edits));
  const b = soVN(layO(row, columns.thue, sheet, rowNo, edits));
  const t = soVN(layO(row, columns.tong, sheet, rowNo, edits));
  const ck = soVN(layO(row, columns.ck, sheet, rowNo, edits)) ?? 0;
  const phi = soVN(layO(row, columns.phi, sheet, rowNo, edits)) ?? 0;
  // Lệch 1 đồng là LÀM TRÒN của bên phát hành, không phải sai sót — báo lên chỉ làm
  // nhiễu (file thuế 6 tháng có 26 dòng lệch đúng ±1 đ). Phần này vẫn được cộng vào
  // bảng cân đối cột để tổng luôn khớp.
  const totalCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.tong)} (${columns.tenTong})`;
  const preTaxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.chua)} (${columns.tenChua})`;
  const oThue = `${sheet} · ô ${oExcel(g, rowNo, columns.thue)} (${columns.tenThue})`;
  const D = DICH_COT_XUAT;
  const exportTotalCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.tong, D)} (${columns.tenTong})`;
  const exportPreTaxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.chua, D)} (${columns.tenChua})`;
  const xThue = `${sheet} · ô ${oExcel(g, rowNo, columns.thue, D)} (${columns.tenThue})`;
  const coA = a != null, coB = b != null, coT = t != null;
  const soThieu = [coA, coB, coT].filter((x) => !x).length;

  // HÓA ĐƠN BÁN HÀNG (mẫu số 2) — không có thuế GTGT. Ô thuế trống/0 là ĐÚNG, đừng
  // đòi điền; chỗ phải soi là ô CHƯA THUẾ: nó phải bằng tổng thanh toán (trừ chiết
  // khấu, cộng phí). Sai thì chỉ vào ô chưa thuế, KHÔNG suy ngược thành số thuế.
  // CHỈ xét khi ô chưa thuế CÓ SỐ: bỏ trống cả cụm thì để nhánh nhóm 4 gom thống kê
  // như cũ (bung ra từng dòng là 60+ dòng nhiễu trên file thật, không giúp gì thêm).
  if (columns.banHang && coA) {
    if (!coT || (b ?? 0) !== 0) return null; // có thuế thật ⇒ không phải diện này
    const expected = t! + ck - phi;
    if (withinTolerance(a! - expected, sumTolerance)) return null;
    return {
      nhom: 1,
      viTri: preTaxCellRef,
      viTriXuat: exportPreTaxCellRef,
      soDangCo: num(a!),
      soDoiChung: num(expected),
      nguonDoiChung: `hóa đơn bán hàng (mẫu số 2) không có thuế GTGT ⇒ chưa thuế = ${columns.tenTong}${ck ? " + chiết khấu" : ""}${phi ? " − phí" : ""} = ${num(expected)}`,
      saiOCho: `chưa thuế ${num(a!)} nhưng tổng thanh toán ${num(t!)}, lệch ${num(expected - a!)} đ; hóa đơn này không có thuế nên hai số phải bằng nhau`,
      anhHuong: "sai cột chưa thuế khi lập tờ khai; KHÔNG được ghi phần lệch thành tiền thuế",
      sheet, soDong: rowNo, cot: columns.chua, tenCot: columns.tenChua, giaTriCu: a, giaTriDung: expected,
    };
  }

  // Nhóm 4: thiếu CẢ CỤM (không suy được) — chỉ còn tổng
  if (!coA && !coB && coT)
    return {
      nhom: 4,
      viTri: `${preTaxCellRef} + ${oThue}`,
      viTriXuat: `${exportPreTaxCellRef} + ${xThue}`,
      soDangCo: "(trống cả chưa thuế lẫn thuế)",
      soDoiChung: "chưa xác định",
      nguonDoiChung: "không đủ dữ liệu để tính ngược",
      saiOCho: `chỉ có tổng ${num(t!)} đ, thiếu cả hai thành phần`,
      anhHuong: "cột chưa thuế & thuế sẽ thiếu; tổng vẫn dùng được",
    };
  // Nhóm 5: TỔNG bị xóa nhưng thành phần còn → suy được, gộp thống kê
  if (!coT && coA && coB) {
    const expected = a! + b! - ck + phi;
    return {
      nhom: 5,
      viTri: totalCellRef,
      viTriXuat: exportTotalCellRef,
      soDangCo: "(trống)",
      soDoiChung: num(expected),
      nguonDoiChung: `${columns.tenChua} + ${columns.tenThue}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(a!)} + ${num(b!)}`,
      saiOCho: "ô tổng bị xóa trong khi các ô thành phần còn",
      anhHuong: "chỉ ô tổng; đối soát dùng tổng suy ra",
      sheet, soDong: rowNo, cot: columns.tong, tenCot: columns.tenTong, giaTriCu: t, giaTriDung: expected,
    };
  }
  // Nhóm 2: thiếu ĐÚNG MỘT thành phần, tổng còn → suy được
  if (coT && soThieu === 1 && (!coA || !coB)) {
    if (!coA) {
      const expected = t! - b! + ck - phi;
      return {
        nhom: 2, viTri: preTaxCellRef, viTriXuat: exportPreTaxCellRef, soDangCo: "(trống)", soDoiChung: num(expected),
        nguonDoiChung: `${columns.tenTong} − ${columns.tenThue}${ck ? " + chiết khấu" : ""}${phi ? " − phí" : ""} = ${num(t!)} − ${num(b!)}`,
        saiOCho: "thiếu ô chưa thuế, suy ngược từ tổng và thuế", anhHuong: "chỉ ô chưa thuế",
        sheet, soDong: rowNo, cot: columns.chua, tenCot: columns.tenChua, giaTriCu: a, giaTriDung: expected,
      };
    }
    const expectedTax = t! - a! + ck - phi;
    return {
      nhom: 2, viTri: oThue, viTriXuat: xThue, soDangCo: "(trống)", soDoiChung: num(expectedTax),
      nguonDoiChung: `${columns.tenTong} − ${columns.tenChua} = ${num(t!)} − ${num(a!)}`,
      saiOCho: "thiếu ô thuế, suy ngược từ tổng và chưa thuế", anhHuong: "chỉ ô thuế",
      sheet, soDong: rowNo, cot: columns.thue, tenCot: columns.tenThue, giaTriCu: b, giaTriDung: expectedTax,
    };
  }
  // Nhóm 1: đủ thành phần nhưng CỘNG KHÔNG KHỚP — chỉ báo khi CẢ HAI cách lệch
  if (coA && coB && coT) {
    const e1 = Math.abs(a! + b! - t!);
    const e2 = Math.abs(a! + b! - ck + phi - t!);
    if (!withinTolerance(e1, sumTolerance) && !withinTolerance(e2, sumTolerance) && b !== 0) {
      const expected = a! + b! - ck + phi;
      return {
        nhom: 1, viTri: totalCellRef, viTriXuat: exportTotalCellRef, soDangCo: num(t!), soDoiChung: num(expected),
        nguonDoiChung: `${columns.tenChua} + ${columns.tenThue}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(expected)} (giả định tổng sai)`,
        saiOCho: `cộng lệch cả hai cách: |${num(a!)}+${num(b!)}−${num(t!)}| = ${num(e1)} đ và tính cả chiết khấu/phí vẫn lệch ${num(e2)} đ`,
        anhHuong: "nếu sửa tổng: đổi ô tổng dòng này; các dòng khác không đổi",
        sheet, soDong: rowNo, cot: columns.tong, tenCot: columns.tenTong, giaTriCu: t, giaTriDung: expected,
      };
    }
  }
  return null;
}

function addToGroup(gopMap: Map<string, NghiVanGop>, nv: NghiVan, amount: number, ben: "hd" | "pm") {
  const gk = `${ben}${nv.nhom}`;
  const g = gopMap.get(gk) ?? {
    nhom: nv.nhom,
    ten:
      (nv.nhom === 4 ? "Thiếu cả cụm (chỉ còn tổng)" : "Tổng bị xóa (thành phần còn)") +
      (ben === "hd" ? " — hóa đơn" : " — phần mềm"),
    soDong: 0,
    tongTien: 0,
    canhBao:
      nv.nhom === 4
        ? "Thiếu chưa thuế & thuế — đừng lấy cột chưa thuế đi lập tờ khai."
        : "Ô tổng bị xóa; đối soát dùng tổng suy ra — soát lại có hợp lý không.",
    chiTiet: [],
  };
  g.soDong++;
  g.tongTien += amount;
  g.chiTiet.push(nv);
  gopMap.set(gk, g);
}

// ---------- Parse sheet HĐĐT ----------

function parseInvoiceSheet(
  ten: string,
  rows: unknown[][],
  hIdx: number,
  edits: Record<string, number> | undefined,
  nghiVan: NghiVan[],
  gopMap: Map<string, NghiVanGop>,
  changeLog: { viTri: string; cu: string; moi: string }[],
  g: ToaDoGoc,
  width: number,
  /** Dòng ngoại tệ của sheet này để NGUYÊN TỆ (đã dò quy ước) ⇒ dung sai làm tròn theo xu, không theo đồng. */
  originalCurrency = false
): { sheet: SheetHoaDon; loiParse: number } {
  const headerRaw = rows[hIdx] ?? [];
  const header = headerRaw.map((c) => String(c ?? ""));
  const preRows = rows.slice(0, hIdx);
  const dataStart = hIdx + 1;

  const cCk = cot1(headerRaw, "Tổng tiền chiết khấu thương mại");
  const cPhi = cot1(headerRaw, "Tổng tiền phí");
  const sel = pickConsistentColumns(
    rows, dataStart,
    findAllColumns(headerRaw, "Tổng tiền chưa thuế"),
    findAllColumns(headerRaw, "Tổng tiền thuế"),
    findAllColumns(headerRaw, "Tổng tiền thanh toán"),
    cCk, cPhi
  );
  const cFormNo = cot1(headerRaw, "Ký hiệu mẫu số");
  /** Mẫu số 2 = hóa đơn bán hàng (không có thuế GTGT). Đổi theo TỪNG DÒNG. */
  const isSalesRow = (row: unknown[]) => cFormNo >= 0 && String(row[cFormNo] ?? "").trim() === "2";
  const cCols: SumColumns = {
    banHang: false,
    chua: sel.chua, thue: sel.thue, tong: sel.tong, ck: cCk, phi: cPhi,
    tenChua: header[sel.chua] ?? "Tổng tiền chưa thuế",
    tenThue: header[sel.thue] ?? "Tổng tiền thuế",
    tenTong: header[sel.tong] ?? "Tổng tiền thanh toán",
  };
  const cKyHieu = cot1(headerRaw, "Ký hiệu hóa đơn");
  const cSo = cot1(headerRaw, "Số hóa đơn");
  const cDate = cot1(headerRaw, "Ngày lập");
  const cMstBan = cot1(headerRaw, "MST người bán/MST người xuất hàng", "MST người bán");
  const cSellerName = cot1(headerRaw, "Tên người bán/Tên người xuất hàng", "Tên người bán");
  const cDvt = cot1(headerRaw, "Đơn vị tiền tệ");
  const cExchangeRate = cot1(headerRaw, "Tỷ giá");
  const cStatus = cot1(headerRaw, "Trạng thái hóa đơn");
  const lastHeaderColumn = (() => {
    let k = -1;
    for (let c = 0; c < headerRaw.length; c++) if (headerRaw[c] != null && headerRaw[c] !== "") k = c;
    return k;
  })();
  const isRowWider = (r: unknown[]) => {
    for (let c = r.length - 1; c > lastHeaderColumn; c--) if (r[c] != null && r[c] !== "") return true;
    return false;
  };

  for (const p of sel.phu)
    nghiVan.push({
      nhom: 6,
      viTri: `${ten} · cột ${columnLetter(cotExcel(g, p))} (${header[p] ?? ""})`,
      viTriXuat: `${ten} · cột ${columnLetter(cotExcel(g, p) + DICH_COT_XUAT)} (${header[p] ?? ""})`,
      soDangCo: "(cột phụ trùng tên cột gốc)",
      soDoiChung: "—",
      nguonDoiChung: "cột gốc đã chọn theo độ khớp với tổng thanh toán",
      saiOCho: "người dùng tự thêm cột trùng tên; giá trị có thể khác cột gốc",
      anhHuong: "KHÔNG tham gia đối soát; chỉ ảnh hưởng ô tổng người dùng tự cộng",
    });

  const dong: DongHoaDon[] = [];
  let loiParse = 0;
  // --- cân đối cột: cộng đúng như kế toán cộng trên Excel (số THÔ, không quy tỷ giá) ---
  const cd: CanDoiCot = {
    cotChua: cCols.chua, cotThue: cCols.thue, cotTong: cCols.tong,
    tenChua: cCols.tenChua, tenThue: cCols.tenThue, tenTong: cCols.tenTong,
    sumChua: 0, sumThue: 0, sumCk: 0, sumPhi: 0, sumTong: 0, lech: 0,
    boc: { phi: 0, chietKhau: 0, lamTron: 0, lechThat: 0 },
    soDong: { phi: 0, chietKhau: 0, lamTron: 0, lechThat: 0 },
    dongLechThat: [],
    cotPhi: cCols.phi, cotCk: cCols.ck, dongLech: [], oTuDat: null,
  };
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isTotalRow(row)) continue;
    const rowNo = i + 1;
    const invoiceNo = String(layO(row, cSo, ten, rowNo, edits) ?? "").trim();
    const kyHieu = String(layO(row, cKyHieu, ten, rowNo, edits) ?? "").trim();
    // Bỏ dòng GHI CHÚ TAY của kế toán ở CUỐI sheet (khối "chênh lệch / hoá đơn cty
    // chưa kê khai / số của Linh…"): mọi hóa đơn thật đều có KÝ HIỆU hoặc MST người
    // bán hợp lệ — dòng ghi chú không có cả hai nên KHÔNG cộng, KHÔNG báo "chưa có
    // trong sổ", KHÔNG gắn "lệch thật" (số kế toán đang tự tính, đừng đụng vào).
    if (!kyHieu && !isValidTaxCode(cellStr(row, cMstBan))) continue;

    const tt = readCurrency(row, cDvt, cExchangeRate);
    const dvt = tt.dvt || "VND";
    const laVnd = chuan(dvt) === "vnd" || chuan(dvt) === "";
    const rawExchangeRate = soVN(tt.tyGiaRaw);
    const missingExchangeRate = !laVnd && !(rawExchangeRate && rawExchangeRate > 0);
    const exchangeRate = laVnd || missingExchangeRate ? 1 : rawExchangeRate!;
    const tol = originalCurrency && exchangeRate > 1 ? TOL_NGUYEN_TE : TOL_LAM_TRON;
    const preTax = soVN(layO(row, cCols.chua, ten, rowNo, edits));
    const thue = soVN(layO(row, cCols.thue, ten, rowNo, edits));
    const total = soVN(layO(row, cCols.tong, ten, rowNo, edits));
    if (total == null) loiParse++;

    const nv = suspectColumnSum(ten, rowNo, row, { ...cCols, banHang: isSalesRow(row) }, edits, g, tol);
    if (nv) {
      if (nv.nhom === 4 || nv.nhom === 5) addToGroup(gopMap, nv, (nv.nhom === 4 ? total : nv.giaTriDung) ?? 0, "hd");
      else nghiVan.push(nv);
    }

    // cộng cột + bóc nguyên nhân lệch của CHÍNH dòng này
    let rowSumMismatch: DongHoaDon["lechCong"] = null;
    {
      const a = soVN(row[cCols.chua]) ?? 0, b = soVN(row[cCols.thue]) ?? 0;
      const ck = cCols.ck >= 0 ? soVN(row[cCols.ck]) ?? 0 : 0;
      const phi = cCols.phi >= 0 ? soVN(row[cCols.phi]) ?? 0 : 0;
      const tg = soVN(row[cCols.tong]) ?? 0;
      cd.sumChua += a; cd.sumThue += b; cd.sumCk += ck; cd.sumPhi += phi; cd.sumTong += tg;
      const d = tg - (a + b);
      if (Math.abs(d) > tol / 2) {
        // thứ tự xét: làm tròn → phí → chiết khấu → lệch thật (phí/chiết khấu là
        // thành phần HỢP LỆ của tổng, không phải sai sót)
        const mismatchKind: LoaiLechCong =
          withinTolerance(d, tol) ? "lamTron"
          : phi && withinTolerance(d - phi, tol) ? "phi"
          : ck && withinTolerance(d + ck, tol) ? "chietKhau"
          : "that";
        rowSumMismatch = { lech: d, loai: mismatchKind };
        const k = mismatchKind === "that" ? "lechThat" : mismatchKind;
        cd.boc[k] += d;
        cd.soDong[k]++;
        const ma = `${kyHieu}-${invoiceNo}`;
        const date = ngayHienThi(row[cDate]);
        const ban = cellStr(row, cSellerName);
        cd.dongLech.push({ dongFile: dongExcel(g, rowNo), ma, ngay: date, ban, chua: a, thue: b, phi, ck, tong: tg, lech: d, loai: mismatchKind });
        if (mismatchKind === "that") cd.dongLechThat.push({ dongFile: dongExcel(g, rowNo), ma, ngay: date, ban, lech: d });
      }
    }

    const soChuan = soHoaDonChuan(invoiceNo);
    const mstBan = cellStr(row, cMstBan);
    const invoiceStatus = readInvoiceStatus(row, cStatus);
    dong.push({
      sheet: ten, soDong: rowNo, dongFile: dongExcel(g, rowNo),
      lechCong: rowSumMismatch,
      trangThaiHd: invoiceStatus,
      khongCanVaoSo: isNotBookable(invoiceStatus),
      boCucLech: isRowWider(row),
      cells: applyFixToRow(row, header, ten, rowNo, edits, changeLog, g),
      kyHieu, soHoaDon: invoiceNo, soChuan,
      ngayLap: ngayHienThi(row[cDate]),
      mstBan, tenBan: cellStr(row, cSellerName), dvt, tyGia: exchangeRate,
      ...(missingExchangeRate ? { thieuTyGia: missingExchangeRate } : {}),
      chuaThueRaw: preTax ?? 0,
      thueRaw: thue ?? 0,
      tongTtRaw: total ?? 0,
      chuaThueVnd: (preTax ?? 0) * exchangeRate,
      thueVnd: (thue ?? 0) * exchangeRate,
      tongTtVnd: (total ?? 0) * exchangeRate,
      khoa: makeKey(mstBan, kyHieu, soChuan),
      soDongKhopPm: 0, tongTtPm: 0, chenh: null, trangThai: "THIEU",
      ketLuan: "", bangChung: "", phieuKe: "", ctgs: "", ngayGhiSo: "",
      tkNoCo: "", dienGiaiPm: "", soTienHachToan: null,
    });
  }
  cd.lech = cd.sumTong - (cd.sumChua + cd.sumThue);
  cd.dongLechThat.sort((x, y) => Math.abs(y.lech) - Math.abs(x.lech));
  cd.oTuDat = findCustomTotalCell(rows, dataStart, cd, g, (r) => !String(r[cSo] ?? "").trim() && !String(r[cKyHieu] ?? "").trim());
  return { sheet: { ten, header, preRows, dong, goc: g, hIdx, rong: width, canDoiCot: cd }, loiParse };
}

/**
 * Tìm ô LỆCH kế toán tự đặt dưới bảng kê. Họ hay gõ: dòng SUM từng cột, một ô
 * "chưa thuế + thuế (+ phí)", rồi một ô lấy tổng trừ đi — con số họ đang nhìn và
 * hỏi "lệch ở đâu". Nhận ra ô đó để trả lời đúng CON SỐ CỦA HỌ, không bắt họ đổi
 * công thức. Chỉ xét hàng không phải dòng hóa đơn; lấy ô khớp ở hàng thấp nhất.
 */
function findCustomTotalCell(
  rows: unknown[][],
  dataStart: number,
  cd: CanDoiCot,
  g: ToaDoGoc,
  isOutsideRow: (r: unknown[]) => boolean
): OTuDat | null {
  const cach: Omit<OTuDat, "dongFile" | "cot" | "giaTri" | "dau">[] = [
    { congPhi: false, truCk: false },
    { congPhi: true, truCk: false },
    { congPhi: true, truCk: true },
    { congPhi: false, truCk: true },
  ];
  const mong = (c: (typeof cach)[number]) => cd.lech - (c.congPhi ? cd.sumPhi : 0) + (c.truCk ? cd.sumCk : 0);
  // Ô bằng đúng TỔNG MỘT CỘT là ô SUM của cột đó, không phải ô lệch (VD bảng kê khớp
  // tuyệt đối, lệch 0 ⇒ "lệch + Σ chiết khấu" trùng ngay ô SUM cột chiết khấu).
  const isColumnTotal = (x: number) =>
    [cd.sumChua, cd.sumThue, cd.sumTong, cd.sumPhi, cd.sumCk].some((t) => t && Math.abs(Math.abs(x) - Math.abs(t)) <= 0.5);
  let ra: OTuDat | null = null;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (!isOutsideRow(r) && !isTotalRow(r)) continue;
    r.forEach((v, c) => {
      const x = typeof v === "number" ? v : null;
      if (x == null || Math.abs(x) <= 1 || isColumnTotal(x)) return;
      for (const k of cach) {
        // phí/chiết khấu bằng 0 thì các cách trùng nhau — lấy cách đơn giản nhất
        if ((k.congPhi && !cd.sumPhi) || (k.truCk && !cd.sumCk)) continue;
        const m = mong(k);
        const dau = Math.abs(x - m) <= 0.5 ? 1 : Math.abs(x + m) <= 0.5 ? -1 : 0;
        if (dau) {
          ra = { ...k, dau, giaTri: x, dongFile: dongExcel(g, i + 1), cot: c };
          break;
        }
      }
    });
  }
  return ra;
}

// ---------- Parse sheet PHẦN MỀM ----------

function parseLedgerSheet(
  ten: string,
  rows: unknown[][],
  hIdx: number,
  edits: Record<string, number> | undefined,
  nghiVan: NghiVan[],
  gopMap: Map<string, NghiVanGop>,
  changeLog: { viTri: string; cu: string; moi: string }[],
  g: ToaDoGoc,
  width: number
): SheetPhanMem {
  const headerRaw = rows[hIdx] ?? [];
  const header = headerRaw.map((c) => String(c ?? ""));
  const dataStart = hIdx + 1;

  const sel = pickConsistentColumns(
    rows, dataStart,
    findAllColumns(headerRaw, "ST chưa thuế", "TIENHANG", "TIENHANG_CHUATHUE"),
    findAllColumns(headerRaw, "Tiền thuế", "TIENTHUE", "TIEN_THUE"),
    findAllColumns(headerRaw, "Tổng cộng", "TONGCONG"),
    -1, -1
  );
  const cCols: SumColumns = {
    banHang: false, // sổ kế toán không có khái niệm mẫu số hóa đơn
    chua: sel.chua, thue: sel.thue, tong: sel.tong, ck: -1, phi: -1,
    tenChua: header[sel.chua] ?? "ST chưa thuế",
    tenThue: header[sel.thue] ?? "Tiền thuế",
    tenTong: header[sel.tong] ?? "Tổng cộng",
  };
  const cCtgs = cot1(headerRaw, "CTGS", "SCT_GHISO");
  const cVoucher = cot1(headerRaw, "Phiếu", "SO_PHIEU");
  const cKyHieu = cot1(headerRaw, "KHHĐ", "KY_HIEU", "KH_HD");
  const cSo = cot1(headerRaw, "Số HĐ", "SO_HD");
  // "MST người bán" đứng trước "MST" để bước khớp-đầu-chữ không vớ nhầm "MST người mua".
  const cMst = cot1(headerRaw, "MASOTHUE", "RMST", "MS_THUE", "MST người bán", "Mã số thuế", "MST");
  const cInvoiceDate = cot1(headerRaw, "Ngày HĐ", "NGAY_HD");
  // Sổ mã máy (PMEM) không có TK Nợ/Có mà có TS% + LOAI ⇒ nhận cả hai kiểu,
  // tên cột ở file xuất lấy đúng theo tiêu đề tìm được (`tenTk`).
  const cTkNo = cot1(headerRaw, "TK Nợ", "TS%", "Thuế suất");
  const cTkCo = cot1(headerRaw, "TK Có", "LOAI", "Loại");
  const cDescription = cot1(headerRaw, "Tên mặt hàng", "MAT_HANG", "NOIDUNG", "GHICHU");
  const cSellerName = cot1(headerRaw, "Tên người bán", "NGUOI_BAN", "DONVIBAN");
  // Bản xuất chi tiết mặt hàng KHÔNG có cột tổng ⇒ tổng = tiền hàng + tiền thuế,
  // và KHÔNG được soi "cộng có khớp tổng không" (không có tổng để soi — soi là báo
  // oan cả sổ thành "tổng bị xóa").
  const hasTotalColumn = cCols.tong >= 0;

  for (const p of sel.phu)
    nghiVan.push({
      nhom: 6,
      viTri: `${ten} · cột ${columnLetter(cotExcel(g, p))} (${header[p] ?? ""})`,
      viTriXuat: `${ten} · cột ${columnLetter(cotExcel(g, p) + DICH_COT_XUAT)} (${header[p] ?? ""})`,
      soDangCo: "(cột phụ trùng tên)",
      soDoiChung: "—",
      nguonDoiChung: "cột gốc chọn theo độ khớp với tổng cộng",
      saiOCho: "cột trùng tên do người dùng thêm",
      anhHuong: "KHÔNG tham gia đối soát",
    });

  const dong: DongPhanMem[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isTotalRow(row)) continue;
    const rowNo = i + 1;
    const invoiceNo = String(layO(row, cSo, ten, rowNo, edits) ?? "").trim();
    const kyHieu = String(layO(row, cKyHieu, ten, rowNo, edits) ?? "").trim();
    if (!invoiceNo && !kyHieu) continue;

    const nv = hasTotalColumn ? suspectColumnSum(ten, rowNo, row, cCols, edits, g) : null;
    if (nv) {
      if (nv.nhom === 4 || nv.nhom === 5) addToGroup(gopMap, nv, (nv.nhom === 4 ? soVN(row[cCols.tong]) : nv.giaTriDung) ?? 0, "pm");
      else nghiVan.push(nv);
    }

    const soChuan = soHoaDonChuan(invoiceNo);
    const mstBan = cellStr(row, cMst);
    dong.push({
      sheet: ten, soDong: rowNo, dongFile: dongExcel(g, rowNo),
      cells: applyFixToRow(row, header, ten, rowNo, edits, changeLog, g),
      ctgs: cellStr(row, cCtgs), phieu: cellStr(row, cVoucher),
      kyHieu, soHoaDon: invoiceNo, soChuan, mstBan, tenBan: cellStr(row, cSellerName),
      tongCong: hasTotalColumn
        ? soVN(layO(row, cCols.tong, ten, rowNo, edits)) ?? 0
        : (soVN(layO(row, cCols.chua, ten, rowNo, edits)) ?? 0) + (soVN(layO(row, cCols.thue, ten, rowNo, edits)) ?? 0),
      chuaThue: soVN(layO(row, cCols.chua, ten, rowNo, edits)) ?? 0,
      thue: soVN(layO(row, cCols.thue, ten, rowNo, edits)) ?? 0,
      ngayHd: ngayHienThi(row[cInvoiceDate]),
      tkNo: cellStr(row, cTkNo), tkCo: cellStr(row, cTkCo), dienGiai: cellStr(row, cDescription),
      khoa: makeKey(mstBan, kyHieu, soChuan),
      soHddtKhop: 0, trangThai: "THIEU", ketLuan: "", bangChung: "",
      nguonHddt: "", dongHddt: null, ngayLapHd: "", tenBanHddt: "", tongTtHddt: null,
    });
  }
  // Tiêu đề mã máy viết hoa trần (TS%, LOAI) — đổi sang chữ kế toán vẫn gọi.
  const chuDep: Record<string, string> = { "ts%": "Thuế suất", loai: "Loại", ghichu: "Ghi chú" };
  const label = (c: number, mac: string) => {
    const t = String(header[c] ?? "").trim();
    return t ? (chuDep[chuan(t)] ?? t) : mac;
  };
  const tenTk = `${label(cTkNo, "TK Nợ")} / ${label(cTkCo, "TK Có")}`;
  return { ten, header, dong, goc: g, hIdx, rong: width, tenTk, coCotTong: hasTotalColumn, coCotMst: cMst >= 0 };
}

const uniq = (arr: string[]): string[] => [...new Set(arr.filter(Boolean))];

// ---------- Orchestrator ----------

/**
 * TỰ DÒ QUY ƯỚC NGOẠI TỆ của file — vì cổng thuế "tùy lúc": có bản xuất để tiền hóa
 * đơn ngoại tệ ở NGUYÊN TỆ gốc (phải nhân tỷ giá mới ra VND), có bản đã QUY SẴN ra VND
 * (nhân tỷ giá nữa là đội lên gấp ~tỷ giá lần → tổng phình từ vài trăm tỷ thành vài chục
 * nghìn tỷ). Không cố định được nên không đoán mò: lấy những hóa đơn NGOẠI TỆ đã KHỚP
 * được dòng sổ (sổ kế toán luôn ghi VND) làm mẫu, so số GỐC và số ĐÃ NHÂN tỷ giá xem bên
 * nào sát sổ hơn — đó là quy ước của file này, rồi áp cho MỌI dòng ngoại tệ.
 *
 * Chỉ hạ tỷ giá về 1 (bỏ nhân) khi số GỐC sát sổ hơn hẳn; nếu không có mẫu đối chiếu thì
 * GIỮ NGUYÊN hành vi cũ (nhân tỷ giá) và bắn cảnh báo để kế toán soát tay.
 */
/** Hạ các dòng ngoại tệ về SỐ GỐC (cổng đã quy sẵn VND) — tỷ giá áp dụng = 1. */
function revertToOriginal(ds: readonly DongHoaDon[]): void {
  for (const d of ds) {
    d.chuaThueVnd = d.chuaThueRaw;
    d.thueVnd = d.thueRaw;
    d.tongTtVnd = d.tongTtRaw;
    d.tyGia = 1; // tỷ giá ÁP DỤNG = 1 (rate gốc vẫn còn ở cột "Tỷ giá" của file nguồn)
  }
}

/**
 * Dò quy ước ngoại tệ TỪNG SHEET bằng BẢN KIA khi không có sổ làm mốc.
 *
 * File so hai bản (thuế gửi ⇄ tự tải) thường không kèm sổ, và hai bản có thể để tiền
 * ngoại tệ theo HAI quy ước khác nhau: file "Gửi lại.xls" (2026-09-25) bản thuế đã quy
 * sẵn VND (~69 tr) trong khi bản tự tải để USD (×tỷ giá ra ~68,7 tr). Nhân cả hai ⇒ bản
 * thuế phình thành ~42 NGHÌN tỷ, 198 hóa đơn báo "lệch tiền" oan.
 *
 * Cách dò: hóa đơn ngoại tệ có mặt ở một sheet KHÁC (cùng khóa) ⇒ so số gốc và số
 * ×tỷ giá của nó với các giá trị có thể của dòng bên kia (số gốc, và ×tỷ giá nếu bên
 * kia cũng ngoại tệ). Chỉ bỏ phiếu khi một giả thiết sát (<5%) còn giả thiết kia xa hẳn
 * (>50%) — hai sheet cùng quy ước thì hai giả thiết HÒA nhau ⇒ không phiếu, giữ mặc định.
 * Trả về các dòng ngoại tệ CHƯA kết luận được.
 */
function detectConventionFromPeer(
  all: readonly SheetHoaDon[],
  warnings: CanhBao[],
  /** Chỉ KẾT LUẬN cho các sheet này (mốc vẫn lấy từ mọi sheet). */
  onlyCheck: readonly SheetHoaDon[] = all
): DongHoaDon[] {
  const theoKhoa = new Map<string, DongHoaDon[]>();
  for (const sh of all)
    for (const d of sh.dong) {
      if (d.boCucLech || !d.khoa) continue; // cột tiền lệch ô — không làm mốc được
      const a = theoKhoa.get(d.khoa);
      if (a) a.push(d);
      else theoKhoa.set(d.khoa, [d]);
    }
  const salesInvoice = new Map<string, { goc: number; nhan: number }>();
  for (const ds of theoKhoa.values())
    for (const d of ds) {
      if (!(d.tyGia > 1) || !d.tongTtRaw) continue;
      const moc: number[] = [];
      for (const e of ds) {
        if (e.sheet === d.sheet || !e.tongTtRaw) continue;
        moc.push(e.tongTtRaw);
        if (e.tyGia > 1) moc.push(e.tongTtRaw * e.tyGia);
      }
      if (!moc.length) continue;
      const relativeError = (v: number) => Math.min(...moc.map((m) => Math.abs(v - m) / Math.max(Math.abs(v), Math.abs(m))));
      const rawError = relativeError(d.tongTtRaw);
      const multipliedError = relativeError(d.tongTtRaw * d.tyGia);
      const p = salesInvoice.get(d.sheet) ?? { goc: 0, nhan: 0 };
      if (rawError < 0.05 && multipliedError > 0.5) p.goc++;
      else if (multipliedError < 0.05 && rawError > 0.5) p.nhan++;
      salesInvoice.set(d.sheet, p);
    }

  const unresolved: DongHoaDon[] = [];
  for (const sh of onlyCheck) {
    const nt = sh.dong.filter((d) => d.tyGia > 1);
    if (!nt.length) continue;
    const p = salesInvoice.get(sh.ten);
    if (p && p.goc > p.nhan) {
      revertToOriginal(nt);
      warnings.push({
        loai: "Đơn vị tiền tệ ngoại tệ",
        chiTiet: `Sheet "${sh.ten}": ${nt.length} hóa đơn ngoại tệ đã QUY SẴN ra VND ở cột tiền — KHÔNG nhân tỷ giá (không có sổ, đối chiếu với bản còn lại: ${p.goc} hóa đơn có số GỐC sát bản kia, ${p.nhan} hóa đơn sát khi ×tỷ giá).`,
      });
    } else if (p && p.nhan > p.goc) {
      warnings.push({
        loai: "Đơn vị tiền tệ ngoại tệ",
        chiTiet: `Sheet "${sh.ten}": ${nt.length} hóa đơn ngoại tệ để NGUYÊN TỆ — quy về VND bằng cách NHÂN tỷ giá (không có sổ, đối chiếu với bản còn lại: ${p.nhan} hóa đơn sát bản kia khi ×tỷ giá, ${p.goc} hóa đơn sát khi để nguyên).`,
      });
    } else unresolved.push(...nt);
  }
  return unresolved;
}

function detectForeignCurrencyMode(
  hdActive: SheetHoaDon[],
  pmTheoKhoa: Map<string, DongPhanMem[]>,
  warnings: CanhBao[],
  allInvoiceSheets: readonly SheetHoaDon[] = hdActive,
): void {
  if (!allInvoiceSheets.some((sh) => sh.dong.some((d) => d.tyGia > 1))) return; // file toàn VND — không có gì để dò
  const fxRows: DongHoaDon[] = [];
  for (const sh of hdActive)
    for (const d of sh.dong) if (d.tyGia > 1) fxRows.push(d);

  // Mẫu: hóa đơn ngoại tệ có dòng sổ cùng khóa. So sai số tương đối với sổ.
  let rawCloserCount = 0; // số mẫu mà SỐ GỐC sát sổ hơn (⇒ cổng đã quy sẵn VND)
  let multipliedCloserCount = 0; // số mẫu mà SỐ ×TỶ GIÁ sát sổ hơn (⇒ để nguyên tệ, phải nhân)
  let sampleCount = 0;
  for (const d of fxRows) {
    const pm = pmTheoKhoa.get(d.khoa);
    if (!pm?.length) continue;
    const so = pm.reduce((s, x) => s + x.tongCong, 0);
    if (!(so > 0)) continue;
    sampleCount++;
    const rawError = Math.abs(so - d.tongTtRaw) / so; // số gốc so với sổ
    const multipliedError = Math.abs(so - d.tongTtRaw * d.tyGia) / so; // số ×tỷ giá so với sổ
    if (rawError < multipliedError) rawCloserCount++;
    else if (multipliedError < rawError) multipliedCloserCount++;
  }

  if (sampleCount === 0) {
    // Không có sổ làm mốc ⇒ thử lấy bản còn lại (file so hai bản) làm mốc, từng sheet.
    const unresolved = detectConventionFromPeer(allInvoiceSheets, warnings);
    if (!unresolved.length) return;
    warnings.push({
      loai: "Đơn vị tiền tệ ngoại tệ",
      chiTiet: `${unresolved.length} hóa đơn ngoại tệ nhưng KHÔNG có hóa đơn nào khớp được dòng sổ để đối chiếu — engine tạm QUY VỀ VND bằng cách NHÂN tỷ giá (hành vi mặc định). Nếu cổng thuế đã ghi sẵn VND thì số sẽ bị đội lên; hãy soát tay vài dòng ngoại tệ rồi báo lại.`,
    });
    return;
  }

  // Số gốc sát sổ hơn ở đa số mẫu ⇒ cổng đã quy sẵn VND ⇒ BỎ nhân tỷ giá.
  const daVnd = rawCloserCount > multipliedCloserCount;
  if (daVnd) {
    revertToOriginal(fxRows);
    warnings.push({
      loai: "Đơn vị tiền tệ ngoại tệ",
      chiTiet: `${fxRows.length} hóa đơn ngoại tệ: cổng thuế đã QUY SẴN ra VND ở cột tiền — engine KHÔNG nhân tỷ giá (đối chiếu ${sampleCount} hóa đơn khớp sổ: ${rawCloserCount} dòng có số GỐC sát sổ, chỉ ${multipliedCloserCount} dòng sát khi ×tỷ giá). Nếu sai, đây là dấu hiệu bản xuất lần này để nguyên tệ — báo lại để chỉnh.`,
    });
  } else {
    warnings.push({
      loai: "Đơn vị tiền tệ ngoại tệ",
      chiTiet: `${fxRows.length} hóa đơn ngoại tệ: engine QUY về VND bằng cách NHÂN tỷ giá (đối chiếu ${sampleCount} hóa đơn khớp sổ: ${multipliedCloserCount} dòng sát sổ khi ×tỷ giá, ${rawCloserCount} dòng sát khi để nguyên). Cột tiền của cổng thuế đang ở nguyên tệ.`,
    });
  }

  // Sheet KHÔNG đối soát với sổ (tập con / bản tự tải) vẫn hiện ở "So hai bản" ⇒ phải
  // cùng đơn vị. Dò theo bản kia (hai bản có thể khác quy ước); không dò được thì theo
  // quy ước vừa chốt bằng sổ — để nguyên ×tỷ giá là lệch oan cả trăm tỉ khi so hai bản.
  const inactiveSheets = allInvoiceSheets.filter((sh) => !hdActive.includes(sh));
  if (inactiveSheets.length) {
    const unresolved = detectConventionFromPeer(allInvoiceSheets, warnings, inactiveSheets);
    if (daVnd) revertToOriginal(unresolved);
  }
}

export function doiSoat(sheets: SheetTho[], opt: TuyChonDoiSoat): KetQuaDoiSoat {
  const kq = reconcileOnce(sheets, opt, new Set());
  // Dung sai làm tròn tính theo ĐƠN VỊ của ô. Sheet nào để tiền ngoại tệ ở NGUYÊN TỆ thì
  // chỉ biết SAU khi dò quy ước (cần ghép sổ) ⇒ chạy lại một lần với dung sai theo xu cho
  // các sheet đó. Phần dò quy ước không phụ thuộc dung sai nên lần hai ra y hệt.
  const originalCurrency = new Set(kq.sheetsHoaDon.filter((s) => s.dong.some((d) => d.tyGia > 1)).map((s) => s.ten));
  return originalCurrency.size ? reconcileOnce(sheets, opt, originalCurrency) : kq;
}

function reconcileOnce(sheets: SheetTho[], opt: TuyChonDoiSoat, foreignCurrencySheets: ReadonlySet<string>): KetQuaDoiSoat {
  const nguong = Math.max(0, opt.nguong ?? 1);
  const edits = opt.edits;
  const nghiVan: NghiVan[] = [];
  const gopMap = new Map<string, NghiVanGop>();
  const warnings: CanhBao[] = [];
  const editLog: { viTri: string; cu: string; moi: string }[] = [];

  const invoiceSheets: SheetHoaDon[] = [];
  const allLedgerSheets: SheetPhanMem[] = [];
  let parseErrorCount = 0;
  let removedOldColumn = false;

  for (const s0 of sheets) {
    if (SHEET_TU_DUNG.has(s0.ten)) continue; // sheet tổng hợp của lần xuất trước
    const goi = stripOldReconcileCols(s0.rows); // v3 §1.5 idempotent
    if (goi.daGo) removedOldColumn = true;
    const rows = goi.rows;
    const g: ToaDoGoc = { r0: s0.r0 ?? 0, c0: s0.c0 ?? 0, giuCot: goi.giuCot };
    const width = goi.daGo ? goi.giuCot.length : (s0.rong ?? 0);
    const hPm = ledgerHeaderRow(rows);
    const hHd = invoiceHeaderRow(rows);
    const tron = detectMixedLayout(rows, Math.max(hPm, hHd));
    if (tron)
      warnings.push({
        loai: "Sheet trộn hai bố cục cột",
        chiTiet: `Sheet "${s0.ten}": ${tron.binhThuong} dòng rộng tới cột ${columnLetter(cotExcel(g, tron.cotHeader))} (đúng tiêu đề) nhưng ${tron.lech} dòng rộng tới cột ${columnLetter(cotExcel(g, tron.cotLech))} — nhiều khả năng dán hai bản xuất khác nhau (có mã / không mã) vào cùng một sheet. Cột TIỀN vẫn đúng chỗ; trạng thái · đơn vị tiền tệ · tỷ giá của ${tron.lech} dòng đó bị lệch ô nên engine phải dò theo nội dung. CHỮA ĐÚNG: tách thành hai sheet riêng rồi chạy lại.`,
      });
    if (hPm >= 0) allLedgerSheets.push(parseLedgerSheet(s0.ten, rows, hPm, edits, nghiVan, gopMap, editLog, g, width));
    else if (hHd >= 0) {
      const r = parseInvoiceSheet(s0.ten, rows, hHd, edits, nghiVan, gopMap, editLog, g, width, foreignCurrencySheets.has(s0.ten));
      invoiceSheets.push(r.sheet);
      parseErrorCount += r.loiParse;
    }
  }

  // --- Gộp sheet HĐĐT trùng lặp (tập con) — v3 §1.4 ---
  for (const a of invoiceSheets) {
    if (a.laPhu || a.dong.length === 0) continue;
    const ka = new Set(a.dong.map((d) => d.khoa));
    for (const b of invoiceSheets) {
      if (b === a || b.laPhu) continue;
      const kb = new Set(b.dong.map((d) => d.khoa));
      if (kb.size >= ka.size && [...ka].every((k) => kb.has(k)) && kb.size > ka.size) {
        a.laPhu = true;
        gopMap.set(`sheetHD-${a.ten}`, {
          nhom: 7,
          ten: `Sheet HĐĐT trùng lặp: "${a.ten}"`,
          soDong: a.dong.length,
          tongTien: a.dong.reduce((s, d) => s + d.tongTtVnd, 0),
          canhBao: `"${a.ten}" (${ka.size} hóa đơn) là TẬP CON của "${b.ten}" (${kb.size}). Chỉ cộng "${b.ten}" vào tổng — bỏ "${a.ten}" để KHỎI đếm hai lần. Xác nhận bản chốt.`,
          chiTiet: [],
        });
        break;
      }
    }
  }
  // --- Có sổ + HAI BẢN HĐĐT (thuế gửi ⇄ tự tải) gối nhau: chỉ đối soát bản THUẾ GỬI ---
  // Không bản nào là tập con của bản kia thì khối trên giữ cả hai ⇒ hóa đơn có ở cả hai
  // bản bị đếm hai lần, "chưa kê" nhân đôi. So hai bản với nhau là việc của `soHaiBanHddt`.
  const benThue = phanBenThue(invoiceSheets.map((s) => s.ten), opt.benThue).benThue;
  {
    const conThue = invoiceSheets.filter((s) => !s.laPhu && benThue.has(s.ten));
    const selfLoadSheets = invoiceSheets.filter((s) => !s.laPhu && !benThue.has(s.ten));
    const kThue = new Set(conThue.flatMap((s) => s.dong.map((d) => d.khoa)));
    const selfLoadedKeys = new Set(selfLoadSheets.flatMap((s) => s.dong.map((d) => d.khoa)));
    const chung = [...selfLoadedKeys].filter((k) => kThue.has(k)).length;
    // Gối ≥ nửa bản nhỏ hơn mới là HAI BẢN của cùng một kỳ — tên có chữ "thuế" mà hóa
    // đơn khác hẳn nhau (VD sheet "THUẾ SUẤT 8%") thì vẫn là các sheet riêng, giữ nguyên.
    if (allLedgerSheets.length && chung > 0 && chung * 2 >= Math.min(kThue.size, selfLoadedKeys.size)) {
      const tenThue = conThue.map((s) => `"${s.ten}"`).join(", ");
      for (const s of selfLoadSheets) {
        s.laPhu = true;
        gopMap.set(`sheetHD-${s.ten}`, {
          nhom: 7,
          ten: `Bản tự tải: "${s.ten}"`,
          soDong: s.dong.length,
          tongTien: s.dong.reduce((t, d) => t + d.tongTtVnd, 0),
          canhBao: `"${s.ten}" là bản TỰ TẢI của cùng kỳ với bản thuế gửi (${tenThue}). Chỉ đối soát bản thuế gửi với sổ để KHỎI đếm hai lần; so hai bản xem kiểu "So hai bản".`,
          chiTiet: [],
        });
      }
      warnings.push({
        loai: "Hai bản hóa đơn điện tử",
        chiTiet: `File có cả bản thuế gửi (${tenThue}) lẫn bản tự tải (${selfLoadSheets.map((s) => `"${s.ten}"`).join(", ")}): ${chung} hóa đơn có ở cả hai bản. Chỉ bản thuế gửi được đối soát với sổ. ${selfLoadedKeys.size - chung} hóa đơn chỉ có ở bản tự tải — KHÔNG được đối soát với sổ; soát chúng ở kiểu "So hai bản".`,
      });
    }
  }
  const hdActive = invoiceSheets.filter((s) => !s.laPhu);

  // --- Chọn sổ CHUẨN khi có nhiều sheet phần mềm — v3 §1.1, §1.4 ---
  let ledgerSheet: SheetPhanMem | null = null;
  const extraLedgerSheets: SheetPhanMem[] = [];
  let needsLedgerPick = false;
  if (allLedgerSheets.length === 1) ledgerSheet = allLedgerSheets[0];
  else if (allLedgerSheets.length > 1) {
    const theoTen = opt.soChuanTen ? allLedgerSheets.find((s) => s.ten === opt.soChuanTen) : null;
    // "mới": sau khi bỏ dấu, tên chứa "moi" (bắt mới / moi / mơii1)
    const newLedgerSheets = allLedgerSheets.filter((s) => chuan(s.ten).includes("moi"));
    let chuanSheet = theoTen ?? (newLedgerSheets.length === 1 ? newLedgerSheets[0] : null);
    if (!chuanSheet) {
      chuanSheet = [...allLedgerSheets].sort((a, b) => b.dong.length - a.dong.length)[0];
      needsLedgerPick = true;
      warnings.push({
        loai: "Chọn sổ chuẩn",
        chiTiet: `Có ${allLedgerSheets.length} sheet sổ (${allLedgerSheets.map((s) => s.ten).join(", ")}). Chưa phân biệt được bản chốt — tạm dùng "${chuanSheet.ten}". Hãy chọn lại nếu sai.`,
      });
    }
    ledgerSheet = chuanSheet;
    for (const s of allLedgerSheets)
      if (s !== chuanSheet) {
        s.laPhu = true;
        extraLedgerSheets.push(s);
      }
  }

  // Sheet sổ phụ tập con
  if (ledgerSheet) {
    const khoaChuan = new Set(ledgerSheet.dong.map((d) => d.khoa));
    for (const phu of extraLedgerSheets) {
      const khoaPhu = new Set(phu.dong.map((d) => d.khoa));
      const laTapCon = [...khoaPhu].every((k) => khoaChuan.has(k));
      const chenhSo = [...khoaChuan].filter((k) => !khoaPhu.has(k)).length;
      gopMap.set(`sheet-${phu.ten}`, {
        nhom: 7,
        ten: `Sheet sổ trùng lặp: "${phu.ten}"`,
        soDong: phu.dong.length,
        tongTien: phu.dong.reduce((s, d) => s + d.tongCong, 0),
        canhBao: laTapCon
          ? `"${phu.ten}" là TẬP CON của "${ledgerSheet.ten}" (lệch ${chenhSo} hóa đơn). Chỉ cộng "${ledgerSheet.ten}" — bỏ sheet này để KHỎI đếm hai lần.`
          : `"${phu.ten}" khác "${ledgerSheet.ten}" (${chenhSo} khóa chỉ có ở bản chuẩn). KHÔNG cộng vào tổng; xác nhận bản chốt.`,
        chiTiet: [],
      });
    }
  }

  if (ledgerSheet && !ledgerSheet.coCotMst)
    warnings.push({
      loai: "Sổ không có cột MST",
      chiTiet: `Sheet sổ "${ledgerSheet.ten}" không có cột MST người bán (tìm theo tiêu đề MASOTHUE / RMST / MS_THUE / MST / Mã số thuế). Khóa ghép là MST + ký hiệu + số hóa đơn nên gần như mọi hóa đơn sẽ báo chưa có trong sổ. Thêm cột MST người bán vào sổ rồi chạy lại.`,
    });
  const missingExchangeRate = invoiceSheets.flatMap((s) => s.dong.filter((d) => d.thieuTyGia));
  if (missingExchangeRate.length)
    warnings.push({
      loai: "Ngoại tệ thiếu tỷ giá",
      chiTiet: `${missingExchangeRate.length} hóa đơn ghi tiền tệ khác VND (${uniq(missingExchangeRate.map((d) => d.dvt)).join(", ")}) nhưng ô tỷ giá trống/0 — máy KHÔNG quy đổi được, đang để nguyên số trên hóa đơn nên dễ lệch sổ oan. Ở: ${missingExchangeRate.slice(0, 10).map((d) => `${d.sheet} dòng ${d.dongFile}`).join("; ")}${missingExchangeRate.length > 10 ? "; …" : ""}. Điền tỷ giá rồi chạy lại.`,
    });
  if (!hdActive.length)
    warnings.push({ loai: "Thiếu dữ liệu", chiTiet: "Không tìm thấy sheet HÓA ĐƠN ĐIỆN TỬ (cần cột Ký hiệu hóa đơn + Số hóa đơn)." });
  if (!ledgerSheet)
    warnings.push({ loai: "Thiếu dữ liệu", chiTiet: "Không tìm thấy sheet SỔ/PHẦN MỀM (cần cột KHHĐ/KY_HIEU + Số HĐ/SO_HD + Tổng cộng/TONGCONG). Mọi hóa đơn sẽ báo CHƯA CÓ TRONG PMKT." });

  // --- Gom theo khóa ---
  const pmTheoKhoa = new Map<string, DongPhanMem[]>();
  if (ledgerSheet)
    for (const d of ledgerSheet.dong) {
      const arr = pmTheoKhoa.get(d.khoa);
      if (arr) arr.push(d); else pmTheoKhoa.set(d.khoa, [d]);
    }
  const hdTheoKhoa = new Map<string, DongHoaDon[]>();
  for (const sh of hdActive)
    for (const d of sh.dong) {
      const arr = hdTheoKhoa.get(d.khoa);
      if (arr) arr.push(d); else hdTheoKhoa.set(d.khoa, [d]);
    }

  // Tự dò quy ước ngoại tệ TRƯỚC khi ghép: nếu cổng đã quy sẵn VND thì hạ tỷ giá áp
  // dụng về 1 để không đội số (mọi tổng + so khớp bên dưới dùng lại chuaThueVnd/tongTtVnd).
  detectForeignCurrencyMode(hdActive, pmTheoKhoa, warnings, invoiceSheets);

  let isMatch = 0, lech = 0, lechThue = 0, thieu = 0, invoiceNo = 0, totalDiff = 0, missingNotRequired = 0;
  // Nhãn gọi thẳng tên sheet sổ (file mẫu kế toán ghi "CHƯA CÓ TRONG PMEM"), để
  // bảng tổng và cột KẾT QUẢ nói cùng một thứ tiếng.
  const missingLabel = `CHƯA CÓ TRONG ${ledgerSheet?.ten ?? "PMKT"}`;
  for (const sh of hdActive)
    for (const d of sh.dong) {
      invoiceNo++;
      const pm = pmTheoKhoa.get(d.khoa) ?? [];
      if (!pm.length) {
        d.trangThai = "THIEU";
        if (d.khongCanVaoSo) {
          // Không đổi nhóm đếm (giữ nguyên các phép tự kiểm), chỉ tách nhãn ra để
          // kế toán lọc bỏ khỏi danh sách phải đi hạch toán.
          d.ketLuan = `${missingLabel} — KHÔNG CẦN VÀO SỔ`;
          d.bangChung = `Không có trong sổ, nhưng ĐÚNG: hóa đơn ở trạng thái "${d.trangThaiHd}" — bản này đã bị thay thế/hủy, kế toán hạch toán bản thay thế chứ không hạch toán bản này.`;
          missingNotRequired++;
        } else {
          d.ketLuan = missingLabel;
          d.bangChung = "Không tìm thấy dòng ghi sổ nào trong phần mềm kế toán có cùng MST người bán + ký hiệu + số hóa đơn.";
        }
        thieu++;
        continue;
      }
      const ledgerTotal = pm.reduce((s, x) => s + x.tongCong, 0);
      const ledgerPreTax = pm.reduce((s, x) => s + x.chuaThue, 0);
      const pmThue = pm.reduce((s, x) => s + x.thue, 0);
      const chenh = d.tongTtVnd - ledgerTotal;
      const preTaxDiff = d.chuaThueVnd - ledgerPreTax;
      const chenhThue = d.thueVnd - pmThue;
      d.soDongKhopPm = pm.length;
      d.tongTtPm = ledgerTotal;
      d.chenh = chenh;
      d.phieuKe = uniq(pm.map((x) => x.phieu)).join(", ");
      d.ctgs = uniq(pm.map((x) => x.ctgs)).join(", ");
      d.ngayGhiSo = uniq(pm.map((x) => x.ngayHd)).join(", ");
      d.tkNoCo = uniq(pm.map((x) => `${x.tkNo} / ${x.tkCo}`)).join("; ");
      d.dienGiaiPm = uniq(pm.map((x) => x.dienGiai)).join(" | ");
      d.soTienHachToan = ledgerTotal;
      const voucherLabel = d.phieuKe || "(không số phiếu)";
      // So ĐỦ 3 cột (bổ sung TRƯỚC THUẾ + THUẾ, không chỉ tổng) — ghi tận nơi vào bằng chứng.
      const baCap =
        `HĐ: chưa ${num(d.chuaThueVnd)} · thuế ${num(d.thueVnd)} · tổng ${num(d.tongTtVnd)} | ` +
        `sổ: chưa ${num(ledgerPreTax)} · thuế ${num(pmThue)} · tổng ${num(ledgerTotal)} | ` +
        `chênh: trước thuế ${num(preTaxDiff)} · thuế ${num(chenhThue)} · tổng ${num(chenh)}`;
      const dauCau = `Khớp phiếu ${voucherLabel} ngày ${d.ngayGhiSo} (CTGS ${d.ctgs}), TK ${d.tkNoCo}.`;
      if (Math.abs(chenh) > nguong) {
        // TỔNG lệch → tiền sai (nhãn cũ, giữ nguyên).
        d.trangThai = "LECH";
        d.ketLuan = "LỆCH TIỀN";
        d.bangChung = `${dauCau} LỆCH TIỀN ${num(chenh)} đ (HĐĐT − sổ). ${baCap}`;
        lech++;
        totalDiff += Math.abs(chenh);
      } else if (Math.abs(chenhThue) > nguong) {
        // TỔNG khớp nhưng THUẾ lệch → nghi sai thuế suất / số thuế ghi ở sổ (mất/thừa thuế
        // đầu vào dù tiền thanh toán đúng). trangThai = LECH để vào nhóm L của bảng tổng.
        d.trangThai = "LECH";
        d.ketLuan = "LỆCH THUẾ";
        d.bangChung = `${dauCau} Tổng thanh toán KHỚP nhưng THUẾ lệch ${num(chenhThue)} đ (HĐ ${num(d.thueVnd)} / sổ ${num(pmThue)}) — nghi sai thuế suất hoặc số thuế ghi ở sổ. ${baCap}`;
        lechThue++;
      } else {
        d.trangThai = "KHOP";
        d.ketLuan = "KHỚP";
        // Chênh TRƯỚC THUẾ khi tổng + thuế đã khớp gần như luôn do sổ ghi trước thuế đã
        // trừ chiết khấu / cộng phí (net) còn hóa đơn ghi gộp — KHÔNG phải sai.
        const preTaxNote =
          Math.abs(preTaxDiff) > nguong
            ? ` Trước thuế lệch ${num(preTaxDiff)} đ nhưng TỔNG + THUẾ khớp — thường do sổ ghi trước thuế đã trừ chiết khấu / cộng phí, không phải sai.`
            : "";
        d.bangChung = `${dauCau} ${chenh === 0 ? "Khớp số tiền." : `Chênh tổng ${num(Math.abs(chenh))} đ trong ngưỡng, coi như khớp.`}${preTaxNote} ${baCap}`;
        isMatch++;
      }
    }

  let pmCo = 0, pmThieu = 0, ledgerRowCount = 0;
  if (ledgerSheet)
    for (const d of ledgerSheet.dong) {
      ledgerRowCount++;
      const hd = hdTheoKhoa.get(d.khoa) ?? [];
      if (!hd.length) {
        d.trangThai = "THIEU";
        d.ketLuan = "CHƯA CÓ HĐĐT";
        d.bangChung = "Không tìm thấy hóa đơn điện tử nào có cùng MST người bán + ký hiệu + số hóa đơn.";
        pmThieu++;
        continue;
      }
      const first = hd[0];
      const invoiceTotal = hd.reduce((s, x) => s + x.tongTtVnd, 0);
      d.trangThai = "CO";
      d.ketLuan = "ĐÃ CÓ HĐĐT";
      d.soHddtKhop = hd.length;
      d.nguonHddt = first.sheet;
      d.dongHddt = first.dongFile;
      d.ngayLapHd = first.ngayLap;
      d.tenBanHddt = first.tenBan;
      d.tongTtHddt = invoiceTotal;
      d.bangChung = `Khớp hóa đơn ${first.kyHieu}-${first.soChuan} ngày ${first.ngayLap} của ${first.tenBan} (sheet ${first.sheet}, dòng ${first.dongFile}). Hóa đơn ${num(invoiceTotal)} đ.`;
      pmCo++;
    }

  // --- GẦN KHỚP (v3 §5.4): dòng THIẾU hai bên, cùng MST + cùng số tiền ±1đ ---
  const NG_GK = 1;
  const pmThieuList = ledgerSheet ? ledgerSheet.dong.filter((d) => d.trangThai === "THIEU") : [];
  const pmDaGhep = new Set<DongPhanMem>();
  let nearMatchCount = 0;
  for (const sh of hdActive)
    for (const d of sh.dong) {
      if (d.trangThai !== "THIEU") continue;
      const cand = pmThieuList.find(
        (p) => !pmDaGhep.has(p) && mstChuan(p.mstBan) === mstChuan(d.mstBan) && Math.abs(p.tongCong - d.tongTtVnd) <= NG_GK
      );
      if (!cand) continue;
      pmDaGhep.add(cand);
      nearMatchCount++;
      const invoiceDescription = `Gần khớp: cùng MST + số tiền ${num(d.tongTtVnd)} đ với dòng ghi sổ ${cand.phieu || "(?)"} sheet "${cand.sheet}" dòng ${cand.dongFile} (số HĐ sổ ${cand.soHoaDon} ≠ số HĐ ${d.soHoaDon}). Kiểm tra xem có phải một.`;
      d.ganKhopMoTa = invoiceDescription;
      d.bangChung += " " + invoiceDescription;
      cand.ganKhopMoTa = `Gần khớp hóa đơn ${d.kyHieu}-${d.soHoaDon} sheet "${d.sheet}" dòng ${d.dongFile} (cùng MST + số tiền).`;
      cand.bangChung += " " + cand.ganKhopMoTa;
      nghiVan.push({
        nhom: 3,
        viTri: `${d.sheet} · dòng ${d.dongFile} (Số hóa đơn ${d.soHoaDon})`,
        viTriXuat: `${d.sheet} · dòng ${d.dongFile} (Số hóa đơn ${d.soHoaDon})`,
        soDangCo: d.soHoaDon,
        soDoiChung: cand.soHoaDon,
        nguonDoiChung: `sổ "${cand.sheet}" dòng ${cand.dongFile}, cùng MST ${d.mstBan} + số tiền ${num(d.tongTtVnd)} đ`,
        saiOCho: "số hóa đơn hai bên lệch (nghi gõ sai vài chữ số) nhưng MST + tiền trùng khít",
        anhHuong: "nếu đúng là một hóa đơn: chuyển từ CHƯA CÓ sang KHỚP",
      });
    }

  if (ledgerSheet && !ledgerSheet.coCotTong)
    warnings.push({
      loai: "Sổ không có cột tổng cộng",
      chiTiet: `Sheet sổ "${ledgerSheet.ten}" là bản xuất CHI TIẾT MẶT HÀNG (không có cột tổng cộng, mỗi mặt hàng một dòng). Máy tự lấy tổng = tiền hàng + tiền thuế, rồi cộng dồn các dòng mặt hàng cùng số hóa đơn trước khi so. Không soi được "cộng có khớp tổng không" vì sổ không có tổng để soi.`,
    });

  if (missingNotRequired)
    warnings.push({
      loai: "Hóa đơn không cần vào sổ",
      chiTiet: `${missingNotRequired} hóa đơn nằm trong nhóm "chưa vào sổ" nhưng ở trạng thái đã bị thay thế/hủy — ĐÚNG là không phải hạch toán. Lọc cột KẾT QUẢ = "${missingLabel} — KHÔNG CẦN VÀO SỔ" để bỏ chúng ra khỏi danh sách phải đi kê.`,
    });

  // Có sổ: khóa lặp nghĩa là cộng hai lần vào đối soát ⇒ luôn báo. Không sổ (so hai bản):
  // mỗi bên một dòng là đương nhiên, chỉ báo khi lặp TRONG cùng một bản.
  for (const [k, arr] of hdTheoKhoa) {
    const nThue = arr.filter((x) => benThue.has(x.sheet)).length;
    if (ledgerSheet ? arr.length > 1 : nThue > 1 || arr.length - nThue > 1)
      warnings.push({ loai: "Trùng khóa HĐĐT", chiTiet: `Khóa "${k}" xuất hiện ${arr.length} lần (${arr.map((x) => `${x.sheet}#${x.dongFile}`).join(", ")}).` });
  }

  // --- Cầu nối số liệu (v3 §7) ---
  let fileTotal = 0, fileMatched = 0, lechFile = 0, matchedLedgerTotal = 0, unmatchedDirect = 0;
  const breakdown: { mo: string; tien: number }[] = [];
  for (const sh of hdActive)
    for (const d of sh.dong) {
      fileTotal += d.tongTtVnd;
      if (d.trangThai === "KHOP") { fileMatched += d.tongTtVnd; matchedLedgerTotal += d.tongTtPm; }
      else if (d.trangThai === "LECH") { lechFile += d.tongTtVnd; matchedLedgerTotal += d.tongTtPm; }
      else unmatchedDirect += d.tongTtVnd;
      if (d.chenh != null && Math.abs(d.chenh) > 0.005)
        breakdown.push({ mo: `${d.kyHieu}-${d.soChuan} (${d.sheet})`, tien: d.chenh });
    }
  const bridge: CauNoi = {
    tongFile: fileTotal, khopFile: fileMatched, lechFile,
    chuaCoBenSo: fileTotal - fileMatched - lechFile,
    chuaCoBenSoTrucTiep: unmatchedDirect,
    soKhopSo: matchedLedgerTotal,
    duTruCheo: fileMatched + lechFile - matchedLedgerTotal,
    bocTach: breakdown.sort((a, b) => Math.abs(b.tien) - Math.abs(a.tien)).slice(0, 100),
  };

  const nghiVanGop = [...gopMap.values()];
  const soNghiVan = nghiVan.length + nghiVanGop.reduce((s, g) => s + g.soDong, 0);

  // --- Khối tự kiểm (v3 §8) — 9 phép ---
  const round = (n: number) => Math.round(n * 100) / 100;
  const sumChenhBoc = breakdown.reduce((s, x) => s + x.tien, 0);
  const lechQuyDoi = countLechQuyDoi(invoiceSheets);
  const phepThu: PhepThu[] = [
    { ten: "Mỗi hóa đơn đúng 1 nhãn", batLoiGi: "một hóa đơn bị đếm 2 nhãn hoặc sót nhãn", mong: String(invoiceNo), thuc: String(isMatch + lech + thieu), dat: invoiceNo === isMatch + lech + thieu },
    { ten: "Mỗi dòng ghi sổ đúng 1 nhãn", batLoiGi: "dòng phần mềm bị sót/đếm trùng nhãn", mong: String(ledgerRowCount), thuc: String(pmCo + pmThieu), dat: ledgerRowCount === pmCo + pmThieu },
    { ten: "Cột quy đổi = gốc × tỷ giá áp dụng", batLoiGi: "dòng ngoại tệ thiếu tỷ giá (không quy đổi được), hoặc số VND không khớp số gốc × tỷ giá áp dụng", mong: "0 dòng lệch", thuc: `${lechQuyDoi} dòng lệch`, dat: lechQuyDoi === 0 },
    { ten: "Tổng file − các nhóm = 0", batLoiGi: "phân nhóm bỏ sót tiền", mong: "0 đ", thuc: `${num(round(fileTotal - fileMatched - lechFile - unmatchedDirect))} đ`, dat: Math.abs(fileTotal - fileMatched - lechFile - unmatchedDirect) < 0.5 },
    { ten: "Hai cách tính phần chưa kê bằng nhau", batLoiGi: "trừ chéo file/sổ khi tính phần còn thiếu", mong: "0 đ chênh", thuc: `${num(round(bridge.chuaCoBenSo - bridge.chuaCoBenSoTrucTiep))} đ`, dat: Math.abs(bridge.chuaCoBenSo - bridge.chuaCoBenSoTrucTiep) < 0.5 },
    { ten: "Phần dư trừ chéo giải thích được", batLoiGi: "phần dư không bóc tách về giao dịch", mong: `${num(round(bridge.duTruCheo))} đ`, thuc: `${num(round(sumChenhBoc))} đ (bóc tách)`, dat: Math.abs(bridge.duTruCheo - sumChenhBoc) < 0.5 },
    { ten: "Tổng cột Chênh lệch = phần dư trừ chéo", batLoiGi: "cột chênh lệch của bảng chính lệch phần dư", mong: `${num(round(bridge.duTruCheo))} đ`, thuc: `${num(round(signedDiffTotal(hdActive)))} đ`, dat: Math.abs(bridge.duTruCheo - signedDiffTotal(hdActive)) < 0.5 },
    { ten: "Bằng chứng cộng = chỉ tiêu bảng chính", batLoiGi: "cột 'Tổng trên sổ' của HĐĐT lệch tổng dòng ghi sổ đã khớp", mong: `${num(round(matchedLedgerTotal))} đ`, thuc: `${num(round(ledgerTotalOf(ledgerSheet)))} đ`, dat: Math.abs(matchedLedgerTotal - ledgerTotalOf(ledgerSheet)) < 0.5 },
    { ten: "Số nghi vấn = số đã liệt kê (baseline)", batLoiGi: "xuất hiện lỗi mới, hoặc người dùng vừa sửa xong 1 lỗi", mong: String(opt.nghiVanBanDau ?? soNghiVan), thuc: String(soNghiVan), dat: (opt.nghiVanBanDau ?? soNghiVan) === soNghiVan },
  ];

  return {
    sheetsHoaDon: invoiceSheets,
    sheetPhanMem: ledgerSheet,
    sheetsPhanMemPhu: extraLedgerSheets,
    tong: { soHoaDon: invoiceNo, khop: isMatch, lech, lechThue, thieu, thieuKhongCanVaoSo: missingNotRequired, ganKhop: nearMatchCount, soDongPm: ledgerRowCount, pmCo, pmThieu, tongChenh: totalDiff, soLoiParse: parseErrorCount },
    nghiVan,
    nghiVanGop,
    cauNoi: bridge,
    phepThu,
    canhBao: warnings,
    canChonSo: needsLedgerPick,
    daGoCotCu: removedOldColumn,
    nhatKySua: editLog,
    nguong,
    ...(opt.benThue ? { benThue: opt.benThue } : {}),
  };
}

/**
 * Dòng KHÔNG quy đổi đúng: ngoại tệ thiếu tỷ giá, hoặc một trong ba cột VND khác số gốc ×
 * tỷ giá ÁP DỤNG (bắt lỗi hạ tỷ giá mà quên tính lại cột VND, hay ngược lại).
 */
function countLechQuyDoi(sheets: readonly SheetHoaDon[]): number {
  let n = 0;
  for (const sh of sheets)
    for (const d of sh.dong) {
      const lech = (goc: number, vnd: number) => Math.abs(goc * d.tyGia - vnd) > 0.01;
      if (d.thieuTyGia || lech(d.chuaThueRaw, d.chuaThueVnd) || lech(d.thueRaw, d.thueVnd) || lech(d.tongTtRaw, d.tongTtVnd)) n++;
    }
  return n;
}
function signedDiffTotal(sheets: SheetHoaDon[]): number {
  let s = 0;
  for (const sh of sheets) for (const d of sh.dong) if (d.chenh != null) s += d.chenh;
  return s;
}
function ledgerTotalOf(pm: SheetPhanMem | null): number {
  if (!pm) return 0;
  return pm.dong.filter((d) => d.trangThai === "CO").reduce((s, d) => s + d.tongCong, 0);
}

// ---------- Xuất Excel tô màu + chuẩn hóa hiển thị (v3 §9) ----------

export const CHU_THICH =
  'CHÚ THÍCH: dòng ĐỎ = hóa đơn chưa có trong sổ | dòng VÀNG = có nhưng lệch tiền | dòng XANH = khớp. Cột "BẰNG CHỨNG ĐỐI CHIẾU" ở cuối cho biết khớp/gần khớp với phiếu nào.';
export const CHU_THICH_PM =
  'CHÚ THÍCH: dòng XANH = bút toán đã có hóa đơn điện tử | dòng ĐỎ = chưa tìm thấy hóa đơn điện tử.';

/** Nền đặc kiểu xlsx-js-style (RGB không kênh alpha) từ bảng màu chung. */
const nenXlsx = (argb: string) => ({ patternType: "solid", fgColor: { rgb: argb.slice(2) } }) as const;
const FILL = {
  xanh: { fill: nenXlsx(MAU_NEN.xanh), font: { color: { rgb: "006100" } } },
  vang: { fill: nenXlsx(MAU_NEN.vang), font: { color: { rgb: "9C6500" } } },
  do: { fill: nenXlsx(MAU_NEN.do), font: { color: { rgb: "9C0006" } } },
} as const;
const HEADER_STYLE = { font: { bold: true }, fill: nenXlsx(MAU_NEN.tieuDe) } as const;
type Style = { fill?: unknown; font?: unknown } | null;

function toExportCell(v: unknown): unknown {
  if (v instanceof Date) return ngayHienThi(v);
  return v ?? null;
}

function buildSheet(aoa: unknown[][], fillTheoHang: Style[], headerRow: number): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const fill = fillTheoHang[r];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as { v?: unknown; z?: string; s?: unknown } | undefined;
      if (!cell) continue;
      if (r === headerRow) { cell.s = HEADER_STYLE; continue; }
      if (fill) cell.s = fill;
      if (typeof cell.v === "number" && Math.abs(cell.v) >= 1000)
        cell.z = Number.isInteger(cell.v) ? "#,##0" : "#,##0.00";
    }
  }
  const cols: { wch: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let w = 0;
    for (let r = headerRow; r <= Math.min(range.e.r, headerRow + 60); r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as { v?: unknown } | undefined;
      const len = cell?.v == null ? 0 : String(cell.v).length;
      if (len > w) w = len;
    }
    cols.push({ wch: Math.min(Math.max(w + 1, 12), 48) });
  }
  ws["!cols"] = cols;
  ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: range.s.c })}:${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}` };
  // Dựng sheet MỚI → không dòng/cột ẩn, không bộ lọc lưu sẵn, khung nhìn mặc định A1 (v3 §9).
  return ws;
}

/**
 * Tên file kết quả: tên file gốc + " - đã đối soát " + ngày giờ xuất (VD
 * "DANH SÁCH HD THUẾ GỬI - đã đối soát 20260921-1012.xlsx").
 *
 * Có NGÀY GIỜ để mỗi lần xuất ra một file MỚI: tên cố định thì bản sau trùng tên bản
 * trước, trình duyệt/Finder tự thêm "(1)" hoặc hỏi ghi đè — kế toán mở nhầm bản cũ
 * (chủ dự án phản ánh 2026-09-21). File vào là file đã xuất thì bỏ đuôi cũ trước,
 * kẻo tên dài dần qua mỗi lần xuất lại.
 */
export function tenFileKetQua(tenGoc: string, luc: Date = new Date()): string {
  const goc = tenGoc
    .replace(/\.xlsx?$/i, "")
    .replace(/ - (đã đối soát|đã dò lệch)( \d{8}-\d{4})?$/i, "");
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const moc = `${luc.getFullYear()}${pad2(luc.getMonth() + 1)}${pad2(luc.getDate())}-${pad2(luc.getHours())}${pad2(luc.getMinutes())}`;
  return `${goc} - đã đối soát ${moc}.xlsx`;
}

export function xuatExcelDoiSoat(kq: KetQuaDoiSoat, tenFile = "doi-soat-hddt.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const addSheet = (ws: XLSX.WorkSheet, ten: string) => {
    let t = ten.slice(0, 31);
    let i = 2;
    while (usedNames.has(t)) t = `${ten.slice(0, 28)}~${i++}`;
    usedNames.add(t);
    XLSX.utils.book_append_sheet(wb, ws, t);
  };

  for (const sh of kq.sheetsHoaDon) {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    sh.preRows.forEach((r) => { aoa.push([null, ...r.map(toExportCell)]); fills.push(null); });
    aoa.push([sh.laPhu ? `${CHU_THICH} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_HD_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan, ...d.cells.map(toExportCell), d.tyGia, d.soChuan, d.khoa, d.chuaThueVnd, d.thueVnd,
        d.tongTtVnd, d.soDongKhopPm, d.tongTtPm, d.chenh, d.ketLuan, d.phieuKe, d.ctgs, d.ngayGhiSo,
        d.tkNoCo, d.dienGiaiPm, d.soTienHachToan, d.bangChung,
      ]);
      fills.push(d.trangThai === "KHOP" ? FILL.xanh : d.trangThai === "LECH" ? FILL.vang : FILL.do);
    }
    addSheet(buildSheet(aoa, fills, hIdx), sh.laPhu ? `PHỤ ${sh.ten}` : sh.ten);
  }

  const buildLedgerSheet = (sh: SheetPhanMem) => {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    aoa.push([sh.laPhu ? `${CHU_THICH_PM} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH_PM]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_PM_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan, ...d.cells.map(toExportCell), d.soChuan, d.khoa, d.soHddtKhop, d.ketLuan, d.nguonHddt,
        d.dongHddt, d.ngayLapHd, d.tenBanHddt, d.tongTtHddt, d.bangChung,
      ]);
      fills.push(d.trangThai === "CO" ? FILL.xanh : FILL.do);
    }
    addSheet(buildSheet(aoa, fills, hIdx), sh.laPhu ? `PHỤ ${sh.ten}` : sh.ten);
  };
  if (kq.sheetPhanMem) buildLedgerSheet(kq.sheetPhanMem);
  for (const p of kq.sheetsPhanMemPhu) buildLedgerSheet(p);

  if (kq.nhatKySua.length) {
    const aoa: unknown[][] = [
      ["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"],
      ["Vị trí", "Giá trị cũ", "Giá trị mới"],
      ...kq.nhatKySua.map((n) => [n.viTri, n.cu, n.moi]),
    ];
    addSheet(buildSheet(aoa, aoa.map(() => null), 1), "NHẬT KÝ SỬA");
  }

  XLSX.writeFile(wb, tenFile, { bookType: "xlsx" });
}

// ---------- Xuất FILE MẪU (người dùng làm theo format) ----------

/**
 * Xuất workbook MẪU: 3 sheet hóa đơn điện tử (bố cục cổng thuế, tiêu đề ở hàng 6)
 * + 1 sheet PMEM (sổ kế toán) — kèm 1-2 dòng ví dụ. Engine vẫn đọc được mọi biến
 * thể khác (tên sheet/cột tùy ý), đây chỉ là bản khuyến nghị để đỡ sai định dạng.
 */
export function xuatFileMau(tenFile = "mau-doi-soat-hoa-don.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const HDR_HD = [
    "STT", "Ký hiệu mẫu số", "Ký hiệu hóa đơn", "Số hóa đơn", "Ngày lập",
    "MST người bán/MST người xuất hàng", "Tên người bán/Tên người xuất hàng",
    "MST người mua/MST người nhận hàng", "Tên người mua/Tên người nhận hàng", "Địa chỉ người mua",
    "Tổng tiền chưa thuế", "Tổng tiền thuế", "Tổng tiền chiết khấu thương mại", "Tổng tiền phí",
    "Tổng tiền thanh toán", "Đơn vị tiền tệ", "Tỷ giá", "Trạng thái hóa đơn", "Kết quả kiểm tra hóa đơn",
  ];
  const sampleInvoiceRow = (stt: number, kh: string, so: string, preTax: number, thue: number, dvt = "VND", exchangeRate = "1.0"): unknown[] => [
    stt, "1", kh, so, "05/02/2026", "0300514849", "CÔNG TY MẪU ABC", "3502297423", "CÔNG TY TNHH BASEAFOOD 1",
    "Số 321 Trần Xuân Độ, Bà Rịa", preTax, thue, 0, null, preTax + thue, dvt, exchangeRate, "Hóa đơn mới", "Đã cấp mã",
  ];
  const sheetHd = (note: string, rows: unknown[][]) => {
    const aoa: unknown[][] = [
      [note], ["DANH SÁCH HÓA ĐƠN"], ["Từ ngày 01/02/2026 đến ngày 28/02/2026"], [], [], HDR_HD, ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = HDR_HD.map((h) => ({ wch: Math.min(Math.max(h.length + 1, 12), 40) }));
    (ws[XLSX.utils.encode_cell({ r: 5, c: 0 })] as { s?: unknown }).s = HEADER_STYLE;
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, sheetHd("Hóa đơn CÓ MÃ cơ quan thuế — mẫu; giữ tiêu đề ở hàng 6",
    [sampleInvoiceRow(1, "C26TCT", "1812", 4800000, 384000), sampleInvoiceRow(2, "C26TSD", "10183", 2830000, 226400)]), "CÓ MÃ");
  XLSX.utils.book_append_sheet(wb, sheetHd("Hóa đơn MÁY TÍNH TIỀN — mẫu",
    [sampleInvoiceRow(1, "C26MCM", "36582", 297407, 23793)]), "MÁY TÍNH TIỀN");
  XLSX.utils.book_append_sheet(wb, sheetHd("Hóa đơn KHÔNG MÃ (gồm ngoại tệ USD) — mẫu",
    [sampleInvoiceRow(1, "K26TVT", "1392", 5300600, 530060), sampleInvoiceRow(2, "K26TAB", "10161", 217.2, 21.72, "USD", "25795.0")]), "KHÔNG MÃ");

  // Sheet sổ (PMEM) — tiêu đề ở hàng 1, hỗ trợ mã máy
  const HDR_PM = ["SCT_GHISO", "NGAY_GS", "SO_PHIEU", "KY_HIEU", "NGAY_HD", "SO_HD", "NGUOI_BAN", "RMST", "MAT_HANG", "TIENHANG", "TIENTHUE", "TONGCONG", "TS%", "GHICHU", "LOAI"];
  const sampleLedgerRow = (salesInvoice: string, kh: string, so: string, hang: number, thue: number): unknown[] =>
    ["NHI", "01/02/2026", salesInvoice, kh, "05/02/2026", so, "CÔNG TY MẪU ABC", "0300514849", "Mua hàng - HĐ " + so, hang, thue, hang + thue, "10%", null, "1A"];
  const aoaPm: unknown[][] = [
    HDR_PM,
    sampleLedgerRow("01/NHI/02", "C26TCT", "00001812", 4800000, 384000),
    sampleLedgerRow("02/NHI/02", "C26TSD", "00010183", 2830000, 226400),
  ];
  const wsPm = XLSX.utils.aoa_to_sheet(aoaPm);
  wsPm["!cols"] = HDR_PM.map((h) => ({ wch: Math.min(Math.max(h.length + 1, 10), 32) }));
  for (let c = 0; c < HDR_PM.length; c++)
    (wsPm[XLSX.utils.encode_cell({ r: 0, c })] as { s?: unknown }).s = HEADER_STYLE;
  XLSX.utils.book_append_sheet(wb, wsPm, "PMEM");

  // Sheet hướng dẫn
  const instructions: unknown[][] = [
    ["HƯỚNG DẪN — FILE MẪU ĐỐI SOÁT HÓA ĐƠN ĐẦU VÀO"],
    [],
    ["1. Mỗi sheet hóa đơn điện tử (CÓ MÃ / MÁY TÍNH TIỀN / KHÔNG MÃ) đặt tiêu đề ở HÀNG 6, dữ liệu từ hàng 7."],
    ["2. Sheet sổ kế toán (PMEM) đặt tiêu đề ở HÀNG 1. Chấp nhận cả bộ tên tiếng Việt (CTGS, KHHĐ, Số HĐ, Tổng cộng…)."],
    ["3. Cột bắt buộc ở hóa đơn: Ký hiệu hóa đơn · Số hóa đơn · Ngày lập · MST người bán · Tổng tiền chưa thuế · thuế · thanh toán."],
    ["4. Hóa đơn ngoại tệ: ghi Đơn vị tiền tệ = USD và Tỷ giá là SỐ THỰC (vd 25795.0). Hệ thống tự quy về VND."],
    ["5. Đối chiếu theo: MST người bán + Ký hiệu (bỏ chữ số mẫu số đầu) + Số hóa đơn (bỏ số 0 đầu)."],
    ["6. KHÔNG bắt buộc theo mẫu này — hệ thống vẫn đọc file có tên sheet/cột khác, miễn còn các cột bắt buộc trên."],
  ];
  const wsHd = XLSX.utils.aoa_to_sheet(instructions);
  wsHd["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsHd, "HƯỚNG DẪN");

  XLSX.writeFile(wb, tenFile, { bookType: "xlsx" });
}
