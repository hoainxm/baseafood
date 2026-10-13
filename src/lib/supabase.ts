// ============================================================
// Tên file: src/lib/supabase.ts
// Tên tiếng Việt tương đương: Khởi tạo Supabase Client Connection
// Description: Supabase client initialization and environment variables handling
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LA_DEMO, SITE_DEMO } from "@/lib/cheDo";

/**
 * Client Supabase — dùng chung project "baseafood" với SDFactory.
 *
 * Chỉ tạo client khi có ĐỦ url + anon key. Thiếu một trong hai thì app chạy
 * hoàn toàn bằng localStorage (xem src/lib/repo.ts) — không crash, không cần
 * mạng, dùng được ngay ở xưởng.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim();

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const hasSupabase = Boolean(supabase);

/**
 * Client PHỤ dùng một lần — KHÔNG lưu phiên, KHÔNG tự refresh. Để admin tạo tài
 * khoản (signUp) mà không đá văng phiên đăng nhập của chính admin trên client
 * chính. Tự huỷ khi hết tham chiếu.
 */
export function taoClientTam(): SupabaseClient | null {
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Mã xí nghiệp THẬT (multi-site) — hồ sơ đăng nhập (`user_profiles` do auth ghi) luôn ở đây. */
export const SITE_ID_THAT =
  (import.meta.env.VITE_SITE_ID as string | undefined)?.trim() || "site-default";

/**
 * Site của SỐ LIỆU nghiệp vụ: mọi bảng đọc/ghi qua repo lọc theo cột site_id này.
 * Chế độ demo (lib/cheDo.ts) ⇒ `site-demo` — cả app chạy trên bộ số trình diễn.
 */
export const SITE_ID = LA_DEMO ? SITE_DEMO : SITE_ID_THAT;
