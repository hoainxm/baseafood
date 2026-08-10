# Baseafood Senior Kit — luật dùng

Bộ giao diện cho hệ thống MES Baseafood. Người dùng chính là tổ trưởng / thủ kho
45–60 tuổi, thao tác trên tablet ở xưởng lạnh, tay ướt, đeo kính lão.

Nền: **shadcn/ui (style `radix-nova`) + Tailwind v4 + React 19**.
Sách luật tiếp cận: **WCAG 2.2 AA** + **GOV.UK Design System**.

## Ba tầng

```
src/design-system/tokens.css   ← cỡ chữ, màu, chiều cao ô. NƠI DUY NHẤT.
src/components/ui/*            ← primitive shadcn, ĐÃ đè size cho người lớn tuổi
src/design-system/patterns/*   ← pattern nghiệp vụ (Field, Combobox, RecordTable…)
src/features/*                 ← màn nghiệp vụ
```

## Luật bắt buộc

1. **Màn nghiệp vụ chỉ import từ `@/design-system`.**
   Cấm `import … from "@/components/ui/button"` trong `src/features/**`.
2. **Cấm viết class cỡ chữ / mã màu tay** trong màn nghiệp vụ
   (`text-sm`, `text-slate-400`, `bg-cyan-700`…). Muốn đổi → sửa `tokens.css`.
3. **Cấm `text-xs` và chữ IN HOA** cho nội dung. Nhỏ nhất là `text-sm` = 16px.
4. **Vùng chạm ≥ 44px**, mặc định 48px, hành động chính 56px.
5. **Không có nút chỉ-icon** trong màn nghiệp vụ. Icon luôn kèm chữ.
6. **Mọi ô nhập phải bọc `Field` / `NumberField` / `Combobox` / `DateField`.**
   Nhãn luôn hiện. Placeholder không bao giờ thay nhãn.
7. **Nút Lưu không bao giờ `disabled`.** Thiếu dữ liệu thì bấm ra `ErrorSummary`.
8. **Mọi thao tác ghi dữ liệu phải bắn `notify`**, xóa phải qua `ConfirmDelete`
   và có nút Hoàn tác.
9. **Màu không bao giờ là tín hiệu duy nhất.** Luôn kèm icon hoặc chữ.
10. **Danh mục thay nhập tự do.** Đại lý / loại NL / mặt hàng / khách hàng đều
    chọn qua `Combobox` (có tạo mới tại chỗ), không gõ tay.
11. **Mọi dropdown phải cuộn được và THẤY thanh cuộn.** Luật đặt ở tầng
    primitive, không lặp ở chỗ gọi: `PopoverContent` giới hạn
    `max-h-(--radix-popover-content-available-height)`, `CommandList` /
    `SelectContent` cuộn với `scrollbar-width: auto`. **Cấm** dùng lại class
    `no-scrollbar` của shadcn cho danh sách chọn — nó ẩn thanh cuộn nên người
    dùng tưởng danh sách đã hết.
12. **Đơn vị trong ô nhập không dùng padding cố định.** `Field` đo bề rộng chữ
    đơn vị rồi chừa đúng chỗ — `pr-14` cứng làm "26.000" đè lên "đ/USD".
13. **Mọi chữ hiển thị theo chuẩn label.** Sentence case; nhãn field = danh từ
    trần (không "Chỉ xem…", không "… dòng", không `:`); nút = động từ đứng đầu.
    Chi tiết + before→after: [`noi-dung-va-label.md`](noi-dung-va-label.md).

**Ngoại lệ luật (bản in theo mẫu giấy):** `src/features/BangCanDoi.tsx` và
`src/features/PhieuNLNgay.tsx` cố tình dùng chữ nhỏ, chữ hoa, màu slate cứng để
khớp khổ A4. Đừng áp luật cỡ chữ / màu / sentence case vào hai file đó, và cũng
đừng lấy chúng làm mẫu cho màn mới.

## Bảng chọn component

| Tình huống | Dùng |
|---|---|
| Ô chữ | `Field` + `Input` |
| Ô số (kg, tiền, %) | `NumberField` |
| Chọn 1 trong ≤ 6 | `ChoiceGroup` (nút to) |
| Chọn 1 trong danh mục dài / cần tạo mới | `Combobox` |
| Chọn ngày | `DateField` |
| Chọn khoảng ngày | `DateRangeField` (hai ô riêng Từ / Đến) |
| Danh sách bản ghi | `RecordTable` — truyền `sapXep` cho cột để bấm tiêu đề sắp xếp, truyền `timKiem` để hiện ô tìm |
| Danh mục có Thêm/Sửa/Xóa/Tìm | `DanhMucCrud` |
| Xóa bất kỳ thứ gì | `ConfirmDelete` |
| Form > 5 ô, nhập không thường xuyên | `StepForm` |
| Form > 5 ô, nhập lặp nhiều lần/ngày | `Dialog` + nhóm ô, phần phụ gập lại |
| Báo lỗi cả form | `ErrorSummary` (đầu form, có link nhảy tới ô) |
| Cho biết đang làm cho ngày/xưởng nào | `ContextBar` |
| Danh sách rỗng | `EmptyState` (phải nói việc tiếp theo) |
| Câu diễn giải dài cạnh nhãn | `InfoTip` (nút ⓘ + popover). `DateField` **và** `Combobox` có sẵn prop `info` — dùng thay `hint` khi câu dài khiến hai ô cùng hàng lệch chiều cao. Nhãn tiêu đề vẫn luôn hiện. |
| Bảng tổng hợp cho trang Báo cáo | `BangTong` — cột số căn phải `tnum`, hàng TỔNG CỘNG ở chân tự cộng theo `tong` từng cột. Component cha lo gom nhóm; `BangTong` chỉ hiển thị. |
| **Dialog/form thông tin hay thao tác** | `FormDialog` — khung CHUẨN: đầu cố định (icon + tiêu đề + mô tả) · thân cuộn `scroll-nice` · chân cố định chứa nút. `rong`: sm/vua/rong/xl. Điều khiển bằng `open`/`onOpenChange` hoặc `trigger`. Nút đóng tiện dụng: `NutDong`. |
| Các con số bối cảnh/tổng | `ThongKe` (lưới thẻ KPI: nhãn nhỏ + số TO + icon màu) — sinh động hơn nhồi một dòng. `ContextBar` chỉ dùng cho thanh dính "đang xem ngày/xưởng nào" trong màn nhập liệu. |
| Biểu đồ trong Báo cáo | `BieuDoCot` — thanh NGANG + đường trung bình nét đứt, một màu thương hiệu, thuần HTML + token (ăn theo cỡ chữ). KHÔNG thêm thư viện chart. |

## Nút toàn cục trên header (AppLayout)

Gom mọi thứ toàn cục thành **nút icon 44px** ở góc phải header, luôn hiện kể cả điện thoại:

| Component | Vai trò |
|---|---|
| `NutGiaoDien` | Icon 🎨 → `FormDialog` chứa `CaiDatHienThi`. Nhận `taiKhoan` để **lưu theo người dùng**. Có **draft**: xem trước live, **Lưu** mới giữ, **Hủy**/đóng khôi phục ảnh chụp (`docCaiDatHienThi`/`ghiCaiDatHienThi`). |
| `NutTrangThai` | Icon theo màu store `ketNoi`. Popover chi tiết + nút **Thử kết nối lại** (`probeKetNoi`). |
| `NutHuongDan` | Icon "?" → hộp hướng dẫn của trang. Nội dung lấy từ `features/shared/huongDan.tsx`, chỉ hiện ở trang có trong registry. |

## Trang duyệt + cấu hình

`Bộ giao diện` (`src/design-system/kit/KitPage.tsx`) — trang demo component, vào
bằng URL `/kit` (đã gỡ khỏi sidebar), desktop-only.

**Cài đặt hiển thị** (`patterns/CaiDatHienThi.tsx`) giờ mở từ nút `NutGiaoDien`
trên header. Áp ngay và **nhớ theo từng tài khoản**:

| Cấu hình | Cách áp | Giá trị |
|---|---|---|
| Cỡ chữ | `--app-font-scale` trên `<html>` | 100 / 110 / 120 / 130 % |
| Mật độ | `data-density` trên `<html>` | thoáng 48px · vừa 44px · gọn 40px |
| Bề rộng nội dung | `--app-content-width` | 64rem / 80rem / 100% |

Khóa localStorage theo username: `bsf.<username>.<coChu|matDo|beRong>`; chưa đăng
nhập ⇒ bucket mặc định `bsf.coChu` (tương thích ngược). Đổi tài khoản →
`AppLayout` gọi `apDungCaiDatHienThi(username)` nạp lại. (`CoChuNhanh` — nút cỡ
chữ nhanh cũ — vẫn còn trong file nhưng không còn gắn trên header.)

> Hai thanh header (thanh bên và thanh nội dung) dùng chung hằng `CAO_HEADER`
> trong `AppLayout.tsx`. Đổi chiều cao thì đổi ở đó, đừng đặt riêng từng bên —
> lệch một bên là cả trang trông vênh.

## Thêm component shadcn mới

CLI `npx shadcn add` có thể lỗi `EPERM: scandir …` trên Windows: CLI quét
ngược lên thư mục cha và đụng junction tương thích cũ bị khóa quyền
(`My Documents`, `Local Settings`…). Cách thay thế:

1. Tải trực tiếp từ registry:
   `https://ui.shadcn.com/r/styles/radix-nova/<tên>.json`, ghi `files[].content`
   vào `src/components/ui/`.
2. Sửa import: `@/registry/radix-nova/lib/utils` → `@/lib/utils`,
   `@/registry/radix-nova/ui/x` → `@/components/ui/x`,
   `@/app/(create)/components/icon-placeholder` → `@/components/ui/icon-placeholder`.
3. Thêm icon mới dùng đến vào `src/components/ui/icon-placeholder.tsx`.
4. **Đè size ngay**: mặc định shadcn là `h-8`/`h-9` + `text-sm` — nhỏ hơn cả bản
   cũ. Không đè là tái phát toàn bộ vấn đề tiếp cận.

## Kiểm tra trước khi giao

- [ ] Không còn `text-xs` / `uppercase` trong `src/features/**`
- [ ] Không còn `slate-400` / `slate-300` làm màu chữ
- [ ] Mọi nút bấm được ≥ 44×44px
- [ ] Tab được hết màn bằng bàn phím, focus ring luôn thấy
- [ ] Bật cỡ chữ `130%` + mật độ `Gọn` — bố cục không vỡ, không đè chữ
- [ ] Dropdown danh sách dài: cuộn được và THẤY thanh cuộn
- [ ] Thu màn còn 390px — bảng đã đổi sang thẻ, không cuộn ngang
