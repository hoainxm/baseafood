# Plan flow — Báo cáo cân đối 5 ngày (xưởng Đông)

> Bản thiết kế flow để duyệt **mức độ hiểu + chi tiết** trước khi code. Nguồn: mẫu "Loại hàng.pdf" + bảng câu hỏi đã xác nhận [bang-cau-hoi-xac-nhan-truoc-plan.md](bang-cau-hoi-xac-nhan-truoc-plan.md). Hệ thống: `C:\Users\ACER\baseafood-mes`.

| | |
|---|---|
| Mã | SDVICO-FLOW-CD5-01 · v1 (2026-08-04) |
| Trạng thái | **Chờ duyệt** — chưa code |

---

## 1. Mục tiêu

Từ số liệu **nhập nguyên liệu hàng ngày** và **thành phẩm sản xuất**, hệ thống tự dựng **bảng cân đối** cho mỗi lô nguyên liệu theo kỳ 5 ngày, tính ra **định mức chế biến** và **lãi/lỗ**, xuất đúng khuôn mẫu "Loại hàng.pdf". Thay việc cộng tay hiện nay.

## 2. Phạm vi

- **Áp dụng: xưởng Đông** (làm cân đối theo 5 ngày). Xưởng Cá và Khô làm theo tháng — **ngoài flow này**.
- **Một bảng cho mỗi loại nguyên liệu** (VD bạch tuộc 2 da, 1 da, mực…).
- Gồm cả **bán nội địa (VND)** và **xuất khẩu (USD)** trong một bảng, quy đổi qua tỉ giá.

## 3. Cách hiểu — mô hình cốt lõi

**Đơn vị cân đối = một lô nguyên liệu, theo loại, theo kỳ tiếp nhận.**

- Kỳ = **tập các ngày tiếp nhận nguyên liệu của một lô** — ngày **rời rạc**, không nhất thiết liên tục (VD mực ống khay: 19-22-23-24-26-27-29/07). Là ngày *nhận NL*, không phải ngày ra thành phẩm.
- **Thành phẩm làm ra từ lô đó có thể trễ hơn kỳ** → nhập thành phẩm gắn theo **lô**, hệ thống cho nhập tiếp cả khi kỳ nhận NL đã đóng.
- **Nguyên liệu được phân bổ cho từng bảng**: tổng NL nhận trong kỳ (bảng phụ theo ngày) có thể lớn hơn phần đưa vào một bảng cân đối — phần còn lại sang mặt hàng/bảng khác. *(Chờ anh xác nhận — mẫu mực: bảng phụ 6.291 vs tổng NL bảng 3.106.)*
- Cân đối = so **nguyên liệu vào** (kg, VND) với **thành phẩm ra** (kg, bán USD/VND) của cùng lô → ra định mức và lãi/lỗ.

## 4. Cấu trúc bảng cân đối (ánh xạ với mẫu PDF)

| Khối | Nội dung | Đơn vị |
|---|---|---|
| **1. Nguyên liệu vào** | Thủy sản NL theo size (2 da nl lớn/nhỏ, 1 da…) · **bột phụ gia tẩm** (có cột tỷ lệ % trong TP) · **bán nội địa** (gồm dòng số âm = SL bán nội địa) | kg · VND |
| **2. Phế liệu** *(mới)* | Nội tạng, dạt (hàng thải) — bán giá riêng | kg · VND |
| **3. Thành phẩm — xuất khẩu / nội địa** | Mỗi **mặt hàng → khách hàng**: lượng (TP sản xuất ra) · đơn giá · thành tiền. Cùng mặt hàng có thể **nhiều dòng giá** theo chất lượng | kg · USD/VND |
| **4. Ghi chú (tính toán)** | Tổng TP · định mức chế biến · chi phí CB/kg · giá thành · giá trị xuất · **lãi/lỗ** · bình quân/kg NL · tỉ giá | — |

## 5. Mô hình dữ liệu

**Danh mục (dùng chung):**
- `MatHangCanDoi`: mã · tên · quy cách · **ánh xạ mã thành phẩm 141** (nếu có). **Danh mục mở — người dùng thêm mặt hàng mới ngay tại chỗ khi thiếu** (đặc thù chế biến phát sinh nhiều kiểu). Không cần seed đủ trước.
- `KhachHang`: mã · tên · thị trường. *(Tách riêng đại lý — Q17.)*

**Kỳ cân đối:**
- `KyCanDoi`: id · loạiNL (VD "Bạch tuộc 2 da") · phânXưởng=Đông · từNgày · đếnNgày · **tỉGiá** · **chiPhíCB/kgTP** · trạngThái (mở/khóa).

**Các dòng trong kỳ:**
- `DòngNLVào`: kỳId · nhóm (thủy-sản-NL / **xả-đông** / bột-phụ-gia / bán-nội-địa) · tên · **soLượngKg** · **đơnGiáVND** · tỷLệ% (cho bột) · thànhTiền(computed). **Số dòng linh hoạt theo loại** — mực chỉ có N liệu + xả đông; bạch tuộc thêm bột + bán nội địa.
- `DòngPhếLiệu`: kỳId · loại (nội tạng / dạt) · soLượngKg · đơnGiáBán · thànhTiền.
- `DòngTPXuất`: kỳId · matHàngId · kháchId · **kênh** (xuất khẩu USD / nội địa VND) · **lượngKg** · **đơnGiá** · thànhTiền. *(Bán nội địa = kênh nội địa, đơn giá VND.)*

**Giá trị tính ra (computed, không lưu):**
- tổngNL, tổngTP, **địnhMức = tổngNL ÷ tổngTP**, giáTrịNL, giáTrịXuấtVND, giáThành, **lãi/lỗ**, bìnhQuân/kgNL.

## 6. Công thức tính (đã chốt Q13–16)

```
Định mức chế biến   = Tổng nguyên liệu (kg) ÷ Tổng thành phẩm (kg)
Giá trị nguyên liệu = Σ (SL NL × đơn giá VND)            [khối 1]
Giá trị xuất (VND)  = Σ (lượng TP × đơn giá USD) × tỉ giá  [khối 3, quy VND]
Giá thành           = (Tổng TP × chi phí CB/kg) + Giá trị nguyên liệu
Lãi/Lỗ              = Giá trị xuất − Giá thành
```
- Chi phí CB/kg, tỉ giá (26.000 VND/USD), đơn giá NL, đơn giá USD: **nhập tay mỗi kỳ**.
- **Bổ sung (thiếu trong mẫu):** chỉ số ≈ **0,45** = Tổng TP ÷ **Tổng NL nhận** (bảng phụ theo ngày, VD 2.856 ÷ 6.291). Khác định mức 1,09 (tính trên NL đưa vào bảng). *(Chờ xác nhận tên gọi + định nghĩa chính xác.)*

## 7. Nguồn dữ liệu

| Dữ liệu | Nguồn |
|---|---|
| Bảng phụ NL nhận theo ngày (tham chiếu) | Gợi ý từ màn Nhập nguyên liệu hàng ngày (đã build), lọc theo loại + các ngày của kỳ |
| Khối NL vào của bảng (N liệu · xả đông · bột · bán nội địa) | **Nhập/phân bổ tay theo bảng** — vì NL nhận được chia cho nhiều mặt hàng/bảng, không đổ trọn vào một bảng |
| Thành phẩm (mặt hàng × khách × lượng) | Nhập tay theo lô *(sau này nối màn nhập thành phẩm hàng ngày khi có)* |
| Chi phí CB · tỉ giá · đơn giá NL/USD | Nhập tay mỗi kỳ |

## 8. Màn hình cần build (thứ tự)

1. **Danh mục mặt hàng cân đối** + ánh xạ mã 141 (bổ sung quy cách thiếu).
2. **Danh mục khách hàng** (tách đại lý).
3. **Màn Kỳ cân đối** — tạo kỳ (loại NL + khoảng ngày), 4 khối nhập liệu, panel tính tự động.
4. **Xuất bảng cân đối** theo layout mẫu PDF (in / PDF).

## 9. Đã chốt (từ bảng câu hỏi)

Kỳ theo ngày tiếp nhận NL, TP khớp theo lô có thể trễ · mỗi loại NL một bảng · khối NL vào = thủy sản + bột (tỷ lệ %) + bán nội địa · phế liệu bán giá riêng · đơn giá NL/USD/chi phí/tỉ giá nhập tay mỗi kỳ · TP = lượng sản xuất ra · gộp nội địa + XK quy tỉ giá · công thức mục 6 · mặt hàng chưa khớp hẳn 141 mã (cần ánh xạ).

## 10. Điểm còn chờ xác nhận

1. **NL phân bổ cho nhiều bảng** — bảng phụ theo ngày là tổng NL nhận (VD mực 6.291), mỗi bảng cân đối chỉ lấy phần đưa vào mặt hàng đó (VD 3.106). Cần rõ **quy tắc chia** (cân riêng / ước tính) — quyết định máy gợi ý hay để nhập tay. *(Chờ anh trả lời.)*
2. **Chỉ số 0,45** = Tổng TP ÷ Tổng NL nhận — xác nhận định nghĩa + tên gọi ô, để thêm vào bảng. *(Chờ anh trả lời.)*

**Đã chốt:**
- **Bán nội địa** = bán trực tiếp cho khách trong nước (**đầu ra nội địa, VND**); tuy mẫu in ở khối trái, model chung với TP xuất — kênh nội địa (VND) thay vì xuất khẩu (USD).
- **Quy đổi tên NL**: "80 trên = lớn", "80 dưới = nhỏ" (mốc ~80 g/con), mục đích phân loại để **định giá khác nhau**. → dùng làm bảng ghép gợi ý.
- **Danh mục mặt hàng** = mở, người dùng thêm inline khi thiếu.

## 10b. Mẫu "Mực ống khay" đã kiểm chứng
- Định mức = Tổng NL ÷ Tổng TP: 3.106 ÷ 2.856 ≈ **1,09** (khớp ô Định mức).
- Khối NL vào = **dòng linh hoạt** (mực chỉ có N liệu + xả đông; bạch tuộc thêm bột + bán nội địa).
- Kỳ = **tập ngày rời rạc** (19-22-23-24-26-27-29/07), không liên tục.
- Mặt hàng có thể chỉ 1 dòng; chi phí CB 30.000, tỉ giá 26.000 nhập tay.

## 11. Ngoài phạm vi (không làm ở flow này)

- Phân quyền người dùng (Q28 — tạm hoãn).
- Báo cáo theo tháng của xưởng Cá và Khô (Q26).
- Cutover Supabase (vẫn localStorage giai đoạn đầu).
- Khối "tồn NL phân xưởng" và "xả đông" trong báo cáo tháng (Q25 — bỏ).

## 12. Nghiệm thu (định nghĩa "xong")

- Tạo được kỳ cân đối cho một loại NL, nhập đủ 3 khối, hệ thống tự tính định mức + lãi/lỗ khớp cách tính tay.
- Khối thủy sản NL tự cộng đúng từ sổ nhập hàng ngày.
- Xuất được bảng đúng bố cục mẫu, số liệu locale vi-VN.

---

**Last updated**: 2026-08-04
