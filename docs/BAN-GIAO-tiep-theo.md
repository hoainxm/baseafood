# Bàn giao — việc còn lại (cập nhật 2026-08-25)

> Cửa vào cho session tiếp theo. Đọc **CLAUDE.md** (root) + **docs/app-map/** trước khi code.
> **Quy tắc:** commit + push **trực tiếp `main`**, KHÔNG tách nhánh, KHÔNG mở PR (trừ khi được yêu cầu).
> Cổng kiểm: `npm run build` + `npm run lint` phải xanh trước khi commit. Không ghi URL/ref/key Supabase vào bất kỳ file nào trong repo.

## 1. Đã xong (đang ở `main`)
- **Cụm báo cáo khép vòng:** 3 báo cáo mới — BC thành phẩm ngày (`/bc-thanh-pham`), BC đơn đặt được xuất (`/bc-don-xuat`), hoàn thiện BC nhập hàng (tách phế liệu + Excel); NXT thành phẩm (`/nxt`) suy từ dữ liệu + tồn đầu (`finished_goods_opening_stock`); quy cách/size xuyên suốt SX/Đơn đặt; bản in A4 (primitive `PhieuIn`).
- **Nhật ký thao tác (audit):** bắt tại chốt `useBang.ghi` → `audit_log` append-only; màn `/audit` (chỉ admin). Xem `lib/audit.ts`.
- **Gộp nhánh docs-flow:** đóng gói BTP→TP (`/packaging`, G3), bán lẻ block trừ tồn, phân quyền 2 giao diện bộ phận (`lib/nav-access.ts`), cold-storage tồn thật, đối chiếu Nhập↔SX trong ngày, cột `processing_type` + `leftover_kg`, `DailyTaskReminder`.
- **Mô hình tồn kho: 2 KHO** (BTP dự trữ + TP đóng gói) ở `lib/inventory.ts` (`tinhTon` với `banLe = [...locBanLe(bán, KHO_BAN_LE), ...dongGoiTruTon(đóng gói)]`, `tinhTonTP` cho kho TP) + `lib/inventoryFinished.ts` (`tinhSoTonTP`). Đã kiểm chứng: Tồn Kho dự trữ == Tồn cuối NXT; handoff đơn đặt không đếm 2 lần; kho TP tách riêng.

## 2. Migration cần chạy trên Supabase (theo thứ tự)
`0024_ton_dau_thanh_pham` → `0025_nhat_ky_thao_tac` → `0026_nl_vao_cho_phep_khong` → `0027_products_processing_type` → `0028_production_leftover` → `0029_dong_goi_thanh_pham` → **chạy lại `0021_siet_rls_tieng_anh`** (nay bao 26 bảng: gồm 2 tồn đầu + `packagings`; `audit_log` giữ RLS riêng ở `0025`).
⛔ **ĐỪNG chạy:** `0002` (phá SDFactory), `0003` (lỗi thời), `0023` (reset+seed demo cân đối).

## 3. Go-live — đưa vào chạy hằng ngày (người dùng làm, session hỗ trợ)
1. **Deploy:** `git pull` → `git push` (remote 2 URL tự sync repo cá nhân → Vercel build). Kiểm Vercel xanh, Console không đỏ.
2. **DB:** chạy migration ở §2. Kiểm `pg_policies` không còn dòng `anon`.
3. **Tài khoản & vai trò:** admin tạo tài khoản thật + gán vai trò (thủ kho→`warehouse-keeper`; tổ trưởng/quản đốc→`team-leader`/`manager-dong|ca|kho`; kế toán→`accountant`; GĐ→`director`). Đổi mật khẩu admin. Xóa tài khoản test.
4. **Supabase Auth:** Site URL + Redirect URLs = domain Vercel; tắt "Confirm email".
5. **Tồn đầu:** khai tồn đầu NL (màn Tồn kho NL) + tồn đầu TP (màn NXT thành phẩm) cho số dư trước khi số hoá.
6. **Pilot:** chạy thử 1 ngày end-to-end (nhập → SX → duyệt kho → đóng gói → bán/đơn → đối chiếu 3 màn tồn khớp) trước khi nhân rộng (5 người ≥45 tuổi).

## 4. Backlog phát triển (ưu tiên gợi ý)
1. **Ẩn/gắn nhãn màn DEMO** trước khi chạy thật: `/dashboard`, `/production` (WorkOrderScreen mock), `/quality`, `/reports` (mock), `/traceability` (mock); `/cold-storage` nay đã tồn thật một phần.
2. **Server-side RLS theo vai trò** (hiện phân quyền chỉ ở app-level `nav-access.ts`; DB chưa ràng theo vai trò/`site_id`).
3. **Audit Phase 2:** trigger DB trên bảng nhạy (cân đối, chốt sổ) làm backstop chống sửa vết bằng SQL.
4. **Chốt ngày bán + phiếu bán in A4** (đối xứng chốt ngày nhập/SX).
5. **Chuẩn hoá quy cách × chế biến (Chiều C)** — xem `docs/spec/bo-quy-cach-che-bien-thanh-pham.md`.
6. **Cutover 01/09:** import baseline tồn 30/06 + nhập bù báo cáo T7–T8 → tồn đầu 01/09; xem `docs/trien-khai/ke-hoach-cutover-1-9-2026.md`. Import Excel + scan viết tay (tay trước).
7. **Định mức NL→TP; báo cáo tháng 6 khối.**

## 5. Cạm bẫy cần nhớ
- `useBang` ghi CẢ LÔ, offline có hàng chờ — sửa `repo.ts` phải giữ `vaDongCu` + không nuốt dòng chưa đẩy.
- Migration mới: `if not exists`, idempotent, kèm rollback; đăng ký trigger `updated_at` + RLS (thêm vào `0021` nếu là bảng cần siết).
- Handoff đơn đặt dùng marker `sourceWarehouse = "Đơn đặt"` — đừng đổi (NXT + tồn kho dựa vào nó để không đếm 2 lần).
