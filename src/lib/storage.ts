// ============================================================
// Tên file: src/lib/storage.ts
// Tên tiếng Việt: Lưu ẢNH qua Supabase Storage (QĐ-8 — ảnh QC, nền OCR)
// Description: Client image storage — compress → upload → signed URL
// ============================================================
import { supabase } from "./supabase";
import { uid } from "./db";

/**
 * Lưu ảnh sổ sách (ảnh QC chấm điểm, sau này ảnh phiếu tay OCR) trên **Supabase
 * Storage** — cùng project đang chạy, KHÔNG cần dịch vụ / key mới. Bucket để
 * PRIVATE, xem qua **signed URL** có hạn. DB chỉ giữ ĐƯỜNG DẪN (path), file nằm ở
 * Storage. Hàm thuần, gọi trực tiếp từ màn (như `lib/audit.ts`), KHÔNG qua repo
 * vì đây là FILE chứ không phải dòng dữ liệu nghiệp vụ. Xem docs/ops/supabase-storage.md.
 *
 * Chưa cấu hình Supabase (`!supabase`, chế độ localStorage ở xưởng): mọi hàm trả
 * null/false — màn ẩn nút ảnh, KHÔNG vỡ.
 */

/** Bucket ảnh dùng chung (chủ dự án đã tạo trên Supabase, private + RLS authenticated). */
const BUCKET = "qc";

/** true khi có Supabase → mới hiện nút chụp/chọn ảnh. */
export const coLuuAnh = Boolean(supabase);

/** Path khóa file trong bucket: bsf1/qc/<yyyy>/<mm>/<uid>.jpg (chia tháng cho đỡ phình). */
function duongDanAnh(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `bsf1/qc/${yyyy}/${mm}/${uid()}.jpg`;
}

/**
 * Nén ảnh phía client trước khi tải (tiết kiệm băng thông + quota) — thu về ≤ maxW
 * px, JPEG chất lượng ~0.72. Trình duyệt cũ / lỗi giải mã → trả nguyên file gốc để
 * vẫn tải được (ảnh là phụ, ưu tiên không mất).
 */
async function nenAnh(file: File, maxW = 1600, chatLuong = 0.72): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function")
      return file;
    const img = await createImageBitmap(file);
    const scale = Math.min(1, maxW / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = new OffscreenCanvas(w, h);
    const ctx = cv.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    return await cv.convertToBlob({ type: "image/jpeg", quality: chatLuong });
  } catch {
    return file; // lỗi nén → tải nguyên bản
  }
}

/** Tải một ảnh lên → trả PATH để lưu vào DB (null nếu không có Supabase / lỗi tải). */
export async function taiAnhLen(file: File): Promise<string | null> {
  if (!supabase) return null;
  const path = duongDanAnh();
  const blob = await nenAnh(file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  return error ? null : path;
}

/** Xem ảnh: bucket private → tạo signed URL có hạn (mặc định 1 giờ). */
export async function urlAnh(path: string, hanGiay = 3600): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, hanGiay);
  return data?.signedUrl ?? null;
}

/** Xóa một ảnh tải nhầm (RLS delete cho authenticated). */
export async function xoaAnh(path: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return !error;
}
