-- ============================================================
-- Baseafood MES — 0102: ĐÓNG CONT GHI SỐ THỰC ĐÓNG CHO DÒNG CỦA HĐ PHỤ TRÊN CHUYẾN GỘP (ba-spec 70 R9)
--
-- Vì sao (2026-11-04, chủ dự án đồng ý): khách như DAIREI ký nhiều HĐ song song, mỗi tháng một cont chở hàng của
-- nhiều HĐ cùng khách. Từ ba-spec 70 đợt 1a, Phòng KH thêm hàng của HĐ khác vào cùng chuyến ⇒ dòng
-- `export_shipment_lines.contract_id` có thể khác `export_shipments.contract_id` (HĐ chính của chuyến). Luật 0098 chỉ
-- cho người đóng cont TẠO dòng khi `contract_id` = HĐ chính ⇒ dòng của HĐ phụ chưa có thì đóng cont không ghi được
-- số thực đóng, dòng kẹt hàng chờ.
--
-- Làm gì — CHỈ thay thân hàm trigger `export_shipment_lines_loading_guard` (0096 → 0098); bảng, cột, policy giữ nguyên:
--   • Người có `export-plans` create / update: như cũ, ghi mọi cột.
--   • Người đóng cont (chỉ `export-plans.loading`) TẠO dòng mới được khi đủ luật 0098 (có `contract_line_id`, có số thực
--     đóng, KHÔNG số kế hoạch / kg gross / hạn dùng / ghi chú) VÀ `contract_id` là **HĐ của chuyến**:
--       – HĐ chính của chuyến (như 0098), HOẶC
--       – HĐ đã có ≥ 1 dòng trên chính chuyến đó (Phòng KH đã thêm hàng của HĐ này vào chuyến) VÀ cùng khách với HĐ chính.
--     Đóng cont KHÔNG tự đưa được HĐ mới vào chuyến — việc đó của Phòng KH (cổng `addContractGate` của app).
--   • SỬA: như cũ, chỉ số thực đóng. XÓA: như cũ, không.
-- Idempotent (create or replace). Chạy SAU 0098. ⚠ Chạy lại 0096 hoặc 0098 sau file này ⇒ hàm về bản cũ (chạy lại 0102).
-- ROLLBACK cuối file.
-- ============================================================

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

-- KIỂM (chỉ đọc):
--   select position('hợp đồng có trên chuyến' in prosrc) > 0 from pg_proc
--    where proname = 'export_shipment_lines_loading_guard';                                   -- true

-- ============================================================
-- ROLLBACK: chạy lại 0098 (đóng cont lại chỉ tạo được dòng của HĐ chính; dòng đã tạo giữ nguyên).
-- ============================================================
