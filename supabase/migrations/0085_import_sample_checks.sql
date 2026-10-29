-- ============================================================
-- Baseafood MES — 0085: KIỂM MẪU HÀNG NHẬP KHẨU CỦA KHO, ĐI THEO TỪNG LẦN NHẬP (INVOICE)
--
-- Vì sao (2026-10-29, ba-spec 45 §0d v4): bộ phận Kho gửi Phòng Kế hoạch báo cáo kiểm mẫu (bảng
-- Excel, mỗi cột một mẫu: size, nhà XK, ngày nhập, packing, NSX / HSD, GW / NW, thiếu net, màu /
-- nám / mùi / rêu, loại 1 da / 2 da / Mada, phân bố size, 6 định mức tới ĐM NL – TP). Phòng KH cần
-- lưu các số này đi kèm invoice (= lần nhập) và hợp đồng. CHỈ LƯU, app không tính lại (R23).
--
-- Làm gì — bảng MỚI `import_sample_checks`, mỗi dòng MỘT mẫu:
--   - trỏ MỀM (text, không `references`, như mọi bảng nghiệp vụ): `contract_id`, `receipt_id`,
--     `contract_line_id` (dòng hàng theo size, trống = chưa gắn), `file_id` (`import_files`, file
--     báo cáo; trống = nhập tay);
--   - `batch_id` = mã nhóm của một đợt đọc (nạp lại báo cáo thì thay cả nhóm — Q4), không trỏ bảng nào;
--   - chữ như báo cáo: size · nhà XK · ngày nhập · packing · ngày SX / HH (ISO text, trống = không có);
--   - chỉ số chính mỗi chỉ số một cột số (lọc / so theo nhà XK về sau); phân bố size + hàng lạ = jsonb.
-- RLS theo phân quyền Nhập khẩu như `import_documents` (0082): đọc = `import-plans` xem; thêm / sửa
-- = `import-plans` thêm hoặc sửa; xóa = `import-plans` xóa hoặc sửa. Thủ kho KHÔNG đọc (Q3: Phòng
-- KH đính báo cáo). KHÔNG đổi bảng / policy / ma trận quyền nào đang có ⇒ không phải chạy lại file
-- cũ nào. Chỉ thêm. Idempotent. File báo cáo dùng bucket `import-files` sẵn có (0082).
-- ⚠ Chưa chạy ⇒ app báo "chưa chạy 0085" khi lưu kiểm mẫu, không kẹt hàng chờ.
-- ROLLBACK cuối file.
-- ============================================================

create table if not exists public.import_sample_checks (
  id                          text primary key,
  site_id                     text not null default 'bsf1' references public.sites(id),
  contract_id                 text not null default '',
  receipt_id                  text not null,
  contract_line_id            text not null default '',
  batch_id                    text not null default '',
  file_id                     text not null default '',
  report_date                 text not null default '',
  sample_no                   text not null default '',
  size                        text not null default '',
  exporter_name               text not null default '',
  import_date                 text not null default '',
  packing                     text not null default '',
  production_date             text not null default '',
  expiry_date                 text not null default '',
  gross_weight_g              numeric,
  net_weight_g                numeric,
  net_shortage_pct            numeric,
  color                       text not null default '',
  black_spot                  text not null default '',
  odor                        text not null default '',
  moss_pct                    numeric,
  one_skin_pct                numeric,
  two_skin_pct                numeric,
  mada_pct                    numeric,
  size_distribution           jsonb not null default '{}'::jsonb,
  thawing_norm                numeric,
  preprocessing_norm          numeric,
  blanching_norm              numeric,
  cutting_norm                numeric,
  surplus_norm                numeric,
  material_to_finished_norm   numeric,
  extra                       jsonb not null default '{}'::jsonb,
  note                        text not null default '',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists import_sample_checks_receipt_idx on public.import_sample_checks (site_id, receipt_id);
create index if not exists import_sample_checks_contract_idx on public.import_sample_checks (site_id, contract_id);

do $$
declare
  t text := 'import_sample_checks';
  r text := $q$public.has_export_permission('import-plans', 'view')$q$;
  w text := $q$public.has_export_permission('import-plans', 'create') or public.has_export_permission('import-plans', 'update')$q$;
  d text := $q$public.has_export_permission('import-plans', 'delete') or public.has_export_permission('import-plans', 'update')$q$;
begin
  execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
  execute format('create trigger %I before update on public.%I for each row execute function public.cap_nhat_thoi_diem_sua()', t || '_touch_updated_at', t); -- naming-ok: hàm 0001
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, r);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, w);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, w, w);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, d);
  execute format('revoke all on public.%I from anon', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute format('drop trigger if exists %I on public.%I', t || '_sql_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ghi_vet_sua_truc_tiep()', t || '_sql_audit', t); -- naming-ok: hàm 0048
  end if;
end $$;

-- Kiểm (chỉ đọc):
--   select count(*) from pg_policies where tablename = 'import_sample_checks';            -- 4
--   select r.contract_no, s.sample_no, s.size, s.exporter_name, s.material_to_finished_norm
--     from public.import_sample_checks s join public.import_receipts r on r.id = s.receipt_id
--    order by 1, 2;

-- ROLLBACK (chỉ khi cần gỡ — mất mọi số kiểm mẫu đã lưu):
--   drop table if exists public.import_sample_checks;
