> Load khi: làm phân quyền theo vai trò / người dùng (xem · thêm · sửa · xóa · chốt · mở lại · duyệt · nạp · xuất), màn "Vai trò & quyền", ẩn/hiện nút theo quyền, siết RLS theo vai trò.
> Trạng thái: **CHỐT 2026-10-15** — chủ dự án đồng ý cả 6 câu §10 theo khuyến nghị. **Đợt 1 + 2 + 3 ĐÃ BUILD 2026-10-15** (xem §6 Kết quả). `0062` đã chạy trên DB thật 2026-10-15. Còn Đợt 4–6.
last_verified: 2026-10-15

# Phân quyền theo chức năng (CRUD+) cho từng vai trò và từng người

## 1. Vấn đề

Xí nghiệp có nhiều bộ phận: nhập hàng, ba xưởng sản xuất (Đông · Cá · Khô), kho, bán hàng, kế toán, ban giám đốc. Mỗi bộ phận chỉ nên **thấy** các màn của mình và chỉ được **làm** đúng việc của mình. Hôm nay app chưa làm được điều đó:

| Đang có | Hở ở đâu |
|---|---|
| 11 vai trò cứng trong `types.ts` (`ROLES`), một người giữ nhiều vai trò (CSV ở `user_profiles.roles`) | Muốn thêm phòng ban mới phải sửa code |
| `lib/nav-access.ts` giới hạn **màn** cho 2 bộ phận (thủ kho → 6 màn · quản đốc/tổ trưởng → 6 màn) | Chỉ có "thấy màn / không thấy màn". Vào được màn là được thêm, sửa, xóa, chốt, mở lại mọi thứ |
| Vai trò "không giới hạn" (giám đốc, kế toán…) thấy **toàn bộ** | Kế toán sửa được sổ nhập hàng; giám đốc xóa được kỳ cân đối |
| Người chưa gán vai trò thấy toàn bộ nav (tránh kẹt) | Từ `0057` DB đã chặn họ, nên giao diện mở mà bấm gì cũng lỗi |
| `admin` gate `/users` + `/audit` | Không có quyền riêng cho "Mở lại ngày đã chốt", "Xóa kỳ", "Xem giá/lãi lỗ" |
| RLS: mọi người có vai trò **cùng quyền DB** (`co_vai_tro()`, `0057`) | Gọi API thẳng là ghi được mọi bảng. Tầng app là tầng chặn duy nhất |

Rủi ro thật: **thao tác nhầm trên sổ sách thật** (xóa nhầm chuyến, mở lại ngày đã chốt, sửa kỳ kế toán đã chốt số), và **thấy số không nên thấy** (giá mua, lãi lỗ ở tay bộ phận xưởng).

## 2. Học từ phần mềm đã qua kiểm chứng

| Phần mềm | Cách làm | Ta lấy gì |
|---|---|---|
| **KiotViet** | Tạo **vai trò** = bộ quyền tick sẵn. Gán vai trò cho tài khoản **theo chi nhánh**, cùng người có thể khác quyền ở chi nhánh khác. Sau khi chọn vai trò vẫn **tinh chỉnh từng quyền của riêng người đó**. Có **sao chép** quyền từ người/vai trò có sẵn. Có quyền kiểu "xem tồn nhưng không xem giá nhập", "chỉ xem giao dịch do mình tạo" | Vai trò làm mẫu + chỉnh riêng từng người · sao chép vai trò · quyền xem giá tách riêng · phạm vi "của mình" |
| **MISA AMIS** | Quyền theo phân hệ với cột **Sử dụng · Thêm · Sửa · Xóa · In**. Muốn "chỉ xem" thì chỉ tick Sử dụng. Vai trò **Quản trị hệ thống toàn quyền, không sửa được**. Phạm vi dữ liệu theo đơn vị (chưa theo kho) | Ma trận màn × hành động · admin cố định không tự khóa mình được · phạm vi dữ liệu là lớp riêng |
| **Odoo** | `ir.model.access`: quyền read/write/create/unlink theo **nhóm**, **mặc định cấm**, nhiều nhóm thì **cộng dồn (hợp)**. `ir.rule`: lớp riêng lọc **dòng** (VD chỉ bản ghi của mình/công ty mình). Thêm `groups` cho trường và menu. Một lớp cấm là cấm | Mặc định cấm với màn mới · hợp quyền khi nhiều vai trò · tách **quyền hành động** khỏi **phạm vi dòng** · nhiều lớp chặn độc lập |
| **SAP** (tham khảo khái niệm) | Đối tượng quyền gồm *hoạt động* (01 tạo · 02 sửa · 03 xem · 06 xóa…) + *cấp tổ chức* | Hành động không chỉ CRUD: MES cần thêm Chốt / Mở lại / Duyệt |

**Rút ra 5 nguyên tắc cho Baseafood:**

1. **Quyền = (màn/chức năng) × (hành động) × (phạm vi).** Ba trục độc lập. Không gộp "quyền xưởng Đông" thành một vai trò dài.
2. **Vai trò là mẫu, người dùng là nơi áp.** Quyền thực = hợp quyền các vai trò của người đó, rồi áp chỉnh riêng (cho thêm / chặn) của chính người đó.
3. **Mặc định cấm** cho mọi màn/chức năng thêm về sau. Nhưng **ngày đầu bật không ai mất quyền** đang dùng (seed lại đúng hành vi hiện tại, siết dần).
4. **Admin cố định toàn quyền, không chỉnh được.** Không ai tự tước admin của mình, không xóa được admin cuối cùng.
5. **Nhiều lớp chặn, lớp nào cấm cũng là cấm:** điều hướng → nút trên màn → chốt ghi dữ liệu (`useTable.ghi`) → RLS máy chủ.

## 3. Mô hình

### 3a. Tài nguyên (resource) — khai trong code

Một sổ đăng ký thuần `lib/permissions.ts` (không React) khai **mọi** màn/chức năng có thể phân quyền: `id` (trùng nav id, tiếng Anh), nhãn tiếng Việt, nhóm module, **các hành động áp dụng được**, và **các bảng nó ghi**. DB chỉ lưu "ai được tick ô nào". Danh sách tài nguyên không nằm ở DB (giống Odoo: model khai trong code, quyền lưu ở DB) để code và quyền không lệch nhau.

| Nhóm | Tài nguyên (`id`) | Hành động áp dụng |
|---|---|---|
| Nhập hàng | `imports` | view · create · update · delete · lock · unlock · export · view-price |
| Sản xuất | `wip` | view · create · update · delete · lock · unlock · export |
| | `packaging` | view · create · update · delete |
| | `qc` | view · create · update · lock · unlock |
| | `qr` (gắn lô, in tem, thu hồi) | view · create · update · delete · export |
| Kho | `warehouse` | view · approve · update |
| | `orders` | view · create · update · delete |
| Bán hàng | `sales` | view · create · update · delete · lock · unlock · view-price |
| Kế toán | `balancing` | view · create · update · delete · lock · unlock · export · view-price |
| | `monthly-stock` | view · create · update · delete · import · export |
| | `reconciliation` | view · create · update · delete · export |
| | `nxt-material` · `nxt` · `nxt-warehouse` | view · export (+ `import` cho `nxt-warehouse` nạp báo cáo) |
| Báo cáo | `dashboard` · `production-report` · `export-report` | view · export |
| Danh mục | `catalog.suppliers` · `catalog.customers` · `catalog.material-types` · `catalog.products` · `catalog.batters` · `catalog.storage-locations` | view · create · update · delete |
| | `catalog.finished-goods` (141 mã TK 1551) | view (sửa chỉ admin) |
| Hệ thống | `users` · `roles` · `audit` · `demo-mode` | view · update (admin mặc định) |

### 3b. Hành động — 10 động từ cố định

| Hành động | Nghĩa | Ví dụ |
|---|---|---|
| `view` | Thấy màn trong nav, mở được, đọc số | Mọi màn |
| `create` | Thêm bản ghi | Thêm chuyến, thêm phiếu bán, ghi bù |
| `update` | Sửa bản ghi đang mở (chưa chốt) | Sửa kg một dòng |
| `delete` | Xóa (vẫn qua `ConfirmDelete` + Hoàn tác) | Bỏ dòng, xóa kỳ |
| `lock` | Chốt ngày / kỳ | Chốt ngày nhập, chốt kỳ cân đối |
| `unlock` | Mở lại ngày / kỳ đã chốt | Việc nhạy cảm nhất, tách riêng |
| `approve` | Duyệt chuyển trạng thái | Kho: BTP chờ → đã nhập |
| `import` | Nạp file Excel đè số | Sổ kho tháng, NXT kho |
| `export` | In A4 / xuất Excel / gửi báo cáo | Báo cáo, thu hồi lô |
| `view-price` | Thấy cột giá, thành tiền, lãi lỗ | Ẩn với bộ phận xưởng nếu chủ dự án muốn |

Bất biến (kiểm bằng test):
- Có bất kỳ hành động nào ⇒ tự có `view` (tick Sửa mà không tick Xem là vô nghĩa — giao diện tự tick Xem, như KiotViet/MISA).
- `unlock` **không** kéo theo `lock` và ngược lại. Mở lại là quyền riêng, thường chỉ quản lý cấp trên.
- Ghi bù (ghi cho ngày đã qua, bắt lý do) = `create`. Lý do vẫn bắt như hiện nay. Chưa tách thành quyền riêng (xem §10 câu 3).

### 3c. Phạm vi dữ liệu (lớp riêng, làm sau)

| Phạm vi | Nghĩa | Dùng cho |
|---|---|---|
| `all` | Mọi dòng | Mặc định |
| `workshop` | Chỉ dòng của xưởng mình (Đông/Cá/Khô, suy từ vai trò `manager-dong`…) | `/wip`, `/packaging`, `/qc` |
| `own` | Chỉ dòng mình ghi (`production_wips.operator`…) | Tổ trưởng sửa/xóa dòng mình |

Phạm vi gắn theo **ô quyền** (`role_permissions.scope`), không theo người. Ví dụ quản đốc Đông: `wip.view = all` (xem cả 3 xưởng để so) nhưng `wip.update = workshop`. Đợt đầu không bật phạm vi, mọi ô là `all`; cột vẫn có sẵn để khỏi đổi bảng về sau.

### 3d. Cách tính quyền thực — một hàm thuần

```
resolvePermissions(user, rolePermissions, userOverrides) → Map<"resource:action", scope | null>
  1. isAdmin                         → mọi ô = all (không đọc bảng)
  2. roles rỗng                      → không có quyền nào (màn "Chưa được cấp quyền")
  3. gộp các vai trò                 → HỢP: có ở một vai trò là có; phạm vi lấy rộng nhất (all > workshop > own)
  4. áp chỉnh riêng của người dùng   → `deny` gỡ ô đó; `allow` thêm ô đó (kèm phạm vi)
  5. ép bất biến                     → có hành động bất kỳ ⇒ có view
```

Hàm thuần, có test vitest (đúng luật repo: hàm thuần mới có test). Mọi nơi khác chỉ hỏi `can(resource, action)`.

Thứ tự ưu tiên: **chặn riêng > cho riêng > vai trò**. Lý do: admin muốn chặn đúng một người (VD kế toán mới vào chưa được xóa kỳ) mà không phải tách vai trò mới.

## 4. Dữ liệu

### 4a. Bảng mới (migration `0062+`, chỉ thêm, 🟡)

> Rà số migration với `origin` trước khi đặt (nhiều phiên chung thư mục).

```
app_roles            id text pk (slug, VD 'warehouse-keeper') · name · description · is_system bool · sort_order · site_id · updated_at
role_permissions     role_id → app_roles.id (on delete cascade) · resource · action · scope ('all'|'workshop'|'own') · site_id
                     pk (role_id, resource, action)
user_permissions     user_id → user_profiles.id (on delete cascade) · resource · action · effect ('allow'|'deny') · scope · site_id
                     pk (user_id, resource, action)
```

- **`user_profiles.roles` giữ nguyên** (CSV slug). Không đổi cột đang chạy, không đụng `0057`. `app_roles` chỉ thêm nhãn + mô tả + cho tạo vai trò mới. 11 slug hiện có seed vào `app_roles` với `is_system = true` (không xóa được, đổi tên được).
- **RLS cho 3 bảng mới**: đọc = `co_vai_tro()` (app cần đọc để tính quyền), ghi/xóa = `la_admin()`. Đây là policy cho bảng **mới**, không sửa policy bảng cũ.
- Ghi qua `useTable` như mọi bảng ⇒ đổi quyền **tự vào nhật ký thao tác** (ai đổi, lúc nào, trước/sau), không cần code audit riêng.
- **Chế độ demo**: 3 bảng này là dữ liệu **thật** giống `user_profiles` ⇒ đọc/ghi bằng site thật, **không** vào `DemoBundle` (ghi rõ vào checklist §5 của `spec/che-do-demo.md`). `/roles` khóa khi đang demo như `/users`.
- Đường lùi: `drop table user_permissions, role_permissions, app_roles;` (chưa ai đọc thì app quay về ma trận mặc định trong code — §6 Đợt 1).

### 4b. Bộ nhớ dưới máy

Quyền thực tính xong lưu bản sao `bsf.permissions` (cùng cơ chế bản sao của `useTable`). Mất mạng ở xưởng vẫn chạy đúng quyền lần gần nhất. **Chạy localStorage không có `.env` ⇒ không chặn gì** (giữ hành vi offline hiện nay).

### 4c. Bảng → tài nguyên (cho chốt ghi dữ liệu)

| Tài nguyên | Bảng ghi |
|---|---|
| `imports` | `import_shipments` · `material_imports` · `daily_locks` (lock/unlock) · `scraps` khi `nguon = Nhập hàng` |
| `wip` | `production_wips` · `production_locks` (lock/unlock) · `domestic_sales` · `lot_inputs` · `lot_waivers` |
| `packaging` | `packagings` |
| `qc` | `qc_checklists` · `qc_locks` (lock/unlock) |
| `qr` | `label_prints` · `lot_dispatches` |
| `warehouse` | `production_wips` (chỉ cột trạng thái — `approve`) |
| `orders` | `sales_orders` · `order_items` · `export_orders` · `export_items` |
| `sales` | `sales_invoices` · `sales_items` |
| `balancing` | `balancing_periods` · `balancing_inputs` · `balancing_outputs` · `scraps` của kỳ |
| `monthly-stock` | `monthly_stock_ledger` |
| `reconciliation` | `reconciliation_runs` |
| `nxt-material` · `nxt` · `nxt-warehouse` | `material_opening_stock` · `finished_goods_opening_stock` · `nxt_snapshots` |
| `catalog.*` | `suppliers` · `customers` · `material_types` · `products` · `batter_types` · `storage_locations` · `finished_goods` |
| `users` · `roles` | `user_profiles` · `app_roles` · `role_permissions` · `user_permissions` |
| (không gate) | `row_marks` — tô màu dòng là thao tác trình bày (quy tắc 13), ai xem được bảng thì tô được |

Bảng dùng chung nhiều màn (`production_wips`, `scraps`, `storage_locations`) cần phân định theo **cột/ngữ cảnh**, chi tiết chốt lúc build Đợt 3. Test bắt buộc: **mọi `TableMapping` trong `repo.ts` phải có mặt trong bảng này** (thêm bảng mà quên khai ⇒ CI đỏ, cùng kiểu `demoForeignKeys.test.ts`).

## 5. Bốn lớp chặn

```
Lớp 1  Điều hướng      nav + route guard   ← view           (mở rộng nav-access.ts)
Lớp 2  Trên màn         ẩn nút / chỉ xem    ← useCan()       (từng màn)
Lớp 3  Chốt ghi dữ liệu useTable.ghi        ← diff thêm/sửa/xóa → can()   ← LƯỚI AN TOÀN
Lớp 4  Máy chủ          RLS has_permission  ← cùng bảng quyền              (🔴 làm sau cùng)
```

**Lớp 1 — điều hướng.** `allowedIds()` đổi nguồn: từ bảng cứng `ALLOWED_NAV` sang "các tài nguyên có `view`". `homeFor()` giữ nguyên ý (trang chủ theo vai trò), chuyển thành thuộc tính `home_route` của `app_roles`. `nav-access.test.ts` hiện chốt tập màn của từng vai trò ⇒ là bài test hồi quy cho Đợt 1: seed mặc định phải cho ra **đúng** tập màn đó. Ngoại lệ có chủ đích duy nhất: ca "chưa gán vai trò ⇒ xem đầy đủ" đổi thành "không thấy màn nào" (DB đã chặn họ từ `0057`, giao diện mở ra chỉ để bấm đâu lỗi đó) — sửa ca test này cùng commit.

**Lớp 2 — trên màn.** Hook `useCan(resource)` trả `{ view, create, update, delete, lock, unlock, approve, import, export, viewPrice }`. Luật hiển thị:

| Tình huống | Hiển thị |
|---|---|
| Không có `create` / `delete` / `lock` / `unlock` / `approve` / `import` | **Ẩn nút** (không làm mờ). Luật "nút Lưu không bao giờ `disabled`" vẫn giữ: không có quyền thì không có nút |
| Có `view` mà không có `create` lẫn `update` | Màn ở **chế độ chỉ xem**: lưới không sửa ô, đầu màn có nhãn "Chỉ xem" + `title` "Bạn có quyền xem màn này, không có quyền sửa. Cần thêm quyền thì báo quản trị viên." |
| Không có `view-price` | Ẩn cột giá / thành tiền / lãi lỗ (ẩn cột, không hiện ô trống) |
| Ô danh mục (`Combobox`, quy tắc 7) | Không có `catalog.x.create` ⇒ bỏ "Tạo mới tại chỗ"; không có `catalog.x.update` ⇒ `canEdit={false}` (prop đã có sẵn) |
| Tô màu dòng, lọc, chọn | Không gate |

Hook nằm ở `lib/permissions.ts` + `features/shared/PermissionProvider.tsx` (gắn một lần ở `ShellLayout`, giống `RowMarkProvider`). Design-system chỉ thêm phần trình bày (`ReadOnlyBadge`), không biết gì về quyền.

**Lớp 3 — chốt ghi dữ liệu (lưới an toàn).** `useTable.ghi` đã là chốt duy nhất mọi lần ghi đi qua (nhật ký thao tác dựa vào nó). Trước khi ghi, lấy diff thêm/sửa/xóa, tra bảng §4c, hỏi `can()`. Không đủ quyền ⇒ **không ghi**, giữ nguyên số trên màn, toast lỗi "Bạn không có quyền xóa ở Nhập hàng". Lớp này bắt cả những nút Đợt 3 quên ẩn, nên lớp 2 sót thì vẫn không có số sai lọt vào sổ.

**Lớp 4 — RLS máy chủ (🔴, Đợt 5).** Hàm SQL `has_permission(resource text, action text) returns boolean` đọc đúng 3 bảng §4a (cùng thứ tự ưu tiên §3d). Policy insert/update/delete từng bảng nghiệp vụ gọi hàm này. **Điều kiện tiên quyết trước khi bật:**
- Hàng chờ đồng bộ hiện coi lỗi lớp 42 (gồm `42501 insufficient_privilege`) là "giữ nguyên, thử lại mãi" (`04-tang-du-lieu.md` bất biến 6). Bật RLS theo quyền mà chưa sửa chỗ này ⇒ dòng bị từ chối **kẹt hàng chờ vĩnh viễn**, đèn đỏ mãi. Phải thêm nhánh `42501` ⇒ chuyển dòng sang danh sách "bị từ chối vì quyền", báo rõ người dùng, không chặn các dòng khác.
- Lớp 3 đã chạy ổn ít nhất 2 tuần (không có báo lỗi "không đủ quyền" bất ngờ).
- Có câu `ROLLBACK` trả policy về `co_vai_tro()`.

## 6. Kế hoạch build theo đợt

| Đợt | Việc | Tier | Ước lượng | Xong khi |
|---|---|---|---|---|
| **0** | Chốt spec này + 6 câu §10 + ma trận mục tiêu §7 với chủ dự án và trưởng các bộ phận | 🟢 | 0,5 ngày | Spec chuyển "CHỐT" |
| **1** | `lib/permissions.ts`: sổ đăng ký tài nguyên + `resolvePermissions` + **ma trận mặc định trong code = đúng hành vi hiện tại**. `nav-access.ts` lấy tập màn từ đây. `PermissionProvider` + `useCan`. Người chưa có vai trò ⇒ màn "Chưa được cấp quyền". Test: resolve, bất biến, tương đương `nav-access.test.ts`, mọi route có tài nguyên | 🟡 | 1–1,5 ngày | Không ai thấy khác gì (trừ người vai trò rỗng); test xanh |
| **2** | Migration 3 bảng (§4a) + seed 11 vai trò hệ thống bằng ma trận Đợt 1. Màn **Vai trò & quyền** (tab trong `/users`, §8). Chỉnh riêng từng người. Sao chép vai trò. "Xem quyền thực của người này". Đọc bảng; bảng rỗng/lỗi ⇒ dùng ma trận trong code | 🟡 | 2–3 ngày | Admin đổi một ô, người đó tải lại thấy đổi; nhật ký ghi lại |
| **3** | Lớp 3 (chốt ở `useTable.ghi`) + test bảng→tài nguyên. Rồi đi **từng màn** gắn `useCan` (22 màn + 7 tab danh mục), chế độ chỉ xem, ẩn cột giá. Thứ tự: `imports` → `wip` → `balancing` → `sales` → còn lại | 🟢/🟡 | 3–4 ngày | Checklist §9 đủ; thử bằng 3 tài khoản mẫu |
| **4** | Áp **ma trận mục tiêu** (§7) thay ma trận "như cũ" — siết thật. Làm cùng trưởng bộ phận, từng vai trò một, có thông báo trước | 🟡 (dữ liệu quyền, đảo được) | 0,5 ngày + theo dõi 1 tuần | Không ai kẹt việc |
| **5** | Phạm vi `workshop` / `own` cho `/wip` `/packaging` `/qc` | 🟡 | 1–2 ngày | Quản đốc Đông không sửa được dòng xưởng Cá |
| **6** | RLS `has_permission()` + nhánh `42501` ở hàng chờ | 🔴 | 1–2 ngày + chạy thử | Gọi API thẳng không vượt được quyền; hàng chờ không kẹt |

### Kết quả Đợt 1 (2026-10-15)

- `src/lib/permissions.ts`: `PERMISSION_RESOURCES` (28 tài nguyên: 17 màn nghiệp vụ + 7 tab danh mục + 4 tài nguyên hệ thống `adminOnly`: `users`/`roles`/`audit`/`demo-mode`), `DEFAULT_ROLE_PERMISSIONS` (= hành vi cũ), `resolvePermissions`, `can`, `scopeOf`, `visibleNavIds`, `OFFLINE_PERMISSIONS`. Ô quyền ngoài danh sách hành động của tài nguyên bị bỏ qua (không cấp nhầm).
- `src/lib/nav-access.ts`: chỉ còn `HOME_BY_ROLE` + `homeFor(roles, perms?)` (bỏ trang không thấy được, trả `null` khi không thấy gì) + `allowedIds` (dẫn xuất).
- `src/features/shared/PermissionProvider.tsx`: `PermissionProvider`, `usePermissions`, `useCan(resource)` → cờ 10 hành động. Gắn ở `ShellLayout`.
- `App.tsx`: nav + chặn URL theo `view`; vai trò rỗng ⇒ "Chưa được cấp quyền"; `useAuth().isProfileLoading` ⇒ chờ nạp hồ sơ rồi mới dựng router.
- Hai đổi hành vi có chủ đích: (1) **chưa gán vai trò** ⇒ không thấy màn nào (trước: thấy đủ — DB đã chặn họ từ `0057`); (2) **vai trò lạ** (slug không có trong ma trận) ⇒ không quyền (trước: bị coi là "không giới hạn" ⇒ thấy đủ). DB thật 2026-10-15: không hồ sơ nào rơi vào hai ca này.
- Giữ nguyên có chủ đích: đọc hồ sơ **lỗi** (rớt mạng) ⇒ `OFFLINE_PERMISSIONS` (mọi màn trừ màn admin), như trước; bộ nhớ quyền dưới máy (§4b) để Đợt 2.
- Test: `permissions.test.ts` (resolve, hợp vai trò, chặn > cho, bất biến view, adminOnly, ma trận mặc định = cũ, KIT_NAV ⇄ sổ tài nguyên, route App.tsx ⇄ sổ tài nguyên) + `nav-access.test.ts` (tập màn từng vai trò không đổi).

### Kết quả Đợt 2 (2026-10-15)

- `supabase/migrations/0062_role_permissions.sql`: 3 bảng §4a, **khác dự thảo**: bỏ `is_system` (vai trò hệ thống nằm trong code); **có dòng `app_roles` = vai trò đã chỉnh/tự tạo** — chỉ khi đó mới dùng ô ở `role_permissions` (kể cả rỗng = không quyền); không có dòng ⇒ ma trận mặc định. Không seed, không khóa ngoại (giữ test `demoForeignKeys` + chế độ demo đơn giản). Thêm `home_route` (trang mở đầu riêng của vai trò).
- `lib/permissions.ts`: `buildRolePermissions`, `buildUserOverrides`, `explainPermission`, `listRoleOptions`, `roleNames`, `homeRoutesFromAppRoles`, id tất định `rolePermissionId` / `userPermissionId`; thêm tài nguyên `admin` (navId `admin`), `roles` có navId riêng `roles`.
- `App.tsx`: đọc 3 bảng, chỉ tin ma trận khi cả `app_roles` + `role_permissions` hết `loading` (tránh đá nhầm về trang chủ lúc nạp dở).
- Màn `/roles` (§8, đã build): tab **Theo vai trò** (danh sách vai trò + nhãn Toàn quyền/Đã chỉnh/Tự tạo, ma trận tick có "Tất cả/Bỏ hết" theo hàng, tick ô bất kỳ tự tick Xem, bỏ Xem bỏ cả hàng, Lưu quyền + Hoàn tác, Sao chép, Thêm vai trò, Khôi phục mặc định, Xóa vai trò tự tạo — chặn khi còn người giữ, trang mở đầu, mô tả) · tab **Theo người dùng** (quyền thực + màu nguồn: theo vai trò / cho riêng / chặn riêng; bấm ô đổi; danh sách màn người đó thấy). "Xem như người này" làm dạng **danh sách màn thấy được** thay vì giả lập cả app.
- Khu **Quản trị** `/admin` + menu tài khoản ở avatar (đổi mật khẩu, giao diện, quản trị, đăng xuất) — yêu cầu thêm của chủ dự án cùng ngày.
- Thứ tự triển khai: chạy `0062` → deploy app. Lùi: `drop table` 3 bảng ⇒ app về ma trận mặc định.

### Kết quả Đợt 3 (2026-10-15)

- **Lớp 3 — chốt ghi:** `lib/writePermissions.ts` (`TABLE_WRITE_RULES` + `checkTableWrite`, có test) + `setWriteGuard` ở đầu `useTable.write` (lib/repo.ts). **Khác §4c:** luật theo màn THẬT SỰ ghi bảng (rà code): đủ quyền ở MỘT trong các màn đó là được — VD `production_wips` ⇐ wip / balancing / warehouse (chuyển `stocked` = Duyệt), `monthly_stock_ledger` ⇐ monthly-stock / balancing, `sales_*` ⇐ sales / orders, `lot_*` ⇐ wip / packaging / qr / orders / sales; bảng chốt (`daily_locks`, `production_locks`, `qc_locks`, `balancing_periods`) theo `isLocked` (chốt ⇒ Chốt, mở/xóa ⇒ Mở lại); danh mục ⇒ quyền tab `catalog.*` kể cả thêm nhanh ở màn khác; `nxt_snapshots` ⇒ Nạp. Bị chặn ⇒ cả lượt bỏ nguyên, báo lỗi, KHÔNG vào hàng chờ. Không chốt khi chạy localStorage / chưa có hồ sơ.
- **Registry đổi:** `qc` thêm Xóa (màn QC có xóa phiếu kiểm); `nxt-material` / `nxt` thêm Thêm/Sửa/Xóa (= tồn đầu khai tay). Ma trận mặc định tự cấp các ô mới ⇒ không ai mất quyền.
- **Lớp 2 — trên màn:** `useCan` ở 16 màn + 7 tab danh mục (ẩn nút theo Thêm/Sửa/Xóa/Chốt/Mở lại/Duyệt/Nạp/Xuất, `ReadOnlyBadge` khi chỉ xem, ẩn giá/thành tiền/lãi lỗ theo `view-price` ở Nhập hàng · Bán hàng · Cân đối); `CatalogCrud` có `canCreate/canUpdate/canDelete`; `useQuickCatalogEdit` tự ẩn bút chì + trả `canCreate` cho `onCreate` ở mọi ô danh mục. Thử trên preview (bản vá tạm, đã gỡ): vai trò chỉ-xem ⇒ mọi màn có ghi hiện "Chỉ xem", 0 nút thao tác; đủ quyền trừ Xóa + Xem giá ⇒ nút Thêm/Sửa còn, nút Xóa/Bỏ + chữ giá mất; đủ quyền ⇒ như cũ.
- **Còn hở (lớp 3 vẫn chặn):** nút "Gỡ" lô trong `features/shared/LotInputPicker.tsx` (picker dùng chung, chưa nhận cờ quyền); bảng duyệt OCR phiếu nhập (`OcrReviewPanel`) còn hiện giá cũ cho người có Thêm mà không có Xem giá; tem in ở /packaging không gate (tài nguyên `packaging` không có Xuất).

Đợt 1–3 giao được giá trị (chặn thao tác nhầm ở giao diện) mà **không đụng RLS**. Đợt 6 chỉ cần khi app mở ra ngoài mạng nội bộ hoặc khi có người cố tình vượt giao diện.

## 7. Ma trận đề xuất (Đợt 4 — để bàn, chưa áp)

Ký hiệu: **X** xem · **T** thêm · **S** sửa · **Đ** xóa · **C** chốt · **M** mở lại · **D** duyệt · **N** nạp · **E** xuất/in · **G** xem giá · (x) = phạm vi xưởng mình · — = không thấy màn.

| Màn | Giám đốc · Phó GĐ | Kế toán trưởng | Kế toán | Thủ kho nhập | Quản đốc xưởng | Phó QĐ | Tổ trưởng |
|---|---|---|---|---|---|---|---|
| Tổng quan | X E | X E | X E | — | X | X | — |
| Nhập hàng | X E G | X S Đ C M E G | X S E G | X T S Đ C E G | — | — | — |
| Sản xuất TP `/wip` | X E | X M E | X E | — | X T S Đ C M (x) E | X T S (x) | X T S (của mình) |
| Đóng gói | X | X | X | — | X T S Đ (x) | X T S (x) | X T S |
| QC | X | X | — | — | X T S C M (x) | X T S (x) | X T S |
| Mã lô QR | X E | X E | X E | X T E | X T S E | X T | X T |
| Kho dự trữ | X | X | X | X | X D | X D | X |
| Đơn đặt | X E | X T S Đ E | X T S E | — | — | — | — |
| Bán hàng | X E G | X T S Đ C M E G | X T S E G | — | — | — | — |
| Cân đối kỳ | X E G | X T S Đ C M E G | X T S E G | — | — | — | — |
| Sổ kho tháng | X E | X T S Đ N E | X T S N E | X | — | — | — |
| Đối soát HĐĐT | X E | X T S Đ E | X T S E | — | — | — | — |
| Tồn NL · Tồn TP · NXT kho | X E | X N E | X N E | X | X | — | — |
| Báo cáo TP · Báo cáo đơn xuất | X E | X E | X E | — | X E | X E | — |
| Danh mục (6 tab) | X | X T S Đ | X T S | X T S (đại lý, loại NL) | X T S (mặt hàng, bột tẩm) | X | X |
| Thành phẩm 141 mã | X | X | X | X | X | X | X |
| Người dùng · Vai trò · Nhật ký | — | — | — | — | — | — | — |

Ý đồ đáng bàn: **Mở lại (M)** chỉ còn ở kế toán trưởng + quản đốc (xưởng mình). **Xóa (Đ)** sổ kế toán chỉ kế toán trưởng. Ban giám đốc **chỉ xem + xuất** (không sửa số, khớp ý "giám đốc chỉ đọc" ghi ở `05-bao-mat-phan-quyen.md`). Bộ phận xưởng **không thấy giá**.

## 8. Màn "Vai trò & quyền" (thiết kế sơ bộ)

Đặt làm **tab trong `/users`** (`?tab=roles`), không thêm mục nav mới: cùng người quản lý, cùng chỗ.

- **Danh sách vai trò** (trái) — tên, số người đang giữ, nhãn "Hệ thống". Nút **Thêm vai trò** (`default`), **Sao chép** (tạo vai trò mới từ vai trò đang chọn, kiểu KiotViet), **Xóa** (`danger`, chỉ vai trò tự tạo và không còn ai giữ).
- **Ma trận** (phải) — hàng = tài nguyên gom theo nhóm module (gập/mở), cột = 10 hành động; ô **chỉ có ở hành động áp dụng được** (§3a), còn lại để trống chứ không phải ô bị khóa. Ô đầu hàng "Toàn quyền" tick nhanh cả hàng. Tick bất kỳ ô ⇒ tự tick Xem. Rê chuột từng cột ra `title` giải thích (VD Mở lại: "Mở lại ngày/kỳ đã chốt để sửa số. Nên để ít người."). Bọc `HorizontalScroll`. Ở điện thoại: mỗi nhóm module một khối gập, ô chọn xếp dọc.
- **Lưu** (`save`) ghi cả ma trận một lần, `notify.saved` kèm **Hoàn tác** (đây là ghi đè hàng loạt — quy tắc 13).
- **Tab người dùng → "Quyền của người này"**: ma trận quyền thực, mỗi ô ghi nguồn ("từ Kế toán" / "cho riêng" / "chặn riêng"). Bấm ô để chuyển 3 trạng thái *theo vai trò → cho riêng → chặn riêng*.
- **Xem như người này** (chỉ đọc): admin xem điều hướng + màn đúng như người đó thấy, có dải báo "Đang xem dưới quyền của …". Đây là cách rẻ nhất để kiểm tra trước khi giao quyền, tránh "giao nhầm rồi người dùng mới phát hiện".
- Rào chắn: vai trò `admin` không hiện ma trận (toàn quyền cố định). Không gỡ được vai trò admin của chính mình, không gỡ được admin cuối cùng.

## 9. Checklist mỗi màn (Đợt 3) + cổng kiểm

Mỗi màn khi gắn quyền:
- [ ] Tài nguyên có trong `lib/permissions.ts`, hành động khai đúng
- [ ] Nút Thêm / Xóa / Chốt / Mở lại / Duyệt / Nạp ẩn theo `useCan`
- [ ] Không có `create`/`update` ⇒ chế độ chỉ xem (lưới không sửa ô, nhãn "Chỉ xem")
- [ ] Cột giá ẩn theo `view-price` (nếu màn có giá)
- [ ] Combobox danh mục: `onCreate` / `canEdit` theo quyền tab danh mục
- [ ] Thử bằng 3 tài khoản: đủ quyền · chỉ xem · không thấy màn (gõ URL thẳng ⇒ về trang chủ)

Cổng kiểm (theo `CLAUDE.md`): `npm run build` + `lint` + `test` + `naming:check`. Test mới bắt buộc: `permissions.test.ts` (resolve, ưu tiên chặn > cho > vai trò, hợp nhiều vai trò, bất biến view, admin, vai trò rỗng) · test mọi route có tài nguyên · test mọi `TableMapping` có tài nguyên · `nav-access.test.ts` vẫn xanh ở Đợt 1. Migration chạy hai lần không lỗi.

Doc phải cập nhật khi build: `05-bao-mat-phan-quyen.md` (mô hình mới), `02-pages-navigation.md` (nav theo quyền), `03-database.md` (3 bảng), `04-tang-du-lieu.md` (chốt ghi ở `useTable.ghi`, nhánh 42501), `spec/che-do-demo.md` §5 (3 bảng không vào demo), `src/design-system/README.md` (luật ẩn nút / chỉ xem).

## 10. Câu đã chốt (2026-10-15 — cả 6 theo khuyến nghị)

1. **Độ mịn**: dừng ở màn × 10 hành động (+ tách 7 tab danh mục) như §3a, hay cần mịn hơn nữa (VD tách từng khối trong Cân đối)? *Khuyến nghị: dừng ở màn. Mịn hơn thì admin khó quản, dễ tick sai — đúng thứ ta muốn tránh.*
2. **Phạm vi xưởng**: quản đốc xưởng Đông được **xem** cả ba xưởng hay chỉ xưởng mình? *Khuyến nghị: xem cả ba, chỉ sửa xưởng mình.*
3. **Ghi bù** có cần tách thành quyền riêng (VD tổ trưởng ghi hôm nay được, ghi bù ngày cũ thì không)? *Khuyến nghị: chưa tách; ghi bù đã bắt lý do và vào nhật ký.*
4. **Ai được Mở lại** ngày/kỳ đã chốt? *Khuyến nghị: kế toán trưởng + quản đốc (xưởng mình); admin luôn được.*
5. **Ẩn giá** với bộ phận xưởng và thủ kho? *Khuyến nghị: ẩn với xưởng, thủ kho vẫn thấy giá nhập vì họ ghi giá.*
6. **Khi nào bật RLS theo quyền (Đợt 6, 🔴)**: ngay sau Đợt 4, hay chỉ khi mở app ra ngoài mạng nội bộ? *Khuyến nghị: sau Đợt 4 chạy ổn 2 tuần.*

## Nguồn tham khảo

- KiotViet — [Quản lý người dùng](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-thiet-lap/quan-ly-nguoi-dung/) · [Phân quyền (wiki)](https://www.kiotviet.vn/wiki-ki-ot-viet/quan-ly-nguoi-dung-wiki/phan-quyen/) · [Phân cho nhân viên từng quyền cụ thể](https://www.kiotviet.vn/toi-co-the-phan-cho-nhan-vien-tung-quyen-han-cu-the-hay-khong/)
- MISA AMIS — [Thiết lập quyền cho vai trò](https://helpact.misa.vn/kb/phan-quyen-cho-vai-tro/) · [Chỉ xem, không sửa](https://helpact.misa.vn/kb/toi-muon-phan-quyen-cho-nhan-vien-duoc-xem-du-lieu-nhung-khong-duoc-sua-du-lieu-thi-lam-the-nao/) · [Câu hỏi thường gặp về phân quyền](https://helpact.misa.vn/?p=73499)
- Odoo — [Security in Odoo (access rights, record rules)](https://www.odoo.com/documentation/17.0/developer/reference/backend/security.html)
- Sapo — [Phân quyền chi tiết nhân viên](https://www.sapo.vn/cap-nhat-tinh-nang/Phan-quyen-chi-tiet-nhan-vien-tren-kenh-ban)
