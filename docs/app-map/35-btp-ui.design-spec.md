> Load khi: thiết kế/build 3 màn module WIP — Sản xuất BTP, Kho dự trữ, Đơn đặt.
covers: src/features/production/WipProductionScreen.tsx, src/features/warehouse/ReserveWarehouseScreen.tsx, src/features/orders/SalesOrderScreen.tsx, src/features/orders/KiemLoXuat.tsx, src/features/production/wipHelpers.ts, src/features/production/BangDongSX.tsx, src/features/production/KhoiBotTam.tsx, src/features/production/KhoiBanNoiDia.tsx
last_verified: 2026-10-06
<!-- updated: 2026-10-06 — các `RecordTable` ở /wip · /warehouse · /orders bật prop `toMau` (nút 🪣 ở cột Thao tác / hàng nút thẻ). `BangDongSX` (bảng nhập tự dựng, dòng nháp) là ngoại lệ — xem README design-system § Tô màu dòng. -->
<!-- updated: 2026-10-06 (b) — UI BÁN NỘI ĐỊA ở /wip (mig 0054): `KhoiBanNoiDia` đặt NGAY DƯỚI bảng thành phẩm trong form ghi — khung viền, tiêu đề icon Store + câu "NL bán thẳng… không cộng vào sản lượng thành phẩm", nút "Thêm dòng bán nội địa" (viền đứt, full-width ở điện thoại). Mỗi dòng là một hàng flex-wrap (KHÔNG bảng rộng ⇒ điện thoại xếp dọc): Combobox Loại nguyên liệu (thêm mới + bút chì) · Số lượng kg · Đơn giá đ/kg · Combobox Khách (thêm mới + bút chì) · "= thành tiền" · nút × bỏ dòng. Dòng mới điền sẵn loại NL của dòng trước. Chân khối "Bán nội địa phiên này: X kg · Y đ". Sổ ngày: khối "Bán nội địa" dưới bảng thành phẩm + hộp "Sửa dòng bán nội địa". Đã thử preview (worktree, localStorage): lưu phiên chỉ có bán nội địa → toast "Đã lưu bán nội địa 987 kg", sổ hiện dòng; 360px + chữ 130% không cuộn ngang. -->
<!-- updated: 2026-10-06 — UI BỘT TẨM ở /wip (mig 0051): (1) bảng ghi BangDongSX: chọn mã tẩm bột ⇒ dòng con nền accent "Bột tẩm" (trải 5 cột) = `KhoiBotTam`: câu nhắc "bột là phụ gia — không cộng vào số lượng thành phẩm", mỗi loại bột đi kèm một NumberField kg có nhãn = tên bột (navCol `bot:<tên>` ⇒ ↑/↓ nhảy cùng loại bột giữa các dòng), Combobox "Thêm loại bột khác" (tạo mới tại chỗ + bút chì sửa), loại thêm tại chỗ có nút × bỏ; dòng "Tổng bột = X kg · y% so với thành phẩm". Mã chưa gắn bộ bột: câu hướng dẫn "lưu xong lần sau tự hiện". Khối GHIM TRÁI (`sticky left-2`) + `max-w-[calc(100vw-8.5rem)]`: bảng 840px vẫn cuộn trong khung nhưng ở điện thoại các ô bột xếp dọc trong vùng nhìn thấy (desktop: `sm:pl-10` thẳng cột Thành phẩm). (2) chân phiên: "Bột tẩm N kg" cạnh tổng phiên. (3) Sổ ngày: cột "Bột tẩm (kg)" (tổng + dòng phụ "24V 12 · 18V 30 · 220H 5", ẩn trên thẻ điện thoại) + khối "Bột tẩm đã dùng" (icon Wheat; bảng Loại bột · Số dòng TP · Tổng kg + dòng Tổng bột tẩm). (4) Dialog Sửa dòng: khung "Bột tẩm" cùng component. Đã thử preview demo: 1280 + 360px/130% không cuộn ngang trang, khối bột 360px nằm gọn khung; lưu/sửa ra đúng batterKg. -->
<!-- updated: 2026-10-02 (b) — UI truy xuất QR đợt 1b + 2a (../spec/qr-truy-xuat-lo.md §6b–6c): (1) /wip toast "Đã lưu N thành phẩm" có nút "In tem"/"In N tem" (in tem cả lượt vừa lưu); hộp CHỐT NGÀY có khối cảnh báo vàng "Chưa gắn lô — N mẻ…" + nút "Gắn lô NL" từng mẻ (đóng hộp chốt, mở hộp gắn lô) — chỉ nhắc, không chặn. (2) /warehouse khối "chờ nhập kho": hàng quét/gõ mã (nút "Quét tem để duyệt" · ô "Hoặc gõ mã lô trên tem" · "Tìm lô"; điện thoại xếp dọc full-width) ⇒ mở thẳng dialog Duyệt; mỗi dòng chờ đứng đầu bằng mã lô BĐ-… (tnum, đậm). (3) /orders chi tiết đơn: mục "Lệnh xuất đã lập" (ngày · kg · số lô) + nút "Kiểm lô bằng quét" ⇒ dialog KiemLoXuat: quét/gõ, danh sách lô của lệnh với nhãn "Đã quét"/"Chưa quét", đếm "Đã kiểm a / b lô" + nhãn "Đủ lô"; sai lô ⇒ toast lỗi đỏ. Camera mặc định TẮT (bấm mới xin quyền). Đã thử preview: 800px; dialog kiểm lô thử bằng dữ liệu giả (DB chưa có lệnh xuất). -->
<!-- updated: 2026-10-02 — SỬA NHANH THÀNH PHẨM tại /wip: cạnh ô chọn Thành phẩm (bảng BangDongSX + dialog Sửa dòng) có nút bút chì (chỉ hiện khi đã chọn) + bút chì trên TỪNG MỤC trong danh sách (`Combobox.onSuaMuc` — sửa được cả mục chưa chọn; bấm tên vẫn là chọn) cùng mở hộp sửa danh mục chung (`useSuaDanhMuc("matHang")`, xem 32-danh-muc — thay `SuaThanhPhamNhanh` cũ; khách hàng + loại NL còn dở cũng có bút chì, tên khoá vì nối theo tên) — sửa BẢN GHI MẶT HÀNG (tên · mã số · loài · kiểu chế biến · tách râu/bao tử · quy cách block · ÁNH XẠ mã TK 1551 — chỉ chọn, không sửa 141 mã). Dòng SX lưu productId nên đổi tên hiện đúng ở mọi dòng đã ghi; kiểm trùng tên (không phân hoa thường) + trùng mã số. Dòng đang gõ ăn theo cờ tách/quy cách mới (trừ dòng đã tự gõ quy cách khác). Không migration. -->
<!-- updated: 2026-09-21 — TÁCH FILE (P2-7 audit PO), KHÔNG đổi giao diện/logic: WipProductionScreen.tsx 1810→~1470 dòng. Rút `wipHelpers.ts` (DauPhien, DongSX, dongSXRong, laTach/tongDong/dongDayDu/dongTrong — có vitest) và `BangDongSX.tsx` (bảng dòng TP theo nhóm kiểu chế biến × khách, tách râu/bao tử, block × quy cách). KEY_WIP_* + docXuongNho (localStorage, pref theo máy) vẫn ở màn chính. -->

ttl_days: 90
status: design-spec — ĐÃ BUILD v1 (còn thiếu: QA screenshot 3 viewport, một số AC tồn nâng cao)
<!-- updated: 2026-09-18 — màn Sản xuất BTP (/wip), chế độ "Sổ ngày & báo cáo": cột thao tác mỗi dòng thêm 2 nút ĐỨNG TRƯỚC Sửa/Bỏ — "Gắn lô NL" (tô đậm khi CHƯA gắn lô nào, đổi thành "Lô NL (n)" viền khi đã gắn — nhìn là biết mẻ nào còn thiếu nguồn) mở hộp GanLoDauVao (quét/gõ/chọn, kg tùy chọn), và "Tem" in tem QR lô BTP. Cụm nút đổi `flex` → `flex flex-wrap` để không tràn ở điện thoại. Không đổi luồng ghi inline. Kiểm 360px + chữ 130%: không cuộn ngang. Thiết kế: ../spec/qr-truy-xuat-lo.md. -->
<!-- re-verified: 2026-09-07 — màn Sản xuất BTP ghi INLINE form-first (không dialog),
     nhập bảng nhóm (chế biến × khách) + chốt ngày SX + ghi bù + báo cáo TP ngày;
     đã đối chiếu WipProductionScreen.tsx trước khi tối ưu thao tác. -->

> **Cập nhật 2026-09-07 (tối ưu thao tác ghi TP ngày — màn Sản xuất BTP `/wip`):**
> ghi nay là **form-first INLINE** (không phải dialog "Ghi sản lượng" như bản
> thiết kế gốc). Bốn tối ưu giảm thao tác, GIỮ nguyên dữ liệu lưu:
> - **Nhóm mở sẵn + dòng trống** ngay khi vào — gõ thành phẩm liền, bỏ bước "Thêm
>   nhóm" bắt buộc.
> - **Nhãn nhóm (kiểu chế biến × khách) sửa tại chỗ** ở đầu mỗi nhóm; nhóm có
>   `groupId` ổn định (chỉ state form, KHÔNG lưu DB) nên sửa nhãn không remount /
>   mất focus. Dữ liệu lưu vẫn là `processingType` + `customerName` trên từng dòng.
> - **Dòng trống tự hiện** sau mỗi dòng ĐỦ (có mã + kg) — kiểu bảng tính, hết bấm
>   "Thêm thành phẩm" từng dòng.
> - **Nhớ phân xưởng theo máy** (`bsf.wip-xuong.v1`) + phiếu mới **điền sẵn nhóm
>   gần nhất** — ngày/người đã tự động ⇒ lặp cùng ngày/xưởng/chế biến/khách = 0
>   thao tác chọn lại.

# DESIGN-SPEC — Module WIP (Sản xuất BTP · Kho dự trữ · Đơn đặt)

Oracle **giao diện** cho module WIP. Đọc cùng oracle **hành vi** [34-btp-san-xuat-kho.ba-spec.md](34-btp-san-xuat-kho.ba-spec.md) (user/flow/AC). Design này TIẾP NỐI ba-spec, không phân tích user lại. Tái dùng pattern đã có (ContextBar · RecordTable · KhoiKhung · Dialog + ghi bù · hút) để tổ trưởng/thủ kho **học một lần dùng khắp**. Luật UI: [src/design-system/README.md](../../src/design-system/README.md).

## Brief

- **Platform chính:** tablet ngang ở xưởng lạnh (tay ướt, kính lão). Desktop = phụ, mobile 390px = tra cứu.
- **Stack:** React 19 · Tailwind v4 · shadcn radix-nova. Features chỉ import `@/design-system`.
- **Chốt nghiệp vụ:** nhiều phòng đông (chiều `kho`) · xả đông FIFO gợi ý+ghi đè · Tổ trưởng SX ≠ Thủ kho.

## Thang người dùng (tiếp nối §User registry ba-spec)

| Loại user (owner) | Muốn thấy gì | Sản phẩm truyền tải gì | Thúc đẩy action tiếp theo |
|---|---|---|---|
| **Tổ trưởng SX** | hôm nay xưởng mình làm ra gì, đã chốt chưa | sản lượng ngày = gốc mọi con số; chưa chốt là chưa xong | ghi sản lượng → **chốt ngày** |
| **Thủ kho** | lô nào **chờ nhập**, tồn từng kho còn bao nhiêu | hàng chưa duyệt chưa tính tồn; tồn thật là của kho | **duyệt lô** vào tồn; xuất theo lệnh |
| **Phòng KH / PGĐ** | đơn nào **đủ**, đơn nào còn thiếu size gì | đơn = gom nhiều ngày; đủ mới xuất container | **xác nhận đủ → lệnh xuất** (được xuất một phần) |
| **Kế toán** (read-only) | tồn cuối kỳ, khớp gối đầu không | số để chốt, không sửa vận hành | mở Cân đối đối chiếu |

## Object model + Flows (tiếp nối §B4 ba-spec)

Đối tượng: **Dòng sản xuất** (ngày) → **Lô tồn** (mặt hàng×quy cách×lô×kho×trạng thái) → **Đơn đặt** (dòng cần) → **Lệnh xuất** (dòng thực xuất) → handoff **Phiếu bán** (đã có).
Flow chính (đường user đi): Tổ trưởng ghi+chốt SX → Thủ kho duyệt lô cuối ca (tồn +) → Phòng KH thấy khả dụng tăng, đơn đạt đủ → xác nhận đủ → Thủ kho xuất thực → Bán hàng ráp phiếu. Mỗi màn = 1 chặng, không ôm 2.

## IA — ngân sách điều hướng

App đang 5 mục nav. Thêm 3 → gom **nhóm** (sidebar ≤2 cấp; mobile bottom ≤5):

| Nhóm | Mục |
|---|---|
| Ghi ngày | Nhập hàng · **Sản xuất BTP** · Bán hàng |
| Kho & đơn | **Kho dự trữ** · **Đơn đặt** |
| Tổng hợp | Cân đối |
| Hệ thống | Danh mục · Người dùng (admin) |

Tablet/desktop: sidebar 4 nhóm collapse được. Mobile 390px: bottom tab 5 mục hay dùng nhất (Nhập hàng · Sản xuất BTP · Kho · Bán hàng · **Thêm** ⋯ mở phần còn lại) — KHÔNG nhồi 8 tab.

## Screen map

| # | Màn hình | Vào từ | User đến để làm gì | Step tiếp theo mong muốn | Primary action | Widget chính | Density |
|---|---|---|---|---|---|---|---|
| 1 | **Sản xuất BTP ngày** | nav "Sản xuất BTP" | ghi sản lượng BTP làm ra hôm nay + chốt | chốt ngày để khoá số | **Ghi sản lượng** | ContextBar ngày/xưởng · RecordTable dòng SX · nút Chốt ngày | vừa 44px |
| 1b | Ghi sản lượng (dialog) | nút Ghi sản lượng | nhập 1 dòng: mặt hàng·quy cách·kg·block·ngày SX | lưu → thấy dòng trong sổ | **Lưu dòng** | Dialog + Combobox/NumberField | — |
| 2 | **Kho dự trữ** | nav "Kho dự trữ" | duyệt lô chờ nhập + xem tồn từng kho | duyệt lô để tồn lên đúng | **Duyệt lô chờ nhập** | Khối "chờ nhập" (mời duyệt) · RecordTable tồn nhóm theo kho×mặt hàng×quy cách×lô | gọn 40px (tồn nhiều dòng) |
| 2b | Duyệt lô (dialog) | nút Duyệt | đối chiếu kg/block thực, chọn kho, ghi lệch | tồn cộng vào kho đã chọn | **Xác nhận nhập kho** | Dialog + NumberField + Combobox kho | — |
| 3 | **Đơn đặt & lệnh xuất** | nav "Đơn đặt" | xem đơn nào đủ, xác nhận đủ, ra lệnh xuất | ra lệnh xuất (toàn/một phần) | **Xác nhận đủ → lệnh xuất** | RecordTable đơn (badge đủ/đang gom) · chi tiết đơn: dòng cần vs khả dụng | vừa 44px |
| 2c | Quét tem duyệt (khối chờ nhập) | khối "chờ nhập kho" | cầm block nào quét block đó | dialog Duyệt đúng mẻ | **Quét tem để duyệt** | KhungQuetQr + ô gõ mã | — |
| 3c | Kiểm lô lệnh xuất (dialog) | "Kiểm lô bằng quét" ở mục Lệnh xuất đã lập | xếp container đúng lô FIFO | đủ lô ⇒ xếp xong | **Quét tem** | KhungQuetQr + danh sách lô của lệnh + nhãn Đã/Chưa quét | — |
| 3b | Xuất kho (dialog) | nút trên lệnh xuất | thủ kho nhập kg/block thực xuất theo lô | đóng lệnh → sang Bán hàng | **Đóng lệnh xuất** | Dialog + dòng thực xuất + cảnh báo lệch | — |

## Component (tra bảng chọn — README design-system)

- Dòng sản xuất / tồn / đơn: **RecordTable** (có `sapXep` + `timKiem`); thu 390px → thẻ.
- Ghi/duyệt/xuất: **Dialog** (form nhập lặp nhiều lần/ngày) + nhóm ô, `NumberField` (kg/block), `Combobox` (mặt hàng·khách·kho — tạo mới tại chỗ), `DateField` (ngày SX).
- Quy cách/size: `Combobox` chuỗi tự do (như Bán hàng).
- Ngày+xưởng đang thao tác: **ContextBar**.
- Khối "chờ nhập"/"đơn chưa đủ": **KhoiKhung** kiểu lời mời (như hút phế liệu) — KHÔNG coi rỗng khi còn dòng chờ.
- Chốt ngày SX + ghi bù: theo mẫu Nhập hàng (`laGhiBu` — bắt lý do khi ghi sau).
- Trạng thái lô/đơn: **Badge ≤2 từ** + icon (màu không là tín hiệu duy nhất): "Chờ nhập" · "Đã đông" · "Đủ" · "Đang gom".
- Xoá/bỏ: **ConfirmDelete** + Hoàn tác. Nút Lưu **không disabled** → thiếu thì `ErrorSummary`.

## Ma trận trạng thái (mỗi màn — thiếu là design một nửa)

| Màn hình | Chưa đăng nhập | Theo vai trò | Trống | Đang tải | Lỗi | Dữ liệu cực đoan |
|---|---|---|---|---|---|---|
| Sản xuất BTP | gate ở App | ai cũng xem; ghi/chốt = tổ trưởng+ | "Chưa ghi sản lượng hôm nay — bấm Ghi sản lượng" | skeleton hàng | `TrangThaiDuLieu` + thử lại | nhiều dòng → RecordTable cuộn dọc, không ngang |
| Kho dự trữ | gate ở App | xem chung; duyệt/xuất = thủ kho | "Chưa có tồn / không có lô chờ nhập" (vẫn hiện lời mời nếu có chờ) | skeleton | như trên | tồn hàng trăm lô → nhóm gập theo kho, tìm+lọc |
| Đơn đặt | gate ở App | xem chung; xác nhận/xuất = Phòng KH+thủ kho | "Chưa có đơn đặt — bấm Tạo đơn" | skeleton | như trên | đơn nhiều dòng size → cuộn trong thẻ đơn |

## Action → Expectation

| Hành động | Kỳ vọng thấy ngay |
|---|---|
| Ghi 1 dòng sản lượng | dòng hiện trong sổ ngày + tổng kg ngày cập nhật |
| Chốt ngày SX | badge "Đã chốt"; sửa sau bắt lý do ghi bù |
| Duyệt lô chờ nhập | lô rời danh sách "chờ nhập", tồn kho đã chọn +kg; lệch hiện rõ |
| Xác nhận đủ | đơn badge "Đủ"; nút "Lệnh xuất" bật |
| Đóng lệnh xuất | tồn giảm đúng kg thực; phiếu bán xuất hiện ở màn Bán hàng |
| Xoá dòng | biến mất + toast **Hoàn tác** |
| Lưu mẻ SX | toast có nút **In tem** — bấm ra bản in tem cả lượt |
| Quét tem ở khối chờ nhập kho | mở dialog Duyệt đúng mẻ; mẻ đã nhập ⇒ toast cảnh báo |
| Quét tem khi kiểm lệnh xuất | đúng lô ⇒ dòng sang "Đã quét" + toast xanh; sai lô ⇒ toast đỏ "KHÔNG thuộc lệnh" |

## Platform (3 design con)

- **Tablet ngang (chính):** sidebar 4 nhóm; bảng đủ cột; dialog rộng `sm:max-w-2xl`. Vùng chạm ≥44px, hành động chính 56px.
- **Desktop:** như tablet, tận dụng bề rộng (`--app-content-width`), tồn xem nhiều cột hơn.
- **Mobile 390px:** bottom tab 5 + "Thêm"; RecordTable → thẻ (không cuộn ngang); dialog full-screen sheet. Cỡ chữ 130% + mật độ Gọn không vỡ.

## QA loop (chạy khi build — bước 6)

Sau khi code: preview → screenshot mỗi màn ở **3 viewport** (tablet 1024 · desktop 1280 · mobile 390) + bật **cỡ chữ 130% / mật độ Gọn**. Check: 1 primary/màn · badge ≤2 từ · touch ≥44px · dropdown thấy thanh cuộn · không `text-xs`/uppercase trong features · tồn nhiều lô không vỡ. Lỗi → sửa → chụp lại. *(Bằng chứng screenshot bổ sung khi build, chưa có ở pha design.)*

## History
- 2026-10-02 — truy xuất QR: in tem ngay sau lưu (/wip), nhắc gắn lô trong hộp chốt ngày, quét tem duyệt nhập kho (/warehouse), kiểm lô lệnh xuất bằng quét (/orders, `KiemLoXuat.tsx`). Không đổi logic FIFO/trừ tồn.
- 2026-09-07 — tối ưu thao tác ghi TP ngày (`/wip`): form-first inline · nhóm mở sẵn + dòng trống tự hiện · nhãn nhóm sửa tại chỗ (groupId ổn định) · nhớ phân xưởng theo máy + điền sẵn nhóm gần nhất. GIỮ schema/repo. Kèm fix scroll thanh bên/drawer không tràn (`overscroll-contain` ở `scroll-nice`). Đã verify preview: build xanh · 360px+130% không cuộn ngang · auto-row · lưu/điền lại nhóm.
- 2026-08-07 — design-spec từ ba-spec 34 (ui-design-logic). Chưa code. Bước tiếp: build (bảng+migration+3 màn) → QA screenshot loop.
