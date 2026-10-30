# 48 — ba-spec: Phòng Kế hoạch · Lệnh sản xuất (nối Nhập khẩu → sản xuất → Xuất khẩu)

> Load khi: xây hoặc sửa Lệnh sản xuất của Phòng Kế hoạch: lập lệnh từ dòng hàng hợp đồng xuất, gắn nguyên liệu nhập khẩu dự kiến, phát hành tới phân xưởng / kho, gắn chuyến xuất (bước 2 của chuyến), in mẫu QTI-KH-01-04.
covers: src/features/production-orders/**, src/lib/productionOrder.ts, src/lib/productionOrderDemo.ts, supabase/migrations/0088_production_orders.sql, src/lib/exportPlanning.ts
last_verified: 2026-10-30
ttl_days: 90
<!-- re-verified: 2026-10-30 — P1 + P2 build: AC-1…5, 9, 10, 12…14 = test `src/lib/productionOrder.test.ts` (29, cả R6 `issuedShipmentIds`, A4 `nextOrderNumber`, Q10 `previousOrderFor`); AC-11 PGlite (chuỗi 0001→0088 + chạy lại 0088: planner thấy 3 lệnh gồm nháp, quản đốc / thủ kho / kế toán / GĐ thấy 2 lệnh đã phát hành, tổ trưởng 0, chỉ planner ghi); ma trận = `writePermissionsSql.test.ts`. AC-7, 8 = `productionOrderExport.test.ts` (P4); AC-15 thử tay (P3); AC-6 = vòng P6 ở sandbox (dưới). -->
<!-- re-verified: 2026-10-30 P6 — sandbox `baseafood-demo` (localStorage, không máy chủ): bật demo "Tạo bộ mới" (bộ sinh có 2 lệnh + 1 NL dự kiến + 4 lần nhập khẩu) → lập lệnh 60 thùng → gắn 2 dòng NL (một dòng dành vượt 99.999 / 4.000 kg ⇒ cảnh báo, vẫn lưu) → phát hành gắn 1 chuyến → hủy. AC-6: 19 bảng sổ khác (import-contracts/lines/receipts/receipt-lines/documents/files/sample-checks/suppliers, import-shipments, material-imports, daily-locks, scraps, monthly-stock, balancing-periods/inputs/outputs, lot-inputs/dispatches/waivers) trước == sau; chỉ 4 bảng lệnh tăng (+1 lệnh, +1 dòng, +2 NL, +1 chuyến gắn). §4b: tắt demo ⇒ 28 khóa `bsf.*` cùng độ dài + mã băm như trước vòng; lệnh demo không hiện ở chế độ thật. -->
status: v1 ĐÃ CHỐT (2026-10-29) — Q1–Q10 theo đề xuất (§11). Design-spec [49](49-production-order-ui.design-spec.md), kế hoạch build §12. **P1–P6 XONG (2026-10-30)**: mig `0088` ⏳ CHƯA chạy DB thật, luật `lib/productionOrder.ts`, trang `/planning-production` (+ tour, hộp "?"), nối Xuất khẩu (bước 2 tự xong, cột Đã ra lệnh), kiểm cuối AC-6 + demo §4b ở sandbox. Còn: chạy 0088 trên DB thật rồi đếm `site_id <> 'site-demo'` bằng SQL.

> **Mục đích:** oracle HÀNH VI cho Lệnh sản xuất (LSX). Ai làm gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (design-spec viết sau, theo khung [42](42-export-planning-ui.design-spec.md)).
> **Nguồn:** yêu cầu chủ dự án 2026-10-29 ("flow tạo lệnh sản xuất từ nhập khẩu và đưa vào xuất khẩu") · mẫu thật **LSX số 19.10** ngày 27/10/2026 (QTI-KH-01-04, khách Matsuda Sangyo, MSL 205) · **phụ lục số 01** ngày 10/10/2026 của HĐ 01-26-HAT (khách Hyakusaibou) · quy trình [QTI-KH-01 bước 8](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) · kế hoạch gốc [`spec/xuat-khau-phong-ke-hoach.md` §4c](../spec/xuat-khau-phong-ke-hoach.md) · OUT đợt 2 của [41 §7](41-export-planning.ba-spec.md) ("Lệnh SX có cấu trúc + 3 nơi nhận").

---

## 0. Đọc hai file mẫu

### 0a. LSX 19.10 (mẫu QTI-KH-01-04) — lệnh có những gì

| Phần | Nội dung trên giấy | Ghi chú cho app |
|---|---|---|
| Đầu lệnh | Số **19.10** · ngày 27/10/2026 · gửi **BQĐ phân xưởng, Phòng Kỹ thuật, Phòng Kế hoạch** | 3 nơi nhận. Phòng Kỹ thuật chưa có vai trò trong app |
| Dòng hàng | **Bạch tuộc 1 da cắt hạt lựu** · size NL 2.0–3.0 cm/pc · Standard grade · hàng thường · **không dùng hàng da giấy** · 2 kg/block × 6/PE xanh dương/CTN dán 1 đường băng keo đỏ | Tên tiếng Việt = mặt hàng danh mục. Yêu cầu NL (size NL, loại da) nằm ngay trong quy cách |
| Số lượng | **1.000 thùng · 12.000 kg** (12 kg/thùng) · **MSL 205** · NSX **02, 03, 04/11/2026** | kg = thùng × kg tịnh/thùng. Một lệnh nhiều ngày SX |
| Giao | Bao bì **đã có sẵn** · ngày giao **15/11/2026** · thị trường **Nhật (Matsuda Sangyo)** · HSD **2 năm** · quy trình theo Phòng Kỹ thuật | Bao bì "đã có sẵn" = nối bước 3 Bao bì |
| Yêu cầu bao bì | Thùng 5 lớp · **mỗi NSX một màu dây đai** (xanh dương, đỏ, vàng) · bao PE · ghi trên thùng / PE: mã lô, NSX, HSD (cách ghi) | Phần lớn ô để trống trên mẫu thật ⇒ chỉ vài ô hay dùng |
| Kiểm Nafi | Vi sinh · kháng sinh · kim loại nặng · histamine · chỉ tiêu thêm · lấy kết quả vi sinh | Mẫu thật để trống hết |
| Lưu ý | "Đóng hàng lên cont theo ngày sản xuất thực tế HACCP" | Chữ tự do |

### 0b. Phụ lục 01 của HĐ 01-26-HAT — HĐ xuất chia nhiều cont, nhiều tháng

- Mục đích phụ lục: **đổi cơ cấu size cho cả 6 container** và **gia hạn giao** tới tháng 11/2026 → 04/2027. App đã có hai việc này: **Ghi bản sửa** và **Gia hạn giao hàng** ([41](41-export-planning.ba-spec.md)).
- 3 dòng hàng (râu 1.5 g · 2 g · 3 g cut), IQF 1 kg/PE × 12/ctn, CNF Hakata. Tổng **129.600 kg**, dung sai **±10 %**.
- 6 cont trong 6 tháng ⇒ **một HĐ ra nhiều LSX**, mỗi LSX lo một hoặc vài cont (≈ 21.600 kg/cont). Đây là lý do LSX gắn **chuyến** chứ không gắn cả HĐ.
- **Lệch trên chính phụ lục (cần Phòng KH kiểm lại với khách):**
  - Dòng 2: 51.840 kg × 11,80 USD = **611.712,00**, phụ lục ghi **617.712,00** (lệch 6.000 USD).
  - Vì vậy tổng 1.533.336,00 sai. Đúng là **1.527.336,00**.
  - Cột "Assortment" ghi 22 % · 38 % · 38 % (cộng 98 %), trong khi tỷ lệ kg là 30 % · 40 % · 30 %.
  - Đúng loại lỗi bất biến B4 ([kế hoạch gốc §3c](../spec/xuat-khau-phong-ke-hoach.md)) app phải bắt.

### 0c. "Từ nhập khẩu" nghĩa là gì

Bạch tuộc NL của các lệnh này phần lớn là **hàng nhập khẩu loại hình sản xuất xuất khẩu**. Hiện ba mảnh rời nhau:

```
Nhập khẩu (HĐ nhập · lần nhập · thực nhập kg)      ← có (45), KHÔNG nối gì (45 R11)
        ✗ không biết NL nào dành cho đơn nào
Lệnh sản xuất                                        ← CHƯA CÓ (chỉ là file đính ở bước 2 chuyến)
        ✗ xưởng không biết làm cho đơn nào (KH-R8, R9)
Xuất khẩu (HĐ xuất · chuyến · 6 bước)                ← có (41)
```

LSX là mắt xích ở giữa. **Đầu vào** là dòng hàng HĐ xuất (làm gì, bao nhiêu, cho ai, giao khi nào) và NL nhập khẩu dự kiến (lấy NL lô nào). **Đầu ra** là lệnh phát hành cho phân xưởng / kho, và bước 2 của chuyến xuất tự xong.

Về sau, chuỗi *tờ khai nhập → LSX → tờ khai xuất* là nền cho **báo cáo quyết toán NL sản xuất xuất khẩu** với hải quan. Đợt này chưa làm báo cáo đó. Chỉ cần giữ đúng mối nối để sau dựng được.

---

## 1. Vấn đề & JTBD

- **Job:** Khi HĐ xuất đã có bản hiệu lực và sắp tới cont giao, **nhân viên Phòng Kế hoạch** muốn ra lệnh sản xuất đúng hàng, đúng số thùng, đúng mã lô, chỉ rõ NL nhập khẩu nào dùng. Để **phân xưởng làm đúng đơn**, kho chuẩn bị NL và bao bì, và chuyến xuất biết lệnh của mình đã ra.
- **Vì sao bây giờ:** Xuất khẩu và Nhập khẩu đã chạy trên app. LSX vẫn soạn Word (mẫu có ô FORMTEXT), gõ lại tên hàng, quy cách, số lượng từ HĐ. Bước 2 chuyến chỉ biết "có file". Không ai trả lời được "NL nhập lô X còn bao nhiêu chưa giao cho lệnh nào".

## 2. User registry

| ID | User | Vai trò hệ thống | Ghi chú |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch | `planner` | Soạn, phát hành, sửa LSX |
| U2 | Trưởng / Phó phòng Kế hoạch | `planning-head`, `planning-deputy` | Như U1 (+ duyệt nếu Q5 = B/C) |
| U3 | Ban quản đốc phân xưởng | `frozen-workshop-manager`, `fish-workshop-manager`, `dried-workshop-manager`, `vice-manager` (slug theo 0087) | Nơi nhận: làm theo lệnh |
| U4 | Thủ kho | `warehouse-keeper` | Nơi nhận: chuẩn bị NL nhập khẩu, bao bì |
| U5 | Phòng Kỹ thuật | — (chưa có vai trò) | Nơi nhận trên giấy (Q4) |
| U6 | Tổ trưởng sản xuất | `team-leader` | Ghi sản lượng `/wip`. Gắn LSX ở đợt sau (Q8) |
| U7 | Ban giám đốc, Kế toán | `director`, `vice-director`, `chief-accountant`, `accountant` | Chỉ xem |
| S1 | Hệ thống | — | Tính kg, HSD, "còn chưa ra lệnh", tự xong bước 2 chuyến |

## 3. User × Nghiệp vụ

| NV | Nghiệp vụ | Owner | User khác chạm |
|---|---|---|---|
| LS1 | Lập LSX từ dòng hàng HĐ xuất | U1 | — |
| LS2 | Gắn NL nhập khẩu dự kiến cho từng dòng LSX | U1 | U4 đọc |
| LS3 | Phát hành LSX + gắn chuyến xuất | U1 | S1 tự xong bước 2 chuyến; U3, U4, U5 nhận |
| LS4 | Nhận / xem LSX của mình | U3 | U4 |
| LS5 | Sửa sau phát hành · hủy LSX | U1 | U3, U4 thấy lần sửa |
| LS6 | HĐ có bản sửa (phụ lục) sau khi LSX đã phát hành | S1 (cảnh báo) → U1 | — |

## 4. Cross-user handoff

| Từ → Tới | Khi nào | Bàn giao gì | Kết thúc khi |
|---|---|---|---|
| U1 → U3, U4 (LS3) | LSX chuyển "Đã phát hành" | Lệnh đọc được trên app + bản in QTI-KH-01-04 | U3/U4 mở được lệnh (Q3 = C: thêm bấm "Đã nhận") |
| U1 → U5 (LS3) | Như trên | Bản in / file PDF (ngoài app, Q4 = A) | Ngoài app |
| U1 → chuyến xuất (S1) | LSX phát hành có gắn chuyến | Bước 2 của chuyến | Bước 2 = Xong (R6) |
| S1 → U1 (LS6) | HĐ có bản hiệu lực mới sau khi LSX phát hành | Cảnh báo "LSX theo bản trước" | U1 sửa LSX hoặc xác nhận giữ nguyên |
| Nhập khẩu → U1 (LS2) | Lần nhập có thực nhập | Dòng NL chọn được + kg còn chưa dành | — (chỉ đọc, không ghi ngược Nhập khẩu) |

Không có handoff nào tới tổ trưởng trong đợt này (Q8).

## 5. Flows

### LS1 — Lập LSX · owner U1
- **Input:** HĐ xuất có **bản hiệu lực**. Dòng hàng chọn đã **nối mặt hàng** (41 R16). Số LSX · ngày lệnh · MSL · ≥ 1 ngày SX · ngày giao · ≥ 1 dòng (dòng HĐ + số thùng hoặc số kiện).
- **Steps:**
  1. Chọn HĐ (từ hồ sơ HĐ hoặc từ bước 2 của chuyến).
  2. Chọn dòng hàng, gõ số thùng. Tên tiếng Việt, quy cách, packing chép từ dòng HĐ và mặt hàng. Kg tự tính (R2).
  3. Ghi MSL, ngày SX, ngày giao. Thị trường / khách lấy từ HĐ. HSD tính sẵn (R7).
  4. Yêu cầu bao bì, kiểm Nafi, lưu ý: **chép từ LSX gần nhất cùng khách + cùng mặt hàng** nếu có (Q10).
- **Output:** LSX trạng thái **"Nháp"**. Mỗi dòng HĐ hiện "đã ra lệnh X / Y kg · còn Z kg" (R4).

### LS2 — Gắn NL nhập khẩu dự kiến · owner U1
- **Input:** LSX nháp hoặc đã phát hành · dòng LSX · lần nhập khẩu (có thực nhập, chưa hủy) + dòng hàng HĐ nhập · kg NL dự kiến.
- **Steps:**
  1. Chọn lần nhập. Gợi ý trước các lần nhập có dòng hàng nối **cùng loại NL** với mặt hàng của dòng LSX.
  2. Gõ kg NL dự kiến.
- **Output:** dòng LSX có 0..n dòng NL dự kiến. Mỗi lần nhập hiện "đã dành X / thực nhập Y kg". Dành vượt ⇒ cảnh báo, vẫn lưu (R5). **Không** ghi sổ kho, Cân đối, Nhập khẩu (R5, 45 R11).

### LS3 — Phát hành + gắn chuyến · owner U1
- **Input:** LSX nháp đủ R1–R3 · 0..n chuyến **cùng HĐ**, chưa hủy.
- **Steps:**
  1. Phát hành (Q5 = A: không cần duyệt).
  2. Gắn chuyến. MSL của LSX chép sang chuyến nếu chuyến chưa có MSL.
  3. In / tải PDF mẫu QTI-KH-01-04.
- **Output:** LSX **"Đã phát hành"**, có thời điểm và người phát hành. Bước 2 "Lệnh sản xuất" của mọi chuyến gắn kèm = **Xong** (R6). U3, U4 đọc được lệnh.

### LS4 — Nhận LSX · owner U3
- **Input:** tài khoản U3 / U4, LSX đã phát hành.
- **Output:** danh sách LSX đã phát hành chưa giao xong (ngày giao ≥ hôm nay − 7), đọc đủ dòng, ngày SX, MSL, yêu cầu bao bì, lưu ý. **Không** thấy đơn giá, tiền. (Q3 = C: thêm "Đã nhận" + người + giờ.)

### LS5 — Sửa sau phát hành · hủy · owner U1
- **Sửa:**
  - Input: LSX đã phát hành · nội dung đổi · lý do.
  - Output: số **lần sửa** +1. Nhật ký ghi trước / sau. Nơi nhận thấy dấu "Đã sửa lần n". Q3 = C: trạng thái "Đã nhận" của nơi nhận về chưa nhận.
- **Hủy:**
  - Input: lý do (bắt buộc).
  - Output: **"Đã hủy"**. Gỡ khỏi các chuyến. Bước 2 của chuyến tính lại theo R6. Kg dành ở LS2 nhả ra.

### LS6 — Phụ lục sau khi LSX phát hành · owner S1 → U1
- **Input:** HĐ có bản hiệu lực mới (Ghi bản sửa) sau thời điểm phát hành LSX.
- **Output:** LSX giữ nguyên dòng cũ, gắn cờ **"Theo bản HĐ trước"**. Cờ hết khi U1 sửa LSX theo bản mới (LS5), hoặc chọn "Giữ nguyên" kèm lý do.

## 6. Flow optimization log

| Quyết định | Biến thể | Chọn | Lý do loại | Ai chấm |
|---|---|---|---|---|
| LSX gắn với gì | A. 1 LSX = 1 chuyến · B. LSX thuộc HĐ, gắn 0..n chuyến cùng HĐ · C. chỉ gắn HĐ | **B** | A sai thực tế: LSX 02.01 trong dữ liệu mẫu đi cả cont 20RF lẫn 40RF. C không tự xong được bước 2 của chuyến nào | Optimizer + Domain |
| Dòng LSX lấy từ đâu | A. gõ tự do · B. trỏ dòng HĐ bản hiệu lực | **B** | A lặp lại lỗi gõ lại của bản Word, không tính được "còn chưa ra lệnh" | Optimizer |
| NL nhập khẩu | A. chữ tự do · B. dành theo lần nhập, không trừ kho · C. trừ tồn kho thật | **B** (Q1) | C phá 45 R11 và cộng đôi nhóm "NL nhập khẩu" của sổ kho tháng. A không trả lời được "lô nhập này còn bao nhiêu chưa dành" | Domain (kho) |
| Duyệt | A. phát hành thẳng · B. Trưởng phòng phát hành · C. BGĐ duyệt | **A** (Q5) | Export v9 vừa bỏ duyệt HĐ vì chậm. QTI-KH-01 bước 8 không có duyệt LSX | Optimizer |
| Bước 2 xong khi | A. LSX phát hành **hoặc** file như cũ · B. chỉ LSX phát hành | **A** (Q6) | B làm chuyến cũ đang Xong bằng file tụt về chưa xong ⇒ đổi số liệu downstream (RED) | Cross-User-Integrity |
| Phụ lục đổi dòng | A. cảnh báo, U1 tự sửa · B. tự cập nhật LSX | **A** (Q9) | B đổi lệnh xưởng đang làm mà không ai hay | Domain |

## 7. Scope & Priority

- **IN (đợt này, nếu Q chốt theo đề xuất):** LS1–LS6, in mẫu QTI-KH-01-04, quyền riêng `production-orders`, demo bundle.
- **OUT:**
  - Tổ trưởng ghi sản lượng theo LSX `/wip` + tiến độ "đã làm X / Y kg" (Q8 — đợt sau).
  - Trừ tồn NL thật.
  - Báo cáo quyết toán NL SXXK.
  - Phiên bản mẫu thùng / đợt in (bước 3).
  - Vai trò Phòng Kỹ thuật (Q4).
  - Đọc file Word LSX cũ.

## 8. Success metric

| NV | Metric | Đích |
|---|---|---|
| LS1 | Thời gian ra một LSX 1 dòng (có LSX trước cùng khách + mặt hàng) | ≤ 3 phút, 0 ô gõ lại tên / quy cách |
| LS2 | Trả lời "lần nhập X còn bao nhiêu kg chưa dành cho lệnh nào" | ≤ 30 giây |
| LS3 | Chuyến có bước 2 Xong mà không có LSX phát hành hoặc file | 0 |
| LS6 | LSX phát hành theo bản HĐ cũ mà không có cờ | 0 |

## 9. Rules & Invariants

| ID | Luật | Ví dụ |
|---|---|---|
| R1 | LSX thuộc đúng 1 HĐ xuất có bản hiệu lực. Dòng LSX trỏ dòng HĐ **của bản hiệu lực lúc lập**, dòng đó đã nối mặt hàng (41 R16). HĐ đã hủy / đã đóng ⇒ không lập LSX mới | — |
| R2 | kg dòng = thùng × kg tịnh/thùng của dòng HĐ. Dòng đếm kiện: thùng = kiện × thùng/kiện. Thiếu kg tịnh/thùng ⇒ gõ kg tay | 1.000 × 12 = **12.000** (LSX 19.10) |
| R3 | Số LSX **duy nhất toàn công ty** (không phân hoa thường, bỏ khoảng trắng đầu/cuối). MSL không bắt duy nhất (như 41 R9) nhưng trùng MSL của LSX đang phát hành ⇒ cảnh báo | " 19.10 " trùng "19.10" ⇒ chặn |
| R4 | "Còn chưa ra lệnh" của dòng HĐ = kg HĐ − Σ kg các LSX chưa hủy. Vượt kg HĐ × (1 + dung sai) ⇒ cảnh báo, vẫn lưu | HĐ 01-26-HAT dòng 1: 38.880 kg, đã ra 2 lệnh 21.600 + 21.600 ⇒ vượt 4.320, quá +10 % ⇒ cảnh báo |
| R5 | NL dự kiến chỉ chọn từ lần nhập **có thực nhập, chưa hủy**. "Đã dành" của một dòng thực nhập = Σ kg dự kiến ở LSX chưa hủy. Vượt thực nhập ⇒ cảnh báo, vẫn lưu. **Không** ghi bảng Nhập khẩu, Nhập hàng, Sổ kho tháng, Cân đối | — |
| R6 | Bước 2 "Lệnh sản xuất" của chuyến **Xong** khi: (chuyến gắn ≥ 1 LSX "Đã phát hành") **hoặc** (luật cũ: có file / dùng chung). Giữ điều kiện HĐ có bản hiệu lực + mọi dòng đã nối mặt hàng | — |
| R7 | HSD = tháng của ngày SX **sớm nhất** + N tháng, về ngày 01 (B8). N mặc định 24, sửa được | NSX 02/11/2026, 24 tháng ⇒ **01/11/2028** |
| R8 | ≥ 1 ngày SX. Ngày giao ≥ ngày SX muộn nhất. Sai ⇒ chặn | NSX 04/11, giao 15/11 ⇒ hợp lệ |
| R9 | Quyền `production-orders`: CRUD = U1, U2 · view = U3, U4, U7. U3, U4 **không** đọc đơn giá / tiền HĐ | — |
| R10 | Phát hành không qua duyệt (Q5 = A). Sửa sau phát hành bắt lý do, tăng số lần sửa, ghi nhật ký | — |
| R11 | Hủy LSX bắt lý do. Gỡ khỏi chuyến, nhả kg dành (R5). Không xóa cứng | — |
| R12 | HĐ có bản hiệu lực mới sau giờ phát hành LSX ⇒ cờ "Theo bản HĐ trước" (LS6). Không tự đổi dòng LSX | — |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Kg tự tính từ thùng · Maps to flow: LS1 · Test: unit
- **Given** dòng HĐ IQF 2 kg/block × 6, kg tịnh/thùng 12, đơn vị thùng
- **When** U1 gõ 1.000 thùng
- **Then** dòng LSX có kg 12.000
- **Assert** `lineKg({cartons:1000, netKgPerCarton:12, unitKind:"carton"}) == 12000`; với `unitKind:"bundle", cartonsPerUnit:2`, 50 kiện ⇒ `cartons == 100`

### AC-2 — Chặn LSX khi HĐ chưa sẵn sàng · Maps to flow: LS1 · Test: unit
- **Given** (a) HĐ chưa có bản hiệu lực; (b) dòng chọn chưa nối mặt hàng; (c) HĐ đã hủy
- **When** U1 lưu LSX
- **Then** bị chặn kèm lý do
- **Assert** `canCreateOrder` trả `reason` lần lượt == "no-effective-revision", "line-unmapped", "contract-cancelled"; số LSX được lưu == 0

### AC-3 — Số LSX trùng · Maps to flow: LS1 · Test: unit
- **Given** đã có LSX "19.10"
- **When** U1 lưu LSX số " 19.10 "
- **Then** bị chặn
- **Assert** `validateOrder` có lỗi field "number"; MSL 205 trùng LSX đang phát hành ⇒ chỉ cảnh báo, `errors.length == 0`

### AC-4 — Còn chưa ra lệnh + vượt dung sai · Maps to flow: LS1 · Test: unit
- **Given** dòng HĐ 38.880 kg, dung sai 10 %, LSX A 21.600 kg (đã phát hành), LSX B 21.600 kg (nháp), LSX C 5.000 kg (đã hủy)
- **When** tính dòng HĐ
- **Then** đã ra lệnh 43.200, còn −4.320, cảnh báo vượt
- **Assert** `orderedKg == 43200`; `remainingKg == -4320`; `overTolerance == true` (43.200 > 42.768)

### AC-5 — NL dự kiến không vượt im lặng · Maps to flow: LS2 · Test: unit
- **Given** dòng thực nhập 20.000 kg; LSX A dành 12.000 kg; LSX B (đã hủy) dành 5.000 kg
- **When** U1 dành thêm 9.000 kg ở LSX C
- **Then** lưu được, cảnh báo vượt
- **Assert** `reservedKg == 21000`; `overReceived == true`; lần nhập đã hủy không có trong danh sách chọn (`count == 0`)

### AC-6 — Gắn NL không ghi sổ khác · Maps to flow: LS2 · Test: integration
- **Given** đếm số dòng bảng Nhập khẩu, Nhập hàng, Sổ kho tháng, Cân đối, `lot_inputs`
- **When** U1 lập LSX, gắn 2 dòng NL dự kiến, phát hành, hủy
- **Then** các bảng đó không đổi
- **Assert** số dòng mỗi bảng trước == sau

### AC-7 — Phát hành làm bước 2 chuyến tự xong · Maps to flow: LS3 · Test: unit
- **Given** HĐ có bản hiệu lực, mọi dòng đã nối; chuyến S1, S2 cùng HĐ, bước 2 chưa có file
- **When** LSX gắn S1 + S2 chuyển "Đã phát hành"
- **Then** bước 2 của S1, S2 Xong; S3 (không gắn) vẫn chưa xong
- **Assert** `subStepState(S1,"production-order") == "done"`, `S2 == "done"`, `S3 == "not-started"`

### AC-8 — Tương thích chuyến cũ · Maps to flow: LS3 · Test: unit
- **Given** chuyến cũ bước 2 Xong bằng file, không có LSX
- **When** tính lại sau khi có tính năng LSX
- **Then** vẫn Xong
- **Assert** `subStepState == "done"`; số chuyến đổi trạng thái bước 2 sau nâng cấp == 0 (chạy trên dữ liệu demo)

### AC-9 — MSL chép sang chuyến · Maps to flow: LS3 · Test: unit
- **Given** LSX MSL "205"; chuyến S1 MSL trống, S2 MSL "198"
- **When** phát hành LSX gắn S1, S2
- **Then** S1 nhận "205", S2 giữ "198" và có cảnh báo lệch MSL
- **Assert** `S1.lotCode == "205"`; `S2.lotCode == "198"`; `lotMismatch(S2) == true`

### AC-10 — HSD và ngày · Maps to flow: LS1 · Test: unit
- **Given** NSX 02, 03, 04/11/2026; HSD 24 tháng; ngày giao (a) 15/11/2026, (b) 03/11/2026
- **When** tính / kiểm LSX
- **Then** HSD 01/11/2028; (a) hợp lệ; (b) bị chặn
- **Assert** `expiryDate == "2028-11-01"`; (a) `errors.length == 0`; (b) lỗi field "deliveryDate"

### AC-11 — Nơi nhận đọc được, không thấy giá · Maps to flow: LS4 · Test: integration
- **Given** tài khoản `manager-dong` và `warehouse-keeper`; 1 LSX nháp, 2 LSX đã phát hành
- **When** đọc LSX
- **Then** chỉ thấy LSX đã phát hành, không có trường đơn giá / tiền
- **Assert** số LSX đọc được == 2; số trường giá trả về == 0; ghi LSX bị từ chối (RLS)

### AC-12 — Hủy nhả mọi liên kết · Maps to flow: LS5 · Test: unit
- **Given** LSX đã phát hành gắn S1 (S1 không có file bước 2), dành 12.000 kg NL
- **When** U1 hủy với lý do "khách dời đơn"
- **Then** LSX "Đã hủy", S1 bước 2 về chưa xong, kg dành nhả
- **Assert** `status == "cancelled"`; `subStepState(S1) != "done"`; `reservedKg` của dòng nhập giảm 12.000; hủy không lý do ⇒ lỗi field "cancelReason"

### AC-13 — Sửa sau phát hành có vết · Maps to flow: LS5 · Test: unit
- **Given** LSX đã phát hành lần sửa 0
- **When** U1 đổi số thùng 1.000 → 900, lý do "giảm theo khách"
- **Then** lần sửa 1, nhật ký có trước / sau
- **Assert** `revisionNo == 1`; nhật ký có 1 dòng chứa "1.000" và "900"; sửa không lý do ⇒ lỗi

### AC-14 — Phụ lục sau phát hành · Maps to flow: LS6 · Test: unit
- **Given** LSX phát hành 12/10 theo bản 0 của HĐ 01-26-HAT; ghi bản sửa (phụ lục 01) hiệu lực 13/10
- **When** tính cờ LSX
- **Then** có cờ "Theo bản HĐ trước"; U1 chọn "Giữ nguyên" + lý do ⇒ hết cờ
- **Assert** `staleRevision(order) == true` trước; `== false` sau; dòng LSX không đổi (`lines` trước == sau)

### AC-15 — In đúng mẫu · Maps to flow: LS3 · Test: manual
- **Given** LSX dựng lại đúng số liệu LSX 19.10
- **When** in A4
- **Then** bản in có đủ các khối của mẫu QTI-KH-01-04
- **Assert** bản in có mã "QTI-KH-01-04", số "19.10", "1.000" thùng, "12.000" kg, MSL "205", NSX "02, 03, 04/11/2026", ngày giao "15/11/2026"; vừa 1 trang A4

## 11. Đã chốt + giả định

**Chủ dự án chốt 2026-10-29: cả 10 câu theo đề xuất (phương án in đậm).** Luật R1–R12 và AC-1…AC-15 ở trên đã viết theo đúng các phương án này.

| Q | Câu | Lựa chọn (in đậm = đã chốt) |
|---|---|---|
| Q1 | NL nhập khẩu trong LSX | A. chỉ ghi chữ yêu cầu NL như giấy · **B. chọn lần nhập + kg dự kiến, không trừ kho** · C. trừ tồn kho thật |
| Q2 | LSX gắn với | A. đúng 1 chuyến · **B. thuộc HĐ, gắn 0..n chuyến cùng HĐ** · C. chỉ HĐ |
| Q3 | Nơi nhận trên app | A. chỉ in / gửi ngoài app · **B. Quản đốc + Thủ kho đọc trên app** · C. B + bấm "Đã nhận" |
| Q4 | Phòng Kỹ thuật | **A. nhận bản in / PDF** · B. thêm vai trò Kỹ thuật (chỉ xem LSX) |
| Q5 | Duyệt LSX | **A. NV Kế hoạch phát hành thẳng** · B. chỉ Trưởng / Phó phòng phát hành · C. BGĐ duyệt |
| Q6 | Bước 2 chuyến xong khi | **A. LSX phát hành hoặc file như cũ** · B. chỉ LSX phát hành |
| Q7 | Bản in | **A. đúng mẫu QTI-KH-01-04** · B. bản in gọn của app |
| Q8 | Tổ trưởng ghi sản lượng theo LSX (`/wip`) | **A. đợt sau** · B. làm luôn đợt này |
| Q9 | Phụ lục đổi dòng sau khi LSX phát hành | **A. cảnh báo, NV KH tự sửa** · B. tự cập nhật LSX |
| Q10 | Yêu cầu bao bì / Nafi | A. đủ ô như mẫu giấy · **B. vài ô hay dùng + ghi chú, chép từ LSX trước cùng khách + mặt hàng** |

**Giả định (fail-closed):**
- A1. Một LSX nhiều dòng được (mẫu có cột STT, dòng Tổng), dù mẫu thật chỉ có 1 dòng.
- A2. Quyền riêng `production-orders` (như A2 của 45). Cần migration thêm dòng ma trận quyền: chỉ thêm, không chạy lại 0073 / 0075.
- A3. Bảng mới (dự kiến `production_orders`, `production_order_lines`, `production_order_materials`, `production_order_shipments`): thêm vào `DemoBundle` cùng commit (QT 15).
- A4. Số LSX dạng "19.10" gõ tay, app gợi ý số kế tiếp theo LSX gần nhất (không tự cấp).

## 12. Kế hoạch build

Thứ tự theo phụ thuộc. Mỗi pha xanh cổng `build` + `lint` + `test` + `naming:check` rồi mới sang pha sau. Giao diện theo design-spec [49](49-production-order-ui.design-spec.md).

| Pha | Việc | Tier | AC / cổng kiểm | Doc cập nhật |
|---|---|---|---|---|
| **P1 Dữ liệu** ✅ 2026-10-30 | Migration **0088** (rà lại số trên origin trước khi đặt; origin đang tới 0087), gồm: 4 bảng `production_orders` · `production_order_lines` · `production_order_materials` · `production_order_shipments` (khóa ngoại mềm, `site_id`); RLS theo `production-orders` (nơi nhận chỉ đọc lệnh `issued`, không có cột giá); thay trọn `default_role_permissions` sinh từ `DEFAULT_ROLE_PERMISSIONS`; ROLLBACK cuối file. Thêm kiểu ở `types.ts`, tài nguyên ở `lib/permissions.ts`, `TableMapping` (+ `refColumns`) ở `repo.ts`, hook ở `catalogRepo.ts`, `DemoBundle` + `DemoPackLoader` + dữ liệu demo (dựng lại LSX 19.10) | 🟡 | PGlite: chuỗi 0001→0088 chạy **2 lần**, thử RLS theo vai (AC-11) · test `permissions` canh ma trận | 03, 04, 05, `spec/che-do-demo` §5 |
| **P2 Luật** ✅ 2026-10-30 | `lib/productionOrder.ts` (hàm thuần): `lineKg`, `canCreateOrder`, `validateOrder`, `orderedKgOfLine` (còn chưa ra lệnh, dung sai), `reservedKgOfReceiptLine`, `expiryDate`, `staleRevision`, `nextOrderNumber`, `copyRequirementsFrom` | 🟢 | `productionOrder.test.ts` = AC-1…5, 9, 10, 12…14 | 48 |
| **P3 Màn** ✅ 2026-10-30 | `features/production-orders/`: trang `/planning-production` (danh sách, hồ sơ, hộp Lệnh · NL dự kiến · Phát hành · Gắn chuyến · Giữ nguyên · Hủy), bản in QTI-KH-01-04, nháp `useDialogDraft`. Route + nav nhóm Kế hoạch; quản đốc, thủ kho thấy mục khi có `view` | 🟢 | Gõ dở → sang trang → quay lại còn nguyên · 360 px × 130 % · AC-15 in tay | 02, 01, 49 |
| **P4 Nối Xuất khẩu** ✅ 2026-10-30 | `exportPlanning.ts`: bước 2 xong khi có lệnh phát hành **hoặc** luật cũ (R6), truyền tập chuyến có lệnh vào hàm tính. `ShipmentPanel` bước 2 + `ContractDossier` cột "Đã ra lệnh" | 🟡 (đổi luật xong bước) | `exportPlanning.test.ts` thêm AC-7, AC-8 · test cũ của bước 2 giữ xanh | 41, 42 |
| **P5 Hướng dẫn** ✅ 2026-10-30 (cùng P3) | `productionOrderTour.ts` + hộp "?" dạng quy trình (`flowGuide`: nhóm người dùng, bước, trạng thái Nháp → Đã phát hành / Đã hủy, cờ "Theo bản HĐ trước"); thêm vào `checkFlow` của `flowGuide.test.ts` | 🟢 | `pageTourCoverage.test.ts` · `flowGuide.test.ts` · đi hết tour ở 360 px × 130 % | 43 |
| **P6 Kiểm cuối** ✅ 2026-10-30 (sandbox) | Chạy QA của 49 trên preview demo. AC-6: đếm dòng các bảng Nhập khẩu, Nhập hàng, Sổ kho tháng, Cân đối, `lot_inputs` trước = sau. Demo §4b: dòng `site_id <> 'site-demo'` không đổi | — | AC-6, demo §4b | CLAUDE.md (dòng migration), BAN-GIAO-tiep-theo |

**Lưu ý chạy migration trên DB thật:**
- 0080, 0081, 0083…0087 chưa chạy. Mỗi file từ 0079 trở đi thay trọn ma trận quyền mặc định, nên **phải chạy đúng thứ tự tới 0088**. Chạy 0088 trước một file cũ hơn rồi mới chạy file cũ ⇒ mất quyền Lệnh sản xuất.
- Chưa chạy 0088 thì app vẫn chạy: trang Lệnh sản xuất báo thiếu bảng, Xuất khẩu tính bước 2 theo luật cũ.

**Ước lượng:** P1 + P2 một phiên; P3 một phiên; P4 + P5 + P6 một phiên. Mỗi phiên đọc 48 + 49 trước, không cần đọc lại hai file mẫu (số liệu đã chép ở §0).

## History
- v1.4 2026-10-30 — P6 kiểm cuối ở sandbox: AC-6 (19 bảng sổ khác không đổi) + demo §4b (28 khóa số thật không đổi). Kiểm `site_id` bằng SQL làm sau khi 0088 chạy trên DB thật.
- v1.3 2026-10-30 — build P4: `ExportData.issuedOrderShipmentIds` + `subStepState` (R6), nạp ở `useExportData`; bước 2 của chuyến có khối `ShipmentOrders` (lệnh đã gắn, Lập lệnh, Gắn lệnh có sẵn); cột "Đã ra lệnh (kg)" ở hồ sơ HĐ (`useOrderCoverage`); chữ tour / hộp "?" Xuất khẩu nói luật mới. AC-7, AC-8 (+ nháp, đã hủy) = `productionOrderExport.test.ts` (5). Thử preview demo: chuyến 142 bước 2 "Chưa làm" → lập lệnh 4.10 từ bước 2 → phát hành (chuyến tick sẵn) → bước 2 "Xong"; cột Đã ra lệnh 500 / còn 21.100; 360 px × 130 % không tràn.
- v1.2 2026-10-30 — build P3: trang `/planning-production` (danh sách tháng, hồ sơ, hộp lập / sửa / NL dự kiến / phát hành · gắn chuyến / giữ bản cũ / hủy, bản in A4 dọc QTI-KH-01-04), nav nhóm Kế hoạch (navId quyền đổi về `planning-production`), tour + hộp "?" (P5 làm luôn vì QT 18 chặn máy). Thử preview demo: lập 3.10 (200 thùng ⇒ 2.400 kg), thiếu ngày ⇒ ErrorSummary 2 ô, phát hành gắn chuyến có MSL 006 ⇒ giữ 006 + Lệch MSL + bước 2 xong, sửa sau phát hành bắt lý do ⇒ lần sửa 1, hủy ⇒ chuyến hết bước 2; 360 px × 130 % không tràn. AC-15 (in) thử tay: đủ khối, A4 dọc.
- v1.1 2026-10-30 — build P1 + P2: mig 0088, kiểu, quyền `production-orders` (navId tạm `planning-export` tới P3), 4 mapping + hook, bộ demo, `lib/productionOrder.ts` + 29 test. Không đặt unique index số lệnh (kiểm ở app, tránh kẹt hàng chờ).
- v1 2026-10-29 — chủ dự án chốt Q1–Q10 theo đề xuất. Thêm design-spec 49 + kế hoạch build §12.
- v0 2026-10-29 — nháp từ LSX 19.10 + phụ lục 01 HĐ 01-26-HAT; chờ chốt Q1–Q10.
