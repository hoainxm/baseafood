# Tài liệu nghiệp vụ & flow — Baseafood MES

Bộ tài liệu phân tích + thiết kế flow cho hệ thống này (chuyển từ repo SDFactory sang để repo tự chứa ngữ cảnh). Đọc theo thứ tự để hiểu flow làm việc:

| # | Tài liệu | Nội dung |
|---|---|---|
| 1 | [ke-hoach-tuan-1-thu-thap-du-lieu.md](ke-hoach-tuan-1-thu-thap-du-lieu.md) | Phân tích hiện trạng: tổ chức, dữ liệu (KiotViet, báo cáo NL-BTP làm tay, sổ nhập NL hàng ngày), nghiệp vụ tồn kho + sản xuất, 3 phân xưởng, vòng lặp gối đầu |
| 2 | [bang-cau-hoi-xac-nhan-truoc-plan.md](bang-cau-hoi-xac-nhan-truoc-plan.md) | 28 câu hỏi + **kết quả xác nhận** với người dùng (định nghĩa hành vi: kỳ theo lô, định mức = NL÷TP, đơn giá nhập tay, mặt hàng danh mục mở…) |
| 3 | [plan-flow-can-doi-5-ngay.md](plan-flow-can-doi-5-ngay.md) | **Thiết kế flow cân đối 5 ngày** (xưởng Đông): mô hình dữ liệu, công thức, màn hình — đã code trong `src/features/balancing/BalancingScreen.tsx` + `BangBalancingScreen.tsx` |
| — | [diem-can-xac-nhan-theo-buoi.md](diem-can-xac-nhan-theo-buoi.md) · [can-xac-nhan-dot-tiep.md](can-xac-nhan-dot-tiep.md) | Sổ theo dõi điểm cần xác nhận theo buổi / đợt tiếp |

**Còn treo** (chưa chốt, không chặn code hiện tại): quy tắc chia nguyên liệu cho từng bảng cân đối; tên gọi + định nghĩa chính xác chỉ số ~0,45 (tỉ lệ thu hồi / tổng nhận).

Bản trình BGĐ (SDVICO-PLAN-01) và các tài liệu pitch/consulting của SDVICO vẫn ở repo SDFactory `docs/trien-khai/`.
