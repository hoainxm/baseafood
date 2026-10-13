-- ============================================================
-- Baseafood MES — 0059: GIÁ TRỊ ENUM lưu trong DB sang tiếng Anh (Đợt 5a)
--
-- 🔴 RED (chủ dự án duyệt 2026-10-13, tự chạy ở SQL Editor TRƯỚC khi deploy code Đợt 5).
-- Quy ước: docs/spec/quy-uoc-dat-ten.md §5 Đợt 5a. Bảng cũ → mới DUY NHẤT ở
-- src/lib/legacyValues.ts (LEGACY_VALUES) — giữ khớp với file này.
--
--   production_wips.status     cho-nhap → pending · da-nhap → stocked
--   sales_orders.status        dang-gom → collecting · du → complete · dong → closed
--   export_orders.status       mo → open · dong → closed
--   storage_locations.kind     noi-bo → internal · thue-ngoai → external
--   qc_checklists.result       dat → pass · tam → conditional · khong-dat → fail
--   lot_inputs.method          quet → scan · go → typed · chon → picked
--   lot_dispatches.method      quet → scan · go → typed · chon → picked (fifo giữ nguyên)
--
-- KHÔNG đụng audit_log: nhật ký append-only (RLS 0025), lịch sử giữ nguyên chữ cũ
-- (them/sua/xoa/dang-nhap/dang-xuat/gui) — app đọc qua normalizeAuditAction và lọc
-- qua auditActionAliases nên dòng cũ vẫn hiện đúng nhãn, lọc đúng.
--
-- Các bước (một transaction):
--   1. Nới CHECK của 3 cột có ràng buộc (0036/0046/0056) để nhận CẢ cũ LẪN mới.
--      Giữ giá trị cũ trong CHECK có chủ đích: máy đang mở bản app cũ (chưa tải lại)
--      vẫn ghi được, không kẹt hàng chờ. Siết về chỉ-mới là việc của migration sau.
--   2. UPDATE cũ → mới. Mỗi dòng đổi sinh một dòng audit_log "[SQL trực tiếp]"
--      qua trigger ghi_vet_sql_tg (0048) — đúng ý: thay đổi đi thẳng SQL phải có vết.
--   3. Đổi DEFAULT cột sang giá trị mới.
--
-- Idempotent: chạy lại → bước 1 dựng lại đúng CHECK, bước 2 không còn dòng cũ (0 dòng),
-- bước 3 đặt lại cùng default.
--
-- Thứ tự triển khai: chạy 0059 → 0060 → rồi mới deploy code Đợt 5. Code Đợt 5 ĐỌC
-- được cả hai bộ giá trị nên deploy trước cũng không vỡ màn hình, nhưng GHI giá trị
-- mới vào qc_checklists / lot_inputs / lot_dispatches sẽ bị CHECK cũ từ chối.
--
-- ROLLBACK (chỉ khi đã quay code về trước Đợt 5): khối cuối file.
-- ============================================================

begin;

-- 1. Nới CHECK: bỏ mọi CHECK một-cột đang đặt trên cột (tên tự sinh khác nhau tùy
--    lúc tạo) rồi dựng lại một CHECK tên cố định nhận cả cũ lẫn mới.
do $$
declare
  r record;
  c record;
begin
  for r in
    select * from (values
      ('qc_checklists',  'result', array['pass', 'conditional', 'fail', 'dat', 'tam', 'khong-dat']),
      ('lot_inputs',     'method', array['scan', 'typed', 'picked', 'quet', 'go', 'chon']),
      ('lot_dispatches', 'method', array['scan', 'typed', 'picked', 'fifo', 'quet', 'go', 'chon'])
    ) as v(tbl, col, vals)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'Bỏ qua %: bảng chưa có', r.tbl;
      continue;
    end if;
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.conrelid = ('public.' || r.tbl)::regclass
        and con.contype = 'c'
        and array_length(con.conkey, 1) = 1
        and a.attname = r.col
    loop
      execute format('alter table public.%I drop constraint %I', r.tbl, c.conname);
    end loop;
    execute format('alter table public.%I add constraint %I check (%I = any (%L::text[]))',
                   r.tbl, r.tbl || '_' || r.col || '_check', r.col, r.vals);
  end loop;
end $$;

-- 2. Đổi giá trị cũ → mới.
update public.production_wips set status = case status
    when 'cho-nhap' then 'pending' when 'da-nhap' then 'stocked' end
  where status in ('cho-nhap', 'da-nhap');

update public.sales_orders set status = case status
    when 'dang-gom' then 'collecting' when 'du' then 'complete' when 'dong' then 'closed' end
  where status in ('dang-gom', 'du', 'dong');

update public.export_orders set status = case status
    when 'mo' then 'open' when 'dong' then 'closed' end
  where status in ('mo', 'dong');

update public.storage_locations set kind = case kind
    when 'noi-bo' then 'internal' when 'thue-ngoai' then 'external' end
  where kind in ('noi-bo', 'thue-ngoai');

update public.qc_checklists set result = case result
    when 'dat' then 'pass' when 'tam' then 'conditional' when 'khong-dat' then 'fail' end
  where result in ('dat', 'tam', 'khong-dat');

update public.lot_inputs set method = case method
    when 'quet' then 'scan' when 'go' then 'typed' when 'chon' then 'picked' end
  where method in ('quet', 'go', 'chon');

update public.lot_dispatches set method = case method
    when 'quet' then 'scan' when 'go' then 'typed' when 'chon' then 'picked' end
  where method in ('quet', 'go', 'chon');

-- 3. Mặc định cột theo giá trị mới (trước: 0011 / 0044 / 0036 / 0046 / 0056).
alter table public.production_wips   alter column status set default 'pending';
alter table public.sales_orders      alter column status set default 'collecting';
alter table public.export_orders     alter column status set default 'open';
alter table public.storage_locations alter column kind   set default 'internal';
alter table public.qc_checklists     alter column result set default 'pass';
alter table public.lot_inputs        alter column method set default 'picked';
alter table public.lot_dispatches    alter column method set default 'picked';

commit;

-- Kiểm sau khi chạy (phải ra 0 dòng):
--   select 'production_wips' t, status v from production_wips where status not in ('pending','stocked')
--   union all select 'sales_orders', status from sales_orders where status not in ('collecting','complete','closed')
--   union all select 'export_orders', status from export_orders where status not in ('open','closed')
--   union all select 'storage_locations', kind from storage_locations where kind not in ('internal','external')
--   union all select 'qc_checklists', result from qc_checklists where result not in ('pass','conditional','fail')
--   union all select 'lot_inputs', method from lot_inputs where method not in ('scan','typed','picked')
--   union all select 'lot_dispatches', method from lot_dispatches where method not in ('scan','typed','picked','fifo');

-- ============================================================
-- ROLLBACK — chỉ chạy sau khi đã quay code về trước Đợt 5:
--
-- begin;
-- update public.production_wips set status = case status when 'pending' then 'cho-nhap' when 'stocked' then 'da-nhap' end where status in ('pending','stocked');
-- update public.sales_orders set status = case status when 'collecting' then 'dang-gom' when 'complete' then 'du' when 'closed' then 'dong' end where status in ('collecting','complete','closed');
-- update public.export_orders set status = case status when 'open' then 'mo' when 'closed' then 'dong' end where status in ('open','closed');
-- update public.storage_locations set kind = case kind when 'internal' then 'noi-bo' when 'external' then 'thue-ngoai' end where kind in ('internal','external');
-- update public.qc_checklists set result = case result when 'pass' then 'dat' when 'conditional' then 'tam' when 'fail' then 'khong-dat' end where result in ('pass','conditional','fail');
-- update public.lot_inputs set method = case method when 'scan' then 'quet' when 'typed' then 'go' when 'picked' then 'chon' end where method in ('scan','typed','picked');
-- update public.lot_dispatches set method = case method when 'scan' then 'quet' when 'typed' then 'go' when 'picked' then 'chon' end where method in ('scan','typed','picked');
-- alter table public.production_wips   alter column status set default 'cho-nhap';
-- alter table public.sales_orders      alter column status set default 'dang-gom';
-- alter table public.export_orders     alter column status set default 'mo';
-- alter table public.storage_locations alter column kind   set default 'noi-bo';
-- alter table public.qc_checklists     alter column result set default 'dat';
-- alter table public.lot_inputs        alter column method set default 'chon';
-- alter table public.lot_dispatches    alter column method set default 'chon';
-- alter table public.qc_checklists  drop constraint if exists qc_checklists_result_check;
-- alter table public.qc_checklists  add constraint qc_checklists_result_check check (result in ('dat','tam','khong-dat'));
-- alter table public.lot_inputs     drop constraint if exists lot_inputs_method_check;
-- alter table public.lot_inputs     add constraint lot_inputs_method_check check (method in ('quet','go','chon'));
-- alter table public.lot_dispatches drop constraint if exists lot_dispatches_method_check;
-- alter table public.lot_dispatches add constraint lot_dispatches_method_check check (method in ('quet','go','chon','fifo'));
-- commit;
-- ============================================================
