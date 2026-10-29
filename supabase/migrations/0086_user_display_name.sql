-- ============================================================
-- Baseafood MES — 0086: TÊN GỌI (NICKNAME) CỦA NGƯỜI DÙNG — tách khỏi họ tên ghi sổ
--
-- Vì sao (2026-10-29, ba-spec 47): người dùng muốn được gọi bằng tên khác họ tên (vd. kế toán
-- `nnttruc` muốn là "Alley"). Sửa thẳng `full_name` thì hỏng: phạm vi `own` (app + trigger 0065)
-- so người ghi với `[full_name, username]` ⇒ mất quyền sửa sổ cũ của chính mình; sổ một người
-- hai tên; chứng từ kế toán phải mang họ tên thật. ⇒ thêm cột tên gọi RIÊNG, chỉ để gọi / nhận
-- diện người; ghi sổ, nhật ký, phân quyền, chữ ký vẫn dùng `full_name`.
--
-- Làm gì:
--   1. `user_profiles.display_name` text, mặc định '' (= không có tên gọi). Chỉ thêm.
--   2. Hàm `set_own_display_name(tên)` security definer: người đang đăng nhập tự đặt tên gọi của
--      CHÍNH MÌNH. Policy `user_profiles_sua` (0057) chỉ cho admin sửa ⇒ hàm này là đường DUY NHẤT
--      người thường ghi được, và chỉ ghi đúng cột `display_name` của dòng `id = auth.uid()`.
--      Kiểm (R5): cắt khoảng trắng; ≤ 30 ký tự; không trùng họ tên / tên gọi của người KHÁC cùng
--      site (không phân biệt hoa thường — app kiểm thêm bỏ dấu); bằng chính họ tên mình ⇒ lưu ''.
--      Trả tên gọi đã lưu. Admin sửa tên gọi người khác qua form hồ sơ (policy admin sẵn có).
-- KHÔNG đổi policy, KHÔNG đổi trigger 0065 (`identities` vẫn chỉ full_name + username — R4).
-- Idempotent (`add column if not exists`, `create or replace`).
-- ⚠ Chưa chạy ⇒ app dò không thấy cột `display_name` ở hồ sơ đọc về ⇒ ẩn ô tên gọi, không gửi
--   cột (không kẹt hàng chờ); mọi người hiện họ tên như cũ.
-- ROLLBACK cuối file.
-- ============================================================

alter table public.user_profiles add column if not exists display_name text not null default '';

create or replace function public.set_own_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := (select auth.uid())::text;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_site text;
  v_full_name text;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  select up.site_id, up.full_name into v_site, v_full_name
    from public.user_profiles up where up.id = v_uid;
  if not found then
    raise exception 'Tài khoản chưa có hồ sơ' using errcode = 'P0002';
  end if;
  if char_length(v_name) > 30 then
    raise exception 'Tên gọi tối đa 30 ký tự' using errcode = '22001';
  end if;
  if lower(v_name) = lower(btrim(coalesce(v_full_name, ''))) then
    v_name := '';
  end if;
  if v_name <> '' and exists (
    select 1 from public.user_profiles up
     where up.site_id = v_site and up.id <> v_uid
       and (lower(btrim(up.full_name)) = lower(v_name) or lower(btrim(up.display_name)) = lower(v_name))
  ) then
    raise exception 'Tên gọi trùng họ tên hoặc tên gọi của người khác' using errcode = '23505';
  end if;
  update public.user_profiles set display_name = v_name where id = v_uid;
  return v_name;
end;
$$;

revoke all on function public.set_own_display_name(text) from public, anon;
grant execute on function public.set_own_display_name(text) to authenticated;

-- KIỂM sau khi chạy (chỉ đọc):
--   select column_name, column_default from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'display_name';
--   select proname, prosecdef from pg_proc where proname = 'set_own_display_name';   -- prosecdef = true
--   select username, full_name, display_name from public.user_profiles where display_name <> '';

-- ============================================================
-- ROLLBACK — mất các tên gọi đã đặt (họ tên + sổ không đổi):
--   drop function if exists public.set_own_display_name(text);
--   alter table public.user_profiles drop column if exists display_name;
-- ============================================================
