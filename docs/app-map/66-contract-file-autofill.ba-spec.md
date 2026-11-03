# 66 — ba-spec: Up file hợp đồng ⇒ tự đọc, điền sẵn form hợp đồng (Xuất khẩu + Nhập khẩu)

> Load khi: xây hoặc sửa việc đọc file hợp đồng / phụ lục để điền form **Lập hợp đồng**, **Ghi bản sửa** (Xuất khẩu, [41](41-export-planning.ba-spec.md)) và **Lập / Sửa hợp đồng nhập** (Nhập khẩu, [45](45-import-planning.ba-spec.md)); bộ đọc `.docx` / PDF có chữ; luật "chỉ điền ô trống".
covers: src/lib/contractReader.ts, src/lib/contractFileReader.ts, src/lib/legacyWordText.ts, src/features/export-planning/ContractReadPanel.tsx, src/features/export-planning/ContractFormDialog.tsx, src/features/import-planning/ImportDialogs.tsx
last_verified: 2026-11-03
<!-- updated: 2026-11-03 (v1.2, thêm 4 file thật) — Word cũ **.doc đọc được** (17-26-NEWPOINT.doc; dùng chung bộ đọc .doc của khung xem file, ba-spec 61); **bảng Excel nhúng** trong .doc / .docx đọc đúng phần hợp đồng hiển thị (vùng `oleSize`, bỏ dòng ẩn — bảng nhúng NEWPOINT có 31 dòng, hiện 7); **bảng của PDF xuất từ Word ghép lại theo tọa độ** (13-MAT-26.pdf: ô nhiều dòng, tiêu đề 3 tầng). R1, R2 sửa theo. -->
<!-- updated: 2026-11-03 (v1.1, file thật) — 2 HĐ xuất (13-MAT-26, 17-26-NEWPOINT) là BẢN SCAN đã ký ⇒ không đọc; bố cục chép làm fixture. 2 HĐ nhập (MSA, KORNISH) là PDF có chữ ⇒ đọc được, dạng "nhãn : giá trị". R6 thêm tiêu đề bảng 2 tầng + dạng nhãn : giá trị; R3 "THESELLER" viết liền; R5 "BY LC" không dấu /, dung sai chỉ lấy chữ ngoài bảng, cảng đích từ "to Yokohama, Japan within …". A1 đóng; A2 còn chờ bản Word. -->
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-03 — `lib/contractReader.ts` (đọc + điền, thuần) · `lib/contractFileReader.ts` (.docx qua pizzip + `rowsFromDocxXml`, PDF qua `rowsFromPdf` ≤ 10 trang) · khối `ContractReadPanel` đầu hộp Lập / Sửa / Ghi bản sửa HĐ xuất và Lập / Sửa HĐ nhập. Test `contractReader.test.ts` (AC-1…12) + `guides/contractReadGuide.test.ts` (AC-16). Không đổi DB (không migration). Đọc chạy trên trình duyệt, không gửi file ra ngoài.

> **Mục đích:** oracle HÀNH VI cho việc đọc file hợp đồng. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md) / [46](46-import-planning-ui.design-spec.md)). Luật đọc số, ngày, tên hàng của khách dùng lại của [41](41-export-planning.ba-spec.md) (R22, R23, R27) — không chép lại.

## 1. Vấn đề & JTBD

- **Nguồn:** Phòng Kế hoạch đề nghị: "up hợp đồng lên là phần mềm tự điền thông tin vào các trường". Chủ dự án chốt phạm vi 2026-11-03: **cả Xuất khẩu lẫn Nhập khẩu** · chỉ đọc **Word (.docx) / PDF có chữ**, bản scan không đọc · **phụ lục / bản sửa dùng chung bộ đọc**, điền vào form Ghi bản sửa.
- **Hiện nay:** form HĐ xuất có ~20 ô đầu HĐ + ~15 ô mỗi dòng hàng; HĐ nhập có đầu HĐ + dòng hàng. Nhân viên Kế hoạch gõ tay lại từ file Word mà chính Baseafood soạn (HĐ xuất) hoặc file NCC gửi (HĐ nhập). File chỉ được đính kèm làm bằng chứng, app không đọc.
- **Mẫu thật đã xem:** `ANNEX 2 OF CONTRACT 01 HĐ 02.docx` (phụ lục HĐ `01-26-HAT` với HYAKUSAIBOU). Bảng dòng hàng có các cột Ratio tentacle and body · Size · Assortment (%) · Number pcs/kg · Average gr/pc · Dao động gr/pc · Length max · Packing · Price (usd/kg) CNF Hakata · Quantity (kgs) · Amount (USD), dòng Total, câu dung sai "10% more or less", "Time of shipment: from November, 2026 to April, 2027". Các ô này khớp gần hết ô dòng hàng của form HĐ xuất.
- **Job:** Khi có file hợp đồng / phụ lục, Nhân viên Kế hoạch muốn app điền sẵn các ô đọc được để chỉ còn soát và bổ sung, không gõ lại số.
- **Đo thành công:** với phụ lục mẫu, ≥ 15 ô điền đúng không gõ tay; 0 ô đã có giá trị bị ghi đè mà người dùng không chọn.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch | `export-plans` ghi (Xuất) · `import-plans` ghi (Nhập) | lập HĐ, ghi bản sửa, lập / sửa HĐ nhập |
| S1 | Hệ thống — bộ đọc (`lib/contractReader.ts` thuần + `lib/contractFileReader.ts` mở file) | — | đọc file, so với form, gợi ý danh mục |

Người không có quyền ghi HĐ (BGĐ, Kế toán, thủ kho) **không** dùng bộ đọc: họ không lập / sửa HĐ.

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Đọc file **HĐ xuất** khi lập HĐ ⇒ điền đầu HĐ, điều khoản, dòng hàng | U1 | S1 | 41 NV3 | mỗi HĐ mới | Must |
| NV2 | Đọc file **phụ lục / bản sửa HĐ xuất** khi ghi bản sửa ⇒ điền ngày bản sửa, nội dung sửa, điều khoản đổi, dòng hàng theo size | U1 | S1 | 41 NV5 | mỗi phụ lục | Must |
| NV3 | Đọc file **HĐ nhập** khi lập / sửa HĐ nhập ⇒ điền đối tác, số, ngày ký, tiền tệ, dòng hàng | U1 | S1 | 45 NI2, NI3 | mỗi HĐ nhập | Must |
| NV4 | Gợi ý **khách / NCC nhập khẩu / mặt hàng / cảng / loại cont** từ chữ đọc được — chỉ điền khi ra đúng một | S1 | U1 (soát) | NV1–NV3 | mỗi lần đọc | Must |
| NV5 | Hướng dẫn thao tác + hộp "?" nói loại file đọc được, luật chỉ điền ô trống, cách xử ô khác file (QT 18) | S1 | U1 | NV1–NV4 | khi đổi | Must |

## 4. Cross-user handoff map

| Từ | Sang | Khi nào | Điều kiện | Dead-end? |
|---|---|---|---|---|
| S1 (đọc xong) | U1 | ngay sau khi chọn file | luôn có kết quả: đã điền n ô · k ô khác file · danh sách không đọc được, hoặc câu báo "không đọc được" | Không — form vẫn gõ / lưu tay |
| U1 (bấm Lưu) | 41 NV3 / NV5 · 45 NI2 / NI3 | U1 lưu form | luật lưu của 41 / 45 giữ nguyên (bắt buộc, trùng số HĐ, duyệt…) | Không — Hủy ⇒ không ghi gì |

Không có user thứ hai: bộ đọc không tạo việc cho ai, không đổi bước duyệt.

## 5. Flows

### Flow NV1 — Đọc file HĐ xuất khi lập HĐ · owner U1
- **Start:** U1 đang lập HĐ xuất (41 NV3) và chọn một file hợp đồng; hoặc HĐ đã có file đính đọc được và U1 chọn đọc lại file đó.
- **Input:** file (R1) · giá trị đang có trong form · danh mục khách, danh sách cảng / tiền tệ / loại container (62), danh mục mặt hàng, tên hàng của khách (41 R23) · quyền xem giá của U1.
- **Steps:** (1) S1 mở file thành chữ (R2); (2) tìm hai bên mua / bán, lấy **đối tác = bên không phải Baseafood** (R3); (3) đọc đầu HĐ (R4), điều khoản (R5), bảng dòng hàng (R6); (4) điền theo R7 (ô trống ⇒ điền, ô có giá trị khác ⇒ liệt kê); (5) gợi ý danh mục theo R8; (6) báo kết quả (R11); (7) U1 soát, chọn "dùng giá trị trên file" cho ô muốn đổi, bổ sung ô thiếu, bấm Lưu.
- **Output:** form đã điền sẵn (chưa ghi sổ); bảng kết quả đọc gồm: số ô đã điền · danh sách ô khác file (đang ghi … — file …) · danh sách mục không đọc được / chưa có trong danh mục · cảnh báo lệch tổng.
- **End:** U1 Lưu ⇒ đi tiếp luật 41 NV3. U1 Hủy ⇒ không ghi gì. File không đọc được ⇒ câu báo tại chỗ, form như trước khi chọn file.

### Flow NV2 — Đọc phụ lục / bản sửa HĐ xuất · owner U1
- **Start:** U1 đang ghi bản sửa (41 NV5) của một HĐ và chọn file phụ lục.
- **Input:** như NV1 + **số HĐ đang sửa** + dòng hàng của bản đang dùng (form bản sửa đã chép sẵn).
- **Steps:** (1)–(3) như NV1; (4) **kiểm đúng HĐ** (R9): số HĐ trên phụ lục khác số HĐ đang sửa ⇒ dừng, báo, không điền gì cho tới khi U1 xác nhận vẫn dùng; (5) điền ngày bản sửa + nội dung sửa từ câu mục đích của phụ lục, điều khoản đổi (hạn giao, dung sai, số cont…) theo R7; (6) nối dòng phụ lục với dòng hiện có theo size (R10); (7) U1 soát, Lưu.
- **Output:** form bản sửa điền sẵn; danh sách dòng: khớp + đổi gì · dòng mới thêm từ phụ lục · dòng hiện có không thấy trên phụ lục (không tự xóa).
- **End:** U1 Lưu ⇒ bản sửa chờ duyệt như 41 NV5. Hủy ⇒ không ghi gì.

### Flow NV3 — Đọc file HĐ nhập · owner U1
- **Start:** U1 đang lập (45 NI2) hoặc sửa (45 NI3) HĐ nhập và chọn file hợp đồng.
- **Input:** file · form HĐ nhập · danh mục NCC nhập khẩu (45 §0b) · danh mục mặt hàng + lịch sử nối (45 R21).
- **Steps:** (1)–(2) như NV1, **đối tác = bên bán** (Baseafood là bên mua); (3) đọc số HĐ, ngày ký, tiền tệ, bảng dòng hàng chỉ lấy **tên hàng · kg · đơn giá** (R6 phần HĐ nhập); (4) điền theo R7; (5) gợi ý mặt hàng theo 45 R21; (6) báo kết quả; (7) U1 chọn **loại hình** (không đọc từ file) và Lưu.
- **Output / End:** như NV1, luật lưu 45 NI2 / NI3 giữ nguyên.

### Flow NV4 — Gợi ý danh mục · owner S1
- **Input:** chữ đọc được (tên đối tác, tên cảng, loại cont, tên hàng + size).
- **Steps:** chuẩn hóa tên (R8) ⇒ so với danh mục ⇒ đúng một ⇒ điền; không có ⇒ để trống + "chưa có trong danh mục: <chữ trên file>"; ≥ 2 ⇒ để trống + liệt kê các lựa chọn.
- **Output:** ô danh mục điền hoặc để trống kèm lý do. **Không bao giờ tự thêm vào danh mục** — U1 thêm qua ô chọn như thường (QT 7).
- **End:** trả về NV1 / NV2 / NV3.

### Flow NV5 — Hướng dẫn · owner S1
- **Input:** luật R1, R7, R9, R11.
- **Output:** tour + hộp "?" của Xuất khẩu và Nhập khẩu có đoạn: đọc được Word (.docx) / PDF có chữ; bản scan và Word cũ (.doc) không đọc; app chỉ điền ô trống, ô khác file thì liệt kê để chọn; app không tự lưu, không tự thêm danh mục.
- **End:** `pageTourCoverage.test.ts` xanh.

## 6. Flow optimization log

| Quyết định | Biến thể | Kết quả | Lý do | Ai chấm |
|---|---|---|---|---|
| Loại file | A. .docx + PDF có chữ, đọc trên trình duyệt | **Chọn** (chủ dự án 2026-11-03) | HĐ xuất do Baseafood soạn bằng Word ⇒ đọc chính xác, không phí, không key | Chủ dự án + Optimizer |
| Loại file | B. Đọc bản scan bằng AI trên cloud | Loại | Tốn phí theo trang, đặt key ở máy chủ (🔴), đã gác ở 41 NV17 ngày 2026-10-22 | Chủ dự án |
| Loại file | C. Đọc Word cũ (.doc) | Loại | Định dạng nhị phân, trình duyệt không đọc tin cậy ⇒ báo "lưu lại thành .docx" | Optimizer |
| Điền ô | A. Ghi đè mọi ô bằng file | Loại | File nhầm (HĐ khác, bản cũ) xóa số đúng mà không ai thấy | Domain + Optimizer |
| Điền ô | B. Chỉ điền ô trống, ô khác file liệt kê để chọn | **Chọn** | Giống 41 R27 (invoice) — người dùng đã quen; không mất số | Optimizer |
| Điền ô | C. Hỏi từng ô trước khi điền | Loại | Thêm ~20 lần bấm, mất lợi ích | Optimizer |
| Dòng hàng của phụ lục | A. Thay toàn bộ dòng bằng dòng trên file | Loại | Mất mặt hàng đã nối (41 R16) và yêu cầu NL đi theo dòng (41 R38) ⇒ Lệnh sản xuất lệch | Domain |
| Dòng hàng của phụ lục | B. Nối theo size, thêm dòng mới, không tự xóa dòng cũ | **Chọn** | Giữ dữ liệu đã nối; dòng bỏ thì U1 xóa tay có chủ đích | Domain + Optimizer |
| Dòng hàng của phụ lục | C. Chỉ báo khác, không điền | Loại | Không bớt việc gõ | Optimizer |
| Hạn giao từ "to April, 2027" | A. Ngày cuối tháng + đánh dấu "suy ra từ tháng" | **Chọn** | Ô bắt buộc; "to April" nghĩa là hết tháng 4; nhãn nhắc soát | Domain (XNK) |
| Hạn giao từ tháng | B. Để trống | Loại | Ô bắt buộc ⇒ gõ lại | Optimizer |
| Hạn giao từ tháng | C. Ngày đầu tháng | Loại | Chặt hơn HĐ ⇒ báo trễ sai | Domain |
| Đối tác chưa có danh mục | A. Tự thêm vào danh mục | Loại | Rác danh mục, trái QT 7 | Optimizer |
| Đối tác chưa có danh mục | B. Để trống + báo tên trên file | **Chọn** | U1 thêm qua ô chọn | Optimizer |
| Phạm vi bộ đọc | A. Một bộ đọc chung Xuất + Nhập, khác nhau ở vai đối tác + ô đích | **Chọn** | Luật số / ngày / bảng giống nhau; một chỗ test | Optimizer |
| Phạm vi bộ đọc | B. Hai bộ đọc riêng | Loại | Lặp code, lệch luật | Optimizer |

## 7. Scope & Priority

- **IN (v1):** NV1–NV5; file .docx, PDF có chữ (≤ 10 trang đầu); HĐ gốc + phụ lục (Xuất); HĐ nhập (lập + sửa).
- **OUT:** bản scan / ảnh / OCR / AI cloud · Word cũ .doc · HĐ dạng Excel · đọc file L/C · tự thêm danh mục · tự lưu · đọc **loại hình** HĐ nhập · đọc **chứng từ khách yêu cầu** (v1 chưa đọc).

## 8. Success metric

| Nghiệp vụ | Đo | Ngưỡng |
|---|---|---|
| NV1 / NV2 | số ô điền đúng từ phụ lục mẫu ANNEX 2 (3 dòng hàng) | ≥ 15 |
| NV1–NV3 | ô đã có giá trị bị đổi mà U1 không chọn | 0 |
| NV1–NV3 | file không đọc được làm đổi giá trị form | 0 ô |
| NV3 | ô điền đúng từ một HĐ nhập thật (khi có mẫu — A1) | ≥ 5 |

## 9. Rules & Invariants

| ID | Luật | Ví dụ |
|---|---|---|
| R1 | **Loại file.** (v1.2) Đọc `.docx`, **`.doc`** (Word 97–2003) và `.pdf` có chữ; ảnh / Excel / zip / bản scan không đọc. — Bản v1 dưới đây ghi `.doc` không đọc: **đã bỏ**. Thực tế (2026-11-03): HĐ xuất đã ký mà Phòng KH lưu là **bản scan** (13-MAT-26, 17-26-NEWPOINT) ⇒ đọc bản **Word** Baseafood soạn (chọn "Chỉ để đọc") rồi đính bản scan đã ký ở mục File; HĐ nhập NCC gửi là PDF có chữ ⇒ đọc thẳng. Đọc `.docx` và `.pdf` có lớp chữ (≥ 40 ký tự chữ — cùng ngưỡng 41 R27). PDF < 40 ký tự ⇒ "bản scan, không đọc". `.doc` ⇒ "Word cũ — lưu lại thành .docx rồi chọn lại". Ảnh / Excel / zip / khác ⇒ "không đọc loại file này". Không đọc được ⇒ **không đổi ô nào**. File tối đa 20 MB (45 R13). | HĐ ký đóng dấu chụp lại ⇒ báo "bản scan", vẫn đính được làm bằng chứng |
| R2 | **Mở file thành chữ.** (v1.2) `.doc`: chữ + bảng qua `readLegacyWord` (bảng mảnh chữ; tab tách ô). **Bảng Excel nhúng** (trường `EMBED Excel.Sheet…` / `o:OLEObject`) ⇒ đúng chỗ đó chèn các dòng của bảng, chỉ phần hợp đồng hiển thị (vùng `oleSize` của workbook, bỏ dòng / cột ẩn). **PDF**: dựng lại bảng theo tọa độ — cột = cụm chữ chồng nhau theo chiều ngang, dòng hàng = dòng có ≥ 2 số, chữ quanh nó về dòng hàng gần nhất (Word căn giữa ô theo chiều dọc), phần trên là tiêu đề; không nhận ra bảng thì như cũ. `.docx`: đoạn văn + từng dòng bảng (mỗi ô một phần tử, giữ thứ tự). PDF: chữ gom theo dòng như 41 R27, đọc ≤ 10 trang đầu. Đọc trên trình duyệt; file **không** gửi tới dịch vụ ngoài. | — |
| R3 | **Hai bên.** Nhận dạng bên bán: "THE SELLER", "SELLER", "Bên bán"; bên mua: "THE BUYER", "BUYER", "Bên mua". Tên = chữ sau dấu ":" tới hết dòng. **Đối tác = bên có tên không chứa "BASEAFOOD"**. Xuất khẩu ⇒ đối tác phải là bên mua; Nhập khẩu ⇒ bên bán. Đối tác nằm sai bên (VD Baseafood là bên mua ở form Xuất khẩu) ⇒ cảnh báo "file có vẻ là HĐ nhập", không điền đối tác. | ANNEX 2: SELLER = BASEAFOOD 1 ⇒ đối tác = HYAKUSAIBOU CO.,LTD |
| R4 | **Đầu HĐ.** Số HĐ: chữ sau "CONTRACT No" / "Contract No." / "Số HĐ"; tiêu đề phụ lục "ANNEX OF CONTRACT <số> DATED <ngày>" ⇒ số HĐ + ngày ký HĐ gốc. Số phụ lục + ngày: dòng "No: <n> dated <ngày>" ngay dưới tiêu đề phụ lục. Ngày nhận: "April 20, 2026", "20 April 2026", "20 Apr 2026", "20/04/2026", "20.04.2026", "2026-04-20"; dạng số luôn hiểu **ngày/tháng** (VN). Order ref / PO: "PO No", "Order No", "Your ref". | "ANNEX OF CONTRACT 01-26-HAT DATED April 20, 2026" ⇒ số 01-26-HAT, ngày ký 2026-04-20 |
| R5 | **Điều khoản (chỉ Xuất khẩu).** Incoterm: mã Incoterms 2020 đứng trước tên cảng ("CNF Hakata", "FOB Vung Tau") hoặc sau "Delivery term"; **CNF / C&F ⇒ CFR**. Cảng đích = chữ sau CFR / CIF / CNF tới dấu phẩy (bỏ "main port", "any port"), không có thì chữ sau "to" ở mục Shipment ("to Yokohama, Japan within …"); cảng xếp = chữ sau FOB hoặc "Port of loading". Tiền tệ: mã trong "(USD)", "usd/kg", "Amount (JPY)". Dung sai: "<n>% more or less" / "more or less <n>%" / "+/-<n>%" — chỉ chữ ngoài bảng ("Moisture 30% +/-2%" trong tên hàng không phải dung sai), cộng dòng tổng của dạng nhãn : giá trị. Hạn giao: "not later than <ngày>" ⇒ ngày đó; "from <tháng> to <tháng năm>" / "until <tháng năm>" ⇒ **ngày cuối tháng cuối**, kèm nhãn "suy ra từ tháng — soát lại". Số cont: "<n> containers" / "<n> x 40'" / "<n> conts". Loại cont: "40' RF", "40RH", "20' reefer" ⇒ khớp danh sách loại container (R8). Thanh toán: "T/T", "TTR", "telegraphic" ⇒ TTR; "L/C" / "LC" ⇒ L/C (+ số L/C sau "L/C No"); "<n>% deposit" / "<n>% in advance" ⇒ % cọc. Chứng từ khách yêu cầu: **v1 chưa đọc** (để U1 chọn như cũ). | "Price (usd/kg) CNF Hakata, JP" ⇒ CFR · Hakata · USD; "from November, 2026 to April, 2027" ⇒ 2027-04-30 |
| R6 | **Bảng dòng hàng.** Dòng tiêu đề = dòng bảng có ≥ 3 cột nhận ra trong: Commodity / Description / Product · Size · Packing · Price / Unit price · Quantity / Q'ty · Amount · pcs/kg · Length · Ratio / tentacle · Assortment · HS. Đọc các dòng sau tới dòng "Total" (không phân hoa thường). Ô cột đầu trống (ô gộp) ⇒ lấy giá trị dòng trên. Số đọc theo 41 R22. **Xuất khẩu**, mỗi dòng: Tên hàng (như trên HĐ) ← Commodity / Description, không có cột ⇒ chữ sau "Commodity:" của file, không có ⇒ trống · Size ← Size · Quy cách ← Packing · Kg tịnh / thùng ← tích các số trước "kg" và "x n" trong Packing ("1kg/PE x 12/ctn" = 12; "10kg/ctn" = 10; "6 x 2kg" = 12) · Kg ← Quantity khi tiêu đề có "kg"; "MT" / "tons" ⇒ × 1000; "ctns" / "cartons" ⇒ là Số lượng thùng · Số lượng (thùng) = kg ÷ kg tịnh / thùng khi chia hết, không chia hết ⇒ Kg gõ tay = kg trên file + cảnh báo · Đơn giá ← Price khi đơn vị "/kg"; giá theo thùng ⇒ không điền + cảnh báo · Số miếng / kg ← pcs/kg · Chiều dài ← Length · Tỉ lệ râu / thân / cổ ← Ratio · Mã HS ← HS · Ghi chú dòng ← "Assortment n% · Avg … gr/pc · Dao động …" (các cột nhận ra mà form không có ô). Amount không lưu: \|kg × đơn giá − Amount\| > 0,01 ⇒ cảnh báo lệch dòng. Dòng Total: Σ kg / Σ Amount khác ⇒ cảnh báo, giữ số từng dòng. **Tiêu đề 2 tầng** ("Quantity" trên, "Ctns" · "Kgs" dưới; "Unit price" trên, "(usd/kg CFR)" dưới) ⇒ gộp dòng dưới vào cột trên; ô gộp ngang lấy tên cột bên trái. Cột "Item" / "Mark" / "No." = số thứ tự, bỏ. Cột có "CTN" mà không có "kg" = số thùng. Không có cột Size ⇒ lấy "size …" trong tên hàng (tên giữ nguyên). **Dạng "nhãn : giá trị"** (HĐ nhập Ấn Độ: "1/. Commodity : …" · "Size : 100/200 200/300" · "Quantity : 18,000 5,000 (KGS)" · "Unit Price : 4.00 (USD/KG …)" · "Packing : …" · "Total: USD 96,000 (24,000 KGS / 1,200 Ctns)") ⇒ mỗi size một dòng, lượng theo thứ tự; không có tiền từng dòng ⇒ so Σ kg × giá với Total. **Nhập khẩu**, mỗi dòng: Tên hàng ← Commodity / Description · Kg (cùng quy đổi) · Đơn giá; cột khác bỏ. | ANNEX 2: 3 dòng; dòng 2 trống cột Ratio ⇒ "100% tentacle" |
| R7 | **Điền.** Ô **trống** ⇒ điền. Ô **có giá trị khác** ⇒ không đổi; ghi vào danh sách "đang ghi <a> — file <b>"; U1 chọn dùng giá trị trên file từng ô, hoặc dùng hết. Ô có giá trị **bằng** file ⇒ không tính là khác. Dòng hàng: form chưa có dòng nào có tên hoặc số ⇒ điền mọi dòng; đã có dòng (HĐ mới) ⇒ nối theo R10 như bản sửa. | Dung sai đang 5, file 10 ⇒ vẫn 5, danh sách khác có 1 mục |
| R8 | **Gợi ý danh mục.** Chuẩn hóa tên: bỏ dấu chấm / phẩy, bỏ "CO", "LTD", "CO.,LTD", "JSC", "INC", "CORP", gộp khoảng trắng, không phân hoa thường. Mục có tên chuẩn hóa **bằng** tên trên file được ưu tiên; không có thì mục mà tên này chứa trọn tên kia (theo từ). Ra đúng một ⇒ điền; 0 ⇒ trống + "chưa có trong danh mục: <tên trên file>"; ≥ 2 ⇒ trống + liệt kê. Áp cho: khách (Xuất, so tên + mã), NCC nhập khẩu (Nhập, so tên ngắn + tên đầy đủ + mã), cảng xếp / đích, loại container, tiền tệ (62 — cảng so cả phần trước dấu phẩy: "Hakata" ↔ "Hakata, Japan"). Mặt hàng của dòng: Xuất theo tên hàng của khách (41 R23); Nhập theo lịch sử nối (45 R21). **Không tự thêm vào bất kỳ danh mục nào.** | "HYAKUSAIBOU CO.,LTD" khớp "Hyakusaibou Co., Ltd" ⇒ điền |
| R9 | **Đúng HĐ (bản sửa).** Số HĐ đọc được (R4) khác số HĐ đang sửa (so chuẩn hóa như 45 R3) ⇒ không điền ô nào; báo "file là phụ lục của HĐ <a>, đang sửa HĐ <b>"; U1 xác nhận vẫn dùng thì mới điền. File không có số HĐ ⇒ điền, kèm cảnh báo "file không ghi số HĐ". Lập HĐ mới mà số HĐ trùng HĐ đã có ⇒ luật trùng số của 41 / 45 chặn khi Lưu như cũ. | — |
| R10 | **Nối dòng theo size (bản sửa, hoặc form đã có dòng).** Dòng file khớp dòng form khi cùng size (41 `sizeKey`) và — nếu cả hai có — cùng tên hàng / tỉ lệ. Khớp ⇒ áp R7 từng ô của dòng. Dòng file không khớp ⇒ **thêm dòng mới**, đánh dấu "từ file". Dòng form không có trên file ⇒ **giữ nguyên**, liệt kê "không có trên file" để U1 tự xóa nếu muốn. Mặt hàng đã nối + yêu cầu NL (41 R38) của dòng khớp không bao giờ bị đổi. | Form có 4 size, phụ lục 3 size ⇒ còn 4 dòng, 1 dòng trong danh sách "không có trên file" |
| R11 | **Báo kết quả.** Sau mỗi lần đọc luôn có: số ô đã điền · danh sách ô khác file · danh sách mục chưa có trong danh mục / không đọc được · cảnh báo (lệch dòng, lệch Total, hạn giao suy ra, đối tác sai bên, không có số HĐ). Không toast (đây là trình bày, QT 13). | "Đã điền 18 ô · 1 ô khác file · 1 mục chưa có trong danh mục" |
| R12 | **Không tự ghi.** Đọc không ghi sổ, không tạo HĐ, không đính file. Chỉ U1 bấm Lưu mới ghi, qua luật lưu của 41 / 45. Giá trị đã điền nằm trong form ⇒ đi theo nháp form (QT 17) như giá trị gõ tay. | — |
| R13 | **Chọn file chỉ để đọc.** U1 chọn được file **chỉ để đọc** (VD bản Word nháp, rồi đính bản scan đã ký sau): file đó không vào danh sách file của HĐ khi Lưu. Chọn file ở ô file HĐ như hiện nay ⇒ vừa đính vừa đọc. Không nối máy chủ ⇒ mọi file là chỉ để đọc (như 41 NV17). | — |
| R14 | **Giá theo quyền.** U1 không có quyền xem giá ở Xuất khẩu ⇒ không điền đơn giá, không hiện đơn giá / Amount đọc từ file trong kết quả. | — |
| R15 | **Không đụng sổ khác.** Bộ đọc không đổi bảng nào ngoài form đang mở; không đổi Nhập hàng, Sổ kho tháng, Cân đối, Lệnh sản xuất. | — |

## 10. Acceptance Criteria

Fixture: chữ của `ANNEX 2 OF CONTRACT 01 HĐ 02.docx` chép từng ô vào test (giống oracle invoice 234/26 của 41 AC-51). HĐ nhập: fixture dựng tay theo R3–R6 cho tới khi có file thật (A1).

### AC-1 — Đọc đầu phụ lục ANNEX 2 · Maps to: NV2, R3, R4 · Test: unit
- **Given** chữ của ANNEX 2
- **When** S1 đọc với vai Xuất khẩu
- **Then** ra số HĐ, ngày ký HĐ gốc, ngày phụ lục, đối tác
- **Assert:** `contractNo == "01-26-HAT"` · `signedOn == "2026-04-20"` · `revisedOn == "2026-10-10"` · `partnerName == "HYAKUSAIBOU CO.,LTD"` · `partnerSide == "buyer"`

### AC-2 — Đọc bảng dòng hàng ANNEX 2 · Maps to: NV1, NV2, R6 · Test: unit
- **Given** chữ của ANNEX 2
- **When** S1 đọc bảng
- **Then** ra đúng 3 dòng, ô gộp lấy giá trị dòng trên, Total khớp cộng các dòng, và bắt được dòng 2 ghi tiền sai trên chính file (51.840 kg × 11,80 = 611.712, file ghi 617.712)
- **Assert:** `lines.length == 3` · sizes `["1.5 gr cut","2 gr cut","3 gr cut"]` · kg `[38880, 51840, 38880]` · đơn giá `[11.6, 11.8, 11.95]` · kg tịnh / thùng `== 12` cả 3 dòng · số thùng `[3240, 4320, 3240]` · tỉ lệ dòng 2 `== "100% tentacle"` · số miếng / kg dòng 1 `== "590 – 770"` · Σ kg `== 129600` · Σ Amount trên file `== 1533336` (bằng Total ⇒ 0 cảnh báo lệch Total) · cảnh báo lệch dòng `== 1`, đúng dòng 2, chênh `== 6000`

### AC-3 — Điều khoản ANNEX 2 · Maps to: NV2, R5 · Test: unit
- **Given** chữ của ANNEX 2
- **When** S1 đọc điều khoản
- **Then** ra incoterm, cảng đích, tiền tệ, dung sai, hạn giao, số cont
- **Assert:** `incoterm == "CFR"` · `destinationPort == "Hakata"` · `currency == "USD"` · `tolerancePct == 10` · `latestShipmentDate == "2027-04-30"` + cờ `inferredFromMonth == true` · `containerCount == 6`

### AC-4 — Chỉ điền ô trống · Maps to: NV1, R7 · Test: unit
- **Given** form có dung sai 5, các ô khác trống; kết quả đọc AC-3
- **When** S1 điền
- **Then** dung sai giữ 5 và được liệt kê
- **Assert:** `form.tolerancePct == 5` · `conflicts.length == 1` · `conflicts[0] == {field: "tolerancePct", current: 5, file: 10}` · `filledCount >= 15`

### AC-5 — Dùng giá trị trên file theo lựa chọn · Maps to: NV1, R7 · Test: unit
- **Given** kết quả AC-4
- **When** U1 chọn dùng giá trị trên file cho dung sai
- **Then** dung sai đổi, danh sách khác rỗng
- **Assert:** `form.tolerancePct == 10` · `conflicts.length == 0`

### AC-6 — Phụ lục của HĐ khác thì không điền · Maps to: NV2, R9 · Test: unit
- **Given** đang ghi bản sửa HĐ `02-26-XYZ`; file ANNEX 2 (HĐ `01-26-HAT`)
- **When** S1 đọc
- **Then** không ô nào đổi, có cảnh báo sai HĐ
- **Assert:** `filledCount == 0` · số ô form đổi `== 0` · `warnings` chứa `"01-26-HAT"` và `"02-26-XYZ"`

### AC-7 — Nối dòng theo size, không tự xóa · Maps to: NV2, R10 · Test: unit
- **Given** bản sửa có 4 dòng size 1.5 gr cut · 2 gr cut · 3 gr cut · 4 gr cut, dòng 1.5 gr cut đã nối mặt hàng `P1` và có yêu cầu NL; file ANNEX 2
- **When** S1 nối dòng
- **Then** 3 dòng khớp, 0 dòng mới, dòng 4 gr cut còn nguyên
- **Assert:** `form.lines.length == 4` · `newLines == 0` · `notOnFile == ["4 gr cut"]` · dòng 1.5 gr cut `productId == "P1"` và yêu cầu NL không đổi

### AC-8 — File không đọc được không đổi form · Maps to: NV1–NV3, R1 · Test: unit + manual
- **Given** lần lượt: file `.doc`; PDF có 12 ký tự chữ; file `.jpg`
- **When** S1 đọc
- **Then** báo đúng lý do, form không đổi
- **Assert:** lý do lần lượt `"old-word"`, `"scan"`, `"unsupported"` · số ô form đổi `== 0` cả 3 lần

### AC-9 — Gợi ý đối tác chỉ khi ra đúng một · Maps to: NV4, R8 · Test: unit
- **Given** chữ đối tác "HYAKUSAIBOU CO.,LTD"; ba danh mục khách: (a) có "Hyakusaibou Co., Ltd"; (b) không có; (c) có "Hyakusaibou Foods" và "Hyakusaibou Trading" (không mục nào bằng đúng tên)
- **When** S1 gợi ý
- **Then** (a) điền, (b) và (c) để trống kèm lý do
- **Assert:** (a) `customerId == id của Hyakusaibou Co., Ltd` · (b) `customerId == null` và `unmatched` chứa `"HYAKUSAIBOU CO.,LTD"` · (c) `customerId == null` và `candidates.length == 2` · số dòng danh mục khách sau cả 3 lần `==` trước

### AC-10 — Đọc HĐ nhập: đối tác là bên bán · Maps to: NV3, R3, R6 · Test: unit
- **Given** fixture HĐ nhập: SELLER = "OCEAN PRIDE SEAFOOD LTD", BUYER = "BASEAFOOD 1 CO., LTD", 2 dòng (Frozen octopus whole 20,000 kgs × 3.10 USD; Frozen squid 10,000 kgs không giá)
- **When** S1 đọc với vai Nhập khẩu
- **Then** đối tác là bên bán, 2 dòng chỉ có tên · kg · giá, loại hình không điền
- **Assert:** `partnerSide == "seller"` · `lines.length == 2` · kg `[20000, 10000]` · đơn giá `[3.1, null]` · `importType == null`

### AC-11 — File HĐ nhập mở ở form Xuất khẩu · Maps to: NV1, R3 · Test: unit
- **Given** fixture AC-10
- **When** S1 đọc với vai Xuất khẩu
- **Then** không điền đối tác, có cảnh báo
- **Assert:** `customerId == null` · `warnings` chứa `"HĐ nhập"`

### AC-12 — Không thấy giá thì không điền giá · Maps to: NV1, R14 · Test: unit
- **Given** U1 không có quyền xem giá Xuất khẩu; file ANNEX 2
- **When** S1 điền
- **Then** đơn giá trống, kết quả không chứa số tiền
- **Assert:** đơn giá `== null` cả 3 dòng · kết quả đọc không có trường `unitPrice` / `amount`

### AC-13 — Đọc không ghi sổ · Maps to: NV1–NV3, R12, R15 · Test: integration (thủ công trên preview tới khi có test tích hợp)
- **Given** đếm dòng `export_contracts`, `export_contract_revisions`, `import_contracts`, `import_contract_lines`, `khach_hang`, `import_suppliers`, `export_options`, `export_files`, `import_files` trước khi đọc
- **When** U1 đọc file ANNEX 2 ở form Xuất khẩu rồi Hủy; đọc fixture AC-10 ở form Nhập khẩu rồi Hủy
- **Then** không bảng nào đổi
- **Assert:** số dòng mỗi bảng sau `==` trước

### AC-14 — File chỉ để đọc không đính vào HĐ · Maps to: NV1, R13 · Test: e2e
- **Given** HĐ mới, file ANNEX 2 chọn chỉ để đọc
- **When** U1 bổ sung ô bắt buộc còn thiếu và Lưu
- **Then** HĐ lưu với giá trị đã điền, không có file nào
- **Assert:** HĐ có `contractNo == "01-26-HAT"` · số file của HĐ `== 0`

### AC-15 — Giá trị đã điền theo nháp · Maps to: NV1, R12 · Test: e2e
- **Given** form Lập HĐ đã điền từ file ANNEX 2, chưa Lưu
- **When** U1 sang trang khác rồi quay lại
- **Then** form còn nguyên giá trị đã điền
- **Assert:** số dòng hàng `== 3` · `tolerancePct == 10` · Σ kg `== 129600`

### AC-16 — Hướng dẫn nói đủ luật đọc file · Maps to: NV5 · Test: unit
- **Given** nội dung hộp "?" của Xuất khẩu và Nhập khẩu
- **When** test đọc nội dung
- **Then** có đủ ý: loại file đọc được, bản scan / .doc không đọc, chỉ điền ô trống, không tự lưu
- **Assert:** mỗi hộp chứa đủ 4 cụm `".docx"`, `"bản scan"`, `"ô trống"`, `"không tự lưu"` (thiếu `== 0`) · `pageTourCoverage.test.ts` xanh

## 11. Assumptions (fail-closed) / Open questions

- **A1 (đóng 2026-11-03):** đã có 2 HĐ nhập thật (MSA SEA FOODS, KORNISH MARINE FOODS) — test `contractReader.test.ts`. Cũ: chưa có file HĐ nhập thật. Luật R3–R6 cho HĐ nhập dựng theo mẫu HĐ thương mại thường gặp; AC-10 dùng fixture dựng tay. **Cần 1–2 file HĐ nhập thật (.docx / PDF có chữ)** để thay fixture trước khi coi NV3 xong.
- **A2 (đóng 2026-11-03):** đã thử thật bản PDF 13-MAT-26 và bản .doc 17-26-NEWPOINT (fixture tọa độ + chữ trong test). Cũ — **A2 (mở một phần):** đã có 2 HĐ xuất gốc nhưng là **bản scan** ⇒ fixture chép tay theo cách Word tách; cần **bản Word** của 13-MAT-26 / 17-26-NEWPOINT để thay fixture. Cũ: mới có **phụ lục** HĐ xuất, chưa có HĐ gốc. Nhận tên hàng từ cột Commodity / Description, không có thì dòng "Commodity:". Cần 1 file HĐ xuất gốc để thêm fixture NV1.
- **A3:** ngày dạng số luôn là ngày/tháng (VN), không đoán tháng/ngày kiểu Mỹ.
- **A4:** "to <tháng>" ⇒ ngày cuối tháng (R5), có nhãn nhắc soát.
- **A5:** CNF / C&F ghi thành CFR (Incoterms 2020); chữ gốc trên file hiện trong kết quả đọc.
- **A6:** không tier RED: không migration, không key, không RLS. Không cần hỏi thêm.

## History

- 2026-11-03 — v1.2: đọc .doc + bảng Excel nhúng + ghép bảng PDF theo tọa độ; thử thật 13-MAT-26.pdf, 17-26-NEWPOINT.doc, CONTRACT MSA.pdf, CONTRACT.pdf — ra đúng, 0 cảnh báo; 23 test.
- 2026-11-03 — v1.1: thêm bố cục từ 4 file thật (xem dòng updated đầu file); 19 test.
- 2026-11-03 — v1 ĐÃ BUILD. Thử trên file thật ANNEX 2: ra đủ AC-1…3, bắt dòng 2 ghi tiền sai 6.000 USD. Chứng từ khách yêu cầu để v2. AC-9 (c) đổi mẫu: tên bằng đúng được ưu tiên.
- 2026-11-03 — v1 spec. Nguồn: đề nghị của Phòng Kế hoạch; chủ dự án chốt phạm vi (Xuất + Nhập · .docx / PDF có chữ · phụ lục dùng chung bộ đọc). Mẫu: ANNEX 2 của HĐ 01-26-HAT.
