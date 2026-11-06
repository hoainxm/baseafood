# Mẫu giao diện: Lịch theo ngày hai cột

Dùng cho trang cần trả lời câu hỏi **"ngày nào có việc gì"** trong một khoảng thời gian.

## Khung

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Tab của module                              [Nút chính]   │
├──────────────────────────────────────────────────────────────┤
│ 2. Bộ lọc: Kỳ [Tháng|Tuần|Ngày] ‹ kỳ › · Nhóm · Tra cứu      │
├──────────────────────────────────────────────────────────────┤
│ 3. [Thẻ số] [Thẻ số] [Thẻ số] [Thẻ số]                       │
├───────────────────┬──────────────────────────────────────────┤
│ 4a. Danh sách ngày│ 4b. Chi tiết ngày đang chọn              │
│ ┌───────────────┐ │ Tiêu đề ngày · tóm tắt                   │
│ │ Ngày 1        │ │ Nhóm A                                   │
│ │ tóm tắt  [!]  │ │  └ bảng bản ghi             [Mở]         │
│ └───────────────┘ │ Nhóm B                                   │
│ ┏━━━━━━━━━━━━━━━┓ │  └ bảng bản ghi             [Mở]         │
│ ┃ Ngày 2 (chọn) ┃ │                                          │
│ ┗━━━━━━━━━━━━━━━┛ │                                          │
│ Chưa có ngày      │                                          │
├───────────────────┴──────────────────────────────────────────┤
│ 5. Khối ngoại lệ (chỉ hiện khi có)                           │
└──────────────────────────────────────────────────────────────┘
```

Thứ tự đi từ tổng tới chi tiết: lọc → xem số tổng → chọn ngày → xem bản ghi → việc nằm ngoài lịch.

## Luật từng vùng

**1. Đầu trang.** Tab bên trái, đúng một nút chính bên phải, dùng chung cho mọi tab.

**2. Bộ lọc.**
- Một hàng, tự xuống dòng khi hẹp, để lịch hiện ngay trong màn đầu.
- Nhãn luôn hiện trên mỗi ô.
- Chọn kỳ: nhóm nút Tháng / Tuần / Ngày, rồi khung `‹ kỳ ›`. Nút "Nay" chỉ hiện khi đang xem kỳ khác. Chọn "Ngày" thì đổi khung thành ô chọn khoảng ngày.
- Có chữ trong ô tra cứu thì vùng 3–5 được thay bằng bảng kết quả.

**3. Thẻ số.**
- 3–4 thẻ, cùng khuôn: nhãn · số · dòng phụ nói điều kiện của con số.
- Thẻ cảnh báo chỉ đổi màu khi số lớn hơn 0.
- Thẻ số đi theo mọi bộ lọc.

**4a. Danh sách ngày** (cột trái, rộng cố định khoảng 13–17rem).
- Chỉ hiện ngày có việc, xếp tăng dần.
- Mỗi mục có 3 dòng: tiêu đề ngày kèm thẻ cảnh báo · số đếm · tên các nhóm (chữ nhạt, một dòng).
- Mục đang chọn có viền đậm và nền nhấn.
- Mục "Chưa có ngày" luôn ở cuối danh sách.
- Không thu / mở. Bấm một mục là đổi phần chi tiết.

**4b. Chi tiết** (cột phải, khung có viền).
- Dòng đầu: tiêu đề ngày + tóm tắt số.
- Mỗi nhóm có một tiêu đề nhỏ và một bảng riêng.
- Cột của bảng:
  - **Tên**: 2 dòng, dòng chính đậm, dòng phụ nhạt.
  - **Ngày**
  - **Số lượng**
  - **Tiến độ**: thanh nhiều khúc + câu "Bước tiếp: …" + thẻ cảnh báo.
  - Một nút **Mở**.
- Mọi thao tác ghi làm ở màn chi tiết của bản ghi, không làm trên trang lịch.

**5. Khối ngoại lệ.** Bảng ngắn cho việc chưa xếp được vào ngày nào. Đặt dưới lịch.

## Hành vi

- Luôn có đúng một ngày đang chọn. Mặc định là ngày có việc gần nhất kể từ hôm nay. Đổi kỳ hoặc bộ lọc thì chọn lại theo luật này.
- Tổng của mọi ngày cộng mục "Chưa có ngày" phải bằng thẻ số tổng.
- Kỳ đang xem ghi lên URL để gửi link được.

## Khổ màn

| Khổ | Cách hiện |
|---|---|
| Máy tính, máy tính bảng ngang | hai cột |
| Điện thoại, máy tính bảng dọc | một cột: danh sách ngày → chạm vào ngày → chi tiết, có nút "‹ Quay lại" |

- Bảng chi tiết đổi sang dạng thẻ khi **khung** của nó hẹp, không phải khi màn hẹp. Ở laptop còn thanh bên, cột phải thường đã hẹp tới mức hiện dạng thẻ. Nên chọn trước muốn bảng hay thẻ.
- Trên điện thoại, nếu thẻ số đẩy danh sách ngày xuống quá sâu thì gộp các thẻ thành một dòng tóm tắt.

## Trạng thái

| Trạng thái | Hiện gì |
|---|---|
| Đang tải | khung xương |
| Kỳ trống | thẻ số = 0 + một câu nói cần làm gì để có dữ liệu |
| Chỉ có việc chưa có ngày | tự chọn mục "Chưa có ngày" |
| Chỉ có quyền xem | ẩn nút chính, nút "Mở" vẫn còn |

## Đã thử và bỏ

| Phương án | Vì sao bỏ |
|---|---|
| Gom theo nhóm thay vì theo ngày | không trả lời được câu "ngày mai làm gì" |
| Lưới lịch 7 cột | nhiều ô trống, điện thoại phải đổi hẳn sang hình khác |
| Danh sách ngày thu / mở | phải bấm mới thấy, mở nhiều ngày thì mất cái nhìn cả kỳ |
