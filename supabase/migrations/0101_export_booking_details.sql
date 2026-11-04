-- ============================================================
-- Baseafood MES — 0101: THÔNG TIN BOOKING + THÔNG TIN XE VẬN CHUYỂN của chuyến xuất khẩu
--
-- Vì sao (2026-11-03, ba-spec docs/app-map/71-export-booking-details.ba-spec.md, Phòng Kế hoạch): hàng "File
-- booking" (0094) chỉ có file; muốn biết cảng, bãi hạ, hạn Doc / VGM / hạ bãi phải mở PDF. Nay app đọc file
-- booking ra từng trường, và ghi thêm cụm thông tin xe kéo cont cho người đóng hàng xem.
--
-- Làm gì:
--   1. export_shipments: thêm 9 cột booking (đại lý, nơi nhận / giao hàng, cảng đi, nơi hạ bãi, bãi lấy rỗng
--      theo booking, 3 hạn cut-off) + 8 cột xe vận chuyển. Chữ mặc định '' (NOT NULL như các cột chữ sẵn có
--      của bảng), hạn = timestamp không múi giờ (giờ địa phương in trên booking), để trống được.
--      Tàu / chuyến, Cảng đến, Loại cont dùng cột sẵn có (vessel_voyage, port_of_discharge, kind).
--   2. export_options: nới `export_options_list_kind_check` thêm 4 danh sách — forwarder (đại lý),
--      haulier (công ty vận chuyển), container-yard (bãi lấy rỗng / hạ bãi), stuffing-place (nơi đóng cont).
-- KHÔNG đổi RLS: cột mới theo quyền `export_shipments` sẵn có (0075) — người đóng hàng đọc được, không sửa.
-- Idempotent (chạy lại không lỗi). Chạy sau 0096 (ràng buộc list_kind gần nhất).
-- ⚠ Chưa chạy ⇒ app ẩn ô Đại lý + hai khối mới, giữ hàng File booking như cũ (không gửi cột lạ).
-- ⚠ Chạy lại 0095 / 0096 SAU 0101 khi đã có mục của 4 danh sách mới ⇒ lỗi ràng buộc — đừng chạy lại hai file đó.
-- ROLLBACK cuối file.
-- ============================================================

alter table public.export_shipments
  add column if not exists forwarder             text not null default '',
  add column if not exists place_of_receipt      text not null default '',
  add column if not exists port_of_loading       text not null default '',
  add column if not exists place_of_delivery     text not null default '',
  add column if not exists return_yard           text not null default '',
  add column if not exists empty_pickup_yard     text not null default '',
  add column if not exists doc_cutoff            timestamp,
  add column if not exists vgm_cutoff            timestamp,
  add column if not exists cargo_cutoff          timestamp,
  add column if not exists haulier               text not null default '',
  add column if not exists driver_name           text not null default '',
  add column if not exists driver_phone          text not null default '',
  add column if not exists driver_id_no          text not null default '',
  add column if not exists truck_plate           text not null default '',
  add column if not exists empty_pickup_place    text not null default '',
  add column if not exists stuffing_place        text not null default '',
  add column if not exists transport_return_yard text not null default '';

comment on column public.export_shipments.forwarder is 'Đại lý (forwarder) của booking — ghi ở hộp Ghi chuyến (ba-spec 71 NV1).';
comment on column public.export_shipments.return_yard is 'Nơi hạ bãi theo booking (Full Return CY).';
comment on column public.export_shipments.empty_pickup_yard is 'Bãi lấy rỗng theo booking (Empty Pick Up CY) — chỉ để điền sẵn thông tin xe (ba-spec 71 R6).';
comment on column public.export_shipments.cargo_cutoff is 'Thời hạn hạ bãi = Port Cargo Cut-off của booking (giờ địa phương).';
comment on column public.export_shipments.haulier is 'Công ty vận chuyển (xe kéo cont) — bắt buộc khi ghi thông tin xe (ba-spec 71 R5).';
comment on column public.export_shipments.driver_id_no is 'Số căn cước công dân của tài xế — tùy chọn.';
comment on column public.export_shipments.transport_return_yard is 'Địa điểm hạ bãi của xe — mặc định lấy Nơi hạ bãi của booking.';

alter table public.export_options drop constraint if exists export_options_list_kind_check;
alter table public.export_options add constraint export_options_list_kind_check
  check (list_kind in ('loading-port', 'discharge-port', 'container-type', 'currency', 'bank-account',
                       'forwarder', 'haulier', 'container-yard', 'stuffing-place'));

-- ROLLBACK (chạy tay nếu cần gỡ; bước 2 chỉ chạy được khi chưa có mục của 4 danh sách mới — có rồi thì xóa
-- các mục đó trước, MẤT danh sách đã nhập):
--   alter table public.export_options drop constraint if exists export_options_list_kind_check;
--   alter table public.export_options add constraint export_options_list_kind_check
--     check (list_kind in ('loading-port', 'discharge-port', 'container-type', 'currency', 'bank-account'));
--   alter table public.export_shipments
--     drop column if exists forwarder, drop column if exists place_of_receipt, drop column if exists port_of_loading,
--     drop column if exists place_of_delivery, drop column if exists return_yard, drop column if exists empty_pickup_yard,
--     drop column if exists doc_cutoff, drop column if exists vgm_cutoff, drop column if exists cargo_cutoff,
--     drop column if exists haulier, drop column if exists driver_name, drop column if exists driver_phone,
--     drop column if exists driver_id_no, drop column if exists truck_plate, drop column if exists empty_pickup_place,
--     drop column if exists stuffing_place, drop column if exists transport_return_yard;
