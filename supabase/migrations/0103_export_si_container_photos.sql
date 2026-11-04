-- ============================================================
-- Baseafood MES — 0103: FILE SI + ẢNH CONT / SEAL của chuyến xuất khẩu
--
-- Vì sao (2026-11-04, chị Thảo — Phòng Kế hoạch; ba-spec docs/app-map/72-export-order-and-si.ba-spec.md):
--   · hàng "Số cont + seal" của bước Đóng cont đính được ảnh cont / seal — người đóng hàng chụp tại bãi / xưởng;
--   · mục mới "SI" (Shipping Instruction) cuối bước 4: lập trong app, xuất Excel mẫu SI FORM; mục Xong khi có
--     file SI. Nội dung SI lưu ở `composed_documents` (0091, doc_type `shipping-instruction`) — không cần bảng mới.
-- Lệnh xuất hàng dùng bộ soạn văn bản (0091) + mục `export-order` sẵn có ⇒ không đổi gì ở đây.
--
-- Làm gì — chủ dự án đã đồng ý đổi RLS (2026-11-04, chọn "Kế hoạch + người đóng hàng" cho ảnh cont / seal):
--   1. Nới `export_files_step_check` (0097) thêm `shipping-instruction` · `container-seal-photos`;
--      view `export_file_steps` thêm 2 giá trị (app dò view: chưa chạy 0103 ⇒ ẩn ba phần mới, SI không bắt buộc).
--   2. Policy select / insert / update của `export_files`: người đóng hàng (`export-plans.loading`) xem + thêm
--      được `container-seal-photos` (như 4a / 4b / ảnh 0097). File SI chỉ theo `export-plans` (người đóng hàng
--      không thấy). Policy delete KHÔNG đổi.
--   Ảnh lên kho `export-files` khu `loading` (policy kho 0075 đã cho người đóng hàng khu này).
-- Idempotent. Chạy SAU 0097. ROLLBACK cuối file.
-- ============================================================

alter table public.export_files drop constraint if exists export_files_step_check;
alter table public.export_files add constraint export_files_step_check
  check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order',
                  'document', 'contract', 'booking', 'loading-count-photos', 'package-weight-photos',
                  'shipping-instruction', 'container-seal-photos'));

create or replace view public.export_file_steps as
  select unnest(array['production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order',
                      'document', 'contract', 'booking', 'loading-count-photos', 'package-weight-photos',
                      'shipping-instruction', 'container-seal-photos']) as step;
grant select on public.export_file_steps to authenticated;

drop policy if exists export_files_select on public.export_files;
drop policy if exists export_files_insert on public.export_files;
drop policy if exists export_files_update on public.export_files;
create policy export_files_select on public.export_files for select to authenticated
  using (public.has_export_permission('export-plans', 'view')
         or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos', 'container-seal-photos')
             and public.has_export_permission('export-plans.loading', 'view')));
create policy export_files_insert on public.export_files for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
              or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos', 'container-seal-photos')
                  and public.has_export_permission('export-plans.loading', 'create')));
create policy export_files_update on public.export_files for update to authenticated
  using (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
         or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos', 'container-seal-photos')
             and public.has_export_permission('export-plans.loading', 'create')))
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
              or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos', 'container-seal-photos')
                  and public.has_export_permission('export-plans.loading', 'create')));

notify pgrst, 'reload schema';

-- KIỂM (chỉ đọc):
--   select count(*) from public.export_file_steps;                                   -- 13
--   select policyname from pg_policies where tablename = 'export_files' order by 1;  -- 4 policy
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'export_files_step_check';

-- ============================================================
-- ROLLBACK (xóa file 2 loại mới trước, không thì check cũ không dựng lại được):
--   delete from public.export_files where step in ('shipping-instruction', 'container-seal-photos');
--   rồi chạy lại 0097 (check + view 11 giá trị + 3 policy).
-- ============================================================
