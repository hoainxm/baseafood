# Truy xuất theo lô bằng QR — phân tích & thiết kế

covers: src/lib/truyXuatLo.ts, src/lib/inventory.ts, src/features/qr/**, src/features/shared/GanLoDauVao.tsx, src/features/shared/KhungQuetQr.tsx, src/features/shared/QrTemLoIn.tsx, src/features/shared/useDuLieuTruyXuat.ts, src/features/production/KhoiLoPhien.tsx, src/features/orders/KiemLoXuat.tsx, supabase/migrations/0046_lot_inputs.sql, supabase/migrations/0049_label_prints.sql, supabase/migrations/0056_lot_dispatches.sql
last_verified: 2026-10-08
<!-- re-verified: 2026-10-08 10:05 — §4.1 ba loại lô S/W/P (truyXuatLo.nutLo/nhanLo*), §6c (meChuaGanLo · duyetTheoTem · KiemLoXuat · label_prints) khớp code trước khi build đợt 2b; §8 dòng RLS đã LỆCH (sửa, xem .escaped-drift.log). -->

> **Trạng thái:** ĐỢT 1 ĐÃ BUILD (2026-09-18) · **đợt 1b in tem hàng loạt + 2a sổ in tem / nhắc gắn lô / quét ở kho & xuất ĐÃ BUILD (2026-10-02, §6b–6c)** · **đợt 2b khép vòng tới khách ĐÃ BUILD (2026-10-08, §6d) — mig `0056` ✅ đã chạy trên DB thật 2026-10-08** · đợt 3 là đề xuất · §7 câu 4 đã chốt, còn 4 câu chờ xưởng.
> **Loại:** phân tích các hệ thống/chuẩn QR truy xuất + thiết kế áp dụng cho Baseafood.
> **Code:** `src/lib/truyXuatLo.ts` (+ `truyXuatLo.e2e.test.ts` kịch bản mẫu §9) · `src/lib/inventory.ts` (trừ tồn theo lô gắn) · `src/features/qr/{QrTraCuuScreen,InTemHangLoat,GiaiDoanTruyXuat,ThuHoiLo}.tsx` · `src/features/shared/{GanLoDauVao,KhungQuetQr,QrTemLoIn,useDuLieuTruyXuat}` · `src/features/production/KhoiLoPhien.tsx` · `src/features/orders/KiemLoXuat.tsx` · migration `0046_lot_inputs.sql` (✅ đã chạy 2026-09-18) · `0049_label_prints.sql` (✅ 2026-10-02) · `0056_lot_dispatches.sql` (✅ 2026-10-08).

> Nối tiếp họp [2026-09-02](../trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md) **QĐ-6** (định danh lô + QR)
> và **NR-6** (đã build in tem + màn quét). Ăn khớp "cấp lô" ở [`import-xnt-kho-cutover.md`](import-xnt-kho-cutover.md)
> và khóa tồn "mặt hàng × quy cách × **lô** × kho × trạng thái" ở [`34-btp-san-xuat-kho`](../app-map/34-btp-san-xuat-kho.ba-spec.md).

## 1. Bài toán

Mục tiêu thật của truy xuất: khi **khách, cơ quan thuế, hay đoàn kiểm tra** hỏi về một lô, trả lời được hai câu:

- **Truy ngược:** thùng thành phẩm này làm từ mẻ nào, mẻ đó ăn nguyên liệu của lô nào, của đại lý nào, về ngày nào.
- **Truy xuôi:** lô nguyên liệu này (vd bị nghi nhiễm) đã đi vào những mẻ nào, thành phẩm nào, xuất cho ai — để **thu hồi đúng phạm vi**, không phải thu hồi cả tháng.

Và trả lời **nhanh** (FDA đòi xuất hồ sơ trong 24 giờ — §2.4), bằng dữ liệu máy, không lục sổ tay.

### Hiện trạng (kiểm trong code 2026-09-18)

| Khâu | Bảng | Có trỏ về lô không? |
|---|---|---|
| Nhập NL | `import_shipments` + `material_imports` | ✅ `lot_code` trên chuyến (mig `0035`), dòng NL trỏ `shipment_id` |
| **Sản xuất BTP** | `production_wips` | ❌ chỉ ngày · xưởng · mặt hàng · kg — **không biết đã ăn lô NL nào** |
| **Đóng gói TP** | `packagings` | ❌ chỉ mặt hàng vào → mặt hàng ra |
| Xuất theo đơn | `export_items` | ✅ trỏ `wip_id` — mối nối xuôi duy nhất |
| Bán lẻ | `sales_items` | ❌ chỉ kho nguồn |

Hai vấn đề cụ thể:

1. **Chuỗi đứt ngay bước nhập → sản xuất.** Đây chính là "không truy được *mẻ nào ăn nguyên liệu của lô nào*" — pain point số 2 của buổi họp 02/09.
2. **Mã lô hiện tại không dùng làm khóa được.** `Đ-260902-01` (xưởng + ngày + số thứ tự) — code ghi rõ *"trùng cũng không sao"*. Hai máy cùng ghi chuyến lúc mất mạng là ra hai lô cùng mã. Quét QR mà ra hai lô thì truy xuất vô nghĩa.

## 2. Các hệ thống / chuẩn đang dùng QR để quản kho & truy xuất — rút ra gì

### 2.1 GS1 + GS1 Digital Link — "QR là một đường link"

GS1 là hệ mã chuẩn toàn cầu: **GTIN** (mặt hàng), **GLN** (địa điểm), **SSCC** (đơn vị vận chuyển: thùng/pallet), và các "AI" gắn thêm như **AI 10 = số lô**, AI 17 = hạn dùng, AI 3103 = khối lượng tịnh.
**GS1 Digital Link** đưa các mã đó vào **một URL** đặt trong QR, dạng `https://<tên miền>/01/<GTIN>/10/<LÔ>`.

**Áp dụng:** QR của mình cũng là **một đường link**. Công nhân lấy **camera điện thoại bất kỳ** quét là mở thẳng trang "hộ chiếu lô" trong app — không cần mở app trước, không cần cài gì. Khi sau này có GTIN / mã quốc gia thì đổi dạng link, tem cũ vẫn đọc được (§4.3).

### 2.2 EPCIS 2.0 — mọi thứ quy về "sự kiện"

EPCIS (chuẩn GS1 dùng cho truy xuất) mô tả chuỗi cung ứng bằng **4 loại sự kiện**, mỗi sự kiện trả lời *Cái gì · Khi nào · Ở đâu · Vì sao · Ai*:

| Sự kiện EPCIS | Nghĩa | Ở Baseafood là |
|---|---|---|
| Object Event | một lô được nhận / cất / chuyển / xuất | nhập chuyến, nhập kho, xuất đơn |
| **Transformation Event** | **đầu vào biến thành đầu ra** | **mẻ SX ăn lô NL → ra lô BTP**; **đóng gói ăn lô BTP → ra lô TP** |
| Aggregation Event | gom thùng lên pallet / tách ra | đóng thùng, xếp pallet (sau) |
| Transaction Event | gắn vào chứng từ mua/bán | phiếu bán, hóa đơn |

**Rút ra quan trọng nhất:** muốn có **cây gia phả lô** chỉ cần ghi đúng **sự kiện biến đổi** — "mẻ này ăn lô nào, bao nhiêu kg". Các sự kiện khác app **đã có sẵn bảng** (chuyến nhập, phiếu SX, phiếu đóng gói, lệnh xuất). Nên việc thêm vào là **ít hơn nhiều** so với dựng lại cả hệ.

### 2.3 GDST 1.2 — chuẩn riêng ngành thủy sản

GDST (Global Dialogue on Seafood Traceability) là EPCIS đã được "may đo" cho thủy sản: quy định **khâu nào phải ghi gì** (CTE — sự kiện then chốt; KDE — dữ liệu then chốt): đánh bắt/thu hoạch, lên bờ, **tiếp nhận**, **chế biến**, lưu kho, vận chuyển. Dữ liệu trao đổi bằng JSON-LD.

**Áp dụng:** dùng làm **danh mục kiểm** "khâu này đã đủ dữ liệu chưa" (§5), và là hướng xuất dữ liệu nếu khách Mỹ/EU đòi file GDST. **Không** dựng máy chủ EPCIS/GDST ngay — quá nặng cho nhu cầu hiện tại.

### 2.4 FDA FSMA 204 — nếu có đơn đi Mỹ

Quy định truy xuất thực phẩm của FDA; **cá, giáp xác, nhuyễn thể nằm trong danh sách bắt buộc**. Hạn tuân thủ đã **lùi từ 20/01/2026 sang 20/07/2028**.
Ba yêu cầu then chốt:

- **Mã lô truy xuất (TLC)** gán ngay **khâu tiếp nhận đầu tiên trên bờ** (với thủy sản), và **giữ nguyên** qua mọi khâu sau.
- Khâu **biến đổi** (chế biến) sinh **TLC mới**, và phải **nối về các TLC đầu vào**.
- Xuất được hồ sơ truy xuất **trong 24 giờ** khi FDA yêu cầu.

FDA **không quy định định dạng** TLC — chỉ cần đủ để nối ngược chuỗi. → Mã nội bộ của mình **đủ tư cách** làm TLC.

### 2.5 Việt Nam — TT 02/2024/TT-BKHCN + TCVN 13274:2020

**Thông tư 02/2024/TT-BKHCN** (hiệu lực 01/06/2024) quy định quản lý truy xuất nguồn gốc sản phẩm; mã truy vết phải theo **TCVN 13274:2020**, bộ tiêu chuẩn dựa trên GS1. Ba nguyên tắc của TCVN 13274:

1. **Duy nhất** — một mã chỉ trỏ đúng một đối tượng.
2. **Không mang nghĩa** — mã không nên "nhét" thông tin mô tả vào trong.
3. **Tương thích quốc tế** (GS1).

**Áp dụng:** thứ nằm **trong QR** phải là mã **duy nhất**, trỏ thẳng một bản ghi. Còn mã **đọc được cho người** (`Đ-260902-01`, `PXC.CNL.NK.2023-1133` kiểu kế toán đang dùng) vẫn giữ — nhưng chỉ là **nhãn in trên tem**, không làm khóa. Ô SSCC / mã quốc gia giữ như QĐ-10: chừa ô, có mã thì điền.

### 2.6 Hệ quản lý kho (WMS) thực tế — cách người ta vận hành bằng QR

| Thói quen WMS | Làm gì | Áp dụng ở Baseafood |
|---|---|---|
| **Quét khi nhận** | dán tem lúc hàng vào, quét xác nhận | ✅ đã có: in tem ở Nhập hàng |
| **Quét khi lấy vào SX** | quét tem lô → tự gắn lô cho mẻ | ⬅️ **đợt này** |
| **QR vị trí** (kệ, phòng đông) | quét vị trí + quét lô = cất/chuyển | đợt 2 (đã có danh mục `storage_locations`) |
| **LPN / SSCC thùng–pallet** | mỗi thùng/pallet một mã, gom bằng quét | đợt 3 (Aggregation) |
| **FEFO / FIFO gợi ý** | máy gợi ý lấy lô cũ trước | đợt 2 (spec 34 đã chốt "FIFO gợi ý + cho ghi đè") |
| **Cân bằng khối lượng** | kg vào − kg ra − hao hụt = 0 theo lô | ⬅️ **đợt này**: hiện trên hộ chiếu lô |
| **Kiểm kê bằng quét** | đi quét từng tem, máy so tồn | đợt 2 |

**Cạm bẫy riêng hàng đông** (họp 02/09): **tem giấy bong khi xả đông**, một thùng dính 2–3 nhãn. Nên:

- Luôn cho **gõ tay mã / chọn từ danh sách** song song với quét — không để công việc tắc vì tem hỏng.
- In lại tem được bất cứ lúc nào, từ hộ chiếu lô.
- Tem nhựa tái dùng hay máy in tem tại chỗ là quyết định phần cứng của xưởng — thiết kế này **chạy được với cả hai** (§7).

## 3. Nguyên tắc áp dụng cho Baseafood

1. **Không đổi cách làm đang chạy.** Không thêm cột vào bảng cũ, không bắt buộc trường mới. Chưa gắn lô thì mọi màn vẫn chạy y như cũ.
2. **Chỉ ghi thêm đúng một thứ còn thiếu:** sự kiện biến đổi (bảng `lot_inputs`). Mọi thứ khác **suy ra** từ bảng đang có.
3. **QR chứa mã duy nhất, dạng đường link.** Mã đọc được cho người chỉ là nhãn.
4. **Quét, gõ, hoặc chọn** — ba đường nhập ngang hàng.
5. **Không đòi kg nếu chưa cân.** EPCIS cho phép "không rõ số lượng". Gắn lô trước, kg bổ sung sau. Có kg thì hộ chiếu lô tính được cân bằng khối lượng.
6. **Chỉ áp cho lô mới.** Không gắn lô ngược cho dữ liệu cũ (sổ thật — xem §8).

## 4. Mô hình

### 4.1 Ba loại lô — dùng đúng bản ghi đang có

| Loại | Là bản ghi nào | Mã trong QR | Nhãn in cho người |
|---|---|---|---|
| **NL** (nguyên liệu) | một chuyến nhập `import_shipments` | `S:<id chuyến>` | `lot_code` hiện có, vd `Đ-260902-01` |
| **BTP** (bán thành phẩm) | một dòng sản xuất `production_wips` | `W:<id>` | suy ra: `BĐ-260918-7F3A` |
| **TP** (thành phẩm) | một phiếu đóng gói `packagings` | `P:<id>` | suy ra: `TĐ-260918-C21B` |

Nhãn BTP/TP **suy ra** từ loại + xưởng + ngày + đuôi id — **không lưu**, nên không phải thêm cột, và luôn khớp bản ghi.

### 4.2 Bảng mới duy nhất: `lot_inputs` — sự kiện biến đổi

Mỗi dòng = "đầu ra X đã dùng đầu vào Y (bao nhiêu kg)":

| cột | nghĩa |
|---|---|
| `output_kind`, `output_id` | `W` + id mẻ SX · hoặc · `P` + id phiếu đóng gói |
| `input_kind`, `input_id` | `S` + id chuyến (lô NL) · hoặc · `W` + id mẻ SX (lô BTP) |
| `input_label` | nhãn lô **lúc ghi** (chụp lại, để còn tra được kể cả khi nguồn bị sửa/xóa) |
| `material` | loại NL / mặt hàng (tùy chọn) |
| `quantity_kg` | kg đã dùng — **NULL = chưa cân** |
| `method` | `quet` / `go` / `chon` — biết tỷ lệ công nhân thật sự quét |
| `operator`, `recorded_at` | ai, lúc nào (KDE "Who/When") |

```mermaid
flowchart LR
  S1["Lô NL<br/>Đ-260902-01<br/>(chuyến nhập)"] -->|lot_inputs<br/>120 kg| W1["Lô BTP<br/>BĐ-260903-7F3A<br/>(mẻ SX)"]
  S2["Lô NL<br/>Đ-260902-02"] -->|lot_inputs<br/>80 kg| W1
  W1 -->|lot_inputs| P1["Lô TP<br/>TĐ-260905-C21B<br/>(đóng gói)"]
  W1 -->|export_items.wip_id<br/>(đã có)| X1["Lệnh xuất<br/>→ khách"]
```

### 4.3 Nội dung QR

```
https://<tên miền app>/#/qr?lo=W:9f1c…7f3a
```

- Camera điện thoại quét → mở thẳng hộ chiếu lô.
- Tên miền **lấy lúc in** từ chính địa chỉ đang chạy app (không ghi cứng trong code).
- Máy quét trong app đọc được **cả ba dạng**: đường link mới · `W:<id>` trần · **mã lô trần của tem cũ** (`Đ-260902-01`). Tem đã in từ trước **vẫn dùng được**.
- Mã lô cũ mà trùng (hai chuyến cùng mã) thì hộ chiếu **liệt kê cả hai** cho người chọn — không bao giờ tự chọn bừa một cái.

### 4.4 Hộ chiếu lô (màn `/qr`)

Quét hoặc gõ → một trang gồm:

1. **Lô này là gì**: loại, nhãn, mặt hàng / NL, kg, ngày, xưởng, đại lý, SSCC, người ghi.
2. **Truy ngược**: cây các lô đầu vào (nhiều tầng: TP → BTP → NL → đại lý, xe, ngày về).
3. **Truy xuôi**: cây các lô đầu ra (NL → mẻ SX → đóng gói / lệnh xuất → khách).
4. **Cân bằng khối lượng** (lô NL): nhận X kg · đã đưa vào SX Y kg · còn Z kg. Âm = dùng quá số nhận → cảnh báo.
5. **In lại tem**.

## 5. Dữ liệu tối thiểu mỗi khâu (đối chiếu GDST / FSMA 204)

| Khâu (CTE) | Dữ liệu then chốt (KDE) | Đã có | Còn thiếu |
|---|---|---|---|
| **Tiếp nhận NL** | mã lô · loài/loại · kg · đại lý · ngày về · xe · xưởng · người ghi | ✅ đủ | vùng khai thác, tàu, ngày đánh bắt (GDST — hỏi đại lý, đợt 3) |
| **Chế biến (SX BTP)** | mã lô đầu ra · **mã lô đầu vào + kg** · mặt hàng · ngày · xưởng · người | mọi thứ trừ đầu vào | **lô đầu vào ← đợt này** |
| **Đóng gói TP** | lô ra · **lô BTP vào** · quy cách · kg · số thùng | mọi thứ trừ đầu vào | **lô đầu vào ← đợt này** |
| Lưu kho | lô · vị trí · ngày vào · trạng thái đông | một phần (duyệt "chờ nhập") | vị trí quét QR (đợt 3) |
| **Xuất / bán** | lô · khách · ngày · kg · chứng từ | xuất đơn ✅ (`wip_id` + quét kiểm lưu ở `lot_dispatches`) · bán lẻ + bán nội địa ✅ (`lot_dispatches`, đợt 2b) | — |

## 6. Lộ trình

| Đợt | Nội dung | Đụng DB |
|---|---|---|
| **1 — nối chuỗi (build ngay)** | bảng `lot_inputs` · thư viện `truyXuatLo` · **hộ chiếu lô** truy ngược/xuôi + cân bằng kg · QR thành đường link (đọc được tem cũ) · **gắn lô NL cho mẻ SX** + **gắn lô BTP cho đóng gói** (quét / gõ / chọn) · in tem BTP/TP | 🟡 thêm 1 bảng |
| 2 — vận hành kho | QR vị trí phòng đông (cất/chuyển bằng quét) · FIFO gợi ý lô cũ khi gắn lô · bán lẻ gắn lô · kiểm kê bằng quét | 🟡 thêm bảng sự kiện kho |
| 3 — chuẩn hóa ra ngoài | mã quốc gia / SSCC khi được cấp · báo cáo thu hồi "một nút, 24 giờ" · xuất file GDST/EPCIS cho khách Mỹ/EU · dữ liệu khai thác (tàu, vùng) | 🟡 |

## 6b. Đợt 1b — một chỗ in tem (build 2026-10-02)

**Vì sao:** người dùng báo "không tìm thấy chỗ in QR". Kiểm 2026-10-02 ra ba nguyên nhân chồng nhau:
(1) nút in tem ở Nhập hàng chỉ hiện khi chuyến có `lot_code`, mà cả 69 chuyến trên server đều `lot_code` NULL ⇒ ẩn sạch;
(2) bỏ tab "Sổ ngày" 21/09 dời nút vào Báo cáo → Sổ chi tiết; (3) hướng dẫn "?" của `/qr` vẫn chỉ tab "Sổ ngày" đã bỏ.

**Đã làm (không đụng DB):**

| Việc | Ở đâu |
|---|---|
| Nút in tem NL hiện cho **mọi chuyến có đầu chuyến**; thiếu mã lô dùng nhãn suy `nhanLoNl` (`NĐ-yymmdd-xxxx`) | `imports/BuocNhap.tsx`, `MaterialImportScreen.tsx` |
| `/qr` có 2 tab: **Tra lô** · **In tem hàng loạt** (`?tab=in`; link `?lo=` luôn mở Tra). Lọc khoảng ngày · xưởng · loại lô (NL/BTP/TP), mặc định chọn hết, bỏ tick lô không in, in một lượt | `features/qr/InTemHangLoat.tsx` + `dsLoDeIn` (`lib/truyXuatLo.ts`, test `truyXuatLo.test.ts`) |
| `PhieuInTem` nhận `tems[]`: mỗi tem **một trang đúng khổ** (`break-after: page`), portal vào `<body>` để lúc in ẩn hết app (khỏi in thừa nhãn trắng) | `design-system/patterns/PrintSheet.tsx` |
| `TemLoQr` nhận `nuts[]`; tem NL dựng qua `nutLo` ⇒ có **loại hàng + tổng kg** (trước chỉ "nguyên liệu", 0 kg) | `features/shared/QrTemLoIn.tsx` |
| Lưu xong chuyến / mẻ SX (cả lượt) / phiếu đóng gói ⇒ toast có nút **In tem** (`notify.daLuu(msg, undo?, thaoTac?)`) | 3 màn + `design-system/patterns/notify.ts` |
| Nhãn nav "Quét mã lô" → **"Mã lô QR"**; viết lại hướng dẫn "?" | `AppShell.tsx`, `guideContent.tsx` |

**Đợt 2a đã build tiếp — xem §6c.**

> ⚠️ Thực tế 2026-10-02: `lot_inputs` = 0 dòng, `packagings` = 0 dòng trên server — chuỗi truy xuất chưa được dùng. Chuyến nhập sau 26/08 chưa lên server (thiếu cột 0040) nên tab In tem hàng loạt trên máy khác chưa thấy các lô NL đó cho tới khi hàng chờ máy người nhập đẩy xong.

## 6c. Đợt 2a — biết lô nào có tem, nhắc gắn lô, quét ở kho & khi xuất (build 2026-10-02)

| Việc | Ở đâu | Đụng DB |
|---|---|---|
| **Sổ in tem** `label_prints` (mig `0049`): bấm In trong `PhieuInTem` (`onIn`) ⇒ mỗi lô một dòng `{lot_kind, lot_id, label đông cứng, copies, operator, printed_at}` | `TemLoQr` ghi qua `banGhiIn` · `BANG_LABEL_PRINT` · `useLabelPrints` | 🟡 thêm 1 bảng, RLS authenticated ngay từ đầu (bất biến 0047) + trigger ghi vết 0048 |
| Tab In tem hàng loạt: nhãn **Đã in N tem · ngày / Chưa in tem** từng lô + ô **"Chỉ lô chưa in tem"** | `InTemHangLoat.tsx` + `tomTatIn` | — |
| Hộ chiếu lô: "Đã in N tem, lần gần nhất … · người in" / "Chưa in tem"; **cảnh báo "Nhãn đã đổi"** khi nhãn in trên tem ≠ nhãn suy hiện tại (sửa ngày/xưởng sau khi in — QR vẫn đúng vì theo id) | `QrTraCuuScreen.tsx` | — |
| **Nhắc gắn lô NL khi chốt ngày SX**: hộp chốt liệt kê mẻ của ngày·xưởng chưa có `lot_inputs`, nút "Gắn lô NL" từng mẻ. **CHỈ NHẮC, không chặn** (§7 câu 4 còn treo) | `WipProductionScreen.tsx` (`meChuaGanLo`) | — |
| **Quét tem để duyệt nhập kho**: khối "chờ nhập kho" ở `/warehouse` có quét camera / gõ mã ⇒ mở thẳng hộp duyệt đúng mẻ; mẻ đã nhập thì báo; mỗi dòng hiện mã lô `BĐ-…` để đối chiếu tem | `ReserveWarehouseScreen.tsx` (`duyetTheoTem`) | — |
| **Kiểm lô lệnh xuất bằng quét**: chi tiết đơn có mục "Lệnh xuất đã lập", nút "Kiểm lô bằng quét" ⇒ liệt kê lô FIFO của lệnh; quét đúng ⇒ "Đã quét", sai lô ⇒ báo đỏ "KHÔNG thuộc lệnh — đừng xếp lên xe". **Kiểm tại chỗ, không lưu, không đổi lệnh** (FIFO giữ nguyên) | `orders/KiemLoXuat.tsx` | — |

**Đợt 2b đã build tiếp — xem §6d.** Còn để sau: `export_items.packaging_id` (xuất theo lô TP qua đơn đặt) · QR vị trí kho.

## 6d. Đợt 2b — khép vòng tới khách, sổ tồn theo đúng lô (build 2026-10-08)

**Vì sao (phân tích 2026-10-08):** chuỗi đứt ở 4 chỗ — (1) lô TP là ngõ cụt: bán lẻ / bán nội địa không gắn lô, truy xuôi dừng ở đóng gói; (2) hộ chiếu và sổ tồn nói HAI lô khác nhau: đóng gói / bán lẻ gắn lô W1 nhưng `inventory` vẫn trừ FIFO lô cũ nhất ⇒ quét kiểm xuất báo đỏ đúng lô thật trên xe; (3) gắn lô từng mẻ sau khi lưu ⇒ nặng tay, dễ bỏ (`lot_inputs` = 0 dòng trên server 02/10); (4) vòng đông không có lô, danh sách chọn lô NL chỉ lùi 45 ngày.

**Chủ dự án chốt (2026-10-08):** làm A + B · trừ tồn THEO LÔ GẮN · lô của hàng ra lưu BẢNG RIÊNG · **chốt ngày SX phải gắn lô hoặc ghi lý do** (§7 câu 4).

| Việc | Ở đâu | Đụng DB |
|---|---|---|
| **Lô đi ra** `lot_dispatches` {lot_kind S/W/P, lot_id, lot_label, doc_kind `sales_item`/`export_item`/`domestic_sale`, doc_id, quantity_kg NULL=chưa cân, method quet/go/chon/fifo, operator, recorded_at} + **lý do chưa gắn lô** `lot_waivers` {output_kind W/P, output_id, reason, operator} | mig `0056` · `BANG_LOT_DISPATCH` / `BANG_LOT_WAIVER` · `useLotDispatches` / `useLotWaivers` | 🟡 thêm 2 bảng, KHÔNG thêm cột bảng cũ (deploy trước migration thì chỉ phần gắn lô nằm hàng chờ) |
| **Trừ tồn theo lô gắn**: dòng trừ tồn có `lo` ⇒ (1) lô gắn có kg trừ đúng kg · (2) gắn chưa cân ⇒ FIFO trong các lô đã gắn · (3) phần còn lại FIFO như cũ. Không gắn lô ⇒ y kết quả cũ. Lô gắn khác mặt hàng bị bỏ qua. MỘT chỗ dựng `truTonBTP(sales, packagings, lotInputs, lotDispatches)` cho 5 màn (kho dự trữ · kho lạnh · đơn đặt · đóng gói · bán hàng). Tồn TP theo lô: `tinhTonTPTheoLo` | `lib/inventory.ts` (+ test) | — |
| **Gắn lô NL cho cả phiên** ở `/wip`: khối "Lô nguyên liệu dùng cho phiên này" (quét / gõ / chọn nhiều lô), lưu phiên ⇒ `ganLoChoPhien` gắn cho mẻ CÙNG LOÀI + dòng bán nội địa cùng loại NL, kg trống. Không rõ loài ⇒ vẫn gắn (thu hồi rộng hơn, không hẹp hơn). Lô khai giữ cho các phiên sau cùng ngày · xưởng | `production/KhoiLoPhien.tsx` · `WipProductionScreen.luuPhien` | — |
| **Chốt ngày SX bắt buộc**: còn mẻ chưa gắn lô và chưa có lý do ⇒ `ErrorSummary` chặn chốt; ghi "Lý do chưa gắn lô" ⇒ mỗi mẻ còn thiếu một dòng `lot_waivers`. Nút Lưu/Chốt không bao giờ disabled | `WipProductionScreen.chotNgay` · `meThieuLo` | — |
| **Gắn lô cho hàng ra**: dòng bán lẻ (block thô ⇒ lô BTP, đóng gói ⇒ lô TP) ngay trong phiếu đang gõ + ở sổ; dòng bán nội địa (⇒ lô NL) ở sổ `/wip`. Lô phải cùng mặt hàng với dòng bán. Gợi ý lô còn tồn, cũ trước | `shared/GanLoDauVao.tsx` (`HopGanLo` lõi chung · `GanLoXuat`) | — |
| **Kiểm lô xuất có lưu**: quét đúng ⇒ ghi `lot_dispatches` doc `export_item` (đóng mở lại vẫn "Đã quét"). Quét lô ngoài lệnh CÙNG mặt hàng × quy cách, đủ tồn ⇒ hộp **Thay lô** (xác nhận + Hoàn tác) sửa `export_items.wip_id` sang lô đang xếp lên xe | `orders/KiemLoXuat.tsx` | — |
| **Hộ chiếu**: truy xuôi tới khách (lá B = bán lẻ, N = bán nội địa), cân bằng kg cho cả lô TP, "Tồn trong kho (sổ tồn)" cạnh "Còn lại theo hồ sơ lô", mục **Thu hồi** (khách · ngày · chứng từ · kg · từ lô + lô còn trong xưởng; In A4 + Excel) | `qr/QrTraCuuScreen.tsx` · `qr/ThuHoiLo.tsx` · `danhSachThuHoi` · `tonKhoCuaLo` | — |
| **Tab Theo giai đoạn** (`/qr?tab=giai-doan`, thay tab "Độ phủ" — link cũ `?tab=do-phu` vẫn mở): theo khoảng ngày × xưởng, 5 khâu đúng thứ tự chuỗi — **Nhập NL** (tem · đã dùng cho bao nhiêu mẻ) · **Sản xuất** (lô NL · tem) · **Nhập kho** (chờ duyệt / đã nhập + tồn) · **Đóng gói** (lô BTP · tem · tồn) · **Xuất & bán** (lệnh xuất đã quét kiểm · dòng bán lẻ / bán nội địa đã gắn lô). Mỗi khâu đếm "Còn thiếu N"; lọc "Chỉ hiện mục còn thiếu". Nút làm NGAY tại dòng: In tem · Gắn lô NL/BTP · Gắn lô (dòng bán) · **Duyệt nhập kho** (mở `/warehouse?duyet=W:<id>` ⇒ hộp duyệt đúng mẻ) · **Kiểm lô** (mở `/orders?don=<id>&kiem=<lệnh>` ⇒ đơn + hộp kiểm). Bấm mã lô ⇒ hộ chiếu. Lý do làm (2026-10-08): người dùng không tìm thấy nút QR rải ở 7 màn | `qr/GiaiDoanTruyXuat.tsx` · `theoGiaiDoan` (thay `doPhuTruyXuat`) | — |
| **Chọn lô NL còn dở**: ngoài lô 45 ngày gần đây, thêm lô cũ (≤ 1 năm) còn kg theo hồ sơ — chỉ lô đã từng gắn hoặc về từ ngày bắt đầu truy xuất (NL cấp đông đem xả) | `loNlDeChon` | — |
| **Số tem theo block / thùng**: mặc định BTP = số block, TP = số thùng, NL = 1; sửa được ở xem trước; sổ in ghi đúng `copies` | `PhieuInTem` (`TemIn.soBan`, `onIn(soBan[])`) · `soTemMacDinh` · `banGhiIn` | — |
| **Đồng bộ cùng tab** giữa các lần gọi `useBang` cùng bảng — trước đây hộp gắn lô (con) ghi xong mà màn cha cầm bản cũ, lần ghi kế tiếp của màn cha sẽ XÓA dòng con vừa thêm | `lib/repo.ts` (`SU_KIEN_BANG`) | — |

**Thứ tự triển khai:** chạy `0056` trên DB thật TRƯỚC (2 lần, idempotent) rồi mới đẩy code — ✅ đã chạy 2026-10-08 (kiểm 2026-10-08 qua Supabase, chỉ đọc: 2 bảng có, RLS bật, policy `_nguoi_dung` authenticated, anon không đọc được, đủ trigger `*_sua` + `ghi_vet_sql_tg`, cột khớp toRow) — không thì các màn có hook lô đi ra báo lỗi máy chủ (404 `lot_dispatches`) cho tới khi chạy.

## 7. Còn treo — xưởng phải chốt (KHÔNG tự chốt thay)

1. **Sinh mã lô lúc nào** (treo từ họp 02/09): ngay cổng lúc nhập, hay sau sơ chế + đông?
   → Thiết kế này đang coi **lô NL = chuyến nhập** (gieo lúc nhập — khớp FSMA "tiếp nhận đầu tiên"). Nếu xưởng chốt "sau sơ chế" thì lô sơ chế sẽ là một tầng biến đổi nữa, **cùng bảng `lot_inputs`**, không phải đổi mô hình.
2. **Loại tem**: giấy in tại chỗ hay mã nhựa tái dùng. Mô hình chạy được cả hai; mã nhựa sẽ cần thêm bảng "gán thẻ ↔ lô" (đợt 2).
3. **Ai quét, lúc nào**: tổ trưởng quét khi lấy NL ra chế biến, hay thủ kho quét khi xuất khỏi kho.
4. ~~**Có bắt buộc gắn lô khi ghi sản lượng không.**~~ ✅ **Chốt 2026-10-08 (chủ dự án):** ghi sản lượng vẫn tùy chọn, nhưng **chốt ngày SX phải gắn lô NL cho mọi mẻ, hoặc ghi lý do** (lưu `lot_waivers`). Tab **Theo giai đoạn** ở `/qr` cho thấy mẻ nào còn thiếu lô để xưởng theo dõi.
5. **Lô NL nên chi tiết đến đâu**: một chuyến (một đại lý / một xe) hay từng dòng NL trong chuyến. Đợt 1 theo chuyến; bảng có sẵn cột `material` để ghi rõ loại.

## 8. Không làm (vùng đỏ)

- **Không gắn lô ngược cho dữ liệu cũ** (nhập / sản xuất / đóng gói đã ghi). Đây là sổ thật: sai là không dựng lại được, và gắn "đoán" thì hồ sơ truy xuất thành giả. Truy xuất tính **từ ngày áp dụng**.
- **Không đổi RLS** bảng cũ. Bảng mới siết RLS NGAY TỪ ĐẦU theo khuôn `0049`/`0054`/`0056` (policy `_nguoi_dung` cho authenticated + `revoke all … from anon`) — bất biến từ `0047`. *(Bản trước ghi "RLS mở như 0041/0043" — đã lỗi thời sau 0047, sửa 2026-10-08.)*
- **Không đụng giá** — PA giá bình quân gia quyền (QĐ-7) chưa chốt. Truy xuất lô và định giá lô là hai việc; khung này không phụ thuộc giá.

## 9. Kịch bản nghiệm thu đầu-cuối (oracle)

Mã hóa thành test tự động `src/lib/truyXuatLo.e2e.test.ts` — đỏ là chuỗi truy xuất đã gãy.

| Ngày | Thao tác |
|---|---|
| 29/09 | W0: bạch tuộc 2 da chần 100 kg / 10 block, duyệt kho, **không gắn lô NL** (giả lập mẻ cũ) |
| 01/10 | S1: Đại lý A, bạch tuộc 1.000 kg · S2: Đại lý B, 600 kg · S3: Đại lý C, mực 400 kg |
| 02/10 | W1: 2 da chần 500 kg, ăn S1 600 kg · W2: cắt 300 kg, ăn S1 250 + S2 150 · duyệt kho · bán nội địa 30 kg từ S2 cho Chợ Bà Rịa |
| 03/10 | P1: đóng gói từ W1 200 kg → túi 1 kg 190 kg / 190 túi, gắn W1 200 |
| 04/10 | Đơn khách X: cắt 200 kg → lệnh lấy W2 200, quét kiểm đúng lô |
| 05/10 | Bán lẻ P1 50 kg cho khách Y (đóng gói) · W1 100 kg block thô cho khách Z |

**Phải ra:**
- Truy ngược P1 → W1 → S1 → Đại lý A, 01/10. Truy xuôi P1 → khách Y (không còn ngõ cụt).
- Thu hồi S1 → khách **X, Y, Z**. Thu hồi S2 → **chỉ X + Chợ Bà Rịa** (không kéo theo Y, Z).
- Cân bằng theo hồ sơ lô: S1 còn 150 · S2 còn 420 · W1 còn 200 · W2 còn 100 · P1 còn 140.
- Sổ tồn khớp hộ chiếu: W0 **100** (không bị đụng), W1 200, W2 100, P1 140. *(Trừ FIFO kiểu cũ ra W0 = 0, W1 = 300 — đối chứng.)*
- Quét kiểm lệnh xuất không đẻ thêm ngả ra (không đếm hai lần).
- Theo giai đoạn 29/09–05/10: Nhập NL — chỉ S3 thiếu tem; Sản xuất — chỉ W0 thiếu (lô NL + tem; ghi lý do ⇒ chỉ còn tem); Kho — 3 mẻ đã nhập, tồn 100 / 200 / 100; Đóng gói P1 đủ, tồn 140; Xuất & bán — x1 đã quét, b1/b2/n1 đã gắn lô, dòng handoff Đơn đặt không tính là bán lẻ.
- Gắn lô cả phiên: lô bạch tuộc vào mẻ bạch tuộc, lô mực vào mẻ mực, không chéo.

**Thử tay trên preview (2026-10-08, `baseafood-demo` — localStorage, không đụng DB thật, đã khôi phục sandbox sau khi thử):** khai 2 lô NL cho phiên (gõ mã + chọn) → lưu 2 thành phẩm + 1 bán nội địa ⇒ toast "gắn lô NL cho 2 mẻ", mỗi mẻ 2 lô, bán nội địa 2 lô · In tem: mặc định 30 + 50 = 80 tem, sửa còn 52 · chốt ngày 06/10 có 2 mẻ thiếu lô ⇒ bị chặn; gắn lô 1 mẻ từ hộp chốt ⇒ mở lại còn 1; ghi lý do ⇒ chốt được, `lot_waivers` đúng mẻ · quét tem duyệt kho 2 mẻ · đóng gói gắn nhầm lô khác mặt hàng ⇒ chặn; gắn đúng lô 200 kg · đơn đặt → lệnh FIFO → quét lô sai ⇒ báo đỏ, quét đúng ⇒ ghi kiểm, mở lại vẫn "Đủ lô" · quét lô cùng mặt hàng ngoài lệnh ⇒ hộp Thay lô ⇒ lệnh trỏ lô mới, Hoàn tác trả lại · bán lẻ gắn lô TP + BTP ngay trong phiếu · hộ chiếu NL ra đủ chuỗi tới 3 khách, thu hồi 4 ngả ra · lô TP: 190 ra − 50 bán = 140 = sổ tồn · 360 px và chữ 130%: không cuộn ngang toàn trang (bảng rộng cuộn trong khung riêng). **Tab Theo giai đoạn (thử thêm cùng ngày):** 5 khâu hiện đủ trạng thái đúng dữ liệu · Gắn lô NL ngay tại tab ⇒ dòng đổi thành "Lô NL (1)" · In tem ra 30 tem theo block · Duyệt nhập kho ⇒ mở `/warehouse` đúng hộp duyệt mẻ đó · Kiểm lô ⇒ mở `/orders` với đơn + hộp kiểm đúng lệnh · lọc "chỉ còn thiếu" đúng · 360 px: tab 1 dòng (nhãn ngắn), 130% không tràn. **Chưa thử:** chế độ có `.env` (Supabase) với phiên đăng nhập — `0056` đã chạy, nên thử 1 chuyến thật ngày đầu; quét bằng camera máy thật.

## Nguồn

- GS1 Digital Link — [URI Syntax](https://ref.gs1.org/standards/digital-link/uri-syntax/) · [tổng quan](https://www.gs1.org/standards/gs1-digital-link)
- GDST — [Standards 1.2 (PDF)](https://thegdst.org/wp-content/uploads/2024/01/GDST-1.2-Core-Normative-Standards-1.pdf) · [The Standard](https://thegdst.org/resources/standard/)
- FDA FSMA 204 — [Final Rule](https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods) · [lùi hạn tuân thủ (Federal Register, 08/2025)](https://www.federalregister.gov/documents/2025/08/07/2025-14967/requirements-for-additional-traceability-records-for-certain-foods-compliance-date-extension)
- Việt Nam — [Thông tư 02/2024/TT-BKHCN](https://thuvienphapluat.vn/van-ban/Thuong-mai/Thong-tu-02-2024-TT-BKHCN-quan-ly-truy-xuat-nguon-goc-san-pham-hang-hoa-604359.aspx) · [TCVN 13274:2020](https://thuvienphapluat.vn/TCVN/Linh-vuc-khac/TCVN-13274-2020-Truy-xuat-nguon-goc-huong-dan-dinh-dang-ma-dung-cho-truy-vet-917656.aspx)

---

> **Ghi chú kỹ thuật 2026-09-21 (P2-8 audit):** `html5-qrcode` (quét camera, `features/shared/KhungQuetQr.tsx`) và `qrcode` (sinh ảnh tem, `lib/qr.ts`) nay **nạp động** lúc dùng, không còn nằm trong chunk chính — khung quét mount xong mới tải lib (vài trăm ms lần đầu). Hành vi quét/in không đổi. Đừng đổi lại import tĩnh: `features/shared` được mọi màn import nên sẽ kéo ~400 KB vào lần mở đầu.
