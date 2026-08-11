-- ============================================================
-- Baseafood MES — 0017: Bảng danh mục 5 Kho BSF1 và Phân loại Nhập Xuất Tồn
-- ============================================================

-- 1. Bảng danh mục kho
CREATE TABLE IF NOT EXISTS public.warehouses (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('xi-nghiep', 'phan-xuong')),
  capacity_kg numeric NOT NULL DEFAULT 0,
  workshop text CHECK (workshop IN ('Đông', 'Cá', 'Khô')),
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Seed dữ liệu 5 Kho BSF1
INSERT INTO public.warehouses (id, code, name, type, capacity_kg, workshop, note)
VALUES
  ('kho-1000t', 'K1000T', 'Kho 1000 tấn', 'xi-nghiep', 1000000, NULL, 'Kho tổng BSF1 — dung tích 1.000 tấn'),
  ('kho-1500t', 'K1500T', 'Kho 1500 tấn', 'xi-nghiep', 1500000, NULL, 'Kho tổng BSF1 — dung tích 1.500 tấn'),
  ('kho-dong', 'KX-DONG', 'Kho xưởng Đông', 'phan-xuong', 250000, 'Đông', 'Kho trong phân xưởng Đông — dung tích 250 tấn'),
  ('kho-ca', 'KX-CA', 'Kho xưởng Cá', 'phan-xuong', 150000, 'Cá', 'Kho trong phân xưởng Cá — dung tích 150 tấn'),
  ('kho-kho', 'KX-KHO', 'Kho xưởng Khô', 'phan-xuong', 150000, 'Khô', 'Kho trong phân xưởng Khô — dung tích 150 tấn')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  capacity_kg = EXCLUDED.capacity_kg,
  note = EXCLUDED.note;

-- 3. RLS cho bảng warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warehouses_authenticated_policy ON public.warehouses;
CREATE POLICY warehouses_authenticated_policy ON public.warehouses
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON public.warehouses FROM anon;

-- 4. Bổ sung cột loai_hang_nxt (Hàng nhập khẩu / Hàng trong nước / Hàng tạm) vào production_wips nếu chưa có
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='production_wips' AND column_name='nxt_category'
  ) THEN
    ALTER TABLE public.production_wips ADD COLUMN nxt_category text DEFAULT 'Hàng trong nước';
  END IF;
END $$;
