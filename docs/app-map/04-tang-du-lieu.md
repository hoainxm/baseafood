> Load khi: đụng đọc/ghi dữ liệu, thêm bảng vào app, hay điều tra "số liệu biến mất / không lên máy chủ".
covers: src/lib/repo.ts, src/lib/db.ts, src/lib/catalogRepo.ts, src/lib/botTam.ts, src/lib/banNoiDia.ts, src/lib/connectivity.ts, src/lib/supabase.ts, src/lib/store.ts, src/lib/audit.ts, src/lib/storage.ts, src/design-system/patterns/DataStatusBadge.tsx
last_verified: 2026-10-06
ttl_days: 90
<!-- updated: 2026-10-06 (d) — THÊM BANG_ROW_MARK (row_marks, mig 0055, localKey bsf.row-marks.v1) + hook useRowMarks(): TÔ MÀU DÒNG "đã dò" kiểu Excel, MỘT bảng dùng chung mọi bảng. Màn hình KHÔNG gọi hook này: `features/shared/ToMauProvider.tsx` gọi MỘT lần ở ShellLayout (App.tsx) rồi cấp qua `ToMauContext` của design-system — mỗi useBang giữ state riêng, nhiều instance thì bảng này ghi đè mất dấu bảng kia trong bản sao dưới máy. Hàm thuần lib/toMau.ts (idDauTo tất định · dauCuaBang · datDau ghép lại dấu bảng khác) + test. `nhatKyThayDoi` BỎ QUA row_marks (dấu trình bày, đã có marked_by/marked_at — tô cả trăm dòng không được làm ngập /audit). Bảng mới ⇒ chưa chạy 0055 thì chỉ dấu tô nằm hàng chờ. -->
<!-- re-verified: 2026-10-06 15:20 — khuôn AnhXaBang{table,localKey,layKhoa,toRow,fromRow} + useBang (ghi so cũ↔mới, hàng chờ `.cho`) + NHAN_BANG khớp code khi thêm BANG_ROW_MARK. -->
<!-- updated: 2026-10-06 (c) — THÊM BANG_DOMESTIC_SALE (domestic_sales, mig 0054, localKey bsf.domestic-sales.v1) + hook useDomesticSales(): sổ bán nội địa (NL bán thẳng) ghi ở /wip; usePeriodGrid đọc để điền dòng giảm "Bán nội địa" (lib/banNoiDia.ts thuần, có test). Bảng mới nên chưa chạy 0054 thì chỉ sổ bán nội địa nằm hàng chờ — bảng khác không ảnh hưởng. -->
<!-- re-verified: 2026-10-06 10:35 — khuôn thêm bảng (AnhXaBang{table,localKey,layKhoa,toRow,fromRow,vaDongCu?}) + useBang(seed) đẩy seed khi bảng server rỗng + dongBoCho upsert defaultToNull:false + luật "cột mới gửi LUÔN để xoá được về rỗng" (leftover_by_material/photo_paths) — khớp code khi thêm BANG_BATTER_TYPE. -->
<!-- updated: 2026-10-06 (c) — BANG_BALANCING_INPUT map `stockLineId` ↔ `stock_line_id`, `stockLocation` ↔ `stock_location` (mig 0053), toRow CHỈ gửi khi trường != null (fromRow ra `undefined` khi DB chưa có cột) — khuôn 0052. Cân đối giờ GHI cả `monthly_stock_ledger` (useMonthlyStock) qua chốt `usePeriodGrid.ghiNL` → `lib/khoCanDoi.dongBoSoKho`; ảnh chụp hoàn tác của kỳ thêm bảng thứ 5 (`kho`). -->
<!-- updated: 2026-10-06 (b) — BANG_BALANCING_OUTPUT map `debtKg` ↔ `debt_kg` (mig 0052, phần Nợ của chuyển kỳ khối bán thành phẩm). toRow CHỈ gửi khi `debtKg != null` (khuôn nguon_kho/0008, ngoại lệ có chủ đích của luật "gửi luôn"): fromRow trả `undefined` khi DB chưa có cột ⇒ dòng cũ vẫn lên máy chủ; DB đã có cột ⇒ fromRow luôn ra số ⇒ luôn gửi ⇒ xoá Nợ về 0 vẫn ghi được. `carryOverKg` vẫn là tổng Trả + Nợ. Không đổi localKey. -->
<!-- updated: 2026-10-06 — BỘT TẨM (mig 0051): THÊM BANG_BATTER_TYPE (batter_types, localKey bsf.batter-types.v1) + hook useBatterTypes() seed BOT_TAM_SEED (id tất định, khớp seed SQL ⇒ hai chế độ cùng danh sách). BANG_PRODUCT map `batterIds` ↔ `batter_ids` (form danh mục lưu chuỗi "id1,id2" ⇒ toRow chuẩn hoá bằng botDiKemIds), vaDongCu `batterIds ?? []`. BANG_WIP_PRODUCTION map `batterKg` ↔ `batter_kg` (jsonb; đọc/ghi qua lamSachBot — bỏ ô ≤0, chịu chuỗi JSON của bản sao local), vaDongCu `batterKg ?? {}`. Cả hai cột GỬI LUÔN (gửi có điều kiện thì không xoá được về rỗng) ⇒ PHẢI chạy 0051 trước deploy. Hàm thuần ở src/lib/botTam.ts (+ test). seedProducts gắn batterIds = suyBotDiKem(tên). -->
<!-- re-verified: 2026-09-14 — khuôn thêm bảng (AnhXaBang{table,khoaChinh?,localKey,layKhoa,toRow,fromRow,vaDongCu?} repo.ts:66) + useBang + hàng chờ khớp code khi thêm BANG_RECONCILIATION_RUN. (task lưu đối soát) -->
<!-- updated: 2026-10-02 (b) — FIX HÀNG CHỜ KẸT: `dongBoCho` upsert NHIỀU dòng dùng mặc định supabase-js `defaultToNull: true` ⇒ dòng THIẾU một key (vd mặt hàng tạo nhanh ở /wip không có materialTypeId, JSON bỏ undefined) bị điền NULL ⇒ cột NOT NULL (`products.material_type_id`) từ chối CẢ LƯỢT (23502) ⇒ hàng chờ products kẹt vĩnh viễn: products KHÔNG lên server từ 28/08 tới 02/10 (91 mặt hàng, mọi máy; 6 mẻ /wip trỏ mặt hàng "không có"). Sửa: `upsert(..., { onConflict, defaultToNull: false })` (thiếu key ⇒ DEFAULT cột) + BANG_PRODUCT.toRow gửi `?? ""` cho category/material_type_id/processing_type/finished_good_code. Đã kiểm trên DB thật bằng 2 dòng giả (đã xóa): trước sửa 23502, sau sửa lên được, material_type_id = ''. Hàng chờ cũ tự lên khi máy giữ nó mở bản mới. BẤT BIẾN: đừng bỏ `defaultToNull: false`. -->
<!-- updated: 2026-10-02 — THÊM BANG_LABEL_PRINT (label_prints, mig 0049, localKey bsf.label-prints.v1) + hook useLabelPrints(): sổ in tem QR. Ghi từ TemLoQr (features/shared/QrTemLoIn.tsx) lúc bấm In; đọc ở /qr (tab In tem hàng loạt + hộ chiếu lô) qua tomTatIn (lib/truyXuatLo). NHAN_BANG thêm "In tem QR". -->
<!-- updated: 2026-09-18 — THÊM BANG_LOT_INPUT (lot_inputs, mig 0046, localKey bsf.lot-inputs.v1) + hook useLotInputs(): sự kiện biến đổi lô (mẻ SX / đóng gói đã dùng lô nào) cho truy xuất QR. quantity_kg giữ NULL (chưa cân) chứ không ép 0. Hook gom `useDuLieuTruyXuat()` (src/features/shared) đọc 10 bảng thành DuLieuTruyXuat cho lib thuần `src/lib/truyXuatLo.ts`. Thiết kế: ../spec/qr-truy-xuat-lo.md. -->
<!-- updated: 2026-09-14 — THÊM BANG_RECONCILIATION_RUN (reconciliation_runs, migration 0043) + hook useReconciliationRuns() cho màn /doi-soat: LƯU bản đối soát hóa đơn theo TÀI KHOẢN (nháp/chính thức). Lưu FILE GỐC base64 (cột file_b64, để mở lại chạy lại) + options jsonb {soChuanTen,edits} + summary jsonb (ảnh chụp 4 nhãn+tổng chênh, đóng băng cho bản chính thức). Base64 TRONG bảng (không dùng Storage) để nằm dưới RLS của bảng + chạy được cả localStorage. Riêng tư theo account ép ở TẦNG APP (hook lọc userId===nguoiDung.id, admin xem tất) — RLS server permissive như 0041, siết user_id=auth.uid() để nhánh 0021. toRow/fromRow parse jsonb qua parseObj. Xem 37-doi-soat-hddt.md. -->
<!-- re-verified: 2026-09-11 09:00 — §Nhật ký (audit): ghi nhập hàng (import_shipments/material_imports) qua useBang.ghi → nhatKyThayDoi → ghiNhatKy → buffer bsf.audit.buffer + audit_log (append-only, /audit chỉ admin). Live: nhập 1 chuyến qua UI sinh entry `them` import_shipments + material_imports đúng action/entity/summary; ghi THẲNG localStorage (bỏ qua repo) KHÔNG sinh audit — đúng thiết kế (chốt duy nhất là useBang.ghi). actor rỗng ở chế độ demo (không đăng nhập); Supabase có login stamp username. -->
<!-- updated: 2026-09-15 — BANG_MONTHLY_STOCK map thêm `storageLocation` ↔ `storage_location` (mig 0045, gửi LUÔN để xoá được vị trí) + vaDongCu vá `storageLocation ?? ""`. -->
<!-- re-verified: 2026-09-15 15:30 — khuôn AnhXaBang{table,localKey,layKhoa,toRow,fromRow,vaDongCu?} (repo.ts:66) + useBang(bang, seed) (repo.ts:1231) + NHAN_BANG (repo.ts:~1190) vẫn đúng: thêm BANG_STORAGE_LOCATION theo đúng khuôn, chạy được. -->
<!-- updated: 2026-09-15 — thêm BANG_STORAGE_LOCATION (storage_locations) + hook useStorageLocations(seedStorageLocations) — danh mục KHO LƯU (kho nhà "Kho Baseafood" + kho lạnh thuê ngoài Hồng Phú/Ánh Dương). Seed app dùng ĐÚNG id của seed SQL 0044 (kho-baseafood/kho-hong-phu/kho-anh-duong) nên chạy localStorage rồi cutover Supabase không nhân đôi. NHAN_BANG['storage_locations']. BANG_NXT_SNAPSHOT map thêm `storage_location` ↔ NxtSnapshotLine.storageLocation + vaDongCu vá dòng cũ về "" (rỗng = kho nhà). Nối theo TÊN kho, không phải id — đổi tên kho trong danh mục KHÔNG tự đổi các dòng đã gán (chủ ý: báo cáo/Excel xí nghiệp đi theo tên). Xem 03-database (0044) + 32-danh-muc (tab Kho lưu trữ). -->
<!-- re-verified: 2026-09-09 15:00 — useBang nạp phân trang: CO_TRANG=1000 + vòng .range(tu, tu+999) tới khi trang<1000 (repo.ts:1201-1220); BANG_MONTHLY_STOCK + useMonthlyStock có thật — khớp code. -->
<!-- updated: 2026-09-09 — (SỬA BUG tải cụt) useBang nạp server THEO TRANG: PostgREST mặc định trả tối đa 1000 dòng/select. Trước đây select một phát ⇒ bảng >1000 dòng (VD sổ kho theo tháng nạp cả năm ~1.4k dòng) bị cắt còn 1000 khi reload, mất dữ liệu hiển thị (server vẫn đủ). Nay lặp .range(tu, tu+999).order(khoa) tới khi trang < 1000 → lấy đủ. Áp cho MỌI bảng. -->
<!-- updated: 2026-09-09 — thêm BANG_MONTHLY_STOCK (monthly_stock_ledger) + hook useMonthlyStock() cho SỔ KHO THEO THÁNG (/ton-kho-thang). toRow/fromRow map đủ cột kiện+kg (open/in/out _ctn/_kg), kg_per_ctn/unit_price nullable, carried_from_id, sort_order; có vaDongCu vá field mới. NHAN_BANG['monthly_stock_ledger']. Toán thuần ở lib/monthlyStock.ts (suyDong/tongDong/gomNhom/donSangThang + tháng dương lịch) — dồn tồn cuối kỳ → đầu kỳ sau bằng id tất định `carry|<id-nguồn>` (chạy lại chỉ cập nhật, không nhân đôi). Xem 36-so-kho-thang. -->
<!-- updated: 2026-09-07 — (QĐ-8 ảnh QC) BANG_QC_CHECKLIST (qc_checklists) map thêm cột `photo_paths` (jsonb ↔ QcChecklistItem.photoPaths: string[]) — gửi LUÔN như leftover_by_material (migration 0039 đã chạy). ẢNH KHÔNG qua repo: file lưu ở Supabase Storage bucket "qc" qua src/lib/storage.ts (hàm thuần taiAnhLen/urlAnh/xoaAnh + coLuuAnh, gọi thẳng từ màn như lib/audit.ts) — DB chỉ giữ ĐƯỜNG DẪN, xem qua signed URL. Chế độ !supabase: coLuuAnh=false, ẩn nút ảnh, không vỡ. Xem docs/ops/supabase-storage.md. -->
<!-- updated: 2026-08-28 — seedProducts (nạp mat_hang) nay: (a) gắn processingType = suyKieuCheBien(tên) — suy kiểu chế biến TỪ TÊN, bảo thủ (không rõ để "", khớp trước thắng); (b) nối 8 mặt hàng thật thiếu ở 141 (finishedGoodCode="" = chưa ánh xạ, mức gộp). Chỉ chạy khi bảng rỗng ⇒ bản đã seed dùng migration 0034 để backfill/nạp. suyKieuCheBien export dùng chung với SQL 0034. -->
<!-- updated: 2026-08-27 (P5-A) — /nxt-kho thành SỔ SỐNG trên nxt_snapshots: chế độ Ghi (LuoiNhap sửa tồn đầu/nhập/xuất từng mã, tồn cuối suy tự cập nhật) + Thêm/Xóa mã + "Tạo kỳ kế tiếp" kế thừa tồn cuối kỳ này → tồn đầu kỳ sau (id tất định nxt|kho|từ|đến|mã). Chưa nối bảng giao dịch (P5-B chờ bảng ánh xạ mã). -->
<!-- updated: 2026-08-27 — thêm BANG_NXT_SNAPSHOT (nxt_snapshots) + hook useNxtSnapshots(seedNxtSnapshots) cho báo cáo Xuất–Nhập–Tồn kho (/nxt-kho). Seed số THẬT từ src/data/nxt-bachtuoc-2026-07.json (30 mã bạch tuộc, KHO TP-1000, đã kiểm định khớp tổng); id snapshot TẤT ĐỊNH theo (kho×kỳ×mã) để seed idempotent. NHAN_BANG['nxt_snapshots']. Màn nhập được Excel báo cáo thật qua lib/nxtExcel.ts parseNxtExcelFile. -->
<!-- updated: 2026-08-24 — thêm BANG_FINISHED_OPENING_STOCK (finished_goods_opening_stock) + hook useFinishedGoodsOpeningStock cho sổ NXT thành phẩm; hàm thuần lib/inventoryFinished.ts suy tồn TP từ SX/đơn/bán; tinhTon() nhận thêm tham số bán hàng (tùy chọn) -->
<!-- updated: 2026-08-21 — thêm BANG_OPENING_STOCK (material_opening_stock) + hook useMaterialOpeningStock cho sổ NXT nguyên liệu; hàm thuần lib/inventoryMaterial.ts suy tồn từ carryOver của Cân đối -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: patterns/DataStatusBadge.tsx (symbol TrangThaiDuLieu giữ nguyên) -->

<!-- updated: 2026-08-17 — 0019: cột lưới ngày (daily_quantities jsonb, carry_over_kg, auto_source, is_reduction) + balancing_period_id trên material_imports/production_wips; doiSanLuongNgay() lọc ô không phải số -->

# Tầng dữ liệu & đồng bộ

Một API duy nhất cho hai chế độ. Màn hình chỉ viết:

```ts
const [rows, ghi] = useNhapNL();   // ghi(next) — truyền NGUYÊN danh sách mới
```

Chạy Supabase hay localStorage là do `.env` quyết định (`src/lib/supabase.ts`: thiếu URL **hoặc** anon key ⇒ `supabase = null`). Màn hình không được biết sự khác biệt này.

## Vì sao thiết kế "truyền cả danh sách"

Không có `add/update/delete` riêng. `useBang.ghi(next)` **so danh sách cũ với mới** để suy ra dòng nào thêm/sửa/xóa. Đổi lại:

- Màn hình viết code thuần (map/filter), không phải nghĩ về API mạng.
- **Bẫy:** repo trả về **toàn bộ** dòng của mọi kỳ/mọi ngày. Màn nào lọc ra tập con thì lúc ghi **phải ghép lại** với phần còn lại (`KyDetail.ghepLai` trong `BalancingScreen.tsx` là mẫu). Quên ghép = xóa sạch dữ liệu của kỳ khác.
- So sánh bằng `JSON.stringify` → thứ tự khóa trong object có ý nghĩa; đừng dựng lại object với thứ tự trường khác chỉ để "cho đẹp", sẽ tạo update thừa.

## Hàng chờ đồng bộ — đừng tháo

Ghi lên máy chủ hụt giữa ca là chuyện thường (wifi rớt, tablet ngủ). Mỗi bảng giữ một hàng chờ ở `localStorage` khóa `<localKey>.cho`:

- `them`: khóa các dòng thêm/sửa chưa lên server.
- `xoa`: tombstone các dòng đã xóa dưới máy nhưng chưa xóa được trên server.

Bất biến:

1. **Ghi hàng chờ TRƯỚC khi gọi server.** Hụt thì lần sau còn dấu để đẩy lại.
2. Lúc mở app, **hoà** server với local chưa đẩy — nền là server, dòng trong `them` thắng, dòng trong `xoa` bị gỡ. **Không đè mù**, nếu không reload sẽ nuốt chuyến hàng ghi hụt.
3. Mọi lần ghi *và* mọi lần mở app đều thử đẩy lại toàn bộ hàng chờ.
4. Bản sao localStorage luôn được ghi, kể cả khi đang chạy Supabase — mất mạng giữa ca vẫn còn số để đối chiếu.

Hệ quả cho người vận hành: chưa chạy migration mới ⇒ số liệu **không mất**, nằm trong hàng chờ, tự lên khi DB sẵn sàng. Nhưng máy khác chưa thấy.

## Thêm một bảng vào app

1. Migration DB ([03-database.md](03-database.md)).
2. Thêm `interface` + bất biến vào `src/types.ts`.
3. Thêm `BANG_X: AnhXaBang<T>` trong `repo.ts`: `table`, `localKey` (**đặt mới, đừng đổi khóa cũ** — đổi là mất dữ liệu đang có trên máy người dùng), `toRow`/`fromRow` đủ hai chiều, `khoaChinh` nếu không phải `id`.
4. Thêm `export const useX = () => useBang(BANG_X)` trong `lib/catalogRepo.ts`.
5. Màn hình gọi hook đó — **không** import `repo.ts` trực tiếp trừ khi cần `AnhXaBang`.

## `vaDongCu` — vá dòng cũ, một chỗ

Bản sao localStorage được đọc thẳng bằng `JSON.parse`, **không đi qua `fromRow`** ⇒ dòng ghi từ bản app trước sẽ thiếu trường mới thêm. Vá ở `vaDongCu` (một chỗ) thay vì rải `?? ""` khắp màn hình. Ví dụ đang có: `chuyenId` (dòng trước khi có chuyến thật), `nguon`/`ngay`/`phanXuong` của `phe_lieu`, `quyCach`/`banHangId` của `thanh_pham_ra` (dòng trước khi có sổ bán).

**Tô màu dòng** (`useRowMarks()` → `BANG_ROW_MARK` → `row_marks`, mig 0055) là ngoại lệ có chủ đích của "màn gọi hook": chỉ `ToMauProvider` (features/shared, gắn một lần ở `ShellLayout`) gọi hook, rồi cấp cho mọi bảng qua `ToMauContext` của design-system — bảng bật bằng prop `toMau="<khoá bảng>"`. Lý do: `useBang` giữ state theo instance, mỗi bảng tự gọi thì lần ghi của bảng này đè mất dấu bảng kia trong bản sao localStorage. Không ghi nhật ký (`nhatKyThayDoi` bỏ qua `row_marks`). Luật dùng: [README design-system § Tô màu dòng](../../src/design-system/README.md#tô-màu-dòng-đã-dò-kiểu-excel).

Bán thành phẩm dùng `usePhieuBan()` / `useBanHang()` (`BANG_PHIEU_BAN` / `BANG_BAN_HANG`) — cùng khuôn `useBang`, xem [33-ban-hang.md](33-ban-hang.md).

Tồn kho nguyên liệu dùng `useMaterialOpeningStock()` (`BANG_OPENING_STOCK` → `material_opening_stock`) — **chỉ** lưu tồn đầu khai tay. Con số Nhập/Xuất/Tồn còn lại **không có bảng riêng**: hàm thuần `lib/inventoryMaterial.ts` suy thẳng từ `material_imports` (nhập tươi) + `carry_over_kg` của `balancing_inputs` (đông gửi/xả đông). Không chép số ⇒ không lệch sổ Cân đối. Xem [31-can-doi-ky.md](31-can-doi-ky.md).

### Nhật ký thao tác (audit)

Mọi ghi dữ liệu đều qua `useBang.ghi` — nên đây là CHỐT duy nhất để lưu vết. `ghi` so danh sách cũ↔mới, gọi `nhatKyThayDoi()` phát entry **thêm/sửa/xóa** (kèm `diff` trường đổi) rồi `ghiNhatKy()` trong `lib/audit.ts` đẩy vào `audit_log`. Chạy CẢ hai chế độ (chạy trước cả `if (!supabase) return`). Đăng nhập/xuất log ở `auth.ts`. "Ai" lấy từ `datNguoiThaoTac()` (App set theo tài khoản đăng nhập). Đặc tính: **append-only**, buffer localStorage (cap 3000), đẩy **im lặng** — hụt thì giữ buffer, **KHÔNG** bật đèn đỏ kết nối (nhật ký là phụ, không chặn nghiệp vụ). Màn đọc: `/audit` (chỉ admin). Không tự lưu vết bảng `audit_log`. Migration `0025`.

Tồn kho **thành phẩm** đối xứng: `useFinishedGoodsOpeningStock()` (`BANG_FINISHED_OPENING_STOCK` → `finished_goods_opening_stock`) **chỉ** lưu tồn đầu khai tay theo (mặt hàng × quy cách). Con số N/X/T suy thẳng ở hàm thuần `lib/inventoryFinished.ts`: **Nhập** = `production_wips` đã `da-nhap` (theo ngày SX), **Xuất** = `export_items` (đơn đặt, theo `export_orders.export_date`) + `sales_items` (bán ngày) *trừ* handoff đơn đặt (`source_warehouse = "Đơn đặt"`, chống đếm hai lần), **Tồn đầu** = khai tay + lịch sử trước kỳ. `lib/inventory.ts#tinhTon()` nhận thêm tham số `banHang` (tùy chọn, mặc định `[]` = hành vi cũ) để trừ bán ngày FIFO ⇒ tồn Kho dự trữ ăn khớp Tồn cuối NXT thành phẩm. Không chép số ⇒ không lệch các sổ nguồn.

## Seed

`useBang(bang, seed)` — seed chỉ chạy khi **cả** server lẫn local đều rỗng và hàng chờ rỗng; khi đó seed được đẩy lên server luôn. Đang seed: `loai_nguyen_lieu` (12 loại hay gặp) và `thanh_pham` (141 mã từ `src/data/thanh-pham.json`). File JSON đó **chỉ là seed** — nguồn thật là bảng `thanh_pham`.

## Đèn kết nối

`lib/connectivity.ts` là store nhỏ dùng chung, quy ước **"lần gần nhất thắng"**: mỗi thao tác server (bảng nào cũng vậy) báo về; ghi lỗi → đỏ ngay, lần ghi sau thành công → xanh lại. Cố tình không phải "probe 1 bảng lúc mở app rồi xanh mãi" — đèn phải phản ánh sức khỏe ghi/đọc thật. `TrangThaiDuLieu` (góc thanh bên) đọc qua `useSyncExternalStore`; snapshot bất biến, đừng trả object mới mỗi lần gọi (render vô hạn).

## Cross-references

- Schema, quy ước tên cột: [03-database.md](03-database.md)
- Rủi ro anon key / RLS: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md)
- Mẫu ghép lại danh sách con: `KyDetail` trong [31-can-doi-ky.md](31-can-doi-ky.md)
