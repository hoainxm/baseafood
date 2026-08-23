-- ============================================================
-- Baseafood MES — 0024: Kiểu chế biến của thành phẩm (facet thứ 3)
--
-- Vì sao: định danh thành phẩm cần tách 3 facet độc lập để số hoá theo
-- nhiều quy cách × kiểu chế biến (họp 2026-08-22, spec bo-quy-cach-che-bien).
--   - `material_type_id` (đã có, 0015) = nguyên liệu / loại NL.
--   - `category`         (đã có, 0014 tên cũ `loai`) = NHÓM LOÀI (Bạch tuộc/Mực/Cá…).
--   - `processing_type`  (cột này) = KIỂU CHẾ BIẾN (luộc/chần/cắt/tẩm bột…).
-- Trước đó kiểu chế biến chỉ nằm trong TÊN thành phẩm, không lọc/tổng hợp được.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột, default '' nên dòng cũ không đổi
-- hành vi (facet rỗng = "chưa phân loại"). Không đụng dữ liệu đang có.
-- Chạy SAU 0016 (bảng đã tên tiếng Anh). Chạy lại nhiều lần vẫn không lỗi.
-- RLS + trigger updated_at của `products` đã có từ trước, không cần đụng.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.products
  add column if not exists processing_type text not null default '';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0024
--
-- ALTER TABLE public.products DROP COLUMN IF EXISTS processing_type;
-- ============================================================
