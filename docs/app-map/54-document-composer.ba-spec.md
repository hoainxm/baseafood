# 54 — ba-spec: Bộ soạn văn bản từ mẫu · loại văn bản đầu tiên: file Lệnh sản xuất QTI-KH-01-04

> Load khi: soạn / xuất file Word hoặc PDF theo biểu mẫu của công ty từ một bản ghi trên app (đầu tiên là Lệnh sản xuất); thêm loại văn bản mới vào bộ soạn; quản trị tải khuôn Word; sửa luật điền sẵn, nguồn ô, lịch sử xuất.
covers: src/lib/documentComposer.ts, src/lib/documentTypes/**, src/lib/docxTemplate.ts, src/lib/documentTemplateStorage.ts, src/features/document-composer/**, src/design-system/patterns/DocxPreview.tsx, supabase/migrations/0091_composed_documents.sql
last_verified: 2026-11-02
<!-- updated: 2026-11-04 (ba-spec 72) — loại văn bản thứ hai `export-order-form` (Lệnh xuất hàng QTI-KH-01-07, nguồn chuyến xuất, tài nguyên `export-plans`, khuôn gốc `exportOrderTemplate.ts`); ô có thể `requiredWhen` (bắt buộc theo ô khác); `DocumentComposerView` nhận `onExported` (xuất Word xong ⇒ nơi gọi lưu kèm file). -->
<!-- re-verified: 2026-11-02 09:10 — P2 + P3: PGlite chuỗi 0001→0091 + chạy lại 0091, 22/22 (AC-11). Sandbox demolocal, chế độ demo "Tạo bộ mới": lệnh 2.11 mở `&file=1` ⇒ 42 ô điền sẵn + nhãn nguồn; sửa kg 250 → 240 ⇒ cờ "Khác lệnh · 1 ô", xem trước Tổng 240; rời trang rồi quay lại còn nháp; Xuất Word ⇒ bản soạn lưu, 1 lần xuất (snapshot kg 240, khuôn gốc), dòng lệnh vẫn 25 thùng / 250 kg (AC-4), trạng thái Đã xuất; Xuất PDF ⇒ trang in 1 trang rộng 210 mm, ghi lần xuất pdf; tải lại từ lịch sử không thêm lần xuất (AC-13); 360 px × 130 % không tràn; 29 khóa `bsf.*` trước == sau (AC-16). AC-17 = `guides/orderFileGuide.test.tsx`. -->
<!-- re-verified: 2026-10-31 17:00 — P0 + P1: `documentComposer.test.ts` 22 test xanh = AC-1…3, 5…7, 9, 10, 12…15, 18 + phần hàm thuần AC-4; khuôn gốc điền số 19.10 mở bằng Quick Look: 1 trang A4, bảng 7 cột, dòng Tổng 1.000 / 12.000, cột nhãn thẳng hàng. -->
ttl_days: 90
status: v1 — Q1–Q10 đã chốt 2026-10-31 (§11). **P0–P3 XONG** (P0 + P1 2026-10-31, P2 + P3 2026-11-02). Mig `0091` ⏳ CHƯA chạy DB thật (tạo bucket `document-templates` trước). Còn của P4: Phòng KH mở file `.docx` bằng Word trên máy công ty (AC-8 phần Word), thử quyền nơi nhận trên DB thật sau khi chạy 0091. Giao diện: design-spec 55 (viết sau, theo ui-design-logic).

> **Mục đích:** oracle HÀNH VI cho bộ soạn văn bản. Bộ soạn đọc một bản ghi nguồn rồi điền sẵn các ô của biểu mẫu. Người soạn sửa ô sai, xem trước trang A4, rồi xuất Word hoặc PDF. App lưu bản soạn và lịch sử xuất. Spec **không** mô tả giao diện.
> **Nguồn:** yêu cầu chủ dự án 2026-10-31 ("xây dựng file lệnh sản xuất dạng word hoặc pdf, khác với lệnh trên hệ thống … sau này áp dụng nhiều vị trí") · file mẫu thật **LSX số 19.10** ngày 27/10/2026 (`.doc`, 42 ô form, đọc được cả giá trị đang chọn) · quy trình [QTI-KH-01 bước 8](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) · Lệnh sản xuất trên app [48](48-production-order.ba-spec.md).

---

## 0. Lệnh sản xuất lập từ nhập khẩu hay xuất khẩu

Lệnh sản xuất lập từ **hợp đồng xuất khẩu**. Nhập khẩu chỉ là nơi lấy nguyên liệu cho lệnh, không phải nguồn của lệnh. Căn cứ:

| Căn cứ | Nội dung |
|---|---|
| Quy trình QTI-KH-01 bước 7 → 8 | BGĐ duyệt HĐ bán hoặc L/C ⇒ Phòng KH **viết lệnh sản xuất** (QTI-KH-01-04) gửi Kỹ thuật, Kho, Phân xưởng |
| File mẫu LSX 19.10 | Các ô đều là thông tin đơn bán: khách **Matsuda Sangyo**, thị trường Nhật, ngày giao 15/11/2026, quy cách đóng gói của khách. Mẫu **không có ô nào** về nguyên liệu nhập khẩu |
| Ba-spec 48 §0c, R1 | Đầu vào của lệnh là **dòng hàng HĐ xuất**. NL nhập khẩu chỉ gắn vào lệnh dưới dạng "NL dự kiến" (lần nhập + kg, không trừ kho) |
| Code | `lineFromContract(ExportContractLine …)` dựng dòng lệnh. `canCreateOrder` kiểm bản HĐ **xuất** đã duyệt. `ProductionOrderMaterial` chỉ trỏ tới `import_receipt_lines` |

```
HĐ xuất (đã duyệt) ──► Lệnh sản xuất trên app ──► FILE LSX (Word / PDF, mẫu QTI-KH-01-04)   ← spec này
                         ▲
Nhập khẩu (lần nhập) ────┘ NL dự kiến: chỉ để Phòng KH biết lấy NL lô nào; không lên file
```

⇒ Nguồn của file (Q1 = A) là **Lệnh sản xuất đã lập trên app**. Qua lệnh, file có đủ số liệu HĐ xuất. NL nhập khẩu dự kiến **không in lên file**, vì mẫu giấy không có chỗ (giả định A5).

## 1. Vấn đề & JTBD

- Phòng KH đang gõ LSX bằng Word, chép tay từ hợp đồng. Lệnh trên app (48) đã có số liệu nhưng chỉ in được bản gọn của trình duyệt. Bản đó không đủ ô như mẫu giấy và không ra file Word.
- Nhiều chứng từ khác của công ty cũng là "biểu mẫu Word + số liệu đã có trên app". Mỗi chỗ tự làm riêng thì lặp code và mỗi chỗ một kiểu.
- **JTBD:** *Khi lệnh sản xuất đã lập trên app, tôi (NV Phòng KH) muốn ra file LSX đúng mẫu QTI-KH-01-04 trong vài phút mà không chép số tay, để gửi phân xưởng, kỹ thuật, kho và lưu hồ sơ.*

## 2. User registry

| Mã | Ai | Quyền ở đây |
|---|---|---|
| U1 | NV Phòng Kế hoạch (vai trò `planner`) | Có quyền **ghi** `production-orders` ⇒ soạn, sửa, lưu, xuất (Q9 = A) |
| U2 | Quản đốc · thủ kho · kế toán · GĐ | Có quyền **xem** `production-orders` ⇒ xem và tải lại **bản đã xuất**, không sửa |
| U3 | Quản trị hệ thống (`admin`) | Tải khuôn Word mới, chọn khuôn đang dùng của từng loại văn bản (Q7 = A) |
| U4 | Người phát triển (IT) | Khai **loại văn bản** mới: danh sách ô, cách lấy dữ liệu, khuôn gốc |
| S1 | Lệnh sản xuất (48) | Nguồn dữ liệu, không đổi vì bộ soạn |
| X1 | Phòng Kỹ thuật · Kho · Phân xưởng | Nhận file ngoài app (48 Q4 = A). Không thao tác trên bộ soạn |

## 3. User × Nghiệp vụ

| Mã | Nghiệp vụ | Owner |
|---|---|---|
| DC1 | Soạn văn bản từ bản ghi nguồn: điền sẵn, sửa, lưu | U1 |
| DC2 | Xem trước và xuất Word / PDF, ghi lịch sử xuất | U1 |
| DC3 | Xem và tải lại bản đã xuất | U2 |
| DC4 | Quản lý khuôn Word của từng loại văn bản | U3 |
| DC5 | Khai loại văn bản mới | U4 |

## 4. Cross-user handoff

| Từ → Tới | Cái gì | Điều kiện | Không có thì |
|---|---|---|---|
| S1 → U1 | Lệnh sản xuất làm nguồn | Lệnh chưa hủy (R11) | Lệnh đã hủy ⇒ không soạn mới, bản cũ chỉ xem |
| S1 → U1 | Cờ "Lệnh đã sửa sau khi soạn" | Lần sửa của lệnh > lần sửa lúc soạn (R10) | Không cờ |
| U1 → U2 | Bản đã xuất | ≥ 1 lần xuất | U2 thấy "Chưa xuất file" |
| U1 → X1 | File Word / PDF | U1 tự gửi ngoài app (Q10 = A) | — |
| U3 → U1 | Khuôn mới | Khuôn qua kiểm thẻ (R13) | Dùng khuôn đang dùng trước đó, hoặc khuôn gốc |
| U4 → U1, U3 | Loại văn bản mới | Có khai ô + khuôn gốc | — |

## 5. Flows

### DC1 — Soạn · owner U1
- **Input:** một lệnh sản xuất chưa hủy, U1 có quyền ghi `production-orders`.
- **Steps:** U1 chọn soạn file LSX từ lệnh ⇒ lệnh chưa có bản soạn thì app tạo bản mới và **điền sẵn** theo R2. Đã có thì mở bản đang có (R12) ⇒ mỗi ô hiện nguồn của nó (R3) ⇒ U1 sửa ô sai ⇒ lưu.
- **Output:** bản soạn lưu trên máy chủ, gắn với lệnh: giá trị từng ô, nguồn từng ô, lần sửa của lệnh lúc soạn. Trạng thái **Nháp**.
- **End:** lưu xong, hoặc U1 thoát ⇒ chỉnh dở còn trong nháp máy (QT 17), chưa ghi máy chủ.

### DC2 — Xem trước + xuất · owner U1
- **Input:** bản soạn đủ ô bắt buộc (R5).
- **Steps:** xem trước trang A4 sinh từ khuôn đang dùng (R8) ⇒ xuất **Word** (tải file `.docx`) hoặc **PDF** (mở hộp in của trình duyệt, chọn "Lưu thành PDF", Q8 = A) ⇒ app lưu bản soạn (nếu có đổi) rồi ghi **một lần xuất** (R9).
- **Output:** file Word đúng khuôn, hoặc bản PDF A4. Lịch sử xuất thêm 1 dòng. Trạng thái **Đã xuất**.
- **End:** file đã tải hoặc hộp in đã mở. Thiếu ô bắt buộc ⇒ không xuất, kê đủ các ô thiếu (R5).

### DC3 — Xem / tải lại bản đã xuất · owner U2
- **Input:** lệnh U2 xem được, có ≥ 1 lần xuất.
- **Steps:** mở lần xuất gần nhất (hoặc lần cũ hơn trong lịch sử) ⇒ xem trước ⇒ tải Word / PDF.
- **Output:** file **giống hệt** lần xuất đó: cùng giá trị, cùng khuôn (R9, R14). Tải lại **không** ghi thêm lần xuất.
- **End:** file đã tải. Chưa xuất lần nào ⇒ U2 thấy "Chưa xuất file".

### DC4 — Khuôn · owner U3
- **Input:** một file `.docx` có thẻ (như `{orderNo}`) cho một loại văn bản.
- **Steps:** tải lên ⇒ app đọc các thẻ trong khuôn và so với danh sách ô của loại văn bản (R13) ⇒ thiếu thẻ bắt buộc ⇒ từ chối, kê thẻ thiếu ⇒ đủ ⇒ lưu thành phiên bản mới, U3 chọn làm khuôn đang dùng.
- **Output:** phiên bản khuôn mới. Lần xuất **sau** dùng khuôn này. Lần xuất cũ giữ khuôn cũ.
- **End:** khuôn đang dùng đổi, hoặc bị từ chối kèm lý do. Khuôn không xóa, chỉ ngưng dùng.

### DC5 — Khai loại văn bản mới · owner U4
- **Input:** biểu mẫu mới (vd. một chứng từ xuất khẩu), loại bản ghi nguồn trên app.
- **Steps:** khai **loại văn bản** gồm: khóa, tên, mã biểu mẫu, loại nguồn, tài nguyên quyền, danh sách ô (R1), cách lấy giá trị từ nguồn, giá trị mặc định, khuôn gốc ⇒ gắn lối vào soạn ở trang của nguồn.
- **Output:** loại văn bản soạn được với đủ DC1–DC4. **Không sửa** luật chung của bộ soạn (AC-15).
- **End:** test của loại văn bản mới xanh.

## 6. Flow optimization log

| Chỗ quyết | Biến thể | Chọn | Lý do loại biến thể khác | Bởi |
|---|---|---|---|---|
| Cách ra file | V1. Điền **khuôn Word** bằng thẻ. Xem trước vẽ lại chính file Word đó. PDF in từ bản xem trước · V2. Dựng mẫu bằng trang web, sinh Word bằng thư viện dựng lại bố cục · V3. Sửa thẳng trên bản xem trước như Word | **V1** | V2 phải giữ khớp hai bố cục, và quản trị không tự đổi mẫu được (trái Q7). V3 mất nguồn từng ô, không kiểm được ô thiếu, không ghi được lịch sử theo ô (rubric #2, #3) | Optimizer |
| PDF | Hộp in trình duyệt · ảnh chụp trang thành PDF · máy chủ đổi Word → PDF | **Hộp in** (Q8) | Ảnh chụp: chữ không tìm được, file nặng. Máy chủ đổi file: app chỉ có Supabase, phải thêm dịch vụ | Chủ dự án + Optimizer |
| Lưu | Chỉ bản mới nhất · bản soạn + **ảnh chụp giá trị mỗi lần xuất** | **Ảnh chụp mỗi lần xuất** | Biểu mẫu QTI-KH-01-04 là hồ sơ kiểm soát, lưu **2 năm** (QTI-KH-01 bước 12, 13). File đã gửi xưởng phải tải lại được đúng như lúc gửi, kể cả khi bản soạn hoặc khuôn đã đổi | Domain-Specialist (hồ sơ ISO) |
| Một lệnh mấy bản soạn | Nhiều bản · **một bản soạn cho mỗi lệnh × loại văn bản**, nhiều lần xuất | **Một bản** | Nhiều bản soạn của cùng lệnh ⇒ không biết bản nào đã gửi xưởng (rubric #3) | Optimizer |
| Ô không có trong lệnh | Mặc định · **lần trước cùng khách + mặt hàng → mặc định** · trống | **Lần trước → mặc định** (Q3) | Yêu cầu bao bì / Nafi lặp theo khách và mặt hàng (đúng luật `previousOrderFor` của 48). Để trống thì gõ lại mỗi lần | Chủ dự án |
| Sửa ô lấy từ lệnh | Ghi ngược về lệnh · khóa ô · **chỉ sửa trên file + đánh dấu "Khác lệnh"** | **Chỉ trên file** (Q4) | Ghi ngược làm sửa lệnh đã phát hành từ một chỗ phụ, mất vết sửa của 48 R13 | Chủ dự án |
| Cross-user | Gắn file vào bước 2 của chuyến xuất | **Đợt sau** (Q10) | Bước 2 đã tự xong khi lệnh phát hành (48 R6). Gắn file chỉ thêm việc, không mở khóa bước nào | Chủ dự án |

Cross-User-Integrity: 0 handoff treo. Mọi handoff ở §4 có người nhận và nhánh "không có thì".

## 7. Scope & Priority

**IN (đợt này):** bộ soạn chung (DC1–DC4), loại văn bản **LSX QTI-KH-01-04** với đủ ô ở §9a, khuôn gốc `.docx` dựng lại theo LSX 19.10 (Q6 = A), quản trị tải khuôn, lịch sử xuất, quyền, demo, hướng dẫn.

**OUT:**
- Gắn file vào chuyến xuất (Q10).
- Ký số, đóng dấu.
- Gửi email / Zalo từ app.
- Đọc file lệnh cũ (Word / PDF) tải lên để lấy số (Q1 phương án D).
- Loại văn bản thứ hai. Đợt này chỉ chứng minh khai được, bằng loại giả trong test (AC-15).
- Bỏ bản in gọn hiện có của lệnh (48 AC-15). Bản đó giữ nguyên.

## 8. Success metric

- Soạn và xuất một file LSX từ lệnh đã có: **≤ 3 phút** khi không phải sửa ô nào (đo trên preview: từ lúc mở bộ soạn tới khi có file).
- Không sửa tay thì **0 chỗ lệch** giữa file và lệnh ở 9 ô "Từ lệnh" của AC-1.
- Loại văn bản thứ hai thêm được mà **0 dòng sửa** ở `lib/documentComposer.ts` (AC-15).

## 9. Rules & Invariants

- **R1 Loại văn bản.** Một loại văn bản gồm: khóa (`production-order-form`), tên, mã biểu mẫu (`QTI-KH-01-04`), loại nguồn (lệnh sản xuất), tài nguyên quyền (`production-orders`), danh sách ô, khuôn gốc. Mỗi ô có: khóa, nhãn (đúng chữ trên mẫu), nhóm, kiểu, bắt buộc hay không, ánh xạ từ nguồn (nếu có), giá trị mặc định. Có 6 kiểu ô:
  - chữ một dòng;
  - chữ nhiều dòng;
  - ngày;
  - chọn một trong danh sách (đúng danh sách của mẫu Word);
  - đánh dấu có / không;
  - bảng dòng (nhiều dòng, mỗi dòng có các ô con).
- **R2 Điền sẵn.** Mỗi ô lấy giá trị theo thứ tự, gặp giá trị đầu tiên không trống thì dừng:
  1. Từ lệnh, nếu ô có ánh xạ.
  2. Từ **bản đã xuất gần nhất** của một lệnh khác, chưa hủy, cùng khách, có dòng cùng mặt hàng với dòng 1 của lệnh này. Chỉ áp cho ô khai **chép từ lần trước** (`carryOver`): yêu cầu bao bì, ghi nhãn, Nafi, quy trình, lưu ý khác. Ô định danh của lệnh (số, ngày, bảng hàng, MSL, NSX, ngày giao, thị trường, hạn dùng) không bao giờ chép.
  3. Giá trị mặc định của loại văn bản (= giá trị trên LSX 19.10, §9a).
  4. Trống.

  Bản soạn **chưa xuất lần nào** không được dùng làm "lần trước".
- **R3 Nguồn ô.** Mỗi ô mang một nguồn: **Từ lệnh** · **Từ file LSX <số>** · **Mặc định mẫu** · **Sửa tay** · **Trống**. Người soạn đổi giá trị ⇒ nguồn thành **Sửa tay**. Ô có ánh xạ lệnh mà giá trị khác giá trị lệnh ⇒ thêm cờ **Khác lệnh**, kèm giá trị của lệnh.
- **R4 Không ghi ngược (Q4).** Soạn, lưu, xuất không đổi bất kỳ bảng nào ngoài 3 bảng của bộ soạn (R16). Lệnh, dòng lệnh, HĐ xuất, nhập khẩu giữ nguyên.
- **R5 Ô bắt buộc.** Phải có: số lệnh, ngày lệnh, ≥ 1 dòng hàng (tên hàng, số thùng, số kg), ngày giao, thị trường. Thiếu ⇒ không xuất, kê **đủ** các ô thiếu một lượt. Lưu nháp vẫn được khi thiếu.
- **R6 Bảng hàng.** Dòng trên file lấy từ dòng lệnh theo thứ tự. STT tự đánh. Dòng **Tổng** = cộng số thùng và số kg của các dòng **trên file**, tính theo số sau khi sửa. Mã số lô và ngày SX là ô gộp cho cả bảng, như mẫu.
- **R7 Cách ghi.**
  - Số theo vi-VN: 1.000 · 12.000.
  - Ngày lệnh: "Ngày 27 Tháng 10 Năm 2026".
  - Ngày giao: "15/11/2026".
  - Ngày SX: gộp cùng tháng thành "NSX: 02, 03, 04/11/2026" (đúng luật bản in của 48). Khác tháng thì ghi từng ngày đầy đủ.
  - Hạn dùng: tròn năm ghi "2 năm", lẻ ghi "18 tháng".
  - Thị trường: "Nhật (Matsuda Sangyo)".
  - Quy cách = quy cách dòng lệnh. Ghi chú dòng lệnh (nếu có) xuống dòng ngay dưới.
- **R8 Một khuôn cho cả xem trước và Word.** Xem trước là chính file Word vừa sinh, vẽ lên trang. PDF in từ bản xem trước đó. Xem trước thấy chữ gì thì file Word có đúng chữ đó. File Word ra là **chữ thường**, không còn ô form; ô chọn in ra chữ đã chọn.
- **R9 Lần xuất.** Mỗi lần xuất ghi: thời điểm, người xuất, định dạng (`docx` | `pdf`), phiên bản khuôn đã dùng, **ảnh chụp toàn bộ giá trị**. PDF ghi lúc mở hộp in, vì app không biết người dùng có lưu file hay không. Lần xuất không sửa, không xóa. Tên file Word: `LSX-<số lệnh>-<khách>-<yyyymmdd ngày lệnh>.docx`, bỏ ký tự không hợp lệ.
- **R10 Trạng thái bản soạn.**
  - **Nháp:** chưa xuất lần nào.
  - **Đã xuất:** giá trị hiện tại == ảnh chụp của lần xuất gần nhất.
  - **Sửa sau lần xuất:** giá trị đã khác lần xuất gần nhất.

  Có thể kèm hai cờ:
  - **Lệnh đã sửa sau khi soạn:** lần sửa của lệnh > lần sửa ghi lúc soạn. U1 chọn **Lấy lại số từ lệnh** ⇒ ô nguồn "Từ lệnh" nhận giá trị mới, ô "Sửa tay" giữ nguyên (vẫn cờ "Khác lệnh" nếu khác). Sau đó cờ tắt.
  - **Lệnh đã hủy.**
- **R11 Lệnh hủy.** Không tạo bản soạn mới. Bản đã có chỉ xem và tải lại, không sửa, không xuất mới.
- **R12 Một bản soạn mỗi lệnh × loại văn bản.** Soạn lần nữa thì mở lại bản đang có.
- **R13 Khuôn.**
  - Khuôn là `.docx` có thẻ `{khóa ô}`; bảng dòng dùng `{#lines}…{/lines}`.
  - **Thẻ bắt buộc** là thẻ của các ô ở R5. Khuôn thiếu thẻ bắt buộc ⇒ từ chối và kê thẻ thiếu.
  - Thiếu thẻ của ô không bắt buộc ⇒ nhận, kèm cảnh báo "ô … sẽ không có trên file".
  - Thẻ không có trong danh sách ô ⇒ nhận, kèm cảnh báo "thẻ … sẽ để trống".
  - Mỗi loại văn bản có đúng **1 khuôn đang dùng**. Chưa có khuôn tải lên ⇒ dùng khuôn gốc đi kèm app. Khuôn cũ không xóa.
- **R14 Tải lại đúng như lúc gửi.** Tải lại một lần xuất ⇒ dùng ảnh chụp giá trị **và** phiên bản khuôn của lần đó, không dùng khuôn đang dùng.
- **R15 Quyền.**
  - Soạn, sửa, xuất: quyền **ghi** tài nguyên của loại văn bản (`production-orders`).
  - Xem, tải lại lần xuất: quyền **xem** tài nguyên đó. Nơi nhận chỉ thấy bản soạn của lệnh **đã phát hành**, như 48 R10.
  - Khuôn: chỉ quản trị ghi. Ai soạn được thì đọc được khuôn.
- **R16 Dữ liệu (migration chỉ thêm).** Thêm 3 bảng và 1 bucket:
  - `document_templates`: loại văn bản · số phiên bản · đường dẫn file · thẻ đọc được · đang dùng / ngưng · người tải · lúc tải.
  - `composed_documents`: loại văn bản · loại + id nguồn · tài nguyên quyền · giá trị (jsonb) · nguồn ô (jsonb) · lần sửa của nguồn lúc soạn · khách · mã mặt hàng.
  - `composed_document_exports`: bản soạn · định dạng · khuôn · ảnh chụp giá trị · người xuất · lúc xuất.
  - Bucket riêng `document-templates`, private.

  RLS theo cột tài nguyên quyền của từng dòng (`has_export_permission(resource, action)` của 0075). Có `site_id`. Vào `DemoBundle` (QT 15).
- **R17 Hồ sơ lưu 2 năm.** Lần xuất và khuôn đã dùng **không xóa**. Xóa lệnh không xóa lần xuất (khóa mềm, như 48).

### 9a. Danh sách ô của loại văn bản LSX QTI-KH-01-04

Số trong ngoặc là thứ tự ô form trên file `.doc` mẫu. Chữ cố định nằm trong khuôn, không phải ô: "LỆNH SẢN XUẤT", "Đề nghị các bộ phận triển khai sản xuất mặt hàng sau:", "CÔNG TY BASEAFOOD 1", "QTI-KH-01-04".

| Nhóm | Khóa | Nhãn trên mẫu | Kiểu | Ánh xạ từ lệnh | Mặc định (LSX 19.10) |
|---|---|---|---|---|---|
| Đầu lệnh | `orderNo` ★ | Số | chữ | `orderNo` | — |
| | `orderDate` ★ | Ngày … Tháng … Năm | ngày | `orderDate` | — |
| | `recipients` | Kính gởi | chữ | — | BQĐ PHÂN XƯỞNG, PHÒNG KỸ THUẬT, PHÒNG KẾ HOẠCH |
| Bảng hàng ★ | `lines[].productName` (1) | Tên hàng | chữ | tên mặt hàng dòng lệnh | — |
| | `lines[].spec` | Quy cách | chữ nhiều dòng | `spec` + `note` dòng lệnh (R7) | — |
| | `lines[].cartons` | Số lượng thùng | số | `lineCartons` | — |
| | `lines[].kg` | Số lượng (kg) | số | `orderLineKg` | — |
| | `lotCode` | Mã số lô | chữ | `lotCode` | — |
| | `productionDates` | Ngày SX | chữ | `productionDates` (R7) | — |
| Giao hàng | `packagingReady` | Dự kiến có bao bì | chọn: ĐÃ CÓ SẴN · CHƯA CÓ | `requirements.packagingReady` | — |
| | `deliveryDate` ★ | Ngày giao hàng | ngày | `deliveryDate` | — |
| | `market` ★ (2) | Xuất vào thị trường | chữ | `market` + (`customerName`) | — |
| | `shelfLife` (3) | Ngày hết hạn | chữ | `shelfLifeMonths` (R7) | — |
| | `process` (4) | Quy trình sản xuất | chữ | `requirements.processNote` | Theo quy trình SX của Phòng Kỹ thuật. |
| Thùng carton | `cartonLayers` | Số lớp | chữ | `requirements.cartonLayers` | 5 lớp |
| | `cartonPrintColors` (5) | In | chọn: mấy màu · 1 · 2 · 3 | — | 1 |
| | `cartonColor` (6) | Màu | chữ | — | — |
| Đai dây | `strapKind` (7) | Đai dây | chọn: Bình thường · Chỉ Dùng băng keo | — | Bình thường |
| | `strapNote` (8) | (ghi chú đai) | chữ | `requirements.strapNote` | Mỗi NSX đai màu dây khác nhau. |
| Bao PE | `peBagKind` (9) | Bao PE | chọn: Trắng không in · In sẵn · Có rider | — | Trắng không in |
| | `peSealing` (10) | Yêu cầu hàn miệng | chọn: Không · Có | — | Không |
| | `peNote` (11) | (ghi chú PE) | chữ | `requirements.peBagNote` | — |
| Ghi trên thùng carton | `cartonLot` (12) · `cartonLotNote` (13) | Mã số lô | chọn Có · Không · chữ | — | Có |
| | `cartonMfg` (14) · `cartonMfgFormat` (15) · `cartonMfgNote` (16) | Ngày SX · Cách ghi | chọn · chọn: dd/mm/yyyy · yyyy/mm/dd · Không cần ghi · chữ | — | Có · yyyy/mm/dd |
| | `cartonExp` (17) · `cartonExpFormat` (18) · `cartonExpNote` (19) | Ngày hết hạn · Cách ghi | chọn · chọn: dd/mm/yyyy · yyyy/mm/dd · Không cần ghi · MM/YYYY · YYYY/MM · chữ | — | Có · yyyy/mm/dd |
| | `cartonOther` (20) | Yêu cầu khác | chữ | `requirements.cartonMarking` | Không |
| Ghi trên bao PE / rider | `bagLot` (21) · `bagLotNote` (22) | Mã số lô | chọn Có · Không · chữ | — | Không |
| | `bagMfg` (23) · `bagMfgFormat` (24) · `bagMfgNote` (25) | Ngày SX · Cách ghi | như carton | — | Không · Không cần ghi |
| | `bagExp` (26) · `bagExpFormat` (27) · `bagExpNote` (28) | Ngày hết hạn · Cách ghi | như carton | — | Không · Không cần ghi |
| | `bagOther` (29) | Yêu cầu khác | chữ | `requirements.bagMarking` | Không |
| Kiểm Nafi | `nafiMicro` (30) · `nafiMicroNote` (31) | Vi sinh theo quy định | đánh dấu · chữ | `nafiTests` có "Vi sinh" | không đánh dấu |
| | `nafiAntibiotic` (32) · `nafiAntibioticNote` (33) | Kháng sinh | chọn Có · Không · chữ | `nafiTests` có "Kháng sinh" | Không |
| | `nafiHeavyMetal` (34) · `nafiHeavyMetalNote` (35) | Kim loại nặng | chọn · chữ | `nafiTests` có "Kim loại nặng" | Không |
| | `nafiHistamine` (36) · `nafiHistamineNote` (37) | Histamine | chọn · chữ | `nafiTests` có "Histamine" | Không |
| | `nafiOther` (38) · `nafiExtraTests` (39) | Khác · Kiểm thêm chỉ tiêu | chọn · chữ | có "Khác" · `requirements.nafiNote` | Không |
| | `microResult` (40) · `microResultNote` (41) | Lấy kết quả vi sinh | chọn · chữ | — | Không |
| Cuối lệnh | `notes` (42) | Các lưu ý khác | chữ nhiều dòng | `note` của lệnh | — |

★ = bắt buộc (R5). Ô Nafi có ánh xạ từ `nafiTests`: lệnh có chỉ tiêu ⇒ "Có", không có ⇒ "Không". Lệnh nào cũng có `nafiTests`, nên các ô này luôn có nguồn "Từ lệnh".

### 9b. Kiểm kê nội dung hướng dẫn (QT 18)

| Mục người đọc gặp | Nội dung phải có | Nguồn |
|---|---|---|
| Trạng thái bản soạn | Nháp · Đã xuất · Sửa sau lần xuất: nghĩa, khi nào đổi | R10 |
| Cờ | Lệnh đã sửa sau khi soạn (việc tiếp: Lấy lại số từ lệnh) · Lệnh đã hủy (chỉ xem) · Khác lệnh (file khác lệnh, lệnh không đổi) | R3, R10, R11 |
| Nguồn ô | Từ lệnh · Từ file LSX <số> · Mặc định mẫu · Sửa tay · Trống | R2, R3 |
| Điều kiện xuất | Đủ 6 ô bắt buộc; thiếu thì app kê ô thiếu | R5 |
| PDF | Mở hộp in, chọn "Lưu thành PDF"; khổ A4 dọc | R8, Q8 |
| Khuôn (quản trị) | Thẻ bắt buộc, cảnh báo thẻ thiếu / thẻ lạ, khuôn đang dùng, lần xuất cũ giữ khuôn cũ | R13, R14 |

## 10. Acceptance Criteria — ORACLE

Dữ liệu chuẩn cho các AC = lệnh **19.10** dựng lại trong test: ngày 27/10/2026, 1 dòng "Bạch tuộc 1 da cắt hạt lựu", 1.000 thùng × 12 kg, MSL 205, NSX 02, 03, 04/11/2026, giao 15/11/2026, thị trường Nhật, khách Matsuda Sangyo, HSD 24 tháng.

### AC-1 — Điền sẵn từ lệnh · Maps to flow: DC1 · R2, R7 · Test: unit
- **Given** lệnh 19.10, chưa có bản soạn nào trên app
- **When** U1 tạo bản soạn LSX từ lệnh
- **Then** các ô có ánh xạ nhận giá trị lệnh, ghi theo R7, nguồn "Từ lệnh"
- **Assert** `documentComposer.test.ts` "AC-1": orderNo == "19.10" · orderDate hiển thị == "Ngày 27 Tháng 10 Năm 2026" · lines.length == 1 · lines[0].cartons == 1000 · lines[0].kg == 12000 · lotCode == "205" · productionDates == "NSX: 02, 03, 04/11/2026" · deliveryDate hiển thị == "15/11/2026" · market == "Nhật (Matsuda Sangyo)" · shelfLife == "2 năm"; 8 ô đó (cả bảng hàng) đều nguồn == "source", nhãn == "Từ lệnh"

### AC-2 — Ô không ánh xạ lấy mặc định khi chưa có lần trước · Maps to flow: DC1 · R2 · Test: unit
- **Given** lệnh 19.10, khách Matsuda chưa có bản đã xuất nào
- **When** tạo bản soạn
- **Then** ô không ánh xạ lấy mặc định §9a
- **Assert** cartonPrintColors == "1" · cartonMfgFormat == "yyyy/mm/dd" · bagMfgFormat == "Không cần ghi" · peSealing == "Không" · strapKind == "Bình thường"; 5 ô đó nguồn == "default"

### AC-3 — Chép từ lần trước cùng khách + mặt hàng · Maps to flow: DC1 · R2 · Test: unit
- **Given** lệnh 18.10 (cùng Matsuda, cùng mặt hàng) có bản soạn **đã xuất 1 lần** với peSealing "Có", cartonColor "Xanh"; lệnh 17.10 (khách khác) có bản đã xuất với peSealing "Có"; lệnh 16.10 (cùng khách, cùng mặt hàng) có bản soạn **chưa xuất** với peSealing "Có"
- **When** tạo bản soạn cho lệnh 19.10
- **Then** chỉ lần xuất của 18.10 được dùng
- **Assert** peSealing == "Có" · cartonColor == "Xanh" · nguồn == "previous" kèm nhãn chứa "18.10"; đổi 18.10 sang chưa xuất ⇒ peSealing == "Không" (nguồn "default"); orderNo vẫn == "19.10" (ô có ánh xạ không chép từ lần trước)

### AC-4 — Sửa trên file không ghi ngược lệnh · Maps to flow: DC1, DC2 · R3, R4 · Test: integration
- **Given** bản soạn của lệnh 19.10
- **When** U1 sửa lines[0].kg 12.000 → 11.500, lưu, rồi xuất Word
- **Then** ô mang cờ "Khác lệnh", lệnh không đổi
- **Assert** hàm thuần (`documentComposer.test.ts` "AC-4"): nguồn ô bảng hàng == "manual" · `fieldDiffs` == [{ key: "lines", row: 0, column: "kg", sourceValue: 12000 }] · nhãn cờ == "Khác lệnh". Đếm bảng (P4): dòng lệnh trong `production_order_lines` kg == 12000 · số dòng các bảng ngoài 3 bảng bộ soạn trước == sau (đếm như 48 AC-6) · `composed_document_exports` tăng đúng 1

### AC-5 — Tổng theo dòng trên file · Maps to flow: DC1 · R6 · Test: unit
- **Given** lệnh 2 dòng 600 thùng × 12 kg và 400 thùng × 12 kg
- **When** tạo bản soạn, rồi sửa dòng 2 còn 300 thùng, 3.600 kg
- **Then** dòng Tổng cộng theo số trên file
- **Assert** trước sửa: tổng thùng == 1000, tổng kg == 12000; sau sửa: tổng thùng == 900, tổng kg == 10800; STT == [1, 2]

### AC-6 — Thiếu ô bắt buộc thì không xuất · Maps to flow: DC2 · R5 · Test: unit
- **Given** bản soạn có market == "" và deliveryDate == ""
- **When** U1 xuất Word
- **Then** không ra file, kê đủ ô thiếu một lượt
- **Assert** `validateComposed` trả missing == ["deliveryDate", "market"] (đủ 2, theo thứ tự trên mẫu) · số lần xuất == 0 · lưu nháp vẫn thành công (bản soạn lưu được với 2 ô trống)

### AC-7 — File Word đúng khuôn gốc · Maps to flow: DC2 · R7, R8 · Test: integration
- **Given** bản soạn AC-1 và khuôn gốc đi kèm app
- **When** sinh file Word
- **Then** file có đủ chữ của mẫu, không sót thẻ, khổ A4
- **Assert** khuôn gốc đọc ra đủ thẻ của loại văn bản (`checkTemplateTags` ok, 0 thiếu, 0 lạ) · chữ trong `word/document.xml` chứa "QTI-KH-01-04", "19.10", "1.000", "12.000", "205", "NSX: 02, 03, 04/11/2026", "15/11/2026", "Nhật (Matsuda Sangyo)" · số chuỗi `{` còn sót == 0 · `w:pgSz` w == 11906, h == 16838 (A4 dọc) · tên file == "LSX-19.10-Matsuda-Sangyo-20261027.docx"

### AC-8 — Xem trước khớp file, PDF 1 trang A4 · Maps to flow: DC2 · R8 · Test: manual
- **Given** bản soạn AC-1
- **When** mở xem trước, rồi in, chọn "Lưu thành PDF"
- **Then** bản xem trước và PDF có cùng chữ với file Word
- **Assert** chữ bản xem trước chứa đủ 8 chuỗi của AC-7 · PDF đúng 1 trang A4 dọc · mở file `.docx` bằng Word (Phòng KH thử trên máy công ty) thấy bảng 7 cột, dòng Tổng 1.000 / 12.000

### AC-9 — Lịch sử xuất và trạng thái · Maps to flow: DC2 · R9, R10 · Test: unit
- **Given** bản soạn mới (Nháp)
- **When** xuất Word, rồi xuất PDF, rồi sửa ô notes
- **Then** 2 lần xuất, trạng thái đổi theo R10
- **Assert** trước xuất: status == "draft" · sau 2 lần: exports.length == 2, formats == ["docx", "pdf"], mỗi lần có templateId và snapshot (snapshot.orderNo == "19.10"), status == "exported" · sau sửa notes: status == "edited-after-export"

### AC-10 — Lệnh sửa sau khi soạn · Maps to flow: DC1 · R10 · Test: unit
- **Given** bản soạn ghi lần sửa lệnh == 0; U1 đã sửa tay cartonColor == "Đỏ"; sau đó lệnh sửa lần 1, đổi ngày giao 15/11 → 20/11/2026
- **When** mở bản soạn, rồi chọn Lấy lại số từ lệnh
- **Then** có cờ trước khi lấy lại; sau khi lấy lại, ô từ lệnh nhận số mới, ô sửa tay giữ nguyên
- **Assert** trước: staleSource == true · sau: deliveryDate hiển thị == "20/11/2026", cartonColor == "Đỏ" (nguồn "manual"), staleSource == false, lần sửa lệnh ghi == 1

### AC-11 — Quyền theo vai · Maps to flow: DC1, DC3, DC4 · R15 · Test: integration
- **Given** chuỗi migration 0001 → 0091 trên PGlite, 2 lệnh (1 nháp, 1 đã phát hành), mỗi lệnh 1 bản soạn đã xuất
- **When** đọc / ghi 3 bảng bộ soạn theo từng vai
- **Then** đúng R15
- **Assert** planner: đọc 2 bản, ghi được · quản đốc, thủ kho: đọc 1 bản (lệnh đã phát hành), insert / update == bị chặn · tổ trưởng: 0 dòng · ghi `document_templates`: admin được, planner == bị chặn · chạy lại 0091 lần 2 không lỗi

### AC-12 — Kiểm thẻ khi tải khuôn · Maps to flow: DC4 · R13 · Test: unit
- **Given** khuôn A thiếu thẻ `{deliveryDate}`; khuôn B đủ thẻ bắt buộc, thiếu `{cartonColor}`, thừa `{foo}`
- **When** quản trị tải từng khuôn
- **Then** A bị từ chối, B được nhận kèm cảnh báo
- **Assert** A: ok == false, missingRequired == ["deliveryDate"] · B: ok == true, missingOptional == ["cartonColor"], unknownTags == ["foo"] · số khuôn đang dùng của loại văn bản == 1

### AC-13 — Tải lại đúng khuôn và giá trị lúc xuất · Maps to flow: DC3 · R14 · Test: unit
- **Given** lần xuất #1 dùng khuôn v1 với orderNo "19.10"; sau đó quản trị đặt khuôn v2 làm đang dùng, U1 sửa notes
- **When** U2 tải lại lần xuất #1, rồi U1 xuất mới
- **Then** tải lại dùng v1 + ảnh chụp #1; lần xuất mới dùng v2
- **Assert** file tải lại: templateId == v1, notes == giá trị lúc #1 · lần xuất mới: templateId == v2 · tải lại không thêm lần xuất (exports.length vẫn == 2)

### AC-14 — Lệnh hủy · Maps to flow: DC1 · R11 · Test: unit
- **Given** lệnh trạng thái đã hủy, có bản soạn đã xuất 1 lần
- **When** U1 thử tạo bản soạn mới, sửa, hoặc xuất mới
- **Then** cả ba bị chặn, tải lại vẫn được
- **Assert** `canCompose` == { ok: false, reason: "cancelled" } · `canEditComposed` == false · tải lại lần xuất #1 thành công · exports.length vẫn == 1

### AC-15 — Thêm loại văn bản không sửa bộ soạn · Maps to flow: DC5 · R1 · Test: unit
- **Given** loại văn bản giả trong test: 3 ô (1 chữ bắt buộc, 1 ngày, 1 bảng dòng 2 dòng) + khuôn nhỏ
- **When** chạy điền sẵn, kiểm ô thiếu, sinh file
- **Then** chạy được bằng đúng hàm chung của bộ soạn
- **Assert** file sinh ra chứa đủ 3 giá trị và 2 dòng · validate thiếu ô chữ ⇒ missing == [khóa ô đó] · loại văn bản giả chỉ gọi hàm của `documentComposer` + `docxTemplate`, không gọi gì của `documentTypes/productionOrderForm`

### AC-16 — Chế độ demo không đụng số thật · Maps to flow: DC1, DC2 · QT 15 · Test: integration
- **Given** bật demo (sandbox `baseafood-demo`)
- **When** soạn và xuất 1 file LSX từ lệnh demo
- **Then** chỉ dữ liệu demo đổi
- **Assert** khóa `bsf.*` dưới máy cùng độ dài + mã băm trước == sau · 3 bảng bộ soạn có trong `DemoBundle` (test `demoMode` canh) · tắt demo ⇒ 0 bản soạn demo hiện

### AC-17 — Hướng dẫn nói đủ trạng thái và nguồn ô · Maps to flow: DC1, DC2 · §9b · Test: unit
- **Given** hằng số nhãn trạng thái (3), cờ (3), nguồn ô (5) trong code
- **When** chạy test phủ hướng dẫn
- **Then** hộp "?" và tour của bộ soạn nhắc đủ các nhãn đó
- **Assert** số nhãn thiếu trong nội dung hướng dẫn == 0 · `pageTourCoverage.test.ts` xanh

### AC-18 — Chưa tải khuôn thì dùng khuôn gốc · Maps to flow: DC2 · R13 · Test: unit
- **Given** `document_templates` không có dòng nào cho loại văn bản LSX
- **When** sinh file
- **Then** dùng khuôn gốc đi kèm app
- **Assert** `activeTemplate` trả id == "builtin:production-order-form" · lần xuất ghi templateId == "builtin:production-order-form"

## 11. Đã chốt + giả định

**Chủ dự án chốt 2026-10-31, cả 10 câu theo đề xuất** (trang chọn "Chốt file Lệnh sản xuất"):

| Q | Câu | Đã chốt |
|---|---|---|
| Q1 | Nguồn đọc | **A. Lệnh sản xuất đã lập trên app** (kiểm lại ở §0: lệnh lập từ HĐ **xuất** khẩu) |
| Q2 | Số ô | **A. Đủ 42 ô như mẫu giấy** (§9a) |
| Q3 | Ô không có trong nguồn | **A. Chép từ file đã xuất lần trước cùng khách + mặt hàng**, chưa có thì mặc định mẫu (R2) |
| Q4 | Sửa trên file | **A. Chỉ sửa trên file**, đánh dấu "Khác lệnh" (R3, R4) |
| Q5 | Lưu | **A. Lưu trên máy chủ, gắn lệnh nguồn**, có lịch sử xuất (R9, R16) |
| Q6 | Khuôn Word | **A. Dựng lại khuôn `.docx` theo LSX 19.10**, Phòng KH xem bản đầu rồi góp ý |
| Q7 | Đổi mẫu về sau | **A. Quản trị tải khuôn Word mới lên app** (DC4, R13) |
| Q8 | PDF | **A. Qua hộp in của trình duyệt** (R8) |
| Q9 | Ai soạn | **A. Người có quyền ghi Lệnh sản xuất** (R15) |
| Q10 | Gắn vào chuyến | **A. Không gắn đợt này** |

**Giả định (fail-closed):**
- A1. File Word ra là chữ thường, không giữ ô form của mẫu `.doc`. Sửa tiếp trong Word thì gõ chữ.
- A2. Bản in gọn của lệnh (48 AC-15) giữ nguyên. File LSX là bản chính thức gửi xưởng.
- A3. Bản soạn đọc được ở cả lệnh nháp lẫn lệnh đã phát hành. Nơi nhận chỉ thấy bản của lệnh đã phát hành (R15).
- A4. "Cùng mặt hàng" so với dòng 1 của lệnh, đúng luật `previousOrderFor` của 48.
- A5. NL nhập khẩu dự kiến không in lên file (mẫu không có chỗ). Phòng KH cần thì ghi vào "Các lưu ý khác".
- A6. Thư viện: `docxtemplater` 3.71.1 + `pizzip` 3.3.0 (điền khuôn, đã thêm ở P1). `docx-preview` (vẽ xem trước) thêm ở P3. Màn bộ soạn nạp động các thư viện này, không làm nặng lần mở app. Không dùng `InspectModule` của docxtemplater (đòi `lodash`). Thẻ khuôn đọc bằng `readTemplateTags`.
- A7. Khuôn gốc **dựng bằng code** (`documentTypes/productionOrderTemplate.ts`), không có file nhị phân trong repo. Quản trị tải khuôn gốc về, sửa trong Word, tải lên lại (DC4). Các khối nhãn (giao hàng, bao bì, Nafi) là **một bảng không viền 2 cột**, không dùng điểm dừng tab, để cột nhãn thẳng hàng ở mọi trình mở (Quick Look, bản xem trước trên web, Word).

## 12. Kế hoạch build

| Pha | Việc | Tier | AC / cổng | Doc |
|---|---|---|---|---|
| P0 Khuôn gốc ✅ 2026-10-31 | Dựng khuôn gốc (`buildProductionOrderTemplate`) theo LSX 19.10: A4 dọc, Times New Roman, bảng 7 cột + dòng Tổng, các khối như mẫu, thẻ theo §9a. Gửi Phòng KH bản điền số 19.10 để duyệt hình | 🟢 | AC-7 (chữ + A4) · Phòng KH duyệt | 54 |
| P1 Luật ✅ 2026-10-31 | `lib/documentComposer.ts` (điền sẵn R2, nguồn ô R3, kiểm R5, tổng R6, trạng thái R10, lấy lại từ lệnh, chọn lần trước) · `lib/documentTypes/productionOrderForm.ts` (§9a + ánh xạ R7) · `lib/docxTemplate.ts` (điền khuôn, đọc thẻ R13). Thêm `docxtemplater` + `pizzip` vào `package.json` | 🟡 (thư viện mới) | `documentComposer.test.ts` = AC-1…3, 5, 6, 9, 10, 12…15, 18 · AC-7 | 54, `ops/deploy-vercel` |
| P2 Dữ liệu ✅ 2026-11-02 | Migration **0091** (rà số trên origin trước khi đặt): 3 bảng + bucket `document-templates` + RLS R15 + ROLLBACK. Kiểu ở `types.ts`, `TableMapping` (+ `refColumns`), hook `catalogRepo`, `DemoBundle` + `DemoPackLoader` | 🟡 | PGlite AC-11 (chạy 2 lần) · AC-16 | 03, 04, 05, `spec/che-do-demo` §5 |
| P3 Màn ✅ 2026-11-02 (không viết design-spec 55 riêng — bố cục ghi ở 49) | `features/document-composer/` (bộ soạn dùng chung: ô theo nhóm + nguồn ô + xem trước + xuất + lịch sử) · lối vào ở hồ sơ lệnh · khu quản trị khuôn · nháp `useDialogDraft` (QT 17) · tour + hộp "?" (QT 18) | 🟢 | AC-4, 8, 17 · 360 px × 130 % · gõ dở → sang trang → quay lại còn nguyên | 55, 49, 43, 02 |
| P4 Kiểm cuối 🟡 2026-11-02 (sandbox xong; còn mở Word thật + DB thật) | Trên preview demo: AC-4 (đếm bảng trước / sau), AC-8 (xem trước + PDF), AC-16. Phòng KH mở file `.docx` bằng Word trên máy công ty | — | AC-4, 8, 16 | 54 `last_verified`, BAN-GIAO-tiep-theo |

**Ước lượng:** P0 + P1 một phiên · P2 một phiên · P3 + P4 một phiên. Mỗi phiên đọc 54 (+ 55 cho P3). Không cần đọc lại file `.doc` mẫu: mọi ô và giá trị đã chép ở §9a.

## History
- 2026-11-02 — P2 + P3 build: mig `0091_composed_documents.sql` (3 bảng + RLS theo cột `resource` + bucket, không đụng ma trận) · `TableMapping` + hook + `DemoBundle` (bản soạn demo của lệnh đã phát hành) · `lib/documentTemplateStorage.ts` · `lib/documentTypes/index.ts` (sổ đăng ký khuôn gốc) · `design-system/patterns/DocxPreview.tsx` (`docx-preview` 0.4.1 nạp động; in `@page docx`) · `features/document-composer/` (trang soạn dùng chung + khối Khuôn Word quản trị) · `production-orders/OrderFileComposer.tsx` + nút "File Word / PDF" ở hồ sơ lệnh (`&file=1`) · nháp `useFormDraft` theo lệnh · tour bước `file` + mục hộp "?" (AC-17). Cột DB `field_values` (tránh từ khóa `values`).
- 2026-10-31 — P0 + P1 build: `lib/documentComposer.ts` (luật chung), `lib/docxTemplate.ts` (dựng / điền / đọc thẻ / lấy chữ), `lib/documentTypes/productionOrderForm.ts` (42 ô + ánh xạ), `lib/documentTypes/productionOrderTemplate.ts` (khuôn gốc). R2 làm rõ: chỉ ô `carryOver` chép từ lần trước. Gom `formatProductionDates` vào `lib/productionOrder.ts` (bản in của 48 dùng chung). Kiểu `ComposedDocument` · `ComposedDocumentExport` · `DocumentTemplate` thêm vào `types.ts` trước cho P2.
- 2026-10-31 — v1 đặc tả. Q1–Q10 chốt theo đề xuất. Kiểm lại nguồn: lệnh lập từ HĐ xuất khẩu, NL nhập khẩu chỉ gắn làm NL dự kiến (§0).
