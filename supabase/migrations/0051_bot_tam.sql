-- ============================================================
-- Baseafood MES — 0051: BỘT TẨM — danh mục loại bột, bột đi kèm mặt hàng,
--                         lượng bột theo loại trên dòng thành phẩm
--
-- Vì sao: thành phẩm TẨM BỘT không dùng một thứ bột chung. Mỗi mặt hàng đi kèm
-- MỘT BỘ loại bột riêng, mỗi loại một lượng (kg) riêng khi ghi thành phẩm:
--   • "tẩm bột nước tương"  → Bột 24V + Bột 18V + Bột 220H
--   • "tẩm bột 5-10"        → Bột 232 + Bột 20802
--   … và nhiều tổ hợp khác — nên KHÔNG mã cứng, mà làm danh mục mở:
--   - `batter_types`               danh mục LOẠI BỘT (/catalog?tab=bot-tam).
--   - `products.batter_ids`        bột ĐI KÈM của mặt hàng (mảng id loại bột) —
--                                  màn /wip tự hiện ô kg cho từng loại khi chọn mã.
--   - `production_wips.batter_kg`  lượng bột ĐÃ DÙNG của dòng thành phẩm,
--                                  `{ "<tên loại bột>": kg }` — lưu theo TÊN như
--                                  `production_locks.leftover_by_material` (0038):
--                                  sổ giữ tên lúc ghi, đổi tên danh mục không hồi tố.
-- Bột là PHỤ GIA tẩm (Khối 1 "Bột phụ gia" ở Cân đối), KHÔNG cộng vào số kg thành
-- phẩm — `quantity_kg` giữ nguyên nghĩa cũ.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 1 bảng mới + 2 cột có default rỗng; nạp
-- bột đi kèm cho 2 nhóm mặt hàng đã chốt ở trên CHỈ KHI cột còn rỗng (không đè
-- sửa tay). Không đụng dữ liệu đang có khác, không đổi ràng buộc / RLS bảng cũ.
-- RLS bảng mới theo khuôn 0021/0047 (chỉ authenticated, revoke anon).
-- Chạy SAU 0001 (sites), 0011 (production_wips), 0014 (products), 0048 (hàm ghi vết).
-- ⚠️ CHẠY TRƯỚC KHI DEPLOY code đọc/ghi 3 chỗ trên — repo.ts gửi LUÔN 2 cột mới
--    (gửi có điều kiện thì không xoá được về rỗng); thiếu cột ⇒ kẹt hàng chờ.
-- Idempotent: chạy lại nhiều lần vẫn không lỗi. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.batter_types (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  code        text not null default '',   -- mã số gõ nhanh, VD "24V"
  name        text not null default '',   -- TÊN dùng để nối sổ, VD "Bột 24V"
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists batter_types_idx on public.batter_types (site_id, name);

drop trigger if exists batter_types_sua on public.batter_types;
create trigger batter_types_sua
  before update on public.batter_types
  for each row execute function public.cap_nhat_thoi_diem_sua();

-- RLS: chỉ người đã đăng nhập (khuôn 0021/0047 — bất biến: bảng mới phải siết).
alter table public.batter_types enable row level security;
drop policy if exists batter_types_toan_quyen on public.batter_types;
drop policy if exists batter_types_nguoi_dung on public.batter_types;
create policy batter_types_nguoi_dung on public.batter_types
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.batter_types from anon;
grant select, insert, update, delete on public.batter_types to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then
    execute 'drop trigger if exists ghi_vet_sql_tg on public.batter_types';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.batter_types
               for each row execute function public.ghi_vet_sua_truc_tiep()';
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết';
  end if;
end $$;

-- Seed các loại bột đang thấy trên sổ (id tất định = khớp seed ở catalogRepo.ts;
-- chạy lại không đè sửa tay: do nothing khi đã có id).
insert into public.batter_types (id, code, name, note) values
  ('bot-24v',   '24V',   'Bột 24V',   'Bột tẩm nước tương'),
  ('bot-18v',   '18V',   'Bột 18V',   'Bột tẩm nước tương'),
  ('bot-220h',  '220H',  'Bột 220H',  'Bột tẩm nước tương'),
  ('bot-232',   '232',   'Bột 232',   'Bột tẩm 5-10'),
  ('bot-20802', '20802', 'Bột 20802', 'Bột tẩm 5-10'),
  ('bot-22601', '22601', 'Bột 22601', ''),
  ('bot-27102', '27102', 'Bột 27102', ''),
  ('bot-2204',  '2204',  'Bột 2204',  '')
on conflict (id) do nothing;

-- Bột ĐI KÈM của mặt hàng (mảng id loại bột). Rỗng = không tẩm bột / chưa gắn.
alter table public.products
  add column if not exists batter_ids text[] not null default '{}';

-- Lượng bột ĐÃ DÙNG theo loại của dòng thành phẩm: { "<tên loại bột>": kg }.
alter table public.production_wips
  add column if not exists batter_kg jsonb not null default '{}'::jsonb;

-- Nạp bột đi kèm cho 2 nhóm mặt hàng đã chốt (chủ dự án, 2026-10-06) — CHỈ dòng
-- còn rỗng ⇒ chạy lại không đè cấu hình đã sửa tay. Khớp luật `suyBotDiKem`
-- (src/lib/botTam.ts) cho bản localStorage / seed mới.
update public.products
   set batter_ids = array['bot-24v', 'bot-18v', 'bot-220h']
 where batter_ids = '{}'
   and name ilike '%tẩm bột nước tương%';

update public.products
   set batter_ids = array['bot-232', 'bot-20802']
 where batter_ids = '{}'
   and name ~* 'tẩm bột 5 ?- ?10( |$)';

-- KIỂM sau khi chạy:
--   select relname, relrowsecurity as rls from pg_class where relname = 'batter_types';
--   select name, batter_ids from public.products where batter_ids <> '{}' order by name;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0051
--
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS batter_kg;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS batter_ids;
-- DROP TABLE IF EXISTS public.batter_types;
-- ============================================================
