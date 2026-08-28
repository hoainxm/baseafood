-- ============================================================
-- Baseafood MES — 0034: BACKFILL kiểu chế biến + bổ sung mặt hàng còn thiếu
--
-- Vì sao: cột products.processing_type (0027) mặc định '' — 141 mã seed CHƯA gắn
-- nhãn nào ⇒ dropdown "Kiểu chế biến" ở màn ghi thành phẩm (/wip, gom theo chế
-- biến × khách) mở ra RỖNG. Migration này:
--   ① Suy kiểu chế biến TỪ TÊN cho mọi mặt hàng còn trống nhãn (nhân bản đúng luật
--      `suyKieuCheBien` ở src/lib/catalogRepo.ts — khớp trước thắng). Bảo thủ: tên
--      không chứa từ khóa rõ thì để '' ("chưa phân loại"), không đoán bừa. Từ vựng
--      của xưởng Đông (bạch tuộc); mã Cá/Mực/Tôm phần lớn giữ '' — đúng chủ ý.
--   ② Nạp 8 mặt hàng THẬT (bạch tuộc 2 da, mức gộp) có trong file cân đối nhưng
--      thiếu hẳn ở 141 mã kế toán. finished_good_code='' = chưa ánh xạ (danh mục
--      MỞ; kế toán cấp mã sau thì nối). 6 dòng "lệch tên" (luộc↔cắt luộc) KHÔNG
--      thêm — đã chốt là cùng thứ, giữ mã kế toán.
--
-- Đối xứng với seed local (catalogRepo.seedProducts): bản chưa cài (bảng rỗng) thì
-- seed lo; bản Supabase đã có 141 dòng thì migration này lo.
--
-- Mức độ rủi ro: 🟡 YELLOW — chỉ ĐIỀN cột đang trống (không đè nhãn ai đã sửa tay)
-- + THÊM 8 dòng id tất định. Chạy lại nhiều lần vẫn đúng (idempotent). Câu lùi ở
-- khối ROLLBACK cuối file.
-- ⚠️ Cột processing_type do 0027 tạo. File này TỰ ĐẢM BẢO cột tồn tại (add column
--    if not exists) để chạy được kể cả khi DB chưa chạy 0027 — NHƯNG app còn cần
--    0028…0033 (leftover, đóng gói, tách/quy cách, snapshot NXT, wip processing_type)
--    ⇒ hãy chạy đủ 0027→0033 rồi mới 0034. site_id='bsf1' phải = VITE_SITE_ID.
-- ============================================================
BEGIN;

-- ⓪ Tự đảm bảo cột tồn tại (idempotent, giống 0027) — DDL trong transaction thấy
--    ngay ở các câu sau. Nếu 0027 đã chạy thì câu này không đổi gì.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS processing_type text NOT NULL DEFAULT '';

-- ① Backfill nhãn cho mặt hàng CÒN TRỐNG (không đè nhãn đã gán tay).
--    CASE mirror suyKieuCheBien() — GIỮ NGUYÊN THỨ TỰ (khớp trước thắng).
UPDATE products SET processing_type =
  CASE
    WHEN lower(name) LIKE '%ncls%'
      OR lower(name) LIKE '%nguyên con làm sạch%' THEN 'Nguyên con làm sạch'
    WHEN lower(name) LIKE '%luộc màu%'   THEN 'Luộc màu'
    WHEN lower(name) LIKE '%cắt chần%'   THEN 'Cắt chần'
    WHEN lower(name) LIKE '%cắt luộc%'   THEN 'Cắt luộc'
    WHEN lower(name) LIKE '%tẩm bột%'    THEN 'Tẩm bột'
    WHEN lower(name) LIKE '%tẩm gia vị%'
      OR lower(name) LIKE '%tẩm muối%'   THEN 'Tẩm gia vị'
    WHEN lower(name) LIKE '%luộc%'       THEN 'Luộc'
    WHEN lower(name) LIKE '%chần%'       THEN 'Chần'
    WHEN lower(name) LIKE '%cắt%'        THEN 'Cắt'
    ELSE ''
  END
WHERE coalesce(processing_type, '') = '';

-- ② 8 mặt hàng thật còn thiếu (id tất định 'mh-bs-*' → chạy lại không đẻ trùng).
INSERT INTO products (id, code, name, finished_good_code, category, processing_type, site_id) VALUES
 ('mh-bs-cc-380-420',   '', 'Bạch tuộc 2 da cắt chần 380-420',  '', 'Bạch tuộc', 'Cắt chần', 'bsf1'),
 ('mh-bs-cc-455-555',   '', 'Bạch tuộc 2 da cắt chần 455-555',  '', 'Bạch tuộc', 'Cắt chần', 'bsf1'),
 ('mh-bs-cc-700-750',   '', 'Bạch tuộc 2 da cắt chần 700-750',  '', 'Bạch tuộc', 'Cắt chần', 'bsf1'),
 ('mh-bs-cl-600-900',   '', 'Bạch tuộc 2 da cắt luộc 600-900',  '', 'Bạch tuộc', 'Cắt luộc', 'bsf1'),
 ('mh-bs-cl-1000-1300', '', 'Bạch tuộc 2 da cắt luộc 1000-1300','', 'Bạch tuộc', 'Cắt luộc', 'bsf1'),
 ('mh-bs-cl-5-5gr',     '', 'Bạch tuộc 2 da cắt luộc 5,5gr',    '', 'Bạch tuộc', 'Cắt luộc', 'bsf1'),
 ('mh-bs-rau-16-20',    '', 'Bạch tuộc 2 da cắt râu luộc 16-20','', 'Bạch tuộc', 'Cắt luộc', 'bsf1'),
 ('mh-bs-bot-nuoctuong','', 'Bạch tuộc 2 da tẩm bột nước tương','', 'Bạch tuộc', 'Tẩm bột',  'bsf1')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0034
--
-- BEGIN;
-- DELETE FROM products WHERE id LIKE 'mh-bs-%';
-- -- Xóa nhãn đã backfill (chỉ dòng mà 0034 điền; nhãn sửa tay sau đó cũng bị về
-- -- '' nếu bạn muốn giữ, ĐỪNG chạy dòng dưới — không có vết phân biệt nguồn nhãn):
-- -- UPDATE products SET processing_type = '' WHERE processing_type <> '';
-- COMMIT;
-- ============================================================
