> Load khi: đụng auth, RLS, `.env`, key, hay có ý định cho app chạy ngoài mạng nội bộ. 🔴
covers: supabase/migrations/0003_siet_rls.sql, src/lib/supabase.ts, .env.example, .gitignore
last_verified: 2026-08-06
ttl_days: 90

# Bảo mật & phân quyền

## Trạng thái thật: KHÔNG có đăng nhập, KHÔNG có phân quyền

App chạy bằng **anon key**, RLS đang là `for all to anon using (true) with check (true)` trên toàn bộ bảng nghiệp vụ.
Anon key nằm trong bundle JS — ai mở DevTools cũng lấy được. Nghĩa là: **ai có key là đọc và sửa được toàn bộ số liệu sản xuất.**

🔴 **Điều kiện vận hành hiện tại: CHỈ chạy trong mạng nội bộ xí nghiệp.** Đưa app ra Internet khi policy còn dạng này là để ngỏ dữ liệu kế toán.

Không có khái niệm người dùng ở bất kỳ đâu trong code: không `user`, không `role`, không cột "người ghi". Hệ quả nghiệp vụ đang chấp nhận — `chot_ngay` **không biết ai chốt**, ghi bù **không biết ai ghi**. Bổ sung khi làm đăng nhập.

## Lộ trình mở ra ngoài (thứ tự bắt buộc)

1. Thêm Supabase Auth + màn đăng nhập vào app.
2. Chạy `supabase/migrations/0003_siet_rls.sql` — thu hồi quyền `anon`, `revoke all … from anon`, policy chuyển sang `authenticated`.
3. Kiểm chứng: `select tablename, policyname, roles from pg_policies where schemaname='public'` — **không còn dòng nào chứa `anon`**.
4. Chỉ sau đó mới mở ra ngoài mạng nội bộ.

Chạy `0003` **trước** khi có đăng nhập ⇒ app ngừng đọc/ghi ngay (401 / rỗng). Không mất dữ liệu, nhưng cả xưởng đứng.

Chưa thiết kế, phải làm cùng nghiệp vụ (ghi trong `0003`): phân vai tổ trưởng/kế toán/giám đốc; ràng theo `xi_nghiep_id` của người đăng nhập; cấm xóa bản ghi đã chốt sổ (chuyển sang cờ trạng thái).

## Luật về key — tuyệt đối

- 🔒 **Không ghi project ref / URL / bất kỳ key nào vào file trong repo.** `.env.example` để trống có chủ đích; `.env` đã gitignore. Repo private vẫn phải sạch.
- ❌ **Không bao giờ** đặt `service_role` key vào `.env` — Vite nhúng mọi biến `VITE_*` thẳng vào bundle.
- Anon key từng bị commit ở bất kỳ repo nào ⇒ **rotate** ở Dashboard → Project Settings → API.
- Không dán URL/key vào commit message, issue, hay doc.

## Cross-references

- Policy hiện hành nằm trong: [03-database.md](03-database.md) (`0001`, `0004`)
- Cutover + cách lấy key: [`docs/supabase-setup.md`](../supabase-setup.md)
- Chốt ngày (chỗ đang thiếu "ai chốt"): [30-nhap-hang.md](30-nhap-hang.md)
