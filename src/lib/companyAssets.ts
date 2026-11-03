// ============================================================
// Tên file: src/lib/companyAssets.ts
// Tên tiếng Việt: Lưu logo công ty trên Supabase Storage (bucket `company-assets`)
// Description: Upload / signed-URL / bytes / remove for the company logo (mig 0099, ba-spec 67 R3)
// ============================================================
/**
 * Bucket RIÊNG `company-assets` (0099): ai đăng nhập cũng đọc; ghi / gỡ khi có `company-profile:update`.
 * Logo lưu thành JPEG đã nén (`compressImage`) ⇒ Word / PDF / Excel của chứng từ cùng dùng được một file.
 * Đường dẫn `<site>/logo/logo-<thời điểm>.jpg` — mỗi lần đổi một file mới, file cũ gỡ sau khi lưu xong.
 * Chưa nối máy chủ ⇒ báo lỗi (chứng từ dùng logo đóng gói sẵn).
 */
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { compressImage } from "./storage";

export const COMPANY_ASSET_BUCKET = "company-assets";

export const companyLogoPath = (at = Date.now()) => `${IS_DEMO ? SITE_DEMO : "bsf1"}/logo/logo-${at}.jpg`;

function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'Máy chủ chưa có kho file "company-assets" — báo quản trị tạo theo hướng dẫn trong migration 0099.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: tài khoản chưa có quyền sửa Thông tin công ty (hoặc chưa chạy migration 0099).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413")) return "Ảnh vượt giới hạn dung lượng của kho file.";
  return message;
}

/** Tải logo lên (nén JPEG) ⇒ `{ path }` hoặc `{ error }`. */
export async function uploadCompanyLogo(file: File): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được logo." };
  const body = await compressImage(file);
  const path = companyLogoPath();
  const { error } = await supabase.storage.from(COMPANY_ASSET_BUCKET).upload(path, body, { contentType: "image/jpeg", upsert: false });
  return error ? { error: explainError(error.message) } : { path };
}

/** Link xem / tải có hạn (mặc định 10 phút). */
export async function getCompanyAssetUrl(path: string, seconds = 600, downloadName?: string): Promise<string | null> {
  if (!supabase || !path) return null;
  const { data } = await supabase.storage.from(COMPANY_ASSET_BUCKET).createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  return data?.signedUrl ?? null;
}

/** Bytes của logo cho chứng từ (Word / PDF); lỗi / chưa có ⇒ null (dùng logo đóng gói sẵn). */
export async function fetchCompanyLogoBytes(path: string): Promise<ArrayBuffer | null> {
  const url = await getCompanyAssetUrl(path, 120);
  if (!url) return null;
  return fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
}

/** Gỡ file logo cũ sau khi đã đổi sang file mới. */
export async function removeCompanyAsset(path: string): Promise<boolean> {
  if (!supabase || !path) return false;
  const { error } = await supabase.storage.from(COMPANY_ASSET_BUCKET).remove([path]);
  return !error;
}
