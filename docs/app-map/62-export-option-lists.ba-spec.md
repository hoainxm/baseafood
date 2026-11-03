# 62 — ba-spec: Danh sách chọn của Xuất khẩu — cảng xếp, cảng đích, loại container, tiền tệ

> Load khi: sửa các ô chọn theo danh sách của Xuất khẩu (cảng xếp, cảng đích, loại container, tiền tệ của HĐ; cảng đến của chuyến), thêm / sửa / xóa tùy chọn ngay trong ô, hoặc tab Danh mục của trang Xuất khẩu (6 danh sách, gồm cả Loại chứng từ và Loại hàng chuyển từ màn Danh mục chung sang).
covers: src/lib/exportOptions.ts, src/features/export-planning/exportOptionPicker.tsx, src/features/export-planning/ExportCatalogView.tsx, src/features/export-planning/ContractFormDialog.tsx, src/features/export-planning/ShipmentDialogs.tsx, src/features/catalog/CatalogScreen.tsx, src/features/catalog/CatalogCrudFor.tsx, src/features/catalog/catalogConfig.tsx, supabase/migrations/0095_export_options.sql
last_verified: 2026-11-03
<!-- updated: 2026-11-03 (ba-spec 67) — danh sách `bank-account` không còn ở tab Danh mục của Xuất khẩu — quản lý ở Tài liệu công ty → Thông tin công ty (ba-spec 67); RLS ghi thêm cho `company-profile:update` (mig 0099). -->
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — chốt Q1…Q7 (§8). Mig `0095_export_options.sql` 🟡 bảng mới chỉ-thêm, ✅ ĐÃ chạy DB thật (kiểm chỉ-đọc 2026-11-03; kiểm PGlite: chuỗi 0001→0095, chạy 0095 hai lần không lỗi, RLS theo vai đúng). Chưa chạy ⇒ ô chọn dùng danh sách khởi tạo, chỉ chọn. Test `exportOptions.test.ts` (AC-1…AC-5). Thử preview demolocal 2026-11-02 (AC-6, AC-8 phần không máy chủ).

> **Mục đích:** oracle HÀNH VI. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)). Bổ sung [41](41-export-planning.ba-spec.md) NV2 (lập HĐ), NV7 (ghi chuyến), §0b (Loại chứng từ — nơi quản lý đổi).

> **2026-11-02 (mig 0096, ba-spec [63](63-export-invoice-from-app.ba-spec.md)):** thêm danh sách thứ năm **Tài khoản ngân hàng** (`bank-account`): `name` = tên ngắn để chọn, `note` = khối in dưới "Please make TT to:" (nhiều dòng — ô Ghi chú của danh mục thành ô nhiều dòng cho mọi danh sách). Máy chủ chưa chạy 0096 ⇒ không đưa tài khoản vào bảng (ghi danh sách khác sẽ upsert cả bảng, dòng `bank-account` bị check 0095 chặn ⇒ kẹt hàng chờ). Bảng có mục mà chưa có tài khoản ⇒ bù 3 tài khoản khởi tạo.

## 1. Vấn đề & JTBD

- **Nguồn:** chị Phạm Thảo (Phòng Kế hoạch) 2026-11-02, nguyên văn: "cảng xếp sẽ có 2 cảng: Cái Mép, Cát Lái. Các vị trí đấy làm cho tôi chức năng kiểu chọn theo danh sách đã cấu hình, có thể thêm xoá tuỳ chọn trực tiếp lúc chọn, nếu chưa có thì thêm trực tiếp hoặc ko dùng nữa thì xoá trực tiếp, tham khảo một vài dữ liệu cũ đã có để lập danh sách. Còn để quản lý thì sẽ lưu vào một tab gọi là danh mục của riêng trang xuất khẩu hoặc đề xuất 1 hướng đi sao cho phù hợp nhất". Kèm danh sách 11 cảng đích (R3).
- **Trước đây:** cảng xếp, cảng đích (HĐ và chuyến), loại container, tiền tệ là ô gõ tay. Dữ liệu thật (đọc 2026-11-02, 9 bản HĐ + 17 chuyến):
  - Cảng xếp 7 kiểu gõ: `CÁT LÁI` ×2 · `CÁT LÁI/ CÁI MÉP` ×2 · `Việt Nam` ×2 · `Cái Mép` · `CAI MEP ` · `CÁT LÁI - HCM`.
  - Cảng đích: một cảng nhiều cách gõ (`TOKYO`, `Tokyo`, `TOKYO, JAPAN`); có thêm `ASHDOD`, `NIIGATA` ngoài danh sách được cung cấp.
  - Loại cont trên HĐ: `40RF` ×3, `20RF` ×1, trống ×5. Tiền tệ: `USD` ×9.
- **Job:** Khi lập HĐ / ghi chuyến, Nhân viên Kế hoạch chọn cảng, loại cont, tiền tệ từ danh sách thay vì gõ, để tên thống nhất (lọc, báo cáo, Excel không tách một cảng thành ba). Gặp mục mới thì thêm ngay tại ô, mục thôi dùng thì xóa ngay tại ô.
- **Đo thành công:** HĐ / chuyến lập sau khi build có 4 ô này nằm trong danh sách ≥ 95%; một cảng chỉ còn 1 cách viết trong báo cáo tháng.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên / Trưởng / Phó phòng Kế hoạch | `export-plans` thêm · sửa · xóa | lập HĐ, ghi chuyến |
| U2 | BGĐ, Kế toán, người chỉ có `export-plans` xem | xem | đọc HĐ / chuyến, xem danh sách, không sửa danh sách |
| S1 | Hệ thống: bảng `export_options` (mig 0095) | — | — |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Ưu tiên |
|---|---|---|---|---|
| NV-A | Chọn cảng xếp / cảng đích / loại cont / tiền tệ khi ghi | U1 | — | P1 |
| NV-B | Thêm / sửa / xóa tùy chọn ngay trong ô | U1 | — | P1 |
| NV-C | Xem và dọn danh sách ở tab Danh mục của Xuất khẩu | U1 (U2 chỉ xem) | — | P2 |

Không có bàn giao giữa các user: U2 chỉ đọc kết quả.

## 4. Flow

**NV-A — Chọn khi ghi.** Input: HĐ đang lập / sửa, chuyến đang ghi. Steps: mở ô → danh sách đúng loại → gõ để lọc → chọn. Output: HĐ / chuyến lưu **chữ** của mục (R2). End: lưu như cũ.
- Mặc định như trước: chuyến lấy cảng đích của HĐ; HĐ lấy cảng đích mặc định của khách (41 NV13 — ô của khách vẫn gõ tay, A2).
- Giá trị đang ghi khác hoa thường với một mục ⇒ ô hiện là đã chọn mục đó. Giá trị không khớp mục nào ⇒ hiện ở đầu danh sách, dòng phụ "Ngoài danh sách"; lưu lại HĐ mà không chọn lại thì giữ nguyên chữ cũ (Q6).

**NV-B — Sửa danh sách ngay trong ô.** Input: tên chưa có / mục cần đổi / mục thôi dùng.
- Thêm: gõ tên chưa có → Thêm mới ⇒ mục vào đúng danh sách, ô nhận luôn. Gõ trùng (không phân hoa thường, gộp khoảng trắng; có dấu và không dấu là hai tên) ⇒ dùng mục có sẵn.
- Sửa: bút chì ⇒ đổi tên / ghi chú. HĐ / chuyến đã ghi KHÔNG đổi theo (Q5).
- Xóa: thùng rác ⇒ xác nhận ⇒ mục biến khỏi mọi ô cùng danh sách, toast Hoàn tác. HĐ / chuyến đã ghi giữ nguyên chữ (Q4).
- Output: danh sách mới có ngay ở mọi ô cùng loại. End: ô giữ giá trị đang chọn.

**NV-C — Quản lý tập trung.** Input: U1 muốn rà cả danh sách. Steps: trang Xuất khẩu → tab **Danh mục** → chọn danh sách (Cảng xếp · Cảng đích · Loại container · Tiền tệ · Loại chứng từ · Loại hàng) → thêm / sửa / xóa. Output: như NV-B. End: chuyển tab khác.

## 5. Luật

- **R1 — Bốn danh sách** (Q3 = thêm Tiền tệ). Mỗi mục thuộc đúng 1 danh sách (`list_kind`):

| Ô | Chỗ | Danh sách |
|---|---|---|
| Cảng xếp | HĐ — Điều khoản | `loading-port` |
| Cảng đích | HĐ — Điều khoản | `discharge-port` |
| Cảng đến | Ghi / sửa chuyến | `discharge-port` |
| Loại container | HĐ — Điều khoản | `container-type` |
| Tiền tệ | HĐ — Điều khoản (lưu chữ hoa) | `currency` |

- **R2 — Lưu chữ, không lưu id** (Q5). HĐ là văn bản đã ký, chữ không tự đổi. Dữ liệu cũ đã là chữ ⇒ không chuyển đổi gì.
- **R3 — Danh sách khởi tạo** (Q7 = chỉ 11 cảng chị Thảo gửi; "Chareston" sửa thành "Charleston"). Migration 0095 ghi vào bảng ở site bsf1, id cố định (chạy lại không nhân đôi); `EXPORT_OPTION_SEED` trong `lib/exportOptions.ts` trùng id.
  - Cảng xếp: Cái Mép · Cát Lái.
  - Cảng đích: Tokyo, Japan · Hakata, Japan · Nagoya, Japan · Xiamen, China · Penang, Malaysia · Los Angeles, USA · Baltimore, USA · Charleston, USA · Moji, Japan · Kobe, Japan · Osaka, Japan.
  - Loại container: 20RF · 40RF · 40HC-RF.
  - Tiền tệ: USD · JPY · EUR.
  - Bảng chưa có mục nào (site mới, chạy không máy chủ) hoặc chưa chạy 0095 ⇒ dùng danh sách khởi tạo; lần ghi đầu lưu cả danh sách.
- **R4 — Loại cont của HĐ vẫn gợi ý loại chuyến như cũ** (`KIND_FROM_TEXT`: có "HC" ⇒ 40HC-RF, có "20" ⇒ 20RF, còn lại 40RF). Loại chuyến (20RF · 40RF · 40HC-RF · Xe tải · Đóng ghép) vẫn cố định vì gắn luật đếm cont / seal — không vào danh sách sửa được.
- **R5 — Xóa mục không đụng sổ.** Chỉ bỏ khỏi danh sách; không xóa, không sửa HĐ / chuyến nào. Xác nhận + Hoàn tác (CLAUDE.md QT 6, 13).
- **R6 — Quyền** theo `export-plans`: xem = xem; thêm / sửa = thêm hoặc sửa; xóa = xóa (RLS 0095, như 0081). Thùng rác chỉ hiện khi có quyền xóa.
- **R7 — Chưa chạy 0095:** ô chọn dùng danh sách khởi tạo, không có Thêm mới / bút chì / thùng rác; ghi từ tab Danh mục báo "chưa chạy migration 0095"; không kẹt hàng chờ. Demo: bảng vào `DemoBundle.exportOptions` (= danh sách khởi tạo) + `DemoPackLoader`.
- **R8 — Thứ tự:** theo thứ tự đặt (`sort_order`), rồi tên. Mục mới xếp cuối danh sách của nó.
- **R9 — Nơi quản lý** (Q1 = B): tab **Danh mục** của trang Xuất khẩu (`/planning-export?view=catalog&list=…`), gom 6 danh sách. Loại chứng từ (0081) và Loại hàng (0089) **rời màn Danh mục chung**; link cũ `/catalog?tab=document-kinds` / `goods-types` tự chuyển sang tab mới. Khóa tô màu dòng của hai danh sách cũ giữ nguyên.
- **R10 — Cảng xếp ghi cả hai cảng** (Q2 = A): một ô một mục; cần thì thêm mục riêng "Cát Lái / Cái Mép".

## 6. Flow optimization log

Chạy tuần tự (1 nhóm user, 3 nghiệp vụ, không bàn giao) — không spawn team.

- **Nơi lưu:** (a) **một bảng chung có cột `list_kind`** *(chọn — thêm danh sách sau chỉ nới ràng buộc; cùng RLS, cùng hàng chờ)*; (b) mỗi danh sách một bảng *(loại — 4 migration, 4 ánh xạ cho cùng một hình dạng)*; (c) mở rộng `export_document_kinds` *(loại — bảng đó gắn luật chứng từ theo id)*.
- **Danh sách khởi tạo:** (a) **ghi vào bảng lúc migration + code dùng cùng danh sách khi bảng trống / chưa chạy** *(chọn — xóa được cả mục khởi tạo; như 0089 Loại hàng)*; (b) mục "ảo" trong code như Loại chứng từ *(loại — mục ảo xóa xong lại hiện)*.
- **Lưu trên HĐ:** (a) **chữ** *(chọn — R2)*; (b) id *(loại — phải chuyển dữ liệu cũ 🔴, HĐ đã ký đổi chữ theo danh mục)*.
- **Dữ liệu cũ lệch:** (a) **giữ nguyên + "Ngoài danh sách"** *(chọn — Q6, không sửa sổ thật)*; (b) chuẩn hóa hàng loạt *(loại — 🔴 sửa bản ghi thật)*.
- **Nơi quản lý:** (a) màn Danh mục chung *(đề xuất ban đầu)*; (b) **tab riêng trong trang Xuất khẩu, gom cả Loại chứng từ + Loại hàng** *(chị Thảo chọn — Q1)*.
- **Tour:** thêm bước riêng cho tab Danh mục làm tour vượt trần 22 bước (43 R15) ⇒ gộp vào bước "các tab" + bước Lập hợp đồng + hộp "?" có mục riêng.

## 7. Acceptance Criteria

### AC-1 — Danh sách khởi tạo đúng loại · NV-A · Test: unit
- **Given** bảng chưa có mục nào (R3)
- **When** đọc danh sách theo từng loại
- **Then** mỗi loại chỉ có mục của loại đó, đúng thứ tự R3; id không trùng
- **Assert** `loading-port` == ["Cái Mép", "Cát Lái"] · `discharge-port`.length == 11, đầu là "Tokyo, Japan" · `container-type` == ["20RF", "40RF", "40HC-RF"] · `currency` == ["USD", "JPY", "EUR"] · chưa chạy 0095 ⇒ số mục == 19

### AC-2 — Thêm mới không tạo trùng, không lẫn loại · NV-B · Test: unit
- **Given** danh sách khởi tạo
- **When** thêm "  cát   lái " và "cat lai" vào `loading-port`; thêm "Busan,  Korea" vào `discharge-port`
- **Then** "cát lái" dùng lại mục có sẵn; "cat lai" (không dấu) là tên khác; "Busan, Korea" vào cuối cảng đích
- **Assert** "cát lái" ⇒ `created == false`, tên "Cát Lái" · "cat lai" ⇒ `created == true` · `discharge-port`.length == 12, cuối == "Busan, Korea" · `loading-port` chứa "Busan, Korea" == false

### AC-3 — Xóa mục không đụng sổ · NV-B · Test: unit
- **Given** HĐ đã ghi `portOfLoading == "CÁT LÁI"`, danh sách có "Cát Lái"
- **When** xóa "Cát Lái" khỏi danh sách
- **Then** mục biến khỏi danh sách; danh sách khác giữ nguyên; HĐ giữ nguyên chữ, giờ là ngoài danh sách
- **Assert** `loading-port`.length == 1 · `discharge-port`.length == 11 · `isOutsideList("CÁT LÁI") == true` · số bản ghi HĐ / chuyến thay đổi == 0

### AC-4 — Đổi tên không đổi HĐ cũ · NV-B · Test: unit
- **Given** HĐ đã ghi `portOfDischarge == "Tokyo, Japan"`
- **When** đổi tên mục "Tokyo, Japan" thành "Tokyo Port, Japan"
- **Then** danh sách có tên mới; HĐ giữ chữ cũ (giờ ngoài danh sách)
- **Assert** `discharge-port` có "Tokyo Port, Japan" count == 1 · `isOutsideList("Tokyo, Japan") == true`

### AC-5 — Giá trị ngoài danh sách vẫn hiện · NV-A · Test: unit
- **Given** danh sách khởi tạo
- **When** dựng ô chọn Cảng xếp với giá trị "Việt Nam"; kiểm "CÁT LÁI/ CÁI MÉP", "cát lái", ""
- **Then** giá trị lạ đứng đầu, có dòng "Ngoài danh sách"; khác hoa thường thì hiện đúng mục
- **Assert** số mục ô == 3, mục đầu == "Việt Nam" · `isOutsideList("CÁT LÁI/ CÁI MÉP") == true` · `isOutsideList("cát lái") == false` · `isOutsideList("") == false` · `matchExportOption("cát lái") == "Cát Lái"`

### AC-6 — Thêm / xóa tại ô, quản lý ở tab · NV-B · Test: manual
- **Given** preview demolocal (không máy chủ), U1
- **When** Lập hợp đồng → ô Cảng đích gõ "Busan, Korea" → Thêm mới; ô Cảng xếp → thùng rác "Cái Mép" → Xóa khỏi danh sách → Hoàn tác; mở `/catalog?tab=goods-types`
- **Then** ô nhận mục mới, danh sách lưu thêm 1; xóa rồi Hoàn tác trả lại mục; link cũ mở tab Danh mục của Xuất khẩu đúng danh sách
- **Assert** (thử 2026-11-02) ô Cảng đích == "Busan, Korea" · số mục lưu == 20 · sau xóa `loading-port` == 0 mục còn lại của lần đó, sau Hoàn tác == 1 · URL == `#/planning-export?view=catalog&list=goods-types`, tab đang chọn == "Danh mục" + "Loại hàng"

### AC-7 — Quyền theo vai · NV-C · Test: integration
- **Given** chuỗi migration 0001→0095 trên PGlite, user vai `planner` và `accountant`
- **When** mỗi vai đọc / thêm / xóa ở `export_options`; chèn `list_kind = 'vessel'`
- **Then** Kế hoạch ghi được; kế toán chỉ đọc; loại danh sách lạ bị chặn
- **Assert** (thử 2026-11-02) chạy 0095 lần 2 lỗi == 0 · seed: container-type 3 · currency 3 · discharge-port 11 · loading-port 2 · policy == 4 · planner thêm 1 dòng, xóa 1 dòng · accountant đọc 20 dòng, thêm == DENIED, xóa 0 dòng · `vessel` == DENIED (check constraint)

### AC-8 — Chạy khi chưa có bảng / demo · NV-C · Test: manual
- **Given** (a) máy chủ chưa chạy 0095; (b) chế độ demo
- **When** mở ô Cảng đích; nạp bộ demo
- **Then** (a) đủ danh sách khởi tạo, không thêm / sửa / xóa; (b) gói demo có bảng mới, số thật không đổi
- **Assert** (a) số mục == 11 · lối thêm / sửa / xóa == 0 · dòng hàng chờ `export_options` == 0 · (b) `DemoBundle.exportOptions`.length == 19 · số dòng `site_id <> 'site-demo'` trước == sau

## 8. Đã chốt (chị Phạm Thảo, 2026-11-02)

| # | Câu | Chốt |
|---|---|---|
| Q1 | Quản lý danh sách ở đâu | **B** — tab Danh mục riêng trong trang Xuất khẩu; Loại chứng từ, Loại hàng chuyển vào đó |
| Q2 | HĐ ghi "Cát Lái / Cái Mép" | **A** — một ô một mục, cần thì thêm mục riêng |
| Q3 | Thêm danh sách nào | **B** — thêm Tiền tệ |
| Q4 | Xóa mục | **A** — xóa hẳn khỏi danh sách, xác nhận + Hoàn tác |
| Q5 | Đổi tên mục thì HĐ cũ đổi theo không | **A** — không |
| Q6 | Dữ liệu cũ gõ lệch | **A** — giữ nguyên, đánh dấu "Ngoài danh sách" |
| Q7 | Danh sách cảng đích khởi tạo | **B** — chỉ 11 cảng chị gửi (Charleston viết đúng) |

## 9. Assumptions

- A1. Danh sách theo xưởng (`site_id`), như mọi danh mục.
- A2. Ô "Cảng đích mặc định" của khách (danh mục Khách hàng) vẫn gõ tay đợt này; HĐ lấy giá trị đó, khác danh sách thì hiện "Ngoài danh sách".
- A3. Không động tới Nhập khẩu (cảng xếp của NCC / HĐ nhập) — làm sau được, cùng bảng (thêm `list_kind`).
- A4. Không chuẩn hóa dữ liệu cũ (sửa sổ thật = 🔴).

## History

- 2026-11-02 — v0 bản nháp sau trao đổi Zalo Hoài Nam ↔ Phạm Thảo; đọc dữ liệu thật (chỉ đọc) để lập danh sách khởi tạo.
- 2026-11-02 — v1 chị Thảo chốt Q1…Q7 qua trang chọn; ĐÃ BUILD (mig 0095 chưa chạy DB thật).
