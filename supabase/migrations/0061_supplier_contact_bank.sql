-- ============================================================
-- Baseafood MES — 0061: thông tin liên hệ + ngân hàng của đại lý, bổ sung 2 đại lý
--
-- Vì sao (2026-10-15): đối chiếu 3 hóa đơn GTGT đại lý gửi về (Hồng Hải NT số 353
-- ngày 04/10, Huy Phát số 191 ngày 08/10, Trung Vy Phát số 785 ngày 09/10) với
-- danh mục trên DB thật:
--   • Huy Phát (MST 4200536821) ĐÃ CÓ — chỉ thiếu số tài khoản ngân hàng.
--   • Hồng Hải NT (MST 4201617424) và Trung Vy Phát (MST 1702035693) CHƯA CÓ.
--   • Hóa đơn ghi email, số tài khoản, ngân hàng + chi nhánh — bảng `suppliers`
--     chưa có chỗ lưu (mới có tên, tên ghi phiếu, địa chỉ, MST/CCCD, ngày/nơi cấp,
--     điện thoại, ghi chú) ⇒ kế toán phải tra lại hóa đơn mỗi lần chuyển khoản.
--
-- Làm gì:
--   1. Thêm 4 cột text NOT NULL DEFAULT '' (cùng kiểu các cột thông tin khác của
--      bảng; app luôn gửi chuỗi, không gửi null): email, bank_account, bank_name,
--      bank_branch. Cột thêm vào bảng đã có ⇒ RLS của 0021 áp nguyên, không đổi.
--   2. Thêm 2 đại lý, id tất định 'dl-0061-<MST>', CHỈ khi chưa có đại lý cùng MST
--      hoặc cùng tên gọi tắt (không phân hoa thường) trên site bsf1.
--   3. Điền tài khoản ngân hàng cho Huy Phát — chỉ khi ô đang trống.
--   KHÔNG đổi short_name nào (sổ nhập nối đại lý theo TÊN — supplier_name).
--
-- An toàn / idempotent: `add column if not exists`; INSERT có guard not exists;
-- UPDATE có guard `bank_account = ''` ⇒ chạy lại lần hai không đổi gì.
--
-- ⚠ THỨ TỰ TRIỂN KHAI: chạy file này TRƯỚC khi bản app mới (gửi 4 cột này trong
-- toRow của SUPPLIER_TABLE) lên Vercel. Ngược lại mọi lần lưu đại lý bị máy chủ từ
-- chối (cột không tồn tại) và kẹt ở hàng chờ.
--
-- ROLLBACK (chạy tay nếu cần lùi, theo thứ tự):
--   delete from public.suppliers s where s.id like 'dl-0061-%'
--     and not exists (select 1 from public.material_imports m where m.supplier_name = s.short_name)
--     and not exists (select 1 from public.import_shipments i where i.supplier_name = s.short_name);
--   update public.suppliers set bank_account = '', bank_name = '', bank_branch = ''
--     where national_id = '4200536821' and bank_account = '13351529';
--   -- chỉ khi đã lùi app về bản không gửi 4 cột này:
--   alter table public.suppliers drop column if exists email,
--     drop column if exists bank_account, drop column if exists bank_name,
--     drop column if exists bank_branch;
-- ============================================================

alter table public.suppliers add column if not exists email text not null default '';
alter table public.suppliers add column if not exists bank_account text not null default '';
alter table public.suppliers add column if not exists bank_name text not null default '';
alter table public.suppliers add column if not exists bank_branch text not null default '';

with new_suppliers (short_name, billing_name, address, national_id, phone, email,
                    bank_account, bank_name, bank_branch, note) as (
  values
    ('Hồng Hải NT', 'CÔNG TY TNHH TM-DV HỒNG HẢI NT',
      '46 Phước Long, Phường Nam Nha Trang, Tỉnh Khánh Hòa, Việt Nam', '4201617424',
      '0903536774', 'honghai46pl@gmail.com', '', '', '',
      'Theo HĐ GTGT 1C26THH số 353 ngày 04/10/2026'),
    ('Trung Vy Phát', 'CÔNG TY TRÁCH NHIỆM HỮU HẠN TRUNG VY PHÁT',
      'Tổ 3, Quốc Lộ 63, Ấp An Phước, Xã Bình An, Tỉnh An Giang', '1702035693',
      '0914845758', '', '1914845758', 'VPBank', 'CN Kiên Giang',
      'Theo HĐ GTGT 1C26TVP số 785 ngày 09/10/2026')
)
insert into public.suppliers
  (id, site_id, code, short_name, billing_name, address, national_id, phone, email,
   bank_account, bank_name, bank_branch, note)
select 'dl-0061-' || n.national_id, 'bsf1', '', n.short_name, n.billing_name, n.address,
       n.national_id, n.phone, n.email, n.bank_account, n.bank_name, n.bank_branch, n.note
from new_suppliers n
where not exists (
  select 1 from public.suppliers s
  where s.site_id = 'bsf1'
    and (s.national_id = n.national_id or lower(s.short_name) = lower(n.short_name))
);

-- Huy Phát: hóa đơn số 191 ghi 2 tài khoản ⇒ tài khoản chính ACB, tài khoản phụ vào ghi chú.
update public.suppliers
set bank_account = '13351529',
    bank_name = 'Ngân hàng TMCP Á Châu (ACB)',
    bank_branch = 'CN Khánh Hòa',
    note = case when note = '' then 'TK khác: 0061001106383 — Vietcombank CN Khánh Hòa'
                else note || ' · TK khác: 0061001106383 — Vietcombank CN Khánh Hòa' end
where site_id = 'bsf1' and national_id = '4200536821' and bank_account = '';
