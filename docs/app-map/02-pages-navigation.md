> Load khi: thêm/bớt màn hình, đổi điều hướng, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/main.tsx
last_verified: 2026-08-06
ttl_days: 90

# Trang & điều hướng

**Không có router.** Một state `screen` trong `App.tsx` (`"nhap-hang" | "ban-hang" | "can-doi" | "danh-muc" | "nguoi-dung" | "kit"`) quyết định màn nào render. Không có URL, không deep link, F5 là về màn mặc định `nhap-hang`.
Hệ quả cần biết trước khi thiết kế tính năng: **không share được link tới một ngày / một kỳ**. Muốn có thì phải thêm router — đó là thay đổi kiến trúc, không phải sửa vặt.

## Gate đăng nhập

`App.tsx` gọi `useAuth()` (`src/lib/auth.ts`) TRƯỚC khi render app: `dangTai` → màn "Đang tải"; đã cấu hình Supabase mà **chưa có phiên** → `features/DangNhap.tsx` (che toàn app). Chạy localStorage (thiếu env) ⇒ **không chặn**. Thanh bên/header có chip người dùng + **Đăng xuất**. Chi tiết auth: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md).

## Các màn

| id | Nhãn | File | Ghi chú |
|---|---|---|---|
| `nhap-hang` | Nhập hàng | `features/NhapNguyenLieu.tsx` | mặc định khi mở app |
| `ban-hang` | Bán hàng | `features/BanHang.tsx` | phiếu bán thành phẩm ngày; nguồn hút cho khối TP ra của cân đối |
| `can-doi` | Cân đối | `features/CanDoi.tsx` | có màn con `KyDetail` (state nội bộ `selId`, không phải route) |
| `danh-muc` | Danh mục | `features/DanhMuc.tsx` | 5 tab, trong đó tab Thành phẩm render `features/ThanhPham.tsx` |
| `nguoi-dung` | Người dùng | `features/QuanLyNguoiDung.tsx` | **chỉ hiện khi `laAdmin`** — gán họ tên + vai trò |
| `kit` | Bộ giao diện | `design-system/kit/KitPage.tsx` | không nằm trong `NAV`, vào từ nút cuối thanh bên; **desktop-only** |

`NAV` có 4 mục cơ bản; admin có thêm mục **Người dùng** (`navList = laAdmin ? [...NAV, NAV_NGUOI_DUNG] : NAV`). Mỗi mục **một việc, một động từ, một icon**. Ba danh mục cũ (Mặt hàng / Khách hàng / Thành phẩm) đã gộp thành 1 mục có tab bên trong.

## Cạm bẫy bố cục

- Thanh bên và header nội dung dùng **chung hằng `CAO_HEADER`** trong `App.tsx`. Đặt chiều cao riêng từng bên ⇒ đường kẻ lệch, cả trang trông vênh.
- Bottom-tab điện thoại (`md:hidden`) đặt số cột **động** theo `navList.length` bằng inline `style` (`gridTemplateColumns: repeat(N, …)`) — vì admin có 5 mục, thường 4. Đừng quay lại `grid-cols-N` cứng (Tailwind purge lớp động từ template literal).
- `main` có `pb-28` trên điện thoại để nội dung không bị bottom-tab che.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.

## Thêm màn mới — checklist

1. Tạo `src/features/TenMan.tsx`, chỉ import từ `@/design-system` + `@/lib/danhMuc`.
2. Thêm id vào type `Screen`, thêm mục vào `NAV` (label = một động từ, `moTa` một dòng, icon riêng biệt).
3. Sửa số cột `grid-cols-N` của bottom-tab cho khớp số mục `NAV`.
4. Thêm dòng vào bảng trên + tạo doc domain `docs/app-map/3x-*.md` nếu là nghiệp vụ mới.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [33-ban-hang.md](33-ban-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
