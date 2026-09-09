// ============================================================
// Tên file: src/lib/monthlyStock.ts
// Tên tiếng Việt: Sổ kho theo THÁNG — hàm thuần (dồn tồn cuối kỳ → đầu kỳ sau)
// Description: Monthly stock ledger — pure helpers (carry closing → next opening)
// ============================================================
import type { MonthlyStockLine } from "@/types";
import { MONTHLY_STOCK_CATEGORIES } from "@/types";

/**
 * Toàn bộ TOÁN của sổ kho theo tháng nằm ở đây — thuần, không React, dễ đối chiếu
 * tay với "bảng kê kho" thật. Quy tắc chính xác nằm DUY NHẤT ở file này.
 *
 * Bất biến: Tồn cuối = Tồn đầu + Nhập − Xuất (cho CẢ kiện và kg). Tồn cuối KHÔNG
 * lưu — suy tại đây nên luôn khớp. Chỉ tồn ĐẦU kỳ được lưu (snapshot kế thừa).
 */

export interface MonthlyStockRow extends MonthlyStockLine {
  closeCtn: number;
  closeKg: number;
  /** Tiền còn lại = tồn cuối (kg) × đơn giá. */
  remainingValue: number;
}

export interface MonthlyStockTotals {
  openCtn: number;
  openKg: number;
  inCtn: number;
  inKg: number;
  outCtn: number;
  outKg: number;
  closeCtn: number;
  closeKg: number;
  remainingValue: number;
  soDong: number;
}

/** Suy tồn cuối + tiền còn lại cho một dòng (không lưu, luôn tính lại). */
export function suyDong(l: MonthlyStockLine): MonthlyStockRow {
  const closeCtn = l.openCtn + l.inCtn - l.outCtn;
  const closeKg = l.openKg + l.inKg - l.outKg;
  return {
    ...l,
    closeCtn,
    closeKg,
    remainingValue: closeKg * (l.unitPrice ?? 0),
  };
}

/** Cộng tổng một tập dòng (mỗi dòng độc lập trong cùng một tháng ⇒ cộng thẳng). */
export function tongDong(rows: MonthlyStockRow[]): MonthlyStockTotals {
  const t: MonthlyStockTotals = {
    openCtn: 0, openKg: 0, inCtn: 0, inKg: 0, outCtn: 0, outKg: 0,
    closeCtn: 0, closeKg: 0, remainingValue: 0, soDong: rows.length,
  };
  for (const r of rows) {
    t.openCtn += r.openCtn; t.openKg += r.openKg;
    t.inCtn += r.inCtn; t.inKg += r.inKg;
    t.outCtn += r.outCtn; t.outKg += r.outKg;
    t.closeCtn += r.closeCtn; t.closeKg += r.closeKg;
    t.remainingValue += r.remainingValue;
  }
  return t;
}

/* ---------- Tháng dương lịch ---------- */

/** Tháng hiện tại theo giờ máy, dạng 'YYYY-MM'. */
export function thangHienTai(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → tháng kế tiếp (qua năm khi tháng 12). */
export function thangSau(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → tháng liền trước. */
export function thangTruoc(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → "Tháng 7/2026". */
export function nhanThang(period: string): string {
  const [y, m] = period.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/**
 * Danh sách N tháng gần đây (mới → cũ) từ mốc `moc` (mặc định tháng hiện tại),
 * hợp nhất với mọi tháng đã có dữ liệu để không bao giờ thiếu kỳ nào trong sổ.
 */
export function danhSachThang(coSan: string[], moc = thangHienTai(), soThang = 24): string[] {
  const set = new Set<string>(coSan);
  let p = moc;
  for (let i = 0; i < soThang; i++) {
    set.add(p);
    p = thangTruoc(p);
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

/* ---------- Gom nhóm hiển thị (như các "TỔNG" của bảng kê) ---------- */

export interface NhomKho {
  category: string;
  rows: MonthlyStockRow[];
  tong: MonthlyStockTotals;
}

/**
 * Gom dòng theo NHÓM (category). Nhóm mặc định lên trước theo thứ tự
 * MONTHLY_STOCK_CATEGORIES, nhóm lạ xếp cuối theo bảng chữ cái. Trong mỗi nhóm
 * giữ `sortOrder` rồi tới tên.
 */
export function gomNhom(rows: MonthlyStockRow[]): NhomKho[] {
  const map = new Map<string, MonthlyStockRow[]>();
  for (const r of rows) {
    const k = r.category || "(Chưa phân nhóm)";
    let arr = map.get(k);
    if (!arr) {
      arr = [];
      map.set(k, arr);
    }
    arr.push(r);
  }
  const uuTien = (c: string) => {
    const i = MONTHLY_STOCK_CATEGORIES.indexOf(c);
    return i === -1 ? MONTHLY_STOCK_CATEGORIES.length : i;
  };
  return [...map.entries()]
    .sort((a, b) => uuTien(a[0]) - uuTien(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, rs]) => {
      rs.sort((x, y) => x.sortOrder - y.sortOrder || x.itemName.localeCompare(y.itemName));
      return { category, rows: rs, tong: tongDong(rs) };
    });
}

/* ---------- Cờ lệch dồn kỳ (tồn đầu tháng này vs tồn cuối tháng trước) ---------- */

export interface LechNhom {
  category: string;
  closeTruoc: number; // tồn cuối tháng trước (kg)
  openNay: number; // tồn đầu tháng này (kg)
  lech: number; // openNay − closeTruoc
}

export interface LechDonKy {
  closeTruoc: number;
  openNay: number;
  lech: number; // tổng: tồn đầu tháng này − tồn cuối tháng trước
  theoNhom: LechNhom[]; // các nhóm có chênh (|lech| > NGUONG)
}

const NGUONG_LECH = 1; // < 1 kg coi như khớp (làm tròn số lẻ)

const congTheoNhom = (rows: MonthlyStockRow[], lay: (r: MonthlyStockRow) => number) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.category || "(Chưa phân nhóm)", (m.get(r.category || "(Chưa phân nhóm)") ?? 0) + lay(r));
  return m;
};

/**
 * So tồn đầu tháng NÀY với tồn cuối tháng TRƯỚC (kg). Vòng gối đầu đúng thì
 * bằng nhau; lệch = ghi chép dồn kỳ sai (đúng nỗi đau file Excel gốc). Trả tổng
 * + các nhóm chênh để gọi tên đúng chỗ. KHÔNG sửa số — chỉ soi.
 */
export function soLechDonKy(rowsTruoc: MonthlyStockRow[], rowsNay: MonthlyStockRow[]): LechDonKy {
  const closeTruoc = rowsTruoc.reduce((s, r) => s + r.closeKg, 0);
  const openNay = rowsNay.reduce((s, r) => s + r.openKg, 0);
  const mClose = congTheoNhom(rowsTruoc, (r) => r.closeKg);
  const mOpen = congTheoNhom(rowsNay, (r) => r.openKg);
  const cats = new Set([...mClose.keys(), ...mOpen.keys()]);
  const theoNhom: LechNhom[] = [];
  for (const c of cats) {
    const ct = mClose.get(c) ?? 0;
    const on = mOpen.get(c) ?? 0;
    if (Math.abs(on - ct) > NGUONG_LECH) theoNhom.push({ category: c, closeTruoc: ct, openNay: on, lech: on - ct });
  }
  theoNhom.sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech));
  return { closeTruoc, openNay, lech: openNay - closeTruoc, theoNhom };
}

/** Có đáng gắn cờ lệch không (có tháng trước + tổng lệch quá ngưỡng). */
export const coLechDonKy = (l: LechDonKy | null) => !!l && Math.abs(l.lech) > NGUONG_LECH;

/* ---------- Đối chiếu lệch theo MẶT HÀNG (chẩn đoán, không tự sửa) ---------- */

/**
 * Khóa so hai tháng ở mức MẶT HÀNG: kho · nhóm · tên (BỎ size + xuất xứ). Cố ý
 * thô: giữa các tháng, một lô hay bị TÁCH theo size hoặc đổi mã lô (VD SANMA →
 * SANMA + SANMA 50-90) — gộp về tên thì các tách đó TRIỆT TIÊU, chỉ còn lệch
 * THẬT. So theo size sẽ báo động giả và dẫn tới sửa sai (cộng đôi).
 */
export const khoaLo = (l: { warehouse: string; category: string; itemName: string }) =>
  [l.warehouse, l.category, l.itemName].map((s) => (s || "").trim().toLowerCase()).join("|");

export interface DoiChieuDong {
  key: string;
  warehouse: string;
  category: string;
  itemName: string;
  closeTruocKg: number; // tổng tồn cuối tháng trước của mặt hàng
  openNayKg: number; // tổng tồn đầu tháng này của mặt hàng
  lechKg: number; // openNay − closeTruoc
  soDongNay: number; // số dòng tháng này của mặt hàng (để biết sửa ở đâu)
}

function gomTheoTen(rows: MonthlyStockRow[], layKg: (r: MonthlyStockRow) => number) {
  const m = new Map<string, { kg: number; sl: number; w: string; c: string; ten: string }>();
  for (const r of rows) {
    const k = khoaLo(r);
    const g = m.get(k) ?? { kg: 0, sl: 0, w: r.warehouse, c: r.category, ten: r.itemName };
    g.kg += layKg(r);
    g.sl += 1;
    m.set(k, g);
  }
  return m;
}

/**
 * Đối chiếu tồn cuối tháng TRƯỚC ↔ tồn đầu tháng NÀY theo MẶT HÀNG. Chỉ trả mặt
 * hàng LỆCH THẬT (|Δkg| > ngưỡng, sau khi gộp các tách size). KHÔNG sửa gì —
 * chẩn đoán để người dùng tự sửa ở lưới Ghi (con người phán đoán, tránh cộng đôi).
 */
export function doiChieuDonKy(rowsTruoc: MonthlyStockRow[], rowsNay: MonthlyStockRow[]): DoiChieuDong[] {
  const mTruoc = gomTheoTen(rowsTruoc, (r) => r.closeKg);
  const mNay = gomTheoTen(rowsNay, (r) => r.openKg);
  const keys = new Set([...mTruoc.keys(), ...mNay.keys()]);
  const out: DoiChieuDong[] = [];
  for (const k of keys) {
    const t = mTruoc.get(k);
    const n = mNay.get(k);
    const closeKg = t?.kg ?? 0;
    const openKg = n?.kg ?? 0;
    if (Math.abs(openKg - closeKg) <= NGUONG_LECH) continue;
    const g = (t ?? n)!;
    out.push({
      key: k,
      warehouse: g.w,
      category: g.c,
      itemName: g.ten,
      closeTruocKg: closeKg,
      openNayKg: openKg,
      lechKg: openKg - closeKg,
      soDongNay: n?.sl ?? 0,
    });
  }
  return out.sort((a, b) => Math.abs(b.lechKg) - Math.abs(a.lechKg));
}

/* ---------- Đồng bộ tên mặt hàng trong sổ với danh mục loại nguyên liệu ---------- */

/** Chuẩn hoá để SO KHỚP với danh mục: bỏ khoảng trắng thừa + thường hoá. */
const chuanKhop = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
/** Chuẩn hoá NGẶT để dò TRÙNG CÁCH GHI: bỏ hết khoảng trắng + dấu câu (250UP≡250 UP). */
const chuanNgat = (s: string) => (s || "").toLowerCase().replace(/[\s.,\-()/]+/g, "");

/** Đoán nhóm (category) loại NL từ tên — chỉ gợi ý, người dùng sửa được. */
export function suyNhomNguyenLieu(name: string): string {
  const s = name.toLowerCase();
  if (/(b[aạ]ch\s*tu[ộo]c|b\.\s*tu[ộo]c|\bda\b|mada|râu|dạt)/.test(s)) return "Bạch tuộc";
  if (/(m[ựu]c|\bống\b|nang|bao\s*t[ửu]|đầu\s*ống)/.test(s)) return "Mực";
  if (/ghẹ/.test(s)) return "Ghẹ";
  if (/(cá|saba|sanma|nodoguro|sòng|nục|thu|mòi|cơm|chỉ|nhồng|bò|đổng|hố)/.test(s)) return "Cá";
  return "Khác";
}

export interface DongBoDanhMuc {
  tongTen: number; // số tên phân biệt trong sổ
  daCo: number; // số tên đã có trong danh mục loại NL
  chuaCo: { name: string; nhomGoiY: string }[]; // tên chưa có (kèm nhóm gợi ý)
  nhomTrung: { variants: string[] }[]; // các nhóm tên TRÙNG CÁCH GHI (>1 biến thể)
}

/**
 * Phân tích tên mặt hàng trong sổ kho so với danh mục loại nguyên liệu:
 *  - `chuaCo`: tên chưa có trong danh mục (để thêm vào, kèm nhóm gợi ý).
 *  - `nhomTrung`: các tên chỉ khác nhau cách ghi (khoảng trắng/hoa thường/dấu câu),
 *    VD "250UP" / "250 UP" / "250 up" — gom để chuẩn hoá tay, tránh tách khi tổng hợp.
 * KHÔNG sửa gì — chỉ báo.
 */
export function phanTichDongBoDanhMuc(
  tenTrongSo: string[],
  tenDanhMuc: string[]
): DongBoDanhMuc {
  const dm = new Set(tenDanhMuc.map(chuanKhop));
  const phanBiet = [...new Set(tenTrongSo.map((t) => t.trim()).filter(Boolean))];
  const chuaCo = phanBiet
    .filter((t) => !dm.has(chuanKhop(t)))
    .map((name) => ({ name, nhomGoiY: suyNhomNguyenLieu(name) }));

  // Gom trùng-cách-ghi trong chính danh sách tên của sổ.
  const gom = new Map<string, Set<string>>();
  for (const t of phanBiet) {
    const k = chuanNgat(t);
    if (!k) continue;
    const set = gom.get(k) ?? new Set<string>();
    set.add(t);
    gom.set(k, set);
  }
  const nhomTrung = [...gom.values()]
    .filter((s) => s.size > 1)
    .map((s) => ({ variants: [...s].sort() }));

  return {
    tongTen: phanBiet.length,
    daCo: phanBiet.length - chuaCo.length,
    chuaCo,
    nhomTrung,
  };
}

/* ---------- Dồn kỳ: tồn cuối tháng N → tồn đầu tháng N+1 ---------- */

/** id tất định của dòng sinh ra khi dồn kỳ — chạy lại không đẻ dòng trùng. */
export const idDon = (srcId: string) => `carry|${srcId}`;

/**
 * Dựng dòng tồn đầu cho `thangDich` bằng cách KẾ THỪA tồn cuối các dòng
 * `nguon` (đã suy tồn cuối). Nhập/xuất = 0 (chờ ghi trong kỳ mới). Giữ nguyên
 * mô tả (nhóm, kho, tên, size, xuất xứ, đơn giá, kg/kiện). id tất định theo dòng
 * nguồn ⇒ dồn lại nhiều lần chỉ CẬP NHẬT, không nhân đôi.
 *
 * Chỉ mang sang dòng còn tồn (tồn cuối ≠ 0) — dòng đã hết không cần đầu kỳ mới.
 */
export function donSangThang(nguon: MonthlyStockRow[], thangDich: string): MonthlyStockLine[] {
  return nguon
    .filter((r) => Math.abs(r.closeKg) > 1e-9 || Math.abs(r.closeCtn) > 1e-9)
    .map((r) => ({
      id: idDon(r.id),
      period: thangDich,
      category: r.category,
      warehouse: r.warehouse,
      itemName: r.itemName,
      size: r.size,
      origin: r.origin,
      importDate: r.importDate,
      kgPerCtn: r.kgPerCtn,
      unitPrice: r.unitPrice,
      openCtn: r.closeCtn,
      openKg: r.closeKg,
      inCtn: 0,
      inKg: 0,
      outCtn: 0,
      outKg: 0,
      carriedFromId: r.id,
      sortOrder: r.sortOrder,
      note: "",
    }));
}
