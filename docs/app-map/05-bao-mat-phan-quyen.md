> Load khi: đụng auth, đăng nhập, RLS, `.env`, key, hay có ý định cho app chạy ngoài mạng nội bộ. 🔴
covers: src/lib/auth.ts, src/lib/username.ts, src/features/DangNhap.tsx, src/features/QuanLyNguoiDung.tsx, supabase/migrations/0006_nguoi_dung.sql, supabase/migrations/0007_seed_admin.sql, supabase/migrations/0003_siet_rls.sql, src/lib/supabase.ts, .env.example, .gitignore
last_verified: 2026-08-06
ttl_days: 90

# Bảo mật & phân quyền

## Trạng thái: CÓ đăng nhập (Supabase Auth), CHƯA siết RLS

- **Đăng nhập từ UI**: Supabase Auth, email tổng hợp `<username>@bsf1.local` (người dùng chỉ gõ username, `src/lib/username.ts` ghép đuôi). Màn `DangNhap.tsx` **chỉ đăng nhập** — KHÔNG mở đăng ký tự do (chính sách app nội bộ). Logic `src/lib/auth.ts` (`useAuth`: `dangNhap`/`taoTaiKhoan`/`dangXuat`). Gate ở `App.tsx`. **Chạy localStorage (thiếu env) ⇒ KHÔNG chặn** (offline ở xưởng).
- **Admin tạo tài khoản**: chỉ `admin` (nav **Người dùng**, `QuanLyNguoiDung.tsx`) tạo được tài khoản: họ tên · tên đăng nhập (gợi ý từ họ tên, sửa được) · mật khẩu, có **check trùng username**. Tạo bằng `taoTaiKhoan` (`auth.ts`): signUp trên **client PHỤ** (`taoClientTam` — `persistSession:false`) nên **KHÔNG đá văng phiên admin**; hồ sơ lưu qua client chính, vai trò rỗng (admin gán sau).
- **Vai trò**: bảng `nguoi_dung` (khóa `id` = auth user id) giữ họ tên · username · `vai_tro` (`admin`/`giam-doc`/`ke-toan`/`to-truong`/rỗng). Admin gán vai trò + sửa họ tên trong màn Người dùng.
- **CHƯA siết RLS**: policy vẫn `for all to anon, authenticated using(true)`. Gate + đóng-đăng-ký hiện là **app-level**; anon key vẫn đọc/ghi được nếu bypass UI ⇒ **vẫn chỉ chạy trong mạng nội bộ** cho tới khi chạy `0003`.

## Thiết lập admin đầu tiên

1. Chạy `0006_nguoi_dung.sql` rồi `0007_seed_admin.sql` — `0007` **seed sẵn admin / admin** (mồi con-gà-quả-trứng: đăng ký đã đóng, chưa admin thì không ai tạo được admin).
2. Mở app → đăng nhập **admin / admin**.
3. ⚠️ **ĐỔI MẬT KHẨU NGAY** (Dashboard → Auth → Users → admin@bsf1.local → Update password). `admin` là mật khẩu tạm rất yếu.
4. Tạo user khác ngay trong app (nút **Tạo tài khoản** ở màn Người dùng) + gán vai trò.

⚠️ Tài khoản admin do **admin tạo qua signUp** (bước 4) cần **TẮT "Confirm email"** (Supabase → Authentication → Providers → Email) vì email `@bsf1.local` không nhận mail xác nhận. Admin seed ở `0007` đã `email_confirmed_at` sẵn nên đăng nhập được ngay bất kể cài đặt này.

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
