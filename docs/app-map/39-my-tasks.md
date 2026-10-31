> Load khi: sửa màn `/my-tasks` "Việc của tôi", luật hạn / quá hạn, giao việc (`task_assignments`), chuông header, link mở thẳng ngày (`?date=&workshop=`).
covers: src/features/my-tasks/MyTasksScreen.tsx, src/features/my-tasks/AssignTaskDialog.tsx, src/features/my-tasks/index.ts, src/lib/myTasks.ts, supabase/migrations/0070_task_assignments.sql
last_verified: 2026-10-31
<!-- updated: 2026-10-31 (bộ lọc) — thêm bộ lọc theo ba-spec [53](53-filters.ba-spec.md): thêm ô Tra việc, người giao, người nhận. Khung chung FilterBar / SearchField, tổng theo dòng đang hiện, "Bỏ hết bộ lọc". -->
ttl_days: 90
<!-- updated: 2026-10-19 (b) — thêm nguồn việc thứ hai: `buildDocumentWarnings` (lib/documents.ts) — chứng nhận / hồ sơ năng lực còn ≤ 60 ngày hoặc đã hết hạn, CHỈ tài liệu người xem được (phòng ban); loại `document-expiring` (`DUE_OFFSET_DAYS` = 60 ⇒ hạn = ngày hết hạn), cần quyền `documents.update`; màn nạp thêm `company_documents` + `app_roles` và đợi bảng tài liệu "ready" trước khi tự đóng việc đã giao. Xem [40-documents](40-documents.md). -->
<!-- updated: 2026-10-19 — tạo mới: màn Việc của tôi + giao việc + link mở thẳng ngày. `0070` ✅ đã chạy trên DB thật 2026-10-19 (kiểm: RLS + 4 policy authenticated, 19 cột, 2 trigger, 22 ô ma trận my-tasks). -->

# Việc của tôi (`/my-tasks`)

Màn cá nhân: **việc người đang đăng nhập phải làm, hạn từng việc, cảnh báo quá hạn, một chạm tới đúng màn + đúng ngày để làm**. Mục đầu tiên trên nav, có số đỏ = việc đang được giao cho tôi. Chuông header (trước là số giả `3`) nay cũng là số đó, bấm mở màn này.

## Vì sao có màn này (phân tích flow 2026-10-19)

- App đã **tự phát hiện việc tồn** (`buildChainWarnings` ở `lib/dataFlow.ts`: ngày nhập / SX chưa chốt, sổ đổi sau chốt, bán vượt tồn, chưa gắn lô, BTP chờ duyệt, kỳ cân đối chưa chốt, định mức lệch, ghi bù) — nhưng chỉ hiện ở **Tổng quan**, mà **thủ kho + tổ trưởng không có quyền xem Tổng quan** ⇒ chính người phải làm không thấy việc.
- Banner `DailyTaskReminder` chỉ nhắc **hôm nay** và chỉ khi đã mở đúng màn — ngày cũ sót không ai nhắc.
- Link "Mở" ở Tổng quan chỉ mở màn (`/imports`), người dùng phải tự tìm ngày.
- Việc chỉ gắn **vai trò** — hai người cùng vai trò thấy cùng việc, không biết ai làm. Chủ dự án chốt (2026-10-19): **thêm giao việc cho từng người**.

## Ba mục trên màn (hàm thuần `buildMyTasks`, `lib/myTasks.ts`)

| Mục | Nguồn | Khi nào hết |
|---|---|---|
| **Được giao cho tôi** | dòng `task_assignments` có `assigneeId` = tôi, `status = open` | việc máy: sổ sửa xong (cảnh báo biến mất) · việc tay: người nhận bấm **Xong** |
| **Việc theo quyền của tôi** | cảnh báo chuỗi mà tôi **có quyền làm trên dòng thuộc phạm vi của tôi** (`canOnRow`: quản đốc = xưởng mình, tổ trưởng = mẻ mình ghi), **chưa giao cho ai** | sổ sửa xong |
| **Tôi đã giao** | dòng tôi giao cho người khác (đang mở + đã xong / thu hồi trong `DONE_VISIBLE_DAYS` = 7 ngày) | — |

Việc đã giao cho người A **không còn** ở "theo quyền" của người B (khỏi làm trùng). Thu hồi ⇒ quay lại danh sách chung.

**Ai làm được việc gì** (`taskRequirements` — có MỘT quyền là đủ):

| Loại (`FlowWarningKind`) | Quyền |
|---|---|
| `imports-unlocked` | `imports.lock` |
| `production-unlocked` | `wip.lock` |
| `changed-after-lock` | `imports.update` |
| `lot-unassigned` | `wip.update` (mẻ) · `packaging.update` (phiếu đóng gói) |
| `approval-overdue` | `warehouse.approve` |
| `oversold` | `warehouse.approve` hoặc `sales.update` |
| `period-unlocked` | `balancing.lock` |
| `backdated` (để biết) | `imports.unlock` / `wip.unlock` |
| `yield-deviation` (để biết) | `wip.unlock` hoặc `balancing.update` |
| `period-yield-deviation` (để biết) | `balancing.update` |

Admin có mọi quyền ⇒ thấy mọi việc.

## Hạn + quá hạn (chủ dự án chốt 2026-10-19)

Hạn = ngày của việc + `DUE_OFFSET_DAYS[loại]`. Quá hạn khi **hôm nay > hạn**; đúng ngày hạn = "Hạn hôm nay".

| Việc | Hạn |
|---|---|
| Chốt ngày nhập / SX · gắn lô · sổ đổi sau chốt · bán vượt tồn | trong ngày (quá hạn từ hôm sau) |
| Duyệt BTP vào kho | ngày SX + `APPROVAL_WAIT_DAYS` (3) |
| Chốt kỳ cân đối | ngày cuối kỳ + `PERIOD_LOCK_GRACE_DAYS` (2) |
| Ghi bù · định mức lệch | không hạn — mục "Để biết", không đếm quá hạn |
| Việc được giao | hạn người giao đặt (mặc định = hạn của loại việc, đã qua thì lấy hôm nay) |

**Mốc bắt đầu tính:** `TASKS_START_DATE = 2026-09-01` (ngày chạy số thật). Số T7–T8 nạp bù lúc cutover chưa từng chốt theo nhịp ngày — tính vào là báo quá hạn hàng loạt giả. Màn gọi `buildChainWarnings(d, {01/09 → hôm nay}, hôm nay, …, { includeToday: true, approvalWaitDays: 0 })`: **tính cả hôm nay** (Tổng quan thì không) và **mọi mẻ đang chờ duyệt** (Tổng quan chỉ mẻ > 3 ngày).

Bộ lọc "Lọc theo hạn": **Cần làm** (mặc định — bỏ "để biết") · Quá hạn · Hôm nay · Để biết · Tất cả. Thao tác trình bày ⇒ không toast.

## Giao việc (`task_assignments`, mig `0070`)

- **Việc máy phát hiện** (`source = 'system'`, `task_key` = id cảnh báo, vd `ccn|2026-10-12|Đông`): nút **Giao** ở mục "theo quyền". Tự hết khi cảnh báo biến mất. Màn **tự đóng** (ghi `status = done`, `done_at`) các việc máy đã sửa xong — CHỈ khi mọi sổ đã nạp xong từ máy chủ (`useTraceData().isReady` + các bảng chốt / kỳ / giao việc `ready`); đang tải dở thì sổ trống ⇒ tưởng sửa xong ⇒ đóng nhầm. Không toast (không phải thao tác người dùng).
- **Việc giao tay** (`source = 'manual'`): nút **Giao việc mới** — tiêu đề, người nhận, hạn, màn cần mở (+ ngày / xưởng với `/imports`, `/wip`, `/packaging`), ghi chú. Người nhận bấm **Xong**.
- **Sửa** (đổi người / hạn / ghi chú) · **Thu hồi** (`status = cancelled`, hỏi trước + toast Hoàn tác — không xóa dòng, quy tắc 6).
- Hộp giao việc tự lưu nháp (`useDialogDraft`, form `my-tasks-assign`, quy tắc 17); bản gốc khi sửa nằm trong form để mở lại từ nháp vẫn đủ.
- Người nhận: hồ sơ có vai trò (`useUserProfiles`). **Chế độ demo / chạy chỉ máy này** không có danh sách (hồ sơ là `site` thật) ⇒ chỉ giao được cho chính mình. Chọn người có vẻ thiếu quyền (theo ma trận mặc định) ⇒ gợi ý dưới ô, không chặn.
- Không khóa ngoại tới `user_profiles`: `assignee_name` / `assigned_by_name` chụp tên lúc giao.

**Quyền** (`my-tasks`, `lib/permissions.ts`): **xem** — ai có quyền ở bất kỳ đâu cũng được (`resolvePermissions` tự cấp, kể cả vai trò đã chỉnh ở `/roles`; không quyền gì ⇒ vẫn "Chưa được cấp quyền"); **giao (create) / sửa (update)** — quản đốc, phó QĐ, kế toán, kế toán trưởng; **thu hồi (delete)** — quản đốc, kế toán trưởng (người giao luôn thu hồi được việc mình giao). Giám đốc **không** giao mặc định (quyết định "giám đốc chỉ xem + xuất") — admin bật ở `/roles` nếu cần. Trang chủ vai trò không đổi; `homeFor` chỉ lấy `my-tasks` khi không còn màn nghiệp vụ nào.

**Ghi:** `TABLE_WRITE_RULES.task_assignments = null` — giao việc là ghi chú điều phối, không phải sổ sách; người nhận phải tự bấm Xong được dù không có quyền giao. Máy chủ chặn người không vai trò bằng RLS `co_vai_tro()`; bảng không gắn trigger 0065.

## Link mở thẳng ngày (`?date=&workshop=`)

`dayPath(base, date, workshop)` (lib/dataFlow.ts) dựng link; `parseDayLink` / `withoutDayLink` đọc + gỡ. Mọi cảnh báo chốt ngày / ghi bù / gắn lô nay mang link này (cả ở Tổng quan).

| Màn | Hành vi khi mở link |
|---|---|
| `/imports` | sang **Sổ chi tiết** đúng ngày + xưởng. Đợi nháp mở lại xong; nháp đang dở giữ nguyên (bấm "Ghi nhập" thấy lại); không có nháp thì bỏ phiếu trống tự mở ⇒ "Ghi nhập" mở đúng ngày link |
| `/wip` | sang **Sổ ngày & báo cáo** đúng ngày + xưởng, như trên. Xưởng của link KHÔNG ghi đè xưởng nhớ theo máy |
| `/packaging` | bộ lọc về đúng ngày + xưởng (màn luôn là sổ ngày) |

Tham số gỡ khỏi URL ngay sau khi đọc (`replace`), giữ tham số khác.

## Chuông header + số trên nav

`ShellLayout` (App.tsx) đọc **chỉ** bảng giao việc → `countMyOpenAssignments` (việc giao cho tôi đang mở). Khung app KHÔNG nạp ~20 sổ chỉ để đếm (mỗi `useTable` tự tải riêng ⇒ nặng trên điện thoại xưởng). Hệ quả: việc máy đã sửa xong mà chưa ai mở màn "Việc của tôi" vẫn được đếm tới khi màn tự đóng nó.

## Tô màu dòng

`rowMarkKey="my-tasks|assigned" | "my-tasks|mine" | "my-tasks|delegated"`; khóa dòng = id cảnh báo / id dòng giao việc.

## Kiểm

- Test: `lib/myTasks.test.ts` (hạn từng loại, quá hạn, quyền + phạm vi, không trùng khi đã giao, tự hết, đếm chuông) · `lib/dataFlow.test.ts` (`dayPath`/`parseDayLink`, `includeToday`, `approvalWaitDays`, `period-unlocked`) · `nav-access.test.ts` (ai thấy / ai giao) · `writePermissionsSql.test.ts` (ma trận 0070 = code).
- Thử tay 2026-10-19 trên `baseafood-demo` (localStorage): 6 việc quá hạn đúng số ngày · Mở việc → `/imports` sổ chi tiết 06/10 Đông 13.182 kg, "Ghi nhập" mở phiếu 06/10 · giao → "Được giao" 1, "theo quyền" 6→5, chuông + nav = 1 · chốt ngày 06/10 ⇒ việc tự đóng, chuông 0 · `/wip?…Cá` mở sổ ngày Cá, xưởng nhớ theo máy vẫn Đông · việc tay + Xong · 360px + 130% không cuộn ngang trang.

## Còn để sau

- Hoãn nhắc / "đã xem" từng việc; thông báo đẩy (Zalo / điện thoại).
- Đếm chuông gồm cả việc máy theo quyền (cần nạp sổ nhẹ ở máy chủ, vd view / RPC đếm).
- Gắn xưởng cho phó QĐ / tổ trưởng để lọc "theo quyền" mịn hơn (hiện phó QĐ chưa giới hạn xưởng — spec role-permissions Đợt 5).
