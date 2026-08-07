-- ============================================================
-- Baseafood MES — 0013: seed danh mục đại lý (theo ảnh người dùng cung cấp)
--
-- TỰ THÊM CỘT trước khi seed (không còn phụ thuộc thứ tự với 0009) — chạy được
-- kể cả khi 0009 chưa chạy. `add column if not exists` nên trùng 0009 vẫn an toàn.
--
-- An toàn: chỉ THÊM đại lý CHƯA có (so theo TÊN GHI PHIẾU, không phân biệt
-- hoa/thường). Chạy lại nhiều lần KHÔNG nhân đôi. Không xóa/đụng đại lý đang có.
--
-- Ánh xạ cột ảnh → dai_ly:
--   STT → ma (mã nội bộ; ảnh đánh số không liên tục, có trùng — chỉ là nhãn)
--   TÊN ĐẠI LÝ → ten (biệt danh gọi tắt trên sổ; ô trống → đặt biệt danh ngắn
--     suy từ tên công ty, vì `ten` là khóa sổ nhập lưu theo)
--   TÊN GHI PHIẾU → ten_ghi_phieu ; ĐỊA CHỈ → dia_chi ; CMND → cmnd
--   NGÀY CẤP → ngay_cap (ảnh để trống) ; NƠI CẤP → noi_cap
--
-- Lưu ý: ảnh bị cắt ở dòng "Tuấn Tô" (25) — còn đại lý phía dưới chưa thấy;
-- gửi ảnh đầy đủ để bổ sung. Địa chỉ/tên có DẤU là DỮ LIỆU (được phép) — quy
-- ước không-dấu chỉ áp cho TÊN bảng/cột.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- Bảo đảm có cột (trùng 0009 — if not exists nên không lỗi khi 0009 đã chạy).
alter table public.dai_ly
  add column if not exists ten_ghi_phieu text not null default '',
  add column if not exists dia_chi       text not null default '',
  add column if not exists cmnd          text not null default '',
  add column if not exists ngay_cap      text not null default '',
  add column if not exists noi_cap       text not null default '';

insert into public.dai_ly
  (id, xi_nghiep_id, ma, ten, ten_ghi_phieu, dia_chi, cmnd, ngay_cap, noi_cap, dien_thoai, ghi_chu)
select
  extensions.gen_random_uuid()::text, 'bsf1',
  v.ma, v.ten, v.ten_ghi_phieu, v.dia_chi, v.cmnd, '', v.noi_cap, '', ''
from (values
  ('1',  'Hồng Phú',   'Công ty TNHH TM Hồng Phú',
   'Số 1725 Võ Nguyên Giáp, Phường Phước Thắng, HCM', '3500424848', ''),
  ('2',  'mậu',        'CÔNG TY TNHH LANG HUỲNH',
   '159B Lê Lợi, Phường Phước Hội, Tỉnh Lâm Đồng', '3401206356', ''),
  ('27', 'Trọng Hòa',  'CÔNG TY TNHH THỦY SẢN TRỌNG HÒA',
   'Số 16 Hùng Vương, Phường Vũng Tàu, Thành Phố Hồ Chí Minh', '3502321644',
   'Phan Thị Bảo Trúc 72C-19440'),
  ('3',  'Hương Pháp', 'Cty TNHH Hải Sản Hương Pháp',
   'Khu phố 13, Phường Mũi Né, Tỉnh Lâm Đồng, Việt Nam', '3401068402', ''),
  ('2b', 'Nam Tuyền',  'CT TNHH MTV DV CB THỦY HẢI SẢN NAM TUYỀN',
   'Ấp Đôi Ma 2, Xã Gia Thuận, Tỉnh Đồng Tháp', '1201159602', ''),
  ('4',  'hiếu phấn',  'CÔNG TY TNHH HIẾU PHẤN',
   'Thửa đất số 167, Tờ bản đồ số 27, khu phố 2, Xã Gia Thuận, Tỉnh Đồng Tháp, Việt Nam',
   '1201686207', ''),
  ('5',  'thuận pt',   'CÔNG TY TRÁCH NHIỆM HỮU HẠN THỦY SẢN HUỲNH MỪNG',
   'Tổ 7, ấp Minh Phong, Xã Bình An, Tỉnh An Giang', '1702205183',
   'Đồng Văn Thuận - 72C.13601'),
  ('14', 'P Cơ',       'Cty Cổ Phần Thủy Sản Phước Cơ',
   '1738 đường Võ Nguyên Giáp, Phường Phước Thắng, Thành phố Hồ Chí Minh, Việt Nam',
   '3500740921', ''),
  ('6',  'Hoàn Truyền','CTY TNHH HOÀN TRUYỀN',
   'Số 09, tổ 14, ấp Lò Vôi, Xã Long Hải, TP Hồ Chí Minh, Việt Nam', '3501280145', ''),
  ('25', 'Tuấn Tô',    'CÔNG TY TNHH THƯƠNG MẠI CHẾ BIẾN HẢI SẢN TUẤN TÔ',
   'Tổ 3, Ấp An Bình, Xã Bình An, Tỉnh An Giang, Việt Nam', '1702253035', '')
) as v(ma, ten, ten_ghi_phieu, dia_chi, cmnd, noi_cap)
where not exists (
  select 1 from public.dai_ly d
  where d.xi_nghiep_id = 'bsf1'
    and lower(d.ten_ghi_phieu) = lower(v.ten_ghi_phieu)
);
