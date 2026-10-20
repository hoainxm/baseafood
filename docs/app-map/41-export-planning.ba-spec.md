# 41 — ba-spec: Phòng Kế hoạch · Xuất khẩu — Đợt 1 (khung tháng × khách × hợp đồng × chuyến)

> Load khi: xây hoặc sửa module Xuất khẩu của Phòng Kế hoạch đợt 1: hồ sơ hợp đồng (dòng hàng, bản sửa, gia hạn, file ký, kết quả duyệt giấy), chuyến (mã lô MSL, booking, cont, seal, ngày đóng/ETD), 6 bước dạng checklist tay kèm file, thực xuất lấy từ invoice, khép kín chuyến/hợp đồng theo dung sai, tiền về, vai trò Phòng Kế hoạch, mở rộng danh mục khách.
covers: src/features/export-planning/**, src/lib/exportPlanning.ts, src/lib/exportPlanningDemo.ts, src/lib/exportFileStorage.ts, supabase/migrations/0075_export_planning.sql
last_verified: 2026-10-20
ttl_days: 90
status: ba-spec v4 (bổ sung sau audit hồ sơ SCM 2026-10-20: nhãn, người ký BGĐ, kỳ xem, nối mặt hàng) — ĐÃ BUILD v1 2026-10-20 (code + `0075_export_planning.sql`, kiểm PGlite) — ⏳ 0075 CHƯA chạy trên DB thật: tạo bucket `export-files` → chạy 0075 (2 lần) → deploy
<!-- re-verified: 2026-10-20 17:30 — v4: R16–R22 + AC-30…AC-38 = test `exportPlanning.test.ts` (48) + `numberExpression.test.ts` + `format.test.ts`; nhãn / người ký / kỳ xem / nối mặt hàng thử tay preview sandbox, 360 px + 130 %. -->
<!-- re-verified: 2026-10-20 15:00 — audit hồ sơ SCM trên preview: NV3–NV13 chạy tay (AC-4…AC-28 trừ AC-1/2/18/29 cần DB thật), 50 TC ở docs/test-cases; luật trong doc khớp code. -->
<!-- re-verified: 2026-10-20 12:40 — AC-4…AC-26 = test `src/lib/exportPlanning.test.ts` (37) + `exportPlanningDemo.test.ts`; AC-1/2/18/27 RLS thử trên PGlite; luồng lập HĐ → lên chuyến → chặn KH-R8 → duyệt → 6 bước → khép kín · bản sửa chờ / bị từ chối · nháp · 360 px + 130 % thử tay preview demo. -->

> **Giao diện:** design-spec [42](42-export-planning-ui.design-spec.md) (oracle giao diện — chỉnh UI đọc file đó).
> **Mục đích:** oracle HÀNH VI cho đợt 1. Định nghĩa ai làm nghiệp vụ gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (việc của design-spec).
> **Nguồn đã chốt:** kế hoạch [`spec/xuat-khau-phong-ke-hoach.md`](../spec/xuat-khau-phong-ke-hoach.md) (§9 chốt 11 câu 2026-10-20) · quy trình [`QTI-KH-01`](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) (luật KH-R1…R16) · phân quyền [`spec/role-permissions.md`](../spec/role-permissions.md) · tài liệu công ty [`40-documents.md`](40-documents.md) (khuôn file + RLS).

---

## 1. Vấn đề & JTBD

- **Job:** Mỗi tháng, **nhân viên Phòng Kế hoạch** muốn nhìn từng khách, từng hợp đồng, từng chuyến container đang ở bước nào và còn thiếu giấy gì, để không chuyến nào đi mà thiếu chứng từ và không hợp đồng nào bị bỏ quên.
- **Vì sao làm bây giờ:**
  - Hồ sơ đang kẹp giấy (KH-R15). Sổ kế hoạch là Excel, mỗi tháng một sheet, có tháng chép trùng dòng của tháng trước.
  - Giấy tờ không ghi số của nhau: lệnh SX, lệnh xuất, invoice đều không ghi số hợp đồng. Chỉ người nhớ mới nối được.
  - App đã có Đơn đặt `/orders` nhưng không gắn hợp đồng, không có hạn giao.
- **Đo thành công bằng:** sau 1 tháng chạy song song (tháng 10/2026), **mọi booking đóng cont trong tháng có trên app**, và mỗi chuyến trả lời được "còn thiếu bước nào" mà không phải mở giấy (§8).

**Phạm vi đợt 1 = chỗ chứa + trạng thái.** Mọi bước sau hợp đồng là **đánh dấu tay + đính file**. Riêng invoice thương mại ghi thêm 3 con số tổng (thùng, kg tịnh, tiền) để tính thực xuất và dung sai. Đối chiếu tự động giữa các chứng từ, lệnh SX có cấu trúc, mẫu thùng, sơ đồ cont dạng lưới để các đợt sau (§7).

## 2. User registry

| User | Vai trò trong app | Là ai | Bối cảnh |
|---|---|---|---|
| **U1 Nhân viên Kế hoạch** | `planner` — **vai trò hệ thống MỚI**, phòng ban `planning` (Q11) | lập hợp đồng, lên chuyến, theo dõi bước, gom chứng từ, điền số cont/seal | desktop văn phòng |
| **U2 Ban giám đốc** | `director`, `vice-director` | ký duyệt hợp đồng và lệnh xuất **trên giấy** (Q4); trên app chỉ xem | desktop / điện thoại |
| **U3 Kế toán** | `chief-accountant`, `accountant` | xem hợp đồng + giá; ghi **tiền về** (Q5) | desktop |
| **U4 Người đóng hàng** | `warehouse-keeper`, `manager-dong`, `manager-ca`, `manager-kho`, `vice-manager` | chụp ảnh lớp hàng, seal, số cont lúc đóng; đính sơ đồ cont khi cần (Q7) | **điện thoại tại bãi đóng cont** |
| **U5 Quản trị** | `admin` | gán người vào vai trò `planner`, chỉnh quyền | desktop |
| **S1 Hệ thống** | — | tính tháng của chuyến, tổng hợp đồng, thực xuất, trạng thái bước, độ phủ chuyến, trễ hạn, khép kín | nền |

> Kỹ thuật · Kho · Phân xưởng **nhận lệnh SX** là việc của đợt 2 — không có trong registry đợt 1.
> U4 xác định theo **người có mặt lúc đóng cont**, không theo xưởng: hàng khô (lô `J0xx`, cá đuối khô) cũng đóng cont.

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Cấp vai trò Kế hoạch cho người dùng | U5 | U1 (người được cấp) | — | 1 lần / người | Must |
| NV2 | Bổ sung thông tin khách xuất khẩu | U1 | — | — | thấp | Must |
| NV3 | Lập hồ sơ hợp đồng (đầu HĐ + thanh toán / L/C + dòng hàng + chứng từ khách yêu cầu + file) | U1 | — | NV2 | vài / tháng | Must |
| NV4 | Ghi kết quả duyệt giấy của BGĐ cho một bản HĐ | U1 | U2 (người ký giấy) | NV3 / NV5 | mỗi bản | Must |
| NV5 | Ghi bản sửa hợp đồng (rvs / phụ kiện / tu chỉnh L/C), không ghi đè | U1 | U2 (ký lại) | NV4 | thỉnh thoảng | Must |
| NV6 | Ghi gia hạn giao hàng khách đã xác nhận (KH-R11) | U1 | khách (xác nhận ngoài app) | NV4 | thỉnh thoảng | Must |
| NV7 | Lên chuyến cho hợp đồng | U1 | — | NV3 | 12–39 / tháng toàn xưởng | Must |
| NV8 | Cập nhật bước 2–5 của chuyến (đánh dấu + file + số) | U1 | U4 (mục 4a, 4b) | NV7 | hằng ngày | Must |
| NV9 | Đính ảnh / sơ đồ đóng cont | U4 | U1 (điền số cont, seal) | NV7 | mỗi chuyến | Should |
| NV10 | Ghi gửi bộ chứng từ cho khách và tiền về (bước 6) | U3 | U1 (xem + ghi được, Q5) | NV7 | mỗi chuyến / HĐ | Should |
| NV11 | Theo dõi tháng (xem, lọc khách, tra số, xuất Excel) | U1 | U2, U3 (xem) | NV7 | hằng ngày | Must |
| NV12 | Khép kín chuyến và hợp đồng | S1 (tự tính) | U1 (đóng tay có lý do) | NV8 | mỗi chuyến | Must |
| NV13 | Hủy / xóa hợp đồng hoặc chuyến | U1 | — | NV3 / NV7 | hiếm | Must |

## 4. Cross-user handoff

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Khi không ai nhận |
|---|---|---|---|---|---|
| H1 | NV1 → mọi NV | U5 cấp vai trò | U1 | người dùng có vai trò `planner` | U1 không thấy module; không treo dữ liệu |
| H2 | NV3 / NV5 → NV4 | U1 lập bản HĐ | U2 ký giấy → **U1 ghi lại** | bản HĐ chờ duyệt có file | HĐ chưa có bản duyệt nào: bước 1 "đang làm", **chặn đánh dấu xong bước 2** (KH-R8). Bản sửa chờ duyệt **không** ảnh hưởng bản đã duyệt. Nhắc hạn ở đợt 4 |
| H3 | NV7 → NV9 | U1 lên chuyến | U4 đính ảnh / sơ đồ | chuyến chưa hủy, ngày đóng trong ±7 ngày hoặc chưa có | thiếu ảnh ⇒ mục 4b không xong ⇒ chuyến không khép — **U1 tự đính thay được** (Q7) |
| H4 | NV9 → NV8 | U4 gửi ảnh seal + cửa cont | U1 điền số cont + seal | có ảnh mục 4b | thiếu số cont/seal ⇒ bước 4 không xong |
| H5 | NV8 → NV10 | U1 (chuyến có invoice thương mại) | U3 ghi tiền về | chuyến chưa hủy | tiền chưa về **không chặn khép kín** (Q5); chuyến hiện "đã về X / Y" |
| H6 | NV8 → NV12 | U1 | S1 tính | mọi bước bắt buộc ở `done` / `not-applicable` | — (tự tính) |

## 5. Flows

### Flow NV1 — Cấp vai trò Kế hoạch · owner U5
- **Start:** có tài khoản của nhân viên phòng KH.
- **Input:** tài khoản, vai trò `planner`.
- **Output:** người đó có quyền theo ma trận R11; phòng ban = `planning` ⇒ đọc được **QTI-KH-01 + 8 biểu mẫu** ở Tài liệu công ty; trang chủ = Xuất khẩu.
- **End:** lần đăng nhập kế tiếp áp quyền mới.

### Flow NV2 — Bổ sung thông tin khách · owner U1
- **Input:** quốc gia, địa chỉ, cảng đích mặc định, điều kiện thanh toán mặc định, người liên hệ, email.
- **Output:** khách có đủ trường; trường cũ (mã, tên, thị trường) không đổi. Mọi trường mới **không bắt buộc**.
- **End:** HĐ mới của khách tự điền sẵn cảng đích và thanh toán (sửa được trên HĐ).

### Flow NV3 — Lập hồ sơ hợp đồng · owner U1
- **Start:** khách đã xác nhận đơn (giấy / email).
- **Input bắt buộc:** khách · số HĐ · ngày ký · **hạn giao muộn nhất** · tiền tệ (cấp HĐ, mặc định USD) · ≥1 dòng hàng.
- **Input khác:** Order ref của khách · incoterm (danh sách Incoterms 2020) · cảng xếp / cảng đích · **thanh toán** (TTR · L/C · khác) + % cọc · nếu L/C: số L/C, ngày hết hạn L/C, hạn giao theo L/C, file L/C · dung sai % (trống = 0) · số cont + loại cont · **chứng từ khách yêu cầu**, mỗi mục gồm loại + form / người cấp (VD C/O **form VJ**, H/C **công ty tự cấp**) · file HĐ.
- **Dòng hàng:** mô tả (đúng chữ tiếng Anh trên HĐ), **mặt hàng danh mục** (không bắt buộc lúc lập — R16), mã HS, size, quy cách, đơn vị tính (thùng / kiện), số thùng mỗi kiện, kg tịnh mỗi thùng, số lượng, kg (= số lượng × số thùng mỗi kiện × kg/thùng, sửa tay được), đơn giá, tiền (= kg × đơn giá), yêu cầu vi sinh. Số chép từ chứng từ tiếng Anh ("10.50", "194,557.60") được hiểu đúng (R22).
- **Output:** HĐ với bản 0 trạng thái **chờ duyệt**; tổng `units` / `cartons` / kg / tiền tính sẵn (R2); bước 1 "đang làm".
- **End:** HĐ ở tháng của hạn giao, nhãn "chưa lên chuyến".

### Flow NV4 — Ghi kết quả duyệt giấy · owner U1
- **Start:** BGĐ đã ký (hoặc trả về) bản giấy của **một bản HĐ** (bản 0 hoặc bản sửa).
- **Input:** bản HĐ, kết quả (`approved` · `needs-revision` · `rejected`), **người ký chọn từ tài khoản có vai trò Giám đốc / Phó giám đốc** (R17 — không gõ tự do; mặc định Giám đốc khi hệ thống có đúng một tài khoản Giám đốc; PGĐ đồng ý ký HĐ phải xác nhận "ký theo ủy quyền"), ngày, file scan, lý do (bắt buộc khi không đồng ý). Chưa có tài khoản BGĐ ⇒ tạm gõ họ tên, có dòng nhắc admin gán vai trò.
- **Output:**

| Bản | `approved` | `needs-revision` | `rejected` |
|---|---|---|---|
| **Bản 0** (HĐ chưa từng duyệt) | HĐ `approved`, bản 0 là bản hiệu lực | HĐ giữ "chờ duyệt", ghi lý do | HĐ `cancelled` + lý do (kéo theo NV13: hủy chuyến chưa đóng cont) |
| **Bản sửa** (HĐ đã có bản duyệt) | bản sửa thành **bản hiệu lực** | bản sửa giữ chờ, ghi lý do | **bỏ bản sửa**, bản hiệu lực cũ giữ nguyên; HĐ **không** bị hủy |

- **End:** mọi lần ghi duyệt giữ lại, gắn với đúng bản; lần sau không đè lần trước.

### Flow NV5 — Ghi bản sửa hợp đồng · owner U1
- **Start:** HĐ đã có bản hiệu lực; hai bên ký phụ kiện / bản rvs, hoặc ngân hàng gửi tu chỉnh L/C.
- **Input:** ngày sửa, nội dung sửa, file bản sửa, thay đổi đầu HĐ / dòng hàng.
- **Steps:** mở bản sửa → hệ thống **chụp bản hiệu lực** (đầu + dòng) → người dùng sửa → lưu → chờ ghi duyệt (NV4).
- **Output:**
  - Số bản +1; bản cũ + file cũ tra lại được (KH-R7).
  - **Trong lúc bản sửa chờ duyệt: HĐ giữ `approved` theo bản hiệu lực cũ.** Tổng HĐ, dung sai, chứng từ yêu cầu dùng bản hiệu lực. Bước 1, bước 2 đã xong, chuyến đã khép **không đổi**.
- **End:** khi bản sửa được duyệt, các tính toán chuyển sang bản mới (có thể làm HĐ khép hoặc mở lại theo NV12).

### Flow NV6 — Ghi gia hạn giao hàng · owner U1
- **Start:** nguy cơ trễ, khách đồng ý kéo hạn (KH-R11).
- **Input:** hạn giao mới, ngày khách xác nhận, file xác nhận của khách (email / thư), ghi chú.
- **Output:** hạn giao hiệu lực = hạn mới; lịch sử gia hạn giữ lại. **Không** tạo bản sửa, **không** cần BGĐ duyệt lại.
- **End:** "trễ hạn" tính theo hạn mới.

### Flow NV7 — Lên chuyến · owner U1
- **Start:** HĐ chưa hủy (HĐ chờ duyệt vẫn lên chuyến kế hoạch được — như sổ Excel ghi trước khi ký xong).
- **Input:** HĐ · tháng kế hoạch · loại chuyến (**20RF · 40RF · 40HC-RF · Xe tải · Đóng ghép**) · mô tả mặt hàng · kg kế hoạch · mã lô MSL (chữ tự do, cho phép "216+006") · cảng đích · booking (trống = "chờ booking") · ngày đóng · ETD · ETA · tàu/chuyến · số cont · seal (hoặc biển số xe với Xe tải) · ghi chú.
- **Output:**
  - Chuyến thuộc HĐ. **Tháng = tháng(ngày đóng) ?? tháng(ETD) ?? tháng kế hoạch** (Q1).
  - 6 bước khởi tạo: bước 1 theo HĐ; bước 2–6 "chưa làm"; bước 5 sinh một mục cho mỗi chứng từ yêu cầu của bản HĐ hiệu lực, **cộng mục Commercial Invoice** nếu HĐ chưa liệt kê.
- **End:** chuyến hiện ở đúng tháng, dưới đúng khách; HĐ cập nhật độ phủ chuyến (NV12).

### Flow NV8 — Cập nhật bước 2–5 · owner U1
- **Start:** chuyến chưa hủy.
- **Input:** bước / mục + trạng thái (`not-started` · `in-progress` · `done` · `not-applicable`) + file + ghi chú + số liệu của mục; hoặc "**dùng chung với chuyến …**" (cùng booking / cùng lô — trỏ tới mục đã xong của chuyến kia).

| Bước | Mục con | Xong khi |
|---|---|---|
| 2 Lệnh sản xuất | — | có ≥1 file (hoặc dùng chung) **và** HĐ đã có bản hiệu lực (KH-R8) **và mọi dòng hàng của bản hiệu lực đã nối mặt hàng danh mục** (R16) |
| 3 Bao bì | — | có file hoặc ghi chú (VD "đã có sẵn") |
| 4 Đóng cont | 4a Sơ đồ container · 4b Hình ảnh · 4c Tờ khai · 4d Lệnh xuất | 4a **tự xong** khi có file · 4b **tự xong** khi có ≥1 ảnh · 4c có số tờ khai **và** file · 4d có file lệnh xuất **đã có chữ ký BGĐ** (KH-R4); **và** số cont + seal đã điền (Xe tải: biển số; Đóng ghép: `not-applicable` + lý do) |
| 5 Bộ chứng từ | một mục / chứng từ yêu cầu (+ **bảo hiểm tự thêm khi Incoterm CIF / CIP** — R19; + mục thêm tay, VD kết quả kiểm vi sinh, hóa đơn hàng mẫu "M") | mỗi mục: số, ngày, file — **chứng từ công ty tự cấp (VD H/C) không bắt số** (R20). **Commercial Invoice** thêm Σ thùng, Σ kg tịnh, Σ tiền. **B/L** thêm ngày on board. Bước 5 xong khi **mọi mục** `done` / `not-applicable`. **Mục theo chứng từ khách yêu cầu không xóa được**, chỉ "không áp dụng" + lý do; mục thêm tay xóa được, hỏi lại trước (R21) |

- `not-applicable` bắt buộc có lý do.
- **Thực xuất của chuyến** = Σ thùng / kg tịnh / tiền của các **invoice thương mại** của chuyến. **Không** cộng hóa đơn hàng mẫu "M", **không** lấy số trên B/L (B/L gồm cả hàng mẫu: 22.227,8 kg so với 22.214 kg).
- **Output:** trạng thái bước cập nhật; ai đổi, lúc nào vào nhật ký.
- **End:** trạng thái hiện ngay ở tháng.

### Flow NV9 — Đính ảnh / sơ đồ đóng cont · owner U4
- **Start:** chuyến chưa hủy, ngày đóng trong ±7 ngày so với hôm nay **hoặc** chưa có ngày đóng.
- **Input:** nhiều ảnh một lần (chụp hoặc chọn), tùy chọn số lớp / chú thích; file sơ đồ cont.
- **Output:** ảnh gắn mục 4b, file gắn 4a ⇒ hai mục **tự xong**. U4 **chỉ thêm file** vào 4a / 4b, không sửa chuyến, không đổi bước khác.
- **End:** U1 thấy ảnh mới, điền số cont + seal từ ảnh (H4).

### Flow NV10 — Gửi bộ chứng từ và tiền về (bước 6) · owner U3
- **Input:**
  - **Gửi bộ chứng từ cho khách:** ngày gửi, cách gửi (email / chuyển phát / ngân hàng), file email. Là mốc tính hạn trả TTR "sau khi nhận bộ chứng từ" và hạn xuất trình L/C.
  - **Tiền về:** ngày, số tiền, tiền tệ, ghi chú, file giấy báo có. Ghi được ở **cấp chuyến** hoặc **cấp HĐ** (tiền cọc trước sản xuất); nhiều lần.
- **Output:** chuyến hiện "đã về X / Y" với Y = tiền thực xuất của chuyến; HĐ hiện tổng tiền về (cọc + các chuyến) so với tổng tiền thực xuất, và **liệt kê từng lần cọc / tiền về cấp HĐ (xem · sửa · xóa có Hoàn tác)**. **Không ảnh hưởng đủ hồ sơ / xuất đủ** (Q5).
- **End:** U1 xem và ghi được cùng chỗ; ghi sai thì xóa (có Hoàn tác).

### Flow NV11 — Lịch xuất hàng (theo tháng / tuần / khoảng ngày) · owner U1
- **Input:** **kỳ xem** = tháng · tuần lịch (Thứ 2 → Chủ nhật) · khoảng ngày (R18); lọc khách (tùy chọn — **4 con số cũng theo khách**); ô tra theo **MSL / booking / số cont / số invoice / số B/L / số HĐ / số đơn khách** — tra mọi kỳ, ra **cả HĐ chưa lên chuyến**.
- **Output:**
  - Chuyến của tháng gom theo khách, mỗi chuyến có trạng thái 6 bước.
  - HĐ chưa lên chuyến: hiện ở tháng của hạn giao; **hạn đã qua mà vẫn chưa lên chuyến ⇒ hiện thêm ở tháng hiện tại, nhãn trễ**.
  - HĐ chưa phủ đủ (NV12) hiện nhãn "còn X kg / Y cont chưa lên chuyến".
  - 4 con số: số chuyến · chuyến đã khép · chuyến thiếu bước · **chuyến trễ hạn** (ngày on board B/L ?? ETD > hạn giao hiệu lực). HĐ quá hạn chưa lên chuyến đếm riêng.
  - Xuất Excel theo bố cục sổ "Kế hoạch xuất hàng" (Q10) cho **kỳ đang xem** (và khách đang lọc): gom theo **tuần lịch T2 → CN** của ngày đóng, nhãn "T2 (05-11/10)"; các chuyến **cùng booking gộp một dòng**, CONT ghép (VD "40+20"); HĐ chưa lên đủ chuyến ở phần cuối — HĐ đã có chuyến thì ghi **phần còn thiếu** (kg / cont), không ghi "Chờ booking".
- **End:** người xem biết chuyến nào thiếu gì mà không mở giấy.

### Flow NV12 — Đủ hồ sơ / Xuất đủ · owner S1 (chốt tay: U1)
> Nhãn cho người dùng (§9b): chuyến khép = **"Đủ hồ sơ"**; HĐ khép tự tính = **"Đã xuất đủ"**; HĐ đóng tay = **"Đã chốt HĐ"** (nút **Chốt HĐ** / **Mở lại HĐ**); lệch = **"Ngoài dung sai: kg thừa / thiếu x%"**. Không dùng "thanh lý" (thủ tục pháp lý của kế toán). Tên khóa kỹ thuật (`closed`, `isShipmentClosed`, `contractClosure`) giữ nguyên.
- **Chuyến khép** khi bước 2, 3, 4, 5 đều `done` / `not-applicable` (bước 6 không tính).
- **Độ phủ HĐ** (chưa khép): Σ kg kế hoạch các chuyến chưa hủy < kg HĐ × (1 − dung sai), **hoặc** số chuyến cont < số cont trên HĐ ⇒ nhãn "còn X kg / Y cont chưa lên chuyến". Nhãn này **khác** "lệch dung sai".
- **HĐ khép** (`closed`) khi:
  - HĐ có bản hiệu lực và ≥1 chuyến chưa hủy,
  - mọi chuyến chưa hủy đều khép,
  - **và cả** Σ kg thực xuất **lẫn** Σ tiền thực xuất nằm trong [HĐ × (1 − dung sai), HĐ × (1 + dung sai)], **tính cả hai đầu**; dung sai trống = 0%.
- Mọi chuyến khép mà Σ lệch ngoài dung sai ⇒ không tự khép, báo "lệch dung sai" kèm % lệch kg và % lệch tiền. U1 **đóng tay** với lý do bắt buộc.
- Chuyến bị đổi về chưa xong, hoặc bản sửa mới được duyệt làm Σ ra ngoài dung sai ⇒ HĐ tự khép về `approved` (trừ HĐ đóng tay).

### Flow NV13 — Hủy / xóa · owner U1
- **HĐ:**
  - **Xóa** được khi chưa từng có bản duyệt `approved` và chưa có chuyến.
  - **Hủy** (`cancelled` + lý do) được khi **chưa chuyến nào đã đóng cont** (đã có số cont hoặc biển số). Hủy HĐ ⇒ mọi chuyến của HĐ tự hủy cùng lý do.
  - HĐ có chuyến đã đóng cont ⇒ không hủy, chỉ đóng tay (NV12).
- **Chuyến:** xóa được khi chưa có file nào và chưa bước nào `done`; còn lại ⇒ hủy + lý do. Chuyến hủy không tính vào kỳ xem, độ phủ, khép kín. **Chuyến đã hủy khôi phục được** khi HĐ còn mở (về đang làm; mục "dùng chung" ở chuyến khác đã rơi về chưa làm thì không tự quay lại).
- **Tiền về:** xóa được (ghi sai), có Hoàn tác.
- Mọi xóa có xác nhận + **Hoàn tác** (luật repo 6).

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict |
|---|---|---|---|---|---|
| Trục | A: HĐ là trục, bước gắn HĐ · B: chuyến là trục · C: HĐ 1..n chuyến, bước 2–5 gắn chuyến | **C** | A sai thực tế (lô trải 3 cont); B mất dung sai + chứng từ yêu cầu của HĐ. Đúng Q2 | Orchestrator + Domain (XK) | Hình "HĐ → các bước" của chủ dự án giữ đúng khi 1 chuyến |
| NV7 tháng | A: tháng ký · B: tháng kế hoạch · C: ngày đóng → ETD → kế hoạch | **C** | Q1; đổi ngày đóng là chuyến tự sang tháng (rubric #5) | Optimizer | — |
| NV4 duyệt | A: BGĐ duyệt trên app · B: U1 ghi kết quả giấy | **B** | Q4 | Optimizer | Đổi sang A sau không đổi dữ liệu |
| NV4 gắn duyệt | A: duyệt gắn HĐ · B: duyệt gắn **bản** | **B** | A: bản sửa bị trả về làm hủy cả HĐ đang chạy chuyến, mở lại chuyến đã khép (rubric #3) | Domain (XK) | v1 dùng A — loại ở v2 |
| NV5 bản sửa | A: sửa đè · B: chụp bản trước rồi sửa · C: HĐ mới | **B** | A trái KH-R7; C bắt gắn lại chuyến | Domain (XK) | — |
| NV6 gia hạn | A: đi qua bản sửa · B: bản ghi gia hạn riêng | **B** | A bắt BGĐ duyệt lại, bước 1 về "đang làm", số trễ sai | Domain (XK) | — |
| NV8 thực xuất | A: lấy B/L · B: gõ tay ở chuyến · C: Σ invoice thương mại | **C** | A gồm hàng mẫu (+13,8 kg); B không có bằng chứng | Domain (XK) | — |
| NV8 bước 5 | A: danh sách cố định · B: sinh từ chứng từ yêu cầu của HĐ (loại + form / người cấp) | **B** | Bắt được "thiếu C/O form VJ" như bộ lô 165 | Domain (XK) | — |
| NV8 "xong" | A: tự do · B: có bằng chứng | **B** | A làm khép kín vô nghĩa (rubric #2) | Optimizer | — |
| NV8 cont ghép | A: mỗi chuyến nộp đủ bộ · B: "dùng chung với chuyến …" | **B** | Cont "40+20" chung booking, invoice, B/L — A bắt nộp 2 lần (rubric #5) | Domain (XK) | Giữ Q2 (chuyến = 1 cont) |
| NV9 ai đính ảnh | A: chỉ U4 · B: chỉ U1 · C: cả hai | **C** | Q7 | Optimizer | — |
| NV9 trạng thái 4a/4b | A: U4 đánh dấu · B: tự suy từ file | **B** | RLS không chia được cột trạng thái chung; U4 chỉ cần quyền thêm file | Cross-User-Integrity | — |
| NV10 tiền về | A: chặn khép · B: không chặn | **B** | Q5 | Optimizer | — |
| NV12 dung sai | A: chỉ chuyến khép · B: + Σ kg · C: + Σ kg **và** Σ tiền | **C** | HĐ 18.26 ghi ±10% cả lượng lẫn tiền | Domain (XK) | v1 chỉ B — sửa ở v2 |
| NV12 nhãn (v4) | A: Khép kín · B: Hoàn tất · C: Đủ hồ sơ (chuyến) + Đã xuất đủ (HĐ) · D: Thanh lý | **C** | "Hoàn tất" dễ hiểu là đã thu tiền; **D bị VETO** (thủ tục pháp lý có biên bản) | Domain (XK) | — |
| NV4 người ký (v4) | A: gõ tự do · B: chọn tài khoản BGĐ, mặc định GĐ, PGĐ ký theo ủy quyền · C: chỉ GĐ | **B** | A đã gõ sai tên GĐ (VETO); C kẹt khi GĐ vắng có ủy quyền | Domain (XK) | — |
| NV11 kỳ xem (v4) | A: khoảng ngày theo ngày xuất (= R1) + tuần lịch · B: chọn trường ngày · C: theo ngày ký | **A** | B hai người lọc ra hai kết quả; **C VETO** (ngày ký không phản ánh xuất hàng) | Domain (XK) + Optimizer | — |
| NV3 / NV8 nối mặt hàng (v4) | A: bắt lúc lập HĐ · B: không bắt lúc lập, bắt trước Lệnh SX, nối không cần bản sửa · C: nối khi xuất invoice | **B** | A chậm khâu nhập; C quá muộn cho Lệnh SX; nối qua bản sửa bắt BGĐ duyệt lại vô ích (triage) | Domain (XK) + triage | — |

## 7. Scope & Priority

- **IN (đợt 1):** NV1–NV13.
- **OUT (đợt sau):**
  - Lệnh SX có cấu trúc + 3 nơi nhận (đợt 2).
  - Mẫu thùng / phiên bản / đợt in (đợt 2).
  - Sơ đồ cont dạng lưới nhập từ `.xls`, giải nén zip ảnh (đợt 3).
  - Nối lệnh xuất `/orders` + BGĐ duyệt lệnh xuất trên app (đợt 3).
  - Số liệu dòng của chứng từ + đối chiếu tự động B1–B11 + nhắc hạn ở Việc của tôi (đợt 4).
  - Lưu 2 năm, nạp lịch sử sổ Excel (Q6), Nhập khẩu, Khác (đợt 5).
  - Báo giá / sổ yêu cầu khách (QTI bước 1–5).
- **Không làm:** khai hải quan, book tàu, ngân hàng, sổ kế toán; không đổi `/orders`, `/sales`, Cân đối trong đợt 1.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV7 / NV11 | booking đóng cont tháng 10/2026 có trên app (so theo **booking duy nhất**, vì sổ từng chép trùng dòng sang tháng khác) | 100% |
| NV8 | chuyến đã tàu chạy mà trạng thái bước 5 không phản ánh đúng giấy (kiểm 5 chuyến ngẫu nhiên) | 0 |
| NV3 | thời gian lập 1 HĐ 14 dòng (cỡ HĐ 18.26) | ≤ 15 phút |
| NV11 | trả lời "chuyến X còn thiếu gì" khi biết MSL / booking / số cont | ≤ 1 phút |
| NV12 | HĐ khép mà Σ kg hoặc Σ tiền ngoài dung sai không có lý do | 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Tháng của chuyến = tháng(ngày đóng) ?? tháng(ETD) ?? tháng kế hoạch | ghi ngày đóng 31/10 cho chuyến ETD 03/11 ⇒ chuyến ở tháng 10 |
| R2 | Tổng HĐ có hai số đếm: `units` = Σ số lượng theo đơn vị của dòng (khớp HĐ giấy) và `cartons` = Σ quy về thùng (kiện × số thùng/kiện). kg dòng = số lượng × số thùng/kiện × kg/thùng (sửa tay được); tiền dòng = kg × đơn giá, làm tròn 2 số lẻ | HĐ 18.26: units 1.900, cartons 2.000 (dòng 12: 100 kiện × 2 thùng) |
| R3 | Bản sửa không ghi đè; duyệt gắn với bản; bản hiệu lực = bản `approved` mới nhất | bản sửa bị `rejected` ⇒ bản hiệu lực không đổi |
| R4 | Bước 2 chỉ đánh dấu `done` được khi HĐ có bản hiệu lực (KH-R8) | bản sửa chờ duyệt không làm bước 2 đã xong quay lại |
| R5 | `done` phải có bằng chứng theo bảng NV8; `not-applicable` phải có lý do; "dùng chung" chỉ trỏ tới mục **đã xong** của chuyến **cùng HĐ hoặc cùng booking** | chuyến được trỏ tới bị hủy ⇒ mục dùng chung về "chưa làm" |
| R6 | Mục bước 5 sinh từ chứng từ yêu cầu của **bản hiệu lực** lúc tạo chuyến; bản sửa thêm chứng từ yêu cầu ⇒ thêm mục vào chuyến **chưa khép** | không xóa mục đã có file |
| R7 | Thực xuất = Σ invoice thương mại của chuyến (không hàng mẫu "M", không B/L). Dung sai áp **cả kg lẫn tiền**, hai đầu tính là trong, trống = 0% | 20.900 kg / 189.689,50 USD với HĐ 18.26 ⇒ trong |
| R8 | Ngày đóng ≤ ETD ≤ ETA (khi có đủ); vi phạm ⇒ báo lỗi, không lưu | ngày đóng 02/11, ETD 28/10 ⇒ chặn |
| R9 | MSL không duy nhất; số HĐ **duy nhất theo khách** (không phân hoa thường, bỏ khoảng trắng đầu/cuối); hạn giao bắt buộc | " 18.26/bsf-scm.2026 " trùng ⇒ chặn |
| R10 | `export-plans.loading` (U4) đọc được **đầu chuyến**: khách, MSL, booking, loại chuyến, ngày đóng, số cont, seal, mô tả hàng, kg kế hoạch, và file 4a/4b. **Không** đọc dòng hàng HĐ, đơn giá, tiền thực xuất, tiền về. Chỉ **thêm** file vào 4a/4b; không cập nhật chuyến | — |
| R11 | Ma trận quyền mặc định — bảng dưới. Phòng ban của `planner` khai ở **cả** code (`SYSTEM_ROLE_DEPARTMENTS`) **lẫn** hàm SQL `current_user_departments()` | — |
| R12 | File: tối đa 20 MB / file; PDF, ảnh, Word, Excel, zip (zip chỉ lưu, chưa giải nén); kho file **riêng** của module; ảnh điện thoại nén trước khi tải (khuôn ảnh QC) | — |
| R13 | Ghi / sửa / hủy / duyệt / gia hạn / tiền về đều vào nhật ký thao tác | — |
| R14 | Chế độ demo: mọi bảng mới nằm trong bộ demo; số thật không đổi khi thao tác demo (luật repo 15). Không có gói ⇒ bộ demo dùng số tự đặt + **file giữ chỗ** `demo-placeholder/…`. **v4 (chủ dự án chọn 2026-10-20):** số + file THẬT của hồ sơ khách chỉ được vào demo qua **gói demo Xuất khẩu** — admin "Nạp gói demo Xuất khẩu…" (menu Demo) tải `pack.json` + file vào kho riêng `export-files` ở `site-demo/export-files/demo-pack/…` (chỉ người đăng nhập có quyền Xuất khẩu đọc được); "Tạo bộ mới" đọc gói, gắn file thật vào 7 ca + dựng mỗi dòng sổ "Kế hoạch xuất hàng" thành HĐ + chuyến dời sang tháng gần đây. **Cấm** để số / tên khách thật trong mã nguồn (bản JS phát hành ai cũng tải được). File thật hiện cho mọi người xem demo, kể cả khi "ẩn tên" | gói chưa nạp ⇒ bộ tự đặt |
| R15 | Trễ hạn của chuyến = (ngày on board trên B/L ?? ETD) > hạn giao hiệu lực (sau gia hạn) | gia hạn tới 30/09 ⇒ chuyến ETD 26/09 hết trễ |
| R16 | Mỗi dòng hàng nối **một mặt hàng ở danh mục mở `products`** (`productId`, tên tiếng Anh giữ ở `description`). Không bắt lúc lập HĐ; **bắt trước khi Lệnh SX xong**. Nối là thông tin nội bộ ⇒ ghi thẳng vào bản đang dùng, **không tạo bản sửa, không cần BGĐ duyệt lại**. Gợi ý theo cặp (tên HĐ → mặt hàng) đã nối ở HĐ trước, ưu tiên cùng khách; không dịch máy. 141 mã kế toán chỉ ánh xạ qua `products` | dòng cũ không có `productId` ⇒ "chưa nối" |
| R17 | Người ký duyệt = tài khoản có vai trò `director` / `vice-director`; không gõ tự do khi đã có tài khoản; không hard-code tên trong code. PGĐ đồng ý ký HĐ phải xác nhận ký theo ủy quyền (lưu vào tên người ký) | 0 tài khoản BGĐ ⇒ tạm gõ tên + dòng nhắc |
| R18 | Kỳ xem: chuyến thuộc kỳ khi (ngày đóng ?? ETD) nằm trong [từ, đến]; chuyến chỉ có tháng KH thuộc mọi kỳ chạm tháng đó (xem theo tháng y như R1). HĐ chưa lên đủ chuyến thuộc kỳ khi hạn giao hiệu lực trong kỳ, hoặc quá hạn chưa chuyến và hôm nay trong kỳ. Lọc khách áp cho cả 4 con số | tuần 12–18/10 ra 2 chuyến đóng 13/10 |
| R19 | Incoterm CIF / CIP ⇒ chuyến tự có mục **Bảo hiểm** ở bước 5 (người bán buộc mua bảo hiểm) | bỏ được bằng "không áp dụng" + lý do |
| R20 | Chứng từ có người cấp "công ty tự cấp" không bắt số chứng từ (vẫn bắt ngày + file / ghi chú) | H/C lô 165 không in số |
| R21 | Mục bước 5 theo chứng từ khách yêu cầu (gồm Commercial Invoice, bảo hiểm CIF/CIP) **không xóa được**; mục thêm tay xóa được, hỏi lại trước, có Hoàn tác | xóa C/O form VJ để chuyến đủ hồ sơ ⇒ không làm được |
| R22 | Ô số hiểu số chép từ chứng từ tiếng Anh: có cả "." lẫn "," ⇒ dấu đứng sau là phần lẻ; chỉ "." mà không đúng nhóm nghìn kiểu Việt ⇒ "." là phần lẻ; có kiểu này ⇒ ô hiện lại số đã hiểu. Kiểu Việt giữ nguyên | "10.50" → 10,5 · "194,557.60" → 194.557,6 · "1.234" → 1234 |

**R11 — ma trận quyền mặc định** (tài nguyên mới, mặc định cấm; Q11 đã đồng ý đổi ma trận):

| Vai trò | `export-plans` (HĐ, chuyến, bước, file, gia hạn) | `export-plans.loading` (4a, 4b) | `export-plans.payments` (bước 6) | `catalog.customers` |
|---|---|---|---|---|
| `planner` | view · create · update · delete · export · view-price | view · create | view · create · update · delete | view · create · update |
| `director`, `vice-director` | view · export · view-price | view | view | (giữ như cũ) |
| `chief-accountant` | view · export · view-price | view | view · create · update · delete | (giữ như cũ) |
| `accountant` | view · export · view-price | view | view · create · update (KHÔNG xóa — luật chung "kế toán không xóa") | (giữ như cũ) |
| `warehouse-keeper`, `manager-dong`, `manager-ca`, `manager-kho`, `vice-manager` | — | view · create | — | (giữ như cũ) |
| còn lại | — | — | — | (giữ như cũ) |

`planner` thuộc phòng ban `planning`; trang chủ mặc định = Xuất khẩu. **Không** khai vai trò này bằng một dòng `app_roles` (vai trò có dòng `app_roles` thì máy chủ đọc `role_permissions` thay cho ma trận mặc định ⇒ `planner` mất hết quyền).

## 10. Acceptance Criteria

> Số của HĐ 18.26 là số thật. Ghép lô 165 (INV 234/26) vào HĐ 18.26 ở AC-17 là **giả định để thử** — chưa có chứng từ nào chứng minh hai cái thuộc nhau.

### AC-1 — Vai trò Kế hoạch mở module và biểu mẫu KH · Maps to: NV1 · Test: integration
- **Given** tài khoản chỉ có vai trò `planner`
- **When** đăng nhập và nạp quyền
- **Then** có quyền `export-plans` theo R11, trang chủ là Xuất khẩu, đọc được QTI-KH-01 và 8 biểu mẫu
- **Assert** `resolvePermissions({ roles: ["planner"], isAdmin: false })` cho `export-plans` ⊇ {view, create, update, delete, export, view-price}; `homeFor(["planner"], perms) == "planning-export"`; `departmentsOfRoles(["planner"])` chứa `"planning"`; qua RLS đọc được đủ 9 id `doc-qti-kh-01`, `doc-qti-kh-01-01` … `doc-qti-kh-01-08`

### AC-2 — Vai trò khác không thấy module · Maps to: NV1 · Test: integration
- **Given** tài khoản `team-leader`
- **When** đọc và ghi bảng hợp đồng xuất khẩu qua máy chủ
- **Then** không nhận dòng nào và không ghi được
- **Assert** select `export_contracts` trả 0 dòng; insert bị RLS từ chối (42501)

### AC-3 — Khách thêm trường mới không vỡ dữ liệu cũ · Maps to: NV2 · Test: integration
- **Given** khách có sẵn chỉ có mã, tên, thị trường
- **When** U1 ghi quốc gia, cảng đích, thanh toán
- **Then** trường mới lưu, trường cũ giữ nguyên; khách không có trường mới vẫn đọc được
- **Assert** sau lưu `country`, `default_port`, `payment_terms` != null và `code`, `name`, `market` == giá trị trước; khách cũ trả các trường mới == null, không lỗi

### AC-4 — Tổng HĐ đúng hai cách đếm · Maps to: NV3 · Test: unit
- **Given** 14 dòng hàng của HĐ 18.26 (dòng 12: 100 kiện, 2 thùng/kiện, 4 kg/thùng)
- **When** tính tổng hợp đồng
- **Then** số đếm theo đơn vị dòng khớp HĐ giấy; số quy về thùng tính riêng
- **Assert** `contractTotals(lines)` == { units: 1900, cartons: 2000, kg: 19000, amount: 172445.00 }; dòng 12 kg == 800; dòng 1 tiền == 2000 × 10.50 == 21000.00

### AC-5 — HĐ mới chờ duyệt, hiện ở tháng hạn giao · Maps to: NV3 · Test: e2e
- **Given** U1 lập HĐ có khách, số HĐ, ngày ký 2026-07-30, hạn giao 2026-09-05, ≥1 dòng hàng
- **When** lưu
- **Then** HĐ chờ duyệt; bước 1 "đang làm"; tháng 2026-09 liệt kê HĐ nhãn "chưa lên chuyến"
- **Assert** `effectiveRevision(contract) == null`; `stepState(contract, 1) == "in-progress"`; `buildMonthPlan("2026-09", …, today = 2026-08-01)` có HĐ với `noShipment == true`

### AC-6 — Thiếu hạn giao hoặc trùng số HĐ bị chặn · Maps to: NV3 · Test: unit
- **Given** khách SCM đã có HĐ số "18.26/BSF-SCM.2026"
- **When** (a) lập HĐ mới cùng khách số " 18.26/bsf-scm.2026 "; (b) lập HĐ khác số nhưng bỏ trống hạn giao
- **Then** cả hai bị chặn, không lưu
- **Assert** (a) `findDuplicateContract(...)` trả id HĐ có sẵn; (b) `validateContract(c).errors` chứa `"latestShipmentDate"`; số HĐ của khách == 1

### AC-7 — Duyệt bản 0 hoàn tất bước 1 · Maps to: NV4 · Test: e2e
- **Given** HĐ chờ duyệt, bản 0 có file HĐ
- **When** U1 ghi `approved`, người duyệt, ngày, file scan
- **Then** HĐ `approved`; bản 0 là bản hiệu lực; bước 1 xong
- **Assert** `status == "approved"`; `effectiveRevision(contract).revisionNo == 0`; `stepState(contract, 1) == "done"`; lần duyệt có `file_path != null`

### AC-8 — Từ chối bản 0 phải có lý do, hủy HĐ và chuyến · Maps to: NV4 · Test: e2e
- **Given** HĐ chờ duyệt đã có 1 chuyến kế hoạch (chưa có số cont)
- **When** U1 ghi `rejected` bỏ trống lý do, rồi ghi lại có lý do
- **Then** lần đầu bị chặn; lần sau HĐ `cancelled`, chuyến của HĐ `cancelled` cùng lý do, dữ liệu còn nguyên
- **Assert** lần 1: số lần duyệt == 0; lần 2: HĐ `status == "cancelled"`, chuyến `status == "cancelled"`, `cancel_reason` hai bên bằng nhau và != ""

### AC-9 — Bản sửa chờ duyệt không làm sập HĐ · Maps to: NV5 · Test: integration
- **Given** HĐ `approved` (bản 0, dòng 1 = 200 thùng), chuyến đã khép
- **When** U1 ghi bản sửa đổi dòng 1 thành 180 thùng kèm file rvs, chưa ghi duyệt
- **Then** HĐ giữ `approved` theo bản 0; chuyến vẫn khép; bản sửa ở trạng thái chờ
- **Assert** `status == "approved"`; `effectiveRevision(contract).revisionNo == 0` với dòng 1 `quantity_units == 200`; `isShipmentClosed == true`; bản 1 có `approvalState == "pending"` và dòng 1 == 180

### AC-10 — Bản sửa bị từ chối bị bỏ, bản cũ giữ hiệu lực · Maps to: NV4 / NV5 · Test: integration
- **Given** tình huống cuối AC-9
- **When** U1 ghi `rejected` cho bản 1 kèm lý do
- **Then** bản 1 bị bỏ; HĐ không bị hủy; bản 0 vẫn hiệu lực
- **Assert** HĐ `status == "approved"`; `effectiveRevision(contract).revisionNo == 0`; bản 1 `approvalState == "rejected"` và vẫn tra được

### AC-11 — Gia hạn không cần duyệt lại · Maps to: NV6 · Test: unit
- **Given** HĐ hạn giao 2026-09-05, chuyến ETD 2026-09-26
- **When** U1 ghi gia hạn tới 2026-09-30 kèm file xác nhận của khách
- **Then** chuyến hết trễ; HĐ không cần duyệt lại
- **Assert** trước gia hạn `isShipmentLate(s) == true`; sau `== false`; `effectiveDeadline(contract) == "2026-09-30"`; số bản HĐ không đổi

### AC-12 — Tháng của chuyến và thứ tự ngày · Maps to: NV7 · Test: unit
- **Given** chuyến tháng kế hoạch 2026-10, chưa có ngày nào
- **When** ghi ETD 2026-11-03; rồi ngày đóng 2026-10-31; rồi thử ngày đóng 2026-11-05
- **Then** tháng 10 → 11 → 10; lần cuối bị chặn vì ngày đóng sau ETD
- **Assert** `shipmentMonth(s)` == "2026-10", "2026-11", "2026-10"; `validateShipment` lần cuối có lỗi `"loadingAfterEtd"`

### AC-13 — Chuyến mới sinh mục chứng từ theo HĐ, giữ form · Maps to: NV7 · Test: unit
- **Given** HĐ yêu cầu Commercial Invoice, Packing list, B/L, H/C (công ty tự cấp), C/O form VJ
- **When** lên chuyến
- **Then** bước 5 có đúng 5 mục, đều "chưa làm"; mục C/O giữ form VJ
- **Assert** `documentItems(shipment).length == 5`; mọi `state == "not-started"`; mục `kind == "certificate-of-origin"` có `form == "VJ"`

### AC-14 — Bước 2 không xong khi HĐ chưa có bản hiệu lực · Maps to: NV8 · Test: unit
- **Given** HĐ chờ duyệt bản 0, chuyến có file lệnh SX ở bước 2
- **When** đánh dấu bước 2 xong
- **Then** bị chặn (KH-R8); file vẫn giữ
- **Assert** `canMarkDone(step2, contract).ok == false` và `reason == "contract-not-approved"`; số file bước 2 == 1

### AC-15 — "Xong" phải có bằng chứng, "không áp dụng" phải có lý do · Maps to: NV8 · Test: unit
- **Given** mục 4c có file nhưng chưa số tờ khai; mục C/O ở bước 5
- **When** đánh dấu 4c xong; đánh dấu C/O `not-applicable` không lý do, rồi có lý do
- **Then** 4c bị chặn vì thiếu số; C/O lần đầu bị chặn, lần sau nhận
- **Assert** `canMarkDone(4c).missing == ["declarationNo"]`; `canMarkNotApplicable(co, "").ok == false`; `canMarkNotApplicable(co, "khách bỏ yêu cầu").ok == true`

### AC-16 — Thực xuất lấy từ invoice thương mại, bỏ hàng mẫu · Maps to: NV8 · Test: unit
- **Given** chuyến có Commercial Invoice 234/26 (2.251 thùng · 22.214 kg · 194.557,60 USD), hóa đơn hàng mẫu 234M/26 (1 thùng · 13,8 kg · 27,60 USD), B/L (2.252 thùng · 22.227,8 kg)
- **When** tính thực xuất
- **Then** chỉ lấy invoice thương mại
- **Assert** `shipmentActuals(s)` == { cartons: 2251, kg: 22214.00, amount: 194557.60 }

### AC-17 — Cont ghép dùng chung chứng từ · Maps to: NV8 · Test: unit
- **Given** hai chuyến 40RF và 20RF cùng booking; chuyến 40RF có bước 5 xong đủ mục
- **When** đánh dấu mọi mục bước 5 của chuyến 20RF "dùng chung với" chuyến 40RF
- **Then** bước 5 của chuyến 20RF xong; hủy chuyến 40RF thì các mục dùng chung về "chưa làm"
- **Assert** `stepState(s20, 5) == "done"`; sau hủy `stepState(s20, 5) == "not-started"`

### AC-18 — Người đóng hàng chỉ thêm ảnh và sơ đồ, không thấy giá · Maps to: NV9 · Test: integration
- **Given** tài khoản `warehouse-keeper`, chuyến ngày đóng = hôm nay
- **When** thêm 3 ảnh vào 4b; thử sửa bước 5 của chuyến; thử đọc dòng hàng HĐ và tiền về
- **Then** 3 ảnh lưu và 4b tự xong; sửa bước 5 không có tác dụng; đọc dòng hàng và tiền về trả rỗng
- **Assert** số file 4b == 3 và `stepState(s, "4b") == "done"`; update bước 5 đổi 0 dòng (hoặc 42501 nếu đi đường upsert); select `export_contract_items` và payments trả 0 dòng

### AC-19 — Chuyến khép không cần tiền về · Maps to: NV12 · Test: unit
- **Given** chuyến có bước 2, 3, 4 (mọi mục con + số cont + seal), 5 (mọi mục) ở `done` / `not-applicable`, chưa có tiền về
- **When** tính khép kín
- **Then** chuyến khép
- **Assert** `isShipmentClosed(s) == true` và Σ tiền về == 0

### AC-20 — HĐ tự khép trong dung sai, kể cả đúng biên · Maps to: NV12 · Test: unit
- **Given** HĐ 18.26 (19.000 kg · 172.445 USD · dung sai 10%), một chuyến đã khép
- **When** thực xuất lần lượt (a) 20.900 kg / 189.689,50 USD; (b) 17.000 kg / 160.000 USD
- **Then** (a) HĐ khép; (b) không khép vì kg dưới biên
- **Assert** (a) `contractClosure(c).closed == true`; (b) `closed == false`, `reason == "out-of-tolerance"`, `kgDeviationPct` ∈ [−10.6, −10.5]

### AC-21 — HĐ không tự khép khi lệch dung sai (giả định lô 165) · Maps to: NV12 · Test: unit
- **Given** HĐ 18.26, một chuyến đã khép với thực xuất của lô 165 (22.214 kg · 194.557,60 USD) — ghép giả định
- **When** tính khép HĐ
- **Then** không tự khép, báo lệch cả kg lẫn tiền
- **Assert** `closed == false`; `reason == "out-of-tolerance"`; `kgDeviationPct` ∈ [16.9, 17.0]; `amountDeviationPct` ∈ [12.8, 12.9]

### AC-22 — Đóng HĐ tay phải có lý do · Maps to: NV12 · Test: e2e
- **Given** HĐ ở tình huống AC-21
- **When** U1 đóng tay không lý do, rồi có lý do
- **Then** lần đầu bị chặn; lần sau HĐ `closed`
- **Assert** lần 1 `status == "approved"`; lần 2 `status == "closed"` và `close_reason != ""`

### AC-23 — Độ phủ chuyến của HĐ · Maps to: NV12 · Test: unit
- **Given** HĐ 19.000 kg, 1 cont, dung sai 10%, chưa có chuyến
- **When** lên một chuyến kế hoạch 15.000 kg
- **Then** HĐ báo còn thiếu, tách khỏi "lệch dung sai"
- **Assert** `contractCoverage(c)` == { missingKg: 2100, missingContainers: 0, covered: false } (thiếu = 19.000 × 0,9 − 15.000); `contractClosure(c).reason != "out-of-tolerance"`

### AC-24 — Tháng hiện đủ chuyến, HĐ quá hạn và 4 con số · Maps to: NV11 · Test: unit
- **Given** `today = 2026-10-15`; tháng 2026-10 có 3 chuyến của 2 khách (1 khép · 1 thiếu bước · 1 thiếu bước và ETD 2026-10-12 > hạn giao 2026-10-10); 1 HĐ chưa lên chuyến hạn giao 2026-09-20
- **When** dựng dữ liệu tháng 2026-10
- **Then** gom 2 khách, 3 chuyến; HĐ hạn 20/09 hiện ở tháng 10 nhãn trễ
- **Assert** `buildMonthPlan("2026-10", …, today)` có `groups.length == 2`, `shipments == 3`, `closed == 1`, `missingSteps == 2`, `lateShipments == 1`, `overdueContractsWithoutShipment == 1`

### AC-25 — Tra chuyến theo số giấy tờ · Maps to: NV11 · Test: unit
- **Given** chuyến lô 165, booking trống, cont SZLU9522312, invoice 234/26, B/L PAPTYO260926224
- **When** tra lần lượt "165", "szlu9522312", "234/26", "PAPTYO260926224"
- **Then** mỗi lần ra đúng chuyến đó
- **Assert** `searchShipments(all, q).map(s => s.id)` == [id lô 165] cho cả 4 truy vấn

### AC-26 — Xuất Excel theo bố cục sổ cũ, gộp cùng booking · Maps to: NV11 · Test: unit
- **Given** dữ liệu tháng của AC-24, trong đó thêm hai chuyến 40RF + 20RF cùng booking
- **When** xuất Excel
- **Then** cột theo thứ tự sổ "Kế hoạch xuất hàng"; hai chuyến cùng booking thành một dòng
- **Assert** hàng tiêu đề == ["CONT","Khách hàng","Mặt hàng","Lượng (kg)","MSL","Cảng đến","Số booking","Ngày đóng cont","ETD","Đơn giá","Bao bì","Thực xuất (kg)","Giá trị (USD)","Ghi chú"]; dòng chuyến ghép có CONT == "40+20"; số dòng chuyến == 4

### AC-27 — Tiền về cấp chuyến và cấp HĐ, không đổi khép kín · Maps to: NV10 · Test: integration
- **Given** chuyến đã khép (AC-19) với tiền thực xuất 194.557,60; tài khoản `accountant`
- **When** ghi cọc 50.000 ở cấp HĐ, ghi 144.557,60 ở cấp chuyến, rồi xóa và Hoàn tác lần ghi chuyến
- **Then** tổng tiền về HĐ == 194.557,60; chuyến vẫn khép; `planner` đọc được cả 2 dòng
- **Assert** Σ payments của HĐ == 194557.60 sau Hoàn tác; `isShipmentClosed == true`; select payments bằng `planner` trả 2 dòng

### AC-28 — Xóa, hủy và chặn hủy · Maps to: NV13 · Test: e2e
- **Given** HĐ A chờ duyệt chưa chuyến; HĐ B `approved` có 1 chuyến chưa số cont; HĐ C `approved` có 1 chuyến đã có số cont
- **When** xóa A; hủy B có lý do; hủy C
- **Then** A xóa được kèm Hoàn tác; B và chuyến của B bị hủy; C không hủy được
- **Assert** Hoàn tác ⇒ A trở lại với số dòng hàng == như cũ; B và chuyến `status == "cancelled"`; `canCancel(C).ok == false` với `reason == "shipment-loaded"`

### AC-29 — Demo không chạm số thật · Maps to: R14 · Test: manual (vòng kiểm §4b spec chế độ demo — cần DB thật)
- **Given** đếm số dòng `site_id <> 'site-demo'` của mọi bảng mới
- **When** bật demo → tạo HĐ, chuyến, đánh dấu bước bằng file giữ chỗ → thoát demo
- **Then** số dòng thật không đổi; trong demo có chuyến khép được
- **Assert** đếm trước == đếm sau cho từng bảng mới (chênh == 0); trong demo `isShipmentClosed == true` cho ≥ 1 chuyến

### AC-30 — Kỳ xem tháng · tuần · khoảng ngày · Maps to: NV11, R18 · Test: unit
- **Given** chuyến TEST-006 đóng 13/10/2026 (2 cont), chuyến lô 181 đóng 06/10
- **When** xem tuần chứa 15/10; xem khoảng 20/09–12/10; lọc khách KR trong tháng 10
- **Then** tuần ra đúng chuyến đóng 12–18/10; khoảng ra đúng chuyến trong khoảng; lọc khách thì 4 con số chỉ đếm khách đó
- **Assert** `weekPeriod("2026-10-15")` == {from "2026-10-12", to "2026-10-18"}; `buildPeriodPlan(monthPeriod, …, customerId="kr").stats.shipments == 1`; `buildMonthPlan(m).stats == buildPeriodPlan(monthPeriod(m)).stats`

### AC-31 — Lệnh SX chặn khi dòng hàng chưa nối · Maps to: NV8, R16 · Test: unit
- **Given** HĐ đã duyệt, 14 dòng chưa có `productId`, bước 2 có file
- **When** đánh dấu bước 2 xong; rồi nối đủ 14 dòng
- **Then** lần đầu bị chặn; sau khi nối thì xong
- **Assert** `canMarkDone(step2).reason == "lines-unmapped"`; sau nối `canMarkDone(step2).ok == true`

### AC-32 — Gợi ý mặt hàng theo tên HĐ đã nối · Maps to: NV3, R16 · Test: unit
- **Given** HĐ cũ của Seachemot nối "Iwadako blanched cut 2-3g" → p-scm; HĐ khách khác nối cùng tên → p-kr
- **When** gõ cùng tên (khác hoa thường / khoảng trắng) cho HĐ Seachemot; cho khách mới; gõ tên chưa từng nối
- **Assert** `suggestProductId(...)` lần lượt == "p-scm", "p-kr", ""

### AC-33 — H/C tự cấp không bắt số · Maps to: NV8, R20 · Test: unit
- **Assert** H/C `docIssuer = "công ty tự cấp"` có ngày + file ⇒ `canMarkDone.ok == true`; C/O thiếu số ⇒ `missing == ["number"]`

### AC-34 — CIF / CIP tự có mục bảo hiểm · Maps to: NV7, R19 · Test: unit
- **Assert** `missingDocumentItems(…, incoterm "CIF")` kinds == ["commercial-invoice", "insurance"]; CFR == ["commercial-invoice"]

### AC-35 — Chứng từ khách yêu cầu không xóa được · Maps to: NV8, R21 · Test: unit + manual
- **Assert** `isRequiredDocumentItem(terms 18.26, C/O form "vj") == true`; hóa đơn hàng mẫu == false; hộp mục C/O không có nút xóa (thử tay)

### AC-36 — Bản đã sửa sau "yêu cầu sửa" hiện Chờ duyệt · Maps to: NV4/NV5 · Test: unit
- **Assert** lần ghi `needs-revision` 05/08, bản lưu lại 12/08 ⇒ `revisionApprovalLabelState == "pending"`; bản chưa sửa ⇒ "needs-revision"

### AC-37 — Lệch dung sai nói chiều · Maps to: NV12 · Test: unit
- **Assert** `deviationText(16.916) == "thừa 16,9%"`; `deviationText(-10.53) == "thiếu 10,5%"`

### AC-38 — Tra ra HĐ chưa lên chuyến · Maps to: NV11 · Test: unit
- **Assert** `searchContracts(d, "test-g")` == [HĐ TEST-G]; tra theo số đơn "b182" và tên khách "matsu" đều ra đúng 1 HĐ

## 11. Assumptions / Open

**Assumptions (tự quyết, đổi được không tốn dữ liệu):**
- A1. Ghi chú Q5 "phòng KH truy xuất và theo dõi được" ⇒ `planner` **xem và ghi** tiền về (R11). Nếu chỉ cần xem ⇒ bỏ create/update/delete của `planner` ở `export-plans.payments`.
- A2. U4 gồm thủ kho và quản đốc / phó quản đốc cả 3 xưởng (hàng khô cũng đóng cont). Admin bớt được ở Vai trò & quyền.
- A3. HĐ chờ duyệt được lên chuyến kế hoạch; chỉ bước 2 bị chặn.
- A4. Bước 1 xong = HĐ có bản hiệu lực **và** bản đó có file ký.
- A5. Một chuyến = một cont (Q2). Cont "40+20" = hai chuyến cùng booking, chứng từ "dùng chung".
- A6. Tiền tệ ở cấp HĐ (mặc định USD); tiền về ghi tiền tệ riêng, chỉ cộng cùng tiền tệ.
- A7. Kho file riêng (`export-files`), không dùng chung kho của Tài liệu công ty. Lý do: kho đó lọc theo phòng ban; nới ra là đổi RLS đang chạy (🔴).
- A8. Số liệu tháng 10/2026 nhập tay từ sổ Excel tháng 10 (Q6). Không nạp lịch sử.
- A9. "Chuyến đã đóng cont" (chặn hủy HĐ) = chuyến đã có số cont (hoặc biển số xe).

**Open (RED):** không có. Ma trận quyền (R11) đã được đồng ý ở Q11. Lúc build, migration thay ma trận mặc định vẫn theo khuôn `0073` (thay trọn, chạy 2 lần không lỗi, có câu lùi).

## 12. Ràng buộc build (luật repo — không phải hành vi)

- Tên tiếng Anh (luật 8): tài nguyên `export-plans` (+ `.loading`, `.payments`), route `/planning-export` (route phẳng — id nav = path, khuôn mọi màn khác), nav id `planning-export`, vai trò `planner`. Bổ sung từ điển §2b (hợp đồng `exportContract`, bản `revision`, lần duyệt `approval`, gia hạn `deadlineExtension`, chuyến `shipment`, bước `step`, mục chứng từ `documentItem`, thực xuất `actuals`, tiền về `payment`) **trước** khi code.
- Vai trò mới `planner` ⇒ thêm vào `Role`/`ROLES` (`types.ts`), `SYSTEM_ROLE_DEPARTMENTS` (`planner: ["planning"]`), `HOME_BY_ROLE`, **và viết lại hàm SQL `current_user_departments()`** trong migration mới. Thiếu hàm SQL thì RLS không cho `planner` đọc 9 tài liệu, AC-1 đỏ. **Không** chèn dòng `app_roles` cho `planner` (R11).
- Trạng thái mục 4a / 4b **suy từ file**, không lưu cột trạng thái cho hai mục này (để RLS cho U4 chỉ cần quyền thêm file).
- Migration từ `0074` (rà `origin` trước khi đặt), chỉ-thêm, idempotent, RLS ngay (khuôn `has_document_permission`), câu `drop` để lùi; thứ tự deploy: tạo kho file → migration → code.
- `TableMapping` + `refColumns` · `DemoBundle` + `DemoPackLoader` + checklist demo · `rowMarkKey` cho mọi bảng nghiệp vụ · nháp form (luật 17) cho form HĐ, bản sửa, lần duyệt, gia hạn, chuyến, tiền về · nút theo chức năng (luật 16) · ô khách là `Combobox` có tạo mới + bút chì (luật 7).
- Hàm thuần ở `lib/exportPlanning.ts` (có test cùng thư mục): `contractTotals`, `validateContract`, `findDuplicateContract`, `effectiveRevision`, `effectiveDeadline`, `stepState`, `canMarkDone`, `canMarkNotApplicable`, `documentItems`, `shipmentMonth`, `validateShipment`, `shipmentActuals`, `isShipmentLate`, `isShipmentClosed`, `contractCoverage`, `contractClosure`, `canCancel`, `searchShipments`, `buildMonthPlan`, xuất Excel.
- Thêm dòng vào bảng "Code đổi → doc phải update" của CLAUDE.md khi tạo thư mục `features/export-planning`.

## History

- v4 (2026-10-20, sau audit hồ sơ SCM — chủ dự án góp ý): nhãn "khép kín" đổi theo ngôn ngữ chứng từ XK (chuyến **Đủ hồ sơ**, HĐ **Đã xuất đủ** / **Đã chốt HĐ**, "Ngoài dung sai thừa / thiếu"); người ký duyệt chọn từ tài khoản BGĐ (R17 — trước gõ tự do, đã gõ sai tên GĐ); kỳ xem tháng / tuần / khoảng ngày + lọc khách áp cả 4 con số (R18); dòng hàng nối danh mục mặt hàng, bắt trước Lệnh SX, nối không cần bản sửa (R16); bảo hiểm CIF/CIP (R19); H/C tự cấp không bắt số (R20); chứng từ bắt buộc không xóa (R21); số kiểu Anh (R22); cọc cấp HĐ xem / sửa / xóa; khôi phục chuyến hủy; Excel phần còn thiếu + tuần lịch. Domain-Specialist XK veto: "thanh lý" (thuật ngữ pháp lý), gõ tự do người ký, lọc theo ngày ký, thay tên tiếng Anh bằng tên Việt, nối thẳng 141 mã kế toán.
- v3 (2026-10-20): ĐÃ BUILD v1. Lệch nhỏ so với v2: route `/planning-export` (phẳng); kế toán không có Xóa tiền về (giữ luật vai trò — KTT / phòng KH xóa); thực xuất của chuyến "dùng chung" Commercial Invoice tính ở chuyến gốc (không cộng đôi); chạy không nối máy chủ thì ghi chú / số chứng từ thay file làm bằng chứng (như /documents).
- v2 (2026-10-20): rà bởi Domain-Specialist XK + Cross-User-Integrity (25 điểm). Sửa: thực xuất lấy từ invoice thương mại (bỏ hàng mẫu, bỏ B/L); dung sai áp cả kg lẫn tiền, tính biên; `units` vs `cartons`; duyệt gắn **bản** (bản sửa bị từ chối không hủy HĐ); hủy HĐ kéo theo chuyến; hạn giao bắt buộc + HĐ quá hạn hiện ở tháng hiện tại; loại chuyến Xe tải / Đóng ghép; "dùng chung" chứng từ cho cont ghép; quyền đọc của U4; 4a/4b tự suy từ file; thứ tự ngày; gia hạn riêng; L/C + cọc; form/người cấp chứng từ; mốc gửi bộ chứng từ; độ phủ chuyến; tra theo số giấy tờ; cột Đơn giá; demo dùng file giữ chỗ; tiền về xóa được.
- v1 (2026-10-20): khởi tạo đợt 1 từ kế hoạch đã chốt 11 câu.
