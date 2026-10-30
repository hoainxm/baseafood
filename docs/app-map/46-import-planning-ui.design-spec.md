# 46 — design-spec: Phòng Kế hoạch · Nhập khẩu — giao diện đợt 1

> Load khi: chỉnh giao diện màn Nhập khẩu `/planning-import` (lô nhập theo tháng, danh sách hợp đồng nhập, hồ sơ HĐ, hộp lần nhập / chứng từ / thực nhập / đóng HĐ, phần thủ kho).
covers: src/features/import-planning/**
last_verified: 2026-10-30
<!-- updated: 2026-10-30 (báo cáo) — tab thứ ba **Báo cáo** (`?view=reports&report=<kỳ>`, ba-spec [50](50-planning-reports.ba-spec.md) RP1): thanh `ReportPeriodBar` (Tháng / Quý / Năm, mặc định tháng hiện tại) + lọc Đối tác + `outline` Xuất Excel; 4 `StatCardGrid` (lần nhập · thực nhập · trị giá theo tiền tệ hoặc HĐ ký khi không có quyền giá · đủ hồ sơ); bảng Theo tháng (kỳ > 1 tháng) · Theo đối tác (+ HĐ còn chưa về) · Theo mặt hàng (+ đơn giá bình quân) · Theo loại hình · Lần nhập cần chú ý (Mở ⇒ hồ sơ HĐ tại lần nhập). Không toast. -->
<!-- updated: 2026-10-30 (form) — hộp Hợp đồng nhập: hai khối "1 Hợp đồng", "2 Dòng hàng" dùng `FormSection` chung (vòng số + dòng gợi ý), thay h3 trần "1 · Hợp đồng". -->
<!-- updated: 2026-10-30 (v4) — kiểm mẫu của kho (ba-spec 45 §0d): trong thẻ mỗi lần nhập, dưới Thực nhập, khối "Kiểm mẫu của kho (n mẫu)" — bảng đúng khuôn báo cáo (hàng = chỉ số, cột = mẫu, cột nhãn ghim trái, `HorizontalScroll`; chỉ hiện hàng có số), mỗi cột có Sửa (`edit`) / Xóa (`danger` → ConfirmDelete + Hoàn tác), dòng file báo cáo (xem trước). Nút `outline` "Nạp báo cáo kiểm mẫu". Hộp `FormDialog xl`: chọn file (Excel đọc; ảnh / PDF chỉ đính) → câu kết quả đọc → khung vàng liệt kê ô cần soát → Ngày báo cáo + (đã có mẫu) ChoiceGroup Thay / Giữ và thêm → lưới soát (mỗi cột: ô tick Lưu, tên nhà XK, Combobox Dòng hàng HĐ; ô số `NumberField` ẩn nhãn, điều hướng ↑/↓ theo hàng; ô đọc lỗi tô vàng) → "Thêm mẫu nhập tay". Nháp `useDialogDraft`. -->
<!-- updated: 2026-10-29 (v3) — dòng hàng nối mặt hàng (ba-spec 45 §0c): hộp HĐ mỗi dòng 2 cột Tên hàng (như trên hợp đồng) · `Combobox` "Mặt hàng (danh mục)" có Thêm mới + bút chì (`useQuickCatalogEdit("product")`), dòng phụ "Gợi ý … — kiểm lại" khi app điền sẵn; máy chủ chưa chạy 0084 ⇒ ô thay bằng chữ báo. Hồ sơ HĐ: bảng Dòng hàng thêm cột "Mặt hàng (danh mục)" (tên mặt hàng, chưa nối ⇒ `Tag` warning "Chưa nối"); hộp Ghi thực nhập + thẻ lần nhập hiện tên mặt hàng dưới tên hàng (`LineProductLabel` ở parts.tsx). Đóng HĐ còn dòng chưa nối ⇒ toast lỗi nêu tên dòng + "vào Sửa hợp đồng để nối". -->
ttl_days: 90

> **Oracle hành vi:** ba-spec [45](45-import-planning.ba-spec.md). **Khuôn chung:** đi theo Xuất khẩu [42](42-export-planning-ui.design-spec.md) (tab đầu trang, thẻ số, `FileList`, ô danh mục, nhãn luôn hiện) — file này chỉ ghi chỗ KHÁC. Luật UI: [`src/design-system/README.md`](../../src/design-system/README.md).

## Thang người dùng

| Loại | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| Nhân viên Kế hoạch (desktop) | Lô nào **còn thiếu giấy gì**, HĐ còn bao nhiêu kg chưa về | Thẻ trạng thái lô + "Còn thiếu: …"; ở HĐ "đã về x / y kg" | Mở lô → đính đúng chứng từ thiếu |
| Thủ kho (điện thoại / máy kho) | Lô nào đã về mà chưa ghi số | Danh sách lô của tháng, thẻ "Chưa ghi thực nhập" | Ghi thực nhập |
| BGĐ / Kế toán (xem) | Tờ khai + invoice của lô, HĐ đã về đủ chưa | Như nhân viên KH, không nút ghi | Tra số tờ khai |

Trọng số (nhân viên KH): **3** = trạng thái lô + chứng từ còn thiếu · **2** = ngày về, đã về / còn lại theo HĐ · **1** = số cont, B/L, loại hình · **0–1** = ghi chú, tiền.

## Screen map

| Màn | Vào từ | Đến để làm gì | Primary |
|---|---|---|---|
| Nhập khẩu · Lô nhập (mặc định) | nav "Kế hoạch → Nhập khẩu", `?month=YYYY-MM` | xem lô của tháng thiếu gì | Lập hợp đồng nhập |
| Nhập khẩu · Hợp đồng | tab, `?view=contracts` | tìm HĐ bất kỳ | Lập hợp đồng nhập |
| Hồ sơ HĐ nhập | Mở ở bảng, `?contract=<id>` (+ `&receipt=<id>` cuộn tới lô) | ghi lần nhập, chứng từ, thực nhập, đóng HĐ | **Việc tiếp**: Ghi lần nhập (HĐ mở) · Mở lại HĐ (`edit`, HĐ đã đóng) |
| Phần thủ kho | nav (chỉ quyền `import-plans.receiving`) | ghi thực nhập lô đã về | Ghi thực nhập (mỗi lô) |

## Bố cục

**Đầu trang.** Mô tả 1 câu ("Hợp đồng nhập, chứng từ từng lô hàng về và số lượng thực nhập. Khác Nhập hàng nguyên liệu trong nước.") + `Tabs` (Lô nhập · Hợp đồng) + `outline` "Hướng dẫn thao tác" + nút chính "Lập hợp đồng nhập". Điện thoại: tab chia đôi như 42.

**Lô nhập.** Thanh lọc: ‹ tháng › + "Nay" · Đối tác (lọc) · ô "Tra số chứng từ" (số HĐ / invoice / tờ khai / cont / B/L, tra mọi tháng — có chữ ⇒ bảng thay bằng kết quả tra). 3 `StatCard`: Lô nhập của tháng · Đủ hồ sơ · Còn thiếu (dòng phụ bắt buộc: "thiếu chứng từ x · chờ thực nhập y"). Thân: mỗi đối tác một `RecordTable` (`rowMarkKey="import-plan:<tháng>"`), cột: Ngày về (dòng phụ "dự kiến" khi chưa về) · Hợp đồng · Vận chuyển · Số cont · Kg thực nhập · Trạng thái (thẻ + dòng "Còn thiếu: Invoice, Tờ khai") · Mở (`ghost`). Trống ⇒ `EmptyState` "Tháng mm/yyyy chưa có lô nhập nào" + việc tiếp "Lập hợp đồng nhập, rồi Ghi lần nhập".

**Hợp đồng.** `RecordTable` cột: Số HĐ · Đối tác · Ngày ký · Loại hình · Đã về / HĐ (kg, dòng phụ tiền nếu có giá) · Lần nhập · Trạng thái · Mở. Lọc trạng thái (Đang mở · Đã đóng · Đã hủy · Tất cả), ô "Tra hợp đồng".

**Hồ sơ HĐ.** Đầu: Quay lại · "HĐ <số>" · thẻ trạng thái · nút chính việc tiếp + "Thao tác khác ▾" (Sửa hợp đồng · Đóng hợp đồng · Hủy · Xóa). Ô tóm tắt (lưới nhãn–giá trị như 42): Đối tác · Ngày ký · Loại hình · Tiền tệ · Tổng kg · Tổng tiền (ẩn khi không quyền giá / không dòng nào có giá) · Đã về. Khối **Dòng hàng**: Tên hàng · Kg HĐ · Đơn giá · Thành tiền · Đã về · Còn lại (âm ⇒ thẻ vàng "vượt x kg"). Khối **File hợp đồng** (`FileList` + Đính file). Khối **Các lần nhập**: mỗi lô một khung — đầu (ngày về / dự kiến · vận chuyển · cont · B/L · thẻ trạng thái · Sửa / Hủy / Xóa), rồi **Chứng từ** (mỗi mục một hàng checklist: tên · số · ngày · `FileList` · Cập nhật; mục "nếu có" thêm 🗑 `InlineConfirmDelete`; mục "Không áp dụng" ghi lý do) + "Thêm chứng từ", rồi **Thực nhập** (bảng tên hàng · kg lô này + nút "Ghi thực nhập"). HĐ đóng ⇒ dải "Đã đóng · Lý do: …".

**Hộp.** Mọi hộp ghi là `FormDialog` + `useDialogDraft` + `ErrorSummary`, nút Lưu không `disabled`.
- **Hợp đồng nhập** (cỡ lg): khối 1 Hợp đồng (Đối tác = `Combobox` danh mục **NCC nhập khẩu** (v2 — chỉ NCC Đang giao dịch) có Thêm mới + bút chì · Số HĐ · Ngày ký · Loại hình `ChoiceGroup` 3 lựa chọn · Tiền tệ · Ghi chú); khối 2 Dòng hàng (mỗi dòng: Tên hàng · Số lượng (kg) · Đơn giá · thành tiền chữ phụ · 🗑) + "Thêm dòng"; chân "n dòng · x kg · y USD".
- **Lần nhập**: Ngày về kho · Ngày dự kiến về (dòng phụ khối: "Chưa về thì ghi ngày dự kiến") · Vận chuyển `ChoiceGroup` · Số cont · Số B/L · Ghi chú.
- **Chứng từ**: Loại (mục bắt buộc: cố định; thêm mới: chọn trong C/O · Giấy kiểm dịch · B/L · Chứng từ khác + ô Tên) · Số · Ngày · Loại hình (chỉ tờ khai) · File (`FilePicker` nhiều file) · `ChoiceGroup` "Không áp dụng?" (mục bắt buộc) + Lý do.
- **Ghi thực nhập**: mỗi dòng hàng HĐ một hàng: tên · "HĐ x kg · đã về lô khác y kg" · ô kg (ô số ≥ 44px) · cảnh báo vàng "vượt HĐ z kg" ngay dưới (không chặn).
- **Đóng hợp đồng**: tóm tắt "Còn thiếu: <dòng> x kg" + Lý do (bắt khi còn thiếu); nút `lock` "Đóng hợp đồng".
- **Hủy** (HĐ / lô): Lý do; xóa qua `ConfirmDelete` + toast Hoàn tác.

**Phần thủ kho.** Một trang: ‹ tháng › + danh sách lô (thẻ trên điện thoại): HĐ · đối tác · ngày về · "Đã ghi thực nhập" / "Chưa ghi thực nhập" · nút "Ghi thực nhập". Không giá, không chứng từ.

**Danh mục NCC nhập khẩu (v2 — ba-spec 45 §0b).** Tab mới **"NCC nhập khẩu"** ở trang Danh mục, đứng ngay sau "Đại lý"; khuôn `CatalogCrudFor` như các tab khác (bảng `rowMarkKey`, hộp Thêm / Sửa gom nhóm: *Thông tin chung* (mã · tên gọi tắt · tên đầy đủ · quốc gia · địa chỉ · MST / số đăng ký · mặt hàng chính · cảng xếp thường dùng) · *Liên hệ* (người liên hệ · chức vụ · email · điện thoại · website) · *Ngân hàng thụ hưởng* (ngân hàng · số tài khoản · SWIFT · địa chỉ ngân hàng) · *Khác* (trạng thái Đang / Ngừng giao dịch · ghi chú)). Cột bảng: mã · tên gọi tắt · quốc gia · người liên hệ · trạng thái; còn lại ở Chi tiết. Nhóm nav **Kế hoạch**: Xuất khẩu · Nhập khẩu · **1 mục Tra cứu** → `catalog?tab=import-suppliers`. Form Đại lý bỏ ô Quốc gia.

## Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Không quyền | Cực đoan |
|---|---|---|---|---|---|
| Lô nhập | `TableSkeleton` | `EmptyState` nói việc tiếp | lỗi đồng bộ như 42 | không quyền ⇒ "Chưa được cấp quyền"; chỉ `.receiving` ⇒ phần thủ kho | 20 lô / tháng, 8 đối tác: bảng mỗi đối tác |
| Hồ sơ | skeleton | HĐ không còn ⇒ `EmptyState` | như trên | chỉ xem ⇒ ẩn nút ghi | 10 lần nhập: khung lô gập, lô thiếu mở sẵn |
| Không nối máy chủ | — | — | dải cảnh báo | — | ẩn nút tải file, mục chứng từ vẫn ghi số / ngày |

## Platform

360 px: tab chia đôi, bảng thành thẻ / cuộn ngang 2 thanh, hộp toàn màn; 130 % không tràn. Desktop 1366 px có thanh bên: bảng không cuộn ngang.

## QA

Thử preview demo: lập HĐ 2 dòng → ghi lần nhập → đính 3 chứng từ → ghi thực nhập vượt → đóng có lý do → mở lại; 360 px × 130 % + 1366 px; tour đi hết.

## History

- 2026-10-29 — v1 theo ba-spec 45 v1.1.
- 2026-10-29 tối — v2: tab Danh mục "NCC nhập khẩu", 1 mục Tra cứu ở nhóm Kế hoạch, ô đối tác đổi nguồn (ba-spec 45 §0b).
- 2026-10-30 — v4: khối Kiểm mẫu của kho trong lần nhập + hộp nạp báo cáo (ba-spec 45 §0d).
- 2026-10-29 khuya — v3: ô Mặt hàng (danh mục) ở dòng hàng, cột / nhãn "Chưa nối" ở hồ sơ, hộp thực nhập, thẻ lần nhập (ba-spec 45 §0c).
