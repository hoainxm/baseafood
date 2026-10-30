# 50 — ba-spec: Phòng Kế hoạch · tab Báo cáo của Nhập khẩu và Lệnh sản xuất

> Load khi: xây hoặc sửa tab Báo cáo ở `/planning-import` hoặc `/planning-production`: chọn kỳ, lọc đối tác / khách, số tổng, bảng theo tháng / đối tác / khách / mặt hàng, NL nhập khẩu đã dành, mục cần chú ý, xuất Excel.
covers: src/lib/importReports.ts, src/lib/productionOrderReports.ts, src/features/import-planning/ImportReportView.tsx, src/features/production-orders/OrderReportView.tsx, src/features/shared/ReportPeriodBar.tsx
last_verified: 2026-10-30
ttl_days: 90
status: v0 (2026-10-30) — bản đầu để chủ dự án xem và góp ý ("sẽ chỉnh sửa thêm theo feedback sau"). Chỉ ĐỌC dữ liệu có sẵn, không bảng / cột mới.

> **Mục đích:** oracle HÀNH VI cho hai tab Báo cáo. **Khuôn:** tab Báo cáo của Xuất khẩu (41 NV15 · R25, design-spec 42 v5): kỳ tháng / quý / năm, lọc một đối tượng, thẻ số, bảng theo tháng, bảng theo đối tượng, mục cần chú ý, xuất Excel. **Nguồn trường:** ba-spec [45](45-import-planning.ba-spec.md) (Nhập khẩu) và [48](48-production-order.ba-spec.md) (Lệnh sản xuất).

## 1. Vấn đề & JTBD

- **Nhập khẩu:** cuối tháng / quý, Phòng Kế hoạch và Kế toán cần biết đã nhập bao nhiêu kg, trị giá bao nhiêu, từ NCC nào, mặt hàng nào, lô nào còn thiếu chứng từ. Hiện phải mở từng hợp đồng.
- **Lệnh sản xuất:** Phòng Kế hoạch, quản đốc, BGĐ cần biết tháng này đã ra lệnh bao nhiêu kg, cho khách nào, mặt hàng nào, NL nhập khẩu đã dành bao nhiêu, lệnh nào đang kẹt.

## 2. User registry

| ID | User | Quyền | Thấy gì |
|---|---|---|---|
| U1 | Phòng Kế hoạch (`planner`, Trưởng / Phó) | `import-plans` · `production-orders` ghi | đủ, cả giá |
| U2 | BGĐ, Kế toán | xem + `view-price` (Nhập khẩu) | đủ, cả giá |
| U3 | Quản đốc, Thủ kho | `production-orders` xem | Báo cáo Lệnh sản xuất (chỉ lệnh đã phát hành) |
| U4 | Thủ kho (chỉ `import-plans.receiving`) | — | Không có tab Báo cáo Nhập khẩu (phần thủ kho giữ nguyên) |

## 3. Nghiệp vụ

| NV | Nghiệp vụ | Owner |
|---|---|---|
| RP1 | Xem số Nhập khẩu theo kỳ, lọc đối tác, xuất Excel | U1 (U2 xem) |
| RP2 | Xem số Lệnh sản xuất theo kỳ, lọc khách, xuất Excel | U1 (U2, U3 xem) |

Không có handoff giữa người dùng (chỉ đọc).

## 4. Flow

### RP1 — Báo cáo Nhập khẩu · owner U1
- **Input:** kỳ (tháng / quý / năm, mặc định tháng hiện tại), đối tác (mọi đối tác hoặc một NCC).
- **Output:**
  - Thẻ số: Lần nhập (số cont · hàng lẻ) · Thực nhập kg (so với kg HĐ của các lần nhập đó) · Trị giá nhập (theo tiền tệ, chỉ người có `view-price`; không có thì thẻ "HĐ ký trong kỳ") · Đủ hồ sơ (n / tổng, thiếu chứng từ x, chờ thực nhập y).
  - Bảng Theo tháng (kỳ > 1 tháng): lần nhập, cont, kg thực nhập, trị giá.
  - Bảng Theo đối tác: lần nhập, kg thực nhập, trị giá, kg HĐ còn chưa về (HĐ đang mở, không theo kỳ).
  - Bảng Theo mặt hàng: kg thực nhập, trị giá, đơn giá bình quân (= trị giá ÷ kg, theo tiền tệ).
  - Bảng Theo loại hình: sản xuất xuất khẩu · kinh doanh · gia công — lần nhập, kg.
  - Lần nhập cần chú ý: lần nhập của kỳ còn **Thiếu chứng từ** (ghi tên chứng từ thiếu) hoặc **Chờ thực nhập** mà ngày về kho ≤ hôm nay.
  - Xuất Excel đủ các khối trên (không cột giá khi không có `view-price`).

### RP2 — Báo cáo Lệnh sản xuất · owner U1
- **Input:** kỳ, khách (mọi khách hoặc một khách).
- **Output:**
  - Thẻ số: Lệnh trong kỳ (đã phát hành · nháp) · Kg ra lệnh (thùng) · NL nhập khẩu đã dành (kg) · Cần chú ý (n).
  - Bảng Theo tháng (kỳ > 1 tháng): lệnh, thùng, kg.
  - Bảng Theo khách: lệnh, HĐ, thùng, kg.
  - Bảng Theo mặt hàng: lệnh, thùng, kg.
  - Bảng NL nhập khẩu đã dành: lần nhập (nhãn), kg dành cho lệnh của kỳ, kg thực nhập, vượt.
  - Lệnh cần chú ý: **Nháp quá ngày SX** (nháp, ngày SX đầu ≤ hôm nay) · **Theo bản HĐ trước** · **Chưa gắn chuyến** (đã phát hành).
  - Lệnh đã hủy: chỉ đếm (dòng phụ của thẻ), không cộng vào kg / thùng / NL dành.
  - Xuất Excel đủ các khối trên.

## 6. Flow optimization log

| Quyết định | Biến thể | Chọn | Lý do | Ai chấm |
|---|---|---|---|---|
| Đặt báo cáo ở đâu | A. tab trên từng trang · B. trang Báo cáo chung của Kế hoạch | **A** | Người dùng yêu cầu tab; cùng khuôn Xuất khẩu (đã có tab) | Optimizer |
| Tháng của lần nhập | A. ngày về kho, chưa về thì ngày dự kiến (45 R1) · B. ngày ký HĐ | **A** | Khớp tab Lô nhập; báo cáo và danh sách cùng một con số | Domain |
| Tháng của lệnh | A. ngày SX đầu (`orderMonth`) · B. ngày lệnh | **A** | Khớp danh sách lệnh (49) | Domain |
| Trị giá nhiều tiền tệ | A. cộng gộp · B. tách theo tiền tệ | **B** | Cộng USD với EUR là số sai | Domain (kế toán) |
| Lệnh đã hủy | A. cộng · B. chỉ đếm | **B** | Lệnh hủy không sản xuất (48 R11) | Domain |

## 7. Scope

- **IN:** RP1, RP2, xuất Excel.
- **OUT (chờ feedback):** in A4 · biểu đồ · so kỳ trước · định mức NL→TP từ kiểm mẫu · báo cáo cho thủ kho · lọc theo mặt hàng.

## 8. Success metric

| NV | Metric | Đích |
|---|---|---|
| RP1 | Trả lời "tháng này nhập bao nhiêu kg, từ NCC nào" | ≤ 30 giây, 0 lần mở hồ sơ HĐ |
| RP2 | Trả lời "tháng này đã ra lệnh bao nhiêu kg cho khách X" | ≤ 30 giây |

## 9. Rules

| ID | Luật |
|---|---|
| R1 | Lần nhập đã hủy không tính vào bất kỳ số nào (45 AC-13). Kg thực nhập = Σ `import_receipt_lines.kg` của lần nhập trong kỳ. |
| R2 | Trị giá = Σ (kg thực nhập × đơn giá dòng HĐ); dòng không có giá (gia công) không cộng trị giá. Tách theo `currency` của HĐ. Chỉ hiện khi `view-price`. |
| R3 | Kg HĐ còn chưa về = Σ max(0, còn lại) của các dòng HĐ **đang mở** của đối tác (45 R5) — không phụ thuộc kỳ. |
| R4 | Lệnh: chỉ lệnh người xem được (`visibleOrders` — nơi nhận chỉ lệnh đã phát hành). Kg / thùng / NL dành chỉ tính lệnh chưa hủy. |
| R5 | NL dành theo lần nhập = Σ kg `production_order_materials` của lệnh chưa hủy trong kỳ; vượt = dành tổng (mọi kỳ) > thực nhập (48 R5). |
| R6 | Báo cáo không ghi gì; xuất Excel không toast (QT 13). |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Kỳ và lần nhập hủy · Maps to flow: RP1 · Test: unit
- **Given** 3 lần nhập: về 10/10 (2 dòng 6.000 + 4.000 kg), dự kiến 20/10 chưa về (0 kg), về 05/11; 1 lần nhập tháng 10 đã hủy (5.000 kg)
- **When** báo cáo tháng 10/2026
- **Then** 2 lần nhập, 10.000 kg; lần hủy không tính
- **Assert** `totals.receipts == 2`; `totals.receivedKg == 10000`; báo cáo quý 4 ⇒ `totals.receipts == 3`

### AC-2 — Trị giá tách tiền tệ, dòng không giá · Maps to flow: RP1 · Test: unit
- **Given** HĐ USD dòng 6.000 kg giá 2,5; HĐ EUR dòng 4.900 kg giá 3; HĐ gia công dòng 4.000 kg không giá
- **When** báo cáo kỳ chứa cả ba
- **Then** USD 15.000, EUR 14.700, gia công không cộng
- **Assert** `totals.value == { USD: 15000, EUR: 14700 }`

### AC-3 — Lọc đối tác và kg còn chưa về · Maps to flow: RP1 · Test: unit
- **Given** NCC A có HĐ mở 20.000 kg đã về 10.000; NCC B có HĐ đã đóng thiếu 100 kg
- **When** lọc NCC A
- **Then** chỉ số của A; còn chưa về của A = 10.000; B (HĐ đóng) = 0
- **Assert** `bySupplier.length == 1`; `bySupplier[0].shortKg == 10000`; không lọc ⇒ dòng B `shortKg == 0`

### AC-4 — Lần nhập cần chú ý · Maps to flow: RP1 · Test: unit
- **Given** lần nhập về 10/10 thiếu tờ khai; lần nhập về 12/10 đủ chứng từ chưa thực nhập; lần nhập dự kiến 30/10 (hôm nay 25/10) chưa thực nhập
- **When** báo cáo tháng 10
- **Then** 2 dòng cần chú ý; lần chưa tới ngày về không vào
- **Assert** `attention.length == 2`; kinds == ["missing-docs","awaiting-quantity"]

### AC-5 — Lệnh: hủy chỉ đếm, theo tháng SX · Maps to flow: RP2 · Test: unit
- **Given** lệnh A phát hành 1.000 thùng × 12 kg (NSX 02/11), lệnh B nháp 500 thùng (NSX 09/11), lệnh C đã hủy 300 thùng (NSX 03/11), lệnh D NSX 28/10
- **When** báo cáo tháng 11
- **Then** 2 lệnh, 1.500 thùng, 18.000 kg, 1 lệnh hủy
- **Assert** `totals.orders == 2`; `totals.issued == 1`; `totals.cartons == 1500`; `totals.kg == 18000`; `totals.cancelled == 1`

### AC-6 — NL đã dành theo lần nhập · Maps to flow: RP2 · Test: unit
- **Given** lệnh A (kỳ) dành 3.000 kg lần nhập R (thực nhập 6.000); lệnh E ngoài kỳ dành 4.000 kg cùng R; lệnh hủy dành 1.000 kg
- **When** báo cáo kỳ của A
- **Then** dòng R: dành trong kỳ 3.000, tổng dành 7.000, vượt 1.000
- **Assert** `materials[0] == { reservedKg: 3000, reservedAllKg: 7000, receivedKg: 6000, overKg: 1000 }` (trường liên quan)

### AC-7 — Lệnh cần chú ý · Maps to flow: RP2 · Test: unit
- **Given** (hôm nay 05/11) lệnh nháp NSX 02/11; lệnh phát hành chưa gắn chuyến; lệnh phát hành theo bản HĐ cũ; lệnh nháp NSX 20/11
- **When** báo cáo tháng 11
- **Then** 3 dòng cần chú ý
- **Assert** kinds đã sắp == ["draft-overdue","stale-revision","unlinked"]

### AC-8 — Ẩn giá · Maps to flow: RP1 · Test: unit
- **Given** người xem không có `view-price`
- **When** dựng bảng Excel báo cáo Nhập khẩu
- **Then** không cột / số trị giá nào
- **Assert** số ô chứa chữ "Trị giá" hoặc "Đơn giá" == 0

## 11. Assumptions

- A1. Tab Báo cáo Nhập khẩu chỉ cho người có `import-plans:view` (phần thủ kho không đổi).
- A2. Kỳ mặc định = tháng hiện tại (khác Xuất khẩu mặc định năm) vì hai trang đang làm việc theo tháng.
- A3. Chưa in A4, chưa biểu đồ — làm theo feedback.

## History
- v0 2026-10-30 — bản đầu, chờ feedback chủ dự án.
