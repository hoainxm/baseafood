-- ============================================================
-- Baseafood MES — 0104: ĐƠN GIÁ GIỮ 6 SỐ LẺ
--
-- Vì sao (2026-11-04, chị Thảo — Phòng Kế hoạch): "chỗ đơn giá 6 số sau dấu phẩy nhen, bổ sung luôn ở các vị trí input
-- number trong hệ thống". Ô nhập số của app nay giữ tới 6 số lẻ, nhưng các cột đơn giá cũ chỉ giữ 2 số lẻ ⇒ ghi
-- 12,345678 lên máy chủ thành 12,35, tải lại thấy số khác. Chủ dự án chọn: nới cột ĐƠN GIÁ lên 6 số lẻ; cột kg giữ
-- 3 số lẻ (tới gram là đủ). Đơn giá hợp đồng xuất / invoice nằm trong JSON nên không bị giới hạn.
--
-- Làm gì: đổi kiểu 7 cột đơn giá sang numeric(22,6) — chỉ NỚI (phần nguyên 16 chữ số, cũ 12–16) nên không làm
-- tròn / mất số đang có. Cột nào đã ≥ 6 số lẻ thì bỏ qua (chạy lại không lỗi). Không có view nào dựa trên các cột
-- này (rà 2026-11-04). Không đổi RLS, không đổi dữ liệu.
--   material_imports.unit_price · balancing_inputs.unit_price · balancing_outputs.unit_price · sales_items.unit_price
--   · domestic_sales.unit_price · monthly_stock_ledger.unit_price · scraps.selling_price
-- ROLLBACK cuối file.
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name) in (
        ('material_imports', 'unit_price'),
        ('balancing_inputs', 'unit_price'),
        ('balancing_outputs', 'unit_price'),
        ('sales_items', 'unit_price'),
        ('domestic_sales', 'unit_price'),
        ('monthly_stock_ledger', 'unit_price'),
        ('scraps', 'selling_price'))
      and data_type = 'numeric'
      and coalesce(numeric_scale, 0) < 6
      and numeric_precision is not null
  loop
    execute format('alter table public.%I alter column %I type numeric(22,6)', c.table_name, c.column_name);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- KIỂM (chỉ đọc) — 7 dòng, numeric_scale = 6:
--   select table_name, column_name, numeric_precision, numeric_scale from information_schema.columns
--   where table_schema = 'public' and column_name in ('unit_price', 'selling_price')
--     and table_name in ('material_imports','balancing_inputs','balancing_outputs','sales_items','domestic_sales','monthly_stock_ledger','scraps');

-- ============================================================
-- ROLLBACK (làm tròn đơn giá về 2 số lẻ — MẤT phần lẻ thứ 3–6 đã ghi; chỉ chạy khi chắc chắn):
--   alter table public.material_imports     alter column unit_price    type numeric(14,2);
--   alter table public.balancing_inputs     alter column unit_price    type numeric(14,2);
--   alter table public.balancing_outputs    alter column unit_price    type numeric(14,2);
--   alter table public.sales_items          alter column unit_price    type numeric(14,2);
--   alter table public.domestic_sales       alter column unit_price    type numeric(14,2);
--   alter table public.monthly_stock_ledger alter column unit_price    type numeric(18,2);
--   alter table public.scraps               alter column selling_price type numeric(14,2);
-- ============================================================
