-- ============================================================
-- ⚠️⚠️ MIGRATION PHÁ HỦY — ĐỌC HẾT TRƯỚC KHI CHẠY ⚠️⚠️
--
-- Gỡ toàn bộ dữ liệu cũ của SDFactory khỏi project Supabase của Baseafood.
--
-- KHÔNG THỂ HOÀN TÁC. Chạy file này sẽ:
--   • Xóa vĩnh viễn bảng public.events (spine append-only — chính SDFactory
--     thiết kế để KHÔNG BAO GIỜ xóa được, có trigger chặn UPDATE/DELETE).
--   • Xóa public.state_snapshots (toàn bộ state đã chốt của app SDFactory).
--   • Xóa public.sites.
--   • Ứng dụng SDFactory sẽ HỎNG ngay khi mất các bảng này.
--
-- BẮT BUỘC làm trước khi chạy:
--   1. Supabase Dashboard → Database → Backups → tạo backup thủ công,
--      HOẶC chạy: pg_dump "<connection string>" -t public.events \
--                   -t public.state_snapshots -t public.sites > sdfactory_backup.sql
--   2. Xác nhận SDFactory thật sự đã ngừng dùng project này.
--
-- Nếu chỉ muốn giữ lại cho chắc: BỎ QUA file này. Bảng SDFactory nằm yên
-- không ảnh hưởng gì tới MES (tên bảng không trùng nhau).
-- ============================================================

-- Trigger chặn xóa nằm ở tầng row, DROP TABLE vẫn đi qua được, nhưng gỡ
-- trigger trước cho rõ ràng ý định.
drop trigger if exists events_no_update on public.events;
drop trigger if exists events_no_delete on public.events;
drop trigger if exists snapshots_touch  on public.state_snapshots;

drop table if exists public.state_snapshots cascade;
drop table if exists public.events         cascade;
drop table if exists public.sites          cascade;

drop function if exists public.block_event_mutation() cascade;
drop function if exists public.app_has_cap(text)      cascade;

-- public.touch_updated_at() KHÔNG xóa nếu còn thứ khác dùng.
-- MES dùng hàm riêng public.cap_nhat_thoi_diem_sua() nên xóa được:
drop function if exists public.touch_updated_at() cascade;

-- Kiểm tra sau khi chạy: chỉ còn 11 bảng của MES.
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
