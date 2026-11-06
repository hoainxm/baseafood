# 75 — ba-spec: Nạp báo cáo XNT — xem trước dữ liệu từng dòng, nạp từng dòng hoặc toàn bộ

> Load khi: task chạm nạp báo cáo Xuất–Nhập–Tồn của kế toán vào Sổ kho theo tháng — đọc mô tả lô trong tên hàng (ngày nhập · size · invoice · quy cách), ghép mã ↔ lô theo invoice, nạp từng dòng / nạp tất cả.
covers: src/lib/nxtStockImport.ts, src/lib/nxtReportFile.ts, src/features/monthly-stock/NxtImportDialog.tsx
last_verified: 2026-11-06
ttl_days: 90

> **Mục đích**: oracle HÀNH VI cho bước đối chiếu trước khi nạp. Mở rộng chức năng nạp XNT đã có ([36 § Nạp báo cáo XNT](36-so-kho-thang.md)) — KHÔNG mô tả giao diện.
> File thử: `CÁ NGUYÊN LIỆU NHẬP KHẨU THÁNG 10.pdf` (KHO TP - KHO 1000, 01–31/10/2026, 31 mã `PXC-CNL NK …`, tồn đầu 32.289 · nhập 323.266,5 · xuất 303.526,5 · tồn cuối 52.029). Chưa nạp thật.

---

## 1. Vấn đề & JTBD

Báo cáo XNT của kế toán theo MÃ HÀNG; sổ kho tháng theo LÔ (tên · size · invoice · ngày nhập · kg/kiện). Ở file cá, tên hàng chứa sẵn mô tả lô: `CÁ SABA NGUYÊN LIỆU SIZE 450-UP 28/7/2026 INVOICE: SBT2026009/SBT2026011 (15KG/CTN) (KG)`. Bản nạp đầu (ba-spec ngầm trong 36) chỉ hiện tên thô + số kg và ghi một lần cho cả file.

**JTBD (kế toán):** "Khi nạp báo cáo tháng, tôi muốn THẤY TRƯỚC từng dòng sẽ đưa vào sổ dưới dạng ô của sổ (mặt hàng, size, ngày nhập, invoice, kg/kiện, tồn đầu, nhập, xuất) cạnh dòng sổ đang có, để đối chiếu, đánh giá, rồi nạp từng dòng tôi đã chắc, hoặc nạp hết một lúc."

Bằng chứng nhu cầu (đối chiếu DB thật 2026-11-06, chỉ đọc): lô `NHM2026010 · 50-90` trên sổ T10 là 2 dòng tồn đầu 20.535 + 2.250, kế toán ghi tồn đầu 2.250 + **nhập trong tháng** 20.535 ⇒ sổ đã tính trước phần nhập. Tương tự `BFHM2606…` 3.450 + 15.450. Ghi máy móc theo file sẽ phồng nhập/xuất.

## 2. User registry

| User | Vai | Ghi chú |
|---|---|---|
| **U1 Kế toán** | Có quyền Nhập `monthly-stock` | Người nạp, quyết từng chỗ lệch |
| U2 Thủ kho / tổ trưởng | Xem sổ, ghi lấy ra / gửi kho ngoài | Không nạp XNT; chịu ảnh hưởng khi số sổ đổi |
| U3 Cân đối (người lập kỳ) | Ghi "lấy xả đông" vào cột Xuất của lô | Ghi CÙNG cột Xuất ⇒ điểm cross |
| S1 Phần mềm kế toán (external) | Xuất file PDF / Excel XNT | Nguồn dữ liệu, không sửa được |

## 3. User × Nghiệp vụ

| NV | Nghiệp vụ | Owner |
|---|---|---|
| NV1 | Đọc file + kiểm chính file | U1 |
| NV2 | Xem trước từng dòng ở dạng ô của sổ, đối chiếu với dòng sổ đang có | U1 |
| NV3 | Quyết từng chỗ lệch (ghép, cách xử chênh, ô mô tả) | U1 |
| NV4 | Nạp từng dòng / nạp tất cả dòng đã sẵn sàng | U1 |

## 4. Cross-user handoff map

| Từ → Đến | Khi nào | Điều kiện / dữ liệu | Không treo vì |
|---|---|---|---|
| S1 → U1 | Cuối tháng | File XNT một kho, trọn một tháng | File lỗi ⇒ NV1 báo rõ, U1 xin lại file (kết thúc tại NV1) |
| U1 → U3 | Sau NV4 | Lô có vết xuất Cân đối ⟦CĐ⟧ ⇒ cảnh báo "báo cáo đã tính phần lấy xả đông chưa" | U1 quyết ngay tại NV3 (Theo file thay số / Bỏ mã); không chờ U3 |
| U1 → U2 | Sau NV4 | Sổ đổi số; U2 thấy qua sổ + nhật ký | Có Hoàn tác (Ctrl+Z) + `audit_log` |

## 5. Flows

### Flow NV1–NV2 — Đọc + xem trước · owner U1
- **Input:** file PDF (chữ) / Excel mẫu "Báo cáo xuất nhập tồn"; sổ kho tháng hiện có.
- **Steps:** đọc → kiểm file (R1) → tách mô tả lô từ tên (R2) → ghép mã ↔ dòng sổ (R3) → dựng "dòng sẽ ghi" cho từng mã (R4, R5).
- **Output:** mỗi mã một dòng xem trước gồm: tình trạng · mã · ô sẽ ghi (mặt hàng, size, ngày nhập, invoice, kg/kiện, tồn đầu, nhập, xuất, tồn cuối) · dòng sổ đang có (cùng các ô) · cảnh báo từng ô khác nhau.
- **End:** file lỗi ⇒ dừng, không ghi; file đúng ⇒ sang NV3/NV4.

### Flow NV3 — Quyết chỗ lệch · owner U1
- **Input:** dòng xem trước có tình trạng cần chọn (R6).
- **Steps:** đổi ghép (dòng khác · dòng mới · bỏ mã) → chọn cách xử chênh tồn đầu (R7) → sửa ô mô tả dòng mới nếu cần.
- **Output:** dòng chuyển "Sẵn sàng" (đủ lựa chọn, tồn cuối không âm).

### Flow NV4 — Nạp · owner U1
- **Input:** ≥1 dòng "Sẵn sàng".
- **Steps:** (a) nạp MỘT dòng ⇒ ghi ngay dòng đó, dòng chuyển "Đã nạp", danh sách còn mở; hoặc (b) nạp tất cả ⇒ ghi mọi dòng Sẵn sàng chưa nạp trong MỘT lần ghi; dòng chưa sẵn sàng giữ nguyên + liệt kê.
- **Output:** sổ có số theo lựa chọn; mỗi lần ghi một mục Hoàn tác; thông báo đếm số dòng ghi / bỏ.
- **End:** hết dòng Sẵn sàng ⇒ chỉ còn dòng chưa quyết (U1 quyết hoặc đóng).

## 6. Flow optimization log

| Biến thể | Kết quả | Lý do |
|---|---|---|
| A. Nạp cả file một lần (bản 36) | Loại cho NV4 (giữ làm "Nạp tất cả") | Không cho nạp phần đã chắc khi còn chỗ chưa rõ ⇒ U1 phải xử hết mới ghi được gì |
| B. Tick dòng rồi nạp dòng đã chọn | Loại (U1 chọn) | Thêm bước tick; cùng kết quả với nạp từng dòng + nạp tất cả |
| **C. Nạp từng dòng ngay + Nạp tất cả dòng sẵn sàng** | **Chọn** | Ít bước nhất; dòng đã chắc vào sổ ngay; không dòng nào treo (chưa sẵn sàng ⇒ liệt kê) |
| Ghép theo tồn đầu trùng số (bản 36) | Giữ làm lớp cuối | File cá: nhiều lô 0 tồn đầu, số hay trùng ⇒ không đủ |
| **Ghép theo invoice + size + loài** | **Chọn** (U1) | Invoice là khóa lô thật của kho; Domain-Specialist (kho NK): một invoice có nhiều size ⇒ phải kèm size |
| Sổ thừa → luôn xuất điều chỉnh | Loại | Phồng nhập + xuất khi sổ đã ghi trước phần nhập (NHM2026010) — sai chuẩn kho (Domain veto) |
| **Sổ thừa ≤ nhập file → cho chọn "Sổ đã tính trước nhập" / "Xuất điều chỉnh"** | **Chọn** (U1) | Hai nguyên nhân thật khác nhau, chỉ kế toán biết |

## 7. Scope & Priority
- **IN:** NV1–NV4 cho mọi file XNT (bạch tuộc, cá…); tách mô tả lô khi tên có; nạp từng dòng / tất cả.
- **OUT:** sửa số tồn đầu dòng dồn kỳ (luật 36: không sửa tay carry); tự nối sổ nhập hàng; đổi nhóm của dòng đã có.

## 8. Success metric
- File cá T10: 31/31 mã đọc đúng số; dòng tổng khớp (kể cả số bị ngắt dòng) ⇒ 0 lỗi kiểm file.
- ≥ 80% mã của file cá có gợi ý ghép theo invoice khi sổ có lô cùng invoice.
- Nạp lại cùng file sau khi đã nạp ⇒ 0 dòng đổi.

## 9. Rules & Invariants
- **R1 Kiểm file** (giữ 36): trọn một tháng · không trùng mã · số mã = "SL mặt hàng" · tổng đọc = tổng in. Số bị ngắt sang dòng dưới trong cùng cột (`303,526.` + `5`) phải ghép lại trước khi so.
- **R2 Tách mô tả lô từ tên**: `INVOICE: <a>/<b>` (bỏ khoảng trắng trong invoice; nhiều invoice nối "/") · `SIZE <x>` hoặc cụm số dạng `a-b`, `a/b`, `a-UP` đứng trước ngày · ngày `d/m/yyyy`; ngày không hợp lệ theo d/m mà hợp lệ theo m/d (VD `10/14/2026`) ⇒ đổi sang m/d + cảnh báo · quy cách `(nKG/CTN|PP)` ⇒ kg/kiện = n · loài = phần chữ đầu tên bỏ "NGUYÊN LIỆU". Không đọc được ô nào ⇒ ô đó trống, không đoán.
- **R3 Ghép**: mã kế toán đã lưu → ghi chú "mã KT:" → **invoice + size + loài** (mọi dòng sổ chưa ghép cùng tháng + kho có invoice trùng một invoice của file — so bỏ dấu cách, cho phép một bên là tiền tố của bên kia ≥ 8 ký tự — và size trùng sau chuẩn hoá, hoặc sổ trống size; nhiều dòng cùng khớp ⇒ ghép CẢ NHÓM) → tồn đầu trùng số duy nhất. Ghép tự động luôn gắn nhãn gợi ý.
- **R4 Ô mô tả** (U1 chọn): dòng sổ đã có ⇒ CHỈ điền ô đang trống bằng giá trị file; ô có giá trị khác file ⇒ cảnh báo ô đó, không đổi. Dòng mới ⇒ lấy hết từ file.
- **R5 Tên dòng mới**: trùng loài với một tên hàng sẵn có của cùng nhóm + kho (so bỏ dấu, bỏ chữ "cá") ⇒ dùng đúng tên đó; không có ⇒ tên gọn từ file.
- **R6 Tình trạng** (giữ 36): Khớp · Mã mới · Lệch tồn đầu · Chưa có dòng sổ · File không cân · Bỏ qua; thêm **Đã nạp**. Ba tình trạng lệch BẮT chọn.
- **R7 Sổ nhiều hơn file `d = sổ − file > 0`**: nếu `d ≤ nhập file` ⇒ lựa chọn "Sổ đã tính trước nhập" (nhập ghi = nhập file − d, xuất = file) **và** "Xuất điều chỉnh" (nhập/xuất = file, thêm xuất d); nếu `d > nhập file` ⇒ chỉ "Xuất điều chỉnh". File nhiều hơn ⇒ dòng điều chỉnh tồn đầu (giữ 36). Cả hai: tồn cuối sổ == tồn cuối file.
- **R8 Nạp**: nạp một dòng chỉ đổi các dòng sổ của mã đó (+ dòng mới / điều chỉnh của mã đó); nạp tất cả = mọi dòng Sẵn sàng chưa nạp, một lần ghi. Nhập/xuất ghi THAY (idempotent).
- **INV**: sau khi nạp một mã theo file: Σ(tồn cuối các dòng sổ của mã) == tồn cuối file của mã.

## 9b. Kiểm kê nội dung (tour + hộp "?" — references/06)
| Mục người dùng gặp | Nguồn |
|---|---|
| 7 tình trạng + nghĩa + điều kiện sang "Sẵn sàng" | `STATUS_LABEL`, R6 |
| Ô sẽ ghi vs ô sổ, cảnh báo ô khác | R2, R4 |
| Hai cách xử sổ thừa, khi nào chỉ có một | R7 |
| Nạp dòng / Nạp tất cả, dòng chưa sẵn sàng bị bỏ qua + liệt kê | R8 |
| Ngày đổi m/d | R2 |

## 10. Acceptance Criteria

### AC-1 — Ghép số bị ngắt dòng ở dòng tổng · Maps to flow: NV1 · Test: unit
- **Given** file cá T10 (dòng tổng xuất in "303,526." và "5" trên hai dòng)
- **When** đọc + kiểm file
- **Then** tổng xuất đọc được bằng tổng in, không có lỗi kiểm file
- **Assert**: `declared.outKg == 303526.5` và `checkNxtReport(r).length == 0`, `r.rows.length == 31`

### AC-2 — Tách mô tả lô từ tên · Maps to flow: NV1–NV2 · Test: unit
- **Given** tên `CÁ SABA NGUYÊN LIỆU SIZE 450-UP 28/7/2026 INVOICE: SBT2026009/SBT202601 1 (15KG/CTN) (KG)`
- **When** tách mô tả
- **Then** loài "Saba", size "450-UP", ngày 2026-07-28, invoice "SBT2026009/SBT2026011", kg/kiện 15
- **Assert**: các trường bằng đúng 5 giá trị trên; tên `… SIZE 40-70 10/14/2026 …` ⇒ ngày "2026-10-14" + 1 cảnh báo đổi tháng/ngày

### AC-3 — Gợi ý ghép theo invoice + size, ghép cả nhóm · Maps to flow: NV2 · Test: unit
- **Given** sổ T10 có 2 dòng `Cá sòng · 50-90 · NHM2026010` (20.535 và 2.250) chưa có mã; file có mã `PXC-CNL NK 2026 4` invoice NHM2026010 size 50/90
- **When** dựng kế hoạch
- **Then** mã ghép cả hai dòng, nguồn ghép "gợi ý"
- **Assert**: `rowIds.length == 2`, `mapSource == "suggest"`, `ledgerOpenKg == 22785`

### AC-4 — Sổ đã tính trước nhập · Maps to flow: NV3 · Test: unit
- **Given** AC-3, file tồn đầu 2.250 · nhập 20.535 · xuất 22.785
- **When** U1 chọn "Sổ đã tính trước nhập" rồi nạp
- **Then** nhập ghi giảm đúng phần thừa, xuất đúng file, tồn cuối bằng file
- **Assert**: Σnhập ghi == 0, Σxuất ghi == 22785, Σtồn cuối == 0; chọn "Xuất điều chỉnh" ⇒ Σnhập == 20535, Σxuất == 43320, Σtồn cuối == 0

### AC-5 — Chỉ còn "Xuất điều chỉnh" khi phần thừa lớn hơn nhập · Maps to flow: NV3 · Test: unit
- **Given** sổ 11.424, file tồn đầu 11.064, nhập 0
- **When** dựng kế hoạch
- **Then** lựa chọn "Sổ đã tính trước nhập" không có
- **Assert**: `CHOICES_OF(item)` không chứa `"prior-in"`; số lựa chọn == 3

### AC-6 — Ô mô tả chỉ điền chỗ trống · Maps to flow: NV2–NV4 · Test: unit
- **Given** dòng sổ `Saba · MTO2026035 · size "" · ngày 2026-07-22` ghép với mã có size 250-450, ngày 22/7/2026, kg/kiện 15; sổ kg/kiện = 12
- **When** nạp mã
- **Then** size được điền, ngày giữ, kg/kiện giữ + có cảnh báo khác
- **Assert**: size ghi == "250-450", importDate == "2026-07-22", kgPerCtn == 12, số cảnh báo ô khác == 1; sổ kg/kiện = 1 ⇒ ghi 15, 0 cảnh báo (A5)

### AC-7 — Nạp một dòng không đụng mã khác · Maps to flow: NV4 · Test: unit
- **Given** kế hoạch có 3 mã Sẵn sàng
- **When** nạp đúng một mã
- **Then** chỉ dòng sổ của mã đó đổi; mã đó thành Đã nạp; 2 mã còn lại vẫn Sẵn sàng
- **Assert**: số dòng sổ đổi == số dòng của mã; dựng lại kế hoạch ⇒ mã đó trạng thái "Đã nạp" (khớp, không còn gì ghi), 2 mã kia có thay đổi chờ

### AC-8 — Nạp tất cả bỏ qua dòng chưa sẵn sàng · Maps to flow: NV4 · Test: unit
- **Given** 2 mã Sẵn sàng + 1 mã Lệch tồn đầu chưa chọn
- **When** nạp tất cả
- **Then** 2 mã được ghi, mã lệch không đổi và được liệt kê
- **Assert**: `result.skipped == 1`, dòng sổ của mã lệch không đổi, danh sách bỏ qua chứa đúng mã đó

### AC-9 — File cá thật end-to-end trên bản demo · Maps to flow: NV1–NV4 · Test: manual (file thật không đưa vào repo)
- **Given** sandbox demo nạp sổ K1000T T9–T10 từ bản sao lưu, file cá T10
- **When** mở file, ghép theo gợi ý, quyết chỗ lệch, nạp từng dòng rồi nạp tất cả
- **Then** 31 mã đọc đúng; mọi mã đã nạp có tồn cuối sổ bằng file; nạp lại ⇒ không có gì để ghi
- **Assert**: Σtồn cuối các mã đã nạp == Σtồn cuối file của các mã đó; lần nạp thứ hai đổi 0 dòng

## 11. Assumptions
- A1 Ngày không ghi rõ (VD `1/7/2026`) đọc kiểu Việt Nam ngày/tháng.
- A2 Mã kế toán đọc đúng như in (kể cả dấu cách: `PXC-CNL NK 2026 0`) — chỉ cần ổn định giữa các tháng.
- A3 Nhóm cho dòng mới mặc định theo tên file: có "NHẬP KHẨU" ⇒ "Nguyên liệu nhập khẩu"; không ⇒ "Hàng tạm" (đổi được).
- A4 Mỗi lần "nạp một dòng" là một mục Hoàn tác riêng.
- A5 KG/kiện = 1 trên sổ là giá trị mặc định khi nạp bảng kê (chưa có quy cách) ⇒ coi như trống, điền từ file.
- A6 Ghép tự động theo invoice (R3 chi tiết, chốt sau khi chạy file cá thật): nhóm đúng size ⇒ cả nhóm khi tổng = tồn đầu file, hoặc một dòng = tồn đầu file và phần còn lại = nhập file; một dòng = tồn đầu file ⇒ chỉ dòng đó (dòng còn lại nêu tên trong cảnh báo). Không dòng đúng size ⇒ chỉ ghép khi chỉ ra ĐÚNG một dòng trống size (tồn đầu = tồn đầu file, hoặc tồn đầu file 0 và = nhập file). Ghép theo số chỉ trong cùng loài.

## History
- 2026-11-06 — chạy file cá thật trên sổ K1000T T10 (bản sao lưu): 31/31 mã đọc đúng, 0 lỗi kiểm file, 14 mã ghép theo gợi ý, 5 mã có "Sổ đã tính trước nhập". Thêm A5, A6.
- 2026-11-06 — tạo, từ yêu cầu "xem trước dạng dữ liệu sẽ đưa vào, nạp từng dòng hoặc toàn bộ" + file cá T10. Chốt với chủ dự án: R4 điền ô trống · R7 cho chọn · R8 nạp dòng + nạp tất cả · R3 invoice + size + loài.
