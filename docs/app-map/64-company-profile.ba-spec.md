# 64 — ba-spec: Hồ sơ công ty (logo, pháp nhân, chứng nhận) — lưu ở Tài liệu công ty, một nguồn cho chứng từ

> Load khi: nạp logo / thông tin pháp nhân / chứng nhận vào Tài liệu công ty, hoặc đổi chỗ chứng từ (Invoice, Packing list, Sale contract) lấy tên, địa chỉ, MST, ngân hàng của công ty.
covers: docs/ho-so-nang-luc/company-profile.md, docs/brand/README.md, src/lib/exportInvoice.ts
last_verified: 2026-11-03
ttl_days: 90
status: v1 ĐẶC TẢ 2026-11-03 — kiểm kê xong (`ho-so-nang-luc/company-profile.md`); NV1 chờ chủ dự án đồng ý nạp lên hệ thống thật; NV3 hoãn (§7).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-03: "Lưu logo vào tài liệu công ty đi, có thông tin nào liên quan đến công ty nhưng chưa lưu vào tài liệu công ty không, rà lại để bổ sung".
- **Hiện nay:** Tài liệu công ty (thật) có 9 mục của Phòng Kế hoạch, 0 file. Logo, tên / địa chỉ / MST / điện thoại / fax, 3 tài khoản ngân hàng, người ký chứng từ, chứng nhận BRC / Halal… nằm rải rác ở file Excel, con dấu, code (`SELLER` trong `lib/exportInvoice.ts`) — bảng kê: [company-profile](../ho-so-nang-luc/company-profile.md).
- **Job:** người cần logo / thông tin công ty (làm chứng từ, hồ sơ khách, đăng ký chứng nhận) mở một chỗ là có bản chính thức, đúng lần ban hành.
- **Đo thành công:** Tài liệu công ty có ≥ 2 mục hồ sơ công ty (Nhận diện · Thông tin pháp nhân) có file, mọi phòng xem được; 0 thông tin ở bảng kê còn ⚠️ sau khi kế toán xác nhận.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Quản trị / người phụ trách hồ sơ (admin, Kế toán trưởng) | `documents` ghi | nạp, ban hành lại khi đổi |
| U2 | Mọi phòng (KH, kế toán, QC, kho) | `documents` xem — mục "cả công ty" | tải logo, chép thông tin |
| U3 | Kế toán | — | xác nhận MST, tài khoản ngân hàng |
| S1 | Chứng từ app tạo (Invoice / PL — ba-spec 63) | — | đọc tên, địa chỉ, ngân hàng |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Ưu tiên |
|---|---|---|---|---|
| NV1 | Nạp hồ sơ công ty vào Tài liệu công ty (logo, thông tin pháp nhân) | U1 | U3 xác nhận số liệu ⚠️ | Must |
| NV2 | Nạp chứng nhận (BRC, Halal, HACCP, EU code) kèm ngày hết hạn | U1 | QC cung cấp bản scan | Should |
| NV3 | Chứng từ lấy thông tin công ty từ một nguồn sửa được (thay hằng `SELLER`) | S1 | U1 sửa nguồn | Could |

## 4. Cross-user handoff

| Chặng | Từ → Nhận | Điều kiện | Khi không ai nhận |
|---|---|---|---|
| H1 | NV1 U1 → U3 | thông tin ⚠️ (MST, người ký, quan hệ tập đoàn) | nạp với ghi chú "chờ xác nhận", không chặn nạp logo |

## 5. Flows

### NV1 — Nạp hồ sơ công ty · U1
- **Input:** file logo gốc (`docs/brand/baseafood-logo-original.jpg`), file "Thông tin pháp nhân" (bảng §1–§2 của company-profile, xuất PDF).
- **Steps:** tạo 2 mục loại **Hồ sơ năng lực**, xem = **cả công ty**: `HSNL-01` Nhận diện thương hiệu — logo · `HSNL-02` Thông tin pháp nhân & tài khoản ngân hàng → ghi lần ban hành (ngày hiệu lực 2026-11-03) → đính file.
- **Output:** 2 mục `active`, mỗi mục 1 lần ban hành có file; mọi phòng mở được.
- **End:** đổi logo / tài khoản ⇒ ghi lần ban hành mới (bản cũ thu hồi, tra lại được — luật 40-documents).

### NV2 — Chứng nhận · U1
- Mỗi chứng nhận một mục loại **Chứng nhận** + ngày hết hạn ⇒ nhắc gia hạn 60 ngày đã có sẵn (40-documents). Chờ bản scan từ QC.

### NV3 — Một nguồn cho chứng từ · S1 (hoãn)
- Khi có chứng từ thứ hai cần thông tin công ty (Sale contract) ⇒ đưa tên / địa chỉ / điện thoại / fax vào danh mục sửa được, chứng từ đọc từ đó. Ngân hàng đã ở danh sách chọn (mig 0096).

## 6. Flow optimization log

| Quyết định | Phương án | Chọn | Lý do |
|---|---|---|---|
| Logo + pháp nhân lưu ở đâu | A: chỉ trong repo · B: Tài liệu công ty (file + lần ban hành) · C: bảng cấu hình mới | **B** (+ repo làm bản kê) | đã có sẵn: lần ban hành không ghi đè, phân quyền xem, không cần code / migration; repo không phải chỗ người dùng tìm |
| Thông tin cho chứng từ | hằng `SELLER` · bảng cấu hình | **giữ hằng** tới khi có chứng từ thứ hai (NV3) | 1 chứng từ dùng; thêm bảng bây giờ = migration + màn sửa cho dữ liệu gần như không đổi |

## 7. Scope

- **IN:** bảng kê (đã xong), NV1. **Should:** NV2 (chờ file QC). **OUT / hoãn:** NV3.

## 10. Acceptance Criteria

### AC-1 — Bảng kê đủ nguồn · Maps to: NV1 · Test: manual
- **Given** rà 2026-11-03 **When** đọc company-profile **Then** mỗi thông tin có cột Nguồn và Tin cậy; mục chưa chắc đánh ⚠️.
- **Assert:** số dòng thiếu nguồn `== 0`; số mục ⚠️ `== 3` (MST, người ký, quan hệ tập đoàn) tới khi kế toán xác nhận.

### AC-2 — Hồ sơ công ty có trên Tài liệu công ty · Maps to: NV1 · Test: manual (DB thật, chỉ đọc)
- **Given** NV1 xong **When** truy `company_documents` site bsf1 **Then** có 2 mục `HSNL-01`, `HSNL-02` loại `capability_profile`, xem cả công ty, mỗi mục ≥ 1 lần ban hành có file.
- **Assert:** `count(*) == 2` cho 2 mã; `with_file >= 1` mỗi mục; tài khoản Thủ kho (phòng kho) mở được cả 2.

## 11. Assumptions / Open
- A1. Mã `HSNL-01/02` đặt tạm (công ty chưa có mã cho hồ sơ năng lực) — đổi theo mã thật nếu có.
- A2. MST đọc từ ảnh con dấu, cần kế toán xác nhận trước khi in lên chứng từ mới.
- A3. Nạp lên hệ thống thật là ghi dữ liệu thật ⇒ chờ chủ dự án đồng ý (tự nạp qua màn, hoặc để Claude nạp bằng phiên đăng nhập của chủ dự án).

## History
- 2026-11-03 — v1 kiểm kê + đặc tả.
