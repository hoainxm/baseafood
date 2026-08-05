import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/** Mã xí nghiệp (multi-site). Mọi bảng nghiệp vụ đều lọc theo cột xi_nghiep_id này. */
export const SITE_ID =
  (import.meta.env.VITE_SITE_ID as string | undefined)?.trim() || "site-default";
