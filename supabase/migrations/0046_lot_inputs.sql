-- ============================================================
-- Baseafood MES — 0046: Sự kiện BIẾN ĐỔI lô (truy xuất theo lô bằng QR)
--
-- Vì sao: chuỗi truy xuất đứt ngay bước nhập → sản xuất. Phiếu sản xuất BTP
-- (production_wips) và phiếu đóng gói (packagings) KHÔNG biết đã ăn nguyên liệu
-- của lô nào — đúng pain point "không truy được mẻ nào ăn lô nào" (họp 2026-09-02,
-- QĐ-6). Bảng này ghi đúng thứ còn thiếu: "đầu ra X đã dùng đầu vào Y, bao nhiêu kg"
-- — tương đương Transformation Event của EPCIS/GS1, và yêu cầu "nối TLC đầu ra về
-- các TLC đầu vào" của FDA FSMA 204. Thiết kế: docs/spec/qr-truy-xuat-lo.md.
--
-- CỐ Ý không thêm cột vào production_wips / packagings: nếu thêm cột mà migration
-- chưa chạy trên DB thật trước khi deploy thì MỌI lần lưu phiếu SX sẽ lỗi. Nhãn lô
-- BTP/TP suy ra từ bản ghi (không lưu), nên chỉ cần một bảng mới này.
--
--   output_kind 'W' = mẻ sản xuất BTP (production_wips.id)
--               'P' = phiếu đóng gói TP (packagings.id)
--   input_kind  'S' = lô nguyên liệu  (import_shipments.id — một chuyến nhập)
--               'W' = lô bán thành phẩm (production_wips.id)
--   quantity_kg NULL = chưa cân / không rõ (EPCIS cho phép) — gắn lô trước, kg sau.
--   input_label ảnh chụp nhãn lô LÚC GHI — còn tra được kể cả khi nguồn bị sửa/xóa.
--   method      'quet' | 'go' | 'chon' — đo tỷ lệ công nhân thật sự quét tem.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM bảng mới, không đụng bảng/dữ liệu đang có.
-- KHÔNG backfill dữ liệu cũ (sổ thật — truy xuất tính từ ngày áp dụng).
-- Chạy SAU 0001 (sites). Chạy lại nhiều lần vẫn không lỗi (idempotent).
-- RLS mở cho anon+authenticated theo khuôn 0041/0043; siết cùng nhánh 0021.
-- Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.lot_inputs (
  id            text primary key,
  site_id       text not null default 'bsf1' references public.sites(id),
  output_kind   text not null check (output_kind in ('W', 'P')),
  output_id     text not null,
  input_kind    text not null check (input_kind in ('S', 'W')),
  input_id      text not null,
  input_label   text not null default '',
  material      text not null default '',
  quantity_kg   numeric(18,3),
  method        text not null default 'chon' check (method in ('quet', 'go', 'chon')),
  operator      text not null default '',
  recorded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Truy ngược (đầu ra → các đầu vào) và truy xuôi (đầu vào → các đầu ra) đều phải nhanh.
create index if not exists lot_inputs_output_idx on public.lot_inputs (site_id, output_kind, output_id);
create index if not exists lot_inputs_input_idx  on public.lot_inputs (site_id, input_kind, input_id);

drop trigger if exists lot_inputs_sua on public.lot_inputs;
create trigger lot_inputs_sua
  before update on public.lot_inputs
  for each row execute function public.cap_nhat_thoi_diem_sua();

alter table public.lot_inputs enable row level security;
drop policy if exists lot_inputs_toan_quyen on public.lot_inputs;
create policy lot_inputs_toan_quyen on public.lot_inputs
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0046 (mất các dòng gắn lô đã ghi):
--
--   drop table if exists public.lot_inputs;
-- ============================================================
