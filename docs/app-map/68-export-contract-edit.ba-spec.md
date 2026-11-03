# 68 — ba-spec: Sửa hợp đồng xuất khẩu — Số HĐ sửa được, khóa theo trạng thái, nhật ký đủ

> Load khi: sửa luật Sửa hợp đồng / Ghi bản sửa / đổi số HĐ / đổi khách của Xuất khẩu, hoặc nhật ký sửa hợp đồng.
covers: src/features/export-planning/ContractFormDialog.tsx, src/features/export-planning/ExportPlanningScreen.tsx, src/lib/exportPlanning.ts
last_verified: 2026-11-03
ttl_days: 90
status: v1 CHỐT + BUILD 2026-11-03 (lỗi người dùng báo).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-03: "Ghi bản sửa → thay đổi Số hợp đồng không đổi được. Check logic cho phép chỉnh sửa có bị chồng chéo không… khoá ở bước nào cần ghi rõ, lưu log đầy đủ".
- **Nguyên nhân:** Số HĐ bị khóa ở Ghi bản sửa và ở Sửa khi bản ≥ 1 (`identityLocked`) ⇒ từ bản sửa đầu tiên không còn đường đổi số; máy chủ không chặn (chỉ khóa trùng số theo khách). Hai đường sửa (Sửa hợp đồng · Ghi bản sửa) cùng mở khi chưa có chuyến nhưng luật Số HĐ khác nhau ⇒ chồng chéo. Nhật ký chỉ ghi "Ghi bản sửa N", không ghi ô nào đổi; bản sửa không lưu riêng Số HĐ ⇒ đổi số là mất dấu số cũ.

## 2. User registry

| ID | User | Quyền |
|---|---|---|
| U1 | Nhân viên Kế hoạch, Trưởng / Phó phòng KH | `export-plans` Sửa |
| U2 | Người tra nhật ký (Trưởng / Phó phòng, admin) | xem nhật ký Xuất khẩu |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner |
|---|---|---|
| NV1 | Sửa hợp đồng (sửa thẳng bản đang dùng) | U1 |
| NV2 | Ghi bản sửa (bản mới có hiệu lực ngay) | U1 |
| NV3 | Tra lại ai đổi gì, cũ → mới | U2 |

## 4. Cross-user handoff

Không có bước duyệt cho sửa (bản mới hiệu lực ngay — 41). U1 → U2 qua nhật ký.

## 5. Flows

- **NV1** Input: HĐ còn mở, chưa chuyến nào có mã lô / booking / ngày / số cont / file. Output: bản đang dùng đổi tại chỗ + một dòng nhật ký có các ô đổi.
- **NV2** Input: HĐ còn mở, có bản hiệu lực. Output: bản mới (số bản + 1) có hiệu lực + một dòng nhật ký có các ô đổi.
- **NV3** Input: nhật ký của HĐ. Output: mỗi lần lưu một dòng "… của HĐ X: Ô: cũ → mới; …".

## 6. Flow optimization log

| Quyết định | Phương án | Chọn | Lý do |
|---|---|---|---|
| Số HĐ ở bản sửa | khóa (như cũ) · mở, nhật ký giữ số cũ | **mở** | số HĐ có thể gõ nhầm hoặc khách đổi số theo phụ kiện; máy chủ không cần khóa; trùng số đã chặn |
| Chồng chéo hai đường sửa | gộp một đường · giữ hai, cùng luật ô | **giữ hai, cùng luật** | Sửa thẳng cho gõ nhầm lúc chưa có chuyến (không sinh bản); Ghi bản sửa giữ dấu khi đã có chuyến |
| Nhật ký | chỉ tiêu đề · từng ô cũ → mới | **từng ô** | đổi số / đổi khách / đổi hạn giao phải tra lại được |

## 7. Scope

IN: Số HĐ mở ở mọi lần sửa; bảng khóa theo trạng thái (sơ đồ quy trình, hộp "?", tour); nhật ký từng ô. OUT: lịch sử bản lưu riêng Số HĐ (cần migration — không cần khi nhật ký đã giữ).

## 9. Rules

| ID | Luật |
|---|---|
| R1 | Số HĐ sửa được ở MỌI lần Sửa / Ghi bản sửa khi HĐ còn mở; không trùng số HĐ khác của cùng khách (`validateContract`) |
| R2 | Sửa hợp đồng (thẳng) chỉ khi chưa chuyến nào có thông tin (`canEditContractDirectly`); Ghi bản sửa khi HĐ còn mở (kể cả Chờ duyệt cuối); Khách đổi được tới khi một chuyến xong bước 4 (`customerChangeGate`); HĐ Đã đóng / Đã hủy ⇒ khóa mọi sửa (mở lại: Trưởng / Phó phòng) |
| R3 | Mỗi lần lưu ghi nhật ký kèm từng ô đổi cũ → mới: Số HĐ, Khách, Ngày ký, Số PO, Ghi chú, điều khoản (điều kiện giao, cảng, thanh toán, cọc, L/C, tiền tệ, dung sai, hạn giao, cont, chứng từ yêu cầu), dòng hàng thêm / bớt / sửa (`contractChangeSummary`) |

## 10. Acceptance Criteria

### AC-1 — Ghi bản sửa đổi được Số HĐ · Maps to: NV2, R1 · Test: manual (preview)
- **Given** HĐ còn mở có bản 0 **When** Ghi bản sửa, đổi Số HĐ sang số mới chưa có, lưu **Then** HĐ mang số mới, bản 1 có hiệu lực.
- **Assert:** ô Số HĐ ở hộp Ghi bản sửa không chỉ đọc (`readOnly == false`); sau lưu `contract.contractNo == số mới`.

### AC-2 — Nhật ký ghi từng ô cũ → mới · Maps to: NV3, R3 · Test: unit
- **Given** bản 0 (số "02.26/BSF", hạn 30/11/2026, TTR, 1 dòng 180 thùng) **When** lưu bản 1 (số "02.26/BSF-RVS1", hạn 15/12/2026, L/C, dòng 1 → 200 thùng, thêm dòng Iwadako) **Then** tóm tắt có đủ các ô đổi.
- **Assert:** có "Số HĐ: 02.26/BSF → 02.26/BSF-RVS1", "Hạn giao muộn nhất: 30/11/2026 → 15/12/2026", dòng "Dòng hàng: +Iwadako, sửa Tako tip raw"; lưu không đổi gì ⇒ `length == 0` (`exportPlanning.test.ts`).

## 11. Assumptions / Open

- Chứng từ đã tải (invoice, packing list) giữ số cũ — là file.
- Nhật ký cắt ở 1.000 ký tự / dòng (đủ cho mọi ô + 4 tên dòng hàng).

## History
- 2026-11-03 — v1 tạo + build.
