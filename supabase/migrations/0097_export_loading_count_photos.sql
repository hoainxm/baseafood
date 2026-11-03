-- ============================================================
-- Baseafood MES — 0097: ẢNH KÈM SỐ LƯỢNG THỰC ĐÓNG + ẢNH BAO BÌ / CÂN GROSS ở bước Đóng cont
--
-- Vì sao (2026-11-03, chị Vi — Phòng Kế hoạch, ảnh chú thích; ba-spec 41 §0g): bước 4 thêm
--   · "Số lượng thực đóng (cho đính kèm hình ảnh)" — kho chụp tờ đếm / lớp hàng kèm số thực đóng;
--   · "Hình ảnh bao bì + cân gross" — ảnh thùng / nhãn bao bì và ảnh cân kg cả bì.
-- Cả hai là FILE của chuyến (không có mục bước, KHÔNG làm bước 4 tự xong — như file booking 0094).
--
-- Làm gì — chủ dự án đã đồng ý đổi RLS (2026-11-03, "Đồng ý, làm đi"):
--   1. Nới `export_files_step_check` (0094) thêm `loading-count-photos` · `package-weight-photos`;
--      view `export_file_steps` thêm 2 giá trị (app dò view để bật nút đính — chưa chạy 0097 thì ẩn).
--   2. Policy select / insert / update của `export_files`: người đóng hàng (`export-plans.loading`)
--      xem + thêm được 2 loại MỚI này, như 4a / 4b. Giữ nguyên mọi nhánh khác (đối chiếu DB thật
--      2026-11-03: chỉ có nhánh `export-plans` + nhánh loading cho loading-plan / loading-photos).
--      Policy delete KHÔNG đổi (người đóng hàng vẫn không xóa được file).
--   File lên kho `export-files` ở khu `loading` (policy kho 0075 đã cho người đóng hàng khu này).
-- Idempotent. Chạy SAU 0094. ROLLBACK cuối file.
-- ============================================================

alter table public.export_files drop constraint if exists export_files_step_check;
alter table public.export_files add constraint export_files_step_check
  check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order',
                  'document', 'contract', 'booking', 'loading-count-photos', 'package-weight-photos'));

create or replace view public.export_file_steps as
  select unnest(array['production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order',
                      'document', 'contract', 'booking', 'loading-count-photos', 'package-weight-photos']) as step;
grant select on public.export_file_steps to authenticated;

drop policy if exists export_files_select on public.export_files;
drop policy if exists export_files_insert on public.export_files;
drop policy if exists export_files_update on public.export_files;
create policy export_files_select on public.export_files for select to authenticated
  using (public.has_export_permission('export-plans', 'view')
         or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos')
             and public.has_export_permission('export-plans.loading', 'view')));
create policy export_files_insert on public.export_files for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
              or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos')
                  and public.has_export_permission('export-plans.loading', 'create')));
create policy export_files_update on public.export_files for update to authenticated
  using (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
         or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos')
             and public.has_export_permission('export-plans.loading', 'create')))
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
              or (step in ('loading-plan', 'loading-photos', 'loading-count-photos', 'package-weight-photos')
                  and public.has_export_permission('export-plans.loading', 'create')));

notify pgrst, 'reload schema';

-- KIỂM (chỉ đọc):
--   select count(*) from public.export_file_steps;                                   -- 11
--   select policyname from pg_policies where tablename = 'export_files' order by 1;  -- 4 policy
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'export_files_step_check';

-- ============================================================
-- ROLLBACK (xóa file 2 loại mới trước, không thì check cũ không dựng lại được):
--   delete from public.export_files where step in ('loading-count-photos', 'package-weight-photos');
--   rồi chạy lại phần 1 của 0094 (check + view 9 giá trị) và dựng lại 3 policy với danh sách
--   ('loading-plan', 'loading-photos') như 0075.
-- ============================================================
