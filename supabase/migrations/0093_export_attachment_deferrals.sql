-- ============================================================
-- Baseafood MES — 0093: HỢP ĐỒNG XUẤT — HỒ SƠ BẮT BUỘC "BỔ SUNG SAU"
--
-- Vì sao (2026-11-02, ba-spec docs/app-map/58-contract-attachment-deferral.ba-spec.md, chủ dự án chốt 4 câu):
-- hợp đồng đã ký / L/C thường về muộn; bắt đính đủ mới ghi chuyến làm Phòng Kế hoạch không ghi được booking,
-- đóng cont trên app dù việc ngoài đời đã chạy. Nay mỗi loại hồ sơ bắt buộc còn thiếu được ghi "bổ sung sau"
-- kèm lý do ⇒ mở ghi chuyến; vẫn CHẶN duyệt cuối / Chốt HĐ tới khi đính đủ file.
--
-- Làm gì: export_contracts THÊM cột attachment_deferrals jsonb (mặc định '{}'):
--   { "<loại>": { "reason": "...", "by": "<họ tên>", "at": "<ISO>" } }, loại = signed-contract | lc.
--   Dấu nằm trên HĐ (không theo bản) ⇒ ghi bản sửa không mất dấu.
--
-- KHÔNG đụng: RLS / ma trận quyền (cột mới theo policy sẵn có của export_contracts), dòng cũ (mặc định '{}').
-- App chỉ gửi cột khi HĐ có dấu và chỉ cho ghi dấu khi máy chủ đã có cột (serverHasColumn) ⇒ chưa chạy file
-- này thì app chạy như cũ, không kẹt hàng chờ.
-- Mức độ rủi ro: 🟡 chỉ thêm cột. Chạy lại an toàn (if not exists).
--
-- Đường lùi:
--   alter table public.export_contracts drop column if exists attachment_deferrals;
-- ============================================================

alter table public.export_contracts
  add column if not exists attachment_deferrals jsonb not null default '{}'::jsonb;

comment on column public.export_contracts.attachment_deferrals is
  'Hồ sơ bắt buộc ghi "bổ sung sau" (ba-spec 58): {"signed-contract"|"lc": {reason, by, at}}. Có file thì app tự gỡ dấu.';

notify pgrst, 'reload schema';
