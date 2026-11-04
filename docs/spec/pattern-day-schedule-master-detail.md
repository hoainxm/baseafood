# Mẫu giao diện: Lịch theo ngày hai cột (danh sách ngày | chi tiết một ngày)

> Rút từ tab **Lịch xuất hàng** (`/planning-export`, `src/features/export-planning/MonthView.tsx`), đã xem thật ở 1366 px và 375 px ngày 2026-11-04.
> File này chỉ nói **cách tổ chức giao diện** để dùng lại. Không có nghiệp vụ xuất khẩu. Tên chung dùng trong file: **bản ghi** (một việc có ngày), **nhóm** (thứ để gom bản ghi, vd khách, tuyến, khu), **kỳ** (khoảng thời gian đang xem).

## 1. Khung trang

```
┌─ 1. Đầu trang ──────────────────────────────────────────────────────────┐
│ [Tab A] [Tab B] [Tab C]                                  [+ Nút chính]  │
├─ 2. Thanh lọc (một hàng, tự xuống dòng khi hẹp) ────────────────────────┤
│ Xem theo [Tháng|Tuần|Ngày]  ‹ Tháng 10/2026 › [Nay]                     │
│ Nhóm [Tất cả ▾]   Tra cứu [__________]                       [Xuất file]│
├─ 3. Thẻ số (4 thẻ, cùng khuôn) ─────────────────────────────────────────┤
│ Tổng 4        │ Xong 2        │ Còn thiếu 2    │ Trễ 2                  │
│ dòng phụ      │ dòng phụ      │ dòng phụ       │ dòng phụ               │
├─ 4. Lịch hai cột ───────────────────────────────────────────────────────┤
│ Ngày                    │ Thứ 7, 24/10/2026 · 2 nhóm · 3 bản ghi        │
│ ┌─────────────────────┐ │ Nhóm X · 2 bản ghi                            │
│ │Thứ 5, 08/10/2026    │ │  ┌──────────────────────────────────────────┐ │
│ │1 nhóm · 1 bản ghi   │ │  │ Tên bản ghi      ngày   số   ▬▬▬▬▬▬ [Mở]  │ │
│ │Nhóm A               │ │  │ dòng phụ                Bước tiếp: …     │ │
│ └─────────────────────┘ │  └──────────────────────────────────────────┘ │
│ ┏━━━━━━━━━━━━━━━━━━━━━┓ │ Nhóm Y · 1 bản ghi                            │
│ ┃Thứ 7, 24/10 [2 trễ] ┃ │  └ …                                          │
│ ┃3 bản ghi · 2 nhóm   ┃ │                                               │
│ ┗━━━━━━━━━━━━━━━━━━━━━┛ │                                               │
│ Chưa có ngày            │                                               │
├─ 5. Khối ngoại lệ (chỉ hiện khi có) ────────────────────────────────────┤
│ Việc chưa lên lịch  (bảng ngắn + nút Mở)                                │
└─────────────────────────────────────────────────────────────────────────┘
Điện thoại: một cột. Danh sách ngày → chạm ngày → chi tiết (có "‹ Quay lại").
```

**Vì sao xếp như vậy:** đi từ tổng tới chi tiết. Lọc trước, nhìn số tổng, chọn ngày, xem từng bản ghi, rồi mới tới việc nằm ngoài lịch. Trang chỉ để xem. Mọi việc ghi đều làm ở màn chi tiết bản ghi (nút "Mở"), nên trang không cần nút ghi nào ngoài nút chính ở đầu.

## 2. Luật của từng vùng

### Vùng 1: Đầu trang
- Tab của module (2–6 tab, không lồng tab). Điện thoại: tab chia lưới 2 cột, ẩn icon, chữ được xuống dòng.
- **Đúng một nút chính** bên phải, dùng chung cho mọi tab. Nút phụ (nếu có, vd "Hướng dẫn") đứng trước nút chính, kiểu viền.

### Vùng 2: Thanh lọc
- **Một hàng, tự xuống dòng** (`flex-wrap`, mỗi nhóm ô có `basis` riêng). Mục tiêu: lịch hiện ngay trong màn đầu.
- Nhãn luôn hiện trên mỗi ô. Không dùng chữ mờ thay nhãn. Không đặt dòng gợi ý dưới ô trong cùng hàng, vì làm lệch ô.
- **Chọn kỳ** gồm hai phần:
  - Nhóm chọn "Xem theo" (Tháng · Tuần · Ngày), rộng cố định để chữ không gãy.
  - Tháng / Tuần: khung `‹ nhãn kỳ ›`. Nút **"Nay"** chỉ hiện khi đang xem kỳ khác, và nằm TRONG khung để không đẩy hàng.
  - Ngày: ô chọn khoảng ngày. Nhãn nói luôn ngày nào được dùng để xếp.
  - Đổi loại kỳ thì nhảy về kỳ hiện tại của loại đó.
- **Lọc nhóm**: ô chọn có tìm, mục đầu là "Tất cả", chỉ liệt kê nhóm có dữ liệu.
- **Ô tra**: nhãn kể các mã tra được. Tra trên mọi kỳ, không chỉ kỳ đang xem.
- **Xuất file**: nút viền, đứng cuối hàng, chỉ hiện khi có quyền.
- Kỳ đang xem ghi lên URL (`?month=` / `?week=` / `?from=&to=`) để gửi link được.

### Vùng 3: Thẻ số
- 4 thẻ, cùng khuôn **nhãn · số · dòng phụ**. Thẻ nào cũng có dòng phụ để 4 thẻ cao bằng nhau.
- Thứ tự gợi ý: Tổng · Xong · Còn thiếu · Trễ.
- Màu theo nghĩa: tổng = màu thương hiệu, xong = xanh. Thẻ cảnh báo **chỉ đổi màu khi số > 0**, bằng 0 thì về màu trung tính.
- Dòng phụ nói **điều kiện** của con số ("xong bước 1–5", "theo ngày giao"), không để trang trí.
- Thẻ số đi theo **mọi** bộ lọc, kể cả lọc nhóm.

### Vùng 4: Lịch hai cột (lõi của mẫu)
**Bố cục:** từ `md` trở lên là lưới `minmax(13rem,17rem) | minmax(0,1fr)`, căn đầu. Dưới `md` chỉ một cột.

**Cột trái: danh sách ngày** (`<nav>` + `<ol>`, mỗi mục là một `<button>`):
```
Thứ 7, 24/10/2026  [2 trễ] [1 còn thiếu]   ← tiêu đề đậm, số căn đều + thẻ cảnh báo (chỉ khi > 0)
2 nhóm · 3 bản ghi                          ← hai con số, ngăn bằng " · "
Nhóm X · Nhóm Y                             ← tên nhóm, chữ nhạt, cắt 1 dòng
```
- Chỉ hiện ngày **có** bản ghi, xếp tăng dần. Không hiện ngày trống.
- Ngày đang chọn: viền 2 px màu chính + nền nhấn + `aria-current`. Ngày khác: viền thường, rê chuột thì nền nhạt.
- Mục **"Chưa có ngày"** luôn ở cuối danh sách, cho bản ghi chưa có ngày.
- Không thu / mở. Bấm một ngày là đổi chi tiết bên phải.

**Cột phải: khung chi tiết** (viền, bo góc, đệm 16 px):
- Dòng đầu: `Thứ 7, 24/10/2026` + tóm tắt `2 nhóm · 3 bản ghi · tổng số lượng`.
- Mục "Chưa có ngày": thêm một câu nói vì sao bản ghi nằm đây và làm gì để nó vào đúng ngày.
- Mỗi nhóm: tiêu đề nhỏ `Tên nhóm · n bản ghi` + một bảng.
- **Cột của bảng**, theo thứ tự quan trọng:

| Cột | Cách trình bày |
|---|---|
| Bản ghi (cột chính) | 2 dòng: dòng 1 đậm là mã / tên, dòng 2 nhạt là việc gốc và mô tả. Gộp lại thay vì thêm cột. |
| Ngày | ngày chính + ngày phụ trên một dòng, số căn đều |
| Số lượng | "kế hoạch · thực tế", căn phải |
| **Tiến độ** | thanh N khúc (mỗi khúc có chú thích khi rê chuột) + câu "Bước tiếp: … — còn …" + thẻ cảnh báo bên dưới |
| Thao tác | một nút "Mở" kiểu viền, dẫn tới màn chi tiết của bản ghi |

- Cột Tiến độ là thông tin quan trọng nhất, nên đặt chỗ rộng nhất sau cột chính.
- Mỗi dòng tô màu được và sắp được theo cột (theo luật chung của hệ thống).

### Vùng 5: Khối ngoại lệ
- Việc của kỳ mà chưa có ngày để xếp (vd việc gốc chưa được chia thành bản ghi). Đặt SAU lịch.
- Bảng ngắn: Nhóm · Việc gốc · Hạn · **Còn thiếu** (thẻ vàng nói thiếu bao nhiêu, thẻ đỏ "Quá hạn") · Mở.
- Chỉ hiện khi có dòng.

### Chế độ tra cứu
- Ô tra có chữ thì **thay cả vùng 3, 4 và 5** bằng kết quả tra. Xóa chữ thì lịch trở lại.
- Kết quả là bảng phẳng, không chia theo ngày, có thêm cột Nhóm ở đầu.
- Có thể có bảng thứ hai cho việc gốc khớp mà chưa có bản ghi.
- Câu khi trống nói rõ trống ở đâu, vd "Không có bản ghi nào khớp — xem việc gốc bên dưới."

## 3. Cách giữ trạng thái chọn ngày

- **Luôn có đúng một ngày đang chọn.** Mặc định là ngày có việc đầu tiên từ hôm nay trở đi. Kỳ đã qua thì lấy ngày đầu kỳ. Kỳ chỉ có bản ghi chưa có ngày thì chọn "Chưa có ngày".
- Lưu lựa chọn kèm một khóa: `{ key: kỳ + bộ lọc, day, phoneDetail }`. Khi kỳ hoặc bộ lọc đổi, khóa đổi theo, lựa chọn cũ tự hết hiệu lực và ngày mặc định được tính lại. Không cần `useEffect` để reset.
- Ngày đã chọn mà không còn trong danh sách (vd sau khi lọc) cũng rơi về mặc định.
- Phần gom theo ngày là **một hàm thuần riêng**, tách khỏi màn hình:
  ```ts
  buildDaySchedule(groups) → { days: { date, groupCount, recordCount, lateCount, missingCount, total, groups[] }[], undated: groups[] }
  defaultOpenDay(days, today) → string | null
  ```
  Hàm chỉ gom lại kết quả lọc kỳ có sẵn, không lọc lại. Nhờ vậy tổng của mọi ngày cộng "Chưa có ngày" luôn bằng thẻ "Tổng".

## 4. Điện thoại và các khổ màn

| Khổ | Lịch | Ghi chú |
|---|---|---|
| < `md` (điện thoại, iPad dọc) | một cột: danh sách ngày → chạm ngày → chi tiết có "‹ Quay lại" | ẩn cột kia bằng class, không gỡ khỏi DOM |
| ≥ `md` | hai cột | — |

- Bảng trong khung chi tiết đổi sang **dạng thẻ theo bề rộng vùng chứa** (container query, khoảng 768 px), không theo bề rộng màn. Đo thật: ở 1366 px còn thanh bên, cột phải chỉ rộng khoảng 726 px nên chi tiết hiện dạng thẻ. Hãy quyết trước là muốn bảng hay thẻ ở laptop thường. Thẻ hợp với chi tiết một ngày, vì ít dòng mà mỗi dòng nhiều tầng.
- Không cuộn ngang toàn trang ở 360–375 px.
- **Điểm yếu đã thấy:** ở điện thoại, thanh lọc và 4 thẻ số chiếm gần hết màn đầu, danh sách ngày bị đẩy xuống. Nếu người dùng chính ở điện thoại, nên gộp 4 thẻ thành một dòng tóm tắt.

## 5. Ma trận trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | khung xương bảng thay cả thân trang |
| Kỳ trống | thẻ số = 0 + khối trống "<kỳ> chưa có … [của nhóm này]" + **một câu nói việc cần làm để có dữ liệu** |
| Chỉ có bản ghi chưa có ngày | danh sách chỉ có mục "Chưa có ngày", tự chọn sẵn |
| Kỳ đã qua | chọn ngày đầu kỳ |
| Không quyền xem | khối trống "Chưa được cấp quyền…" + nói hỏi ai |
| Chỉ có quyền xem | ẩn nút chính; nút "Mở" vẫn có |
| Mất kết nối máy chủ | dải cảnh báo một dòng dưới đầu trang |
| Nhiều dữ liệu | danh sách ngày cuộn theo trang; thanh tiến độ không xuống dòng |

## 6. Chữ

- Tiêu đề ngày có thứ: `Thứ 7, 24/10/2026`. Số dùng kiểu chữ số đều (`tnum`).
- Con số dùng một mẫu duy nhất `n nhóm · m bản ghi` ở mục ngày, đầu khung chi tiết và tiêu đề nhóm.
- Thẻ trạng thái tối đa 3 từ: "2 trễ", "1 còn thiếu", "Quá hạn".
- Câu tiến độ: `Bước tiếp: <tên bước> — còn <tối đa 2 mục> và n mục khác`. Nếu phần "còn…" chỉ lặp lại tên bước thì bỏ. Xong hết thì `Đủ — xong bước 1–N`.
- Nút nào cũng có chú thích khi rê chuột, nói kết quả của việc bấm.

## 7. Component cần có

| Vùng | Component |
|---|---|
| Đầu trang | Tabs, Button |
| Thanh lọc | nhóm chọn (segmented), khung điều hướng kỳ ‹ › + "Nay", ô chọn khoảng ngày, ô chọn có tìm, ô tra |
| Thẻ số | lưới thẻ số (nhãn · số · dòng phụ · icon · màu) |
| Lịch | nút mục ngày (có trạng thái đang chọn), bảng tự đổi thẻ theo vùng chứa, thẻ trạng thái, thanh N khúc |
| Trạng thái | khung xương, khối trống |

## 8. Câu cần chốt khi áp dụng

1. Bản ghi lấy ngày nào để xếp? Có ngày dự phòng khi chưa có ngày chính không? Không có thì bỏ được mục "Chưa có ngày".
2. Gom theo nhóm gì trong một ngày? Một ngày thường có bao nhiêu nhóm? Chỉ 1 thì bỏ tầng nhóm, cho bảng phẳng.
3. Có quy trình nhiều bước để làm cột Tiến độ không? Không có thì thay bằng một thẻ trạng thái.
4. Có việc gốc chưa lên lịch không? Không có thì bỏ vùng 5.
5. Người dùng chính ở điện thoại hay máy tính? Quyết định có gộp 4 thẻ số không.
6. Chi tiết ngày ở laptop thường muốn dạng bảng hay dạng thẻ?

## 9. Phương án đã thử và bỏ

| Phương án | Vì sao bỏ |
|---|---|
| Gom theo nhóm, mỗi nhóm một bảng | Không trả lời được câu "ngày mai làm gì". |
| Lưới lịch 7 cột, hiện cả ngày trống | Nhiều ô trống. Điện thoại phải đổi hẳn sang hình khác. |
| Danh sách ngày thu / mở | Phải bấm mới thấy. Mở nhiều ngày thì mất cái nhìn cả kỳ, không rõ đang xem ngày nào. |
| Ngày chỉ có một bản ghi thì mở thẳng chi tiết | Hai cách cho hai trường hợp, người dùng phải đoán. |
