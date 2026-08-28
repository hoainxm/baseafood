-- ============================================================
-- Baseafood MES — 0033: KIỂU CHẾ BIẾN trên dòng sản xuất thành phẩm ngày
--
-- Vì sao: sổ giấy "Báo cáo bán thành phẩm hằng ngày" của xưởng Đông tổ chức theo
-- NHÓM = (kiểu chế biến × khách hàng) — vd "2 Da chần · Peacock" → nhiều dòng
-- thành phẩm. Màn /wip trước gom theo LOÀI; nay gom theo (chế biến × khách) cho
-- khớp sổ. Cần lưu KIỂU CHẾ BIẾN của nhóm ngay trên dòng WIP (snapshot) để dựng
-- lại đúng bố cục + đối chiếu, không phụ thuộc việc mặt hàng đã gắn processing_type
-- ở danh mục hay chưa.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột nullable, không đụng dữ liệu đang có.
-- Chạy lại nhiều lần vẫn không lỗi (idempotent). Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.production_wips
  add column if not exists processing_type text not null default '';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0033
--
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS processing_type;
-- ============================================================
