> Load khi: bắt đầu bất kỳ task nào trong repo này và chưa biết phải đọc file nào.
covers: docs/app-map/**
last_verified: 2026-08-06
ttl_days: 90

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
| [02-pages-navigation.md](02-pages-navigation.md) | 5 màn + Người dùng (admin) + Bộ giao diện, gate đăng nhập, state điều hướng | `src/App.tsx`, `src/main.tsx` |
| [03-database.md](03-database.md) | 16 bảng, quy ước đặt tên, `xi_nghiep_id`, 7 migration + thứ tự chạy, trigger | `supabase/migrations/**` |
| [04-tang-du-lieu.md](04-tang-du-lieu.md) | `useBang`, hàng chờ đồng bộ, hoà server↔local, seed, `vaDongCu`, đèn kết nối | `src/lib/repo.ts`, `src/lib/db.ts`, `src/lib/catalogRepo.ts`, `src/lib/connectivity.ts`, `src/lib/supabase.ts` |
| [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md) | Đăng nhập Supabase Auth + `nguoi_dung`/vai trò, gate, thiết lập admin, RLS mở `anon` chờ `0003` | `src/lib/auth.ts`, `src/lib/username.ts`, `src/features/auth/LoginScreen.tsx`, `src/features/users/UserManagementScreen.tsx`, `supabase/migrations/0006_nguoi_dung.sql`, `0003_siet_rls.sql` |
| [30-nhap-hang.md](30-nhap-hang.md) | Sổ nhập ngày: chuyến, hai ngày + ghi bù, chốt ngày, phế liệu ngày | `src/features/imports/MaterialImportScreen.tsx`, `src/types.ts` |
| [33-ban-hang.md](33-ban-hang.md) | Sổ bán ngày: phiếu bán, quy cách, hai ngày + ghi bù, kênh XK/NĐ, hút vào cân đối | `src/features/sales/SalesScreen.tsx`, `src/types.ts`, `src/lib/repo.ts` |
| [31-can-doi-ky.md](31-can-doi-ky.md) | Kỳ theo lô, 3 khối, công thức, hút phế liệu + hút bán, bản in A4 | `src/features/balancing/BalancingScreen.tsx`, `src/features/balancing/BalancingTable.tsx`, `src/lib/balancingCalc.ts` |
| [32-danh-muc.md](32-danh-muc.md) | 4 danh mục + 141 mã TP, lưu theo TÊN, seed vs nguồn thật | `src/features/catalog/CatalogScreen.tsx`, `src/features/catalog/FinishedGoodScreen.tsx`, `src/data/thanh-pham.json` |
| [34-btp-san-xuat-kho.ba-spec.md](34-btp-san-xuat-kho.ba-spec.md) | Sản xuất BTP (WIP) + kho dự trữ + đơn/xuất: mô hình tồn 5 chiều (kg + block), xả đông "hai chân một số hai sổ", gối đầu liên tục, ghi-ngược từ cân đối | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**`, `supabase/migrations/0011_wip_san_xuat_kho_don.sql` |
| [35-btp-ui.design-spec.md](35-btp-ui.design-spec.md) | Đặc tả giao diện BTP: 3 màn (Sản xuất ngày · Kho dự trữ · Đơn & lệnh xuất), tablet ngang xưởng lạnh | `src/features/production/**`, `src/features/warehouse/**`, `src/features/orders/**` |

Không có file cho edge function / cron / job nền — **dự án không có**. Automation duy nhất ở DB là trigger `updated_at` (xem [03-database](03-database.md)).

> **Định hướng đợt 2026-08-22** (số hóa trọn chuỗi + tách 2 giao diện bộ phận + cutover 01/09): đọc trước [`trien-khai/flow-end-to-end-2-bo-phan.md`](../trien-khai/flow-end-to-end-2-bo-phan.md) để biết chuỗi đang đứt ở đâu, rồi mới vào 30/34/35.

## Frontmatter

Mỗi file mở đầu bằng `> Load khi:` + `covers:` + `last_verified:` + `ttl_days: 90`.
`covers:` trỏ source path thật để hook `.githooks/pre-commit` phát hiện doc lệch code: commit đụng file trong `covers` mà doc không đổi ⇒ cảnh báo. Sửa doc xong thì cập nhật `last_verified`.
