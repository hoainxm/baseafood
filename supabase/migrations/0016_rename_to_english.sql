-- ============================================================
-- Baseafood MES — 0016: Chuyển đổi tên bảng và cột sang Tiếng Anh
--
-- Lý do: Đồng bộ quy ước đặt tên Tiếng Anh toàn hệ thống, tăng
-- khả năng bảo trì và hỗ trợ AI codegen tốt hơn.
-- Mức độ rủi ro: 🔴 RED (Có dữ liệu). Cần chạy sao lưu trước khi dán.
-- ============================================================

-- 1. Đổi tên các bảng (nếu tồn tại)
ALTER TABLE IF EXISTS public.xi_nghiep RENAME TO sites;
ALTER TABLE IF EXISTS public.dai_ly RENAME TO suppliers;
ALTER TABLE IF EXISTS public.loai_nguyen_lieu RENAME TO material_types;
ALTER TABLE IF EXISTS public.thanh_pham RENAME TO finished_goods;
ALTER TABLE IF EXISTS public.mat_hang RENAME TO products;
ALTER TABLE IF EXISTS public.khach_hang RENAME TO customers;
ALTER TABLE IF EXISTS public.chuyen_nhap RENAME TO import_shipments;
ALTER TABLE IF EXISTS public.chot_ngay RENAME TO daily_locks;
ALTER TABLE IF EXISTS public.nhap_nguyen_lieu RENAME TO material_imports;
ALTER TABLE IF EXISTS public.ky_can_doi RENAME TO balancing_periods;
ALTER TABLE IF EXISTS public.nguyen_lieu_vao RENAME TO balancing_inputs;
ALTER TABLE IF EXISTS public.phe_lieu RENAME TO scraps;
ALTER TABLE IF EXISTS public.thanh_pham_ra RENAME TO balancing_outputs;
ALTER TABLE IF EXISTS public.nguoi_dung RENAME TO user_profiles;
ALTER TABLE IF EXISTS public.phieu_ban RENAME TO sales_invoices;
ALTER TABLE IF EXISTS public.ban_hang RENAME TO sales_items;
ALTER TABLE IF EXISTS public.san_xuat_btp RENAME TO production_wips;
ALTER TABLE IF EXISTS public.chot_san_xuat RENAME TO production_locks;
ALTER TABLE IF EXISTS public.don_dat RENAME TO sales_orders;
ALTER TABLE IF EXISTS public.dong_don RENAME TO order_items;
ALTER TABLE IF EXISTS public.lenh_xuat RENAME TO export_orders;
ALTER TABLE IF EXISTS public.dong_lenh RENAME TO export_items;

-- 2. Đổi tên cột — do-block idempotent (Postgres KHÔNG hỗ trợ
--    "RENAME COLUMN IF EXISTS"). Chỉ đổi khi cột cũ CÒN và cột mới CHƯA có →
--    chạy lại nhiều lần an toàn.
do $$
declare r record;
begin
  for r in select * from (values
      ('sites','ten','name'),
      ('suppliers','xi_nghiep_id','site_id'),
      ('suppliers','ma','code'),
      ('suppliers','ten','short_name'),
      ('suppliers','dien_thoai','phone'),
      ('suppliers','ghi_chu','note'),
      ('suppliers','ten_ghi_phieu','billing_name'),
      ('suppliers','dia_chi','address'),
      ('suppliers','cmnd','national_id'),
      ('suppliers','ngay_cap','issued_date'),
      ('suppliers','noi_cap','issued_place'),
      ('material_types','xi_nghiep_id','site_id'),
      ('material_types','ten','name'),
      ('material_types','loai','category'),
      ('material_types','ghi_chu','note'),
      ('finished_goods','xi_nghiep_id','site_id'),
      ('finished_goods','ma','code'),
      ('finished_goods','ten','name'),
      ('finished_goods','dvt','unit'),
      ('finished_goods','ma_tai_khoan','account_code'),
      ('finished_goods','nhom','group_name'),
      ('products','xi_nghiep_id','site_id'),
      ('products','ma','code'),
      ('products','ten','name'),
      ('products','ma_thanh_pham','finished_good_code'),
      ('products','loai','category'),
      ('products','loai_nguyen_lieu_id','material_type_id'),
      ('customers','xi_nghiep_id','site_id'),
      ('customers','ma','code'),
      ('customers','ten','name'),
      ('customers','thi_truong','market'),
      ('import_shipments','xi_nghiep_id','site_id'),
      ('import_shipments','ngay_giao','delivery_date'),
      ('import_shipments','ngay_ghi_so','posting_date'),
      ('import_shipments','ly_do_ghi_bu','backdate_reason'),
      ('import_shipments','phan_xuong','workshop'),
      ('import_shipments','ten_dai_ly','supplier_name'),
      ('import_shipments','tai_xe','driver_name'),
      ('import_shipments','bien_so_xe','license_plate'),
      ('import_shipments','ghi_chu','note'),
      ('daily_locks','xi_nghiep_id','site_id'),
      ('daily_locks','ngay','lock_date'),
      ('daily_locks','phan_xuong','workshop'),
      ('daily_locks','da_chot','is_locked'),
      ('daily_locks','chot_luc','locked_at'),
      ('daily_locks','tong_kg_luc_chot','total_kg_at_lock'),
      ('daily_locks','ly_do_mo_lai','reopen_reason'),
      ('daily_locks','ghi_chu','note'),
      ('material_imports','xi_nghiep_id','site_id'),
      ('material_imports','chuyen_id','shipment_id'),
      ('material_imports','ngay','delivery_date'),
      ('material_imports','phan_xuong','workshop'),
      ('material_imports','loai','category'),
      ('material_imports','ten_dai_ly','supplier_name'),
      ('material_imports','ten_loai_nguyen_lieu','material_type_name'),
      ('material_imports','so_luong_kg','quantity_kg'),
      ('material_imports','don_gia','unit_price'),
      ('material_imports','tai_xe','driver_name'),
      ('material_imports','bien_so_xe','license_plate'),
      ('material_imports','ghi_chu','note'),
      ('balancing_periods','xi_nghiep_id','site_id'),
      ('balancing_periods','ten_loai_nguyen_lieu','material_type_name'),
      ('balancing_periods','mo_ta_ngay','date_range_description'),
      ('balancing_periods','tu_ngay','start_date'),
      ('balancing_periods','den_ngay','end_date'),
      ('balancing_periods','tong_nl_nhan_kg','total_input_kg'),
      ('balancing_periods','ti_gia','exchange_rate'),
      ('balancing_periods','chi_phi_che_bien','processing_cost_per_kg'),
      ('balancing_inputs','xi_nghiep_id','site_id'),
      ('balancing_inputs','ky_id','period_id'),
      ('balancing_inputs','nhom','group_name'),
      ('balancing_inputs','ten','name'),
      ('balancing_inputs','so_luong_kg','quantity_kg'),
      ('balancing_inputs','don_gia','unit_price'),
      ('balancing_inputs','ty_le_phan_tram','ratio_percentage'),
      ('balancing_inputs','nguon_kho','source_warehouse'),
      ('scraps','xi_nghiep_id','site_id'),
      ('scraps','ky_id','period_id'),
      ('scraps','loai','name'),
      ('scraps','so_luong_kg','quantity_kg'),
      ('scraps','don_gia_ban','selling_price'),
      ('scraps','ngay','date'),
      ('scraps','phan_xuong','workshop'),
      ('scraps','nguon','source'),
      ('balancing_outputs','xi_nghiep_id','site_id'),
      ('balancing_outputs','ky_id','period_id'),
      ('balancing_outputs','mat_hang_id','product_id'),
      ('balancing_outputs','khach_hang_id','customer_id'),
      ('balancing_outputs','kenh','channel'),
      ('balancing_outputs','luong_kg','quantity_kg'),
      ('balancing_outputs','don_gia','unit_price'),
      ('balancing_outputs','quy_cach','spec'),
      ('balancing_outputs','ban_hang_id','sales_item_id'),
      ('user_profiles','xi_nghiep_id','site_id'),
      ('user_profiles','ho_ten','full_name'),
      ('user_profiles','username','username'),
      ('user_profiles','vai_tro','roles'),
      ('sales_invoices','xi_nghiep_id','site_id'),
      ('sales_invoices','ngay_giao','delivery_date'),
      ('sales_invoices','ngay_ghi_so','posting_date'),
      ('sales_invoices','ly_do_ghi_bu','backdate_reason'),
      ('sales_invoices','phan_xuong','workshop'),
      ('sales_invoices','khach_hang_id','customer_id'),
      ('sales_invoices','kenh','channel'),
      ('sales_invoices','ghi_chu','note'),
      ('sales_items','xi_nghiep_id','site_id'),
      ('sales_items','phieu_id','invoice_id'),
      ('sales_items','ngay','delivery_date'),
      ('sales_items','mat_hang_id','product_id'),
      ('sales_items','quy_cach','spec'),
      ('sales_items','luong_kg','quantity_kg'),
      ('sales_items','don_gia','unit_price'),
      ('sales_items','kho_nguon','source_warehouse'),
      ('production_wips','xi_nghiep_id','site_id'),
      ('production_wips','ngay','production_date'),
      ('production_wips','ngay_ghi_so','posting_date'),
      ('production_wips','ly_do_ghi_bu','backdate_reason'),
      ('production_wips','phan_xuong','workshop'),
      ('production_wips','mat_hang_id','product_id'),
      ('production_wips','quy_cach','spec'),
      ('production_wips','luong_kg','quantity_kg'),
      ('production_wips','so_block','blocks_count'),
      ('production_wips','kho','warehouse'),
      ('production_wips','trang_thai','status'),
      ('production_wips','ghi_chu','note'),
      ('production_locks','xi_nghiep_id','site_id'),
      ('production_locks','ngay','lock_date'),
      ('production_locks','phan_xuong','workshop'),
      ('production_locks','da_chot','is_locked'),
      ('production_locks','chot_luc','locked_at'),
      ('production_locks','tong_kg_luc_chot','total_kg_at_lock'),
      ('production_locks','ly_do_mo_lai','reopen_reason'),
      ('production_locks','ghi_chu','note'),
      ('sales_orders','xi_nghiep_id','site_id'),
      ('sales_orders','khach_id','customer_id'),
      ('sales_orders','ngay_dat','order_date'),
      ('sales_orders','trang_thai','status'),
      ('sales_orders','ghi_chu','note'),
      ('order_items','xi_nghiep_id','site_id'),
      ('order_items','don_id','order_id'),
      ('order_items','mat_hang_id','product_id'),
      ('order_items','quy_cach','spec'),
      ('order_items','luong_kg_can','required_quantity_kg'),
      ('order_items','so_block_can','required_blocks_count'),
      ('export_orders','xi_nghiep_id','site_id'),
      ('export_orders','don_id','order_id'),
      ('export_orders','ngay','export_date'),
      ('export_orders','trang_thai','status'),
      ('export_orders','ghi_chu','note'),
      ('export_items','xi_nghiep_id','site_id'),
      ('export_items','lenh_id','export_id'),
      ('export_items','san_xuat_id','wip_id'),
      ('export_items','mat_hang_id','product_id'),
      ('export_items','quy_cach','spec'),
      ('export_items','luong_kg','quantity_kg'),
      ('export_items','so_block','blocks_count')
  ) as v(tbl, old_name, new_name)
  loop
    if exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name=r.tbl and column_name=r.old_name
       ) and not exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name=r.tbl and column_name=r.new_name
       )
    then
      execute format('alter table public.%I rename column %I to %I', r.tbl, r.old_name, r.new_name);
    end if;
  end loop;
end $$;

-- Bỏ ràng buộc check vai trò cũ (nếu còn)
alter table public.user_profiles drop constraint if exists nguoi_dung_vai_tro_check;
-- 3. Cập nhật các Triggers (Đổi sang tên Tiếng Anh)
do $$
declare
  t text;
  old_trigger text;
  new_trigger text;
begin
  foreach t in array array[
    'sites','suppliers','material_types','finished_goods','products','customers',
    'import_shipments','daily_locks','material_imports','balancing_periods',
    'balancing_inputs','scraps','balancing_outputs','user_profiles',
    'sales_invoices','sales_items','production_wips','production_locks',
    'sales_orders','order_items','export_orders','export_items'
  ] loop
    -- Lấy tên trigger cũ (Postgres tự động giữ trigger nhưng map vào table mới)
    -- Chúng ta drop trigger cũ dựa trên tên cũ và tạo trigger mới có tên Tiếng Anh.
    -- Tên trigger cũ thường là <old_table_name>_sua
    old_trigger := case t
      when 'sites' then 'xi_nghiep_sua'
      when 'suppliers' then 'dai_ly_sua'
      when 'material_types' then 'loai_nguyen_lieu_sua'
      when 'finished_goods' then 'thanh_pham_sua'
      when 'products' then 'mat_hang_sua'
      when 'customers' then 'khach_hang_sua'
      when 'import_shipments' then 'chuyen_nhap_sua'
      when 'daily_locks' then 'chot_ngay_sua'
      when 'material_imports' then 'nhap_nguyen_lieu_sua'
      when 'balancing_periods' then 'ky_can_doi_sua'
      when 'balancing_inputs' then 'nguyen_lieu_vao_sua'
      when 'scraps' then 'phe_lieu_sua'
      when 'balancing_outputs' then 'thanh_pham_ra_sua'
      when 'user_profiles' then 'nguoi_dung_sua'
      when 'sales_invoices' then 'phieu_ban_sua'
      when 'sales_items' then 'ban_hang_sua'
      when 'production_wips' then 'san_xuat_btp_sua'
      when 'production_locks' then 'chot_san_xuat_sua'
      when 'sales_orders' then 'don_dat_sua'
      when 'order_items' then 'dong_don_sua'
      when 'export_orders' then 'lenh_xuat_sua'
      when 'export_items' then 'dong_lenh_sua'
    end;

    if old_trigger is not null then
      execute format('drop trigger if exists %I on public.%I', old_trigger, t);
    end if;

    new_trigger := 'before_update_' || t;
    execute format('drop trigger if exists %I on public.%I', new_trigger, t);
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.cap_nhat_thoi_diem_sua()',
      new_trigger, t
    );
  end loop;
end $$;

-- 4. Bật RLS và Cấu hình RLS Policies cho tất cả các bảng Tiếng Anh mới
do $$
declare
  t text;
  old_policy_1 text;
  old_policy_2 text;
  new_policy text;
begin
  foreach t in array array[
    'sites','suppliers','material_types','finished_goods','products','customers',
    'import_shipments','daily_locks','material_imports','balancing_periods',
    'balancing_inputs','scraps','balancing_outputs','user_profiles',
    'sales_invoices','sales_items','production_wips','production_locks',
    'sales_orders','order_items','export_orders','export_items'
  ] loop
    -- Kích hoạt RLS
    execute format('alter table public.%I enable row level security', t);

    -- Dọn dẹp policy cũ (nếu có)
    old_policy_1 := case t
      when 'sites' then 'xi_nghiep_doc'
      when 'suppliers' then 'dai_ly_nguoi_dung'
      when 'material_types' then 'loai_nguyen_lieu_nguoi_dung'
      when 'finished_goods' then 'thanh_pham_nguoi_dung'
      when 'products' then 'mat_hang_nguoi_dung'
      when 'customers' then 'khach_hang_nguoi_dung'
      when 'import_shipments' then 'chuyen_nhap_nguoi_dung'
      when 'daily_locks' then 'chot_ngay_nguoi_dung'
      when 'material_imports' then 'nhap_nguyen_lieu_nguoi_dung'
      when 'balancing_periods' then 'ky_can_doi_nguoi_dung'
      when 'balancing_inputs' then 'nguyen_lieu_vao_nguoi_dung'
      when 'scraps' then 'phe_lieu_nguoi_dung'
      when 'balancing_outputs' then 'thanh_pham_ra_nguoi_dung'
      when 'user_profiles' then 'nguoi_dung_toan_quyen'
      when 'sales_invoices' then 'phieu_ban_nguoi_dung'
      when 'sales_items' then 'ban_hang_nguoi_dung'
      when 'production_wips' then 'san_xuat_btp_nguoi_dung'
      when 'production_locks' then 'chot_san_xuat_nguoi_dung'
      when 'sales_orders' then 'don_dat_nguoi_dung'
      when 'order_items' then 'dong_don_nguoi_dung'
      when 'export_orders' then 'lenh_xuat_nguoi_dung'
      when 'export_items' then 'dong_lenh_nguoi_dung'
    end;

    if old_policy_1 is not null then
      execute format('drop policy if exists %I on public.%I', old_policy_1, t);
    end if;

    -- Cũng dọn luôn các policy "_toan_quyen" cũ của các file migration 0001/0005/0011
    old_policy_2 := case t
      when 'sites' then 'xi_nghiep_toan_quyen'
      when 'suppliers' then 'dai_ly_toan_quyen'
      when 'material_types' then 'loai_nguyen_lieu_toan_quyen'
      when 'finished_goods' then 'thanh_pham_toan_quyen'
      when 'products' then 'mat_hang_toan_quyen'
      when 'customers' then 'khach_hang_toan_quyen'
      when 'import_shipments' then 'chuyen_nhap_toan_quyen'
      when 'daily_locks' then 'chot_ngay_toan_quyen'
      when 'material_imports' then 'nhap_nguyen_lieu_toan_quyen'
      when 'balancing_periods' then 'ky_can_doi_toan_quyen'
      when 'balancing_inputs' then 'nguyen_lieu_vao_toan_quyen'
      when 'scraps' then 'phe_lieu_toan_quyen'
      when 'balancing_outputs' then 'thanh_pham_ra_toan_quyen'
      when 'user_profiles' then 'nguoi_dung_nguoi_dung'
      when 'sales_invoices' then 'phieu_ban_toan_quyen'
      when 'sales_items' then 'ban_hang_toan_quyen'
      when 'production_wips' then 'san_xuat_btp_toan_quyen'
      when 'production_locks' then 'chot_san_xuat_toan_quyen'
      when 'sales_orders' then 'don_dat_toan_quyen'
      when 'order_items' then 'dong_don_toan_quyen'
      when 'export_orders' then 'lenh_xuat_toan_quyen'
      when 'export_items' then 'dong_lenh_toan_quyen'
    end;

    if old_policy_2 is not null then
      execute format('drop policy if exists %I on public.%I', old_policy_2, t);
    end if;

    -- Tạo policy mới Tiếng Anh
    new_policy := t || '_authenticated_policy';
    execute format('drop policy if exists %I on public.%I', new_policy, t);

    if t = 'sites' then
      -- Sites chỉ cho phép ĐỌC đối với người đã đăng nhập
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        new_policy, t
      );
    else
      -- Các bảng khác cho phép toàn quyền đối với người đã đăng nhập
      execute format(
        'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) is not null)
         with check ((select auth.uid()) is not null)',
        new_policy, t
      );
    end if;

    -- Thu hồi toàn bộ quyền truy cập ẩn danh (anon) để siết bảo mật
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
