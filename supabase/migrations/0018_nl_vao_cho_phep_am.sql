-- ============================================================
-- Baseafood MES — 0018: cho phép Nguyên liệu vào có số lượng ÂM
--
-- Chạy SAU 0001 (và 0016 đổi tên bảng sang tiếng Anh). Idempotent — chạy lại
-- nhiều lần vẫn không lỗi.
--
-- VÌ SAO:
--   `0001` tạo cột với ràng buộc `check (so_luong_kg >= 0)` (bảng `nguyen_lieu_vao`,
--   `0016` đổi tên thành `balancing_inputs.quantity_kg`). NHƯNG màn Cân đối
--   (Khối 1 — Nguyên liệu vào, `BalancingScreen.tsx`) CỐ Ý cho nhập số ÂM:
--   dòng điều chỉnh giảm, VD "Bán nội địa" trừ khỏi pool NL. App chỉ chặn 0
--   (`!quantityKg`), cho âm. DB chặn âm ⇒ ghi lên Supabase báo lỗi 23514
--   "violates check constraint nguyen_lieu_vao_so_luong_kg_check", MẤT dòng.
--   (Chế độ localStorage không có constraint nên bug này ẩn tới khi chạy Supabase.)
--
--   Migration này đồng bộ DB với app: bỏ ràng buộc `>= 0`, thay bằng `<> 0`
--   (khớp đúng luật app: khác 0, cho âm).
--
-- AN TOÀN:
--   - Chỉ đổi CHECK constraint của 1 bảng, KHÔNG đụng dữ liệu (không mất dòng nào).
--   - Ràng buộc mới đặt `NOT VALID`: chặn mọi INSERT/UPDATE MỚI (giống app),
--     nhưng KHÔNG kiểm lại dòng cũ — phòng trường hợp có dòng lịch sử = 0 thì
--     migration vẫn chạy trót lọt.
--   - `drop constraint if exists` cả tên cũ lẫn tên mới ⇒ idempotent.
--
-- LÙI (rollback):
--   alter table public.balancing_inputs
--     drop constraint if exists balancing_inputs_quantity_kg_check;
--   alter table public.balancing_inputs
--     add  constraint nguyen_lieu_vao_so_luong_kg_check check (quantity_kg >= 0);
--   -- (chỉ lùi được khi KHÔNG còn dòng âm nào — nếu đã nhập dòng âm, xóa/sửa trước)
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

alter table public.balancing_inputs
  drop constraint if exists nguyen_lieu_vao_so_luong_kg_check;

alter table public.balancing_inputs
  drop constraint if exists balancing_inputs_quantity_kg_check;

alter table public.balancing_inputs
  add  constraint balancing_inputs_quantity_kg_check check (quantity_kg <> 0) not valid;
