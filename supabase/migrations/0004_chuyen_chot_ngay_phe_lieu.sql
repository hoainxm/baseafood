-- ============================================================
-- Baseafood MES — 0004: chuyến nhập thật · chốt ngày · phế liệu tại màn nhập
--
-- Chạy SAU 0001. An toàn với dữ liệu đang có (chỉ thêm bảng/cột, không xóa).
--
-- Ba việc:
--   1. `chuyen_nhap` — chuyến thật (1 đại lý, 1 lượt giao). Trước đây chuyến chỉ
--      gom ngầm theo (ngày + đại lý + xe) nên một đại lý giao hai lượt trong
--      ngày bị đếm thành một chuyến.
--      Kèm TÁCH HAI NGÀY: `ngay_giao` (hàng thực về — mọi tổng hợp tính theo
--      ngày này) và `ngay_ghi_so` (ngày ghi vào hệ thống). Hàng về 29/7 mà 31/7
--      mới có chứng từ ⇒ ghi bù, phải có lý do.
--   2. `chot_ngay` — khóa số liệu một (ngày + phân xưởng) sau khi cộng xong.
--   3. `phe_lieu` — nới để nhận dòng cân ở màn Nhập hàng: `ky_id` cho phép rỗng,
--      thêm `ngay` / `phan_xuong` / `nguon`. Cân đối hút dòng đó vào kỳ (gán
--      `ky_id`) thay vì nhập lại — một số liệu chỉ một nguồn chuẩn.
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

-- ============================================================
-- 1. Chuyến nhập
-- ============================================================

create table if not exists public.chuyen_nhap (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ngay_giao    date not null,                       -- hàng thực về xưởng
  ngay_ghi_so  date not null,                       -- ngày ghi vào hệ thống
  ly_do_ghi_bu text not null default '',            -- bắt buộc khi ghi_so > giao
  phan_xuong   text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  ten_dai_ly   text not null default '',
  tai_xe       text not null default '',
  bien_so_xe   text not null default '',
  ghi_chu      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists chuyen_nhap_ngay_idx
  on public.chuyen_nhap (xi_nghiep_id, ngay_giao, phan_xuong);

-- Dòng loại hàng gắn về chuyến. Để rỗng với dữ liệu cũ — app tự gom ngầm các
-- dòng chưa có chuyến theo (ngày + đại lý + xe) khi hiển thị.
alter table public.nhap_nguyen_lieu
  add column if not exists chuyen_id text not null default '';

create index if not exists nhap_nguyen_lieu_chuyen_idx
  on public.nhap_nguyen_lieu (chuyen_id);

-- ============================================================
-- 2. Chốt số liệu theo ngày + phân xưởng
-- ============================================================

-- `da_chot = false` là ĐÃ MỞ LẠI, không xóa bản ghi (giữ vết ai mở, vì sao).
create table if not exists public.chot_ngay (
  id               text primary key,
  xi_nghiep_id     text not null default 'bsf1' references public.xi_nghiep(id),
  ngay             date not null,
  phan_xuong       text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  da_chot          boolean not null default true,
  chot_luc         timestamptz not null default now(),
  tong_kg_luc_chot numeric(14,3) not null default 0,  -- để đối chiếu khi ghi bù
  ly_do_mo_lai     text not null default '',
  ghi_chu          text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists chot_ngay_ngay_xuong_idx
  on public.chot_ngay (xi_nghiep_id, ngay, phan_xuong);

-- ============================================================
-- 3. Phế liệu — nhận thêm dòng cân ở màn Nhập hàng
-- ============================================================

alter table public.phe_lieu alter column ky_id drop not null;

alter table public.phe_lieu
  add column if not exists ngay date,
  add column if not exists phan_xuong text not null default '',
  add column if not exists nguon text not null default 'Cân đối';

-- Dòng cũ đều do màn Cân đối nhập tay.
update public.phe_lieu set nguon = 'Cân đối' where nguon = '' or nguon is null;

alter table public.phe_lieu drop constraint if exists phe_lieu_nguon_check;
alter table public.phe_lieu
  add constraint phe_lieu_nguon_check check (nguon in ('Nhập hàng', 'Cân đối'));

alter table public.phe_lieu drop constraint if exists phe_lieu_phan_xuong_check;
alter table public.phe_lieu
  add constraint phe_lieu_phan_xuong_check
  check (phan_xuong in ('', 'Đông', 'Cá', 'Khô'));

create index if not exists phe_lieu_ngay_idx
  on public.phe_lieu (xi_nghiep_id, ngay, phan_xuong);

-- ============================================================
-- 4. updated_at + RLS cho hai bảng mới
--
-- ⚠️ Vẫn mở cho `anon` như 0001 — app chưa có đăng nhập, CHỈ chạy trong mạng
-- nội bộ xí nghiệp. `0003_siet_rls.sql` siết lại sau khi có đăng nhập.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['chuyen_nhap', 'chot_ngay'] loop
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
