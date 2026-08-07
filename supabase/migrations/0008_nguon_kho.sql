-- ============================================================
-- Baseafood MES — 0008: nguồn kho cho nguyên liệu vào (xả đông)
--
-- Chạy SAU 0001. An toàn với dữ liệu đang có (CHỈ THÊM cột, không xóa).
-- Chạy lại nhiều lần vẫn không lỗi (idempotent nhờ `if not exists`).
--
-- Vì sao: dòng "xả đông" ở khối Nguyên liệu vào có hai nguồn khác nhau —
--   • "Mua về"   = hàng đã cấp đông ở kho KHÁC, họ bán về cho mình để đưa vào SX
--   • "Kho mình" = xả đông hàng từ kho CỦA MÌNH để đưa vào SX
-- Phân biệt hai nguồn là seam cho quản lý tồn kho / vòng lặp đông gửi ↔ xả đông
-- sau này. Trống ("") = không phân loại (mọi dòng cũ + nhóm không phải Xả đông).
--
-- Tầng repo (`repo.ts`) chỉ GỬI `nguon_kho` khi có giá trị ⇒ app vẫn ghi NL vào
-- bình thường kể cả khi CHƯA chạy migration này. Chạy migration chỉ cần khi muốn
-- LƯU cờ nguồn lên máy chủ.
--
-- Lùi (rollback):
--   alter table public.nguyen_lieu_vao drop column if exists nguon_kho;
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

alter table public.nguyen_lieu_vao
  add column if not exists nguon_kho text not null default '';
