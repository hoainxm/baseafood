-- ============================================================
-- Baseafood MES — 0049: SỔ IN TEM QR (label_prints)
--
-- Vì sao: tem QR in ở nhiều màn (Nhập hàng · Sản xuất · Đóng gói · Mã lô QR)
-- nhưng không ai biết lô nào ĐÃ in tem, lô nào chưa — dán sót tem là đứt truy
-- xuất ngay ở kho. Nhãn lô BTP/TP còn được SUY RA từ bản ghi (không lưu), nên sửa
-- ngày/xưởng sau khi in thì nhãn trên app lệch nhãn trên tem. Bảng này ghi mỗi
-- lần bấm In: lô nào, nhãn in ra là gì, bao nhiêu tem, ai in, lúc nào.
--   ⇒ lọc "chỉ lô chưa in tem" ở tab In tem hàng loạt
--   ⇒ hộ chiếu lô hiện "đã in tem lúc …", cảnh báo khi nhãn đã in ≠ nhãn hiện tại
-- Thiết kế: docs/spec/qr-truy-xuat-lo.md §6c.
--
--   lot_kind  'S' lô NL (import_shipments.id) · 'W' lô BTP (production_wips.id)
--             'P' lô TP (packagings.id)
--   label     nhãn in trên tem LÚC IN (đông cứng — không suy lại)
--   copies    số tem của lô trong lượt in đó
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới, không đụng bảng/dữ liệu đang có.
-- RLS theo khuôn 0021/0047 ngay từ đầu (chỉ authenticated, revoke anon) — bất
-- biến từ 0047: bảng mới phải kèm siết RLS. Gắn trigger ghi vết SQL của 0048
-- nếu hàm đã có. Idempotent: chạy lại nhiều lần không lỗi. Câu lùi ở cuối file.
-- ============================================================

create table if not exists public.label_prints (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  lot_kind    text not null check (lot_kind in ('S', 'W', 'P')),
  lot_id      text not null,
  label       text not null default '',
  copies      integer not null default 1 check (copies > 0),
  operator    text not null default '',
  printed_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists label_prints_lot_idx on public.label_prints (site_id, lot_kind, lot_id);

drop trigger if exists label_prints_sua on public.label_prints;
create trigger label_prints_sua
  before update on public.label_prints
  for each row execute function public.cap_nhat_thoi_diem_sua();

-- RLS: chỉ người đã đăng nhập (khuôn 0021/0047).
alter table public.label_prints enable row level security;
drop policy if exists label_prints_toan_quyen on public.label_prints;
drop policy if exists label_prints_nguoi_dung on public.label_prints;
create policy label_prints_nguoi_dung on public.label_prints
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.label_prints from anon;
grant select, insert, update, delete on public.label_prints to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then
    execute 'drop trigger if exists ghi_vet_sql_tg on public.label_prints';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.label_prints
               for each row execute function public.ghi_vet_sua_truc_tiep()';
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: 1 dòng, rls = true):
--   select relname, relrowsecurity as rls from pg_class where relname = 'label_prints';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0049 (mất sổ in tem, KHÔNG mất số liệu sổ sách):
--
--   drop table if exists public.label_prints;
-- ============================================================
