// ============================================================
// Tên file: src/lib/monthlyStockExcel.ts
// Tên tiếng Việt: Đọc file "BẢNG KÊ KHO" Excel (mỗi sheet 1 tháng) → dòng sổ kho
// Description: Parse the monthly "bảng kê kho" workbook into ledger rows
// ============================================================
import * as XLSX from "xlsx";

/**
 * Đọc đúng bố cục "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T" (file kho ... năm ....xlsx):
 * mỗi sheet = một THÁNG, tên sheet là số tháng ("1".."12"). Cột (0-based):
 *   0 Ngày nhập · 1 Tên hàng · 2 KG/kiện · 3 Giá · 4 Xuất xứ · 5 Size
 *   8/9 Tồn đầu (kiện/kg) · 10/11 Nhập (kiện/kg) · 12/13 Xuất (kiện/kg)
 * (Bỏ 6/7 "Nhập đầu kỳ" — số tham chiếu tĩnh; 14/15 Tồn cuối & 16 Tiền = SUY ở app.)
 *
 *   17 (cột R) Ghi chú kho: "GỬI KHO HP" / "GỬI KHO Á D" / "gửi kho phước cơ" → `khoGhi`
 *      (phần sau chữ "KHO"); chữ khác (VD "xuất trả lại 4240") → `ghiChu`.
 *
 * Nhóm lấy từ dòng tiêu đề mục ("I HÀNG NHẬP KHẨU" / "II HÀNG MUA NGOÀI" / "III HÀNG TẠM";
 * mục số La Mã lạ ⇒ nhóm mới theo tên). Khối con có dòng cộng riêng ("TỔNG 2 DA" trong
 * mục nhập khẩu) ⇒ tách thành nhóm "<mục> – 2 DA"; dòng đầu khối lấy từ công thức SUM
 * của chính dòng cộng đó (kế toán tự khoanh vùng). Dòng "TỔNG …"/"CỘNG …" và các dòng
 * trước mục đầu tiên đều bỏ. KHÔNG chép tồn cuối của file (file gốc dồn kỳ sai ở dòng
 * tổng) — chỉ lấy tồn đầu + nhập + xuất.
 */
export interface BangKeKhoRow {
  category: string;
  itemName: string;
  size: string;
  origin: string;
  importDate: string; // ISO yyyy-mm-dd hoặc ""
  kgPerCtn: number | null;
  unitPrice: number | null;
  openCtn: number;
  openKg: number;
  inCtn: number;
  inKg: number;
  outCtn: number;
  outKg: number;
  rowIndex: number; // vị trí dòng trong sheet (cho id tất định khi nạp lại)
  khoGhi: string; // viết tắt kho gửi ở cột R ("HP", "Á D", "phước cơ"); "" = hàng ở chính kho của sổ
  ghiChu: string; // chữ khác ở cột R (không phải kho)
}

export interface BangKeKhoSheet {
  sheetName: string;
  monthNum: number | null; // suy từ tên sheet nếu là số tháng 1..12
  tieuDe: string; // dòng tiêu đề đầu sheet, VD "BẢNG KÊ NGUYÊN LIỆU KHO 1500 THÁNG 08 / 2026"
  rows: BangKeKhoRow[];
}

const toNum = (v: unknown, def = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : def;
  if (typeof v === "string") {
    const n = Number(v.replace(/[\s.]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : def;
  }
  return def;
};

const optNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = toNum(v, NaN);
  return Number.isNaN(n) ? null : n;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Ô ngày nhập → ISO. Nhận Date (cellDates), số serial Excel, hoặc chuỗi dd/mm/yyyy. */
function toIsoDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Serial Excel (1900 system) → ngày. 25569 = số ngày từ 1899-12-30 tới epoch.
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
  }
  return "";
}

const gonKhoang = (s: string) => s.replace(/\s+/g, " ").trim();

/** Dòng tiêu đề mục → nhóm sổ kho, hoặc null nếu không phải mục. `a` = cột số thứ tự mục (I, II, III…). */
function nhomTuMuc(a: string, b: string): string | null {
  const B = gonKhoang(b).toUpperCase();
  if (B.includes("NHẬP KHẨU")) return "Nguyên liệu nhập khẩu";
  if (B.includes("MUA NGOÀI") || B.includes("NỘI ĐỊA") || B.includes("TRONG NƯỚC")) return "Nguyên liệu mua ngoài";
  if (B.includes("HÀNG TẠM")) return "Hàng tạm";
  // Mục mới kế toán thêm (IV, V…) ⇒ nhóm riêng theo đúng tên, không dồn vào mục trước.
  if (/^[IVX]+\.?$/i.test(a.trim()) && B) {
    const t = gonKhoang(b).toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return null;
}

/** Dòng cộng của MỤC ("TỔNG HÀNG NHẬP KHẨU") — khác dòng cộng khối con ("TỔNG 2 DA"). */
const laTongMuc = (a: string) => /^(TỔNG|CỘNG)\s+HÀNG\b/i.test(gonKhoang(a));

/** Cột R → kho gửi (phần sau chữ "KHO") hoặc ghi chú thường. */
function tachGhiChuKho(v: unknown): { khoGhi: string; ghiChu: string } {
  const t = typeof v === "string" ? gonKhoang(v) : ""; // số ở cột R là công thức phụ, không phải ghi chú
  if (!t) return { khoGhi: "", ghiChu: "" };
  const m = t.match(/\bkho\s+(.+)$/i);
  return m ? { khoGhi: m[1].trim(), ghiChu: "" } : { khoGhi: "", ghiChu: t };
}

const laDongTong = (a: string) => /^(TỔNG|CỘNG|TONG|CONG)\b/i.test(a.trim());
const chiToanSo = (b: string) => /^[\d.,\s]+$/.test(b.trim());

/**
 * Suy SỐ THÁNG từ tên sheet. Nhận: "8", "08", "T8", "Tháng 8", "thang 8"
 * (dùng cho báo cáo bù tháng 8, dữ liệu tháng 9 live…). KHÔNG đoán bừa từ chuỗi
 * có năm ("2026-08" → null để người dùng đặt lại, tránh bắt nhầm "20").
 */
function suyThang(name: string): number | null {
  const s = name.trim();
  let n: number | null = null;
  if (/^\d{1,2}$/.test(s)) n = Number(s);
  else {
    const m = s.match(/th[aá]ng\s*(\d{1,2})/i) || s.match(/^t\s*(\d{1,2})$/i);
    if (m) n = Number(m[1]);
  }
  return n != null && n >= 1 && n <= 12 ? n : null;
}

/**
 * Khối con trong một mục: dòng "TỔNG <tên>" (không phải "TỔNG HÀNG …") ⇒ các dòng từ
 * `tuDong` tới trước dòng cộng thuộc nhóm "<mục> – <tên>". `tuDong` = dòng nhỏ nhất
 * trong các vùng SUM của dòng cộng (chỉ số trong `rows`), null nếu không đọc được.
 */
export type TimDauKhoi = (iDongTong: number) => number | null;

function parseSheet(sheetName: string, rows: unknown[][], timDauKhoi: TimDauKhoi = () => null): BangKeKhoSheet {
  const out: BangKeKhoRow[] = [];
  let category: string | null = null;
  let batDauMuc = 0; // vị trí đầu mục hiện tại trong `out`

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const a = String(row[0] ?? "").trim();
    const b = String(row[1] ?? "").trim();

    if (laDongTong(a)) {
      // dòng "TỔNG …" — kiểm TRƯỚC khi dò mục (chứa "NHẬP KHẨU")
      if (category && !laTongMuc(a)) {
        const ten = gonKhoang(a.replace(/^(TỔNG|CỘNG|TONG|CONG)\s*/i, ""));
        const dau = timDauKhoi(i);
        if (ten && dau != null) {
          const nhomCon = `${category} – ${ten}`;
          for (let k = batDauMuc; k < out.length; k++) if (out[k].rowIndex >= dau && out[k].rowIndex < i) out[k].category = nhomCon;
        }
      }
      continue;
    }
    const nhom = nhomTuMuc(a, b);
    if (nhom) {
      category = nhom;
      batDauMuc = out.length;
      continue;
    }
    if (!category) continue; // chưa tới mục đầu tiên → tiêu đề/cấu hình, bỏ
    if (!b || chiToanSo(b)) continue; // không có tên hàng → bỏ

    out.push({
      ...tachGhiChuKho(row[17]),
      category,
      itemName: b,
      size: String(row[5] ?? "").trim(),
      origin: String(row[4] ?? "").trim(),
      importDate: toIsoDate(row[0]),
      kgPerCtn: optNum(row[2]),
      unitPrice: optNum(row[3]),
      openCtn: toNum(row[8]),
      openKg: toNum(row[9]),
      inCtn: toNum(row[10]),
      inKg: toNum(row[11]),
      outCtn: toNum(row[12]),
      outKg: toNum(row[13]),
      rowIndex: i,
    });
  }

  return {
    sheetName,
    monthNum: suyThang(sheetName),
    tieuDe: gonKhoang(String(rows[0]?.[0] ?? "")),
    rows: out,
  };
}

/** Đọc cả workbook: mỗi sheet → một tháng. Chỉ giữ sheet có ít nhất một dòng hàng. */
export async function parseBangKeKhoFile(file: File): Promise<BangKeKhoSheet[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: BangKeKhoSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // blankrows:false giữ chỉ số `rowIndex` cũ (nằm trong id nạp — KHÔNG được đổi); bản đủ dòng
    // chỉ để dịch chỉ số ⇄ số dòng Excel khi đọc công thức SUM của dòng cộng khối con.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });
    const du = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: true });
    const r0 = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r : 0;
    const dongExcel: number[] = []; // chỉ số trong `rows` → dòng Excel 0-based
    du.forEach((row, k) => {
      if (row.some((v) => v != null && v !== "")) dongExcel.push(k + r0);
    });
    const timDauKhoi: TimDauKhoi = (i) => {
      const r = dongExcel[i];
      if (r == null) return null;
      let min = Infinity;
      for (let c = 6; c <= 16; c++) {
        const f = (ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined)?.f;
        for (const m of f?.matchAll(/[A-Z]+\$?(\d+)\s*:/g) ?? []) min = Math.min(min, Number(m[1]) - 1);
      }
      if (!Number.isFinite(min)) return null;
      const idx = dongExcel.findIndex((x) => x >= min);
      return idx === -1 ? null : idx;
    };
    const parsed = parseSheet(name, rows, timDauKhoi);
    if (parsed.rows.length) sheets.push(parsed);
  }
  return sheets;
}

/** Số kho ghi ở tiêu đề sheet ("…KHO 1500 THÁNG 08…" → "1500"), "" nếu không có. */
export function khoTuTieuDe(tieuDe: string): string {
  return tieuDe.match(/\bKHO\s+(\d{3,5})\b/i)?.[1] ?? "";
}

/** Khóa so khớp tên/mã kho: bỏ dấu, bỏ khoảng trắng + dấu câu, viết hoa ("Á D" → "AD"). */
export const khoaKho = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();

/**
 * Viết tắt kho ở cột R → TÊN kho trong danh mục kho lưu (`storage_locations`).
 * Khớp theo mã (có/không tiền tố "K": "HP" ≡ "KHP") hoặc theo tên ("phước cơ" ≡ "Kho Phước Cơ").
 * Chưa có trong danh mục ⇒ null (màn tự tạo mục mới "Kho <tên>" với mã K<viết tắt>).
 */
export function timKhoTheoGhi(khoGhi: string, danhMuc: { code: string; name: string }[]): string | null {
  const k = khoaKho(khoGhi);
  if (!k) return null;
  for (const d of danhMuc) {
    const ma = khoaKho(d.code);
    const ten = khoaKho(d.name);
    if (ma && (ma === k || ma === `K${k}`)) return d.name;
    if (ten === k || ten === `KHO${k}`) return d.name;
  }
  return null;
}

/** Tên kho mới dựng từ viết tắt chưa có trong danh mục: "phước cơ" → "Kho Phước Cơ". */
export const tenKhoMoi = (khoGhi: string) =>
  `Kho ${gonKhoang(khoGhi)
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase())}`;

/** Năm suy từ tên file ("kho 1000 năm 2026.xlsx" → 2026), mặc định năm hiện tại. */
export function namTuTenFile(fileName: string): number {
  const m = fileName.match(/(20\d{2})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}
