-- ============================================================
-- Baseafood MES — 0012: seed danh mục khách hàng (từ bảng cân đối)
--
-- Chạy SAU 0001. An toàn: chỉ THÊM khách CHƯA có (so theo tên, không phân biệt
-- hoa/thường). Chạy lại nhiều lần KHÔNG nhân đôi. Không xóa/đụng khách đang có.
--
-- Nguồn: các khách trong bảng cân đối Bạch tuộc 2 da người dùng cung cấp
-- (cột khách của khối thành phẩm) + Sasano (các dòng kế toán nhập thiếu khách).
-- `thi_truong` để TRỐNG — không đoán thị trường vào sổ thật; admin phân loại
-- (Nhật / EU / …) trong màn Danh mục khi cần. `ma` để trống (mã nội bộ tuỳ đặt).
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

insert into public.khach_hang (id, xi_nghiep_id, ma, ten, thi_truong)
select extensions.gen_random_uuid()::text, 'bsf1', '', v.ten, ''
from (values
  ('Lucky'),
  ('Seachemot'),
  ('Daiko'),
  ('Peacock'),
  ('Hanwa'),
  ('Matsuda'),
  ('Hatchando'),
  ('JFDA'),
  ('Dairei'),
  ('Orient'),
  ('Sasano')
) as v(ten)
where not exists (
  select 1 from public.khach_hang k
  where k.xi_nghiep_id = 'bsf1'
    and lower(k.ten) = lower(v.ten)
);
