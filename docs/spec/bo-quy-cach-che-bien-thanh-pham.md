# Đặc tả: Bộ quy cách × kiểu chế biến × nguyên liệu

- **Trạng thái:** Chiều B (kiểu chế biến) **ĐÃ BUILD v1** (`0024` + UI danh mục); Chiều C (quy cách chuẩn hoá) còn dự thảo — chờ chốt với xí nghiệp
- **Ngày lập:** 2026-08-22 · **Cập nhật:** 2026-08-23
- **Nguồn quyết định:** [`hop-2026-08-22-so-hoa-flow-2-bo-phan.md`](../trien-khai/hop-2026-08-22-so-hoa-flow-2-bo-phan.md) (QĐ-1, QĐ-7)
- **Đối chiếu:** [`32-danh-muc.md`](../app-map/32-danh-muc.md) (141 mã) · [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md) (quy cách là chiều khóa tồn) · `src/data/thanh-pham.json`

Tài liệu này đề xuất **cấu trúc dữ liệu để số hóa thành phẩm theo nhiều quy cách và kiểu chế biến** — điều kiện để đạt mục tiêu QĐ-1: *"cùng một mẻ nguyên liệu ra những quy cách/kiểu chế biến nào, mỗi thứ bao nhiêu"*.

---

## 1. Vấn đề: định danh thành phẩm đang gộp cứng

141 mã thành phẩm (TK 1551) hiện chỉ có 5 trường: `ma`, `ten`, `dvt`, `maTk`, `nhom`.
**Loài + kiểu chế biến + quy cách bị gộp hết vào chuỗi `ten`**, còn `ma` là chuỗi mờ:

| ma | ten | nhom |
|---|---|---|
| `BT-BOT5-10` | Bạch tuộc 2 da **tẩm bột** **5-10** | Bạch tuộc |
| `BTC1,2-1,8` | Bạch tuộc **cắt chần** **1,2-1,8** | Bạch tuộc |
| `BT.TIPLUOC` | Típ bạch tuộc **cắt luộc** | Bạch tuộc |
| `BT.NCLS` | Bạch tuộc **NCLS** | Bạch tuộc |

Chỉ `nhom` (họ nguyên liệu) là có cấu trúc. Hệ quả: **không lọc/tổng hợp được theo "kiểu chế biến" hay "quy cách"** — trong khi doc `34` yêu cầu **quy cách là chiều khóa cứng của tồn kho** (đơn xuất khẩu đặt theo size, giá theo size).

---

## 2. Đề xuất: tách 3 facet

Mỗi thành phẩm = tổ hợp của **3 chiều độc lập**:

```
THÀNH PHẨM = NGUYÊN LIỆU/LOÀI  ×  KIỂU CHẾ BIẾN  ×  QUY CÁCH
             (material family)     (process)         (size/spec)
```

### 2.1 Chiều A — Nguyên liệu / loài (`material_family`)
Bám cột `nhom` sẵn có + biến thể xử lý:
- **Bạch tuộc** (mặc định khi không ghi loài): **1 da** / **2 da** (2 da = đã qua xử lý điện).
- **Mực**: mực ống, mực nang…
- **Cá**, **Ghẹ**, **Bào ngư** (greenlip / tiger)…

Quy ước neo (giữ nguyên [`BAN-GIAO` §6](../BAN-GIAO.md)): không ghi loài ⇒ **bạch tuộc**; **"80 trên = lớn / 80 dưới = nhỏ"** (~80 g/con) để định giá.

### 2.2 Chiều B — Kiểu chế biến (`process`)
Tập giá trị (chuẩn hóa từ 141 mã hiện có — **cần xí nghiệp xác nhận đủ/thiếu**):

| Mã gợi ý | Kiểu chế biến | Ghi chú |
|---|---|---|
| `nl` | Nguyên liệu (chưa chế biến) | Dòng NL vào, không phải TP |
| `ncls` | Nguyên con làm sạch | |
| `luoc` | Luộc | |
| `chan` | Chần | |
| `cat` | Cắt | |
| `cat-luoc` | Cắt luộc | Tổ hợp công đoạn |
| `cat-chan` | Cắt chần | Tổ hợp công đoạn |
| `tam-bot` | Tẩm bột | "Bột" = phụ gia tẩm (có tỷ lệ %), **không** phải phụ phẩm |
| `tam-gia-vi` | Tẩm gia vị | |

> Đây là danh mục **mở** — thêm kiểu mới tại chỗ như các danh mục khác. Một số công đoạn chồng nhau (cắt→luộc) nên chế biến có thể là **chuỗi công đoạn**; bản v1 dùng nhãn gộp ("cắt luộc") cho khớp sổ giấy, cấu trúc "chuỗi công đoạn" để dành.

### 2.3 Chiều C — Quy cách (`spec` / size)
Chuỗi size hoặc khoảng size, **là chiều khóa cứng của tồn** (doc `34`): `5-10`, `230-250`, `1,2-1,8`, `18-20`, grade… Có thể kèm **đơn vị đếm** (g/con, con/kg) tùy loài.

---

## 3. Ánh xạ vào schema hiện có (không đập đi làm lại)

Bảng `products` (`mat_hang`) đã có sẵn đường bám (đối chiếu code 2026-08-23):
- `products.material_type_id` (`0015`) → **Chiều A** (nguyên liệu / loại NL).
- `products.category` (`0014`, tên cũ `loai`, đổi ở `0016`) → **nhóm LOÀI** (Bạch tuộc/Mực/Cá/Tôm/Bào ngư/Khác) — UI gọi là ô "Loài". **KHÔNG** phải kiểu chế biến; đừng tái dùng cho Chiều B.
- `products.processing_type` (**`0024` — ĐÃ THÊM**) → **Chiều B** (kiểu chế biến). Combobox "Kiểu chế biến" ở tab Mặt hàng (danh mục mở, thêm tại chỗ): Nguyên con làm sạch · Luộc · Chần · Cắt · Cắt luộc · Cắt chần · Tẩm bột · Tẩm gia vị.
- **Quy cách** (Chiều C) hiện là chuỗi tự do: `spec` free-text ở dòng bán (`33-ban-hang.md` §3), hardcode `""` ở dòng sản xuất `/wip`. **Chưa chuẩn hoá** → đề xuất nâng thành trường có kiểm soát (bảng `spec_sets` + `products.spec_set_id`) là bước sau, thay đổi lớn hơn.

`finished_goods` (141 mã TK 1551) **giữ nguyên làm mã kế toán** (khóa `code`); 3 facet là **lớp phủ phân loại** trên `products`, ánh xạ **lỏng** sang 141 mã (được phép "chưa ánh xạ") — đúng nguyên tắc [`32-danh-muc.md`](../app-map/32-danh-muc.md).

> **Rủi ro (🟡 YELLOW):** thêm 3 facet là *đổi hình dạng master data*. Làm theo tier YELLOW: migration **chỉ-thêm-cột**, viết sẵn câu `drop` để lùi, vá dòng cũ `vaDongCu` (facet rỗng = "chưa phân loại"). Không đổi khóa `finished_goods.code`.

---

## 4. Vì sao tách facet mở khóa được nghiệp vụ

| Có 3 facet ⇒ làm được | Không có ⇒ kẹt |
|---|---|
| "Mẻ bạch tuộc 2 da hôm nay ra: luộc 230-250 = X kg, cắt chần 1,2-1,8 = Y kg" | Chỉ thấy tổng, không tách chế biến/size |
| Tồn kho theo **quy cách** (khóa cứng doc `34`) | Tồn gộp, không khớp đơn XK theo size |
| Gộp báo cáo BTP ngày → mặt hàng cân đối theo **grade/công đoạn** ([`31` § Gộp BTP](../app-map/31-can-doi-ky.md)) | Gộp thủ công, dễ sai |
| Giá theo size/khách | Không neo được giá |

---

## 5. Việc cần xác nhận trước khi build

1. **Danh mục kiểu chế biến** ở §2.2 — đủ chưa, còn kiểu nào (xưởng Cá, xưởng Khô khác xưởng Đông)? *(đã build danh mục mở, xí nghiệp bổ sung tại chỗ được)*
2. **Quy cách có ràng kg/block cố định** hay hoàn toàn tự do (treo từ doc `34`)?
3. ~~`products.loai` hiện chứa gì~~ ✅ **đã rõ:** là `category` = nhóm LOÀI (không phải chế biến); Chiều B nay dùng cột riêng `processing_type` (`0024`).
4. Ánh xạ **141 mã ↔ (A×B×C)** — mã nào ra tổ hợp nào; mã nào là NL không phải TP. *(nhập dần qua UI danh mục; chưa backfill hàng loạt)*

Khi chốt xong: cập nhật [`32-danh-muc.md`](../app-map/32-danh-muc.md) + [`03-database.md`](../app-map/03-database.md), rồi mới viết migration.
</content>
