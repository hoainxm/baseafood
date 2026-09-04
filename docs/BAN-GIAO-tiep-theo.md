# Bàn giao — việc còn lại (cập nhật 2026-09-04)

> Cửa vào cho session tiếp theo. Đọc **CLAUDE.md** (root) + **docs/app-map/** trước khi code.
> **Quy tắc:** commit + push **trực tiếp `main`**, KHÔNG tách nhánh, KHÔNG mở PR (trừ khi được yêu cầu).
> Cổng kiểm: `npm run build` + `npm run lint` phải xanh trước khi commit. Không ghi URL/ref/key Supabase vào bất kỳ file nào trong repo.

## 1. Đã xong (đang ở `main`)
- **Cụm báo cáo khép vòng:** 3 báo cáo mới — BC thành phẩm ngày (`/bc-thanh-pham`), BC đơn đặt được xuất (`/bc-don-xuat`), hoàn thiện BC nhập hàng (tách phế liệu + Excel); NXT thành phẩm (`/nxt`) suy từ dữ liệu + tồn đầu (`finished_goods_opening_stock`); quy cách/size xuyên suốt SX/Đơn đặt; bản in A4 (primitive `PhieuIn`).
- **Nhật ký thao tác (audit):** bắt tại chốt `useBang.ghi` → `audit_log` append-only; màn `/audit` (chỉ admin). Xem `lib/audit.ts`.
- **Gộp nhánh docs-flow:** đóng gói BTP→TP (`/packaging`, G3), bán lẻ block trừ tồn, phân quyền 2 giao diện bộ phận (`lib/nav-access.ts`), cold-storage tồn thật, đối chiếu Nhập↔SX trong ngày, cột `processing_type` + `leftover_kg`, `DailyTaskReminder`.
- **Mô hình tồn kho: 2 KHO** (BTP dự trữ + TP đóng gói) ở `lib/inventory.ts` (`tinhTon` với `banLe = [...locBanLe(bán, KHO_BAN_LE), ...dongGoiTruTon(đóng gói)]`, `tinhTonTP` cho kho TP) + `lib/inventoryFinished.ts` (`tinhSoTonTP`). Đã kiểm chứng: Tồn Kho dự trữ == Tồn cuối NXT; handoff đơn đặt không đếm 2 lần; kho TP tách riêng.

## 2. Migration cần chạy trên Supabase (theo thứ tự)
`0024_ton_dau_thanh_pham` → `0025_nhat_ky_thao_tac` → `0026_nl_vao_cho_phep_khong` → `0027_products_processing_type` → `0028_production_leftover` → `0029_dong_goi_thanh_pham` → `0030…0034` (customer/components, split/block, nxt snapshot, wip processing_type) → **`0035_shipment_lo_sscc`** (2 cột nullable mã lô + SSCC vào `import_shipments`) → **`0036_qc_checklist`** (2 bảng mới `qc_checklists` + `qc_locks`) → **chạy lại `0021_siet_rls_tieng_anh`** (nay bao thêm `qc_checklists`,`qc_locks`; gồm 2 tồn đầu + `packagings`; `audit_log` giữ RLS riêng ở `0025`).
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
   - ⏳ **Đã có báo cáo XNT thật (KHO 1000 T7/2026: cá .xlsx + bạch tuộc .pdf) + SPEC:** [`docs/spec/import-xnt-kho-cutover.md`](spec/import-xnt-kho-cutover.md). Chốt tới 2026-08-26: **cấp lô (Phương án A)** · đọc cả .xlsx lẫn .pdf · mã hàng `PX<phân xưởng>.<nhóm><nguồn>.<lô>` (mới chắc PX*=Đông/Cá/Khô) · **realtime chạy cấp lô** (mirror phần mềm kế toán) ⇒ module = **sổ tồn kho NL cấp lô đầy đủ**, chia **2 pha** (Pha 1 import cutover đủ cho tồn đầu 01/09; Pha 2 nhập/xuất realtime theo lô).
     - ⏸️ **NHẮC CHỦ DỰ ÁN (HOLD):** chốt "người dùng thao tác nhập/xuất **chi tiết tới lô**" trước khi thiết kế màn nhập Pha 2 (hướng CÓ, chưa chốt cứng).
     - Việc kế tiếp: chủ dự án trả lời §9 (nhỏ) + gửi **file mềm T7 & T8 mọi phân xưởng** → mở **session mới** build Pha 1 (migration 🟡 2 bảng + màn import).
7. **Định mức NL→TP; báo cáo tháng 6 khối.**
8. **Định hướng họp 2026-09-02** (canonical: [`docs/trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md`](trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md)) — chốt số chạy realtime **từ tháng 9**; ưu tiên: (a) 🟩 **form nhập chuẩn + chụp ảnh phiếu tay → OCR** (giảm gõ tay ở xưởng; viết tay song song app ~1 tháng); (b) 🟨 **giá & bình quân gia quyền theo ngày** — **chốt PA trước khi sửa `balancingCalc.ts`**; (c) 🟨 **định danh lô + QR** trace nội bộ (khớp SPEC cấp lô; SSCC chừa ô trống, làm sau); (d) 🟩 **mã KH/đại lý bằng số**; (e) 🟨 **QC checklist chấm điểm + ảnh**; (f) 🟩 **khung nhân sự gắn từng khâu** (Dung/Trúc/Luyên/Hạnh/Lan; Nam soạn biểu mẫu → 4 người xuống xưởng ~2h). Để sau (🅿️): lương/BHXH/nghỉ phép qua app; điện thoại trong xưởng.

## 5. Cạm bẫy cần nhớ
- `useBang` ghi CẢ LÔ, offline có hàng chờ — sửa `repo.ts` phải giữ `vaDongCu` + không nuốt dòng chưa đẩy.
- Migration mới: `if not exists`, idempotent, kèm rollback; đăng ký trigger `updated_at` + RLS (thêm vào `0021` nếu là bảng cần siết).
- Handoff đơn đặt dùng marker `sourceWarehouse = "Đơn đặt"` — đừng đổi (NXT + tồn kho dựa vào nó để không đếm 2 lần).
