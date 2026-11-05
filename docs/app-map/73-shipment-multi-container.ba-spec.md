# 73 — ba-spec: Một chuyến xuất nhiều cont (một booking · 40 + 20)

> Load khi: chuyến xuất có hơn một cont (booking "1X20RF & 1X40RF"), sửa danh sách cont của chuyến, gán dòng hàng vào cont, hàng Số cont + seal, Lệnh xuất / invoice / Packing list / SI của chuyến nhiều cont, độ phủ cont của HĐ.
covers: src/lib/exportContainers.ts, src/lib/exportPlanning.ts, src/lib/exportInvoice.ts, src/lib/shippingInstruction.ts, src/lib/shippingInstructionExcel.ts, src/lib/documentTypes/exportOrderForm.ts, src/lib/bookingReader.ts, src/lib/exportReports.ts, src/features/export-planning/ShipmentDialogs.tsx, src/features/export-planning/ShipmentPanel.tsx, src/features/export-planning/ShipmentGoods.tsx, src/features/export-planning/LoadingView.tsx, src/features/export-planning/invoiceDocument.ts, src/features/export-planning/BookingDialogs.tsx, src/features/export-planning/ShippingInstructionDialog.tsx, src/lib/demoGenerator.ts, supabase/migrations/0106_export_shipment_containers.sql
last_verified: 2026-11-05
ttl_days: 90
status: v1.1 ĐÃ BUILD 2026-11-05 — mig `0106` (🔴 RLS bảng mới; ⏳ CHƯA chạy DB thật; PGlite chuỗi 0001→0106 chạy 2 lần không lỗi mới, thử quyền: đóng cont không thêm cont / không đổi cont của dòng, vẫn ghi số thực đóng; chỉ-xem không ghi). Thay luật A5 của [41](41-export-planning.ba-spec.md). Luật thuần `lib/exportContainers.ts` + `validateExtraContainers` · `mergeShipmentGate` · `mergeShipmentInto` (`exportPlanning.ts`). Test: `exportContainers.test.ts` (AC-1…AC-10, AC-12…AC-15), `demoGenerator.test.ts` (AC-16), tour / hộp "?" qua `exportTour.test.ts` + `pageTourCoverage` (AC-17). AC-11 kiểm tay sau khi chạy 0106.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** HĐ **23.26/BSF-SCM.2026** (SEACHEMOT), dữ liệu thật đọc 2026-11-05 (chỉ đọc):
  - File booking 039GY21068 (WAN HAI 325 N063, ETD 09/11) ghi **"1X20RF & 1X40RF"**: một booking, hai cont.
  - HĐ bản 3: 13 dòng, **28.600 kg**, "2 cont · 40HC-RF + 20RF".
  - App có **1 chuyến** 40HC-RF 28.600 kg, đóng 07/11. Chuyến được tạo lúc HĐ còn ghi 1 cont; sửa lên 2 cont thì lịch giữ nguyên (41 R41) ⇒ HĐ báo **thiếu 1 cont**.
- **Gốc:** app coi chuyến = một cont (41 A5); Phòng Kế hoạch coi chuyến = **một booking, một lần xuất**. Cả hai cách ghi hiện có đều sai một chỗ (thử bằng test 2026-11-05, HĐ 20.000 kg, cont 40 = 1.200 bó, cont 20 = 800 bó):
  - **Tách 2 chuyến** (đúng luật cũ, chứng từ "dùng chung"): invoice lập ở chuyến 1 chỉ có hàng cont 1 ⇒ đã giao của HĐ **12.000 kg (−40 %)**.
  - **Giữ 1 chuyến:** invoice + đã giao đúng, nhưng ô Số container chỉ nhận **một** số 11 ký tự (gõ hai số bị từ chối); Lệnh xuất in "1 x 40HC-RF"; Packing list, SI không tách theo cont; độ phủ báo thiếu cont mãi.
- **Job:** Kế hoạch ghi **một chuyến cho một booking**, khai các cont của booking, chia hàng vào từng cont ⇒ một bộ chứng từ (invoice, PL, SI, tờ khai, B/L) đủ mọi cont; tổ đóng hàng đóng đúng hàng vào đúng cont; HĐ tính đủ đã giao.
- **Đo thành công:** chuyến 23.26 ghi được đúng 2 cont, invoice 28.600 kg in 2 cặp số cont / seal, HĐ không còn cảnh báo thiếu cont; không thao tác "dùng chung" nào cho ca này.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` tạo / sửa | khai cont, chia hàng vào cont, lập chứng từ |
| U2 | BGĐ, Kế toán, người xem `export-plans` | xem | đọc chuyến, báo cáo tháng |
| U4 | Người đóng hàng (`export-plans.loading`) | số thực đóng + ảnh | đóng hàng theo cont, chụp cont / seal |
| S1 | Hệ thống: `export_shipments`, `export_shipment_lines`, `export_files`, bảng mới `export_shipment_containers` | — | — |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Khai danh sách cont của chuyến (loại · số · seal · ngày đóng) | U1 | U4 đọc | — | Must |
| NV2 | Gán từng dòng Hàng của chuyến vào một cont | U1 | U4 đọc | NV1 | Must |
| NV3 | Đóng hàng + ảnh cont / seal theo từng cont | U4 | U1 | NV1, NV2 | Must |
| NV4 | Chứng từ của chuyến đủ mọi cont: Lệnh xuất · invoice · Packing list · SI | U1 | U2 | NV1, NV2 | Must |
| NV5 | Độ phủ cont của HĐ + báo cáo tháng đếm theo cont | S1 | U1, U2 | NV1 | Must |
| NV6 | Gộp chuyến dự kiến thành cont của chuyến khác (lịch chia 2 chuyến, booking ra 1) | U1 | — | NV1 | Should |
| NV7 | Đọc booking "1X20RF & 1X40RF" ⇒ đề xuất sẵn 2 cont | S1 | U1 | NV1, ba-spec 71 | Should |
| NV8 | Tour + hộp "?" + sơ đồ quy trình kể cont của chuyến (QT 18, 21) | S1 | mọi user | NV1–NV6 | Must |

## 4. Cross-user handoff map

| Từ | Tới | Cái gì | Điều kiện | Nhận ở |
|---|---|---|---|---|
| U1 | U4 | danh sách cont + hàng của từng cont | chuyến có ≥ 1 dòng hàng | Đóng cont: hàng nhóm theo cont |
| U4 | U1 | số thực đóng từng dòng + ảnh từng cont | U4 điền / đính | hàng Số cont + seal; Hàng của chuyến |
| U1 | U2 | chuyến nhiều cont trong báo cáo | chuyến mở | báo cáo tháng (số cont) |

## 5. Flows

### Flow NV1 — Khai cont · owner U1
- **Input:** chuyến chưa hủy, loại là cont lạnh (20RF · 40RF · 40HC-RF).
- **Steps:** ở Ghi / Sửa chuyến, cont 1 là loại + số + seal đang có của chuyến (như cũ) ⇒ "Thêm cont" ⇒ chọn loại, gõ số + seal khi có ⇒ Lưu.
- **Output:** chuyến có n cont (cont 1 trên chuyến, cont 2…n ở bảng cont thêm); thẻ chuyến ghi "40HC-RF + 20RF".

### Flow NV2 — Chia hàng vào cont · owner U1
- **Input:** chuyến có ≥ 2 cont, có dòng Hàng của chuyến.
- **Steps:** ở Hàng của chuyến, mỗi dòng chọn cont; một dòng HĐ đi hai cont ⇒ chép dòng, mỗi bản một cont, chia số kiện.
- **Output:** mỗi dòng thuộc đúng 1 cont (chưa chọn = cont 1); tổng kiện / kg theo từng cont.

### Flow NV3 — Đóng theo cont · owner U4
- **Input:** chuyến có cont + dòng đã gán.
- **Output:** số thực đóng từng dòng (như 41 R10); ≥ 1 ảnh cont / seal **cho mỗi cont**; hàng Số cont + seal Xong khi **mọi** cont đủ số + seal + ảnh (R6).

### Flow NV4 — Chứng từ · owner U1
- **Output:** Lệnh xuất "1 x 40HC-RF + 1 x 20RF", bảng hàng ghi cont; invoice một bản cho cả chuyến, in mọi cặp số cont / seal; Packing list nhóm theo cont, mỗi cont một dòng cộng; SI một dòng cho mỗi cont (số, seal, loại, kiện, gross). Thực xuất = invoice của chuyến (41 R7, không đổi).

### Flow NV6 — Gộp chuyến thành cont · owner U1
- **Input:** chuyến A và B cùng HĐ chính, đều mở; B chưa có file, chưa bước nào Xong (như luật xóa chuyến 41).
- **Steps:** ở chuyến B chọn "Gộp vào chuyến A làm cont thêm".
- **Output:** A có thêm cont (loại, số, seal của B); dòng hàng của B chuyển sang A, gán cont mới; B bị xóa; một Hoàn tác trả lại như trước.

## 6. Flow optimization log

| Quyết định | Biến thể | Chọn | Lý do loại | Ai |
|---|---|---|---|---|
| Đơn vị "chuyến" | A: giữ chuyến = cont, invoice gom theo booking (hướng 1) · B: chuyến = booking, có danh sách cont | **B** | A bắt người dùng tách chuyến ngược với cách nghĩ + mỗi cont dùng chung ~7 mục; chủ dự án chọn B 2026-11-05 | Orchestrator + chủ dự án |
| Nơi giữ cont 1 | A: mọi cont ở bảng mới, chuyển dữ liệu cũ · B: **cont 1 vẫn trên chuyến**, bảng mới chỉ giữ cont 2…n | **B** | A phải chuyển dữ liệu mọi chuyến cũ + hai nguồn trong lúc chuyển; B: chuyến cũ chạy y nguyên, code cũ đọc cont 1 vẫn đúng (rubric #5, an toàn sổ thật) | Optimizer |
| Gán hàng | A: dòng không gán cont, chỉ ghi tổng theo cont · B: mỗi dòng 1 cont | **B** | A không nói được cho tổ đóng hàng dòng nào vào cont nào; PL, SI cần kiện / gross theo cont | Domain (XK) |
| Ảnh seal | A: ảnh của chuyến, đủ 1 ảnh là xong · B: ảnh gắn cont, mỗi cont ≥ 1 | **B** | A cho Xong khi cont 2 chưa chụp — trái mục đích R8 (ba-spec 72) | Domain (XK) |
| Booking nhiều cont nhưng chứng từ tách | A: cấm · B: vẫn cho ghi nhiều chuyến cùng booking + "dùng chung" (luật cũ) | **B** | Khách đòi invoice / B/L riêng từng cont thì vẫn làm được; hai cách cùng tồn tại, mặc định là một chuyến | Domain (XK) |

**Góc nhìn nghiệp vụ xuất khẩu (Domain):** một booking nhiều cont thường đi **một B/L kê mọi cont**, một invoice, một Packing list tách theo cont; SI gửi hãng tàu phải có từng số cont, seal, gross (VGM) của mỗi cont. Có khách đòi tách B/L theo cont — ca đó giữ cách nhiều chuyến cùng booking.

## 7. Scope & Priority

- **IN:** NV1–NV5, NV8 (Must); NV6, NV7 (Should — làm sau nếu dài).
- **OUT:** cont khô; tách một dòng hàng tự động theo sức chứa cont; VGM điện tử; đổi luật chuyến gộp nhiều HĐ (ba-spec 70 giữ nguyên, dòng hàng vừa có HĐ vừa có cont).

## 8. Success metric

| NV | Đo | Mục tiêu |
|---|---|---|
| NV1, NV5 | HĐ 23.26: số cont của chuyến == số cont của HĐ | 2 == 2, không cảnh báo thiếu cont |
| NV4 | invoice chuyến 23.26: tổng kg == Σ dòng HĐ đã đóng | 28.600 kg ± dung sai |
| NV3 | chuyến nhiều cont Xong hàng Số cont + seal khi còn cont thiếu ảnh | 0 lần |

## 9. Rules & Invariants

| ID | Luật | Ghi chú |
|---|---|---|
| R1 | **Chuyến = một booking / một lần xuất**, có 1…n cont. Cont 1 = loại + số + seal của chuyến (`kind`, `containerNo`, `sealNo`, như cũ). Cont 2…n ở `export_shipment_containers` (loại, số, seal, ngày đóng tùy chọn, thứ tự). | Thay 41 A5 |
| R2 | Chỉ chuyến loại cont lạnh mới có cont thêm; loại cont thêm ∈ {20RF, 40RF, 40HC-RF}. Xe tải / đóng ghép: không. Đổi chuyến sang xe tải / đóng ghép khi còn cont thêm ⇒ chặn, báo bỏ cont thêm trước. | |
| R3 | Số cont của mọi cont theo luật cũ: 11 ký tự (4 chữ + 7 số), chuẩn hóa trước khi kiểm; hai cont trong một chuyến không trùng số. | 41 `isValidContainerNo` |
| R4 | Mỗi dòng Hàng của chuyến thuộc đúng 1 cont: `containerId` = id cont thêm, **trống = cont 1**. Xóa cont thêm còn dòng gán ⇒ chặn, kể tên các dòng. | Chuyến cũ: mọi dòng trống ⇒ cont 1 |
| R5 | Hàng của chuyến, Lệnh xuất, Packing list, SI, Đóng cont **nhóm theo cont** khi chuyến có ≥ 2 cont; chuyến 1 cont ⇒ như nay, không thêm chữ "Cont 1". | không đổi giao diện chuyến cũ |
| R6 | Hàng Số cont + seal **Xong** ⇔ mọi cont có số hợp lệ + seal + (≥ 1 ảnh gắn cont đó, khi ảnh bắt buộc theo 72 R8). Ảnh cũ không gắn cont = ảnh của cont 1. | Sửa 72 R8 |
| R7 | Lệnh xuất: ô số lượng cont = các cont gom theo loại, "1 x 40HC-RF + 1 x 20RF" (2 cont cùng loại ⇒ "2 x 40RF"). | sửa `exportOrderForm` dòng containers |
| R8 | Invoice: dòng CONTAINER NO. & SEAL NO. kê **mọi** cont, mỗi cont "số / seal"; tổng = cả chuyến. Packing list: mỗi cont một nhóm + dòng cộng kiện / kg tịnh / gross; cộng các nhóm == tổng invoice. | |
| R9 | SI: mỗi cont một dòng (số, seal, loại, số kiện, gross của cont); hàng hóa kê như nay (theo dòng). Mẫu SI hiện có một ô cont (A33 / A34) ⇒ chèn thêm dòng cho cont 2…n, giữ định dạng mẫu. | xem Q2 |
| R10 | Độ phủ cont của HĐ = số cont HĐ − Σ **số cont** của các chuyến mở loại cont lạnh có hàng của HĐ (thay "số chuyến"). Báo cáo tháng đếm cont theo cùng luật. | sửa 41 `contractCoverage`, `exportReports` |
| R11 | Thực xuất, đã giao, tiền về, trễ hạn: **không đổi** — tính theo chuyến (invoice của chuyến; chuyến gộp nhiều HĐ theo dòng, ba-spec 70). | |
| R12 | Người đóng hàng (U4) **không** sửa danh sách cont, không đổi cont của dòng; dòng U4 tự thêm lúc đóng (mig 0102) phải chọn cont thuộc chính chuyến đó. Máy chủ chặn bằng trigger như 0102. | |
| R13 | Gộp chuyến (NV6): chỉ khi B cùng HĐ chính với A, cả hai mở, B chưa có file, chưa bước nào Xong; B có booking khác A ⇒ chặn. Ghi + Hoàn tác một lần. | |
| R14 | Booking (ba-spec 71): ô loại cont đọc được nhiều loại "1X20RF & 1X40RF" ⇒ đề xuất cont 1 = loại lớn nhất, cont thêm cho phần còn lại; người dùng xác nhận mới ghi. | NV7 |
| R15 | Chế độ demo: bảng mới vào `DemoBundle` + `DemoPackLoader` + `TableMapping.refColumns` (`shipment_id`); bộ demo có ≥ 1 chuyến 40 + 20. | QT 15 |
| R16 | Migration chỉ-thêm: tạo `export_shipment_containers` (RLS + trigger quyền như `export_shipments`); thêm cột null `container_id` vào `export_shipment_lines` và `export_files`; sửa trigger 0102 để U4 không đổi `container_id`. Cột chưa có trên máy chủ ⇒ app không gửi (như mig 0101). | 🔴 RLS bảng mới |

## 9b. Kiểm kê nội dung (NV8)

| Chỗ | Phải nói | Nguồn |
|---|---|---|
| Ghi chuyến | một chuyến là một booking; cont 1 là ô loại / số / seal; thêm cont khi booking có nhiều cont | R1, R2 |
| Hàng của chuyến | chọn cont cho từng dòng, để trống là cont 1; dòng đi hai cont thì chép dòng | R4 |
| Số cont + seal | Xong khi mọi cont có số, seal, ảnh | R6 |
| Đóng cont | hàng nhóm theo cont; người đóng hàng không đổi cont của dòng | R5, R12 |
| Invoice / PL / SI | một bộ cho cả chuyến, kê mọi cont | R8, R9 |
| Hồ sơ HĐ | "Chuyến · n / m cont" đếm theo cont | R10 |
| Khi nào tách chuyến | khách đòi invoice / B/L riêng từng cont ⇒ nhiều chuyến cùng booking, chứng từ "dùng chung" | log §6 |

## 10. Acceptance Criteria

### AC-1 — Chuyến cũ không đổi · R1, R5, R11 · Test: unit
- **Given** chuyến 40RF có số cont SZLU2030326, seal VN48840AW, 2 dòng hàng, không cont thêm
- **When** lấy danh sách cont, dựng invoice, tính độ phủ
- **Then** đúng 1 cont lấy từ chuyến; invoice + độ phủ giống hệt trước khi có luật này
- **Assert** `shipmentContainers(d, s).length == 1` · `containers[0].containerNo == "SZLU2030326"` · `containers[0].id == ""` (cont 1)

### AC-2 — HĐ 23.26: thêm cont 20 ⇒ hết thiếu cont · R1, R10 · Test: unit
- **Given** HĐ 2 cont, 28.600 kg; 1 chuyến 40HC-RF
- **When** thêm cont thêm loại 20RF
- **Then** độ phủ không còn thiếu cont; thẻ chuyến ghi hai loại
- **Assert** `contractCoverage(d, c).missingContainers == 0` · `shipmentContainerSummary(d, s) == "40HC-RF + 20RF"`

### AC-3 — Gán hàng theo cont · R4 · Test: unit
- **Given** chuyến 2 cont; dòng X 1.200 bó gán cont thêm, dòng Y 800 bó để trống
- **When** cộng theo cont
- **Then** cont 1 = 800 bó, cont 2 = 1.200 bó; Σ == cả chuyến
- **Assert** `byContainer[""].units == 800` · `byContainer[c2].units == 1200` · `Σ units == 2000`

### AC-4 — Xóa cont còn dòng ⇒ chặn · R4 · Test: unit
- **Given** cont thêm có 1 dòng gán
- **When** xóa cont
- **Then** bị chặn, kể tên dòng
- **Assert** `removeContainerGate(...).ok == false` · `blockingLines.length == 1`

### AC-5 — Số cont trùng / sai ⇒ lỗi · R3 · Test: unit
- **Given** cont thêm số "SZLU2030326" trùng cont 1; cont khác số "ABC123"
- **When** kiểm chuyến
- **Then** 2 lỗi
- **Assert** `issues.filter(i => i.key.startsWith("container")).length == 2`

### AC-6 — Số cont + seal Xong khi đủ mọi cont · R6 · Test: unit
- **Given** chuyến 2 cont sau mốc ảnh bắt buộc; cả hai có số + seal; chỉ cont 1 có ảnh
- **When** tính trạng thái hàng Số cont + seal; rồi đính 1 ảnh cho cont 2
- **Then** lần 1 đang làm; lần 2 Xong
- **Assert** lần 1 `containerSealState == "in-progress"` · lần 2 `== "done"`

### AC-7 — Lệnh xuất ghi đủ cont · R7 · Test: unit
- **Given** chuyến 40HC-RF + 20RF; chuyến khác 40RF + 40RF
- **When** dựng ô cont của Lệnh xuất
- **Then** "1 x 40HC-RF + 1 x 20RF" và "2 x 40RF"
- **Assert** `containers == "1 x 40HC-RF + 1 x 20RF"` · `containers2 == "2 x 40RF"`

### AC-8 — Invoice kê mọi cont, tổng cả chuyến · R8 · Test: unit
- **Given** chuyến 2 cont (SZLU2030326 / VN48840AW, TGHU1234567 / VN48841AW), dòng 1.200 + 800 bó × 10 kg
- **When** dựng invoice
- **Then** dòng cont có cả 2 cặp; tổng kg 20.000
- **Assert** `containerCell.includes("SZLU2030326") && containerCell.includes("TGHU1234567")` · `totals.netKg == 20000`

### AC-9 — Packing list nhóm theo cont · R8 · Test: unit
- **Given** như AC-8
- **When** dựng Packing list
- **Then** 2 nhóm, cộng nhóm == tổng invoice
- **Assert** `groups.length == 2` · `groups[0].netKg + groups[1].netKg == 20000`

### AC-10 — SI một dòng mỗi cont · R9 · Test: integration
- **Given** như AC-8, kg cả bì mỗi bó 10,8
- **When** xuất file SI
- **Then** 2 dòng cont, gross cont 2 = 12.960
- **Assert** `containerRows.length == 2` · `containerRows[1].grossKg == 12960`

### AC-11 — Người đóng hàng không đổi cont · R12 · Test: manual (trigger máy chủ)
- **Given** tài khoản chỉ có `export-plans.loading`
- **When** đổi `container_id` của một dòng; thêm dòng mới gán cont của chuyến khác
- **Then** cả hai bị máy chủ từ chối; điền số thực đóng vẫn được
- **Assert** số lỗi máy chủ == 2 · `loaded_units` ghi được == 1 dòng

### AC-12 — Gộp chuyến thành cont · R13 · Test: unit
- **Given** HĐ 2 cont, lịch ra chuyến A (40RF) + B (20RF), B chưa file, có 1 dòng hàng
- **When** gộp B vào A; rồi Hoàn tác
- **Then** A có 2 cont, dòng của B nằm ở A gán cont mới, B không còn; Hoàn tác ⇒ như trước
- **Assert** `A.containers.length == 2` · `shipments.includes(B) == false` · sau Hoàn tác `shipments.length == 2`

### AC-13 — Báo cáo tháng đếm cont · R10 · Test: unit
- **Given** tháng 11 có chuyến 40HC-RF + 20RF và chuyến 40RF
- **When** dựng báo cáo tháng
- **Then** 3 cont
- **Assert** `month.containers == 3`

### AC-14 — Chuyến gộp nhiều HĐ + nhiều cont · R11 · Test: unit
- **Given** chuyến 2 cont, dòng HĐ A ở cont 1, dòng HĐ B ở cont 2 (cùng khách, ba-spec 70)
- **When** tính đã giao từng HĐ
- **Then** như ba-spec 70 AC-1, không phụ thuộc cont
- **Assert** `contractActuals(d, A).kg + contractActuals(d, B).kg == Σ kg chuyến`

### AC-15 — Đọc booking nhiều loại cont · R14 · Test: unit
- **Given** ô Equipment "1X20RF & 1X40RF"
- **When** đọc booking
- **Then** đề xuất cont 1 = 40RF, 1 cont thêm 20RF
- **Assert** `read.kind == "40RF"` · `read.extraKinds == ["20RF"]`

### AC-16 — Demo có bảng cont · R15 · Test: unit
- **Given** bộ demo chuẩn
- **When** kiểm DemoBundle / TableMapping
- **Then** có `export_shipment_containers`, khóa ngoại `shipment_id` khai báo; có ≥ 1 chuyến 2 cont
- **Assert** `tables.includes("export_shipment_containers") == true` · `demoMultiContainerShipments >= 1`

### AC-17 — Lời hướng dẫn · NV8 · Test: unit
- **Given** tour + hộp "?" của Xuất khẩu
- **When** đọc chữ
- **Then** có đủ ý của §9b; không dùng chữ "bấm / nhấn / click"
- **Assert** mục §9b thiếu == 0

## 11. Assumptions / Open

- **Assumptions:** (a) cont 1 giữ trên chuyến để không chuyển dữ liệu (log §6); (b) ngày đóng của cont thêm tùy chọn, trống = ngày đóng của chuyến; (c) kg kế hoạch vẫn ở chuyến (tổng), không chia theo cont; (d) một B/L cho cả chuyến — khách đòi B/L riêng từng cont thì dùng nhiều chuyến cùng booking (luật cũ 41 R5 "dùng chung" giữ nguyên); (e) số migration đặt lúc build (origin hiện tới 0105).
- **Open:**
  - **Q1** — Lệnh xuất mẫu QTI-KH-01-07 khi 2 cont: một lệnh cho cả chuyến (bảng hàng có cột / nhóm Cont) hay mỗi cont một lệnh? Tạm: **một lệnh, nhóm theo cont**.
  - **Q2** — SI khi 2 cont: chị Thảo gửi một SI đã làm cho booking nhiều cont để khớp vị trí dòng cont. Tạm: chèn dòng ngay dưới A33 / A34.
  - **Q3** — Packing list khách Nhật có cần số kiện theo cont ở đầu trang không? Tạm: chỉ nhóm + dòng cộng.
  - **RED:** migration tạo RLS cho bảng mới + sửa trigger 0102 ⇒ build xác nhận một câu trước khi chạy DB thật; chạy PGlite hai lần trước.
- **Tạm cho lô 23.26 đóng 07/11 (trước khi build):** ô Số container / Seal ghi cont 40; số + seal cont 20 ghi Ghi chú chuyến; bổ sung tay số cont 20 trên invoice / PL / SI xuất ra; bỏ qua cảnh báo thiếu cont. Kiểm thêm: booking ghi 40RF nhưng HĐ / chuyến ghi 40HC-RF; Cảng đích HĐ + chuyến đang trống (booking: Tokyo).

## History

- v1 (2026-11-05): khởi tạo từ phân tích HĐ 23.26/BSF-SCM.2026 (dữ liệu thật, chỉ đọc) + test hai cách ghi; chủ dự án chọn hướng 2 (chuyến = booking, nhiều cont).
- v1.1 (2026-11-05): ĐÃ BUILD. Khác đặc tả: (a) AC-8 đo trên trang Invoice (đầu trang kê "Container / Seal" từng cont khi ≥ 2 cont) và Expiry date list; chuyến 1 cont giữ đúng mẫu cũ; (b) R9: mẫu SI không chèn dòng — 2 cont đầu dùng A33/A34 + A35/A36 (cột C: loại + số kiện + gross), cont thứ 3 trở đi ghi thêm vào A36 / C35; (c) R5 Lệnh xuất: bảng hàng chia theo cont, file Word ghi "[Cont n · loại]" trước tên hàng (Q1 tạm: một lệnh cho cả chuyến); (d) Packing list: dòng tiêu đề cont + dòng cộng dùng kiểu dòng "item" để bản Word / PDF không cắt bảng; (e) R14 hỏi Có / Không ở hộp Cập nhật booking, Có ⇒ thêm cont thêm chưa có số; (f) NV6 nút **Gộp làm cont thêm** ở thẻ chuyến (chỉ hiện khi có chuyến nhận hợp lệ), cont thêm của chuyến bị gộp đi theo.
