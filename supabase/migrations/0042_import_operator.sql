-- ============================================================
-- Baseafood MES — 0042: Người thao tác ghi chuyến nhập hàng (operator)
--
-- Vì sao: yêu cầu 2026-09-10 — nhập hàng CHƯA lưu "người ghi" trên bản ghi (chỉ
-- có audit_log). Thêm cột operator (giống production_wips ở 0037) để sổ nhập hiện
-- "Người ghi", app gắn họ tên tài khoản đăng nhập vào từng chuyến khi lưu.
--
-- Backfill: các chuyến CŨ (operator rỗng) → gán họ tên nnttruc. Lý do: nnttruc là
-- người nhập hàng thật; trước đây một số dữ liệu ghi bằng tài khoản admin (tạm).
-- Lấy full_name của nnttruc trong user_profiles; nếu rỗng thì để chuỗi 'nnttruc'.
--
-- Mức độ rủi ro: 🟡 YELLOW — thêm 1 cột nullable (không default, dòng cũ NULL,
-- app đọc thành ""), không khóa bảng, không vỡ dữ liệu. import_shipments đã nằm
-- trong danh sách siết RLS của 0021 nên KHÔNG cần sửa 0021. Chạy lại nhiều lần
-- vẫn không lỗi (add column if not exists + backfill chỉ chạm dòng còn rỗng).
-- Câu lùi ở cuối file.
-- ============================================================

alter table public.import_shipments
  add column if not exists operator text;

-- Backfill người ghi cho các chuyến cũ = họ tên nnttruc (rỗng thì 'nnttruc').
-- Chỉ chạm dòng chưa có operator ⇒ chạy lại lần hai không đổi gì thêm.
update public.import_shipments
set operator = coalesce(
  nullif((select full_name from public.user_profiles where username = 'nnttruc' limit 1), ''),
  'nnttruc'
)
where operator is null or operator = '';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0042
--
-- ALTER TABLE public.import_shipments DROP COLUMN IF EXISTS operator;
-- ============================================================
