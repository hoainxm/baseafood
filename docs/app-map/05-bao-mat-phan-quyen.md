> Load khi: đụng auth, đăng nhập, RLS, `.env`, key, hay có ý định cho app chạy ngoài mạng nội bộ. 🔴
covers: src/lib/auth.ts, src/lib/username.ts, src/features/auth/LoginScreen.tsx, src/features/users/UserManagementScreen.tsx, supabase/migrations/0006_nguoi_dung.sql, supabase/migrations/0007_seed_admin.sql, supabase/migrations/0010_email_domain_vn.sql, supabase/migrations/0003_siet_rls.sql, src/lib/supabase.ts, .env.example, .gitignore
last_verified: 2026-08-26
ttl_days: 90
<!-- updated: 2026-08-26 — thêm vai trò "vice-manager" (Phó quản đốc). Vào Role/ROLES ở types.ts + nav-access.ts (ALLOWED_NAV → DEPT_SAN_XUAT, HOME_BY_ROLE → wip). Lưu CSV cột roles, KHÔNG cần migration. Admin gán ở màn Người dùng (chip tự hiện vì render từ ROLES). CHUẨN HOÁ NHÃN vai trò (bỏ ngoặc/tiếng Anh/gạch chéo). + FIX slug cũ: người dùng tạo trước rename 0016 còn lưu slug tiếng Việt (giam-doc, ke-toan, pho-giam-doc, quan-doc-dong…) → chuanHoaVaiTro() trong types.ts ánh xạ slug cũ→chuẩn lúc ĐỌC (rolesFromCsv + rolesList) nên hiện đúng nhãn + chạy đúng nav; ghi lại ra slug chuẩn nên tự lành khi admin lưu. (Muốn dọn hẳn dữ liệu: update user_profiles.roles thay chuỗi cũ — không bắt buộc.) -->
<!-- updated: 2026-08-24 — nhật ký thao tác (audit_log, migration 0025): auth.ts log đăng nhập/xuất; 0021 nay bao 25 bảng (thêm 2 tồn đầu) NHƯNG audit_log giữ RLS RIÊNG (append-only, admin đọc), KHÔNG vào vòng siết 0021 -->
<!-- updated: 2026-08-23 — vai trò dùng slug TIẾNG ANH (Role/ROLES ở types.ts): admin·director·vice-director·manager-dong·manager-ca·manager-kho·accountant·team-leader·warehouse-keeper (thêm team-leader + warehouse-keeper). Phân quyền ĐIỀU HƯỚNG theo vai trò qua src/lib/nav-access.ts (2 giao diện bộ phận) — không còn "chỉ admin gate". -->
<!-- updated: 2026-08-18 — viết 0021_siet_rls_tieng_anh.sql (thay 0003 đã lỗi thời sau rename 0016, bao đủ 23 bảng); 0003 đánh dấu ĐỪNG CHẠY -->
<!-- updated: 2026-08-07 — đuôi email .local→.vn (GoTrue chặn .local, migration 0010); vai trò NHIỀU/người (VaiTro[], CSV cột vai_tro), gán lúc tạo TK, Quản đốc theo xưởng -->

# Bảo mật & phân quyền

## Trạng thái: CÓ đăng nhập (Supabase Auth), migration siết RLS ĐÃ VIẾT — chờ chạy

- **Đăng nhập từ UI**: Supabase Auth, email tổng hợp `<username>@bsf1.vn` (người dùng chỉ gõ username, `src/lib/username.ts` ghép đuôi). Màn `LoginScreen.tsx` **chỉ đăng nhập** — KHÔNG mở đăng ký tự do (chính sách app nội bộ). Logic `src/lib/auth.ts` (`useAuth`: `dangNhap`/`taoTaiKhoan`/`dangXuat`). Gate ở `App.tsx`. **Chạy localStorage (thiếu env) ⇒ KHÔNG chặn** (offline ở xưởng).
  - ⚠️ **Đuôi phải là TLD thật (`.vn`), KHÔNG `.local`**: GoTrue chặn TLD dành riêng (`.local`/`.test`/`.example`/`.invalid`) khi signUp → "Email address … is invalid", admin không tạo được tài khoản. Đổi từ `.local` sang `.vn` ở migration `0010` (đã đổi cả admin seed).
- **Admin tạo tài khoản**: chỉ `admin` (nav **Người dùng**, `UserManagementScreen.tsx`) tạo được tài khoản: họ tên · tên đăng nhập (gợi ý từ họ tên, sửa được) · mật khẩu, có **check trùng username**. Tạo bằng `taoTaiKhoan` (`auth.ts`): signUp trên **client PHỤ** (`taoClientTam` — `persistSession:false`) nên **KHÔNG đá văng phiên admin**; hồ sơ lưu qua client chính, vai trò rỗng (admin gán sau).
- **Vai trò — NHIỀU vai trò / người** (`NguoiDung.vaiTro: VaiTro[]`): một người giữ nhiều vai trò, VD "Phó giám đốc kiêm Quản đốc xưởng Đông" = `["pho-giam-doc","quan-doc-dong"]` (hai vai trò riêng, KHÔNG phải một vai trò dài). Lưu DB dạng **CSV** trong cột `vai_tro` (text, không cần migration) — `vaiTroTuChuoi`/`vaiTroThanhChuoi` trong `types.ts` chuyển đổi; dữ liệu cũ 1 vai trò (`admin`) parse ra `["admin"]` bình thường. Danh sách chọn (`VAI_TRO`): `admin` · `giam-doc` · `pho-giam-doc` · `quan-doc-dong`/`quan-doc-ca`/`quan-doc-kho` (Quản đốc theo xưởng) · `ke-toan`; `[]` = chưa gán. `to-truong` giữ trong union cho dữ liệu cũ, không trong danh sách chọn. `admin` gate chức năng admin (`laAdmin = rolesList(...).includes("admin")`, ẩn/chặn màn **Người dùng**). **Từ 2026-08-23, vai trò còn gate ĐIỀU HƯỚNG** qua [`src/lib/nav-access.ts`](../../src/lib/nav-access.ts): vai trò bộ phận (`warehouse-keeper` → Nhập hàng; `team-leader`/`manager-dong`/`manager-ca`/`manager-kho`/`vice-manager` → Sản xuất) chỉ thấy nav của bộ phận mình + có **trang chủ riêng** (`homeFor`), gõ URL ngoài bộ phận bị `App.tsx` đưa về trang chủ. Vai trò không giới hạn (giám đốc/phó GĐ/kế toán/admin) + người **chưa gán vai trò** vẫn xem đầy đủ (tránh kẹt). ⚠️ RLS **chưa** phân quyền theo vai trò — đây mới là gate UI; server vẫn dựa `0021`. Admin **gán vai trò ngay lúc tạo tài khoản** (chip chọn nhiều) hoặc sửa sau trong màn Người dùng.
- **RLS**: `0021_siet_rls_tieng_anh.sql` đã viết, **chưa chạy** ⇒ policy trên máy chủ vẫn `for all to anon, authenticated using(true)`. Cho tới khi chạy `0021`, anon key vẫn đọc/ghi được nếu bypass UI ⇒ **chỉ chạy trong mạng nội bộ**. `0003` cũ **ĐỪNG CHẠY** (xem dưới).

## Thiết lập admin đầu tiên

1. Chạy `0006_nguoi_dung.sql` rồi `0007_seed_admin.sql` — `0007` **seed sẵn admin / admin** (mồi con-gà-quả-trứng: đăng ký đã đóng, chưa admin thì không ai tạo được admin).
2. Mở app → đăng nhập **admin / admin**.
3. ⚠️ **ĐỔI MẬT KHẨU NGAY** (Dashboard → Auth → Users → admin@bsf1.vn → Update password). `admin` là mật khẩu tạm rất yếu.
4. Tạo user khác ngay trong app (nút **Tạo tài khoản** ở màn Người dùng) + gán vai trò.

⚠️ Tài khoản admin do **admin tạo qua signUp** (bước 4) cần **TẮT "Confirm email"** (Supabase → Authentication → Providers → Email) vì email `@bsf1.vn` (tổng hợp) không nhận mail xác nhận. Admin seed ở `0007` đã `email_confirmed_at` sẵn nên đăng nhập được ngay bất kể cài đặt này.

## Lộ trình siết RLS (mở ra ngoài mạng nội bộ)

⛔ **`0003_siet_rls.sql` ĐÃ LỖI THỜI — đừng chạy.** Nó viết theo tên bảng tiếng Việt trước `0016_rename_to_english`; sau `0016` những tên đó không còn, và nó bỏ sót 11 bảng thêm từ `0011`/`0017`. Dùng **`0021_siet_rls_tieng_anh.sql`** (bao đủ 23 bảng, tên hiện hành).

1. ✅ Đăng nhập + màn đăng nhập (đã có).
2. **Tiền kiểm trước khi chạy `0021`** — thiếu một là cả xưởng đứng:
   - mọi máy đang dùng đều đăng nhập được (`0006` + `0007` đã chạy);
   - còn ít nhất một tài khoản admin đăng nhập được, **thử ngay trước khi chạy**;
   - không thiết bị nào còn chạy bản cũ chưa có màn đăng nhập.
3. Chạy `0021`. Nó thu hồi quyền `anon` ở cả tầng policy lẫn tầng GRANT, và `revoke usage on schema public from anon`.
4. Kiểm chứng: `select tablename, policyname, roles from pg_policies where schemaname='public'` — **không còn dòng nào chứa `anon`**.
5. Chỉ sau đó mới mở ra ngoài mạng nội bộ.

Chạy `0021` **trước** khi đăng nhập chạy ổn ⇒ app ngừng đọc/ghi ngay (401). Không mất dữ liệu, nhưng cả xưởng đứng — khối `ROLLBACK` trong file mở lại được cho anon, và mở xong **phải siết lại**.

### Sau `0021` vẫn CHƯA có phân quyền theo vai trò

`0021` chỉ tách được **người đã đăng nhập** với **người ngoài**. Ở tầng DB mọi người đã đăng nhập có quyền như nhau; phân quyền vẫn là app-level (chỉ `admin` gate màn Người dùng). Ba việc còn lại cần chốt nghiệp vụ trước rồi làm ở một migration riêng: ràng theo vai trò (tổ trưởng chỉ ghi xưởng mình · kế toán sửa kỳ cân đối · giám đốc chỉ đọc), ràng theo `site_id`, và cấm sửa bản ghi đã chốt ở tầng DB.

Còn thiếu (làm sau): cột "người ghi/người chốt" (dữ liệu `chot_ngay`/ghi bù chưa biết ai); RLS ràng theo `xi_nghiep_id` của người đăng nhập; policy phân quyền theo `vai_tro` (VD chỉ admin/kế toán sửa được sổ đã chốt).

## Luật về key — tuyệt đối

- 🔒 **Không ghi project ref / URL / bất kỳ key nào vào file trong repo.** `.env.example` để trống có chủ đích; `.env` đã gitignore. Repo private vẫn phải sạch.
- ❌ **Không bao giờ** đặt `service_role` key vào `.env` — Vite nhúng mọi biến `VITE_*` thẳng vào bundle.
- Anon key từng bị commit ở bất kỳ repo nào ⇒ **rotate** ở Dashboard → Project Settings → API.
- Không dán URL/key vào commit message, issue, hay doc.

## Cross-references

- Policy hiện hành nằm trong: [03-database.md](03-database.md) (`0001`, `0004`)
- Cutover + cách lấy key: [`docs/ops/supabase-setup.md`](../ops/supabase-setup.md)
- Deploy Vercel + Supabase Auth URL (redirect production): [`docs/ops/deploy-vercel.md`](../ops/deploy-vercel.md)
- Chốt ngày (chỗ đang thiếu "ai chốt"): [30-nhap-hang.md](30-nhap-hang.md)
