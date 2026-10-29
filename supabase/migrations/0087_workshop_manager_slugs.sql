-- ============================================================
-- Baseafood MES — 0087: ĐỔI SLUG QUẢN ĐỐC XƯỞNG sang tiếng Anh có nghĩa
--
-- Vì sao (2026-10-29, chủ dự án): `manager-dong` / `manager-ca` / `manager-kho` chỉ là "manager" + tên xưởng
-- không dấu — không đọc ra "quản đốc PHÂN XƯỞNG", `kho` còn lẫn với kho hàng. Đổi theo nghĩa xưởng (khớp mã
-- phòng ban đã có `production-frozen/fish/dried`, 0072):
--   manager-dong → frozen-workshop-manager (Quản đốc xưởng Đông)
--   manager-ca   → fish-workshop-manager   (Quản đốc xưởng Cá)
--   manager-kho  → dried-workshop-manager  (Quản đốc xưởng Khô)
-- `vice-manager` (Phó quản đốc) GIỮ.
--
-- Làm gì (chỉ đổi khóa, KHÔNG đổi quyền nào):
--   1. `normalize_role_slug`: slug cũ (`quan-doc-*` lẫn `manager-*`) ⇒ slug mới — dữ liệu / bản sao lưu cũ đọc đúng.
--   2. `default_role_permissions.role_id`, `role_permissions.role_id`, `app_roles.id`: đổi cũ sang mới.
--   3. `user_profiles.roles` (CSV): thay đúng từng phần tử slug cũ.
--   4. Dựng lại `current_permission_context` (xưởng theo vai trò — phạm vi `workshop`) và
--      `current_user_departments` (phòng ban xem tài liệu): thân hàm chép NGUYÊN bản mới nhất (0065 / 0079),
--      chỉ thay 3 slug.
-- ⚠ THỨ TỰ: chạy SAU 0083 (0083 xóa trắng rồi chèn lại `default_role_permissions` bằng slug cũ). Lỡ chạy 0083
--   (hay file nào chèn lại ma trận) SAU 0087 ⇒ chạy lại 0087 (idempotent).
-- ⚠ App mới chạy được cả khi CHƯA chạy 0087 (app tự quy đổi slug cũ); nhưng admin gán vai trò quản đốc trên app
--   sẽ ghi slug MỚI mà máy chủ chưa biết ⇒ chạy 0087 ngay sau deploy.
-- ROLLBACK cuối file.
-- ============================================================

-- ---------- 1. quy đổi slug ----------
create or replace function public.normalize_role_slug(p text)
returns text language sql immutable as $$
  select case btrim(p)
    when 'giam-doc' then 'director' -- naming-ok: giá trị cũ đã lưu trong user_profiles.roles
    when 'pho-giam-doc' then 'vice-director' -- naming-ok
    when 'quan-doc-dong' then 'frozen-workshop-manager' -- naming-ok
    when 'quan-doc-ca' then 'fish-workshop-manager' -- naming-ok
    when 'quan-doc-kho' then 'dried-workshop-manager' -- naming-ok
    when 'manager-dong' then 'frozen-workshop-manager' -- naming-ok: slug trước 0087
    when 'manager-ca' then 'fish-workshop-manager' -- naming-ok: slug trước 0087
    when 'manager-kho' then 'dried-workshop-manager' -- naming-ok: slug trước 0087
    when 'pho-quan-doc' then 'vice-manager' -- naming-ok
    when 'ke-toan' then 'accountant' -- naming-ok
    when 'ke-toan-truong' then 'chief-accountant' -- naming-ok
    when 'to-truong' then 'team-leader' -- naming-ok
    when 'thu-kho' then 'warehouse-keeper' -- naming-ok
    when 'nhap-hang' then 'warehouse-keeper' -- naming-ok
    else btrim(p)
  end
$$;

-- ---------- 2 + 3. ma trận, vai trò đã chỉnh, hồ sơ ----------
do $$
declare
  r record;
begin
  for r in select * from (values
      ('manager-dong', 'frozen-workshop-manager'),
      ('manager-ca', 'fish-workshop-manager'),
      ('manager-kho', 'dried-workshop-manager')) as m(old_id, new_id)
  loop
    update public.default_role_permissions set role_id = r.new_id where role_id = r.old_id;
    if to_regclass('public.role_permissions') is not null then
      update public.role_permissions set role_id = r.new_id where role_id = r.old_id;
    end if;
    if to_regclass('public.app_roles') is not null then
      update public.app_roles set id = r.new_id where id = r.old_id;
    end if;
    -- Thay đúng phần tử trong CSV (không đụng chuỗi con của slug khác).
    update public.user_profiles
       set roles = array_to_string(array(
             select case when btrim(x) = r.old_id then r.new_id else btrim(x) end
               from unnest(string_to_array(roles, ',')) x), ',')
     where r.old_id = any (string_to_array(replace(roles, ' ', ''), ','));
  end loop;
end $$;

-- ---------- 4. hàm theo vai trò ----------
create or replace function public.current_permission_context()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid text := (select auth.uid())::text;
  v_cached text;
  v_ctx jsonb;
  v_full_name text;
  v_username text;
  v_roles_csv text;
  v_roles text[];
  v_grants jsonb := '{}'::jsonb;
  v_workshops text[];
  r record;
  v_key text;
  v_old text;
begin
  if v_uid is null then
    return jsonb_build_object('system', true);
  end if;
  v_cached := current_setting('bsf.permission_context', true);
  if coalesce(v_cached, '') <> '' then
    v_ctx := v_cached::jsonb;
    if v_ctx->>'uid' = v_uid then return v_ctx; end if;
  end if;

  select up.full_name, up.username, up.roles into v_full_name, v_username, v_roles_csv
    from public.user_profiles up where up.id = v_uid;
  v_roles := array(
    select public.normalize_role_slug(x)
      from unnest(string_to_array(coalesce(v_roles_csv, ''), ',')) x
     where btrim(x) <> ''
  );

  if 'admin' = any(v_roles) then
    v_ctx := jsonb_build_object('uid', v_uid, 'admin', true);
  else
    -- Vai trò ĐÃ CHỈNH (có dòng app_roles) ⇒ role_permissions; còn lại ⇒ ma trận mặc định.
    for r in
      select rp.resource, rp.action, rp.scope
        from public.role_permissions rp
       where rp.role_id = any(v_roles)
         and exists (select 1 from public.app_roles ar where ar.id = rp.role_id)
      union all
      select d.resource, d.action, d.scope
        from public.default_role_permissions d
       where d.role_id = any(v_roles)
         and not exists (select 1 from public.app_roles ar where ar.id = d.role_id)
    loop
      v_key := r.resource || ':' || r.action;
      v_old := v_grants->>v_key;
      -- Hợp nhiều vai trò: phạm vi RỘNG nhất (all > workshop > own).
      if v_old is null
         or (r.scope = 'all')
         or (r.scope = 'workshop' and v_old = 'own') then
        v_grants := v_grants || jsonb_build_object(v_key, r.scope);
      end if;
    end loop;
    -- Chỉnh riêng: cho thêm, rồi chặn (chặn thắng); chặn Xem ⇒ gỡ mọi hành động tài nguyên đó.
    for r in select up.resource, up.action, up.effect, up.scope from public.user_permissions up where up.user_id = v_uid loop
      if r.effect = 'allow' then
        v_grants := v_grants || jsonb_build_object(r.resource || ':' || r.action, coalesce(nullif(r.scope, ''), 'all'));
      end if;
    end loop;
    for r in select up.resource, up.action from public.user_permissions up where up.user_id = v_uid and up.effect = 'deny' loop
      if r.action = 'view' then
        v_grants := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(v_grants) e(k, v) where k not like r.resource || ':%');
      else
        v_grants := v_grants - (r.resource || ':' || r.action);
      end if;
    end loop;
    v_workshops := array(
      select case x when 'frozen-workshop-manager' then 'Đông' when 'fish-workshop-manager' then 'Cá' when 'dried-workshop-manager' then 'Khô' end
        from unnest(v_roles) x where x in ('frozen-workshop-manager', 'fish-workshop-manager', 'dried-workshop-manager')
    );
    v_ctx := jsonb_build_object(
      'uid', v_uid,
      'admin', false,
      'grants', v_grants,
      'workshops', to_jsonb(v_workshops),
      'identities', to_jsonb(array_remove(array[btrim(coalesce(v_full_name, '')), btrim(coalesce(v_username, ''))], '')),
      'username', coalesce(v_username, '')
    );
  end if;
  perform set_config('bsf.permission_context', v_ctx::text, true); -- chỉ trong giao dịch này
  return v_ctx;
end;
$$;

create or replace function public.current_user_departments()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with my_roles as (
    select public.normalize_role_slug(x) as role_id
      from public.user_profiles up,
           unnest(string_to_array(coalesce(up.roles, ''), ',')) x
     where up.id = (select auth.uid())::text
       and btrim(x) <> ''
  ),
  custom as (
    select r.role_id, btrim(ar.department) as department
      from my_roles r
      join public.app_roles ar on ar.id = r.role_id
     where coalesce(btrim(ar.department), '') <> ''
  ),
  defaults as (
    select unnest(case r.role_id
             when 'director' then array['board']
             when 'vice-director' then array['board']
             when 'chief-accountant' then array['accounting']
             when 'accountant' then array['accounting']
             when 'warehouse-keeper' then array['purchasing', 'warehouse']
             when 'frozen-workshop-manager' then array['production-frozen']
             when 'fish-workshop-manager' then array['production-fish']
             when 'dried-workshop-manager' then array['production-dried']
             when 'vice-manager' then array['production-frozen', 'production-fish', 'production-dried']
             when 'team-leader' then array['production-frozen', 'production-fish', 'production-dried']
             when 'planner' then array['planning']
             when 'planning-head' then array['planning']
             when 'planning-deputy' then array['planning']
             else array[]::text[]
           end) as department
      from my_roles r
     where not exists (select 1 from custom c where c.role_id = r.role_id)
  )
  select coalesce(array_agg(distinct d.department), array[]::text[])
    from (select department from custom union all select department from defaults) d
$$;

-- KIỂM sau khi chạy (chỉ đọc):
--   select role_id, count(*) from public.default_role_permissions where role_id like '%workshop-manager' group by 1;  -- 3 dòng
--   select count(*) from public.default_role_permissions where role_id in ('manager-dong','manager-ca','manager-kho');  -- 0
--   select username, roles from public.user_profiles where roles like '%workshop-manager%';
--   select public.normalize_role_slug('manager-dong'), public.normalize_role_slug('quan-doc-kho');

-- ============================================================
-- ROLLBACK — đổi ngược khóa; thân hàm cũ = chạy lại khối hàm tương ứng của 0065 (normalize_role_slug,
-- current_permission_context) và 0079 (current_user_departments):
--   update public.default_role_permissions set role_id = 'manager-dong' where role_id = 'frozen-workshop-manager';
--   update public.default_role_permissions set role_id = 'manager-ca' where role_id = 'fish-workshop-manager';
--   update public.default_role_permissions set role_id = 'manager-kho' where role_id = 'dried-workshop-manager';
--   (tương tự role_permissions.role_id, app_roles.id; user_profiles.roles thay phần tử ngược lại)
-- ============================================================
