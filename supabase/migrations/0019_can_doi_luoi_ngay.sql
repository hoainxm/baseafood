-- ============================================================
-- Baseafood MES — 0019: lưới cân đối theo ngày
--
-- Mục đích: kỳ cân đối làm trên MỘT lưới (hàng = mặt hàng, cột = ngày) thay cho
-- flow thêm-từng-dòng, và lấy được số liệu có sẵn ở sổ Nhập hàng + sổ Sản xuất
-- thay vì gõ lại. Bổ sung ô "Giảm" (nguyên liệu không chế biến hết → nhập kho
-- xưởng, dùng cho kỳ sau) và cột "Chuyển kỳ" (âm = đẩy sang kỳ sau,
-- dương = lấy từ kỳ trước) — đúng cột N của bảng cân đối giấy.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột (nullable/có default) + đổi TÊN loại
-- nguyên liệu "Bạch tuộc 2 da" thành size lớn. Không DROP, không đổi kiểu cột.
-- Chạy SAU 0018. Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- Câu lùi: xem khối ROLLBACK ở cuối file.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Hút số liệu vào kỳ = GÁN kỳ lên bản ghi gốc
--    (đúng cách phế liệu đang làm: một số liệu, một nguồn chuẩn.
--     Bỏ kỳ chỉ gỡ liên kết, không xoá số gốc.)
-- ------------------------------------------------------------
ALTER TABLE public.material_imports
  ADD COLUMN IF NOT EXISTS balancing_period_id text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS material_imports_balancing_period_idx
  ON public.material_imports (balancing_period_id);

ALTER TABLE public.production_wips
  ADD COLUMN IF NOT EXISTS balancing_period_id text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS production_wips_balancing_period_idx
  ON public.production_wips (balancing_period_id);

-- ------------------------------------------------------------
-- 2. Khối nguyên liệu vào: sản lượng theo ngày, Giảm, Chuyển kỳ
--    daily_quantities: { "2025-07-22": 5120, ... } — chỉ dùng cho dòng NHẬP TAY
--    (xả đông, bột phụ gia, dòng giảm). Dòng hút từ sổ nhập lấy ngày từ bản ghi
--    gốc, KHÔNG chép sang đây (tránh hai nguồn số lệch nhau).
--    quantity_kg vẫn là tổng cuối cùng (Σ ngày + carry_over_kg) — công thức
--    trong balancingCalc.ts không đổi một dòng nào.
-- ------------------------------------------------------------
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS daily_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS carry_over_kg numeric(14,3) NOT NULL DEFAULT 0;
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS is_reduction boolean NOT NULL DEFAULT false;
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS reduction_warehouse_id text NOT NULL DEFAULT '';
-- '' = dòng nhập tay · 'imports' = dòng dựng từ sổ Nhập hàng
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS auto_source text NOT NULL DEFAULT '';

-- ------------------------------------------------------------
-- 3. Khối bán thành phẩm: Chuyển kỳ + nguồn tự động
--    Dòng hút lấy sản lượng ngày từ production_wips (gán ở mục 1).
--    daily_quantities chỉ dùng cho dòng nhập tay không có nguồn sản xuất.
-- ------------------------------------------------------------
ALTER TABLE public.balancing_outputs
  ADD COLUMN IF NOT EXISTS daily_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.balancing_outputs
  ADD COLUMN IF NOT EXISTS carry_over_kg numeric(14,3) NOT NULL DEFAULT 0;
-- Kỳ nhận phần Chuyển kỳ âm của kỳ này (để dựng dòng đối ứng ở kỳ sau)
ALTER TABLE public.balancing_outputs
  ADD COLUMN IF NOT EXISTS carry_over_period_id text NOT NULL DEFAULT '';
-- '' = dòng nhập tay · 'production' = dựng từ sổ Sản xuất · 'sales' = hút từ sổ Bán
ALTER TABLE public.balancing_outputs
  ADD COLUMN IF NOT EXISTS auto_source text NOT NULL DEFAULT '';

-- ------------------------------------------------------------
-- 4. Tách size bạch tuộc 2 da
--    Bảng cân đối giấy đã tách sẵn "2 da nl lớn" / "2 da nl nhỏ" (mốc 80 con/kg).
--    Dữ liệu cũ mang tên chung "Bạch tuộc 2 da" ⇒ đổi hết sang LỚN theo chốt của
--    người dùng; xưởng tự sửa lại dòng nào là nhỏ. "Bạch tuộc 1 da" giữ nguyên.
--    Sổ nhập lưu loại NL theo TÊN (không phải khoá ngoại) nên phải đổi cả hai nơi.
-- ------------------------------------------------------------
UPDATE public.material_types
   SET name = 'Bạch tuộc 2 da lớn (80↑)'
 WHERE name = 'Bạch tuộc 2 da';

INSERT INTO public.material_types (id, name, category, note)
SELECT 'mt-2da-nho', 'Bạch tuộc 2 da nhỏ (80↓)', 'Bạch tuộc',
       'Tách size từ "Bạch tuộc 2 da" — mốc 80 con/kg trở xuống'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.material_types WHERE name = 'Bạch tuộc 2 da nhỏ (80↓)'
 );

UPDATE public.material_imports
   SET material_type_name = 'Bạch tuộc 2 da lớn (80↑)'
 WHERE material_type_name = 'Bạch tuộc 2 da';

-- KHÔNG đổi tên loại NL của kỳ cân đối: một kỳ = một HỌ nguyên liệu, gồm cả hai
-- size. Kỳ vẫn tên "Bạch tuộc 2 da" và tự gom dòng lớn + nhỏ (hoNguyenLieu()
-- trong src/lib/balancingGrid.ts). Đổi thành size lớn sẽ làm kỳ mất hàng nhỏ.

-- ============================================================
-- ROLLBACK — chạy khối này để lùi 0019 (chép ra, bỏ comment)
--
-- UPDATE public.material_types
--    SET name = 'Bạch tuộc 2 da' WHERE name = 'Bạch tuộc 2 da lớn (80↑)';
-- UPDATE public.material_imports
--    SET material_type_name = 'Bạch tuộc 2 da' WHERE material_type_name = 'Bạch tuộc 2 da lớn (80↑)';
-- DELETE FROM public.material_types WHERE id = 'mt-2da-nho';
--
-- DROP INDEX IF EXISTS public.material_imports_balancing_period_idx;
-- DROP INDEX IF EXISTS public.production_wips_balancing_period_idx;
-- ALTER TABLE public.material_imports   DROP COLUMN IF EXISTS balancing_period_id;
-- ALTER TABLE public.production_wips    DROP COLUMN IF EXISTS balancing_period_id;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS daily_quantities;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS carry_over_kg;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS is_reduction;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS reduction_warehouse_id;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS auto_source;
-- ALTER TABLE public.balancing_outputs  DROP COLUMN IF EXISTS daily_quantities;
-- ALTER TABLE public.balancing_outputs  DROP COLUMN IF EXISTS carry_over_kg;
-- ALTER TABLE public.balancing_outputs  DROP COLUMN IF EXISTS carry_over_period_id;
-- ALTER TABLE public.balancing_outputs  DROP COLUMN IF EXISTS auto_source;
-- ============================================================
