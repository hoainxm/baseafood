-- ============================================================
-- Baseafood MES — 0071: GIÁ GỬI ĐÔNG THEO NGÀY (dòng cân đối)
--
-- Vì sao (kế toán yêu cầu 2026-10-19): dòng Gửi đông ở Cân đối chỉ có MỘT giá gửi cho
-- cả dòng, trong khi kế toán tính giá theo TỪNG NGÀY gửi. Mỗi ngày gửi đã là một lô
-- riêng trong Sổ kho tháng (invoice GĐ-yyyymmdd) — cột này giữ giá của từng ngày để
-- lô mang đúng giá đó; lấy xả đông kỳ sau thấy lại giá lô làm gợi ý.
--
-- Dạng: jsonb `{ "yyyy-mm-dd": đ/kg }`, giống `daily_quantities`. Null = dòng chưa gõ
-- giá theo ngày ⇒ mọi ngày dùng `unit_price` như cũ. App chỉ gửi cột này khi dòng đã có
-- giá theo ngày (lib/repo.ts) ⇒ DB chưa chạy file này thì dòng cũ vẫn ghi được, chỉ
-- dòng vừa gõ giá theo ngày bị từ chối.
--
-- Chỉ THÊM cột (nullable). Không đổi dữ liệu, policy, trigger. Mức độ 🟡.
-- Idempotent (add column if not exists).
-- ROLLBACK:
--   alter table public.balancing_inputs drop column if exists daily_prices;
-- ============================================================

alter table public.balancing_inputs add column if not exists daily_prices jsonb;
