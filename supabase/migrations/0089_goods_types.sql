-- ============================================================
-- Baseafood MES — 0089: DANH MỤC LOẠI HÀNG cho dòng hàng hợp đồng xuất / nhập
--
-- Vì sao (2026-10-30, Phòng Kế hoạch): mỗi dòng hàng hợp đồng cần một "loại hàng" (1 da, 2 da, mada,
-- cá khô, cá gia công, cá sản xuất xuất khẩu, cá đông…) để xuất Excel lọc được. Chủ dự án chọn DANH MỤC
-- RIÊNG (thêm / đổi tên một chỗ, mọi dòng theo) thay vì gõ chữ tự do.
--
-- Làm gì — chỉ thêm:
--   1. Bảng MỚI `goods_types` (`id` · `site_id` · `name` · `sort_order` · `note`), seed 7 loại ở site bsf1.
--   2. Cột `import_contract_lines.goods_type_id` (text, trống = chưa chọn) — trỏ MỀM `goods_types.id`
--      như `product_id` (0084): xóa loại không xóa dòng HĐ.
--   Dòng hàng HĐ XUẤT nằm trong JSON `export_contract_revisions.lines` ⇒ chỉ thêm khóa `goodsTypeId`,
--   không cần cột.
-- RLS theo phân quyền Phòng Kế hoạch (`has_export_permission`, 0075 — dùng cho cả `import-plans`, 0082):
--   đọc = xem Xuất khẩu HOẶC Nhập khẩu; thêm / sửa = thêm hoặc sửa ở một trong hai (app ghi bằng upsert);
--   xóa = quyền xóa ở một trong hai. KHÔNG đổi policy / bảng nào đang có.
-- Idempotent. ⚠ Chưa chạy ⇒ app ẩn ô Loại hàng + tab Danh mục báo "chưa chạy 0089", không kẹt hàng chờ.
-- ROLLBACK cuối file.
-- ============================================================

create table if not exists public.goods_types (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  name        text not null default '',
  sort_order  integer not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists goods_types_site_idx on public.goods_types (site_id);

drop trigger if exists goods_types_touch_updated_at on public.goods_types;
create trigger goods_types_touch_updated_at
  before update on public.goods_types
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

alter table public.goods_types enable row level security;
drop policy if exists goods_types_select on public.goods_types;
drop policy if exists goods_types_insert on public.goods_types;
drop policy if exists goods_types_update on public.goods_types;
drop policy if exists goods_types_delete on public.goods_types;
create policy goods_types_select on public.goods_types for select to authenticated
  using (public.has_export_permission('export-plans', 'view') or public.has_export_permission('import-plans', 'view'));
create policy goods_types_insert on public.goods_types for insert to authenticated
  with check (
    public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
    or public.has_export_permission('import-plans', 'create') or public.has_export_permission('import-plans', 'update')
  );
create policy goods_types_update on public.goods_types for update to authenticated
  using (
    public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
    or public.has_export_permission('import-plans', 'create') or public.has_export_permission('import-plans', 'update')
  )
  with check (
    public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update')
    or public.has_export_permission('import-plans', 'create') or public.has_export_permission('import-plans', 'update')
  );
create policy goods_types_delete on public.goods_types for delete to authenticated
  using (public.has_export_permission('export-plans', 'delete') or public.has_export_permission('import-plans', 'delete'));

revoke all on public.goods_types from anon;
grant select, insert, update, delete on public.goods_types to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists goods_types_sql_audit on public.goods_types';
    execute 'create trigger goods_types_sql_audit after insert or update or delete on public.goods_types
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  end if;
end $$;

-- 7 loại khởi đầu (Phòng Kế hoạch đưa); có rồi thì giữ tên đang có.
insert into public.goods_types (id, site_id, name, sort_order) values
  ('one-skin', 'bsf1', '1 da', 10),
  ('two-skin', 'bsf1', '2 da', 20),
  ('mada', 'bsf1', 'Mada', 30),
  ('dried-fish', 'bsf1', 'Cá khô', 40),
  ('processing-fish', 'bsf1', 'Cá gia công', 50),
  ('export-production-fish', 'bsf1', 'Cá sản xuất xuất khẩu', 60),
  ('frozen-fish', 'bsf1', 'Cá đông', 70)
on conflict (id) do nothing;

alter table public.import_contract_lines add column if not exists goods_type_id text;
create index if not exists import_contract_lines_goods_type_idx on public.import_contract_lines (site_id, goods_type_id);

-- KIỂM (chỉ đọc):
--   select id, name, sort_order from public.goods_types order by sort_order;          -- 7 dòng
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'import_contract_lines' and column_name = 'goods_type_id';

-- ============================================================
-- ROLLBACK (mất loại hàng đã chọn ở dòng HĐ nhập; khóa `goodsTypeId` trong JSON dòng HĐ xuất app tự bỏ qua):
--   drop index if exists public.import_contract_lines_goods_type_idx;
--   alter table public.import_contract_lines drop column if exists goods_type_id;
--   drop table if exists public.goods_types;
-- ============================================================
