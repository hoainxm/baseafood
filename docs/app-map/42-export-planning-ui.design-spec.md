# 42 — design-spec: Phòng Kế hoạch · Xuất khẩu — giao diện đợt 1

> Load khi: chỉnh giao diện màn Xuất khẩu `/planning-export` (lịch xuất hàng theo tháng / tuần / khoảng ngày, danh sách HĐ, hồ sơ HĐ, chuyến, màn đóng hàng) hay form Lập hợp đồng, hộp Nối mặt hàng, hộp duyệt.
covers: src/features/export-planning/**
last_verified: 2026-10-20
ttl_days: 90
<!-- re-verified: 2026-10-20 17:40 — v2 sau ba-spec 41 v4: thanh kỳ xem, nhãn Đủ hồ sơ / Đã xuất đủ / Đã chốt HĐ, Nối mặt hàng, người ký BGĐ, cọc cấp HĐ, Khôi phục chuyến — thử tay preview 1366 px + 360 px × 100 / 130 %. -->

> **Oracle giao diện** — hành vi / luật ở ba-spec [41](41-export-planning.ba-spec.md) (KHÔNG đổi ở đây). Luật UI chung: [`src/design-system/README.md`](../../src/design-system/README.md) (canonical).
> **Vì sao có doc này (chủ dự án 2026-10-20):** bản đầu "chưa trực quan": 6 chấm số không nói thiếu gì, hồ sơ 6 nút ngang không rõ việc tiếp, bước chuyến là thẻ lồng hộp lồng nút, form dài một mạch và lệch hàng.

## Thang người dùng

| Loại | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| Nhân viên Kế hoạch (`planner`, quen, desktop) | Tháng này chuyến nào chưa xong, **thiếu cái gì** | Mỗi chuyến một thanh tiến độ + "Bước tiếp: … — còn thiếu …" | Mở chuyến → làm đúng mục còn thiếu |
| BGĐ / Kế toán (xem, desktop / điện thoại) | Bao nhiêu chuyến đủ hồ sơ, trễ hạn, tiền về | 4 thẻ số + thẻ trạng thái; không nút ghi | Mở hồ sơ để xem |
| Người đóng hàng (`.loading`, điện thoại tại bãi) | Chuyến hôm nay cần chụp | Thẻ chuyến ±7 ngày, nút Đính ảnh to | Đính ảnh |

Trọng số thông tin (planner): **3** = tiến độ + mục còn thiếu, việc làm tiếp của hồ sơ · **2** = ngày đóng / ETD, hạn giao, trễ · **1** = kg, booking, số cont · **0–1** = điều khoản chi tiết, dòng hàng, lịch sử (gập).

## Screen map

| Màn | Vào từ | Đến để làm gì | Step tiếp theo | Primary |
|---|---|---|---|---|
| Xuất khẩu · Lịch xuất hàng | nav "Kế hoạch → Xuất khẩu", trang chủ planner, link `?month=` / `?week=` / `?from=&to=` | xem chuyến của kỳ (tháng / tuần / khoảng ngày) đang ở đâu, thiếu gì | mở chuyến thiếu bước | Lập hợp đồng |
| Xuất khẩu · Hợp đồng | tab "Hợp đồng" | tìm một HĐ bất kỳ tháng | mở hồ sơ | Lập hợp đồng |
| Hồ sơ hợp đồng | nút Mở ở tháng / danh sách, link `?contract=` | làm việc tiếp của HĐ (duyệt, lên chuyến, bước) | bước còn thiếu của chuyến | **Việc tiếp** (suy theo trạng thái: Ghi kết quả duyệt → Lên chuyến → không có) |
| Chuyến (trong hồ sơ) | chọn chuyến / HĐ 1 chuyến tự mở | điền bước còn thiếu | mục "đang" (bước đầu chưa xong) | nút Cập nhật / Đính ảnh của mục đầu còn thiếu |
| Form Lập / sửa HĐ | Lập hợp đồng, Sửa bản chờ duyệt, Ghi bản sửa | ghi đúng HĐ giấy (+ nối mặt hàng nếu biết) | lưu ⇒ mở hồ sơ | Lưu hợp đồng |
| Hộp Nối mặt hàng | nút "Nối mặt hàng" ở khối Dòng hàng của hồ sơ; lỗi chặn Lệnh SX chỉ tới đây | chọn mặt hàng danh mục cho từng dòng (không tạo bản sửa) | lưu ⇒ Lệnh SX đánh xong được | Lưu nối mặt hàng |
| Hộp Ghi kết quả duyệt | nút chính "Ghi kết quả duyệt" | ghi BGĐ ký giấy: kết quả, **người ký chọn từ tài khoản BGĐ**, ngày, scan | lưu ⇒ nút chính đổi sang Lên chuyến | Lưu kết quả duyệt |
| Màn đóng hàng | nav (chỉ quyền `.loading`) | chụp ảnh lớp / seal / số cont | Đính ảnh | Đính ảnh |

## Flows

1. **Theo dõi lịch xuất:** nav → Lịch xuất hàng → chọn Xem theo Tháng / Tuần / Ngày → nhìn cột Tiến độ ("Bước tiếp: … — còn …") → Mở chuyến → khối bước đang làm (viền xanh) → Cập nhật / Đính ảnh → quay lại tháng.
2. **Hợp đồng mới:** Lập hợp đồng (form 5 khối) → Lưu → hồ sơ mở, nút chính "Ghi kết quả duyệt" → duyệt → nút chính "Lên chuyến" → hộp chuyến → khung chuyến hiện ngay dưới đầu hồ sơ.
3. **Đóng hàng (điện thoại):** nav → thẻ chuyến ±7 ngày → Đính ảnh → chụp nhiều ảnh, đánh số lớp → lưu.

## Bố cục từng màn

**Lịch xuất hàng** (v2 — thay "Theo tháng"). Đầu: mô tả 1 câu + `Tabs` (Lịch xuất hàng · Hợp đồng) + nút chính Lập hợp đồng. Thanh lọc HAI hàng, nhãn luôn hiện, KHÔNG `hint`: hàng 1 = **Xem theo** (`ChoiceGroup` Tháng · Tuần · Ngày, rộng cố định 21rem để chữ không gãy) + (tháng / tuần: ‹ nhãn kỳ › + "Nay" khi đang xem kỳ khác — nút nằm TRONG khung điều hướng, không đẩy hàng) hoặc (Ngày: `DateRangeField` "Khoảng ngày xuất (ngày đóng cont, chưa có thì ETD)"); hàng 2 = Khách hàng · Tra cứu (số HĐ, số đơn, MSL, booking, cont, invoice, B/L — mọi kỳ) · Xuất Excel (theo kỳ + khách). 4 thẻ số **theo cả bộ lọc khách**: Chuyến trong tháng/tuần/khoảng · Chuyến đủ hồ sơ · Chuyến còn thiếu · Trễ hạn giao. Tra cứu ra thêm bảng "Hợp đồng khớp chưa có chuyến". Mỗi khách một bảng; cột: Chuyến · Hợp đồng · Đóng · ETD · Kg · **Tiến độ** (thanh 6 khúc + "Bước tiếp: …" + thẻ Trễ / Chờ booking). Bỏ cột chấm số + cột Tình trạng riêng.

**Hồ sơ.** Đầu: Quay lại · tên HĐ · thẻ trạng thái · bên phải **1 nút chính = việc tiếp** + "Thao tác khác ▾" (Popover: Ghi bản sửa / Sửa bản chờ duyệt · Gia hạn · Lên chuyến · Ghi tiền cọc · Đóng tay · Hủy · Xóa). Sau đầu là **chuyến** (≥ 2 chuyến: danh sách chọn có thanh tiến độ), rồi khung chuyến. Điều khoản + dòng hàng + lịch sử bản: các khối GẬP được (mở sẵn khi HĐ còn chờ duyệt / chưa có chuyến).

**Chuyến.** Thẻ thông tin (lưới nhãn–giá trị: booking · đóng · ETD/ETA · tàu · cont · seal · kg) + Sửa / Hủy / Xóa. **Stepper ngang 6 bước** có nhãn (bấm ⇒ cuộn tới bước). Danh sách bước dạng checklist: mỗi bước một khối có đầu (chấm trạng thái · tên · tóm tắt "Xong" / "Còn thiếu: …"), thân là các **hàng mục** (trạng thái · tên · số / ngày · file · nút) ngăn bằng vạch kẻ — không thẻ lồng hộp.

**Form HĐ.** 5 khối đánh số (1 Hợp đồng · 2 Điều khoản & thanh toán · 3 Chứng từ khách yêu cầu · 4 Dòng hàng · 5 File & ghi chú), mỗi khối nền nhạt có tiêu đề. Ví dụ nhập ghi ở dòng phụ dưới tiêu đề khối (không `hint` từng ô cùng hàng). Dòng hàng: đầu dòng tóm tắt "Dòng n · kg · tiền"; ô chính 2 hàng; mã HS + vi sinh gập trong "Thêm chi tiết". Chân hộp: **tổng (thùng · kg · tiền)** bên trái nút Lưu.

**Nhãn chuẩn (v2, ba-spec 41 §NV12).** Chuyến: "Đủ hồ sơ" (thẻ xanh) · "Đủ hồ sơ — xong bước 1–5". HĐ: "Chờ duyệt" → "Đã duyệt" → "Đã xuất đủ" (tự tính) / "Đã chốt HĐ" (tay, kèm "Lý do chốt: …") / "Đã hủy". Lệch: "Ngoài dung sai: kg thừa / thiếu x% · tiền …". Quá hạn: thẻ đỏ "Quá hạn giao dd/mm/yyyy" ở đầu hồ sơ và danh sách HĐ. Nút: **Chốt HĐ** (`lock`, trong menu) · **Mở lại HĐ** (`edit`) · **Khôi phục chuyến** (`edit`, chỉ chuyến đã hủy của HĐ còn mở). Tiền ngoại tệ luôn 2 số lẻ (`formatMoney`).

**Hồ sơ — bổ sung v2.** Ô "Chuyến": "x / y cont" + "+ n chuyến xe tải / đóng ghép" (không đếm xe tải là cont). Ô "Thực xuất · tiền về". Khối gập **Tiền cọc · tiền về cấp hợp đồng** (mỗi lần một hàng: ngày · tiền · kênh · ghi chú · Sửa · 🗑 hỏi tại dòng) — chỉ hiện khi có. Khối Dòng hàng: cột **Mặt hàng (danh mục)** (chưa nối ⇒ thẻ vàng "Chưa nối"), trên bảng nút phụ `outline` **Nối mặt hàng** + câu "n dòng chưa nối — Lệnh sản xuất chỉ xong khi mọi dòng đã nối". Đầu hồ sơ thêm thẻ vàng "n dòng hàng chưa nối danh mục".

**Form HĐ — dòng hàng v2.** Hàng ô thứ nhất 4 cột (lg): Tên hàng (như trên HĐ) · **Mặt hàng (danh mục)** (`Combobox` có tạo mới + bút chì, luật 7) · Size · Quy cách. Rời ô tên tiếng Anh ⇒ tự gợi ý mặt hàng đã nối ở HĐ trước + dòng nhắc "Gợi ý theo HĐ trước cùng tên hàng — kiểm lại". Chân hộp: "n dòng · 1.900 thùng/kiện (2.000 thùng) · kg · tiền · n dòng chưa nối danh mục".

**Hộp Nối mặt hàng.** Mỗi dòng hàng một hàng: trái = Dòng n + tên tiếng Anh + size · quy cách; phải = Combobox mặt hàng. Chân: "Đã nối x / y dòng" + Hủy + Lưu nối mặt hàng. Mở ra đã điền sẵn gợi ý.

**Hộp duyệt.** "Người ký duyệt" = `Combobox` từ tài khoản Giám đốc / Phó giám đốc (dòng phụ = chức vụ), mặc định Giám đốc nếu có đúng 1; chọn PGĐ + đồng ý ⇒ hiện `ChoiceGroup` "Ký theo ủy quyền của Giám đốc?" (bắt "Có"). Chưa có tài khoản BGĐ ⇒ ô gõ tên + dải cảnh báo 1 đoạn TRÊN lưới ô (không `hint` trong hàng — làm lệch ô Ngày duyệt).

**Hộp mục chứng từ.** Chứng từ khách yêu cầu: không có nút xóa. Mục thêm tay: 🗑 `InlineConfirmDelete` (hỏi tại chỗ, có Hoàn tác). Mục dùng chung: dòng "Dùng chung với lô … · số … · ngày …" thay "Chưa có gì". Đóng ghép: hàng "Số cont + seal" trạng thái Không áp dụng, chữ "Không cần — hàng đóng ghép chung cont của chuyến khác", không nút. "Chờ booking" ẩn khi đã có số cont.

## Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Không quyền | Dữ liệu cực đoan |
|---|---|---|---|---|---|
| Lịch xuất hàng | `TableSkeleton` | `EmptyState` "<kỳ> chưa có chuyến nào [của khách này]" nói việc tiếp (Lập HĐ → Lên chuyến) | `EmptyState` lỗi đồng bộ (đèn kết nối) | không quyền xem ⇒ `EmptyState` "Chưa được cấp quyền"; chỉ `.loading` ⇒ màn đóng hàng | 40 chuyến / 20 khách: bảng mỗi khách, thanh tiến độ không xuống dòng |
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

- 2026-10-20 — **v2 sau ba-spec 41 v4** (preview sandbox): 1366 px thanh kỳ xem 2 hàng, ChoiceGroup 21rem không gãy chữ (bản đầu 24rem + "Khoảng ngày" vẫn gãy ⇒ đổi nhãn "Ngày"); hộp Nối mặt hàng 4 dòng TEST-B; hộp duyệt chọn GĐ mặc định, chọn PGĐ ⇒ bắt "ký theo ủy quyền"; dải cảnh báo "chưa có tài khoản BGĐ" chuyển lên trên lưới (bản đầu để `hint` làm lệch ô Ngày duyệt). **360 px × 100 / 130 %**: lịch tuần, khoảng ngày, hồ sơ TEST-B, hộp Nối mặt hàng — `scrollWidth == 360`, 0 phần tử vượt khung.
- 2026-10-20 — **audit bằng hồ sơ thật SCM** (HĐ 18.26 · lô 165 / INV 234/26 · LSX 17.09 · LXH 02.01 cont 40+20) trên preview sandbox, 7 HĐ thử, 50 test case: [`docs/test-cases/Baseafood_TC_xuat-khau-planning-export_2026-10-20.xlsx`](../test-cases/Baseafood_TC_xuat-khau-planning-export_2026-10-20.xlsx) (sheet `Defects` = XK-01…24). Đã sửa: XK-01 Lưu "câm" khi hộp mở lại từ nháp sau tải trang (đích của hộp giờ nằm trong nháp) · XK-02 "undefined/undefined/" ở ô Đóng cont · XK-03 bản 0 lấy ngày ký · XK-04 4a/4b chọn Xong không file thì báo lỗi. Còn mở: XK-05 (số kiểu Anh "10.50" bị đọc thành 1.050 — cần chốt) và các mục UI nhỏ trong sheet.

## History
- v2 (2026-10-20): theo góp ý chủ dự án sau audit — tab "Lịch xuất hàng" + kỳ xem tháng / tuần / ngày, nhãn Đủ hồ sơ / Đã xuất đủ / Đã chốt HĐ, cột + hộp Nối mặt hàng, người ký chọn từ tài khoản BGĐ, khối tiền cọc cấp HĐ, Khôi phục chuyến, tiền 2 số lẻ.
- v1 (2026-10-20): khởi tạo khi chỉnh giao diện bản đầu cho trực quan — `progress.ts` (bước tiếp + còn thiếu, chỉ đọc lib), `StepBar` / `StepStepper` / `CollapsibleSection` ở `parts.tsx`, ShipmentPanel dạng checklist, hồ sơ 1 nút chính + menu, form 5 khối + tổng ở chân hộp.
