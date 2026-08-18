> Load khi: sửa màn Cân đối, lưới theo ngày, công thức định mức/lãi lỗ, hay bảng in A4.
covers: src/features/balancing/BalancingScreen.tsx, src/features/balancing/usePeriodGrid.ts, src/features/balancing/MaterialGrid.tsx, src/features/balancing/WipGrid.tsx, src/features/balancing/gridDialogs.tsx, src/features/balancing/BalancingTable.tsx, src/lib/balancingCalc.ts, src/lib/balancingGrid.ts, src/design-system/patterns/EditableGrid.tsx
last_verified: 2026-08-17
ttl_days: 90
<!-- updated: 2026-08-17 (c) — TÁCH FILE: usePeriodGrid.ts (dữ liệu + thao tác) · MaterialGrid/WipGrid/gridDialogs (giao diện); ô ngày dòng hút GÕ ĐƯỢC và ghi thẳng về sổ Nhập hàng; ô tính lại theo TỪNG PHÍM; thêm đường 'Chọn dòng nhập' khi tên loại NL lệch; dòng Giảm chọn loại NL từ danh mục -->
<!-- updated: 2026-08-17 (b) — BỎ khối phế liệu khỏi kỳ; gộp 2 khối vào MỘT thẻ chung 1 công tắc cột ngày; cột Khách thành Combobox chọn/tạo tại chỗ; vá lỗi sr-only caption đội chiều cao trang; khoá cuộn nền khi mở phiếu in -->
<!-- updated: 2026-08-17 — LƯỚI THEO NGÀY (migration 0019): hàng = mặt hàng, cột = ngày; hút sổ Nhập hàng + sổ Sản xuất bằng cách gán balancing_period_id; ô Giảm → kho xưởng; cột Chuyển kỳ; dán khối từ Excel. Thay flow thêm-từng-dòng. balancingCalc.ts KHÔNG đổi. -->
<!-- re-verified: 2026-08-07 — công thức balancingCalc.ts + KhoiTP hút bán khớp source -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: lib canDoi.ts → balancingCalc.ts -->
<!-- fixed: 2026-08-10 — đối chiếu bảng cân đối bạch tuộc 2 da (21-25/07) thật: sửa "Bình quân/kg NL" = Lãi÷NL (trước tính nhầm Giá thành÷NL); đổi field avgCostPerKgMaterial→avgProfitPerKgMaterial. 8 chỉ số kia khớp tuyệt đối -->
<!-- updated: 2026-08-07 — khối 3 đổi nhãn "Bán thành phẩm sản xuất" (WIP làm ra ≠ bán ra); NL vào cho kg âm (bán nội địa); cờ nguonKho cho xả đông (migration 0008) -->

# Cân đối theo kỳ (xưởng Đông, "cân đối 5 ngày")

Trả lời câu: lô nguyên liệu này ra bao nhiêu thành phẩm, định mức bao nhiêu, lãi hay lỗ.

## State hiện tại

Đã có: CRUD kỳ · **lưới theo ngày một màn** (hàng = mặt hàng, cột = ngày) · thông số kỳ (tổng NL nhận, chi phí CB/kg TP, tỉ giá) · tính định mức + lãi/lỗ + tỉ lệ thu hồi · **hút sổ Nhập hàng + sổ Sản xuất BTP** · **ô Giảm → kho xưởng** · **cột Chuyển kỳ** · **dán khối số từ Excel** · xem/in bảng A4 (có cột ngày, in ngang khi kỳ > 3 ngày).

Chưa có: quy tắc **chia NL cho từng bảng cân đối** (bảng phụ theo ngày là tổng NL nhận cả xưởng, mỗi bảng chỉ lấy phần đưa vào mặt hàng đó — cân riêng hay ước tính? **chưa chốt với xí nghiệp**); tên gọi chính thức của chỉ số ≈ 0,45; **dựng dòng đối ứng tự động ở kỳ kế tiếp** cho phần Chuyển kỳ âm (hiện mới ghi được số + kho đích, kỳ sau vẫn phải khai tay).

Bảng dùng: `balancing_periods`, `balancing_inputs`, `balancing_outputs`, đọc `products` / `customers` / `material_types`, và **đọc-ghi `material_imports` + `production_wips`** (cột `balancing_period_id`).

### Phế liệu KHÔNG còn thuộc kỳ cân đối (chốt 2026-08-17)

Số cân phế liệu thuộc về **sổ Nhập hàng**; kỳ cân đối chỉ trả lời "nguyên liệu này ra bao nhiêu bán thành phẩm, lãi hay lỗ". Đã bỏ khối phế liệu, phần hút phế liệu, dòng *Giá trị phế liệu* ở kết quả, và khối phế liệu trên bản in.
`calculateBalancing` **giữ nguyên chữ ký** — màn truyền `[]` cho tham số phế liệu. Đừng sửa công thức để bỏ tham số.
Bảng `scraps` và luật gỡ liên kết khi **xóa kỳ** vẫn còn (`CanDoiScreen.xoaKy`) để dòng cũ đã lỡ gắn kỳ không thành mồ côi. Nhập/sửa phế liệu: xem [30-nhap-hang.md](30-nhap-hang.md).

## Lưới theo ngày (từ 0019) — vì sao có

Bản trước bắt mở hộp thoại cho từng dòng NL và từng dòng thành phẩm. Người dùng nói thẳng: làm trên Excel còn nhanh hơn. Lưới này giữ ba thứ Excel làm tốt (gõ liên tục, di chuyển bằng phím, dán cả khối) và bỏ hai thứ Excel làm dở:

- **Cột Tổng là ô TÍNH, không gõ được** (đây là ô duy nhất bị khoá). Chính file cân đối thật của xí nghiệp (bạch tuộc 2 da 21–25/07) đã sai vì mặt hàng bị chép hai lần: dòng *2 da ncls* ghi `2.218` nhưng cộng theo ngày chỉ `1.109`, tổng cả bảng lệch đúng `1.109 kg`. Đừng bao giờ cho gõ tay vào cột Tổng.
- **Thêm dòng không vỡ công thức.**

**Hai khối, một tờ.** Khối 1 (nguyên liệu) và khối 2 (bán thành phẩm) không thể chung một bảng — cột khác hẳn nhau (NL có đơn giá VNĐ + tỷ lệ bột; BTP có khách + giá USD). Nhưng chúng nằm trong **cùng một thẻ**, chỉ ngăn nhau bằng một đường kẻ, và **dùng CHUNG một công tắc "Thu cột ngày"** (state ở `KyDetail`, truyền xuống qua `anNgay` / `onDoiAnNgay`). Cột ngày của hai khối phải dóng thẳng nhau thì mới đối chiếu được NL vào ↔ BTP ra của cùng một ngày — đó là lý do công tắc không thuộc về từng khối.

**Cột Khách** là `Combobox` ngay trong ô (`CotLuoi.oRieng`): chọn trong danh mục, gõ tên lạ thì tạo mới tại chỗ. Không bao giờ để nhập tự do — "Hanwa" / "hanwa" / "Han wa" sẽ thành ba khách khi tổng hợp cuối kỳ.

**Ô tính lại theo TỪNG PHÍM.** `LuoiNhap` ghi ngay khi gõ (giống `NumberField`), không đợi rời ô: cột Tổng, dòng T.CỘNG và khối Kết quả nhúc nhích theo con số đang gõ. Đợi blur mới tính nghĩa là gõ hết cả bảng rồi mới biết đúng sai — đúng cái khiến người dùng quay về Excel.

Primitive: `LuoiNhap` (`design-system/patterns/EditableGrid.tsx`) — Enter/Tab/mũi tên chuyển ô, dán TSV (hiểu cả `(2.000)` = −2.000 kiểu kế toán). Logic thuần: `src/lib/balancingGrid.ts`.

### Một kỳ = một HỌ nguyên liệu

Kỳ tên `Bạch tuộc 2 da` gom **cả hai size**: `Bạch tuộc 2 da lớn (80↑)` và `Bạch tuộc 2 da nhỏ (80↓)` (bảng giấy đã tách sẵn "2 da nl lớn 23.150" / "2 da nl nhỏ 16.356"). Ghép bằng `hoNguyenLieu()` — cắt hậu tố size rồi so tên. `Bạch tuộc 1 da` **không tách**. Migration `0019` đổi dữ liệu cũ mang tên chung sang **size lớn**; xưởng tự sửa dòng nào là nhỏ.
⇒ **Đừng đổi `balancing_periods.material_type_name` thành tên có size** — kỳ sẽ mất nửa số liệu.

### Hút = gán kỳ lên bản ghi gốc, KHÔNG chép số

Cùng một cách với mọi nguồn: gán kỳ lên bản ghi gốc, không nhân bản số.

| Khối | Nguồn | Cách hút | Ô ngày trong lưới |
|---|---|---|---|
| NL vào, nhóm `Thủy sản` | `material_imports` | gán `balancing_period_id`, cùng họ NL + ngày trong kỳ | gõ được, **ghi ngược về sổ Nhập hàng** |
| NL vào, `Xả đông` / `Bột phụ gia` / Giảm | nhập tay | — | gõ được, lưu ở `daily_quantities` |
| Bán thành phẩm | `production_wips` | gán `balancing_period_id`, ngày trong kỳ (KHÔNG lọc theo loại NL — một lô NL ra nhiều mặt hàng) | gõ được, **ghi ngược về sổ Sản xuất** |

**Không khoá ô.** Bản đầu khoá ô ngày của dòng hút với lý do "sửa ở sổ gốc cho khỏi lệch". Người dùng đọc ra là ô hỏng. Số vẫn không lệch được vì ô ghi THẲNG về sổ gốc chứ không giữ bản sao — khoá là thừa.

### Khi tên loại nguyên liệu không khớp

Sổ nhập ghi loại NL theo tên tự do. Xưởng gõ "2 da nguyên liệu" trong khi kỳ tên "Bạch tuộc 2 da" ⇒ `cungHoNguyenLieu` trả false và nút "Lấy từ sổ nhập" biến mất, dù sổ đầy số — đây là lý do bản đầu bị báo "chưa lấy được dữ liệu nhập hàng thực tế".

Đường lui: `nhapTrongKhoangNgay()` lấy **mọi** chuyến chưa gắn kỳ trong khoảng ngày, bất kể loại; nút **"Chọn dòng nhập (n)"** mở bảng tick. Hai đường luôn cùng tồn tại — khớp tên chỉ là gợi ý, không phải cổng chặn.

Dòng lưới (`balancing_inputs` / `balancing_outputs`) chỉ giữ **tên · đơn giá · khách · quy cách · chuyển kỳ**. Sản lượng ngày đọc thẳng từ sổ nguồn ⇒ sổ và bảng cân đối không bao giờ lệch. `quantityKg` của dòng hút được **đồng bộ trong `usePeriodGrid`** (tính ngay cho kết quả trên màn, rồi ghi xuống kho bằng effect) vì `calculateBalancing` đọc trường đó — công thức không được sửa.

**Ghi ngược nhận cả DANH SÁCH ô, không phải từng ô.** Dán khối là hàng chục ô đổi cùng nhịp; gọi lần lượt thì mỗi lần ghi đè lên mảng cũ và chỉ ô cuối sống sót (`ghiSanLuongNhieuNgay`). Nhiều dòng sản xuất trong cùng ngày ⇒ chỉnh **dòng cuối** cho tổng ngày khớp; phải làm dòng cuối âm thì **từ chối** và bảo vào màn Sản xuất sửa (`ghiNguocSanLuongNgay`).

Ngày đã chốt sản xuất (`production_locks`): sửa vẫn được nhưng **bắt lý do ghi bù**. Đường dán khối **bỏ qua** ô rơi vào ngày đã chốt và báo rõ số ô bị bỏ.

### Ô "Giảm"

Nguyên liệu nhập nhưng không chế biến hết thành BTP. Tên dòng **chọn từ danh mục loại NL + các dòng đang có trong kỳ** (`Combobox`), không gõ tự do — giảm trừ mà tên lệch tên dòng nguyên liệu thì đối chiếu bằng mắt không ra. Là dòng `balancing_inputs` có `is_reduction = true` + `reduction_warehouse_id` (mặc định kho phân xưởng, VD `kho-dong`).

- Người dùng gõ **số dương**, hệ lưu **số âm** — bắt tổ trưởng gõ dấu trừ ở xưởng lạnh là cách chắc chắn nhất để có số sai.
- Vì là dòng NL kg âm nên `calculateBalancing` trừ đúng mà **không sửa một dòng công thức nào** (dòng âm đã hợp lệ từ `0018`).
- Khớp dòng `Bán nội địa −987` của bảng giấy.

### Cột "Chuyển kỳ" (cột N của bảng giấy)

Một cột, hai chiều — **đọc theo dấu**:

- **Âm** (bảng giấy ghi trong ngoặc, VD `(2.000)`) = phần đẩy sang kỳ sau, cất kho.
- **Dương** (VD `2.000`, `258`) = phần lấy từ kỳ trước đưa vào kỳ này.

Cộng vào Tổng của dòng (`sumGridRow = Σ ngày + chuyển kỳ`) — kiểm chứng trên bảng thật: dòng *2 da luộc 230-250* `258+261+1.785+3.384+5.749+154 = 11.591` khớp cột Lượng.

### Ngày trong kỳ — bẫy múi giờ

`ngayTrongKy()` dựng ngày bằng **UTC** (`T00:00:00Z` + `setUTCDate`). Dùng `new Date("2025-07-21T00:00:00")` rồi `toISOString()` là sai ở giờ Việt Nam (+07): nửa đêm địa phương thành 17:00 UTC **hôm trước**, kỳ 21–25/7 biến thành 20–24/7 và **dòng nhập hàng ngày cuối không hút được**. Đã dính lỗi này một lần.

## Tổ chức file

| File | Việc |
|---|---|
| `lib/balancingCalc.ts` | công thức — **bất biến, không sửa** |
| `lib/balancingGrid.ts` | logic thuần: ngày trong kỳ · họ nguyên liệu · gom theo ngày · dựng dòng lưới · quy tắc ghi ngược. Không React, dễ đọc và (sau này) dễ test |
| `features/balancing/usePeriodGrid.ts` | tất cả dữ liệu + thao tác của MỘT kỳ: năm nguồn dữ liệu, ghép lại danh sách con, hút, ghi ngược theo lô |
| `features/balancing/MaterialGrid.tsx` · `WipGrid.tsx` | chỉ dựng cột/dòng và gọi hook — không đụng repo |
| `features/balancing/gridDialogs.tsx` | bốn hộp thoại phụ |
| `features/balancing/BalancingScreen.tsx` | danh sách kỳ + CRUD kỳ + xếp chỗ cho hai lưới |
| `features/balancing/BalancingTable.tsx` | bản in A4 (ngoại lệ luật design-system) |

Luật: **component không gọi repo**. Mọi đọc/ghi đi qua `usePeriodGrid` — nếu không, ba luật dễ sai (ghép lại danh sách con, hút bằng cách gán kỳ, ghi ngược theo lô) sẽ phải nhớ lại ở mỗi chỗ thêm cột.

## Logic / Rules

### Kỳ = một lô, không phải một tuần

Một kỳ = **một loại NL** + **tập ngày tiếp nhận** của lô đó. Ngày có thể rời rạc; `tuNgay`/`denNgay` chỉ là cách chọn nhanh, `ngayList` là chuỗi để in (sinh từ khoảng ngày, bản cũ gõ tay).
**Thành phẩm có thể ra trễ hơn kỳ** — hệ thống vẫn cho nhập TP vào kỳ đã đóng ngày nhận NL. Đừng thêm ràng buộc "TP phải trong khoảng ngày".

### Công thức (`src/lib/balancingCalc.ts` — hàm thuần, không React)

```
Định mức        = Tổng NL vào (kg) ÷ Tổng TP (kg)        // ~1,09 với mực ống khay
Giá trị NL      = Σ kg × đơn giá
Giá trị xuất    = Σ (kg × đơn giá), dòng Xuất khẩu × tỉ giá
Giá thành       = Tổng TP × chi phí CB/kg + Giá trị NL
Lãi/Lỗ         = Giá trị xuất − Giá thành
Bình quân/kg NL = Lãi/Lỗ ÷ Tổng NL vào   // LÃI bình quân mỗi kg NL, KHÔNG phải giá thành/NL — khớp ô "Bình quân /kg nl" báo cáo giấy (VD 242.346.218 ÷ 63.926 ≈ 3.791)
Tỉ lệ thu hồi   = Tổng TP ÷ Tổng NL NHẬN (thông số kỳ, ≠ Tổng NL vào) — null nếu chưa khai
Giá trị phế liệu= Σ kg × đơn giá bán
```

- Chi phí CB, tỉ giá (mặc định 26.000 đ/USD), đơn giá NL: **nhập tay mỗi kỳ**, không tra tự động.
- Đơn giá TP là **USD nếu kênh Xuất khẩu, VND nếu Nội địa** — cùng một cột, quy tỉ giá lúc tính. Đây là nguồn sai số kinh điển: đừng cộng thẳng hai kênh.
- `tongNLNhan` (thông số kỳ) **khác** tổng NL vào của khối 1. NL vào = phần thật sự đưa vào mặt hàng này; NL nhận = tổng cả xưởng theo bảng phụ. Nhầm hai cái là hỏng tỉ lệ thu hồi.
- Chưa có TP ⇒ định mức và lãi/lỗ **chưa có nghĩa**, màn hình phải ẩn/ghi rõ thay vì hiện 0.

### Hai khối

1. **NL vào** — nhóm `Thủy sản` / `Xả đông` / `Bột phụ gia`. "Bột" là **phụ gia tẩm** (có cột tỷ lệ %), không phải phụ phẩm.
   - **Số lượng có thể ÂM** — dòng điều chỉnh giảm (VD "Bán nội địa −987": NL bán thẳng nội địa, không chế biến ⇒ trừ khỏi pool NL đưa vào sản xuất). Validate chỉ chặn `= 0`, không chặn âm. Tổng NL vào cộng cả dòng âm ⇒ khớp T.CỘNG của báo cáo gốc.
   - **Cờ nguồn kho** (`nguonKho`, chỉ hiện khi nhóm = `Xả đông`): `"Mua về"` (hàng cấp đông kho KHÁC bán về) / `"Kho mình"` (xả đông hàng kho mình) / `""` (chưa rõ). **Seam** cho quản lý tồn kho / vòng lặp đông gửi ↔ xả đông sau này — chưa dùng vào công thức. Lưu qua cột `nguon_kho` (migration `0008`); `repo.ts` chỉ gửi khi có giá trị ⇒ ghi NL vào chạy được **kể cả khi chưa chạy 0008**.
2. **Bán thành phẩm sản xuất** (nhãn cũ "TP ra") — **bán thành phẩm LÀM RA trong kỳ** (cấp đông, cất kho lưu trữ, **CHƯA bán** — gom đủ đơn đặt mới xuất container). ≠ hàng đã bán ra ở màn Bán hàng. Mặt hàng (danh mục mở, ánh xạ lỏng sang 141 mã) × quy cách/size × khách (đơn đặt) × kênh. **Nhập tay** là đường chính cho báo cáo sản lượng. Seam **HÚT từ sổ bán** vẫn còn (dòng bán trong khoảng ngày → bản sao `thanh_pham_ra`, gắn `banHangId` chống trùng; bỏ kỳ = xóa bản sao, số gốc ở sổ bán) — dùng cho tình huống output=bán ra, sẽ tổ chức lại khi có module kho + bán hàng. Xem [33-ban-hang.md](33-ban-hang.md).

### Xóa kỳ

`balancing_inputs` + `balancing_outputs` của kỳ bị xóa theo. `scraps` có `source = "Nhập hàng"` chỉ **gỡ liên kết** — số gốc thuộc về sổ nhập hàng (kỳ không còn dùng phế liệu, nhưng dòng cũ đã lỡ gắn kỳ vẫn phải gỡ sạch, không được xóa). Có Hoàn tác cho cả bốn danh sách.

Dòng `material_imports` / `production_wips` đã hút thì **chỉ xóa `balancing_period_id`**, tuyệt đối không xóa dòng — đó là sổ gốc của xưởng.

### Ghép lại danh sách con (bẫy mất dữ liệu)

`useNLVao/usePheLieu/useTPRa` trả **toàn bộ dòng của mọi kỳ**. `KyDetail` lọc theo `ky.id` để hiển thị, nhưng khi ghi phải `ghepLai()` với dòng của kỳ khác. Viết `ghiNL(dongCuaKyNay)` thẳng = **xóa sạch mọi kỳ khác**. Xem [04-tang-du-lieu.md](04-tang-du-lieu.md).

## Edge cases

| Tình huống | Hành vi đúng |
|---|---|
| Gõ loại NL mới trong ô chọn kỳ | Lưu luôn vào danh mục `loai_nguyen_lieu` + toast — không để tên mồ côi. |
| Đơn giá / tỉ giá / chi phí null | Coi như 0 khi tính (`?? 0`), nhưng hiển thị là "—", không phải `0 đ`. |
| Tổng TP = 0 | `dinhMuc = 0`, `tyLeThuHoi = null` nếu chưa khai `tongNLNhan`. Màn hình gắn cờ `chuaCoTP`. |
| Bảng in `BalancingTable.tsx` | **Ngoại lệ luật design-system** — `text-sm`, `uppercase`, màu `slate` cứng để khớp khổ A4, in bằng `window.print()`. Đừng áp luật UI vào file này, cũng đừng lấy nó làm mẫu cho màn mới. Kỳ **> 3 ngày** tự gắn `print-landscape` (in ngang), nếu không cột cuối bị cắt. |
| Dòng giảm chưa khai đơn giá | Cột thành tiền để **trống**, không in `-0` (`−987 × 0` ra `-0`, người xem bảng tưởng lỗi). |
| Kỳ chưa khai ngày | Lưới không có cột ngày, chỉ còn Tổng + Chuyển kỳ — vẫn nhập tay được. Hút thì **không hút gì** (tránh kéo cả sổ vào một kỳ trống). |
| Nhãn ô trong lưới / ô trong hộp cuộn | **Cấm** `className="sr-only"` cho nhãn đặt trong hộp cuộn (`<caption class="sr-only">`, nhãn Combobox…). `sr-only` là `position:absolute`; không có tổ tiên định vị thì nó rơi ra toạ độ TRANG, đội chiều cao trang lên và sinh **thanh cuộn dọc thứ hai + mảng trắng dưới cùng**. Dùng `aria-label` trên chính phần tử (`<table aria-label>`, `Combobox anNhan`). Đã dính lỗi này một lần. |
| Mở phiếu in | Đặt `data-xem-phieu` trên `<html>` để khoá cuộn nền (`src/index.css`), nếu không thanh cuộn của khung app nằm cạnh thanh cuộn của phiếu → hai thanh cuộn, người dùng không biết thanh nào là của phiếu. |
| Kỳ dài quá 62 ngày | `ngayTrongKy` cắt ở 62 cột. Kỳ dài hơn thế là dấu hiệu chọn nhầm khoảng ngày. |
| Mặt hàng chưa ánh xạ mã 141 | Hợp lệ (`maTP` rỗng, hiện "Chưa ánh xạ"). Danh mục mặt hàng là **danh mục mở**. |

## Cross-references

- Sổ bán — nguồn hút cho khối TP ra: [33-ban-hang.md](33-ban-hang.md)
- Phế liệu nhập ở đâu: [30-nhap-hang.md](30-nhap-hang.md)
- Bẫy ghi đè danh sách: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- Thiết kế gốc + số kiểm chứng (mực ống khay 3.106 ÷ 2.856 ≈ 1,09): [`docs/trien-khai/plan-flow-can-doi-5-ngay.md`](../trien-khai/plan-flow-can-doi-5-ngay.md)
- Câu hỏi đã chốt / còn treo: [`docs/trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md`](../trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md)
