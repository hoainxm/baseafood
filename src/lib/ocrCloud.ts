// ============================================================
// Tên file: src/lib/ocrCloud.ts
// Tên tiếng Việt: Đọc ảnh phiếu nhập bằng OpenAI (qua Edge Function)
// Description: Gửi ảnh đã nén tới `ocr-import-slip`, soát kết quả theo danh mục
// ============================================================
import { supabase } from "./supabase";
import { compressImage } from "./storage";
import type { DongOcr, KetQuaOcr, OcrCatalog } from "./ocr";

/**
 * Bộ nhận diện cloud cho OCR phiếu nhập (QĐ-1 nâng cấp, 2026-10-14). Key OpenAI nằm
 * ở Supabase secrets của Edge Function `ocr-import-slip` — KHÔNG ở trình duyệt. App
 * chỉ gửi ảnh (đã nén ≤1600px) + tên danh mục. Lỗi bất kỳ (chưa đặt key, mất mạng,
 * chưa deploy hàm) ⇒ `lib/ocr.ts` quay về Tesseract chạy trong máy.
 *
 * Kết quả máy trả về KHÔNG tin thẳng: tên đại lý / loại NL phải khớp danh mục, kg phải
 * trong khoảng hợp lý, ngày phải là ngày thật — sai thì bỏ ô đó (người dùng tự điền).
 */

export const OCR_FUNCTION = "ocr-import-slip";

/** Có Supabase ⇒ thử đọc bằng OpenAI trước. */
export const hasCloudOcr = Boolean(supabase);

/** Hình kết quả thô của Edge Function (đã qua structured outputs nhưng chưa soát). */
export interface CloudOcrResponse {
  text?: unknown;
  date?: unknown;
  supplier?: unknown;
  licensePlate?: unknown;
  driverName?: unknown;
  workshop?: unknown;
  lines?: unknown;
  scraps?: unknown;
  totalKg?: unknown;
  warnings?: unknown;
  /** Chữ y như trên phiếu của từng ô đầu chuyến. */
  raw?: unknown;
  model?: unknown;
}

/** Giá hợp lý cho một kg nguyên liệu (đ). Ngoài khoảng ⇒ coi như máy đọc nhầm, bỏ. */
const MIN_PRICE = 1_000;
const MAX_PRICE = 5_000_000;

const normalize = (x: string) => x.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
/** Cùng luật với `normalizePlate` ở Nhập hàng: "72c-166.03" ≡ "72C16603". */
const plateKey = (x: string) => x.replace(/[\s.\-']/g, "").toUpperCase();
/** Bỏ dấu để so chữ đầu ("Hồng" ↔ "H"). */
const plain = (x: string) =>
  normalize(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

/**
 * Tên viết tắt chữ đầu trên phiếu tay khớp tên đầy đủ: cùng số từ, mỗi từ hoặc trùng
 * (bỏ dấu) hoặc là MỘT chữ cái (có thể kèm ".") trùng chữ đầu từ tương ứng, và ít nhất
 * một từ trùng nguyên. "H Phú" ↔ "Hồng Phú", "Phạm H Khánh" ↔ "Phạm Hoàng Khánh"
 * (đối chiếu phiếu 22/8/2026).
 */
export function matchesAbbreviation(short: string, full: string): boolean {
  const a = plain(short).replace(/\./g, " ").split(" ").filter(Boolean);
  const b = plain(full).split(" ").filter(Boolean);
  if (a.length !== b.length || !a.length) return false;
  let whole = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) whole++;
    else if (!(a[i].length === 1 && b[i].startsWith(a[i]))) return false;
  }
  return whole > 0;
}

/** Khớp tên trong danh sách: trùng hẳn trước, rồi viết tắt — chỉ nhận khi DUY NHẤT một tên khớp. */
function findByName(raw: string, names: string[]): string | undefined {
  const exact = names.find((n) => normalize(n) === normalize(raw));
  if (exact) return exact;
  const abbr = [...new Set(names.filter((n) => matchesAbbreviation(raw, n)))];
  return abbr.length === 1 ? abbr[0] : undefined;
}

/** Dòng danh mục gửi lên: "mã · tên" nếu có mã (phiếu hay ghi mã số đại lý). */
export function buildCatalogPayload(catalog: OcrCatalog) {
  return {
    suppliers: catalog.suppliers.map(
      (s) => `${s.code ? `${s.code} · ` : ""}${s.name}${s.alias && normalize(s.alias) !== normalize(s.name) ? ` (${s.alias})` : ""}`,
    ),
    materialTypes: catalog.materialTypes.map((m) => m.name),
    knownPlates: catalog.knownPlates ?? [],
    knownDrivers: catalog.knownDrivers ?? [],
    workshops: catalog.workshops ?? [],
    supplierHistory: catalog.supplierHistory ?? [],
    scrapTypes: catalog.scrapTypes ?? [],
  };
}

/** Biển số: phải có chữ số, 5–12 ký tự sau khi bỏ dấu; trùng xe đã ghi ⇒ cách viết cũ. */
function cleanPlate(raw: unknown, known: string[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  const key = plateKey(raw);
  if (key.length < 5 || key.length > 12 || !/\d/.test(key) || !/^[A-Z0-9Đ]+$/.test(key)) return undefined;
  return known.find((p) => plateKey(p) === key) ?? raw.trim().toUpperCase();
}

/** Tài xế: 2–60 ký tự, có chữ cái; trùng tên đã ghi (không phân hoa thường) ⇒ tên cũ. */
function cleanDriver(raw: unknown, known: string[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60 || !/\p{L}/u.test(name)) return undefined;
  return findByName(name, known) ?? name;
}

/** Chữ chép từ phiếu: chỉ nhận chuỗi, gọn khoảng trắng, cắt 120 ký tự (chỉ để HIỂN THỊ). */
const rawText = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().replace(/\s+/g, " ").slice(0, 120);
  return t || undefined;
};

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Soát kết quả cloud theo danh mục rồi ghép với parser chữ (`parsed` = parseOcrText
 * trên toàn văn cloud): ô nào cloud bỏ trống/sai thì lấy của parser.
 */
export function mergeCloudResult(raw: CloudOcrResponse, parsed: KetQuaOcr, catalog: OcrCatalog): KetQuaOcr {
  const supplierByName = new Map<string, string>();
  for (const s of catalog.suppliers) {
    supplierByName.set(normalize(s.name), s.name);
    if (s.code) supplierByName.set(normalize(`${s.code} · ${s.name}`), s.name);
    if (s.alias) supplierByName.set(normalize(s.alias), s.name);
  }
  // Nhãn đúng như đã gửi lên ("mã · tên (tên hóa đơn)") — máy hay chép lại nguyên nhãn.
  for (const [i, label] of buildCatalogPayload(catalog).suppliers.entries())
    supplierByName.set(normalize(label), catalog.suppliers[i].name);
  const materialByName = new Map(catalog.materialTypes.map((m) => [normalize(m.name), m.name]));

  const supplier =
    typeof raw.supplier === "string"
      ? (supplierByName.get(normalize(raw.supplier)) ??
        findByName(raw.supplier, catalog.suppliers.map((s) => s.name)))
      : undefined;
  const date = typeof raw.date === "string" && isRealDate(raw.date) ? raw.date : undefined;

  const lines: DongOcr[] = [];
  for (const l of Array.isArray(raw.lines) ? raw.lines : []) {
    const name = typeof l?.materialType === "string" ? materialByName.get(normalize(l.materialType)) : undefined;
    const kg = typeof l?.kg === "number" ? Math.round(l.kg * 1000) / 1000 : NaN;
    if (!name || !(kg > 0 && kg <= 100000)) continue;
    const price = typeof l?.unitPrice === "number" ? Math.round(l.unitPrice) : NaN;
    const unitPrice = price >= MIN_PRICE && price <= MAX_PRICE ? price : null;
    if (!lines.some((x) => x.materialType === name && x.kg === kg))
      lines.push({ materialType: name, kg, unitPrice, raw: rawText(l?.raw) });
  }
  const workshop =
    typeof raw.workshop === "string" ? (catalog.workshops ?? []).find((w) => normalize(w) === normalize(String(raw.workshop))) : undefined;

  const scrapNames = catalog.scrapTypes ?? [];
  const scraps: { name: string; kg: number }[] = [];
  for (const x of Array.isArray(raw.scraps) ? raw.scraps : []) {
    const name = typeof x?.name === "string" ? scrapNames.find((n) => normalize(n) === normalize(x.name)) : undefined;
    const kg = typeof x?.kg === "number" ? Math.round(x.kg * 1000) / 1000 : NaN;
    if (name && kg > 0 && kg <= 100000 && !scraps.some((y) => y.name === name)) scraps.push({ name, kg });
  }
  const totalKg = typeof raw.totalKg === "number" && raw.totalKg > 0 && raw.totalKg <= 1_000_000 ? raw.totalKg : undefined;
  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .filter((w): w is string => typeof w === "string" && w.trim() !== "")
    .map((w) => w.trim().slice(0, 200))
    .slice(0, 5);
  // Phiếu tự có dòng tổng ⇒ tự đối chiếu: lệch là có số đọc nhầm (hay gặp: dấu nghìn).
  const sumKg = Math.round(lines.reduce((t, l) => t + l.kg, 0) * 1000) / 1000;
  if (totalKg != null && lines.length && Math.abs(sumKg - totalKg) > 0.5)
    warnings.unshift(`Tổng các dòng đọc được ${sumKg.toLocaleString("vi-VN")} kg khác tổng ghi trên phiếu ${totalKg.toLocaleString("vi-VN")} kg — soát lại từng số.`);

  return {
    ...parsed,
    supplier: supplier ?? parsed.supplier,
    date: date ?? parsed.date,
    lines: lines.length ? lines : parsed.lines,
    licensePlate: cleanPlate(raw.licensePlate, catalog.knownPlates ?? []) ?? parsed.licensePlate,
    driverName: cleanDriver(raw.driverName, catalog.knownDrivers ?? []) ?? parsed.driverName,
    workshop: workshop ?? parsed.workshop,
    scraps,
    totalKg,
    warnings,
    rawHeader: (() => {
      const r = (raw.raw ?? {}) as Record<string, unknown>;
      return {
        date: rawText(r.date),
        supplier: rawText(r.supplier),
        workshop: rawText(r.workshop),
        licensePlate: rawText(r.licensePlate),
        driverName: rawText(r.driverName),
      };
    })(),
    materialTypes: [...new Set([...lines.map((l) => l.materialType), ...parsed.materialTypes])],
    kgValues: [...new Set([...lines.map((l) => l.kg), ...parsed.kgValues])],
  };
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được ảnh"));
    reader.readAsDataURL(blob);
  });

/** Gọi Edge Function. Ném lỗi (để `lib/ocr.ts` quay về Tesseract) khi hàm báo lỗi. */
export async function requestCloudOcr(file: File | Blob, catalog: OcrCatalog): Promise<CloudOcrResponse> {
  if (!supabase) throw new Error("Chưa cấu hình Supabase");
  const asFile = file instanceof File ? file : new File([file], "slip.jpg", { type: file.type || "image/jpeg" });
  const image = await blobToDataUrl(await compressImage(asFile));
  const { data, error } = await supabase.functions.invoke<CloudOcrResponse>(OCR_FUNCTION, {
    body: { image, year: new Date().getFullYear(), ...buildCatalogPayload(catalog) },
  });
  if (error || !data || typeof data.text !== "string") throw error ?? new Error("Kết quả OCR rỗng");
  return data;
}
