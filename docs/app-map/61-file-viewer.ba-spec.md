# 61 — ba-spec: Xem file đính kèm ngay trên web app (không bắt tải về)

> Load khi: đổi cách xem / mở / tải file đính kèm (tài liệu công ty, chứng từ Xuất khẩu, chứng từ Nhập khẩu), thêm loại file mới cho phép đính, hoặc màn mới có nút "Xem file".
covers: src/lib/documents.ts, src/lib/legacyWordText.ts, src/lib/sheetPreview.ts, src/lib/fileViewLink.ts, src/features/shared/FileViewer.tsx, src/features/shared/FileViewScreen.tsx, src/features/documents/FilePreviewDialog.tsx, src/features/documents/openDocumentFile.ts, src/features/export-planning/parts.tsx, src/features/import-planning/parts.tsx, src/features/shared/fileViewSources.ts, src/lib/openInNewTab.ts
last_verified: 2026-11-02
<!-- updated: 2026-11-02 (b) — R8 + Flow N2 mới: "Mở tab mới" = liên kết tab mới tới trang xem của app cho MỌI loại; bỏ mọi đường dự phòng thay trang đang mở (`openInNewTab` trả opened | no-url | blocked, chỉ tải về được dùng tab này); trang xem không tự rời app; AC-8. -->
ttl_days: 180

> **Mục đích**: oracle HÀNH VI cho việc xem file đính kèm. Không mô tả giao diện.

---

## 1. Vấn đề & JTBD

Chủ dự án (2026-11-02): "file đuôi .doc vẫn bắt tải về chứ không xem trực tiếp hoặc mở tab mới xem được — sửa và áp dụng với tất cả file cần xem".

Trước đó: chỉ PDF + ảnh xem được trong app (`filePreviewKind` → `pdf | image | download`). Word (.doc, .docx), Excel (.xls, .xlsx), văn bản (.csv, .txt) ⇒ "Tải về". "Mở tab mới" trỏ thẳng link có hạn của Storage ⇒ trình duyệt TẢI file Word / Excel thay vì hiện.

JTBD: *Khi cần đọc một chứng từ / tài liệu đã đính, tôi muốn đọc ngay trên app (ở hộp xem hoặc tab mới), để khỏi tải về máy rồi mở bằng Word / Excel — nhất là trên điện thoại, máy xưởng không cài Office.*

## 2. User registry

| User | Vai trò | Nghiệp vụ ở spec này |
|---|---|---|
| Người xem file (mọi vai được xem trang có file: kế toán, Phòng Kế hoạch, thủ kho, BGĐ, admin) | đọc file đã đính | N1 xem trong app · N2 mở tab mới · N3 tải về |
| Supabase Storage (hệ thống) | cấp link có hạn theo quyền RLS hiện có | nguồn bytes — KHÔNG đổi cấu hình bucket / policy |

Không có cross-user handoff: xem file là việc một người, không chuyển trạng thái, không ghi dữ liệu.

## 3. Nghiệp vụ × flow

| ID | Nghiệp vụ | Owner | Input | Output |
|---|---|---|---|---|
| N1 | Xem file trong app | Người xem | file đính (đường dẫn + tên) ở 3 nguồn: `documents`, chứng từ xuất, chứng từ nhập | nội dung file hiện ngay, theo loại (bảng §4) |
| N2 | Mở tab mới | Người xem | như N1 | tab mới HIỆN nội dung; không file nào tự tải về |
| N3 | Tải về | Người xem | như N1 | file gốc tải về máy, đúng tên gốc |

Flow N1: chọn Xem → app lấy link có hạn (10 phút, theo quyền hiện có) → loại PDF / ảnh: hiện trực tiếp từ link; loại Word / Excel / văn bản: app tải bytes về bộ nhớ trình duyệt rồi dựng nội dung → END: nội dung hiện, hoặc câu lỗi nói rõ lý do + còn Tải về.
Flow N2: chọn Mở tab mới → app mở NGAY trong lúc bấm một liên kết tab mới tới **trang xem file của app** (mọi loại) → trang đó chạy Flow N1; PDF / ảnh có thêm "Mở file gốc" (tab khác, trình xem của trình duyệt — iPhone / iPad đủ trang) → END như N1. **Trang đang làm KHÔNG BAO GIỜ bị thay** (R8).
Flow N3: chọn Tải về → link có hạn kèm tên tải → END: file nằm trong Downloads.

## 4. Rules

| ID | Rule |
|---|---|
| R1 | Loại theo đuôi tên file: `pdf` → PDF · `jpg jpeg png webp gif` → ảnh · `docx` → Word (dựng đúng trang) · `doc` → Word đời cũ (trích chữ + bảng) · `xls xlsx` → bảng tính · `csv txt` → văn bản · còn lại (`zip`, `heic`…) → chỉ tải về. Hàm thuần `filePreviewKind` (lib, có test) là nguồn duy nhất. |
| R2 | **Không gửi file ra dịch vụ ngoài** (Office Online, Google Docs viewer): link file nội bộ không được rời app. Mọi dựng nội dung chạy trong trình duyệt. |
| R3 | Không đổi bucket, policy RLS, migration. Quyền xem = quyền lấy link có hạn hiện có; trang xem ở tab mới cũng phải qua đăng nhập + quyền đó. |
| R4 | `.doc` (Word 97–2003, nhị phân) không có thư viện trình duyệt dựng đúng trang ⇒ hiện **chữ + bảng** trích từ file (bỏ định dạng, hình) kèm dòng nói rõ "bản xem chữ — định dạng gốc xem bằng Tải về". File `.doc` mã hóa / hỏng ⇒ báo không đọc được, còn Tải về. |
| R5 | Bảng tính: mỗi sheet một phần, hiện giá trị ô đã định dạng như Excel hiện; tối đa 1.000 dòng / sheet, quá ⇒ ghi "đang hiện 1.000 / N dòng — tải về để xem đủ". |
| R6 | File demo giữ chỗ (`DEMO_PLACEHOLDER_PREFIX`) giữ hành vi cũ: báo không có file thật, không mở tab. |
| R8 | (2026-11-02, lỗi người dùng báo) Mở tab mới KHÔNG được thay trang đang mở: trước đây khi trình duyệt không trả cửa sổ mới (chặn bật lên, app trên màn hình chính iPhone, trình duyệt trong ứng dụng) code "dự phòng" chuyển chính trang đang làm sang file ⇒ Quay lại thì app tải lại, mất trạng thái. Nay: xem bị chặn ⇒ báo lỗi, trang giữ nguyên; chỉ TẢI VỀ được dùng tab hiện tại (file tải xuống, trang không rời đi). Trang xem file không tự chuyển đi nơi khác (trình duyệt ép mở tại chỗ thì Quay lại vẫn về đúng trang, không tải lại). |
| R7 | Xem không ghi dữ liệu, không toast khi mở thành công; lỗi luôn báo (README luật 8). |

## 5. Acceptance Criteria

### AC-1 — N1, R1 · Test: unit
- **Given** tên file `HD-01.DOC`, `bao-gia.Docx`, `ke-hoach.xlsx`, `x.xls`, `a.csv`, `ghi-chu.txt`, `anh.JPG`, `scan.pdf`, `goi.zip`, `IMG_1.heic`
- **When** phân loại
- **Then** lần lượt `doc, docx, sheet, sheet, text, text, image, pdf, download, download`.
- **Assert** `filePreviewKind` trả đúng 10 giá trị trên (không phân biệt hoa thường).

### AC-2 — N1, R4 · Test: unit
- **Given** một file `.doc` hợp lệ có 2 đoạn văn và 1 bảng 2 ô × 1 dòng
- **When** trích nội dung
- **Then** ra 2 khối đoạn văn + 1 khối dòng bảng 2 ô, chữ tiếng Việt (UTF-16) giữ nguyên dấu.
- **Assert** `readLegacyWordBlocks` trả `blocks.length == 3`, khối bảng có `cells.length == 2`, chữ "Hợp đồng số 01" khớp nguyên văn.

### AC-3 — N1, R4 · Test: unit
- **Given** bytes không phải file Word (vd PDF, file rỗng)
- **When** trích
- **Then** báo lỗi, không văng app.
- **Assert** `readLegacyWordBlocks` ném lỗi có thông điệp tiếng Việt; số khối trả về == 0 không xảy ra (ném trước).

### AC-4 — N1, R5 · Test: unit
- **Given** workbook 2 sheet, sheet 1 có 1.205 dòng
- **When** đọc bảng tính với trần 1.000
- **Then** 2 phần, phần 1 có 1.000 dòng + `total == 1205`.
- **Assert** `readSheetPreview(bytes, 1000)` → `sheets.length == 2`, `sheets[0].rows.length == 1000`, `sheets[0].total == 1205`.

### AC-5 — N2, R1/R3 · Test: unit
- **Given** file bất kỳ loại nào (`.doc`, `.xlsx`, `.pdf`, ảnh…)
- **When** chọn Mở tab mới
- **Then** tab mới mở trang xem của app (không trỏ thẳng link Storage), địa chỉ chứa nguồn + đường dẫn file, tên có dấu đọc lại đúng
- **Assert** `fileViewHref("export", "c1/Hợp đồng.doc", "Hợp đồng.doc")` bắt đầu bằng `#/file-view?`, chứa `src=export`; `parseFileViewParams` trả lại đúng `{ source: "export", path: "c1/Hợp đồng.doc", name: "Hợp đồng.doc" }`

### AC-6 — N2, R3 · Test: manual
- **Given** trang xem ở tab mới với `src` không thuộc {`documents`, `export`, `import`} hoặc thiếu `path`
- **When** mở
- **Then** báo "Không mở được file", không gọi Storage.
- **Assert** nội dung trang chứa "Không mở được file" và số request tới `/storage/` == 0. (preview)

### AC-7 — N1/N2, R2 · Test: manual
- **Given** mọi loại file
- **When** xem / mở tab mới
- **Then** không có request nào tới máy chủ ngoài app + Storage của dự án.
- **Assert** số request tới host `officeapps.live.com` hoặc `docs.google.com` == 0. (preview, tab Network)

### AC-8 — Mở tab mới không bao giờ thay trang đang mở · N2, R8 · Test: unit
- **Given** trình duyệt chặn tab mới (`window.open` trả null)
- **When** xem file (không phải tải về)
- **Then** trả `blocked`, trang hiện tại không đổi địa chỉ; tải về thì được tải bằng tab hiện tại
- **Assert** `openInNewTab(get)` == `"blocked"` và số lần `location.assign` == 0; với `{ download: true }` == `"opened"` và `location.assign` gọi đúng 1 lần

## 6. Flow optimization log

| Biến thể | Kết quả | Lý do |
|---|---|---|
| A. Office Online / Google viewer nhúng link có hạn | **Loại** | R2: lộ file nội bộ ra dịch vụ ngoài (router chấm RED); cần link công khai |
| B. Chuyển `.doc` → PDF phía máy chủ (Edge Function + LibreOffice) | Hoãn | Đúng định dạng nhất nhưng cần hạ tầng mới + deploy; ngoài phạm vi sửa nhanh |
| C. Dựng trong trình duyệt: `docx-preview` cho .docx, trích chữ + bảng cho .doc, SheetJS cho Excel; tab mới = trang xem của app | **Chọn** | Không đổi hạ tầng / quyền; dùng thư viện đã có (`docx-preview`, `xlsx`); .doc mất định dạng nhưng đọc được nội dung — ghi rõ R4 |
| D. Tab mới = blob URL tự dựng HTML | Loại | Blob URL mất khi tab nguồn đóng, không gửi lại được; trang của app dùng lại đúng khung xem |

## 7. Scope

IN: 3 hộp xem (Tài liệu công ty, chứng từ Xuất khẩu, chứng từ Nhập khẩu) + trang xem ở tab mới.
OUT: ảnh `.heic` trên Chrome (trình duyệt không đọc được — vẫn Tải về); `.zip`; dựng đúng định dạng `.doc` (cần biến thể B). Hóa đơn đại lý + ảnh phiếu OCR chỉ nhận PDF / ảnh ⇒ đã xem được, không đổi.

## Assumptions

- Link có hạn của Supabase Storage cho phép `fetch` từ trình duyệt (CORS mặc định của Storage mở cho GET) — đã dùng cho `iframe` / `img`; nếu bị chặn, khung xem báo lỗi và còn Tải về.
- Trang xem ở tab mới nằm trong khung đăng nhập của app (cùng phiên, localStorage).

## History

- 2026-11-02 — tạo (biến thể C).
- 2026-11-02 (b) — sửa lỗi "Mở tab mới mở ngay trong trang, quay lại bị tải lại" (R8, AC-8).
