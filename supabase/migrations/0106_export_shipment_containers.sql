-- ============================================================
-- Baseafood MES — 0106: MỘT CHUYẾN XUẤT NHIỀU CONT (ba-spec 73)
--
-- Vì sao (2026-11-05): HĐ 23.26/BSF-SCM.2026 — booking 039GY21068 là "1X20RF & 1X40RF" (một booking, hai cont,
-- 28.600 kg). App coi một chuyến = một cont (ba-spec 41 A5) ⇒ tách 2 chuyến thì invoice thiếu hàng cont 2, giữ 1
-- chuyến thì chỉ ghi được một số cont. Chủ dự án chọn: chuyến = một booking, có 1…n cont.
--
-- Làm gì — CHỈ THÊM, không xóa / đổi cột nào đang có:
--   1. Bảng `export_shipment_containers`: cont THÊM của chuyến (cont 2…n). Cont 1 vẫn là `kind` / `container_no` /
--      `seal_no` của `export_shipments` ⇒ chuyến cũ không phải chuyển dữ liệu. Liên kết MỀM tới chuyến (như
--      export_shipment_lines 0096): xóa chuyến có Hoàn tác ⇒ không cascade.
--      RLS: xem = `export-plans` xem hoặc người đóng hàng (`export-plans.loading` xem); thêm / sửa / xóa = `export-plans`.
--   2. Cột `container_id` (null) ở `export_shipment_lines` — dòng hàng đi cont nào; null / '' = cont 1.
--   3. Cột `container_id` (null) ở `export_files` — ảnh cont / seal của cont nào; null / '' = cont 1.
--   4. Thay thân hàm `export_shipment_lines_loading_guard` (0102): người đóng hàng KHÔNG đổi được `container_id` của
--      dòng; dòng tự thêm lúc đóng cont chỉ gán cont thuộc chính chuyến đó. Mọi luật khác của 0102 giữ nguyên.
-- Idempotent. Chạy SAU 0102 + 0103. ⚠ Chạy lại 0096 / 0098 / 0102 sau file này ⇒ hàm về bản cũ (chạy lại 0106).
-- 🔴 Tạo RLS cho bảng mới — xác nhận với chủ dự án trước khi chạy DB thật. ROLLBACK cuối file.
-- ============================================================

-- 1. Cont thêm của chuyến ------------------------------------------------------------------------------------------
create table if not exists public.export_shipment_containers (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  shipment_id   text not null,
  sort_order    integer not null default 0,
  kind          text not null default '20RF' check (kind in ('20RF', '40RF', '40HC-RF')),
  container_no  text not null default '',
  seal_no       text not null default '',
  loading_date  date,
  note          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists export_shipment_containers_shipment_idx on public.export_shipment_containers (shipment_id, sort_order);

drop trigger if exists export_shipment_containers_touch_updated_at on public.export_shipment_containers;
create trigger export_shipment_containers_touch_updated_at
  before update on public.export_shipment_containers
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

alter table public.export_shipment_containers enable row level security;
drop policy if exists export_shipment_containers_select on public.export_shipment_containers;
drop policy if exists export_shipment_containers_insert on public.export_shipment_containers;
drop policy if exists export_shipment_containers_update on public.export_shipment_containers;
drop policy if exists export_shipment_containers_delete on public.export_shipment_containers;
create policy export_shipment_containers_select on public.export_shipment_containers for select to authenticated
  using (public.has_export_permission('export-plans', 'view') or public.has_export_permission('export-plans.loading', 'view'));
create policy export_shipment_containers_insert on public.export_shipment_containers for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_shipment_containers_update on public.export_shipment_containers for update to authenticated
  using (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'))
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_shipment_containers_delete on public.export_shipment_containers for delete to authenticated
  using (public.has_export_permission('export-plans', 'delete') or public.has_export_permission('export-plans', 'update'));

revoke all on public.export_shipment_containers from anon;
grant select, insert, update, delete on public.export_shipment_containers to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists export_shipment_containers_sql_audit on public.export_shipment_containers';
    execute 'create trigger export_shipment_containers_sql_audit after insert or update or delete on public.export_shipment_containers
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  end if;
end $$;

-- 2–3. Dòng hàng / ảnh gắn cont ------------------------------------------------------------------------------------
alter table public.export_shipment_lines add column if not exists container_id text;
alter table public.export_files add column if not exists container_id text;

-- 4. Người đóng hàng không đổi cont của dòng ----------------------------------------------------------------------
create or replace function public.export_shipment_lines_loading_guard()
returns trigger language plpgsql as $$
begin
  if public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.export_shipment_lines x where x.id = new.id) then
      return new; -- upsert của dòng đã có: nhánh UPDATE bên dưới kiểm cột
    end if;
    if coalesce(new.contract_line_id, '') = ''
       or new.loaded_units is null
       or new.planned_units is not null
       or new.gross_kg_per_unit is not null
       or coalesce(new.expiry, '') <> ''
       or coalesce(new.note, '') <> ''
       or not exists (
         select 1
         from public.export_shipments s
         where s.id = new.shipment_id
           and (
             s.contract_id = new.contract_id
             or (
               exists (select 1 from public.export_shipment_lines x where x.shipment_id = new.shipment_id and x.contract_id = new.contract_id)
               and exists (
                 select 1
                 from public.export_contracts main
                 join public.export_contracts other on other.customer_id = main.customer_id
                 where main.id = s.contract_id and other.id = new.contract_id
               )
             )
           )
       ) then
      raise exception 'Người đóng hàng chỉ thêm được dòng lấy từ dòng hàng của hợp đồng có trên chuyến, kèm số thực đóng';
    end if;
    if coalesce(new.container_id, '') <> ''
       and not exists (select 1 from public.export_shipment_containers c where c.id = new.container_id and c.shipment_id = new.shipment_id) then
      raise exception 'Người đóng hàng chỉ gán được dòng vào cont của chính chuyến đó';
    end if;
    return new;
  end if;
  if (new.shipment_id, new.contract_id, new.sort_order, new.contract_line_id, new.product_id, new.description,
      new.size, new.packing, new.unit_kind, new.cartons_per_unit, new.net_kg_per_carton, new.gross_kg_per_unit,
      new.planned_units, new.expiry, new.note, coalesce(new.container_id, ''))
     is distinct from
     (old.shipment_id, old.contract_id, old.sort_order, old.contract_line_id, old.product_id, old.description,
      old.size, old.packing, old.unit_kind, old.cartons_per_unit, old.net_kg_per_carton, old.gross_kg_per_unit,
      old.planned_units, old.expiry, old.note, coalesce(old.container_id, '')) then
    raise exception 'Người đóng hàng chỉ điền được số thực đóng của dòng hàng';
  end if;
  return new;
end $$;

-- KIỂM (chỉ đọc):
--   select count(*) from pg_policies where tablename = 'export_shipment_containers';                         -- 4
--   select table_name from information_schema.columns
--    where column_name = 'container_id' and table_name in ('export_shipment_lines', 'export_files');       -- 2 dòng
--   select position('cont của chính chuyến' in prosrc) > 0 from pg_proc
--    where proname = 'export_shipment_lines_loading_guard';                                                 -- true

-- ============================================================
-- ROLLBACK (mất danh sách cont thêm + cont của dòng / ảnh; chuyến, dòng, ảnh giữ nguyên, mọi dòng về cont 1):
--   0. Chạy lại 0102 TRƯỚC (hàm trigger bản cũ — bản này đọc cột container_id), rồi:
--   drop table if exists public.export_shipment_containers;
--   alter table public.export_shipment_lines drop column if exists container_id;
--   alter table public.export_files drop column if exists container_id;
-- ============================================================
