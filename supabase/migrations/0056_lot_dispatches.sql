-- ============================================================
-- Baseafood MES — 0056: LÔ ĐI RA (lot_dispatches) + LÝ DO CHƯA GẮN LÔ (lot_waivers)
--
-- Vì sao: chuỗi truy xuất QR (0046 lot_inputs) mới nối được NL → BTP → TP. Hàng
-- RA KHỎI xưởng theo ngả bán lẻ (block thô / đóng gói) và bán nội địa NL không
-- biết là lô nào ⇒ hộ chiếu lô truy xuôi dừng ở đóng gói, thu hồi không tới được
-- khách. Lệnh xuất theo đơn đã trỏ lô (export_items.wip_id) nhưng kết quả QUÉT
-- KIỂM khi xếp xe không được lưu ⇒ không có bằng chứng "đã xác nhận đúng lô".
-- Thiết kế: docs/spec/qr-truy-xuat-lo.md §6d.
--
-- 1) lot_dispatches — mỗi dòng = "chứng từ ra này lấy từ lô này (bao nhiêu kg)"
--    (Object/Transaction Event của EPCIS; lot_inputs là Transformation Event).
--      lot_kind  'S' lô NL (import_shipments.id) · 'W' lô BTP (production_wips.id)
--                'P' lô TP (packagings.id)
--      doc_kind  'sales_item' (sales_items.id — bán lẻ) · 'export_item'
--                (export_items.id — quét kiểm khi xếp xe) · 'domestic_sale'
--                (domestic_sales.id — bán nội địa NL bán thẳng)
--      quantity_kg  NULL = chưa cân (giống lot_inputs)
--      method    'quet' | 'go' | 'chon' | 'fifo' (máy tự chọn theo FIFO)
--
-- 2) lot_waivers — mẻ SX (W) / phiếu đóng gói (P) CHƯA gắn lô đầu vào thì khi
--    chốt ngày phải ghi LÝ DO (chủ dự án chốt 2026-10-08: "chốt ngày phải gắn lô
--    hoặc ghi lý do"). Lưu riêng để biết lỗ nào là CÓ CHỦ Ý, lỗ nào là sót.
--
-- KHÔNG thêm cột vào bảng cũ (sales_items, domestic_sales, export_items,
-- production_locks): thêm cột mà deploy trước khi chạy migration thì MỌI lần lưu
-- phiếu bán / chốt ngày lỗi (bài học 0040 + 0028). Bảng riêng: chưa chạy thì chỉ
-- phần gắn lô nằm hàng chờ, bán hàng / chốt ngày vẫn chạy.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 2 bảng mới, không đụng bảng/dữ liệu đang có.
-- RLS theo khuôn 0021/0047/0049 ngay từ đầu (chỉ authenticated, revoke anon);
-- trigger cap_nhat_thoi_diem_sua + ghi vết SQL 0048 nếu hàm đã có.
-- Idempotent: chạy lại nhiều lần không lỗi. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.lot_dispatches (
  id           text primary key,
  site_id      text not null default 'bsf1' references public.sites(id),
  lot_kind     text not null check (lot_kind in ('S', 'W', 'P')),
  lot_id       text not null,
  lot_label    text not null default '',          -- nhãn lô LÚC GẮN (còn tra được khi lô bị xóa)
  doc_kind     text not null check (doc_kind in ('sales_item', 'export_item', 'domestic_sale')),
  doc_id       text not null,
  quantity_kg  numeric(14,3) check (quantity_kg is null or quantity_kg > 0),
  method       text not null default 'chon' check (method in ('quet', 'go', 'chon', 'fifo')),
  operator     text not null default '',
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lot_dispatches_lot_idx on public.lot_dispatches (site_id, lot_kind, lot_id);
create index if not exists lot_dispatches_doc_idx on public.lot_dispatches (site_id, doc_kind, doc_id);

create table if not exists public.lot_waivers (
  id           text primary key,
  site_id      text not null default 'bsf1' references public.sites(id),
  output_kind  text not null check (output_kind in ('W', 'P')),
  output_id    text not null,
  reason       text not null check (length(btrim(reason)) > 0),
  operator     text not null default '',
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lot_waivers_output_idx on public.lot_waivers (site_id, output_kind, output_id);

drop trigger if exists lot_dispatches_sua on public.lot_dispatches;
create trigger lot_dispatches_sua
  before update on public.lot_dispatches
  for each row execute function public.cap_nhat_thoi_diem_sua();

drop trigger if exists lot_waivers_sua on public.lot_waivers;
create trigger lot_waivers_sua
  before update on public.lot_waivers
  for each row execute function public.cap_nhat_thoi_diem_sua();

-- RLS: chỉ người đã đăng nhập (khuôn 0021/0047 — bất biến: bảng mới phải siết).
alter table public.lot_dispatches enable row level security;
drop policy if exists lot_dispatches_toan_quyen on public.lot_dispatches;
drop policy if exists lot_dispatches_nguoi_dung on public.lot_dispatches;
create policy lot_dispatches_nguoi_dung on public.lot_dispatches
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.lot_dispatches from anon;
grant select, insert, update, delete on public.lot_dispatches to authenticated;

alter table public.lot_waivers enable row level security;
drop policy if exists lot_waivers_toan_quyen on public.lot_waivers;
drop policy if exists lot_waivers_nguoi_dung on public.lot_waivers;
create policy lot_waivers_nguoi_dung on public.lot_waivers
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.lot_waivers from anon;
grant select, insert, update, delete on public.lot_waivers to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then
    execute 'drop trigger if exists ghi_vet_sql_tg on public.lot_dispatches';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.lot_dispatches
               for each row execute function public.ghi_vet_sua_truc_tiep()';
    execute 'drop trigger if exists ghi_vet_sql_tg on public.lot_waivers';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.lot_waivers
               for each row execute function public.ghi_vet_sua_truc_tiep()';
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: 2 dòng, rls = true; policy chỉ authenticated):
--   select relname, relrowsecurity as rls from pg_class where relname in ('lot_dispatches', 'lot_waivers');
--   select tablename, policyname, roles from pg_policies where tablename in ('lot_dispatches', 'lot_waivers');

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0056 (MẤT dây lô của dòng bán / kết quả
-- quét kiểm xuất / lý do chưa gắn lô; KHÔNG mất số liệu sổ sách — tồn kho quay về
-- trừ FIFO như trước):
--
--   drop table if exists public.lot_dispatches;
--   drop table if exists public.lot_waivers;
-- ============================================================
