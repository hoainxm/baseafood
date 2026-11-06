# Việc của tôi · Tổng quan · Tài liệu — sơ đồ workflow

> Load khi: review / kiểm lại ba trang `/my-tasks` (Việc của tôi), `/dashboard` (Tổng quan), `/documents` (Tài liệu công ty); trước khi sửa luật hạn việc, giao việc, cảnh báo chuỗi, lần ban hành, xem tài liệu theo phòng ban. Bản đọc nhanh — luật đầy đủ ở [39-my-tasks](../app-map/39-my-tasks.md) · [59](../app-map/59-my-tasks-by-role.ba-spec.md) · [40-documents](../app-map/40-documents.md) · [55](../app-map/55-dashboard-modules.ba-spec.md) · spec che-do-demo §5b.
covers: src/features/my-tasks/*, src/features/dashboard/*, src/features/documents/*, src/lib/myTasks.ts, src/lib/dataFlow.ts, src/lib/dashboardAttention.ts, src/lib/documents.ts, src/lib/documentStorage.ts, src/features/workflows/*, src/lib/companyProfile.ts, src/lib/companyAssets.ts
tours: src/features/my-tasks/myTasksTour.ts, src/features/dashboard/dashboardTour.ts, src/features/documents/documentsTour.ts, src/features/workflows/workflowsTour.ts
guides: src/features/shared/guideContent.tsx, src/features/shared/guides/dashboardGuide.tsx
last_verified: 2026-11-06
ttl_days: 90

Sửa code trong `covers:` mà không sửa file này ⇒ commit bị chặn ([README](README.md) § Luật đồng bộ). Cả ba trang là màn xem / điều phối: số liệu do module khác ghi, ở đây chỉ đọc (trừ giao việc và tài liệu).

## 1. Các đối tượng và trạng thái

Không có một máy trạng thái chung. Có ba loại bản ghi: **việc** (hạn), **dòng giao việc** (`task_assignments`), **tài liệu**.

### 1a. Hạn của một việc (Việc của tôi)

```mermaid
stateDiagram-v2
  [*] --> upcoming: có hạn, chưa tới
  upcoming --> today: tới ngày hạn
  today --> overdue: qua ngày hạn
  [*] --> info: việc "để biết", không hạn
  state "Hạn dd/mm · Chưa có hạn" as upcoming
  state "Hạn hôm nay" as today
  state "Quá hạn N ngày" as overdue
  state "Để biết" as info
```

| Trạng thái | Nghĩa | Sang bước sau khi | Ai làm | Code |
|---|---|---|---|---|
| Hạn dd/mm · Chưa có hạn | Việc cần làm, hạn còn xa hoặc chưa đặt hạn | Qua thời gian; hoặc sổ được sửa thì việc biến mất | Người có quyền làm việc đó | `urgencyOf` · `defaultDueDate` |
| Hạn hôm nay | Đúng ngày hạn | Qua ngày hạn mà chưa xong | | `urgencyOf` |
| Quá hạn N ngày | Hôm nay đã qua ngày hạn | Sổ sửa xong thì tự hết | | `urgencyOf` |
| Để biết | Không có hạn, không đếm quá hạn (Ghi bù, Định mức lệch…) | — | | `DUE_OFFSET_DAYS` = `null` |

Hạn = ngày của việc + `DUE_OFFSET_DAYS[loại]`. Việc đếm từ `TASKS_START_DATE` (2026-09-01). Bộ lọc "Lọc theo hạn": **Cần làm** (mặc định) · **Quá hạn** · **Hôm nay** · **Để biết** · **Tất cả**.

### 1b. Dòng giao việc

```mermaid
stateDiagram-v2
  [*] --> open: Giao / Giao việc mới
  open --> done: Xong (người nhận)
  open --> done: sổ đã sửa (việc máy, tự đóng)
  open --> cancelled: Thu hồi (người giao)
  done --> open: Mở lại việc (người nhận, việc tay)
  state "open (đang mở)" as open
  state "Đã xong" as done
  state "Đã thu hồi" as cancelled
```

| Trạng thái | Nghĩa | Sang bước sau khi | Ai làm | Code |
|---|---|---|---|---|
| `open` (đang mở — tên trong code, app không có nhãn riêng) | Đã giao cho một người, có hạn. Người khác không thấy ở "Việc theo quyền" | Người nhận bấm **Xong**; hoặc việc máy được sửa xong ở sổ | Người có quyền giao (`my-tasks` Thêm) | `buildMyTasks` · `findResolvedAssignments` |
| Đã xong | Hiện ở "Tôi đã giao" thêm `DONE_VISIBLE_DAYS` (7) ngày. Việc tay: cũng hiện lại ở "Được giao cho tôi" của người nhận (lọc **Tất cả** / **Để biết**, nhãn Đã xong) cùng 7 ngày (`assignedDone`) | Người nhận chọn **Chi tiết** → **Mở lại việc** (báo Xong nhầm) ⇒ về `open`, xóa ngày xong, giữ hạn / ghi chú; có Hoàn tác. Việc máy không mở lại tay (tự đóng theo sổ) | Người nhận (cùng quyền với Xong; không khi Xem như) | `canReopenAssignment` · `reopenAssignment` · `TaskDetailDialog` |
| Đã thu hồi | Việc máy quay về danh sách chung theo quyền | — (hỏi trước, có Hoàn tác) | Người giao | `TaskAssignment.status` |

Màn tự đóng việc máy chỉ khi mọi sổ đã nạp xong từ máy chủ (tránh đóng nhầm khi sổ còn trống).

### 1c. Tài liệu

```mermaid
stateDiagram-v2
  [*] --> not_issued: Thêm tài liệu
  not_issued --> active: Ghi lần ban hành mới
  active --> active: Ghi lần ban hành mới (lần cũ hết hiệu lực)
  active --> withdrawn: Thu hồi
  withdrawn --> active: Mở lại (trạng thái tính lại theo các lần ban hành)
  active --> active: Xóa lần mới nhất ghi nhầm (lần trước trở lại hiệu lực)
  active --> not_issued: Xóa lần ban hành duy nhất ghi nhầm
  not_issued --> deleted: Xóa (chưa từng ban hành)
  state "Chưa ban hành" as not_issued
  state "Đang hiệu lực" as active
  state "Hết hiệu lực" as withdrawn
  state "Xóa (hỏi xác nhận, có Hoàn tác)" as deleted
```

| Trạng thái | Nghĩa | Sang bước sau khi | Ai làm | Code |
|---|---|---|---|---|
| Chưa ban hành | Tài liệu vừa thêm, chưa có lần ban hành nào | Ghi một lần ban hành đã ký giấy (có hiệu lực ngay). Xóa chỉ được ở trạng thái này | Người có quyền ghi tài liệu | `documentState` · `canDeleteDocument` |
| Dự thảo | Có lần ban hành nhưng chưa lần nào đang hiệu lực | Ghi lần ban hành mới | Người có quyền ghi | `DOCUMENT_STATE_LABELS` |
| Đang hiệu lực | Có một lần `active` | Ghi lần mới ⇒ lần cũ chuyển Hết hiệu lực từ ngày hiệu lực mới, không ghi đè. Ghi nhầm ⇒ **Xóa lần 0x** (chỉ lần mới nhất, hỏi trước, Hoàn tác): lần ngay trước trở lại Đang hiệu lực; xóa lần duy nhất ⇒ về Chưa ban hành | Ghi: người có quyền ghi · Xóa lần: thêm ô Xóa | `recordPaperVersion` · `versionDeleteBlocker` · `deleteLatestVersion` |
| Hết hiệu lực | Tài liệu đã thu hồi; mọi lần ban hành và file giữ nguyên, mở lại được | **Mở lại** | Người có quyền ghi | `documentState` |

- Lần ban hành còn thiếu file: **Đính PDF đã ký** / **Đính file gốc** (`attachVersionFile`).
- File đính nhầm (kể cả PDF của lần đang hiệu lực): **Thay PDF / Thay file gốc** · **Gỡ PDF / Gỡ file gốc** trong hộp chi tiết, hỏi trước, Hoàn tác, nhật ký. File cũ giữ ở kho file. Tài liệu đã thu hồi thì không (`replaceVersionFile` · `removeVersionFile`).
- Nội dung lần đã ban hành (ngày, người ký, nội dung sửa) vẫn không sửa — sai thì xóa lần mới nhất rồi ghi lại, hoặc ghi lần mới.
- Chứng nhận / hồ sơ năng lực có hạn: còn ≤ `DOCUMENT_EXPIRY_NOTICE_DAYS` (60) ngày hoặc đã hết ⇒ thành việc "Tài liệu sắp hết hạn", hạn việc = ngày hết hạn (`buildDocumentWarnings`, `expiryOf`).

## 2. Các bước của luồng

```mermaid
flowchart LR
  A["Module khác ghi sổ"] --> B["Cảnh báo chuỗi / Kế hoạch / hết hạn"]
  B --> C["Tổng quan: Việc cần đốc"]
  B --> D["Việc của tôi: theo quyền"]
  D -- Giao --> E["Được giao cho tôi"]
  D --> F["Mở việc: đúng màn, đúng ngày"]
  E --> F
  F --> G["Sổ sửa xong: việc tự hết"]
```

| Bước | Mục | Xong khi | Ai làm |
|---|---|---|---|
| 1 · Phát hiện | `buildChainWarnings` (chuỗi xưởng), `buildDocumentWarnings`, báo cáo Kế hoạch (`dashboardAttention.ts`) | Máy tự tính, không ai bấm | Máy |
| 2 · Xem tổng | Tổng quan: 4 thẻ, **Năm khâu của chuỗi**, **Phòng Kế hoạch**, **Việc cần đốc**; lọc kỳ + phân xưởng | Chỉ xem, không ghi | Người có quyền `dashboard` |
| 3 · Nhận việc | Việc của tôi: **Được giao cho tôi**, **Việc theo quyền của tôi** (quyền + phạm vi dòng, `canDoTask`), **Tôi đã giao** | Việc đã giao cho A thì B không thấy ở "theo quyền" (khỏi làm trùng) | Mọi người có vai trò |
| 4 · Giao việc | Nút **Giao** (việc máy) hoặc **Giao việc mới** (việc tay: tiêu đề, người nhận, hạn, màn cần mở) | Có dòng `task_assignments` còn mở | Người có `my-tasks` Thêm |
| 5 · Làm | **Mở việc** ⇒ mở đúng màn + ngày (`?date=&workshop=`); việc tay: **Xong** | Việc máy: sổ sửa xong. Việc tay: người nhận bấm Xong | Người nhận |
| 6 · Tài liệu | **Thêm tài liệu** ⇒ **Ghi lần ban hành mới** ⇒ đính PDF đã ký | Tài liệu Đang hiệu lực, có PDF (thẻ "Thiếu file PDF" hết đếm) | Người có quyền ghi tài liệu |

Việc Kế hoạch trong Việc của tôi (hạn theo `DUE_OFFSET_DAYS`, ba-spec 59). Nhãn gốc ở `PLANNING_ATTENTION_LABELS`:

| Module | Loại việc |
|---|---|
| Xuất khẩu | Quá hạn giao · Vượt dung sai · Thiếu dung sai · Còn tiền chưa về · Hồ sơ HĐ bổ sung sau |
| Nhập khẩu | Thiếu chứng từ · Chờ thực nhập |
| Lệnh sản xuất | Nháp quá ngày SX · Theo bản HĐ trước · Chưa gắn chuyến |
| Hóa đơn đại lý | Chuyến chờ HĐ đại lý · Chuyến lệch HĐ đại lý |

## 3. Chỗ bàn giao giữa bộ phận

```mermaid
sequenceDiagram
  participant SX as Bộ phận ghi sổ
  participant QD as Quản đốc / Kế toán
  participant NN as Người nhận việc
  participant PB as Các phòng ban
  SX->>SX: Ghi sổ, quên chốt hoặc gắn lô
  SX-->>QD: Việc theo quyền (Việc của tôi, Tổng quan)
  QD->>NN: Giao (kèm hạn)
  NN->>SX: Mở việc, sửa sổ
  NN-->>QD: Xong, hoặc sổ sửa xong ⇒ tự đóng
  QD->>PB: Ghi lần ban hành tài liệu
  PB-->>PB: Chỉ xem tài liệu của phòng mình
```

- Xem tài liệu: admin, Ban giám đốc (`SEE_ALL_DEPARTMENT`) hoặc chạy không đăng nhập thấy hết; người khác thấy tài liệu "cả công ty", của phòng mình, hoặc phòng được chọn (`canViewDocument`). Phòng ban của người = hợp phòng các vai trò (`departmentsOfRoles`).
- Ba lớp chặn đọc tài liệu: app, RLS, bucket `documents`. Đổi bảng phòng ban ở code ⇒ viết migration mới cho `current_user_departments()`.


## Trang Quy trình (`/workflows`)

Mục **Quy trình** ở thanh bên và nút **Xem sơ đồ quy trình** trong hộp **?** của mọi trang mở trang này. Tab từng khu (điện thoại: ô **Khu**) hiện đúng file sơ đồ `docs/workflows/` — chỉ đọc. Ai có vai trò cũng tự có quyền xem (`WORKFLOWS_RESOURCE` cấp ở `resolvePermissions`, như Tài liệu công ty), không cần đặt ở Vai trò &amp; quyền; chặn riêng một người vẫn được.

## Tab Thông tin công ty (`/documents?tab=company`, ba-spec 67)

Logo (chỉ chọn một ảnh; **Gỡ logo** ⇒ về logo có sẵn của phần mềm; đổi / gỡ đều hỏi hoặc có Hoàn tác, file cũ giữ lại), thông tin pháp nhân (tên VN / EN, viết tắt, MST, địa chỉ, nơi lập chứng từ, liên hệ, người ký), tài khoản ngân hàng thụ hưởng. Xem: mọi người có vai trò; Sửa: quyền `company-profile` (Kế toán trưởng, Trưởng / Phó phòng KH, admin). Chứng từ lập SAU khi lưu dùng thông tin mới (`companySellerOf`), chứng từ đã tải không đổi; mọi lần sửa có nhật ký.
## 5. Ai được làm gì

Sinh từ ma trận quyền mặc định (vai đã chỉnh ở /roles có thể khác). Admin luôn đủ quyền. `my-tasks` và `documents`: Xem do hệ thống tự cấp cho ai đã có quyền ở đâu đó (`resolvePermissions`).

<!-- gen:roles — sinh tự động từ src/lib/permissions.ts, đừng sửa tay -->
**Tổng quan** (`dashboard`)

| Vai | Xem | Xuất / In |
|---|---|---|
| Giám đốc | ✓ | ✓ |
| Phó giám đốc | ✓ | ✓ |
| Quản đốc xưởng Đông | ✓ |  |
| Quản đốc xưởng Cá | ✓ |  |
| Quản đốc xưởng Khô | ✓ |  |
| Phó quản đốc | ✓ |  |
| Kế toán trưởng | ✓ | ✓ |
| Kế toán | ✓ | ✓ |

**Việc của tôi** (`my-tasks`)

| Vai | Xem | Thêm | Sửa | Xóa |
|---|---|---|---|---|
| Quản đốc xưởng Đông | ✓ | ✓ | ✓ | ✓ |
| Quản đốc xưởng Cá | ✓ | ✓ | ✓ | ✓ |
| Quản đốc xưởng Khô | ✓ | ✓ | ✓ | ✓ |
| Phó quản đốc | ✓ | ✓ | ✓ |  |
| Kế toán trưởng | ✓ | ✓ | ✓ | ✓ |
| Kế toán | ✓ | ✓ | ✓ |  |
| Nhân viên Kế hoạch | ✓ | ✓ | ✓ | ✓ |
| Trưởng phòng Kế hoạch | ✓ | ✓ | ✓ | ✓ |
| Phó phòng Kế hoạch | ✓ | ✓ | ✓ | ✓ |

**Tài liệu công ty** (`documents`)

| Vai | Xem | Thêm | Sửa | Xóa | Duyệt | Xuất / In |
|---|---|---|---|---|---|---|
| Kế toán trưởng | ✓ | ✓ | ✓ | ✓ |  | ✓ |

**Thông tin công ty** (`company-profile`)

| Vai | Xem | Sửa |
|---|---|---|
| Kế toán trưởng | ✓ | ✓ |
| Trưởng phòng Kế hoạch | ✓ | ✓ |
| Phó phòng Kế hoạch | ✓ | ✓ |
<!-- /gen:roles -->

## 6. Nối với module khác

| Sang | Khi nào | Luật |
|---|---|---|
| Nhập hàng · Sản xuất · Kho · Cân đối | Việc chuỗi: chốt ngày nhập / SX, gắn lô, duyệt BTP, chốt kỳ, bán vượt tồn | ba-spec 39 · `taskRequirements` |
| Xuất khẩu · Nhập khẩu · Lệnh sản xuất | Việc Kế hoạch và khối Phòng Kế hoạch ở Tổng quan | ba-spec 55 · 59 |
| Danh mục · Quản trị | Phòng ban của vai trò (`app_roles.department`) quyết định xem tài liệu | ba-spec 40 |
| Chế độ demo | Tổng quan đọc dữ liệu demo khi admin bật; không số mẫu cứng | spec che-do-demo §5b |

## Lịch sử

- 2026-11-03 — tạo.
- 2026-11-06 — Việc của tôi: việc giao tay báo Xong nhầm mở lại được (hộp Chi tiết → Mở lại việc, có Hoàn tác).
