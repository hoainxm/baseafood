# 67 — ba-spec: Thông tin công ty — tách khỏi tài liệu, một nguồn cho chứng từ

> Load khi: sửa tab Thông tin công ty ở `/documents`, bảng `company_profile`, bucket `company-assets`, hoặc chứng từ (Invoice / Packing list / Expiry list xuất khẩu, về sau nhập khẩu, lệnh SX) lấy tên, địa chỉ, MST, người ký, logo, tài khoản ngân hàng của công ty.
covers: src/lib/companyProfile.ts, src/lib/companyProfile.test.ts, src/features/documents/CompanyProfileView.tsx, supabase/migrations/0099_company_profile.sql, src/lib/exportInvoice.ts
last_verified: 2026-11-03
ttl_days: 90
status: v1 CHỐT + BUILD 2026-11-03 — thay NV3 (hoãn) của ba-spec [64](64-company-profile.ba-spec.md).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-03: "hiện tại chỉ upload logo công ty mà điền hết những mục thông tin kia thì nhiều quá, tách riêng tài liệu và thông tin công ty để làm rõ, tài khoản ngân hàng, địa chỉ… để sau này cần cho các chức năng lấy thông tin ghi vào file như làm invoice của xuất / nhập khẩu".
- **Hiện nay:** muốn lưu logo phải tạo một *tài liệu* (mã, loại, phòng, ai xem, lần ban hành, file…) — sai loại. Tên / địa chỉ / người ký in trên invoice là hằng `SELLER` trong code; tài khoản ngân hàng nằm ở danh sách chọn của Xuất khẩu (chỉ người ghi Xuất khẩu sửa được).
- **Job:** người phụ trách sửa MỘT chỗ (logo, tên, MST, địa chỉ, liên hệ, người ký, tài khoản ngân hàng); mọi chứng từ app lập sau đó lấy đúng thông tin đó.
- **Đo thành công:** invoice xuất khẩu lập sau khi đổi địa chỉ in địa chỉ mới (0 chỗ còn đọc hằng `SELLER` khi đã có thông tin công ty); lưu logo không phải điền trường nào khác.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Người phụ trách thông tin công ty — mặc định Kế toán trưởng, Trưởng / Phó phòng KH (+ admin) | `company-profile` Sửa | sửa thông tin, logo, tài khoản ngân hàng |
| U2 | Mọi người có vai trò | `company-profile` Xem (tự cấp) | tra MST, địa chỉ, tài khoản; tải logo |
| S1 | Chứng từ app lập (Invoice / PL / Expiry — ba-spec 63; về sau Nhập khẩu, Lệnh SX) | — | đọc thông tin công ty + logo + tài khoản đã chọn |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Ưu tiên |
|---|---|---|---|
| NV1 | Sửa thông tin công ty (tên VN / EN, viết tắt, MST, địa chỉ VN / EN, nơi lập chứng từ, điện thoại, fax, email, website, người ký + chức danh) | U1 | Must |
| NV2 | Đổi logo (chỉ một ảnh, không điền gì thêm) | U1 | Must |
| NV3 | Quản lý tài khoản ngân hàng thụ hưởng (thêm / sửa / xóa; tên gọi + khối in) | U1 | Must |
| NV4 | Xem / tra thông tin công ty, tải logo | U2 | Must |
| NV5 | Chứng từ lấy thông tin công ty, logo, tài khoản đã chọn | S1 | Must |

## 4. Cross-user handoff

U1 → S1: thông tin lưu xong ⇒ chứng từ lập SAU đó dùng ngay. Chứng từ đã tải trước đó là file, không đổi (R5). Không có bước duyệt.

## 5. Flows

- **NV1** Input: thông tin mới. Output: một bản ghi thông tin công ty của site; nhật ký ghi ai sửa, lúc nào (trigger audit).
- **NV2** Input: một file ảnh. Output: logo mới; ảnh cũ thay thế. Không bắt điền trường nào khác.
- **NV3** Input: tên gọi + khối in (Bank name / Account number / SWIFT / Beneficiary / địa chỉ). Output: danh sách tài khoản — CÙNG danh sách mà invoice Xuất khẩu chọn (`export_options`, `list_kind = bank-account`), nay quản lý ở Thông tin công ty.
- **NV5** Input: thông tin công ty đã lưu (hoặc chưa có). Output: dòng tên / địa chỉ / nơi lập / người ký trên chứng từ = thông tin công ty; chưa có bản ghi ⇒ giá trị mặc định cũ (`SELLER`).

## 6. Flow optimization log

Chủ dự án chốt 2026-11-03 (4 câu + 1 câu quyền DB):
| Quyết định | Phương án | Chọn | Lý do |
|---|---|---|---|
| Chỗ đặt | trang riêng · tab trong Tài liệu công ty · Quản trị | **tab trong Tài liệu công ty** | chủ dự án chọn — cùng nơi tìm "hồ sơ công ty", tách rõ khỏi danh sách tài liệu |
| Ai sửa | quyền riêng · chỉ admin | **quyền riêng `company-profile`** (xem: mọi người; sửa: Kế toán trưởng, Trưởng / Phó phòng KH) | đổi được ở Vai trò & quyền |
| Tài khoản ngân hàng | về Thông tin công ty · giữ ở Xuất khẩu | **về Thông tin công ty** (một nguồn; giữ bảng `export_options` để không chép số liệu, mở thêm RLS cho dòng `bank-account`) | không đổi id / chữ invoice đã dùng |
| Đổi thông tin | giữ nguyên + nhật ký · lưu từng bản có ngày hiệu lực | **giữ nguyên + nhật ký** | chứng từ đã tải là file; lịch sử bản = phức tạp không cần |
| RLS `export_options` | mở cho dòng ngân hàng · không đổi | **mở cho dòng `bank-account`** (🔴 chủ dự án đồng ý) | Kế toán trưởng không có quyền ghi Xuất khẩu |

## 7. Scope

IN: NV1–NV5 cho chứng từ Xuất khẩu (Excel / PDF / Word). OUT (đợt sau): chứng từ Nhập khẩu, Lệnh SX đọc thông tin công ty (dùng chung `companySellerOf`); con dấu / chữ ký ảnh.

## 9. Rules

| ID | Luật |
|---|---|
| R1 | Mỗi site MỘT bản ghi thông tin công ty (`company_profile`, id `company`). Chưa có ⇒ app dùng giá trị mặc định (tên, địa chỉ, nơi lập, người ký đang in trên invoice 236/26) |
| R2 | Xem: ai có vai trò (tự cấp như Tài liệu công ty). Sửa: quyền `company-profile` Sửa (admin luôn được) — máy chủ chặn bằng RLS |
| R3 | Logo: một ảnh (PNG / JPG / WEBP ≤ 5 MB) ở bucket `company-assets`; đổi logo không bắt điền trường khác. Chứng từ PDF / Word dùng logo đã lưu, chưa có ⇒ logo đóng gói sẵn |
| R4 | Tài khoản ngân hàng = danh sách `export_options` loại `bank-account` (mig 0095 / 0096); ghi được bởi người ghi Xuất khẩu HOẶC người có `company-profile` Sửa (mig 0099); invoice chọn từ đó như cũ |
| R5 | Đổi thông tin không sửa chứng từ đã tải; chứng từ lập sau dùng thông tin mới; mọi lần sửa có nhật ký (trigger audit) |
| R6 | Chữ in trên chứng từ: tên EN viết hoa, địa chỉ EN viết hoa (như mẫu 236/26), người ký = viết tắt EN, nơi lập (VD "Ba Ria") |

## 10. Acceptance Criteria

### AC-1 — Chưa có thông tin ⇒ giữ mặc định · Maps to: NV5, R1 · Test: unit
- **Given** chưa có bản ghi thông tin công ty **When** dựng người bán cho invoice **Then** tên / địa chỉ / nơi lập / người ký = giá trị đang in trên invoice 236/26.
- **Assert:** `companySellerOf(null).name == "BASEAFOOD 1 COMPANY LIMITED"`, `.signature == "BASEAFOOD 1 CO.,LTD"`.

### AC-2 — Đổi địa chỉ ⇒ invoice mới in địa chỉ mới · Maps to: NV1, NV5, R6 · Test: unit
- **Given** thông tin công ty có địa chỉ EN "1 New Street, Ba Ria" **When** dựng invoice **Then** dòng địa chỉ người bán = "1 NEW STREET, BA RIA".
- **Assert:** số dòng chứng từ chứa địa chỉ cũ `== 0`; chứa địa chỉ mới (viết hoa) `>= 1`.

### AC-3 — Quyền sửa · Maps to: R2, R4 · Test: integration (PGlite)
- **Given** vai Kế toán trưởng (có `company-profile` Sửa, không có Xuất khẩu ghi) **When** sửa `company_profile` và thêm dòng `export_options` loại `bank-account` **Then** được; thêm dòng loại `discharge-port` ⇒ bị chặn; vai Kế toán (chỉ xem) sửa `company_profile` ⇒ 0 dòng đổi.
- **Assert:** 2 lệnh được, 1 lệnh chặn, 0 dòng đổi.

### AC-4 — Logo không bắt điền gì · Maps to: NV2, R3 · Test: unit
- **Given** chỉ có file ảnh logo **When** kiểm phiếu trước khi lưu logo **Then** không lỗi thiếu trường.
- **Assert:** `logoErrors(file)` trả `length == 0` với ảnh PNG 100 KB; ảnh 6 MB ⇒ `length == 1`.

## 11. Assumptions / Open

- MST, người ký vẫn ⚠️ chờ kế toán xác nhận (ba-spec 64) — giá trị khởi tạo lấy từ bảng kê, sửa được.
- Bucket `company-assets` (private, 5 MB) phải tạo trên Dashboard TRƯỚC khi chạy 0099 (như các bucket trước).

## History
- 2026-11-03 — v1 tạo + build.
