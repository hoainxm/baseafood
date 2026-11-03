> Load khi: hướng dẫn Phòng Kế hoạch / kho dùng phần Hàng của chuyến, Số lượng thực đóng, Lập invoice từ app (Xuất khẩu); trả lời câu hỏi "làm sao ra file invoice trên hệ thống".

# Xuất khẩu — nhập hàng của chuyến, kho điền số thực đóng, tải Invoice

Đặc tả nghiệp vụ: [ba-spec 63](../app-map/63-export-invoice-from-app.ba-spec.md). Migration `0095` + `0096` đã chạy trên DB thật (kiểm 2026-11-03). Trong app, nút **?** và **Hướng dẫn thao tác** của trang Xuất khẩu cũng kể các bước này.

Thứ tự công việc của một chuyến:

| Bước | Ai làm | Ở đâu | Làm gì |
|---|---|---|---|
| 1 | Phòng Kế hoạch | Hồ sơ HĐ → chuyến → khối **Hàng của chuyến** | Nhập số thùng / bó của từng mặt hàng |
| 2 | Kho (người đóng hàng) | Trang Xuất khẩu của kho, hoặc bước 4 **Đóng cont** | Đóng xong, điền số thực đã đóng |
| 3 | Phòng Kế hoạch | Bước 5 → mục **Commercial Invoice** | Chọn tài khoản, kiểm đơn giá, ghi thông tin riêng của khách, tải file |

## 0. Chuẩn bị một lần

- **Địa chỉ khách.** Danh mục → Khách hàng → sửa khách → ô **Địa chỉ** (nhóm Xuất khẩu). Invoice in tên và địa chỉ ở dòng "Applicant". Địa chỉ dài thì app tự ngắt dòng, mỗi dòng khoảng 40 ký tự.
- **Tài khoản ngân hàng.** Trang Xuất khẩu → tab **Danh mục** → **Tài khoản ngân hàng**. Đã có sẵn 3 tài khoản: MSB Vũng Tàu, Vietcombank Bà Rịa, VietinBank BRVT.
  - **Tên** là chữ hiện ở ô chọn.
  - **Ghi chú** là phần in dưới "Please make TT to:". Mỗi dòng gõ là một dòng in (Bank name, Account number, SWIFT CODE, Beneficiary, địa chỉ).
- **Dòng hàng của hợp đồng.** Hàng của chuyến lấy từ dòng hàng của hợp đồng. Muốn đóng mặt hàng chưa có trong hợp đồng thì ghi bản sửa hợp đồng trước.

## 1. Phòng Kế hoạch — nhập hàng của chuyến

1. Mở hồ sơ hợp đồng, chọn chuyến.
2. Ở khối **Hàng của chuyến** (ngay dưới thẻ chuyến), chọn **Nhập hàng của chuyến**.
3. Mỗi dòng hàng của hợp đồng hiện một khung. Với dòng đóng vào chuyến này, ghi:
   - **Số thùng (hoặc bó) kế hoạch.** Để trống nghĩa là không đóng dòng đó.
   - **Kg cả bì / thùng.** Dùng cho cột N.W / G.W và GROSS của Packing list.
   - **Hạn dùng**, ví dụ `2028.01`. Có ghi thì file tải về có thêm sheet Expiry date list.
   - **Tên hàng trên invoice, Size, Quy cách (Packing).** App lấy sẵn theo hợp đồng. Sửa nếu khách muốn chữ khác.
4. Góc phải mỗi khung có dòng nhắc: hợp đồng bao nhiêu, chuyến khác đã lên bao nhiêu, còn bao nhiêu.
5. Chọn **Lưu**. Lưu nhầm thì chọn **Hoàn tác** trên thông báo.

Sửa lại sau: chọn **Sửa hàng của chuyến**. Dòng kho đã điền số thực đóng thì không bỏ được, phải giữ số kế hoạch.

## 2. Kho — điền số thực đóng

Đóng cont xong, kho ghi số thùng / bó thực đã đóng của từng dòng.

- **Người đóng hàng:** trang Xuất khẩu hiện các chuyến đóng trong 7 ngày quanh hôm nay. Thẻ chuyến có danh sách hàng và nút **Điền số thực đóng**. Muốn tìm chuyến khác thì gõ mã lô, booking hoặc số cont vào ô Tìm chuyến.
- **Phòng Kế hoạch điền thay:** bước 4 Đóng cont → hàng **Số lượng thực đóng** → **Điền số thực đóng**.

Ghi số vào ô **Số thùng thực đóng** của từng dòng rồi chọn **Lưu**. App ghi luôn người điền.

Trạng thái hàng **Số lượng thực đóng**:

| Trạng thái | Nghĩa |
|---|---|
| Chưa làm | Chưa dòng nào có số |
| Đang làm | Mới điền một phần |
| Xong | Mọi dòng có số |

Dòng tóm tắt cho biết thực đóng khớp, thiếu hay thừa bao nhiêu so với kế hoạch. Hàng này **không chặn** bước Đóng cont xong.

Người đóng hàng không thấy đơn giá, tiền. Họ chỉ sửa được số thực đóng, không thêm / bớt dòng.

## 3. Phòng Kế hoạch — lập và tải invoice

1. Bước 5 → mục **Commercial Invoice** → **Cập nhật**.
2. Ghi **Số chứng từ** (số invoice, ví dụ `275/26`) và **Ngày**. Chưa ghi số thì file in trống số invoice.
3. Khung **Lập invoice từ app** ở cuối hộp:
   - **Tài khoản nhận tiền:** chọn 1 trong 3 tài khoản. Phần in hiện ngay bên dưới để soát.
   - **Điều kiện giao (Trade Terms):** để trống thì in theo hợp đồng, ví dụ "CFR Tokyo, Japan".
   - **Đơn giá từng dòng:** mặc định lấy theo hợp đồng. Sửa ở đây chỉ đổi trên invoice, không đổi hợp đồng.
   - **Dòng dưới tiêu đề bảng:** mặc định "Produced in Vietnam". Packing list in "Manufactured in Vietnam".
   - **Thông tin riêng khách yêu cầu:** xem mục 4.
4. Khung tổng ghi: số kiện, kg tịnh, tiền của invoice. Có dòng thiếu số kiện, kg/thùng hoặc đơn giá thì app báo. Dòng đó in trống tiền và không cộng vào tổng.
5. Chọn **Tải file Invoice (PDF)** để có bản in sẵn giống file PDF đang gửi khách: mỗi chứng từ một trang A4, có logo, chừa chỗ đóng dấu và ký bên phải khối ngân hàng. Cần sửa tiếp thì chọn **Tải file Excel**. Hai bản cùng số. File tên `INVOICE 275.26.pdf` / `.xlsx`, gồm:
   - **INVOICE:** bảng hàng gom theo tên hàng, từng size, dòng Packing, TOTAL, "Says" bằng chữ, khối ngân hàng.
   - **PACKING LIST:** N.W / G.W, số kiện, NET, GROSS.
   - **EXPIRY DATE:** chỉ có khi có dòng ghi hạn dùng.
6. Chọn **Lưu** để giữ phần đã lập (tài khoản, đơn giá, ghi chú). Lần sau mở lại không phải chọn lại.

Ba ô **Tổng thùng · Tổng kg tịnh · Tổng tiền** là số thực xuất của chuyến:
- Ô đang trống thì tự điền theo invoice lập khi tải file.
- Ô đã có số khác thì app báo lệch. Chọn **Dùng số của invoice lập** nếu muốn lấy số mới.

Tải lại nhanh không cần mở hộp: bước 5 → nút **Tải PDF** hoặc **Tải Excel** (dùng phần lập đã lưu).

Bản PDF dùng font Times như mẫu, chữ tiếng Việt có dấu (nếu lỡ gõ vào ghi chú) in thành không dấu. Chuyến quá nhiều dòng thì app tự thu nhỏ chữ cho vừa một trang; vẫn không vừa thì sang trang 2.

File tải về là Excel thường. Khách đòi thêm chi tiết lẻ thì sửa tiếp trong Excel rồi đính bản cuối vào mục Commercial Invoice như trước.

## 4. Thông tin riêng của khách (khối *NOTE)

Ô **Thông tin riêng khách yêu cầu** in sau dòng "Says". Mỗi dòng gõ là một hàng trong Excel.

- Muốn chia cột: copy bảng từ Excel dán vào (các ô cách nhau bằng phím Tab), hoặc ngăn ô bằng dấu `|`.
- Ví dụ khối NOTE của Gulf Foods:

```
*NOTE:
Items | Ref. Import Invoice Number | Origin of Raw Material | Used Raw Material | Inventory of Raw Material
Pacific saury | BF2606ACM180-03 dated June 10, 2026 | Japan | 13,935 KGS | 38,670 KGS
```

## 5. Hỏi nhanh

| Hỏi | Đáp |
|---|---|
| Không thấy khối Hàng của chuyến? | Tải lại trang (Ctrl+F5) để nhận bản mới. Người chỉ có quyền đóng hàng không thấy nút Nhập hàng. |
| Kho chưa điền số thực đóng mà cần invoice gấp? | Vẫn tải được. Dòng chưa điền dùng số kế hoạch; trong khung đơn giá, dòng đó ghi "(kế hoạch)" cạnh số kiện. |
| Đổi tài khoản ngân hàng cho một khách? | Chọn tài khoản khác ở từng invoice. Muốn sửa nội dung in thì sửa Ghi chú ở tab Danh mục. |
| Tiền lệch 0,01 so với file Excel cũ? | App làm tròn tiền từng dòng 2 số lẻ rồi mới cộng. File cũ có ô gõ tay (VD 236/26 ô F22) nên có thể lệch xu. |
| Sale contract, C/O, H/C có tải được không? | Chưa. Cần file mẫu của từng loại để làm tiếp. |
