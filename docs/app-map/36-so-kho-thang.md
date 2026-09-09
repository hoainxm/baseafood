> Load khi: sửa màn Sổ kho theo tháng (/ton-kho-thang), logic dồn tồn cuối kỳ → đầu kỳ sau, hay công thức tồn cuối/tiền còn lại theo tháng.
covers: src/features/monthly-stock/MonthlyStockScreen.tsx, src/features/monthly-stock/index.ts, src/lib/monthlyStock.ts, src/lib/monthlyStockExcel.ts
last_verified: 2026-09-09
ttl_days: 90

# Sổ kho theo THÁNG dương lịch (`/ton-kho-thang`)

Số hoá "bảng kê kho" mà kế toán/thủ kho đang giữ trên Excel (mỗi sheet một tháng — nguồn: `kho 1000 năm 2026.xlsx`, "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"). Trả lời câu: **cuối tháng này tồn bao nhiêu, và số đó tự thành tồn đầu tháng sau** — hết chép tay.

## Vì sao tách MODULE RIÊNG (không gộp NXT sẵn có)

Đã có ba sổ tồn, nhưng **không cái nào theo tháng dương lịch cho MỌI đối tượng**:

| Sổ | Kỳ | Đối tượng | Đơn vị |
|---|---|---|---|
| `/nxt-nl` (`MaterialNxtScreen`) | kỳ CÂN ĐỐI (lô, ~5 ngày) | nguyên liệu | kg |
| `/nxt` (`NxtReportScreen`) | khoảng ngày | thành phẩm/BTP | kg |
| `/nxt-kho` (`WarehouseNxtScreen`) | khoảng ngày tuỳ ý | 1 nhóm mã (seed bạch tuộc) | kg |
| **`/ton-kho-thang`** (module này) | **THÁNG dương lịch** | **NL + BTP + TP (chung)** | **kiện (CTN) + kg** |

Bảng kê thật theo dõi song song **kiện** và **kg**, có **đơn giá + tiền còn lại**, nhóm theo **loại hàng** (nhập khẩu / mua ngoài…). File Excel gốc dồn kỳ SAI ở dòng tổng (tồn đầu nhập khẩu đóng băng 859.444 kg suốt 7 tháng, tồn nội địa reset 0 mỗi tháng) — đúng nỗi đau "tồn cuối kỳ sai do ghi tay". Module này **ép cứng** dồn kỳ đúng.

⚠️ Module này KHÔNG đụng `/nxt-nl`, `/nxt`, `/nxt-kho`, `balancingCalc.ts`, `production_locks`, `material_opening_stock` — chỉ đọc/ghi bảng riêng `monthly_stock_ledger`.

## Mô hình dữ liệu

Bảng `monthly_stock_ledger` (migration `0041`), một DÒNG = (Tháng × Nhóm × Mặt hàng × Size × Xuất xứ). Hook `useMonthlyStock()` ([04-tang-du-lieu](04-tang-du-lieu.md)). Type `MonthlyStockLine` (`src/types.ts`).

- Kỳ = `period` dạng `'YYYY-MM'` (tháng dương lịch).
- Nhóm = `category` (danh mục MỞ; gợi ý `MONTHLY_STOCK_CATEGORIES`: NL nhập khẩu / NL mua ngoài / BTP / TP đóng gói).
- Số liệu song song **kiện + kg**: `openCtn/openKg` (tồn đầu) · `inCtn/inKg` (nhập) · `outCtn/outKg` (xuất). Mô tả: `warehouse`, `itemName`, `size`, `origin`, `importDate`, `kgPerCtn`, `unitPrice`.

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
- Hai chiều: nút **"Dồn sang tháng sau"** (đẩy, dùng TOÀN BỘ dòng của tháng — bỏ qua bộ lọc kho) và **"Kế thừa tồn cuối tháng trước"** (kéo, ở màn trống).

## Màn hình

- Chọn kỳ = tháng (Combobox + nút ◀ ▶), lọc theo kho, hai chế độ: **xem** (nhóm × bảng đủ cột + dòng cộng nhóm) và **Ghi nhập/xuất** (`LuoiNhap` gõ kiện/kg từng mã, dán khối Excel). Mô tả (tên/size/đơn giá) sửa ở nút ✎ dialog.
- `gomNhom()` xếp theo `MONTHLY_STOCK_CATEGORIES` trước, nhóm lạ cuối; mỗi nhóm có tổng riêng, thẻ `ThongKe` tổng toàn tháng (gồm tiền còn lại). In A4 (`PhieuIn`).
- Tháng mặc định = tháng hiện tại (`thangHienTai`). Tháng trống + có tháng trước ⇒ EmptyState mời "Kế thừa tồn cuối tháng trước".

## Nhập Excel bảng kê (seed số cũ)

Nút **"Nhập Excel bảng kê"** đọc thẳng file `kho ... .xlsx` ("BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"): parser `src/lib/monthlyStockExcel.ts` (`parseBangKeKhoFile`, dùng `xlsx`/SheetJS như `nxtExcel.ts`).

- Mỗi **sheet = một tháng** (tên sheet là số tháng 1–12). Cột 0-based: 0 ngày nhập · 1 tên · 2 kg/kiện · 3 giá · 4 xuất xứ · 5 size · 8/9 tồn đầu (kiện/kg) · 10/11 nhập · 12/13 xuất. **Bỏ** 6/7 "Nhập đầu kỳ" (số tham chiếu tĩnh) và 14/15/16 (tồn cuối + tiền = SUY ở app).
- Nhóm lấy từ dòng tiêu đề mục ("I HÀNG NHẬP KHẨU" / "II HÀNG MUA NGOÀI"); dòng **"TỔNG …"/"CỘNG …"** và mọi dòng **trước mục đầu tiên** đều bỏ (kiểm "TỔNG" TRƯỚC khi dò mục vì "TỔNG HÀNG NHẬP KHẨU" cũng chứa "NHẬP KHẨU").
- Dialog cho chọn **Năm** (suy từ tên file, VD "năm 2026") + **Kho**, xem trước số dòng mỗi tháng. id nạp **tất định** `xlsx|<sheet>|<năm>|<rowIndex>` ⇒ nạp lại cùng file+năm chỉ CẬP NHẬT, không nhân đôi.
- **Nạp TRUNG THỰC theo sổ cũ** — KHÔNG chép tồn cuối của file (file gốc dồn kỳ sai ở dòng tổng). Sau khi nạp, mở tháng đầu rồi bấm "Dồn sang tháng sau" lần lượt để **chuẩn hóa** tồn đầu các tháng kế.
- Kiểm thật (file `kho 1000 năm 2026.xlsx`): 7 sheet → 1.405 dòng, 7 tháng; id duy nhất; nạp lại idempotent (1405→1405).

## Cờ lệch dồn kỳ (chuẩn hóa = SOI, không ghi đè)

Sau khi nạp cả năm, mỗi tháng vẫn giữ số theo file. Module **gắn cờ** khi tồn đầu
tháng này ≠ tồn cuối tháng trước (`soLechDonKy` trong `lib/monthlyStock.ts`, so
tổng + tách theo nhóm; ngưỡng 1 kg). Banner cảnh báo (warning) hiện tổng lệch +
danh sách nhóm chênh để kế toán soi đúng chỗ rồi **sửa tay lô ghi lệch** — KHÔNG
ghi đè tự động (quyết định của chủ dự án: giữ số theo sổ).

Vì sao không ép `tồn đầu = tồn cuối tháng trước` per lô: file không có mã lô ổn
định giữa các tháng, **~35,7% dòng trùng khóa lô** (cùng tên+size+xuất xứ+giá, VD
NODOGURO nhiều dòng) → gán closing sai lô + phá số kế toán đã ghi. "Dồn sang
tháng sau" chỉ dùng cho tháng **trống** (dựng tiếp), KHÔNG chạy chồng lên tháng đã
nạp (sẽ cộng đôi). Kiểm thật file `kho 1000 năm 2026.xlsx`: T5→T6 lệch −173.466 kg
(nhóm mua ngoài −154.277,88 · nhập khẩu −19.188,28) — cờ chỉ đúng chỗ sai.

## Cạm bẫy

- **Cộng đôi**: mỗi dòng độc lập trong CÙNG một tháng ⇒ `tongDong` cộng thẳng an toàn. Nhưng KHÔNG cộng dồn tồn đầu/cuối qua NHIỀU tháng (phần kế thừa sẽ đếm lại) — module chỉ tổng trong một tháng.
- **Danh mục mở**: `category` là chuỗi tự do (Combobox tạo mới) — gõ lệch tên sẽ tách nhóm khi tổng hợp; ưu tiên chọn gợi ý sẵn.
- Tồn cuối < 0 = xuất nhiều hơn đang có ⇒ dấu hiệu ghi sai; thanh bất biến gọi tên.

## Cross-references

- Hook + mapping DB: [04-tang-du-lieu](04-tang-du-lieu.md) (`BANG_MONTHLY_STOCK`)
- Bảng + migration `0041`: [03-database](03-database.md)
- Route + nav: [02-pages-navigation](02-pages-navigation.md)
- Sổ NXT nguyên liệu theo lô (khác kỳ): [31-can-doi-ky](31-can-doi-ky.md) § Tồn kho nguyên liệu
