-- ============================================================
-- Baseafood MES — 0075: PHÒNG KẾ HOẠCH · XUẤT KHẨU (đợt 1) — /planning-export
--
-- Vì sao (chủ dự án 2026-10-20, chốt 11 câu + duyệt ba-spec): hồ sơ xuất khẩu đang kẹp giấy,
-- sổ kế hoạch là Excel, hợp đồng / lệnh SX / lệnh xuất / invoice không ghi số của nhau ⇒ chỉ
-- người nhớ mới nối được. Module giữ trục tháng × khách × hợp đồng × chuyến, 6 bước dạng
-- checklist + file, tự tính khép kín theo dung sai.
-- Spec: docs/spec/xuat-khau-phong-ke-hoach.md · ba-spec: docs/app-map/41-export-planning.ba-spec.md.
--
-- Gồm:
--   1. customers: 6 cột thông tin xuất khẩu (rỗng mặc định).
--   2. 8 bảng mới: export_contracts · export_contract_revisions (bản, KHÔNG ghi đè) ·
--      export_contract_approvals (kết quả BGĐ ký giấy, gắn BẢN) · export_deadline_extensions ·
--      export_shipments (chuyến = 1 cont) · export_step_items (bước 2–5) · export_files ·
--      export_payments (bước 6: gửi bộ chứng từ, tiền về).
--   3. Hàm has_export_permission(resource, action) — ô quyền của người đang gọi (0065).
--   4. RLS: export-plans (toàn module) · export-plans.loading (người đóng hàng CHỈ thêm file
--      4a/4b, không đọc giá) · export-plans.payments (bước 6).
--   5. Bucket `export-files` (chủ dự án TẠO TRƯỚC trên Dashboard, private, 20 MB) + policy theo
--      thư mục: <site>/export-files/<hợp đồng>/<contract|shipment|loading|payment>/…
--   6. Vai trò hệ thống mới `planner` (Nhân viên Kế hoạch, phòng `planning`):
--      current_user_departments() thêm nhánh planner (GIỮ NGUYÊN mọi nhánh cũ của 0072) +
--      thay trọn ma trận default_role_permissions (khuôn 0073, sinh từ DEFAULT_ROLE_PERMISSIONS —
--      test writePermissionsSql.test.ts so code ⇄ SQL). So với 0073: CHỈ THÊM 65 ô (planner 30 ·
--      export-plans* cho Ban GĐ / kế toán / người đóng hàng), không bớt ô nào.
--
-- KHÔNG đụng: RLS bảng cũ, bucket `documents` / `qc`, trigger 0065 (bảng mới chốt bằng RLS riêng),
-- dữ liệu /orders · /sales. KHÔNG khóa ngoại (giống 0070 / 0072) — liên kết mềm, app khai refColumns.
--
-- Mức độ rủi ro: 🔴 phần ma trận quyền + hàm phòng ban (chủ dự án đồng ý Q11 2026-10-20);
-- 🟡 phần còn lại (chỉ thêm). Idempotent: chạy lại nhiều lần không lỗi. Câu lùi ở cuối file.
-- THỨ TỰ: tạo bucket `export-files` → chạy file này (2 lần) → mới deploy code.
-- ============================================================

-- ---------- 1. Khách hàng: thông tin xuất khẩu ----------
alter table public.customers add column if not exists country text not null default '';
alter table public.customers add column if not exists address text not null default '';
alter table public.customers add column if not exists default_port text not null default '';
alter table public.customers add column if not exists payment_terms text not null default '';
alter table public.customers add column if not exists contact_name text not null default '';
alter table public.customers add column if not exists contact_email text not null default '';

-- ---------- 2. Bảng ----------
create table if not exists public.export_contracts (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  customer_id   text not null default '',
  contract_no   text not null check (length(btrim(contract_no)) > 0),
  signed_on     date,
  order_ref     text not null default '',
  status        text not null default 'open' check (status in ('open', 'cancelled', 'closed')),
  cancel_reason text not null default '',
  close_reason  text not null default '',
  note          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- R9: số HĐ duy nhất theo khách, không phân hoa thường.
create unique index if not exists export_contracts_no_uq on public.export_contracts (site_id, customer_id, lower(btrim(contract_no)));

create table if not exists public.export_contract_revisions (
  id             text primary key,
  site_id        text not null default 'bsf1' references public.sites(id),
  contract_id    text not null,
  revision_no    integer not null check (revision_no >= 0),
  revised_on     date,
  change_summary text not null default '',
  terms          jsonb not null default '{}'::jsonb,
  lines          jsonb not null default '[]'::jsonb,
  file_path      text not null default '',
  file_name      text not null default '',
  recorded_by    text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists export_contract_revisions_no_uq on public.export_contract_revisions (site_id, contract_id, revision_no);

create table if not exists public.export_contract_approvals (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  contract_id   text not null,
  revision_id   text not null,
  decision      text not null check (decision in ('approved', 'needs-revision', 'rejected')),
  approver_name text not null default '',
  decided_on    date,
  reason        text not null default '',
  file_path     text not null default '',
  file_name     text not null default '',
  recorded_by   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists export_contract_approvals_revision_idx on public.export_contract_approvals (site_id, revision_id);

create table if not exists public.export_deadline_extensions (
  id           text primary key,
  site_id      text not null default 'bsf1' references public.sites(id),
  contract_id  text not null,
  new_deadline date not null,
  confirmed_on date,
  note         text not null default '',
  file_path    text not null default '',
  file_name    text not null default '',
  recorded_by  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.export_shipments (
  id                text primary key,
  site_id           text not null default 'bsf1' references public.sites(id),
  contract_id       text not null,
  plan_month        text not null default '',
  kind              text not null default '40RF' check (kind in ('20RF', '40RF', '40HC-RF', 'truck', 'consolidated')),
  goods_summary     text not null default '',
  planned_kg        numeric,
  lot_code          text not null default '',
  port_of_discharge text not null default '',
  booking_no        text not null default '',
  loading_date      date,
  etd               date,
  eta               date,
  vessel_voyage     text not null default '',
  container_no      text not null default '',
  seal_no           text not null default '',
  status            text not null default 'open' check (status in ('open', 'cancelled')),
  cancel_reason     text not null default '',
  note              text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists export_shipments_contract_idx on public.export_shipments (site_id, contract_id);

create table if not exists public.export_step_items (
  id             text primary key,
  site_id        text not null default 'bsf1' references public.sites(id),
  shipment_id    text not null,
  step           text not null check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order', 'document')),
  doc_kind       text not null default '',
  doc_form       text not null default '',
  doc_issuer     text not null default '',
  state          text not null default 'not-started' check (state in ('not-started', 'in-progress', 'done', 'not-applicable')),
  number         text not null default '',
  issued_on      date,
  note           text not null default '',
  na_reason      text not null default '',
  shared_from_id text not null default '',
  cartons        numeric,
  net_kg         numeric,
  amount         numeric,
  on_board_date  date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists export_step_items_shipment_idx on public.export_step_items (site_id, shipment_id);

create table if not exists public.export_files (
  id           text primary key,
  site_id      text not null default 'bsf1' references public.sites(id),
  contract_id  text not null default '',
  shipment_id  text not null default '',
  step_item_id text not null default '',
  step         text not null check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order', 'document')),
  path         text not null default '',
  file_name    text not null default '',
  layer_no     integer,
  caption      text not null default '',
  uploaded_by  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists export_files_shipment_idx on public.export_files (site_id, shipment_id);

create table if not exists public.export_payments (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  contract_id text not null default '',
  shipment_id text not null default '',
  kind        text not null default 'payment' check (kind in ('payment', 'documents-sent')),
  date        date,
  amount      numeric,
  currency    text not null default 'USD',
  method      text not null default '',
  note        text not null default '',
  file_path   text not null default '',
  file_name   text not null default '',
  recorded_by text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['export_contracts', 'export_contract_revisions', 'export_contract_approvals', 'export_deadline_extensions',
                           'export_shipments', 'export_step_items', 'export_files', 'export_payments'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.cap_nhat_thoi_diem_sua()', -- naming-ok: hàm 0001
                   t || '_touch_updated_at', t);
  end loop;
end $$;

-- ---------- 3. Hàm quyền ----------
-- Ô quyền <resource>:<action> của người đang gọi (ma trận + vai trò đã chỉnh + chỉnh riêng, 0065).
create or replace function public.has_export_permission(p_resource text, p_action text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ctx jsonb := public.current_permission_context();
begin
  if coalesce((v_ctx->>'admin')::boolean, false) then return true; end if;
  return coalesce(v_ctx->'grants', '{}'::jsonb) ? (p_resource || ':' || p_action);
end;
$$;
revoke all on function public.has_export_permission(text, text) from public, anon;
grant execute on function public.has_export_permission(text, text) to authenticated;

-- ---------- 4. RLS ----------
-- App ghi bằng UPSERT ⇒ policy insert + update cùng điều kiện (bài học 0065 / 0072).
-- Đọc: hợp đồng + chuyến ai có một trong ba tài nguyên cũng thấy (người đóng hàng cần tìm chuyến);
-- bản HĐ (có giá), duyệt, gia hạn, bước: chỉ export-plans; tiền về: export-plans.payments (+ xem module).
do $$
declare
  t text;
  v_read text;
  v_write text;
  v_delete text;
begin
  for t, v_read, v_write, v_delete in
    select * from (values
      ('export_contracts',
       'public.has_export_permission(''export-plans'', ''view'') or public.has_export_permission(''export-plans.loading'', ''view'') or public.has_export_permission(''export-plans.payments'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'')'),
      ('export_contract_revisions',
       'public.has_export_permission(''export-plans'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'')'),
      ('export_contract_approvals',
       'public.has_export_permission(''export-plans'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'')'),
      ('export_deadline_extensions',
       'public.has_export_permission(''export-plans'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'')'),
      ('export_shipments',
       'public.has_export_permission(''export-plans'', ''view'') or public.has_export_permission(''export-plans.loading'', ''view'') or public.has_export_permission(''export-plans.payments'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'')'),
      ('export_step_items',
       'public.has_export_permission(''export-plans'', ''view'')',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'')',
       'public.has_export_permission(''export-plans'', ''delete'') or public.has_export_permission(''export-plans'', ''update'')'),
      ('export_files',
       'public.has_export_permission(''export-plans'', ''view'') or (step in (''loading-plan'', ''loading-photos'') and public.has_export_permission(''export-plans.loading'', ''view''))',
       'public.has_export_permission(''export-plans'', ''create'') or public.has_export_permission(''export-plans'', ''update'') or (step in (''loading-plan'', ''loading-photos'') and public.has_export_permission(''export-plans.loading'', ''create''))',
       'public.has_export_permission(''export-plans'', ''delete'') or public.has_export_permission(''export-plans'', ''update'')'),
      ('export_payments',
       'public.has_export_permission(''export-plans.payments'', ''view'')',
       'public.has_export_permission(''export-plans.payments'', ''create'') or public.has_export_permission(''export-plans.payments'', ''update'')',
       'public.has_export_permission(''export-plans.payments'', ''delete'')')
    ) as x(t, r, w, d)
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, v_read);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, v_write);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, v_write, v_write);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, v_delete);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    foreach t in array array['export_contracts', 'export_contract_revisions', 'export_contract_approvals', 'export_deadline_extensions',
                             'export_shipments', 'export_step_items', 'export_files', 'export_payments'] loop
      execute format('drop trigger if exists %I on public.%I', t || '_sql_audit', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_vet_sua_truc_tiep()', -- naming-ok: hàm 0048
                     t || '_sql_audit', t);
    end loop;
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết'; -- naming-ok
  end if;
end $$;

-- ---------- 5. Bucket `export-files` (chủ dự án tạo trước trên Dashboard) ----------
-- Đường dẫn: <site>/export-files/<id hợp đồng>/<khu>/<id>-<tên file>, khu ∈ contract | shipment | loading | payment.
-- Đọc: export-plans xem mọi khu; người đóng hàng chỉ khu `loading`; bước 6 chỉ khu `payment`.
-- Tải lên: tương ứng quyền ghi của từng khu. Xóa: export-plans (Sửa / Xóa) — gỡ file tải nhầm.
-- Không có policy update (file không ghi đè).
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'export-files') then
    raise notice 'CHƯA có bucket "export-files" — tạo trên Dashboard (private, 20 MB) rồi chạy lại file này.';
  end if;
end $$;

drop policy if exists export_files_bucket_select on storage.objects;
drop policy if exists export_files_bucket_insert on storage.objects;
drop policy if exists export_files_bucket_delete on storage.objects;
create policy export_files_bucket_select on storage.objects
  for select to authenticated using (
    bucket_id = 'export-files'
    and (
      public.has_export_permission('export-plans', 'view')
      or (objects.name like '%/loading/%' and public.has_export_permission('export-plans.loading', 'view'))
      or (objects.name like '%/payment/%' and public.has_export_permission('export-plans.payments', 'view'))
    )
  );
create policy export_files_bucket_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'export-files'
    and (
      public.has_export_permission('export-plans', 'create')
      or public.has_export_permission('export-plans', 'update')
      or (objects.name like '%/loading/%' and public.has_export_permission('export-plans.loading', 'create'))
      or (objects.name like '%/payment/%' and (public.has_export_permission('export-plans.payments', 'create') or public.has_export_permission('export-plans.payments', 'update')))
    )
  );
create policy export_files_bucket_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'export-files'
    and (public.has_export_permission('export-plans', 'delete') or public.has_export_permission('export-plans', 'update'))
  );

-- ---------- 6a. Phòng ban: thêm nhánh `planner` (GIỮ NGUYÊN mọi nhánh của 0072) ----------
-- Lặp lại đúng SYSTEM_ROLE_DEPARTMENTS (src/lib/documents.ts). Thiếu nhánh này thì RLS tài liệu công ty
-- không cho Nhân viên Kế hoạch đọc QTI-KH-01 + 8 biểu mẫu (chủ sở hữu `planning`).
create or replace function public.current_user_departments()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with my_roles as (
    select public.normalize_role_slug(x) as role_id
      from public.user_profiles up,
           unnest(string_to_array(coalesce(up.roles, ''), ',')) x
     where up.id = (select auth.uid())::text
       and btrim(x) <> ''
  ),
  custom as (
    select r.role_id, btrim(ar.department) as department
      from my_roles r
      join public.app_roles ar on ar.id = r.role_id
     where coalesce(btrim(ar.department), '') <> ''
  ),
  defaults as (
    select unnest(case r.role_id
             when 'director' then array['board']
             when 'vice-director' then array['board']
             when 'chief-accountant' then array['accounting']
             when 'accountant' then array['accounting']
             when 'warehouse-keeper' then array['purchasing', 'warehouse']
             when 'manager-dong' then array['production-frozen']
             when 'manager-ca' then array['production-fish']
             when 'manager-kho' then array['production-dried']
             when 'vice-manager' then array['production-frozen', 'production-fish', 'production-dried']
             when 'team-leader' then array['production-frozen', 'production-fish', 'production-dried']
             when 'planner' then array['planning']
             else array[]::text[]
           end) as department
      from my_roles r
     where not exists (select 1 from custom c where c.role_id = r.role_id)
  )
  select coalesce(array_agg(distinct d.department), array[]::text[])
    from (select department from custom union all select department from defaults) d
$$;

-- ---------- 6b. Ma trận quyền mặc định (thay trọn — khuôn 0073) ----------
-- KHÔNG khai `planner` bằng một dòng app_roles: vai trò có dòng app_roles thì current_permission_context()
-- đọc role_permissions thay cho ma trận này ⇒ planner mất hết quyền.
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
  ('director', 'export-plans', 'view', 'all'),
  ('director', 'export-plans', 'export', 'all'),
  ('director', 'export-plans', 'view-price', 'all'),
  ('director', 'export-plans.loading', 'view', 'all'),
  ('director', 'export-plans.payments', 'view', 'all'),
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
  ('vice-director', 'export-plans', 'view', 'all'),
  ('vice-director', 'export-plans', 'export', 'all'),
  ('vice-director', 'export-plans', 'view-price', 'all'),
  ('vice-director', 'export-plans.loading', 'view', 'all'),
  ('vice-director', 'export-plans.payments', 'view', 'all'),
  ('vice-director', 'catalog.products', 'view', 'all'),
  ('vice-director', 'catalog.customers', 'view', 'all'),
  ('vice-director', 'catalog.suppliers', 'view', 'all'),
  ('vice-director', 'catalog.material-types', 'view', 'all'),
  ('vice-director', 'catalog.batters', 'view', 'all'),
  ('vice-director', 'catalog.storage-locations', 'view', 'all'),
  ('vice-director', 'catalog.finished-goods', 'view', 'all'),
  ('chief-accountant', 'dashboard', 'view', 'all'),
  ('chief-accountant', 'dashboard', 'export', 'all'),
  ('chief-accountant', 'my-tasks', 'view', 'all'),
  ('chief-accountant', 'my-tasks', 'create', 'all'),
  ('chief-accountant', 'my-tasks', 'update', 'all'),
  ('chief-accountant', 'my-tasks', 'delete', 'all'),
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
  ('chief-accountant', 'documents', 'view', 'all'),
  ('chief-accountant', 'documents', 'create', 'all'),
  ('chief-accountant', 'documents', 'update', 'all'),
  ('chief-accountant', 'documents', 'delete', 'all'),
  ('chief-accountant', 'documents', 'export', 'all'),
  ('chief-accountant', 'export-plans', 'view', 'all'),
  ('chief-accountant', 'export-plans', 'export', 'all'),
  ('chief-accountant', 'export-plans', 'view-price', 'all'),
  ('chief-accountant', 'export-plans.loading', 'view', 'all'),
  ('chief-accountant', 'export-plans.payments', 'view', 'all'),
  ('chief-accountant', 'export-plans.payments', 'create', 'all'),
  ('chief-accountant', 'export-plans.payments', 'update', 'all'),
  ('chief-accountant', 'export-plans.payments', 'delete', 'all'),
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
  ('accountant', 'my-tasks', 'view', 'all'),
  ('accountant', 'my-tasks', 'create', 'all'),
  ('accountant', 'my-tasks', 'update', 'all'),
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
  ('accountant', 'export-plans', 'view', 'all'),
  ('accountant', 'export-plans', 'export', 'all'),
  ('accountant', 'export-plans', 'view-price', 'all'),
  ('accountant', 'export-plans.loading', 'view', 'all'),
  ('accountant', 'export-plans.payments', 'view', 'all'),
  ('accountant', 'export-plans.payments', 'create', 'all'),
  ('accountant', 'export-plans.payments', 'update', 'all'),
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
  ('warehouse-keeper', 'export-plans.loading', 'view', 'all'),
  ('warehouse-keeper', 'export-plans.loading', 'create', 'all'),
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
  ('manager-dong', 'my-tasks', 'view', 'all'),
  ('manager-dong', 'my-tasks', 'create', 'all'),
  ('manager-dong', 'my-tasks', 'update', 'all'),
  ('manager-dong', 'my-tasks', 'delete', 'all'),
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
  ('manager-dong', 'export-plans.loading', 'view', 'all'),
  ('manager-dong', 'export-plans.loading', 'create', 'all'),
  ('manager-ca', 'dashboard', 'view', 'all'),
  ('manager-ca', 'my-tasks', 'view', 'all'),
  ('manager-ca', 'my-tasks', 'create', 'all'),
  ('manager-ca', 'my-tasks', 'update', 'all'),
  ('manager-ca', 'my-tasks', 'delete', 'all'),
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
  ('manager-ca', 'export-plans.loading', 'view', 'all'),
  ('manager-ca', 'export-plans.loading', 'create', 'all'),
  ('manager-kho', 'dashboard', 'view', 'all'),
  ('manager-kho', 'my-tasks', 'view', 'all'),
  ('manager-kho', 'my-tasks', 'create', 'all'),
  ('manager-kho', 'my-tasks', 'update', 'all'),
  ('manager-kho', 'my-tasks', 'delete', 'all'),
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
  ('manager-kho', 'export-plans.loading', 'view', 'all'),
  ('manager-kho', 'export-plans.loading', 'create', 'all'),
  ('vice-manager', 'dashboard', 'view', 'all'),
  ('vice-manager', 'my-tasks', 'view', 'all'),
  ('vice-manager', 'my-tasks', 'create', 'all'),
  ('vice-manager', 'my-tasks', 'update', 'all'),
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
  ('vice-manager', 'export-plans.loading', 'view', 'all'),
  ('vice-manager', 'export-plans.loading', 'create', 'all'),
  ('vice-manager', 'catalog.products', 'view', 'all'),
  ('vice-manager', 'catalog.customers', 'view', 'all'),
  ('vice-manager', 'catalog.suppliers', 'view', 'all'),
  ('vice-manager', 'catalog.material-types', 'view', 'all'),
  ('vice-manager', 'catalog.batters', 'view', 'all'),
  ('vice-manager', 'catalog.storage-locations', 'view', 'all'),
  ('vice-manager', 'catalog.finished-goods', 'view', 'all'),
  ('planner', 'my-tasks', 'view', 'all'),
  ('planner', 'my-tasks', 'create', 'all'),
  ('planner', 'my-tasks', 'update', 'all'),
  ('planner', 'my-tasks', 'delete', 'all'),
  ('planner', 'export-plans', 'view', 'all'),
  ('planner', 'export-plans', 'create', 'all'),
  ('planner', 'export-plans', 'update', 'all'),
  ('planner', 'export-plans', 'delete', 'all'),
  ('planner', 'export-plans', 'export', 'all'),
  ('planner', 'export-plans', 'view-price', 'all'),
  ('planner', 'export-plans.loading', 'view', 'all'),
  ('planner', 'export-plans.loading', 'create', 'all'),
  ('planner', 'export-plans.payments', 'view', 'all'),
  ('planner', 'export-plans.payments', 'create', 'all'),
  ('planner', 'export-plans.payments', 'update', 'all'),
  ('planner', 'export-plans.payments', 'delete', 'all'),
  ('planner', 'orders', 'view', 'all'),
  ('planner', 'export-report', 'view', 'all'),
  ('planner', 'export-report', 'export', 'all'),
  ('planner', 'qr', 'view', 'all'),
  ('planner', 'warehouse', 'view', 'all'),
  ('planner', 'catalog.products', 'view', 'all'),
  ('planner', 'catalog.customers', 'view', 'all'),
  ('planner', 'catalog.customers', 'create', 'all'),
  ('planner', 'catalog.customers', 'update', 'all'),
  ('planner', 'catalog.suppliers', 'view', 'all'),
  ('planner', 'catalog.material-types', 'view', 'all'),
  ('planner', 'catalog.batters', 'view', 'all'),
  ('planner', 'catalog.storage-locations', 'view', 'all'),
  ('planner', 'catalog.finished-goods', 'view', 'all');

-- KIỂM sau khi chạy (kỳ vọng: 8 bảng rls = true; 4 policy mỗi bảng; 3 policy bucket; 525 ô ma trận, 30 ô planner;
-- 6 cột mới ở customers; current_user_departments có nhánh planner):
--   select relname, relrowsecurity from pg_class where relname like 'export\_%' and relkind = 'r';
--   select tablename, count(*) from pg_policies where tablename like 'export\_%' group by 1;
--   select policyname from pg_policies where policyname like 'export_files_bucket_%';
--   select count(*), count(*) filter (where role_id = 'planner') from public.default_role_permissions;
--   select column_name from information_schema.columns where table_name = 'customers' and column_name in ('country', 'default_port');

-- ROLLBACK (bảng mới — mất sổ xuất khẩu đã ghi; FILE trên bucket còn nguyên, xóa tay nếu cần):
--   drop policy if exists export_files_bucket_select on storage.objects;
--   drop policy if exists export_files_bucket_insert on storage.objects;
--   drop policy if exists export_files_bucket_delete on storage.objects;
--   drop table if exists public.export_payments, public.export_files, public.export_step_items, public.export_shipments,
--     public.export_deadline_extensions, public.export_contract_approvals, public.export_contract_revisions, public.export_contracts;
--   drop function if exists public.has_export_permission(text, text);
--   delete from public.default_role_permissions where role_id = 'planner' or resource like 'export-plans%';
--   -- current_user_departments(): chạy lại khối hàm của 0072 (bỏ nhánh planner).
--   -- 🔴 chỉ khi chưa ai ghi thông tin xuất khẩu của khách:
--   -- alter table public.customers drop column if exists country, drop column if exists address, drop column if exists default_port,
--   --   drop column if exists payment_terms, drop column if exists contact_name, drop column if exists contact_email;
