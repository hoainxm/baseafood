-- ============================================================
-- Baseafood MES — 0021: SIẾT RLS (thay thế 0003)
--
-- 🔴 RED. Đọc hết đầu file trước khi dán.
--
-- Vì sao thay 0003: `0003` viết theo tên bảng TIẾNG VIỆT của thời trước
-- `0016_rename_to_english` (nhap_nguyen_lieu, ky_can_doi…). Sau `0016` những
-- tên đó không còn tồn tại nên `0003` chạy sẽ báo lỗi hoặc không siết gì, và
-- nó cũng bỏ sót 11 bảng thêm từ `0011`/`0017` trở đi (sản xuất BTP, đơn đặt,
-- lệnh xuất, kho…). File này siết ĐỦ 26 bảng đang dùng, theo tên hiện hành
-- (gồm material_opening_stock 0022 + finished_goods_opening_stock 0024 +
--  packagings 0029). audit_log KHÔNG nằm ở đây — giữ RLS riêng ở 0025.
--
-- Làm gì:
--   • Bỏ policy mở `to anon, authenticated using (true)` của giai đoạn chưa
--     có đăng nhập.
--   • Mỗi bảng một policy cho `authenticated`, điều kiện `auth.uid() is not null`.
--   • REVOKE ALL … FROM anon — chặn ở tầng quyền, không chỉ tầng policy.
--
-- Vì sao bắt buộc: anon key nằm trong bundle JS, ai mở DevTools cũng lấy được.
-- Còn `to anon using (true)` thì bất kỳ ai có key đó đều ĐỌC VÀ SỬA được toàn
-- bộ sổ sách xí nghiệp. Trước khi app rời mạng nội bộ, đây là việc bắt buộc.
--
-- ⚠️ TRƯỚC KHI CHẠY — kiểm ba thứ, thiếu một là cả xưởng đứng:
--   1. Mọi máy đang dùng đều ĐĂNG NHẬP ĐƯỢC (Supabase Auth, `0006`+`0007` đã chạy).
--   2. Còn ít nhất một tài khoản admin đăng nhập được (thử ngay trước khi chạy).
--   3. Không có thiết bị nào đang chạy bản cũ không có màn đăng nhập.
-- Chạy khi vẫn còn thiếu ⇒ mọi truy vấn trả 401, KHÔNG mất dữ liệu nhưng không
-- ai làm việc được cho tới khi lùi lại hoặc đăng nhập xong.
--
-- SAU KHI CHẠY — kiểm chứng (phải KHÔNG còn dòng nào chứa 'anon'):
--   select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' order by tablename;
--
-- Idempotent: chạy lại nhiều lần vẫn ra cùng một kết quả.
-- Câu lùi: khối ROLLBACK cuối file (mở lại cho anon — CHỈ dùng khi cháy).
-- ============================================================

do $$
declare
  t text;
  ds text[] := array[
    -- danh mục
    'sites', 'suppliers', 'material_types', 'finished_goods', 'products',
    'customers', 'warehouses',
    -- sổ nhập hàng
    'import_shipments', 'material_imports', 'daily_locks', 'scraps',
    -- kỳ cân đối
    'balancing_periods', 'balancing_inputs', 'balancing_outputs',
    -- bán hàng
    'sales_invoices', 'sales_items',
    -- sản xuất BTP + kho + đơn đặt + lệnh xuất + đóng gói
    'production_wips', 'production_locks', 'packagings', 'sales_orders', 'order_items',
    'export_orders', 'export_items',
    -- tồn đầu kho (nguyên liệu 0022 + thành phẩm 0024)
    'material_opening_stock', 'finished_goods_opening_stock',
    -- người dùng
    'user_profiles'
  ];
begin
  foreach t in array ds loop
    /* Bảng nào chưa tồn tại thì bỏ qua — máy chủ có thể chưa chạy hết
       migration cũ, không vì thế mà cả file gãy giữa chừng. */
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'Bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Policy mở của giai đoạn chưa đăng nhập, theo cả hai lối đặt tên đã dùng
    execute format('drop policy if exists %I on public.%I', t || '_toan_quyen', t);
    execute format('drop policy if exists %I on public.%I', t || '_nguoi_dung', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_policy', t);

    execute format(
      'create policy %I on public.%I for all to authenticated
       using ((select auth.uid()) is not null)
       with check ((select auth.uid()) is not null)',
      t || '_nguoi_dung', t);

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Chặn luôn ở tầng schema: anon không cần bất cứ quyền nào nữa.
revoke usage on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ============================================================
-- Còn thiếu (cố ý CHƯA làm trong file này — cần chốt nghiệp vụ trước):
--   • Phân quyền theo vai trò: tổ trưởng chỉ ghi xưởng mình, kế toán sửa kỳ
--     cân đối, giám đốc chỉ đọc. Hiện MỌI người đã đăng nhập có quyền như nhau
--     ở tầng DB; phân quyền đang là app-level (chỉ `admin` gate màn Người dùng).
--   • Ràng theo `site_id` của người đăng nhập.
--   • Cấm sửa bản ghi đã chốt sổ ở tầng DB (hiện chặn ở tầng app).
-- Làm ba việc trên = một migration RIÊNG, và cần bảng ánh xạ user→vai trò đọc
-- được từ policy (hiện vai trò lưu CSV trong `user_profiles.vai_tro`).
-- ============================================================

-- ============================================================
-- ROLLBACK — CHỈ dùng khi siết xong mà cả xưởng không làm việc được.
-- Mở lại cho anon = quay về trạng thái KHÔNG an toàn, làm xong phải siết lại.
--
-- grant usage on schema public to anon;
-- do $$
-- declare t text;
-- begin
--   for t in select table_name from information_schema.tables
--            where table_schema = 'public' loop
--     execute format('drop policy if exists %I on public.%I', t || '_nguoi_dung', t);
--     execute format(
--       'create policy %I on public.%I for all to anon, authenticated
--        using (true) with check (true)', t || '_toan_quyen', t);
--     execute format('grant all on public.%I to anon', t);
--   end loop;
-- end $$;
-- ============================================================
