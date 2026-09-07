-- ============================================================
-- Baseafood MES — 0038: Còn dở cuối ngày SX TÁCH THEO loại nguyên liệu
--
-- Vì sao: khép vòng G1 (họp 2026-09-02). Cột `leftover_kg` (0028) chỉ là MỘT số
-- tổng cho cả ngày×xưởng — không biết còn dở của LOẠI nguyên liệu nào, nên không
-- ráp được vào sổ tồn kho nguyên liệu (vốn tính theo HỌ nguyên liệu / kỳ). Thêm
-- cột jsonb ánh xạ {tên loại NL → kg còn dở} để chốt ngày SX ghi rõ từng loại,
-- rồi Cân đối / sổ NXT nguyên liệu cộng phần còn dở đó vào "đông gửi" kỳ tương ứng.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột nullable vào production_locks (module WIP,
-- 0011), mặc định NULL nên dòng chốt cũ không đổi. `leftover_kg` giữ nguyên làm
-- tổng. Không đụng daily_locks (chốt nhập hàng). Chạy SAU 0028. Chạy lại nhiều
-- lần vẫn không lỗi. RLS + trigger của bảng đã có (production_locks trong 0021).
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.production_locks
  add column if not exists leftover_by_material jsonb;

comment on column public.production_locks.leftover_by_material is
  'Còn dở cuối ngày SX tách theo loại nguyên liệu: {"<tên loại NL>": kg}. Tổng = leftover_kg.';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0038
--
-- ALTER TABLE public.production_locks DROP COLUMN IF EXISTS leftover_by_material;
-- ============================================================
