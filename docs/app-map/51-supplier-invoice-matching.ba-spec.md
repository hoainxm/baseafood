# 51 — ba-spec: Nhập hàng · Gắn hóa đơn đại lý vào chuyến (nạp sổ chi tiết NL + PDF)

> Load khi: xây hoặc sửa phần nạp file "sổ chi tiết NL" xuất từ phần mềm kế toán + PDF hóa đơn GTGT của đại lý, ghép hóa đơn với chuyến nhập hàng, xử lệch giá/kg, tạo chuyến từ hóa đơn, trạng thái hóa đơn của chuyến, mã kế toán + MST trong danh mục đại lý.
covers: src/features/imports/SupplierInvoicePanel.tsx, src/features/imports/supplierInvoiceParts.tsx, src/lib/supplierInvoice.ts, src/lib/supplierInvoiceFiles.ts, src/lib/supplierInvoiceDemo.ts, supabase/migrations/0090_supplier_invoices.sql
last_verified: 2026-10-30
<!-- re-verified: 2026-10-30 build P1 — AC-1…13, 15 = test `src/lib/supplierInvoice.test.ts` (21 test, số thật tháng 10). Thử tay sandbox `baseafood-demo` (localStorage, không máy chủ) với file thật `sổ chi tiết NL.xlsx` + PDF 936: đọc 137 dòng / 60 HĐ; ánh xạ 7 mã (tạo mới "Bé 3" tại chỗ); HĐ 936 ra Lệch giá (152.000 vs 154.000) + 2 Khớp; Cập nhật theo HĐ đổi giá + dòng vết; Giữ số xưởng bắt lý do; Tạo chuyến từ HĐ 242 (Bé 3 01/10) ⇒ chuyến ghi bù "Theo HĐ 242 (phiếu kế toán 24/008/10)" + 2 dòng Khớp; HĐ 978 Không thuộc chuyến; nhãn HĐ 242 / HĐ 936 ở Sổ chi tiết; 360px × 130% không cuộn ngang. PDF báo "MST danh mục khác hóa đơn" đúng (sandbox Hồng Phú …848). CHƯA thử: lưu file PDF lên bucket (sandbox không máy chủ), AC-14 trên tài khoản tổ trưởng thật, AC-16 bằng bộ ghép trên trọn số tháng 10 (đối chiếu tay 113/120 ở §0c). -->
ttl_days: 90
status: v1 ĐÃ CHỐT (2026-10-30) — Q1–Q11 theo đề xuất (§11a). **Build P1 XONG 2026-10-30** (design-spec [52](52-supplier-invoice-ui.design-spec.md)); mig `0090` ⏳ CHƯA chạy DB thật (tạo bucket `supplier-invoice-files` trước). NV8 (nhắc ở Việc của tôi) chưa làm.

> **Mục đích:** oracle HÀNH VI cho việc gắn hóa đơn đại lý vào chuyến nhập. Ai làm gì, vào gì ra gì, thế nào là đúng (AC). **Không** mô tả giao diện (design-spec viết sau).
> **Nguồn:** yêu cầu chủ dự án 2026-10-30 · file thật `sổ chi tiết NL.xlsx` (tháng 10/2026, 137 dòng, 3 sheet) · PDF `936_1C26THP_3500424838.pdf` (Hồng Phú) · sổ Nhập hàng trên DB thật `site_id='bsf1'` (chuyến tới 20/10, đọc chỉ-đọc 2026-10-30). Khác [37 Đối soát HĐĐT](37-doi-soat-hddt.md): 37 so file Excel với file Excel; spec này gắn chứng từ vào **chuyến** trong sổ Nhập hàng [30](30-nhap-hang.md).

---

## 0. Đọc hai file mẫu

### 0a. Sổ chi tiết NL (Excel từ phần mềm kế toán)

Ba sheet, mỗi sheet một loại NL, cùng 24 cột: `CTGS · NGAY · PHIEU · NOI DUNG · TK_DU · MADM · DG_Nhap · SL_Nhap · STien_Nhap · … · TK nợ · DM nợ · … · Số HĐ · Ngày HĐ`.

| Cột | Nghĩa (đã chốt Q1) | Dùng cho |
|---|---|---|
| `NGAY` | ngày kế toán hạch toán ≈ ngày lập HĐ (936: 02/10) | chỉ hiển thị, không ghép |
| `Ngày HĐ` | **ngày hàng về của chuyến** (936: 01/10 = ngày chuyến) | **khóa ghép** với `ngày giao` của chuyến |
| `PHIEU` | số phiếu nhập kho (vd `03/008/10`), mọi dòng một HĐ cùng phiếu | gom dòng theo HĐ |
| `MADM` | mã đại lý kế toán (`HONG-PHU`, `HOACHUONG`, `HTHINHPHAT`, `HUONGPHAP`, `PHOANG`, `HIEUPHAN`, `LANGHUYNH`, `VYPHAT`) | ánh xạ → đại lý danh mục (R2) |
| `DM nợ` | mã vật tư kế toán: `BT-1DANL` · `BT-2DA<100` · `BT-2DA>100` | ánh xạ → loại NL xưởng (R3) |
| `SL_Nhap` · `DG_Nhap` · `STien_Nhap` | kg · đơn giá · thành tiền | so với dòng chuyến |
| `NOI DUNG` | câu tự do: `… ; HĐ 936 (người giao Phạm Hoàng Khánh - số xe 72B 04168)` | lấy tài xế + biển số khi có (không phải dòng nào cũng có) |
| `Số HĐ` | số hóa đơn, **không có ký hiệu** | khóa HĐ cùng với đại lý + năm |

**Một dòng = một loại NL của một chuyến trên một HĐ.** HĐ gộp nhiều chuyến ⇒ nhiều dòng cùng `Số HĐ`, khác `Ngày HĐ` (và thường khác xe).

### 0b. PDF hóa đơn GTGT

Tên file theo mẫu `<số>_<ký hiệu>_<MST người bán>.pdf` (`936_1C26THP_3500424838.pdf`). PDF điện tử có lớp chữ: đọc được số, ký hiệu, ngày lập, MST bán, MST mua (3502297423 = Baseafood 1), từng dòng (tên, ĐVT, SL, ĐG, thành tiền), cộng tiền hàng, thuế suất (936: KKKNT, thuế 0), tổng thanh toán.

### 0c. Đối chiếu tháng 10 với sổ Nhập hàng (01–20/10)

| Hiện tượng | Ví dụ thật | Hệ quả cho luật |
|---|---|---|
| Khớp đúng (đại lý + ngày hàng về + loại + kg) | 113/120 dòng có ngày hàng về ≤ 20/10 (94%) ghép được chuyến; HĐ 936 ⇄ chuyến Hồng Phú 01/10 đủ 3 loại | ghép tự động được (R4) |
| Lệch giá | 936: 1 da 152.000 (HĐ) vs 154.000 (sổ, chủ dự án đã tự sửa) · Hương Pháp HĐ 229 ngày 06/10: 144.000 vs 142.000 · Hưng Vũng Tàu HĐ 86 ngày 13/10: 2 da nhỏ 133.000 vs 132.000 | R6 lệch phải báo, không tự sửa |
| 1 HĐ gộp 2–3 chuyến | Hồng Phú 982 (10+11/10), 1008 (17+18/10) · Bé 3 247 (09+10+11/10), 250 (12+13+14/10) | R5 quan hệ nhiều–nhiều |
| Số HĐ trùng giữa đại lý | "242" của Hương Pháp và Bé 3 · "227" của Hương Pháp và Hiếu Phấn | R1 khóa HĐ có đại lý |
| Hai dòng cùng loại, khác giá, một chuyến | Hồng Phú 1016 ngày 20/10: 2 da nhỏ 285 × 133.000 + 76 × 135.000 | R4 ghép theo kg + giá |
| HĐ có, sổ xưởng không có chuyến | Bé 3 242 ngày 01/10 (2.201 + 1.669 kg) | NV5 tạo chuyến từ HĐ |
| Hàng không qua Nhập hàng | Hồng Phú 939, 978, 980 · Trung Vy Phát 785 (khối lớn, phần nhiều không xe) | NV5 xếp "Không thuộc chuyến" (Q5) |
| Chuyến có, chưa có HĐ | Huỳnh Mừng 15/10 (56 kg) | trạng thái "Chờ HĐ" |
| Dòng loại kế toán không xuất | Mậu 02/10: 35 kg Nút (Excel chỉ 3 loại bạch tuộc) | R8 chỉ xét loại đã ánh xạ |
| Danh mục sai | MST Hồng Phú danh mục `3500424848`, HĐ `3500424838`; ô "Mã" đại lý không trùng mã kế toán | NV2 + R2 |
| Hạch toán trễ | Bé 3 chuyến 01/10 vào sổ 09/10 | mọi tổng vẫn theo ngày hàng về |

## 1. Vấn đề & JTBD
- **Job:** Khi đại lý gửi hóa đơn (cùng ngày hoặc vài ngày sau, có khi gộp nhiều chuyến), kế toán muốn gắn đúng hóa đơn vào đúng chuyến xưởng đã ghi, để tồn NL, giá thành ở Cân đối và chứng từ khớp nhau mà không phải dò tay từng chuyến.
- **Vì sao làm bây giờ:** nỗi đau gốc của dự án là tồn NL cuối kỳ sai do ghi tay. Tháng 10 dò tay đã thấy 2 chỗ lệch giá và 1 chuyến xưởng bỏ sót (Bé 3 01/10). Kế toán đã có sẵn file xuất từ phần mềm, chỉ thiếu chỗ ghép.
- **Đo thành công bằng:** gắn xong HĐ cả tháng (~60 HĐ) ≤ 15 phút; mọi lệch được nhìn thấy và có quyết định trước khi chốt kỳ (§8).

## 2. User registry
| User | Là ai | Vòng đời | Bối cảnh |
|---|---|---|---|
| Kế toán (`accountant`, `chief-accountant`) | nạp file, ghép, xử lệch, tạo chuyến từ HĐ | quen | desktop văn phòng |
| Tổ trưởng / thủ kho / quản đốc xưởng | ghi chuyến hằng ngày (đã có, [30](30-nhap-hang.md)); chỉ **thấy trạng thái HĐ** của chuyến (Q2) | quen | điện thoại / máy bàn ở xưởng |
| Người có quyền Xem giá Nhập hàng (GĐ, PGĐ, KTT…) | xem file HĐ, số tiền | quen | desktop |
| Phần mềm kế toán nội bộ (ngoài) | nguồn file Excel | — | xuất tay |
| Cổng thuế / trang tra cứu HĐ (ngoài) | nguồn file PDF | — | tải tay |
| Bộ ghép (hàm thuần trong app) | đọc file, đề xuất ghép, phân loại | — | chạy tại máy, không gửi file ra ngoài |

## 3. User × Nghiệp vụ
| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Ghi chuyến (đã có) ⇒ chuyến mang trạng thái HĐ "Chờ HĐ" | tổ trưởng / thủ kho | kế toán | — | hằng ngày | Must |
| NV2 | Ánh xạ mã kế toán: đại lý (`MADM` + MST) và loại NL (`DM nợ`) | kế toán | — | — | lần đầu mỗi mã | Must |
| NV3 | Nạp Excel + PDF, xem trước kết quả ghép, xác nhận gắn | kế toán | xưởng (thấy trạng thái) | NV1, NV2 | tuần / tháng | Must |
| NV4 | Xử lệch giá / kg: "Cập nhật theo HĐ" hoặc "Giữ số xưởng" (bắt lý do) | kế toán | xưởng (thấy "Lệch HĐ") · Cân đối (giá) | NV3 | mỗi lần nạp | Must |
| NV5 | Xử HĐ không có chuyến: "Tạo chuyến từ HĐ" (ghi bù) hoặc xếp "Không thuộc chuyến" | kế toán | xưởng (chuyến ghi bù hiện trong sổ) | NV3 | mỗi lần nạp | Must |
| NV6 | Theo dõi: chuyến chờ HĐ, HĐ chưa có file, lệch chưa xử, PDF chưa có trong sổ kế toán | kế toán | — | NV3 | hằng tuần | Must |
| NV7 | Mở / tải file HĐ từ chuyến | người có quyền Xem giá | — | NV3 | khi cần | Should |
| NV8 | Nhắc việc "lệch HĐ chưa xử" ở Việc của tôi | bộ ghép | kế toán | NV4 | tự động | Could |

## 4. Cross-user handoff map
| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện | Điểm kết nếu không ai nhận |
|---|---|---|---|---|---|
| H1 | NV1→NV3 | xưởng (đã ghi chuyến) | kế toán | chuyến có ≥1 dòng loại đã ánh xạ, chưa gắn HĐ ⇒ "Chờ HĐ" | nằm ở danh sách "Chuyến chờ HĐ" (NV6), sắp theo ngày hàng về cũ nhất |
| H2 | NV4→xưởng | kế toán (cập nhật theo HĐ) | xưởng (người ghi chuyến) | đổi giá/kg dòng chuyến | dòng vết `[Sửa theo HĐ …]` ở Ghi chú chuyến + nhật ký; xưởng đọc khi mở chuyến, không cần xác nhận |
| H3 | NV5→xưởng | kế toán (tạo chuyến từ HĐ) | xưởng | chuyến mới, ghi bù, lý do điền sẵn | chuyến hiện trong sổ ngày đó như mọi ghi bù; ngày đã chốt ⇒ `lechSauChot` ≠ 0 như [30 §4](30-nhap-hang.md) |
| H4 | NV4→Cân đối | Nhập hàng | Cân đối kỳ ([31](31-can-doi-ky.md)) | giá dòng chuyến đổi | Cân đối đọc giá từng chuyến lúc mở kỳ (đã có) ⇒ không cần bàn giao thêm |

## 5. Flows

### Flow NV2 — Ánh xạ mã kế toán · owner: kế toán
- **Start:** lần nạp gặp `MADM` hoặc `DM nợ` chưa có trong danh mục.
- **Input:** mã kế toán + gợi ý (tên/billingName gần giống, MST đọc từ PDF cùng HĐ nếu có).
- **Steps:** chọn đại lý (hoặc loại NL) trong danh mục cho từng mã lạ → lưu vào danh mục.
- **Output:** đại lý có `mã kế toán`; loại NL có `mã vật tư kế toán`. Lần nạp sau tự nhận.
- **End:** mọi dòng Excel của lần nạp đều có đại lý + loại; mã nào bỏ qua thì dòng đó vào nhóm "Chưa ánh xạ" (không ghép, không mất).
- **MST:** PDF có MST khác MST danh mục của đại lý đã ánh xạ ⇒ báo "MST danh mục khác hóa đơn", cho sửa danh mục ngay; không tự sửa.

### Flow NV3 — Nạp và ghép · owner: kế toán
- **Start:** kế toán có file Excel (một hoặc nhiều tháng) và/hoặc một loạt PDF.
- **Input:** 1 file Excel + 0..n PDF, nạp cùng lúc hoặc tách lần (PDF nạp sau vẫn ghép vào HĐ đã có).
- **Steps:**
  1. Đọc Excel → gom dòng theo HĐ (đại lý + năm + số). Đọc PDF → (MST, ký hiệu, số, ngày lập, dòng, tổng).
  2. Ghép dòng Excel ⇄ dòng chuyến theo R4. Ghép PDF ⇄ HĐ Excel theo R7.
  3. Xem trước, mỗi HĐ một nhóm kết quả: **Khớp** · **Lệch giá** · **Lệch kg** · **Không có chuyến** · **Không thuộc chuyến** (đã xếp từ lần trước) · **Chưa ánh xạ**; kèm cờ file: **Có file** · **Chưa có file** · **PDF lệch sổ kế toán**. Nạp lại: thêm cờ **Mới** · **Đổi** · **Như cũ** · **Không còn trong file** (R9).
  4. Kế toán xác nhận ⇒ ghi liên kết HĐ ⇄ dòng chuyến cho mọi nhóm Khớp/Lệch; lưu file + thông tin HĐ.
- **Output:** HĐ lưu (R10), liên kết tới dòng chuyến, trạng thái HĐ của từng chuyến cập nhật (R11). Lệch chưa xử nằm lại ở NV6 cho tới khi xử.
- **End:** mọi HĐ của lần nạp thuộc đúng một nhóm; không dòng nào biến mất lặng lẽ.

### Flow NV4 — Xử lệch · owner: kế toán
- **Start:** một liên kết đang "Lệch giá" hoặc "Lệch kg".
- **Input:** số HĐ (kg, giá) và số chuyến; ngày đã chốt chưa.
- **Steps:** chọn **Cập nhật theo HĐ** (đổi giá/kg dòng chuyến bằng số HĐ) **hoặc** **Giữ số xưởng** (bắt lý do, vd "cân xưởng đúng, đại lý xuất thiếu").
- **Output:** Cập nhật ⇒ dòng chuyến đổi số, Ghi chú chuyến thêm `[Sửa theo HĐ <số> · <ngày giờ> · <người>: giá 154.000 → 152.000]`, ngày đã chốt thêm "SAU KHI CHỐT NGÀY dd/mm/yyyy" (như sửa từ Cân đối, [30 §5](30-nhap-hang.md)), nhật ký thao tác có dòng. Giữ ⇒ liên kết thành "Lệch đã giải trình", lý do lưu.
- **End:** liên kết hết "chưa xử". Có Hoàn tác cho Cập nhật theo HĐ (luật 6, 13).

### Flow NV5 — HĐ không có chuyến · owner: kế toán
- **Start:** nhóm "Không có chuyến".
- **Steps:** một trong hai:
  - **Tạo chuyến từ HĐ:** chuyến mới — ngày hàng về = `Ngày HĐ`, ngày ghi sổ = hôm nay, lý do ghi bù điền sẵn `Theo HĐ <số> (phiếu kế toán <PHIEU>)`, đại lý + loại + kg + giá từ HĐ, tài xế + biển số tách từ `NOI DUNG` nếu có, phân xưởng = kế toán chọn (gợi ý xưởng đại lý hay giao). Chuyến tạo xong tự gắn HĐ (nhóm Khớp).
  - **Không thuộc chuyến:** HĐ xếp loại này (hàng đông/mua gửi kho lạnh, Q5), kèm ghi chú tùy chọn; lần nạp sau tự nằm nhóm này; kế toán bỏ xếp được.
- **End:** HĐ rời nhóm "Không có chuyến".

### Flow NV6 — Theo dõi · owner: kế toán
- **Input:** mọi chuyến + HĐ trong một khoảng ngày hàng về.
- **Output:** bốn danh sách đếm được: chuyến "Chờ HĐ" · HĐ "Chưa có file" · liên kết lệch chưa xử · PDF chưa có trong sổ kế toán. Mỗi mục mở thẳng tới chuyến / HĐ.
- **End:** bốn danh sách bằng 0 = khoảng ngày đó xong chứng từ.

## 6. Flow optimization log
| Flow | Candidate | Chọn / Loại | Lý do | Đánh giá |
|---|---|---|---|---|
| Khóa ghép ngày | A: `Ngày HĐ` · B: `NGAY` · C: ngày lập trên PDF | Chọn A | B và C trễ 1–8 ngày so với chuyến; A trùng ngày chuyến ở ~95% dòng (Q1) | Orchestrator + chủ dự án |
| Đơn vị ghép | A: cả HĐ ⇄ cả chuyến · B: dòng Excel ⇄ dòng chuyến | Chọn B | HĐ gộp 2–3 chuyến và có 2 dòng cùng loại khác giá (1016); A không phân được | Optimizer |
| Lệch số | A: tự ghi đè theo HĐ · B: báo + kế toán chọn · C: chỉ báo | Chọn B | A mất số cân của xưởng, không vết; C bắt người sửa ở màn khác (thêm bước). Chủ dự án: "chỗ sai cần báo lên để nắm và sửa trực tiếp nếu cần" | Domain (kế toán) + chủ dự án Q3 |
| HĐ thiếu chuyến | A: chỉ báo · B: tạo chuyến từ HĐ có ghi bù | Chọn B | thiếu chuyến = thiếu tồn NL; B đóng vòng trong một chỗ, vẫn giữ vết ghi bù | Optimizer + Q4 |
| Nhận đại lý | A: tên · B: MST · C: mã kế toán ánh xạ một lần | Chọn C (+ MST cho PDF) | Excel không có MST; tên ngắn xưởng ("Bé 3") khác tên kế toán (Hoa Chương) | Q6 |
| Đọc PDF | A: OCR dịch vụ ngoài · B: đọc lớp chữ tại máy | Chọn B | PDF điện tử có chữ; không gửi chứng từ tài chính ra ngoài | Q7 |

## 7. Scope & Priority
- **IN (MVP):** NV1–NV7 cho mọi mã vật tư đã ánh xạ (tháng 10 là 3 loại bạch tuộc).
- **OUT:** ghi nhập kho cho hàng "Không thuộc chuyến" (kho lạnh — để module kho); công nợ / thanh toán đại lý; OCR bản scan giấy; tự tải HĐ từ cổng thuế; ghép HĐ bán hàng (đã có ở [33](33-ban-hang.md)); NV8 nhắc việc (Could, làm sau).

## 8. Success metric
| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV3 | tỷ lệ dòng Excel tự ghép (Khớp + Lệch) trên file tháng 10, phần 01–20/10 | ≥ 90% |
| NV3 | thời gian nạp + xác nhận ~60 HĐ một tháng | ≤ 15 phút |
| NV3 | dòng chuyến gắn với 2 dòng Excel cùng lúc | 0 |
| NV4 | lệch chưa xử khi chốt kỳ Cân đối có khoảng ngày đó | 0 (hoặc đã giải trình) |
| NV6 | chuyến "Chờ HĐ" quá 10 ngày sau ngày hàng về | hiện đủ, không sót |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | **Khóa HĐ** = (đại lý, năm của `NGAY`, số HĐ); có PDF thì thêm ký hiệu. Hai đại lý trùng số là hai HĐ khác nhau | HĐ 242 Hương Pháp ≠ HĐ 242 Bé 3; số reset đầu năm theo ký hiệu (1C26 → 1C27) |
| R2 | Đại lý nhận bằng **mã kế toán** đã ánh xạ (NV2); PDF nhận bằng **MST**. MST PDF ≠ MST danh mục ⇒ báo, không tự sửa | Hồng Phú …848 vs …838 |
| R3 | Loại NL nhận bằng **mã vật tư kế toán** đã ánh xạ. `BT-1DANL` = Bạch tuộc 1 da · `BT-2DA<100` = 2 da nhỏ (80↓) · `BT-2DA>100` = 2 da lớn (80↑) — cùng cách chia, khác tên (Q11) | mã mới (mực, nút…) ⇒ NV2 |
| R4 | **Ghép dòng:** dòng Excel ⇄ dòng chuyến cùng đại lý + `ngày giao` == `Ngày HĐ` + cùng loại. Nhiều ứng viên ⇒ ưu tiên kg bằng nhau, rồi giá bằng nhau, rồi biển số trùng (`normalizePlate`), rồi tài xế. Kg bằng + giá khác ⇒ **Lệch giá**; chỉ một ứng viên mà kg khác ⇒ **Lệch kg**; không ứng viên ⇒ **Không có chuyến**. So kg, giá **tuyệt đối** (không dung sai) | 1016: hai dòng 2 da nhỏ khác giá cùng chuyến; một đại lý 2 lượt một ngày (phân bằng xe) |
| R5 | Một dòng chuyến gắn **tối đa một** dòng HĐ đang hiệu lực. Một HĐ gắn nhiều chuyến; một chuyến có thể có nhiều HĐ (Q8) | 982 → 2 chuyến; chuyến tách 2 HĐ do khác giá |
| R6 | **Không tự đổi số chuyến.** Lệch chỉ thành số mới khi kế toán chọn "Cập nhật theo HĐ"; luôn để dòng vết + nhật ký; ngày đã chốt vẫn sửa được, ghi "SAU KHI CHỐT NGÀY" | Hoàn tác trả đúng số cũ + gỡ dòng vết |
| R7 | **PDF ⇄ HĐ Excel:** cùng MST→đại lý + số HĐ + năm. Kiểm chéo: với mỗi đơn giá, Σkg PDF == Σkg Excel; cộng tiền hàng PDF == Σ `STien_Nhap`. Sai ⇒ "PDF lệch sổ kế toán" (vẫn lưu, vẫn báo) | PDF gộp hai chuyến thành một dòng cùng giá (982: 1.721 + 256 = 1.977) ⇒ vẫn khớp nhờ so theo tổng |
| R8 | Chỉ dòng chuyến có loại **đã ánh xạ** mới tính vào trạng thái HĐ | Mậu 02/10 dòng Nút không làm chuyến "thiếu HĐ" |
| R9 | **Nạp lại không nhân đôi.** Khóa dòng Excel = (khóa HĐ, `Ngày HĐ`, mã vật tư, đơn giá, biển số, thứ tự trong nhóm). Như cũ ⇒ bỏ qua; kg/giá đổi ⇒ "Đổi", liên kết tính lại; dòng không còn trong file mới (cùng khoảng ngày của file) ⇒ "Không còn trong file", liên kết **giữ** cho tới khi kế toán gỡ | file tháng 10 bản dở (tới 27/10) rồi bản đủ tháng |
| R10 | Lưu mỗi HĐ: file PDF + số, ký hiệu, ngày lập, MST bán, cộng tiền hàng, thuế, tổng thanh toán + dòng (loại, kg, đơn giá, thành tiền) + phiếu kế toán + phân loại (bình thường / không thuộc chuyến) (Q9) | PDF đến sau Excel ⇒ HĐ tồn tại trước, file gắn sau |
| R11 | **Trạng thái HĐ của chuyến** (tính, không gõ tay), xét các dòng loại đã ánh xạ: `Chờ HĐ` (chưa dòng nào gắn) · `Thiếu HĐ một phần` (có dòng gắn, có dòng chưa) · `Lệch HĐ` (có liên kết lệch chưa xử) · `Đã có HĐ` (mọi dòng gắn, không lệch chưa xử). Cờ phụ `chưa có file` khi HĐ gắn chưa có PDF | `Lệch HĐ` thắng `Thiếu một phần` |
| R12 | Chỉ kế toán (quyền Thêm/Sửa ở phần gắn HĐ) được nạp, xác nhận, xử lệch, tạo chuyến từ HĐ. Xưởng thấy trạng thái R11, **không** thấy file và số tiền HĐ; file + tiền theo quyền Xem giá Nhập hàng (Q2) | người không có Xem giá mở chuyến ⇒ thấy "Đã có HĐ số 936", không thấy file |
| R13 | Chuyến tạo từ HĐ là ghi bù bình thường: `laGhiBu` đúng, lý do không rỗng, `operator` = kế toán; tổng ngày đã chốt hiện lệch sau chốt như [30 §4](30-nhap-hang.md) | ngày hàng về đã chốt |
| R14 | Xóa chuyến đã gắn HĐ ⇒ liên kết về lại "Không có chuyến" cho HĐ đó (không xóa HĐ, không xóa file) | Hoàn tác xóa chuyến ⇒ liên kết trở lại |
| R15 | File HĐ đọc **tại máy**, không gửi ra dịch vụ ngoài; chỉ lưu vào kho file của app | — |
| R16 | Chế độ demo: HĐ + liên kết + file thuộc `site_id` hiện hành, có trong bộ demo (luật 15) | bật demo không lộ HĐ thật |

## 10. Acceptance Criteria — ORACLE

> Dữ liệu mẫu = file thật tháng 10 + PDF 936; build làm fixture từ đó (không cần DB thật).

### AC-1 — HĐ 936 ghép đủ 3 dòng vào chuyến Hồng Phú 01/10 · Maps to flow: NV3 · Test: unit
- **Given** chuyến Hồng Phú ngày giao 2026-10-01 có 1 da 1.707 × 152.000, 2 da lớn 2.053 × 140.000, 2 da nhỏ 75 × 133.000; Excel có 3 dòng HĐ 936 `Ngày HĐ` 01/10; mã HONG-PHU và 3 mã vật tư đã ánh xạ
- **When** chạy bộ ghép
- **Then** 3 dòng Excel gắn đúng 3 dòng chuyến, cả 3 là Khớp
- **Assert** count(kết quả Khớp của HĐ 936) == 3 · mọi `tripLineId` thuộc chuyến 01/10 · count(Lệch) == 0

### AC-2 — Lệch giá được báo, số chuyến không đổi · Maps to flow: NV3, NV4 · Test: unit
- **Given** như AC-1 nhưng dòng 1 da của chuyến ghi 154.000
- **When** chạy bộ ghép
- **Then** dòng đó là Lệch giá với số HĐ 152.000 và số chuyến 154.000; dữ liệu chuyến giữ nguyên
- **Assert** kind == "price-mismatch" · invoicePrice == 152000 · tripPrice == 154000 · giá dòng chuyến sau ghép == 154000

### AC-3 — Cập nhật theo HĐ để dòng vết, kể cả ngày đã chốt · Maps to flow: NV4 · Test: integration
- **Given** liên kết Lệch giá của AC-2 và ngày 01/10 xưởng Đông đã chốt
- **When** kế toán chọn Cập nhật theo HĐ
- **Then** giá dòng chuyến thành 152.000, Ghi chú chuyến có dòng `[Sửa theo HĐ 936` kèm "SAU KHI CHỐT NGÀY 01/10/2026", nhật ký thao tác có 1 dòng, liên kết hết lệch; Hoàn tác trả 154.000 và gỡ dòng vết
- **Assert** unitPrice == 152000 · note chứa "[Sửa theo HĐ 936" và "SAU KHI CHỐT NGÀY" · count(audit mới) == 1 · sau Hoàn tác unitPrice == 154000

### AC-4 — Giữ số xưởng bắt lý do · Maps to flow: NV4 · Test: unit
- **Given** một liên kết Lệch kg
- **When** kế toán chọn Giữ số xưởng với lý do rỗng, rồi với lý do "cân xưởng đúng"
- **Then** lần đầu bị từ chối kèm lỗi thiếu lý do; lần sau liên kết thành "Lệch đã giải trình", số chuyến không đổi
- **Assert** lần 1 trả lỗi, count(thay đổi) == 0 · lần 2 state == "explained" · reason == "cân xưởng đúng"

### AC-5 — Một HĐ gộp ba chuyến ba ngày · Maps to flow: NV3 · Test: unit
- **Given** Bé 3 có chuyến 09/10 (65 nhỏ, 106 lớn), 10/10 (541, 562), 11/10 (429, 728); Excel HĐ 247 có 6 dòng `Ngày HĐ` 09, 10, 11/10
- **When** chạy bộ ghép
- **Then** HĐ 247 gắn 3 chuyến, mỗi chuyến 2 dòng Khớp
- **Assert** count(chuyến khác nhau gắn HĐ 247) == 3 · count(Khớp) == 6

### AC-6 — Số HĐ trùng giữa hai đại lý không lẫn · Maps to flow: NV3 · Test: unit
- **Given** Excel có HĐ 242 của HUONGPHAP (3.352 kg 1 da + 55 kg 2 da nhỏ, ngày hàng về 12/10) và HĐ 242 của HOACHUONG (01–02/10)
- **When** chạy bộ ghép
- **Then** ra hai HĐ riêng, mỗi HĐ chỉ gắn chuyến của đại lý mình
- **Assert** count(HĐ có số 242) == 2 · mọi chuyến gắn HĐ 242-HUONGPHAP có supplierName == "Hương Pháp"

### AC-7 — Hai dòng cùng loại khác giá trong một chuyến · Maps to flow: NV3 · Test: unit
- **Given** chuyến Hồng Phú 20/10 có 2 da nhỏ 285 × 133.000 và 76 × 135.000; Excel HĐ 1016 có đúng hai dòng đó
- **When** chạy bộ ghép
- **Then** mỗi dòng Excel gắn đúng dòng chuyến cùng kg + giá
- **Assert** count(Khớp) == 2 · không dòng chuyến nào gắn 2 dòng Excel (R5)

### AC-8 — HĐ không có chuyến, tạo chuyến từ HĐ · Maps to flow: NV5 · Test: integration
- **Given** Excel HĐ 242 HOACHUONG có dòng `Ngày HĐ` 01/10 (2.201 nhỏ × 134.000, 1.669 lớn × 140.000, xe 86A 20964), sổ không có chuyến Bé 3 ngày 01/10
- **When** chạy bộ ghép rồi kế toán Tạo chuyến từ HĐ, chọn xưởng Đông
- **Then** trước khi tạo: 2 dòng là Không có chuyến; sau khi tạo: 1 chuyến mới ngày giao 01/10, ghi bù, lý do bắt đầu "Theo HĐ 242", biển số 86A 20964, 2 dòng Khớp
- **Assert** count(Không có chuyến) trước == 2, sau == 0 · deliveryDate == "2026-10-01" · laGhiBu == true · backdateReason bắt đầu "Theo HĐ 242" · count(dòng chuyến mới) == 2

### AC-9 — Xếp "Không thuộc chuyến" được nhớ khi nạp lại · Maps to flow: NV5 · Test: unit
- **Given** HĐ 978 Hồng Phú đã xếp Không thuộc chuyến
- **When** nạp lại cùng file
- **Then** HĐ 978 nằm nhóm Không thuộc chuyến, không vào nhóm Không có chuyến
- **Assert** group(978) == "not-trip" · count(Không có chuyến chứa 978) == 0

### AC-10 — Nạp lại không nhân đôi, báo dòng đổi · Maps to flow: NV3 · Test: unit
- **Given** đã nạp và xác nhận file tháng 10 bản tới 27/10
- **When** nạp lại cùng file, rồi nạp bản có HĐ 1040 kg 960 → 980
- **Then** lần 1 mọi dòng "Như cũ", số liên kết không đổi; lần 2 đúng 1 dòng "Đổi", HĐ 1040 tính lại
- **Assert** lần 1 count(liên kết) không đổi, count("Mới") == 0 · lần 2 count("Đổi") == 1

### AC-11 — PDF ghép HĐ và kiểm chéo · Maps to flow: NV3 · Test: unit
- **Given** PDF `936_1C26THP_3500424838.pdf` và HĐ 936 trong Excel; đại lý HONG-PHU danh mục MST 3500424838
- **When** đọc PDF và ghép
- **Then** PDF gắn HĐ 936; ký hiệu 1C26THP, ngày lập 02/10/2026, cộng tiền hàng 556.859.000 khớp Σ Excel
- **Assert** invoice.symbol == "1C26THP" · issueDate == "2026-10-02" · subtotal == 556859000 · flags không chứa "pdf-mismatch"

### AC-12 — MST danh mục khác hóa đơn thì báo · Maps to flow: NV2 · Test: unit
- **Given** danh mục Hồng Phú MST 3500424848, PDF MST 3500424838, HĐ 936 đã ánh xạ HONG-PHU
- **When** ghép PDF
- **Then** có cảnh báo MST khác, danh mục không đổi
- **Assert** count(cảnh báo "tax-id-mismatch") == 1 · supplier.nationalId == "3500424848" sau ghép

### AC-13 — Trạng thái HĐ của chuyến · Maps to flow: NV6 · Test: unit
- **Given** bốn chuyến: Huỳnh Mừng 15/10 (không HĐ) · Hồng Phú 01/10 (đủ Khớp, có file) · Hương Pháp 06/10 (Lệch giá chưa xử) · Mậu 02/10 (2 dòng bạch tuộc Khớp + 1 dòng Nút chưa ánh xạ, HĐ chưa có file)
- **When** tính trạng thái
- **Then** lần lượt Chờ HĐ · Đã có HĐ · Lệch HĐ · Đã có HĐ kèm cờ chưa có file
- **Assert** status == ["awaiting","complete","mismatch","complete"] · flags(Mậu) chứa "no-file"

### AC-14 — Xưởng không thấy file và tiền HĐ · Maps to flow: NV7 · Test: e2e
- **Given** người dùng tổ trưởng không có Xem giá Nhập hàng, chuyến Hồng Phú 01/10 Đã có HĐ
- **When** mở chuyến
- **Then** thấy trạng thái và số HĐ 936, không mở được file, không thấy số tiền HĐ
- **Assert** text chứa "936" · count(liên kết mở file) == 0 · không có chuỗi "556.859.000"

### AC-15 — Xóa chuyến trả HĐ về "Không có chuyến" · Maps to flow: NV3 · Test: unit
- **Given** chuyến Hồng Phú 01/10 gắn HĐ 936
- **When** xóa chuyến, rồi Hoàn tác
- **Then** sau xóa: 3 dòng HĐ 936 là Không có chuyến, HĐ và file còn; sau Hoàn tác: 3 dòng Khớp lại
- **Assert** sau xóa count(Không có chuyến của 936) == 3, count(HĐ 936) == 1 · sau Hoàn tác count(Khớp) == 3

### AC-16 — Tỷ lệ tự ghép trên file thật · Maps to flow: NV3 · Test: unit
- **Given** fixture sổ Nhập hàng 01–20/10 (`site_id='bsf1'`, chụp 2026-10-30, đã sửa giá 936) và file tháng 10
- **When** chạy bộ ghép cho các dòng `Ngày HĐ` ≤ 20/10
- **Then** tỷ lệ dòng Khớp + Lệch ≥ 90%; phần còn lại chỉ thuộc Bé 3 01/10, Hồng Phú 939/978/980, Trung Vy Phát 785
- **Assert** (Khớp + Lệch) / tổng ≥ 0.9 · tập HĐ "Không có chuyến" ⊆ {242-HOACHUONG, 939, 978, 980, 785}

## 11. Assumptions / Open questions

### 11a. Đã chốt (chủ dự án, 2026-10-30)
Q1 "Ngày HĐ" = ngày hàng về, ghép theo cột này · Q2 kế toán nạp + xác nhận, xưởng chỉ thấy trạng thái · Q3 báo lệch, kế toán chọn Cập nhật theo HĐ, có dòng vết, kể cả ngày đã chốt — *ghi chú: giá 936 chủ dự án đã tự sửa; về sau mọi chỗ sai phải báo lên để nắm và sửa trực tiếp nếu cần* · Q4 tạo chuyến từ HĐ (ghi bù) · Q5 939/978/980/785 là hàng đông gửi kho lạnh ⇒ nhóm "Không thuộc chuyến" · Q6 mã kế toán trong danh mục, PDF ghép MST · Q7 PDF điện tử, đọc tên file + nội dung · Q8 một chuyến có thể nhiều HĐ · Q9 lưu file + thông tin + dòng HĐ · Q10 nạp bất kỳ lúc nào, nạp lại không nhân đôi · Q11 "<100/>100" = "80↓/80↑".

### 11b. Assumptions (tự quyết, fail-closed)
- A1. Năm của khóa HĐ lấy từ `NGAY` (Excel không có ký hiệu). Có PDF thì ký hiệu thành phần khóa.
- A2. Không dung sai kg/giá: kg là số nguyên cân, giá là số nguyên đồng.
- A3. Phân xưởng chuyến tạo từ HĐ do kế toán chọn (Excel không có xưởng); gợi ý = xưởng đại lý hay giao nhất.
- A4. Ghép giá dùng cộng tiền hàng (trước thuế); NL thủy sản bán ra thường KKKNT, thuế 0.
- A5. Nạp một file Excel nhiều sheet; sheet nhận diện bằng cột `DM nợ`, không bằng tên sheet.
- A6. Liên kết đang "Không còn trong file" không tự gỡ (tránh mất liên kết khi kế toán xuất file thiếu ngày).
- A7. Giá đổi theo HĐ sau khi kỳ Cân đối đã có số: Cân đối đọc giá mới khi mở lại kỳ như mọi sửa giá chuyến hiện nay ([31](31-can-doi-ky.md)); không thêm khóa riêng.

### 11c. Open (cần làm rõ khi build, không chặn spec)
- O1. File Excel tháng sau có thêm mã vật tư khác (mực, nút, cá) không — chỉ ảnh hưởng số lần ánh xạ NV2.
- O2. HĐ có điều chỉnh / thay thế (HĐ điều chỉnh giảm, HĐ thay thế) — chưa thấy trong mẫu; giả định xử như HĐ mới cùng đại lý, kế toán tự gỡ HĐ bị thay.

## History
- v1 (2026-10-30): khởi tạo từ file thật tháng 10 + HĐ 936 + sổ Nhập hàng DB thật; Q1–Q11 chốt theo đề xuất.
- v1.1 (2026-10-30): build P1. Ánh xạ mã kế toán lưu ở bảng riêng `accounting_code_maps` (không thêm cột vào `suppliers` / `material_types` ⇒ chưa chạy 0090 không kẹt hàng chờ danh mục) — cùng nghĩa R2/R3. Kế toán không có quyền Xóa HĐ (giữ luật ma trận: kế toán không xóa); KTT có.
