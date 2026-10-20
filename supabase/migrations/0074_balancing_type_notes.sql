-- ============================================================
-- Baseafood MES — 0074: GHI CHÚ RIÊNG TỪNG LOẠI của dòng Cân đối hút từ sổ nhập
--
-- Vì sao (kế toán 2026-10-20): khối "Nguyên liệu vào" không còn dòng gộp họ ("Bạch tuộc
-- 2 da" = tổng 2 loại) — mỗi LOẠI (2 da lớn · 2 da nhỏ) là một dòng riêng trên màn. Ghi
-- chú cũ (`note`, mig 0067) là MỘT chữ cho cả dòng kỳ ⇒ hai dòng loại không có chỗ ghi.
-- Cột này giữ ghi chú của từng loại ngay trên dòng kỳ.
--
-- Dạng: jsonb `{ "<tên loại NL>": "<ghi chú>" }`. Null = chưa ghi chú loại nào ⇒ màn hiện
-- ghi chú cũ (`note`) ở dòng loại đầu tiên. App chỉ gửi cột này khi dòng đã có ghi chú
-- loại (lib/repo.ts) ⇒ DB chưa chạy file này thì dòng cũ vẫn ghi được, chỉ dòng vừa gõ
-- ghi chú loại bị từ chối (kẹt hàng chờ) — CHẠY FILE TRƯỚC KHI DEPLOY.
--
-- Chỉ THÊM cột (nullable). Không đổi dữ liệu, policy, trigger. Mức độ 🟡.
-- Idempotent (add column if not exists).
-- ROLLBACK:
--   alter table public.balancing_inputs drop column if exists type_notes;
-- ============================================================

alter table public.balancing_inputs add column if not exists type_notes jsonb;
