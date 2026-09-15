> Load khi: sửa màn `/doi-soat`, logic đối soát hóa đơn điện tử ⇄ phần mềm kế toán, đọc/ghi file Excel hóa đơn.
covers: src/features/doi-soat/DoiSoatScreen.tsx, src/features/doi-soat/index.ts, src/lib/doiSoatHddt.ts, src/lib/doiSoatXuat.ts, src/lib/doiSoatXuatShift.ts, src/lib/doiSoatXuatTongHop.ts
last_verified: 2026-09-15
ttl_days: 90
<!-- updated: 2026-09-15 — v5.1 BÁM ĐÚNG FILE MẪU KẾ TOÁN. v5 mới chỉ giữ định dạng, bố cục vẫn khác mẫu ⇒ người dùng báo "vẫn không giống". Nay: (1) cột **"KẾT QUẢ" chèn làm cột A**, dữ liệu gốc dời phải 1 cột — kéo theo phải DỊCH THAM CHIẾU CÔNG THỨC (`doiSoatXuatShift.ts`: bộ dịch đi từng ký tự, chừa chuỗi trong nháy kép / tên sheet trong nháy đơn / tên hàm; xử cả `$A$1`, `A:A`, ref chéo sheet; gỡ ô gộp TRƯỚC khi dời kẻo mất giá trị ô master); (2) **3 sheet tổng hợp đứng đầu workbook** (`doiSoatXuatTongHop.ts`): `ĐỐI CHIẾU TỔNG` (4 mục A/B/C/D + bóc tách phần chênh) · `TỰ KIỂM TRA` (bảng phép thử + KẾT QUẢ CHUNG) · `NGHI VẤN SỐ LIỆU` (9 cột, vị trí trỏ theo FILE XUẤT); (3) tên cột bám cách gọi của kế toán: "Số dòng khớp ‹tên sheet sổ›" thay vì "PMKT", cặp cột TK lấy đúng tiêu đề nguồn (sổ mã máy → "Thuế suất / Loại"); (4) `NghiVan.viTriXuat` = vị trí theo file xuất (lệch 1 cột so với `viTri` trên màn); `DongPhanMem` thêm `chuaThue`/`thue` để bảng tổng đủ 3 cột tiền; `SheetPhanMem.tenTk`. Gỡ cột lần chạy trước nay **cắt cả khối đuôi** (`laCotThem` + xoá từ cột thêm đầu tiên tới hết) vì vài tên cột đổi theo file; file đã có sẵn cột A "KẾT QUẢ" thì GHI ĐÈ chứ không chèn thêm. Ép `fullCalcOnLoad` vì công thức vừa bị dịch. -->
<!-- re-verified: 2026-09-15 — chạy trên bộ T6 THẬT rồi so từng ô với file mẫu "Tháng 6 - đã lọc.xlsx": (1) BỐ CỤC trùng khít — 7 sheet đúng thứ tự, số cột 38/42/36/27 y mẫu, tiêu đề trùng từng cột; (2) CÔNG THỨC dịch đúng từng cái (`K463=SUM(K7:K462)`→`L463=SUM(L7:L462)`, `R463=O463-L463`→`S463=P463-M463`, `O464=R463+'T6-KMA'!K144+'T6-MTTIEN'!O101`→`P464=S463+'T6-KMA'!L144+'T6-MTTIEN'!P101`) — trùng công thức mẫu 100%; ô gộp `B3:T3`/`B4:T4` + `C144:D144`… trùng mẫu; (3) ORACLE nhãn cột A: **1107/1107 dòng trùng** (685 hóa đơn + 422 dòng sổ), lệch 0; (4) ĐỐI CHIẾU TỔNG khớp mẫu tới từng đồng cả 4 mục A/B/C/D; (5) idempotent 3 vòng: số cột đứng yên 38/42/36/27, tổng không đổi; (6) trình duyệt thật: cả chuỗi engine→chèn cột→sheet tổng hợp→ghi file chạy sạch, không lỗi console. Khác mẫu CÓ CHỦ Ý: cột phân tích ghi GIÁ TRỊ (mẫu ghi công thức sống) — giá trị do engine tính, đã đối chiếu 1107/1107; và định dạng số giữ nguyên bản gốc `_(* #,##0_);…"-"??` trong khi mẫu bị LibreOffice làm rụng dấu nháy. -->
<!-- updated: 2026-09-15 — v5 XUẤT FILE **GIỮ NGUYÊN ĐỊNH DẠNG GỐC** (bỏ lối dựng-mới). Nút "Tải Excel kết quả" nay nạp lại CHÍNH bytes file người dùng tải lên (`b64` vốn đã giữ sẵn để lưu bản) rồi sửa tại chỗ bằng **`exceljs`** (`src/lib/doiSoatXuat.ts`, nạp động) — `xlsx-js-style` khi ĐỌC chỉ lấy được màu nền, mất font/khung/canh lề nên không round-trip nổi. Luật: **CHỈ THÊM, KHÔNG DỜI** — khối cột đối soát đặt SAU vùng dữ liệu gốc (chừa 1 cột trống), KHÔNG chèn cột vào giữa ⇒ địa chỉ ô gốc giữ nguyên, ô gộp không lệch, công thức trong file không sai tham chiếu. Chỉ ghi đè màu nền dòng + ô người dùng bấm Sửa. "KẾT QUẢ" là cột ĐẦU của khối thêm; vùng autofilter nới sang hết khối. `xuatExcelDoiSoat` (dựng-mới) giữ lại làm ĐƯỜNG LÙI khi không có bytes gốc. Kèm theo: `SheetTho`/`SheetHoaDon`/`SheetPhanMem` mang `ToaDoGoc {r0,c0,giuCot}` + `hIdx` + `rong`; `DongHoaDon`/`DongPhanMem` thêm `dongFile` = **dòng Excel THẬT** (trước đây mọi chuỗi "ô L430 / dòng 428" dùng chỉ số AOA nên lệch đúng bằng r0 — sheet cổng thuế bắt đầu ở A3 ⇒ lệch 2 dòng). `soDong` GIỮ NGUYÊN nghĩa cũ vì là khóa Map `edits` đã lưu trong `reconciliation_runs`. `goCotDoiSoatCu` nay dò cột "KẾT QUẢ" ở BẤT KỲ vị trí nào (bản cũ để ở cột 0) + gỡ luôn cột đệm trống. -->
<!-- re-verified: 2026-09-15 — chạy engine + xuất file trên bộ T6 THẬT (`DANH SÁCH HÓA ĐƠN T6.xlsx`, 4 sheet, 685 HĐ / 422 dòng sổ): (1) so 20.327 ô gốc giữa file vào và file ra — **lệch 0** về giá trị/numFmt/font/khung/canh lề, ô gộp + độ rộng cột + chiều cao dòng y nguyên, công thức trong file còn sống; (2) oracle nhãn với file mẫu "Tháng 6 - đã lọc.xlsx" (bản Claude chat) — **685/685 dòng hóa đơn + 422/422 dòng sổ trùng nhãn**, tổng 392 khớp / 1 lệch / 292 chưa có khớp tuyệt đối; (3) idempotent 3 vòng: số cột đứng yên 37/41/35/26, không đẻ cột, tổng không đổi; (4) thử trong trình duyệt thật: `import("exceljs")` qua Vite ra đúng `Workbook`, ghi được file. -->
<!-- re-verified: 2026-09-15 — nhãn trạng thái (KHOP/LECH/THIEU/CO) + phép tự kiểm (mong/thuc) + kiểu CauNoi/NghiVan/PhepThu trong doiSoatHddt.ts khớp code khi làm lại UI. (task fix UI /doi-soat) -->
<!-- updated: 2026-09-15 — LÀM LẠI UI (KHÔNG đụng logic doiSoatHddt.ts): (1) THẺ TỔNG BẤM ĐƯỢC (drill-down): bấm "Khớp"/"Lệch tiền"/"Chưa vào sổ"/"Dòng sổ kế toán"/"Dòng sổ thiếu hóa đơn"/"Tổng tiền lệch" → nhảy xuống đúng bảng + lọc sẵn; "Cần soát lại" cuộn tới mục nghi vấn. ThongKe (design-system) thêm `onChon`/`moTaChon` (thẻ → <button>); lọc bảng HĐĐT (`locHD`) & sổ (`pmChiThieu`) NÂNG lên state cha, BangHoaDon/BangPhanMem nhận qua props. (2) MICROCOPY bớt jargon: "bút toán"→"dòng sổ kế toán"; "Mong/Thực"→"Đáng lẽ/Thực tế"; "Cầu nối số liệu"→"Kiểm tra tổng số tiền chưa vào sổ"; "Tổng bên PM"→"Tổng trên sổ"; "Chưa có ở PM/PMKT"→"Chưa vào sổ"; "Chưa/Đã có HĐĐT"→"Chưa/Đã có hóa đơn"; "Nghi vấn"→"Chỗ cần soát lại". (3) InfoTip ⓘ giải thích khối Tự kiểm + Cầu nối. (4) BỐ CỤC lại thứ tự: Thẻ tổng → Chỗ cần soát (hành động) → BẢNG DỮ LIỆU (đưa lên trên) → khối "Máy tự kiểm & đối chiếu" GẬP LẠI (Tự kiểm + Cầu nối + Cảnh báo), tự mở khi có phép chưa đạt / có cảnh báo. Nhãn nội bộ (state code, khóa, file xuất Excel) KHÔNG đổi. -->
<!-- updated: 2026-09-14 — v4 LƯU THEO TÀI KHOẢN: màn /doi-soat nay lưu bản NHÁP/CHÍNH THỨC (bảng reconciliation_runs, 0043; hook useReconciliationRuns). Lưu file gốc base64 (file_b64) + options{soChuanTen,edits} + summary (ảnh chụp 4 nhãn+tổng chênh; bản chính thức đóng băng). MỞ LẠI = sheetsTuBase64(file_b64) → doiSoat chạy lại (round-trip đã kiểm: khớp đọc trực tiếp). Riêng-tư-theo-account ép ở TẦNG APP (hook lọc userId===nguoiDung.id, admin xem tất; chưa đăng nhập/localStorage = per-máy). Xóa qua ConfirmDelete + toast Hoàn tác. lib thêm fileSangBase64/sheetsTuBase64. Xem 04-tang-du-lieu + 03-database (0043) + 05-bao-mat (RLS). -->
<!-- re-verified: 2026-09-14 — chạy engine v3 trên 6 file thật T1–T6: T2/T6 khớp §12 tuyệt đối, T3/T4/T5 lệch đúng ±1 dòng (file xuất lại ±1 dòng, không phải lỗi); GẦN KHỚP (T3: 61380754↔613080754) + bỏ mẫu số (1C26TTN) đúng ca spec. -->

<!-- re-verified: 2026-09-14 — đối chiếu code thật doiSoatHddt.ts khi nâng v3: khóa (taoKhoa dùng kyHieuChuan+soHoaDonChuan), chọn sổ "mới" (chuan(ten).includes("moi")), cầu nối/tự kiểm, xuất dựng-mới — khớp. (task engine v3) -->
<!-- updated: 2026-09-14 — v3 (spec ENGINE ĐẦY ĐỦ): chuẩn hóa KÝ HIỆU bỏ chữ số mẫu số gộp đầu (kyHieuChuan: sổ 1C26TTN ↔ HĐ C26TTN, áp cả hai bên qua taoKhoa); GẦN KHỚP (nhóm 3 — dò cùng MST + cùng số tiền ±1đ cho dòng THIẾU hai bên, chú thích `ganKhopMoTa`, KHÔNG đổi bucket đếm); gộp sheet HĐĐT trùng (tập con → laPhu, không cộng đôi — như đã làm cho sheet sổ); GỠ cột đối soát cũ (goCotDoiSoatCu — idempotent, cờ daGoCotCu); 7 nhóm nghi vấn (chèn Gần khớp=3, dồn: thiếu-cả-cụm=4, tổng-xóa=5, cột-phụ=6, sheet-trùng=7); 9 phép tự kiểm (thêm "tổng cột Chênh lệch = phần dư trừ chéo"); ngưỡng KHỚP mặc định 1đ (§5.3, vẫn chỉnh được trên màn); XUẤT FILE MẪU (xuatFileMau — 3 sheet HĐĐT + PMEM + HƯỚNG DẪN, người dùng làm theo format, engine vẫn đọc mọi biến thể). Kiểm code thật: file "pmem mới" T02 ra ĐÚNG spec §12 T2 = 264 khớp/4 lệch/155 chưa, sổ 291/5; tự kiểm 9/9; idempotent (chạy lại trên file đã xuất ra y hệt). CÒN CHỜ file T1,T3–T6 để chạy thật GẦN KHỚP + gộp sheet HĐĐT + strip mẫu số (T2 không có các ca này). -->
<!-- updated: 2026-09-11 — v2 (quy tắc thực chiến 6 tháng): KHÔNG tự sửa dữ liệu (chỉ báo + nút Sửa từng dòng, giữ giá trị cũ, áp trong phiên + vào file xuất qua Map edits); 6 NHÓM NGHI VẤN (1 cộng sai chỉ báo khi CẢ HAI cách lệch · 2 thiếu 1 ô suy được · 3 thiếu cả cụm gộp thống kê · 4 tổng bị xóa gộp · 5 cột phụ trùng tên · 6 sheet trùng lặp); dò cột trùng theo ĐỘ KHỚP với tổng (chonCotDongNhat); CHỌN SỔ CHUẨN khi có nhiều sheet sổ (ưu tiên "mới", subset → sheet phụ không cộng đôi); CẦU NỐI số liệu (2 cách tính = nhau + bóc tách phần dư trừ chéo); KHỐI TỰ KIỂM 8 phép (phép #8 so số nghi vấn với baseline); xuất Excel chuẩn hóa (dựng mới → 0 ẩn, neo A1, nút lọc, nới cột) + sheet NHẬT KÝ SỬA. Nhận CẢ định dạng sổ mã máy (SCT_GHISO/KY_HIEU/SO_HD/RMST/TIENHANG/TIENTHUE/TONGCONG) lẫn nhãn tiếng Việt. Kiểm code thật trên file T02-2026: oracle 268/268; tự kiểm 8/8; §4 chọn pmem mới, PMEM là tập con. -->

# 37 — Đối soát Hóa đơn điện tử ⇄ Phần mềm kế toán (`/doi-soat`)

Công cụ **kế toán** (không phải nghiệp vụ MES). Đối chiếu hóa đơn **mua vào** tải từ cổng thuế với bút toán trên phần mềm kế toán, để bắt hóa đơn thiếu / lệch tiền. **Toàn bộ dữ liệu nằm trong 1 file Excel người dùng upload — KHÔNG đọc DB, KHÔNG qua `repo.ts`.** Vì vậy tier 🟢 GREEN.

## Vào/ra

- **Vào:** 1 workbook `.xlsx` gồm:
  - **3 sheet hóa đơn điện tử** (cổng thuế): `CÓ MÃ HDDT`, `MÁY TÍNH TIỀN HDDT`, `KHÔNG MÃ HDDT`. Vị trí cột KHÁC nhau giữa 3 sheet (máy tính tiền có thêm "Địa chỉ người bán"/"CCCD", không mã có "Đơn vị tiền tệ"/"Tỷ giá" cho hóa đơn USD) ⇒ **dò cột theo TÊN tiêu đề, không hardcode chỉ số**. Tiêu đề nằm ở hàng ~6.
  - **1 sheet `PHẦN MỀM`:** bút toán kế toán, tiêu đề ở hàng 1. Một hóa đơn có thể bị tách nhiều dòng theo thuế suất.
- **Ra:** (1) bảng đối soát trên màn (tab theo từng sheet + tab "Phần mềm kế toán"), (2) nút **Tải Excel kết quả** — trả về **chính file đã tải lên, giữ nguyên định dạng**, thêm cột `KẾT QUẢ` ở đầu + khối cột phân tích ở cuối + 3 sheet tổng hợp lên đầu workbook, đúng bố cục file mẫu kế toán đang dùng (xem [v5.1](#v51--bố-cục-bám-đúng-file-mẫu-kế-toán)).

## Khóa & so tiền (logic ở `lib/doiSoatHddt.ts`)

- **Khóa đối chiếu** = `MST người bán | Ký hiệu hóa đơn | Số HĐ chuẩn` (chuẩn hóa: bỏ dấu, thường, gộp khoảng trắng). **Số HĐ chuẩn** = bỏ số 0 ở đầu (`00060568` → `60568`) vì phần mềm pad 0 còn cổng thuế thì không (`soHoaDonChuan`).
- **Quy về VND:** hóa đơn USD nhân `Tỷ giá` (`Tỷ giá áp dụng`). Số VND để nguyên (tỷ giá 1).
- **Gộp theo khóa** cả 2 bên rồi so **tổng** (`Số dòng khớp PMKT` = số bút toán, `Tổng TT bên PMKT` = tổng `Tổng cộng`). Đây là lý do phải cộng dồn: 1 hóa đơn ↔ nhiều dòng thuế.
- **Ngưỡng khớp** (`nguong`, mặc định **1.000đ**, chỉnh trên màn): `|chênh| ≤ ngưỡng` ⇒ vẫn **KHỚP** (nuốt sai số làm tròn tỷ giá). Chênh tính theo **HĐĐT − phần mềm**.

## Nhãn kết quả

| Chiều | Nhãn | Nghĩa | Màu (chip StatusChip / nền Excel) |
|---|---|---|---|
| HĐĐT → PM | `KHOP` | có ở PM, chênh ≤ ngưỡng | xanh (`running` / `C6EFCE`) |
| HĐĐT → PM | `LECH` | có ở PM, chênh > ngưỡng | vàng (`idle` / `FFEB9C`) |
| HĐĐT → PM | `THIEU` | không thấy ở PM | đỏ (`stopped` / `FFC7CE`) |
| PM → HĐĐT | `CO` | có hóa đơn điện tử khớp | xanh |
| PM → HĐĐT | `THIEU` | không thấy hóa đơn điện tử | đỏ |

Màu chip lấy **token** `--status-*` (không viết mã màu tay); màu nền Excel là mã màu chuẩn Excel (file ngoài, độc lập token app). Mỗi dòng có cột **"Bằng chứng đối chiếu"** dạng văn xuôi (khớp phiếu nào, ngày, CTGS, TK, số tiền).

## v5.1 — bố cục bám đúng FILE MẪU kế toán

Kế toán đối soát bằng một file mẫu có sẵn. "Giữ nguyên định dạng" (v5) chưa đủ —
bố cục phải giống luôn, nếu không họ vẫn phải mò. Ba điểm bắt buộc:

| Điểm | Phải làm |
|---|---|
| Cột **KẾT QUẢ** | chèn làm **cột A**, dữ liệu gốc dời sang phải 1 cột |
| **3 sheet tổng hợp** | `ĐỐI CHIẾU TỔNG` · `TỰ KIỂM TRA` · `NGHI VẤN SỐ LIỆU` đứng **đầu** workbook |
| Tên cột | gọi theo tên sheet sổ thật ("Số dòng khớp PMEM"), cặp cột TK lấy tiêu đề nguồn |

**Chèn cột thì BẮT BUỘC dịch công thức** (`doiSoatXuatShift.ts`). File cổng thuế có
công thức sống (`=SUM(K7:K462)`, `='T6-KMA'!K144`); chỉ dời ô mà không dịch ruột công
thức là **số sai âm thầm** — nguy hiểm hơn hẳn việc sai định dạng. Bộ dịch đi từng ký
tự, chừa chuỗi trong nháy kép (`"KHỚP"`), tên sheet trong nháy đơn, tên hàm; xử được
`$A$1`, `A:A`, và ref chéo sheet (chỉ dịch khi sheet đích cũng bị chèn cột).

Ba cái bẫy đã vấp, đừng vấp lại:

1. **Công thức dùng chung** (shared formula) không chịu được việc dời ô — `exceljs` ném
   *"Shared Formula master must exist above and or left of clone"*. Phải `boCongThucDungChung`
   (tách mỗi ô thành công thức riêng) TRƯỚC mọi thao tác thêm/bớt cột.
2. **Gỡ ô gộp phải làm TRƯỚC khi dời cột.** Gỡ sau thì vùng gộp cũ đã lệch chỗ, `exceljs`
   xóa luôn giá trị ô đã dời sang (tiêu đề "DANH SÁCH HÓA ĐƠN" biến mất).
3. **Chạy lại trên file đã xuất**: engine gỡ cột cũ khỏi *dữ liệu đọc vào* nhưng file vẫn
   còn cột *vật lý* ⇒ phải `xoaCotDuoi` khối cũ trước; và nếu cột A đã là "KẾT QUẢ" thì
   **ghi đè, KHÔNG chèn thêm** — nếu không mỗi lần xuất lại đẻ thêm một cột.

## v5 — nền: xuất file GIỮ NGUYÊN ĐỊNH DẠNG GỐC

Bản trước dựng workbook MỚI từ giá trị ⇒ font, khung, định dạng số kế toán, ô gộp,
độ rộng cột của file cổng thuế bay hết. Kế toán mở ra thấy một file lạ, không đặt
cạnh bản gốc mà soi được — đúng thứ người dùng kêu.

**Cách làm bây giờ** (`src/lib/doiSoatXuat.ts` — `xuatExcelGiuDinhDang`):

1. Nạp lại **chính bytes file người dùng tải lên** (`b64`, vốn đã giữ sẵn để lưu bản
   vào `reconciliation_runs`) bằng **`exceljs`**. Phải đổi thư viện: `xlsx-js-style`
   khi ĐỌC chỉ dựng lại được màu nền, mất font/khung/canh lề ⇒ ghi ra là mất.
   `exceljs` nạp **động**, nằm chunk riêng (~930 KB), chỉ tải khi bấm xuất.
2. **CHỈ THÊM, KHÔNG DỜI.** Khối cột đối soát đặt **sau** vùng dữ liệu gốc, chừa
   1 cột trống ngăn cách. Không chèn cột vào giữa — vì chèn sẽ đẩy ô gộp lệch và
   nhất là làm **công thức trong file sai tham chiếu** (`=SUM(K7:K469)` bị đẩy sang
   cột L mà ruột vẫn trỏ K). Hệ quả tốt: địa chỉ mọi ô gốc y nguyên nên chuỗi
   "ô K430" trên màn trỏ đúng ô ở **cả file vào lẫn file ra**.
3. Chỉ ghi đè đúng hai thứ: **màu nền dòng** (xanh khớp / vàng lệch / đỏ thiếu) và
   **ô người dùng bấm Sửa** (tô vàng đậm). Font, khung, canh lề, định dạng số của
   ô gốc không đụng tới.
4. `"KẾT QUẢ"` là cột **đầu** khối thêm; vùng autofilter sẵn có được **nới** sang hết
   khối (giữ nguyên ô bắt đầu) để lọc được theo nhãn. Sheet `NHẬT KÝ SỬA` thêm ở cuối.
5. Không có bytes gốc (bản lưu cũ hỏng, thư viện nạp hụt) → **lùi** về
   `xuatExcelDoiSoat` dựng-mới + báo toast cho người dùng biết.

**Tọa độ**: `sheet_to_json` bắt đầu từ ô đầu vùng dữ liệu (sheet cổng thuế hay bắt đầu
ở A3) và `goCotDoiSoatCu` còn bỏ bớt cột ⇒ chỉ số trong mảng AOA **không** phải dòng/cột
Excel. `ToaDoGoc {r0, c0, giuCot}` gắn trên mỗi sheet lo việc quy đổi; mỗi dòng mang sẵn
`dongFile` = dòng Excel thật, dùng cho **mọi chuỗi hiển thị**. `soDong` (chỉ số AOA + 1)
**giữ nguyên nghĩa cũ** vì nó là khóa của Map `edits` đã lưu trong `reconciliation_runs` —
đổi là hỏng phần Sửa của các bản đã lưu.

> ⚠️ Sửa `doiSoatXuat.ts` xong phải chạy lại 3 cổng: (a) so từng ô gốc file vào ↔ file ra
> phải **lệch 0**; (b) oracle nhãn với file mẫu "… đã lọc"; (c) xuất **3 vòng** liên tiếp,
> số cột phải đứng yên (không đẻ cột).

## Ba thư viện Excel — cái nào làm gì

| Dep | Dùng ở đâu | Vì sao |
|---|---|---|
| `xlsx-js-style` | **đọc** dữ liệu vào engine (`docSheetsTuBuffer`) + `xuatFileMau` + `xuatExcelDoiSoat` (đường lùi) | SheetJS free ghi được ô có màu; đọc thì nhanh, hợp với việc chỉ cần GIÁ TRỊ |
| `exceljs` | **xuất bản chính** (`doiSoatXuat.ts`) | thư viện duy nhất trong hai cái đọc-ghi giữ được font / khung / canh lề / numFmt / ô gộp / công thức — điều kiện bắt buộc để không đổi định dạng file gốc |
| `xlsx` | không dùng trực tiếp | (đi kèm theo dep khác) |

⚠️ **Đừng thay `exceljs` bằng `xlsx-js-style` cho việc xuất.** Reader của `xlsx-js-style`
chỉ dựng lại được màu nền; ghi ra là font Times New Roman, khung kẻ, định dạng số kế toán
của file cổng thuế biến mất sạch — chính cái lỗi v5 đi sửa.

Chunk `/doi-soat` nặng (~920KB) và `exceljs` (~930KB) đều **lazy-load riêng**: `/doi-soat`
tải khi mở màn, `exceljs` chỉ tải khi bấm nút xuất.

## Cạm bẫy / đã kiểm

- Dòng PHẦN MỀM **không có** số HĐ/ký hiệu (bút toán nội bộ) → bỏ qua, không đối soát.
- Cặp **bút toán đảo** (một dòng dương + một dòng âm cùng số tiền) của hóa đơn không nằm trong file → gắn `CHƯA CÓ HĐĐT` (nêu ra để kế toán soát).
- Đã đối chiếu code THẬT với file mẫu "đã lọc" (tháng 02/2026): **423/423 dòng hóa đơn trùng nhãn** ở ngưỡng ≤10đ; xuất Excel đúng cấu trúc cột + màu. (Ở ngưỡng mặc định 1.000đ, 2 hóa đơn USD chênh 21–58đ được coi khớp thay vì lệch — đúng thiết kế núm ngưỡng.)

## v2 — quy tắc thực chiến (rút từ 6 tháng số liệu)

- **KHÔNG tự sửa dữ liệu.** Nghi sai chỉ được BÁO; người dùng bấm **Sửa** từng dòng → áp trong phiên (Map `edits` key `sheet#dòng#cột`) + vào file xuất; giá trị cũ giữ ở sheet **NHẬT KÝ SỬA**. Không suy được số đúng → "chưa xác định", không nút Sửa.
- **6 nhóm nghi vấn** (`nghiVanCong`): 1 cộng sai (chỉ báo khi **cả hai** cách `a+b` và `a+b−ck+phí` đều lệch), 2 thiếu 1 ô suy được (per-dòng, có Sửa), 3 thiếu cả cụm (gộp thống kê), 4 tổng bị xóa (gộp, có Sửa từng dòng), 5 cột phụ trùng tên (không tham gia đối soát), 6 sheet trùng lặp. Mỗi nghi vấn đủ 6 câu hỏi (vị trí có chữ cái cột + tên · số đang có · đối chứng · nguồn · sai ở đâu · ảnh hưởng).
- **Dò cột trùng tên** (`chonCotDongNhat`): thử mọi tổ hợp ứng viên (chưa thuế/thuế/tổng), chọn tổ hợp khớp `chưa+thuế(−ck+phí)=tổng` nhất; cột còn lại → nhóm 5.
- **Nhiều sheet sổ** (§4): ưu tiên sheet tên chứa "mới" làm CHUẨN; không phân biệt được → `canChonSo=true`, người dùng chọn trên màn. Sheet là **tập con** của sổ chuẩn → `laPhu` (tra cứu, KHÔNG cộng vào tổng, tránh đếm đôi).
- **Cầu nối** (`cauNoi`): "phần chưa có bên sổ" = Tổng file − khớp(file) − lệch(file) (cách A) = tổng trực tiếp nhóm THIẾU (cách B), chênh A−B phải 0. Phần dư khi trừ chéo file−sổ **KHÔNG phải giao dịch sót** — bóc tách về từng hóa đơn (`bocTach`).
- **Tự kiểm 8 phép** (`phepThu`): mỗi phép kèm "bắt lỗi gì". Phép #8 so số nghi vấn hiện tại với **baseline lần chạy đầu** (`nghiVanBanDau`) → sửa xong 1 lỗi thì báo lệch ngay.
- ~~**Xuất Excel §7**: dựng workbook MỚI từ giá trị~~ → **thay ở v5** (mục dưới): dựng-mới làm mất font/khung/định dạng số của file cổng thuế, kế toán không soi song song với bản gốc được. `xuatExcelDoiSoat` vẫn còn nhưng chỉ là **đường lùi** khi thiếu bytes file gốc.
- **Hai định dạng cột sổ**: nhãn tiếng Việt (`CTGS·KHHĐ·Số HĐ·MASOTHUE·ST chưa thuế·Tiền thuế·Tổng cộng`) và mã máy (`SCT_GHISO·KY_HIEU·SO_HD·RMST·TIENHANG·TIENTHUE·TONGCONG`). Dò sổ neo `so hd`+`tổng cộng` (HĐĐT không có) để không nhận nhầm.

## v3 — engine đầy đủ (spec sau 6 tháng chạy thật)

- **Chuẩn hóa khóa mạnh hơn** (`taoKhoa`): số HĐ bỏ số 0 đầu (`soHoaDonChuan`) + **ký hiệu bỏ chữ số mẫu số gộp đầu** (`kyHieuChuan`: sổ `1C26TTN` ↔ cổng thuế `C26TTN`; ký hiệu thật luôn bắt đầu bằng chữ cái nên cắt số đầu an toàn). MST giữ nguyên đuôi chi nhánh; MST bắt buộc trong khóa.
- **GẦN KHỚP** (nhóm 3): dòng THIẾU ở CẢ HAI bên, **cùng MST + cùng số tiền ±1đ** → ghép 1-1 (greedy), gắn `ganKhopMoTa` vào cả hai + đẩy nghi vấn nhóm 3. KHÔNG tạo nhãn/bucket đếm mới — vẫn là THIẾU, chỉ thêm gợi ý (giữ 4 nhãn: Khớp/Lệch/Chưa kê + sổ Có/Không như spec §12).
- **Gộp sheet HĐĐT trùng** (`laPhu` trên `SheetHoaDon`): sheet có tập khóa là TẬP CON của sheet khác → không vào tổng (dùng `hdActive = sheetsHoaDon.filter(!laPhu)` cho ghép/đếm/cầu nối), nghi vấn nhóm 7. (Trước đây chỉ làm cho sheet sổ.)
- **Idempotent** (`goCotDoiSoatCu`): file đã xử lý lần trước (có cột `KẾT QUẢ` + cột phân tích) → tự gỡ cột đó trước khi chạy, cờ `daGoCotCu` (màn hiện chú thích). Chỉ bỏ CỘT, giữ số dòng.
- **9 phép tự kiểm** (thêm "tổng cột Chênh lệch = phần dư trừ chéo").
- **Ngưỡng KHỚP mặc định 1đ** (spec §5.3) — vẫn có ô chỉnh trên màn.
- **Xuất file mẫu** (`xuatFileMau`): 3 sheet HĐĐT (tiêu đề hàng 6) + PMEM (mã máy) + HƯỚNG DẪN, kèm dòng ví dụ. Engine vẫn đọc mọi biến thể tên sheet/cột — file mẫu chỉ để đỡ sai định dạng.
- **Locale**: `soVN` tự suy dấu thập phân theo dấu cuối, lỗi → null (không mặc định 0/1).

> ⚠️ **Verify**: mới chạy thật trên **T02** (khớp spec §12 T2 = 264/4/155, sổ 291/5; tự kiểm 9/9; idempotent). GẦN KHỚP, strip mẫu số, gộp sheet HĐĐT trùng CHƯA có dữ liệu thật để chạy (T2 không dính) — cần file T1/T3–T6 để đóng bộ hồi quy §12.

## v4 — lưu & mở lại theo tài khoản

Trước đây module chỉ import → xử lý → tải về (file-only). v4 cho **lưu bản đối soát theo TÀI KHOẢN** để xem lại/đối chiếu:

- **Bảng `reconciliation_runs`** (0043) + hook `useReconciliationRuns()` (khuôn `useBang` — chạy cả Supabase lẫn localStorage). Lưu: `file_b64` (file Excel gốc base64), `options` {soChuanTen, edits}, `summary` (ảnh chụp 4 nhãn + tổng chênh), `status` 'draft'|'official', `user_id`/owner.
- **Lưu file gốc BASE64 trong bảng** (không dùng Storage): nằm dưới RLS của bảng (tránh cấu hình ACL Storage theo user — nguồn rò rỉ), và lưu được cả khi offline. File xlsx ~150–420KB base64/bản.
- **Mở lại** = `sheetsTuBase64(file_b64)` → `doiSoat` chạy lại với `threshold`+`edits`+`soChuanTen` đã lưu (round-trip đã kiểm: khớp đọc trực tiếp). **Chính thức** đóng băng `summary` (đối chiếu về sau); mở lại vẫn recompute từ file.
- **Riêng tư theo account ép ở TẦNG APP**: hook lọc `userId === nguoiDung.id` (admin xem tất); chưa đăng nhập / chế độ localStorage ⇒ per-máy. RLS server siết `user_id=auth.uid()` để nhánh 0021 (câu sẵn trong 0043). Xóa qua `ConfirmDelete` + toast Hoàn tác.
- UI: ô "Tên bản" + nút **Lưu nháp** / **Lưu chính thức** (khi có kết quả); card **"Bản đã lưu"** (RecordTable, luôn hiện) với Mở lại / Tải Excel / Xóa. lib thêm `fileSangBase64` / `sheetsTuBase64`.

## Không thuộc phạm vi (để sau nếu cần)

Sửa/ghi ngược vào phần mềm; đối soát hóa đơn **bán ra**; gộp nhiều file (đang chỉ 1 workbook); đóng băng khung nhìn khi xuất (thư viện không hỗ trợ ghi); siết RLS server theo user (đang ép ở tầng app, chờ nhánh 0021).
