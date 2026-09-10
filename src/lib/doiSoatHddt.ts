// ============================================================
// Tên file: src/lib/doiSoatHddt.ts
// Tên tiếng Việt: Đối soát Hóa đơn điện tử (cổng thuế) ⇄ Phần mềm kế toán
// Description: Parse an invoice workbook (3 e-invoice sheets + 1 accounting-
//   software sheet) and reconcile them by (MST bán | ký hiệu | số HĐ chuẩn),
//   then optionally export a color-annotated .xlsx (giống file "đã lọc").
// ============================================================
//
// BỐI CẢNH: kế toán tải 1 file Excel gồm 4 sheet:
//   - 3 sheet HÓA ĐƠN ĐIỆN TỬ tải từ cổng thuế: "CÓ MÃ HDDT",
//     "MÁY TÍNH TIỀN HDDT", "KHÔNG MÃ HDDT" (đều là hóa đơn MUA VÀO — BSF1 là
//     người mua). Vị trí cột KHÁC nhau giữa 3 sheet ⇒ dò cột THEO TÊN, không
//     hardcode chỉ số cột.
//   - 1 sheet "PHẦN MỀM": bút toán tương ứng trên phần mềm kế toán. Một hóa đơn
//     có thể bị tách nhiều dòng theo thuế suất ⇒ khi đối soát phải CỘNG DỒN
//     theo khóa rồi so tổng.
//
// KHÓA ĐỐI CHIẾU = `MST người bán | Ký hiệu hóa đơn | Số HĐ chuẩn`.
//   "Số HĐ chuẩn" = bỏ số 0 ở đầu ("00060568" → "60568") vì phần mềm pad 0 còn
//   cổng thuế thì không.
//
// SO TIỀN: quy hết về VND (hóa đơn USD nhân Tỷ giá). Chênh trong NGƯỠNG (mặc
//   định 1.000đ, người dùng chỉnh được) coi như KHỚP — để nuốt sai số làm tròn.
//
// Đây là hàm THUẦN + tiện ích xuất file. KHÔNG đụng DB / repo / localStorage.

import * as XLSX from "xlsx-js-style";
import { boDau } from "@/lib/username";
import { num } from "@/lib/format";

// ---------- Kiểu dữ liệu ----------

export type TrangThaiHoaDon = "KHOP" | "LECH" | "THIEU";
export type TrangThaiPhanMem = "CO" | "THIEU";

export interface DongHoaDon {
  sheet: string;
  soDong: number; // số dòng 1-based trong sheet (như số dòng Excel người dùng thấy)
  cells: unknown[]; // dòng gốc — giữ nguyên để xuất lại đầy đủ cột
  kyHieu: string;
  soHoaDon: string;
  soChuan: string;
  ngayLap: string; // hiển thị dd/mm/yyyy (hoặc chuỗi gốc)
  mstBan: string;
  tenBan: string;
  dvt: string;
  tyGia: number;
  chuaThueVnd: number;
  thueVnd: number;
  tongTtVnd: number;
  khoa: string;
  // Kết quả đối soát
  soDongKhopPm: number;
  tongTtPm: number;
  chenh: number | null; // tongTtVnd - tongTtPm (chiều HĐĐT − Phần mềm)
  trangThai: TrangThaiHoaDon;
  ketLuan: string;
  bangChung: string;
  // Thông tin bút toán khớp (gộp)
  phieuKe: string;
  ctgs: string;
  ngayGhiSo: string;
  tkNoCo: string;
  dienGiaiPm: string;
  soTienHachToan: number | null;
}

export interface SheetHoaDon {
  ten: string;
  header: string[]; // hàng tiêu đề gốc (chuỗi)
  preRows: unknown[][]; // các hàng trên tiêu đề (tên bảng, khoảng ngày) — để xuất lại
  dong: DongHoaDon[];
}

export interface DongPhanMem {
  soDong: number;
  cells: unknown[];
  ctgs: string;
  phieu: string;
  kyHieu: string;
  soHoaDon: string;
  soChuan: string;
  mstBan: string;
  tenBan: string;
  tongCong: number;
  ngayHd: string;
  tkNo: string;
  tkCo: string;
  dienGiai: string;
  khoa: string;
  // Kết quả đối soát
  soHddtKhop: number;
  trangThai: TrangThaiPhanMem;
  ketLuan: string;
  bangChung: string;
  nguonHddt: string; // tên sheet HĐĐT khớp
  dongHddt: number | null;
  ngayLapHd: string;
  tenBanHddt: string;
  tongTtHddt: number | null;
}

export interface SheetPhanMem {
  ten: string;
  header: string[];
  dong: DongPhanMem[];
}

export interface CanhBao {
  loai: string;
  chiTiet: string;
}

export interface KetQuaDoiSoat {
  sheetsHoaDon: SheetHoaDon[];
  sheetPhanMem: SheetPhanMem | null;
  tong: {
    soHoaDon: number;
    khop: number;
    lech: number;
    thieu: number;
    soDongPm: number;
    pmCo: number;
    pmThieu: number;
    tongChenh: number; // tổng |chênh| của các dòng LỆCH
    soLoi: number; // số dòng thiếu khóa / lỗi parse
  };
  canhBao: CanhBao[];
  nguong: number;
}

export interface TuyChonDoiSoat {
  /** Chênh tiền tuyệt đối ≤ ngưỡng thì vẫn coi KHỚP (đơn vị VND). */
  nguong: number;
}

// ---------- Tiện ích parse ----------

/** Chuẩn hóa tên/tiêu đề để so khớp: bỏ dấu, thường, gộp khoảng trắng. */
function chuan(s: unknown): string {
  return boDau(String(s ?? ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Parse số kiểu Việt/US, KHÔNG phụ thuộc locale trình duyệt.
 * - number → giữ nguyên.
 * - "1.234,5" (VN) / "1,234.5" (US) → tách dấu thập phân theo dấu ở vị trí cuối.
 * - Nhiều "." mà không có "," → dấu chấm là ngăn nghìn (bỏ hết).
 * Không parse được → null (KHÔNG mặc định 0).
 */
export function soVN(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, ""); // bỏ ký tự lạ (đơn vị, khoảng trắng)
  if (!s || s === "-" || s === "." || s === ",") return null;
  const coCham = s.includes(".");
  const coPhay = s.includes(",");
  if (coCham && coPhay) {
    // Dấu ở VỊ TRÍ CUỐI là dấu thập phân; dấu kia là ngăn nghìn.
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousand = decimal === "." ? "," : ".";
    s = s.split(thousand).join("").replace(decimal, ".");
  } else if (coPhay) {
    s = s.replace(",", "."); // chỉ có "," → dấu thập phân
  } else if (coCham) {
    // Chỉ có ".": nhiều dấu chấm → ngăn nghìn; một dấu chấm → thập phân.
    if ((s.match(/\./g) ?? []).length > 1) s = s.split(".").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Ô ngày → dd/mm/yyyy. Nhận Date (cellDates), serial Excel, chuỗi dd/mm/yyyy hoặc yyyy-mm-dd. */
export function ngayHienThi(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${pad2(v.getDate())}/${pad2(v.getMonth() + 1)}/${v.getFullYear()}`;
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

/** Số HĐ chuẩn: về chuỗi, bỏ khoảng trắng và số 0 ở đầu ("00060568" → "60568"). */
export function soHoaDonChuan(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\s+/g, "");
  const bo0 = s.replace(/^0+/, "");
  return bo0 || (s ? "0" : "");
}

/** Khóa đối chiếu chuẩn hóa. */
function taoKhoa(mstBan: string, kyHieu: string, soChuan: string): string {
  return `${chuan(mstBan)}|${chuan(kyHieu)}|${soChuan.toLowerCase()}`;
}

// ---------- Dò cột theo tên ----------

/** Map tên-tiêu-đề-đã-chuẩn-hóa → chỉ số cột. Trùng tên → lấy lần XUẤT HIỆN CUỐI. */
function bandoCot(header: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  header.forEach((h, i) => {
    const k = chuan(h);
    if (k) m.set(k, i);
  });
  return m;
}

/** Tìm cột theo danh sách tên (khớp đúng trước, rồi khớp tiền tố). -1 nếu không thấy. */
function timCot(map: Map<string, number>, ...tens: string[]): number {
  for (const t of tens) {
    const k = chuan(t);
    const c = map.get(k);
    if (c != null) return c;
  }
  // khớp tiền tố (VD "mst nguoi ban/mst nguoi xuat hang" bắt đầu bằng "mst nguoi ban")
  for (const t of tens) {
    const k = chuan(t);
    for (const [key, idx] of map) if (key.startsWith(k)) return idx;
  }
  return -1;
}

/** Tìm hàng tiêu đề trong ~15 hàng đầu: hàng chứa nhiều nhất từ khóa mong đợi. */
function timHangTieuDe(rows: unknown[][], tuKhoa: string[]): number {
  let best = -1;
  let bestScore = 0;
  const gioiHan = Math.min(rows.length, 15);
  for (let i = 0; i < gioiHan; i++) {
    const row = rows[i] ?? [];
    const cells = row.map((c) => chuan(c));
    let score = 0;
    for (const k of tuKhoa) if (cells.some((c) => c.includes(k))) score++;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // cần ít nhất 2 từ khóa để chắc là hàng tiêu đề (tránh bắt nhầm dòng tên bảng)
  return bestScore >= 2 ? best : -1;
}

const cellStr = (row: unknown[], i: number): string =>
  i < 0 ? "" : String(row[i] ?? "").trim();

// ---------- Đọc workbook thô ----------

interface SheetTho {
  ten: string;
  rows: unknown[][];
}

export async function docWorkbook(file: File): Promise<SheetTho[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out: SheetTho[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      blankrows: true,
      defval: null,
    });
    out.push({ ten: name, rows });
  }
  return out;
}

// ---------- Nhận diện & parse từng sheet ----------

function laSheetHoaDon(rows: unknown[][]): number {
  return timHangTieuDe(rows, ["so hoa don", "ky hieu hoa don"]);
}
function laSheetPhanMem(rows: unknown[][]): number {
  return timHangTieuDe(rows, ["khhd", "so hd", "tong cong"]);
}

function parseSheetHoaDon(ten: string, rows: unknown[][], hIdx: number): SheetHoaDon {
  const header = (rows[hIdx] ?? []).map((c) => String(c ?? ""));
  const preRows = rows.slice(0, hIdx);
  const map = bandoCot(rows[hIdx] ?? []);
  const cKyHieu = timCot(map, "Ký hiệu hóa đơn");
  const cSo = timCot(map, "Số hóa đơn");
  const cNgay = timCot(map, "Ngày lập");
  const cMstBan = timCot(map, "MST người bán/MST người xuất hàng", "MST người bán");
  const cTenBan = timCot(map, "Tên người bán/Tên người xuất hàng", "Tên người bán");
  const cChuaThue = timCot(map, "Tổng tiền chưa thuế");
  const cThue = timCot(map, "Tổng tiền thuế");
  const cTongTt = timCot(map, "Tổng tiền thanh toán");
  const cDvt = timCot(map, "Đơn vị tiền tệ");
  const cTyGia = timCot(map, "Tỷ giá");

  const dong: DongHoaDon[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const soHoaDon = cellStr(row, cSo);
    const kyHieu = cellStr(row, cKyHieu);
    // Dòng dữ liệu = có số hóa đơn HOẶC ký hiệu. Bỏ dòng trống / dòng tổng.
    if (!soHoaDon && !kyHieu) continue;

    const dvt = cellStr(row, cDvt) || "VND";
    const tyGiaRaw = soVN(cDvt >= 0 ? row[cTyGia] : null);
    const laVnd = chuan(dvt) === "vnd" || chuan(dvt) === "";
    const tyGia = laVnd ? 1 : tyGiaRaw && tyGiaRaw > 0 ? tyGiaRaw : 1;

    const chuaThue = soVN(row[cChuaThue]) ?? 0;
    const thue = soVN(row[cThue]) ?? 0;
    const tongTt = soVN(row[cTongTt]) ?? 0;
    const soChuan = soHoaDonChuan(soHoaDon);
    const mstBan = cellStr(row, cMstBan);

    dong.push({
      sheet: ten,
      soDong: i + 1,
      cells: row,
      kyHieu,
      soHoaDon,
      soChuan,
      ngayLap: ngayHienThi(row[cNgay]),
      mstBan,
      tenBan: cellStr(row, cTenBan),
      dvt,
      tyGia,
      chuaThueVnd: chuaThue * tyGia,
      thueVnd: thue * tyGia,
      tongTtVnd: tongTt * tyGia,
      khoa: taoKhoa(mstBan, kyHieu, soChuan),
      soDongKhopPm: 0,
      tongTtPm: 0,
      chenh: null,
      trangThai: "THIEU",
      ketLuan: "",
      bangChung: "",
      phieuKe: "",
      ctgs: "",
      ngayGhiSo: "",
      tkNoCo: "",
      dienGiaiPm: "",
      soTienHachToan: null,
    });
  }
  return { ten, header, preRows, dong };
}

function parseSheetPhanMem(ten: string, rows: unknown[][], hIdx: number): SheetPhanMem {
  const header = (rows[hIdx] ?? []).map((c) => String(c ?? ""));
  const map = bandoCot(rows[hIdx] ?? []);
  const cCtgs = timCot(map, "CTGS");
  const cPhieu = timCot(map, "Phiếu");
  const cKyHieu = timCot(map, "KHHĐ");
  const cSo = timCot(map, "Số HĐ");
  const cMst = timCot(map, "MASOTHUE");
  const cTong = timCot(map, "Tổng cộng");
  const cNgayHd = timCot(map, "Ngày HĐ");
  const cTkNo = timCot(map, "TK Nợ");
  const cTkCo = timCot(map, "TK Có");
  const cDienGiai = timCot(map, "Tên mặt hàng");
  const cTenBan = timCot(map, "Tên người bán");

  const dong: DongPhanMem[] = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const soHoaDon = cellStr(row, cSo);
    const kyHieu = cellStr(row, cKyHieu);
    if (!soHoaDon && !kyHieu) continue;

    const soChuan = soHoaDonChuan(soHoaDon);
    const mstBan = cellStr(row, cMst);
    dong.push({
      soDong: i + 1,
      cells: row,
      ctgs: cellStr(row, cCtgs),
      phieu: cellStr(row, cPhieu),
      kyHieu,
      soHoaDon,
      soChuan,
      mstBan,
      tenBan: cellStr(row, cTenBan),
      tongCong: soVN(row[cTong]) ?? 0,
      ngayHd: ngayHienThi(row[cNgayHd]),
      tkNo: cellStr(row, cTkNo),
      tkCo: cellStr(row, cTkCo),
      dienGiai: cellStr(row, cDienGiai),
      khoa: taoKhoa(mstBan, kyHieu, soChuan),
      soHddtKhop: 0,
      trangThai: "THIEU",
      ketLuan: "",
      bangChung: "",
      nguonHddt: "",
      dongHddt: null,
      ngayLapHd: "",
      tenBanHddt: "",
      tongTtHddt: null,
    });
  }
  return { ten, header, dong };
}

// ---------- Đối soát ----------

const uniq = (arr: string[]): string[] => [...new Set(arr.filter(Boolean))];

export function doiSoat(sheets: SheetTho[], opt: TuyChonDoiSoat): KetQuaDoiSoat {
  const nguong = Math.max(0, opt.nguong || 0);
  const sheetsHoaDon: SheetHoaDon[] = [];
  let sheetPhanMem: SheetPhanMem | null = null;
  const canhBao: CanhBao[] = [];

  for (const s of sheets) {
    const hHd = laSheetHoaDon(s.rows);
    const hPm = laSheetPhanMem(s.rows);
    // Ưu tiên phần mềm nếu có KHHĐ/Số HĐ (đặc trưng hơn), else hóa đơn.
    if (hPm >= 0 && !sheetPhanMem) sheetPhanMem = parseSheetPhanMem(s.ten, s.rows, hPm);
    else if (hHd >= 0) sheetsHoaDon.push(parseSheetHoaDon(s.ten, s.rows, hHd));
    // sheet không nhận diện được → bỏ qua yên lặng (thường là sheet phụ)
  }

  if (!sheetsHoaDon.length)
    canhBao.push({
      loai: "Thiếu dữ liệu",
      chiTiet: "Không tìm thấy sheet HÓA ĐƠN ĐIỆN TỬ nào (cần cột Ký hiệu hóa đơn + Số hóa đơn).",
    });
  if (!sheetPhanMem)
    canhBao.push({
      loai: "Thiếu dữ liệu",
      chiTiet: "Không tìm thấy sheet PHẦN MỀM (cần cột KHHĐ + Số HĐ). Mọi hóa đơn sẽ báo CHƯA CÓ TRONG PMKT.",
    });

  // Gom theo khóa
  const pmTheoKhoa = new Map<string, DongPhanMem[]>();
  if (sheetPhanMem)
    for (const d of sheetPhanMem.dong) {
      const arr = pmTheoKhoa.get(d.khoa);
      if (arr) arr.push(d);
      else pmTheoKhoa.set(d.khoa, [d]);
    }
  const hdTheoKhoa = new Map<string, DongHoaDon[]>();
  for (const sh of sheetsHoaDon)
    for (const d of sh.dong) {
      const arr = hdTheoKhoa.get(d.khoa);
      if (arr) arr.push(d);
      else hdTheoKhoa.set(d.khoa, [d]);
    }

  let khop = 0,
    lech = 0,
    thieu = 0,
    soHoaDon = 0,
    tongChenh = 0,
    soLoi = 0;

  // Chiều HĐĐT → phần mềm
  for (const sh of sheetsHoaDon) {
    for (const d of sh.dong) {
      soHoaDon++;
      if (!d.mstBan || !d.soChuan) {
        soLoi++;
        canhBao.push({
          loai: "Thiếu khóa",
          chiTiet: `${sh.ten} dòng ${d.soDong}: thiếu MST người bán hoặc số hóa đơn → không đối soát được.`,
        });
      }
      const pm = pmTheoKhoa.get(d.khoa) ?? [];
      if (!pm.length) {
        d.trangThai = "THIEU";
        d.ketLuan = "CHƯA CÓ TRONG PMKT";
        d.bangChung =
          "Không tìm thấy bút toán nào trong phần mềm kế toán có cùng MST người bán + ký hiệu + số hóa đơn.";
        thieu++;
        continue;
      }
      const tongPm = pm.reduce((s, x) => s + x.tongCong, 0);
      const chenh = d.tongTtVnd - tongPm;
      d.soDongKhopPm = pm.length;
      d.tongTtPm = tongPm;
      d.chenh = chenh;
      d.phieuKe = uniq(pm.map((x) => x.phieu)).join(", ");
      d.ctgs = uniq(pm.map((x) => x.ctgs)).join(", ");
      d.ngayGhiSo = uniq(pm.map((x) => x.ngayHd)).join(", ");
      d.tkNoCo = uniq(pm.map((x) => `${x.tkNo} / ${x.tkCo}`)).join("; ");
      d.dienGiaiPm = uniq(pm.map((x) => x.dienGiai)).join(" | ");
      d.soTienHachToan = tongPm;
      const phieuMoTa = d.phieuKe || "(không số phiếu)";
      if (Math.abs(chenh) <= nguong) {
        d.trangThai = "KHOP";
        d.ketLuan = "KHỚP";
        d.bangChung =
          `Khớp phiếu ${phieuMoTa} ngày ${d.ngayGhiSo} (CTGS ${d.ctgs}), TK ${d.tkNoCo}. ` +
          `Hóa đơn ${num(d.tongTtVnd)} đ / sổ ${num(tongPm)} đ - ` +
          (chenh === 0
            ? "khớp số tiền."
            : `chênh ${num(Math.abs(chenh))} đ trong ngưỡng, coi như khớp.`);
        khop++;
      } else {
        d.trangThai = "LECH";
        d.ketLuan = "LỆCH TIỀN";
        d.bangChung =
          `Khớp phiếu ${phieuMoTa} ngày ${d.ngayGhiSo} (CTGS ${d.ctgs}), TK ${d.tkNoCo}. ` +
          `Hóa đơn ${num(d.tongTtVnd)} đ / sổ ${num(tongPm)} đ - LỆCH ${num(chenh)} đ (HĐĐT − phần mềm).`;
        lech++;
        tongChenh += Math.abs(chenh);
      }
    }
  }

  // Chiều phần mềm → HĐĐT
  let pmCo = 0,
    pmThieu = 0,
    soDongPm = 0;
  if (sheetPhanMem) {
    for (const d of sheetPhanMem.dong) {
      soDongPm++;
      const hd = hdTheoKhoa.get(d.khoa) ?? [];
      if (!hd.length) {
        d.trangThai = "THIEU";
        d.ketLuan = "CHƯA CÓ HĐĐT";
        d.bangChung =
          "Không tìm thấy hóa đơn điện tử nào có cùng MST người bán + ký hiệu + số hóa đơn.";
        pmThieu++;
        continue;
      }
      const first = hd[0];
      const tongHd = hd.reduce((s, x) => s + x.tongTtVnd, 0);
      d.trangThai = "CO";
      d.ketLuan = "ĐÃ CÓ HĐĐT";
      d.soHddtKhop = hd.length;
      d.nguonHddt = first.sheet;
      d.dongHddt = first.soDong;
      d.ngayLapHd = first.ngayLap;
      d.tenBanHddt = first.tenBan;
      d.tongTtHddt = tongHd;
      d.bangChung =
        `Khớp hóa đơn ${first.kyHieu}-${first.soChuan} ngày ${first.ngayLap} của ${first.tenBan} ` +
        `(sheet ${first.sheet}, dòng ${first.soDong}). Hóa đơn ${num(tongHd)} đ.`;
      pmCo++;
    }
  }

  // Cảnh báo: khóa trùng trong HĐĐT (nghi dán trùng / cùng số 2 loại HĐ)
  for (const [k, arr] of hdTheoKhoa)
    if (arr.length > 1)
      canhBao.push({
        loai: "Trùng khóa HĐĐT",
        chiTiet: `Khóa "${k}" xuất hiện ${arr.length} lần ở HĐĐT (${arr
          .map((x) => `${x.sheet}#${x.soDong}`)
          .join(", ")}).`,
      });

  return {
    sheetsHoaDon,
    sheetPhanMem,
    tong: { soHoaDon, khop, lech, thieu, soDongPm, pmCo, pmThieu, tongChenh, soLoi },
    canhBao,
    nguong,
  };
}

/** Đọc file + đối soát trong một bước. */
export async function docVaDoiSoat(file: File, opt: TuyChonDoiSoat): Promise<KetQuaDoiSoat> {
  const sheets = await docWorkbook(file);
  return doiSoat(sheets, opt);
}

// ---------- Xuất Excel tô màu (giống file "đã lọc") ----------

const CHU_THICH =
  'CHÚ THÍCH: dòng ĐỎ = hóa đơn chưa có trong phần mềm kế toán | dòng VÀNG = có nhưng lệch tiền | dòng XANH = khớp. Cột "BẰNG CHỨNG ĐỐI CHIẾU" ở cuối bảng cho biết khớp với phiếu nào.';

const CHU_THICH_PM =
  'CHÚ THÍCH: dòng XANH = bút toán đã có hóa đơn điện tử tương ứng | dòng ĐỎ = chưa tìm thấy hóa đơn điện tử.';

// Tô nền nhạt + chữ đậm màu (mã màu Excel chuẩn, độc lập token app).
const FILL = {
  xanh: { fill: { patternType: "solid", fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" } } },
  vang: { fill: { patternType: "solid", fgColor: { rgb: "FFEB9C" } }, font: { color: { rgb: "9C6500" } } },
  do: { fill: { patternType: "solid", fgColor: { rgb: "FFC7CE" } }, font: { color: { rgb: "9C0006" } } },
} as const;

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "D9E1F2" } },
} as const;

type Style = { fill?: unknown; font?: unknown } | null;

const HEADER_HD_THEM = [
  "Tỷ giá áp dụng",
  "Số HĐ chuẩn",
  "KHÓA ĐỐI CHIẾU",
  "Chưa thuế (VND)",
  "Thuế (VND)",
  "Tổng thanh toán (VND)",
  "Số dòng khớp PMKT",
  "Tổng TT bên PMKT",
  "Chênh lệch",
  "KẾT LUẬN",
  "Số phiếu kế toán",
  "Chứng từ ghi sổ",
  "Ngày ghi sổ",
  "TK Nợ / TK Có",
  "Diễn giải trên phần mềm",
  "Số tiền đã hạch toán",
  "BẰNG CHỨNG ĐỐI CHIẾU",
];

const HEADER_PM_THEM = [
  "Số HĐ chuẩn",
  "KHÓA ĐỐI CHIẾU",
  "Số HĐĐT khớp",
  "KẾT LUẬN",
  "Nguồn hóa đơn điện tử",
  "Dòng trên sheet HĐĐT",
  "Ngày lập HĐ",
  "Tên người bán trên HĐĐT",
  "Tổng TT trên HĐĐT (VND)",
  "BẰNG CHỨNG ĐỐI CHIẾU",
];

/** Đổi ô Date → chuỗi dd/mm/yyyy để xuất không bị hiện số serial. */
function oXuat(v: unknown): unknown {
  if (v instanceof Date) return ngayHienThi(v);
  return v ?? null;
}

/** Dựng 1 worksheet từ mảng-hàng + màu nền theo dòng. */
function dungSheet(aoa: unknown[][], fillTheoHang: Style[], hangTieuDe: number): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const fill = fillTheoHang[r];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as { v?: unknown; t?: string; z?: string; s?: unknown } | undefined;
      if (!cell) continue;
      if (r === hangTieuDe) {
        cell.s = HEADER_STYLE;
        continue;
      }
      if (fill) cell.s = fill;
      if (typeof cell.v === "number" && Math.abs(cell.v) >= 1000)
        cell.z = Number.isInteger(cell.v) ? "#,##0" : "#,##0.00";
    }
  }
  return ws;
}

export function xuatExcelDoiSoat(kq: KetQuaDoiSoat, tenFile = "doi-soat-hddt.xlsx"): void {
  const wb = XLSX.utils.book_new();

  for (const sh of kq.sheetsHoaDon) {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    sh.preRows.forEach((r) => {
      aoa.push([null, ...r.map(oXuat)]); // chừa cột KẾT QUẢ ở đầu
      fills.push(null);
    });
    aoa.push([CHU_THICH]);
    fills.push(null);
    const hangTieuDe = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_HD_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan,
        ...d.cells.map(oXuat),
        d.tyGia,
        d.soChuan,
        d.khoa,
        d.chuaThueVnd,
        d.thueVnd,
        d.tongTtVnd,
        d.soDongKhopPm,
        d.tongTtPm,
        d.chenh,
        d.ketLuan,
        d.phieuKe,
        d.ctgs,
        d.ngayGhiSo,
        d.tkNoCo,
        d.dienGiaiPm,
        d.soTienHachToan,
        d.bangChung,
      ]);
      fills.push(d.trangThai === "KHOP" ? FILL.xanh : d.trangThai === "LECH" ? FILL.vang : FILL.do);
    }
    const ws = dungSheet(aoa, fills, hangTieuDe);
    XLSX.utils.book_append_sheet(wb, ws, sh.ten.slice(0, 31));
  }

  if (kq.sheetPhanMem) {
    const sh = kq.sheetPhanMem;
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    aoa.push([CHU_THICH_PM]);
    fills.push(null);
    const hangTieuDe = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_PM_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan,
        ...d.cells.map(oXuat),
        d.soChuan,
        d.khoa,
        d.soHddtKhop,
        d.ketLuan,
        d.nguonHddt,
        d.dongHddt,
        d.ngayLapHd,
        d.tenBanHddt,
        d.tongTtHddt,
        d.bangChung,
      ]);
      fills.push(d.trangThai === "CO" ? FILL.xanh : FILL.do);
    }
    const ws = dungSheet(aoa, fills, hangTieuDe);
    XLSX.utils.book_append_sheet(wb, ws, sh.ten.slice(0, 31));
  }

  XLSX.writeFile(wb, tenFile, { bookType: "xlsx" });
}
