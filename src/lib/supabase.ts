import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Env-gated: chỉ tạo client khi có cấu hình. Giai đoạn đầu chạy localStorage,
// Supabase là bước cutover sau (xem docs kế hoạch).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const hasSupabase = Boolean(supabase);
