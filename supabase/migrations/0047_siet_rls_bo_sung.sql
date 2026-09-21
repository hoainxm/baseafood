-- ============================================================
-- Baseafood MES — 0047: SIẾT RLS BỔ SUNG (5 bảng tạo SAU 0021)
--
-- 🔴 RED. Đọc hết đầu file trước khi dán.
--
-- Vì sao: `0021_siet_rls_tieng_anh.sql` liệt kê CỨNG 26 bảng có lúc nó được
-- viết. Năm bảng thêm SAU 0021 vẫn mang policy MỞ của giai đoạn chưa đăng nhập
-- (`for all to anon, authenticated using (true)`), nên dù đã chạy 0021 thì ai
-- có anon key (nằm sẵn trong bundle JS) vẫn ĐỌC/GHI được chúng:
--   • nxt_snapshots            (0032) — ảnh chụp NXT
--   • monthly_stock_ledger     (0041) — sổ kho theo tháng
--   • reconciliation_runs      (0043) — CHỨA FILE HĐĐT KẾ TOÁN (base64) ⚠
--   • storage_locations        (0044) — danh mục vị trí kho
--   • lot_inputs               (0046) — truy xuất lô
--
-- File này siết đúng NĂM bảng đó về cùng mô hình 0021: một policy cho
-- `authenticated` (điều kiện `auth.uid() is not null`) + REVOKE ALL từ anon.
--
-- ⚠️ BẤT BIẾN CẦN GIỮ: mỗi migration TẠO BẢNG MỚI về sau PHẢI kèm siết RLS
-- (đưa tên bảng vào mảng dưới HOẶC tự viết policy `authenticated`). Đừng để
-- lại `to anon … using(true)` khi merge. Hook pre-commit nay cảnh báo việc này.
--
-- Phân quyền theo VAI TRÒ + theo `site_id` + cấm sửa bản ghi đã chốt: VẪN chưa
-- làm ở đây (giống ghi chú cuối 0021) — cần chốt nghiệp vụ + một migration
-- riêng. Riêng reconciliation_runs có sẵn câu "chỉ chủ + admin xem" ở phần
-- comment cuối file, bật khi làm role-based RLS.
--
-- ⚠️ TIỀN KIỂM (như 0021): mọi máy đang dùng đăng nhập được; còn ít nhất một
-- admin đăng nhập được (thử NGAY trước khi chạy); không thiết bị nào chạy bản
-- cũ thiếu màn đăng nhập. Chạy khi còn thiếu ⇒ 401 toàn bộ (không mất dữ liệu).
--
-- SAU KHI CHẠY — kiểm chứng (không còn dòng nào chứa 'anon' cho 5 bảng này):
--   select tablename, policyname, roles from pg_policies
--   where schemaname = 'public'
--     and tablename in ('nxt_snapshots','monthly_stock_ledger',
--                       'reconciliation_runs','storage_locations','lot_inputs')
--   order by tablename;
--
-- Idempotent: chạy lại nhiều lần vẫn ra cùng kết quả.
-- Câu lùi: khối ROLLBACK cuối file (mở lại cho anon — CHỈ dùng khi cháy).
-- ============================================================

do $$
declare
  t text;
  ds text[] := array[
    'nxt_snapshots',
    'monthly_stock_ledger',
    'reconciliation_runs',
    'storage_locations',
    'lot_inputs'
  ];
begin
  foreach t in array ds loop
    -- Bảng chưa tồn tại (máy chủ chưa chạy hết migration cũ) thì bỏ qua, đừng
    -- để cả file gãy giữa chừng.
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'Bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Gỡ policy mở của giai đoạn chưa đăng nhập, theo mọi lối đặt tên đã dùng.
    execute format('drop policy if exists %I on public.%I', t || '_toan_quyen', t);
    execute format('drop policy if exists %I on public.%I', t || '_nguoi_dung', t);
    execute format('drop policy if exists %I on public.%I', t || '_cua_toi', t);

    execute format(
      'create policy %I on public.%I for all to authenticated
       using ((select auth.uid()) is not null)
       with check ((select auth.uid()) is not null)',
      t || '_nguoi_dung', t);

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Chặn thêm ở tầng schema (an toàn để chạy lại; 0021 đã làm nhưng lặp lại vô hại).
revoke usage on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ============================================================
-- (TÙY CHỌN) reconciliation_runs — CHỈ chủ + admin xem, bật khi làm role-based
-- RLS. Thay policy `_nguoi_dung` ở trên bằng khối này. Cần đọc vai trò từ
-- user_profiles.roles (CSV) nên phức tạp hơn — để nguyên comment tới khi chốt.
--
--   drop policy if exists reconciliation_runs_nguoi_dung on public.reconciliation_runs;
--   create policy reconciliation_runs_cua_toi on public.reconciliation_runs
--     for all to authenticated
--     using (
--       user_id = (select auth.uid())::text
--       or exists (
--         select 1 from public.user_profiles p
--         where p.id = (select auth.uid())::text
--           and position('admin' in coalesce(p.roles, '')) > 0
--       )
--     )
--     with check (user_id = (select auth.uid())::text);
-- ============================================================

-- ============================================================
-- ROLLBACK — CHỈ khi siết xong mà không làm việc được. Mở lại = KHÔNG an toàn.
--
-- grant usage on schema public to anon;
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['nxt_snapshots','monthly_stock_ledger',
--       'reconciliation_runs','storage_locations','lot_inputs'] loop
--     execute format('drop policy if exists %I on public.%I', t || '_nguoi_dung', t);
--     execute format(
--       'create policy %I on public.%I for all to anon, authenticated
--        using (true) with check (true)', t || '_toan_quyen', t);
--     execute format('grant all on public.%I to anon', t);
--   end loop;
-- end $$;
-- ============================================================
