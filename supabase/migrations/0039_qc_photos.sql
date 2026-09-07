-- ============================================================
-- Baseafood MES — 0039: Lưu ĐƯỜNG DẪN ảnh cho checklist QC (QĐ-8, họp 2026-09-02)
--
-- Vì sao: QC cuối ngày cần kèm ẢNH minh chứng (vệ sinh, dụng cụ, thiết bị…). Ảnh
-- nặng nên KHÔNG nhét vào Postgres — file để ở Supabase Storage (bucket "qc",
-- private, xem qua signed URL), DB chỉ giữ MẢNG ĐƯỜNG DẪN. Mỗi dòng qc_checklists
-- là một (ngày × xưởng × chỉ tiêu) → cột jsonb chứa mảng path ảnh của chỉ tiêu đó.
-- Xem hạ tầng: docs/ops/supabase-storage.md.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM cột nullable vào qc_checklists (0036), mặc
-- định NULL nên dòng QC cũ không đổi; ảnh là phụ, không chặn chốt ngày. Chạy SAU
-- 0036. Chạy lại nhiều lần vẫn không lỗi. RLS + trigger của bảng đã có (0021/0036).
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

alter table public.qc_checklists
  add column if not exists photo_paths jsonb;

comment on column public.qc_checklists.photo_paths is
  'Mảng đường dẫn ảnh trong Supabase Storage bucket "qc": ["bsf1/qc/2026/09/<uid>.jpg", ...]. Xem qua signed URL.';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0039
--
-- ALTER TABLE public.qc_checklists DROP COLUMN IF EXISTS photo_paths;
-- ============================================================
