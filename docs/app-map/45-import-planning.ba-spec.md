# 45 — ba-spec: Phòng Kế hoạch · Nhập khẩu — Đợt 1 (hợp đồng → bộ chứng từ → số lượng thực nhập)

> Load khi: xây hoặc sửa mảng Nhập khẩu của Phòng Kế hoạch: hợp đồng nhập (đối tác nước ngoài, dòng hàng tên · kg · đơn giá), lần nhập (cont / hàng lẻ, ngày về kho), bộ chứng từ đính kèm (Invoice, Packing List, tờ khai nhập, C/O, kiểm dịch…), số lượng thực nhập theo dòng hàng, đóng hợp đồng, quyền `import-plans`.
covers: src/features/import-planning/**, src/lib/importPlanning.ts, supabase/migrations/0083_import_suppliers.sql, supabase/migrations/0084_import_line_products.sql, supabase/migrations/0085_import_sample_checks.sql, src/lib/importSampleChecks.ts, src/lib/importSampleFile.ts, src/lib/importPlanningDemo.ts, src/lib/importFileStorage.ts, supabase/migrations/0082_import_planning.sql
last_verified: 2026-10-30
<!-- updated: 2026-10-30 (b) — LOẠI HÀNG mỗi dòng hàng HĐ nhập (cột `import_contract_lines.goods_type_id`, danh mục `goods_types`, mig 0089): ô Loại hàng ở phiếu HĐ (thêm mới + bút chì), bảng dòng hàng ở hồ sơ có cột Loại hàng. Sửa kèm: phiếu HĐ nhập trước đây KHÔNG render hộp sửa nhanh ⇒ bút chì NCC / mặt hàng không mở — nay render cả 3. Chưa chạy 0089 ⇒ ẩn ô + cột. -->
<!-- updated: 2026-10-30 — CHÉP DÒNG HÀNG ở phiếu HĐ nhập: nút Chép dòng, bản chép ngay dưới dòng gốc, giữ tên hàng · mặt hàng · kg · đơn giá (dòng nhập chưa có size). File chứng từ / thực nhập vốn đã nhiều file; nạp báo cáo kiểm mẫu giữ 1 file (đọc một báo cáo). -->
ttl_days: 90
status: ba-spec v4 ĐÃ BUILD (2026-10-29) — **chỉ số kiểm mẫu của kho đi theo từng invoice** (§0d, mig `0085` ⏳ CHƯA chạy DB thật) · v3 (2026-10-29 khuya) — **dòng hàng nối mặt hàng danh mục** (§0c, mig `0084` ⏳ CHƯA chạy DB thật) · v2 (2026-10-29 tối) — **danh mục Nhà cung cấp nhập khẩu RIÊNG** (§0b, ĐÃ BUILD 2026-10-29 — mig `0083` ⏳ CHƯA chạy DB thật) · v1.1 ĐÃ BUILD 2026-10-29 (commit 91b8f14, `0082` ✅ chạy DB thật 2026-10-29 theo chủ dự án). Giao diện: design-spec [46](46-import-planning-ui.design-spec.md).

<!-- re-verified: 2026-10-30 — v4 build: AC-35/36/37/39 = test `importSampleChecks.test.ts` (11, lưới dựng đúng khuôn ảnh báo cáo 25/10/2026: 5 mẫu, ô gộp, % Excel, ngày serial); AC-38 = luật trạng thái không đọc kiểm mẫu (receiptState / closeGate không đổi); AC-41 PGlite (0001→0084 + 0085 chạy 2 lần, 4 policy, ma trận không đổi, planner thêm / xóa, kế toán chỉ đọc, thủ kho + qc đọc 0); AC-40 thử tay preview. Chưa thử: file Excel GỐC của kho (chủ dự án gửi sau). -->
<!-- re-verified: 2026-10-29 23:00 — v3: AC-29…AC-33 = test `importPlanning.test.ts` (28) + `importPlanningDemo.test.ts` (5); 0084 PGlite (0001→0083 + dòng mẫu, chạy 2 lần, dòng cũ product_id null, policy / quyền không đổi, thủ kho đọc được sửa 0 dòng); AC-34 thử tay preview (worktree sạch, không nối máy chủ): gợi ý "Frozen  whole OCTOPUS 1-2 kg" ra mặt hàng của HĐ trước, thêm mặt hàng mới trong ô ⇒ danh mục +1 + tên hàng trống tự điền, hồ sơ 1 dòng "Chưa nối" (bảng + thẻ lần nhập), đóng HĐ bị chặn nêu tên dòng, nối xong đóng được, nháp giữ mặt hàng khi rời trang, 360 px × 130 % không cuộn ngang. -->
<!-- re-verified: 2026-10-29 21:00 — v2 build: AC-25/26 = test `importPlanning.test.ts` (23); AC-27/28 PGlite (0001→0082 + HĐ trỏ Đại lý, 0083 chạy 2 lần: chép đúng 1 NCC giữ id, Đại lý còn nguyên, 0 HĐ mất đối tác; planner thêm / xóa NCC, kế toán chỉ đọc, thủ kho đọc 0); AC-24 thử tay preview sandbox: ô Đối tác trống dù Đại lý có dòng, thêm "Andaman Seafood" ⇒ vào bsf.import-suppliers, Đại lý không có; nhóm Kế hoạch đúng 1 Tra cứu mở tab NCC nhập khẩu. -->
<!-- re-verified: 2026-10-29 16:00 — build: AC-3…AC-18 = test `src/lib/importPlanning.test.ts` (21) + `importPlanningDemo.test.ts` (4); AC-1/2/19 RLS thử PGlite (chuỗi 0001→0082 + chạy lại 0082: Nhân viên KH ghi 4 bảng; thủ kho đọc dòng hàng, KHÔNG đọc HĐ / chứng từ, chỉ ghi thực nhập, sửa lần nhập ⇒ 0 dòng; kế toán chỉ đọc; qc đọc 0; anon bị từ chối); luồng lập HĐ 2 dòng → lần nhập → 3 chứng từ → thực nhập vượt 200 kg (cảnh báo, vẫn lưu) → đóng thiếu lý do bị chặn → đóng có lý do → mở lại, tra số cont, 360 px × 130 % không tràn — thử tay preview sandbox (không nối máy chủ). Chưa thử: tải file thật, AC-22 demo trên DB thật, AC-23 cần DB. -->

> **Mục đích:** oracle HÀNH VI cho mảng Nhập khẩu đợt 1. Ai làm nghiệp vụ gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (design-spec viết sau, đọc kèm [42](42-export-planning-ui.design-spec.md) để giữ cùng kiểu với Xuất khẩu).
> **Nguồn:** trả lời của chủ dự án 2026-10-29 (§0) · khung Xuất khẩu [41](41-export-planning.ba-spec.md) (chỉ lấy phần dùng được) · kế hoạch gốc [`spec/xuat-khau-phong-ke-hoach.md`](../spec/xuat-khau-phong-ke-hoach.md) §1 ("Phòng Kế hoạch có 3 hạng mục: Xuất khẩu · Nhập khẩu · Khác").
> ⚠️ **"Nhập khẩu" ≠ "Nhập hàng"** (`/imports`, mua nguyên liệu trong nước, [30](30-nhap-hang.md)). Hai mảng không chung bảng, không chung nhãn.

---

## 0. Đã chốt (chủ dự án 2026-10-29)

Phạm vi chủ dự án nêu: **"chỉ cần tạo ngắn gọn: Hợp đồng (tên hàng, số lượng, đơn giá) → Bộ chứng từ đính kèm (Invoice, packing list, CO, tờ khai nhập, kiểm dịch nếu có…) → Số lượng thực nhập"**.

| # | Câu | Trả lời | Hệ quả trong spec |
|---|---|---|---|
| 1 | Một HĐ về mấy lần | **Tùy HĐ** (một hoặc nhiều lần) | HĐ có 1..n **lần nhập** (NI4) |
| 2 | Thứ tự việc | **Khác**: nhập về gia công, **không cần thanh toán** | Không có bước thanh toán (R10) |
| 3 | Bộ chứng từ NCC | (theo phạm vi trên) | R4: 3 bắt buộc + các loại "nếu có" |
| 4 | Giấy để lấy hàng khỏi cảng | **Không cần** tách riêng | Không có bước Thông quan; tờ khai, kiểm dịch nằm trong bộ chứng từ |
| 5 | Loại hình tờ khai | **Cả ba**: sản xuất xuất khẩu · kinh doanh · gia công | Loại hình là thuộc tính của HĐ + tờ khai (R4) |
| 6 | Ai làm thủ tục | **Phòng Kế hoạch tự làm** | U1 ghi hết chứng từ |
| 7 | Cân lại khi về | **Không cân, lấy theo invoice** | Thực nhập = số theo invoice, ghi tay (R5) |
| 8 | Ngưỡng đòi NCC | **Không cần** | Không cảnh báo thiếu hàng theo % |
| 9 | Ai ghi lúc nhận | **Thủ kho ghi, không chụp ảnh** | U4 ghi thực nhập (NI6), không có ảnh |
| 10 | Trả tiền NCC | **Mở L/C** (phần "chưa trả đủ" không trả lời) | Không theo dõi tiền (R10); L/C đính được như chứng từ "Khác" |
| 11 | Duyệt trên app | **Không cần duyệt** | U1 tự đóng HĐ (NI8) |
| 12 | Lô tính vào tháng nào | **Tháng hàng về kho** | R1 |
| 13 | Hạn giao, dung sai | **Không cần** | Không trễ hạn, không dung sai (R10) |
| 14 | Vận chuyển | **Cont lạnh 20 / 40 + hàng lẻ ghép cont**; **không** nhắc hạn trả cont / lưu bãi | R12 |

Đối tác: v1.1 lấy từ danh mục Đại lý — **v2 đổi sang danh mục NCC nhập khẩu riêng (§0b)**. Hai câu về cách dựng app (quyền riêng, nối sổ kho) chủ dự án để Claude quyết — xem §11 Assumptions.

## 0b. v2 (2026-10-29 tối) — danh mục Nhà cung cấp nhập khẩu RIÊNG · THẮNG R15, A1, AC-23 cũ

Chủ dự án xem bản v1.1 trên app: **"những nhà cung cấp cho nhập khẩu này hoàn toàn khác so với nhập hàng"** và nhóm Kế hoạch có 2 mục Tra cứu thừa. v1.1 cho đối tác dùng chung danh mục **Đại lý** (bảng `suppliers` của Nhập hàng — đại lý trong nước, CCCD, hóa đơn GTGT) ⇒ sai nghiệp vụ, trộn hai danh sách.

**Đã chốt (4 câu, 2026-10-29):**

| # | Câu | Trả lời |
|---|---|---|
| 1 | 0082 đã chạy DB thật chưa | **Đã chạy** ⇒ viết `0083`, không sửa 0082 |
| 2 | Danh mục NCC nhập khẩu đặt ở đâu | **Tab riêng trong Danh mục** ("NCC nhập khẩu", cạnh Khách hàng / Đại lý); ô đối tác của HĐ vẫn thêm mới + sửa nhanh |
| 3 | Nhóm Kế hoạch giữ Tra cứu nào | **Một mục Tra cứu, mở tab NCC nhập khẩu** (bỏ Tra cứu Khách hàng + Tra cứu Đại lý ở nhóm này; nhóm Bán hàng vẫn có Tra cứu Khách hàng) |
| 4 | Lưu thông tin gì | **"Thừa hơn thiếu"**: tên đầy đủ, quốc gia, địa chỉ; người liên hệ, email, điện thoại; ngân hàng thụ hưởng; cảng xếp hàng thường dùng — + các trường cần thiết khác (R16) |

**Nghiệp vụ mới NI10 — Quản lý danh mục NCC nhập khẩu · owner U1** (Flow ở §5). Đối tác của HĐ nhập (NI2) chọn từ danh mục này, **không** từ Đại lý.

**Luật v2:**
- **R15 (v2) — Đối tác = danh mục NCC nhập khẩu**, tách hẳn Đại lý. Ô đối tác của HĐ nhập chỉ liệt kê NCC nhập khẩu **đang giao dịch**; danh sách Đại lý của Nhập hàng không có NCC nhập khẩu và ngược lại. Bên thuê gia công cũng ghi ở đây.
- **R16 — Trường của NCC nhập khẩu.** Bắt buộc: **tên gọi tắt** (duy nhất, không phân hoa thường, bỏ khoảng trắng đầu / cuối). Không bắt: mã · tên đầy đủ (như trên HĐ) · quốc gia · địa chỉ · mã số thuế / số đăng ký nước ngoài · người liên hệ · chức vụ · email · điện thoại · website · mặt hàng chính · cảng xếp thường dùng · ngân hàng thụ hưởng · số tài khoản · SWIFT · địa chỉ ngân hàng · ghi chú · trạng thái (**Đang giao dịch** · **Ngừng giao dịch**, mặc định Đang giao dịch).
- **R17 — Không xóa NCC đã có HĐ** (luật repo 6): NCC có ≥ 1 HĐ nhập (kể cả HĐ đã hủy) ⇒ chỉ chuyển **Ngừng giao dịch**; chưa có HĐ ⇒ xóa được (xác nhận + Hoàn tác). NCC ngừng giao dịch vẫn hiện tên ở HĐ cũ, không chọn được cho HĐ mới.
- **R18 — Dữ liệu cũ của v1.1.** HĐ nhập đã ghi trỏ vào một dòng Đại lý ⇒ `0083` **chép** dòng Đại lý đó sang danh mục NCC nhập khẩu **giữ nguyên id** (tên gọi tắt, tên ghi phiếu → tên đầy đủ, địa chỉ, email, quốc gia), HĐ không phải sửa. Dòng Đại lý gốc **không tự xóa** (chủ dự án tự xóa ở tab Đại lý nếu đó là NCC nhập khẩu nhập nhầm). Cột `suppliers.country` (0082) để yên, app thôi dùng, form Đại lý bỏ ô Quốc gia.
- **R19 — Tra cứu ở nhóm Kế hoạch**: đúng 1 mục, mở danh mục ở tab NCC nhập khẩu (khuôn "một mục Tra cứu mỗi nhóm" của nav).
- **R9 (bổ sung)** — tài nguyên quyền MỚI `catalog.import-suppliers` (nhóm Danh mục): planner / Trưởng / Phó phòng KH: xem · thêm · sửa · xóa; BGĐ · kế toán trưởng · kế toán: xem; thủ kho: không (thủ kho đọc tên đối tác qua bản chép ở lần nhập). Admin đủ. Máy chủ RLS riêng của 0083.

**Cross-user v2:** không thêm bàn giao — NI10 chỉ U1 làm; U2 / U3 xem.

**Flow optimization log v2:**

| Flow | Candidate | Chọn / Loại | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| R15 | A. Dùng chung Đại lý + cột quốc gia (v1.1) | Loại (**VETO** chủ dự án) | Hai nhóm đối tác khác hẳn; trộn làm ô chọn Nhập hàng lẫn NCC nước ngoài | Domain (chủ dự án) |
| R15 | B. Dùng danh mục Khách hàng | Loại | Khách là người MUA thành phẩm; trộn vào báo cáo bán / XK | Optimizer |
| R15 | C. Danh mục riêng NCC nhập khẩu | **Chọn** | Đúng nghiệp vụ, không đụng 2 danh mục đang chạy | Chủ dự án + Optimizer |
| R18 | A. 0083 chuyển + xóa dòng Đại lý cũ · B. chép giữ id, không xóa · C. bắt chọn lại đối tác từng HĐ | **B** | A xóa dữ liệu (🔴); C bắt người dùng làm lại; B HĐ chạy tiếp, dọn tay sau | Orchestrator |
| R19 | A. Bỏ hết Tra cứu · B. Giữ Khách hàng · C. Giữ NCC nhập khẩu | **C** (chủ dự án chọn) | Danh mục mới chưa có lối vào nào khác ngoài Danh mục chung | Chủ dự án |

**AC v2:** AC-23 (cũ) **bỏ**; thêm AC-24 … AC-28 ở §10.

**Assumptions v2:** (1) NCC trùng tên gọi tắt bị chặn (giống đại lý); (2) đổi tên NCC **không** sửa chữ đã chép ở HĐ / lần nhập cũ (sổ giữ chữ lúc ghi) — trừ khi lưu lại HĐ (lúc đó chép tên mới, như v1.1); (3) thủ kho không thấy danh mục NCC nhập khẩu.

## 0c. v3 (2026-10-29 khuya) — dòng hàng nối MẶT HÀNG danh mục · BỔ SUNG R7, NI2, NI3, NI7

Chủ dự án: **"các vị trí có dòng hàng hoặc mặt hàng như Tên hàng (như trên hợp đồng) của mục Nhập khẩu thì cần chức năng nối với mặt hàng trong danh mục của hệ thống để đồng bộ dữ liệu"**. v1/v2 chỉ ghi tên hàng bằng chữ tự do ⇒ cùng một hàng mỗi HĐ gõ một kiểu ("Frozen whole octopus 1-2 kg" / "Octopus WR 1-2"), không cộng / tra theo mặt hàng được, không nối được sang sản xuất, kho, xuất khẩu.

**Kiểm kê chỗ có tên hàng trong Nhập khẩu (B0):**

| # | Chỗ | Trước v3 | v3 |
|---|---|---|---|
| 1 | Dòng hàng khi lập / sửa HĐ (NI2, NI3) | chỉ chữ "Tên hàng (như trên hợp đồng)" | + **mặt hàng danh mục** của dòng, gợi ý sẵn (R20, R21) |
| 2 | Dòng hàng trong hồ sơ HĐ | tên chữ | + mặt hàng đã nối, hoặc **"Chưa nối"** |
| 3 | Ghi thực nhập theo dòng (NI6) | tên chữ | + tên mặt hàng (thủ kho nhận đúng hàng) |
| 4 | Thực nhập trong từng lần nhập | tên chữ | + tên mặt hàng |
| 5 | Đóng HĐ (NI8) | — | **bắt mọi dòng đã nối** (R7 bổ sung) |
| 6 | Tra số (NI7) | số HĐ, invoice, tờ khai, cont, B/L | + tên hàng trên HĐ và tên mặt hàng đã nối |
| 7 | Bộ demo (R14) | dòng chữ | dòng nối mặt hàng của danh mục demo |

Không có chỗ nào khác ghi tên hàng (lần nhập, chứng từ chỉ trỏ dòng HĐ).

**Luật v3:**
- **R20 — Dòng hàng nối một mặt hàng.** Mỗi dòng hàng HĐ nhập nối **một mặt hàng ở danh mục mở Mặt hàng** (`products` — danh mục dùng chung của sản xuất, đóng gói, bán, cân đối, Xuất khẩu; KHÔNG phải 141 mã kế toán, cũng không phải Loại NL). Tên như trên HĐ giữ nguyên ở "Tên hàng" (chữ của chứng từ, không đổi). **Không bắt lúc lập HĐ**; bắt trước khi đóng HĐ (R7). Nối / đổi nối ghi thẳng vào dòng (không có bước duyệt — R10), kể cả HĐ đã đóng (dòng đã có thực nhập vẫn đổi nối được — nối là thông tin nội bộ, không đổi số). Mặt hàng chưa có ⇒ thêm mới ngay trong ô chọn + bút chì sửa nhanh (luật repo 7). Dòng trỏ mặt hàng đã bị xóa khỏi danh mục ⇒ coi như **chưa nối**.
- **R21 — Gợi ý nối** (dòng chưa nối, khi tên hàng đã có chữ; lấy bậc đầu tiên ra đúng MỘT mặt hàng, không ra một ⇒ không điền): (1) cùng tên hàng (không phân hoa thường, gộp khoảng trắng) đã nối ở HĐ nhập trước — ưu tiên cùng NCC, rồi HĐ mới nhất; (2) tên tiếng Anh mặc định (`trade_name`) của mặt hàng trùng tên hàng; (3) tên mặt hàng trùng tên hàng. Gợi ý ghi rõ là gợi ý, người lập kiểm lại. Chọn mặt hàng khi ô tên hàng còn trống ⇒ điền tên tiếng Anh mặc định (không có thì tên mặt hàng); ô tên đã có chữ **không** bị ghi đè.
- **R7 (bổ sung v3)** — đóng HĐ còn dòng chưa nối mặt hàng ⇒ **chặn**, báo tên các dòng chưa nối và cách nối (sửa HĐ).
- **R22 — Máy chủ chưa chạy `0084`** (chưa có cột mặt hàng của dòng) ⇒ app không gửi mặt hàng, không bắt nối khi đóng, ô chọn mặt hàng báo "chưa chạy 0084" — không kẹt hàng chờ.
- **R11 giữ nguyên** — nối mặt hàng **không** tự ghi sổ kho / cân đối / sản xuất. Nối chỉ để mọi khu đọc chung một mã mặt hàng khi sau này nối luồng ([`trien-khai/flow-end-to-end-2-bo-phan`](../trien-khai/flow-end-to-end-2-bo-phan.md)).

**Cross-user v3:** không thêm bàn giao. U1 nối; U4 (thủ kho) chỉ đọc tên mặt hàng ở dòng thực nhập.

**Flow optimization log v3:**

| Flow | Candidate | Chọn / Loại | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| R20 nối với gì | A. Mặt hàng (`products`) · B. Loại NL · C. 141 mã kế toán | **A** | Chủ dự án nói "mặt hàng trong danh mục"; `products` đã mang loại NL + loài, Xuất khẩu đã nối vào đây (41 R16) ⇒ một mã chung. C là của kế toán, cấm sửa / chỉ ánh xạ qua `products` | Chủ dự án + Domain (kho) |
| R20 khi nào bắt | A. Bắt lúc lập HĐ · B. Không bắt lúc lập, bắt trước đóng HĐ · C. Không bao giờ bắt | **B** | A chậm khâu nhập khi mặt hàng chưa có; C để dữ liệu rời rạc mãi, trái mục đích "đồng bộ"; B như Xuất khẩu (bắt trước Lệnh SX) | Optimizer |
| R20 nối ở đâu | A. Hộp nối riêng · B. Ngay ở dòng hàng khi lập / sửa HĐ | **B** | Nhập khẩu không có bản sửa / duyệt (lý do Xuất khẩu cần hộp riêng) ⇒ sửa HĐ là đủ, ít bước | Optimizer |
| R21 | A. Không gợi ý · B. Gợi ý theo lịch sử + tên tiếng Anh · C. Dịch / đoán gần đúng | **B** | A gõ lại mỗi HĐ; C đoán sai lặng lẽ; B chỉ điền khi ra đúng một | Domain + Optimizer |

**AC v3:** AC-29 … AC-34 ở §10.

**Assumptions v3:** (1) nối với danh mục **Mặt hàng** (không phải Loại NL) — đổi được nếu chủ dự án muốn; (2) một dòng HĐ = một mặt hàng (HĐ gộp nhiều size thì tách dòng); (3) mặt hàng ngừng dùng vẫn chọn được (danh mục Mặt hàng chưa có trạng thái); (4) máy chủ đã chạy 0084 mà chưa có dòng hàng nào thì app chưa biết có cột ⇒ ô mặt hàng hiện từ khi có dòng hàng đầu tiên — lưu HĐ đầu xong mở Sửa để nối.

## 0d. v4 (2026-10-29) — CHỈ SỐ KIỂM MẪU CỦA KHO ĐI THEO TỪNG INVOICE · ĐÃ BUILD (mig 0085 chưa chạy)

**Yêu cầu (chủ dự án):** bộ phận Kho gửi Phòng Kế hoạch **báo cáo kiểm mẫu hàng nhập khẩu**. Báo cáo là một bảng Excel, mỗi cột một mẫu, có thể gom nhiều invoice của nhiều nhà xuất khẩu. Khi làm hồ sơ một invoice, Phòng Kế hoạch đính ảnh chụp (hoặc file Excel) của báo cáo. App **tự đọc** các cột thuộc invoice đó và **lưu nguyên giá trị** đi kèm invoice và hợp đồng. **Không tính** gì từ các số này.

**Đã soi tài liệu mẫu (25/10/2026):**

| Cột | Nhà XK trên báo cáo | Size | Invoice khớp | Lần nhập |
|---|---|---|---|---|
| 1–3 | Grand Marine (ô gộp 3 cột) | 70/100 · 80/100 · 100/200 | GMF/022/26-27 ngày 29.07.2026, 1×40 FCL, 4 size: 70/100 840 kg · 80/100 4.060 kg · 100/200 17.700 kg · **200/300 2.400 kg (không có mẫu)** | ngày nhập 21/08/2026 |
| 4 | Frontline | 50/100 | FLE/65/2026-2027 ngày 10.08.2026, 1 size 25.000 kg, 5 kg/BL × 4 | 29/09/2026 |
| 5 | Ife (= International Freezfish Exports, viết tắt theo số invoice "IFE/…") | 100/200 | IFE/21/2026-27 ngày 10.08.2026, 1 size 26.000 kg, 4 kg × 5 | 10/09/2026 |

⇒ **Một invoice = một lần nhập (1 cont)** đúng như mô hình hiện có. **Một cột mẫu = một size của invoice**, tức là một dòng hàng của HĐ. Không phải size nào cũng có mẫu. Ba invoice đều là bản scan (PDF không có chữ). Báo cáo kho là ảnh chụp Excel, chữ in, có ô gộp ("Grand Marine", "21/08/2026", "4kg/BL x 5/CTN" trải 3 cột).

**Các hàng của một mẫu** (giữ nguyên nhãn của kho):
- **Đầu mẫu:** ngày báo cáo · STT mẫu · size · nhà xuất khẩu · ngày nhập · packing · ngày sản xuất · ngày hết hạn.
- **Cân:** GW (gr) · NW (gr) · thiếu net (%).
- **Cảm quan:** màu · nám · mùi (chữ: "Đạt", "Hơi sẫm"…) · rêu (%).
- **Loại:** 1 da · 2 da · Mada (%).
- **Phân bố size (gr/pc, %):** <30gr · 30/50 · 50/70 · 70/100 · 100/150 · 150/200 · 200/300 · 300/up.
- **Định mức:** XĐ · SC · chần · cắt · phụ trội 3% · **ĐM NL – TP**.

Ô trống là "không có", khác với 0. Hàng lạ của kho (mẫu đổi khuôn) vẫn được giữ, ghi theo nhãn.

**Nghiệp vụ mới NI11 — Lưu kiểm mẫu của kho cho một lần nhập (invoice) · owner U1**
- **Start:** lần nhập đã có (NI4) và Kho đã gửi báo cáo kiểm mẫu.
- **Input:** file Excel gốc của báo cáo (đọc tự động) **hoặc** ảnh chụp (chỉ đính kèm, số nhập tay — Q1) · lần nhập đang mở hồ sơ.
- **Steps:**
  1. U1 đính file báo cáo vào lần nhập.
  2. File Excel: S1 đọc ra bảng mẫu (mỗi cột một mẫu; ô gộp chép sang từng cột; số theo kiểu Việt "5,0%", "1,05"). Ảnh: S1 không đọc; U1 thêm cột mẫu và gõ số nhìn theo ảnh.
  3. S1 **chọn sẵn** các cột thuộc lần nhập này: nhà XK khớp NCC của HĐ (tên, tên đầy đủ, hoặc chữ viết tắt / tiền tố số invoice) **và** ngày nhập khớp ngày về kho (nếu có). Mỗi cột gợi ý dòng hàng HĐ theo size, khớp khi tên hàng chứa đúng size đó.
  4. U1 soát bảng: bỏ hoặc chọn cột, sửa ô đọc sai, chọn dòng hàng cho cột chưa khớp.
  5. U1 lưu.
- **Output:** các mẫu đã lưu gắn với lần nhập (và qua đó với HĐ), mỗi mẫu trỏ dòng hàng (có thể trống). File báo cáo đính kèm lần nhập. Hồ sơ HĐ hiện bảng kiểm mẫu đúng khuôn của kho (hàng = chỉ số, cột = mẫu).
- **End:** lưu xong. Hoặc hủy, khi đó không lưu gì; file đã tải lên bị gỡ.
- **Sửa / xóa:** sửa từng ô sau khi lưu; xóa mẫu có xác nhận và Hoàn tác. Nạp lại cùng báo cáo thì hỏi **thay** các mẫu cũ của file đó, không cộng đôi.

**Luật v4:**
- **R23 — Chỉ lưu, không tính.** App không tính lại thiếu net, định mức, tổng %, và không so với thực nhập. Giá trị đọc được lưu đúng như báo cáo, người dùng sửa được. **Không** chỉ số nào chặn đóng HĐ hay đổi trạng thái lô (R6 giữ nguyên).
- **R24 — Đọc file (Q1: chỉ Excel).** Excel (.xlsx / .xls): đọc theo nhãn hàng ở cột đầu, không theo số dòng. Ô gộp chép sang mọi cột của vùng gộp. Ô số không đọc được thì để trống và đánh dấu cần soát, không đoán. Kết quả luôn qua bước soát trước khi lưu. **Ảnh / PDF:** chỉ đính kèm, không đọc; U1 nhập tay theo cùng khuôn chỉ số.
- **R25 — Gắn invoice.** Mẫu thuộc **một lần nhập**. Dòng hàng HĐ là tùy chọn (gợi ý theo size). Thông tin "nhà XK", "ngày nhập", "packing" lưu như chữ của kho, **không** ghi đè NCC, ngày về kho hay packing của hồ sơ.
- **R26 — Quyền:** theo `import-plans` (xem / thêm / sửa / xóa như chứng từ). Thủ kho: xem câu hỏi Q3. Báo cáo không có giá ⇒ không cần ẩn với người không có `view-price`.
- **R14 (bổ sung)** — bảng mới vào bộ demo; mẫu demo lấy số tự đặt, không chép báo cáo thật.

**Cross-user v4:** Kho → Phòng KH là bàn giao **ngoài app** (Zalo / email file Excel), như hiện nay. Trong app chỉ U1 làm NI11, trừ khi Q3 chọn cho thủ kho tự đính.

**Hướng làm (chờ duyệt):**
- **Dữ liệu:** bảng mới `import_sample_checks`, mỗi dòng một mẫu:
  - Trỏ tới: lần nhập · dòng hàng (tùy chọn) · file báo cáo (`import_files`).
  - Thông tin báo cáo: mã đợt đọc (để nạp lại thì thay đúng nhóm) · ngày báo cáo · STT mẫu.
  - Chữ như trên báo cáo: size · nhà XK · ngày nhập · packing · ngày SX · ngày HH.
  - Chỉ số chính, mỗi chỉ số một cột số: GW · NW · thiếu net · rêu · 1 da · 2 da · Mada · 6 định mức.
  - Cảm quan (chữ): màu · nám · mùi.
  - Phân bố size (`jsonb` theo nhãn khoảng).
  - Hàng lạ (`jsonb`).
  - Ghi chú.
  - Lý do để chỉ số chính thành cột số: sau này lọc / so ĐM NL–TP theo nhà XK được.
  - Mig `0085`: chỉ thêm bảng + RLS theo `has_export_permission('import-plans', …)`, không đổi ma trận quyền (trừ khi Q3 cấp thủ kho).
- **Đọc Excel:** dùng thư viện `xlsx` sẵn có (như đọc Commercial Invoice của Xuất khẩu). Hàm thuần có test: nhận diện nhãn, ô gộp, số kiểu Việt, ô trống.
- **Ảnh:** không đọc (Q1). Đính kèm như file báo cáo, bảng soát mở trống để nhập tay. Muốn đọc ảnh về sau thì đi đường `lib/ocrCloud.ts` → Edge Function (đã có ở Nhập hàng), không cần đổi bảng.
- **Màn:** khối "Kiểm mẫu của kho" trong mỗi lần nhập ở hồ sơ HĐ (cạnh Chứng từ / Thực nhập). Chi tiết giao diện để design-spec 46 v4.

**AC v4 (nháp):** AC-35 … AC-41 ở §10.

**Đã chốt (chủ dự án 2026-10-29):**

| # | Câu | Trả lời |
|---|---|---|
| Q1 | Đọc ảnh bằng gì | **Chỉ đọc Excel**; ảnh chỉ đính kèm, số nhập tay |
| Q2 | Mẫu gắn vào đâu | **Lần nhập (= invoice)**, cột tự gợi ý dòng hàng HĐ theo size |
| Q3 | Ai được đính báo cáo | **Phòng Kế hoạch** (không đổi ma trận quyền) |
| Q4 | Nạp lại báo cáo đã sửa | **Hỏi rồi thay** các mẫu cũ của cùng đợt đọc, có Hoàn tác |

**Ngoài phạm vi v4:** đọc chính invoice scan (số invoice, size, kg, giá) để tự điền lần nhập; so định mức kho với Cân đối; cảnh báo chỉ số xấu.

## 1. Vấn đề & JTBD

- **Job:** Mỗi lần hàng nhập khẩu về (nguyên liệu gia công, sản xuất xuất khẩu hoặc kinh doanh), **nhân viên Phòng Kế hoạch** muốn biết hợp đồng nào đã về bao nhiêu, lô nào còn thiếu giấy gì, để bộ hồ sơ hải quan đủ và không phải lục giấy khi kiểm tra hay quyết toán.
- **Vì sao làm bây giờ:** Xuất khẩu đã chạy trên app; Nhập khẩu vẫn kẹp giấy. Sổ kho tháng có nhóm "NL nhập khẩu" nhưng không biết lô nào thuộc hợp đồng nào, tờ khai nào.
- **Đo thành công bằng:** mọi lô nhập về kho từ tháng 11/2026 có trên app kèm đủ 3 chứng từ bắt buộc (§8).

**Phạm vi đợt 1 = chỗ chứa + trạng thái.** Không thanh toán, không duyệt, không hạn, không dung sai, không tự ghi sổ kho.

## 2. User registry

| User | Vai trò trong app | Là ai | Bối cảnh |
|---|---|---|---|
| **U1 Nhân viên Kế hoạch** | `planner`, `planning-head`, `planning-deputy` | lập HĐ nhập, ghi lần nhập, đính chứng từ, tự làm thủ tục hải quan + kiểm dịch, đóng HĐ | desktop văn phòng |
| **U4 Thủ kho** | `warehouse-keeper` | ghi số lượng thực nhập khi hàng về kho (theo invoice, không cân lại) | điện thoại / máy kho |
| **U2 Ban giám đốc** | `director`, `vice-director` | chỉ xem | desktop / điện thoại |
| **U3 Kế toán** | `chief-accountant`, `accountant` | chỉ xem (cần tờ khai + invoice khi quyết toán) | desktop |
| **U5 Quản trị** | `admin` | cấp quyền `import-plans` | desktop |
| **S1 Hệ thống** | — | tính tổng HĐ, tháng của lần nhập, chứng từ còn thiếu, còn lại chưa về | nền |

> Ngoài app: đối tác nước ngoài (bên bán hoặc bên thuê gia công), hải quan, cơ quan kiểm dịch. Không actor nào trong số này đăng nhập app.

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NI1 | Cấp quyền Nhập khẩu | U5 | U1, U4 (người được cấp) | — | 1 lần / người | Must |
| NI10 | Quản lý danh mục NCC nhập khẩu (v2) | U1 | U2, U3 (xem) | — | khi có NCC mới | Must |
| NI2 | Lập hợp đồng nhập | U1 | — | NI10 | vài / tháng | Must |
| NI3 | Sửa hợp đồng nhập | U1 | — | NI2 | thỉnh thoảng | Must |
| NI4 | Ghi lần nhập | U1 | U4 (nhận việc ghi thực nhập) | NI2 | mỗi lô | Must |
| NI5 | Đính bộ chứng từ của lần nhập | U1 | — | NI4 | mỗi lô | Must |
| NI6 | Ghi số lượng thực nhập | U4 (U1 ghi thay được) | U1 | NI4 | mỗi lô | Must |
| NI7 | Theo dõi tháng + tra số | U1 | U2, U3 (xem) | NI4 | hằng ngày | Must |
| NI8 | Đóng / mở lại hợp đồng | U1 | — | NI6 | mỗi HĐ | Must |
| NI9 | Hủy / xóa HĐ hoặc lần nhập | U1 | — | NI2 / NI4 | hiếm | Must |

## 4. Cross-user handoff

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Khi không ai nhận |
|---|---|---|---|---|---|
| H1 | NI1 → mọi NI | U5 cấp quyền | U1 / U4 | người dùng có quyền `import-plans` (U1) hoặc `import-plans.receiving` (U4) | không thấy mảng Nhập khẩu; không treo dữ liệu |
| H2 | NI4 → NI6 | U1 ghi lần nhập | U4 ghi thực nhập | lần nhập chưa hủy, HĐ chưa đóng | lần nhập đứng ở "Chờ thực nhập", hiện ở tháng của nó; **U1 ghi thay được** |
| H3 | NI6 → NI8 | S1 tính còn lại | U1 đóng HĐ | — | HĐ đứng ở "Đang nhập", hiện "còn X kg chưa về" |

Chỉ một bàn giao giữa người với người (H2), có người ghi thay. Không có bàn giao nào chờ duyệt.

## 5. Flows

### Flow NI1 — Cấp quyền · owner U5
- **Input:** tài khoản, quyền `import-plans` hoặc `import-plans.receiving` (ma trận mặc định R9).
- **Output:** lần đăng nhập kế tiếp mở được `/planning-import` theo đúng quyền.

### Flow NI10 — Quản lý danh mục NCC nhập khẩu · owner U1 (v2)
- **Start:** có NCC nước ngoài mới (hoặc bên thuê gia công mới), hoặc cần sửa thông tin NCC.
- **Input:** các trường R16 (chỉ tên gọi tắt bắt buộc). Thêm từ danh mục (tab NCC nhập khẩu) hoặc ngay trong ô đối tác của HĐ nhập (gõ tên ⇒ thêm mới; sửa nhanh bằng bút chì).
- **Output:** NCC có trong danh mục, chọn được ở HĐ nhập mới. Không xuất hiện ở danh sách Đại lý của Nhập hàng.
- **Ngừng / xóa:** theo R17.
- **End:** HĐ lập sau chọn được NCC; HĐ đã lưu giữ tên đã chép.

### Flow NI2 — Lập hợp đồng nhập · owner U1
- **Start:** đã ký HĐ với đối tác nước ngoài.
- **Input bắt buộc:** đối tác · số HĐ · ngày ký · **loại hình** (sản xuất xuất khẩu · kinh doanh · gia công) · ≥ 1 dòng hàng.
- **Dòng hàng:** **tên hàng** (bắt buộc, chữ như trên HĐ) · **số lượng kg** (bắt buộc, > 0) · **đơn giá** (không bắt — HĐ gia công có thể không ghi giá) · thành tiền (= kg × đơn giá, R2).
- **Input khác:** tiền tệ (mặc định USD) · file HĐ đã ký · ghi chú.
- **Output:** HĐ trạng thái **"Chưa có lần nhập"**; tổng kg, tổng tiền tính sẵn.
- **End:** HĐ có trong danh sách HĐ nhập, tra được theo số HĐ.

### Flow NI3 — Sửa hợp đồng nhập · owner U1
- **Input:** mọi trường của NI2.
- **Output:** HĐ đổi ngay (sửa thẳng, không bản sửa — "ngắn gọn"). Thay đổi vào nhật ký chung.
- **Chặn:** xóa dòng hàng đã có thực nhập (R8). HĐ đã đóng ⇒ phải mở lại trước.

### Flow NI4 — Ghi lần nhập · owner U1
- **Start:** HĐ chưa đóng, chưa hủy; đối tác báo hàng sắp đi hoặc hàng đã về.
- **Input:** HĐ · **ngày về kho** hoặc **ngày dự kiến về** (ít nhất một, R1) · cách vận chuyển (cont lạnh 20 · cont lạnh 40 · hàng lẻ ghép cont, R12) · số cont (không bắt) · số B/L (không bắt) · ghi chú.
- **Output:** lần nhập thuộc HĐ, tháng theo R1; sinh sẵn 3 mục chứng từ bắt buộc (R4) ở trạng thái thiếu; trạng thái **"Thiếu chứng từ"**. HĐ sang **"Đang nhập"**.
- **End:** lần nhập hiện ở đúng tháng, dưới đúng đối tác.

### Flow NI5 — Đính bộ chứng từ · owner U1
- **Input mỗi chứng từ:** loại · số · ngày · file (một hoặc nhiều).
  - Loại bắt buộc: **Commercial Invoice**, **Packing List**, **Tờ khai nhập khẩu** (thêm loại hình, mặc định theo HĐ).
  - Loại "nếu có": **C/O**, **Giấy kiểm dịch**, **B/L**, **Khác** (tự đặt tên, VD L/C, giấy ATTP).
- **Output:** mục có đủ bằng chứng (R4) ⇒ "Đã có". Đủ 3 mục bắt buộc ⇒ lần nhập hết "Thiếu chứng từ".
- **Ngoại lệ:** mục bắt buộc không có thật ⇒ "Không áp dụng" + lý do (R4).
- **End:** trạng thái lần nhập cập nhật ngay (R6).

### Flow NI6 — Ghi số lượng thực nhập · owner U4
- **Start:** hàng đã về kho; lần nhập chưa hủy, HĐ chưa đóng.
- **Input:** **kg thực nhập cho từng dòng hàng của HĐ** (theo invoice, không cân lại — câu 7). Dòng không có trong lô này để trống.
- **Output:** lần nhập có thực nhập; HĐ cập nhật "đã về X / Y kg" từng dòng và cả HĐ (R5). Vượt kg HĐ ⇒ cảnh báo, vẫn lưu.
- **U4 không** sửa HĐ, lần nhập (kể cả ngày về kho — U1 ghi) hay chứng từ; **không** thấy đơn giá, thành tiền (R9).
- **End:** lần nhập sang "Đủ hồ sơ" nếu chứng từ đã đủ (R6).

### Flow NI7 — Theo dõi tháng + tra số · owner U1
- **Input:** tháng (R1) · lọc đối tác (không bắt) · ô tra theo **số HĐ / số invoice / số tờ khai / số cont / số B/L** — tra mọi tháng.
- **Output:** lần nhập của tháng gom theo đối tác, mỗi lần có trạng thái R6 + chứng từ còn thiếu; 3 con số: số lần nhập · đủ hồ sơ · còn thiếu (thiếu chứng từ hoặc chờ thực nhập). HĐ đang nhập hiện "còn X kg chưa về". Xuất Excel đúng bảng đang xem (Should).
- **End:** trả lời được "lô X còn thiếu gì" mà không mở giấy.

### Flow NI8 — Đóng / mở lại HĐ · owner U1
- **Start:** HĐ "Đang nhập", có ≥ 1 lần nhập chưa hủy.
- **Input:** lý do — **bắt buộc khi còn dòng hàng chưa về đủ** (còn lại > 0, R5); không bắt khi mọi dòng đã đủ.
- **Output:** HĐ **"Đã đóng"**; không ghi lần nhập mới. Mở lại ⇒ về "Đang nhập".
- Không cần ai duyệt (câu 11). Không tự đóng (§6).

### Flow NI9 — Hủy / xóa · owner U1
- **Lần nhập:** xóa được khi chưa có file chứng từ nào và chưa có thực nhập; còn lại ⇒ **hủy** + lý do. Lần nhập hủy không tính vào tháng, còn lại, đủ hồ sơ. Khôi phục được khi HĐ chưa đóng.
- **HĐ:** xóa được khi chưa có lần nhập; còn lại ⇒ hủy + lý do, kéo theo hủy mọi lần nhập của HĐ cùng lý do.
- Mọi xóa có xác nhận + **Hoàn tác** (luật repo 6).

## 6. Flow optimization log

> Chạy tuần tự bởi BA-Orchestrator (9 nghiệp vụ nhỏ, 1 bàn giao, phần chuyên môn đã có chủ dự án trả lời) — không lập team riêng.

| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict |
|---|---|---|---|---|---|
| Trục | A. HĐ = 1 lô · B. HĐ 1..n lần nhập, chứng từ gắn lần nhập | **B** | Câu 1 "tùy HĐ"; invoice + tờ khai ra theo từng lô | Chủ dự án | — |
| Bước | A. Khung XK bỏ lệnh SX + bao bì (6 → 4 bước) · B. 5 bước có thông quan + thanh toán · C. HĐ → chứng từ → thực nhập | **C** | Đúng phạm vi chủ dự án nêu; A, B thừa bước (rubric #5), câu 2/4 bỏ thanh toán + thông quan | Chủ dự án + Optimizer | Trang chốt trước đề xuất B — chủ dự án chọn gọn hơn |
| NI5 chứng từ bắt buộc | A. Tự do, không bắt loại nào · B. 3 bắt buộc + "nếu có" · C. Bắt cả 5 loại | **B** | A làm "đủ hồ sơ" vô nghĩa (rubric #2); C sai thực tế ("kiểm dịch nếu có") | Optimizer | Bộ 3 là giả định A3 |
| NI6 thực nhập | A. Một số kg cho cả lô · B. Kg theo từng dòng hàng HĐ · C. Tự lấy từ invoice | **B** | A không biết tên hàng nào còn thiếu khi HĐ nhiều dòng; C cần đọc invoice của từng NCC (mỗi nơi một mẫu) — để sau | Optimizer | — |
| NI8 đóng HĐ | A. Tự đóng khi Σ thực nhập ≥ HĐ · B. U1 đóng tay, bắt lý do khi còn thiếu | **B** | Không dung sai (câu 13) ⇒ về 99,8% là A không bao giờ đóng; B có điểm kết rõ (rubric #3) | Optimizer | — |
| NI3 sửa HĐ | A. Bản sửa như XK · B. Sửa thẳng + nhật ký | **B** | Không duyệt (câu 11) ⇒ bản sửa không có ai xét; nhật ký chung đủ để tra | Optimizer | Có phụ kiện HĐ thì đính file "Khác" |
| Vượt HĐ | A. Chặn · B. Cảnh báo, vẫn lưu | **B** | Thực nhập theo invoice là số thật đã về; chặn làm sổ sai | Optimizer | — |

## 7. Scope & Priority

- **IN (đợt 1):** NI1–NI9.
- **OUT (đợt sau, khi chủ dự án yêu cầu):** thanh toán / L/C có cấu trúc · duyệt · hạn giao + trễ · dung sai · nhắc hạn trả cont, lưu bãi · đọc invoice tự động · ảnh nhận hàng · tự ghi Sổ kho tháng / Nhập hàng / Cân đối (R11) · thanh khoản tờ khai SXXK / gia công · tính thuế.
- **Đi kèm khi build (luật repo):** tour + hộp "?" (QT 18) · nháp form (QT 17) · tô màu dòng + sắp cột (QT 12, 19) · ô danh mục có thêm mới + bút chì (QT 7) · bộ demo (QT 15).

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NI4 / NI5 | lô nhập về kho từ 01/11/2026 có trên app với đủ 3 chứng từ bắt buộc (so với tờ khai nhập của tháng) | 100% |
| NI6 | lô đã về kho > 2 ngày mà chưa có thực nhập | 0 |
| NI2 | thời gian lập 1 HĐ 5 dòng | ≤ 5 phút |
| NI7 | trả lời "lô X còn thiếu gì" khi biết số tờ khai / số cont | ≤ 1 phút |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Tháng của lần nhập = tháng(ngày về kho) ?? tháng(ngày dự kiến về). Thiếu cả hai ⇒ không lưu | dự kiến 28/10, về thật 02/11 ⇒ tháng 11 |
| R2 | Thành tiền dòng = kg × đơn giá, làm tròn 2 số lẻ; đơn giá trống ⇒ thành tiền trống. Tổng kg = Σ kg mọi dòng; tổng tiền = Σ thành tiền các dòng có giá. Số chép từ chứng từ tiếng Anh hiểu theo R22 của [41](41-export-planning.ba-spec.md) | HĐ gia công không ghi giá ⇒ tổng tiền trống, HĐ vẫn lưu |
| R3 | Số HĐ duy nhất theo đối tác (không phân hoa thường, bỏ khoảng trắng đầu / cuối) | " ab-01 " trùng "AB-01" cùng đối tác ⇒ chặn |
| R4 | **Chứng từ.** Bắt buộc mỗi lần nhập: Commercial Invoice · Packing List · Tờ khai nhập khẩu. Một mục **"Đã có"** khi có ≥ 1 file; tờ khai còn bắt **số tờ khai + loại hình**. Mục bắt buộc được **"Không áp dụng"** khi có lý do. C/O · Giấy kiểm dịch · B/L · Khác: thêm khi có, không bắt, xóa được (hỏi lại + Hoàn tác); mục bắt buộc không xóa được | lô hàng mẫu không có invoice thương mại ⇒ "Không áp dụng: hàng mẫu" |
| R5 | **Thực nhập** ghi theo dòng hàng HĐ, kg ≥ 0, theo invoice. Còn lại dòng = kg HĐ − Σ thực nhập của dòng ở các lần nhập chưa hủy. Còn lại < 0 ⇒ cảnh báo "vượt HĐ x kg", **không chặn** | HĐ 10.000 kg, hai lô 6.000 + 4.200 ⇒ còn lại −200, "vượt HĐ 200 kg" |
| R6 | **Trạng thái lần nhập:** thiếu ≥ 1 mục bắt buộc ⇒ "Thiếu chứng từ" (kèm tên mục thiếu); đủ mà chưa dòng nào có thực nhập > 0 ⇒ "Chờ thực nhập"; đủ + có thực nhập ⇒ **"Đủ hồ sơ"**; "Đã hủy". **Trạng thái HĐ:** "Chưa có lần nhập" · "Đang nhập" · "Đã đóng" · "Đã hủy" | thiếu cả chứng từ lẫn thực nhập ⇒ "Thiếu chứng từ" |
| R7 | Đóng HĐ: U1, cần ≥ 1 lần nhập chưa hủy; **mọi dòng đã nối mặt hàng (v3 R20)**; còn dòng có còn lại > 0 ⇒ bắt lý do. HĐ đã đóng / đã hủy ⇒ không ghi lần nhập mới, không ghi thực nhập | — |
| R8 | Dòng hàng đã có thực nhập > 0 ở lần nhập chưa hủy ⇒ không xóa được (sửa tên / kg / giá vẫn được) | — |
| R9 | **Quyền** (tài nguyên MỚI, mặc định cấm; không đổi `export-plans`) — bảng dưới. U4 đọc được đầu HĐ, tên hàng, kg HĐ, đầu lần nhập; **không** đọc đơn giá, thành tiền, file chứng từ | — |
| R10 | **Không có trong đợt 1** (chủ dự án 2026-10-29): thanh toán, duyệt, hạn giao, trễ, dung sai, ngưỡng thiếu hàng, ảnh nhận hàng, nhắc trả cont / lưu bãi | — |
| R11 | Ghi Nhập khẩu **không** đổi bảng Xuất khẩu, Nhập hàng, Sổ kho tháng, Cân đối (tránh cộng đôi nhóm "NL nhập khẩu" của sổ kho tháng) | — |
| R12 | Cách vận chuyển: cont lạnh 20 · cont lạnh 40 · hàng lẻ ghép cont | hàng lẻ không bắt số cont |
| R13 | File: tối đa 20 MB / file; PDF, ảnh, Word, Excel; kho file riêng của Phòng Kế hoạch, chỉ người có `import-plans` đọc được | — |
| R14 | Chế độ demo: mọi bảng mới vào bộ demo; thao tác demo không đổi số thật (luật repo 15) | — |
| R15 | ~~Đối tác chọn từ danh mục Đại lý (`suppliers`) + cột quốc gia~~ — **thay bằng R15 v2 (§0b): danh mục NCC nhập khẩu riêng** | — |
| R20–R22 | **Dòng hàng nối mặt hàng danh mục** (v3, §0c): nối không bắt lúc lập, bắt trước đóng HĐ; gợi ý lịch sử → tên tiếng Anh → tên mặt hàng; máy chủ chưa chạy 0084 ⇒ không gửi, không bắt | HĐ PM-GC-2026/07 dòng "Frozen whole octopus 1-2 kg" ⇒ mặt hàng Bạch tuộc nguyên con |

**R9 — ma trận quyền mặc định:**

| Vai trò | `import-plans` (HĐ, lần nhập, chứng từ, file) | `import-plans.receiving` (thực nhập) |
|---|---|---|
| `planner` | view · create · update · delete · export · view-price | view · create · update |
| `planning-head`, `planning-deputy` | như `planner` | như `planner` |
| `director`, `vice-director` | view · export · view-price | view |
| `chief-accountant`, `accountant` | view · export · view-price | view |
| `warehouse-keeper` | — | view · create · update |
| còn lại | — | — |

## 10. Acceptance Criteria

### AC-1 — Không có quyền thì không vào được Nhập khẩu · Maps to: NI1 · Test: integration
- **Given** tài khoản vai trò `qc` (không có `import-plans` lẫn `.receiving`)
- **When** mở `/planning-import` và đọc bảng hợp đồng nhập qua máy chủ
- **Then** bị chuyển về trang chủ; máy chủ trả rỗng
- **Assert** `canView("import-plans") == false`; số dòng đọc được `== 0`

### AC-2 — Thủ kho chỉ ghi thực nhập, không thấy giá · Maps to: NI6, R9 · Test: integration
- **Given** HĐ 2 dòng có đơn giá, một lần nhập; tài khoản `warehouse-keeper`
- **When** đọc HĐ, ghi thực nhập, rồi thử sửa lần nhập và thêm chứng từ
- **Then** đọc được tên hàng + kg; ghi thực nhập thành công; sửa lần nhập / thêm chứng từ bị từ chối
- **Assert** số trường tiền (đơn giá, thành tiền, tổng tiền) đọc được `== 0`; ghi thực nhập `ok == true`; 2 lần ghi còn lại `rejected == 2`

### AC-3 — Tổng hợp đồng · Maps to: NI2, R2 · Test: unit
- **Given** dòng 1: 10.000 kg × 2,5 USD; dòng 2: 5.000 kg × 3 USD
- **When** tính tổng
- **Then** ra tổng kg và tổng tiền
- **Assert** `totalKg == 15000`; `totalAmount == 40000`

### AC-4 — HĐ gia công không ghi giá vẫn lưu · Maps to: NI2, R2 · Test: unit
- **Given** dòng 1: 8.000 kg, đơn giá trống; dòng 2: 2.000 kg × 1,25
- **When** kiểm và tính tổng
- **Then** không lỗi; thành tiền dòng 1 trống
- **Assert** `validate(...).length == 0`; `lineAmount(dòng 1) == null`; `totalAmount == 2500`; `totalKg == 10000`

### AC-5 — Thiếu trường bắt buộc hoặc trùng số HĐ bị chặn · Maps to: NI2, R3 · Test: unit
- **Given** (a) HĐ thiếu loại hình; (b) HĐ 0 dòng; (c) dòng kg = 0; (d) HĐ số " ab-01 " khi đối tác đã có "AB-01"
- **When** kiểm HĐ
- **Then** mỗi ca ra đúng một lỗi
- **Assert** mã lỗi lần lượt `== "import-type"`, `"no-lines"`, `"line-kg"`, `"duplicate-no"`

### AC-6 — Tháng của lần nhập · Maps to: NI4, R1 · Test: unit
- **Given** (a) ngày về kho 02/11/2026, dự kiến 28/10/2026; (b) chỉ dự kiến 28/10/2026; (c) không có ngày nào
- **When** tính tháng và kiểm lần nhập
- **Then** (a) tháng 11; (b) tháng 10; (c) bị chặn
- **Assert** `importMonth(a) == "2026-11"`; `importMonth(b) == "2026-10"`; lỗi (c) `== "no-date"`

### AC-7 — Lần nhập mới thiếu đúng 3 chứng từ bắt buộc · Maps to: NI4, R4, R6 · Test: unit
- **Given** HĐ "Chưa có lần nhập"
- **When** ghi lần nhập đầu tiên
- **Then** lần nhập "Thiếu chứng từ", HĐ "Đang nhập"
- **Assert** `missingDocs == ["commercial-invoice", "packing-list", "import-declaration"]`; `receiptState == "missing-docs"`; `contractState == "receiving"`

### AC-8 — Mục chứng từ chỉ "Đã có" khi có bằng chứng · Maps to: NI5, R4 · Test: unit
- **Given** (a) Invoice có số + ngày, 0 file; (b) Invoice 1 file; (c) tờ khai 1 file, thiếu loại hình; (d) tờ khai 1 file + số + loại hình
- **When** tính trạng thái mục
- **Then** chỉ (b), (d) là "Đã có"
- **Assert** `hasDoc` lần lượt `== [false, true, false, true]`

### AC-9 — "Không áp dụng" phải có lý do · Maps to: NI5, R4 · Test: unit
- **Given** mục Commercial Invoice bắt buộc, chưa có file
- **When** đánh "Không áp dụng" với lý do trống, rồi với lý do "hàng mẫu"
- **Then** lần 1 bị chặn; lần 2 mục không còn bị tính thiếu
- **Assert** lần 1 `ok == false`; lần 2 `missingDocs` không chứa `"commercial-invoice"`

### AC-10 — C/O và kiểm dịch không bắt · Maps to: NI5, R4 · Test: unit
- **Given** lần nhập có đủ Invoice, Packing List, tờ khai (đủ số + loại hình); không có C/O, kiểm dịch, B/L
- **When** tính chứng từ còn thiếu
- **Then** không thiếu gì
- **Assert** `missingDocs.length == 0`

### AC-11 — Chờ thực nhập rồi Đủ hồ sơ · Maps to: NI6, R6 · Test: unit
- **Given** lần nhập đủ 3 chứng từ, chưa có thực nhập
- **When** tính trạng thái; rồi ghi thực nhập 6.000 kg cho dòng 1
- **Then** trước: "Chờ thực nhập"; sau: "Đủ hồ sơ"
- **Assert** `receiptState` trước `== "awaiting-quantity"`, sau `== "complete"`

### AC-12 — Còn lại theo dòng, vượt HĐ chỉ cảnh báo · Maps to: NI6, R5 · Test: unit
- **Given** dòng HĐ 10.000 kg; lần nhập 1 ghi 6.000 kg; lần nhập 2 ghi 4.200 kg
- **When** tính còn lại và kiểm lần ghi thứ 2
- **Then** còn lại âm, có cảnh báo, vẫn lưu
- **Assert** `remainingKg == -200`; cảnh báo `== "over-contract"` với `overKg == 200`; `blocking == false`

### AC-13 — Lần nhập đã hủy không tính · Maps to: NI9, R5, R6 · Test: unit
- **Given** dòng HĐ 10.000 kg; lần nhập 1 ghi 6.000 kg (chưa hủy); lần nhập 2 ghi 4.000 kg (đã hủy)
- **When** tính còn lại và đếm của tháng
- **Then** lần 2 không vào còn lại, không vào số lần nhập của tháng
- **Assert** `remainingKg == 4000`; số lần nhập của tháng `== 1`

### AC-14 — Đóng HĐ còn thiếu phải có lý do; đóng rồi không ghi thêm · Maps to: NI8, R7 · Test: unit
- **Given** HĐ 2 dòng; dòng 1 về đủ, dòng 2 còn lại 500 kg
- **When** (a) đóng không lý do; (b) đóng với lý do "đối tác giao thiếu"; (c) ghi lần nhập mới vào HĐ đã đóng; (d) mở lại
- **Then** (a) chặn; (b) "Đã đóng"; (c) chặn; (d) "Đang nhập"
- **Assert** (a) `needsReason == true`, `ok == false`; (b) `contractState == "closed"`; (c) lỗi `== "contract-closed"`; (d) `contractState == "receiving"`

### AC-15 — HĐ về đủ mọi dòng đóng không cần lý do · Maps to: NI8, R7 · Test: unit
- **Given** HĐ 2 dòng, mọi dòng còn lại ≤ 0
- **When** kiểm điều kiện đóng
- **Then** đóng được, không bắt lý do
- **Assert** `closeGate == { ok: true, needsReason: false }`

### AC-16 — Không xóa dòng hàng đã có thực nhập · Maps to: NI3, R8 · Test: unit
- **Given** dòng 2 có thực nhập 1.000 kg ở lần nhập chưa hủy
- **When** lưu HĐ đã bỏ dòng 2
- **Then** bị chặn; sửa kg dòng 2 thì lưu được
- **Assert** lỗi `== "line-has-receipts"`; lần sửa kg `validate(...).length == 0`

### AC-17 — Tra theo số giấy tờ ở mọi tháng · Maps to: NI7 · Test: unit
- **Given** lần nhập tháng 09 có tờ khai "105123456789", invoice "INV-77", số cont "ABCU1234567"; HĐ "AB-01" chưa có lần nhập
- **When** tra từng số khi đang xem tháng 11
- **Then** ra đúng lần nhập / HĐ
- **Assert** mỗi lần tra 3 số đầu `results.length == 1` và trỏ đúng lần nhập; tra "ab-01" ra đúng HĐ (`results.length == 1`)

### AC-18 — Tháng gom theo đối tác + 3 con số · Maps to: NI7, R6 · Test: unit
- **Given** tháng 11: đối tác A có 2 lần nhập (1 đủ hồ sơ, 1 thiếu chứng từ), đối tác B 1 lần nhập chờ thực nhập; 1 lần nhập đã hủy
- **When** dựng tháng 11
- **Then** 2 nhóm đối tác; 3 con số
- **Assert** `groups.length == 2`; `{ total: 3, complete: 1, incomplete: 2 }`

### AC-19 — Không đụng sổ khác · Maps to: R11 · Test: integration
- **Given** đếm số dòng các bảng Xuất khẩu, Nhập hàng, Sổ kho tháng, Cân đối
- **When** lập 1 HĐ nhập, ghi 1 lần nhập, đính 3 chứng từ, ghi thực nhập, đóng HĐ
- **Then** các bảng kia không đổi
- **Assert** số dòng mỗi bảng sau `==` trước

### AC-20 — Form tự lưu nháp · Maps to: NI2, NI4, NI6 · Test: e2e
- **Given** đang lập HĐ nhập, đã gõ 2 dòng hàng, chưa lưu
- **When** sang trang khác rồi quay lại; sau đó lưu
- **Then** nháp còn nguyên; lưu xong nháp hết
- **Assert** số dòng hàng khôi phục `== 2`; sau khi lưu số nháp của form `== 0`

### AC-21 — Xóa, hủy và Hoàn tác · Maps to: NI9 · Test: e2e
- **Given** (a) lần nhập chưa có file, chưa thực nhập; (b) lần nhập đã có 1 file
- **When** (a) xóa rồi Hoàn tác; (b) xóa
- **Then** (a) xóa được, Hoàn tác đưa về; (b) chỉ hủy được, bắt lý do
- **Assert** (a) số lần nhập của HĐ sau xóa `== n − 1`, sau Hoàn tác `== n`; (b) `canDelete == false`, hủy lý do trống `ok == false`

### AC-22 — Demo không chạm số thật · Maps to: R14 · Test: manual (vòng kiểm §4b [spec chế độ demo](../spec/che-do-demo.md), cần DB thật)
- **Given** đếm dòng `site_id <> 'site-demo'` của mọi bảng Nhập khẩu
- **When** bật demo, tạo HĐ + lần nhập + chứng từ + thực nhập, tắt demo
- **Then** số thật không đổi
- **Assert** số dòng thật sau `==` trước

### AC-24 — Hai danh mục tách hẳn · Maps to: NI10, R15 v2 · Test: integration
- **Given** danh mục Đại lý có 2 dòng, danh mục NCC nhập khẩu có 1 dòng "Pacific Marine"
- **When** thêm NCC "Andaman Seafood" ngay trong ô đối tác của HĐ nhập; rồi đọc danh sách chọn đối tác của HĐ nhập và danh sách chọn đại lý của Nhập hàng
- **Then** NCC mới vào danh mục NCC nhập khẩu, không vào Đại lý
- **Assert** số dòng Đại lý `== 2`; số NCC nhập khẩu `== 2`; danh sách chọn của Nhập hàng chứa "Andaman Seafood" `== 0` lần

### AC-25 — Tên gọi tắt bắt buộc và không trùng · Maps to: NI10, R16 · Test: unit
- **Given** danh mục có "Pacific Marine"
- **When** lưu NCC (a) tên trống; (b) tên " pacific marine "; (c) tên "Ocean Fresh", mọi trường khác trống
- **Then** (a), (b) bị chặn; (c) lưu được
- **Assert** mã lỗi (a) `== "name"`, (b) `== "duplicate-name"`; (c) số lỗi `== 0`

### AC-26 — NCC đã có HĐ chỉ ngừng giao dịch, không xóa · Maps to: NI10, R17 · Test: unit
- **Given** NCC A có 1 HĐ nhập đã hủy; NCC B chưa có HĐ
- **When** kiểm xóa A, B; chuyển A sang Ngừng giao dịch rồi lấy danh sách chọn đối tác cho HĐ mới
- **Then** A không xóa được, B xóa được; A không nằm trong danh sách chọn HĐ mới
- **Assert** `canDeleteSupplier(A) == false`; `canDeleteSupplier(B) == true`; danh sách chọn chứa A `== 0` lần; HĐ cũ của A vẫn đọc ra tên A

### AC-27 — 0083 chép đối tác cũ, HĐ không phải sửa · Maps to: R18 · Test: integration (PGlite)
- **Given** DB sau 0082 có HĐ nhập trỏ `supplier_id` vào 1 dòng Đại lý "Pacific Marine" (country "Nhật Bản")
- **When** chạy 0083 hai lần
- **Then** danh mục NCC nhập khẩu có đúng 1 dòng cùng id, tên, quốc gia; dòng Đại lý vẫn còn
- **Assert** `count(import_suppliers where id = <id>) == 1`; `count(suppliers where id = <id>) == 1`; lần chạy thứ 2 không lỗi, không nhân đôi (`== 1`)

### AC-28 — Quyền danh mục NCC nhập khẩu · Maps to: R9 v2, R19 · Test: integration
- **Given** tài khoản planner, accountant, warehouse-keeper
- **When** mỗi tài khoản đọc và thêm một NCC nhập khẩu
- **Then** planner đọc + thêm được; accountant chỉ đọc; thủ kho không đọc
- **Assert** planner thêm `ok == true`; accountant thêm bị từ chối, đọc `>= 1` dòng; thủ kho đọc `== 0` dòng; nhóm Kế hoạch có đúng `1` mục Tra cứu

### AC-29 — Dòng hàng lưu được khi chưa nối · Maps to: NI2, R20 · Test: unit
- **Given** HĐ mới 2 dòng, dòng 1 nối mặt hàng P1, dòng 2 chưa nối
- **When** lưu HĐ
- **Then** HĐ lưu; dòng 2 tính là chưa nối
- **Assert** lỗi kiểm `== 0`; số dòng chưa nối `== 1`; dòng trỏ mặt hàng không còn trong danh mục cũng tính chưa nối (`== 2` khi P1 bị xóa)

### AC-30 — Đóng HĐ bắt mọi dòng đã nối · Maps to: NI8, R7 v3 · Test: unit
- **Given** HĐ có 1 lần nhập về đủ, 1 dòng chưa nối
- **When** đóng HĐ
- **Then** bị chặn, báo dòng chưa nối; nối xong đóng được không cần lý do
- **Assert** `closeGate.ok == false`, `reason == "unlinked-lines"`, `unlinkedLines.length == 1`; sau nối `ok == true`, `needsReason == false`

### AC-31 — Máy chủ chưa chạy 0084 không bắt nối · Maps to: R22 · Test: unit
- **Given** dữ liệu báo máy chủ chưa có cột mặt hàng của dòng
- **When** đóng HĐ có dòng chưa nối
- **Then** không chặn vì nối; dòng gửi lên không có trường mặt hàng
- **Assert** `closeGate.ok == true`; `toRow` của dòng không có khóa `product_id` khi `productId === undefined`

### AC-32 — Gợi ý nối ra đúng một mặt hàng · Maps to: NI2, R21 · Test: unit
- **Given** HĐ nhập trước của NCC A nối "Frozen whole octopus 1-2 kg" → P1; HĐ của NCC B nối cùng tên → P2 (mới hơn); mặt hàng P3 có tên tiếng Anh "Frozen skate wing"
- **When** gợi ý cho dòng "frozen  WHOLE octopus 1-2 kg" của NCC A, dòng "Frozen skate wing", dòng "Hàng lạ"
- **Then** lấy P1 (cùng NCC thắng HĐ mới hơn), P3, không gợi ý
- **Assert** `== "P1"`, `== "P3"`, `== ""`; hai mặt hàng cùng tên tiếng Anh ⇒ `== ""`

### AC-33 — Tra số theo tên hàng / mặt hàng · Maps to: NI7, R20 · Test: unit
- **Given** HĐ có dòng "Frozen skate wing" nối mặt hàng tên "Cá đuối cánh"
- **When** tra "skate" rồi tra "cá đuối"
- **Then** cả hai lần ra HĐ đó
- **Assert** mỗi lần `>= 1` kết quả loại hợp đồng có `contractId` của HĐ

### AC-34 — Nối mặt hàng hiện ở mọi chỗ có tên hàng · Maps to: R20 · Test: manual (preview)
- **Given** HĐ demo 2 dòng, 1 dòng chưa nối
- **When** mở hồ sơ HĐ, hộp Ghi thực nhập, thẻ lần nhập, lập HĐ chọn mặt hàng mới gõ trong ô
- **Then** dòng đã nối hiện tên mặt hàng, dòng chưa nối hiện "Chưa nối"; mặt hàng mới vào danh mục Mặt hàng
- **Assert** số dòng hiện "Chưa nối" `== 1`; danh mục Mặt hàng tăng `1` dòng; 360 px × 130 % không cuộn ngang

### AC-35 — Đọc Excel báo cáo mẫu đủ 5 cột · Maps to: NI11, R24 · Test: unit
- **Given** file Excel khuôn ngày 25/10/2026 (5 mẫu, ô gộp "Grand Marine" 3 cột)
- **When** đọc file
- **Then** ra 5 mẫu, ô gộp chép sang từng cột, số kiểu Việt đổi đúng
- **Assert** số mẫu `== 5`; mẫu 1–3 nhà XK `== "Grand Marine"`; mẫu 3 phân bố 100/150 `== 65`; mẫu 4 màu `== "Hơi sẫm"`; mẫu 5 ĐM NL–TP `== 1.96`; mẫu 1 ô Mada `== null`

### AC-36 — Chọn sẵn đúng cột của invoice · Maps to: NI11, R25 · Test: unit
- **Given** 5 mẫu như AC-35; lần nhập của HĐ NCC "Grand Marine Foods", ngày về kho 21/08/2026, dòng hàng chứa "70/100", "80/100", "100/200", "200/300"
- **When** gợi ý cột
- **Then** chọn 3 cột đầu, mỗi cột gợi ý đúng dòng theo size; lần nhập NCC "International Freezfish Exports" invoice "IFE/21/…" chọn cột 5
- **Assert** cột chọn `== [1,2,3]` và `== [5]`; dòng hàng gợi ý của cột 2 `== dòng "80/100"`; dòng "200/300" có `0` mẫu

### AC-37 — Ô Excel không đọc được để trống, đánh dấu soát · Maps to: NI11, R24 · Test: unit
- **Given** file Excel khuôn trên, ô GW mẫu 1 `= "24300"`, ô thiếu net mẫu 2 `= "abc"`, ô % mẫu 3 `= "105%"`
- **When** đọc file
- **Then** giữ GW, bỏ hai ô sai, đánh dấu cần soát
- **Assert** GW `== 24300`; thiếu net mẫu 2 `== null`; % mẫu 3 `== null`; ô cần soát `== 2`

### AC-38 — Chỉ lưu, không tính, không chặn · Maps to: R23 · Test: unit
- **Given** mẫu có NW 19.000 gr, thiếu net 5,0%, ĐM NL–TP 2,11; lần nhập Đủ hồ sơ
- **When** lưu mẫu, sửa ĐM thành 2,2
- **Then** giá trị lưu đúng như gõ; trạng thái lô và điều kiện đóng HĐ không đổi
- **Assert** ĐM `== 2.2`; thiếu net `== 5`; `receiptState == "complete"` trước và sau; `closeGate` trước == sau

### AC-39 — Nạp lại cùng báo cáo thay, không cộng đôi · Maps to: NI11 · Test: unit
- **Given** lần nhập đã có 3 mẫu từ đợt đọc A
- **When** nạp lại báo cáo đã sửa và chọn thay
- **Then** còn đúng 3 mẫu của đợt mới
- **Assert** số mẫu của lần nhập `== 3`; mẫu của đợt A `== 0`

### AC-40 — Ảnh chỉ đính kèm, mẫu nhập tay · Maps to: R24 (Q1) · Test: manual (preview)
- **Given** lần nhập chưa có mẫu
- **When** đính ảnh chụp báo cáo rồi nhập tay 1 mẫu
- **Then** ảnh lưu cùng lần nhập, app không đọc ảnh, mẫu nhập tay lưu được
- **Assert** số file của lần nhập tăng `1`; số mẫu `== 1`; số ô app tự điền từ ảnh `== 0`

### AC-41 — Quyền xem / ghi kiểm mẫu · Maps to: R26 · Test: integration (PGlite)
- **Given** tài khoản planner, accountant, qc
- **When** đọc và thêm một mẫu
- **Then** planner đọc + thêm; accountant chỉ đọc; qc không đọc
- **Assert** planner thêm `ok == true`; accountant thêm bị từ chối, đọc `>= 1`; qc đọc `== 0`

## 11. Assumptions (Claude quyết, chủ dự án đổi được)

- **A1 — ~~Đối tác lấy từ danh mục Nhà cung cấp (Đại lý)~~ — THAY bởi §0b v2: danh mục NCC nhập khẩu riêng.** Ghi chú cũ giữ để tra: Bên thuê gia công cũng ghi ở danh mục Nhà cung cấp. **Lưu ý khi build:** `toRow` của bảng `suppliers` gửi ĐỦ mọi cột mỗi lần ghi ([32](32-danh-muc.md)) ⇒ cột quốc gia phải chạy migration TRƯỚC khi deploy, hoặc chỉ gửi khi máy chủ đã có cột (như trường khách xuất khẩu của mig 0075) — không thì mọi lần lưu đại lý kẹt hàng chờ.
- **A2 — Quyền riêng** `import-plans` + `import-plans.receiving` (R9), không dùng chung quyền Xuất khẩu ⇒ giao được người chỉ làm Nhập khẩu, không đổi ma trận đang chạy.
- **A3 — Bộ 3 chứng từ bắt buộc** (Invoice, Packing List, tờ khai). C/O, kiểm dịch, B/L không bắt (chủ dự án ghi "kiểm dịch nếu có"). Mục bắt buộc vẫn "Không áp dụng" được (có lý do) để không kẹt lô đặc biệt.
- **A4 — Không nối sổ kho** đợt này (R11). Thực nhập chỉ nằm trong Nhập khẩu.
- **A5 — Nhật ký** dùng nhật ký chung (admin xem ở /audit), không làm bảng nhật ký riêng như Xuất khẩu (R32 của 41).
- **A6 — Loại hình** ghi ở HĐ, tờ khai lấy mặc định theo HĐ và sửa được (một HĐ có thể có lô mở loại hình khác — câu 5 "cả ba").
- **A7 — Route** `/planning-import`, nav nhóm "Kế hoạch" cạnh Xuất khẩu (theo [`spec/xuat-khau-phong-ke-hoach`](../spec/xuat-khau-phong-ke-hoach.md) §4a, đổi tiền tố theo route thật `/planning-export`). Chốt ở design-spec.
- **Tier pha build:** 🟡 — bảng mới + quyền mới, chỉ thêm (migration viết sẵn phần gỡ, chạy hai lần không lỗi). Không ALTER bảng `export_*`, không đổi RLS hay ma trận `export-plans`. Có thể dùng lại hàm thuần của Xuất khẩu (R22 đọc số, khung file) nhưng không đổi hành vi của chúng.

## 12. History

- 2026-10-29 — v1: dựng từ trả lời 14 câu của chủ dự án; phạm vi gọn HĐ → chứng từ → thực nhập.
- 2026-10-29 — v1.1: chủ dự án chốt đối tác lấy từ danh mục Nhà cung cấp (A1, R15), thay danh mục Khách hàng.
- 2026-10-29 — build: `features/import-planning/**`, `lib/importPlanning.ts` (+ test), `lib/importFileStorage.ts` (bucket `import-files`), `lib/importPlanningDemo.ts`, mig `0082`. Thêm khi build: chạy không nối máy chủ ⇒ số chứng từ / ghi chú tính thay file (như Xuất khẩu); thủ kho không sửa ngày về kho (NI6).
- 2026-10-29 tối — v2 ĐÃ BUILD: `import_suppliers` + `catalog.import-suppliers` (mig 0083), tab Danh mục "NCC nhập khẩu", bảng danh mục ẩn nút Xóa dòng NCC đã có HĐ (`canDeleteRow`), form Đại lý bỏ ô Quốc gia, planner thôi có quyền thêm / sửa Đại lý.
- 2026-10-29 tối — v2: chủ dự án xem app, NCC nhập khẩu khác hẳn đại lý Nhập hàng ⇒ danh mục riêng (NI10, R15 v2, R16–R19, AC-24…28), một mục Tra cứu ở nhóm Kế hoạch; 0082 đã chạy ⇒ mig 0083. CHƯA BUILD.
- 2026-10-29 khuya — v3: chủ dự án yêu cầu mọi chỗ có tên hàng nối mặt hàng danh mục ⇒ §0c (kiểm kê 7 chỗ, R20–R22, R7 bổ sung, AC-29…34), mig 0084 thêm cột `import_contract_lines.product_id`.
- 2026-10-29 — v4 NHÁP: chỉ số kiểm mẫu của kho theo từng invoice (§0d, NI11, R23–R26, AC-35…41); soi 3 invoice scan + báo cáo 25/10/2026; chủ dự án chốt Q1 chỉ Excel · Q2 lần nhập · Q3 Phòng KH · Q4 hỏi rồi thay; chờ duyệt code.
- 2026-10-30 — v4 ĐÃ BUILD: bảng `import_sample_checks` (mig 0085), `lib/importSampleChecks.ts` (khuôn chỉ số, đọc lưới Excel theo nhãn, chọn cột theo nhà XK + ngày về kho, gợi ý dòng theo size, nạp lại thay), `lib/importSampleFile.ts` (SheetJS), khối "Kiểm mẫu của kho" trong mỗi lần nhập + hộp nạp / nhập tay / sửa; lần nhập có mẫu không xóa được; file báo cáo không còn tính là file HĐ.
