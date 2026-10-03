-- ============================================================
-- Baseafood MES — 0050: bổ sung đại lý từ file "tên ngư dân.xlsx" (dòng 2–28, STT 1→19)
--
-- Vì sao: danh mục đại lý trên máy chủ mới có 10 đại lý seed (0013) + vài đại lý
-- tạo tại chỗ; xưởng gửi danh sách đầy đủ để lập phiếu (tên ghi phiếu, địa chỉ,
-- MST/CCCD). Đối chiếu + người dùng duyệt 2026-10-03.
--
-- Quyết định đã duyệt:
--   • THÊM 14 đại lý mới. Ô "Tên đại lý" trống ⇒ short_name = tên ghi phiếu.
--   • "DNTN Bình Dương" có 2 dòng trùng MST trong file ⇒ thêm MỘT lần.
--   • CCCD mất số 0 đầu do Excel lưu dạng số (Điến, Linh) ⇒ thêm lại số 0 (12 số).
--   • Cột "NƠI CẤP" trong file thực chất là TÀI XẾ + BIỂN SỐ ⇒ để trống
--     issued_place, chuyển sang note "Xe: …" (gợi ý xe ở Nhập hàng lấy từ lịch sử
--     chuyến, không đọc ô này).
--   • 2 đại lý đang có bị dính lỗi cột trên (Trọng Hòa, Huỳnh Mừng) ⇒ dọn
--     issued_place sang note. Huỳnh Mừng ghi thêm tên gọi khác "thuận pt".
--   • KHÔNG đổi short_name của đại lý nào (sổ nhập nối theo TÊN — supplier_name).
--   • "Hưng - Huyền - An" CHÍNH LÀ "Hưng V Tàu", "Bé Ba" CHÍNH LÀ "Bê 3" (người dùng
--     xác nhận 2026-10-03) ⇒ điền tên ghi phiếu/địa chỉ/MST vào 2 đại lý đang có
--     (đang để tên ghi phiếu = biệt danh, chưa MST), giữ short_name, tên trong file
--     ghi vào note làm tên gọi khác. Tuấn Tô giữ nguyên tên ghi phiếu ("…TUẤN TÔ").
--   • ĐỔI TÊN GỌI TẮT (người dùng yêu cầu): "Hưng V Tàu" → "Hưng Vũng Tàu",
--     "Bê 3" → "Bé 3". Sổ nối đại lý theo TÊN ⇒ đổi LUÔN supplier_name ở
--     material_imports (6 dòng) + import_shipments (3 chuyến) để sổ cũ vẫn nối.
--     CHỈ đổi cột tên — kg/giá/ngày/xưởng không đụng (trigger 0048 ghi vết từng dòng).
--
-- An toàn / idempotent:
--   • INSERT chỉ khi CHƯA có đại lý cùng MST/CCCD hoặc cùng short_name.
--   • id tất định 'dl-0050-<MST>' ⇒ chạy lại không nhân đôi, lùi được theo id.
--   • UPDATE có guard theo giá trị cũ ⇒ lần chạy thứ hai không đụng gì.
--
-- ROLLBACK (chạy tay nếu cần lùi):
--   delete from public.suppliers s where s.id like 'dl-0050-%'
--     and not exists (select 1 from public.material_imports m where m.supplier_name = s.short_name)
--     and not exists (select 1 from public.import_shipments i where i.supplier_name = s.short_name);
--   update public.suppliers set issued_place = 'Phan Thị Bảo Trúc 72C-19440', note = ''
--     where id = 'd3ce59bf-7f65-4edc-a4ff-21b0e6782e1f' and note = 'Xe: Phan Thị Bảo Trúc 72C-19440';
--   update public.suppliers set issued_place = 'Đồng Văn Thuận - 72C.13601', note = ''
--     where id = 'a593db76-f531-4ad2-b89b-64030091a61b'
--       and note = 'Tên gọi khác: thuận pt · Xe: Đồng Văn Thuận - 72C.13601';
--   -- lùi đổi tên (chạy TRƯỚC 2 câu dưới):
--   update public.material_imports set supplier_name = 'Hưng V Tàu' where supplier_name = 'Hưng Vũng Tàu';
--   update public.material_imports set supplier_name = 'Bê 3' where supplier_name = 'Bé 3';
--   update public.import_shipments set supplier_name = 'Hưng V Tàu' where supplier_name = 'Hưng Vũng Tàu';
--   update public.import_shipments set supplier_name = 'Bê 3' where supplier_name = 'Bé 3';
--   update public.suppliers set short_name = 'Hưng V Tàu' where id = 'seed-sup-5';
--   update public.suppliers set short_name = 'Bê 3' where id = 'seed-sup-1';
--   update public.suppliers set billing_name = 'Hưng V Tàu', address = '', national_id = '',
--     note = 'Đại lý bạch tuộc 2 da' where id = 'seed-sup-5' and national_id = '3502565425';
--   update public.suppliers set billing_name = 'Bê 3', address = '', national_id = '',
--     note = 'Đại lý bạch tuộc 2 da' where id = 'seed-sup-1' and national_id = '3401268472';
-- ============================================================

with moi (short_name, billing_name, address, national_id, note) as (
  values
    ('Điến', 'HỘ KINH DOANH MUA BÁN THỦY HẢI SẢN VĂN ĐIẾN',
      'Tổ 10, ấp Hải Lâm, Long Hải, HCM', '037065001163', ''),
    ('Linh', 'HỘ KINH DOANH TRƯƠNG THỊ NGỌC LINH',
      'F70, Tổ 15, Ấp Phước Lợi, Xã Long Hải, Thành phố Hồ Chí Minh', '051183000256',
      'Xe: Phan Hạt Nhân - 72L.5327'),
    ('Quyên', 'CÔNG TY TNHH MTV VẠN PHI',
      'Số 19, Ấp Vĩnh Thành A, Xã Bình An, An Giang', '1702319984',
      'Xe: Phạm Văn Linh - 68C-02140'),
    ('Cty TNHH Thủy Sản Ngọc Thủy', 'Cty TNHH Thủy Sản Ngọc Thủy',
      'Tổ 3 ấp Phước Lâm, Phước Hưng, Long Điền', '3501957476', ''),
    ('Bé 6', 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI - DỊCH VỤ HOÀNG PHÚC - LONG HẢI',
      'Tổ 33/39 Ô3, khu phố Hải Lộc, Xã Long Hải, Thành phố Hồ Chí Minh', '3502457194',
      'Xe: Lý Ngọc Hiền 60C-06772'),
    ('Cúc Song', 'HỘ KINH DOANH THỦY SẢN MINH SONG',
      '335C3 đường Trần Phú, P Vũng Tàu, Hồ Chí Minh', '077083005528',
      'Xe: Lê Tấn Thành 72C- 08509'),
    ('DNTN Bình Dương', 'DNTN Bình Dương',
      'Số 41 Phước Thắng, Phường 12, Vũng Tàu', '3500504096', ''),
    ('Cty TNHH MTV Tiến Triển', 'Cty TNHH MTV Tiến Triển',
      'Tổ 4 ấp Hòn Chồng, xã Bình An, huyện Kiên Lương, KG', '1700594079', ''),
    ('Thuý', 'CÔNG TY TNHH CHẾ BIẾN KINH DOANH HẢI SẢN ANH DŨNG',
      'Số 13 Tổ 3, ấp Phước Lâm, xã Long Hải, thành phố Hồ Chí Minh', '3502553532',
      'Xe: Lương Thế Toàn 72C - 20658'),
    ('Cty TNHH Thủy Sản Nguyên Đức', 'Cty TNHH Thủy Sản Nguyên Đức',
      'Kp5, P9, Tp Mỹ Tho, Tiền Giang', '1201536681', ''),
    ('Cty TNHH Thủy Sản Thanh Hào', 'Cty TNHH Thủy Sản Thanh Hào',
      'Khu chế biến Hải Sản tập trung, An Hải, Lộc An, Đất Đỏ', '3500589389', ''),
    ('Lư', 'CÔNG TY TNHH MTV TÂN BÌNH ANH',
      'Tổ 1, ấp Tân Bình, Xã Châu Thành, Tỉnh An Giang', '1702297106', ''),
    ('DOANH NGHIỆP TƯ NHÂN THƯƠNG MẠI VÀ DỊCH VỤ THANH BÌNH',
      'DOANH NGHIỆP TƯ NHÂN THƯƠNG MẠI VÀ DỊCH VỤ THANH BÌNH',
      '172 đường Thống Nhất, Phường Tân Thiện, Thị xã La Gi, Tỉnh Bình Thuận', '3400058352', ''),
    ('DNTN Huỳnh Hoàng Phương', 'DNTN Huỳnh Hoàng Phương',
      'Số 39, Tổ 9,Ấp Vĩnh Thành A, Vĩnh Hòa Hiệp, Châu Thành, KG', '1701967679', '')
)
insert into public.suppliers (id, short_name, billing_name, address, national_id, note)
select 'dl-0050-' || m.national_id, m.short_name, m.billing_name, m.address, m.national_id, m.note
from moi m
where not exists (
  select 1 from public.suppliers s
  where trim(s.national_id) = m.national_id
     or lower(trim(s.short_name)) = lower(m.short_name)
);

-- Dọn tài xế/biển số khỏi ô "Nơi cấp" của 2 đại lý đang có (guard theo giá trị cũ).
update public.suppliers
set issued_place = '', note = 'Xe: Phan Thị Bảo Trúc 72C-19440', updated_at = now()
where id = 'd3ce59bf-7f65-4edc-a4ff-21b0e6782e1f'
  and issued_place = 'Phan Thị Bảo Trúc 72C-19440'
  and note = '';

update public.suppliers
set issued_place = '', note = 'Tên gọi khác: thuận pt · Xe: Đồng Văn Thuận - 72C.13601', updated_at = now()
where id = 'a593db76-f531-4ad2-b89b-64030091a61b'
  and issued_place = 'Đồng Văn Thuận - 72C.13601'
  and note = '';

-- Hưng V Tàu = "Hưng - Huyền - An" (Hưng Thịnh Phát VT). Guard: chưa có MST.
update public.suppliers
set billing_name = 'CÔNG TY TNHH THUỶ SẢN HƯNG THỊNH PHÁT VT',
    address = '335C3 đường Trần Phú, Phường Vũng Tàu, Thành phố Hồ Chí Minh',
    national_id = '3502565425',
    note = 'Đại lý bạch tuộc 2 da · Tên gọi khác: Hưng - Huyền - An · Xe: 72C 177.17',
    updated_at = now()
where id = 'seed-sup-5' and national_id = '';

-- Bê 3 = "Bé Ba" (Hoa Chương). Guard: chưa có MST.
update public.suppliers
set billing_name = 'CÔNG TY TNHH MTV HOA CHƯƠNG',
    address = '409 Thôn Hà Thủy 1, Xã Phan Rí Cửa, Tỉnh Lâm Đồng',
    national_id = '3401268472',
    note = 'Đại lý bạch tuộc 2 da · Tên gọi khác: Bé Ba',
    updated_at = now()
where id = 'seed-sup-1' and national_id = '';

-- Đổi tên gọi tắt + đổi theo trong sổ (chỉ cột tên). Guard theo tên cũ ⇒ chạy lại không đụng.
update public.suppliers set short_name = 'Hưng Vũng Tàu',
  note = 'Đại lý bạch tuộc 2 da · Tên gọi khác: Hưng - Huyền - An, Hưng V Tàu · Xe: 72C 177.17',
  updated_at = now()
where id = 'seed-sup-5' and short_name = 'Hưng V Tàu';
update public.suppliers set short_name = 'Bé 3',
  note = 'Đại lý bạch tuộc 2 da · Tên gọi khác: Bé Ba, Bê 3',
  updated_at = now()
where id = 'seed-sup-1' and short_name = 'Bê 3';
update public.material_imports set supplier_name = 'Hưng Vũng Tàu' where supplier_name = 'Hưng V Tàu';
update public.material_imports set supplier_name = 'Bé 3' where supplier_name = 'Bê 3';
update public.import_shipments set supplier_name = 'Hưng Vũng Tàu' where supplier_name = 'Hưng V Tàu';
update public.import_shipments set supplier_name = 'Bé 3' where supplier_name = 'Bê 3';
