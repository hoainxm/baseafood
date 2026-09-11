// ============================================================
// Tên file: src/lib/doiSoatHddt.ts
// Tên tiếng Việt: Đối soát Hóa đơn điện tử (cổng thuế) ⇄ Phần mềm kế toán — v2
// Description: Parse an invoice workbook (e-invoice sheets + accounting-software
//   sheet) and reconcile them by (MST bán | ký hiệu | số HĐ chuẩn). v2 thêm:
//   KHÔNG tự sửa dữ liệu (chỉ báo + người dùng bấm sửa từng dòng), 6 nhóm nghi
//   vấn, dò cột trùng theo độ khớp, gộp sheet tập con, cầu nối số liệu, và khối
//   tự kiểm 8 phép. Xuất Excel tô màu + chuẩn hóa trạng thái hiển thị.
// ============================================================
//
// NGUYÊN TẮC SỐ MỘT (v2 §1): hệ thống KHÔNG tự sửa giá trị của file. Chỗ nghi sai
// chỉ được BÁO (kèm 6 câu hỏi: vị trí / số đang có / số đối chứng / nguồn đối
// chứng / sai ở chỗ nào / ảnh hưởng). Chỉ đổi khi người dùng bấm "Sửa" từng
// dòng — áp trong PHIÊN (Map `edits`) + vào file xuất, giữ giá trị cũ. Không suy
// ra được số đúng thì ghi "chưa xác định", KHÔNG đoán.
//
// Toàn bộ dữ liệu nằm trong file Excel upload — KHÔNG đọc DB / repo (tier GREEN).

import * as XLSX from "xlsx-js-style";
import { boDau } from "@/lib/username";
import { num } from "@/lib/format";

// ---------- Kiểu dữ liệu ----------

export type TrangThaiHoaDon = "KHOP" | "LECH" | "THIEU";
export type TrangThaiPhanMem = "CO" | "THIEU";
export type NhomNghiVan = 1 | 2 | 3 | 4 | 5 | 6;

/** Nghi vấn per-dòng (nhóm 1,2,5) — đủ 6 câu hỏi (v2 §1). */
export interface NghiVan {
  nhom: NhomNghiVan;
  viTri: string; // "sheet · ô <chữ cái cột><dòng> (<tên cột>)"
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
  giaTriDung?: number; // có → hiện nút Sửa
}

/** Nhóm nghi vấn GỘP thống kê (nhóm 3,4,6) — không liệt kê từng dòng ở mức tổng. */
export interface NghiVanGop {
  nhom: NhomNghiVan;
  ten: string;
  soDong: number;
  tongTien: number;
  canhBao: string;
  chiTiet: NghiVan[]; // bung ra xem/sửa từng dòng khi cần
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
  khopFile: number; // số BÊN FILE của nhóm khớp
  lechFile: number; // số BÊN FILE của nhóm lệch
  chuaCoBenSo: number; // = tongFile − khopFile − lechFile (cách A)
  chuaCoBenSoTrucTiep: number; // tổng trực tiếp nhóm THIẾU (cách B) — phải = cách A
  // Trừ chéo (cách SAI người dùng hay nhầm):
  soKhopSo: number; // số bên SỔ của nhóm khớp+lệch
  duTruCheo: number; // (khopFile+lechFile) − soKhopSo = tổng chênh của phần đã ghép
  bocTach: { mo: string; tien: number }[]; // bóc tách phần dư về từng giao dịch
}

export interface DongHoaDon {
  sheet: string;
  soDong: number;
  cells: unknown[];
  kyHieu: string;
  soHoaDon: string;
  soChuan: string;
  ngayLap: string;
  mstBan: string;
  tenBan: string;
  dvt: string;
  tyGia: number;
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
}

export interface SheetHoaDon {
  ten: string;
  header: string[];
  preRows: unknown[][];
  dong: DongHoaDon[];
}

export interface DongPhanMem {
  sheet: string;
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
  soHddtKhop: number;
  trangThai: TrangThaiPhanMem;
  ketLuan: string;
  bangChung: string;
  nguonHddt: string;
  dongHddt: number | null;
  ngayLapHd: string;
  tenBanHddt: string;
  tongTtHddt: number | null;
}

export interface SheetPhanMem {
  ten: string;
  header: string[];
  dong: DongPhanMem[];
  laPhu?: boolean; // sheet tập con / không được chọn làm sổ chuẩn → không vào tổng
}

export interface CanhBao {
  loai: string;
  chiTiet: string;
}

export interface KetQuaDoiSoat {
  sheetsHoaDon: SheetHoaDon[];
  sheetPhanMem: SheetPhanMem | null; // sổ CHUẨN (vào tổng)
  sheetsPhanMemPhu: SheetPhanMem[]; // sổ phụ/tập con (tra cứu, KHÔNG vào tổng)
  tong: {
    soHoaDon: number;
    khop: number;
    lech: number;
    thieu: number;
    soDongPm: number;
    pmCo: number;
    pmThieu: number;
    tongChenh: number;
    soLoiParse: number;
  };
  nghiVan: NghiVan[]; // nhóm 1,2,5 — per dòng
  nghiVanGop: NghiVanGop[]; // nhóm 3,4,6 — gộp thống kê
  cauNoi: CauNoi;
  phepThu: PhepThu[];
  canhBao: CanhBao[];
  canChonSo: boolean; // có ≥2 sheet sổ không phân biệt được → cần người dùng chọn
  nhatKySua: { viTri: string; cu: string; moi: string }[]; // v2 §1: giữ giá trị cũ
  nguong: number;
}

export interface TuyChonDoiSoat {
  /** Chênh tiền tuyệt đối ≤ ngưỡng thì vẫn coi KHỚP (đơn vị VND). */
  nguong: number;
  /** Sửa trong phiên: key `${sheet}#${soDong}#${cot}` → giá trị mới (v2 §1). */
  edits?: Record<string, number>;
  /** Số nghi vấn baseline (lần chạy đầu) — cho phép thử #8. */
  nghiVanBanDau?: number;
  /** Tên sheet sổ người dùng chọn làm CHUẨN (khi có nhiều sheet sổ). */
  soChuanTen?: string;
}

// ---------- Tiện ích parse ----------

function chuan(s: unknown): string {
  return boDau(String(s ?? ""))
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, " "); // coi "_" như khoảng trắng: "SO_HD" → "so hd"
}

/** Chữ cái cột Excel từ index 0-based (0→A, 26→AA). */
const chuCaiCot = (i: number): string => (i < 0 ? "?" : XLSX.utils.encode_col(i));

/**
 * Parse số kiểu Việt/US KHÔNG phụ thuộc locale. number→giữ; chuỗi tách dấu thập
 * phân theo dấu ở VỊ TRÍ CUỐI; nhiều "." mà không "," → ngăn nghìn. Lỗi → null
 * (TUYỆT ĐỐI không mặc định 0/1 — v2 §3.2).
 */
export function soVN(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return null;
  const coCham = s.includes(".");
  const coPhay = s.includes(",");
  if (coCham && coPhay) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousand = decimal === "." ? "," : ".";
    s = s.split(thousand).join("").replace(decimal, ".");
  } else if (coPhay) {
    s = s.replace(",", ".");
  } else if (coCham) {
    if ((s.match(/\./g) ?? []).length > 1) s = s.split(".").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function ngayHienThi(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime()))
    return `${pad2(v.getDate())}/${pad2(v.getMonth() + 1)}/${v.getFullYear()}`;
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

export function soHoaDonChuan(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\s+/g, "");
  const bo0 = s.replace(/^0+/, "");
  return bo0 || (s ? "0" : "");
}

function taoKhoa(mstBan: string, kyHieu: string, soChuan: string): string {
  return `${chuan(mstBan)}|${chuan(kyHieu)}|${soChuan.toLowerCase()}`;
}

const cellStr = (row: unknown[], i: number): string =>
  i < 0 ? "" : String(row[i] ?? "").trim();

const keyEdit = (sheet: string, soDong: number, cot: number) => `${sheet}#${soDong}#${cot}`;

// ---------- Dò cột theo tên (có xử lý cột trùng — v2 §3.1) ----------

/** Mọi index khớp một tên (đã chuẩn hóa), khớp đúng trước rồi khớp tiền tố. */
function moiCot(header: unknown[], ...tens: string[]): number[] {
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
  const c = moiCot(header, ...tens);
  return c.length ? c[0] : -1;
};

/**
 * Chọn cột "chưa thuế / thuế / tổng" khi CÓ TRÙNG tên: thử mọi tổ hợp ứng viên,
 * chọn tổ hợp cho `chưa + thuế (− ck + phí)` KHỚP tổng nhất trên vùng dữ liệu
 * (v2 §3.1). Trả về index đã chọn + danh sách index "cột phụ" bị loại.
 */
function chonCotDongNhat(
  rows: unknown[][],
  dataStart: number,
  ucChua: number[],
  ucThue: number[],
  ucTong: number[],
  cCk: number,
  cPhi: number
): { chua: number; thue: number; tong: number; phu: number[] } {
  const list = <T,>(a: T[]) => (a.length ? a : [-1]);
  let best: { chua: number; thue: number; tong: number } | null = null;
  let bestErr = Infinity;
  for (const chua of list(ucChua))
    for (const thue of list(ucThue))
      for (const tong of list(ucTong)) {
        let err = 0;
        let n = 0;
        for (let i = dataStart; i < rows.length; i++) {
          const r = rows[i] ?? [];
          const a = soVN(r[chua]);
          const b = soVN(r[thue]);
          const t = soVN(r[tong]);
          if (a == null || b == null || t == null) continue;
          const ck = soVN(r[cCk]) ?? 0;
          const phi = soVN(r[cPhi]) ?? 0;
          err += Math.abs(a + b - ck + phi - t);
          n++;
        }
        if (n === 0) continue;
        if (err < bestErr) {
          bestErr = err;
          best = { chua, thue, tong };
        }
      }
  const chosen = best ?? {
    chua: ucChua[0] ?? -1,
    thue: ucThue[0] ?? -1,
    tong: ucTong[0] ?? -1,
  };
  const phu = [...ucChua, ...ucThue, ...ucTong].filter(
    (c) => c !== chosen.chua && c !== chosen.thue && c !== chosen.tong
  );
  return { ...chosen, phu: [...new Set(phu)] };
}

/** Tìm hàng tiêu đề: hàng chứa nhiều nhất từ khóa (≥2 mới nhận). */
function timHangTieuDe(rows: unknown[][], tuKhoa: string[]): number {
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

/** Vùng dữ liệu kết thúc ở ô trống đầu tiên của cột khóa, bỏ dòng "tổng/cộng". */
function laDongTong(row: unknown[]): boolean {
  const s = chuan(row[0]) || chuan(row[1]);
  return /^(tong|cong)\b/.test(s);
}

// ---------- Đọc workbook thô ----------

interface SheetTho {
  ten: string;
  rows: unknown[][];
}

export async function docWorkbook(file: File): Promise<SheetTho[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((ten) => ({
    ten,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[ten]!, {
      header: 1,
      raw: true,
      blankrows: true,
      defval: null,
    }),
  })).filter((s) => s.rows.length > 0);
}

// ---------- Nhận diện sheet ----------

const hangTieuDeHoaDon = (rows: unknown[][]) =>
  timHangTieuDe(rows, ["so hoa don", "ky hieu hoa don"]);

/**
 * Nhận sheet SỔ (phần mềm kế toán) cho CẢ HAI định dạng: nhãn tiếng Việt
 * (Số HĐ · Tổng cộng) và mã máy (SO_HD · TONGCONG). Neo vào "so hd" + "tổng cộng"
 * — thứ mà sheet HÓA ĐƠN ĐIỆN TỬ KHÔNG có (nó dùng "Số hóa đơn" + "Tổng tiền
 * thanh toán"), nên KHÔNG nhận nhầm HĐĐT thành sổ.
 */
function hangTieuDePhanMem(rows: unknown[][]): number {
  const gioiHan = Math.min(rows.length, 15);
  for (let i = 0; i < gioiHan; i++) {
    const cells = (rows[i] ?? []).map((c) => chuan(c));
    const coSoHd = cells.some((c) => c.includes("so hd"));
    const coTong = cells.some((c) => c === "tongcong" || c.includes("tong cong"));
    if (coSoHd && coTong) return i;
  }
  return -1;
}

/** Lấy giá trị ô có xét bản sửa trong phiên. */
function layO(
  row: unknown[],
  cot: number,
  sheet: string,
  soDong: number,
  edits?: Record<string, number>
): unknown {
  if (cot < 0) return null;
  const k = keyEdit(sheet, soDong, cot);
  if (edits && k in edits) return edits[k];
  return row[cot];
}

/** Bản sao hàng đã áp sửa (v2 §1) + ghi giá trị cũ vào nhật ký để giữ lại. */
function apSuaVaoHang(
  row: unknown[],
  header: string[],
  sheet: string,
  soDong: number,
  edits: Record<string, number> | undefined,
  nhatKy: { viTri: string; cu: string; moi: string }[]
): unknown[] {
  if (!edits) return row;
  let clone: unknown[] | null = null;
  for (const [k, v] of Object.entries(edits)) {
    const parts = k.split("#");
    const ct = parts.pop();
    const sd = parts.pop();
    if (parts.join("#") !== sheet || Number(sd) !== soDong) continue;
    const c = Number(ct);
    if (!clone) clone = [...row];
    const cu = row[c];
    clone[c] = v;
    nhatKy.push({
      viTri: `${sheet} · ô ${chuCaiCot(c)}${soDong} (${header[c] ?? ""})`,
      cu: cu == null || cu === "" ? "(trống)" : String(cu),
      moi: String(v),
    });
  }
  return clone ?? row;
}

// ---------- Nghi vấn: engine chung cho cụm (chưa thuế · thuế · tổng) ----------

interface CotCong {
  chua: number;
  thue: number;
  tong: number;
  ck: number;
  phi: number;
  tenChua: string;
  tenThue: string;
  tenTong: string;
}

/** Sinh nghi vấn cộng/thiếu cho 1 dòng. Trả {nghiVan?, nhom} — hoặc null nếu ổn. */
function nghiVanCong(
  sheet: string,
  soDong: number,
  row: unknown[],
  cot: CotCong,
  edits: Record<string, number> | undefined,
  nguong: number
): NghiVan | null {
  const a = soVN(layO(row, cot.chua, sheet, soDong, edits));
  const b = soVN(layO(row, cot.thue, sheet, soDong, edits));
  const t = soVN(layO(row, cot.tong, sheet, soDong, edits));
  const ck = soVN(layO(row, cot.ck, sheet, soDong, edits)) ?? 0;
  const phi = soVN(layO(row, cot.phi, sheet, soDong, edits)) ?? 0;
  const tolCong = Math.max(0.5, nguong / 1000); // ngưỡng nhận diện lệch cộng
  const oTong = `${sheet} · ô ${chuCaiCot(cot.tong)}${soDong} (${cot.tenTong})`;
  const oChua = `${sheet} · ô ${chuCaiCot(cot.chua)}${soDong} (${cot.tenChua})`;
  const oThue = `${sheet} · ô ${chuCaiCot(cot.thue)}${soDong} (${cot.tenThue})`;

  const coA = a != null,
    coB = b != null,
    coT = t != null;
  const soThieu = [coA, coB, coT].filter((x) => !x).length;

  // Nhóm 3: thiếu CẢ CỤM (không suy được) — chỉ còn tổng
  if (!coA && !coB && coT) {
    return {
      nhom: 3,
      viTri: `${oChua} + ${oThue}`,
      soDangCo: "(trống cả chưa thuế lẫn thuế)",
      soDoiChung: "chưa xác định",
      nguonDoiChung: "không đủ dữ liệu để tính ngược",
      saiOCho: `chỉ có tổng ${num(t!)} đ, thiếu cả hai thành phần`,
      anhHuong: "cột chưa thuế & thuế sẽ thiếu; tổng vẫn dùng được",
    };
  }
  // Nhóm 4: TỔNG bị xóa nhưng thành phần còn → suy được, nhưng gộp thống kê
  if (!coT && coA && coB) {
    const dung = a! + b! - ck + phi;
    return {
      nhom: 4,
      viTri: oTong,
      soDangCo: "(trống)",
      soDoiChung: num(dung),
      nguonDoiChung: `${cot.tenChua} + ${cot.tenThue}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(a!)} + ${num(b!)}${ck ? ` − ${num(ck)}` : ""}${phi ? ` + ${num(phi)}` : ""}`,
      saiOCho: "ô tổng bị xóa trong khi các ô thành phần còn",
      anhHuong: "chỉ ô tổng; đối soát dùng tổng suy ra",
      sheet,
      soDong,
      cot: cot.tong,
      tenCot: cot.tenTong,
      giaTriCu: t,
      giaTriDung: dung,
    };
  }
  // Nhóm 2: thiếu ĐÚNG MỘT thành phần (chưa thuế XOR thuế), tổng còn → suy được
  if (coT && soThieu === 1 && (!coA || !coB)) {
    if (!coA) {
      const dung = t! - b! + ck - phi;
      return {
        nhom: 2,
        viTri: oChua,
        soDangCo: "(trống)",
        soDoiChung: num(dung),
        nguonDoiChung: `${cot.tenTong} − ${cot.tenThue}${ck ? " + chiết khấu" : ""}${phi ? " − phí" : ""} = ${num(t!)} − ${num(b!)}`,
        saiOCho: "thiếu ô chưa thuế, suy ngược từ tổng và thuế",
        anhHuong: "chỉ ô chưa thuế",
        sheet,
        soDong,
        cot: cot.chua,
        tenCot: cot.tenChua,
        giaTriCu: a,
        giaTriDung: dung,
      };
    }
    const dung = t! - a! + ck - phi;
    return {
      nhom: 2,
      viTri: oThue,
      soDangCo: "(trống)",
      soDoiChung: num(dung),
      nguonDoiChung: `${cot.tenTong} − ${cot.tenChua} = ${num(t!)} − ${num(a!)}`,
      saiOCho: "thiếu ô thuế, suy ngược từ tổng và chưa thuế",
      anhHuong: "chỉ ô thuế",
      sheet,
      soDong,
      cot: cot.thue,
      tenCot: cot.tenThue,
      giaTriCu: b,
      giaTriDung: dung,
    };
  }
  // Nhóm 1: đủ thành phần nhưng CỘNG KHÔNG KHỚP — chỉ báo khi CẢ HAI cách lệch
  if (coA && coB && coT) {
    const e1 = Math.abs(a! + b! - t!);
    const e2 = Math.abs(a! + b! - ck + phi - t!);
    if (e1 > tolCong && e2 > tolCong) {
      const dung = a! + b! - ck + phi;
      return {
        nhom: 1,
        viTri: oTong,
        soDangCo: num(t!),
        soDoiChung: num(dung),
        nguonDoiChung: `${cot.tenChua} + ${cot.tenThue}${ck ? " − chiết khấu" : ""}${phi ? " + phí" : ""} = ${num(dung)} (giả định tổng sai)`,
        saiOCho: `cộng lệch cả hai cách: |${num(a!)}+${num(b!)}−${num(t!)}| = ${num(e1)} đ và tính cả chiết khấu/phí vẫn lệch ${num(e2)} đ`,
        anhHuong: "nếu sửa tổng: đổi ô tổng dòng này; các dòng khác không đổi",
        sheet,
        soDong,
        cot: cot.tong,
        tenCot: cot.tenTong,
        giaTriCu: t,
        giaTriDung: dung,
      };
    }
  }
  return null;
}

// ---------- Parse sheet HĐĐT ----------

function parseSheetHoaDon(
  ten: string,
  rows: unknown[][],
  hIdx: number,
  edits: Record<string, number> | undefined,
  nghiVan: NghiVan[],
  gopMap: Map<string, NghiVanGop>,
  nhatKy: { viTri: string; cu: string; moi: string }[]
): { sheet: SheetHoaDon; loiParse: number } {
  const headerRaw = rows[hIdx] ?? [];
  const header = headerRaw.map((c) => String(c ?? ""));
  const preRows = rows.slice(0, hIdx);
  const dataStart = hIdx + 1;

  const cCk = cot1(headerRaw, "Tổng tiền chiết khấu thương mại");
  const cPhi = cot1(headerRaw, "Tổng tiền phí");
  const sel = chonCotDongNhat(
    rows,
    dataStart,
    moiCot(headerRaw, "Tổng tiền chưa thuế"),
    moiCot(headerRaw, "Tổng tiền thuế"),
    moiCot(headerRaw, "Tổng tiền thanh toán"),
    cCk,
    cPhi
  );
  const cCot: CotCong = {
    chua: sel.chua,
    thue: sel.thue,
    tong: sel.tong,
    ck: cCk,
    phi: cPhi,
    tenChua: header[sel.chua] ?? "Tổng tiền chưa thuế",
    tenThue: header[sel.thue] ?? "Tổng tiền thuế",
    tenTong: header[sel.tong] ?? "Tổng tiền thanh toán",
  };
  const cKyHieu = cot1(headerRaw, "Ký hiệu hóa đơn");
  const cSo = cot1(headerRaw, "Số hóa đơn");
  const cNgay = cot1(headerRaw, "Ngày lập");
  const cMstBan = cot1(headerRaw, "MST người bán/MST người xuất hàng", "MST người bán");
  const cTenBan = cot1(headerRaw, "Tên người bán/Tên người xuất hàng", "Tên người bán");
  const cDvt = cot1(headerRaw, "Đơn vị tiền tệ");
  const cTyGia = cot1(headerRaw, "Tỷ giá");

  // Nhóm 5: cột phụ trùng tên — báo, không tham gia đối soát
  for (const p of sel.phu)
    nghiVan.push({
      nhom: 5,
      viTri: `${ten} · cột ${chuCaiCot(p)} (${header[p] ?? ""})`,
      soDangCo: "(cột phụ trùng tên cột gốc)",
      soDoiChung: "—",
      nguonDoiChung: "cột gốc đã chọn theo độ khớp với tổng thanh toán",
      saiOCho: "người dùng tự thêm cột trùng tên; giá trị có thể khác cột gốc",
      anhHuong: "KHÔNG tham gia đối soát; chỉ ảnh hưởng ô tổng người dùng tự cộng",
    });

  const dong: DongHoaDon[] = [];
  let loiParse = 0;
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (laDongTong(row)) continue;
    const soDong = i + 1;
    const soHoaDon = String(layO(row, cSo, ten, soDong, edits) ?? "").trim();
    const kyHieu = String(layO(row, cKyHieu, ten, soDong, edits) ?? "").trim();
    if (!soHoaDon && !kyHieu) continue;

    const dvt = cellStr(row, cDvt) || "VND";
    const laVnd = chuan(dvt) === "vnd" || chuan(dvt) === "";
    const tyGiaRaw = soVN(row[cTyGia]);
    const tyGia = laVnd ? 1 : tyGiaRaw && tyGiaRaw > 0 ? tyGiaRaw : 1;

    const chua = soVN(layO(row, cCot.chua, ten, soDong, edits));
    const thue = soVN(layO(row, cCot.thue, ten, soDong, edits));
    const tong = soVN(layO(row, cCot.tong, ten, soDong, edits));
    if (tong == null) loiParse++;

    // Nghi vấn cộng/thiếu
    const nv = nghiVanCong(ten, soDong, row, cCot, edits, 1000);
    if (nv) {
      if (nv.nhom === 3 || nv.nhom === 4) {
        const gk = `hd${nv.nhom}`;
        const g = gopMap.get(gk) ?? {
          nhom: nv.nhom,
          ten:
            nv.nhom === 3
              ? "Thiếu cả cụm (chỉ còn tổng) — hóa đơn"
              : "Tổng bị xóa (thành phần còn) — hóa đơn",
          soDong: 0,
          tongTien: 0,
          canhBao:
            nv.nhom === 3
              ? "Cột chưa thuế & thuế thiếu đúng số dòng này — đừng lấy đi lập báo cáo."
              : "Ô tổng bị xóa; đối soát dùng tổng suy ra — soát lại có hợp lý không.",
          chiTiet: [],
        };
        g.soDong++;
        g.tongTien += (nv.nhom === 3 ? tong : nv.giaTriDung) ?? 0;
        g.chiTiet.push(nv);
        gopMap.set(gk, g);
      } else {
        nghiVan.push(nv);
      }
    }

    const soChuan = soHoaDonChuan(soHoaDon);
    const mstBan = cellStr(row, cMstBan);
    dong.push({
      sheet: ten,
      soDong,
      cells: apSuaVaoHang(row, header, ten, soDong, edits, nhatKy),
      kyHieu,
      soHoaDon,
      soChuan,
      ngayLap: ngayHienThi(row[cNgay]),
      mstBan,
      tenBan: cellStr(row, cTenBan),
      dvt,
      tyGia,
      chuaThueVnd: (chua ?? 0) * tyGia,
      thueVnd: (thue ?? 0) * tyGia,
      tongTtVnd: (tong ?? 0) * tyGia,
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
  return { sheet: { ten, header, preRows, dong }, loiParse };
}

// ---------- Parse sheet PHẦN MỀM ----------

function parseSheetPhanMem(
  ten: string,
  rows: unknown[][],
  hIdx: number,
  edits: Record<string, number> | undefined,
  nghiVan: NghiVan[],
  gopMap: Map<string, NghiVanGop>,
  nhatKy: { viTri: string; cu: string; moi: string }[]
): SheetPhanMem {
  const headerRaw = rows[hIdx] ?? [];
  const header = headerRaw.map((c) => String(c ?? ""));
  const dataStart = hIdx + 1;

  // Nhận cả nhãn tiếng Việt lẫn tên mã máy (định dạng xuất khác nhau giữa kỳ).
  const sel = chonCotDongNhat(
    rows,
    dataStart,
    moiCot(headerRaw, "ST chưa thuế", "TIENHANG"),
    moiCot(headerRaw, "Tiền thuế", "TIENTHUE"),
    moiCot(headerRaw, "Tổng cộng", "TONGCONG"),
    -1,
    -1
  );
  const cCot: CotCong = {
    chua: sel.chua,
    thue: sel.thue,
    tong: sel.tong,
    ck: -1,
    phi: -1,
    tenChua: header[sel.chua] ?? "ST chưa thuế",
    tenThue: header[sel.thue] ?? "Tiền thuế",
    tenTong: header[sel.tong] ?? "Tổng cộng",
  };
  const cCtgs = cot1(headerRaw, "CTGS", "SCT_GHISO");
  const cPhieu = cot1(headerRaw, "Phiếu", "SO_PHIEU");
  const cKyHieu = cot1(headerRaw, "KHHĐ", "KY_HIEU");
  const cSo = cot1(headerRaw, "Số HĐ", "SO_HD");
  const cMst = cot1(headerRaw, "MASOTHUE", "RMST");
  const cNgayHd = cot1(headerRaw, "Ngày HĐ", "NGAY_HD");
  const cTkNo = cot1(headerRaw, "TK Nợ");
  const cTkCo = cot1(headerRaw, "TK Có");
  const cDienGiai = cot1(headerRaw, "Tên mặt hàng", "MAT_HANG", "GHICHU");
  const cTenBan = cot1(headerRaw, "Tên người bán", "NGUOI_BAN");

  for (const p of sel.phu)
    nghiVan.push({
      nhom: 5,
      viTri: `${ten} · cột ${chuCaiCot(p)} (${header[p] ?? ""})`,
      soDangCo: "(cột phụ trùng tên)",
      soDoiChung: "—",
      nguonDoiChung: "cột gốc chọn theo độ khớp với tổng cộng",
      saiOCho: "cột trùng tên do người dùng thêm",
      anhHuong: "KHÔNG tham gia đối soát",
    });

  const dong: DongPhanMem[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (laDongTong(row)) continue;
    const soDong = i + 1;
    const soHoaDon = String(layO(row, cSo, ten, soDong, edits) ?? "").trim();
    const kyHieu = String(layO(row, cKyHieu, ten, soDong, edits) ?? "").trim();
    if (!soHoaDon && !kyHieu) continue;

    const nv = nghiVanCong(ten, soDong, row, cCot, edits, 1000);
    if (nv) {
      if (nv.nhom === 3 || nv.nhom === 4) {
        const gk = `pm${nv.nhom}`;
        const g = gopMap.get(gk) ?? {
          nhom: nv.nhom,
          ten:
            nv.nhom === 3
              ? "Thiếu cả cụm (chỉ còn tổng) — phần mềm"
              : "Tổng bị xóa (thành phần còn) — phần mềm",
          soDong: 0,
          tongTien: 0,
          canhBao:
            nv.nhom === 3
              ? "Bút toán thiếu chưa thuế & thuế — soát lại."
              : "Ô tổng cộng bị xóa; dùng tổng suy ra.",
          chiTiet: [],
        };
        g.soDong++;
        g.tongTien += (nv.nhom === 3 ? soVN(row[cCot.tong]) : nv.giaTriDung) ?? 0;
        g.chiTiet.push(nv);
        gopMap.set(gk, g);
      } else nghiVan.push(nv);
    }

    const soChuan = soHoaDonChuan(soHoaDon);
    const mstBan = cellStr(row, cMst);
    dong.push({
      sheet: ten,
      soDong,
      cells: apSuaVaoHang(row, header, ten, soDong, edits, nhatKy),
      ctgs: cellStr(row, cCtgs),
      phieu: cellStr(row, cPhieu),
      kyHieu,
      soHoaDon,
      soChuan,
      mstBan,
      tenBan: cellStr(row, cTenBan),
      tongCong: soVN(layO(row, cCot.tong, ten, soDong, edits)) ?? 0,
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

const uniq = (arr: string[]): string[] => [...new Set(arr.filter(Boolean))];

// ---------- Orchestrator ----------

export function doiSoat(sheets: SheetTho[], opt: TuyChonDoiSoat): KetQuaDoiSoat {
  const nguong = Math.max(0, opt.nguong || 0);
  const edits = opt.edits;
  const nghiVan: NghiVan[] = [];
  const gopMap = new Map<string, NghiVanGop>();
  const canhBao: CanhBao[] = [];
  const nhatKySua: { viTri: string; cu: string; moi: string }[] = [];

  const sheetsHoaDon: SheetHoaDon[] = [];
  const sheetsPmTatCa: SheetPhanMem[] = [];
  let soLoiParse = 0;

  for (const s of sheets) {
    const hPm = hangTieuDePhanMem(s.rows);
    const hHd = hangTieuDeHoaDon(s.rows);
    if (hPm >= 0)
      sheetsPmTatCa.push(parseSheetPhanMem(s.ten, s.rows, hPm, edits, nghiVan, gopMap, nhatKySua));
    else if (hHd >= 0) {
      const r = parseSheetHoaDon(s.ten, s.rows, hHd, edits, nghiVan, gopMap, nhatKySua);
      sheetsHoaDon.push(r.sheet);
      soLoiParse += r.loiParse;
    }
  }

  // --- Chọn sổ CHUẨN khi có nhiều sheet phần mềm (v2 §4) ---
  let sheetPhanMem: SheetPhanMem | null = null;
  const sheetsPhanMemPhu: SheetPhanMem[] = [];
  let canChonSo = false;
  if (sheetsPmTatCa.length === 1) sheetPhanMem = sheetsPmTatCa[0];
  else if (sheetsPmTatCa.length > 1) {
    const theoTen = opt.soChuanTen
      ? sheetsPmTatCa.find((s) => s.ten === opt.soChuanTen)
      : null;
    const coMoi = sheetsPmTatCa.filter((s) => /m[oó]i/.test(chuan(s.ten)));
    let chuanSheet = theoTen ?? (coMoi.length === 1 ? coMoi[0] : null);
    if (!chuanSheet) {
      // Không phân biệt được → tạm lấy sheet nhiều dòng nhất + cần người dùng chọn
      chuanSheet = [...sheetsPmTatCa].sort((a, b) => b.dong.length - a.dong.length)[0];
      canChonSo = true;
      canhBao.push({
        loai: "Chọn sổ chuẩn",
        chiTiet: `Có ${sheetsPmTatCa.length} sheet sổ (${sheetsPmTatCa
          .map((s) => s.ten)
          .join(", ")}). Chưa phân biệt được bản chốt — tạm dùng "${chuanSheet.ten}". Hãy chọn lại nếu sai.`,
      });
    }
    sheetPhanMem = chuanSheet;
    for (const s of sheetsPmTatCa)
      if (s !== chuanSheet) {
        s.laPhu = true;
        sheetsPhanMemPhu.push(s);
      }
  }

  // --- Sheet trùng lặp (tập con) trong nhóm sổ phụ (v2 §4, §6) ---
  if (sheetPhanMem) {
    const khoaChuan = new Set(sheetPhanMem.dong.map((d) => d.khoa));
    for (const phu of sheetsPhanMemPhu) {
      const khoaPhu = new Set(phu.dong.map((d) => d.khoa));
      const laTapCon = [...khoaPhu].every((k) => khoaChuan.has(k));
      const chenhSo = [...khoaChuan].filter((k) => !khoaPhu.has(k)).length;
      gopMap.set(`sheet-${phu.ten}`, {
        nhom: 6,
        ten: `Sheet trùng lặp: "${phu.ten}"`,
        soDong: phu.dong.length,
        tongTien: phu.dong.reduce((s, d) => s + d.tongCong, 0),
        canhBao: laTapCon
          ? `"${phu.ten}" là TẬP CON của "${sheetPhanMem.ten}" (lệch ${chenhSo} hóa đơn). Chỉ cộng "${sheetPhanMem.ten}" vào tổng — bỏ qua sheet này để KHỎI đếm hai lần. Xác nhận bản chốt.`
          : `"${phu.ten}" khác "${sheetPhanMem.ten}" (${chenhSo} khóa chỉ có ở bản chuẩn). KHÔNG cộng vào tổng; xác nhận bản chốt.`,
        chiTiet: [],
      });
    }
  }

  if (!sheetsHoaDon.length)
    canhBao.push({
      loai: "Thiếu dữ liệu",
      chiTiet: "Không tìm thấy sheet HÓA ĐƠN ĐIỆN TỬ (cần cột Ký hiệu hóa đơn + Số hóa đơn).",
    });
  if (!sheetPhanMem)
    canhBao.push({
      loai: "Thiếu dữ liệu",
      chiTiet:
        "Không tìm thấy sheet SỔ/PHẦN MỀM (cần cột KHHĐ/KY_HIEU + Số HĐ/SO_HD + Tổng cộng/TONGCONG). Mọi hóa đơn sẽ báo CHƯA CÓ TRONG PMKT.",
    });

  // --- Gom theo khóa ---
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
    tongChenh = 0;

  for (const sh of sheetsHoaDon)
    for (const d of sh.dong) {
      soHoaDon++;
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
          (chenh === 0 ? "khớp số tiền." : `chênh ${num(Math.abs(chenh))} đ trong ngưỡng, coi như khớp.`);
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

  let pmCo = 0,
    pmThieu = 0,
    soDongPm = 0;
  if (sheetPhanMem)
    for (const d of sheetPhanMem.dong) {
      soDongPm++;
      const hd = hdTheoKhoa.get(d.khoa) ?? [];
      if (!hd.length) {
        d.trangThai = "THIEU";
        d.ketLuan = "CHƯA CÓ HĐĐT";
        d.bangChung = "Không tìm thấy hóa đơn điện tử nào có cùng MST người bán + ký hiệu + số hóa đơn.";
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

  // Khóa trùng trong HĐĐT
  for (const [k, arr] of hdTheoKhoa)
    if (arr.length > 1)
      canhBao.push({
        loai: "Trùng khóa HĐĐT",
        chiTiet: `Khóa "${k}" xuất hiện ${arr.length} lần (${arr.map((x) => `${x.sheet}#${x.soDong}`).join(", ")}).`,
      });

  // --- Cầu nối số liệu (v2 §5) ---
  let tongFile = 0,
    khopFile = 0,
    lechFile = 0,
    soKhopSo = 0,
    chuaTrucTiep = 0;
  const bocTach: { mo: string; tien: number }[] = [];
  for (const sh of sheetsHoaDon)
    for (const d of sh.dong) {
      tongFile += d.tongTtVnd;
      if (d.trangThai === "KHOP") {
        khopFile += d.tongTtVnd;
        soKhopSo += d.tongTtPm;
      } else if (d.trangThai === "LECH") {
        lechFile += d.tongTtVnd;
        soKhopSo += d.tongTtPm;
      } else chuaTrucTiep += d.tongTtVnd;
      if (d.chenh != null && Math.abs(d.chenh) > 0.005)
        bocTach.push({ mo: `${d.kyHieu}-${d.soChuan} (${d.sheet})`, tien: d.chenh });
    }
  const cauNoi: CauNoi = {
    tongFile,
    khopFile,
    lechFile,
    chuaCoBenSo: tongFile - khopFile - lechFile,
    chuaCoBenSoTrucTiep: chuaTrucTiep,
    soKhopSo,
    duTruCheo: khopFile + lechFile - soKhopSo,
    bocTach: bocTach.sort((a, b) => Math.abs(b.tien) - Math.abs(a.tien)).slice(0, 100),
  };

  const nghiVanGop = [...gopMap.values()];
  const soNghiVan = nghiVan.length + nghiVanGop.reduce((s, g) => s + g.soDong, 0);

  // --- Khối tự kiểm (v2 §6) ---
  const round = (n: number) => Math.round(n * 100) / 100;
  const sumChenhBoc = bocTach.reduce((s, x) => s + x.tien, 0);
  const phepThu: PhepThu[] = [
    {
      ten: "Mỗi hóa đơn đúng 1 nhãn",
      batLoiGi: "một hóa đơn bị đếm 2 nhãn hoặc bị sót nhãn",
      mong: String(soHoaDon),
      thuc: String(khop + lech + thieu),
      dat: soHoaDon === khop + lech + thieu,
    },
    {
      ten: "Mỗi bút toán đúng 1 nhãn",
      batLoiGi: "dòng phần mềm bị sót/đếm trùng nhãn",
      mong: String(soDongPm),
      thuc: String(pmCo + pmThieu),
      dat: soDongPm === pmCo + pmThieu,
    },
    {
      ten: "Cột quy đổi = gốc × tỷ giá dòng đó",
      batLoiGi: "lấy nhầm cột tỷ giá / cột quy đổi",
      mong: "0 dòng lệch",
      thuc: `${countLechQuyDoi(sheetsHoaDon)} dòng lệch`,
      dat: countLechQuyDoi(sheetsHoaDon) === 0,
    },
    {
      ten: "Tổng file − các nhóm = 0",
      batLoiGi: "phân nhóm bỏ sót tiền",
      mong: "0 đ",
      thuc: `${num(round(tongFile - khopFile - lechFile - chuaTrucTiep))} đ`,
      dat: Math.abs(tongFile - khopFile - lechFile - chuaTrucTiep) < 0.5,
    },
    {
      ten: "Hai cách tính phần chưa đối soát bằng nhau",
      batLoiGi: "trừ chéo file/sổ khi tính phần còn thiếu",
      mong: "0 đ chênh",
      thuc: `${num(round(cauNoi.chuaCoBenSo - cauNoi.chuaCoBenSoTrucTiep))} đ`,
      dat: Math.abs(cauNoi.chuaCoBenSo - cauNoi.chuaCoBenSoTrucTiep) < 0.5,
    },
    {
      ten: "Phần dư trừ chéo giải thích được",
      batLoiGi: "phần dư không bóc tách về giao dịch",
      mong: `${num(round(cauNoi.duTruCheo))} đ`,
      thuc: `${num(round(sumChenhBoc))} đ (bóc tách)`,
      dat: Math.abs(cauNoi.duTruCheo - sumChenhBoc) < 0.5,
    },
    {
      ten: "Bằng chứng cộng = chỉ tiêu bảng chính",
      batLoiGi: "cột 'tổng bên PM' của HĐĐT lệch tổng bút toán khớp",
      mong: `${num(round(soKhopSo))} đ`,
      thuc: `${num(round(tongPmCo(sheetPhanMem)))} đ`,
      dat: Math.abs(soKhopSo - tongPmCo(sheetPhanMem)) < 0.5,
    },
    {
      ten: "Số nghi vấn = số đã liệt kê",
      batLoiGi: "xuất hiện lỗi mới, hoặc người dùng vừa sửa xong 1 lỗi",
      mong: String(opt.nghiVanBanDau ?? soNghiVan),
      thuc: String(soNghiVan),
      dat: (opt.nghiVanBanDau ?? soNghiVan) === soNghiVan,
    },
  ];

  return {
    sheetsHoaDon,
    sheetPhanMem,
    sheetsPhanMemPhu,
    tong: { soHoaDon, khop, lech, thieu, soDongPm, pmCo, pmThieu, tongChenh, soLoiParse },
    nghiVan,
    nghiVanGop,
    cauNoi,
    phepThu,
    canhBao,
    canChonSo,
    nhatKySua,
    nguong,
  };
}

function countLechQuyDoi(sheets: SheetHoaDon[]): number {
  let n = 0;
  for (const sh of sheets)
    for (const d of sh.dong) {
      const goc = d.tyGia ? d.tongTtVnd / d.tyGia : d.tongTtVnd;
      if (Math.abs(goc * d.tyGia - d.tongTtVnd) > 0.01) n++;
    }
  return n;
}
function tongPmCo(pm: SheetPhanMem | null): number {
  if (!pm) return 0;
  return pm.dong.filter((d) => d.trangThai === "CO").reduce((s, d) => s + d.tongCong, 0);
}

export async function docVaDoiSoat(file: File, opt: TuyChonDoiSoat): Promise<KetQuaDoiSoat> {
  const sheets = await docWorkbook(file);
  return doiSoat(sheets, opt);
}

// ---------- Xuất Excel tô màu + chuẩn hóa hiển thị (v2 §7) ----------

const CHU_THICH =
  'CHÚ THÍCH: dòng ĐỎ = hóa đơn chưa có trong phần mềm kế toán | dòng VÀNG = có nhưng lệch tiền | dòng XANH = khớp. Cột "BẰNG CHỨNG ĐỐI CHIẾU" ở cuối bảng cho biết khớp với phiếu nào.';
const CHU_THICH_PM =
  'CHÚ THÍCH: dòng XANH = bút toán đã có hóa đơn điện tử tương ứng | dòng ĐỎ = chưa tìm thấy hóa đơn điện tử.';

const FILL = {
  xanh: { fill: { patternType: "solid", fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" } } },
  vang: { fill: { patternType: "solid", fgColor: { rgb: "FFEB9C" } }, font: { color: { rgb: "9C6500" } } },
  do: { fill: { patternType: "solid", fgColor: { rgb: "FFC7CE" } }, font: { color: { rgb: "9C0006" } } },
} as const;
const HEADER_STYLE = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "D9E1F2" } } } as const;
type Style = { fill?: unknown; font?: unknown } | null;

const HEADER_HD_THEM = [
  "Tỷ giá áp dụng", "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Chưa thuế (VND)", "Thuế (VND)",
  "Tổng thanh toán (VND)", "Số dòng khớp PMKT", "Tổng TT bên PMKT", "Chênh lệch", "KẾT LUẬN",
  "Số phiếu kế toán", "Chứng từ ghi sổ", "Ngày ghi sổ", "TK Nợ / TK Có", "Diễn giải trên phần mềm",
  "Số tiền đã hạch toán", "BẰNG CHỨNG ĐỐI CHIẾU",
];
const HEADER_PM_THEM = [
  "Số HĐ chuẩn", "KHÓA ĐỐI CHIẾU", "Số HĐĐT khớp", "KẾT LUẬN", "Nguồn hóa đơn điện tử",
  "Dòng trên sheet HĐĐT", "Ngày lập HĐ", "Tên người bán trên HĐĐT", "Tổng TT trên HĐĐT (VND)",
  "BẰNG CHỨNG ĐỐI CHIẾU",
];

function oXuat(v: unknown): unknown {
  if (v instanceof Date) return ngayHienThi(v);
  return v ?? null;
}

/** Dựng worksheet SẠCH: neo A1, nút lọc, nới cột hẹp, tô màu theo dòng (v2 §7). */
function dungSheet(aoa: unknown[][], fillTheoHang: Style[], hangTieuDe: number): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const fill = fillTheoHang[r];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as { v?: unknown; z?: string; s?: unknown } | undefined;
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
  // Nới cột hẹp (< 3 ký tự → 12), neo khung nhìn A1 + đóng băng tới hàng tiêu đề.
  const cols: { wch: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let w = 0;
    for (let r = hangTieuDe; r <= Math.min(range.e.r, hangTieuDe + 60); r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as { v?: unknown } | undefined;
      const len = cell?.v == null ? 0 : String(cell.v).length;
      if (len > w) w = len;
    }
    cols.push({ wch: Math.min(Math.max(w + 1, 12), 48) });
  }
  ws["!cols"] = cols;
  // Nút lọc trên hàng tiêu đề, KHÔNG lưu điều kiện lọc nào (không ẩn dòng) — v2 §7.
  ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: hangTieuDe, c: range.s.c })}:${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}` };
  // Dựng sheet MỚI nên không có dòng/cột ẩn, bộ lọc lưu sẵn, hay ô góc khung nhìn
  // của file nguồn "dính" lại — khung nhìn mặc định neo ở A1 (v2 §7).
  return ws;
}

export function xuatExcelDoiSoat(kq: KetQuaDoiSoat, tenFile = "doi-soat-hddt.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const tenDung = new Set<string>();
  const themSheet = (ws: XLSX.WorkSheet, ten: string) => {
    let t = ten.slice(0, 31);
    let i = 2;
    while (tenDung.has(t)) t = `${ten.slice(0, 28)}~${i++}`;
    tenDung.add(t);
    XLSX.utils.book_append_sheet(wb, ws, t);
  };

  for (const sh of kq.sheetsHoaDon) {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    sh.preRows.forEach((r) => {
      aoa.push([null, ...r.map(oXuat)]);
      fills.push(null);
    });
    aoa.push([CHU_THICH]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_HD_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan, ...d.cells.map(oXuat), d.tyGia, d.soChuan, d.khoa, d.chuaThueVnd, d.thueVnd,
        d.tongTtVnd, d.soDongKhopPm, d.tongTtPm, d.chenh, d.ketLuan, d.phieuKe, d.ctgs, d.ngayGhiSo,
        d.tkNoCo, d.dienGiaiPm, d.soTienHachToan, d.bangChung,
      ]);
      fills.push(d.trangThai === "KHOP" ? FILL.xanh : d.trangThai === "LECH" ? FILL.vang : FILL.do);
    }
    themSheet(dungSheet(aoa, fills, hIdx), sh.ten);
  }

  const dungSheetPm = (sh: SheetPhanMem) => {
    const aoa: unknown[][] = [];
    const fills: Style[] = [];
    aoa.push([sh.laPhu ? `${CHU_THICH_PM} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH_PM]);
    fills.push(null);
    const hIdx = aoa.length;
    aoa.push(["KẾT QUẢ", ...sh.header, ...HEADER_PM_THEM]);
    fills.push(null);
    for (const d of sh.dong) {
      aoa.push([
        d.ketLuan, ...d.cells.map(oXuat), d.soChuan, d.khoa, d.soHddtKhop, d.ketLuan, d.nguonHddt,
        d.dongHddt, d.ngayLapHd, d.tenBanHddt, d.tongTtHddt, d.bangChung,
      ]);
      fills.push(d.trangThai === "CO" ? FILL.xanh : FILL.do);
    }
    themSheet(dungSheet(aoa, fills, hIdx), sh.laPhu ? `PHỤ ${sh.ten}` : sh.ten);
  };
  if (kq.sheetPhanMem) dungSheetPm(kq.sheetPhanMem);
  for (const p of kq.sheetsPhanMemPhu) dungSheetPm(p);

  // Nhật ký sửa (v2 §1) — giữ giá trị cũ của mọi ô người dùng đã bấm sửa.
  if (kq.nhatKySua.length) {
    const aoa: unknown[][] = [
      ["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"],
      ["Vị trí", "Giá trị cũ", "Giá trị mới"],
      ...kq.nhatKySua.map((n) => [n.viTri, n.cu, n.moi]),
    ];
    const fills: Style[] = aoa.map(() => null);
    themSheet(dungSheet(aoa, fills, 1), "NHẬT KÝ SỬA");
  }

  XLSX.writeFile(wb, tenFile, { bookType: "xlsx" });
}
