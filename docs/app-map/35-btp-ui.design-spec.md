> Load khi: thiết kế/build 3 màn module WIP — Sản xuất BTP, Kho dự trữ, Đơn đặt.
covers: (chưa có code — design-spec cho module WIP; khi build trỏ features/SanXuatBTP.tsx, features/KhoDuTru.tsx, features/DonDat.tsx)
last_verified: 2026-08-07
ttl_days: 90
status: design-spec (GIAO DIỆN — CHƯA code)

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

## Platform (3 design con)

- **Tablet ngang (chính):** sidebar 4 nhóm; bảng đủ cột; dialog rộng `sm:max-w-2xl`. Vùng chạm ≥44px, hành động chính 56px.
- **Desktop:** như tablet, tận dụng bề rộng (`--app-content-width`), tồn xem nhiều cột hơn.
- **Mobile 390px:** bottom tab 5 + "Thêm"; RecordTable → thẻ (không cuộn ngang); dialog full-screen sheet. Cỡ chữ 130% + mật độ Gọn không vỡ.

## QA loop (chạy khi build — bước 6)

Sau khi code: preview → screenshot mỗi màn ở **3 viewport** (tablet 1024 · desktop 1280 · mobile 390) + bật **cỡ chữ 130% / mật độ Gọn**. Check: 1 primary/màn · badge ≤2 từ · touch ≥44px · dropdown thấy thanh cuộn · không `text-xs`/uppercase trong features · tồn nhiều lô không vỡ. Lỗi → sửa → chụp lại. *(Bằng chứng screenshot bổ sung khi build, chưa có ở pha design.)*

## History
- 2026-08-07 — design-spec từ ba-spec 34 (ui-design-logic). Chưa code. Bước tiếp: build (bảng+migration+3 màn) → QA screenshot loop.
