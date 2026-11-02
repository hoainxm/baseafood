# 57 — ba-spec: Lịch xuất hàng xếp theo ngày (thay "mỗi khách một bảng")

> Load khi: sửa tab **Lịch xuất hàng** của `/planning-export` — cách xếp chuyến trong kỳ, số khách / chuyến mỗi ngày, mở chi tiết một ngày, khối chuyến chưa có ngày.
covers: src/features/export-planning/MonthView.tsx, src/lib/exportDaySchedule.ts
last_verified: 2026-11-02
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — `lib/exportDaySchedule.ts` (`buildDaySchedule`, `defaultOpenDay`, 8 test AC-1…AC-7), `MonthView.tsx` danh sách ngày mở / thu; AC-8 thử tay trên sandbox (bấm ngày → Mở ⇒ URL có contract + shipment); tour + hộp "?" (AC-9). Sửa phần Output "chuyến gom theo khách" của Flow NV11 ở [41](41-export-planning.ba-spec.md); mọi luật khác của NV11 (kỳ xem, lọc khách, tra cứu, 4 thẻ số, Excel, HĐ chưa ghi đủ chuyến) giữ nguyên.

> **Mục đích:** oracle HÀNH VI cho cách xếp chuyến của tab Lịch xuất hàng. Không mô tả giao diện (việc của design-spec [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-02, nguyên văn: "Chỉnh sửa giao diện tab Lịch xuất hàng: mặc định đang là nhóm của từng khách hàng, chỉnh sửa lại theo thứ tự ngày của tháng hoặc tuần tuỳ theo bộ lọc, trong ngày có bao nhiêu khách, bấm vào thì mở chi tiết lịch xuất hàng đó".
- **Job:** Khi lên kế hoạch tuần / tháng, Phòng Kế hoạch muốn thấy **ngày nào đóng hàng cho bao nhiêu khách, bao nhiêu chuyến**, để dồn người, xe, cont và chứng từ theo ngày — thay vì lật từng bảng khách rồi tự cộng.
- **Vì sao bây giờ:** gom theo khách trả lời "khách X còn gì", không trả lời "ngày mai xuất gì". Câu thứ hai là câu hỏi hằng ngày của kế hoạch và kho.
- **Đo thành công:** đọc ra số khách + số chuyến của một ngày bất kỳ trong kỳ mà không phải cộng tay.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Phòng Kế hoạch (`planner`, Trưởng / Phó) | `export-plans` ghi | desktop, hằng ngày |
| U2 | BGĐ, Kế toán | `export-plans` xem | desktop |
| U3 | Quản đốc / thủ kho (xem chuyến để chuẩn bị đóng cont) | `export-plans` xem | điện thoại, iPad ở xưởng |
| S1 | Hệ thống — `buildPeriodPlan` (lib/exportPlanning.ts) | — | tính lại khi đổi kỳ / lọc khách |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Xem kỳ xếp theo ngày: mỗi ngày có chuyến = một mục, kèm số khách + số chuyến | U1 | U2, U3 (xem) | 41 NV11 (kỳ xem, lọc khách) | hằng ngày | Must |
| NV2 | Mở chi tiết một ngày: chuyến của ngày gom theo khách, có tiến độ, mở được hồ sơ HĐ | U1 | U2, U3 | NV1 | hằng ngày | Must |
| NV3 | Thấy chuyến chưa có ngày + HĐ chưa ghi đủ chuyến ở khối riêng | U1 | — | NV1 | hằng tuần | Must |
| NV4 | Hướng dẫn thao tác + hộp "?" kể đúng cách xếp mới (QT 18) | S1 | mọi user | NV1–NV3 | khi đổi | Must |

## 4. Cross-user handoff map

N/A — không cross. Tab chỉ đọc; xử lý chuyến vẫn ở hồ sơ HĐ như 41.

## 5. Flows

### Flow NV1 — Xếp theo ngày · owner U1
- **Start:** mở tab Lịch xuất hàng, kỳ Tháng / Tuần / Ngày (khoảng ngày) + lọc khách như 41 NV11.
- **Input:** chuyến của kỳ (`buildPeriodPlan`), mỗi chuyến có **ngày xuất = ngày đóng cont, chưa có thì ETD** (R1 của 41, `shipmentInPeriod`).
- **Steps:** gom chuyến có ngày xuất theo ngày → xếp ngày tăng dần → mỗi ngày đếm số khách (khác nhau) + số chuyến + số chuyến trễ hạn / còn thiếu bước.
- **Output:** danh sách các **ngày có chuyến** trong kỳ (ngày trống không hiện), mỗi mục: ngày + thứ, "n khách · m chuyến", tên các khách, dấu trễ hạn / còn thiếu nếu có.
- **End:** người xem biết ngày nào xuất gì.

### Flow NV2 — Chi tiết một ngày · owner U1
- **Start:** chọn một ngày trong danh sách.
- **Input:** chuyến của ngày đó.
- **Steps:** gom theo khách (tên khách tăng dần) → mỗi chuyến hiện đủ thông tin như bảng cũ (lô, loại, HĐ, hàng, kg kế hoạch · thực xuất, tiến độ 6 bước, bước tiếp, Trễ / Chờ booking).
- **Output:** chi tiết ngày; chọn một chuyến ⇒ mở hồ sơ HĐ đúng chuyến (như nút Mở hiện có). Chọn lại ngày ⇒ thu chi tiết.
- **End:** vào hồ sơ chuyến, hoặc thu lại.

### Flow NV3 — Chưa có ngày · owner U1
- **Input:** chuyến của kỳ KHÔNG có ngày đóng cont lẫn ETD (chỉ có tháng kế hoạch) + HĐ chưa ghi đủ chuyến (41 NV11 / NV12).
- **Output:** dưới danh sách ngày: khối **"Chuyến chưa có ngày"** (gom theo khách, đủ tiến độ, mở được hồ sơ) rồi khối **"Hợp đồng chưa ghi đủ chuyến"** (giữ nguyên như hiện nay).

### Flow NV4 — Nội dung hướng dẫn · owner S1
- **Output:** tour + hộp "?" của Xuất khẩu nói: xếp theo ngày xuất (đóng cont, chưa có thì ETD), con số mỗi ngày nghĩa là gì, bấm ngày để xem chi tiết, chuyến chưa có ngày nằm ở đâu.

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do | Đánh giá bởi | Conflict & xử |
|---|---|---|---|---|---|
| NV1 | A: lưới lịch 7 cột (mọi ngày, kể cả trống) · B: danh sách chỉ ngày có chuyến | **B** (chủ dự án chọn) | đọc thẳng từ trên xuống, không ô trống, điện thoại không phải đổi hình | Chủ dự án + Optimizer | Orchestrator đề xuất A, chủ dự án chọn B ⇒ B |
| NV1 | Mỗi ngày: chỉ số khách · số khách + số chuyến · tên khách | **số khách + số chuyến** (+ tên khách ở danh sách) | một ngày một khách nhiều cont ⇒ "1 khách" che mất khối lượng việc | Chủ dự án + Domain (XK) | — |
| NV1 | Ngày xếp theo: ngày đóng cont → ETD · ngày ký HĐ · hạn giao | **đóng cont → ETD** | trùng luật kỳ xem 41 R1 / v4; ngày ký và hạn giao không phải ngày xuất (41 log NV11 v4 đã VETO ngày ký) | Domain (XK) | — |
| NV2 | A: chi tiết ngày (gom theo khách) rồi mới mở hồ sơ · B: ngày 1 chuyến mở thẳng hồ sơ | **A** (chủ dự án chọn) | một cách duy nhất cho mọi ngày, không đoán | Chủ dự án | — |
| NV3 | A: khối riêng dưới danh sách · B: bỏ khỏi tab | **A** (chủ dự án chọn) | chuyến chưa có ngày vẫn là việc của kỳ; bỏ đi thì mất | Chủ dự án | — |

## 7. Scope & Priority

- **IN:** NV1–NV4; tầm xem Tháng / Tuần / Ngày (khoảng ngày) — cùng một cách xếp.
- **OUT:** lưới lịch; kéo thả đổi ngày; đổi Excel (Excel vẫn gom theo tuần như 41 Q10); đổi 4 thẻ số; đổi luật kỳ xem.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV1 | số chuyến cộng mọi ngày + khối chưa có ngày so với thẻ "Chuyến trong kỳ" | lệch = 0 |
| NV1 | số khách của một ngày so với đếm tay khách khác nhau của ngày đó | lệch = 0 |
| NV2 | bấm từ danh sách tới hồ sơ chuyến | ≤ 2 lần bấm |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Ngày của chuyến = ngày đóng cont, chưa có thì ETD (đúng `shipmentInPeriod`). Không có cả hai ⇒ thuộc "Chuyến chưa có ngày" của kỳ chứa tháng kế hoạch. | chuyến có ETD nhưng ngày đóng thuộc kỳ khác ⇒ theo ngày đóng |
| R2 | Chỉ hiện ngày có ≥ 1 chuyến; xếp ngày tăng dần. | kỳ không có chuyến nào ⇒ trạng thái rỗng như cũ |
| R3 | Số khách của ngày = số khách KHÁC NHAU có chuyến ngày đó; số chuyến = số chuyến (không hủy) ngày đó. | 1 khách 3 chuyến ⇒ "1 khách · 3 chuyến" |
| R4 | Lọc khách áp lên danh sách ngày: chỉ còn ngày có chuyến của khách đó; số khách khi lọc = 1. | — |
| R5 | Tổng số chuyến (mọi ngày + chưa có ngày) = thẻ "Chuyến trong tháng / tuần / khoảng". | — |
| R6 | Trong chi tiết ngày: gom theo khách (tên tăng dần), trong khách xếp theo số lô; mỗi chuyến giữ đủ trạng thái, cảnh báo Trễ / Chờ booking như bảng cũ. | — |
| R7 | Dấu trên mục ngày: có chuyến trễ hạn giao (41 `isShipmentLate`) ⇒ "n trễ"; có chuyến chưa đủ hồ sơ ⇒ "n còn thiếu". | — |
| R8 | Tra cứu (ô tra mọi kỳ) giữ nguyên bảng kết quả riêng, không theo ngày. | — |
| R9 | Mặc định: ngày đầu tiên ≥ hôm nay trong kỳ mở sẵn chi tiết; kỳ đã qua ⇒ không ngày nào mở sẵn. | kỳ tương lai ⇒ ngày đầu tiên của kỳ có chuyến mở sẵn |

## 9b. Kiểm kê nội dung (NV4)

| Khu vực | Mục người đọc gặp | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Danh sách ngày | cách xếp | theo ngày xuất = ngày đóng cont, chưa có thì ETD; chỉ ngày có chuyến | R1, R2 |
| Mục ngày | con số | "n khách · m chuyến"; dấu "n trễ" · "n còn thiếu" | R3, R7 |
| Chi tiết ngày | cách mở | chọn ngày để xem chuyến gom theo khách, chọn lại để thu; Mở ⇒ hồ sơ HĐ | NV2 |
| Chuyến chưa có ngày | vì sao ở đây | chuyến mới có tháng kế hoạch, chưa có ngày đóng / ETD; ghi ngày thì tự vào danh sách | R1 |

## 10. Acceptance Criteria

### AC-1 — Xếp theo ngày xuất · NV1 · Test: unit
- **Given** kỳ tháng 11/2026 có chuyến A đóng 05/11, chuyến B chỉ có ETD 03/11, chuyến C chỉ có tháng kế hoạch 2026-11
- **When** dựng lịch theo ngày
- **Then** có 2 ngày theo thứ tự 03/11, 05/11 và C nằm ở nhóm chưa có ngày
- **Assert** `days.map(d=>d.date)` deep-equals `["2026-11-03","2026-11-05"]` · `undated.length == 1`

### AC-2 — Đếm khách khác nhau · NV1 · Test: unit
- **Given** ngày 03/11 có 3 chuyến: 2 của Matsuda, 1 của Seachemot
- **When** dựng lịch
- **Then** mục 03/11 ghi 2 khách, 3 chuyến
- **Assert** `day.customerCount == 2` · `day.shipmentCount == 3`

### AC-3 — Tổng khớp thẻ số · NV1 · Test: unit
- **Given** kỳ có chuyến có ngày và chưa có ngày
- **When** dựng lịch
- **Then** tổng chuyến mọi ngày + chưa có ngày bằng số chuyến của kỳ
- **Assert** `sum(days.shipmentCount) + undated.length == plan.stats.shipments`

### AC-4 — Lọc khách · NV1 · Test: unit
- **Given** lọc khách Seachemot
- **When** dựng lịch
- **Then** chỉ còn ngày có chuyến Seachemot, mỗi ngày 1 khách
- **Assert** mọi `day.customerCount == 1`

### AC-5 — Dấu trễ / còn thiếu · NV1 · Test: unit
- **Given** ngày 05/11 có 1 chuyến trễ hạn và 2 chuyến chưa đủ hồ sơ
- **When** dựng lịch
- **Then** mục ngày ghi 1 trễ, 2 còn thiếu
- **Assert** `day.lateCount == 1` · `day.missingCount == 2`

### AC-6 — Chi tiết ngày gom theo khách · NV2 · Test: unit
- **Given** ngày 03/11 có chuyến của Seachemot và Matsuda
- **When** lấy chi tiết ngày
- **Then** nhóm theo khách, tên tăng dần
- **Assert** `day.customers.map(c=>c.customerName)` deep-equals `["Matsuda","Seachemot"]`

### AC-7 — Ngày mở sẵn · NV2 · Test: unit
- **Given** kỳ tháng 11, hôm nay 04/11, có ngày 03/11 và 05/11
- **When** chọn ngày mở sẵn
- **Then** 05/11 mở sẵn
- **Assert** `defaultOpenDay(days, "2026-11-04") == "2026-11-05"`; kỳ đã qua hết ⇒ `== null`

### AC-8 — Từ danh sách tới hồ sơ chuyến · NV2 · Test: e2e
- **Given** tab Lịch xuất hàng tháng 11 có chuyến ngày 03/11
- **When** chọn ngày 03/11 rồi Mở chuyến đầu
- **Then** hồ sơ HĐ mở đúng chuyến
- **Assert** URL chứa `contract=<id>` và `shipment=<id>` sau đúng 2 lần bấm

### AC-9 — Hướng dẫn nói đúng cách xếp · NV4 · Test: unit
- **Given** tour Xuất khẩu
- **When** đọc lời bước lịch
- **Then** có "ngày đóng cont", "ETD", "Chuyến chưa có ngày"
- **Assert** số cụm thiếu trong lời tour `== 0`

## 11. Assumptions / Open

- **Assumptions:** (a) mục ngày hiện thêm tên các khách (theo bản xem trước chủ dự án chọn); (b) R9 ngày mở sẵn; (c) chọn ngày khác thì ngày đang mở vẫn mở (mở nhiều ngày cùng lúc được); (d) điện thoại / iPad dùng cùng danh sách (không có lưới nên không phải đổi hình); (e) tô màu dòng giữ theo chuyến, khóa `export-plan:<kỳ>:<ngày>`.
- **Open (RED):** không có.

## History

- v1 (2026-11-02): khởi tạo — chủ dự án chốt: danh sách theo ngày · bấm ngày mở chi tiết gom theo khách · mỗi ngày số khách + số chuyến · chuyến chưa có ngày + HĐ chưa đủ chuyến ở khối riêng.
