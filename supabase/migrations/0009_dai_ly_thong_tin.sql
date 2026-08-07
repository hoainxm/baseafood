-- ============================================================
-- Baseafood MES — 0009: thông tin đầy đủ cho đại lý nhập hàng
--
-- Chạy SAU 0001. An toàn với dữ liệu đang có (CHỈ THÊM cột, không xóa).
-- Chạy lại nhiều lần vẫn không lỗi (idempotent nhờ `if not exists`).
--
-- Vì sao: sổ đại lý thật cần thông tin ghi hóa đơn/phiếu, không chỉ tên gọi tắt:
--   • ten_ghi_phieu — tên đầy đủ trên phiếu (VD "Công ty TNHH TM Hồng Phú"),
--     khác `ten` là biệt danh gọi tắt trên sổ (VD "Hồng Phú")
--   • dia_chi       — địa chỉ
--   • cmnd          — CMND/CCCD người đại diện hoặc mã số thuế công ty
--   • ngay_cap      — ngày cấp CMND (chuỗi tự do, nhiều dòng để trống)
--   • noi_cap       — nơi cấp
--
-- Tầng repo (`repo.ts`) chỉ GỬI các cột này khi có giá trị ⇒ đại lý vẫn ghi
-- được kể cả khi CHƯA chạy migration này. Chạy chỉ cần khi muốn LƯU thông tin
-- lên máy chủ.
--
-- Lùi (rollback):
--   alter table public.dai_ly
--     drop column if exists ten_ghi_phieu,
--     drop column if exists dia_chi,
--     drop column if exists cmnd,
--     drop column if exists ngay_cap,
--     drop column if exists noi_cap;
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

alter table public.dai_ly
  add column if not exists ten_ghi_phieu text not null default '',
  add column if not exists dia_chi       text not null default '',
  add column if not exists cmnd          text not null default '',
  add column if not exists ngay_cap      text not null default '',
  add column if not exists noi_cap       text not null default '';
