# Kịch bản demo — Nhập nguyên liệu → Cân đối kỳ (Baseafood MES)

> Giao cho dev trình diễn báo cáo. Dữ liệu mẫu trích từ **2 file Excel thật**: *Bảng cân đối bạch tuộc 2 da* và *Báo cáo Nguyên Liệu–Bán Thành Phẩm 2025*. Mục tiêu buổi demo: chứng minh **dữ liệu nhập tay → hệ thống tự tính ra cân đối/lãi–lỗ**, không còn bấm máy tính tay.

---

## 0. Chuẩn bị (làm TRƯỚC buổi demo ~10 phút)

1. Máy đã `git clone` repo + `npm install` xong.
2. Chạy app **chế độ demo** (tắt Supabase → không hỏi đăng nhập, dùng localStorage):
   ```bash
   npm run dev -- --mode demolocal --port 5174
   ```
   (Hoặc trong Claude Code: preview config **`baseafood-demo`**.)
3. Mở Chrome: `http://localhost:5174/#/catalog`
   → thấy màn **Danh mục**, **không** hỏi đăng nhập. Bước này tự nạp 141 mã thành phẩm.
4. Nạp dữ liệu demo: nhấn **F12** → tab **Console** → dán **toàn bộ** nội dung file
   [`docs/demo/demo-seed.js`](demo-seed.js) → **Enter** → hiện `✅ SEED OK`.
5. Nhấn **F5** để reload. Xong — sẵn sàng demo.

> ⚠️ Dữ liệu nằm trong localStorage của trình duyệt máy demo. Đổi máy/đổi trình duyệt/xoá cache ⇒ chạy lại bước 3–5. Script **chạy lại bao nhiêu lần cũng đúng** (idempotent) và tự đặt ngày nhập hàng = ngày hôm demo.

---

## 1. Mở đầu — phân biệt "nhập tay" vs "máy tính ra" (nói 30 giây)

| Người dùng NHẬP TAY | Hệ thống TỰ TÍNH (không ai gõ) |
|---|---|
| Nguyên liệu vào: tên, **kg**, **đơn giá** | Tổng NL, giá trị NL |
| Thành phẩm ra: mặt hàng, khách, **kg**, **đơn giá USD**, kênh | Tổng TP, giá trị xuất |
| Thông số kỳ: **tỉ giá**, **chi phí chế biến/kg** | **Định mức · Giá thành · Lãi/Lỗ · Bình quân/kg NL** |

Câu chốt: *"Tổ trưởng chỉ ghi kg và giá. Toàn bộ định mức, giá thành, lãi–lỗ là hệ thống tính — thứ trước đây kế toán làm tay và hay sai."*

---

## 2. Trình diễn theo 3 màn

### Màn 1 — Nhập nguyên liệu · `/#/imports`

- Mở màn. Nhìn dải thống kê trên cùng: **Số chuyến 2 · Số dòng 4 · Tổng nhập 13.182 kg**.
- Chỉ **Chuyến 1 — Bê 3** (6.689 kg) và **Chuyến 2 — Hồng Phú** (6.493 kg): *"hai đại lý thật, số kg lấy từ báo cáo nhập ngày."*
- Mở bảng dòng của một chuyến — chỉ cột **Thành tiền** (VD 2 da: 5.298 kg × 145.000 = 768.210.000 đ) *"tiền = kg × đơn giá, tự tính."*
- Nói thêm (không cần bấm): có **chốt ngày**, **ghi bù chờ hoá đơn**, **phế liệu cân trong ngày** — phế liệu này màn Cân đối hút lại, không nhập hai lần.

### Màn 2 — Danh mục · `/#/catalog`

- Lướt 5 tab: **Mặt hàng · Khách hàng · Đại lý · Loại nguyên liệu · Thành phẩm (141 mã)**.
- Tab **Thành phẩm**: 141 mã kế toán (TK 1551) có sẵn.
- Tab **Mặt hàng**: có các quy cách bạch tuộc 2 da (2 da luộc 230-250, cắt chần 700-750…) — *"mặt hàng dùng khi ghi thành phẩm ra ở bảng cân đối."*
- Tab **Khách hàng** (Seachemot, Hanwa, Matsuda…) và **Đại lý** (Bê 3, Hồng Phú…): *"gõ mới tại chỗ là lưu ngay vào danh mục, không nhập tự do lung tung."*

### Màn 3 — Cân đối kỳ · `/#/balancing` → mở kỳ **"Bạch tuộc 2 da"** ⭐ (đỉnh demo)

Đây là màn quan trọng nhất. Mở kỳ, đi từ trên xuống:

1. **Thông số kỳ**: Tỉ giá 26.000 · Chi phí chế biến 30.000 đ/kg (nhập tay).
2. **Khối 1 — Nguyên liệu vào**: 11 dòng (2 da nl lớn/nhỏ, hàng xả đông, bột phụ gia). Tổng cuối khối: **63.926 kg · 9,14 tỷ**. Chỉ dòng *Bán nội địa −987* để giải thích *"số âm = điều chỉnh giảm, trừ khỏi pool nguyên liệu."*
3. **Khối 2 — Phế liệu**: 1 dòng (nội tạng 820 kg) bán giá riêng.
4. **Khối 3 — Bán thành phẩm ra**: 24 dòng, kênh **Xuất khẩu**, đơn giá **USD**. Tổng **43.144 kg**.
5. **Kết quả cân đối** (kéo xuống dưới cùng — đọc to từng dòng):

   | Chỉ tiêu | Giá trị | Ý nghĩa |
   |---|---|---|
   | Tổng nguyên liệu vào | 63.926 kg | Σ khối 1 |
   | Tổng bán thành phẩm | 43.144 kg | Σ khối 3 |
   | **Định mức chế biến** | **1,48** | NL ÷ TP — bao nhiêu kg NL ra 1 kg TP |
   | Giá trị nguyên liệu | 9.141.127.811 đ | Σ(kg × giá NL) |
   | Giá thành | 10.435.447.811 đ | tiền NL + TP × 30.000 |
   | Giá trị xuất | 10.677.786.340 đ | Σ(kg × giá USD) × tỉ giá |
   | **▲ Lãi** | **242.338.529 đ** | Giá trị xuất − Giá thành |
   | Bình quân/kg NL | 3.791 đ | Lãi ÷ NL |

6. Nhấn **"Xem / in bảng"** → bản in **A4** bố cục giống hệt sổ giấy → *"đây là tờ kế toán vẫn làm tay, giờ hệ thống in ra sẵn."*

---

## 3. Câu chốt cuối buổi (flow logic)

> *"Nhập hàng cho kg + giá nguyên liệu. Ghi thành phẩm ra cho kg + giá bán. Hệ thống tự ráp thành bảng Cân đối: định mức, giá thành, lãi–lỗ. Cùng bộ số này, làm tay dễ sai tồn cuối kỳ; hệ thống cho ra ngay và in được."*

---

## 4. Đối chiếu với file Excel thật (nếu ai hỏi "số có đúng không")

Mở file *Bảng cân đối bạch tuộc 2 da* cạnh màn hình (cách đọc từng cột: [`cach-doc-excel.md`](cach-doc-excel.md)):

| | Hệ thống | File giấy |
|---|---|---|
| Tổng NL | 63.926 kg | 63.926 ✅ |
| Tổng TP | 43.144 kg | 43.144 ✅ |
| Định mức | 1,48 | 1,48 ✅ |
| Giá trị xuất | 10.677.786.340 | khớp ✅ |
| Bình quân/kg NL | 3.791 | 3.791 ✅ |
| Lãi | 242.338.529 | 242.346.218 (lệch 7.700đ = làm tròn đơn giá NL, 0,003%) |

Nếu bị hỏi về khoản lệch 7.700đ: *"do làm tròn đơn giá nguyên liệu về số nguyên; nhập đơn giá đầy đủ số lẻ là khớp tuyệt đối."*

---

## 5. Trục trặc thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Hiện màn **Đăng nhập** | Chạy nhầm instance có Supabase (:5173) | Phải chạy `--mode demolocal --port 5174`, mở đúng `:5174` |
| Màn **Nhập hàng trống** | Đang xem sai ngày | Script đã đặt nhập = hôm nay; nếu vẫn trống, đổi ô "Ngày hàng về xưởng" về hôm nay, xưởng **Đông** |
| Cân đối **không có dòng nào** | Chưa chạy seed, hoặc mở sai kỳ | Chạy lại `demo-seed.js`, mở đúng kỳ "Bạch tuộc 2 da" |
| Danh mục **thiếu 141 thành phẩm** | Chưa mở `/#/catalog` trước khi seed | Mở `/#/catalog`, rồi chạy lại script |
| Muốn **làm lại từ đầu** | | Console: `localStorage.clear()` → F5 → mở `/#/catalog` → chạy lại script |

---

## 6. Dọn sau demo (tuỳ chọn)

Demo không đụng git/Supabase/.env — không bắt buộc dọn. Nếu muốn gỡ hẳn cấu hình demo:
- Xoá file `.env.demolocal` và mục `baseafood-demo` trong `.claude/launch.json`.
- Dừng server `:5174`.
