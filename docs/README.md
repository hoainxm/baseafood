# docs/ — Bản đồ tài liệu Baseafood MES

Mục lục của mọi tài liệu. Cửa vào chung của repo vẫn là [`CLAUDE.md`](../CLAUDE.md) ở root (quy tắc code + risk tier + định tuyến task).
File này trả lời **một câu**: *doc nào ở đâu, và doc mới bỏ vào đâu.*

## 5 bucket — chia theo MỤC ĐÍCH

| Bucket | Đọc khi | Canonical cho |
|---|---|---|
| [`app-map/`](app-map/README.md) | **viết code** — cần ngữ cảnh 1 chủ đề | Kiến trúc, invariant nghiệp vụ, cạm bẫy — *cái không suy được từ code* |
| [`ops/`](ops/README.md) | **đưa app lên chạy** — cài đặt, deploy, cấu hình | Cutover Supabase, deploy Vercel, env, vận hành |
| [`spec/`](spec/) | **trước khi build** — chốt kiến trúc/đặc tả | ADR, đặc tả kỹ thuật (vd routing, naming) |
| [`trien-khai/`](trien-khai/README.md) | hiểu **vì sao nghiệp vụ vậy** | Phân tích gốc, 28 câu hỏi đã chốt, thiết kế flow, kế hoạch |
| [`BAN-GIAO.md`](BAN-GIAO.md) | **tiếp nhận dự án** | Bối cảnh công ty, đầu mối liên hệ, câu treo với xí nghiệp |

> Microcopy + luật UI **không** ở `docs/` — chúng nằm cạnh code tại
> [`src/design-system/README.md`](../src/design-system/README.md) (luật giao diện) và
> [`src/design-system/noi-dung-va-label.md`](../src/design-system/noi-dung-va-label.md) (nội dung/label). Canonical, không nhân bản sang đây.

## Doc MỚI bỏ vào đâu — luật quyết

Hỏi *"doc này trả lời câu gì?"* rồi tra:

| Doc trả lời… | Vào | Quy ước |
|---|---|---|
| "Sửa code chủ đề X thì đọc gì / invariant nào" | `app-map/` | 1 chủ đề/file · đánh số · frontmatter `covers:` trỏ source thật |
| "Cài / deploy / cấu hình / vận hành thế nào" | `ops/` | tên `<chủ-đề>.md`, không đánh số |
| "Quyết định kiến trúc / đặc tả trước khi build" | `spec/` | tên `<chủ-đề>.md`, ghi trạng thái (dự thảo/chốt) |
| "Vì sao nghiệp vụ vậy / phân tích / kế hoạch" | `trien-khai/` | đánh số theo thứ tự đọc |
| "Bàn giao, đầu mối, câu treo" | `BAN-GIAO.md` | 1 file duy nhất ở root docs |
| Chữ hiển thị / luật UI | `src/design-system/*.md` | **KHÔNG** vào `docs/` |

**Nguyên tắc chung** (theo [`ai-simple-product-dev`](../CLAUDE.md)): mỗi chủ đề **một file canonical** — không copy nội dung giữa file, chỉ **link**. Doc ghi cái *không suy được từ code*; danh sách hàm/prop thì đọc thẳng source.

### Đánh số trong `app-map/`
- `01–05` = hạ tầng (structure · navigation · database · tầng dữ liệu · bảo mật). Thêm chủ đề hạ tầng → số `0x` kế tiếp.
- `30–3x` = theo tính năng/màn (nhập hàng · bán hàng · cân đối · danh mục · BTP…). Thêm tính năng → số `3x` kế tiếp.
- Thêm file app-map ⇒ cập nhật bảng Index trong [`app-map/README.md`](app-map/README.md).

### Frontmatter chuẩn (doc gắn code)
```
> Load khi: <tình huống kích hoạt>
covers: <path1>, <path2>          # source thật — hook pre-commit dò doc lệch code
last_verified: YYYY-MM-DD          # sửa doc xong thì cập nhật
ttl_days: 90
```
Sửa doc xong ⇒ cập nhật `last_verified:`. Đổi code trong `covers:` mà doc đứng yên ⇒ hook cảnh báo.
