-- ============================================================
-- Baseafood MES — 0043: Lưu bản đối soát hóa đơn theo TÀI KHOẢN (/doi-soat)
--
-- Vì sao: màn Đối soát hóa đơn (/doi-soat) trước đây chỉ import → xử lý → tải về,
-- KHÔNG lưu lại. Kế toán cần lưu bản NHÁP / CHÍNH THỨC ngay trên webapp theo từng
-- tài khoản để mở lại / đối chiếu về sau. Bảng này lưu MỖI LẦN đối soát: file gốc
-- (base64, để mở lại chạy lại) + tham số (ngưỡng/sửa/sổ chọn) + ảnh chụp tóm tắt
-- kết quả (4 nhãn + tổng chênh) — bản CHÍNH THỨC đóng băng tóm tắt đó.
--
-- Vì sao base64 trong bảng (không dùng Storage): giữ file dưới RLS của chính bảng
-- này (tránh phải cấu hình quyền đọc Storage theo user — nguồn rò rỉ dữ liệu hóa
-- đơn), và chạy được cả chế độ localStorage (offline) lẫn Supabase. File xlsx ~
-- 100–400KB/lần, vài chục bản là chấp nhận được cho công cụ kế toán.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới, không đụng dữ liệu/bảng đang có.
-- Chạy SAU 0001 (sites). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon+authenticated (như 0041) — riêng tư theo tài khoản đang ép ở
-- TẦNG APP (chỉ hiện bản của chủ + admin), giống cách app gate các màn khác; siết
-- RLS server theo user_id (`user_id = auth.uid()`) để ở nhánh 0021 sau (xem cuối).
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.reconciliation_runs (
  id              text primary key,
  site_id         text not null default 'bsf1' references public.sites(id),
  user_id         text not null default '',         -- id tài khoản tạo (auth.uid) — chủ sở hữu
  owner_username  text not null default '',
  owner_name      text not null default '',
  title           text not null default '',
  period          text not null default '',         -- kỳ, VD "T02-2026"
  status          text not null default 'draft',     -- 'draft' (nháp) | 'official' (chính thức)
  threshold       numeric(18,2) not null default 1,  -- ngưỡng khớp (đ)
  file_name       text not null default '',
  file_b64        text not null default '',          -- file Excel gốc, base64 (để mở lại chạy lại)
  options         jsonb not null default '{}'::jsonb, -- { soChuanTen, edits } để tái dựng
  summary         jsonb not null default '{}'::jsonb, -- ảnh chụp tóm tắt (đóng băng cho bản chính thức)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists reconciliation_runs_idx
  on public.reconciliation_runs (site_id, user_id, period);

-- updated_at tự động + RLS (khuôn giống 0041)
drop trigger if exists reconciliation_runs_sua on public.reconciliation_runs;
create trigger reconciliation_runs_sua
  before update on public.reconciliation_runs
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.reconciliation_runs enable row level security;
drop policy if exists reconciliation_runs_toan_quyen on public.reconciliation_runs;
create policy reconciliation_runs_toan_quyen on public.reconciliation_runs
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- SIẾT RLS THEO TÀI KHOẢN (làm ở nhánh 0021 khi mở app ra ngoài mạng nội bộ) —
-- chép ra, bỏ comment để thay policy mở ở trên bằng bản riêng-tư-theo-user:
--
--   drop policy if exists reconciliation_runs_toan_quyen on public.reconciliation_runs;
--   create policy reconciliation_runs_cua_toi on public.reconciliation_runs
--     for all to authenticated
--     using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
--   -- (admin xem tất: bổ sung policy đọc riêng cho vai trò admin nếu cần)
-- ============================================================

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0043
--
-- DROP TABLE IF EXISTS public.reconciliation_runs;
-- ============================================================
