# 72 — ba-spec: Lệnh xuất hàng lập trong app · Ảnh cont / seal · Shipping Instruction (SI)

> Load khi: sửa mục Lệnh xuất (lập + xuất file Word theo mẫu QTI-KH-01-07), ảnh cont / seal ở hàng Số cont + seal, hoặc mục SI (lập + xuất file Excel theo mẫu SI FORM) ở bước 4 Đóng cont của chuyến xuất.
covers: src/lib/exportPlanning.ts, src/lib/shippingInstruction.ts, src/lib/shippingInstructionExcel.ts, src/lib/documentTypes/exportOrderForm.ts, src/lib/documentTypes/exportOrderTemplate.ts, src/features/export-planning/ExportOrderComposer.tsx, src/features/export-planning/ShippingInstructionDialog.tsx, src/features/export-planning/ShipmentPanel.tsx, supabase/migrations/0103_export_si_container_photos.sql
last_verified: 2026-11-04
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-04 — mig `0103` (🔴 RLS `export_files` cho ảnh cont / seal + nới check thêm `shipping-instruction`, `container-seal-photos`; ⏳ CHƯA chạy DB thật; PGlite chạy 2 lần không lỗi). Lệnh xuất = loại văn bản `export-order-form` của bộ soạn (ba-spec 54) + khuôn gốc dựng bằng code; SI = `lib/shippingInstruction.ts` + điền chính file mẫu `src/lib/templates/si-form.xlsx` bằng exceljs. Test: `exportOrderForm.test.ts` (AC-1…AC-3, AC-5), `shippingInstruction.test.ts` (AC-4, AC-6, AC-8…AC-12), `exportTour.test.ts` (AC-13), `repo.test.ts` (bước file mới). AC-7 kiểm tay sau khi chạy 0103.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** chị Phạm Thảo (Phòng Kế hoạch) 2026-11-04, nguyên văn: "Sau thông tin xe vận chuyển sẽ đến Lệnh xuất hàng. Em cho mục này điền thông tin và xuất file ra giúp chị như sau file đính kèm (word). Tới số container / số seal, cho chị đính kèm hình ảnh cont / seal. Sau đó cho chị thêm một bước là làm SI, điền thông tin vô để ra file như sau (excel)". Mẫu: `FORM LỆNH XUẤT HÀNG .doc` (QTI-KH-01-07) và `SI FORM.XLSX` (sheet "SI Form", A1:I42).
- **Hiện nay:** mục "Lệnh xuất" (bước 4) chỉ là chỗ đính file soạn ngoài app; Kế hoạch gõ lại tên hàng, size, MSL, ngày sản xuất, hạn dùng, HS code, cut-off… vốn đã có trong app (Lệnh sản xuất, hợp đồng, booking). Ảnh cont / seal gửi qua Zalo. SI soạn tay trên Excel rồi gửi hãng tàu để ra B/L.
- **Job:** Đóng hàng tới nơi, Nhân viên Kế hoạch bấm lập Lệnh xuất ⇒ phần lớn ô tự điền, chỉ gõ số lượng + lưu ý ⇒ ra file Word đúng mẫu gửi BGĐ / xưởng / kế toán / kho. Đóng xong có số cont / seal + ảnh ⇒ lập SI, ô lấy sẵn từ booking + hợp đồng + cont ⇒ ra file Excel đúng mẫu gửi hãng tàu.
- **Đo thành công:** Lệnh xuất: số ô phải gõ tay ≤ 3 nhóm (số lượng, lưu ý đóng hàng, yêu cầu chứng từ); SI lần thứ hai cho cùng khách: ô phải gõ ≤ 2 (CBM, shipping marks nếu đổi).

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` tạo / sửa | lập Lệnh xuất, SI; đính ảnh cont / seal |
| U2 | BGĐ, Kế toán, người có `export-plans` xem | xem | nhận Lệnh xuất (file), theo dõi |
| U4 | Người đóng hàng (`export-plans.loading`) | 4a / 4b + **ảnh cont / seal** | chụp cont / seal ở bãi / xưởng |
| S1 | Hệ thống: `export_step_items` (mục Lệnh xuất, mục SI), `export_files`, Lệnh sản xuất (ba-spec 48), Thông tin công ty (67), booking (71) | — | — |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Lập Lệnh xuất hàng: ô tự điền + gõ số lượng, lưu ý ⇒ xuất file Word mẫu QTI-KH-01-07 | U1 | U2 nhận file | 71 (booking), 48 (LSX) | Must |
| NV2 | Đính ảnh cont / seal ở hàng Số cont + seal | U1 | U4 | — | Must |
| NV3 | Lập SI: ô tự điền + nhớ theo khách ⇒ xuất file Excel mẫu SI FORM | U1 | — | NV1 (số kiện), 71, số cont / seal | Must |
| NV4 | Tour + hộp "?" + sơ đồ quy trình kể ba việc (QT 18, 21) | S1 | mọi user | NV1–NV3 | Must |

## 4. Cross-user handoff map

| Từ | Tới | Cái gì | Điều kiện | Nhận ở |
|---|---|---|---|---|
| U4 | U1 | ảnh cont / seal | U4 đính ảnh | hàng Số cont + seal; U1 đọc số cont / seal từ ảnh để điền (như hiện nay) |
| U1 | U2 | file Lệnh xuất (.docx) | U1 xuất file | gửi ngoài app (Zalo / in); file lưu ở mục Lệnh xuất |

## 5. Flows

### Flow NV1 — Lập Lệnh xuất hàng · owner U1
- **Input:** chuyến chưa hủy; tốt nhất đã có Lệnh sản xuất phát hành gắn chuyến (ba-spec 48) + booking (71).
- **Steps:** mở Lập lệnh xuất ⇒ app điền sẵn (R2–R4) ⇒ U1 gõ số lượng, chọn phân xưởng nhận, chọn Có / Không cho 6 lưu ý ⇒ Lưu & xuất file.
- **Output:** nội dung lưu vào mục Lệnh xuất (sửa / xuất lại được); file `.docx` theo mẫu lưu làm file của mục ⇒ mục **Xong** (R6); nhật ký HĐ "Lập lệnh xuất số …".

### Flow NV2 — Ảnh cont / seal · owner U1 (U4 cùng làm)
- **Input:** chuyến chưa hủy, loại cont / xe tải.
- **Output:** ≥ 1 ảnh `export_files.step = container-seal-photos`; hàng Số cont + seal hiện ảnh, mới nhất đầu. Không đổi điều kiện Xong của hàng (R8).

### Flow NV3 — Lập SI · owner U1
- **Input:** chuyến chưa hủy, loại cont (20RF / 40RF / 40HC-RF).
- **Steps:** mở Lập SI ⇒ app điền sẵn (R10–R12) ⇒ U1 soát, gõ CBM / shipping marks / yêu cầu khác ⇒ Lưu & xuất file.
- **Output:** nội dung lưu vào mục SI; file `.xlsx` theo mẫu lưu làm file của mục ⇒ mục SI **Xong**; nhật ký HĐ "Lập SI …".

### Flow NV4 — Nội dung
- **Output:** tour bước Đóng cont + hộp "?" + sơ đồ `docs/workflows/export-planning.md` nói: Lệnh xuất lập trong app (ô nào tự điền, ô nào gõ), xuất file là Xong; ảnh cont / seal ai đính, không bắt buộc; SI là mục bắt buộc của chuyến cont, nhớ theo khách, xuất file là Xong; chuyến xe tải / đóng ghép SI "Không áp dụng".

## 6. Flow optimization log

| Flow | Candidate | Chọn | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| NV1 | xuất file = Xong · phải đính bản đã ký | **xuất file = Xong** (chủ dự án) | bản ký tay đính thêm được, không chặn | Chủ dự án |
| NV1 | file Word dựng bằng code · điền mẫu Word có thẻ (bộ soạn văn bản, mig 0091) | **mẫu có thẻ** | giữ đúng mẫu QTI-KH-01-07; mẫu đổi ⇒ tải mẫu mới, không sửa code | Optimizer |
| NV1 | số lượng: thùng + kg · chỉ thùng · chỉ kg | **thùng + kg** (chủ dự án) | kho xuất theo thùng, kế toán theo kg | Chủ dự án |
| NV1 | dòng hàng lấy từ Lệnh sản xuất · từ Hàng của chuyến | **LSX trước, thiếu thì Hàng của chuyến** | mẫu ghi "Link Lệnh sản xuất"; MSL / NSX / hạn dùng chỉ có ở LSX | Domain (XK) |
| NV2 | ai đính: Kế hoạch + người đóng hàng (đổi RLS 🔴) · chỉ Kế hoạch | **cả hai** (chủ dự án) | người đóng hàng chụp tại chỗ | Chủ dự án |
| NV2 | ảnh bắt buộc · không | **không bắt buộc** (chủ dự án) | điều kiện Xong giữ số cont + seal hợp lệ | Chủ dự án |
| NV3 | SI ở cuối bước 4 · đầu bước 5 | **cuối bước 4** (chủ dự án) | SI cần số cont / seal, gửi ngay sau đóng | Chủ dự án |
| NV3 | SI bắt buộc · không | **bắt buộc với chuyến cont** (chủ dự án) | không SI thì không có B/L | Chủ dự án + Domain |
| NV3 | consignee / notify gõ mỗi lần · nhớ theo khách | **nhớ theo SI gần nhất cùng khách** (chủ dự án) | khách lặp lại; không cần cột mới ở danh mục khách | Chủ dự án |
| NV3 | gross gõ tay · tính sẵn | **tính sẵn, sửa được; CBM gõ tay** (chủ dự án) | kg cả bì × số kiện đã có ở Hàng của chuyến | Chủ dự án |
| NV3 | SI bắt buộc ⇒ chuyến cũ tụt tiến độ · miễn chuyến cũ | **miễn** (R14) | không làm chuyến đã đủ hồ sơ bỗng thiếu | Domain + Cross-User-Integrity |

## 7. Scope & Priority

- **IN:** NV1–NV4.
- **OUT:** ký số / duyệt Lệnh xuất trong app; gửi SI qua email từ app; đọc ngược B/L draft; mẫu SI riêng theo hãng tàu; người đóng hàng xem Lệnh xuất trong app (vẫn nhận file); tự đặt số lệnh theo sổ.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV1 | nhóm ô gõ tay khi chuyến có LSX + booking | ≤ 3 |
| NV3 | ô gõ tay ở SI thứ hai cùng khách | ≤ 2 |
| NV1, NV3 | file ra khác mẫu (thứ tự ô, nhãn, ô gộp) | 0 chỗ |

## 9. Rules & Invariants

### Lệnh xuất hàng (NV1)

| # | Rule | Edge case |
|---|---|---|
| R1 | Đầu lệnh: Số (gõ, gợi ý số lần trước + 1 nếu có dạng số), ngày lập (mặc định hôm nay, in "Bà Rịa, Ngày … Tháng … Năm …"), Kính gửi: BAN GIÁM ĐỐC · PHÂN XƯỞNG (Đông / Cá / Khô, chọn ≥ 1; mặc định theo lệnh trước của cùng HĐ) · PHÒNG KẾ TOÁN · BỘ PHẬN KHO. | chọn 2 xưởng ⇒ in "PHÂN XƯỞNG ĐÔNG, CÁ" |
| R2 | Dòng hàng: mỗi dòng của Lệnh sản xuất **đã phát hành gắn chuyến** ⇒ 1 dòng: Tên hàng = tên hàng LSX; Size = size dòng HĐ (`contractLineId`); MSL = mã lô của LSX; Ngày sản xuất = các ngày SX của LSX (gộp "12–14/10/2026"); Ngày hết hạn = `expiryDate` của LSX; HS code = `hsCode` dòng HĐ. | chuyến không có LSX ⇒ lấy Hàng của chuyến (tên, size, hạn dùng), MSL = mã lô chuyến, NSX trống để gõ |
| R3 | Số lượng = số thùng (bó) + kg; điền sẵn theo LSX (hoặc kế hoạch của Hàng của chuyến), sửa được. Dòng Tổng cộng = tổng thùng + tổng kg. | 0 dòng ⇒ không xuất file, báo "chưa có hàng" |
| R4 | Thông tin giao hàng lấy theo chuyến lúc xuất file, chỉ xem: Số lượng × Loại container = "1 × 20RF" (loại chuyến); Doc cut-off, VGM cut-off, Thời hạn hạ bãi (71); Cảng hạ = Cảng đến; ETD, ETA. Ngày đóng hàng: mặc định ngày đóng cont của chuyến, sửa được trong lệnh (không ghi ngược vào chuyến). | ô chưa có ⇒ in "…" để điền tay |
| R5 | Lưu ý đóng hàng (theo size · theo ngày sản xuất · hàng mẫu) và Yêu cầu chứng từ (vi sinh · hóa học · khác): mỗi mục Không / Có; Có ⇒ phải ghi rõ. | Có mà trống ⇒ không lưu, báo đúng mục |
| R6 | Lưu & xuất ⇒ file `.docx` đúng mẫu QTI-KH-01-07 lưu làm file mục Lệnh xuất (`step = export-order`) ⇒ mục Xong (luật file sẵn có). Xuất lại ⇒ thêm file mới, bản mới nhất đầu. Bản ký tay đính thêm như cũ. | không có kho file ⇒ tải file về máy + ghi chú thay file (như luật sẵn có) |
| R7 | Mẫu Word là mẫu của bộ soạn văn bản (mig 0091) loại "Lệnh xuất hàng", có mẫu dựng sẵn; quản trị tải mẫu mới thì lệnh sau dùng mẫu mới. | — |

### Ảnh cont / seal (NV2)

| # | Rule | Edge case |
|---|---|---|
| R8 | Ảnh = `export_files.step = container-seal-photos`, gắn chuyến, nhiều ảnh, mới nhất đầu. KHÔNG đổi điều kiện Xong của hàng Số cont + seal (`containerIdentityOk`). | chuyến đóng ghép ⇒ không có chỗ đính |
| R9 | Quyền: `export-plans` tạo / sửa **và** `export-plans.loading` thêm (đổi RLS `export_files` 🔴, như 0097); người đóng hàng thấy ảnh cont / seal ở màn của mình. | — |

### Shipping Instruction (NV3)

| # | Rule | Edge case |
|---|---|---|
| R10 | Mục mới `shipping-instruction` (nhãn "SI") ở bước 4, **ngay sau Số cont + seal** (chị Thảo 2026-11-04, v1.2). Thứ tự R46 (ba-spec 41) thành: booking → thông tin xe → lệnh xuất → số cont + seal (+ ảnh) → **SI** → số lượng thực đóng → ảnh bao bì → sơ đồ → hình ảnh đóng cont → tờ khai; "Còn thiếu" cùng thứ tự. Bắt buộc với chuyến 20RF / 40RF / 40HC-RF; xe tải / đóng ghép ⇒ Không áp dụng tự động. | — |
| R11 | Ô tự điền: Shipper = tên + địa chỉ tiếng Anh (Thông tin công ty, 67); Booking No; Vessel name / Voy No (tách `vesselVoyage` ở khoảng trắng cuối: "BANGKOK BRIDGE" / "0518E(JTI)"); Place of Receipt, Port of Loading, Port of Discharge, Place of Delivery (71); Container / Seal No; Size / Type theo loại chuyến (20RF ⇒ "20' RF"); Description of goods + HS CODE = tên tiếng Anh + `hsCode` từng dòng HĐ của Hàng của chuyến (chuyến gộp nhiều HĐ: từng dòng theo HĐ của nó); No / Kind of packages = tổng thùng (bó) của Lệnh xuất (vd "790 CARTONS"), không có Lệnh xuất ⇒ tổng thực đóng của Hàng của chuyến; Gross weight = Σ kg cả bì mỗi kiện × số kiện thực đóng (chưa có thực đóng ⇒ kế hoạch), sửa được; Measurement (CBM) gõ tay; dòng TOTAL tự cộng. Date mặc định hôm nay. | thiếu kg cả bì một dòng ⇒ gross để trống + cảnh báo dòng nào |
| R12 | Nhớ theo khách: Consignee (lần đầu = tên + địa chỉ khách của HĐ), Notify party, Also notify party, Customers contact, Attn, loại B/L (MASTER / HOUSE; ORIGINAL / SURRENDER / SEAWAY), Payment terms (PREPAID / COLLECT / 3rd COUNTRY + nơi), Shipping marks, Other requests ⇒ lấy từ SI gần nhất của **cùng khách**; sửa ở SI này không đổi SI cũ. | khách chưa có SI ⇒ chỉ Consignee điền sẵn |
| R13 | Lưu & xuất ⇒ file `.xlsx` đúng mẫu SI FORM (giữ ô gộp, nhãn, dấu X cho ô đã chọn) lưu làm file mục SI ⇒ mục Xong. Thiếu số cont hoặc seal ⇒ vẫn xuất được nhưng cảnh báo (SI gửi trước khi có seal là chuyện thường) — mục chỉ Xong khi có file. | — |
| R14 | Chuyến **tạo trước 05/11/2026** (`SHIPPING_INSTRUCTION_SINCE`) mà đã có B/L Xong, hoặc đã xong 4 mục cũ của bước 4 + số cont / seal ⇒ mục SI "Không áp dụng", hàng SI ghi đúng lý do (`shippingInstructionExemption`: `old-bl` · `old-loading`); tiến độ chuyến cũ không đổi. **Vẫn lập SI được** (v1.3): lập xong ⇒ Xong. Xe tải / đóng ghép (`kind`) không có nút lập SI. | chuyến cũ chưa xong bước 4 và chưa có B/L ⇒ SI bắt buộc như chuyến mới |
| R15 | Quyền: lập / xuất Lệnh xuất và SI = `export-plans` tạo / sửa; xem = `export-plans` xem. Người đóng hàng không thấy nội dung Lệnh xuất / SI trong app (RLS `export_step_items` giữ nguyên). | — |
| R16 | Lưu trữ (đổi lúc build 2026-11-04, thay cột JSON): nội dung Lệnh xuất + SI là bản soạn ở `composed_documents` (mig 0091, RLS theo cột `resource = export-plans`) — doc_type `export-order-form` / `shipping-instruction`, nguồn `export-shipment`, khóa khách `customer_key` (R12). Mục SI KHÔNG là dòng `export_step_items`: trạng thái suy từ file `step = shipping-instruction` (như 4a / 4b). Migration 0103 chỉ nới check `export_files.step` + view + RLS ảnh cont / seal (R9). Máy chủ chưa chạy 0103 ⇒ ẩn mục SI + ảnh cont / seal, SI không bắt buộc; Lập lệnh xuất vẫn dùng được (chỉ cần 0091). | — |
| R17 | Bộ demo: một chuyến demo đã đóng có Lệnh xuất + SI + 1 ảnh cont / seal giữ chỗ (QT 15). | — |

## 9b. Kiểm kê nội dung (NV4)

| Khu vực | Mục | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Bước 4 · Lệnh xuất | lập trong app | ô tự điền lấy từ đâu (LSX, HĐ, booking), ô phải gõ, xuất file = Xong, xuất lại thêm bản mới, bản ký tay đính thêm | R1–R7 |
| Bước 4 · Số cont + seal | ảnh | ai đính, không bắt buộc, Xong vẫn theo số cont + seal | R8, R9 |
| Bước 4 · SI | trạng thái | Chưa làm / Xong (có file) / Không áp dụng (xe tải, đóng ghép, chuyến cũ); ô nhớ theo khách; gross tính sẵn, CBM gõ tay | R10–R14 |

## 10. Acceptance Criteria

### AC-1 — Dòng Lệnh xuất từ LSX · NV1 · Test: unit
- **Given** chuyến S gắn 1 LSX phát hành, mã lô "181", ngày SX 12/10 + 14/10, hạn 24 tháng, 2 dòng (dòng HĐ size "2-3 gr/pc", HS "0307.52")
- **When** dựng dòng Lệnh xuất
- **Then** 2 dòng, MSL "181", NSX "12, 14/10/2026" (cách ghi của LSX), hạn "01/10/2028" (`expiryDate`), size + HS theo dòng HĐ
- **Assert** `rows.length == 2` · `rows[0].lotCode == "181"` · `rows[0].hsCode == "0307.52"`

### AC-2 — Không có LSX ⇒ Hàng của chuyến · NV1 · Test: unit
- **Given** chuyến không gắn LSX, có 3 dòng Hàng của chuyến, mã lô chuyến "006"
- **When** dựng dòng
- **Then** 3 dòng, MSL "006", NSX trống
- **Assert** `rows.length == 3` · `rows.every(r => r.productionDates == "")`

### AC-3 — Lưu ý Có phải ghi rõ · NV1 · Test: unit
- **Given** "Hàng mẫu" = Có, ghi rõ trống
- **When** kiểm trước khi lưu
- **Then** 1 lỗi đúng mục
- **Assert** `errors.length == 1` · `errors[0].field == "Hàng mẫu"`

### AC-4 — Xuất file Lệnh xuất ⇒ mục Xong · NV1 · Test: unit
- **Given** mục Lệnh xuất chưa có file
- **When** lưu & xuất (file `step = export-order` thêm vào chuyến)
- **Then** mục Xong
- **Assert** `subStepState(d, S, "export-order") == "done"`

### AC-5 — File Word đúng mẫu · NV1 · Test: integration
- **Given** nội dung lệnh có 2 dòng + booking đủ
- **When** điền mẫu dựng sẵn
- **Then** file mở được, có "LỆNH XUẤT HÀNG", "QTI-KH-01-07", 2 dòng hàng + Tổng cộng, Doc cut-off = "03/11/2026 10:00"
- **Assert** số thẻ chưa thay trong file `== 0` · số dòng bảng hàng `== 3`

### AC-6 — Ảnh cont / seal không đổi Xong · NV2 · Test: unit
- **Given** chuyến có số cont + seal hợp lệ, 0 ảnh; rồi thêm 1 ảnh `container-seal-photos`
- **When** tính hàng Số cont + seal và bước 4
- **Then** như nhau trước / sau
- **Assert** `stepState(…, 4)` trước == sau

### AC-7 — Người đóng hàng đính ảnh cont / seal · NV2 · Test: manual (RLS máy chủ)
- **Given** tài khoản chỉ có `export-plans.loading`
- **When** đính 1 ảnh cont / seal
- **Then** lưu được; đính file booking vẫn bị chặn
- **Assert** số dòng `container-seal-photos` thêm được `== 1`

### AC-8 — SI bắt buộc theo loại chuyến · NV3 · Test: unit
- **Given** chuyến 20RF, chuyến xe tải, chuyến đóng ghép, chưa có SI
- **When** tính mục SI
- **Then** 20RF "not-started"; xe tải + đóng ghép "not-applicable"
- **Assert** `subStepState(d, S20, "shipping-instruction") == "not-started"` · `… S_truck … == "not-applicable"`

### AC-9 — Chuyến cũ không tụt tiến độ · NV3 · Test: unit
- **Given** chuyến có bước 4 Xong trước khi có SI (đủ 4 mục cũ + số cont / seal), không có mục SI
- **When** tính bước 4
- **Then** vẫn Xong
- **Assert** `stepState(d, old, 4) == "done"`

### AC-10 — Ô SI tự điền · NV3 · Test: unit
- **Given** chuyến booking 71 đủ, `vesselVoyage` "BANGKOK BRIDGE 0518E(JTI)", 2 dòng hàng: kg cả bì 11 × 400 kiện và 21.5 × 390 kiện
- **When** dựng SI
- **Then** vessel "BANGKOK BRIDGE", voy "0518E(JTI)", gross 12785, tổng 790 kiện (số — ô G33:G36 của mẫu cộng bằng công thức SUM)
- **Assert** `siTotals(rows).grossKg == 12785` · `siTotals(rows).packages == 790`

### AC-11 — Nhớ theo khách · NV3 · Test: unit
- **Given** khách K có SI cũ (notify "ABC", B/L SURRENDER); chuyến mới của K
- **When** dựng SI mới
- **Then** notify "ABC", B/L SURRENDER; khách khác ⇒ notify trống
- **Assert** `si.notifyParty == "ABC"` · `siOther.notifyParty == ""`

### AC-12 — File Excel đúng mẫu · NV3 · Test: integration
- **Given** SI đủ ô, B/L ORIGINAL, PREPAID
- **When** xuất file
- **Then** sheet "SI Form", ô gộp như mẫu, "X" ở ô ORIGINAL + PREPAID, TOTAL = tổng dòng
- **Assert** số ô gộp `== 47` · `G37 == tổng kiện`

### AC-13 — Lời hướng dẫn · NV4 · Test: unit
- **Given** tour Xuất khẩu + hộp "?"
- **When** đọc lời
- **Then** có "Lệnh xuất", "ảnh cont", "SI"
- **Assert** số chỗ thiếu `== 0`

## 11. Assumptions / Open

- **Đã khác đặc tả lúc build:** R16 (lưu ở `composed_documents`, không cột JSON); số kiện SI ghi số theo từng dòng (mẫu cộng bằng công thức), không ghi "790 CARTONS"; "SI" gửi trước khi có seal vẫn xuất được, chỉ cảnh báo; bộ demo (R17) thêm file SI + ảnh cont / seal giữ chỗ cho mọi chuyến cont lạnh đã đóng (không phải một chuyến) để chuyến demo không tụt bước 4.
- **Assumptions:** (a) phân xưởng nhận chọn tay (mặt hàng chưa có trường xưởng); (b) số Lệnh xuất gõ tay, app chỉ gợi ý; (c) Lệnh xuất in tên hàng tiếng Việt của LSX, SI in tên tiếng Anh của HĐ; (d) mẫu SI là file Excel của chị Thảo nhúng vào app (điền ô bằng exceljs, giữ định dạng); (e) Lệnh xuất / SI là nội dung của mục bước (cột JSON), không phải bảng mới ⇒ không thêm bảng vào DemoBundle; (f) migration số đặt lúc build (origin hiện tới 0101, phiên khác đã có 0102 chưa đẩy).
- **Đã chốt (chị Thảo qua chủ dự án, 2026-11-04):** xuất file Lệnh xuất = Xong · số lượng = thùng + kg · ảnh cont / seal: Kế hoạch + người đóng hàng (đổi RLS) · ảnh không bắt buộc · SI cuối bước 4 · SI bắt buộc, xuất file = Xong · consignee / notify nhớ theo khách · gross tính sẵn, CBM gõ tay.
- **Open (RED):** đổi RLS `export_files` cho ảnh cont / seal (R9) — đã có đồng ý của chủ dự án; build phải xác nhận lại một câu trước khi chạy migration trên DB thật.

## History

- v1 (2026-11-04): khởi tạo từ yêu cầu chị Thảo + 2 file mẫu; chốt 8 câu.
- v1.1 (2026-11-04): ĐÃ BUILD — xem status + "Đã khác đặc tả lúc build".
- v1.2 (2026-11-04): chị Thảo góp ý "chỗ SI là sau bước có cont / seal" ⇒ hàng SI chuyển lên ngay sau Số cont + seal (R10). Migration 0101–0103 người dùng báo đã chạy DB thật.
- v1.3 (2026-11-04): người dùng hỏi vì sao chuyến báo "Không áp dụng — chuyến xong trước khi có mục SI" (mốc 05/11 ⇒ mọi chuyến hiện có là "cũ", nút Lập SI bị ẩn) ⇒ R14: chuyến cũ được miễn vẫn lập SI được, hàng SI ghi rõ lý do.
