# 59 — ba-spec: Việc của tôi theo nhóm trang của vai + admin xem như vai / người

> Load khi: sửa "Việc của tôi" (`/my-tasks`) — nguồn việc, ai được nhắc việc gì, cách gom theo nhóm trang, chế độ admin xem như một vai trò / một người dùng.
covers: src/lib/myTasks.ts, src/features/my-tasks
last_verified: 2026-11-02
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — `lib/myTasks.ts` (`TaskKind`, `planningTaskWarnings`, `taskKindLabel`, `taskGroupOf`, `groupTasks`, `parseViewAs`, `viewAsContext`; test AC-1…AC-6, AC-9, AC-10), `MyTasksScreen.tsx` (nạp Nhập khẩu / Lệnh SX / Xuất khẩu / HĐ đại lý; khối theo nhóm; admin tổng hợp; thanh Xem như `?viewAs=role:<id>` / `user:<id>`, chỉ xem), tour + hộp "?" (AC-11). Thử tay 2026-11-02 trên app dev chế độ demo: xem như planner chỉ nhóm Kế hoạch · Xuất khẩu, 0 nút ghi; admin 5 nhóm; 360px × 130% không tràn. AC-7 / AC-8 kiểm tay (không có nút ghi; việc tiền về theo `export-plans.payments`). Mở rộng [39](39-my-tasks.md) (giữ nguyên 3 mục, hạn, giao việc, chuông) + làm phần "Việc của tôi chưa nhận việc kế hoạch" mà [55](55-dashboard-modules.ba-spec.md) R8 để lại.

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của design-spec). Không đổi quyền, RLS, bảng.

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-02, nguyên văn: "mỗi chức vụ được nhắc các công việc theo từng nhóm trang chức năng phân chia cho role đó, ghi theo quy tắc trong hệ thống, ví dụ hiện tại phòng ban kế hoạch thì nhắc việc 3 nhóm trang gồm Nhập khẩu, Lệnh sản xuất và Xuất khẩu. Tài khoản admin xem được giao diện trang nhắc việc theo từng role khác nhau để biết chỉnh sửa, hiện tại xem tất cả việc của hệ thống nên rất rối".
- **Hiện nay:** Việc của tôi chỉ có việc chuỗi xưởng (`buildChainWarnings`) + tài liệu sắp hết hạn; việc Kế hoạch mới ở Tổng quan (55). Admin có mọi quyền ⇒ danh sách phẳng gồm MỌI việc. Admin không có cách thấy vai X được nhắc gì.
- **Job:** (a) Mỗi người mở Việc của tôi thấy đúng việc của các nhóm trang mình được phân, gom theo nhóm. (b) Admin chỉnh ma trận quyền ở `/roles` rồi kiểm ngay "vai X / người Y giờ được nhắc gì".
- **Đo thành công:** Nhân viên Kế hoạch thấy việc chỉ ở nhóm Kế hoạch; admin chọn một vai thấy đúng danh sách người có vai đó thấy (lệch = 0).

## 2. User registry

| ID | User | Bối cảnh |
|---|---|---|
| U1 | Người dùng có vai (Kế hoạch, quản đốc, tổ trưởng, thủ kho, kế toán, BGĐ…) | mở Việc của tôi đầu ngày |
| U2 | Admin | chỉnh vai trò & quyền ở `/roles`, cần kiểm kết quả |
| S1 | Hệ thống: `buildChainWarnings` · `buildDocumentWarnings` · việc Kế hoạch / HĐ đại lý của `dashboardAttention.ts` (55) · `resolvePermissions` + `scopeContextFor` + `canOnRow` (permissions.ts) | tính lại khi đổi dữ liệu / người xem |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Nhận việc Kế hoạch (Nhập khẩu · Lệnh SX · Xuất khẩu) + HĐ đại lý trong Việc của tôi, theo quyền từng mục | U1 | U2 | 55 R1–R3 | Must |
| NV2 | Xem việc gom theo nhóm trang của vai, mỗi nhóm một khối có số quá hạn | U1 | — | NV1 | Must |
| NV3 | Admin mặc định: tổng hợp theo nhóm trang (đếm), mở nhóm mới xem chi tiết; cộng việc giao cho admin | U2 | — | NV2 | Must |
| NV4 | Admin xem như MỘT VAI TRÒ — chỉ xem | U2 | U1 (vai đó) | NV2 | Must |
| NV5 | Admin xem như MỘT NGƯỜI DÙNG — chỉ xem | U2 | U1 (người đó) | NV2 | Must |
| NV6 | Hướng dẫn + hộp "?" kể nhóm trang, chế độ xem như (QT 18) | S1 | mọi user | NV1–NV5 | Must |

## 4. Cross-user handoff map

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện | Điểm kết nếu treo |
|---|---|---|---|---|---|
| H1 | NV4/NV5 → `/roles` | U2 (thấy vai X thiếu / thừa việc) | U2 sửa ma trận ở `/roles` | sau khi xem | không sửa ⇒ không đổi gì (xem như không ghi) |
| H2 | NV1 | S1 | U1 có quyền mục đó | việc còn điều kiện ở màn gốc (55 R1) | việc tự hết khi màn gốc xử lý xong |

## 5. Flows

### Flow NV1 — Việc Kế hoạch vào Việc của tôi · owner U1
- **Input:** việc của `buildPlanningAttention` + `buildSupplierInvoiceAttention` (55) — đọc lại hàm báo cáo module, KHÔNG luật mới; kỳ = từ `TASKS_START_DATE` tới hôm nay (như việc chuỗi).
- **Steps:** mỗi loại việc gắn quyền cần (R2) → giữ việc người xem làm được trên dòng thuộc phạm vi (`canOnRow`).
- **Output:** việc Kế hoạch / HĐ đại lý ở mục "Việc theo quyền của tôi", có hạn (R3), mở thẳng màn gốc; giao việc được như việc chuỗi.

### Flow NV2 — Gom theo nhóm trang · owner U1
- **Steps:** nhóm của việc = nhóm của tài nguyên quyền đầu tiên nó cần (`RESOURCE_GROUP_LABELS`: Nhập hàng · Sản xuất · Kho · Bán hàng · Kế toán · Kế hoạch · Tài liệu); trong Kế hoạch tách tiếp Nhập khẩu · Lệnh sản xuất · Xuất khẩu theo màn.
- **Output:** chỉ các nhóm có ≥ 1 việc của người xem; mỗi nhóm ghi số việc, số quá hạn, số hôm nay; trong nhóm xếp như cũ (quá hạn → hôm nay → sắp tới → để biết). Bộ lọc hạn hiện có áp lên mọi nhóm.

### Flow NV3 — Admin mặc định · owner U2
- **Output:** mục "Được giao cho tôi" + "Tôi đã giao" như cũ; mục việc theo quyền thành **tổng hợp theo nhóm trang** (mỗi nhóm: số việc · quá hạn · hôm nay), chọn một nhóm ⇒ thấy việc của nhóm đó.

### Flow NV4 — Xem như vai trò · owner U2
- **Input:** một vai trong `app_roles` (đúng ma trận quyền đang lưu ở `/roles`); vai có phạm vi xưởng (quản đốc) ⇒ theo xưởng của vai (`scopeContextFor`).
- **Steps:** tính quyền thực của vai đó (`resolvePermissions({ roles: [vai], isAdmin: false, rolePermissions })`) → dựng việc như người có đúng vai đó.
- **Output:** trang hiện việc của vai X, gom theo nhóm (NV2), có dải "Đang xem như vai X — chỉ xem" + thoát; KHÔNG có mục "Được giao cho tôi" / "Tôi đã giao" (vai không phải người); mọi thao tác ghi (giao việc, Xong, thu hồi) không có.
- **Edge:** vai có phạm vi "mẻ mình ghi" (tổ trưởng) ⇒ không có người cụ thể nên hiện câu "phạm vi theo người ghi — chọn Xem như người dùng để thấy đúng".

### Flow NV5 — Xem như người dùng · owner U2
- **Input:** một tài khoản (`user_profiles`) đang dùng.
- **Steps:** quyền thực của người đó (vai + chỉnh riêng) + phạm vi (`scopeContextFor(vai, họ tên, tên đăng nhập)`) + việc giao cho người đó / người đó đã giao.
- **Output:** đúng 3 mục người đó thấy, gom theo nhóm; dải "Đang xem như <họ tên> — chỉ xem"; không thao tác ghi.

### Flow NV6 — Nội dung
- **Output:** tour + hộp "?" nói: việc gom theo nhóm trang của vai; nhóm Kế hoạch gồm Nhập khẩu · Lệnh sản xuất · Xuất khẩu; (admin) tổng hợp theo nhóm, Xem như vai / người là chỉ xem.

## 6. Flow optimization log

| Flow | Candidate | Chọn | Lý do | Đánh giá bởi |
|---|---|---|---|---|
| NV4/5 | xem như vai · xem như người · cả hai | **cả hai** (chủ dự án) | vai để chỉnh ma trận; người để kiểm một tài khoản (quyền chỉnh riêng, xưởng, việc được giao) | Chủ dự án |
| NV3 | tổng hợp theo nhóm · chỉ việc giao cho admin | **tổng hợp theo nhóm** (chủ dự án) | admin vẫn nắm được toàn cục nhưng không bị ngợp | Chủ dự án |
| NV2 | khối theo nhóm · danh sách phẳng + lọc | **khối theo nhóm** (chủ dự án) | đúng "nhắc theo từng nhóm trang" của yêu cầu | Chủ dự án |
| NV1 | theo quyền từng mục · chỉ Trưởng / Phó phòng | **theo quyền từng mục** (chủ dự án) | đúng luật sẵn có của Việc của tôi (`taskRequirements`); thủ kho nhận "Chờ thực nhập" | Chủ dự án + Optimizer |
| NV2 | nhóm tự đặt · nhóm theo `RESOURCE_GROUP_LABELS` | **nhóm hệ thống** | "ghi theo quy tắc trong hệ thống"; đổi nhóm của tài nguyên ở một chỗ | Optimizer |
| NV4 | giả lập bằng cách đổi vai thật của admin · tính quyền thuần ở máy | **tính thuần** | không đụng `user_profiles` / RLS; thoát là hết | Domain (bảo mật) — VETO cách đổi vai thật |

## 7. Scope & Priority

- **IN:** NV1–NV6.
- **OUT:** đổi ma trận quyền; thông báo đẩy; chuông đếm cả việc theo quyền (39 "để sau"); xem như với quyền giá (xem như vẫn ẩn giá nếu vai không có `view-price` — R6).

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV1 | việc Kế hoạch ở Tổng quan mà người có quyền mục đó không thấy ở Việc của tôi | = 0 |
| NV2 | việc của nhóm trang vai không được phân xuất hiện | = 0 |
| NV4 | danh sách khi admin xem như vai X so với người chỉ có vai X | lệch = 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Việc Kế hoạch / HĐ đại lý lấy từ CHÍNH hàm của 55 (`buildPlanningReports` + `buildPlanningAttention` + `buildSupplierInvoiceAttention`); không luật mới. | bảng chưa có trên DB ⇒ không việc loại đó |
| R2 | Quyền cần (có MỘT là đủ): Xuất khẩu `overdue` · `over/under-tolerance` · `deferred-attachment` ⇒ `export-plans.update`; `unpaid` ⇒ `export-plans.payments.update`; Nhập khẩu `missing-docs` ⇒ `import-plans.update`; `awaiting-quantity` ⇒ `import-plans.receiving.update` hoặc `import-plans.update`; Lệnh SX mọi loại ⇒ `production-orders.update`; HĐ đại lý ⇒ `imports.invoices.update` (theo xưởng của chuyến). | quản đốc chỉ xem lệnh ⇒ không nhận việc lệnh |
| R3 | Hạn: Quá hạn giao = hạn giao (đã qua ⇒ quá hạn); Thiếu chứng từ · Chờ thực nhập = ngày về + 3; Nháp quá ngày SX · Chưa gắn chuyến = ngày SX đầu; Theo bản HĐ trước · Chuyến lệch HĐ đại lý = trong ngày; Chuyến chờ HĐ đại lý = ngày về + 10; Còn tiền chưa về · Hồ sơ HĐ bổ sung sau = không hạn (Chưa làm, không đếm quá hạn); Vượt / Thiếu dung sai = Để biết. | ngày rỗng ⇒ hạn hôm nay |
| R4 | Nhóm của việc = nhóm (`group`) của tài nguyên quyền ĐẦU TIÊN ở R2 / `taskRequirements`; nhãn = `RESOURCE_GROUP_LABELS`; Kế hoạch tách tiếp theo màn (Nhập khẩu · Lệnh sản xuất · Xuất khẩu). | `oversold` ⇒ Kho |
| R5 | Xem như (vai / người) KHÔNG ghi gì, không đổi quyền / vai thật, không lưu vào máy chủ; thoát ⇒ về trang của admin. Mọi thao tác ghi ẩn khi đang xem như. | — |
| R6 | Xem như dùng đúng quyền của vai / người (gồm `view-price`): vai không xem giá ⇒ việc "Còn tiền chưa về" và số tiền không hiện. | — |
| R7 | Xem như vai lấy ma trận đang lưu (`/roles`), không ma trận mặc định. Xem như người = vai + chỉnh riêng của người đó. | ma trận đang nạp ⇒ chờ, không dùng tạm |
| R8 | Admin mặc định (NV3): số đếm mỗi nhóm = số việc của mọi người trong nhóm đó (việc không trùng). | — |
| R9 | Chỉ admin có Xem như; người thường không thấy, gõ link cũng không vào chế độ này. | — |

## 9b. Kiểm kê nội dung (NV6)

| Khu vực | Mục | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Khối nhóm trang | nhóm | việc gom theo nhóm trang của vai; số quá hạn / hôm nay mỗi nhóm | R4 |
| Nhóm Kế hoạch | 3 màn | Nhập khẩu · Lệnh sản xuất · Xuất khẩu; ai nhận loại nào | R2 |
| Loại việc mới | 12 nhãn | nhãn nguyên văn từ `PLANNING_ATTENTION_LABELS` + hạn | 55 R3, R3 |
| Admin | tổng hợp | đếm theo nhóm, chọn nhóm để xem | NV3 |
| Admin | Xem như | vai / người, chỉ xem, thoát | R5–R7 |

## 10. Acceptance Criteria

### AC-1 — Việc Kế hoạch theo quyền mục · NV1 · Test: unit
- **Given** việc "Thiếu chứng từ", "Chờ thực nhập", "Nháp quá ngày SX"; người A có `import-plans.update`, người B chỉ `import-plans.receiving.update`
- **When** dựng Việc của tôi
- **Then** A thấy Thiếu chứng từ + Chờ thực nhập; B chỉ thấy Chờ thực nhập; không ai thấy Nháp quá ngày SX
- **Assert** `A.mine.length == 2` · `B.mine.map(k=>k.kind)` deep-equals `["import-awaiting-quantity"]`

### AC-2 — Hạn việc Kế hoạch · NV1 · Test: unit
- **Given** "Chờ thực nhập" ngày về 2026-10-28; hôm nay 2026-11-02
- **When** tính hạn
- **Then** hạn 31/10, quá hạn 2 ngày
- **Assert** `dueDate == "2026-10-31"` · `urgency == "overdue"` · `overdueDays == 2`

### AC-3 — Nhóm theo tài nguyên quyền · NV2 · Test: unit
- **Given** việc imports-unlocked, oversold, export-overdue, order-unlinked
- **When** gom nhóm
- **Then** Nhập hàng · Kho · Kế hoạch/Xuất khẩu · Kế hoạch/Lệnh sản xuất
- **Assert** nhãn nhóm deep-equals `["Nhập hàng","Kho","Kế hoạch","Kế hoạch"]` và màn con `["","","Xuất khẩu","Lệnh sản xuất"]`

### AC-4 — Vai chỉ thấy nhóm được phân · NV2 · Test: unit
- **Given** ma trận: planner chỉ có quyền ở 3 trang Kế hoạch; có việc ở mọi nhóm
- **When** dựng việc cho người chỉ có vai planner
- **Then** chỉ nhóm Kế hoạch
- **Assert** `groups.map(g=>g.group)` deep-equals `["planning"]`

### AC-5 — Xem như vai = người chỉ có vai đó · NV4 · Test: unit
- **Given** ma trận đang lưu; người P chỉ có vai "frozen-workshop-manager"
- **When** admin xem như vai frozen-workshop-manager
- **Then** danh sách việc trùng với của P (trừ mục giao việc)
- **Assert** id việc theo quyền của hai bên bằng nhau (lệch `== 0`)

### AC-6 — Xem như người gồm chỉnh riêng + việc được giao · NV5 · Test: unit
- **Given** người Q có vai planner + bị chặn riêng `production-orders.update`; có 1 việc giao cho Q
- **When** admin xem như Q
- **Then** không có việc Lệnh SX; mục Được giao có 1 việc
- **Assert** `mine.filter(k=>k.group==="planning" && k.page==="production-orders").length == 0` · `assigned.length == 1`

### AC-7 — Xem như không ghi · NV4/NV5 · Test: unit
- **Given** chế độ xem như
- **When** dựng mô hình trang
- **Then** không thao tác ghi nào được mở
- **Assert** `actions.canAssign == false && actions.canComplete == false && actions.canRevoke == false`

### AC-8 — Xem như tôn trọng quyền giá · NV4 · Test: unit
- **Given** vai có `export-plans.update` mà không có `export-plans.payments.update` lẫn `view-price`; HĐ còn tiền chưa về
- **When** xem như vai đó
- **Then** không có việc "Còn tiền chưa về"
- **Assert** số việc kind `export-unpaid` `== 0`

### AC-9 — Admin mặc định tổng hợp theo nhóm · NV3 · Test: unit
- **Given** admin, 3 việc Nhập hàng (1 quá hạn), 2 việc Kế hoạch
- **When** dựng tổng hợp
- **Then** 2 nhóm với số đúng
- **Assert** `summary` deep-equals `[{group:"imports",count:3,overdue:1}, {group:"planning",count:2,overdue:0}]` (thứ tự theo nhóm hệ thống)

### AC-10 — Người thường không có Xem như · NV4 · Test: unit
- **Given** người không phải admin, link có tham số xem như
- **When** mở trang
- **Then** bỏ qua tham số, trang của chính người đó
- **Assert** `viewAs == null`

### AC-11 — Lời hướng dẫn đủ nhóm + nhãn · NV6 · Test: unit
- **Given** nhãn nhóm `RESOURCE_GROUP_LABELS` dùng ở trang + 12 nhãn việc Kế hoạch
- **When** đọc tour + hộp "?" Việc của tôi
- **Then** có đủ
- **Assert** số nhãn thiếu `== 0`

## 11. Assumptions / Open

- **Assumptions:** (a) hạn R3 do BA đặt theo nhịp các module (chưa có số chủ dự án chốt riêng); (b) "Xem như" chọn vai từ danh sách vai đang có ở `/roles`, chọn người từ danh sách tài khoản đang dùng; (c) vai tổ trưởng (phạm vi theo người ghi) khi xem như vai ⇒ chỉ hiện câu nhắc chọn người (NV4 edge); (d) xem như giữ trong đường link trang (mở lại / gửi cho admin khác vẫn đúng), không lưu máy chủ.
- **Open (RED):** không có.

## History

- v1 (2026-11-02): khởi tạo — chủ dự án chốt: xem như vai + người · admin mặc định tổng hợp theo nhóm · mỗi nhóm trang một khối · việc Kế hoạch theo quyền từng mục.
