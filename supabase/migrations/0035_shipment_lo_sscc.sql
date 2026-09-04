-- ============================================================
-- Baseafood MES — 0035: Mã lô nội bộ + mã SSCC cho chuyến nhập
--
-- Vì sao: họp 2026-09-02 (QĐ-6) — định danh mỗi chuyến nhập bằng một MÃ LÔ nội bộ
-- đọc được (vd "Đ-260902-01") để truy xuất nội bộ (mẻ sản xuất ↔ lô nguyên liệu).
-- (QĐ-10) chừa sẵn ô SSCC nhà nước — thường để trống, điền sau khi được cấp; sau
-- này lô nào cũng phải có SSCC mới cho nhập kho. Cả hai chỉ là NHÃN, không phải khóa.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 2 cột nullable vào import_shipments (0004),
-- không default nên dòng chuyến cũ giữ NULL (app đọc thành ""), không khóa bảng,
-- không vỡ dữ liệu cũ. Không đụng RLS/trigger (bảng đã có). Chạy SAU 0004.
-- Chạy lại nhiều lần vẫn không lỗi (add column if not exists). Câu lùi ở cuối file.
-- ============================================================

alter table public.import_shipments
  add column if not exists lot_code text,
  add column if not exists sscc_code text;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0035
--
-- ALTER TABLE public.import_shipments DROP COLUMN IF EXISTS lot_code;
-- ALTER TABLE public.import_shipments DROP COLUMN IF EXISTS sscc_code;
-- ============================================================
