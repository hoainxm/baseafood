-- ============================================================
-- Baseafood MES — 0020: chốt kỳ cân đối + liên kết chuyển kỳ
--
-- Hai việc:
--  1. Chốt kỳ — khoá số sau khi đã gửi kế toán. Cùng luật với chốt ngày ở sổ
--     nhập hàng: mở lại được nhưng phải ghi lý do, KHÔNG xoá vết.
--  2. Chuyển kỳ — dòng có phần chuyển kỳ ÂM (đẩy sang kỳ sau) cần nhớ đã được
--     kỳ nào nhận, để không lấy hai lần. `balancing_outputs` đã có cột này từ
--     0019; bổ sung nốt cho `balancing_inputs`.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột có default. Chạy SAU 0019.
-- Chạy lại nhiều lần vẫn không lỗi. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

-- 1. Chốt kỳ cân đối
ALTER TABLE public.balancing_periods
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.balancing_periods
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.balancing_periods
  ADD COLUMN IF NOT EXISTS lock_note text NOT NULL DEFAULT '';
-- Giữ vết vì sao mở lại — mở lại KHÔNG xoá cờ chốt cũ, chỉ đặt is_locked=false
ALTER TABLE public.balancing_periods
  ADD COLUMN IF NOT EXISTS reopen_reason text NOT NULL DEFAULT '';

-- 2. Chuyển kỳ cho khối nguyên liệu (khối bán thành phẩm đã có ở 0019)
ALTER TABLE public.balancing_inputs
  ADD COLUMN IF NOT EXISTS carry_over_period_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS balancing_inputs_carry_over_idx
  ON public.balancing_inputs (carry_over_period_id);
CREATE INDEX IF NOT EXISTS balancing_outputs_carry_over_idx
  ON public.balancing_outputs (carry_over_period_id);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0020
--
-- DROP INDEX IF EXISTS public.balancing_inputs_carry_over_idx;
-- DROP INDEX IF EXISTS public.balancing_outputs_carry_over_idx;
-- ALTER TABLE public.balancing_inputs   DROP COLUMN IF EXISTS carry_over_period_id;
-- ALTER TABLE public.balancing_periods  DROP COLUMN IF EXISTS is_locked;
-- ALTER TABLE public.balancing_periods  DROP COLUMN IF EXISTS locked_at;
-- ALTER TABLE public.balancing_periods  DROP COLUMN IF EXISTS lock_note;
-- ALTER TABLE public.balancing_periods  DROP COLUMN IF EXISTS reopen_reason;
-- ============================================================
