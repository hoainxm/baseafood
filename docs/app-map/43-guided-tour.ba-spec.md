# 43 — ba-spec: Hướng dẫn thao tác trên trang (tour từng bước) — MỌI trang nghiệp vụ (đầu tiên: Xuất khẩu)

> Load khi: thêm / sửa hướng dẫn từng bước của một trang (đi qua các nút và luồng việc ngay trên trang), THÊM TRANG MỚI (quy tắc 18 — trang mới phải có tour + hộp "?"), hoặc một trang đổi bố cục / trạng thái / luồng làm tour lệch.
covers: src/lib/exportPlanning.ts, src/lib/guidedTour.ts, src/design-system/patterns/GuidedTour.tsx, src/design-system/patterns/GuideButton.tsx, src/features/shared/PageTourProvider.tsx, src/features/shared/guideContent.tsx, src/features/shared/guides/**, src/features/shared/pageTourCoverage.test.ts, src/features/**/*Tour.ts
last_verified: 2026-10-31
<!-- updated: 2026-10-31 (bộ lọc) — thêm bộ lọc theo ba-spec [53](53-filters.ba-spec.md): 12 bước tour nói lọc được theo gì; hộp "?" 13 trang thêm mục "Bộ lọc" tự ghép qua FILTER_NOTES (guideContent.tsx), canh bằng filterCoverage.test.ts. Khung chung FilterBar / SearchField, tổng theo dòng đang hiện, "Bỏ hết bộ lọc". -->
<!-- updated: 2026-10-30 (c) — tour Nhập hàng thêm chế độ `invoices` + 2 bước (khi có `imports.invoices`): `invoice-cards` (tab Hóa đơn + 4 thẻ việc còn lại, điều kiện xong = 4 thẻ về 0) · `invoice-saved` (nạp file khi có quyền ghi + đủ 8 kết quả dòng + cách xử). Tổng bước đủ quyền = 22 (trần R9). Hộp "?" Nhập hàng thêm mục Hóa đơn đại lý. -->
<!-- updated: 2026-10-30 (audit 3 trang) — rà hộp "?" + tour Nhập khẩu, Lệnh sản xuất, Xuất khẩu với code: thêm mục "Trong chuỗi Nhập khẩu → Lệnh sản xuất → Xuất khẩu" ở cả 3 hộp; sửa 4 câu dễ hiểu nhầm (phát hành chỉ xong bước 2 của chuyến ĐÃ GẮN; chỉ lần nhập đã ghi thực nhập chọn được làm NL; nút "Xem n lệnh đã hủy" + ô tra tìm cả lệnh hủy; thứ tự Việc tiếp); bổ sung: ô Khác bắt ghi (Hình thức thanh toán, Tên hồ sơ, Tên chứng từ, Chỉ tiêu Khác), khối Lập lệnh / Gắn lệnh ở bước 2, cột Đã ra lệnh, luật chặn lưu lệnh, lọc khách, HĐ nhập không lần nhập không đóng được, cảnh báo kiểm mẫu. Đi hết 3 tour ở 360 px × 130 %: không tràn. -->
<!-- updated: 2026-10-30 (báo cáo) — tour Nhập khẩu: bước "tabs" đổi thành "Lô nhập, Hợp đồng và Báo cáo"; tour Lệnh sản xuất thêm bước "tabs" (mốc `order-tabs`, Lệnh · Báo cáo). Hộp "?" hai trang thêm mục "Báo cáo" (ba-spec 50). -->
<!-- updated: 2026-10-30 (b) — tour Danh mục thêm bước tab "Loại hàng" (mốc `catalog-goods-types`, CATALOG_TAB_LABELS); mốc mới ở phiếu HĐ `export-line-goods-type`, `import-line-goods-type`. -->
<!-- updated: 2026-10-30 — trang MỚI `/planning-production`: `features/production-orders/productionOrderTour.ts` (11 bước: giới thiệu theo quyền ghi / chỉ xem, lập lệnh, thẻ số, tra, danh sách, trạng thái + cờ Theo bản HĐ trước, việc tiếp, thông tin, dòng hàng, NL nhập khẩu dự kiến, chuyến xuất) + hộp "?" dạng quy trình `guides/productionOrderGuide.tsx` (4 bước, thêm vào `checkFlow` của flowGuide.test). Đi hết tour ở 360 px × 130 %: không tràn, đóng xong về danh sách. -->
<!-- updated: 2026-10-30 — tour Xuất khẩu bước "Lập hợp đồng" + tour Nhập khẩu bước lập HĐ kể nút Chép dòng (và nhiều file ở phiếu HĐ xuất); hộp "?" Xuất khẩu thêm 2 mẹo (Chép dòng, nhiều file), Nhập khẩu thêm mục "Chép dòng hàng". Mốc mới `export-line-copy`, `import-line-copy`, `export-contract-files`. -->
<!-- updated: 2026-10-30 — tour Nhập khẩu thêm bước tùy chọn "Kiểm mẫu của kho" (mốc `import-receipt-samples`, lần nhập đầu của hồ sơ); hộp "?" thêm mục "Kiểm mẫu của kho" (nạp Excel tự chọn cột, ảnh chỉ đính, chỉ lưu không tính, nạp lại thì thay) — ba-spec 45 v4. -->
<!-- updated: 2026-10-29 (f) — v5 HỘP "?" DẠNG QUY TRÌNH (chủ dự án: "nhiều chữ, nên tách các bước, minh họa trực quan, nêu phân quyền"): Xuất khẩu + Nhập khẩu viết lại bằng khối `guides/flowGuide.ts` (dữ liệu: bước · quyền cần · nhóm làm · trạng thái) + `guides/FlowGuideBlocks.tsx` (Việc của bạn · Quy trình có số · chuỗi trạng thái · Ai làm gì · mẫu thanh tiến độ); hộp "?" Xuất khẩu tách ra `guides/exportPlanningGuide.tsx`; `App.tsx` bọc nội dung hộp trong `PermissionProvider`; `GuideButton` nút bắt đầu xuống dòng ở màn hẹp. R18–R21, AC-17…AC-20 (`guides/flowGuide.test.ts` đối chiếu nhóm làm ⇄ ma trận quyền thật). Tour 2 trang KHÔNG đổi. -->
<!-- updated: 2026-10-29 (e) — tour Nhập khẩu: bước Lập hợp đồng thêm câu chọn Mặt hàng (danh mục) + gợi ý; bước Dòng hàng kể nhãn "Chưa nối" và luật chưa nối thì chưa đóng HĐ; bước Thực nhập nói đóng cần đã nối. Hộp "?" thêm mục "Nối dòng hàng với mặt hàng danh mục" (ba-spec 45 R20–R22). -->
<!-- updated: 2026-10-29 (d) — tour Danh mục thêm bước tab "NCC nhập khẩu" (CATALOG_TAB_LABELS, câu chung "các tab danh mục trừ Thành phẩm"); tour + hộp "?" Nhập khẩu đổi chữ đối tác sang danh mục NCC nhập khẩu (ba-spec 45 v2). pageTourCoverage + catalogTour.test xanh. -->
<!-- updated: 2026-10-29 (c) — trang MỚI `/planning-import`: `features/import-planning/importTour.ts` (11 bước, kể trạng thái lô Thiếu chứng từ → Chờ thực nhập → Đủ hồ sơ, điều kiện xong chứng từ, đóng HĐ thiếu phải có lý do) + hộp "?" `features/shared/guides/importPlanningGuide.tsx`; pageTourCoverage xanh. -->
<!-- updated: 2026-10-29 (b) — tour Danh mục thêm bước "Loại chứng từ" (mốc `catalog-document-kinds`, tab mới, giải thích loại gốc có luật riêng · loại thêm mới như Chứng từ khác). -->
<!-- re-verified: 2026-10-29 10:30 — §9b Xuất khẩu: 3 dòng Hợp đồng (trạng thái · cảnh báo · việc tiếp) đối chiếu CONTRACT_STATE_LABELS / CONTRACT_FLOW_STAGES / ContractDossier sau v9 (bỏ duyệt HĐ); tour exportTour.ts + hộp ? planning-export sửa cùng. -->
<!-- re-verified: 2026-10-27 10:00 — §11 lệch doc: đối chiếu từng mục với code (MaterialNxtScreen, MaterialGrid, MaterialImportScreen, WipProductionScreen, DocumentDetailDialog, documents.buildDocumentWarnings + myTasks, SalesOrderScreen, QcChecklistScreen.reopen, BalancingScreen carry-over) — khớp mô tả §11 -->
ttl_days: 90
<!-- updated: 2026-10-22 (d) — v4: mở rộng ra MỌI trang nghiệp vụ (21 trang có route, trừ 5 trang quản trị miễn): NV5 + R13–R17 + AC-12…AC-16; quy tắc 18 CLAUDE.md; cổng `pageTourCoverage.test.ts` quét route ⇄ tour ⇄ hộp "?" ⇄ mốc data-tour; §9c kiểm kê theo trang. -->
<!-- updated: 2026-10-28 (b) — audit sau khi chạy 0079: bước MỚI "Hồ sơ đính kèm" (mốc `contract-attachments`, trước đó chỉ nhắc trong bước Điều khoản mà khung sáng trỏ khối khác); bỏ bước "Danh sách chuyến" (gộp vào "Thông tin và trạng thái chuyến") ⇒ vẫn 22 bước; "Trạng thái mục và file" thêm điều kiện xong bước 1 Hợp đồng (đã duyệt + đủ hồ sơ); hộp "?" thêm cùng câu. Chạy thật 360 px × 130 % trên preview demo: 22 bước, `scrollWidth` 360 mọi bước, khung lời luôn trong màn, dữ liệu `bsf*` không đổi, đường dẫn trả về. -->
<!-- updated: 2026-10-28 — tour + hộp "?" Xuất khẩu theo quy trình v8 (ba-spec 41 §0): giới thiệu 4 chặng; trạng thái HĐ 6 nhãn (Chờ duyệt · Chờ đính kèm · Đang ghi chuyến · Chờ duyệt cuối · Đã đóng HĐ · Đã hủy) + điều kiện sang chặng sau + ai làm; bước MỚI "Thanh chặng của hợp đồng" (mốc `contract-flow`) ⇒ 22 bước (trần §8); bước "Việc tiếp theo" nói nút theo vai trò + thẻ chờ; bước cuối hồ sơ gộp Hồ sơ đính kèm · Điều khoản · Nhật ký + chú thích viết tắt. Hộp "?" thêm mục Nhật ký thao tác. Test AC-10 bỏ nhãn cũ "Đã chốt HĐ". -->
<!-- updated: 2026-10-22 — lời tour Xuất khẩu theo nhãn v5 (ba-spec 41 v5): bước "Lịch xuất hàng, Hợp đồng và Báo cáo" nói thêm tab Báo cáo · "số PO của khách" thay "số đơn của khách" · thẻ "Trễ hạn giao n ngày" · "Đang làm · xong k/5 bước bắt buộc" · bước 6 "Gửi chứng từ · tiền về". Không đổi mốc `data-tour`, số bước giữ nguyên; test `exportTour.test.ts` xanh. -->
<!-- re-verified: 2026-10-21 — v3: áp nhánh nội dung của skill ba-flow-logic (references/06): §9b kiểm kê 9 nhóm mục có nguồn, R10–R12, AC-10/11 test đọc hằng số nhãn của lib/exportPlanning. -->
<!-- re-verified: 2026-10-21 — v2: nhãn "Hướng dẫn thao tác", 21 bước (thêm trạng thái HĐ · việc tiếp · cột Tiến độ · trạng thái mục và file), chạy thật trên preview demo 1366 px + 360 px × 100 / 130 %. -->

> **Mục đích**: oracle HÀNH VI cho tour — ai mở, đi qua những gì, kết thúc ra sao, KHÔNG được làm gì. Giao diện tour ở design-spec [42 § Hướng dẫn thao tác](42-export-planning-ui.design-spec.md) + README design-system § Hướng dẫn thao tác (`GuidedTour`). Luồng nghiệp vụ Xuất khẩu mà tour kể lại: ba-spec [41](41-export-planning.ba-spec.md) (KHÔNG đổi ở đây).

---

## 1. Vấn đề & JTBD
- **Job**: Khi lần đầu (hoặc lâu rồi mới) mở trang Xuất khẩu, nhân viên Kế hoạch muốn được **dẫn tận nơi** qua từng chỗ trên trang theo đúng thứ tự công việc (xem lịch → mở hồ sơ → việc tiếp → chuyến → bước còn thiếu), để tự làm được mà không phải hỏi người khác hay đọc tài liệu dài.
- **Vì sao làm bây giờ**: trang Xuất khẩu mới (đợt 1, 2026-10-20) nhiều khối, 6 bước, nhiều nút ẩn trong "Thao tác khác"; trang chưa có cả hộp hướng dẫn "?" như các trang khác. Chủ dự án muốn có lối "bấm vào là đi một vòng" thay vì hộp chữ tĩnh.
- **Đo thành công bằng**: người mới đi hết tour (≤ 20 bước, ≤ 3 phút) chỉ ra đúng nơi làm 3 việc chính (lập HĐ · ghi duyệt / lên chuyến · cập nhật mục còn thiếu) mà không cần người kèm.

## 2. User registry
| User (role/tier) | Là ai | Vòng đời | Thiết bị/bối cảnh chính |
|---|---|---|---|
| Nhân viên Kế hoạch (`planner`, quyền ghi `export-plans`) | lập HĐ, lên chuyến, cập nhật bước | mới → quen | desktop văn phòng |
| Người xem (BGĐ / kế toán — chỉ quyền xem `export-plans`) | theo dõi tiến độ, không ghi | quen | desktop / điện thoại |
| Người trình diễn (admin ở chế độ demo) | dùng tour để giới thiệu trang cho người khác | quen | desktop chiếu màn |
| Hệ thống (dữ liệu hiện có của trang) | cung cấp hợp đồng / chuyến để tour mở minh họa | — | nền |

> Người đóng hàng (chỉ quyền `.loading`, màn đóng hàng riêng) — OUT đợt này (§7).

## 3. User × Nghiệp vụ
| # | Nghiệp vụ | Owner-user | User liên quan | Phụ thuộc NV | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Đi một vòng hướng dẫn trang Xuất khẩu (xem lịch → hồ sơ → chuyến) | Nhân viên Kế hoạch | Người xem, Người trình diễn (cùng luồng, bớt bước ghi) | — | thấp (lần đầu / khi quên) | Must |
| NV2 | Dừng / quay lại / bỏ qua giữa chừng, trả trang về chỗ cũ | Nhân viên Kế hoạch | như NV1 | NV1 | mỗi lần tour | Must |
| NV3 | Đọc hướng dẫn tóm tắt của trang (hộp "?") | Nhân viên Kế hoạch | Người xem | — | thấp | Should |
| NV4 | Khung tour dùng lại cho trang khác (khai bước, không viết lại cơ chế) | Hệ thống (người phát triển khai bước) | — | NV1 | khi thêm trang | Must |
| NV5 | Đi một vòng hướng dẫn ở **mọi trang nghiệp vụ** (Nhập hàng, Sản xuất, Đóng gói, QC, Kho, Đơn đặt, Bán hàng, Cân đối, Sổ kho tháng, các báo cáo tồn / NXT, Đối soát, Mã lô QR, Việc của tôi, Tài liệu, Danh mục, Tổng quan) + đọc hộp "?" của trang đó (v4) | Người dùng của trang (tổ trưởng / thủ kho / kế toán / kế hoạch) | Người trình diễn | NV4 | lần đầu / khi quên | Must |
| NV6 | Trang mới (về sau) ra đời KÈM tour + hộp "?" — không có thì không lên được (v4) | Hệ thống (người phát triển) | — | NV4 | mỗi trang mới | Must |

## 4. Cross-user handoff map
N/A — không cross. Tour chỉ ĐỌC và DẪN; không tạo bản ghi, không chuyển việc cho ai.

## 5. Flows
### Flow NV5 — Đi một vòng ở một trang nghiệp vụ · owner: người dùng của trang (v4)
- **Start**: đang ở một trang nghiệp vụ, dữ liệu đã tải; chọn nút "?" ở thanh tiêu đề → "Bắt đầu hướng dẫn thao tác" (hoặc nút "Hướng dẫn thao tác" trên trang nếu trang có).
- **Input**: quyền của người dùng trên trang (ghi / chốt / chỉ xem), dữ liệu đang có, vị trí trang (ngày, kỳ, tab, bộ lọc).
- **Steps**: (1) lời giới thiệu giữa trang — trang dùng làm gì, ai dùng, khâu nào của chuỗi nhập hàng → sản xuất → kho → bán / xuất, cách đi tour; (2) các khu vực theo thứ tự công việc của trang (chọn ngày / kỳ / bộ lọc → nhập / bảng → tổng / cảnh báo → chốt / xuất); (3) khu vực có trạng thái ⇒ bước giải thích trạng thái, điều kiện chuyển / "xong", cảnh báo, việc tiếp; (4) bước chỉ nút ghi chỉ có với người có quyền.
- **Output**: người dùng biết làm việc chính của trang ở đâu, trạng thái nghĩa gì; trang về chỗ cũ; 0 bản ghi đổi (R1, R5).
- **End**: Kết thúc ở bước cuối, hoặc thoát (NV2).

### Flow NV6 — Khai trang mới kèm hướng dẫn · owner: Hệ thống (người phát triển) (v4)
- **Start**: thêm một route trang mới vào app.
- **Input**: ba-spec / app-map của trang (nguồn trạng thái, luật), màn hình.
- **Steps**: kiểm kê nội dung (§9b / §9c) → file `<trang>Tour.ts` export `tourSpec` (pageId = đoạn đường dẫn) → mốc `data-tour` trên màn → `usePageTour` ở màn → hộp "?" (PAGE_GUIDES) → test phủ nhãn trạng thái (nếu trang có hằng số nhãn) → thử 360 px × 130 %.
- **Output**: cổng `pageTourCoverage.test.ts` xanh; trang có lối vào tour + hộp "?".
- **End**: commit cùng lúc với trang. Thiếu ⇒ CI đỏ (R13), trừ khi ghi vào danh sách MIỄN kèm lý do.

### Flow NV1 — Đi một vòng trang Xuất khẩu · owner: Nhân viên Kế hoạch
- **Start**: đang ở Xuất khẩu (lịch xuất hàng, danh sách HĐ hoặc một hồ sơ), dữ liệu trang đã tải xong.
- **Input**: quyền của người dùng (ghi / chỉ xem / xem tiền về), dữ liệu hợp đồng + chuyến hiện có (thật hoặc demo), vị trí hiện tại của trang (kỳ xem, tab, hồ sơ đang mở).
- **Steps**:
  1. Lời mở: trang dùng để làm gì, 6 bước của một chuyến.
  2. Phần lịch: chỗ chuyển Lịch xuất hàng ↔ Hợp đồng · chỗ Lập hợp đồng (chỉ người có quyền ghi) · chọn kỳ xem tháng / tuần / ngày · lọc khách + tra cứu số giấy tờ · 4 chỉ số của kỳ · bảng chuyến theo khách · **cách đọc cột Tiến độ** (màu 6 khúc, "Bước tiếp", thẻ Trễ hạn / Chờ booking) · HĐ chưa lên đủ chuyến · chỗ mở hồ sơ.
  3. Tour tự mở **một hồ sơ minh họa** (chọn theo R4) và đi tiếp: **trạng thái hợp đồng** (Chờ duyệt · Đã duyệt · Đã xuất đủ · Đã chốt HĐ · Đã hủy + thẻ cảnh báo) · việc tiếp theo + Thao tác khác · tóm tắt HĐ · danh sách chuyến (nếu ≥ 2) · thông tin và **trạng thái chuyến** (Đang làm k/5 · Đủ hồ sơ · Trễ hạn giao · Đã hủy) · bước đang làm · **trạng thái mục và điều kiện file / số để "Xong"** (theo bảng NV8 ba-spec 41) · cập nhật mục · bước 6 gửi chứng từ và tiền về (chỉ người xem được tiền về) · điều khoản / dòng hàng / các bản hợp đồng.
  4. Lời kết: cách mở lại tour.
- **Output**: người dùng đã thấy từng chỗ theo đúng thứ tự công việc; trang trở về đúng vị trí trước khi bắt đầu; **không một bản ghi nào đổi**.
- **End**: bấm Kết thúc ở bước cuối (hoặc NV2).

### Flow NV2 — Dừng / lùi / bỏ qua · owner: Nhân viên Kế hoạch
- **Start**: tour đang chạy ở bước k.
- **Input**: lệnh của người dùng: tới, lùi, thoát (kể cả phím Esc), đổi cỡ màn / cuộn.
- **Steps**: tới ⇒ bước k+1 (bỏ qua bước không áp dụng cho người này, R3) · lùi ⇒ bước k−1 (cũng bỏ qua như trên; bước thuộc hồ sơ thì hồ sơ minh họa được mở lại) · thoát ⇒ dừng ngay.
- **Output**: tour dừng; trang về vị trí lúc bắt đầu (R5).
- **End**: không còn lớp tour; trang dùng được bình thường.

### Flow NV3 — Hộp hướng dẫn "?" · owner: Nhân viên Kế hoạch
- **Start**: bấm "?" ở đầu trang.
- **Input**: nội dung hướng dẫn tĩnh của trang Xuất khẩu.
- **Steps**: đọc tóm tắt → (tuỳ chọn) bắt đầu tour từ đây.
- **Output**: hộp đóng; nếu chọn bắt đầu thì sang Flow NV1.
- **End**: hộp đóng.

### Flow NV4 — Khai tour cho một trang · owner: Hệ thống (khai bước)
- **Start**: trang muốn có tour.
- **Input**: danh sách bước (mỗi bước: chỗ trên trang hoặc không chỗ — lời giữa trang, tiêu đề, lời, có bỏ qua được không, việc chuẩn bị như mở hồ sơ).
- **Steps**: trang đăng ký tour khi đang mở → lối vào tour hiện → khi trang đóng, tour của trang tự gỡ.
- **Output**: lối vào tour chỉ có ở trang đã khai.
- **End**: rời trang ⇒ không còn lối vào tour của trang đó.

## 6. Flow optimization log
| Flow | Candidate đã cân nhắc | Chọn / Loại | Lý do (theo rubric) | Đánh giá bởi | Conflict & xử |
|---|---|---|---|---|---|
| NV1 | A: chỉ hộp chữ tĩnh "?" như trang khác | Loại (giữ làm NV3) | không "đi từ bước này sang bước kia trên trang" — trượt định hướng của yêu cầu | Optimizer | — |
| NV1 | B: tour tự BẤM nút thật (lập HĐ, lưu, duyệt) để trình diễn | Loại | ghi số vào sổ thật — vi phạm R1; huỷ ngang giữa chừng để lại bản ghi dở (dead-end) | Optimizer + Domain (sổ sách) veto | Specialist veto: sổ sách thật không được sinh bản ghi minh họa (quy tắc 15) |
| NV1 | C: tour tự bật chế độ demo rồi đi | Loại | chế độ demo chỉ admin bật, đổi số cả app cho người đó — cross-cutting thừa (rubric 4) | Optimizer | — |
| NV1 | D: tour chỉ dẫn + đổi chỗ xem (mở hồ sơ có sẵn), chặn mọi thao tác trên trang khi đang chạy | **Chọn** | đủ thấy luồng thật, 0 ghi, thoát lúc nào cũng trả trang về chỗ cũ | Optimizer + Domain | — |
| NV1 | D1: mở hộp Lập hợp đồng trong tour để chỉ 5 khối | Loại | hộp mở lẫn với nháp tự lưu (quy tắc 17) và chặn lớp tour; lời ở bước Lập hợp đồng đã kể 5 khối | Optimizer | — |
| NV2 | lùi qua ranh giới lịch ↔ hồ sơ: A giữ hồ sơ mở · B trả về lịch | Chọn B | bước lịch phải thấy đúng lịch (Input đủ / Output rõ) | Optimizer | — |

## 7. Scope & Priority
- **IN**: cơ chế tour dùng chung (NV2, NV4); tour + hộp "?" cho Xuất khẩu (NV1, NV3); **v4: tour + hộp "?" cho MỌI trang nghiệp vụ có route (NV5) và luật bắt buộc cho trang mới (NV6)**.
- **MIỄN (R13)**: trang quản trị chỉ admin — `/users`, `/admin`, `/roles`, `/audit` — và `/kit` (trang mẫu giao diện). Màn đóng hàng của Xuất khẩu (`.loading`) là một chế độ của trang Xuất khẩu, chưa có tour riêng.
- **OUT**: tự mở tour lần đầu vào trang; nhớ "đã xem tour"; mở hộp form trong tour; video / ảnh động; tour cho từng hộp thoại.

## 8. Success metric
| Nghiệp vụ | Metric | Ngưỡng đạt |
|---|---|---|
| NV1 | số bước tour Xuất khẩu (đủ quyền, có hồ sơ minh họa) | 12 ≤ n ≤ 22 (hiện 22 — v8 thêm "Thanh chặng của hợp đồng") |
| NV1 | bản ghi bị đổi sau một vòng tour | 0 |
| NV2 | vị trí trang sau khi thoát (đường dẫn) | == lúc bắt đầu |
| NV1 | khung lời tour ở điện thoại 360 px, chữ 130 % | nằm trọn trong màn (0 px tràn) |
| NV5 | trang nghiệp vụ có route mà thiếu tour hoặc thiếu hộp "?" (ngoài danh sách MIỄN) | 0 |
| NV6 | trang mới lên `main` không kèm tour | 0 (CI chặn) |
| v5 R20 | bước hộp "?" mà nhóm làm lệch ma trận quyền | 0 (test chặn) |
| v5 R21 | phần tử cuộn ngang / thẻ bị cắt chữ trong hộp ở 360 px × 130 % | 0 |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | Tour KHÔNG ghi / sửa / xóa bất kỳ bản ghi nào; trong lúc tour chạy, mọi thao tác lên trang bị chặn (chỉ tới / lùi / thoát) | bấm vào chỗ đang được chỉ ⇒ không có gì xảy ra |
| R2 | Thứ tự bước = thứ tự công việc của ba-spec 41 (xem → lập HĐ → duyệt → lên chuyến → bước còn thiếu → tiền về) | — |
| R3 | Bước gắn với chỗ không có cho người này (thiếu quyền, chưa có dữ liệu, < 2 chuyến) được bỏ qua cả khi tới lẫn khi lùi; bước bắt buộc mà chỗ chưa hiện ⇒ hiện lời giữa trang, không treo | chỗ hiện chậm (đang tải) ⇒ đợi tối đa 3 giây rồi mới coi là không có |
| R4 | Hồ sơ minh họa chọn theo thứ tự: HĐ đang chạy có chuyến chưa đủ hồ sơ → HĐ có chuyến bất kỳ → HĐ bất kỳ (ưu tiên đã duyệt, hạn giao gần nhất); không có HĐ nào ⇒ phần hồ sơ thay bằng MỘT lời giữa trang kể luồng, không mở gì | HĐ đã hủy chỉ dùng khi không còn HĐ nào khác |
| R5 | Thoát (ở bước nào, cách nào) ⇒ trang về đúng vị trí lúc bắt đầu (tab, kỳ xem, hồ sơ đang mở, vị trí cuộn) | bắt đầu từ trong một hồ sơ ⇒ thoát về chính hồ sơ đó |
| R6 | Bước có số thứ tự "k/n" với n = số bước còn hiệu lực cho người này (bước tùy chọn cùng chỗ xem mà chỗ không có thì trừ ra ngay khi tới chỗ xem đó — số không nhảy cóc) | — |
| R7 | Lối vào tour chỉ có khi trang đã khai tour và dữ liệu trang đã tải | đang tải ⇒ chưa có lối vào |
| R8 | Tour không tự bật; chỉ chạy khi người dùng chọn | — |
| R9 | Lời tour = văn phong tài liệu hướng dẫn (`src/design-system/noi-dung-va-label.md`): gọi đúng chữ đang hiện trên trang (tên nút, nhãn trạng thái), "chọn" thay "bấm", tiêu đề bước là danh từ không chấm cuối, lời kết thúc bằng dấu chấm; điều kiện trạng thái lấy đúng luật ba-spec 41 (không tự đặt) | nhãn trạng thái đổi ở code ⇒ sửa lời tour cùng commit |
| R10 | **Phủ nội dung**: lời tour + hộp "?" phủ đủ mọi mục ở §9b — khu vực có trạng thái thì giải thích trạng thái, điều kiện "Xong", cảnh báo và việc tiếp theo, không chỉ gọi tên khu vực | thêm trạng thái mới ở code ⇒ AC-10 đỏ cho tới khi lời tour có |
| R11 | **Nguồn nội dung**: mọi điều kiện / cách tính trong lời trích từ luật của ba-spec 41 ghi ở cột Nguồn của §9b; không tự diễn đạt lại làm đổi nghĩa | luật 41 đổi ⇒ sửa dòng §9b và lời cùng commit |
| R12 | **Đồng bộ**: `covers` gồm cả `src/lib/exportPlanning.ts` (nơi giữ hằng số nhãn) — đổi nhãn ở đó thì soát lời tour | — |
| R13 | **Phủ trang (v4)**: MỌI route trang trong `App.tsx` (bỏ route chuyển hướng, route có tham số) phải có tour (`tourSpec.pageId` == đoạn đường dẫn, màn gọi `usePageTour`) **và** hộp "Hướng dẫn: <trang>" (`PAGE_GUIDES`), trừ danh sách MIỄN kèm lý do (quản trị chỉ admin, trang mẫu giao diện). Thêm trang mới ⇒ tour + hộp "?" cùng commit (quy tắc 18) | trang bị gỡ route ⇒ gỡ tour + bỏ khỏi MIỄN (test báo thừa) |
| R14 | **Hộp "?" (v4)**: tóm tắt tĩnh của trang — các việc theo thứ tự, trạng thái và cảnh báo, mẹo; đầu hộp TỰ có lối "Bắt đầu hướng dẫn thao tác" khi trang có tour. Hộp và tour cùng nguồn luật, không mâu thuẫn | — |
| R15 | **Khuôn tour mọi trang (v4)**: bước 1 = lời giới thiệu giữa trang (không gắn chỗ) — trang làm gì, ai dùng, khâu nào của chuỗi nhập → sản xuất → kho → bán / xuất, cách đi tour; 3 ≤ số bước ≤ 22; id bước không trùng; mọi mốc `data-tour` mà bước chỉ tới có trên màn; văn phong R9; bước chỉ nút ghi (Thêm / Lưu / Chốt / Nạp…) là bước tùy chọn và chỉ có với người có quyền ghi; khu vực có trạng thái có bước giải thích trạng thái (R10) | trang báo cáo chỉ xem ⇒ tour ngắn (5–9 bước), vẫn phải giải thích cách đọc cột / cách tính |
| R16 | **Lối vào (v4)**: nút "?" ở thanh tiêu đề là lối vào chuẩn của mọi trang (hộp R14 + Bắt đầu). Nút "Hướng dẫn thao tác" ngay trên trang chỉ thêm cho trang nhiều khối, theo khuôn Xuất khẩu (`outline`, icon `Route`, `data-tour-start`) | — |
| R17 | **Đồng bộ trang ⇄ tour (v4)**: đổi khu vực / nhãn trạng thái / nút chính của trang ⇒ sửa tour + hộp "?" cùng commit; mốc `data-tour` ổn định (đổi tên mốc = sửa bước) | mốc bị xoá khỏi màn ⇒ test "mốc có trên trang" đỏ |
| R18 | **Hộp "?" dạng quy trình (v5)** — trang có luồng nhiều người (đầu tiên: Xuất khẩu, Nhập khẩu) viết hộp bằng khối dữ liệu (`guides/flowGuide.ts`), không bằng đoạn văn: (1) ô **Việc của bạn**; (2) **Quy trình** 3–8 bước có số, mỗi bước: tên · nhóm làm · việc làm (≤ 2 câu, gọi đúng tên nút) · điều kiện xong · trạng thái sau bước; (3) **chuỗi trạng thái** dùng đúng nhãn + màu thẻ của trang, mỗi trạng thái: nghĩa + việc tiếp · ai làm; (4) **Ai làm gì** — thẻ mỗi nhóm, danh sách bước LẤY TỪ quy trình (không viết tay lần hai); (5) Mẹo ngắn | trang chỉ một người dùng / báo cáo ⇒ giữ hộp dạng danh sách (R14) |
| R19 | **Việc của bạn theo quyền thật** — bước được đánh dấu khi tài khoản đang đăng nhập có quyền `needs` của bước (`can()`), không suy từ tên vai trò ⇒ vai trò tự tạo, quyền riêng từng người cũng đúng. Không bước nào ⇒ "chỉ xem trang này". Hộp "?" nằm ngoài thân trang ⇒ `App.tsx` bọc nội dung hộp trong `PermissionProvider` | admin ⇒ mọi bước |
| R20 | **Nhóm làm khớp ma trận quyền** — với mỗi bước, tập vai trò hệ thống (trừ admin) của các nhóm ghi ở bước == tập vai trò có quyền `needs` theo ma trận mặc định (`lib/permissions.ts`); mọi vai trò xem được trang nằm trong đúng một nhóm. Đổi ma trận quyền mà quên hộp ⇒ test đỏ | quyền chỉnh tay ở "Vai trò & quyền" không làm đỏ test (R19 vẫn hiện đúng cho người đó) |
| R21 | **Ít chữ, đọc được ở 360 px × 130 %** — mỗi bước ≤ 2 câu; thẻ trạng thái không bị cắt chữ; hộp không cuộn ngang. Màn hẹp: số bước vào dòng tiêu đề (bỏ cột số), bỏ mũi tên trước thẻ kết quả | — |

## 9b. Kiểm kê nội dung (nhánh nội dung — skill ba-flow-logic references/06)
Mỗi dòng: người đọc gặp gì · lời phải nói gì · nguồn. Văn phong: `src/design-system/noi-dung-va-label.md` (R9).

| Khu vực / đối tượng | Mục người đọc gặp | Lời phải nói | Nguồn | Bước tour |
|---|---|---|---|---|
| Chuyến · 6 bước | Hợp đồng · Lệnh sản xuất · Bao bì · Đóng cont · Bộ chứng từ · Khác | tên 6 bước + bước 6 là gửi chứng từ và tiền về | `STEP_TITLES` · 41 NV8, NV10 | `intro` |
| Kỳ xem | Tháng · Tuần · Ngày | chuyến xếp vào kỳ theo ngày đóng ?? ETD ?? tháng kế hoạch | 41 R1, R18 | `period` |
| Bốn chỉ số | Chuyến trong kỳ · đủ hồ sơ · còn thiếu · trễ hạn giao | nghĩa từng số; trễ hạn = on board (hoặc ETD) sau hạn giao | 41 NV11, R15 | `stats` |
| Thanh tiến độ | màu từng khúc = Xong · Đang làm · Chưa làm · Không áp dụng; "Bước tiếp" / "Đủ hồ sơ"; thẻ Trễ hạn, Chờ booking | đọc khúc, đọc dòng bước tiếp, nghĩa 2 thẻ | `ITEM_STATE_LABELS` · design-spec 42 | `shipment-progress` |
| Hợp đồng · trạng thái | Chờ đính kèm · Đang ghi chuyến · Chờ duyệt cuối · Đã đóng HĐ · Đã hủy (v9 2026-10-29: bỏ Chờ duyệt) | nghĩa từng trạng thái; Chờ đính kèm = vừa lập hoặc thiếu hồ sơ bắt buộc; Chờ duyệt cuối = mọi chuyến đủ hồ sơ + thực xuất trong dung sai cả kg lẫn tiền | `CONTRACT_STATE_LABELS`, `CONTRACT_FLOW_STAGES` · 41 §0a R34–R36, R31 | `contract-status`, `contract-flow` |
| Hợp đồng · cảnh báo | Quá hạn giao · Còn … chưa ghi chuyến · dòng hàng chưa nối danh mục · Thiếu … · Ngoài dung sai · Duyệt cuối trả về | tên từng thẻ | 41 R15, R16, R7, R31 | `contract-status` |
| Hợp đồng · việc tiếp | Đính kèm hồ sơ → Ghi chuyến → Duyệt cuối; thẻ chờ theo vai trò; Thao tác khác | khi nào hiện việc nào, ai làm; việc ít dùng (sửa HĐ khi chưa có chuyến, ghi bản sửa, gia hạn…) ở Thao tác khác | 41 §0a, NV7, NV5, NV6, NV13 | `next-action` |
| Chuyến · trạng thái | Đang làm · k/5 bước · Đủ hồ sơ · Trễ hạn giao · Đã hủy | nghĩa từng thẻ | 41 NV12, R15 | `shipment-card` |
| Mục · trạng thái + điều kiện "Xong" | Chưa làm · Đang làm · Xong · Không áp dụng; điều kiện file / số / chữ ký từng loại; Dùng chung | đủ vế điều kiện theo bảng NV8 (Lệnh SX cần file + HĐ đã duyệt + dòng hàng đã nối; Tờ khai cần số + file; Lệnh xuất cần file có chữ ký BGĐ; chứng từ cần số + ngày + file, công ty tự cấp không bắt số; 4a/4b tự xong khi có file); Không áp dụng phải có lý do | `ITEM_STATE_LABELS` · 41 bảng NV8, R4, R5, R16, R20 | `item-status` |
| Tiền về | Ghi gửi chứng từ · Ghi tiền về · "Tiền về x / y" | số phải thu = tiền trên Commercial Invoice; bước 6 không tính vào đủ hồ sơ | 41 NV10, R7, H5 | `payments` |

## 9c. Kiểm kê nội dung theo trang (v4 — nhánh nội dung, mỗi trang một bảng)
Cột: khu vực · lời phải nói (tóm) · nguồn · bước tour. Lời đầy đủ nằm trong file `<trang>Tour.ts`; test `<trang>Tour.test.ts` đọc hằng số nhãn của trang (khi có) để đổi nhãn mà quên lời là đỏ. Tài liệu lệch code phát hiện lúc kiểm kê ghi ở §11 (Open — lệch doc).

### `/imports` Nhập hàng — 20 bước · `imports/importsTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Nhắc việc | dải "Việc hôm nay" / "Hôm nay đã chốt"; ngày chưa chốt sang Việc của tôi | 39 § hạn | daily-reminder |
| Đầu chuyến | 1 chuyến = 1 đại lý 1 lượt; chọn đại lý tự điền loại + giá cũ | 30 §1 | shipment-header |
| Đọc ảnh phiếu | chỉ là nháp, phải soát; nhãn Khớp danh mục / Mới, kiểm kỹ / Chưa khớp | 30 ghi chú 10-14 | ocr |
| Hai ngày · ghi bù | tổng theo ngày hàng về; ghi bù / ngày đã chốt bắt lý do | 30 §2 §3 | backdate |
| Dòng hàng · giá | loài → loại; để trống giá khi chờ hóa đơn ("Chưa có giá") | 30 §3 | lines |
| Mã lô · SSCC | mỗi loại NL một lô, một tem; SSCC điền sau | 30 ghi chú 10-08 | lot |
| Thanh lưu | "Chưa lưu được — còn thiếu"; Lưu chuyến vào sổ; nháp không tự vào sổ | 30 (j), quy tắc 17 | save-bar |
| Phế liệu · chốt ngày | cân gộp cuối ngày; Chưa chốt / Đã chốt / Còn ghi bù +… kg; mở lại bắt lý do | 30 §4 §5 | scrap, day-lock, lock-action |
| Báo cáo · sổ chi tiết | Chờ hóa đơn = kg chưa có giá; nhãn Ghi bù / Đã chốt / Dữ liệu cũ / Lô | 30 Hai tab, Edge cases | report-*, ledger-* |

### `/wip` Sản xuất thành phẩm — 21 bước · `production/wipTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Chế độ | Ghi nhập (phiếu mở sẵn) · Sổ ngày & báo cáo | 34 (form-first 09-06) | mode-switch |
| Đầu phiếu | ngày ghi sổ / ngày SX; ghi bù bắt lý do | 34 AC-1, F-N1 | session-header |
| Lô NL của phiên | mỗi loại NL của chuyến là một lô; lưu tự gắn theo loại | 34 10-08; spec QR §6d §6e | session-lots |
| Thành phẩm | kg = block × kg/khối, "≠" khi gõ tay; bột là phụ gia, không cộng kg | 34 10-15, 10-06 | production-lines |
| Bán nội địa · Hàng tạm | sổ riêng, không vào sản lượng; Hàng tạm thành lô nhập Sổ kho tháng | 34 10-06, § Hàng tạm | domestic-sale, frozen-stock |
| Trạng thái mẻ | Chờ nhập kho → Đã nhập kho (thủ kho duyệt kg thực ở Kho dự trữ) | 34 F-N2, AC-2/3 | ledger-table |
| Báo cáo ngày | Gửi báo cáo chỉ lưu vết, không khóa | 34 09-05 (A4) | daily-report, send-report |
| Chốt ngày | phải gắn lô hoặc ghi lý do; còn dở theo loại NL thành đông gửi; mở lại bắt lý do | 34 AC-1, 10-08 (2), 09-05 (A3) | day-lock, lock-action |

### `/packaging` Đóng gói — 8 bước · `packaging/packagingTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Phiếu | hao hụt = BTP vào − TP ra; âm / vượt tồn thì cảnh báo nhưng vẫn ghi | 34 08-23 (G3) | add-packaging |
| Tồn TP | = TP ra − bán nguồn Đóng gói, toàn sổ | 33 nguồn Đóng gói | finished-good-stock |
| Lô BTP | chỉ nhận lô cùng mặt hàng; có lô trừ đúng lô, không có trừ lô cũ trước | 34 10-08 (4); spec QR §6d | row-lot |

### `/qc` Kiểm tra QC — 10 bước · `quality-check/qcTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Ngày · xưởng · trạng thái | mỗi ngày × xưởng một bảng; Chưa chốt / Đã chốt; ngày cũ là ghi bù | màn; họp 02/09 | filter, status, backdate |
| Kết quả | Đạt · Cần khắc phục · Không đạt (`RESULT_OPTIONS`); thang điểm chỉ là quy ước | họp 02/09 QĐ-8 | criteria |
| Chốt | cần ít nhất một chỉ tiêu đã lưu | màn `lockDay` | lock-action |

### `/warehouse` Kho dự trữ — 11 bước · `warehouse/warehouseTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Chỉ số · tồn lô | lô chờ nhập chưa tính tồn; tồn = kg thực − lệnh xuất − bán lẻ − đóng gói; có lô gắn trừ đúng lô | 34 F-N2; spec QR §6d | stats, stock |
| Bán vượt | phần vượt không nằm trong Tổng tồn; kiểm phiếu bán / duyệt mẻ chờ | 34 (10-12 b) | oversold |
| Duyệt nhập | chờ nhập kho → đã nhập kho bằng Xác nhận nhập kho, kg thực; quản đốc chỉ xưởng mình | 34 F-N2, AC-3; 35 | pending, scan, approve |
| Tuổi tồn · dung tích | đếm từ ngày SX; xanh / vàng > 85 % / đỏ vượt | 34 (10-13); màn | age, capacity |

### `/orders` Đơn đặt — 10 bước · `orders/ordersTour.ts` (mở đơn minh họa, `onExit` trả lại)
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Trạng thái đơn | Đang gom · Đủ (chỉ đổi trạng thái) · Đã xuất (đủ kg mọi dòng) | 34 F-N5, AC-9/10 | table, detail-actions |
| Dòng hàng | Còn thiếu = Cần − Đã xuất; Khả dụng không tính lô chờ nhập | 34 H3 | detail-lines |
| Lệnh xuất · kiểm lô | lô sản xuất sớm trước; tạo phiếu bán Xuất khẩu chưa có giá; quét lô, Thay lô | 34 F-N5, H5; spec QR §6c §6d | detail-actions, export-list |

### `/sales` Bán hàng — 14 bước, hai tab · `sales/salesTour.ts` (đăng ký ở `SalesTab`, đổi `?tab=`)
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Hai ngày | ngày xuất bán cho mọi tổng; ghi sổ muộn bắt lý do | 33 §2 | create, invoice |
| Kênh · giá · nguồn | Xuất khẩu (USD) / Nội địa (VND); Chưa có giá; Block thô / Đóng gói trừ tồn | 33 §4, Bán trừ tồn | add-item, items |
| Lô · tổng | gắn lô BTP / TP; Tiền bán Xuất khẩu (USD) và Tiền bán Nội địa (đ) cộng riêng theo kênh | spec QR §6d; 33 §4 §5 | lot, totals |
| Tab Báo cáo | khách × kênh; kg cộng chung, giá trị riêng từng kênh, không cộng | 33 (Hai tab) | tabs, report-filters, report-stats, report-table |

### Báo cáo tồn / NXT — `reports/*Tour.ts`
| Trang | Khu vực | Lời phải nói | Nguồn |
|---|---|---|---|
| `/nxt` (8) | chỉ số · bảng · tồn âm · tồn đầu | cuối = đầu + nhập − xuất (đơn + bán + gói); nhập = BTP đã duyệt; tồn đầu khai một lần theo mốc | `inventoryFinished`; 31 § mốc |
| `/nxt-material` (10) | chỉ số · phạm vi · cảnh báo · bảng loại | Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa (PA-a); Đông gửi / Xả đông chỉ là cột thông tin; còn dở SX chưa hiện | 31 § Tồn kho NL; 38 §0 |
| `/nxt-warehouse` (11) | nạp file · bất biến · kho lưu · ghi · kỳ sau | Khớp / Lệch bất biến; nạp lại không nhân đôi; tạo kỳ kế tiếp kế thừa tồn | màn; 04 (P5-A) |
| `/production-report` (7) | lọc · lưới mặt hàng × ngày | sản lượng làm ra mọi trạng thái lô, không phải tồn | màn |
| `/export-report` (7) | bảng theo đơn · trạng thái | đơn vào kỳ theo ngày xuất; Đang gom / Đủ / Đã xuất là trạng thái hiện tại | 34 F-N5/N6 |

### `/monthly-stock` Sổ kho theo tháng — 17 bước · `monthly-stock/monthlyStockTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Nạp Excel | chọn ĐÚNG kho (nhầm kho = cộng đôi); nạp lại chỉ cập nhật | 36 § Nhập Excel | import-excel |
| Tháng trống | Xem trước tồn đầu … CHƯA LƯU; Kế thừa & lưu vào sổ | 36 § Tháng trống | month-open |
| Thẻ · bất biến · lệch dồn kỳ | tồn cuối = đầu + nhập − xuất; Khớp / Lệch bất biến; Lệch dồn kỳ ngưỡng 1 kg, chỉ soi | 36 § Bất biến, § Cờ lệch | stats, invariant, carry-gap |
| Dòng vết · gõ thẳng · thao tác dòng | đừng sửa tay dòng Từ SX / Lấy xả đông / Gửi đông; ô = tổng tháng; Gửi kho ngoài không đổi tổng | 36 § Dòng do Cân đối ghi, § Gõ thẳng, § Thao tác một dòng | linked-rows, inline-edit, row-actions |
| Dồn kỳ | dồn mọi kho, chỉ dòng còn tồn; chạy lại chỉ đổi tồn đầu | 36 § Dồn kỳ | carry-next |

### `/balancing` Cân đối kỳ — 17 bước (5 khi chưa có kỳ) · `balancing/balancingTour.ts` (mở kỳ minh họa)
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Tạo kỳ | một kỳ = một họ NL + ngày tiếp nhận; tỉ giá mặc định 26.000 | 31 § Một kỳ | create-period |
| Khối nguyên liệu | tiền = Σ kg × giá từng chuyến; dòng sổ nhập khóa, sửa qua ✎; dòng giảm gõ dương lưu âm | 31 § Hai khối, (i)/(j) | material, material-checks |
| Dòng kho | Lấy xả đông / Gửi đông ghi thẳng Sổ kho tháng; chặn vượt tồn lô | 31 § Khối 1 hai dòng kho | stock-lines |
| Khối BTP · kết quả | Tổng = Σ ngày + Trả + Nợ; định mức = NL ÷ TP; lãi / lỗ = giá trị xuất − giá thành | 31 § Công thức | finished-goods, result |
| Chốt kỳ | Kỳ đang mở / Kỳ đã chốt; chốt khóa mọi ô; mở lại không xóa dấu chốt | 31 § Chốt kỳ | lock-status, lock-action |

### `/reconciliation` Đối soát HĐĐT — 16 bước (6 khi chưa chạy) · `reconciliation/reconciliationTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| File · ngưỡng · bản lưu | khóa ghép MST · ký hiệu · số; chênh ≤ ngưỡng = Khớp; Nháp / Chính thức | 37 Khóa, v4, v7.1 | file, threshold, saved-runs |
| Kiểu soát · quy tắc | 4 kiểu; ngoại tệ tự dò, không mặc định nhân | 37 v7 | modes, rules |
| Kết quả | Khớp · Lệch tiền · Lệch thuế · Chưa vào sổ · …; Chênh = HĐ − sổ; máy không tự sửa | 37 Nhãn kết quả | ledger-cards, suspects, sheet-tables |
| Tự kiểm · hai bản · cộng cột · cùng MST | Đạt / Không đạt; Thuế gửi / Tự tải; lệch thật vs lệch bình thường; nhóm trùng tiền | 37 v6–v7.1 | self-check, two-version, column-sum, same-day |
| Lưu · xuất | Excel giữ định dạng gốc, mỗi lần một file | 37 v5 v6.5 | save-run, export |

### `/qr` Mã lô QR — 13 bước · `qr/qrTour.ts` (mở lô minh họa qua `?lot=`)
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Loại lô · tra | Nguyên liệu · Bán thành phẩm · Thành phẩm; mã Đ- / BĐ- / TĐ- / NĐ- | spec QR §4.1 §6e | intro, scan |
| Hộ chiếu | Chưa in tem / Đã in N tem; Còn lại = kg lô − các ngả đã đi, âm = sai kg / nhầm lô | §4.4 §6c §6d | lot-summary, mass-balance |
| Truy ngược / xuôi · thu hồi | chỉ tính mối nối đã gắn lô; ai đã nhận hàng | §4.4 §6d | trace-*, recall |
| Theo giai đoạn · in tem | 5 khâu, Còn thiếu N / Đủ; số tem theo block / thùng | §6b–§6d | stage-*, print-* |

### `/dashboard` Tổng quan — 11 bước · `dashboard/dashboardTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Thẻ · năm khâu · đi đâu | nghĩa 8 thẻ; % so với khâu nguồn; Hao hụt / chưa ghi ra | che-do-demo §5b V1–V3 | kpis, stages, outflow |
| Việc cần đốc | Sổ sai · Chưa làm · Để biết + 10 loại cảnh báo | `buildChainWarnings` | warnings |
| Chế độ demo | bộ số trình diễn riêng, không chạm sổ thật; chỉ admin | quy tắc 15 | demo-mode |

### `/my-tasks` Việc của tôi — 10 bước · `my-tasks/myTasksTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Thẻ · lọc | Quá hạn · Hạn hôm nay · Được giao cho tôi · Tôi đã giao; Cần làm bỏ việc Để biết | 39 § Hạn, § Chuông | stats, filter |
| Việc theo quyền | 11 loại việc, hạn từng loại; việc máy tự hết khi sổ sửa xong | 39 § Hạn, § Ai làm được | mine, task-row |
| Giao việc | giao cho đúng một người; Thu hồi có Hoàn tác | 39 § Giao việc | delegate, delegated, assign-new |

### `/documents` Tài liệu công ty — 11 bước · `documents/documentsTour.ts`
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Phạm vi xem | phòng mình · cả công ty · phòng được chọn; máy chủ chặn cả file | 40 § Ba lớp chặn | visibility |
| Trạng thái · hạn | Đang hiệu lực · Dự thảo · Chưa ban hành · Hết hiệu lực; hạn ≤ 60 ngày sang Việc của tôi | spec DOC-R7 | status |
| Lần ban hành · đính file | lần mới không ghi đè; đính trong hộp chi tiết | 40 § Luật chính; DOC-R2/R3b | detail, detail-actions |

### `/catalog` Danh mục — 14 bước · `catalog/catalogTour.ts` (đổi `?tab=`)
| Khu vực | Lời phải nói | Nguồn | Bước |
|---|---|---|---|
| Tab · thêm / sửa / xóa | 7 tab theo quyền; sổ cũ không hồi tố; xóa có Hoàn tác; báo trùng mã / tên | 32 | tabs, write |
| Từng danh mục | tên tiếng Anh mặc định; tên hàng trên chứng từ (trích xuất không ghi đè); bột là phụ gia; 141 mã chỉ tra | 32; 41 R23 R26 | products … finished-goods |
| Sửa tại chỗ | gõ tên mới trong ô chọn là tạo; bút chì sửa nhanh | CLAUDE.md quy tắc 7 | quick-edit |

### Hộp "?" dạng quy trình (v5) — `/planning-export`, `/planning-import`, `/planning-production`
| Trang | Nhóm (vai trò) | Bước (quyền cần → nhóm) | Trạng thái (nguồn) |
|---|---|---|---|
| Xuất khẩu `guides/exportPlanningGuide.tsx` | Nhân viên KH (`planner`) · Trưởng / Phó KH (`planning-head`, `planning-deputy`) · Người đóng hàng (`warehouse-keeper`, 3 quản đốc, `vice-manager`) · Kế toán (`chief-accountant`, `accountant`) · BGĐ chỉ xem | 1 Lập HĐ (`export-plans` create → KH) · 2 Đính kèm hồ sơ (update → KH) · 3 Ghi chuyến (create → KH) · 4 Làm các bước của chuyến (update → KH) · 5 Ảnh và sơ đồ đóng cont (`.loading` create → Người đóng hàng + KH) · 6 Gửi chứng từ · tiền về (`.payments` create → Kế toán + KH) · 7 Duyệt cuối (approve → Trưởng / Phó) | HĐ: `CONTRACT_STATE_LABELS` (41 §0a); mục: `ITEM_STATE_LABELS`; thanh 6 khúc: `STEP_TITLES` |
| Nhập khẩu `guides/importPlanningGuide.tsx` | Phòng Kế hoạch (`planner`, `planning-head`, `planning-deputy`) · Thủ kho (`warehouse-keeper`) · BGĐ + Kế toán chỉ xem | 1 Lập HĐ nhập (`import-plans` create) · 2 Ghi lần nhập (create) · 3 Đính bộ chứng từ (update) · 4 Ghi thực nhập (`.receiving` create → Thủ kho + KH) · 5 Đóng HĐ (update) | lần nhập: `RECEIPT_STATE_LABELS`; HĐ: `CONTRACT_STATE_LABELS` (45 R6); nối mặt hàng: 45 R20–R22 |
| Lệnh sản xuất `guides/productionOrderGuide.tsx` | Phòng Kế hoạch (`planner`, `planning-head`, `planning-deputy`) · Ban quản đốc + Thủ kho (3 quản đốc, `vice-manager`, `warehouse-keeper`) chỉ xem lệnh đã phát hành · BGĐ + Kế toán chỉ xem | 1 Lập lệnh (`production-orders` create) · 2 Gắn NL nhập khẩu dự kiến · 3 Phát hành, gắn chuyến · 4 Sửa sau phát hành (update) | `ORDER_STATUS_LABELS` (Nháp → Đã phát hành · Đã hủy) + cờ `STALE_REVISION_LABEL` |

## 10. Acceptance Criteria — ORACLE
> Repo chưa có harness E2E (màn hình thử tay trên preview — CLAUDE.md). Phần thuần (chọn hồ sơ, dựng bước, tính bước kế) = **unit**; phần trên trang = **manual** bằng script đo trên preview demo (lý do: không có e2e runner), Assert vẫn là số đo được.

### AC-1 — Bắt đầu tour hiện bước 1 và chặn thao tác · Maps to: NV1 · Test: manual
- **Given** người có quyền ghi đang ở lịch xuất hàng, dữ liệu đã tải
- **When** chọn bắt đầu hướng dẫn từng bước
- **Then** bước 1 / n hiện; mọi thao tác lên trang bị chặn
- **Assert** đúng 1 khung tour trong trang, chữ đếm `Bước 1/n` với 12 ≤ n ≤ 22; `document.elementFromPoint` tại tâm nút Lập hợp đồng trả về lớp chặn của tour (không phải nút)

### AC-2 — Tới / lùi đi đúng thứ tự, bỏ qua bước không áp dụng · Maps to: NV2 · Test: unit
- **Given** danh sách 5 bước, bước 2 và 4 tùy chọn và chỗ của chúng không có
- **When** tới từ bước 1, rồi lùi từ bước 5
- **Then** tới ra bước 3, lùi ra bước 3; tới từ bước cuối ⇒ hết tour
- **Assert** `nextStepIndex(steps, 0, 1, has) == 2`; `nextStepIndex(steps, 4, -1, has) == 2`; `nextStepIndex(steps, 4, 1, has) == -1`; bước bắt buộc thiếu chỗ KHÔNG bị bỏ (`nextStepIndex` trả đúng chỉ số của nó)

### AC-3 — Chọn hồ sơ minh họa đúng thứ tự ưu tiên · Maps to: NV1 · Test: unit
- **Given** dữ liệu có: HĐ đã hủy (có chuyến), HĐ chỉ có chuyến đã hủy, HĐ đang chạy có chuyến chưa đủ hồ sơ
- **When** chọn hồ sơ minh họa
- **Then** chọn HĐ đang chạy có chuyến chưa đủ hồ sơ, kèm chuyến đó
- **Assert** `pickTourContract(data, opts)` == `{ contractId: <HĐ đang chạy>, shipmentId: <chuyến chưa đủ> }`; dữ liệu rỗng ⇒ `null`; chỉ có HĐ đã hủy ⇒ trả HĐ đã hủy với `shipmentId == ""`

### AC-4 — Không có hợp đồng: phần hồ sơ gói thành một lời · Maps to: NV1 · Test: unit
- **Given** trang Xuất khẩu không có hợp đồng nào
- **When** dựng các bước tour
- **Then** không bước nào mở hồ sơ; đúng 1 bước kể luồng hồ sơ không gắn chỗ
- **Assert** `buildExportTour({ pick: null, ... })`: 0 bước có `prepare` mở hồ sơ; đúng 1 bước id `dossier-overview` với `target` rỗng

### AC-5 — Người chỉ xem không bị dẫn tới chỗ ghi · Maps to: NV1 · Test: unit
- **Given** người chỉ có quyền xem, không xem tiền về
- **When** dựng các bước tour
- **Then** bước Lập hợp đồng, bước cập nhật mục và bước tiền về không có
- **Assert** `buildExportTour({ can: { create: false, update: false, payments: false }, ... })`: số bước có id thuộc {`create-contract`, `step-update`, `payments`} == 0; với đủ quyền con số đó == 3

### AC-6 — Thoát giữa chừng trả trang về chỗ cũ · Maps to: NV2 · Test: manual
- **Given** đang ở lịch tháng khác tháng hiện tại, tab Lịch
- **When** đi tới một bước trong hồ sơ minh họa rồi thoát bằng phím Esc
- **Then** tour đóng, trang về lịch tháng cũ
- **Assert** `location.hash` sau khi thoát == trước khi bắt đầu; số khung tour trong trang == 0

### AC-7 — Một vòng tour không đổi bản ghi nào · Maps to: NV1 · Test: manual
- **Given** preview chế độ demo (dữ liệu dưới máy)
- **When** đi hết tour tới Kết thúc
- **Then** dữ liệu không đổi
- **Assert** băm (khóa + độ dài giá trị) mọi khóa `bsf*` trong localStorage trước == sau; 0 yêu cầu mạng ghi (POST/PATCH/DELETE) trong lúc tour

### AC-8 — Khung tour nằm trọn trong màn điện thoại · Maps to: NV1 · Test: manual
- **Given** cửa sổ 360 px, cỡ chữ 130 %
- **When** đi qua mọi bước
- **Then** khung lời không tràn, chỗ được chỉ nằm trong tầm nhìn
- **Assert** mỗi bước: khung tour `left >= 0`, `right <= 360`; `documentElement.scrollWidth == 360`; mép trên chỗ được chỉ ≥ mép dưới thanh tiêu đề và < mép trên khung lời; thanh tiêu đề không trôi (`top >= 0`)

### AC-9 — Lối vào chỉ có ở trang đã khai · Maps to: NV4 · Test: manual
- **Given** trang Nhập hàng đã khai tour (v4), trang Người dùng (MIỄN) không
- **When** mở lần lượt hai trang, mở hộp "?" nếu có
- **Then** Nhập hàng có lối "Bắt đầu hướng dẫn thao tác"; Người dùng không
- **Assert** số phần tử `[data-tour-start]` sau khi mở hộp "?" ở `/imports` ≥ 1, ở `/users` == 0

### AC-10 — Lời tour phủ đủ nhãn trạng thái · Maps to: NV1 · Test: unit
- **Given** hằng số nhãn trong code: 5 trạng thái hợp đồng (gồm "Đã chốt HĐ"), 4 trạng thái mục, 6 tên bước, 4 thẻ chuyến (Đủ hồ sơ · Trễ hạn · Chờ booking · Dùng chung)
- **When** dựng tour Xuất khẩu đủ quyền, có hồ sơ minh họa
- **Then** mỗi nhãn xuất hiện nguyên văn ít nhất một lần trong lời tour
- **Assert** số nhãn trong `CONTRACT_STATE_LABELS` ∪ {"Đã chốt HĐ"} ∪ `ITEM_STATE_LABELS` ∪ `STEP_TITLES` ∪ thẻ chuyến KHÔNG có trong lời == 0

### AC-11 — Văn phong lời tour · Maps to: NV1 · Test: unit
- **Given** mọi bước của tour (có và không có hồ sơ minh họa)
- **When** kiểm theo R9
- **Then** tiêu đề không chấm cuối, lời kết thúc bằng dấu chấm, không dùng động từ "bấm / nhấn / click"
- **Assert** số tiêu đề kết thúc "." == 0; số lời không kết thúc "." == 0; số lần xuất hiện "bấm" / "nhấn" / "click" (không phân hoa thường) == 0

### AC-12 — Mọi trang nghiệp vụ có tour + hộp "?" · Maps to: NV5, NV6, R13 · Test: unit
- **Given** danh sách route trang trong `App.tsx` (≥ 15 sau khi bỏ chuyển hướng / tham số) và danh sách MIỄN
- **When** chạy `pageTourCoverage.test.ts`
- **Assert** số trang ngoài MIỄN thiếu `tourSpec` == 0; thiếu `PAGE_GUIDES` == 0; tour / mục MIỄN không ứng với route nào == 0; `pageId` trùng == 0; file tour không được màn nào gọi qua `usePageTour` == 0

### AC-13 — Khuôn + văn phong mọi tour · Maps to: NV5, R9, R15 · Test: unit
- **Given** mọi `tourSpec` (bản đủ quyền)
- **Assert** mỗi tour: 3 ≤ số bước ≤ 22; id trùng == 0; bước 1 không có `target`; tiêu đề kết thúc "." == 0; lời không kết thúc "." == 0; "bấm" / "nhấn" / "click" == 0

### AC-14 — Mốc của mọi bước có trên trang · Maps to: NV5, R15, R17 · Test: unit
- **Given** mọi `target` của mọi tour
- **Assert** số mốc không xuất hiện thành chuỗi `"<mốc>"` trong file .tsx có `data-tour` ở `features/` hoặc `design-system/` == 0

### AC-15 — Lời tour phủ nhãn trạng thái của trang · Maps to: NV5, R10, R15 · Test: unit
- **Given** trang có hằng số nhãn trạng thái trong code (vd Việc của tôi, Tài liệu, Xuất khẩu)
- **Assert** test `<trang>Tour.test.ts`: số nhãn không có nguyên văn trong lời tour == 0; bước ghi khi không có quyền ghi == 0

### AC-16 — Chạy thật mọi tour không đổi dữ liệu, không tràn · Maps to: NV5, R1, R5 · Test: manual
- **Given** preview chế độ demo (dữ liệu dưới máy), 1366 px rồi 360 px × 130 %
- **When** mở từng trang, bắt đầu tour, đi tới Kết thúc
- **Assert** mỗi trang: băm khóa `bsf*` trước == sau; số bước bắt buộc hiện lời giữa trang vì thiếu mốc == 0 (trừ bước 1); `documentElement.scrollWidth == clientWidth`; `location.hash` sau khi thoát == trước khi bắt đầu

### AC-17 — Nhóm làm của từng bước khớp ma trận quyền · Maps to: R20 · Test: unit
- **Given** hộp "?" dạng quy trình của Xuất khẩu / Nhập khẩu · **When** đối chiếu mỗi bước với `resolvePermissions` từng vai trò hệ thống · **Then** tập vai trò của nhóm ghi ở bước == tập vai trò có quyền `needs`; mọi vai trò có `view` trang nằm trong đúng 1 nhóm.
- **Assert**: `rolesOfActors(step) == rolesWith(step)` cho 7 / 7 bước Xuất khẩu, 5 / 5 bước Nhập khẩu (`guides/flowGuide.test.ts`).

### AC-18 — Hộp phủ đủ nhãn trạng thái · Maps to: R18, R10 · Test: unit
- **Given** hằng số nhãn trong `lib/exportPlanning.ts`, `lib/importPlanning.ts` · **When** gom nhãn các chuỗi trạng thái của hộp · **Then** == toàn bộ nhãn.
- **Assert**: nhãn thiếu == 0 (HĐ xuất 5, mục 4, lần nhập 4, HĐ nhập 4).

### AC-19 — Việc của bạn theo quyền thật · Maps to: R19 · Test: unit
- **Given** quyền mặc định · **When** tính bước của người xem · **Then** `planner` Xuất khẩu = 6 bước (trừ Duyệt cuối); `planning-head` = 7; `warehouse-keeper` = ["loading"] (Xuất khẩu), ["quantity"] (Nhập khẩu); `accountant` = ["payments"] (Xuất khẩu), [] (Nhập khẩu); `director` = [].
- **Assert**: `stepsForViewer(...)` đúng các mảng trên.

### AC-20 — Ít chữ, không tràn ở điện thoại · Maps to: R21 · Test: unit + manual
- **Given** hộp "?" hai trang · **When** đếm câu / mở ở 360 px chữ 130 % · **Then** 3 ≤ số bước ≤ 8, mỗi bước ≤ 2 câu; trong hộp không phần tử nào cuộn ngang, không thẻ nào bị cắt chữ.
- **Assert**: unit đếm câu (`flowGuide.test.ts`); manual 2026-10-29 trên preview demo: `scrollWidth == clientWidth` mọi phần tử hộp, `document.scrollWidth == 360`, 0 thẻ `.truncate` bị cắt — cả hai trang.

## 11. Assumptions / Open
- **Assumptions**: tour không tự bật lần đầu và không nhớ "đã xem" (R8, OUT); lối vào ở cả hộp "?" của trang lẫn một nút phụ trên trang (cùng một tour); chữ tour viết theo giọng hướng dẫn hiện có (nói việc, không thuật ngữ); tour dùng dữ liệu đang có (thật hay demo đều được) — không sinh số mẫu (quy tắc 15).
- **Open (RED)**: không có.
- **Open — lệch tài liệu / màn (v4, phát hiện lúc kiểm kê; lời tour theo CODE).** 2026-10-27: phần lệch DOC đã sửa theo code (CLAUDE.md G1 · 31 · 30 §1 · 35 · 40 vị trí nút đính PDF · 33); phần lệch ở CODE chuyển vào [BAN-GIAO-tiep-theo §4 mục 9](../BAN-GIAO-tiep-theo.md). **Còn treo:** luật giao việc gia hạn (DOC-R7 "phòng sở hữu" ≠ code "người xem được + `documents.update`") — chờ chủ dự án chốt.
  - CLAUDE.md mục G1 ghi "tồn cuối NL = tồn đầu + đông gửi − xả đông" — màn `/nxt-material` + 31 § Tồn kho NL (PA-a) + 38 §0: Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa; Đông gửi / Xả đông chỉ là cột thông tin.
  - 31: thân doc khối nguyên liệu còn tả nút "n chuyến", "Tách theo đại lý", ô ngày ghi ngược sổ Nhập hàng (code: dòng sổ nhập khóa, sửa qua ✎, "n người bán"); doc nói khung "còn dở SX chưa hiện" đã bỏ nhưng `/nxt-material` vẫn hiện.
  - 30 §1 còn tả hộp thoại ghi chuyến (nay ghi ngay trên trang).
  - 35 còn tả hộp "Ghi sản lượng" + "chốt ngày SX → chờ nhập" (nay lưu là Chờ nhập kho ngay).
  - 34 F-N6 / AC-13 (thủ kho xác nhận thực xuất) chưa có ở code — lập lệnh xuất là đóng ngay.
  - 33: handoff Đơn đặt ghi "Lưu trữ", code ghi "Đơn đặt". (Đã sửa 2026-10-22: tiền bán tách USD / VND, tab Báo cáo nối lại — commit `69999c1`.)
  - 40 + spec DOC-R7: đính PDF "ở cột File" (thực tế trong hộp chi tiết); việc gia hạn giao "phòng sở hữu" (code: người xem được + có `documents.update`).
  - QC: "Mở lại ngày" không hỏi lý do (khác Nhập hàng / Sản xuất); phụ đề "Ảnh kèm sẽ bổ sung sau" đã cũ. Cân đối: nút "Nhận chuyển kỳ" không kiểm quyền.
  - Chữ trên vài màn còn "Bấm …" (Nhập hàng, Việc của tôi, Tài liệu, Đóng gói, Đối soát, QR) và empty state "Sản xuất BTP" (menu: "Sản xuất thành phẩm"). Hộp "?" (guideContent) đã sửa theo code ở v4.

## History
- v5 (2026-10-29, chủ dự án: "trang hướng dẫn Nhập khẩu, Xuất khẩu chưa chính xác, nhiều chữ — tách bước, minh họa trực quan, nêu phân quyền để biết việc mình"): R18–R21, AC-17…AC-20, §9c mục hộp dạng quy trình. Orchestrator tự chấm (nhánh nội dung, 2 trang, khuôn đã có) — cân 3 biến thể: (a) viết lại đoạn văn ngắn hơn *(loại — vẫn không thấy ai làm bước nào, quyền lệch không ai biết)*; (b) ảnh sơ đồ tĩnh *(loại — lệch khi đổi nhãn / quyền, không đọc được ở 130 %)*; (c) khai bước + quyền cần + nhóm làm thành dữ liệu, hộp vẽ từ dữ liệu, đánh dấu Việc của bạn theo quyền thật, test đối chiếu ma trận *(chọn)*. Rà đúng luồng: Xuất khẩu theo 41 §0a v9 (bỏ duyệt HĐ, thêm bước của Người đóng hàng và Kế toán mà hộp cũ không nói); Nhập khẩu theo 45 R1–R9 + v3 R20 (giữ phần nối mặt hàng phiên khác vừa thêm). Tour hai trang không đổi.
- v4 (2026-10-22, chủ dự án: "bổ sung hướng dẫn thao tác cho các trang đã có và sau này, ghi quy tắc"): mở rộng ra MỌI trang nghiệp vụ (NV5, NV6), R13–R17, AC-12…AC-16, quy tắc 18 (CLAUDE.md), cổng `pageTourCoverage.test.ts` (route ⇄ tour ⇄ hộp "?" ⇄ mốc). Hộp "?" bổ sung cho 7 trang còn thiếu (Sản xuất, Đóng gói, QC, Tồn kho NL, NXT kho, Đối soát, Tổng quan). Orchestrator tự chấm (việc lặp khuôn đã duyệt ở v1–v3, không spawn team BA); viết lời giao cho 7 agent theo nhóm trang, mỗi trang kiểm kê nội dung riêng (§9c).
- v3 (2026-10-21): áp nhánh nội dung (skill ba-flow-logic references/06) — §9b kiểm kê có nguồn, R10–R12, AC-10 phủ nhãn + AC-11 văn phong (unit, đọc thẳng hằng số nhãn).
- v2 (2026-10-21): theo góp ý chủ dự án — tên "Hướng dẫn thao tác", lời viết lại theo văn phong tài liệu (R9), thêm bước giải thích trạng thái hợp đồng / chuyến / mục và điều kiện file; R5 trả cả vị trí cuộn; giới hạn 22 bước. Đã chạy: 21 bước đạt ở 1366 px và 360 px × 100 / 130 % (0 bước khuất / đè / tràn), dữ liệu dưới máy không đổi, đường dẫn trả về.
- v1 (2026-10-21): khởi tạo — cơ chế tour dùng chung + tour Xuất khẩu + hộp "?" Xuất khẩu.
