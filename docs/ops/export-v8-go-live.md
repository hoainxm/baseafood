> Load khi: chạy migration `0079` (Xuất khẩu — quy trình duyệt mới) lên DB thật, gán vai trò Trưởng / Phó phòng Kế hoạch, kiểm sau khi chạy, hoặc cần lùi.

# Xuất khẩu v8 — chạy thật (mig 0079)

Nghiệp vụ: [ba-spec 41 §0 v8](../app-map/41-export-planning.ba-spec.md). Migration: [`0079_export_approval_workflow.sql`](../../supabase/migrations/0079_export_approval_workflow.sql) — chi tiết từng phần ở [03-database](../app-map/03-database.md). Phân quyền: [05](../app-map/05-bao-mat-phan-quyen.md) · [role-permissions](../spec/role-permissions.md).

## 1. Hiện trạng (kiểm CHỈ ĐỌC trên DB thật, 2026-10-28)

| Mục | Trạng thái |
|---|---|
| `0075` (8 bảng `export_*`, `has_export_permission`, bucket `export-files`, vai trò `planner`) | ✅ đã có |
| `0076` · `0077` · `0078` | ✅ đã có |
| `0079` | ✅ **đã chạy 2026-10-28** (chủ dự án) — kiểm sau chạy khớp §2.3: 3 trigger, 3 policy duyệt, 587 ô / 2 ô Duyệt, số thật không đổi |
| Số thật (site `bsf1`) | 3 HĐ đang mở · 2 lượt duyệt kiểu cũ (BGĐ ký giấy, có file) · 3 chuyến · 51 file · 0 HĐ thanh toán L/C |
| Tài khoản | 5 Nhân viên KH · **3 tài khoản đã gán sẵn** `planning-head` / `planning-deputy` |
| Vai trò `planner` | **có dòng `app_roles`** (admin đã chỉnh ở /roles) ⇒ quyền đọc từ `role_permissions` (25 ô, không có Duyệt — đúng ý) |

### (Đã xong) Trạng thái nửa vời trước khi chạy 0079

Code v8 (commit `0c0603a`) đã lên Vercel, DB chưa có 0079 ⇒ hiện tại:
- 3 tài khoản Trưởng / Phó phòng **chưa có quyền gì** (ma trận mặc định chưa có ô của họ) ⇒ vào Xuất khẩu thấy "Chưa được cấp quyền".
- Không ai duyệt HĐ được ngoài admin; admin bấm Duyệt thì app gửi cột `stage` chưa có ⇒ lượt duyệt **nằm hàng chờ** của máy đó (không mất — chạy 0079 xong, máy đó mở app là tự đẩy lên).
- Đính kèm hồ sơ HĐ (`step = contract`) bị DB từ chối (ràng buộc cũ) ⇒ cũng nằm hàng chờ tới khi chạy 0079.
- Nhật ký HĐ chưa ghi (app tự tắt khi chưa có bảng).
- 2 HĐ đã duyệt kiểu cũ: vẫn chạy bình thường (file ký cũ tính thay "Hợp đồng đã ký" — R30). HĐ chờ duyệt: chờ người duyệt.

## 2. Chạy 0079

Ai làm: chủ dự án, Supabase Dashboard → **SQL Editor** của project Baseafood (không ghi ref vào repo — QT 11).

1. **Kiểm trước** (chỉ đọc) — kỳ vọng `stage_col = 0`, `has_export_fn = 1`, `step_check = export_files_step_check`:
   ```sql
   select
     (select count(*) from information_schema.columns where table_schema='public' and table_name='export_contract_approvals' and column_name='stage') as stage_col,
     (select count(*) from pg_proc where proname='has_export_permission') as has_export_fn,
     (select conname from pg_constraint where conrelid='public.export_files'::regclass and contype='c' and pg_get_constraintdef(oid) like '%step%' limit 1) as step_check,
     (select count(*) from public.export_contracts where site_id <> 'site-demo') as real_contracts,
     (select count(*) from public.export_contract_approvals where site_id <> 'site-demo') as real_approvals,
     (select count(*) from public.export_files where site_id <> 'site-demo') as real_files;
   ```
   Ghi lại 3 số `real_*` để so sau.
2. Dán **toàn bộ** file `0079_export_approval_workflow.sql` → Run. Chạy **lần 2** (phải không lỗi — file idempotent).
3. **Kiểm sau** (chỉ đọc):
   ```sql
   select
     (select count(*) from information_schema.columns where table_schema='public' and table_name='export_contract_approvals' and column_name='stage') as stage_col,           -- 1
     (select count(*) from information_schema.columns where table_schema='public' and table_name='export_files' and column_name='attachment_kind') as attach_col,           -- 1
     (select pg_get_constraintdef(oid) like '%contract%' from pg_constraint where conname='export_files_step_check') as step_has_contract,                                    -- true
     (select count(*) from information_schema.tables where table_schema='public' and table_name='export_activity_log') as log_table,                                          -- 1
     (select count(*) from pg_trigger where tgname in ('export_contracts_enforce_close','export_activity_log_no_edit','export_activity_log_stamp')) as triggers,          -- 3
     (select count(*) from pg_policies where tablename='export_contract_approvals' and cmd in ('INSERT','UPDATE','DELETE')
        and coalesce(qual,'') || coalesce(with_check,'') like '%approve%') as approval_policies,                                                                            -- 3
     (select count(*) from public.default_role_permissions) as matrix_cells,                                                                                                  -- 587
     (select count(*) from public.default_role_permissions where resource='export-plans' and action='approve') as approve_cells,                                            -- 2
     (select count(*) from public.export_contracts where site_id <> 'site-demo') as real_contracts,                                                                         -- = trước
     (select count(*) from public.export_contract_approvals where site_id <> 'site-demo') as real_approvals,                                                                 -- = trước
     (select count(*) from public.export_files where site_id <> 'site-demo') as real_files;                                                                                 -- = trước
   ```
4. ⛔ Từ giờ **đừng chạy lại `0073` / `0075`** — hai file đó xóa trọn `default_role_permissions` rồi chèn ma trận cũ ⇒ Trưởng / Phó mất quyền Duyệt. Lỡ chạy ⇒ chạy lại 0079.
5. Cập nhật [03-database](../app-map/03-database.md) dòng `0079` + CLAUDE.md mục "Migration CHƯA chạy": ghi ngày chạy.

## 3. Vai trò

- 3 tài khoản đã có `planning-head` / `planning-deputy` ⇒ sau 0079 tự có quyền (ma trận mặc định): mọi việc của Nhân viên KH + **Duyệt**. Đăng xuất / đăng nhập lại (hoặc tải lại trang) để áp quyền mới.
- Soát danh sách ở **/users**: đúng người là Trưởng / Phó phòng? Nhân viên KH giữ `planner`.
- ⚠️ **Đừng tạo / chỉnh vai trò `planning-head`, `planning-deputy` ở /roles** nếu không cần: chỉnh là tạo dòng `app_roles` ⇒ vai trò đó bỏ ma trận mặc định, đọc ô đã tick — quên tick "Duyệt" ở "Kế hoạch · Xuất khẩu" là mất quyền duyệt.
- `planner` đã có dòng `app_roles` ⇒ không tự nhận ô mới nào từ 0079 (đúng: Nhân viên KH không được Duyệt). Muốn Nhân viên KH xem nhật ký: đã có `export-plans:view` — đủ.

## 3b. v9 (2026-10-29) — bỏ bước duyệt HĐ (chỉ đổi code, KHÔNG migration)

Chủ dự án bỏ bước duyệt HĐ lúc lập, chỉ giữ duyệt cuối ([ba-spec 41 §0a](../app-map/41-export-planning.ba-spec.md)). DB giữ nguyên 0079: lượt duyệt giờ chỉ còn duyệt cuối (vẫn cần `approve`). Deploy code là xong — HĐ đang "Chờ duyệt" tự thành "Chờ đính kèm", lượt duyệt cũ giữ làm lịch sử. Bảng thử dưới: bước 1–2 đọc theo v9 — Nhân viên KH lập HĐ ⇒ thấy ngay **Chờ đính kèm** + nút Đính kèm hồ sơ; Trưởng / Phó không còn nút Duyệt hợp đồng.

## 4. Thử tay sau khi chạy (trên site thật, ~10 phút, dùng HĐ thật đang chờ duyệt)

| # | Ai | Làm | Kỳ vọng |
|---|---|---|---|
| 1 | Nhân viên KH | mở HĐ đang chờ duyệt | không có nút Duyệt; thẻ "Chờ Trưởng / Phó phòng Kế hoạch duyệt hợp đồng" |
| 2 | Trưởng / Phó | Duyệt hợp đồng → Đồng ý | HĐ sang **Chờ đính kèm**; thanh chặng vàng ở Đính kèm |
| 3 | Nhân viên KH | Đính kèm hồ sơ → loại "Hợp đồng đã ký" → file PDF | HĐ sang **Đang ghi chuyến**; nút **Ghi chuyến** hiện |
| 4 | Nhân viên KH | mở "Nhật ký thao tác" cuối hồ sơ | thấy dòng lập / duyệt / đính kèm, đúng tên người |
| 5 | Nhân viên KH | thử Hoàn tác ngay một lần đính kèm | file gỡ; nhật ký thêm dòng "Hoàn tác: …" |
| 6 | 2 HĐ cũ đã duyệt | mở | **Đang ghi chuyến** (không kẹt Chờ đính kèm); chuyến cũ nguyên |
| 7 | admin / máy đã bấm duyệt trước 0079 | mở app | thẻ kết nối hết đỏ; lượt duyệt kẹt (nếu có) đã lên máy chủ |
| 8 | Người đóng cont | đính ảnh đóng cont | lưu được; nhật ký có dòng |

Duyệt cuối thử khi có HĐ xuất đủ thật (hoặc trên chế độ demo).

## 5. Đường lùi

- **Lỗi nhỏ ở màn**: sửa code, không lùi DB.
- **Phải lùi quyền** (VD Trưởng / Phó chưa sẵn sàng, cần Nhân viên KH tự ghi duyệt như cũ): chạy khối `ROLLBACK` cuối file 0079 — phần RLS lượt duyệt + trigger đóng HĐ + ô ma trận. **Kèm** lùi code (`git revert 0c0603a` + commit sửa sau nó) — code v8 không cho Nhân viên KH thấy nút Duyệt.
- **Không** `drop table export_activity_log` khi đã có nhật ký thật (mất dấu tra soát). Cột `stage` / `attachment_kind` và hồ sơ `step = contract` chỉ gỡ khi chưa có dòng mới (khối 🔴 trong ROLLBACK).
- Sao lưu: Supabase giữ bản sao hằng ngày; trước khi chạy ghi lại 3 số `real_*` ở bước 2.1.

## 6. Biết trước, để sau (không chặn chạy thật)

- Nhật ký ghi theo kiểu lạc quan: lượt ghi chính bị máy chủ từ chối sau đó thì dòng nhật ký vẫn còn (ghi việc đã BẤM, không phải việc đã lên máy chủ). Thẻ kết nối đỏ báo lượt ghi kẹt.
- Bấm Hoàn tác trên toast cũ sau khi Trưởng / Phó đã đóng HĐ: máy chủ chặn đúng, nhưng máy đó tạm thấy HĐ "mở" và dòng nằm hàng chờ (thẻ kết nối đỏ) — tải lại trang là về đúng.
- Bảng nhật ký tải cả bảng về máy như mọi bảng khác; vài nghìn dòng vẫn ổn, lớn hơn nữa thì chuyển sang tải theo từng HĐ.

## 7. Kiểm đã làm trước khi giao (2026-10-28)

- Audit 2026-10-28 (review độc lập + tự rà) sửa thêm trước khi chạy: nhật ký ghi bằng upsert bị từ chối (thiếu quyền UPDATE) · nạp lại demo không xóa được nhật ký demo · người ghi / giờ ghi giả được · HĐ cũ có bản sửa duyệt mới tụt về Chờ đính kèm · duyệt cuối khi còn bản sửa treo · Nhân viên KH xóa HĐ nháp có lượt duyệt · upsert lại HĐ đã đóng bị trigger chặn nhầm.
- PGlite: chuỗi 0001→0079 + chạy lại 0079 không lỗi mới; Nhân viên KH ghi lượt duyệt ⇒ RLS chặn; đóng / mở lại HĐ ⇒ trigger chặn, upsert lại HĐ đã đóng không đổi status ⇒ qua, SQL editor ⇒ qua; Trưởng / Phó làm được; nhật ký: upsert mới qua (tên giả ⇒ máy chủ thay bằng họ tên thật, giờ ⇒ giờ máy chủ), gửi lại qua, sửa nội dung ⇒ giữ nguyên, xóa dòng thật ⇒ 0 dòng, xóa dòng demo ⇒ được; phòng ban Trưởng phòng = `planning`.
- `npm run build` · `lint` · `test` (1008+) · `naming:check` xanh. Preview demo: duyệt, duyệt cuối, nhật ký, nút "?" viết tắt; 375 px × 130 % không tràn ngang.
