> Load khi: thêm/bớt màn hình, đổi điều hướng, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/main.tsx
last_verified: 2026-08-06
ttl_days: 90

# Trang & điều hướng

**Không có router.** Một state `screen` trong `App.tsx` (`"nhap-hang" | "can-doi" | "danh-muc" | "kit"`) quyết định màn nào render. Không có URL, không deep link, F5 là về màn mặc định `nhap-hang`.
Hệ quả cần biết trước khi thiết kế tính năng: **không share được link tới một ngày / một kỳ**. Muốn có thì phải thêm router — đó là thay đổi kiến trúc, không phải sửa vặt.

## Bốn màn

| id | Nhãn | File | Ghi chú |
|---|---|---|---|
| `nhap-hang` | Nhập hàng | `features/NhapNguyenLieu.tsx` | mặc định khi mở app |
| `can-doi` | Cân đối | `features/CanDoi.tsx` | có màn con `KyDetail` (state nội bộ `selId`, không phải route) |
| `danh-muc` | Danh mục | `features/DanhMuc.tsx` | 5 tab, trong đó tab Thành phẩm render `features/ThanhPham.tsx` |
| `kit` | Bộ giao diện | `design-system/kit/KitPage.tsx` | không nằm trong `NAV`, vào từ nút cuối thanh bên; **desktop-only** |

`NAV` chỉ có 3 mục — mỗi mục **một việc, một động từ, một icon**. Ba danh mục cũ (Mặt hàng / Khách hàng / Thành phẩm) đã gộp thành 1 mục có tab bên trong vì tên gần giống nhau, người dùng 45–60 tuổi phải nhớ cái nào ở đâu.

## Cạm bẫy bố cục

- Thanh bên và header nội dung dùng **chung hằng `CAO_HEADER`** trong `App.tsx`. Đặt chiều cao riêng từng bên ⇒ đường kẻ lệch, cả trang trông vênh.
- Bottom-tab điện thoại (`md:hidden`) chỉ có **3 cột** cứng (`grid-cols-3`). Thêm mục thứ 4 vào `NAV` là vỡ lưới — phải sửa cả grid.
- `main` có `pb-28` trên điện thoại để nội dung không bị bottom-tab che.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.

## Thêm màn mới — checklist

1. Tạo `src/features/TenMan.tsx`, chỉ import từ `@/design-system` + `@/lib/danhMuc`.
2. Thêm id vào type `Screen`, thêm mục vào `NAV` (label = một động từ, `moTa` một dòng, icon riêng biệt).
3. Nếu `NAV` > 3 mục: sửa `grid-cols-3` của bottom-tab.
4. Thêm dòng vào bảng trên + tạo doc domain `docs/app-map/3x-*.md` nếu là nghiệp vụ mới.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
