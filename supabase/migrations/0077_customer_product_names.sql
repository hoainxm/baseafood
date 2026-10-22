-- ============================================================
-- Baseafood MES — 0077: TÊN HÀNG THEO KHÁCH (tên in trên chứng từ xuất khẩu)
--
-- Vì sao (họp 2026-10-22, chủ dự án ↔ Phòng Kế hoạch; ba-spec 41 v6 NV14 · NV16 · R23 · R26):
-- cùng một mặt hàng của xưởng nhưng MỖI KHÁCH gọi một tên trên hợp đồng / invoice (Matsuda
-- "Frozen boiled octopus", Seachemot "Iwadako…"), theo từng size; mỗi khách ~15–20 tên.
-- Một cột `products.trade_name` (0076) không đủ — cột đó giờ là TÊN TIẾNG ANH MẶC ĐỊNH.
--
-- Bảng `customer_product_names`: mỗi (khách, mặt hàng) MỘT dòng — tên · size · quy cách ·
-- mã HS · ghi chú. App tự thêm dòng còn thiếu khi lưu hợp đồng / nối mặt hàng (không ghi đè).
-- KHÔNG khóa ngoại (giống 0070 / 0072 / 0075) — liên kết mềm, app khai refColumns
-- (customer_id, product_id) cho chế độ demo.
--
-- Quyền (RLS, khuôn 0075): ĐỌC = xem danh mục khách HOẶC xem Xuất khẩu; GHI (UPSERT ⇒ insert +
-- update cùng điều kiện) = thêm/sửa danh mục khách HOẶC thêm/sửa Xuất khẩu (tự học chạy khi
-- người Kế hoạch lưu hợp đồng); XÓA = xóa danh mục khách. Không đụng ma trận quyền.
--
-- Chỉ THÊM (bảng + hàm không đổi). Mức độ 🟡. Idempotent: chạy lại nhiều lần không lỗi.
-- App chỉ ghi bảng khi đọc được bảng từ máy chủ ⇒ chưa chạy file này thì hợp đồng vẫn lưu,
-- chỉ không có danh sách tên theo khách.
-- ROLLBACK (mất danh sách tên đã khai — hợp đồng đã lưu KHÔNG đổi):
--   drop table if exists public.customer_product_names;
-- ============================================================

create table if not exists public.customer_product_names (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  customer_id text not null default '',
  product_id  text not null default '',
  trade_name  text not null default '',
  size_text   text not null default '',
  packing     text not null default '',
  hs_code     text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Mỗi (khách, mặt hàng) một dòng (R23).
create unique index if not exists customer_product_names_pair_uq
  on public.customer_product_names (site_id, customer_id, product_id);
create index if not exists customer_product_names_customer_idx
  on public.customer_product_names (site_id, customer_id);

drop trigger if exists customer_product_names_touch_updated_at on public.customer_product_names;
create trigger customer_product_names_touch_updated_at
  before update on public.customer_product_names
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

-- ---------- RLS ----------
alter table public.customer_product_names enable row level security;
drop policy if exists customer_product_names_select on public.customer_product_names;
drop policy if exists customer_product_names_insert on public.customer_product_names;
drop policy if exists customer_product_names_update on public.customer_product_names;
drop policy if exists customer_product_names_delete on public.customer_product_names;
create policy customer_product_names_select on public.customer_product_names for select to authenticated
  using (public.has_export_permission('catalog.customers', 'view') or public.has_export_permission('export-plans', 'view'));
create policy customer_product_names_insert on public.customer_product_names for insert to authenticated
  with check (public.has_export_permission('catalog.customers', 'create') or public.has_export_permission('catalog.customers', 'update')
              or public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy customer_product_names_update on public.customer_product_names for update to authenticated
  using (public.has_export_permission('catalog.customers', 'create') or public.has_export_permission('catalog.customers', 'update')
         or public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'))
  with check (public.has_export_permission('catalog.customers', 'create') or public.has_export_permission('catalog.customers', 'update')
              or public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy customer_product_names_delete on public.customer_product_names for delete to authenticated
  using (public.has_export_permission('catalog.customers', 'delete'));
revoke all on public.customer_product_names from anon;
grant select, insert, update, delete on public.customer_product_names to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists customer_product_names_sql_audit on public.customer_product_names';
    execute 'create trigger customer_product_names_sql_audit after insert or update or delete on public.customer_product_names
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  else
    raise notice 'Chưa có hàm 0048 — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: rls = true; 4 policy, chỉ authenticated; 0 dòng):
--   select relrowsecurity from pg_class where relname = 'customer_product_names';
--   select policyname, cmd, roles from pg_policies where tablename = 'customer_product_names' order by 1;
--   select count(*) from public.customer_product_names;
