# 38 — ba-spec: Sổ tồn nguyên liệu LIÊN TỤC theo lô × vị trí × phân xưởng

> Load khi: task chạm hành vi / nghiệp vụ / flow / acceptance của tồn kho NGUYÊN LIỆU theo thời gian thực (sổ sự kiện kho, lô NL, lấy NL ra sàn sản xuất, tiêu hao, cấp đông dự trữ, xả đông, tồn theo ngày, đối chiếu XNT), hoặc khi định thay/nối các sổ tồn đang có (`/nxt-nl`, `/nxt-kho`, `/ton-kho-thang`).
covers: src/lib/inventoryMaterial.ts, src/lib/truyXuatLo.ts, src/features/reports/MaterialNxtScreen.tsx, src/features/reports/WarehouseNxtScreen.tsx, src/features/production/WipProductionScreen.tsx
last_verified: 2026-09-22
ttl_days: 90

> **Mục đích**: oracle HÀNH VI cho sổ tồn NL liên tục — USER nào làm nghiệp vụ gì, flow vào/ra sao, đúng-sai đo bằng AC nào. KHÔNG mô tả giao diện (design-spec), KHÔNG chốt schema (03-database khi build). **Trạng thái: v2 — đã qua đủ team-agent B5 (Suggester · Domain-Specialist kho/kế toán: HỢP-LỆ CÓ ĐIỀU KIỆN đã ráp · Optimizer §6 · Cross-User-Integrity: 15 điểm gãy đã vá). Chờ chủ dự án duyệt mức tổng + chốt §11 Open. CHƯA chuyển sang design/build.**

> **Nguồn quyết định kế thừa (không mở lại):** Phương án A cấp lô + "kho XNT cấp lô là sổ tồn NL CHÍNH, engine họ-NL cũ giữ song song" ([spec cutover §6, §9](../spec/import-xnt-kho-cutover.md)) · lô NL = chuyến nhập, `lot_inputs` là sự kiện "đầu ra dùng đầu vào" ([spec QR §4](../spec/qr-truy-xuat-lo.md)) · PA-a tồn theo NHẬP HÀNG, đông gửi/xả đông KHÔNG cộng thêm vào tổng ([31 §Tồn NL](31-can-doi-ky.md)) · baseline tồn đầu MỘT LẦN (2026-09-11) · không khóa cứng bản ghi đã chốt, role-RLS hoãn (chủ dự án 2026-09-21) · Nguyên tắc Long: đầu vào chỉ phân LƯỢNG theo lô, tiền dồn về kế toán ([họp 09-02 QĐ-7](../trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md)) · tồn BTP/TP giữ nguyên mô hình [34](34-btp-san-xuat-kho.ba-spec.md).

---

## 0. Hiện trạng — vì sao cần sổ tồn LIÊN TỤC (đối chiếu doc + memory 2026-09-22)

Hôm nay có **năm nguồn tồn nguyên liệu chạy song song, không nguồn nào là sổ sự kiện**:

| Nguồn | Hạt | Cách ra số | Thiếu gì |
|---|---|---|---|
| `/nxt-nl` — `tinhTonNLTong` (PA-a) | họ NL × ngày, 3 xưởng | tồn = tồn đầu + Σ nhập hàng − **xuất SX (= 0, cột chờ)** | **không biết NL đã lấy ra chế biến** ⇒ "tồn theo nhập", không phải tồn thật |
| engine kỳ cũ `tinhSoTonNL` | họ NL × kỳ 5 ngày, chỉ Đông | tồn đầu + đông gửi − xả đông (từ Cân đối) | chỉ còn nuôi 2 cột thông tin |
| `/nxt-kho` — `nxt_snapshots` (0032) | (kho × mã kế toán `PXĐ.BTNL.TĐ…` × kỳ) | ảnh chụp báo cáo XNT kế toán, ghi tay nhập/xuất từng mã; đã có nhập Excel XNT | **trục mã riêng, không nối giao dịch** (P5-B bế tắc) |
| `/ton-kho-thang` — `monthly_stock_ledger` (0041) | tháng × nhóm × mặt hàng × size × invoice, theo kho | bảng kê Excel kế toán, dồn kỳ có duyệt | tổng tháng, không theo ngày; nhập/xuất gõ tay |
| `tinhTon`/`tinhTonTP` (`inventory.ts`) | lô BTP/TP (mẻ SX, phiếu đóng gói) | suy từ giao dịch — **đúng mô hình mong muốn**, chỉ cho BTP/TP | không phủ nguyên liệu |

Hệ quả: (a) "hôm nay xưởng còn bao nhiêu kg NL, ở đâu, lô nào" **không trả lời được**; (b) G1 hở — không truy "mẻ nào ăn lô nào bao nhiêu kg" (`lot_inputs.quantity_kg` có cột nhưng chưa là nguồn tồn); (c) kế toán chốt tháng **gõ lại** nhập/xuất vào 2 sổ tay — đúng cái đau gốc.

**Sổ tồn liên tục = MỘT sổ SỰ KIỆN KHO nguyên liệu** (mỗi sự kiện: lúc nào · loại gì · lô nào · từ vị trí → đến vị trí · xưởng · kg · ai · vì sao · nguồn). Tồn tại bất kỳ thời điểm = cộng dồn sự kiện theo **(lô × vị trí)**; các sổ kỳ/tháng là **cách nhìn** của cùng sổ. Chuyển đổi **song song rồi đối chiếu**, không đập bỏ.

### 0.1 Mô hình WHAT (bất biến, không phải schema)

**Vị trí** (nơi kg đang nằm): `kho tươi xưởng` (hàng vừa về, chưa chế biến — thuộc xưởng) · **`sàn SX xưởng`** (đã lấy ra, đang/chờ chế biến — *một vị trí có lô, không phải "pool"*) · `chờ cấp đông` (còn dở đã khai, chưa duyệt) · `kho dự trữ` (phòng đông, 5 kho hệ thống — thuộc thủ kho) · `kho thuê ngoài` (`storage_locations`) · `đang chuyển` (giữa hai kho khi cần xác nhận hai đầu).

**Lô**: `S:<chuyến>` (lô tươi = chuyến nhập, sự kiện theo dòng loại NL) · `F:<lô đông>` (sinh khi duyệt cấp đông, **có thể n lô gốc**, phân bổ kg kiểu `lot_inputs`) · `K:<mã kế toán>` (lô kế thừa từ tồn đầu cutover, tự đóng khi về 0). Mỗi lô mang **họ NL + xưởng + `accounting_code`** (ánh xạ mã kế toán — người xác nhận, không suy ngầm).

**Loại sự kiện** (dấu trên TỔNG HỆ = kho + sàn):
| Loại | Δ tổng hệ | Ý nghĩa | Ở XNT theo kho |
|---|---|---|---|
| `TON_DAU` | + | tồn đầu cutover (một lần/lô/vị trí) | tồn đầu |
| `NHAP_MUA` | + | dòng NL của chuyến về (phái sinh từ `/imports`); hàng đông "mua về" cũng đi đường này với cờ nguồn | Nhập |
| `LAY_RA` | 0 | **chuyển `kho tươi xưởng` → sàn SX**, giữ lô. *Chỉ từ kho tươi* — kho dự trữ luôn đi `XA_DONG` | Xuất (khỏi kho) |
| `XA_DONG` | 0 | **chuyển kho dự trữ → sàn SX**, giữ lô F (hai chân một sự kiện) | Xuất |
| `TIEU_HAO` | − | tự sinh khi chốt ngày SX: Σ sàn − còn dở khai; là "NL đã vào chế biến" (nguồn cột Xuất SX `/nxt-nl`) | — |
| `CON_DO` | 0 | sàn → `chờ cấp đông` (còn dở khai lúc chốt ngày) | — |
| `CAP_DONG` | 0 (hao tách riêng) | duyệt: `chờ cấp đông` → kho dự trữ, sinh lô F | **Nhập** (NHAP_LAI_SX) |
| `CHUYEN_KHO` | 0 | kho A → kho B / kho thuê ngoài / giữa xưởng; hoàn `chờ cấp đông` → sàn (dùng lại) | Xuất A · Nhập B |
| `XUAT_NGOAI` | − | trả đại lý · bán NL thẳng · đi xí nghiệp khác — không vào định mức | Xuất |
| `HAO_HUT` | − | theo nguyên nhân: cấp đông · rã đông · lưu kho · kiểm kê · hủy đề nghị | Xuất (hao) |
| `DIEU_CHINH` | ± | kiểm kê, có lý do; **hiệu lực ngay**, kế toán xác nhận trong tháng | ± |
| `DAO` | đảo dấu sự kiện gốc | sửa/xóa = đảo + mới, giữ gốc | — |

**Thời gian**: mỗi sự kiện có `effective_date` (ngày nghiệp vụ, quyết tồn theo ngày/tháng) và `recorded_at` (lúc ghi). Ghi bù = effective < recorded. **Người**: `actor` (người thao tác gốc — người ghi giấy/quét) và `recorded_by` (người nhập vào hệ) — khác nhau khi nhập giấy cuối ca.

## 1. Vấn đề & JTBD
- **Job (tổ trưởng/thủ kho):** khi hàng NL về, đem ra sàn chế biến, còn dở đem cấp đông, hay xả đông dùng lại — tôi muốn **ghi đúng một lần tại chỗ, theo lô**, để cuối ngày/cuối tháng **không cộng tay** và trả lời được "lô này đi đâu".
- **Job (kế toán):** khi chốt tháng, tôi muốn **tồn cuối mỗi kho/mã tự ra từ sổ**, khớp báo cáo XNT tôi vẫn nộp, có bằng chứng từng sự kiện.
- **Job (BGĐ):** thấy **tồn NL thực tế theo ngày** (đã trừ chế biến) để quyết mua thêm hay dùng hàng đông.
- **Vì sao bây giờ:** realtime T9 đã bật nhưng "NL vào chế biến" = 0 ⇒ mọi tồn NL là số **chưa trừ chế biến**; càng chạy lâu càng gõ tay bù ở 2 sổ.
- **Đo thành công:** (1) `TIEU_HAO` ≠ 0 mọi ngày có SX và cột Xuất SX `/nxt-nl` = Σ `TIEU_HAO`; (2) tồn cuối tháng suy ↔ báo cáo XNT: 0 lệch không giải thích ở tầng mã (R15); (3) ghi một lần lấy ra ≤ 30 s (quét) / ≤ 60 s (chọn); (4) ≥ 95% kg `LAY_RA` có `recorded_at` cùng ngày `effective_date` (kênh giấy không trễ quá ca).

## 2. User registry
| User (role) | Là ai | Vòng đời | Thiết bị/bối cảnh |
|---|---|---|---|
| **Người nhập hàng** (`warehouse-keeper`, Trúc/Thủy) | ghi chuyến NL về (kể cả hàng đông mua về), sinh mã lô, dán tem | quen | điện thoại/PC cổng xưởng |
| **Tổ trưởng SX** (`team-leader`, `manager-*`) | lấy NL ra sàn, gắn mẻ, khai còn dở, dùng lại/hủy đề nghị, điều chỉnh kho tươi/sàn, đếm tồn tươi ngày cutover | quen | tablet/điện thoại xưởng lạnh, tay ướt; điện thoại hạn chế trong khu SX ⇒ có thể ghi giấy, nhập ở phòng cuối ca |
| **Thủ kho dự trữ** (`warehouse-keeper` kho lạnh) | duyệt cấp đông, xả đông, chuyển kho/gửi kho ngoài, xuất ngoài, kiểm kê kho dự trữ | quen | tablet kho |
| **Kế toán** (`accountant`, `chief-accountant`) | ánh xạ mã kế toán, đối chiếu, chốt tháng, xác nhận điều chỉnh, ráp tiền xuất ngoài, nạp tồn đầu; **owner sổ tồn theo ngày** | power | desktop |
| **BGĐ / Quản đốc** (`director`, `manager-*`) | *reader*: tồn theo ngày, hộ chiếu lô | quen | điện thoại |
| **Quản trị** (`admin`) | owner-khi-hỏng của phái sinh/nhắc (kỹ thuật); kế toán trưởng là owner-khi-hỏng nghiệp vụ | power | desktop |
| **Hệ thống — phái sinh** | sinh `NHAP_MUA` khi chuyến lưu · `lot_inputs` khi gắn mẻ · `TIEU_HAO`+`CON_DO` khi chốt ngày SX · `DAO` khi bản gốc sửa/xóa · `TON_DAU` khi nạp cutover | — | nền — owner khi hỏng: admin (kỹ thuật) / kế toán trưởng (số liệu) |
| **Hệ thống — nhắc** | "sàn còn kg chưa chốt", "đề nghị cấp đông quá 1 ngày", "còn dở quay vòng ≥ 3 ngày", "tháng chốt bị hở", "lô chưa ánh xạ", "hàng tươi quá 3 ngày" | — | nền — người nhận ghi ở §4 |

## 3. User × Nghiệp vụ (mỗi nghiệp vụ đúng 1 owner)
| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Nhận lô NL vào (chuyến → lô S, `NHAP_MUA`; hàng đông mua về: cờ nguồn "mua về") | Người nhập hàng | tổ trưởng (H1) · thủ kho (H9) | — | cao | Must (đã có, thêm phái sinh) |
| NV2 | **Lấy NL ra sàn SX theo lô** (`LAY_RA`, chỉ từ kho tươi) — 2 chế độ: tới lô / theo họ NL hệ phân bổ; 1 kênh nhập: giấy cuối ca | Tổ trưởng SX | người nhập hàng (H1) | NV1 | cao | **Must — khép G1** |
| NV2c | Gắn mẻ SX ↔ lô trên sàn (`lot_inputs` tham chiếu kg) | Tổ trưởng SX | — | NV2 | cao | Must |
| NV2b | **Chốt ngày SX đóng sàn**: `TIEU_HAO` tự sinh + `CON_DO` từ còn dở khai | Tổ trưởng SX (hệ phái sinh) | tổ trưởng (H7 điều chỉnh) | NV2 | hằng ngày | Must |
| NV3 | Còn dở (đề nghị còn "chờ duyệt"): để duyệt / **dùng lại sáng hôm sau** / **hủy** (lý do → hao hụt) | Tổ trưởng SX | thủ kho (H2) | NV2b | hằng ngày | Must |
| NV4 | Duyệt cấp đông (kg thực, kho/vị trí, sinh lô F n-gốc, hao hụt có lý do) | Thủ kho dự trữ | tổ trưởng (H2b thông báo chênh) | NV3 | hằng ngày | Must |
| NV5 | Xả đông lô F → sàn SX (giữ lô; hao rã đông ghi riêng) | **Thủ kho dự trữ** (mặc định an toàn; Open-4 có thể chuyển tổ trưởng cho kho nội bộ) | tổ trưởng (H3) | NV4 | theo nhu cầu | Must |
| NV6 | Chuyển kho / gửi kho ngoài / chuyển lô tươi giữa xưởng (tổng không đổi) | Thủ kho dự trữ | — | NV1/NV4 | thấp | Should |
| NV6b | Xuất NL ra ngoài (`XUAT_NGOAI`, có chứng từ, không vào định mức) | Thủ kho dự trữ | kế toán (H8) | NV1 | thấp | Should |
| NV7a | Điều chỉnh/kiểm kê **kho tươi & sàn xưởng** (hiệu lực ngay, kế toán xác nhận trong tháng) | Tổ trưởng SX | kế toán (H4) | — | khi cần | Should |
| NV7b | Kiểm kê & điều chỉnh **kho dự trữ** (đếm block × quy cách kg/block của lô) | Thủ kho dự trữ | kế toán (H4) | — | tháng | Should |
| NV8 | Sổ tồn theo ngày theo lô/họ NL/vị trí/xưởng + hộ chiếu lô | **Kế toán** (BGĐ/thủ kho/tổ trưởng là reader) | — | NV1–NV7 | hằng ngày | Must |
| NV9a | Đối chiếu tháng 2 tầng (tên → mã) với sổ tay; gợi ý điền sổ tay (kế toán xác nhận từng dòng); nhớ lệch đã giải thích | Kế toán | thủ kho/tổ trưởng (H4) | NV1–NV7, NV11 | tháng | Must (pha 3) |
| NV9b | Chốt tháng / chốt lại khi "chốt bị hở"; tuyên dừng sổ tay | Kế toán | BGĐ (H6) | NV9a | tháng | Must (pha 3) |
| NV10 | Nạp **tồn đầu cutover**: báo cáo XNT T8 (kiểm chéo với `nxt_snapshots`) + tồn tươi tại xưởng ngày mốc | Kế toán | tổ trưởng (H0 đếm tươi) | NV11 | một lần | Must (chờ file) |
| NV11 | **Ánh xạ mã kế toán** ↔ (họ NL, xưởng, nhóm tên, NL/BTP) — người xác nhận | Kế toán | — | — | khi có mã mới | Must (tiền đề NV9/NV10) |

## 4. Cross-user handoff map
| Chặng | NV | Từ → Nhận | Điều kiện chuyển | Điểm kết nếu KHÔNG ai nhận |
|---|---|---|---|---|
| H0 | NV10 | tổ trưởng (đếm tồn tươi ngày mốc) → kế toán | mốc cutover; kho tươi có chuyến effective < mốc chưa chế biến | không đếm ⇒ hệ lấy kg chuyến trong app làm tạm, cờ "chưa đếm tươi" tới khi tổ trưởng xác nhận |
| H1 | NV1→NV2 | người nhập hàng → tổ trưởng | chuyến lưu ⇒ lô S ở `kho tươi xưởng`, kg > 0 | kg = tồn thật; quá 3 ngày chưa lấy ⇒ nhắc **tổ trưởng** (hàng tươi) |
| H2 | NV2b→NV3→NV4 | tổ trưởng → thủ kho | chốt ngày SX khai còn dở > 0 ⇒ đề nghị "chờ duyệt"; (b) dùng lại/(c) hủy **chỉ khi còn "chờ duyệt"** | quá 1 ngày ⇒ nhắc **thủ kho**; tổ trưởng vẫn dùng lại được — kg không kẹt; quay vòng ≥ 3 ngày ⇒ nhắc **tổ trưởng** phải cấp đông hoặc hao hụt |
| H2b | NV4 | thủ kho → tổ trưởng | kg thực ≠ kg khai | chênh ghi `HAO_HUT` bởi thủ kho, **thông báo** tổ trưởng, không cần xác nhận (không treo) |
| H3 | NV5→NV2c/NV2b | thủ kho → tổ trưởng | `XA_DONG` ⇒ lô F nằm `sàn SX` xưởng W | kg trên sàn tới chốt ngày SX buộc xử: tiêu hao hoặc còn dở (→ `chờ cấp đông`); không có "hoàn kho" ngoài đường đó |
| H4 | NV7a/NV7b↔NV9a | tổ trưởng/thủ kho ↔ kế toán | `DIEU_CHINH` hiệu lực ngay; kế toán xác nhận trong tháng; Δ tầng mã ≠ 0 chưa giải thích | tháng "chưa chốt"; điều chỉnh chưa xác nhận ⇒ cờ ở chốt tháng; Δ đã giải thích được **ghi nhớ**, không cờ lại |
| H5 | NV11→NV9a/NV10 | kế toán (map) → hệ | lô chưa có `accounting_code` | lô hiện "chưa ánh xạ", loại khỏi tầng mã, cờ ở NV9a; nhắc **kế toán** |
| H6 | NV9b→BGĐ | kế toán → BGĐ | tháng chốt | — (đọc) |
| H7 | NV2b→NV7a | hệ (chặn chốt) → tổ trưởng | chốt ngày SX gặp lô âm | tổ trưởng `DIEU_CHINH` (hiệu lực ngay) hoặc phân bổ lại ⇒ chốt được; không xử ⇒ ngày chưa chốt, nhắc **tổ trưởng** |
| H8 | NV6b→kế toán | thủ kho → kế toán | `XUAT_NGOAI` có chứng từ | XNT cờ "chưa ráp tiền" tới khi kế toán xử |
| H9 | NV5/NV1 | thủ kho → người nhập hàng | hàng đông **mua về** từ kho khác | ghi như chuyến với cờ nguồn "mua về" (34 AC-8); không ghi ⇒ kg không tồn tại trong sổ (không trừ kho mình) |

## 5. Flows (Input → Steps → Output)

### Flow NV1 — Nhận lô NL vào · owner: người nhập hàng
- **Start**: chuyến về cổng. **Input**: chuyến (đại lý, xưởng, ngày về, dòng loại NL + kg; cờ nguồn "mua về" nếu là hàng đông ngoài) — *đã có `/imports`*.
- **Steps**: ghi chuyến như hiện nay → hệ sinh `NHAP_MUA` cho từng dòng NL, lô `S:<chuyến>`, vị trí `kho tươi xưởng` (hàng đông mua về: vị trí kho dự trữ do người nhập chọn), `effective_date` = ngày về. **Chỉ với chuyến effective ≥ mốc cutover** (R14).
- **Output**: tồn(S, vị trí) = kg nhập; hộ chiếu lô "nhận X". **End**: lô sẵn dùng (H1). Sửa/xóa chuyến sau đó ⇒ `DAO` tự động (R14).

### Flow NV2 — Lấy NL ra sàn SX theo lô · owner: tổ trưởng SX
- **Start**: bốc NL tươi đi chế biến. **Input**: **chế độ tới lô** — lô S (quét tem / gõ mã / chọn) + kg; **chế độ theo họ NL** — họ NL + kg, hệ phân bổ lô cũ trước **chỉ trong `kho tươi xưởng W`**, cho sửa (Open-1 chốt mặc định). **Kênh nhập**: tại chỗ hoặc **giấy trong xưởng → nhập ở phòng cuối ca** (`effective_date` = ngày lấy, `actor` = người ghi giấy, `recorded_by` = người nhập; khóa "đã nhập" chống ghi kép giấy+quét; **phải nhập xong trước chốt ngày SX** kẻo sàn = 0 lúc chốt).
- **Steps**: chọn lô/họ → kg → lưu ⇒ `LAY_RA` (kho tươi → sàn SX, giữ lô). Sửa phân bổ **trước chốt ngày**; sau chốt đi `DAO` (R4).
- **Output**: tồn(lô, kho tươi) −kg; tồn(lô, sàn W) +kg; tổng hệ không đổi. **End**: sàn W có kg chờ chốt; kg lấy > kg còn ⇒ cảnh báo âm tạm, phải xử trước chốt (R13, H7).
- **Cross**: H1.

### Flow NV2c — Gắn mẻ ↔ lô · owner: tổ trưởng SX
- **Input**: mẻ SX W đang ghi, lô trên sàn, kg. **Steps**: gắn ⇒ `lot_inputs`(W ← lô, kg) **tham chiếu**, không trừ tồn lần hai (tiêu hao tính ở NV2b). Lô F đã xả cũng gắn được. **Output**: hộ chiếu lô truy xuôi ra mẻ. **End**: mẻ có nguồn lô (khép G1 sâu).

### Flow NV2b — Chốt ngày SX đóng sàn · owner: tổ trưởng SX (hệ phái sinh)
- **Start**: chốt ngày SX (đã có `production_locks`). **Input**: Σ trên sàn W theo lô (S và F); còn dở khai theo loại NL (đã có `leftover_by_material`), hệ gợi ý phân bổ theo lô trên sàn **theo thứ tự Open-6**.
- **Steps**: kiểm lô âm ⇒ có thì chặn, đi H7 → `TIEU_HAO` = Σ sàn − Σ còn dở (theo lô; không chỉ rõ ⇒ tỷ lệ, cờ "tự chia", R17) → `CON_DO`: sàn → `chờ cấp đông` (giữ lô gốc).
- **Output**: sàn W = 0 sau chốt; `TIEU_HAO` là nguồn cột "Xuất SX" `/nxt-nl`; đề nghị cấp đông "chờ duyệt" (H2). **End**: ngày SX chốt; sàn ≠ 0 mà chưa chốt ⇒ nhắc tổ trưởng.

### Flow NV3 — Còn dở: duyệt / dùng lại / hủy · owner: tổ trưởng SX
- **Input**: kg ở `chờ cấp đông` của xưởng, đề nghị còn "chờ duyệt". **Steps**: (a) để thủ kho duyệt (→ NV4); **(b) dùng lại sáng hôm sau**: `CHUYEN_KHO` `chờ cấp đông` → sàn (không qua thủ kho), đề nghị đóng "dùng lại"; **(c) hủy** với lý do ⇒ `HAO_HUT(hủy đề nghị)` hoặc về sàn. Đã duyệt ⇒ chỉ còn đường NV5.
- **Output**: kg luôn ở đúng một vị trí. **End**: (a) H2 · (b)(c) về sàn/hao. Quay vòng ≥ 3 ngày ⇒ nhắc (H2).

### Flow NV4 — Duyệt cấp đông vào kho dự trữ · owner: thủ kho dự trữ
- **Input**: đề nghị "chờ duyệt" + kg thực cân + kho/vị trí + (tùy chọn) phân bổ lô gốc + **loại: NL chưa chế biến (sổ này) / BTP sơ chế (sổ 34)** theo ánh xạ NV11 (Open-5). **Steps**: duyệt ⇒ sinh lô `F` (n gốc, kg kiểu `lot_inputs`), `CAP_DONG` (`chờ cấp đông` → kho X), `HAO_HUT(cấp đông)` = khai − thực (cân dư ⇒ `DIEU_CHINH` +) có lý do; chênh thông báo tổ trưởng (H2b).
- **Output**: tồn(F, kho X) = kg thực; `chờ cấp đông` −kg khai; XNT kho X cột **Nhập** +kg thực. **End**: F trong tồn kho dự trữ; hộ chiếu F truy ngược n lô gốc. Một kg ở đúng một sổ (R16).

### Flow NV5 — Xả đông lô F ra sàn · owner: thủ kho dự trữ
- **Input**: lô F (quét/chọn, gợi ý cũ trước), kg xuất, xưởng nhận; kg cân lại sau rã (tùy chọn, cuối ngày).
- **Steps**: `XA_DONG` một sự kiện: tồn(F, kho) −X ⇔ tồn(F, sàn W) +X (hai chân, giữ lô). Cân lại Y < X ⇒ `HAO_HUT(rã đông)` = X−Y trên sàn. **Kho thuê ngoài luôn đi đường này.** *Nếu Open-4 = tổ trưởng*: kho dự trữ **nội bộ** cho tổ trưởng tự ghi `XA_DONG` (quét lô F) và NV4 duyệt cũng về tổ trưởng cho nhất quán — Optimizer không khuyến nghị.
- **Output**: kho −X; sàn W có F. **End**: tổ trưởng tiêu hao qua NV2b (H3). Thứ tự ưu tiên F (đã xả) vs S (tươi) khi phân bổ tiêu hao — Open-6.

### Flow NV6 — Chuyển kho / gửi kho ngoài / chuyển lô tươi giữa xưởng · owner: thủ kho
- **Input**: lô, kg, vị trí đích. **Steps**: `CHUYEN_KHO` (−A, +B); kho thuê ngoài cần xác nhận nhận ⇒ qua `đang chuyển` 2 bước (kg không mất). **Output**: tồn theo vị trí đổi, Σ lô không đổi. **End**: hộ chiếu ghi vị trí mới.

### Flow NV6b — Xuất NL ra ngoài · owner: thủ kho
- **Input**: lô, kg, đích (trả đại lý / bán thẳng / xí nghiệp khác), chứng từ. **Steps**: `XUAT_NGOAI` −kg, **không** vào `TIEU_HAO`/định mức. **Output**: tồn giảm; XNT cột Xuất loại riêng, cờ "chưa ráp tiền" (H8). **End**: kế toán ráp tiền.

### Flow NV7a — Điều chỉnh kho tươi & sàn · owner: tổ trưởng SX (kế toán xác nhận)
- **Input**: lô/vị trí ở xưởng, kg thực, lý do. **Steps**: `DIEU_CHINH` ± **hiệu lực ngay** (mở được chốt ngày, H7); kế toán xác nhận trong tháng. **Output**: tồn = thực; điều chỉnh chưa xác nhận cờ ở chốt tháng. **End**: H4.

### Flow NV7b — Kiểm kê & điều chỉnh kho dự trữ · owner: thủ kho (kế toán xác nhận)
- **Input**: đếm thực theo lô/vị trí — **block × quy cách kg/block của lô ⇒ kg** (lô không có quy cách ⇒ nhập kg), lý do. **Steps**: `DIEU_CHINH` ±; đây là đường duy nhất hợp thức tồn âm trước chốt (R13). **Output**: tồn = thực đếm, bằng chứng. **End**: H4.

### Flow NV8 — Sổ tồn theo ngày & hộ chiếu lô · owner: kế toán (readers: BGĐ, thủ kho, tổ trưởng)
- **Input**: ngày, lọc vị trí/xưởng/họ NL/lô. **Steps**: cộng dồn sự kiện `effective_date` ≤ ngày theo (lô × vị trí). **Output**: tồn theo lô và gộp; cột nhận · lấy ra · tiêu hao · cấp đông · xả đông · điều chỉnh · còn; hộ chiếu lô (đã có `/qr`) đọc cùng sổ. **End**: đọc.

### Flow NV9a — Đối chiếu tháng 2 tầng · owner: kế toán
- **Input**: tháng M, sổ sự kiện (effective ∈ M), `accounting_code` (NV11), sổ tay (`nxt_snapshots`, `monthly_stock_ledger`). **Steps**: dựng NXT kỳ (kho × mã) + sổ tháng từ sự kiện → **tầng 1 theo TÊN** (lọc báo giả tách size/đổi mã, học 36) → **tầng 2 theo MÃ** → Δ ≠ 0 ⇒ "cần giải thích" (→ NV7) hoặc "đã giải thích" (ghi nhớ, không cờ lại) → **gợi ý điền sổ tay** từ sổ sự kiện, kế toán **xác nhận từng dòng** (không ghi đè).
- **Output**: bảng Δ hai tầng; sổ tay chỉ đổi ở dòng kế toán chấp nhận. **Giai đoạn song song** (≥ 2 tháng): sổ tay là chân lý tới khi kế toán tuyên dừng. **End**: NV9b.

### Flow NV9b — Chốt tháng / chốt lại · owner: kế toán
- **Input**: M đã đối chiếu, 0 Δ tầng mã chưa giải thích, 0 điều chỉnh chưa xác nhận, 0 lô âm, 0 lô chưa ánh xạ. **Steps**: chốt ⇒ M "đã chốt". Ghi bù lùi effective ∈ M sau đó ⇒ M "**chốt bị hở**" (vết: ai, sự kiện nào) ⇒ chốt lại có lịch sử (R12). Ghi bù lùi qua **mốc cutover** ⇒ từ chối. **Output**: tồn đầu M+1 = cộng dồn (không chép). **End**: BGĐ xem (H6).

### Flow NV10 — Nạp tồn đầu cutover · owner: kế toán
- **Input**: báo cáo XNT T8 từng kho (`/nxt-kho` đã nạp được xlsx; pdf theo spec cutover); **đếm tồn tươi tại xưởng** ngày mốc (tổ trưởng, H0). **Steps**: nạp → **bắt chọn kho tường minh** (không mặc định — memory K1000T/K1500T) → xem trước → **kiểm chéo với `nxt_snapshots` T8 cùng kho/kỳ** (lệch ⇒ cảnh báo, không chặn) → xác nhận map `accounting_code`→(họ NL, xưởng, NL/BTP) (NV11) → sinh `TON_DAU` một lần/(lô K, vị trí) tại mốc; tồn tươi ⇒ `TON_DAU` ở `kho tươi xưởng` theo lô S nếu chuyến có trong app (effective < mốc, không sinh `NHAP_MUA`). Nạp lại sau khi kế toán sửa báo cáo = `DAO` + mới có lý do.
- **Output**: tồn 01/09 theo lô/vị trí = báo cáo T8 + tồn tươi. **End**: sổ có điểm gốc; `/nxt-kho` giữ làm sổ đối chiếu.

### Flow NV11 — Ánh xạ mã kế toán · owner: kế toán
- **Input**: mã kế toán nguyên văn + tên hàng; danh mục họ NL/xưởng. **Steps**: gán mã ↔ (họ NL, xưởng, nhóm tên, **NL hay BTP** — Open-5) một lần; mã mới ⇒ hàng đợi "chưa ánh xạ" (H5). **Output**: mọi lô có `accounting_code` hoặc cờ. **End**: NV9a tầng mã chạy được.

## 6. Flow optimization log (B5 — Suggester → Specialist → Optimizer; Orchestrator trọng tài)
| Flow | Candidate | Cổng Specialist | Chọn / Loại | Lý do (rubric #) | Conflict & xử |
|---|---|---|---|---|---|
| NV2 | 2A quét/chọn từng lô lúc lấy | ✓ (sàn có lô, `LAY_RA`≠`TIEU_HAO`) | **Chọn — chế độ "tới lô"** | #1–#4 ✓, #6 ✓ (≤30 s); #5 ✗ khi tem chưa phủ | Mặc định hay phụ tùy **Open-1**; bắt buộc quét khi tem ≥ 90% |
| NV2 | 2B theo họ NL, hệ FIFO, cho sửa | ✓ có điều kiện: phân bổ **chỉ trong kho tươi xưởng** | **Chọn — chế độ mặc định nếu Open-1 = họ NL** (AC-5) | #5 ✓ ít bước nhất; #2 ✓ đề xuất sửa được; #6 ✓ (≤60 s) | Sửa phải **trước chốt ngày** (R13); phân bổ tiêu hao S/F theo **Open-6** |
| NV2 | 2C ghi lô↔mẻ trong phiên `/wip` | ✗ đứng riêng: không có chỗ "lấy ra chưa vào mẻ" | **Loại làm flow → thành NV2c (gắn mẻ tham chiếu)** | #2 ✗ đứng riêng; giải bằng sàn + `lot_inputs` (AC-4) | — |
| NV2 | 2D giấy trong xưởng → nhập phòng cuối ca | ✓ (`effective_date` = ngày lấy, khóa chống kép) | **Chọn — KÊNH NHẬP của 2A/2B** | #3 ✓ với ràng "nhập trước chốt ngày"; #5 trễ 1 ca là thực địa | Orchestrator: thêm 2 vai `actor`/`recorded_by` (§0.1, R5) + metric §1(4)/§8 |
| NV3+NV4 | 3A 2 bước 2 người | ✓ (nhịp 34; khai−thực = hao) | **Chọn** | #1 ✓ mỗi NV một owner; #3 ✓ treo gỡ bằng NV3(b)(c) + nhắc; #4 ✓ cross vì đổi người giữ hàng; #6 ✓ | (b)(c) chỉ khi còn "chờ duyệt" — ghi H2 |
| NV3+NV4 | 3B tổ trưởng tự cấp đông | ✗ mâu thuẫn nhịp 34; kg vào kho không do người giữ kho cân | **Loại** | #6 ✗ hao cấp đông mất nghĩa, sai lộ cuối tháng | Mở lại chỉ nếu **Open-4 = tổ trưởng** (đi cùng 5C) và không có kho thuê ngoài |
| NV3+NV4 | 3C hệ tự đề nghị theo định mức | ✗ định mức là số kỳ, không phải ngày | **Loại** | #2 ✗ output không suy từ dữ liệu ngày | Xét lại khi có định mức ngày (OUT) |
| NV5 | 5A 2 sự kiện xuất → nhận | ✗ dead-end nếu không nhận | **Loại** (2 bước chỉ giữ cho NV6 kho thuê ngoài — `đang chuyển`) | #3 ✗, #5 ✗ | — |
| NV5 | 5B 1 sự kiện 2 chân | ✓ (R3, sàn giữ F, hao rã riêng) | **Chọn — mặc định** | #1–#6 ✓ (AC-9) | Phụ thuộc Open-4 = thủ kho (mặc định an toàn) |
| NV5 | 5C tổ trưởng tự lấy lô đông | ✓ mô hình; thủ kho mất kiểm soát; không dùng cho kho thuê ngoài | **Chọn CÓ ĐIỀU KIỆN** — chỉ nếu Open-4 = tổ trưởng, chỉ kho nội bộ | #4/#5 tốt; #6 yếu (hao rã không ai xác nhận kg xuất) | Suggester: 5C kéo 3B — **Optimizer không khuyến nghị cặp này** |
| NV9 | 9A song song ≥ 2 tháng rồi dừng | ✓ (R10, A5) | **Chọn, ghép 9C** | #6 ✓ metric dừng = Δ tầng mã 0 hai tháng | Người tuyên dừng = kế toán |
| NV9 | 9B cutover cứng | ✗ không oracle, RED trên sổ thật | **Loại** | #6 ✗ | — |
| NV9 | 9C sổ sự kiện = gợi ý điền sổ tay | ✓ (không ghi đè, xác nhận từng dòng) | **Loại làm flow → bước trong NV9a** | Đứng riêng #6 ✗ (không tiến tới một sự thật) | AC-14 chừa ngoại lệ "dòng kế toán chấp nhận" |
| NV10 | 10A nạp file XNT T8 → `TON_DAU` | ✓ (NV11, lô K, R14) | **Chọn — nguồn chính** | #2 ✓ metric lệch 0 kg; #3 ✓ xem trước + **bắt chọn kho** | Phụ thuộc **Open-5** (mã sơ chế NL/BTP) — chưa chốt thì lô K có thể chở kg BTP (R16) |
| NV10 | 10B kế thừa `nxt_snapshots` | △ có thể thiếu/sửa tay | **Loại làm nguồn; giữ làm KIỂM CHÉO** | #2 ✗ input không đảm bảo; bước đối chiếu rẻ, tăng #6 | — |
| NV10 | 10C khai tay theo lô/kho | ✗ cho kho dự trữ | **Loại cho kho; giữ CHỈ cho tồn tươi tại xưởng** | #6 ✗ nếu dùng cho kho; tồn tươi không có trong báo cáo nên phải đếm | — |
| Map | Cross-User-Integrity: 15 điểm gãy (d4 · e5 · b1 · c1 · f2 · h1 · g1; a0) | — | **Đã vá ở v2**: NV8 owner kế toán; `LAY_RA` chỉ từ kho tươi; NV7a/7b; NV2c; NV9a/9b; H0/H2b/H7/H8/H9; nhắc quay vòng ≥3 ngày; Quản trị + owner-khi-hỏng; AC-19 = invariant | — | Open-4 vẫn làm owner NV5 phụ thuộc — mặc định an toàn thủ kho |

## 7. Scope & Priority
- **Pha 1 — khép G1, tồn thật (Must):** NV1 phái sinh · **NV2 + NV2c + NV2b** (`LAY_RA`, `lot_inputs`, `TIEU_HAO`, `CON_DO` nối `leftover_by_material`) · NV3 (dùng lại/hủy) · NV7a · NV8 · NV11 · NV10 (khi có file). Kết quả đo: cột Xuất SX `/nxt-nl` = Σ `TIEU_HAO` ≠ 0; tồn theo ngày đã trừ chế biến.
- **Pha 2 — vòng đông theo lô (Must):** NV4, NV5, NV6, NV6b, NV7b (hao rã đông, lô F n-gốc, kho thuê ngoài 2 bước).
- **Pha 3 — một sự thật (Must):** NV9a/NV9b; `nxt_snapshots` + `monthly_stock_ledger` thành sổ đối chiếu + nhận gợi ý điền; dừng gõ tay khi kế toán tuyên (≥ 2 tháng Δ tầng mã = 0 không giải thích).
- **OUT:** định giá/BQGQ (QĐ-7 chờ — kg-first) · SSCC/GDST · tồn BTP/TP (34) · role-RLS/site_id · khóa cứng bản ghi · cảm biến nhiệt · định mức theo ngày.

## 8. Success metric
| NV | Metric | Ngưỡng |
|---|---|---|
| NV2/NV2b | Σ `TIEU_HAO` tháng / Σ NL vào theo Cân đối cùng tháng | ≥ 90% sau 1 tháng pha 1 |
| NV2 | thời gian ghi 1 lần lấy ra (tại chỗ) | ≤ 30 s quét · ≤ 60 s chọn |
| NV2 (kênh giấy) | % kg `LAY_RA` có `recorded_at` cùng ngày `effective_date` | ≥ 95% |
| NV2 (kênh giấy) | dòng giấy nhập **sau** chốt ngày (đi `DAO`) | ≤ 2 dòng/tháng/xưởng |
| NV2b | số ngày có SX mà sàn ≠ 0 sau chốt | == 0 |
| NV3 | đề nghị "chờ duyệt" quá 1 ngày | == 0 tại chốt tháng |
| NV9a | Δ tầng mã không giải thích, 2 tháng liên tiếp | == 0 mặt hàng trước khi dừng sổ tay |
| NV7/R13 | lô âm tại mốc chốt ngày SX / chốt tháng | == 0 |
| NV7 | `DIEU_CHINH` chưa kế toán xác nhận tại chốt tháng | == 0 |
| NV10 | tồn 01/09 (lô K, kho) ↔ tồn cuối T8 báo cáo | lệch == 0 kg mọi dòng |
| NV11 | lô "chưa ánh xạ" tại chốt tháng | == 0 |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | **Tồn(lô, vị trí, t) = Σ sự kiện effective ≤ t.** Không lưu tồn; `TON_DAU` là sự kiện. | Sửa sự kiện cũ đổi tồn về sau — cho phép, rơi vào tháng đã chốt ⇒ R12. |
| R2 | **Chống đếm đôi trên TỔNG HỆ (kho + sàn):** chỉ `TON_DAU`, `NHAP_MUA` làm tổng tăng; `LAY_RA`/`XA_DONG`/`CON_DO`/`CAP_DONG`/`CHUYEN_KHO` là chuyển vị trí, tổng = 0; `TIEU_HAO`/`XUAT_NGOAI`/`HAO_HUT` làm tổng giảm. XNT **theo kho** vẫn hiện `CAP_DONG` ở cột Nhập. | Còn dở KHÔNG phải nhập mới. Nhập trước mốc `TON_DAU` KHÔNG phái sinh (R14). |
| R3 | **Hai chân một sự kiện**: `XA_DONG`, `LAY_RA`, `CHUYEN_KHO` ghi −nguồn ⇔ +đích cùng bản ghi. | Mất mạng ⇒ hàng chờ giữ cả sự kiện; không nửa vời. |
| R4 | **Sửa = `DAO` + mới, kèm lý do; bản gốc giữ** (append-only; khớp ghi bù + `audit_log`/0048). | Xóa lô = đảo toàn bộ sự kiện của lô, có lý do. |
| R5 | **Mọi sự kiện có `actor` (người thao tác gốc) · `recorded_by` (người nhập, nếu khác) · `recorded_at` · `effective_date` · nguồn · xưởng.** Phái sinh: actor = người thao tác bản gốc. | Nhập giấy: actor = người ghi giấy, recorded_by = người gõ. |
| R6 | **Kg-first; đơn giá chỉ mang theo** từ chuyến; sổ không tính giá vốn/BQGQ. | Kế toán ráp tiền ở lớp báo cáo. |
| R7 | **Sổ không đụng Cân đối** (`balancingCalc.ts`) và tồn BTP/TP (`tinhTon`); chỉ nối một chiều để **đối chiếu** (metric NV2). | |
| R8 | **Lô S = chuyến, sự kiện theo dòng loại NL** (Open-3); lô F sinh khi duyệt cấp đông (n gốc); lô K chỉ từ cutover, tự đóng khi về 0. Nhãn người đọc = `lot_code`/suy ra (QR §4.1). | Chuyến 1 dòng ⇒ 1 sự kiện. |
| R9 | **`LAY_RA` chỉ từ `kho tươi xưởng`; mọi chuyển động khỏi kho dự trữ là `XA_DONG` (hoặc `CHUYEN_KHO`/`XUAT_NGOAI`).** Một hành vi vật lý = một loại sự kiện = một owner. | Open-4 = tổ trưởng ⇒ tổ trưởng ghi `XA_DONG` (không đổi loại sự kiện). |
| R10 | **NXT kỳ & sổ tháng = cách nhìn của sổ sự kiện** (pha 3). Song song: **sổ tay là chân lý**; sổ sự kiện chỉ cờ lệch + gợi ý điền có xác nhận, không ghi đè. | Δ đã giải thích được ghi nhớ, không cờ lại. |
| R11 | **Sàn SX là vị trí có lô; `LAY_RA` ≠ `TIEU_HAO`.** Chốt ngày SX đóng sàn: `TIEU_HAO` = Σ sàn − còn dở. | Chưa chốt ⇒ sàn còn số, nhắc; lấy vượt kho ⇒ R13. |
| R12 | **`effective_date` quyết tồn ngày/tháng.** Sự kiện effective rơi vào tháng đã chốt ⇒ "chốt bị hở", chốt lại có vết (không khóa cứng, không âm thầm). | Ghi bù lùi **qua mốc cutover ⇒ từ chối**; chỉ đi `DIEU_CHINH` tại mốc. |
| R13 | **Tồn(lô, vị trí) ≥ 0 tại mọi mốc chốt** (ngày SX, tháng). Âm chỉ tạm trong ngày; phải hóa thành `DIEU_CHINH` (hiệu lực ngay) hoặc phân bổ lại trước chốt. **Cấm dồn âm sang kỳ sau.** | Chốt ngày SX gặp lô âm ⇒ chặn, đi H7. |
| R14 | **Phái sinh chỉ cho bản ghi effective ≥ mốc cutover.** Sửa/xóa chuyến, mẻ, chốt ngày ⇒ `DAO` tự động kế thừa lý do. | Đảo làm lô âm ⇒ R13. Nạp lại baseline = `DAO` + mới. |
| R15 | **Mỗi lô có `accounting_code` hoặc cờ "chưa ánh xạ"** (NV11). Đối chiếu 2 tầng: tên → mã. | Mã tách size giữa tháng ⇒ tầng tên triệt tiêu, tầng mã "cần giải thích". |
| R16 | **Một kg ở đúng một sổ:** cấp đông khai NL (sổ này) hoặc BTP (34) theo ánh xạ mã, không cả hai. | Đổi loại = `DAO` ở sổ này + nhập ở sổ kia, có lý do. |
| R17 | **Lô F có thể n gốc**, kg phân bổ kiểu `lot_inputs`; không chỉ rõ ⇒ tỷ lệ lấy ra trong ngày, cờ "tự chia". | Hộ chiếu F liệt kê mọi gốc với kg. |
| R18 | **Hao hụt ghi riêng theo nguyên nhân** (cấp đông · rã đông · lưu kho · kiểm kê · hủy đề nghị), không gộp vào `TIEU_HAO`; cân dư = `DIEU_CHINH` +. | |
| R19 | **`XUAT_NGOAI` không vào định mức/tiêu hao**; có chứng từ; cờ "chưa ráp tiền" tới khi kế toán xử. | |
| R20 | **Kênh giấy phải nhập xong trước chốt ngày SX**; có khóa "đã nhập" theo (xưởng, ngày, lô/họ, kg) chống ghi kép giấy + quét. | Nhập sau chốt ⇒ đi `DAO` (đếm metric §8). |
| R21 | **`DIEU_CHINH` hiệu lực ngay** để mở chốt ngày; kế toán xác nhận trong tháng; chưa xác nhận ⇒ cờ chốt tháng, không chặn ngày. | |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Chuyến lưu ⇒ `NHAP_MUA` theo dòng, tồn kho tươi = kg nhập · Maps to flow: NV1 · Test: integration
- **Given** chuyến C effective ≥ mốc cutover, 2 dòng (Bạch tuộc 2 da 300 kg, Mực 200 kg), xưởng Đông
- **When** người nhập hàng lưu chuyến
- **Then** đúng 2 sự kiện `NHAP_MUA` lô `S:C` tại `kho tươi Đông`; tồn theo loại = 300 và 200; tổng hệ +500
- **Assert** count(NHAP_MUA, lô=S:C) == 2 && tồn(S:C,"Bạch tuộc 2 da",kho tươi Đông) == 300 && tồn(S:C,"Mực",kho tươi Đông) == 200 && Δtổng hệ == +500

### AC-2 — Lấy ra là CHUYỂN kho tươi→sàn, giữ lô, tổng hệ không đổi · Maps to flow: NV2 · Test: e2e
- **Given** S:C còn 300 kg Bạch tuộc 2 da ở kho tươi Đông; sàn Đông = 0
- **When** tổ trưởng ghi lấy 120 kg từ S:C trong ngày D
- **Then** tồn(S:C, kho tươi) = 180; tồn(S:C, sàn Đông) = 120; tổng hệ vẫn 500; chưa có `TIEU_HAO`
- **Assert** tồn(S:C,kho tươi) == 180 && tồn(S:C,sàn Đông) == 120 && Δtổng hệ == 0 && count(TIEU_HAO ngày D) == 0

### AC-3 — Chốt ngày SX đóng sàn: tiêu hao = sàn − còn dở, cột Xuất SX ≠ 0 · Maps to flow: NV2b · Test: e2e
- **Given** sàn Đông ngày D có S:C 120 kg; tổ trưởng khai còn dở 30 kg Bạch tuộc 2 da; không lô âm
- **When** chốt ngày SX D
- **Then** `TIEU_HAO` = 90 (S:C); `CON_DO` 30 kg S:C → `chờ cấp đông`; sàn Đông = 0; `/nxt-nl` ngày D cột Xuất SX = 90; tổng hệ = 410
- **Assert** Σ TIEU_HAO(D,Đông) == 90 && tồn(S:C,chờ cấp đông) == 30 && tồn(*,sàn Đông) == 0 && xuatSX(/nxt-nl, D, "Bạch tuộc 2 da", Đông) == 90 && tổng hệ == 410

### AC-4 — Gắn mẻ ⇒ `lot_inputs` tham chiếu, không trừ lần hai · Maps to flow: NV2c · Test: integration
- **Given** mẻ W ngày D; S:C có 120 kg trên sàn
- **When** tổ trưởng gắn 100 kg S:C vào W
- **Then** 1 `lot_inputs`(W ← S:C, 100); tồn sàn vẫn 120; sau chốt ngày `TIEU_HAO` không cộng đôi
- **Assert** count(lot_inputs W←S:C) == 1 && lot_inputs.quantity_kg == 100 && tồn(S:C,sàn) trước chốt == 120 && Σ TIEU_HAO(S:C,D) == 120 − còn dở

### AC-5 — Chế độ theo họ NL phân bổ lô cũ trước, chỉ trong kho tươi xưởng, cho sửa · Maps to flow: NV2 · Test: unit
- **Given** kho tươi Đông có L1 (về 01/09, 100 kg) và L2 (03/09, 200 kg) cùng họ; kho dự trữ có F9 cùng họ 500 kg
- **When** ghi lấy 150 kg "Bạch tuộc 2 da" không chỉ lô
- **Then** đề xuất `LAY_RA` L1 100 + L2 50 (cờ "hệ phân bổ"), **không đụng F9**, cho sửa trước khi lưu
- **Assert** đềXuất == [{L1,100},{L2,50}] && F9 ∉ đềXuất && cờ "hệ phân bổ" == true && sau lưu tồn(L1,kho tươi) == 0 && tồn(L2,kho tươi) == 150

### AC-6 — Âm chỉ tạm trong ngày; chốt ngày SX chặn khi còn lô âm; `DIEU_CHINH` của tổ trưởng mở chốt · Maps to flow: NV2b/NV7a · Test: e2e
- **Given** L còn 50 kg kho tươi Đông
- **When** ghi lấy 60 kg (âm tạm, có lý do) rồi bấm chốt ngày; sau đó tổ trưởng `DIEU_CHINH` +10 lý do "cân lại" và chốt lần 2
- **Then** lần 1 chốt bị từ chối "còn lô âm"; `DIEU_CHINH` hiệu lực ngay (không chờ kế toán); lần 2 chốt được; tồn(L,kho tươi) = 0; điều chỉnh mang cờ "chưa kế toán xác nhận"
- **Assert** tồn(L,kho tươi) sau lấy == -10 && chốt lần 1 == false && lỗi == "con-lo-am" && chốt lần 2 == true && tồn(L,kho tươi) == 0 && DIEU_CHINH.xacNhanKeToan == false

### AC-7 — Còn dở dùng lại sáng hôm sau, không kẹt · Maps to flow: NV3 · Test: integration
- **Given** 30 kg S:C ở `chờ cấp đông`, đề nghị "chờ duyệt"
- **When** tổ trưởng chọn "dùng lại" sáng D+1
- **Then** `CHUYEN_KHO` `chờ cấp đông` → sàn Đông 30 kg (không cần thủ kho); đề nghị đóng "dùng lại"; tổng hệ không đổi
- **Assert** tồn(S:C,chờ cấp đông) == 0 && tồn(S:C,sàn Đông) == 30 && đềNghị.trạngThái == "đã hủy — dùng lại" && Δtổng hệ == 0

### AC-8 — Hủy đề nghị cấp đông có lý do ⇒ hao hụt, không mất dấu · Maps to flow: NV3 · Test: integration
- **Given** 30 kg S:C ở `chờ cấp đông`, "chờ duyệt"
- **When** tổ trưởng hủy với lý do "hư, bỏ"
- **Then** `HAO_HUT(hủy đề nghị)` 30 kg có lý do; `chờ cấp đông` = 0; tổng hệ −30; đề nghị đóng "đã hủy"
- **Assert** HAO_HUT.nguyenNhan == "hủy đề nghị" && HAO_HUT.kg == 30 && HAO_HUT.lyDo.length >= 1 && tồn(S:C,chờ cấp đông) == 0 && Δtổng hệ == -30

### AC-9 — Duyệt cấp đông theo kg thực, lô F n-gốc, hao riêng, XNT kho ghi Nhập, thông báo chênh · Maps to flow: NV4 · Test: e2e
- **Given** `chờ cấp đông` Đông có 30 kg S:C + 50 kg S:D cùng họ, đã ánh xạ NL
- **When** thủ kho duyệt kg thực 78, kho K1000T, lý do chênh "hao cấp đông", không chỉ rõ phân bổ
- **Then** sinh F1 (gốc S:C 30·S:D 50, cờ "tự chia") tồn 78 tại K1000T; `HAO_HUT(cấp đông)` = 2 có lý do; `chờ cấp đông` = 0; XNT K1000T cột Nhập +78; tổ trưởng nhận thông báo chênh; tổng hệ −2
- **Assert** tồn(F1,K1000T) == 78 && truyNguoc(F1) == {S:C:30, S:D:50} && HAO_HUT.kg == 2 && HAO_HUT.lyDo.length >= 1 && nxtKho(K1000T).nhap chứa +78 && count(thôngBáo tổ trưởng) == 1 && Δtổng hệ == -2

### AC-10 — Xả đông hai chân giữ lô, hao rã đông ghi riêng · Maps to flow: NV5 · Test: integration
- **Given** F1 tồn 78 kg tại K1000T
- **When** thủ kho xả 50 kg cho xưởng Đông; cuối ngày cân lại 47 kg
- **Then** 1 sự kiện `XA_DONG`: tồn(F1,K1000T) = 28 ⇔ tồn(F1,sàn Đông) = 50; `HAO_HUT(rã đông)` = 3 trên sàn; F1 truy xuất được trên sàn
- **Assert** count(XA_DONG) == 1 && tồn(F1,K1000T) == 28 && tồn(F1,sàn Đông) sau hao == 47 && HAO_HUT(rã đông).kg == 3

### AC-11 — Không lấy `LAY_RA` từ kho dự trữ · Maps to flow: NV2 · Test: unit
- **Given** F1 tồn 28 kg tại K1000T
- **When** tổ trưởng ghi `LAY_RA` từ F1 (kho dự trữ)
- **Then** hệ từ chối với mã "kho dự trữ đi xả đông"; không sự kiện nào sinh
- **Assert** lưu == false && lỗi == "kho-du-tru-di-xa-dong" && count(sự kiện F1 mới) == 0

### AC-12 — Chuyển kho thuê ngoài tổng lô không đổi, qua "đang chuyển" · Maps to flow: NV6 · Test: unit
- **Given** F1 tồn 28 tại K1000T
- **When** gửi 28 kg sang "Kho Ánh Dương"; kho nhận xác nhận
- **Then** trước xác nhận tồn(F1,đang chuyển) = 28; sau xác nhận tồn(F1,Ánh Dương) = 28, tồn(F1,K1000T) = 0; Σ lô = 28 mọi lúc
- **Assert** Σtồn(F1) == 28 tại mọi bước && tồn(F1,"Kho Ánh Dương") sau xác nhận == 28 && tồn(F1,đang chuyển) sau xác nhận == 0

### AC-13 — Sửa/xóa chuyến đã có phái sinh ⇒ `DAO` tự động, bản gốc giữ · Maps to flow: NV1/NV2 · Test: integration
- **Given** S:C có `NHAP_MUA` 300 và `LAY_RA` 120
- **When** người nhập hàng sửa dòng chuyến 300 → 280 lý do "cân lại"
- **Then** sổ có `DAO`(−300) + `NHAP_MUA` mới 280 (lý do kế thừa); tồn(S:C,kho tươi) = 160; bản gốc còn; audit_log có vết
- **Assert** count(sự kiện S:C loại NHAP_MUA/DAO) == 3 && tồn(S:C,kho tươi) == 160 && sựKiệnGốc.kg == 300 && count(audit_log entity=sự kiện S:C) >= 1

### AC-14 — Ghi bù lùi vào tháng đã chốt ⇒ "chốt bị hở"; qua mốc cutover ⇒ từ chối · Maps to flow: NV9b · Test: integration
- **Given** tháng M "đã chốt"; mốc cutover = 01/09
- **When** (a) ghi sự kiện effective ∈ M vào ngày thuộc M+1; (b) ghi sự kiện effective 25/08 (trước mốc)
- **Then** (a) M "chốt bị hở" với vết, tồn đầu M+1 cập nhật, chốt lại ⇒ "đã chốt" lần 2; (b) từ chối với mã "trước mốc cutover"
- **Assert** trạngThái(M) == "chốt bị hở" && count(vết hở) == 1 && sau chốt lại count(lịch sử chốt M) == 2 && (b).lưu == false && (b).lỗi == "truoc-moc-cutover"

### AC-15 — Tồn theo ngày = phương trình; không lô âm, không điều chỉnh chưa xác nhận tại chốt tháng · Maps to flow: NV8/NV9b · Test: unit
- **Given** mọi sự kiện của lô L trong tháng M
- **When** tính tồn(L, vị trí V, cuối M) và kiểm điều kiện chốt
- **Then** = Σ(+đến V) − Σ(−khỏi V) theo effective ≤ cuối M; không (lô, vị trí) âm; không `DIEU_CHINH` chưa xác nhận
- **Assert** |tồn − côngThức| == 0 (numeric 14,3) && count((lô,vị trí) âm tại chốt M) == 0 && count(DIEU_CHINH.xacNhanKeToan == false, M) == 0

### AC-16 — Đối chiếu 2 tầng, gợi ý điền có xác nhận, nhớ lệch đã giải thích · Maps to flow: NV9a · Test: integration
- **Given** tháng M có sổ sự kiện, `accounting_code` đủ, `nxt_snapshots` gõ tay cùng kho/kỳ; M−1 có 1 lệch đã giải thích
- **When** kế toán đối chiếu M và chấp nhận gợi ý điền cho 2 dòng
- **Then** tầng tên và tầng mã có Δ; lệch M−1 không cờ lại; `nxt_snapshots` chỉ đổi đúng 2 dòng kế toán chấp nhận, các dòng khác không đổi
- **Assert** count(Δ tầng mã) == count(mã có sự kiện) && lệch(M−1).trạngThái == "đã giải thích" && count(dòng nxt_snapshots thay đổi) == 2 && mọi dòng khác updated_at không đổi

### AC-17 — Dồn tồn cuối → đầu tháng sau không chép · Maps to flow: NV9b · Test: integration
- **Given** M đã chốt, tồn(L,V,cuối M) = 28
- **When** đọc tồn(L,V, 00:00 ngày 1 M+1)
- **Then** = 28 và không `TON_DAU` nào được tạo thêm
- **Assert** tồn(L,V,đầu M+1) == 28 && count(TON_DAU của L) <= 1

### AC-18 — Tồn đầu cutover một lần, không đếm đôi, kiểm chéo snapshot, có tồn tươi · Maps to flow: NV10 · Test: integration
- **Given** báo cáo T8 K1000T: `PXĐ.BTNL.TĐ 1008` tồn cuối 4.200 (đã ánh xạ NL); `nxt_snapshots` T8 cùng mã ghi 4.150; app có chuyến 30/08 (effective < mốc) 500 kg, tổ trưởng đếm tươi 500
- **When** kế toán chọn kho K1000T tường minh, nạp hai lần cùng file
- **Then** cảnh báo kiểm chéo Δ 50 (không chặn); đúng 1 `TON_DAU`(K:1008,K1000T) 4.200; 1 `TON_DAU`(S:chuyến 30/08, kho tươi) 500; chuyến 30/08 không có `NHAP_MUA`; tồn 01/09 = 4.700
- **Assert** cảnhBáo.kiemCheo.delta == 50 && count(TON_DAU,(1008,K1000T)) == 1 && count(NHAP_MUA chuyến 30/08) == 0 && tồn(1008,K1000T,01/09) == 4200 && tồn(S:3008,kho tươi,01/09) == 500

### AC-19 — Lô chưa ánh xạ bị cờ, loại khỏi tầng mã · Maps to flow: NV11/NV9a · Test: unit
- **Given** lô S:E có họ NL nhưng chưa có `accounting_code`
- **When** dựng NXT kỳ tháng M
- **Then** S:E ở tầng tên, không ở tầng mã; tháng M cờ "1 lô chưa ánh xạ"
- **Assert** S:E ∈ tầngTên && S:E ∉ tầngMã && cờ(M).soLoChuaAnhXa == 1

### AC-20 — Xuất NL ra ngoài không vào tiêu hao, cờ chưa ráp tiền · Maps to flow: NV6b · Test: unit
- **Given** S:C 100 kg kho tươi
- **When** thủ kho xuất trả đại lý 40 kg có chứng từ
- **Then** `XUAT_NGOAI` −40; `TIEU_HAO` không đổi; XNT cờ "chưa ráp tiền"
- **Assert** tồn(S:C,kho tươi) == 60 && Σ TIEU_HAO không đổi && XUAT_NGOAI.chungTu.length >= 1 && XUAT_NGOAI.trạngThái == "chưa ráp tiền"

### AC-21 — Kiểm kê kho dự trữ đếm block quy kg theo quy cách lô · Maps to flow: NV7b · Test: unit
- **Given** F1 quy cách 12 kg/block, tồn sổ 96 kg (8 block)
- **When** thủ kho đếm 7 block, lý do "thiếu 1 block"
- **Then** `DIEU_CHINH` −12 kg; tồn(F1) = 84; kế toán xác nhận sau
- **Assert** DIEU_CHINH.kg == -12 && tồn(F1) == 84 && DIEU_CHINH.lyDo.length >= 1 && DIEU_CHINH.xacNhanKeToan == false

### AC-22 — Kênh giấy: khóa chống ghi kép, tách actor/recorded_by, phải trước chốt · Maps to flow: NV2 · Test: integration
- **Given** ngày D xưởng Đông đã quét `LAY_RA` S:C 120 kg lúc 09:00 (actor = tổ trưởng T)
- **When** cuối ca nhân viên N nhập tờ giấy có dòng "S:C 120 kg"; rồi thử nhập thêm dòng "S:D 40 kg" sau khi ngày D đã chốt
- **Then** dòng S:C bị chặn "đã nhập"; dòng S:D sau chốt phải đi `DAO`+mới với lý do, `actor` = T, `recorded_by` = N, `effective_date` = D
- **Assert** count(LAY_RA S:C ngày D) == 1 && lỗi(dòng S:C) == "da-nhap" && sựKiện(S:D).actor == T && recorded_by == N && effective_date == D && count(DAO liên quan) >= 1

### AC-23 — Hàng đông mua về đi đường chuyến với cờ nguồn, không trừ kho mình · Maps to flow: NV1/NV5 · Test: integration
- **Given** kho dự trữ K1000T tồn 1.000 kg
- **When** người nhập hàng ghi chuyến hàng đông mua về 300 kg, cờ nguồn "mua về", vị trí K1000T
- **Then** `NHAP_MUA` +300 tại K1000T với cờ; tồn K1000T = 1.300; không có `XA_DONG`/`HAO_HUT` phát sinh
- **Assert** NHAP_MUA.coNguon == "mua về" && tồn(*,K1000T) == 1300 && count(XA_DONG mới) == 0

### AC-24 — Không đụng Cân đối và tồn BTP/TP · Maps to: invariant R7 (không gắn flow) · Test: unit
- **Given** bộ test hồi quy hiện có (`balancingCalc`, `inventory.tinhTon`)
- **When** sổ sự kiện ghi bất kỳ loại nào
- **Then** kết quả các hàm đó không đổi
- **Assert** test hồi quy pass == 100% && Δ(calculateBalancing(...)) == 0 && Δ(tinhTon(...)) == 0

## 11. Assumptions (fail-closed) / Open (chờ chủ dự án — KHÔNG tự chốt)
**Assumptions (tự quyết, đảo được):**
- A1 Lô S = chuyến, sự kiện theo dòng loại NL; lô F sinh lúc duyệt cấp đông, n gốc; lô K chỉ từ cutover, tự đóng khi về 0.
- A2 Kg là đơn vị của sổ; block/kiện là mô tả kèm + quy cách kg/block của lô để quy đổi kiểm kê.
- A3 `kho tươi xưởng`, `sàn SX xưởng` là vị trí mặc định theo xưởng — không bắt chọn lúc nhập/lấy.
- A4 `TIEU_HAO` phân bổ theo lô trên sàn: người chỉ rõ thì theo đó, không thì tỷ lệ (cờ "tự chia").
- A5 Song song ≥ 2 tháng; sổ tay là chân lý tới khi kế toán tuyên dừng.
- A6 Người thao tác = tài khoản đăng nhập; kênh giấy tách `actor`/`recorded_by`, không thêm khái niệm ca.
- A7 Hao rã đông ghi được cuối ngày.
- A8 Owner NV5 mặc định = thủ kho (giữ kiểm soát kho lạnh, hao hai chiều đo được) tới khi Open-4 chốt khác.
- A9 `DIEU_CHINH` hiệu lực ngay; xác nhận kế toán là cờ, không chặn nghiệp vụ ngày.

**Open (chủ dự án / xưởng chốt — ảnh hưởng flow NV2/NV4/NV5/NV10, R8/R9/R16):**
- **Open-1 (HOLD 2026-08-26):** mặc định ghi lấy NL **tới từng lô** (quét/chọn) hay **theo họ NL rồi hệ phân bổ FIFO, cho sửa**? Spec làm **cả hai**; câu này chốt mặc định. *Khuyến nghị:* mặc định họ NL + tự phân bổ; bắt buộc quét khi tem phủ ≥ 90% chuyến.
- **Open-2 (QR §7.1):** sinh mã lô ngay cổng (đang làm) hay sau sơ chế+đông — nếu "sau", thêm 1 tầng biến đổi, cùng mô hình.
- **Open-3 (QR §7.5):** lô = chuyến hay từng dòng NL — spec tạm lô = chuyến, sự kiện theo dòng.
- **Open-4 (QR §7.3):** **ai xả đông** — thủ kho (mặc định) hay tổ trưởng tự quét lô đông cho kho nội bộ (kéo theo NV4 về tổ trưởng; kho thuê ngoài vẫn thủ kho). Optimizer khuyến nghị **thủ kho**.
- **Open-5 (cutover §9 câu 3):** **ranh giới NL / BTP trong kho 1000**: hàng đã luộc/chần/tẩm bột trong báo cáo XNT là BTP (sổ 34) hay NL (sổ này)? Không chốt ⇒ NV9a lệch vĩnh viễn tầng mã và lô K có thể chở kg BTP (R16). *Khuyến nghị:* mã có dấu hiệu sơ chế → BTP; kế toán xác nhận từng mã ở NV11. **Cần chốt TRƯỚC khi nạp file T8.**
- **Open-6:** thứ tự ưu tiên dùng **F (đã xả, trên sàn)** trước hay **S (tươi)** trước khi hệ gợi ý tiêu hao. *Khuyến nghị:* F trước (đã rã, không để lâu).

## History
- v2 (2026-09-22): B5 hoàn tất. Optimizer điền §6 (chọn 2A+2B hai chế độ/2D kênh nhập · 3A · 5B mặc định · 9A ghép 9C · 10A + kiểm chéo; loại 2C/3B/3C/5A/9B/10B/10C). Cross-User-Integrity 15 điểm gãy → vá: NV8 owner kế toán; `LAY_RA` chỉ kho tươi (R9); NV7a/7b; NV2c; NV9a/9b; H0/H2b/H7/H8/H9; nhắc quay vòng; Quản trị/owner-khi-hỏng; AC-24 = invariant. Thêm R20/R21, AC-8/11/21/22/23, metric kênh giấy, `actor`/`recorded_by`. Chờ chủ dự án duyệt + chốt Open 1–6.
- v1 (2026-09-22): ráp điều kiện Domain-Specialist (6 veto → sàn SX là vị trí, `LAY_RA`≠`TIEU_HAO`, `CAP_DONG` = Nhập ở XNT kho, `effective_date` + chốt bị hở, cấm dồn âm, ánh xạ mã 2 tầng, phái sinh từ mốc; 8 ca thiếu; R11–R19). Thêm NV11.
- v0 (2026-09-22): nháp B1–B4. Nguồn: 12 doc theo routing-log 2026-09-22 + memory `ton-nl-theo-ngay-gap`, `kho-module-huong-data-first`.
