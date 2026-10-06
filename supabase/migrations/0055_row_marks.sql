-- ============================================================
-- Baseafood MES — 0055: TÔ MÀU DÒNG (row_marks) — đánh dấu "đã dò" kiểu Excel
--
-- Vì sao: kế toán dò sổ trên app như dò bảng kê Excel — dò tới dòng nào thì tô
-- màu + in đậm dòng đó để biết chỗ nào đã kiểm. Đánh dấu phải LƯU CHUNG (mọi
-- máy, mọi người cùng thấy; đổi máy hay xoá trình duyệt không mất), nên không
-- để ở localStorage.
--
-- MỘT bảng dùng chung cho MỌI bảng trên app — KHÔNG thêm cột màu vào từng bảng
-- nghiệp vụ (đánh dấu là chuyện trình bày, không phải số sổ sách):
--   table_key   khoá ổn định của bảng/màn (VD 'ton-kho-thang', 'nhap-hang')
--   row_id      id BẢN GHI của dòng (KHÔNG phải chỉ số dòng — sắp xếp/lọc lại
--               không làm lệch dấu)
--   column_key  NULL = cả dòng. Chừa sẵn cho tô ô lẻ về sau.
--   color       'vang' · 'xanh-la' · 'xanh-duong' · 'do' · '' (chỉ in đậm).
--               Không đặt CHECK: thêm màu về sau không phải sửa bảng — app tự
--               bỏ qua mã màu lạ.
--   bold        in đậm dòng
-- id tất định = table_key + row_id + column_key (app dựng) ⇒ mỗi ô/dòng đúng một
-- dấu, ghi lại chỉ cập nhật. Bỏ tô = xoá dòng dấu. Không đụng bảng nghiệp vụ nào.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới, không đụng bảng/dữ liệu đang có.
-- RLS theo khuôn 0021/0047 ngay từ đầu (chỉ authenticated, revoke anon); trigger
-- cap_nhat_thoi_diem_sua + ghi vết SQL 0048 nếu hàm đã có.
-- Idempotent: chạy lại nhiều lần không lỗi. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.row_marks (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  table_key   text not null,
  row_id      text not null,
  column_key  text,                               -- NULL = cả dòng
  color       text not null default '',
  bold        boolean not null default false,
  marked_by   text not null default '',
  marked_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists row_marks_bang_idx
  on public.row_marks (site_id, table_key);

drop trigger if exists row_marks_sua on public.row_marks;
create trigger row_marks_sua
  before update on public.row_marks
  for each row execute function public.cap_nhat_thoi_diem_sua();

-- RLS: chỉ người đã đăng nhập (khuôn 0021/0047 — bất biến: bảng mới phải siết).
alter table public.row_marks enable row level security;
drop policy if exists row_marks_toan_quyen on public.row_marks;
drop policy if exists row_marks_nguoi_dung on public.row_marks;
create policy row_marks_nguoi_dung on public.row_marks
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.row_marks from anon;
grant select, insert, update, delete on public.row_marks to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then
    execute 'drop trigger if exists ghi_vet_sql_tg on public.row_marks';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.row_marks
               for each row execute function public.ghi_vet_sua_truc_tiep()';
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: rls = true, policy chỉ authenticated):
--   select relname, relrowsecurity as rls from pg_class where relname = 'row_marks';
--   select policyname, roles from pg_policies where tablename = 'row_marks';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0055 (MẤT mọi dấu tô màu đã ghi;
-- số liệu sổ sách KHÔNG bị ảnh hưởng)
--
-- DROP TABLE IF EXISTS public.row_marks;
-- ============================================================
