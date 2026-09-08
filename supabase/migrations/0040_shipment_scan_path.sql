-- ============================================================
-- 0040_shipment_scan_path.sql
-- Ảnh phiếu tay chụp kèm CHUYẾN nhập (nền OCR — QĐ-1). DB chỉ giữ ĐƯỜNG DẪN
-- (path) trong Storage bucket "qc" (xem docs/ops/supabase-storage.md), file nằm ở
-- Storage. Xem ảnh qua signed URL có hạn.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 1 cột nullable vào import_shipments (0004).
-- Dòng cũ không đổi (scan_path để NULL). Idempotent: chạy lại nhiều lần vẫn ổn.
-- ============================================================

alter table public.import_shipments
  add column if not exists scan_path text;

comment on column public.import_shipments.scan_path is
  'Đường dẫn ảnh phiếu tay trong Storage (nền OCR). NULL = chưa chụp.';

-- ROLLBACK:
-- alter table public.import_shipments drop column if exists scan_path;
