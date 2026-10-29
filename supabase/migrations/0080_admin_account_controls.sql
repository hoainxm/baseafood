-- ============================================================
-- Baseafood MES — 0080: ADMIN QUẢN TÀI KHOẢN ĐĂNG NHẬP — đặt lại mật khẩu · tạm ngưng · trạng thái
--
-- Vì sao (2026-10-29, docs/app-map/05-bao-mat-phan-quyen.md § Tài khoản):
--   - Người dùng quên mật khẩu ⇒ trước đây admin phải vào Supabase Dashboard. Email
--     đăng nhập là email TỔNG HỢP `<username>@bsf1.vn` (không có hòm thư thật) nên
--     "quên mật khẩu qua email" KHÔNG dùng được ⇒ admin đặt mật khẩu tạm trên app.
--   - Người nghỉ việc ⇒ trước đây chỉ có cách xóa vai trò (vẫn đăng nhập được, thấy
--     "Chưa được cấp quyền") hoặc xóa tài khoản (mất dấu người ghi). Giờ TẠM NGƯNG:
--     giữ hồ sơ, vai trò, lịch sử; không đăng nhập được; mở lại được.
--
-- Làm gì — 3 hàm `security definer`, CHỈ admin (kiểm `la_admin()` bên trong, 0057),
-- không admin nào tự tạm ngưng / tự đặt lại mật khẩu mình (dùng "Đổi mật khẩu"):
--   list_auth_account_status()  mỗi tài khoản: lần đăng nhập cuối, đang tạm ngưng,
--       đang chờ đổi mật khẩu tạm — để màn Người dùng hiện cột Trạng thái.
--   admin_reset_user_password(user, mật khẩu, bắt đổi)  đặt mật khẩu mới (bcrypt như
--       GoTrue), gắn cờ `must_change_password` vào user metadata (app bắt đặt mật khẩu
--       riêng ở lần vào tới), đăng xuất mọi máy của người đó (xóa phiên + refresh token).
--   admin_set_account_disabled(user, tạm ngưng)  `banned_until = 'infinity'` (GoTrue từ
--       chối đăng nhập + làm mới phiên) và đăng xuất mọi máy; mở lại ⇒ `banned_until = null`.
-- Phiên đang mở còn dùng access token cũ tối đa ~1 giờ (hạn JWT) rồi bị văng — RLS
-- KHÔNG đổi (siết tức thì phải sửa `co_vai_tro()` — 🔴, chưa làm).
--
-- KHÔNG đổi bảng, cột, policy nào. Idempotent (`create or replace`). Mật khẩu không
-- ghi ra đâu ngoài `auth.users.encrypted_password` (đã băm); app ghi nhật ký KHÔNG kèm mật khẩu.
-- Cần `pgcrypto` (Supabase có sẵn ở schema `extensions`).
-- ⚠ Chạy TRƯỚC hoặc cùng lúc deploy bản app có nút (thiếu hàm ⇒ màn Người dùng ẩn cột
-- Trạng thái, bấm nút báo "máy chủ chưa chạy 0080", không hỏng gì khác).
-- ROLLBACK cuối file.
-- ============================================================

create or replace function public.list_auth_account_status()
returns table (
  id text,
  last_sign_in_at timestamptz,
  is_disabled boolean,
  must_change_password boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được xem trạng thái tài khoản' using errcode = '42501';
  end if;
  return query
    select
      u.id::text,
      u.last_sign_in_at,
      coalesce(u.banned_until > now(), false),
      coalesce((u.raw_user_meta_data ->> 'must_change_password')::boolean, false)
    from auth.users u;
end;
$$;

create or replace function public.admin_reset_user_password(
  p_user_id text,
  p_new_password text,
  p_require_change boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được đặt lại mật khẩu' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid())::text then
    raise exception 'Mật khẩu của chính bạn đổi ở menu tài khoản (Đổi mật khẩu)' using errcode = '22023';
  end if;
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Mật khẩu tối thiểu 6 ký tự' using errcode = '22023';
  end if;
  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('must_change_password', coalesce(p_require_change, true)),
         updated_at = now()
   where id::text = p_user_id;
  if not found then
    raise exception 'Không tìm thấy tài khoản đăng nhập' using errcode = 'P0002';
  end if;
  -- Đăng xuất mọi máy của người đó (máy để quên, máy người khác đang cầm).
  delete from auth.refresh_tokens where user_id::text = p_user_id;
  delete from auth.sessions where user_id::text = p_user_id;
end;
$$;

create or replace function public.admin_set_account_disabled(p_user_id text, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được tạm ngưng tài khoản' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid())::text then
    raise exception 'Không tự tạm ngưng tài khoản đang dùng' using errcode = '22023';
  end if;
  update auth.users
     set banned_until = case when p_disabled then 'infinity'::timestamptz else null end,
         updated_at = now()
   where id::text = p_user_id;
  if not found then
    raise exception 'Không tìm thấy tài khoản đăng nhập' using errcode = 'P0002';
  end if;
  if p_disabled then
    delete from auth.refresh_tokens where user_id::text = p_user_id;
    delete from auth.sessions where user_id::text = p_user_id;
  end if;
end;
$$;

revoke all on function public.list_auth_account_status() from public, anon;
revoke all on function public.admin_reset_user_password(text, text, boolean) from public, anon;
revoke all on function public.admin_set_account_disabled(text, boolean) from public, anon;
grant execute on function public.list_auth_account_status() to authenticated;
grant execute on function public.admin_reset_user_password(text, text, boolean) to authenticated;
grant execute on function public.admin_set_account_disabled(text, boolean) to authenticated;

-- KIỂM sau khi chạy (chỉ đọc):
--   select proname, prosecdef from pg_proc
--    where proname in ('list_auth_account_status','admin_reset_user_password','admin_set_account_disabled');
--   -- 3 dòng, prosecdef = true. SQL Editor không có auth.uid() ⇒ la_admin() = false ⇒ gọi hàm báo 42501 — đúng.
--   select count(*) from auth.users where banned_until is not null;   -- trước khi dùng: 0

-- ============================================================
-- ROLLBACK — bỏ 3 hàm (app ẩn cột Trạng thái, nút báo thiếu hàm).
-- Tài khoản ĐANG tạm ngưng vẫn bị chặn ⇒ mở lại TRƯỚC khi bỏ hàm, hoặc chạy:
--   update auth.users set banned_until = null where banned_until = 'infinity';
--   drop function if exists public.admin_set_account_disabled(text, boolean);
--   drop function if exists public.admin_reset_user_password(text, text, boolean);
--   drop function if exists public.list_auth_account_status();
-- ============================================================
