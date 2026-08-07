-- ============================================================
-- Baseafood MES — 0011: module WIP (sản xuất BTP · kho dự trữ · đơn đặt · lệnh xuất)
--
-- Chạy SAU 0001. An toàn với dữ liệu đang có (CHỈ THÊM bảng). Idempotent.
-- Số hoá vòng lặp cốt lõi: sản xuất BTP ngày → cấp đông → kho dự trữ →
-- gom đủ đơn đặt → xuất container → nối sổ Bán hàng.
-- Xem ba-spec 34 + design-spec 35.
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

-- 1. Dòng sản lượng BTP sản xuất ngày (owner: Tổ trưởng SX)
create table if not exists public.san_xuat_btp (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  ngay          date not null,                     -- ngày SX thật (mọi tổng hợp)
  ngay_ghi_so   date,                              -- ghi sau ⇒ ghi bù
  ly_do_ghi_bu  text not null default '',
  phan_xuong    text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  mat_hang_id   text not null default '',          -- danh mục mặt hàng (mở)
  quy_cach      text not null default '',          -- size/grade
  luong_kg      numeric(14,3) not null default 0,
  so_block      numeric(14,3) not null default 0,
  kho           text not null default '',          -- phòng đông đích (nhiều kho)
  trang_thai    text not null default 'cho-nhap',  -- cho-nhap | da-nhap
  ghi_chu       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists san_xuat_btp_ngay_idx
  on public.san_xuat_btp (xi_nghiep_id, ngay, phan_xuong);

-- 2. Chốt ngày sản xuất (riêng với chot_ngay của nhập hàng)
create table if not exists public.chot_san_xuat (
  id                text primary key,
  xi_nghiep_id      text not null default 'bsf1' references public.xi_nghiep(id),
  ngay              date not null,
  phan_xuong        text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  da_chot           boolean not null default true,
  chot_luc          timestamptz,
  tong_kg_luc_chot  numeric(14,3) not null default 0,
  ly_do_mo_lai      text not null default '',
  ghi_chu           text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists chot_san_xuat_ngay_xuong_idx
  on public.chot_san_xuat (xi_nghiep_id, ngay, phan_xuong);

-- 3. Đơn đặt của khách (owner: Phòng KH)
create table if not exists public.don_dat (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  khach_id      text not null default '',
  ngay_dat      date not null,
  trang_thai    text not null default 'dang-gom',  -- dang-gom | du | dong
  ghi_chu       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists don_dat_ngay_idx
  on public.don_dat (xi_nghiep_id, ngay_dat);

-- 4. Dòng cần của đơn (mặt hàng × quy cách × kg/block cần)
create table if not exists public.dong_don (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  don_id        text not null default '',
  mat_hang_id   text not null default '',
  quy_cach      text not null default '',
  luong_kg_can  numeric(14,3) not null default 0,
  so_block_can  numeric(14,3) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dong_don_don_idx on public.dong_don (don_id);

-- 5. Lệnh xuất container (từ đơn đủ; cho xuất một phần)
create table if not exists public.lenh_xuat (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  don_id        text not null default '',
  ngay          date not null,
  trang_thai    text not null default 'mo',         -- mo | dong
  ghi_chu       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists lenh_xuat_don_idx on public.lenh_xuat (don_id);

-- 6. Dòng thực xuất (trừ tồn theo lô sản xuất)
create table if not exists public.dong_lenh (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  lenh_id       text not null default '',
  san_xuat_id   text not null default '',           -- lô nguồn (dòng san_xuat_btp)
  mat_hang_id   text not null default '',
  quy_cach      text not null default '',
  luong_kg      numeric(14,3) not null default 0,
  so_block      numeric(14,3) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists dong_lenh_lenh_idx on public.dong_lenh (lenh_id);

-- 7. updated_at trigger + RLS mở cho anon (như 0001; siết ở 0003 sau)
do $$
declare t text;
begin
  foreach t in array array[
    'san_xuat_btp', 'chot_san_xuat', 'don_dat', 'dong_don', 'lenh_xuat', 'dong_lenh'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_sua', t);
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.cap_nhat_thoi_diem_sua()',
      t || '_sua', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_toan_quyen', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated
       using (true) with check (true)',
      t || '_toan_quyen', t);
  end loop;
end $$;
