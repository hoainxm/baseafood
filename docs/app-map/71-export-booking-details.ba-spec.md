# 71 — ba-spec: Thông tin booking + Thông tin xe vận chuyển của chuyến xuất khẩu

> Load khi: sửa khối Booking (12 trường, đọc từ file booking của hãng tàu) hoặc khối Thông tin xe vận chuyển ở bước 4 Đóng cont của chuyến xuất; sửa ô Đại lý ở hộp Ghi / Sửa chuyến; sửa bộ đọc file booking (`lib/bookingReader.ts`).
covers: src/lib/bookingReader.ts, src/lib/exportBooking.ts, src/features/export-planning/BookingDialogs.tsx, src/features/export-planning/ShipmentPanel.tsx, src/features/export-planning/ShipmentDialogs.tsx, supabase/migrations/0101_export_booking_details.sql
last_verified: 2026-11-03
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-03 — mig `0101` (thêm 17 cột vào `export_shipments` + nới `export_options_list_kind_check` thêm 4 danh sách; ⏳ CHƯA chạy DB thật). Bộ đọc `bookingReader.ts` (test AC-1…AC-5), luật `exportBooking.ts` (AC-6…AC-8), ánh xạ `repo.ts` (AC-9). Thay [60](60-export-booking-file.ba-spec.md) NV2 "hàng File booking" bằng khối Booking (file vẫn giữ, xem ở trong khối). Kiểm 2026-11-03: PGlite chạy 0101 hai lần không lỗi, check `list_kind` vẫn chặn loại lạ; preview demo: đọc file ONE thật ra đủ 10 trường + đại lý (CAI MEP ⇒ "Cái Mép", TOKYO ⇒ "Tokyo, Japan"), lưu đúng; Thông tin xe báo đúng ô thiếu, thêm mục danh sách tại chỗ; 360px × 130% không tràn. AC-10 (RLS người đóng hàng) chờ kiểm tay sau khi chạy 0101.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** chị Phạm Thảo (Phòng Kế hoạch) 2026-11-03, nguyên văn: "Chỗ file booking em chỉnh giúp chị thành các trường thông tin" — 12 trường (số booking, đại lý lấy từ bước trước; 10 trường cập nhật theo file booking), "Sau cái booking em thêm giúp chị cụm thông tin: Thông tin xe vận chuyển … 1,3,4,5 bắt buộc, 2 tùy chọn nha". File mẫu: booking ONE `SGNGCM332800` (Tokyo, 20RF, ETD 05/11).
- **Hiện nay (ba-spec 60):** hàng "File booking" chỉ có danh sách file. Muốn biết tàu, cảng, hạn cắt máng, bãi hạ phải mở PDF; thông tin xe kéo cont ghi ngoài app.
- **Job:** Nhận booking, Nhân viên Kế hoạch đính file ⇒ app đọc ra các trường, chị soát rồi lưu. Khi thuê xe, ghi công ty vận chuyển + nơi lấy rỗng / đóng / hạ bãi để xưởng và người đóng hàng biết xe nào tới.
- **Đo thành công:** file booking ONE đọc ra đủ 10 trường không phải gõ tay; hạn Doc / VGM / hạ bãi xem được ngay ở bước 4 không mở file.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` tạo / sửa | nhận booking, thuê xe |
| U2 | BGĐ, Kế toán, người có `export-plans` xem | xem | theo dõi |
| U4 | Người đóng hàng (chỉ `export-plans.loading`) | xem chuyến | gặp xe ở xưởng — **xem được** khối Booking + Thông tin xe, không sửa; vẫn KHÔNG thấy file booking (60 R4) |
| S1 | Hệ thống: cột mới của `export_shipments`, danh sách chọn `export_options` | — | — |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Ghi Đại lý (forwarder) cùng Số booking khi Ghi / Sửa chuyến | U1 | — | 41 NV7 | Must |
| NV2 | Cập nhật booking: đính file ⇒ app đọc 10 trường ⇒ soát, sửa ⇒ lưu | U1 | — | NV1 | Must |
| NV3 | Xem 12 trường booking ở bước 4 Đóng cont | U1 | U2, U4 | NV2 | Must |
| NV4 | Ghi Thông tin xe vận chuyển (4 ô bắt buộc, cụm tài xế tùy chọn) | U1 | U4 xem | NV2 (gợi ý chỗ) | Must |
| NV5 | Hướng dẫn + hộp "?" kể hai khối (QT 18) | S1 | mọi user | NV1–NV4 | Must |

## 4. Cross-user handoff map

| Từ | Tới | Cái gì | Điều kiện | Nhận ở |
|---|---|---|---|---|
| U1 | U4 | thông tin booking + xe (bãi lấy rỗng, nơi đóng, bãi hạ, tài xế, biển số) | U1 lưu | bước 4 của chuyến (chỉ xem) |

Không có bước chờ duyệt: U4 chỉ đọc, không có việc phải làm.

## 5. Flows

### Flow NV1 — Đại lý ở Ghi chuyến · owner U1
- **Input:** hộp Ghi / Sửa chuyến.
- **Steps:** chọn Đại lý từ danh sách `forwarder` (thêm mới / sửa nhanh ngay tại ô — QT 7) ⇒ lưu chuyến.
- **Output:** `booking.forwarder` của chuyến; hiện ở khối Booking. Trống vẫn lưu được.

### Flow NV2 — Cập nhật booking · owner U1
- **Input:** chuyến chưa hủy; file booking mới (PDF có chữ) **hoặc** file booking đã đính.
- **Steps:** mở Cập nhật booking ⇒ chọn file ⇒ app đọc (R3) ⇒ 10 ô điền sẵn, ô đọc được đánh dấu "từ file" ⇒ soát / sửa tay ⇒ Lưu.
- **Output:** 10 trường lưu vào chuyến (Tàu / chuyến, Cảng đến, Loại cont ghi đè trường sẵn có của chuyến); file mới đính thêm `step = booking` (60 R1, R2); nhật ký HĐ "Cập nhật booking …". PDF bản scan / Word / ảnh ⇒ báo "không đọc được chữ", vẫn gõ tay và lưu được.

### Flow NV3 — Xem · owner U1
- **Output:** khối Booking ở bước 4 hiện 12 trường theo thứ tự chủ dự án (R1); ô chưa có ⇒ "—"; dưới là danh sách file booking (người có quyền xem file). Hạn đã qua ⇒ đánh dấu "đã qua hạn" (R8).

### Flow NV4 — Thông tin xe · owner U1
- **Input:** chuyến chưa hủy.
- **Steps:** mở Ghi thông tin xe ⇒ ô điền sẵn (R6) ⇒ nhập ⇒ Lưu.
- **Output:** 8 trường xe lưu vào chuyến; thiếu ô bắt buộc ⇒ không lưu, báo đúng ô thiếu (R5). Không đổi tiến độ (R7).

### Flow NV5 — Nội dung
- **Output:** tour (bước Đóng cont) + hộp "?" nói: Booking đọc từ file, soát trước khi lưu, số booking / đại lý sửa ở Ghi chuyến; Thông tin xe 4 ô bắt buộc, tài xế tùy chọn; hai khối không làm bước nào tự xong.

## 6. Flow optimization log

| Flow | Candidate | Chọn | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| NV1 | Đại lý = forwarder · hãng tàu · cả hai | **forwarder, ghi ở Ghi chuyến** (chủ dự án) | "link từ bước trước" = ô cạnh Số booking | Chủ dự án |
| NV2 | đọc xong tự lưu · đọc xong cho soát rồi lưu | **soát rồi lưu** | mỗi hãng tàu một mẫu; đọc sai mà tự ghi thì sai lặng lẽ | Domain (XK) VETO tự lưu |
| NV2 | ô file trống ⇒ xóa giá trị cũ · giữ giá trị cũ | **giữ** (R4) | booking sửa đổi đôi khi bỏ trống dòng đã có | Optimizer |
| NV2 | Số booking trong file khác chuyến ⇒ tự đổi · chỉ cảnh báo | **cảnh báo** (R4) | số booking là khóa nối chuyến dùng chung (41 R5) — đổi ở Ghi chuyến | Domain |
| NV2 | Loại cont = trường riêng · dùng `kind` của chuyến | **`kind`** | một nguồn; chuyến = 1 cont (41 Q2) | Optimizer |
| NV2 | "Thời hạn hạ bãi" = Port Cargo Cut-off · Full Return Date | **Port Cargo Cut-off** (chủ dự án) | file mẫu Full Return Date trống | Chủ dự án |
| NV4 | thiếu thông tin xe ⇒ bước 4 chưa xong · chỉ bắt khi lưu | **chỉ bắt khi lưu** (chủ dự án) | tiến độ 6 bước giữ nguyên | Chủ dự án |
| NV3/NV4 | người đóng hàng xem · ẩn (đổi RLS 🔴) | **xem, không sửa** (chủ dự án) | gặp xe ở xưởng; RLS `export_shipments` sẵn cho `export-plans.loading` đọc | Chủ dự án |
| NV4 | ô địa điểm gõ tay · danh sách chọn | **danh sách chọn** (QT 7) | bãi / công ty lặp lại; tên thống nhất | Optimizer |

## 7. Scope & Priority

- **IN:** NV1–NV5.
- **OUT:** đọc bản scan (ảnh); đọc ETD / ETA từ booking (giữ ô ETD / ETA của Ghi chuyến); nhắc hạn cut-off qua chuông / Việc của tôi; nhiều xe cho một chuyến; in lệnh điều xe.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV2 | trường đọc đúng trên file ONE mẫu | 10 / 10 |
| NV3 | lần bấm từ hồ sơ HĐ tới hạn Doc cut-off | 0 (khối Đóng cont đang mở) |
| NV4 | hai khối làm bước nào đổi trạng thái | = 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Khối Booking, đúng thứ tự: (1) Số booking, (2) Đại lý — từ Ghi chuyến, chỉ xem ở khối; (3) Tàu / chuyến, (4) Nơi nhận hàng, (5) Cảng đi, (6) Cảng đến, (7) Nơi giao hàng, (8) Loại cont, (9) Nơi hạ bãi, (10) Doc cut-off, (11) VGM cut-off, (12) Thời hạn hạ bãi — từ file booking, sửa được. | — |
| R2 | Lưu: Tàu / chuyến = `vesselVoyage`, Cảng đến = `portOfDischarge`, Loại cont = `kind` (sẵn có của chuyến); 8 trường còn lại cột mới. Hạn (10–12) lưu ngày + giờ địa phương `yyyy-mm-ddThh:mm`. | chỉ có ngày ⇒ giờ 00:00 |
| R3 | Bộ đọc nhận nhãn tiếng Anh của booking hãng tàu: Booking No · Forwarder · Trunk Vessel (hoặc Vessel / Voyage) · Place of Receipt · Port of Loading · Port of Discharging · Place of Delivery · Equipment Type · Full Return CY · Empty Pick Up CY · Doc Cut-off · VGM Cut-off · Port Cargo Cut-off (hoặc CY Cut-off). Ngày "03Nov26 10:00", "03/11/2026 10:00", "2026-11-03 10:00". Loại cont: 20 + reefer ⇒ 20RF; 40 + HC / HQ + reefer ⇒ 40HC-RF; 40 + reefer ⇒ 40RF; khác (DRY…) ⇒ không đoán. Tên cảng / bãi khớp danh sách chọn không phân hoa thường, không dấu (CAI MEP ⇒ "Cái Mép"); không khớp ⇒ giữ chữ của file. | nhãn lặp (Address, TEL, Terminal) ⇒ lấy lần đầu, bỏ qua |
| R4 | Áp kết quả đọc: ô file có giá trị ⇒ thay giá trị đang có; ô file trống ⇒ giữ. Số booking không bao giờ bị đổi; file khác số đã ghi ⇒ cảnh báo. Đại lý: chuyến chưa có ⇒ lấy từ file; đã có và khác ⇒ cảnh báo, giữ. | chuyến chưa có số booking ⇒ cảnh báo "ghi số ở Ghi chuyến" |
| R5 | Thông tin xe — bắt buộc: Tên công ty vận chuyển, Địa điểm lấy container rỗng, Địa điểm đóng container, Địa điểm hạ bãi. Tùy chọn: Tên tài xế, Số điện thoại, Số CCCD, Biển số xe. Thiếu ô bắt buộc ⇒ không lưu, liệt kê ô thiếu. | toàn bộ để trống ⇒ cũng báo thiếu (không lưu bản rỗng) |
| R6 | Mở Ghi thông tin xe lần đầu: Địa điểm lấy container rỗng ← Empty Pick Up CY đọc được lần cập nhật booking gần nhất; Địa điểm hạ bãi ← Nơi hạ bãi của booking. Chỉ điền ô đang trống. | — |
| R7 | Hai khối KHÔNG đổi trạng thái bước 1–6, không vào `isShipmentClosed`, không vào "Còn thiếu" (như 60 R3). | — |
| R8 | Hạn (10–12) trước giờ hiện tại và chuyến chưa có ngày đóng cont ⇒ "đã qua hạn". | chuyến hủy ⇒ không đánh dấu |
| R9 | Quyền: sửa = `export-plans` tạo / sửa; xem = ai đọc được chuyến (gồm `export-plans.loading`). KHÔNG đổi RLS. File booking vẫn theo 60 R4. | — |
| R10 | Migration chỉ thêm cột (mặc định rỗng / null) + nới `export_options_list_kind_check` thêm `forwarder` · `haulier` · `container-yard` · `stuffing-place`; chạy lại an toàn; có đường lùi. Máy chủ chưa chạy ⇒ ẩn Đại lý, hai khối, giữ hàng File booking như 60 (không gửi cột lạ ⇒ không kẹt hàng chờ). | — |
| R11 | Danh sách chọn: Đại lý = `forwarder`; Công ty vận chuyển = `haulier`; Nơi hạ bãi, Địa điểm lấy rỗng, Địa điểm hạ bãi = `container-yard`; Địa điểm đóng container = `stuffing-place`; Nơi nhận hàng + Cảng đi = `loading-port`; Cảng đến + Nơi giao hàng = `discharge-port`. Lưu CHỮ (62 Q5). | — |
| R12 | Bộ demo: một chuyến demo đã đóng có đủ booking + xe (QT 15, bảng sẵn trong DemoBundle). | — |

## 9b. Kiểm kê nội dung (NV5)

| Khu vực | Mục | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Hộp Ghi chuyến | Đại lý | chọn forwarder; trống vẫn lưu | NV1 |
| Khối Booking | 12 trường | số booking + đại lý sửa ở Ghi chuyến; 10 trường đọc từ file, soát trước khi lưu; ô file trống giữ giá trị cũ; "đã qua hạn" nghĩa là gì; không làm bước tự xong | R1, R4, R7, R8 |
| Khối Thông tin xe | 8 ô | 4 ô bắt buộc, cụm tài xế tùy chọn; điền sẵn bãi lấy rỗng / hạ bãi từ booking; người đóng hàng xem được | R5, R6, R9 |

## 10. Acceptance Criteria

### AC-1 — Đọc booking ONE mẫu · NV2 · Test: unit
- **Given** các dòng chữ của file `SGNGCM332800` (trang 1)
- **When** `parseBookingRows`
- **Then** đủ 10 trường + số booking + forwarder + bãi lấy rỗng
- **Assert** `bookingNo == "SGNGCM332800"` · `forwarder == "DA PHUONG SHIPPING SERVICES"` · `vesselVoyage == "BANGKOK BRIDGE 0518E(JTI)"` · `placeOfReceipt == "CAI MEP"` · `portOfLoading == "CAI MEP"` · `portOfDischarge == "TOKYO, TOKYO"` · `placeOfDelivery == "TOKYO, TOKYO"` · `kind == "20RF"` · `returnYard == "TCTT (TAN CANG CAIMEP THI VAI)"` · `docCutoff == "2026-11-03T10:00"` · `vgmCutoff == "2026-11-03T19:00"` · `cargoCutoff == "2026-11-04T19:00"` · `emptyPickupYard == "ICD TAY NAM"`

### AC-2 — Ngày giờ · NV2 · Test: unit
- **Given** "03Nov26 10:00" · "03/11/2026 10:00" · "2026-11-03" · "~"
- **When** `parseBookingDateTime`
- **Then** `"2026-11-03T10:00"` · `"2026-11-03T10:00"` · `"2026-11-03T00:00"` · `""`
- **Assert** `parseBookingDateTime("03Nov26 10:00") == "2026-11-03T10:00"` · `parseBookingDateTime("~") == ""`

### AC-3 — Loại cont · NV2 · Test: unit
- **Given** "20'REEFER-1" · "40'REEFER HC-1" · "40'HC REEFER" · "40'REEFER" · "20'DRY-1"
- **When** `bookingContainerKind`
- **Then** `"20RF"` · `"40HC-RF"` · `"40HC-RF"` · `"40RF"` · `""`
- **Assert** `bookingContainerKind("20'REEFER-1") == "20RF"` · `bookingContainerKind("20'DRY-1") == ""`

### AC-4 — File không phải booking · NV2 · Test: unit
- **Given** dòng chữ không có nhãn nào của R3
- **When** đọc
- **Then** không trường nào
- **Assert** số trường đọc được `== 0`

### AC-5 — Khớp danh sách chọn · NV2 · Test: unit
- **Given** danh sách `loading-port` có "Cái Mép"; chữ file "CAI MEP"
- **When** `matchOptionLoose`
- **Then** `"Cái Mép"`; chữ "VUNG TAU" không có trong danh sách ⇒ `"VUNG TAU"`
- **Assert** `matchOptionLoose("CAI MEP", rows, "loading-port") == "Cái Mép"` · `matchOptionLoose("VUNG TAU", …) == "VUNG TAU"`

### AC-6 — Áp kết quả đọc · NV2 · Test: unit
- **Given** chuyến số booking "A1", đại lý "X", cảng đến "Tokyo, Japan", nơi hạ bãi "B"; kết quả đọc số "A2", đại lý "Y", cảng đến "", nơi hạ bãi "C"
- **When** `applyBookingRead`
- **Then** số booking giữ "A1", đại lý giữ "X", cảng đến giữ "Tokyo, Japan", nơi hạ bãi "C"; 2 cảnh báo
- **Assert** `warnings.length == 2`

### AC-7 — Thông tin xe bắt buộc · NV4 · Test: unit
- **Given** chỉ có tên tài xế
- **When** `transportMissing`
- **Then** 4 ô thiếu, đúng thứ tự R5; đủ 4 ô, tài xế trống ⇒ 0
- **Assert** `transportMissing(t).length == 4` · `== 0`

### AC-8 — Không đổi tiến độ · NV4 · Test: unit
- **Given** chuyến có đủ booking + thông tin xe, chưa có file 4a
- **When** tính trạng thái bước 4 và chuyến
- **Then** như khi không có hai khối
- **Assert** `stepState(…, 4)` trước == sau · `isShipmentClosed == false`

### AC-9 — Lưu / đọc máy chủ · NV2, NV4 · Test: unit
- **Given** chuyến có `booking` + `transport` đủ 17 trường; chuyến khác không có
- **When** `toRow` → `fromRow`
- **Then** 17 trường giữ nguyên; chuyến không có ⇒ không gửi cột mới
- **Assert** deep-equal · `"forwarder" in row == false`

### AC-10 — Người đóng hàng chỉ xem · NV3 · Test: manual (RLS máy chủ)
- **Given** tài khoản chỉ có `export-plans.loading`
- **When** mở chuyến
- **Then** thấy 12 trường + thông tin xe; không có nút cập nhật; không thấy file booking
- **Assert** số nút sửa của hai khối `== 0`

### AC-11 — Lời hướng dẫn · NV5 · Test: unit
- **Given** tour Xuất khẩu + hộp "?"
- **When** đọc lời
- **Then** có "Thông tin xe vận chuyển" và "Cập nhật booking"
- **Assert** số chỗ thiếu `== 0`

## 11. Assumptions / Open

- **Assumptions:** (a) migration số **0101** (origin tới 0100); (b) "Empty Pick Up CY" không phải trường của khối Booking nhưng lưu kèm để điền sẵn Thông tin xe (R6) — cột `empty_pickup_yard`; (c) hàng chờ dưới máy tạo trước khi chạy 0101 không có `booking` ⇒ lượt ghi đó không gửi cột mới (giữ nguyên giá trị máy chủ); (d) Nơi nhận hàng / Nơi giao hàng dùng chung danh sách với cảng (R11) — tách sau nếu cần.
- **Open (RED):** không có.

## History

- v1 (2026-11-03): khởi tạo — chủ dự án chốt: Đại lý = forwarder ở Ghi chuyến · Thời hạn hạ bãi = Port Cargo Cut-off · thiếu thông tin xe không chặn tiến độ · người đóng hàng xem được, không sửa.
