-- ============================================================
-- Baseafood MES — 0023: RESET kỳ cân đối + SEED "Bạch tuộc 2 da" (21–29/07/2025)
--
-- 🔴 PHÁ HỦY: XÓA TOÀN BỘ kỳ cân đối (balancing_periods/inputs/outputs) của site
--    'bsf1' — theo yêu cầu (mọi kỳ hiện có đều là TEST). Xóa xong nạp lại DUY NHẤT
--    kỳ bạch tuộc 2 da. Không đụng danh mục thật (id khác 'seed-') và material_imports.
--
-- ⚠️ SỐ LIỆU THEO TỪNG NGÀY THẬT (sửa 2026-08-22): Khối 2 nạp daily_quantities +
--    carry_over_kg TRÍCH ĐÚNG khối "BTP theo ngày" của file Excel gốc — cột chuyển
--    kỳ (N) + các cột 22/07…29/07. KHÔNG còn dồn giả vào 21/07.
--    · Vì cột ngày chạy tới 29/07 nên KỲ MỞ RỘNG end_date = 2025-07-29 để lưới hiện
--      đủ ô (sumGridRow cộng MỌI ngày; nếu kỳ dừng 25/07 thì ô 26–29 ẩn nhưng vẫn
--      vào Tổng ⇒ nhìn lệch). NL nhận 21–25, BTP ra kéo tới 29 — đúng dòng thực tế.
--    · Cột "Lượng" (tổng của kế toán) là SỐ CHỐT THẬT của xí nghiệp — Σ ngày+chuyển kỳ
--      KHỚP Lượng ở 23/24 mặt hàng. Riêng '2 da ncls': per-day file ghi THIẾU (chỉ 1.109)
--      so với Lượng thật 2.218 ⇒ tổng ncls giữ 2.218, phần 1.109 thiếu ngày để ở carry.
--    · Lãi = 242.346.205 đ (≈ bảng giấy 242.346.218; lệch 13đ do làm tròn đơn giá NL).
--
-- CHẠY: Supabase → SQL Editor → dán → Run (idempotent, chạy lại vẫn đúng 1 kỳ).
-- ⚠️ Tiên quyết: migration 0018 (NL âm) + 0019 (daily_quantities + carry_over_kg) đã chạy.
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

-- 3. Kỳ cân đối 21–29/07/2025 (NL nhận 21–25, BTP ra kéo tới 29 — xem đầu file)
INSERT INTO balancing_periods (id,material_type_name,date_range_description,start_date,end_date,total_input_kg,exchange_rate,processing_cost_per_kg,created_at,site_id)
VALUES ('seed-ky-bt2da','Bạch tuộc 2 da','21/07/2025 – 29/07/2025','2025-07-21','2025-07-29',63926.3,26000,30000,'2025-07-26T02:00:00.000Z','bsf1');

-- Khối 1: Nguyên liệu vào (11 dòng — file gốc CHỈ có tổng, không có cột ngày cho NL
--    ⇒ đặt trọn vào 21/07 (ngày mở kỳ). Đây là số thật, không phải dồn giả. Giá 6/7/8 khớp giấy)
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

-- Khối 2: Bán thành phẩm ra (24 dòng — daily_quantities THẬT theo cột ngày 22–29/07
--    + carry_over_kg = cột "chuyển kỳ" (N) của file. quantity_kg = Σ ngày + chuyển kỳ
--    (đúng cái lưới tự tính; app cũng ép lại giá trị này). out-24 'ncls' = 2.218 (số
--    chốt thật của kế toán); per-day file ghi thiếu nên 1.109 để ở carry — xem đầu file.)
INSERT INTO balancing_outputs (id,period_id,product_id,customer_id,channel,quantity_kg,unit_price,spec,sales_item_id,carry_over_kg,daily_quantities,site_id) VALUES
 ('seed-out-1','seed-ky-bt2da','seed-prod-1','seed-cust-1','Xuất khẩu',1083,10.81,'','',0,'{"2025-07-24":766,"2025-07-27":317}','bsf1'),
 ('seed-out-2','seed-ky-bt2da','seed-prod-2','seed-cust-1','Xuất khẩu',93,9.65,'','',0,'{"2025-07-24":15,"2025-07-25":18,"2025-07-26":5,"2025-07-27":46,"2025-07-28":9}','bsf1'),
 ('seed-out-3','seed-ky-bt2da','seed-prod-3','seed-cust-2','Xuất khẩu',6,10.9,'','',0,'{"2025-07-22":6}','bsf1'),
 ('seed-out-4','seed-ky-bt2da','seed-prod-4','seed-cust-1','Xuất khẩu',2399,10.75,'','',0,'{"2025-07-22":424,"2025-07-23":1620,"2025-07-24":355}','bsf1'),
 ('seed-out-5','seed-ky-bt2da','seed-prod-5','seed-cust-1','Xuất khẩu',56,10.51,'','',0,'{"2025-07-24":4,"2025-07-25":11,"2025-07-26":28,"2025-07-27":13}','bsf1'),
 ('seed-out-6','seed-ky-bt2da','seed-prod-6','seed-cust-3','Xuất khẩu',1815,8.56,'','',0,'{"2025-07-26":624,"2025-07-27":326,"2025-07-28":65,"2025-07-29":800}','bsf1'),
 ('seed-out-7','seed-ky-bt2da','seed-prod-7','seed-cust-3','Xuất khẩu',7521,8.51,'','',-2000,'{"2025-07-24":366,"2025-07-25":300,"2025-07-26":494,"2025-07-27":2068,"2025-07-28":3113,"2025-07-29":3180}','bsf1'),
 ('seed-out-8','seed-ky-bt2da','seed-prod-8','seed-cust-4','Xuất khẩu',11591,10.43,'','',258,'{"2025-07-22":261,"2025-07-23":1785,"2025-07-24":3384,"2025-07-25":5749,"2025-07-26":154}','bsf1'),
 ('seed-out-9','seed-ky-bt2da','seed-prod-9','seed-cust-5','Xuất khẩu',12,11.4,'','',0,'{"2025-07-23":7,"2025-07-24":5}','bsf1'),
 ('seed-out-10','seed-ky-bt2da','seed-prod-10','seed-cust-4','Xuất khẩu',1369,10.23,'','',0,'{"2025-07-23":607,"2025-07-24":644,"2025-07-25":103,"2025-07-27":15}','bsf1'),
 ('seed-out-11','seed-ky-bt2da','seed-prod-11','seed-cust-1','Xuất khẩu',558,10.06,'','',0,'{"2025-07-23":246,"2025-07-24":188,"2025-07-25":42,"2025-07-26":52,"2025-07-27":30}','bsf1'),
 ('seed-out-12','seed-ky-bt2da','seed-prod-12','seed-cust-1','Xuất khẩu',380,10.06,'','',0,'{"2025-07-23":66,"2025-07-24":29,"2025-07-25":14,"2025-07-26":74,"2025-07-27":116,"2025-07-28":41,"2025-07-29":40}','bsf1'),
 ('seed-out-13','seed-ky-bt2da','seed-prod-13','seed-cust-6','Xuất khẩu',1890,10.67,'','',150,'{"2025-07-24":25,"2025-07-25":124,"2025-07-26":406,"2025-07-27":556,"2025-07-28":229,"2025-07-29":400}','bsf1'),
 ('seed-out-14','seed-ky-bt2da','seed-prod-14','seed-cust-6','Xuất khẩu',538,10.87,'','',0,'{"2025-07-23":7,"2025-07-24":55,"2025-07-26":268,"2025-07-27":208}','bsf1'),
 ('seed-out-15','seed-ky-bt2da','seed-prod-15','seed-cust-6','Xuất khẩu',70,11.02,'','',0,'{"2025-07-26":70}','bsf1'),
 ('seed-out-16','seed-ky-bt2da','seed-prod-16','seed-cust-1','Xuất khẩu',325,10.75,'','',0,'{"2025-07-23":15,"2025-07-24":249,"2025-07-25":61}','bsf1'),
 ('seed-out-17','seed-ky-bt2da','seed-prod-17','seed-cust-1','Xuất khẩu',169,11.1,'','',0,'{"2025-07-26":19,"2025-07-29":150}','bsf1'),
 ('seed-out-18','seed-ky-bt2da','seed-prod-18','seed-cust-7','Xuất khẩu',5119,9.3,'','',0,'{"2025-07-23":365,"2025-07-25":1352,"2025-07-26":1902,"2025-07-29":1500}','bsf1'),
 ('seed-out-19','seed-ky-bt2da','seed-prod-18','seed-cust-8','Xuất khẩu',2000,9.2,'','',2000,'{}','bsf1'),
 ('seed-out-20','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1411,7.95,'','',0,'{"2025-07-24":1411}','bsf1'),
 ('seed-out-21','seed-ky-bt2da','seed-prod-19','seed-cust-1','Xuất khẩu',1000,9.2,'','',1000,'{}','bsf1'),
 ('seed-out-22','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',1260,9.75,'','',0,'{"2025-07-22":40,"2025-07-25":210,"2025-07-26":222,"2025-07-27":354,"2025-07-28":334,"2025-07-29":100}','bsf1'),
 ('seed-out-23','seed-ky-bt2da','seed-prod-20','','Xuất khẩu',261,8.55,'','',-170,'{"2025-07-25":319,"2025-07-26":25,"2025-07-27":27,"2025-07-28":60}','bsf1'),
 ('seed-out-24','seed-ky-bt2da','seed-prod-21','','Xuất khẩu',2218,6.55,'','',1109,'{"2025-07-22":223,"2025-07-23":112,"2025-07-26":774}','bsf1');
--   ↑ ncls: TỔNG THẬT xí nghiệp = 2.218 (cột Lượng, số chốt của kế toán). Khối per-day
--     của file chỉ ghi 223+112+774 = 1.109 (ghi THIẾU ngày). Phần 1.109 còn lại chưa rõ
--     ngày ⇒ để ở carry_over_kg cho Σ = 2.218, giữ Lãi = 242.346.205 (≈ giấy 242.346.218).
--     Nếu biết 1.109 rơi vào ngày nào, chuyển từ carry sang ô ngày tương ứng.

COMMIT;

-- Sau Run + reload Vercel: Cân đối → 1 kỳ "Bạch tuộc 2 da 21–29/07"
--   Khối 1: 11 dòng NL (ô 21/7 có số) · Khối 2: 24 mặt hàng, ô ngày trải 22–29/07 +
--   cột Chuyển kỳ · Tổng NL 63.926,3 · Tổng TP 43.144 · Định mức 63.926,3 ÷ 43.144 ≈ 1,48 ·
--   Lãi = 242.346.205 đ (≈ bảng giấy 242.346.218; lệch 13đ do làm tròn đơn giá NL).
--   ℹ️ 'ncls' ô Chuyển kỳ = 1.109: phần per-day file ghi thiếu, để đây cho Σ = 2.218 (số
--      chốt thật). Biết ngày thật thì chuyển sang ô ngày tương ứng.
