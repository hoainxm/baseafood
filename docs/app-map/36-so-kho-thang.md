> Load khi: sửa màn Sổ kho theo tháng (/ton-kho-thang), logic dồn tồn cuối kỳ → đầu kỳ sau, hay công thức tồn cuối/tiền còn lại theo tháng.
covers: src/features/monthly-stock/MonthlyStockScreen.tsx, src/features/monthly-stock/index.ts, src/lib/monthlyStock.ts, src/lib/monthlyStockExcel.ts
last_verified: 2026-09-18
ttl_days: 90
<!-- re-verified: 2026-09-18 10:30 — apThaoTacLo "chuyển kho": full (kg>=closeKg) chỉ đổi storageLocation KHÔNG tách dòng, partial mới tách dòng mới id `msl|…` (monthlyStock.ts:507-538 + MonthlyStockScreen.tsx:502-532); XEM TRƯỚC ẩn nút Chuyển kho/Lấy ra/Gán vị trí (guard `!laXemTruoc`, MonthlyStockScreen.tsx:809,1153,1163) — khớp code. -->
<!-- updated: 2026-09-15 (2) — thao tác một dòng `apThaoTacLo` (lấy ra dùng · nhập thêm · chuyển kho, nhật ký vào `note`) + nút Ẩn/Hiện dòng trống (`laDongTrong`) + hướng dẫn nút ? (`guideContent.tsx` khóa `ton-kho-thang`) + dòng gợi ý "Cách thao tác". -->
<!-- updated: 2026-09-15 — bảng xem & lưới Ghi chỉ còn KG (bỏ cột kiện + KG/kiện; dữ liệu kiện vẫn lưu/nạp/dồn kỳ); cột `origin` hiển thị là INVOICE; Ngày nhập tách thành cột đầu; thêm cột Vị trí cuối bảng (mig 0045) + nút Gán vị trí cho dòng tick; header bảng dính (BangTong `dinhDau`). -->
<!-- re-verified: 2026-09-09 15:00 — id nhập `xlsx|<mã kho>|<sheet>|<năm>|<rowIndex>` (MonthlyStockScreen:419), khoaLo đối chiếu = kho·nhóm·tên name-level (monthlyStock.ts:199), migration 0041 create-if-not-exists idempotent — khớp code. -->
<!-- re-verified: 2026-09-11 16:40 — parser cột 0/1/2/3/4/5/8-13 + nhóm "NHẬP KHẨU"/"MUA NGOÀI" + bỏ dòng "TỔNG" (monthlyStockExcel.ts:105-146), nhận sheet số tháng qua suyThang() "1".."12"/"T8"/"Tháng 8" (monthlyStockExcel.ts:94-103), id nạp `xlsx|${maKho}|${sheetName}|${nam}|${rowIndex}` + nạp lại thay-theo-id giuLai=filter(!idMoi) (MonthlyStockScreen.tsx:503,529-531), namTuTenFile year=/20\d{2}/ (monthlyStockExcel.ts:164-167) — khớp code. -->
<!-- re-verified: 2026-09-15 15:30 — donSangThang(nguon, thangDich) + idDon `carry|<id-nguồn>` (monthlyStock.ts) và EmptyState "Kế thừa tồn cuối tháng trước" (MonthlyStockScreen) đúng như doc mô tả TRƯỚC đợt này; khoaLo = kho·nhóm·tên name-level (monthlyStock.ts:199) vẫn là khóa gộp — tái dùng cho thẻ kho. Đã kiểm trên DB thật: T9/2026 trống, T8 có 143 dòng / 1.478.897,83 kg. -->

# Sổ kho theo THÁNG dương lịch (`/ton-kho-thang`)

Số hoá "bảng kê kho" mà kế toán/thủ kho đang giữ trên Excel (mỗi sheet một tháng — nguồn: `kho 1000 năm 2026.xlsx`, "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"). Trả lời câu: **cuối tháng này tồn bao nhiêu, và số đó tự thành tồn đầu tháng sau** — hết chép tay.

## Vì sao tách MODULE RIÊNG (không gộp NXT sẵn có)

Đã có ba sổ tồn, nhưng **không cái nào theo tháng dương lịch cho MỌI đối tượng**:

| Sổ | Kỳ | Đối tượng | Đơn vị |
|---|---|---|---|
| `/nxt-nl` (`MaterialNxtScreen`) | kỳ CÂN ĐỐI (lô, ~5 ngày) | nguyên liệu | kg |
| `/nxt` (`NxtReportScreen`) | khoảng ngày | thành phẩm/BTP | kg |
| `/nxt-kho` (`WarehouseNxtScreen`) | khoảng ngày tuỳ ý | 1 nhóm mã (seed bạch tuộc) | kg |
| **`/ton-kho-thang`** (module này) | **THÁNG dương lịch** | **NL + BTP + TP (chung)** | **kg** (kiện vẫn lưu, không hiện) |

Bảng kê thật theo dõi song song **kiện** và **kg**, có **đơn giá + tiền còn lại**, nhóm theo **loại hàng** (nhập khẩu / mua ngoài…). File Excel gốc dồn kỳ SAI ở dòng tổng (tồn đầu nhập khẩu đóng băng 859.444 kg suốt 7 tháng, tồn nội địa reset 0 mỗi tháng) — đúng nỗi đau "tồn cuối kỳ sai do ghi tay". Module này **ép cứng** dồn kỳ đúng.

⚠️ Module này KHÔNG đụng `/nxt-nl`, `/nxt`, `/nxt-kho`, `balancingCalc.ts`, `production_locks`, `material_opening_stock` — chỉ đọc/ghi bảng riêng `monthly_stock_ledger`.

## Mô hình dữ liệu

Bảng `monthly_stock_ledger` (migration `0041`, `0045` thêm vị trí), một DÒNG = (Tháng × Nhóm × Mặt hàng × Size × Invoice). Hook `useMonthlyStock()` ([04-tang-du-lieu](04-tang-du-lieu.md)). Type `MonthlyStockLine` (`src/types.ts`).

- Kỳ = `period` dạng `'YYYY-MM'` (tháng dương lịch).
- Nhóm = `category` (danh mục MỞ; gợi ý `MONTHLY_STOCK_CATEGORIES`: NL nhập khẩu / NL mua ngoài / BTP / TP đóng gói).
- Số liệu song song **kiện + kg**: `openCtn/openKg` (tồn đầu) · `inCtn/inKg` (nhập) · `outCtn/outKg` (xuất). Mô tả: `warehouse`, `itemName`, `size`, `origin`, `importDate`, `kgPerCtn`, `unitPrice`, `storageLocation`.
- **Từ 2026-09-15 màn chỉ HIỆN kg** (chốt với người dùng): bỏ cột kiện + KG/kiện ở bảng xem, lưới Ghi, form, thanh cộng dòng tick, thẻ kho. Field `*Ctn`/`kgPerCtn` **vẫn lưu** (Excel vẫn nạp, dồn kỳ vẫn mang sang, sửa dòng qua ✎ giữ nguyên giá trị cũ) — chỉ ẩn, không xoá.
- **`origin` = số INVOICE** (tên cột DB giữ nguyên, chỉ đổi nhãn "Xuất xứ" → "Invoice"): dữ liệu thật nạp từ cột 4 bảng kê là số invoice (VD `SBT2026004`).
- **`storageLocation` = VỊ TRÍ** hàng đang nằm (TÊN kho; migration `0045`). Rỗng ⇒ hiện tên `warehouse` màu mờ (hàng ở chính kho của sổ). Chọn qua Combobox: 5 kho hệ thống + danh mục `storage_locations` (kho thuê ngoài) + tên đã dùng; gõ tên mới ⇒ lưu ngay vào `storage_locations` (kind `thue-ngoai`). Khác `warehouse` (sổ thuộc kho nào — nằm trong id nạp, KHÔNG đổi): đổi vị trí KHÔNG tách dòng sang sổ khác nên không cộng đôi.

## Bất biến (hàm thuần `src/lib/monthlyStock.ts` — quy tắc nằm DUY NHẤT ở đây)

```
Tồn cuối (kiện) = tồn đầu + nhập − xuất        // suyDong().closeCtn
Tồn cuối (kg)   = tồn đầu + nhập − xuất        // suyDong().closeKg
Tiền còn lại    = Tồn cuối (kg) × đơn giá      // suyDong().remainingValue
```

- Tồn cuối + tiền còn lại **KHÔNG lưu** — suy tại app nên luôn khớp (màn có thanh "Khớp bất biến" đối chiếu).
- Tồn **ĐẦU** kỳ thì **LƯU**: nó là snapshot kế thừa từ tồn cuối tháng trước, **đóng băng** để số không trôi khi sửa lại tháng cũ.

## Dồn kỳ: tồn cuối tháng N → tồn đầu tháng N+1

`donSangThang(nguon, thangDich)` dựng dòng tồn đầu tháng đích = tồn cuối tháng nguồn (nhập/xuất = 0), giữ nguyên mô tả (nhóm, kho, tên, size, xuất xứ, đơn giá).

- **id tất định** `carry|<id-dòng-nguồn>` (`idDon`) ⇒ dồn lại nhiều lần chỉ **CẬP NHẬT**, KHÔNG nhân đôi. Ghi = `lines.filter(l => !idMoi.has(l.id))` rồi nối dòng carry → giữ nguyên dòng nhập tay ở tháng đích.
- Chỉ mang sang dòng **còn tồn** (tồn cuối ≠ 0).
- Hai chiều: nút **"Dồn sang tháng sau"** (đẩy, dùng TOÀN BỘ dòng của tháng — bỏ qua bộ lọc kho) và **"Kế thừa & lưu vào sổ"** (kéo, ở banner XEM TRƯỚC của tháng trống — xem § Màn hình).

## Màn hình

- Chọn kỳ = tháng (Combobox + nút ◀ ▶), lọc theo kho (5 kho hệ thống `BSF1_WAREHOUSES` + kho lạ nếu có), **ô "Tìm mặt hàng"** (lọc theo tên · size · invoice · nhóm · kho · vị trí), hai chế độ: **xem** (nhóm × bảng + dòng cộng nhóm) và **Ghi nhập/xuất** (`LuoiNhap` gõ kg từng mã, dán khối Excel). Mô tả (ngày nhập/tên/size/invoice/đơn giá/vị trí) sửa ở nút ✎ dialog.
- **Thứ tự cột bảng xem:** Ngày nhập · Mặt hàng (size dòng phụ) · Invoice · Đơn giá · Tồn đầu kỳ (kg) · Nhập trong kỳ (kg) · Xuất trong kỳ (kg) · Tồn cuối kỳ (kg) · Tiền còn lại · **Vị trí** · thao tác. Bảng mỗi nhóm bật `BangTong dinhDau`: khung cuộn riêng cao ≤70dvh, hàng tên cột dính đỉnh + dòng cộng dính đáy.
- **Cột Vị trí:** hàng gửi ra **kho ngoài** (kho thuê ngoài, không thuộc 5 kho hệ thống — `laKhoNgoai`) hiện **"Gửi: &lt;kho&gt;"** đậm màu primary (VD "Gửi: Kho Ánh Dương") để kế toán thấy ngay; vị trí trong kho hệ thống hiện tên thường, để trống ⇒ tên `warehouse` màu mờ.
- **Nút "Thêm dòng"** đặt ở **CUỐI danh sách** (dưới bảng, full-width ở điện thoại) — không còn ở thanh công cụ trên. Ẩn khi đang xem trước dồn kỳ (bấm "Kế thừa & lưu vào sổ" trước).
- 5 thẻ `ThongKe` tự xếp: màn rộng (xl) một hàng 5 thẻ, lg 3+2, điện thoại 2 cột (thẻ lẻ trải hàng; chữ 130% về 1 cột).
- `gomNhom()` xếp theo `MONTHLY_STOCK_CATEGORIES` trước, nhóm lạ cuối; mỗi nhóm có tổng riêng, thẻ `ThongKe` tổng toàn tháng (gồm tiền còn lại). In A4 (`PhieuIn`).
- Tháng mặc định = tháng hiện tại (`thangHienTai`).

### Thao tác một dòng — nút 📦− cuối dòng (`apThaoTacLo`, hàm thuần)

Dialog 3 việc, số kg + ngày + ghi chú; mọi lần lưu nối một dòng `dd/mm/yyyy: <việc> <kg> — <ghi chú>` vào `note` (hiện ở Thẻ kho mục "Nhật ký thao tác"), toast có **Hoàn tác**. Ẩn khi đang xem trước dồn kỳ.

- **Lấy ra sử dụng** — CỘNG DỒN vào `outKg` (kiện theo `kgPerCtn` nếu có). Chặn vượt tồn cuối.
- **Nhập thêm** — cộng dồn `inKg` cho đúng lô đó (lô khác ngày nhập/invoice ⇒ "Thêm dòng").
- **Gửi kho ngoài** (nhãn UI của kiểu `chuyen`; mô tả nêu rõ "Ánh Dương, HP…") — KHÔNG phải nhập/xuất ⇒ tổng tháng không đổi. Gửi HẾT tồn cuối ⇒ chỉ đổi `storageLocation` (cột Vị trí ghi "Gửi: &lt;kho&gt;"). Gửi MỘT PHẦN ⇒ tách dòng mới (id `msl|<tháng>|uid`, cùng mô tả, vị trí đích): kg lấy từ `openKg` trước rồi `inKg` (kiện chia cùng tỉ lệ), dòng gốc giữ `outKg` ⇒ tồn cuối gốc = cũ − X, dòng tách = X. Tổng theo tên (`khoaLo`) giữ nguyên ⇒ đối chiếu dồn kỳ không báo lệch giả. Dòng tách ghi note `(tách từ dòng <id>)`.
- ⚠ **Nạp lại Excel** tháng có dòng đã tách: dòng gốc (id `xlsx|…`) trở về số trong file ⇒ phần tách bị đếm 2 lần. `xacNhanNap` dò note `(tách từ dòng <id>)` và **cảnh báo** (không tự xoá).
- Khác lưới **Ghi nhập/xuất**: ô lưới là tổng CẢ THÁNG (ghi đè), nút dòng là CỘNG THÊM từng lần.

### Ẩn / hiện dòng trống

Nút **Ẩn dòng trống (n)** (`aria-pressed`) lọc bỏ dòng `laDongTrong` (tồn đầu = nhập = xuất = 0, cả kg lẫn kiện) khỏi bảng xem, lưới Ghi, tổng, in, tick. Mặc định HIỆN (tránh tưởng mất dòng); không nhớ qua lần mở. Đổi trạng thái ⇒ bỏ chọn. Ẩn hết ⇒ ô báo + nút "Hiện tất cả".

### Tick dòng → cộng tổng · in riêng · xóa theo lô

Bảng bật cột ô tick qua prop `chon` của `BangTong` (`ChonBang` — xem [design-system README](../../src/design-system/README.md)); màn giữ `daChon: Set<id>`, **không sửa dữ liệu**. Tick vài dòng ⇒ hiện thanh cộng tổng của ĐÚNG mấy dòng đó (tồn đầu · nhập · xuất · tồn cuối theo kg, + tiền còn lại) — việc kế toán làm suốt mà trước phải bấm máy tính tay. Kèm:

- **Gửi kho ngoài** (nút bulk, trước tên "Gán vị trí") — Combobox "Kho nhận (VD Kho Ánh Dương, HP)", ghi `storageLocation` cho mọi dòng tick (toast Hoàn tác). Ẩn khi đang xem trước dồn kỳ.
- **In {n} dòng** — `PhieuIn` in đúng dòng đã tick (`rowsIn = rowsChon.length ? rowsChon : rowsThang`, tổng + gom nhóm tính lại theo đó).
- **Xóa dòng đã chọn** — qua `ConfirmDelete` + toast **Hoàn tác** (không xóa lặng lẽ). Ẩn khi đang xem trước dồn kỳ.
- Ô tick ở đầu bảng mỗi nhóm = chọn/bỏ cả nhóm; nút "Chọn tất cả / Bỏ chọn hết" ở thanh công cụ. Đổi tháng/kho ⇒ bỏ chọn (tránh cộng nhầm dòng của kỳ khác).

### Thẻ kho (sổ chi tiết vật tư) — nút 🕘 mỗi dòng

`theKhoMatHang(lines, khoaLo(row))` dựng lịch sử **một mặt hàng** qua tối đa 24 tháng: mỗi tháng một dòng tồn đầu · nhập · xuất · tồn cuối (mới → cũ), tháng đang xem tô nền. Khóa gộp là **`khoaLo` (kho·nhóm·TÊN, bỏ size)** — CÙNG khóa với `doiChieuDonKy`, nên lô tách theo size cộng lại thành một dòng tháng thay vì đẻ ra mấy dòng rời. Hàm thuần, chỉ đọc. Đọc dọc cột tồn cuối ↔ tồn đầu dòng dưới là thấy ngay chỗ đứt vòng gối đầu.

### Tháng trống ⇒ XEM TRƯỚC dồn kỳ (không còn "trống trơn")

Tháng đang xem chưa có dòng nào **và** tháng trước còn tồn ⇒ màn dựng sẵn `donSangThang(tháng trước, tháng này).map(suyDong)` và hiển thị **y như bảng thật**, kèm banner "Xem trước tồn đầu … CHƯA LƯU" + nút **"Kế thừa & lưu vào sổ"**.

- **Vì sao xem trước chứ không tự ghi:** dồn kỳ vẫn phải qua bước người duyệt — lô hay bị tách size / đổi mã lô giữa các tháng, tự ghi đè là đường thẳng tới **cộng đôi** (xem § Cờ lệch dồn kỳ). Xem trước cho thấy số ngay mà không chạm dữ liệu; một cú bấm mới ghi.
- Trong chế độ xem trước: ẩn nút Ghi nhập/xuất, ẩn ✎ và 🗑 từng dòng, ẩn 📦− (Chuyển kho/Lấy ra) + "Gán vị trí", **tắt banner "Lệch dồn kỳ"** (lệch lúc này chính là phần chưa dồn — banner xem trước đã nói rồi, hiện thêm cảnh báo đỏ chỉ làm tưởng sai số).
- ⚠ **"Thêm dòng" bị chặn khi đang xem trước** (`moThem` → `notify.canhBao`, không mở form): thêm+lưu 1 dòng sẽ khiến `rowsLuu` ≠ rỗng ⇒ tắt xem trước ⇒ cả bảng kế thừa (chưa lưu) biến mất khỏi màn — dễ tưởng mất số liệu. Bắt bấm "Kế thừa & lưu vào sổ" trước. Muốn ghi hàng **đông gửi kho ngoài** (Ánh Dương/HP…) cũng vậy: lưu sổ trước, rồi tick dòng → **"Gửi kho ngoài"**, hoặc 📦− → **"Gửi kho ngoài"** (dùng cột **Vị trí**, KHÔNG đẻ khái niệm dòng gửi riêng — chốt 2026-09-18).
- Dòng xem trước lọc theo kho đang chọn; nút "Kế thừa & lưu" vẫn dồn **toàn bộ kho** (`donTuThangTruoc`, đúng quy tắc "dồn kỳ không bỏ sót kho nào").

## Nhập Excel bảng kê (seed số cũ)

Nút **"Nhập Excel bảng kê"** đọc thẳng file `kho ... .xlsx` ("BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"): parser `src/lib/monthlyStockExcel.ts` (`parseBangKeKhoFile`, dùng `xlsx`/SheetJS như `nxtExcel.ts`).

- Mỗi **sheet = một tháng** (tên sheet là số tháng 1–12). Cột 0-based: 0 ngày nhập · 1 tên · 2 kg/kiện · 3 giá · 4 xuất xứ (thực chất số INVOICE → `origin`) · 5 size · 8/9 tồn đầu (kiện/kg) · 10/11 nhập · 12/13 xuất. **Bỏ** 6/7 "Nhập đầu kỳ" (số tham chiếu tĩnh) và 14/15/16 (tồn cuối + tiền = SUY ở app).
- Nhóm lấy từ dòng tiêu đề mục ("I HÀNG NHẬP KHẨU" / "II HÀNG MUA NGOÀI"); dòng **"TỔNG …"/"CỘNG …"** và mọi dòng **trước mục đầu tiên** đều bỏ (kiểm "TỔNG" TRƯỚC khi dò mục vì "TỔNG HÀNG NHẬP KHẨU" cũng chứa "NHẬP KHẨU").
- Dialog cho chọn **Năm** (suy từ tên file, VD "năm 2026") + **Kho** (Combobox 5 kho hệ thống `BSF1_WAREHOUSES` — K1000T/K1500T/KX-DONG/KX-CA/KX-KHO, mặc định Kho 1500 tấn; cho tạo mới tại chỗ), xem trước số dòng mỗi tháng. **Một file = một kho** (bảng kê theo từng kho). id nạp **tất định** `xlsx|<mã kho>|<sheet>|<năm>|<rowIndex>` — CÓ mã kho nên nhập nhiều kho cùng tháng KHÔNG đè nhau; nạp lại cùng file+năm+kho chỉ CẬP NHẬT, không nhân đôi.
- File không có cột vị trí ⇒ nạp lại **giữ `storageLocation`** đã gán của dòng cùng id (không xoá trắng vị trí).
- **Nạp TRUNG THỰC theo sổ cũ** — KHÔNG chép tồn cuối của file (file gốc dồn kỳ sai ở dòng tổng). Sau khi nạp, mở tháng đầu rồi bấm "Dồn sang tháng sau" lần lượt để **chuẩn hóa** tồn đầu các tháng kế.
- ⚠️ **CHỌN ĐÚNG KHO — mặc định K1500T có thể SAI.** Mã kho nằm TRONG id (`xlsx|<mã kho>|…`), nên nạp NHẦM kho ≠ ghi đè: nó tạo BẢN SAO ở kho khác → "Tất cả kho" cộng đôi (khắc phục: xoá bản thừa theo `warehouse` rồi nạp lại đúng kho — id trùng khớp nên lần đúng chỉ CẬP NHẬT). File **`kho 1000 năm 2026`** thực tế thuộc **Kho 1000 tấn (K1000T)** (theo chủ dữ liệu 2026-09-11) DÙ tiêu đề mỗi sheet ghi "…KHO 1500" — tên file/tiêu đề chỏi nhau, **đừng theo mặc định**, hỏi/đối chiếu trước khi nạp.
- Kiểm thật: file `.xlsx` cũ 7 sheet → 1.405 dòng; file `.numbers` cập nhật (2026-09-11) **8 sheet → 1.593 dòng** (thêm tháng 8; T1–7 cùng số dòng nhưng vài giá trị đã sửa). `.numbers` phải convert sang `.xlsx` (giữ tên sheet + vị trí cột) trước khi nạp — module chỉ đọc `.xlsx`. Nạp lại idempotent (1593→1593), id duy nhất.

## Cờ lệch dồn kỳ + Đối chiếu (SOI + sửa tay, KHÔNG tự ghi đè)

Sau khi nạp cả năm, mỗi tháng vẫn giữ số theo file. Module **gắn cờ** khi tồn đầu
tháng này ≠ tồn cuối tháng trước (`soLechDonKy`, so tổng + tách theo nhóm; ngưỡng
1 kg). Banner warning hiện tổng lệch + nhóm chênh, kèm nút **"Đối chiếu & sửa lệch"**.

**Đối chiếu (`doiChieuDonKy`) — so theo MẶT HÀNG, KHÔNG theo lô:** khóa = kho·nhóm·tên,
**bỏ size + xuất xứ**. Lý do: giữa các tháng một lô hay bị **tách theo size / đổi mã
lô** (VD `SANMA 38.685` tháng trước → `SANMA 3.300` + `SANMA 50-90 35.385` tháng này,
tổng KHÔNG đổi). So theo (tên+size) sẽ báo động giả và nếu "áp" tự động sẽ **cộng
đôi** (đặt SANMA=38.685 trong khi bản 50-90 vẫn còn). Gộp về TÊN thì tách triệt tiêu,
chỉ còn lệch THẬT. Kiểm thật T5→T6: lot-level 28 dòng (có SANMA giả) → **name-level 24
mặt hàng, SANMA biến mất** ✓.

**Không tự sửa** — dialog chỉ liệt kê mặt hàng lệch (tồn cuối T-1 ↔ tồn đầu T này +
Δ), mỗi dòng có **"Sửa tay"** → mở lưới Ghi **lọc đúng mặt hàng đó** (`locMatHang`) để
người dùng chỉnh tồn đầu/nhập/xuất theo phán đoán (con người quyết, tránh cộng đôi khi
lô tách/đổi mã). Tháng **trống** thì dùng "Dồn sang tháng sau" từ tháng trước.

## Đồng bộ danh mục (định tuyến TỪNG DÒNG)

Dữ liệu import HỖN HỢP (đã phân tích 144 tên: ~70 bạch tuộc phân loại/bộ phận giống
**mặt hàng**, ~30 cá nguyên con là **nguyên liệu thô**, +tôm/mực/tạp). Ép hết vào MỘT
danh mục đều sai. Nút **"Đồng bộ danh mục"** đối chiếu tên sổ với **CẢ HAI** danh mục
addable — `material_types` (loại NL) + `products` (mặt hàng) — và cho **chọn ĐÍCH từng
dòng**. **Thành phẩm 141 mã kế toán (`finished_goods`) CỐ ĐỊNH — KHÔNG thêm ở đây**
(memory `danh-muc-mat-hang-3-tang`).

**Tách RÕ RÀNG vs MÃ KHÓ (điểm mấu chốt):** tên tự nói lên loài nguyên liệu (CÁ THU,
SANMA, TÔM… — `laRoRang`: loài ≠ Bạch tuộc và ≠ "Khác") thì KHÔNG cần soi tay ("đồng bộ
cá với cá" là vô nghĩa) → gom vào mục thu gọn "Tên rõ ràng", 1 nút thêm hết vào Loại NL
theo loài. Việc CHÍNH là **mã khó**: bạch tuộc phân loại/bộ phận (2 DA RÂU NGẮN, MADA,
BẠCH TUỘC 2 DA 250UP…) + tên không rõ loài — đây mới cần người ánh xạ.

Hàm thuần `phanTichDongBoDanhMuc(tênSổ, tênLoạiNL, tênMặtHàng)` → mỗi tên chưa có (ở cả
hai) kèm `roRang`, **đích gợi ý** (`suyDichDanhMuc`: có size/grade hoặc dấu chế biến/phân
loại → `product`; còn lại → `material`) + **nhóm gợi ý** (`suyNhomNguyenLieu`). Dialog:
**Đồng bộ = ÁNH XẠ, không chỉ thêm mới** (chốt với chủ dự án). MỖI dòng có: (1) **select
đích** (Mặt hàng / Loại NL / Bỏ qua); (2) **Combobox ánh xạ tới TÊN CHUẨN CÓ SẴN** —
options = toàn bộ `products` (171) khi đích = Mặt hàng, hoặc `material_types` khi đích =
Loại NL — gõ tìm chọn tên chuẩn mà mã khó thuộc về, hoặc gõ thêm mới nếu chưa có. Mã khó
ở list CHÍNH; tên rõ ràng (CÁ THU…) trong `<details>` thu gọn (mặc định đích → Loại NL,
đổi được). Bulk theo section (Theo gợi ý / Tất cả→MH / Tất cả→NL / Bỏ hết).

`apDongBo()`: mỗi dòng (đích ≠ bỏ qua) → tên chuẩn `canon` = ánh xạ (mặc định = tên file
nếu chưa chọn). Nếu `canon` CHƯA có trong danh mục đích ⇒ thêm mới (`material_types`
{id,name,category,note} hoặc `products` {id,code:"",name,finishedGoodCode:"",category,
processingType:""}, category suy từ tên); và **ĐỔI TÊN mọi dòng sổ mang tên file cũ → `canon`**
(đồng bộ sổ + gộp các biến thể trùng cách ghi về một). Nút: "Đồng bộ: {n} → Mặt hàng · {m}
→ Loại NL". Kiểm thật (kho 1000 năm 2026): 144 tên → 73 mã khó + 69 rõ ràng; ô ánh xạ liệt
kê 171 mặt hàng, gõ tìm map "4 DA RÂU NGẮN" vào tên chuẩn (VD "…cắt râu…") hoặc thêm mới.
- **Trùng cách ghi**: các tên chỉ khác khoảng trắng/hoa thường/dấu câu (chuẩn hoá ngặt
  bỏ hết space+dấu câu), VD `"BẠCH TUỘC 2 DA 250UP"` ≡ `"…250 UP"`, `"200 UP"` ≡ `"200 up"`.
  Đây là nguồn **đếm thành nhiều mặt hàng** khi tổng hợp → liệt kê để sửa tay về một cách ghi.

Kiểm thật (`kho 1000 năm 2026.xlsx`): 144 tên · 2 đã có · **142 chưa có** · 2 nhóm trùng
cách ghi. ⚠ Tên trong sổ nhiều size/grade (mịn hơn "loại NL" gốc) — cân nhắc bỏ chọn
bớt + chuẩn hoá trùng-cách-ghi TRƯỚC khi thêm để danh mục khỏi phình/lặp.

## Cạm bẫy

- **Cộng đôi**: mỗi dòng độc lập trong CÙNG một tháng ⇒ `tongDong` cộng thẳng an toàn. Nhưng KHÔNG cộng dồn tồn đầu/cuối qua NHIỀU tháng (phần kế thừa sẽ đếm lại) — module chỉ tổng trong một tháng.
- **Danh mục mở**: `category` là chuỗi tự do (Combobox tạo mới) — gõ lệch tên sẽ tách nhóm khi tổng hợp; ưu tiên chọn gợi ý sẵn.
- Tồn cuối < 0 = xuất nhiều hơn đang có ⇒ dấu hiệu ghi sai; thanh bất biến gọi tên.

## Cross-references

- Hook + mapping DB: [04-tang-du-lieu](04-tang-du-lieu.md) (`BANG_MONTHLY_STOCK`)
- Bảng + migration `0041`: [03-database](03-database.md)
- Route + nav: [02-pages-navigation](02-pages-navigation.md)
- Sổ NXT nguyên liệu theo lô (khác kỳ): [31-can-doi-ky](31-can-doi-ky.md) § Tồn kho nguyên liệu
