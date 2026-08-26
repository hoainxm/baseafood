-- ============================================================
-- Baseafood MES — 0031: Mặt hàng — cờ tách râu/bao tử + quy cách block
--
-- Vì sao: chốt với chủ dự án 2026-08-25 — đẩy thuộc tính về MẶT HÀNG để màn ghi
-- thành phẩm tự suy, gọn và đúng logic:
--  - split_components: mã có tách 2 thành phần râu/bao tử (cùng giá) hay không.
--    Chỉ mã bật cờ mới hiện ô tách ở màn ghi (không phải mã nào cũng tách).
--  - block_spec_kg: quy cách MỖI block (kg/khối, VD 2/5). Màn ghi tự tính kg
--    gợi ý = số block × quy cách để đối chiếu.
-- (Loại nguyên liệu của mặt hàng đã có sẵn: products.material_type_id — 0015.)
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột vào products. split_components default
-- false, block_spec_kg để NULL nên mã cũ không đổi. Idempotent. RLS bảng đã có.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.products
  add column if not exists split_components boolean not null default false;

alter table public.products
  add column if not exists block_spec_kg numeric(10,3);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0031
--
-- ALTER TABLE public.products DROP COLUMN IF EXISTS split_components;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS block_spec_kg;
-- ============================================================
