# 70 — ba-spec: Lịch gọi hàng của khách · một lần xuất gộp nhiều hợp đồng

> Load khi: xây / sửa lịch gọi hàng theo tháng của khách (bảng mã hàng của khách × tháng), chuyến xuất chở hàng của nhiều HĐ cùng khách, đã giao / còn phải giao theo từng HĐ khi chuyến gộp, luật "HĐ xong khi giao đủ lượng trong khung ETA".
covers: src/lib/exportPlanning.ts, src/lib/exportInvoice.ts, src/lib/exportReports.ts, src/lib/customerProductNames.ts, src/lib/productionOrder.ts, src/features/export-planning/
last_verified: 2026-11-05
ttl_days: 90
status: **v1.2 ĐÃ CHỐT** (2026-11-03 — chủ dự án "Duyệt theo đề xuất" cả 9 câu §11). **Đợt 1a ĐÃ BUILD 2026-11-03** (chưa commit): R1–R8, R10, NL6, NL7 — luật ở `lib/exportPlanning.ts` (`shipmentContractIds` · `carriesContract` · `shipmentContractActuals` · `addContractGate` · `addableContracts` · `shipmentDeadline` · `linesWithContractNo` · `lineContractOf`), test `lib/exportMultiContract.test.ts` (AC-1…5 + R2, R10, NL7, Q3/R9) + `shipmentGoodsLogic.test.ts`; hộp Hàng của chuyến thêm hàng của HĐ khác; hồ sơ HĐ mục "Đi chung chuyến của hợp đồng khác"; invoice ghi Contract No. theo dòng. **R9 ĐÃ VIẾT 2026-11-04:** `0102_export_loading_lines_multi_contract.sql` (chủ dự án đồng ý; kiểm PGlite; CHƯA chạy DB thật). **Còn:** NL8 / R17 khung giao ETA, đợt 2 lịch gọi hàng (NL1, NL2, R11–R16). v1.1 đối chiếu HĐ thật BD-009/26 + trả lời của Phòng KH (chị Thảo).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của design-spec 42). Ca một HĐ — nhiều chuyến của 41 giữ nguyên; spec này thêm ca **một chuyến — nhiều HĐ** và **lịch gọi hàng của khách**.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-03, kèm (a) ảnh bảng lịch khách DAIREI gửi (ngày `09-07-26`): "mỗi hàng ngang là 1 hợp đồng, mỗi lần xuất (1 hàng dọc) là xuất của nhiều hợp đồng khác nhau; bảng này thay đổi liên tục; HĐ 1.250 có lịch 10/2026 → 09/2027 thì xuất đủ 1.250 là được"; (b) ảnh HĐ thật **BD-009/26**; (c) Phòng KH (chị Thảo, Zalo 03/11 15:50): "NB / PB là mã của khách thôi, bảng đó họ gửi theo mã theo dõi của họ"; "UCC BRAND-3970: mã code sản phẩm là 3970, thương hiệu là UCC".

### 1a. HĐ thật BD-009/26 (một hàng của bảng lịch)

| Mục | Trên HĐ | App hiện có (41) |
|---|---|---|
| Số HĐ · ngày | Reference Number **BD – 009/26** · August 07, 2026 | số HĐ · ngày ký ✓ |
| Người mua | DAIREI CO., LTD. (Tokyo) — **cùng một khách cho cả bảng lịch** | khách ✓ |
| Dòng hàng | **1 dòng**: FROZEN OCTOPUS KARAAGE IQF (**UCC BRAND-3970**), New powder from Nisshin 22-04WV / GUM-24V / TSU-18V; size theo tỉ lệ (tentacle 45 % · 1–2 leg 20 % · body + neck 35 %) | dòng hàng, tên theo khách (R23), yêu cầu NL (R38) ✓ |
| Quy cách | 1 kg/bag × 5 bags/ctn × 2 ctn/**B'DL (bó)** ⇒ 1 bó = 10 kg | `unitKind: "bundle"`, `cartonsPerUnit` 2, `netKgPerCarton` 5 ✓ |
| Lượng · giá | **1.250 bó = 12.500 kg** · 9,65 USD/kg CFR Tokyo · 120.625,00 USD | ✓ |
| Dung sai | 10 % more or less (lượng **và** tiền) | `tolerancePct` ✓ |
| Giao hàng | Tokyo; **partial shipment: allow**; giao với **ETA từ 10/2026 tới 09/2027** | chỉ có **hạn giao muộn nhất**, tính theo on board / ETD (R15) ✗ — không có "từ tháng", không theo ETA |
| Thanh toán | TTR 100 % giá trị **invoice** khi nhận bộ chứng từ qua email | tiền về theo chuyến ✓ |
| Chứng từ | Commercial Invoice, Packing List, B/L, C/O form VJ, Test report | danh mục loại chứng từ (41 §0b) ✓ |
| Hiệu lực | tới 31/12/2027 | Hạn HĐ (69) ✓ |

⇒ **Mỗi HĐ = một mã hàng của khách, lượng cả năm, cho phép giao từng phần trong khung ETA 12 tháng.** Phần HĐ app đã ghi được gần đủ; thiếu: khung giao "từ – tới" theo ETA, và cách nối HĐ với hàng trong lịch của khách.

### 1b. Bảng lịch khách gửi (đọc từ ảnh — cần Phòng KH soát lại số). Đơn vị: **bó**

| Mã hàng khách | Tên trên lịch | 10/26 | 11 | 12 | 1/27 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Lượng HĐ (bó) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3192 | DAIREI OCTOPUS | 430 | 500 | 430 | 300 | 530 | 300 | 430 | 200 | 700 | 300 | 580 | 300 | **5.000** |
| 3970 | UCC OCTOPUS (= **BD-009/26**) | 0 | 0 | 200 | 0 | | 200 | 200 | 200 | 150 | 150 | 150 | 0 | **1.250** |
| 3824 | JFDA OCTOPUS | 400 | 330 | 500 | 530 | 600 | 360 | 500 | 460 | 700 | 540 | 650 | 430 | **6.000** |
| 3762 | HCF OCTOPUS | 0 | 0 | 0 | | 400 | | 400 | | | 400 | | | **1.200** |
| 3565 | DAIREI ISOBE OCTOPUS | 390 | | | | | | | | | | | | (trống — "We will update again soon") |
| | **Cộng cột (4 mã đầu)** | 830 | 830 | 1.130 | 830 | 1.530 | 860 | 1.530 | 860 | 1.550 | 1.390 | 1.380 | 730 | **13.450** |

- Cột NB / PB của bảng là mã theo dõi nội bộ của khách ⇒ app **không** dùng.
- Cột "Code" = **mã sản phẩm của khách** (3970 ⇒ "UCC BRAND-3970" trên HĐ). Đó là chỗ nối một hàng của lịch với một HĐ của ta.
- Tổng từng hàng khớp lượng HĐ ⇒ đọc hàng = HĐ, cột = lần xuất là đúng. Nếu mọi mã cùng quy cách 10 kg/bó ⇒ mỗi tháng 7,3 – 15,5 tấn, cả năm 134,5 tấn — cỡ một cont lạnh mỗi tháng. Quy cách 3 mã còn lại chưa thấy HĐ ⇒ app quy kg theo quy cách **của từng HĐ**, không giả định 10 kg.

### 1c. Vấn đề

- **Ca này:** một khách (DAIREI) có nhiều HĐ chạy song song, mỗi HĐ một mã hàng, lượng cả năm, khung ETA 12 tháng. Khách gửi **lịch gọi hàng** chia số bó mỗi mã theo tháng và gửi lại khi đổi. **Mỗi tháng một lần xuất chở hàng của nhiều HĐ.** Chứng từ, tờ khai khai theo số HĐ gốc của từng dòng (VD BD-009/26). HĐ xong khi tổng đã giao đủ lượng trong dung sai 10 %, không cần khớp từng tháng.
- **App hiện nay vướng (kiểm code 2026-11-03):**
  1. Chuyến thuộc đúng **một** HĐ (`ExportShipment.contractId`); độ phủ, thực xuất, khép HĐ, duyệt cuối, lệnh SX (48: một lệnh một HĐ), quyền đóng cont đều đi theo một HĐ đó.
  2. Cách lách đang có: mỗi HĐ một chuyến cùng booking, chứng từ "dùng chung" (41 R5, NV8). Nhưng thực xuất của HĐ = Σ Commercial Invoice **của chính chuyến**, bỏ mục dùng chung (`shipmentActuals`) ⇒ HĐ mượn invoice của chuyến khác tính **0**, không bao giờ khép đúng. Số cont đếm 4 lần cho 1 cont thật.
  3. Lịch xuất hàng (41 NV19) dựng **theo từng HĐ** và sinh chuyến cho mỗi tháng ⇒ 4 HĐ × 12 tháng = 48 chuyến cho 12 lần xuất. Khách đổi lịch phải sửa tay từng chuyến, mất bản lịch cũ.
  4. Không có chỗ cho dòng **dự báo chưa có HĐ** (3565: 390 bó).
  5. HĐ chỉ có "hạn giao muộn nhất" xét theo on board / ETD (41 R15); HĐ này giao theo **khung ETA từ 10/2026 tới 09/2027** ⇒ chuyến ETA 02/10/2026 là đúng hạn, còn ETA 25/09/2027 vẫn đúng hạn dù ETD trước đó.
- **Job:** Khi khách gửi (hoặc gửi lại) lịch gọi hàng, Nhân viên Kế hoạch muốn ghi lịch đó một lần cho cả khách, lập mỗi tháng một lần xuất gộp hàng của các HĐ, và luôn biết mỗi HĐ đã giao bao nhiêu bó, còn phải giao bao nhiêu trước hết khung.
- **Đo thành công:** với bảng trên: 12 lần xuất (không 48); HĐ BD-009/26 xong khi đã giao 1.125 – 1.375 bó (± 10 %) dù từng tháng lệch lịch; tổng cả năm 13.450 bó đếm đúng một lần.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch | `export-plans` thêm / sửa | ghi lịch gọi hàng, lập lần xuất gộp, chứng từ |
| U2 | Trưởng / Phó phòng Kế hoạch | `export-plans` duyệt | duyệt cuối từng HĐ (như 41) |
| U3 | Bộ phận đóng cont | `export-plans.loading` | ghi số bó thực đóng theo dòng hàng của chuyến — nay dòng thuộc nhiều HĐ |
| U4 | BGĐ · Kế toán | xem · `export-plans.payments` | xem còn phải giao, ghi tiền về theo invoice |
| S1 | Hệ thống | — | cộng đã giao / còn phải giao theo HĐ, so lịch ↔ thực, nhắc HĐ sắp hết khung |
| X1 | Khách (ngoài app) | — | gửi lịch gọi hàng theo mã hàng của họ, gửi bản sửa bất kỳ lúc nào |
| X2 | Hải quan (ngoài app) | — | nhận tờ khai mang số HĐ gốc của từng dòng |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NL1 | Ghi **lịch gọi hàng** của khách: một bản = ngày khách gửi + số bó theo mã hàng × tháng; mỗi mã nối một HĐ (hoặc là dòng dự báo chưa có HĐ). Bản mới không xóa bản cũ | U1 | X1 | 41 NV3 (HĐ đã lập) | mỗi lần khách gửi | Must |
| NL2 | So bản lịch mới với bản trước: ô nào đổi, tổng mỗi mã còn khớp lượng HĐ không | S1 | U1 | NL1 | mỗi bản mới | Should |
| NL3 | Lập **lần xuất gộp** của một tháng: một chuyến, dòng hàng lấy từ các HĐ có số bó ở cột tháng đó | U1 | U3, U2 | NL1 hoặc tay | mỗi tháng | Must |
| NL4 | Theo dõi từng HĐ: **đã giao** · **còn phải giao** · **kế hoạch còn lại** theo lịch mới nhất · **lệch lịch** (bó và kg) | S1 | U1, U2, U4 | NL3 | liên tục | Must |
| NL5 | HĐ xong khi đã giao đủ lượng trong dung sai và mọi chuyến có dòng của HĐ đã khép ⇒ Chờ duyệt cuối (41) | S1 | U2 | NL4 | mỗi HĐ | Must |
| NL6 | Chứng từ của lần xuất gộp: tờ khai, invoice, packing list, C/O ghi **số HĐ gốc của từng dòng** | U1 | X2 | NL3, 63 | mỗi chuyến | Must |
| NL7 | Tiền về theo invoice (TTR khi nhận bộ chứng từ), chia về từng HĐ theo tiền của dòng | U4 | U1 | NL3 | mỗi chuyến | Should |
| NL8 | Khung giao "ETA từ – tới" của HĐ: chuyến đúng hạn / trễ theo ETA so với khung | S1 | U1 | 41 R15 | mỗi chuyến | Must |
| NL9 | Hướng dẫn thao tác + hộp "?" + sơ đồ workflow (QT 18, 21) | S1 | U1 | NL1–NL8 | khi đổi | Must |

## 4. Cross-user handoff

| Chặng | Từ | → Nhận | Điều kiện | Nếu không ai nhận |
|---|---|---|---|---|
| H1 | X1 gửi lịch | U1 | file / email tới Phòng KH | ngoài app |
| H2 | U1 lập lần xuất gộp | U3 | chuyến có dòng hàng (nhiều HĐ) | như 41: chuyến kẹt bước 4 ⇒ Việc của tôi |
| H3 | U3 ghi số bó thực đóng | S1 | dòng có `loadedUnits` | — (tính tự động) |
| H4 | S1: một HĐ đủ lượng + chuyến của nó đã khép | U2 | NL5 | HĐ ở Chờ duyệt cuối ⇒ Việc của tôi (41) |
| H5 | S1: HĐ còn ≤ 30 ngày tới cuối khung ETA mà còn phải giao vượt dung sai dưới | U1 | NL8 | nhắc tới khi gia hạn (41 NV6) hoặc đóng thiếu có lý do |
| H6 | U1 gửi bộ chứng từ qua email cho khách | U4 | ghi "đã gửi chứng từ" (41 bước 6) | chờ tiền về như 41 |
| H7 | U1 nộp tờ khai | X2 | ngoài app | — |

## 5. Flows

### Flow NL1 — Ghi lịch gọi hàng · owner U1
- **Start:** khách gửi bảng lịch (bản đầu hoặc bản sửa).
- **Input:** khách · ngày bản lịch (VD 09/07/2026) · các dòng: mã hàng của khách (3970…), tên trên lịch, số bó theo tháng · file khách gửi (tùy chọn).
- **Steps:** U1 chọn khách → tạo bản lịch mới (chép sẵn bản trước, hoặc nạp file Excel — §11 Q5) → mỗi mã app tìm HĐ theo R16; không thấy ⇒ dòng **dự báo** → U1 soát / sửa → lưu.
- **Output:** 1 bản lịch là **bản đang dùng** của khách; bản cũ giữ để tra. Cảnh báo (vẫn lưu): tổng mã ≠ lượng HĐ ngoài dung sai · tháng nằm ngoài khung ETA của HĐ · HĐ đã đóng / hủy mà vẫn có số.
- **End:** NL4 tính lại kế hoạch còn lại theo bản mới. **Không** tự tạo / sửa / xóa chuyến nào.

### Flow NL3 — Lập lần xuất gộp · owner U1
- **Start:** tới tháng giao (khách chốt đơn tháng / có booking).
- **Input:** bản lịch đang dùng + tháng; hoặc chọn HĐ tay. Mọi HĐ cùng khách, đang mở, đủ hồ sơ bắt buộc (41 `shipmentGate` áp **từng** HĐ).
- **Steps:** U1 lập chuyến cho khách + tháng → app đề xuất dòng: mỗi HĐ có số bó ở cột tháng ⇒ một dòng theo dòng HĐ, số bó kế hoạch = ô lịch − phần tháng đó đã có ở chuyến khác → U1 sửa / bớt / thêm → lưu.
- **Output:** 1 chuyến (1 cont) với dòng hàng thuộc ≥ 1 HĐ; "HĐ của chuyến" = tập HĐ của các dòng. Chuyến chạy 6 bước như 41 (bước 1 Hợp đồng = mọi HĐ của chuyến đủ hồ sơ).
- **End:** chuyến ở Đang làm; lệnh SX lập theo §11 Q7.

### Flow NL4 — Theo dõi HĐ · owner S1
- **Input:** HĐ + mọi dòng chuyến chưa hủy có `contractId` = HĐ + bản lịch đang dùng.
- **Output (mỗi HĐ, bó và kg theo quy cách HĐ):** **Đã giao** = Σ bó dòng của HĐ (thực đóng; chưa có thì kế hoạch, ghi rõ là tạm) · **Còn phải giao** = lượng HĐ − đã giao · **Kế hoạch còn lại** = Σ ô lịch của tháng chưa xuất · **Lệch lịch** = còn phải giao − kế hoạch còn lại (≠ 0 ⇒ báo, không chặn).
- **End:** số ở hồ sơ HĐ, lịch tháng, báo cáo kỳ.

### Flow NL5 — HĐ xong · owner S1 → U2
- Đã giao trong dung sai (kg **và** tiền — HĐ ghi "10 % more or less in quantity and amount", khớp 41 `contractClosure`) **và** mọi chuyến có dòng của HĐ đã khép ⇒ **Chờ duyệt cuối**; U2 đồng ý ⇒ Đã đóng. Phân bổ theo tháng không xét. Hết khung còn thiếu ⇒ H5.

### Flow NL6 — Chứng từ lần xuất gộp · owner U1
- Tờ khai / invoice / packing list / C/O VJ của chuyến mang **số HĐ gốc của từng dòng** (cách trình bày theo §11 Q2, Q3). Chuyến một HĐ ⇒ như nay.

### Flow NL7 — Tiền về · owner U4
- HĐ: TTR 100 % giá trị invoice khi nhận bộ chứng từ ⇒ ghi tiền về theo chuyến như 41. Phần của mỗi HĐ = tiền về × (tiền dòng của HĐ ÷ tiền cả chuyến). Invoice tách theo HĐ (Q3) ⇒ ghi thẳng theo invoice, không cần chia.

### Flow NL8 — Khung ETA · owner S1
- HĐ có "giao từ – tới" + "theo ETA" (BD-009/26: 10/2026 → 09/2027). Chuyến **đúng hạn** khi ETA nằm trong khung; ETA trước tháng đầu ⇒ báo "giao sớm" (không chặn); ETA sau tháng cuối ⇒ trễ. HĐ cũ chỉ có hạn giao muộn nhất ⇒ giữ luật 41 R15.

## 6. Flow optimization log

| Chỗ | Phương án | Chọn / Loại | Lý do (rubric §4) | Đánh giá |
|---|---|---|---|---|
| Mô hình | v0: HĐ tổng → HĐ đợt (cha – con) | **Loại** | Hiểu sai ca: hàng ngang là HĐ độc lập (BD-009/26 chỉ một mã), cột là lần xuất gộp | Chủ dự án (ảnh) |
| Mô hình | **A** giữ chuyến = 1 HĐ, mỗi HĐ một chuyến cùng booking, chứng từ dùng chung | Loại | Thực xuất HĐ mượn invoice = 0, cont đếm 4 lần, nhập 4 lần mỗi tháng (rubric #2, #5) | Optimizer + Domain |
| Mô hình | **B** chuyến thuộc khách; dòng hàng mang HĐ (cột `contract_id` của dòng chuyến đã có, mig 0096); số theo HĐ cộng từ dòng | **Chọn** | 1 cont = 1 chuyến; 6 bước, booking, chứng từ, tiền về một lần; số theo HĐ đúng nhờ dòng; chuyến 1 HĐ cũ không đổi | Orchestrator + Domain |
| Mô hình | **C** bỏ HĐ, chỉ còn đơn theo tháng | Loại | Mất lượng HĐ, dung sai, số khai hải quan theo HĐ (rubric #1) | Domain |
| Lịch | **L1** bảng lịch riêng theo khách, nhiều bản, không sinh chuyến | **Chọn** | Lịch đổi liên tục ⇒ chỉ là kế hoạch; giữ bản cũ để so; chuyến lập khi chốt tháng | Optimizer |
| Lịch | **L2** sinh sẵn 12 chuyến dự kiến, khách đổi thì sửa chuyến | Loại | Mỗi bản mới sửa tới 12 chuyến; mất bản cũ (rubric #5) | Optimizer |
| Lịch | **L3** giữ lịch theo từng HĐ (41 NV19) | Loại | 48 chuyến cho 12 lần xuất | Optimizer |
| Nối lịch ↔ HĐ | gõ tay chọn HĐ cho từng dòng mỗi bản | Loại | Lặp mỗi bản; dùng mã hàng của khách đã có trên tên hàng HĐ ("UCC BRAND-3970") | Optimizer |
| Đơn vị lịch | kg | Loại | Lịch và HĐ đếm **bó** (1.250 bó = 12.500 kg); giữ bó, quy kg theo quy cách HĐ | Chủ dự án (HĐ thật) |
| Xong HĐ | theo từng tháng khớp lịch | Loại | "xuất đủ 1.250 là được"; HĐ cho partial shipment | Chủ dự án + HĐ |
| Hạn giao | giữ "hạn giao muộn nhất theo ETD" | Loại cho HĐ dạng này | HĐ ghi khung **ETA** từ – tới | Domain (HĐ thật) |

**Góc nhìn nghiệp vụ xuất khẩu (Domain):** một cont nhiều HĐ cùng người mua là thường gặp; bộ chứng từ của lô thường một bộ (một B/L, một C/O hoặc mỗi HĐ một bộ tùy khách / ngân hàng). Tờ khai có thể ghi một số HĐ ở ô hợp đồng và kê HĐ còn lại ở phần ghi chú, hoặc tách tờ khai theo HĐ — **chưa xác định cách Baseafood làm** ⇒ §11 Q2. Phần pháp lý cụ thể chưa kiểm.

## 7. Scope

- **IN (đề xuất chia 2 đợt build):**
  - **Đợt 1 — chuyến nhiều HĐ:** NL3 (lập tay), NL4 (trừ phần lịch), NL5, NL6, NL7, NL8, NL9 phần liên quan.
  - **Đợt 2 — lịch gọi hàng:** NL1, NL2, NL3 lập từ cột tháng, NL4 phần kế hoạch còn lại / lệch lịch, nạp file Excel của khách.
- **OUT:** chuyến gộp HĐ của **khác khách** · tự dồn phần thiếu sang tháng sau (không cần — luật xong là tổng lượng) · Nhập khẩu · cột NB / PB của khách.
- **Việc riêng phát hiện khi đọc HĐ:** bộ đọc file HĐ (66) chưa nhận "Reference Number" là số HĐ, chưa đọc cột số lượng "Bundles" / quy cách "B'DL" ⇒ đọc file BD-009/26 sẽ thiếu số HĐ và số bó.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NL3 | số chuyến cho bảng mẫu cả năm | 12 (không 48) |
| NL4 | tổng đã giao của 4 HĐ khi mọi tháng xuất đúng lịch | 13.450 bó, mỗi bó đếm một lần |
| NL5 | BD-009/26 giao 1.250 bó nhưng lệch từng tháng | sang Chờ duyệt cuối |
| NL1 | khách gửi bản mới | 0 chuyến bị tự sửa; bản cũ còn tra được |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Chuyến có ≥ 1 dòng hàng; mỗi dòng thuộc đúng 1 HĐ + 1 dòng HĐ. **HĐ của chuyến** = tập HĐ của các dòng; mọi HĐ đó **cùng khách** | thêm dòng HĐ khách khác ⇒ chặn |
| R2 | Chuyến cũ chưa có dòng ⇒ coi như thuộc `contractId` của nó, mọi luật 41 giữ nguyên | — |
| R3 | Đã giao của HĐ = Σ số bó dòng của HĐ trên chuyến chưa hủy (thực đóng ?? kế hoạch); kg = bó × thùng/bó × kg/thùng của dòng; tiền = kg × đơn giá dòng HĐ (sửa ở invoice thì theo invoice — 63). Chuyến **một** HĐ không có dòng ⇒ theo Commercial Invoice như cũ (41 R7) | BD-009/26: 200 bó = 2.000 kg = 19.300 USD |
| R4 | Ghi chuyến cần `shipmentGate` đạt với **mọi** HĐ của chuyến | một HĐ còn Thiếu hồ sơ ⇒ chặn, nêu đúng HĐ |
| R5 | Bước 1 của chuyến xong khi mọi HĐ của chuyến đủ hồ sơ; bước 2 theo §11 Q7 | — |
| R6 | HĐ khép xét: mọi chuyến **có dòng của HĐ** đã khép + đã giao trong dung sai (lượng và tiền). Không xét từng tháng | — |
| R7 | Số cont, booking, ngày tàu tính **một lần cho chuyến**; đúng hạn / trễ xét theo khung giao của **từng** HĐ trên chuyến | chuyến đúng khung HĐ A, trễ HĐ B |
| R8 | Báo cáo kỳ: cont / chuyến đếm một lần; bó, kg, tiền chia theo HĐ từ dòng ⇒ Σ theo HĐ == Σ chuyến | — |
| R9 | Bộ phận đóng cont ghi số thực đóng được cho dòng của **mọi** HĐ của chuyến (nới trigger 0098: `contract_id` thuộc HĐ của chuyến, cùng khách) | — |
| R10 | Đổi khách của HĐ bị khóa khi một chuyến **có dòng của HĐ** xong bước 4 (41 R44 mở rộng) | — |
| R11 | Lịch gọi hàng: mỗi khách nhiều bản, đúng 1 bản đang dùng (mới nhất theo ngày khách gửi); bản cũ không sửa | hai bản cùng ngày ⇒ bản ghi sau thắng |
| R12 | Ô lịch là **số bó** ≥ 0; tổng mã lệch lượng HĐ ngoài dung sai ⇒ cảnh báo, vẫn lưu; dòng dự báo chưa có HĐ không lập chuyến được tới khi nối HĐ | 3565: 390 bó tháng 10 |
| R13 | Lịch **không** tự tạo, sửa, xóa chuyến; chuyến không sửa lịch | — |
| R14 | HĐ có trong lịch gọi hàng ⇒ không dựng lịch riêng theo HĐ (41 NV19) | HĐ đã có lịch NV19 trước ⇒ báo, U1 tự hủy chuyến trống |
| R15 | Chế độ demo: bảng mới vào bộ demo (QT 15); không quyền xem giá ⇒ không thấy tiền theo HĐ | — |
| R16 | **Nối dòng lịch ↔ HĐ bằng mã hàng của khách:** HĐ đang mở cùng khách có tên hàng chứa đúng mã (VD "UCC BRAND-3970" chứa `3970`, so cả số, không khớp `39701`) **và** khung giao chứa tháng đầu có số của dòng. Đúng 1 HĐ ⇒ nối; 0 ⇒ dòng dự báo; ≥ 2 ⇒ U1 chọn. U1 chọn tay thì giữ ở bản sau | HĐ năm 2027–2028 cùng mã 3970 ⇒ chọn theo khung |
| R17 | Khung giao của HĐ: **từ tháng – tới tháng** + **mốc ETA / ETD** (mặc định ETD như 41). Chuyến tính đúng / trễ theo mốc đã chọn; ngoài khung phía trước ⇒ "giao sớm" (báo, không chặn) | HĐ cũ chỉ có hạn giao ⇒ luật 41 R15 |
| R18 | Cột NB / PB và mọi mã nội bộ khác của khách **không** lưu, không dùng | — |

## 10. Acceptance Criteria (bản phác — chốt §11 xong viết đủ)

### AC-1 — Đã giao chia theo dòng · Maps to: NL4, R3 · Test: unit
- **Given** chuyến tháng 12/2026 khách DAIREI, dòng: BD-009/26 (3970, 10 kg/bó, 9,65 USD/kg) thực đóng 200 bó; HĐ 3192 thực đóng 430 bó; HĐ 3824 thực đóng 500 bó
- **When** tính đã giao từng HĐ
- **Then** BD-009/26 = 200 bó = 2.000 kg = 19.300 USD; tổng chuyến 1.130 bó
- **Assert** `contractDelivered(BD-009/26)` == { units: 200, kg: 2000, amount: 19300 } · Σ bó chuyến == 1130

### AC-2 — HĐ xong khi đủ tổng dù lệch tháng · Maps to: NL5, R6 · Test: unit
- **Given** BD-009/26 lượng 1.250 bó, dung sai 10 %; đã giao 400 (T12) + 300 (T3) + 550 (T6) bó qua 3 chuyến đã khép
- **When** tính trạng thái HĐ
- **Then** Chờ duyệt cuối; cùng số nhưng một chuyến chưa khép ⇒ Đang ghi chuyến
- **Assert** `contractState` == "final-review"; ca thứ hai == "shipping"

### AC-3 — Dung sai 10 % hai đầu · Maps to: NL5, R6 · Test: unit
- **Given** BD-009/26, mọi chuyến đã khép
- **When** đã giao lần lượt 1.120 · 1.125 · 1.375 · 1.380 bó
- **Then** chỉ 1.125 và 1.375 là đủ
- **Assert** `contractClosure.closed` == [false, true, true, false]

### AC-4 — Không đếm đôi cont · Maps to: R7, R8 · Test: unit
- **Given** 12 chuyến tháng theo bảng mẫu, mỗi chuyến 1 cont, xuất đúng lịch
- **When** lập báo cáo năm
- **Then** 12 cont, 13.450 bó; Σ bó theo HĐ == 13.450
- **Assert** cont == 12 · bó == 13450 · Σ theo HĐ == 13450

### AC-5 — Chặn HĐ khách khác / thiếu hồ sơ · Maps to: NL3, R1, R4 · Test: unit
- **Given** chuyến của DAIREI; HĐ X của khách khác; HĐ Y của DAIREI còn Thiếu HĐ đã ký
- **When** thêm dòng X; thêm dòng Y
- **Then** cả hai bị chặn, nêu lý do
- **Assert** lý do X == "customer-mismatch" · lý do Y == "attachments-missing" · số dòng chuyến không đổi

### AC-6 — Nối mã hàng của khách · Maps to: NL1, R16 · Test: unit
- **Given** DAIREI có HĐ BD-009/26 (tên hàng "… (UCC BRAND-3970)", khung 10/2026–09/2027) và HĐ khác tên "… 39701 …"; dòng lịch mã `3970` số đầu ở 12/2026; dòng lịch mã `3565` không HĐ nào chứa
- **When** nối dòng lịch
- **Then** 3970 ⇒ BD-009/26; 3565 ⇒ dự báo
- **Assert** `matchScheduleRow("3970").contractId` == id BD-009/26 · `matchScheduleRow("3565").kind` == "forecast"

### AC-7 — Đề xuất dòng từ cột tháng · Maps to: NL3, R12 · Test: unit
- **Given** bản lịch 09/07/2026; cột 10/2026: 3192 = 430, 3824 = 400, 3970 = 0, 3565 (dự báo) = 390
- **When** đề xuất dòng cho chuyến tháng 10/2026
- **Then** 2 dòng; 3970 bỏ vì 0; 3565 không thành dòng, báo "chưa có HĐ"
- **Assert** số dòng == 2 · Σ bó == 830 · cảnh báo dự báo == 1

### AC-8 — Bản lịch mới không đụng chuyến · Maps to: NL1, R11, R13 · Test: unit
- **Given** bản 09/07/2026 + chuyến tháng 10 đã lập (3192 = 430 bó); khách gửi bản 15/09/2026 đổi 3192 tháng 10 thành 500
- **When** lưu bản mới
- **Then** bản đang dùng = 15/09; bản 09/07 còn; chuyến giữ 430 bó; 1 ô đổi được liệt kê
- **Assert** bản đang dùng == "2026-09-15" · số bản == 2 · bó dòng 3192 trên chuyến == 430 · số ô đổi == 1

### AC-9 — Còn phải giao, lệch lịch · Maps to: NL4 · Test: unit
- **Given** HĐ 3192 lượng 5.000 bó; đã giao 1.060 (T10 430 · T11 200 thay vì 500 · T12 430); bản lịch đang dùng còn lại T1–T9 = 3.640 (khách chưa dồn 300 bó thiếu)
- **When** tính
- **Then** còn phải giao 3.940, kế hoạch còn lại 3.640, lệch 300
- **Assert** còn phải giao == 3940 · kế hoạch còn lại == 3640 · lệch == 300

### AC-10 — Khung ETA · Maps to: NL8, R17 · Test: unit
- **Given** BD-009/26 khung 10/2026 – 09/2027 theo ETA
- **When** xét chuyến ETA 2026-09-28 · 2026-10-02 · 2027-09-30 · 2027-10-03
- **Then** giao sớm · đúng hạn · đúng hạn · trễ
- **Assert** kết quả == ["early", "on-time", "on-time", "late"]

(AC tiền về chia theo HĐ, quyền đóng cont nhiều HĐ, lệnh SX, hướng dẫn / hộp "?", demo — viết sau khi chốt §11.)

## 11. Đã chốt

**Chốt 2026-11-03:** đơn vị lịch = **bó** (HĐ BD-009/26); "Code" = mã sản phẩm của khách, nối HĐ qua tên hàng "… BRAND-<mã>"; NB / PB = mã nội bộ của khách, bỏ qua (chị Thảo). Chủ dự án **duyệt theo đề xuất cả 9 câu dưới** (cột Đề xuất = quyết định).

| # | Câu | Đã chốt |
|---|---|---|
| Q1 | Một cột tháng là **một cont**? Tháng của lịch tính theo **ETA** (như HĐ ghi) hay theo ngày đóng cont / ETD? | Thường một chuyến, cho lập nhiều chuyến một tháng; tháng theo ETA |
| Q2 | Tờ khai của lần xuất gộp: **một tờ khai** ghi nhiều số HĐ, hay **mỗi HĐ một tờ khai**? | Một tờ khai cho chuyến, kê số HĐ theo dòng (chờ xác nhận) |
| Q3 | Commercial Invoice / Packing List / C/O: **một bộ cho cả chuyến** (mỗi dòng ghi số HĐ) hay mỗi HĐ một bộ? | Một bộ cho chuyến, dòng ghi số HĐ |
| Q4 | Khách đổi lịch: lưu **từng bản** để so, hay chỉ giữ bản mới nhất? | Lưu từng bản |
| Q5 | Lịch khách gửi dạng gì (Excel / PDF)? Có cần nạp file thẳng vào app? | Đợt 2 nạp Excel; trước đó gõ tay |
| Q6 | Dòng chưa có HĐ (3565 — 390 bó, "will update"): có ghi vào lịch không? | Có, là dòng dự báo, chưa lập chuyến được |
| Q7 | Lệnh sản xuất của lần xuất gộp: một lệnh cho cả cont hay mỗi HĐ một lệnh? | Mỗi HĐ một lệnh, cùng gắn chuyến |
| Q8 | Hết khung (09/2027) mà HĐ chưa giao đủ: gia hạn hay đóng thiếu? | Như nay: gia hạn giao (41 NV6) hoặc đóng có lý do |
| Q9 | Tiền về: khách trả theo invoice cả chuyến; app chia về HĐ theo tiền từng dòng có đúng cách kế toán theo dõi không? | Có, chia theo tiền dòng |

**Assumptions (fail-closed, tới khi chốt):** mọi HĐ trong một chuyến cùng khách · HĐ giữ nguyên như 41 (lượng, dung sai, hồ sơ) + thêm khung giao từ – tới · chuyến cũ không đổi · không đổi ma trận quyền · quy cách lấy theo dòng HĐ (không giả định 10 kg/bó cho mọi mã).

**Tier build (dự kiến):** 🟡 bảng mới lịch gọi hàng (bản + ô) + khung giao "từ tháng" / mốc ETA trong `terms` (jsonb, không cột mới) + đổi cách tính trong `exportPlanning.ts` có test; 🔴 nới trigger `export_shipment_lines_loading_guard` (R9 — đổi luật quyền, cần chủ dự án đồng ý như 0098). `export_shipment_lines.contract_id` đã có (0096). Ảnh hưởng rộng ở giao diện Xuất khẩu (khoảng 100 chỗ đọc `contractId` của chuyến) ⇒ build tách 2 đợt như §7.

## History

- 2026-11-05 — Phòng KH: "một cont nhiều hợp đồng, mở chuyến ra chưa chọn được cont". DB thật: DAIREI BD-007/008/009 có 31 chuyến **Đóng ghép** (mỗi HĐ mỗi tháng một chuyến, không cont). Chủ dự án chọn hướng A: chuyến Đóng ghép có nút **Đưa vào cont** — hàng thành dòng của HĐ đó trên chuyến cont cùng khách (đúng mô hình R1), chuyến Đóng ghép bỏ; chuyến cont chưa có dòng thì dựng dòng HĐ chính từ kg để kg từng HĐ không đổi. Không migration. `lib/exportConsolidate.ts`, test `exportConsolidate.test.ts`.
- 2026-11-05 — chuyến nay có thể nhiều cont ([73](73-shipment-multi-container.ba-spec.md)): dòng hàng mang cả HĐ lẫn cont; luật đã giao / tiền về theo HĐ không đổi (73 R11, AC-14).
- 2026-11-04 — R9: viết mig 0102 nới trigger đóng cont cho dòng HĐ phụ (chủ dự án đồng ý), kiểm PGlite.
- 2026-11-03 — v1.2: chủ dự án duyệt theo đề xuất 9 câu §11. Build đợt 1a (chuyến gộp nhiều HĐ, chưa có khung ETA / trigger / lịch).
- 2026-11-03 — v1.1: đối chiếu HĐ thật BD-009/26 (DAIREI, UCC BRAND-3970, 1.250 bó = 12.500 kg, 9,65 USD/kg, ± 10 %, partial shipment, khung **ETA** 10/2026–09/2027, TTR theo invoice). Đơn vị lịch = bó; nối lịch ↔ HĐ bằng mã hàng của khách (R16); thêm khung giao ETA (NL8, R17); NB / PB bỏ qua (R18). AC đổi sang bó, thêm AC-3, AC-6, AC-10.
- 2026-11-03 — v1: phân tích lại theo ảnh lịch gọi hàng (4 HĐ + 1 dòng dự báo, 10/2026 → 09/2027). Mô hình: chuyến nhiều HĐ cùng khách + lịch gọi hàng nhiều bản, không sinh chuyến. Bỏ v0.
- 2026-11-03 — v0 (bỏ): HĐ tổng → HĐ đợt. Hiểu sai: tưởng một HĐ khung chia đợt, thực ra nhiều HĐ song song gộp theo tháng.
