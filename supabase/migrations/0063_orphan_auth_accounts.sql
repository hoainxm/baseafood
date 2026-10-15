-- ============================================================
-- Baseafood MES — 0063: TÀI KHOẢN ĐĂNG NHẬP CHƯA CÓ HỒ SƠ (mồ côi) — admin thấy + xử lý
--
-- Vì sao (sự cố 2026-10-15, docs/app-map/05-bao-mat-phan-quyen.md): hai người
-- có 2 tài khoản Auth (`nnttruc@` / `nnt.truc@`…). Hồ sơ vai trò gắn tài khoản
-- này, người dùng lại đăng nhập tài khoản kia ⇒ không vai trò, RLS 0057 chặn mọi
-- bảng. App tự tạo hồ sơ hụt (trùng `username` — index duy nhất
-- `nguoi_dung_username_idx (site_id, username)`) mà không ai biết; màn Người dùng
-- chỉ đọc `user_profiles` nên admin KHÔNG thấy tài khoản mồ côi. Sửa phải chạy SQL tay.
--
-- Làm gì — 2 hàm, CHỈ admin gọi được (kiểm `la_admin()` bên trong, 0057):
--   list_orphan_auth_accounts()  tài khoản auth.users chưa có dòng user_profiles,
--       kèm hồ sơ GỢI Ý (cùng username, hoặc trùng khi bỏ dấu chấm) — để admin
--       chọn "gắn hồ sơ có sẵn" hay "tạo hồ sơ mới".
--   relink_user_profile(from, to)  chuyển MỘT hồ sơ sang tài khoản đúng trong một
--       câu UPDATE (giữ vai trò, họ tên, username) + chuyển luôn quyền riêng
--       `user_permissions` (0062). Từ chối nếu tài khoản đích không có / đã có hồ sơ.
-- `security definer` vì phải đọc schema `auth` (client không đọc được); search_path
-- cố định; revoke khỏi public/anon, chỉ grant authenticated, và tự kiểm admin.
--
-- KHÔNG đổi bảng, cột, policy nào đang có. Mức độ rủi ro: 🔴 (hàm security definer
-- đọc auth.users) — chủ dự án duyệt trước khi chạy. Idempotent (`create or replace`).
-- ⚠ Chạy TRƯỚC khi deploy bản app gọi 2 hàm này (thiếu hàm ⇒ màn Người dùng chỉ
-- ẩn mục "tài khoản chưa có hồ sơ", không hỏng gì khác).
-- ROLLBACK cuối file.
-- ============================================================

create or replace function public.list_orphan_auth_accounts()
returns table (
  id text,
  email text,
  username text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  suggested_profile_id text,
  suggested_profile_username text,
  suggested_profile_full_name text,
  suggested_profile_roles text,
  suggested_account_last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được xem tài khoản chưa có hồ sơ' using errcode = '42501';
  end if;
  return query
    with orphan as (
      select
        u.id::text as id,
        u.email::text as email,
        lower(coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(u.email::text, '@', 1))) as username,
        coalesce(u.raw_user_meta_data ->> 'ho_ten', '') as full_name, -- naming-ok: khóa metadata Auth đã lưu (0006)
        u.created_at,
        u.last_sign_in_at
      from auth.users u
      where not exists (select 1 from public.user_profiles p where p.id = u.id::text)
    )
    select
      o.id, o.email, o.username, o.full_name, o.created_at, o.last_sign_in_at,
      s.id, s.username, s.full_name, s.roles, su.last_sign_in_at
    from orphan o
    left join lateral (
      select p.id, p.username, p.full_name, p.roles
      from public.user_profiles p
      where p.site_id = 'bsf1'
        and replace(lower(p.username), '.', '') = replace(o.username, '.', '')
      order by (lower(p.username) = o.username) desc
      limit 1
    ) s on true
    left join auth.users su on su.id::text = s.id
    order by o.last_sign_in_at desc nulls last;
end;
$$;

create or replace function public.relink_user_profile(p_from text, p_to text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được chuyển hồ sơ' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Thiếu hoặc trùng tài khoản nguồn/đích' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id::text = p_to) then
    raise exception 'Tài khoản đích không tồn tại' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_profiles p where p.id = p_to) then
    raise exception 'Tài khoản đích đã có hồ sơ' using errcode = '23505';
  end if;
  if not exists (select 1 from public.user_profiles p where p.id = p_from) then
    raise exception 'Không thấy hồ sơ nguồn' using errcode = '22023';
  end if;

  update public.user_profiles set id = p_to where id = p_from;

  if to_regclass('public.user_permissions') is not null then
    execute 'update public.user_permissions
                set user_id = $2, id = $2 || substr(id, length($1) + 1)
              where user_id = $1'
      using p_from, p_to;
  end if;
end;
$$;

revoke all on function public.list_orphan_auth_accounts() from public, anon;
revoke all on function public.relink_user_profile(text, text) from public, anon;
grant execute on function public.list_orphan_auth_accounts() to authenticated;
grant execute on function public.relink_user_profile(text, text) to authenticated;

-- KIỂM sau khi chạy (đăng nhập admin trên app, hoặc SQL Editor — SQL Editor không
-- có auth.uid() nên la_admin() = false ⇒ hàm báo 42501, đúng như mong đợi):
--   select proname, prosecdef from pg_proc where proname in ('list_orphan_auth_accounts','relink_user_profile');

-- ============================================================
-- ROLLBACK — chép ra chạy tay (không mất dữ liệu; app chỉ ẩn mục tài khoản mồ côi):
--   drop function if exists public.relink_user_profile(text, text);
--   drop function if exists public.list_orphan_auth_accounts();
-- ============================================================
