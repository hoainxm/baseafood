# 49 — design-spec: Phòng Kế hoạch · Lệnh sản xuất — giao diện đợt 1

> Load khi: chỉnh giao diện Lệnh sản xuất `/planning-production` (danh sách lệnh, hồ sơ lệnh, hộp lập / sửa / phát hành / hủy, NL nhập khẩu dự kiến, bản in QTI-KH-01-04, phần nơi nhận) hoặc chỗ lệnh hiện ở Xuất khẩu (dòng hàng HĐ, bước 2 của chuyến).
covers: src/features/production-orders/**, src/features/export-planning/ShipmentPanel.tsx, src/features/export-planning/ContractDossier.tsx
last_verified: 2026-10-30
<!-- updated: 2026-10-30 (báo cáo) — đầu trang có Tabs **Lệnh · Báo cáo** (`?view=reports&report=<kỳ>`, ba-spec [50](50-planning-reports.ba-spec.md) RP2): `ReportPeriodBar` + lọc Khách hàng + Xuất Excel (ai xem được lệnh đều xuất được — không có giá); 4 thẻ (lệnh · kg ra lệnh · NL nhập khẩu đã dành · cần chú ý); bảng Theo tháng · Theo khách · Theo mặt hàng · NL nhập khẩu đã dành (thẻ "vượt") · Lệnh cần chú ý. -->
<!-- updated: 2026-10-30 (lọc) — bỏ bộ lọc trạng thái 5 lựa chọn; thay bằng nút Xem / Ẩn lệnh đã hủy (chủ dự án: "5 cái đang hơi nhiều và thừa thãi"). -->
<!-- updated: 2026-10-30 — ĐÃ BUILD theo file này (P3). Lệch so với bản viết: không có tab; nơi nhận dùng cùng trang (không cột HĐ, không lọc trạng thái); chọn chuyến ở hộp Phát hành / Gắn chuyến bằng ô tick; Nafi chọn nhiều bằng nút bật / tắt; bản in qua `PrintSheet landscape={false}`. Chỗ hiện ở Xuất khẩu làm ở P4 (2026-10-30): khối `ShipmentOrders` trong bước 2, cột "Đã ra lệnh (kg)" (dòng phụ "còn x" / "vượt dung sai") — xem 42. -->
ttl_days: 90

> **Oracle hành vi:** ba-spec [48](48-production-order.ba-spec.md) v1 (Q1–Q10 đã chốt). **Khuôn chung:** đi theo Xuất khẩu [42](42-export-planning-ui.design-spec.md) và Nhập khẩu [46](46-import-planning-ui.design-spec.md): tab đầu trang, thẻ số, `RecordTable`, `FormDialog` + `useDialogDraft` + `ErrorSummary`, ô danh mục, nhãn luôn hiện. File này chỉ ghi chỗ khác.

## Thang người dùng

| Loại | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| Nhân viên Kế hoạch (desktop) | Dòng hàng HĐ nào **chưa ra lệnh đủ**, lệnh nào còn nháp, lệnh nào theo bản HĐ cũ | Cột "Đã ra lệnh / HĐ" + thẻ trạng thái lệnh + cờ "Theo bản HĐ trước" | Lập lệnh · Phát hành · Sửa theo bản mới |
| Quản đốc (máy xưởng, điện thoại) | Lệnh nào **sắp sản xuất**, làm gì, bao nhiêu thùng, ngày nào, đai màu gì | Danh sách lệnh đã phát hành xếp theo ngày SX đầu tiên, thẻ "Đã sửa lần n" | Mở lệnh · In |
| Thủ kho (máy kho, điện thoại) | Lệnh sắp chạy dùng **NL lần nhập nào**, bao bì có sẵn chưa | Như quản đốc + khối NL dự kiến (lần nhập, kg) | Chuẩn bị NL, bao bì (ngoài app) |
| BGĐ / Kế toán (xem) | Lệnh của HĐ nào, đã gắn chuyến nào | Như Nhân viên KH, không nút ghi | Tra số lệnh / MSL |

Trọng số (Nhân viên KH): **3** = trạng thái lệnh + còn chưa ra lệnh của dòng HĐ · **2** = ngày SX, ngày giao, MSL, chuyến gắn · **1** = NL dự kiến, HSD, yêu cầu bao bì · **0–1** = Nafi, ghi chú.

## Screen map

| Màn | Vào từ | Đến để làm gì | Primary |
|---|---|---|---|
| Lệnh sản xuất · danh sách (mặc định) | nav "Kế hoạch → Lệnh sản xuất", `?month=YYYY-MM` (tháng theo ngày SX đầu tiên) | xem lệnh của tháng, lệnh nháp, cờ cũ | Lập lệnh sản xuất |
| Hồ sơ lệnh | Mở ở bảng, `?order=<id>` | xem / sửa / phát hành / in / hủy | **Việc tiếp**: Phát hành (nháp) · Gắn chuyến (đã phát hành, chưa gắn) · Sửa theo bản mới (có cờ) |
| Bản in | "In lệnh" ở hồ sơ, `?order=<id>&print=1` | in A4 đúng mẫu QTI-KH-01-04 | — |
| Xuất khẩu · hồ sơ HĐ | khối Dòng hàng có cột mới "Đã ra lệnh" | thấy dòng nào còn thiếu lệnh | "Lập lệnh sản xuất" (chọn sẵn HĐ) |
| Xuất khẩu · bước 2 của chuyến | hàng "Lệnh sản xuất" | thấy lệnh đã gắn | "Gắn lệnh" / "Lập lệnh sản xuất" (chọn sẵn HĐ + chuyến) |

Một trang cho mọi vai trò: ai không có `production-orders:create` thì không thấy nút ghi và chỉ thấy lệnh **Đã phát hành** (R9, AC-11). Không làm trang riêng cho nơi nhận.

## Bố cục

**Đầu trang.** Mô tả 1 câu ("Lệnh sản xuất ra từ dòng hàng hợp đồng xuất, gửi Ban quản đốc phân xưởng và Thủ kho."). Bên phải: `outline` "Hướng dẫn thao tác" + nút chính "Lập lệnh sản xuất" (chỉ người có quyền ghi). Không có tab ở đợt này.

**Danh sách.**
- Thanh lọc: ‹ tháng › + "Nay" · Khách (lọc) · ô "Tra số lệnh" (số lệnh / MSL / số HĐ / tên hàng, tra mọi tháng, kết quả gồm cả lệnh đã hủy). **Không có bộ lọc trạng thái** (bỏ 2026-10-30 — 5 lựa chọn cho 3 trạng thái là thừa: Nháp / Đã phát hành đã có ở thẻ số + cột Trạng thái sắp được). Lệnh đã hủy mặc định ẩn; tháng có lệnh hủy thì hiện nút `ghost` "Xem n lệnh đã hủy" / "Ẩn lệnh đã hủy" ngay trên bảng.
- 3 `StatCard`: Lệnh của tháng · Đã phát hành · Cần xử lý. Dòng phụ bắt buộc: "nháp x · theo bản HĐ trước y · chưa gắn chuyến z".
- `RecordTable` (`rowMarkKey`, sắp cột): Số lệnh · Ngày lệnh · Khách · HĐ · Mặt hàng (dòng đầu + "+n dòng") · Thùng · Kg · MSL · Ngày SX · Ngày giao · Chuyến (số cont / "Chưa gắn") · Trạng thái (thẻ + cờ) · Mở.
- Trạng thái và cờ khai `sortValue` + `sortKind`.
- Nơi nhận không thấy cột HĐ.

**Hồ sơ lệnh.**
- **Đầu:** Quay lại · "Lệnh sản xuất <số>" · thẻ trạng thái · thẻ "Đã sửa lần n" (n ≥ 1) · cờ vàng "Theo bản HĐ trước" (bấm ⇒ cuộn tới lời giải thích) · nút chính việc tiếp · "In lệnh" (`outline`) · "Thao tác khác ▾" (Sửa · Gắn chuyến · Giữ nguyên theo bản cũ · Hủy).
- **Ô tóm tắt** (lưới nhãn – giá trị như 42): Khách / thị trường · HĐ (link sang hồ sơ HĐ xuất) · Ngày lệnh · MSL · Ngày SX (chip từng ngày) · Ngày giao · HSD (dòng phụ "24 tháng từ 11/2026") · Bao bì · Người phát hành + giờ.
- **Khối Dòng hàng:** `RecordTable` gồm STT · Tên hàng (tiếng Việt, dòng phụ tên HĐ tiếng Anh) · Quy cách · Thùng · Kg · NL dự kiến (tóm tắt "HĐ nhập X · 12.000 kg") · dòng Tổng. Cảnh báo vàng ngay dưới dòng khi dòng HĐ vượt dung sai (R4).
- **Khối NL nhập khẩu dự kiến:** mỗi dòng lệnh một nhóm: lần nhập (HĐ nhập · đối tác · ngày về · cont) · kg dự kiến · "đã dành x / thực nhập y kg". Cảnh báo vàng "dành vượt z kg" (R5, không chặn).
- **Khối Chuyến xuất:** các chuyến gắn kèm (tháng · loại cont · số cont · ETD · MSL chuyến) + thẻ "Lệch MSL" nếu khác (AC-9). Nút "Gắn chuyến".
- **Khối Yêu cầu:** bao bì (thùng · đai · bao PE · ghi trên thùng / PE), kiểm Nafi, lưu ý. Chỉ hiện ô có chữ.
- **Cuối hồ sơ:** Nhật ký (lần sửa, lý do, trước / sau).

**Hộp.** Mọi hộp ghi là `FormDialog` + `useDialogDraft` + `ErrorSummary`, nút Lưu không `disabled`.
- **Lệnh sản xuất** (cỡ lg, dùng cho lập và sửa):
  - Khối 1 *Lệnh*: Hợp đồng xuất (`Combobox`, chỉ HĐ có bản hiệu lực, chưa đóng / hủy; mở từ Xuất khẩu thì chọn sẵn, khóa) · Số lệnh (gợi ý số kế tiếp ở dòng phụ, R3 / A4) · Ngày lệnh · MSL · Ngày SX (chọn nhiều ngày, hiện chip) · Ngày giao · HSD (tháng, mặc định 24) — dòng phụ "HSD 01/11/2028".
  - Khối 2 *Dòng hàng*: mỗi dòng gồm Dòng hàng HĐ (`Combobox` chỉ dòng của bản hiệu lực; dòng chưa nối mặt hàng hiện mờ, chú "Nối mặt hàng ở hồ sơ HĐ trước") · Thùng (hoặc Kiện, theo dòng HĐ; ô số ≥ 44px) · Kg (tự tính, sửa được khi dòng HĐ thiếu kg tịnh/thùng) · dòng phụ "HĐ 38.880 kg · đã ra lệnh khác 21.600 · còn 17.280" · 🗑. Có "Thêm dòng".
  - Khối 3 *Yêu cầu bao bì · Nafi · lưu ý* (gập, mở sẵn khi có chữ): vài ô hay dùng (Thùng: số lớp · Đai: ghi chú màu · Bao PE · Ghi trên thùng: mã lô / NSX / HSD — `ChoiceGroup` Có / Không + Cách ghi) · Nafi (chọn nhiều: Vi sinh · Kháng sinh · Kim loại nặng · Histamine · Khác + chữ) · Bao bì (`ChoiceGroup` Đã có sẵn / Chưa có) · Lưu ý. Đầu khối có link "Chép từ lệnh <số> (cùng khách + mặt hàng)" khi tìm thấy (Q10).
  - Sửa lệnh đã phát hành: thêm ô bắt buộc **Lý do sửa** ở cuối (R10, AC-13).
- **NL nhập khẩu dự kiến** (mở từ dòng lệnh): danh sách lần nhập có thực nhập. Lần nhập cùng loại NL lên đầu, có chú "Cùng loại NL". Mỗi hàng gồm HĐ nhập · đối tác · ngày về · dòng hàng nhập · thực nhập · đã dành · ô kg dự kiến · cảnh báo vượt ngay dưới.
- **Phát hành:** tóm tắt (số dòng, tổng thùng / kg, MSL, ngày SX, nơi nhận "Ban quản đốc phân xưởng · Thủ kho · Phòng Kỹ thuật (bản in)") + chọn chuyến gắn kèm (ô chọn nhiều các chuyến mở của HĐ, ghi tháng · loại · số cont) + nút `save` "Phát hành". Toast `notify.saved` "Đã phát hành lệnh 19.10". Chuyến chưa có MSL ⇒ dòng phụ "MSL 205 sẽ ghi vào chuyến".
- **Gắn chuyến:** như phần chọn chuyến của Phát hành.
- **Giữ nguyên theo bản cũ:** Lý do (bắt buộc) + nút `default` "Giữ nguyên".
- **Hủy lệnh:** Lý do (bắt buộc) + tóm tắt hệ quả ("Bước 2 của 2 chuyến sẽ về chưa xong · nhả 12.000 kg NL dự kiến"). Xác nhận `destructive` + toast Hoàn tác. Không xóa cứng.

**Bản in QTI-KH-01-04.** Dùng `PrintSheet`, A4 dọc, 1 trang:
- Đầu: "CÔNG TY BASEAFOOD 1" · "LỆNH SẢN XUẤT" · Số · ngày bằng chữ "Ngày 27 Tháng 10 Năm 2026" · "Kính gởi: BQĐ phân xưởng, Phòng Kỹ thuật, Phòng Kế hoạch".
- Bảng: STT · Tên hàng (tên + yêu cầu NL) · Quy cách · Số lượng thùng · Số lượng (kg) · Mã số lô · Ngày SX · dòng Tổng.
- Khối dưới theo đúng thứ tự mẫu: Dự kiến có bao bì · Ngày giao hàng · Xuất vào thị trường · Ngày hết hạn · Quy trình SX · Yêu cầu bao bì · Yêu cầu kiểm Nafi · Các lưu ý khác.
- Chân: mã "QTI-KH-01-04".
- Không in giá. In từ chế độ in của trình duyệt, không toast.

**Ở Xuất khẩu.**
- Bước 2 của chuyến: hàng "Lệnh sản xuất" liệt kê lệnh đã gắn (số · trạng thái · link). Không có lệnh thì giữ hàng file như cũ (R6 / Q6 = A). Nút `default` "Lập lệnh sản xuất" + `outline` "Gắn lệnh có sẵn" (người có `production-orders:create`).
- Hồ sơ HĐ, khối Dòng hàng: cột "Đã ra lệnh" (kg, dòng phụ "còn x kg"; vượt dung sai ⇒ chữ cảnh báo).

## Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Không quyền | Cực đoan |
|---|---|---|---|---|---|
| Danh sách | `TableSkeleton` | `EmptyState`: "Chưa có lệnh tháng này. Lập lệnh từ dòng hàng hợp đồng xuất." (nơi nhận: "Chưa có lệnh nào được phát hành tháng này.") | lỗi đồng bộ như 42 | không `view` ⇒ "Chưa được cấp quyền" | 30 lệnh / tháng: bảng phân trang như 42 |
| Hồ sơ | skeleton | lệnh không còn ⇒ `EmptyState` + Quay lại | như trên | nơi nhận mở lệnh nháp ⇒ `EmptyState` "Lệnh chưa phát hành" | 8 dòng × 3 lần nhập: khối NL gập theo dòng |
| Chưa chạy migration | — | — | dải cảnh báo "Máy chủ chưa có bảng Lệnh sản xuất (chưa chạy 0088)" | — | Xuất khẩu vẫn chạy như cũ |
| Không nối máy chủ | — | — | dải cảnh báo | — | vẫn ghi, vào hàng chờ như mọi bảng |

## Platform

- 360 px: bảng danh sách thành thẻ (số lệnh · khách · mặt hàng · thùng / kg · ngày SX · trạng thái); hộp toàn màn; dòng hàng của hộp xếp dọc; 130 % không tràn.
- Quản đốc / thủ kho thường mở trên điện thoại ⇒ hồ sơ lệnh đọc một cột, ngày SX và đai màu lên đầu.
- Desktop 1366 px có thanh bên: bảng không cuộn ngang toàn trang.

## QA

Thử trên preview demo:
1. Lập lại LSX 19.10 (1.000 thùng ⇒ 12.000 kg, NSX 02–04/11, HSD 01/11/2028).
2. Gắn NL dành vượt ⇒ cảnh báo, vẫn lưu.
3. Phát hành, gắn 2 chuyến ⇒ bước 2 của cả hai chuyến Xong, MSL chép sang.
4. Ghi bản sửa HĐ ⇒ cờ "Theo bản HĐ trước" ⇒ Giữ nguyên có lý do ⇒ hết cờ.
5. Hủy ⇒ bước 2 của chuyến tính lại.
6. In ⇒ vừa 1 trang A4.
7. Đăng nhập quản đốc ⇒ chỉ thấy lệnh đã phát hành, không giá.
8. Kiểm ở 360 px × 130 % và 1366 px. Tour đi hết.

## History

- 2026-10-29 — v1 theo ba-spec 48 v1 (Q1–Q10 chốt theo đề xuất).
