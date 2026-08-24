-- ============================================================
-- Baseafood MES — 0024: Tồn đầu kho thành phẩm (số dư trước khi số hoá)
--
-- Vì sao: sổ Nhập–Xuất–Tồn thành phẩm (màn Báo cáo NXT) suy TỒN từ lịch sử
-- sản xuất (BTP nhập kho) − xuất (đơn đặt + bán ngày). Nhưng số dư bán thành
-- phẩm cấp đông đã có sẵn TRƯỚC khi dùng app (chưa có dòng sản xuất nào) phải
-- khai tay một lần theo (mặt hàng × quy cách). Bảng này giữ đúng con số đó.
-- Đối xứng với 0022 (tồn đầu nguyên liệu), nhưng khóa theo mặt hàng thành phẩm.
--
-- Chỉ KG + block (giá trị tiền vẫn ở Cân đối).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng, không đụng dữ liệu đang có.
-- Chạy SAU 0001 + 0011 (products). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon+authenticated (như 0022); siết ở nhánh 0021 sau khi login ổn.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.finished_goods_opening_stock (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  product_id    text not null default '',        -- mặt hàng (products.id)
  spec          text not null default '',        -- quy cách/size
  as_of_date    date not null,                   -- tồn đầu tính từ ngày này
  quantity_kg   numeric(14,3) not null default 0,
  blocks_count  numeric(14,3) not null default 0,
  warehouse     text not null default '',        -- kho dự trữ (tùy chọn)
  note          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists finished_goods_opening_stock_idx
  on public.finished_goods_opening_stock (site_id, product_id, spec, as_of_date);

-- updated_at tự động + RLS (khuôn giống 0022)
drop trigger if exists finished_goods_opening_stock_sua on public.finished_goods_opening_stock;
create trigger finished_goods_opening_stock_sua
  before update on public.finished_goods_opening_stock
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.finished_goods_opening_stock enable row level security;
drop policy if exists finished_goods_opening_stock_toan_quyen on public.finished_goods_opening_stock;
create policy finished_goods_opening_stock_toan_quyen on public.finished_goods_opening_stock
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0024
--
-- DROP TABLE IF EXISTS public.finished_goods_opening_stock;
-- ============================================================
