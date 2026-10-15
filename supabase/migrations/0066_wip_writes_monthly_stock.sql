-- ============================================================
-- Baseafood MES — 0066: /wip được ghi Sổ kho tháng (hàng đông lạnh → nhóm "Hàng tạm")
--
-- Vì sao (chốt với người dùng 2026-10-15): tổ xưởng ghi HÀNG ĐÔNG LẠNH (sơ chế cấp đông,
-- dạng nguyên liệu — 2 DA <80GR, BAO TỬ 2DA…) ở /wip; Lưu vào sổ ⇒ mỗi dòng thành một lô
-- nhập nhóm "Hàng tạm" của monthly_stock_ledger (lib/frozenStockLines.ts). Người ghi /wip
-- (tổ trưởng, quản đốc) không có quyền "monthly-stock" ⇒ luật bảng monthly_stock_ledger
-- thêm tài nguyên 'wip' — y như Cân đối đã ghi 2 dòng kho ('balancing'). Cùng thay đổi ở
-- app: TABLE_WRITE_RULES.monthly_stock_ledger (lib/writePermissions.ts); test
-- writePermissionsSql.test.ts bắt lệch.
--
-- Chỉ thay HÀM required_write_permissions (bản 0065 + một nhánh). Không đổi bảng, policy,
-- dữ liệu, công tắc chế độ chốt quyền (log/enforce). Mức độ 🟡 (nới một quyền; mode 'log' không chặn ai).
-- Idempotent (create or replace). ROLLBACK: chạy lại đúng khối hàm trong 0065.
-- ============================================================

create or replace function public.required_write_permissions(p_table text, p_kind text, p_old jsonb, p_new jsonb)
returns table (resource text, action text) language plpgsql immutable as $$
declare
  v_was boolean := coalesce((p_old->>'is_locked')::boolean, false);
  v_is boolean := coalesce((p_new->>'is_locked')::boolean, false);
  v_lock text := case
    when p_kind = 'delete' or (v_was and not v_is) then 'unlock'
    when v_is and not v_was then 'lock'
    else p_kind end;
  v_approve boolean := p_kind = 'update'
    and coalesce(p_old->>'status', '') is distinct from coalesce(p_new->>'status', '')
    and p_new->>'status' = 'stocked';
begin
  case p_table
    when 'import_shipments' then return query values ('imports', p_kind);
    when 'material_imports' then
      if p_kind = 'delete' then return query values ('imports', 'update'), ('balancing', 'delete');
      else return query values ('imports', p_kind), ('balancing', p_kind); end if;
    when 'daily_locks' then return query values ('imports', v_lock);
    when 'scraps' then return query values ('imports', p_kind), ('balancing', p_kind);
    when 'production_wips' then
      return query values ('wip', p_kind), ('balancing', p_kind), ('warehouse', case when v_approve then 'approve' else 'update' end);
    when 'production_locks' then return query values ('wip', v_lock);
    when 'domestic_sales' then return query values ('wip', p_kind);
    when 'packagings' then return query values ('packaging', p_kind);
    when 'qc_checklists' then return query values ('qc', p_kind);
    when 'qc_locks' then return query values ('qc', v_lock);
    when 'lot_inputs' then return query values ('wip', p_kind), ('packaging', p_kind), ('qr', p_kind);
    when 'lot_waivers' then return query values ('wip', p_kind), ('qr', p_kind);
    when 'lot_dispatches' then return query values ('orders', p_kind), ('sales', p_kind), ('wip', p_kind), ('qr', p_kind);
    when 'label_prints' then
      return query values ('qr', p_kind), ('imports', p_kind), ('wip', p_kind), ('packaging', p_kind), ('sales', p_kind), ('orders', p_kind);
    when 'sales_invoices' then return query values ('sales', p_kind), ('orders', p_kind);
    when 'sales_items' then return query values ('sales', p_kind), ('orders', p_kind);
    when 'sales_orders' then return query values ('orders', p_kind);
    when 'order_items' then return query values ('orders', p_kind);
    when 'export_orders' then return query values ('orders', p_kind);
    when 'export_items' then return query values ('orders', p_kind);
    when 'balancing_periods' then
      if p_kind = 'update' and v_was is distinct from v_is then
        return query values ('balancing', case when v_is then 'lock' else 'unlock' end);
      else return query values ('balancing', p_kind); end if;
    when 'balancing_inputs' then return query values ('balancing', p_kind);
    when 'balancing_outputs' then return query values ('balancing', p_kind);
    -- 'wip': hàng đông lạnh ghi ở /wip ⇒ lô nhập nhóm Hàng tạm (0066).
    when 'monthly_stock_ledger' then return query values ('monthly-stock', p_kind), ('balancing', p_kind), ('wip', p_kind);
    when 'reconciliation_runs' then return query values ('reconciliation', p_kind);
    when 'material_opening_stock' then return query values ('nxt-material', p_kind);
    when 'finished_goods_opening_stock' then return query values ('nxt', p_kind);
    when 'nxt_snapshots' then return query values ('nxt-warehouse', 'import');
    when 'suppliers' then return query values ('catalog.suppliers', p_kind);
    when 'customers' then return query values ('catalog.customers', p_kind);
    when 'material_types' then return query values ('catalog.material-types', p_kind);
    when 'products' then return query values ('catalog.products', p_kind);
    when 'batter_types' then return query values ('catalog.batters', p_kind);
    when 'storage_locations' then return query values ('catalog.storage-locations', p_kind);
    when 'finished_goods' then return query values ('catalog.finished-goods', 'update');
    else return;
  end case;
end;
$$;
