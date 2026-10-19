// ============================================================
// Tên file: src/lib/documentStorage.ts
// Tên tiếng Việt: Lưu FILE tài liệu công ty (PDF / Word / Excel) trên Supabase Storage
// Description: Upload / signed-URL / remove for the private `documents` bucket (no compression)
// ============================================================
/**
 * Khác `lib/storage.ts` (ảnh QC — nén JPEG, bucket `qc`): file tài liệu giữ NGUYÊN bản,
 * bucket riêng `documents` (private, chủ dự án tạo — spec quan-ly-tai-lieu §6). Quyền đọc
 * file do policy `storage.objects` của mig 0072 quyết (chỉ người xem được tài liệu đó).
 * DB chỉ giữ ĐƯỜNG DẪN. Chưa cấu hình Supabase ⇒ mọi hàm trả null/false, màn ẩn nút tải.
 */
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { safeFileName } from "./documents";

export const DOCUMENT_BUCKET = "documents";

/** true khi có máy chủ ⇒ tải / mở file được. */
export const hasDocumentStorage = Boolean(supabase);

/** `<site>/documents/<id tài liệu>/<id lần ban hành>/<pdf|source>-<tên file>` — demo ⇒ `site-demo/…`. */
export function documentFilePath(documentId: string, versionId: string, kind: "pdf" | "source", fileName: string): string {
  return `${IS_DEMO ? SITE_DEMO : "bsf1"}/documents/${documentId}/${versionId}/${kind}-${safeFileName(fileName)}`;
}

/** Câu báo lỗi dễ hiểu cho người dùng (thiếu bucket / thiếu quyền / quá cỡ). */
function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return "Máy chủ chưa có kho file \"documents\" — báo quản trị tạo theo hướng dẫn trong spec.";
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: tài khoản chưa có quyền tải file tài liệu (hoặc chưa chạy migration 0072).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413")) return "File vượt giới hạn dung lượng của kho file.";
  if (m.includes("mime")) return "Kho file không nhận loại file này.";
  return message;
}

/** Tải một file lên ⇒ `{ path }` hoặc `{ error }` (câu đã dịch). */
export async function uploadDocumentFile(path: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được file." };
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  return error ? { error: explainError(error.message) } : { path };
}

/** Link xem / tải có hạn (mặc định 10 phút) — bucket private. */
export async function getDocumentFileUrl(path: string, seconds = 600, downloadName?: string): Promise<string | null> {
  if (!supabase || !path) return null;
  const { data } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? null;
}

/** Gỡ file vừa tải khi ghi dòng lần ban hành thất bại (không để file mồ côi). */
export async function removeDocumentFiles(paths: readonly string[]): Promise<boolean> {
  const xs = paths.filter(Boolean);
  if (!supabase || !xs.length) return false;
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([...xs]);
  return !error;
}
