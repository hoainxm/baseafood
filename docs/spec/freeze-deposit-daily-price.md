# Yêu cầu: giá Gửi đông / Lấy xả đông theo NGÀY, nhập ngay trên bảng Cân đối

> Nguồn: trao đổi Zalo với kế toán (Aslley) 19/10/2026 14:46 + 2 ảnh màn `/balancing` (lưới "Nguyên liệu vào" kỳ Bạch tuộc 2 da 01–05/10 và hộp "Gửi đông vào sổ kho").
> Trạng thái: ĐÃ BUILD 2026-10-19 (chưa commit) theo câu trả lời §6. Risk tier: 🟡 YELLOW (thêm cột nullable, không đổi `balancingCalc.ts`). ⚠️ Chạy mig `0071` trên DB thật TRƯỚC khi deploy.

## 1. Kế toán nói gì

| Lời kế toán | Hiểu là |
|---|---|
| "chị kêu em để ô giá tiền nữa mà, nó nằm đâu vậy" (ảnh 1) | Trên bảng Cân đối **không thấy chỗ gõ giá** của dòng Gửi đông |
| (Nam chỉ vào ô "Giá gửi" trong hộp chọn chỗ gửi — ảnh 2) | |
| "cái này là ô tổng" | Ô Giá gửi trong hộp là **một giá cho cả dòng** (mọi ngày) |
| "chị làm theo ngày ?" | Kế toán **tính giá theo từng ngày gửi**, không phải một giá chung |

## 2. Hiện trạng (đã đối chiếu code 19/10)

- Dòng Gửi đông có **một** đơn giá `balancing_inputs.unit_price`. Gõ ở 2 chỗ: ô "Giá gửi" trong hộp `DepositTargetDialog`, hoặc cột **Đơn giá VNĐ** trên lưới.
- Mỗi ngày gửi đã là **một lô riêng** ở Sổ kho tháng (id `cd|<id dòng>|<ngày>`, invoice `GĐ-yyyymmdd`). Nhưng mọi lô của dòng đều mang **cùng một giá** (`syncMonthlyStockLedger`: `unitPrice: b?.unitPrice`).
- Lấy xả đông: chọn **đích danh một lô**, đơn giá dòng = đơn giá lô (`pickLot`).
- Ảnh 1: cột Đơn giá **bị cột tên dính trái che** khi bảng cuộn ngang (tiêu đề chỉ còn "/NĐ", ô còn ".0.000"). Cột tên rộng vì chứa ô kho K1000 + nút NL + "Gửi thêm". Đây là lý do kế toán không thấy ô giá.
- T.tiền dòng Gửi đông = tổng kg × một giá (−30 kg × 150.000 = −4.500.000).

## 3. Yêu cầu

### R1. Giá Gửi đông nhập theo từng ngày, ngay trên lưới
- Dưới **mỗi** dòng Gửi đông (kể cả các dòng "Gửi thêm") có một hàng phụ **"Giá gửi (đ/kg)"**, nằm thẳng dưới các cột ngày.
- Ngày nào có kg gửi thì ô giá ngày đó **gõ được**. Ngày không có kg thì để trống và không gõ được.
- Gõ kg ở một ngày chưa có giá thì giá **tự điền sẵn** theo thứ tự: giá ngày gần nhất trước đó của cùng dòng › đơn giá dòng (dữ liệu cũ) › bình quân NL thủy sản mua vào của kỳ (gợi ý hiện có). Kế toán sửa đè được.
- Ô giá theo ngày dùng chung ô số `EditableGrid`: hiểu biểu thức kiểu Excel, đi bằng phím, Ctrl+Z, dán khối.

### R2. Cột Đơn giá và T.tiền của dòng Gửi đông là số TÍNH RA
- **Đơn giá** = bình quân gia quyền theo ngày (Σ kg×giá ÷ Σ kg), chỉ đọc, có nhãn nhỏ "BQ".
- **T.tiền** = Σ (kg ngày × giá ngày).
- Lưu `unit_price` = bình quân **không làm tròn**. Như vậy `balancingCalc.ts` (Giá trị NL = kg × đơn giá) **KHÔNG phải đổi**, và lãi/lỗ khớp tổng tiền theo ngày.

### R3. Mỗi lô GĐ-ngày mang đúng giá của ngày đó
- Lô `GĐ-yyyymmdd` ở Sổ kho tháng lấy đơn giá = giá ngày gửi. Ngày chưa có giá riêng thì lấy đơn giá dòng (giữ hành vi cũ).
- Sửa giá một ngày chỉ ghi lại **đúng lô ngày đó**, đi qua chốt `syncMonthlyStockLedger` sẵn có, kể cả dồn sang tháng sau đã mở (`propagateLotsForward`). Không mở đường ghi thứ hai.

### R4. Lấy xả đông: giá theo lô, chạy theo giá ngày gửi, SỬA ĐƯỢC khi lấy
- Mỗi dòng Lấy xả đông vẫn lấy **một lô**, nên đơn giá = giá lô đó. Sau R3, giá lô chính là **giá của ngày gửi** ra lô ấy, nên Lấy xả đông tự mang đúng giá theo ngày, kế toán không phải gõ lại.
- Lấy từ nhiều lô (nhiều ngày gửi, nhiều giá) thì dùng "+ Lấy thêm lô" (mỗi lô một dòng, mỗi dòng giá riêng), như hiện nay.
- Ô chọn lô đã hiện "giá … đ". Giữ nguyên.
- Kế toán **sửa được** đơn giá trên dòng lấy (giá lưu chỉ để biết, chỉnh cho phù hợp — §6). Sửa trên dòng lấy **không** đổi giá đã lưu ở lô. Dưới ô chọn lô: cùng giá ⇒ "giá gửi lô X đ/kg"; đã sửa ⇒ "đã sửa · giá lô X đ" + nút **Dùng giá lô**.
- Giá gợi ý của dòng ảo Lấy xả đông (`lastFreezeDepositPrice`) đổi thành giá của **ngày gửi gần nhất** kỳ trước, thay cho đơn giá cả dòng.

### R5. Hộp "Gửi đông vào sổ kho" bỏ ô Giá gửi
- Một giá chỉ được gõ ở **một chỗ** (lưới). Bỏ ô "Giá gửi" trong hộp để kế toán khỏi nhầm "ô tổng".
- Cả kỳ cùng một giá: gõ ô **Đơn giá** của dòng Gửi đông = một giá cho mọi ngày (không cần nút riêng). Khi giá các ngày đã KHÁC nhau, ô Đơn giá **khoá** (hiện "BQ theo ngày") — ô ghi theo từng phím và Esc trả số bình quân, để mở thì lỡ tay là san phẳng giá từng ngày. Hoàn tác (Ctrl+Z) trả cả giá lô.

### R6. Không để cột giá bị che
- Giá đã nằm dưới cột ngày (R1) nên thấy được mà không phải cuộn tới cột Đơn giá.
- Thêm: khi cuộn ngang, ô tiêu đề và ô số **không bị cột tên dính trái đè lộ nửa chữ** (ảnh 1: "/NĐ", ".0.000"). Kiểm ở 360px, desktop và cỡ chữ 130%.

## 4. Dữ liệu

- Thêm cột `balancing_inputs.daily_prices jsonb` (nullable, `{ "yyyy-mm-dd": đ/kg }`) bằng migration mới `0071_balancing_daily_prices.sql`, idempotent (`add column if not exists`). Đường lùi: `alter table balancing_inputs drop column if exists daily_prices;`.
- Kiểu: `BalancingInputItem.dailyPrices?: Record<string, number>`; ánh xạ `toRow`/`fromRow` ở `repo.ts`; chỉ gửi khi có giá trị (chạy được cả khi chưa chạy 0071, như `nguon_kho`).
- Dữ liệu cũ (không có `daily_prices`) = mọi ngày dùng `unit_price`, nên **không hồi quy**. Không backfill trên DB thật (backfill = 🔴, phải hỏi riêng).
- Chế độ demo: cột thuộc bảng đã có trong `DemoBundle`; kiểm `rowToServer`/`rowFromServer` mang cột mới.

## 5. Tiêu chí nghiệm thu (AC)

1. Kỳ 01–05/10, Gửi đông 1/10 = 10 kg giá 150.000; 2/10 = 20 kg giá 160.000 ⇒ T.tiền = −(1.500.000 + 3.200.000) = **−4.700.000**; Đơn giá BQ = 156.667; Giá trị NL và Lãi/Lỗ của kỳ tính theo −4.700.000.
2. Sổ kho tháng 10 có 2 lô: `GĐ-20261001` đơn giá 150.000, `GĐ-20261002` đơn giá 160.000.
3. Sửa giá 2/10 thành 155.000 ⇒ chỉ lô `GĐ-20261002` đổi giá. Tháng 11 đã mở thì tồn đầu lô đó ở tháng 11 cũng đổi theo.
4. Kỳ sau chọn lô `GĐ-20261002` ở Lấy xả đông ⇒ đơn giá dòng = 155.000.
5. Gõ 15 kg ngày 3/10 ⇒ ô giá 3/10 tự điền 155.000 (giá ngày trước), sửa được.
6. Kỳ cũ chỉ có `unit_price` ⇒ mở ra hàng phụ hiện cùng một giá ở mọi ngày có kg, T.tiền như trước.
7. Ctrl+Z sau khi sửa giá một ngày ⇒ trả cả lưới lẫn giá lô trong Sổ kho tháng.
8. Xóa kỳ ⇒ các lô GĐ của kỳ bị dọn như hiện nay.
9. 360px / desktop / 130%: hàng Giá gửi không vỡ bố cục, không cuộn ngang toàn trang.

## 6. Câu đã hỏi lại — trả lời (2026-10-19)

1. Giá gửi do **kế toán quyết định**. Mục đích chính của ô: **lưu giá gửi rồi lấy ra** để kế toán biết và chỉnh cho phù hợp.
2. Giá gửi theo ngày: **kế toán tự gõ** (không tự tính từ sổ nhập).
3. Lấy xả đông giá theo lô là đúng, **và cho phép sửa giá khi lấy** ⇒ R4.

## 7. Phạm vi code dự kiến

`src/types.ts` · `src/lib/repo.ts` (ánh xạ cột) · `src/lib/balancingStockLines.ts` (giá lô theo ngày, + test) · `src/lib/balancingGrid.ts` (T.tiền / BQ theo ngày, + test) · `src/features/balancing/MaterialGrid.tsx` + `gridDialogs.tsx` (hàng phụ Giá gửi, bỏ ô trong hộp) · `src/features/balancing/usePeriodGrid.ts` (`lastFreezeDepositPrice`) · migration `0071` · doc `31-can-doi-ky.md`, `36-so-kho-thang.md`, `03-database.md`, `04-tang-du-lieu.md`. **Không** đổi `balancingCalc.ts`.
