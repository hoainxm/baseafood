-- ============================================================
-- Baseafood MES — 0107: MÃ KẾ TOÁN TRÊN DÒNG SỔ KHO THÁNG
--
-- Vì sao (2026-11-06): nạp báo cáo Xuất–Nhập–Tồn của phần mềm kế toán (PDF / Excel, theo MÃ HÀNG
-- "PXĐ.BTNL.TĐ 1001"…) vào sổ kho tháng. Sổ đặt tên lô theo cách gọi của kho ("Bạch tuộc 2 da 250up"),
-- không có mã ⇒ lần T10/2026 phải ghép tay 34 mã theo số. Lưu mã trên dòng: ghép MỘT lần, dồn kỳ mang
-- theo, các tháng sau tự khớp (lib/nxtStockImport.ts).
--
-- Làm gì — CHỈ THÊM một cột, không đổi / xóa gì đang có. Không đổi RLS (cột theo policy sẵn có của bảng).
--   `monthly_stock_ledger.accounting_code` text, mặc định '' (= chưa ghép).
-- App chỉ gửi cột này khi dòng CÓ mã ⇒ chưa chạy file này thì sổ vẫn ghi bình thường, riêng nạp XNT
-- báo lỗi khi lưu mã.
-- Idempotent — chạy lại không lỗi.
-- ============================================================

alter table public.monthly_stock_ledger
  add column if not exists accounting_code text not null default '';

create index if not exists monthly_stock_ledger_accounting_code_idx
  on public.monthly_stock_ledger (site_id, warehouse, period, accounting_code)
  where accounting_code <> '';

-- Kiểm sau khi chạy:
--   select count(*) from information_schema.columns
--    where table_name = 'monthly_stock_ledger' and column_name = 'accounting_code';  -- 1

-- ROLLBACK (mất mã đã ghép — sổ số liệu không đổi):
--   drop index if exists public.monthly_stock_ledger_accounting_code_idx;
--   alter table public.monthly_stock_ledger drop column if exists accounting_code;
