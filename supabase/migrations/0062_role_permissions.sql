-- ============================================================
-- Baseafood MES — 0062: PHÂN QUYỀN THEO CHỨC NĂNG (Đợt 2, spec docs/spec/role-permissions.md)
--
-- Vì sao (2026-10-15): xí nghiệp nhiều bộ phận, mỗi bộ phận chỉ nên thấy và làm
-- đúng việc của mình. Đợt 1 đã có ma trận quyền MẶC ĐỊNH trong code
-- (src/lib/permissions.ts). Đợt này cho admin tự chỉnh trên màn "Vai trò & quyền"
-- và lưu chung ở 3 bảng:
--   app_roles         vai trò ĐÃ CHỈNH (vai trò hệ thống đã sửa ma trận) hoặc vai trò
--                     admin TỰ TẠO. Vai trò không có dòng ở đây ⇒ app dùng ma trận
--                     mặc định trong code ⇒ bảng rỗng = hành vi y như Đợt 1.
--   role_permissions  ô quyền của vai trò đã chỉnh: (role_id, resource, action, scope).
--   user_permissions  chỉnh riêng một người: effect 'allow' | 'deny'.
-- id tất định do app dựng (`<role_id>|<resource>|<action>`, `<user_id>|…`) ⇒ một ô
-- đúng một dòng; bỏ tick = xóa dòng.
--
-- KHÔNG đụng bảng/dữ liệu/RLS nào đang có, KHÔNG đổi cột user_profiles.roles.
-- Không khóa ngoại (khóa chính của bảng này không mang site — chế độ demo khóa màn
-- quản trị, xem spec che-do-demo §5). Admin luôn toàn quyền ở app, không đọc bảng
-- này ⇒ không ai tự khóa được quyền quản trị.
--
-- RLS: ĐỌC cho người có vai trò (co_vai_tro(), 0057) — app của mọi người phải đọc
-- để tính quyền; GHI/XÓA chỉ admin (la_admin(), 0057).
--
-- Mức độ rủi ro: 🟡 YELLOW — chỉ thêm bảng mới. Idempotent: chạy lại không lỗi.
-- ⚠ THỨ TỰ TRIỂN KHAI: chạy file này TRƯỚC khi bản app mới lên Vercel (app mới đọc
-- 3 bảng này; thiếu bảng ⇒ đèn kết nối đỏ, quyền vẫn rơi về mặc định).
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.app_roles (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  name        text not null default '',
  description text not null default '',
  home_route  text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  role_id     text not null,
  resource    text not null,
  action      text not null,
  scope       text not null default 'all',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_permissions (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  user_id     text not null,
  resource    text not null,
  action      text not null,
  effect      text not null default 'allow',
  scope       text not null default 'all',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_permissions_effect_check') then
    alter table public.user_permissions
      add constraint user_permissions_effect_check check (effect in ('allow', 'deny'));
  end if;
end $$;

create index if not exists role_permissions_role_idx on public.role_permissions (site_id, role_id);
create index if not exists user_permissions_user_idx on public.user_permissions (site_id, user_id);

-- Cập nhật updated_at (hàm có từ 0001) + RLS + ghi vết SQL (0048), cùng khuôn cho 3 bảng.
do $$
declare
  t text;
begin
  foreach t in array array['app_roles', 'role_permissions', 'user_permissions'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.cap_nhat_thoi_diem_sua()', -- naming-ok: hàm có từ 0001
      t || '_touch_updated_at', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.co_vai_tro())', t || '_select', t); -- naming-ok: hàm 0057
    execute format('create policy %I on public.%I for insert to authenticated with check (public.la_admin())', t || '_insert', t); -- naming-ok: hàm 0057
    execute format('create policy %I on public.%I for update to authenticated using (public.la_admin()) with check (public.la_admin())', t || '_update', t); -- naming-ok: hàm 0057
    execute format('create policy %I on public.%I for delete to authenticated using (public.la_admin())', t || '_delete', t); -- naming-ok: hàm 0057
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
      execute format('drop trigger if exists %I on public.%I', t || '_sql_audit', t);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_vet_sua_truc_tiep()', -- naming-ok: hàm 0048
        t || '_sql_audit', t);
    end if;
  end loop;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: 3 bảng rls = true; mỗi bảng 4 policy, chỉ authenticated):
--   select relname, relrowsecurity from pg_class where relname in ('app_roles','role_permissions','user_permissions');
--   select tablename, policyname, cmd, roles from pg_policies where tablename in ('app_roles','role_permissions','user_permissions') order by 1, 2;

-- ============================================================
-- ROLLBACK — chép ra chạy tay để lùi 0062. Mất mọi chỉnh quyền đã lưu; app tự quay
-- về ma trận mặc định trong code (hành vi Đợt 1). Không ảnh hưởng số liệu sổ sách.
--   drop table if exists public.user_permissions;
--   drop table if exists public.role_permissions;
--   drop table if exists public.app_roles;
-- ============================================================
