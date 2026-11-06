-- ============================================================
-- Baseafood MES — 0110: NGUỒN ĐÃ "BỎ KHỎI KỲ" CỦA KỲ CÂN ĐỐI
--
-- Vì sao (rà soát 2026-11-06 "thêm thừa / làm nhầm thì phải gỡ được"): kỳ TỰ LẤY sổ Nhập hàng
-- theo khoảng ngày + họ NL. Người dùng bỏ một dòng hút khỏi kỳ (lấy nhầm) thì lần mở kỳ sau
-- màn lại tự lấy vào ⇒ không gỡ được. Kỳ phải NHỚ nguồn nào đã bỏ, trên máy chủ (hai máy cùng
-- mở kỳ phải thấy như nhau) ⇒ lưu ngay trên dòng kỳ.
--
-- Làm gì — CHỈ THÊM một cột, không đổi / xóa gì đang có. Không đổi RLS (cột theo policy sẵn có).
--   `balancing_periods.excluded_source_keys` jsonb — mảng khóa nguồn đã bỏ khỏi kỳ:
--     "imports:<họ NL viết thường>" · "production:<mã mặt hàng>|<quy cách>" · "sales:<id dòng bán>".
--   Mặc định '[]' (= chưa bỏ gì). Sổ nguồn (Nhập hàng / Sản xuất / Bán hàng) KHÔNG đổi.
-- App chỉ gửi cột này khi kỳ đã từng bỏ một nguồn ⇒ chưa chạy file này thì kỳ vẫn ghi bình
-- thường, riêng kỳ có "Bỏ khỏi kỳ" không lên được máy chủ (hàng chờ báo lỗi cột).
-- Idempotent — chạy lại không lỗi.
-- ============================================================

alter table public.balancing_periods
  add column if not exists excluded_source_keys jsonb not null default '[]'::jsonb;

-- Kiểm sau khi chạy:
--   select count(*) from information_schema.columns
--    where table_name = 'balancing_periods' and column_name = 'excluded_source_keys';  -- 1

-- ROLLBACK (kỳ quên các nguồn đã bỏ ⇒ sổ nhập cùng họ lại tự vào kỳ; số liệu sổ không đổi):
--   alter table public.balancing_periods drop column if exists excluded_source_keys;
