# QTI-KH-01 — Quy trình Quản lý đơn hàng (Phòng Kế hoạch)

> **Load khi:** làm module Phòng Kế hoạch (yêu cầu khách · báo giá · hợp đồng/L/C · lệnh sản xuất · theo dõi tiến độ · đề nghị/lệnh xuất hàng · lưu hồ sơ), hoặc đụng luồng Đơn đặt / Lệnh xuất ở `/orders`.
> **Loại:** hồ sơ năng lực — bản chép quy trình chính thức của công ty + quy tắc rút ra + ánh xạ vào phần mềm. Nội dung quy trình là của xí nghiệp; phần "ánh xạ" và "câu cần xác nhận" là của SDVICO.
> **Nguồn:** file `QT quản lý đơn hàng BSF 1 - 2023.pdf` (5 trang, chủ dự án gửi 2026-10-19). Bản PDF dùng phông VNI cũ, chữ đã được chép lại sang Unicode — chỗ nào nghi chép sai đánh dấu *(?)*.
> **last_verified:** 2026-10-19

---

## 1. Thông tin tài liệu

| Mục | Nội dung |
|---|---|
| Mã tài liệu | **QTI-KH-01** |
| Lần ban hành | 01 |
| Ngày hiệu lực | **02/01/2023** |
| Biên soạn | Phạm Thị Phương Thảo — Phó phòng Kế hoạch |
| Xem xét | Hồ Thị Phượng — Phó giám đốc |
| Phê duyệt | Huỳnh Minh Tường — Giám đốc |
| Lịch sử | 02/01/2019: cập nhật toàn bộ theo **BRC 8** · 02/01/2023: cập nhật toàn bộ theo **BRC 9** (cùng người sửa, cùng người duyệt) |
| Tài liệu tham khảo | Tiêu chuẩn **BRC 9** · Sổ tay chất lượng · **Halal** |

**Mục đích:** xác định chính xác yêu cầu của khách và thời gian giao hàng để công ty chủ động sản xuất, giữ uy tín; đáp ứng nhu cầu quản lý; làm việc chuyên nghiệp, thống nhất.

**Phạm vi:** Phòng Kế hoạch và nhân viên phòng Kế hoạch áp dụng. Các bộ phận khác có trách nhiệm hỗ trợ.

**Thuật ngữ:** BGĐ = Ban Giám đốc · BLĐ = Ban lãnh đạo · **HĐKT = Hợp đồng kinh tế, gồm hợp đồng gia công, hợp đồng môi giới, hợp đồng mua bán.**

---

## 2. Mười ba bước

| Bước | Trách nhiệm | Việc | Biểu mẫu / hồ sơ | Điểm rẽ nhánh |
|---|---|---|---|---|
| 1 | BGĐ, Phòng KH | **Ghi nhận thông tin khách hàng.** Nhận qua mail, mạng, fax, từ BLĐ, đơn đặt của khách hoặc nội bộ. Ghi vào Sổ thông tin khách hàng để theo dõi, giám sát đơn | QTI-KH-01-01 | — |
| 2 | Phòng KH | **Kiểm tra.** Xem tình hình nguyên liệu, khả năng sản xuất và cung cấp; xác nhận công thức sản phẩm và quá trình sản xuất đáp ứng các công bố, chứng nhận và luật của nước tiêu thụ | — | Không làm được ⇒ **hủy thông tin**. Làm được ⇒ tính chi phí để chào giá |
| 3 | Phòng KH | **Lập báo giá (Offer).** Căn cứ giá nguyên liệu, chi phí sản xuất, khấu hao, lợi nhuận ước tính | QTI-KH-01-02 | — |
| 4 | BGĐ | **Phê duyệt Offer** | — | Sửa ⇒ làm lại · Không chấp thuận ⇒ **hủy** · Chấp thuận ⇒ gửi khách |
| 5 | Khách hàng | **Gửi khách** qua fax hoặc mail. Offer bằng fax lưu bản gốc; bằng email phải **in ra lưu** | — | Khách xác nhận ⇒ bước 6 |
| 6 | Phòng KH | **Lập HĐ hoặc nhận L/C.** Soạn/nhận HĐKT (HĐ nội địa, hoặc HĐ ngoại thương thanh toán T/T) · nhận L/C (thanh toán L/C) | QTI-KH-01-03 | T/T ⇒ HĐ · L/C ⇒ L/C |
| 7 | BGĐ | **Phê duyệt HĐ – L/C.** Cần sửa HĐ hoặc tu chỉnh L/C ⇒ phòng KH liên hệ khách | — | Duyệt ⇒ lưu hồ sơ, viết lệnh SX |
| 8 | Phòng KH | **Viết lệnh sản xuất** theo mẫu, đủ thông tin. Thông tin chưa rõ ⇒ ghi lý do + thời gian bổ sung. Gửi: **Kỹ thuật, Kho, Phân xưởng SX, lưu KH** | QTI-KH-01-04 | — |
| 9 | Phòng KH | **Theo dõi thực hiện SX** hằng ngày. Lưu báo cáo hàng tồn kho | QTI-KH-01-05 | — |
| 10 | Phòng KH | **Kiểm tra tiến độ** theo lịch xuất hàng của HĐ – L/C | QTI-KH-01-03 | Có nguy cơ trễ ⇒ liên hệ khách **xin kéo dài thời gian** hoặc **giảm lượng** để xuất đúng lịch; lưu xác nhận của khách |
| 11 | Phòng KH | **Xuất hàng.** Đủ hàng ⇒ làm **đề nghị xuất hàng** gửi BGĐ (Phân xưởng Đông xin xuất hàng *(?)*) ⇒ viết **lệnh xuất hàng**, trình **BGĐ duyệt** ⇒ gửi **Kế toán, Kho, Phân xưởng Đông**. Xuất xong ⇒ làm **list xuất thực tế** + **chứng từ xuất khẩu** | QTI-KH-01-06 · 07 · 08 | — |
| 12 | Phòng KH | **Kết thúc, lưu hồ sơ** — kẹp chung một file: (1) báo giá fax/mail · (2) HĐ – L/C, phụ kiện HĐ, tu chỉnh L/C · (3) lệnh SX · (4) báo cáo tồn kho từng ngày · (5) đề nghị xuất, lệnh xuất, list thực xuất | — | — |
| 13 | Phòng KH | **Hủy hồ sơ** khi hết hạn lưu (**2 năm**) | — | — |

```
Yêu cầu khách ─► Kiểm tra ─(không được)─► Hủy
                    │ được
                    ▼
                 Offer ─► BGĐ duyệt ─(không)─► Hủy
                    ▲         │ sửa ─┘ │ duyệt
                    └─────────┘        ▼
                              Gửi khách ─► Khách xác nhận
                                              ▼
                                   HĐ (T/T, nội địa) / L/C ─► BGĐ duyệt ─(sửa/tu chỉnh)─► liên hệ khách
                                              ▼ duyệt
                                        Lệnh sản xuất ─► Kỹ thuật · Kho · Phân xưởng
                                              ▼
                              Theo dõi hằng ngày + báo cáo tồn kho
                                              ▼
                          Kiểm tiến độ vs lịch xuất ─(trễ)─► xin gia hạn / giảm lượng
                                              ▼ đủ hàng
                  Đề nghị xuất ─► Lệnh xuất ─► BGĐ duyệt ─► Kế toán · Kho · PX Đông
                                              ▼
                             List thực xuất + chứng từ XK ─► Lưu hồ sơ (2 năm) ─► Hủy
```

---

## 3. Tám biểu mẫu

| TT | Biểu mẫu | Mã | Bộ phận lưu | Thời gian lưu |
|---|---|---|---|---|
| 1 | Sổ thông tin khách hàng | QTI-KH-01-01 | P. Kế hoạch | 2 năm |
| 2 | Offer sheet (báo giá) | QTI-KH-01-02 | P. Kế hoạch | 2 năm |
| 3 | HĐKT hoặc L/C | QTI-KH-01-03 | P. Kế hoạch | 2 năm |
| 4 | Lệnh sản xuất | QTI-KH-01-04 | P. Kế hoạch | 2 năm |
| 5 | Sổ kho (báo cáo tồn kho) | QTI-KH-01-05 | P. Kế hoạch | 2 năm |
| 6 | Giấy đề nghị xuất hàng | QTI-KH-01-06 | P. Kế hoạch | 2 năm |
| 7 | Lệnh xuất hàng | QTI-KH-01-07 | P. Kế hoạch | 2 năm |
| 8 | Giấy báo list thực tế | QTI-KH-01-08 | P. Kế hoạch | 2 năm |

> Chưa có bản mẫu trống của 8 biểu mẫu — cần xin để biết đủ các ô (xem §6).

---

## 4. Quy tắc nghiệp vụ rút ra (dùng làm luật cho phần mềm)

| Mã | Quy tắc | Bước |
|---|---|---|
| KH-R1 | Mọi yêu cầu của khách, từ bất kỳ kênh nào, được **ghi sổ trước** rồi mới xử lý. | 1 |
| KH-R2 | Chỉ báo giá sau khi đã kiểm: nguyên liệu, năng lực SX, công thức + quy trình đáp ứng chứng nhận và luật nước tiêu thụ. Không đạt ⇒ hủy yêu cầu (có lý do). | 2 |
| KH-R3 | Giá chào = giá nguyên liệu + chi phí sản xuất + khấu hao + lợi nhuận ước tính. | 3 |
| KH-R4 | **Ba điểm BGĐ duyệt bắt buộc:** Offer · HĐ/L/C · Lệnh xuất hàng. Chưa duyệt thì không đi tiếp. | 4, 7, 11 |
| KH-R5 | Offer gửi bằng email phải lưu bản in; bằng fax lưu bản gốc ⇒ trên phần mềm: lưu **file đã gửi**. | 5 |
| KH-R6 | Hình thức thanh toán quyết loại chứng từ: **T/T hoặc nội địa ⇒ HĐKT** · **L/C ⇒ L/C**. HĐKT có 3 loại: gia công · môi giới · mua bán. | 6 |
| KH-R7 | Sửa HĐ (phụ kiện) hoặc tu chỉnh L/C phải lưu kèm hồ sơ gốc, không ghi đè. | 7, 12 |
| KH-R8 | **Lệnh SX chỉ viết sau khi HĐ/L/C được duyệt**, phải đủ ô của mẫu; ô chưa rõ ghi lý do + hạn bổ sung. | 8 |
| KH-R9 | Lệnh SX đến 3 nơi nhận: Kỹ thuật, Kho, Phân xưởng SX. | 8 |
| KH-R10 | Phòng KH theo dõi tiến độ **hằng ngày** và lưu **báo cáo tồn kho từng ngày** vào hồ sơ đơn. | 9, 12 |
| KH-R11 | Tiến độ so với **lịch xuất trong HĐ/L/C**. Nguy cơ trễ ⇒ chủ động xin khách gia hạn hoặc giảm lượng; **xác nhận của khách phải lưu**. | 10 |
| KH-R12 | **Chỉ đề nghị xuất khi đủ hàng.** | 11 |
| KH-R13 | Lệnh xuất (sau BGĐ duyệt) đến 3 nơi: Kế toán, Kho, Phân xưởng Đông. | 11 |
| KH-R14 | Xuất xong, phòng KH lập **list thực xuất** + **chứng từ xuất khẩu**. | 11 |
| KH-R15 | Hồ sơ một đơn = **một bộ** gồm 5 thành phần (báo giá · HĐ/L/C + sửa đổi · lệnh SX · tồn kho từng ngày · đề nghị + lệnh + list thực xuất). | 12 |
| KH-R16 | Lưu hồ sơ **2 năm** rồi hủy. | 13 |

---

## 5. Ánh xạ vào phần mềm (đối chiếu code 2026-10-19)

| Bước | Đã có trong app | Lệch / còn thiếu |
|---|---|---|
| 1 Sổ thông tin KH | Danh mục khách (có `market`) | Chưa có sổ ghi **yêu cầu** của khách |
| 2 Kiểm tra | Số tồn đã có: Kho dự trữ `/warehouse`, tồn NL `/nxt-material`, Sổ kho tháng `/monthly-stock` | Chưa có bước "kiểm khả năng" gắn với yêu cầu, chưa có kết luận được/hủy |
| 3 Offer | Cân đối có định mức NL÷TP, giá NL, chi phí CB/kg ⇒ gợi ý được giá thành | Chưa có báo giá |
| 4, 7, 11 BGĐ duyệt | Phân quyền có hành động `approve` (đang dùng cho kho) | **Chưa có luồng duyệt** ở cả 3 điểm |
| 6 HĐ / L/C | Đơn đặt `/orders` (khách · ngày · dòng mặt hàng × quy cách × kg × block) | Chưa có HĐ/L/C, điều khoản, lịch xuất, phụ kiện/tu chỉnh |
| 8 Lệnh SX | — (màn "Lệnh sản xuất" bản trưng bày đã gỡ 2026-10-12) | Chưa có. `/wip` ghi sản lượng không gắn lệnh SX |
| 9 Theo dõi + tồn kho | `/orders` đối chiếu cần vs khả dụng; Kho dự trữ; Sổ kho tháng | Chưa có "báo cáo tồn kho từng ngày" gắn vào hồ sơ đơn |
| 10 Tiến độ vs lịch | Việc của tôi `/my-tasks` có cơ chế hạn / quá hạn / giao việc | Đơn chưa có lịch xuất ⇒ chưa cảnh báo trễ được; chưa ghi gia hạn/giảm lượng |
| 11 Đề nghị xuất | — | Chưa có |
| 11 Lệnh xuất | `/orders` lập lệnh xuất FIFO từ tồn | ⚠️ **Lệch quy trình:** lệnh xuất tạo ra là **đóng luôn** và **tự sinh phiếu bán XK** — không có bước BGĐ duyệt (`SalesOrderScreen.tsx`, `status: "closed"` lúc tạo) |
| 11 List thực xuất | Dòng lệnh xuất theo lô + quét kiểm lô (`ExportLotCheck`) | Chưa in ra dạng "giấy báo list thực tế" |
| 11 Chứng từ XK | — | Chưa có |
| 12 Lưu hồ sơ | Hạ tầng lưu file (Supabase Storage) | Chưa có "hồ sơ đơn hàng" gom 5 thành phần |
| 13 Hủy hồ sơ | — | Chưa có. **Không đề xuất tự xóa** (xem câu Q-QTI-5) |

**Kết luận cho thiết kế:** trục của module nên là **Hồ sơ đơn hàng** (một HĐ/L/C = một bộ hồ sơ), đúng như bước 12 của quy trình — không phải "lô hàng" như phân tích trước đó giả định. Kế hoạch xây dựng: [`../spec/phong-ke-hoach-quan-ly-don-hang.md`](../spec/phong-ke-hoach-quan-ly-don-hang.md).

---

## 6. Câu cần xác nhận với phòng Kế hoạch

| Mã | Câu |
|---|---|
| Q-QTI-1 | Quy trình 2023 còn hiệu lực nguyên văn? Có bản sửa sau BRC 9 không? |
| Q-QTI-2 | Ba lần BGĐ duyệt (Offer, HĐ/L/C, Lệnh xuất) muốn làm **trên phần mềm** hay vẫn ký giấy rồi phòng KH ghi lại kết quả? |
| Q-QTI-3 | HĐ **gia công** và **môi giới** có đi đúng 13 bước như HĐ mua bán không? |
| Q-QTI-4 | Xin **bản mẫu trống** 8 biểu mẫu QTI-KH-01-01 … 08. |
| Q-QTI-5 | "Hủy hồ sơ sau 2 năm" áp cho bản lưu của phòng KH. Trên phần mềm có cần xóa không, hay chỉ đánh dấu hết hạn? (HĐ, hóa đơn, chứng từ XK còn là chứng từ kế toán, thời hạn lưu theo luật dài hơn.) |
| Q-QTI-6 | "Báo cáo hàng tồn kho từng ngày" (QTI-KH-01-05, Sổ kho) hiện lấy từ đâu — có trùng với Sổ kho tháng / Kho dự trữ trong app không? |
| Q-QTI-7 | Bước 11: "Phân xưởng Đông xin xuất hàng" nghĩa là phân xưởng Đông đề nghị, hay phòng KH xin phân xưởng Đông xuất? |
| Q-QTI-8 | Quy trình áp cả **HĐ nội địa**. Đơn nội địa có đi qua phòng KH như XK không? (App đang giả định "đơn đặt = xuất khẩu".) |
| Q-QTI-9 | Kỹ thuật, Kho, Phân xưởng nhận lệnh SX: chỉ cần **xem**, hay phải **xác nhận đã nhận** trên phần mềm? |
