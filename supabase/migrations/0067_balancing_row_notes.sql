-- ============================================================
-- Baseafood MES — 0067: GHI CHÚ dòng ở lưới Cân đối (khối NL + khối bán thành phẩm)
--
-- Vì sao (người dùng yêu cầu 2026-10-16): bảng cân đối giấy có chỗ ghi chú cạnh từng
-- dòng; lưới số hoá chưa có ⇒ thêm cột Ghi chú ở cuối lưới. App chỉ gửi `note` khi dòng
-- đã từng có ghi chú (lib/repo.ts) ⇒ DB chưa chạy file này thì dòng cũ vẫn ghi được, chỉ
-- dòng có ghi chú bị từ chối.
--
-- Chỉ THÊM cột (text, mặc định rỗng). Không đổi dữ liệu, policy, trigger. Mức độ 🟡.
-- Idempotent (add column if not exists).
-- ROLLBACK:
--   alter table public.balancing_inputs  drop column if exists note;
--   alter table public.balancing_outputs drop column if exists note;
-- ============================================================

alter table public.balancing_inputs  add column if not exists note text not null default '';
alter table public.balancing_outputs add column if not exists note text not null default '';
