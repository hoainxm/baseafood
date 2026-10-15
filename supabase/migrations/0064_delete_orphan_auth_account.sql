-- ============================================================
-- Baseafood MES — 0064: XÓA TÀI KHOẢN ĐĂNG NHẬP CHƯA CÓ HỒ SƠ (mồ côi) — có kiểm dữ liệu trước
--
-- Vì sao (2026-10-15): sau sự cố tài khoản trùng (0063), còn lại các tài khoản Auth
-- bỏ đi (VD `nnt.truc@`, `ttm.hanh@`) — không hồ sơ, không vào được, chỉ làm rối
-- danh sách. Admin cần dọn ngay trên app thay vì vào Supabase Dashboard, NHƯNG phải
-- thấy trước tài khoản đó đã để lại gì trong hệ thống.
--
-- Làm gì — 2 hàm `security definer`, CHỈ admin (kiểm `la_admin()` bên trong, 0057):
--   orphan_account_usage(p_user_id)   báo cáo dữ liệu liên quan, mỗi dòng một loại:
--       CHẶN XÓA (blocking = true) — còn thứ gắn CỨNG với id tài khoản:
--         profile          đã có hồ sơ user_profiles (không còn là mồ côi)
--         self             chính admin đang thao tác
--         user_permissions còn quyền riêng (0062)
--         reconciliation   bản đối soát HĐĐT đứng tên tài khoản (user_id)
--         storage          file trên Storage do tài khoản tải lên (owner / owner_id)
--       CHỈ BÁO (blocking = false) — lịch sử ghi bằng chữ, xóa tài khoản KHÔNG mất:
--         audit_log        nhật ký thao tác (actor_id) — giữ nguyên làm lịch sử
--         row_marks        dấu tô màu (marked_by = tên đăng nhập)
--         operator:<bảng>  dòng sổ ghi "người ghi" bằng họ tên / tên đăng nhập
--                          (họ tên có thể trùng tài khoản khác của cùng người)
--         recent_sign_in   đăng nhập trong 30 ngày qua — có thể đang được dùng
--         active_session   còn phiên đăng nhập hoạt động trong 30 ngày (phiên tự gia hạn
--                          KHÔNG cập nhật last_sign_in_at — chạy khô 2026-10-15: tài khoản
--                          "đăng nhập cuối 10/08" vẫn ghi nhật ký tới 06/10)
--         recent_activity  có nhật ký thao tác trong 30 ngày qua
--   delete_orphan_auth_account(p_user_id)  tính lại báo cáo NGAY trong hàm; còn dòng
--       chặn ⇒ từ chối (liệt kê lý do); không thì xóa auth.users (Supabase tự xóa lan
--       identities / sessions / refresh tokens). KHÔNG đụng dữ liệu nghiệp vụ nào.
--
-- Không đổi bảng / cột / policy nào. 🔴 RED: xóa auth.users KHÔNG hoàn tác được
-- (tạo lại thì là tài khoản mới, id khác) — vì vậy hàm chỉ xóa tài khoản không có hồ
-- sơ và không còn dữ liệu gắn cứng, và app bắt xác nhận sau khi hiện báo cáo.
-- Idempotent (`create or replace`). ROLLBACK (bỏ hàm, KHÔNG khôi phục tài khoản đã xóa)
-- ở cuối file.
-- ============================================================

create or replace function public.orphan_account_usage(p_user_id text)
returns table (category text, label text, row_count bigint, last_at timestamptz, blocking boolean)
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
#variable_conflict use_column
declare
  v_username text;
  v_full_name text;
  v_last_sign_in timestamptz;
  v_table text;
  v_count bigint;
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được xem dữ liệu của tài khoản' using errcode = '42501';
  end if;

  select
    lower(coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(u.email::text, '@', 1))),
    coalesce(u.raw_user_meta_data ->> 'ho_ten', ''), -- naming-ok: khóa metadata Auth đã lưu (0006)
    u.last_sign_in_at
  into v_username, v_full_name, v_last_sign_in
  from auth.users u where u.id::text = p_user_id;
  if not found then
    raise exception 'Không thấy tài khoản đăng nhập %', p_user_id using errcode = '22023';
  end if;

  -- ---- CHẶN XÓA ----
  return query select 'profile'::text, 'Đã có hồ sơ người dùng'::text, count(*), null::timestamptz, true
    from public.user_profiles p where p.id = p_user_id having count(*) > 0;

  if (select auth.uid())::text = p_user_id then
    return query select 'self'::text, 'Là tài khoản đang đăng nhập'::text, 1::bigint, null::timestamptz, true;
  end if;

  if to_regclass('public.user_permissions') is not null then
    execute 'select count(*) from public.user_permissions where user_id = $1' into v_count using p_user_id;
    if v_count > 0 then
      return query select 'user_permissions'::text, 'Quyền riêng của tài khoản'::text, v_count, null::timestamptz, true;
    end if;
  end if;

  return query select 'reconciliation'::text, 'Bản đối soát hóa đơn đứng tên'::text, count(*), max(r.updated_at), true
    from public.reconciliation_runs r where r.user_id = p_user_id having count(*) > 0;

  return query select 'storage'::text, 'File đã tải lên (ảnh phiếu, ảnh QC…)'::text, count(*), max(o.created_at), true
    from storage.objects o where o.owner::text = p_user_id or o.owner_id = p_user_id having count(*) > 0;

  -- ---- CHỈ BÁO ----
  return query select 'audit_log'::text, 'Dòng nhật ký thao tác (giữ nguyên làm lịch sử)'::text, count(*), max(a.created_at), false
    from public.audit_log a where a.actor_id = p_user_id having count(*) > 0;

  if v_username <> '' then
    return query select 'row_marks'::text, 'Dấu tô màu dòng ghi theo tên đăng nhập'::text, count(*), max(m.marked_at), false
      from public.row_marks m where lower(m.marked_by) = v_username having count(*) > 0;
  end if;

  foreach v_table in array array['import_shipments', 'production_wips', 'lot_inputs', 'lot_dispatches', 'lot_waivers', 'domestic_sales', 'label_prints'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'select count(*) from public.%I where operator <> '''' and (lower(operator) = $1 or (operator = $2 and $2 <> ''''))',
        v_table)
      into v_count using v_username, v_full_name;
      if v_count > 0 then
        return query select ('operator:' || v_table)::text,
          ('Dòng sổ ghi người ghi = ' || coalesce(nullif(v_full_name, ''), v_username) || ' (ghi bằng chữ, vẫn giữ)')::text,
          v_count, null::timestamptz, false;
      end if;
    end if;
  end loop;

  if v_last_sign_in is not null and v_last_sign_in > now() - interval '30 days' then
    return query select 'recent_sign_in'::text, 'Đăng nhập trong 30 ngày qua — có thể vẫn đang được dùng'::text,
      1::bigint, v_last_sign_in, false;
  end if;

  return query select 'active_session'::text, 'Phiên đăng nhập còn hoạt động trong 30 ngày (máy nào đó vẫn đang mở)'::text,
      count(*), max(coalesce(ss.refreshed_at::timestamptz, ss.updated_at)), false
    from auth.sessions ss
   where ss.user_id::text = p_user_id
     and coalesce(ss.refreshed_at::timestamptz, ss.updated_at, ss.created_at) > now() - interval '30 days'
  having count(*) > 0;

  return query select 'recent_activity'::text, 'Có thao tác ghi nhật ký trong 30 ngày qua'::text, count(*), max(a.created_at), false
    from public.audit_log a
   where a.actor_id = p_user_id and a.created_at > now() - interval '30 days'
  having count(*) > 0;
end;
$$;

create or replace function public.delete_orphan_auth_account(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  v_blockers text;
begin
  if not public.la_admin() then -- naming-ok: hàm 0057
    raise exception 'Chỉ quản trị viên được xóa tài khoản' using errcode = '42501';
  end if;
  -- Tính lại NGAY lúc xóa (báo cáo admin xem có thể đã cũ).
  select string_agg(u.label || ' (' || u.row_count || ')', '; ')
    into v_blockers
    from public.orphan_account_usage(p_user_id) u
   where u.blocking;
  if v_blockers is not null then
    raise exception 'Không xóa được tài khoản: %', v_blockers using errcode = '23503';
  end if;
  delete from auth.users where id::text = p_user_id;
end;
$$;

revoke all on function public.orphan_account_usage(text) from public, anon;
revoke all on function public.delete_orphan_auth_account(text) from public, anon;
grant execute on function public.orphan_account_usage(text) to authenticated;
grant execute on function public.delete_orphan_auth_account(text) to authenticated;

-- KIỂM sau khi chạy:
--   select proname, prosecdef from pg_proc where proname in ('orphan_account_usage','delete_orphan_auth_account');
--   (SQL Editor không có auth.uid() ⇒ la_admin() = false ⇒ gọi hàm báo 42501 — đúng.)

-- ============================================================
-- ROLLBACK — bỏ 2 hàm (app ẩn nút Xóa). Tài khoản ĐÃ xóa thì KHÔNG khôi phục được.
--   drop function if exists public.delete_orphan_auth_account(text);
--   drop function if exists public.orphan_account_usage(text);
-- ============================================================
