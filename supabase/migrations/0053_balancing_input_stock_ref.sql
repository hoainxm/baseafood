-- ============================================================
-- Baseafood MES — 0053: hai dòng KHO của khối nguyên liệu (Cân đối) nối Sổ kho tháng
--
-- Vì sao: dòng "Lấy xả đông" phải chọn ĐÍCH DANH lô trong Sổ kho tháng để trừ, dòng
-- "Gửi đông" phải chọn kho nhận — gõ số là cột Xuất / lô gửi đông của sổ kho đổi
-- ngay (lib/khoCanDoi.ts). Hai cột lưu lựa chọn đó trên dòng cân đối:
--   - `stock_line_id`  = id dòng `monthly_stock_ledger` (LÔ) của dòng Lấy xả đông.
--                        Tháng sau của cùng lô theo chuỗi dồn kỳ `carry|<id>`.
--   - `stock_location` = kho nhận của dòng Gửi đông, dạng "<sổ kho>|<vị trí>"
--                        (VD "Kho 1500 tấn|Kho Hồng Phú"; vị trí rỗng = chính kho sổ).
-- Số kg KHÔNG lưu ở đây — nằm ở sổ kho (cột xuất của lô + vết ⟦CĐ:…⟧ trong ghi chú,
-- lô gửi đông id `cd|<dòng>|<ngày>`).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 2 cột default ''. Không đụng dữ liệu, ràng
-- buộc hay RLS. repo.ts chỉ gửi 2 cột khi trường có giá trị.
-- Idempotent: chạy lại nhiều lần vẫn không lỗi.
-- ============================================================

alter table public.balancing_inputs
  add column if not exists stock_line_id text not null default '';

alter table public.balancing_inputs
  add column if not exists stock_location text not null default '';

comment on column public.balancing_inputs.stock_line_id is
  'Lấy xả đông: id dòng monthly_stock_ledger (lô) chọn đích danh để trừ.';
comment on column public.balancing_inputs.stock_location is
  'Gửi đông: kho nhận "<sổ kho>|<vị trí>".';

-- ROLLBACK (mất lựa chọn lô/kho của dòng kho — số kg trong sổ kho vẫn còn):
--   alter table public.balancing_inputs drop column if exists stock_line_id;
--   alter table public.balancing_inputs drop column if exists stock_location;
