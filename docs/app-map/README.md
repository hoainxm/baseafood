> Load khi: bắt đầu bất kỳ task nào trong repo này và chưa biết phải đọc file nào.
covers: docs/app-map/**
last_verified: 2026-10-29
<!-- re-verified: 2026-10-13 09:00 — index không thêm file app-map mới; 01–05 cập nhật cho chế độ demo + gỡ 5 màn DEMO (spec ../spec/che-do-demo.md). -->
<!-- re-verified: 2026-10-08 14:30 — dòng định tuyến QR vẫn đúng sau khi lô NL tách theo loại (chi tiết ở spec §6e, doc 30 · 34 · 38 đã ghi); không thêm doc mới. -->
<!-- updated: 2026-10-08 — dòng định tuyến "Truy xuất theo lô bằng QR" mở rộng theo đợt 2b (bán hàng, đơn đặt, chốt ngày bắt gắn lô, trừ tồn theo lô) + thêm trỏ 33-ban-hang. -->
ttl_days: 90
<!-- re-verified: 2026-09-21 — audit PO: cập nhật số liệu cột "Nội dung" đã cũ (02 "5 màn"→~20 route; 03 "16 bảng/7 migration"→46 migration; 05 "chờ 0003"→0021+0047). Số route/bảng/migration là dữ kiện suy được từ source, không phải invariant — bảng Index chỉ tóm tắt, chi tiết đọc từng file. -->


# App-map — Baseafood MES

Bản đồ ngữ cảnh cho AI agent. Mỗi file **một chủ đề canonical**: không copy nội dung giữa các file, chỉ link.
Doc ở đây ghi **cái không suy được từ code** — quyết định kiến trúc, invariant nghiệp vụ, cạm bẫy. Danh sách hàm/prop thì đọc thẳng source.

Cửa vào là [`CLAUDE.md`](../../CLAUDE.md) ở root (quy tắc code, risk tier, bảng doc/test). File này chỉ định tuyến ngữ cảnh **khi code**. Bản đồ toàn bộ tài liệu (ops, spec, nghiệp vụ) + luật "doc mới bỏ đâu": [`docs/README.md`](../README.md).

## Task nào đọc file nào

| Task | Đọc |
|---|---|
| Sửa màn Nhập hàng (chuyến, ghi bù, chốt ngày, phế liệu) | [30-nhap-hang](30-nhap-hang.md) → [03-database](03-database.md) |
| Sửa màn Bán hàng (phiếu bán, quy cách, hút bán) | [33-ban-hang](33-ban-hang.md) → [31-can-doi-ky](31-can-doi-ky.md) |
| Sửa màn Cân đối / bảng in / công thức | [31-can-doi-ky](31-can-doi-ky.md) → [33-ban-hang](33-ban-hang.md) (bán hút) · [30-nhap-hang](30-nhap-hang.md) (phế liệu hút) |
| Sửa danh mục, thêm trường master data | [32-danh-muc](32-danh-muc.md) → [03-database](03-database.md) |
| Sửa Sản xuất BTP / Kho dự trữ / Đơn đặt · vòng đông gửi↔xả đông | [34-btp-san-xuat-kho](34-btp-san-xuat-kho.ba-spec.md) → [35-btp-ui](35-btp-ui.design-spec.md) → [31-can-doi-ky](31-can-doi-ky.md) |
| Sổ kho theo THÁNG dương lịch, dồn tồn cuối kỳ → đầu kỳ sau | [36-so-kho-thang](36-so-kho-thang.md) → [04-tang-du-lieu](04-tang-du-lieu.md) |
| Đối soát hóa đơn điện tử ⇄ phần mềm kế toán từ file Excel | [37-doi-soat-hddt](37-doi-soat-hddt.md) |
| Tồn NGUYÊN LIỆU theo ngày/lô, lấy NL ra chế biến, cấp đông/xả đông theo lô, nối `/nxt-material`·`/nxt-warehouse`·`/monthly-stock` về một sổ | [38-so-ton-lien-tuc](38-so-ton-lien-tuc.ba-spec.md) (ba-spec) → [34](34-btp-san-xuat-kho.ba-spec.md) · [31](31-can-doi-ky.md) · [36](36-so-kho-thang.md) |
| Truy xuất theo lô bằng QR (hộ chiếu lô `/qr` + Thu hồi + tab Theo giai đoạn, gắn lô theo phiên ở `/wip`, chốt ngày bắt gắn lô, gắn lô ở `/packaging` + `/sales`, kiểm lô xuất ở `/orders`, sổ tồn trừ theo lô gắn, tem QR) | [`spec/qr-truy-xuat-lo`](../spec/qr-truy-xuat-lo.md) (§6d, §9 kịch bản oracle) → [34-btp-san-xuat-kho](34-btp-san-xuat-kho.ba-spec.md) · [33-ban-hang](33-ban-hang.md) · [30-nhap-hang](30-nhap-hang.md) |
| Việc của tôi `/my-tasks`: việc cần làm từng người, hạn / quá hạn, giao việc, chuông header, link mở thẳng ngày `?date=&workshop=` | [39-my-tasks](39-my-tasks.md) → [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) · [`trien-khai/flow-end-to-end-2-bo-phan`](../trien-khai/flow-end-to-end-2-bo-phan.md) |
| Tài liệu công ty `/documents`: quy trình / biểu mẫu / chứng nhận / hồ sơ năng lực, lần ban hành, file PDF trên bucket `documents`, xem theo phòng ban | [40-documents](40-documents.md) → [`spec/quan-ly-tai-lieu`](../spec/quan-ly-tai-lieu.md) · [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) |
| Phòng Kế hoạch · Xuất khẩu `/planning-export` (đợt 1 ĐÃ BUILD, mig 0075 chưa chạy): tháng × khách × hợp đồng × chuyến, 6 bước checklist + file, khép kín theo dung sai, vai trò `planner` | [41-export-planning.ba-spec](41-export-planning.ba-spec.md) → [`spec/xuat-khau-phong-ke-hoach`](../spec/xuat-khau-phong-ke-hoach.md) · [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) |
| Phòng Kế hoạch · **Nhập khẩu** `/planning-import` (ĐÃ BUILD; 0082 ✅, 0083 chưa chạy — ≠ Nhập hàng `/imports`): HĐ nhập → lần nhập → chứng từ → thực nhập, quyền `import-plans*`; đối tác = danh mục **NCC nhập khẩu** riêng (tab Danh mục, ≠ Đại lý); dòng hàng nối **Mặt hàng** danh mục (v3, mig 0084) | [45-import-planning.ba-spec](45-import-planning.ba-spec.md) → [46 design-spec](46-import-planning-ui.design-spec.md) · [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) |
| Hướng dẫn thao tác (tour từng bước trên trang — khai bước, mốc `data-tour`, lời hướng dẫn) · **thêm trang mới** (quy tắc 18: trang mới phải kèm tour + hộp "?") | [43-guided-tour.ba-spec](43-guided-tour.ba-spec.md) → [README design-system § Hướng dẫn thao tác](../../src/design-system/README.md) |
| Nối luồng nhập→sản xuất→kho→bán, tách giao diện bộ phận, daily-task | [`trien-khai/flow-end-to-end-2-bo-phan`](../trien-khai/flow-end-to-end-2-bo-phan.md) |
| Thêm bảng / cột / migration | [03-database](03-database.md) → [04-tang-du-lieu](04-tang-du-lieu.md) |
| Thêm BẢNG HIỂN THỊ mới (bảng dữ liệu trên màn) / tô màu dòng "đã dò" / xổ bảng dài | [README design-system § Tô màu dòng](../../src/design-system/README.md#tô-màu-dòng-đã-dò-kiểu-excel) (prop `rowMarks`, `SummaryTable fullHeight`) → [04-tang-du-lieu](04-tang-du-lieu.md) |
| Số liệu mất, không lên server, đèn đỏ, reload nuốt dòng | [04-tang-du-lieu](04-tang-du-lieu.md) |
| Thêm màn hình / đổi điều hướng | [02-pages-navigation](02-pages-navigation.md) → [01-app-structure](01-app-structure.md) |
| Đăng nhập, phân quyền, tạo tài khoản, vai trò | [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) 🔴 |
| Tên gọi (nickname) người dùng — gọi bằng tên khác họ tên mà sổ / nhật ký / chứng từ / phân quyền vẫn đứng họ tên thật | [47-user-display-name.ba-spec](47-user-display-name.ba-spec.md) · [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) |
| Lệnh sản xuất của Phòng Kế hoạch — lập từ HĐ xuất, gắn NL nhập khẩu, phát hành tới xưởng, gắn chuyến xuất, in QTI-KH-01-04 | [48-production-order.ba-spec](48-production-order.ba-spec.md) · [49-production-order-ui.design-spec](49-production-order-ui.design-spec.md) · [41-export-planning.ba-spec](41-export-planning.ba-spec.md) |
| Đụng UI, component, cỡ chữ, màu | [`src/design-system/README.md`](../../src/design-system/README.md) (canonical, **không** nhân bản sang đây) |
| Thêm đăng nhập / phân quyền / mở app ra ngoài mạng nội bộ | [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) 🔴 |
| Tìm hiểu nghiệp vụ gốc, vì sao thiết kế vậy | [`docs/trien-khai/README.md`](../trien-khai/README.md) |
| Nhận bàn giao dự án, cần đầu mối liên hệ / câu treo với xí nghiệp | [`docs/BAN-GIAO.md`](../BAN-GIAO.md) |
| Deploy Vercel · cutover Supabase · env production | [`docs/ops/`](../ops/README.md) |

## Index

| File | Nội dung | covers |
|---|---|---|
| [01-app-structure.md](01-app-structure.md) | Map thư mục `src/` thật, ranh giới import, file nào là ngoại lệ | `src/**` |
| [02-pages-navigation.md](02-pages-navigation.md) | ~20 route (React Router v7 HashRouter) + nav cây module-centric, gate đăng nhập theo vai trò, màn DEMO gate admin | `src/App.tsx`, `src/main.tsx` |
| [03-database.md](03-database.md) | Bảng + quy ước đặt tên (English snake_case sau 0016), 55 migration (0001→0055) + thứ tự chạy, trigger updated_at | `supabase/migrations/**` |
| [04-tang-du-lieu.md](04-tang-du-lieu.md) | `useTable`, hàng chờ đồng bộ, hoà server↔local, seed, `patchLegacy`, đèn kết nối | `src/lib/repo.ts`, `src/lib/db.ts`, `src/lib/catalogRepo.ts`, `src/lib/connectivity.ts`, `src/lib/supabase.ts` |
| [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md) | Đăng nhập Supabase Auth + `user_profiles`/vai trò (nhiều/người), gate app-level + nav-access 2 bộ phận, thiết lập admin, siết RLS 0021 (+0047 cho 5 bảng post-0021) | `src/lib/auth.ts`, `src/lib/username.ts`, `src/features/auth/LoginScreen.tsx`, `src/features/users/UserManagementScreen.tsx`, `supabase/migrations/0006_nguoi_dung.sql`, `0003_siet_rls.sql` |
| [30-nhap-hang.md](30-nhap-hang.md) | Sổ nhập ngày: chuyến, hai ngày + ghi bù, chốt ngày, phế liệu ngày | `src/features/imports/MaterialImportScreen.tsx`, `src/types.ts` |
| [33-ban-hang.md](33-ban-hang.md) | Sổ bán ngày: phiếu bán, quy cách, hai ngày + ghi bù, kênh XK/NĐ, hút vào cân đối | `src/features/sales/SalesScreen.tsx`, `src/types.ts`, `src/lib/repo.ts` |
| [31-can-doi-ky.md](31-can-doi-ky.md) | Kỳ theo lô, 3 khối, công thức, hút phế liệu + hút bán, bản in A4 | `src/features/balancing/BalancingScreen.tsx`, `src/features/balancing/BalancingTable.tsx`, `src/lib/balancingCalc.ts` |
| [32-danh-muc.md](32-danh-muc.md) | 4 danh mục + 141 mã TP, lưu theo TÊN, seed vs nguồn thật | `src/features/catalog/CatalogScreen.tsx`, `src/features/catalog/FinishedGoodScreen.tsx`, `src/data/finished-goods.json` |
| [34-btp-san-xuat-kho.ba-spec.md](34-btp-san-xuat-kho.ba-spec.md) | Sản xuất BTP (WIP) + kho dự trữ + đơn/xuất: mô hình tồn 5 chiều (kg + block), xả đông "hai chân một số hai sổ", gối đầu liên tục, ghi-ngược từ cân đối | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**`, `supabase/migrations/0011_wip_san_xuat_kho_don.sql` |
| [35-btp-ui.design-spec.md](35-btp-ui.design-spec.md) | Đặc tả giao diện BTP: 3 màn (Sản xuất ngày · Kho dự trữ · Đơn & lệnh xuất), tablet ngang xưởng lạnh | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**` |
| [36-so-kho-thang.md](36-so-kho-thang.md) | Sổ kho theo THÁNG dương lịch: dồn tồn cuối kỳ → đầu kỳ sau, đủ cột kiện+kg như bảng kê kho, cho mọi đối tượng NL/BTP/TP | `src/features/monthly-stock/**`, `src/lib/monthlyStock.ts` |
| [37-doi-soat-hddt.md](37-doi-soat-hddt.md) | Đối soát hóa đơn điện tử (cổng thuế) ⇄ phần mềm kế toán từ 1 file Excel: khóa MST·ký hiệu·số HĐ, quy VND, ngưỡng chỉnh được, **xuất Excel GIỮ NGUYÊN định dạng file vào + bám bố cục file mẫu kế toán** (sửa tại chỗ bằng `exceljs`: cột KẾT QUẢ ở đầu, khối phân tích ở cuối, **một sheet KẾT LUẬN CHUNG** lên đầu — bảng trả lời có link "xem ở đâu", sheet danh sách chỉ dựng khi có dữ liệu; chèn cột thì phải dịch tham chiếu công thức); nhận cả `.xls` và sổ gộp nhiều tháng; biết hóa đơn "đã bị thay thế" thì KHÔNG cần vào sổ; **so hai bản HĐĐT** (thuế gửi ⇄ tự tải), **lọc hóa đơn cùng MST cùng ngày**, sheet **HÓA ĐƠN CHƯA KÊ** lọc sẵn; nhận cả sổ xuất chi tiết mặt hàng; **cân đối cột** (cộng cột lệch thì bóc do phí / chiết khấu / làm tròn / lệch thật, đánh dấu bằng công thức sống NGAY TRONG sheet bảng kê, không sửa số gốc) và quy tắc hóa đơn bán hàng mẫu số 2 không có thuế GTGT; công cụ kế toán không đọc DB | `src/features/reconciliation/**`, `src/lib/doiSoat*.ts` |
| [39-my-tasks.md](39-my-tasks.md) | Việc của tôi: 3 mục (được giao · theo quyền + phạm vi · đã giao), hạn từng loại việc + quá hạn, giao việc `task_assignments` (0070), tự hết khi sổ sửa xong, chuông header, link mở thẳng ngày | `src/features/my-tasks/**`, `src/lib/myTasks.ts` |
| [40-documents.md](40-documents.md) | Tài liệu công ty: thư viện + lần ban hành không ghi đè, ghi bản đã ký giấy (PDF bắt buộc), xem theo phòng ban 3 lớp (app · RLS · bucket), hạn chứng nhận vào Việc của tôi, cột `app_roles.department` (0072) | `src/features/documents/**`, `src/lib/documents.ts`, `src/lib/documentStorage.ts` |
| [41-export-planning.ba-spec.md](41-export-planning.ba-spec.md) | ba-spec đợt 1 Xuất khẩu (Phòng Kế hoạch): 13 nghiệp vụ, ma trận quyền `export-plans`, 29 AC — đợt 1 ĐÃ BUILD 2026-10-20 | `src/features/export-planning/**`, `src/lib/exportPlanning.ts`, `src/lib/exportFileStorage.ts`, `0075` |
| [42-export-planning-ui.design-spec.md](42-export-planning-ui.design-spec.md) | design-spec giao diện Xuất khẩu: thang user, screen map, bố cục (thanh tiến độ "bước tiếp — còn thiếu", hồ sơ 1 nút chính + menu, chuyến dạng checklist, form 5 khối), ma trận trạng thái, QA | `src/features/export-planning/**` |
| [43-guided-tour.ba-spec.md](43-guided-tour.ba-spec.md) | ba-spec **Hướng dẫn thao tác** (tour từng bước trên trang): chỉ dẫn không ghi, bỏ bước không áp dụng, hồ sơ minh họa, thoát về chỗ cũ, văn phong lời — **mọi trang nghiệp vụ** (v4, quy tắc 18: route ⇄ tour ⇄ hộp "?" có test canh) | `src/lib/guidedTour.ts`, `src/design-system/patterns/GuidedTour.tsx`, `src/features/shared/PageTourProvider.tsx`, `src/features/shared/guideContent.tsx` + `guides/**`, `src/features/**/*Tour.ts` |
| [45-import-planning.ba-spec.md](45-import-planning.ba-spec.md) | ba-spec **Phòng Kế hoạch · Nhập khẩu** đợt 1 (gọn): HĐ nhập (tên hàng · kg · đơn giá) → lần nhập → bộ chứng từ (3 bắt buộc + nếu có) → thực nhập theo dòng; không thanh toán / duyệt / hạn / dung sai; quyền `import-plans` — ĐÃ BUILD 2026-10-29 (mig 0082 chưa chạy) | `src/features/import-planning/**`, `src/lib/importPlanning.ts`, `0082` |
| [46-import-planning-ui.design-spec.md](46-import-planning-ui.design-spec.md) | design-spec giao diện Nhập khẩu: lô nhập theo tháng, hợp đồng, hồ sơ, hộp ghi, phần thủ kho (khuôn chung theo 42) | `src/features/import-planning/**` |
| [47-user-display-name.ba-spec.md](47-user-display-name.ba-spec.md) | ba-spec **Tên gọi người dùng** (v1, ĐÃ BUILD 2026-10-29, mig 0086 chưa chạy): tên gọi chỉ để gọi / nhận diện; ghi sổ, nhật ký, chứng từ, phạm vi `own` (app + trigger 0065) luôn họ tên thật; loại phương án sửa họ tên / đổi tên đăng nhập | `src/lib/personName.ts`, `src/lib/auth.ts`, `src/features/shared/AccountMenu.tsx`, `src/features/users/**`, `0086` |
| [48-production-order.ba-spec.md](48-production-order.ba-spec.md) | ba-spec **Phòng Kế hoạch · Lệnh sản xuất** (v1, ĐÃ BUILD P1–P6 2026-10-30, mig 0088 chưa chạy): lệnh từ dòng hàng HĐ xuất (thùng → kg, MSL, ngày SX, HSD), NL nhập khẩu dự kiến (không trừ kho), phát hành tới quản đốc + thủ kho, gắn chuyến ⇒ bước 2 tự xong, in QTI-KH-01-04; kế hoạch build §12 | `src/features/production-orders/**` |
| [49-production-order-ui.design-spec.md](49-production-order-ui.design-spec.md) | design-spec giao diện Lệnh sản xuất `/planning-production`: danh sách, hồ sơ, hộp lập / phát hành / NL dự kiến, bản in, chỗ hiện ở Xuất khẩu (khuôn chung theo 42 / 46) | `src/features/production-orders/**` |
| [38-so-ton-lien-tuc.ba-spec.md](38-so-ton-lien-tuc.ba-spec.md) | **ba-spec (WHAT, chưa build)**: sổ tồn NGUYÊN LIỆU liên tục = một sổ SỰ KIỆN kho theo (lô × vị trí × xưởng) — `kho tươi → sàn SX → tiêu hao / còn dở → chờ cấp đông → kho dự trữ → xả đông`; lô S (chuyến) / F (đông, n gốc) / K (kế thừa cutover); `LAY_RA`≠`TIEU_HAO`, `effective_date` + "chốt bị hở", cấm dồn âm, ánh xạ mã kế toán 2 tầng, phái sinh từ mốc cutover; thay dần 5 sổ tồn song song (`/nxt-material`, `/nxt-warehouse`, `/monthly-stock`…) bằng "một sự thật" qua giai đoạn song song. 24 AC có Test/Assert, 6 Open chờ chủ dự án | `src/lib/inventoryMaterial.ts`, `src/lib/lotTraceability.ts`, `src/features/reports/MaterialNxtScreen.tsx`, `src/features/reports/WarehouseNxtScreen.tsx`, `src/features/production/WipProductionScreen.tsx` |

Không có file cho edge function / cron / job nền — **dự án không có**. Automation duy nhất ở DB là trigger `updated_at` (xem [03-database](03-database.md)).

> **Định hướng đợt 2026-08-22** (số hóa trọn chuỗi + tách 2 giao diện bộ phận + cutover 01/09): đọc trước [`trien-khai/flow-end-to-end-2-bo-phan.md`](../trien-khai/flow-end-to-end-2-bo-phan.md) để biết chuỗi đang đứt ở đâu, rồi mới vào 30/34/35.

## Frontmatter

Mỗi file mở đầu bằng `> Load khi:` + `covers:` + `last_verified:` + `ttl_days: 90`.
`covers:` trỏ source path thật để hook `.githooks/pre-commit` phát hiện doc lệch code: commit đụng file trong `covers` mà doc không đổi ⇒ cảnh báo. Sửa doc xong thì cập nhật `last_verified`.
