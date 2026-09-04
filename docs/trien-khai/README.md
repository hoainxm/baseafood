# Tài liệu nghiệp vụ & flow — Baseafood MES

Bộ tài liệu phân tích + thiết kế flow cho hệ thống này (chuyển từ repo SDFactory sang để repo tự chứa ngữ cảnh). Đọc theo thứ tự để hiểu flow làm việc:

### Mới nhất — buổi họp 2026-09-02 (form nhập + OCR · lô/QR · giá · QC · nhân sự), nối tiếp 2026-08-22

| # | Tài liệu | Nội dung |
|---|---|---|
| ★ | [hop-2026-09-02-form-nhap-trace-gia-qc.md](hop-2026-09-02-form-nhap-trace-gia-qc.md) | **Biên bản họp + 12 quyết định** — form nhập chuẩn + chụp ảnh/OCR, định danh lô/QR, giá & bình quân gia quyền, QC chấm điểm, khung nhân sự · **cửa vào mới nhất** |
| ★ | [hop-2026-08-22-so-hoa-flow-2-bo-phan.md](hop-2026-08-22-so-hoa-flow-2-bo-phan.md) | **Biên bản họp + 8 quyết định** — số hóa trọn chuỗi + tách 2 giao diện bộ phận + cutover 01/09 |
| ★ | [flow-end-to-end-2-bo-phan.md](flow-end-to-end-2-bo-phan.md) | Chuỗi nhập→sản xuất→kho→bán→cân đối, chỗ đứt gãy, 2 giao diện bộ phận, daily-task, bảng thuật ngữ ("second step", ghi bù, phát hành) |
| ★ | [ke-hoach-cutover-1-9-2026.md](ke-hoach-cutover-1-9-2026.md) | Baseline tồn 30/06, nhập báo cáo T7–T8, realtime 01/09, lộ trình import file/scan |
| ★ | [../spec/bo-quy-cach-che-bien-thanh-pham.md](../spec/bo-quy-cach-che-bien-thanh-pham.md) | Cấu trúc dữ liệu quy cách × kiểu chế biến × nguyên liệu (spec) |

### Nghiệp vụ gốc & phân tích hiện trạng

| # | Tài liệu | Nội dung |
|---|---|---|
| 1 | [ke-hoach-tuan-1-thu-thap-du-lieu.md](ke-hoach-tuan-1-thu-thap-du-lieu.md) | Phân tích hiện trạng: tổ chức, dữ liệu (KiotViet, báo cáo NL-BTP làm tay, sổ nhập NL hàng ngày), nghiệp vụ tồn kho + sản xuất, 3 phân xưởng, vòng lặp gối đầu |
| 2 | [bang-cau-hoi-xac-nhan-truoc-plan.md](bang-cau-hoi-xac-nhan-truoc-plan.md) | 28 câu hỏi + **kết quả xác nhận** với người dùng (định nghĩa hành vi: kỳ theo lô, định mức = NL÷TP, đơn giá nhập tay, mặt hàng danh mục mở…) |
| 3 | [plan-flow-can-doi-5-ngay.md](plan-flow-can-doi-5-ngay.md) | **Thiết kế flow cân đối 5 ngày** (xưởng Đông): mô hình dữ liệu, công thức, màn hình — đã code trong `src/features/balancing/BalancingScreen.tsx` + `BalancingTable.tsx` |
| 4 | [plan-ton-kho-ban-thanh-pham.md](plan-ton-kho-ban-thanh-pham.md) | Ghi chú tiền-spec tồn kho BTP/WIP (phân biệt BTP còn khuôn đá ≠ thành phẩm đóng gói) — đã lên spec ở [`app-map/34`](../app-map/34-btp-san-xuat-kho.ba-spec.md) |
| — | [diem-can-xac-nhan-theo-buoi.md](diem-can-xac-nhan-theo-buoi.md) · [can-xac-nhan-dot-tiep.md](can-xac-nhan-dot-tiep.md) | Sổ theo dõi điểm cần xác nhận theo buổi / đợt tiếp |

**Còn treo** (chưa chốt, không chặn code hiện tại): quy tắc chia nguyên liệu cho từng bảng cân đối; tên gọi + định nghĩa chính xác chỉ số ~0,45 (tỉ lệ thu hồi / tổng nhận); định dạng báo cáo tồn 30/06 + mẫu báo cáo T7–T8 (xem [cutover §6](ke-hoach-cutover-1-9-2026.md)).

Bản trình BGĐ (SDVICO-PLAN-01) và các tài liệu pitch/consulting của SDVICO vẫn ở repo SDFactory `docs/trien-khai/`.
