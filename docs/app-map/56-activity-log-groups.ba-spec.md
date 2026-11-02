# 56 — ba-spec: Nhật ký thao tác trong hồ sơ — mỗi nhóm trang một bảng nhật ký

> Load khi: thêm hoặc sửa khối "Nhật ký thao tác" trong hồ sơ của một trang nghiệp vụ (như hồ sơ hợp đồng xuất khẩu); thêm bảng nhật ký cho một nhóm trang; rà vì sao một thao tác không có trong nhật ký.
covers: src/lib/audit.ts, src/features/audit/AuditLogScreen.tsx, src/features/production-orders/useContractActivity.ts, src/features/shared/activityLog.ts, src/features/shared/ActivityLogBlock.tsx, src/features/shared/activityCoverage.test.ts, supabase/migrations/0092_group_activity_logs.sql
last_verified: 2026-11-02
<!-- updated: 2026-11-02 (d) — DB thật: 14 dòng audit_log 28/10 15:32–16:00 (máy của Khiêm, dùng chung tài khoản admin) đổi actor sang `lqkhiem`; `export_contract_revisions.recorded_by` (1) + `export_files.uploaded_by` (2) "Admin" → "Lê Quang Khiêm". Tách theo `device_id` (máy Khiêm dùng `lqkhiem` ngày 30/10). Script + hoàn tác: ../ops/fix-2026-11-02-khiem-admin-log.sql; trigger 0048 để lại 3 dòng "[SQL trực tiếp]". -->
<!-- updated: 2026-11-02 (c) — mốc giờ nhật ký (`ActivityLogBlock`, `ActivityList` Xuất khẩu, `AuditLogScreen`) đổi sang `formatDateTimeVN` (lib/format.ts): luôn "dd/mm/yyyy HH:mm" theo giờ máy; sửa lỗi cũ ngày lấy UTC (`slice(0,10)`) ghép giờ máy ⇒ thao tác 0h–7h giờ VN bị ghi lùi một ngày. -->
<!-- re-verified: 2026-11-02 — P1–P3: PGlite 0001→0092 (+ chạy 0092 lần 2) 16/16 (AC-6); `activityCoverage.test.ts` 9 test = AC-4 + AC-5 (7 màn, mọi notify.saved/deleted có ghi nhật ký, miễn danh mục); `audit.test.ts` AC-1; build / lint / naming xanh, 1283 test. Chưa thử tay AC-2, AC-3, AC-7. -->
ttl_days: 90
status: v1 ĐÃ CHỐT + ĐÃ BUILD đợt 1 2026-11-02 (P0–P3). Mig `0092` CHƯA chạy DB thật (đổi RLS export_activity_log — dòng HĐ xuất giữ nguyên điều kiện). Chưa thử tay trên app.

> **Mục đích:** oracle HÀNH VI cho nhật ký thao tác ở hai tầng:
> - **Nhật ký chung `/audit`** (admin): ghi mọi thêm / sửa / xóa ở tầng dữ liệu.
> - **Khối nhật ký trong hồ sơ**: câu nghiệp vụ người đọc hiểu được, ví dụ "Phát hành lệnh sản xuất 19.10 — bước Lệnh sản xuất của chuyến lô 205 xong". Ai xem được hồ sơ thì đọc được khối này.
>
> **Nguồn:** chủ dự án 2026-11-02, nguyên văn: "Check lỗi nhật ký thao tác của 1 vài chưa được ghi log như hợp đồng xuất khẩu". Chủ dự án chọn: thiếu ở cả 3 chỗ (`/audit`, hồ sơ HĐ, các trang khác chưa có khối nhật ký). Mỗi nhóm trang chức năng dùng một bảng nhật ký; nhóm Kế hoạch (Nhập khẩu · Lệnh sản xuất · Xuất khẩu) dùng chung một bảng. Sửa lỗi trước, phần mới viết spec sau.

---

## 0. Kết quả rà (DB thật, đọc bằng phiên admin 2026-11-02) + lỗi đã sửa

| # | Hiện tượng | Nguyên nhân | Đã sửa |
|---|---|---|---|
| L1 | 02/11, tghung đính file "LXH GHẸ TẨM BỘT KMP 173" vào chuyến xuất. Bảng `export_files` có dòng, hồ sơ HĐ có dòng nhật ký, nhưng **`audit_log` không có dòng thêm file**. Chỉ có dòng "thêm mục bước" ghi cùng lần bấm | Một lần bấm ghi 2 bảng liền nhau (mục bước rồi file). Entry thứ hai vào buffer đúng lúc lượt đẩy thứ nhất đang chạy. `flush` cũ thấy đang đẩy thì bỏ qua, và không đẩy thêm khi lượt đó xong ⇒ dòng nằm dưới máy tới lần thao tác / tải trang sau. Máy không mở lại thì dòng không bao giờ lên | `lib/audit.ts` — `drainAuditBuffer`: gửi theo lô 200, đọc lại buffer sau mỗi lô, có entry mới lúc đang gửi thì đẩy thêm lượt. Trùng khóa (23505) thì gửi lại từng dòng. Hụt thì thử lại sau 30 giây và khi quay lại tab. Test `audit.test.ts` (4 ca) |
| L2 | Mở `/audit` ngày 02/11 thấy **4 dòng** (đều là đăng nhập), không thấy việc hợp đồng xuất khẩu | Màn mặc định đọc **từ đầu tháng**. Tháng 10 có 4.523 dòng, trong đó `export_contracts` 6, `export_step_items` 80, `export_files` 60, nhưng đều thuộc tháng trước. Đọc tối đa 1.000 dòng mới nhất, không báo bị cắt. Ô lọc Đối tượng chỉ liệt kê bảng có trong số dòng đã tải. Khoảng 40 bảng mới không có tên tiếng Việt | Mặc định **30 ngày gần nhất** (Q chủ dự án). Có câu báo "Đang hiện 1.000 thao tác mới nhất…" + nút **Tải thêm 1.000**. Ô Đối tượng liệt kê mọi bảng. Nhãn bảng lấy chung từ `TABLE_LABELS` của `repo.ts` |
| L3 | Hồ sơ HĐ xuất không có dòng nào khi phát hành lệnh sản xuất, gắn / bỏ gắn chuyến, chép mã số lô sang chuyến, hủy lệnh, dù bước 2 của chuyến đổi theo | Khối nhật ký HĐ (`export_activity_log`, mig 0079) chỉ được ghi từ trang Xuất khẩu | `production-orders/useContractActivity.ts`: lập lệnh, sửa lệnh đã phát hành, phát hành (mỗi chuyến một dòng), gắn / bỏ gắn chuyến (ở hồ sơ lệnh và ở khối Lệnh sản xuất của chuyến), hủy lệnh, Hoàn tác |

Đối chiếu số tháng 10 (bảng ↔ `audit_log`): `export_contracts` 4 dòng đổi / 6 nhật ký · `export_shipments` 12 / 24 · `export_step_items` 74 / 80 · `export_files` 62 / 60 · `material_imports` 155 / 210. ⇒ Tầng dữ liệu **có ghi** mọi bảng xuất khẩu. Chỗ hụt là dòng kẹt dưới máy (L1) và màn đọc (L2), không phải bảng bị bỏ qua.

## 1. Vấn đề & JTBD (phần mới)

- Hồ sơ HĐ xuất đã có khối nhật ký, nên Trưởng / Phó phòng tra được ai làm gì, lúc nào. Các trang khác chưa có. Muốn tra thì phải nhờ admin mở `/audit`, mà ở đó chỉ có câu "Sửa Chuyến nhập" kèm bảng trước → sau.
- **JTBD:** *Khi mở hồ sơ một bản ghi (HĐ nhập, lệnh sản xuất, chuyến nhập NL, phiếu sản xuất…), tôi muốn thấy ngay ai đã làm gì với nó bằng câu nghiệp vụ, để tra soát mà không cần admin.*

## 2. User registry

| Mã | Ai | Quyền |
|---|---|---|
| U1 | Người ghi của khu (NV Kế hoạch, thủ kho, tổ trưởng, kế toán… theo khu) | Thao tác ⇒ để lại dòng nhật ký |
| U2 | Người xem được hồ sơ của khu (kể cả Trưởng / Phó phòng, BGĐ) | Đọc khối nhật ký của hồ sơ |
| U3 | Quản trị | `/audit` toàn hệ thống (giữ nguyên) |
| S1 | Máy chủ | Đóng dấu người ghi + giờ ghi, chặn sửa / xóa (như 0079) |

## 3. Nghiệp vụ

| Mã | Nghiệp vụ | Owner |
|---|---|---|
| AL1 | Ghi một câu nhật ký khi thao tác làm đổi hồ sơ | U1 (máy ghi thay) |
| AL2 | Đọc nhật ký của một hồ sơ, mới nhất trước | U2 |
| AL3 | Tra toàn hệ thống | U3 (`/audit`) |

## 4. Luật (R)

- **R1 Mỗi nhóm trang một bảng.** Nhóm = nhóm trên thanh bên (`CAY_NAV`):
  - Kế hoạch: Nhập khẩu · Lệnh sản xuất · Xuất khẩu.
  - Nhập hàng: chuyến nhập · tồn kho NL.
  - Sản xuất: sản xuất thành phẩm · đóng gói · QC.
  - Kho: kho dự trữ · sổ kho tháng · mã lô · NXT.
  - Kinh doanh: bán hàng · đơn đặt.
  - Báo cáo & Cân đối: cân đối kỳ, …

  Trang mới thuộc nhóm nào thì ghi vào bảng của nhóm đó. Không mở bảng thứ hai trong cùng một nhóm.
- **R2 Dạng dòng giống 0079:**
  - Các cột: `record_type` (loại hồ sơ: `export-contract`, `import-contract`, `production-order`, `import-shipment`…), `record_id`, `parent_type` + `parent_id` (nếu có: lần nhập thuộc HĐ nhập, chuyến thuộc HĐ xuất), `action` (cùng bộ nhãn của 0079), `summary`, `actor`, `created_at`, `site_id`.
  - Người ghi và giờ ghi do máy chủ đóng dấu.
  - Chỉ thêm: UPDATE trả lại dòng cũ, chỉ xóa được dòng `site-demo`.
- **R3 Câu nghiệp vụ do màn ghi**, không tự sinh từ bảng trước → sau. Mỗi thao tác một câu, có số chứng từ / mã lô / số kg để người đọc nhận ra. Có Hoàn tác thì ghi thêm dòng "Hoàn tác: …".
- **R4 Một thao tác chạm hồ sơ của nhóm khác** thì ghi vào bảng của nhóm chủ hồ sơ. Ví dụ: Lệnh sản xuất đổi chuyến xuất ⇒ ghi nhật ký HĐ xuất (L3). Gắn hóa đơn đại lý vào chuyến nhập ⇒ ghi nhật ký chuyến nhập.
- **R5 Đọc:** ai có quyền **xem** khu của hồ sơ thì đọc được nhật ký hồ sơ đó (RLS theo tài nguyên của khu). Nhật ký có số tiền thì theo quyền xem số tiền của khu (như 0079).
- **R6 Ghi:** ai có quyền thêm / sửa ở khu thì ghi được (dòng nhật ký đi cùng thao tác). Thiếu bảng (chưa chạy migration) ⇒ không ghi, không chặn thao tác.
- **R7 `/audit` giữ nguyên vai trò** là nhật ký kỹ thuật toàn hệ thống. Khối nhật ký hồ sơ không thay `/audit`.
- **R8 Bảng mới** thì vào `DemoBundle` cùng commit (QT 15) và có nhãn ở `TABLE_LABELS`.

## 5. Flow

### AL1 — Ghi · owner U1
- **Input:** một thao tác ghi thành công trên hồ sơ (lưu, xóa, chốt, gắn, đính file, hủy, Hoàn tác).
- **Steps:** màn ghi xong dữ liệu ⇒ thêm 1 dòng vào bảng nhật ký của nhóm chủ hồ sơ (R1, R4).
- **Output:** dòng nhật ký có câu, người, giờ máy chủ.
- **End:** dòng nằm hàng chờ nếu mất mạng, lên khi có mạng (như mọi bảng).

### AL2 — Đọc · owner U2
- **Input:** hồ sơ đang mở.
- **Output:** khối "Nhật ký thao tác" ở cuối hồ sơ: các dòng của hồ sơ (+ hồ sơ con), mới nhất trước, mỗi dòng có giờ · người · câu.
- **End:** chưa có dòng ⇒ "Chưa có thao tác nào được ghi".

## 6. Flow optimization log

| Chỗ quyết | Biến thể | Chọn | Lý do |
|---|---|---|---|
| Bảng | 1 bảng chung toàn app · **1 bảng / nhóm trang** · 1 bảng / trang | **1 / nhóm** (chủ dự án) | Chung toàn app thì RLS phải theo từng dòng, rất nhiều tài nguyên. Một bảng mỗi trang thì quá nhiều bảng. Nhóm trang khớp với cách phân quyền + phòng ban |
| Nội dung dòng | Tự sinh từ diff `audit_log` · **câu nghiệp vụ do màn ghi** | **Câu do màn ghi** | Diff đọc như "Sửa Chuyến nhập: kg 120 → 125", người dùng không hiểu; câu do màn ghi thì có số chứng từ, ngữ cảnh |
| Đọc nhật ký | Mở quyền đọc `audit_log` cho người thường | Loại | Đổi RLS (🔴), và `audit_log` có mọi bảng, lộ số của khu khác |

## 7. Scope

**Đã làm (sửa lỗi):** L1–L3 ở §0.

**Đợt 1 (Q2):**
- Nhóm Kế hoạch: Nhập khẩu (HĐ nhập, lần nhập, chứng từ, thực nhập, kiểm mẫu) và Lệnh sản xuất (khối nhật ký trong hồ sơ lệnh).
- Nhóm Nhập hàng: chuyến nhập, chốt ngày, ghi bù, hóa đơn đại lý.
- Nhóm Sản xuất: sản xuất thành phẩm, đóng gói.

**Đợt 2:** Kho, Kinh doanh, Báo cáo & Cân đối, Danh mục.

## 8. Success metric

- 100 % thao tác ghi trên hồ sơ của nhóm đợt 1 có đúng 1 dòng nhật ký (test canh: mỗi hàm ghi của màn có gọi ghi nhật ký).
- Không còn dòng `audit_log` kẹt dưới máy quá 1 phút khi có mạng (L1).

## 9. Acceptance Criteria

### AC-1 — Nhật ký không kẹt dưới máy · Maps to flow: L1 · Test: unit
- **Given** buffer có 1 entry đang gửi; trong lúc gửi, thao tác ghi tiếp thêm 1 entry
- **When** lượt đẩy xong
- **Then** cả hai entry lên máy chủ trong cùng lượt, buffer sạch
- **Assert** `audit.test.ts` "thao tác ghi 2 bảng liền nhau": server == {item, file} · buffer.length == 0; trùng khóa ⇒ server 3 / 3, buffer 0; mất mạng ⇒ buffer giữ 2, trả false

### AC-2 — `/audit` thấy việc tháng trước, biết khi bị cắt · Maps to flow: L2 · Test: manual
- **Given** hôm nay 02/11, tháng 10 có 4.523 dòng, trong đó 6 dòng `export_contracts`
- **When** admin mở `/audit` không đổi gì, rồi chọn Đối tượng "Hợp đồng xuất khẩu"
- **Then** khoảng mặc định 04/10 → 02/11; danh sách Đối tượng có "Hợp đồng xuất khẩu" kể cả khi 1.000 dòng mới nhất không có bảng đó; vượt 1.000 dòng thì có câu báo + Tải thêm
- **Assert** từ ngày == hôm nay − 29 ngày · lọc Hợp đồng xuất khẩu ⇒ 6 dòng · số dòng đọc được ≥ 1.000 ⇒ có chữ "Tải thêm 1.000" · 0 dòng hiện tên bảng tiếng Anh trong cột Đối tượng (mọi bảng có nhãn)

### AC-3 — Việc ở Lệnh sản xuất vào nhật ký HĐ xuất · Maps to flow: L3 · Test: manual
- **Given** lệnh nháp 2.11 thuộc HĐ X, chuyến S của X chưa có mã số lô
- **When** phát hành lệnh và gắn S, rồi Hoàn tác
- **Then** hồ sơ HĐ X có 2 dòng mới: "Phát hành lệnh sản xuất 2.11 — bước Lệnh sản xuất của chuyến chưa có mã lô xong · chuyến nhận mã số lô …" và "Hoàn tác: phát hành lệnh sản xuất 2.11"
- **Assert** số dòng `export_activity_log` của X tăng đúng 2 · dòng 1 có shipment_id == S

### AC-4 — Mỗi nhóm một bảng · Maps to flow: AL1 · Test: unit
- **Given** sổ đăng ký nhóm → bảng nhật ký
- **When** chạy test canh
- **Then** mỗi trang nghiệp vụ thuộc đúng 1 nhóm, mỗi nhóm có ≤ 1 bảng nhật ký
- **Assert** số nhóm có > 1 bảng == 0 · số trang đợt 1 không thuộc nhóm nào == 0

### AC-5 — Thao tác đợt 1 đều có dòng nhật ký · Maps to flow: AL1 · Test: unit
- **Given** các hàm ghi của màn đợt 1 (Nhập khẩu, Lệnh sản xuất, Nhập hàng, Sản xuất thành phẩm, Đóng gói)
- **When** quét mã nguồn như `filterCoverage`
- **Then** hàm nào ghi dữ liệu (`store.save…`) cũng gọi ghi nhật ký
- **Assert** số hàm ghi thiếu ghi nhật ký == 0 (danh sách miễn có lý do)

### AC-6 — Ai xem hồ sơ thì đọc được nhật ký · Maps to flow: AL2 · Test: integration
- **Given** chuỗi migration trên PGlite, mỗi nhóm đợt 1 có 2 dòng nhật ký
- **When** đọc theo từng vai
- **Then** đúng R5
- **Assert** thủ kho đọc nhật ký chuyến nhập == 2 dòng, nhật ký Lệnh sản xuất == chỉ dòng của lệnh đã phát hành; tổ trưởng đọc nhật ký Kế hoạch == 0; sửa / xóa dòng thật == 0 dòng đổi

### AC-7 — Không ghi khi thiếu bảng, không chặn thao tác · Maps to flow: AL1 · Test: unit
- **Given** máy chủ chưa chạy migration nhật ký của nhóm
- **When** người dùng lưu hồ sơ
- **Then** hồ sơ vẫn lưu, không có dòng nhật ký kẹt hàng chờ
- **Assert** lưu trả true · hàng chờ của bảng nhật ký == 0 dòng

## 11. Đã chốt (chủ dự án 2026-11-02: "Theo đề xuất")

| Q | Câu | Đã chốt (in đậm) |
|---|---|---|
| Q1 | Bảng nhóm Kế hoạch | **Mở rộng `export_activity_log`** thành nhật ký chung của nhóm. Thêm cột `record_type` / `record_id` / `parent_*`, migration chỉ thêm cột, dòng cũ giữ nguyên = `export-contract` · *hoặc* bảng mới `planning_activity_log` rồi chép dữ liệu cũ sang |
| Q2 | Đợt 1 làm những nhóm nào | **Kế hoạch (Nhập khẩu + Lệnh sản xuất) · Nhập hàng · Sản xuất (thành phẩm, đóng gói)**. Kho / Kinh doanh / Cân đối đợt 2 |
| Q3 | Hồ sơ của trang không có trang hồ sơ (Sản xuất thành phẩm, Nhập hàng theo ngày) | **Hồ sơ = ngày × phân xưởng** (khối nhật ký ở dưới sổ ngày đang mở) · *hoặc* từng phiếu / chuyến |
| Q4 | Ai đọc nhật ký | **Ai xem được khu** (R5) · *hoặc* chỉ người ghi + trưởng / phó phòng |

## 12. Kế hoạch build (sau khi chốt)

| Pha | Việc | Tier |
|---|---|---|
| P0 ✅ 2026-11-02 | Sửa L1–L3 (§0) | 🟢 |
| P1 ✅ 2026-11-02 | Migration **0092** nhật ký nhóm (theo Q1): bảng / cột mới, RLS theo tài nguyên của khu, trigger đóng dấu + chỉ thêm (như 0079); `TableMapping`, `DemoBundle` | 🟡 |
| P2 ✅ 2026-11-02 | Khung dùng chung: hook ghi nhật ký theo nhóm + khối "Nhật ký thao tác" (tách từ `ActivityList` của Xuất khẩu) | 🟢 |
| P3 ✅ 2026-11-02 | Gắn vào màn đợt 1 + test canh AC-4, AC-5 + hướng dẫn "?" mỗi trang | 🟢 |

## History
- 2026-11-02 — build đợt 1: mig 0092 (mở rộng export_activity_log + imports_activity_log + production_activity_log), `features/shared/activityLog.ts` + `ActivityLogBlock.tsx`, gắn Nhập khẩu (12 chỗ ghi) · Lệnh sản xuất (+ khối Lệnh SX của chuyến) · Nhập hàng (+ tab Hóa đơn) · Sản xuất thành phẩm · Đóng gói; tour + hộp "?"; test canh AC-4 / AC-5. Dòng HĐ xuất gửi dạng cũ để không kẹt hàng chờ khi 0092 chưa chạy; dòng hồ sơ mới chỉ ghi khi máy chủ có cột.
- 2026-11-02 — chốt Q1–Q4 theo đề xuất: mở rộng `export_activity_log` cho cả nhóm Kế hoạch; đợt 1 = Kế hoạch (Nhập khẩu, Lệnh sản xuất) · Nhập hàng · Sản xuất (thành phẩm, đóng gói); hồ sơ của trang theo ngày = ngày × phân xưởng; ai xem được khu thì đọc nhật ký khu đó.
- 2026-11-02 — v1: rà DB thật, sửa L1–L3, đặc tả phần nhật ký theo nhóm trang (chờ chốt Q1–Q4).
