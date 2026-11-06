> Load khi: nạp số bạch tuộc NL tự đông tháng 10/2026 (Kho 1000 tấn) vào sổ kho tháng, hoặc cần gỡ / khôi phục lần nạp đó.

# Nạp XNT bạch tuộc NL tự đông — tháng 10/2026

**Trạng thái: ĐÃ NẠP 2026-11-06 ~10:15** (tài khoản `admin`, qua hook `useMonthlyStock` ⇒ 25 dòng `audit_log`, hàng chờ trống).

- Sao lưu trước khi ghi: `~/Downloads/backup-K1000T-2026-09-10-20261106-1012.json` + `.xlsx` (313 dòng: T9 178, T10 135).
- Kết quả trên DB thật: 25 dòng đổi, 0 dòng xóa. Gồm 3 dòng `adj` T9, sửa dòng T9 #175, 3 dòng `carry|adj` T10, 4 dòng `adj` T10, 14 dòng carry T10.
- 34/34 mã khớp PDF từng số (đầu/nhập/xuất). Tổng 229.812 / 62.611 / 100.950 / 191.473. Không dòng nào âm.
- Dồn kỳ chạy `carryForwardIntoLedger(…, "2026-10", "Kho 1000 tấn")`. Dòng #121 chỉ lệch vụn làm tròn (965,3 → 965,29…) nên giữ nguyên, không ghi.
- Lô Cân đối #119 (xuất 15.000) không đổi.
- Còn treo: kế toán xác nhận phần xuất so với Cân đối các kỳ sau 05/10; nnttruc xác nhận lô 30 kg.

## Nguồn

- File: `BẠCH TUỘC NL TỰ ĐÔNG THÁNG 10.pdf`, "Báo cáo xuất nhập tồn", **KHO TP - KHO 1000**, 01/10 → 31/10/2026, lập 02/11/2026 15:38. 34 mã, kg, cột giá trị = 0.
- Oracle: tồn đầu **229.812** · nhập **62.611** · xuất **100.950** · tồn cuối **191.473**. 34/34 dòng thỏa đầu + nhập − xuất = cuối, không trùng mã.
- Đọc PDF: `pypdf`. Bản `layout` lật dọc trang ⇒ lấy số theo dòng, lấy tên theo bản thường. Mã `PXĐ.BTNL.TĐ 2022-144` bị ngắt dòng trong PDF.

## Quyết định đã chốt với chủ dự án (2026-11-06)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Nguồn số tháng 10 | **PDF là nguồn.** Kế toán không gửi bảng kê kho 1000 sheet T10 |
| 2 | Nạp vào đâu | **Chỉ sổ kho tháng** `/monthly-stock`, kho **Kho 1000 tấn (K1000T)**, nhóm **Hàng tạm**. Không nạp `/nxt-warehouse` (màn đó mới có T7, hở T8–T9) |
| 3 | Xuất PDF và lấy xả đông của Cân đối | Đã đối chiếu: **không trùng** (xem § Đối chiếu Cân đối). Chủ dự án hỏi lại kế toán để xác nhận |
| 4 | Mã 015, 1008 lệch tồn đầu | **Theo PDF** |
| 5 | Mã 040, 2022-144 sổ bị sót | **Bổ sung vào tháng 9 rồi dồn**, có sao lưu và đường gỡ |
| 6 | 4 mã mới T10 | **Tên kiểu sổ**, mã kế toán ghi ở ghi chú |
| 7 | Mã 1001 ↔ dòng «Bạch tuộc 2 da 250up · F34» | **Đúng**, gán Vị trí = **Kho 1500 tấn** |
| 8 | 2 lô gửi đông 10 + 20 kg | **Giữ nguyên, hỏi nnttruc** (xem § Lô 30 kg) |

## Các bước thực hiện (đúng thứ tự)

Ghi **qua app** (hook `useMonthlyStock` → `repo.ts`) để có `audit_log`. Không ghi thẳng SQL: sẽ mất lưu vết và có thể bị hàng chờ dưới máy đè lại.

1. **Sao lưu.** SELECT mọi dòng `monthly_stock_ledger` có `site_id='bsf1'`, `warehouse='Kho 1000 tấn'`, `period in ('2026-09','2026-10')` ra JSON + xlsx, đặt tên `backup-K1000T-2026-09-10-<yyyyMMdd-HHmm>` trong `~/Downloads`.
2. **Tháng 9, nhóm Hàng tạm:**
   - Thêm 3 dòng mới, `open_kg` như sau, nhập/xuất = 0, id `adj|xnt-2026-10|<mã KT>`, ghi chú `Bổ sung theo XNT T10 (PDF lập 02/11/2026) — mã KT: <mã>`:
     - `PXNĐ-TPĐ 040` «Bạch tuộc NCLS bán nội địa 20-30»: **635**
     - `PXĐ.BTNL.TĐ 2022-144` «Đuôi bạch tuộc sống 2 da»: **384**
     - `PXĐ.BTNL.TĐ 015` (phần chênh) «Cổ bạch tuộc · điều chỉnh XNT»: **864**
   - Dòng `xlsx|K1000T|9|2026|175` (2 da 80up · Hồng Phú): xuất 5.952 → **6.312** (+360), thêm ghi chú `Điều chỉnh −360 theo XNT T10 (mã KT 1008)`. Đây là chỗ duy nhất sửa dòng có sẵn: một dòng điều chỉnh riêng sẽ âm. Nạp lại bảng kê T9 sẽ trả số này về 5.952.
   - Bảng sẽ báo cờ "lệch dồn kỳ" ở chỗ nối T8 và T9 cho 3 dòng `adj`. Đó là đúng sự thật: sổ cũ đã sót.
3. **Dồn tháng 9 → tháng 10** ("Dồn sang tháng sau"). Kiểm tồn đầu T10 của 34 mã khớp cột "Đầu T10 (PDF)" trong bảng dưới. Riêng 015 có hai dòng: 5.472 + 864.
4. **Tháng 10:** điền nhập/xuất theo bảng ánh xạ.
   - Thêm 4 dòng mã mới, nhóm Hàng tạm, id `adj|xnt-2026-10|<mã KT>`.
   - 015: xuất 5.472 ở dòng gốc và 864 ở dòng `adj`.
   - 1001: đặt Vị trí = Kho 1500 tấn.
5. **Kiểm sau ghi:**
   - Tổng 34 mã ở T10: đầu 229.812 · nhập 62.611 · xuất 100.950 · cuối 191.473.
   - Không dòng nào âm.
   - Lô Cân đối #119 (NL mua ngoài, xuất 15.000) không đổi.
   - Nhóm Hàng tạm T10 còn có cá (PXC) và 2 lô `cd|…` 10 + 20 kg: loại ra khi so với PDF.

## Gỡ / khôi phục

- Gỡ dòng thêm: lọc id bắt đầu `adj|xnt-2026-10|`, và `carry|adj|xnt-2026-10|` sau khi dồn. Xóa qua app (có Hoàn tác).
- Trả dòng #175 tháng 9 về xuất 5.952. Xóa nhập/xuất T10 đã điền theo file sao lưu. Bấm dồn T9 → T10 lại.
- Khôi phục toàn bộ: dựng lại từ file sao lưu bước 1. `audit_log` có số cũ và số mới cho từng lần ghi.

## Bảng ánh xạ 34 mã (PDF ↔ sổ kho tháng K1000T)

Cột "Dòng sổ" là hậu tố của id `carry|xlsx|K1000T|9|2026|<số>` (dòng tồn đầu T10 dồn từ T9). Đối chiếu trên DB thật 2026-11-06: 26 mã khớp tồn đầu, 2 mã lệch, 2 mã sổ thiếu, 4 mã mới.

| Mã KT | Đầu T10 (PDF) | Nhập | Xuất | Cuối | Dòng sổ (id) | Đầu T10 (sổ) | Việc |
|---|--:|--:|--:|--:|---|--:|---|
| `PXĐ.BTNL.TĐ 20023` | 66.936 | 26.904 | 30.000 | 63.840 | #144 Bạch tuộc 1 da đông xô · PHÁP | 66.936 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 1001` | 46.176 | 0 | 20.520 | 25.656 | #177 Bạch tuộc 2 da 250up · F34 | 46.176 | ghi xuất + Vị trí = Kho 1500 tấn |
| `PXĐ.BTNL.TĐ 568` | 0 | 13.248 | 0 | 13.248 | — |  | T10 thêm dòng «Bạch tuộc 1 da 40up» |
| `PXĐ.BTNL.TĐ 059` | 12.480 | 0 | 0 | 12.480 | #162 Bao tử bạch tuộc 2 da nhập 100-200 | 12.480 | không phát sinh |
| `PXĐ.BTNL.TĐ 0212` | 8.112 | 4.032 | 0 | 12.144 | #161 Bao tử bạch tuộc 2 da nhập 100up | 8.112 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 2001` | 23.304 | 11.286 | 24.000 | 10.590 | #145 Bạch tuộc 1 da đông xô · HỒNG PHÚ | 23.304 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 0219` | 9.024 | 0 | 0 | 9.024 | #155 Bao tử bạch tuộc 2 da còn cổ <100 | 9.024 | không phát sinh |
| `PXĐ.BTNL.TĐ 020` | 7.628 | 0 | 0 | 7.628 | #153 Bao tử bạch tuộc 2 da còn cổ | 7.628 | không phát sinh |
| `PXĐ.BTNL.TĐ 0211` | 6.624 | 0 | 0 | 6.624 | #159 Bao tử bạch tuộc 2 da nhập 50-100 | 6.624 | không phát sinh |
| `PXĐ.BTNL.TĐ 0090` | 6.271 | 168 | 0 | 6.439 | #164 Bao tử bạch tuộc mada | 6.271 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 0220` | 3.672 | 1.584 | 0 | 5.256 | #157 Bao tử bạch tuộc 2 da | 3.672 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 567` | 672 | 2.689 | 0 | 3.361 | #147 Bạch tuộc 1 da >30gr | 672 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 019` | 2.784 | 0 | 0 | 2.784 | #156 Bao tử bạch tuộc 2 da | 2.784 | không phát sinh |
| `PXĐ.BTNL.TĐ 002` | 0 | 2.280 | 0 | 2.280 | — |  | T10 thêm dòng «Bạch tuộc 1 da đông xô · F34» |
| `PXĐ.BTNL.TĐ 10046` | 2.080 | 0 | 0 | 2.080 | #170 Bạch tuộc 2 da râu rong rêu | 2.080 | không phát sinh |
| `PXĐ.BTNL.TĐ 0221` | 1.464 | 0 | 0 | 1.464 | #160 Bao tử bạch tuộc 2 da nhập 200-300 | 1.464 | không phát sinh |
| `PXĐ.BTNL.TĐ 20024` | 1.296 | 0 | 0 | 1.296 | #146 Bạch tuộc 1 da đông xô · P HOÀNG | 1.296 | không phát sinh |
| `PXĐ.BTNL.TĐ 10044` | 1.224 | 0 | 0 | 1.224 | #148 Bạch tuộc 1 da dạt màu | 1.224 | không phát sinh |
| `PXĐ.BTNL.TĐ 0101111` | 1.128 | 0 | 0 | 1.128 | #163 Bạch tuộc mada NL | 1.128 | không phát sinh |
| `PXĐ.BTNL.TĐ 0201` | 864 | 0 | 0 | 864 | #158 Bao tử bạch tuộc 2 da | 864 | không phát sinh |
| `PXNĐ-TPĐ 040` | 635 | 0 | 0 | 635 | — |  | T9 thêm dòng `adj` tồn 635 → dồn |
| `PXĐ.BTNL.TĐ 10045` | 384 | 0 | 0 | 384 | #169 Bạch tuộc 2 da râu rong rêu | 384 | không phát sinh |
| `PXĐ.HT 051` | 336 | 0 | 0 | 336 | #154 Bao tử bạch tuộc 2 da còn cổ | 336 | không phát sinh |
| `PXĐ.BTNL.TĐ 016` | 288 | 0 | 0 | 288 | #150 Cổ bạch tuộc mada | 288 | không phát sinh |
| `PXĐ.BTNL.TĐ 0138` | 0 | 220 | 0 | 220 | — |  | T10 thêm dòng «Bạch tuộc 2 da gửi luộc dính rêu dạt» |
| `PXĐ.BTNL.TĐ 0136` | 0 | 200 | 0 | 200 | — |  | T10 thêm dòng «Bạch tuộc 2 da gửi luộc dính rêu» |
| `PXĐ.BTNL.TĐ 2022-14` | 660 | 0 | 660 | 0 | #166 Đuôi bạch tuộc | 660 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 1006` | 4.368 | 0 | 4.368 | 0 | #176 Bạch tuộc 2 da 80up · F34 | 4.368 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 015` | 6.336 | 0 | 6.336 | 0 | #152 Cổ bạch tuộc | 5.472 | xuất 5.472 dòng gốc + 864 dòng `adj` (sau dồn) |
| `PXĐ.BTNL.TĐ 1008` | 11.064 | 0 | 11.064 | 0 | #175 Bạch tuộc 2 da 80up · HỒNG PHÚ | 11.424 | T9 dòng 175 xuất +360 ⇒ đầu T10 11.064; T10 xuất 11.064 |
| `PXĐ.BTNL.TĐ 2022-144` | 384 | 0 | 384 | 0 | — |  | T9 thêm dòng `adj` tồn 384 → dồn; T10 xuất 384 |
| `PXĐ.BTNL.TĐ 109` | 1.656 | 0 | 1.656 | 0 | #174 Bạch tuộc 2 da >80gr · F34 | 1.656 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 0166` | 408 | 0 | 408 | 0 | #151 Cổ bạch tuộc | 408 | điền nhập/xuất |
| `PXĐ.BTNL.TĐ 1009` | 1.554 | 0 | 1.554 | 0 | #178 Bạch tuộc 2 da 150up · BÉ 3 | 1.554 | điền nhập/xuất |

Ghép theo số và nghĩa tên, không theo chữ. Tên PDF và tên sổ khác nhau ở nhiều dòng (VD 1001 «100-UP … ô A19» ↔ «250up»).

## Đối chiếu Cân đối (2026-11-06)

- Tháng 10 chỉ có **một** kỳ Cân đối: «Bạch tuộc 2 da» 01–05/10 (nnttruc tạo 16/10, chưa chốt). Lấy xả đông **15.000 kg** từ lô `carry|xlsx|K1000T|9|2026|119` «Bạch tuộc 2 da 150up · T VY PHÁT», nhóm *Nguyên liệu mua ngoài*. Lô này không có trong PDF.
- Xuất PDF 100.950 kg nằm hết ở nhóm *Hàng tạm* ⇒ hai số **không bằng nhau và không đè lô**.
- Rủi ro còn lại: kỳ Cân đối sau 05/10 chưa ai tạo. Nếu sau này lấy xả đông từ lô *Hàng tạm* đã ghi xuất theo PDF thì sẽ **cộng đôi xuất**. Cần kế toán xác nhận xuất trong XNT đã gồm phần đó chưa.

## Lô 30 kg (Gửi đông của Cân đối)

- `cd|1792114507506-…-freeze-deposit|2026-10-01` (10 kg) và `…|2026-10-02` (20 kg), «Bạch tuộc 2 da lớn (80↑)», 150.000 đ/kg.
- **nnttruc** gõ ở dòng Gửi đông kỳ Cân đối 01–05/10, sáng 16/10 (04:27–04:31 giờ hệ thống), cùng một thiết bị. **admin** sau đó chỉ đổi nhóm: 20/10 sang NL mua ngoài, 27/10 sang Hàng tạm.
- Chờ nnttruc xác nhận. Nếu là số thử thì xóa dòng Gửi đông ở Cân đối (lô trong sổ tự gỡ). Lần nạp này không đụng.
