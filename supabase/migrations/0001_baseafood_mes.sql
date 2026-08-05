-- ============================================================
-- Baseafood MES — toàn bộ schema nghiệp vụ
-- Chạy trên project Supabase của Baseafood (URL lấy ở Dashboard).
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
--
--   ✔  nhap_nguyen_lieu, so_luong_kg, phan_xuong
--   ✘  "nhập_nguyên_liệu"  — Postgres cho phép nhưng phải bọc nháy kép ở MỌI
--      câu lệnh; tệ hơn là dấu tiếng Việt có hai cách mã hóa Unicode (NFC/NFD)
--      trông y hệt nhau nhưng là hai định danh khác nhau → copy từ Word/Chrome
--      về là gặp lỗi "relation does not exist" không hiểu vì sao.
--   ✘  raw_materials, customers — mất nghĩa nghiệp vụ với người đọc sổ.
--
-- Bỏ tiền tố `mes_` vì bảng của SDFactory đã dọn (xem 0002) — project này giờ
-- chỉ phục vụ MES.
-- ============================================================

-- Dọn bản nháp cũ nếu đã lỡ chạy migration trước đó.
drop table if exists public.mes_tp_ra       cascade;
drop table if exists public.mes_phe_lieu    cascade;
drop table if exists public.mes_nl_vao      cascade;
drop table if exists public.mes_ky_can_doi  cascade;
drop table if exists public.mes_nhap_nl     cascade;
drop table if exists public.mes_khach_hang  cascade;
drop table if exists public.mes_mat_hang    cascade;
drop table if exists public.mes_loai_nl     cascade;
drop table if exists public.mes_dai_ly      cascade;
drop function if exists public.mes_touch_updated_at() cascade;

-- ============================================================
-- 1. Xí nghiệp (multi-site)
-- ============================================================

create table if not exists public.xi_nghiep (
  id         text primary key,
  ma         text unique not null,
  ten        text not null,
  dia_chi    text not null default '',
  created_at timestamptz not null default now()
);

insert into public.xi_nghiep (id, ma, ten, dia_chi)
values ('bsf1', 'BSF1', 'Xí nghiệp Baseafood BSF1', 'Bà Rịa')
on conflict (id) do nothing;

-- ============================================================
-- 2. Danh mục
-- ============================================================

-- Đại lý cung cấp nguyên liệu (đầu vào)
create table if not exists public.dai_ly (
  id          text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ma          text not null default '',
  ten         text not null,
  dien_thoai  text not null default '',
  ghi_chu     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Loại / quy cách nguyên liệu, VD "2 da nguyên liệu", "Mực ống 7cm"
create table if not exists public.loai_nguyen_lieu (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ten          text not null,
  loai         text not null default '',   -- thuộc loài: Bạch tuộc / Mực / Cá…
  ghi_chu      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Danh mục thành phẩm kế toán (141 mã, tài khoản 1551).
-- Trước nằm trong src/data/thanh-pham.json — nay đưa hết lên DB, app tự nạp
-- lần đầu nếu bảng rỗng.
create table if not exists public.thanh_pham (
  ma           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ten          text not null,
  dvt          text not null default 'kg',
  ma_tai_khoan text not null default '1551',
  nhom         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Mặt hàng dùng khi cân đối (có thể ánh xạ sang mã thành phẩm kế toán)
create table if not exists public.mat_hang (
  id            text primary key,
  xi_nghiep_id  text not null default 'bsf1' references public.xi_nghiep(id),
  ma            text not null default '',
  ten           text not null,
  ma_thanh_pham text not null default '',   -- ánh xạ tới thanh_pham.ma (lỏng, cho phép rỗng)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Khách mua thành phẩm (đầu ra) — khác đại lý cung cấp nguyên liệu
create table if not exists public.khach_hang (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ma           text not null default '',
  ten          text not null,
  thi_truong   text not null default '',    -- Nhật / EU / Nội địa…
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- 3. Nhập nguyên liệu hàng ngày
-- ============================================================

-- Mỗi dòng = một chuyến hàng của đại lý.
-- ten_dai_ly / ten_loai_nguyen_lieu lưu TÊN chứ không phải khóa ngoại: sổ sách
-- phải giữ nguyên tên tại thời điểm nhập, đại lý đổi tên sau này không được
-- làm sai bản ghi đã chốt.
create table if not exists public.nhap_nguyen_lieu (
  id                   text primary key,
  xi_nghiep_id         text not null default 'bsf1' references public.xi_nghiep(id),
  ngay                 date not null,
  phan_xuong           text not null check (phan_xuong in ('Đông', 'Cá', 'Khô')),
  loai                 text not null,          -- loài: Bạch tuộc / Mực / Cá / Tôm / Ghẹ / Khác
  ten_dai_ly           text not null default '',
  ten_loai_nguyen_lieu text not null default '',
  so_luong_kg          numeric(14,3) not null default 0 check (so_luong_kg >= 0),
  don_gia              numeric(14,2) check (don_gia is null or don_gia >= 0),
  tai_xe               text not null default '',
  bien_so_xe           text not null default '',
  ghi_chu              text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists nhap_nguyen_lieu_ngay_idx
  on public.nhap_nguyen_lieu (xi_nghiep_id, ngay, phan_xuong);
create index if not exists nhap_nguyen_lieu_dai_ly_idx
  on public.nhap_nguyen_lieu (xi_nghiep_id, ten_dai_ly);

-- ============================================================
-- 4. Cân đối theo kỳ
-- ============================================================

create table if not exists public.ky_can_doi (
  id                   text primary key,
  xi_nghiep_id         text not null default 'bsf1' references public.xi_nghiep(id),
  ten_loai_nguyen_lieu text not null,
  mo_ta_ngay           text not null default '',   -- chuỗi hiển thị / in trên bảng
  tu_ngay              date,
  den_ngay             date,
  tong_nl_nhan_kg      numeric(14,3),
  ti_gia               numeric(14,2),              -- VND / USD
  chi_phi_che_bien     numeric(14,2),              -- VND / kg thành phẩm
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists ky_can_doi_ngay_idx
  on public.ky_can_doi (xi_nghiep_id, tu_ngay desc);

-- Khối 1: nguyên liệu vào
create table if not exists public.nguyen_lieu_vao (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ky_id        text not null references public.ky_can_doi(id) on delete cascade,
  nhom         text not null check (nhom in ('Thủy sản', 'Xả đông', 'Bột phụ gia')),
  ten          text not null,
  so_luong_kg  numeric(14,3) not null default 0 check (so_luong_kg >= 0),
  don_gia      numeric(14,2),
  ty_le_phan_tram numeric(8,3),                  -- dùng cho bột phụ gia
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Khối 2: phế liệu bán giá riêng
create table if not exists public.phe_lieu (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ky_id        text not null references public.ky_can_doi(id) on delete cascade,
  loai         text not null,                    -- nội tạng, dạt…
  so_luong_kg  numeric(14,3) not null default 0 check (so_luong_kg >= 0),
  don_gia_ban  numeric(14,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Khối 3: thành phẩm ra
create table if not exists public.thanh_pham_ra (
  id           text primary key,
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ky_id        text not null references public.ky_can_doi(id) on delete cascade,
  mat_hang_id  text not null default '',
  khach_hang_id text not null default '',
  kenh         text not null check (kenh in ('Xuất khẩu', 'Nội địa')),
  luong_kg     numeric(14,3) not null default 0 check (luong_kg >= 0),
  don_gia      numeric(14,2),                    -- USD nếu xuất khẩu, VND nếu nội địa
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists nguyen_lieu_vao_ky_idx on public.nguyen_lieu_vao (ky_id);
create index if not exists phe_lieu_ky_idx        on public.phe_lieu (ky_id);
create index if not exists thanh_pham_ra_ky_idx   on public.thanh_pham_ra (ky_id);

-- ============================================================
-- 5. updated_at tự cập nhật
-- ============================================================

create or replace function public.cap_nhat_thoi_diem_sua()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'dai_ly','loai_nguyen_lieu','thanh_pham','mat_hang','khach_hang',
    'nhap_nguyen_lieu','ky_can_doi','nguyen_lieu_vao','phe_lieu','thanh_pham_ra'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_sua', t);
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.cap_nhat_thoi_diem_sua()',
      t || '_sua', t);
  end loop;
end $$;

-- ============================================================
-- 6. RLS
--
-- ⚠️ Giai đoạn hiện tại app CHƯA có đăng nhập, chạy bằng anon key trong mạng
-- nội bộ xí nghiệp → mở quyền cho anon để dùng được. Anon key nằm trong bundle
-- JS ai cũng đọc được, nên TUYỆT ĐỐI KHÔNG mở app ra ngoài mạng nội bộ khi
-- policy còn ở dạng này. Bật Supabase Auth xong phải thay bằng ràng buộc theo
-- người dùng / vai trò và thu hồi quyền của anon.
-- ============================================================

alter table public.xi_nghiep enable row level security;
drop policy if exists xi_nghiep_doc on public.xi_nghiep;
create policy xi_nghiep_doc on public.xi_nghiep
  for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array[
    'dai_ly','loai_nguyen_lieu','thanh_pham','mat_hang','khach_hang',
    'nhap_nguyen_lieu','ky_can_doi','nguyen_lieu_vao','phe_lieu','thanh_pham_ra'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_toan_quyen', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated
       using (true) with check (true)',
      t || '_toan_quyen', t);
  end loop;
end $$;
