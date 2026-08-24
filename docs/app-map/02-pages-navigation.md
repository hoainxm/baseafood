> Load khi: thêm/bớt màn hình, đổi điều hướng, header, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/features/shared/AppShell.tsx, src/features/shared/NotFound.tsx, src/features/shared/guideContent.tsx
last_verified: 2026-08-24
ttl_days: 90
<!-- updated: 2026-08-24 — thêm 2 màn báo cáo khép vòng: /bc-thanh-pham (DailyProductionReport) + /bc-don-xuat (OrderExportReport), xếp nhóm Báo cáo cùng nxt-nl/nxt -->
<!-- re-verified: 2026-08-10 14:00 — AppLayout header (NutGiaoDien/NutTrangThai/NutHuongDan) + thu/mở sidebar (KEY_THU_GON) + fix logo đè khớp source -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: guideContent.tsx, ImportTab/SalesTab, MaterialImportScreen/ImportReport/SalesScreen/SalesReport/BalancingTable/FinishedGoodScreen, @/lib/catalogRepo (symbol NutHuongDan/NutGiaoDien/CaiDatHienThi giữ nguyên) -->
<!-- re-verified: 2026-08-17 — khung THẬT là AppShell.tsx (AppLayout.tsx đã XOÁ, là khung chết không ai import); nav dọc gom 6 nhóm (KIT_NAV + NHOM_NAV) dùng chung sidebar/drawer; bottom-tab điện thoại đã bỏ -->

# Trang & điều hướng

**Có định tuyến (Router).** Ứng dụng sử dụng `react-router-dom` v7 (`HashRouter` để tối ưu chạy offline tại xưởng). Đường dẫn + `NAV` dùng **id tiếng Anh** (`imports`, `sales`, `warehouse`…) — id của mục nav CHÍNH LÀ path (`to={/${id}}`), nên id phải khớp `Route path` trong `App.tsx`, nếu lệch thì menu bấm ra NotFound. Refresh (F5) giữ trạng thái, dùng Back/Forward, deep link như `#/balancing/:periodId`.

## Gate đăng nhập

`App.tsx` gọi `useAuth()` (`src/lib/auth.ts`) TRƯỚC khi khởi tạo Router. Nếu đang tải phiên $\rightarrow$ màn "Đang tải"; chưa có phiên đăng nhập $\rightarrow$ render `LoginScreen.tsx` chặn toàn app. Chi tiết auth: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md).

## Khung: `AppShell.tsx`

> ⚠️ Khung THẬT là `src/features/shared/AppShell.tsx`. `AppLayout.tsx` (khung cũ, không ai import) **đã xoá** ngày 2026-08-17 — đừng đi tìm nó.

Bố cục: **nav dọc gom nhóm** · **header trên** · nội dung phải.

- **Desktop (≥ md)**: nav là sidebar trái, thu/mở được.
- **Điện thoại (< md)**: nav là **drawer trượt trái**, mở bằng nút `☰` ở header, đóng bằng nền mờ hoặc `Esc`. **Không còn bottom-tab.**

Cả hai dùng CHUNG một cây nav (`CayNav`) dựng từ `KIT_NAV` (danh sách phẳng, `id` = path) + `NHOM_NAV` (thứ tự nhóm):

| Nhóm | Mục |
|---|---|
| Tổng quan | `dashboard` |
| Sản xuất | `production` · `wip` · `quality` |
| Kho | `imports` · `warehouse` · `cold-storage` |
| Kinh doanh | `sales` · `orders` |
| Báo cáo | `balancing` · `bc-thanh-pham` · `bc-don-xuat` · `nxt-nl` · `nxt` · `reports` · `traceability` |
| Hệ thống | `catalog` · `users` (chỉ admin) |

Mục có trong `KIT_NAV` nhưng thiếu trong `NHOM_NAV` sẽ rơi vào nhóm **"Khác"** — không mất, nhưng là dấu hiệu quên xếp nhóm.

### Header

Cụm trái (`☰` · logo · tiêu đề) được ưu tiên ngân sách ngang (`min-w-0 flex-1`). Cụm phải `shrink-0` nhưng **trên điện thoại chỉ giữ `NutTrangThai` + `NutHuongDan`**; đổi ca · thông báo · giao diện · tài khoản · đăng xuất dời xuống **chân drawer**. Trên desktop hiện đủ:

| Nút | Component (design-system) | Hành vi |
|---|---|---|
| Hướng dẫn "?" | `NutHuongDan` | Chỉ hiện ở trang có trong `guideContent.tsx` (registry route→nội dung). Mở hộp hướng dẫn dùng trang đó. |
| Tùy chỉnh giao diện 🎨 | `NutGiaoDien` | Mở `CaiDatHienThi` (cỡ chữ · mật độ · bề rộng). Lưu **theo username** (`taiKhoan` prop). |
| Trạng thái máy chủ | `NutTrangThai` | Màu theo store `ketNoi`. Hover/bấm mở popover chi tiết + **Thử kết nối lại** (`probeKetNoi`). |
| Tài khoản + Đăng xuất | (trong `AppShell`) | Tên + vai trò (ẩn text < xl) và nút Đăng xuất, sát phải. Điện thoại: ở chân drawer. |

Cỡ chữ / trạng thái kết nối **không còn ở chân sidebar** (đã dời hết lên header). Đổi tài khoản → `ShellLayout` trong `App.tsx` gọi `apDungCaiDatHienThi(username)` nạp lại giao diện của người vừa đăng nhập.

**Thu/mở sidebar** (chỉ desktop): nút `PanelLeft` bên trái header đổi `thuGon`. Thu ⇒ sidebar `w-20`, nav chỉ còn icon (nhãn vào `title`, tiêu đề nhóm thay bằng đường kẻ), logo icon-only. Chuẩn form: `FormDialog` (design-system) — mọi dialog thông tin/thao tác đi qua khung này.

## Các màn & Cấu trúc Route

| Path | id NAV | Nhãn | File chính | Ghi chú |
|---|---|---|---|---|
| — | — | Đăng nhập | `features/auth/LoginScreen.tsx` | Màn chặn đăng nhập toàn app (không có route, gate ở `App.tsx`) |
| `/imports` | `imports` | Nhập hàng | `features/imports/ImportTab.tsx` | Mặc định khi mở app. Bọc 2 tab: **Sổ** (`MaterialImportScreen`) + **Báo cáo** (`ImportReport`) |
| `/production` | `production` | Sản xuất BTP | `features/production/WipProductionScreen.tsx` | Ghi sản lượng bán thành phẩm ngày (WIP) |
| `/sales` | `sales` | Bán hàng | `features/sales/SalesTab.tsx` | Bọc 2 tab: **Sổ** (`SalesScreen`) + **Báo cáo** (`SalesReport`) |
| `/warehouse` | `warehouse` | Kho dự trữ | `features/warehouse/ReserveWarehouseScreen.tsx` | Duyệt nhập kho, theo dõi tồn đông |
| `/orders` | `orders` | Đơn đặt | `features/orders/SalesOrderScreen.tsx` | Gom đơn và lệnh xuất |
| `/balancing` | `balancing` | Cân đối | `features/balancing/BalancingScreen.tsx` | Danh sách kỳ. "Báo cáo" = bảng in A4 sẵn có (`BalancingTable`) |
| `/balancing/:periodId` | — | Chi tiết kỳ | `features/balancing/BalancingScreen.tsx` | Chi tiết kỳ (URL param thay `selId`) |
| `/catalog` | `catalog` | Danh mục | `features/catalog/CatalogScreen.tsx` | 5 tab (render thêm `FinishedGoodScreen.tsx`) |
| `/users` | `users` | Người dùng | `features/users/UserManagementScreen.tsx` | **Chỉ Admin** (Route Guard + chỉ admin thấy trong NAV) |
| `/kit` | — | Bộ giao diện | `design-system/kit/KitPage.tsx` | Trang demo component. **Đã gỡ khỏi sidebar** — vào bằng URL, desktop-only |

Ngoài bảng trên, khung còn các màn MES: `/dashboard` (Tổng quan) · `/quality` (Chất lượng) · `/cold-storage` (Kho lạnh) · `/reports` (Báo cáo) · `/traceability` (Truy xuất) · `/wip` (Sản xuất BTP).

Cụm báo cáo khép vòng (đọc dữ liệu thật, không mock): `/bc-thanh-pham` (`features/reports/DailyProductionReport.tsx` — tổng hợp thành phẩm SX hàng ngày, lưới mặt hàng×ngày + Excel) · `/bc-don-xuat` (`features/reports/OrderExportReport.tsx` — đơn đặt được xuất theo kỳ + Excel) · `/nxt-nl` (`features/reports/MaterialNxtScreen.tsx` — NXT nguyên liệu) · `/nxt` (`features/reports/NxtReportScreen.tsx` — NXT thành phẩm, suy từ SX/đơn/bán + tồn đầu). Lưu ý: `/production` là màn TRƯNG BÀY (WorkOrderScreen, mock); màn ghi sản lượng thật là `/wip`.

`App.tsx` lọc `KIT_NAV` theo vai trò (bỏ `users` nếu không phải admin) rồi truyền vào `AppShell` qua prop `items`.

## Cạm bẫy bố cục

- id mục nav = path: `id: "warehouse"` phải khớp `Route path="/warehouse"`. (Bug cũ: id `kho` ≠ route `warehouse` ⇒ menu gãy — đã sửa.)
- Đầu sidebar và header nội dung cùng `h-20`. Đặt chiều cao riêng từng bên ⇒ đường kẻ lệch, cả trang trông vênh.
- **Đừng nhồi thêm nút icon vào header cho điện thoại.** Ở cỡ chữ 130%, mỗi nút là 57px — 6 nút đã vượt bề rộng màn 390px và bóp tiêu đề còn 0px. Thứ toàn cục mới thì cho xuống chân drawer.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.
- Luật responsive đầy đủ (breakpoint, thang chạm, bảng ra thẻ, checklist màn mới): [`src/design-system/README.md` § Quy chuẩn mobile](../../src/design-system/README.md).

## Thêm màn mới — checklist

1. Tạo thư mục `src/features/ten-man/`, viết file `TenMan.tsx`, export qua `index.ts` chỉ import `@/design-system` + `@/lib/catalogRepo`.
2. Thêm Route path tương ứng trong `src/App.tsx` sử dụng React `lazy()`.
3. Thêm mục vào `KIT_NAV` trong `src/features/shared/AppShell.tsx` (`id` = path, nhãn, icon) **và xếp `id` đó vào đúng nhóm trong `NHOM_NAV`** — thiếu bước sau thì mục rơi vào nhóm "Khác". Muốn trang có nút Hướng dẫn thì thêm mục vào `guideContent.tsx` (khóa = id nav). Muốn tab Báo cáo thì bọc màn bằng `Tabs` ở tầng `index.ts` như `imports`/`sales`.
4. Thêm dòng vào bảng trên + tạo tài liệu domain `docs/app-map/3x-*.md` nếu là nghiệp vụ mới.
5. Chạy checklist mobile ([`design-system/README.md` § Quy chuẩn mobile · mục 7](../../src/design-system/README.md)) trước khi coi là xong.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [33-ban-hang.md](33-ban-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
