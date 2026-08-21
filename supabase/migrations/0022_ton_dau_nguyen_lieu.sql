-- ============================================================
-- Baseafood MES — 0022: Tồn đầu kho nguyên liệu (số dư trước khi số hoá)
--
-- Vì sao: sổ Nhập–Xuất–Tồn nguyên liệu (màn NXT nguyên liệu) suy TỒN ra từ
-- vòng chuyển kỳ của Cân đối (đông gửi ↔ xả đông). Nhưng kỳ ĐẦU TIÊN của mỗi
-- họ nguyên liệu không có kỳ trước để kế thừa tồn đầu — số dư đông dự trữ có
-- sẵn TRƯỚC khi dùng app phải khai tay một lần. Bảng này giữ đúng con số đó.
--
-- Chỉ KG (theo quyết định nghiệp vụ: sổ tồn NL kg thuần, giá trị vẫn ở Cân đối).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng, không đụng dữ liệu đang có.
-- Chạy SAU 0001. Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon (như 0011); siết ở nhánh 0021 sau khi login ổn.
-- Câu lùi ở khối ROLLBACK cuối file.
--
-- QUY ƯỚC ĐẶT TÊN: hệ CSDL đã đổi sang tiếng Anh từ 0016 (sites, material_imports,
-- balancing_inputs…) — bảng mới theo đúng quy ước hiện hành đó.
-- ============================================================

create table if not exists public.material_opening_stock (
  id                 text primary key,
  site_id            text not null default 'bsf1' references public.sites(id),
  workshop           text not null check (workshop in ('Đông', 'Cá', 'Khô')),
  material_type_name text not null default '',      -- tên loại NL (theo tên, như sổ nhập)
  as_of_date         date not null,                 -- tồn đầu tính từ ngày này
  quantity_kg        numeric(14,3) not null default 0,
  note               text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists material_opening_stock_idx
  on public.material_opening_stock (site_id, workshop, material_type_name, as_of_date);

-- updated_at tự động + RLS (khuôn giống 0011/0017)
drop trigger if exists material_opening_stock_sua on public.material_opening_stock;
create trigger material_opening_stock_sua
  before update on public.material_opening_stock
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.material_opening_stock enable row level security;
drop policy if exists material_opening_stock_toan_quyen on public.material_opening_stock;
create policy material_opening_stock_toan_quyen on public.material_opening_stock
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0022
--
-- DROP TABLE IF EXISTS public.material_opening_stock;
-- ============================================================
