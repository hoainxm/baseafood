# Kế hoạch: kho + tồn + bán thành phẩm (WIP) — CHƯA BUILD

> Ghi 2026-08-06 từ trao đổi với chủ dự án. Đây là **vấn đề cốt lõi** của xí nghiệp (vòng lặp gối đầu), build ở **session riêng sau** với SPEC. Doc này giữ dữ kiện để không hỏi lại.

## 1. Thuật ngữ — tránh nhầm (đã sửa nhầm 2026-08-06)

- **Bán thành phẩm (WIP, dang dở)** = sản phẩm còn trong **khuôn đá**, chưa đóng gói. Khi làm **không hết nguyên liệu vào trong ngày** → cấp đông theo **block** → hôm sau **xả đông làm tiếp**.
- **Thành phẩm (hoàn chỉnh)** = đã **tách khỏi khuôn đá → đóng gói cấp đông → sẵn sàng bán**.
- **Hai trạng thái tổ chức RIÊNG** (không gộp) — WIP đông block vs thành phẩm đóng gói.
- **Bán hàng** (màn đã build, [33-ban-hang.md](../app-map/33-ban-hang.md)) = bán **thành phẩm RA** cho khách — KHÁC hai cái trên.

## 2. Luồng nghiệp vụ

```
NL vào ngày ──► chế biến
   ├─ làm HẾT ──► thành phẩm đóng gói ──► tồn (kho, sẵn sàng bán) ──► bán theo đơn đặt
   └─ KHÔNG hết ─► cấp đông BLOCK (WIP) ──► tồn kho ──► hôm sau/kỳ sau XẢ ĐÔNG làm tiếp
```

- Vòng gối đầu: block đông gửi kỳ này → **xả đông** thành **NL vào** kỳ sau (khối "Xả đông" ở NL vào của cân đối — [31-can-doi-ky.md](../app-map/31-can-doi-ky.md) đã có seam này).
- **Tồn cuối kỳ** = block/thành phẩm chưa dùng/chưa bán.

## 3. Mô hình dữ liệu (đã chốt hướng, chi tiết khi build)

- **Kho**: danh mục **nhiều kho** (to + nhỏ) + **phân loại kho** (VD đông WIP / lưu trữ thành phẩm / …). Lọc + báo cáo theo loại.
- **Đơn vị tồn**: **cả block + kg** — mỗi **block** = một **quy cách**, có số **kg**; tồn = số block **và** tổng kg.
- **Trạng thái tồn**: WIP (block đông, dang dở) vs Thành phẩm (đóng gói, sẵn sàng bán) — hai loại tồn riêng.
- **Kỳ tồn đầu/cuối**: theo **bộ lọc tùy chỉnh người dùng chọn** (`src/lib/ky.ts` — ngày/tuần/tháng/năm/tùy chọn), có **mặc định** một kiểu (chốt khi build), chỉnh lại sau.
- Mọi nhập/tồn/xuất gắn **kho** + **trạng thái**.

## 4. Ngoài scope phase đầu (làm sau)

- **Đơn đặt hàng**: quản lý đầy đủ (khách · số lượng cam kết · tiến độ gom đủ). Hiện **chỉ cần phiếu bán** ([33-ban-hang.md](../app-map/33-ban-hang.md)); đơn đặt thêm sau.
- **Container**: 1 container = nhiều block/nhiều quy cách. Hiện phiếu bán nhiều dòng là đủ; entity container thêm sau.
- **Đơn đặt = xuất khẩu**; **phí xuất khẩu do phòng kế hoạch tính riêng** (đã trừ trong giá báo) ⇒ cân đối **KHÔNG** tính phí XK (công thức hiện tại đúng, không đổi).

## 5. Công thức cân đối — GIỮ NGUYÊN (đã chốt Q13-16)

```
Định mức = Tổng NL ÷ Tổng TP
Giá thành = Tổng TP × chi phí CB/kg + Giá trị NL
Giá trị xuất = Σ(TP × đơn giá USD) × tỉ giá (dòng nội địa giữ VND)
Lãi/Lỗ = Giá trị xuất − Giá thành
```
Code `src/lib/canDoi.ts` đã khớp — **không sửa** khi làm kho.

## 6. Phase đề xuất (khi build session sau)

| Phase | Việc |
|---|---|
| A | Danh mục **kho** (có loại) + bảng **tồn** (block + kg, theo kho, theo trạng thái WIP/thành phẩm) |
| B | Ghi **cấp đông block** (WIP) + **xả đông** (xuất block làm tiếp) hằng ngày |
| C | Nối tồn ↔ **cân đối**: xả đông → NL vào; **tồn đầu/cuối kỳ** theo bộ lọc, hiển thị hợp lý |
| D | **Đơn đặt** + **container** |

## 7. Còn chốt khi build (chưa hỏi)

- Mặc định "kỳ tồn" là kiểu nào (ngày? tháng?).
- Xả đông chọn block theo **FIFO** hay tay?
- Đóng gói chuyển WIP → thành phẩm: ai ghi, khi nào, có phiếu không?
- Quy cách chuẩn: mỗi quy cách có kg/block cố định hay tự do?
- Đông gửi ↔ xả đông có phí lưu kho / hao hụt cần ghi không?

## Cross-references
- Thuật ngữ + màn bán ra: [33-ban-hang.md](../app-map/33-ban-hang.md)
- Cân đối kỳ, khối Xả đông, công thức: [31-can-doi-ky.md](../app-map/31-can-doi-ky.md)
- Bối cảnh vòng lặp gối đầu: [`README.md`](README.md) · [`CLAUDE.md`](../../CLAUDE.md) backlog
