-- ============================================================
-- Baseafood MES — 0007: seed tài khoản admin mặc định (admin / admin)
--
-- Chạy SAU 0006. Idempotent — chỉ tạo khi CHƯA có admin (đuôi .vn HAY .local).
-- Chạy lại không nhân đôi. Đuôi email dùng .vn (GoTrue chặn .local); DB cũ đã
-- seed .local thì chạy 0010 đổi sang .vn, KHÔNG chạy lại 0007.
--
-- ⚠️ MẬT KHẨU MẶC ĐỊNH 'admin' RẤT YẾU — chỉ để mồi tài khoản admin đầu tiên
--    cho app nội bộ. ĐỔI MẬT KHẨU NGAY sau khi đăng nhập được (Supabase
--    Dashboard → Auth → Users → admin@bsf1.vn → Reset/Update password).
--
-- Vì sao seed thẳng vào auth.users (không dùng signUp): admin đầu tiên là
-- "con gà - quả trứng" — chưa có admin thì không ai tạo được admin trong app
-- (đăng ký đã ĐÓNG, chỉ admin tạo tài khoản). Nên mồi bằng SQL.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  uid uuid;
begin
  if exists (
    select 1 from auth.users
    where email in ('admin@bsf1.vn', 'admin@bsf1.local')
  ) then
    return; -- đã có admin (bất kể đuôi), không làm gì
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'admin@bsf1.vn', extensions.crypt('admin', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"ho_ten":"Admin","username":"admin"}'::jsonb,
    '', '', '', ''
  );

  -- Bản ghi identity provider email (GoTrue đòi có để đăng nhập email/mật khẩu).
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', 'admin@bsf1.vn'),
    'email', now(), now(), now()
  );

  -- Hồ sơ nghiệp vụ + vai trò admin.
  insert into public.nguoi_dung (id, xi_nghiep_id, ho_ten, username, vai_tro)
  values (uid::text, 'bsf1', 'Admin', 'admin', 'admin')
  on conflict (id) do update
    set vai_tro = 'admin', ho_ten = 'Admin', username = 'admin';
end $$;
