-- ============================================================
-- Baseafood MES — 0068: NHÓM Sổ kho tháng của lô GỬI ĐÔNG (dòng cân đối)
--
-- Vì sao (người dùng yêu cầu 2026-10-16): lô gửi đông trước luôn vào nhóm riêng
-- "Nguyên liệu gửi đông" — thừa một bảng. Nay người dùng chọn bảng đích (Nguyên liệu
-- mua ngoài / nhập khẩu / Hàng tạm…) trong hộp "Gửi vào sổ kho" ở Cân đối; dòng cân đối
-- phải nhớ lựa chọn đó để mỗi lần ghi lại lô vẫn vào đúng nhóm.
--
-- App chỉ gửi `stock_category` khi dòng đã chọn nhóm (lib/repo.ts) ⇒ DB chưa chạy file
-- này thì dòng cũ vẫn ghi được, chỉ dòng vừa chọn nhóm bị từ chối.
--
-- Chỉ THÊM cột (text, mặc định rỗng). Không đổi dữ liệu, policy, trigger. Lô gửi đông
-- đã ghi ở nhóm cũ giữ nguyên. Mức độ 🟡. Idempotent (add column if not exists).
-- ROLLBACK:
--   alter table public.balancing_inputs drop column if exists stock_category;
-- ============================================================

alter table public.balancing_inputs add column if not exists stock_category text not null default '';
