> Load khi: sửa màn Bán hàng — phiếu bán, dòng bán, quy cách, ghi bù, hoặc hút bán vào cân đối.
covers: src/features/sales/SalesScreen.tsx, src/features/sales/BaoCaoBan.tsx, src/features/sales/BanHangTab.tsx, src/types.ts, src/lib/repo.ts
last_verified: 2026-08-10
ttl_days: 90
<!-- re-verified: 2026-08-07 — phiếu multi-line (phieuId), 2 ngày, seam hút banHangId khớp SalesScreen.tsx + BalancingScreen.tsx:389 -->

# Bán hàng (bán thành phẩm RA) hằng ngày

Số hóa sổ **bán hàng** — bán thành phẩm chế biến (bạch tuộc/mực) RA cho khách theo ngày. Sau khi bán, màn Cân đối **hút** bán theo khoảng ngày vào khối thành phẩm ra — nửa còn lại của bảng cân đối kỳ (nửa kia là nhập NL). Nav thứ 2 (giữa Nhập hàng và Cân đối).

## ⚠️ Thuật ngữ — tránh nhầm

- **Bán hàng** (màn này) = bán **thành phẩm RA** cho khách (đầu ra). Khối 3 bảng cân đối.
- **"Bán thành phẩm"** (bán-thành-phẩm, WIP) = **công đoạn SẢN XUẤT** ra sản phẩm dở dang, **cất kho dự trữ**, CHƯA bán. **KHÁC** bán hàng. Đây là mảng **chưa số hoá** — thuộc vòng lặp kho / đông gửi ↔ xả đông ↔ tồn cuối kỳ (backlog cốt lõi).
- Quy trình thật (chưa build): sản xuất bán thành phẩm ngày → **cất kho dự trữ** → gom đủ theo **đơn đặt** (khách đặt số lượng lớn) → **xuất container** (nhiều block, nhiều quy cách). `ban_hang.kho_nguon` để dành seam nối tồn kho.
- **Đơn đặt = xuất khẩu**; **phí xuất khẩu do phòng kế hoạch tính riêng, đã trừ trong giá báo → cân đối KHÔNG tính phí XK** (công thức `canDoi.ts` không có phí XK — đúng). Nhãn kênh hiện tại vẫn "Xuất khẩu / Nội địa" theo plan gốc (đã chốt); đổi thành "Đơn đặt" là việc tương lai nếu cần.

## State hiện tại

Đã có: phiếu bán (một khách, một lượt, nhiều mặt hàng) · 2 ngày (xuất bán / ghi sổ) + ghi bù có lý do · quy cách (size/grade) mỗi dòng · kênh Xuất khẩu (USD) / Nội địa (VND) trên phiếu · lọc theo kỳ (`lib/periodUtils.ts`) · sổ nhóm theo phiếu + tổng · sửa/xóa phiếu, sửa/bỏ dòng · **hút bán vào kỳ cân đối** (khối TP ra).

Chưa có (backlog): **chốt ngày bán** (bảng `chot_ngay` hiện chỉ dùng cho nhập — bán cần bảng chốt riêng, chưa làm); **phiếu bán in A4** riêng (bảng cân đối đã in được); **trừ tồn kho TP** khi bán (cột `kho_nguon` để dành, chưa dùng — chờ vòng lặp đông gửi/xả đông).

Bảng dùng: `phieu_ban`, `ban_hang`, đọc danh mục `mat_hang` / `khach_hang`. Migration `0005`.

**Hai tab** (bọc ở `BanHangTab.tsx`): **Sổ bán hàng** = màn ghi (`BanHang`) · **Báo cáo** (`BaoCaoBan`) = tổng bán theo kỳ, gom **khách × kênh**, trình bày bằng thẻ `ThongKe` + `BieuDoCot` (sản lượng theo khách) + `BangTong`. Giá trị để **riêng theo kênh** (Xuất khẩu USD ≠ Nội địa VND — không cộng thẳng, đúng bẫy §4); chỉ tổng kg gộp được (thẻ + chart chỉ dùng kg).

## Logic / Rules

### 1. Phiếu = một khách nhận hàng một lượt

Song song chuyến nhập: một khách nhận **nhiều mặt hàng ⇒ 1 `phieu_ban` + nhiều dòng `ban_hang`** cùng `phieu_id`.
Thuộc về phiếu: 2 ngày, phân xưởng, khách, **kênh**, ghi chú. Thuộc về dòng: mặt hàng, **quy cách**, kg, đơn giá.
⇒ Sửa một dòng chỉ đổi mặt hàng/quy cách/kg/giá. Đổi ngày/khách/kênh phải sửa ở đầu phiếu (nút "Sửa phiếu"), áp cho **mọi dòng**. Phiếu chỉ tạo khi có dòng đầu (không phiếu rỗng — `dongPhienLai` dọn phiếu rỗng khi đóng).

### 2. Hai ngày — như nhập hàng

`ngayGiao` (ngày xuất bán thật) dùng cho **mọi tổng hợp** + hút vào cân đối. `ngayGhiSo` chỉ để giải trình + nhãn "Ghi bù". `laGhiBuBan()` (`types.ts`) = `ngayGhiSo > ngayGiao`, bắt buộc lý do. Dòng `ban_hang.ngay` là bản chép của `phieu.ngayGiao` để lọc nhanh — sửa ngày phiếu phải cập nhật `ngay` mọi dòng con (đã xử ở `themDong`/`dongPhienLai`).

### 3. Quy cách (size/grade)

Mặt hàng bán = **thành phẩm + quy cách**. Tên trên sổ mẫu ẩn bớt phần thành phẩm vì cả bảng là một loại: "2 rau cắt sống 18-20" = thành phẩm *cắt 2 râu sống* + quy cách *18-20*. `ban_hang.quy_cach` là chuỗi tự do (VD "18-20", "1000-1300", "1.5g"); `mat_hang` giữ danh mục mở như cũ.

### 4. Kênh + đơn giá (bẫy hai kênh)

Kênh ở **phiếu**: Xuất khẩu ⇒ đơn giá **USD**, Nội địa ⇒ **VND**. Cùng một cột `don_gia`, đơn vị hiển thị đổi theo kênh (`donViGia`). Khi tính giá trị phải **quy tỉ giá**, KHÔNG cộng thẳng hai kênh — bẫy kinh điển của cân đối, xem [31-can-doi-ky.md](31-can-doi-ky.md).

### 5. Hút bán vào cân đối — COPY, chống trùng

Ở màn Cân đối, khối thành phẩm ra (`KhoiTP`) gợi ý hút các dòng bán có `phieu.ngayGiao` trong `[ky.tuNgay, ky.denNgay]`, **chưa hút vào kỳ nào**.

- Hút = **tạo dòng `thanh_pham_ra` mới** (bản sao: mặt hàng · khách · kênh · kg · đơn giá · quy cách), gắn `banHangId` = id dòng bán nguồn.
- Chống trùng: `banDaHut` = tập `banHangId` của mọi `thanh_pham_ra`; dòng bán đã có mặt thì không gợi ý lại.
- **Bỏ khỏi kỳ** = **XÓA bản sao** `thanh_pham_ra` (khác phế liệu — phế liệu chỉ gỡ liên kết vì bản gốc ở sổ nhập). Số gốc dòng bán ở `ban_hang` **không đụng**.
- Xóa kỳ: `thanh_pham_ra` của kỳ bị xóa theo (kể cả dòng hút) — sổ bán vẫn nguyên.

Khác phế liệu (gán `kyId` lên chính dòng gốc) vì `ban_hang` và `thanh_pham_ra` là **hai bảng khác**: hút phải sao chép, không gán liên kết.

## Edge cases

| Tình huống | Hành vi đúng |
|---|---|
| Khách / mặt hàng chưa có trong danh mục | Tạo ngay tại chỗ trong `Combobox`, lưu luôn vào danh mục + toast. |
| Đơn giá null | Hợp lệ — badge "Chưa có giá"; mọi nơi tính tiền `?? 0`. |
| Ghi phiếu ngày ngoài kỳ đang lọc | Màn tự kéo bộ lọc về ngày vừa ghi (`dongPhienLai`) — tránh tưởng mất phiếu. |
| Hút dòng bán rồi sửa giá ở sổ bán | Bản sao trong kỳ KHÔNG tự cập nhật (đã tách bảng). Bỏ khỏi kỳ rồi hút lại nếu cần số mới. |
| Nội địa (VND) và Xuất khẩu (USD) chung kỳ | Đơn vị đơn giá theo kênh từng dòng; giá trị xuất quy tỉ giá lúc tính (canDoi.ts). |

## Cross-references

- Kiểu + bất biến (`laGhiBuBan`, `thanhTienBan`, `PhieuBan`, `DongBan`): `src/types.ts`
- Bảng & migration `0005`: [03-database.md](03-database.md)
- Cách ghi dữ liệu, hàng chờ, bẫy `ghepLai`: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- Khối thành phẩm ra + hút phía cân đối: [31-can-doi-ky.md](31-can-doi-ky.md)
- Điều hướng 4 màn: [02-pages-navigation.md](02-pages-navigation.md)
