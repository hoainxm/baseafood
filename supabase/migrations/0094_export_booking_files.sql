-- ============================================================
-- Baseafood MES — 0094: FILE BOOKING CỦA CHUYẾN XUẤT KHẨU
--
-- Vì sao (2026-11-02, ba-spec docs/app-map/60-export-booking-file.ba-spec.md, chủ dự án chốt 4 câu): bản xác
-- nhận booking của hãng tàu nằm ngoài app, lúc đóng cont phải lục mail. Nay đính được file booking ở ô Số booking
-- của hộp ghi chuyến và xem / đính thêm ở khối Đóng cont.
--
-- Làm gì:
--   1. export_files: NỚI ràng buộc `step` thêm giá trị 'booking' (file booking gắn chuyến, không gắn mục bước —
--      KHÔNG làm 4a / 4b hay bước nào tự xong).
--   2. View `export_file_steps` (danh sách bước file máy chủ nhận) — app dò view này (serverHasColumn) để biết đã
--      chạy 0094 hay chưa; chưa có ⇒ ẩn chỗ đính file booking, không gửi dòng bị ràng buộc từ chối (kẹt hàng chờ).
--
-- KHÔNG đụng RLS: file `booking` theo quyền `export-plans` sẵn có (0075); người chỉ có `export-plans.loading` vẫn
-- chỉ thấy file 'loading-plan' / 'loading-photos' ⇒ không thấy file booking (đúng ý chủ dự án).
-- Mức độ rủi ro: 🟡 nới ràng buộc + thêm view. Chạy lại an toàn. Cần 0079 (ràng buộc có 'contract').
--
-- Đường lùi (chỉ khi chưa có dòng 'booking' — có rồi thì xóa / chuyển các dòng đó trước):
--   drop view if exists public.export_file_steps;
--   alter table public.export_files drop constraint if exists export_files_step_check;
--   alter table public.export_files add constraint export_files_step_check
--     check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order', 'document', 'contract'));
-- ============================================================

alter table public.export_files drop constraint if exists export_files_step_check;
alter table public.export_files add constraint export_files_step_check
  check (step in ('production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order', 'document', 'contract', 'booking'));

create or replace view public.export_file_steps as
  select unnest(array['production-order', 'packaging', 'loading-plan', 'loading-photos', 'customs-declaration', 'export-order', 'document', 'contract', 'booking']) as step;
grant select on public.export_file_steps to authenticated;

notify pgrst, 'reload schema';
