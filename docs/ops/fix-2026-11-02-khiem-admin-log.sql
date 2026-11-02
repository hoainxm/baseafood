-- ============================================================
-- Sửa người ghi: thao tác Xuất khẩu 28/10/2026 ghi "admin" nhưng là Lê Quang Khiêm
-- ============================================================
-- Vì sao: chủ dự án cho Khiêm mượn tài khoản admin để xem (2026-11-02, nguyên văn:
-- "log thao tác với xuất nhập khẩu và lệnh sản xuất đang ghi của admin nhưng thật ra là của
-- Lê Quang Khiêm lúc đấy tôi share tài khoản cho xem").
--
-- Cách tách (đọc DB thật 2026-11-02, chỉ SELECT):
--   * Máy `1792463217940-7823c0e2-…` (device_id) là máy của Khiêm: ngày 30/10 anh dùng tài khoản riêng
--     `lqkhiem` trên đúng máy này (14 dòng). Máy này có 15 dòng ghi "admin":
--       - 14 dòng ngày 28/10 15:32 → 16:00 (giờ VN): 2 HĐ xuất, 2 bản HĐ, 1 chuyến, 4 bước, 2 file,
--         1 khách hàng, 2 tên hàng theo khách  ⇒ SỬA.
--       - 1 dòng đăng nhập admin 20/10 09:26  ⇒ GIỮ (đăng nhập, không phải thao tác XNK).
--   * 141 dòng "admin" khác đến từ máy `17901301…` (máy chủ dự án) ⇒ GIỮ NGUYÊN.
--   * `export_activity_log` (nhật ký hồ sơ HĐ) không có dòng nào ghi admin ⇒ không đụng.
--   * Lệnh sản xuất: chưa có dòng (mig 0088 chưa chạy) ⇒ không đụng.
--
-- Chạy: Supabase → SQL editor (vai postgres — app không UPDATE được audit_log, mig 0025).
-- Chạy lại nhiều lần không sao (chỉ đổi dòng còn ghi admin). Trigger 0048 sẽ ghi thêm dòng
-- "[SQL trực tiếp]" cho 3 bản ghi export_* — đó là vết sửa, đúng ý.

-- ---------- 1. Kiểm trước (phải ra 14 / 1 / 2 dòng; chạy lại sau khi sửa ⇒ 0 / 0 / 0) ----------
select count(*) as audit_rows from public.audit_log
 where actor_username = 'admin' and site_id = 'bsf1'
   and device_id = '1792463217940-7823c0e2-8cc4-4bce-bfc3-255a14f7c05f'
   and at >= '2026-10-28T08:00:00Z' and at < '2026-10-28T09:30:00Z';
select count(*) as revision_rows from public.export_contract_revisions
 where id = '1793175989807-fb819008-2ec3-4c12-aed1-680f89278558' and recorded_by = 'Admin';
select count(*) as file_rows from public.export_files
 where id in ('1793176807053-8b443606-6ed4-4f87-96e8-2ce8ba209d51', '1793176850092-8853ab17-a983-4955-bcd1-11bdf5768b5a')
   and uploaded_by = 'Admin';

-- ---------- 2. Sửa ----------
begin;

update public.audit_log
   set actor_username = 'lqkhiem',
       actor_id = 'bb909955-c4b0-4636-92ee-1bf8baa1d2c5'
 where actor_username = 'admin' and site_id = 'bsf1'
   and device_id = '1792463217940-7823c0e2-8cc4-4bce-bfc3-255a14f7c05f'
   and at >= '2026-10-28T08:00:00Z' and at < '2026-10-28T09:30:00Z';

update public.export_contract_revisions
   set recorded_by = 'Lê Quang Khiêm'
 where id = '1793175989807-fb819008-2ec3-4c12-aed1-680f89278558' and recorded_by = 'Admin';

update public.export_files
   set uploaded_by = 'Lê Quang Khiêm'
 where id in ('1793176807053-8b443606-6ed4-4f87-96e8-2ce8ba209d51', '1793176850092-8853ab17-a983-4955-bcd1-11bdf5768b5a')
   and uploaded_by = 'Admin';

commit;

-- ---------- 3. Hoàn tác (chỉ khi cần — giá trị cũ đã sao lưu ở đây) ----------
-- Giá trị cũ: audit_log actor_username = 'admin', actor_id = '0d9cd316-f143-41e4-9cb2-3e3fff865b13'
--   (14 id: 1793176321768-899bf3a3…, 1793176321770-5458bdbe…, 1793176321772-6f80d6c7…, 1793176774189-cb195f5b…,
--    1793176774191-eee28761…, 1793176807054-2a011023…, 1793176807056-0368ff9e…, 1793176850093-0f54410a…,
--    1793176850094-22f1300d…, 1793176856238-0ead53bc…, 1793177834381-1bc19e28…, 1793178020555-94dfd1cc…,
--    1793178020557-431a6de2…, 1793178020563-475c352f…); recorded_by / uploaded_by = 'Admin'.
-- begin;
-- update public.audit_log set actor_username = 'admin', actor_id = '0d9cd316-f143-41e4-9cb2-3e3fff865b13'
--  where actor_username = 'lqkhiem' and site_id = 'bsf1'
--    and device_id = '1792463217940-7823c0e2-8cc4-4bce-bfc3-255a14f7c05f'
--    and at >= '2026-10-28T08:00:00Z' and at < '2026-10-28T09:30:00Z';
-- update public.export_contract_revisions set recorded_by = 'Admin'
--  where id = '1793175989807-fb819008-2ec3-4c12-aed1-680f89278558' and recorded_by = 'Lê Quang Khiêm';
-- update public.export_files set uploaded_by = 'Admin'
--  where id in ('1793176807053-8b443606-6ed4-4f87-96e8-2ce8ba209d51', '1793176850092-8853ab17-a983-4955-bcd1-11bdf5768b5a')
--    and uploaded_by = 'Lê Quang Khiêm';
-- commit;
