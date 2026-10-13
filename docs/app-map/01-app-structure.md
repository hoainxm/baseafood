> Load khi: thêm file mới, không biết đặt ở đâu, hay chuẩn bị import xuyên tầng.
covers: src/**
last_verified: 2026-10-13
<!-- re-verified: 2026-10-13 09:40 — danh sách thư mục features đối chiếu `ls src/features` (FIX drift: còn ghi tên Việt cũ nhap-hang/san-xuat/… dù thư mục thật tiếng Anh); THÊM thư mục scripts/ (cổng đặt tên, Đợt 0). -->
<!-- updated: 2026-10-12 (b) — GỠ thư mục `features/quality/`, `features/traceability/`, `features/cold-storage/` + file `production/WorkOrderScreen.tsx`, `reports/ReportsScreen.tsx` (5 màn DEMO), `design-system/patterns/StatusChip.tsx` + `MockPatternData.tsx` (chỉ màn DEMO dùng); `patterns/SankeyChart*` + dep `d3-sankey` đã gỡ (thay bằng `ProportionBar.tsx` — `ProportionBar`). THÊM `lib/demoMode.ts` (chế độ demo — cờ + khóa/site, test), `lib/demoGenerator.ts` (bộ sinh demo, test; lib → lib: balancingCalc, inventory, dongChay), `features/shared/CheDoDemo.tsx` (DaiDemo · NapGoiDemo · KhoiCheDoDemo — App.tsx gắn 2 cái đầu ở ShellLayout, Tổng quan gắn cái cuối). `lib/db.ts` + `lib/supabase.ts` nay import `lib/demoMode.ts` (cheDo không import gì của app — tránh vòng). -->
<!-- updated: 2026-10-12 — Tổng quan "dòng chảy số liệu": THÊM `src/lib/dataFlow.ts` (hàm THUẦN + test: sankey kg, băng chuyền 5 khâu, tồn theo ngày, định mức theo mặt hàng, cảnh báo chuỗi — lib → lib: inventory, inventoryFinished, truyXuatLo, balancingCalc) · design-system thêm `patterns/ProportionBar.tsx` (`ProportionBar`), `PipelineStages.tsx`, `TimeSeriesChart.tsx`, `useContainerWidth.ts`. `features/dashboard/` XOÁ 6 file mock chết (AlertPanel, CommonWidget, KPICard, LineStatusWidget, WorkOrderTable, mockDashboardData); `DashboardScreen` import `@/features/shared/useDuLieuTruyXuat`. KHÔNG dep mới (bản đầu dùng `d3-sankey` cho sơ đồ dòng chảy — người dùng thấy khó hiểu, đã gỡ cùng ngày, thay bằng `ProportionBar`). Spec: ../spec/che-do-demo.md §5b. -->
<!-- updated: 2026-10-08 — truy xuất QR đợt 2b, KHÔNG thêm thư mục / đổi ranh giới import: `src/features/qr/` thêm `GiaiDoanTruyXuat.tsx` (tab Theo giai đoạn — thay `DoPhuTruyXuat.tsx` đã xóa) + `ThuHoiLo.tsx` (mục Thu hồi, nạp động `lib/reportXlsx` để xlsx không vào chunk chính); `src/features/production/KhoiLoPhien.tsx` (khối lô NL dùng cho phiên); `src/features/shared/GanLoDauVao.tsx` nay có lõi `LotInputDialog` + export thêm `GanLoXuat` (gắn lô cho hàng ra); `useDuLieuTruyXuat` gom 17 bảng; `src/lib/lotTraceability.e2e.test.ts` (kịch bản oracle đầu-cuối). `ReserveWarehouseScreen` / `SalesOrderScreen` đọc `useSearchParams` cho link mở thẳng hộp (`?duyet=` · `?don=&kiem=`). `lib/lotTraceability.ts` import `lib/inventory.ts` + `lib/format.ts` (lib → lib, đúng ranh giới). Không dep mới. -->
<!-- updated: 2026-10-06 (b) — design-system thêm `patterns/topScrollbar.tsx` (hook `useTopScrollbar` — thanh cuộn ngang TRÊN đồng bộ với khung cuộn) + `patterns/HorizontalScroll.tsx` (`HorizontalScroll` cho bảng tự dựng ở features, quy tắc 14); `features/balancing/ChuyenTrongO.tsx` (nút "n chuyến" trong ô ngày lưới Cân đối — thay khối `ChuyenTheoNgay` đã bỏ 2026-10-07) + `lib/dailyShipments.ts` (hàm thuần + test). Ranh giới import giữ nguyên. -->
<!-- updated: 2026-10-06 — TÔ MÀU DÒNG (mig 0055): design-system thêm `patterns/rowMarkSource.ts` (hợp đồng `RowMarkSource` + `RowMarkContext` + hook `useRowMarkTools` — KHÔNG gọi repo) và `patterns/RowMarkToolbar.tsx` (`RowMarkToolbar`, `RowMarkActions` — tick dòng → Tô màu / In đậm / Bỏ tô); `features/shared/ToMauProvider.tsx` (gắn MỘT lần ở ShellLayout, gọi `useRowMarks()` duy nhất); `lib/rowMarks.ts` (hàm thuần + test). Ranh giới giữ nguyên: features chỉ dùng prop `rowMarks` / `useRowMarkTools` từ `@/design-system`, không gọi `useRowMarks()`. -->
<!-- updated: 2026-10-02 — `src/features/catalog/` thêm `cauHinhDanhMuc.tsx` (cấu hình 5 danh mục, một nguồn) + `SuaDanhMucNhanh.tsx` (hook `useSuaDanhMuc` — bút chì sửa danh mục ở ô chọn). Feature khác import THẲNG file `@/features/catalog/SuaDanhMucNhanh` (KHÔNG qua index — index export màn Danh mục, kéo cả màn vào bundle). Design-system thêm `CatalogEditDialog` (CatalogCrudModal), `ONhapSo` + `useNumberInput` + `bieuThucSo` (ô số biểu thức). Bỏ `features/shared/SuaThanhPhamNhanh.tsx`. -->
ttl_days: 90

<!-- re-verified: 2026-09-14 12:00 — phân loại màn DEMO vs THẬT khớp code: DEMO_IDS = [production, quality, cold-storage, reports, traceability] (nav-access.ts:22). Dùng khi chuẩn hóa nhãn (giữ nhãn DEMO tách khỏi màn thật). (task đổi tên trang) -->
<!-- updated: 2026-09-18 — truy xuất lô QR: `src/lib/lotTraceability.ts` (hàm THUẦN: đọc mã QR 3 dạng, nhãn lô, tìm lô, truy ngược/xuôi, cân bằng kg, danh sách lô để chọn) · `src/features/shared/` thêm `GanLoDauVao.tsx` (hộp gắn lô đầu vào), `KhungQuetQr.tsx` (khung camera dùng chung, id riêng mỗi khung), `useDuLieuTruyXuat.ts` (gom 10 bảng), `QrTemLoIn.tsx` thêm `TemLoQr` (tem cho mọi loại lô). Spec: `docs/spec/qr-truy-xuat-lo.md`. Không dep mới. -->
<!-- updated: 2026-09-10 — THÊM feature `src/features/doi-soat/` (DoiSoatScreen + index) — Đối soát hóa đơn điện tử ⇄ phần mềm kế toán, route `/doi-soat`. Chỉ import `@/design-system` + `lib/einvoiceReconciliation.ts` (logic thuần: parse workbook + đối soát + xuất Excel) + `lib/format`. Đọc dữ liệu TỪ FILE EXCEL upload, KHÔNG qua repo/DB. Dep mới: `xlsx-js-style` (ghi Excel có màu; `xlsx` bản free không ghi được style). Xem 37-doi-soat-hddt.md. -->
<!-- re-verified: 2026-09-09 16:30 — ranh giới import (quy tắc 3): features/shared/AppShell.tsx + UpdateBanner.tsx chỉ import @/design-system + @/lib, KHÔNG @/components/ui — khớp. (task thêm animation) -->
<!-- re-verified: 2026-09-09 15:00 — src/features/monthly-stock/MonthlyStockScreen.tsx KHÔNG import thẳng @/components/ui (chỉ @/design-system + @/lib) — khớp ranh giới import (quy tắc 3). -->
<!-- updated: 2026-09-09 — THÊM feature `src/features/monthly-stock/` (MonthlyStockScreen + index) — Sổ kho theo THÁNG dương lịch, route `/ton-kho-thang`. Chỉ import `@/design-system` + hook `catalogRepo` (useMonthlyStock) + `lib/monthlyStock.ts` (toán thuần) + `lib/format`, `lib/db` (uid). Dồn tồn cuối kỳ → đầu kỳ sau. Xem 36-so-kho-thang. -->
<!-- updated: 2026-09-05 — (họp 2026-09-02 QĐ-8) THÊM feature `src/features/quality-check/` (QcChecklistScreen + index) — màn Kiểm tra QC chấm điểm cuối ngày, route `/qc`. Chỉ import từ `@/design-system` + hook `catalogRepo` (useQcChecklists/useQcLocks). -->

<!-- updated: 2026-09-05 — (đợt 2) THÊM `src/features/qr/` (QrTraCuuScreen — quét/tra lô QR, route /qr) + `src/features/shared/QrTemLoIn.tsx` (tem QR in được, export từ shared) + `src/lib/qr.ts` (render QR dataURL, bọc `qrcode`). PWA: `public/manifest.webmanifest` + `public/sw.js` + `public/icons/`. Dep mới: `qrcode`, `html5-qrcode`. -->

# Cấu trúc mã nguồn

```
src/
├── main.tsx                 điểm vào; nạp index.css + applyDisplaySettings() TRƯỚC khi vẽ (tránh nhảy cỡ chữ)
├── App.tsx                  cấu hình định tuyến và route guards (xem 02-pages-navigation.md)
├── types.ts                 KIỂU + BẤT BIẾN nghiệp vụ (laGhiBu, thanhTien) — không phải file kiểu thuần
├── data/thanh-pham.json     141 mã TK 1551 — chỉ là SEED, không đọc trực tiếp trong màn
├── lib/
│   ├── repo.ts              tầng dữ liệu (Supabase↔localStorage) — 04-tang-du-lieu.md
│   ├── catalogRepo.ts       hook từng bảng (useNhapNL, useKyCanDoi…) + seed
│   ├── db.ts                bộ đệm localStorage cấp thấp — MÀN HÌNH KHÔNG GỌI
│   ├── supabase.ts          client env-gated + SITE_ID
│   ├── connectivity.ts      trạng thái kết nối dùng chung (đèn xanh/đỏ)
│   ├── balancingCalc.ts     công thức cân đối thuần — 31-can-doi-ky.md
│   ├── dailyShipments.ts   gom dòng sổ nhập của một ngày → đại lý → chuyến (Cân đối, chỉ đọc) — 31-can-doi-ky.md
│   ├── rowMarks.ts             tô màu dòng "đã dò": id dấu tất định, gom/đặt dấu (row_marks) — README design-system § Tô màu dòng
│   ├── auth.ts              useAuth + Supabase Auth — 05-bao-mat-phan-quyen.md
│   ├── username.ts          họ tên → username + email tổng hợp
│   ├── format.ts            num/kg/todayISO/viDate (locale vi-VN)
│   ├── devicePrefs.ts       readDevicePref/writeDevicePref (+ `…Json`) — cài đặt giao diện THEO MÁY (không phải số liệu); màn hình dùng cái này thay vì gọi localStorage (luật 4)
│   ├── store.ts             newId()
│   └── utils.ts             cn()
├── components/ui/           primitive shadcn (style radix-nova), ĐÃ đè size cho người lớn tuổi
├── design-system/           bộ giao diện — luật ở src/design-system/README.md
│   ├── tokens.css           NƠI DUY NHẤT định cỡ chữ / màu / chiều cao ô
│   ├── patterns/            Field, NumberField, Combobox, DateField, RecordTable, CatalogCrud…
│   ├── kit/KitPage.tsx      trang duyệt bộ giao diện (đưa người dùng thật bấm thử)
│   └── index.ts             cửa import DUY NHẤT cho features
└── features/                thư mục chức năng chia theo route (.DS_Store, audit, auth, balancing, catalog, dashboard, doi-soat, imports, monthly-stock, orders, packaging, production, qr, quality-check, reports, sales, shared, users, warehouse)

scripts/                     công cụ dev chạy bằng node, KHÔNG vào bundle app
├── check-naming.mjs         cổng quy ước đặt tên (pre-commit --staged · CI --check ratchet) — ../spec/quy-uoc-dat-ten.md
├── naming-baseline.json     số tên tiếng Việt còn nợ theo lớp; chỉ được giảm (`npm run naming:update` sau mỗi đợt dọn)
└── naming/lexicon.mjs       bộ nhận diện tên Việt không dấu (hàm thuần + lexicon.test.mjs)
```

**Đặt tên file / thư mục / định danh mới:** tiếng Anh theo [`spec/quy-uoc-dat-ten.md`](../spec/quy-uoc-dat-ten.md) §2 (component `PascalCase.tsx`, module `camelCase.ts`, thư mục `kebab-case`). Tên Việt có sẵn trong cây trên là nợ đang dọn theo đợt, không phải mẫu — pre-commit chặn tên Việt MỚI.

## Ranh giới import (cứng)

```
features → design-system → components/ui → tokens.css
features → lib/catalogRepo → lib/repo → lib/db + lib/supabase
```

- `src/features/**` **chỉ** import từ `@/design-system`. Cấm `@/components/ui/*` trực tiếp — hook pre-commit chặn.
- `src/features/**` **không** gọi `localStorage`, không gọi `supabase` trực tiếp; luôn qua hook trong `lib/catalogRepo.ts`.
- `lib/db.ts` chỉ có `repo.ts` được gọi.
- Alias `@/*` → `src/*` (`tsconfig.app.json` + `vite.config.ts`) — dùng alias, không dùng đường dẫn tương đối dài.

## Hai ngoại lệ, đừng lấy làm mẫu

| File | Vì sao ngoại lệ |
|---|---|
| `src/features/balancing/BalancingTable.tsx` | Bản in theo mẫu giấy A4 — cố tình dùng `text-sm`, `uppercase`, màu `slate` cứng. Luật design-system KHÔNG áp vào đây. |
| `src/components/ui/**` | Tầng primitive, được phép viết class cỡ chữ/màu. Sửa size ở đây khi thêm component mới (mặc định shadcn `h-8`/`h-9` là quá nhỏ). |

## Nơi hay đặt sai

- Công thức nghiệp vụ mới → `src/lib/*.ts` thuần, không nhét vào component (xem `balancingCalc.ts` làm mẫu: không import React).
- Bất biến nghiệp vụ dùng ở ≥2 màn (`laGhiBu`, `thanhTien`) → `src/types.ts`, cạnh interface nó ràng buộc.
- Pattern UI mới → `design-system/patterns/` + export ở `design-system/index.ts`; **không** viết component dùng chung trong `features/`.
- Hai file sinh id: `lib/db.ts#uid` và `lib/store.ts#newId` — **cùng thuật toán, trùng nhau**. Dùng lại cái file bên cạnh đang dùng; đừng thêm cái thứ ba (cần dọn, chưa dọn).

## Cross-references

- Luật UI + bảng chọn component: [`src/design-system/README.md`](../../src/design-system/README.md)
- Điều hướng: [02-pages-navigation.md](02-pages-navigation.md)
- Tầng dữ liệu: [04-tang-du-lieu.md](04-tang-du-lieu.md)
