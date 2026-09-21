-- ============================================================
-- Baseafood MES — 0048: GHI VẾT sửa/xóa ĐI THẲNG SQL (backstop cho audit_log)
--
-- 🟡 YELLOW. Chỉ THÊM 1 hàm + trigger AFTER ROW trên các bảng sổ sách.
-- KHÔNG chặn, KHÔNG đổi dữ liệu, KHÔNG đụng luồng ghi bù / mở lại ngày.
--
-- Vì sao: nhật ký thao tác (0025) do APP ghi tại chốt `useBang.ghi` — mọi sửa
-- đi qua SQL Editor / psql (VD fix swap ngày 31/08↔01/09 hôm 2026-09-10) KHÔNG
-- để lại vết, phải re-log tay. Audit PO 2026-09-21 (P1-6) đề xuất backstop DB.
--
-- QUYẾT ĐỊNH chủ dự án 2026-09-21 (chốt phạm vi Sprint 2):
--   • KHÔNG khóa cứng bản ghi đã chốt ở DB — "vẫn có trường hợp mở ra sửa theo
--     yêu cầu" ⇒ trigger này CHỈ GHI VẾT, không raise.
--   • Phân quyền theo vai trò ở DB: HOÃN, cấu hình khi cần. Chỉ BSF1 ⇒ không
--     ràng site_id.
--
-- Cách phân biệt đường đi: PostgREST (app) luôn set GUC `request.jwt.claims`
-- cho mỗi request (kể cả anon). SQL Editor / psql / cron KHÔNG có GUC này.
--   → có claims  ⇒ app đã tự log (0025) ⇒ trigger THOÁT NGAY (1 lần current_setting,
--                  không ảnh hưởng hiệu năng ghi thường ngày).
--   → không có   ⇒ sửa trực tiếp ⇒ ghi 1 dòng audit_log cho MỖI dòng bị đụng.
--
-- Dòng log dùng ĐÚNG từ vựng action cũ `them | sua | xoa` (bộ lọc màn /audit
-- chạy y nguyên); nguồn nhận ra qua `device_id = 'sql-editor'`, `actor_username =
-- 'sql:<current_user>'`, summary có tiền tố "[SQL trực tiếp]". `diff` cùng dạng
-- app: sửa = {cột: [trước, sau]} (chỉ cột đổi), thêm = {_new: dòng}, xóa = {_old: dòng}.
--
-- Hàm là SECURITY DEFINER (chủ = tài khoản chạy migration) để ghi được vào
-- audit_log dưới RLS append-only của 0025; search_path khóa 'public'.
--
-- Idempotent: drop trigger if exists rồi tạo lại; hàm create or replace.
-- Câu lùi: khối ROLLBACK cuối file.
-- ============================================================

create or replace function public.ghi_vet_sua_truc_tiep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims  text;
  moi     jsonb;
  cu      jsonb;
  d       jsonb;
  k       text;
  hanh    text;
  khoa    text;
  site    text;
  tom     text;
begin
  -- Qua API (app) ⇒ app đã ghi nhật ký ở tầng useBang — không log đôi.
  claims := current_setting('request.jwt.claims', true);
  if claims is not null and claims <> '' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    moi := to_jsonb(new); cu := null;
    hanh := 'them'; d := jsonb_build_object('_new', moi);
  elsif tg_op = 'UPDATE' then
    moi := to_jsonb(new); cu := to_jsonb(old);
    hanh := 'sua'; d := '{}'::jsonb;
    for k in select jsonb_object_keys(moi) loop
      continue when k = 'updated_at'; -- trigger cap_nhat_thoi_diem_sua đổi cột này mỗi lần — không phải sửa nghiệp vụ
      if (moi -> k) is distinct from (cu -> k) then
        d := d || jsonb_build_object(k, jsonb_build_array(cu -> k, moi -> k));
      end if;
    end loop;
    if d = '{}'::jsonb then
      return null; -- UPDATE không đổi gì (VD updated_at trigger chạy không) ⇒ bỏ qua
    end if;
  else
    moi := null; cu := to_jsonb(old);
    hanh := 'xoa'; d := jsonb_build_object('_old', cu);
  end if;

  khoa := coalesce(moi ->> 'id', cu ->> 'id', '');
  site := coalesce(moi ->> 'site_id', cu ->> 'site_id', 'bsf1');
  -- site_id có FK sang sites; bảng không có site hoặc site lạ thì neo về bsf1.
  if not exists (select 1 from public.sites s where s.id = site) then
    site := 'bsf1';
  end if;

  tom := format('[SQL trực tiếp] %s %s %s bởi %s',
                hanh, tg_table_name, khoa, current_user);

  insert into public.audit_log
    (id, site_id, at, actor_id, actor_username, action, entity, entity_key, summary, diff, device_id)
  values
    (gen_random_uuid()::text, site, now(), '', 'sql:' || current_user, hanh,
     tg_table_name, khoa, tom, d, 'sql-editor');

  return null;
end
$$;

comment on function public.ghi_vet_sua_truc_tiep() is
  'Backstop audit_log: ghi vết INSERT/UPDATE/DELETE đi thẳng SQL (không qua PostgREST). Không chặn. Migration 0048.';

do $$
declare
  t text;
  ds text[] := array[
    -- danh mục
    'sites', 'suppliers', 'material_types', 'finished_goods', 'products',
    'customers', 'warehouses', 'storage_locations',
    -- sổ nhập hàng
    'import_shipments', 'material_imports', 'daily_locks', 'scraps',
    -- kỳ cân đối
    'balancing_periods', 'balancing_inputs', 'balancing_outputs',
    -- bán hàng
    'sales_invoices', 'sales_items',
    -- sản xuất BTP + kho + đơn đặt + lệnh xuất + đóng gói + truy xuất lô
    'production_wips', 'production_locks', 'packagings', 'sales_orders', 'order_items',
    'export_orders', 'export_items', 'lot_inputs',
    -- QC
    'qc_checklists', 'qc_locks',
    -- tồn đầu + sổ kho + snapshot
    'material_opening_stock', 'finished_goods_opening_stock',
    'monthly_stock_ledger', 'nxt_snapshots',
    -- người dùng (đổi vai trò bằng SQL cũng phải có vết)
    'user_profiles'
    -- KHÔNG: audit_log (tự ghi chính nó ⇒ đệ quy), reconciliation_runs (file base64 lớn, diff vô nghĩa)
  ];
begin
  foreach t in array ds loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'Bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;
    execute format('drop trigger if exists ghi_vet_sql_tg on public.%I', t);
    execute format(
      'create trigger ghi_vet_sql_tg
         after insert or update or delete on public.%I
         for each row execute function public.ghi_vet_sua_truc_tiep()', t);
  end loop;
end $$;

-- ============================================================
-- KIỂM CHỨNG sau khi chạy (SQL Editor — chính là đường "không có claims"):
--   update public.suppliers set note = coalesce(note,'') where false;  -- không đổi gì ⇒ không log
--   select at, actor_username, action, entity, entity_key, summary, device_id
--   from public.audit_log where device_id = 'sql-editor' order by at desc limit 20;
-- Thử sửa 1 dòng thật ⇒ phải thấy đúng 1 dòng log với diff {cột:[trước,sau]}.
-- Thao tác từ APP (đã đăng nhập) ⇒ KHÔNG sinh dòng 'sql-editor' (app tự log như cũ).
-- ============================================================

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment:
--
-- do $$
-- declare t text;
-- begin
--   for t in select event_object_table from information_schema.triggers
--            where trigger_schema = 'public' and trigger_name = 'ghi_vet_sql_tg'
--            group by event_object_table loop
--     execute format('drop trigger if exists ghi_vet_sql_tg on public.%I', t);
--   end loop;
-- end $$;
-- drop function if exists public.ghi_vet_sua_truc_tiep();
-- ============================================================
