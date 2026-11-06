# 44 — ba-spec: Gửi đông vào dòng CÓ SẴN của Sổ kho tháng

> Load khi: đổi cách dòng Gửi đông của Cân đối ghi vào Sổ kho tháng (lô mới `GĐ-ngày` ⇄ cộng vào lô có sẵn), hộp "Gửi đông vào sổ kho", vết cân đối trong ghi chú lô.
covers: src/lib/balancingStockLines.ts, src/features/balancing/DepositTargetDialog.tsx, src/features/balancing/MaterialGrid.tsx, src/features/balancing/usePeriodGrid.ts
last_verified: 2026-10-27
ttl_days: 90

> **Mục đích**: oracle HÀNH VI cho việc ghi Gửi đông vào sổ kho. Không mô tả giao diện.
> **Trạng thái**: ĐẶC TẢ — CHƯA BUILD (chờ chủ dự án chốt §11). Risk tier 🟡 YELLOW: chỉ đổi code, không migration (dùng lại cột `balancing_inputs.stock_line_id` mig `0053`, hiện chỉ dòng Lấy xả đông dùng).

---

## 1. Vấn đề & JTBD

- **Nguồn**: kế toán (chị Aslley), 27/10/2026, ảnh Sổ kho tháng 10 · bảng Hàng tạm. Gửi đông 01–05/10 ở Cân đối đẻ ra 2 dòng MỚI "Bạch tuộc 2 da lớn (80↑)" `GĐ-20261001` (10 kg) và `GĐ-20261002` (20 kg). Bảng đã có sẵn các dòng "Bạch tuộc 2 da 80up" (HỒNG PHÚ 15.504 kg, F34 10.032 kg…). Lời chị: *"làm sao cho nó nhập vô cái có sẵn, chứ tạo ra cái mới làm gì"*.
- **Hiện trạng (đối chiếu code 27/10)**:
  - Mỗi NGÀY gửi = một lô mới `cd|<id dòng>|<ngày>`, invoice `GĐ-yyyymmdd` (`syncMonthlyStockLedger`, nhánh `freeze-deposit`).
  - Hộp "Gửi đông vào sổ kho" cho chọn một dòng sổ, nhưng chỉ CHÉP tên · nhóm · kho của dòng đó (`DepositTargetDialog.pickRow`). Không lưu dòng nào được chọn. Kết quả vẫn là lô mới.
  - Lấy xả đông thì đã ghi thẳng vào lô chọn đích danh: `stock_line_id` + vết `⟦CĐ:<id dòng>:<kg>⟧` trong ghi chú lô, cột Xuất cộng phần chênh.
- **Job**: Khi gửi đông NL dư của kỳ, kế toán muốn số kg **cộng vào đúng dòng hàng đang có** trong bảng sổ kho, để bảng không mọc thêm dòng trùng hàng và tồn mỗi mặt hàng nằm một chỗ.
- **Đo thành công bằng**: gửi đông vào hàng đã có ⇒ số dòng của bảng không tăng; tồn cuối dòng đó tăng đúng số kg gửi.

## 2. User registry

| User | Là ai | Bối cảnh |
|---|---|---|
| Kế toán | ghi Cân đối kỳ, dò Sổ kho tháng | desktop văn phòng |
| Hệ thống (chốt ghi sổ) | `syncMonthlyStockLedger` — MỘT đường ghi phần kho của Cân đối vào sổ | nền, chạy mỗi lần lưu khối NL |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Gửi đông vào một dòng có sẵn của sổ | Kế toán | — | sổ tháng đã có dòng hàng | Must |
| NV2 | Gửi đông khi sổ chưa có dòng hàng đó (tạo dòng mới) | Kế toán | — | — | Must (giữ hành vi cũ) |
| NV3 | Chuyển lô `GĐ-ngày` đã ghi sang dòng có sẵn | Kế toán | Lấy xả đông kỳ sau (nếu đã lấy từ lô GĐ) | NV1 | Must |
| NV4 | Ghi lại khi sổ bị sửa / nạp đè (kiểm khớp) | Hệ thống → Kế toán | — | NV1 | Should |

## 4. Cross-user handoff

N/A — một người dùng. Điểm "bắt tay" duy nhất là giữa hai dòng Cân đối của **hai kỳ** (Gửi đông kỳ này → Lấy xả đông kỳ sau cùng lô), xử ở R6.

## 5. Flows

### Flow NV1 — Gửi đông vào dòng có sẵn · owner: kế toán
- **Start**: dòng Gửi đông của kỳ đã có kg theo ngày.
- **Input**: dòng Gửi đông (kg từng ngày) + một dòng của Sổ kho tháng chọn đích danh (tên · size · invoice · kho).
- **Steps**: mở chỗ gửi → chọn đích danh dòng sổ → lưu.
- **Output**: dòng sổ đã chọn: cột **Nhập** + Σ kg gửi của tháng; ghi chú lô có vết nhập của dòng cân đối; KHÔNG có dòng `GĐ-…` mới. Kỳ vắt 2 tháng ⇒ phần tháng sau vào dòng dồn `carry|<lô>` của tháng đó.
- **End**: nhãn dòng Gửi đông ở Cân đối chỉ đúng "→ <tên hàng · invoice · kho>" của dòng đã chọn.

### Flow NV2 — Sổ chưa có dòng hàng · owner: kế toán
- **Input**: dòng Gửi đông + chỉ chọn BẢNG (không chọn dòng).
- **Output**: như hiện nay — mỗi ngày gửi một lô `GĐ-ngày` ở bảng đã chọn (R3 của `spec/freeze-deposit-daily-price.md` giữ nguyên cho nhánh này).

### Flow NV3 — Dời lô GĐ cũ vào dòng có sẵn · owner: kế toán
- **Start**: dòng Gửi đông đang có các lô `GĐ-ngày` (VD 01–05/10).
- **Steps**: mở chỗ gửi → chọn đích danh dòng sổ → lưu.
- **Output**: các lô `GĐ-ngày` của dòng biến mất (kể cả dòng dồn sạch ở tháng sau đã mở); dòng đã chọn cộng đủ kg. Tổng tồn của bảng không đổi.
- **Nhánh chặn**: một lô `GĐ-ngày` đã bị Lấy xả đông (kỳ sau) hoặc có nhập/xuất gõ tay ⇒ KHÔNG dời, báo lô nào + kỳ nào đang lấy. Sổ giữ nguyên.

### Flow NV4 — Kiểm khớp · owner: hệ thống → kế toán
- **Input**: dòng Gửi đông có dòng đích + sổ hiện tại.
- **Output**: vết nhập trong ghi chú lô ≠ kg gửi của tháng (VD nạp lại Excel đè cột Nhập) ⇒ tính 1 chỗ lệch trong "Sổ kho tháng lệch n chỗ"; "Ghi lại vào sổ kho" đặt lại đúng.

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do |
|---|---|---|---|
| NV1 | A: cộng vào dòng chọn đích danh (khuôn Lấy xả đông) · B: tự tìm dòng cùng tên + kho · C: bỏ hẳn lô mới, luôn bắt chọn dòng | Chọn A | B sai khi nhiều dòng cùng tên khác invoice (ảnh: HỒNG PHÚ · F34 cùng "80up") — kế toán phải chọn lô. C kẹt lần gửi đầu tiên khi sổ chưa có hàng (dead-end). A tái dùng đúng cơ chế vết + `stock_line_id` đã chạy ở Lấy xả đông. |
| NV1 · độ mịn | A: cộng theo THÁNG (một vết / tháng) · B: theo ngày | Chọn A | Dòng sổ là dòng tháng; vết theo ngày làm ghi chú dài, không thêm thông tin cho tồn. Ngày gửi vẫn nằm ở Cân đối. |
| NV1 · giá | A: giữ đơn giá dòng có sẵn · B: bình quân gia quyền lại đơn giá dòng · C: ghi đè bằng giá gửi | Chọn A (chờ chốt §11) | B/C đổi tiền còn lại của hàng đã có, đụng số kế toán đã chốt. A an toàn, không đổi giá ai đã gõ. Giá gửi theo ngày vẫn tính T.tiền ở Cân đối. |
| NV3 | A: kế toán tự chọn lại từng dòng Gửi đông · B: tự dời hàng loạt khi mở màn | Chọn A | Sổ thật — không tự dời (cùng luật 2026-10-20 "không tự dời hàng loạt khi mở màn"). |
| Đánh giá | Orchestrator + soát nghiệp vụ kho (tuần tự, một user, không spawn đội) | | |

## 7. Scope

- **IN**: NV1–NV4.
- **OUT**: tự gộp các dòng trùng tên có sẵn trong sổ; đổi luật Lấy xả đông; đổi công thức tồn NL (`/nxt-material`); lô `wip|…` của /wip.

## 8. Success metric

| NV | Metric | Ngưỡng |
|---|---|---|
| NV1 | số dòng của bảng sau khi gửi vào dòng có sẵn | không tăng (== trước) |
| NV3 | tổng tồn cuối của bảng trước/sau khi dời | bằng nhau tới 0,001 kg |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Một dòng Gửi đông ghi vào **đúng một** chỗ: dòng đích chọn đích danh (`stock_line_id`), HOẶC các lô `GĐ-ngày` (không chọn dòng). Không bao giờ cả hai. | đổi qua lại hai kiểu ⇒ kiểu cũ về 0 trước |
| R2 | Ghi kiểu ĐẶT GIÁ TRỊ: phần của dòng cân đối trong mỗi (lô, tháng) đọc từ vết; cột Nhập cộng phần CHÊNH. Lưu lại cùng số ⇒ sổ không đổi. | lưu 2 lần liên tiếp |
| R3 | Vết nhập phân biệt được với vết xuất của Lấy xả đông, kể cả khi cùng lô. | gửi + lấy cùng một lô trong một kỳ |
| R4 | Xóa dòng / xóa kỳ / bỏ dòng đích ⇒ cột Nhập trừ đúng phần đã cộng, vết gỡ; dòng đích còn nguyên (không xóa dòng có sẵn). | dòng đích có số khác do người gõ |
| R5 | Không đổi đơn giá, tên, size, invoice, ngày nhập, vị trí của dòng đích (chờ chốt giá §11). | — |
| R6 | Dời khỏi lô `GĐ-ngày` (NV3) bị chặn nếu lô đó (hoặc dòng dồn của nó) có xuất / nhập khác ngoài phần Gửi đông; báo tên lô + kỳ đang Lấy xả đông. Sổ không đổi. | lô GĐ đã bị kỳ 06–10/10 lấy |
| R7 | Phần làm tồn dòng đích âm ⇒ chặn, như Lấy xả đông. (Chỉ xảy ra khi giảm kg gửi mà dòng đích đã xuất nhiều hơn phần còn lại.) | giảm kg gửi sau khi đã lấy |
| R8 | Tháng của phần gửi chưa mở ⇒ tự kế thừa như hiện nay; dòng đích ở tháng sau = `carry|<lô>`; dòng đích không có ở tháng đó ⇒ chặn, báo chọn dòng khác. | kỳ 28/10–03/11 |
| R9 | Tháng sau đã mở ⇒ tồn đầu dòng dồn của lô đích đi theo (`propagateLotsForward`). | — |
| R10 | Dòng đích là lô `wip|…` (Hàng tạm do /wip ghi) vẫn cho chọn, kèm cảnh báo nguy cơ ghi đôi (34 § Hàng đông lạnh). | — |
| R11 | Chế độ demo: `stock_line_id` mang tiền tố `demo:` như Lấy xả đông (đã khai `refColumns`). | — |

## 10. Acceptance Criteria

### AC-1 — Gửi vào dòng có sẵn · NV1 · Test: unit (`balancingStockLines.test.ts`)
- **Given** tháng 10 có dòng L "Bạch tuộc 2 da 80up" · F34, nhập 10.032 kg; dòng Gửi đông kỳ 01–05/10 có 10 kg ngày 01/10 và 20 kg ngày 02/10, dòng đích = L
- **When** ghi phần kho vào sổ
- **Then** L có nhập 10.062 kg, ghi chú có 1 vết nhập 30 kg của dòng cân đối; không có dòng `cd|…`
- **Assert**: `L.inKg == 10062` · `count(id startsWith "cd|") == 0` · `count(lines) == trước`

### AC-2 — Đặt giá trị, không cộng dồn · NV1 · Test: unit
- **Given** sổ sau AC-1
- **When** ghi lại với cùng dòng cân đối; rồi sửa 02/10 thành 25 kg và ghi
- **Then** lần 1 không đổi gì; lần 2 L nhập 10.067 kg
- **Assert**: `changed == false` · sau đó `L.inKg == 10067`

### AC-3 — Xóa dòng trả sổ như cũ · NV1 · Test: unit
- **Given** sổ sau AC-1
- **When** xóa dòng Gửi đông (ghi với `after = []`)
- **Then** L nhập 10.032 kg, không còn vết; L vẫn còn trong sổ
- **Assert**: `L.inKg == 10032` · `L.note` không chứa vết của dòng · `L` tồn tại

### AC-4 — Không chọn dòng ⇒ lô mới như cũ · NV2 · Test: unit (test hiện có giữ xanh)
- **Given** dòng Gửi đông không có dòng đích
- **When** ghi
- **Then** mỗi ngày gửi một lô `GĐ-ngày`
- **Assert**: `count(id startsWith "cd|g1|") == 2`

### AC-5 — Dời lô GĐ cũ · NV3 · Test: unit
- **Given** sổ đang có `GĐ-20261001` (10 kg) + `GĐ-20261002` (20 kg) của dòng g1, tháng 11 đã mở có dòng dồn sạch của hai lô; dòng L như AC-1
- **When** g1 chuyển sang dòng đích L và ghi
- **Then** hai lô `cd|g1|…` và dòng dồn của chúng biến mất; L nhập +30 kg; tồn cuối cả tháng 10 không đổi
- **Assert**: `count(id contains "cd|g1|") == 0` · `L.inKg == 10062` · `Σ closeKg tháng 10 == trước`

### AC-6 — Chặn dời khi lô GĐ đã bị lấy · NV3 · Test: unit
- **Given** `GĐ-20261002` có vết Lấy xả đông 5 kg của kỳ 06–10/10
- **When** g1 chuyển sang dòng đích L
- **Then** có lỗi nêu `GĐ-20261002`; sổ không đổi
- **Assert**: `error != null` · `error` chứa "GĐ-20261002" · `lines === trước`

### AC-7 — Gửi và lấy cùng lô · NV1 · Test: unit
- **Given** dòng L; kỳ có Gửi đông 30 kg vào L và Lấy xả đông 12 kg từ L
- **When** ghi; rồi xóa riêng dòng Lấy
- **Then** L nhập +30, xuất +12; xóa Lấy ⇒ xuất về như cũ, nhập vẫn +30
- **Assert**: `ΔinKg == 30 && ΔoutKg == 12` · sau xóa `ΔoutKg == 0 && ΔinKg == 30`

### AC-8 — Kỳ vắt 2 tháng · NV1 · Test: unit
- **Given** lô L ở tháng 10, tháng 11 có `carry|L`; Gửi đông 8 kg ngày 31/10 + 5 kg ngày 01/11 vào L
- **When** ghi
- **Then** L nhập +8; `carry|L` nhập +5 và tồn đầu `carry|L` tăng 8
- **Assert**: `L.inKg Δ == 8` · `carry|L.inKg Δ == 5` · `carry|L.openKg Δ == 8`

### AC-9 — Kiểm khớp phát hiện nạp đè · NV4 · Test: unit
- **Given** sổ sau AC-1, rồi cột Nhập của L bị đặt lại 10.032 (nạp Excel)
- **When** đếm chỗ lệch
- **Then** 1 chỗ lệch; ghi lại ⇒ L về 10.062, còn 0 chỗ lệch
- **Assert**: `countMonthlyStockMismatches == 1` → sau ghi lại `== 0`

### AC-10 — Ca thật kế toán · NV3 · Test: manual (preview demo, không DB thật)
- **Given** kỳ Bạch tuộc 2 da 01–05/10 có 2 lô `GĐ-20261001/02` ở bảng Hàng tạm
- **When** kế toán mở chỗ gửi của dòng Gửi đông, chọn dòng "Bạch tuộc 2 da 80up" cần gửi, lưu
- **Then** bảng Hàng tạm tháng 10 không còn 2 dòng "Bạch tuộc 2 da lớn (80↑)"; dòng đã chọn nhập +30 kg; nhãn dòng Gửi đông chỉ tên dòng đó; Hoàn tác trả lại 2 lô
- **Assert**: số dòng bảng Hàng tạm giảm 2 · Δ nhập dòng chọn == 30 · sau Hoàn tác số dòng == ban đầu

## 11. Assumptions / Open

- **Assumptions** (mặc định an toàn, build theo đây nếu không có ý khác):
  1. **Giá**: dòng đích GIỮ đơn giá của nó (R5). Giá gửi theo ngày chỉ dùng tính T.tiền ở Cân đối; kỳ sau Lấy xả đông từ dòng này mang giá của dòng, sửa được như hiện nay (`spec/freeze-deposit-daily-price.md` R4).
  2. **Lô GĐ cũ**: không tự dời. Kế toán mở chỗ gửi của từng dòng Gửi đông và chọn dòng đích (NV3).
  3. **Không chọn dòng** ⇒ vẫn tạo lô `GĐ-ngày` như cũ (NV2), để lần gửi đầu khi sổ chưa có hàng không bị kẹt.
- **Open (cần chủ dự án / kế toán chốt trước khi build)**: ba mặc định trên có đúng ý kế toán không — nhất là (1) giá.

## History
- v1 (2026-10-27): khởi tạo từ phản hồi kế toán ảnh Sổ kho tháng 10 · Hàng tạm.
