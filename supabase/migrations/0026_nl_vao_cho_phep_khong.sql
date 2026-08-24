-- ============================================================
-- Baseafood MES — 0026: NL vào cho phép 0 (bỏ ràng buộc <> 0)
--
-- Mức độ rủi ro: 🟡 YELLOW — chỉ nới ràng buộc. Chạy lại nhiều lần
-- vẫn không lỗi.
--
-- VÌ SAO:
--   `0018` đặt ràng buộc `check (quantity_kg <> 0)` cho `balancing_inputs`
--   theo MÔ HÌNH CŨ (mỗi dòng = một con số typed thẳng ⇒ 0 là vô nghĩa).
--   NHƯNG `0019` đổi mô hình: `quantity_kg` giờ là TỔNG SUY RA
--   (Σ daily_quantities + carry_over_kg). Khi tổ trưởng bấm "Thêm dòng"
--   (MaterialGrid.themDong), app tạo một DÒNG KHUNG `quantity_kg = 0` rồi
--   lưu ngay — số theo từng ngày điền SAU. Dòng 0 này hợp lệ trong lưới.
--
--   Ghi dòng 0 lên Supabase ⇒ lỗi 23514 "violates check constraint
--   balancing_inputs_quantity_kg_check". Vì hàng chờ upsert CẢ LÔ một lần
--   (repo.dongBoCho), dòng 0 ĐẦU ĐỘC toàn bộ lô ⇒ mọi dòng NL vào khác cũng
--   kẹt, hiện "Mất kết nối máy chủ". (Chế độ localStorage không có constraint
--   nên bug ẩn tới khi chạy Supabase.)
--
--   Migration này đồng bộ DB với mô hình lưới: BỎ hẳn ràng buộc `<> 0`.
--   Tổng một dòng NL vào giờ được là dương (nhập), 0 (khung chưa điền / các
--   ngày triệt tiêu nhau), hay âm (dòng Giảm — vẫn cho như 0018). Cột vẫn
--   `not null` (từ bảng gốc) nên không có dòng NULL.
--
-- AN TOÀN (🟡 YELLOW):
--   - CHỈ DROP một CHECK constraint (nới lỏng) — KHÔNG đụng dữ liệu, không mất
--     dòng nào, không đổi kiểu cột.
--   - `drop constraint if exists` cả tên cũ lẫn tên mới ⇒ idempotent.
--   - Nới constraint ⇒ mọi hàng chờ đang kẹt vì dòng 0 sẽ tự lên server ở lần
--     đồng bộ kế tiếp (không cần dọn tay).
--   - balancingCalc cộng dòng 0 thành 0 ⇒ không lệch tổng/định mức/lãi lỗ.
--
-- LÙI (rollback) — chỉ lùi được khi KHÔNG còn dòng 0 nào (nếu đã lưu dòng
-- khung = 0, xóa/điền số trước):
--   alter table public.balancing_inputs
--     drop constraint if exists balancing_inputs_quantity_kg_check;
--   alter table public.balancing_inputs
--     add  constraint balancing_inputs_quantity_kg_check check (quantity_kg <> 0) not valid;
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

-- Bỏ ràng buộc `<> 0` (mọi biến thể tên đã từng gắn vào bảng này).
alter table public.balancing_inputs
  drop constraint if exists nguyen_lieu_vao_so_luong_kg_check;

alter table public.balancing_inputs
  drop constraint if exists balancing_inputs_quantity_kg_check;
