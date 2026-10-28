# 42 — design-spec: Phòng Kế hoạch · Xuất khẩu — giao diện đợt 1

> Load khi: chỉnh giao diện màn Xuất khẩu `/planning-export` (lịch xuất hàng theo tháng / tuần / khoảng ngày, danh sách HĐ, hồ sơ HĐ, chuyến, màn đóng hàng) hay form Lập hợp đồng, hộp Nối mặt hàng, hộp duyệt.
covers: src/features/export-planning/**
last_verified: 2026-10-28
ttl_days: 90
<!-- updated: 2026-10-22 (c) — v7 (ba-spec 41 v7 NV17): khối "Đọc invoice" trong hộp mục Commercial Invoice (hộp cỡ xl), nút "Trích xuất từ chứng từ" quét thêm invoice. -->
<!-- updated: 2026-10-22 (b) — v6 (ba-spec 41 v6): hộp "Tên hàng trên chứng từ" của một khách (danh mục Khách hàng + lối từ hồ sơ HĐ), form HĐ chọn mặt hàng điền 4 ô theo tên của khách, hộp Nối mặt hàng gợi ý theo tên + size của khách, ô danh mục đổi thành "Tên tiếng Anh mặc định". -->
<!-- updated: 2026-10-22 — v5 (ba-spec 41 v5): tab Báo cáo, danh sách file dọc, nhãn v5 (a–n), ô Tên thương mại ở danh mục / form HĐ / hộp Nối mặt hàng. -->
<!-- re-verified: 2026-10-21 — v4 hướng dẫn thao tác (tour 21 bước, ba-spec 43): nút phụ "Hướng dẫn thao tác" + lối từ hộp "?", khung lời, mốc data-tour — chạy thật 1366 px + 360 px × 100 / 130 %. -->
<!-- re-verified: 2026-10-21 — v3 triage giao diện (ui-ux-triage + ui-design-logic): tab 2 cột ở điện thoại, cột bảng theo khách thẳng hàng, thẻ số cùng khuôn, hàng checklist cùng khuôn, tên bước không lặp số, bảng Hợp đồng vừa 1366 px — thử preview demo 1366 px + 360 px × 100 / 130 %. -->
<!-- re-verified: 2026-10-20 17:40 — v2 sau ba-spec 41 v4: thanh kỳ xem, nhãn Đủ hồ sơ / Đã xuất đủ / Đã chốt HĐ, Nối mặt hàng, người ký BGĐ, cọc cấp HĐ, Khôi phục chuyến — thử tay preview 1366 px + 360 px × 100 / 130 %. -->

> **Oracle giao diện** — hành vi / luật ở ba-spec [41](41-export-planning.ba-spec.md) (KHÔNG đổi ở đây). Luật UI chung: [`src/design-system/README.md`](../../src/design-system/README.md) (canonical).
> **Vì sao có doc này (chủ dự án 2026-10-20):** bản đầu "chưa trực quan": 6 chấm số không nói thiếu gì, hồ sơ 6 nút ngang không rõ việc tiếp, bước chuyến là thẻ lồng hộp lồng nút, form dài một mạch và lệch hàng.

## Thang người dùng

| Loại | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| Nhân viên Kế hoạch (`planner`, quen, desktop) | Tháng này chuyến nào chưa xong, **thiếu cái gì** | Mỗi chuyến một thanh tiến độ + "Bước tiếp: … — còn thiếu …" | Mở chuyến → làm đúng mục còn thiếu |
| BGĐ / Kế toán (xem, desktop / điện thoại) | Bao nhiêu chuyến đủ hồ sơ, trễ hạn, tiền về; **kỳ này xuất bao nhiêu, còn bao nhiêu tiền chưa về** (v5) | 4 thẻ số + thẻ trạng thái; **tab Báo cáo** (tổng kỳ, theo tháng, theo khách, HĐ cần chú ý); không nút ghi | Mở HĐ cần chú ý · Xuất Excel |
| Người đóng hàng (`.loading`, điện thoại tại bãi) | Chuyến hôm nay cần chụp | Thẻ chuyến ±7 ngày, nút Đính ảnh to | Đính ảnh |

Trọng số thông tin (planner): **3** = tiến độ + mục còn thiếu, việc làm tiếp của hồ sơ · **2** = ngày đóng / ETD, hạn giao, trễ · **1** = kg, booking, số cont · **0–1** = điều khoản chi tiết, dòng hàng, lịch sử (gập).

## Screen map

| Màn | Vào từ | Đến để làm gì | Step tiếp theo | Primary |
|---|---|---|---|---|
| Xuất khẩu · Lịch xuất hàng | nav "Kế hoạch → Xuất khẩu", trang chủ planner, link `?month=` / `?week=` / `?from=&to=` | xem chuyến của kỳ (tháng / tuần / khoảng ngày) đang ở đâu, thiếu gì | mở chuyến thiếu bước | Lập hợp đồng |
| Xuất khẩu · Hợp đồng | tab "Hợp đồng" | tìm một HĐ bất kỳ tháng | mở hồ sơ | Lập hợp đồng |
| Xuất khẩu · Báo cáo (v5) | tab "Báo cáo", link `?view=reports&report=2026` / `2026-Q3` / `2026-09` | xem số kỳ (NV15 · R25) | mở HĐ cần chú ý | Lập hợp đồng (nút trang; trong tab không có nút chính — Xuất Excel là `outline`) |
| Hồ sơ hợp đồng | nút Mở ở tháng / danh sách, link `?contract=` | làm việc tiếp của HĐ (duyệt, lên chuyến, bước) | bước còn thiếu của chuyến | **Việc tiếp** (suy theo trạng thái: Ghi kết quả duyệt → Lên chuyến → không có) |
| Chuyến (trong hồ sơ) | chọn chuyến / HĐ 1 chuyến tự mở | điền bước còn thiếu | mục "đang" (bước đầu chưa xong) | nút Cập nhật / Đính ảnh của mục đầu còn thiếu |
| Form Lập / sửa HĐ | Lập hợp đồng, Sửa bản chờ duyệt, Ghi bản sửa | ghi đúng HĐ giấy (+ nối mặt hàng nếu biết) | lưu ⇒ mở hồ sơ | Lưu hợp đồng |
| Hộp Nối mặt hàng | nút "Nối mặt hàng" ở khối Dòng hàng của hồ sơ; lỗi chặn Lệnh SX chỉ tới đây | chọn mặt hàng danh mục cho từng dòng (không tạo bản sửa) | lưu ⇒ Lệnh SX đánh xong được | Lưu nối mặt hàng |
| Hộp Tên hàng trên chứng từ (v6) | nút "Tên hàng" ở dòng khách (danh mục Khách hàng) · nút phụ "Tên hàng của <khách>" ở khối Dòng hàng của hồ sơ HĐ | xem / thêm / sửa / xóa 15–20 tên của một khách (NV14) | đóng hộp ⇒ HĐ lập sau dùng tên mới | Thêm tên hàng |
| Hộp Ghi kết quả duyệt | nút chính "Ghi kết quả duyệt" | ghi BGĐ ký giấy: kết quả, **người ký chọn từ tài khoản BGĐ**, ngày, scan | lưu ⇒ nút chính đổi sang Lên chuyến | Lưu kết quả duyệt |
| Màn đóng hàng | nav (chỉ quyền `.loading`) | chụp ảnh lớp / seal / số cont | Đính ảnh | Đính ảnh |
| Hướng dẫn thao tác (lớp phủ) | nút phụ "Hướng dẫn thao tác" cạnh Lập hợp đồng · nút "Bắt đầu hướng dẫn thao tác" trong hộp "?" | đi một vòng các khu vực theo thứ tự công việc (ba-spec 43) | Hoàn tất ⇒ về đúng chỗ cũ | Tiếp theo |

## Flows

1. **Theo dõi lịch xuất:** nav → Lịch xuất hàng → chọn Xem theo Tháng / Tuần / Ngày → nhìn cột Tiến độ ("Bước tiếp: … — còn …") → Mở chuyến → khối bước đang làm (viền xanh) → Cập nhật / Đính ảnh → quay lại tháng.
2. **Hợp đồng mới:** Lập hợp đồng (form 5 khối) → Lưu → hồ sơ mở, nút chính "Ghi kết quả duyệt" → duyệt → nút chính "Lên chuyến" → hộp chuyến → khung chuyến hiện ngay dưới đầu hồ sơ.
3. **Đóng hàng (điện thoại):** nav → thẻ chuyến ±7 ngày → Đính ảnh → chụp nhiều ảnh, đánh số lớp → lưu.

## Bố cục từng màn

**Lịch xuất hàng** (v2 — thay "Theo tháng"). Đầu: mô tả 1 câu + `Tabs` (Lịch xuất hàng · Hợp đồng) + nút chính Lập hợp đồng. Thanh lọc HAI hàng, nhãn luôn hiện, KHÔNG `hint`: hàng 1 = **Xem theo** (`ChoiceGroup` Tháng · Tuần · Ngày, rộng cố định 21rem để chữ không gãy) + (tháng / tuần: ‹ nhãn kỳ › + "Nay" khi đang xem kỳ khác — nút nằm TRONG khung điều hướng, không đẩy hàng) hoặc (Ngày: `DateRangeField` "Khoảng ngày xuất (ngày đóng cont, chưa có thì ETD)"); hàng 2 = Khách hàng · Tra cứu (số HĐ, số đơn, MSL, booking, cont, invoice, B/L — mọi kỳ) · Xuất Excel (theo kỳ + khách). 4 thẻ số **theo cả bộ lọc khách**, thẻ nào cũng có dòng phụ (cùng khuôn): Chuyến trong tháng/tuần/khoảng ("kế hoạch n kg") · Chuyến đủ hồ sơ ("xong bước 1–5") · Chuyến còn thiếu ("chưa xong bước 1–5") · Trễ hạn giao ("+ n HĐ quá hạn…" / "theo ngày on board / ETD"). Tra cứu ra thêm bảng "Hợp đồng khớp chưa có chuyến". Mỗi khách một bảng, **cột cố định % (30 · 16 · 17 · 29) để các bảng thẳng cột nhau**; cột: Chuyến · Hợp đồng · Đóng · ETD · Kg · **Tiến độ** (thanh 6 khúc + "Bước tiếp: …" + thẻ Trễ / Chờ booking). Bỏ cột chấm số + cột Tình trạng riêng.

**Tab đầu trang.** Điện thoại: 2 tab chia đôi bề ngang (lưới 2 cột, ẩn icon, chữ được xuống dòng) — không bao giờ tràn / đè nút Lập hợp đồng; từ sm trở lên co theo chữ.

**Hợp đồng (danh sách).** Cột: Số HĐ (không xuống dòng ở bảng) · Khách · **Hạn giao · ngày ký** (ngày ký là dòng phụ) · Kg · tiền (kg trên, tiền dưới) · Chuyến · Trạng thái (thẻ xếp dọc) — vừa khung 1366 px có thanh bên, không cuộn ngang.

**Hồ sơ.** Đầu: Quay lại · tên HĐ · thẻ trạng thái · bên phải **1 nút chính = việc tiếp** + "Thao tác khác ▾" (Popover: Ghi bản sửa / Sửa bản chờ duyệt · Gia hạn · Lên chuyến · Ghi tiền cọc · Đóng tay · Hủy · Xóa). Sau đầu là **chuyến** (≥ 2 chuyến: danh sách chọn có thanh tiến độ), rồi khung chuyến. Điều khoản + dòng hàng + lịch sử bản: các khối GẬP được (mở sẵn khi HĐ còn chờ duyệt / chưa có chuyến).

**Chuyến.** Thẻ thông tin (lưới nhãn–giá trị tự chia cột, tối thiểu 8rem: desktop 6 cột, điện thoại 2 cột, chữ 130 % về 1 cột; giá trị căn đầu ô: booking · đóng · ETD/ETA · tàu · cont · seal · kg). Ô tóm tắt HĐ ở đầu hồ sơ cùng luật lưới + Sửa / Hủy / Xóa. **Stepper ngang 6 bước** có nhãn (bấm ⇒ cuộn tới bước). Danh sách bước dạng checklist: mỗi bước một khối có đầu (chấm trạng thái · tên · tóm tắt "Xong" / "Còn thiếu: …"), thân là các **hàng mục** (tên + thẻ trạng thái **luôn nằm dưới tên** · số / ngày · file · nút) ngăn bằng vạch kẻ — không thẻ lồng hộp. Tên bước KHÔNG lặp số ("④ Đóng cont", không "④ 4. Đóng cont") — khớp stepper.

**Form HĐ.** 5 khối đánh số (1 Hợp đồng · 2 Điều khoản & thanh toán · 3 Chứng từ khách yêu cầu · 4 Dòng hàng · 5 File & ghi chú), mỗi khối nền nhạt có tiêu đề. Ví dụ nhập ghi ở dòng phụ dưới tiêu đề khối (không `hint` từng ô cùng hàng). Dòng hàng: đầu dòng tóm tắt "Dòng n · kg · tiền"; ô chính 2 hàng; mã HS + vi sinh gập trong "Thêm chi tiết". Chân hộp: **tổng (thùng · kg · tiền)** bên trái nút Lưu.

**Nhãn chuẩn (v2, ba-spec 41 §NV12).** Chuyến: "Đủ hồ sơ" (thẻ xanh) · "Đủ hồ sơ — xong bước 1–5". HĐ: "Chờ duyệt" → "Đã duyệt" → "Đã xuất đủ" (tự tính) / "Đã chốt HĐ" (tay, kèm "Lý do chốt: …") / "Đã hủy". Lệch: "Ngoài dung sai: kg thừa / thiếu x% · tiền …". Quá hạn: thẻ đỏ "Quá hạn giao dd/mm/yyyy" ở đầu hồ sơ và danh sách HĐ. Nút: **Chốt HĐ** (`lock`, trong menu) · **Mở lại HĐ** (`edit`) · **Khôi phục chuyến** (`edit`, chỉ chuyến đã hủy của HĐ còn mở). Tiền ngoại tệ luôn 2 số lẻ (`formatMoney`).

**Hồ sơ — bổ sung v2.** Ô "Chuyến": "x / y cont" + "+ n chuyến xe tải / đóng ghép" (không đếm xe tải là cont). Ô "Thực xuất · tiền về". Khối gập **Tiền cọc · tiền về cấp hợp đồng** (mỗi lần một hàng: ngày · tiền · kênh · ghi chú · Sửa · 🗑 hỏi tại dòng) — chỉ hiện khi có. Khối Dòng hàng: cột **Mặt hàng (danh mục)** (chưa nối ⇒ thẻ vàng "Chưa nối"), trên bảng nút phụ `outline` **Nối mặt hàng** + câu "n dòng chưa nối — Lệnh sản xuất chỉ xong khi mọi dòng đã nối". Đầu hồ sơ thêm thẻ vàng "n dòng hàng chưa nối danh mục".

**Form HĐ — dòng hàng v2.** Hàng ô thứ nhất 4 cột (lg): Tên hàng (như trên HĐ) · **Mặt hàng (danh mục)** (`Combobox` có tạo mới + bút chì, luật 7) · Size · Quy cách. Rời ô tên tiếng Anh ⇒ tự gợi ý mặt hàng đã nối ở HĐ trước + dòng nhắc "Gợi ý theo HĐ trước cùng tên hàng — kiểm lại". Chân hộp: "n dòng · 1.900 thùng/kiện (2.000 thùng) · kg · tiền · n dòng chưa nối danh mục".

**Hộp Nối mặt hàng.** Mỗi dòng hàng một hàng: trái = Dòng n + tên tiếng Anh + size · quy cách; phải = Combobox mặt hàng. Chân: "Đã nối x / y dòng" + Hủy + Lưu nối mặt hàng. Mở ra đã điền sẵn gợi ý.

**Hộp duyệt.** "Người ký duyệt" = `Combobox` từ tài khoản Giám đốc / Phó giám đốc (dòng phụ = chức vụ), mặc định Giám đốc nếu có đúng 1; chọn PGĐ + đồng ý ⇒ hiện `ChoiceGroup` "Ký theo ủy quyền của Giám đốc?" (bắt "Có"). Chưa có tài khoản BGĐ ⇒ ô gõ tên + dải cảnh báo 1 đoạn TRÊN lưới ô (không `hint` trong hàng — làm lệch ô Ngày duyệt).

**Hướng dẫn thao tác (tour, ba-spec 43).** Lối vào: nút `outline` "Hướng dẫn thao tác" (icon Route) đứng TRƯỚC nút chính Lập hợp đồng (không tranh nút chính) + khối nền nhấn đầu hộp "?" có nút "Bắt đầu hướng dẫn thao tác". Lớp phủ: nền tối 45 %, khung sáng viền `primary` quanh khu vực được chỉ (đệm 6 px), mọi cú bấm lên trang bị chặn. Khung lời: dòng đầu "Hướng dẫn thao tác · Bước k/n" + nút ✕ (Thoát, Esc) · thanh tiến độ mảnh · tiêu đề bước (danh từ) · lời (xuống dòng, gạch đầu dòng •; dài thì cuộn trong khung: điện thoại tối đa 26 % màn, desktop 45 %) · Quay lại (`outline`, ẩn ở bước 1) + Tiếp theo / Hoàn tất (`default`). Đặt khung: desktop dưới → trên → phải → trái khu vực, không đủ thì góc dưới phải; điện thoại (< 640 px) khung nằm đáy màn, trang chừa thêm đáy 70 % màn khi tour chạy. Khu vực được chỉ luôn đưa lên sát dưới thanh tiêu đề (cuộn đúng một khung; không bao giờ đẩy khung app). Mốc trên trang: `data-tour` = `export-tabs` · `create-contract` · `period-filter` · `customer-search` · `plan-stats` · `shipment-table` · `shipment-progress` · `pending-contracts` · `open-dossier` · `contract-status` · `next-action` · `dossier-summary` · `shipment-list` · `shipment-card` · `current-step` · `item-status` · `step-update` · `payments` · `contract-details`. Đổi bố cục làm mất mốc ⇒ bước tùy chọn tự bỏ, nhưng phải sửa mốc cùng commit.

**Hộp mục Commercial Invoice (v7 — ba-spec 41 NV17 · R27).** Hộp cỡ **xl** (mục chứng từ khác giữ lg). Dưới ô File thêm khối viền "**Đọc invoice**" (tiêu đề h3), trên → dưới: (1) không nối máy chủ ⇒ `FilePicker` "Chọn file để đọc" (1 file, .xlsx/.xls/.pdf — chỉ đọc, không lưu); có máy chủ ⇒ đọc file chọn ở ô File; mục đã có file đọc được mà chưa chọn file mới ⇒ nút `outline` "Đọc file đã đính" (icon FileSearch); (2) chưa đọc ⇒ 1 câu hướng dẫn (file nào đọc được, bản scan không đọc, đọc để làm gì); (3) đang đọc ⇒ dòng trạng thái "Đang đọc <file>…"; không đọc được ⇒ dải `bg-warning-surface` "<file>: <lý do>"; (4) đọc được ⇒ dòng tóm tắt `tnum` "Đọc từ <file>: Invoice <số> · <ngày> · n dòng · thùng · kg · tiền" + dòng nhạt "Đã điền ô còn trống: …. Bấm Lưu để ghi." + dải cảnh báo **"Số đang ghi khác invoice (chưa ghi đè)"** liệt kê "<ô>: đang ghi X — invoice Y" + nút `default` "Dùng số trên invoice" + dải cảnh báo "Chỗ cần xem lại" (TOTAL lệch cộng dòng, số dòng không có trong HĐ — gom 1 câu, không liệt kê 13 câu; đơn giá khác HĐ từng dòng) + câu đếm "Đã nối mặt hàng x / n dòng — …" + danh sách dòng như hộp Nối mặt hàng: trái = "Dòng n" + `Tag warning` "Không có trong HĐ" / "Giá khác HĐ" + tên đậm + size · quy cách + "thùng · kg · đơn giá/kg · tiền" (`tnum`); phải = `Combobox` "Mặt hàng xưởng · dòng n" (tạo mới + bút chì, mục khớp tên của khách đứng đầu). Không toast khi đọc (luật 13 — chưa ghi gì); Lưu ⇒ toast "Đã lưu · trích xuất n tên hàng của khách" + Hoàn tác. Không quyền giá ⇒ ẩn đơn giá, tiền, "Giá khác HĐ", ô Tổng tiền trong danh sách lệch. Điện thoại: khối đệm 12 px, dòng xếp dọc (Combobox xuống dưới).

**Hộp mục chứng từ.** Chứng từ khách yêu cầu: không có nút xóa. Mục thêm tay: 🗑 `InlineConfirmDelete` (hỏi tại chỗ, có Hoàn tác). Mục dùng chung: dòng "Dùng chung với lô … · số … · ngày …" thay "Chưa có gì". Đóng ghép: hàng "Số cont + seal" trạng thái Không áp dụng, chữ "Không cần — hàng đóng ghép chung cont của chuyến khác", không nút. "Chờ booking" ẩn khi đã có số cont.

**Báo cáo (v5 — ba-spec 41 NV15, R25).** Tab thứ 3 "Báo cáo" (icon `ChartColumn`). Thanh lọc hai hàng, nhãn luôn hiện: hàng 1 = **Xem theo** (`ChoiceGroup` Tháng · Quý · Năm, cùng bề ngang 21rem với Lịch) + ‹ nhãn kỳ › (+ "Nay"); hàng 2 = Khách hàng (lọc mọi số) · Xuất Excel (`outline`). Thân, trên → dưới theo trọng số:
1. **4 thẻ số** (khuôn `StatCard` như Lịch, dòng phụ bắt buộc): Chuyến của kỳ ("m cont") · Thực xuất kg ("kế hoạch x kg") · Giá trị thực xuất USD ("tiền về trong kỳ y USD") — **không quyền giá ⇒ thay bằng** "HĐ ký trong kỳ" ("x kg") · Đúng hạn % ("n trễ / m chuyến đã giao"; chưa chuyến nào giao ⇒ "—").
2. **Theo tháng** (chỉ kỳ quý / năm): bảng tháng × (Chuyến · Cont · Kg kế hoạch · Kg thực xuất · Giá trị · Tiền về) + hàng tổng; tháng không có số vẫn hiện (0) để thấy mùa vụ.
3. **Theo khách:** bảng Khách · HĐ ký · Chuyến · Cont · Kg thực xuất · Giá trị · Đã về · Còn chưa về, sắp theo kg thực xuất giảm dần, hàng tổng cuối. `rowMarkKey` ghép kỳ + khách (luật 12).
4. **Hồ sơ còn kẹt:** 5 hàng bước 1–5, mỗi hàng "Bước n · tên" + số chuyến chưa xong + thanh tỉ lệ trên tổng chuyến của kỳ (`ProportionBar`); 0 ⇒ chữ "Không chuyến nào kẹt".
5. **Hợp đồng cần chú ý:** bảng HĐ · Khách · Vấn đề (thẻ: đỏ "Quá hạn giao" · "Vượt dung sai" · vàng "Thiếu dung sai" · "Còn tiền chưa về") · Chi tiết (VD "thừa 16,9% kg · 12,8% tiền", "còn 194.557,60 USD") · Mở (`ghost`, mở hồ sơ). Không có ⇒ "Không hợp đồng nào cần chú ý trong kỳ".
Cột tiền ẩn hẳn khi không quyền giá (không để ô "—"). Bảng dài dùng `SummaryTable` / `RecordTable` có sẵn (thanh cuộn ngang trên + dưới, luật 14).

**Danh sách file (v5 — thay chip ngang).** Mọi chỗ có file (bước chuyến, hộp mục chứng từ, màn đóng hàng, hồ sơ HĐ) dùng **một** khuôn `FileList`: mỗi file **một hàng** — icon loại · **tên đủ** (xuống dòng khi dài, không cắt) · dòng phụ "Lớp n · người đính · ngày" · bên phải nút `ghost` **Xem** + 🗑 **Gỡ** (`danger`, chỉ khi được gỡ; có Hoàn tác). Nhóm > 6 file: hiện 6 hàng đầu + nút `ghost` "Hiện tất cả n file" / "Thu gọn". Bỏ cụm nút "Gỡ lớp 1 … Gỡ lớp 27" tách rời và nút chữ "Gỡ <tên file>".

**Nhãn v5 (rà ngày 2026-10-22 trên HĐ 18.26 thật).**

| # | Chỗ | Cũ | Mới |
|---|---|---|---|
| a | Form HĐ · đầu hồ sơ · ô tra | "Số đơn của khách" · "Order" · "số đơn" | **"Số PO của khách"** (ba-spec R24) · ô tra "số PO" |
| b | Thẻ chuyến · bảng Lịch | "Kg KH · thực xuất" | "Kg kế hoạch · thực xuất" |
| c | Thẻ trễ ở bảng Lịch + đầu chuyến | "Trễ hạn 05/09/2026" / "Trễ hạn giao (26/09/2026)" (hai ngày khác nghĩa) | **"Trễ hạn giao n ngày"** ở cả hai chỗ; `title` = "Hạn giao dd/mm/yyyy · ngày giao (on board / ETD) dd/mm/yyyy" |
| d | Thẻ tiến độ chuyến | "Đang làm · 2/5 bước" | "Đang làm · xong 2/5 bước bắt buộc" |
| e | "Bước tiếp" | "Bước tiếp: Lệnh sản xuất — còn lệnh sản xuất" | bỏ phần "— còn …" khi chỉ lặp tên bước |
| f | Bước 1 mục (Lệnh SX, Bao bì) | tên bước + tên mục + "Còn thiếu: <tên>" | hàng mục không lặp tên; đầu bước tóm tắt = trạng thái mục ("Chưa làm" / "Đang làm") |
| g | Bước 6 | "Khác" | **"Gửi chứng từ · tiền về"** |
| h | Ô "Thực xuất · tiền về" | "đã về 0,00" | "đã về 0,00 USD" |
| i | Tab Hợp đồng · bộ lọc | "Đang chạy" (≠ thẻ "Chờ duyệt"/"Đã duyệt") | **"Đang mở (chờ duyệt + đã duyệt)"** |
| j | Tab Hợp đồng · cột | "Kg · tiền" ghi "19.000" | "19.000 kg" |
| k | Ô tìm tab Hợp đồng | chữ mờ thay nhãn | nhãn "Tra hợp đồng" luôn hiện (luật 5) |
| l | Ô tra Lịch | "số giấy tờ" | "số chứng từ" |
| m | Thanh tab | "Lịch xuất hàng" gãy 2 dòng ở desktop | không xuống dòng từ sm trở lên |
| n | File | chip ngang cắt tên + cụm "Gỡ lớp n" | `FileList` (mục trên) |

**Danh mục Mặt hàng — Tên thương mại (v5, ba-spec R23).** Hộp Thêm/Sửa: ô chữ **"Tên thương mại (tiếng Anh)"** ngay dưới "Tên mặt hàng", ví dụ "VD: Frozen iwadako boiled cut"; cột bảng phụ (xem ở Chi tiết); ô tìm tìm cả tên này. Tiêu đề tab "Mặt hàng" (bỏ chữ "cân đối" — danh mục dùng chung). Máy chủ chưa có cột ⇒ ô tự ẩn. **Form HĐ:** chọn mặt hàng cho dòng tên trống ⇒ ô tên hàng tự điền tên thương mại. **Ô chọn mặt hàng** (form + hộp Nối): dòng phụ = tên thương mại (tìm được bằng tên này); hộp Nối mở ra điền sẵn khi khớp đúng 1 mặt hàng, các mục khớp đứng đầu danh sách.

**Hộp Tên hàng trên chứng từ (v6.1 — ba-spec 41 NV14 · NV16 · R23; sửa 2026-10-22 vì bản thẻ "rối mắt, khó đối chiếu").** `FormDialog` cỡ **xl** (64rem), tiêu đề "Tên hàng trên chứng từ · <Khách>", mô tả 1 câu. Thân trên → dưới: (1) dải cảnh báo khi máy chủ chưa có bảng; (2) khối form Thêm / Sửa (khi mở, nền nhạt, tiêu đề "Sửa tên hàng · <mặt hàng>") — `Combobox` Mặt hàng (xưởng) (tạo mới + bút chì) · Tên trên chứng từ* · Size · Quy cách đóng gói · Mã HS · Ghi chú, lưới 2 cột (sm) / 3 cột (lg) + Hủy + Lưu tên hàng; (3) ô **Tra tên hàng** (nhãn luôn hiện; lọc theo tên, mặt hàng, size, mã HS, mã kế toán) + đếm "n / m tên" + nút `outline` **Trích xuất từ chứng từ** (icon FileSearch, căn phải; quét mọi HĐ của khách — thêm được ⇒ toast + Hoàn tác, không thêm gì ⇒ dòng trạng thái tại chỗ, không toast); bảng trống ⇒ câu hướng dẫn + cùng nút; (4) **bảng** (`RecordTable`, điện thoại tự ra thẻ) — cột thẳng hàng, % cố định: **Tên trên chứng từ** (đậm, cột chính) · **Mặt hàng xưởng** (tên + dòng phụ mã kế toán — phân biệt hai mặt hàng trùng tên) · **Size** · **Quy cách** · **Mã HS** (`tnum`); size / quy cách dài tách **mỗi ý một dòng** theo dấu "·" (không nối thành đoạn); ghi chú là dòng nhạt dưới mặt hàng xưởng; sắp mặc định theo tên rồi size (hai size cùng tên đứng cạnh nhau), bấm tiêu đề cột để sắp; cuối dòng bút chì `edit` + thùng rác `InlineConfirmDelete`. Trống ⇒ câu hướng dẫn. Nút chính chân hộp: **Thêm tên hàng**. Bảng trong hộp ⇒ không tô màu dòng (ngoại lệ luật 12).

**Form HĐ v6.** Chọn mặt hàng ⇒ ô tên · size · quy cách · mã HS **đang trống** điền theo tên của khách (khách chưa có ⇒ chỉ ô tên = tên tiếng Anh mặc định); dòng phụ ô chọn mặt hàng = "mã · tên của khách" (không có thì tên mặc định) ⇒ gõ tên tiếng Anh tìm được. Rời ô tên ⇒ gợi ý theo R23 (4 bậc, dùng size của dòng). Dòng nhắc "Gợi ý theo tên hàng của khách / HĐ trước — kiểm lại".

**Hộp Nối mặt hàng v6.** Gợi ý theo tên + size của dòng (bậc 1–4); mục khớp tên của khách đứng đầu danh sách; câu dưới tiêu đề hộp: "Lưu xong, app tự thêm tên còn thiếu vào danh sách Tên hàng của khách."

**Danh mục Mặt hàng v6.** Ô đổi nhãn **"Tên tiếng Anh mặc định"**, ví dụ "VD: Frozen boiled octopus — dùng khi khách chưa có tên riêng (Tên hàng ở danh mục Khách hàng)".

## Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Không quyền | Dữ liệu cực đoan |
|---|---|---|---|---|---|
| Lịch xuất hàng | `TableSkeleton` | `EmptyState` "<kỳ> chưa có chuyến nào [của khách này]" nói việc tiếp (Lập HĐ → Lên chuyến) | `EmptyState` lỗi đồng bộ (đèn kết nối) | không quyền xem ⇒ `EmptyState` "Chưa được cấp quyền"; chỉ `.loading` ⇒ màn đóng hàng | 40 chuyến / 20 khách: bảng mỗi khách, thanh tiến độ không xuống dòng |
| Hồ sơ | skeleton | HĐ không còn ⇒ `EmptyState` | như trên | xem không ghi: ẩn nút chính + menu | 14 dòng hàng: khối gập; tên dài xuống dòng |
| Chuyến | — | chưa có mục chứng từ ⇒ câu hướng dẫn | — | không ghi: ẩn nút từng hàng | 27 ảnh lớp: chip ảnh gói gọn, xem trong hộp |
| Form | — | — | `ErrorSummary` đầu form | — | 14 dòng hàng: tóm tắt từng dòng, tổng ở chân |
| Không nối máy chủ | — | — | dải cảnh báo 1 dòng | — | ẩn nút tải file; khối Đọc invoice có ô "Chọn file để đọc" riêng |
| Khối Đọc invoice (v7) | "Đang đọc <file>…" | chưa đọc ⇒ câu hướng dẫn | bản scan / loại file khác / không nhận ra bảng ⇒ dải cảnh báo nói lý do + việc tiếp | không quyền giá ⇒ ẩn tiền | 13+ dòng: danh sách cuộn trong hộp; mọi dòng không khớp HĐ ⇒ 1 câu "kiểm lại đã đính đúng invoice" |
| Hộp Tên hàng (v6) | danh sách mờ | câu hướng dẫn trích xuất / Thêm | `ErrorSummary` ở khối form; máy chủ chưa có bảng ⇒ dải cảnh báo, ẩn Thêm / Sửa / Xóa | không ghi danh mục khách lẫn Xuất khẩu ⇒ chỉ xem | 20+ tên: danh sách cuộn trong hộp, tên dài xuống dòng |
| Báo cáo (v5) | `TableSkeleton` | kỳ không có chuyến lẫn HĐ ⇒ `EmptyState` "<kỳ> chưa có số xuất khẩu [của khách này]" + gợi ý đổi kỳ | như Lịch | không quyền giá ⇒ ẩn mọi cột / thẻ tiền | năm 40 chuyến / 20 khách: bảng khách sắp kg, tháng 0 vẫn hiện; tiền tới hàng trăm nghìn USD 2 số lẻ |
| Hướng dẫn thao tác | chưa có lối vào khi trang đang tải (R7) | không có hợp đồng ⇒ phần hồ sơ gói thành 1 lời giữa trang | khu vực không hiện sau ~3 giây (đứng yên 300 ms thì thôi) ⇒ bước tùy chọn bỏ qua, bước bắt buộc thành lời giữa trang | chỉ xem ⇒ bỏ bước Lập hợp đồng / Cập nhật mục / Tiền về | khu vực cao hơn màn ⇒ thấy phần đầu; lời dài cuộn trong khung |

## Action → expectation

- Đổi kỳ / khách ở Báo cáo ⇒ mọi thẻ + bảng đổi ngay, URL giữ kỳ (`?report=`), không toast (luật 13). Mở HĐ cần chú ý ⇒ hồ sơ HĐ; Quay lại ⇒ đúng tab Báo cáo + kỳ cũ.
- Gỡ file ở `FileList` ⇒ hàng biến mất, toast Hoàn tác; "Hiện tất cả" ⇒ mở hết ngay tại chỗ.
- Chọn file invoice (v7) ⇒ đọc ngay, ô trống phía trên được điền, khối hiện tóm tắt; không toast. "Dùng số trên invoice" ⇒ ô lệch đổi số, dải lệch biến mất. Lưu ⇒ hộp đóng, hàng mục hiện "thùng · kg · tiền" mới, toast có Hoàn tác (gỡ cả tên trích xuất). Hủy ⇒ không ghi gì.

- Lưu HĐ ⇒ hộp đóng, hồ sơ mở, nút chính đổi thành "Ghi kết quả duyệt".
- Ghi duyệt đồng ý ⇒ chấm bước 1 xanh, nút chính đổi thành "Lên chuyến" (khi chưa đủ chuyến).
- Cập nhật mục ⇒ hàng mục đổi thẻ trạng thái, "Còn thiếu" của bước rút ngắn; đủ ⇒ chấm bước xanh, thanh tiến độ tăng khúc.
- Xóa ⇒ toast Hoàn tác (luật 6).
- Bắt đầu hướng dẫn thao tác ⇒ bước 1 hiện ngay, trang khóa bấm; Hoàn tất / ✕ / Esc ⇒ lớp phủ tắt, trang về đúng tab, kỳ xem, hồ sơ, vị trí cuộn lúc bắt đầu. Không toast (luật 13 — thao tác trình bày).

## Platform

Desktop: bảng + stepper ngang. Điện thoại (≤ md): `RecordTable` tự ra thẻ; stepper ngang cuộn trong khung riêng; nút chính full-width; menu "Thao tác khác" vẫn là Popover. Kiểm 360 px + 130 % không tràn ngang.

## QA (screenshot loop)

- 2026-10-20 — preview demo (localStorage, bộ demo 3 HĐ): **desktop 1440** chụp màn tháng, hồ sơ (HĐ đang làm · HĐ chờ duyệt), menu Thao tác khác, form 5 khối — đạt. **360 px × 100 % / 130 %**: đo bằng script mọi trang (tháng, danh sách, 3 hồ sơ, form) `scrollWidth == 360`, 0 phần tử vượt khung hộp — đạt (pane ẩn nên không có ảnh điện thoại; sửa 6 chỗ tràn: stepper chỉ hiện nhãn bước đang làm ở điện thoại, lưới `minmax(0,1fr)` cho hàng checklist / thẻ dòng hàng, tóm tắt bước xuống hàng, nút file co theo khung, thanh tab xuống dòng, nhãn "Mã HS · vi sinh").

- 2026-10-20 — **v2 sau ba-spec 41 v4** (preview sandbox): 1366 px thanh kỳ xem 2 hàng, ChoiceGroup 21rem không gãy chữ (bản đầu 24rem + "Khoảng ngày" vẫn gãy ⇒ đổi nhãn "Ngày"); hộp Nối mặt hàng 4 dòng TEST-B; hộp duyệt chọn GĐ mặc định, chọn PGĐ ⇒ bắt "ký theo ủy quyền"; dải cảnh báo "chưa có tài khoản BGĐ" chuyển lên trên lưới (bản đầu để `hint` làm lệch ô Ngày duyệt). **360 px × 100 / 130 %**: lịch tuần, khoảng ngày, hồ sơ TEST-B, hộp Nối mặt hàng — `scrollWidth == 360`, 0 phần tử vượt khung.
- 2026-10-20 — **audit bằng hồ sơ thật SCM** (HĐ 18.26 · lô 165 / INV 234/26 · LSX 17.09 · LXH 02.01 cont 40+20) trên preview sandbox, 7 HĐ thử, 50 test case: [`docs/test-cases/Baseafood_TC_xuat-khau-planning-export_2026-10-20.xlsx`](../test-cases/Baseafood_TC_xuat-khau-planning-export_2026-10-20.xlsx) (sheet `Defects` = XK-01…24). Đã sửa: XK-01 Lưu "câm" khi hộp mở lại từ nháp sau tải trang (đích của hộp giờ nằm trong nháp) · XK-02 "undefined/undefined/" ở ô Đóng cont · XK-03 bản 0 lấy ngày ký · XK-04 4a/4b chọn Xong không file thì báo lỗi. Còn mở: XK-05 (số kiểu Anh "10.50" bị đọc thành 1.050 — cần chốt) và các mục UI nhỏ trong sheet.

- 2026-10-21 — **triage v3** (skill ui-ux-triage + ui-design-logic, preview demo `site-demo` bộ 7 HĐ): 1366 px + 360 px × 100 / 130 %. Sửa: tab "Hợp đồng" bị nút Lập hợp đồng đè ở 360 px (TabsList `h-10` thắng `h-auto` ⇒ tab tràn khung); bảng mỗi khách lệch cột nhau (cột co theo chữ) ⇒ `width` %; khoảng trống 32 px thừa trên mọi `RecordTable` (hàng công cụ rỗng + chỗ neo đầu bảng nổi ăn `space-y`) — tên khách cách bảng của mình xa hơn cách bảng trên; thẻ "Trễ hạn giao" lệch khuôn 3 thẻ kia; thẻ số điện thoại nhãn bẻ 3 dòng ⇒ icon lên trên (design-system); hàng checklist thẻ trạng thái lúc cạnh tên lúc xuống dòng; "④ 4. Đóng cont" lặp số; thẻ thông tin chuyến / HĐ 1 cột dài ở điện thoại + giá trị căn giữa dọc; bảng Hợp đồng tràn 24 px ở 1366 px, thẻ trạng thái bị cột Thao tác che; nút "Sắp theo" lặp ở mỗi bảng khách 1–2 dòng. Đo: `scrollWidth == 360`, 0 phần tử vượt khung ở lịch, hồ sơ, danh sách HĐ (130 %). Để nguyên: "Xem theo" 2+1 nút ở điện thoại (luật chung `ChoiceGroup`), nhãn cột "Kg KH · thực xuất" xuống 2 dòng (đều ở mọi bảng), booking dài ngắt ở dấu "-".

- 2026-10-21 — **hướng dẫn thao tác** (preview demo 7 HĐ, script đo vì pane ẩn): 21 bước ở 1366 px và 360 px × 100 / 130 % — 0 bước khu vực khuất dưới thanh tiêu đề, 0 bước khung lời đè khu vực, 0 khung tràn, `scrollWidth` 1366 / 360, thanh tiêu đề không trôi, vị trí cuộn + đường dẫn trả đúng, khóa `bsf*` dưới máy không đổi. Sửa trong lúc đo: cuộn bằng `scrollIntoView` ở cuối trang đẩy cả khung app lên 600 px (đổi sang tự cuộn đúng một khung) · khung cuộn ngang của bảng bị nhận nhầm là khung dọc · điện thoại khung lời che khu vực (đổi sang đưa khu vực lên sát thanh tiêu đề + chừa đáy) · số bước nhảy cóc 6 → 9 (dò trước bước cùng chỗ xem). Lỗi có sẵn ngoài tour, để việc riêng: thanh tiêu đề tràn ngang khi bật DEMO + chữ 130 % (Nhập hàng 462 px).

- 2026-10-22 — **v5** (preview `baseafood-demo`, bộ demo sinh từ sandbox): tab Báo cáo năm / quý ở 1366 px (4 khối cùng bề ngang 1003 px, không khối nào tràn — bản đầu biểu đồ 12 tháng đẩy khối "Theo tháng" ra 1224 px ⇒ bọc `HorizontalScroll` + lưới `minmax(0,1fr)`; dòng Tổng đặt trong `tfoot` của bảng làm gãy 5 dòng + lỗi `<p>` trong `<tfoot>` ⇒ dời ra dưới bảng; tên cột tiền rút gọn, đơn vị USD nói ở câu dưới tiêu đề), 360 px × 100 / 130 % `scrollWidth == 360`, 0 phần tử tràn ngoài khung cuộn riêng; `FileList` 25 ảnh gập còn 6 → "Hiện tất cả 25 file" mở đủ → "Thu gọn" về 6, cụm "Gỡ lớp n" đã hết; khai tên thương mại ở danh mục rồi chọn mặt hàng ở form HĐ ⇒ tên hàng tự điền "Frozen iwadako boiled cut", ô chọn tìm được bằng tên tiếng Anh; console 0 lỗi sau tải lại.

- 2026-10-22 (b) — **v6** (preview `baseafood-demo`, bộ demo mới 18 tên trích xuất): danh mục Khách hàng có "Tên hàng (n)" mỗi dòng; hộp Tên hàng của khách 9 tên (tên đậm · quy cách · mặt hàng xưởng · "Trích xuất từ HĐ …"), Thêm → Lưu trống ⇒ `ErrorSummary` 2 lỗi; form HĐ: chọn khách → ô mặt hàng có dòng phụ = tên của khách → chọn ⇒ tên + quy cách tự điền; hồ sơ HĐ có nút "Tên hàng của <khách>"; nối 1 dòng chưa nối ⇒ toast "… · thêm 1 tên hàng của khách" (Hoàn tác — chưa bấm thử); hộp Tên hàng 360 px × 130 % không tràn; console 0 lỗi của app.

## v8 (2026-10-28) — quy trình duyệt mới (ba-spec 41 §0)

- **Thanh chặng** `ContractFlowBar` (`parts.tsx`, mốc `contract-flow`) ngay dưới đầu hồ sơ: Duyệt HĐ · Đính kèm · Ghi chuyến · Duyệt cuối · Đóng HĐ — xong = tích xanh, đang ở = vàng + dòng "ai làm"; điện thoại chỉ chặng đang ở hiện nhãn (như `StepStepper`). Rê / focus chặng ⇒ `title` giải thích.
- **Nút chính theo chặng + vai trò**: Duyệt hợp đồng (U6) → Đính kèm hồ sơ (U1) → Ghi chuyến (U1, chỉ khi `shipmentGate` ok) → Duyệt cuối (U6, `lock`). Chặng không phải việc của người xem ⇒ thẻ chờ "Chờ Trưởng / Phó phòng Kế hoạch duyệt…". "Chốt HĐ" bỏ; "Duyệt cuối · đóng HĐ" ở Thao tác khác cho đóng sớm (bắt lý do). Mở lại HĐ chỉ U6.
- **Khối "Hồ sơ đính kèm"** (mốc `contract-attachments`, mở sẵn khi Chờ đính kèm): thẻ từng loại bắt buộc (đã có / còn thiếu) + nút Đính kèm file + `FileList` (Gỡ có Hoàn tác). Hộp `AttachmentDialog`: chọn loại (ChoiceGroup, đánh dấu "(còn thiếu)"), ghi chú, nhiều file; nháp `useDialogDraft`.
- **Hộp Duyệt hợp đồng** (`ApprovalDialog` viết lại): bỏ chọn người ký BGĐ + ủy quyền + file scan; "Người duyệt" chỉ đọc = tài khoản đang đăng nhập. **Hộp Duyệt cuối** (`FinalReviewDialog`): khung tóm tắt thực xuất / dung sai (vàng khi đóng sớm), Đồng ý — đóng hợp đồng / Trả về — sửa hồ sơ, lý do bắt khi trả về hoặc đóng sớm.
- **Khối "Nhật ký thao tác"** (mốc `contract-activity`, gập sẵn) cuối hồ sơ: `ActivityList` — mới trước, 15 dòng rồi "Hiện tất cả", mỗi dòng: việc · giờ · người · chuyến.
- **Thẻ trạng thái HĐ** 6 nhãn (`CONTRACT_STATE_TAG` ở `progress.ts`): Chờ duyệt (pending) · Chờ đính kèm (warning) · Đang ghi chuyến (source) · Chờ duyệt cuối (pending) · Đã đóng HĐ (done) · Đã hủy (muted). Bộ lọc danh sách HĐ theo 6 nhãn + "Đang mở". Chữ "Lên chuyến" → **"Ghi chuyến"** mọi chỗ.
- **Chú thích viết tắt**: nút "?" (`AbbrHint`) tự gắn cạnh nhãn `Field` / `DateField` / `Combobox` / `NumberField`, tiêu đề cột `RecordTable` (ngoài nút sắp xếp), nhãn thông tin hồ sơ / chuyến (`Info`, `Fact`); chữ trong câu dùng `Abbr`.

## History
- v8 (2026-10-28): quy trình duyệt mới — thanh chặng, nút chính theo chặng + vai trò, khối Hồ sơ đính kèm, hộp Duyệt / Duyệt cuối / Đính kèm, khối Nhật ký thao tác, thẻ 6 trạng thái, chú thích viết tắt. Tour 22 bước (thêm "Thanh chặng của hợp đồng"). Chưa chạy thử tay trên preview ở bản ghi này — xem mục QA.
- v7 (2026-10-22 tối): khối "Đọc invoice" trong hộp mục Commercial Invoice (hộp xl) — đọc file Excel / PDF xuất từ Excel, điền ô trống, báo ô lệch + "Dùng số trên invoice", so với HĐ, nối dòng → trích xuất tên khi Lưu; không nối máy chủ có ô chọn file chỉ để đọc. Nút "Trích xuất từ chứng từ" quét thêm invoice (đang chạy đổi chữ "Đang trích xuất…"; file bỏ qua báo tại chỗ).
- v6.2 (2026-10-22): nút "Trích xuất từ chứng từ" trong hộp Tên hàng; chữ "tự học" đổi thành "trích xuất"; mô tả hộp viết lại (đối chiếu mặt hàng xưởng ⇄ tên, size, quy cách, mã HS của khách); hàng tên cột nổi của bảng trong hộp thoại dính đỉnh vùng cuộn (sửa lỗi lơ lửng giữa hộp).
- v6.1 (2026-10-22): hộp Tên hàng trên chứng từ đổi từ thẻ chồng chữ sang bảng 5 cột thẳng hàng + ô tra, size / quy cách tách dòng theo ý, mã kế toán dưới mặt hàng.
- v6 (2026-10-22 chiều): hộp Tên hàng trên chứng từ theo khách · form HĐ điền 4 ô theo tên của khách · Nối mặt hàng theo tên + size · "Tên tiếng Anh mặc định" ở danh mục (ba-spec 41 v6).
- v5 (2026-10-22): tab Báo cáo · `FileList` dọc thay chip · nhãn v5 (a–n) · Tên thương mại ở danh mục, form HĐ, hộp Nối mặt hàng (ba-spec 41 v5).
- v4 (2026-10-21): hướng dẫn thao tác — tour 21 bước + mốc `data-tour` + hộp "?" cho Xuất khẩu (ba-spec 43).
- v3 (2026-10-21): triage giao diện — tab điện thoại, cột thẳng hàng giữa bảng khách, thẻ số cùng khuôn, checklist cùng khuôn, bảng Hợp đồng gộp ngày ký vào hạn giao.
- v2 (2026-10-20): theo góp ý chủ dự án sau audit — tab "Lịch xuất hàng" + kỳ xem tháng / tuần / ngày, nhãn Đủ hồ sơ / Đã xuất đủ / Đã chốt HĐ, cột + hộp Nối mặt hàng, người ký chọn từ tài khoản BGĐ, khối tiền cọc cấp HĐ, Khôi phục chuyến, tiền 2 số lẻ.
- v1 (2026-10-20): khởi tạo khi chỉnh giao diện bản đầu cho trực quan — `progress.ts` (bước tiếp + còn thiếu, chỉ đọc lib), `StepBar` / `StepStepper` / `CollapsibleSection` ở `parts.tsx`, ShipmentPanel dạng checklist, hồ sơ 1 nút chính + menu, form 5 khối + tổng ở chân hộp.
