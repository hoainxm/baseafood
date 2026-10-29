> Load khi: sửa màn `/documents` "Tài liệu công ty", luật xem theo phòng ban, lần ban hành, file trên bucket `documents`, hạn chứng nhận ở Việc của tôi, cột `app_roles.department`.
covers: src/features/documents/DocumentsScreen.tsx, src/features/documents/DocumentDetailDialog.tsx, src/features/documents/FilePreviewDialog.tsx, src/features/documents/openDocumentFile.ts, src/features/documents/DocumentFormDialog.tsx, src/features/documents/VersionFormDialog.tsx, src/features/documents/index.ts, src/lib/documents.ts, src/lib/documentStorage.ts, supabase/migrations/0072_company_documents.sql
last_verified: 2026-10-29
<!-- re-verified: 2026-10-29 09:00 — DEPARTMENTS (10 phòng) + SYSTEM_ROLE_DEPARTMENTS (planner / planning-head / planning-deputy → planning) + departmentsOfRoles (app_roles.department trước, rồi mặc định) khớp lib/documents.ts. Màn Người dùng (lib/userDirectory.ts) giờ cũng gom theo đúng nguồn này. -->
<!-- re-verified: 2026-10-27 10:00 — nút Đính PDF đã ký / Đính file gốc nằm trong DocumentDetailDialog (không ở cột File). CHƯA sửa: luật giao việc gia hạn (spec DOC-R7 "phòng sở hữu" ≠ code buildDocumentWarnings: người xem được + quyền documents.update) — chờ chủ dự án chốt -->
ttl_days: 90
<!-- updated: 2026-10-20 (c) — vai trò hệ thống MỚI `planner` (Nhân viên Kế hoạch, mig 0075) thuộc phòng `planning`: `SYSTEM_ROLE_DEPARTMENTS` thêm `planner: ["planning"]` và 0075 viết lại `current_user_departments()` thêm nhánh planner (giữ mọi nhánh của 0072) ⇒ người phòng KH đọc được QTI-KH-01 + 8 biểu mẫu (trước chỉ admin + BGĐ). Phòng ban các vai trò khác không đổi (kiểm PGlite: kế toán 2 · tổ trưởng 3 · thủ kho 3). Xem 41-export-planning.ba-spec.md. -->
<!-- updated: 2026-10-20 (b) — Kế toán trưởng được ghi tài liệu (ô `documents` view/create/update/delete/export ở `CHIEF_ACCOUNTANT`, mig 0073 thay trọn ma trận mặc định — 460 ô). Phòng ban không đổi: vẫn chỉ XEM tài liệu của Phòng Kế toán / mở cho Kế toán / cả công ty. -->
<!-- updated: 2026-10-20 — làm lại hộp chi tiết (chủ dự án: "không có chỗ gắn PDF, chỗ xem PDF"): bảng lần ban hành cũ rộng quá đẩy cột File ra ngoài khung, người không có quyền ghi không thấy nút nào mà không biết vì sao. Nay `DocumentDetailDialog.tsx` (tách khỏi màn): khối "Bản đang hiệu lực" đứng đầu (người soạn / xem xét / phê duyệt từng dòng, nút Xem PDF · Tải PDF · Tải file gốc · Đính PDF đã ký · Đính file gốc), thiếu file mà không có quyền ⇒ câu nói rõ ai đính được; lịch sử là thẻ xếp dọc. `FilePreviewDialog.tsx`: xem PDF / ảnh NGAY TRONG APP (iframe / img qua link có hạn 10 phút, trang không đặt CSP nên nhúng được), Word / Excel ⇒ tải về; `filePreviewKind` (lib, có test). Danh sách thêm cột File (Xem PDF / Chưa có PDF); thẻ "Thiếu file PDF" bấm được ⇒ lọc. Quyền: KHÔNG đổi — trên DB thật chỉ tài khoản `admin` ghi được (ma trận mặc định không cấp ô ghi, chủ dự án chốt 2026-10-19); cấp thêm ở Vai trò & quyền → Tài liệu công ty. -->
<!-- updated: 2026-10-19 (b) — `0072` ✅ ĐÃ CHẠY trên DB thật (kiểm qua MCP, chỉ đọc: 9 tài liệu, 9 lần ban hành, 8 policy 2 bảng, 3 policy bucket, cột `app_roles.department`, bucket `documents` private 20 MB, 0 file). Thêm nút Đính PDF / Đính file gốc cho lần ban hành còn thiếu file (`attachVersionFile`). -->
<!-- updated: 2026-10-19 — tạo mới: đợt 1 module Tài liệu công ty (thư viện + ghi bản đã ký giấy + xem theo phòng ban 3 lớp + nhắc gia hạn chứng nhận). `0072` CHƯA chạy trên DB thật — thứ tự: tạo bucket `documents` → chạy 0072 (2 lần) → deploy. Kiểm 0072 trên PGlite 2026-10-19: chạy 2 lần không lỗi; đọc lọc đúng 7 vai (kế toán 2 · tổ trưởng 3 · thủ kho 3 · Kế hoạch / GĐ / admin 9 · chưa phòng 0); ghi không quyền bị chặn, có `update` thì upsert được; mã trùng khác hoa bị chặn; anon bị chặn. -->

# Tài liệu công ty (`/documents`)

Thư viện quy trình · hướng dẫn · biểu mẫu · chứng nhận · hồ sơ năng lực của công ty, kiểm soát theo kiểu BRC 9: **mã cố định, nhiều lần ban hành không ghi đè, bản cũ thu hồi nhưng tra lại được, chỉ phòng liên quan xem được**. Đặc tả + luật DOC-R1…R10: [`spec/quan-ly-tai-lieu.md`](../spec/quan-ly-tai-lieu.md). Bản chép quy trình gốc (để code đọc luật): [`ho-so-nang-luc/`](../ho-so-nang-luc/README.md).

## Dữ liệu

| Bảng (mig 0072) | Mapping (`lib/repo.ts`) | Ghi chú |
|---|---|---|
| `company_documents` | `COMPANY_DOCUMENT_TABLE` · `useCompanyDocuments` | mã duy nhất theo site, không phân hoa thường (index `upper(btrim(code))`); `parent_id` = liên kết mềm (refColumns) |
| `document_versions` | `DOCUMENT_VERSION_TABLE` · `useDocumentVersions` | mỗi lần ban hành một dòng; `pdf_path` / `source_path` = đường dẫn trên bucket; `document_id` = liên kết mềm (refColumns) |
| `app_roles.department` (cột mới) | `APP_ROLE_TABLE` gửi cột **chỉ khi đã đọc được cột** từ máy chủ | chưa chạy 0072 ⇒ `department` là `undefined` ⇒ không gửi ⇒ lưu vai trò không vỡ |

**Không khóa ngoại** (cùng kiểu `task_assignments`) ⇒ test `demoForeignKeys` không đổi; vẫn khai `refColumns` để chế độ demo gắn tiền tố `demo:` cho cả hai cột liên kết. Bộ demo để **trống** hai bảng (đường dẫn file là của site thật).

## Luật chính (hàm thuần `lib/documents.ts`, test `documents.test.ts`)

| Luật | Hàm |
|---|---|
| Phòng ban của người = hợp phòng các vai trò: `app_roles.department` nếu có, không thì `SYSTEM_ROLE_DEPARTMENTS` | `departmentsOfRoles` |
| Xem: admin · Ban giám đốc · chạy không đăng nhập ⇒ tất cả; còn lại: cả công ty / phòng sở hữu / phòng được chọn | `documentViewerFor` + `canViewDocument` |
| Ghi bản đã ký giấy ⇒ `active` ngay; lần `active` cũ ⇒ `obsolete` + `obsoleted_on` = ngày hiệu lực mới (không ghi đè) | `recordPaperVersion` |
| Chỉ xóa tài liệu chưa từng `active`/`obsolete`; còn biểu mẫu con thì không xóa | `canDeleteDocument` (+ màn chặn khi có con) |
| Quá hạn lưu = `obsoleted_on` + `retention_years` ≤ hôm nay — chỉ đánh dấu | `isPastRetention` |
| Hạn chứng nhận: còn ≤ 60 ngày / đã hết ⇒ cảnh báo `document-expiring`, ngày = hết hạn − 60 ⇒ hạn việc = ngày hết hạn | `expiryOf`, `buildDocumentWarnings` |

## Ba lớp chặn đọc

`documents.view` là tài nguyên **đầu tiên lọc dòng khi ĐỌC** (mọi đọc khác có phạm vi `all`). Một lớp thiếu là lộ:

1. **App** — `DocumentsScreen` / `MyTasksScreen` lọc qua `canViewDocument`.
2. **RLS** — `company_documents_select` = `can_view_company_document(...)`; `document_versions_select` = xem được tài liệu chứa nó. Hàm SQL `current_user_departments()` lặp lại đúng `SYSTEM_ROLE_DEPARTMENTS` — **đổi bảng phòng ban ở code thì viết migration mới**.
3. **Bucket** — `documents_bucket_select`: file thuộc lần ban hành của tài liệu xem được, **hoặc** người có ô ghi (Thêm/Sửa/Duyệt — lúc tải lên file chưa thuộc lần nào mà Storage đọc lại dòng vừa tạo).

Ghi: hai policy insert/update cùng điều kiện "Thêm HOẶC Sửa" (app ghi bằng UPSERT — Postgres kiểm cả hai), xóa cần Xóa. `TABLE_WRITE_RULES` để `null` cho hai bảng (không qua trigger 0065). Ma trận mặc định cấp ô ghi cho **Kế toán trưởng** (view · create · update · delete · export — mig 0073, chủ dự án 2026-10-20; không có `approve`), còn lại chỉ admin; `resolvePermissions` tự cấp `documents:view` cho ai đã có quyền bất kỳ (như `my-tasks`).

## Màn

- Danh sách `RecordTable` (`rowMarkKey="documents"`), lọc loại / phòng / trạng thái, tìm mã-tên; 4 thẻ số (xem được · hiệu lực · sắp hết hạn · thiếu PDF).
- Hộp chi tiết `DocumentDetailDialog` mở qua `?doc=<id>` (link từ Việc của tôi): hàng nút (chỉ người có quyền) → khối **Bản đang hiệu lực** (người duyệt, nội dung sửa, nút file to) → thông tin chung → **Các lần ban hành trước** (thẻ dọc, không bảng ngang) → biểu mẫu con. Không có quyền ghi + thiếu file ⇒ câu "Người có quyền ghi tài liệu (hiện là quản trị viên)…", không im lặng.
- `FilePreviewDialog`: PDF / ảnh xem ngay trong app (iframe / img, link có hạn 10 phút); Word / Excel tải về; nút Mở tab mới · Tải về. Danh sách có cột File (Xem PDF nhanh) và thẻ "Thiếu file PDF" bấm để lọc.
- **Đính file cho lần còn thiếu** (nút **"Đính PDF đã ký"** / **"Đính file gốc"** trong **hộp chi tiết** tài liệu — `DocumentDetailDialog`, ở khối lần ban hành còn thiếu file — khi có quyền ghi + có máy chủ; KHÔNG nằm ở cột File của danh sách, cột File chỉ để Xem PDF nhanh): `attachVersionFile` chỉ điền ô file đang TRỐNG — ngoại lệ duy nhất của DOC-R2, không thay file đã có. Dùng cho dữ liệu đầu QTI-KH-01 (nạp từ bản giấy) — thêm 2026-10-19 sau khi chủ dự án chạy 0072 và thấy không mở được file.
- `DocumentFormDialog` (nháp `documents-edit`) · `VersionFormDialog` (nháp `documents-version` — chỉ phần chữ, file chọn lại sau tải trang): tải file lên TRƯỚC, ghi dòng SAU; ghi bị chặn / lỗi ⇒ gỡ file vừa tải.
- Màn Vai trò & quyền: ô **Thuộc phòng ban** chỉ hiện khi máy chủ đã có cột (`hasDepartmentColumn`).

## Bẫy

- **Thứ tự deploy:** bucket → 0072 → code. Chưa có bảng mà đã deploy ⇒ `/documents` và **`/my-tasks`** (nạp `company_documents` để nhắc gia hạn) báo lỗi đồng bộ.
- Tải file chỉ được khi có Supabase (`hasDocumentStorage`). Chạy localStorage: ghi thông tin, không bắt PDF.
- Hoàn tác lần ban hành chỉ gỡ dòng, không gỡ file đã tải (file mồ côi vô hại, không ai đọc được vì không còn dòng trỏ tới — trừ người có ô ghi).
- Dữ liệu đầu tiên (QTI-KH-01 + 8 biểu mẫu, lần 01) nạp ở **migration** cho site `bsf1`, chưa có file — thẻ "Thiếu file PDF" sẽ báo 9.
