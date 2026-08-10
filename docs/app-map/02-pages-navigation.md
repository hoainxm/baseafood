> Load khi: thêm/bớt màn hình, đổi điều hướng, header, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/features/shared/AppLayout.tsx, src/features/shared/NotFound.tsx, src/features/shared/huongDan.tsx
last_verified: 2026-08-10
ttl_days: 90
<!-- re-verified: 2026-08-10 14:00 — AppLayout header (NutGiaoDien/NutTrangThai/NutHuongDan) + thu/mở sidebar (KEY_THU_GON) + fix logo đè khớp source -->

# Trang & điều hướng

**Có định tuyến (Router).** Ứng dụng sử dụng `react-router-dom` v7 (`HashRouter` để tối ưu chạy offline tại xưởng). Đường dẫn + `NAV` dùng **id tiếng Anh** (`imports`, `sales`, `warehouse`…) — id của mục nav CHÍNH LÀ path (`to={/${id}}`), nên id phải khớp `Route path` trong `App.tsx`, nếu lệch thì menu bấm ra NotFound. Refresh (F5) giữ trạng thái, dùng Back/Forward, deep link như `#/balancing/:periodId`.

## Gate đăng nhập

`App.tsx` gọi `useAuth()` (`src/lib/auth.ts`) TRƯỚC khi khởi tạo Router. Nếu đang tải phiên $\rightarrow$ màn "Đang tải"; chưa có phiên đăng nhập $\rightarrow$ render `DangNhap.tsx` chặn toàn app. Chi tiết auth: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md).

## Header (AppLayout)

Bố cục web chức năng: **sidebar trái** (chỉ icon + nhãn, KHÔNG mô tả) · **header trên** · nội dung phải. Header phải gom mọi thứ toàn cục vào **cụm nút icon 44px, luôn hiện kể cả điện thoại**:

| Nút | Component (design-system) | Hành vi |
|---|---|---|
| Hướng dẫn "?" | `NutHuongDan` | Chỉ hiện ở trang có trong `huongDan.tsx` (registry route→nội dung). Mở hộp hướng dẫn dùng trang đó. |
| Tùy chỉnh giao diện 🎨 | `NutGiaoDien` | Mở `CaiDatHienThi` (cỡ chữ · mật độ · bề rộng). Lưu **theo username** (`taiKhoan` prop). |
| Trạng thái máy chủ | `NutTrangThai` | Màu theo store `ketNoi`. Hover/bấm mở popover chi tiết + **Thử kết nối lại** (`probeKetNoi`). |
| Tài khoản + Đăng xuất | (trong AppLayout) | Tên + vai trò (ẩn text < sm) và nút Đăng xuất, sát phải. |

Cỡ chữ / trạng thái kết nối **không còn ở chân sidebar** (đã dời hết lên header). Đổi tài khoản → `AppLayout` gọi `apDungCaiDatHienThi(username)` nạp lại giao diện của người vừa đăng nhập.

**Thu/mở sidebar** (chỉ desktop): nút `PanelLeft` bên trái header đổi `thuGon`, nhớ qua `localStorage["bsf.sidebarThu"]`. Thu ⇒ sidebar `w-20`, nav chỉ còn icon (nhãn vào `title`), logo icon-only (`hienChu={false}`). Mobile không thu (đã có bottom-tab), header mobile dùng **logo icon-only + tiêu đề màn** để chữ BASEAFOOD không bị cụm nút phải đè. Chuẩn form: `FormDialog` (design-system) — mọi dialog thông tin/thao tác đi qua khung này.

## Các màn & Cấu trúc Route

| Path | id NAV | Nhãn | File chính | Ghi chú |
|---|---|---|---|---|
| — | — | Đăng nhập | `features/auth/DangNhap.tsx` | Màn chặn đăng nhập toàn app (không có route, gate ở `App.tsx`) |
| `/imports` | `imports` | Nhập hàng | `features/imports/NhapHangTab.tsx` | Mặc định khi mở app. Bọc 2 tab: **Sổ** (`NhapNguyenLieu`) + **Báo cáo** (`BaoCaoNhap`) |
| `/production` | `production` | Sản xuất BTP | `features/production/SanXuatBTP.tsx` | Ghi sản lượng bán thành phẩm ngày (WIP) |
| `/sales` | `sales` | Bán hàng | `features/sales/BanHangTab.tsx` | Bọc 2 tab: **Sổ** (`BanHang`) + **Báo cáo** (`BaoCaoBan`) |
| `/warehouse` | `warehouse` | Kho dự trữ | `features/warehouse/KhoDuTru.tsx` | Duyệt nhập kho, theo dõi tồn đông |
| `/orders` | `orders` | Đơn đặt | `features/orders/DonDat.tsx` | Gom đơn và lệnh xuất |
| `/balancing` | `balancing` | Cân đối | `features/balancing/CanDoi.tsx` | Danh sách kỳ. "Báo cáo" = bảng in A4 sẵn có (`BangCanDoi`) |
| `/balancing/:periodId` | — | Chi tiết kỳ | `features/balancing/CanDoi.tsx` | Chi tiết kỳ (URL param thay `selId`) |
| `/catalog` | `catalog` | Danh mục | `features/catalog/DanhMuc.tsx` | 5 tab (render thêm `ThanhPham.tsx`) |
| `/users` | `users` | Người dùng | `features/users/QuanLyNguoiDung.tsx` | **Chỉ Admin** (Route Guard + chỉ admin thấy trong NAV) |
| `/kit` | — | Bộ giao diện | `design-system/kit/KitPage.tsx` | Trang demo component. **Đã gỡ khỏi sidebar** — vào bằng URL, desktop-only |

Danh sách `NAV` trong `AppLayout.tsx` hiển thị menu theo vai trò (admin thêm mục Người dùng).

## Cạm bẫy bố cục

- id mục NAV = path: `id: "warehouse"` phải khớp `Route path="/warehouse"`. (Bug cũ: id `kho` ≠ route `warehouse` ⇒ menu gãy — đã sửa.)
- Thanh bên và header nội dung dùng **chung hằng `CAO_HEADER`** trong `AppLayout.tsx`. Đặt chiều cao riêng từng bên ⇒ đường kẻ lệch, cả trang trông vênh.
- Bottom-tab điện thoại (`md:hidden`) đặt số cột **động** theo `navList.length` bằng inline `style` (`gridTemplateColumns: repeat(N, …)`) — vì admin có 5 mục, thường 4. Đừng quay lại `grid-cols-N` cứng (Tailwind purge lớp động từ template literal).
- `main` có `pb-28` trên điện thoại để nội dung không bị bottom-tab che.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.

## Thêm màn mới — checklist

1. Tạo thư mục `src/features/ten-man/`, viết file `TenMan.tsx`, export qua `index.ts` chỉ import `@/design-system` + `@/lib/danhMuc`.
2. Thêm Route path tương ứng trong `src/App.tsx` sử dụng React `lazy()`.
3. Thêm cấu hình vào danh sách `NAV` trong `src/features/shared/AppLayout.tsx` (`id` = path, nhãn, icon — KHÔNG còn `moTa`) nếu muốn hiển thị trên menu. Muốn trang có nút Hướng dẫn thì thêm mục vào `huongDan.tsx` (khóa = id NAV). Muốn tab Báo cáo thì bọc màn bằng `Tabs` ở tầng `index.ts` như `imports`/`sales`.
4. Thêm dòng vào bảng trên + tạo tài liệu domain `docs/app-map/3x-*.md` nếu là nghiệp vụ nghiệp vụ mới.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [33-ban-hang.md](33-ban-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
