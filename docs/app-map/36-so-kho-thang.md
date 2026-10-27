> Load khi: sửa màn Sổ kho theo tháng (/monthly-stock), logic dồn tồn cuối kỳ → đầu kỳ sau, hay công thức tồn cuối/tiền còn lại theo tháng.
covers: src/features/monthly-stock/MonthlyStockScreen.tsx, src/features/monthly-stock/index.ts, src/lib/monthlyStock.ts, src/lib/monthlyStockExcel.ts, src/lib/frozenStockLines.ts
last_verified: 2026-10-27
<!-- updated: 2026-10-27 (b) — CHUYỂN BẢNG: nút bulk "Chuyển bảng" trên thanh Đã chọn (đổi `category` và/hoặc `warehouse` của dòng tick, ô trống = giữ của từng dòng, toast Hoàn tác) — `moveLinesToTable` (monthlyStock.ts, có test). CHUỖI DỒN KỲ ĐI THEO khi lô đổi bảng / kho — `followTableChange`: đi `carry|<lô>`, `carry|carry|<lô>`… ở các tháng sau đã mở, mỗi dòng dồn chỉ đổi trường CÒN GIỐNG giá trị cũ của lô; dòng tháng sau đã tự dời chỗ khác thì giữ và dừng chuỗi; tháng trước không đổi; không đụng kg. Dùng ở Chuyển bảng, hộp ✎ Sửa dòng (đổi Nhóm hàng / Kho) và Cân đối dời lô Gửi đông (balancingStockLines). Trước đây dồn kỳ chỉ cập nhật tồn đầu nên tháng sau giữ bảng / kho cũ — hết câu "dòng carry giữ nhóm cũ" ở ghi chú 2026-10-20. -->
<!-- updated: 2026-10-27 — SẮP XẾP CỘT (quy tắc 19): mỗi bảng nhóm (SummaryTable) bấm tên cột để sắp — Ngày nhập cũ→mới · Mặt hàng/Size/Invoice/Vị trí A→Z · Đơn giá/Tồn đầu/Nhập/Xuất/Tồn cuối/Tiền bé→lớn (cột ô nhập khai `sortValue` lấy số thô, không đọc chữ trong ô); sắp trong TỪNG nhóm, dòng Cộng nhóm không đổi; gõ số khi đang sắp thì dòng đứng yên. DÁN KHỐI TỪ EXCEL đi theo thứ tự ĐANG HIỆN (đọc `data-row` của ô số trong `[data-grid-nav]`) — trước đây theo thứ tự gốc, bảng đang sắp mà dán là đổ số nhầm dòng. -->
<!-- updated: 2026-10-20 (r) — BỎ HẲN BẢNG "Nguyên liệu gửi đông" (kế toán: "chỉ xài bảng có sẵn, không thêm vô ô nào hết"): lô gửi đông KHÔNG BAO GIỜ ghi vào bảng cũ nữa — `depositLotCategory` (balancingStockLines) = nhóm người dùng chọn → nhóm lô đã ghi (nếu không phải bảng cũ) → "Nguyên liệu mua ngoài". Lô đang nằm ở bảng cũ: tính là LỆCH (`countMonthlyStockMismatches`) ⇒ Cân đối hiện "Sổ kho tháng lệch n chỗ" + nút "Ghi lại vào sổ kho" dời lô sang bảng đã chọn (kg giữ nguyên, có Hoàn tác); lưu lại hộp "Gửi đông vào sổ kho" cùng nhóm cũng dời (trước đây bị coi "không đổi gì" nên lô kẹt ở bảng cũ — lỗi kế toán gặp). Không tự dời hàng loạt khi mở màn (dữ liệu sổ thật — người dùng bấm). Dòng `carry|…` đã dồn sang tháng sau giữ nhóm cũ cho tới lần dồn kỳ kế tiếp. -->
<!-- updated: 2026-10-16 (c) — Hộp Thêm/Sửa dòng và hộp Thao tác (lấy ra · nhập thêm · chuyển) tự lưu nháp (`useDialogDraft`, quy tắc 17): đóng ngang vẫn giữ, rời trang quay lại hộp tự mở lại đúng số; Hủy mới bỏ. -->
<!-- updated: 2026-10-19 — Lô GỬI ĐÔNG `cd|<id dòng>|<ngày>` mang ĐƠN GIÁ CỦA NGÀY GỬI (giá gửi theo ngày gõ ở Cân đối, `balancing_inputs.daily_prices` mig 0071; chưa có ⇒ đơn giá dòng). Sửa giá một ngày chỉ ghi lại lô ngày đó (+ dồn sang tháng sau đã mở). Lấy xả đông sửa giá trên dòng cân đối KHÔNG đổi đơn giá lô. -->
<!-- updated: 2026-10-16 (b) — LÔ GỬI ĐÔNG từ Cân đối KHÔNG còn vào nhóm riêng "Nguyên liệu gửi đông": vào NHÓM người dùng chọn trong hộp "Gửi vào sổ kho" ở Cân đối (`balancing_inputs.stock_category`, mig 0068); chưa chọn ⇒ giữ nhóm của lô đã ghi (lô cũ ở nhóm "Nguyên liệu gửi đông" KHÔNG tự dời), lô mới ⇒ "Nguyên liệu mua ngoài" (`DEFAULT_DEPOSIT_CATEGORY`). Đơn giá lô = giá gửi (đơn giá dòng Gửi đông); lấy xả đông thấy giá này ở dòng phụ ô chọn lô. Hộp chọn bảng ẩn nhóm cũ (`LEGACY_FREEZE_DEPOSIT_CATEGORY`). -->
<!-- updated: 2026-10-16 — lô Gửi đông từ Cân đối mang tên NGUYÊN LIỆU người dùng chọn trên dòng (VD "2 da lớn"), không còn luôn là tên họ NL của kỳ; đổi NL ⇒ lô đổi tên theo. -->
<!-- updated: 2026-10-15 (c) — ĐẨY TIẾP LÔ sang tháng sau đã mở: `propagateLotsForward(lines, lotIds)` (monthlyStock.ts, có test) — đi theo chuỗi `carry|<lô>`, chỉ đặt `openKg/openCtn` = tồn cuối tháng trước, thêm dòng dồn khi lô còn tồn, lô mất ⇒ dòng dồn sạch bị bỏ / có số thì về 0; tháng chưa mở hoặc đã khớp thì dừng. KHÔNG dồn lại cả tháng (tồn đầu đã chốt của lô khác giữ nguyên). Dùng ở /wip hàng đông lạnh và Cân đối (Lấy xả đông · Gửi đông). Sửa tay trên bảng Sổ kho tháng vẫn theo luật cũ: gắn cờ Lệch dồn kỳ, người bấm Dồn. -->
<!-- updated: 2026-10-15 (b) — (1) HÀNG TẠM TỪ SẢN XUẤT: xưởng ghi hàng đông lạnh ở /wip ⇒ lô nhập nhóm "Hàng tạm" (id `wip|…`, Invoice `SX-yyyymmdd`, ngày nhập = ngày SX, ghi chú `⟦SX:<xưởng>⟧`; `lib/frozenStockLines.ts`). Bảng: dưới tên hàng có nhãn "Từ SX · <xưởng>" (cả dòng dồn kỳ `carry|wip|…`); đầu nhóm Hàng tạm có câu giải thích + tổng kg/lô từ SX của tháng. Xem 34 § Hàng đông lạnh. (2) BỎ Ô BAO QUANH DỮ LIỆU: ô gõ trên bảng (ngày · size · invoice · số) không viền/không nền — khung chỉ hiện khi rê / đang gõ; ô ngày trống giấu mặt nạ dd/mm/yyyy; ô Vị trí dùng `Combobox inline`. Cột Invoice rộng w-32 (chữ 15px). -->
<!-- updated: 2026-10-15 — phân quyền Đợt 3: `useCan("monthly-stock")` — sửa inline/Lấy ra/Gửi kho/Đồng bộ danh mục (Sửa), Dồn tháng/Kế thừa/Thêm dòng (Thêm), Xóa dòng (Xóa), Nhập Excel bảng kê (Nạp), In (Xuất). -->
<!-- updated: 2026-10-06 (j) — tô màu / in đậm / bỏ tô KHÔNG còn toast "Đã … N dòng" + Hoàn tác (người dùng thấy phiền; README luật 8 mức 0). Các toast ghi sổ của màn (dán khối, dồn kỳ, xóa, gửi kho…) giữ nguyên. -->
<!-- updated: 2026-10-06 (i) — THANH "ĐÃ CHỌN N DÒNG" DỜI XUỐNG SAU CÁC BẢNG + DÍNH ĐÁY (desktop, `md:sticky md:bottom-8` — trên thanh cuộn ngang của bảng xổ): trước nằm đầu trang, tick dòng cuối bảng phải lăn ngược lên mới bấm Tô màu/In/Xóa. Điện thoại không dính (thanh ~3/4 màn ở 360px chữ 130%), nằm ngay dưới bảng. Kiểm demo: tick dòng bảng cuối, cuộn lên đầu/xuống cuối — thanh luôn trong tầm nhìn. -->
<!-- updated: 2026-10-06 (h) — ĐƠN GIẢN HOÁ TÔ MÀU (người dùng thấy bút tô + nút 🪣 rối): BỎ bút tô và nút 🪣 từng dòng; còn MỘT cách — tick dòng (Shift+tick chọn khoảng) → thanh "Đã chọn N dòng" sẵn có của màn có thêm **Tô màu ▾ · In đậm/Bỏ in đậm · Bỏ tô** (`RowMarkActions`). Dấu ô cũ không còn hiện. -->
<!-- updated: 2026-10-06 (g) — BẢNG MÀU EXCEL + TÔ Ô + BỚT KHOẢNG TRẮNG: bảng màu 10 sắc × 5 mức (mã "<sắc>-<mức>", VD vang-5), bút tô ✎ ở ô đầu hàng tên cột tô NHIỀU Ô một lúc (bấm/kéo, ô đầu dòng = cả dòng, Shift+bấm = vùng, Esc thả; bút dùng chung cả 3 bảng nhóm vì cùng khoá `ton-kho-thang`), dấu ô khoá theo khoá cột (ngay · ten · size · invoice · gia · odKg · inKg · outKg · ocKg · tien · viTri). Bảng hẹp 2.081 → 1.623px: ô số w-24, size w-20, invoice w-28, vị trí w-40, tên hàng xuống dòng ≤ 13rem, nút cuối dòng icon-sm, chữ "Cộng <nhóm>" trải qua các cột đầu (trước nằm trong cột Ngày nhập làm cột này rộng 230px), đệm ô theo mật độ. -->
<!-- updated: 2026-10-06 (f) — XỔ BẢNG RA + TÔ MÀU DÒNG: bảng mỗi nhóm đổi `SummaryTable stickyHeader` (khung cuộn riêng ≤70dvh — người dùng than "bọc", khó nhìn tổng quát) → `SummaryTable fullHeight`: bảng trải hết, trang cuộn một mạch; hàng tên cột NỔI dính ngay dưới header trang khi cuộn qua bảng (đo cột thật, khớp 0px, đồng bộ cuộn ngang), bảng rộng (~2.000px ở chế độ gõ) có thanh cuộn ngang DÍNH ĐÁY màn hình. Bật `rowMarkKey="ton-kho-thang"`: nút 🪣 đầu mỗi dòng (cạnh ô tick) tô vàng/xanh lá/xanh dương/đỏ + in đậm + bỏ tô, LƯU CHUNG bảng row_marks (mig 0055) theo id dòng sổ (`msl|…`/`carry|…`/`xlsx|…` — đổi id là mất dấu); thanh "Đã chọn N dòng" có nút "Tô màu N dòng" (hàng loạt, toast + Hoàn tác, đổi màu giữ in đậm riêng từng dòng). Kiểm demo: tô 1 dòng + in đậm, tô hàng loạt 2 dòng, Hoàn tác trả đúng dấu cũ; 360px + 130% không cuộn ngang trang. -->
<!-- updated: 2026-10-06 (b) — GÕ THẲNG TRÊN BẢNG, BỎ CHẾ ĐỘ "Ghi nhập/xuất" RIÊNG: bảng theo nhóm (SummaryTable, giữ tick dòng · tổng nhóm · nút thao tác) nay là bảng nhập luôn — Ngày nhập (date) · Size · Invoice (input) · Đơn giá · Tồn đầu · Nhập · Xuất (`ONhapSo` + `navCol` trong khung `[data-grid-nav]`: gõ số/biểu thức, Esc trả số cũ, ghi theo phím, Enter/↑/↓ đi dọc cột qua cả các nhóm) · Vị trí (Combobox); Tồn cuối · Tiền còn lại vẫn là ô TÍNH; Tên · nhóm đổi ở ✎. Dán khối TSV từ Excel (`pasteBlock`, cột theo thứ tự Đơn giá·Tồn đầu·Nhập·Xuất, `(2.000)`=−2.000, ô rỗng giữ số cũ, MỘT lần ghi). Hoàn tác/Làm lại (nút + Ctrl+Z/Ctrl+Y, bỏ qua khi gõ trong hộp thoại) cho MỌI lần ghi sổ của màn: `writeLines` bọc lại chụp sổ trước khi ghi, gõ liên tiếp cùng ô = một bước (khuôn Cân đối). "Sửa tay" ở đối chiếu lệch nay lọc bảng bằng ô Tìm. Xem trước dồn kỳ: chỉ hiện số. Kiểm demo: 1200+300 ⇒ 1.500, Enter xuống dòng nhóm kế; Ctrl+Z một bước; dán 2×3 đúng; 360px + 130% không tràn. --><!-- updated: 2026-10-06 — CÂN ĐỐI GHI VÀO SỔ (lib/balancingStockLines.ts): dòng Lấy xả đông ở khối NL Cân đối chọn ĐÍCH DANH một dòng (lô) của sổ ⇒ cột Xuất của lô + dòng vết `⟦CĐ:<id dòng cân đối>:<kg>⟧` trong ghi chú; dòng Gửi đông ⇒ lô RIÊNG id `cd|<id dòng>|<ngày>` nhóm "Nguyên liệu gửi đông" (invoice GĐ-yyyymmdd). Tháng chưa mở ⇒ Cân đối tự kế thừa như nút "Kế thừa & lưu vào sổ". Xem § "Dòng do Cân đối ghi". -->
ttl_days: 90
<!-- updated: 2026-10-12 — SỬA LỖI AUDIT SỔ KHO THÁNG + NXT: (1) dồn LẠI không còn xoá trắng tháng sau — MỘT hàm ghi `carryForwardIntoLedger` (monthlyStock.ts) dùng chung cho gõ ở xem trước / "Kế thừa & lưu" / "Dồn sang tháng sau" / Cân đối `ensureMonthOpened`: id carry đã có ⇒ CHỈ đổi openKg/openCtn (giữ nhập/xuất, vị trí, ghi chú, vết ⟦CĐ⟧); carry mất nguồn/nguồn về 0 ⇒ tồn đầu 0 (trống hẳn + không ghi chú thì bỏ). (2) gõ ở xem trước khi đang lọc MỘT kho (tháng đã có dòng kho khác) chỉ dồn kho đó (`khoDon`) — trước đặt lại carry của kho khác. (3) id nạp Excel theo SỐ tháng `xlsx|<kho>|<tháng>|<năm>|<row>` (`idDongNap`) + `ghepNapLai` dọn theo `period` của dòng, nhận id dạng cũ theo tên sheet; cùng vị trí mà tên hàng khác ⇒ không thừa kế vị trí/ghi chú + cảnh báo; hai sheet cùng tháng ⇒ chặn. (4) parser: dòng chỉ có ô "" không làm lệch dòng cộng khối con. (5) dồn kỳ theo KG (dòng còn lẻ kiện không dồn mãi). (6) `num()` không in "-0". (7) /nxt-warehouse: dòng kho chỉ nhận ở đầu trang (chân file không đẻ kho rác); "Tạo kỳ kế tiếp" dồn mọi dòng của kỳ (không theo chip kho lưu), chỉ cập nhật tồn đầu mã đã có, mang giá trị cuối, mặc định từ ngày = ngày sau kỳ cũ. -->
<!-- updated: 2026-10-06 (e) — ô "Ánh xạ … tới" (hộp Đồng bộ danh mục): gõ tên chưa có ⇒ LƯU NGAY vào danh mục đích của dòng (`addCanonicalName` — Mặt hàng hoặc Loại NL theo select đích; trùng tên không phân hoa thường ⇒ dùng lại; đích "Bỏ qua" ⇒ không cho tạo), theo luật ô chọn danh mục (design-system README). Trước đây `onCreate={(t)=>t}` chỉ giữ tên tới khi bấm Đồng bộ. Tên GỐC từ file (chưa ai chọn) vẫn hiện nhãn "mới — thêm … khi bấm Đồng bộ" và `apDongBo` vẫn thêm như cũ (không trùng vì dò `chuan`). -->
<!-- updated: 2026-09-29 (3) — hộp Đồng bộ danh mục: nút xác nhận "Đồng bộ: n → Mặt hàng · m → Loại NL" chuyển xuống CHÂN hộp (dính đáy khi cuộn, không disabled); ô ánh xạ hiện tên vừa gõ "thêm mới" kèm nhãn "mới"; ô co giãn ở điện thoại. -->
<!-- updated: 2026-09-29 (2) — Size thành CỘT RIÊNG (bảng xem · lưới Ghi sửa tại ô · phiếu in) thay dòng phụ dưới tên; parser điền ô GỘP dọc cột 0–5 (ngày nhập/invoice gộp cho cả lô nhiều size — trước chỉ dòng đầu có) và đọc KHÔNG cellDates (SheetJS dựng Date lệch giây múi giờ ⇒ ngày lùi 1 ngày ở VN); id nạp không đổi (kiểm file thật). -->
<!-- updated: 2026-09-29 — parser đọc cột R (ghi chú kho → vị trí), mục III HÀNG TẠM + mục La Mã lạ, khối con "TỔNG 2 DA" theo vùng SUM; dialog soát tiêu đề kho + bản nạp ở kho khác; nạp lại bỏ dòng cũ toàn-0 không còn trong file. Kiểm trên file thật 8 sheet → 1.585 dòng, T8 khớp TỔNG HÀNG NỘI ĐỊA 77.950,53/76.824,63. -->
<!-- re-verified: 2026-09-18 10:30 — apThaoTacLo "chuyển kho": full (kg>=closeKg) chỉ đổi storageLocation KHÔNG tách dòng, partial mới tách dòng mới id `msl|…` (monthlyStock.ts:507-538 + MonthlyStockScreen.tsx:502-532); XEM TRƯỚC ẩn nút Chuyển kho/Lấy ra/Gán vị trí (guard `!laXemTruoc`, MonthlyStockScreen.tsx:809,1153,1163) — khớp code. -->
<!-- updated: 2026-09-15 (2) — thao tác một dòng `applyLotAction` (lấy ra dùng · nhập thêm · chuyển kho, nhật ký vào `note`) + nút Ẩn/Hiện dòng trống (`isEmptyLine`) + hướng dẫn nút ? (`guideContent.tsx` khóa `ton-kho-thang`) + dòng gợi ý "Cách thao tác". -->
<!-- updated: 2026-09-15 — bảng xem & lưới Ghi chỉ còn KG (bỏ cột kiện + KG/kiện; dữ liệu kiện vẫn lưu/nạp/dồn kỳ); cột `origin` hiển thị là INVOICE; Ngày nhập tách thành cột đầu; thêm cột Vị trí cuối bảng (mig 0045) + nút Gán vị trí cho dòng tick; header bảng dính (SummaryTable `stickyHeader`). -->
<!-- re-verified: 2026-09-09 15:00 — id nhập `xlsx|<mã kho>|<sheet>|<năm>|<rowIndex>` (MonthlyStockScreen:419), khoaLo đối chiếu = kho·nhóm·tên name-level (monthlyStock.ts:199), migration 0041 create-if-not-exists idempotent — khớp code. -->
<!-- re-verified: 2026-09-11 16:40 — parser cột 0/1/2/3/4/5/8-13 + nhóm "NHẬP KHẨU"/"MUA NGOÀI" + bỏ dòng "TỔNG" (monthlyStockExcel.ts:105-146), nhận sheet số tháng qua suyThang() "1".."12"/"T8"/"Tháng 8" (monthlyStockExcel.ts:94-103), id nạp `xlsx|${maKho}|${sheetName}|${nam}|${rowIndex}` + nạp lại thay-theo-id giuLai=filter(!idMoi) (MonthlyStockScreen.tsx:503,529-531), namTuTenFile year=/20\d{2}/ (monthlyStockExcel.ts:164-167) — khớp code. -->
<!-- re-verified: 2026-09-15 15:30 — donSangThang(nguon, thangDich) + idDon `carry|<id-nguồn>` (monthlyStock.ts) và EmptyState "Kế thừa tồn cuối tháng trước" (MonthlyStockScreen) đúng như doc mô tả TRƯỚC đợt này; khoaLo = kho·nhóm·tên name-level (monthlyStock.ts:199) vẫn là khóa gộp — tái dùng cho thẻ kho. Đã kiểm trên DB thật: T9/2026 trống, T8 có 143 dòng / 1.478.897,83 kg. -->

# Sổ kho theo THÁNG dương lịch (`/monthly-stock`)

Số hoá "bảng kê kho" mà kế toán/thủ kho đang giữ trên Excel (mỗi sheet một tháng — nguồn: `kho 1000 năm 2026.xlsx`, "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"). Trả lời câu: **cuối tháng này tồn bao nhiêu, và số đó tự thành tồn đầu tháng sau** — hết chép tay.

## Vì sao tách MODULE RIÊNG (không gộp NXT sẵn có)

Đã có ba sổ tồn, nhưng **không cái nào theo tháng dương lịch cho MỌI đối tượng**:

| Sổ | Kỳ | Đối tượng | Đơn vị |
|---|---|---|---|
| `/nxt-material` (`MaterialNxtScreen`) | kỳ CÂN ĐỐI (lô, ~5 ngày) | nguyên liệu | kg |
| `/nxt` (`NxtReportScreen`) | khoảng ngày | thành phẩm/BTP | kg |
| `/nxt-warehouse` (`WarehouseNxtScreen`) | khoảng ngày tuỳ ý | 1 nhóm mã (seed bạch tuộc) | kg |
| **`/monthly-stock`** (module này) | **THÁNG dương lịch** | **NL + BTP + TP (chung)** | **kg** (kiện vẫn lưu, không hiện) |

Bảng kê thật theo dõi song song **kiện** và **kg**, có **đơn giá + tiền còn lại**, nhóm theo **loại hàng** (nhập khẩu / mua ngoài…). File Excel gốc dồn kỳ SAI ở dòng tổng (tồn đầu nhập khẩu đóng băng 859.444 kg suốt 7 tháng, tồn nội địa reset 0 mỗi tháng) — đúng nỗi đau "tồn cuối kỳ sai do ghi tay". Module này **ép cứng** dồn kỳ đúng.

⚠️ Module này KHÔNG đụng `/nxt-material`, `/nxt`, `/nxt-warehouse`, `balancingCalc.ts`, `production_locks`, `material_opening_stock` — chỉ đọc/ghi bảng riêng `monthly_stock_ledger`.

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

`buildCarryForwardLines(nguon, thangDich)` dựng dòng tồn đầu tháng đích = tồn cuối tháng nguồn (nhập/xuất = 0), giữ nguyên mô tả (nhóm, kho, tên, size, xuất xứ, đơn giá).

- **id tất định** `carry|<id-dòng-nguồn>` (`idDon`) ⇒ dồn lại nhiều lần chỉ **CẬP NHẬT**, KHÔNG nhân đôi.
- **GHI qua MỘT hàm `carryForwardIntoLedger(lines, thangDich, kho?)`** (2026-10-12) — dùng chung cho gõ ở xem trước (`soNenDeGhi`), "Kế thừa & lưu vào sổ" (`carryFromPrevMonth`), "Dồn sang tháng sau" (`carryToNextMonth`) và Cân đối (`ensureMonthOpened`). `buildCarryForwardLines` chỉ còn để DỰNG bảng xem trước.
  - id carry **đã có** ở tháng đích ⇒ **CHỈ đổi `openKg/openCtn`**; nhập/xuất, vị trí, ghi chú, vết `⟦CĐ:…⟧` của Cân đối giữ nguyên. Trước đây thay CẢ dòng ⇒ quay lại sửa tháng trước rồi dồn lại là xoá trắng số đã ghi ở tháng sau.
  - dòng `carry|…` ở tháng đích mà nguồn **đã hết tồn hoặc bị xoá** ⇒ tồn đầu về 0 (trước giữ tồn đầu cũ ⇒ tồn ma); trống hẳn (không nhập/xuất, không ghi chú) thì bỏ, còn số thì GIỮ. Dòng nhập tay (`msl|…`, `xlsx|…`, `cd|…`) không bị đụng.
  - `kho` (tuỳ chọn) = chỉ dồn dòng của kho đó; dòng carry khác kho để nguyên.
- Chỉ mang sang dòng **còn tồn theo KG** (tồn cuối kg ≠ 0) — kg là đơn vị ghi sổ; dòng hết kg mà còn lẻ kiện không dồn (trước dồn mãi một dòng hiện toàn số 0). Nút "Dồn sang tháng sau" (`coTonSang`) cũng theo kg.
- Hai chiều: nút **"Dồn sang tháng sau"** (đẩy, dùng TOÀN BỘ dòng của tháng — bỏ qua bộ lọc kho) và **"Kế thừa & lưu vào sổ"** (kéo, ở banner XEM TRƯỚC của tháng trống — xem § Màn hình).

## Màn hình

- Chọn kỳ = tháng (Combobox + nút ◀ ▶), lọc theo kho (5 kho hệ thống `BSF1_WAREHOUSES` + kho lạ nếu có), **ô "Tìm mặt hàng"** (lọc theo tên · size · invoice · nhóm · kho · vị trí), MỘT bảng theo nhóm (nhóm × bảng + dòng cộng nhóm) **gõ thẳng được** — xem § Gõ THẲNG trên bảng. Tên · nhóm sửa ở nút ✎ dialog.
- **Ô gõ không viền (2026-10-15):** người dùng chốt "bỏ các ô bao quanh dữ liệu" — ô gõ trên bảng đọc như bảng kê Excel (không viền, không nền); khung hiện khi rê chuột / đang gõ (`textCell`), ô ngày trống giấu "dd/mm/yyyy" + icon lịch tới khi rê/bấm (`emptyDateCell`), ô Vị trí là `Combobox inline`.
- **Hàng tạm từ sản xuất (2026-10-15):** lô có id `wip|…` do xưởng ghi ở `/wip` (khối "Hàng đông lạnh nhập kho") — nhãn **"Từ SX · <xưởng>"** dưới tên hàng (`isFromProductionFrozen`, gồm cả dòng dồn kỳ), đầu nhóm Hàng tạm ghi tổng kg + số lô từ SX của tháng. Sửa số lô ngay trên bảng như dòng thường; bỏ lô thì ở `/wip` (khi chưa lấy ra / chưa dồn) hoặc nút 🗑 ở đây. Chi tiết: [34 § Hàng đông lạnh](34-btp-san-xuat-kho.ba-spec.md).
- **Thứ tự cột bảng xem:** Ngày nhập · Mặt hàng · **Size** (cột riêng theo bảng kê kế toán, từ 2026-09-29) · Invoice · Đơn giá · Tồn đầu kỳ (kg) · Nhập trong kỳ (kg) · Xuất trong kỳ (kg) · Tồn cuối kỳ (kg) · Tiền còn lại · **Vị trí** · thao tác. Bảng mỗi nhóm bật `SummaryTable fullHeight` (2026-10-06, thay `stickyHeader`): **không** khung cuộn riêng — bảng trải hết, trang cuộn một mạch; cuộn qua bảng thì hàng tên cột nổi dính ngay dưới header trang, bảng rộng thì thanh cuộn ngang dính đáy màn hình (không phải cuộn xuống đáy bảng mới kéo ngang được).
- **Tô màu dòng "đã dò"** (`rowMarkKey="ton-kho-thang"`, bảng `row_marks` mig 0055 — lưu chung, mọi máy thấy): tick các dòng (Shift+tick chọn cả khoảng, xuyên nhóm) → thanh "Đã chọn N dòng" (nằm SAU các bảng, dính đáy màn hình trên máy tính) có **Tô màu ▾** (10 sắc × 5 mức kiểu Excel) · **In đậm** (mọi dòng đã đậm ⇒ **Bỏ in đậm**) · **Bỏ tô**, áp cho mọi dòng đang tick — không toast (thao tác trình bày, README luật 8). Dấu khoá theo **id dòng sổ** nên lọc/sắp/ẩn dòng trống không lệch; dòng ở tháng khác là bản ghi khác (dồn kỳ đẻ id `carry|…` mới) ⇒ dấu dò tháng này KHÔNG theo sang tháng sau. Chỉ là dấu trình bày — không đụng số. Luật chung: [README design-system § Tô màu dòng](../../src/design-system/README.md#tô-màu-dòng-đã-dò-kiểu-excel).
- **Cột Vị trí:** hàng gửi ra **kho ngoài** (kho thuê ngoài, không thuộc 5 kho hệ thống — `isExternalStorage`) hiện **"Gửi: &lt;kho&gt;"** đậm màu primary (VD "Gửi: Kho Ánh Dương") để kế toán thấy ngay; vị trí trong kho hệ thống hiện tên thường, để trống ⇒ tên `warehouse` màu mờ.
- **Nút "Thêm dòng" theo TỪNG NHÓM:** mỗi bảng nhóm có nút "Thêm dòng vào &lt;nhóm&gt;" ngay dưới bảng (`moThem(g.category)` điền sẵn Nhóm hàng ⇒ khỏi chọn lại, đỡ thao tác). Chế độ Ghi (lưới phẳng, không tách nhóm) giữ MỘT nút "Thêm dòng" chung ở cuối. Không còn nút ở thanh công cụ trên. Tất cả ẩn khi đang xem trước dồn kỳ (bấm "Kế thừa & lưu vào sổ" trước). ⚠ `moThem` nhận optional `catChon` ⇒ KHÔNG gán trực tiếp `onClick={moThem}` (event lọt vào tham số) — luôn bọc `onClick={() => moThem(...)}`.
- 5 thẻ `StatCardGrid` tự xếp: màn rộng (xl) một hàng 5 thẻ, lg 3+2, điện thoại 2 cột (thẻ lẻ trải hàng; chữ 130% về 1 cột).
- `groupByCategory()` xếp theo `MONTHLY_STOCK_CATEGORIES` trước, nhóm lạ cuối; mỗi nhóm có tổng riêng, thẻ `StatCardGrid` tổng toàn tháng (gồm tiền còn lại). In A4 (`PrintSheet`).
- Tháng mặc định = tháng hiện tại (`getCurrentMonth`).

### Thao tác một dòng — nút 📦− cuối dòng (`applyLotAction`, hàm thuần)

Dialog 3 việc, số kg + ngày + ghi chú; mọi lần lưu nối một dòng `dd/mm/yyyy: <việc> <kg> — <ghi chú>` vào `note` (hiện ở Thẻ kho mục "Nhật ký thao tác"), toast có **Hoàn tác**. Ẩn khi đang xem trước dồn kỳ.

- **Lấy ra sử dụng** — CỘNG DỒN vào `outKg` (kiện theo `kgPerCtn` nếu có). Chặn vượt tồn cuối.
- **Nhập thêm** — cộng dồn `inKg` cho đúng lô đó (lô khác ngày nhập/invoice ⇒ "Thêm dòng").
- **Gửi kho ngoài** (nhãn UI của kiểu `chuyen`; mô tả nêu rõ "Ánh Dương, HP…") — KHÔNG phải nhập/xuất ⇒ tổng tháng không đổi. Gửi HẾT tồn cuối ⇒ chỉ đổi `storageLocation` (cột Vị trí ghi "Gửi: &lt;kho&gt;"). Gửi MỘT PHẦN ⇒ tách dòng mới (id `msl|<tháng>|uid`, cùng mô tả, vị trí đích): kg lấy từ `openKg` trước rồi `inKg` (kiện chia cùng tỉ lệ), dòng gốc giữ `outKg` ⇒ tồn cuối gốc = cũ − X, dòng tách = X. Tổng theo tên (`khoaLo`) giữ nguyên ⇒ đối chiếu dồn kỳ không báo lệch giả. Dòng tách ghi note `(tách từ dòng <id>)`.
- ⚠ **Nạp lại Excel** tháng có dòng đã tách: dòng gốc (id `xlsx|…`) trở về số trong file ⇒ phần tách bị đếm 2 lần. `confirmImport` dò note `(tách từ dòng <id>)` và **cảnh báo** (không tự xoá).
- Khác ô gõ trên bảng: ô là tổng CẢ THÁNG (ghi đè), nút dòng là CỘNG THÊM từng lần.

### Gõ THẲNG trên bảng (không còn chế độ "Ghi nhập/xuất" riêng — 2026-10-06)

Chốt 2026-09-18: kế toán không phải mở nút ✎ cho từng dòng. Từ 2026-10-06 bỏ hẳn lưới Ghi tách riêng: **bảng theo nhóm chính là bảng nhập** (giữ tick dòng, tổng nhóm, nút thao tác cuối dòng), theo quy tắc bảng tự dựng của design-system (README §5d):

- Ô gõ: **Ngày nhập** (`<input type=date>`) · **Size** · **Invoice** (`<input>`) · **Đơn giá · Tồn đầu · Nhập · Xuất** (`ONhapSo` — gõ số hoặc phép tính, Esc trả số cũ, ghi theo phím) · **Vị trí** (`Combobox`, tạo mới tại chỗ). **Tồn cuối · Tiền còn lại** vẫn là ô TÍNH. Đổi **tên · nhóm** ở nút ✎ (ảnh hưởng cách gộp lô khi dồn kỳ).
- Phím: ô số khai `navCol`, cả các nhóm bọc chung một `[data-grid-nav]` ⇒ Enter / ↑ / ↓ đi dọc cột, dòng cuối nhóm trên xuống thẳng dòng đầu nhóm dưới; Tab đi ngang.
- **Dán khối từ Excel** (`pasteBlock`): bắt đầu từ ô đang đứng, dòng theo thứ tự đang hiện (qua các nhóm), cột theo thứ tự Đơn giá · Tồn đầu · Nhập · Xuất; hiểu `(2.000)` = −2.000; ô rỗng giữ số cũ; gom MỘT lần ghi.
- **Hoàn tác / Làm lại** (nút trên thanh công cụ + Ctrl+Z / Ctrl+Y, bỏ qua khi đang gõ trong hộp thoại): MỌI lần ghi sổ của màn (gõ ô, dán, thao tác dòng, dồn kỳ, nạp Excel…) đi qua `writeLines` bọc lại — chụp sổ TRƯỚC khi ghi, gõ liên tiếp vào CÙNG một ô = một bước lùi (cùng khuôn lưới Cân đối). Lịch sử theo phiên mở màn.
- Bản XEM TRƯỚC dồn kỳ (tháng trống — VD tháng hiện tại khi sổ mới tới tháng trước) **cũng gõ được**: lần gõ/dán đầu tiên tự KẾ THỪA tồn cuối tháng trước (phạm vi `khoDon`, y nút "Kế thừa & lưu vào sổ") rồi ghi số vừa gõ trong CÙNG một lần ghi (`soNenDeGhi`) ⇒ Ctrl+Z lùi cả hai; id dòng kế thừa `carry|<id>` = id dòng đang xem trước nên ô không mất con trỏ. Cùng quy tắc "tháng chưa mở thì tự kế thừa" của Cân đối (chốt 2026-10-06). Trước bản này ô bị khoá ở xem trước ⇒ người dùng mở tháng 10 (sổ thật mới tới tháng 9) thấy bảng không sửa được.
- "Sửa tay" trong hộp **Đối chiếu & sửa lệch** lọc bảng về đúng mặt hàng (ô Tìm) để sửa ngay trên bảng.
- **Ghi DÒNG MỚI ngay trên bảng** (`quickAddRow`, slot `SummaryTable.addRow`): cuối mỗi bảng nhóm có dòng "+ Dòng mới" — gõ/chọn tên hàng (Combobox: tên cùng nhóm lên đầu, rồi tên đã có trong sổ + danh mục loại NL + mặt hàng; gõ tên chưa có ⇒ "Thêm mới") là dòng hiện luôn trong bảng: nhóm của bảng, tháng đang xem, kho đang lọc ("Tất cả kho" ⇒ Kho 1500 tấn), id `msl|<tháng>|uid`; con trỏ nhảy sang ô **Nhập** của dòng đó để gõ số tiếp (ô số mang `data-row`). Tháng đang xem trước ⇒ tự kế thừa & lưu trước. Bị ô Tìm / Ẩn dòng trống che ⇒ tự bỏ lọc cho thấy dòng mới. Nút "Thêm đủ thông tin…" cạnh đó mở hộp thoại cũ (điền nhiều ô một lần, đổi nhóm) — hộp này cũng không còn chặn ở tháng xem trước (lưu là tự kế thừa).
- **Lưu vết (audit) đảm bảo cho MỌI đường sửa** — inline lẫn dialog: mọi `writeLines` đi qua chốt `logChanges` ([repo.ts](../../src/lib/repo.ts)) → so cũ↔mới từng ô, ghi `audit_log` kèm người · thiết bị · thời điểm · giá trị cũ→mới; bảng **append-only** (RLS cấm UPDATE/DELETE, mig `0025`). Xem màn Nhật ký thao tác. Sửa trực tiếp KHÔNG làm yếu vết.
- 🅿️ **Backlog bảo mật (ghi nhận 2026-09-18, CHƯA làm):** (1) **khóa tháng đã chốt** — tháng đóng sổ thì khóa, muốn sửa số phải mở khóa có ghi vết (chống sửa lén sổ cũ); (2) **siết RLS theo vai trò** cho `monthly_stock_ledger` ai được sửa (🔴 đụng RLS server) — nằm chung backlog RLS `0021` trong CLAUDE.md.

### Ẩn / hiện dòng trống

Nút **Ẩn dòng trống (n)** (`aria-pressed`) lọc bỏ dòng `isEmptyLine` (tồn đầu = nhập = xuất = 0, cả kg lẫn kiện) khỏi bảng, tổng, in, tick. Mặc định HIỆN (tránh tưởng mất dòng); không nhớ qua lần mở. Đổi trạng thái ⇒ bỏ chọn. Ẩn hết ⇒ ô báo + nút "Hiện tất cả".

### Tick dòng → cộng tổng · in riêng · xóa theo lô

Bảng bật cột ô tick qua prop `chon` của `SummaryTable` (`TableSelection` — xem [design-system README](../../src/design-system/README.md)); màn giữ `daChon: Set<id>`, **không sửa dữ liệu**. Tick vài dòng ⇒ hiện thanh cộng tổng của ĐÚNG mấy dòng đó (tồn đầu · nhập · xuất · tồn cuối theo kg, + tiền còn lại) — việc kế toán làm suốt mà trước phải bấm máy tính tay. Kèm:

- **Chuyển bảng** (nút bulk) — hộp 2 ô: Bảng nhận (nhóm hàng) · Kho nhận; trống = giữ của từng dòng, phải chọn ít nhất một (`ErrorSummary`). `moveLinesToTable` đổi dòng tick + dòng dồn của chúng ở tháng sau đã mở (`followTableChange`), kg không đổi, toast Hoàn tác. Ẩn khi đang xem trước dồn kỳ. Hộp này KHÔNG lưu nháp (giống Gửi kho ngoài: chọn theo dòng đang tick, khôi phục nháp khi đã mất tick là vô nghĩa).
- **Gửi kho ngoài** (nút bulk, trước tên "Gán vị trí") — Combobox "Kho nhận (VD Kho Ánh Dương, HP)", ghi `storageLocation` cho mọi dòng tick (toast Hoàn tác). Ẩn khi đang xem trước dồn kỳ.
- **In {n} dòng** — `PrintSheet` in đúng dòng đã tick (`rowsIn = rowsChon.length ? rowsChon : rowsThang`, tổng + gom nhóm tính lại theo đó).
- **Xóa dòng đã chọn** — qua `ConfirmDelete` + toast **Hoàn tác** (không xóa lặng lẽ). Ẩn khi đang xem trước dồn kỳ.
- Ô tick ở đầu bảng mỗi nhóm = chọn/bỏ cả nhóm; nút "Chọn tất cả / Bỏ chọn hết" ở thanh công cụ. Đổi tháng/kho ⇒ bỏ chọn (tránh cộng nhầm dòng của kỳ khác).

### Thẻ kho (sổ chi tiết vật tư) — nút 🕘 mỗi dòng

`buildProductStockCard(lines, khoaLo(row))` dựng lịch sử **một mặt hàng** qua tối đa 24 tháng: mỗi tháng một dòng tồn đầu · nhập · xuất · tồn cuối (mới → cũ), tháng đang xem tô nền. Khóa gộp là **`khoaLo` (kho·nhóm·TÊN, bỏ size)** — CÙNG khóa với `compareCarryForward`, nên lô tách theo size cộng lại thành một dòng tháng thay vì đẻ ra mấy dòng rời. Hàm thuần, chỉ đọc. Đọc dọc cột tồn cuối ↔ tồn đầu dòng dưới là thấy ngay chỗ đứt vòng gối đầu.

### Tháng trống ⇒ XEM TRƯỚC dồn kỳ (không còn "trống trơn")

Tháng đang xem chưa có dòng nào **và** tháng trước còn tồn ⇒ màn dựng sẵn `buildCarryForwardLines(tháng trước, tháng này).map(suyDong)` và hiển thị **y như bảng thật**, kèm banner "Xem trước tồn đầu … CHƯA LƯU" + nút **"Kế thừa & lưu vào sổ"**.

- **Vì sao xem trước chứ không tự ghi:** dồn kỳ vẫn phải qua bước người duyệt — lô hay bị tách size / đổi mã lô giữa các tháng, tự ghi đè là đường thẳng tới **cộng đôi** (xem § Cờ lệch dồn kỳ). Xem trước cho thấy số ngay mà không chạm dữ liệu; một cú bấm mới ghi.
- Trong chế độ xem trước: ô vẫn gõ được (gõ là tự kế thừa & lưu), ẩn nút Hoàn tác/Làm lại (Ctrl+Z vẫn chạy), ẩn ✎ và 🗑 từng dòng, ẩn 📦− (Chuyển kho/Lấy ra) + "Gán vị trí", **tắt banner "Lệch dồn kỳ"** (lệch lúc này chính là phần chưa dồn — banner xem trước đã nói rồi, hiện thêm cảnh báo đỏ chỉ làm tưởng sai số).
- ⚠ **"Thêm dòng" bị chặn khi đang xem trước** (`moThem` → `notify.warning`, không mở form): thêm+lưu 1 dòng sẽ khiến `rowsLuu` ≠ rỗng ⇒ tắt xem trước ⇒ cả bảng kế thừa (chưa lưu) biến mất khỏi màn — dễ tưởng mất số liệu. Bắt bấm "Kế thừa & lưu vào sổ" trước. Muốn ghi hàng **đông gửi kho ngoài** (Ánh Dương/HP…) cũng vậy: lưu sổ trước, rồi tick dòng → **"Gửi kho ngoài"**, hoặc 📦− → **"Gửi kho ngoài"** (dùng cột **Vị trí**, KHÔNG đẻ khái niệm dòng gửi riêng — chốt 2026-09-18).
- Dòng xem trước lọc theo kho đang chọn (xem trước = kho đang lọc chưa có dòng). Phạm vi GHI (`khoDon`): tháng còn trống HẲN ⇒ "Kế thừa & lưu" / gõ ô dồn **toàn bộ kho** (đúng quy tắc "dồn kỳ không bỏ sót kho nào"); tháng đã có dòng ở kho KHÁC (lọc một kho còn trống) ⇒ **chỉ kho đang lọc** — trước 2026-10-12 gõ một ô khi lọc K1000T đặt lại dòng carry của K1500T trong tháng.

## Nhập Excel bảng kê (seed số cũ)

Nút **"Nhập Excel bảng kê"** đọc thẳng file `kho ... .xlsx` ("BẢNG KÊ NGUYÊN LIỆU KHO 1500 T"): parser `src/lib/monthlyStockExcel.ts` (`parseStockStatementFile`, dùng `xlsx`/SheetJS như `nxtExcel.ts`).

- **Ô gộp dọc** ở cột 0–5 (kế toán gộp một ô Ngày nhập / Invoice cho cả lô nhiều size) ⇒ `donOGop` chép giá trị ô đầu xuống các dòng trong vùng gộp — CHỈ dòng đã có dữ liệu (không biến dòng trống thành dòng có chữ ⇒ `rowIndex`/id không xê dịch).
- ⚠ Đọc workbook **KHÔNG bật `cellDates`**: SheetJS dựng Date lệch vài chục giây theo múi giờ (VN ra 23:59:30 hôm trước) ⇒ ngày nhập lùi 1 ngày. Ngày lấy từ số serial Excel (`toIsoDate`, tính UTC).
- Mỗi **sheet = một tháng** (tên sheet là số tháng 1–12). Cột 0-based: 0 ngày nhập · 1 tên · 2 kg/kiện · 3 giá · 4 xuất xứ (thực chất số INVOICE → `origin`) · 5 size · 8/9 tồn đầu (kiện/kg) · 10/11 nhập · 12/13 xuất. **Bỏ** 6/7 "Nhập đầu kỳ" (số tham chiếu tĩnh) và 14/15/16 (tồn cuối + tiền = SUY ở app).
- Nhóm lấy từ dòng tiêu đề mục: "I HÀNG NHẬP KHẨU" → NL nhập khẩu · "II HÀNG MUA NGOÀI" (dòng cộng ghi "HÀNG NỘI ĐỊA") → NL mua ngoài · **"III HÀNG TẠM" → nhóm `Hàng tạm`** (trước 2026-09-29 bị dồn vào mua ngoài) · mục số La Mã lạ (IV, V…) ⇒ nhóm mới theo tên. Dòng **"TỔNG …"/"CỘNG …"** và mọi dòng **trước mục đầu tiên** đều bỏ (kiểm "TỔNG" TRƯỚC khi dò mục vì "TỔNG HÀNG NHẬP KHẨU" cũng chứa "NHẬP KHẨU").
- **Khối con** — dòng cộng không phải "TỔNG HÀNG …" (thực tế: **"TỔNG 2 DA"** trong mục nhập khẩu = bạch tuộc 2/3/4/5 DA RÂU NGẮN) ⇒ tách nhóm **`<mục> – 2 DA`**, xếp ngay sau nhóm cha (`groupByCategory`). Dòng ĐẦU khối lấy từ **công thức SUM của chính dòng cộng** (dòng nhỏ nhất trong các vùng J…Q — kế toán khoanh vùng lệch nhau giữa cột, VD T8 `J98` nhưng `P84`; lấy min = dòng 2 DA đầu tiên, khớp cả 8 sheet). Parser dịch chỉ số `rows` (blankrows:false — giữ `rowIndex` cũ trong id) ⇄ dòng Excel bằng bản đọc đủ dòng; điều kiện "dòng có dữ liệu" phải ĐÚNG như SheetJS (ô `v != null` — ô chuỗi rỗng `""` vẫn tính), không thì lệch dòng và đọc SUM sai (sửa 2026-10-12).
- **Cột R (0-based 17) = ghi chú kho:** "GỬI KHO HP" / "gừi kho HP" / "GỬI KHO Á D" / "gửi kho phước cơ" ⇒ `khoGhi` = phần sau chữ "KHO" ⇒ `storageLocation` = kho trong danh mục **`storage_locations`** khớp theo **mã** (có/không tiền tố K: HP ≡ `KHP` Kho Hồng Phú, Á D ≡ `KAD` Kho Ánh Dương) hoặc theo tên (`findWarehouseByText`); viết tắt lạ ⇒ tự thêm kho thuê ngoài "Kho <Tên>" mã `K<VIẾTTẮT>`. **Thêm kho mới = thêm vào danh mục Kho lưu kèm mã** là lần nạp sau tự nhận. Chữ khác ở cột R (VD "xuất trả lại 4240") ⇒ `note` "Bảng kê: …"; số ở cột R (công thức phụ) bỏ qua. Dòng không ghi ⇒ hàng ở chính kho của sổ (giữ vị trí đã gán tay nếu có).
- Dialog cho chọn **Năm** (suy từ tên file, VD "năm 2026") + **Kho** (Combobox 5 kho hệ thống `BSF1_WAREHOUSES` — K1000T/K1500T/KX-DONG/KX-CA/KX-KHO, mặc định Kho 1500 tấn; cho tạo mới tại chỗ), xem trước số dòng mỗi tháng. **Một file = một kho** (bảng kê theo từng kho). id nạp **tất định** `xlsx|<mã kho>|<SỐ tháng>|<năm>|<rowIndex>` (`idDongNap`, 2026-10-12 — trước là TÊN sheet: đổi sheet "8" → "T8"/"08" rồi nạp lại ⇒ tháng 8 nhân đôi). Sổ thật nạp từ sheet tên "1".."8" ⇒ id cũ trùng y id mới, không đổi gì. CÓ mã kho nên nhập nhiều kho cùng tháng KHÔNG đè nhau; nạp lại cùng file+năm+kho chỉ CẬP NHẬT. Hai sheet cùng một tháng trong file ⇒ chặn, báo sửa file.
- Ghép bản nạp = hàm thuần `ghepNapLai(lines, moi, maKho)` (monthlyStockExcel.ts). Dòng cũ KHỚP = cùng id, hoặc (id dạng cũ theo tên sheet) cùng kho · `period` · rowIndex ⇒ thay bằng dòng mới (toast "thay n dòng nạp cũ").
- Dòng file KHÔNG ghi kho ở cột R ⇒ nạp lại **giữ `storageLocation`** đã gán tay của dòng khớp; có ghi ⇒ file thắng. `note` cũ giữ nguyên trừ khi cột R có ghi chú. **Khớp mà TÊN HÀNG khác** (file chèn/xoá dòng ⇒ rowIndex trượt) ⇒ KHÔNG thừa kế vị trí/ghi chú + cảnh báo "n dòng đổi tên hàng".
- **Nạp lại dọn dòng cũ** theo **`period` của dòng** (cùng kho + tháng nạp), không theo tiền tố id: dòng file mới không còn ⇒ toàn số 0 thì BỎ (VD 8 dòng tiêu đề "HÀNG TẠM" parser cũ nạp nhầm), còn số thì GIỮ + cảnh báo.
- **Dialog soát trước khi nạp:** hiện số kho ở tiêu đề sheet ("KHO 1500") và cảnh báo nếu khác kho đang chọn; cảnh báo ĐỎ nếu năm đó đã có bản nạp ở kho KHÁC (nạp = bản sao cộng đôi); liệt kê nhóm theo mục + vị trí đọc từ cột R. Kho mặc định = kho của bản đã nạp cùng năm → kho khớp số tiêu đề → K1500T.
- **Nạp TRUNG THỰC theo sổ cũ** — KHÔNG chép tồn cuối của file (file gốc dồn kỳ sai ở dòng tổng). Sau khi nạp, mở tháng đầu rồi bấm "Dồn sang tháng sau" lần lượt để **chuẩn hóa** tồn đầu các tháng kế.
- ⚠️ **CHỌN ĐÚNG KHO — mặc định K1500T có thể SAI.** Mã kho nằm TRONG id (`xlsx|<mã kho>|…`), nên nạp NHẦM kho ≠ ghi đè: nó tạo BẢN SAO ở kho khác → "Tất cả kho" cộng đôi (khắc phục: xoá bản thừa theo `warehouse` rồi nạp lại đúng kho — id trùng khớp nên lần đúng chỉ CẬP NHẬT). File **`kho 1000 năm 2026`** thực tế thuộc **Kho 1000 tấn (K1000T)** (theo chủ dữ liệu 2026-09-11) DÙ tiêu đề mỗi sheet ghi "…KHO 1500" — tên file/tiêu đề chỏi nhau, **đừng theo mặc định**, hỏi/đối chiếu trước khi nạp.
- Kiểm thật: file `.xlsx` cũ 7 sheet → 1.405 dòng; file `.numbers` cập nhật (2026-09-11) **8 sheet → 1.593 dòng** (thêm tháng 8; T1–7 cùng số dòng nhưng vài giá trị đã sửa). `.numbers` phải convert sang `.xlsx` (giữ tên sheet + vị trí cột) trước khi nạp — module chỉ đọc `.xlsx`. Nạp lại idempotent (1593→1593), id duy nhất.

## Cờ lệch dồn kỳ + Đối chiếu (SOI + sửa tay, KHÔNG tự ghi đè)

Sau khi nạp cả năm, mỗi tháng vẫn giữ số theo file. Module **gắn cờ** khi tồn đầu
tháng này ≠ tồn cuối tháng trước (`measureCarryForwardGap`, so tổng + tách theo nhóm; ngưỡng
1 kg). Banner warning hiện tổng lệch + nhóm chênh, kèm nút **"Đối chiếu & sửa lệch"**.

**Đối chiếu (`compareCarryForward`) — so theo MẶT HÀNG, KHÔNG theo lô:** khóa = kho·nhóm·tên,
**bỏ size + xuất xứ**. Lý do: giữa các tháng một lô hay bị **tách theo size / đổi mã
lô** (VD `SANMA 38.685` tháng trước → `SANMA 3.300` + `SANMA 50-90 35.385` tháng này,
tổng KHÔNG đổi). So theo (tên+size) sẽ báo động giả và nếu "áp" tự động sẽ **cộng
đôi** (đặt SANMA=38.685 trong khi bản 50-90 vẫn còn). Gộp về TÊN thì tách triệt tiêu,
chỉ còn lệch THẬT. Kiểm thật T5→T6: lot-level 28 dòng (có SANMA giả) → **name-level 24
mặt hàng, SANMA biến mất** ✓.

**Không tự sửa** — dialog chỉ liệt kê mặt hàng lệch (tồn cuối T-1 ↔ tồn đầu T này +
Δ), mỗi dòng có **"Sửa tay"** → **lọc bảng về đúng mặt hàng đó** (ô Tìm, từ 2026-10-06 — trước là lưới Ghi `locMatHang`) để
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

Hàm thuần `analyzeCatalogSync(tênSổ, tênLoạiNL, tênMặtHàng)` → mỗi tên chưa có (ở cả
hai) kèm `roRang`, **đích gợi ý** (`inferCatalogTarget`: có size/grade hoặc dấu chế biến/phân
loại → `product`; còn lại → `material`) + **nhóm gợi ý** (`inferMaterialCategory`). Dialog:
**Đồng bộ = ÁNH XẠ, không chỉ thêm mới** (chốt với chủ dự án). MỖI dòng có: (1) **select
đích** (Mặt hàng / Loại NL / Bỏ qua); (2) **Combobox ánh xạ tới TÊN CHUẨN CÓ SẴN** —
options = toàn bộ `products` (171) khi đích = Mặt hàng, hoặc `material_types` khi đích =
Loại NL — gõ tìm chọn tên chuẩn mà mã khó thuộc về, hoặc gõ thêm mới nếu chưa có (**lưu NGAY vào danh mục đích**, 2026-10-06; bút chì sửa bản ghi đang chọn). Mã khó
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

## Dòng do Cân đối ghi (2026-10-06)

Khối nguyên liệu của Cân đối có hai dòng kho ghi THẲNG vào sổ này (chi tiết [31-can-doi-ky](31-can-doi-ky.md) § Khối 1: hai dòng kho; hàm thuần `src/lib/balancingStockLines.ts`):

- **Lấy xả đông** = cột **Xuất** của lô được chọn đích danh, theo tháng của ngày lấy. Ghi chú lô có một dòng vết mỗi dòng cân đối: `⟦CĐ:<id dòng>:<kg>⟧ Cân đối <kỳ>: lấy xả đông X kg` — **đừng sửa tay dòng vết**: nó là sổ phân bổ để Cân đối đặt lại số (đọc phần cũ, cộng phần chênh). Sửa tay cột Xuất của lô vẫn được (phần ngoài cân đối).
- **Gửi đông** = lô riêng `cd|<id dòng>|<ngày>`, nhóm **người dùng chọn** ở hộp "Gửi vào sổ kho" (mặc định "Nguyên liệu mua ngoài"; trước 2026-10-16 là nhóm riêng "Nguyên liệu gửi đông" — từ 2026-10-20 KHÔNG ghi vào đó nữa, lô cũ ở đó báo lệch ở Cân đối và dời sang bảng đã chọn khi bấm "Ghi lại vào sổ kho"), invoice `GĐ-yyyymmdd`, ngày nhập = ngày gửi, đơn giá = giá gửi của ngày đó (mig 0071). Lô này THUỘC dòng cân đối: sửa số ở Cân đối là `inKg` đổi; xoá dòng/xoá kỳ ở Cân đối là lô bị gỡ (lô đã dồn sang tháng sau thì dòng `carry|…` còn lại ⇒ cờ lệch dồn kỳ báo; bấm "Dồn sang tháng sau" lần nữa ⇒ `carryForwardIntoLedger` đưa tồn đầu dòng đó về 0, bỏ nếu trống hẳn).
- Tháng chưa mở ⇒ Cân đối tự **kế thừa** tồn cuối tháng trước (`ensureMonthOpened`, cùng `buildCarryForwardLines`, id `carry|…`) — như bấm "Kế thừa & lưu vào sổ".
- ⚠ **Nạp lại Excel** tháng có lô bị Cân đối lấy ⇒ cột Xuất + vết trở về số trong file. Cân đối thấy lệch ("Sổ kho tháng lệch n chỗ") và có nút **Ghi lại vào sổ kho** — chỉ bấm khi file Excel CHƯA tính phần lấy xả đông đó (không thì cộng đôi).

## Cạm bẫy

- **Cộng đôi**: mỗi dòng độc lập trong CÙNG một tháng ⇒ `getLineTotalKg` cộng thẳng an toàn. Nhưng KHÔNG cộng dồn tồn đầu/cuối qua NHIỀU tháng (phần kế thừa sẽ đếm lại) — module chỉ tổng trong một tháng.
- **Danh mục mở**: `category` là chuỗi tự do (Combobox tạo mới) — gõ lệch tên sẽ tách nhóm khi tổng hợp; ưu tiên chọn gợi ý sẵn.
- Tồn cuối < 0 = xuất nhiều hơn đang có ⇒ dấu hiệu ghi sai; thanh bất biến gọi tên.
- Số hiển thị qua `num()` (lib/format.ts): giá trị làm tròn 2 số lẻ ra 0 (kể cả vụn âm −5,55e−17 của phép cộng trừ) in "0", không còn "-0"; ô `soHoacGach` hiện "—".
- **Dồn kỳ ≠ sửa lệch tay:** nếu đã chỉnh TAY tồn đầu một dòng `carry|…` (VD lô tách size ở tháng đích), bấm dồn lại sẽ đặt tồn đầu dòng đó về đúng tồn cuối nguồn — sửa tách size bằng dòng riêng, đừng sửa tồn đầu của dòng carry.

## Liên quan: `/nxt-warehouse` "Tạo kỳ kế tiếp" (WarehouseNxtScreen, 2026-10-12)

Cùng tinh thần dồn kỳ ở trên: kế thừa từ **mọi dòng của kỳ** (`rowsKy`, không theo chip kho lưu đang lọc — trước dồn thiếu dòng); kỳ đích đã có mã nào thì **chỉ đổi tồn đầu** (kg + giá trị) mã đó, giữ nhập/xuất/kho lưu/ghi chú (trước xoá cả kỳ đích); giá trị đầu kỳ mới = giá trị cuối (đầu + nhập − xuất, trước luôn 0); hộp thoại mặc định "từ ngày" = **ngày sau** ngày cuối kỳ đang xem. Nhập Excel NXT (`lib/nxtExcel.ts`): dòng "Chi nhánh:"/"KHO…" chỉ nhận ở **đầu trang, lần đầu** — chân file do chính màn xuất ra không còn đè thành kho rác.

## Cross-references

- Hook + mapping DB: [04-tang-du-lieu](04-tang-du-lieu.md) (`MONTHLY_STOCK_TABLE`)
- Bảng + migration `0041`: [03-database](03-database.md)
- Route + nav: [02-pages-navigation](02-pages-navigation.md)
- Sổ NXT nguyên liệu theo lô (khác kỳ): [31-can-doi-ky](31-can-doi-ky.md) § Tồn kho nguyên liệu
