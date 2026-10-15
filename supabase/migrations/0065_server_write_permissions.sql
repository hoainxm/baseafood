-- ============================================================
-- Baseafood MES — 0065: CHỐT QUYỀN GHI Ở MÁY CHỦ (phân quyền Đợt 6, lớp 4)
--
-- Vì sao (spec docs/spec/role-permissions.md §5 lớp 4): Đợt 1–5 chặn ở APP (ẩn nút +
-- chốt ghi ở useTable.write). Ai gọi API thẳng (hay máy chạy bản app cũ) vẫn ghi được
-- mọi bảng nghiệp vụ — RLS hiện chỉ hỏi "có vai trò không" (co_vai_tro(), 0057).
-- Đợt 6 đưa CÙNG ma trận + luật bảng xuống máy chủ.
--
-- Thiết kế:
--   • TRIGGER BEFORE INSERT/UPDATE/DELETE (không phải policy): app ghi bằng UPSERT —
--     Postgres kiểm "thêm" trước cả khi dòng đã có ⇒ policy INSERT sẽ chặn nhầm người
--     chỉ có quyền Sửa. Trigger INSERT thấy dòng đã tồn tại thì nhường trigger UPDATE.
--     Trigger còn so được dòng CŨ ⇄ MỚI (chốt / mở lại theo is_locked, duyệt kho theo
--     status) — giống hệt lib/writePermissions.ts.
--   • Ma trận mặc định: bảng default_role_permissions = DEFAULT_ROLE_PERMISSIONS trong
--     code (test writePermissionsSql.test.ts bắt lệch). Vai trò có dòng app_roles (0062)
--     ⇒ dùng role_permissions; chỉnh riêng user_permissions (chặn > cho); admin toàn quyền.
--   • Phạm vi (Đợt 5): workshop (quản đốc, theo cột workshop), own (tổ trưởng, cột
--     operator so họ tên / tên đăng nhập); dòng thiếu cột ⇒ theo quyền chung.
--   • CÔNG TẮC permission_enforcement.mode: 'off' | 'log' | 'enforce'. Mặc định 'log' —
--     KHÔNG chặn ai, chỉ ghi vào permission_violations những lần LẼ RA bị chặn. Theo dõi
--     rồi mới đổi 'enforce' (bước 🔴 thật). Lùi tức thì: update mode = 'off' (không deploy).
--   • Bỏ qua khi không có auth.uid() (SQL Editor, service role, migration).
--   • Bị chặn ⇒ lỗi 42501; hàng chờ app (lib/repo.ts) giữ dòng lại, không kẹt cả bảng.
--
-- KHÔNG đổi policy / bảng / dữ liệu nghiệp vụ nào. Bảng hệ thống (user_profiles, app_roles,
-- role_permissions, user_permissions) đã có RLS chỉ-admin — không gắn trigger. row_marks,
-- audit_log không chốt.
-- Mức độ: chạy file ở mode 'log' = 🟡 (không chặn ai); đổi sang 'enforce' = 🔴.
-- Idempotent. ROLLBACK ở cuối file.
-- ============================================================

-- ---------- Bảng cấu hình ----------
create table if not exists public.default_role_permissions (
  role_id   text not null,
  resource  text not null,
  action    text not null,
  scope     text not null default 'all',
  primary key (role_id, resource, action)
);

create table if not exists public.permission_enforcement (
  id         integer primary key default 1 check (id = 1),
  mode       text not null default 'log' check (mode in ('off', 'log', 'enforce')),
  updated_at timestamptz not null default now()
);
insert into public.permission_enforcement (id, mode) values (1, 'log') on conflict (id) do nothing;

create table if not exists public.permission_violations (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  mode           text not null,
  actor_id       text not null default '',
  actor_username text not null default '',
  table_name     text not null,
  operation      text not null,
  resource       text not null,
  action         text not null,
  row_key        text not null default '',
  workshop       text not null default ''
);
create index if not exists permission_violations_at_idx on public.permission_violations (at desc);

do $$
declare t text;
begin
  foreach t in array array['default_role_permissions', 'permission_enforcement', 'permission_violations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
  end loop;
end $$;
create policy default_role_permissions_select on public.default_role_permissions
  for select to authenticated using (public.co_vai_tro()); -- naming-ok: hàm 0057
create policy permission_enforcement_select on public.permission_enforcement
  for select to authenticated using (public.co_vai_tro()); -- naming-ok: hàm 0057
create policy permission_enforcement_update on public.permission_enforcement
  for update to authenticated using (public.la_admin()) with check (public.la_admin()); -- naming-ok: hàm 0057
create policy permission_violations_select on public.permission_violations
  for select to authenticated using (public.la_admin()); -- naming-ok: hàm 0057
grant select on public.default_role_permissions to authenticated;
grant select, update on public.permission_enforcement to authenticated;
grant select on public.permission_violations to authenticated;

-- ---------- Ma trận mặc định = DEFAULT_ROLE_PERMISSIONS (src/lib/permissions.ts) ----------
-- Sinh từ code; đổi ma trận ở code ⇒ migration MỚI thay trọn khối này (test bắt lệch).
delete from public.default_role_permissions;
insert into public.default_role_permissions (role_id, resource, action, scope) values
  ('director', 'dashboard', 'view', 'all'),
  ('director', 'dashboard', 'export', 'all'),
  ('director', 'imports', 'view', 'all'),
  ('director', 'imports', 'export', 'all'),
  ('director', 'imports', 'view-price', 'all'),
  ('director', 'wip', 'view', 'all'),
  ('director', 'wip', 'export', 'all'),
  ('director', 'packaging', 'view', 'all'),
  ('director', 'qc', 'view', 'all'),
  ('director', 'qr', 'view', 'all'),
  ('director', 'qr', 'export', 'all'),
  ('director', 'warehouse', 'view', 'all'),
  ('director', 'orders', 'view', 'all'),
  ('director', 'sales', 'view', 'all'),
  ('director', 'sales', 'view-price', 'all'),
  ('director', 'balancing', 'view', 'all'),
  ('director', 'balancing', 'export', 'all'),
  ('director', 'balancing', 'view-price', 'all'),
  ('director', 'monthly-stock', 'view', 'all'),
  ('director', 'monthly-stock', 'export', 'all'),
  ('director', 'reconciliation', 'view', 'all'),
  ('director', 'reconciliation', 'export', 'all'),
  ('director', 'nxt-material', 'view', 'all'),
  ('director', 'nxt-material', 'export', 'all'),
  ('director', 'nxt', 'view', 'all'),
  ('director', 'nxt', 'export', 'all'),
  ('director', 'nxt-warehouse', 'view', 'all'),
  ('director', 'nxt-warehouse', 'export', 'all'),
  ('director', 'production-report', 'view', 'all'),
  ('director', 'production-report', 'export', 'all'),
  ('director', 'export-report', 'view', 'all'),
  ('director', 'export-report', 'export', 'all'),
  ('director', 'catalog.products', 'view', 'all'),
  ('director', 'catalog.customers', 'view', 'all'),
  ('director', 'catalog.suppliers', 'view', 'all'),
  ('director', 'catalog.material-types', 'view', 'all'),
  ('director', 'catalog.batters', 'view', 'all'),
  ('director', 'catalog.storage-locations', 'view', 'all'),
  ('director', 'catalog.finished-goods', 'view', 'all'),
  ('vice-director', 'dashboard', 'view', 'all'),
  ('vice-director', 'dashboard', 'export', 'all'),
  ('vice-director', 'imports', 'view', 'all'),
  ('vice-director', 'imports', 'export', 'all'),
  ('vice-director', 'imports', 'view-price', 'all'),
  ('vice-director', 'wip', 'view', 'all'),
  ('vice-director', 'wip', 'export', 'all'),
  ('vice-director', 'packaging', 'view', 'all'),
  ('vice-director', 'qc', 'view', 'all'),
  ('vice-director', 'qr', 'view', 'all'),
  ('vice-director', 'qr', 'export', 'all'),
  ('vice-director', 'warehouse', 'view', 'all'),
  ('vice-director', 'orders', 'view', 'all'),
  ('vice-director', 'sales', 'view', 'all'),
  ('vice-director', 'sales', 'view-price', 'all'),
  ('vice-director', 'balancing', 'view', 'all'),
  ('vice-director', 'balancing', 'export', 'all'),
  ('vice-director', 'balancing', 'view-price', 'all'),
  ('vice-director', 'monthly-stock', 'view', 'all'),
  ('vice-director', 'monthly-stock', 'export', 'all'),
  ('vice-director', 'reconciliation', 'view', 'all'),
  ('vice-director', 'reconciliation', 'export', 'all'),
  ('vice-director', 'nxt-material', 'view', 'all'),
  ('vice-director', 'nxt-material', 'export', 'all'),
  ('vice-director', 'nxt', 'view', 'all'),
  ('vice-director', 'nxt', 'export', 'all'),
  ('vice-director', 'nxt-warehouse', 'view', 'all'),
  ('vice-director', 'nxt-warehouse', 'export', 'all'),
  ('vice-director', 'production-report', 'view', 'all'),
  ('vice-director', 'production-report', 'export', 'all'),
  ('vice-director', 'export-report', 'view', 'all'),
  ('vice-director', 'export-report', 'export', 'all'),
  ('vice-director', 'catalog.products', 'view', 'all'),
  ('vice-director', 'catalog.customers', 'view', 'all'),
  ('vice-director', 'catalog.suppliers', 'view', 'all'),
  ('vice-director', 'catalog.material-types', 'view', 'all'),
  ('vice-director', 'catalog.batters', 'view', 'all'),
  ('vice-director', 'catalog.storage-locations', 'view', 'all'),
  ('vice-director', 'catalog.finished-goods', 'view', 'all'),
  ('chief-accountant', 'dashboard', 'view', 'all'),
  ('chief-accountant', 'dashboard', 'export', 'all'),
  ('chief-accountant', 'imports', 'view', 'all'),
  ('chief-accountant', 'imports', 'update', 'all'),
  ('chief-accountant', 'imports', 'delete', 'all'),
  ('chief-accountant', 'imports', 'lock', 'all'),
  ('chief-accountant', 'imports', 'unlock', 'all'),
  ('chief-accountant', 'imports', 'export', 'all'),
  ('chief-accountant', 'imports', 'view-price', 'all'),
  ('chief-accountant', 'wip', 'view', 'all'),
  ('chief-accountant', 'wip', 'unlock', 'all'),
  ('chief-accountant', 'wip', 'export', 'all'),
  ('chief-accountant', 'packaging', 'view', 'all'),
  ('chief-accountant', 'qc', 'view', 'all'),
  ('chief-accountant', 'qr', 'view', 'all'),
  ('chief-accountant', 'qr', 'export', 'all'),
  ('chief-accountant', 'warehouse', 'view', 'all'),
  ('chief-accountant', 'orders', 'view', 'all'),
  ('chief-accountant', 'orders', 'create', 'all'),
  ('chief-accountant', 'orders', 'update', 'all'),
  ('chief-accountant', 'orders', 'delete', 'all'),
  ('chief-accountant', 'sales', 'view', 'all'),
  ('chief-accountant', 'sales', 'create', 'all'),
  ('chief-accountant', 'sales', 'update', 'all'),
  ('chief-accountant', 'sales', 'delete', 'all'),
  ('chief-accountant', 'sales', 'lock', 'all'),
  ('chief-accountant', 'sales', 'unlock', 'all'),
  ('chief-accountant', 'sales', 'view-price', 'all'),
  ('chief-accountant', 'balancing', 'view', 'all'),
  ('chief-accountant', 'balancing', 'create', 'all'),
  ('chief-accountant', 'balancing', 'update', 'all'),
  ('chief-accountant', 'balancing', 'delete', 'all'),
  ('chief-accountant', 'balancing', 'lock', 'all'),
  ('chief-accountant', 'balancing', 'unlock', 'all'),
  ('chief-accountant', 'balancing', 'export', 'all'),
  ('chief-accountant', 'balancing', 'view-price', 'all'),
  ('chief-accountant', 'monthly-stock', 'view', 'all'),
  ('chief-accountant', 'monthly-stock', 'create', 'all'),
  ('chief-accountant', 'monthly-stock', 'update', 'all'),
  ('chief-accountant', 'monthly-stock', 'delete', 'all'),
  ('chief-accountant', 'monthly-stock', 'import', 'all'),
  ('chief-accountant', 'monthly-stock', 'export', 'all'),
  ('chief-accountant', 'reconciliation', 'view', 'all'),
  ('chief-accountant', 'reconciliation', 'create', 'all'),
  ('chief-accountant', 'reconciliation', 'update', 'all'),
  ('chief-accountant', 'reconciliation', 'delete', 'all'),
  ('chief-accountant', 'reconciliation', 'export', 'all'),
  ('chief-accountant', 'nxt-material', 'view', 'all'),
  ('chief-accountant', 'nxt-material', 'create', 'all'),
  ('chief-accountant', 'nxt-material', 'update', 'all'),
  ('chief-accountant', 'nxt-material', 'delete', 'all'),
  ('chief-accountant', 'nxt-material', 'export', 'all'),
  ('chief-accountant', 'nxt', 'view', 'all'),
  ('chief-accountant', 'nxt', 'create', 'all'),
  ('chief-accountant', 'nxt', 'update', 'all'),
  ('chief-accountant', 'nxt', 'delete', 'all'),
  ('chief-accountant', 'nxt', 'export', 'all'),
  ('chief-accountant', 'nxt-warehouse', 'view', 'all'),
  ('chief-accountant', 'nxt-warehouse', 'import', 'all'),
  ('chief-accountant', 'nxt-warehouse', 'export', 'all'),
  ('chief-accountant', 'production-report', 'view', 'all'),
  ('chief-accountant', 'production-report', 'export', 'all'),
  ('chief-accountant', 'export-report', 'view', 'all'),
  ('chief-accountant', 'export-report', 'export', 'all'),
  ('chief-accountant', 'catalog.products', 'view', 'all'),
  ('chief-accountant', 'catalog.products', 'create', 'all'),
  ('chief-accountant', 'catalog.products', 'update', 'all'),
  ('chief-accountant', 'catalog.products', 'delete', 'all'),
  ('chief-accountant', 'catalog.customers', 'view', 'all'),
  ('chief-accountant', 'catalog.customers', 'create', 'all'),
  ('chief-accountant', 'catalog.customers', 'update', 'all'),
  ('chief-accountant', 'catalog.customers', 'delete', 'all'),
  ('chief-accountant', 'catalog.suppliers', 'view', 'all'),
  ('chief-accountant', 'catalog.suppliers', 'create', 'all'),
  ('chief-accountant', 'catalog.suppliers', 'update', 'all'),
  ('chief-accountant', 'catalog.suppliers', 'delete', 'all'),
  ('chief-accountant', 'catalog.material-types', 'view', 'all'),
  ('chief-accountant', 'catalog.material-types', 'create', 'all'),
  ('chief-accountant', 'catalog.material-types', 'update', 'all'),
  ('chief-accountant', 'catalog.material-types', 'delete', 'all'),
  ('chief-accountant', 'catalog.batters', 'view', 'all'),
  ('chief-accountant', 'catalog.batters', 'create', 'all'),
  ('chief-accountant', 'catalog.batters', 'update', 'all'),
  ('chief-accountant', 'catalog.batters', 'delete', 'all'),
  ('chief-accountant', 'catalog.storage-locations', 'view', 'all'),
  ('chief-accountant', 'catalog.storage-locations', 'create', 'all'),
  ('chief-accountant', 'catalog.storage-locations', 'update', 'all'),
  ('chief-accountant', 'catalog.storage-locations', 'delete', 'all'),
  ('chief-accountant', 'catalog.finished-goods', 'view', 'all'),
  ('accountant', 'dashboard', 'view', 'all'),
  ('accountant', 'dashboard', 'export', 'all'),
  ('accountant', 'imports', 'view', 'all'),
  ('accountant', 'imports', 'create', 'all'),
  ('accountant', 'imports', 'update', 'all'),
  ('accountant', 'imports', 'lock', 'all'),
  ('accountant', 'imports', 'export', 'all'),
  ('accountant', 'imports', 'view-price', 'all'),
  ('accountant', 'wip', 'view', 'all'),
  ('accountant', 'wip', 'create', 'all'),
  ('accountant', 'wip', 'update', 'all'),
  ('accountant', 'wip', 'lock', 'all'),
  ('accountant', 'wip', 'export', 'all'),
  ('accountant', 'packaging', 'view', 'all'),
  ('accountant', 'qr', 'view', 'all'),
  ('accountant', 'qr', 'export', 'all'),
  ('accountant', 'warehouse', 'view', 'all'),
  ('accountant', 'orders', 'view', 'all'),
  ('accountant', 'orders', 'create', 'all'),
  ('accountant', 'orders', 'update', 'all'),
  ('accountant', 'sales', 'view', 'all'),
  ('accountant', 'sales', 'create', 'all'),
  ('accountant', 'sales', 'update', 'all'),
  ('accountant', 'sales', 'view-price', 'all'),
  ('accountant', 'balancing', 'view', 'all'),
  ('accountant', 'balancing', 'create', 'all'),
  ('accountant', 'balancing', 'update', 'all'),
  ('accountant', 'balancing', 'export', 'all'),
  ('accountant', 'balancing', 'view-price', 'all'),
  ('accountant', 'monthly-stock', 'view', 'all'),
  ('accountant', 'monthly-stock', 'create', 'all'),
  ('accountant', 'monthly-stock', 'update', 'all'),
  ('accountant', 'monthly-stock', 'import', 'all'),
  ('accountant', 'monthly-stock', 'export', 'all'),
  ('accountant', 'reconciliation', 'view', 'all'),
  ('accountant', 'reconciliation', 'create', 'all'),
  ('accountant', 'reconciliation', 'update', 'all'),
  ('accountant', 'reconciliation', 'export', 'all'),
  ('accountant', 'nxt-material', 'view', 'all'),
  ('accountant', 'nxt-material', 'create', 'all'),
  ('accountant', 'nxt-material', 'update', 'all'),
  ('accountant', 'nxt-material', 'export', 'all'),
  ('accountant', 'nxt', 'view', 'all'),
  ('accountant', 'nxt', 'create', 'all'),
  ('accountant', 'nxt', 'update', 'all'),
  ('accountant', 'nxt', 'export', 'all'),
  ('accountant', 'nxt-warehouse', 'view', 'all'),
  ('accountant', 'nxt-warehouse', 'import', 'all'),
  ('accountant', 'nxt-warehouse', 'export', 'all'),
  ('accountant', 'production-report', 'view', 'all'),
  ('accountant', 'production-report', 'export', 'all'),
  ('accountant', 'export-report', 'view', 'all'),
  ('accountant', 'export-report', 'export', 'all'),
  ('accountant', 'catalog.products', 'view', 'all'),
  ('accountant', 'catalog.products', 'create', 'all'),
  ('accountant', 'catalog.products', 'update', 'all'),
  ('accountant', 'catalog.customers', 'view', 'all'),
  ('accountant', 'catalog.customers', 'create', 'all'),
  ('accountant', 'catalog.customers', 'update', 'all'),
  ('accountant', 'catalog.suppliers', 'view', 'all'),
  ('accountant', 'catalog.suppliers', 'create', 'all'),
  ('accountant', 'catalog.suppliers', 'update', 'all'),
  ('accountant', 'catalog.material-types', 'view', 'all'),
  ('accountant', 'catalog.material-types', 'create', 'all'),
  ('accountant', 'catalog.material-types', 'update', 'all'),
  ('accountant', 'catalog.batters', 'view', 'all'),
  ('accountant', 'catalog.batters', 'create', 'all'),
  ('accountant', 'catalog.batters', 'update', 'all'),
  ('accountant', 'catalog.storage-locations', 'view', 'all'),
  ('accountant', 'catalog.storage-locations', 'create', 'all'),
  ('accountant', 'catalog.storage-locations', 'update', 'all'),
  ('accountant', 'catalog.finished-goods', 'view', 'all'),
  ('warehouse-keeper', 'imports', 'view', 'all'),
  ('warehouse-keeper', 'imports', 'create', 'all'),
  ('warehouse-keeper', 'imports', 'update', 'all'),
  ('warehouse-keeper', 'imports', 'delete', 'all'),
  ('warehouse-keeper', 'imports', 'lock', 'all'),
  ('warehouse-keeper', 'imports', 'export', 'all'),
  ('warehouse-keeper', 'imports', 'view-price', 'all'),
  ('warehouse-keeper', 'qr', 'view', 'all'),
  ('warehouse-keeper', 'qr', 'create', 'all'),
  ('warehouse-keeper', 'qr', 'export', 'all'),
  ('warehouse-keeper', 'warehouse', 'view', 'all'),
  ('warehouse-keeper', 'monthly-stock', 'view', 'all'),
  ('warehouse-keeper', 'nxt-material', 'view', 'all'),
  ('warehouse-keeper', 'nxt', 'view', 'all'),
  ('warehouse-keeper', 'nxt-warehouse', 'view', 'all'),
  ('warehouse-keeper', 'catalog.products', 'view', 'all'),
  ('warehouse-keeper', 'catalog.customers', 'view', 'all'),
  ('warehouse-keeper', 'catalog.suppliers', 'view', 'all'),
  ('warehouse-keeper', 'catalog.suppliers', 'create', 'all'),
  ('warehouse-keeper', 'catalog.suppliers', 'update', 'all'),
  ('warehouse-keeper', 'catalog.material-types', 'view', 'all'),
  ('warehouse-keeper', 'catalog.material-types', 'create', 'all'),
  ('warehouse-keeper', 'catalog.material-types', 'update', 'all'),
  ('warehouse-keeper', 'catalog.batters', 'view', 'all'),
  ('warehouse-keeper', 'catalog.storage-locations', 'view', 'all'),
  ('warehouse-keeper', 'catalog.finished-goods', 'view', 'all'),
  ('team-leader', 'wip', 'view', 'all'),
  ('team-leader', 'wip', 'create', 'own'),
  ('team-leader', 'wip', 'update', 'own'),
  ('team-leader', 'packaging', 'view', 'all'),
  ('team-leader', 'packaging', 'create', 'all'),
  ('team-leader', 'packaging', 'update', 'all'),
  ('team-leader', 'qc', 'view', 'all'),
  ('team-leader', 'qc', 'create', 'all'),
  ('team-leader', 'qc', 'update', 'all'),
  ('team-leader', 'qr', 'view', 'all'),
  ('team-leader', 'qr', 'create', 'all'),
  ('team-leader', 'warehouse', 'view', 'all'),
  ('team-leader', 'catalog.products', 'view', 'all'),
  ('team-leader', 'catalog.customers', 'view', 'all'),
  ('team-leader', 'catalog.suppliers', 'view', 'all'),
  ('team-leader', 'catalog.material-types', 'view', 'all'),
  ('team-leader', 'catalog.batters', 'view', 'all'),
  ('team-leader', 'catalog.storage-locations', 'view', 'all'),
  ('team-leader', 'catalog.finished-goods', 'view', 'all'),
  ('manager-dong', 'dashboard', 'view', 'all'),
  ('manager-dong', 'wip', 'view', 'all'),
  ('manager-dong', 'wip', 'create', 'workshop'),
  ('manager-dong', 'wip', 'update', 'workshop'),
  ('manager-dong', 'wip', 'delete', 'workshop'),
  ('manager-dong', 'wip', 'lock', 'workshop'),
  ('manager-dong', 'wip', 'unlock', 'workshop'),
  ('manager-dong', 'wip', 'export', 'all'),
  ('manager-dong', 'packaging', 'view', 'all'),
  ('manager-dong', 'packaging', 'create', 'workshop'),
  ('manager-dong', 'packaging', 'update', 'workshop'),
  ('manager-dong', 'packaging', 'delete', 'workshop'),
  ('manager-dong', 'qc', 'view', 'all'),
  ('manager-dong', 'qc', 'create', 'workshop'),
  ('manager-dong', 'qc', 'update', 'workshop'),
  ('manager-dong', 'qc', 'lock', 'workshop'),
  ('manager-dong', 'qc', 'unlock', 'workshop'),
  ('manager-dong', 'qr', 'view', 'all'),
  ('manager-dong', 'qr', 'create', 'all'),
  ('manager-dong', 'qr', 'update', 'all'),
  ('manager-dong', 'qr', 'export', 'all'),
  ('manager-dong', 'warehouse', 'view', 'all'),
  ('manager-dong', 'warehouse', 'approve', 'workshop'),
  ('manager-dong', 'nxt-material', 'view', 'all'),
  ('manager-dong', 'nxt', 'view', 'all'),
  ('manager-dong', 'nxt-warehouse', 'view', 'all'),
  ('manager-dong', 'production-report', 'view', 'all'),
  ('manager-dong', 'production-report', 'export', 'all'),
  ('manager-dong', 'export-report', 'view', 'all'),
  ('manager-dong', 'export-report', 'export', 'all'),
  ('manager-dong', 'catalog.products', 'view', 'all'),
  ('manager-dong', 'catalog.products', 'create', 'all'),
  ('manager-dong', 'catalog.products', 'update', 'all'),
  ('manager-dong', 'catalog.customers', 'view', 'all'),
  ('manager-dong', 'catalog.suppliers', 'view', 'all'),
  ('manager-dong', 'catalog.material-types', 'view', 'all'),
  ('manager-dong', 'catalog.batters', 'view', 'all'),
  ('manager-dong', 'catalog.batters', 'create', 'all'),
  ('manager-dong', 'catalog.batters', 'update', 'all'),
  ('manager-dong', 'catalog.storage-locations', 'view', 'all'),
  ('manager-dong', 'catalog.finished-goods', 'view', 'all'),
  ('manager-ca', 'dashboard', 'view', 'all'),
  ('manager-ca', 'wip', 'view', 'all'),
  ('manager-ca', 'wip', 'create', 'workshop'),
  ('manager-ca', 'wip', 'update', 'workshop'),
  ('manager-ca', 'wip', 'delete', 'workshop'),
  ('manager-ca', 'wip', 'lock', 'workshop'),
  ('manager-ca', 'wip', 'unlock', 'workshop'),
  ('manager-ca', 'wip', 'export', 'all'),
  ('manager-ca', 'packaging', 'view', 'all'),
  ('manager-ca', 'packaging', 'create', 'workshop'),
  ('manager-ca', 'packaging', 'update', 'workshop'),
  ('manager-ca', 'packaging', 'delete', 'workshop'),
  ('manager-ca', 'qc', 'view', 'all'),
  ('manager-ca', 'qc', 'create', 'workshop'),
  ('manager-ca', 'qc', 'update', 'workshop'),
  ('manager-ca', 'qc', 'lock', 'workshop'),
  ('manager-ca', 'qc', 'unlock', 'workshop'),
  ('manager-ca', 'qr', 'view', 'all'),
  ('manager-ca', 'qr', 'create', 'all'),
  ('manager-ca', 'qr', 'update', 'all'),
  ('manager-ca', 'qr', 'export', 'all'),
  ('manager-ca', 'warehouse', 'view', 'all'),
  ('manager-ca', 'warehouse', 'approve', 'workshop'),
  ('manager-ca', 'nxt-material', 'view', 'all'),
  ('manager-ca', 'nxt', 'view', 'all'),
  ('manager-ca', 'nxt-warehouse', 'view', 'all'),
  ('manager-ca', 'production-report', 'view', 'all'),
  ('manager-ca', 'production-report', 'export', 'all'),
  ('manager-ca', 'export-report', 'view', 'all'),
  ('manager-ca', 'export-report', 'export', 'all'),
  ('manager-ca', 'catalog.products', 'view', 'all'),
  ('manager-ca', 'catalog.products', 'create', 'all'),
  ('manager-ca', 'catalog.products', 'update', 'all'),
  ('manager-ca', 'catalog.customers', 'view', 'all'),
  ('manager-ca', 'catalog.suppliers', 'view', 'all'),
  ('manager-ca', 'catalog.material-types', 'view', 'all'),
  ('manager-ca', 'catalog.batters', 'view', 'all'),
  ('manager-ca', 'catalog.batters', 'create', 'all'),
  ('manager-ca', 'catalog.batters', 'update', 'all'),
  ('manager-ca', 'catalog.storage-locations', 'view', 'all'),
  ('manager-ca', 'catalog.finished-goods', 'view', 'all'),
  ('manager-kho', 'dashboard', 'view', 'all'),
  ('manager-kho', 'wip', 'view', 'all'),
  ('manager-kho', 'wip', 'create', 'workshop'),
  ('manager-kho', 'wip', 'update', 'workshop'),
  ('manager-kho', 'wip', 'delete', 'workshop'),
  ('manager-kho', 'wip', 'lock', 'workshop'),
  ('manager-kho', 'wip', 'unlock', 'workshop'),
  ('manager-kho', 'wip', 'export', 'all'),
  ('manager-kho', 'packaging', 'view', 'all'),
  ('manager-kho', 'packaging', 'create', 'workshop'),
  ('manager-kho', 'packaging', 'update', 'workshop'),
  ('manager-kho', 'packaging', 'delete', 'workshop'),
  ('manager-kho', 'qc', 'view', 'all'),
  ('manager-kho', 'qc', 'create', 'workshop'),
  ('manager-kho', 'qc', 'update', 'workshop'),
  ('manager-kho', 'qc', 'lock', 'workshop'),
  ('manager-kho', 'qc', 'unlock', 'workshop'),
  ('manager-kho', 'qr', 'view', 'all'),
  ('manager-kho', 'qr', 'create', 'all'),
  ('manager-kho', 'qr', 'update', 'all'),
  ('manager-kho', 'qr', 'export', 'all'),
  ('manager-kho', 'warehouse', 'view', 'all'),
  ('manager-kho', 'warehouse', 'approve', 'workshop'),
  ('manager-kho', 'nxt-material', 'view', 'all'),
  ('manager-kho', 'nxt', 'view', 'all'),
  ('manager-kho', 'nxt-warehouse', 'view', 'all'),
  ('manager-kho', 'production-report', 'view', 'all'),
  ('manager-kho', 'production-report', 'export', 'all'),
  ('manager-kho', 'export-report', 'view', 'all'),
  ('manager-kho', 'export-report', 'export', 'all'),
  ('manager-kho', 'catalog.products', 'view', 'all'),
  ('manager-kho', 'catalog.products', 'create', 'all'),
  ('manager-kho', 'catalog.products', 'update', 'all'),
  ('manager-kho', 'catalog.customers', 'view', 'all'),
  ('manager-kho', 'catalog.suppliers', 'view', 'all'),
  ('manager-kho', 'catalog.material-types', 'view', 'all'),
  ('manager-kho', 'catalog.batters', 'view', 'all'),
  ('manager-kho', 'catalog.batters', 'create', 'all'),
  ('manager-kho', 'catalog.batters', 'update', 'all'),
  ('manager-kho', 'catalog.storage-locations', 'view', 'all'),
  ('manager-kho', 'catalog.finished-goods', 'view', 'all'),
  ('vice-manager', 'dashboard', 'view', 'all'),
  ('vice-manager', 'wip', 'view', 'all'),
  ('vice-manager', 'wip', 'create', 'all'),
  ('vice-manager', 'wip', 'update', 'all'),
  ('vice-manager', 'wip', 'delete', 'all'),
  ('vice-manager', 'packaging', 'view', 'all'),
  ('vice-manager', 'packaging', 'create', 'all'),
  ('vice-manager', 'packaging', 'update', 'all'),
  ('vice-manager', 'qc', 'view', 'all'),
  ('vice-manager', 'qc', 'create', 'all'),
  ('vice-manager', 'qc', 'update', 'all'),
  ('vice-manager', 'qr', 'view', 'all'),
  ('vice-manager', 'qr', 'create', 'all'),
  ('vice-manager', 'warehouse', 'view', 'all'),
  ('vice-manager', 'warehouse', 'approve', 'all'),
  ('vice-manager', 'production-report', 'view', 'all'),
  ('vice-manager', 'production-report', 'export', 'all'),
  ('vice-manager', 'export-report', 'view', 'all'),
  ('vice-manager', 'export-report', 'export', 'all'),
  ('vice-manager', 'catalog.products', 'view', 'all'),
  ('vice-manager', 'catalog.customers', 'view', 'all'),
  ('vice-manager', 'catalog.suppliers', 'view', 'all'),
  ('vice-manager', 'catalog.material-types', 'view', 'all'),
  ('vice-manager', 'catalog.batters', 'view', 'all'),
  ('vice-manager', 'catalog.storage-locations', 'view', 'all'),
  ('vice-manager', 'catalog.finished-goods', 'view', 'all');

-- ---------- Vai trò cũ tiếng Việt → slug chuẩn (giống LEGACY_ROLE_MAP ở src/types.ts) ----------
create or replace function public.normalize_role_slug(p text)
returns text language sql immutable as $$
  select case btrim(p)
    when 'giam-doc' then 'director' -- naming-ok: giá trị cũ đã lưu trong user_profiles.roles
    when 'pho-giam-doc' then 'vice-director' -- naming-ok
    when 'quan-doc-dong' then 'manager-dong' -- naming-ok
    when 'quan-doc-ca' then 'manager-ca' -- naming-ok
    when 'quan-doc-kho' then 'manager-kho' -- naming-ok
    when 'pho-quan-doc' then 'vice-manager' -- naming-ok
    when 'ke-toan' then 'accountant' -- naming-ok
    when 'ke-toan-truong' then 'chief-accountant' -- naming-ok
    when 'to-truong' then 'team-leader' -- naming-ok
    when 'thu-kho' then 'warehouse-keeper' -- naming-ok
    when 'nhap-hang' then 'warehouse-keeper' -- naming-ok
    else btrim(p)
  end
$$;

-- ---------- Quyền thực của người đang gọi (= resolvePermissions), nhớ trong giao dịch ----------
create or replace function public.current_permission_context()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid text := (select auth.uid())::text;
  v_cached text;
  v_ctx jsonb;
  v_full_name text;
  v_username text;
  v_roles_csv text;
  v_roles text[];
  v_grants jsonb := '{}'::jsonb;
  v_workshops text[];
  r record;
  v_key text;
  v_old text;
begin
  if v_uid is null then
    return jsonb_build_object('system', true);
  end if;
  v_cached := current_setting('bsf.permission_context', true);
  if coalesce(v_cached, '') <> '' then
    v_ctx := v_cached::jsonb;
    if v_ctx->>'uid' = v_uid then return v_ctx; end if;
  end if;

  select up.full_name, up.username, up.roles into v_full_name, v_username, v_roles_csv
    from public.user_profiles up where up.id = v_uid;
  v_roles := array(
    select public.normalize_role_slug(x)
      from unnest(string_to_array(coalesce(v_roles_csv, ''), ',')) x
     where btrim(x) <> ''
  );

  if 'admin' = any(v_roles) then
    v_ctx := jsonb_build_object('uid', v_uid, 'admin', true);
  else
    -- Vai trò ĐÃ CHỈNH (có dòng app_roles) ⇒ role_permissions; còn lại ⇒ ma trận mặc định.
    for r in
      select rp.resource, rp.action, rp.scope
        from public.role_permissions rp
       where rp.role_id = any(v_roles)
         and exists (select 1 from public.app_roles ar where ar.id = rp.role_id)
      union all
      select d.resource, d.action, d.scope
        from public.default_role_permissions d
       where d.role_id = any(v_roles)
         and not exists (select 1 from public.app_roles ar where ar.id = d.role_id)
    loop
      v_key := r.resource || ':' || r.action;
      v_old := v_grants->>v_key;
      -- Hợp nhiều vai trò: phạm vi RỘNG nhất (all > workshop > own).
      if v_old is null
         or (r.scope = 'all')
         or (r.scope = 'workshop' and v_old = 'own') then
        v_grants := v_grants || jsonb_build_object(v_key, r.scope);
      end if;
    end loop;
    -- Chỉnh riêng: cho thêm, rồi chặn (chặn thắng); chặn Xem ⇒ gỡ mọi hành động tài nguyên đó.
    for r in select up.resource, up.action, up.effect, up.scope from public.user_permissions up where up.user_id = v_uid loop
      if r.effect = 'allow' then
        v_grants := v_grants || jsonb_build_object(r.resource || ':' || r.action, coalesce(nullif(r.scope, ''), 'all'));
      end if;
    end loop;
    for r in select up.resource, up.action from public.user_permissions up where up.user_id = v_uid and up.effect = 'deny' loop
      if r.action = 'view' then
        v_grants := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(v_grants) e(k, v) where k not like r.resource || ':%');
      else
        v_grants := v_grants - (r.resource || ':' || r.action);
      end if;
    end loop;
    v_workshops := array(
      select case x when 'manager-dong' then 'Đông' when 'manager-ca' then 'Cá' when 'manager-kho' then 'Khô' end
        from unnest(v_roles) x where x in ('manager-dong', 'manager-ca', 'manager-kho')
    );
    v_ctx := jsonb_build_object(
      'uid', v_uid,
      'admin', false,
      'grants', v_grants,
      'workshops', to_jsonb(v_workshops),
      'identities', to_jsonb(array_remove(array[btrim(coalesce(v_full_name, '')), btrim(coalesce(v_username, ''))], '')),
      'username', coalesce(v_username, '')
    );
  end if;
  perform set_config('bsf.permission_context', v_ctx::text, true); -- chỉ trong giao dịch này
  return v_ctx;
end;
$$;

-- ---------- Dòng có trong phạm vi không (= rowInScope) ----------
create or replace function public.row_in_permission_scope(p_scope text, p_ctx jsonb, p_row jsonb, p_kind text)
returns boolean language plpgsql immutable as $$
declare v text;
begin
  if p_scope = 'all' or p_row is null then return true; end if;
  if p_scope = 'workshop' then
    v := btrim(coalesce(p_row->>'workshop', ''));
    return v = '' or coalesce(p_ctx->'workshops', '[]'::jsonb) ? v;
  end if;
  if p_kind = 'create' then return true; end if;
  v := btrim(coalesce(p_row->>'operator', ''));
  return v = '' or exists (
    select 1 from jsonb_array_elements_text(coalesce(p_ctx->'identities', '[]'::jsonb)) i where lower(i) = lower(v)
  );
end;
$$;

-- ---------- Bảng → quyền cần (= TABLE_WRITE_RULES ở src/lib/writePermissions.ts) ----------
create or replace function public.required_write_permissions(p_table text, p_kind text, p_old jsonb, p_new jsonb)
returns table (resource text, action text) language plpgsql immutable as $$
declare
  v_was boolean := coalesce((p_old->>'is_locked')::boolean, false);
  v_is boolean := coalesce((p_new->>'is_locked')::boolean, false);
  v_lock text := case
    when p_kind = 'delete' or (v_was and not v_is) then 'unlock'
    when v_is and not v_was then 'lock'
    else p_kind end;
  v_approve boolean := p_kind = 'update'
    and coalesce(p_old->>'status', '') is distinct from coalesce(p_new->>'status', '')
    and p_new->>'status' = 'stocked';
begin
  case p_table
    when 'import_shipments' then return query values ('imports', p_kind);
    when 'material_imports' then
      if p_kind = 'delete' then return query values ('imports', 'update'), ('balancing', 'delete');
      else return query values ('imports', p_kind), ('balancing', p_kind); end if;
    when 'daily_locks' then return query values ('imports', v_lock);
    when 'scraps' then return query values ('imports', p_kind), ('balancing', p_kind);
    when 'production_wips' then
      return query values ('wip', p_kind), ('balancing', p_kind), ('warehouse', case when v_approve then 'approve' else 'update' end);
    when 'production_locks' then return query values ('wip', v_lock);
    when 'domestic_sales' then return query values ('wip', p_kind);
    when 'packagings' then return query values ('packaging', p_kind);
    when 'qc_checklists' then return query values ('qc', p_kind);
    when 'qc_locks' then return query values ('qc', v_lock);
    when 'lot_inputs' then return query values ('wip', p_kind), ('packaging', p_kind), ('qr', p_kind);
    when 'lot_waivers' then return query values ('wip', p_kind), ('qr', p_kind);
    when 'lot_dispatches' then return query values ('orders', p_kind), ('sales', p_kind), ('wip', p_kind), ('qr', p_kind);
    when 'label_prints' then
      return query values ('qr', p_kind), ('imports', p_kind), ('wip', p_kind), ('packaging', p_kind), ('sales', p_kind), ('orders', p_kind);
    when 'sales_invoices' then return query values ('sales', p_kind), ('orders', p_kind);
    when 'sales_items' then return query values ('sales', p_kind), ('orders', p_kind);
    when 'sales_orders' then return query values ('orders', p_kind);
    when 'order_items' then return query values ('orders', p_kind);
    when 'export_orders' then return query values ('orders', p_kind);
    when 'export_items' then return query values ('orders', p_kind);
    when 'balancing_periods' then
      if p_kind = 'update' and v_was is distinct from v_is then
        return query values ('balancing', case when v_is then 'lock' else 'unlock' end);
      else return query values ('balancing', p_kind); end if;
    when 'balancing_inputs' then return query values ('balancing', p_kind);
    when 'balancing_outputs' then return query values ('balancing', p_kind);
    when 'monthly_stock_ledger' then return query values ('monthly-stock', p_kind), ('balancing', p_kind);
    when 'reconciliation_runs' then return query values ('reconciliation', p_kind);
    when 'material_opening_stock' then return query values ('nxt-material', p_kind);
    when 'finished_goods_opening_stock' then return query values ('nxt', p_kind);
    when 'nxt_snapshots' then return query values ('nxt-warehouse', 'import');
    when 'suppliers' then return query values ('catalog.suppliers', p_kind);
    when 'customers' then return query values ('catalog.customers', p_kind);
    when 'material_types' then return query values ('catalog.material-types', p_kind);
    when 'products' then return query values ('catalog.products', p_kind);
    when 'batter_types' then return query values ('catalog.batters', p_kind);
    when 'storage_locations' then return query values ('catalog.storage-locations', p_kind);
    when 'finished_goods' then return query values ('catalog.finished-goods', 'update');
    else return;
  end case;
end;
$$;

-- ---------- Trigger chốt ghi ----------
create or replace function public.enforce_write_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_kind text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  v_pk text := coalesce(tg_argv[0], 'id');
  v_old jsonb;
  v_new jsonb;
  v_ctx jsonb;
  v_scope text;
  v_exists boolean;
  v_ok boolean := false;
  v_first_resource text;
  v_first_action text;
  r record;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if; -- SQL Editor / service role
  select pe.mode into v_mode from public.permission_enforcement pe where pe.id = 1;
  if coalesce(v_mode, 'off') = 'off' then return coalesce(new, old); end if;

  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op = 'INSERT' then
    -- UPSERT trúng dòng đã có: Postgres chạy trigger INSERT trước — nhường trigger UPDATE kiểm.
    execute format('select exists (select 1 from %I.%I where %I = $1)', tg_table_schema, tg_table_name, v_pk)
      into v_exists using v_new->>v_pk;
    if v_exists then return new; end if;
  end if;

  v_ctx := public.current_permission_context();
  if coalesce((v_ctx->>'admin')::boolean, false) or coalesce((v_ctx->>'system')::boolean, false) then
    return coalesce(new, old);
  end if;

  for r in select * from public.required_write_permissions(tg_table_name, v_kind, v_old, v_new) loop
    if v_first_resource is null then
      v_first_resource := r.resource;
      v_first_action := r.action;
    end if;
    v_scope := v_ctx->'grants'->>(r.resource || ':' || r.action);
    if v_scope is not null
       and public.row_in_permission_scope(v_scope, v_ctx, v_old, v_kind)
       and public.row_in_permission_scope(v_scope, v_ctx, v_new, v_kind) then
      v_ok := true;
      exit;
    end if;
  end loop;
  if v_ok or v_first_resource is null then return coalesce(new, old); end if;

  insert into public.permission_violations (mode, actor_id, actor_username, table_name, operation, resource, action, row_key, workshop)
  values (
    v_mode, v_ctx->>'uid', coalesce(v_ctx->>'username', ''), tg_table_name, v_kind, v_first_resource, v_first_action,
    coalesce(coalesce(v_new, v_old)->>v_pk, ''), coalesce(coalesce(v_new, v_old)->>'workshop', '')
  );
  if v_mode = 'enforce' then
    raise exception 'Không đủ quyền % ở % (bảng %)', v_first_action, v_first_resource, tg_table_name
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.current_permission_context() from public, anon;
revoke all on function public.enforce_write_permission() from public, anon;
grant execute on function public.current_permission_context() to authenticated;

-- ---------- Gắn trigger vào bảng nghiệp vụ (= bảng có luật ở TABLE_WRITE_RULES, trừ bảng hệ thống) ----------
do $$
declare
  v_tables text[] := array[
    'import_shipments', 'material_imports', 'daily_locks', 'scraps',
    'production_wips', 'production_locks', 'domestic_sales', 'packagings', 'qc_checklists', 'qc_locks',
    'lot_inputs', 'lot_waivers', 'lot_dispatches', 'label_prints',
    'sales_invoices', 'sales_items', 'sales_orders', 'order_items', 'export_orders', 'export_items',
    'balancing_periods', 'balancing_inputs', 'balancing_outputs', 'monthly_stock_ledger', 'reconciliation_runs',
    'material_opening_stock', 'finished_goods_opening_stock', 'nxt_snapshots',
    'suppliers', 'customers', 'material_types', 'products', 'batter_types', 'storage_locations', 'finished_goods'
  ];
  t text;
begin
  foreach t in array v_tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Bỏ qua % (chưa có bảng)', t;
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', t || '_enforce_permission', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_write_permission(%L)',
      t || '_enforce_permission', t, case when t = 'finished_goods' then 'code' else 'id' end);
  end loop;
end $$;

-- KIỂM sau khi chạy:
--   select mode from public.permission_enforcement;                       -- 'log'
--   select count(*) from public.default_role_permissions;                 -- = số ô của DEFAULT_ROLE_PERMISSIONS
--   select tgrelid::regclass, tgname from pg_trigger where tgname like '%_enforce_permission' order by 1;
--   select * from public.permission_violations order by at desc limit 50; -- theo dõi chế độ 'log'
-- BẬT CHẶN THẬT (🔴, sau khi 'log' sạch):  update public.permission_enforcement set mode = 'enforce', updated_at = now();
-- TẮT TỨC THÌ (không deploy):              update public.permission_enforcement set mode = 'off', updated_at = now();

-- ============================================================
-- ROLLBACK — gỡ hẳn (không ảnh hưởng dữ liệu nghiệp vụ; policy cũ co_vai_tro() vẫn nguyên):
--   do $$ declare r record; begin
--     for r in select tgrelid::regclass as t, tgname from pg_trigger where tgname like '%\_enforce\_permission' loop
--       execute format('drop trigger if exists %I on %s', r.tgname, r.t);
--     end loop; end $$;
--   drop function if exists public.enforce_write_permission();
--   drop function if exists public.required_write_permissions(text, text, jsonb, jsonb);
--   drop function if exists public.row_in_permission_scope(text, jsonb, jsonb, text);
--   drop function if exists public.current_permission_context();
--   drop function if exists public.normalize_role_slug(text);
--   drop table if exists public.permission_violations;
--   drop table if exists public.permission_enforcement;
--   drop table if exists public.default_role_permissions;
-- ============================================================
