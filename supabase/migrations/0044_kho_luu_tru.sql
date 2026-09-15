-- ============================================================
-- Baseafood MES — 0044: Danh mục KHO LƯU TRỮ + cột "kho lưu" cho sổ Xuất–Nhập–Tồn
--
-- Vì sao: hàng của xí nghiệp KHÔNG chỉ nằm trong kho nhà. Khi kho nhà đầy (mùa
-- cao điểm) hàng được gửi sang kho lạnh THUÊ NGOÀI (Kho Hồng Phú, Kho Ánh Dương…).
-- Báo cáo Xuất–Nhập–Tồn (/nxt-kho) trước đây chỉ có `warehouse_code` = chi nhánh
-- in trên báo cáo ("KHO TP - KHO 1000") nên KHÔNG trả lời được câu thủ kho hỏi mỗi
-- ngày: "lô này đang nằm ở kho nào, còn bao nhiêu ở kho thuê?". Thêm chiều KHO LƯU:
--   - `storage_locations`: danh mục kho lưu (quản lý được ở /catalog?tab=kho-luu),
--     gồm kho nhà ("Kho Baseafood" — tổng trong kho) và các kho thuê ngoài.
--   - `nxt_snapshots.storage_location`: LƯU TÊN kho lưu của từng dòng (rỗng = chưa
--     gán ⇒ hiểu là kho nhà, không ép sửa dữ liệu cũ).
--
-- Lưu theo TÊN (không phải id) để khớp cách `monthly_stock_ledger.warehouse` đang
-- làm: báo cáo/Excel của xí nghiệp đi theo tên kho, đổi tên là việc của danh mục.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới + CHỈ THÊM một cột có default ''
-- (không đụng dữ liệu đang có, không đổi ràng buộc nào).
-- Chạy SAU 0001 (sites) và 0032 (nxt_snapshots). Chạy lại nhiều lần vẫn không lỗi.
-- RLS mở cho anon+authenticated (như 0041/0043); siết ở nhánh 0021 sau.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.storage_locations (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  code        text not null default '',        -- mã số gõ nhanh, VD "KBSF", "KHP"
  name        text not null default '',        -- TÊN dùng để nối dữ liệu, VD "Kho Baseafood"
  kind        text not null default 'noi-bo',  -- 'noi-bo' (kho nhà) | 'thue-ngoai' (kho thuê)
  address     text not null default '',
  phone       text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists storage_locations_idx
  on public.storage_locations (site_id, name);

drop trigger if exists storage_locations_sua on public.storage_locations;
create trigger storage_locations_sua
  before update on public.storage_locations
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.storage_locations enable row level security;
drop policy if exists storage_locations_toan_quyen on public.storage_locations;
create policy storage_locations_toan_quyen on public.storage_locations
  for all to anon, authenticated
  using (true) with check (true);

-- Seed 3 kho đang dùng thật (chạy lại không đè sửa tay: do nothing khi đã có id).
insert into public.storage_locations (id, code, name, kind, note) values
  ('kho-baseafood',  'KBSF', 'Kho Baseafood',  'noi-bo',     'Kho của xí nghiệp — tổng hàng đang nằm trong kho nhà'),
  ('kho-hong-phu',   'KHP',  'Kho Hồng Phú',   'thue-ngoai', 'Kho lạnh thuê ngoài'),
  ('kho-anh-duong',  'KAD',  'Kho Ánh Dương',  'thue-ngoai', 'Kho lạnh thuê ngoài')
on conflict (id) do nothing;

-- Chiều KHO LƯU cho từng dòng báo cáo Xuất–Nhập–Tồn. Rỗng = chưa gán (kho nhà).
alter table public.nxt_snapshots
  add column if not exists storage_location text not null default '';

create index if not exists nxt_snapshots_kho_luu_idx
  on public.nxt_snapshots (site_id, storage_location);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0044
--
-- DROP INDEX IF EXISTS public.nxt_snapshots_kho_luu_idx;
-- ALTER TABLE public.nxt_snapshots DROP COLUMN IF EXISTS storage_location;
-- DROP TABLE IF EXISTS public.storage_locations;
-- ============================================================
