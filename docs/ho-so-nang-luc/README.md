# Hồ sơ năng lực — quy trình & biểu mẫu công ty đang áp dụng

> **Load khi:** xây hoặc sửa chức năng thay cho một quy trình giấy của xí nghiệp; cần biết "công ty quy định làm thế nào", ai duyệt, biểu mẫu nào, lưu bao lâu.
> **last_verified:** 2026-10-19

Thư mục này chép lại **quy trình chính thức** (hệ thống tài liệu BRC 9 / Halal / Sổ tay chất lượng của Baseafood BSF1) thành văn bản đọc được, kèm **quy tắc rút ra** và **ánh xạ vào phần mềm**. Mỗi quy trình một file, tên theo mã tài liệu của công ty.

Khác với các thư mục khác:

| Thư mục | Trả lời câu |
|---|---|
| `ho-so-nang-luc/` | **Công ty quy định** làm việc này thế nào (bản gốc của xí nghiệp) |
| [`trien-khai/`](../trien-khai/README.md) | SDVICO phân tích, họp, chốt với người dùng như thế nào |
| [`spec/`](../spec/) | Phần mềm sẽ làm ra sao (trước khi build) |
| [`app-map/`](../app-map/README.md) | Code đang chạy thế nào (khi sửa code) |

## Danh mục quy trình

| Mã | Tên | Phòng | Hiệu lực | Chuẩn | Trạng thái số hóa | File |
|---|---|---|---|---|---|---|
| **QTI-KH-01** | Quản lý đơn hàng | Kế hoạch | 02/01/2023 (lần 01) | BRC 9 · Halal | 🟨 Một phần (đơn đặt, lệnh xuất, kiểm lô) — module Phòng KH đang lập kế hoạch. Đã nạp sẵn vào `/documents` (mig 0072, chưa có file PDF) | [qti-kh-01-quan-ly-don-hang.md](qti-kh-01-quan-ly-don-hang.md) |

## Danh mục biểu mẫu

| Mã | Biểu mẫu | Thuộc quy trình | Lưu | Đã có mẫu trống? | Trên phần mềm |
|---|---|---|---|---|---|
| QTI-KH-01-01 | Sổ thông tin khách hàng | QTI-KH-01 | 2 năm | ☐ | chưa |
| QTI-KH-01-02 | Offer sheet | QTI-KH-01 | 2 năm | ☐ | chưa |
| QTI-KH-01-03 | HĐKT hoặc L/C | QTI-KH-01 | 2 năm | ☐ | chưa |
| QTI-KH-01-04 | Lệnh sản xuất | QTI-KH-01 | 2 năm | ☐ | chưa |
| QTI-KH-01-05 | Sổ kho (tồn kho hằng ngày) | QTI-KH-01 | 2 năm | ☐ | một phần (Kho dự trữ, Sổ kho tháng) |
| QTI-KH-01-06 | Giấy đề nghị xuất hàng | QTI-KH-01 | 2 năm | ☐ | chưa |
| QTI-KH-01-07 | Lệnh xuất hàng | QTI-KH-01 | 2 năm | ☐ | có, nhưng chưa có bước duyệt |
| QTI-KH-01-08 | Giấy báo list thực tế | QTI-KH-01 | 2 năm | ☐ | một phần (dòng lệnh xuất + kiểm lô) |

## Thêm một quy trình mới

1. Tên file = mã tài liệu viết thường + tên ngắn, kebab-case không dấu: `qti-<phòng>-<số>-<ten-ngan>.md`.
2. Mỗi file đủ 6 mục: **thông tin tài liệu** (mã, lần ban hành, hiệu lực, người soạn/xem xét/duyệt, lịch sử) · **các bước** · **biểu mẫu** · **quy tắc rút ra** (mã `<PHÒNG>-R<n>`, dùng làm luật cho phần mềm) · **ánh xạ vào phần mềm** (đã có / lệch / thiếu) · **câu cần xác nhận**.
3. Chép **đúng ý** bản gốc, không thêm ý của SDVICO vào phần quy trình. Nhận xét, đề xuất để ở mục ánh xạ hoặc ở `spec/`.
4. Thêm một dòng vào hai bảng danh mục trên.
5. Bản PDF/Word gốc **không** đưa vào repo: lưu ở trang **Tài liệu công ty** (`/documents`, bucket `documents` — [`app-map/40-documents`](../app-map/40-documents.md)), mỗi lần ban hành một bản. Doc ở đây chỉ ghi tên file nguồn, ngày nhận và luật rút ra cho code.
