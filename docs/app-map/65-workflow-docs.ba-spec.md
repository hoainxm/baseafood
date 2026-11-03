# 65 — ba-spec: Sơ đồ workflow theo module, đồng bộ cùng code

> Load khi: thêm / sửa sơ đồ ở `docs/workflows/`; sửa `src/lib/workflowDocs.ts` hoặc mục 3b của `.githooks/pre-commit`; thêm trang mới (phải gán module).
covers: src/lib/workflowDocs.ts, src/lib/workflowDocs.test.ts, .githooks/pre-commit, docs/workflows/README.md, src/features/workflows/WorkflowScreen.tsx, src/design-system/patterns/MarkdownView.tsx
last_verified: 2026-11-03
ttl_days: 90
status: v1 CHỐT + ĐÃ BUILD 2026-11-03 — đủ 10 module (Xuất khẩu làm mẫu, 9 module sau cùng ngày).

## 1. Vấn đề & JTBD

Mỗi trang / module có luật riêng, nằm rải trong ba-spec dài, tour, hộp "?" và code. Cần kiểm lại một chỗ thì mất nhiều thời gian; tài liệu dễ lệch vì sửa code không bị buộc sửa tài liệu. JTBD: *"Khi cần review một module, tôi đọc một file 5 phút là nắm trạng thái, điều kiện, ai làm gì — và tin được là nó khớp code."*

## 2. User registry

| ID | Ai | Dùng để |
|---|---|---|
| U1 | Chủ dự án / người review | Đọc nhanh luật một module trước khi duyệt thay đổi, trả lời người dùng xưởng |
| U2 | Người sửa code (người hoặc AI agent) | Sửa sơ đồ trong cùng commit với code |
| U3 | Máy (hook + test CI) | Chặn commit / đỏ test khi sơ đồ lệch |

## 3. User × Nghiệp vụ

| NV | Nghiệp vụ | Owner |
|---|---|---|
| NV1 | Đọc sơ đồ một module | U1 |
| NV2 | Sửa sơ đồ khi sửa code của module | U2 |
| NV3 | Chặn lệch sơ đồ ↔ code | U3 |

## 4. Cross-user handoff

U2 → U3: commit có code trong `covers:` ⇒ hook kiểm; lệch ⇒ trả về U2 (sửa sơ đồ hoặc bỏ qua có chủ đích). U3 → U1: sơ đồ đã qua cổng ⇒ U1 tin được khi đọc.

## 5. Flows

- **F1 (NV1)** Input: tên module / trang. Steps: mở `docs/workflows/README.md` → file của module. Output: trạng thái, điều kiện, vai, nối module.
- **F2 (NV2)** Input: thay đổi code. Steps: sửa luật ⇒ sửa bảng / sơ đồ; đổi quyền ⇒ chạy lệnh sinh; chỉ đổi kỹ thuật ⇒ cập nhật `last_verified:` hoặc `WORKFLOW_DOC_SKIP=1`. Output: commit chứa cả code + sơ đồ.
- **F3 (NV3)** Input: commit staged / lượt CI. Output: commit qua hoặc bị chặn có lý do; test xanh / đỏ.

## 6. Flow optimization log

Chủ dự án chốt 2026-11-03: đơn vị = **module** (loại: theo trang — 25 file, luồng bị cắt; theo luồng nghiệp vụ — khó tra khi sửa một trang). Định dạng = **Markdown + Mermaid trong repo** (loại: chỉ Artifact — máy không kiểm được). Đồng bộ = **chặn commit + test** (loại: chỉ cảnh báo — đã thấy cảnh báo app-map bị lờ). Làm mẫu **Xuất khẩu** trước.

## 7. Scope

IN: khung, sổ đăng ký 10 module, sơ đồ cả 10 module, hook chặn, test. OUT (đợt sau): trang Artifact tổng hợp để xem nhanh.

## 9. Rules

| ID | Luật |
|---|---|
| R1 | Mọi `navId` của tài nguyên quyền thuộc ĐÚNG một module trong `WORKFLOW_MODULES` |
| R2 | Sơ đồ có frontmatter `covers:` + `last_verified:`; sơ đồ là bản đọc nhanh, trỏ về R-id ba-spec + tên hàm, không chép spec |
| R3 | Bảng Ai được làm gì là phần sinh từ `DEFAULT_ROLE_PERMISSIONS`, nằm giữa dấu `gen:roles` |
| R4 | Mọi nhãn trạng thái / bước khai ở `labels` có mặt nguyên văn trong sơ đồ |
| R5 | Commit đụng file khớp `covers:` của sơ đồ mà sơ đồ không staged ⇒ chặn; `WORKFLOW_DOC_SKIP=1` bỏ qua có chủ đích |
| R6 | (người dùng 2026-11-03) Code của khu đổi ⇒ cùng commit sửa ≥ 1 file hướng dẫn thao tác (`tours:`) + ≥ 1 file hộp "?" (`guides:`) của khu, theo sơ đồ; chỉ sửa chính file tour / hộp "?" không bắt sơ đồ đổi theo |
| R7 | Xem trên app: trang `#/workflows` (tab từng khu, điện thoại ô chọn) hiện đúng file `docs/workflows/*.md` (Mermaid vẽ thành sơ đồ, bỏ dòng kỹ thuật); hộp "?" mọi trang có nút **Xem sơ đồ quy trình** mở đúng khu. Ai có vai trò cũng xem (tài liệu chỉ đọc) |

## 10. Acceptance Criteria

### AC-1 — Trang mới phải gán module · Maps to: F3, R1 · Test: unit
- **Given** danh sách `navId` của `PERMISSION_RESOURCES` **When** chạy test **Then** mỗi `navId` có đúng 1 module.
- **Assert:** số `navId` có số module khác 1 `== 0` (workflowDocs.test.ts AC-1).

### AC-2 — Frontmatter sơ đồ · Maps to: F3, R2 · Test: unit
- **Given** module có `doc` **When** chạy test **Then** file có `covers:` và `last_verified: YYYY-MM-DD`.
- **Assert:** số sơ đồ thiếu một trong hai dòng `== 0`.

### AC-3 — Bảng quyền khớp ma trận · Maps to: F2, R3 · Test: unit
- **Given** sơ đồ Xuất khẩu **When** đổi ma trận quyền mặc định mà không chạy lệnh sinh **Then** test đỏ; chạy `UPDATE_WORKFLOW_DOCS=1` ⇒ xanh.
- **Assert:** phần giữa `gen:roles` `==` `roleMatrixMarkdown(resources)` (3 bảng: `export-plans`, `export-plans.loading`, `export-plans.payments`).

### AC-4 — Nhãn trạng thái phủ đủ · Maps to: F2, R4 · Test: unit
- **Given** nhãn của Xuất khẩu (6 bước, 7 mục, 4 trạng thái mục, 5 trạng thái HĐ, 2 kết quả duyệt cuối, 3 trạng thái hồ sơ) **When** đổi một nhãn trong code mà không sửa sơ đồ **Then** test đỏ.
- **Assert:** số nhãn vắng mặt `== 0`.

### AC-5 — Hook chặn sơ đồ lệch · Maps to: F3, R5 · Test: manual
- **Given** commit sửa `src/lib/exportOptions.ts` **When** sơ đồ Xuất khẩu không staged **Then** commit bị chặn; sơ đồ staged hoặc `WORKFLOW_DOC_SKIP=1` ⇒ qua.
- **Assert:** worktree tạm 2026-11-03: không sơ đồ ⇒ in "Commit bị chặn" (exit 1); có sơ đồ ⇒ exit 0; bỏ qua ⇒ exit 0.

### AC-6 — Sơ đồ không vỡ · Maps to: R7 · Test: unit + manual
- **Given** 10 sơ đồ **When** chạy test **Then** không khối Mermaid nào có `;`; mở trang Quy trình từng khu ⇒ mọi sơ đồ vẽ ra.
- **Assert:** khối có `;` `== 0`; demo 2026-11-03: 34/34 sơ đồ có svg, 375px `scrollWidth == 375` cả 10 khu.

### AC-7 — Sửa khu ⇒ sửa 2 hướng dẫn · Maps to: R6 · Test: unit + manual
- **Given** commit chỉ sửa `SalesScreen.tsx` **When** hook chạy **Then** 3 lỗi (sơ đồ, tour, hộp "?"); thêm sơ đồ ⇒ 2; thêm `salesTour.ts` + `guideContent.tsx` ⇒ 0; chỉ sửa `salesTour.ts` ⇒ 0.
- **Assert:** worktree tạm 2026-11-03 đúng 3 / 2 / 0 / 0 lỗi; test: mỗi sơ đồ có `tours` ≥ 1 + `guides` ≥ 1, file có thật, mọi `*Tour.ts` thuộc ≥ 1 khu (23 file).

## 11. Assumptions / Open

- Sơ đồ Mermaid xem được trên GitHub và VS Code (bản xem trước Markdown); trên máy không có thì đọc bảng.
- Sơ đồ 9 module sau (2026-11-03) đối chiếu với code; chỗ tài liệu cũ lệch code ghi ở `docs/.escaped-drift.log` (Kho dự trữ: duyệt nhập kho là Quản đốc / Phó quản đốc, không phải Thủ kho).

## History
- 2026-11-03 — R6 (sửa khu ⇒ sửa tour + hộp "?"), R7 (xem trên app `#/workflows`, nút trong hộp "?"); thêm `marked` + `mermaid` (ghim bản).
- 2026-11-03 — đủ sơ đồ 10 module; `labels` từ hằng số `src/lib` của từng module.
- 2026-11-03 — v1 tạo + build (chủ dự án chốt 4 câu: module · Markdown + Mermaid · chặn commit + test · Xuất khẩu trước).
