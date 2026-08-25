-- ============================================================
-- Baseafood MES — 0026: Đóng gói bán thành phẩm → thành phẩm (G3)
--
-- Vì sao: hệ chỉ có MỘT tồn = bán thành phẩm (BTP, còn khuôn đá). Thực tế
-- BTP còn phải qua ĐÓNG GÓI (rã đông/cắt gọt → vào thùng/gói) mới thành
-- THÀNH PHẨM (TP) sẵn bán — hai trạng thái tồn RIÊNG (doc 34). Bảng này ghi
-- từng phiếu đóng gói: BTP tiêu hao (kg/block) → TP đóng gói ra (kg + số
-- thùng), chênh lệch = hao hụt. Tồn BTP trừ thêm phần đã đóng gói; tồn TP
-- cộng phần ra — cả hai SUY runtime (inventory.ts), không lưu số dư.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng, không đụng dữ liệu đang có.
-- Chạy SAU 0011 (module WIP). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon (như 0011/0022); siết ở nhánh 0021 sau khi login ổn.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.packagings (
  id              text primary key,
  site_id         text not null default 'bsf1' references public.sites(id),
  date            date not null,
  workshop        text not null check (workshop in ('Đông', 'Cá', 'Khô')),
  -- BTP tiêu hao (định danh theo mặt hàng + quy cách, như tồn WIP)
  from_product_id text not null default '',
  from_spec       text not null default '',
  input_kg        numeric(14,3) not null default 0,
  input_blocks    integer not null default 0,
  -- TP đóng gói ra
  to_product_id   text not null default '',
  to_spec         text not null default '',
  output_kg       numeric(14,3) not null default 0,
  output_units    integer not null default 0,      -- số thùng / gói
  warehouse       text not null default '',        -- kho chứa TP đóng gói
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists packagings_idx
  on public.packagings (site_id, date, workshop, from_product_id);

-- updated_at tự động + RLS (khuôn giống 0011/0022)
drop trigger if exists packagings_sua on public.packagings;
create trigger packagings_sua
  before update on public.packagings
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.packagings enable row level security;
drop policy if exists packagings_toan_quyen on public.packagings;
create policy packagings_toan_quyen on public.packagings
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0026
--
-- DROP TABLE IF EXISTS public.packagings;
-- ============================================================
