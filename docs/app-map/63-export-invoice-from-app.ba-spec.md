# 63 — ba-spec: Hàng của chuyến xuất · số thực đóng của kho · lập Invoice / Packing list từ app

> Load khi: sửa khối Hàng của chuyến, hàng Số lượng thực đóng (bước 4), phần Lập invoice từ app ở mục Commercial Invoice, file Excel Invoice · Packing list · Expiry date list, danh sách Tài khoản ngân hàng.
covers: src/lib/exportInvoice.ts, src/lib/exportInvoiceExcel.ts, src/lib/exportInvoicePdf.ts, src/features/export-planning/ShipmentGoods.tsx, src/features/export-planning/shipmentGoodsLogic.ts, src/features/export-planning/InvoiceComposePanel.tsx, src/features/export-planning/invoiceDocument.ts, supabase/migrations/0096_export_shipment_lines.sql
last_verified: 2026-11-03
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — mig `0096` (bảng `export_shipment_lines`, cột `export_step_items.invoice_composition`, danh sách `bank-account` + 3 tài khoản; ✅ **đã chạy DB thật** (kiểm chỉ-đọc 2026-11-03); kiểm PGlite chuỗi 0001→0096 + chạy lại 2 lần + RLS theo vai đạt — AC-8 phần máy chủ đã thử trên PGlite). Hàm thuần + test `exportInvoice.test.ts` (AC-1…AC-7, vòng tròn dựng ⇄ `parseInvoiceRows`, đọc lại .xlsx bằng exceljs). Thử sandbox 2026-11-02: nhập 2 dòng → điền thực đóng 197 + 150 → lập invoice → file đọc lại ra 347 thùng · 3.470 kg · 36.060 USD; 360px × 130% không tràn. Bổ sung [41](41-export-planning.ba-spec.md) NV7–NV9 + bước 5.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** Zalo 02/11/2026, chị Vi (Phòng Kế hoạch). Ý chính: lô xuất hôm nay phòng tự làm file Excel bên ngoài; muốn nhập thông tin trên hệ thống rồi ra file invoice. Hiện hệ thống chỉ nhập tổng thùng, cần nhập chi tiết nhiều mặt hàng. Các chứng từ khác cũng tải file về được, thêm được thông tin đặc biệt khách yêu cầu. Gửi thêm 2 tài khoản ngân hàng. Ở bước đóng cont, thêm số lượng hàng sau khi đóng để kho điền.
- **Mẫu:** `INV 236.26.XLS` (Gulf Foods — sheet INV, PL, EXP DATE, Sale contract; bó 12/14 kg; khối *NOTE nguồn nguyên liệu), `INVOICE 275.26.pdf` (Kaisei — 2 size chung quy cách, VietinBank).
- **Job:** Nhân viên Kế hoạch nhập hàng của chuyến một lần (từ dòng HĐ đã nối danh mục); kho điền số thực đóng; Phòng KH tải ra bộ Invoice · Packing list đúng mẫu, không gõ lại Excel.
- **Đo thành công:** chuyến có hàng chi tiết ⇒ file Invoice tải về đọc lại bằng chính bộ đọc invoice của app (R27 ba-spec 41) ra đúng số dòng, tổng thùng, kg, tiền (sai lệch 0).

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` ghi + xem giá | nhập hàng của chuyến, lập invoice |
| U4 | Người đóng hàng (thủ kho, quản đốc) | `export-plans.loading` thêm | điền số thực đóng; **không thấy giá** (R10 ba-spec 41) |
| U2 | BGĐ, Kế toán | xem | xem hàng, tải bộ chứng từ (có quyền xem giá) |
| S1 | Hệ thống | — | tính kg, tiền, tổng; dựng file |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Nhập hàng của chuyến | U1 | — | HĐ có dòng hàng (bản đang dùng) | Must |
| NV2 | Điền số thực đóng | U4 | U1 (điền thay được) | NV1 | Must |
| NV3 | Lập invoice + tải bộ chứng từ | U1 | U2 (tải) | NV1 (NV2 không bắt buộc) | Must |
| NV4 | Quản lý danh sách tài khoản ngân hàng | U1 | — | — | Should |

## 4. Cross-user handoff

| Chặng | Từ → Nhận | Điều kiện | Khi không ai nhận |
|---|---|---|---|
| H1 | NV1 U1 → NV2 U4 | chuyến có ≥ 1 dòng hàng | invoice dùng số kế hoạch; hàng Số lượng thực đóng ở "Chưa làm" — **không chặn** bước 4 (R4) |
| H2 | NV2 U4 → NV3 U1 | — | như trên |

## 5. Flows

### NV1 — Nhập hàng của chuyến · U1
- **Input:** chuyến chưa hủy; dòng hàng của bản HĐ đang dùng. Mỗi dòng: số kiện kế hoạch (thùng / bó theo dòng HĐ), kg cả bì / kiện, hạn dùng, tên · size · quy cách in (mặc định chép từ dòng HĐ).
- **Steps:** ghi số kiện cho dòng muốn đóng (trống / 0 = không đóng) → Lưu.
- **Output:** hàng của chuyến = các dòng có số kiện, giữ thứ tự dòng HĐ; dòng đã có giữ id + số thực đóng của kho. Hiện "còn" = số lượng HĐ − chuyến khác − chuyến này.
- **End:** thông báo đã lưu có Hoàn tác; nhật ký HĐ ghi "Cập nhật hàng của chuyến".

### NV2 — Điền số thực đóng · U4
- **Input:** chuyến có hàng; mỗi dòng: số kiện thực đóng (trống = chưa điền).
- **Output:** dòng ghi số + người + giờ điền. Hàng "Số lượng thực đóng" của bước 4: Chưa làm (0 dòng có số) · Đang làm (một phần) · Xong (mọi dòng); câu tóm tắt "Đã điền a/b dòng · n kiện thực đóng (khớp / thiếu x / thừa x so với kế hoạch)".
- **End:** có Hoàn tác. U4 làm ở màn đóng hàng (chuyến ±7 ngày) hoặc U1 ở hồ sơ HĐ.

### NV3 — Lập invoice + tải · U1
- **Input:** mục Commercial Invoice (số, ngày); tài khoản nhận tiền (mặc định tài khoản đầu danh sách); điều kiện giao (trống ⇒ incoterm + cảng đích); dòng dưới tiêu đề (mặc định "Produced in Vietnam"); đơn giá từng dòng (mặc định đơn giá dòng HĐ); thông tin riêng khách yêu cầu (mỗi dòng một hàng, ô tách Tab / "|").
- **Output:** một file `INVOICE <số>.xlsx` gồm sheet INVOICE, PACKING LIST, và EXPIRY DATE khi có dòng ghi hạn dùng; **hoặc** (chủ dự án 2026-11-03) bản `INVOICE <số>.pdf` cùng nội dung, mỗi chứng từ một trang A4 theo bố cục PDF mẫu 275/26 (R9). Phần lập lưu cùng nút Lưu của mục. Ô tổng (thực xuất R7 ba-spec 41) đang trống ⇒ điền theo invoice lập; đã có số khác ⇒ báo, chọn "Dùng số của invoice lập" mới ghi.
- **End:** tải file không thông báo (luật 13 — trình bày); lỗi tạo file thì báo.

## 6. Flow optimization log

| Quyết định | Phương án | Chọn | Lý do |
|---|---|---|---|
| Hàng của chuyến lưu ở đâu | A: JSON trên `export_shipments` · B: bảng riêng | **B** | U4 phải ghi số thực đóng; ghi vào `export_shipments` = đổi RLS bảng đang có (🔴). Bảng riêng + RLS riêng + trigger chặn cột ⇒ 🟡 |
| Giá nằm đâu | A: cột trên dòng chuyến · B: `invoice_composition` của mục CI | **B** | U4 đọc được dòng chuyến; mục bước 5 thì không (policy 0075) ⇒ giữ R10 |
| Dòng chuyến lấy từ | A: danh mục mặt hàng tự do · B: dòng HĐ | **B** | dòng HĐ đã nối danh mục, có đơn giá, kg/thùng; hàng ngoài HĐ ⇒ ghi bản sửa HĐ |
| Số thực đóng chặn bước 4? | có / không | **không** | chuyến cũ chưa có hàng chi tiết không bị kẹt; số tổng thực xuất vẫn theo R7 |
| Tài khoản ngân hàng | A: cứng trong code · B: danh sách chọn 0095 | **B** | sửa / thêm không cần build; `note` = khối in nhiều dòng |

## 7. Scope

- **IN:** NV1–NV4; 3 sheet theo mẫu 236/26 + 275/26.
- **OUT (chờ mẫu):** C/O, H/C, Sale contract từ app; dòng "GRADE A:" (ghi trong Size nếu cần); hàng ngoài HĐ; đổi tên công ty / địa chỉ người bán (hằng `SELLER`).

## 9. Rules

| ID | Luật |
|---|---|
| R1 | Kg tịnh / kiện = (bó ⇒ số thùng/bó) × kg/thùng. Kiện của chứng từ = thực đóng ?? kế hoạch. Tiền dòng = kg × đơn giá, làm tròn 2 số lẻ; tổng tiền = Σ tiền dòng (file 236/26 gõ tay 530,39 ⇒ app ra 1.709,01 thay 1.709,02) |
| R2 | Gom các dòng liền nhau cùng tên (không phân hoa thường) thành một mục có số thứ tự; mọi dòng cùng quy cách ⇒ một dòng "Packing" cuối mục, khác ⇒ sau từng size; một dòng không size ⇒ số in ở dòng tên |
| R3 | Nhãn kiện: toàn bó BDLS / BUNDLES · toàn thùng CTNS / CARTONS · lẫn PKGS / PACKAGES. "Says" đọc tiền tiếng Anh theo tiền tệ (USD, JPY, EUR), có xu ⇒ "and … cents" |
| R4 | Số thực đóng không chặn bước 4 / đủ hồ sơ. Dòng kho đã điền không bỏ được khỏi chuyến (báo lỗi khi lưu) |
| R5 | U4 chỉ đổi được số thực đóng + người / giờ (trigger 0096); không thêm dòng; không đọc giá |
| R6 | Máy chủ chưa chạy 0096 ⇒ ẩn khối Hàng của chuyến / Số thực đóng / Lập invoice; danh sách chọn không đưa tài khoản ngân hàng vào bảng (khỏi kẹt hàng chờ) |
| R7 | Đơn giá sửa ở invoice chỉ lưu trong mục CI; không đổi đơn giá HĐ |
| R9 | **PDF** (`exportInvoicePdf.ts`, `pdf-lib`): vẽ từ CÙNG bảng của file Excel ⇒ hai bản cùng số. Bố cục đo từ PDF mẫu 275/26: logo (`public/invoice-logo.jpg` — 480 px, thu từ logo gốc rõ nét `docs/brand/baseafood-logo-original.jpg`) + tên công ty, kẻ ngang, "Ba Ria, <ngày>" nghiêng canh phải, tiêu đề 22pt + số đóng khung, bảng kẻ lưới (ô cuối dòng tiêu đề phủ các cột con: "IN US. DOLLARS", "TOTAL WEIGHT"; "Trade Terms: CFR" / cảng phủ 2 cột tiền; dòng đơn vị gạch chân; TOTAL đóng khung), "Says" đậm nghiêng, chữ ký công ty bên phải, khối ngân hàng 9pt đóng khung góc trái (chừa chỗ dấu + chữ ký tay). Mỗi chứng từ cố vừa MỘT trang: tràn thì vẽ lại ở 90 % · 82 % · 75 %; vẫn tràn ⇒ sang trang, không mất dòng. Font chuẩn PDF không có chữ Việt ⇒ bỏ dấu khi in. Dấu + chữ ký giám đốc KHÔNG in (ký tay / đóng dấu trên bản in) |
| R8 | Địa chỉ bên mua: có xuống dòng ⇒ theo đó; một dòng dài (ô Địa chỉ của danh mục khách là ô một dòng) ⇒ ngắt theo từ, ≤ 40 ký tự / dòng (`addressLines`) — cột C đã có chữ nên dòng dài bị che. Hướng dẫn người dùng: [ops/export-invoice-user-guide](../ops/export-invoice-user-guide.md) |

## 10. Acceptance Criteria

### AC-1 — Kg / kiện theo thùng hay bó · Maps to: NV1, R1 · Test: unit
- **Given** dòng bó 2 thùng × 6 kg **When** tính kg / kiện **Then** = 12; dòng thùng 10 kg = 10.
- **Assert:** `netKgPerUnit == 12`, `lineNetKg(657 thực đóng × 10) == 6570`.

### AC-2 — Thực đóng thắng kế hoạch · Maps to: NV2, R1 · Test: unit
- **Given** kế hoạch 660, thực đóng 657 **When** tính kg của dòng và tóm tắt chuyến **Then** kg = 6.570; chưa điền ⇒ 6.600.
- **Assert:** `lineNetKg == 6570`; tóm tắt 2 dòng 657+1 so 660+1 ⇒ `complete == true`, `diffUnits == -3`; một dòng chưa điền ⇒ `filledCount == 1`.

### AC-3 — Invoice 275/26 đúng số · Maps to: NV3, R1–R3 · Test: unit
- **Assert:** tổng `{units: 658, netKg: 6580, amount: 42442}`; đúng 1 dòng "Packing:"; "Says: United States Dollars Forty two thousand four hundred forty two only."

### AC-4 — Vòng tròn với bộ đọc invoice · Maps to: NV3 · Test: unit + manual
- **Given** bảng INVOICE dựng ra **When** `parseInvoiceRows` **Then** đọc ra đúng đầu invoice, dòng và tổng.
- **Assert:** `invoiceNo == "275/26"`, `issuedOn == "2026-11-02"`, 2 dòng, `totals == {cartons: 658, netKg: 6580, amount: 42442}`; .xlsx đọc bằng exceljs ô tổng tiền `== 42442`. Sandbox: file tải trong trình duyệt đọc bằng `readInvoiceFile` ra 347 · 3.470 · 36.060.

### AC-5 — 3 tài khoản ngân hàng, chưa chạy 0096 không đẩy lên bảng · Maps to: NV4, R6 · Test: unit
- **Assert:** 3 id `bank-account-*`; `effectiveExportOptions(rows, true, false)` có 0 tài khoản.

### AC-6 — Dòng thiếu số · Maps to: NV3 · Test: unit
- **Given** 1 dòng thiếu đơn giá **When** dựng invoice **Then** dòng đó báo thiếu, không cộng tiền.
- **Assert:** `incompleteLineIds == ["b"]`, `totals.amount == 42376.5`.

### AC-7 — Packing list N.W / G.W + Expiry list · Maps to: NV1, NV3 · Test: unit
- **Given** bó 12 kg tịnh / 14 kg cả bì, 20 bó, một dòng có hạn dùng **When** dựng bộ chứng từ **Then** packing list ghi N.W / G.W và thêm Expiry date list.
- **Assert:** hàng packing list `== ["12kgs/14kgs", 20, 240, 280]`; số sheet `== 3`.

### AC-8 — Người đóng hàng chỉ điền số thực đóng · Maps to: NV2, R5 · Test: manual (DB thật sau khi chạy 0096)
- **Given** tài khoản chỉ có `export-plans.loading` **When** đổi `planned_units` qua API **Then** máy chủ từ chối; đổi `loaded_units` ⇒ được.
- **Assert:** lỗi chứa "chỉ điền được số thực đóng" (1 lần); `loaded_units` sau ghi `==` số vừa gửi; thêm dòng mới ⇒ lỗi "không thêm được".

### AC-9 — Bản PDF theo mẫu · Maps to: NV3, R9 · Test: unit + manual
- **Given** chuyến 275/26 **When** tải PDF **Then** mỗi chứng từ một trang, đủ chữ và số của mẫu; 15 size vẫn vừa một trang / chứng từ; 60 size thì sang trang mà không mất dòng.
- **Assert:** số trang `== 2` (275/26), `== 3` (15 size + hạn dùng); trang 1 chứa "42,442.00", "6,570.00", "Please make TT to:"; 60 size ⇒ có "ITEM 59" và "3,000.00". Thủ công 2026-11-03: vẽ PDF ra ảnh so cạnh PDF mẫu; nút trong app ra file `%PDF` ~14 KB có logo.

## 11. Assumptions / Open

- A1. Bên mua in theo danh mục khách (tên + địa chỉ, mỗi dòng địa chỉ một dòng in) — khách chưa ghi địa chỉ thì in trống.
- A2. Ngày "Shipment on/about" = ETD ?? ngày đóng cont; B/L lấy số của mục B/L của chuyến.
- A3. Chị Vi nói có ghi chú các trường trên file, nhưng file nhận được không có comment — chờ chị xác nhận trường nào còn thiếu.
- A4. Chứng từ khác (C/O, H/C, Sale contract) chưa có mẫu ⇒ chưa tạo file.
- A5. Tổng tiền = Σ tiền dòng đã làm tròn 2 số lẻ (in ra cộng khớp). File Excel cũ 236/26 cộng tiền CHƯA làm tròn rồi mới làm tròn (36.249,71 thay vì 36.249,70) — chờ phòng KH chọn cách.

## History
- 2026-11-02 — v1 tạo + build (Zalo chị Vi).
- 2026-11-03 — 0095 + 0096 đã chạy DB thật (kiểm chỉ-đọc); R8 ngắt địa chỉ; viết hướng dẫn thao tác.
- 2026-11-03 — R9 + AC-9: tải bản PDF theo mẫu 275/26 (chủ dự án).
