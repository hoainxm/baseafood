# Đặc tả — Import báo cáo Xuất–Nhập–Tồn (XNT) theo kho, phục vụ cutover 01/09/2026

> **Trạng thái:** DỰ THẢO (chờ chủ dự án chốt các câu hỏi ở §9) — lập 2026-08-26.
> **Loại:** đặc tả kỹ thuật + phân tích dữ liệu, trước khi build. Chưa có code.
> **Nguồn kích hoạt:** chủ dự án cung cấp 2 báo cáo XNT thật của **KHO TP – KHO 1000**, kỳ 01/07→31/07/2026 — (1) **cá** (bản in, dạng .xlsx đúng mẫu parser); (2) **bạch tuộc tự đông** (file PDF 3 trang) — để số hoá phục vụ chạy realtime từ 01/09.
> **Liên quan:** [`trien-khai/ke-hoach-cutover-1-9-2026.md`](../trien-khai/ke-hoach-cutover-1-9-2026.md) (§2b, §3–4) · [`trien-khai/flow-end-to-end-2-bo-phan.md`](../trien-khai/flow-end-to-end-2-bo-phan.md) · [`app-map/04-tang-du-lieu.md`](../app-map/04-tang-du-lieu.md) · [`app-map/03-database.md`](../app-map/03-database.md).
> **Định hướng lô/QR:** hướng cấp lô ở đây ăn khớp [`trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md`](../trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md) QĐ-6 (định danh lô + mã QR để trace nội bộ; SSCC nhà nước chừa ô trống, làm sau — QĐ-10).
> **Risk (bước build sau):** 🟡 YELLOW (thêm bảng/cột + down migration). Bước SPEC này 🟢 (chỉ đọc + viết `.md`).

---

## 1. Mục đích & phạm vi

**Mục đích:** thiết kế chức năng **import báo cáo XNT theo kho** (dạng file mềm) để nạp số liệu chuyển tiếp tháng 7 & 8/2026, sao cho **tồn đầu ngày 01/09/2026 đúng** khi bật realtime — bám nguyên tắc gối đầu đã có trong hệ.

**Trong phạm vi SPEC này:**
- Phân tích cấu trúc tờ báo cáo XNT thật + quy tắc mã hàng/tên hàng của xí nghiệp.
- Đối chiếu với mô hình dữ liệu hiện tại (kho, tồn, NXT, parser Excel).
- Đề xuất phương án lưu trữ + luồng import + bất biến kiểm thử.
- Liệt kê câu hỏi cần chủ dự án chốt trước khi build.

**Ngoài phạm vi (lần này):**
- Không code, không migration, không đụng logic nghiệp vụ đang chạy.
- Chưa build màn import (đợi duyệt phương án + có file mềm thật).
- Chưa xử lý scan viết tay (giai đoạn sau cùng theo kế hoạch cutover §4).

---

## 2. Bối cảnh cutover (nhắc gọn)

Ba mốc dữ liệu ([kế hoạch cutover §1](../trien-khai/ke-hoach-cutover-1-9-2026.md)):

```
   30/06/2026            01/07 → 31/08/2026            01/09/2026 →
   baseline / tồn gốc     nhập bù theo báo cáo T7+T8     chạy realtime hằng ngày
```

Nguyên tắc **gối đầu**: tồn cuối kỳ trước = tồn đầu kỳ sau. Chỉ cần khai đúng tồn 30/06 một lần, T7–T8 cuốn tồn tới 31/08, và 01/09 kế thừa tự động.

> ⚠️ **Điểm lệch với giả định cũ của kế hoạch:** §2b của kế hoạch cutover *giả định* file backfill sẽ mang cấu trúc **báo cáo cân đối** (theo *họ nguyên liệu*, có *đông gửi / xả đông / NL vào / BTP ra / bán*), map vào `material_opening_stock` + kỳ Cân đối. **File thực tế lại là báo cáo XNT theo kho, cấp lô, chỉ có Tồn đầu / Nhập / Xuất / Tồn cuối (kg).** Đơn giản hơn giả định — nhưng KHÔNG khớp thẳng engine cân đối. Xem §5 và §6.

---

## 3. Phân tích tờ báo cáo XNT thực tế

### 3.1 Khung báo cáo (từ bản in trang 1)

| Trường | Giá trị mẫu |
|---|---|
| Ngày lập | 01/08/2026 09:46 |
| Tiêu đề | Báo cáo xuất nhập tồn |
| Kỳ | Từ ngày 01/07/2026 đến ngày 31/07/2026 |
| Chi nhánh | **KHO TP – KHO 1000** |
| SL mặt hàng | 32 (bản in mới thấy 7 dòng; còn trang sau) |
| Địa chỉ (footer) | KHO TP – KHO 1000: Bà Rịa – P. Phước Trung – TP Bà Rịa – Vũng Tàu |

**10 cột (đúng thứ tự chủ dự án mô tả):**
`Mã hàng · Tên hàng · Tồn đầu kỳ · Giá trị đầu kỳ · SL Nhập · Giá trị nhập · SL Xuất · Giá trị xuất · Tồn cuối kỳ · Giá trị cuối`

- **Dòng 1** = tên cột.
- **Dòng 2** = dòng tổng: "SL mặt hàng: 32" + tổng từng cột (Tồn đầu 49.139 · SL Nhập 502.139 · SL Xuất 508.871 · Tồn cuối 42.407).
- **Dòng 3 trở đi** = dữ liệu từng mặt hàng.

### 3.2 Bất biến số học (đã kiểm từng dòng — đều khớp)

> **Tồn cuối = Tồn đầu + SL Nhập − SL Xuất**

| Mã hàng (rút gọn) | Tên hàng (rút gọn) | Tồn đầu | Nhập | Xuất | Tồn cuối | Kiểm |
|---|---|--:|--:|--:|--:|:--|
| PXC- CNL NK 2023-1133 | CÁ SARDINE NL 220/235 · INV MTO2026034 (15KG) | 0 | 84.000 | 75.000 | 9.000 | ✓ |
| PXC- CNL NK 2026 1 | CÁ SÒNG NL 50/90 · INV NHM2026005 (15KG) | 1.095 | 47.175 | 40.650 | 7.620 | ✓ |
| PXC- CNL NK 2026-30 | CÁ SANMA NL 50-90 · INV BF2604ACM176-02 (15KG/CTN) | 1.005 | 23.430 | 17.752 | 6.683 | ✓ |
| PXC- CNL NK 0070155 | CÁ SÒNG NL 80-100 · INV SBT2026008 (15KG/PP) | 0 | 19.200 | 13.500 | 5.700 | ✓ |
| PXC- CNL NK 2026- 11 | CÁ NODO NL 40-100 · INV NHM2025034 (15KG) | 13.515 | 0 | 9.075 | 4.440 | ✓ |
| PXC-CNLNK 2026 | CÁ SÒNG NL 70-100 · INV SBT2025036 (14KG) | 4.200 | 0 | 0 | 4.200 | ✓ |
| PXC- CNL NK 00734 | CÁ SABA NL OKB 27/6/2026 · INV OKB2026007 (15KG/PP) | 5.670 | 23.850 | 27.900 | 1.620 | ✓ |
| **TỔNG** | | **49.139** | **502.139** | **508.871** | **42.407** | ✓ (49.139+502.139−508.871) |

**Mọi cột "Giá trị" (tiền) = 0** → báo cáo này chỉ theo dõi **khối lượng (kg)**, không theo giá trị tiền.

### 3.3 Giải mã Mã hàng / Tên hàng (đã đối chiếu 2 file: cá + bạch tuộc, xác nhận với chủ dự án 2026-08-26)

Hai file cùng chi nhánh **KHO 1000**, cùng kỳ **T7/2026**, khác **phân xưởng/nhóm hàng**:

| | File CÁ | File BẠCH TUỘC (`TỰ ĐÔNG`) |
|---|---|---|
| Định dạng gốc | .xlsx (đúng mẫu parser) | **PDF** (3 trang, có lớp text) |
| Mã hàng mẫu | `PXC- CNL NK 2023-1133` | `PXĐ.BTNL.TĐ 1008` (biến thể `PXĐ.HT 051`) |
| Số mặt hàng | 32 | 30 |
| Tổng Tồn đầu / Nhập / Xuất / Tồn cuối | 49.139 / 502.139 / 508.871 / 42.407 | 159.797 / 13.040 / 37.068 / 135.769 |

**Ngữ pháp mã hàng** (suy ra + chủ dự án xác nhận phần phân xưởng/nguồn):
`PX<phân xưởng> . <nhóm NL><nguồn> . <số lô>`

| Đoạn | Ý nghĩa | Ví dụ | Độ chắc |
|---|---|---|---|
| `PX<X>` | **Phân xưởng** — `PXC`=Cá, `PXĐ`=Đông, `PXK`=Khô (3 phân xưởng) | PXC / PXĐ / PXK | ✅ chốt |
| `<nhóm NL>` | nhóm nguyên liệu — `BTNL`≈Bạch Tuộc NL; `CNL`≈Cá NL; biến thể `HT` | CNL / BTNL / HT | tạm hiểu, **bổ sung sau** |
| `<nguồn>` | **nguồn gốc** — `NK`≈Nhập Khẩu (cá, có INVOICE); `TĐ`≈Tự Đông (khớp tên file "TỰ ĐÔNG") | NK / TĐ | tạm hiểu, **bổ sung sau** |
| `<số lô>` | số lô / chứng từ (có mã kèm năm `2023-1133`, `2022-14`; có số 0 dẫn đầu `0090`, `00734`) | 1008, 2022-14 | tính **ổn định/duy nhất cần hỏi** |

→ Mã hàng **gói cả phân xưởng + nguồn gốc + lô**; mỗi mã = **một lô cụ thể**. Cùng một loại (vd "2 DA NGUYÊN LIỆU" bạch tuộc) xuất hiện ở **nhiều mã** vì khác size/nguồn mua/vị trí.

**Tên hàng — 2 định dạng KHÁC NHAU giữa 2 file** (⇒ không có schema tên hàng chung):
- **Cá (có INVOICE):** `<loài> NGUYÊN LIỆU <size> <ngày lô> INVOICE:<số> (<quy cách: 15KG / 15KG/CTN / 15KG/PP / 14KG>) (KG)`. Loài: SARDINE, SÒNG, SANMA, NODO, SABA…
- **Bạch tuộc (KHÔNG INVOICE):** `<mô tả grade/size + F34> ( <nguồn> ) (KG)`, trong đó `<nguồn>` là **nhà cung cấp** ("NL MUA HỒNG PHÚ / BÉ BA / PHƯỚC CƠ / HIẾU PHẤN") hoặc **vị trí vật lý** ("KHO 1500- Ô A19"). Nhiều mặt hàng là **bán thành phẩm/sơ chế đông**: LUỘC, CHẦN, ĐỂ TẢM BỘT, TIP/ĐUÔI/RÂU/CỔ/BAO TỬ (các phần của con bạch tuộc).

**Hệ quả thiết kế:** vì mã gói nhiều tầng thông tin và tên hàng mỗi loại một kiểu → khi import phải **lưu nguyên văn `mã hàng` + `tên hàng`**, KHÔNG cố tách nhỏ / gộp về "họ NL" khi nạp (tránh mất thông tin + sai gộp).

> **Chủ dự án (2026-08-26):** hiện mới chắc **PX\*** (`PXĐ`/`PXC`/`PXK` = 3 phân xưởng Đông/Cá/Khô); các đoạn `CNL/BTNL/HT/NK/TĐ` **tạm hiểu, sẽ bổ sung sau — cứ để nguyên**. ⇒ Import **lấy `mã hàng` nguyên văn làm khoá**, chỉ **suy `phân xưởng` từ PX\*** (đáng tin); các nhãn khác (`source_type` NK/TĐ, nhóm NL) chỉ là **phụ trợ best-effort để lọc/hiển thị**, KHÔNG dùng để quyết đúng/sai số liệu.

### 3.4 Bốn đặc điểm quyết định thiết kế

1. **Cấp LÔ** — mỗi dòng là một lô nhập (invoice + ngày + size), chi tiết hơn "loại/họ NL" mà app đang dùng.
2. **Theo (chi nhánh × phân xưởng/nhóm hàng)** — cùng chi nhánh KHO 1000 đã có ≥2 file (cá, bạch tuộc), tách theo phân xưởng (mã prefix PXC/PXĐ). Chủ dự án đưa **từng file một**, phủ dần **tất cả kho/phân xưởng**. "Chi nhánh KHO 1000" là **sổ kế toán**; vị trí vật lý (Kho 1000/1500 + ô) có thể nằm trong tên hàng.
3. **Chỉ kg** — không theo dõi giá trị tiền (mọi cột giá trị = 0).
4. **Lô sống lâu** — có lô nhập từ 2023 (`PXC- CNL NK 2023-1133`) vẫn còn/luân chuyển trong tháng 7/2026 → đây là **kho lạnh trữ block đông dài hạn**, không phải hàng luân chuyển nhanh.

---

## 4. Đối chiếu mô hình hệ hiện tại (dẫn chứng code)

### 4.1 Kho — 5 kho vật lý, "KHO 1000" = Kho 1000 tấn
Hằng `BSF1_WAREHOUSES` ([src/types.ts:463-507](../../src/types.ts)) + seed bảng `warehouses` ([0017_kho_bsf1_nxt.sql:19-25](../../supabase/migrations/0017_kho_bsf1_nxt.sql)):

| Kho | code | type | dung tích |
|---|---|---|--:|
| **Kho 1000 tấn** | `K1000T` | xí nghiệp | 1.000.000 kg — "Kho tổng BSF1" |
| Kho 1500 tấn | `K1500T` | xí nghiệp | 1.500.000 kg |
| Kho xưởng Đông | `KX-DONG` | phân xưởng | 250.000 kg |
| Kho xưởng Cá | `KX-CA` | phân xưởng | 150.000 kg |
| Kho xưởng Khô | `KX-KHO` | phân xưởng | 150.000 kg |

→ **"KHO 1000" trong báo cáo = "Kho 1000 tấn" (K1000T)** — kho tổng, chứa cả block nguyên liệu đông lẫn thành phẩm. Bảng `warehouses` hiện **chỉ dùng để tính dung tích** ([inventory.ts:167-196](../../src/lib/inventory.ts)), **chưa dùng để phân tồn theo kho**.

> **Chủ dự án xác nhận (2026-08-26):** "KHO 1000" đúng là **Kho 1000 tấn**, và kho **chứa nhiều loại hàng, KHÔNG khoá theo loại**. "KHO TP" ("KHO Thành Phẩm", default ở [nxtExcel.ts:158](../../src/lib/nxtExcel.ts:158)) chỉ là **nhãn chi nhánh/sổ** của phần mềm nguồn, không phản ánh nội dung — nên chứa cả nguyên liệu đông lẫn bán thành phẩm sơ chế. Cá/bạch tuộc được cấp đông thành block trữ kho làm nguyên liệu kỳ sau ([BAN-GIAO.md](../BAN-GIAO.md)).
>
> ⚠️ **Phát hiện mới từ file bạch tuộc:** tên hàng nhắc **vị trí vật lý khác** ("KHO 1500- Ô A19") dù chi nhánh header là KHO 1000 → "chi nhánh KHO 1000" là **sổ kế toán**, còn vị trí kho/ô vật lý nằm trong tên hàng. Bảng `warehouses` (K1000T…) là khái niệm **vật lý** khác với "chi nhánh" của báo cáo — đừng đồng nhất máy móc.

### 4.2 Tồn = suy tính, đã có công thức NXT + tồn đầu khai tay
- Tồn **không lưu snapshot** — suy từ giao dịch.
- NXT nguyên liệu theo kỳ: `tinhSoTonNL()` ([src/lib/inventoryMaterial.ts](../../src/lib/inventoryMaterial.ts)) — `tồn cuối = tồn đầu + đông gửi − xả đông`, tồn đầu kỳ đầu lấy từ `material_opening_stock` ([0022](../../supabase/migrations/0022_ton_dau_nguyen_lieu.sql)), kỳ sau kế thừa.
- NXT thành phẩm/BTP theo khoảng ngày: `tinhSoTonTP()` ([src/lib/inventoryFinished.ts:130-233](../../src/lib/inventoryFinished.ts)) — tồn đầu = `finished_goods_opening_stock` ([0024](../../supabase/migrations/0024_ton_dau_thanh_pham.sql)) + lịch sử trước kỳ.
- **Khác biệt cốt lõi:** engine NL dựa trên **đông gửi/xả đông của Cân đối** theo **họ NL**, KHÔNG có kênh "nhập/xuất theo lô theo kho" như báo cáo XNT này.

### 4.3 Parser Excel đã có sẵn — khớp đúng mẫu, chưa đấu UI/DB
[`src/lib/nxtExcel.ts`](../../src/lib/nxtExcel.ts) (thư viện `xlsx` SheetJS, có sẵn ở `package.json`):
- `parseNxtExcelFile(file)` ([:53-145](../../src/lib/nxtExcel.ts:53)) — đọc **đúng cấu trúc tờ báo cáo này**: nhận diện "Ngày lập / Từ ngày / Chi nhánh(KHO) / SL mặt hàng" làm meta, map 10 cột về `NxtExcelRow` ([:9-21](../../src/lib/nxtExcel.ts:9)), tự tính `tonCuoi` nếu thiếu ([:101](../../src/lib/nxtExcel.ts:101)).
- `inferCategory()` ([:41-50](../../src/lib/nxtExcel.ts:41)) phân loại **Hàng nhập khẩu / Trong nước / Tạm** (theo NK/INVOICE/GỬI) — **không** phân "nguyên liệu vs thành phẩm".
- `exportNxtToExcel()` ([:148-232](../../src/lib/nxtExcel.ts:148)) đã chạy (dùng ở màn NXT thành phẩm).
- ⚠️ **`parseNxtExcelFile` chưa được gọi ở bất kỳ màn nào** — hạ tầng đọc file sẵn sàng nhưng thiếu (a) màn upload/preview/confirm, (b) bảng đích lưu, (c) đường ghi vào tồn.

### 4.4 Chưa có mô hình lô/invoice/size cho nguyên liệu
`material_imports` chỉ có `category` (loài) + `material_type_name` (tên loại) + `supplier_name` + `delivery_date` + `unit_price` — **không có** cột invoice/lô/size ([repo.ts:283-324](../../src/lib/repo.ts)). NXT NL còn gộp về **"họ NL"** (thô hơn lô). Hai màn có khái niệm "lô" (`cold-storage`, `traceability`) đều là **mock cứng, chưa nối DB**. → Báo cáo XNT cấp lô **không tái dùng được** `material_imports`; cần cấu trúc mới nếu muốn giữ chi tiết lô.

### 4.5 Màn NXT hiện chỉ có kg, thiếu 5 cột giá trị tiền
`NxtReportScreen`/`MaterialNxtScreen` ([src/features/reports](../../src/features/reports)) hiển thị Tồn đầu/Nhập/Xuất/Tồn cuối **kg**, không có cột giá trị. Với báo cáo này (giá trị = 0) không phải vấn đề, nhưng nếu sau này báo cáo có giá trị thì phải bổ sung.

---

## 5. Khoảng trống & điểm lệch (tổng hợp)

| # | Khoảng trống | Ảnh hưởng |
|---|---|---|
| G-a | Báo cáo cấp **lô**; app quản NL theo **họ NL** | Import cấp lô cần bảng mới; gộp về họ NL thì mất chi tiết lô + phải map tên→loại NL |
| G-b | Báo cáo theo **(chi nhánh × phân xưởng)**; app **chưa phân tồn theo kho/chi nhánh** | Khoá lưu theo (chi nhánh, phân xưởng, kỳ, mã lô); "chi nhánh" là text sổ, không map cứng vào bảng `warehouses` vật lý |
| G-c | File thực tế là **XNT đơn thuần**, không có đông gửi/xả đông; engine NL cần **carry-over Cân đối** | Không map thẳng vào engine cân đối như §2b kế hoạch giả định |
| G-d | Chưa có **bảng đích** + **màn import** (parser thì đã có) | Là phần phải build |
| G-e | Nhãn **"KHO TP"** ↔ hàng **nguyên liệu** chưa được xác nhận | Ảnh hưởng cách gán loại kho / phân luồng |

**Insight tận dụng được (giảm việc):** cột **Tồn đầu kỳ** của báo cáo tháng 7 (mốc 01/07 00:00) **chính là tồn cuối 30/06** = baseline. Chuỗi gối đầu tự nhiên:

```
Báo cáo T7:  Tồn đầu (=30/06 baseline) → Tồn cuối 31/07
Báo cáo T8:  Tồn đầu (=31/07)          → Tồn cuối 31/08  ← chính là TỒN ĐẦU 01/09 realtime
```

→ Chỉ cần import **2 báo cáo tháng (T7, T8) cho mỗi kho**, tồn đầu 01/09 tự có, **cấp lô**, **theo kho**. Không cần thêm file baseline 30/06 riêng (nó đã nằm trong cột Tồn đầu của báo cáo T7).

---

## 6. Phương án thiết kế (đề xuất)

### 🟢 Phương án A — Bảng snapshot XNT theo báo cáo *(KHUYẾN NGHỊ)*
Import **trung thực** tờ báo cáo: mỗi kỳ × kho lưu 1 "báo cáo XNT" (header) + N dòng lô (10 cột). Là **nguồn tồn cutover** + **sổ đối chiếu/audit**, đứng riêng, **không đụng** engine cân đối.

- **Data model (sơ bộ, tiếng Anh snake_case):**
  - `warehouse_xnt_reports` — 1 dòng/báo cáo: `branch_label` (text gốc "KHO TP - KHO 1000"), `workshop` (suy từ prefix mã: PXC=Cá/PXĐ=Đông…), `period_from`, `period_to`, `created_text`, `source_file_name`, `source_format` (`xlsx`/`pdf`), `status` (`nhap`/`da-chot`), `note`.
  - `warehouse_xnt_lines` — N dòng/báo cáo: `report_id`, `item_code` (mã hàng nguyên văn), `item_name` (nguyên văn), `category` (từ `inferCategory`), `source_type` (suy từ mã: NK/TĐ), `opening_kg`, `opening_value`, `in_kg`, `in_value`, `out_kg`, `out_value`, `closing_kg`, `closing_value`. (Các cột value nullable/default 0; các cột suy `workshop`/`source_type` chỉ để lọc, không đụng bản gốc.)
- **Tồn đầu 01/09** = `closing_kg` của báo cáo T8 mỗi kho (query trực tiếp, không cần suy qua Cân đối).
- **Tier:** 🟡 YELLOW (2 bảng mới nullable + down migration `drop`). Không đụng RLS bảng đang phục vụ (thêm policy mới cho bảng mới).
- **Ưu:** trung thực 100% báo cáo; giữ chi tiết lô + kho; tận dụng ngay `parseNxtExcelFile`; đối chiếu thẳng cột-với-cột; rủi ro thấp. **Nhược:** dữ liệu import đứng **song song** engine tồn NL hiện tại → cần bước hoà giải (§9-Q5) nếu muốn realtime NL kế thừa số này.

### Phương án B — Gộp về họ NL, đổ vào engine hiện tại
Map mỗi lô → `material_type_name`/họ NL, đổ Tồn đầu vào `material_opening_stock` (30/06) + tạo kỳ Cân đối T7/T8 với các dòng chuyển kỳ.
- **Ưu:** khớp thẳng engine NL đang chạy; realtime kế thừa tự nhiên. **Nhược:** (1) mất chi tiết lô/invoice/size; (2) phải map "tên hàng" → "loại NL" (nhiều-về-một, dễ sai, cần bảng ánh xạ + người xác nhận); (3) báo cáo **không có** đông gửi/xả đông nên phải **diễn giải** Nhập/Xuất thành ngữ nghĩa Cân đối — không 1:1, dễ lệch; (4) engine NL theo *kỳ 5 ngày/họ NL*, không theo *kho*.

### Phương án C — Kết hợp (A trước, cầu sang engine sau)
Làm A (import trung thực, có ngay tồn đầu 01/09), rồi **tuỳ chọn** sinh `material_opening_stock` 30/06 tổng-hợp-từ-A cho engine NL nếu chủ dự án muốn NXT NL cũ cũng khớp. Tách 2 bước, mỗi bước tự đứng.
- **Khuyến nghị lộ trình:** **A ngay** (đạt mục tiêu 01/09) → cân nhắc phần "cầu sang engine" như việc con, quyết ở §9-Q5.

> ✅ **CHỐT (chủ dự án, 2026-08-26): Phương án A — cấp lô.** (Cầu sang B/họ NL để lại như bước C tuỳ chọn về sau.)
>
> **Đề xuất chọn: Phương án A (rồi C nếu cần).** Lý do: báo cáo đã là XNT khép kín; đạt mục tiêu "tồn đầu 01/09 đúng, cấp lô, theo phân xưởng" với blast radius nhỏ nhất; không ép dữ liệu lô vào mô hình họ-NL vốn thô hơn. **File bạch tuộc củng cố lựa chọn A**: tên hàng tự do (grade + nhà cung cấp/vị trí), lẫn cả bán thành phẩm sơ chế → gộp về "họ NL" (Phương án B) sẽ rất lỗi và mất thông tin.
>
> ⚠️ **Định dạng file:** parser `parseNxtExcelFile` chỉ đọc **.xlsx**. File bạch tuộc là **PDF** (có lớp text — đọc được bằng thư viện PDF, đã thử trích thành công). Nếu báo cáo sẽ về ở nhiều định dạng, bước build cần **2 nhánh đọc**: (a) .xlsx qua parser sẵn có; (b) .pdf qua bộ đọc PDF text-layer → cùng đổ về `NxtExcelRow`. Cần chốt định dạng chuẩn với chủ dự án (§9).

---

## 7. Thiết kế import đề xuất (nếu duyệt Phương án A)

**Luồng (bám nguyên tắc [cutover §4](../trien-khai/ke-hoach-cutover-1-9-2026.md): import không tự chốt, map hiện rõ):**
1. **Tải file** `.xlsx` (một báo cáo = một kho một kỳ).
2. **Parse** bằng `parseNxtExcelFile` → ra meta (kho, kỳ) + N dòng.
3. **Preview**: bảng 10 cột + banner hiển thị **Kho nhận diện** (map `warehouseText` → `warehouse_code`, cho sửa) + **Kỳ** + tổng đối chiếu (Tồn đầu/Nhập/Xuất/Tồn cuối vs dòng "SL mặt hàng"). Cảnh báo nếu **Tồn cuối ≠ Tồn đầu + Nhập − Xuất** ở bất kỳ dòng nào.
4. **Xác nhận map** (không map ngầm): kho, kỳ, phân loại. Người dùng bấm duyệt.
5. **Lưu nháp** (`status = 'nhap'`) → người dùng soát → **phát hành/chốt** (`status = 'da-chot'`).
6. **Màn NXT kho** đọc snapshot để hiển thị + xuất lại (tận dụng `exportNxtToExcel`).

**Kiểm thử tồn đầu 01/09:** sau khi chốt T8 mọi kho → tổng `closing_kg` = tồn đầu realtime; đối chiếu tổng với báo cáo tháng 8 ([cutover §3 bước 9](../trien-khai/ke-hoach-cutover-1-9-2026.md)).

---

## 8. Bất biến kiểm thử (acceptance — cho bước build)

- [ ] Import lại **đúng số** tờ báo cáo: mỗi dòng `Tồn cuối = Tồn đầu + Nhập − Xuất`; tổng khớp dòng "SL mặt hàng".
- [ ] Nhận diện đúng **kho** (KHO 1000 → K1000T) và **kỳ** từ meta file; cho sửa trước khi chốt.
- [ ] Import **không tự chốt**; có pha nháp → phát hành; map cột **hiện cho người xác nhận**.
- [ ] Chuỗi gối đầu: `Tồn cuối T7 == Tồn đầu T8` (cùng kho, cùng lô) — cảnh báo nếu lệch.
- [ ] Idempotent: import lại cùng file/kỳ/kho **không nhân đôi** (thay thế bản nháp cũ hoặc chặn trùng, có cảnh báo).
- [ ] `npm run build` + `npm run lint` xanh; responsive 360px→desktop, cỡ chữ 130% không vỡ.
- [ ] Migration chạy 2 lần vẫn không lỗi (idempotent) + có down migration.

---

## 9. CÂU HỎI CẦN CHỦ DỰ ÁN CHỐT (cập nhật 2026-08-26 sau khi có file bạch tuộc)

**✅ Đã chốt:**
- KHO 1000 = **Kho 1000 tấn**; kho **chứa nhiều loại, không khoá loại** ("KHO TP" chỉ là nhãn sổ/chi nhánh). "Chi nhánh" là sổ; vị trí vật lý nằm trong tên hàng → import **lưu nguyên văn**, không tách.
- Prefix `PX*` = phân xưởng (`PXC`=Cá, `PXĐ`=Đông, `PXK`=Khô). Các đoạn `CNL/BTNL/HT/NK/TĐ` **tạm hiểu, bổ sung sau** — lưu nguyên văn.
- Import **từng file một**; phủ **tất cả kho/phân xưởng**; **cấp lô (Phương án A)**, lưu nguyên văn `mã hàng` + `tên hàng`.
- **Định dạng: cả `.xlsx` lẫn `.pdf`** — build 2 nhánh đọc (parser .xlsx sẵn có + bộ đọc PDF text-layer) cùng đổ về `NxtExcelRow`.
- **Realtime chạy CẤP LÔ** (mirror phần mềm kế toán) ⇒ kho XNT cấp lô là **sổ tồn NL chính**; engine họ-NL cũ giữ song song. Module = **sổ tồn kho cấp lô đầy đủ**, không chỉ import.

**🎯 Đề xuất hướng CHÍNH XÁC TỐI ĐA (câu baseline & engine — chủ dự án yêu cầu ưu tiên số liệu đúng để đưa vào dùng):**
- **Baseline 30/06:** dùng **cột "Tồn đầu" của báo cáo T7 làm baseline** — chính xác nhất vì lấy thẳng từ báo cáo đã chốt (không nhập lại tay). Nếu có **báo cáo tồn cuối T6** thì import thêm chỉ để **đối chiếu chéo** (T6 Tồn cuối phải == T7 Tồn đầu) — thắt an toàn, không bắt buộc.
- **Realtime chạy CẤP LÔ (chốt 2026-08-26):** chủ dự án chọn **theo từng lô**, mirror đúng phần mềm kế toán đang dùng ("follow hiện trạng, tránh đi ngược số đông"). ⇒ Kho XNT cấp lô **trở thành SỔ TỒN NGUYÊN LIỆU CHÍNH (canonical) theo lô × phân xưởng**, chạy tiếp từ 01/09 (nhập/xuất ghi theo lô). **KHÔNG cần "cầu gộp về họ NL".** Engine họ-NL cũ (Cân đối/NXT NL) **giữ riêng cho mục đích của nó** (định mức, đông gửi/xả đông theo kỳ) — coi như hệ song song, đối chiếu sau, không chặn 01/09.
  - Cổng chính xác: **tồn cuối 31/08 (báo cáo T8) = tồn đầu 01/09** per lô — realtime nối thẳng số này.
  - ⚠️ **Hệ quả phạm vi (nói rõ để không hiểu nhầm):** module này khi đó **KHÔNG chỉ là 1 màn import** mà là **sổ tồn kho nguyên liệu cấp lô đầy đủ** (nhập / tồn / xuất theo lô) chạy realtime — lớn hơn nhiều. Chia pha ở §10.

**❓ Còn cần chốt (nhỏ):**
1. **Khoá chống trùng:** import lại cùng file/kỳ dựa vào gì để không nhân đôi — `(chi nhánh + phân xưởng + kỳ + mã hàng)`? Số lô cuối mã có **duy nhất/ổn định** trong phần mềm nguồn không?
2. **Giá trị tiền:** cả 2 file tới nay giá trị = 0. Có file/kho nào **có giá trị tiền** cần import không?
3. **Nguyên liệu vs sơ chế:** file bạch tuộc có mặt hàng đã **luộc/chần/để tẩm bột** (bán thành phẩm) lẫn nguyên liệu — có cần **phân biệt** khi tính tồn/hoà giải không, hay coi chung là "hàng trong kho KHO 1000"?

---

## 10. Việc tiếp theo (sau khi duyệt) — chia PHA vì module lớn hơn 1 màn import

**Pha 1 — Import cutover (ưu tiên, đủ để tồn đầu 01/09 đúng):**
1. Chủ dự án trả lời §9 (nhỏ) + gửi **file mềm thật** (T7 **và T8**, mọi phân xưởng/kho).
2. Mở **session mới** build: migration 2 bảng cấp lô `warehouse_xnt_reports` + `warehouse_xnt_lines` (🟡, kèm down) → màn import (upload .xlsx/.pdf → parse → preview → xác nhận map kho/kỳ/phân xưởng → nháp → chốt) → màn xem/NXT kho (tận dụng `exportNxtToExcel`).
3. Đối chiếu **tồn cuối 31/08 = tồn đầu 01/09** per lô ↔ báo cáo T8 trước khi bật realtime.

**Pha 2 — Sổ tồn kho cấp lô realtime (feature chính của module, từ 01/09):**
4. Nhập / xuất nguyên liệu **theo lô** hằng ngày, cập nhật tồn per lô × phân xưởng (kho XNT là canonical). Thiết kế lối nhập lô cho tổ trưởng/thủ kho.
   > ⏸️ **CHỜ CHỦ DỰ ÁN CHỐT (nhắc — 2026-08-26):** người dùng thao tác nhập/xuất **chi tiết tới từng lô** (chọn mã lô mỗi lần) — hướng là **CÓ** (bám phần mềm kế toán) nhưng **tạm HOLD**, chưa chốt cứng. **Phải xác nhận trước khi thiết kế màn nhập Pha 2.** Nếu người dùng thấy nặng tay → cân nhắc lối nhập rút gọn (gợi ý lô theo phân xưởng/loài).
5. Đối chiếu định kỳ kho XNT cấp lô ↔ engine họ-NL cũ (Cân đối) — 2 hệ song song, canh không lệch/không âm.
6. Tài liệu: cập nhật [`03-database.md`](../app-map/03-database.md) + [`04-tang-du-lieu.md`](../app-map/04-tang-du-lieu.md) + **app-map mới cho module tồn kho cấp lô**.

**Xong:** cập nhật trạng thái SPEC: DỰ THẢO → CHỐT.
