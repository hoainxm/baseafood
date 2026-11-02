-- ============================================================
-- Baseafood MES — 0092: NHẬT KÝ THAO TÁC THEO NHÓM TRANG (khối "Nhật ký thao tác" trong hồ sơ)
--
-- Vì sao (2026-11-02, ba-spec docs/app-map/56-activity-log-groups.ba-spec.md, chủ dự án chốt Q1–Q4): hồ sơ HĐ
-- xuất khẩu đã có nhật ký (0079) — Trưởng / Phó phòng tra được ai làm gì. Các trang khác chưa có; muốn tra phải
-- nhờ admin mở /audit (chỉ "Sửa <bảng>" + trước → sau). Luật: MỖI NHÓM TRANG MỘT BẢNG nhật ký (nhóm = nhóm
-- trên thanh bên = `group` của tài nguyên quyền); nhóm Kế hoạch (Nhập khẩu · Lệnh sản xuất · Xuất khẩu) DÙNG
-- CHUNG bảng export_activity_log của 0079.
--
-- Làm gì:
--   1. export_activity_log (nhóm Kế hoạch) THÊM 4 cột: record_type (loại hồ sơ: export-contract · import-contract
--      · import-receipt · production-order), record_id, parent_type, parent_id. Dòng cũ = export-contract,
--      record_id = contract_id (điền bù). Thay 3 policy select / insert / update: dòng export-contract GIỮ NGUYÊN
--      điều kiện cũ; dòng Nhập khẩu theo import-plans (+ .receiving); dòng Lệnh sản xuất theo production-orders
--      (chỉ Xem ⇒ chỉ lệnh đã phát hành, qua RLS 0088). Policy delete (chỉ dòng site-demo) giữ nguyên.
--   2. 2 bảng MỚI cùng dạng: imports_activity_log (nhóm Nhập hàng: imports + imports.invoices),
--      production_activity_log (nhóm Sản xuất: wip + packaging). Hồ sơ của sổ theo ngày = ngày × phân xưởng
--      (record_type intake-day / production-day, record_id "yyyy-mm-dd|<xưởng>") — Q3.
--   3. Mọi bảng nhật ký: người ghi + giờ ghi do MÁY CHỦ đóng dấu, CHỈ THÊM (UPDATE trả dòng cũ), xóa chỉ dòng
--      site-demo — dùng lại 2 hàm trigger của 0079.
--
-- KHÔNG đụng: ma trận quyền (dùng lại imports / imports.invoices / wip / packaging / import-plans / production-orders
--   / export-plans), audit_log, dòng nhật ký cũ (chỉ điền bù 2 cột mới).
-- Mức độ rủi ro: 🔴 phần 1 ĐỔI RLS của bảng export_activity_log đang có số (dòng HĐ xuất giữ đúng điều kiện cũ,
--   chỉ MỞ cho 2 loại hồ sơ mới) · 🟡 phần 2–3 chỉ thêm bảng. Cần 0079, 0082, 0088 đã chạy.
-- ⚠ Chưa chạy ⇒ app vẫn chạy: khối nhật ký các trang mới không ghi (không kẹt hàng chờ), HĐ xuất ghi như cũ.
-- ROLLBACK cuối file. Idempotent (chạy 2 lần không lỗi).
-- ============================================================

-- ---------- 1. Nhóm Kế hoạch: mở rộng export_activity_log ----------
alter table public.export_activity_log add column if not exists record_type text not null default 'export-contract';
alter table public.export_activity_log add column if not exists record_id   text not null default '';
alter table public.export_activity_log add column if not exists parent_type text not null default '';
alter table public.export_activity_log add column if not exists parent_id   text not null default '';
-- Điền bù dòng cũ: hồ sơ = HĐ xuất. Trigger chỉ-thêm của 0079 trả dòng cũ ở MỌI UPDATE ⇒ tắt tạm cho đúng lệnh này.
alter table public.export_activity_log disable trigger export_activity_log_no_edit;
update public.export_activity_log set record_id = contract_id where record_type = 'export-contract' and record_id = '' and contract_id <> '';
alter table public.export_activity_log enable trigger export_activity_log_no_edit;
-- Dòng HĐ xuất app vẫn gửi dạng cũ (không có record_*) ⇒ máy chủ tự điền record_id = contract_id.
create or replace function public.export_activity_log_fill_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.record_type = 'export-contract' and coalesce(new.record_id, '') = '' then
    new.record_id := new.contract_id;
  end if;
  return new;
end;
$$;
revoke all on function public.export_activity_log_fill_record() from public, anon;
drop trigger if exists export_activity_log_fill_record on public.export_activity_log;
create trigger export_activity_log_fill_record before insert on public.export_activity_log
  for each row execute function public.export_activity_log_fill_record();
create index if not exists export_activity_log_record_idx on public.export_activity_log (site_id, record_type, record_id, created_at);
create index if not exists export_activity_log_parent_idx on public.export_activity_log (site_id, parent_type, parent_id, created_at);

do $$
declare
  -- Dòng HĐ xuất: ĐÚNG điều kiện của 0079.
  export_read text := $q$public.has_export_permission('export-plans', 'view')$q$;
  export_write text := $q$(public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
      or public.has_export_permission('export-plans', 'approve') or public.has_export_permission('export-plans.loading', 'create')
      or public.has_export_permission('export-plans.payments', 'create') or public.has_export_permission('export-plans.payments', 'update'))$q$;
  import_read text := $q$(public.has_export_permission('import-plans', 'view') or public.has_export_permission('import-plans.receiving', 'view'))$q$;
  import_write text := $q$(public.has_export_permission('import-plans', 'create') or public.has_export_permission('import-plans', 'update')
      or public.has_export_permission('import-plans.receiving', 'create') or public.has_export_permission('import-plans.receiving', 'update'))$q$;
  order_write text := $q$(public.has_export_permission('production-orders', 'create') or public.has_export_permission('production-orders', 'update'))$q$;
  -- Chỉ Xem Lệnh sản xuất ⇒ chỉ lệnh nơi nhận thấy được (RLS 0088 của production_orders áp vào truy vấn con).
  order_read text := $q$(public.has_export_permission('production-orders', 'view')
      and exists (select 1 from public.production_orders o where o.id = export_activity_log.record_id))$q$;
  r text; w text;
begin
  r := format('(record_type = ''export-contract'' and %s) or (record_type in (''import-contract'', ''import-receipt'') and %s) or (record_type = ''production-order'' and (%s or %s))',
              export_read, import_read, order_write, order_read);
  w := format('(record_type = ''export-contract'' and %s) or (record_type in (''import-contract'', ''import-receipt'') and %s) or (record_type = ''production-order'' and %s)',
              export_write, import_write, order_write);
  execute 'drop policy if exists export_activity_log_select on public.export_activity_log';
  execute 'drop policy if exists export_activity_log_insert on public.export_activity_log';
  execute 'drop policy if exists export_activity_log_update on public.export_activity_log';
  execute format('create policy export_activity_log_select on public.export_activity_log for select to authenticated using (%s)', r);
  execute format('create policy export_activity_log_insert on public.export_activity_log for insert to authenticated with check (%s)', w);
  -- Upsert của app cần policy update; trigger chỉ-thêm (0079) giữ nguyên dòng cũ ⇒ gửi lại không đổi gì.
  execute format('create policy export_activity_log_update on public.export_activity_log for update to authenticated using (%s) with check (%s)', w, w);
end $$;

-- ---------- 2. Bảng mới: nhóm Nhập hàng · nhóm Sản xuất ----------
do $$
declare
  t text;
  r text; w text;
begin
  foreach t in array array['imports_activity_log', 'production_activity_log'] loop
    execute format($f$
      create table if not exists public.%I (
        id          text primary key,
        site_id     text not null default 'bsf1' references public.sites(id),
        record_type text not null default '',
        record_id   text not null default '',
        parent_type text not null default '',
        parent_id   text not null default '',
        action      text not null check (action in ('create', 'update', 'delete', 'approve', 'return', 'reject', 'attach', 'detach',
                                                    'cancel', 'restore', 'close', 'reopen', 'undo')),
        summary     text not null default '',
        actor       text not null default '',
        created_at  timestamptz not null default now()
      )$f$, t);
    execute format('create index if not exists %I on public.%I (site_id, record_type, record_id, created_at)', t || '_record_idx', t);
    execute format('create index if not exists %I on public.%I (site_id, parent_type, parent_id, created_at)', t || '_parent_idx', t);
    if t = 'imports_activity_log' then
      r := $q$(public.has_export_permission('imports', 'view') or public.has_export_permission('imports.invoices', 'view'))$q$;
      w := $q$(public.has_export_permission('imports', 'create') or public.has_export_permission('imports', 'update')
          or public.has_export_permission('imports', 'delete') or public.has_export_permission('imports', 'lock')
          or public.has_export_permission('imports', 'unlock') or public.has_export_permission('imports.invoices', 'create')
          or public.has_export_permission('imports.invoices', 'update') or public.has_export_permission('imports.invoices', 'delete'))$q$;
    else
      r := $q$(public.has_export_permission('wip', 'view') or public.has_export_permission('packaging', 'view'))$q$;
      w := $q$(public.has_export_permission('wip', 'create') or public.has_export_permission('wip', 'update')
          or public.has_export_permission('wip', 'delete') or public.has_export_permission('wip', 'lock')
          or public.has_export_permission('wip', 'unlock') or public.has_export_permission('packaging', 'create')
          or public.has_export_permission('packaging', 'update') or public.has_export_permission('packaging', 'delete'))$q$;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, r);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, w);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, w, w);
    execute format('create policy %I on public.%I for delete to authenticated using (site_id = ''site-demo'' and %s)', t || '_delete', t, r);
    -- 3. Đóng dấu người + giờ ở máy chủ, chỉ thêm (hàm của 0079).
    execute format('drop trigger if exists %I on public.%I', t || '_stamp', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.export_activity_log_stamp()', t || '_stamp', t);
    execute format('drop trigger if exists %I on public.%I', t || '_no_edit', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.export_activity_log_immutable()', t || '_no_edit', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Kiểm (chỉ đọc):
--   select record_type, count(*) from public.export_activity_log group by 1;   -- dòng cũ = export-contract
--   select count(*) from public.export_activity_log where record_type = 'export-contract' and record_id = '';  -- 0
--   select tablename, count(*) from pg_policies where tablename in ('export_activity_log', 'imports_activity_log', 'production_activity_log') group by 1;  -- 4 · 4 · 4
--
-- ROLLBACK (chỉ khi cần gỡ — mất nhật ký Nhập hàng / Sản xuất đã ghi; dòng Nhập khẩu / Lệnh SX trong export_activity_log
-- không còn ai đọc được, dòng HĐ xuất về như 0079):
--   drop table if exists public.imports_activity_log;
--   drop table if exists public.production_activity_log;
--   drop trigger if exists export_activity_log_fill_record on public.export_activity_log;
--   drop function if exists public.export_activity_log_fill_record();
--   -- chạy lại khối policy select / insert / update của 0079 (chỉ điều kiện export-plans)
--   alter table public.export_activity_log drop column if exists record_type, drop column if exists record_id,
--     drop column if exists parent_type, drop column if exists parent_id;
