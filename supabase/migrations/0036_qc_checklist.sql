-- ============================================================
-- Baseafood MES — 0036: QC checklist chấm điểm cuối ngày
--
-- Vì sao: họp 2026-09-02 (QĐ-8) — cuối ngày QC/kỹ thuật kiểm bộ ~10 chỉ tiêu
-- (vệ sinh, dụng cụ, thiết bị…), mỗi chỉ tiêu chấm nhanh: đạt / tạm / không đạt
-- (+ điểm tùy chọn) + ghi chú, rồi CHỐT NGÀY. Không viết văn xuôi — chấm điểm cho
-- nhanh. (Ảnh kèm để sau — chưa có hạ tầng lưu ảnh.)
--
-- Hai bảng, đi cùng nhau như module Sản xuất BTP (production_wips + production_locks):
--   qc_checklists — mỗi dòng = một chỉ tiêu của (ngày × phân xưởng).
--   qc_locks      — chốt ngày QC (cùng hình dạng daily_locks/production_locks).
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 2 bảng mới, không đụng dữ liệu đang có.
-- Chạy lại nhiều lần vẫn không lỗi (idempotent). RLS mở cho anon như 0011/0029;
-- siết theo đăng nhập ở 0021 (nhớ chạy lại 0021 — đã bổ sung 2 bảng này).
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.qc_checklists (
  id              text primary key,
  site_id         text not null default 'bsf1' references public.sites(id),
  date            date not null,
  workshop        text not null check (workshop in ('Đông', 'Cá', 'Khô')),
  criterion       text not null default '',                          -- tên chỉ tiêu
  result          text not null default 'dat'
                    check (result in ('dat', 'tam', 'khong-dat')),   -- đạt / tạm / không đạt
  score           numeric(4,1),                                      -- điểm tùy chọn 0–10 (nullable)
  note            text not null default '',
  backdate_reason text not null default '',                          -- lý do ghi bù
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists qc_checklists_idx
  on public.qc_checklists (site_id, date, workshop);

create table if not exists public.qc_locks (
  id                text primary key,
  site_id           text not null default 'bsf1' references public.sites(id),
  lock_date         date not null,
  workshop          text not null check (workshop in ('Đông', 'Cá', 'Khô')),
  is_locked         boolean not null default true,
  locked_at         text not null default '',
  total_kg_at_lock  numeric(14,3) not null default 0,   -- không dùng cho QC, giữ để cùng hình dạng
  reopen_reason     text not null default '',
  note              text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists qc_locks_idx
  on public.qc_locks (site_id, lock_date, workshop);

-- updated_at tự động + RLS mở (khuôn giống 0011/0029; siết ở 0021)
drop trigger if exists qc_checklists_sua on public.qc_checklists;
create trigger qc_checklists_sua
  before update on public.qc_checklists
  for each row execute function public.cap_nhat_thoi_diem_sua();

drop trigger if exists qc_locks_sua on public.qc_locks;
create trigger qc_locks_sua
  before update on public.qc_locks
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.qc_checklists enable row level security;
drop policy if exists qc_checklists_toan_quyen on public.qc_checklists;
create policy qc_checklists_toan_quyen on public.qc_checklists
  for all to anon, authenticated
  using (true) with check (true);

alter table public.qc_locks enable row level security;
drop policy if exists qc_locks_toan_quyen on public.qc_locks;
create policy qc_locks_toan_quyen on public.qc_locks
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0036
--
-- DROP TABLE IF EXISTS public.qc_checklists;
-- DROP TABLE IF EXISTS public.qc_locks;
-- ============================================================
