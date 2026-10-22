// ============================================================
// Tên file: src/lib/exportFileStorage.ts
// Tên tiếng Việt: Lưu FILE hồ sơ xuất khẩu (hợp đồng, chứng từ, ảnh đóng cont) trên Supabase Storage
// Description: Upload / signed-URL / remove for the private `export-files` bucket (mig 0075)
// ============================================================
/**
 * Bucket RIÊNG `export-files` (không dùng chung `documents` — R12 / A7): policy của 0075 cho
 * đọc / ghi theo KHU trong đường dẫn — `<site>/export-files/<hợp đồng>/<khu>/<id>-<tên file>`:
 *   - `contract` · `shipment`: chỉ người có export-plans,
 *   - `loading`: người đóng hàng (export-plans.loading) đọc + thêm được,
 *   - `payment`: bước 6 (export-plans.payments).
 * Ảnh (jpg/png/heic…) nén JPEG trước khi tải (khuôn ảnh QC — lib/storage.ts). File khác giữ nguyên.
 * Chưa cấu hình Supabase ⇒ trả lỗi / null, màn chạy chế độ "không bắt file" (EvidenceOptions).
 */
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { compressImage } from "./storage";
import { safeFileName } from "./documents";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { parseExportDemoPack, type ExportDemoPack } from "./exportPlanningDemo";

export { DEMO_PLACEHOLDER_PREFIX };

export const EXPORT_FILE_BUCKET = "export-files";
export const hasExportStorage = Boolean(supabase);
/** Giới hạn 20 MB / file (R12) — bucket tạo cùng cỡ. */
export const EXPORT_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const EXPORT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.zip";

export type ExportFileArea = "contract" | "shipment" | "loading" | "payment";

export function exportFilePath(contractId: string, area: ExportFileArea, id: string, fileName: string): string {
  return `${IS_DEMO ? SITE_DEMO : "bsf1"}/export-files/${contractId || "none"}/${area}/${id}-${safeFileName(fileName)}`;
}

const isImage = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);

/** Kiểm cỡ + loại trước khi tải — trả câu lỗi hoặc null. */
export function checkExportFile(file: File): string | null {
  if (file.size > EXPORT_FILE_MAX_BYTES && !isImage(file)) return `File "${file.name}" quá 20 MB.`;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!EXPORT_FILE_ACCEPT.split(",").includes(`.${ext}`)) return `Loại file ".${ext}" chưa nhận — dùng PDF, ảnh, Word, Excel hoặc zip.`;
  return null;
}

function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'Máy chủ chưa có kho file "export-files" — báo quản trị tạo theo hướng dẫn trong migration 0075.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: tài khoản chưa có quyền tải file hồ sơ xuất khẩu (hoặc chưa chạy migration 0075).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413")) return "File vượt giới hạn dung lượng của kho file.";
  if (m.includes("mime")) return "Kho file không nhận loại file này.";
  return message;
}

/** Tải một file lên ⇒ `{ path, fileName }` hoặc `{ error }`. Ảnh được nén JPEG trước. */
export async function uploadExportFile(path: string, file: File): Promise<{ path: string; fileName: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được file." };
  const image = isImage(file);
  const body: Blob = image ? await compressImage(file) : file;
  const finalPath = image && body !== file ? path.replace(/\.[^./]+$/, "") + ".jpg" : path;
  const { error } = await supabase.storage
    .from(EXPORT_FILE_BUCKET)
    .upload(finalPath, body, { contentType: image && body !== file ? "image/jpeg" : file.type || undefined, upsert: false });
  return error ? { error: explainError(error.message) } : { path: finalPath, fileName: file.name };
}

/** Link xem / tải có hạn (mặc định 10 phút). File giữ chỗ của demo ⇒ null. */
export async function getExportFileUrl(path: string, seconds = 600, downloadName?: string): Promise<string | null> {
  if (!supabase || !path || path.startsWith(DEMO_PLACEHOLDER_PREFIX)) return null;
  const { data } = await supabase.storage
    .from(EXPORT_FILE_BUCKET)
    .createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? null;
}

/** Tải nội dung một file đã đính (đọc Commercial Invoice — R27). File giữ chỗ của demo / lỗi ⇒ null. */
export async function downloadExportFile(path: string): Promise<Blob | null> {
  if (!supabase || !path || path.startsWith(DEMO_PLACEHOLDER_PREFIX)) return null;
  const { data, error } = await supabase.storage.from(EXPORT_FILE_BUCKET).download(path);
  return error ? null : data;
}

/** Gỡ file (tải nhầm / ghi dòng thất bại). */
export async function removeExportFiles(paths: readonly string[]): Promise<boolean> {
  const xs = paths.filter((p) => p && !p.startsWith(DEMO_PLACEHOLDER_PREFIX));
  if (!supabase || !xs.length) return false;
  const { error } = await supabase.storage.from(EXPORT_FILE_BUCKET).remove([...xs]);
  return !error;
}

/* ---------- Gói demo Xuất khẩu (số + file THẬT cho chế độ demo — R14 v4) ---------- */

/** Thư mục cố định của gói trong bucket riêng — tạo lại bộ demo vẫn giữ file. */
export const DEMO_PACK_DIR = `${SITE_DEMO}/export-files/demo-pack`;
export const DEMO_PACK_JSON = `${DEMO_PACK_DIR}/contract/pack.json`;

/** Tải gói demo (JSON) — chưa nối máy chủ / chưa có gói / không có quyền ⇒ null. */
export async function fetchExportDemoPack(): Promise<ExportDemoPack | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(EXPORT_FILE_BUCKET).download(DEMO_PACK_JSON);
  if (error || !data) return null;
  try {
    return parseExportDemoPack(JSON.parse(await data.text()));
  } catch {
    return null;
  }
}

/**
 * Ghi một file của gói vào đúng đường dẫn cố định (gỡ bản cũ trước — bucket không có quyền ghi đè).
 * Không nén ảnh: đường dẫn phải khớp đúng tên trong pack.json.
 */
export async function uploadExportDemoPackFile(path: string, file: Blob, contentType?: string): Promise<string | null> {
  if (!supabase) return "Chưa nối máy chủ — chưa tải được gói demo.";
  if (!path.startsWith(`${DEMO_PACK_DIR}/`)) return "Đường dẫn ngoài thư mục gói demo.";
  await supabase.storage.from(EXPORT_FILE_BUCKET).remove([path]);
  const { error } = await supabase.storage.from(EXPORT_FILE_BUCKET).upload(path, file, { contentType: contentType || (file as File).type || undefined });
  return error ? explainError(error.message) : null;
}

