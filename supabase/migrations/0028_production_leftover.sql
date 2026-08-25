-- ============================================================
-- Baseafood MES — 0025: Nguyên liệu còn dở khi chốt sản xuất
--
-- Vì sao: daily-task của bộ phận Sản xuất (họp 2026-08-22) là "từ lượng nhập
-- trong ngày, sản xuất ra bao nhiêu thành phẩm và CÒN BAO NHIÊU đem lưu kho nếu
-- chưa làm xong". Phần "còn dở" đó trước chỉ nhắc miệng — nay chốt ngày SX ghi
-- lại con số để đối chiếu (nhập ↔ sản xuất ↔ còn dở) và nối vòng gối đầu.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột vào production_locks (module WIP, 0011),
-- default 0 nên dòng chốt cũ không đổi. Không đụng daily_locks (chốt nhập hàng).
-- Chạy SAU 0011. Chạy lại nhiều lần vẫn không lỗi. RLS + trigger của bảng đã có.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.production_locks
  add column if not exists leftover_kg numeric(14,3) not null default 0;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0025
--
-- ALTER TABLE public.production_locks DROP COLUMN IF EXISTS leftover_kg;
-- ============================================================
