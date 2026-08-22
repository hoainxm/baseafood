-- ============================================================
-- Baseafood MES — 0023: RESET kỳ cân đối + SEED "Bạch tuộc 2 da" (21–25/07/2025)
--
-- 🔴 PHÁ HỦY: XÓA TOÀN BỘ kỳ cân đối (balancing_periods/inputs/outputs) của site
--    'bsf1' — theo yêu cầu (mọi kỳ hiện có đều là TEST). Xóa xong nạp lại DUY NHẤT
--    kỳ 21–25/07 (số thật, khớp bảng giấy: Lãi ≈ 242.346.204 đ).
--    Không đụng danh mục thật (id khác 'seed-') và material_imports.
--
-- ⚠️ QUAN TRỌNG: mỗi dòng có CẢ quantity_kg LẪN daily_quantities (dồn vào 21/07).
--    Lưới cân đối hiển thị theo daily_quantities — thiếu nó thì ô ngày TRỐNG dù
--    tổng có (bản 0023 đầu tiên thiếu cột này → chi tiết rỗng).
--
-- CHẠY: Supabase → SQL Editor → dán → Run (idempotent, chạy lại vẫn đúng 1 kỳ).
-- ⚠️ Tiên quyết: migration 0018 (NL âm) + 0019 (cột daily_quantities) đã chạy.
-- ⚠️ site_id='bsf1' phải = VITE_SITE_ID mà Vercel BUILD dùng (không thì app không hiện).
-- ============================================================
BEGIN;

-- 1. XÓA SẠCH mọi kỳ cân đối của site (test)
DELETE FROM balancing_outputs WHERE site_id='bsf1';
DELETE FROM balancing_inputs  WHERE site_id='bsf1';
DELETE FROM balancing_periods WHERE site_id='bsf1';

-- 2. Đảm bảo khách + mặt hàng cho kỳ seed (chỉ đụng id 'seed-%')
DELETE FROM customers WHERE site_id='bsf1' AND id LIKE 'seed-cust-%';
DELETE FROM products  WHERE site_id='bsf1' AND id LIKE 'seed-prod-%';

INSERT INTO customers (id,code,name,market,site_id) VALUES
 ('seed-cust-1','','Seachemot','Xuất khẩu','bsf1'),
 ('seed-cust-2','','Lucky','Xuất khẩu','bsf1'),
 ('seed-cust-3','','Peacock','Xuất khẩu','bsf1'),
 ('seed-cust-4','','Hanwa','Xuất khẩu','bsf1'),
 ('seed-cust-5','','Matsuda','Xuất khẩu','bsf1'),
 ('seed-cust-6','','Hatchando','Xuất khẩu','bsf1'),
 ('seed-cust-7','','JFDA','Xuất khẩu','bsf1'),
 ('seed-cust-8','','Dairei','Xuất khẩu','bsf1');

INSERT INTO products (id,code,name,finished_good_code,category,site_id) VALUES
 ('seed-prod-1','','2 rầu cắt luộc 16-20','','Bạch tuộc','bsf1'),
 ('seed-prod-2','','2 da cắt chần 1 - 2','','Bạch tuộc','bsf1'),
 ('seed-prod-3','','2 da cắt chần 4 - 5','','Bạch tuộc','bsf1'),
 ('seed-prod-4','','2 da cắt chần 5 - 6','','Bạch tuộc','bsf1'),
 ('seed-prod-5','','2 da cắt chần 380 - 420','','Bạch tuộc','bsf1'),
 ('seed-prod-6','','2 da cắt chần 455 - 555','','Bạch tuộc','bsf1'),
 ('seed-prod-7','','2 da cắt chần 700 - 750','','Bạch tuộc','bsf1'),
 ('seed-prod-8','','2 da luộc 230-250','','Bạch tuộc','bsf1'),
 ('seed-prod-9','','2 da luộc 370 - 420','','Bạch tuộc','bsf1'),
 ('seed-prod-10','','2 da luộc 300-330','','Bạch tuộc','bsf1'),
 ('seed-prod-11','','2 da luộc 600 - 900','','Bạch tuộc','bsf1'),
 ('seed-prod-12','','2 da luộc 1000 - 1300','','Bạch tuộc','bsf1'),
 ('seed-prod-13','','2 da luộc 1.5g','','Bạch tuộc','bsf1'),
 ('seed-prod-14','','2 da luộc 2g','','Bạch tuộc','bsf1'),
 ('seed-prod-15','','2 da luộc 3g','','Bạch tuộc','bsf1'),
 ('seed-prod-16','','2 da luộc 5,5g','','Bạch tuộc','bsf1'),
 ('seed-prod-17','','2 da luộc 4 - 5 1''','','Bạch tuộc','bsf1'),
 ('seed-prod-18','','2 da tẩm bột nước tương','','Bạch tuộc','bsf1'),
 ('seed-prod-19','','2 da tẩm bột 9 - 12','','Bạch tuộc','bsf1'),
 ('seed-prod-20','','2 da luộc màu','','Bạch tuộc','bsf1'),
 ('seed-prod-21','','2 da ncls','','Bạch tuộc','bsf1');

-- 3. Kỳ cân đối 21–25/07/2025
INSERT INTO balancing_periods (id,material_type_name,date_range_description,start_date,end_date,total_input_kg,exchange_rate,processing_cost_per_kg,created_at,site_id)
VALUES ('seed-ky-bt2da','Bạch tuộc 2 da','21/07/2025 – 25/07/2025','2025-07-21','2025-07-25',63926.3,26000,30000,'2025-07-26T02:00:00.000Z','bsf1');

-- Khối 1: Nguyên liệu vào (11 dòng — có daily_quantities dồn vào 21/07; giá 6/7/8 khớp giấy)
INSERT INTO balancing_inputs (id,period_id,group_name,name,quantity_kg,unit_price,ratio_percentage,source_warehouse,daily_quantities,site_id) VALUES
 ('seed-in-1','seed-ky-bt2da','Thủy sản','Bán nội địa',-987,145000,NULL,'','{"2025-07-21": -987}','bsf1'),
 ('seed-in-2','seed-ky-bt2da','Xả đông','x.đ Cò May',13584,157000,NULL,'Mua về','{"2025-07-21": 13584}','bsf1'),
 ('seed-in-3','seed-ky-bt2da','Xả đông','x.đ Tả',5100,157000,NULL,'Mua về','{"2025-07-21": 5100}','bsf1'),
 ('seed-in-4','seed-ky-bt2da','Xả đông','x.đ 2 da lớn',3984,149000,NULL,'Mua về','{"2025-07-21": 3984}','bsf1'),
 ('seed-in-5','seed-ky-bt2da','Thủy sản','2 da nl lớn',23150,145000,NULL,'','{"2025-07-21": 23150}','bsf1'),
 ('seed-in-6','seed-ky-bt2da','Thủy sản','2 da nl nhỏ',16356,137736.55,NULL,'','{"2025-07-21": 16356}','bsf1'),
 ('seed-in-7','seed-ky-bt2da','Bột phụ gia','Bột 24v',245,50427.86,NULL,'','{"2025-07-21": 245}','bsf1'),
 ('seed-in-8','seed-ky-bt2da','Bột phụ gia','Bột 18v',1481,52496.81,NULL,'','{"2025-07-21": 1481}','bsf1'),
 ('seed-in-9','seed-ky-bt2da','Bột phụ gia','Bột 27102',670,48540,NULL,'','{"2025-07-21": 670}','bsf1'),
 ('seed-in-10','seed-ky-bt2da','Bột phụ gia','Bột 22601',155,53000,NULL,'','{"2025-07-21": 155}','bsf1'),
 ('seed-in-11','seed-ky-bt2da','Bột phụ gia','Bột 2204',188.3,89340,NULL,'','{"2025-07-21": 188.3}','bsf1');

-- Khối 2: Bán thành phẩm ra (24 dòng — có daily_quantities dồn vào 21/07)
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,daily_quantities,site_id) VALUES
 ('seed-out-1','seed-ky-bt2da','seed-prod-1','seed-cust-1','Xuất khẩu',1083,10.81,'','','{"2025-07-21": 1083}','bsf1'),
 ('seed-out-2','seed-ky-bt2da','seed-prod-2','seed-cust-1','Xuất khẩu',93,9.65,'','','{"2025-07-21": 93}','bsf1'),
 ('seed-out-3','seed-ky-bt2da','seed-prod-3','seed-cust-2','Xuất khẩu',6,10.9,'','','{"2025-07-21": 6}','bsf1'),
 ('seed-out-4','seed-ky-bt2da','seed-prod-4','seed-cust-1','Xuất khẩu',2399,10.75,'','','{"2025-07-21": 2399}','bsf1'),
 ('seed-out-5','seed-ky-bt2da','seed-prod-5','seed-cust-1','Xuất khẩu',56,10.51,'','','{"2025-07-21": 56}','bsf1'),
 ('seed-out-6','seed-ky-bt2da','seed-prod-6','seed-cust-3','Xuất khẩu',1815,8.56,'','','{"2025-07-21": 1815}','bsf1'),
 ('seed-out-7','seed-ky-bt2da','seed-prod-7','seed-cust-3','Xuất khẩu',7521,8.51,'','','{"2025-07-21": 7521}','bsf1'),
 ('seed-out-8','seed-ky-bt2da','seed-prod-8','seed-cust-4','Xuất khẩu',11591,10.43,'','','{"2025-07-21": 11591}','bsf1'),
 ('seed-out-9','seed-ky-bt2da','seed-prod-9','seed-cust-5','Xuất khẩu',12,11.4,'','','{"2025-07-21": 12}','bsf1'),
 ('seed-out-10','seed-ky-bt2da','seed-prod-10','seed-cust-4','Xuất khẩu',1369,10.23,'','','{"2025-07-21": 1369}','bsf1'),
 ('seed-out-11','seed-ky-bt2da','seed-prod-11','seed-cust-1','Xuất khẩu',558,10.06,'','','{"2025-07-21": 558}','bsf1'),
 ('seed-out-12','seed-ky-bt2da','seed-prod-12','seed-cust-1','Xuất khẩu',380,10.06,'','','{"2025-07-21": 380}','bsf1'),
 ('seed-out-13','seed-ky-bt2da','seed-prod-13','seed-cust-6','Xuất khẩu',1890,10.67,'','','{"2025-07-21": 1890}','bsf1'),
 ('seed-out-14','seed-ky-bt2da','seed-prod-14','seed-cust-6','Xuất khẩu',538,10.87,'','','{"2025-07-21": 538}','bsf1'),
 ('seed-out-15','seed-ky-bt2da','seed-prod-15','seed-cust-6','Xuất khẩu',70,11.02,'','','{"2025-07-21": 70}','bsf1'),
 ('seed-out-16','seed-ky-bt2da','seed-prod-16','seed-cust-1','Xuất khẩu',325,10.75,'','','{"2025-07-21": 325}','bsf1'),
 ('seed-out-17','seed-ky-bt2da','seed-prod-17','seed-cust-1','Xuất khẩu',169,11.1,'','','{"2025-07-21": 169}','bsf1'),
 ('seed-out-18','seed-ky-bt2da','seed-prod-18','seed-cust-7','Xuất khẩu',5119,9.3,'','','{"2025-07-21": 5119}','bsf1'),
 ('seed-out-19','seed-ky-bt2da','seed-prod-18','seed-cust-8','Xuất khẩu',2000,9.2,'','','{"2025-07-21": 2000}','bsf1'),
 ('seed-out-20','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1411,7.95,'','','{"2025-07-21": 1411}','bsf1'),
 ('seed-out-21','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1000,9.2,'','','{"2025-07-21": 1000}','bsf1'),
 ('seed-out-22','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',1260,9.75,'','','{"2025-07-21": 1260}','bsf1'),
 ('seed-out-23','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',261,8.55,'','','{"2025-07-21": 261}','bsf1'),
 ('seed-out-24','seed-ky-bt2da','seed-prod-21','','Xuất khẩu',2218,6.55,'','','{"2025-07-21": 2218}','bsf1');

COMMIT;

-- Sau Run + reload Vercel: Cân đối → 1 kỳ "Bạch tuộc 2 da 21–25/07"
--   Khối 1: 11 dòng NL (ô 21/7 có số) · Khối 2: 24 mặt hàng · Tổng NL 63.926,3 ·
--   Tổng TP 43.144 · Định mức 1,48 · Lãi ≈ 242.346.204 đ.
