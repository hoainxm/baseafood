# Cách đọc file Excel "Bảng cân đối bạch tuộc 2 da" → dữ liệu hệ thống

> Dùng khi seed / đối chiếu demo. File Excel là **sổ giấy 1 kỳ** (bạch tuộc 2 da, **21–25/07/2025**, gộp NL của 6 đại lý: Bê 3, Hồng Phú, H Mũng, Pháp M Né, Hưng V Tàu, Mậu H Tân). Sheet `Loai hang` chia **4 khối theo cột**.

## Sơ đồ cột → khối

| Cột | Khối | Nội dung | Vào field hệ thống |
|---|---|---|---|
| 1–5 | **① Nguyên liệu vào** | Loại hàng · Số lượng (kg) · Đơn giá VNĐ · T.tiền · tỷ lệ % | `balancing_inputs` (Khối 1) |
| 6–10 | **② Bán thành phẩm xuất** | Mặt hàng · Khách · **Lượng (kg)** · Đơn giá USD · T.tiền USD | `balancing_outputs` (Khối 3) |
| 11–12 | **③ Ghi chú = kết quả tính** | Tổng TP · Định mức · Chi phí CB/kg · Giá thành · Giá trị xuất · Lãi/Lỗ · Bình quân/kg NL · tỉ giá | Hệ **TỰ TÍNH**, không nhập |
| 13, 15–22, 23 | **④ BTP theo ngày** | Tên · **cột 22/07 → 29/07** (từng ngày) · Tổng | Chi tiết theo dõi — **KHÔNG** dùng cho tổng cân đối |

## ① Nguyên liệu vào (cột 1–5) → Khối 1
- Mỗi dòng = 1 loại NL: `Số lượng` (kg) × `Đơn giá` (VNĐ) = `T.tiền`.
- Nhóm suy từ tên: `x.đ …` → **Xả đông**; `Bột …` → **Bột phụ gia**; còn lại → **Thủy sản**.
- **Số lượng ÂM** = điều chỉnh giảm (VD `Bán nội địa −987`) — trừ khỏi pool NL. Hệ thống cho phép nhập kg âm ở Khối 1.
- Tổng khối (dòng T.CỘNG): **63.926 kg · 9.141.120.122 đ**.

## ② Bán thành phẩm xuất (cột 6–10) → Khối 3
- Mỗi dòng = 1 mặt hàng + 1 khách: cột **"Lượng" (cột 8)** = **tổng cả kỳ** của mặt hàng đó; `Đơn giá` USD; kênh **Xuất khẩu**.
- ⭐ **Lượng lấy từ CỘT "Lượng" (cột 8), KHÔNG lấy tổng cột ngày.** (đã xác nhận với chủ dữ liệu 14/08/2026)
- Tổng khối: **43.144 kg · 410.684 USD**.
- 📐 **Quy tắc gộp từ báo cáo BTP ngày → mặt hàng cân đối** (tẩm bột = râu+bao tử+cổ theo grade; luộc/chần theo công đoạn+size; bột tẩm → Khối 1; bỏ ghẹ gửi): xem [`31-can-doi-ky.md` § Gộp bán thành phẩm](../app-map/31-can-doi-ky.md). Chốt với kế toán 21/08/2026.

## ④ Cột ngày 22/07 → 29/07 (cột 15–22) — chỉ là chi tiết
- Đây là ô ghi tay **bán thành phẩm theo từng ngày** (khối bên phải, danh sách theo cột 13, tách khỏi khối ②).
- ⚠️ **Không khớp** với cột "Lượng": tổng các cột ngày = **40.797 kg**, cột "Tổng" (cột 23) = **42.035 kg**, còn cột "Lượng" = **43.144 kg**. Vài dòng cột "Tổng" ≠ tổng ô ngày (VD *2 da cắt chần 700-750*: Tổng 7.521 nhưng cộng ngày 9.521; *tẩm bột nước tương*: Tổng 2.000, ô ngày trống). ⇒ khối ngày là **vùng ghi tay chưa chốt/thiếu**.
- **Kết luận:** cân đối **luôn lấy cột "Lượng" (43.144)** — khớp Lãi giấy 242.346.218. Cột ngày chỉ để tham khảo tiến độ sản xuất theo ngày; **không đưa vào công thức**.
- Kỳ vẫn là **21–25/07 (5 ngày)** như tiêu đề, dù cột ngày chạy tới 29/07 (phần dư của vùng nháp) — **không** đổi khoảng ngày kỳ theo cột ngày.

## ③ Công thức hệ tự tính (khớp `lib/balancingCalc.ts`, đối chiếu số giấy 100%)
| Chỉ tiêu | Công thức | Số giấy |
|---|---|---|
| Định mức | Tổng NL ÷ Tổng TP = 63.926 ÷ 43.144 | 1,48 |
| Giá trị NL | Σ(kg × đơn giá NL) | 9.141.120.122 |
| Giá thành | Giá trị NL + Tổng TP × (Chi phí CB/kg 30.000) | 10.435.440.122 |
| Giá trị xuất | Σ(kg × đơn giá USD) × tỉ giá 26.000 | 10.677.786.340 |
| **Lãi** | Giá trị xuất − Giá thành | **242.346.218** |
| Bình quân/kg NL | Lãi ÷ Tổng NL | 3.791 |

*(Seed demo ra Lãi 242.338.529 — lệch 7.700đ do làm tròn đơn giá NL về số nguyên; nhập đủ số lẻ là khớp tuyệt đối.)*
