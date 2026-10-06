-- ============================================================
-- Baseafood MES — 0052: TRẢ · NỢ thay cột Chuyển kỳ ở khối bán thành phẩm (Cân đối)
--
-- Vì sao: kế toán muốn tách cột "Chuyển kỳ" của khối bán thành phẩm thành HAI cột
-- Trả · Nợ (đặt cuối bảng), gõ số có dấu, Tổng dòng = Σ ngày + Trả + Nợ — đúng quy
-- tắc chuyển kỳ cũ; nghĩa riêng của từng cột kế toán chốt sau.
--   - `balancing_outputs.carry_over_kg` GIỮ NGHĨA cũ = TỔNG chuyển kỳ (Trả + Nợ) ⇒
--     công thức, bản in, "nhận chuyển kỳ", engine tồn KHÔNG đổi.
--   - `balancing_outputs.debt_kg` (MỚI) = phần Nợ. Trả = carry_over_kg − debt_kg.
--     Dòng cũ debt_kg = 0 ⇒ số chuyển kỳ cũ hiện ở cột Trả.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 1 cột có default 0. Không đụng dữ liệu, ràng
-- buộc hay RLS. repo.ts chỉ gửi `debt_kg` khi dòng đã có phần Nợ ⇒ DB chưa chạy file
-- này thì dòng cũ vẫn lên máy chủ; gõ Nợ trước khi chạy ⇒ dòng đó nằm hàng chờ tới
-- khi chạy xong (không mất).
-- Idempotent: chạy lại nhiều lần vẫn không lỗi.
-- ============================================================

alter table public.balancing_outputs
  add column if not exists debt_kg numeric not null default 0;

comment on column public.balancing_outputs.debt_kg is
  'Phần "Nợ" của chuyển kỳ (kg, có dấu). carry_over_kg = Trả + Nợ; Trả = carry_over_kg - debt_kg.';

-- ROLLBACK (mất phần tách Nợ — tổng chuyển kỳ vẫn còn nguyên ở carry_over_kg):
--   alter table public.balancing_outputs drop column if exists debt_kg;
