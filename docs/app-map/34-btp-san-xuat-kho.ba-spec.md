> Load khi: thiết kế/xây module WIP — sản xuất bán thành phẩm ngày, kho dự trữ đông, đơn đặt, xuất container.
covers: src/features/production/WipProductionScreen.tsx, src/features/warehouse/ReserveWarehouseScreen.tsx, src/features/orders/SalesOrderScreen.tsx, src/features/packaging/PackagingScreen.tsx, src/lib/inventory.ts, supabase/migrations/0011_wip_san_xuat_kho_don.sql, supabase/migrations/0026_dong_goi_thanh_pham.sql
last_verified: 2026-08-25
ttl_days: 90
status: ba-spec — ĐÃ BUILD v1 (migration 0011 + 3 màn WipProductionScreen/ReserveWarehouseScreen/SalesOrderScreen); + đóng gói BTP→TP (G3, migration 0026, màn PackagingScreen)
<!-- updated: 2026-08-25 — GIẢN LƯỢC màn ghi thành phẩm ngày (/wip, chốt với chủ dự án): mục tiêu v1 chỉ "ghi lượng thành phẩm làm ra mỗi ngày", KHÔNG quản lý nguyên liệu lấy ra kho. BỎ khỏi đầu phiên + entry: ô "Loại nguyên liệu", panel "Đối chiếu Nhập↔SX", "còn dở nguyên liệu" khi chốt, ô Quy cách (cột DB spec giữ nguyên, dòng mới để trống — size nằm trong TÊN mặt hàng). GIỮ "Số block". THÊM (migration 0030): mỗi dòng gắn KHÁCH HÀNG (useCustomers, lưu theo tên); thành phẩm cắt chần TÁCH 2 thành phần cùng giá (râu + bao tử) — nút "Tách" → THẺ COLLAPSE (thu gọn hiện Tổng, mở ra 2 ô râu/bao tử; moRong), quantity_kg = tổng, component_rau_kg/component_bao_tu_kg lưu breakdown (cân đối chỉ dùng tổng). Entry đổi sang BẢNG trải ngang nhập-một-lượt-lưu-một-lần (BangDongSX) + ngày ghi sổ kéo ngày SX theo — đồng bộ màn Nhập hàng. Định mức NL÷TP để dành tính ở kỳ Cân đối: map qua product.materialTypeId — **gắn loại NL cho mặt hàng ở Danh mục** (CatalogScreen tab Mặt hàng đã có ô), KHÔNG chọn NL ở màn ghi. Nav đổi "Sản xuất BTP" → "Sản xuất thành phẩm". -->
<!-- updated: 2026-08-23 — G3 đóng gói BTP→TP: bảng packagings (0026) + màn /packaging (phiếu đóng gói: BTP tiêu hao→TP ra, hao hụt). Tồn 2 pool suy ở inventory.ts: BTP trừ thêm dongGoiTruTon(); TP = tinhTonTP(). Bán chọn nguồn Block thô (KHO_BAN_LE→BTP) / Đóng gói (KHO_TP→TP). -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: WipProductionScreen/ReserveWarehouseScreen/SalesOrderScreen -->

<!-- updated: 2026-08-17 — production_wips thêm balancing_period_id: kỳ cân đối hút sản lượng BTP theo ngày và GHI NGƯỢC khi sửa ô trong lưới (xem 31-can-doi-ky). Ngày đã chốt sản xuất vẫn sửa được nhưng bắt lý do ghi bù. -->

# BA-SPEC — Module WIP: Sản xuất BTP · Kho dự trữ · Đơn đặt · Xuất container

Số hoá **vòng lặp cốt lõi chưa số hoá** của BSF1: BTP làm ra ngày → cấp đông → kho dự trữ → gom đủ đơn đặt → xuất container. Đây là nơi **tồn cuối kỳ sai** hiện nay (ghi tay) → kế toán chốt số sai. Spec này là **oracle hành vi** (AC), KHÔNG nói UI, KHÔNG code. Pha sau: `ui-design-logic` → build.

## Scope

**IN:** ghi sản lượng BTP sản xuất ngày · nhập kho dự trữ (cấp đông) · theo dõi tồn kho · quản đơn đặt · gom đủ → lệnh xuất · xuất kho (trừ tồn) nối màn Bán hàng · đối chiếu tồn cuối kỳ + vòng đông gửi/xả đông (nối Cân đối).
**OUT (không làm đợt này):** giao diện/layout (→ ui-design) · phí xuất khẩu (phòng KH đã trừ trong giá báo — cân đối/kho KHÔNG tính) · phân quyền theo vai trò chức năng (chỉ nhãn) · auto-hút NL từ sổ Nhập hàng (đã hoãn — [[roadmap-wip-autohut-email]]).

## B1 — User registry (actor)

| Actor | Là ai | Ghi chú |
|---|---|---|
| **Tổ trưởng SX** | tổ trưởng phân xưởng Đông/Cá/Khô, 45–60t | ghi cái LÀM RA |
| **Thủ kho** | giữ kho dự trữ đông, 45–60t | xác nhận cái THỰC NẰM trong kho |
| **Phòng KH / PGĐ** | phòng kế hoạch (hoặc Phó GĐ kiêm Quản đốc Đông) | quản đơn đặt + quyết lệnh xuất |
| **Kế toán** | chốt số cuối kỳ | READ-ONLY vận hành; chỉ đối chiếu cuối kỳ |
| **Khách đặt** (external) | khách XK đặt số lượng lớn | không dùng app; đơn đặt là input |
| **Admin** | quản trị | cấu hình, ngoài luồng nghiệp vụ |

## B2 — Nghiệp vụ × owner (mỗi nghiệp vụ đúng 1 owner)

| # | Nghiệp vụ | Owner |
|---|---|---|
| N1 | Ghi sản lượng BTP sản xuất ngày (+ chốt ngày, ghi bù) | Tổ trưởng SX |
| N2 | Nhập BTP vào kho dự trữ, cấp đông (duyệt lô) | Thủ kho |
| N3 | Theo dõi tồn kho dự trữ | Thủ kho |
| N4 | Quản đơn đặt khách (mặt hàng×quy cách×kg×block cần) | Phòng KH |
| N5 | Gom đủ đơn đặt → lệnh xuất container | Phòng KH |
| N6 | Xuất kho theo lệnh (trừ tồn thực) → handoff Bán hàng | Thủ kho |
| N7 | Đối chiếu tồn cuối kỳ + vòng đông gửi/xả đông | Kế toán |

## B3 — Cross-user handoff (ai→ai · điều kiện · mang theo)

| # | Từ → Đến | Điều kiện chuyển | Mang theo |
|---|---|---|---|
| H1 | Tổ trưởng SX → Thủ kho | dòng SX **đã chốt ngày** | mặt hàng×quy cách×kg×block×ngày SX |
| H2 | Thủ kho → tồn kho | **duyệt lô "chờ nhập"** + đánh dấu cấp đông | + chênh lệch kg/block + lý do (nếu có) |
| H3 | tồn kho ⇄ Phòng KH | đối chiếu **cần vs khả dụng** liên tục | dòng đơn: cần vs đạt |
| H4 | Phòng KH → Thủ kho | **xác nhận đủ** (toàn/một phần) → lệnh xuất | dòng lệnh: mặt hàng×quy cách×kg×block cần xuất |
| H5 | Thủ kho → Bán hàng | lệnh xuất **đóng** (thực xuất xác nhận) | + giá → ráp phiếu bán (đã có màn) |
| H6 | tất cả → Kế toán | cuối kỳ | tồn đầu·nhập·xuất·đông gửi·xả đông·tồn cuối |

**Chặn dead-end/cross thừa:** "đủ" do **Phòng KH xác nhận** (không auto — còn lịch tàu/ưu tiên khách hệ không biết); **cho xuất một phần** (đơn XK xuất theo đợt); Kế toán KHÔNG vào H1–H5 (chỉ H6, read-only); **xả đông ghi nguồn rõ** (không lẫn sản lượng SX mới).

## B4 — Flow tối ưu (Input → Output; start/end rõ)

**F-N1 (Ghi SX ngày):** *Input:* mặt hàng, quy cách, kg, số block, ngày SX, phân xưởng. *Steps:* ghi nháp (nhiều lần trong ngày) → **chốt ngày SX** (khoá sửa; sửa sau = ghi bù, bắt lý do — đồng dạng `laGhiBu` màn Nhập hàng). *Output:* dòng sản lượng đã chốt (= nguồn duy nhất cho nhập kho). *End:* ngày SX chốt.

**F-N2 (Nhập kho):** *Input:* dòng SX đã chốt (tự sinh "chờ nhập kho"). *Steps:* Thủ kho **duyệt lô cuối ca** (đối chiếu kg/block thực, ghi lệch + lý do nếu có, đánh dấu đã cấp đông). *Output:* tồn kho **cộng** theo (mặt hàng×quy cách×lô×trạng thái). *End:* lô duyệt xong. **Tồn chỉ cộng khi duyệt** (không auto lúc chốt SX).

**F-N5 (Gom → lệnh xuất):** *Input:* đơn đặt (dòng: mặt hàng×quy cách×kg×block cần). *Steps:* hệ đối chiếu **cần vs khả dụng** tích luỹ qua các đợt nhập → khi các dòng đạt ngưỡng, Phòng KH **xác nhận đủ** (toàn/một phần) → sinh lệnh xuất; phần thiếu giữ "đang gom". *Output:* lệnh xuất (dòng cần xuất) + đơn cập nhật trạng thái. *End:* lệnh xuất tạo.

**F-N6 (Xuất kho):** *Input:* lệnh xuất. *Steps:* Thủ kho **xác nhận thực xuất** từng dòng/lô (kg+block thực); chênh so lệnh ghi lý do → hệ **trừ tồn đúng phần thực lấy** → lệnh đóng → handoff sang Bán hàng (đủ chiều: mặt hàng×quy cách×kg×block×giá). *Output:* tồn giảm; phiếu bán/container ở màn Bán hàng. *End:* lệnh đóng.

## B5 — Flow optimization log (candidate loại + lý do)

| Nghiệp vụ | Chọn | Loại | Lý do loại |
|---|---|---|---|
| N1 | **V1-B** chốt ngày + ghi bù (Σ11) | V1-A ghi thẳng (Σ10) | dead-end khi phát hiện sai sau chốt, không đường lùi hợp lệ |
| N2 | **V2-C** auto "chờ nhập" + duyệt lô cuối ca (Σ12) | V2-A auto cộng tồn ngay (Σ9) · V2-B duyệt từng dòng (Σ11) | A: tính tồn hàng chưa thực đông = tái tạo lỗi ghi tay · B: từng dòng nặng cho tablet xưởng lạnh |
| N5 | **V5-B** đơn theo dòng + đối chiếu liên tục + xuất một phần (Σ11) | V5-A so-tổng (Σ9) | so-tổng che thiếu hụt theo quy cách → ra lệnh mới lộ thiếu = dead-end tốn kém container |
| N6 | **V6-B** trừ tồn theo thực xuất (Σ11) | V6-A trừ theo lệnh (Σ9) · V6-C dồn đối soát cuối kỳ (Σ8) | trừ theo lệnh/dồn hạ nguồn = lệch tồn cuối kỳ đúng phần chênh lệnh-vs-thực |

Rubric: Định hướng · Input/Output · Không dead-end · Cross tường minh & tối thiểu · Ít bước · Success metric.

## Mô hình tồn (WHAT — bất biến dữ liệu, KHÔNG phải schema)

**Khoá tồn = (mặt hàng × quy cách × lô[ngày SX/mẻ] × kho[phòng đông] × trạng thái-đông)**, đo bằng **kg VÀ số block song song** (không quy đổi mất mát). *(Chốt 2026-08-07: nhiều phòng đông ⇒ `kho` là chiều khoá.)*
- **Quy cách** = chiều khoá cứng (không phải ghi chú) — đơn XK đặt theo size, giá theo size.
- **Lô/ngày SX** bắt buộc: traceability XK (thu hồi theo lô) + hạn cấp đông (FIFO gợi ý, cho ghi đè).
- **Kho (phòng đông)** = chiều khoá — xí nghiệp có nhiều phòng đông; tồn theo từng phòng. Thủ kho gán kho khi duyệt nhập.
- **Trạng thái-đông:** chờ nhập · đã cấp đông · đông gửi kỳ sau · đã phân bổ cho đơn · đã xuất.
- **Phân bổ cho đơn** = liên kết mềm (rã được khi khách huỷ), KHÔNG phải chiều khoá.

**Loại chuyển động kho (phân biệt, không gộp 1 cột "số lượng"):** nhập SX (+) · xuất bán/container (−) · xuất nội địa (−) · đông gửi (carry-forward, 0) · **xả đông** (− khỏi kho, chỉ `nguon_kho="Kho mình"`; đồng thời + vào pool NL sản xuất — **hai chân, một số, hai sổ**) · hao hụt/huỷ (−, ghi riêng) · điều chỉnh kiểm kê (±).

**Quan hệ 3 con số (chống đếm trùng):** BTP sản xuất (Cân đối khối 3) → **nguồn** cho nhập kho (phái sinh, một chiều, chống trùng như cơ chế hút `ban_hang_id`); xuất bán rút từ **tồn** (có thể lô kỳ trước), KHÔNG trừ vào sản lượng kỳ này. Nhập kho mang **giá vốn theo mẻ** (từ định mức Cân đối) để tồn định giá đúng.

## B6 — Acceptance Criteria (oracle · Given/When/Then · Test + Assert đo được)

### AC-1 — Chốt ngày SX khoá sửa · Test: e2e
*Given* dòng SX ngày D đã chốt; *When* tổ trưởng sửa kg dòng đó; *Then* hệ bắt nhập lý do ghi bù, tạo bản ghi bù mới, KHÔNG sửa đè bản gốc.
- **Assert** count(bản ghi SX của dòng) == 2 (gốc + bù); bản gốc.kg không đổi; bù.lyDo.length >= 1

### AC-2 — Nhập kho phái sinh, không auto cộng tồn · Test: integration
*Given* dòng SX chốt kg=100 chưa duyệt; *When* xem tồn khoá đó; *Then* tồn "đã cấp đông" chưa tăng, hàng còn "chờ nhập".
- **Assert** tồn.daCapDong(khoá) == 0 && tồn.choNhap(khoá) == 100

### AC-3 — Duyệt lô cộng tồn đúng thực nhận · Test: e2e
*Given* "chờ nhập" kg=100; *When* thủ kho duyệt với kg thực=98, lý do "hao cấp đông"; *Then* tồn +98 và ghi chênh −2 có lý do.
- **Assert** tồn.daCapDong == 98 && chenh.kg == -2 && chenh.lyDo.length >= 1

### AC-4 — Tồn không âm · Test: integration
*Given* tồn khoá K = 50kg; *When* xuất 60kg khỏi K; *Then* hệ chặn (hoặc bắt điều chỉnh kiểm kê có lý do), tồn không xuống âm.
- **Assert** giao dịch bị từ chối với mã lỗi "vượt tồn" OR tồn(K) >= 0 sau xử lý

### AC-5 — Cân bằng chuyển động (bất biến kiểm toán) · Test: unit
*Given* mọi giao dịch của khoá K trong kỳ; *When* tính tồn cuối; *Then* nghiệm đúng phương trình tồn.
- **Assert** tồn_cuối(K) == tồn_đầu + Σnhập − Σxuất − Σhaohut ± Σđiềuchỉnh (sai số == 0, numeric 14,3)

### AC-6 — Gối đầu liên tục · Test: integration
*Given* kỳ N đóng, tồn_cuối(K,N)=X; *When* mở kỳ N+1; *Then* tồn đầu kỳ sau bằng tồn cuối kỳ trước, không nhập tay.
- **Assert** tonDau(K, N+1) == tonCuoi(K, N) mọi khoá K; count(khoá lệch) == 0

### AC-7 — Xả đông hai chân bằng nhau · Test: integration
*Given* xả đông 500kg lô L với nguồn "Kho mình"; *When* ghi xả đông; *Then* tồn kho giảm 500 và pool NL sản xuất tăng 500, cùng số.
- **Assert** giảmTồn.kg == 500 && tăngNLVao.kg == 500

### AC-8 — Xả đông "Mua về" không trừ tồn mình · Test: integration
*Given* NL xả đông nguồn "Mua về"; *When* đưa vào sản xuất; *Then* tồn kho dự trữ nội bộ không đổi.
- **Assert** Δ tồn kho nội bộ == 0

### AC-9 — Xuất ≤ đặt; đơn đóng khi đủ · Test: e2e
*Given* đơn đặt dòng cần 1.000kg; *When* Σ xuất đạt 1.000; *Then* dòng đơn chuyển "đóng"; xuất vượt bị chặn (trừ dung sai hợp đồng nếu khai).
- **Assert** Σxuất(dòng) <= đặt(dòng) + dungSai; trạng thái == "đóng" khi Σxuất == đặt

### AC-10 — Xuất một phần giữ đơn mở · Test: e2e
*Given* đơn cần 1.000kg, khả dụng 600; *When* Phòng KH xác nhận xuất 600; *Then* lệnh xuất 600, dòng đơn còn thiếu 400, đơn trạng thái "đang gom".
- **Assert** lệnh.kg == 600 && dòngĐơn.conThieu == 400 && đơn.trangThai == "đang gom"

### AC-11 — Tổng container = Σ dòng · Test: unit
*Given* lệnh xuất nhiều dòng block/quy cách; *When* đóng lệnh; *Then* tổng kg container bằng tổng kg các dòng.
- **Assert** container.tongKg == Σ dòng.kg (sai số == 0)

### AC-12 — Handoff Bán hàng đủ chiều · Test: e2e
*Given* lệnh xuất đóng; *When* handoff sang sổ Bán hàng; *Then* phiếu bán nhận đủ mặt hàng×quy cách×kg×block×giá, không nhập lại tay.
- **Assert** mọi dòng bán có 5 trường != rỗng && count(dòng bán) == count(dòng lệnh xuất)

### AC-13 — Trừ tồn theo thực xuất, không theo lệnh · Test: e2e
*Given* lệnh 1.000kg, thực xuất 990 (lý do hụt cân); *When* đóng lệnh; *Then* tồn giảm 990 (không 1.000), chênh −10 ghi lý do.
- **Assert** Δtồn == -990 && chenh == -10 && chenh.lyDo.length >= 1

### AC-14 — Nhập kho ≤ sản xuất (phần chênh có giải thích) · Test: integration
*Given* kỳ có Σ SX = 10.000kg; *When* tính Σ nhập kho trong kỳ; *Then* Σ nhập không vượt Σ SX; phần chênh có dòng giải thích.
- **Assert** Σnhập <= ΣSX; nếu Σnhập < ΣSX thì count(dòng giải thích) >= 1

### AC-15 — Giá trị tồn quy 1 đồng tiền, lưu tỉ giá · Test: unit
*Given* lô XK giá USD; *When* định giá tồn/handoff; *Then* quy VND theo tỉ giá lưu tại thời điểm giao dịch, không tra lại.
- **Assert** giaTriTon_VND == kg * donGiaUSD * tiGiaLuu && tiGiaLuu != null

## Assumptions (fail-closed — safe default; ⚠️ = cần xí nghiệp chốt)

1. Đơn vị tồn = **kg** chuẩn + **block** song song (không quy đổi cứng). Giá vốn theo **mẻ**.
2. Tồn khoá **5 chiều** (mặt hàng×quy cách×lô×**kho**×trạng thái); "phân bổ cho đơn" là liên kết mềm.
3. Xuất **một phần** được phép mặc định; "đủ" do **Phòng KH** xác nhận thủ công.
4. Kế toán read-only vận hành; chỉ đối chiếu cuối kỳ (H6).

## Open decisions — ĐÃ CHỐT với xí nghiệp (2026-08-07)

| Quyết định | Chốt | Ảnh hưởng |
|---|---|---|
| Số phòng đông | **Nhiều phòng đông** | `kho` là chiều khoá tồn (thủ kho gán khi duyệt nhập) |
| Xả đông rút lô nào | **FIFO gợi ý + cho ghi đè** | mặc định gợi ý lô cũ nhất; cho chọn lô khác |
| Tổ trưởng SX vs Thủ kho | **Hai người, hai sự kiện** | giữ 2 chữ ký (chốt chặn bắt lệch tồn) |

## History
- 2026-08-07 — tạo ba-spec (team-agent: Flow-Optimizer+Cross-User-Integrity, Domain-Specialist kho đông lạnh). Chưa design, chưa code.
- 2026-08-07 — chốt 3 open decision với user: nhiều phòng đông (thêm chiều `kho`), FIFO gợi ý+ghi đè, hai người hai sự kiện. Mô hình tồn → 5 chiều.
