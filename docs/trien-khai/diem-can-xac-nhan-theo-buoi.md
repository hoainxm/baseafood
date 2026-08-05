# Sổ theo dõi điểm cần xác nhận — Baseafood BSF1

> Danh sách các nội dung cần xác nhận với xí nghiệp, tổ chức theo từng buổi làm việc. Mỗi buổi ghi rõ điểm phát sinh, mục đích, và kết quả xác nhận. Cập nhật dần sau mỗi buổi.

| | |
|---|---|
| Mã | SDVICO-CONFIRM-01 · v1 (2026-08-04) |
| Liên quan | Kế hoạch Tuần 1 [ke-hoach-tuan-1-thu-thap-du-lieu.md](ke-hoach-tuan-1-thu-thap-du-lieu.md) · Hệ thống `C:\Users\ACER\baseafood-mes` |
| Quy ước | ⏳ chờ xác nhận · ✅ đã rõ (ghi kết quả bên cạnh) |

---

## Buổi 1 — Sáng nay (04/08), làm việc với chị Dung, nhận 3 file dữ liệu

Nguồn: buổi trao đổi + phân tích 3 file (danh mục thành phẩm, báo cáo NL–BTP tháng, sổ nhập NL hàng ngày).

| # | Nội dung cần xác nhận | Phục vụ việc | Trạng thái |
|---|---|---|---|
| 1 | **Đại lý** (đầu vào nguyên liệu) và **khách hàng** (đầu ra thành phẩm) là hai danh mục tách riêng hay có trùng | Thiết kế danh mục đối tác | ⏳ |
| 2 | Tài xế/xe **cố định theo đại lý** hay thay đổi **theo từng lượt giao** | Mô hình dữ liệu lượt nhập | ⏳ |
| 3 | "Tên người" trong ghi chú sổ nhập là **tài xế** hay **chủ vựa/người bán** | Đặt đúng tên trường | ⏳ |
| 4 | Biển số xe có **bắt buộc** cho truy xuất nguồn gốc (IUU/MSC) không | Quyết định trường optional/required | ⏳ |
| 5 | Bán thành phẩm đông đóng theo **lốc/khối, khối lượng không cố định** — cách cân và ghi khối lượng thực | Đơn vị + cách nhập liệu | ⏳ |
| 6 | Nghĩa các mã nguyên liệu viết tắt trong sổ ("2DA NL 80T", "80j", "100 NL", "R2C") và cách quy về danh mục chuẩn | Chuẩn hóa danh mục nguyên liệu | ⏳ |
| 7 | Đơn giá quy về cuối tháng — xác nhận không cập nhật theo ngày; cơ chế chốt giá | Xử lý đơn giá | ⏳ |
| 8 | Phân công nhập số liệu thực tế (được biết: Trúc nhập máy, Thủy ghi tay) | Xác định người dùng và luồng nhập | ⏳ |
| 9 | **Định mức nguyên liệu → thành phẩm** (tỷ lệ thu hồi) có bảng ở đâu không, hay chỉ theo kinh nghiệm người làm | Mắt xích tính tồn cuối kỳ | ⏳ |
| 10 | Khối "tồn nguyên liệu phân xưởng" và "hàng xả đông" trong file tháng đang để trống — có theo dõi ở nơi khác không | Xác định chỗ số liệu thất lạc | ⏳ |
| 11 | Phân xưởng **Khô** báo cáo riêng ở đâu, ai giữ (file tháng mới có xưởng Đông và Cá) | Thu đủ 3 phân xưởng | ⏳ |

---

## Buổi 2 (dự kiến) — Khâu tiếp nhận nguyên liệu

| # | Nội dung cần xác nhận | Phục vụ việc | Trạng thái |
|---|---|---|---|
| 1 | Quy trình xe về → cân → ghi sổ: cân ở đâu, ai cân, ai ghi | Dựng luồng tiếp nhận | ⏳ |
| 2 | Ghi chú tài xế/biển số điền vào lúc nào, ai điền | Xác nhận điểm 2–3 buổi 1 | ⏳ |
| 3 | Phân biệt nguồn từ **cảng** và từ **khách hàng**; hồ sơ nguồn gốc đi kèm mỗi nguồn | Truy xuất nguồn gốc | ⏳ |
| 4 | Một lượt giao của đại lý có nhiều loại nguyên liệu — ghi gộp hay tách dòng | Cấu trúc "lượt giao" | ⏳ |

---

## Buổi 3 (dự kiến) — Sơ chế và cấp đông

| # | Nội dung cần xác nhận | Phục vụ việc | Trạng thái |
|---|---|---|---|
| 1 | Cách đóng lốc/khối và ghi khối lượng thực khi cấp đông | Đơn vị bán thành phẩm | ⏳ |
| 2 | Điểm ghi chép khi chuyển thành bán thành phẩm | Dựng luồng sản xuất | ⏳ |
| 3 | Hao hụt / tỷ lệ thu hồi đo ở công đoạn nào, ai đo | Định mức thực tế | ⏳ |

---

## Buổi 4 (dự kiến) — Kho và vòng lặp gối đầu

| # | Nội dung cần xác nhận | Phục vụ việc | Trạng thái |
|---|---|---|---|
| 1 | Ba tầng kho (2 kho lớn xí nghiệp · kho nhỏ xưởng · kho thuê ngoài) và thủ kho từng kho | Mô hình kho | ⏳ |
| 2 | Hàng "đông gửi" nằm ở kho nào, đối chiếu số lượng với thẻ kho | Nối khối đông gửi với kho | ⏳ |
| 3 | "Hàng xả đông" ghi ở đâu, cơ chế lấy hàng đông kỳ trước ra dùng | Số hóa vòng lặp gối đầu | ⏳ |
| 4 | Kho thuê ngoài theo dõi thế nào khi kho lớn đầy | Quản lý gửi kho | ⏳ |

---

## Buổi 5 (dự kiến) — Tổ chức và nhân sự (mức nhẹ, phân quyền tạm hoãn)

| # | Nội dung cần xác nhận | Phục vụ việc | Trạng thái |
|---|---|---|---|
| 1 | Bộ phận nhân sự/hành chính thuộc khối nào | Sơ đồ tổ chức | ⏳ |
| 2 | Tên và liên lạc đầu mối 5 khối (Kế hoạch, Thu mua, Kĩ thuật, Kế toán, Điện lạnh) | Đầu mối phối hợp | ⏳ |

---

## History
- v1 (2026-08-04): tạo mới — gom các điểm cần xác nhận theo buổi; buổi 1 (sáng nay, với chị Dung + 3 file) gồm 11 điểm; các buổi khảo sát tiếp theo kèm điểm cần xác nhận theo khâu.

**Last updated**: 2026-08-04
