# Flow end-to-end & 2 giao diện bộ phận

> **Load khi:** thiết kế/nối luồng nhập → sản xuất → kho → bán → cân đối; tách giao diện theo bộ phận; định nghĩa việc-hằng-ngày.
> **Nguồn quyết định:** [`hop-2026-08-22-so-hoa-flow-2-bo-phan.md`](hop-2026-08-22-so-hoa-flow-2-bo-phan.md) (QĐ-1..6).
> **Đối chiếu code thật:** [`02-pages-navigation.md`](../app-map/02-pages-navigation.md) · [`34-btp-san-xuat-kho.ba-spec.md`](../app-map/34-btp-san-xuat-kho.ba-spec.md) · [`31-can-doi-ky.md`](../app-map/31-can-doi-ky.md).
> **last_verified:** 2026-08-22

File này mô tả **chuỗi giá trị end-to-end thật của xưởng**, chỉ đúng **chỗ đang đứt gãy**, và thiết kế **2 giao diện bộ phận** vận hành theo bước với **việc-hằng-ngày** rõ ràng. Danh sách hàm/màn cụ thể đọc thẳng ở app-map + source.

---

## 1. Chuỗi giá trị end-to-end (mục tiêu)

```
        BỘ PHẬN NHẬP HÀNG                 BỘ PHẬN SẢN XUẤT                 KHO / KINH DOANH            KẾ TOÁN
        ─────────────────                 ────────────────                 ────────────────           ───────
(1) Mua NL đổ xá  ──►  (2) Sơ chế: rửa, luộc/chần/cắt/tẩm bột  ──►  (3) Cấp đông thành block/lốc
        │                          │  (làm không hết trong ngày)                │
        │                          ▼                                            ▼
        │                 THÀNH PHẨM đã đóng gói                        BÁN THÀNH PHẨM (WIP) còn trong khuôn đá
        │                          │                                            │  → LƯU KHO DỰ TRỮ (đông gửi)
        │                          ▼                                            │
        │                 (4) Nhập kho thành phẩm ◄───── xả đông tái dùng ──────┘  (kỳ sau)
        │                          │
        │                          ├──► (5a) Gom đủ theo ĐƠN ĐẶT (số lượng lớn) ──► XUẤT CONTAINER (nhiều block/quy cách)
        │                          └──► (5b) BÁN thành phẩm ra (phiếu bán, XK/NĐ)
        ▼                                                                          
(6) CÂN ĐỐI KỲ  ◄── hút NL vào (từ 1) ── hút BTP làm ra (từ 2) ── hút bán (từ 5b) ──►  Lãi/Lỗ + Định mức + TỒN CUỐI KỲ
```

**Vòng lặp gối đầu** (điểm đau số 1): phần (3) chưa dùng hết → **đông gửi** sang kỳ sau; kỳ sau **xả đông** đưa lại pool nguyên liệu ở (2). Tồn cuối kỳ = tồn đầu + đông gửi − xả đông. Chi tiết mô hình: [`34` § Mô hình tồn](../app-map/34-btp-san-xuat-kho.ba-spec.md) · [`31` § Tồn kho nguyên liệu](../app-map/31-can-doi-ky.md).

---

## 2. Trạng thái thực từng mắt xích (2026-08-22)

Phân loại: **THẬT** = nối kho dữ liệu, ghi/sửa/chốt thật · **DEMO** = UI đủ nhưng chạy dữ liệu mẫu (tự dán nhãn "màn trưng bày").

| # | Mắt xích | Màn (route) | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 1 | Nhập nguyên liệu | Nhập hàng `/imports` | ✅ THẬT | Chuyến · 2 ngày · ghi bù · chốt ngày · phế liệu ngày |
| 2 | Sản xuất BTP ngày | Sản xuất BTP `/wip` | ✅ THẬT | Ghi sản lượng TP theo ngày/xưởng/loại NL · chốt ngày SX · ghi bù |
| 2' | Lệnh sản xuất | Lệnh sản xuất `/production` | 🟡 DEMO | `LSX_ROWS` mock — **chưa nối bảng thật** |
| 3 | Cấp đông / kho lạnh | Kho lạnh `/cold-storage` | 🟡 DEMO | Giám sát nhiệt/FIFO — **KHÔNG nối WIP** |
| 4 | Kho dự trữ (nhập kho TP/BTP) | Kho dự trữ `/warehouse` | ✅ THẬT | Duyệt BTP "chờ nhập"→"đã nhập", tính tồn |
| 5a | Đơn đặt → lệnh xuất | Đơn đặt `/orders` | ✅ THẬT | Tạo lệnh xuất FIFO từ tồn WIP → handoff sang Bán hàng |
| 5b | Bán thành phẩm ra | Bán hàng `/sales` | ✅ THẬT | Phiếu bán · quy cách · XK/NĐ · hút vào cân đối |
| 6 | Cân đối kỳ | Cân đối `/balancing` | ✅ THẬT | Gộp nhập + WIP + bán theo kỳ 5 ngày |
| — | Tồn NXT | `/nxt`, `/nxt-nl` | ✅ THẬT | Suy tồn từ sổ gốc |
| — | Tổng quan / Báo cáo / Chất lượng / Truy xuất | `/dashboard` `/reports` `/quality` `/traceability` | 🟡 DEMO | Trưng bày, dữ liệu mẫu |

> ⚠️ **Cảnh báo diễn giải:** app *trông* đã đủ màn, nhưng **~6 màn là DEMO**. Đừng coi màn DEMO là tính năng đã có khi lập kế hoạch.

---

## 3. Chỗ đứt gãy — vì sao "chưa hoàn thiện triệt để"

Đây là phần cốt lõi buổi họp. Bốn chỗ đứt, xếp theo mức chặn vòng lặp:

### G1 · Sản xuất KHÔNG nối ngược về nguyên liệu nhập 🔴 (đau nhất)
`WipProductionItem` (kiểm chứng `src/types.ts:292`) có `productId`, **`spec` (quy cách)**, `quantityKg`, `blocksCount`, `warehouse`, `status` (`cho-nhap`/`da-nhap`) — nhưng **không** có tham chiếu lô nhập, **không** ghi lượng nguyên liệu tiêu hao, **không** có hiệu suất (yield). Màn `WipProductionScreen.tsx` chỉ dùng `useMaterialTypes` (chọn **loại** NL làm nhãn), **không** dùng `useMaterialImports` ⇒ không đọc lượng nhập thực trong ngày. Phép *"lượng nhập trong ngày → ra bao nhiêu thành phẩm, hao bao nhiêu"* hiện **chỉ tính gián tiếp ở màn Cân đối** theo kỳ 5 ngày (`Định mức = Tổng NL ÷ Tổng TP`, `yieldRate` ở `balancingCalc.ts`), **không** tính trực tiếp ở bước sản xuất.
→ Hệ quả: không truy được *mẻ nào ăn nguyên liệu nào*; daily-task "hôm nay nhập X kg, ra Y kg thành phẩm, còn Z kg dở" (QĐ-3) **chưa có chỗ ghi Z và chưa tự nhắc**.

### G2 · Hai màn kho chồng nhau, một thật một demo 🟡
"Kho dự trữ" (`/warehouse`, THẬT) và "Kho lạnh" (`/cold-storage`, DEMO) cùng nói về nơi cất BTP đông nhưng **không chung dữ liệu**. Cần chốt: một kho canonical (nối WIP) + màn giám sát nhiệt là lớp phủ, hay gộp.

### G3 · Thành phẩm đóng gói vs bán thành phẩm chưa tách trạng thái tồn 🟡
Doc `34` phân biệt **BTP (còn trong khuôn đá)** ≠ **Thành phẩm (đã đóng gói, sẵn bán)** là **hai tồn riêng**, nhưng luồng đóng gói BTP→TP (ai ghi, khi nào, có phiếu không) **chưa build** → tồn thành phẩm thật để bán chưa tách khỏi tồn BTP.

### G4 · Bán không trừ tồn kho 🟡
`sales_items.source_warehouse` (`kho_nguon`, `types.ts:281` — `"" | "SX" | "Lưu trữ"`) dùng **không đều**: đường **đơn đặt → lệnh xuất** (`SalesOrderScreen.taoLenhXuat`) CÓ trừ tồn WIP (qua `export_items.wipId`) và set handoff `sourceWarehouse:"Lưu trữ"`; còn **bán lẻ nhập thẳng ở màn Bán hàng** (`SalesScreen.tsx:317`) set `""` và **không** trừ tồn — bán hút vào cân đối bằng *bản sao*. Vậy G4 = **bán trực tiếp chưa trừ tồn**, không phải "seam hoàn toàn chưa dùng".

**Nút thắt chung:** kho là mắt xích trung tâm còn hở. Nhập và bán đều nối thẳng vào Cân đối, nên khi cần tồn cuối kỳ đúng, hệ vẫn phải dựa vào Cân đối gộp lại thay vì suy từ dòng tồn liên tục.

---

## 4. Hai giao diện bộ phận (QĐ-2)

Cùng một cơ sở dữ liệu, **tách theo vai trò** để mỗi bộ phận chỉ thấy phần việc của mình và đi **theo bước**. Nền có sẵn: gate đăng nhập + vai trò `user_profiles` + nav nhóm trong `AppShell.tsx`.

### 4.1 Giao diện BỘ PHẬN NHẬP HÀNG
- **Vai trò:** thủ kho / người nhập nguyên liệu (Q28: Trúc/Thủy).
- **Màn chính:** Nhập hàng `/imports` (đã THẬT).
- **Đi theo bước:** ① mở đầu chuyến (ngày về, xưởng, đại lý, xe) → ② đổ từng dòng loại hàng (loài/loại/kg/giá) → ③ **chốt ngày**.
- **Chỉ thấy:** Nhập hàng + Danh mục (đại lý, loại NL) + báo cáo nhập theo kỳ. **Không** thấy cân đối/lãi-lỗ.

### 4.2 Giao diện BỘ PHẬN SẢN XUẤT THÀNH PHẨM
- **Vai trò:** tổ trưởng sản xuất (ghi sản lượng) + thủ kho dự trữ (duyệt nhập kho) — [`34`](../app-map/34-btp-san-xuat-kho.ba-spec.md) chốt **hai người, hai sự kiện**.
- **Màn chính:** Sản xuất BTP `/wip` (đã THẬT) + Kho dự trữ `/warehouse` (đã THẬT).
- **Đi theo bước:** ① chọn ngày SX + xưởng + loại nguyên liệu (từ lượng nhập trong ngày) → ② đổ từng dòng thành phẩm làm ra (mặt hàng + quy cách + kg + số block) → ③ phần **chưa làm xong → để trạng thái "chờ nhập kho"** → ④ thủ kho **duyệt vào kho dự trữ** → ⑤ **chốt ngày sản xuất**.
- **Chỉ thấy:** Sản xuất BTP + Kho dự trữ + (đọc) lượng nhập trong ngày để đối chiếu.

> **Trạng thái build:** ✅ **route-guard + trang chủ theo vai trò đã làm** (`src/lib/nav-access.ts` + `App.tsx`): vai trò `warehouse-keeper` → bộ phận Nhập hàng (trang chủ `/imports`), `team-leader`/`manager-dong`/`manager-ca`/`manager-kho` → bộ phận Sản xuất (trang chủ `/wip`); mỗi bộ phận chỉ thấy nav của mình, gõ URL ngoài bộ phận bị đưa về trang chủ. Thêm 2 vai trò vào `ROLES` (`team-leader` trước bị thiếu + `warehouse-keeper` mới). Vai trò giám đốc/kế toán/admin/chưa-gán vẫn xem đầy đủ. Thêm banner **nhắc daily-task** (`DailyTaskReminder`) ở đầu `/imports` + `/wip`: hôm nay (theo xưởng đang chọn) đã chốt chưa. **Còn lại:** phân quyền RLS ở server (hiện mới gate UI).

---

## 5. Việc-hằng-ngày (daily task) từng bộ phận (QĐ-3)

Định nghĩa "daily task" ở đây = **một danh sách việc bắt buộc trong ngày + một trạng thái chốt**. Hôm nay chưa chốt thì màn chủ của bộ phận phải **nhắc**.

### 5.1 Daily task — Nhập hàng
| Bước | Việc | Đã có? |
|---|---|---|
| 1 | Ghi mọi chuyến nguyên liệu về trong ngày | ✅ |
| 2 | Điền đơn giá (hoặc đánh dấu "chưa có giá" chờ hóa đơn) | ✅ |
| 3 | Cân **phế liệu gộp cuối ngày** | ✅ |
| 4 | **Chốt ngày nhập** (khóa số, mở lại có lý do) | ✅ |
| — | *Nhắc: "hôm nay chưa chốt ngày"* trên trang chủ bộ phận | ✅ banner `DailyTaskReminder` ở đầu màn `/imports` (theo xưởng đang chọn) |

### 5.2 Daily task — Sản xuất
| Bước | Việc | Đã có? |
|---|---|---|
| 1 | Ghi sản lượng thành phẩm làm ra hôm nay (theo mặt hàng/quy cách/kg/block) | ✅ |
| 2 | Ghi **phần chưa làm xong → lưu kho dự trữ** (BTP đông gửi) | 🟡 một phần (có trạng thái "chờ nhập kho", **thiếu ô "còn dở bao nhiêu"** rõ ràng — G1) |
| 3 | Thủ kho **duyệt BTP vào kho** | ✅ |
| 4 | **Chốt ngày sản xuất** (khóa số, ghi bù có lý do) | ✅ |
| — | *Đối chiếu "nhập hôm nay X kg ↔ sản xuất Y kg"* | ✅ read-only trong Dialog `/wip` (G1 v1); nhắc chủ động vẫn cần build |

**Nhịp chốt số** giữ nguyên pattern toàn hệ: nhập nháp nhiều lần trong ngày (sửa được) → **chốt ngày** (khóa) → sửa sau = **ghi bù bắt buộc lý do**.

---

## 6. Bảng thuật ngữ thao tác theo flow (QĐ-6)

Đặt tên thống nhất để mọi flow dùng chung một mô hình 2 pha:

| Thuật ngữ | Nghĩa trong dự án | Xuất hiện ở |
|---|---|---|
| **Nhập liệu (entry)** | Pha ghi *nháp*: thêm/sửa/xóa dòng tự do trong ngày | Nhập hàng, Sản xuất, Bán, Cân đối |
| **Phát hành / chốt (publish/lock)** | Pha *khóa số*: chốt ngày/kỳ, sau đó chỉ sửa qua ghi bù | `daily_locks`, `production_locks`, chốt kỳ cân đối (`0020`) |
| **Ghi bù (backdate)** | Ghi/sửa sau khi đã chốt hoặc sau ngày thực tế — **bắt buộc lý do** (`laGhiBu`) | Nhập hàng, Sản xuất |
| **First step** | Bước 1 chuỗi giá trị = **Nhập hàng** | `/imports` |
| **Second step** | Bước 2 chuỗi giá trị = **Sản xuất** (từ NL nhập ra thành phẩm) | `/wip` |
| **Ghi-ngược (write-back)** | Cân đối **hút sản lượng BTP theo ngày** rồi **ghi ngược về sổ gốc** khi sửa ô lưới (không chép số) | [`31`](../app-map/31-can-doi-ky.md) · comment 2026-08-17 ở [`34`](../app-map/34-btp-san-xuat-kho.ba-spec.md) |
| **Hai-bước (two-step)** | Nhập theo 2 bước: đầu chuyến → đổ hàng (nhập); chọn mẻ → đổ sản lượng (sản xuất) | `/imports`, `/wip` |

> "Second step" trong họp mang **hai nghĩa gộp**: (a) *bước sản xuất* của chuỗi, và (b) các thao tác *hai-bước / ghi-ngược* trong code. Tài liệu tách rõ như bảng trên để tránh nhầm.

---

## 7. Việc cần build (rút ra từ chỗ đứt gãy)

Ưu tiên theo mức khép vòng:

1. **[G1] Nối sản xuất ↔ nguyên liệu:** ✅ **v1 (read-only) đã làm** — Dialog "Ghi sản lượng" ở `/wip` hiện panel *Đối chiếu hôm nay*: Nhập cùng loại (hút `useMaterialImports` theo ngày SX + xưởng + cùng họ NL) ↔ Đã sản xuất ↔ Định mức tạm; có ghi chú "sản xuất có thể dùng thêm hàng xả đông kỳ trước nên không ràng buộc". ✅ **Lưu "còn dở" đã làm (`0025`):** dialog chốt ngày SX có ô *Nguyên liệu còn dở đem lưu kho* → lưu `production_locks.leftover_kg`, hiện lại trong panel đối chiếu (Nhập ↔ SX ↔ Còn dở). **Còn:** ràng số này vào tồn kho/đông gửi ở Cân đối cho khép vòng.
2. **[G3] Đóng gói BTP → Thành phẩm:** flow + trạng thái tồn thành phẩm tách khỏi BTP.
3. **[G2] Gộp/tách 2 màn kho:** chốt kho canonical, nối `cold-storage` vào WIP hoặc gộp vào `warehouse`.
4. **[G4] Bán trừ tồn:** kích hoạt `source_warehouse` để bán lẻ trừ tồn kho thành phẩm.
5. **2 giao diện bộ phận:** ✅ route-guard + trang chủ theo vai trò + banner nhắc daily-task (`/imports`, `/wip`) đã làm. **Còn:** siết RLS theo vai trò ở server; tinh chỉnh tập nav mỗi bộ phận với xí nghiệp.
6. **Gỡ/ẩn màn DEMO** khỏi nav vận hành thật (hoặc gắn nhãn rõ) để không gây hiểu nhầm khi chạy thật 01/09.

Mốc đưa vào chạy thật: [`ke-hoach-cutover-1-9-2026.md`](ke-hoach-cutover-1-9-2026.md).
</content>
