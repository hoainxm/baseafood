-- ============================================================
-- Baseafood MES — 0054: SỔ BÁN NỘI ĐỊA (nguyên liệu bán thẳng, không chế biến)
--
-- Vì sao: bảng cân đối giấy có dòng "Bán nội địa" ở khối nguyên liệu (VD −987 kg
-- × 145.000 đ) = nguyên liệu bán THẲNG cho khách trong nước, không đưa vào chế
-- biến (đã chốt Q5–Q6: là bán nội địa VND, KHÔNG phải điều chỉnh tồn). Trước đây
-- không ai ghi số này hằng ngày — kế toán phải nhớ/gom tay khi lập cân đối.
-- Nay tổ trưởng ghi ngay ở màn Sản xuất thành phẩm (/wip) theo từng dòng:
-- loại NL · kg · đơn giá VND · khách; Cân đối điền dòng "Bán nội địa" (dòng giảm
-- khối 1) đúng từng ngày bằng nút "Lấy bán nội địa từ SX".
--
-- Bảng RIÊNG (không thêm dòng đặc biệt vào production_wips): production_wips là
-- sổ bán thành phẩm — tồn BTP/kho dự trữ/đơn đặt đều đọc nó; bán nội địa là
-- nguyên liệu nên trộn vào sẽ làm sai tồn.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới, không đụng bảng/dữ liệu đang có.
-- RLS theo khuôn 0021/0047 ngay từ đầu (chỉ authenticated, revoke anon); trigger
-- cap_nhat_thoi_diem_sua + ghi vết SQL 0048 nếu hàm đã có.
-- Idempotent: chạy lại nhiều lần không lỗi. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.domestic_sales (
  id                 text primary key,
  site_id            text not null default 'bsf1' references public.sites(id),
  sale_date          date not null,                 -- ngày bán (ngày sản xuất của phiên ghi)
  posting_date       date,                          -- ngày ghi sổ (ghi bù khi > sale_date)
  backdate_reason    text not null default '',
  workshop           text not null default 'Đông',
  material_type_name text not null default '',      -- TÊN loại NL (sổ lưu tên như material_imports)
  quantity_kg        numeric(14,3) not null default 0 check (quantity_kg >= 0),
  unit_price         numeric(14,2),                 -- VND/kg, NULL = chưa có giá
  customer_name      text not null default '',
  note               text not null default '',
  operator           text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists domestic_sales_ngay_idx
  on public.domestic_sales (site_id, sale_date, workshop);

drop trigger if exists domestic_sales_sua on public.domestic_sales;
create trigger domestic_sales_sua
  before update on public.domestic_sales
  for each row execute function public.cap_nhat_thoi_diem_sua();

-- RLS: chỉ người đã đăng nhập (khuôn 0021/0047 — bất biến: bảng mới phải siết).
alter table public.domestic_sales enable row level security;
drop policy if exists domestic_sales_toan_quyen on public.domestic_sales;
drop policy if exists domestic_sales_nguoi_dung on public.domestic_sales;
create policy domestic_sales_nguoi_dung on public.domestic_sales
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
revoke all on public.domestic_sales from anon;
grant select, insert, update, delete on public.domestic_sales to authenticated;

-- Ghi vết sửa trực tiếp bằng SQL (0048) — chỉ gắn khi hàm đã có.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then
    execute 'drop trigger if exists ghi_vet_sql_tg on public.domestic_sales';
    execute 'create trigger ghi_vet_sql_tg
               after insert or update or delete on public.domestic_sales
               for each row execute function public.ghi_vet_sua_truc_tiep()';
  else
    raise notice 'Chưa có hàm ghi_vet_sua_truc_tiep (0048) — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (kỳ vọng: rls = true, policy chỉ authenticated):
--   select relname, relrowsecurity as rls from pg_class where relname = 'domestic_sales';
--   select policyname, roles from pg_policies where tablename = 'domestic_sales';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0054 (MẤT sổ bán nội địa đã ghi)
--
-- DROP TABLE IF EXISTS public.domestic_sales;
-- ============================================================
