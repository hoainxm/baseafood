-- ============================================================
-- Baseafood MES — 0084: DÒNG HÀNG HỢP ĐỒNG NHẬP NỐI MẶT HÀNG DANH MỤC
--
-- Vì sao (2026-10-29, ba-spec 45 §0c v3): tên hàng của HĐ nhập chỉ là chữ tự do như trên chứng từ
-- ("Frozen whole octopus 1-2 kg") — cùng một hàng mỗi HĐ gõ một kiểu, không cộng / tra theo mặt
-- hàng được, không nối được sang sản xuất, kho, Xuất khẩu. Chủ dự án yêu cầu mọi chỗ có tên hàng
-- của Nhập khẩu nối mặt hàng trong danh mục (giống dòng hàng Xuất khẩu, ba-spec 41 R16).
--
-- Làm gì — thêm cột `import_contract_lines.product_id` (text, trống = chưa nối) trỏ MỀM
-- `products.id` (danh mục mở Mặt hàng — KHÔNG phải 141 mã kế toán `finished_goods`, không khóa
-- ngoại cứng như mọi bảng khác của repo: xóa mặt hàng không xóa dòng HĐ, app coi là "chưa nối").
-- Tên như trên HĐ giữ ở `product_name`, không đổi. Index (site_id, product_id) cho tra theo mặt hàng.
-- RLS: KHÔNG đổi — cột mới theo policy sẵn có của bảng (0082: ghi = `import-plans`; thủ kho đọc).
-- KHÔNG đổi ma trận quyền ⇒ chạy sau 0083 không cần chạy lại file nào. Chỉ thêm. Idempotent.
-- ⚠ Chưa chạy ⇒ app không gửi mặt hàng của dòng, không bắt nối khi đóng HĐ, ô chọn báo
--   "chưa chạy 0084" — không kẹt hàng chờ.
-- ROLLBACK cuối file.
-- ============================================================

alter table public.import_contract_lines add column if not exists product_id text;

create index if not exists import_contract_lines_product_idx on public.import_contract_lines (site_id, product_id);

-- Kiểm (chỉ đọc):
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'import_contract_lines' and column_name = 'product_id';
--   -- dòng chưa nối của HĐ đang mở (việc của Phòng Kế hoạch trước khi đóng HĐ):
--   select c.contract_no, l.line_no, l.product_name
--     from public.import_contract_lines l join public.import_contracts c on c.id = l.contract_id
--    where c.status = 'open' and coalesce(l.product_id, '') = '' order by 1, 2;

-- ROLLBACK (chỉ khi cần gỡ — mất các nối đã ghi):
--   drop index if exists public.import_contract_lines_product_idx;
--   alter table public.import_contract_lines drop column if exists product_id;
