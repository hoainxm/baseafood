-- ============================================================
-- Baseafood MES — 0030: Thành phẩm ngày — khách hàng + thành phần râu/bao tử
--
-- Vì sao: chốt lại logic ghi thành phẩm hằng ngày (2026-08-25):
--  - mỗi dòng thành phẩm gắn MỘT KHÁCH HÀNG (làm theo đơn) → cột customer_name.
--  - thành phẩm kiểu "cắt chần" tách 2 thành phần râu / bao tử cùng 1 giá bán;
--    ghi riêng từng phần, quantity_kg giữ TỔNG = râu + bao tử → 2 cột component_*.
--    (null = dòng không tách; cân đối chỉ dùng con số tổng ở quantity_kg.)
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột vào production_wips (module WIP, 0011).
-- customer_name default '' nên dòng cũ không đổi; 2 cột component để NULL.
-- Chạy SAU 0011. Chạy lại nhiều lần vẫn không lỗi (idempotent). RLS bảng đã có.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.production_wips
  add column if not exists customer_name text not null default '';

alter table public.production_wips
  add column if not exists component_rau_kg numeric(14,3);

alter table public.production_wips
  add column if not exists component_bao_tu_kg numeric(14,3);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0030
--
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS customer_name;
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS component_rau_kg;
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS component_bao_tu_kg;
-- ============================================================
