-- ============================================================
-- seed_bt2da.sql — Nạp DEMO "Cân đối Bạch tuộc 2 da" (kỳ 21-25/07) lên Supabase
-- ------------------------------------------------------------
-- CHẠY: Supabase Dashboard → SQL Editor → dán file này → Run.
--
-- ⚠️ TIÊN QUYẾT: đã chạy migration 0018 (cho phép NL vào ÂM). Chưa chạy ⇒ dòng
--    'Bán nội địa -987' báo lỗi 23514 check constraint. Chạy 0018 trước rồi seed.
--
-- ⚠️ TRƯỚC KHI CHẠY: thay TẤT CẢ '__SITE_ID__' bằng giá trị VITE_SITE_ID trong .env
--    của hệ :5173. Nếu VITE_SITE_ID để trống ⇒ dùng 'site-default'.
--    (Ctrl+H trong SQL editor: __SITE_ID__  →  site-default)
--
-- Idempotent: xoá mọi dòng id LIKE 'seed-%' của site này rồi nạp lại → chạy nhiều lần vẫn đúng.
-- 2 dòng "chốt" (NL '2 da nl nhỏ' + TP '2 da luộc 230-250') CỐ Ý không nạp —
--    để nhập LIVE trên sân khấu, xem tổng leo đúng số file. Chi tiết ở kich-ban-demo-live.md.
--
-- GỠ DEMO: chạy khối "CLEANUP" cuối file.
-- ============================================================
BEGIN;

-- ---------- CLEANUP (xoá seed cũ, không đụng data thật) ----------
DELETE FROM balancing_outputs WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM balancing_inputs  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM scraps            WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM balancing_periods WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM material_imports  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM import_shipments  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM products          WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM customers         WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
DELETE FROM suppliers         WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';


-- ---------- Khách hàng ----------
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-1','','Seachemot','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-2','','Lucky','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-3','','Peacock','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-4','','Hanwa','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-5','','Matsuda','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-6','','Hatchando','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-7','','JFDA','Xuất khẩu','__SITE_ID__');
INSERT INTO customers (id,code,name,market,site_id) VALUES ('seed-cust-8','','Dairei','Xuất khẩu','__SITE_ID__');

-- ---------- Đại lý ----------
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-1','','Bê 3','','Đại lý bạch tuộc 2 da','Bê 3','','','','','__SITE_ID__');
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-2','','Hồng Phú','','Đại lý bạch tuộc 2 da','Hồng Phú','','','','','__SITE_ID__');
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-3','','H Mũng','','Đại lý bạch tuộc 2 da','H Mũng','','','','','__SITE_ID__');
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-4','','Pháp M Né','','Đại lý bạch tuộc 2 da','Pháp M Né','','','','','__SITE_ID__');
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-5','','Hưng V Tàu','','Đại lý bạch tuộc 2 da','Hưng V Tàu','','','','','__SITE_ID__');
INSERT INTO suppliers (id,code,short_name,phone,note,billing_name,address,national_id,issued_date,issued_place,site_id) VALUES ('seed-sup-6','','Mậu H Tân','','Đại lý bạch tuộc 2 da','Mậu H Tân','','','','','__SITE_ID__');

-- ---------- Mặt hàng (21 quy cách 2 da) ----------
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-1','','2 rầu cắt luộc 16-20','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-2','','2 da cắt chần 1 - 2','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-3','','2 da cắt chần 4 - 5','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-4','','2 da cắt chần 5 - 6','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-5','','2 da cắt chần 380 - 420','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-6','','2 da cắt chần 455 - 555','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-7','','2 da cắt chần 700 - 750','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-8','','2 da luộc 230-250','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-9','','2 da luộc 370 - 420','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-10','','2 da luộc 300-330','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-11','','2 da luộc 600 - 900','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-12','','2 da luộc 1000 - 1300','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-13','','2 da luộc 1.5g','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-14','','2 da luộc 2g','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-15','','2 da luộc 3g','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-16','','2 da luộc 5,5g','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-17','','2 da luộc 4 - 5 1''','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-18','','2 da tẩm bột nước tương','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-19','','2 da tẩm bột 9 - 12','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-20','','2 da luộc màu','','Bạch tuộc','__SITE_ID__');
INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES ('seed-prod-21','','2 da ncls','','Bạch tuộc','__SITE_ID__');

-- ---------- Kỳ cân đối ----------
INSERT INTO balancing_periods (id,material_type_name,date_range_description,start_date,end_date,total_input_kg,exchange_rate,processing_cost_per_kg,created_at,site_id) VALUES ('seed-ky-bt2da','Bạch tuộc 2 da','21/07/2025 – 25/07/2025','2025-07-21','2025-07-25',63926,26000,30000,'2025-07-26T02:00:00.000Z','__SITE_ID__');

-- ---------- Khối 1: Nguyên liệu vào (giữ lại 1 dòng chốt) ----------
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-1','seed-ky-bt2da','Thủy sản','Bán nội địa',-987,145000,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-2','seed-ky-bt2da','Xả đông','x.đ Cò May',13584,157000,NULL,'Mua về','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-3','seed-ky-bt2da','Xả đông','x.đ Tả',5100,157000,NULL,'Mua về','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-4','seed-ky-bt2da','Xả đông','x.đ 2 da lớn',3984,149000,NULL,'Mua về','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-5','seed-ky-bt2da','Thủy sản','2 da nl lớn',23150,145000,NULL,'','__SITE_ID__');
-- [GIỮ LẠI — nhập LIVE] INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-6','seed-ky-bt2da','Thủy sản','2 da nl nhỏ',16356,137737,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-7','seed-ky-bt2da','Bột phụ gia','Bột 24v',245,50428,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-8','seed-ky-bt2da','Bột phụ gia','Bột 18v',1481,52497,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-9','seed-ky-bt2da','Bột phụ gia','Bột 27102',670,48540,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-10','seed-ky-bt2da','Bột phụ gia','Bột 22601',155,53000,NULL,'','__SITE_ID__');
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,site_id) VALUES ('seed-in-11','seed-ky-bt2da','Bột phụ gia','Bột 2204',188.3,89340,NULL,'','__SITE_ID__');

-- ---------- Khối 3: Bán thành phẩm ra (giữ lại 1 dòng chốt) ----------
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-1','seed-ky-bt2da','seed-prod-1','seed-cust-1','Xuất khẩu',1083,10.81,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-2','seed-ky-bt2da','seed-prod-2','seed-cust-1','Xuất khẩu',93,9.65,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-3','seed-ky-bt2da','seed-prod-3','seed-cust-2','Xuất khẩu',6,10.9,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-4','seed-ky-bt2da','seed-prod-4','seed-cust-1','Xuất khẩu',2399,10.75,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-5','seed-ky-bt2da','seed-prod-5','seed-cust-1','Xuất khẩu',56,10.51,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-6','seed-ky-bt2da','seed-prod-6','seed-cust-3','Xuất khẩu',1815,8.56,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-7','seed-ky-bt2da','seed-prod-7','seed-cust-3','Xuất khẩu',7521,8.51,'','','__SITE_ID__');
-- [GIỮ LẠI — nhập LIVE] INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-8','seed-ky-bt2da','seed-prod-8','seed-cust-4','Xuất khẩu',11591,10.43,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-9','seed-ky-bt2da','seed-prod-9','seed-cust-5','Xuất khẩu',12,11.4,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-10','seed-ky-bt2da','seed-prod-10','seed-cust-4','Xuất khẩu',1369,10.23,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-11','seed-ky-bt2da','seed-prod-11','seed-cust-1','Xuất khẩu',558,10.06,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-12','seed-ky-bt2da','seed-prod-12','seed-cust-1','Xuất khẩu',380,10.06,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-13','seed-ky-bt2da','seed-prod-13','seed-cust-6','Xuất khẩu',1890,10.67,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-14','seed-ky-bt2da','seed-prod-14','seed-cust-6','Xuất khẩu',538,10.87,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-15','seed-ky-bt2da','seed-prod-15','seed-cust-6','Xuất khẩu',70,11.02,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-16','seed-ky-bt2da','seed-prod-16','seed-cust-1','Xuất khẩu',325,10.75,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-17','seed-ky-bt2da','seed-prod-17','seed-cust-1','Xuất khẩu',169,11.1,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-18','seed-ky-bt2da','seed-prod-18','seed-cust-7','Xuất khẩu',5119,9.3,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-19','seed-ky-bt2da','seed-prod-18','seed-cust-8','Xuất khẩu',2000,9.2,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-20','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1411,7.95,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-21','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1000,9.2,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-22','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',1260,9.75,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-23','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',261,8.55,'','','__SITE_ID__');
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,site_id) VALUES ('seed-out-24','seed-ky-bt2da','seed-prod-21','','Xuất khẩu',2218,6.55,'','','__SITE_ID__');

-- ---------- Khối 2: Phế liệu (1 dòng) ----------
INSERT INTO scraps (id,period_id,name,quantity_kg,selling_price,date,workshop,source,site_id) VALUES ('seed-scrap-1','seed-ky-bt2da','Nội tạng bạch tuộc',820,9000,'2025-07-23','Đông','Cân đối','__SITE_ID__');

-- ---------- Nhập nguyên liệu: 2 chuyến (ngày = hôm demo) ----------
INSERT INTO import_shipments (id,delivery_date,posting_date,backdate_reason,workshop,supplier_name,driver_name,license_plate,note,site_id) VALUES ('seed-sh-1',CURRENT_DATE,CURRENT_DATE,'','Đông','Bê 3','','','Demo — đại lý Bê 3','__SITE_ID__');
INSERT INTO import_shipments (id,delivery_date,posting_date,backdate_reason,workshop,supplier_name,driver_name,license_plate,note,site_id) VALUES ('seed-sh-2',CURRENT_DATE,CURRENT_DATE,'','Đông','Hồng Phú','','','Demo — đại lý Hồng Phú','__SITE_ID__');
INSERT INTO material_imports (id,shipment_id,delivery_date,workshop,category,supplier_name,material_type_name,quantity_kg,unit_price,driver_name,license_plate,note,site_id) VALUES ('seed-imp-1','seed-sh-1',CURRENT_DATE,'Đông','Bạch tuộc','Bê 3','2 da nguyên liệu',5298,145000,'','','','__SITE_ID__');
INSERT INTO material_imports (id,shipment_id,delivery_date,workshop,category,supplier_name,material_type_name,quantity_kg,unit_price,driver_name,license_plate,note,site_id) VALUES ('seed-imp-2','seed-sh-1',CURRENT_DATE,'Đông','Bạch tuộc','Bê 3','1 da nguyên liệu',1391,130000,'','','','__SITE_ID__');
INSERT INTO material_imports (id,shipment_id,delivery_date,workshop,category,supplier_name,material_type_name,quantity_kg,unit_price,driver_name,license_plate,note,site_id) VALUES ('seed-imp-3','seed-sh-2',CURRENT_DATE,'Đông','Bạch tuộc','Hồng Phú','2 da nguyên liệu',5173,145000,'','','','__SITE_ID__');
INSERT INTO material_imports (id,shipment_id,delivery_date,workshop,category,supplier_name,material_type_name,quantity_kg,unit_price,driver_name,license_plate,note,site_id) VALUES ('seed-imp-4','seed-sh-2',CURRENT_DATE,'Đông','Bạch tuộc','Hồng Phú','1 da nguyên liệu',1320,130000,'','','','__SITE_ID__');

COMMIT;


-- ============================================================
-- CLEANUP — GỠ TOÀN BỘ DEMO (chạy riêng khi xong)
-- ============================================================
-- BEGIN;
-- DELETE FROM balancing_outputs WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM balancing_inputs  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM scraps            WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM balancing_periods WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM material_imports  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM import_shipments  WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM products          WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM customers         WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- DELETE FROM suppliers         WHERE site_id='__SITE_ID__' AND id LIKE 'seed-%';
-- COMMIT;
