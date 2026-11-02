-- ============================================================
-- Baseafood MES — 0095: DANH SÁCH CHỌN CỦA XUẤT KHẨU (cảng xếp · cảng đích · loại container · tiền tệ)
--
-- Vì sao (2026-11-02, ba-spec 62, chị Phạm Thảo — Phòng Kế hoạch): cảng xếp, cảng đích, loại container,
-- tiền tệ của hợp đồng / chuyến xuất là ô gõ tay ⇒ một cảng nhiều cách viết ("TOKYO", "Tokyo",
-- "TOKYO, JAPAN"), báo cáo tách sổ. Đổi thành ô chọn theo danh sách; thêm / sửa / xóa tùy chọn ngay
-- trong ô và ở tab Danh mục của trang Xuất khẩu.
--
-- Làm gì — chỉ thêm:
--   1. Bảng MỚI `export_options` (`id` · `site_id` · `list_kind` · `name` · `sort_order` · `note`):
--      MỘT bảng cho mọi danh sách, `list_kind` cho biết thuộc danh sách nào ⇒ thêm danh sách sau
--      không cần migration (chỉ nới ràng buộc `list_kind`).
--   2. Danh sách khởi tạo ở site bsf1 (Q7: 11 cảng đích chị Thảo gửi).
--   Hợp đồng / chuyến LƯU CHỮ của tùy chọn (Q5) ⇒ không có khóa ngoại; xóa / đổi tên tùy chọn không
--   đụng sổ đã ghi. KHÔNG sửa dữ liệu HĐ / chuyến cũ (Q6).
-- RLS theo phân quyền Xuất khẩu (`has_export_permission`, 0075), như `export_document_kinds` (0081):
--   đọc = `export-plans` xem; thêm / sửa = thêm hoặc sửa (app ghi bằng upsert ⇒ cần cả update);
--   xóa = `export-plans` xóa. KHÔNG đổi bảng / cột / policy nào đang có.
-- Idempotent. ⚠ Chưa chạy ⇒ ô chọn dùng danh sách khởi tạo trong code, chỉ chọn (không thêm / sửa /
-- xóa), không kẹt hàng chờ.
-- ROLLBACK cuối file.
-- ============================================================

create table if not exists public.export_options (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  list_kind   text not null,
  name        text not null default '',
  sort_order  integer not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.export_options drop constraint if exists export_options_list_kind_check;
-- 'bank-account' (0096, ba-spec 63) có sẵn ở đây: chạy lại 0095 SAU 0096 không vỡ vì dòng tài khoản ngân hàng.
alter table public.export_options add constraint export_options_list_kind_check
  check (list_kind in ('loading-port', 'discharge-port', 'container-type', 'currency', 'bank-account'));
create index if not exists export_options_site_kind_idx on public.export_options (site_id, list_kind);

drop trigger if exists export_options_touch_updated_at on public.export_options;
create trigger export_options_touch_updated_at
  before update on public.export_options
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

alter table public.export_options enable row level security;
drop policy if exists export_options_select on public.export_options;
drop policy if exists export_options_insert on public.export_options;
drop policy if exists export_options_update on public.export_options;
drop policy if exists export_options_delete on public.export_options;
create policy export_options_select on public.export_options for select to authenticated
  using (public.has_export_permission('export-plans', 'view'));
create policy export_options_insert on public.export_options for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_options_update on public.export_options for update to authenticated
  using (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'))
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_options_delete on public.export_options for delete to authenticated
  using (public.has_export_permission('export-plans', 'delete'));

revoke all on public.export_options from anon;
grant select, insert, update, delete on public.export_options to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists export_options_sql_audit on public.export_options';
    execute 'create trigger export_options_sql_audit after insert or update or delete on public.export_options
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  end if;
end $$;

-- Danh sách khởi tạo — trùng `EXPORT_OPTION_SEED` (src/lib/exportOptions.ts); có rồi thì giữ tên đang có.
insert into public.export_options (id, site_id, list_kind, name, sort_order) values
  ('loading-port-cai-mep', 'bsf1', 'loading-port', 'Cái Mép', 10),
  ('loading-port-cat-lai', 'bsf1', 'loading-port', 'Cát Lái', 20),
  ('discharge-port-tokyo', 'bsf1', 'discharge-port', 'Tokyo, Japan', 10),
  ('discharge-port-hakata', 'bsf1', 'discharge-port', 'Hakata, Japan', 20),
  ('discharge-port-nagoya', 'bsf1', 'discharge-port', 'Nagoya, Japan', 30),
  ('discharge-port-xiamen', 'bsf1', 'discharge-port', 'Xiamen, China', 40),
  ('discharge-port-penang', 'bsf1', 'discharge-port', 'Penang, Malaysia', 50),
  ('discharge-port-los-angeles', 'bsf1', 'discharge-port', 'Los Angeles, USA', 60),
  ('discharge-port-baltimore', 'bsf1', 'discharge-port', 'Baltimore, USA', 70),
  ('discharge-port-charleston', 'bsf1', 'discharge-port', 'Charleston, USA', 80),
  ('discharge-port-moji', 'bsf1', 'discharge-port', 'Moji, Japan', 90),
  ('discharge-port-kobe', 'bsf1', 'discharge-port', 'Kobe, Japan', 100),
  ('discharge-port-osaka', 'bsf1', 'discharge-port', 'Osaka, Japan', 110),
  ('container-type-20rf', 'bsf1', 'container-type', '20RF', 10),
  ('container-type-40rf', 'bsf1', 'container-type', '40RF', 20),
  ('container-type-40hc-rf', 'bsf1', 'container-type', '40HC-RF', 30),
  ('currency-usd', 'bsf1', 'currency', 'USD', 10),
  ('currency-jpy', 'bsf1', 'currency', 'JPY', 20),
  ('currency-eur', 'bsf1', 'currency', 'EUR', 30)
on conflict (id) do nothing;

-- KIỂM (chỉ đọc):
--   select list_kind, count(*) from public.export_options where site_id = 'bsf1' group by 1 order by 1;
--     -- container-type 3 · currency 3 · discharge-port 11 · loading-port 2
--   select count(*) from pg_policies where tablename = 'export_options';                 -- 4

-- ============================================================
-- ROLLBACK (mất tùy chọn tự thêm; HĐ / chuyến giữ nguyên chữ đã ghi):
--   drop table if exists public.export_options;
-- ============================================================
