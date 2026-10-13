-- ============================================================
-- Baseafood MES — 0060: TÊN POLICY RLS sang tiếng Anh (Đợt 5f)
--
-- 🔴 RED (chủ dự án duyệt 2026-10-13, tự chạy ở SQL Editor sau 0059).
-- Quy ước: docs/spec/quy-uoc-dat-ten.md §5 Đợt 5f — policy `<table>_<quyền>`.
--
-- CHỈ ĐỔI TÊN (alter policy … rename to). KHÔNG đổi điều kiện, vai trò hay lệnh của
-- policy nào ⇒ quyền đọc/ghi giữ nguyên tuyệt đối. App không gọi policy theo tên.
--
-- Luật: policy ở schema public có tên kết thúc bằng một hậu tố tiếng Việt dưới đây
-- được đặt lại thành `<tên bảng hiện tại>_<hậu tố tiếng Anh>` (tiền tố tên bảng cũ
-- trước 0016 — vd `nguoi_dung_toan_quyen` trên user_profiles — cũng được sửa luôn):
--   _nguoi_dung → _authenticated   _toan_quyen → _full_access   _cua_toi → _own_rows
--   _them → _insert   _sua → _update   _xoa → _delete   _xem → _select   _doc → _read
-- Tên mới đã có sẵn trên cùng bảng ⇒ bỏ qua (raise notice), không ghi đè.
-- Policy Storage (storage.objects) không đụng.
--
-- Mỗi policy được đổi giữ tên cũ trong COMMENT ("0060 renamed from <tên cũ>") để
-- khối ROLLBACK đổi ngược chính xác.
--
-- Idempotent: chạy lại không còn tên tiếng Việt nào khớp ⇒ không làm gì.
--
-- ⚠ Sau 0060, ĐỪNG chạy lại 0021 / 0047 / 0057 (chúng `drop if exists` tên cũ rồi
-- tạo lại tên cũ ⇒ bảng có 2 policy song song). Cần chạy lại thì chạy 0060 ngay sau.
-- ============================================================

do $$
declare
  r record;
  s record;
  newname text;
  n int := 0;
begin
  for r in
    select p.oid, c.relname as tablename, p.polname as policyname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
    order by c.relname, p.polname
  loop
    newname := null;
    for s in
      select * from (values
        ('nguoi_dung', 'authenticated'), ('toan_quyen', 'full_access'), ('cua_toi', 'own_rows'),
        ('them', 'insert'), ('sua', 'update'), ('xoa', 'delete'), ('xem', 'select'), ('doc', 'read')
      ) as v(vi, en)
    loop
      if right(r.policyname, length(s.vi) + 1) = '_' || s.vi then
        newname := r.tablename || '_' || s.en;
        exit;
      end if;
    end loop;

    continue when newname is null or newname = r.policyname;

    if exists (
      select 1 from pg_policy p2
      where p2.polrelid = (select polrelid from pg_policy where oid = r.oid) and p2.polname = newname
    ) then
      raise notice 'Bỏ qua %.%: đã có policy tên %', r.tablename, r.policyname, newname;
      continue;
    end if;

    execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, newname);
    execute format('comment on policy %I on public.%I is %L',
                   newname, r.tablename, '0060 renamed from ' || r.policyname);
    raise notice 'Đổi %.% → %', r.tablename, r.policyname, newname;
    n := n + 1;
  end loop;
  raise notice '0060: đổi tên % policy', n;
end $$;

-- Kiểm sau khi chạy (phải ra 0 dòng):
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and policyname ~ '_(nguoi_dung|toan_quyen|cua_toi|them|sua|xoa|xem|doc)$';

-- ============================================================
-- ROLLBACK — đổi ngược đúng những policy 0060 đã đổi (đọc tên cũ trong COMMENT):
--
-- do $$
-- declare r record;
-- begin
--   for r in
--     select c.relname as tablename, p.polname as policyname,
--            substring(obj_description(p.oid, 'pg_policy') from '^0060 renamed from (.+)$') as oldname
--     from pg_policy p
--     join pg_class c on c.oid = p.polrelid
--     join pg_namespace ns on ns.oid = c.relnamespace
--     where ns.nspname = 'public' and obj_description(p.oid, 'pg_policy') like '0060 renamed from %'
--   loop
--     execute format('comment on policy %I on public.%I is null', r.policyname, r.tablename);
--     execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, r.oldname);
--   end loop;
-- end $$;
-- ============================================================
