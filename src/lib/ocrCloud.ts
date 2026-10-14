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
  model?: unknown;
}

/** Giá hợp lý cho một kg nguyên liệu (đ). Ngoài khoảng ⇒ coi như máy đọc nhầm, bỏ. */
const MIN_PRICE = 1_000;
const MAX_PRICE = 5_000_000;

const normalize = (x: string) => x.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
/** Cùng luật với `normalizePlate` ở Nhập hàng: "72c-166.03" ≡ "72C16603". */
const plateKey = (x: string) => x.replace(/[\s.\-']/g, "").toUpperCase();

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
  return known.find((d) => normalize(d) === normalize(name)) ?? name;
}

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

  const supplier = typeof raw.supplier === "string" ? supplierByName.get(normalize(raw.supplier)) : undefined;
  const date = typeof raw.date === "string" && isRealDate(raw.date) ? raw.date : undefined;

  const lines: DongOcr[] = [];
  for (const l of Array.isArray(raw.lines) ? raw.lines : []) {
    const name = typeof l?.materialType === "string" ? materialByName.get(normalize(l.materialType)) : undefined;
    const kg = typeof l?.kg === "number" ? Math.round(l.kg * 1000) / 1000 : NaN;
    if (!name || !(kg > 0 && kg <= 100000)) continue;
    const price = typeof l?.unitPrice === "number" ? Math.round(l.unitPrice) : NaN;
    const unitPrice = price >= MIN_PRICE && price <= MAX_PRICE ? price : null;
    if (!lines.some((x) => x.materialType === name && x.kg === kg)) lines.push({ materialType: name, kg, unitPrice });
  }
  const workshop =
    typeof raw.workshop === "string" ? (catalog.workshops ?? []).find((w) => normalize(w) === normalize(String(raw.workshop))) : undefined;

  return {
    ...parsed,
    supplier: supplier ?? parsed.supplier,
    date: date ?? parsed.date,
    lines: lines.length ? lines : parsed.lines,
    licensePlate: cleanPlate(raw.licensePlate, catalog.knownPlates ?? []) ?? parsed.licensePlate,
    driverName: cleanDriver(raw.driverName, catalog.knownDrivers ?? []) ?? parsed.driverName,
    workshop: workshop ?? parsed.workshop,
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
