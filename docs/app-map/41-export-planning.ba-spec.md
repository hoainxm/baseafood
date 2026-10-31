# 41 — ba-spec: Phòng Kế hoạch · Xuất khẩu — Đợt 1 (khung tháng × khách × hợp đồng × chuyến)

> Load khi: xây hoặc sửa module Xuất khẩu của Phòng Kế hoạch đợt 1: hồ sơ hợp đồng (dòng hàng, bản sửa, gia hạn, file ký, kết quả duyệt giấy), chuyến (mã lô MSL, booking, cont, seal, ngày đóng/ETD), 6 bước dạng checklist tay kèm file, thực xuất lấy từ invoice, khép kín chuyến/hợp đồng theo dung sai, tiền về, vai trò Phòng Kế hoạch, mở rộng danh mục khách.
covers: src/features/export-planning/**, src/lib/exportPlanning.ts, src/lib/invoiceReader.ts, src/lib/invoiceFileReader.ts, src/lib/exportReports.ts, src/lib/customerProductNames.ts, src/features/catalog/CustomerProductNamesDialog.tsx, supabase/migrations/0077_customer_product_names.sql, src/lib/exportPlanningDemo.ts, src/lib/exportFileStorage.ts, supabase/migrations/0075_export_planning.sql, supabase/migrations/0079_export_approval_workflow.sql, src/lib/abbreviations.ts, supabase/migrations/0081_export_document_kinds.sql
last_verified: 2026-10-31
<!-- re-verified: 2026-10-31 — NV19 / AC-74…77: test exportPlanning (77) + demo (8) xanh, cả bộ 1207; preview demo: lập HĐ 97.26 (3 cont, ký 31/10, giao 28/01/2027) ⇒ hộp tự mở 3 chuyến 11/2026 · 12/2026 · 01/2027 × 1.000 kg; "Không tạo" ⇒ 0 chuyến, hồ sơ có nút Tạo lịch; nháp giữ tháng sửa dở qua sang trang, tạo xong nháp mất; HĐ 99.26 tạo lịch 2 chuyến 600 kg (lệch kg ⇒ cảnh báo, vẫn tạo), lịch 11/2026 hiện chuyến "Chờ booking"; Sửa hợp đồng + Xóa hợp đồng vẫn còn, xóa ⇒ kèm 3 chuyến, 0 mục mồ côi; 360 px × 130 % không tràn; bsf.* trước == sau. -->
<!-- updated: 2026-10-31 (lịch) — §0d v9.3 ĐÃ BUILD: NV19 tạo lịch xuất hàng khi lập HĐ / HĐ chưa có chuyến; R39 dựng lịch theo số cont, R40 nới R29 cho lịch, R41 chuyến còn trống (sửa R35, xóa HĐ). AC-74…77. -->
<!-- re-verified: 2026-10-30 15:40 — R38 / AC-73: preview demo ghi bản sửa HĐ 21.26 với 4 ô → tải lại ⇒ hồ sơ hiện Chiều dài · Tỉ lệ · Số miếng / kg đúng chữ; nháp hộp HĐ giữ 4 ô; 360 px × 130 % hộp không tràn; bsf.* trước == sau. -->
<!-- updated: 2026-10-30 (NL dòng) — §0c v9.2: R38 bốn ô yêu cầu NL của dòng hàng (Chiều dài · Tỉ lệ râu / thân / cổ · Số miếng / kg · Ghi chú dòng) trong JSON lines, `repo.parseLines` giữ, Chép dòng chép theo; tự chép sang Lệnh sản xuất (48 R17). AC-73. -->
<!-- updated: 2026-10-30 (khác) — Thanh toán = Khác ⇒ bắt ghi `terms.paymentOther` (JSON terms, không cột mới; `validateContract` lỗi `paymentOther`, test exportPlanning); hồ sơ đính kèm "Hồ sơ khác" ⇒ bắt ghi Tên hồ sơ (vào caption). -->
<!-- updated: 2026-10-30 (lsx) — bước 2 Lệnh sản xuất của chuyến còn xong khi chuyến gắn ≥ 1 Lệnh sản xuất ĐÃ PHÁT HÀNH (ba-spec [48](48-production-order.ba-spec.md) R6, Q6 = A: HOẶC luật cũ file / dùng chung). Luật ở `exportPlanning.subStepState` qua `ExportData.issuedOrderShipmentIds`; test `productionOrderExport.test.ts`. -->

<!-- updated: 2026-10-30 (b) — LOẠI HÀNG mỗi dòng hàng HĐ (danh mục `goods_types`, mig 0089; khóa `goodsTypeId` trong JSON dòng): ô Loại hàng cạnh Size (thêm mới + bút chì), Chép dòng chép theo; bảng dòng hàng ở hồ sơ có cột Loại hàng; Excel kế hoạch tháng thêm cột CUỐI "Loại hàng" (tên các loại của HĐ, nối "; " — lọc kiểu "chứa"; `lineGoodsTypeNames`, có test). Chưa chạy 0089 ⇒ ẩn ô + cột. -->
<!-- updated: 2026-10-30 — CHÉP DÒNG HÀNG (chủ dự án: "mọi thông tin như cũ, chỉ khác mỗi size"): nút Chép dòng ở phần 4 phiếu HĐ, bản chép ngay dưới dòng gốc, giữ mọi ô, để trống Size (`copyContractLine` + `insertCopiedLine`, lib/exportPlanning.ts, có test). NHIỀU FILE: ô file HĐ (phần 5), thư xác nhận gia hạn, giấy báo có / biên nhận gửi chọn được nhiều file — file ĐẦU gắn vào bản ghi như cũ (bản HĐ / lần gia hạn / lần tiền về chỉ có 1 cột file), file sau vào Hồ sơ đính kèm cấp HĐ (`step: "contract"`, loại Khác, chú thích nguồn; `uploadExtraContractFiles`), Hoàn tác gỡ luôn. Giữ 1 file có chủ đích: đọc invoice (InvoiceReadPanel). "Loại hàng" của dòng hàng: danh mục riêng — làm ở phiên khác. -->
ttl_days: 90
status: ba-spec v9.1 (2026-10-29: danh mục Loại chứng từ — §0b) · v9 (2026-10-29: **bỏ bước duyệt HĐ**, chỉ còn duyệt cuối — §0a) · v8 (2026-10-28: **quy trình duyệt mới** — Trưởng / Phó phòng KH duyệt → đính kèm → ghi chuyến → duyệt cuối đóng HĐ; vai trò `planning-head` / `planning-deputy`; nhật ký HĐ; chú thích viết tắt; ĐÃ BUILD, mig 0079 CHƯA chạy) · v7 (2026-10-22 tối: **đọc Commercial Invoice** từ file Excel gốc / PDF xuất từ Excel — NV17 · R27; ĐÃ BUILD 2026-10-22, không migration) · v6 (2026-10-22 chiều: **tên hàng THEO KHÁCH** — họp Hoài Nam ↔ Lê Khiêm; ĐÃ BUILD 2026-10-22, `0077` ✅ chạy DB thật 2026-10-22) · v5 (2026-10-22: tên thương mại mặt hàng, số PO của khách, báo cáo kỳ — ĐÃ BUILD, `0076` ✅ chạy DB thật 2026-10-22) · v4 (bổ sung sau audit hồ sơ SCM 2026-10-20: nhãn, người ký BGĐ, kỳ xem, nối mặt hàng) — ĐÃ BUILD v1 2026-10-20 (code + `0075_export_planning.sql`, kiểm PGlite) — ⏳ 0075 CHƯA chạy trên DB thật: tạo bucket `export-files` → chạy 0075 (2 lần) → deploy
<!-- re-verified: 2026-10-29 14:00 — v9.1: R37 / AC-68…71 = test exportPlanning.test.ts (4) xanh; AC-72 thử tay preview demo; DOCUMENT_KINDS (10 loại) + luật CI / B/L / bảo hiểm theo id đối chiếu canMarkDone, isRequiredDocumentItem. -->
<!-- re-verified: 2026-10-29 10:30 — v9: ContractState/CONTRACT_FLOW_STAGES/effectiveRevision/shipmentGate/finalReviewGate ở lib/exportPlanning.ts đối chiếu code sau sửa; AC-57/64/65/66/67 = test exportPlanning.test.ts + exportPlanningDemo.test.ts xanh. -->
<!-- re-verified: 2026-10-28 15:00 — v8: luồng duyệt cũ (NV4 ghi kết quả BGĐ ký giấy, approvers = director/vice-director ở ExportPlanningScreen, RLS approvals = export-plans create/update ở 0075, contractState pending/approved/closed) đối chiếu code TRƯỚC khi sửa — khớp doc; sau sửa: AC-56…AC-61 = test `exportPlanning.test.ts`, RLS 0079 thử PGlite (Nhân viên KH bị chặn duyệt / đóng / mở lại; Trưởng / Phó làm được; nhật ký không sửa / xóa); nối mặt hàng R16/R23: 4 lỗi sửa + test. -->
<!-- re-verified: 2026-10-22 (c) — v7: R27 + AC-51…AC-55 = test `invoiceReader.test.ts` (18, oracle invoice 234/26 chép từng ô); thử tay preview demo (localStorage): file Excel → điền số / ngày / 3 số tổng, PDF có chữ ra cùng kết quả, bản scan 234/26 → câu "bản scan", ô đã có số khác → báo + "Dùng số trên invoice", nối 1 dòng → Lưu trích xuất 1 tên "Trích xuất từ Invoice 234/26" + Hoàn tác, Hủy không ghi; 360 px × 130 % không tràn. Chưa thử: tải file từ kho file thật (cần DB), file Excel gốc THẬT của Phòng KH (chưa có). -->
<!-- re-verified: 2026-10-22 (b) — v6: R23 · R26 + AC-39/40/46/47 = test `customerProductNames.test.ts` (11) + `exportPlanning.test.ts`; AC-48 = `useCustomerProductNameStore.isAvailable` (thử tay chưa có DB chưa chạy 0077 — chưa làm); AC-49 thử tay preview demo: bộ demo 18 tên trích xuất, hộp Tên hàng, form HĐ điền tên + quy cách của khách, nối mặt hàng tự thêm 1 tên + toast; RLS 0077 thử PGlite. -->
<!-- re-verified: 2026-10-22 — v5: R23–R25 + AC-39…AC-44 = test `exportPlanning.test.ts` (52) + `exportReports.test.ts` (15) + `repo.test.ts` (AC-41); AC-45 thử bằng hàm Excel (0 ô tiền) — phần màn hình cần tài khoản không quyền giá (chưa thử tay); tên thương mại + báo cáo + danh sách file thử tay preview demo 1366 px + 360 px × 100 / 130 %. -->
<!-- re-verified: 2026-10-20 17:30 — v4: R16–R22 + AC-30…AC-38 = test `exportPlanning.test.ts` (48) + `numberExpression.test.ts` + `format.test.ts`; nhãn / người ký / kỳ xem / nối mặt hàng thử tay preview sandbox, 360 px + 130 %. -->
<!-- re-verified: 2026-10-20 15:00 — audit hồ sơ SCM trên preview: NV3–NV13 chạy tay (AC-4…AC-28 trừ AC-1/2/18/29 cần DB thật), 50 TC ở docs/test-cases; luật trong doc khớp code. -->
<!-- re-verified: 2026-10-20 12:40 — AC-4…AC-26 = test `src/lib/exportPlanning.test.ts` (37) + `exportPlanningDemo.test.ts`; AC-1/2/18/27 RLS thử trên PGlite; luồng lập HĐ → lên chuyến → chặn KH-R8 → duyệt → 6 bước → khép kín · bản sửa chờ / bị từ chối · nháp · 360 px + 130 % thử tay preview demo. -->

> **Giao diện:** design-spec [42](42-export-planning-ui.design-spec.md) (oracle giao diện — chỉnh UI đọc file đó).
> **Mục đích:** oracle HÀNH VI cho đợt 1. Định nghĩa ai làm nghiệp vụ gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (việc của design-spec).
> **Nguồn đã chốt:** kế hoạch [`spec/xuat-khau-phong-ke-hoach.md`](../spec/xuat-khau-phong-ke-hoach.md) (§9 chốt 11 câu 2026-10-20) · quy trình [`QTI-KH-01`](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) (luật KH-R1…R16) · phân quyền [`spec/role-permissions.md`](../spec/role-permissions.md) · tài liệu công ty [`40-documents.md`](40-documents.md) (khuôn file + RLS).


## 0d. v9.3 (2026-10-31) — tạo lịch xuất hàng ngay khi lập hợp đồng · ✅ ĐÃ BUILD 2026-10-31

Chủ dự án yêu cầu: lập HĐ mới thì **hỏi có tạo lịch xuất hàng đi kèm không**, thay vì đợi đủ hồ sơ mới Ghi chuyến. Lý do: HĐ mới chỉ hiện "chưa lên chuyến" ở tháng hạn giao, Phòng KH không thấy trước tháng nào xuất bao nhiêu cont. Chốt 2026-10-31 (3 câu, cả 3 theo đề xuất): chia theo số cont, rải đều · HĐ chưa có chuyến thì tạo lịch được về sau, không cần đủ hồ sơ · chuyến kế hoạch còn trống không chặn Sửa hợp đồng.

**Nghiệp vụ NV19 — Lên lịch xuất hàng theo HĐ · owner U1 Nhân viên KH** (U6 làm được như U1). Không thêm user, không thêm cross-user: chuyến kế hoạch chỉ hiện trên lịch và báo cáo như chuyến thường.
- **Start:** (a) vừa lưu HĐ MỚI thành công, hoặc (b) HĐ còn mở và **chưa có chuyến nào** (kể cả chuyến đã hủy thì không tính — chỉ chuyến `open`), U1 chọn tạo lịch.
- **Input:** bản đang dùng của HĐ (tổng kg dòng hàng, số cont, loại cont, cảng đích, ngày ký, hạn giao muộn nhất).
- **Flow:** app hỏi có tạo lịch không → **Không** ⇒ kết thúc, HĐ như cũ · **Có** ⇒ app dựng danh sách chuyến dự kiến theo R39 → U1 sửa tháng / kg từng chuyến (thêm / bỏ chuyến được) → xác nhận ⇒ ghi N chuyến `open`.
- **Output:** N chuyến có tháng kế hoạch, loại cont, kg kế hoạch, cảng đích, tóm tắt hàng; chưa MSL / booking / số cont; mục chứng từ bước 5 sinh theo chứng từ yêu cầu của bản đang dùng (R6). Nhật ký HĐ ghi 1 dòng "Tạo lịch xuất hàng: N chuyến".
- **End:** lịch xuất hàng hiện N chuyến ở đúng tháng; HĐ vẫn ở chặng **Đính kèm** nếu chưa đủ hồ sơ; bước 1 "Hợp đồng" của mỗi chuyến **chưa xong** tới khi đủ hồ sơ.

**Luật:**
- **R39 — Dựng lịch xuất hàng.** N = số cont trên HĐ (trống / 0 ⇒ 1). kg mỗi chuyến = tổng kg HĐ ÷ N làm tròn 2 số lẻ, **chuyến cuối nhận phần dư** ⇒ Σ kg kế hoạch == tổng kg HĐ. Tháng: đầu = tháng **sau** tháng ký (không muộn hơn tháng hạn giao), cuối = tháng hạn giao muộn nhất; S = số tháng từ đầu tới cuối (tính cả hai đầu); N = 1 ⇒ tháng cuối; N > 1 ⇒ chuyến i (0 … N−1) ở tháng đầu + ⌊i × (S − 1) / (N − 1)⌋ (N > S ⇒ nhiều chuyến chung tháng). Loại cont, cảng đích theo HĐ (như gợi ý của Ghi chuyến). Chỉ là gợi ý: U1 sửa được tháng / kg / số chuyến trước khi xác nhận; Σ kg khác tổng HĐ ⇒ cảnh báo, vẫn tạo được.
- **R40 — Nới R29 cho lịch.** Tạo lịch (NV19) **không** cần đủ hồ sơ đính kèm, chỉ cần HĐ còn mở, có bản đang dùng và chưa có chuyến `open`. Ghi **từng chuyến lẻ** (NV7) vẫn giữ R29 (đủ hồ sơ). Bước 1 của chuyến vẫn theo R29 (xong = có bản hiệu lực + đủ hồ sơ).
- **R41 — Chuyến còn trống.** Chuyến `open` **còn trống** = chưa MSL, booking, ngày đóng, ETD, số cont, seal; không file; không mục nào "Xong" (≈ `canDeleteShipment` + các ô đầu chuyến trống). Sửa R35: "HĐ chưa có chuyến" đọc là **mọi chuyến open đều còn trống** ⇒ vẫn "Sửa hợp đồng" sửa thẳng; sửa thẳng đổi chứng từ yêu cầu ⇒ chuyến còn mở nhận thêm mục chứng từ thiếu (như R34); đổi kg ⇒ chuyến **không** tự chia lại (phần chênh hiện ở "còn thiếu" / vượt như R23). Xóa HĐ: mọi chuyến đều còn trống ⇒ xóa HĐ xóa luôn các chuyến đó (vẫn qua xác nhận + Hoàn tác); có chuyến không trống ⇒ như cũ (chỉ hủy).

**Flow optimization log:** loại (a) "1 chuyến ở tháng hạn giao" — HĐ nhiều cont phải tách tay, không trả lời được "tháng nào xuất bao nhiêu" · (b) "người dùng tự gõ từng chuyến" — chậm, dễ lệch tổng kg · (c) "bỏ R29 toàn bộ" — mất kỷ luật đính kèm; chọn R40 (chỉ nới cho lịch, bước 1 vẫn treo tới khi đủ hồ sơ) · (d) "giữ R35 cũ" — lập lịch xong mất quyền sửa lỗi gõ ⇒ thay bằng R41.

**Build (2026-10-31):** luật thuần `buildSchedule` · `scheduleGate` · `scheduleFor` · `shipmentsFromSchedule` · `isBlankShipment` · `canEditContractDirectly` (+ `canDeleteContract` theo R41) ở `lib/exportPlanning.ts`, test AC-74…77 ở `exportPlanning.test.ts`. Hộp `ScheduleDialog` (`ShipmentDialogs.tsx`, nháp `export-schedule`) mở ngay sau Lập HĐ mới (nút đóng "Không tạo") và từ hồ sơ HĐ (Thao tác khác + khối "Chưa ghi chuyến nào"). Ghi = chuyến `open` còn trống + mục chứng từ bước 5 (R6) + nhật ký; có Hoàn tác. Xóa HĐ xóa kèm chuyến còn trống + mục của chúng. Sửa thẳng HĐ đã tự bổ sung mục chứng từ cho chuyến còn mở (đường sẵn có). Demo: ca 7b HĐ 98.26/BSF-HTC.2026 mới lập + 3 chuyến dự kiến.

**Giả định:** tháng đầu = tháng sau tháng ký (khớp phụ lục 01 HĐ 01-26-HAT: ký 10/10/2026, 6 cont, giao 11/2026 → 04/2027 ⇒ mỗi tháng 1 chuyến) · HĐ thiếu ngày ký ⇒ tháng đầu = tháng hiện tại · tóm tắt hàng của chuyến = như Ghi chuyến đang điền · không migration (chuyến kế hoạch = chuyến thường còn trống) · demo: bộ sinh có ≥ 1 HĐ mới lập kèm lịch.

### AC-74 — Dựng lịch theo số cont · Maps to: NV19, R39 · Test: unit
- **Given** HĐ ký 10/10/2026, hạn giao 30/04/2027, 6 cont 40RF, tổng 129.600 kg
- **When** dựng lịch xuất hàng
- **Then** 6 chuyến, mỗi tháng 1 chuyến từ 11/2026 tới 04/2027
- **Assert** tháng == ["2026-11","2026-12","2027-01","2027-02","2027-03","2027-04"]; mỗi chuyến 21.600 kg; Σ kg == 129.600; loại == "40RF"

### AC-75 — Phần dư vào chuyến cuối, ít tháng hơn số cont · Maps to: NV19, R39 · Test: unit
- **Given** HĐ ký 05/10/2026, hạn giao 30/11/2026, 3 cont, tổng 10.000 kg
- **When** dựng lịch
- **Then** kg 3.333,33 · 3.333,33 · 3.333,34; tháng đầu 11/2026 = tháng cuối
- **Assert** Σ kg == 10.000; số chuyến tháng "2026-11" == 3; HĐ không ghi số cont ⇒ số chuyến == 1, tháng == tháng hạn giao

### AC-76 — Tạo lịch trước khi đủ hồ sơ · Maps to: NV19, R40 · Test: unit + e2e
- **Given** HĐ mới lập, chưa đính kèm hợp đồng đã ký, chưa có chuyến
- **When** U1 chọn tạo lịch và xác nhận 6 chuyến
- **Then** 6 chuyến open; HĐ vẫn chặng Đính kèm; bước 1 mỗi chuyến chưa xong; Ghi chuyến lẻ vẫn bị chặn tới khi đủ hồ sơ
- **Assert** số chuyến open == 6; `contractState` == "attaching"; `shipmentGate.ok` == false; HĐ đã có chuyến open ⇒ tạo lịch lần 2 bị chặn (0 chuyến thêm)

### AC-77 — Chuyến còn trống không chặn sửa thẳng, xóa HĐ xóa luôn · Maps to: NV19, R41 · Test: unit
- **Given** HĐ có 6 chuyến kế hoạch còn trống
- **When** kiểm quyền sửa thẳng và xóa HĐ; rồi gõ MSL cho 1 chuyến và kiểm lại
- **Then** lúc đầu sửa thẳng được, xóa được (xóa cả 6 chuyến); sau khi chuyến có MSL ⇒ chỉ ghi bản sửa, không xóa được
- **Assert** lần 1: sửa thẳng == true, xóa == true, chuyến bị xóa == 6; lần 2: sửa thẳng == false, `canDeleteContract.ok` == false

## 0c. v9.2 (2026-10-30) — yêu cầu nguyên liệu của dòng hàng, tự chép sang Lệnh sản xuất

Chủ dự án yêu cầu (theo phụ lục 01 HĐ 01-26-HAT, khách Hyakusaibou): mỗi dòng hàng thêm **chiều dài, tỉ lệ, số miếng, ghi chú** để "nhảy vào lệnh sản xuất luôn". Chốt 2026-10-30: tỉ lệ = **tỉ lệ râu / thân / cổ** (cột "Ratio tentacle and body"; có mặt hàng có cổ); số miếng = **chỉ pcs/kg** (gr/pc trung bình, dao động ghi ở ghi chú nếu cần); trên lệnh **gộp vào Quy cách** (như LSX giấy 19.10). Assortment % KHÔNG lưu (app tính được từ kg — đề xuất để sau).

**Nghiệp vụ** thuộc NV lập / sửa HĐ · owner U1 Nhân viên KH. Không thêm user, không thêm cross-user: nơi nhận lệnh (quản đốc, Phòng Kỹ thuật) đọc qua Lệnh sản xuất như cũ (ba-spec [48](48-production-order.ba-spec.md) R17).

**Luật:**
- **R38 — Yêu cầu NL của dòng hàng.** Bốn ô chữ tự do, không bắt buộc, nằm trong JSON `lines` của bản HĐ (không cột mới, không migration): `pieceLength` Chiều dài (cột "Length max cm/pc") · `partRatio` Tỉ lệ râu / thân / cổ ("Ratio tentacle and body") · `piecesPerKg` Số miếng / kg ("Number pcs/kg") · `note` Ghi chú dòng. Chữ tự do vì HĐ ghi khoảng ("590 – 770", "80% râu 20% thân"). Chép dòng (R-chép dòng) giữ cả bốn ô. Bản ghi cũ không có ⇒ trống. Sửa / ghi bản sửa theo luồng hiện có, không thêm luật duyệt.

### AC-73 — Yêu cầu NL đi theo dòng hàng · Maps to: R38, 48 R17 · Test: unit + manual
- **Given** dòng HĐ 01-26-HAT "3 gr cut", Chiều dài "1.5 - 3.5 cm/pc", Số miếng / kg "330 – 370", Tỉ lệ "80% râu 20% thân", Ghi chú "Không dùng hàng da giấy"
- **When** lưu HĐ, tải lại trang, rồi lập Lệnh sản xuất từ dòng đó
- **Then** hồ sơ HĐ còn đủ 4 ô; dòng lệnh có Quy cách và ghi chú chép từ dòng HĐ
- **Assert** `productionOrder.test.ts` AC-16: spec == "Size 3 gr cut · Dài 1.5 - 3.5 cm/pc · 330 – 370 miếng/kg · Tỉ lệ 80% râu 20% thân · IQF, 1kg/PE x 12/ctn", note == "Không dùng hàng da giấy"; thử tay: tải lại ⇒ 4 ô khác trống == 4

## 0b. v9.1 (2026-10-29) — danh mục Loại chứng từ: thêm / sửa ngay trong ô chọn

Chủ dự án yêu cầu: ô chọn "Loại chứng từ" thêm / sửa được loại mới tại chỗ (như mặt hàng), khỏi nhờ sửa code.

**Nghiệp vụ NV18 — Khai loại chứng từ · owner U1 Nhân viên KH** (U6 làm được như U1). Input: tên loại khách yêu cầu chưa có. Flow: gõ tên ở ô Loại chứng từ (Chứng từ khách yêu cầu của HĐ, hoặc mục chứng từ bước 5) → "Thêm mới" ⇒ loại vào danh mục, ô nhận luôn; hoặc bút chì / tab Danh mục → Loại chứng từ để đổi tên, thêm ghi chú. Output: loại có trong mọi ô chọn Loại chứng từ. Không bàn giao user khác.

**Luật:**
- **R37 — Danh mục loại chứng từ** (bảng `export_document_kinds`, mig 0081; luật thuần `documentKindList` · `findOrCreateDocumentKind` · `documentKindRowsFromList` ở `lib/exportPlanning.ts`).
  - Danh sách = 10 loại HỆ THỐNG (`DOCUMENT_KINDS`) rồi loại tự thêm.
  - Loại hệ thống giữ luật riêng theo id (R6 / R5: Commercial Invoice bắt số thùng · kg · tiền và tự có ở mọi chuyến; B/L bắt ngày on board; Bảo hiểm khi CIF / CIP). Đổi tên được. Xóa ⇒ về tên gốc.
  - Loại tự thêm (`doc-…`) tính như "Chứng từ khác": số (trừ tự cấp) + ngày + file.
  - Chứng từ đã ghi lưu id ⇒ đổi tên không tách sổ. Id lạ (bảng chưa nạp) ⇒ hiện "Chứng từ khác".
  - Gõ trùng tên (không phân hoa thường, kể cả tên loại hệ thống) ⇒ dùng loại có sẵn.
  - Quyền: theo `export-plans` (xem / thêm hoặc sửa / xóa), không có tài nguyên catalog riêng. Máy chủ chưa chạy 0081 ⇒ ô chỉ cho chọn 10 loại gốc (không ghi, không kẹt hàng chờ).

**Flow optimization log v9.1:** (a) bảng danh mục + loại hệ thống "ảo" đổi tên được *(chọn — giữ luật theo id, không seed dữ liệu, chạy cả không máy chủ)*; (b) seed 10 loại vào bảng *(loại — bảng trống / chưa chạy migration là mất cả 10 loại, phải đồng bộ seed với code)*; (c) chỉ cho thêm loại mới, không sửa loại hệ thống *(loại — trái luật 7: mọi mục trong ô phải có bút chì)*.

**AC v9.1** (test `exportPlanning.test.ts` khối "v9.1"):
- **AC-68** · Test: unit · Danh mục trống ⇒ `documentKindList([]).length == 10`, tên gốc.
- **AC-69** · Test: unit · Thêm "Giấy chứng nhận Halal" ⇒ id bắt đầu `doc-`, vị trí 10 (sau 10 loại hệ thống); gõ lại khác hoa thường ⇒ `created == false`, cùng id; gõ "packing list" ⇒ id `packing-list`.
- **AC-70** · Test: unit · Đổi tên C/O ⇒ đúng 1 dòng lưu `{ id: "certificate-of-origin" }`, nhãn chứng từ yêu cầu đổi theo; tên gốc ⇒ 0 dòng lưu.
- **AC-71** · Test: unit · Loại tự thêm thiếu số + ngày + file ⇒ `missing == ["number","issuedOn","file"]`; id lạ ⇒ nhãn "Chứng từ khác".
- **AC-72** · Test: manual (preview demo, đã thử 2026-10-29) · Ô Chứng từ 1 của form HĐ: gõ "Giấy kiểm dịch" → Thêm mới ⇒ ô nhận loại mới, danh mục có thêm đúng 1 dòng; tab Danh mục → Loại chứng từ hiện 10 + loại tự thêm.

---

## 0a. v9 (2026-10-29) — BỎ bước duyệt hợp đồng, chỉ còn duyệt cuối · THẮNG §0 v8 và mọi mục cũ

Chủ dự án yêu cầu 2026-10-29: "bỏ bước duyệt hợp đồng, chỉ giữ lại bước duyệt chốt cuối cùng". Chỉ đổi code — **không migration**: cột `stage`, RLS lượt duyệt và trigger đóng HĐ của 0079 giữ nguyên (lượt duyệt giờ chỉ còn duyệt cuối, vẫn cần `approve`).

**Chặng mới** (`ContractState` bỏ `pending`; `CONTRACT_FLOW_STAGES` còn 4 mục):

| Chặng | Trạng thái | Ai làm | Điều kiện sang chặng sau |
|---|---|---|---|
| 1 Đính kèm | `attaching` Chờ đính kèm | U1 Nhân viên KH (lập HĐ xong là vào đây) | đủ hồ sơ bắt buộc (HĐ đã ký + L/C khi thanh toán L/C) |
| 2 Ghi chuyến | `shipping` Đang ghi chuyến | U1 | mọi chuyến đủ hồ sơ + thực xuất trong dung sai |
| 3 Duyệt cuối | `final-review` Chờ duyệt cuối | **U6 Trưởng / Phó phòng KH** — lần duyệt DUY NHẤT | đồng ý ⇒ `status = closed` |
| Đóng | `closed` Đã đóng HĐ | — | U6 mở lại được |

**Luật v9:**
- **R34 — Bản hiệu lực = bản mới nhất.** Ghi là có hiệu lực ngay (`effectiveRevision` = bản mới nhất KHÔNG bị từ chối theo cách cũ). Không còn "bản chờ duyệt", không còn `pendingRevision`. Ghi bản sửa ⇒ chuyến còn mở nhận ngay mục chứng từ bản mới yêu cầu (R6 — trước chạy lúc duyệt). Thay R3 / R28 phần "duyệt bản", R31 phần "còn bản sửa chờ duyệt ⇒ chưa duyệt cuối".
- **R35 — Sửa thẳng hay ghi bản sửa.** HĐ **chưa có chuyến** ⇒ "Sửa hợp đồng" sửa thẳng bản đang dùng (gõ nhầm lúc lập). Có chuyến rồi ⇒ chỉ "Ghi bản sửa" (bản mới, bản cũ giữ để tra). Duyệt cuối xem lại cả các bản sửa.
- **R36 — Dữ liệu cũ.** Lượt duyệt bản đã ghi (BGĐ ký giấy trước 0079, `stage = contract` 28–29/10) giữ nguyên làm lịch sử, hiện ở "Các bản hợp đồng". "Từ chối" cũ vẫn loại bản đó khỏi hiệu lực; mọi bản bị từ chối ⇒ không có bản hiệu lực ⇒ chưa ghi chuyến / chưa xong lệnh SX (`no-revision`, `contract-not-approved`). R30 (file ký kiểu cũ thay "HĐ đã ký") giữ nguyên. HĐ đang "Chờ duyệt" trên DB thật tự thành "Chờ đính kèm" — không cần UPDATE.
- R28 rút lại: `approve` = duyệt cuối + mở lại HĐ. R29: ghi chuyến MỚI khi HĐ còn mở và đủ hồ sơ đính kèm (bỏ "đã duyệt").

**Cross-user handoff v9:** chỉ còn MỘT bàn giao U1 → U6 (HĐ sang Chờ duyệt cuối, hoặc U1 xin đóng sớm) và U6 → U1 khi trả về. Bàn giao U1 → U6 lúc lập HĐ **bỏ**.

**Flow optimization log v9:** cân 3 biến thể — (a) bỏ hẳn duyệt HĐ, bản sửa có hiệu lực ngay *(chọn — đúng yêu cầu, ít bước nhất, duyệt cuối vẫn soát toàn bộ)*; (b) bỏ duyệt bản 0 nhưng giữ duyệt bản sửa *(loại — người dùng nói "chỉ giữ duyệt cuối")*; (c) bản sửa chờ tới duyệt cuối mới có hiệu lực *(loại — chuyến đang chạy phải theo điều khoản mới ngay, để treo tới cuối HĐ là sai chứng từ)*.

**Assumptions v9:** (1) bản sửa có hiệu lực ngay (biến thể a); (2) sửa thẳng chỉ khi chưa có chuyến; (3) không đổi RLS / không migration — Nhân viên KH vẫn không ghi được lượt duyệt nào ở máy chủ.

**AC v9** (test `exportPlanning.test.ts` + `exportPlanningDemo.test.ts`):
- **AC-65** · Test: unit · HĐ mới lập (chỉ bản 0, không lượt duyệt) ⇒ `effectiveRevision` = bản 0, `contractState == "attaching"`, thiếu đúng `["signed-contract"]`.
- **AC-66** · Test: unit · Ghi bản sửa 1 ⇒ `effectiveRevision.revisionNo == 1` ngay, chuyến đã khép vẫn khép, HĐ có file ký kiểu cũ không tụt về `attaching`.
- **AC-57 (v9)** · Test: unit · Chưa đính kèm HĐ đã ký ⇒ `shipmentGate.reason == "attachments-missing"`; mọi bản bị từ chối kiểu cũ ⇒ `reason == "no-revision"`.
- **AC-64 (v9)** · Test: unit · Bản sửa mới không chặn duyệt cuối: `finalReviewGate == { ok: true, needsReason: false }`.
- **AC-67** · Test: unit (demo) · Bộ demo: HĐ "mới lập" và "quá hạn chưa lên chuyến" ở `attaching` (0 HĐ ở trạng thái chờ duyệt).
- AC-56 (v8) **bỏ**; AC-5, AC-7, AC-9 (luồng duyệt bản) đọc theo R34.

---

## 0. v8 (2026-10-28) — quy trình duyệt mới · ⚠️ phần "Duyệt HĐ" đã bỏ ở §0a v9

Chủ dự án chốt 2026-10-28 (4 câu hỏi qua phiên Claude). Mục nào bên dưới còn nói "BGĐ ký giấy, nhân viên ghi lại", "HĐ chờ duyệt vẫn lên chuyến", "HĐ tự khép Đã xuất đủ" hay "Chốt HĐ" là **luật cũ**, đọc theo mục này.

**Chặng của hợp đồng** (`ContractState`, `CONTRACT_FLOW_STAGES` ở `lib/exportPlanning.ts`):

| Chặng | Trạng thái | Ai làm | Điều kiện sang chặng sau |
|---|---|---|---|
| 1 Duyệt HĐ | `pending` Chờ duyệt | **U6 Trưởng / Phó phòng KH** duyệt trên app (đồng ý / yêu cầu sửa / từ chối) | có bản `approved` |
| 2 Đính kèm | `attaching` Chờ đính kèm | U1 Nhân viên KH | đủ hồ sơ bắt buộc: **hợp đồng đã ký** luôn có + **L/C** khi thanh toán L/C (`requiredAttachmentKinds`). Proforma / hồ sơ khác không bắt |
| 3 Ghi chuyến | `shipping` Đang ghi chuyến | U1 | mọi chuyến đủ hồ sơ + thực xuất trong dung sai (luật `contractClosure` cũ) |
| 4 Duyệt cuối | `final-review` Chờ duyệt cuối | U6 | đồng ý ⇒ `status = closed` |
| Đóng | `closed` Đã đóng HĐ | — | U6 mở lại được (phải duyệt cuối lại) |

**Luật v8:**
- **R28 — Người duyệt.** Chỉ người có quyền `export-plans:approve` (vai trò **`planning-head` Trưởng phòng Kế hoạch**, **`planning-deputy` Phó phòng Kế hoạch**, admin) ghi lượt duyệt (bản HĐ lẫn duyệt cuối). Người duyệt = **tài khoản đang đăng nhập** (không chọn / gõ thay). Nhân viên KH (`planner`) KHÔNG có `approve`. Máy chủ chặn: RLS `export_contract_approvals` insert / update / delete = `approve` (mig 0079).
- **R29 — Ghi chuyến sau cùng.** Ghi chuyến MỚI chỉ khi HĐ còn mở, **đã duyệt** và **đủ hồ sơ đính kèm** (`shipmentGate`). Chuyến đã có từ trước giữ nguyên (sửa / theo dõi bước được). Bước 1 của chuyến ("Hợp đồng") xong = có bản hiệu lực + đủ hồ sơ đính kèm (thay luật A4 "bản hiệu lực có file ký").
- **R30 — HĐ duyệt theo luật cũ.** Một bản BẤT KỲ của HĐ có lượt duyệt không `stage` (BGĐ ký giấy, ghi trước 0079) + có file ⇒ tính thay "Hợp đồng đã ký" — kể cả khi bản sửa sau đó được duyệt theo cách mới — HĐ cũ không bị kẹt ở Chờ đính kèm vì thiếu file đó (L/C vẫn bắt). Lượt duyệt mới có `stage = contract`.
- **R31 — Duyệt cuối.** Xuất đủ không còn tự đóng: HĐ chuyển **Chờ duyệt cuối**. Còn bản sửa chờ duyệt ⇒ chưa duyệt cuối được (duyệt bản sửa trước). Duyệt cuối = lượt duyệt `stage = final` gắn bản hiệu lực; **đồng ý** ⇒ `status closed` (+ lý do / ghi chú), **trả về** ⇒ ghi lý do, HĐ đứng nguyên chặng. Đóng sớm khi đang ghi chuyến (ngoài dung sai — khách giảm lượng, phụ kiện) = duyệt cuối **bắt lý do** (thay "Chốt HĐ" của nhân viên). Cần ≥ 1 chuyến còn mở. Máy chủ: trigger `export_contracts_enforce_close` — đổi status sang / khỏi `closed` phải có `approve`.
- **R32 — Nhật ký hợp đồng.** Mọi lượt ghi trên màn (lập / sửa bản, duyệt, đính kèm / gỡ file, ghi / sửa / hủy / xóa chuyến, cập nhật mục bước, tiền về, hủy / đóng / mở lại HĐ, **Hoàn tác**) thêm một dòng vào bảng `export_activity_log`: ai · lúc nào · việc gì · chuyến nào. **Chỉ thêm** — trigger giữ nguyên dòng cũ khi có lệnh sửa (kể cả nhánh upsert), chỉ xóa được dòng của chế độ demo. **Người ghi + giờ ghi do máy chủ đặt** (họ tên trong `user_profiles` của tài khoản đang gọi, giờ máy chủ) — không giả tên / lùi giờ được. Xem ở hồ sơ HĐ (khối "Nhật ký thao tác") — ai có `export-plans:view`. Máy chủ chưa chạy 0079 ⇒ không ghi (không kẹt hàng chờ), nghiệp vụ vẫn chạy. Nhật ký chung `audit_log` vẫn ghi diff như mọi bảng (admin xem ở /audit); bảng nhật ký HĐ không chép sang `audit_log`.
- **R33 — Chú thích viết tắt.** Mọi nhãn ô nhập / tiêu đề cột / nhãn thông tin có từ viết tắt ngoại thương (ETD, ETA, L/C, TTR, B/L, C/O, H/C, HS, MSL, Incoterm, FOB, CFR, CIF, RF, HC, rvs, PL) tự có nút "?" — rê chuột xem nghĩa, chạm mở chú thích. Bảng chữ ở `lib/abbreviations.ts` (HĐ, BGĐ không gắn — ai cũng biết).

**User registry v8:** thêm **U6 Trưởng / Phó phòng Kế hoạch** (`planning-head`, `planning-deputy`, phòng `planning`, trang chủ Xuất khẩu) = mọi quyền của U1 + `approve`. **U2 Ban giám đốc** không còn trong luồng duyệt (chỉ xem). U1 lập HĐ, đính kèm, ghi chuyến, cập nhật bước; không duyệt, không đóng / mở lại HĐ.

**Nối mặt hàng (R16 / R23, rà 2026-10-28):** (a) nối ở bản hiệu lực ⇒ bản sửa CHỜ DUYỆT mới hơn nhận nối cho dòng cùng tên + size còn trống (`applyProductMapping`); (b) mở lại nháp cũ không xóa nối của dòng không có trong nháp; (c) bậc 2 "tên của khách" không nhận dòng tên ghi size KHÁC size của dòng HĐ; (d) bậc 3 "HĐ trước" bỏ dòng cùng tên khác size. Còn để sau: gợi ý chạy khi rời ô tên trước khi gõ size; nối sai đã trích xuất tên của khách không tự sửa; so size chưa bỏ khoảng trắng như invoice (`sizeKey`).

**AC v8** (test `exportPlanning.test.ts` khối "v8"):
- **AC-56** Duyệt mới xong ⇒ Chờ đính kèm; bước 1 chưa xong; chưa ghi chuyến được (file bản HĐ lúc lập không tính).
- **AC-57** Chưa duyệt ⇒ không ghi chuyến được.
- **AC-58** L/C ⇒ bắt cả HĐ đã ký lẫn L/C; đủ thì Đang ghi chuyến, ghi chuyến được, bước 1 xong.
- **AC-59** Không nối máy chủ ⇒ không bắt file đính kèm.
- **AC-60** Duyệt cuối không đổi bản hiệu lực; trả về ⇒ vẫn Chờ duyệt cuối; status closed ⇒ Đã đóng HĐ.
- **AC-61** Ngoài dung sai ⇒ duyệt cuối được nhưng bắt lý do; chưa có chuyến ⇒ chưa duyệt cuối.
- **AC-63** HĐ cũ + bản sửa duyệt theo cách mới ⇒ không tụt về Chờ đính kèm.
- **AC-64** Còn bản sửa chờ duyệt ⇒ chưa duyệt cuối được.
- **AC-62** (manual, cần DB) Nhân viên KH ghi lượt duyệt / đóng / mở lại HĐ qua API ⇒ máy chủ từ chối; sửa nhật ký ⇒ từ chối. Đã thử trên PGlite.

---

## 1. Vấn đề & JTBD

- **Job:** Mỗi tháng, **nhân viên Phòng Kế hoạch** muốn nhìn từng khách, từng hợp đồng, từng chuyến container đang ở bước nào và còn thiếu giấy gì, để không chuyến nào đi mà thiếu chứng từ và không hợp đồng nào bị bỏ quên.
- **Vì sao làm bây giờ:**
  - Hồ sơ đang kẹp giấy (KH-R15). Sổ kế hoạch là Excel, mỗi tháng một sheet, có tháng chép trùng dòng của tháng trước.
  - Giấy tờ không ghi số của nhau: lệnh SX, lệnh xuất, invoice đều không ghi số hợp đồng. Chỉ người nhớ mới nối được.
  - App đã có Đơn đặt `/orders` nhưng không gắn hợp đồng, không có hạn giao.
- **Đo thành công bằng:** sau 1 tháng chạy song song (tháng 10/2026), **mọi booking đóng cont trong tháng có trên app**, và mỗi chuyến trả lời được "còn thiếu bước nào" mà không phải mở giấy (§8).

**Phạm vi đợt 1 = chỗ chứa + trạng thái.** Mọi bước sau hợp đồng là **đánh dấu tay + đính file**. Riêng invoice thương mại ghi thêm 3 con số tổng (thùng, kg tịnh, tiền) để tính thực xuất và dung sai. Đối chiếu tự động giữa các chứng từ, lệnh SX có cấu trúc, mẫu thùng, sơ đồ cont dạng lưới để các đợt sau (§7).

## 2. User registry

| User | Vai trò trong app | Là ai | Bối cảnh |
|---|---|---|---|
| **U1 Nhân viên Kế hoạch** | `planner` — **vai trò hệ thống MỚI**, phòng ban `planning` (Q11) | lập hợp đồng, lên chuyến, theo dõi bước, gom chứng từ, điền số cont/seal | desktop văn phòng |
| **U2 Ban giám đốc** | `director`, `vice-director` | ký duyệt hợp đồng và lệnh xuất **trên giấy** (Q4); trên app chỉ xem | desktop / điện thoại |
| **U3 Kế toán** | `chief-accountant`, `accountant` | xem hợp đồng + giá; ghi **tiền về** (Q5) | desktop |
| **U4 Người đóng hàng** | `warehouse-keeper`, `frozen-workshop-manager`, `fish-workshop-manager`, `dried-workshop-manager`, `vice-manager` | chụp ảnh lớp hàng, seal, số cont lúc đóng; đính sơ đồ cont khi cần (Q7) | **điện thoại tại bãi đóng cont** |
| **U5 Quản trị** | `admin` | gán người vào vai trò `planner`, chỉnh quyền | desktop |
| **S1 Hệ thống** | — | tính tháng của chuyến, tổng hợp đồng, thực xuất, trạng thái bước, độ phủ chuyến, trễ hạn, khép kín | nền |

> Kỹ thuật · Kho · Phân xưởng **nhận lệnh SX** là việc của đợt 2 — không có trong registry đợt 1.
> U4 xác định theo **người có mặt lúc đóng cont**, không theo xưởng: hàng khô (lô `J0xx`, cá đuối khô) cũng đóng cont.

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Cấp vai trò Kế hoạch cho người dùng | U5 | U1 (người được cấp) | — | 1 lần / người | Must |
| NV2 | Bổ sung thông tin khách xuất khẩu | U1 | — | — | thấp | Must |
| NV3 | Lập hồ sơ hợp đồng (đầu HĐ + thanh toán / L/C + dòng hàng + chứng từ khách yêu cầu + file) | U1 | — | NV2 | vài / tháng | Must |
| NV4 | Ghi kết quả duyệt giấy của BGĐ cho một bản HĐ | U1 | U2 (người ký giấy) | NV3 / NV5 | mỗi bản | Must |
| NV5 | Ghi bản sửa hợp đồng (rvs / phụ kiện / tu chỉnh L/C), không ghi đè | U1 | U2 (ký lại) | NV4 | thỉnh thoảng | Must |
| NV6 | Ghi gia hạn giao hàng khách đã xác nhận (KH-R11) | U1 | khách (xác nhận ngoài app) | NV4 | thỉnh thoảng | Must |
| NV7 | Lên chuyến cho hợp đồng | U1 | — | NV3 | 12–39 / tháng toàn xưởng | Must |
| NV8 | Cập nhật bước 2–5 của chuyến (đánh dấu + file + số) | U1 | U4 (mục 4a, 4b) | NV7 | hằng ngày | Must |
| NV9 | Đính ảnh / sơ đồ đóng cont | U4 | U1 (điền số cont, seal) | NV7 | mỗi chuyến | Should |
| NV10 | Ghi gửi bộ chứng từ cho khách và tiền về (bước 6) | U3 | U1 (xem + ghi được, Q5) | NV7 | mỗi chuyến / HĐ | Should |
| NV11 | Theo dõi tháng (xem, lọc khách, tra số, xuất Excel) | U1 | U2, U3 (xem) | NV7 | hằng ngày | Must |
| NV12 | Khép kín chuyến và hợp đồng | S1 (tự tính) | U1 (đóng tay có lý do) | NV8 | mỗi chuyến | Must |
| NV13 | Hủy / xóa hợp đồng hoặc chuyến | U1 | — | NV3 / NV7 | hiếm | Must |
| NV14 | Khai **tên hàng theo khách** — tên · size · quy cách · mã HS mà MỖI KHÁCH dùng trên HĐ / invoice cho một mặt hàng của xưởng (v6; v5 là một tên / mặt hàng) | U1 | — | — | khi có khách / mặt hàng XK mới; 15–20 dòng / khách | Must |
| NV16 | **Trích xuất** tên hàng theo khách từ dòng hàng HĐ đã nối mặt hàng (v6) và từ Commercial Invoice đọc được (v7) | S1 (tự tính) | U1 (soát / sửa danh sách) | NV3, NV14, NV17 | mỗi lần lưu HĐ / nối mặt hàng / lưu invoice | Must |
| NV17 | **Đọc Commercial Invoice** từ file Excel gốc / PDF xuất từ Excel: điền số, ngày, 3 số tổng; so với HĐ; nối dòng để trích xuất tên (v7) | U1 | — | NV8 | mỗi chuyến | Should |
| NV15 | Xem **báo cáo xuất khẩu** theo kỳ: sản lượng, giá trị, tiền về, đúng hạn, hồ sơ còn kẹt, HĐ cần chú ý (v5) | U2 | U3, U1 (xem cùng số) | NV7, NV8, NV10 | hằng tháng / quý | Must |

## 4. Cross-user handoff

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Khi không ai nhận |
|---|---|---|---|---|---|
| H1 | NV1 → mọi NV | U5 cấp vai trò | U1 | người dùng có vai trò `planner` | U1 không thấy module; không treo dữ liệu |
| H2 | NV3 / NV5 → NV4 | U1 lập bản HĐ | U2 ký giấy → **U1 ghi lại** | bản HĐ chờ duyệt có file | HĐ chưa có bản duyệt nào: bước 1 "đang làm", **chặn đánh dấu xong bước 2** (KH-R8). Bản sửa chờ duyệt **không** ảnh hưởng bản đã duyệt. Nhắc hạn ở đợt 4 |
| H3 | NV7 → NV9 | U1 lên chuyến | U4 đính ảnh / sơ đồ | chuyến chưa hủy, ngày đóng trong ±7 ngày hoặc chưa có | thiếu ảnh ⇒ mục 4b không xong ⇒ chuyến không khép — **U1 tự đính thay được** (Q7) |
| H4 | NV9 → NV8 | U4 gửi ảnh seal + cửa cont | U1 điền số cont + seal | có ảnh mục 4b | thiếu số cont/seal ⇒ bước 4 không xong |
| H5 | NV8 → NV10 | U1 (chuyến có invoice thương mại) | U3 ghi tiền về | chuyến chưa hủy | tiền chưa về **không chặn khép kín** (Q5); chuyến hiện "đã về X / Y" |
| H6 | NV8 → NV12 | U1 | S1 tính | mọi bước bắt buộc ở `done` / `not-applicable` | — (tự tính) |

## 5. Flows

### Flow NV1 — Cấp vai trò Kế hoạch · owner U5
- **Start:** có tài khoản của nhân viên phòng KH.
- **Input:** tài khoản, vai trò `planner`.
- **Output:** người đó có quyền theo ma trận R11; phòng ban = `planning` ⇒ đọc được **QTI-KH-01 + 8 biểu mẫu** ở Tài liệu công ty; trang chủ = Xuất khẩu.
- **End:** lần đăng nhập kế tiếp áp quyền mới.

### Flow NV2 — Bổ sung thông tin khách · owner U1
- **Input:** quốc gia, địa chỉ, cảng đích mặc định, điều kiện thanh toán mặc định, người liên hệ, email.
- **Output:** khách có đủ trường; trường cũ (mã, tên, thị trường) không đổi. Mọi trường mới **không bắt buộc**.
- **End:** HĐ mới của khách tự điền sẵn cảng đích và thanh toán (sửa được trên HĐ).

### Flow NV3 — Lập hồ sơ hợp đồng · owner U1
- **Start:** khách đã xác nhận đơn (giấy / email).
- **Input bắt buộc:** khách · số HĐ · ngày ký · **hạn giao muộn nhất** · tiền tệ (cấp HĐ, mặc định USD) · ≥1 dòng hàng.
- **Input khác:** Order ref của khách · incoterm (danh sách Incoterms 2020) · cảng xếp / cảng đích · **thanh toán** (TTR · L/C · khác) + % cọc · nếu L/C: số L/C, ngày hết hạn L/C, hạn giao theo L/C, file L/C · dung sai % (trống = 0) · số cont + loại cont · **chứng từ khách yêu cầu**, mỗi mục gồm loại + form / người cấp (VD C/O **form VJ**, H/C **công ty tự cấp**) · file HĐ.
- **Dòng hàng:** mô tả (đúng chữ tiếng Anh trên HĐ), **mặt hàng danh mục** (không bắt buộc lúc lập — R16), mã HS, size, quy cách, đơn vị tính (thùng / kiện), số thùng mỗi kiện, kg tịnh mỗi thùng, số lượng, kg (= số lượng × số thùng mỗi kiện × kg/thùng, sửa tay được), đơn giá, tiền (= kg × đơn giá), yêu cầu vi sinh. Số chép từ chứng từ tiếng Anh ("10.50", "194,557.60") được hiểu đúng (R22).
- **Output:** HĐ với bản 0 trạng thái **chờ duyệt**; tổng `units` / `cartons` / kg / tiền tính sẵn (R2); bước 1 "đang làm".
- **End:** HĐ ở tháng của hạn giao, nhãn "chưa lên chuyến".

### Flow NV4 — Ghi kết quả duyệt giấy · owner U1
- **Start:** BGĐ đã ký (hoặc trả về) bản giấy của **một bản HĐ** (bản 0 hoặc bản sửa).
- **Input:** bản HĐ, kết quả (`approved` · `needs-revision` · `rejected`), **người ký chọn từ tài khoản có vai trò Giám đốc / Phó giám đốc** (R17 — không gõ tự do; mặc định Giám đốc khi hệ thống có đúng một tài khoản Giám đốc; PGĐ đồng ý ký HĐ phải xác nhận "ký theo ủy quyền"), ngày, file scan, lý do (bắt buộc khi không đồng ý). Chưa có tài khoản BGĐ ⇒ tạm gõ họ tên, có dòng nhắc admin gán vai trò.
- **Output:**

| Bản | `approved` | `needs-revision` | `rejected` |
|---|---|---|---|
| **Bản 0** (HĐ chưa từng duyệt) | HĐ `approved`, bản 0 là bản hiệu lực | HĐ giữ "chờ duyệt", ghi lý do | HĐ `cancelled` + lý do (kéo theo NV13: hủy chuyến chưa đóng cont) |
| **Bản sửa** (HĐ đã có bản duyệt) | bản sửa thành **bản hiệu lực** | bản sửa giữ chờ, ghi lý do | **bỏ bản sửa**, bản hiệu lực cũ giữ nguyên; HĐ **không** bị hủy |

- **End:** mọi lần ghi duyệt giữ lại, gắn với đúng bản; lần sau không đè lần trước.

### Flow NV5 — Ghi bản sửa hợp đồng · owner U1
- **Start:** HĐ đã có bản hiệu lực; hai bên ký phụ kiện / bản rvs, hoặc ngân hàng gửi tu chỉnh L/C.
- **Input:** ngày sửa, nội dung sửa, file bản sửa, thay đổi đầu HĐ / dòng hàng.
- **Steps:** mở bản sửa → hệ thống **chụp bản hiệu lực** (đầu + dòng) → người dùng sửa → lưu → chờ ghi duyệt (NV4).
- **Output:**
  - Số bản +1; bản cũ + file cũ tra lại được (KH-R7).
  - **Trong lúc bản sửa chờ duyệt: HĐ giữ `approved` theo bản hiệu lực cũ.** Tổng HĐ, dung sai, chứng từ yêu cầu dùng bản hiệu lực. Bước 1, bước 2 đã xong, chuyến đã khép **không đổi**.
- **End:** khi bản sửa được duyệt, các tính toán chuyển sang bản mới (có thể làm HĐ khép hoặc mở lại theo NV12).

### Flow NV6 — Ghi gia hạn giao hàng · owner U1
- **Start:** nguy cơ trễ, khách đồng ý kéo hạn (KH-R11).
- **Input:** hạn giao mới, ngày khách xác nhận, file xác nhận của khách (email / thư), ghi chú.
- **Output:** hạn giao hiệu lực = hạn mới; lịch sử gia hạn giữ lại. **Không** tạo bản sửa, **không** cần BGĐ duyệt lại.
- **End:** "trễ hạn" tính theo hạn mới.

### Flow NV7 — Lên chuyến · owner U1
- **Start:** HĐ chưa hủy (HĐ chờ duyệt vẫn lên chuyến kế hoạch được — như sổ Excel ghi trước khi ký xong).
- **Input:** HĐ · tháng kế hoạch · loại chuyến (**20RF · 40RF · 40HC-RF · Xe tải · Đóng ghép**) · mô tả mặt hàng · kg kế hoạch · mã lô MSL (chữ tự do, cho phép "216+006") · cảng đích · booking (trống = "chờ booking") · ngày đóng · ETD · ETA · tàu/chuyến · số cont · seal (hoặc biển số xe với Xe tải) · ghi chú.
- **Output:**
  - Chuyến thuộc HĐ. **Tháng = tháng(ngày đóng) ?? tháng(ETD) ?? tháng kế hoạch** (Q1).
  - 6 bước khởi tạo: bước 1 theo HĐ; bước 2–6 "chưa làm"; bước 5 sinh một mục cho mỗi chứng từ yêu cầu của bản HĐ hiệu lực, **cộng mục Commercial Invoice** nếu HĐ chưa liệt kê.
- **End:** chuyến hiện ở đúng tháng, dưới đúng khách; HĐ cập nhật độ phủ chuyến (NV12).

### Flow NV8 — Cập nhật bước 2–5 · owner U1
- **Start:** chuyến chưa hủy.
- **Input:** bước / mục + trạng thái (`not-started` · `in-progress` · `done` · `not-applicable`) + file + ghi chú + số liệu của mục; hoặc "**dùng chung với chuyến …**" (cùng booking / cùng lô — trỏ tới mục đã xong của chuyến kia).

| Bước | Mục con | Xong khi |
|---|---|---|
| 2 Lệnh sản xuất | — | chuyến gắn ≥ 1 **Lệnh sản xuất đã phát hành** (ba-spec 48 R6 — tự xong) **HOẶC** có ≥1 file (hoặc dùng chung) **và** HĐ đã có bản hiệu lực (KH-R8) **và mọi dòng hàng của bản hiệu lực đã nối mặt hàng danh mục** (R16) |
| 3 Bao bì | — | có file hoặc ghi chú (VD "đã có sẵn") |
| 4 Đóng cont | 4a Sơ đồ container · 4b Hình ảnh · 4c Tờ khai · 4d Lệnh xuất | 4a **tự xong** khi có file · 4b **tự xong** khi có ≥1 ảnh · 4c có số tờ khai **và** file · 4d có file lệnh xuất **đã có chữ ký BGĐ** (KH-R4); **và** số cont + seal đã điền (Xe tải: biển số; Đóng ghép: `not-applicable` + lý do) |
| 5 Bộ chứng từ | một mục / chứng từ yêu cầu (+ **bảo hiểm tự thêm khi Incoterm CIF / CIP** — R19; + mục thêm tay, VD kết quả kiểm vi sinh, hóa đơn hàng mẫu "M") | mỗi mục: số, ngày, file — **chứng từ công ty tự cấp (VD H/C) không bắt số** (R20). **Commercial Invoice** thêm Σ thùng, Σ kg tịnh, Σ tiền. **B/L** thêm ngày on board. Bước 5 xong khi **mọi mục** `done` / `not-applicable`. **Mục theo chứng từ khách yêu cầu không xóa được**, chỉ "không áp dụng" + lý do; mục thêm tay xóa được, hỏi lại trước (R21) |

- `not-applicable` bắt buộc có lý do.
- **Thực xuất của chuyến** = Σ thùng / kg tịnh / tiền của các **invoice thương mại** của chuyến. **Không** cộng hóa đơn hàng mẫu "M", **không** lấy số trên B/L (B/L gồm cả hàng mẫu: 22.227,8 kg so với 22.214 kg).
- **Output:** trạng thái bước cập nhật; ai đổi, lúc nào vào nhật ký.
- **End:** trạng thái hiện ngay ở tháng.

### Flow NV9 — Đính ảnh / sơ đồ đóng cont · owner U4
- **Start:** chuyến chưa hủy, ngày đóng trong ±7 ngày so với hôm nay **hoặc** chưa có ngày đóng.
- **Input:** nhiều ảnh một lần (chụp hoặc chọn), tùy chọn số lớp / chú thích; file sơ đồ cont.
- **Output:** ảnh gắn mục 4b, file gắn 4a ⇒ hai mục **tự xong**. U4 **chỉ thêm file** vào 4a / 4b, không sửa chuyến, không đổi bước khác.
- **End:** U1 thấy ảnh mới, điền số cont + seal từ ảnh (H4).

### Flow NV10 — Gửi bộ chứng từ và tiền về (bước 6) · owner U3
- **Input:**
  - **Gửi bộ chứng từ cho khách:** ngày gửi, cách gửi (email / chuyển phát / ngân hàng), file email. Là mốc tính hạn trả TTR "sau khi nhận bộ chứng từ" và hạn xuất trình L/C.
  - **Tiền về:** ngày, số tiền, tiền tệ, ghi chú, file giấy báo có. Ghi được ở **cấp chuyến** hoặc **cấp HĐ** (tiền cọc trước sản xuất); nhiều lần.
- **Output:** chuyến hiện "đã về X / Y" với Y = tiền thực xuất của chuyến; HĐ hiện tổng tiền về (cọc + các chuyến) so với tổng tiền thực xuất, và **liệt kê từng lần cọc / tiền về cấp HĐ (xem · sửa · xóa có Hoàn tác)**. **Không ảnh hưởng đủ hồ sơ / xuất đủ** (Q5).
- **End:** U1 xem và ghi được cùng chỗ; ghi sai thì xóa (có Hoàn tác).

### Flow NV11 — Lịch xuất hàng (theo tháng / tuần / khoảng ngày) · owner U1
- **Input:** **kỳ xem** = tháng · tuần lịch (Thứ 2 → Chủ nhật) · khoảng ngày (R18); lọc khách (tùy chọn — **4 con số cũng theo khách**); ô tra theo **MSL / booking / số cont / số invoice / số B/L / số HĐ / số đơn khách** — tra mọi kỳ, ra **cả HĐ chưa lên chuyến**.
- **Output:**
  - Chuyến của tháng gom theo khách, mỗi chuyến có trạng thái 6 bước.
  - HĐ chưa lên chuyến: hiện ở tháng của hạn giao; **hạn đã qua mà vẫn chưa lên chuyến ⇒ hiện thêm ở tháng hiện tại, nhãn trễ**.
  - HĐ chưa phủ đủ (NV12) hiện nhãn "còn X kg / Y cont chưa lên chuyến".
  - 4 con số: số chuyến · chuyến đã khép · chuyến thiếu bước · **chuyến trễ hạn** (ngày on board B/L ?? ETD > hạn giao hiệu lực). HĐ quá hạn chưa lên chuyến đếm riêng.
  - Xuất Excel theo bố cục sổ "Kế hoạch xuất hàng" (Q10) cho **kỳ đang xem** (và khách đang lọc): gom theo **tuần lịch T2 → CN** của ngày đóng, nhãn "T2 (05-11/10)"; các chuyến **cùng booking gộp một dòng**, CONT ghép (VD "40+20"); HĐ chưa lên đủ chuyến ở phần cuối — HĐ đã có chuyến thì ghi **phần còn thiếu** (kg / cont), không ghi "Chờ booking".
- **End:** người xem biết chuyến nào thiếu gì mà không mở giấy.

### Flow NV12 — Đủ hồ sơ / Xuất đủ · owner S1 (chốt tay: U1)
> Nhãn cho người dùng (§9b): chuyến khép = **"Đủ hồ sơ"**; HĐ khép tự tính = **"Đã xuất đủ"**; HĐ đóng tay = **"Đã chốt HĐ"** (nút **Chốt HĐ** / **Mở lại HĐ**); lệch = **"Ngoài dung sai: kg thừa / thiếu x%"**. Không dùng "thanh lý" (thủ tục pháp lý của kế toán). Tên khóa kỹ thuật (`closed`, `isShipmentClosed`, `contractClosure`) giữ nguyên.
- **Chuyến khép** khi bước 2, 3, 4, 5 đều `done` / `not-applicable` (bước 6 không tính).
- **Độ phủ HĐ** (chưa khép): Σ kg kế hoạch các chuyến chưa hủy < kg HĐ × (1 − dung sai), **hoặc** số chuyến cont < số cont trên HĐ ⇒ nhãn "còn X kg / Y cont chưa lên chuyến". Nhãn này **khác** "lệch dung sai".
- **HĐ khép** (`closed`) khi:
  - HĐ có bản hiệu lực và ≥1 chuyến chưa hủy,
  - mọi chuyến chưa hủy đều khép,
  - **và cả** Σ kg thực xuất **lẫn** Σ tiền thực xuất nằm trong [HĐ × (1 − dung sai), HĐ × (1 + dung sai)], **tính cả hai đầu**; dung sai trống = 0%.
- Mọi chuyến khép mà Σ lệch ngoài dung sai ⇒ không tự khép, báo "lệch dung sai" kèm % lệch kg và % lệch tiền. U1 **đóng tay** với lý do bắt buộc.
- Chuyến bị đổi về chưa xong, hoặc bản sửa mới được duyệt làm Σ ra ngoài dung sai ⇒ HĐ tự khép về `approved` (trừ HĐ đóng tay).

### Flow NV13 — Hủy / xóa · owner U1
- **HĐ:**
  - **Xóa** được khi chưa từng có bản duyệt `approved` và chưa có chuyến.
  - **Hủy** (`cancelled` + lý do) được khi **chưa chuyến nào đã đóng cont** (đã có số cont hoặc biển số). Hủy HĐ ⇒ mọi chuyến của HĐ tự hủy cùng lý do.
  - HĐ có chuyến đã đóng cont ⇒ không hủy, chỉ đóng tay (NV12).
- **Chuyến:** xóa được khi chưa có file nào và chưa bước nào `done`; còn lại ⇒ hủy + lý do. Chuyến hủy không tính vào kỳ xem, độ phủ, khép kín. **Chuyến đã hủy khôi phục được** khi HĐ còn mở (về đang làm; mục "dùng chung" ở chuyến khác đã rơi về chưa làm thì không tự quay lại).
- **Tiền về:** xóa được (ghi sai), có Hoàn tác.
- Mọi xóa có xác nhận + **Hoàn tác** (luật repo 6).

### Flow NV14 — Khai tên hàng theo khách · owner U1 (v6)
- **Vì sao (họp 2026-10-22, anh Lê Khiêm — Phòng Kế hoạch):** cùng một mặt hàng nhưng mỗi khách gọi một tên trên chứng từ (Matsuda: "Frozen boiled octopus"; Seachemot: "Iwadako…"); tên theo **giao dịch thực tế với từng khách**, không theo nước; mỗi khách chỉ ~15–20 tên, **theo từng size**. Iwadako = bạch tuộc 2 da · Iidako = 1 da · Eihire = cá đuối.
- **Start:** khách xuất khẩu có trong danh mục; mặt hàng của xưởng có trong danh mục mở `products` (đã gồm size).
- **Input:** khách · mặt hàng · **tên trên chứng từ** (bắt buộc) · size · quy cách đóng gói · mã HS · ghi chú (tùy chọn).
- **Output:** dòng tên của cặp (khách, mặt hàng) — **mỗi cặp một dòng** (R23). Danh sách của một khách xem / sửa / xóa được ở **danh mục Khách hàng** (chủ dự án chọn).
- **Dùng ở:** (a) lập HĐ — chọn mặt hàng cho một dòng ⇒ các ô tên · size · quy cách · mã HS **đang trống** lấy theo tên của khách của HĐ; khách chưa có tên cho mặt hàng ⇒ chỉ tên lấy **tên tiếng Anh mặc định** (`products.trade_name`); (b) nối mặt hàng (R16) theo thứ tự R23.
- **End:** HĐ lập sau dùng được ngay; HĐ đã lưu **không** đổi khi sửa danh sách (sổ giữ chữ lúc ghi, như sổ nối theo tên ở danh mục).

### Flow NV16 — Trích xuất tên hàng theo khách từ chứng từ · owner S1 (v6.2)
- **Tên gọi (chủ dự án 2026-10-22):** "Trích xuất từ chứng từ" — thay chữ "tự học" ở mọi chỗ (nút, ghi chú dòng "Trích xuất từ HĐ <số>", thông báo).
- **Start:** (a) người dùng lưu HĐ / bản sửa (NV3, NV5) hoặc lưu hộp nối mặt hàng (R16) — trích xuất các dòng của HĐ đó; (b) người dùng chọn **"Trích xuất từ chứng từ"** ở bảng tên hàng của khách — quét MỌI hợp đồng xuất khẩu chưa hủy của khách (bản đang dùng; HĐ ký trước xét trước), **rồi mọi file Commercial Invoice đọc được đã đính ở các HĐ đó** (v7, R27 — bản scan / file lỗi bỏ qua, báo số file bỏ qua); (c) người dùng lưu mục Commercial Invoice sau khi đọc file (NV17) — trích xuất các dòng invoice đã nối mặt hàng.
- **Input:** khách của HĐ · các dòng hàng có **mặt hàng** và **tên hàng** khác rỗng.
- **Steps:** với mỗi dòng: cặp (khách, mặt hàng) **chưa có** tên ⇒ tạo dòng tên từ dòng hàng (tên · size · quy cách · mã HS, ghi chú "Trích xuất từ HĐ <số HĐ>" — từ invoice: "Trích xuất từ Invoice <số invoice>", mã HS trống vì invoice không in); **đã có** ⇒ giữ nguyên (không ghi đè — khách đổi tên thì U1 sửa ở danh sách). Hai dòng cùng HĐ cùng mặt hàng ⇒ lấy dòng đầu.
- **Output:** danh sách tên của khách đủ thêm; HĐ 18.26 nối xong 14 dòng ⇒ Seachemot có 1 tên / mặt hàng đã nối.
- **End:** không cần ai duyệt; U1 soát lại ở danh sách khi muốn. Máy chủ chưa có bảng ⇒ không trích xuất (không ghi gì), HĐ vẫn lưu bình thường.

### Flow NV17 — Đọc Commercial Invoice · owner U1 (v7)
- **Vì sao (chủ dự án 2026-10-22):** bỏ gõ tay 3 số tổng của invoice (thực xuất R7) và lấy tên hàng của khách từ invoice. Chủ dự án chốt: **không đọc bản scan** (ảnh — invoice 234/26 trong app là bản HP Scan đã ký, đóng dấu, 0 chữ); chỉ đọc **file gốc**: Excel (.xlsx, .xls) hoặc PDF xuất từ Excel (có lớp chữ). Invoice do chính Baseafood lập từ mẫu Excel.
- **Start:** U1 mở mục **Commercial Invoice** của chuyến (bước 5) và chọn file Excel / PDF; hoặc chọn "Đọc file đã đính" khi mục đã có file đọc được. Chạy không nối máy chủ (không lưu được file): chọn file **chỉ để đọc**, file không lưu.
- **Input:** file invoice · mục đang mở (số, ngày, 3 số tổng) · dòng hàng của bản đang dùng của HĐ · tên hàng của khách (R23) · danh mục mặt hàng.
- **Steps:** (1) đọc bảng theo R27 ra số invoice, ngày lập, khách, tiền tệ, các dòng (tên · size · quy cách · thùng · kg · đơn giá · tiền) và dòng TOTAL; (2) ô **đang trống** của mục ⇒ điền; ô **đã có số khác** ⇒ báo "đang ghi … — invoice …", không ghi đè, U1 chọn "Dùng số trên invoice" nếu muốn; (3) so với HĐ: dòng không có dòng cùng tên + size trong HĐ, đơn giá khác HĐ; dòng TOTAL khác cộng các dòng; (4) mỗi dòng gợi ý mặt hàng (R27), U1 sửa / chọn; (5) U1 bấm Lưu.
- **Output:** mục Commercial Invoice có số, ngày, 3 số tổng (thực xuất R7 cập nhật); file (nếu chọn ở ô File) được đính; dòng đã nối mặt hàng ⇒ trích xuất tên hàng của khách còn thiếu (NV16, không ghi đè); thông báo "Đã lưu · trích xuất n tên hàng của khách" có Hoàn tác (hoàn cả tên).
- **End:** không ai duyệt. Không bấm Lưu (Hủy / đóng) ⇒ không ghi gì. Đọc không được (bản scan, file khác loại, không nhận ra bảng) ⇒ câu báo tại chỗ, mục vẫn sửa / lưu tay như cũ.

### Flow NV15 — Xem báo cáo xuất khẩu · owner U2 (v5)
- **Start:** người có quyền xem Xuất khẩu.
- **Input:** kỳ (tháng · quý · năm), khách (tùy chọn — áp cho **mọi** con số).
- **Output (R25):** tổng kỳ · bảng theo tháng · bảng theo khách · tỉ lệ chuyến đúng hạn · số chuyến còn kẹt ở từng bước 1–5 · danh sách HĐ cần chú ý (quá hạn chưa lên đủ chuyến, xuất vượt / thiếu dung sai, còn tiền chưa về). Người không có quyền xem giá thấy kg / số chuyến, **không** thấy tiền. Xuất Excel đúng các bảng đang xem.
- **End:** từ một HĐ cần chú ý mở thẳng hồ sơ HĐ đó.

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict |
|---|---|---|---|---|---|
| NV14 (v6) | A. Một tên / mặt hàng (v5) | Loại | Sai nghiệp vụ: cùng mặt hàng mỗi khách gọi khác (Matsuda "Frozen boiled octopus" ≠ Seachemot "Iwadako") — Domain (anh Lê Khiêm, Phòng Kế hoạch) | Domain | — |
| NV14 (v6) | B. Tên theo nước | Loại | Cùng nước Nhật hai khách hai tên — chuyên gia sửa "theo giao dịch thực tế với khách" | Domain | — |
| NV14 (v6) | C. Không bảng, suy từ HĐ cũ | Loại | Không khai trước được cho khách mới, không xem thành danh sách 15–20 dòng (rubric: Output không quan sát được) | Optimizer | — |
| NV14 + NV16 (v6) | D. Bảng tên theo khách + trích xuất từ HĐ, lưu tên · size · quy cách · HS | **Chọn** (chủ dự án 2026-10-22) | Ít bước nhất: HĐ đầu tiên của khách tự sinh danh sách; tên + size tách được hai size cùng tên (HĐ 18.26 dòng 3–4) | Optimizer + chủ dự án | — |
| NV17 (v7) | A. Đọc bản scan bằng Tesseract trên máy | Loại | Bảng + số trên ảnh scan đóng dấu dễ sai; người soát phải dò lại cả 13 dòng — không bớt việc (rubric #5) | Optimizer + chủ dự án | — |
| NV17 (v7) | B. Đọc bản scan bằng AI trên cloud | Loại (đợt này) | Tốn phí theo trang + key đặt ở máy chủ (🔴 đụng key) — chủ dự án chưa duyệt | Orchestrator | Mở lại khi chủ dự án duyệt phí |
| NV17 (v7) | C. Chỉ đọc file gốc (Excel / PDF xuất từ Excel), scan chỉ làm bằng chứng | **Chọn** (chủ dự án 2026-10-22) | Chính xác 100%, không phí, không key; invoice do xưởng tự lập nên có sẵn file gốc | Optimizer + chủ dự án | Phòng KH phải đính thêm file gốc — chưa xác nhận giữ Excel hay PDF ⇒ đọc cả hai |
| NV17 (v7) | D. Ghi đè ô đã có số bằng số invoice | Loại | Số gõ tay có thể đúng hơn file nhầm (đính nhầm invoice HĐ khác) — báo lệch, U1 chọn (an toàn) | Optimizer | — |
| NV16 (v6) | E. Trích xuất ghi đè khi tên khác | Loại | Một HĐ gõ sai làm hỏng tên chuẩn của khách (an toàn) — sửa là việc của U1 | Optimizer | — |
| Trục | A: HĐ là trục, bước gắn HĐ · B: chuyến là trục · C: HĐ 1..n chuyến, bước 2–5 gắn chuyến | **C** | A sai thực tế (lô trải 3 cont); B mất dung sai + chứng từ yêu cầu của HĐ. Đúng Q2 | Orchestrator + Domain (XK) | Hình "HĐ → các bước" của chủ dự án giữ đúng khi 1 chuyến |
| NV7 tháng | A: tháng ký · B: tháng kế hoạch · C: ngày đóng → ETD → kế hoạch | **C** | Q1; đổi ngày đóng là chuyến tự sang tháng (rubric #5) | Optimizer | — |
| NV4 duyệt | A: BGĐ duyệt trên app · B: U1 ghi kết quả giấy | **B** | Q4 | Optimizer | Đổi sang A sau không đổi dữ liệu |
| NV4 gắn duyệt | A: duyệt gắn HĐ · B: duyệt gắn **bản** | **B** | A: bản sửa bị trả về làm hủy cả HĐ đang chạy chuyến, mở lại chuyến đã khép (rubric #3) | Domain (XK) | v1 dùng A — loại ở v2 |
| NV5 bản sửa | A: sửa đè · B: chụp bản trước rồi sửa · C: HĐ mới | **B** | A trái KH-R7; C bắt gắn lại chuyến | Domain (XK) | — |
| NV6 gia hạn | A: đi qua bản sửa · B: bản ghi gia hạn riêng | **B** | A bắt BGĐ duyệt lại, bước 1 về "đang làm", số trễ sai | Domain (XK) | — |
| NV8 thực xuất | A: lấy B/L · B: gõ tay ở chuyến · C: Σ invoice thương mại | **C** | A gồm hàng mẫu (+13,8 kg); B không có bằng chứng | Domain (XK) | — |
| NV8 bước 5 | A: danh sách cố định · B: sinh từ chứng từ yêu cầu của HĐ (loại + form / người cấp) | **B** | Bắt được "thiếu C/O form VJ" như bộ lô 165 | Domain (XK) | — |
| NV8 "xong" | A: tự do · B: có bằng chứng | **B** | A làm khép kín vô nghĩa (rubric #2) | Optimizer | — |
| NV8 cont ghép | A: mỗi chuyến nộp đủ bộ · B: "dùng chung với chuyến …" | **B** | Cont "40+20" chung booking, invoice, B/L — A bắt nộp 2 lần (rubric #5) | Domain (XK) | Giữ Q2 (chuyến = 1 cont) |
| NV9 ai đính ảnh | A: chỉ U4 · B: chỉ U1 · C: cả hai | **C** | Q7 | Optimizer | — |
| NV9 trạng thái 4a/4b | A: U4 đánh dấu · B: tự suy từ file | **B** | RLS không chia được cột trạng thái chung; U4 chỉ cần quyền thêm file | Cross-User-Integrity | — |
| NV10 tiền về | A: chặn khép · B: không chặn | **B** | Q5 | Optimizer | — |
| NV12 dung sai | A: chỉ chuyến khép · B: + Σ kg · C: + Σ kg **và** Σ tiền | **C** | HĐ 18.26 ghi ±10% cả lượng lẫn tiền | Domain (XK) | v1 chỉ B — sửa ở v2 |
| NV12 nhãn (v4) | A: Khép kín · B: Hoàn tất · C: Đủ hồ sơ (chuyến) + Đã xuất đủ (HĐ) · D: Thanh lý | **C** | "Hoàn tất" dễ hiểu là đã thu tiền; **D bị VETO** (thủ tục pháp lý có biên bản) | Domain (XK) | — |
| NV4 người ký (v4) | A: gõ tự do · B: chọn tài khoản BGĐ, mặc định GĐ, PGĐ ký theo ủy quyền · C: chỉ GĐ | **B** | A đã gõ sai tên GĐ (VETO); C kẹt khi GĐ vắng có ủy quyền | Domain (XK) | — |
| NV11 kỳ xem (v4) | A: khoảng ngày theo ngày xuất (= R1) + tuần lịch · B: chọn trường ngày · C: theo ngày ký | **A** | B hai người lọc ra hai kết quả; **C VETO** (ngày ký không phản ánh xuất hàng) | Domain (XK) + Optimizer | — |
| NV3 / NV8 nối mặt hàng (v4) | A: bắt lúc lập HĐ · B: không bắt lúc lập, bắt trước Lệnh SX, nối không cần bản sửa · C: nối khi xuất invoice | **B** | A chậm khâu nhập; C quá muộn cho Lệnh SX; nối qua bản sửa bắt BGĐ duyệt lại vô ích (triage) | Domain (XK) + triage | — |

## 7. Scope & Priority

- **IN (đợt 1):** NV1–NV13. **v5–v7:** NV14–NV17 (NV17 = đọc Commercial Invoice từ file gốc — phần "số liệu dòng của chứng từ" của đợt 4 làm trước cho riêng invoice; đối chiếu chéo các chứng từ khác vẫn để đợt 4).
- **OUT (đợt sau):**
  - Lệnh SX có cấu trúc + 3 nơi nhận (đợt 2).
  - Mẫu thùng / phiên bản / đợt in (đợt 2).
  - Sơ đồ cont dạng lưới nhập từ `.xls`, giải nén zip ảnh (đợt 3).
  - Nối lệnh xuất `/orders` + BGĐ duyệt lệnh xuất trên app (đợt 3).
  - Số liệu dòng của chứng từ + đối chiếu tự động B1–B11 + nhắc hạn ở Việc của tôi (đợt 4).
  - Lưu 2 năm, nạp lịch sử sổ Excel (Q6), Nhập khẩu, Khác (đợt 5).
  - Báo giá / sổ yêu cầu khách (QTI bước 1–5).
- **Không làm:** khai hải quan, book tàu, ngân hàng, sổ kế toán; không đổi `/orders`, `/sales`, Cân đối trong đợt 1.

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV7 / NV11 | booking đóng cont tháng 10/2026 có trên app (so theo **booking duy nhất**, vì sổ từng chép trùng dòng sang tháng khác) | 100% |
| NV8 | chuyến đã tàu chạy mà trạng thái bước 5 không phản ánh đúng giấy (kiểm 5 chuyến ngẫu nhiên) | 0 |
| NV3 | thời gian lập 1 HĐ 14 dòng (cỡ HĐ 18.26) | ≤ 15 phút |
| NV11 | trả lời "chuyến X còn thiếu gì" khi biết MSL / booking / số cont | ≤ 1 phút |
| NV12 | HĐ khép mà Σ kg hoặc Σ tiền ngoài dung sai không có lý do | 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Tháng của chuyến = tháng(ngày đóng) ?? tháng(ETD) ?? tháng kế hoạch | ghi ngày đóng 31/10 cho chuyến ETD 03/11 ⇒ chuyến ở tháng 10 |
| R2 | Tổng HĐ có hai số đếm: `units` = Σ số lượng theo đơn vị của dòng (khớp HĐ giấy) và `cartons` = Σ quy về thùng (kiện × số thùng/kiện). kg dòng = số lượng × số thùng/kiện × kg/thùng (sửa tay được); tiền dòng = kg × đơn giá, làm tròn 2 số lẻ | HĐ 18.26: units 1.900, cartons 2.000 (dòng 12: 100 kiện × 2 thùng) |
| R3 | Bản sửa không ghi đè; duyệt gắn với bản; bản hiệu lực = bản `approved` mới nhất | bản sửa bị `rejected` ⇒ bản hiệu lực không đổi |
| R4 | Bước 2 chỉ đánh dấu `done` được khi HĐ có bản hiệu lực (KH-R8) | bản sửa chờ duyệt không làm bước 2 đã xong quay lại |
| R5 | `done` phải có bằng chứng theo bảng NV8; `not-applicable` phải có lý do; "dùng chung" chỉ trỏ tới mục **đã xong** của chuyến **cùng HĐ hoặc cùng booking** | chuyến được trỏ tới bị hủy ⇒ mục dùng chung về "chưa làm" |
| R6 | Mục bước 5 sinh từ chứng từ yêu cầu của **bản hiệu lực** lúc tạo chuyến; bản sửa thêm chứng từ yêu cầu ⇒ thêm mục vào chuyến **chưa khép** | không xóa mục đã có file |
| R7 | Thực xuất = Σ invoice thương mại của chuyến (không hàng mẫu "M", không B/L). Dung sai áp **cả kg lẫn tiền**, hai đầu tính là trong, trống = 0% | 20.900 kg / 189.689,50 USD với HĐ 18.26 ⇒ trong |
| R8 | Ngày đóng ≤ ETD ≤ ETA (khi có đủ); vi phạm ⇒ báo lỗi, không lưu | ngày đóng 02/11, ETD 28/10 ⇒ chặn |
| R9 | MSL không duy nhất; số HĐ **duy nhất theo khách** (không phân hoa thường, bỏ khoảng trắng đầu/cuối); hạn giao bắt buộc | " 18.26/bsf-scm.2026 " trùng ⇒ chặn |
| R10 | `export-plans.loading` (U4) đọc được **đầu chuyến**: khách, MSL, booking, loại chuyến, ngày đóng, số cont, seal, mô tả hàng, kg kế hoạch, và file 4a/4b. **Không** đọc dòng hàng HĐ, đơn giá, tiền thực xuất, tiền về. Chỉ **thêm** file vào 4a/4b; không cập nhật chuyến | — |
| R11 | Ma trận quyền mặc định — bảng dưới. Phòng ban của `planner` khai ở **cả** code (`SYSTEM_ROLE_DEPARTMENTS`) **lẫn** hàm SQL `current_user_departments()` | — |
| R12 | File: tối đa 20 MB / file; PDF, ảnh, Word, Excel, zip (zip chỉ lưu, chưa giải nén); kho file **riêng** của module; ảnh điện thoại nén trước khi tải (khuôn ảnh QC) | — |
| R13 | Ghi / sửa / hủy / duyệt / gia hạn / tiền về đều vào nhật ký thao tác | — |
| R14 | Chế độ demo: mọi bảng mới nằm trong bộ demo; số thật không đổi khi thao tác demo (luật repo 15). Không có gói ⇒ bộ demo dùng số tự đặt + **file giữ chỗ** `demo-placeholder/…`. **v4 (chủ dự án chọn 2026-10-20):** số + file THẬT của hồ sơ khách chỉ được vào demo qua **gói demo Xuất khẩu** — admin "Nạp gói demo Xuất khẩu…" (menu Demo) tải `pack.json` + file vào kho riêng `export-files` ở `site-demo/export-files/demo-pack/…` (chỉ người đăng nhập có quyền Xuất khẩu đọc được); "Tạo bộ mới" đọc gói, gắn file thật vào 7 ca + dựng mỗi dòng sổ "Kế hoạch xuất hàng" thành HĐ + chuyến dời sang tháng gần đây. **Cấm** để số / tên khách thật trong mã nguồn (bản JS phát hành ai cũng tải được). File thật hiện cho mọi người xem demo, kể cả khi "ẩn tên" | gói chưa nạp ⇒ bộ tự đặt |
| R15 | Trễ hạn của chuyến = (ngày on board trên B/L ?? ETD) > hạn giao hiệu lực (sau gia hạn) | gia hạn tới 30/09 ⇒ chuyến ETD 26/09 hết trễ |
| R16 | Mỗi dòng hàng nối **một mặt hàng ở danh mục mở `products`** (`productId`, tên tiếng Anh giữ ở `description`). Không bắt lúc lập HĐ; **bắt trước khi Lệnh SX xong**. Nối là thông tin nội bộ ⇒ ghi thẳng vào bản đang dùng, **không tạo bản sửa, không cần BGĐ duyệt lại**. Gợi ý theo cặp (tên HĐ → mặt hàng) đã nối ở HĐ trước, ưu tiên cùng khách; không dịch máy. 141 mã kế toán chỉ ánh xạ qua `products` | dòng cũ không có `productId` ⇒ "chưa nối" |
| R17 | Người ký duyệt = tài khoản có vai trò `director` / `vice-director`; không gõ tự do khi đã có tài khoản; không hard-code tên trong code. PGĐ đồng ý ký HĐ phải xác nhận ký theo ủy quyền (lưu vào tên người ký) | 0 tài khoản BGĐ ⇒ tạm gõ tên + dòng nhắc |
| R18 | Kỳ xem: chuyến thuộc kỳ khi (ngày đóng ?? ETD) nằm trong [từ, đến]; chuyến chỉ có tháng KH thuộc mọi kỳ chạm tháng đó (xem theo tháng y như R1). HĐ chưa lên đủ chuyến thuộc kỳ khi hạn giao hiệu lực trong kỳ, hoặc quá hạn chưa chuyến và hôm nay trong kỳ. Lọc khách áp cho cả 4 con số | tuần 12–18/10 ra 2 chuyến đóng 13/10 |
| R19 | Incoterm CIF / CIP ⇒ chuyến tự có mục **Bảo hiểm** ở bước 5 (người bán buộc mua bảo hiểm) | bỏ được bằng "không áp dụng" + lý do |
| R20 | Chứng từ có người cấp "công ty tự cấp" không bắt số chứng từ (vẫn bắt ngày + file / ghi chú) | H/C lô 165 không in số |
| R21 | Mục bước 5 theo chứng từ khách yêu cầu (gồm Commercial Invoice, bảo hiểm CIF/CIP) **không xóa được**; mục thêm tay xóa được, hỏi lại trước, có Hoàn tác | xóa C/O form VJ để chuyến đủ hồ sơ ⇒ không làm được |
| R22 | Ô số hiểu số chép từ chứng từ tiếng Anh: có cả "." lẫn "," ⇒ dấu đứng sau là phần lẻ; chỉ "." mà không đúng nhóm nghìn kiểu Việt ⇒ "." là phần lẻ; có kiểu này ⇒ ô hiện lại số đã hiểu. Kiểu Việt giữ nguyên | "10.50" → 10,5 · "194,557.60" → 194.557,6 · "1.234" → 1234 |
| R23 | **Tên hàng theo khách** (v6 — thay R23 v5). Bảng `customer_product_names`: khách · mặt hàng · tên (bắt buộc) · size · quy cách · mã HS · ghi chú. **Một (khách, mặt hàng) một dòng.** Hai mặt hàng của cùng khách được trùng tên nếu **khác size**; trùng cả tên lẫn size (so không phân hoa thường, gộp khoảng trắng) ⇒ chặn lưu (không biết nối về mặt hàng nào). `products.trade_name` (mig 0076) đổi nghĩa thành **tên tiếng Anh mặc định** — dùng khi khách chưa có tên riêng. **Lập HĐ:** chọn mặt hàng ⇒ ô nào đang trống thì điền theo thứ tự tên của khách → (chỉ ô tên) tên mặc định → để trống; ô đã có chữ **không** bị ghi đè. **Gợi ý nối** (lấy bậc đầu tiên ra đúng MỘT mặt hàng): (1) tên của khách khớp **tên + size** của dòng · (2) tên của khách khớp tên, duy nhất trong khách · (3) lịch sử nối R16 (cùng khách trước) · (4) tên mặc định khớp đúng một mặt hàng. Không bậc nào ra một ⇒ không điền; các mặt hàng khớp tên đứng đầu danh sách chọn. Máy chủ chưa có bảng / cột ⇒ app không gửi, không kẹt hàng chờ | HĐ 18.26 dòng 3 (5-5.5 gr) và dòng 4 (6-7 gr) cùng tên "Frozen iwadako boiled cut" ⇒ bậc 1 nối đúng hai mặt hàng khác nhau |
| R26 | **Trích xuất** (NV16): chỉ TẠO dòng tên cho cặp (khách, mặt hàng) chưa có, từ dòng hàng có mặt hàng + tên; **không bao giờ sửa** dòng đã có; không tạo khi dòng trùng tên + size với mặt hàng khác của cùng khách (để R23 không vỡ). Sửa / xóa dòng tên không hồi tố HĐ đã lưu | lưu lại HĐ 18.26 với tên khác ⇒ tên của Seachemot giữ bản cũ |
| R27 | **Đọc Commercial Invoice** (NV17, v7). **Loại file:** chỉ .xlsx / .xls / .pdf; PDF có < 40 ký tự chữ ⇒ "bản scan", không đọc; ảnh / Word / zip ⇒ không đọc. Nhiều sheet ⇒ sheet có chữ "COMMERCIAL INVOICE", không có thì sheet có "DESCRIPTION". **Bảng:** bắt đầu sau dòng có chữ "DESCRIPTION", dừng ở dòng "TOTAL" (hoặc "Says"). Dòng chữ khác (không phải SIZE / Packing / tiêu đề cột) = **tên hàng** của nhóm; dòng "SIZE…" có ≥ 2 số ⇒ một dòng hàng; dòng "SIZE…" không số ⇒ size chờ cho dòng "Packing" có số kế tiếp; dòng "Packing…" có ≥ 2 số ⇒ một dòng hàng (size = size chờ), không số ⇒ quy cách cho các dòng của nhóm từ dòng "Packing" trước; nhóm không có dòng con mà dòng tên có số ⇒ một dòng hàng. Số của dòng: 4+ số = thùng · kg · đơn giá · tiền; 3 = thùng · kg · tiền; 2 = thùng · kg; số đứng trước ô chữ đầu (số thứ tự) bỏ. Số đọc theo R22 (thêm: chỉ "," đúng nhóm nghìn kiểu Anh "3,000" ⇒ phân nghìn). **Tổng** = dòng TOTAL; không có ⇒ cộng dòng + cảnh báo; khác cộng dòng ⇒ cảnh báo, giữ số TOTAL. **Đầu invoice:** số = "Invoice No …" hoặc chữ dạng "234/26" cạnh "COMMERCIAL INVOICE"; ngày lập = ngày đầu tiên của phần đầu, **bỏ** dòng có chữ delivery / ETD / ETA / shipment / on board. **Điền mục:** ô trống ⇒ điền; ô khác ⇒ báo, không ghi đè; số so sai lệch ≤ 0,005 coi là bằng. **Nối mặt hàng** (bậc đầu ra ĐÚNG MỘT): (1) dòng HĐ cùng tên + size (so size không phân hoa thường, bỏ chữ "size:", bỏ khoảng trắng; dòng HĐ không ghi size khớp theo tên) · (2) tên của khách khớp tên + size — invoice không ghi size mới nhận khớp tên (R23) · (3) tên tiếng Anh mặc định. Không đoán theo lịch sử tên-không-size. **So với HĐ:** dòng không có dòng HĐ cùng tên + size ⇒ "Không có trong HĐ"; đơn giá khác đơn giá dòng HĐ ⇒ "Giá khác HĐ" (người không có quyền xem giá không thấy) | invoice 234/26 ⇒ 13 dòng, 2.251 thùng · 22.214 kg · 194.557,60 USD, ngày 25/09/2026 (không lấy ngày giao 26/09) |
| R24 | **Số PO của khách** (`orderRef`): mã đơn của khách in ở dòng "Order" trên HĐ giấy (HĐ 18.26: `#B182`). Một HĐ một số; chỉ để tra cứu. **Không phải** số booking — booking là của hãng tàu, theo từng chuyến (NV7) | — |
| R25 | **Báo cáo kỳ** (NV15). Kỳ = tháng · quý · năm. Chuyến của kỳ = chuyến **chưa hủy** thuộc kỳ theo R18. Mỗi chuyến tính: cont (chỉ loại cont), kg kế hoạch, thực xuất R7, **còn chưa về** = max(0, thực xuất tiền − tiền về của chuyến). **Tiền về trong kỳ** = Σ lần tiền về có **ngày** trong kỳ (cả cọc cấp HĐ). Đúng hạn / trễ theo R15, chỉ đếm chuyến đã có ngày giao (on board ?? ETD). Bước kẹt = số chuyến của kỳ có bước n (1–5) chưa xong / không áp dụng. HĐ ký trong kỳ = ngày ký trong kỳ, HĐ chưa hủy; kg / tiền HĐ theo bản đang dùng. **HĐ cần chú ý** (HĐ chưa hủy, chưa chốt tay, có chuyến trong kỳ hoặc hạn giao hiệu lực trong kỳ): quá hạn giao mà chưa lên đủ chuyến · thực xuất vượt (kg hoặc tiền) quá dung sai · đã khép đủ hồ sơ mà thiếu dung sai · còn tiền chưa về. Lọc khách áp mọi số | lô 165 / HĐ 18.26, năm 2026 ⇒ T9: 1 chuyến · 1 cont · 19.000 → 22.214 kg · 194.557,60 USD · trễ 1 · HĐ 18.26 "vượt dung sai: thừa 16,9%" |

**R11 — ma trận quyền mặc định** (tài nguyên mới, mặc định cấm; Q11 đã đồng ý đổi ma trận):

| Vai trò | `export-plans` (HĐ, chuyến, bước, file, gia hạn) | `export-plans.loading` (4a, 4b) | `export-plans.payments` (bước 6) | `catalog.customers` |
|---|---|---|---|---|
| `planner` | view · create · update · delete · export · view-price | view · create | view · create · update · delete | view · create · update |
| `director`, `vice-director` | view · export · view-price | view | view | (giữ như cũ) |
| `chief-accountant` | view · export · view-price | view | view · create · update · delete | (giữ như cũ) |
| `accountant` | view · export · view-price | view | view · create · update (KHÔNG xóa — luật chung "kế toán không xóa") | (giữ như cũ) |
| `warehouse-keeper`, `frozen-workshop-manager`, `fish-workshop-manager`, `dried-workshop-manager`, `vice-manager` | — | view · create | — | (giữ như cũ) |
| còn lại | — | — | — | (giữ như cũ) |

`planner` thuộc phòng ban `planning`; trang chủ mặc định = Xuất khẩu. **Không** khai vai trò này bằng một dòng `app_roles` (vai trò có dòng `app_roles` thì máy chủ đọc `role_permissions` thay cho ma trận mặc định ⇒ `planner` mất hết quyền).

## 10. Acceptance Criteria

> Số của HĐ 18.26 là số thật. Ghép lô 165 (INV 234/26) vào HĐ 18.26 ở AC-17 là **giả định để thử** — chưa có chứng từ nào chứng minh hai cái thuộc nhau.

### AC-1 — Vai trò Kế hoạch mở module và biểu mẫu KH · Maps to: NV1 · Test: integration
- **Given** tài khoản chỉ có vai trò `planner`
- **When** đăng nhập và nạp quyền
- **Then** có quyền `export-plans` theo R11, trang chủ là Xuất khẩu, đọc được QTI-KH-01 và 8 biểu mẫu
- **Assert** `resolvePermissions({ roles: ["planner"], isAdmin: false })` cho `export-plans` ⊇ {view, create, update, delete, export, view-price}; `homeFor(["planner"], perms) == "planning-export"`; `departmentsOfRoles(["planner"])` chứa `"planning"`; qua RLS đọc được đủ 9 id `doc-qti-kh-01`, `doc-qti-kh-01-01` … `doc-qti-kh-01-08`

### AC-2 — Vai trò khác không thấy module · Maps to: NV1 · Test: integration
- **Given** tài khoản `team-leader`
- **When** đọc và ghi bảng hợp đồng xuất khẩu qua máy chủ
- **Then** không nhận dòng nào và không ghi được
- **Assert** select `export_contracts` trả 0 dòng; insert bị RLS từ chối (42501)

### AC-3 — Khách thêm trường mới không vỡ dữ liệu cũ · Maps to: NV2 · Test: integration
- **Given** khách có sẵn chỉ có mã, tên, thị trường
- **When** U1 ghi quốc gia, cảng đích, thanh toán
- **Then** trường mới lưu, trường cũ giữ nguyên; khách không có trường mới vẫn đọc được
- **Assert** sau lưu `country`, `default_port`, `payment_terms` != null và `code`, `name`, `market` == giá trị trước; khách cũ trả các trường mới == null, không lỗi

### AC-4 — Tổng HĐ đúng hai cách đếm · Maps to: NV3 · Test: unit
- **Given** 14 dòng hàng của HĐ 18.26 (dòng 12: 100 kiện, 2 thùng/kiện, 4 kg/thùng)
- **When** tính tổng hợp đồng
- **Then** số đếm theo đơn vị dòng khớp HĐ giấy; số quy về thùng tính riêng
- **Assert** `contractTotals(lines)` == { units: 1900, cartons: 2000, kg: 19000, amount: 172445.00 }; dòng 12 kg == 800; dòng 1 tiền == 2000 × 10.50 == 21000.00

### AC-5 — HĐ mới chờ duyệt, hiện ở tháng hạn giao · Maps to: NV3 · Test: e2e
- **Given** U1 lập HĐ có khách, số HĐ, ngày ký 2026-07-30, hạn giao 2026-09-05, ≥1 dòng hàng
- **When** lưu
- **Then** HĐ chờ duyệt; bước 1 "đang làm"; tháng 2026-09 liệt kê HĐ nhãn "chưa lên chuyến"
- **Assert** `effectiveRevision(contract) == null`; `stepState(contract, 1) == "in-progress"`; `buildMonthPlan("2026-09", …, today = 2026-08-01)` có HĐ với `noShipment == true`

### AC-6 — Thiếu hạn giao hoặc trùng số HĐ bị chặn · Maps to: NV3 · Test: unit
- **Given** khách SCM đã có HĐ số "18.26/BSF-SCM.2026"
- **When** (a) lập HĐ mới cùng khách số " 18.26/bsf-scm.2026 "; (b) lập HĐ khác số nhưng bỏ trống hạn giao
- **Then** cả hai bị chặn, không lưu
- **Assert** (a) `findDuplicateContract(...)` trả id HĐ có sẵn; (b) `validateContract(c).errors` chứa `"latestShipmentDate"`; số HĐ của khách == 1

### AC-7 — Duyệt bản 0 hoàn tất bước 1 · Maps to: NV4 · Test: e2e
- **Given** HĐ chờ duyệt, bản 0 có file HĐ
- **When** U1 ghi `approved`, người duyệt, ngày, file scan
- **Then** HĐ `approved`; bản 0 là bản hiệu lực; bước 1 xong
- **Assert** `status == "approved"`; `effectiveRevision(contract).revisionNo == 0`; `stepState(contract, 1) == "done"`; lần duyệt có `file_path != null`

### AC-8 — Từ chối bản 0 phải có lý do, hủy HĐ và chuyến · Maps to: NV4 · Test: e2e
- **Given** HĐ chờ duyệt đã có 1 chuyến kế hoạch (chưa có số cont)
- **When** U1 ghi `rejected` bỏ trống lý do, rồi ghi lại có lý do
- **Then** lần đầu bị chặn; lần sau HĐ `cancelled`, chuyến của HĐ `cancelled` cùng lý do, dữ liệu còn nguyên
- **Assert** lần 1: số lần duyệt == 0; lần 2: HĐ `status == "cancelled"`, chuyến `status == "cancelled"`, `cancel_reason` hai bên bằng nhau và != ""

### AC-9 — Bản sửa chờ duyệt không làm sập HĐ · Maps to: NV5 · Test: integration
- **Given** HĐ `approved` (bản 0, dòng 1 = 200 thùng), chuyến đã khép
- **When** U1 ghi bản sửa đổi dòng 1 thành 180 thùng kèm file rvs, chưa ghi duyệt
- **Then** HĐ giữ `approved` theo bản 0; chuyến vẫn khép; bản sửa ở trạng thái chờ
- **Assert** `status == "approved"`; `effectiveRevision(contract).revisionNo == 0` với dòng 1 `quantity_units == 200`; `isShipmentClosed == true`; bản 1 có `approvalState == "pending"` và dòng 1 == 180

### AC-10 — Bản sửa bị từ chối bị bỏ, bản cũ giữ hiệu lực · Maps to: NV4 / NV5 · Test: integration
- **Given** tình huống cuối AC-9
- **When** U1 ghi `rejected` cho bản 1 kèm lý do
- **Then** bản 1 bị bỏ; HĐ không bị hủy; bản 0 vẫn hiệu lực
- **Assert** HĐ `status == "approved"`; `effectiveRevision(contract).revisionNo == 0`; bản 1 `approvalState == "rejected"` và vẫn tra được

### AC-11 — Gia hạn không cần duyệt lại · Maps to: NV6 · Test: unit
- **Given** HĐ hạn giao 2026-09-05, chuyến ETD 2026-09-26
- **When** U1 ghi gia hạn tới 2026-09-30 kèm file xác nhận của khách
- **Then** chuyến hết trễ; HĐ không cần duyệt lại
- **Assert** trước gia hạn `isShipmentLate(s) == true`; sau `== false`; `effectiveDeadline(contract) == "2026-09-30"`; số bản HĐ không đổi

### AC-12 — Tháng của chuyến và thứ tự ngày · Maps to: NV7 · Test: unit
- **Given** chuyến tháng kế hoạch 2026-10, chưa có ngày nào
- **When** ghi ETD 2026-11-03; rồi ngày đóng 2026-10-31; rồi thử ngày đóng 2026-11-05
- **Then** tháng 10 → 11 → 10; lần cuối bị chặn vì ngày đóng sau ETD
- **Assert** `shipmentMonth(s)` == "2026-10", "2026-11", "2026-10"; `validateShipment` lần cuối có lỗi `"loadingAfterEtd"`

### AC-13 — Chuyến mới sinh mục chứng từ theo HĐ, giữ form · Maps to: NV7 · Test: unit
- **Given** HĐ yêu cầu Commercial Invoice, Packing list, B/L, H/C (công ty tự cấp), C/O form VJ
- **When** lên chuyến
- **Then** bước 5 có đúng 5 mục, đều "chưa làm"; mục C/O giữ form VJ
- **Assert** `documentItems(shipment).length == 5`; mọi `state == "not-started"`; mục `kind == "certificate-of-origin"` có `form == "VJ"`

### AC-14 — Bước 2 không xong khi HĐ chưa có bản hiệu lực · Maps to: NV8 · Test: unit
- **Given** HĐ chờ duyệt bản 0, chuyến có file lệnh SX ở bước 2
- **When** đánh dấu bước 2 xong
- **Then** bị chặn (KH-R8); file vẫn giữ
- **Assert** `canMarkDone(step2, contract).ok == false` và `reason == "contract-not-approved"`; số file bước 2 == 1

### AC-15 — "Xong" phải có bằng chứng, "không áp dụng" phải có lý do · Maps to: NV8 · Test: unit
- **Given** mục 4c có file nhưng chưa số tờ khai; mục C/O ở bước 5
- **When** đánh dấu 4c xong; đánh dấu C/O `not-applicable` không lý do, rồi có lý do
- **Then** 4c bị chặn vì thiếu số; C/O lần đầu bị chặn, lần sau nhận
- **Assert** `canMarkDone(4c).missing == ["declarationNo"]`; `canMarkNotApplicable(co, "").ok == false`; `canMarkNotApplicable(co, "khách bỏ yêu cầu").ok == true`

### AC-16 — Thực xuất lấy từ invoice thương mại, bỏ hàng mẫu · Maps to: NV8 · Test: unit
- **Given** chuyến có Commercial Invoice 234/26 (2.251 thùng · 22.214 kg · 194.557,60 USD), hóa đơn hàng mẫu 234M/26 (1 thùng · 13,8 kg · 27,60 USD), B/L (2.252 thùng · 22.227,8 kg)
- **When** tính thực xuất
- **Then** chỉ lấy invoice thương mại
- **Assert** `shipmentActuals(s)` == { cartons: 2251, kg: 22214.00, amount: 194557.60 }

### AC-17 — Cont ghép dùng chung chứng từ · Maps to: NV8 · Test: unit
- **Given** hai chuyến 40RF và 20RF cùng booking; chuyến 40RF có bước 5 xong đủ mục
- **When** đánh dấu mọi mục bước 5 của chuyến 20RF "dùng chung với" chuyến 40RF
- **Then** bước 5 của chuyến 20RF xong; hủy chuyến 40RF thì các mục dùng chung về "chưa làm"
- **Assert** `stepState(s20, 5) == "done"`; sau hủy `stepState(s20, 5) == "not-started"`

### AC-18 — Người đóng hàng chỉ thêm ảnh và sơ đồ, không thấy giá · Maps to: NV9 · Test: integration
- **Given** tài khoản `warehouse-keeper`, chuyến ngày đóng = hôm nay
- **When** thêm 3 ảnh vào 4b; thử sửa bước 5 của chuyến; thử đọc dòng hàng HĐ và tiền về
- **Then** 3 ảnh lưu và 4b tự xong; sửa bước 5 không có tác dụng; đọc dòng hàng và tiền về trả rỗng
- **Assert** số file 4b == 3 và `stepState(s, "4b") == "done"`; update bước 5 đổi 0 dòng (hoặc 42501 nếu đi đường upsert); select `export_contract_items` và payments trả 0 dòng

### AC-19 — Chuyến khép không cần tiền về · Maps to: NV12 · Test: unit
- **Given** chuyến có bước 2, 3, 4 (mọi mục con + số cont + seal), 5 (mọi mục) ở `done` / `not-applicable`, chưa có tiền về
- **When** tính khép kín
- **Then** chuyến khép
- **Assert** `isShipmentClosed(s) == true` và Σ tiền về == 0

### AC-20 — HĐ tự khép trong dung sai, kể cả đúng biên · Maps to: NV12 · Test: unit
- **Given** HĐ 18.26 (19.000 kg · 172.445 USD · dung sai 10%), một chuyến đã khép
- **When** thực xuất lần lượt (a) 20.900 kg / 189.689,50 USD; (b) 17.000 kg / 160.000 USD
- **Then** (a) HĐ khép; (b) không khép vì kg dưới biên
- **Assert** (a) `contractClosure(c).closed == true`; (b) `closed == false`, `reason == "out-of-tolerance"`, `kgDeviationPct` ∈ [−10.6, −10.5]

### AC-21 — HĐ không tự khép khi lệch dung sai (giả định lô 165) · Maps to: NV12 · Test: unit
- **Given** HĐ 18.26, một chuyến đã khép với thực xuất của lô 165 (22.214 kg · 194.557,60 USD) — ghép giả định
- **When** tính khép HĐ
- **Then** không tự khép, báo lệch cả kg lẫn tiền
- **Assert** `closed == false`; `reason == "out-of-tolerance"`; `kgDeviationPct` ∈ [16.9, 17.0]; `amountDeviationPct` ∈ [12.8, 12.9]

### AC-22 — Đóng HĐ tay phải có lý do · Maps to: NV12 · Test: e2e
- **Given** HĐ ở tình huống AC-21
- **When** U1 đóng tay không lý do, rồi có lý do
- **Then** lần đầu bị chặn; lần sau HĐ `closed`
- **Assert** lần 1 `status == "approved"`; lần 2 `status == "closed"` và `close_reason != ""`

### AC-23 — Độ phủ chuyến của HĐ · Maps to: NV12 · Test: unit
- **Given** HĐ 19.000 kg, 1 cont, dung sai 10%, chưa có chuyến
- **When** lên một chuyến kế hoạch 15.000 kg
- **Then** HĐ báo còn thiếu, tách khỏi "lệch dung sai"
- **Assert** `contractCoverage(c)` == { missingKg: 2100, missingContainers: 0, covered: false } (thiếu = 19.000 × 0,9 − 15.000); `contractClosure(c).reason != "out-of-tolerance"`

### AC-24 — Tháng hiện đủ chuyến, HĐ quá hạn và 4 con số · Maps to: NV11 · Test: unit
- **Given** `today = 2026-10-15`; tháng 2026-10 có 3 chuyến của 2 khách (1 khép · 1 thiếu bước · 1 thiếu bước và ETD 2026-10-12 > hạn giao 2026-10-10); 1 HĐ chưa lên chuyến hạn giao 2026-09-20
- **When** dựng dữ liệu tháng 2026-10
- **Then** gom 2 khách, 3 chuyến; HĐ hạn 20/09 hiện ở tháng 10 nhãn trễ
- **Assert** `buildMonthPlan("2026-10", …, today)` có `groups.length == 2`, `shipments == 3`, `closed == 1`, `missingSteps == 2`, `lateShipments == 1`, `overdueContractsWithoutShipment == 1`

### AC-25 — Tra chuyến theo số giấy tờ · Maps to: NV11 · Test: unit
- **Given** chuyến lô 165, booking trống, cont SZLU9522312, invoice 234/26, B/L PAPTYO260926224
- **When** tra lần lượt "165", "szlu9522312", "234/26", "PAPTYO260926224"
- **Then** mỗi lần ra đúng chuyến đó
- **Assert** `searchShipments(all, q).map(s => s.id)` == [id lô 165] cho cả 4 truy vấn

### AC-26 — Xuất Excel theo bố cục sổ cũ, gộp cùng booking · Maps to: NV11 · Test: unit
- **Given** dữ liệu tháng của AC-24, trong đó thêm hai chuyến 40RF + 20RF cùng booking
- **When** xuất Excel
- **Then** cột theo thứ tự sổ "Kế hoạch xuất hàng"; hai chuyến cùng booking thành một dòng
- **Assert** hàng tiêu đề == ["CONT","Khách hàng","Mặt hàng","Lượng (kg)","MSL","Cảng đến","Số booking","Ngày đóng cont","ETD","Đơn giá","Bao bì","Thực xuất (kg)","Giá trị (USD)","Ghi chú"]; dòng chuyến ghép có CONT == "40+20"; số dòng chuyến == 4

### AC-27 — Tiền về cấp chuyến và cấp HĐ, không đổi khép kín · Maps to: NV10 · Test: integration
- **Given** chuyến đã khép (AC-19) với tiền thực xuất 194.557,60; tài khoản `accountant`
- **When** ghi cọc 50.000 ở cấp HĐ, ghi 144.557,60 ở cấp chuyến, rồi xóa và Hoàn tác lần ghi chuyến
- **Then** tổng tiền về HĐ == 194.557,60; chuyến vẫn khép; `planner` đọc được cả 2 dòng
- **Assert** Σ payments của HĐ == 194557.60 sau Hoàn tác; `isShipmentClosed == true`; select payments bằng `planner` trả 2 dòng

### AC-28 — Xóa, hủy và chặn hủy · Maps to: NV13 · Test: e2e
- **Given** HĐ A chờ duyệt chưa chuyến; HĐ B `approved` có 1 chuyến chưa số cont; HĐ C `approved` có 1 chuyến đã có số cont
- **When** xóa A; hủy B có lý do; hủy C
- **Then** A xóa được kèm Hoàn tác; B và chuyến của B bị hủy; C không hủy được
- **Assert** Hoàn tác ⇒ A trở lại với số dòng hàng == như cũ; B và chuyến `status == "cancelled"`; `canCancel(C).ok == false` với `reason == "shipment-loaded"`

### AC-29 — Demo không chạm số thật · Maps to: R14 · Test: manual (vòng kiểm §4b spec chế độ demo — cần DB thật)
- **Given** đếm số dòng `site_id <> 'site-demo'` của mọi bảng mới
- **When** bật demo → tạo HĐ, chuyến, đánh dấu bước bằng file giữ chỗ → thoát demo
- **Then** số dòng thật không đổi; trong demo có chuyến khép được
- **Assert** đếm trước == đếm sau cho từng bảng mới (chênh == 0); trong demo `isShipmentClosed == true` cho ≥ 1 chuyến

### AC-30 — Kỳ xem tháng · tuần · khoảng ngày · Maps to: NV11, R18 · Test: unit
- **Given** chuyến TEST-006 đóng 13/10/2026 (2 cont), chuyến lô 181 đóng 06/10
- **When** xem tuần chứa 15/10; xem khoảng 20/09–12/10; lọc khách KR trong tháng 10
- **Then** tuần ra đúng chuyến đóng 12–18/10; khoảng ra đúng chuyến trong khoảng; lọc khách thì 4 con số chỉ đếm khách đó
- **Assert** `weekPeriod("2026-10-15")` == {from "2026-10-12", to "2026-10-18"}; `buildPeriodPlan(monthPeriod, …, customerId="kr").stats.shipments == 1`; `buildMonthPlan(m).stats == buildPeriodPlan(monthPeriod(m)).stats`

### AC-31 — Lệnh SX chặn khi dòng hàng chưa nối · Maps to: NV8, R16 · Test: unit
- **Given** HĐ đã duyệt, 14 dòng chưa có `productId`, bước 2 có file
- **When** đánh dấu bước 2 xong; rồi nối đủ 14 dòng
- **Then** lần đầu bị chặn; sau khi nối thì xong
- **Assert** `canMarkDone(step2).reason == "lines-unmapped"`; sau nối `canMarkDone(step2).ok == true`

### AC-32 — Gợi ý mặt hàng theo tên HĐ đã nối · Maps to: NV3, R16 · Test: unit
- **Given** HĐ cũ của Seachemot nối "Iwadako blanched cut 2-3g" → p-scm; HĐ khách khác nối cùng tên → p-kr
- **When** gõ cùng tên (khác hoa thường / khoảng trắng) cho HĐ Seachemot; cho khách mới; gõ tên chưa từng nối
- **Assert** `suggestProductId(...)` lần lượt == "p-scm", "p-kr", ""

### AC-33 — H/C tự cấp không bắt số · Maps to: NV8, R20 · Test: unit
- **Assert** H/C `docIssuer = "công ty tự cấp"` có ngày + file ⇒ `canMarkDone.ok == true`; C/O thiếu số ⇒ `missing == ["number"]`

### AC-34 — CIF / CIP tự có mục bảo hiểm · Maps to: NV7, R19 · Test: unit
- **Assert** `missingDocumentItems(…, incoterm "CIF")` kinds == ["commercial-invoice", "insurance"]; CFR == ["commercial-invoice"]

### AC-35 — Chứng từ khách yêu cầu không xóa được · Maps to: NV8, R21 · Test: unit + manual
- **Assert** `isRequiredDocumentItem(terms 18.26, C/O form "vj") == true`; hóa đơn hàng mẫu == false; hộp mục C/O không có nút xóa (thử tay)

### AC-36 — Bản đã sửa sau "yêu cầu sửa" hiện Chờ duyệt · Maps to: NV4/NV5 · Test: unit
- **Assert** lần ghi `needs-revision` 05/08, bản lưu lại 12/08 ⇒ `revisionApprovalLabelState == "pending"`; bản chưa sửa ⇒ "needs-revision"

### AC-37 — Lệch dung sai nói chiều · Maps to: NV12 · Test: unit
- **Assert** `deviationText(16.916) == "thừa 16,9%"`; `deviationText(-10.53) == "thiếu 10,5%"`

### AC-38 — Tra ra HĐ chưa lên chuyến · Maps to: NV11 · Test: unit
- **Assert** `searchContracts(d, "test-g")` == [HĐ TEST-G]; tra theo số đơn "b182" và tên khách "matsu" đều ra đúng 1 HĐ


### AC-39 — Chọn mặt hàng điền theo tên của khách, không ghi đè · Maps to: NV3, NV14, R23 · Test: unit
- **Given** Seachemot có tên cho p-55 = {tên "Frozen iwadako boiled cut", size "5-5.5 gr/pc", quy cách "Net weight IQF 1kg/PE x 10/CTN", HS "16055500"}; p-55 có tên mặc định "Frozen boiled octopus"; Matsuda chưa có tên cho p-55
- **When** chọn p-55 cho dòng trống của HĐ Seachemot; cho dòng đã ghi tên "Iwadako cut" + size trống; cho dòng trống của HĐ Matsuda
- **Assert** dòng 1 == 4 ô của Seachemot; dòng 2: tên == "Iwadako cut", size == "5-5.5 gr/pc"; dòng 3: tên == "Frozen boiled octopus", size == ""

### AC-40 — Gợi ý nối theo 4 bậc, tên + size tách được hai size · Maps to: NV14, R16, R23 · Test: unit
- **Given** Seachemot có tên cho p-55 (size "5-5.5 gr/pc") và p-67 (size "6-7 gr/pc"), cùng tên "Frozen iwadako boiled cut"; lịch sử nối "Frozen Tako tip raw" → p-hist; p-a có tên mặc định "Frozen Tako tip boiled"
- **When** gợi ý cho (Seachemot, "frozen  iwadako BOILED cut", "6-7 gr/pc"); (Seachemot, cùng tên, size "") ; (Seachemot, "Frozen Tako tip raw"); (Matsuda, "Frozen Tako tip boiled")
- **Assert** lần lượt == "p-67", "" (bậc 2 ra 2 mặt hàng), "p-hist", "p-a"

### AC-41 — Máy chủ chưa có cột tên thương mại không kẹt lưu · Maps to: NV14, R23 · Test: unit
- **Assert** `PRODUCT_TABLE.toRow({...p, tradeName: undefined})` không có khóa `trade_name`; `toRow({...p, tradeName: "X"}).trade_name == "X"`; `fromRow({id:"1",name:"a"}).tradeName === undefined`; `fromRow({..., trade_name: null}).tradeName == ""`

### AC-42 — Báo cáo năm khớp hồ sơ thật lô 165 · Maps to: NV15, R25 · Test: unit
- **Given** HĐ 18.26 (19.000 kg · 172.445,00 USD, dung sai 10%, hạn 05/09/2026, ký 30/07/2026); chuyến lô 165 40RF, KH 19.000 kg, ETD 26/09/2026, B/L on board 26/09; invoice 234/26 22.214 kg · 194.557,60 USD; chưa tiền về
- **When** `buildExportReport(d, yearPeriod(2026), {customers})`
- **Assert** tháng 2026-09: `shipments == 1`, `containers == 1`, `plannedKg == 19000`, `actualKg == 22214`, `actualAmount == 194557.6`, `outstanding == 194557.6`; tổng: `contractsSigned == 1`, `late == 1`, `onTime == 0`; `attention` có HĐ 18.26 với `kind == "over-tolerance"` và chữ "thừa 16,9%"; `stuck[2] == 1` (bước 2 Lệnh SX)

### AC-43 — Lọc khách áp mọi con số, bỏ chuyến / HĐ đã hủy · Maps to: NV15, R25 · Test: unit
- **Given** thêm khách K2 có 1 chuyến cùng tháng 9 và 1 chuyến đã hủy
- **Assert** không lọc: T9 `shipments == 2`; lọc Seachemot: `shipments == 1`, `byCustomer.length == 1`; chuyến hủy không vào số nào

### AC-44 — Tiền về theo ngày tiền về, còn chưa về theo chuyến · Maps to: NV15, R25 · Test: unit
- **Given** lô 165 nhận 100.000 USD ngày 15/10/2026 + cọc HĐ 20.000 USD ngày 05/08/2026
- **Assert** kỳ tháng 10: `received == 100000`; kỳ tháng 8: `received == 20000`; kỳ tháng 9: `outstanding == 94557.6` (chuyến T9 đã về 100.000)

### AC-45 — Không quyền xem giá thì báo cáo không có tiền · Maps to: NV15, R11 · Test: manual
- **Given** tài khoản có `export-plans.view` mà không có `view-price`
- **Assert** tab báo cáo hiện kg / số chuyến; số ô tiền (USD) trên trang == 0; file Excel không có cột tiền
### AC-46 — Trích xuất tên từ HĐ, không ghi đè · Maps to: NV16, R26 · Test: unit
- **Given** Seachemot chưa có tên nào; HĐ 18.26 có 14 dòng đã nối 14 mặt hàng khác nhau
- **When** `extractCustomerNames(existing, "scm", lines, "18.26/BSF-SCM.2026")`; rồi gọi lại với dòng 1 đổi tên thành "X"
- **Assert** lần 1 tạo đúng 14 dòng, ghi chú == "Trích xuất từ HĐ 18.26/BSF-SCM.2026"; lần 2 tạo 0 dòng và tên của dòng 1 vẫn == tên cũ; dòng không có mặt hàng hoặc tên rỗng ⇒ 0 dòng

### AC-47 — Chặn trùng trong danh sách của một khách · Maps to: NV14, R23 · Test: unit
- **Assert** thêm dòng thứ 2 cho (Seachemot, p-55) ⇒ lỗi "mặt hàng đã có tên"; thêm (Seachemot, p-67) trùng tên + size của p-55 (khác hoa thường) ⇒ lỗi "trùng tên + size"; cùng tên khác size ⇒ hợp lệ; (Matsuda, p-55) trùng tên của Seachemot ⇒ hợp lệ

### AC-48 — Máy chủ chưa có bảng tên theo khách không kẹt · Maps to: NV16, R23 · Test: integration + manual
- **Given** chạy có máy chủ mà chưa chạy mig `0077`
- **Assert** lưu HĐ thành công; số dòng tên được gửi lên máy chủ == 0; hàng chờ của bảng tên == 0 sau khi tải lại; chạy không máy chủ (localStorage) thì trích xuất bình thường

### AC-50 — Trích xuất từ chứng từ quét mọi HĐ của khách · Maps to: NV16, R26 · Test: unit
- **Given** Seachemot có HĐ 18.26 (ký 30/07: p-55 size 5-5.5, p-tip) và HĐ 21.26 (ký 01/09: p-67 size 6-7, p-55 tên khác, 1 dòng chưa nối), 1 HĐ đã hủy, 1 HĐ của khách khác; bảng đã có tên cho p-tip
- **When** `extractCustomerNamesFromContracts(d, existing, "scm", newId)`, rồi chạy lại
- **Assert** `contractCount == 2`; tạo đúng 2 dòng [p-55 "Trích xuất từ HĐ 18.26/BSF-SCM.2026", p-67 "Trích xuất từ HĐ 21.26/BSF-SCM.2026"]; p-tip giữ tên cũ; lần chạy lại tạo 0 dòng

### AC-51 — Đọc invoice 234/26 ra đúng dòng và tổng · Maps to: NV17, R27 · Test: unit
- **Given** bảng invoice 234/26 chép từng ô theo bố cục Excel (8 nhóm hàng, dòng Packing sau 2 size, nhóm không size, dòng SIZE không số, "Size" không dấu hai chấm)
- **When** `parseInvoiceRows(rows)`; và cùng bảng với số in kiểu Anh như chữ PDF ("3,000.00")
- **Assert** số == "234/26"; ngày == "2026-09-25"; khách == "SEACHEMOT CO., LTD"; tiền tệ == "USD"; số dòng == 13; tổng == {2251, 22214, 194557.6} == cộng các dòng; cảnh báo == 0; bản chữ PDF ra 13 dòng giống hệt

### AC-52 — Invoice không đọc được hoặc lệch tổng · Maps to: NV17, R27 · Test: unit + manual
- **Given** bảng không có dòng DESCRIPTION; bảng thiếu dòng TOTAL; dòng TOTAL ghi 22.000 kg; file .jpg / .docx; file PDF bản scan 234/26
- **Assert** không có DESCRIPTION ⇒ `reason == "no-table"`; thiếu TOTAL ⇒ tổng == cộng dòng + 1 cảnh báo; TOTAL 22.000 ⇒ giữ 22000 + cảnh báo "cộng các dòng ra 22214 kg"; .jpg / .docx ⇒ không đọc; PDF scan (thử tay) ⇒ câu "bản scan (ảnh), không có chữ để đọc", số ô được điền == 0

### AC-53 — Nối dòng invoice tách hai size cùng tên · Maps to: NV17, R27, R23 · Test: unit
- **Given** HĐ có 2 dòng "Frozen iwadako blanched cut" size 2-3 (p-23) và 5g (p-5g), 1 dòng "Frozen tako tip raw" không size (p-tip, giá 2,0), 1 dòng iidako 26-40 chưa nối; khách có tên iidako 26-40 → p-io; mặt hàng p-k có tên mặc định "Frozen tako karaage"
- **Assert** "2-3 GR/PC" ⇒ p-23 (HĐ); "5g ±0.5g  gr/pc" ⇒ p-5g; size 8-9 ⇒ "" (không đoán); iidako 26-40 ⇒ p-io (tên của khách); karaage ⇒ p-k (tên mặc định); so 234/26 với HĐ ⇒ dòng 8 "đơn giá invoice 2.15, hợp đồng 2", số dòng "Không có trong HĐ" == 9

### AC-54 — Điền mục invoice không ghi đè · Maps to: NV17, R27 · Test: unit + manual
- **Given** mục Commercial Invoice trống; mục đã có số "234 / 26", 2.251 thùng, 22.000 kg
- **Assert** mục trống ⇒ điền đủ 5 ô (số, ngày, thùng, kg, tiền); mục đã có ⇒ kg giữ 22000, báo đúng 1 ô lệch {kg 22000 ≠ 22214}, ô trùng (số khác khoảng trắng, thùng bằng) không báo; thử tay: Hủy ⇒ số dòng mục / tên trong sổ không đổi; Lưu sau khi nối 1 dòng ⇒ thêm đúng 1 tên ghi chú "Trích xuất từ Invoice 234/26", Hoàn tác gỡ cả tên

### AC-55 — Trích xuất quét thêm invoice của khách · Maps to: NV16, NV17, R27 · Test: unit + manual
- **Given** khách có HĐ C1 (ký 30/07: file PDF + file .jpg ở mục invoice), HĐ C2 (ký 01/09: file .xlsx), HĐ đã hủy có file, HĐ khách khác có file, file .xlsx ở mục Packing List
- **Assert** `invoiceFilesOfCustomer` == [C1 PDF, C2 xlsx] (đúng thứ tự); thử tay chạy không nối máy chủ ⇒ câu "Đã quét 2 hợp đồng và 0 invoice … Bỏ qua 2 file invoice không đọc được", không toast

### AC-49 — Demo có tên theo khách, số thật không đổi · Maps to: NV14, R14 · Test: manual (vòng §4b spec chế độ demo)
- **Assert** bộ demo có ≥ 1 dòng tên theo khách; đếm dòng `customer_product_names` có `site_id <> 'site-demo'` trước / sau khi bật demo → thao tác → thoát == bằng nhau

## 11. Assumptions / Open

**Assumptions (tự quyết, đổi được không tốn dữ liệu):**
- A1. Ghi chú Q5 "phòng KH truy xuất và theo dõi được" ⇒ `planner` **xem và ghi** tiền về (R11). Nếu chỉ cần xem ⇒ bỏ create/update/delete của `planner` ở `export-plans.payments`.
- A2. U4 gồm thủ kho và quản đốc / phó quản đốc cả 3 xưởng (hàng khô cũng đóng cont). Admin bớt được ở Vai trò & quyền.
- A3. HĐ chờ duyệt được lên chuyến kế hoạch; chỉ bước 2 bị chặn.
- A4. Bước 1 xong = HĐ có bản hiệu lực **và** bản đó có file ký.
- A5. Một chuyến = một cont (Q2). Cont "40+20" = hai chuyến cùng booking, chứng từ "dùng chung".
- A6. Tiền tệ ở cấp HĐ (mặc định USD); tiền về ghi tiền tệ riêng, chỉ cộng cùng tiền tệ.
- A7. Kho file riêng (`export-files`), không dùng chung kho của Tài liệu công ty. Lý do: kho đó lọc theo phòng ban; nới ra là đổi RLS đang chạy (🔴).
- A8. Số liệu tháng 10/2026 nhập tay từ sổ Excel tháng 10 (Q6). Không nạp lịch sử.
- A9. "Chuyến đã đóng cont" (chặn hủy HĐ) = chuyến đã có số cont (hoặc biển số xe).
- A10 (v6). Khóa tên theo khách = (khách, mặt hàng) vì mặt hàng của xưởng đã gồm size ("cắt luộc 5,5gr"); cột size của dòng tên là **chữ in trên chứng từ** ("5-5.5 gr/pc, 190-210 pcs/kg"), không phải khóa.
- A11 (v6). So tên + size: không phân hoa thường, gộp khoảng trắng — size chép khác một ký tự thì rơi xuống bậc 2–4 của R23, không nối sai.
- A12 (v6). Quyền: bảng tên theo khách theo quyền danh mục Khách hàng (`catalog.customers`); Kế hoạch đã có quyền ghi (R11). Trích xuất chạy dưới quyền người đang lưu HĐ — không có quyền ghi danh mục khách thì bỏ qua trích xuất, HĐ vẫn lưu.
- A13 (v6). Không chép tên theo khách từ khách này sang khách khác; khách mới bắt đầu từ tên mặc định.
- A14 (v7). Chưa có file Excel gốc THẬT của invoice (Phòng KH chưa xác nhận giữ Excel hay PDF) ⇒ bộ đọc canh theo bản in 234/26, đọc được cả .xlsx lẫn PDF có chữ. Có file thật thì chạy thử, lệch bố cục thì sửa R27 + test.
- A15 (v7). Đọc invoice chỉ GỢI Ý — mọi thứ chỉ vào sổ khi U1 bấm Lưu; kết quả đọc không vào nháp (file chọn từ máy không lưu nháp được), số đã điền vào ô thì theo nháp như mọi ô khác.
- A16 (v7). Chạy không nối máy chủ: khối Đọc invoice có ô chọn file riêng chỉ để đọc (file không lưu) — vẫn bỏ được việc gõ 3 số tổng.

**Open (RED):** không có. Ma trận quyền (R11) đã được đồng ý ở Q11. Lúc build, migration thay ma trận mặc định vẫn theo khuôn `0073` (thay trọn, chạy 2 lần không lỗi, có câu lùi).

## 12. Ràng buộc build (luật repo — không phải hành vi)

- Tên tiếng Anh (luật 8): tài nguyên `export-plans` (+ `.loading`, `.payments`), route `/planning-export` (route phẳng — id nav = path, khuôn mọi màn khác), nav id `planning-export`, vai trò `planner`. Bổ sung từ điển §2b (hợp đồng `exportContract`, bản `revision`, lần duyệt `approval`, gia hạn `deadlineExtension`, chuyến `shipment`, bước `step`, mục chứng từ `documentItem`, thực xuất `actuals`, tiền về `payment`) **trước** khi code.
- Vai trò mới `planner` ⇒ thêm vào `Role`/`ROLES` (`types.ts`), `SYSTEM_ROLE_DEPARTMENTS` (`planner: ["planning"]`), `HOME_BY_ROLE`, **và viết lại hàm SQL `current_user_departments()`** trong migration mới. Thiếu hàm SQL thì RLS không cho `planner` đọc 9 tài liệu, AC-1 đỏ. **Không** chèn dòng `app_roles` cho `planner` (R11).
- Trạng thái mục 4a / 4b **suy từ file**, không lưu cột trạng thái cho hai mục này (để RLS cho U4 chỉ cần quyền thêm file).
- Migration từ `0074` (rà `origin` trước khi đặt), chỉ-thêm, idempotent, RLS ngay (khuôn `has_document_permission`), câu `drop` để lùi; thứ tự deploy: tạo kho file → migration → code.
- `TableMapping` + `refColumns` · `DemoBundle` + `DemoPackLoader` + checklist demo · `rowMarkKey` cho mọi bảng nghiệp vụ · nháp form (luật 17) cho form HĐ, bản sửa, lần duyệt, gia hạn, chuyến, tiền về · nút theo chức năng (luật 16) · ô khách là `Combobox` có tạo mới + bút chì (luật 7).
- Hàm thuần ở `lib/exportPlanning.ts` (có test cùng thư mục): `contractTotals`, `validateContract`, `findDuplicateContract`, `effectiveRevision`, `effectiveDeadline`, `stepState`, `canMarkDone`, `canMarkNotApplicable`, `documentItems`, `shipmentMonth`, `validateShipment`, `shipmentActuals`, `isShipmentLate`, `isShipmentClosed`, `contractCoverage`, `contractClosure`, `canCancel`, `searchShipments`, `buildMonthPlan`, xuất Excel.
- Thêm dòng vào bảng "Code đổi → doc phải update" của CLAUDE.md khi tạo thư mục `features/export-planning`.

## History
- v9.3 2026-10-31 — NV19 lịch xuất hàng khi lập HĐ (§0d): R39 dựng lịch theo số cont, R40 nới R29 cho lịch, R41 chuyến còn trống (sửa R35, xóa HĐ). AC-74…77 = test; demo ca 7b.

- v7 (2026-10-22 tối): **đọc Commercial Invoice** (NV17, R27, AC-51…55; NV16 thêm nguồn invoice). Chủ dự án chốt 3 điểm: không đọc bản scan (cần file gốc), chưa rõ Phòng KH giữ Excel hay PDF ⇒ đọc cả hai, đọc xong tự điền 3 số tổng + báo chỗ lệch (không ghi đè). Orchestrator tự chấm (việc nhỏ, không spawn team): loại OCR Tesseract (sai trên bảng scan), hoãn AI cloud (phí + key), loại ghi đè ô đã có số. Không migration; thêm thư viện `pdfjs-dist` (nạp khi đính PDF).
- v6.2 (2026-10-22 chiều): chủ dự án đặt tên chức năng **"Trích xuất từ chứng từ"** (thay "tự học" ở mọi chỗ) + thêm lối chủ động: nút quét mọi HĐ của khách (NV16 (b), AC-50). Nguồn = dòng hàng hợp đồng (Commercial Invoice chỉ có tổng + PDF). Ghi chú dòng mới "Trích xuất từ HĐ <số>".
- v6 (2026-10-22 chiều, họp Hoài Nam ↔ Lê Khiêm — Phòng Kế hoạch): tên trên chứng từ theo **từng khách** (không theo mặt hàng, không theo nước), ~15–20 tên / khách theo size. NV14 viết lại (danh sách tên theo khách ở danh mục Khách hàng: tên · size · quy cách · mã HS), thêm NV16 trích xuất từ HĐ (chỉ tạo, không ghi đè — R26), R23 viết lại (thứ tự điền + 4 bậc gợi ý nối, tên + size tách hai size cùng tên), `products.trade_name` thành tên mặc định. AC-39/40 viết lại, thêm AC-46…49. Chủ dự án chọn cả 4 đề xuất (cách lưu, nội dung, cột cũ, chỗ quản lý). ⏳ Chưa build — cần mig `0077_customer_product_names.sql`.
- v5 (2026-10-22, góp ý chủ dự án): **tên thương mại** mặt hàng (NV14, R23 — một tên tiếng Anh / mặt hàng, dùng điền tên hàng và gợi ý nối); ô "Số đơn của khách" gọi là **Số PO của khách** (R24 — mã "Order" trên HĐ giấy; KHÔNG đổi thành "Số booking" vì booking là của hãng tàu theo chuyến — chủ dự án chốt sau khi đối chiếu HĐ 18.26 + sổ Kế hoạch xuất hàng); **báo cáo kỳ** (NV15, R25). Orchestrator tự chấm (việc nhỏ, không spawn team): tách hai số tiền — tiền về theo ngày nhận (gồm cọc HĐ) · còn chưa về theo chuyến — vì cọc HĐ không gắn chuyến nên không cộng được vào chuyến.
- v4 (2026-10-20, sau audit hồ sơ SCM — chủ dự án góp ý): nhãn "khép kín" đổi theo ngôn ngữ chứng từ XK (chuyến **Đủ hồ sơ**, HĐ **Đã xuất đủ** / **Đã chốt HĐ**, "Ngoài dung sai thừa / thiếu"); người ký duyệt chọn từ tài khoản BGĐ (R17 — trước gõ tự do, đã gõ sai tên GĐ); kỳ xem tháng / tuần / khoảng ngày + lọc khách áp cả 4 con số (R18); dòng hàng nối danh mục mặt hàng, bắt trước Lệnh SX, nối không cần bản sửa (R16); bảo hiểm CIF/CIP (R19); H/C tự cấp không bắt số (R20); chứng từ bắt buộc không xóa (R21); số kiểu Anh (R22); cọc cấp HĐ xem / sửa / xóa; khôi phục chuyến hủy; Excel phần còn thiếu + tuần lịch. Domain-Specialist XK veto: "thanh lý" (thuật ngữ pháp lý), gõ tự do người ký, lọc theo ngày ký, thay tên tiếng Anh bằng tên Việt, nối thẳng 141 mã kế toán.
- v3 (2026-10-20): ĐÃ BUILD v1. Lệch nhỏ so với v2: route `/planning-export` (phẳng); kế toán không có Xóa tiền về (giữ luật vai trò — KTT / phòng KH xóa); thực xuất của chuyến "dùng chung" Commercial Invoice tính ở chuyến gốc (không cộng đôi); chạy không nối máy chủ thì ghi chú / số chứng từ thay file làm bằng chứng (như /documents).
- v2 (2026-10-20): rà bởi Domain-Specialist XK + Cross-User-Integrity (25 điểm). Sửa: thực xuất lấy từ invoice thương mại (bỏ hàng mẫu, bỏ B/L); dung sai áp cả kg lẫn tiền, tính biên; `units` vs `cartons`; duyệt gắn **bản** (bản sửa bị từ chối không hủy HĐ); hủy HĐ kéo theo chuyến; hạn giao bắt buộc + HĐ quá hạn hiện ở tháng hiện tại; loại chuyến Xe tải / Đóng ghép; "dùng chung" chứng từ cho cont ghép; quyền đọc của U4; 4a/4b tự suy từ file; thứ tự ngày; gia hạn riêng; L/C + cọc; form/người cấp chứng từ; mốc gửi bộ chứng từ; độ phủ chuyến; tra theo số giấy tờ; cột Đơn giá; demo dùng file giữ chỗ; tiền về xóa được.
- v1 (2026-10-20): khởi tạo đợt 1 từ kế hoạch đã chốt 11 câu.
