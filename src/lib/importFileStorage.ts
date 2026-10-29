// ============================================================
// Tên file: src/lib/importFileStorage.ts
// Tên tiếng Việt: Lưu FILE hồ sơ nhập khẩu (hợp đồng, chứng từ từng lần nhập) trên Supabase Storage
// Description: Upload / signed-URL / remove for the private `import-files` bucket (mig 0082)
// ============================================================
/**
 * Bucket RIÊNG `import-files` (ba-spec 45 R13): policy của 0082 cho đọc / thêm / gỡ khi có quyền
 * `import-plans` (thủ kho `.receiving` KHÔNG đọc chứng từ). Đường dẫn
 * `<site>/import-files/<hợp đồng>/<id>-<tên file>`. Ảnh nén JPEG trước khi tải (như Xuất khẩu).
 * Chưa cấu hình Supabase ⇒ trả lỗi / null; mục chứng từ vẫn ghi số / ngày, chưa đính được file.
 */
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { compressImage } from "./storage";
import { safeFileName } from "./documents";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";

export { DEMO_PLACEHOLDER_PREFIX };

export const IMPORT_FILE_BUCKET = "import-files";
export const hasImportStorage = Boolean(supabase);
export const IMPORT_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";

export function importFilePath(contractId: string, id: string, fileName: string): string {
  return `${IS_DEMO ? SITE_DEMO : "bsf1"}/import-files/${contractId || "none"}/${id}-${safeFileName(fileName)}`;
}

const isImage = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);

/** Kiểm cỡ + loại trước khi tải — trả câu lỗi hoặc null. */
export function checkImportFile(file: File): string | null {
  if (file.size > IMPORT_FILE_MAX_BYTES && !isImage(file)) return `File "${file.name}" quá 20 MB.`;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!IMPORT_FILE_ACCEPT.split(",").includes(`.${ext}`)) return `Loại file ".${ext}" chưa nhận — dùng PDF, ảnh, Word hoặc Excel.`;
  return null;
}

function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'Máy chủ chưa có kho file "import-files" — báo quản trị tạo theo hướng dẫn trong migration 0082.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: tài khoản chưa có quyền tải file hồ sơ nhập khẩu (hoặc chưa chạy migration 0082).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413")) return "File vượt giới hạn dung lượng của kho file.";
  if (m.includes("mime")) return "Kho file không nhận loại file này.";
  return message;
}

/** Tải một file lên ⇒ `{ path, fileName }` hoặc `{ error }`. Ảnh được nén JPEG trước. */
export async function uploadImportFile(path: string, file: File): Promise<{ path: string; fileName: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được file." };
  const image = isImage(file);
  const body: Blob = image ? await compressImage(file) : file;
  const finalPath = image && body !== file ? path.replace(/\.[^./]+$/, "") + ".jpg" : path;
  const { error } = await supabase.storage
    .from(IMPORT_FILE_BUCKET)
    .upload(finalPath, body, { contentType: image && body !== file ? "image/jpeg" : file.type || undefined, upsert: false });
  return error ? { error: explainError(error.message) } : { path: finalPath, fileName: file.name };
}

/** Link xem / tải có hạn (mặc định 10 phút). File giữ chỗ của demo ⇒ null. */
export async function getImportFileUrl(path: string, seconds = 600, downloadName?: string): Promise<string | null> {
  if (!supabase || !path || path.startsWith(DEMO_PLACEHOLDER_PREFIX)) return null;
  const { data } = await supabase.storage
    .from(IMPORT_FILE_BUCKET)
    .createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? null;
}

/** Gỡ file (tải nhầm / gỡ khỏi chứng từ). */
export async function removeImportFiles(paths: readonly string[]): Promise<boolean> {
  const xs = paths.filter((p) => p && !p.startsWith(DEMO_PLACEHOLDER_PREFIX));
  if (!supabase || !xs.length) return false;
  const { error } = await supabase.storage.from(IMPORT_FILE_BUCKET).remove([...xs]);
  return !error;
}
