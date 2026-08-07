> Load khi: đụng auth, đăng nhập, RLS, `.env`, key, hay có ý định cho app chạy ngoài mạng nội bộ. 🔴
covers: src/lib/auth.ts, src/lib/username.ts, src/features/DangNhap.tsx, src/features/QuanLyNguoiDung.tsx, supabase/migrations/0006_nguoi_dung.sql, supabase/migrations/0003_siet_rls.sql, src/lib/supabase.ts, .env.example, .gitignore
last_verified: 2026-08-06
ttl_days: 90

# Bảo mật & phân quyền

## Trạng thái: CÓ đăng nhập (Supabase Auth), CHƯA siết RLS

- **Đăng nhập + đăng ký từ UI**: Supabase Auth, email tổng hợp `<username>@bsf1.local` (người dùng chỉ gõ username, `src/lib/username.ts` ghép đuôi). Màn `DangNhap.tsx` có 2 chế độ: đăng nhập (username + mật khẩu) và **đăng ký** (họ tên · tên đăng nhập gợi ý từ họ tên · mật khẩu · xác nhận). Đăng ký = `supabase.auth.signUp` (frontend, KHÔNG cần edge function/service_role), có **check trùng username** trước. Logic `src/lib/auth.ts` (`useAuth`: `dangNhap`/`dangKy`/`dangXuat`). Gate ở `App.tsx`. **Chạy localStorage (thiếu env) ⇒ KHÔNG chặn** (offline ở xưởng).
- **Vai trò**: bảng `nguoi_dung` (khóa `id` = auth user id) giữ họ tên · username · `vai_tro` (`admin`/`giam-doc`/`ke-toan`/`to-truong`/rỗng). Đăng ký xong hồ sơ tạo với **vai trò rỗng** (chỉ đăng nhập được, chưa làm gì cho tới khi admin gán vai trò). Họ tên/username lưu qua `user_metadata` lúc signUp. `admin` thấy nav **Người dùng** (`QuanLyNguoiDung.tsx`) để gán vai trò + sửa họ tên.
- **CHƯA siết RLS**: policy vẫn `for all to anon, authenticated using(true)`. Gate hiện là **app-level** (ẩn màn admin), CHƯA phải DB-level; đăng ký hiện **mở** cho ai vào được app. Anon key vẫn đọc/ghi được nếu bypass UI ⇒ **vẫn chỉ chạy trong mạng nội bộ** cho tới khi chạy `0003`. Siết đăng ký (chỉ admin tạo user) cần edge function + service_role — việc tương lai.

## Thiết lập admin đầu tiên

1. Chạy `supabase/migrations/0006_nguoi_dung.sql` (tạo bảng `nguoi_dung`).
2. Supabase → **Authentication → Providers → Email → TẮT "Confirm email"** (email `@bsf1.local` không nhận được mail xác nhận; không tắt thì đăng ký xong không đăng nhập được).
3. Mở app → **"Chưa có tài khoản? Đăng ký"**: họ tên `Admin`, tên đăng nhập `admin`, mật khẩu. (Claude KHÔNG tạo hộ được — không đặt mật khẩu thật.)
4. Gán quyền admin (SQL Editor):
   ```sql
   update public.nguoi_dung set vai_tro='admin', ho_ten='Admin' where username='admin';
   ```
5. Đăng xuất/đăng nhập lại ⇒ thấy nav **Người dùng**. User khác **tự đăng ký từ UI**, admin gán vai trò.

⚠️ **Sau khi deploy bản này, app đòi đăng nhập** — làm bước 1-3 để có tài khoản đầu tiên.

## Lộ trình siết RLS (mở ra ngoài mạng nội bộ)

1. ✅ Đăng nhập + màn đăng nhập (đã có).
2. Chạy `supabase/migrations/0003_siet_rls.sql` — thu hồi quyền `anon`, policy chuyển `authenticated`. **Cập nhật `0003` để bao cả bảng mới** (`chuyen_nhap`, `chot_ngay`, `phieu_ban`, `ban_hang`, `nguoi_dung`) trước khi chạy.
3. Kiểm chứng: `select tablename, policyname, roles from pg_policies where schemaname='public'` — **không còn dòng nào chứa `anon`**.
4. Chỉ sau đó mới mở ra ngoài mạng nội bộ.

Chạy `0003` **trước** khi đăng nhập chạy ổn ⇒ app ngừng đọc/ghi ngay (401). Không mất dữ liệu, nhưng cả xưởng đứng.

Còn thiếu (làm sau): cột "người ghi/người chốt" (dữ liệu `chot_ngay`/ghi bù chưa biết ai); RLS ràng theo `xi_nghiep_id` của người đăng nhập; policy phân quyền theo `vai_tro` (VD chỉ admin/kế toán sửa được sổ đã chốt).

## Luật về key — tuyệt đối

- 🔒 **Không ghi project ref / URL / bất kỳ key nào vào file trong repo.** `.env.example` để trống có chủ đích; `.env` đã gitignore. Repo private vẫn phải sạch.
- ❌ **Không bao giờ** đặt `service_role` key vào `.env` — Vite nhúng mọi biến `VITE_*` thẳng vào bundle.
- Anon key từng bị commit ở bất kỳ repo nào ⇒ **rotate** ở Dashboard → Project Settings → API.
- Không dán URL/key vào commit message, issue, hay doc.

## Cross-references

- Policy hiện hành nằm trong: [03-database.md](03-database.md) (`0001`, `0004`)
- Cutover + cách lấy key: [`docs/supabase-setup.md`](../supabase-setup.md)
- Chốt ngày (chỗ đang thiếu "ai chốt"): [30-nhap-hang.md](30-nhap-hang.md)
