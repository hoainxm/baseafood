# Phòng Kế hoạch — module Xuất khẩu (kế hoạch trước khi build)

> **Load khi:** chuẩn bị xây khu **Phòng Kế hoạch** (Xuất khẩu · Nhập khẩu · Khác), màn Xuất khẩu theo **tháng × khách hàng × hợp đồng**, chuỗi bước hợp đồng → lệnh sản xuất → bao bì → đóng cont (ảnh · sơ đồ container · tờ khai) → bộ chứng từ → khác, kiểm "bộ hồ sơ khép kín".
> **Trạng thái:** ✅ **ĐÃ CHỐT 2026-10-20** (11 câu §9) — chưa code, chưa migration. ba-spec đợt 1: [`app-map/41-export-planning.ba-spec.md`](../app-map/41-export-planning.ba-spec.md) — ✅ **đợt 1 ĐÃ BUILD 2026-10-20** (`/planning-export`, mig `0075` ⏳ chưa chạy DB thật). Tiếp: chạy thử song song tháng 10 → đợt 2.
> **Kế thừa:** [`phong-ke-hoach-quan-ly-don-hang.md`](phong-ke-hoach-quan-ly-don-hang.md) (dự thảo 2026-10-19, trục "một HĐ = một hồ sơ", 4 đợt theo QTI-KH-01). File này **thay §4 (kế hoạch đợt) của spec đó cho phần Xuất khẩu**. Các câu §5 của spec đó vẫn còn hiệu lực.
> **Nguồn:** yêu cầu chủ dự án 2026-10-20 · quy trình [`QTI-KH-01`](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) · đọc trọn thư mục "HỒ SƠ XUẤT KHẨU - SCM" (25 file, khách SEACHEMOT) 2026-10-20 · kiểm kê code `main` @ `495ede2`.
> **last_verified:** 2026-10-20

---

## 1. Yêu cầu (chủ dự án 2026-10-20)

1. Phòng Kế hoạch có **3 hạng mục: Xuất khẩu · Nhập khẩu · Khác**. Làm **Xuất khẩu trước**, hai mục kia để sau.
2. Xuất khẩu tổ chức theo **tháng** → trong tháng có **khách hàng** (lấy danh mục khách đã có) → mỗi khách có **hợp đồng**. Mỗi tháng có kế hoạch xuất khẩu (file sẽ bổ sung).
3. Mỗi hợp đồng đi theo trình tự: **Hợp đồng → Lệnh sản xuất → Bao bì → Hình ảnh / Sơ đồ container / Tờ khai → Bộ chứng từ → Khác**.
4. Mục tiêu: **sơ đồ khép kín** — nhìn vào biết hợp đồng nào đã xong trọn bộ, hợp đồng nào còn thiếu bước nào.

---

## 2. Hiện trạng app: cái đã có, cái dùng dở, cái tái dùng được

### 2a. Module đã build nhưng chưa dùng hết / dùng lệch

| Module | Tình trạng thật | Hệ quả với Xuất khẩu |
|---|---|---|
| **Đơn đặt `/orders`** (`SalesOrderScreen.tsx`) | Đơn = khách + ngày + dòng mặt hàng × quy cách × kg × block → lệnh xuất FIFO từ tồn BTP → tự sinh phiếu bán XK → quét kiểm lô. **Lệnh xuất tạo ra là đóng luôn** (`status: "closed"`), không duyệt BGĐ (trái KH-R4). Giá trị `open` của `export_orders` chưa bao giờ dùng. Đơn **không sửa được**, không có hạn giao (tooltip nói "hạn giao" nhưng form không có ô). Xóa đơn để lại `export_orders`/`export_items`/phiếu bán mồ côi. | Là "khúc giữa" duy nhất có sẵn. Gắn vào chuyến bằng cột nullable, **không đổi nghĩa** trạng thái cũ. |
| `/orders` — quyền | Thủ kho **không vào được** `/orders`, nhưng nút "Kiểm lô bằng quét" lại dành cho người thực xuất. Link từ `/qr` → `/orders` đá thủ kho về trang chủ. | Bước đóng cont phải cho thủ kho/PX Đông làm được phần của họ. |
| Lệnh xuất lấy từ **tồn BTP** (`computeWipStock`), không từ TP đã đóng gói | Bước đóng gói `/packaging` không nối được vào xuất khẩu. Đổi sang TP là 🔴 (đụng tồn, NXT, chống đếm đôi). | Đợt đầu **không đổi**; bao bì ở module này là **mẫu thùng + đặt in**, không phải phiếu đóng gói. |
| Kênh "Xuất khẩu" ở `/sales` gõ tay được | Song song với phiếu tự sinh từ `/orders` ⇒ nguy cơ đếm đôi doanh số XK (câu C9 chưa chốt). | Giữ nguyên, ghi vào câu cần chốt. |
| **Báo cáo `/export-report`** | Đã có lọc **tháng + khách**, xuất Excel/A4 — nhưng chỉ có số khi `/orders` có lệnh xuất. | Tái dùng khung lọc kỳ tháng + `PrintSheet`/`exportAoaToXlsx` cho màn tháng. |
| **Tài liệu công ty `/documents`** | Đợt 1 chạy. Cột duyệt (`in_review`, `pending_approval`, `reviewer_id`, `approver_id`, `return_reason`) **có nhưng chưa có UI**. 8 biểu mẫu QTI-KH-01 seed với chủ sở hữu `planning`. | Biểu mẫu trống (LSX, LXH…) lấy từ đây. Cơ chế file + phiên bản không ghi đè tái dùng được. |
| **Phòng ban `planning`** (`lib/documents.ts`) | Có phòng ban, **chưa vai trò hệ thống nào thuộc phòng này** ⇒ 8 biểu mẫu KH chỉ admin + BGĐ xem được. | Cần vai trò "Phòng Kế hoạch" trước tiên. |
| **Ảnh QC `/qc`** | Ảnh minh chứng **đã chạy** (bucket `qc`, nén JPEG, `photo_paths` jsonb). Comment đầu file "ảnh để sau" đã cũ. | Tái dùng `compressImage`/`uploadImage` + component ảnh cho ảnh đóng cont. |
| **Việc của tôi `/my-tasks`** | Chạy, có mẫu nguồn việc thứ hai (`buildDocumentWarnings`). | Nhắc hạn xuất / thiếu chứng từ đi qua đây — không dựng chuông thứ hai. |
| **Danh mục khách** | Chỉ có `id · code · name · market`. | Thiếu quốc gia, địa chỉ, cảng đích, điều kiện thanh toán, liên hệ — cần cho hợp đồng/chứng từ. |
| `sales_orders.status = "complete"` | Chỉ đặt tay bằng nút "Xác nhận đủ", không suy từ số. | — |

### 2b. Tái dùng theo từng bước của chuỗi

| Bước | Đã có | Phải thêm |
|---|---|---|
| Tháng × khách | Kỳ tháng + lọc khách (`OrderExportReport`), `RecordTable` + `rowMarkKey`, `StatCardGrid` | Lưới tháng → khách → HĐ → chuyến, cột tiến độ 6 bước |
| Hợp đồng | Không (chỉ `sales_orders` không có số HĐ, giá, điều khoản) | Bảng HĐ + dòng hàng + các lần sửa (rvs) + file ký |
| Lệnh sản xuất | Không (màn trưng bày đã gỡ 2026-10-12). `/wip` có `customer_name`, `operator` | Bảng lệnh SX theo lô (MSL), dòng gắn dòng HĐ, in theo mẫu QTI-KH-01-04 |
| Bao bì | `packagings` là **đóng gói BTP→TP**, khác nghĩa | Mẫu thùng theo khách × mặt hàng, phiên bản có duyệt, đợt đặt in |
| Ảnh | `lib/storage.ts` (nén, tải, link có hạn) | Ảnh gắn chuyến + số lớp, ảnh seal, ảnh số cont |
| Sơ đồ container | Không. Gần nhất: `ExportLotCheck` (quét tem khi xếp xe → `lot_dispatches`) | Bảng lớp × mặt hàng, nhập từ file `.xls` container plan |
| Tờ khai | Không | Số + ngày + file (không làm VNACCS) |
| Bộ chứng từ | `lib/documentStorage.ts` (tải/đọc file, 20 MB, `FilePreviewDialog` xem PDF trong app) | Chứng từ theo chuyến: loại · số · ngày · tổng số liệu · file + **đối chiếu tự động** |
| Duyệt BGĐ | Hành động `approve` trong `PERMISSION_ACTIONS` (đang dùng cho kho) | Tài nguyên mới có `approve` cho BGĐ |
| Nhắc hạn | `/my-tasks` (`FlowWarningKind`, `DUE_OFFSET_DAYS`, `taskRequirements`) | `buildExportWarnings` + loại việc mới + test |
| Hạ tầng | `useFormDraft`/`useDialogDraft`, `TableMapping`, `DemoBundle`, audit log, trigger 0065 | Khai đủ cho từng bảng mới |

---

## 3. Đọc bộ hồ sơ SCM: điều thực tế dạy cho thiết kế

### 3a. Thư mục gửi KHÔNG phải một bộ

| File | Thuộc về |
|---|---|
| `DOCUMENTS (INV 234.26).pdf` · `CONTAINER PLAN SEACHEMOT 165 25-09-2026.xls` · `PICTURES (INV 234.26).zip` | **Một chuyến thật: lô (MSL) 165**, cont SZLU9522312 / seal VN50853AT, đóng 25/09/2026, tàu chạy 26/09 |
| Hợp đồng `18.26/BSF-SCM.2026` (Order #B182, ký 30/07, sửa 12/08/2026) | **Không chứng minh được** là HĐ của INV 234/26 (xem §3e) |
| Lệnh SX số 17.09 (29/09/2026, **lô 181**) | Chuyến **sau** lô 165 — khớp HĐ 18.26 gần như từng dòng (giả thuyết) |
| Lệnh xuất hàng số 02.01 (06/01/2026) | Chuyến tháng 01/2026 — chỉ dùng làm mẫu cấu trúc |
| `KE HOACH XUAT HANG 02 2025.xlsx` | Sổ kế hoạch **toàn xưởng, mọi khách**, 01/2025 → 07/2026; không có lô 165/181 |
| 14 PDF thùng carton | Bản vẽ in thùng của khách SCM theo **đợt đặt in** 19/5, 7/7, 26/8 |

⇒ Để làm oracle "khép kín" cần **một bộ cùng chuyến**: HĐ của INV 234/26 + LSX lô 165 + LXH + tờ khai + C/O form VJ (xem câu Q9).

### 3b. Cấu trúc thật của chuỗi — HĐ và chuyến là hai tầng khác nhau

```
Khách ─┬─ Hợp đồng (khung giá, dung sai ±10%, hạn giao, chứng từ yêu cầu)
       │     └─ 1..n CHUYẾN  (= 1 container, 1 mã lô MSL, 1 booking, 1 invoice + invoice mẫu "M")
       │           ├─ Lệnh SX theo lô (ngày ISO, HSD, màu keo/đai, mã túi)
       │           ├─ Lệnh xuất (phân hàng vào cont)
       │           ├─ Đóng cont: container plan (lớp × mặt hàng) + ảnh từng lớp + seal + số cont
       │           ├─ Tờ khai
       │           └─ Bộ chứng từ: Invoice · Packing list · H/C · Expiry list · B/L · C/O …
       └─ Mẫu thùng (dùng chung nhiều HĐ) ─ phiên bản (khách duyệt) ─ đợt đặt in
```

- Sổ kế hoạch tháng của xưởng: **mỗi dòng là một cont/chuyến**, gom theo tuần; cột: CONT (20/40/40+20/Xe tải/Đóng ghép) · Khách · Mặt hàng · Lượng · **MSL** · Cảng đến · **Booking** · Ngày đóng · ETD · Đơn giá · **Bao bì** (Đã xong/OK/Dự kiến…) · Thực xuất kg · USD. Mỗi tháng **12–39 chuyến, 9–20 khách**; SCM 1–4 cont/tháng.
- Sổ đó **không có số HĐ, không có số invoice**. Chuyến nối chứng từ chỉ qua **khách + MSL + booking + ngày đóng**. Một cont có thể gộp 2 lô ("216+006"), một lô có thể trải nhiều cont (SCM 147: 3 cont).
- Lệnh SX và lệnh xuất **cũng không ghi số HĐ**. Invoice 234/26 cũng không. ⇒ **App phải tự giữ liên kết HĐ ↔ chuyến ↔ lô ↔ invoice** — đây là giá trị lớn nhất của module.
- **Tháng** trong sổ của xưởng là tháng **đóng cont / ETD**, không phải tháng ký HĐ.

### 3c. Bất biến đối chiếu — cơ sở để app tự nói "bộ đã khép kín"

| # | Bất biến | Ví dụ lô 165 |
|---|---|---|
| B1 | Cùng định danh trên mọi chứng từ của chuyến: invoice no., B/L no., tàu/chuyến, POL/POD, số cont, seal, lô, người nhận | 234/26 · PAPTYO260926224 · SZLU9522312/VN50853AT · lô 165 |
| B2 | Σ thùng và Σ kg tịnh: Invoice = Packing list = H/C = Expiry list, khớp **từng dòng** | 2.251 thùng · 22.214 kg |
| B3 | Từng dòng: tịnh = thùng × kg tịnh/thùng; cả bì = thùng × kg cả bì/thùng | — |
| B4 | Tiền dòng = kg × đơn giá; Σ = tổng invoice | 194.557,60 USD |
| B5 | **B/L = invoice thương mại + invoice mẫu "M"** (thùng, tịnh, cả bì) | 2.251+1 = 2.252 · 22.214+13,8 = 22.227,8 · 25.086+16 = 25.102 |
| B6 | Container plan: Σ cột từng mặt hàng = số thùng trên Packing list **sau quy đổi kiện → thùng** | plan 2.152 + 100 (karaage 1 kiện = 2 thùng) = 2.252 |
| B7 | Ảnh: số lớp + số thùng mỗi lớp = dòng plan; số cont/seal trên ảnh = chứng từ | 25 ảnh lớp + 1 seal + 1 cửa cont |
| B8 | HSD = tháng SX + 24 tháng, về ngày 01; Expiry list = plan = LSX | lô 165 → 2028/09/01 |
| B9 | **HĐ ↔ chuyến**: cùng incoterm, cảng, đơn giá theo mặt hàng/size; Σ kg, Σ tiền trong **±dung sai**; ETD ≤ hạn giao; loại cont đúng | — |
| B10 | Đủ danh sách chứng từ HĐ yêu cầu | HĐ 18.26: Invoice · PL · B/L · H/C · **C/O form VJ** |
| B11 | Màu keo/đai từng mặt hàng: LSX = plan (ổn định qua các lô) | chần 2-3 = keo trong/đai xanh dương … |

**Lệch thật trong bộ lô 165** (đúng loại lỗi app phải bắt): Packing list dòng 8 ghi size "8-15" cho cả hai dòng trong khi Invoice ghi 15-25 và 8-15 · H/C ghi karaage "1KG/PE ×10/CTN" trong khi Invoice/PL ghi 6 kg/thùng · thiếu C/O form VJ trong bộ. Ngoài bộ: mã HS dòng 9 HĐ thiếu một chữ số; LSX ghi "=200 thùng" mà cột khối lượng "100 thùng"; LXH còn ngày đóng 13/08/2025 sót từ mẫu cũ; sổ kế hoạch tháng 05 và 07/2026 chép lại dòng tháng 4.

### 3d. Bao bì trong thực tế là gì

- Mỗi PDF là bản vẽ trải phẳng **một mẫu thùng**: kích thước D×R×C, loại giấy (vàng/trắng, 5 lớp), số màu in, cách in (in máy / in lụa), logo khách, tên hàng tiếng Nhật, ô tick size, nhãn thực phẩm Nhật + bảng dinh dưỡng, NET WT. **Mã lô/ngày SX không in sẵn** — đóng dấu lúc đóng hàng.
- Ngày trong tên file là **đợt đặt in** (7.7: đủ 11/11 mẫu; 26.8: 2 mẫu của đợt 5; 19.5: bản cũ). Ghi chú "SL: N T" là số thùng đặt in. Cùng một mẫu thùng có **nhiều phiên bản** (2 râu: 19.5 và 7.7; karaage 6 kg → 10 kg "NEW").
- LSX có ô "Dự kiến có đầy đủ bao bì: Đã có sẵn"; sổ kế hoạch có cột "Bao bì". ⇒ Bước **Bao bì = trả lời được "thùng đã duyệt mẫu và đã in đủ cho chuyến này chưa"**.

### 3e. Đơn vị đếm trộn lẫn

HĐ, LSX, LXH, plan trộn **thùng (CTN)** và **kiện/bó (BDL)**: xiên que 1 bó = 2 thùng 4 kg; karaage plan đếm kiện, chứng từ đếm thùng. ⇒ Mỗi dòng hàng cần `unit_kind` (thùng/kiện) + số thùng mỗi kiện + kg tịnh/kg cả bì mỗi thùng.

---

## 4. Thiết kế đề xuất

### 4a. Khung điều hướng

Nhóm nav mới **"Kế hoạch"** (chỉ hiện với ai có quyền):

| Mục | Route đề xuất | Đợt |
|---|---|---|
| Xuất khẩu | `/planning/export` | đợt 1 |
| Nhập khẩu | `/planning/import` *(chữ "Nhập khẩu" ≠ "Nhập hàng" NL ở `/imports` — phải tách rõ nhãn)* | sau |
| Khác | `/planning/other` | sau |
| Mẫu thùng | `/planning/cartons` (hoặc tab trong Xuất khẩu) | đợt 2 |

`/orders` (Đơn đặt) giữ nguyên chỗ cũ ở đợt đầu; về sau thành một bước bên trong chuyến (xem Q8).

### 4b. Ba màn chính

**Màn 1 — Xuất khẩu theo tháng** (`/planning/export?month=2026-10`) — thay sổ Excel "Kế hoạch xuất hàng".
- Đầu trang: chọn tháng ‹ › · ô lọc khách · 4 thẻ số: số chuyến · đã khép kín · đang thiếu bước · trễ hạn giao.
- Bảng gom theo **khách** (nhóm gập/mở, dòng tổng mỗi khách); mỗi dòng là **một chuyến**: HĐ · MSL · loại cont · ngày đóng · ETD · kg kế hoạch / thực xuất · **6 ô tiến độ** (HĐ · Lệnh SX · Bao bì · Đóng cont · Chứng từ · Khác) dạng chấm: ✓ xong · ◐ đang làm · ! thiếu/lệch · — không áp dụng.
- Khách có HĐ trong tháng nhưng chưa có chuyến ⇒ hiện dòng "chưa lên chuyến".
- `rowMarkKey="export-plan:<tháng>"`, cuộn ngang 2 thanh, Excel/In giống bố cục sổ cũ (đổi sang nhờ chạy song song được).

**Màn 2 — Hồ sơ hợp đồng** (mở từ dòng chuyến hoặc danh sách HĐ của khách).
- Đầu: số HĐ · bản sửa · khách · incoterm · cảng · thanh toán · dung sai · hạn giao · trạng thái · thanh **6 bước** bấm được.
- Khối "Dòng hàng" (mặt hàng · size · quy cách · đơn vị · số thùng · kg · đơn giá · tiền · yêu cầu vi sinh).
- Khối "Chuyến của HĐ" (tổng đã xuất / còn lại so dung sai). **HĐ chỉ có 1 chuyến ⇒ gộp luôn các bước chuyến vào trang này** — đúng sơ đồ chủ dự án đưa (HĐ → LSX → bao bì → …), chỉ tách tầng khi HĐ có ≥2 chuyến.
- Khối "File HĐ": các lần sửa (rvs) xếp dọc, **không ghi đè** (KH-R7), file ký 2 bên.

**Màn 3 — Chuyến** (các bước sau HĐ): mỗi bước một thẻ có trạng thái + người làm + ngày + file + nút "Đánh dấu xong" khi bước không tự suy được.

### 4c. Nội dung từng bước + điều kiện "xong"

| Bước | Ghi gì | Xong khi (máy tự suy nếu được) |
|---|---|---|
| **1. Hợp đồng** | Số, ngày, bản sửa, Order ref, incoterm, POL/POD, thanh toán (TTR/L/C, % cọc), dung sai, hạn giao muộn nhất, số + loại cont, **danh sách chứng từ yêu cầu**, dòng hàng, yêu cầu vi sinh, file ký | Có file ký + BGĐ duyệt (hoặc ghi kết quả duyệt giấy — Q4) |
| **2. Lệnh SX** | Số lệnh, ngày, **MSL**, dòng (trỏ dòng HĐ): số thùng/kiện, kg, ngày ISO đóng thùng, HSD, màu keo + màu đai, mã túi BSF, mã vạch JAN, phiên bản thùng; ngày giao; nơi nhận (Kỹ thuật · Kho · Phân xưởng); in đúng mẫu QTI-KH-01-04 | Phát hành sau khi HĐ duyệt (KH-R8) + 3 nơi đã xem/xác nhận (Q-QTI-9) |
| **3. Bao bì** | Mỗi dòng LSX chọn **phiên bản thùng đã khách duyệt**; đợt đặt in (ngày, nhà in, số thùng); ghi chú "đã có sẵn" | Mọi dòng có phiên bản đã duyệt + Σ thùng đã in ≥ số thùng cần (hoặc đánh dấu tay "kho đủ") |
| **4a. Sơ đồ container** | Booking, tàu/chuyến, số cont, seal, loại cont, ngày đóng, ETD/ETA, POL/POD; plan lớp × mặt hàng (**nhập file `.xls` plan**), màu keo/đai | Có số cont + seal + plan; B6 khớp |
| **4b. Hình ảnh** | Ảnh từng lớp (gắn số lớp), ảnh seal, ảnh số cont, ảnh khác; nạp nhiều ảnh một lần (cả file zip từ Zalo) | Đủ ảnh cho mọi lớp của plan + ảnh seal + ảnh cont (B7, gắn số lớp tay — không OCR ở đợt đầu) |
| **4c. Tờ khai** | Số tờ khai, ngày, chi cục, file | Có số + file |
| **4d. Lệnh xuất** | Nối lệnh xuất ở `/orders` (cột nullable) — **có BGĐ duyệt** (KH-R4) | Lệnh xuất đã duyệt |
| **5. Bộ chứng từ** | Checklist sinh từ "chứng từ yêu cầu" của HĐ; mỗi chứng từ: loại · số · ngày · tổng thùng / tịnh / cả bì / tiền · dòng (nếu cần) · file | Đủ danh sách B10 + đối chiếu B1–B9 không lỗi, **hoặc** lỗi được chấp nhận có lý do |
| **6. Khác** | Gửi bộ chứng từ cho khách (ngày, cách gửi), tiền về (kế toán hoặc phòng KH ghi — Q5), khiếu nại, file khác | **Không chặn khép kín** (Q5) |

**Khép kín:**
- **Chuyến** khép khi bước 2 → 5 xong.
- **HĐ** khép khi mọi chuyến khép **và** Σ thực xuất nằm trong dung sai — hoặc có phụ kiện giảm lượng / gia hạn được khách xác nhận (KH-R11).
- Hết hạn lưu 2 năm ⇒ **chỉ đánh dấu**, không xóa (Q-QTI-5).

### 4d. Đối chiếu tự động — `lib/exportDossierCheck.ts` (hàm thuần, có test)

- Vào: HĐ + dòng, chuyến, plan, các chứng từ có số liệu. Ra: danh sách lệch (mức lỗi / cảnh báo) theo B1–B11.
- **Oracle test = bộ lô 165** (số đã có ở §3c): B5 và B6 phải **khớp**; phải bắt đúng **2 lệch** (size PL dòng 8, quy cách karaage trên H/C) và **thiếu C/O**.
- Số liệu chứng từ **gõ tay tổng + dòng** ở đợt đầu (đọc từ PDF scan không chắc chắn). Đọc Excel invoice/PL nếu xưởng có bản Excel gốc — đợt sau.

### 4e. Dữ liệu (dự kiến — tên theo luật 8, chốt lại ở ba-spec)

| Bảng | Nội dung chính |
|---|---|
| `customers` (+cột nullable) | `country`, `address`, `default_port`, `payment_terms`, `contact_name`, `contact_email` |
| `export_contracts` | `customer_id`, `contract_no`, `revision_no`, `signed_on`, `order_ref`, `incoterm`, `port_of_loading`, `port_of_discharge`, `payment_terms`, `tolerance_pct`, `latest_shipment_date`, `container_count`, `container_type`, `required_documents` (jsonb), `status`, `approved_by/at` |
| `export_contract_items` | `contract_id`, `line_no`, `product_id` (nullable — tên khách thường khác tên nội bộ), `description`, `hs_code`, `size`, `packing`, `unit_kind`, `cartons_per_unit`, `net_kg_per_carton`, `quantity_units`, `quantity_kg`, `unit_price`, `currency`, `micro_spec` |
| `export_shipments` | `contract_id`, `plan_month`, `lot_code` (MSL), `booking_no`, `vessel_voyage`, `container_no`, `seal_no`, `container_type`, `loading_date`, `etd`, `eta`, `invoice_no`, `bl_no`, `customs_declaration_no/date`, `export_order_id` (→ `/orders`, nullable), `step_status` (jsonb: bước làm tay) |
| `production_orders` + `production_order_items` | lệnh SX theo chuyến/lô: số, ngày, HSD, ngày giao, nơi nhận đã xác nhận; dòng trỏ `export_contract_items`, ISO date, màu keo/đai, mã túi, JAN, `carton_design_version_id` |
| `carton_designs` · `carton_design_versions` · `carton_print_orders` (+items) | mẫu thùng theo khách × mặt hàng; phiên bản (file PDF, trạng thái nháp → gửi khách → khách duyệt → khóa); đợt in (ngày, nhà in, số thùng). **Tên `carton_*` để khỏi nhầm `packagings` (đóng gói BTP→TP).** |
| `container_load_layers` | `shipment_id`, `layer_no`, `contract_item_id`, `units` (+ màu keo/đai ở cấp mặt hàng) |
| `export_documents` (+`export_document_lines`) | `shipment_id`, `kind` (commercial-invoice · packing-list · bill-of-lading · health-certificate · certificate-of-origin · expiry-list · sample-invoice · customs-declaration · other), `number`, `issued_on`, `issuer`, Σ thùng / tịnh / cả bì / tiền, `file_path`, `accepted_mismatch_reason` |
| `export_files` | file và ảnh gắn bất kỳ bước nào: `owner_kind`, `owner_id`, `step`, `file_path`, `layer_no`, `caption` |

- Storage: **bucket riêng `export-files`** (private), quyền theo tài nguyên mới — **không** dùng chung bucket `documents` (policy của nó gắn `document_versions` + phòng ban; nới ra là 🔴).
- Không khóa ngoại cứng (khuôn `task_assignments`/`company_documents`), khai `refColumns` cho chế độ demo.
- Liên kết `/orders`: chỉ thêm cột nullable `export_orders.shipment_id` (hoặc ngược lại `export_shipments.export_order_id`) — đơn cũ không hồ sơ vẫn chạy.

### 4f. Người dùng và quyền

| Người | Làm gì |
|---|---|
| **Nhân viên phòng KH** (vai trò mới, phòng ban `planning`) | Toàn bộ HĐ, LSX, bao bì, chuyến, chứng từ, file |
| **BGĐ** | Duyệt HĐ, lệnh xuất (KH-R4); xem mọi thứ |
| Kế toán / KTT | Xem HĐ, chứng từ, giá; ghi bước "tiền về" (phòng KH cũng ghi + theo dõi được — Q5) |
| Kỹ thuật · Kho · Phân xưởng | Xem lệnh SX **không giá** (C11), bấm "đã nhận" |
| Thủ kho / PX Đông | Bước đóng cont: chụp ảnh lớp, seal, nhập plan khi cần (quyền ghi riêng phần này). Phòng KH cũng làm được — không khóa theo người (Q7) |

- Tài nguyên mới `export-plans` (view · create · update · delete · approve · export · view-price), mặc định **cấm**, cấp qua migration thay ma trận mặc định (khuôn `0073`) — 🔴 đổi ma trận quyền đang dùng: **chủ dự án đã đồng ý 2026-10-20 (Q11)**.
- Biểu mẫu QTI-KH-01 trong `/documents` mở cho phòng `planning` ngay khi có vai trò.

### 4g. Nhắc hạn (qua `/my-tasks`)

Loại việc mới (hàm thuần `buildExportWarnings`, test): HĐ chưa duyệt · LSX chưa phát hành khi còn ≤ N ngày tới ngày đóng · bao bì chưa đủ · sắp/đã quá hạn giao HĐ (KH-R11) · đã đóng cont mà thiếu chứng từ sau N ngày · đối chiếu còn lỗi. N chốt ở ba-spec.

---

## 5. Lộ trình build (đề xuất)

| Đợt | Phạm vi | Giá trị ngay | Đụng module cũ | Tier |
|---|---|---|---|---|
| **0 · Chuẩn bị** (không code) | Chốt §9 · xin **một bộ hồ sơ cùng chuyến** + bản Excel gốc của invoice/PL/plan nếu có · bổ sung từ điển §2b (hợp đồng, chuyến, lệnh SX, mẫu thùng, chứng từ XK) · ba-spec ở `app-map/` | — | — | 🟢 |
| **1 · Khung tháng × khách × HĐ + checklist tay** | Vai trò phòng KH + tài nguyên quyền · mở rộng khách · HĐ + dòng hàng + bản sửa + file · chuyến (MSL, booking, cont, seal, ngày) · **6 bước dạng checklist tay + đính file** cho mọi bước · Màn 1 + 2 · số liệu bắt đầu từ 10/2026 (Q6) | Bỏ kẹp giấy: mọi file của một HĐ ở một chỗ, nhìn tháng biết thiếu gì | `customers` (cột nullable) · ma trận quyền | 🟡 (+🔴 ma trận quyền — đã đồng ý Q11) |
| **2 · Lệnh SX + Bao bì** | LSX có cấu trúc từ dòng HĐ, in theo mẫu QTI-KH-01-04, 3 nơi nhận xác nhận · mẫu thùng + phiên bản + đợt in · bước 3 tự suy | LSX hết gõ Word, hết sót mẫu cũ (ngày, "=200 thùng") | — | 🟡 |
| **3 · Đóng cont** | Nhập `.xls` container plan · ảnh theo lớp (nạp zip) · tờ khai · nối lệnh xuất `/orders` **có BGĐ duyệt** (trạng thái chờ duyệt mới, không đổi nghĩa cũ) · cho thủ kho vào phần đóng cont | Bằng chứng đóng hàng tra được theo cont | `/orders`, `export_orders` (giá trị trạng thái mới) | 🟡 — 🔴 nếu phải sửa lệnh xuất cũ |
| **4 · Bộ chứng từ + đối chiếu** | Chứng từ có số liệu · `exportDossierCheck` (oracle lô 165) · checklist theo HĐ · khép kín chuyến/HĐ tự động · nhắc hạn `/my-tasks` | App tự chỉ lệch giữa Invoice/PL/H/C/B/L/plan trước khi gửi khách | `lib/myTasks.ts` (+test) | 🟡 |
| **5 · Hoàn thiện** | Lưu 2 năm (đánh dấu) · báo cáo tháng thay sổ Excel · đọc Excel invoice/PL · rồi mới tới **Nhập khẩu** và **Khác** | — | Cân đối chỉ nếu chốt giá HĐ chảy sang (C8) | 🟡 |

Mỗi đợt mang theo luật repo: tên tiếng Anh (8), migration mới từ **`0074`** — rà số với `origin` trước khi đặt, chỉ-thêm, idempotent, RLS ngay, có câu `drop` để lùi · `TableMapping` + `refColumns` · `DemoBundle`/`DemoPackLoader` + checklist demo (15) · `rowMarkKey` (12) · nháp form (17) · nút theo chức năng (16) · cuộn ngang 2 thanh (14) · màn thử 360 px → desktop + 130%.

---

## 6. Không làm

- Khai hải quan VNACCS, booking tàu, giao dịch ngân hàng, sổ kế toán — **chỉ lưu số, ngày, file** (C2, C12).
- Không đổi nghĩa `export_orders.status` cũ, không sửa dữ liệu lệnh xuất đã có.
- Không đổi nguồn xuất từ BTP sang TP đóng gói trong module này (🔴 riêng, ngoài phạm vi).
- Không tính phí XK vào Cân đối. Không đụng 141 mã TK 1551.
- Không thêm số mẫu cứng để trình diễn — demo qua chế độ demo.

---

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Phòng KH quen Excel + Word, không nhập hai lần | Đợt 1 chỉ là "chỗ để file + checklist", in/xuất Excel theo bố cục cũ; nạp sổ kế hoạch từ Excel |
| Gõ số chứng từ tay tốn công | Chỉ bắt **tổng** ở đợt đầu; dòng chi tiết khi đối chiếu cần; đọc Excel gốc sau |
| Chuyến gộp 2 lô / lô trải nhiều cont | Mô hình chuyến có `lot_code` dạng danh sách; ba-spec chốt |
| Liên kết HĐ ↔ invoice sai (giấy không ghi số HĐ) | Bắt buộc chọn HĐ khi tạo chuyến; B9 cảnh báo khi Σ vượt dung sai hoặc mặt hàng không có trong HĐ |
| Quyền giá lộ cho xưởng | Màn LSX của xưởng không đọc cột giá (`view-price`) |

---

## 8. Kiểm chứng khi build (AC khung — chi tiết ở ba-spec)

1. Tạo HĐ 18.26 (14 dòng, 1.900 thùng, 19.000 kg, 172.445 USD) ⇒ tổng tự cộng đúng; sửa rvs 12/08 ⇒ bản cũ còn tra được.
2. Tạo chuyến lô 165 + nhập plan `.xls` ⇒ 25 lớp, Σ 2.152 kiện ⇒ quy đổi = 2.252 thùng = B/L.
3. Nhập Invoice 234/26 + PL + H/C + B/L ⇒ đối chiếu báo đúng 2 lệch + thiếu C/O; chấp nhận lệch có lý do ⇒ bước 5 xong.
4. Gắn chuyến lô 165 vào HĐ 18.26 ⇒ B9 cảnh báo vượt dung sai (+16,9% kg) và ETD trễ hạn giao — đúng như số thật.
5. Màn tháng 09/2026: SCM có chuyến lô 165 khép kín ✓, HĐ 18.26 chưa khép (còn chuyến lô 181).
6. Đơn đặt cũ ở `/orders` không gắn chuyến vẫn tạo lệnh xuất như trước.

---

## 9. Đã chốt (chủ dự án 2026-10-20)

Chủ dự án chọn trên trang chốt (artifact "Kế hoạch module Xuất khẩu"), cả 11 câu theo đề xuất, kèm 2 ghi chú.

| Mã | Câu | Chốt |
|---|---|---|
| **Q1** | Tháng xếp theo gì | **Ngày đóng cont / ETD của chuyến.** HĐ hiện ở mọi tháng có chuyến của nó |
| **Q2** | HĐ nhiều chuyến? | **Có.** HĐ 1..n chuyến, chuyến = 1 cont; HĐ chỉ 1 chuyến thì gộp chung một màn |
| **Q3** | Bước Bao bì | **Đợt 1** đánh dấu + đính file; **đợt 2** quản lý mẫu thùng, phiên bản, đợt in |
| **Q4** | BGĐ duyệt ở đâu | **Ký giấy**; phòng KH ghi kết quả duyệt + đính file trên app |
| **Q5** | Tiền về | **Có theo dõi, không chặn khép kín.** Kế toán ghi; *ghi chú: người phòng KH cũng phải tra cứu và theo dõi được* ⇒ cả kế toán lẫn phòng KH xem + ghi được |
| **Q6** | Lịch sử sổ kế hoạch | **Bắt đầu từ tháng 10/2026**; nạp lịch sử sau, khi cần tra |
| **Q7** | Ai nhập sơ đồ + ảnh đóng cont | Mặc định thủ kho / PX Đông chụp ảnh, phòng KH nhập sơ đồ; *ghi chú: phòng KH cũng có thể chụp, làm linh hoạt* ⇒ **không khóa theo người**: ai có quyền ghi bước đóng cont đều nạp ảnh + sơ đồ được |
| **Q8** | `/orders` về lâu dài | **Đợt 3** thành bước "Lệnh xuất" bên trong chuyến; màn cũ giữ để tra |
| **Q9** | Bộ hồ sơ mẫu | Chủ dự án **sẽ gửi đủ bộ lô 165**: HĐ, lệnh SX, lệnh xuất, tờ khai, C/O ⇒ làm oracle đợt 4 |
| **Q10** | Khuôn màn tháng | **Giống sổ `KE HOACH XUAT HANG`** (mỗi dòng 1 cont) |
| **Q11** | Vai trò "Phòng Kế hoạch" | **Đồng ý thêm vai trò hệ thống mới** vào ma trận quyền ở đợt 1 (đây là câu xác nhận 🔴 của §4f — đã có) |

Kèm các câu còn mở của spec cũ: Q-QTI-1…9, C4–C6, C8–C11, C13 ([`phong-ke-hoach-quan-ly-don-hang.md` §5](phong-ke-hoach-quan-ly-don-hang.md)).
