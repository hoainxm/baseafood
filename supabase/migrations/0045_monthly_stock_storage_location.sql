-- ============================================================
-- Baseafood MES — 0045: cột VỊ TRÍ (kho lưu hiện tại) cho Sổ kho theo tháng
--
-- Vì sao: một dòng bảng kê thuộc sổ của một kho (`warehouse`, VD Kho 1000T) nhưng
-- hàng có thể đang NẰM ở chỗ khác — gửi kho lạnh thuê ngoài (Kho Ánh Dương, Kho
-- Hùng Phú…) hoặc chuyển sang Kho 1500T. Thủ kho cần cột "Vị trí" để biết lô đang
-- ở đâu mà không phải tách dòng sang sổ kho khác (tách = cộng đôi khi dồn kỳ).
--
-- Lưu theo TÊN (như `warehouse` và `nxt_snapshots.storage_location` ở 0044). Rỗng
-- = chưa gán ⇒ app hiểu là hàng đang ở chính kho của sổ (`warehouse`); dữ liệu cũ
-- không bị ép sửa.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM một cột có default '' (không đụng dữ liệu).
-- Chạy SAU 0041. Chạy lại nhiều lần vẫn không lỗi. ⚠ PHẢI chạy TRƯỚC khi deploy
-- bản app có cột Vị trí — app gửi `storage_location` mỗi lần ghi sổ tháng.
-- ============================================================

alter table public.monthly_stock_ledger
  add column if not exists storage_location text not null default '';

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0045
--
-- ALTER TABLE public.monthly_stock_ledger DROP COLUMN IF EXISTS storage_location;
-- ============================================================
