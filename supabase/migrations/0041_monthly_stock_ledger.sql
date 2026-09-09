-- ============================================================
-- Baseafood MES — 0041: Sổ kho theo THÁNG (dồn tồn cuối kỳ → đầu kỳ sau)
--
-- Vì sao: kế toán/thủ kho đang giữ "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T" trên Excel,
-- mỗi sheet một tháng, dồn tồn cuối kỳ này thành tồn đầu kỳ sau BẰNG TAY → sai số
-- (file thật: tồn đầu tổng nhập khẩu đóng băng 859.444 kg suốt 7 tháng, tồn nội
-- địa reset 0 mỗi tháng — mất carry). Bảng này số hoá đúng sổ đó theo THÁNG DƯƠNG
-- LỊCH, cho MỌI đối tượng (NL nhập khẩu/mua ngoài, BTP, TP đóng gói), giữ song
-- song CTN (kiện) và KG. Màn /ton-kho-thang dồn tồn cuối → đầu tháng sau tự động.
--
-- Tồn cuối = tồn đầu + nhập − xuất (CTN & KG); Tiền còn lại = tồn cuối kg × đơn giá
-- (SUY ở tầng app, KHÔNG lưu — bất biến luôn đúng). Tồn ĐẦU kỳ thì LƯU (là snapshot
-- kế thừa từ tồn cuối tháng trước, đóng băng để không trôi khi sửa tháng cũ).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng, không đụng dữ liệu/bảng đang có.
-- Chạy SAU 0001 (sites). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon+authenticated (như 0022/0024/0032); siết ở nhánh 0021 sau.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.monthly_stock_ledger (
  id              text primary key,
  site_id         text not null default 'bsf1' references public.sites(id),
  period          text not null default '',        -- kỳ = tháng dương lịch 'YYYY-MM'
  category        text not null default '',         -- nhóm: NL nhập khẩu / mua ngoài / BTP / TP …
  warehouse       text not null default '',         -- kho, VD "Kho 1500T"
  item_name       text not null default '',
  size            text not null default '',
  origin          text not null default '',         -- xuất xứ
  import_date     date,                             -- ngày nhập (tham chiếu)
  kg_per_ctn      numeric(14,3),                    -- KG/kiện (cột "KG/GS")
  unit_price      numeric(18,2),                    -- đơn giá VNĐ
  open_ctn        numeric(14,3) not null default 0, -- tồn đầu kỳ (kiện)
  open_kg         numeric(16,3) not null default 0, -- tồn đầu kỳ (kg)
  in_ctn          numeric(14,3) not null default 0, -- nhập trong kỳ (kiện)
  in_kg           numeric(16,3) not null default 0, -- nhập trong kỳ (kg)
  out_ctn         numeric(14,3) not null default 0, -- xuất trong kỳ (kiện)
  out_kg          numeric(16,3) not null default 0, -- xuất trong kỳ (kg)
  carried_from_id text not null default '',         -- id dòng nguồn khi tạo bằng dồn kỳ (rỗng = nhập tay)
  sort_order      integer not null default 0,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists monthly_stock_ledger_idx
  on public.monthly_stock_ledger (site_id, period, category);

-- updated_at tự động + RLS (khuôn giống 0032)
drop trigger if exists monthly_stock_ledger_sua on public.monthly_stock_ledger;
create trigger monthly_stock_ledger_sua
  before update on public.monthly_stock_ledger
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.monthly_stock_ledger enable row level security;
drop policy if exists monthly_stock_ledger_toan_quyen on public.monthly_stock_ledger;
create policy monthly_stock_ledger_toan_quyen on public.monthly_stock_ledger
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0041
--
-- DROP TABLE IF EXISTS public.monthly_stock_ledger;
-- ============================================================
