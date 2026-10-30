> Load khi: làm chế độ DEMO (bật/tắt), sinh bộ dữ liệu demo, gỡ màn DEMO dữ liệu mẫu, thêm chức năng mới cần có mặt trong demo.
> Trạng thái: **ĐÃ CHỐT hướng (2026-10-12)** — chủ dự án chọn **phương án B `site-demo` trong DB thật** · ẩn danh mặc định có công tắc · xóa hẳn `/production` + `/reports` · **chỉ admin** bật demo. Chưa build. Đọc §4b (rào chắn bắt buộc của B) trước khi code.
last_verified: 2026-10-30
<!-- updated: 2026-10-30 (c) — 3 bảng MỚI mig 0090 vào `DemoBundle` (`supplierInvoices` · `supplierInvoiceLines` · `accountingCodeMaps`), dựng từ chuyến demo (`lib/supplierInvoiceDemo.ts`): HĐ khớp, HĐ gộp 2 chuyến có một dòng lệch giá 2.000 đ, HĐ không có chuyến, chuyến chờ HĐ; file là đường dẫn GIỮ CHỖ. Checklist §5 dòng 23b. -->
<!-- updated: 2026-10-30 (b) — bảng MỚI `goods_types` (mig 0089) vào `DemoBundle` (`goodsTypes`, 5 loại mẫu ở demoGenerator) + `DemoPackLoader` (`useGoodsTypes`); khóa ngoại `import_contract_lines.goods_type_id` khai `refColumns`. -->
<!-- updated: 2026-10-29 — bảng MỚI `export_document_kinds` (mig 0081) vào `DemoBundle` (`exportDocumentKinds`, demoGenerator: 1 loại tự thêm "Giấy chứng nhận Halal") + `DemoPackLoader` (DemoMode.tsx). -->
<!-- updated: 2026-10-27 (b) — rà commit: §4c ghi NGƯỢC về hàm gộp mặt hàng — bản vá refColumns làm hàm 0069 bỏ sót dòng demo mới ⇒ thêm `0078` (bắt cả id thô lẫn `demo:`), §4c ghi thứ tự: chạy 0078 trước lệnh thêm tiền tố. -->
<!-- updated: 2026-10-27 — R1 bổ sung khóa ngoại MỀM (19 bảng khai `refColumns`, cột mảng `batter_ids`, test quét `*_id` của toRow) + §4c cách sửa dữ liệu demo cũ thiếu tiền tố. Không thêm bảng ⇒ checklist §5 không đổi. -->
<!-- updated: 2026-10-20 (z) — GÓI DEMO XUẤT KHẨU: admin "Nạp gói demo Xuất khẩu…" (menu Demo, `features/shared/ExportDemoPackUpload.tsx`) tải pack.json + file thật (HĐ scan, bộ chứng từ tách tờ, thiết kế thùng, container plan, LSX, LXH, ảnh đóng cont) vào bucket riêng `export-files` thư mục cố định `site-demo/export-files/demo-pack/…`; "Tạo bộ mới" (`createAndEnter`) đọc gói (`fetchExportDemoPack`) ⇒ 7 ca gắn file thật + mỗi dòng sổ Kế hoạch xuất hàng thành HĐ + chuyến dời về các tháng gần đây, khách chưa có được thêm vào danh mục demo (`extraCustomers`). Không gói ⇒ 7 ca số tự đặt + file giữ chỗ. Số / tên khách thật KHÔNG nằm trong mã nguồn. -->
<!-- updated: 2026-10-20 (y) — Bộ demo Xuất khẩu dựng lại theo buổi audit hồ sơ SCM: 7 HĐ (18.26 + lô 165 đã chốt HĐ ngoài dung sai · lô 181 đã xuất đủ + bản sửa bị từ chối · cont 40+20 dùng chung · CIF/L/C/xe tải/đóng ghép trễ hạn + 1 dòng chưa nối · quá hạn chưa chuyến · bị từ chối đã hủy · chờ duyệt); người ký "Giám đốc (demo)", không tên thật. -->
<!-- updated: 2026-10-20 (x) — 8 bảng MỚI `export_*` (0075, Xuất khẩu) vào `DemoBundle` + `DemoPackLoader`. Bộ sinh dựng sẵn 3 HĐ (`lib/exportPlanningDemo.ts`, có test): khép kín · đang đóng cont còn thiếu 1 cont · chờ duyệt. File demo là đường dẫn GIỮ CHỖ `demo-placeholder/…` (không chép file thật, mở ra báo "file giữ chỗ") — vẫn tính là bằng chứng nên trạng thái bước + khép kín trình diễn được (R14 ba-spec 41). -->
<!-- updated: 2026-10-28 — bảng MỚI `export_activity_log` (0079, nhật ký HĐ xuất khẩu) vào `DemoBundle.exportActivities` + `DemoPackLoader` (`useExportActivities`); bộ sinh `buildExportDemo` ghi các bước đã làm của 7 HĐ mẫu (lập · duyệt · ghi chuyến · đóng). refColumns `contract_id` · `shipment_id` (liên kết mềm). -->
<!-- updated: 2026-10-19 (b) — bảng MỚI `company_documents` + `document_versions` (0072, Tài liệu công ty) vào `DemoBundle` + `DemoPackLoader`, bộ sinh để TRỐNG (đường dẫn file là của site thật). refColumns `parent_id` / `document_id` (liên kết mềm, không khóa ngoại). Checklist §5 dòng 1c. -->
<!-- updated: 2026-10-19 — bảng MỚI `task_assignments` (0070, giao việc) vào `DemoBundle` + `DemoPackLoader` — bộ sinh để TRỐNG (việc máy phát hiện tự suy từ số demo; nạp bộ mới xoá việc giao cũ). Ở demo danh sách người nhận rỗng (hồ sơ là site thật) ⇒ chỉ giao cho chính mình. Checklist §5 dòng 1b. Cảnh báo chuỗi thêm `period-unlocked`, link "Mở" mang `?date=&workshop=`. -->
<!-- updated: 2026-10-16 (c) — Không thêm bảng mới. Nháp form (quy tắc 17) dùng `modeLocalKey` ⇒ demo có nháp riêng `bsf-demo.draft.*`, không lẫn nháp thật. Hàm gộp mặt hàng 0069 nhận `p_site` (SITE_ID): ở `site-demo` tự thêm tiền tố `demo:` khi tra products, cột product_id để thô (không khai refColumns). -->
<!-- updated: 2026-10-16 — GOM GỌN giao diện demo lên HEADER: bỏ khối to ở Tổng quan; nút "Demo" (admin / máy không đăng nhập) ở header mở menu nhỏ (ẩn tên/giữ tên · Tạo bộ mới · Vào demo giữ bộ cũ, xác nhận qua hộp hỏi). Đang demo: nút "DEMO" màu cảnh báo ở header, menu Làm mới / Thoát. Dải "ĐANG XEM DỮ LIỆU DEMO" giữ nguyên (luôn hiện) nhưng thu còn MỘT dòng mảnh, nút Thoát dời lên nút DEMO. Bộ số thật chỉ nạp khi mở menu lần đầu; việc chờ "Làm mới" tự chạy ở BẤT KỲ màn nào (trước chỉ chạy khi mở Tổng quan). `AppShell` có prop `headerActions`. -->
<!-- updated: 2026-10-12 (d) — ĐÃ BUILD D1–D4 + V6/V10/V12/V16. D1: `lib/demoMode.ts` (cờ `bsf1:che-do`, `SITE_ID` = `site-demo`, khóa chính lên máy chủ tiền tố `demo:`, bản sao/hàng chờ `bsf-demo.*`) nối ở `supabase.ts` / `db.ts` / `repo.ts` (upsert + seed + nạp + XÓA lọc site) / `audit.ts` / `storage.ts`; auth giữ site thật. D2: `lib/demoGenerator.ts` (quét tham số → sinh 60 ngày, ẩn danh, ca cảnh báo cài sau vòng sinh) + `features/shared/DemoMode.tsx` (dải vàng, nạp gói qua hook thường, khối bật/tắt ở Tổng quan — chỉ admin). D3: "Làm mới bộ demo" = sinh lại + nạp qua diff của repo (bỏ hàm SQL `demo_reset`); `0058` thêm site. D4: gỡ 5 màn DEMO + `DEMO_IDS`/`demoGuard` + `StatusChip`/`MockPatternData`. `0058` ĐÃ chạy trên DB thật 2026-10-13. Vòng kiểm nghiệm §4b (2026-10-13, đếm qua SQL): số THẬT mọi bảng không đổi so với 2026-10-12 (chỉ audit_log +1 thao tác thường); số demo đã lên `site-demo` TRỪ dòng NL/TP của kỳ cân đối (khóa ngoại `period_id` — đã sửa, xem R1). CHƯA: đếm lại sau khi máy demo tải bản sửa; D5 kịch bản trình bày (xem docs/demo/kich-ban-che-do-demo.md). -->
<!-- updated: 2026-10-12 (c) — người dùng thấy sơ đồ sankey (V3) khó hiểu ⇒ thay bằng HAI THANH CHIA PHẦN (`ProportionBar`): "cứ 100 kg NL vào xưởng ra bao nhiêu BTP / phế liệu / còn dở / bán nội địa / hao hụt" + "hàng trong kho dự trữ đi đâu"; gỡ `d3-sankey`. Thu thanh lọc kỳ về một hàng; thẻ số + băng chuyền + biểu đồ tô cùng màu theo LOẠI số. Định hướng chung: biểu đồ ĐƠN GIẢN đọc là hiểu (thanh, cột, đường, chia phần), không sơ đồ cần học cách đọc. -->
<!-- updated: 2026-10-12 (b) — §5b ĐÃ BUILD đợt V-a + V-b (Tổng quan): V1 · V2 · V3 · V4 · V5 · V7 (bảng) · V8 · V9. Chốt thêm: làm lại /dashboard, dùng `d3-sankey` (nạp lười), ngưỡng định mức ±5%. Còn: V6 thác nước (màn Cân đối), V10 cây lô vẽ (màn /qr), nhóm P2. -->

# Chế độ DEMO tách riêng

## 1. Vấn đề

- Xưởng **chưa nhập số đều** ⇒ hệ thật thưa dữ liệu, nhiều màn mở ra trống. Không trình bày được.
- Cách hiện tại là **màn DEMO lẫn trong app thật**: 5 màn dữ liệu mẫu cứng (`/production`, `/quality`, `/cold-storage`, `/reports`, `/traceability`) gắn badge "DEMO", chỉ admin thấy. Hai hệ quả:
  1. Màn THẬT (nhập hàng, SX, bán, cân đối, QR…) vẫn trống khi demo — phần đáng khoe nhất lại không khoe được.
  2. Màn mẫu là số bịa, không chạy qua engine thật (`computeWipStock`, `balancingCalc`, `lotTraceability`) ⇒ bấm vào là lộ.
- Hai lối demo cũ đều có rủi ro: `docs/demo/demo-seed.js` (dán Console, chỉ phủ Nhập hàng + Cân đối, **dùng chung khóa `bsf.*`** với dữ liệu thật trên cùng trình duyệt) và `docs/demo/seed_bt2da*.sql` (**ghi thẳng DB thật**, từng là reset phá hủy).

## 2. Mục tiêu

Một **công tắc** "Chế độ demo" trong app: bật ⇒ toàn bộ app (mọi màn THẬT, đúng engine thật) chạy trên **bộ dữ liệu demo đầy đủ**; tắt ⇒ về số thật. Bộ demo **sinh từ dữ liệu thật đã nhập** (giữ hình dạng/tỉ lệ thật) và **bù phần còn trống** để chức năng nào cũng có số. Không còn màn DEMO lẫn vào app thật.

## 3. Rà soát dữ liệu thật (đếm dòng DB, 2026-10-12, chỉ đọc)

| Có số (dùng làm khuôn) | Dòng | Trống (bộ sinh phải bù) | Dòng |
|---|---|---|---|
| Chuyến nhập `import_shipments` / dòng `material_imports` | 77 / 215 | Đóng gói `packagings` | 0 |
| Phế liệu ngày `scraps` · chốt ngày `daily_locks` | 64 · 22 | Phiếu bán `sales_invoices` / `sales_items` | 0 / 0 |
| Kỳ cân đối (3 kỳ: 13 dòng vào, 35 dòng ra) | 3 | Bán nội địa `domestic_sales` | 0 |
| Sổ kho tháng `monthly_stock_ledger` | 1 728 | Lệnh xuất `export_orders` / `export_items` | 0 / 0 |
| Snapshot NXT `nxt_snapshots` | 30 | Lô QR `lot_inputs` · `lot_dispatches` · `lot_waivers` | 0 · 0 · 0 |
| SX BTP `production_wips` · chốt SX `production_locks` | 18 · 3 | Tồn đầu NL / TP (`*_opening_stock`) | 0 / 0 |
| Danh mục: 141 TP · 263 mặt hàng · 70 loại NL · 28 đại lý · 20 KH · 8 bột · 4 kho lưu | — | Chốt QC `qc_locks` · in tem `label_prints` | 0 · 0 |
| Đơn đặt 1 / dòng 1 · QC 1 · đối soát 1 · tô màu 3 | ít | | |

⇒ **Nửa sau chuỗi (đóng gói → kho → bán/xuất → lô QR) gần như trống.** Bộ sinh không thể chỉ "chép số thật", phải **mô phỏng** tiếp chuỗi từ nửa đầu có thật.

## 4. Kiến trúc đề xuất (phương án A — khuyến nghị)

```
            ┌───────────── Chế độ THẬT (mặc định) ─────────────┐
 repo.ts ──►│ Supabase  ⇄  bản sao localStorage  bsf.*  + hàng chờ │
            └───────────────────────────────────────────────────┘
            ┌───────────── Chế độ DEMO ────────────────────────┐
 repo.ts ──►│ CHỈ localStorage  bsf-demo.*   (không gọi máy chủ) │
            └───────────────────────────────────────────────────┘
 Đăng nhập: luôn qua Supabase Auth thật (demo vẫn phải đăng nhập).
```

1. **Cờ chế độ** đọc MỘT lần lúc khởi động (`localStorage["bsf1:che-do"] = "demo"` hoặc `?demo=1`). Đổi chế độ = ghi cờ + **tải lại trang** (không đổi nóng — tầng dữ liệu, hàng chờ, client đều khởi tạo ở module scope; đổi nóng dễ ghi nhầm kho).
2. **Tách 2 client**: client Supabase cho **đăng nhập** (giữ nguyên) và "client dữ liệu" mà `repo.ts` / `audit.ts` / `storage.ts` / `rowMarks` dùng — ở demo nó là `null` ⇒ repo tự rơi về nhánh localStorage sẵn có. Không ghi được lên máy chủ **theo cấu trúc**, không dựa vào ý thức.
3. **Tách không gian khóa**: `db.ts` (`load`/`save`) + `napCho`/`luuCho` trong `repo.ts` đổi tiền tố `bsf.` → `bsf-demo.` khi demo. Dữ liệu thật + **hàng chờ chưa gửi** của máy đó không bị đụng. Cài đặt giao diện (`bsf1:*`) dùng chung.
4. **Dấu hiệu luôn hiện**: dải màu mảnh dính dưới header "ĐANG XEM DỮ LIỆU DEMO — không phải số thật" + nút **DEMO** màu cảnh báo trên header (menu Làm mới / Thoát demo — gom gọn 2026-10-16), tiêu đề tab có tiền tố "[DEMO]", đèn kết nối hiện "Demo (không đồng bộ)". In A4 / xuất Excel ở demo đóng dấu "DEMO".
5. **Ai bật được**: nút ở menu tài khoản, chỉ vai trò không-giới-hạn (admin, giám đốc, kế toán…) — tổ trưởng/thủ kho không thấy, khỏi nhầm.
6. **Bộ sinh dữ liệu demo** (`lib/demo/`, hàm thuần + test):
   - **Quét**: nạp toàn bộ bảng thật qua repo (đường hòa đang có) khi đang ở chế độ thật.
   - **Ẩn danh** (tùy chọn, mặc định BẬT): đại lý → "Đại lý 01…", khách → "Khách 01…", MST/địa chỉ/SĐT xoá; giá nhân một hệ số ngẫu nhiên cố định. Danh mục hàng/loại NL/141 mã TK giữ nguyên tên (không nhạy cảm, cần cho nghiệp vụ).
   - **Dời ngày**: mọi ngày dịch đều để ngày mới nhất ≈ hôm nay ⇒ màn mở-là-thấy.
   - **Bù chuỗi** từ nửa đầu thật: SX BTP theo định mức thật (kg NL ÷ kg TP các kỳ cân đối) → chốt SX + còn dở → duyệt nhập kho → đóng gói BTP→TP (hao hụt theo tỉ lệ) → đơn đặt + lệnh xuất FIFO → phiếu bán lẻ / bán nội địa → gắn lô (`lot_inputs`/`lot_dispatches`, vài `lot_waivers`) → QC chấm điểm + chốt → tồn đầu → vài dòng tô màu. Chủ ý chèn 2–3 tình huống "có chuyện" để demo cảnh báo (ghi bù có lý do, bán vượt tồn, lệch tổng ngày, lô chưa gắn).
   - **Ghi** vào `bsf-demo.*` rồi bật cờ + tải lại. Không bao giờ ghi `bsf.*` hay máy chủ.
   - **Xuất/nhập gói demo** (`.json`): sinh một lần ở máy có dữ liệu, mang sang máy trình bày; nút **"Khôi phục bộ demo"** về nguyên trạng sau mỗi buổi (demo xong ai bấm loạn cũng không sao).
7. **Đối soát HĐĐT** chạy từ file upload, không đọc DB ⇒ demo cần **1 file Excel mẫu ẩn danh** đính kèm gói demo, không cần sinh.

**Phương án B — ĐÃ CHỌN (2026-10-12):** cùng DB thật, tách bằng `site_id = 'site-demo'`. Ưu: demo dùng chung nhiều máy, có ảnh/Storage, không cần mang file. Nhược: **ghi vào DB sổ sách thật** (🔴) ⇒ chỉ làm khi đủ rào chắn §4b. Mục 1, 4, 5, 6, 7 ở trên vẫn giữ; mục 2–3 đổi như sau:

- Mục 2 (B): ở demo vẫn dùng client Supabase thật, nhưng `SITE_ID` đọc từ cờ chế độ ⇒ `'site-demo'`. Mọi đọc đã `.eq("site_id", SITE_ID)` (`repo.ts` nạp theo trang, `audit.ts`).
- Mục 3 (B): **VẪN BẮT BUỘC tách khóa `bsf-demo.*`**. Bản sao localStorage + hàng chờ không mang `site_id`; dùng chung khóa `bsf.*` thì lượt đồng bộ ở demo sẽ đẩy dòng thật đang chờ lên `site-demo` (hoặc ngược lại) ⇒ lẫn sổ.
- Mục 6 (B): bộ sinh ghi qua đường upsert bình thường của repo khi đang ở `site-demo`; "Khôi phục bộ demo" = xóa sạch `site_id='site-demo'` rồi sinh lại. Bỏ xuất/nhập `.json` (không cần nữa).

### 4b. Rào chắn BẮT BUỘC của phương án B (làm ở D1, trước khi demo ghi bất kỳ dòng nào)

Rà `repo.ts` (2026-10-12) thấy 2 chỗ hiện vô hại vì chỉ có 1 site, nhưng **sẽ phá số thật** khi có `site-demo`:

| # | Chỗ | Hỏng thế nào | Vá |
|---|---|---|---|
| R1 ✅ | Upsert `onConflict: <khóa>` (`syncOnePass`, `repo.ts`) — khóa là `id` (hoặc `code` của 141 mã TK), **không có `site_id`** | Dòng demo trùng khóa dòng thật (id cố định `<ngày>\|<xưởng>` của chốt ngày, mã TK 1551, id thật chép sang) ⇒ upsert ĐÈ dòng thật sang `site-demo` | **ĐÃ LÀM (khác dự kiến):** thay vì bắt mọi chỗ sinh id thêm `demo-`, tầng repo đổi khóa ở RANH GIỚI máy chủ: lên = `demo:<khóa>`, về = bỏ tiền tố, dòng thiếu tiền tố ở `site-demo` bị bỏ qua (`lib/demoMode.ts` `rowToServer`/`rowFromServer`, có test). App bên trong giữ khóa gốc ⇒ không phải sửa id generator nào. Khóa ngoại giữa bảng nghiệp vụ (3 cái `period_id → balancing_periods.id`) cũng mang tiền tố — `TableMapping.refColumns` (bản đầu bỏ sót: kỳ demo lên, dòng NL/TP của kỳ bị 23503; sửa 2026-10-13, test `lib/demoForeignKeys.test.ts` quét migration). **Khóa ngoại MỀM** (không có `references`, máy chủ không từ chối) bị sót tới 2026-10-27: dòng demo lưu `customer_id = 'dm-kh-0'` trong khi khách là `demo:dm-kh-0` — app vẫn đúng nhưng trên máy chủ là mồ côi. Rà DB 2026-10-27 (chỉ đọc): 19 cột ở `site-demo` lưu id thiếu tiền tố (VD `monthly_stock_ledger.carried_from_id` 419 dòng, `label_prints.lot_id` 117, `production_wips.product_id` 106 — cả 106 khớp `'demo:' \|\| product_id`, `export_contracts.customer_id` 88). Vá: khai `refColumns` đủ 19 bảng + cột mảng `products.batter_ids`; test quét mọi cột `*_id` / `*_ids` trong `toRow`, cột không phải id bản ghi (id người dùng, mã kho hệ thống, `row_marks.row_id`) vào danh sách MIỄN kèm lý do. Dữ liệu demo cũ: xem §4c |
| R2 ✅ | Xóa `delete().in(khoa, keys)` **không lọc `site_id`** | Xóa ở demo một khóa trùng khóa thật ⇒ xóa luôn dòng thật | Thêm `.eq("site_id", SITE_ID)` cho mọi lệnh xóa (vá luôn cho chế độ thật, vô hại) |
| R3 ✅ | Ràng buộc UNIQUE trong migration không gồm `site_id` (vd mã, ngày chốt) — rà 0001…0058: KHÔNG có UNIQUE nào ngoài khóa chính (và `sites.ma`), khóa chính đã có tiền tố ⇒ hết rủi ro | Insert demo trùng giá trị với dòng thật ⇒ bị từ chối, hoặc upsert theo ràng buộc đó đè dòng thật | Rà mọi `unique` / `onConflict` ở `0001…0057` trước D2; ràng buộc nào không gồm `site_id` thì cho demo giá trị khác hẳn (tiền tố) — **không** đổi ràng buộc trên bảng thật (🔴) |
| R4 ✅ | "Khôi phục bộ demo" = xóa hàng loạt | Một điều kiện sai là xóa sổ thật | **ĐÃ LÀM (khác dự kiến):** không có lệnh xóa hàng loạt nào. "Làm mới bộ demo" = sinh gói mới rồi GHI ĐÈ từng bảng qua hook thường; repo tự diff ⇒ xóa từng khóa demo cũ qua đúng đường R1+R2 (tiền tố + lọc site). Bỏ hàm SQL `demo_reset()` |
| R5 ✅ | Ảnh Storage (QC, OCR) dùng path `bsf1/...` | Ảnh demo lẫn thư mục ảnh thật | Path theo site: `site-demo/...` |
| R6 ✅ | Nhật ký thao tác `audit_log` | Thao tác demo lẫn nhật ký thật | Ghi + đọc theo `site_id` ⇒ tự tách; buffer dưới máy `bsf-demo.audit.buffer`. Nạp gói demo TẠM TẮT nhật ký (`setAuditPaused`) — hàng nghìn dòng không phải thao tác người dùng |
| R7 | Ai đọc thẳng DB (SQL, xuất ngoài app) | Không lọc site ⇒ cộng cả số demo | Ghi rõ ở [`03-database`](../app-map/03-database.md): mọi truy vấn ngoài app phải `where site_id = '<site thật>'` |

Kiểm nghiệm D1 (chạy thật, không suy đoán): đếm dòng `site_id <> 'site-demo'` của MỌI bảng trước và sau một vòng (bật demo → sinh → thao tác → khôi phục → tắt demo) phải **bằng nhau, từng bảng**; hàng chờ `bsf.*.cho` không đổi.

### 4c. Sửa dữ liệu demo cũ có khóa ngoại mềm thiếu tiền tố (2026-10-27)

- **Không sửa thì sao:** app vẫn hiện đúng (đọc về bỏ tiền tố ở cả hai đầu; giá trị thiếu tiền tố giữ nguyên). Chỉ máy chủ thấy mồ côi — câu SQL nối bảng chạy ở `site-demo` không khớp.
- **Hàm gộp mặt hàng (sửa 2026-10-27 khi rà commit):** ghi trước ở đây là "0069 không khớp vì thiếu tiền tố" — NGƯỢC. Hàm 0069 so cột sổ với id THÔ, nên nó khớp dòng CŨ; chính bản vá refColumns làm dòng demo MỚI (`product_id = 'demo:…'`) không được chuyển, mà mục bỏ vẫn bị xoá ⇒ dòng sổ demo trỏ vào mặt hàng đã mất. Sửa: **`0078_merge_products_demo_prefix.sql`** — bắt cả `<id>` lẫn `demo:<id>`, ghi mục giữ dạng có tiền tố; site thật y như 0069 (kiểm PGlite: demo chuyển cả dòng mới + cũ + đóng gói, hoàn tác đủ; site thật không đổi; bản 0069 chỉ chuyển dòng cũ).
- **"Làm mới bộ demo"** (hạt ngẫu nhiên theo giờ + ngày hôm nay) sinh lại số ⇒ phần lớn dòng đổi nội dung ⇒ được ghi lại qua `rowToServer` mới, hết mồ côi. **Không chắc hết:** `useTable` chỉ gửi dòng KHÁC bản cũ (so JSON) — dòng giống hệt (mặt hàng / danh mục chép từ số thật, HĐ của gói Xuất khẩu nếu làm mới cùng ngày) không gửi lại nên vẫn giữ id cũ.
- **Sửa dứt điểm (đề xuất, CHƯA chạy):** một lệnh `update … set <cột> = 'demo:' || <cột>` cho từng cột trong 19 cột, chỉ ở `site_id = 'site-demo'` và chỉ giá trị khác rỗng chưa có tiền tố (idempotent). **Thứ tự bắt buộc:** chạy `0078` TRƯỚC (không thì sau lệnh này hàm gộp 0069 ở demo không chuyển được dòng nào), rồi mới chạy lệnh này SAU khi bản sửa đã lên bản chạy. Cột mảng `products.batter_ids` đổi từng phần tử (`array(select case when x <> '' and x not like 'demo:%' then 'demo:' || x else x end from unnest(batter_ids) x)`). Kiểm theo §4b: số dòng `site_id <> 'site-demo'` mọi bảng trước = sau; câu đếm "thiếu tiền tố" về 0.

## 5. Danh sách chức năng cần demo được (checklist nghiệm thu)

Mỗi dòng = mở màn THẬT trong chế độ demo phải có số và làm được thao tác. Cột "Nguồn" = lấy từ số thật (T) hay bộ sinh bù (S).

| # | Module · màn | Thao tác phải demo được | Nguồn |
|---|---|---|---|
| 1 | Tổng quan `/dashboard` | Số tổng NL vào / SX / tồn / bán theo kỳ | T+S |
| 1b | Việc của tôi `/my-tasks` | Việc theo quyền (ngày chưa chốt, BTP chờ duyệt, chưa gắn lô, kỳ chưa chốt) có hạn + quá hạn · Mở việc tới đúng ngày · giao việc (cho chính mình ở demo) · Xong · thu hồi · chuông header (`task_assignments`, bộ demo trống) | S |
| 1c | Tài liệu công ty `/documents` | Thêm tài liệu · sửa · ghi lần ban hành (lần cũ tự Hết hiệu lực) · thu hồi · xóa tài liệu chưa ban hành · nhắc gia hạn chứng nhận ở Việc của tôi (`company_documents` + `document_versions`, **bộ demo trống** — file thật không trỏ sang demo; file demo nằm ở `site-demo/…` trên bucket `documents`) | S |
| 1d | Xuất khẩu `/planning-export` | Lịch xuất hàng tháng / tuần / ngày: 4 thẻ số, chuyến gom theo khách, tiến độ 6 bước · 7 HĐ demo (đã chốt HĐ · đã xuất đủ · cont 40+20 dùng chung · CIF/L/C xe tải trễ hạn · quá hạn chưa chuyến · đã hủy · chờ duyệt) · lập HĐ · ghi duyệt · bản sửa · gia hạn · lên chuyến · cập nhật bước (file giữ chỗ) · tiền về · xuất Excel · tra số giấy tờ · **tên hàng theo khách** (`customer_product_names`, mig 0077 — bộ demo trích xuất từ HĐ demo; danh mục Khách hàng → Tên hàng) · **quy trình v8** (mig 0079): HĐ L/C chờ đính kèm, HĐ xuất đủ chờ duyệt cuối, đính kèm hồ sơ, duyệt cuối đóng HĐ, **nhật ký HĐ** (`export_activity_log`) | S |
| 1e | Nhập khẩu `/planning-import` | Lô nhập theo tháng (3 thẻ số, gom theo đối tác) · 3 HĐ demo (gia công không giá 2 lô: đủ hồ sơ + thiếu chứng từ · SXXK hàng lẻ chờ thực nhập · kinh doanh đã đóng thiếu 100 kg) · 3 NCC ở danh mục **NCC nhập khẩu** riêng (`import_suppliers`, mig 0083 — 1 Ngừng giao dịch; KHÔNG thêm vào Đại lý) · lập HĐ · ghi lần nhập · cập nhật / thêm chứng từ (file giữ chỗ) · ghi thực nhập · đóng / mở lại · tra số tờ khai (`lib/importPlanningDemo.ts`, mig 0082) | S · dòng hàng nối mặt hàng của danh mục demo (`buildImportDemo(today, products)`, ba-spec 45 R20) · lần nhập đủ hồ sơ có 2 mẫu kiểm của kho (`importSampleChecks`, mig 0085) + file báo cáo giữ chỗ |
| 1f | Lệnh sản xuất (dữ liệu, mig 0088 — chưa có trang, pha P3) | 2 lệnh trên HĐ demo đầu tiên có dòng đã nối mặt hàng (`lib/productionOrderDemo.ts`): 1 **Đã phát hành** theo khuôn LSX 19.10 (3 ngày SX, đai mỗi ngày một màu, bao bì đã có sẵn, gắn chuyến mở đầu tiên của HĐ, dành nửa số thực nhập của lần nhập demo đầu tiên) · 1 **Nháp** chưa gắn chuyến | S |
| 2 | Nhập hàng `/imports` | Ghi chuyến nhiều dòng · 2 ngày (giao / ghi sổ) · chốt ngày · ghi bù bắt lý do · phế liệu ngày · cảnh báo lệch tổng · bộ lọc · tab Báo cáo | T |
| 3 | ↳ OCR phiếu nhập | Nhận diện ảnh phiếu → điền nháp (cần 1–2 ảnh mẫu trong gói; ảnh không lưu Storage ở demo) | S |
| 4 | ↳ Mã lô + tem QR chuyến | In tem lô NL theo loại NL của chuyến | T+S |
| 5 | Tồn kho NL `/nxt-material` | Tồn đầu + nhập − SX − bán nội địa + đông gửi/xả đông | T+S |
| 6 | SX thành phẩm `/wip` | Ghi sản lượng ngày theo xưởng/loại NL · bột tẩm · bán nội địa · gắn lô NL cho phiên · chốt ngày SX (bắt gắn lô/lý do, còn dở theo loại NL) · ghi bù · báo cáo TP ngày + "Gửi báo cáo" | T+S |
| 7 | Đóng gói `/packaging` | Phiếu BTP tiêu hao → TP ra + hao hụt · gắn lô BTP · tem | S |
| 8 | Kiểm tra QC `/qc` | Checklist chấm điểm · chốt ngày · ghi bù (ảnh: tắt ở demo) | S |
| 9 | Kho dự trữ `/warehouse` | Duyệt BTP chờ → đã nhập · tồn đông · mở thẳng hộp duyệt từ link QR | S |
| 10 | Sổ kho tháng `/monthly-stock` | Xem theo tháng · dồn kỳ · sửa inline · nhập Excel bảng kê | T |
| 11 | Mã lô QR `/qr` | Tra lô (truy ngược/xuôi + cân bằng kg) · Theo giai đoạn 5 khâu · In tem hàng loạt · Thu hồi (In + Excel) | S |
| 12 | Nhập xuất tồn kho `/nxt-warehouse` | Báo cáo XNT từ snapshot | T |
| 13 | Bán hàng `/sales` | Phiếu bán · quy cách · XK/NĐ · chọn nguồn (Block thô / Đóng gói) · gắn lô · ghi bù · tab Báo cáo | S |
| 14 | Đơn đặt `/orders` | Gom đơn · lệnh xuất FIFO · kiểm lô xuất + thay lô | T+S |
| 15 | Cân đối kỳ `/balancing` | Tạo kỳ · chuyến nhập trong ô lưới · hút phế liệu / bán / bán nội địa · định mức · giá thành · lãi/lỗ · 2 dòng kho · in A4 · chốt / chuyển kỳ | T |
| 16 | Báo cáo thành phẩm `/production-report` | Lưới mặt hàng × ngày + Excel | T+S |
| 17 | Báo cáo đơn xuất `/export-report` | Đơn xuất theo kỳ + Excel | S |
| 18 | Tồn kho thành phẩm `/nxt` | NXT TP suy từ SX/đơn/bán + tồn đầu | S |
| 19 | Đối soát HĐĐT `/reconciliation` | Upload file mẫu → 4 kiểu đối soát → xuất Excel giữ định dạng | file mẫu |
| 20 | Danh mục `/catalog` | 5+ tab · Combobox thêm mới + bút chì sửa nhanh · 141 mã TK (chỉ xem) | T |
| 21 | Người dùng `/users` · Nhật ký `/audit` | Xem vai trò; nhật ký demo ghi cục bộ (không lên `audit_log` thật) | S |
| 21b | Vai trò & quyền `/roles` · `/admin` | **KHÔNG vào demo (có chủ đích, 2026-10-15):** `app_roles` / `role_permissions` / `user_permissions` (0062) là cấu hình THẬT như `user_profiles` ⇒ không thêm vào `DemoBundle`/`DemoPackLoader`; `/roles` hiện "Đang ở chế độ demo" như `/users`; chế độ demo chỉ admin bật mà admin không đọc ma trận | — |
| 22 | Xuyên suốt | Tô màu dòng "đã dò" · thanh cuộn ngang trên+dưới · Cài đặt hiển thị · phân quyền 2 bộ phận (xem như tổ trưởng / thủ kho) · đèn kết nối | — |
| 23b | Nhập hàng · Hóa đơn đại lý | Tab Hóa đơn: 4 thẻ việc còn lại, HĐ gộp 2 chuyến, dòng lệch giá → Cập nhật theo HĐ / Giữ số xưởng, HĐ không có chuyến → Tạo chuyến từ HĐ / Không thuộc chuyến; nhãn HĐ trên chuyến ở Sổ chi tiết | S |
| 23 | Kịch bản trọn chuỗi | NL vào (chuyến, lô) → SX (gắn lô) → kho → đóng gói → xuất/bán → quét QR trên tem ra đủ đường đi | S |

Gỡ khỏi demo (vì đã có màn thật thay): `/traceability` → `/qr` · `/quality` → `/qc` · `/cold-storage` → `/warehouse`. Còn `/production` (lệnh SX) và `/reports` (báo cáo tổng) là **ý tưởng chưa có thật** — xem câu 3 §7.

## 5b. Trực quan hoá dòng chảy số liệu (bảng · thẻ KPI · biểu đồ)

Mục đích demo là cho thấy **số chảy qua hệ thống**: kg nguyên liệu vào ⇒ đi đâu ⇒ ra tiền bao nhiêu. Hiện app chỉ có 3 kiểu hình: `StatCardGrid` (lưới thẻ số), `BarChart` (thanh ngang + đường trung bình, ở báo cáo Nhập/Bán), `VerticalBarChart` (cột theo ngày). `/dashboard` chỉ có thẻ + bảng tồn theo kho + nhập theo xưởng. **Chưa có hình nào nối các khâu với nhau.**

### Nguyên tắc (giữ đúng quy tắc 15)

- Đây là **tính năng báo cáo THẬT**, không phải màn demo: chạy cả trên số thật (thưa thì hiện ít), demo chỉ làm nó đầy. Không số mẫu cứng.
- Mọi con số đi qua **engine đã có test**: `calculateBalancing` (định mức · giá thành · lãi/lỗ), `computeWipStock` / `computeFinishedGoodStock` / `computeFinishedGoodNxt` / `computeMaterialTotalStock` / `computeMaterialNxt` (tồn), `traceBackward` / `traceForward` / `computeLotMassBalance` / `groupByTraceStage` (lô). Phần gom mới (dòng chảy, cảnh báo) viết thành **hàm thuần mới có test** ở `lib/` (vd `lib/dataFlow.ts`), không tính trong component.
- **Chỉ cộng kg** khi gộp qua kênh: XK tính USD, NĐ tính VND ⇒ không cộng giá trị khác tiền tệ ([33](../app-map/33-ban-hang.md)). Tiền chỉ hiện ở chỗ có một tiền tệ (cân đối kỳ quy VND).
- Định mức / lãi lỗ khi **chưa có TP** ⇒ ghi "chưa có thành phẩm", không hiện 0 ([31](../app-map/31-can-doi-ky.md) §công thức).
- Hình mới là **pattern trong `design-system/patterns`**, tự dựng SVG/HTML + token (cùng họ `BarChart`), theo luật biểu đồ ở [`design-system/README.md` § Quy chuẩn mobile](../../src/design-system/README.md): khung cuộn ngang có chủ đích, `min-w` = bề rộng viewBox, chữ ≥ 12 theo token, qua 360px + 130%. Mỗi hình có **bảng số đi kèm** (`SummaryTable`, có `rowMarks`) để kế toán dò được — hình là để nhìn, bảng là để đối chiếu. Bấm vào một phần của hình ⇒ mở đúng màn nguồn đã lọc sẵn. Thao tác xem không toast.
- Không thêm thư viện biểu đồ. **Chỉ dùng hình đọc là hiểu** — thẻ số, thanh, cột, đường, thanh chia phần 100%. Sơ đồ cần học cách đọc (sankey, cây phức tạp) thì không: đã thử sankey + `d3-sankey` rồi gỡ (2026-10-12).
- **Màu theo LOẠI số**, dùng nhất quán trên màn: nhập `bien` · sản xuất `tim` · kho `ngoc` · đóng gói `bang` · bán/xuất `la` · định mức `cat`. Số tốt/xấu (lãi/lỗ, việc tồn) giữ màu nghĩa (xanh lá / đỏ / cam).

### Danh mục hình (P1 = cần cho buổi demo đầu, P2 = sau)

> **Trạng thái 2026-10-12:** ✅ V1 · V2 · V3 · V4 · V5 · V7 (bảng kỳ ở Tổng quan) · V8 · V9 — `features/dashboard/DashboardScreen.tsx`, số từ `lib/dataFlow.ts` (14 test, gồm bất biến cân bằng kg). ✅ V6 "lãi/lỗ đến từ đâu" (2 thanh + chia phần, ô Ghi chú của `/balancing/:kỳ`) · V10 "lô đi đâu" (thanh chia phần ở mục Cân bằng khối lượng `/qr`) · V12 tuổi tồn (`/warehouse`, hàm `bucketStockByAge`) · V16 QC 30 ngày (`/qc`, hàm `countQcByDay`). Bỏ V11/V13/V14/V15 (xem §6 V-c).
>
> Ghi chú khi build: sơ đồ V3 gộp nút "TP đóng gói" vào khâu đóng gói (6 cột thay 7 — 7 cột thì nhãn đè nhau); % ở băng chuyền V2 so với **khâu nguồn** (đóng gói và xuất/bán chia cho nhập kho, không chia nối tiếp); V4 chưa vẽ tồn NL (sổ NL chưa trừ phần đưa vào SX); chuỗi theo ngày dừng ở hôm nay; V8 chỉ tính mẻ đã gắn lô NL có cân kg (thiếu thì để trống, không đoán).

| # | Hình | Đặt ở | Câu trả lời cho người xem | Nguồn số (bảng → hàm) | Ưu |
|---|---|---|---|---|---|
| V1 | **Thẻ KPI chuỗi** (8 thẻ): NL nhập kg · TP sản xuất kg · định mức bình quân · tồn cuối NL / BTP / TP kg · bán + xuất kg · lãi/lỗ kỳ gần nhất · % lô đã gắn · việc tồn đọng (ngày chưa chốt, BTP chờ duyệt, lô chưa gắn) | `/dashboard` đầu trang, có chọn kỳ | "Tháng này xưởng chạy thế nào" trong 5 giây | imports, wips, tồn (`computeWipStock*`), sales/export, `calculateBalancing`, `groupByTraceStage` → `StatCardGrid` | P1 |
| V2 | **Băng chuyền 5 khâu**: Nhập NL → SX BTP → Nhập kho → Đóng gói → Xuất/bán; mỗi ô: kg đã qua · kg đang chờ · số việc chưa xong; mũi tên ghi % chuyển tiếp | `/dashboard` | "Số đang kẹt ở khâu nào" — bản gọn của sankey, **xem được trên điện thoại** | `groupByTraceStage` + tồn | P1 |
| V3 | ~~Sơ đồ dòng chảy kg (sankey)~~ ⇒ **thay bằng 2 thanh chia phần** (2026-10-12, người dùng thấy sankey khó hiểu). Bản cũ: Đại lý (5 lớn + khác) → loại NL → xưởng Đông/Cá/Khô → {thành phẩm · phế liệu · hao hụt · còn dở/đông gửi · bán nội địa} → kho dự trữ → {đóng gói → TP} → {xuất khẩu · bán nội địa · tồn} | `/dashboard` (desktop; điện thoại hiện V2 thay) | "1 tấn nguyên liệu đi đâu" — điểm nhấn buổi demo | hàm mới `buildDataFlow(kỳ)`; **test bất biến: tổng vào = tổng ra + tồn + hao hụt** ở mọi nút | P1 |
| V4 | **Tồn theo ngày** (đường / vùng xếp chồng NL · BTP · TP) + vạch các ngày chốt | `/dashboard`, `/nxt-material`, `/warehouse` | "Tồn đang tăng hay giảm, có đọng không" | `computeMaterialNxt`, `computeFinishedGoodNxt` theo từng ngày | P1 |
| V5 | **Nhập ↔ SX theo ngày** (cột đôi: kg NL vào · kg TP ra) + đường định mức theo ngày | `/dashboard`, `/wip` tab báo cáo | "Ngày nào nhập nhiều mà SX ít" | imports + wips | P1 |
| V6 | **Thác nước kỳ cân đối**: giá trị NL + chi phí chế biến = giá thành → so với giá trị xuất ⇒ lãi/lỗ; kèm định mức, bình quân/kg NL | `/balancing/:kỳ` (trên bảng A4, không in) | "Kỳ này lãi/lỗ vì đâu" | `calculateBalancing` (không đổi công thức) | P1 |
| V7 | **So sánh các kỳ**: thanh lãi/lỗ + định mức từng kỳ theo loại NL | `/balancing` danh sách kỳ | "Loại NL nào làm ra lãi, định mức có trôi không" | `calculateBalancing` × mọi kỳ | P1 |
| V8 | **Định mức theo mặt hàng** (thanh ngang + đường trung bình, tô mặt hàng lệch > ±x%) | `/wip` báo cáo, `/production-report` | "Mặt hàng nào hao NL bất thường" | wips (+ lô gắn) → `BarChart` có sẵn | P1 |
| V9 | **Bảng cảnh báo chuỗi**: ngày chưa chốt · ghi bù (kèm lý do) · lệch tổng ngày · bán vượt tồn · lô chưa gắn / có lý do · định mức lệch · BTP chờ duyệt quá N ngày. Mỗi dòng bấm ⇒ mở đúng chỗ sửa | `/dashboard` | "Hôm nay phải đốc ai làm gì" — chính là công cụ đốc công | hàm mới `buildChainWarnings()` có test, đọc các cờ engine đã trả | P1 |
| V10 | **Cây truy xuất lô** vẽ thành sơ đồ (ngược: TP → BTP → NL → đại lý; xuôi: NL → mẻ → đóng gói → khách), độ dày nhánh = kg, kèm cân bằng kg | `/qr` hộ chiếu lô | "Quét một tem ra cả lịch sử" | `traceBackward` / `traceForward` / `computeLotMassBalance` | P1 |
| V11 | **Độ phủ gắn lô theo khâu** (thanh tiến độ 5 khâu, % kg đã gắn) | `/qr` tab Theo giai đoạn, `/dashboard` | "Truy xuất đã đủ để thu hồi chưa" | `groupByTraceStage` | P2 |
| V12 | **Tuổi tồn kho đông** (nhóm < 30 · 30–60 · 60–90 · > 90 ngày, theo kho/xưởng) | `/warehouse` | "Hàng nào nằm kho lâu, phải đẩy trước" | `computeWipStockDetail` (FIFO theo lô) | P2 |
| V13 | **Bản đồ nhiệt nhập hàng** ngày × đại lý (kg) | `/imports` báo cáo | "Đại lý nào giao đều, ai thất thường" | imports | P2 |
| V14 | **Tiến độ đơn đặt**: đặt vs đã xuất (thanh) theo đơn/khách, hạn giao | `/orders`, `/export-report` | "Đơn nào sắp trễ" | sales_orders + export_* | P2 |
| V15 | **Cơ cấu bán** (kg): XK / nội địa / bán lẻ theo khách lớn | `/sales` báo cáo | "Hàng ra kênh nào" | sales_items + domestic_sales | P2 |
| V16 | **Điểm QC theo ngày / xưởng** (đường) + tỉ lệ đạt | `/qc` | "Chất lượng có đi xuống không" | qc_checklists | P2 |

V1 + V2 + V3 + V9 dựng lại **`/dashboard` thành màn "Dòng chảy số liệu"**: trên = thẻ, giữa = băng chuyền/sankey, dưới = cảnh báo + tồn theo ngày. Bảng tồn theo kho hiện có giữ ở dưới cùng.

### Bộ sinh demo phải tạo ra số "có hình"

Để các hình trên có gì để kể, bộ sinh (§4 mục 6) thêm yêu cầu:

- **≥ 60 ngày liên tục** có nhập + SX (đường tồn V4, cột V5 có dáng), **≥ 4 kỳ cân đối** ở ≥ 2 loại NL, có kỳ lãi và kỳ lỗ (V6, V7).
- Chia đủ 3 xưởng, ≥ 8 đại lý, ≥ 6 khách, cả XK lẫn nội địa (V3, V13, V15).
- Định mức dao động quanh định mức thật của các kỳ cân đối đã có, chèn **1–2 mặt hàng lệch rõ** (V8) và **một lô tồn > 90 ngày** (V12).
- Mỗi loại cảnh báo của V9 có **ít nhất 1 ca**; % lô đã gắn tăng dần theo thời gian (kể chuyện "từ khi dùng QR").
- Cân bằng kg đúng từng nút (V3) — kiểm bằng chính test bất biến của `buildDataFlow`.

## 6. Lộ trình build (đề xuất)

| Đợt | Việc | Tier |
|---|---|---|
| D1 ✅ | Cờ chế độ → `SITE_ID` động + tiền tố khóa `bsf-demo.` + **rào R1, R2, R5** + dải "ĐANG XEM DEMO" + nút bật/tắt (chỉ admin). Test: vòng kiểm nghiệm §4b | 🔴 (đổi đường ghi DB thật) |
| D2 ✅ | Rà R3 (unique/onConflict 0001…0057). Bộ sinh `lib/demo/demoGenerator.ts`: quét → ẩn danh → dời ngày → id mới `demo-` → bù chuỗi. Test bất biến: không kg âm, tồn không âm (trừ ca cố ý), mọi lô truy ngược/xuôi được, cân đối ra định mức hợp lý, **không id nào trùng id thật** | 🟡 |
| D3 ✅ (trừ file mẫu) | ~~Hàm `demo_reset()`~~ ⇒ "Làm mới bộ demo" qua diff repo (R4) + migration `0058` thêm site `site-demo`. Còn: file Excel đối soát mẫu + ảnh OCR mẫu (người trình bày tự chuẩn bị) | 🟡 |
| V-a ✅ | (song song D1–D3, không phụ thuộc demo) Hàm thuần `lib/dataFlow.ts` (`buildDataFlow`, `buildChainWarnings`, chuỗi tồn theo ngày) + test bất biến; pattern mới `BieuDoDuong` (V4), `BieuDoThacNuoc` (V6), `PipelineStages` (V2) | 🟢 |
| V-b ✅ (trừ V6, V10) | Dựng lại `/dashboard` "Dòng chảy số liệu" (V1, V2, V4, V5, V9) + V6/V7 ở Cân đối + V8 + V10 ở `/qr` | 🟢 |
| V-c ✅ | ~~Sankey V3~~ (thay bằng thanh chia phần) + P2 đã làm V12 tuổi tồn (`/warehouse`), V16 QC 30 ngày (`/qc`); thêm V6 "lãi/lỗ đến từ đâu" (`/balancing/:kỳ`) + V10 "lô đi đâu" (`/qr`). Bỏ: V7 biểu đồ (bảng kỳ ở Tổng quan đủ), V11, V13 (bản đồ nhiệt — khó đọc), V14, V15 (đã có ở màn gốc). Bản cũ: (sau khi chốt có dùng `d3-sankey` không) + nhóm P2 (V11–V16) | 🟢 (🟡 nếu thêm dependency) |
| D4 ✅ | Gỡ 5 màn DEMO khỏi app thật (route, `DEMO_IDS`, `demoGuard`, badge) theo kết quả câu 3; xoá file mock chết ở `features/dashboard/` (`mockDashboardData.ts`, `AlertPanel`, `LineStatusWidget`, `WorkOrderTable`, `CommonWidget` — `DashboardScreen` không còn import) + `patterns/MockPatternData.tsx` nếu không ai dùng; dọn `docs/demo/` cũ (đánh dấu lỗi thời, cấm chạy `seed_bt2da*.sql`) | 🟡 |
| D5 ✅ | Kịch bản trình bày mới `docs/demo/kich-ban-che-do-demo.md` (bản cũ đánh dấu lỗi thời). Còn: chạy thử trọn kịch bản trên DB thật (`0058` đã chạy 2026-10-13) | 🟢 |

Cổng mỗi đợt theo CLAUDE.md: `build` + `lint` + `test`; D1 thử cả hai chế độ (có `.env`, không `.env`) + ngắt mạng ở chế độ thật để chắc hàng chờ thật vẫn lên server sau khi qua lại demo.

## 7. Quyết định đã chốt (chủ dự án, 2026-10-12)

1. **Nơi chứa:** **B — `site-demo` trong DB thật** (khuyến nghị là A; chủ dự án chọn B để dùng chung nhiều máy) ⇒ bắt buộc §4b.
2. **Ẩn danh:** mặc định ẩn tên đại lý/khách + đổi giá; có công tắc giữ tên thật khi trình bày nội bộ.
3. **`/production`, `/reports`:** **xóa hẳn**. `/traceability`, `/quality`, `/cold-storage` cũng gỡ (đã có `/qr`, `/qc`, `/warehouse`). Hết `DEMO_IDS` / `demoGuard` / badge DEMO trên nav.
4. **Quyền bật demo:** **chỉ admin**.
5. **Trực quan hoá (§5b):** làm lại `/dashboard` thành "Dòng chảy số liệu" · dùng `d3-sankey` · ngưỡng định mức lệch **±5%** (chốt 2026-10-12).

## 8. Quy tắc (ghi vào CLAUDE.md quy tắc 15)

- **Không** thêm màn / bảng / số liệu mẫu cứng vào app thật nữa. Muốn trình diễn ⇒ chế độ demo.
- Hình báo cáo (thẻ, biểu đồ) là tính năng thật: số đi qua engine có test hoặc hàm thuần mới có test, có bảng số đi kèm, chỉ cộng kg khi khác tiền tệ, là pattern ở `design-system/patterns`.
- Chức năng mới ghi bảng mới ⇒ cùng commit: thêm bảng vào bộ sinh demo (`lib/demo/`) + thêm dòng vào checklist §5.
- Chế độ demo chỉ ghi dòng `site_id='site-demo'` có id tiền tố `demo-`, chỉ dùng khóa `bsf-demo.*`; **mọi lệnh xóa lọc `site_id`**; khi demo bật, dấu "DEMO" luôn hiện (header, tab, bản in, file xuất).
