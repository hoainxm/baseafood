> Load khi: bắt đầu bất kỳ task nào trong repo này và chưa biết phải đọc file nào.
covers: docs/app-map/**
last_verified: 2026-09-21
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
| Truy xuất theo lô bằng QR (hộ chiếu lô `/qr`, gắn lô ở `/wip` + `/packaging`, tem QR) | [`spec/qr-truy-xuat-lo`](../spec/qr-truy-xuat-lo.md) → [34-btp-san-xuat-kho](34-btp-san-xuat-kho.ba-spec.md) · [30-nhap-hang](30-nhap-hang.md) |
| Nối luồng nhập→sản xuất→kho→bán, tách giao diện bộ phận, daily-task | [`trien-khai/flow-end-to-end-2-bo-phan`](../trien-khai/flow-end-to-end-2-bo-phan.md) |
| Thêm bảng / cột / migration | [03-database](03-database.md) → [04-tang-du-lieu](04-tang-du-lieu.md) |
| Số liệu mất, không lên server, đèn đỏ, reload nuốt dòng | [04-tang-du-lieu](04-tang-du-lieu.md) |
| Thêm màn hình / đổi điều hướng | [02-pages-navigation](02-pages-navigation.md) → [01-app-structure](01-app-structure.md) |
| Đăng nhập, phân quyền, tạo tài khoản, vai trò | [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md) 🔴 |
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
| [03-database.md](03-database.md) | Bảng + quy ước đặt tên (English snake_case sau 0016), 46 migration (0001→0047) + thứ tự chạy, trigger updated_at | `supabase/migrations/**` |
| [04-tang-du-lieu.md](04-tang-du-lieu.md) | `useBang`, hàng chờ đồng bộ, hoà server↔local, seed, `vaDongCu`, đèn kết nối | `src/lib/repo.ts`, `src/lib/db.ts`, `src/lib/catalogRepo.ts`, `src/lib/connectivity.ts`, `src/lib/supabase.ts` |
| [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md) | Đăng nhập Supabase Auth + `user_profiles`/vai trò (nhiều/người), gate app-level + nav-access 2 bộ phận, thiết lập admin, siết RLS 0021 (+0047 cho 5 bảng post-0021) | `src/lib/auth.ts`, `src/lib/username.ts`, `src/features/auth/LoginScreen.tsx`, `src/features/users/UserManagementScreen.tsx`, `supabase/migrations/0006_nguoi_dung.sql`, `0003_siet_rls.sql` |
| [30-nhap-hang.md](30-nhap-hang.md) | Sổ nhập ngày: chuyến, hai ngày + ghi bù, chốt ngày, phế liệu ngày | `src/features/imports/MaterialImportScreen.tsx`, `src/types.ts` |
| [33-ban-hang.md](33-ban-hang.md) | Sổ bán ngày: phiếu bán, quy cách, hai ngày + ghi bù, kênh XK/NĐ, hút vào cân đối | `src/features/sales/SalesScreen.tsx`, `src/types.ts`, `src/lib/repo.ts` |
| [31-can-doi-ky.md](31-can-doi-ky.md) | Kỳ theo lô, 3 khối, công thức, hút phế liệu + hút bán, bản in A4 | `src/features/balancing/BalancingScreen.tsx`, `src/features/balancing/BalancingTable.tsx`, `src/lib/balancingCalc.ts` |
| [32-danh-muc.md](32-danh-muc.md) | 4 danh mục + 141 mã TP, lưu theo TÊN, seed vs nguồn thật | `src/features/catalog/CatalogScreen.tsx`, `src/features/catalog/FinishedGoodScreen.tsx`, `src/data/thanh-pham.json` |
| [34-btp-san-xuat-kho.ba-spec.md](34-btp-san-xuat-kho.ba-spec.md) | Sản xuất BTP (WIP) + kho dự trữ + đơn/xuất: mô hình tồn 5 chiều (kg + block), xả đông "hai chân một số hai sổ", gối đầu liên tục, ghi-ngược từ cân đối | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**`, `supabase/migrations/0011_wip_san_xuat_kho_don.sql` |
| [35-btp-ui.design-spec.md](35-btp-ui.design-spec.md) | Đặc tả giao diện BTP: 3 màn (Sản xuất ngày · Kho dự trữ · Đơn & lệnh xuất), tablet ngang xưởng lạnh | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**` |
| [36-so-kho-thang.md](36-so-kho-thang.md) | Sổ kho theo THÁNG dương lịch: dồn tồn cuối kỳ → đầu kỳ sau, đủ cột kiện+kg như bảng kê kho, cho mọi đối tượng NL/BTP/TP | `src/features/monthly-stock/**`, `src/lib/monthlyStock.ts` |
| [37-doi-soat-hddt.md](37-doi-soat-hddt.md) | Đối soát hóa đơn điện tử (cổng thuế) ⇄ phần mềm kế toán từ 1 file Excel: khóa MST·ký hiệu·số HĐ, quy VND, ngưỡng chỉnh được, **xuất Excel GIỮ NGUYÊN định dạng file vào + bám bố cục file mẫu kế toán** (sửa tại chỗ bằng `exceljs`: cột KẾT QUẢ ở đầu, khối phân tích ở cuối, **một sheet KẾT LUẬN CHUNG** lên đầu — bảng trả lời có link "xem ở đâu", sheet danh sách chỉ dựng khi có dữ liệu; chèn cột thì phải dịch tham chiếu công thức); nhận cả `.xls` và sổ gộp nhiều tháng; biết hóa đơn "đã bị thay thế" thì KHÔNG cần vào sổ; **so hai bản HĐĐT** (thuế gửi ⇄ tự tải), **lọc hóa đơn cùng MST cùng ngày**, sheet **HÓA ĐƠN CHƯA KÊ** lọc sẵn; nhận cả sổ xuất chi tiết mặt hàng; **cân đối cột** (cộng cột lệch thì bóc do phí / chiết khấu / làm tròn / lệch thật, đánh dấu bằng công thức sống NGAY TRONG sheet bảng kê, không sửa số gốc) và quy tắc hóa đơn bán hàng mẫu số 2 không có thuế GTGT; công cụ kế toán không đọc DB | `src/features/doi-soat/**`, `src/lib/doiSoat*.ts` |

Không có file cho edge function / cron / job nền — **dự án không có**. Automation duy nhất ở DB là trigger `updated_at` (xem [03-database](03-database.md)).

> **Định hướng đợt 2026-08-22** (số hóa trọn chuỗi + tách 2 giao diện bộ phận + cutover 01/09): đọc trước [`trien-khai/flow-end-to-end-2-bo-phan.md`](../trien-khai/flow-end-to-end-2-bo-phan.md) để biết chuỗi đang đứt ở đâu, rồi mới vào 30/34/35.

## Frontmatter

Mỗi file mở đầu bằng `> Load khi:` + `covers:` + `last_verified:` + `ttl_days: 90`.
`covers:` trỏ source path thật để hook `.githooks/pre-commit` phát hiện doc lệch code: commit đụng file trong `covers` mà doc không đổi ⇒ cảnh báo. Sửa doc xong thì cập nhật `last_verified`.
