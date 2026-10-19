# Module Phòng Kế hoạch — Quản lý đơn hàng (đặc tả trước khi build)

> **Load khi:** chuẩn bị xây module Phòng Kế hoạch: hồ sơ đơn hàng, báo giá, hợp đồng/L/C, lệnh sản xuất, theo dõi tiến độ, đề nghị/lệnh xuất hàng có duyệt, chứng từ, lưu hồ sơ.
> **Trạng thái:** 🟨 **DỰ THẢO** — chưa build, chưa migration. Chờ phòng Kế hoạch xác nhận các mục ở §5 (họp). Sau khi chốt ⇒ viết `ba-spec` ở `app-map/` rồi mới thiết kế màn.
> **Nguồn:** quy trình công ty [`ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md`](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) (13 bước, 8 biểu mẫu, quy tắc KH-R1…R16) · sơ đồ xuất khẩu 6 bước chủ dự án gửi 2026-10-16 · code `/orders` đối chiếu 2026-10-19.
> **last_verified:** 2026-10-19

## 1. Vấn đề

Phòng Kế hoạch là bộ phận **mở và đóng** mọi đơn hàng: nhận yêu cầu, báo giá, ký HĐ/L/C, ra lệnh sản xuất, theo dõi, ra lệnh xuất, lập chứng từ, lưu hồ sơ ([QTI-KH-01](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md)). Phần mềm hiện chỉ có **khúc giữa**: đơn đặt (gom hàng) và lệnh xuất ở `/orders`. Hệ quả:

1. Đơn đặt trên app **không có gốc** (không biết từ HĐ nào, giá bao nhiêu, hạn xuất ngày nào) ⇒ không cảnh báo trễ được (KH-R11).
2. **Không có lệnh sản xuất** ⇒ xưởng ghi sản lượng không biết làm cho đơn nào (KH-R8, R9).
3. **Lệnh xuất tạo ra là đóng luôn, không qua BGĐ duyệt** — trái KH-R4 (`SalesOrderScreen.tsx`: `status: "closed"` lúc tạo, tự sinh phiếu bán XK).
4. Hồ sơ đơn hàng vẫn **kẹp giấy** (KH-R15), không tra được trên máy.

## 2. Trục dữ liệu: Hồ sơ đơn hàng

Theo bước 12 của quy trình: **một HĐ/L/C = một bộ hồ sơ**. (Thay cho giả định "lô hàng XK là trục" ở phân tích 2026-10-16.)

```
YÊU CẦU KHÁCH (sổ 01-01) ──► kết luận: được / hủy (lý do)
   └─► BÁO GIÁ (01-02) ── BGĐ duyệt ── gửi khách (lưu file đã gửi)
         └─► HỒ SƠ ĐƠN HÀNG = HĐKT hoặc L/C (01-03) ── BGĐ duyệt
               ├─ phụ kiện HĐ / tu chỉnh L/C (lưu kèm, không ghi đè)
               ├─ lịch xuất hàng (một hoặc nhiều đợt) ── gia hạn / giảm lượng + xác nhận khách
               ├─ ĐƠN ĐẶT (đã có, /orders): dòng mặt hàng × quy cách × kg × block  ← gắn vào hồ sơ
               ├─ LỆNH SẢN XUẤT (01-04) ──► Kỹ thuật · Kho · Phân xưởng
               ├─ tồn kho từng ngày của đơn (01-05) ← suy từ số đã có, không nhập tay
               ├─ ĐỀ NGHỊ XUẤT (01-06) ──► LỆNH XUẤT (01-07, đã có — thêm BGĐ duyệt) ──► Kế toán · Kho · PX Đông
               ├─ LIST THỰC XUẤT (01-08) ← dòng lệnh xuất theo lô + quét kiểm (đã có)
               ├─ chứng từ XK (số + file)
               └─ trạng thái: Đang hiệu lực → Đã xuất đủ → Đã lưu → Hết hạn lưu (2 năm)
```

## 3. Người dùng & điểm duyệt

| Người | Làm gì trên module | Ghi chú |
|---|---|---|
| Nhân viên phòng KH | ghi yêu cầu, lập báo giá, HĐ/L/C, lệnh SX, đề nghị xuất, lệnh xuất, chứng từ | owner của mọi bước trừ duyệt |
| BGĐ | **duyệt** Offer · HĐ/L/C · Lệnh xuất (KH-R4) | Nếu ký giấy (Q-QTI-2) ⇒ phòng KH ghi lại kết quả duyệt + file |
| Kỹ thuật · Kho · Phân xưởng | nhận lệnh SX (xem / xác nhận — Q-QTI-9) | |
| Kế toán · Kho · PX Đông | nhận lệnh xuất đã duyệt | Thủ kho thực xuất + quét kiểm lô như hiện tại |

## 4. Kế hoạch xây dựng (đề xuất, theo thứ tự quy trình)

| Đợt | Phạm vi | Bước QTI | Đụng module cũ | Tier |
|---|---|---|---|---|
| **1** | **Hồ sơ đơn hàng + Lệnh sản xuất.** Sổ yêu cầu khách · báo giá · HĐ/L/C (điều khoản, lịch xuất, phụ kiện/tu chỉnh, file) · BGĐ duyệt (hoặc ghi kết quả duyệt giấy) · gắn **đơn đặt có sẵn** vào hồ sơ · lệnh SX gửi 3 nơi | 1–8 | `/orders`: thêm liên kết đơn đặt → hồ sơ (cột mới, nullable — đơn cũ không hồ sơ vẫn chạy) | 🟡 bảng mới + cột nullable |
| **2** | **Theo dõi tiến độ.** Cần vs đã có theo lịch xuất (dùng lại phép đối chiếu của `/orders` + tồn kho) · cảnh báo nguy cơ trễ vào **Việc của tôi** (`/my-tasks`, thêm loại việc — không dựng cơ chế nhắc riêng) · ghi gia hạn / giảm lượng + xác nhận khách | 9–10 | `lib/myTasks.ts` + `lib/dataFlow.ts` (thêm loại cảnh báo, có test) | 🟡 |
| **3** | **Xuất hàng có duyệt.** Đề nghị xuất · lệnh xuất thêm trạng thái **chờ duyệt** trước khi đóng và trước khi sinh phiếu bán · in list thực xuất · chứng từ XK (số + file) | 11 | `/orders` + giá trị trạng thái mới của `export_orders` (nới CHECK, không đổi nghĩa trạng thái cũ) | 🟡 — thành 🔴 nếu phải đổi nghĩa / sửa dữ liệu lệnh xuất cũ |
| **4** | **Lưu & hết hạn hồ sơ** (đánh dấu, không tự xóa — Q-QTI-5) · báo cáo đơn hàng cho BGĐ · (nếu chốt) giá HĐ chảy sang Cân đối, tiền về | 12–13 | `balancingCalc.ts` chỉ khi chốt PA giá (C8) | 🟡 |

**Không làm:** khai hải quan (VNACCS), giao dịch ngân hàng, sổ kế toán — chỉ lưu số, ngày, file. **Không tính phí XK vào Cân đối** (giữ nguyên quy tắc cũ).

## 5. Điều cần chốt (cập nhật sau khi có QTI-KH-01)

**QTI-KH-01 đã trả lời — chỉ cần xác nhận còn đúng:**

| Mã cũ | Câu | QTI nói | Ảnh hưởng |
|---|---|---|---|
| C1 | Phòng KH ở đâu, làm bước nào | Phòng KH **của xí nghiệp BSF1** làm trọn: yêu cầu → báo giá → HĐ/L/C → lệnh SX → theo dõi → xuất hàng → chứng từ XK → lưu hồ sơ | Phạm vi = cả 4 đợt |
| C7 | Có lập kế hoạch/lệnh SX theo đơn | **Có**, lệnh SX viết sau khi HĐ/L/C duyệt | Đợt 1 |
| C12 | Việc không làm | Quy trình không nhắc book tàu, khai hải quan ⇒ giữ "chỉ lưu số + file" | Đợt 3 |

**Còn mở — hỏi trong họp:**

| Mã | Câu | Đề xuất SDVICO |
|---|---|---|
| Q-QTI-1…9 | Xem [QTI-KH-01 §6](../ho-so-nang-luc/qti-kh-01-quan-ly-don-hang.md) (hiệu lực, duyệt trên app hay giấy, HĐ gia công/môi giới, mẫu trống, hạn lưu, sổ kho, PX Đông, đơn nội địa, nơi nhận lệnh SX) | — |
| C2 | Book tàu, khai hải quan, giám định: tự làm hay thuê ngoài? | Thuê ngoài ⇒ chỉ lưu số + file |
| C4 | Một HĐ có mấy đơn, giao mấy đợt? | HĐ có lịch xuất nhiều đợt; mỗi đợt một lệnh xuất |
| C5 | Đơn vị tính trên HĐ: kg tịnh, thùng, mạ băng? | Lưu kg tịnh + số thùng + % mạ băng |
| C6 | Một lệnh xuất ứng với mấy container? | 1 lệnh xuất = 1 container (số cont, seal ghi vào chứng từ) |
| C8 | Giá HĐ có thay giá USD gõ tay ở Cân đối? | Có, kế toán sửa khi khác — làm ở đợt 4, chốt PA trước |
| C9 | Doanh số XK gốc: phiếu bán tự sinh hay invoice? | Giữ phiếu bán tự sinh, nhưng **chỉ sau khi lệnh xuất được duyệt** |
| C10 | Ai theo dõi tiền về? | Quy trình không có ⇒ đoán là kế toán; phòng KH chỉ xem |
| C11 | Ai xem giá, HĐ? | Phòng KH, kế toán, BGĐ; xưởng/kho không thấy giá |
| C13 | Dùng thử khi nào, ai? | Đợt 1 với 1–2 người phòng KH, song song giấy ~1 tháng |

## 6. Ràng buộc khi build (luật repo)

- Tên kỹ thuật **tiếng Anh** (luật 8) — tra từ điển §2b [`quy-uoc-dat-ten`](quy-uoc-dat-ten.md), thiếu thì bổ sung từ điển trước (hợp đồng, L/C, báo giá, lệnh sản xuất, đề nghị xuất, hồ sơ đơn hàng).
- **Migration mới từ `0072` trở lên** (`0071` đang do phiên khác giữ) — rà số với `origin` trước khi đặt; chỉ-thêm, idempotent, RLS ngay từ đầu, có câu lùi.
- Bảng mới ⇒ cùng commit: `TableMapping` (+ `refColumns` cho khóa ngoại), `DemoBundle` + `DemoPackLoader` + checklist demo (luật 15), `rowMarkKey` (luật 12), nháp form (luật 17), tài nguyên mới trong `lib/permissions.ts` mặc định cấm + hành động `approve` cho BGĐ ([`role-permissions`](role-permissions.md)).
- Nhắc hạn **dùng lại `/my-tasks`** ([`app-map/39`](../app-map/39-my-tasks.md)), không dựng chuông thứ hai.
- File chứng từ dùng Supabase Storage — chốt bucket/thư mục + dung lượng trước đợt 1.
