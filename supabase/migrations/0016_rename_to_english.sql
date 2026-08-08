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

-- 2. Đổi tên cột trong các bảng
-- sites
ALTER TABLE public.sites RENAME COLUMN IF EXISTS ten TO name;

-- suppliers
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS ma TO code;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS ten TO short_name;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS dien_thoai TO phone;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS ghi_chu TO note;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS ten_ghi_phieu TO billing_name;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS dia_chi TO address;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS cmnd TO national_id;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS ngay_cap TO issued_date;
ALTER TABLE public.suppliers RENAME COLUMN IF EXISTS noi_cap TO issued_place;

-- material_types
ALTER TABLE public.material_types RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.material_types RENAME COLUMN IF EXISTS ten TO name;
ALTER TABLE public.material_types RENAME COLUMN IF EXISTS loai TO category;
ALTER TABLE public.material_types RENAME COLUMN IF EXISTS ghi_chu TO note;

-- finished_goods
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS ma TO code;
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS ten TO name;
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS dvt TO unit;
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS ma_tai_khoan TO account_code;
ALTER TABLE public.finished_goods RENAME COLUMN IF EXISTS nhom TO group_name;

-- products
ALTER TABLE public.products RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.products RENAME COLUMN IF EXISTS ma TO code;
ALTER TABLE public.products RENAME COLUMN IF EXISTS ten TO name;
ALTER TABLE public.products RENAME COLUMN IF EXISTS ma_thanh_pham TO finished_good_code;
ALTER TABLE public.products RENAME COLUMN IF EXISTS loai TO category;
ALTER TABLE public.products RENAME COLUMN IF EXISTS loai_nguyen_lieu_id TO material_type_id;

-- customers
ALTER TABLE public.customers RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.customers RENAME COLUMN IF EXISTS ma TO code;
ALTER TABLE public.customers RENAME COLUMN IF EXISTS ten TO name;
ALTER TABLE public.customers RENAME COLUMN IF EXISTS thi_truong TO market;

-- import_shipments
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS ngay_giao TO delivery_date;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS ngay_ghi_so TO posting_date;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS ly_do_ghi_bu TO backdate_reason;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS ten_dai_ly TO supplier_name;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS tai_xe TO driver_name;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS bien_so_xe TO license_plate;
ALTER TABLE public.import_shipments RENAME COLUMN IF EXISTS ghi_chu TO note;

-- daily_locks
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS ngay TO lock_date;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS da_chot TO is_locked;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS chot_luc TO locked_at;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS tong_kg_luc_chot TO total_kg_at_lock;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS ly_do_mo_lai TO reopen_reason;
ALTER TABLE public.daily_locks RENAME COLUMN IF EXISTS ghi_chu TO note;

-- material_imports
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS chuyen_id TO shipment_id;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS ngay TO delivery_date;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS loai TO category;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS ten_dai_ly TO supplier_name;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS ten_loai_nguyen_lieu TO material_type_name;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS so_luong_kg TO quantity_kg;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS don_gia TO unit_price;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS tai_xe TO driver_name;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS bien_so_xe TO license_plate;
ALTER TABLE public.material_imports RENAME COLUMN IF EXISTS ghi_chu TO note;

-- balancing_periods
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS ten_loai_nguyen_lieu TO material_type_name;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS mo_ta_ngay TO date_range_description;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS tu_ngay TO start_date;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS den_ngay TO end_date;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS tong_nl_nhan_kg TO total_input_kg;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS ti_gia TO exchange_rate;
ALTER TABLE public.balancing_periods RENAME COLUMN IF EXISTS chi_phi_che_bien TO processing_cost_per_kg;

-- balancing_inputs
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS ky_id TO period_id;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS nhom TO group_name;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS ten TO name;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS so_luong_kg TO quantity_kg;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS don_gia TO unit_price;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS ty_le_phan_tram TO ratio_percentage;
ALTER TABLE public.balancing_inputs RENAME COLUMN IF EXISTS nguon_kho TO source_warehouse;

-- scraps
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS ky_id TO period_id;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS loai TO name;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS so_luong_kg TO quantity_kg;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS don_gia_ban TO selling_price;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS ngay TO date;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.scraps RENAME COLUMN IF EXISTS nguon TO source;

-- balancing_outputs
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS ky_id TO period_id;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS mat_hang_id TO product_id;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS khach_hang_id TO customer_id;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS kenh TO channel;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS luong_kg TO quantity_kg;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS don_gia TO unit_price;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS quy_cach TO spec;
ALTER TABLE public.balancing_outputs RENAME COLUMN IF EXISTS ban_hang_id TO sales_item_id;

-- user_profiles
ALTER TABLE public.user_profiles RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.user_profiles RENAME COLUMN IF EXISTS ho_ten TO full_name;
ALTER TABLE public.user_profiles RENAME COLUMN IF EXISTS username TO username;
ALTER TABLE public.user_profiles RENAME COLUMN IF EXISTS vai_tro TO roles;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check;

-- sales_invoices
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS ngay_giao TO delivery_date;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS ngay_ghi_so TO posting_date;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS ly_do_ghi_bu TO backdate_reason;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS khach_hang_id TO customer_id;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS kenh TO channel;
ALTER TABLE public.sales_invoices RENAME COLUMN IF EXISTS ghi_chu TO note;

-- sales_items
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS phieu_id TO invoice_id;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS ngay TO delivery_date;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS mat_hang_id TO product_id;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS quy_cach TO spec;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS luong_kg TO quantity_kg;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS don_gia TO unit_price;
ALTER TABLE public.sales_items RENAME COLUMN IF EXISTS kho_nguon TO source_warehouse;

-- production_wips
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS ngay TO production_date;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS ngay_ghi_so TO posting_date;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS ly_do_ghi_bu TO backdate_reason;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS mat_hang_id TO product_id;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS quy_cach TO spec;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS luong_kg TO quantity_kg;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS so_block TO blocks_count;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS kho TO warehouse;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS trang_thai TO status;
ALTER TABLE public.production_wips RENAME COLUMN IF EXISTS ghi_chu TO note;

-- production_locks
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS ngay TO lock_date;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS phan_xuong TO workshop;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS da_chot TO is_locked;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS chot_luc TO locked_at;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS tong_kg_luc_chot TO total_kg_at_lock;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS ly_do_mo_lai TO reopen_reason;
ALTER TABLE public.production_locks RENAME COLUMN IF EXISTS ghi_chu TO note;

-- sales_orders
ALTER TABLE public.sales_orders RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.sales_orders RENAME COLUMN IF EXISTS khach_id TO customer_id;
ALTER TABLE public.sales_orders RENAME COLUMN IF EXISTS ngay_dat TO order_date;
ALTER TABLE public.sales_orders RENAME COLUMN IF EXISTS trang_thai TO status;
ALTER TABLE public.sales_orders RENAME COLUMN IF EXISTS ghi_chu TO note;

-- order_items
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS don_id TO order_id;
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS mat_hang_id TO product_id;
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS quy_cach TO spec;
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS luong_kg_can TO required_quantity_kg;
ALTER TABLE public.order_items RENAME COLUMN IF EXISTS so_block_can TO required_blocks_count;

-- export_orders
ALTER TABLE public.export_orders RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.export_orders RENAME COLUMN IF EXISTS don_id TO order_id;
ALTER TABLE public.export_orders RENAME COLUMN IF EXISTS ngay TO export_date;
ALTER TABLE public.export_orders RENAME COLUMN IF EXISTS trang_thai TO status;
ALTER TABLE public.export_orders RENAME COLUMN IF EXISTS ghi_chu TO note;

-- export_items
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS xi_nghiep_id TO site_id;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS lenh_id TO export_id;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS san_xuat_id TO wip_id;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS mat_hang_id TO product_id;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS quy_cach TO spec;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS luong_kg TO quantity_kg;
ALTER TABLE public.export_items RENAME COLUMN IF EXISTS so_block TO blocks_count;

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
