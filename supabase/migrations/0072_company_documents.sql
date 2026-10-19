-- ============================================================
-- Baseafood MES — 0072: TÀI LIỆU CÔNG TY (company_documents + document_versions) — /documents
--
-- Vì sao (chủ dự án 2026-10-19): quy trình, biểu mẫu, chứng nhận, hồ sơ năng lực đang là file
-- rời + giấy kẹp. BRC 9 yêu cầu kiểm soát tài liệu: mã, lần ban hành, người duyệt, ngày hiệu
-- lực, bản cũ thu hồi nhưng tra lại được, và CHỈ PHÒNG LIÊN QUAN được xem.
-- Spec: docs/spec/quan-ly-tai-lieu.md · doc: docs/app-map/40-documents.md.
--
-- Gồm:
--   1. app_roles.department (cột mới, có thể rỗng) — phòng ban của vai trò tự tạo / đã chỉnh.
--   2. Bảng company_documents (tài liệu) + document_versions (lần ban hành, không ghi đè).
--   3. Hàm current_user_departments() / can_view_company_document() / has_document_permission()
--      — ĐỌC lọc theo phòng ban (tài nguyên đầu tiên lọc dòng khi đọc), GHI theo ô
--      documents.* của ma trận quyền (current_permission_context(), 0065).
--   4. Policy storage.objects cho bucket `documents` (chủ dự án TẠO BUCKET TRƯỚC trên Dashboard,
--      private, 20 MB) — đọc file: chỉ người xem được tài liệu chứa file đó.
--   5. Dữ liệu đầu tiên: QTI-KH-01 Quản lý đơn hàng + 8 biểu mẫu, lần ban hành 01 (02/01/2023).
--
-- KHÔNG đụng: ma trận default_role_permissions (ô ghi documents.* để trống ⇒ trước mắt chỉ admin
-- làm — chủ dự án 2026-10-19), RLS bảng khác, bucket `qc`, trigger chốt quyền 0065.
-- KHÔNG khóa ngoại (giống task_assignments 0070): parent_id / document_id là liên kết mềm, app
-- khai refColumns cho chế độ demo (tiền tố `demo:`).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM (2 bảng, 1 cột rỗng, 3 hàm, policy mới). Idempotent: chạy
-- lại nhiều lần không lỗi, không nhân đôi dữ liệu đầu. Câu lùi ở khối ROLLBACK cuối file.
-- THỨ TỰ: tạo bucket `documents` → chạy file này (2 lần) → mới deploy code.
-- ============================================================

-- ---------- 1. Phòng ban của vai trò ----------
alter table public.app_roles add column if not exists department text;

-- ---------- 2. Bảng ----------
create table if not exists public.company_documents (
  id                  text primary key,
  site_id             text not null default 'bsf1' references public.sites(id),
  code                text not null check (length(btrim(code)) > 0),
  title               text not null check (length(btrim(title)) > 0),
  kind                text not null default 'procedure'
                        check (kind in ('procedure', 'instruction', 'form', 'certificate', 'capability_profile', 'other')),
  parent_id           text not null default '',
  owner_department    text not null default '',
  visibility          text not null default 'departments' check (visibility in ('company', 'departments')),
  visible_departments text[] not null default '{}',
  retention_years     integer not null default 0 check (retention_years >= 0),
  expires_on          date,
  is_withdrawn        boolean not null default false,
  note                text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- DOC-R10: mã duy nhất theo site, không phân hoa thường.
create unique index if not exists company_documents_code_uq on public.company_documents (site_id, upper(btrim(code)));
create index if not exists company_documents_parent_idx on public.company_documents (site_id, parent_id);

create table if not exists public.document_versions (
  id               text primary key,
  site_id          text not null default 'bsf1' references public.sites(id),
  document_id      text not null,
  revision_no      integer not null check (revision_no > 0),
  effective_date   date,
  change_summary   text not null default '',
  status           text not null default 'draft'
                     check (status in ('draft', 'in_review', 'pending_approval', 'active', 'obsolete')),
  approval_mode    text not null default 'paper' check (approval_mode in ('app', 'paper')),
  prepared_by_name text not null default '',
  reviewed_by_name text not null default '',
  approved_by_name text not null default '',
  reviewer_id      text not null default '',
  approver_id      text not null default '',
  reviewed_at      timestamptz,
  approved_at      timestamptz,
  return_reason    text not null default '',
  pdf_path         text not null default '',
  source_path      text not null default '',
  pdf_file_name    text not null default '',
  source_file_name text not null default '',
  obsoleted_on     date,
  recorded_by_name text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists document_versions_revision_uq on public.document_versions (site_id, document_id, revision_no);
create index if not exists document_versions_pdf_path_idx on public.document_versions (pdf_path) where pdf_path <> '';
create index if not exists document_versions_source_path_idx on public.document_versions (source_path) where source_path <> '';

drop trigger if exists company_documents_touch_updated_at on public.company_documents;
create trigger company_documents_touch_updated_at
  before update on public.company_documents
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001
drop trigger if exists document_versions_touch_updated_at on public.document_versions;
create trigger document_versions_touch_updated_at
  before update on public.document_versions
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

-- ---------- 3. Hàm quyền ----------
-- Phòng ban của người đang gọi = HỢP phòng các vai trò: app_roles.department nếu có, không thì
-- mặc định của vai trò hệ thống (= SYSTEM_ROLE_DEPARTMENTS ở src/lib/documents.ts).
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
             else array[]::text[]
           end) as department
      from my_roles r
     where not exists (select 1 from custom c where c.role_id = r.role_id)
  )
  select coalesce(array_agg(distinct d.department), array[]::text[])
    from (select department from custom union all select department from defaults) d
$$;

-- DOC-R5: admin / Ban giám đốc thấy hết; còn lại: cả công ty, phòng sở hữu, hoặc phòng được chọn.
create or replace function public.can_view_company_document(p_visibility text, p_owner text, p_visible text[])
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_depts text[];
begin
  if not public.co_vai_tro() then return false; end if; -- naming-ok: hàm 0057
  if public.la_admin() then return true; end if; -- naming-ok: hàm 0057
  v_depts := public.current_user_departments();
  return 'board' = any(v_depts)
      or p_visibility = 'company'
      or coalesce(p_owner, '') = any(v_depts)
      or coalesce(p_visible, array[]::text[]) && v_depts;
end;
$$;

-- Ô quyền documents.<hành động> của người đang gọi (ma trận + chỉnh riêng, 0065).
create or replace function public.has_document_permission(p_action text)
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
  return coalesce(v_ctx->'grants', '{}'::jsonb) ? ('documents:' || p_action);
end;
$$;

revoke all on function public.current_user_departments() from public, anon;
revoke all on function public.can_view_company_document(text, text, text[]) from public, anon;
revoke all on function public.has_document_permission(text) from public, anon;
grant execute on function public.current_user_departments() to authenticated;
grant execute on function public.can_view_company_document(text, text, text[]) to authenticated;
grant execute on function public.has_document_permission(text) to authenticated;

-- ---------- RLS hai bảng ----------
-- App ghi bằng UPSERT (INSERT … ON CONFLICT DO UPDATE): Postgres kiểm CẢ policy insert lẫn
-- update ⇒ hai policy ghi cùng điều kiện "Thêm HOẶC Sửa" (bài học 0065).
alter table public.company_documents enable row level security;
drop policy if exists company_documents_select on public.company_documents;
drop policy if exists company_documents_insert on public.company_documents;
drop policy if exists company_documents_update on public.company_documents;
drop policy if exists company_documents_delete on public.company_documents;
create policy company_documents_select on public.company_documents
  for select to authenticated using (public.can_view_company_document(visibility, owner_department, visible_departments));
create policy company_documents_insert on public.company_documents
  for insert to authenticated with check (public.has_document_permission('create') or public.has_document_permission('update'));
create policy company_documents_update on public.company_documents
  for update to authenticated
  using (public.has_document_permission('create') or public.has_document_permission('update'))
  with check (public.has_document_permission('create') or public.has_document_permission('update'));
create policy company_documents_delete on public.company_documents
  for delete to authenticated using (public.has_document_permission('delete'));
revoke all on public.company_documents from anon;
grant select, insert, update, delete on public.company_documents to authenticated;

-- Lần ban hành: xem được khi xem được tài liệu chứa nó.
alter table public.document_versions enable row level security;
drop policy if exists document_versions_select on public.document_versions;
drop policy if exists document_versions_insert on public.document_versions;
drop policy if exists document_versions_update on public.document_versions;
drop policy if exists document_versions_delete on public.document_versions;
create policy document_versions_select on public.document_versions
  for select to authenticated using (
    exists (
      select 1 from public.company_documents d
       where d.id = document_versions.document_id
         and public.can_view_company_document(d.visibility, d.owner_department, d.visible_departments)
    )
  );
create policy document_versions_insert on public.document_versions
  for insert to authenticated with check (
    public.has_document_permission('create') or public.has_document_permission('update') or public.has_document_permission('approve')
  );
create policy document_versions_update on public.document_versions
  for update to authenticated
  using (public.has_document_permission('create') or public.has_document_permission('update') or public.has_document_permission('approve'))
  with check (public.has_document_permission('create') or public.has_document_permission('update') or public.has_document_permission('approve'));
create policy document_versions_delete on public.document_versions
  for delete to authenticated using (public.has_document_permission('delete'));
revoke all on public.document_versions from anon;
grant select, insert, update, delete on public.document_versions to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists company_documents_sql_audit on public.company_documents';
    execute 'create trigger company_documents_sql_audit
               after insert or update or delete on public.company_documents
               for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
    execute 'drop trigger if exists document_versions_sql_audit on public.document_versions';
    execute 'create trigger document_versions_sql_audit
               after insert or update or delete on public.document_versions
               for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết'; -- naming-ok
  end if;
end $$;

-- ---------- 4. Bucket `documents` (chủ dự án tạo trước trên Dashboard) ----------
-- Đọc: file thuộc một lần ban hành của tài liệu mình xem được — HOẶC người có ô ghi (Thêm / Sửa /
-- Duyệt): lúc tải lên file chưa thuộc lần ban hành nào mà Storage vẫn đọc lại dòng vừa tạo
-- (insert … returning) ⇒ thiếu nhánh này thì người có quyền cũng không tải lên được (kiểm PGlite).
-- Tải lên: có ô Thêm / Sửa / Duyệt.
-- Xóa: có ô Xóa (gỡ file tải nhầm). Không có policy update (file không ghi đè — DOC-R2).
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'documents') then
    raise notice 'CHƯA có bucket "documents" — tạo trên Dashboard (private, 20 MB) rồi chạy lại file này.';
  end if;
end $$;

drop policy if exists documents_bucket_select on storage.objects;
drop policy if exists documents_bucket_insert on storage.objects;
drop policy if exists documents_bucket_delete on storage.objects;
create policy documents_bucket_select on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
          from public.document_versions v
          join public.company_documents d on d.id = v.document_id
         where (v.pdf_path = objects.name or v.source_path = objects.name)
           and public.can_view_company_document(d.visibility, d.owner_department, d.visible_departments)
      )
      or public.has_document_permission('create')
      or public.has_document_permission('update')
      or public.has_document_permission('approve')
    )
  );
create policy documents_bucket_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and (public.has_document_permission('create') or public.has_document_permission('update') or public.has_document_permission('approve'))
  );
create policy documents_bucket_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.has_document_permission('delete'));

-- ---------- 5. Dữ liệu đầu tiên: QTI-KH-01 + 8 biểu mẫu (docs/ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) ----------
-- Chưa có file PDF (bản giấy) — tải lên sau ở màn /documents. Không nhân đôi khi chạy lại.
insert into public.company_documents (id, site_id, code, title, kind, parent_id, owner_department, visibility, visible_departments, retention_years, note) values
  ('doc-qti-kh-01',    'bsf1', 'QTI-KH-01',    'Quy trình quản lý đơn hàng',  'procedure', '',              'planning', 'departments', '{}', 2, 'Chuẩn tham chiếu: BRC 9, Sổ tay chất lượng, Halal.'),
  ('doc-qti-kh-01-01', 'bsf1', 'QTI-KH-01-01', 'Sổ thông tin khách hàng',      'form', 'doc-qti-kh-01', 'planning', 'departments', '{}', 2, ''),
  ('doc-qti-kh-01-02', 'bsf1', 'QTI-KH-01-02', 'Offer sheet (báo giá)',        'form', 'doc-qti-kh-01', 'planning', 'departments', '{}', 2, ''),
  ('doc-qti-kh-01-03', 'bsf1', 'QTI-KH-01-03', 'Hợp đồng kinh tế hoặc L/C',     'form', 'doc-qti-kh-01', 'planning', 'departments', '{}', 2, ''),
  ('doc-qti-kh-01-04', 'bsf1', 'QTI-KH-01-04', 'Lệnh sản xuất',                'form', 'doc-qti-kh-01', 'planning', 'departments', '{production-frozen,production-fish,production-dried,warehouse,quality}', 2, 'Gửi Kỹ thuật, Kho, Phân xưởng SX (QTI-KH-01 bước 8).'),
  ('doc-qti-kh-01-05', 'bsf1', 'QTI-KH-01-05', 'Sổ kho (tồn kho hằng ngày)',   'form', 'doc-qti-kh-01', 'planning', 'departments', '{warehouse}', 2, ''),
  ('doc-qti-kh-01-06', 'bsf1', 'QTI-KH-01-06', 'Giấy đề nghị xuất hàng',       'form', 'doc-qti-kh-01', 'planning', 'departments', '{production-frozen}', 2, ''),
  ('doc-qti-kh-01-07', 'bsf1', 'QTI-KH-01-07', 'Lệnh xuất hàng',               'form', 'doc-qti-kh-01', 'planning', 'departments', '{accounting,warehouse,production-frozen}', 2, 'Gửi Kế toán, Kho, Phân xưởng Đông (QTI-KH-01 bước 11).'),
  ('doc-qti-kh-01-08', 'bsf1', 'QTI-KH-01-08', 'Giấy báo list thực tế',        'form', 'doc-qti-kh-01', 'planning', 'departments', '{accounting}', 2, '')
on conflict (id) do nothing;

insert into public.document_versions (id, site_id, document_id, revision_no, effective_date, change_summary, status, approval_mode, prepared_by_name, reviewed_by_name, approved_by_name, recorded_by_name)
select 'docv-' || substr(d.id, 5) || '-r01', 'bsf1', d.id, 1, date '2023-01-02',
       'Cập nhật toàn bộ theo BRC 9 (lần sửa trước: 02/01/2019 theo BRC 8).', 'active', 'paper',
       'Phạm Thị Phương Thảo — Phó phòng Kế hoạch', 'Hồ Thị Phượng — Phó giám đốc', 'Huỳnh Minh Tường — Giám đốc',
       'Nạp sẵn từ bản PDF (0072)'
  from public.company_documents d
 where d.id like 'doc-qti-kh-01%'
on conflict (id) do nothing;

-- KIỂM sau khi chạy (kỳ vọng: rls = true cả 2 bảng; 4 policy mỗi bảng; 3 policy bucket; 9 tài liệu, 9 lần ban hành):
--   select relname, relrowsecurity from pg_class where relname in ('company_documents', 'document_versions');
--   select tablename, policyname, cmd from pg_policies where tablename in ('company_documents', 'document_versions') or policyname like 'documents_bucket_%';
--   select count(*) from public.company_documents; select count(*) from public.document_versions;
--   select column_name from information_schema.columns where table_name = 'app_roles' and column_name = 'department';

-- ROLLBACK (bảng mới — chỉ mất danh mục tài liệu; FILE trên bucket còn nguyên, xóa tay nếu cần):
--   drop policy if exists documents_bucket_select on storage.objects;
--   drop policy if exists documents_bucket_insert on storage.objects;
--   drop policy if exists documents_bucket_delete on storage.objects;
--   drop table if exists public.document_versions;
--   drop table if exists public.company_documents;
--   drop function if exists public.has_document_permission(text);
--   drop function if exists public.can_view_company_document(text, text, text[]);
--   drop function if exists public.current_user_departments();
--   alter table public.app_roles drop column if exists department;  -- 🔴 chỉ khi chưa ai chọn phòng cho vai trò
