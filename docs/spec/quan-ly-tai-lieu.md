# Module Tài liệu công ty — kiểm soát tài liệu (đặc tả trước khi build)

> **Load khi:** xây trang `/documents` "Tài liệu công ty": quy trình, hướng dẫn, biểu mẫu, chứng nhận, hồ sơ năng lực; lần ban hành; duyệt; file gốc trên Storage; giới hạn xem theo phòng ban.
> **Trạng thái:** ✅ **ĐỢT 1 ĐÃ BUILD 2026-10-19** (code + `0072_company_documents.sql`, kiểm PGlite) — `0072` ✅ đã chạy trên DB thật 2026-10-19. Đợt 2 (duyệt trên app) + đợt 3 chưa làm. Còn các câu ở §9 (đang dùng mặc định). Doc code: [`app-map/40-documents.md`](../app-map/40-documents.md).
> **Nguồn:** yêu cầu chủ dự án 2026-10-19 · mẫu tài liệu thật [`ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md`](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) · phân quyền [`role-permissions.md`](role-permissions.md) · lưu file [`ops/supabase-storage.md`](../ops/supabase-storage.md).
> **last_verified:** 2026-10-19

## 1. Vấn đề

- Quy trình, biểu mẫu, chứng nhận của xí nghiệp đang là **file rời và giấy kẹp**. Muốn biết bản nào đang hiệu lực phải hỏi người giữ.
- BRC 9 (mục kiểm soát tài liệu) yêu cầu mỗi tài liệu có **mã, lần ban hành, người duyệt, ngày hiệu lực**. Bản cũ phải **thu hồi khỏi sử dụng nhưng vẫn tra lại được**. Một số tài liệu **chỉ phòng liên quan được xem**.
- Bộ `docs/ho-so-nang-luc/` trong repo là để **lập trình** đọc quy tắc. Bản chính thức (file, lần ban hành, quyền xem) phải nằm **trong app**, nơi người của xí nghiệp dùng.

## 2. Đã chốt với chủ dự án (2026-10-19)

| # | Câu | Chốt |
|---|---|---|
| 1 | "Hồ sơ năng lực" là gì | **Cả hai:** (a) bộ quy trình/biểu mẫu nội bộ · (b) hồ sơ giới thiệu công ty gửi khách (chứng nhận, năng lực, nhà máy) |
| 2 | Ai tải lên / ban hành | **Cấu hình theo phân quyền** (quyền `documents`). Trước mắt **admin làm giúp** |
| 3 | Ai được xem | **Giới hạn theo phòng ban** |
| 4 | Duyệt | **Cả hai:** lưu bản đã ký giấy **và** duyệt trên app |
| 5 | Kho file | Chủ dự án tự tạo bucket rồi báo (§6) |

## 3. Khái niệm

| Khái niệm | Nghĩa |
|---|---|
| **Tài liệu** | Một mã cố định, ví dụ `QTI-KH-01`. Có loại, phòng sở hữu, phạm vi xem, thời hạn lưu. |
| **Loại** (danh sách cố định) | Quy trình · Hướng dẫn · Biểu mẫu · Chứng nhận · Hồ sơ năng lực · Khác |
| **Tài liệu cha** | Biểu mẫu thuộc quy trình: `QTI-KH-01-04` có cha là `QTI-KH-01`. |
| **Lần ban hành** | Mỗi lần sửa đổi là một bản ghi riêng: số lần, ngày hiệu lực, nội dung sửa, người soạn / xem xét / phê duyệt, file PDF đã ký + file Word gốc. **Không ghi đè.** |
| **Phòng ban** (danh sách cố định) | Ban giám đốc · Kế hoạch · Kế toán · Thu mua (nhập hàng) · Sản xuất Đông · Sản xuất Cá · Sản xuất Khô · Kho · QC – Kỹ thuật · Hành chính – Nhân sự *(chờ chốt danh sách thật — §9)* |

**Trạng thái lần ban hành:**

```
Dự thảo ─► Chờ xem xét ─► Chờ phê duyệt ─► Đang hiệu lực ─► Hết hiệu lực
   │            │ trả lại        │ trả lại        ▲  (tự chuyển khi lần mới có hiệu lực)
   │            └──► Dự thảo ◄───┘                │
   └──── "Ghi bản đã ký giấy" (bỏ qua 2 bước giữa, bắt buộc đính PDF đã ký) ┘
```

Trạng thái của **tài liệu** = trạng thái lần ban hành mới nhất đang hiệu lực. Không có lần nào hiệu lực ⇒ "Dự thảo". Thu hồi cả tài liệu ⇒ "Hết hiệu lực" (không xóa).

## 4. Luật nghiệp vụ

| Mã | Luật |
|---|---|
| DOC-R1 | Mỗi tài liệu có **đúng 0 hoặc 1** lần ban hành "Đang hiệu lực". Lần mới có hiệu lực ⇒ lần cũ tự sang "Hết hiệu lực". |
| DOC-R2 | Lần ban hành đã hiệu lực **không sửa được** — ngoại lệ duy nhất: **đính file vào ô còn trống** (lần nạp từ bản giấy chưa có file), không thay file đã có. Muốn sửa ⇒ tạo lần mới. Lần cũ **luôn mở xem được**, kèm nhãn "Hết hiệu lực". |
| DOC-R3 | **Hai đường duyệt** *(đợt 1 mới có đường b; PDF chỉ bắt buộc khi đã nối máy chủ — chạy localStorage không lưu được file; dữ liệu đầu QTI-KH-01 nạp từ bản giấy chưa có file, thẻ "Thiếu file PDF" nhắc tải lên)*: (a) *Duyệt trên app* — người soạn gửi ⇒ người xem xét bấm Đạt/Trả lại ⇒ người phê duyệt bấm Duyệt/Trả lại; app ghi người + giờ từng bước. (b) *Bản đã ký giấy* — người có quyền ghi tên soạn/xem xét/duyệt + **bắt buộc đính PDF đã ký**. |
| DOC-R4 | Người xem xét và người phê duyệt là **tài khoản trong app** khi duyệt trên app. Họ nhận việc ở **Việc của tôi** (`task_assignments`), không dựng chỗ báo riêng. |
| DOC-R5 | **Phạm vi xem:** tài liệu có *phòng sở hữu* + danh sách *phòng được xem* (mặc định = phòng sở hữu). Hoặc chọn *Cả công ty*. **Ban giám đốc và admin xem tất cả.** Người không thuộc phòng nào được xem ⇒ **không thấy tài liệu trong danh sách** và **không tải được file** (chặn cả ở máy chủ và kho file, không chỉ ẩn nút). |
| DOC-R6 | Phòng ban của một người **suy từ vai trò** (§5). Không cần sửa hồ sơ người dùng. |
| DOC-R7 | **Chứng nhận và hồ sơ năng lực** có thể có *ngày hết hạn*. Còn ≤ N ngày *(mặc định 60, chờ chốt)* ⇒ việc "Gia hạn chứng nhận" vào Việc của tôi của phòng sở hữu. |
| DOC-R8 | Không xóa tài liệu đã có lần hiệu lực (luật 6 repo). Chỉ **Dự thảo chưa từng hiệu lực** xóa được, qua hộp xác nhận + Hoàn tác. |
| DOC-R9 | Thời hạn lưu (ví dụ 2 năm của QTI-KH-01) chỉ **đánh dấu "Quá hạn lưu"** để người phụ trách quyết định. App **không tự xóa** file. |
| DOC-R10 | Mã tài liệu **duy nhất**, không phân hoa thường. Tạo trùng ⇒ báo lỗi, mở tài liệu đã có. |

## 5. Phân quyền

- **Tài nguyên mới `documents`** trong `lib/permissions.ts` (mặc định cấm với mọi vai trò, trừ admin): `view` · `create` (tạo tài liệu, tải lần ban hành) · `update` · `delete` (chỉ Dự thảo) · `approve` (xem xét + phê duyệt trên app; ghi bản đã ký giấy) · `export`.
- Đợt đầu **chỉ admin** có `create/update/delete/approve` (chốt câu 2). Mọi vai trò có `view` (phạm vi phòng vẫn áp — DOC-R5). Sau này admin tick thêm trong màn "Vai trò & quyền".
- **Phòng ban của vai trò:**
  - Vai trò hệ thống: bảng ánh xạ trong code, cùng kiểu `WORKSHOP_BY_ROLE`. Ví dụ `director`, `vice-director` → Ban giám đốc · `manager-dong` → Sản xuất Đông · `warehouse-keeper` → Thu mua · `accountant`, `chief-accountant` → Kế toán.
  - Vai trò admin tự tạo (mig `0062`): thêm **cột `department` có thể rỗng** vào `app_roles`. Ví dụ admin tạo vai trò "Phòng Kế hoạch", chọn phòng = Kế hoạch.
  - Một người nhiều vai trò ⇒ thuộc **hợp** các phòng.
- ⚠️ **Ngoại lệ có chủ đích:** hiện mọi hành động ĐỌC có phạm vi `all` ([`role-permissions` §6](role-permissions.md)). `documents.view` là **tài nguyên đầu tiên lọc dòng khi ĐỌC**. Lọc ở **3 lớp**: danh sách trong app · RLS `SELECT` trên 2 bảng mới · policy `SELECT` trên bucket file. Thiếu lớp máy chủ thì gọi API thẳng vẫn đọc được tài liệu mật.

## 6. Kho file (Supabase Storage) — chủ dự án tạo

`lib/storage.ts` hiện **chỉ dùng cho ảnh**: cố định bucket `qc`, luôn nén thành JPEG. Không dùng lại được cho PDF/Word ⇒ cần **bucket riêng** và hàm tải file riêng (không nén).

**Chủ dự án tạo trên Dashboard → Storage → New bucket:**

| Mục | Giá trị |
|---|---|
| Tên | `documents` |
| Public bucket | **Tắt** (private — mở bằng link có hạn) |
| File size limit | **20 MB** *(chờ chốt — §9)* |
| Allowed MIME types | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `image/jpeg`, `image/png` |

**Policy của bucket không tạo trên Dashboard.** Policy đọc phải tra bảng tài liệu để biết phòng nào được xem, nên nằm trong migration (§7). Migration chạy **sau** khi tạo bucket.

Đường dẫn file: `<site_id>/<document_id>/<version_id>/<pdf|source>-<tên file>`. Chế độ demo dùng `site-demo/...`, tách khỏi file thật (luật 15).

## 7. Dữ liệu (đề xuất — tên tiếng Anh theo luật 8)

**Migration `0072_company_documents.sql`** (số kế tiếp sau `0071`; rà lại với `origin` trước khi đặt). Chỉ thêm, idempotent, chạy 2 lần không lỗi, có khối ROLLBACK.

| Bảng / thay đổi | Cột chính |
|---|---|
| `company_documents` | `id` · `code` (duy nhất theo site, không phân hoa thường) · `title` · `kind` (`procedure` / `instruction` / `form` / `certificate` / `capability_profile` / `other`) · `parent_id` · `owner_department` · `visibility` (`company` / `departments`) · `visible_departments` (mảng) · `retention_years` · `expires_on` · `is_withdrawn` · `note` · `site_id` · thời điểm tạo/sửa |
| `document_versions` | `id` · `document_id` · `revision_no` · `effective_date` · `change_summary` · `status` (`draft` / `in_review` / `pending_approval` / `active` / `obsolete`) · `approval_mode` (`app` / `paper`) · `prepared_by_name`, `reviewed_by_name`, `approved_by_name` (tên in trên tài liệu) · `reviewer_id`, `approver_id` (tài khoản, khi duyệt trên app) · `reviewed_at`, `approved_at` · `return_reason` · `pdf_path`, `source_path`, `file_name`, `file_size` · `site_id` · thời điểm |
| `app_roles.department` | cột mới, có thể rỗng |
| Hàm `current_user_departments()` | suy phòng từ vai trò (hệ thống + `app_roles.department`), Ban giám đốc / admin ⇒ tất cả |
| RLS | `SELECT` lọc theo DOC-R5 · ghi theo `documents.*` (trigger ghi `0065`, chế độ `log` như các bảng khác) |
| Policy `storage.objects` (bucket `documents`) | đọc: file thuộc lần ban hành của tài liệu mình được xem · ghi/xóa: có `documents.create` / `delete` |

Kèm theo cùng commit (luật repo): `TableMapping` + `refColumns` (khóa ngoại `parent_id`, `document_id`) · `DemoBundle` + `DemoPackLoader` + checklist [`che-do-demo`](che-do-demo.md) §5 · `rowMarkKey` cho bảng danh sách (luật 12) · nháp form (luật 17) · test cho hàm thuần (trạng thái, DOC-R1, phạm vi xem, hạn chứng nhận).

## 8. Kế hoạch xây dựng

| Đợt | Phạm vi | Tier | Cần chủ dự án |
|---|---|---|---|
| **1 — Thư viện** ✅ 2026-10-19 | Trang `/documents`: danh sách lọc theo loại / phòng / trạng thái / tìm mã-tên · chi tiết tài liệu + các lần ban hành · tải lên PDF + Word · **ghi bản đã ký giấy** (DOC-R3b) · tài liệu cha–con · phạm vi xem theo phòng (3 lớp) · chứng nhận sắp hết hạn vào Việc của tôi · nhập sẵn QTI-KH-01 + 8 biểu mẫu làm dữ liệu đầu tiên | 🟡 bảng mới + cột rỗng + route mới | Tạo bucket (§6) · chạy `0072` (2 lần) |
| **2 — Duyệt trên app** | Gửi xem xét → xem xét Đạt/Trả lại → phê duyệt Duyệt/Trả lại → tự ban hành · giao việc người duyệt qua Việc của tôi · lịch sử từng bước | 🟡 | — |
| **3 — Nối module & gửi khách** | Bản in các module (vd lệnh SX của Phòng KH) tự lấy mã biểu mẫu + lần ban hành đang hiệu lực · gói "Hồ sơ năng lực gửi khách" (chọn nhiều tài liệu ⇒ tải một lần) · xác nhận "đã đọc" khi có lần ban hành mới | 🟡 | — · **chia sẻ link cho người ngoài công ty = 🔴, không làm nếu chưa hỏi** |

**Không làm:** soạn thảo trực tuyến, ký số, tìm theo nội dung bên trong file, đồng bộ Google Drive/OneDrive.

Sau khi build: viết `docs/app-map/4x-documents.md` · sửa `02`, `03`, `04`, `05` · đổi luật dòng cuối của [`ho-so-nang-luc/README.md`](../ho-so-nang-luc/README.md) ("file gốc không vào repo") thành "file gốc lưu ở trang Tài liệu công ty".

## 9. Còn cần chốt (không chặn đợt 1 — dùng mặc định nếu chưa trả lời)

| Mã | Câu | Mặc định nếu chưa chốt |
|---|---|---|
| D1 | Danh sách phòng ban chính thức của xí nghiệp? | 10 phòng ở §3 |
| D2 | Ánh xạ vai trò → phòng ban có đúng không (đặc biệt quản đốc, phó quản đốc, tổ trưởng)? | như §5 · phó quản đốc / tổ trưởng ⇒ theo xưởng nếu biết, không thì "Sản xuất" chung |
| D3 | Giới hạn dung lượng một file? | 20 MB |
| D4 | Nhắc gia hạn chứng nhận trước bao lâu? | 60 ngày |
| D5 | Hồ sơ năng lực gửi khách (b) gồm những tài liệu nào? | chứng nhận BRC, Halal, HACCP, mã EU + giới thiệu công ty |
| D6 | Phòng nào xem được tài liệu "Hồ sơ năng lực"? | Ban giám đốc + Kế hoạch |
