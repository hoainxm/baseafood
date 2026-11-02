-- ============================================================
-- Baseafood MES — 0091: BỘ SOẠN VĂN BẢN TỪ MẪU (file Lệnh sản xuất Word / PDF và các văn bản sau này)
--
-- Vì sao (2026-11-02, ba-spec docs/app-map/54-document-composer.ba-spec.md): Phòng Kế hoạch đang gõ tay
-- file LSX (QTI-KH-01-04) trong Word dù số liệu đã có ở Lệnh sản xuất trên app. Bộ soạn điền sẵn 42 ô từ
-- lệnh, cho sửa, xem trước, xuất Word / PDF; lưu bản soạn + ẢNH CHỤP mỗi lần xuất (hồ sơ lưu 2 năm — R17).
--
-- Làm gì:
--   1. 3 bảng MỚI (khóa ngoại mềm như mọi bảng nghiệp vụ, có site_id):
--      `document_templates` (khuôn Word quản trị tải lên: loại văn bản, phiên bản, đường dẫn file, thẻ, đang dùng / ngưng),
--      `composed_documents` (bản soạn: loại văn bản, nguồn, giá trị + nguồn từng ô, lần sửa của nguồn lúc soạn,
--        khách + mặt hàng để tìm "lần trước"; cột `resource` = tài nguyên quyền của loại văn bản),
--      `composed_document_exports` (mỗi lần xuất: định dạng, khuôn đã dùng, ảnh chụp giá trị, người, lúc).
--   2. RLS theo cột `resource` của từng dòng (has_export_permission — 0075), nên dùng chung cho mọi loại văn bản:
--      có Thêm / Sửa ⇒ đọc + ghi; CHỈ Xem ⇒ chỉ đọc bản soạn của nguồn mình thấy được (Lệnh sản xuất: chỉ lệnh
--      đã phát hành — RLS 0088 áp vào truy vấn con). Khuôn: ai đăng nhập cũng đọc, chỉ quản trị ghi.
--      KHÔNG xóa bản soạn / lần xuất / khuôn trên số thật (R17); chỉ dòng `site-demo` xóa được (dọn bộ demo).
--   3. Bucket private `document-templates` (TẠO TRƯỚC trên Dashboard, 20 MB): đọc khi đăng nhập, chỉ quản trị tải lên.
--
-- KHÔNG đụng: ma trận quyền (dùng lại `production-orders`, không thêm tài nguyên) ⇒ chạy độc lập thứ tự với
--   0080 … 0090. Bảng Lệnh sản xuất / Xuất khẩu / Nhập khẩu giữ nguyên (R4 — soạn file không ghi ngược lệnh).
-- Mức độ rủi ro: 🟡 (chỉ thêm bảng + bucket). Cần 0088 (bảng production_orders) đã chạy cho RLS đọc của "chỉ Xem".
-- ⚠ Chưa chạy ⇒ app vẫn soạn + xuất được file (khuôn gốc), nhưng lưu bản soạn / lịch sử xuất báo "chưa chạy 0091".
-- ROLLBACK cuối file. Idempotent (chạy 2 lần không lỗi).
-- ============================================================

-- ---------- 1. Bảng ----------
create table if not exists public.document_templates (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  doc_type      text not null default '',
  version_no    integer not null default 1,
  file_name     text not null default '',
  file_path     text not null default '',
  tags          jsonb not null default '[]'::jsonb,
  status        text not null default 'active' check (status in ('active', 'retired')),
  uploaded_by   text not null default '',
  uploaded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists document_templates_type_idx on public.document_templates (site_id, doc_type);

create table if not exists public.composed_documents (
  id                   text primary key,
  site_id              text not null default 'bsf1' references public.sites(id),
  doc_type             text not null default '',
  source_type          text not null default '',
  source_id            text not null default '',
  source_ref           text not null default '',
  resource             text not null default '',
  field_values         jsonb not null default '{}'::jsonb,
  field_sources        jsonb not null default '{}'::jsonb,
  source_revision_no   integer not null default 0,
  customer_key         text not null default '',
  product_ids          jsonb not null default '[]'::jsonb,
  created_by           text not null default '',
  updated_by           text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists composed_documents_source_idx on public.composed_documents (site_id, source_type, source_id);
create index if not exists composed_documents_type_idx on public.composed_documents (site_id, doc_type, customer_key);

create table if not exists public.composed_document_exports (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  document_id   text not null default '',
  format        text not null default 'docx' check (format in ('docx', 'pdf')),
  template_id   text not null default '',
  snapshot      jsonb not null default '{}'::jsonb,
  exported_by   text not null default '',
  exported_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists composed_document_exports_doc_idx on public.composed_document_exports (site_id, document_id);

-- ---------- 2. RLS ----------
do $$
declare
  t text;
  is_admin text := $q$coalesce((public.current_permission_context()->>'admin')::boolean, false)$q$;
  -- Ghi bản soạn: quyền Thêm hoặc Sửa của tài nguyên ghi ở chính dòng (R15).
  doc_write text := $q$(public.has_export_permission(resource, 'create') or public.has_export_permission(resource, 'update'))$q$;
  -- Chỉ Xem: thấy bản soạn khi thấy được nguồn. Lệnh sản xuất ⇒ RLS 0088 (chỉ lệnh đã phát hành).
  doc_read text := $q$(public.has_export_permission(resource, 'view') and (source_type <> 'production-order'
      or exists (select 1 from public.production_orders o where o.id = composed_documents.source_id)))$q$;
  -- Lần xuất đọc / thêm theo bản soạn cha (RLS của composed_documents áp vào truy vấn con).
  exp_read text := $q$exists (select 1 from public.composed_documents d where d.id = composed_document_exports.document_id)$q$;
  exp_write text := $q$exists (select 1 from public.composed_documents d where d.id = composed_document_exports.document_id
      and (public.has_export_permission(d.resource, 'create') or public.has_export_permission(d.resource, 'update')))$q$;
  demo_only text := $q$site_id = 'site-demo'$q$;
  r text; w text; u text; d text;
begin
  foreach t in array array['document_templates', 'composed_documents', 'composed_document_exports'] loop
    if t = 'document_templates' then
      r := 'true'; w := is_admin; u := is_admin; d := is_admin || ' and ' || demo_only;
    elsif t = 'composed_documents' then
      r := doc_write || ' or ' || doc_read; w := doc_write; u := doc_write; d := doc_write || ' and ' || demo_only;
    else
      -- Lần xuất không sửa (R9): update chỉ cho dòng demo để hàng chờ upsert của bộ demo không kẹt.
      r := exp_read; w := exp_write; u := exp_write || ' and ' || demo_only; d := exp_write || ' and ' || demo_only;
    end if;
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.cap_nhat_thoi_diem_sua()', t || '_touch_updated_at', t); -- naming-ok: hàm 0001
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, r);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, w);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, u, u);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, d);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
      execute format('drop trigger if exists %I on public.%I', t || '_sql_audit', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_vet_sua_truc_tiep()', t || '_sql_audit', t); -- naming-ok: hàm 0048
    end if;
  end loop;
end $$;

-- ---------- 3. Bucket khuôn Word ----------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'document-templates') then
    raise notice 'CHƯA có bucket "document-templates" — tạo trên Dashboard (private, 20 MB) rồi chạy lại file này.';
  end if;
end $$;
drop policy if exists document_templates_files_select on storage.objects;
drop policy if exists document_templates_files_insert on storage.objects;
create policy document_templates_files_select on storage.objects
  for select to authenticated using (bucket_id = 'document-templates');
create policy document_templates_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'document-templates' and coalesce((public.current_permission_context()->>'admin')::boolean, false));

-- Kiểm (chỉ đọc):
--   select count(*) from pg_policies where tablename in ('document_templates', 'composed_documents', 'composed_document_exports');  -- 12
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'document_templates_files_%';            -- 2
--   select d.source_ref, count(e.*) from public.composed_documents d
--     left join public.composed_document_exports e on e.document_id = d.id group by 1 order by 1;
--
-- ROLLBACK (chỉ khi cần gỡ — mất mọi bản soạn + lịch sử xuất + khuôn đã tải):
--   drop policy if exists document_templates_files_select on storage.objects;
--   drop policy if exists document_templates_files_insert on storage.objects;
--   drop table if exists public.composed_document_exports;
--   drop table if exists public.composed_documents;
--   drop table if exists public.document_templates;
