-- ============================================================
-- Baseafood MES — 0015: liên kết mặt hàng (thành phẩm) → loại nguyên liệu
--
-- Chạy SAU 0001. An toàn (chỉ thêm cột). Idempotent.
--
-- Vì sao: thành phẩm THUỘC về một loại nguyên liệu (VD "Bạch tuộc 2 da"). Kỳ cân
-- đối / ghi sản lượng làm theo loại NL ⇒ chỉ hiện thành phẩm của loại NL đó.
-- Thêm khóa chính loại NL vào mặt hàng để quản lý + lọc. `repo.ts` chỉ gửi khi có
-- giá trị ⇒ không bắt buộc để ghi.
--
-- Lùi: alter table mat_hang drop column if exists loai_nguyen_lieu_id;
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

alter table public.mat_hang
  add column if not exists loai_nguyen_lieu_id text not null default '';
