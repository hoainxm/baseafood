> Load khi: sửa màn `/doi-soat`, logic đối soát hóa đơn điện tử ⇄ phần mềm kế toán, đọc/ghi file Excel hóa đơn.
covers: src/features/doi-soat/DoiSoatScreen.tsx, src/features/doi-soat/index.ts, src/lib/doiSoatHddt.ts
last_verified: 2026-09-11
ttl_days: 90
<!-- updated: 2026-09-11 — v2 (quy tắc thực chiến 6 tháng): KHÔNG tự sửa dữ liệu (chỉ báo + nút Sửa từng dòng, giữ giá trị cũ, áp trong phiên + vào file xuất qua Map edits); 6 NHÓM NGHI VẤN (1 cộng sai chỉ báo khi CẢ HAI cách lệch · 2 thiếu 1 ô suy được · 3 thiếu cả cụm gộp thống kê · 4 tổng bị xóa gộp · 5 cột phụ trùng tên · 6 sheet trùng lặp); dò cột trùng theo ĐỘ KHỚP với tổng (chonCotDongNhat); CHỌN SỔ CHUẨN khi có nhiều sheet sổ (ưu tiên "mới", subset → sheet phụ không cộng đôi); CẦU NỐI số liệu (2 cách tính = nhau + bóc tách phần dư trừ chéo); KHỐI TỰ KIỂM 8 phép (phép #8 so số nghi vấn với baseline); xuất Excel chuẩn hóa (dựng mới → 0 ẩn, neo A1, nút lọc, nới cột) + sheet NHẬT KÝ SỬA. Nhận CẢ định dạng sổ mã máy (SCT_GHISO/KY_HIEU/SO_HD/RMST/TIENHANG/TIENTHUE/TONGCONG) lẫn nhãn tiếng Việt. Kiểm code thật trên file T02-2026: oracle 268/268; tự kiểm 8/8; §4 chọn pmem mới, PMEM là tập con. -->

# 37 — Đối soát Hóa đơn điện tử ⇄ Phần mềm kế toán (`/doi-soat`)

Công cụ **kế toán** (không phải nghiệp vụ MES). Đối chiếu hóa đơn **mua vào** tải từ cổng thuế với bút toán trên phần mềm kế toán, để bắt hóa đơn thiếu / lệch tiền. **Toàn bộ dữ liệu nằm trong 1 file Excel người dùng upload — KHÔNG đọc DB, KHÔNG qua `repo.ts`.** Vì vậy tier 🟢 GREEN.

## Vào/ra

- **Vào:** 1 workbook `.xlsx` gồm:
  - **3 sheet hóa đơn điện tử** (cổng thuế): `CÓ MÃ HDDT`, `MÁY TÍNH TIỀN HDDT`, `KHÔNG MÃ HDDT`. Vị trí cột KHÁC nhau giữa 3 sheet (máy tính tiền có thêm "Địa chỉ người bán"/"CCCD", không mã có "Đơn vị tiền tệ"/"Tỷ giá" cho hóa đơn USD) ⇒ **dò cột theo TÊN tiêu đề, không hardcode chỉ số**. Tiêu đề nằm ở hàng ~6.
  - **1 sheet `PHẦN MỀM`:** bút toán kế toán, tiêu đề ở hàng 1. Một hóa đơn có thể bị tách nhiều dòng theo thuế suất.
- **Ra:** (1) bảng đối soát trên màn (tab theo từng sheet + tab "Phần mềm kế toán"), (2) nút **Tải Excel kết quả** — xuất lại workbook tô màu + cột phân tích (giống file mẫu "… đã lọc").

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

## Ghi Excel có màu

`xlsx` (SheetJS bản free) đọc được nhưng **không ghi được màu ô** ⇒ thêm dep **`xlsx-js-style`** (drop-in, dùng cho cả đọc lẫn ghi trong module này). Chunk `/doi-soat` nặng (~880KB) nhưng **lazy-load riêng**, chỉ tải khi mở màn.

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
- **Xuất Excel §7**: dựng workbook MỚI từ giá trị (không copy nguồn) ⇒ tự sạch dòng/cột ẩn, bộ lọc lưu sẵn, ô góc khung nhìn; thêm nút lọc (autofilter, không ẩn dòng), neo A1, nới cột hẹp, màu cứng. (Freeze panes không ghi được qua `xlsx-js-style` — chấp nhận, nguồn cũng không dính freeze.)
- **Hai định dạng cột sổ**: nhãn tiếng Việt (`CTGS·KHHĐ·Số HĐ·MASOTHUE·ST chưa thuế·Tiền thuế·Tổng cộng`) và mã máy (`SCT_GHISO·KY_HIEU·SO_HD·RMST·TIENHANG·TIENTHUE·TONGCONG`). Dò sổ neo `so hd`+`tổng cộng` (HĐĐT không có) để không nhận nhầm.

## Không thuộc phạm vi (để sau nếu cần)

Sửa/ghi ngược vào phần mềm; lưu lịch sử các lần đối soát (chưa có bảng); đối soát hóa đơn **bán ra**; gộp nhiều file (đang chỉ 1 workbook).
