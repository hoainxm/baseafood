# Kịch bản trình bày — Chế độ demo (Baseafood MES)

> Dùng cho buổi trình bày "số chảy qua hệ thống". Thay cho `kich-ban-demo.md` / `kich-ban-demo-live.md` / `demo-seed.js` / `seed_bt2da*.sql` (đều **lỗi thời** — cái cuối từng là reset phá hủy, **cấm chạy lên DB thật**). Thiết kế: [`../spec/che-do-demo.md`](../spec/che-do-demo.md).

## 0. Chuẩn bị (5 phút, làm trước buổi)

1. Đăng nhập bằng tài khoản **admin** (chỉ admin thấy và bật được chế độ demo).
2. DB thật đã có site `site-demo` (migration [`0058_site_demo.sql`](../../supabase/migrations/0058_site_demo.sql), chạy 2026-10-13). Dựng DB mới thì phải chạy file này trước — thiếu nó số demo không lên được máy chủ (đèn kết nối đỏ), không hỏng gì.
3. Mở **Tổng quan** → khối **Chế độ demo**:
   - Trình bày cho người ngoài: giữ **"Ẩn tên + đổi giá"**. Nội bộ Baseafood: chọn **"Giữ tên thật"**.
   - Bấm **Tạo bộ demo mới** → xác nhận. App quét số thật, sinh 60 ngày đủ chuỗi, chuyển sang chế độ demo, hiện "Đã nạp bộ demo: … dòng".
4. Thấy **dải vàng "ĐANG XEM DỮ LIỆU DEMO"** ở đầu mọi màn và tiêu đề tab có "[DEMO]" là sẵn sàng.
5. Chuẩn bị riêng (không nằm trong bộ demo): 1 file Excel HĐĐT mẫu đã ẩn tên cho phần Đối soát, 1–2 ảnh phiếu nhập cho phần OCR.

Sau buổi: bấm **Làm mới bộ demo** (về nguyên trạng, ai bấm loạn cũng không sao) hoặc **Thoát demo**.

## 1. Mở đầu — Tổng quan (3 phút)

- **Thẻ số tô màu theo loại**: nhập (xanh dương) · sản xuất (tím) · kho (xanh ngọc) · bán (xanh lá). "Tháng này xưởng chạy thế nào" trong 5 giây.
- **Năm khâu của chuỗi**: kg qua từng khâu, % chuyển tiếp, số việc còn thiếu ở mỗi khâu. Bấm một khâu là mở đúng màn.
- **Nguyên liệu đi đâu**: "Cứ 100 kg nguyên liệu vào xưởng thì ra … kg bán thành phẩm" + phần phế liệu, còn dở, hao hụt. Thanh thứ hai: hàng trong kho đi đóng gói / xuất đơn / bán / còn tồn.
- **Việc cần đốc**: sổ sai đứng đầu (sổ nhập sửa sau khi chốt, bán vượt tồn, định mức lệch), rồi việc chưa làm (ngày chưa chốt, mẻ chưa gắn lô, hàng chờ duyệt lâu). Bấm **Mở** → tới đúng chỗ sửa.
- Câu chốt: *"Trước đây mấy việc này phải đi hỏi từng tổ. Giờ mở máy là thấy."*

## 2. Đi theo dòng chảy (10 phút)

| Bước | Màn | Cho xem | Thao tác trực tiếp |
|---|---|---|---|
| 1 | Nhập hàng `/imports` | Chuyến theo đại lý, chốt ngày, ghi bù có lý do | Ghi 1 chuyến 2 dòng → chốt ngày |
| 2 | Tồn kho NL `/nxt-nl` | Tồn đầu + nhập − bán nội địa | — |
| 3 | Sản xuất `/wip` | Sản lượng ngày theo xưởng, gắn lô NL, chốt ngày SX (bắt gắn lô hoặc lý do) | Ghi 1 mẻ, gắn lô vừa nhập |
| 4 | Kho dự trữ `/warehouse` | Duyệt chờ → đã nhập, **Hàng nằm kho bao lâu** | Duyệt mẻ đang chờ |
| 5 | Đóng gói `/packaging` | BTP vào → TP ra + hao hụt, gắn lô BTP | — |
| 6 | Đơn đặt `/orders` | Lệnh xuất FIFO, kiểm lô khi xếp xe | — |
| 7 | Bán hàng `/sales` | Phiếu bán, nguồn block thô / đóng gói, gắn lô | — |
| 8 | Mã lô QR `/qr` | Quét/gõ một lô: **Cân bằng khối lượng** + thanh "lô đi đâu", truy ngược tới đại lý, truy xuôi tới khách, Thu hồi | Tab **Theo giai đoạn**: 5 khâu, chỗ thiếu bấm làm ngay |
| 9 | Kiểm tra QC `/qc` | Chấm điểm ngày + **30 ngày gần đây** | — |

## 3. Ra tiền (5 phút) — Cân đối kỳ `/balancing`

- Mở kỳ mới nhất: lưới theo ngày, định mức = NL ÷ TP, lãi/lỗ = giá trị xuất − giá thành.
- Ô **Ghi chú → "Lãi/lỗ đến từ đâu"**: tiền bán được vs tiền bỏ ra, tiền bỏ ra chia nguyên liệu / chế biến.
- So các kỳ ở Tổng quan → **Kết quả các kỳ cân đối** (có kỳ lãi, có kỳ lỗ).
- Câu chốt: *"Tổ trưởng chỉ ghi kg và giá. Định mức, giá thành, lãi lỗ là máy tính."*

## 4. Kế toán (tùy thời gian)

- Sổ kho tháng `/ton-kho-thang`, Nhập xuất tồn kho `/nxt-kho`, Báo cáo thành phẩm / đơn xuất (Excel, in A4).
- Đối soát HĐĐT `/doi-soat`: nạp file mẫu đã chuẩn bị → 4 kiểu đối soát → xuất Excel giữ định dạng.
- Tô màu dòng "đã dò" trên mọi bảng.

## Lưu ý khi trình bày

- Mọi thứ ghi trong buổi chỉ vào bộ demo. Số thật của xưởng không đổi.
- Người không phải admin đăng nhập trên máy đang demo ⇒ app tự thoát demo.
- Màn **Người dùng** bị khóa khi đang demo (tài khoản là thật).
