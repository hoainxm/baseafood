# 53 — ba-spec: Bộ lọc ở các sổ / bảng còn thiếu (toàn hệ thống)

> Load khi: thêm hoặc sửa bộ lọc / ô tra của một sổ, bảng nghiệp vụ; làm khung `FilterBar` · `SearchField` của design-system; rà màn nào còn thiếu lọc.
covers: src/design-system/patterns/FilterBar.tsx, src/lib/recordFilters.ts, src/features/shared/filterCoverage.test.ts, src/design-system/patterns/CatalogCrudModal.tsx
last_verified: 2026-10-31
<!-- re-verified: 2026-10-31 — AC-1…3 test recordFilters (4); AC-7 filterCoverage (17); preview demo: Đơn đặt lọc Đang gom ⇒ 1 / 5 đơn, thẻ số "theo bộ lọc", "Bỏ hết bộ lọc (1)"; tra "xyzkhongco" ⇒ "Không có dòng nào khớp bộ lọc", bỏ lọc ⇒ 5 đơn; 360 px × 130 % 10 trang `scrollWidth == clientWidth` (sau khi FilterBar chặn bề rộng); bsf.* trước == sau. -->
ttl_days: 90
status: v1 CHỐT + ĐÃ BUILD 2026-10-31 (P0–P3). Ngoại lệ ghi ở §6b.

> **Mục đích:** oracle HÀNH VI cho bộ lọc. Không mô tả giao diện chi tiết; chỗ đặt, cỡ, thứ tự ô theo mẫu sổ bán hàng (`features/sales/SalesScreen.tsx` khối lọc) và luật README design-system.

## 1. Vấn đề & JTBD

Rà 2026-10-31 (~45 màn / tab có bảng): nhiều sổ dài chỉ lọc được theo kỳ + xưởng. Muốn xem "phiếu bán của khách A", "đơn còn đang gom", "phiên SX chờ nhập kho", "mặt hàng X trong NXT" thì phải cuộn hoặc xuất Excel ra lọc. Bảng có cột trạng thái mà không lọc được theo trạng thái. Không có chuẩn chung: mỗi màn tự ghép ô lọc, nút "Bỏ hết bộ lọc" chỉ có ở Nhập hàng.

**JTBD:** "Khi mở một sổ, tôi muốn thu về đúng các dòng tôi cần (theo khách / đại lý / trạng thái / chữ trên dòng) trong vài giây, thấy tổng của đúng phần đó, rồi bỏ lọc về sổ đầy đủ một lần."

**Success metric:** mọi sổ dài (cỡ L ở §6) có ô tra + lọc đối tượng chính; mọi bảng có cột trạng thái lọc được theo trạng thái; 0 màn tự ghép khung lọc mới ngoài `FilterBar` (màn sửa ở đợt này).

## 2. User registry

| ID | User | Màn chính có bảng |
|---|---|---|
| U1 | Tổ trưởng / thủ kho phân xưởng | Bán hàng, Sản xuất TP, Đóng gói, Nhập hàng, Kho dự trữ |
| U2 | Kế toán | NXT, NXT NL, NXT kho, Sổ kho tháng, Đối soát, báo cáo Nhập / Bán |
| U3 | Phòng Kế hoạch | Đơn hàng, Xuất khẩu, Nhập khẩu, Lệnh sản xuất, báo cáo xuất theo đơn |
| U4 | Admin | Người dùng, Danh mục |
| U5 | Mọi người dùng | Việc của tôi |

## 3. Nghiệp vụ

**NV1 — Thu hẹp sổ về đúng dòng cần xem · owner = user chính của màn (§6 cột Owner).** Không cross-user: bộ lọc là việc riêng của người đang xem, không lưu, không chia sẻ.
- **Start:** người dùng mở sổ (đã có kỳ xem như hiện nay).
- **Input:** một hay nhiều điều kiện: ô tra (chữ), đối tượng (khách / kênh / đại lý / loại NL / nhóm hàng / vai trò…), trạng thái.
- **Flow:** đổi một điều kiện ⇒ bảng chỉ còn dòng khớp TẤT CẢ điều kiện (AND) ⇒ tổng / thẻ số theo dòng đang hiện ⇒ "Bỏ hết bộ lọc" ⇒ về sổ đầy đủ của kỳ.
- **Output:** danh sách dòng khớp; số dòng khớp; tổng theo dòng khớp; khi 0 dòng ⇒ lời báo "Không có dòng nào khớp bộ lọc" + cách bỏ lọc.
- **End:** người dùng thấy đủ dòng cần hoặc bỏ lọc. Không ghi gì vào sổ.

## 4. Luật

| ID | Luật |
|---|---|
| R1 | **Sổ dài (cỡ L) phải có:** kỳ xem (đã có) + **ô tra** + lọc theo **đối tượng chính** có trên dòng (khách / đại lý / xưởng…). Bảng ngắn (cỡ S) chỉ cần ô tra. |
| R2 | **Bảng có cột trạng thái ⇒ lọc được theo trạng thái:** "Tất cả" + từng trạng thái, mỗi lựa chọn kèm số dòng của kỳ. Nhãn trạng thái gọi đúng nguyên văn hằng số nhãn của màn. |
| R3 | **Ô tra:** không phân hoa thường, bỏ dấu tiếng Việt khi so (gõ "bach tuoc" khớp "Bạch tuộc"), khớp chuỗi con trên các cột chữ đang hiện của dòng (mã, tên, khách, số phiếu, biển số…). Ô tra luôn có **nhãn** "Tra …" ghi rõ tra được gì (luật 5 — chữ mờ không thay nhãn). |
| R4 | **Nhiều điều kiện = AND.** Ô đối tượng / trạng thái: chọn một giá trị (hoặc "Tất cả"). |
| R5 | **Tổng theo dòng đang hiện** (chốt §8 Q2): thẻ số / dòng Tổng cộng / tổng kg tiền của màn tính trên dòng khớp; khi đang lọc, thẻ số ghi thêm "theo bộ lọc". Số đã ghi sổ KHÔNG đổi; công thức sổ (cân đối, tồn, NXT) không đổi — chỉ chọn dòng nào hiện. |
| R6 | **Bỏ lọc:** có ≥ 1 điều kiện khác mặc định ⇒ hiện "Bỏ hết bộ lọc (N)" (N = số điều kiện đang bật); bấm ⇒ mọi điều kiện về mặc định, kỳ xem giữ nguyên. |
| R7 | **0 dòng khớp ⇒** báo "Không có dòng nào khớp bộ lọc", kèm cách bỏ lọc. Khác với "kỳ này chưa có dòng nào" (kỳ trống). |
| R8 | **Không lưu, không toast:** bộ lọc là trình bày (README luật 8 tầng 0) — không toast, không ghi máy chủ; rời trang rồi quay lại ⇒ về mặc định. Kỳ xem giữ cách cũ của từng màn. |
| R9 | **Tô màu dòng:** bảng chuẩn khóa dòng = id bản ghi ⇒ lọc không làm mất dấu. Bảng GỘP theo bộ lọc (báo cáo) ⇒ ghép điều kiện lọc vào `rowMarkKey` (README § Tô màu dòng). "Chọn tất cả" chỉ chọn dòng đang hiện. |
| R10 | **Ô lọc không phải ô nhập:** nhãn "Tất cả …", không dấu bắt buộc, không Thêm mới / bút chì (README ngoại lệ ô lọc); nút lọc / đổi chế độ có `title`. |
| R11 | **Khung chung** (chốt §8 Q3): màn sửa ở đợt này dùng `FilterBar` (khung + đếm điều kiện + "Bỏ hết bộ lọc") và `SearchField` (ô tra có nhãn) của design-system; logic so khớp ở `lib/recordFilters.ts` (hàm thuần, có test). Màn cũ đang đủ (Nhật ký, Tài liệu, Sổ chuyến Nhập hàng…) giữ nguyên, không bắt viết lại. |
| R12 | **Hướng dẫn (QT 18):** mỗi màn thêm lọc ⇒ tour / hộp "?" nói: lọc được theo gì, tổng tính theo bộ lọc, cách bỏ lọc. |

## 5. Flow optimization log

- Loại "lưu bộ lọc qua lần mở sau" — cần khóa localStorage mới mỗi màn (🟡), dễ khiến người dùng tưởng sổ thiếu dòng; chọn R8 không lưu.
- Loại "tổng luôn của cả kỳ" — chủ dự án chọn tổng theo dòng đang hiện (Q2), kèm chữ "theo bộ lọc" để không nhầm tổng kỳ.
- Loại "OR giữa các ô" — khó hiểu với người dùng xưởng; chọn AND (R4).
- Loại "viết lại mọi màn sang FilterBar" — rủi ro hồi quy lớn, không giải quyết chỗ thiếu; chọn R11 chỉ màn đợt này.

## 6. Danh sách màn (oracle phạm vi — rà 2026-10-31)

| Đợt | Màn / tab | Owner | Cỡ | Thêm |
|---|---|---|---|---|
| 1 | `/sales` Sổ bán hàng | U1 | L | Khách hàng · Kênh bán · Tra (khách, mặt hàng, số phiếu) |
| 1 | `/orders` Đơn hàng | U3 | L | Trạng thái (đang gom / đã chốt / đủ) · Khách hàng · Tra mở rộng (mặt hàng, số đơn) |
| 1 | `/wip` Sổ sản xuất TP | U1 | L | Trạng thái nhập kho (Chờ nhập kho / đã nhập) — thẻ "Chờ nhập kho" bấm được để lọc · Khách · Tra mặt hàng |
| 1 | `/packaging` Đóng gói | U1 | L | Tra (mặt hàng, lô) · Kho TP nếu dòng có |
| 1 | `/nxt` NXT thành phẩm | U2 | M | Tra mã / tên hàng |
| 1 | `/nxt-warehouse` NXT kho | U2 | M/L | Tra mã / tên hàng · "Chỉ dòng có phát sinh hoặc còn tồn" |
| 1 | `/imports` Sổ chi tiết chuyến | U1 | L | Tra (biển số, số phiếu, đại lý) — giữ "Bộ lọc thêm" sẵn có |
| 2 | `/planning-production` Lệnh | U3 | L | Trạng thái (Nháp / Đã phát hành / Đã hủy) thay nút Xem / Ẩn lệnh đã hủy |
| 2 | `/planning-import` Lịch tháng | U3 | L | Trạng thái lần nhập (theo cột Trạng thái, gồm "còn thiếu chứng từ") |
| 2 | `/planning-export` Hợp đồng | U3 | L | Khách hàng |
| 2 | `/export-report` Xuất theo đơn | U3 | M | Trạng thái đơn · Tra mặt hàng |
| 3 | `/users` Người dùng | U4 | S | Trạng thái tài khoản · Vai trò |
| 3 | `/my-tasks` Việc của tôi | U5 | M | Tra (tên việc, người giao) |
| 3 | `/monthly-stock` Sổ kho tháng | U2 | L | Nhóm hàng |
| 3 | `/catalog` các tab danh mục | U4 | S/M | Nhóm theo tab: mặt hàng (nhóm / kiểu chế biến), khách (thị trường), loại NL (loài), NCC (trạng thái) |
| 3 | `/sales` Báo cáo · `/imports` Tổng hợp kỳ | U2 | M | Khách · Kênh / Đại lý · Loại NL (bảng gộp ⇒ R9 ghép lọc vào `rowMarkKey`) |

### 6b. Ngoại lệ khi build (2026-10-31)

- **`/planning-production` KHÔNG thêm lọc trạng thái** — chủ dự án đã BỎ bộ lọc trạng thái 5 lựa chọn ngày 2026-10-30 ("5 cái đang hơi nhiều và thừa thãi", design-spec 49); giữ Khách + ô tra + nút Xem / Ẩn lệnh đã hủy. Quyết định cũ thắng R2.
- **R5 giữ theo cả kỳ** ở các số "chính thức": `/wip` báo cáo ngày gửi lên + bột tẩm (kế toán chép sang Cân đối); `/nxt` Xuất Excel xuất đủ mọi mặt hàng; Tổng hợp kỳ Nhập hàng: phế liệu không theo lọc đại lý / loại NL (có ghi chú trên khung lọc).
- **`/planning-import` Lô nhập:** ba thẻ số vẫn của cả tháng (đã có "Còn thiếu" tách nghĩa); lọc trạng thái chỉ đổi bảng.
- **`/catalog`:** ô lọc nhóm làm chung trong `CatalogCrud` (`filters` của cấu hình tab), chỉ hiện khi danh mục có ≥ 2 nhóm; ô tìm cũ của bảng giữ nguyên.
- **`/imports` Sổ chuyến:** giữ khung "Bộ lọc thêm" sẵn có, thêm `SearchField`; ô tra chỉ áp ở chế độ Sổ.

Ngoài phạm vi: lưới nhập liệu (Cân đối chi tiết, phiếu QC), ma trận quyền, bản in, màn đã đủ (Nhật ký, Tài liệu, Mặt hàng 141 mã, QR Theo giai đoạn / In tem, Đối soát HĐĐT).

## 7. Kế hoạch build

| Bước | Việc | Tier |
|---|---|---|
| P0 | `lib/recordFilters.ts` (so khớp R3, đếm trạng thái R2, đếm điều kiện R6) + test; `FilterBar`, `SearchField` ở `design-system/patterns/` + export `index.ts` + mục README "Bộ lọc" | 🟢 |
| P1 | Đợt 1 (7 màn) — mỗi màn cùng commit với tour / hộp "?" | 🟢 |
| P2 | Đợt 2 (4 màn) | 🟢 |
| P3 | Đợt 3 (5 nhóm) | 🟢 |

P1–P3 sửa file khác nhau theo khu ⇒ chạy song song được sau P0.

## 8. Đã chốt + giả định

| # | Câu | Chốt 2026-10-31 |
|---|---|---|
| Q1 | Phạm vi | **Cả 3 đợt** |
| Q2 | Tổng khi đang lọc | **Theo dòng đang hiện** (+ chữ "theo bộ lọc") |
| Q3 | Khung dùng chung | **Có** — `FilterBar` + `SearchField`; màn sửa đợt này dùng, màn cũ đang đủ giữ nguyên |

Giả định: không lưu bộ lọc (R8) · AND (R4) · ô tra bỏ dấu (R3) · kỳ xem giữ cách cũ từng màn · `/wip` "đã nhập kho" = phiên không còn "Chờ nhập kho".

## 10. Acceptance Criteria — ORACLE

### AC-1 — Ô tra bỏ dấu, không phân hoa thường · Maps to: NV1, R3 · Test: unit
- **Given** 3 dòng tên "Bạch tuộc cắt luộc", "Mực ống", "BẠCH TUỘC 2 da"
- **When** tra "bach tuoc"
- **Then** còn 2 dòng bạch tuộc
- **Assert** `recordFilters` khớp == 2; tra "" ⇒ 3; tra "xyz" ⇒ 0

### AC-2 — Nhiều điều kiện là AND, đếm điều kiện đang bật · Maps to: NV1, R4, R6 · Test: unit
- **Given** sổ bán 5 phiếu: khách A kênh Xuất khẩu ×2, khách A kênh Nội địa ×1, khách B ×2
- **When** lọc khách A + kênh Xuất khẩu, rồi Bỏ hết bộ lọc
- **Then** còn 2 phiếu, số điều kiện đang bật 2; bỏ lọc ⇒ 5 phiếu, 0 điều kiện
- **Assert** số dòng == 2 rồi == 5; số điều kiện == 2 rồi == 0

### AC-3 — Lọc trạng thái kèm số đếm · Maps to: NV1, R2 · Test: unit
- **Given** 6 đơn: 3 đang gom, 2 đã chốt, 1 đủ
- **When** dựng lựa chọn trạng thái và chọn "đã chốt"
- **Then** lựa chọn có số đếm, bảng còn 2 đơn
- **Assert** đếm == {Tất cả: 6, đang gom: 3, đã chốt: 2, đủ: 1}; dòng hiện == 2

### AC-4 — Tổng theo dòng đang hiện · Maps to: NV1, R5 · Test: unit + manual
- **Given** sổ bán kỳ có tổng 10.000 kg, khách A chiếm 3.200 kg
- **When** lọc khách A
- **Then** tổng kg của màn hiện 3.200 kèm "theo bộ lọc"; bỏ lọc ⇒ 10.000, không còn chữ "theo bộ lọc"
- **Assert** tổng == 3.200 rồi == 10.000; số đã ghi sổ trước / sau == nhau (đếm + băm `bsf.*` không đổi)

### AC-5 — 0 dòng khớp khác kỳ trống · Maps to: NV1, R7 · Test: manual
- **Given** kỳ có dòng, bộ lọc không khớp dòng nào
- **When** xem bảng
- **Then** báo "Không có dòng nào khớp bộ lọc" + cách bỏ lọc (không phải lời "kỳ này chưa có")
- **Assert** chữ "Không có dòng nào khớp bộ lọc" xuất hiện == 1; bấm bỏ lọc ⇒ số dòng > 0

### AC-6 — Thẻ "Chờ nhập kho" lọc được · Maps to: NV1, R2 · Test: unit + manual
- **Given** sổ SX TP kỳ có 4 phiên, 1 phiên "Chờ nhập kho"
- **When** chọn lọc Chờ nhập kho (hoặc bấm thẻ số)
- **Then** còn đúng phiên đó
- **Assert** dòng hiện == 1; thẻ số "Chờ nhập kho" == 1

### AC-7 — Màn đợt này dùng khung chung, có hướng dẫn · Maps to: R11, R12 · Test: unit (quét mã nguồn) + manual
- **Given** 16 màn / tab ở §6
- **When** quét mã nguồn màn và tour
- **Then** mỗi màn dùng `FilterBar` hoặc `SearchField`; tour / hộp "?" của màn có nói "lọc" và "Bỏ hết bộ lọc"
- **Assert** số màn §6 thiếu `FilterBar|SearchField` == 0; `pageTourCoverage.test.ts` xanh; 360 px × 130 % mỗi màn: `scrollWidth == clientWidth`

## History
- v1.1 2026-10-31 — BUILD P0–P3: `lib/recordFilters.ts` (+ test AC-1…3), `FilterBar` · `SearchField` · `NoMatchState` (+ `CatalogFilter` của `CatalogCrud`), README § Bộ lọc; 15 màn / tab §6 (trừ Lệnh SX — §6b); tour 12 bước + mục "Bộ lọc" ở hộp "?" 13 trang (`FILTER_NOTES` trong guideContent); test quét `filterCoverage.test.ts` (AC-7).
- v1 2026-10-31 — rà 45 màn / tab, chủ dự án chốt Q1–Q3 (cả 3 đợt · tổng theo dòng đang hiện · có FilterBar + SearchField). Chưa build.
