> Load khi: sửa màn `/doi-soat`, logic đối soát hóa đơn điện tử ⇄ phần mềm kế toán, đọc/ghi file Excel hóa đơn.
covers: src/features/doi-soat/DoiSoatScreen.tsx, src/features/doi-soat/index.ts, src/lib/doiSoatHddt.ts, src/lib/doiSoatHaiBan.ts, src/lib/doiSoatXuat.ts, src/lib/doiSoatXuatShift.ts, src/lib/doiSoatXuatTongHop.ts
last_verified: 2026-09-22
ttl_days: 90
<!-- re-verified: 2026-09-22 14:00 — claims checked vs code: khóa `MST|kýhiệu chuẩn|số chuẩn` (taoKhoa), gộp theo khóa + so tổng, ×tỷ giá cho ngoại tệ (doiSoatHddt.ts:1075-1144). Khớp code. -->
<!-- updated: 2026-09-22 — v6.6 TỰ DÒ QUY ƯỚC NGOẠI TỆ (`phatHienQuyUocNgoaiTe`, gọi trong `doiSoat` sau khi gom khóa 2 bên, trước vòng ghép). BUG chủ dự án báo: file "SO SÁNH GHDON DTU VÀ PMEM" tổng trước thuế ra 41.919 tỷ (~42 NGHÌN tỷ) trong khi thật ~297 tỷ; nguyên nhân: bản xuất DTU này để tiền hóa đơn USD/JPY (271+18 dòng) ĐÃ quy sẵn VND, engine cũ vẫn `× Tỷ giá` (~26.000) → mỗi HĐ phình gấp ~26.000 lần (phí ngân hàng 143k đ thành 3,7 tỷ). CHỮA: `DongHoaDon` thêm `chuaThueRaw/thueRaw/tongTtRaw`; engine đối chiếu HĐ ngoại tệ đã khớp sổ (VND) — số gốc sát sổ hơn ⇒ hạ tỷ giá áp dụng về 1. KIỂM THẬT trên file gốc: 190 HĐ ngoại tệ khớp sổ → 190/190 có số GỐC = số sổ (vd raw 143.446 = sổ 143.445), 0 dòng sát khi ×tỷ giá ⇒ tự chọn "đã VND" chuẩn xác; 190 HĐ này trước bị gắn LỆCH TIỀN nay thành KHỚP; tổng A về ~297-300 tỷ. Convention NGƯỢC LẠI (nguyên tệ, số nhỏ) như file mẫu 02/2026 (dòng re-verified 2026-09-16 + ghi chú cuối doc "2 HĐ USD chênh 21-58đ") vẫn ×tỷ giá đúng vì saiNhan < saiGoc. build + lint xanh. -->
<!-- CROSS-PLATFORM: chuyển file .xlsx Windows↔Mac KHÔNG đổi giá trị số trong ô — lỗi đội số là logic ×tỷ giá, không phải do đổi máy. Đối soát trên Mac gửi lại Windows an toàn (chỉ lưu ý dấu tiếng Việt trong TÊN file). -->
<!-- updated: 2026-09-21 — TÊN FILE KẾT QUẢ KHÔNG TRÙNG: `tenFileKetQua` (doiSoatHddt.ts) = tên gốc + " - đã đối soát " + yyyymmdd-HHmm; bỏ đuôi "- đã đối soát/đã dò lệch …" cũ nếu file vào là file đã xuất. Màn `/doi-soat` dùng hàm này cho cả hai đường xuất. Lý do: tên cố định ⇒ bản sau trùng bản trước, mở nhầm bản cũ (chủ dự án phản ánh). -->
<!-- updated: 2026-09-21 — v6.5 DỄ HIỂU CHO KẾ TOÁN (chủ dự án review file v6.4: "xem không hiểu, không biết chỗ nào lệch, ô hay dòng nào"). (1) File KHÔNG có sổ ⇒ KHÔNG chèn cột A: mọi ô giữ đúng địa chỉ của kế toán (Q3049 vẫn là Q3049); khối 3 cột kiểm nối cuối; CHỈ tô dòng có lệch (đỏ sai thật / vàng phí·chiết khấu·làm tròn), dòng khớp để nguyên. File xuất từ bản cũ có cột A "KIỂM CỘNG" thì GỠ ra (`chenCotDau` nhận dịch âm). (2) Engine nhận ra Ô LỆCH KẾ TOÁN TỰ ĐẶT cuối sheet (`CanDoiCot.oTuDat`, `timOTuDat`: so giá trị ô với cộng trần / đã cộng phí / đã trừ chiết khấu; loại ô trùng tổng một cột). (3) `CanDoiCot.dongLech` = mọi dòng lệch kèm số thô từng ô. (4) KẾT LUẬN CHUNG viết lại: câu trả lời nói bằng ô của kế toán ("Ô Q3049 = 9.268.400 đ: do 1 hóa đơn ghi sai tiền ở dòng 1685…"), khối DÒ LỆCH mỗi sheet gồm bảng các phần CỘNG LẠI ĐÚNG BẰNG ô đó, bảng DÒNG PHẢI SỬA ghi rõ ô nào + số đúng theo hai giả thiết, bảng DÒNG LỆCH BÌNH THƯỜNG để cộng lại cho đủ; mọi dòng là link tới đúng ô. 8 cột, ô gộp tự đặt chiều cao. Bỏ bảng xoay CỘNG CỘT. (5) `ghiKhoiDoiSoat` nhận `dichCot` thật — sửa lỗi cũ ô "Sửa" ghi lệch 1 cột khi xuất lại file đã xuất. -->
<!-- re-verified: 2026-09-21 14:00 — audit /fl: build exit 0 + lint 0 error (chỉ warning, KHÔNG ở doi-soat); route /doi-soat lazy đăng ký (App.tsx:194) + nav (AppShell.tsx:104). Symbol khớp code: doiSoat/soHoaDonChuan/kyHieuChuan/taoKhoa/chonCotDongNhat/goCotDoiSoatCu/timOTuDat/SHEET_TU_DUNG/THEM_NORM/HEADER_KIEM/tenFileKetQua (doiSoatHddt.ts), soHaiBanHddt/gomCungMstCungNgay/laBenThue (doiSoatHaiBan.ts), xuatExcelGiuDinhDang (doiSoatXuat.ts), themSheetTongHop (doiSoatXuatTongHop.ts), dichCongThuc/chenCotDau/xoaCotDuoi (doiSoatXuatShift.ts). SỬA DRIFT: v6 mục 3-4 (doTronBoCuc/docTrangThaiHd/docTienTe/boCucLech) nằm ở doiSoatHddt.ts CHỨ KHÔNG phải doiSoatHaiBan.ts như prose cũ ngụ ý (covers: đã đúng). RLS reconciliation_runs (0043) = using(true) — mở, riêng-tư app-layer, siết server còn treo (backlog). Hai chiều so-hai-bản + cùng-MST-cùng-ngày CHỈ xuất ra sheet Excel, KHÔNG hiện trên màn. -->
<!-- re-verified: 2026-09-21 — "(1).xls": Q3049 = Q3046−Q3048 = 9.268.400 giữ nguyên địa chỉ; KẾT LUẬN bóc 9.360.068 (dòng 1685) − 91.666 (dòng 2153) − 2 (26 dòng) = 9.268.400 khớp; dòng 1685 ghi "ô chưa thuế M1685 phải là 12.540.868"; MTT "Khớp" (trước nhận nhầm ô SUM P511). Hồi quy 5 file × 3 vòng: tổng + 9/9 + cân đối cột trùng bản gốc (HDONDT nay 3 vòng đều 370 nghi vấn — bản cũ trôi 370→369 khi xuất lại); số sheet/cột đứng yên; file có sổ sheet gốc y hệt bản trước từng ô; file không sổ ô gốc vào↔ra 0 lệch ở ĐÚNG địa chỉ cũ. Xuất lại file v6.4 (có cột A) ⇒ cột A được gỡ, Q3049 trở về. -->
<!-- updated: 2026-09-21 — v6.4 BỚT SHEET, MỘT CHỖ TRẢ LỜI (chủ dự án: "tạo quá nhiều sheet nhưng không xác định được trọng tâm"). (1) Sheet `KẾT LUẬN CHUNG` luôn đứng đầu, gộp 3 sheet cũ `ĐỐI CHIẾU TỔNG` + `TỰ KIỂM TRA` + `NGHI VẤN SỐ LIỆU` thành khối: bảng TRẢ LỜI (việc đã kiểm · kết luận · XEM Ở ĐÂU là link `HYPERLINK("#'Sheet'!A1")` · phải làm gì) → SỐ LIỆU ĐỐI CHIẾU VỚI SỔ (chỉ khi có sổ) → CỘNG CỘT (bảng xoay, mỗi sheet một cột) → CHỖ CẦN SOÁT LẠI (chỉ khi có) → TỰ KIỂM TRA cuối. (2) Sheet danh sách CHỈ dựng khi có dữ liệu: `HÓA ĐƠN CHƯA KÊ` (có sổ + có dòng thiếu một trong hai chiều) · `SO HAI BẢN HĐĐT` · `CÙNG MST CÙNG NGÀY` (xếp SAU sheet gốc — tham khảo, không phải kết quả). (3) Danh sách từng hóa đơn lệch cộng KHÔNG chép ra nữa — chỉ đường lọc cột "Nguyên nhân lệch"/cột A ngay trên sheet gốc (v6.3). (4) Câu trả lời cộng cột bóc từng sheet ra CẢ HAI con số kế toán có thể đang nhìn ở dòng tổng tự đặt (cộng trần / đã cộng phí). (5) `SHEET_TU_DUNG` (doiSoatHddt.ts) = tên sheet tự dựng mới + cũ: engine BỎ QUA khi đọc lại file đã xuất, lớp xuất XÓA rồi dựng lại ⇒ idempotent. (6) `gomCungMstCungNgay` không đếm một hóa đơn hai lần khi file có hai bản (cùng khóa, khác bên). (7) Cảnh báo lặp ý với bảng trả lời bị lọc: "không cần vào sổ" (đã ở dòng chưa kê), "thiếu sổ" khi không sổ, "trùng khóa" chỉ vì mỗi bản có một lần. -->
<!-- re-verified: 2026-09-21 — hồi quy 5 file thật × 3 vòng xuất lại: tổng đối soát + tự kiểm 9/9 + cân đối cột TRÙNG KHÍT bản v6.3 (15/15 JSON); số sheet/cột đứng yên qua 3 vòng; sheet gốc so với bản v6.3 từng ô (cả công thức) 0 lệch (T6 34.926 · T8 38.736 · HDONDT 133.461 · đang làm 195.009 · (1) 73.373 ô); ô gốc vào↔ra 0 lệch trừ "đang làm.xls" 6.675 ô (ngày thêm <1 phút + chuỗi rỗng thành trống — có sẵn từ bước đổi .xls, bản v6.3 y vậy). File "(1).xls": ô R3049 (Q3049 gốc) vẫn = 9.268.400; bảng trả lời nói đúng 9.268.400 = lệch thật 9.360.068 (HDDT dòng 1685) + chiết khấu −91.666 + làm tròn −2. Sheet tổng hợp: T6 5→3 · T8 5→3 · HDONDT 5→3 · đang làm 5→3 · (1) 4→2. -->
<!-- updated: 2026-09-21 — v6.3 DÒ NGAY TRONG SHEET, KHÔNG ĐỔI SỐ LIỆU (yêu cầu kế toán). (1) `DongHoaDon.lechCong` = kết quả kiểm "chưa thuế + thuế = tổng thanh toán" của CHÍNH dòng đó (null = khớp) + `CanDoiCot.cotChua/cotThue/cotTong` để dựng công thức. (2) File xuất thêm 3 cột `HEADER_KIEM` ("Chưa thuế + Thuế" · "Lệch với tổng thanh toán" · "Nguyên nhân lệch") NGAY TRONG sheet bảng kê, hai cột đầu là CÔNG THỨC SỐNG trỏ thẳng ô gốc (`N{r}+O{r}`, `R{r}-(N{r}+O{r})`) — bấm vào ô là thấy số được TÍNH ra, bằng chứng không sửa số của thuế. `ghiKhoiDoiSoat` nhận ô kiểu `{ct}` để ghi công thức (exceljs tự thêm dấu "=", đừng viết sẵn). (3) CHẾ ĐỘ KIỂM BẢNG KÊ khi file KHÔNG có sheet sổ: cột A đổi nhãn "KIỂM CỘNG" và mang kết quả kiểm cộng, màu dòng theo kiểm cộng (đỏ = lệch thật, vàng = phí/chiết khấu/làm tròn, xanh = khớp), khối thêm CHỈ 3 cột kiểm — thay vì 17 cột đối soát-với-sổ rỗng không. (4) File CÓ sổ: 3 cột kiểm nối ở CUỐI khối, giữ nguyên 38 cột đầu theo bố cục file mẫu kế toán. (5) `THEM_NORM` + nhận diện hàng tiêu đề nhận thêm `HEADER_KIEM` và nhãn cột A "KIỂM CỘNG" để xuất lại KHÔNG đẻ cột. -->
<!-- re-verified: 2026-09-21 — file thuế "(1).xls": cột A đánh dấu 3007 khớp · 35 bình thường (phí/chiết khấu/làm tròn) · 1 LỆCH THẬT (HDDT dòng 1685); MTT 508 khớp, 0 lệch. Công thức ghi ra đúng `N3+O3` / `R3-(N3+O3)`. KHÔNG ĐỔI SỐ LIỆU: so 73.755 ô gốc giữa file vào và file ra — 0 ô lệch (ô MTT!Q514 vốn đã là công thức `Q511-Q513`, file ra giữ và dịch đúng thành `R511-R513`). Nối đúng ô tổng của kế toán: cuối sheet HDDT có `Q3048 = Σ chưa thuế + Σ thuế + Σ phí` và `Q3049 = Σ tổng TT − Q3048 = 9.268.400` — bảng cân đối thêm cột "LỆCH (đã cộng phí)" cho ra đúng 9.268.400 = lệch thật 9.360.068 − chiết khấu 91.666 − làm tròn 2; dòng tổng của kế toán được giữ nguyên và dịch công thức đúng cột. Xuất lại 3 vòng cho cả hai chế độ: số cột đứng yên (thuế 26/24 · T8 41/31). T6 so với file mẫu: 38 cột đầu khác 0. Hồi quy 3 file cũ: tổng đối soát + tự kiểm 9/9 y nguyên. -->
<!-- updated: 2026-09-21 — v6.2 HÓA ĐƠN BÁN HÀNG (MẪU SỐ 2) + CÂN ĐỐI CỘT + NGƯỠNG LÀM TRÒN. (1) `CotCong.banHang` (tính THEO TỪNG DÒNG từ cột "Ký hiệu mẫu số" = 2): hóa đơn bán hàng KHÔNG có thuế GTGT ⇒ ô thuế trống/0 là ĐÚNG, và chưa thuế phải = tổng thanh toán (+chiết khấu −phí). Trước đó engine coi ô thuế trống là "thiếu" rồi suy ngược tổng − chưa thuế thành SỐ THUẾ — sai nguy hiểm: bấm Sửa là khai khống thuế đầu vào. Nhánh mới chỉ chạy khi ô chưa thuế CÓ SỐ (bỏ trống cả cụm vẫn để nhóm 4 gom thống kê, kẻo bung 60+ dòng nhiễu). (2) `TOL_LAM_TRON = 1` đ thay `tolCong = 0.5`: lệch 1 đồng là làm tròn của bên phát hành, không phải sai sót. (3) `SheetHoaDon.canDoiCot` (kiểu `CanDoiCot`): cộng cột chưa thuế + thuế so cột tổng thanh toán trên SỐ THÔ (không quy tỷ giá — kế toán cộng cột trên Excel là cộng thô), bóc phần lệch thành 4 nguyên nhân phí · chiết khấu · làm tròn ±1đ · LỆCH THẬT, bốn phần cộng lại ĐÚNG bằng phần lệch nên tự kiểm được. Hiện thành bảng ở ĐẦU sheet NGHI VẤN SỐ LIỆU kèm danh sách dòng lệch thật. -->
<!-- re-verified: 2026-09-21 — chạy trên file thuế gửi "(1).xls" (HDDT 3.047 dòng + MTT 512): lệch cột 11.787.420 bóc ra = phí 2.519.020 (8 dòng) + chiết khấu −91.666 (1) + làm tròn −2 (26) + LỆCH THẬT 9.360.068 (1 dòng: HDDT 1685, C26TNS-324, Nhà sách Minh Đăng). Kiểm chéo quy tắc mẫu số 2 trên toàn file: 304 hóa đơn mẫu số 2, 303 cái có chưa thuế = tổng thanh toán, đúng 1 cái sai là dòng 1685. Nghi vấn giảm 328 → 1 lẻ + 1 gộp. HỒI QUY (đều GIẢM hoặc GIỮ, không phát sinh loại mới): T6 18→17 · .xls 6 tháng 6→5 · T8 70→70, tổng đối soát và tự kiểm 9/9 y nguyên cả 3 file. Xuất lại 3 vòng: sheet/cột đứng yên. Trình duyệt thật: bóc tách ra đúng số, xuất 719KB không lỗi. -->
<!-- updated: 2026-09-18 — v6.1 SỔ XUẤT CHI TIẾT MẶT HÀNG + SHEET "HÓA ĐƠN CHƯA KÊ". (1) Kế toán gửi lại T8 với PMEM kiểu MỚI: 1 dòng/mặt hàng (DVT·SOLUONG·DONGIA), cột `KH_HD`·`MS_THUE`·`DONVIBAN`·`TIENHANG_CHUATHUE`·`TIEN_THUE`·`NOIDUNG`, KHÔNG có cột TONGCONG ⇒ `hangTieuDePhanMem` cũ đòi "tổng cộng" nên KHÔNG nhận ra sổ, cả 610 hóa đơn thành "chưa có". Nay nhận sổ khi có "số HĐ" + (cột tổng HOẶC đủ cặp tiền hàng + tiền thuế); thêm alias; `SheetPhanMem.coCotTong=false` ⇒ tổng = tiền hàng + thuế, BỎ `nghiVanCong` (không có tổng để soi — soi là báo oan cả sổ "tổng bị xóa"); cảnh báo "Sổ không có cột tổng cộng". Dòng mặt hàng cùng số HĐ vẫn cộng dồn như cũ. (2) Kế toán phản ánh "không thấy lọc chưa kê" ⇒ sheet "HÓA ĐƠN CHƯA KÊ" đứng thứ 2 (ngay sau ĐỐI CHIẾU TỔNG, có dòng chỉ đường ở ô A4): bảng chính = hóa đơn THIẾU trừ `khongCanVaoSo` trừ nghi-gõ-sai, xếp theo ngày lập, có dòng CỘNG; mục "NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN Ở SỔ" = hóa đơn có `ganKhopMoTa`; mục "KHÔNG CẦN KÊ" = đã bị thay thế/hủy; mục cuối "DÒNG SỔ KHÔNG CÓ HÓA ĐƠN ĐIỆN TỬ". -->
<!-- re-verified: 2026-09-18 — T8 gửi lại (HDDTU 610 HĐ, PMEM 590 dòng mặt hàng): trước khi sửa KHÔNG nhận ra sổ; sau khi sửa 551 khớp · 3 lệch · 56 thiếu · 12 dòng sổ thiếu HĐ · 9 gần khớp · tự kiểm 9/9 (bản PMEM thiếu lần trước chỉ 501 khớp / 105 thiếu). 9/12 dòng sổ "không có hóa đơn" là GÕ SAI SỐ HĐ (352255 vs 35255, 159376 vs 154376, số phiếu "15/NHIU/08" gõ vào ô số HĐ…) ⇒ tách riêng: 47 phải kê thật (341,7 tr đ) + 9 nghi gõ sai. HỒI QUY y nguyên: T6 685/392/1/292 · .xls 6 tháng 3551/2049/8/1494 · HDONDT không nhận nhầm sheet HĐĐT thành sổ. Xuất lại 3 vòng (T8 + HDONDT): sheet/cột/tổng đứng yên. Trình duyệt thật: 551/56/9, xuất 282KB không lỗi. -->
<!-- updated: 2026-09-17 — v6 HAI CHIỀU SOÁT MỚI (`src/lib/doiSoatHaiBan.ts`, hàm THUẦN trên `SheetHoaDon[]`, KHÔNG đụng engine ⇒ 9 phép tự kiểm giữ nguyên). (1) `soHaiBanHddt` — so BẢN THUẾ GỬI ⇄ BẢN TỰ TẢI: nhận diện bên thuế bằng tên sheet chứa chữ "thuế" (`laBenThue`), GỘP mọi sheet mỗi bên rồi so theo cùng khóa `MST|ký hiệu|số HĐ chuẩn` (không ghép đôi sheet theo tên — bản thuế gộp có-mã+không-mã trong khi bản tự tải tách ra). 3 nhãn: CHỈ THUẾ CÓ (bản tải thiếu) · CHỈ TẢI CÓ · CÓ CẢ HAI (khớp / lệch tiền / không-so-được). (2) `gomCungMstCungNgay` — gom hóa đơn cùng MST người bán + cùng ngày lập, giữ nhóm ≥2, đánh dấu riêng nhóm có hóa đơn TRÙNG KHÍT số tiền (`trungSoTien`) vì đó mới là dấu hiệu kê hai lần. (3) Xuất thêm 2 sheet "SO HAI BẢN HĐĐT" + "CÙNG MST CÙNG NGÀY"; file KHÔNG có sheet sổ thì SO HAI BẢN lên ĐẦU và ĐỐI CHIẾU TỔNG tự gắn cảnh báo không dùng được. (4) `doTronBoCuc` + `DongHoaDon.boCucLech` — bắt sheet bị DÁN HAI BẢN XUẤT khác số cột vào làm một. (5) `docTrangThaiHd`/`docTienTe` — dò theo NỘI DUNG khi dò theo vị trí hụt (trạng thái bắt đầu bằng "Hóa đơn ", tiền tệ là mã 3 chữ hoa), vá được trạng thái + tiền tệ + tỷ giá cho dòng lệch bố cục. -->
<!-- re-verified: 2026-09-17 — chạy thật 2 file. "HDONDT 6 THÁNG.xlsx" (4 sheet = 2 cặp): bắt đúng 365 hóa đơn CHỈ bản thuế có (40,2 tỷ đ) + 1 chỉ bản tự tải; phát hiện sheet COMA-KMA trộn 2 bố cục (2400 dòng tới cột S + 286 dòng tới cột T — bản "không mã" để TỔNG THANH TOÁN ở cột P, hóa đơn ngoại tệ còn để số gốc và số quy đổi ở hai cột khác hẳn) ⇒ nhờ `boCucLech` mà số ca "lệch tiền" từ 229 (toàn nhiễu) còn 30. "DANH SÁCH HÓA ĐƠN T8.xlsx": 610 HĐ · 501 khớp · 4 lệch · 105 chưa vào sổ · 12 dòng sổ thiếu HĐ · tự kiểm 9/9; cùng-MST-cùng-ngày ra 79 nhóm/228 HĐ, 9 nhóm nghi trùng. HỒI QUY: T6 cũ y nguyên 685/392/1/292 idempotent 3 vòng; file .xls 6 tháng y nguyên 3551/2049/8/1494. Trình duyệt thật: cả 3 module nạp chạy sạch, xuất 250KB không lỗi. -->
<!-- updated: 2026-09-16 — v5.2 NHẬN FILE .xls + SỔ GỘP NHIỀU THÁNG + QUY TẮC HÓA ĐƠN BỊ THAY THẾ. (1) `.xls` (BIFF, cổng thuế vẫn gửi): `chuanHoaSangXlsx` đổi vỏ sang .xlsx NGAY LÚC NẠP (dò magic "PK"), vì `exceljs` chỉ đọc .xlsx — đưa .xls vào nó trả workbook RỖNG, KHÔNG ném lỗi, phần xuất rơi về bản dựng-mới và mất bố cục. Đổi vỏ ở `fileSangBase64` + `sheetsTuBase64` + đầu `xuatExcelGiuDinhDang` ⇒ mọi khâu dùng CÙNG bộ bytes (màn hình nay nạp 1 lần: `fileSangBase64` → `sheetsTuBase64`, bỏ `docWorkbook` để khỏi 2 lần đọc lệch toạ độ). (2) **Sổ gộp NHIỀU THÁNG chạy được, không cần sửa gì** — engine ghép theo khóa nên không phụ thuộc kỳ; đã chạy thật 6 tháng (3551 HĐ ⇄ 2224 dòng sổ), tự kiểm 9/9. (3) **QUY TẮC MỚI — hóa đơn không cần vào sổ**: `DongHoaDon.trangThaiHd` + `khongCanVaoSo`; trạng thái "đã bị thay thế / bị xóa bỏ / đã bị hủy" ⇒ nhãn `"CHƯA CÓ TRONG ‹sổ› — KHÔNG CẦN VÀO SỔ"` + `tong.thieuKhongCanVaoSo` + `canhBao` + 2 dòng ở ĐỐI CHIẾU TỔNG ("trong đó…" và "⇒ CÒN LẠI THẬT SỰ PHẢI RÀ"). **KHÔNG đổi nhóm đếm** nên 9 phép tự kiểm giữ nguyên. ⚠️ "đã bị ĐIỀU CHỈNH" thì KHÁC: hóa đơn gốc vẫn hiệu lực, vẫn phải vào sổ — đừng gộp chung. (4) Nhãn nhóm thiếu nay gọi thẳng tên sheet sổ (`CHƯA CÓ TRONG PHẦN MỀM CTY`) thay vì "PMKT", khớp cách file mẫu kế toán gọi. -->
<!-- re-verified: 2026-09-16 — chạy thật trên "DANH SÁCH HD THUẾ GỬI - đang làm.xls" (BIFF, 4 sheet: XXXX trống + HDDT 3043 HĐ + MTT 508 HĐ + PHẦN MỀM CTY 2224 dòng, dữ liệu T01–T06/2026): đọc + xuất chạy sạch, tự kiểm 9/9, bắt được 26 hóa đơn bị thay thế (6,8 tỷ đ) lẽ ra bị báo oan "chưa kê"; sheet trống XXXX không làm vỡ; tiêu đề ở hàng 2 (ref A2) vào đúng nhờ `ToaDoGoc`; tiền tệ USD/JPY/"VNĐ" quy đổi đúng. HỒI QUY file T6 cũ (.xlsx): tổng y nguyên 685/392/1/292, idempotent 3 vòng, ô gốc lệch 0, oracle nhãn 1105/1107 — 2 dòng lệch ĐÚNG CHỦ Ý (2 hóa đơn bị thay thế nay đổi nhãn, file mẫu gộp chung). Tỷ lệ "chưa vào sổ" 42% là BÌNH THƯỜNG ở công ty này (file T6 cũ 43%) — sổ phần mềm là bản trích, không phải toàn bộ bút toán. -->
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
- **Ra:** (1) bảng đối soát trên màn (tab theo từng sheet + tab "Phần mềm kế toán"), (2) nút **Tải Excel kết quả** — trả về **chính file đã tải lên, giữ nguyên định dạng**, thêm cột `KẾT QUẢ` ở đầu + khối cột phân tích ở cuối + sheet `KẾT LUẬN CHUNG` lên đầu workbook (sheet danh sách chỉ khi có dữ liệu — [v6.4](#v64--một-sheet-kết-luận-chung-bớt-sheet)), đúng bố cục file mẫu kế toán đang dùng (xem [v5.1](#v51--bố-cục-bám-đúng-file-mẫu-kế-toán)).

## Khóa & so tiền (logic ở `lib/doiSoatHddt.ts`)

- **Khóa đối chiếu** = `MST người bán | Ký hiệu hóa đơn | Số HĐ chuẩn` (chuẩn hóa: bỏ dấu, thường, gộp khoảng trắng). **Số HĐ chuẩn** = bỏ số 0 ở đầu (`00060568` → `60568`) vì phần mềm pad 0 còn cổng thuế thì không (`soHoaDonChuan`).
- **Quy về VND — TỰ DÒ quy ước (`phatHienQuyUocNgoaiTe`):** cổng thuế xuất hóa đơn ngoại tệ theo **hai kiểu KHÁC nhau tùy bản xuất** — có bản để tiền ở **nguyên tệ** (phải `× Tỷ giá` ra VND), có bản đã **quy sẵn VND** ở cột tiền (nhân nữa là đội lên gấp ~tỷ giá lần → tổng phình từ vài trăm tỷ thành vài chục **nghìn** tỷ). Không cố định được nên engine **không đoán mò**: lấy hóa đơn ngoại tệ **đã khớp dòng sổ** (sổ luôn VND) làm mẫu, so **số gốc** vs **số ×tỷ giá** xem bên nào sát sổ hơn → đó là quy ước của file, áp cho MỌI dòng ngoại tệ. Mỗi dòng giữ `chuaThueRaw/thueRaw/tongTtRaw` (số gốc) để dò; khi kết luận "đã VND" thì hạ `tyGia` (áp dụng) về **1** và lấy lại số gốc. Không có mẫu khớp sổ ⇒ GIỮ mặc định `× Tỷ giá` + bắn cảnh báo soát tay. Cột nguồn "Tỷ giá" của file KHÔNG bị sửa; cột xuất "Tỷ giá áp dụng" = số thực đã nhân (1 khi không quy đổi).
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

## v6.5 — dễ hiểu: nói bằng ô của kế toán, không dời ô

### Tên file kết quả — mỗi lần xuất một file mới

`tenFileKetQua(tenGoc)` → `<tên gốc> - đã đối soát <yyyymmdd-HHmm>.xlsx`. Tên cố định làm
bản sau trùng bản trước: trình duyệt thêm "(1)" hoặc hỏi ghi đè, kế toán mở nhầm bản cũ.
File vào là file đã xuất thì bỏ đuôi "- đã đối soát …" / "- đã dò lệch …" cũ trước, kẻo tên
dài dần. Khi chạy hộ kế toán ngoài app (ghi thẳng vào Downloads) cũng đặt tên theo quy tắc này.

Chủ dự án xem file v6.4: *"xem không hiểu, không biết chỗ nào lệch, ô hay dòng nào"*. Ba nguyên nhân:

1. **Chèn cột A làm dời địa chỉ.** Kế toán hỏi về ô Q3049 của họ, file ra thành R3049 — lạc ngay từ đầu.
2. **Câu chữ kiểu kỹ thuật** (Σ, "lệch thật", "bóc") và trộn việc họ không hỏi.
3. **Không có danh sách "dòng nào góp bao nhiêu"** để tự cộng lại ra đúng con số của họ.

### File không có sổ: KHÔNG chèn cột

| | có sổ | không có sổ (từ v6.5) |
|---|---|---|
| cột A | chèn `KẾT QUẢ` (bố cục file mẫu v5.1 — giữ nguyên) | **không chèn** — mọi ô ở đúng địa chỉ cũ |
| khối thêm ở cuối | 17 cột đối soát + 3 cột kiểm | 3 cột kiểm |
| tô màu | mọi dòng theo đối soát | **chỉ dòng có lệch**: đỏ = sai thật, vàng = phí/chiết khấu/làm tròn |

File đã xuất bằng bản ≤ v6.4 (còn cột A "KIỂM CỘNG") đưa vào lại thì cột A bị **gỡ** (`chenCotDau` với dịch âm, dịch ngược công thức) ⇒ địa chỉ trở về như file gốc. Nhận ra file xuất kiểu mới để gỡ khối cũ: hàng tiêu đề có đủ 3 cột `HEADER_KIEM` (`goCotDoiSoatCu`).

Địa chỉ trong sheet kết luận quy về FILE RA qua `cotRa(sh, c)` (lớp xuất truyền vào `themSheetTongHop`) — đừng tự cộng `DICH_COT_XUAT`.

### Máy nhận ra ô lệch kế toán tự đặt (`oTuDat`)

Kế toán hay gõ dưới bảng: SUM từng cột, một ô "chưa thuế + thuế (+ phí)", rồi ô lấy tổng trừ đi. `timOTuDat` xét các hàng không phải hóa đơn, tìm ô có giá trị bằng một trong bốn cách tính: cộng trần · đã cộng phí · đã cộng phí và trừ chiết khấu · chỉ trừ chiết khấu (±0,5 đ, chấp nhận cả ngược dấu). Lấy ô ở hàng thấp nhất.

⚠️ Loại ô có giá trị bằng **tổng một cột**. Sheet khớp tuyệt đối thì "lệch + Σ chiết khấu" chính là ô SUM của cột chiết khấu — MTT từng bị nhận nhầm P511 như thế.

### Bố cục sheet KẾT LUẬN CHUNG (8 cột)

1. Tiêu đề theo chế độ ("KẾT QUẢ DÒ: CHƯA THUẾ + THUẾ CÓ BẰNG TỔNG THANH TOÁN KHÔNG") + 2 câu: ô có dời không, không ô nào bị sửa, chữ xanh bấm được.
2. **TRẢ LỜI** — mỗi sheet một dòng, nói bằng ô của họ: *"Ô Q3049 = 9.268.400 đ: do 1 hóa đơn ghi sai tiền ở dòng 1685 (9.360.068 đ), trừ chiết khấu 91.666 đ, trừ làm tròn 2 đ."* Rồi các kiểm tra khác (cùng MST, nghi vấn, tự kiểm).
3. **SHEET X — ô Q3049 = …** (chỉ sheet có lệch):
   - câu giải thích ô đó tính thế nào (cột nào trừ cột nào);
   - bảng **các phần lệch cộng lại đúng bằng ô** — dòng CỘNG ghi "= đúng ô Q3049 ✓";
   - **DÒNG PHẢI SỬA**: địa chỉ từng ô, và số đúng theo HAI giả thiết (tổng đúng ⇒ ô chưa thuế phải là…; chưa thuế đúng ⇒ ô tổng phải là…). Máy không đoán ô nào sai, người mở hóa đơn gốc quyết;
   - **DÒNG LỆCH BÌNH THƯỜNG**: phí/chiết khấu/làm tròn, từng dòng, để cộng lại cho đủ.
4. (có sổ) SỐ LIỆU ĐỐI CHIẾU VỚI SỔ, rồi mới tới khối dò lệch.
5. CHỖ CẦN SOÁT LẠI → MÁY TỰ KIỂM TRA (cuối).

Bảng xoay "CỘNG CỘT" (Σ chưa thuế / Σ thuế / …) **bỏ** — khối dò lệch nói cùng điều bằng lời thường.

## v6.4 — một sheet KẾT LUẬN CHUNG, bớt sheet

Chủ dự án: *"tạo thêm quá nhiều sheet nhưng không xác định phân tích được trọng tâm"*. Kế toán
gửi file kèm **một** câu hỏi mỗi lần ("lọc chưa kê", "cộng cột lệch 9 triệu ở đâu", "hai bản
lệch chỗ nào"). Mở ra thấy 6 sheet lạ thì không biết nhìn đâu.

### Quy tắc chọn sheet

| Loại nội dung | Đặt ở đâu | Vì sao |
|---|---|---|
| Câu trả lời, số tổng, bằng chứng (đối chiếu tổng, cộng cột, chỗ nghi vấn, tự kiểm) | **khối** trong `KẾT LUẬN CHUNG` | đọc một mạch từ kết luận xuống bằng chứng, không lật tab |
| Kết quả từng hóa đơn dò được trên chính sheet gốc (lệch cộng, khớp/lệch/thiếu) | **cột A + cột thêm ở cuối sheet gốc**, bảng trả lời chỉ đường lọc | kế toán đã xác nhận ở v6.3 là dễ dùng nhất |
| Danh sách hóa đơn cần lọc/gửi đi | sheet riêng, **chỉ khi có dữ liệu** | là danh sách, không nhét chung được |

Sheet ra và thứ tự:

1. **`KẾT LUẬN CHUNG`** — luôn có. Hàng 1–3: chế độ kiểm của file (đối soát với sổ / so hai bản /
   chỉ bảng kê) + cam kết không sửa ô gốc. Hàng 5: **bảng TRẢ LỜI** — `VIỆC ĐÃ KIỂM · KẾT LUẬN ·
   XEM Ở ĐÂU · PHẢI LÀM GÌ`, nền đỏ/vàng/xanh theo mức phải xử. Dưới đó các khối: SỐ LIỆU ĐỐI
   CHIẾU VỚI SỔ (chỉ khi có sổ) → CỘNG CỘT → CHỖ CẦN SOÁT LẠI (chỉ khi có) → TỰ KIỂM TRA (cuối).
2. `HÓA ĐƠN CHƯA KÊ` — có sổ **và** có dòng thiếu ở một trong hai chiều.
   *(Không sổ ⇒ `SO HAI BẢN HĐĐT` đứng chỗ này nếu file có hai bản.)*
3. Các sheet gốc.
4. `CÙNG MST CÙNG NGÀY` — **sau** sheet gốc: danh sách tham khảo, không phải kết quả đối soát.
5. `NHẬT KÝ SỬA` — cuối, chỉ khi người dùng đã bấm Sửa.

Thứ tự câu trả lời theo **việc chính của file**: có sổ ⇒ chưa kê trước; hai bản ⇒ so hai bản
trước; chỉ bảng kê ⇒ cộng cột trước. Tự kiểm luôn cuối bảng.

### Cột XEM Ở ĐÂU là link bấm được

Viết bằng công thức `HYPERLINK("#'Sheet'!A55", "…")`, nhảy thẳng tới **đúng mục** (VD mục tô vàng
"nghi gõ sai số" của sheet chưa kê, khối CỘNG CỘT ngay trong sheet).

> ⚠️ Đừng dùng link kiểu `{ text, hyperlink: "#…" }` của exceljs: nó ghi LAI (một quan hệ
> *External* trỏ tới `#…` + thuộc tính `location` vẫn dính dấu `#`) — không chắc mọi bản Excel /
> LibreOffice hiểu là link nội bộ. Công thức HYPERLINK thì bản nào cũng chạy.

### Cộng cột — nói đúng con số kế toán đang nhìn

Dòng tổng kế toán tự gõ cuối sheet có người cộng trần, có người đã cộng phí (xem v6.3). Câu trả
lời bóc **từng sheet** ra cả hai con số, để họ thấy đúng số trong ô của mình:

```
• Sheet HDDT: Σ tổng − (Σ chưa thuế + Σ thuế) = 11.787.420 = phí 2.519.020 + lệch thật 9.360.068
  + chiết khấu -91.666 + làm tròn -2. Nếu dòng tổng tự đặt đã CỘNG PHÍ thì ra 9.268.400
  = lệch thật 9.360.068 + chiết khấu -91.666 + làm tròn -2.
```

Lệch thật ≤ 5 hóa đơn thì nêu thẳng "HDDT dòng 1685"; nhiều hơn thì chỉ đường lọc cột.
Danh sách từng hóa đơn lệch cộng **không chép ra** nữa (trước ở `NGHI VẤN SỐ LIỆU`) — dòng đó
đã được đánh dấu ngay trên sheet gốc.

### Idempotent — `SHEET_TU_DUNG`

Hằng ở `doiSoatHddt.ts`, gồm tên sheet tự dựng hiện tại **và tên cũ** (`ĐỐI CHIẾU TỔNG`,
`TỰ KIỂM TRA`, `NGHI VẤN SỐ LIỆU`). Dùng hai chỗ:

- `doiSoat` **bỏ qua** các sheet này khi đọc lại file đã xuất — chữ trong đó ("số hóa đơn",
  "tổng cộng"…) dễ bị dò nhầm thành bảng kê/sổ.
- `themSheetTongHop` **xóa** chúng rồi dựng lại — file xuất từ bản cũ (6 sheet) xuất lại cũng
  ra đúng bộ sheet mới.

⚠️ Đổi/thêm tên sheet tự dựng nào **phải** thêm vào `SHEET_TU_DUNG`, không là xuất lại đẻ sheet.

### Số sheet tổng hợp trước/sau (5 file thật)

| File | Có | Trước | Sau |
|---|---|---|---|
| T6 | sổ PMEM, 3 bảng kê | 5 | 3 (kết luận · chưa kê · cùng ngày) |
| T8 | sổ PMEM, 1 bảng kê | 5 | 3 |
| HDONDT 6 tháng | hai bản, không sổ | 5 (có `ĐỐI CHIẾU TỔNG` vô nghĩa) | 3 (kết luận · so hai bản · cùng ngày) |
| thuế gửi – đang làm | sổ, 2 bảng kê | 5 | 3 |
| thuế gửi (1) | chỉ bảng kê | 4 | 2 (kết luận · cùng ngày ở cuối) |

Số liệu engine (tổng, 9 phép tự kiểm, cân đối cột) **không đổi** — v6.4 chỉ đổi lớp xuất.

## v6.3 — dò ngay trong sheet, không đổi số liệu

Kế toán nói rõ: **"dò trực tiếp vào sheet, không thay đổi số liệu"**. Đặt kết quả ở một sheet
tổng hợp riêng là chưa đúng ý — họ soi trên chính bảng kê của thuế.

### Ba cột kiểm dựng bằng CÔNG THỨC SỐNG

Thêm vào sheet bảng kê 3 cột: `Chưa thuế + Thuế` · `Lệch với tổng thanh toán` · `Nguyên nhân lệch`.
Hai cột đầu là **công thức trỏ thẳng ô gốc** (`N{r}+O{r}` và `R{r}-(N{r}+O{r})`), không phải số chép ra.

> Vì sao dùng công thức chứ không ghi số: bấm vào ô là thấy nó **được tính từ chính ô của thuế**.
> Đó là bằng chứng file xuất không sửa số liệu, và nếu sau này sửa số gốc thì cột kiểm tự cập nhật.
> `ghiKhoiDoiSoat` nhận ô kiểu `{ ct }`; **exceljs tự thêm dấu `=`** — viết sẵn là ra `==N3+O3`.

### Chế độ KIỂM BẢNG KÊ (file không có sheet sổ)

File thuế gửi thường chỉ có bảng kê, không kèm sổ kế toán. Khi đó 17 cột đối soát-với-sổ đều
rỗng, in ra chỉ tổ rối. Engine tự chuyển chế độ:

| | có sheet sổ | KHÔNG có sheet sổ |
|---|---|---|
| cột A | `KẾT QUẢ` (khớp / lệch / chưa vào sổ) | **`KIỂM CỘNG`** (khớp / nguyên nhân lệch) |
| màu dòng | theo đối soát với sổ | **theo kiểm cộng**: đỏ = lệch thật · vàng = phí/chiết khấu/làm tròn · xanh = khớp |
| khối cột thêm | 17 cột đối soát **+ 3 cột kiểm ở cuối** | **chỉ 3 cột kiểm** |

⚠️ File có sổ thì 3 cột kiểm phải nối ở **CUỐI** khối, không chèn lên đầu — 38 cột đầu đã bám
đúng bố cục file mẫu kế toán (v5.1), xê dịch là hỏng thứ đã chốt.

### Nối với dòng tổng kế toán tự đặt ở cuối sheet

Kế toán thường tự gõ dòng tổng ở cuối bảng kê. Trên file thuế tháng 9 là:
`Q3048 = Σ chưa thuế + Σ thuế + Σ phí` rồi `Q3049 = Σ tổng thanh toán − Q3048` = **9.268.400**.

Công thức đó **có cộng phí nhưng chưa trừ chiết khấu**, nên ra số khác với phép cộng trần
(11.787.420). Bảng cân đối cột vì vậy có **hai cột lệch** cạnh nhau — `LỆCH (chưa thuế + thuế)`
và `LỆCH (đã cộng phí)` — để họ nhìn thấy đúng con số trong ô của mình rồi lần ra phần phải sửa:

```
9.268.400  (ô của kế toán)
 = 9.360.068  lệch thật, 1 hóa đơn
 −    91.666  chiết khấu, công thức chưa trừ
 −         2  làm tròn 26 dòng
```

⚠️ Đừng ép kế toán đổi công thức của họ. Việc của máy là **nối được số họ đang nhìn** với phần
phải đi sửa; bắt họ sửa công thức trước rồi mới dò là đẩy việc ngược lại cho người dùng.

⚠️ Tên 3 cột kiểm và nhãn cột A `KIỂM CỘNG` phải có trong `THEM_NORM` và trong phép dò hàng
tiêu đề, nếu không xuất lại lần hai là **đẻ thêm cột**.

## v6.2 — hóa đơn bán hàng (mẫu số 2), cân đối cột, ngưỡng làm tròn

### Hóa đơn bán hàng không có thuế GTGT

`Ký hiệu mẫu số = 2` là **hóa đơn bán hàng**: không có thuế GTGT. Với loại này:

- ô **thuế trống hoặc 0 là ĐÚNG** — đừng báo "thiếu ô thuế";
- **chưa thuế phải bằng tổng thanh toán** (cộng chiết khấu, trừ phí). Lệch thì chỗ sai
  nằm ở ô **chưa thuế**, không phải ô thuế.

⚠️ Bản trước suy ngược `tổng − chưa thuế` thành SỐ THUẾ cho loại hóa đơn này. Kế toán bấm
Sửa theo là **khai khống thuế đầu vào**. Trên file thuế 6 tháng, 302/328 nghi vấn là báo oan
kiểu đó, và một cái còn gợi ý ghi 9,36 triệu tiền thuế cho hóa đơn vốn không có thuế.

> Nhánh này chỉ chạy khi ô chưa thuế **có số**. Bỏ trống cả cụm thì vẫn để nhóm 4 gom
> thống kê như cũ — bung ra từng dòng là 60+ dòng nhiễu mà không thêm thông tin gì.

### Cân đối cột — trả lời "cộng cột lệch mấy triệu, lệch ở đâu"

Kế toán hay cộng cột *chưa thuế* + cột *thuế* rồi so với cột *tổng thanh toán*. Lệch thì
phải chỉ ra lệch ở đâu, chứ nói "có lệch" là vô dụng. `SheetHoaDon.canDoiCot` bóc phần lệch
thành **bốn nguyên nhân**, và bốn phần **cộng lại đúng bằng phần lệch** nên tự kiểm được:

| Nguyên nhân | Có phải sai không |
|---|---|
| **Phí** (tổng = chưa + thuế + phí) | không — phí là thành phần hợp lệ của tổng |
| **Chiết khấu** (tổng = chưa + thuế − chiết khấu) | không |
| **Làm tròn ±1 đ** | không — làm tròn của bên phát hành |
| **LỆCH THẬT** | **có** — danh sách dòng phải đi sửa |

Cộng trên **số thô**, không quy tỷ giá, vì kế toán cộng cột trên Excel là cộng thô.
Hiện thành khối **CỘNG CỘT** trong sheet `KẾT LUẬN CHUNG` (v6.4; trước đó ở đầu sheet `NGHI VẤN SỐ LIỆU`).

> 📌 Chiết khấu KHÔNG phải lúc nào cũng trừ khỏi tổng: có hóa đơn đã trừ sẵn trong ô chưa
> thuế rồi mới ghi thêm dòng chiết khấu. Nên phải thử cả hai cách, đừng áp cứng một công thức.

## v6.1 — sổ xuất chi tiết mặt hàng + sheet "HÓA ĐƠN CHƯA KÊ"

### Sổ phần mềm có HAI kiểu xuất — engine phải nhận cả hai

| | kiểu 1 — theo hóa đơn | kiểu 2 — chi tiết mặt hàng |
|---|---|---|
| mỗi dòng | 1 hóa đơn | 1 mặt hàng (có `DVT`, `SOLUONG`, `DONGIA`) |
| ký hiệu · MST · người bán | `KY_HIEU` · `RMST` · `NGUOI_BAN` | `KH_HD` · `MS_THUE` · `DONVIBAN` |
| tiền hàng · thuế | `TIENHANG` · `TIENTHUE` | `TIENHANG_CHUATHUE` · `TIEN_THUE` |
| tổng cộng | `TONGCONG` | **KHÔNG CÓ** |

⚠️ Bản cũ nhận sheet sổ bằng cột "tổng cộng". Gặp kiểu 2 là **không nhận ra sổ**, cả bảng kê
thành "chưa vào sổ" — mà 9 phép tự kiểm vẫn ĐẠT (không phép nào bắt "thiếu sổ"), chỉ có dòng
cảnh báo. Nay nhận sổ khi có "số HĐ" + (tổng cộng **hoặc** đủ cặp tiền hàng + tiền thuế).

Kiểu 2 thì `coCotTong = false`: tổng = tiền hàng + tiền thuế, và **KHÔNG** soi "cộng có khớp
tổng không" — không có tổng để soi, soi là báo oan cả sổ thành "tổng bị xóa". Nhiều dòng mặt
hàng cùng số hóa đơn thì cộng dồn trước khi so (engine vốn đã làm).

### Sheet "HÓA ĐƠN CHƯA KÊ" — lọc sẵn, đừng bắt kế toán tự lọc

Kế toán phản ánh "không thấy lọc chưa kê": nhãn nằm ở cột A từng sheet, phải biết mà lọc, lại
rải qua nhiều sheet. Nay có sheet riêng, **đứng thứ 2** ngay sau `KẾT LUẬN CHUNG` (dòng đầu bảng
trả lời có link tới nó; v6.4 — trước là ô A4 của `ĐỐI CHIẾU TỔNG`). Không có dòng thiếu ở cả hai
chiều thì **không dựng** sheet này. Bốn mục theo thứ tự:

1. **Phải kê** — hóa đơn thiếu, trừ 2 loại dưới; xếp theo ngày lập; có dòng CỘNG.
2. **Nghi ĐÃ KÊ nhưng gõ sai số hóa đơn ở sổ** — hóa đơn có gợi ý gần khớp (cùng MST + cùng
   số tiền với một dòng sổ không ghép được). Tách ra để khỏi **kê trùng**; sửa số ở sổ là xong.
3. **Không cần kê** — đã bị thay thế/hủy (quy tắc 2026-09-16).
4. **Dòng sổ không có hóa đơn điện tử** — chiều ngược lại.

> 📌 Trên T8 thật: 9/12 dòng sổ "không có hóa đơn" là **gõ sai số hóa đơn** (`352255` vs `35255`,
> `159376` vs `154376`, có dòng gõ cả số phiếu `15/NHIU/08` vào ô số HĐ). Không tách thì 56 "chưa
> kê" trong đó 9 cái đã kê rồi — kế toán sẽ đi kê lần hai.

Bảng đếm và 9 phép tự kiểm của engine **không đổi** — mọi phân loại mới chỉ nằm ở lớp xuất.

## v6 — hai chiều soát ngoài "hóa đơn ⇄ sổ"

Ở `src/lib/doiSoatHaiBan.ts` — hàm **thuần** trên `SheetHoaDon[]` đã parse, không đụng
engine nên không ảnh hưởng 4 nhãn và 9 phép tự kiểm của chiều cũ.

> 📌 Chỉ mục **1** (`soHaiBanHddt`) và **2** (`gomCungMstCungNgay`) nằm ở `doiSoatHaiBan.ts`.
> Mục **3** (`doTronBoCuc`, `DongHoaDon.boCucLech`) và **4** (`docTrangThaiHd`, `docTienTe`)
> thực chất nằm trong **engine `doiSoatHddt.ts`** (chạy trong vòng parse chính, gắn cờ lên
> `DongHoaDon`) — sửa các hàm này thì mở `doiSoatHddt.ts`, không phải `doiSoatHaiBan.ts`.

### 1. So HAI BẢN hóa đơn điện tử (`soHaiBanHddt`)

Cơ quan thuế gửi một bảng kê, kế toán tự tải một bảng kê từ cổng — lẽ ra y hệt, thực tế lệch.

- **Nhận bên nào là bên thuế**: tên sheet chứa chữ "thuế" (`laBenThue`). Phần còn lại là bản tự tải.
- **GỘP mọi sheet của mỗi bên** rồi so theo đúng khóa cũ `MST | ký hiệu | số HĐ chuẩn`.
  KHÔNG ghép đôi sheet theo tên: bản thuế hay gộp "có mã + không mã" vào một sheet trong
  khi bản tự tải tách đôi ⇒ ghép theo tên là gãy.
- Ba nhãn: `CHỈ THUẾ CÓ` (bản tải thiếu — việc phải làm ngay, xếp lên đầu) · `CHỈ TẢI CÓ`
  · `CÓ CẢ HAI` (khớp / lệch tiền / **không so được tiền**).

### 2. Hóa đơn cùng MST + cùng ngày (`gomCungMstCungNgay`)

Gom theo **MST người bán + ngày lập**, giữ nhóm từ 2 hóa đơn.

> Nhiều hóa đơn cùng nhà cung cấp trong một ngày **KHÔNG** có nghĩa là sai (xăng dầu, siêu
> thị, phí ngân hàng…). Đừng kết luận thay người soát. Thứ đáng ngờ thật là nhóm có hóa đơn
> **trùng khít số tiền** — cờ `trungSoTien`, tô vàng riêng.

⚠️ File có **hai bản** (thuế gửi + tự tải) thì mỗi hóa đơn hiện hai lần. Đếm cả hai là nhóm
nào cũng "trùng khít" (HDONDT 6 tháng: 1.790/1.923 nhóm) — danh sách vô dụng. Cùng khóa mà
**khác bên** (`laBenThue`) thì chỉ lấy một lần (v6.4) ⇒ còn 544 nhóm, 82 nhóm trùng tiền.

### 3. Sheet bị DÁN HAI BẢN XUẤT vào làm một (`doTronBoCuc`, `boCucLech`)

Cạm bẫy khó thấy nhất của đợt này. Bảng kê tải từ cổng có thể là hai bản xuất khác số cột
dán chung một sheet, mà chỉ có MỘT hàng tiêu đề:

| | bản "có mã" | bản "không mã" |
|---|---|---|
| số cột | 19 (A…S) | 20 (A…T) |
| Tổng thanh toán | cột **O** | cột **P** |
| hóa đơn ngoại tệ | O = số tiền | K = số quy đổi VND, P = số gốc ngoại tệ |

⚠️ **Đây là schema KHÁC, không phải lệch một cột — đừng viết code đoán rồi dịch ô.** Engine
chỉ làm hai việc: (a) `doTronBoCuc` báo cảnh báo nêu đích danh sheet + số dòng mỗi bố cục,
khuyên tách sheet rồi chạy lại; (b) đánh dấu `DongHoaDon.boCucLech` cho từng dòng rộng hơn
tiêu đề, để chỗ nào so tiền thì **bỏ qua thay vì kết luận bừa**. Khóa (ký hiệu · số HĐ · MST)
vẫn tin được vì nằm TRƯỚC chỗ lệch.

Trên file thật: nhờ cờ này mà số ca "lệch tiền" từ **229 (gần như toàn nhiễu) còn 30**.

### 4. Dò ô theo NỘI DUNG khi dò theo vị trí hụt

`docTrangThaiHd` (trạng thái bắt đầu bằng "Hóa đơn ") và `docTienTe` (mã tiền tệ 3 chữ hoa,
tỷ giá là ô ngay sau). Chỉ chạy khi ô theo tiêu đề rỗng/sai kiểu — **không đè lên giá trị đọc
được**. Nhờ nó mà dòng lệch bố cục vẫn đọc đúng trạng thái + quy đổi ngoại tệ.

## v5.2 — file `.xls`, sổ gộp nhiều tháng, hóa đơn bị thay thế

**Định dạng `.xls`** (BIFF cũ — cổng thuế vẫn gửi kiểu này). `xlsx-js-style` đọc được,
nhưng `exceljs` (lo phần xuất) **chỉ đọc `.xlsx`** và khi đưa `.xls` vào nó **không ném
lỗi** — trả về workbook RỖNG, ta báo "không tìm thấy sheet" rồi rơi về bản dựng-mới, mất
sạch bố cục. Nên **đổi vỏ ngay lúc nạp**: `chuanHoaSangXlsx` dò magic `PK` (zip = đã
xlsx), còn lại đọc bằng SheetJS rồi ghi lại thành `.xlsx`.

> Một bộ bytes cho TẤT CẢ. Màn hình nạp 1 lần (`fileSangBase64` → `sheetsTuBase64`), bản
> lưu và phần xuất dùng đúng bytes đó. Đọc file hai lần bằng hai đường khác nhau là toạ độ
> dòng/cột có thể lệch, mà cột "Vị trí" trong NGHI VẤN SỐ LIỆU sống bằng toạ độ.
>
> Bản `.xls` cổng thuế là dữ liệu trần (0 font, 0 khung, 0 công thức) nên đổi vỏ không mất
> gì. `.xls` CÓ định dạng thì định dạng sẽ rụng — không có thư viện chạy trong trình duyệt
> nào đọc nổi dáng của BIFF.

**Sổ gộp nhiều tháng**: không phải sửa gì. Engine ghép theo khóa `MST|ký hiệu|số HĐ`, không
đụng tới kỳ. Đã chạy thật 6 tháng một lần (3551 hóa đơn ⇄ 2224 dòng sổ), tự kiểm 9/9. Dòng
sổ thuộc tháng ngoài phạm vi bảng kê sẽ hiện "chưa có hóa đơn" — đúng, cứ để kế toán thấy.

**Hóa đơn KHÔNG CẦN VÀO SỔ** *(quy tắc nghiệp vụ, chốt 2026-09-16)*

| Trạng thái trên cổng thuế | Có phải vào sổ không |
|---|---|
| `Hóa đơn đã bị thay thế` · `bị xóa bỏ` · `đã bị hủy` | **KHÔNG** — kế toán hạch toán bản thay thế |
| `Hóa đơn thay thế` (bản mới) | **CÓ** |
| `Hóa đơn đã bị điều chỉnh` | **CÓ** — hóa đơn gốc vẫn hiệu lực |
| `Hóa đơn điều chỉnh` | **CÓ** — ghi phần chênh |

⚠️ **Đừng gộp "thay thế" với "điều chỉnh".** Thay thế = bản cũ chết, bản mới thay hẳn.
Điều chỉnh = bản cũ vẫn sống, bản điều chỉnh chỉ ghi thêm phần chênh. Coi "đã bị điều
chỉnh" là không-cần-vào-sổ sẽ làm hụt số liệu kê khai.

Cách cài: `khongCanVaoSo` trên từng dòng → đổi **nhãn** (`"CHƯA CÓ TRONG ‹sổ› — KHÔNG CẦN
VÀO SỔ"`) + `tong.thieuKhongCanVaoSo` + cảnh báo trên màn + 2 dòng ở ĐỐI CHIẾU TỔNG
("trong đó…" và "⇒ CÒN LẠI THẬT SỰ PHẢI RÀ"). **KHÔNG tạo nhóm đếm mới** — giữ nguyên 4
nhãn và 9 phép tự kiểm đã verify. Trên bộ 6 tháng: bắt được 26 hóa đơn, **6,8 tỷ đ** lẽ ra
bị báo oan là "chưa kê".

> 📌 Tỷ lệ "chưa vào sổ" cao (~42%) là **bình thường ở công ty này**, không phải lỗi ghép:
> sheet phần mềm là bản TRÍCH, không phải toàn bộ bút toán. File T6 riêng lẻ cũng 43%.
> Đừng thấy con số lớn mà đi sửa engine.

## v5.1 — bố cục bám đúng FILE MẪU kế toán

Kế toán đối soát bằng một file mẫu có sẵn. "Giữ nguyên định dạng" (v5) chưa đủ —
bố cục phải giống luôn, nếu không họ vẫn phải mò. Ba điểm bắt buộc:

| Điểm | Phải làm |
|---|---|
| Cột **KẾT QUẢ** | chèn làm **cột A**, dữ liệu gốc dời sang phải 1 cột |
| **Sheet tổng hợp** | ~~3 sheet `ĐỐI CHIẾU TỔNG` · `TỰ KIỂM TRA` · `NGHI VẤN SỐ LIỆU`~~ → từ v6.4 gộp thành **một** sheet `KẾT LUẬN CHUNG` đứng **đầu** workbook |
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
