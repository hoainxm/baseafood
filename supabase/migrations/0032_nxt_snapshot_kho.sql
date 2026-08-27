-- ============================================================
-- Baseafood MES — 0032: Snapshot Xuất–Nhập–Tồn nhập từ báo cáo thật
--
-- Vì sao: module kho cần THẤY kết quả thật ngay. Các màn NXT hiện có (/nxt,
-- /nxt-nl) SUY tồn từ giao dịch — nhưng mã hàng thật của xí nghiệp (dạng
-- "PXĐ.BTNL.TĐ ####") chưa có trong giao dịch nên không hiện được gì. Bảng này
-- giữ NGUYÊN VĂN các dòng của báo cáo Xuất–Nhập–Tồn xuất từ hệ thống đang dùng
-- (theo Kho × Mã hàng × Kỳ) để dựng lại báo cáo khớp 100% trước khi nối giao
-- dịch sống (giai đoạn sau). Nguồn: file "BẠCH TUỘC NL TỰ ĐỘNG THÁNG 7".
--
-- Tồn cuối = tồn đầu + nhập − xuất (suy ở tầng app, KHÔNG lưu — bất biến luôn đúng).
-- Cột giá trị (tiền) giữ theo file; báo cáo nguyên liệu phần lớn để 0.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng, không đụng dữ liệu/bảng đang có.
-- Chạy SAU 0001 (sites). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon+authenticated (như 0022/0024); siết ở nhánh 0021 sau.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.nxt_snapshots (
  id             text primary key,
  site_id        text not null default 'bsf1' references public.sites(id),
  warehouse_code text not null default '',        -- "KHO TP - KHO 1000" (đúng như in trên báo cáo)
  period_from    date,                             -- kỳ báo cáo: từ ngày
  period_to      date,                             -- kỳ báo cáo: đến ngày
  item_code      text not null default '',         -- "PXĐ.BTNL.TĐ 1001"
  item_name      text not null default '',
  unit           text not null default 'KG',
  opening_kg     numeric(16,3) not null default 0,
  in_kg          numeric(16,3) not null default 0,
  out_kg         numeric(16,3) not null default 0,
  opening_value  numeric(18,2) not null default 0,
  in_value       numeric(18,2) not null default 0,
  out_value      numeric(18,2) not null default 0,
  note           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists nxt_snapshots_idx
  on public.nxt_snapshots (site_id, warehouse_code, period_from, period_to);

-- updated_at tự động + RLS (khuôn giống 0024)
drop trigger if exists nxt_snapshots_sua on public.nxt_snapshots;
create trigger nxt_snapshots_sua
  before update on public.nxt_snapshots
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.nxt_snapshots enable row level security;
drop policy if exists nxt_snapshots_toan_quyen on public.nxt_snapshots;
create policy nxt_snapshots_toan_quyen on public.nxt_snapshots
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0032
--
-- DROP TABLE IF EXISTS public.nxt_snapshots;
-- ============================================================
