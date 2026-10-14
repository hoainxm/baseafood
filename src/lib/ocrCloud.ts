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
  lines?: unknown;
  model?: unknown;
}

const normalize = (x: string) => x.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

/** Dòng danh mục gửi lên: "mã · tên" nếu có mã (phiếu hay ghi mã số đại lý). */
export function buildCatalogPayload(catalog: OcrCatalog) {
  return {
    suppliers: catalog.suppliers.map((s) => (s.code ? `${s.code} · ${s.name}` : s.name)),
    materialTypes: catalog.materialTypes.map((m) => m.name),
  };
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
  }
  const materialByName = new Map(catalog.materialTypes.map((m) => [normalize(m.name), m.name]));

  const supplier = typeof raw.supplier === "string" ? supplierByName.get(normalize(raw.supplier)) : undefined;
  const date = typeof raw.date === "string" && isRealDate(raw.date) ? raw.date : undefined;

  const lines: DongOcr[] = [];
  for (const l of Array.isArray(raw.lines) ? raw.lines : []) {
    const name = typeof l?.materialType === "string" ? materialByName.get(normalize(l.materialType)) : undefined;
    const kg = typeof l?.kg === "number" ? Math.round(l.kg * 1000) / 1000 : NaN;
    if (!name || !(kg > 0 && kg <= 100000)) continue;
    if (!lines.some((x) => x.materialType === name && x.kg === kg)) lines.push({ materialType: name, kg });
  }

  return {
    ...parsed,
    supplier: supplier ?? parsed.supplier,
    date: date ?? parsed.date,
    lines: lines.length ? lines : parsed.lines,
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
