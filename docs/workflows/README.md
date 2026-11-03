# Sơ đồ workflow theo module

> Load khi: cần review / kiểm lại nhanh luật của một trang hoặc module; trước khi sửa code của module đã có sơ đồ; thêm module / trang mới. Oracle: ba-spec [65](../app-map/65-workflow-docs.ba-spec.md).

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

1. **Frontmatter**: `> Load khi:` · `covers:` (code của module) · `last_verified:` · `ttl_days: 90`.
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
| Hook pre-commit | Code trong `covers:` của một sơ đồ đổi mà file sơ đồ không đổi trong CÙNG commit ⇒ **chặn**. Thay đổi không đụng luật: sửa `last_verified:` cũng tính là đã soát; hoặc `WORKFLOW_DOC_SKIP=1 git commit` | `.githooks/pre-commit` § 3b |
| Test (CI) | Trang có quyền mà chưa gán module · sơ đồ thiếu frontmatter · bảng Ai được làm gì lệch ma trận quyền · nhãn trạng thái trong code vắng mặt trong sơ đồ | `src/lib/workflowDocs.test.ts` |

Đổi quyền mặc định ⇒ chạy lại phần sinh:

```bash
UPDATE_WORKFLOW_DOCS=1 npx vitest run src/lib/workflowDocs.test.ts
```

## Thêm sơ đồ cho một module

1. Chép khung của [export-planning.md](export-planning.md), đổi `covers:` sang code của module.
2. Trong `WORKFLOW_MODULES`: điền `doc`, `resources` (tài nguyên quyền), `labels` (hằng số nhãn trạng thái của module).
3. Chạy lệnh sinh ở trên, rồi `npx vitest run src/lib/workflowDocs.test.ts` cho xanh.
4. Đánh dấu ✅ ở bảng đầu file này.
