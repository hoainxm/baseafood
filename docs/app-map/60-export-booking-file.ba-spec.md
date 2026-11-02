# 60 — ba-spec: File booking của chuyến xuất khẩu — đính ở ô Số booking, xem ở khối Đóng cont

> Load khi: sửa đính / xem file booking (xác nhận booking của hãng tàu) của chuyến xuất khẩu — hộp Ghi / Sửa chuyến, khối Đóng cont trong hồ sơ HĐ.
covers: src/lib/exportPlanning.ts, src/features/export-planning
last_verified: 2026-11-02
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — mig `0094` (nới `export_files_step_check` + view `export_file_steps` để app dò; ✅ đã chạy DB thật 2026-11-02), `bookingFilesOf` (test AC-1…AC-3), ô "Đính file booking" trong hộp Ghi / Sửa chuyến, hàng "File booking" (không trạng thái) ở bước 4 của `ShipmentPanel` (đính thêm qua `LoadingUploadDialog` step "booking", vùng kho "shipment"), nhật ký HĐ, demo 1 file giữ chỗ / chuyến đã đóng. Tour (bước "Thông tin và trạng thái chuyến") + hộp "?" kể File booking (AC-6). Thử sandbox 2026-11-02: hàng File booking hiện đúng, 360px không tràn; đính thật chờ chạy 0094 (AC-4, AC-5 kiểm tay). Bổ sung [41](41-export-planning.ba-spec.md) NV7 (ghi chuyến) + bước 4 Đóng cont. Cần migration 🟡 nới ràng buộc `export_files.step` thêm `booking` (không đổi RLS).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-02, nguyên văn: "số booking ở mục ghi chuyến cho phép đính kèm file, đưa vào giao diện chỗ đóng cont để hiển thị xem luôn".
- **Hiện nay:** chuyến chỉ có ô chữ Số booking. Bản xác nhận booking của hãng tàu (tàu, chuyến, ngày cắt máng, số cont…) nằm ngoài app; lúc đóng cont phải lục mail.
- **Job:** Khi ghi chuyến, Nhân viên Kế hoạch muốn đính luôn file booking; khi chuẩn bị / theo dõi đóng cont, người xem Xuất khẩu mở được file booking ngay tại khối Đóng cont.
- **Đo thành công:** chuyến có file booking ⇒ mở được từ khối Đóng cont trong ≤ 1 lần bấm.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` ghi | ghi chuyến, nhận booking từ hãng tàu |
| U2 | BGĐ, Kế toán, người có `export-plans` xem | xem | theo dõi |
| U4 | Người đóng hàng (chỉ `export-plans.loading`) | 4a / 4b | **KHÔNG** thấy file booking (chủ dự án chọn — R10 của 41 giữ nguyên) |
| S1 | Hệ thống: bảng `export_files` + kho file `export-files` (mig 0075) | — | — |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Đính file booking khi Ghi / Sửa chuyến (cạnh ô Số booking) | U1 | — | 41 NV7 | Must |
| NV2 | Xem file booking ở khối Đóng cont; bản mới nhất đứng đầu | U1 | U2 | NV1 | Must |
| NV3 | Đính thêm / gỡ file booking ngay ở khối Đóng cont | U1 | — | NV1 | Must |
| NV4 | Hướng dẫn + hộp "?" kể file booking (QT 18) | S1 | mọi user | NV1–NV3 | Must |

## 4. Cross-user handoff map

N/A — không cross (U4 không thấy file booking theo chủ dự án).

## 5. Flows

### Flow NV1 — Đính khi ghi chuyến · owner U1
- **Input:** chuyến đang ghi / sửa; 0..n file (PDF / ảnh / Word / Excel như file chứng từ hiện có, ≤ 20 MB, ảnh nén như cũ).
- **Steps:** chọn file ở ô Số booking → lưu chuyến ⇒ file lưu `export_files` với `step = booking`, gắn chuyến (`shipment_id`), người + giờ đính.
- **Output:** chuyến có file booking; nhật ký HĐ ghi "Đính file booking …". Không có file vẫn lưu được (R3).

### Flow NV2 — Xem ở khối Đóng cont · owner U1
- **Output:** khối Đóng cont của chuyến có mục "File booking": danh sách file, mới nhất đầu (R2), mỗi file xem ngay trong app (PDF / ảnh) hoặc tải về như file chứng từ hiện có; chuyến chưa có ⇒ "Chưa có file booking".

### Flow NV3 — Đính thêm / gỡ ở khối Đóng cont · owner U1
- **Output:** đính thêm như NV1; gỡ qua xác nhận + Hoàn tác (QT 6), nhật ký ghi.

### Flow NV4 — Nội dung
- **Output:** tour (bước Ghi chuyến + bước Đóng cont) + hộp "?" nói: đính file booking ở ô Số booking hoặc ở khối Đóng cont, không bắt buộc, không làm bước nào tự xong, bản mới nhất ở đầu.

## 6. Flow optimization log

| Flow | Candidate | Chọn | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| NV1 | A: loại file mới `booking` (mig nới ràng buộc) · B: dùng lại 4a "Sơ đồ container" + chú thích (không mig) | **A** | B làm 4a tự xong nhầm (4a xong khi có file — 41 R10 / bảng bước) | Domain (XK) VETO B |
| NV2 | ai xem: cả người đóng hàng (đổi RLS 🔴) · chỉ người xem Xuất khẩu | **chỉ người xem XK** (chủ dự án) | không đổi RLS; `booking` không nằm trong danh sách bước của `export-plans.loading` ⇒ RLS sẵn có tự chặn | Chủ dự án + Domain (bảo mật) |
| NV1 | một file thay file cũ · nhiều file, mới nhất đầu | **nhiều file** (chủ dự án) | hãng tàu gửi booking sửa đổi (đổi tàu / ngày) — cần giữ lịch sử | Chủ dự án |
| NV2 | bắt buộc với chuyến cont · không bắt buộc | **không bắt buộc** (chủ dự án) | chỉ để xem; tiến độ 6 bước giữ nguyên | Chủ dự án |
| NV3 | đính chỉ ở hộp ghi chuyến · cả hai chỗ | **cả hai** (chủ dự án) | booking sửa đổi về sau khi đã ghi chuyến | Chủ dự án |

## 7. Scope & Priority

- **IN:** NV1–NV4.
- **OUT:** đọc tự động số booking / tàu từ file; bắt buộc file booking; cho người đóng hàng xem; hiện file booking ở Lịch xuất hàng (57).

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV2 | lần bấm từ hồ sơ HĐ tới file booking | ≤ 1 (khối Đóng cont đang mở) |
| NV1 | file booking làm bước nào đổi trạng thái | = 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | File booking = dòng `export_files` có `step = "booking"`, `shipment_id` = chuyến, `step_item_id` rỗng. | — |
| R2 | Nhiều file / chuyến; xếp mới nhất trước (theo giờ đính). | 2 file cùng giờ ⇒ theo tên |
| R3 | Không bắt buộc: không đổi trạng thái bước 1–6, không vào `isShipmentClosed`, không vào "Còn thiếu". | — |
| R4 | Quyền: xem = `export-plans` xem; đính / gỡ = `export-plans` tạo / sửa (RLS 0075 sẵn có). `export-plans.loading` không thấy (bước `booking` ngoài danh sách 4a / 4b của RLS) — KHÔNG đổi RLS. | người đóng hàng mở hồ sơ ⇒ không có mục File booking |
| R5 | Chuyến "dùng chung" (cont ghép cùng booking — 41 R5) KHÔNG tự dùng chung file booking; mỗi chuyến tự đính. | — |
| R6 | Migration chỉ nới `export_files_step_check` thêm `booking`, chạy lại an toàn, có đường lùi (thu lại khi chưa có dòng `booking`). Máy chủ chưa chạy migration ⇒ app ẩn chỗ đính file booking (không gửi dòng bị ràng buộc từ chối ⇒ không kẹt hàng chờ); cách dò do build chốt (Assumption c). | DB chưa nới ⇒ chỉ ô chữ Số booking như cũ |
| R7 | Bộ demo: thêm 1 file booking giữ chỗ cho một chuyến demo (QT 15 — bảng có sẵn trong DemoBundle). | — |

## 9b. Kiểm kê nội dung (NV4)

| Khu vực | Mục | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Hộp Ghi chuyến | ô file booking | đính được nhiều file, không bắt buộc | R2, R3 |
| Khối Đóng cont | File booking | bản mới nhất đầu; xem / tải; đính thêm / gỡ; không làm bước tự xong | R2, R3, NV3 |
| Quyền | ai thấy | người đóng hàng không thấy file booking | R4 |

## 10. Acceptance Criteria

### AC-1 — File booking không đổi tiến độ · NV1 · Test: unit
- **Given** chuyến chưa có file 4a; đính 1 file `step = booking`
- **When** tính trạng thái bước 4a và chuyến
- **Then** 4a vẫn chưa xong; số mục còn thiếu không đổi
- **Assert** `subStepState("loading-plan") != "done"` · `isShipmentClosed == false` · `stepMissing` trước == sau

### AC-2 — Lấy file booking của chuyến, mới nhất đầu · NV2 · Test: unit
- **Given** 3 file: 2 booking của chuyến S (giờ 08:00, 10:00), 1 booking chuyến khác
- **When** lấy file booking của S
- **Then** 2 file, 10:00 trước
- **Assert** `bookingFilesOf(d, "S").map(f=>f.createdAt)` deep-equals `["…10:00…","…08:00…"]`

### AC-3 — Chuyến dùng chung không mượn file · NV2 · Test: unit
- **Given** chuyến S1 có file booking, S2 cùng booking dùng chung với S1
- **When** lấy file booking của S2
- **Then** rỗng
- **Assert** `bookingFilesOf(d, "S2").length == 0`

### AC-4 — Ghi chuyến kèm file · NV1 · Test: e2e (manual khi chưa có máy chủ thử: cần kho file)
- **Given** hộp Ghi chuyến, chọn 1 PDF ở ô Số booking
- **When** lưu
- **Then** có 1 dòng `export_files` `step = booking` của chuyến; khối Đóng cont hiện file đó
- **Assert** số file booking của chuyến `== 1`

### AC-5 — Người đóng hàng không thấy · NV2 · Test: manual (RLS máy chủ)
- **Given** tài khoản chỉ có `export-plans.loading`
- **When** mở chuyến
- **Then** không có mục / file booking
- **Assert** số dòng `export_files` `step = booking` đọc được `== 0`

### AC-6 — Lời hướng dẫn · NV4 · Test: unit
- **Given** tour Xuất khẩu + hộp "?"
- **When** đọc lời
- **Then** có "File booking" ở bước Ghi chuyến và Đóng cont
- **Assert** số chỗ thiếu `== 0`

## 11. Assumptions / Open

- **Assumptions:** (a) loại file như file chứng từ hiện có (`EXPORT_FILE_ACCEPT`); (b) migration số **0094** (rà origin trước khi đặt); (c) cách app biết máy chủ đã nới ràng buộc do build chốt (mặc định: ẩn ô đính tới khi chạy migration — đọc cờ cấu hình hoặc thử ghi có xử lý lỗi `23514` không kẹt hàng chờ).
- **Open (RED):** không có (RLS giữ nguyên theo chủ dự án).

## History

- v1 (2026-11-02): khởi tạo — chủ dự án chốt: chỉ người xem Xuất khẩu thấy · nhiều file, mới nhất đầu · không bắt buộc · đính ở cả hộp ghi chuyến lẫn khối Đóng cont.
