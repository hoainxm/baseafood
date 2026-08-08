> Load khi: thêm/bớt màn hình, đổi điều hướng, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/features/shared/AppLayout.tsx, src/features/shared/NotFound.tsx
last_verified: 2026-08-07
ttl_days: 90

# Trang & điều hướng

**Có định tuyến (Router).** Ứng dụng sử dụng `react-router-dom` v7 (`HashRouter` để tối ưu chạy offline tại xưởng). Các trang và đường dẫn được phân mảnh rõ ràng trên URL, cho phép refresh (F5) giữ trạng thái, dùng nút Back/Forward, và chia sẻ liên kết sâu (deep link) như `#/can-doi/:kyId`.

## Gate đăng nhập

`App.tsx` gọi `useAuth()` (`src/lib/auth.ts`) TRƯỚC khi khởi tạo Router. Nếu đang tải phiên $\rightarrow$ màn "Đang tải"; chưa có phiên đăng nhập $\rightarrow$ render `DangNhap.tsx` chặn toàn app. Thanh bên/header có chip người dùng + **Đăng xuất**. Chi tiết auth: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md).

## Các màn & Cấu trúc Route

| Path | Nhãn | File chính | Ghi chú |
|---|---|---|---|
| `/login` | Đăng nhập | `features/auth/DangNhap.tsx` | Màn chặn đăng nhập toàn app |
| `/nhap-hang` | Nhập hàng | `features/nhap-hang/NhapNguyenLieu.tsx` | Mặc định khi mở app |
| `/san-xuat` | Sản xuất BTP | `features/san-xuat/SanXuatBTP.tsx` | Ghi sản lượng bán thành phẩm ngày (WIP) |
| `/ban-hang` | Bán hàng | `features/ban-hang/BanHang.tsx` | Phiếu bán thành phẩm ngày; nguồn hút cân đối |
| `/kho` | Kho dự trữ | `features/kho/KhoDuTru.tsx` | Duyệt nhập kho, theo dõi tồn đông |
| `/don-dat` | Đơn đặt | `features/don-dat/DonDat.tsx` | Gom đơn và lệnh xuất |
| `/can-doi` | Cân đối | `features/can-doi/CanDoi.tsx` | Danh sách kỳ cân đối |
| `/can-doi/:kyId` | Chi tiết kỳ | `features/can-doi/CanDoi.tsx` | Màn chi tiết kỳ cân đối (dùng URL param thay `selId`) |
| `/danh-muc` | Danh mục | `features/danh-muc/DanhMuc.tsx` | Quản lý danh mục (render thêm `ThanhPham.tsx` bên trong) |
| `/nguoi-dung` | Người dùng | `features/nguoi-dung/QuanLyNguoiDung.tsx` | **Chỉ Admin truy cập được** (Route Guard chặn) |
| `/kit` | Bộ giao diện | `design-system/kit/KitPage.tsx` | Nhập từ nút cuối thanh bên; **desktop-only** |

Danh sách `NAV` trong `AppLayout.tsx` hiển thị menu tương ứng theo vai trò.

## Cạm bẫy bố cục

- Thanh bên và header nội dung dùng **chung hằng `CAO_HEADER`** trong `App.tsx`. Đặt chiều cao riêng từng bên ⇒ đường kẻ lệch, cả trang trông vênh.
- Bottom-tab điện thoại (`md:hidden`) đặt số cột **động** theo `navList.length` bằng inline `style` (`gridTemplateColumns: repeat(N, …)`) — vì admin có 5 mục, thường 4. Đừng quay lại `grid-cols-N` cứng (Tailwind purge lớp động từ template literal).
- `main` có `pb-28` trên điện thoại để nội dung không bị bottom-tab che.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.

## Thêm màn mới — checklist

1. Tạo thư mục `src/features/ten-man/`, viết file `TenMan.tsx`, export qua `index.ts` chỉ import `@/design-system` + `@/lib/danhMuc`.
2. Thêm Route path tương ứng trong `src/App.tsx` sử dụng React `lazy()`.
3. Thêm cấu hình vào danh sách `NAV` trong `src/features/shared/AppLayout.tsx` (nhãn, icon, mô tả) nếu muốn hiển thị trên menu điều hướng.
4. Thêm dòng vào bảng trên + tạo tài liệu domain `docs/app-map/3x-*.md` nếu là nghiệp vụ nghiệp vụ mới.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [33-ban-hang.md](33-ban-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
