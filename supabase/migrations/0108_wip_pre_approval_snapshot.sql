-- ============================================================
-- Baseafood MES — 0108: SỐ XƯỞNG GHI TRƯỚC KHI DUYỆT NHẬP KHO (để Hủy duyệt được)
--
-- Vì sao (audit chủ dự án 2026-11-06 "thêm thừa / làm nhầm thì phải gỡ được"): Kho dự trữ →
-- Duyệt nhập kho GHI ĐÈ kg / block / kho / ghi chú của mẻ /wip bằng số thực ⇒ mất số xưởng ghi,
-- duyệt nhầm không quay về Chờ nhập kho được. Lưu bản chụp số gốc lúc duyệt; Hủy duyệt trả lô về
-- Chờ nhập kho đúng số gốc rồi xóa bản chụp (lib/wipIntakeReversal.ts).
--
-- Làm gì — CHỈ THÊM một cột null, không đổi / xóa gì đang có. Không đổi RLS (cột theo policy sẵn
-- có của bảng), không đổi trigger / hàm quyền.
--   `production_wips.pre_approval` jsonb null
--     { quantityKg, blocksCount, warehouse, note, approvedBy, approvedAt }
--     null = chưa duyệt bằng bản mới, hoặc đã hủy duyệt.
-- App chỉ gửi cột này với dòng vừa Duyệt / Hủy duyệt ⇒ ⚠ CHẠY FILE NÀY TRƯỚC KHI DEPLOY bản app
-- có Hủy duyệt: chưa chạy thì lần duyệt nhập kho đầu tiên kẹt hàng chờ production_wips (lỗi 42703
-- cột không có) cho tới khi chạy. Dòng chưa đụng tới vẫn ghi bình thường.
-- Idempotent — chạy lại không lỗi.
-- ============================================================

alter table public.production_wips
  add column if not exists pre_approval jsonb;

comment on column public.production_wips.pre_approval is
  'Số xưởng ghi trước khi kho duyệt nhập (kg, block, kho, ghi chú, ai/lúc duyệt) — để Hủy duyệt trả về đúng số. null = chưa duyệt / đã hủy duyệt. Mig 0108.';

-- Kiểm sau khi chạy:
--   select count(*) from information_schema.columns
--    where table_name = 'production_wips' and column_name = 'pre_approval';  -- 1

-- ROLLBACK (mất số gốc của các lô đã duyệt — tồn kho / số thực không đổi; app phải lùi bản trước
-- hoặc vẫn chạy được vì dòng mới duyệt sẽ kẹt hàng chờ như lúc chưa chạy):
--   alter table public.production_wips drop column if exists pre_approval;
