# Kế hoạch cutover — chạy dữ liệu thật từ 01/09/2026

> **Load khi:** chuẩn bị đưa hệ thống vào chạy thật; dựng tồn gốc; nhập số liệu cũ; làm import file/scan.
> **Nguồn quyết định:** [`hop-2026-08-22-so-hoa-flow-2-bo-phan.md`](hop-2026-08-22-so-hoa-flow-2-bo-phan.md) (QĐ-4, QĐ-5).
> **Vận hành kỹ thuật:** [`ops/supabase-setup.md`](../ops/supabase-setup.md) · [`ops/deploy-vercel.md`](../ops/deploy-vercel.md) · [`03-database.md`](../app-map/03-database.md).
> **last_verified:** 2026-08-22

---

## 1. Ba mốc dữ liệu (QĐ-4)

```
        30/06/2026            01/07 → 31/08/2026            01/09/2026 →
        ──────────            ─────────────────            ────────────
   BÁO CÁO TỒN KHO TỔNG   →   NHẬP LẠI THEO BÁO CÁO    →   CHẠY REALTIME HẰNG NGÀY
   (baseline / tồn gốc)       (số tổng T7 + T8)             (nhập + chốt mỗi ngày)
```

| Mốc | Là gì | Cách đưa vào hệ thống |
|---|---|---|
| **30/06/2026** | Tồn kho tổng gần nhất **đã chốt** — điểm gốc | Khai tồn đầu vào `material_opening_stock` (NL) + tồn đầu kho BTP/TP |
| **T7 + T8/2026** | Hai tháng chuyển tiếp | Nhập **theo dạng báo cáo** (tổng theo kỳ/tháng), **không** cần từng chứng từ ngày |
| **Từ 01/09/2026** | Vận hành thật | Mỗi bộ phận nhập + chốt hằng ngày (daily-task) |

**Nguyên tắc gối đầu:** tồn cuối kỳ trước = tồn đầu kỳ sau (đã có, `0020` + `inventoryMaterial.ts`). Vậy chỉ cần **khai đúng tồn 30/06** một lần, T7–T8 nhập báo cáo sẽ **cuốn** tồn tới 31/08, và 01/09 kế thừa tự động.

---

## 2. Vì sao 30/06 là baseline (không phải sớm hơn)

Báo cáo **tồn kho tổng** gần nhất mà xí nghiệp đã chốt là **30/06/2026**. Mọi mốc trước đó không có số chốt đáng tin để neo. Lấy 30/06 làm gốc thì:
- Số tồn đầu là **số kế toán đã ký**, không phải suy đoán.
- T7–T8 chỉ cần **khớp tổng** với báo cáo tháng đã có, dễ đối chiếu.
- 01/09 trở đi mới cần độ chi tiết từng ngày.

---

## 3. Trình tự cutover (checklist)

### Giai đoạn A — Hạ tầng (làm trước 01/09)
1. **Cutover Supabase** cho toàn hệ (đang chạy localStorage → dễ mất số). Theo [`ops/supabase-setup.md`](../ops/supabase-setup.md).
2. **Chạy đủ migration** `0001…0023` trên DB thật; mỗi file chạy **2 lần vẫn không lỗi** (idempotent) — xem [`03-database.md`](../app-map/03-database.md).
3. **Siết RLS** trước khi mở ra ngoài mạng nội bộ: `0021` + **bổ sung `material_opening_stock`** (hiện chưa nằm trong danh sách 23 bảng của `0021`) 🔴.
4. **Đổi mật khẩu admin** (seed `0007` là admin/admin) 🔴.

### Giai đoạn B — Nạp tồn gốc 30/06
5. Xin **file báo cáo tồn 30/06/2026** từ kế toán; xác định: mỗi họ nguyên liệu / mỗi kho tồn bao nhiêu kg.
6. Khai **tồn đầu nguyên liệu** vào `material_opening_stock` (`as_of_date = 2026-06-30`, `quantity_kg` thuần, theo site/workshop/`material_type_name`).
7. Khai **tồn đầu kho BTP/thành phẩm** (nếu báo cáo có tách) — cần chốt cơ chế ở [G3 của flow](flow-end-to-end-2-bo-phan.md).

### Giai đoạn C — Nhập T7 + T8 theo báo cáo
8. Với mỗi tháng: tạo **kỳ cân đối** theo họ nguyên liệu, nhập **số tổng** (NL vào, BTP ra, bán, đông gửi/xả đông) từ báo cáo tháng — **không** nhập từng chuyến ngày.
9. Đối chiếu **tồn cuối 31/08** hệ thống suy ra ↔ báo cáo tháng 8. Lệch → sửa số tổng, không sửa công thức.

### Giai đoạn D — Bật realtime 01/09
10. Từ 01/09, **tắt lối nhập-theo-báo-cáo**, mỗi bộ phận vào **daily-task** (nhập + chốt ngày).
11. Theo dõi **badge tồn âm** (xả đông vượt tồn) — dấu hiệu ghi chép sai, xử lý ngay.

---

## 4. Chức năng import: tay trước, file/scan sau (QĐ-5)

Thứ tự triển khai **có chủ đích**:

| Giai đoạn | Cách nhập | Trạng thái | Ghi chú |
|---|---|---|---|
| **1. Nhập tay thủ công** | Người dùng gõ trực tiếp trên màn | ✅ đã có (mọi màn THẬT) | **Làm trước hết** — chuẩn để đối chiếu |
| **2. Import file Excel** | Tải file báo cáo → map cột → nạp | ⏳ sau | Đã có tiền lệ đọc Excel: [`demo/cach-doc-excel.md`](../demo/cach-doc-excel.md), lib `nxtExcel.ts` |
| **3. Scan chữ viết tay** | Chụp/scan phiếu tay → OCR → điền sẵn ô nhập | ⏳ sau cùng | Người dùng vẫn **soát + sửa tay** trước khi chốt |

**Nguyên tắc chung cho import file/scan:**
- Import **không tự chốt** — nạp vào pha *nhập liệu (nháp)*, người dùng soát rồi mới **phát hành/chốt** (xem [bảng thuật ngữ](flow-end-to-end-2-bo-phan.md#6-bảng-thuật-ngữ-thao-tác-theo-flow)).
- Map cột Excel phải **hiện ra cho người xác nhận**, không map ngầm.
- Scan tay: OCR là **gợi ý**, không phải nguồn số cuối — luôn có ô sửa.

---

## 5. Rủi ro & lưu ý

| Rủi ro | Xử |
|---|---|
| Dữ liệu localStorage dễ mất khi preview reload | **Bắt buộc cutover Supabase (Giai đoạn A) trước 01/09** |
| RLS chưa bao `material_opening_stock` | Bổ sung vào `0021` trước khi mở ra ngoài mạng nội bộ 🔴 |
| Báo cáo 30/06 không tách đủ chiều (kho/họ NL) | Xin bản chi tiết; nếu chỉ có tổng → chốt quy tắc phân bổ với kế toán |
| Màn DEMO bị nhầm là thật khi chạy | Ẩn/gắn nhãn màn DEMO trước 01/09 ([G6 flow](flow-end-to-end-2-bo-phan.md)) |
| T7–T8 nhập báo cáo lệch tổng | Đối chiếu tồn cuối 31/08 ở bước 9 trước khi bật realtime |

---

## 6. Điều kiện "sẵn sàng 01/09" (Definition of Ready)

- [ ] Supabase đã cutover, migration `0001…0023` xanh, RLS siết (kể cả `material_opening_stock`), mật khẩu admin đã đổi.
- [ ] Tồn gốc 30/06 đã khai và đối chiếu khớp báo cáo.
- [ ] T7 + T8 nhập báo cáo xong, tồn cuối 31/08 khớp báo cáo tháng.
- [ ] Vai trò 2 bộ phận đã gán (`user_profiles`), route-guard + trang chủ theo vai trò đã bật.
- [ ] Màn DEMO đã ẩn/gắn nhãn; nhập tay là đường chính thức.
</content>
