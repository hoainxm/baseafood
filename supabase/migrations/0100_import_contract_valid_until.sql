-- ============================================================
-- Baseafood MES — 0100: HẠN HỢP ĐỒNG của hợp đồng NHẬP khẩu
--
-- Vì sao (2026-11-03, ba-spec 69 v2, Phòng Kế hoạch): HĐ ghi "binding on from the date of signing to late
-- December 31, 2026" — ngày HĐ hết hiệu lực. HĐ xuất đã có (nằm trong terms jsonb, không cần cột); HĐ nhập lưu
-- từng trường ở cột riêng ⇒ thêm một cột.
--
-- Làm gì: thêm cột `import_contracts.valid_until date` (để trống được). Không đổi RLS, không đổi dữ liệu cũ
-- (HĐ cũ = chưa ghi hạn).
-- Idempotent (chạy lại không lỗi). Chạy sau 0082 (bảng import_contracts).
-- ⚠ Chưa chạy ⇒ app tự ẩn ô Hạn hợp đồng ở HĐ nhập, ghi HĐ nhập vẫn chạy (không gửi cột).
-- ROLLBACK cuối file.
-- ============================================================

alter table public.import_contracts add column if not exists valid_until date;

comment on column public.import_contracts.valid_until is
  'Hạn hợp đồng — ngày HĐ nhập hết hiệu lực ("binding … to …"), khác ngày về kho. Trống = chưa ghi (ba-spec 69).';

-- ROLLBACK (chạy tay nếu cần gỡ):
-- alter table public.import_contracts drop column if exists valid_until;
