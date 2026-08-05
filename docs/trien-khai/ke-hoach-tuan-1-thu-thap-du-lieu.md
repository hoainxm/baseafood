# Kế hoạch Tuần 1 — Thu thập dữ liệu & khảo sát nghiệp vụ (Baseafood BSF1 Bà Rịa)

> Bản theo dõi công việc Tuần 1 — **dùng chung giữa đội triển khai và xí nghiệp** để hai bên cùng nắm nội dung đang làm. Chi tiết hóa mục "Tuần đầu tiên" của SDVICO-PLAN-01 (bản trình BGĐ, ở repo SDFactory: `docs/trien-khai/ke-hoach-so-hoa-baseafood.md`).

| | |
|---|---|
| Mã | SDVICO-WEEK1-01 · v3.2 (2026-08-03) |
| Địa điểm | XN Baseafood BSF1 — TP Bà Rịa (chỉ làm tại đây) |
| Thời gian | Bắt đầu 03/08/2026 (T2), on-site 1 tuần |
| Ưu tiên | **Quản lý nguyên liệu trong sản xuất** (trọng tâm thật) — kéo tồn kho theo cùng |
| Hệ thống | Mới hoàn toàn, không kế thừa SDFactory (chỉ là demo bán hàng) |
| Phần mềm hiện có | KiotViet — nhập-xuất-tồn kho thương mại (tạm ổn, không đụng phần kỹ thuật/API) |

**Bối cảnh công ty** (tra web): CTCP Chế biến XNK Thủy sản Bà Rịa - Vũng Tàu, thành lập 1976, ~650–1.000 lao động, 3 nhà máy, ~9.000 tấn/năm, 90% xuất khẩu, mặt hàng ở 40+ nước. Chuẩn EU (DL 34/DL 20), HACCP, HALAL, ISO. Mặt hàng: cá đông nguyên con (đổng, nục, chỉ vàng…), fillet (sardine, croaker, cá mối), khô (cá bò, bong bóng cá), **mực/bạch tuộc/cá đuối**. Truy xuất nguồn gốc là yêu cầu bắt buộc với hàng xuất khẩu, phù hợp với yêu cầu quản lý lô/mẻ nêu ở mục 1.

---

## 1. Vấn đề cốt lõi cần ưu tiên (từ buổi trao đổi với chị Dung)

Baseafood là **doanh nghiệp sản xuất**, không phải doanh nghiệp thương mại. Nguyên liệu mua về (cá, tôm, bạch tuộc — số lượng lớn, đổ xá) **không thể cất thẳng vào kho**: phải qua xưởng sơ chế, rửa, rồi **cấp đông thành từng lốc/khối** (khối lượng không cố định) mới đủ chuẩn cất kho, để dành làm nguyên liệu cho các tổ sản xuất kỳ sau.

Vì vậy sinh ra một **vòng lặp gối đầu**: mỗi kỳ sản xuất dùng cả hàng mới mua lẫn lốc đông của kỳ trước; phần chưa dùng hết lại đông và gửi lên tiếp cho kỳ sau. Các vòng này **đè lên nhau, dồn qua nhiều kỳ**. Nếu khâu ghi chép phần gối đầu này không chuẩn thì **số tồn nguyên liệu cuối tháng bị lệch** (khi dư, khi thiếu, khó phát hiện), kéo theo **kế toán chốt số cuối kỳ sai**. Đây là vấn đề quan trọng nhất — **cần ưu tiên làm trước**.

**Phân biệt hai phần kho**:
- **Kho hàng hóa thông thường** (nhập – xuất – tồn theo mặt hàng): KiotViet đang quản lý, tạm ổn, chỉ cần nhập đủ. Không thuộc phạm vi ưu tiên đợt này.
- **Nguyên liệu trong sản xuất** (vòng lặp sơ chế – cấp đông – tái sử dụng, cần lưu vết từng lô qua các kỳ): là **trọng tâm**. Yêu cầu: thao tác ghi chép đơn giản, số liệu chính xác.

**Đặc thù cần nắm**:
- **Đầu vào nhiều nguồn**: từ cảng và từ khách hàng/nhà phân phối. Không mua trực tiếp ở cảng — cảng chỉ để xác nhận hàng đánh bắt đúng quy trình (phục vụ truy xuất nguồn gốc). Khách chưa làm được chứng nhận nguồn gốc nên trước mắt chỉ lưu hồ sơ khách hàng.
- **Ba tầng kho**: 2 kho lớn của xí nghiệp (chứa cả thành phẩm lẫn nguyên liệu) · kho nhỏ tại xưởng (hàng đang làm dở) · kho thuê ngoài khi kho lớn đầy — tất cả đều phải theo dõi.
- Mỗi kho có một **thủ kho** riêng.
- **Bán thành phẩm đông đóng theo lốc/khối, khối lượng không cố định** — cần xác định cách tính tại chỗ.

---

## 2. Hiện trạng tổ chức dữ liệu (từ record2 + hai file thực tế)

**Hai hệ danh mục đang chạy song song, chưa nối nhau:**

| Hệ | Nguồn | Cấu trúc | Tình trạng |
|---|---|---|---|
| Danh mục thành phẩm (142 mã) | File `danh mục tên thành phẩm.xls`, xuất từ phần mềm kế toán (tài khoản 1551) | Cột MATK/MADM/TENDM/DVT; mã = loài + cách chế biến + size (VD `BT-CL4-5` = bạch tuộc 2 da cắt luộc 4-5); đơn vị kg | Sạch, mã hóa tốt — nạp được ngay làm danh mục thành phẩm |
| Danh mục nguyên liệu / bán thành phẩm | Nằm trong báo cáo làm tay | Chỉ có tên chữ: "1 da", "2 da", "mực ống", "đầu ống", "cá nục", "tôm…"; quy cách theo khoảng size (18-20, 16-20) | Chưa mã hóa, chưa chuẩn — cần dựng |

Thuật ngữ (record2): bạch tuộc phân "1 da / 2 da" (2 da = đã qua xử lý điện); mực ống mang tiền tố "mực ống"; "xả đông" = rã hàng đông kỳ trước đưa lại sản xuất. Sơ chế làm sạch như nhau rồi cắt ra nhiều size.

**Hai biểu mẫu Excel đang dùng, nối tiếp nhau:**

*Biểu mẫu 1 — Báo cáo tổng hợp nguyên liệu hàng ngày* (CÔNG TY TNHH BASEFOOD I, phân xưởng đông "PXD"): mỗi ngày ghi từng dòng **Đại lý · Loại nguyên liệu · Số lượng (kg) · Đơn giá · Ghi chú (tên tài xế + biển số xe)**. Loại NL ghi tắt: "1DA NL", "2DA NL 80T", "Mực ống 7cm"… Tổng ngày (VD 31/7/2026 = 9.210 kg) được chuyển sang biểu mẫu tháng. Ghi chú kèm biển số xe chính là dấu vết nguồn gốc lô nhập.

*Biểu mẫu 2 — Báo cáo Nguyên liệu – Bán thành phẩm (tháng)*: ma trận **dòng = loại NL/BTP, cột = 31 ngày + Cộng**, mỗi tháng một sheet, lịch sử 2022 → 08/2026 trong một workbook. Gồm **sáu khối**:

| # | Khối | Ý nghĩa | Cộng T7/2026 (kg) |
|---|---|---|---|
| 1 | Nguyên liệu mua trong ngày | Nhận từ đại lý (nối biểu mẫu 1) | 304.786 |
| 2 | Tồn nguyên liệu tại phân xưởng | Nguyên liệu đang ở xưởng | (chưa điền) |
| 3 | Hàng xả đông | Lấy hàng đông kỳ trước ra dùng lại | (chưa điền) |
| 4 | Đông gửi nguyên liệu | Đóng đông cất dự trữ kỳ sau (bạch tuộc 2 da 30.758; ghẹ lột 4.253…) | — |
| 5 | BTP phân xưởng Đông | Bạch tuộc, mực, ghẹ + cá gia công | 246.632 |
| 6 | BTP phân xưởng Cá | Cá đục, saba, sòng, sardine… | 80.000 |

Bán thành phẩm toàn xưởng T7/2026 ≈ **326.632 kg**. Vòng lặp gối đầu (mục 1) chính là **khối 4 (đông gửi) ↔ khối 3 (xả đông)**: gửi đông kỳ này, lấy ra kỳ sau. Toàn bộ làm **bằng tay**, cộng tay, gửi nhóm Zalo mỗi sáng 8–9h. Nhà máy có **ba phân xưởng**: Đông, Cá và Khô (file báo cáo tháng này mới có khối của xưởng Đông và xưởng Cá; xưởng Khô báo cáo riêng — cần thu bổ sung).

**Luồng dữ liệu thao tác (đã dựng lại được):** đại lý giao hàng → ghi sổ nhập nguyên liệu hàng ngày (đại lý, kg, đơn giá, biển số xe) → vào xưởng sơ chế/cấp đông → báo cáo NL-BTP tháng (mua · tồn · xả đông · đông gửi · BTP hai xưởng) → một phần đông gửi dự trữ, xả đông tái dùng kỳ sau → **thành phẩm (142 mã, tài khoản 1551) xuất bán**.

**Nhịp báo cáo hiện tại:** bán thành phẩm bản hằng ngày · thành phẩm 5 ngày/bản (mỗi tháng 6 bản, làm T2–T6) · tổng kết tháng. Đơn giá quy về cuối tháng, không cập nhật theo ngày. Người nhập máy: chỉ **Trúc** (Excel); **Thủy** ghi tay.

**Khách hàng & giá:** nguồn cung gồm **đại lý** (biểu mẫu 1) và khách hàng; mỗi sản phẩm gắn tên khách; mỗi khách và mỗi loại hàng có đơn giá riêng.

**Hướng tổ chức dữ liệu cho hệ thống mới:**
1. Nạp ngay 142 mã thành phẩm (tài khoản 1551, kg) làm danh mục thành phẩm chuẩn.
2. Dựng danh mục nguyên liệu/BTP có mã + thuộc tính quy cách (size), thay danh sách tên viết tay.
3. Xây bảng định mức nguyên liệu → thành phẩm (tỷ lệ thu hồi) — hiện chưa có.
4. Số hóa hai biểu mẫu nối nhau: sổ nhập nguyên liệu hàng ngày (theo đại lý) + ma trận tháng sáu khối (mua · tồn · xả đông · đông gửi · BTP xưởng Đông · BTP xưởng Cá), tự cộng và khóa kỳ — thay việc cộng tay.
5. Tách dữ liệu theo **ba phân xưởng** (Đông, Cá, Khô) ngay từ đầu.
6. Gắn đại lý/khách hàng (nguồn) + đơn giá theo khách/loại, chốt cuối tháng.
7. Giữ nguyên nhịp báo cáo quen thuộc (ngày / 5 ngày / tháng) nhưng sinh tự động từ dữ liệu đã nhập.

---

## 3. Ba mảng thu thập

**A · Người tham gia & vai trò trong luồng dữ liệu** — để biết ai nhập, ai giữ số liệu nào. *Phân quyền người dùng theo bộ máy tổ chức: tạm gác, chưa thực hiện đợt này.*

Cơ cấu XN (phẳng): **Giám đốc → 5 khối ngang quyền**.

| Khối | Chức năng | Liên quan trong dự án |
|---|---|---|
| **Kế hoạch** | sale · sản xuất · lệnh sản xuất · đóng hàng · vật tư · XNK · **kho** | Khối trọng tâm: quản lý cả kho và sản xuất — phạm vi vấn đề nêu ở mục 1 (chị Phượng/chị Hoa) |
| **Thu mua** | nhập hàng (đầu vào cảng/khách) | Tạo dữ liệu đầu vào của chuỗi |
| **Kĩ thuật** | chất lượng sản phẩm · kiểm tra quy trình | Duyệt chất lượng và hồ sơ nguồn gốc |
| **Kế toán** | chốt số liệu | Chốt tồn cuối kỳ; số liệu phụ thuộc độ chính xác của khâu sản xuất |
| **Điện lạnh** | máy móc · điện nước · vận hành | Vận hành hệ thống cấp đông và kho lạnh |

Ghi chú: **không có phòng "Sản xuất" riêng** (thuộc khối Kế hoạch); xưởng do **phó giám đốc phụ trách** (chị Dung). Trong khâu số liệu: **Trúc** nhập máy (Excel báo cáo), **Thủy** ghi tay. Cần xác định thủ kho từng kho (mỗi kho một thủ kho).

**B · Hiện trạng dữ liệu → kế hoạch tổ chức lại**
- Kiểm kê nguồn: KiotViet, Excel, sổ, thẻ kho — mỗi nguồn ai nhập/đọc, xuất được không, cùng số liệu nằm mấy nơi có khớp không.
- Từ **KiotViet** rút file Excel: danh mục hàng hóa (mã, đơn vị), tồn hiện tại (số đầu kỳ), lịch sử nhập-xuất.
- KiotViet **không quản được**: lô/mẻ, hạn dùng, định mức/tỷ lệ thu hồi, nối nguyên liệu lô nào → thành phẩm lô nào → đây là phần hệ thống mới bù.
- Đầu ra: quy tắc đánh mã hàng thống nhất + chuẩn đơn vị và cách quy đổi (kg ↔ lốc/khối) + nguyên tắc "một số liệu chỉ một nguồn chuẩn" + các bước làm sạch → nạp → đối chiếu (chạy song song sổ hiện tại tới khi khớp).

**C · Nghiệp vụ tồn kho + sản xuất (khảo sát chi tiết — ưu tiên)**
Khảo sát theo dòng vật chất, ghi nhận tại từng điểm phát sinh số liệu:
1. **Tiếp nhận** — nguồn (cảng/khách), cân, hồ sơ nguồn gốc, ghi vào đâu.
2. **Sơ chế + cấp đông** — đóng thành lốc/khối; ghi chuyển bán thành phẩm ở đâu; hao hụt tính lúc nào.
3. **Nhập kho nguyên liệu đông + tái sử dụng kỳ sau** — chính là vòng lặp gối đầu; theo dõi phần chuyển sang kỳ sau ra sao; chỗ ghi chép đang lệch nằm ở đâu.
4. **Kho** — ba tầng kho, thủ kho từng kho, thẻ kho, kiểm kê, xử lý chênh lệch, kho thuê ngoài.
5. Con số cần đo: lượng nhập ngày cao điểm · tỷ lệ thu hồi thành phẩm (yield) mặt hàng chủ lực · số mẻ/ngày · mức chênh lệch lần kiểm kê gần nhất.

Mỗi phiếu/sổ/thẻ: **chụp bản đang điền + xin bản trống** — căn cứ dựng màn hình đúng thói quen người làm.

---

## 4. Lịch Tuần 1 (đi theo dòng vật chất, khâu đầu trước)

| Ngày | Khâu | Đầu ra |
|---|---|---|
| **T2 · 03/08** | Tiếp nhận nguyên liệu (khâu đầu) — nguồn vào, cân, hồ sơ; ai tham gia | Luồng tiếp nhận nháp + ảnh biểu mẫu |
| **T3 · 04/08** | Sơ chế + cấp đông → lốc; ghi chép chuyển bán thành phẩm | Luồng sơ chế-đông + điểm ghi chép |
| **T4 · 05/08** | Nhập kho NVL đông + vòng lặp tái sử dụng; thủ kho 3 tầng kho | Sơ đồ vòng lặp + chỗ sai số |
| **T5 · 06/08** | Rút dữ liệu KiotViet + kho hàng hóa thông thường + đối chiếu số liệu; danh mục nền | Bộ dữ liệu KiotViet + đánh giá |
| **T6 · 07/08** | Bổ sung phần còn thiếu; đối chiếu xác nhận với người trực tiếp làm; dựng đề cương cấu trúc dữ liệu lưu vết + cây tổ chức/phân quyền | Luồng có xác nhận + đề cương dữ liệu |
| **T7 · 08/08** | Tổng hợp; báo cáo Tổng giám đốc; chốt 2 luồng làm trước | Biên bản TGĐ + quyết định 2 luồng |

Thứ tự khâu giữ nguyên; ngày co giãn theo lịch từng bộ phận.

---

## 5. Báo cáo công việc hằng ngày (Zalo "Chuyển đổi số")

Cuối mỗi ngày dán vào nhóm theo khuôn cố định:

```
📌 BÁO CÁO NGÀY [N] — [thứ, dd/mm] — BSF1 Bà Rịa · [tên]
✅ ĐÃ LÀM: [khâu/bộ phận — việc — gặp ai]
📥 THU ĐƯỢC: [biểu mẫu/dữ liệu/con số — dạng ảnh/Excel/giấy]
❓ CẦN THÊM: [thiếu gì — ai cấp — hạn]
⚠️ VƯỚNG: [chỗ kẹt → đề xuất]
➡️ MAI: [khâu sẽ làm]
```

**Lưu trữ** (tin Zalo dễ trôi, cần lưu bản ngoài): thư mục chung hai bên `Baocao-hangngay/2026-08/`, mỗi ngày một file `BC_BSF1_2026-08-03.md` (chép lại nội dung báo cáo + đính ảnh/Excel vào `dulieu/2026-08-03/`). Cuối tuần tổng hợp 6 báo cáo ngày thành một bản tuần cho cuộc họp T7.

---

## 6. Bàn giao cuối Tuần 1

1. Cây tổ chức + danh sách người tham gia và vai trò trong luồng số liệu (chưa làm phân quyền hệ thống).
2. Kiểm kê nguồn dữ liệu + dữ liệu KiotViet + **đề cương kế hoạch tổ chức dữ liệu** (dựa trên mục 2).
3. **Sơ đồ vòng lặp nguyên liệu** (tiếp nhận → sơ chế → đông → kho → tái dùng) có người làm xác nhận, chỉ rõ chỗ ghi chép đang sai + bộ biểu mẫu + con số nền.
4. Bộ mẫu báo cáo nghiệp vụ hiện dùng (kho + sản xuất).
5. Biên bản họp TGĐ + quyết định 2 luồng làm trước Tuần 2.

## 7. Cần cung cấp / chốt

| Mục | Trạng thái |
|---|---|
| XN Bà Rịa · bắt đầu 03/08 · KiotViet (không đụng API) | ✅ |
| Cơ cấu tổ chức: Giám đốc + 5 khối | ✅ |
| Danh mục thành phẩm (142 mã) + báo cáo NL-BTP tháng 2022–2026 + sổ nhập NL hàng ngày | ✅ đã nhận |
| Các file mềm bổ sung khác (báo cáo TP 5 ngày, bản tồn kho, danh mục đại lý/khách, định mức) | ⏳ user gửi sau |
| Liên lạc: thủ kho từng kho, Trúc/Thủy (người nhập số liệu), chị Dung | ⏳ |
| Đội xuống mấy người | ⏳ |

---

## History
- v3.2 (2026-08-03): sửa **2 → 3 phân xưởng** (Đông, Cá, Khô) — xưởng Khô báo cáo riêng, chưa có trong file tháng đã đọc, cần thu bổ sung; cập nhật hướng tổ chức dữ liệu tách theo 3 phân xưởng.
- v3.1 (2026-08-03): mở rộng §2 sau khi đọc trọn file — thêm biểu mẫu "Báo cáo tổng hợp nguyên liệu hàng ngày" (đại lý · loại NL · kg · đơn giá · biển số xe) nối vào ma trận tháng; ma trận tháng thực có **6 khối** (mua · tồn · xả đông · **đông gửi** · BTP xưởng Đông 246.632 · BTP xưởng Cá 80.000 → toàn xưởng 326.632 kg), vòng lặp gối đầu = khối 4 ↔ khối 3; xác nhận **2 phân xưởng** (Đông, Cá). Thêm sơ đồ "luồng dữ liệu thao tác" đầu-cuối. Hướng tổ chức dữ liệu bổ sung tách theo phân xưởng.
- v3 (2026-08-03): thêm §2 "Hiện trạng tổ chức dữ liệu" từ phân tích record2 + 2 file thực tế (danh mục 142 mã thành phẩm TK 1551 sạch; báo cáo NL-BTP ma trận tay 2022–2026, 3 khối NL mua/tồn PX/xả đông = vòng lặp; nhịp báo cáo ngày/5 ngày/tháng; Trúc nhập máy, Thủy tay; khách hàng gắn đơn giá riêng) + 6 hướng tổ chức dữ liệu cho hệ thống mới. Bỏ trọng tâm phân quyền (user: chưa cần) — Mảng A đổi thành "Người tham gia & vai trò trong luồng dữ liệu". Renumber mục 2→3…6→7.
- v2.3 (2026-08-03): rà giọng văn về chuẩn báo cáo, bỏ cách nói kịch hóa/đời thường ("nơi hứng hậu quả sai tồn" → "chốt tồn cuối kỳ; số liệu phụ thuộc độ chính xác khâu sản xuất"; "hạ tầng cấp đông — chạm khi kho lạnh sự cố" → "vận hành hệ thống cấp đông và kho lạnh"; ôm/soi kỹ/vá chỗ hổng/trôi tin→neo ra ngoài/không phải chỗ cần xử lý → diễn đạt trung tính, súc tích). Cột bảng đổi tiêu đề "Vai trò trong dự án" → "Liên quan trong dự án".
- v2.2 (2026-08-03): sửa theo góp ý — bán thành phẩm đông đóng lốc/khối **khối lượng không cố định** (bỏ "2–5kg"); "vối đầu"→"gối đầu" (các vòng lặp đè lên nhau, dồn qua nhiều kỳ); bỏ cụm "cái túi/xương sống/lộn xộn", chỉ nhấn đây là vấn đề ưu tiên làm trước; viết lại lời văn dễ hiểu cho cả xí nghiệp đọc (doc dùng chung 2 bên), gỡ jargon (yield→tỷ lệ thu hồi, master data→danh mục nền); bỏ nốt nhắc KiotViet API.
- v2.1 (2026-08-03): thêm cơ cấu tổ chức thật (Giám đốc + 5 khối ngang quyền: Kế hoạch/Thu mua/Kĩ thuật/Kế toán/Điện lạnh) — Kế hoạch là khối trọng tâm ôm kho+sản xuất; không có phòng Sản xuất riêng, xưởng do phó GĐ (chị Dung) phụ trách. Bổ sung bối cảnh công ty tra web. Bỏ phần KiotViet API (user: không làm).
- v2 (2026-08-03): rút gọn toàn bộ + gộp phân tích record1 (buổi chị Dung): xác định trọng tâm thật = quản lý nguyên liệu trong vòng lặp sản xuất (sơ chế–cấp đông lốc–tái dùng qua kỳ → sai tồn cuối kỳ → sai kế toán), KiotViet chỉ lo kho thương mại; đặc thù đầu vào cảng/khách + kho 3 tầng + thủ kho; lịch đổi sang đi theo dòng vật chất, khâu tiếp nhận nguyên liệu trước.
- v1–v1.1 (2026-08-03): tạo mới; điền XN Bà Rịa, ngày, KiotViet, mẫu báo cáo Zalo.

**Last updated**: 2026-08-03
