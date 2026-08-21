# Báo cáo bàn giao — cụm module Nhập hàng · Kho (Tồn NL) · Cân đối

> **Ngày:** 2026-08-21 · **Phạm vi:** 3 module lõi của vòng lặp nguyên liệu xưởng Đông.
> **Mục đích:** chốt mức độ hoàn thiện để bàn giao, chuẩn bị tuần sau sang module khác.
> Nguồn: đối chiếu code + docs app-map + chạy thử end-to-end với chứng từ thật ngày 16/08/2026.

## 1. Tóm tắt một dòng

Ba module **Nhập hàng → Cân đối → Tồn kho NL** đã **chạy khép vòng end-to-end** với dữ liệu thật: tờ nguyên liệu (12.980 kg) và tờ bán thành phẩm (3.270 kg, 9 mặt hàng) ngày 16/08 vào sổ, hút vào một kỳ cân đối, tồn kho suy từ chuyển kỳ. Quy tắc nghiệp vụ gộp BTP đã **chốt với kế toán và lưu thành chuẩn**. Còn 4 việc trước khi coi là "đóng" để chuyển module (mục 6).

## 2. Trạng thái từng module

### 2.1 Nhập hàng — ✅ đủ nghiệp vụ
- Chuyến thật (`import_shipments` + `material_imports`), tách **ngày hàng về / ngày ghi sổ** + ghi bù bắt buộc lý do, **chốt ngày** (ngày × xưởng, mở lại có lý do), **phế liệu cân gộp cuối ngày**, bộ lọc theo kỳ, **báo cáo kỳ** (thẻ + biểu đồ) + **phiếu A4 ngang**, đổi loại hàng loạt, tách size Bạch tuộc 2 da (0019).
- **Kiểm thử phiên này:** nhập chuyến thật Hồng Phú 16/08 (3 dòng · 12.980 đ) — hiển thị đúng ở sổ. ✓
- Doc: [30-nhap-hang.md](app-map/30-nhap-hang.md).
- Còn thiếu: người chốt / người ghi bù (chờ đăng nhập); màn xem lịch sử chốt/mở lại (dữ liệu đã đủ).

### 2.2 Cân đối — ✅ đủ nghiệp vụ, có bản in
- Lưới theo ngày, **hút sổ Nhập + sổ Sản xuất** (gán `balancing_period_id`, không chép số), **chuyển kỳ** (đông gửi/xả đông), **nhận chuyển kỳ** từ kỳ trước, **chốt kỳ** (0020), dòng Giảm → kho xưởng, xả đông, bột phụ gia, in A4, Ctrl+Z, dòng chẩn đoán khi kỳ trống.
- Công thức `balancingCalc.ts` **bất biến, đã kiểm chứng 100%** với bảng giấy (mẫu bạch tuộc 2 da 21–25/07: Lãi 242.346.218).
- **Quy tắc gộp báo cáo BTP ngày → mặt hàng cân đối: CHỐT với kế toán (chị Trúc) 21/08** — lưu ở [31-can-doi-ky.md § Gộp bán thành phẩm](app-map/31-can-doi-ky.md).
- **Kiểm thử phiên này:** tạo kỳ 16–21/08, hút **2 dòng nhập + 9 dòng sản xuất** → Định mức 3,86 (1 ngày nên cao, đúng kỳ vọng). ✓
- Còn thiếu: **đơn giá USD + khách** cho BTP (cần giá báo thật) để ra lãi/lỗ; 2 điểm treo với xí nghiệp (quy tắc chia NL cho từng bảng; định nghĩa chỉ số ≈ 0,45).

### 2.3 Tồn kho NL (NXT) — ✅ MỚI, đã chạy, cần hiệu chỉnh
- Sổ Nhập–Xuất–Tồn nguyên liệu = **kho đông dự trữ** của vòng gối đầu, **suy thẳng từ chuyển kỳ Cân đối** (đông gửi = +kho, xả đông = −kho), **kg thuần**. Màn `/nxt-nl`, hàm thuần `lib/inventoryMaterial.ts`, tồn đầu khai tay (`material_opening_stock`, migration **0022**).
- **Bộ dò lỗi thật:** tồn cuối < 0 = xả đông vượt tồn → badge + banner đỏ.
- **Kiểm thử phiên này:** đối chiếu 3 kỳ (tồn đầu 150 → chuỗi → tồn âm cảnh báo); khớp cột Chuyển kỳ của Cân đối tuyệt đối. Đã commit (`990e3f1`). ✓
- Doc: [31-can-doi-ky.md § Tồn kho nguyên liệu](app-map/31-can-doi-ky.md) · [04-tang-du-lieu.md](app-map/04-tang-du-lieu.md).
- Còn thiếu: **hiệu chỉnh v1 với một kỳ số thật** (dailyQuantities Thủy sản ghi ngược từ sổ nhập); hiện chỉ **xưởng Đông**; **RLS 0021 chưa bao** `material_opening_stock`.

## 3. Tầng dữ liệu & migration

- Một API `useBang` cho cả hai chế độ **Supabase ↔ localStorage** (env-gated); hàng chờ chống mất số liệu, hoà server↔local, `vaDongCu` vá dòng cũ. Vững — dùng chung cho cả 3 module.
- Bảng: 23 bảng nghiệp vụ (tên tiếng Anh sau `0016`) + **`material_opening_stock` mới (0022)**. Migration `0001`–`0022`.
- **Cần chạy trên DB thật:** `0022` (đã báo chạy); `0021` siết RLS **phải bổ sung** `material_opening_stock` vào danh sách trước khi mở ra ngoài mạng nội bộ.

## 4. Vòng lặp đã khép (chứng minh end-to-end)

```
Tờ 1 (NL nhập)  → sổ Nhập hàng → hút Khối 1 Cân đối
Tờ 2 (BTP ra)   → sổ Sản xuất  → hút Khối 2 Cân đối
Đông gửi/Xả đông (cột Chuyển kỳ Cân đối) → Tồn kho NL (/nxt-nl)
```
Đây chính là lời giải cho điểm đau số 1 — *tồn nguyên liệu cuối kỳ sai do ghi tay* — vì tồn suy từ sổ gốc, không chép tay.

## 5. Rủi ro / lưu ý đã biết

| Rủi ro | Chi tiết |
|---|---|
| Dữ liệu demo dễ mất | Toàn bộ số phiên này ở **localStorage** (đã mất một lần khi preview mở lại). **Chạy thật cần cutover Supabase**. |
| Định mức 1 ngày | Chỉ có nghĩa khi kỳ đủ ngày; 1 ngày cho số cao bất thường (đúng bản chất). |
| Chưa có test tự động | Backlog: vitest cho `balancingCalc.ts` + `inventoryMaterial.ts` (hàm thuần, dễ test nhất). |
| Tồn kho NL v1 | Quy tắc suy tồn chưa hiệu chỉnh với số thật — chỉ nằm ở `inventoryMaterial.ts`, dễ vá một chỗ. |

## 6. Cần làm trước khi "đóng" cụm để chuyển module

1. **Cutover Supabase** cho 3 module (persistence + đa máy) — [ops/supabase-setup.md](ops/supabase-setup.md).
2. **Hiệu chỉnh Tồn kho NL** với một kỳ số thật (đối chiếu tay).
3. **Nhập giá báo USD + khách** cho BTP để ra lãi/lỗ thật (khách điền được từ báo cáo ngày; giá chờ phòng kế hoạch).
4. **Cập nhật `docs/BAN-GIAO.md`** — đang lệch: ghi "vòng lặp đông gửi/xả đông CHƯA số hóa" và nav "3 mục", trong khi đã có Tồn kho NL + nhiều màn. (Đề xuất, chưa tự ghi đè.)

## 7. Assumptions (tier GREEN — báo cáo, không sửa code nghiệp vụ)

- Migration `0022` đã chạy trên DB thật (theo xác nhận của người dùng 21/08).
- Đơn giá USD BTP để trống trong demo (không bịa) ⇒ lãi/lỗ chưa tính là **đúng chủ đích**, không phải lỗi.
- Bạch tuộc 1 da (348 kg) không hút vào kỳ "Bạch tuộc 2 da" là **đúng** (khác họ) — cần kỳ riêng.

## 8. Cross-references
- [30-nhap-hang.md](app-map/30-nhap-hang.md) · [31-can-doi-ky.md](app-map/31-can-doi-ky.md) · [03-database.md](app-map/03-database.md) · [04-tang-du-lieu.md](app-map/04-tang-du-lieu.md) · [33-ban-hang.md](app-map/33-ban-hang.md)
- Mẫu cân đối thật: [docs/demo/cach-doc-excel.md](demo/cach-doc-excel.md) · [docs/demo/seed_bt2da.sql](demo/seed_bt2da.sql)
