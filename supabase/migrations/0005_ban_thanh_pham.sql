-- ============================================================
-- Baseafood MES — 0005: bán thành phẩm hằng ngày
--
-- Chạy SAU 0001 (và không phụ thuộc 0004). An toàn với dữ liệu đang có
-- (chỉ THÊM bảng/cột, không xóa). Chạy lại nhiều lần vẫn không lỗi.
--
-- Ba việc:
--   1. `phieu_ban`  — một phiếu bán = MỘT khách nhận hàng một lượt (song song
--      với `chuyen_nhap`). Tách hai ngày `ngay_giao` (hàng thực xuất bán — mọi
--      tổng hợp tính theo ngày này) và `ngay_ghi_so` (ngày ghi vào hệ thống);
--      ghi sau ⇒ ghi bù, phải có lý do. Kênh nằm ở phiếu: Xuất khẩu ⇒ đơn giá
--      USD, Nội địa ⇒ VND.
--   2. `ban_hang`   — dòng bán trong phiếu: mặt hàng + quy cách (size) + kg +
--      đơn giá. `kho_nguon` để dành cho tồn kho tương lai (xuất từ kho SX / kho
--      lưu trữ), v1 chưa dùng.
--   3. Nới `thanh_pham_ra`: thêm `quy_cach` + `ban_hang_id` để cân đối HÚT dòng
--      bán vào kỳ (khối thành phẩm ra) mà chống hút trùng.
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

-- ============================================================
-- 1. Phiếu bán
-- ============================================================

create table if not exists public.phieu_ban (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  ngay_giao     date not null,                        -- hàng thực xuất bán
  ngay_ghi_so   date not null,                        -- ngày ghi vào hệ thống
  ly_do_ghi_bu  text not null default '',             -- bắt buộc khi ghi_so > giao
  phan_xuong    text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  khach_hang_id text not null default '',             -- danh mục khách (đầu ra)
  kenh          text not null check (kenh in ('Xuất khẩu', 'Nội địa')),
  ghi_chu       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists phieu_ban_ngay_idx
  on public.phieu_ban (xi_nghiep_id, ngay_giao, phan_xuong);

-- ============================================================
-- 2. Dòng bán trong phiếu
-- ============================================================

create table if not exists public.ban_hang (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  phieu_id     text not null default '',              -- về phiếu_ban
  ngay         date,                                  -- chép từ phiếu.ngay_giao
  mat_hang_id  text not null default '',              -- danh mục mặt hàng (mở)
  quy_cach     text not null default '',              -- size/grade VD "18-20"
  luong_kg     numeric(14,3) not null default 0,
  don_gia      numeric(14,2),                         -- USD nếu XK, VND nếu NĐ
  kho_nguon    text not null default '',              -- seam tồn kho, v1 để trống
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ban_hang_phieu_idx
  on public.ban_hang (phieu_id);
create index if not exists ban_hang_ngay_idx
  on public.ban_hang (xi_nghiep_id, ngay);

-- ============================================================
-- 3. Cân đối hút dòng bán vào khối thành phẩm ra
-- ============================================================

alter table public.thanh_pham_ra
  add column if not exists quy_cach    text not null default '',
  add column if not exists ban_hang_id text not null default '';

-- ============================================================
-- 4. updated_at + RLS cho hai bảng mới
--
-- ⚠️ Vẫn mở cho `anon` như 0001 — app chưa có đăng nhập, CHỈ chạy trong mạng
-- nội bộ xí nghiệp. `0003_siet_rls.sql` siết lại sau khi có đăng nhập.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['phieu_ban', 'ban_hang'] loop
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
