# Hồ sơ pháp nhân & nhận diện — Baseafood 1 (BSF1)

> **Load khi:** in thông tin công ty lên chứng từ (Invoice, Packing list, Sale contract, lệnh SX…), đổi logo, thêm tài khoản ngân hàng, hoặc nạp hồ sơ công ty vào màn **Tài liệu công ty** (`/documents`).
> **last_verified:** 2026-11-03
> Đặc tả lưu thành một nguồn trong app: [ba-spec 64](../app-map/64-company-profile.ba-spec.md).

Rà 2026-11-03: các thông tin dưới đây đang **nằm rải rác** (file Excel / PDF phòng KH gửi, con dấu, code), **chưa có mục nào** trong Tài liệu công ty trên hệ thống thật (kiểm chỉ-đọc: 9 tài liệu, toàn của Phòng Kế hoạch, 0 file).

## 1. Pháp nhân

| Thông tin | Giá trị | Nguồn | Tin cậy |
|---|---|---|---|
| Tên tiếng Việt | CÔNG TY TNHH BASEAFOOD 1 | con dấu trên INVOICE 275/26 | ✅ |
| Tên tiếng Anh | BASEAFOOD 1 COMPANY LIMITED · viết tắt BASEAFOOD 1 CO.,LTD | đầu Invoice 236/26, 275/26 | ✅ |
| Mã số thuế | 3502297423 | đọc từ vòng chữ con dấu (ảnh) | ⚠️ cần kế toán xác nhận |
| Địa chỉ (EN) | 321 Tran Xuan Do Street, Quarter 2, Ba Ria Ward, Ho Chi Minh City, Vietnam | đầu Invoice, Sale contract | ✅ |
| Điện thoại | 84.254.3826217 | Sale contract 13-26-GULF | ✅ |
| Fax | 84.254.3825545 | Sale contract 13-26-GULF | ✅ |
| Người ký chứng từ xuất khẩu | Hồ Chí Phương — Phó Giám đốc (VICE DIRECTOR) | chữ ký trên INVOICE 275/26 | ⚠️ xác nhận còn đúng người ký |
| Quan hệ với tập đoàn | [BAN-GIAO](../BAN-GIAO.md) ghi "thuộc CTCP Chế biến XNK Thủy sản Bà Rịa - Vũng Tàu" | BAN-GIAO 2026-08 | ⚠️ chứng từ dùng pháp nhân riêng "Baseafood 1" — hỏi lại quan hệ (chi nhánh / công ty con) |

## 2. Tài khoản ngân hàng thụ hưởng (USD)

Đang lưu ở danh sách chọn **Tài khoản ngân hàng** của Xuất khẩu (mig 0096, đã có trên DB thật) — chưa có ở Tài liệu công ty.

| Ngân hàng | Số tài khoản | SWIFT | Nguồn |
|---|---|---|---|
| Vietnam Maritime Commercial JSB (MSB) — Vung Tau Branch | 08001370022669 | MCOBVNVX007 | Invoice 236/26 + Zalo chị Vi 02/11 |
| JSC Bank for Foreign Trade of Viet Nam (Vietcombank) — Ba Ria Branch | 0081371242432 | BFTVVNVX115 | Zalo chị Vi 02/11 |
| Vietnam JSC Bank for Industry and Trade (VietinBank) — BRVT Branch | 110000206680 | ICBVVNVX880 | INVOICE 275/26 |

## 3. Nhận diện

| Tài sản | File | Ghi chú |
|---|---|---|
| Logo gốc (rõ nét) | [`docs/brand/baseafood-logo-original.jpg`](../brand/baseafood-logo-original.jpg) | 824×482, chủ dự án gửi 2026-11-03 — cách làm các bản dùng: [`docs/brand/README.md`](../brand/README.md) |
| Màu thương hiệu | `#17529c` (CLAUDE.md QT 9) | logo mới xanh sáng hơn (~`#2f8fd8`) — giữ màu giao diện, không đổi |

## 4. Chứng nhận nhắc tới nhưng CHƯA có bản / hạn

BRC 9 · Halal · HACCP · EU code · ISO (BAN-GIAO §1, README hồ sơ năng lực). Tài liệu công ty có loại **Chứng nhận** kèm nhắc gia hạn 60 ngày (40-documents) nhưng chưa nạp chứng nhận nào ⇒ cần bản scan + ngày hết hạn từ phòng QC.

## 5. Biểu mẫu chứng từ xuất khẩu chưa có trong Tài liệu công ty

Commercial Invoice · Packing list · Expiry date list · Sale contract (file `INV 236.26.XLS` — 4 sheet đang dùng). App đã lập được 3 chứng từ đầu (ba-spec 63); Sale contract chưa.
