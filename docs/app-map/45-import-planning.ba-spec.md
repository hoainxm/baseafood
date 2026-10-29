# 45 — ba-spec: Phòng Kế hoạch · Nhập khẩu — Đợt 1 (hợp đồng → bộ chứng từ → số lượng thực nhập)

> Load khi: xây hoặc sửa mảng Nhập khẩu của Phòng Kế hoạch: hợp đồng nhập (đối tác nước ngoài, dòng hàng tên · kg · đơn giá), lần nhập (cont / hàng lẻ, ngày về kho), bộ chứng từ đính kèm (Invoice, Packing List, tờ khai nhập, C/O, kiểm dịch…), số lượng thực nhập theo dòng hàng, đóng hợp đồng, quyền `import-plans`.
covers: src/features/import-planning/**, src/lib/importPlanning.ts, src/lib/importPlanningDemo.ts, src/lib/importFileStorage.ts, supabase/migrations/0082_import_planning.sql
last_verified: 2026-10-29
ttl_days: 90
status: ba-spec v1.1 (2026-10-29) — ĐÃ BUILD 2026-10-29 (code + `0082_import_planning.sql`, kiểm PGlite) — ⏳ 0082 CHƯA chạy trên DB thật: tạo bucket `import-files` (private, 20 MB) → chạy 0082 (2 lần) → deploy. Giao diện: design-spec [46](46-import-planning-ui.design-spec.md).

<!-- re-verified: 2026-10-29 16:00 — build: AC-3…AC-18 = test `src/lib/importPlanning.test.ts` (21) + `importPlanningDemo.test.ts` (4); AC-1/2/19 RLS thử PGlite (chuỗi 0001→0082 + chạy lại 0082: Nhân viên KH ghi 4 bảng; thủ kho đọc dòng hàng, KHÔNG đọc HĐ / chứng từ, chỉ ghi thực nhập, sửa lần nhập ⇒ 0 dòng; kế toán chỉ đọc; qc đọc 0; anon bị từ chối); luồng lập HĐ 2 dòng → lần nhập → 3 chứng từ → thực nhập vượt 200 kg (cảnh báo, vẫn lưu) → đóng thiếu lý do bị chặn → đóng có lý do → mở lại, tra số cont, 360 px × 130 % không tràn — thử tay preview sandbox (không nối máy chủ). Chưa thử: tải file thật, AC-22 demo trên DB thật, AC-23 cần DB. -->

> **Mục đích:** oracle HÀNH VI cho mảng Nhập khẩu đợt 1. Ai làm nghiệp vụ gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (design-spec viết sau, đọc kèm [42](42-export-planning-ui.design-spec.md) để giữ cùng kiểu với Xuất khẩu).
> **Nguồn:** trả lời của chủ dự án 2026-10-29 (§0) · khung Xuất khẩu [41](41-export-planning.ba-spec.md) (chỉ lấy phần dùng được) · kế hoạch gốc [`spec/xuat-khau-phong-ke-hoach.md`](../spec/xuat-khau-phong-ke-hoach.md) §1 ("Phòng Kế hoạch có 3 hạng mục: Xuất khẩu · Nhập khẩu · Khác").
> ⚠️ **"Nhập khẩu" ≠ "Nhập hàng"** (`/imports`, mua nguyên liệu trong nước, [30](30-nhap-hang.md)). Hai mảng không chung bảng, không chung nhãn.

---

## 0. Đã chốt (chủ dự án 2026-10-29)

Phạm vi chủ dự án nêu: **"chỉ cần tạo ngắn gọn: Hợp đồng (tên hàng, số lượng, đơn giá) → Bộ chứng từ đính kèm (Invoice, packing list, CO, tờ khai nhập, kiểm dịch nếu có…) → Số lượng thực nhập"**.

| # | Câu | Trả lời | Hệ quả trong spec |
|---|---|---|---|
| 1 | Một HĐ về mấy lần | **Tùy HĐ** (một hoặc nhiều lần) | HĐ có 1..n **lần nhập** (NI4) |
| 2 | Thứ tự việc | **Khác**: nhập về gia công, **không cần thanh toán** | Không có bước thanh toán (R10) |
| 3 | Bộ chứng từ NCC | (theo phạm vi trên) | R4: 3 bắt buộc + các loại "nếu có" |
| 4 | Giấy để lấy hàng khỏi cảng | **Không cần** tách riêng | Không có bước Thông quan; tờ khai, kiểm dịch nằm trong bộ chứng từ |
| 5 | Loại hình tờ khai | **Cả ba**: sản xuất xuất khẩu · kinh doanh · gia công | Loại hình là thuộc tính của HĐ + tờ khai (R4) |
| 6 | Ai làm thủ tục | **Phòng Kế hoạch tự làm** | U1 ghi hết chứng từ |
| 7 | Cân lại khi về | **Không cân, lấy theo invoice** | Thực nhập = số theo invoice, ghi tay (R5) |
| 8 | Ngưỡng đòi NCC | **Không cần** | Không cảnh báo thiếu hàng theo % |
| 9 | Ai ghi lúc nhận | **Thủ kho ghi, không chụp ảnh** | U4 ghi thực nhập (NI6), không có ảnh |
| 10 | Trả tiền NCC | **Mở L/C** (phần "chưa trả đủ" không trả lời) | Không theo dõi tiền (R10); L/C đính được như chứng từ "Khác" |
| 11 | Duyệt trên app | **Không cần duyệt** | U1 tự đóng HĐ (NI8) |
| 12 | Lô tính vào tháng nào | **Tháng hàng về kho** | R1 |
| 13 | Hạn giao, dung sai | **Không cần** | Không trễ hạn, không dung sai (R10) |
| 14 | Vận chuyển | **Cont lạnh 20 / 40 + hàng lẻ ghép cont**; **không** nhắc hạn trả cont / lưu bãi | R12 |

Đối tác lấy từ **danh mục Nhà cung cấp** (chủ dự án chốt 2026-10-29). Hai câu về cách dựng app (quyền riêng, nối sổ kho) chủ dự án để Claude quyết — xem §11 Assumptions.

## 1. Vấn đề & JTBD

- **Job:** Mỗi lần hàng nhập khẩu về (nguyên liệu gia công, sản xuất xuất khẩu hoặc kinh doanh), **nhân viên Phòng Kế hoạch** muốn biết hợp đồng nào đã về bao nhiêu, lô nào còn thiếu giấy gì, để bộ hồ sơ hải quan đủ và không phải lục giấy khi kiểm tra hay quyết toán.
- **Vì sao làm bây giờ:** Xuất khẩu đã chạy trên app; Nhập khẩu vẫn kẹp giấy. Sổ kho tháng có nhóm "NL nhập khẩu" nhưng không biết lô nào thuộc hợp đồng nào, tờ khai nào.
- **Đo thành công bằng:** mọi lô nhập về kho từ tháng 11/2026 có trên app kèm đủ 3 chứng từ bắt buộc (§8).

**Phạm vi đợt 1 = chỗ chứa + trạng thái.** Không thanh toán, không duyệt, không hạn, không dung sai, không tự ghi sổ kho.

## 2. User registry

| User | Vai trò trong app | Là ai | Bối cảnh |
|---|---|---|---|
| **U1 Nhân viên Kế hoạch** | `planner`, `planning-head`, `planning-deputy` | lập HĐ nhập, ghi lần nhập, đính chứng từ, tự làm thủ tục hải quan + kiểm dịch, đóng HĐ | desktop văn phòng |
| **U4 Thủ kho** | `warehouse-keeper` | ghi số lượng thực nhập khi hàng về kho (theo invoice, không cân lại) | điện thoại / máy kho |
| **U2 Ban giám đốc** | `director`, `vice-director` | chỉ xem | desktop / điện thoại |
| **U3 Kế toán** | `chief-accountant`, `accountant` | chỉ xem (cần tờ khai + invoice khi quyết toán) | desktop |
| **U5 Quản trị** | `admin` | cấp quyền `import-plans` | desktop |
| **S1 Hệ thống** | — | tính tổng HĐ, tháng của lần nhập, chứng từ còn thiếu, còn lại chưa về | nền |

> Ngoài app: đối tác nước ngoài (bên bán hoặc bên thuê gia công), hải quan, cơ quan kiểm dịch. Không actor nào trong số này đăng nhập app.

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NI1 | Cấp quyền Nhập khẩu | U5 | U1, U4 (người được cấp) | — | 1 lần / người | Must |
| NI2 | Lập hợp đồng nhập | U1 | — | — | vài / tháng | Must |
| NI3 | Sửa hợp đồng nhập | U1 | — | NI2 | thỉnh thoảng | Must |
| NI4 | Ghi lần nhập | U1 | U4 (nhận việc ghi thực nhập) | NI2 | mỗi lô | Must |
| NI5 | Đính bộ chứng từ của lần nhập | U1 | — | NI4 | mỗi lô | Must |
| NI6 | Ghi số lượng thực nhập | U4 (U1 ghi thay được) | U1 | NI4 | mỗi lô | Must |
| NI7 | Theo dõi tháng + tra số | U1 | U2, U3 (xem) | NI4 | hằng ngày | Must |
| NI8 | Đóng / mở lại hợp đồng | U1 | — | NI6 | mỗi HĐ | Must |
| NI9 | Hủy / xóa HĐ hoặc lần nhập | U1 | — | NI2 / NI4 | hiếm | Must |

## 4. Cross-user handoff

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Khi không ai nhận |
|---|---|---|---|---|---|
| H1 | NI1 → mọi NI | U5 cấp quyền | U1 / U4 | người dùng có quyền `import-plans` (U1) hoặc `import-plans.receiving` (U4) | không thấy mảng Nhập khẩu; không treo dữ liệu |
| H2 | NI4 → NI6 | U1 ghi lần nhập | U4 ghi thực nhập | lần nhập chưa hủy, HĐ chưa đóng | lần nhập đứng ở "Chờ thực nhập", hiện ở tháng của nó; **U1 ghi thay được** |
| H3 | NI6 → NI8 | S1 tính còn lại | U1 đóng HĐ | — | HĐ đứng ở "Đang nhập", hiện "còn X kg chưa về" |

Chỉ một bàn giao giữa người với người (H2), có người ghi thay. Không có bàn giao nào chờ duyệt.

## 5. Flows

### Flow NI1 — Cấp quyền · owner U5
- **Input:** tài khoản, quyền `import-plans` hoặc `import-plans.receiving` (ma trận mặc định R9).
- **Output:** lần đăng nhập kế tiếp mở được `/planning-import` theo đúng quyền.

### Flow NI2 — Lập hợp đồng nhập · owner U1
- **Start:** đã ký HĐ với đối tác nước ngoài.
- **Input bắt buộc:** đối tác · số HĐ · ngày ký · **loại hình** (sản xuất xuất khẩu · kinh doanh · gia công) · ≥ 1 dòng hàng.
- **Dòng hàng:** **tên hàng** (bắt buộc, chữ như trên HĐ) · **số lượng kg** (bắt buộc, > 0) · **đơn giá** (không bắt — HĐ gia công có thể không ghi giá) · thành tiền (= kg × đơn giá, R2).
- **Input khác:** tiền tệ (mặc định USD) · file HĐ đã ký · ghi chú.
- **Output:** HĐ trạng thái **"Chưa có lần nhập"**; tổng kg, tổng tiền tính sẵn.
- **End:** HĐ có trong danh sách HĐ nhập, tra được theo số HĐ.

### Flow NI3 — Sửa hợp đồng nhập · owner U1
- **Input:** mọi trường của NI2.
- **Output:** HĐ đổi ngay (sửa thẳng, không bản sửa — "ngắn gọn"). Thay đổi vào nhật ký chung.
- **Chặn:** xóa dòng hàng đã có thực nhập (R8). HĐ đã đóng ⇒ phải mở lại trước.

### Flow NI4 — Ghi lần nhập · owner U1
- **Start:** HĐ chưa đóng, chưa hủy; đối tác báo hàng sắp đi hoặc hàng đã về.
- **Input:** HĐ · **ngày về kho** hoặc **ngày dự kiến về** (ít nhất một, R1) · cách vận chuyển (cont lạnh 20 · cont lạnh 40 · hàng lẻ ghép cont, R12) · số cont (không bắt) · số B/L (không bắt) · ghi chú.
- **Output:** lần nhập thuộc HĐ, tháng theo R1; sinh sẵn 3 mục chứng từ bắt buộc (R4) ở trạng thái thiếu; trạng thái **"Thiếu chứng từ"**. HĐ sang **"Đang nhập"**.
- **End:** lần nhập hiện ở đúng tháng, dưới đúng đối tác.

### Flow NI5 — Đính bộ chứng từ · owner U1
- **Input mỗi chứng từ:** loại · số · ngày · file (một hoặc nhiều).
  - Loại bắt buộc: **Commercial Invoice**, **Packing List**, **Tờ khai nhập khẩu** (thêm loại hình, mặc định theo HĐ).
  - Loại "nếu có": **C/O**, **Giấy kiểm dịch**, **B/L**, **Khác** (tự đặt tên, VD L/C, giấy ATTP).
- **Output:** mục có đủ bằng chứng (R4) ⇒ "Đã có". Đủ 3 mục bắt buộc ⇒ lần nhập hết "Thiếu chứng từ".
- **Ngoại lệ:** mục bắt buộc không có thật ⇒ "Không áp dụng" + lý do (R4).
- **End:** trạng thái lần nhập cập nhật ngay (R6).

### Flow NI6 — Ghi số lượng thực nhập · owner U4
- **Start:** hàng đã về kho; lần nhập chưa hủy, HĐ chưa đóng.
- **Input:** **kg thực nhập cho từng dòng hàng của HĐ** (theo invoice, không cân lại — câu 7). Dòng không có trong lô này để trống.
- **Output:** lần nhập có thực nhập; HĐ cập nhật "đã về X / Y kg" từng dòng và cả HĐ (R5). Vượt kg HĐ ⇒ cảnh báo, vẫn lưu.
- **U4 không** sửa HĐ, lần nhập (kể cả ngày về kho — U1 ghi) hay chứng từ; **không** thấy đơn giá, thành tiền (R9).
- **End:** lần nhập sang "Đủ hồ sơ" nếu chứng từ đã đủ (R6).

### Flow NI7 — Theo dõi tháng + tra số · owner U1
- **Input:** tháng (R1) · lọc đối tác (không bắt) · ô tra theo **số HĐ / số invoice / số tờ khai / số cont / số B/L** — tra mọi tháng.
- **Output:** lần nhập của tháng gom theo đối tác, mỗi lần có trạng thái R6 + chứng từ còn thiếu; 3 con số: số lần nhập · đủ hồ sơ · còn thiếu (thiếu chứng từ hoặc chờ thực nhập). HĐ đang nhập hiện "còn X kg chưa về". Xuất Excel đúng bảng đang xem (Should).
- **End:** trả lời được "lô X còn thiếu gì" mà không mở giấy.

### Flow NI8 — Đóng / mở lại HĐ · owner U1
- **Start:** HĐ "Đang nhập", có ≥ 1 lần nhập chưa hủy.
- **Input:** lý do — **bắt buộc khi còn dòng hàng chưa về đủ** (còn lại > 0, R5); không bắt khi mọi dòng đã đủ.
- **Output:** HĐ **"Đã đóng"**; không ghi lần nhập mới. Mở lại ⇒ về "Đang nhập".
- Không cần ai duyệt (câu 11). Không tự đóng (§6).

### Flow NI9 — Hủy / xóa · owner U1
- **Lần nhập:** xóa được khi chưa có file chứng từ nào và chưa có thực nhập; còn lại ⇒ **hủy** + lý do. Lần nhập hủy không tính vào tháng, còn lại, đủ hồ sơ. Khôi phục được khi HĐ chưa đóng.
- **HĐ:** xóa được khi chưa có lần nhập; còn lại ⇒ hủy + lý do, kéo theo hủy mọi lần nhập của HĐ cùng lý do.
- Mọi xóa có xác nhận + **Hoàn tác** (luật repo 6).

## 6. Flow optimization log

> Chạy tuần tự bởi BA-Orchestrator (9 nghiệp vụ nhỏ, 1 bàn giao, phần chuyên môn đã có chủ dự án trả lời) — không lập team riêng.

| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict |
|---|---|---|---|---|---|
| Trục | A. HĐ = 1 lô · B. HĐ 1..n lần nhập, chứng từ gắn lần nhập | **B** | Câu 1 "tùy HĐ"; invoice + tờ khai ra theo từng lô | Chủ dự án | — |
| Bước | A. Khung XK bỏ lệnh SX + bao bì (6 → 4 bước) · B. 5 bước có thông quan + thanh toán · C. HĐ → chứng từ → thực nhập | **C** | Đúng phạm vi chủ dự án nêu; A, B thừa bước (rubric #5), câu 2/4 bỏ thanh toán + thông quan | Chủ dự án + Optimizer | Trang chốt trước đề xuất B — chủ dự án chọn gọn hơn |
| NI5 chứng từ bắt buộc | A. Tự do, không bắt loại nào · B. 3 bắt buộc + "nếu có" · C. Bắt cả 5 loại | **B** | A làm "đủ hồ sơ" vô nghĩa (rubric #2); C sai thực tế ("kiểm dịch nếu có") | Optimizer | Bộ 3 là giả định A3 |
| NI6 thực nhập | A. Một số kg cho cả lô · B. Kg theo từng dòng hàng HĐ · C. Tự lấy từ invoice | **B** | A không biết tên hàng nào còn thiếu khi HĐ nhiều dòng; C cần đọc invoice của từng NCC (mỗi nơi một mẫu) — để sau | Optimizer | — |
| NI8 đóng HĐ | A. Tự đóng khi Σ thực nhập ≥ HĐ · B. U1 đóng tay, bắt lý do khi còn thiếu | **B** | Không dung sai (câu 13) ⇒ về 99,8% là A không bao giờ đóng; B có điểm kết rõ (rubric #3) | Optimizer | — |
| NI3 sửa HĐ | A. Bản sửa như XK · B. Sửa thẳng + nhật ký | **B** | Không duyệt (câu 11) ⇒ bản sửa không có ai xét; nhật ký chung đủ để tra | Optimizer | Có phụ kiện HĐ thì đính file "Khác" |
| Vượt HĐ | A. Chặn · B. Cảnh báo, vẫn lưu | **B** | Thực nhập theo invoice là số thật đã về; chặn làm sổ sai | Optimizer | — |

## 7. Scope & Priority

- **IN (đợt 1):** NI1–NI9.
- **OUT (đợt sau, khi chủ dự án yêu cầu):** thanh toán / L/C có cấu trúc · duyệt · hạn giao + trễ · dung sai · nhắc hạn trả cont, lưu bãi · đọc invoice tự động · ảnh nhận hàng · tự ghi Sổ kho tháng / Nhập hàng / Cân đối (R11) · thanh khoản tờ khai SXXK / gia công · tính thuế.
- **Đi kèm khi build (luật repo):** tour + hộp "?" (QT 18) · nháp form (QT 17) · tô màu dòng + sắp cột (QT 12, 19) · ô danh mục có thêm mới + bút chì (QT 7) · bộ demo (QT 15).

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NI4 / NI5 | lô nhập về kho từ 01/11/2026 có trên app với đủ 3 chứng từ bắt buộc (so với tờ khai nhập của tháng) | 100% |
| NI6 | lô đã về kho > 2 ngày mà chưa có thực nhập | 0 |
| NI2 | thời gian lập 1 HĐ 5 dòng | ≤ 5 phút |
| NI7 | trả lời "lô X còn thiếu gì" khi biết số tờ khai / số cont | ≤ 1 phút |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Tháng của lần nhập = tháng(ngày về kho) ?? tháng(ngày dự kiến về). Thiếu cả hai ⇒ không lưu | dự kiến 28/10, về thật 02/11 ⇒ tháng 11 |
| R2 | Thành tiền dòng = kg × đơn giá, làm tròn 2 số lẻ; đơn giá trống ⇒ thành tiền trống. Tổng kg = Σ kg mọi dòng; tổng tiền = Σ thành tiền các dòng có giá. Số chép từ chứng từ tiếng Anh hiểu theo R22 của [41](41-export-planning.ba-spec.md) | HĐ gia công không ghi giá ⇒ tổng tiền trống, HĐ vẫn lưu |
| R3 | Số HĐ duy nhất theo đối tác (không phân hoa thường, bỏ khoảng trắng đầu / cuối) | " ab-01 " trùng "AB-01" cùng đối tác ⇒ chặn |
| R4 | **Chứng từ.** Bắt buộc mỗi lần nhập: Commercial Invoice · Packing List · Tờ khai nhập khẩu. Một mục **"Đã có"** khi có ≥ 1 file; tờ khai còn bắt **số tờ khai + loại hình**. Mục bắt buộc được **"Không áp dụng"** khi có lý do. C/O · Giấy kiểm dịch · B/L · Khác: thêm khi có, không bắt, xóa được (hỏi lại + Hoàn tác); mục bắt buộc không xóa được | lô hàng mẫu không có invoice thương mại ⇒ "Không áp dụng: hàng mẫu" |
| R5 | **Thực nhập** ghi theo dòng hàng HĐ, kg ≥ 0, theo invoice. Còn lại dòng = kg HĐ − Σ thực nhập của dòng ở các lần nhập chưa hủy. Còn lại < 0 ⇒ cảnh báo "vượt HĐ x kg", **không chặn** | HĐ 10.000 kg, hai lô 6.000 + 4.200 ⇒ còn lại −200, "vượt HĐ 200 kg" |
| R6 | **Trạng thái lần nhập:** thiếu ≥ 1 mục bắt buộc ⇒ "Thiếu chứng từ" (kèm tên mục thiếu); đủ mà chưa dòng nào có thực nhập > 0 ⇒ "Chờ thực nhập"; đủ + có thực nhập ⇒ **"Đủ hồ sơ"**; "Đã hủy". **Trạng thái HĐ:** "Chưa có lần nhập" · "Đang nhập" · "Đã đóng" · "Đã hủy" | thiếu cả chứng từ lẫn thực nhập ⇒ "Thiếu chứng từ" |
| R7 | Đóng HĐ: U1, cần ≥ 1 lần nhập chưa hủy; còn dòng có còn lại > 0 ⇒ bắt lý do. HĐ đã đóng / đã hủy ⇒ không ghi lần nhập mới, không ghi thực nhập | — |
| R8 | Dòng hàng đã có thực nhập > 0 ở lần nhập chưa hủy ⇒ không xóa được (sửa tên / kg / giá vẫn được) | — |
| R9 | **Quyền** (tài nguyên MỚI, mặc định cấm; không đổi `export-plans`) — bảng dưới. U4 đọc được đầu HĐ, tên hàng, kg HĐ, đầu lần nhập; **không** đọc đơn giá, thành tiền, file chứng từ | — |
| R10 | **Không có trong đợt 1** (chủ dự án 2026-10-29): thanh toán, duyệt, hạn giao, trễ, dung sai, ngưỡng thiếu hàng, ảnh nhận hàng, nhắc trả cont / lưu bãi | — |
| R11 | Ghi Nhập khẩu **không** đổi bảng Xuất khẩu, Nhập hàng, Sổ kho tháng, Cân đối (tránh cộng đôi nhóm "NL nhập khẩu" của sổ kho tháng) | — |
| R12 | Cách vận chuyển: cont lạnh 20 · cont lạnh 40 · hàng lẻ ghép cont | hàng lẻ không bắt số cont |
| R13 | File: tối đa 20 MB / file; PDF, ảnh, Word, Excel; kho file riêng của Phòng Kế hoạch, chỉ người có `import-plans` đọc được | — |
| R14 | Chế độ demo: mọi bảng mới vào bộ demo; thao tác demo không đổi số thật (luật repo 15) | — |
| R15 | Đối tác chọn từ **danh mục Nhà cung cấp** (bảng `suppliers`, trên app gọi là "Đại lý" — [32](32-danh-muc.md)). Ô đối tác có thêm mới + sửa nhanh (luật repo 7). Bổ sung trường **quốc gia** (không bắt); trường cũ (tên gọi tắt, tên ghi phiếu, địa chỉ, CCCD / MST, email, ngân hàng) giữ nguyên nghĩa, NCC nước ngoài để trống CCCD được. Nhập hàng không đổi luật: NCC nước ngoài có thể hiện trong ô chọn đại lý của Nhập hàng (chấp nhận ở đợt 1) | — xem A1 |

**R9 — ma trận quyền mặc định:**

| Vai trò | `import-plans` (HĐ, lần nhập, chứng từ, file) | `import-plans.receiving` (thực nhập) |
|---|---|---|
| `planner` | view · create · update · delete · export · view-price | view · create · update |
| `planning-head`, `planning-deputy` | như `planner` | như `planner` |
| `director`, `vice-director` | view · export · view-price | view |
| `chief-accountant`, `accountant` | view · export · view-price | view |
| `warehouse-keeper` | — | view · create · update |
| còn lại | — | — |

## 10. Acceptance Criteria

### AC-1 — Không có quyền thì không vào được Nhập khẩu · Maps to: NI1 · Test: integration
- **Given** tài khoản vai trò `qc` (không có `import-plans` lẫn `.receiving`)
- **When** mở `/planning-import` và đọc bảng hợp đồng nhập qua máy chủ
- **Then** bị chuyển về trang chủ; máy chủ trả rỗng
- **Assert** `canView("import-plans") == false`; số dòng đọc được `== 0`

### AC-2 — Thủ kho chỉ ghi thực nhập, không thấy giá · Maps to: NI6, R9 · Test: integration
- **Given** HĐ 2 dòng có đơn giá, một lần nhập; tài khoản `warehouse-keeper`
- **When** đọc HĐ, ghi thực nhập, rồi thử sửa lần nhập và thêm chứng từ
- **Then** đọc được tên hàng + kg; ghi thực nhập thành công; sửa lần nhập / thêm chứng từ bị từ chối
- **Assert** số trường tiền (đơn giá, thành tiền, tổng tiền) đọc được `== 0`; ghi thực nhập `ok == true`; 2 lần ghi còn lại `rejected == 2`

### AC-3 — Tổng hợp đồng · Maps to: NI2, R2 · Test: unit
- **Given** dòng 1: 10.000 kg × 2,5 USD; dòng 2: 5.000 kg × 3 USD
- **When** tính tổng
- **Then** ra tổng kg và tổng tiền
- **Assert** `totalKg == 15000`; `totalAmount == 40000`

### AC-4 — HĐ gia công không ghi giá vẫn lưu · Maps to: NI2, R2 · Test: unit
- **Given** dòng 1: 8.000 kg, đơn giá trống; dòng 2: 2.000 kg × 1,25
- **When** kiểm và tính tổng
- **Then** không lỗi; thành tiền dòng 1 trống
- **Assert** `validate(...).length == 0`; `lineAmount(dòng 1) == null`; `totalAmount == 2500`; `totalKg == 10000`

### AC-5 — Thiếu trường bắt buộc hoặc trùng số HĐ bị chặn · Maps to: NI2, R3 · Test: unit
- **Given** (a) HĐ thiếu loại hình; (b) HĐ 0 dòng; (c) dòng kg = 0; (d) HĐ số " ab-01 " khi đối tác đã có "AB-01"
- **When** kiểm HĐ
- **Then** mỗi ca ra đúng một lỗi
- **Assert** mã lỗi lần lượt `== "import-type"`, `"no-lines"`, `"line-kg"`, `"duplicate-no"`

### AC-6 — Tháng của lần nhập · Maps to: NI4, R1 · Test: unit
- **Given** (a) ngày về kho 02/11/2026, dự kiến 28/10/2026; (b) chỉ dự kiến 28/10/2026; (c) không có ngày nào
- **When** tính tháng và kiểm lần nhập
- **Then** (a) tháng 11; (b) tháng 10; (c) bị chặn
- **Assert** `importMonth(a) == "2026-11"`; `importMonth(b) == "2026-10"`; lỗi (c) `== "no-date"`

### AC-7 — Lần nhập mới thiếu đúng 3 chứng từ bắt buộc · Maps to: NI4, R4, R6 · Test: unit
- **Given** HĐ "Chưa có lần nhập"
- **When** ghi lần nhập đầu tiên
- **Then** lần nhập "Thiếu chứng từ", HĐ "Đang nhập"
- **Assert** `missingDocs == ["commercial-invoice", "packing-list", "import-declaration"]`; `receiptState == "missing-docs"`; `contractState == "receiving"`

### AC-8 — Mục chứng từ chỉ "Đã có" khi có bằng chứng · Maps to: NI5, R4 · Test: unit
- **Given** (a) Invoice có số + ngày, 0 file; (b) Invoice 1 file; (c) tờ khai 1 file, thiếu loại hình; (d) tờ khai 1 file + số + loại hình
- **When** tính trạng thái mục
- **Then** chỉ (b), (d) là "Đã có"
- **Assert** `hasDoc` lần lượt `== [false, true, false, true]`

### AC-9 — "Không áp dụng" phải có lý do · Maps to: NI5, R4 · Test: unit
- **Given** mục Commercial Invoice bắt buộc, chưa có file
- **When** đánh "Không áp dụng" với lý do trống, rồi với lý do "hàng mẫu"
- **Then** lần 1 bị chặn; lần 2 mục không còn bị tính thiếu
- **Assert** lần 1 `ok == false`; lần 2 `missingDocs` không chứa `"commercial-invoice"`

### AC-10 — C/O và kiểm dịch không bắt · Maps to: NI5, R4 · Test: unit
- **Given** lần nhập có đủ Invoice, Packing List, tờ khai (đủ số + loại hình); không có C/O, kiểm dịch, B/L
- **When** tính chứng từ còn thiếu
- **Then** không thiếu gì
- **Assert** `missingDocs.length == 0`

### AC-11 — Chờ thực nhập rồi Đủ hồ sơ · Maps to: NI6, R6 · Test: unit
- **Given** lần nhập đủ 3 chứng từ, chưa có thực nhập
- **When** tính trạng thái; rồi ghi thực nhập 6.000 kg cho dòng 1
- **Then** trước: "Chờ thực nhập"; sau: "Đủ hồ sơ"
- **Assert** `receiptState` trước `== "awaiting-quantity"`, sau `== "complete"`

### AC-12 — Còn lại theo dòng, vượt HĐ chỉ cảnh báo · Maps to: NI6, R5 · Test: unit
- **Given** dòng HĐ 10.000 kg; lần nhập 1 ghi 6.000 kg; lần nhập 2 ghi 4.200 kg
- **When** tính còn lại và kiểm lần ghi thứ 2
- **Then** còn lại âm, có cảnh báo, vẫn lưu
- **Assert** `remainingKg == -200`; cảnh báo `== "over-contract"` với `overKg == 200`; `blocking == false`

### AC-13 — Lần nhập đã hủy không tính · Maps to: NI9, R5, R6 · Test: unit
- **Given** dòng HĐ 10.000 kg; lần nhập 1 ghi 6.000 kg (chưa hủy); lần nhập 2 ghi 4.000 kg (đã hủy)
- **When** tính còn lại và đếm của tháng
- **Then** lần 2 không vào còn lại, không vào số lần nhập của tháng
- **Assert** `remainingKg == 4000`; số lần nhập của tháng `== 1`

### AC-14 — Đóng HĐ còn thiếu phải có lý do; đóng rồi không ghi thêm · Maps to: NI8, R7 · Test: unit
- **Given** HĐ 2 dòng; dòng 1 về đủ, dòng 2 còn lại 500 kg
- **When** (a) đóng không lý do; (b) đóng với lý do "đối tác giao thiếu"; (c) ghi lần nhập mới vào HĐ đã đóng; (d) mở lại
- **Then** (a) chặn; (b) "Đã đóng"; (c) chặn; (d) "Đang nhập"
- **Assert** (a) `needsReason == true`, `ok == false`; (b) `contractState == "closed"`; (c) lỗi `== "contract-closed"`; (d) `contractState == "receiving"`

### AC-15 — HĐ về đủ mọi dòng đóng không cần lý do · Maps to: NI8, R7 · Test: unit
- **Given** HĐ 2 dòng, mọi dòng còn lại ≤ 0
- **When** kiểm điều kiện đóng
- **Then** đóng được, không bắt lý do
- **Assert** `closeGate == { ok: true, needsReason: false }`

### AC-16 — Không xóa dòng hàng đã có thực nhập · Maps to: NI3, R8 · Test: unit
- **Given** dòng 2 có thực nhập 1.000 kg ở lần nhập chưa hủy
- **When** lưu HĐ đã bỏ dòng 2
- **Then** bị chặn; sửa kg dòng 2 thì lưu được
- **Assert** lỗi `== "line-has-receipts"`; lần sửa kg `validate(...).length == 0`

### AC-17 — Tra theo số giấy tờ ở mọi tháng · Maps to: NI7 · Test: unit
- **Given** lần nhập tháng 09 có tờ khai "105123456789", invoice "INV-77", số cont "ABCU1234567"; HĐ "AB-01" chưa có lần nhập
- **When** tra từng số khi đang xem tháng 11
- **Then** ra đúng lần nhập / HĐ
- **Assert** mỗi lần tra 3 số đầu `results.length == 1` và trỏ đúng lần nhập; tra "ab-01" ra đúng HĐ (`results.length == 1`)

### AC-18 — Tháng gom theo đối tác + 3 con số · Maps to: NI7, R6 · Test: unit
- **Given** tháng 11: đối tác A có 2 lần nhập (1 đủ hồ sơ, 1 thiếu chứng từ), đối tác B 1 lần nhập chờ thực nhập; 1 lần nhập đã hủy
- **When** dựng tháng 11
- **Then** 2 nhóm đối tác; 3 con số
- **Assert** `groups.length == 2`; `{ total: 3, complete: 1, incomplete: 2 }`

### AC-19 — Không đụng sổ khác · Maps to: R11 · Test: integration
- **Given** đếm số dòng các bảng Xuất khẩu, Nhập hàng, Sổ kho tháng, Cân đối
- **When** lập 1 HĐ nhập, ghi 1 lần nhập, đính 3 chứng từ, ghi thực nhập, đóng HĐ
- **Then** các bảng kia không đổi
- **Assert** số dòng mỗi bảng sau `==` trước

### AC-20 — Form tự lưu nháp · Maps to: NI2, NI4, NI6 · Test: e2e
- **Given** đang lập HĐ nhập, đã gõ 2 dòng hàng, chưa lưu
- **When** sang trang khác rồi quay lại; sau đó lưu
- **Then** nháp còn nguyên; lưu xong nháp hết
- **Assert** số dòng hàng khôi phục `== 2`; sau khi lưu số nháp của form `== 0`

### AC-21 — Xóa, hủy và Hoàn tác · Maps to: NI9 · Test: e2e
- **Given** (a) lần nhập chưa có file, chưa thực nhập; (b) lần nhập đã có 1 file
- **When** (a) xóa rồi Hoàn tác; (b) xóa
- **Then** (a) xóa được, Hoàn tác đưa về; (b) chỉ hủy được, bắt lý do
- **Assert** (a) số lần nhập của HĐ sau xóa `== n − 1`, sau Hoàn tác `== n`; (b) `canDelete == false`, hủy lý do trống `ok == false`

### AC-22 — Demo không chạm số thật · Maps to: R14 · Test: manual (vòng kiểm §4b [spec chế độ demo](../spec/che-do-demo.md), cần DB thật)
- **Given** đếm dòng `site_id <> 'site-demo'` của mọi bảng Nhập khẩu
- **When** bật demo, tạo HĐ + lần nhập + chứng từ + thực nhập, tắt demo
- **Then** số thật không đổi
- **Assert** số dòng thật sau `==` trước

### AC-23 — NCC nước ngoài lưu được, sổ đại lý không kẹt · Maps to: NI2, R15 · Test: integration
- **Given** (a) máy chủ đã có cột quốc gia; (b) máy chủ chưa có cột quốc gia
- **When** (a) thêm NCC "Ocean Fresh Co." quốc gia "Nhật Bản", CCCD / MST trống; (b) thêm NCC không ghi quốc gia ngay trong ô đối tác của HĐ nhập, rồi sửa một đại lý cũ ở Nhập hàng
- **Then** (a) NCC lưu được, chọn được cho HĐ; (b) NCC không ghi quốc gia vẫn lưu, sửa đại lý cũ vẫn lên máy chủ (app chỉ gửi cột quốc gia khi có giá trị — ghi quốc gia khi máy chủ chưa có cột thì kẹt, nên chạy 0082 trước khi deploy)
- **Assert** số dòng hàng chờ ghi của bảng `suppliers` sau cả hai ca `== 0`; (a) quốc gia đọc lại `== "Nhật Bản"`

## 11. Assumptions (Claude quyết, chủ dự án đổi được)

- **A1 — Đối tác lấy từ danh mục Nhà cung cấp** (R15) — **chủ dự án chốt 2026-10-29** (bản nháp trước đề xuất danh mục Khách hàng, bị loại). Bên thuê gia công cũng ghi ở danh mục Nhà cung cấp. **Lưu ý khi build:** `toRow` của bảng `suppliers` gửi ĐỦ mọi cột mỗi lần ghi ([32](32-danh-muc.md)) ⇒ cột quốc gia phải chạy migration TRƯỚC khi deploy, hoặc chỉ gửi khi máy chủ đã có cột (như trường khách xuất khẩu của mig 0075) — không thì mọi lần lưu đại lý kẹt hàng chờ.
- **A2 — Quyền riêng** `import-plans` + `import-plans.receiving` (R9), không dùng chung quyền Xuất khẩu ⇒ giao được người chỉ làm Nhập khẩu, không đổi ma trận đang chạy.
- **A3 — Bộ 3 chứng từ bắt buộc** (Invoice, Packing List, tờ khai). C/O, kiểm dịch, B/L không bắt (chủ dự án ghi "kiểm dịch nếu có"). Mục bắt buộc vẫn "Không áp dụng" được (có lý do) để không kẹt lô đặc biệt.
- **A4 — Không nối sổ kho** đợt này (R11). Thực nhập chỉ nằm trong Nhập khẩu.
- **A5 — Nhật ký** dùng nhật ký chung (admin xem ở /audit), không làm bảng nhật ký riêng như Xuất khẩu (R32 của 41).
- **A6 — Loại hình** ghi ở HĐ, tờ khai lấy mặc định theo HĐ và sửa được (một HĐ có thể có lô mở loại hình khác — câu 5 "cả ba").
- **A7 — Route** `/planning-import`, nav nhóm "Kế hoạch" cạnh Xuất khẩu (theo [`spec/xuat-khau-phong-ke-hoach`](../spec/xuat-khau-phong-ke-hoach.md) §4a, đổi tiền tố theo route thật `/planning-export`). Chốt ở design-spec.
- **Tier pha build:** 🟡 — bảng mới + quyền mới, chỉ thêm (migration viết sẵn phần gỡ, chạy hai lần không lỗi). Không ALTER bảng `export_*`, không đổi RLS hay ma trận `export-plans`. Có thể dùng lại hàm thuần của Xuất khẩu (R22 đọc số, khung file) nhưng không đổi hành vi của chúng.

## 12. History

- 2026-10-29 — v1: dựng từ trả lời 14 câu của chủ dự án; phạm vi gọn HĐ → chứng từ → thực nhập.
- 2026-10-29 — v1.1: chủ dự án chốt đối tác lấy từ danh mục Nhà cung cấp (A1, R15), thay danh mục Khách hàng.
- 2026-10-29 — build: `features/import-planning/**`, `lib/importPlanning.ts` (+ test), `lib/importFileStorage.ts` (bucket `import-files`), `lib/importPlanningDemo.ts`, mig `0082`. Thêm khi build: chạy không nối máy chủ ⇒ số chứng từ / ghi chú tính thay file (như Xuất khẩu); thủ kho không sửa ngày về kho (NI6).
