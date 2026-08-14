# Kịch bản demo LIVE — Cân đối Bạch tuộc 2 da (hệ thật Supabase)

> Mục tiêu: khán giả thấy **hệ thống tính toán trực tiếp** khi thao tác — cao trào là nhập nốt vài dòng trên sân khấu để bảng cân đối **lật từ Lỗ sang Lãi** và **khớp đúng file giấy** (kỳ 21–25/07, các khách hàng thật).
>
> Chạy trên **hệ thật `:5173` (Supabase, có đăng nhập)** — dùng chung dữ liệu thủ công đã nhập trước đó. Dữ liệu demo nạp sẵn bằng file SQL; 2 dòng "chốt" cố ý để trống, nhập LIVE.

---

## A. Chuẩn bị TRƯỚC buổi demo (~15 phút, làm 1 lần)

### A1. Tìm `site_id` của hệ
Mở `.env` của dự án → xem dòng `VITE_SITE_ID`.
- Có giá trị → ghi lại (VD `site-bsf1`).
- Để trống → dùng `site-default`.

### A2. Kiểm tra Supabase đã có bảng (tránh nạp lỗi)
Supabase Dashboard → **SQL Editor** → chạy:
```sql
select count(*) from balancing_periods;
```
- Ra số (kể cả 0) → OK, các migration đã chạy, sang A3.
- Báo `relation "balancing_periods" does not exist` → **chưa chạy migration**. Chạy toàn bộ `supabase/migrations/0001 … 0017` trước, rồi làm lại A2. (Nếu không seed được Supabase, dùng **Phương án B** ở cuối.)

### A2b. Chạy migration 0018 (cho phép NL vào ÂM) — BẮT BUỘC
File cân đối có dòng NL âm ("Bán nội địa −987"). DB gốc chặn số âm (`check >= 0`) → seed sẽ lỗi `23514`. Chạy [`supabase/migrations/0018_nl_vao_cho_phep_am.sql`](../../supabase/migrations/0018_nl_vao_cho_phep_am.sql) trong SQL Editor 1 lần (idempotent). Đây là vá bug thật: app cho nhập NL âm nhưng DB đang chặn.

### A3. Nạp dữ liệu demo
1. Mở [`docs/demo/seed_bt2da.sql`](seed_bt2da.sql).
2. **Thay `__SITE_ID__`** bằng giá trị ở A1: trong SQL Editor bấm **Ctrl+H** → tìm `__SITE_ID__` → thay `site-default` (hoặc giá trị thật) → Replace All.
3. **Run**. Thấy "Success". (Chạy lại nhiều lần vẫn đúng — file tự xoá seed cũ trước.)

### A4. Kiểm tra trên app
1. `npm run dev` (hệ thật, port 5173) → đăng nhập.
2. Vào **Cân đối** → thấy kỳ **"Bạch tuộc 2 da"**. Mở ra: dưới cùng đang hiển thị **▼ Lỗ ~300 triệu** (đúng — vì cố ý còn thiếu 2 dòng, sẽ nhập live). Nếu thấy vậy = seed thành công, sẵn sàng.
3. Vào **Nhập hàng** → thấy 2 chuyến hôm nay (Bê 3, Hồng Phú, tổng 13.182 kg).

> ⚠️ Đừng nhập nốt 2 dòng chốt ở bước chuẩn bị — để dành nhập trên sân khấu.

---

## B. Kịch bản trình diễn (~10 phút)

### Mở đầu — 1 câu định khung (30 giây)
> *"Tổ trưởng chỉ ghi **kg** và **đơn giá**. Định mức, giá thành, lãi–lỗ là **hệ thống tự tính**. Tôi sẽ nhập vài dòng cuối để cả nhà thấy nó tính lại ngay."*

### Bước 1 — Nhập nguyên liệu (`/#/imports`) · cho thấy thao tác nhập
- Chỉ dải thống kê: **2 chuyến · 13.182 kg** hôm nay, đại lý **Bê 3 / Hồng Phú** (thật).
- Bấm **Ghi chuyến hàng** → thêm nhanh 1 dòng bất kỳ (VD *2 da nguyên liệu, 1.000 kg, 145.000*) → Lưu → chỉ cho khán giả thấy **tổng cột Thành tiền tự nhân, tổng ngày tự cộng**. (Xoá lại cũng được — mục đích khoe thao tác nhập nhanh.)
- Nói thêm: có **chốt ngày**, **ghi bù chờ hoá đơn**, **phế liệu cân trong ngày** (màn Cân đối hút lại, không nhập hai lần).

### Bước 2 — Mở kỳ Cân đối (`/#/balancing` → "Bạch tuộc 2 da")
Đi từ trên xuống, giải thích nhanh 3 khối:
- **Khối 1 — Nguyên liệu vào**: các dòng 2 da nl, hàng xả đông, bột phụ gia. *(đang thiếu 1 dòng — sẽ thêm)*
- **Khối 2 — Phế liệu**: nội tạng bán giá riêng.
- **Khối 3 — Bán thành phẩm ra**: các quy cách 2 da luộc/cắt chần/tẩm bột, **kênh Xuất khẩu, đơn giá USD**, gắn khách (Seachemot, Hanwa, Matsuda…). *(đang thiếu 1 dòng — sẽ thêm)*
- Kéo xuống **Kết quả**: chỉ vào ô đỏ **▼ Lỗ 300.352.479 đ**. Nói: *"Kỳ đang nhập dở nên tạm âm. Xem khi nhập nốt 2 dòng cuối."*

### Bước 3 — CAO TRÀO: nhập LIVE 2 dòng chốt, xem lật thành Lãi ⭐

**3a. Thêm dòng Nguyên liệu vào** (Khối 1 → *Thêm dòng nguyên liệu*):
| Trường | Nhập |
|---|---|
| Nhóm | Thủy sản |
| Tên nguyên liệu | **2 da nl nhỏ** |
| Số lượng | **16356** kg |
| Đơn giá | **137737** đ |

→ Lưu. Chỉ cho khán giả: **Tổng NL nhảy lên 63.926 kg**, Giá trị NL tăng.

**3b. Thêm dòng Bán thành phẩm ra** (Khối 3 → *Thêm dòng bán thành phẩm*):
| Trường | Nhập |
|---|---|
| Mặt hàng | **2 da luộc 230-250** |
| Khách hàng | **Hanwa** |
| Kênh bán | Xuất khẩu |
| Lượng | **11591** kg |
| Đơn giá | **10.43** USD |

→ Lưu. **Ngay lập tức** ô kết quả lật: **▼ Lỗ → ▲ Lãi 242.338.529 đ**, Tổng TP = 43.144 kg, Định mức 1,48.

> Câu chốt: *"Không ai bấm máy tính. Nhập kg với giá, hệ thống ra lãi liền."*

### Bước 4 — In bảng A4 = file giấy
- Bấm **"Xem / in bảng"** → bản in A4 bố cục giống sổ kế toán.
- Đặt cạnh file Excel *Bảng cân đối bạch tuộc 2 da* → đối chiếu. Cách đọc từng cột của file (kể cả cột ngày 22/07→29/07): [`cach-doc-excel.md`](cach-doc-excel.md).

| | Hệ thống | File giấy |
|---|---|---|
| Tổng NL | 63.926 kg | 63.926 ✅ |
| Tổng TP | 43.144 kg | 43.144 ✅ |
| Định mức | 1,48 | 1,48 ✅ |
| Giá trị xuất | 10.677.786.340 | khớp ✅ |
| Bình quân/kg NL | 3.791 | 3.791 ✅ |
| **Lãi** | **242.338.529** | 242.346.218 *(lệch 7.700đ = làm tròn đơn giá NL, 0,003%)* |

---

## C. Câu chốt cuối buổi
> *"Cùng bộ số này, làm tay trên giấy dễ sai tồn cuối kỳ và mất thời gian. Trên hệ thống: nhập kg + giá → cân đối, lãi–lỗ, bảng in ra ngay, đối chiếu khớp sổ."*

---

## D. Trục trặc thường gặp
| Hiện tượng | Xử lý |
|---|---|
| Kỳ **không hiện** sau khi seed | Sai `site_id`: giá trị trong SQL phải KHỚP `VITE_SITE_ID` của `.env` hệ :5173. Sửa rồi chạy lại SQL. |
| SQL báo `relation ... does not exist` | Chưa chạy migration → chạy `supabase/migrations/*` rồi seed lại (xem A2). |
| SQL báo `23514 ... check constraint ... so_luong_kg` | Chưa chạy migration **0018** (NL vào âm) → chạy 0018 (A2b) rồi seed lại. |
| Mặt hàng "2 da luộc 230-250" **không có** trong ô chọn | Seed products chưa vào → chạy lại `seed_bt2da.sql`. Hoặc gõ tên rồi bấm "Thêm mới" (hệ tự tạo). |
| Sau nhập 2 dòng **số không đúng file** | Kiểm lại: NL 16356@137737 (nhóm Thủy sản) + TP 11591@10.43 USD kênh Xuất khẩu, khách Hanwa. |
| Nhập hàng **trống** | Đổi ô ngày về hôm nay, xưởng Đông (seed đặt ngày = hôm chạy SQL; demo khác ngày thì sửa ngày hoặc chạy lại SQL). |

---

## E. Gỡ dữ liệu demo sau buổi (tuỳ chọn)
Trong `seed_bt2da.sql` có sẵn khối **CLEANUP** (cuối file, đang comment): bỏ comment, thay `__SITE_ID__`, Run → xoá sạch mọi dòng `seed-%`, không đụng dữ liệu thật.

---

## Phương án B (dự phòng) — demo localStorage, KHÔNG cần Supabase
Nếu không seed được Supabase (chưa chạy migration / không có quyền dashboard): demo bản localStorage `:5174`, không login.
- **Tạo file `.env.demolocal`** ở gốc repo (file này gitignore, KHÔNG có sẵn khi clone) với đúng 3 dòng — key để TRỐNG để tắt Supabase:
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  VITE_SITE_ID=site-demo
  ```
- Chạy: `npm run dev -- --mode demolocal --port 5174` → mở `/#/catalog` → F12 Console dán [`demo-seed.js`](demo-seed.js) → F5.
- Bản này seed **đầy đủ** kỳ (đã ra Lãi luôn). Muốn diễn màn Lỗ→Lãi như trên: trước khi demo, mở kỳ và **xoá tay** 2 dòng "2 da nl nhỏ" và "2 da luộc 230-250", rồi nhập lại LIVE theo Bước 3.
- Chi tiết thao tác từng màn: [`kich-ban-demo.md`](kich-ban-demo.md).
