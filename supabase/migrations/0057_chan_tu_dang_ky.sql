-- ============================================================
-- Baseafood MES — 0057: CHẶN NGƯỜI TỰ ĐĂNG KÝ + KHÓA CỘT VAI TRÒ
--
-- 🔴 RED. Đọc hết đầu file trước khi dán. CHƯA chạy trên DB thật (viết 2026-10-12).
--
-- Vì sao: màn Người dùng tạo tài khoản bằng `auth.signUp` từ trình duyệt
-- (src/lib/auth.ts), nên Supabase BẮT BUỘC để mở "Allow new users to sign up".
-- Anon key nằm sẵn trong bundle JS ⇒ người lạ có link app gọi được
--   supabase.auth.signUp({ email: "x@...", password: "..." })
-- và đăng nhập ngay. Mà `0021`/`0047`/các bảng mới chỉ kiểm
-- `auth.uid() is not null` ⇒ người lạ đó đọc/sửa/xóa được MỌI bảng nghiệp vụ,
-- và tự `update user_profiles set roles = 'admin'` cho chính mình.
--
-- Làm gì (KHÔNG phải phân quyền theo vai trò — quyết định 2026-09-21 "role-RLS
-- hoãn" vẫn giữ: mọi người CÓ vai trò vẫn cùng quyền DB như trước):
--   • Hàm `co_vai_tro()`: người đăng nhập có hồ sơ với `roles` KHÁC RỖNG.
--     Người tự đăng ký chỉ có hồ sơ vai trò rỗng (app tự tạo lúc đăng nhập đầu)
--     ⇒ không đọc/ghi được bảng nghiệp vụ nào.
--   • Hàm `la_admin()`: `roles` chứa token `admin` (cùng biểu thức với 0025).
--   • Mọi policy ở schema public đang có điều kiện `auth.uid() is not null`
--     đổi thành `co_vai_tro()` — quét ĐỘNG theo pg_policies nên bao luôn bảng
--     thêm sau 0021 (0047, 0049, 0051, 0054, 0055, 0056…), kể cả
--     `audit_log_insert`.
--   • `user_profiles`: xem = hồ sơ của mình HOẶC người có vai trò; thêm = chỉ
--     hồ sơ của chính mình với vai trò rỗng, HOẶC admin; sửa/xóa = chỉ admin.
--     ⇒ hết đường tự cấp quyền admin.
--   • Storage (`storage.objects`): policy của `authenticated` được thêm điều
--     kiện `co_vai_tro()`. Không đủ quyền sửa policy Storage thì chỉ báo
--     notice, phần còn lại vẫn chạy.
--
-- Vì sao không tắt đăng ký trên Dashboard: tắt là màn Người dùng hết tạo được
-- tài khoản (signUp bị từ chối). Muốn tắt hẳn thì phải chuyển việc tạo tài
-- khoản sang Edge Function dùng service role — việc riêng, làm sau nếu cần.
--
-- ⚠️ TIỀN KIỂM — chạy 2 câu dưới, KẾT QUẢ PHẢI RỖNG (hoặc chỉ toàn tài khoản
-- lạ/không dùng). Người dùng thật nào hiện ra ở đây sẽ BỊ KHÓA NGOÀI sau khi
-- chạy file này (app vẫn đăng nhập được nhưng mọi màn trống/401). Gán vai trò
-- cho họ ở màn Người dùng TRƯỚC, rồi mới chạy.
--   -- 1) Hồ sơ vai trò rỗng:
--   select id, username, full_name from public.user_profiles
--   where coalesce(btrim(roles), '') = '';
--   -- 2) Tài khoản Auth chưa có hồ sơ:
--   select u.id, u.email, u.created_at from auth.users u
--   left join public.user_profiles p on p.id = u.id::text
--   where p.id is null order by u.created_at;
-- Câu 2 cũng là nơi soi xem đã có ai lạ tự đăng ký chưa (email lạ, giờ lạ).
-- Còn ít nhất MỘT admin đăng nhập được (thử ngay trước khi chạy).
--
-- SAU KHI CHẠY — kiểm chứng: không còn policy public nào dùng điều kiện cũ
--   select tablename, policyname, qual, with_check from pg_policies
--   where schemaname = 'public'
--     and (coalesce(qual,'') ilike '%auth.uid()%is not null%'
--       or coalesce(with_check,'') ilike '%auth.uid()%is not null%');
-- rồi đăng nhập bằng một tài khoản vai trò rỗng: mọi màn phải trống.
--
-- Idempotent: chạy lại nhiều lần vẫn ra cùng kết quả.
-- Câu lùi: khối ROLLBACK cuối file.
-- ============================================================

-- SECURITY DEFINER để đọc user_profiles mà không vướng RLS của chính bảng đó
-- (không thì policy user_profiles gọi hàm → hàm đọc user_profiles → đệ quy).
create or replace function public.co_vai_tro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = (select auth.uid())::text
      and coalesce(btrim(up.roles), '') <> ''
  );
$$;

create or replace function public.la_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = (select auth.uid())::text
      and up.roles ~ '(^|,)\s*admin\s*(,|$)'
  );
$$;

revoke all on function public.co_vai_tro() from public, anon;
revoke all on function public.la_admin() from public, anon;
grant execute on function public.co_vai_tro() to authenticated;
grant execute on function public.la_admin() to authenticated;

-- ---------- Bảng nghiệp vụ: auth.uid() is not null ⇒ co_vai_tro() ----------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'user_profiles'
      and (coalesce(qual, '') ilike '%auth.uid()%is not null%'
        or coalesce(with_check, '') ilike '%auth.uid()%is not null%')
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (public.co_vai_tro())',
                     r.policyname, r.tablename);
    elsif r.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using (public.co_vai_tro())',
                     r.policyname, r.tablename);
    else -- ALL, UPDATE
      execute format('alter policy %I on public.%I using (public.co_vai_tro()) with check (public.co_vai_tro())',
                     r.policyname, r.tablename);
    end if;
    raise notice 'Siết %.%', r.tablename, r.policyname;
  end loop;
end $$;

-- ---------- user_profiles: bỏ mọi policy cũ, dựng 4 policy tách quyền ----------
do $$
declare
  p text;
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'user_profiles') then
    raise notice 'Bỏ qua user_profiles: bảng chưa tồn tại';
    return;
  end if;

  alter table public.user_profiles enable row level security;

  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'user_profiles' loop
    execute format('drop policy if exists %I on public.user_profiles', p);
  end loop;

  create policy user_profiles_xem on public.user_profiles
    for select to authenticated
    using (id = (select auth.uid())::text or public.co_vai_tro());

  -- Lần đăng nhập đầu app tự tạo hồ sơ vai trò rỗng cho chính mình; admin tạo
  -- hồ sơ (có vai trò) cho tài khoản mới ở màn Người dùng.
  create policy user_profiles_them on public.user_profiles
    for insert to authenticated
    with check (
      (id = (select auth.uid())::text and coalesce(btrim(roles), '') = '')
      or public.la_admin()
    );

  create policy user_profiles_sua on public.user_profiles
    for update to authenticated
    using (public.la_admin())
    with check (public.la_admin());

  create policy user_profiles_xoa on public.user_profiles
    for delete to authenticated
    using (public.la_admin());

  revoke all on public.user_profiles from anon;
end $$;

-- ---------- Storage: thêm co_vai_tro() vào policy của authenticated ----------
do $$
declare
  r record;
begin
  for r in
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') not ilike '%co_vai_tro%'
      and coalesce(with_check, '') not ilike '%co_vai_tro%'
  loop
    begin
      if r.qual is not null then
        execute format('alter policy %I on storage.objects using ((%s) and public.co_vai_tro())',
                       r.policyname, r.qual);
      end if;
      if r.with_check is not null then
        execute format('alter policy %I on storage.objects with check ((%s) and public.co_vai_tro())',
                       r.policyname, r.with_check);
      end if;
      raise notice 'Siết storage.objects.%', r.policyname;
    exception when insufficient_privilege then
      raise notice 'Không đủ quyền sửa policy Storage % — siết tay ở Dashboard', r.policyname;
    end;
  end loop;
end $$;

-- ============================================================
-- ROLLBACK — CHỈ dùng khi chạy xong mà người dùng thật bị khóa ngoài.
-- Đưa về mô hình 0021 (mọi người đã đăng nhập cùng quyền) — tức mở lại lỗ
-- người tự đăng ký. Gán vai trò cho người bị khóa rồi chạy lại file này.
--
-- do $$
-- declare r record;
-- begin
--   for r in select schemaname, tablename, policyname, cmd from pg_policies
--            where (coalesce(qual,'') ilike '%co_vai_tro%'
--                or coalesce(with_check,'') ilike '%co_vai_tro%')
--              and schemaname = 'public' and tablename <> 'user_profiles' loop
--     if r.cmd = 'INSERT' then
--       execute format('alter policy %I on public.%I with check ((select auth.uid()) is not null)', r.policyname, r.tablename);
--     elsif r.cmd in ('SELECT','DELETE') then
--       execute format('alter policy %I on public.%I using ((select auth.uid()) is not null)', r.policyname, r.tablename);
--     else
--       execute format('alter policy %I on public.%I using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', r.policyname, r.tablename);
--     end if;
--   end loop;
-- end $$;
-- drop policy if exists user_profiles_xem  on public.user_profiles;
-- drop policy if exists user_profiles_them on public.user_profiles;
-- drop policy if exists user_profiles_sua  on public.user_profiles;
-- drop policy if exists user_profiles_xoa  on public.user_profiles;
-- create policy user_profiles_nguoi_dung on public.user_profiles for all to authenticated
--   using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
-- -- Storage: sửa tay ở Dashboard, bỏ "and public.co_vai_tro()" khỏi từng policy.
-- -- Hai hàm co_vai_tro()/la_admin() để nguyên cũng không hại gì.
-- ============================================================
