-- ============================================================
-- Baseafood MES — 0037: Người thao tác trên dòng sản xuất thành phẩm
--
-- Vì sao: yêu cầu 2026-09-05 (NR-4) — báo cáo thành phẩm hằng ngày phải LƯU VẾT
-- theo người thao tác (ai ghi/gửi lên hệ thống). Gắn họ tên tài khoản đăng nhập
-- vào từng dòng khi lưu; hiện trên báo cáo ngày ở màn /wip.
--
-- Mức độ rủi ro: 🟡 YELLOW — CHỈ THÊM 1 cột nullable vào production_wips (0011),
-- không default nên dòng cũ giữ NULL (app đọc thành ""), không khóa bảng, không
-- vỡ dữ liệu cũ. production_wips đã nằm trong danh sách siết RLS của 0021 nên
-- KHÔNG cần sửa 0021. Chạy lại nhiều lần vẫn không lỗi. Câu lùi ở cuối file.
-- ============================================================

alter table public.production_wips
  add column if not exists operator text;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0037
--
-- ALTER TABLE public.production_wips DROP COLUMN IF EXISTS operator;
-- ============================================================
