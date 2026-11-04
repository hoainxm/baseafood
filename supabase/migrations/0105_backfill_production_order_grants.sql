-- ============================================================
-- Baseafood MES — 0105: BÙ QUYỀN "LỆNH SẢN XUẤT" CHO VAI TRÒ ĐÃ CHỈNH (sửa lỗi 0088)
--
-- Vì sao (2026-11-04): Phòng Kế hoạch báo không thấy nút "Lập lệnh sản xuất", chỉ admin thấy. Kiểm chỉ-đọc DB thật:
--   • 0088 đã chạy (bảng production_orders có, default_role_permissions có 21 dòng `production-orders`).
--   • Nhưng `planner`, `planning-deputy`, `accountant` là vai trò ĐÃ CHỈNH (có dòng `app_roles`) ⇒ quyền lấy ĐÚNG các ô ở
--     `role_permissions` (current_permission_context, 0087; buildRolePermissions ở app), KHÔNG đọc ma trận mặc định.
--     0088 chỉ thay `default_role_permissions` ⇒ vai đã chỉnh không có ô nào của `production-orders` ⇒ app ẩn nút, RLS chặn.
--   • Admin luôn qua ⇒ chỉ admin thấy.
--
-- Làm gì — CHỈ THÊM dòng `role_permissions` của tài nguyên `production-orders` cho vai đã chỉnh, lấy đúng ô của ma trận
-- mặc định (planner / planning-deputy: Xem · Thêm · Sửa · Xóa; accountant: Xem). Không xóa, không sửa ô nào đang có;
-- vai chưa chỉnh giữ nguyên (đã đọc ma trận mặc định). DB thật 2026-11-04 ⇒ 9 dòng.
-- Idempotent (on conflict do nothing). Chạy SAU 0088. Không đụng RLS, hàm, bảng.
-- ROLLBACK cuối file.
-- ============================================================

insert into public.role_permissions (id, site_id, role_id, resource, action, scope)
select d.role_id || '|' || d.resource || '|' || d.action, 'bsf1', d.role_id, d.resource, d.action, d.scope
from public.default_role_permissions d
join public.app_roles ar on ar.id = d.role_id
where d.resource = 'production-orders'
on conflict (id) do nothing;

-- KIỂM (chỉ đọc):
--   select role_id, action from public.role_permissions where resource = 'production-orders' order by 1, 2;
--   -- DB thật 2026-11-04: accountant view · planner ×4 · planning-deputy ×4 (9 dòng)
-- Người dùng tải lại app (F5) là thấy nút "Lập lệnh sản xuất" (hồ sơ HĐ xuất · bước Lệnh sản xuất của chuyến · hộp Lập HĐ).

-- ============================================================
-- ROLLBACK (chỉ khi chưa ai chỉnh tay các ô này sau khi chạy):
--   delete from public.role_permissions where resource = 'production-orders'
--    and role_id in (select id from public.app_roles);
-- ============================================================
