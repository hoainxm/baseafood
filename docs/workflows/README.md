# Sơ đồ workflow theo module

> Load khi: cần review / kiểm lại nhanh luật của một trang hoặc module; trước khi sửa code của module đã có sơ đồ; thêm module / trang mới. Oracle: ba-spec [65](../app-map/65-workflow-docs.ba-spec.md).

**Xem trên app:** mục **Quy trình** ở thanh bên, hoặc nút **?** của bất kỳ trang nào → **Xem sơ đồ quy trình** (mở đúng khu). Trang có tab từng khu; ai có vai trò cũng xem. App hiện đúng các file này.

Mỗi module MỘT file — đọc 5 phút là nắm: trạng thái, điều kiện chuyển, ai làm gì, nối sang đâu. Luật đầy đủ vẫn ở ba-spec của module; file ở đây là **bản đọc nhanh**, trỏ về R-id và tên hàm trong code, không chép lại spec.

| Module | Trang | Sơ đồ |
|---|---|---|
| Xuất khẩu | `/planning-export` | [export-planning.md](export-planning.md) ✅ |
| Nhập hàng | `/imports` · `/nxt-material` | [imports.md](imports.md) ✅ |
| Sản xuất | `/wip` · `/packaging` · `/qc` | [production.md](production.md) ✅ |
| Kho | `/warehouse` · `/monthly-stock` · `/qr` · `/nxt-warehouse` | [warehouse.md](warehouse.md) ✅ |
| Kinh doanh | `/sales` · `/orders` | [sales.md](sales.md) ✅ |
| Báo cáo & Cân đối | `/balancing` · `/production-report` · `/export-report` · `/nxt` · `/reconciliation` | [balancing.md](balancing.md) ✅ |
| Nhập khẩu | `/planning-import` | [import-planning.md](import-planning.md) ✅ |
| Lệnh sản xuất | `/planning-production` | [production-orders.md](production-orders.md) ✅ |
| Việc của tôi · Tổng quan · Tài liệu | `/my-tasks` · `/dashboard` · `/documents` | [overview.md](overview.md) ✅ |
| Danh mục · Quản trị | `/catalog` · `/admin` · `/users` · `/roles` · `/audit` | [system.md](system.md) ✅ |

Sổ đăng ký trong code: `WORKFLOW_MODULES` ở [`src/lib/workflowDocs.ts`](../../src/lib/workflowDocs.ts) — bảng này và sổ đó phải cùng danh sách.

## Mỗi file có gì (theo mẫu [export-planning.md](export-planning.md))

1. **Frontmatter**: `> Load khi:` · `covers:` (code của module) · `tours:` (file hướng dẫn thao tác của các trang) · `guides:` (file hộp "?") · `last_verified:` · `ttl_days: 90`.
<!-- updated: 2026-11-03 (c) — xem trên app (#/workflows, nút trong hộp "?"); luật đồng bộ thêm tours: + guides: -->
2. **Trạng thái** của đối tượng chính — sơ đồ Mermaid `stateDiagram-v2` + bảng: Trạng thái · Nghĩa · Sang bước sau khi · Ai làm · Code (hằng số / hàm).
3. **Các bước** của luồng — `flowchart` + bảng: Bước · Mục · Xong khi · Ai làm.
4. **Chỗ bàn giao giữa bộ phận** — `sequenceDiagram` khi có ≥ 2 bộ phận.
5. **Ai được làm gì** — phần SINH TỰ ĐỘNG giữa `<!-- gen:roles … -->` và `<!-- /gen:roles -->`, đừng sửa tay.
6. **Nối với module khác** — bảng Sang · Khi nào · Luật.
7. **Lịch sử** — một dòng mỗi lần đổi luật.

Viết bằng chữ người dùng đọc (nhãn đúng nguyên văn trên app), tên hàm / hằng số để trong `code`.

## Luật đồng bộ (máy chặn)

| Cổng | Bắt gì | Ở đâu |
|---|---|---|
| Hook pre-commit | Code trong `covers:` của một sơ đồ đổi (không tính chính file tour / hộp "?") ⇒ CÙNG commit phải có: **file sơ đồ** + **≥ 1 file hướng dẫn thao tác** (`tours:`) + **≥ 1 file hộp "?"** (`guides:`) của khu đó, thiếu ⇒ **chặn**. Không đụng luật: sửa `last_verified:` của sơ đồ; đổi kỹ thuật không đụng chữ người dùng đọc: `WORKFLOW_DOC_SKIP=1 git commit` | `.githooks/pre-commit` § 3b |
| Test (CI) | Sơ đồ thiếu `tours:` / `guides:` hoặc trỏ file không có · file tour mới chưa thuộc khu nào · dấu `;` trong sơ đồ Mermaid · trang có quyền mà chưa gán module · sơ đồ thiếu frontmatter · bảng Ai được làm gì lệch ma trận quyền · nhãn trạng thái trong code vắng mặt trong sơ đồ | `src/lib/workflowDocs.test.ts` |

Đổi quyền mặc định ⇒ chạy lại phần sinh:

```bash
UPDATE_WORKFLOW_DOCS=1 npx vitest run src/lib/workflowDocs.test.ts
```

## Thêm sơ đồ cho một module

1. Chép khung của [export-planning.md](export-planning.md), đổi `covers:` sang code của module.
2. Trong `WORKFLOW_MODULES`: điền `doc`, `resources` (tài nguyên quyền), `labels` (hằng số nhãn trạng thái của module).
3. Chạy lệnh sinh ở trên, rồi `npx vitest run src/lib/workflowDocs.test.ts` cho xanh.
4. Đánh dấu ✅ ở bảng đầu file này.
