-- ============================================================
-- Baseafood MES — 0098: NGƯỜI ĐÓNG CONT TỰ GHI SỐ LƯỢNG THỰC ĐÓNG (tạo dòng hàng của chuyến từ dòng HĐ)
--
-- Vì sao (2026-11-03, feedback Phòng Kế hoạch): "Số lượng thực đóng do bộ phận đóng cont điền sau khi đóng
-- hàng xong; bộ phận chứng từ kế thừa số đó làm invoice." Từ 0096, người chỉ có `export-plans.loading` KHÔNG
-- tạo được dòng `export_shipment_lines` ⇒ chuyến mà Phòng KH chưa nhập "Hàng của chuyến" thì đóng cont không
-- ghi được số, cả quy trình đứng chờ. Chủ dự án chọn (2026-11-03): mở cho đóng cont TẠO dòng, chỉ kèm số thực đóng.
--
-- Làm gì — CHỈ thay thân hàm trigger `export_shipment_lines_loading_guard` (0096); bảng, cột, policy giữ nguyên:
--   • Người có `export-plans` create / update: như cũ, ghi mọi cột.
--   • Người đóng cont (chỉ `export-plans.loading`):
--       – TẠO dòng mới được khi: có `contract_line_id`; `contract_id` đúng HĐ của chuyến; KHÔNG có số kế hoạch,
--         kg gross, hạn dùng, ghi chú (phần đó của Phòng KH / chứng từ); có số thực đóng.
--       – SỬA: như cũ, chỉ số thực đóng (`loaded_units` · `loaded_by` · `loaded_at`).
--       – XÓA: như cũ, không (policy delete không có `export-plans.loading`).
-- Idempotent (create or replace). ⚠ Chưa chạy ⇒ người đóng cont lưu số thực đóng cho chuyến chưa có hàng sẽ bị
-- máy chủ từ chối (dòng kẹt hàng chờ) ⇒ CHẠY 0098 TRƯỚC khi đưa bản app này lên.
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
       or not exists (select 1 from public.export_shipments s where s.id = new.shipment_id and s.contract_id = new.contract_id) then
      raise exception 'Người đóng hàng chỉ thêm được dòng lấy từ dòng hàng của hợp đồng, kèm số thực đóng';
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
--   select position('chỉ thêm được dòng lấy từ dòng hàng' in prosrc) > 0 from pg_proc
--    where proname = 'export_shipment_lines_loading_guard';                                   -- true

-- ============================================================
-- ROLLBACK: chạy lại đoạn `create or replace function public.export_shipment_lines_loading_guard()` của 0096
-- (người đóng cont lại không tạo được dòng; dòng đã tạo giữ nguyên).
-- ============================================================
