-- ============================================================
-- Baseafood MES — 0096: HÀNG CỦA CHUYẾN XUẤT + SỐ THỰC ĐÓNG + LẬP INVOICE TỪ APP
--
-- Vì sao (2026-11-02, ba-spec 63, chị Vi — Phòng Kế hoạch): chuyến xuất mới ghi TỔNG thùng; invoice /
-- packing list làm tay bằng Excel. Phòng KH muốn nhập chi tiết từng mặt hàng của chuyến, kho đóng cont
-- xong điền số thực đóng, rồi app tải ra file Commercial Invoice theo mẫu đang dùng.
--
-- Làm gì — chỉ thêm, chạy SAU 0095:
--   1. Bảng MỚI `export_shipment_lines`: hàng đóng vào MỘT chuyến (mô tả · size · quy cách · kg/thùng ·
--      kg cả bì/kiện · số kiện kế hoạch · số kiện THỰC ĐÓNG · hạn dùng). KHÔNG có cột giá — người đóng
--      hàng đọc được bảng này (R10 ba-spec 41: người đóng hàng không thấy giá).
--      RLS: đọc = `export-plans` xem HOẶC `export-plans.loading` xem; thêm / sửa = `export-plans` thêm
--      / sửa HOẶC `export-plans.loading` thêm (kho điền số thực đóng — app ghi bằng upsert nên cần cả
--      insert); xóa = `export-plans` xóa / sửa. Trigger chặn người CHỈ có quyền đóng hàng tạo dòng mới
--      hoặc sửa cột khác ngoài số thực đóng.
--   2. Cột MỚI `export_step_items.invoice_composition` (jsonb): ngân hàng chọn, đơn giá từng dòng, điều
--      kiện giao, ghi chú riêng của khách — chỉ ở mục Commercial Invoice (người đóng hàng không đọc
--      được mục bước 5 — policy 0075 giữ nguyên).
--   3. Danh sách chọn `bank-account` ở `export_options` (nới ràng buộc 0095) + 3 tài khoản thụ hưởng.
-- KHÔNG đổi bảng / cột / policy nào đang có (chỉ nới check `list_kind` của 0095).
-- Idempotent. ⚠ Chưa chạy ⇒ app ẩn phần Hàng của chuyến / Lập invoice (không ghi, không kẹt hàng chờ).
-- ROLLBACK cuối file.
-- ============================================================

-- 1. Hàng của chuyến -------------------------------------------------------------------------------
create table if not exists public.export_shipment_lines (
  id                  text primary key,
  site_id             text not null default 'bsf1' references public.sites(id),
  -- Liên kết MỀM như export_step_items (0075): xóa chuyến có Hoàn tác ⇒ không cascade mất dòng.
  shipment_id         text not null,
  contract_id         text not null default '',
  sort_order          integer not null default 0,
  contract_line_id    text not null default '',
  product_id          text not null default '',
  description         text not null default '',
  size                text not null default '',
  packing             text not null default '',
  unit_kind           text not null default 'carton' check (unit_kind in ('carton', 'bundle')),
  cartons_per_unit    numeric not null default 1,
  net_kg_per_carton   numeric,
  gross_kg_per_unit   numeric,
  planned_units       numeric,
  loaded_units        numeric,
  loaded_by           text not null default '',
  loaded_at           timestamptz,
  expiry              text not null default '',
  note                text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists export_shipment_lines_shipment_idx on public.export_shipment_lines (shipment_id, sort_order);

drop trigger if exists export_shipment_lines_touch_updated_at on public.export_shipment_lines;
create trigger export_shipment_lines_touch_updated_at
  before update on public.export_shipment_lines
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

-- Người CHỈ có quyền đóng hàng (không sửa được chuyến) chỉ đổi được số thực đóng + người / giờ điền.
-- App ghi bằng upsert (INSERT … ON CONFLICT DO UPDATE) ⇒ Postgres kiểm cả policy INSERT với dòng đề xuất,
-- và trigger BEFORE INSERT chạy cả khi dòng đã có. Nên: policy insert mở cho người đóng hàng, còn trigger
-- chặn họ TẠO dòng mới thật sự (id chưa có) và chặn sửa cột khác ở nhánh update.
create or replace function public.export_shipment_lines_loading_guard()
returns trigger language plpgsql as $$
begin
  if public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.export_shipment_lines x where x.id = new.id) then
      raise exception 'Người đóng hàng không thêm được dòng hàng của chuyến';
    end if;
    return new;
  end if;
  if (new.shipment_id, new.contract_id, new.sort_order, new.contract_line_id, new.product_id, new.description,
      new.size, new.packing, new.unit_kind, new.cartons_per_unit, new.net_kg_per_carton, new.gross_kg_per_unit,
      new.planned_units, new.expiry, new.note)
     is distinct from
     (old.shipment_id, old.contract_id, old.sort_order, old.contract_line_id, old.product_id, old.description,
      old.size, old.packing, old.unit_kind, old.cartons_per_unit, old.net_kg_per_carton, old.gross_kg_per_unit,
      old.planned_units, old.expiry, old.note) then
    raise exception 'Người đóng hàng chỉ điền được số thực đóng của dòng hàng';
  end if;
  return new;
end $$;
drop trigger if exists export_shipment_lines_loading_guard on public.export_shipment_lines;
create trigger export_shipment_lines_loading_guard
  before insert or update on public.export_shipment_lines
  for each row execute function public.export_shipment_lines_loading_guard();

alter table public.export_shipment_lines enable row level security;
drop policy if exists export_shipment_lines_select on public.export_shipment_lines;
drop policy if exists export_shipment_lines_insert on public.export_shipment_lines;
drop policy if exists export_shipment_lines_update on public.export_shipment_lines;
drop policy if exists export_shipment_lines_delete on public.export_shipment_lines;
create policy export_shipment_lines_select on public.export_shipment_lines for select to authenticated
  using (public.has_export_permission('export-plans', 'view') or public.has_export_permission('export-plans.loading', 'view'));
create policy export_shipment_lines_insert on public.export_shipment_lines for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
              or public.has_export_permission('export-plans.loading', 'create'));
create policy export_shipment_lines_update on public.export_shipment_lines for update to authenticated
  using (public.has_export_permission('export-plans', 'update') or public.has_export_permission('export-plans.loading', 'create'))
  with check (public.has_export_permission('export-plans', 'update') or public.has_export_permission('export-plans.loading', 'create'));
create policy export_shipment_lines_delete on public.export_shipment_lines for delete to authenticated
  using (public.has_export_permission('export-plans', 'delete') or public.has_export_permission('export-plans', 'update'));

revoke all on public.export_shipment_lines from anon;
grant select, insert, update, delete on public.export_shipment_lines to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists export_shipment_lines_sql_audit on public.export_shipment_lines';
    execute 'create trigger export_shipment_lines_sql_audit after insert or update or delete on public.export_shipment_lines
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  end if;
end $$;

-- 2. Lập invoice ở mục Commercial Invoice -----------------------------------------------------------
alter table public.export_step_items add column if not exists invoice_composition jsonb;

-- 3. Tài khoản ngân hàng thụ hưởng ------------------------------------------------------------------
alter table public.export_options drop constraint if exists export_options_list_kind_check;
alter table public.export_options add constraint export_options_list_kind_check
  check (list_kind in ('loading-port', 'discharge-port', 'container-type', 'currency', 'bank-account'));

-- Trùng `EXPORT_OPTION_SEED` (src/lib/exportOptions.ts): `name` = tên ngắn để chọn, `note` = khối in
-- dưới "Please make TT to:" trên invoice (mỗi dòng một dòng in). Có rồi thì giữ bản đang có.
insert into public.export_options (id, site_id, list_kind, name, sort_order, note) values
  ('bank-account-msb-vung-tau', 'bsf1', 'bank-account', 'MSB Vũng Tàu · 08001370022669', 10,
   'Bank name: VIETNAM MARITIME COMMERCIAL JOINT STOCK BANK VUNG TAU BRANCH' || chr(10) ||
   'Account number: 08001370022669' || chr(10) ||
   'SWIFT CODE: MCOBVNVX007' || chr(10) ||
   'Beneficiary: BASEAFOOD 1 CO., LTD' || chr(10) ||
   'Full address of Beneficiary: 321 Tran Xuan Do St., Quarter 2, Ba Ria Ward, Ho Chi Minh City, S.R.Viet Nam'),
  ('bank-account-vcb-ba-ria', 'bsf1', 'bank-account', 'Vietcombank Bà Rịa · 0081371242432', 20,
   'Bank name: JOINT STOCK COMMERCIAL BANK FOR FOREIGN TRADE OF VIET NAM, BA RIA BRANCH' || chr(10) ||
   'Account number: 0081371242432' || chr(10) ||
   'SWIFT CODE: BFTVVNVX115' || chr(10) ||
   'Beneficiary: BASEAFOOD 1 CO.,LTD' || chr(10) ||
   'Address of Beneficiary: 321 Tran Xuan Do St., Quarter 2, Ba Ria Ward, Ho Chi Minh City, Viet Nam'),
  ('bank-account-vietinbank-brvt', 'bsf1', 'bank-account', 'VietinBank BRVT · 110000206680', 30,
   'Bank name: VIETNAM JOINT STOCK COMMERCIAL BANK FOR INDUSTRY AND TRADE, BRVT BRANCH' || chr(10) ||
   'Account number: 110000206680' || chr(10) ||
   'SWIFT CODE: ICBVVNVX880' || chr(10) ||
   'Beneficiary: BASEAFOOD 1 CO.,LTD' || chr(10) ||
   'Address of Beneficiary: 321 Tran Xuan Do St., Quarter 2, Ba Ria Ward, Ho Chi Minh City, Viet Nam')
on conflict (id) do nothing;

-- KIỂM (chỉ đọc):
--   select count(*) from pg_policies where tablename = 'export_shipment_lines';              -- 4
--   select column_name from information_schema.columns
--     where table_name = 'export_step_items' and column_name = 'invoice_composition';       -- 1 dòng
--   select id from public.export_options where list_kind = 'bank-account' order by sort_order; -- 3 dòng

-- ============================================================
-- ROLLBACK (mất hàng của chuyến + phần lập invoice; chuyến, mục chứng từ, file giữ nguyên):
--   drop table if exists public.export_shipment_lines;
--   drop function if exists public.export_shipment_lines_loading_guard();
--   alter table public.export_step_items drop column if exists invoice_composition;
--   delete from public.export_options where list_kind = 'bank-account';
--   alter table public.export_options drop constraint if exists export_options_list_kind_check;
--   alter table public.export_options add constraint export_options_list_kind_check
--     check (list_kind in ('loading-port', 'discharge-port', 'container-type', 'currency'));
-- ============================================================
