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
 * Nhóm lấy từ dòng tiêu đề mục ("I HÀNG NHẬP KHẨU" / "II HÀNG MUA NGOÀI"); dòng
 * "TỔNG …"/"CỘNG …" và các dòng trước mục đầu tiên đều bỏ. KHÔNG chép tồn cuối
 * của file (file gốc dồn kỳ sai ở dòng tổng) — chỉ lấy tồn đầu + nhập + xuất.
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
}

export interface BangKeKhoSheet {
  sheetName: string;
  monthNum: number | null; // suy từ tên sheet nếu là số tháng 1..12
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

/** Dòng tiêu đề mục → nhóm sổ kho, hoặc null nếu không phải mục. */
function nhomTuMuc(b: string): string | null {
  const B = b.toUpperCase();
  if (B.includes("NHẬP KHẨU")) return "Nguyên liệu nhập khẩu";
  if (B.includes("MUA NGOÀI") || B.includes("NỘI ĐỊA") || B.includes("TRONG NƯỚC")) return "Nguyên liệu mua ngoài";
  return null;
}

const laDongTong = (a: string) => /^(TỔNG|CỘNG|TONG|CONG)\b/i.test(a.trim());
const chiToanSo = (b: string) => /^[\d.,\s]+$/.test(b.trim());

function parseSheet(sheetName: string, rows: unknown[][]): BangKeKhoSheet {
  const out: BangKeKhoRow[] = [];
  let category: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const a = String(row[0] ?? "").trim();
    const b = String(row[1] ?? "").trim();

    if (laDongTong(a)) continue; // dòng "TỔNG …" — kiểm TRƯỚC khi dò mục (chứa "NHẬP KHẨU")
    const nhom = nhomTuMuc(b);
    if (nhom) {
      category = nhom;
      continue;
    }
    if (!category) continue; // chưa tới mục đầu tiên → tiêu đề/cấu hình, bỏ
    if (!b || chiToanSo(b)) continue; // không có tên hàng → bỏ

    out.push({
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

  const mn = Number(sheetName);
  return {
    sheetName,
    monthNum: Number.isInteger(mn) && mn >= 1 && mn <= 12 ? mn : null,
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
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });
    const parsed = parseSheet(name, rows);
    if (parsed.rows.length) sheets.push(parsed);
  }
  return sheets;
}

/** Năm suy từ tên file ("kho 1000 năm 2026.xlsx" → 2026), mặc định năm hiện tại. */
export function namTuTenFile(fileName: string): number {
  const m = fileName.match(/(20\d{2})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}
