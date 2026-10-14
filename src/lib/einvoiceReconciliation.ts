// ============================================================
// Tên file: src/lib/einvoiceReconciliation.ts
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
import { FILL_COLORS, columnIndexToLetter, normalizeText as chuan, buildEditKey, parseEditKey } from "./reconciliationCommon";
import { resolveTaxSideSheets } from "./twoVersionReconciliation";

// ---------- Kiểu dữ liệu ----------

export type InvoiceMatchStatus = "KHOP" | "LECH" | "THIEU";
export type LedgerMatchStatus = "CO" | "THIEU";
/** 1 cộng sai · 2 thiếu chưa thuế · 3 gần khớp · 4 thiếu tách thuế · 5 tổng bị xóa · 6 cột quy đổi phụ · 7 sheet trùng. */
export type SuspectGroup = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SuspectItem {
  group: SuspectGroup;
  /** Vị trí trong FILE NGƯỜI DÙNG TẢI LÊN (dùng trên màn hình). */
  location: string;
  /** Cùng vị trí đó nhưng theo FILE XUẤT (đã chèn cột "KẾT QUẢ" ⇒ lệch 1 cột). */
  exportLocation?: string;
  currentValue: string;
  expectedValue: string; // "chưa xác định" nếu không suy được
  expectedSource: string;
  wrongAt: string;
  impact: string;
  // Để áp SỬA (chỉ khi suy được số đúng determinate):
  sheet?: string;
  rowIndex?: number;
  column?: number;
  columnName?: string;
  oldValue?: number | null;
  correctValue?: number;
}

export interface MergedSuspect {
  group: SuspectGroup;
  name: string;
  rowCount: number;
  totalAmount: number;
  warning: string;
  items: SuspectItem[];
}

export interface TrialCheck {
  name: string;
  catches: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface ReconciliationBridge {
  fileTotal: number;
  fileMatched: number;
  fileMismatched: number;
  missingInLedger: number;
  missingInLedgerDirect: number;
  ledgerMatched: number;
  crossOffset: number;
  breakdown: { label: string; amount: number }[];
}

export interface InvoiceRow {
  sheet: string;
  /** Cột "Trạng thái hóa đơn" của cổng thuế, nguyên văn. */
  invoiceStatus: string;
  /**
   * Dòng RỘNG HƠN hàng tiêu đề ⇒ thuộc bố cục khác đã bị dán chung sheet. Cột tiền
   * của nó KHÔNG đáng tin (bản "không mã" để tổng thanh toán ở cột khác, hóa đơn
   * ngoại tệ còn để số gốc và số quy đổi ở hai cột khác hẳn). Chỉ khóa (ký hiệu ·
   * số HĐ · MST) là tin được vì nằm trước chỗ lệch.
   */
  layoutMismatch: boolean;
  /**
   * Hóa đơn **không cần vào sổ**: bản đã bị THAY THẾ, hoặc bị xóa bỏ/hủy. Kế toán
   * cố ý không hạch toán bản này (hạch toán bản thay thế) ⇒ báo "chưa kê" là báo oan.
   * LƯU Ý: "đã bị ĐIỀU CHỈNH" thì KHÁC — hóa đơn gốc vẫn có hiệu lực, vẫn phải vào
   * sổ, hóa đơn điều chỉnh chỉ ghi thêm phần chênh. Đừng gộp hai loại này.
   */
  notRequiredInLedger: boolean;
  /** Chỉ số dòng trong AOA (+1) — KHÓA của Map `edits`, KHÔNG đổi kẻo hỏng bản đã lưu. */
  rowIndex: number;
  /** Dòng thật trong file Excel — dùng cho mọi chuỗi hiển thị cho người dùng. */
  fileRow: number;
  /** Kết quả kiểm "chưa thuế + thuế = tổng thanh toán" của CHÍNH dòng này. null = khớp. */
  sumMismatch: { diff: number; kind: SumMismatchKind } | null;
  cells: unknown[];
  series: string;
  invoiceNumber: string;
  normalizedNumber: string;
  issueDate: string;
  sellerTaxCode: string;
  sellerName: string;
  currency: string;
  /**
   * Tỷ giá ÁP DỤNG khi quy về VND (1 = không nhân). Ban đầu = tỷ giá đọc trên hóa đơn;
   * tầng đối soát có thể hạ về 1 nếu tự dò ra cổng thuế đã quy sẵn VND (xem
   * `phatHienQuyUocNgoaiTe`). Cột "Tỷ giá áp dụng" khi xuất lấy đúng số này.
   */
  exchangeRate: number;
  /** Tiền tệ khác VND mà ô tỷ giá trống/0 ⇒ KHÔNG quy đổi được (đang để nguyên số trên hóa đơn). */
  missingExchangeRate?: boolean;
  /** Số tiền GỐC trên hóa đơn (CHƯA nhân tỷ giá) — giữ để tự dò quy ước ngoại tệ. */
  preTaxRaw: number;
  taxRaw: number;
  totalRaw: number;
  preTaxVnd: number;
  taxVnd: number;
  totalVnd: number;
  key: string;
  ledgerMatchCount: number;
  ledgerTotal: number;
  difference: number | null;
  status: InvoiceMatchStatus;
  conclusion: string;
  evidence: string;
  ledgerVoucher: string;
  ctgs: string;
  postingDate: string;
  debitCreditAccounts: string;
  ledgerDescription: string;
  postedAmount: number | null;
  nearMatchNote?: string; // v3 §5.4: gợi ý cặp gần khớp cho dòng THIẾU
}

/**
 * CÂN ĐỐI CỘT của một sheet hóa đơn: kế toán hay cộng cột "chưa thuế" + cột "thuế"
 * rồi so với cột "tổng thanh toán"; lệch thì phải chỉ ra lệch ở đâu. Bóc phần lệch
 * thành 4 nguyên nhân để biết cái nào phải đi sửa, cái nào là bình thường.
 */
/** Nguyên nhân một dòng có chưa thuế + thuế ≠ tổng thanh toán. */
export type SumMismatchKind = "phi" | "chietKhau" | "lamTron" | "that";

export const SUM_MISMATCH_LABELS: Record<SumMismatchKind, string> = {
  phi: "có phí — bình thường",
  chietKhau: "có chiết khấu — bình thường",
  lamTron: "làm tròn ±1đ — bình thường",
  that: "LỆCH THẬT — phải soát",
};

/** Nguyên nhân lệch → ô bóc tương ứng trong `ColumnSumCheck.breakdown` / `rowCounts`. */
const BREAKDOWN_KEY: Record<SumMismatchKind, keyof ColumnSumCheck["breakdown"]> = {
  lamTron: "rounding",
  phi: "fee",
  chietKhau: "discount",
  that: "realDiff",
};
export interface ColumnSumCheck {
  /** Chỉ số cột (trong AOA) của ba cột tiền — để dựng công thức kiểm ngay trên sheet. */
  preTaxColumn: number;
  taxColumn: number;
  totalColumn: number;
  preTaxName: string;
  taxName: string;
  totalName: string;
  preTaxSum: number;
  taxSum: number;
  discountSum: number;
  feeSum: number;
  totalSum: number;
  /** totalSum − (preTaxSum + taxSum) — đúng con số kế toán nhìn thấy. */
  diff: number;
  /** Bóc `lech` theo nguyên nhân; bốn số này cộng lại đúng bằng `lech`. */
  breakdown: { fee: number; discount: number; rounding: number; realDiff: number };
  rowCounts: { fee: number; discount: number; rounding: number; realDiff: number };
  /** Danh sách dòng lệch KHÔNG giải thích được — chỗ phải đi sửa. */
  realDiffRows: { fileRow: number; invoice: string; date: string; seller: string; diff: number }[];
  /** Cột phí / chiết khấu (chỉ số AOA, −1 = không có). */
  feeColumn: number;
  discountColumn: number;
  /**
   * MỌI dòng có chưa thuế + thuế ≠ tổng thanh toán, kèm số thô từng ô — để kế toán
   * cộng tay lại đúng bằng ô lệch của họ ("sót dòng nào mà tổng không ra").
   */
  mismatchRows: SumMismatchRow[];
  /**
   * Ô LỆCH kế toán tự đặt dưới bảng (VD Q3049 = Σ tổng − (Σ chưa thuế + Σ thuế + Σ phí)).
   * Máy nhận ra bằng cách so giá trị ô với các cách tính quen thuộc; null = không thấy.
   */
  userDiffCell: UserDiffCell | null;
}

export interface SumMismatchRow {
  fileRow: number;
  invoice: string;
  date: string;
  seller: string;
  preTax: number;
  tax: number;
  fee: number;
  discount: number;
  total: number;
  /** tong − (chua + thue) */
  diff: number;
  kind: SumMismatchKind;
}

export interface UserDiffCell {
  /** Dòng Excel + chỉ số cột AOA — lớp xuất tự quy ra địa chỉ trong file ra (VD "Q3049"). */
  fileRow: number;
  column: number;
  value: number;
  /** Công thức kế toán đã cộng phí / đã trừ chiết khấu chưa — suy từ giá trị ô. */
  addsFee: boolean;
  subtractsDiscount: boolean;
  /** −1 nếu ô tính ngược chiều: (chưa thuế + thuế) − tổng. */
  sign: 1 | -1;
}

export interface InvoiceSheet {
  name: string;
  header: string[];
  preRows: unknown[][];
  rows: InvoiceRow[];
  isSubset?: boolean; // v3 §1.4: sheet HĐĐT là tập con của sheet khác → không vào tổng
  /** Tọa độ trong file gốc — để xuất file GIỮ NGUYÊN định dạng ghi đúng ô. */
  origin: SourceCellCoord;
  /** Chỉ số hàng tiêu đề trong AOA. */
  headerIndex: number;
  /** Số cột dữ liệu gốc (sau khi gỡ cột đối soát lần trước). */
  width: number;
  /** Cộng cột chưa thuế + thuế có bằng cột tổng thanh toán không, lệch thì do đâu. */
  columnSum: ColumnSumCheck;
}

export interface LedgerRow {
  sheet: string;
  /** Chỉ số dòng trong AOA (+1) — KHÓA của Map `edits`. */
  rowIndex: number;
  /** Dòng thật trong file Excel. */
  fileRow: number;
  cells: unknown[];
  ctgs: string;
  voucher: string;
  series: string;
  invoiceNumber: string;
  normalizedNumber: string;
  sellerTaxCode: string;
  sellerName: string;
  total: number;
  /** Tiền hàng / tiền thuế trên sổ — để dựng bảng ĐỐI CHIẾU TỔNG đủ 3 cột. */
  preTax: number;
  tax: number;
  invoiceDate: string;
  debitAccount: string;
  creditAccount: string;
  description: string;
  key: string;
  einvoiceMatchCount: number;
  status: LedgerMatchStatus;
  conclusion: string;
  evidence: string;
  einvoiceSource: string;
  einvoiceRow: number | null;
  invoiceIssueDate: string;
  einvoiceSellerName: string;
  einvoiceTotal: number | null;
  nearMatchNote?: string; // v3 §5.4
}

export interface LedgerSheet {
  name: string;
  header: string[];
  rows: LedgerRow[];
  /** Tiêu đề thật của cặp cột "TK Nợ / TK Có" (sổ mã máy là "TS% / LOAI"). */
  accountHeader: string;
  /** false = bản xuất chi tiết mặt hàng, không có cột tổng — tổng tự cộng tiền hàng + thuế. */
  hasTotalColumn: boolean;
  /** false = sổ không có cột MST người bán ⇒ khóa ghép thiếu MST, gần như không khớp được. */
  hasTaxCodeColumn: boolean;
  isSubset?: boolean;
  origin: SourceCellCoord;
  headerIndex: number;
  width: number;
}

export interface FlowWarning {
  kind: string;
  detail: string;
}

export interface ReconciliationResult {
  invoiceSheets: InvoiceSheet[];
  ledgerSheet: LedgerSheet | null;
  extraLedgerSheets: LedgerSheet[];
  totals: {
    invoiceCount: number;
    matched: number;
    mismatched: number;
    /** Hóa đơn KHỚP tổng thanh toán nhưng LỆCH THUẾ (nghi sai thuế suất/số thuế ở sổ). */
    taxMismatched: number;
    missing: number;
    /** Trong số `thieu`: hóa đơn đã bị thay thế/hủy — ĐÚNG là không có trong sổ. */
    missingNotRequired: number;
    nearMatched: number; // số dòng THIẾU có gợi ý gần khớp (là con của thieu)
    ledgerRowCount: number;
    ledgerMatched: number;
    ledgerMissing: number;
    totalDifference: number;
    parseErrorCount: number;
  };
  suspects: SuspectItem[]; // nhóm 1,2,3,6 — per dòng
  mergedSuspects: MergedSuspect[]; // nhóm 4,5,7 — gộp thống kê
  bridge: ReconciliationBridge;
  trialChecks: TrialCheck[];
  warnings: FlowWarning[];
  needsLedgerChoice: boolean;
  removedOldColumns: boolean; // v3 §1.5: đã gỡ cột đối soát của lần chạy trước
  editLog: { location: string; previous: string; next: string }[];
  threshold: number;
  /**
   * Sheet hóa đơn thuộc bản CƠ QUAN THUẾ gửi, do người dùng chỉ định trên màn
   * (undefined = máy tự nhận theo tên sheet, xem `resolveTaxSideSheets`). Engine KHÔNG dùng —
   * chỉ chở sang lớp xuất để sheet SO HAI BẢN chia bên giống màn hình.
   */
  taxSideSheets?: string[];
}

export interface ReconciliationOptions {
  threshold: number; // chênh ≤ ngưỡng vẫn coi KHỚP (VND). v3 §5.3 mặc định 1đ.
  edits?: Record<string, number>;
  initialSuspectCount?: number;
  ledgerSheetName?: string;
  /** Sheet thuộc bản THUẾ GỬI do người dùng chỉ định (undefined = máy tự nhận, xem `resolveTaxSideSheets`). */
  taxSideSheets?: string[];
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
const isInvoiceStatusText = (v: unknown): boolean => chuan(v).startsWith("hoa don ");
/** Mã tiền tệ 3 chữ cái viết hoa (VND/USD/JPY…). */
const isCurrencyCode = (v: unknown): boolean => /^[A-Z]{3}$/.test(String(v ?? "").trim().toUpperCase()) ;

/** Trạng thái hóa đơn: ưu tiên ô theo tiêu đề, hụt thì dò trong dòng. */
function readInvoiceStatus(row: unknown[], columns: number): string {
  if (columns >= 0 && isInvoiceStatusText(row[columns])) return String(row[columns] ?? "").trim();
  const v = row.find(isInvoiceStatusText);
  return v == null ? (columns >= 0 ? String(row[columns] ?? "").trim() : "") : String(v).trim();
}

/** Đơn vị tiền tệ + tỷ giá: hụt thì tìm mã tiền tệ trong dòng, tỷ giá là ô ngay sau. */
function readCurrency(row: unknown[], cDvt: number, cExchangeRate: number): { currency: string; exchangeRateRaw: unknown } {
  if (cDvt >= 0 && isCurrencyCode(row[cDvt])) return { currency: String(row[cDvt]).trim(), exchangeRateRaw: row[cExchangeRate] };
  const i = row.findIndex(isCurrencyCode);
  if (i < 0) return { currency: cDvt >= 0 ? cellStr(row, cDvt) : "", exchangeRateRaw: cExchangeRate >= 0 ? row[cExchangeRate] : null };
  return { currency: String(row[i]).trim(), exchangeRateRaw: row[i + 1] };
}

/** Lệch tới mức này coi là làm tròn, không phải sai (đồng). */
export const ROUNDING_TOLERANCE = 1;
/**
 * Dung sai làm tròn của dòng ngoại tệ để NGUYÊN TỆ (đơn vị ô là USD…, không phải đồng):
 * ±1 xu. Dùng `ROUNDING_TOLERANCE` ở đây là coi lệch 1 USD (~25.000 đ) là "làm tròn".
 */
export const FOREIGN_CURRENCY_TOLERANCE = 0.01;
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
export const GENERATED_SHEET_NAMES: ReadonlySet<string> = new Set([
  "KẾT LUẬN CHUNG", "KIỂM CHỨNG", "HÓA ĐƠN CHƯA KÊ", "SO HAI BẢN HĐĐT", "CÙNG MST CÙNG NGÀY", "NHẬT KÝ SỬA",
  // tên cũ (≤ v6.3) — gộp vào KẾT LUẬN CHUNG từ v6.4
  "ĐỐI CHIẾU TỔNG", "TỰ KIỂM TRA", "NGHI VẤN SỐ LIỆU",
]);

/** Ba cột KIỂM CỘNG dựng ngay trên sheet bảng kê (công thức sống trỏ ô gốc). */
export const COLUMN_SUM_CHECK_HEADERS = ["Chưa thuế + Thuế", "Lệch với tổng thanh toán", "Nguyên nhân lệch"] as const;

export const INVOICE_EXTRA_HEADERS = [
  "Tỷ giá áp dụng", "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Chưa thuế (VND)", "Thuế (VND)",
  "Tổng thanh toán (VND)", "Số dòng khớp PMKT", "Tổng TT bên PMKT", "Chênh lệch", "KẾT LUẬN",
  "Số phiếu kế toán", "Chứng từ ghi sổ", "Ngày ghi sổ", "TK Nợ / TK Có", "Diễn giải trên phần mềm",
  "Số tiền đã hạch toán", "BẰNG CHỨNG ĐỐI CHIẾU",
];
export const LEDGER_EXTRA_HEADERS = [
  "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Số HĐĐT khớp", "KẾT LUẬN", "Nguồn hóa đơn điện tử",
  "Dòng trên sheet HĐĐT", "Ngày lập HĐ", "Tên người bán trên HĐĐT", "Tổng TT trên HĐĐT (VND)",
  "BẰNG CHỨNG ĐỐI CHIẾU",
];

// ---------- Tiện ích parse ----------

const columnLetter = (i: number): string => (i < 0 ? "?" : columnIndexToLetter(i));

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
  const hasDot = s.includes(".");
  const coPhay = s.includes(",");
  if (hasDot && coPhay) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousand = decimal === "." ? "," : ".";
    s = s.split(thousand).join("").replace(decimal, ".");
  } else if (hasDot || coPhay) {
    const parts = s.split(hasDot ? "." : ",");
    const hasThousandsSep = parts.length > 2 || (parts[1]!.length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]!));
    s = parts.join(hasThousandsSep ? "" : ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (am ? -n : n) : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Độ lệch tối đa của Date SheetJS dựng ra (thực tế vài chục giây) — xem `formatDisplayDate`. */
const SAT_NUA_DEM = 2 * 60 * 1000;

export function formatDisplayDate(v: unknown): string {
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
export function normalizeInvoiceNumber(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\s+/g, "");
  const bo0 = s.replace(/^0+/, "");
  return bo0 || (s ? "0" : "");
}

/**
 * Ký hiệu chuẩn: cắt chữ số MẪU SỐ gộp ở đầu (sổ ghi `1C26TTN`, cổng thuế tách
 * thành mẫu số `1` + ký hiệu `C26TTN`). Ký hiệu thật luôn bắt đầu bằng chữ cái
 * nên cắt số đầu là an toàn. Áp cả hai bên. v3 §4.2
 */
export function normalizeInvoiceSymbol(v: unknown): string {
  const s = String(v ?? "").trim();
  const cat = s.replace(/^\d+/, "");
  return cat || s; // toàn số (hiếm) → giữ nguyên
}

/**
 * MST để so khớp: CHỈ giữ chữ số (`0301234567-001` = `0301234567001`), và bù số 0 đầu
 * khi còn 9 / 12 số — Excel nuốt số 0 đầu khi ô MST là kiểu số (`301234567`). Ô không có
 * chữ số nào thì giữ chữ đã chuẩn hóa.
 */
export function normalizeTaxCode(v: unknown): string {
  const so = String(v ?? "").replace(/\D/g, "");
  if (!so) return chuan(v);
  return so.length === 9 || so.length === 12 ? `0${so}` : so;
}

function makeKey(sellerTaxCode: string, series: string, normalizedNo: string): string {
  return `${normalizeTaxCode(sellerTaxCode)}|${chuan(normalizeInvoiceSymbol(series))}|${normalizedNo.toLowerCase()}`;
}

const cellStr = (row: unknown[], i: number): string =>
  i < 0 ? "" : String(row[i] ?? "").trim();


/**
 * Tọa độ gốc của một sheet: đổi chỉ số trong mảng AOA sang **ô Excel thật**.
 * Cần vì `sheet_to_json` bắt đầu từ ô đầu vùng dữ liệu (sheet cổng thuế hay bắt
 * đầu ở A3), còn `goCotDoiSoatCu` thì bỏ bớt cột ⇒ chỉ số AOA lệch với file.
 */
export interface SourceCellCoord {
  r0: number;
  c0: number;
  /** cột AOA (sau khi gỡ) → cột AOA gốc; rỗng = ánh xạ 1-1. */
  keptColumns: number[];
}
/** Cột AOA → cột Excel (0-based). */
export const aoaToExcelColumn = (g: SourceCellCoord, c: number): number => g.c0 + (g.keptColumns[c] ?? c);
/** Dòng AOA (`rowIndex` = chỉ số + 1) → dòng Excel (1-based). */
export const dongExcel = (g: SourceCellCoord, rowNo: number): number => g.r0 + rowNo;
/**
 * Địa chỉ ô Excel thật, ví dụ `K430`. `dich` = số cột lệch của FILE XUẤT so với
 * file vào (bản xuất chèn 1 cột "KẾT QUẢ" ở đầu nên mọi cột gốc dời sang phải 1).
 */
const oExcel = (g: SourceCellCoord, rowNo: number, c: number, target = 0): string =>
  `${columnLetter(aoaToExcelColumn(g, c) + target)}${dongExcel(g, rowNo)}`;
/** Số cột mà file XUẤT dời dữ liệu gốc sang phải (cột "KẾT QUẢ" chèn ở đầu). */
export const EXPORT_COLUMN_SHIFT = 1;

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
  taxCandidates: number[],
  totalCandidates: number[],
  cCk: number,
  cPhi: number
): { preTax: number; tax: number; total: number; extra: number[] } {
  const list = <T,>(a: T[]) => (a.length ? a : [-1]);
  let best: { preTax: number; tax: number; total: number } | null = null;
  let bestErr = Infinity;
  for (const preTax of list(preTaxCandidates))
    for (const tax of list(taxCandidates))
      for (const total of list(totalCandidates)) {
        let err = 0;
        let n = 0;
        for (let i = dataStart; i < rows.length; i++) {
          const r = rows[i] ?? [];
          const a = soVN(r[preTax]);
          const b = soVN(r[tax]);
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
          best = { preTax, tax, total };
        }
      }
  const chosen = best ?? { preTax: preTaxCandidates[0] ?? -1, tax: taxCandidates[0] ?? -1, total: totalCandidates[0] ?? -1 };
  const phu = [...preTaxCandidates, ...taxCandidates, ...totalCandidates].filter(
    (c) => c !== chosen.preTax && c !== chosen.tax && c !== chosen.total
  );
  return { ...chosen, extra: [...new Set(phu)] };
}

function findHeaderRow(rows: unknown[][], keywords: string[]): number {
  let best = -1;
  let bestScore = 0;
  const gioiHan = Math.min(rows.length, 15);
  for (let i = 0; i < gioiHan; i++) {
    const cells = (rows[i] ?? []).map((c) => chuan(c));
    let score = 0;
    for (const k of keywords) if (cells.some((c) => c.includes(k))) score++;
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
  name: string;
  rows: unknown[][];
  /** Hàng đầu vùng dữ liệu trong file Excel (0-based) — `sheet_to_json` bắt đầu từ đây. */
  r0: number;
  /** Cột đầu vùng dữ liệu trong file Excel (0-based). */
  c0: number;
  /** Số cột của vùng dữ liệu gốc. */
  width: number;
}

function docSheetsTuBuffer(buf: ArrayBuffer | Uint8Array): SheetTho[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((ten) => {
    const ws = wb.Sheets[ten]!;
    const rg = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    return {
      name: ten,
      r0: rg.s.r,
      c0: rg.s.c,
      width: rg.e.c - rg.s.c + 1,
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
  return docSheetsTuBuffer(normalizeToXlsx(new Uint8Array(await file.arrayBuffer())));
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
export function normalizeToXlsx(u: Uint8Array): Uint8Array {
  // "PK" = đã là .xlsx (zip). Còn lại (D0CF11E0 = CFB/BIFF, hoặc .xlsb…) thì đổi vỏ.
  if (u[0] === 0x50 && u[1] === 0x4b) return u;
  const wb = XLSX.read(u, { type: "array", cellDates: true, cellNF: true });
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
}

/** File Excel → base64 (để LƯU file gốc theo tài khoản). Mã hoá theo khối, an toàn file lớn. */
export async function fileSangBase64(file: File): Promise<string> {
  const u = normalizeToXlsx(new Uint8Array(await file.arrayBuffer()));
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
  return normalizeToXlsx(u);
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
 * Trả rows đã sạch + cờ đã-gỡ. Chỉ bỏ CỘT (giữ số dòng để `rowIndex` không đổi).
 */
const ADDED_HEADERS_NORM = new Set(
  [...INVOICE_EXTRA_HEADERS, ...LEDGER_EXTRA_HEADERS, ...COLUMN_SUM_CHECK_HEADERS, "KẾT QUẢ", "KIỂM CỘNG"].map(chuan)
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
): { rows: unknown[][]; removed: boolean; keptColumns: number[] } {
  // Dò hàng tiêu đề của lần chạy trước: có ô "KẾT QUẢ" + ít nhất 3 cột engine thêm.
  let hIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i] ?? [];
    const hasLabelInA = ["ket qua", "kiem cong"].includes(chuan(h[0]));
    // v6.5: file chỉ có bảng kê xuất KHÔNG chèn cột A — nhận ra bằng đủ 3 cột kiểm.
    const hasAllCheckColumns = COLUMN_SUM_CHECK_HEADERS.every((k) => h.some((c) => chuan(c) === chuan(k)));
    if ((hasLabelInA || hasAllCheckColumns || h.some((c) => chuan(c) === "ket qua")) && h.filter((c) => isExtraColumn(c)).length >= 3) {
      hIdx = i;
      break;
    }
  }
  if (hIdx < 0) return { rows, removed: false, keptColumns: [] };
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
  if (dau < 0 && drop.size === 0) return { rows, removed: false, keptColumns: [] };
  if (dau > 0) {
    // cột đệm trống ngay trước khối → gỡ luôn, kẻo mỗi lần chạy lại đẻ thêm một cột
    const dem = dau - 1;
    const emptyCount =
      dem > 0 && !chuan(header[dem]) && rows.every((r) => (r ?? [])[dem] == null || (r ?? [])[dem] === "");
    for (let c = emptyCount ? dem : dau; c < width; c++) drop.add(c);
  }
  const keptColumns: number[] = [];
  for (let c = 0; c < width; c++) if (!drop.has(c)) keptColumns.push(c);
  const cleaned = rows.map((r) => (r ?? []).filter((_, c) => !drop.has(c)));
  return { rows: cleaned, removed: true, keptColumns };
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
): { diff: number; normal: number; headerColumn: number; diffColumn: number } | null {
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
  let mismatch = 0;
  let diffColumn = -1;
  for (const [k, n] of dem)
    if (k > headerLastColumn) {
      mismatch += n;
      diffColumn = Math.max(diffColumn, k);
    }
  if (!mismatch) return null;
  return { diff: mismatch, normal: [...dem].reduce((s, [k, n]) => s + (k > headerLastColumn ? 0 : n), 0), headerColumn: headerLastColumn, diffColumn };
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
 *    phải tự cộng (`hasTotalColumn = false` ở `parseSheetPhanMem`).
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
  const k = buildEditKey(sheet, rowNo, columns);
  if (edits && k in edits) return edits[k];
  return row[columns];
}

function applyFixToRow(
  row: unknown[],
  header: string[],
  sheet: string,
  rowNo: number,
  edits: Record<string, number> | undefined,
  changeLog: { location: string; previous: string; next: string }[],
  g: SourceCellCoord
): unknown[] {
  if (!edits) return row;
  let clone: unknown[] | null = null;
  for (const [k, v] of Object.entries(edits)) {
    const { sheet: sh, rowIndex: sd, column: c } = parseEditKey(k);
    if (sh !== sheet || sd !== rowNo) continue;
    if (!clone) clone = [...row];
    const prev = row[c];
    clone[c] = v;
    changeLog.push({
      location: `${sheet} · ô ${oExcel(g, rowNo, c)} (${header[c] ?? ""})`,
      previous: prev == null || prev === "" ? "(trống)" : String(prev),
      next: String(v),
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
  isSales: boolean;
  preTax: number;
  tax: number;
  total: number;
  discount: number;
  fee: number;
  preTaxName: string;
  taxName: string;
  totalName: string;
}

function suspectColumnSum(
  sheet: string,
  rowNo: number,
  row: unknown[],
  columns: SumColumns,
  edits: Record<string, number> | undefined,
  g: SourceCellCoord,
  /** Dung sai làm tròn theo ĐƠN VỊ của ô (đồng, hoặc nguyên tệ — `FOREIGN_CURRENCY_TOLERANCE`). */
  sumTolerance = ROUNDING_TOLERANCE
): SuspectItem | null {
  const a = soVN(layO(row, columns.preTax, sheet, rowNo, edits));
  const b = soVN(layO(row, columns.tax, sheet, rowNo, edits));
  const t = soVN(layO(row, columns.total, sheet, rowNo, edits));
  const ck = soVN(layO(row, columns.discount, sheet, rowNo, edits)) ?? 0;
  const phi = soVN(layO(row, columns.fee, sheet, rowNo, edits)) ?? 0;
  // Lệch 1 đồng là LÀM TRÒN của bên phát hành, không phải sai sót — báo lên chỉ làm
  // nhiễu (file thuế 6 tháng có 26 dòng lệch đúng ±1 đ). Phần này vẫn được cộng vào
  // bảng cân đối cột để tổng luôn khớp.
  const totalCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.total)} (${columns.totalName})`;
  const preTaxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.preTax)} (${columns.preTaxName})`;
  const taxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.tax)} (${columns.taxName})`;
  const D = EXPORT_COLUMN_SHIFT;
  const exportTotalCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.total, D)} (${columns.totalName})`;
  const exportPreTaxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.preTax, D)} (${columns.preTaxName})`;
  const exportTaxCellRef = `${sheet} · ô ${oExcel(g, rowNo, columns.tax, D)} (${columns.taxName})`;
  const coA = a != null, coB = b != null, coT = t != null;
  const missingCount = [coA, coB, coT].filter((x) => !x).length;

  // HÓA ĐƠN BÁN HÀNG (mẫu số 2) — không có thuế GTGT. Ô thuế trống/0 là ĐÚNG, đừng
  // đòi điền; chỗ phải soi là ô CHƯA THUẾ: nó phải bằng tổng thanh toán (trừ chiết
  // khấu, cộng phí). Sai thì chỉ vào ô chưa thuế, KHÔNG suy ngược thành số thuế.
  // CHỈ xét khi ô chưa thuế CÓ SỐ: bỏ trống cả cụm thì để nhánh nhóm 4 gom thống kê
  // như cũ (bung ra từng dòng là 60+ dòng nhiễu trên file thật, không giúp gì thêm).
  if (columns.isSales && coA) {
    if (!coT || (b ?? 0) !== 0) return null; // có thuế thật ⇒ không phải diện này
    const expected = t! + ck - phi;
    if (withinTolerance(a! - expected, sumTolerance)) return null;
    return {
      group: 1,
      location: preTaxCellRef,
      exportLocation: exportPreTaxCellRef,
      currentValue: num(a!),
      expectedValue: num(expected),
      expectedSource: `hóa đơn bán hàng (mẫu số 2) không có thuế GTGT ⇒ chưa thuế = ${columns.totalName}${ck ? " + chiết khấu" : ""}${phi ? " − phí" : ""} = ${num(expected)}`,
      wrongAt: `chưa thuế ${num(a!)} nhưng tổng thanh toán ${num(t!)}, lệch ${num(expected - a!)} đ; hóa đơn này không có thuế nên hai số phải bằng nhau`,
      impact: "sai cột chưa thuế khi lập tờ khai; KHÔNG được ghi phần lệch thành tiền thuế",
      sheet, rowIndex: rowNo, column: columns.preTax, columnName: columns.preTaxName, oldValue: a, correctValue: expected,
    };
  }

  // Nhóm 4: thiếu CẢ CỤM (không suy được) — chỉ còn tổng
  if (!coA && !coB && coT)
    return {
      group: 4,
      location: `${preTaxCellRef} + ${taxCellRef}`,
      exportLocation: `${exportPreTaxCellRef} + ${exportTaxCellRef}`,
      currentValue: "(trống cả chưa thuế lẫn thuế)",
      expectedValue: "chưa xác định",
      expectedSource: "không đủ dữ liệu để tính ngược",
      wrongAt: `chỉ có tổng ${num(t!)} đ, thiếu cả hai thành phần`,
      impact: "cột chưa thuế & thuế sẽ thiếu; tổng vẫn dùng được",
    };
  // Nhóm 5: TỔNG bị xóa nhưng thành phần còn → suy được, gộp thống kê
  if (!coT && coA && coB) {
    const expected = a! + b! - ck + phi;
    return {
      group: 5,
      location: totalCellRef,
      exportLocation: exportTotalCellRef,
      currentValue: "(trống)",
      expectedValue: num(expected),
      expectedSource: `${columns.preTaxName} + ${columns.taxName}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(a!)} + ${num(b!)}`,
      wrongAt: "ô tổng bị xóa trong khi các ô thành phần còn",
      impact: "chỉ ô tổng; đối soát dùng tổng suy ra",
      sheet, rowIndex: rowNo, column: columns.total, columnName: columns.totalName, oldValue: t, correctValue: expected,
    };
  }
  // Nhóm 2: thiếu ĐÚNG MỘT thành phần, tổng còn → suy được
  if (coT && missingCount === 1 && (!coA || !coB)) {
    if (!coA) {
      const expected = t! - b! + ck - phi;
      return {
        group: 2, location: preTaxCellRef, exportLocation: exportPreTaxCellRef, currentValue: "(trống)", expectedValue: num(expected),
        expectedSource: `${columns.totalName} − ${columns.taxName}${ck ? " + chiết khấu" : ""}${phi ? " − phí" : ""} = ${num(t!)} − ${num(b!)}`,
        wrongAt: "thiếu ô chưa thuế, suy ngược từ tổng và thuế", impact: "chỉ ô chưa thuế",
        sheet, rowIndex: rowNo, column: columns.preTax, columnName: columns.preTaxName, oldValue: a, correctValue: expected,
      };
    }
    const expectedTax = t! - a! + ck - phi;
    return {
      group: 2, location: taxCellRef, exportLocation: exportTaxCellRef, currentValue: "(trống)", expectedValue: num(expectedTax),
      expectedSource: `${columns.totalName} − ${columns.preTaxName} = ${num(t!)} − ${num(a!)}`,
      wrongAt: "thiếu ô thuế, suy ngược từ tổng và chưa thuế", impact: "chỉ ô thuế",
      sheet, rowIndex: rowNo, column: columns.tax, columnName: columns.taxName, oldValue: b, correctValue: expectedTax,
    };
  }
  // Nhóm 1: đủ thành phần nhưng CỘNG KHÔNG KHỚP — chỉ báo khi CẢ HAI cách lệch
  if (coA && coB && coT) {
    const e1 = Math.abs(a! + b! - t!);
    const e2 = Math.abs(a! + b! - ck + phi - t!);
    if (!withinTolerance(e1, sumTolerance) && !withinTolerance(e2, sumTolerance) && b !== 0) {
      const expected = a! + b! - ck + phi;
      return {
        group: 1, location: totalCellRef, exportLocation: exportTotalCellRef, currentValue: num(t!), expectedValue: num(expected),
        expectedSource: `${columns.preTaxName} + ${columns.taxName}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(expected)} (giả định tổng sai)`,
        wrongAt: `cộng lệch cả hai cách: |${num(a!)}+${num(b!)}−${num(t!)}| = ${num(e1)} đ và tính cả chiết khấu/phí vẫn lệch ${num(e2)} đ`,
        impact: "nếu sửa tổng: đổi ô tổng dòng này; các dòng khác không đổi",
        sheet, rowIndex: rowNo, column: columns.total, columnName: columns.totalName, oldValue: t, correctValue: expected,
      };
    }
  }
  return null;
}

function addToGroup(mergeMap: Map<string, MergedSuspect>, nv: SuspectItem, amount: number, ben: "hd" | "pm") {
  const gk = `${ben}${nv.group}`;
  const g = mergeMap.get(gk) ?? {
    group: nv.group,
    name:
      (nv.group === 4 ? "Thiếu cả cụm (chỉ còn tổng)" : "Tổng bị xóa (thành phần còn)") +
      (ben === "hd" ? " — hóa đơn" : " — phần mềm"),
    rowCount: 0,
    totalAmount: 0,
    warning:
      nv.group === 4
        ? "Thiếu chưa thuế & thuế — đừng lấy cột chưa thuế đi lập tờ khai."
        : "Ô tổng bị xóa; đối soát dùng tổng suy ra — soát lại có hợp lý không.",
    items: [],
  };
  g.rowCount++;
  g.totalAmount += amount;
  g.items.push(nv);
  mergeMap.set(gk, g);
}

// ---------- Parse sheet HĐĐT ----------

function parseInvoiceSheet(
  ten: string,
  rows: unknown[][],
  hIdx: number,
  edits: Record<string, number> | undefined,
  suspects: SuspectItem[],
  mergeMap: Map<string, MergedSuspect>,
  changeLog: { location: string; previous: string; next: string }[],
  g: SourceCellCoord,
  width: number,
  /** Dòng ngoại tệ của sheet này để NGUYÊN TỆ (đã dò quy ước) ⇒ dung sai làm tròn theo xu, không theo đồng. */
  originalCurrency = false
): { sheet: InvoiceSheet; loiParse: number } {
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
    isSales: false,
    preTax: sel.preTax, tax: sel.tax, total: sel.total, discount: cCk, fee: cPhi,
    preTaxName: header[sel.preTax] ?? "Tổng tiền chưa thuế",
    taxName: header[sel.tax] ?? "Tổng tiền thuế",
    totalName: header[sel.total] ?? "Tổng tiền thanh toán",
  };
  const colSeries = cot1(headerRaw, "Ký hiệu hóa đơn");
  const cSo = cot1(headerRaw, "Số hóa đơn");
  const cDate = cot1(headerRaw, "Ngày lập");
  const colSellerTaxCode = cot1(headerRaw, "MST người bán/MST người xuất hàng", "MST người bán");
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

  for (const p of sel.extra)
    suspects.push({
      group: 6,
      location: `${ten} · cột ${columnLetter(aoaToExcelColumn(g, p))} (${header[p] ?? ""})`,
      exportLocation: `${ten} · cột ${columnLetter(aoaToExcelColumn(g, p) + EXPORT_COLUMN_SHIFT)} (${header[p] ?? ""})`,
      currentValue: "(cột phụ trùng tên cột gốc)",
      expectedValue: "—",
      expectedSource: "cột gốc đã chọn theo độ khớp với tổng thanh toán",
      wrongAt: "người dùng tự thêm cột trùng tên; giá trị có thể khác cột gốc",
      impact: "KHÔNG tham gia đối soát; chỉ ảnh hưởng ô tổng người dùng tự cộng",
    });

  const dong: InvoiceRow[] = [];
  let loiParse = 0;
  // --- cân đối cột: cộng đúng như kế toán cộng trên Excel (số THÔ, không quy tỷ giá) ---
  const cd: ColumnSumCheck = {
    preTaxColumn: cCols.preTax, taxColumn: cCols.tax, totalColumn: cCols.total,
    preTaxName: cCols.preTaxName, taxName: cCols.taxName, totalName: cCols.totalName,
    preTaxSum: 0, taxSum: 0, discountSum: 0, feeSum: 0, totalSum: 0, diff: 0,
    breakdown: { fee: 0, discount: 0, rounding: 0, realDiff: 0 },
    rowCounts: { fee: 0, discount: 0, rounding: 0, realDiff: 0 },
    realDiffRows: [],
    feeColumn: cCols.fee, discountColumn: cCols.discount, mismatchRows: [], userDiffCell: null,
  };
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isTotalRow(row)) continue;
    const rowNo = i + 1;
    const invoiceNo = String(layO(row, cSo, ten, rowNo, edits) ?? "").trim();
    const series = String(layO(row, colSeries, ten, rowNo, edits) ?? "").trim();
    // Bỏ dòng GHI CHÚ TAY của kế toán ở CUỐI sheet (khối "chênh lệch / hoá đơn cty
    // chưa kê khai / số của Linh…"): mọi hóa đơn thật đều có KÝ HIỆU hoặc MST người
    // bán hợp lệ — dòng ghi chú không có cả hai nên KHÔNG cộng, KHÔNG báo "chưa có
    // trong sổ", KHÔNG gắn "lệch thật" (số kế toán đang tự tính, đừng đụng vào).
    if (!series && !isValidTaxCode(cellStr(row, colSellerTaxCode))) continue;

    const tt = readCurrency(row, cDvt, cExchangeRate);
    const dvt = tt.currency || "VND";
    const laVnd = chuan(dvt) === "vnd" || chuan(dvt) === "";
    const rawExchangeRate = soVN(tt.exchangeRateRaw);
    const missingExchangeRate = !laVnd && !(rawExchangeRate && rawExchangeRate > 0);
    const exchangeRate = laVnd || missingExchangeRate ? 1 : rawExchangeRate!;
    const tol = originalCurrency && exchangeRate > 1 ? FOREIGN_CURRENCY_TOLERANCE : ROUNDING_TOLERANCE;
    const preTax = soVN(layO(row, cCols.preTax, ten, rowNo, edits));
    const tax = soVN(layO(row, cCols.tax, ten, rowNo, edits));
    const total = soVN(layO(row, cCols.total, ten, rowNo, edits));
    if (total == null) loiParse++;

    const nv = suspectColumnSum(ten, rowNo, row, { ...cCols, isSales: isSalesRow(row) }, edits, g, tol);
    if (nv) {
      if (nv.group === 4 || nv.group === 5) addToGroup(mergeMap, nv, (nv.group === 4 ? total : nv.correctValue) ?? 0, "hd");
      else suspects.push(nv);
    }

    // cộng cột + bóc nguyên nhân lệch của CHÍNH dòng này
    let rowSumMismatch: InvoiceRow["sumMismatch"] = null;
    {
      const a = soVN(row[cCols.preTax]) ?? 0, b = soVN(row[cCols.tax]) ?? 0;
      const ck = cCols.discount >= 0 ? soVN(row[cCols.discount]) ?? 0 : 0;
      const phi = cCols.fee >= 0 ? soVN(row[cCols.fee]) ?? 0 : 0;
      const tg = soVN(row[cCols.total]) ?? 0;
      cd.preTaxSum += a; cd.taxSum += b; cd.discountSum += ck; cd.feeSum += phi; cd.totalSum += tg;
      const d = tg - (a + b);
      if (Math.abs(d) > tol / 2) {
        // thứ tự xét: làm tròn → phí → chiết khấu → lệch thật (phí/chiết khấu là
        // thành phần HỢP LỆ của tổng, không phải sai sót)
        const mismatchKind: SumMismatchKind =
          withinTolerance(d, tol) ? "lamTron"
          : phi && withinTolerance(d - phi, tol) ? "phi"
          : ck && withinTolerance(d + ck, tol) ? "chietKhau"
          : "that";
        rowSumMismatch = { diff: d, kind: mismatchKind };
        const k = BREAKDOWN_KEY[mismatchKind];
        cd.breakdown[k] += d;
        cd.rowCounts[k]++;
        const ma = `${series}-${invoiceNo}`;
        const date = formatDisplayDate(row[cDate]);
        const ban = cellStr(row, cSellerName);
        cd.mismatchRows.push({ fileRow: dongExcel(g, rowNo), invoice: ma, date, seller: ban, preTax: a, tax: b, fee: phi, discount: ck, total: tg, diff: d, kind: mismatchKind });
        if (mismatchKind === "that") cd.realDiffRows.push({ fileRow: dongExcel(g, rowNo), invoice: ma, date, seller: ban, diff: d });
      }
    }

    const normalizedNo = normalizeInvoiceNumber(invoiceNo);
    const sellerTaxCode = cellStr(row, colSellerTaxCode);
    const invoiceStatus = readInvoiceStatus(row, cStatus);
    dong.push({
      sheet: ten, rowIndex: rowNo, fileRow: dongExcel(g, rowNo),
      sumMismatch: rowSumMismatch,
      invoiceStatus,
      notRequiredInLedger: isNotBookable(invoiceStatus),
      layoutMismatch: isRowWider(row),
      cells: applyFixToRow(row, header, ten, rowNo, edits, changeLog, g),
      series, invoiceNumber: invoiceNo, normalizedNumber: normalizedNo,
      issueDate: formatDisplayDate(row[cDate]),
      sellerTaxCode, sellerName: cellStr(row, cSellerName), currency: dvt, exchangeRate,
      ...(missingExchangeRate ? { missingExchangeRate } : {}),
      preTaxRaw: preTax ?? 0,
      taxRaw: tax ?? 0,
      totalRaw: total ?? 0,
      preTaxVnd: (preTax ?? 0) * exchangeRate,
      taxVnd: (tax ?? 0) * exchangeRate,
      totalVnd: (total ?? 0) * exchangeRate,
      key: makeKey(sellerTaxCode, series, normalizedNo),
      ledgerMatchCount: 0, ledgerTotal: 0, difference: null, status: "THIEU",
      conclusion: "", evidence: "", ledgerVoucher: "", ctgs: "", postingDate: "",
      debitCreditAccounts: "", ledgerDescription: "", postedAmount: null,
    });
  }
  cd.diff = cd.totalSum - (cd.preTaxSum + cd.taxSum);
  cd.realDiffRows.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  cd.userDiffCell = findCustomTotalCell(rows, dataStart, cd, g, (r) => !String(r[cSo] ?? "").trim() && !String(r[colSeries] ?? "").trim());
  return { sheet: { name: ten, header, preRows, rows: dong, origin: g, headerIndex: hIdx, width, columnSum: cd }, loiParse };
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
  cd: ColumnSumCheck,
  g: SourceCellCoord,
  isOutsideRow: (r: unknown[]) => boolean
): UserDiffCell | null {
  const method: Omit<UserDiffCell, "fileRow" | "column" | "value" | "sign">[] = [
    { addsFee: false, subtractsDiscount: false },
    { addsFee: true, subtractsDiscount: false },
    { addsFee: true, subtractsDiscount: true },
    { addsFee: false, subtractsDiscount: true },
  ];
  const mong = (c: (typeof method)[number]) => cd.diff - (c.addsFee ? cd.feeSum : 0) + (c.subtractsDiscount ? cd.discountSum : 0);
  // Ô bằng đúng TỔNG MỘT CỘT là ô SUM của cột đó, không phải ô lệch (VD bảng kê khớp
  // tuyệt đối, lệch 0 ⇒ "lệch + Σ chiết khấu" trùng ngay ô SUM cột chiết khấu).
  const isColumnTotal = (x: number) =>
    [cd.preTaxSum, cd.taxSum, cd.totalSum, cd.feeSum, cd.discountSum].some((t) => t && Math.abs(Math.abs(x) - Math.abs(t)) <= 0.5);
  let ra: UserDiffCell | null = null;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (!isOutsideRow(r) && !isTotalRow(r)) continue;
    r.forEach((v, c) => {
      const x = typeof v === "number" ? v : null;
      if (x == null || Math.abs(x) <= 1 || isColumnTotal(x)) return;
      for (const k of method) {
        // phí/chiết khấu bằng 0 thì các cách trùng nhau — lấy cách đơn giản nhất
        if ((k.addsFee && !cd.feeSum) || (k.subtractsDiscount && !cd.discountSum)) continue;
        const m = mong(k);
        const dau = Math.abs(x - m) <= 0.5 ? 1 : Math.abs(x + m) <= 0.5 ? -1 : 0;
        if (dau) {
          ra = { ...k, sign: dau, value: x, fileRow: dongExcel(g, i + 1), column: c };
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
  suspects: SuspectItem[],
  mergeMap: Map<string, MergedSuspect>,
  changeLog: { location: string; previous: string; next: string }[],
  g: SourceCellCoord,
  width: number
): LedgerSheet {
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
    isSales: false, // sổ kế toán không có khái niệm mẫu số hóa đơn
    preTax: sel.preTax, tax: sel.tax, total: sel.total, discount: -1, fee: -1,
    preTaxName: header[sel.preTax] ?? "ST chưa thuế",
    taxName: header[sel.tax] ?? "Tiền thuế",
    totalName: header[sel.total] ?? "Tổng cộng",
  };
  const cCtgs = cot1(headerRaw, "CTGS", "SCT_GHISO");
  const cVoucher = cot1(headerRaw, "Phiếu", "SO_PHIEU");
  const colSeries = cot1(headerRaw, "KHHĐ", "KY_HIEU", "KH_HD");
  const cSo = cot1(headerRaw, "Số HĐ", "SO_HD");
  // "MST người bán" đứng trước "MST" để bước khớp-đầu-chữ không vớ nhầm "MST người mua".
  const colTaxCode = cot1(headerRaw, "MASOTHUE", "RMST", "MS_THUE", "MST người bán", "Mã số thuế", "MST");
  const cInvoiceDate = cot1(headerRaw, "Ngày HĐ", "NGAY_HD");
  // Sổ mã máy (PMEM) không có TK Nợ/Có mà có TS% + LOAI ⇒ nhận cả hai kiểu,
  // tên cột ở file xuất lấy đúng theo tiêu đề tìm được (`accountHeader`).
  const cTkNo = cot1(headerRaw, "TK Nợ", "TS%", "Thuế suất");
  const cTkCo = cot1(headerRaw, "TK Có", "LOAI", "Loại");
  const cDescription = cot1(headerRaw, "Tên mặt hàng", "MAT_HANG", "NOIDUNG", "GHICHU");
  const cSellerName = cot1(headerRaw, "Tên người bán", "NGUOI_BAN", "DONVIBAN");
  // Bản xuất chi tiết mặt hàng KHÔNG có cột tổng ⇒ tổng = tiền hàng + tiền thuế,
  // và KHÔNG được soi "cộng có khớp tổng không" (không có tổng để soi — soi là báo
  // oan cả sổ thành "tổng bị xóa").
  const hasTotalColumn = cCols.total >= 0;

  for (const p of sel.extra)
    suspects.push({
      group: 6,
      location: `${ten} · cột ${columnLetter(aoaToExcelColumn(g, p))} (${header[p] ?? ""})`,
      exportLocation: `${ten} · cột ${columnLetter(aoaToExcelColumn(g, p) + EXPORT_COLUMN_SHIFT)} (${header[p] ?? ""})`,
      currentValue: "(cột phụ trùng tên)",
      expectedValue: "—",
      expectedSource: "cột gốc chọn theo độ khớp với tổng cộng",
      wrongAt: "cột trùng tên do người dùng thêm",
      impact: "KHÔNG tham gia đối soát",
    });

  const dong: LedgerRow[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isTotalRow(row)) continue;
    const rowNo = i + 1;
    const invoiceNo = String(layO(row, cSo, ten, rowNo, edits) ?? "").trim();
    const series = String(layO(row, colSeries, ten, rowNo, edits) ?? "").trim();
    if (!invoiceNo && !series) continue;

    const nv = hasTotalColumn ? suspectColumnSum(ten, rowNo, row, cCols, edits, g) : null;
    if (nv) {
      if (nv.group === 4 || nv.group === 5) addToGroup(mergeMap, nv, (nv.group === 4 ? soVN(row[cCols.total]) : nv.correctValue) ?? 0, "pm");
      else suspects.push(nv);
    }

    const normalizedNo = normalizeInvoiceNumber(invoiceNo);
    const sellerTaxCode = cellStr(row, colTaxCode);
    dong.push({
      sheet: ten, rowIndex: rowNo, fileRow: dongExcel(g, rowNo),
      cells: applyFixToRow(row, header, ten, rowNo, edits, changeLog, g),
      ctgs: cellStr(row, cCtgs), voucher: cellStr(row, cVoucher),
      series, invoiceNumber: invoiceNo, normalizedNumber: normalizedNo, sellerTaxCode, sellerName: cellStr(row, cSellerName),
      total: hasTotalColumn
        ? soVN(layO(row, cCols.total, ten, rowNo, edits)) ?? 0
        : (soVN(layO(row, cCols.preTax, ten, rowNo, edits)) ?? 0) + (soVN(layO(row, cCols.tax, ten, rowNo, edits)) ?? 0),
      preTax: soVN(layO(row, cCols.preTax, ten, rowNo, edits)) ?? 0,
      tax: soVN(layO(row, cCols.tax, ten, rowNo, edits)) ?? 0,
      invoiceDate: formatDisplayDate(row[cInvoiceDate]),
      debitAccount: cellStr(row, cTkNo), creditAccount: cellStr(row, cTkCo), description: cellStr(row, cDescription),
      key: makeKey(sellerTaxCode, series, normalizedNo),
      einvoiceMatchCount: 0, status: "THIEU", conclusion: "", evidence: "",
      einvoiceSource: "", einvoiceRow: null, invoiceIssueDate: "", einvoiceSellerName: "", einvoiceTotal: null,
    });
  }
  // Tiêu đề mã máy viết hoa trần (TS%, LOAI) — đổi sang chữ kế toán vẫn gọi.
  const chuDep: Record<string, string> = { "ts%": "Thuế suất", loai: "Loại", ghichu: "Ghi chú" };
  const label = (c: number, mac: string) => {
    const t = String(header[c] ?? "").trim();
    return t ? (chuDep[chuan(t)] ?? t) : mac;
  };
  const tenTk = `${label(cTkNo, "TK Nợ")} / ${label(cTkCo, "TK Có")}`;
  return { name: ten, header, rows: dong, origin: g, headerIndex: hIdx, width, accountHeader: tenTk, hasTotalColumn, hasTaxCodeColumn: colTaxCode >= 0 };
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
function revertToOriginal(items: readonly InvoiceRow[]): void {
  for (const d of items) {
    d.preTaxVnd = d.preTaxRaw;
    d.taxVnd = d.taxRaw;
    d.totalVnd = d.totalRaw;
    d.exchangeRate = 1; // tỷ giá ÁP DỤNG = 1 (rate gốc vẫn còn ở cột "Tỷ giá" của file nguồn)
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
  all: readonly InvoiceSheet[],
  warnings: FlowWarning[],
  /** Chỉ KẾT LUẬN cho các sheet này (mốc vẫn lấy từ mọi sheet). */
  onlyCheck: readonly InvoiceSheet[] = all
): InvoiceRow[] {
  const byKey = new Map<string, InvoiceRow[]>();
  for (const sh of all)
    for (const d of sh.rows) {
      if (d.layoutMismatch || !d.key) continue; // cột tiền lệch ô — không làm mốc được
      const a = byKey.get(d.key);
      if (a) a.push(d);
      else byKey.set(d.key, [d]);
    }
  const salesInvoice = new Map<string, { origin: number; converted: number }>();
  for (const items of byKey.values())
    for (const d of items) {
      if (!(d.exchangeRate > 1) || !d.totalRaw) continue;
      const moc: number[] = [];
      for (const e of items) {
        if (e.sheet === d.sheet || !e.totalRaw) continue;
        moc.push(e.totalRaw);
        if (e.exchangeRate > 1) moc.push(e.totalRaw * e.exchangeRate);
      }
      if (!moc.length) continue;
      const relativeError = (v: number) => Math.min(...moc.map((m) => Math.abs(v - m) / Math.max(Math.abs(v), Math.abs(m))));
      const rawError = relativeError(d.totalRaw);
      const multipliedError = relativeError(d.totalRaw * d.exchangeRate);
      const p = salesInvoice.get(d.sheet) ?? { origin: 0, converted: 0 };
      if (rawError < 0.05 && multipliedError > 0.5) p.origin++;
      else if (multipliedError < 0.05 && rawError > 0.5) p.converted++;
      salesInvoice.set(d.sheet, p);
    }

  const unresolved: InvoiceRow[] = [];
  for (const sh of onlyCheck) {
    const nt = sh.rows.filter((d) => d.exchangeRate > 1);
    if (!nt.length) continue;
    const p = salesInvoice.get(sh.name);
    if (p && p.origin > p.converted) {
      revertToOriginal(nt);
      warnings.push({
        kind: "Đơn vị tiền tệ ngoại tệ",
        detail: `Sheet "${sh.name}": ${nt.length} hóa đơn ngoại tệ đã QUY SẴN ra VND ở cột tiền — KHÔNG nhân tỷ giá (không có sổ, đối chiếu với bản còn lại: ${p.origin} hóa đơn có số GỐC sát bản kia, ${p.converted} hóa đơn sát khi ×tỷ giá).`,
      });
    } else if (p && p.converted > p.origin) {
      warnings.push({
        kind: "Đơn vị tiền tệ ngoại tệ",
        detail: `Sheet "${sh.name}": ${nt.length} hóa đơn ngoại tệ để NGUYÊN TỆ — quy về VND bằng cách NHÂN tỷ giá (không có sổ, đối chiếu với bản còn lại: ${p.converted} hóa đơn sát bản kia khi ×tỷ giá, ${p.origin} hóa đơn sát khi để nguyên).`,
      });
    } else unresolved.push(...nt);
  }
  return unresolved;
}

function detectForeignCurrencyMode(
  activeInvoiceSheets: InvoiceSheet[],
  ledgerByKey: Map<string, LedgerRow[]>,
  warnings: FlowWarning[],
  allInvoiceSheets: readonly InvoiceSheet[] = activeInvoiceSheets,
): void {
  if (!allInvoiceSheets.some((sh) => sh.rows.some((d) => d.exchangeRate > 1))) return; // file toàn VND — không có gì để dò
  const fxRows: InvoiceRow[] = [];
  for (const sh of activeInvoiceSheets)
    for (const d of sh.rows) if (d.exchangeRate > 1) fxRows.push(d);

  // Mẫu: hóa đơn ngoại tệ có dòng sổ cùng khóa. So sai số tương đối với sổ.
  let rawCloserCount = 0; // số mẫu mà SỐ GỐC sát sổ hơn (⇒ cổng đã quy sẵn VND)
  let multipliedCloserCount = 0; // số mẫu mà SỐ ×TỶ GIÁ sát sổ hơn (⇒ để nguyên tệ, phải nhân)
  let sampleCount = 0;
  for (const d of fxRows) {
    const pm = ledgerByKey.get(d.key);
    if (!pm?.length) continue;
    const so = pm.reduce((s, x) => s + x.total, 0);
    if (!(so > 0)) continue;
    sampleCount++;
    const rawError = Math.abs(so - d.totalRaw) / so; // số gốc so với sổ
    const multipliedError = Math.abs(so - d.totalRaw * d.exchangeRate) / so; // số ×tỷ giá so với sổ
    if (rawError < multipliedError) rawCloserCount++;
    else if (multipliedError < rawError) multipliedCloserCount++;
  }

  if (sampleCount === 0) {
    // Không có sổ làm mốc ⇒ thử lấy bản còn lại (file so hai bản) làm mốc, từng sheet.
    const unresolved = detectConventionFromPeer(allInvoiceSheets, warnings);
    if (!unresolved.length) return;
    warnings.push({
      kind: "Đơn vị tiền tệ ngoại tệ",
      detail: `${unresolved.length} hóa đơn ngoại tệ nhưng KHÔNG có hóa đơn nào khớp được dòng sổ để đối chiếu — engine tạm QUY VỀ VND bằng cách NHÂN tỷ giá (hành vi mặc định). Nếu cổng thuế đã ghi sẵn VND thì số sẽ bị đội lên; hãy soát tay vài dòng ngoại tệ rồi báo lại.`,
    });
    return;
  }

  // Số gốc sát sổ hơn ở đa số mẫu ⇒ cổng đã quy sẵn VND ⇒ BỎ nhân tỷ giá.
  const daVnd = rawCloserCount > multipliedCloserCount;
  if (daVnd) {
    revertToOriginal(fxRows);
    warnings.push({
      kind: "Đơn vị tiền tệ ngoại tệ",
      detail: `${fxRows.length} hóa đơn ngoại tệ: cổng thuế đã QUY SẴN ra VND ở cột tiền — engine KHÔNG nhân tỷ giá (đối chiếu ${sampleCount} hóa đơn khớp sổ: ${rawCloserCount} dòng có số GỐC sát sổ, chỉ ${multipliedCloserCount} dòng sát khi ×tỷ giá). Nếu sai, đây là dấu hiệu bản xuất lần này để nguyên tệ — báo lại để chỉnh.`,
    });
  } else {
    warnings.push({
      kind: "Đơn vị tiền tệ ngoại tệ",
      detail: `${fxRows.length} hóa đơn ngoại tệ: engine QUY về VND bằng cách NHÂN tỷ giá (đối chiếu ${sampleCount} hóa đơn khớp sổ: ${multipliedCloserCount} dòng sát sổ khi ×tỷ giá, ${rawCloserCount} dòng sát khi để nguyên). Cột tiền của cổng thuế đang ở nguyên tệ.`,
    });
  }

  // Sheet KHÔNG đối soát với sổ (tập con / bản tự tải) vẫn hiện ở "So hai bản" ⇒ phải
  // cùng đơn vị. Dò theo bản kia (hai bản có thể khác quy ước); không dò được thì theo
  // quy ước vừa chốt bằng sổ — để nguyên ×tỷ giá là lệch oan cả trăm tỉ khi so hai bản.
  const inactiveSheets = allInvoiceSheets.filter((sh) => !activeInvoiceSheets.includes(sh));
  if (inactiveSheets.length) {
    const unresolved = detectConventionFromPeer(allInvoiceSheets, warnings, inactiveSheets);
    if (daVnd) revertToOriginal(unresolved);
  }
}

export function reconcile(sheets: SheetTho[], opt: ReconciliationOptions): ReconciliationResult {
  const result = reconcileOnce(sheets, opt, new Set());
  // Dung sai làm tròn tính theo ĐƠN VỊ của ô. Sheet nào để tiền ngoại tệ ở NGUYÊN TỆ thì
  // chỉ biết SAU khi dò quy ước (cần ghép sổ) ⇒ chạy lại một lần với dung sai theo xu cho
  // các sheet đó. Phần dò quy ước không phụ thuộc dung sai nên lần hai ra y hệt.
  const originalCurrency = new Set(result.invoiceSheets.filter((s) => s.rows.some((d) => d.exchangeRate > 1)).map((s) => s.name));
  return originalCurrency.size ? reconcileOnce(sheets, opt, originalCurrency) : result;
}

function reconcileOnce(sheets: SheetTho[], opt: ReconciliationOptions, foreignCurrencySheets: ReadonlySet<string>): ReconciliationResult {
  const threshold = Math.max(0, opt.threshold ?? 1);
  const edits = opt.edits;
  const suspects: SuspectItem[] = [];
  const mergeMap = new Map<string, MergedSuspect>();
  const warnings: FlowWarning[] = [];
  const editLog: { location: string; previous: string; next: string }[] = [];

  const invoiceSheets: InvoiceSheet[] = [];
  const allLedgerSheets: LedgerSheet[] = [];
  let parseErrorCount = 0;
  let removedOldColumn = false;

  for (const s0 of sheets) {
    if (GENERATED_SHEET_NAMES.has(s0.name)) continue; // sheet tổng hợp của lần xuất trước
    const goi = stripOldReconcileCols(s0.rows); // v3 §1.5 idempotent
    if (goi.removed) removedOldColumn = true;
    const rows = goi.rows;
    const g: SourceCellCoord = { r0: s0.r0 ?? 0, c0: s0.c0 ?? 0, keptColumns: goi.keptColumns };
    const width = goi.removed ? goi.keptColumns.length : (s0.width ?? 0);
    const hPm = ledgerHeaderRow(rows);
    const invoiceHeaderIdx = invoiceHeaderRow(rows);
    const tron = detectMixedLayout(rows, Math.max(hPm, invoiceHeaderIdx));
    if (tron)
      warnings.push({
        kind: "Sheet trộn hai bố cục cột",
        detail: `Sheet "${s0.name}": ${tron.normal} dòng rộng tới cột ${columnLetter(aoaToExcelColumn(g, tron.headerColumn))} (đúng tiêu đề) nhưng ${tron.diff} dòng rộng tới cột ${columnLetter(aoaToExcelColumn(g, tron.diffColumn))} — nhiều khả năng dán hai bản xuất khác nhau (có mã / không mã) vào cùng một sheet. Cột TIỀN vẫn đúng chỗ; trạng thái · đơn vị tiền tệ · tỷ giá của ${tron.diff} dòng đó bị lệch ô nên engine phải dò theo nội dung. CHỮA ĐÚNG: tách thành hai sheet riêng rồi chạy lại.`,
      });
    if (hPm >= 0) allLedgerSheets.push(parseLedgerSheet(s0.name, rows, hPm, edits, suspects, mergeMap, editLog, g, width));
    else if (invoiceHeaderIdx >= 0) {
      const r = parseInvoiceSheet(s0.name, rows, invoiceHeaderIdx, edits, suspects, mergeMap, editLog, g, width, foreignCurrencySheets.has(s0.name));
      invoiceSheets.push(r.sheet);
      parseErrorCount += r.loiParse;
    }
  }

  // --- Gộp sheet HĐĐT trùng lặp (tập con) — v3 §1.4 ---
  for (const a of invoiceSheets) {
    if (a.isSubset || a.rows.length === 0) continue;
    const ka = new Set(a.rows.map((d) => d.key));
    for (const b of invoiceSheets) {
      if (b === a || b.isSubset) continue;
      const kb = new Set(b.rows.map((d) => d.key));
      if (kb.size >= ka.size && [...ka].every((k) => kb.has(k)) && kb.size > ka.size) {
        a.isSubset = true;
        mergeMap.set(`sheetHD-${a.name}`, {
          group: 7,
          name: `Sheet HĐĐT trùng lặp: "${a.name}"`,
          rowCount: a.rows.length,
          totalAmount: a.rows.reduce((s, d) => s + d.totalVnd, 0),
          warning: `"${a.name}" (${ka.size} hóa đơn) là TẬP CON của "${b.name}" (${kb.size}). Chỉ cộng "${b.name}" vào tổng — bỏ "${a.name}" để KHỎI đếm hai lần. Xác nhận bản chốt.`,
          items: [],
        });
        break;
      }
    }
  }
  // --- Có sổ + HAI BẢN HĐĐT (thuế gửi ⇄ tự tải) gối nhau: chỉ đối soát bản THUẾ GỬI ---
  // Không bản nào là tập con của bản kia thì khối trên giữ cả hai ⇒ hóa đơn có ở cả hai
  // bản bị đếm hai lần, "chưa kê" nhân đôi. So hai bản với nhau là việc của `compareTwoInvoiceVersions`.
  const taxSides = resolveTaxSideSheets(invoiceSheets.map((s) => s.name), opt.taxSideSheets).taxSide;
  {
    const taxSheets = invoiceSheets.filter((s) => !s.isSubset && taxSides.has(s.name));
    const selfLoadSheets = invoiceSheets.filter((s) => !s.isSubset && !taxSides.has(s.name));
    const taxKeys = new Set(taxSheets.flatMap((s) => s.rows.map((d) => d.key)));
    const selfLoadedKeys = new Set(selfLoadSheets.flatMap((s) => s.rows.map((d) => d.key)));
    const sharedKeyCount = [...selfLoadedKeys].filter((k) => taxKeys.has(k)).length;
    // Gối ≥ nửa bản nhỏ hơn mới là HAI BẢN của cùng một kỳ — tên có chữ "thuế" mà hóa
    // đơn khác hẳn nhau (VD sheet "THUẾ SUẤT 8%") thì vẫn là các sheet riêng, giữ nguyên.
    if (allLedgerSheets.length && sharedKeyCount > 0 && sharedKeyCount * 2 >= Math.min(taxKeys.size, selfLoadedKeys.size)) {
      const taxSheetNames = taxSheets.map((s) => `"${s.name}"`).join(", ");
      for (const s of selfLoadSheets) {
        s.isSubset = true;
        mergeMap.set(`sheetHD-${s.name}`, {
          group: 7,
          name: `Bản tự tải: "${s.name}"`,
          rowCount: s.rows.length,
          totalAmount: s.rows.reduce((t, d) => t + d.totalVnd, 0),
          warning: `"${s.name}" là bản TỰ TẢI của cùng kỳ với bản thuế gửi (${taxSheetNames}). Chỉ đối soát bản thuế gửi với sổ để KHỎI đếm hai lần; so hai bản xem kiểu "So hai bản".`,
          items: [],
        });
      }
      warnings.push({
        kind: "Hai bản hóa đơn điện tử",
        detail: `File có cả bản thuế gửi (${taxSheetNames}) lẫn bản tự tải (${selfLoadSheets.map((s) => `"${s.name}"`).join(", ")}): ${sharedKeyCount} hóa đơn có ở cả hai bản. Chỉ bản thuế gửi được đối soát với sổ. ${selfLoadedKeys.size - sharedKeyCount} hóa đơn chỉ có ở bản tự tải — KHÔNG được đối soát với sổ; soát chúng ở kiểu "So hai bản".`,
      });
    }
  }
  const activeInvoiceSheets = invoiceSheets.filter((s) => !s.isSubset);

  // --- Chọn sổ CHUẨN khi có nhiều sheet phần mềm — v3 §1.1, §1.4 ---
  let ledgerSheet: LedgerSheet | null = null;
  const extraLedgerSheets: LedgerSheet[] = [];
  let needsLedgerPick = false;
  if (allLedgerSheets.length === 1) ledgerSheet = allLedgerSheets[0];
  else if (allLedgerSheets.length > 1) {
    const theoTen = opt.ledgerSheetName ? allLedgerSheets.find((s) => s.name === opt.ledgerSheetName) : null;
    // "mới": sau khi bỏ dấu, tên chứa "moi" (bắt mới / moi / mơii1)
    const newLedgerSheets = allLedgerSheets.filter((s) => chuan(s.name).includes("moi"));
    let mainSheet = theoTen ?? (newLedgerSheets.length === 1 ? newLedgerSheets[0] : null);
    if (!mainSheet) {
      mainSheet = [...allLedgerSheets].sort((a, b) => b.rows.length - a.rows.length)[0];
      needsLedgerPick = true;
      warnings.push({
        kind: "Chọn sổ chuẩn",
        detail: `Có ${allLedgerSheets.length} sheet sổ (${allLedgerSheets.map((s) => s.name).join(", ")}). Chưa phân biệt được bản chốt — tạm dùng "${mainSheet.name}". Hãy chọn lại nếu sai.`,
      });
    }
    ledgerSheet = mainSheet;
    for (const s of allLedgerSheets)
      if (s !== mainSheet) {
        s.isSubset = true;
        extraLedgerSheets.push(s);
      }
  }

  // Sheet sổ phụ tập con
  if (ledgerSheet) {
    const mainKeys = new Set(ledgerSheet.rows.map((d) => d.key));
    for (const phu of extraLedgerSheets) {
      const secondaryKeys = new Set(phu.rows.map((d) => d.key));
      const laTapCon = [...secondaryKeys].every((k) => mainKeys.has(k));
      const missingKeyCount = [...mainKeys].filter((k) => !secondaryKeys.has(k)).length;
      mergeMap.set(`sheet-${phu.name}`, {
        group: 7,
        name: `Sheet sổ trùng lặp: "${phu.name}"`,
        rowCount: phu.rows.length,
        totalAmount: phu.rows.reduce((s, d) => s + d.total, 0),
        warning: laTapCon
          ? `"${phu.name}" là TẬP CON của "${ledgerSheet.name}" (lệch ${missingKeyCount} hóa đơn). Chỉ cộng "${ledgerSheet.name}" — bỏ sheet này để KHỎI đếm hai lần.`
          : `"${phu.name}" khác "${ledgerSheet.name}" (${missingKeyCount} khóa chỉ có ở bản chuẩn). KHÔNG cộng vào tổng; xác nhận bản chốt.`,
        items: [],
      });
    }
  }

  if (ledgerSheet && !ledgerSheet.hasTaxCodeColumn)
    warnings.push({
      kind: "Sổ không có cột MST",
      detail: `Sheet sổ "${ledgerSheet.name}" không có cột MST người bán (tìm theo tiêu đề MASOTHUE / RMST / MS_THUE / MST / Mã số thuế). Khóa ghép là MST + ký hiệu + số hóa đơn nên gần như mọi hóa đơn sẽ báo chưa có trong sổ. Thêm cột MST người bán vào sổ rồi chạy lại.`,
    });
  const missingExchangeRate = invoiceSheets.flatMap((s) => s.rows.filter((d) => d.missingExchangeRate));
  if (missingExchangeRate.length)
    warnings.push({
      kind: "Ngoại tệ thiếu tỷ giá",
      detail: `${missingExchangeRate.length} hóa đơn ghi tiền tệ khác VND (${uniq(missingExchangeRate.map((d) => d.currency)).join(", ")}) nhưng ô tỷ giá trống/0 — máy KHÔNG quy đổi được, đang để nguyên số trên hóa đơn nên dễ lệch sổ oan. Ở: ${missingExchangeRate.slice(0, 10).map((d) => `${d.sheet} dòng ${d.fileRow}`).join("; ")}${missingExchangeRate.length > 10 ? "; …" : ""}. Điền tỷ giá rồi chạy lại.`,
    });
  if (!activeInvoiceSheets.length)
    warnings.push({ kind: "Thiếu dữ liệu", detail: "Không tìm thấy sheet HÓA ĐƠN ĐIỆN TỬ (cần cột Ký hiệu hóa đơn + Số hóa đơn)." });
  if (!ledgerSheet)
    warnings.push({ kind: "Thiếu dữ liệu", detail: "Không tìm thấy sheet SỔ/PHẦN MỀM (cần cột KHHĐ/KY_HIEU + Số HĐ/SO_HD + Tổng cộng/TONGCONG). Mọi hóa đơn sẽ báo CHƯA CÓ TRONG PMKT." });

  // --- Gom theo khóa ---
  const ledgerByKey = new Map<string, LedgerRow[]>();
  if (ledgerSheet)
    for (const d of ledgerSheet.rows) {
      const arr = ledgerByKey.get(d.key);
      if (arr) arr.push(d); else ledgerByKey.set(d.key, [d]);
    }
  const invoicesByKey = new Map<string, InvoiceRow[]>();
  for (const sh of activeInvoiceSheets)
    for (const d of sh.rows) {
      const arr = invoicesByKey.get(d.key);
      if (arr) arr.push(d); else invoicesByKey.set(d.key, [d]);
    }

  // Tự dò quy ước ngoại tệ TRƯỚC khi ghép: nếu cổng đã quy sẵn VND thì hạ tỷ giá áp
  // dụng về 1 để không đội số (mọi tổng + so khớp bên dưới dùng lại preTaxVnd/totalVnd).
  detectForeignCurrencyMode(activeInvoiceSheets, ledgerByKey, warnings, invoiceSheets);

  let isMatch = 0, mismatch = 0, taxMismatchCount = 0, missingCount = 0, invoiceNo = 0, totalDiff = 0, missingNotRequired = 0;
  // Nhãn gọi thẳng tên sheet sổ (file mẫu kế toán ghi "CHƯA CÓ TRONG PMEM"), để
  // bảng tổng và cột KẾT QUẢ nói cùng một thứ tiếng.
  const missingLabel = `CHƯA CÓ TRONG ${ledgerSheet?.name ?? "PMKT"}`;
  for (const sh of activeInvoiceSheets)
    for (const d of sh.rows) {
      invoiceNo++;
      const pm = ledgerByKey.get(d.key) ?? [];
      if (!pm.length) {
        d.status = "THIEU";
        if (d.notRequiredInLedger) {
          // Không đổi nhóm đếm (giữ nguyên các phép tự kiểm), chỉ tách nhãn ra để
          // kế toán lọc bỏ khỏi danh sách phải đi hạch toán.
          d.conclusion = `${missingLabel} — KHÔNG CẦN VÀO SỔ`;
          d.evidence = `Không có trong sổ, nhưng ĐÚNG: hóa đơn ở trạng thái "${d.invoiceStatus}" — bản này đã bị thay thế/hủy, kế toán hạch toán bản thay thế chứ không hạch toán bản này.`;
          missingNotRequired++;
        } else {
          d.conclusion = missingLabel;
          d.evidence = "Không tìm thấy dòng ghi sổ nào trong phần mềm kế toán có cùng MST người bán + ký hiệu + số hóa đơn.";
        }
        missingCount++;
        continue;
      }
      const ledgerTotal = pm.reduce((s, x) => s + x.total, 0);
      const ledgerPreTax = pm.reduce((s, x) => s + x.preTax, 0);
      const ledgerTaxTotal = pm.reduce((s, x) => s + x.tax, 0);
      const diff = d.totalVnd - ledgerTotal;
      const preTaxDiff = d.preTaxVnd - ledgerPreTax;
      const taxDiff = d.taxVnd - ledgerTaxTotal;
      d.ledgerMatchCount = pm.length;
      d.ledgerTotal = ledgerTotal;
      d.difference = diff;
      d.ledgerVoucher = uniq(pm.map((x) => x.voucher)).join(", ");
      d.ctgs = uniq(pm.map((x) => x.ctgs)).join(", ");
      d.postingDate = uniq(pm.map((x) => x.invoiceDate)).join(", ");
      d.debitCreditAccounts = uniq(pm.map((x) => `${x.debitAccount} / ${x.creditAccount}`)).join("; ");
      d.ledgerDescription = uniq(pm.map((x) => x.description)).join(" | ");
      d.postedAmount = ledgerTotal;
      const voucherLabel = d.ledgerVoucher || "(không số phiếu)";
      // So ĐỦ 3 cột (bổ sung TRƯỚC THUẾ + THUẾ, không chỉ tổng) — ghi tận nơi vào bằng chứng.
      const baCap =
        `HĐ: chưa ${num(d.preTaxVnd)} · thuế ${num(d.taxVnd)} · tổng ${num(d.totalVnd)} | ` +
        `sổ: chưa ${num(ledgerPreTax)} · thuế ${num(ledgerTaxTotal)} · tổng ${num(ledgerTotal)} | ` +
        `chênh: trước thuế ${num(preTaxDiff)} · thuế ${num(taxDiff)} · tổng ${num(diff)}`;
      const leadSentence = `Khớp phiếu ${voucherLabel} ngày ${d.postingDate} (CTGS ${d.ctgs}), TK ${d.debitCreditAccounts}.`;
      if (Math.abs(diff) > threshold) {
        // TỔNG lệch → tiền sai (nhãn cũ, giữ nguyên).
        d.status = "LECH";
        d.conclusion = "LỆCH TIỀN";
        d.evidence = `${leadSentence} LỆCH TIỀN ${num(diff)} đ (HĐĐT − sổ). ${baCap}`;
        mismatch++;
        totalDiff += Math.abs(diff);
      } else if (Math.abs(taxDiff) > threshold) {
        // TỔNG khớp nhưng THUẾ lệch → nghi sai thuế suất / số thuế ghi ở sổ (mất/thừa thuế
        // đầu vào dù tiền thanh toán đúng). status = LECH để vào nhóm L của bảng tổng.
        d.status = "LECH";
        d.conclusion = "LỆCH THUẾ";
        d.evidence = `${leadSentence} Tổng thanh toán KHỚP nhưng THUẾ lệch ${num(taxDiff)} đ (HĐ ${num(d.taxVnd)} / sổ ${num(ledgerTaxTotal)}) — nghi sai thuế suất hoặc số thuế ghi ở sổ. ${baCap}`;
        taxMismatchCount++;
      } else {
        d.status = "KHOP";
        d.conclusion = "KHỚP";
        // Chênh TRƯỚC THUẾ khi tổng + thuế đã khớp gần như luôn do sổ ghi trước thuế đã
        // trừ chiết khấu / cộng phí (net) còn hóa đơn ghi gộp — KHÔNG phải sai.
        const preTaxNote =
          Math.abs(preTaxDiff) > threshold
            ? ` Trước thuế lệch ${num(preTaxDiff)} đ nhưng TỔNG + THUẾ khớp — thường do sổ ghi trước thuế đã trừ chiết khấu / cộng phí, không phải sai.`
            : "";
        d.evidence = `${leadSentence} ${diff === 0 ? "Khớp số tiền." : `Chênh tổng ${num(Math.abs(diff))} đ trong ngưỡng, coi như khớp.`}${preTaxNote} ${baCap}`;
        isMatch++;
      }
    }

  let ledgerMatchedCount = 0, ledgerMissingCount = 0, ledgerRowCount = 0;
  if (ledgerSheet)
    for (const d of ledgerSheet.rows) {
      ledgerRowCount++;
      const invoices = invoicesByKey.get(d.key) ?? [];
      if (!invoices.length) {
        d.status = "THIEU";
        d.conclusion = "CHƯA CÓ HĐĐT";
        d.evidence = "Không tìm thấy hóa đơn điện tử nào có cùng MST người bán + ký hiệu + số hóa đơn.";
        ledgerMissingCount++;
        continue;
      }
      const first = invoices[0];
      const invoiceTotal = invoices.reduce((s, x) => s + x.totalVnd, 0);
      d.status = "CO";
      d.conclusion = "ĐÃ CÓ HĐĐT";
      d.einvoiceMatchCount = invoices.length;
      d.einvoiceSource = first.sheet;
      d.einvoiceRow = first.fileRow;
      d.invoiceIssueDate = first.issueDate;
      d.einvoiceSellerName = first.sellerName;
      d.einvoiceTotal = invoiceTotal;
      d.evidence = `Khớp hóa đơn ${first.series}-${first.normalizedNumber} ngày ${first.issueDate} của ${first.sellerName} (sheet ${first.sheet}, dòng ${first.fileRow}). Hóa đơn ${num(invoiceTotal)} đ.`;
      ledgerMatchedCount++;
    }

  // --- GẦN KHỚP (v3 §5.4): dòng THIẾU hai bên, cùng MST + cùng số tiền ±1đ ---
  const NG_GK = 1;
  const missingLedgerRows = ledgerSheet ? ledgerSheet.rows.filter((d) => d.status === "THIEU") : [];
  const matchedLedgerRows = new Set<LedgerRow>();
  let nearMatchCount = 0;
  for (const sh of activeInvoiceSheets)
    for (const d of sh.rows) {
      if (d.status !== "THIEU") continue;
      const cand = missingLedgerRows.find(
        (p) => !matchedLedgerRows.has(p) && normalizeTaxCode(p.sellerTaxCode) === normalizeTaxCode(d.sellerTaxCode) && Math.abs(p.total - d.totalVnd) <= NG_GK
      );
      if (!cand) continue;
      matchedLedgerRows.add(cand);
      nearMatchCount++;
      const invoiceDescription = `Gần khớp: cùng MST + số tiền ${num(d.totalVnd)} đ với dòng ghi sổ ${cand.voucher || "(?)"} sheet "${cand.sheet}" dòng ${cand.fileRow} (số HĐ sổ ${cand.invoiceNumber} ≠ số HĐ ${d.invoiceNumber}). Kiểm tra xem có phải một.`;
      d.nearMatchNote = invoiceDescription;
      d.evidence += " " + invoiceDescription;
      cand.nearMatchNote = `Gần khớp hóa đơn ${d.series}-${d.invoiceNumber} sheet "${d.sheet}" dòng ${d.fileRow} (cùng MST + số tiền).`;
      cand.evidence += " " + cand.nearMatchNote;
      suspects.push({
        group: 3,
        location: `${d.sheet} · dòng ${d.fileRow} (Số hóa đơn ${d.invoiceNumber})`,
        exportLocation: `${d.sheet} · dòng ${d.fileRow} (Số hóa đơn ${d.invoiceNumber})`,
        currentValue: d.invoiceNumber,
        expectedValue: cand.invoiceNumber,
        expectedSource: `sổ "${cand.sheet}" dòng ${cand.fileRow}, cùng MST ${d.sellerTaxCode} + số tiền ${num(d.totalVnd)} đ`,
        wrongAt: "số hóa đơn hai bên lệch (nghi gõ sai vài chữ số) nhưng MST + tiền trùng khít",
        impact: "nếu đúng là một hóa đơn: chuyển từ CHƯA CÓ sang KHỚP",
      });
    }

  if (ledgerSheet && !ledgerSheet.hasTotalColumn)
    warnings.push({
      kind: "Sổ không có cột tổng cộng",
      detail: `Sheet sổ "${ledgerSheet.name}" là bản xuất CHI TIẾT MẶT HÀNG (không có cột tổng cộng, mỗi mặt hàng một dòng). Máy tự lấy tổng = tiền hàng + tiền thuế, rồi cộng dồn các dòng mặt hàng cùng số hóa đơn trước khi so. Không soi được "cộng có khớp tổng không" vì sổ không có tổng để soi.`,
    });

  if (missingNotRequired)
    warnings.push({
      kind: "Hóa đơn không cần vào sổ",
      detail: `${missingNotRequired} hóa đơn nằm trong nhóm "chưa vào sổ" nhưng ở trạng thái đã bị thay thế/hủy — ĐÚNG là không phải hạch toán. Lọc cột KẾT QUẢ = "${missingLabel} — KHÔNG CẦN VÀO SỔ" để bỏ chúng ra khỏi danh sách phải đi kê.`,
    });

  // Có sổ: khóa lặp nghĩa là cộng hai lần vào đối soát ⇒ luôn báo. Không sổ (so hai bản):
  // mỗi bên một dòng là đương nhiên, chỉ báo khi lặp TRONG cùng một bản.
  for (const [k, arr] of invoicesByKey) {
    const taxSideCount = arr.filter((x) => taxSides.has(x.sheet)).length;
    if (ledgerSheet ? arr.length > 1 : taxSideCount > 1 || arr.length - taxSideCount > 1)
      warnings.push({ kind: "Trùng khóa HĐĐT", detail: `Khóa "${k}" xuất hiện ${arr.length} lần (${arr.map((x) => `${x.sheet}#${x.fileRow}`).join(", ")}).` });
  }

  // --- Cầu nối số liệu (v3 §7) ---
  let fileTotal = 0, fileMatched = 0, fileMismatchCount = 0, matchedLedgerTotal = 0, unmatchedDirect = 0;
  const breakdown: { label: string; amount: number }[] = [];
  for (const sh of activeInvoiceSheets)
    for (const d of sh.rows) {
      fileTotal += d.totalVnd;
      if (d.status === "KHOP") { fileMatched += d.totalVnd; matchedLedgerTotal += d.ledgerTotal; }
      else if (d.status === "LECH") { fileMismatchCount += d.totalVnd; matchedLedgerTotal += d.ledgerTotal; }
      else unmatchedDirect += d.totalVnd;
      if (d.difference != null && Math.abs(d.difference) > 0.005)
        breakdown.push({ label: `${d.series}-${d.normalizedNumber} (${d.sheet})`, amount: d.difference });
    }
  const bridge: ReconciliationBridge = {
    fileTotal, fileMatched, fileMismatched: fileMismatchCount,
    missingInLedger: fileTotal - fileMatched - fileMismatchCount,
    missingInLedgerDirect: unmatchedDirect,
    ledgerMatched: matchedLedgerTotal,
    crossOffset: fileMatched + fileMismatchCount - matchedLedgerTotal,
    breakdown: breakdown.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 100),
  };

  const groupedSuspects = [...mergeMap.values()];
  const suspectCount = suspects.length + groupedSuspects.reduce((s, g) => s + g.rowCount, 0);

  // --- Khối tự kiểm (v3 §8) — 9 phép ---
  const round = (n: number) => Math.round(n * 100) / 100;
  const breakdownDiffSum = breakdown.reduce((s, x) => s + x.amount, 0);
  const conversionMismatchCount = countConversionMismatches(invoiceSheets);
  const trialChecks: TrialCheck[] = [
    { name: "Mỗi hóa đơn đúng 1 nhãn", catches: "một hóa đơn bị đếm 2 nhãn hoặc sót nhãn", expected: String(invoiceNo), actual: String(isMatch + mismatch + missingCount), passed: invoiceNo === isMatch + mismatch + missingCount },
    { name: "Mỗi dòng ghi sổ đúng 1 nhãn", catches: "dòng phần mềm bị sót/đếm trùng nhãn", expected: String(ledgerRowCount), actual: String(ledgerMatchedCount + ledgerMissingCount), passed: ledgerRowCount === ledgerMatchedCount + ledgerMissingCount },
    { name: "Cột quy đổi = gốc × tỷ giá áp dụng", catches: "dòng ngoại tệ thiếu tỷ giá (không quy đổi được), hoặc số VND không khớp số gốc × tỷ giá áp dụng", expected: "0 dòng lệch", actual: `${conversionMismatchCount} dòng lệch`, passed: conversionMismatchCount === 0 },
    { name: "Tổng file − các nhóm = 0", catches: "phân nhóm bỏ sót tiền", expected: "0 đ", actual: `${num(round(fileTotal - fileMatched - fileMismatchCount - unmatchedDirect))} đ`, passed: Math.abs(fileTotal - fileMatched - fileMismatchCount - unmatchedDirect) < 0.5 },
    { name: "Hai cách tính phần chưa kê bằng nhau", catches: "trừ chéo file/sổ khi tính phần còn thiếu", expected: "0 đ chênh", actual: `${num(round(bridge.missingInLedger - bridge.missingInLedgerDirect))} đ`, passed: Math.abs(bridge.missingInLedger - bridge.missingInLedgerDirect) < 0.5 },
    { name: "Phần dư trừ chéo giải thích được", catches: "phần dư không bóc tách về giao dịch", expected: `${num(round(bridge.crossOffset))} đ`, actual: `${num(round(breakdownDiffSum))} đ (bóc tách)`, passed: Math.abs(bridge.crossOffset - breakdownDiffSum) < 0.5 },
    { name: "Tổng cột Chênh lệch = phần dư trừ chéo", catches: "cột chênh lệch của bảng chính lệch phần dư", expected: `${num(round(bridge.crossOffset))} đ`, actual: `${num(round(signedDiffTotal(activeInvoiceSheets)))} đ`, passed: Math.abs(bridge.crossOffset - signedDiffTotal(activeInvoiceSheets)) < 0.5 },
    { name: "Bằng chứng cộng = chỉ tiêu bảng chính", catches: "cột 'Tổng trên sổ' của HĐĐT lệch tổng dòng ghi sổ đã khớp", expected: `${num(round(matchedLedgerTotal))} đ`, actual: `${num(round(ledgerTotalOf(ledgerSheet)))} đ`, passed: Math.abs(matchedLedgerTotal - ledgerTotalOf(ledgerSheet)) < 0.5 },
    { name: "Số nghi vấn = số đã liệt kê (baseline)", catches: "xuất hiện lỗi mới, hoặc người dùng vừa sửa xong 1 lỗi", expected: String(opt.initialSuspectCount ?? suspectCount), actual: String(suspectCount), passed: (opt.initialSuspectCount ?? suspectCount) === suspectCount },
  ];

  return {
    invoiceSheets,
    ledgerSheet,
    extraLedgerSheets,
    totals: { invoiceCount: invoiceNo, matched: isMatch, mismatched: mismatch, taxMismatched: taxMismatchCount, missing: missingCount, missingNotRequired, nearMatched: nearMatchCount, ledgerRowCount, ledgerMatched: ledgerMatchedCount, ledgerMissing: ledgerMissingCount, totalDifference: totalDiff, parseErrorCount },
    suspects,
    mergedSuspects: groupedSuspects,
    bridge,
    trialChecks,
    warnings,
    needsLedgerChoice: needsLedgerPick,
    removedOldColumns: removedOldColumn,
    editLog,
    threshold,
    ...(opt.taxSideSheets ? { taxSideSheets: opt.taxSideSheets } : {}),
  };
}

/**
 * Dòng KHÔNG quy đổi đúng: ngoại tệ thiếu tỷ giá, hoặc một trong ba cột VND khác số gốc ×
 * tỷ giá ÁP DỤNG (bắt lỗi hạ tỷ giá mà quên tính lại cột VND, hay ngược lại).
 */
function countConversionMismatches(sheets: readonly InvoiceSheet[]): number {
  let n = 0;
  for (const sh of sheets)
    for (const d of sh.rows) {
      const mismatch = (original: number, vnd: number) => Math.abs(original * d.exchangeRate - vnd) > 0.01;
      if (d.missingExchangeRate || mismatch(d.preTaxRaw, d.preTaxVnd) || mismatch(d.taxRaw, d.taxVnd) || mismatch(d.totalRaw, d.totalVnd)) n++;
    }
  return n;
}
function signedDiffTotal(sheets: InvoiceSheet[]): number {
  let s = 0;
  for (const sh of sheets) for (const d of sh.rows) if (d.difference != null) s += d.difference;
  return s;
}
function ledgerTotalOf(pm: LedgerSheet | null): number {
  if (!pm) return 0;
  return pm.rows.filter((d) => d.status === "CO").reduce((s, d) => s + d.total, 0);
}

// ---------- Xuất Excel tô màu + chuẩn hóa hiển thị (v3 §9) ----------

export const CHU_THICH =
  'CHÚ THÍCH: dòng ĐỎ = hóa đơn chưa có trong sổ | dòng VÀNG = có nhưng lệch tiền | dòng XANH = khớp. Cột "BẰNG CHỨNG ĐỐI CHIẾU" ở cuối cho biết khớp/gần khớp với phiếu nào.';
export const LEDGER_NOTE =
  'CHÚ THÍCH: dòng XANH = bút toán đã có hóa đơn điện tử | dòng ĐỎ = chưa tìm thấy hóa đơn điện tử.';

/** Nền đặc kiểu xlsx-js-style (RGB không kênh alpha) từ bảng màu chung. */
const xlsxFill = (argb: string) => ({ patternType: "solid", fgColor: { rgb: argb.slice(2) } }) as const;
const FILL = {
  xanh: { fill: xlsxFill(FILL_COLORS.xanh), font: { color: { rgb: "006100" } } },
  vang: { fill: xlsxFill(FILL_COLORS.vang), font: { color: { rgb: "9C6500" } } },
  do: { fill: xlsxFill(FILL_COLORS.do), font: { color: { rgb: "9C0006" } } },
} as const;
const HEADER_STYLE = { font: { bold: true }, fill: xlsxFill(FILL_COLORS.header) } as const;
type Style = { fill?: unknown; font?: unknown } | null;

function toExportCell(v: unknown): unknown {
  if (v instanceof Date) return formatDisplayDate(v);
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
export function buildResultFileName(originalFileName: string, luc: Date = new Date()): string {
  const original = originalFileName
    .replace(/\.xlsx?$/i, "")
    .replace(/ - (đã đối soát|đã dò lệch)( \d{8}-\d{4})?$/i, "");
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const moc = `${luc.getFullYear()}${pad2(luc.getMonth() + 1)}${pad2(luc.getDate())}-${pad2(luc.getHours())}${pad2(luc.getMinutes())}`;
  return `${original} - đã đối soát ${moc}.xlsx`;
}

export function exportReconciliationExcel(result: ReconciliationResult, tenFile = "doi-soat-hddt.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const addSheet = (ws: XLSX.WorkSheet, ten: string) => {
    let t = ten.slice(0, 31);
    let i = 2;
    while (usedNames.has(t)) t = `${ten.slice(0, 28)}~${i++}`;
    usedNames.add(t);
    XLSX.utils.book_append_sheet(wb, ws, t);
  };

  for (const sh of result.invoiceSheets) {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    sh.preRows.forEach((r) => { aoa.push([null, ...r.map(toExportCell)]); fills.push(null); });
    aoa.push([sh.isSubset ? `${CHU_THICH} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...INVOICE_EXTRA_HEADERS]);
    fills.push(null);
    for (const d of sh.rows) {
      aoa.push([
        d.conclusion, ...d.cells.map(toExportCell), d.exchangeRate, d.normalizedNumber, d.key, d.preTaxVnd, d.taxVnd,
        d.totalVnd, d.ledgerMatchCount, d.ledgerTotal, d.difference, d.conclusion, d.ledgerVoucher, d.ctgs, d.postingDate,
        d.debitCreditAccounts, d.ledgerDescription, d.postedAmount, d.evidence,
      ]);
      fills.push(d.status === "KHOP" ? FILL.xanh : d.status === "LECH" ? FILL.vang : FILL.do);
    }
    addSheet(buildSheet(aoa, fills, hIdx), sh.isSubset ? `PHỤ ${sh.name}` : sh.name);
  }

  const buildLedgerSheet = (sh: LedgerSheet) => {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    aoa.push([sh.isSubset ? `${LEDGER_NOTE} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : LEDGER_NOTE]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...LEDGER_EXTRA_HEADERS]);
    fills.push(null);
    for (const d of sh.rows) {
      aoa.push([
        d.conclusion, ...d.cells.map(toExportCell), d.normalizedNumber, d.key, d.einvoiceMatchCount, d.conclusion, d.einvoiceSource,
        d.einvoiceRow, d.invoiceIssueDate, d.einvoiceSellerName, d.einvoiceTotal, d.evidence,
      ]);
      fills.push(d.status === "CO" ? FILL.xanh : FILL.do);
    }
    addSheet(buildSheet(aoa, fills, hIdx), sh.isSubset ? `PHỤ ${sh.name}` : sh.name);
  };
  if (result.ledgerSheet) buildLedgerSheet(result.ledgerSheet);
  for (const p of result.extraLedgerSheets) buildLedgerSheet(p);

  if (result.editLog.length) {
    const aoa: unknown[][] = [
      ["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"],
      ["Vị trí", "Giá trị cũ", "Giá trị mới"],
      ...result.editLog.map((n) => [n.location, n.previous, n.next]),
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
export function exportReconciliationTemplate(tenFile = "mau-doi-soat-hoa-don.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const INVOICE_HEADER = [
    "STT", "Ký hiệu mẫu số", "Ký hiệu hóa đơn", "Số hóa đơn", "Ngày lập",
    "MST người bán/MST người xuất hàng", "Tên người bán/Tên người xuất hàng",
    "MST người mua/MST người nhận hàng", "Tên người mua/Tên người nhận hàng", "Địa chỉ người mua",
    "Tổng tiền chưa thuế", "Tổng tiền thuế", "Tổng tiền chiết khấu thương mại", "Tổng tiền phí",
    "Tổng tiền thanh toán", "Đơn vị tiền tệ", "Tỷ giá", "Trạng thái hóa đơn", "Kết quả kiểm tra hóa đơn",
  ];
  const sampleInvoiceRow = (stt: number, kh: string, so: string, preTax: number, tax: number, dvt = "VND", exchangeRate = "1.0"): unknown[] => [
    stt, "1", kh, so, "05/02/2026", "0300514849", "CÔNG TY MẪU ABC", "3502297423", "CÔNG TY TNHH BASEAFOOD 1",
    "Số 321 Trần Xuân Độ, Bà Rịa", preTax, tax, 0, null, preTax + tax, dvt, exchangeRate, "Hóa đơn mới", "Đã cấp mã",
  ];
  const invoiceSheet = (note: string, rows: unknown[][]) => {
    const aoa: unknown[][] = [
      [note], ["DANH SÁCH HÓA ĐƠN"], ["Từ ngày 01/02/2026 đến ngày 28/02/2026"], [], [], INVOICE_HEADER, ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = INVOICE_HEADER.map((h) => ({ wch: Math.min(Math.max(h.length + 1, 12), 40) }));
    (ws[XLSX.utils.encode_cell({ r: 5, c: 0 })] as { s?: unknown }).s = HEADER_STYLE;
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, invoiceSheet("Hóa đơn CÓ MÃ cơ quan thuế — mẫu; giữ tiêu đề ở hàng 6",
    [sampleInvoiceRow(1, "C26TCT", "1812", 4800000, 384000), sampleInvoiceRow(2, "C26TSD", "10183", 2830000, 226400)]), "CÓ MÃ");
  XLSX.utils.book_append_sheet(wb, invoiceSheet("Hóa đơn MÁY TÍNH TIỀN — mẫu",
    [sampleInvoiceRow(1, "C26MCM", "36582", 297407, 23793)]), "MÁY TÍNH TIỀN");
  XLSX.utils.book_append_sheet(wb, invoiceSheet("Hóa đơn KHÔNG MÃ (gồm ngoại tệ USD) — mẫu",
    [sampleInvoiceRow(1, "K26TVT", "1392", 5300600, 530060), sampleInvoiceRow(2, "K26TAB", "10161", 217.2, 21.72, "USD", "25795.0")]), "KHÔNG MÃ");

  // Sheet sổ (PMEM) — tiêu đề ở hàng 1, hỗ trợ mã máy
  const HDR_PM = ["SCT_GHISO", "NGAY_GS", "SO_PHIEU", "KY_HIEU", "NGAY_HD", "SO_HD", "NGUOI_BAN", "RMST", "MAT_HANG", "TIENHANG", "TIENTHUE", "TONGCONG", "TS%", "GHICHU", "LOAI"];
  const sampleLedgerRow = (salesInvoice: string, kh: string, so: string, hang: number, tax: number): unknown[] =>
    ["NHI", "01/02/2026", salesInvoice, kh, "05/02/2026", so, "CÔNG TY MẪU ABC", "0300514849", "Mua hàng - HĐ " + so, hang, tax, hang + tax, "10%", null, "1A"];
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
  const guideSheet = XLSX.utils.aoa_to_sheet(instructions);
  guideSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, guideSheet, "HƯỚNG DẪN");

  XLSX.writeFile(wb, tenFile, { bookType: "xlsx" });
}
