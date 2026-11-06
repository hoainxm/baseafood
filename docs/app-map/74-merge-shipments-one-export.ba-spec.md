# 74 — ba-spec: Một lần xuất của nhiều hợp đồng = một chuyến (gộp chuyến trùng, chặn trùng khi lập lịch)

> Load khi: hai hay nhiều chuyến của các HĐ cùng khách thật ra là **một lần xuất** (cùng booking, cùng ngày đóng cont) mà app đang ghi thành nhiều chuyến; gộp chuyến đã có file / mục / lệnh sản xuất; lập lịch xuất hàng cho HĐ mới khi khách đã có chuyến cùng ngày; Lịch xuất hàng hiện một dòng cho một lần xuất.
covers: src/lib/exportConsolidate.ts, src/lib/exportPlanning.ts, src/lib/exportDaySchedule.ts, src/features/export-planning/
last_verified: 2026-11-06
ttl_days: 90
status: **v1 ĐÃ CHỐT + ĐÃ BUILD** (2026-11-06 — chủ dự án "Duyệt, build luôn": §11 theo đề xuất). Luật `lib/exportMergeShipments.ts` (+ `productionOrderMissingContracts` ở `exportPlanning.ts`, `issuedOrderContracts` ở `productionOrder.ts`), test `lib/exportMergeShipments.test.ts` (AC-1…17; AC-18 = `pageTourCoverage`; AC-19 thử tay trên dữ liệu thật sau deploy); hộp `MergeExportDialog.tsx`, Lịch xuất hàng `MonthView.tsx`, hồ sơ chuyến, lịch HĐ `ScheduleRowsEditor`. Mở rộng [70](70-call-off-schedule-multi-contract.ba-spec.md) (mô hình B: chuyến nhiều HĐ cùng khách) và [73](73-shipment-multi-container.ba-spec.md) R13 (gộp làm cont thêm); không đổi mô hình dữ liệu, không migration.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của design-spec [42](42-export-planning-ui.design-spec.md)). Luật 6 bước, đã giao theo HĐ, tiền về theo HĐ của 70 / 73 giữ nguyên.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-06: "1 lịch xuất hàng của 2 chuyến nhưng hiện 2 dòng khác nhau. Chuyến ngày 6/11 của 2 hợp đồng BD-007/26 và BD-008/26. Các bước từ lệnh sản xuất cho đến cuối là dùng chung, hiện 2 record thì phải import 2 lần."
- **Dữ liệu thật (đọc DB 2026-11-06, khách DAIREI CO., LTD):**

| Ngày đóng | Chuyến đang mở | Ghi chú |
|---|---|---|
| 06/11/2026 | BD-007/26 · 20RF · 4.000 kg · 1 file — BD-008/26 · 20RF · 3.000 kg · 3 file | **cùng booking SGNGCZ486800**, cùng tàu NYK FUTAGO 0109E. File booking đính **2 lần** (2 người). Forwarder đã lệch: "Phương Anh Phạm" ↔ "NYD LINE COMPANY LIMITED". Thông tin xe + ảnh cont / seal chỉ có ở chuyến BD-008 |
| 03/10/2026 | BD-007 · BD-008 — Đóng ghép | cùng booking 039GY09130 |
| 28/11/2026 → 26/08/2027 (10 ngày) | 2–4 chuyến Đóng ghép mỗi ngày (BD-007 / 008 / 009 / 010) | lịch từng HĐ dựng cùng ngày ⇒ mỗi HĐ một chuyến |

  Tổng: **35 chuyến mở cho 13 lần xuất**. Chưa chuyến nào có dòng hàng hay lệnh sản xuất gắn ⇒ dọn bây giờ rẻ nhất. 12 nhóm trùng (34 chuyến) + 1 chuyến lẻ chưa có ngày (BD-010, 40RF).

- **Vì sao app không gộp được (kiểm code 2026-11-06):**
  1. **Đưa vào cont** (70 History 05/11) chỉ nhận chuyến nguồn là **Đóng ghép** và **chưa có file** ⇒ cặp 06/11 (đều 20RF, đã có 4 file) bị chặn.
  2. **Gộp làm cont thêm** (73 R13) chỉ nhận chuyến **cùng HĐ chính**, chưa có file ⇒ chặn.
  3. **Lịch xuất hàng theo HĐ** (41 NV19) mỗi dòng lịch sinh một chuyến mới, không xét khách đã có chuyến cùng ngày ⇒ HĐ thứ hai, ba, tư của DAIREI sinh chuyến trùng.
  4. Ghi booking cho chuyến không xét booking đó đã nằm ở chuyến khác cùng khách ⇒ người thứ hai gõ lại toàn bộ booking, đính lại file.
  5. Dòng của Lịch xuất hàng chỉ ghi HĐ chính của chuyến ⇒ chuyến gộp nhiều HĐ trông như của một HĐ.
- **Job:** Khi một booking / một ngày đóng cont chở hàng của nhiều HĐ cùng khách, Nhân viên Kế hoạch muốn làm **một lần** các bước Lệnh sản xuất → Bao bì → Đóng cont → Chứng từ → Tiền về cho cả lần xuất, và mỗi HĐ vẫn tự biết đã giao bao nhiêu.
- **Đo thành công:** cặp 06/11 thành 1 chuyến 7.000 kg giữ đủ 4 file, booking chỉ còn một bản; DAIREI còn 13 chuyến mở (từ 35); HĐ mới lập lịch trùng ngày với chuyến có sẵn ⇒ 0 chuyến mới.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch | `export-plans` thêm / sửa / xóa | lập lịch, ghi booking, gộp chuyến, chứng từ |
| U2 | Trưởng / Phó phòng Kế hoạch | `export-plans` + duyệt | như U1; duyệt cuối HĐ (41) |
| U3 | Bộ phận đóng cont | `export-plans.loading` | đính ảnh cont / seal, ghi số thực đóng trên chuyến — chỉ xem kết quả gộp |
| U5 | Người lập Lệnh sản xuất (Phòng KH) | `production-orders` | lệnh gắn chuyến; sau gộp lệnh phải còn gắn đúng lần xuất |
| S1 | Hệ thống | — | dò chuyến trùng, gộp, cộng kg / đã giao theo HĐ |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| GC1 | Dò **chuyến có thể cùng một lần xuất** và báo ở Lịch xuất hàng + hồ sơ chuyến | S1 | U1 | 70 R1 | liên tục | Must |
| GC2 | **Gộp** 2…n chuyến của các HĐ cùng khách thành một chuyến, mang theo file, mục bước, lệnh sản xuất, booking, thông tin xe | U1 | U3, U5 | GC1 hoặc chọn tay | khi trùng | Must |
| GC3 | **Chặn trùng khi tạo**: lập lịch HĐ / ghi chuyến / ghi booking mà khách đã có chuyến mở cùng ngày hoặc cùng booking ⇒ đề xuất đi chung chuyến có sẵn | U1 | S1 | 41 NV19, 71 | mỗi HĐ mới / mỗi booking | Must |
| GC4 | Lịch xuất hàng: **một lần xuất = một dòng**, ghi mọi HĐ trên chuyến + kg từng HĐ | S1 | U1, U2, U3 | 57 | liên tục | Must |
| GC5 | Bước 2 Lệnh sản xuất của chuyến nhiều HĐ xét **từng HĐ** | S1 | U5 | 70 Q7, 48 | mỗi chuyến | Must |
| GC6 | Hướng dẫn thao tác + hộp "?" + sơ đồ workflow (QT 18, 21) | S1 | U1 | GC1–GC5 | khi đổi | Must |

## 4. Cross-user handoff

| Chặng | Từ | → Nhận | Điều kiện | Nếu không ai nhận |
|---|---|---|---|---|
| H1 | S1 dò trùng | U1 | ≥ 2 chuyến mở cùng khách thỏa R1 | dấu "Có thể trùng lần xuất" nằm ở ngày đó tới khi gộp hoặc U1 chọn **Giữ riêng** (R3) |
| H2 | U1 gộp | U3 | chuyến bỏ có ảnh / số thực đóng của U3 | ảnh + số đi theo sang chuyến giữ (R7); U3 mở link chuyến cũ ⇒ được đưa tới chuyến giữ (R12) |
| H3 | U1 gộp | U5 | chuyến bỏ có lệnh sản xuất gắn | lệnh gắn sang chuyến giữ (R8), không cần U5 làm gì |

Không thêm user, không đổi ma trận quyền.

## 5. Flows

### Flow GC1 — Dò chuyến cùng một lần xuất · owner S1
- **Input:** mọi chuyến **đang mở** (không hủy, chưa khép) của cùng một khách.
- **Steps:** nhóm theo R1 (cùng booking; hoặc cùng ngày đóng cont mà ít nhất một bên chưa booking) → bỏ nhóm U1 đã chọn Giữ riêng (R3).
- **Output:** danh sách nhóm, mỗi nhóm ≥ 2 chuyến + lý do ("cùng booking SGNGCZ486800" / "cùng ngày đóng 28/11/2026").
- **End:** dấu trên ngày của Lịch xuất hàng + hồ sơ từng chuyến trong nhóm; mất khi gộp hoặc Giữ riêng.

### Flow GC2 — Gộp thành một lần xuất · owner U1
- **Start:** U1 chọn một nhóm của GC1, hoặc chọn tay các chuyến cùng khách.
- **Input:** 2…n chuyến mở cùng khách; chuyến **giữ** (mặc định theo R4, U1 đổi được); cách gộp: **cùng một cont** (mặc định) hoặc **mỗi chuyến một cont** (thành cont thêm — 73 R13 mở rộng cho HĐ khác).
- **Steps:**
  1. S1 kiểm cổng R5 cho từng chuyến bỏ; trượt ⇒ nêu đích danh chuyến + lý do, không gộp.
  2. S1 kê **ô lệch** (R6): ô hai bên đều có giá trị mà khác nhau. U1 chọn giá trị cho từng ô (mặc định của chuyến giữ). Không lệch ⇒ bỏ qua bước này.
  3. U1 xác nhận ⇒ S1 ghi một lần (R7–R10).
- **Output:** 1 chuyến: HĐ chính = HĐ của chuyến giữ; dòng hàng của mọi HĐ; kg kế hoạch = tổng; mọi file, mục bước có tiến độ, lệnh sản xuất, cont thêm của các chuyến bỏ nằm trên chuyến giữ; các chuyến bỏ biến mất; nhật ký ghi "Gộp chuyến … (HĐ …) vào chuyến … (HĐ …)" + ô đã chọn.
- **End:** thông báo đã gộp + **Hoàn tác** (R11). Mỗi HĐ trên chuyến vẫn tính đã giao theo dòng (70 R3).

### Flow GC3 — Chặn trùng khi tạo · owner U1
- **Start (3 cửa):** (a) lập lịch xuất hàng của HĐ (form Lập HĐ mục Lịch, hoặc Tạo lịch ở hồ sơ HĐ); (b) ghi một chuyến lẻ; (c) ghi / đọc file booking cho một chuyến.
- **Input:** khách của HĐ; ngày đóng cont / booking của dòng đang ghi; chuyến mở cùng khách.
- **Steps:**
  - (a), (b): dòng lịch / chuyến có ngày đóng (hoặc booking) trùng chuyến mở của HĐ khác cùng khách ⇒ S1 đề xuất **Đi chung chuyến** đó, chọn sẵn. U1 giữ đề xuất hoặc chọn **Tạo chuyến riêng**.
  - (c): booking vừa ghi đã có ở chuyến mở khác cùng khách ⇒ S1 báo "Booking này đã có ở chuyến … (HĐ …)" + mời gộp (Flow GC2). Vẫn lưu được.
- **Output:** dòng chọn Đi chung ⇒ **không** sinh chuyến mới; HĐ này thành dòng hàng trên chuyến có sẵn (dựng từ kg như R9), kg chuyến cộng thêm. Dòng chọn Tạo chuyến riêng ⇒ như luật cũ, GC1 vẫn báo trùng.
- **End:** lưu một lần, một Hoàn tác (như 41 NV19).

### Flow GC4 — Một lần xuất một dòng · owner S1
- **Input:** chuyến của kỳ xem (57).
- **Output (mỗi chuyến):** mọi HĐ của chuyến, HĐ chính trước, các HĐ còn lại theo số HĐ; kg kế hoạch tổng + kg từng HĐ; số chuyến của ngày đếm chuyến, không đếm HĐ (57 R3 giữ). Lọc khách, tra cứu theo số HĐ phụ cũng ra chuyến đó.
- **End:** dòng của Lịch xuất hàng, Excel xuất từ lịch.

### Flow GC5 — Bước 2 của chuyến nhiều HĐ · owner S1
- **Input:** chuyến + HĐ của chuyến + lệnh sản xuất đã phát hành gắn chuyến.
- **Output:** bước 2 **Xong** khi **mọi** HĐ có hàng trên chuyến có ≥ 1 lệnh đã phát hành của HĐ đó gắn chuyến (hoặc mục Lệnh sản xuất Không áp dụng); thiếu ⇒ **Đang làm** + "Còn HĐ … chưa có lệnh sản xuất". Chuyến một HĐ ⇒ luật cũ (48 R6).
- **End:** bước 3 → 6 làm một lần cho chuyến (70 R7, 73).

### Flow GC6 — Nội dung hướng dẫn · owner S1
- Xem §9b.

## 6. Flow optimization log

| Chỗ | Phương án | Chọn / Loại | Lý do (rubric §4) | Đánh giá |
|---|---|---|---|---|
| Cách sửa | **A** nới "Đưa vào cont" cho mọi loại chuyến, vẫn cấm chuyến có file | Loại | Cặp 06/11 đã có 4 file ⇒ vẫn chặn; người dùng phải xóa file rồi đính lại (rubric #3 treo) | Optimizer |
| Cách sửa | **B** gộp tổng quát mang theo file, mục bước, lệnh sản xuất, ô booking / xe; ô lệch hỏi U1 | **Chọn** | Gộp được dữ liệu đã nhập dở; đúng mô hình 70 (1 lần xuất = 1 chuyến); không migration | Orchestrator + Domain |
| Cách sửa | **C** giữ 2 chuyến, chứng từ "dùng chung" | Loại | Đúng cái 70 đã loại: booking, xe, ảnh vẫn gõ 2 lần; cont đếm 2 (rubric #5) | Domain |
| Cách sửa | **D** chỉ hiển thị chung một dòng, dữ liệu vẫn 2 chuyến | Loại | Không hết "import 2 lần" — đúng lời than (rubric #1) | Orchestrator |
| Dò trùng | chỉ cùng booking | Loại | 31 chuyến Đóng ghép kế hoạch chưa booking, chỉ có ngày ⇒ không dò ra | Optimizer |
| Dò trùng | cùng tháng | Loại | 70 Q1 cho nhiều chuyến một tháng ⇒ báo sai nhiều | Optimizer |
| Dò trùng | **cùng booking, hoặc cùng ngày đóng khi một bên chưa booking** | **Chọn** | Bắt cả 12 nhóm thật; hai chuyến cùng ngày nhưng khác booking là hai lần xuất thật ⇒ không báo | Optimizer + Domain |
| Phòng trùng | chặn cứng khi trùng | Loại | Khách đòi chứng từ riêng từng cont vẫn hợp lệ (73 cuối, 41 R5) | Domain |
| Phòng trùng | **đề xuất Đi chung, chọn sẵn; cho Tạo chuyến riêng** | **Chọn** | Ít bước cho ca thường (DAIREI), vẫn có lối ra cho ca hiếm | Optimizer |
| Ô lệch | chuyến giữ thắng, không hỏi | Loại | Forwarder 06/11 lệch, có thể mất giá trị đúng (rubric #2) | Domain |
| Ô lệch | hỏi mọi ô | Loại | 30+ ô, phần lớn trống một bên (rubric #5) | Optimizer |
| Ô lệch | **chỉ hỏi ô hai bên đều có mà khác; ô trống lấy bù** | **Chọn** | 06/11 chỉ hỏi 1 ô (forwarder) | Optimizer |
| Thông tin xe | trộn từng ô của hai chuyến | Loại | Ra tài xế của xe này + biển số xe kia (Domain: sai người nhận hàng ở bãi) | Domain |
| Thông tin xe | **lấy nguyên khối của một chuyến** | **Chọn** | Khối xe chỉ có nghĩa khi đi cùng nhau | Domain |
| Chuyến giữ | HĐ số nhỏ nhất | Loại | 06/11: BD-007 có ít dữ liệu hơn ⇒ hỏi nhiều ô hơn | Optimizer |
| Chuyến giữ | **nhiều tiến độ nhất (R4), U1 đổi được** | **Chọn** | Ít ô lệch nhất, ít file phải chuyển nhất | Optimizer |
| Dọn dữ liệu cũ | gộp từng cặp | Loại | 12 nhóm, có nhóm 4 chuyến ⇒ 22 lần thao tác | Optimizer |
| Dọn dữ liệu cũ | **gộp cả nhóm một lần** | **Chọn** | 12 lần thao tác cho 34 chuyến | Optimizer |
| Dọn dữ liệu cũ | sửa thẳng DB bằng SQL | Loại | Sổ sách thật, không Hoàn tác, không nhật ký (CLAUDE.md) | Orchestrator |
| Bước 2 | giữ "≥ 1 lệnh gắn chuyến là Xong" | Loại | HĐ BD-008 chưa có lệnh mà bước 2 Xong ⇒ hàng BD-008 không ai sản xuất (rubric #3 dead-end) | Domain (SX) |
| Bước 2 | một lệnh cho cả cont | Loại | 70 Q7 đã chốt mỗi HĐ một lệnh; 48 lệnh một HĐ | — |
| Bước 2 | **mỗi HĐ trên chuyến có lệnh** | **Chọn** | Bước 2 Xong nghĩa là mọi hàng trên cont đã có lệnh | Domain (SX) |

**Domain-Specialist (xuất khẩu):** một booking thường là một cont (ở đây "1X20RF") ⇒ hai chuyến cùng booking gần như chắc là một lần xuất; trường hợp ngoại lệ là booking nhiều cont mà khách đòi bộ chứng từ riêng từng cont — đã có lối ra Giữ riêng / Tạo chuyến riêng. Forwarder là hãng tàu / đại lý (NYD LINE), không phải tên người ⇒ ô lệch phải hỏi, không tự chọn.

**Cross-User-Integrity:** 0 điểm gãy sau khi thêm R12 (link cũ của U3 / Việc của tôi trỏ tới chuyến đã bỏ) và R8 (lệnh của U5 không mồ côi).

## 7. Scope

- **IN:** GC1–GC6; dọn 12 nhóm thật của DAIREI **bằng chính chức năng gộp** (U1 làm trên app, có nhật ký + Hoàn tác).
- **OUT:** gộp chuyến khác khách (70 R1) · tách ngược một chuyến nhiều HĐ thành nhiều chuyến (dùng Hoàn tác ngay sau gộp; về sau: bỏ dòng HĐ khỏi chuyến + lập chuyến mới như luật cũ) · lịch gọi hàng của khách (70 đợt 2) · đổi luật đã giao / tiền về / chứng từ.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| GC2 | cặp 06/11 sau gộp | 1 chuyến · 7.000 kg · 4 file · 1 booking · 2 HĐ |
| GC2 | DAIREI sau dọn | 13 chuyến mở (từ 35); tổng kg kế hoạch không đổi |
| GC3 | HĐ mới có 12 dòng lịch trùng ngày 12 chuyến có sẵn | 0 chuyến mới |
| GC1 | báo sai: 2 chuyến cùng khách cùng ngày khác booking | 0 nhóm |
| GC4 | ngày 06/11 trên Lịch xuất hàng | 1 dòng, ghi đủ 2 số HĐ |

## 9. Rules & Invariants

| # | Luật | Ví dụ / biên |
|---|---|---|
| R1 | **Nhóm có thể trùng** = ≥ 2 chuyến **mở**, **cùng khách**, và (a) cùng booking (so bỏ khoảng trắng, không phân biệt hoa thường), hoặc (b) cùng ngày đóng cont mà ít nhất một chuyến chưa có booking. Hai chuyến cùng ngày, **khác** booking ⇒ không cùng nhóm. Chuyến hủy / đã khép không xét | 06/11: (a). 28/11: (b), 3 chuyến |
| R2 | Nhóm tính bắc cầu: A trùng B, B trùng C ⇒ một nhóm A B C | 27/03/2027: 4 chuyến một nhóm |
| R3 | **Giữ riêng**: U1 đánh dấu nhóm là hai lần xuất khác nhau ⇒ không báo nữa cho đúng tập chuyến đó; thêm chuyến mới vào nhóm ⇒ báo lại | lưu trong ghi chú hệ thống của chuyến, không cột mới (§11 A3) |
| R4 | **Chuyến giữ mặc định** = chuyến có nhiều tiến độ nhất: số file → số mục bước Xong → số ô booking + xe đã điền → tạo sớm hơn. U1 đổi được trước khi gộp | 06/11: BD-008 (3 file, có xe) |
| R5 | **Cổng gộp** cho từng chuyến bỏ: mở; cùng khách với chuyến giữ; HĐ của nó còn mở + có bản đang dùng; **không** có lần gửi chứng từ / tiền về (bước 6) ở chuyến bỏ **lẫn chuyến giữ** (build: thêm hàng vào lần xuất đã gửi chứng từ là sai invoice); không có mục cùng loại mà **cả hai** chuyến đều đã có tiến độ (Xong, có số, có file) — nêu đích danh mục. Chuyến bỏ đã có file hoặc mục Xong ⇒ HĐ của nó còn phải qua cổng thêm HĐ (70 R4: không còn hồ sơ **Thiếu**); chuyến chỉ là kế hoạch (chưa file, chưa mục Xong) ⇒ chỉ cần HĐ mở + có bản (như 41 R40) | hai chuyến đều có Commercial Invoice Xong ⇒ chặn "Mục Commercial Invoice đã làm ở cả hai chuyến" |
| R6 | **Ô lệch**: ô của chuyến (booking 12 trường, ngày đóng, ETD, ETA, tàu, cảng, loại cont, số cont, seal, mã lô) — chuyến giữ trống ⇒ lấy của chuyến bỏ; cả hai có mà khác ⇒ U1 chọn. **Thông tin xe** lấy nguyên khối của một chuyến (mặc định chuyến giữ; chuyến giữ không có khối xe ⇒ khối của chuyến bỏ). Ghi chú nối cả hai | 06/11: 1 ô lệch (forwarder); khối xe lấy của BD-008 |
| R7 | **File**: mọi file của chuyến bỏ chuyển sang chuyến giữ, giữ nguyên người đính + ngày. Cùng một cont ⇒ ảnh cont / seal gắn cont 1; mỗi chuyến một cont ⇒ gắn cont thêm mới. File trùng tên cùng mục giữ cả hai và báo "n file trùng tên" (không tự xóa — QT 6) | 06/11: 2 file booking trùng tên ⇒ còn cả hai + báo |
| R8 | **Mục bước + lệnh**: mục cùng loại — chuyến giữ chưa có tiến độ mà chuyến bỏ có ⇒ dùng mục của chuyến bỏ; còn lại giữ của chuyến giữ, mục trống của chuyến bỏ bỏ đi. Mục "dùng chung" ở chuyến khác đang trỏ tới mục của chuyến bỏ ⇒ trỏ sang mục tương ứng của chuyến giữ. Lệnh sản xuất gắn chuyến bỏ ⇒ gắn chuyến giữ, không gắn trùng | — |
| R9 | **Dòng hàng + kg**: như `consolidateInto` (70 History 05/11) — chuyến chưa có dòng ⇒ dựng dòng HĐ từ kg (HĐ một dòng: số kiện = kg ÷ kg mỗi kiện; nhiều dòng: dòng trống + nhắc); kg kế hoạch = tổng các chuyến; đã giao của mỗi HĐ không đổi sau gộp | 4.000 + 3.000 = 7.000 kg; BD-007 vẫn 4.000 kg |
| R10 | **Loại chuyến sau gộp**: loại của chuyến giữ; chuyến giữ là Đóng ghép mà có chuyến bỏ là cont lạnh ⇒ lấy loại cont lạnh (chuyến giữ đổi thành chuyến cont). Mọi chuyến đều Đóng ghép ⇒ vẫn Đóng ghép (lần xuất chưa chọn cont; đổi loại khi có booking) | — |
| R11 | **Một lần ghi, một Hoàn tác**: Hoàn tác trả về đúng các chuyến, dòng, file, mục, lệnh gắn như trước gộp. Nhật ký Xuất khẩu ghi một dòng gộp + từng ô lệch đã chọn | — |
| R12 | Mở chuyến đã bị gộp (link cũ, Việc của tôi, tìm kiếm) ⇒ đưa tới chuyến giữ + báo "Chuyến này đã gộp vào chuyến … ngày …" (tra nhật ký gộp) | U3 bấm link Zalo cũ |
| R13 | **GC3**: dòng lịch / chuyến lẻ của HĐ X có ngày đóng (hoặc booking) thỏa R1 với chuyến mở của HĐ khác cùng khách ⇒ đề xuất Đi chung chuyến đó (nhiều chuyến khớp ⇒ cùng booking trước, rồi ngày gần nhất). HĐ X phải qua cổng như R5 (chuyến kế hoạch ⇒ chỉ cần HĐ mở + có bản) | BD-011 lập 12 dòng lịch trùng 12 ngày ⇒ 12 đề xuất |
| R14 | **GC5**: chuyến ≥ 2 HĐ ⇒ bước 2 Xong khi mọi HĐ có dòng trên chuyến có ≥ 1 lệnh đã phát hành của HĐ đó gắn chuyến, hoặc mục Lệnh sản xuất Không áp dụng. Chuyến một HĐ ⇒ 48 R6 không đổi | 06/11 sau gộp: có lệnh BD-008, chưa có BD-007 ⇒ Đang làm |
| R15 | Quyền: gộp cần `export-plans` **sửa + xóa** (gộp bỏ chuyến). Không đổi ma trận quyền | Kế toán không gộp được |
| R16 | Chế độ demo: chạy trên `site-demo` như mọi thao tác; không bảng mới ⇒ không đổi DemoBundle | — |

## 9b. Kiểm kê nội dung (GC6)

| Mục người đọc gặp | Nguồn | Nội dung phải nói |
|---|---|---|
| Dấu "Có thể trùng lần xuất" | R1, R2 | vì sao báo (cùng booking / cùng ngày), các chuyến trong nhóm, việc tiếp: Gộp hoặc Giữ riêng |
| Gộp thành một lần xuất | R4–R11 | chuyến giữ là gì + đổi được; cái gì đi theo (file, mục, lệnh, booking, xe); ô lệch phải chọn; Hoàn tác |
| Lý do không gộp được | R5 | từng lý do bằng lời người dùng (đã gửi chứng từ / tiền về; cùng mục đã làm ở hai chuyến; HĐ thiếu hồ sơ) |
| Đi chung chuyến (khi lập lịch) | R13 | dòng nào sẽ đi chung, chuyến nào, Tạo chuyến riêng khi nào hợp lý |
| Bước 2 của chuyến nhiều HĐ | R14 | Xong khi mọi HĐ có lệnh; Đang làm kể HĐ thiếu |
| "Chuyến này đã gộp vào…" | R12 | sang chuyến nào, ai gộp, ngày |

Văn phong theo [`src/design-system/README.md`](../../src/design-system/README.md) + ghi nhớ "Hướng dẫn phải giải thích trạng thái".

## 10. Acceptance Criteria

### AC-1 — Dò cặp 06/11 cùng booking · Maps to: GC1, R1 · Test: unit
- **Given** khách DAIREI có chuyến A (BD-007/26, 20RF, booking "SGNGCZ486800", đóng 06/11) và B (BD-008/26, 20RF, booking "sgngcz 486800", đóng 06/11), đều mở
- **When** dò nhóm trùng của kỳ
- **Then** có một nhóm gồm A và B, lý do cùng booking
- **Assert:** số nhóm == 1 · số chuyến trong nhóm == 2 · lý do == "booking"

### AC-2 — Không báo sai · Maps to: GC1, R1 · Test: unit
- **Given** (a) hai chuyến cùng ngày, khác booking, cùng khách; (b) hai chuyến cùng booking, khác khách; (c) một trong hai chuyến đã hủy
- **When** dò nhóm trùng
- **Then** không có nhóm nào
- **Assert:** số nhóm == 0 cho cả 3 ca

### AC-3 — Cùng ngày, chưa booking, bắc cầu · Maps to: GC1, R1, R2 · Test: unit
- **Given** ngày 27/03/2027 có 4 chuyến Đóng ghép chưa booking của BD-007 / 008 / 009 / 010
- **When** dò nhóm trùng
- **Then** một nhóm 4 chuyến, lý do cùng ngày đóng
- **Assert:** số nhóm == 1 · số chuyến == 4 · lý do == "loading-date"

### AC-4 — Giữ riêng tắt dấu · Maps to: GC1, R3 · Test: unit
- **Given** nhóm A B của AC-1 đã được đánh dấu Giữ riêng
- **When** dò lại; rồi thêm chuyến C cùng booking và dò lại
- **Then** lần đầu không báo; lần sau báo nhóm A B C
- **Assert:** lần 1 số nhóm == 0 · lần 2 số nhóm == 1 và số chuyến == 3

### AC-5 — Gộp cặp 06/11 · Maps to: GC2, R4, R6, R7, R9 · Test: unit
- **Given** A (4.000 kg, 1 file booking, forwarder "Phương Anh Phạm", không khối xe), B (3.000 kg, 3 file, forwarder "NYD LINE COMPANY LIMITED", khối xe đủ), không dòng hàng
- **When** tính chuyến giữ mặc định rồi gộp A vào B, chọn forwarder của B
- **Then** chuyến giữ là B; còn 1 chuyến, HĐ của chuyến là BD-008 và BD-007; kg 7.000; 4 file trên B; khối xe của B; ô lệch kê đúng một ô; báo 2 file booking trùng tên
- **Assert:** chuyến giữ == B · số chuyến của khách ngày 06/11 == 1 · plannedKg == 7000 · số HĐ của chuyến == 2 · số file của B == 4 · số ô lệch == 1 (forwarder) · forwarder == "NYD LINE COMPANY LIMITED" · driverName == "Nguyễn Xuân Huy" · số file trùng tên == 2

### AC-6 — Đã giao của từng HĐ không đổi · Maps to: GC2, R9 · Test: unit
- **Given** trước gộp kg kế hoạch BD-007 = 4.000, BD-008 = 3.000 (mỗi HĐ một dòng hàng, 10 kg mỗi kiện)
- **When** gộp như AC-5
- **Then** kg kế hoạch theo HĐ trên chuyến gộp bằng trước gộp
- **Assert:** kg BD-007 == 4000 · kg BD-008 == 3000 · số kiện BD-007 == 400

### AC-7 — Cổng chặn nêu đích danh · Maps to: GC2, R5 · Test: unit
- **Given** (a) cả A và B đều có Commercial Invoice Xong; (b) A đã ghi đã gửi chứng từ; (c) A có file và HĐ của A còn hồ sơ Thiếu; (d) A khác khách
- **When** kiểm cổng gộp A vào B
- **Then** không gộp, lý do đúng từng ca, có tên mục / HĐ
- **Assert:** ok == false · lý do lần lượt == "both-progress" (mục "commercial-invoice") · "sent-or-paid" · "contract-blocked" (HĐ của A) · "customer-mismatch"

### AC-8 — Chuyến kế hoạch gộp được khi HĐ còn Thiếu hồ sơ · Maps to: GC2, R5 · Test: unit
- **Given** A, B là chuyến Đóng ghép kế hoạch (chưa file, chưa mục Xong); HĐ của A còn hồ sơ Thiếu nhưng có bản đang dùng
- **When** kiểm cổng gộp A vào B
- **Then** gộp được
- **Assert:** ok == true

### AC-9 — Mục bước, dùng chung, lệnh sản xuất đi theo · Maps to: GC2, R8 · Test: unit
- **Given** A có mục Health Certificate Xong (B chưa làm), chuyến C có mục trỏ "dùng chung" tới Packing List của A, lệnh sản xuất L1 gắn A và L1 cũng gắn B
- **When** gộp A vào B
- **Then** Health Certificate Xong trên B; mục của C trỏ tới Packing List của B; L1 gắn B đúng một lần; không mục nào trỏ tới A
- **Assert:** trạng thái HC của B == "done" · sharedFromId của C == id Packing List của B · số dòng gắn (L1, B) == 1 · số mục / file / gắn lệnh còn trỏ A == 0

### AC-10 — Loại chuyến sau gộp · Maps to: GC2, R10 · Test: unit
- **Given** (a) giữ chuyến Đóng ghép, bỏ chuyến 20RF; (b) mọi chuyến Đóng ghép
- **When** gộp
- **Then** (a) chuyến gộp là 20RF; (b) vẫn Đóng ghép
- **Assert:** kind (a) == "20RF" · kind (b) == "consolidated"

### AC-11 — Gộp cả nhóm một lần + Hoàn tác · Maps to: GC2, R11 · Test: unit
- **Given** nhóm 4 chuyến của AC-3 (4.300 + 5.000 + 2.000 + 4.000 kg)
- **When** gộp cả nhóm vào một chuyến rồi Hoàn tác
- **Then** sau gộp còn 1 chuyến, 4 HĐ, kg = 15.300; sau Hoàn tác dữ liệu bằng đúng trước gộp
- **Assert:** sau gộp số chuyến == 1 · số HĐ == 4 · plannedKg == 15300 · sau Hoàn tác shipments, items, files, shipmentLines, gắn lệnh deep-equal bản trước

### AC-12 — Lập lịch HĐ mới đi chung chuyến có sẵn · Maps to: GC3, R13 · Test: unit
- **Given** DAIREI có chuyến mở đóng 28/11/2026 (BD-007); lập lịch cho HĐ BD-011/26 cùng khách, một dòng ngày đóng 28/11/2026, 2.000 kg
- **When** dựng lịch và lưu với đề xuất mặc định
- **Then** dòng đó đề xuất đi chung chuyến 28/11; lưu không sinh chuyến mới; chuyến 28/11 thêm hàng BD-011, kg cộng 2.000
- **Assert:** đề xuất == id chuyến 28/11 · số chuyến mới == 0 · số HĐ của chuyến 28/11 tăng 1 · plannedKg tăng 2000

### AC-13 — Tạo chuyến riêng vẫn được · Maps to: GC3, R13 · Test: unit
- **Given** như AC-12, U1 chọn Tạo chuyến riêng cho dòng đó
- **When** lưu
- **Then** sinh 1 chuyến mới như luật cũ; dò trùng báo nhóm 28/11
- **Assert:** số chuyến mới == 1 · số nhóm trùng chứa chuyến mới == 1

### AC-14 — Ghi booking trùng báo nhưng vẫn lưu · Maps to: GC3, R13 · Test: unit
- **Given** chuyến A của BD-007 có booking SGNGCZ486800; ghi booking này cho chuyến B của BD-008 cùng khách
- **When** kiểm booking trước khi lưu
- **Then** trả về chuyến A làm chuyến trùng; lưu không bị chặn
- **Assert:** số chuyến trùng == 1 (A) · kết quả lưu ok == true

### AC-15 — Một lần xuất một dòng trên lịch · Maps to: GC4 · Test: unit
- **Given** chuyến gộp 06/11 của AC-5
- **When** dựng Lịch xuất hàng của tháng 11/2026
- **Then** ngày 06/11 có 1 chuyến; dòng ghi HĐ "BD-008/26" trước rồi "BD-007/26", kg từng HĐ; tra "BD-007/26" ra chuyến đó
- **Assert:** shipmentCount ngày 06/11 == 1 · danh sách HĐ của dòng == ["BD-008/26","BD-007/26"] · kg theo HĐ == {BD-008: 3000, BD-007: 4000} · kết quả tra == 1 chuyến

### AC-16 — Bước 2 xét từng HĐ · Maps to: GC5, R14 · Test: unit
- **Given** chuyến gộp có hàng BD-007 và BD-008; chỉ lệnh BD-008 đã phát hành gắn chuyến
- **When** tính bước 2; rồi phát hành thêm lệnh BD-007 gắn chuyến
- **Then** lần đầu Đang làm, thiếu BD-007; lần sau Xong. Chuyến một HĐ có một lệnh ⇒ Xong như cũ
- **Assert:** lần 1 state == "in-progress" và HĐ thiếu == ["BD-007/26"] · lần 2 state == "done" · chuyến một HĐ state == "done"

### AC-17 — Link chuyến đã gộp · Maps to: GC2, R12 · Test: unit
- **Given** A đã gộp vào B, nhật ký có dòng gộp
- **When** tra chuyến theo id của A
- **Then** ra B kèm ngày gộp
- **Assert:** id trả về == id B · có ngày gộp == true

### AC-18 — Hướng dẫn đủ trạng thái · Maps to: GC6, §9b · Test: unit
- **Given** nhãn "Có thể trùng lần xuất", "Gộp thành một lần xuất", "Giữ riêng", "Đi chung chuyến", "Tạo chuyến riêng" trong hằng số nhãn
- **When** chạy kiểm phủ tour + hộp "?" của Xuất khẩu
- **Then** mọi nhãn đều có trong nội dung hướng dẫn
- **Assert:** số nhãn thiếu trong hướng dẫn == 0 (`pageTourCoverage` xanh)

### AC-19 — Dọn dữ liệu thật DAIREI · Maps to: GC2, §8 · Test: manual
- Lý do manual: dữ liệu thật, U1 làm trên app sau khi build; máy kiểm trước / sau bằng SELECT.
- **Given** DAIREI có 35 chuyến mở, 12 nhóm theo R1
- **When** U1 gộp từng nhóm (12 lần)
- **Then** còn 13 chuyến mở; tổng kg kế hoạch không đổi; mỗi nhóm một dòng nhật ký gộp
- **Assert:** số chuyến mở DAIREI == 13 · Σ planned_kg trước == Σ sau · số dòng nhật ký gộp == 12 · số file DAIREI trước == sau

## 11. Assumptions / cần chủ dự án duyệt

| # | Câu | Đề xuất (mặc định nếu không trả lời) |
|---|---|---|
| Q1 | Bước 2 của chuyến nhiều HĐ: Xong khi **mọi** HĐ có lệnh (R14) thay cho "≥ 1 lệnh"? | Có — tránh hàng của HĐ thứ hai không có lệnh sản xuất |
| Q2 | Dò trùng theo "cùng ngày đóng khi một bên chưa booking" (R1 b) có báo sai ca nào ở xưởng không (hai lần xuất khác cont cùng ngày cho cùng khách)? | Có thể có ⇒ đã có Giữ riêng |
| Q3 | Ai dọn 12 nhóm DAIREI? | Chị Thảo (Phòng KH) trên app sau khi build; không sửa DB bằng SQL |

- **A1.** Không migration: gộp chỉ dùng bảng có sẵn (`export_shipments`, `export_shipment_lines`, `export_step_items`, `export_files`, `export_shipment_containers`, `production_order_shipments`). Policy `export_files_update` (0103) đã cho `export-plans` sửa ⇒ chuyển file không cần đổi RLS.
- **A2.** File chỉ đổi chuyến trên bản ghi, không di chuyển object trong kho file (đường dẫn cũ vẫn đọc được).
- **A3.** Giữ riêng (R3) + dấu "đã gộp vào" (R12) lưu bằng dấu máy đọc `⟦keep:…⟧` / `⟦merged:…>…⟧` trong dòng nhật ký Xuất khẩu (ẩn khi hiện nhật ký), không thêm cột. Nếu design / build thấy cần cột ⇒ quay lại đây (🟡 migration chỉ thêm cột).
- **A4.** Nhóm trùng chỉ xét chuyến trong cùng khách; khách đổi tên / gộp danh mục khách không xét.

**Tier build:** 🟡 — đổi luật trong `exportConsolidate.ts` / `exportPlanning.ts` có test + Hoàn tác; không migration, không đổi quyền. Dọn dữ liệu thật do U1 làm qua app (có nhật ký, Hoàn tác) ⇒ không phải thao tác 🔴 hàng loạt bằng SQL.

**Giao cho design (42):** chỗ hiện dấu trùng trong Lịch xuất hàng + hồ sơ chuyến; hộp gộp (chọn chuyến giữ, cách gộp, ô lệch, lý do chặn); đề xuất Đi chung trong mục Lịch của form HĐ; dòng lịch ghi nhiều HĐ ở 360 px.

## History

- 2026-11-06 — ĐÃ BUILD v1 (chủ dự án duyệt theo đề xuất). Lệch so với v1 đề xuất: cổng gộp chặn cả khi chuyến **giữ** đã gửi chứng từ / tiền về; Giữ riêng ghi trong nhật ký. Máy chủ chưa có Hàng của chuyến (0096) ⇒ không gộp / không đi chung.
- 2026-11-06 — v1 đề xuất. Nguồn: chủ dự án (chuyến 06/11 BD-007 / BD-008 hiện 2 dòng, phải nhập 2 lần). Đọc DB thật: DAIREI 35 chuyến mở / 13 lần xuất, cặp 06/11 cùng booking SGNGCZ486800, booking đã gõ 2 lần và lệch forwarder. Phương án B (gộp tổng quát) thay giới hạn "chỉ Đóng ghép, chưa file" của Đưa vào cont và "cùng HĐ" của Gộp làm cont thêm.
