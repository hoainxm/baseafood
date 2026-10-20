# 42 — design-spec: Phòng Kế hoạch · Xuất khẩu — giao diện đợt 1

> Load khi: chỉnh giao diện màn Xuất khẩu `/planning-export` (tháng, danh sách HĐ, hồ sơ HĐ, chuyến, màn đóng hàng) hay form Lập hợp đồng.
covers: src/features/export-planning/**
last_verified: 2026-10-20
ttl_days: 90

> **Oracle giao diện** — hành vi / luật ở ba-spec [41](41-export-planning.ba-spec.md) (KHÔNG đổi ở đây). Luật UI chung: [`src/design-system/README.md`](../../src/design-system/README.md) (canonical).
> **Vì sao có doc này (chủ dự án 2026-10-20):** bản đầu "chưa trực quan": 6 chấm số không nói thiếu gì, hồ sơ 6 nút ngang không rõ việc tiếp, bước chuyến là thẻ lồng hộp lồng nút, form dài một mạch và lệch hàng.

## Thang người dùng

| Loại | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| Nhân viên Kế hoạch (`planner`, quen, desktop) | Tháng này chuyến nào chưa xong, **thiếu cái gì** | Mỗi chuyến một thanh tiến độ + "Bước tiếp: … — còn thiếu …" | Mở chuyến → làm đúng mục còn thiếu |
| BGĐ / Kế toán (xem, desktop / điện thoại) | Bao nhiêu chuyến khép, trễ hạn, tiền về | 4 thẻ số + thẻ trạng thái; không nút ghi | Mở hồ sơ để xem |
| Người đóng hàng (`.loading`, điện thoại tại bãi) | Chuyến hôm nay cần chụp | Thẻ chuyến ±7 ngày, nút Đính ảnh to | Đính ảnh |

Trọng số thông tin (planner): **3** = tiến độ + mục còn thiếu, việc làm tiếp của hồ sơ · **2** = ngày đóng / ETD, hạn giao, trễ · **1** = kg, booking, số cont · **0–1** = điều khoản chi tiết, dòng hàng, lịch sử (gập).

## Screen map

| Màn | Vào từ | Đến để làm gì | Step tiếp theo | Primary |
|---|---|---|---|---|
| Xuất khẩu · Theo tháng | nav "Kế hoạch → Xuất khẩu", trang chủ planner | xem chuyến tháng này đang ở đâu, thiếu gì | mở chuyến thiếu bước | Lập hợp đồng |
| Xuất khẩu · Hợp đồng | tab "Hợp đồng" | tìm một HĐ bất kỳ tháng | mở hồ sơ | Lập hợp đồng |
| Hồ sơ hợp đồng | nút Mở ở tháng / danh sách, link `?contract=` | làm việc tiếp của HĐ (duyệt, lên chuyến, bước) | bước còn thiếu của chuyến | **Việc tiếp** (suy theo trạng thái: Ghi kết quả duyệt → Lên chuyến → không có) |
| Chuyến (trong hồ sơ) | chọn chuyến / HĐ 1 chuyến tự mở | điền bước còn thiếu | mục "đang" (bước đầu chưa xong) | nút Cập nhật / Đính ảnh của mục đầu còn thiếu |
| Form Lập / sửa HĐ | Lập hợp đồng, Sửa bản chờ duyệt, Ghi bản sửa | ghi đúng HĐ giấy | lưu ⇒ mở hồ sơ | Lưu hợp đồng |
| Màn đóng hàng | nav (chỉ quyền `.loading`) | chụp ảnh lớp / seal / số cont | Đính ảnh | Đính ảnh |

## Flows

1. **Theo dõi tháng:** nav → Theo tháng → nhìn cột Tiến độ ("Bước tiếp: … — còn …") → Mở chuyến → khối bước đang làm (viền xanh) → Cập nhật / Đính ảnh → quay lại tháng.
2. **Hợp đồng mới:** Lập hợp đồng (form 5 khối) → Lưu → hồ sơ mở, nút chính "Ghi kết quả duyệt" → duyệt → nút chính "Lên chuyến" → hộp chuyến → khung chuyến hiện ngay dưới đầu hồ sơ.
3. **Đóng hàng (điện thoại):** nav → thẻ chuyến ±7 ngày → Đính ảnh → chụp nhiều ảnh, đánh số lớp → lưu.

## Bố cục từng màn

**Theo tháng.** Đầu: mô tả 1 câu + `Tabs` (Theo tháng · Hợp đồng) + nút chính Lập hợp đồng. Thanh lọc MỘT hàng, nhãn luôn hiện, KHÔNG `hint` (làm lệch hàng): chuyển tháng ‹ Tháng › · Khách hàng · Tra cứu · Xuất Excel. 4 thẻ số. Mỗi khách một bảng; cột: Chuyến · Hợp đồng · Đóng · ETD · Kg · **Tiến độ** (thanh 6 khúc + "Bước tiếp: …" + thẻ Trễ / Chờ booking). Bỏ cột chấm số + cột Tình trạng riêng.

**Hồ sơ.** Đầu: Quay lại · tên HĐ · thẻ trạng thái · bên phải **1 nút chính = việc tiếp** + "Thao tác khác ▾" (Popover: Ghi bản sửa / Sửa bản chờ duyệt · Gia hạn · Lên chuyến · Ghi tiền cọc · Đóng tay · Hủy · Xóa). Sau đầu là **chuyến** (≥ 2 chuyến: danh sách chọn có thanh tiến độ), rồi khung chuyến. Điều khoản + dòng hàng + lịch sử bản: các khối GẬP được (mở sẵn khi HĐ còn chờ duyệt / chưa có chuyến).

**Chuyến.** Thẻ thông tin (lưới nhãn–giá trị: booking · đóng · ETD/ETA · tàu · cont · seal · kg) + Sửa / Hủy / Xóa. **Stepper ngang 6 bước** có nhãn (bấm ⇒ cuộn tới bước). Danh sách bước dạng checklist: mỗi bước một khối có đầu (chấm trạng thái · tên · tóm tắt "Xong" / "Còn thiếu: …"), thân là các **hàng mục** (trạng thái · tên · số / ngày · file · nút) ngăn bằng vạch kẻ — không thẻ lồng hộp.

**Form HĐ.** 5 khối đánh số (1 Hợp đồng · 2 Điều khoản & thanh toán · 3 Chứng từ khách yêu cầu · 4 Dòng hàng · 5 File & ghi chú), mỗi khối nền nhạt có tiêu đề. Ví dụ nhập ghi ở dòng phụ dưới tiêu đề khối (không `hint` từng ô cùng hàng). Dòng hàng: đầu dòng tóm tắt "Dòng n · kg · tiền"; ô chính 2 hàng; mã HS + vi sinh gập trong "Thêm chi tiết". Chân hộp: **tổng (thùng · kg · tiền)** bên trái nút Lưu.

## Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Không quyền | Dữ liệu cực đoan |
|---|---|---|---|---|---|
| Theo tháng | `TableSkeleton` | `EmptyState` nói việc tiếp (Lập HĐ → Lên chuyến) | `EmptyState` lỗi đồng bộ (đèn kết nối) | không quyền xem ⇒ `EmptyState` "Chưa được cấp quyền"; chỉ `.loading` ⇒ màn đóng hàng | 40 chuyến / 20 khách: bảng mỗi khách, thanh tiến độ không xuống dòng |
| Hồ sơ | skeleton | HĐ không còn ⇒ `EmptyState` | như trên | xem không ghi: ẩn nút chính + menu | 14 dòng hàng: khối gập; tên dài xuống dòng |
| Chuyến | — | chưa có mục chứng từ ⇒ câu hướng dẫn | — | không ghi: ẩn nút từng hàng | 27 ảnh lớp: chip ảnh gói gọn, xem trong hộp |
| Form | — | — | `ErrorSummary` đầu form | — | 14 dòng hàng: tóm tắt từng dòng, tổng ở chân |
| Không nối máy chủ | — | — | dải cảnh báo 1 dòng | — | ẩn nút tải file |

## Action → expectation

- Lưu HĐ ⇒ hộp đóng, hồ sơ mở, nút chính đổi thành "Ghi kết quả duyệt".
- Ghi duyệt đồng ý ⇒ chấm bước 1 xanh, nút chính đổi thành "Lên chuyến" (khi chưa đủ chuyến).
- Cập nhật mục ⇒ hàng mục đổi thẻ trạng thái, "Còn thiếu" của bước rút ngắn; đủ ⇒ chấm bước xanh, thanh tiến độ tăng khúc.
- Xóa ⇒ toast Hoàn tác (luật 6).

## Platform

Desktop: bảng + stepper ngang. Điện thoại (≤ md): `RecordTable` tự ra thẻ; stepper ngang cuộn trong khung riêng; nút chính full-width; menu "Thao tác khác" vẫn là Popover. Kiểm 360 px + 130 % không tràn ngang.

## QA (screenshot loop)

- 2026-10-20 — preview demo (localStorage, bộ demo 3 HĐ): **desktop 1440** chụp màn tháng, hồ sơ (HĐ đang làm · HĐ chờ duyệt), menu Thao tác khác, form 5 khối — đạt. **360 px × 100 % / 130 %**: đo bằng script mọi trang (tháng, danh sách, 3 hồ sơ, form) `scrollWidth == 360`, 0 phần tử vượt khung hộp — đạt (pane ẩn nên không có ảnh điện thoại; sửa 6 chỗ tràn: stepper chỉ hiện nhãn bước đang làm ở điện thoại, lưới `minmax(0,1fr)` cho hàng checklist / thẻ dòng hàng, tóm tắt bước xuống hàng, nút file co theo khung, thanh tab xuống dòng, nhãn "Mã HS · vi sinh").

## History
- v1 (2026-10-20): khởi tạo khi chỉnh giao diện bản đầu cho trực quan — `progress.ts` (bước tiếp + còn thiếu, chỉ đọc lib), `StepBar` / `StepStepper` / `CollapsibleSection` ở `parts.tsx`, ShipmentPanel dạng checklist, hồ sơ 1 nút chính + menu, form 5 khối + tổng ở chân hộp.
