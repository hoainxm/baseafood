// ============================================================
// Tên file: src/lib/documentTemplateStorage.ts
// Tên tiếng Việt: Lưu FILE khuôn Word của bộ soạn văn bản trên Supabase Storage
// Description: Upload / download for the private `document-templates` bucket (mig 0091, ba-spec 54 R13).
//              Ai đăng nhập cũng đọc được khuôn; chỉ quản trị tải lên (policy 0091). Không xóa khuôn (R17).
// ============================================================
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { safeFileName } from "./documents";

export const DOCUMENT_TEMPLATE_BUCKET = "document-templates";
export const hasTemplateStorage = Boolean(supabase);
export const DOCUMENT_TEMPLATE_MAX_BYTES = 20 * 1024 * 1024;

export function documentTemplatePath(docType: string, id: string, fileName: string): string {
  return `${IS_DEMO ? SITE_DEMO : "bsf1"}/${docType}/${id}-${safeFileName(fileName)}`;
}

/** Chỉ nhận .docx (khuôn có thẻ) — trả câu lỗi hoặc null. */
export function checkTemplateFile(file: File): string | null {
  if (!/\.docx$/i.test(file.name)) return `File "${file.name}" không phải Word .docx — khuôn phải lưu dạng .docx (Word: Lưu thành → .docx).`;
  if (file.size > DOCUMENT_TEMPLATE_MAX_BYTES) return `File "${file.name}" quá 20 MB.`;
  return null;
}

function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'Máy chủ chưa có kho file "document-templates" — báo quản trị tạo theo hướng dẫn trong migration 0091.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: chỉ quản trị tải khuôn lên được (hoặc chưa chạy migration 0091).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413")) return "File vượt giới hạn dung lượng của kho file.";
  return message;
}

export async function uploadTemplateFile(path: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được khuôn." };
  const { error } = await supabase.storage.from(DOCUMENT_TEMPLATE_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  return error ? { error: explainError(error.message) } : { path };
}

/** Tải nội dung khuôn về máy để điền thẻ. Lỗi ⇒ `{ error }` (bộ soạn báo và dùng khuôn gốc). */
export async function downloadTemplateFile(path: string): Promise<Uint8Array | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — không tải được khuôn đã lưu." };
  const { data, error } = await supabase.storage.from(DOCUMENT_TEMPLATE_BUCKET).download(path);
  if (error || !data) return { error: explainError(error?.message ?? "Không tải được khuôn.") };
  return new Uint8Array(await data.arrayBuffer());
}
