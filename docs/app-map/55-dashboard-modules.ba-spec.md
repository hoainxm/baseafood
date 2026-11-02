# 55 — ba-spec: Tổng quan đọc thêm Phòng Kế hoạch (Nhập khẩu · Lệnh sản xuất · Xuất khẩu) và hóa đơn đại lý

> Load khi: sửa `/dashboard` để thêm / bớt khối của module mới, đổi luật "việc cần đốc" lấy từ Phòng Kế hoạch hay hóa đơn đại lý, hoặc đổi quyền xem từng khối.
covers: src/features/dashboard, src/lib/dashboardAttention.ts
last_verified: 2026-11-02
ttl_days: 90
status: v1 (2026-11-02) — bản đầu. Chỉ ĐỌC dữ liệu đã có, không bảng / cột / quyền mới.

> **Mục đích:** oracle HÀNH VI cho phần mở rộng của Tổng quan. Phần cũ (thẻ số chuỗi, năm khâu, thanh chia phần, theo ngày, kỳ cân đối, tồn theo kho) giữ nguyên theo [spec/che-do-demo §5b](../spec/che-do-demo.md). **Nguồn luật:** Xuất khẩu [41](41-export-planning.ba-spec.md) · Nhập khẩu [45](45-import-planning.ba-spec.md) · Lệnh sản xuất [48](48-production-order.ba-spec.md) · báo cáo kế hoạch [50](50-planning-reports.ba-spec.md) · hóa đơn đại lý [51](51-supplier-invoice-matching.ba-spec.md). Trang này KHÔNG đặt luật mới cho các module đó, chỉ đọc lại bằng chính hàm báo cáo của chúng.

## 1. Vấn đề & JTBD

- **Job:** Khi mở app đầu ngày, BGĐ / quản đốc / kế toán muốn thấy trong một trang cả chuỗi xưởng LẪN việc của Phòng Kế hoạch (hợp đồng nhập, lệnh sản xuất, chuyến xuất) và hóa đơn đại lý còn treo, để biết phải đốc ai mà không mở từng màn.
- **Vì sao làm bây giờ:** từ 2026-10 đã có thêm Nhập khẩu (mig 0082), Lệnh sản xuất (0088), Xuất khẩu v8–v9 (0075/0079), hóa đơn đại lý gắn chuyến (0090). Tổng quan vẫn chỉ kể chuỗi nhập hàng → SX → kho → bán, nên chuyến xuất trễ hạn, lô nhập thiếu chứng từ, lệnh theo bản HĐ cũ không hiện ở đâu ngoài tab Báo cáo của từng màn.
- **Đo thành công bằng:** mọi mục "cần chú ý" mà tab Báo cáo của 3 màn Kế hoạch đang hiện cho cùng kỳ đều có mặt ở Tổng quan (lệch số = 0), với đúng người được xem.

## 2. User registry

| ID | User | Quyền liên quan | Bối cảnh |
|---|---|---|---|
| U1 | BGĐ | xem mọi module, có `view-price` | desktop, đầu ngày / họp giao ban |
| U2 | Quản đốc xưởng Đông · Cá · Khô | `production-orders` xem (chỉ lệnh đã phát hành); không có `export-plans` / `import-plans` | desktop hoặc điện thoại ở xưởng |
| U3 | Kế toán | `imports.invoices`; xem kế hoạch tùy vai | desktop |
| U4 | Phòng Kế hoạch (`planner`) | `export-plans` · `import-plans` · `production-orders` ghi, có `view-price` | desktop — người XỬ LÝ phần lớn việc mới |
| U5 | Thủ kho | `import-plans.receiving` (chỉ phần thực nhập), không `import-plans` | điện thoại ở kho |
| U6 | Hệ thống (hàm báo cáo của từng module) | — | tính lại mỗi lần đổi kỳ / dữ liệu |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan (cross) | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Nắm số chuỗi xưởng trong kỳ (phần cũ, không đổi) | U1 | U2, U3 | — | hằng ngày | Must (giữ) |
| NV2 | Nắm số Phòng Kế hoạch trong kỳ theo thứ tự Nhập khẩu → Lệnh sản xuất → Xuất khẩu | U1 | U4 (người ghi số) | sổ của 41 / 45 / 48 | hằng ngày | Must |
| NV3 | Đốc việc treo của Phòng Kế hoạch (cùng một danh sách "Việc cần đốc" với chuỗi) | U1 | U4, U5 (người xử lý) | NV2 | hằng ngày | Must |
| NV4 | Đốc chuyến chờ hóa đơn đại lý và dòng lệch hóa đơn | U3 | U2 (xưởng của chuyến) | sổ 51 (mig 0090) | hằng tuần | Should |
| NV5 | Hướng dẫn thao tác + hộp "?" kể được phần mới (nhánh nội dung) | U6 | mọi user | NV2–NV4 | khi đổi trang | Must (QT 18) |

**OUT (không làm đợt này):** chứng nhận sắp hết hạn (đã chốt chỉ hiện ở Việc của tôi — `dashboardTour.test.ts` ghi rõ) · sổ kho tháng (Tổng quan đã có bảng tồn theo kho từ XNT; sổ kho tháng là sổ riêng của kế toán) · bộ soạn văn bản LSX (công cụ, không có số) · đối soát HĐĐT (không đọc DB) · tiền nhập khẩu (nhiều ngoại tệ, không cộng được — chỉ đếm và kg).

## 4. Cross-user handoff map

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Điểm kết nếu không ai nhận |
|---|---|---|---|---|---|
| H1 | NV3 | U1 (thấy việc Xuất khẩu / Lệnh SX / Nhập khẩu chứng từ) | U4 | mục còn trong danh sách, mở thẳng màn của module | mục còn hiện mỗi ngày cho tới khi sổ gốc hết điều kiện (luật ở 41/45/48 tự gỡ) |
| H2 | NV3 | U1 (thấy lần nhập "Chờ thực nhập") | U5 | hàng đã về (ngày về ≤ hôm nay) mà chưa có kg thực nhập | như H1 |
| H3 | NV4 | U3 | U2 / người ghi chuyến | chuyến chờ HĐ quá 10 ngày, hoặc dòng lệch chưa xử | như H1; danh sách gỡ khi HĐ gắn đủ hoặc lệch được "Cập nhật theo HĐ / Giữ số xưởng" |

Tổng quan KHÔNG ghi gì. Mọi chặng kết thúc ở màn gốc; mục tự biến mất khi sổ gốc đổi.

## 5. Flows

### Flow NV2 — Nắm số Phòng Kế hoạch · owner U1
- **Start:** mở `/dashboard`, kỳ + xưởng đang chọn.
- **Input:** kỳ xem; sổ Nhập khẩu (`useImportData`), Lệnh SX (`useProductionOrderData`), Xuất khẩu (`useExportData`); quyền người xem.
- **Steps:** đổi kỳ xem thành các THÁNG chạm kỳ (hàm báo cáo của 3 module tính theo tháng) → gọi `buildImportReport` · `buildOrderReport` · `buildExportReport` → lấy số tổng.
- **Output:** 3 khối theo thứ tự Nhập khẩu → Lệnh sản xuất → Xuất khẩu, mỗi khối: số đếm + kg + (Xuất khẩu, chỉ khi có `view-price`) tiền USD còn chưa về; bấm khối ⇒ mở màn của module ở tab Báo cáo đúng kỳ tháng.
- **End:** người xem biết kỳ này kế hoạch đã nhập / ra lệnh / xuất bao nhiêu.

### Flow NV3 — Đốc việc treo của Phòng Kế hoạch · owner U1
- **Start:** NV2 đã tính xong.
- **Input:** `attention[]` của 3 báo cáo cùng kỳ tháng.
- **Steps:** đổi mỗi mục thành một dòng việc (mức · loại · tiêu đề · chi tiết · ngày · đường mở) → gộp với việc chuỗi (`buildChainWarnings`) vào MỘT danh sách → thẻ "Việc cần đốc" đếm cả hai.
- **Output:** danh sách việc có thêm các loại ở bảng R3; mỗi dòng mở thẳng màn module.
- **End:** handoff H1 / H2.

### Flow NV4 — Đốc hóa đơn đại lý · owner U3
- **Start:** có bảng hóa đơn đại lý (`useSupplierInvoiceStore().isAvailable`) và người xem có `imports.invoices` xem.
- **Input:** chuyến nhập hàng trong kỳ + xưởng; hóa đơn, dòng hóa đơn, bảng mã kế toán.
- **Steps:** tính trạng thái HĐ từng chuyến bằng `tripInvoiceInfo` (cùng luật tab Hóa đơn) → giữ chuyến "Chờ HĐ" / "Thiếu HĐ một phần" đã về quá 10 ngày → cộng dòng hóa đơn đang lệch chưa xử (`isOpenMismatch`).
- **Output:** dòng việc loại "Chuyến chờ hóa đơn đại lý" và "Hóa đơn đại lý lệch sổ", có xưởng; mở `/imports?tab=invoices`.
- **End:** handoff H3.

### Flow NV5 — Nội dung hướng dẫn · owner U6
- **Input:** nhãn loại việc mới (R3), tên 3 khối, luật quyền R4.
- **Output:** tour Tổng quan có bước cho khối Phòng Kế hoạch; bước "Việc cần đốc" kể đủ loại mới; hộp "?" cùng nội dung.

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict & xử |
|---|---|---|---|---|---|
| NV3 | A: việc kế hoạch gộp vào danh sách "Việc cần đốc" có sẵn · B: danh sách riêng dưới khối kế hoạch | Chọn A | một chỗ để đốc (định hướng, ít bước); thẻ "Việc cần đốc" đếm đủ | Orchestrator + Optimizer | — |
| NV3 | A: thêm loại mới vào `FlowWarningKind` · B: hàm riêng, kiểu riêng, gộp ở màn | Chọn B | thêm vào `FlowWarningKind` làm Việc của tôi đổi số cho mọi user (cross ngầm, rubric #4); tiền lệ `buildDocumentWarnings` | Orchestrator | — |
| NV2 | A: khối kế hoạch theo đúng ngày của kỳ · B: theo tháng chạm kỳ | Chọn B | hàm báo cáo 3 module chỉ tính theo tháng; tính lại theo ngày = luật thứ hai (sai chuẩn). Ghi rõ "theo tháng" trên khối | Domain (kế hoạch) | — |
| NV2 | A: khối kế hoạch lọc theo xưởng · B: luôn cả công ty | Chọn B | hợp đồng / lệnh / chuyến xuất không có xưởng; lọc ra rỗng là sai | Domain | — |
| NV4 | A: mọi chuyến chờ HĐ · B: chỉ chuyến về quá 10 ngày | Chọn B | ba-spec 51 §8 lấy mốc 10 ngày; chuyến mới về chờ HĐ là bình thường, hiện hết = nhiễu | Domain (kế toán) | — |
| NV2 | A: cộng tiền nhập khẩu · B: chỉ đếm + kg | Chọn B | nhiều ngoại tệ (USD, EUR) không cộng được (spec §5b "chỉ cộng kg") | Domain (kế toán) | — |

## 7. Scope & Priority

- **IN:** NV2, NV3, NV4, NV5.
- **OUT:** xem §3.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV2 | số tổng khối kế hoạch so với tab Báo cáo cùng tháng | lệch = 0 |
| NV3 | mục "cần chú ý" của 3 tab Báo cáo cùng kỳ có ở Tổng quan | thiếu = 0 |
| NV4 | chuyến chờ HĐ quá 10 ngày không có ở danh sách | = 0 |
| NV5 | nhãn loại việc mới thiếu trong lời tour | = 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Số khối kế hoạch và việc kế hoạch lấy từ CHÍNH `buildImportReport` / `buildOrderReport` / `buildExportReport` (cùng tham số như tab Báo cáo: `filesAvailable` theo kho file, `visibleOrders` cho Lệnh SX). Không viết lại luật. | đổi luật ở 41/45/48 ⇒ Tổng quan đổi theo, không sửa gì ở đây |
| R2 | Kỳ Ngày / Tuần / Tự chọn ⇒ khối kế hoạch tính theo các tháng chạm kỳ, khối ghi rõ tháng đang tính. Bộ lọc xưởng không áp vào khối kế hoạch (ghi "cả công ty"). | kỳ 28/10–03/11 ⇒ tháng 10 + 11 |
| R3 | Loại việc mới + mức: Xuất khẩu "Quá hạn giao" (Chưa làm) · "Vượt dung sai" / "Thiếu dung sai" (Để biết) · "Còn tiền chưa về" (Chưa làm, chỉ khi có `export-plans.view-price`); Nhập khẩu "Thiếu chứng từ" · "Chờ thực nhập" (Chưa làm); Lệnh SX "Nháp quá ngày SX" · "Chưa gắn chuyến" (Chưa làm) · "Theo bản HĐ trước" (Sổ sai); Hóa đơn đại lý "Chuyến chờ hóa đơn" (Chưa làm) · "Hóa đơn lệch sổ" (Sổ sai). | nhãn loại trùng nguyên văn nhãn ở màn gốc (Báo cáo) để người dùng tìm thấy |
| R4 | Mỗi khối / loại việc chỉ có với người có quyền `view` trên tài nguyên của nó: `import-plans` · `production-orders` · `export-plans` · `imports.invoices`. Không quyền nào ⇒ không có khối Phòng Kế hoạch, không có loại việc đó; trang vẫn như cũ. | thủ kho chỉ có `import-plans.receiving` ⇒ không thấy khối Nhập khẩu (giống tab Báo cáo, 50 U4) |
| R5 | Bảng chưa có trên DB (mig chưa chạy) hoặc module rỗng ⇒ khối ghi "chưa có số", không lỗi, không chặn phần còn lại. Hóa đơn đại lý chưa có bảng (`isAvailable=false`) ⇒ không có loại việc đó. | DB thật hiện chưa chạy 0083–0091 |
| R6 | Tổng quan chỉ đọc, không ghi, không toast (QT 13). Chế độ demo: đọc cùng các hook ⇒ tự theo `site-demo`. | — |
| R7 | Tiền chỉ hiện ở Xuất khẩu (USD, một tiền tệ); không cộng tiền nhập khẩu; không cộng USD với VND. | HĐ xuất ghi tiền tệ khác USD ⇒ theo hàm báo cáo 41 |
| R8 | Việc kế hoạch KHÔNG thêm vào Việc của tôi đợt này (Việc của tôi đổi sau, ba-spec 39). | — |

## 9b. Kiểm kê nội dung (NV5)

| Khu vực | Mục người đọc gặp | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Khối Phòng Kế hoạch | 3 khối, thứ tự | Nhập khẩu → Lệnh sản xuất → Xuất khẩu, mỗi khối đếm gì, kg gì | R1, 41/45/48 |
| Khối Phòng Kế hoạch | cách tính kỳ | theo tháng chạm kỳ; không lọc xưởng | R2 |
| Khối Phòng Kế hoạch | ai thấy | chỉ người có quyền xem module; tiền chưa về cần quyền xem giá | R4, R7 |
| Khối Phòng Kế hoạch | rỗng | "chưa có số" khi module chưa có dữ liệu | R5 |
| Việc cần đốc | loại việc mới | đủ 11 nhãn loại R3 + nghĩa + việc tiếp (mở màn nào) | R3 · nhãn ở `lib/dashboardAttention.ts` |
| Việc cần đốc | điều kiện "xong" | mục tự gỡ khi sổ gốc hết điều kiện (vd lần nhập có đủ 3 chứng từ; chuyến có HĐ đủ) | 45 R-chứng từ, 51 §8 |

Văn phong: [README design-system § văn phong](../../src/design-system/README.md) + [43](43-guided-tour.ba-spec.md) (câu ngắn, gọi đúng nhãn trên màn).

## 10. Acceptance Criteria

### AC-1 — Khối kế hoạch khớp tab Báo cáo · NV2 · Test: unit
- **Given** dữ liệu Nhập khẩu, Lệnh SX, Xuất khẩu có bản ghi trong tháng 2026-10
- **When** tính khối kế hoạch cho kỳ tháng 10/2026
- **Then** mỗi số trên khối bằng số tổng của hàm báo cáo module cùng tháng
- **Assert** `summary.import.receipts == buildImportReport(...).totals.receipts` · tương tự `orders`, `shipments`, `actualKg`, `outstanding`

### AC-2 — Kỳ ngắn hơn tháng tính theo tháng chạm kỳ · NV2 · Test: unit
- **Given** kỳ tự chọn 2026-10-28 → 2026-11-03
- **When** đổi sang kỳ báo cáo
- **Then** kỳ báo cáo gồm đúng 2 tháng
- **Assert** `period.months` deep-equals `["2026-10","2026-11"]`

### AC-3 — Việc kế hoạch có trong danh sách chung · NV3 · Test: unit
- **Given** 1 HĐ xuất quá hạn giao chưa đủ kg, 1 lần nhập thiếu chứng từ, 1 lệnh nháp có ngày SX ≤ hôm nay
- **When** dựng việc kế hoạch
- **Then** có đúng 3 dòng, loại lần lượt "Quá hạn giao", "Thiếu chứng từ", "Nháp quá ngày SX", mỗi dòng có đường mở màn module
- **Assert** `rows.length == 3` · `rows.map(r=>r.kind)` chứa 3 loại · mọi `path` bắt đầu bằng `/planning-`

### AC-4 — Mức của từng loại · NV3 · Test: unit
- **Given** mỗi loại ở R3 một ca
- **When** dựng việc
- **Then** "Theo bản HĐ trước" và "Hóa đơn lệch sổ" mức Sổ sai; "Vượt / Thiếu dung sai" mức Để biết; còn lại Chưa làm
- **Assert** `level` của từng loại == bảng R3 (11/11)

### AC-5 — Không quyền thì không có · NV2/NV3 · Test: unit
- **Given** người xem chỉ có `production-orders` xem
- **When** dựng khối + việc
- **Then** không có khối / việc Xuất khẩu, Nhập khẩu, hóa đơn đại lý
- **Assert** `summary.export == null && summary.import == null` · `rows.filter(r=>r.module!=="production-order").length == 0`

### AC-6 — Tiền chưa về cần quyền xem giá · NV3 · Test: unit
- **Given** HĐ xuất còn tiền chưa về; người xem có `export-plans` xem nhưng không `view-price`
- **When** dựng việc
- **Then** không có dòng "Còn tiền chưa về" và khối Xuất khẩu không có số tiền
- **Assert** `rows.filter(r=>r.kind==="export-unpaid").length == 0` · `summary.export.outstanding == null`

### AC-7 — Chuyến chờ hóa đơn quá 10 ngày · NV4 · Test: unit
- **Given** 2 chuyến chưa có HĐ: về 2026-10-20 và 2026-10-30; hôm nay 2026-11-02
- **When** dựng việc hóa đơn đại lý
- **Then** chỉ chuyến về 20/10 có dòng
- **Assert** `rows.length == 1` · `rows[0].date == "2026-10-20"`

### AC-8 — Hóa đơn đại lý theo xưởng · NV4 · Test: unit
- **Given** chuyến chờ HĐ quá hạn ở xưởng Cá; lọc xưởng Đông
- **When** dựng việc
- **Then** không có dòng
- **Assert** `rows.length == 0`

### AC-9 — Module chưa có bảng không làm hỏng trang · NV2/NV4 · Test: unit
- **Given** mọi sổ kế hoạch rỗng và `isAvailable=false` cho hóa đơn đại lý
- **When** dựng khối + việc
- **Then** khối ở trạng thái rỗng, không dòng việc nào, không ném lỗi
- **Assert** `rows.length == 0` · `summary.import.receipts == 0`

### AC-10 — Lời hướng dẫn phủ đủ loại việc mới · NV5 · Test: unit
- **Given** bảng nhãn loại việc kế hoạch trong `lib/dashboardAttention.ts`
- **When** đọc lời tour Tổng quan
- **Then** mọi nhãn có mặt; có bước cho khối Phòng Kế hoạch
- **Assert** nhãn thiếu trong lời tour `== 0` · có bước `target == "dashboard-planning"`

### AC-11 — Trang vẫn đọc được ở 360px × 130% · NV2 · Test: manual (thử tay theo cổng CLAUDE.md, không tự động được)
- **Given** quyền BGĐ, dữ liệu demo
- **When** mở `/dashboard` ở 360px, cỡ chữ 130%
- **Then** khối kế hoạch không làm cuộn ngang trang
- **Assert** `document.documentElement.scrollWidth <= window.innerWidth`

## 11. Assumptions / Open

- **Assumptions:** (a) Tổng quan xếp khối Phòng Kế hoạch ngay dưới năm khâu chuỗi — hai chuỗi song song (xưởng / kế hoạch); (b) bấm khối mở tab Báo cáo đúng tháng nếu màn module đọc được kỳ trên link, không thì mở màn; (c) mốc 10 ngày hóa đơn đại lý là hằng số trong code (51 chưa có hằng); (d) Việc của tôi chưa nhận việc kế hoạch (R8) — đợt sau.
- **Open (RED):** không có.

## History

- v1 (2026-11-02): khởi tạo — Tổng quan đọc thêm Nhập khẩu, Lệnh SX, Xuất khẩu, hóa đơn đại lý.
