# 69 — ba-spec: Hạn hợp đồng (ngày hợp đồng hết hiệu lực) — Xuất khẩu + Nhập khẩu

> Load khi: thêm / sửa ô "Hạn hợp đồng" của HĐ xuất (form Lập / Sửa / Ghi bản sửa, hồ sơ HĐ), luật hết hạn / sắp hết hạn, bộ đọc file điền hạn HĐ.
covers: src/lib/contractValidity.ts, src/features/export-planning/ContractListView.tsx, src/features/export-planning/ContractFormDialog.tsx, src/features/export-planning/ContractDossier.tsx, src/lib/contractReader.ts, src/features/import-planning/ImportDialogs.tsx, src/features/import-planning/ImportDossier.tsx, supabase/migrations/0100_import_contract_valid_until.sql
last_verified: 2026-11-05
<!-- updated: 2026-11-03 (v2) — HĐ NHẬP cũng có Hạn hợp đồng: cột `import_contracts.valid_until` (mig 0100, CHƯA chạy ⇒ app ẩn ô, không gửi cột); cùng luật R1–R5 (R1 lưu ở cột thay vì terms). Mục OUT "HĐ nhập" và A3 đã đóng. Test thêm: `contractReader.test.ts` (đọc MSA ⇒ 31/12/2026, chỉ điền khi máy chủ có cột). -->
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-03 — `lib/contractValidity.ts` (+ test AC-1…4), `contractReader.ts` (AC-5), ô ở `ContractFormDialog.tsx`, dòng ở `ContractDossier.tsx`. Không migration: hạn HĐ nằm trong `terms` (jsonb) của từng bản HĐ, như các điều khoản khác.

> **Mục đích:** oracle HÀNH VI. Giao diện theo khuôn [42](42-export-planning-ui.design-spec.md). Hạn giao (41 R15) và gia hạn giao hàng (41 NV6) **không đổi**.

## 1. Vấn đề & JTBD

- **Nguồn:** Phòng Kế hoạch 2026-11-03: "thêm thông tin hạn hợp đồng vào chỗ hợp đồng".
- **Thực tế trên HĐ:** mục OTHERS ghi "binding on from date of signing to May 31, 2027" (13-MAT-26), "… TO LATEST DECEMBER 31, 2026" (17-26-NEWPOINT), "… to late December 31, 2026" (HĐ nhập MSA, KORNISH). Đây là **ngày HĐ hết hiệu lực**, khác **hạn giao muộn nhất** (ngày chuyến cuối phải đi).
- **Hiện nay:** form HĐ xuất không có ô này ⇒ chị phải mở file HĐ mới biết HĐ còn hiệu lực tới khi nào.
- **Job:** Khi lập / xem một HĐ, Nhân viên Kế hoạch muốn thấy HĐ hết hiệu lực ngày nào và được nhắc khi HĐ đã / sắp hết hạn mà chưa đóng.
- **Đo thành công:** HĐ có hạn ⇒ hồ sơ hiện đúng ngày + nhãn trạng thái hạn; đọc file 13-MAT-26 ⇒ hạn HĐ tự điền 31/05/2027.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch (+ Trưởng / Phó phòng) | `export-plans` ghi | lập / sửa / ghi bản sửa HĐ |
| U2 | BGĐ, Kế toán, người xem | `export-plans` xem | xem hồ sơ HĐ |
| S1 | Hệ thống | — | tính trạng thái hạn, đọc file (ba-spec 66) |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Ghi hạn HĐ khi lập / sửa / ghi bản sửa (không bắt buộc) | U1 | S1 (kiểm) | 41 NV3, NV5 | mỗi HĐ | Must |
| NV2 | Xem hạn HĐ + trạng thái hạn ở hồ sơ HĐ | U2 | U1 | NV1 | hằng ngày | Must |
| NV3 | Đọc hạn HĐ từ file hợp đồng (câu "binding … to …") | S1 | U1 (soát) | 66 | mỗi file | Must |

## 4. Cross-user handoff map

| Từ | Sang | Khi nào | Điều kiện | Dead-end? |
|---|---|---|---|---|
| U1 (lưu HĐ có hạn) | U2 | ngay | hạn HĐ ≥ ngày ký (R2) | Không |

## 5. Flows

### Flow NV1 — Ghi hạn HĐ · owner U1
- **Start:** U1 mở form Lập HĐ / Sửa / Ghi bản sửa.
- **Input:** ngày hạn HĐ (không bắt buộc), ngày ký, hạn giao muộn nhất.
- **Steps:** U1 nhập ngày (hoặc bộ đọc điền — NV3); hạn giao muộn nhất > hạn HĐ ⇒ nhắc tại chỗ, không chặn (R3); bấm Lưu: hạn HĐ < ngày ký ⇒ chặn (R2).
- **Output:** bản HĐ lưu hạn HĐ trong điều khoản (`terms.contractValidUntil`); bản sửa sau mang hạn mới (phụ lục gia hạn hiệu lực).
- **End:** lưu xong như 41 NV3 / NV5.

### Flow NV2 — Xem hạn HĐ · owner U2
- **Input:** bản đang dùng của HĐ, trạng thái HĐ, ngày hôm nay.
- **Output:** hạn HĐ (dd/mm/yyyy) + trạng thái hạn (R4): "Đã hết hạn" · "Còn n ngày" (≤ 30 ngày) · không nhãn (> 30 ngày, hoặc HĐ đã đóng / hủy). Không có hạn ⇒ "Chưa ghi".
- **End:** chỉ xem.

### Flow NV3 — Đọc hạn HĐ từ file · owner S1
- **Input:** chữ của file HĐ (ba-spec 66 R2).
- **Steps:** tìm câu có binding / valid / validity / effective / hiệu lực, lấy ngày sau to / until / till / through (bỏ "late", "latest") ⇒ điền ô hạn HĐ theo luật chỉ điền ô trống (66 R7).
- **Output / End:** như 66 NV1.

## 6. Flow optimization log

| Quyết định | Biến thể | Kết quả | Lý do | Ai chấm |
|---|---|---|---|---|
| Lưu ở đâu | A. Cột mới `export_contracts.valid_until` (migration) | Loại | Phụ lục đổi hạn hiệu lực ⇒ hạn thuộc từng bản, không thuộc HĐ; thêm migration | Optimizer |
| Lưu ở đâu | B. Trong `terms` (jsonb) của bản HĐ | **Chọn** | Như hạn giao, L/C hết hạn; bản sửa mang hạn mới; không migration | Optimizer |
| Bắt buộc | A. Bắt buộc | Loại | HĐ cũ / HĐ không ghi hạn sẽ không lưu được | Domain |
| Bắt buộc | B. Không bắt buộc | **Chọn** | — | Domain |
| Hạn giao > hạn HĐ | A. Chặn lưu | Loại | Thực tế có HĐ ghi lệch, gia hạn bằng phụ lục sau | Domain (XNK) |
| Hạn giao > hạn HĐ | B. Nhắc, không chặn | **Chọn** | — | Optimizer |
| Nhắc sắp hết hạn | A. Thêm việc ở Việc của tôi | Hoãn v2 | Cần loại việc mới (39) — chưa được yêu cầu | Orchestrator |
| Nhắc sắp hết hạn | B. Nhãn trong hồ sơ HĐ (≤ 30 ngày) | **Chọn** v1 | Đủ thấy, không thêm việc | Optimizer |
| HĐ nhập | Thêm cùng đợt | Hoãn | HĐ nhập lưu cột riêng ⇒ cần migration; chờ chủ dự án duyệt | Orchestrator |

## 7. Scope & Priority

- **IN:** NV1–NV3 cho HĐ **xuất**.
- **OUT (v1):** HĐ nhập (cần migration), nhắc ở Việc của tôi, chặn ghi chuyến sau hạn HĐ, Excel / báo cáo theo hạn HĐ.

## 8. Success metric

| Nghiệp vụ | Đo | Ngưỡng |
|---|---|---|
| NV1 | HĐ lưu được khi bỏ trống hạn HĐ | 100% |
| NV2 | Nhãn trạng thái hạn đúng theo R4 | 4 / 4 ca của AC-4 |
| NV3 | 13-MAT-26, 17-26-NEWPOINT tự điền đúng hạn HĐ | 2 / 2 |

## 9. Rules & Invariants

| ID | Luật | Ví dụ |
|---|---|---|
| R1 | Hạn HĐ là ngày (yyyy-mm-dd) trong điều khoản của **từng bản** HĐ; không bắt buộc; trống = "Chưa ghi". Bản cũ không có trường ⇒ trống. | — |
| R2 | Hạn HĐ có thì phải **≥ ngày ký** ⇒ không thì chặn Lưu với lỗi "Hạn hợp đồng" | ký 16/10/2026, hạn 01/10/2026 ⇒ chặn |
| R3 | Hạn giao muộn nhất > hạn HĐ ⇒ nhắc "Hạn giao muộn nhất sau hạn hợp đồng", không chặn | hạn giao 30/06/2027, hạn HĐ 31/05/2027 ⇒ nhắc |
| R4 | **Trạng thái hạn** (HĐ chưa đóng, chưa hủy): hôm nay > hạn ⇒ "Đã hết hạn"; còn 0–30 ngày ⇒ "Còn n ngày"; còn > 30 ngày ⇒ không nhãn. HĐ đã đóng / đã hủy ⇒ không nhãn. | hạn 10/11/2026, hôm nay 03/11/2026 ⇒ "Còn 7 ngày" |
| R5 | Bộ đọc (66): câu chứa binding / valid / validity / effective / hiệu lực + to / until / till / through + ngày ⇒ hạn HĐ; "late" / "latest" trước ngày bỏ qua. Chỉ điền ô trống (66 R7). | "binding on from date of signing to May 31, 2027" ⇒ 2027-05-31 |

## 10. Acceptance Criteria

### AC-1 — Bỏ trống hạn HĐ vẫn lưu · Maps to: NV1, R1 · Test: unit
- **Given** ngày ký 2026-10-16, hạn HĐ trống
- **When** kiểm hạn HĐ
- **Then** không có lỗi
- **Assert:** `validityError("2026-10-16", "") == ""`

### AC-2 — Hạn trước ngày ký bị chặn · Maps to: NV1, R2 · Test: unit
- **Given** ngày ký 2026-10-16, hạn HĐ 2026-10-01
- **When** kiểm hạn HĐ
- **Then** có lỗi
- **Assert:** `validityError("2026-10-16", "2026-10-01")` chứa `"trước ngày ký"`

### AC-3 — Hạn giao sau hạn HĐ chỉ nhắc · Maps to: NV1, R3 · Test: unit
- **Given** hạn giao 2027-06-30, hạn HĐ 2027-05-31
- **When** kiểm
- **Then** có câu nhắc; hạn giao 2027-03-31 thì không
- **Assert:** `validityWarning("2027-06-30", "2027-05-31") != ""` · `validityWarning("2027-03-31", "2027-05-31") == ""`

### AC-4 — Trạng thái hạn · Maps to: NV2, R4 · Test: unit
- **Given** hôm nay 2026-11-03
- **When** tính trạng thái với hạn 2026-11-01 / 2026-11-10 / 2027-05-31 (HĐ đang chạy) và 2026-11-01 (HĐ đã đóng)
- **Then** lần lượt hết hạn, còn 7 ngày, không nhãn, không nhãn
- **Assert:** `kind` lần lượt `"expired"`, `"soon"` (`days == 7`), `"ok"`, `"none"`

### AC-5 — Đọc hạn HĐ từ file · Maps to: NV3, R5 · Test: unit
- **Given** chữ của 13-MAT-26 và 17-26-NEWPOINT (fixture 66)
- **When** đọc
- **Then** ra hạn HĐ, form trống thì điền
- **Assert:** `contractValidUntil == "2027-05-31"` (MAT) · `"2026-12-31"` (NEWPOINT) · sau `fillExportContract` form trống ⇒ `terms.contractValidUntil == "2027-05-31"`

### AC-6 — Hồ sơ hiện hạn HĐ · Maps to: NV2 · Test: manual (preview)
- **Given** HĐ lưu với hạn 2027-05-31
- **When** mở hồ sơ HĐ
- **Then** thấy dòng "Hạn hợp đồng 31/05/2027"
- **Assert:** chữ hồ sơ chứa `"Hạn hợp đồng"` và `"31/05/2027"`

## 11. Assumptions

- **A1:** "Hạn hợp đồng" = ngày hết hiệu lực trong mục OTHERS ("binding … to …"), không phải hạn giao.
- **A2:** ngưỡng "sắp hết hạn" 30 ngày (như nhắc hạn ở các khu khác); đổi được sau.
- **A3:** HĐ nhập để đợt sau (cần migration) — hỏi chủ dự án.

## History

- 2026-11-03 — v2: HĐ nhập (mig 0100).
- 2026-11-03 — v1.
- 2026-11-04: chị Thảo "thêm thông tin hạn hợp đồng vào chỗ hợp đồng" ⇒ tab Hợp đồng (danh sách HĐ xuất) thêm cột **Hạn hợp đồng**: ngày + thẻ Còn n ngày (cảnh báo) / Đã hết hạn (lỗi) theo R4, "Chưa ghi" khi trống, sắp xếp theo ngày (ô trống cuối).
- 2026-11-05: sửa lỗi Hạn hợp đồng mất khi tải lại trang — `parseTerms` (repo.ts) không đọc `contractValidUntil`; giá trị đã lưu trên máy chủ vẫn còn (10 bản HĐ), nay đọc lại được. Test `exportParties.test.ts`.
