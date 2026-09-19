# Truy xuất theo lô bằng QR — phân tích & thiết kế

> **Trạng thái:** ĐỢT 1 ĐÃ BUILD (2026-09-18) · đợt 2–3 là đề xuất · §7 còn câu chờ xưởng chốt.
> **Loại:** phân tích các hệ thống/chuẩn QR truy xuất + thiết kế áp dụng cho Baseafood.
> **Code:** `src/lib/truyXuatLo.ts` · `src/features/qr/QrTraCuuScreen.tsx` (hộ chiếu lô) · `src/features/shared/{GanLoDauVao,KhungQuetQr,QrTemLoIn,useDuLieuTruyXuat}` · migration `0046_lot_inputs.sql` (✅ đã chạy trên DB thật 2026-09-18).

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
| Lưu kho | lô · vị trí · ngày vào · trạng thái đông | một phần (duyệt "chờ nhập") | vị trí quét QR (đợt 2) |
| **Xuất / bán** | lô · khách · ngày · kg · chứng từ | xuất đơn ✅ (`wip_id`) | bán lẻ chưa gắn lô (đợt 2) |

## 6. Lộ trình

| Đợt | Nội dung | Đụng DB |
|---|---|---|
| **1 — nối chuỗi (build ngay)** | bảng `lot_inputs` · thư viện `truyXuatLo` · **hộ chiếu lô** truy ngược/xuôi + cân bằng kg · QR thành đường link (đọc được tem cũ) · **gắn lô NL cho mẻ SX** + **gắn lô BTP cho đóng gói** (quét / gõ / chọn) · in tem BTP/TP | 🟡 thêm 1 bảng |
| 2 — vận hành kho | QR vị trí phòng đông (cất/chuyển bằng quét) · FIFO gợi ý lô cũ khi gắn lô · bán lẻ gắn lô · kiểm kê bằng quét | 🟡 thêm bảng sự kiện kho |
| 3 — chuẩn hóa ra ngoài | mã quốc gia / SSCC khi được cấp · báo cáo thu hồi "một nút, 24 giờ" · xuất file GDST/EPCIS cho khách Mỹ/EU · dữ liệu khai thác (tàu, vùng) | 🟡 |

## 7. Còn treo — xưởng phải chốt (KHÔNG tự chốt thay)

1. **Sinh mã lô lúc nào** (treo từ họp 02/09): ngay cổng lúc nhập, hay sau sơ chế + đông?
   → Thiết kế này đang coi **lô NL = chuyến nhập** (gieo lúc nhập — khớp FSMA "tiếp nhận đầu tiên"). Nếu xưởng chốt "sau sơ chế" thì lô sơ chế sẽ là một tầng biến đổi nữa, **cùng bảng `lot_inputs`**, không phải đổi mô hình.
2. **Loại tem**: giấy in tại chỗ hay mã nhựa tái dùng. Mô hình chạy được cả hai; mã nhựa sẽ cần thêm bảng "gán thẻ ↔ lô" (đợt 2).
3. **Ai quét, lúc nào**: tổ trưởng quét khi lấy NL ra chế biến, hay thủ kho quét khi xuất khỏi kho.
4. **Có bắt buộc gắn lô khi ghi sản lượng không.** Đợt 1 để **tùy chọn**. Khi đã quen thì có thể chuyển thành bắt buộc (nhắc ở chốt ngày SX).
5. **Lô NL nên chi tiết đến đâu**: một chuyến (một đại lý / một xe) hay từng dòng NL trong chuyến. Đợt 1 theo chuyến; bảng có sẵn cột `material` để ghi rõ loại.

## 8. Không làm (vùng đỏ)

- **Không gắn lô ngược cho dữ liệu cũ** (nhập / sản xuất / đóng gói đã ghi). Đây là sổ thật: sai là không dựng lại được, và gắn "đoán" thì hồ sơ truy xuất thành giả. Truy xuất tính **từ ngày áp dụng**.
- **Không đổi RLS** bảng cũ. Bảng mới dùng đúng khuôn RLS mở như `0041`/`0043`, siết cùng nhánh `0021`.
- **Không đụng giá** — PA giá bình quân gia quyền (QĐ-7) chưa chốt. Truy xuất lô và định giá lô là hai việc; khung này không phụ thuộc giá.

## Nguồn

- GS1 Digital Link — [URI Syntax](https://ref.gs1.org/standards/digital-link/uri-syntax/) · [tổng quan](https://www.gs1.org/standards/gs1-digital-link)
- GDST — [Standards 1.2 (PDF)](https://thegdst.org/wp-content/uploads/2024/01/GDST-1.2-Core-Normative-Standards-1.pdf) · [The Standard](https://thegdst.org/resources/standard/)
- FDA FSMA 204 — [Final Rule](https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods) · [lùi hạn tuân thủ (Federal Register, 08/2025)](https://www.federalregister.gov/documents/2025/08/07/2025-14967/requirements-for-additional-traceability-records-for-certain-foods-compliance-date-extension)
- Việt Nam — [Thông tư 02/2024/TT-BKHCN](https://thuvienphapluat.vn/van-ban/Thuong-mai/Thong-tu-02-2024-TT-BKHCN-quan-ly-truy-xuat-nguon-goc-san-pham-hang-hoa-604359.aspx) · [TCVN 13274:2020](https://thuvienphapluat.vn/TCVN/Linh-vuc-khac/TCVN-13274-2020-Truy-xuat-nguon-goc-huong-dan-dinh-dang-ma-dung-cho-truy-vet-917656.aspx)
