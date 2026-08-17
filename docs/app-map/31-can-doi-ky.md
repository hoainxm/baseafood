> Load khi: sửa màn Cân đối, công thức định mức/lãi lỗ, hay bảng in A4.
covers: src/features/balancing/BalancingScreen.tsx, src/features/balancing/BalancingTable.tsx, src/lib/balancingCalc.ts
last_verified: 2026-08-14
ttl_days: 90
<!-- re-verified: 2026-08-07 — công thức balancingCalc.ts + KhoiTP hút bán khớp source -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: lib canDoi.ts → balancingCalc.ts -->
<!-- fixed: 2026-08-10 — đối chiếu bảng cân đối bạch tuộc 2 da (21-25/07) thật: sửa "Bình quân/kg NL" = Lãi÷NL (trước tính nhầm Giá thành÷NL); đổi field avgCostPerKgMaterial→avgProfitPerKgMaterial. 8 chỉ số kia khớp tuyệt đối -->
<!-- updated: 2026-08-07 — khối 3 đổi nhãn "Bán thành phẩm sản xuất" (WIP làm ra ≠ bán ra); NL vào cho kg âm (bán nội địa); cờ nguonKho cho xả đông (migration 0008) -->

# Cân đối theo kỳ (xưởng Đông, "cân đối 5 ngày")

Trả lời câu: lô nguyên liệu này ra bao nhiêu thành phẩm, định mức bao nhiêu, lãi hay lỗ.

## State hiện tại

Đã có: CRUD kỳ · 3 khối (NL vào / phế liệu / TP ra) · thông số kỳ (tổng NL nhận, chi phí CB/kg TP, tỉ giá) · tính định mức + lãi/lỗ + tỉ lệ thu hồi · hút phế liệu từ sổ nhập · xem/in bảng A4.

Chưa có: quy tắc **chia NL cho từng bảng cân đối** (bảng phụ theo ngày là tổng NL nhận cả xưởng, mỗi bảng chỉ lấy phần đưa vào mặt hàng đó — cân riêng hay ước tính? **chưa chốt với xí nghiệp**); tên gọi chính thức của chỉ số ≈ 0,45; liên kết tự động sang sổ nhập cho khối NL vào (hiện **nhập tay**, chỉ phế liệu là hút).

Bảng dùng: `ky_can_doi`, `nguyen_lieu_vao`, `phe_lieu`, `thanh_pham_ra`, đọc `mat_hang` / `khach_hang` / `loai_nguyen_lieu`.

## Logic / Rules

### Kỳ = một lô, không phải một tuần

Một kỳ = **một loại NL** + **tập ngày tiếp nhận** của lô đó. Ngày có thể rời rạc; `tuNgay`/`denNgay` chỉ là cách chọn nhanh, `ngayList` là chuỗi để in (sinh từ khoảng ngày, bản cũ gõ tay).
**Thành phẩm có thể ra trễ hơn kỳ** — hệ thống vẫn cho nhập TP vào kỳ đã đóng ngày nhận NL. Đừng thêm ràng buộc "TP phải trong khoảng ngày".

### Công thức (`src/lib/balancingCalc.ts` — hàm thuần, không React)

```
Định mức        = Tổng NL vào (kg) ÷ Tổng TP (kg)        // ~1,09 với mực ống khay
Giá trị NL      = Σ kg × đơn giá
Giá trị xuất    = Σ (kg × đơn giá), dòng Xuất khẩu × tỉ giá
Giá thành       = Tổng TP × chi phí CB/kg + Giá trị NL
Lãi/Lỗ         = Giá trị xuất − Giá thành
Bình quân/kg NL = Lãi/Lỗ ÷ Tổng NL vào   // LÃI bình quân mỗi kg NL, KHÔNG phải giá thành/NL — khớp ô "Bình quân /kg nl" báo cáo giấy (VD 242.346.218 ÷ 63.926 ≈ 3.791)
Tỉ lệ thu hồi   = Tổng TP ÷ Tổng NL NHẬN (thông số kỳ, ≠ Tổng NL vào) — null nếu chưa khai
Giá trị phế liệu= Σ kg × đơn giá bán
```

- Chi phí CB, tỉ giá (mặc định 26.000 đ/USD), đơn giá NL: **nhập tay mỗi kỳ**, không tra tự động.
- Đơn giá TP là **USD nếu kênh Xuất khẩu, VND nếu Nội địa** — cùng một cột, quy tỉ giá lúc tính. Đây là nguồn sai số kinh điển: đừng cộng thẳng hai kênh.
- `tongNLNhan` (thông số kỳ) **khác** tổng NL vào của khối 1. NL vào = phần thật sự đưa vào mặt hàng này; NL nhận = tổng cả xưởng theo bảng phụ. Nhầm hai cái là hỏng tỉ lệ thu hồi.
- Chưa có TP ⇒ định mức và lãi/lỗ **chưa có nghĩa**, màn hình phải ẩn/ghi rõ thay vì hiện 0.

### Ba khối

1. **NL vào** — nhóm `Thủy sản` / `Xả đông` / `Bột phụ gia`. "Bột" là **phụ gia tẩm** (có cột tỷ lệ %), không phải phụ phẩm.
   - **Số lượng có thể ÂM** — dòng điều chỉnh giảm (VD "Bán nội địa −987": NL bán thẳng nội địa, không chế biến ⇒ trừ khỏi pool NL đưa vào sản xuất). Validate chỉ chặn `= 0`, không chặn âm. Tổng NL vào cộng cả dòng âm ⇒ khớp T.CỘNG của báo cáo gốc.
   - **Cờ nguồn kho** (`nguonKho`, chỉ hiện khi nhóm = `Xả đông`): `"Mua về"` (hàng cấp đông kho KHÁC bán về) / `"Kho mình"` (xả đông hàng kho mình) / `""` (chưa rõ). **Seam** cho quản lý tồn kho / vòng lặp đông gửi ↔ xả đông sau này — chưa dùng vào công thức. Lưu qua cột `nguon_kho` (migration `0008`); `repo.ts` chỉ gửi khi có giá trị ⇒ ghi NL vào chạy được **kể cả khi chưa chạy 0008**.
2. **Phế liệu** — nguồn thật là sổ nhập hàng, xem dưới.
3. **Bán thành phẩm sản xuất** (nhãn cũ "TP ra") — **bán thành phẩm LÀM RA trong kỳ** (cấp đông, cất kho lưu trữ, **CHƯA bán** — gom đủ đơn đặt mới xuất container). ≠ hàng đã bán ra ở màn Bán hàng. Mặt hàng (danh mục mở, ánh xạ lỏng sang 141 mã) × quy cách/size × khách (đơn đặt) × kênh. **Nhập tay** là đường chính cho báo cáo sản lượng. Seam **HÚT từ sổ bán** vẫn còn (dòng bán trong khoảng ngày → bản sao `thanh_pham_ra`, gắn `banHangId` chống trùng; bỏ kỳ = xóa bản sao, số gốc ở sổ bán) — dùng cho tình huống output=bán ra, sẽ tổ chức lại khi có module kho + bán hàng. Xem [33-ban-hang.md](33-ban-hang.md).

### Phế liệu: HÚT, không nhập lại

- `pheLieuChoHut` = dòng `nguon = "Nhập hàng"`, **chưa gắn kỳ**, ngày rơi trong `[tuNgay, denNgay]` của kỳ. Kỳ chưa khai ngày ⇒ gợi ý tất cả dòng chưa gắn.
- Hút = gán `kyId`. Gỡ khỏi kỳ = xóa `kyId`, **không xóa dòng**.
- **Xóa kỳ**: `nguyen_lieu_vao` + `thanh_pham_ra` của kỳ bị xóa theo; `phe_lieu` có `nguon = "Nhập hàng"` chỉ **gỡ liên kết** — số gốc thuộc về sổ nhập hàng. Dòng phế liệu nhập tay trong kỳ (`nguon = "Cân đối"`) thì xóa theo. Có Hoàn tác cho cả 4 danh sách.
- Khối phế liệu **không được coi là rỗng** khi còn dòng chờ hút — nếu không, lời mời "đưa phế liệu từ sổ nhập vào kỳ" bị ẩn đúng lúc cần nhất.

### Ghép lại danh sách con (bẫy mất dữ liệu)

`useNLVao/usePheLieu/useTPRa` trả **toàn bộ dòng của mọi kỳ**. `KyDetail` lọc theo `ky.id` để hiển thị, nhưng khi ghi phải `ghepLai()` với dòng của kỳ khác. Viết `ghiNL(dongCuaKyNay)` thẳng = **xóa sạch mọi kỳ khác**. Xem [04-tang-du-lieu.md](04-tang-du-lieu.md).

## Edge cases

| Tình huống | Hành vi đúng |
|---|---|
| Gõ loại NL mới trong ô chọn kỳ | Lưu luôn vào danh mục `loai_nguyen_lieu` + toast — không để tên mồ côi. |
| Đơn giá / tỉ giá / chi phí null | Coi như 0 khi tính (`?? 0`), nhưng hiển thị là "—", không phải `0 đ`. |
| Tổng TP = 0 | `dinhMuc = 0`, `tyLeThuHoi = null` nếu chưa khai `tongNLNhan`. Màn hình gắn cờ `chuaCoTP`. |
| Bảng in `BalancingTable.tsx` | **Ngoại lệ luật design-system** — `text-sm`, `uppercase`, màu `slate` cứng để khớp khổ A4, in bằng `window.print()`. Đừng áp luật UI vào file này, cũng đừng lấy nó làm mẫu cho màn mới. |
| Mặt hàng chưa ánh xạ mã 141 | Hợp lệ (`maTP` rỗng, hiện "Chưa ánh xạ"). Danh mục mặt hàng là **danh mục mở**. |

## Cross-references

- Sổ bán — nguồn hút cho khối TP ra: [33-ban-hang.md](33-ban-hang.md)
- Phế liệu nhập ở đâu: [30-nhap-hang.md](30-nhap-hang.md)
- Bẫy ghi đè danh sách: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- Thiết kế gốc + số kiểm chứng (mực ống khay 3.106 ÷ 2.856 ≈ 1,09): [`docs/trien-khai/plan-flow-can-doi-5-ngay.md`](../trien-khai/plan-flow-can-doi-5-ngay.md)
- Câu hỏi đã chốt / còn treo: [`docs/trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md`](../trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md)
