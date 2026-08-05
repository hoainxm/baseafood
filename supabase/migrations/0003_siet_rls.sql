-- ============================================================
-- Siết RLS: thu hồi quyền của `anon`, chỉ cho người đã đăng nhập.
--
-- ⚠️ CHỈ CHẠY SAU KHI app đã có màn đăng nhập Supabase Auth.
-- Chạy sớm hơn thì app đang dùng anon key sẽ đọc/ghi không được nữa
-- (mọi truy vấn trả về rỗng hoặc lỗi 401) — không mất dữ liệu, nhưng
-- người dùng không làm việc được cho tới khi có đăng nhập.
--
-- Vì sao phải chạy:
--   Anon key nằm trong bundle JS, ai mở DevTools cũng lấy được. Khi policy
--   còn `to anon using (true)` thì bất kỳ ai có key đó đều ĐỌC VÀ SỬA được
--   toàn bộ số liệu sản xuất. Trước khi app rời khỏi mạng nội bộ xí nghiệp,
--   file này là bắt buộc.
--
-- Kiểm tra sau khi chạy (phải KHÔNG còn dòng nào có roles chứa 'anon'):
--   select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' order by tablename;
-- ============================================================

-- Danh mục: người đăng nhập nào cũng đọc được; sửa cũng vậy (giai đoạn đầu
-- chưa phân vai). Tách riêng để sau này siết thêm theo vai trò dễ hơn.
do $$
declare t text;
begin
  foreach t in array array[
    'dai_ly','loai_nguyen_lieu','thanh_pham','mat_hang','khach_hang',
    'nhap_nguyen_lieu','chuyen_nhap','chot_ngay',
    'ky_can_doi','nguyen_lieu_vao','phe_lieu','thanh_pham_ra'
  ] loop
    -- Bỏ policy mở của giai đoạn chưa đăng nhập
    execute format('drop policy if exists %I on public.%I', t || '_toan_quyen', t);

    execute format(
      'create policy %I on public.%I for all to authenticated
       using ((select auth.uid()) is not null)
       with check ((select auth.uid()) is not null)',
      t || '_nguoi_dung', t);

    -- Chặn triệt để ở tầng quyền, không chỉ tầng policy
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

drop policy if exists xi_nghiep_doc on public.xi_nghiep;
create policy xi_nghiep_doc on public.xi_nghiep
  for select to authenticated using (true);
revoke all on public.xi_nghiep from anon;

-- ============================================================
-- Bước tiếp theo (chưa làm, cần thiết kế cùng nghiệp vụ):
--   • Phân vai: tổ trưởng chỉ ghi được xưởng mình; kế toán đọc tất cả,
--     sửa kỳ cân đối; giám đốc chỉ đọc.
--   • Ràng buộc theo xi_nghiep_id của người đăng nhập thay vì cho xem hết.
--   • Không cho xóa bản ghi đã chốt sổ — chuyển sang cờ trạng thái.
-- ============================================================
