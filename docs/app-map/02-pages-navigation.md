> Load khi: thêm/bớt màn hình, đổi điều hướng, header, hay tìm xem một màn được gắn vào đâu.
covers: src/App.tsx, src/features/shared/AppShell.tsx, src/features/my-tasks/MyTasksScreen.tsx, src/features/shared/AccountMenu.tsx, src/features/admin/AdminHomeScreen.tsx, src/features/shared/NotFound.tsx, src/features/shared/guideContent.tsx, src/lib/nav-access.ts, src/lib/permissions.ts, src/features/shared/PermissionProvider.tsx
last_verified: 2026-10-19
<!-- updated: 2026-10-19 — THÊM route `/my-tasks` "Việc của tôi" (features/my-tasks, màn THẬT): mục nav ĐẦU TIÊN (nhóm 1 màn, hiện thẳng), số đỏ trên mục = việc đang được giao cho tôi (`ShellNavItem.badge`); chuông header bỏ số giả `3` ⇒ cùng số đó, bấm mở `/my-tasks`. Tài nguyên quyền `my-tasks` (ai có quyền ở đâu đó cũng xem). Link mở thẳng ngày `?date=&workshop=` ở `/imports` `/wip` `/packaging`. Chi tiết: 39-my-tasks.md. -->
<!-- updated: 2026-10-15 (d) — Đợt 4: tập màn từng vai trò theo ma trận §7. -->
<!-- updated: 2026-10-15 (c) — khu Quản trị (/admin, /roles) + menu tài khoản ở avatar. -->
<!-- updated: 2026-10-15 (b) — nút Đăng xuất luôn hiện trên header ở mọi cỡ màn. -->
<!-- updated: 2026-10-15 — Đợt 1 phân quyền (spec/role-permissions.md): nav + chặn URL theo quyền `view` của lib/permissions.ts (tập màn từng vai trò KHÔNG đổi); chưa gán vai trò ⇒ màn "Chưa được cấp quyền"; chờ nạp hồ sơ ⇒ "Đang tải quyền truy cập…"; PermissionProvider bọc Outlet. -->
<!-- updated: 2026-10-13 — Đợt 4 đặt tên: 6 route tiếng Việt → tiếng Anh + redirect vĩnh viễn, ?tab= và tham số mới (đọc cả cũ), id nav/gate đổi đồng bộ có test. -->
<!-- re-verified: 2026-10-12 15:20 — AppShell: thu/mở sidebar (thuGon), header/sidebar/drawer cùng chiều cao, drawer chân nút toàn cục; FIX drift `h-20` → thật là `h-16`, nay là token `h-header`. -->
<!-- updated: 2026-10-12 — XOAY NGANG iPhone/iPad: thanh bên TỰ thu về dải icon ở 768–1023px (iPhone ngang, iPad dọc; `useMediaQuery(MEDIA_NARROW_SIDEBAR)`), bấm nút thu/mở vẫn theo ý người dùng trong cùng cỡ màn. Chiều cao header = token `--spacing-header` (`h-header`/`top-header`), máy ngang thấp (cao ≤ 500px) thu 4rem→3rem + ẩn dòng breadcrumb + đệm trang 16px + chân drawer bỏ dòng tên. Khung có vùng an toàn tai thỏ/thanh Home (`px-safe`, `pb-safe`). Đổi màn: fade `enter-fade` (chỉ opacity). Không đổi route/nav/gate. -->
<!-- updated: 2026-10-12 (b) — GỠ 5 màn DEMO (`/production`, `/quality`, `/cold-storage`, `/reports`, `/traceability`): xóa khỏi KIT_NAV + CAY_NAV, route giữ lại chỉ để CHUYỂN HƯỚNG link cũ (→ `/wip`, `/qc`, `/warehouse`, `/dashboard`, `/qr`). `DEMO_IDS` / `laDemo` / `demoGuard` đã bỏ (cờ `demo` trên mục nav còn trong code nhưng không mục nào dùng). CHẾ ĐỘ DEMO thay thế: `ShellLayout` gắn `DemoModeBanner` (dải vàng dính dưới header, luôn hiện khi demo) + `NapGoiDemo`; `/users` khi đang demo hiện thông báo "thoát demo để quản lý người dùng"; người không phải admin bật cờ demo trên máy ⇒ tự tắt. Tổng quan có khối "Chế độ demo" (admin). Spec: ../spec/che-do-demo.md. -->
<!-- updated: 2026-10-12 — `/dashboard` (Tổng quan) dựng lại thành "dòng chảy số liệu" (spec ../spec/che-do-demo.md §5b): bộ lọc kỳ + xưởng, 8 thẻ KPI, thanh lọc gọn một hàng (kỳ bấm nhanh · lùi/tiến · xưởng), thẻ tô màu theo loại số, băng chuyền 5 khâu, hai thanh chia phần "nguyên liệu đi đâu" (thay sankey), việc cần đốc (mở đúng màn sửa), nhập/SX + tồn theo ngày, kết quả các kỳ cân đối, định mức theo mặt hàng, tồn theo kho NXT. Bỏ bảng "Biến động lớn trong kỳ". Route / nhãn nav / gate KHÔNG đổi. -->
<!-- re-verified: 2026-10-08 14:30 — guideContent.qr chỉ sửa câu "Mã lô là gì" (lô NL = mỗi loại NL của chuyến, mỗi tem một loại); route / nav / gate / tab `/qr` KHÔNG đổi. -->
<!-- updated: 2026-10-08 (b) — `/qr` 3 tab: **Tra lô** · **Theo giai đoạn** (`?tab=giai-doan`, TraceStagesView: 5 khâu nhập NL → SX → nhập kho → đóng gói → xuất/bán, trạng thái từng lô + nút làm tại chỗ) · **In tem hàng loạt** (`?tab=in`). Tab "Độ phủ" (`?tab=do-phu`, có vài giờ) GỘP vào Theo giai đoạn — link cũ vẫn mở tab mới. Điện thoại (< sm) nhãn ngắn "Tra lô · Giai đoạn · In tem", bỏ icon. LINK MỞ THẲNG HỘP (deep-link, gỡ tham số sau khi xử lý): `/warehouse?approve=W:<id mẻ>` ⇒ hộp Duyệt nhập kho đúng mẻ; `/orders?order=<id đơn>&check=<id lệnh xuất>` ⇒ mở đơn + hộp Kiểm lô. `?lot=` vẫn luôn mở tab Tra. Hộ chiếu lô có mục Thu hồi (LotRecall). Route / nhãn nav / gate KHÔNG đổi. Chi tiết: ../spec/qr-truy-xuat-lo.md §6d. -->
<!-- updated: 2026-10-06 — `ShellLayout` (App.tsx) bọc `<Outlet>` trong `ToMauProvider` (features/shared): một nguồn dấu tô màu dòng `row_marks` (mig 0055) cho mọi bảng trên mọi màn. Không đổi route/nav. -->
<!-- re-verified: 2026-09-14 12:00 — KIT_NAV labels (AppShell.tsx:82-106) + CAY_NAV nhóm (nav-access grouping) + tieuDe header lấy TỪ label (App.tsx:108 `tieuDe={current?.label}`) đối chiếu khớp code. -->
<!-- updated: 2026-10-02 — `/qr`: nhãn nav "Quét mã lô" → **"Mã lô QR"** (id/route/gate KHÔNG đổi); màn có 2 tab Tra lô · In tem hàng loạt (`?tab=in`, `?lot=` luôn mở Tra); guideContent.qr viết lại (bỏ chỉ dẫn tab "Sổ ngày" đã xóa 21/09). Chi tiết: ../spec/qr-truy-xuat-lo.md §6b. -->
<!-- updated: 2026-09-18 — `/qr` nâng thành HỘ CHIẾU LÔ (truy xuất trọn chuỗi): nhận `?lot=<mã>` trên URL (useSearchParams) ⇒ camera điện thoại quét tem QR (nay là đường link `…/#/qr?lot=W:<id>`) mở THẲNG màn này; link chia sẻ được. Hiện: lô là gì · cân bằng khối lượng · truy NGƯỢC (TP→BTP→NL→đại lý) · truy XUÔI (NL→mẻ→đóng gói/lệnh xuất→khách) · in lại tem. Nhãn nav giữ "Quét mã lô", route/gate KHÔNG đổi. Nút mới ở /wip (Gắn lô NL · Tem) và /packaging (Gắn lô BTP · Tem). Thiết kế: ../spec/qr-truy-xuat-lo.md. -->
<!-- updated: 2026-09-14 — FIX tên trang bị cắt ở sidebar: nhãn nav BỎ `truncate`, cho tự xuống dòng (`whitespace-normal break-words leading-tight` ở MucNut) → hiện ĐỦ tên. Sidebar mở rộng nới `w-64`→`w-72` để nhãn thường vẫn gọn 1 dòng. Nút nav là `min-h-10 items-center` nên 2 dòng không bị cụt. Thu gọn (`w-20`) icon-only không đổi. -->
<!-- updated: 2026-09-15 — KIT_NAV thêm trường `moTa` (câu hướng dẫn hover): rê chuột lên mục nav ra câu "màn này để làm gì", MucNut đặt vào `title` (khi sidebar THU GỌN thì ghép "nhãn — mô tả" vì không thấy chữ). `gomCay()` mang `moTa` sang `MucCon` ở cả nhánh `{ref}` lẫn nhánh "Khác"; deep-link danh mục TRACUU dùng câu cố định. **Thêm màn mới ⇒ viết luôn `moTa`** — luật chung cho mọi nút thao tác ở src/design-system/README.md §9. Không đổi route, không đổi nhãn. -->
<!-- updated: 2026-09-15 — nhóm nav "Kho" thêm deep-link TRACUU("storage-locations") → `/catalog?tab=storage-locations` (tab danh mục MỚI "Kho lưu trữ": kho nhà + kho lạnh thuê ngoài, dùng cho cột "Kho lưu" ở /nxt-warehouse). KHÔNG thêm route mới — vẫn ~20 route, danh mục vẫn MỘT nguồn `/catalog`, gate theo gateId="catalog" như các TRACUU khác. Xem 32-danh-muc. -->
<!-- updated: 2026-09-14 — CHUẨN HÓA NHÃN TRANG theo microcopy (src/design-system/noi-dung-va-label.md): bỏ viết tắt & qualifier kỹ thuật, nhất quán họ báo cáo. Đổi 11 nhãn KIT_NAV: balancing "Cân đối"→"Cân đối kỳ"; bc-thanh-pham "BC Thành phẩm"→"Báo cáo thành phẩm"; bc-don-xuat "BC Đơn xuất"→"Báo cáo đơn xuất"; nxt-nl "Tồn kho NL"→"Tồn kho nguyên liệu"; nxt "Báo cáo NXT"→"Tồn kho thành phẩm"; nxt-kho "XNT kho (số thật)"→"Nhập xuất tồn kho" (giữ "Nhập xuất tồn" cho sổ tổng hợp; 2 báo cáo NL/TP để "Tồn kho X" ngắn hơn, không cụt chữ phân biệt khi sidebar rút gọn); doi-soat "Đối soát HĐĐT"→"Đối soát hóa đơn điện tử"; qr "Quét lô (QR)"→"Quét mã lô"; reports(DEMO) "Báo cáo"→"Báo cáo tổng"; traceability(DEMO) "Truy xuất"→"Truy xuất nguồn gốc"; audit "Nhật ký"→"Nhật ký thao tác". Id/route KHÔNG đổi (deep-link, guideContent key giữ nguyên). guideContent tieuDe đồng bộ cho balancing/nxt/qr. FIX drift: bảng route cũ nhầm /production↔/wip. -->
<!-- updated: 2026-09-10 — THÊM route `/reconciliation` "Đối soát HĐĐT" (features/reconciliation, màn THẬT — KHÔNG demoGuard, KHÔNG gate bộ phận nên kế toán/admin thấy): KIT_NAV icon FileCheck2 (AppShell), CAY_NAV nhóm "Báo cáo & Cân đối". Đối soát hóa đơn điện tử (cổng thuế) ⇄ phần mềm kế toán TỪ FILE EXCEL upload (không đọc DB/repo). Xem 37-doi-soat-hddt.md. ~21 route. -->
<!-- re-verified: 2026-09-09 16:30 — AppShell.tsx là khung THẬT: <main> bọc children trong <div key={active}> fade khi đổi route (AppShell.tsx ~789) — khớp code. (task thêm animation) -->
<!-- re-verified: 2026-09-09 15:00 — route /monthly-stock: App.tsx:182 + lazy:43, KIT_NAV AppShell:99, CAY_NAV nhóm Kho:168, gate DEPT_NHAP_HANG (nav-access.ts:13) — khớp code. -->
<!-- updated: 2026-09-09 — THÊM route `/monthly-stock` "Sổ kho theo tháng" (features/monthly-stock, màn THẬT) nhóm nav "Kho"; gate DEPT_NHAP_HANG. Sổ kho theo THÁNG dương lịch, dồn tồn cuối kỳ → đầu kỳ sau. Xem 36-so-kho-thang.md. ~20 route. -->
<!-- updated: 2026-09-06 — (A) NAV: gom deep-link danh mục về MỘT mục "Tra cứu"/module (helper TRACUU, icon Search) thay 1-mục-mỗi-tab (bỏ Đại lý+Loại NL riêng ở Nhập hàng…) — danh mục vốn 1 trang nhiều tab; "Danh mục" đầy đủ vẫn ở Hệ thống. gomCay: BỎ nhánh deep-link mồ côi khi module không có màn thật nào (vai trò bộ phận). (B) FORM-FIRST: /imports + /wip đổi "trang quản lý + Dialog nhập" → toggle 2 chế độ "📝 Ghi nhập" (form inline, tự mở phiếu trống, KHÔNG modal) ↔ "📖 Sổ ngày[& báo cáo]"; form dùng lại 100% logic (luuPhien/chốt/phế liệu), ngày+xưởng của phiếu đồng bộ về bộ lọc (2 useEffect). Bỏ Dialog ghi. Xem 30-nhap-hang + 34-btp. -->
<!-- re-verified: 2026-09-05 — nav-access gate (allowedIds/homeFor/DEMO) khớp source; App.tsx lọc KIT_NAV theo quyền + demoGuard giữ nguyên. -->
<!-- updated: 2026-09-05 — (A1 họp 2026-09-02 QĐ-9) NAV CÂY module-centric: NHOM_NAV (danh sách phẳng ids) → CAY_NAV (cây gập/mở, mỗi nhóm = module, con = màn + DEEP-LINK tra danh mục ngay trong module). AppShell: gomCay() phân giải cây theo `items` đã lọc quyền; CayNav render nhóm gập/mở (nhớ trạng thái ở localStorage `bsf1:nav-nhom`, mặc định MỞ; nhóm 1 màn hiện thẳng, không tiêu đề); thu gọn sidebar (thuGon) = icon-only, bỏ deep-link danh mục. Deep-link danh mục = `catalog?tab=<tab>` (gateId="catalog" để giữ gate 2 bộ phận). App.tsx truyền `activeTab` (searchParams `tab`) để tô sáng đúng deep-link; onSelect navigate(`/${target}`) nhận cả path có query. CatalogScreen điều khiển tab bằng `useSearchParams` (?tab=) — MỘT nguồn danh mục, chỉ đổi tab. `index.ts` export CAY_NAV (thay NHOM_NAV). -->
ttl_days: 90
<!-- updated: 2026-08-27 — thêm route /nxt-warehouse (WarehouseNxtScreen, "XNT kho (số thật)") nhóm Báo cáo — báo cáo Xuất–Nhập–Tồn dựng từ snapshot số thật. + ẨN MÀN DEMO: lib/nav-access.ts DEMO_IDS = [production, quality, cold-storage, reports, traceability] + laDemo(); App.tsx lọc nav non-admin (auth.laAdmin ? base : base.filter(!laDemo)) + demoGuard bọc 5 route (non-admin → homeFor); AppShell KIT_NAV cờ demo:true + badge "DEMO". Dashboard /dashboard KHÔNG ẩn (tổ chức lại số thật). -->
<!-- updated: 2026-08-24 — thêm /audit (AuditLogScreen, CHỈ admin) nhóm Hệ thống; App set datNguoiThaoTac theo tài khoản -->
<!-- updated: 2026-08-24 — thêm 2 màn báo cáo khép vòng: /production-report (DailyProductionReport) + /export-report (OrderExportReport), xếp nhóm Báo cáo cùng nxt-nl/nxt -->
<!-- updated: 2026-08-23 — phân quyền nav theo vai trò (2 giao diện bộ phận): ShellLayout lọc KIT_NAV + guard theo allowedIds(), route "/" → homeFor(roles), đều ở src/lib/nav-access.ts -->
<!-- updated: 2026-08-23 — thêm route /packaging (Đóng gói BTP→TP, G3) + mục nav "Đóng gói" nhóm Sản xuất -->
<!-- re-verified: 2026-08-10 14:00 — AppLayout header (DisplaySettingsButton/NutTrangThai/NutHuongDan) + thu/mở sidebar (KEY_THU_GON) + fix logo đè khớp source -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: guideContent.tsx, ImportTab/SalesTab, MaterialImportScreen/ImportReport/SalesScreen/SalesReport/BalancingTable/FinishedGoodScreen, @/lib/catalogRepo (symbol GuideButton/NutGiaoDien/CaiDatHienThi giữ nguyên) -->
<!-- re-verified: 2026-08-17 — khung THẬT là AppShell.tsx (AppLayout.tsx đã XOÁ, là khung chết không ai import); nav dọc gom 6 nhóm (KIT_NAV + NHOM_NAV) dùng chung sidebar/drawer; bottom-tab điện thoại đã bỏ -->

<!-- updated: 2026-09-05 — (họp 2026-09-02 QĐ-8) THÊM route `/qc` "Kiểm tra QC" (features/quality-check, màn THẬT — KHÔNG demoGuard): KIT_NAV icon ClipboardCheck, nhóm nav "Sản xuất", gate qua DEPT_SAN_XUAT (nav-access.ts). ~18 route. -->

<!-- updated: 2026-09-05 — (đợt 2) THÊM route `/qr` "Quét lô (QR)" (features/qr, màn THẬT) — nhóm nav "Kho", gate cả DEPT_NHAP_HANG + DEPT_SAN_XUAT. PWA: index.html thêm manifest + viewport khóa zoom + theme-color; SW đăng ký ở PROD (main.tsx). ~19 route. -->

# Trang & điều hướng

**Có định tuyến (Router).** Ứng dụng sử dụng `react-router-dom` v7 (`HashRouter` để tối ưu chạy offline tại xưởng). Đường dẫn + `NAV` dùng **id tiếng Anh** (`imports`, `sales`, `warehouse`…) — id của mục nav CHÍNH LÀ path (`to={/${id}}`), nên id phải khớp `Route path` trong `App.tsx`, nếu lệch thì menu bấm ra NotFound. Refresh (F5) giữ trạng thái, dùng Back/Forward, deep link như `#/balancing/:periodId`.

## Gate đăng nhập

`App.tsx` gọi `useAuth()` (`src/lib/auth.ts`) TRƯỚC khi khởi tạo Router. Nếu đang tải phiên $\rightarrow$ màn "Đang tải"; chưa có phiên đăng nhập $\rightarrow$ render `LoginScreen.tsx` chặn toàn app. Chi tiết auth: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md).

## Khung: `AppShell.tsx`

> ⚠️ Khung THẬT là `src/features/shared/AppShell.tsx`. `AppLayout.tsx` (khung cũ, không ai import) **đã xoá** ngày 2026-08-17 — đừng đi tìm nó.

Bố cục: **nav dọc gom nhóm** · **header trên** · nội dung phải.

- **Desktop (≥ md)**: nav là sidebar trái, thu/mở được.
- **Điện thoại (< md)**: nav là **drawer trượt trái**, mở bằng nút `☰` ở header, đóng bằng nền mờ hoặc `Esc`. **Không còn bottom-tab.**

Cả hai dùng CHUNG một cây nav (`CayNav`) dựng từ `KIT_NAV` (danh sách phẳng: icon/nhãn/cờ demo, `id` = path) + **`CAY_NAV`** (cây module-centric gập/mở). Mỗi nhánh = một module; con của nhánh gồm **các màn** (`{ ref }` → trỏ id trong `KIT_NAV`) và **deep-link tra danh mục** (`catalog?tab=…`) NGAY trong module:

| Nhóm (module) | Con — màn + (deep-link danh mục) |
|---|---|
| Việc của tôi | `my-tasks` (đứng đầu; số đỏ = việc đang được giao cho tôi) |
| Tổng quan | `dashboard` |
| Nhập hàng | `imports` · `nxt-nl` · (**Tra cứu** → `catalog?tab=suppliers`) |
| Sản xuất | `wip` · `packaging` · `qc` · (**Tra cứu** → `catalog?tab=products`) |
| Kho | `warehouse` · `ton-kho-thang` · `qr` · `nxt-kho` · (**Tra cứu** → `catalog?tab=storage-locations`) |
| Kinh doanh | `sales` · `orders` · (**Tra cứu** → `catalog?tab=customers`) |
| Báo cáo & Cân đối | `balancing` · `bc-thanh-pham` · `bc-don-xuat` · `nxt` · `doi-soat` |
| Hệ thống | `catalog` (danh mục đầy đủ) · `users` (chỉ admin) · `audit` (chỉ admin) |

- **Gập/mở**: mỗi nhóm là nút gập/mở (chevron), nhớ trạng thái theo máy (`localStorage bsf1:nav-nhom`, mặc định MỞ). Nhóm chỉ 1 màn (Tổng quan) hiện thẳng, không có tiêu đề gập.
- **Tra cứu (deep-link danh mục)**: mỗi module có MỘT mục "Tra cứu" mở đúng tab liên quan của `/catalog` qua `?tab=` (helper `TRACUU`, icon `Search`) — **MỘT nguồn danh mục duy nhất** (không nhân bản, không tách 1-mục-mỗi-tab), `CatalogScreen` đọc tab bằng `useSearchParams`. Kiểm quyền theo `gateId="catalog"`, nên gate 2 bộ phận (`nav-access.ts`) không vỡ. `gomCay` bỏ nhánh Tra cứu **mồ côi** khi module không có màn thật nào người dùng thấy.
- Mục có trong `KIT_NAV` (đã lọc quyền) nhưng thiếu trong `CAY_NAV` rơi vào nhóm **"Khác"** — không mất, nhưng là dấu hiệu quên xếp nhánh.
- Thu gọn sidebar (`thuGon`, chỉ desktop) = icon-only: bỏ deep-link danh mục (còn nút Danh mục đầy đủ), bỏ qua trạng thái gập.

### Header

Cụm trái (`☰` · logo · tiêu đề) được ưu tiên ngân sách ngang (`min-w-0 flex-1`). Cụm phải `shrink-0` nhưng **trên điện thoại chỉ giữ `DataSyncStatusButton` + `GuideButton`**; đổi ca · thông báo · giao diện · tài khoản · đăng xuất dời xuống **chân drawer**. Trên desktop hiện đủ:

| Nút | Component (design-system) | Hành vi |
|---|---|---|
| Hướng dẫn "?" | `GuideButton` | Chỉ hiện ở trang có trong `guideContent.tsx` (registry route→nội dung). Mở hộp hướng dẫn dùng trang đó. |
| Tùy chỉnh giao diện 🎨 | `DisplaySettingsButton` | Mở `DisplaySettingsPanel` (cỡ chữ · mật độ · bề rộng). Lưu **theo username** (`taiKhoan` prop). |
| Trạng thái máy chủ | `DataSyncStatusButton` | Màu theo store `ketNoi`. Hover/bấm mở popover chi tiết + **Thử kết nối lại** (`probeKetNoi`). |
| Tài khoản | `features/shared/AccountMenu.tsx` (trong `AppShell`) | **Avatar ở góc phải header, MỌI cỡ màn** (tên + vai trò hiện từ xl). Bấm ⇒ menu: tên · @username · vai trò · **Tùy chỉnh giao diện** (thay nút 🎨 cũ trên header) · **Đổi mật khẩu** (khi đăng nhập máy chủ) · **Quản trị hệ thống** (admin ⇒ `/admin`) · **Đăng xuất** (hỏi xác nhận). Hộp thoại mở sau khi đóng menu. Chân drawer điện thoại chỉ còn Ca + Thông báo. |

Cỡ chữ / trạng thái kết nối **không còn ở chân sidebar** (đã dời hết lên header). Đổi tài khoản → `ShellLayout` trong `App.tsx` gọi `applyDisplaySettings(username)` nạp lại giao diện của người vừa đăng nhập.

**Thu/mở sidebar** (chỉ desktop): nút `PanelLeft` bên trái header đổi `thuGon`. **Mặc định tự thu** ở bề rộng 768–1023px (iPhone xoay ngang, iPad dọc — `MEDIA_NARROW_SIDEBAR`); ≥ 1024px mặc định mở. Người dùng bấm thu/mở thì giữ ý họ cho tới khi xoay sang cỡ màn khác. Thu ⇒ sidebar `w-20`, nav chỉ còn icon (nhãn vào `title`, tiêu đề nhóm thay bằng đường kẻ), logo icon-only. Chuẩn form: `FormDialog` (design-system) — mọi dialog thông tin/thao tác đi qua khung này.

## Các màn & Cấu trúc Route

| Path | id NAV | Nhãn | File chính | Ghi chú |
|---|---|---|---|---|
| — | — | Đăng nhập | `features/auth/LoginScreen.tsx` | Màn chặn đăng nhập toàn app (không có route, gate ở `App.tsx`) |
| `/my-tasks` | `my-tasks` | Việc của tôi | `features/my-tasks/MyTasksScreen.tsx` | Việc cần làm của người đăng nhập: được giao · theo quyền + phạm vi · đã giao; hạn + quá hạn; Mở việc tới đúng màn + ngày. Xem [39-my-tasks.md](39-my-tasks.md) |
| `/imports` | `imports` | Nhập hàng | `features/imports/ImportTab.tsx` | Mặc định khi mở app. Bọc 2 tab: **Sổ** (`MaterialImportScreen`) + **Báo cáo** (`ImportReport`) |
| `/wip` | `wip` | Sản xuất thành phẩm | `features/production/WipProductionScreen.tsx` | Màn THẬT — ghi sản lượng thành phẩm ngày (WIP). Nhãn dùng "thành phẩm" khớp copy trong màn |
| `/sales` | `sales` | Bán hàng | `features/sales/SalesTab.tsx` | Bọc 2 tab: **Sổ** (`SalesScreen`) + **Báo cáo** (`SalesReport`) |
| `/warehouse` | `warehouse` | Kho dự trữ | `features/warehouse/ReserveWarehouseScreen.tsx` | Duyệt nhập kho, theo dõi tồn đông |
| `/orders` | `orders` | Đơn đặt | `features/orders/SalesOrderScreen.tsx` | Gom đơn và lệnh xuất |
| `/balancing` | `balancing` | Cân đối kỳ | `features/balancing/BalancingScreen.tsx` | Danh sách kỳ. "Báo cáo" = bảng in A4 sẵn có (`BalancingTable`) |
| `/balancing/:periodId` | — | Chi tiết kỳ | `features/balancing/BalancingScreen.tsx` | Chi tiết kỳ (URL param thay `selId`) |
| `/catalog` | `catalog` | Danh mục | `features/catalog/CatalogScreen.tsx` | 5 tab (render thêm `FinishedGoodScreen.tsx`) |
| `/users` | `users` | Người dùng | `features/users/UserManagementScreen.tsx` | **Chỉ Admin** (Route Guard + chỉ admin thấy trong NAV) |
| `/audit` | `audit` | Nhật ký thao tác | `features/audit/AuditLogScreen.tsx` | **Chỉ Admin** — đọc `audit_log` (nhật ký thao tác); lọc + xuất Excel. Xem [04-tang-du-lieu.md](04-tang-du-lieu.md) §Nhật ký |
| `/kit` | — | Bộ giao diện | `design-system/kit/KitPage.tsx` | Trang demo component. **Đã gỡ khỏi sidebar** — vào bằng URL, desktop-only |

Ngoài bảng trên: `/dashboard` (Tổng quan — **dòng chảy số liệu**, `features/dashboard/DashboardScreen.tsx`, số từ `lib/dataFlow.ts`; có khối "Chế độ demo" cho admin). Năm màn DEMO dữ liệu mẫu cũ (`/production`, `/quality`, `/cold-storage`, `/reports`, `/traceability`) **đã gỡ** — route chỉ còn để chuyển link cũ sang màn thật.

Sổ kho theo THÁNG dương lịch: `/monthly-stock` (`features/monthly-stock/MonthlyStockScreen.tsx` — dồn tồn cuối kỳ tháng N → tồn đầu kỳ N+1, cho mọi đối tượng NL/BTP/TP, đủ cột kiện+kg như bảng kê kho; xem [36-so-kho-thang.md](36-so-kho-thang.md)).

Cụm báo cáo khép vòng (đọc dữ liệu thật, không mock): `/production-report` (`features/reports/DailyProductionReport.tsx` — tổng hợp thành phẩm SX hàng ngày, lưới mặt hàng×ngày + Excel) · `/export-report` (`features/reports/OrderExportReport.tsx` — đơn đặt được xuất theo kỳ + Excel) · `/nxt-material` (`features/reports/MaterialNxtScreen.tsx` — NXT nguyên liệu) · `/nxt` (`features/reports/NxtReportScreen.tsx` — NXT thành phẩm, suy từ SX/đơn/bán + tồn đầu). Màn ghi sản lượng là `/wip` (`/production` cũ chuyển về đây).

Đối soát hóa đơn điện tử: `/reconciliation` (`features/reconciliation/ReconciliationScreen.tsx` — upload 1 file Excel gồm các sheet HĐĐT cổng thuế + sheet PHẦN MỀM kế toán, đối chiếu theo `MST bán · ký hiệu · số HĐ chuẩn`, quy về VND, ngưỡng khớp chỉnh được; xuất lại Excel tô màu. Công cụ kế toán, KHÔNG đọc DB/`repo.ts`; logic thuần ở `lib/einvoiceReconciliation.ts`. Xem [37-doi-soat-hddt.md](37-doi-soat-hddt.md)).

`ShellLayout` (App.tsx) tính **quyền thực** một lần: `resolvePermissions({ roles, isAdmin })` ở [`lib/permissions.ts`](../../src/lib/permissions.ts) (chạy localStorage không đăng nhập, hoặc đọc hồ sơ lỗi ⇒ `OFFLINE_PERMISSIONS` = mọi màn trừ màn admin, như trước). Rồi:
- lọc `KIT_NAV` theo `visibleNavIds` (có quyền `view` ở ít nhất một tài nguyên của mục) → prop `items` của `AppShell`;
- gõ URL một màn có trong sổ tài nguyên mà không có `view` ⇒ `Navigate` về `homeFor(roles, perms)` (trang chủ vai trò; không thấy được thì `dashboard`, rồi màn đầu tiên thấy được). Route chuyển hướng cũ (`/production`…) và `/kit` không bị chặn — đích chuyển tới mới bị chặn;
- đã nạp hồ sơ mà **chưa gán vai trò** ⇒ khung app không nav + `EmptyState` "Chưa được cấp quyền" (còn nút Đăng xuất). `App` chờ `auth.isProfileLoading` xong mới dựng router (không nháy màn này, không về nhầm trang chủ);
- bọc `<Outlet />` trong `PermissionProvider` ⇒ màn hỏi `useCan("imports").delete` (gắn vào nút từng màn là Đợt 3).
**Khu Quản trị** (nhóm nav riêng "Quản trị", chỉ admin — mọi mục là tài nguyên `adminOnly`): `/admin` Tổng quan quản trị (`features/admin/AdminHomeScreen.tsx` — thẻ số tài khoản / chưa gán vai trò / vai trò / người có quyền riêng, lối vào, bảng vai trò đang dùng) · `/users` · `/roles` Vai trò & quyền (`features/admin/RolePermissionsScreen.tsx`, `?tab=users&user=<id>`, `?role=<slug>`) · `/audit`. Bốn route vẫn gate thêm bằng `auth.isAdmin`; `/users` + `/roles` khóa khi đang chế độ demo. Thêm màn mới ⇒ khai tài nguyên trong `PERMISSION_RESOURCES` (test `permissions.test.ts` so `KIT_NAV` + route `App.tsx`, quên là đỏ).

### Đường dẫn & tham số cũ (tiếng Việt) — giữ vĩnh viễn (2026-10-13)

Đổi sang tiếng Anh theo [`spec/quy-uoc-dat-ten.md`](../spec/quy-uoc-dat-ten.md) Đợt 4. Bảng ánh xạ một nguồn: `src/lib/legacyUrls.ts` (+ test). Nơi **ghi** link chỉ sinh dạng mới; nơi **đọc** nhận cả hai.

| Cũ | Mới | Cách giữ link cũ |
|---|---|---|
| `/doi-soat` · `/ton-kho-thang` · `/nxt-nl` · `/nxt-kho` · `/bc-thanh-pham` · `/bc-don-xuat` | `/reconciliation` · `/monthly-stock` · `/nxt-material` · `/nxt-warehouse` · `/production-report` · `/export-report` | `LegacyPathRedirect` trong `App.tsx` (giữ nguyên `?query`) |
| `/catalog?tab=mat-hang · khach-hang · dai-ly · loai-nl · bot-tam · kho-luu · tp-141` | `?tab=products · customers · suppliers · material-types · batters · storage-locations · finished-goods` | `normalizeCatalogTab` (CatalogScreen + highlight nav ở App) |
| `/qr?tab=in · giai-doan · do-phu` | `?tab=print · stages` | `normalizeQrTab` |
| `?lo=` (tem QR **đã in**) · `?duyet=` · `?don=&kiem=` | `?lot=` · `?approve=` · `?order=&check=` | `readParam` (đọc tên mới, không có thì tên cũ) + `parseQrCode` regex `(?:lot|lo)=` |

**Đợt 4 (2026-10-15) đổi tập màn có chủ đích** — ma trận spec §7: giám đốc/phó GĐ/kế toán trưởng thấy mọi màn nghiệp vụ; kế toán mọi màn trừ QC; thủ kho thêm Tồn TP + NXT kho; quản đốc thêm Tổng quan + tồn + báo cáo; phó QĐ thêm Tổng quan + báo cáo; tổ trưởng như cũ (`nav-access.test.ts` chốt tập mới). Id nav = path route ⇒ đổi đồng bộ ở `KIT_NAV`, `NAV_TREE`, `HUONG_DAN` (guideContent) và tập quyền `nav-access.ts`; `nav-access.test.ts` chốt mỗi vai trò thấy ĐÚNG cùng tập màn như trước. **Khóa bảng tô màu (`rowMarkKey="ton-kho-thang"`, `"nxt-kho"`, `"danh-muc-…"`) KHÔNG đổi** — là khóa đã lưu trong `row_marks`.

## Cạm bẫy bố cục

- id mục nav = path: `id: "warehouse"` phải khớp `Route path="/warehouse"`. (Bug cũ: id `kho` ≠ route `warehouse` ⇒ menu gãy — đã sửa.)
- Đầu sidebar, đầu drawer và header nội dung cùng `h-header` (token `--spacing-header` ở `tokens.css`: 4rem; máy xoay ngang thấp 3rem). Hàng tên cột nổi của `SummaryTable fullHeight` dính ở `top-header`. Đổi chiều cao ⇒ đổi token, đừng gõ `h-16`/`top-16` rời (lệch là trang vênh).
- **Máy xoay ngang thấp** (biến thể `short-landscape:`, cao ≤ 500px): header ẩn dòng "Baseafood MES · …", `main` đệm 16px, chân drawer bỏ dòng tên người dùng.
- **Đừng nhồi thêm nút icon vào header cho điện thoại.** Ở cỡ chữ 130%, mỗi nút là 57px — 6 nút đã vượt bề rộng màn 390px và bóp tiêu đề còn 0px. Thứ toàn cục mới thì cho xuống chân drawer.
- Bề rộng nội dung là biến `--app-content-width`, người dùng đổi được trong Bộ giao diện — **đừng** hardcode `max-w-*` ở màn.
- Luật responsive đầy đủ (breakpoint, thang chạm, bảng ra thẻ, checklist màn mới): [`src/design-system/README.md` § Quy chuẩn mobile](../../src/design-system/README.md).

## Thêm màn mới — checklist

1. Tạo thư mục `src/features/ten-man/`, viết file `TenMan.tsx`, export qua `index.ts` chỉ import `@/design-system` + `@/lib/catalogRepo`.
2. Thêm Route path tương ứng trong `src/App.tsx` sử dụng React `lazy()`.
3. Thêm mục vào `KIT_NAV` trong `src/features/shared/AppShell.tsx` (`id` = path, nhãn, icon) **và xếp `{ ref: "<id>" }` vào đúng nhánh module trong `CAY_NAV`** — thiếu bước sau thì mục rơi vào nhóm "Khác". Muốn trang có nút Hướng dẫn thì thêm mục vào `guideContent.tsx` (khóa = id nav). Muốn tab Báo cáo thì bọc màn bằng `Tabs` ở tầng `index.ts` như `imports`/`sales`.
4. Thêm dòng vào bảng trên + tạo tài liệu domain `docs/app-map/3x-*.md` nếu là nghiệp vụ mới.
5. Chạy checklist mobile ([`design-system/README.md` § Quy chuẩn mobile · mục 7](../../src/design-system/README.md)) trước khi coi là xong.

## Cross-references

- Cấu trúc thư mục & ranh giới import: [01-app-structure.md](01-app-structure.md)
- Luật UI (vùng chạm, nhãn, cỡ chữ), Cài đặt hiển thị: [`src/design-system/README.md`](../../src/design-system/README.md)
- Nội dung nghiệp vụ từng màn: [30-nhap-hang.md](30-nhap-hang.md) · [33-ban-hang.md](33-ban-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md) · [32-danh-muc.md](32-danh-muc.md)
