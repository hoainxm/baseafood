# 58 — ba-spec: Hợp đồng xuất chưa ký / chưa có L/C — ghi "bổ sung sau", không chặn ghi chuyến

> Load khi: sửa luật đính kèm hồ sơ cấp HĐ của Xuất khẩu (hợp đồng đã ký, L/C), cổng ghi chuyến (`shipmentGate`), trạng thái "Chờ đính kèm", bước 1 "Hợp đồng" của chuyến, điều kiện duyệt cuối.
covers: src/lib/exportPlanning.ts, src/features/export-planning/ContractDossier.tsx, src/features/export-planning/ExportPlanningScreen.tsx, src/features/export-planning/progress.ts
last_verified: 2026-11-02
ttl_days: 90
status: v1 ĐÃ BUILD 2026-11-02 — mig `0093` (CHƯA chạy DB thật; app tự ẩn nút khi máy chủ chưa có cột — `useExportDeferralsAvailable`), luật ở `lib/exportPlanning.ts` (`attachmentStatus`, `blockingAttachmentKinds`, `deferredAttachmentKinds`, `withDeferral`, `validateDeferral`, `finalReviewGate.missingAttachments`), việc cần đốc kind `deferred-attachment` (`exportReports.ts`, Tổng quan qua `dashboardAttention.ts`). Test AC-1…AC-8, AC-10. AC-9 (nhật ký) + giao diện CHƯA thử tay: sandbox không bắt file (AC-59 của 41), DB thật chưa có cột. Sửa đổi [41](41-export-planning.ba-spec.md): bảng chặng HĐ dòng "Đính kèm", R30, AC-56 và luật `shipmentGate`. Cần migration chỉ-thêm-cột (🟡).

> **Mục đích:** oracle HÀNH VI cho việc nới bắt buộc hồ sơ cấp HĐ. Không mô tả giao diện (việc của [42](42-export-planning-ui.design-spec.md)).

## 1. Vấn đề & JTBD

- **Nguồn:** chủ dự án 2026-11-02, nguyên văn: "Chỉnh sửa quy tắc ghi và thao tác đối với việc đính kèm hợp đồng: có những hợp đồng chưa ký hoặc chưa có thì không bắt buộc ở chỗ hợp đồng nhằm tránh tình trạng chặn thao tác tiếp ở các bước sau".
- **Hiện nay (41):** lập HĐ xong ⇒ "Chờ đính kèm"; phải đính **hợp đồng đã ký** (+ **L/C** khi thanh toán L/C) mới **ghi chuyến** được; bước 1 "Hợp đồng" của chuyến chưa xong tới lúc đó.
- **Đau:** thực tế khách gửi bản ký muộn, L/C về sau khi đã đóng hàng ⇒ Phòng Kế hoạch không ghi được chuyến, booking, đóng cont trên app dù việc ngoài đời đã chạy.
- **Job:** Khi HĐ chưa ký hoặc L/C chưa về, Nhân viên Kế hoạch muốn ghi "bổ sung sau" để làm tiếp các bước chuyến, mà vẫn không quên đòi hồ sơ trước khi đóng HĐ.
- **Đo thành công:** HĐ ghi "bổ sung sau" ghi chuyến được ngay; không HĐ nào đóng được khi còn thiếu HĐ ký / L/C.

## 2. User registry

| ID | User | Quyền | Bối cảnh |
|---|---|---|---|
| U1 | Nhân viên Kế hoạch | `export-plans` ghi | lập HĐ, ghi chuyến, đính hồ sơ |
| U2 | Trưởng / Phó phòng Kế hoạch | `export-plans` duyệt | duyệt cuối, đóng HĐ |
| U3 | BGĐ, Kế toán | `export-plans` xem | theo dõi |
| S1 | Hệ thống (lib/exportPlanning.ts) | — | tính trạng thái HĐ, cổng ghi chuyến, bước 1, việc cần đốc |

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Liên quan | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Ghi "bổ sung sau" cho từng loại hồ sơ bắt buộc còn thiếu (HĐ đã ký · L/C), kèm lý do | U1 | U2 (thấy) | lập HĐ (41) | mỗi HĐ thiếu | Must |
| NV2 | Ghi chuyến và làm các bước chuyến khi hồ sơ đang "bổ sung sau" | U1 | — | NV1 | hằng ngày | Must |
| NV3 | Bổ sung file sau ⇒ tự gỡ dấu "bổ sung sau" | U1 | — | NV1 | khi có file | Must |
| NV4 | Duyệt cuối / đóng HĐ chỉ khi đã đính đủ (không còn "bổ sung sau") | U2 | U1 (bổ sung) | NV3 | mỗi HĐ | Must |
| NV5 | Nhắc việc: HĐ còn "bổ sung sau" hiện là việc cần đốc | S1 | U1, U2 | NV1 | hằng ngày | Should |
| NV6 | Hướng dẫn + hộp "?" kể trạng thái / nhãn mới (QT 18) | S1 | mọi user | NV1–NV5 | khi đổi | Must |

## 4. Cross-user handoff map

| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện chuyển | Điểm kết nếu treo |
|---|---|---|---|---|---|
| H1 | NV1 → NV4 | U1 (ghi chuyến xong, xuất đủ) | U2 (duyệt cuối) | HĐ tới "Chờ duyệt cuối" | còn "bổ sung sau" ⇒ U2 không đóng được, việc "Thiếu HĐ ký / L/C" vẫn nằm ở danh sách đốc của U1 tới khi đính |

## 5. Flows

### Flow NV1 — Ghi "bổ sung sau" · owner U1
- **Start:** HĐ đang "Chờ đính kèm", còn thiếu ≥ 1 loại bắt buộc.
- **Input:** loại hồ sơ (HĐ đã ký / L/C), lý do (bắt buộc, chữ tự do — vd "khách chưa gửi bản ký", "L/C chưa mở").
- **Steps:** chọn "Chưa có — bổ sung sau" cho loại đó → nhập lý do → lưu.
- **Output:** loại đó tính là **tạm hoãn**: không chặn ghi chuyến; HĐ rời "Chờ đính kèm" sang "Đang ghi chuyến" khi mọi loại còn thiếu đều đã tạm hoãn; nhật ký HĐ có dòng "Ghi bổ sung sau: <loại> — <lý do>" kèm người, giờ.
- **End:** HĐ ghi chuyến được.

### Flow NV2 — Làm tiếp khi đang tạm hoãn · owner U1
- **Input:** HĐ có loại tạm hoãn.
- **Output:** ghi chuyến, đính hồ sơ các bước 2–6 như 41; bước 1 "Hợp đồng" của chuyến ở trạng thái **Đang làm** với chữ **"chờ HĐ ký"** / **"chờ L/C"**; "Đủ hồ sơ" của chuyến vẫn chỉ xét bước 2–5 (41 NV12, không đổi).

### Flow NV3 — Bổ sung file · owner U1
- **Input:** file đúng loại đang tạm hoãn.
- **Output:** dấu tạm hoãn của loại đó tự gỡ; bước 1 xong khi mọi loại bắt buộc đã có file; nhật ký ghi "Đã bổ sung <loại>".

### Flow NV4 — Duyệt cuối · owner U2
- **Input:** HĐ "Chờ duyệt cuối".
- **Output:** còn loại tạm hoãn ⇒ **không duyệt cuối được**, câu lý do "Còn thiếu hồ sơ bổ sung sau: <loại>"; đủ ⇒ như 41.

### Flow NV5 — Nhắc việc · owner S1
- **Output:** HĐ còn mở có loại tạm hoãn ⇒ một việc "Thiếu HĐ ký" / "Thiếu L/C" (mức Chưa làm) ở Tổng quan (ba-spec 55, việc kế hoạch) và tab Báo cáo Xuất khẩu mục cần chú ý.

### Flow NV6 — Nội dung
- **Output:** tour + hộp "?" Xuất khẩu nói: khi nào dùng "bổ sung sau", nó mở khóa gì, vẫn chặn gì (duyệt cuối), bổ sung xong thì tự gỡ.

## 6. Flow optimization log

| Flow | Candidate | Chọn / Loại | Lý do | Đánh giá bởi | Conflict & xử |
|---|---|---|---|---|---|
| NV1 | A: ghi "bổ sung sau" + lý do · B: bỏ bắt buộc hẳn | **A** (chủ dự án chọn) | B mất dấu HĐ thiếu ký ⇒ đóng HĐ khi chưa có chứng cứ pháp lý (Domain XK: HĐ ký là căn cứ bộ chứng từ, thanh toán) | Chủ dự án + Domain (XK) | — |
| NV1 | L/C: nới như HĐ ký · vẫn bắt buộc | **nới như HĐ ký** (chủ dự án chọn) | L/C thường mở sau khi đã có booking; chặn thì không ghi được chuyến | Chủ dự án | — |
| NV4 | A: đủ mới đóng · B: đóng được + cảnh báo | **A** (chủ dự án chọn) | đóng HĐ = hồ sơ đầy đủ để kiểm toán; B để lọt HĐ thiếu ký | Chủ dự án + Domain (kế toán) | — |
| NV2 | bước 1: đang làm "chờ HĐ ký" · tính xong | **đang làm** (chủ dự án chọn) | thanh tiến độ phải nói thật là còn thiếu | Chủ dự án | — |
| NV1 | tạm hoãn tự động (không cần bấm) · bấm + lý do | **bấm + lý do** | không bấm thì không phân biệt "quên đính" với "chưa có"; lý do là căn cứ đòi khách | Optimizer | — |

## 7. Scope & Priority

- **IN:** NV1–NV6.
- **OUT:** đổi bộ loại hồ sơ bắt buộc; hạn chót tự động cho "bổ sung sau"; tạm hoãn hồ sơ của bước 2–6 (đã có "Không áp dụng" của 41).

## 8. Success metric

| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV2 | HĐ có "bổ sung sau" mà không ghi chuyến được | = 0 |
| NV4 | HĐ đóng khi còn "bổ sung sau" | = 0 |
| NV5 | HĐ còn "bổ sung sau" không có trong việc cần đốc | = 0 |

## 9. Rules & Invariants

| # | Rule | Edge case |
|---|---|---|
| R1 | Loại bắt buộc giữ như 41 (`requiredAttachmentKinds`): HĐ đã ký luôn có; L/C khi thanh toán L/C. Mỗi loại ở 1 trong 3 tình trạng: **Có file** · **Bổ sung sau** (có lý do) · **Thiếu**. | đổi điều khoản sang L/C ở bản sửa ⇒ L/C thành Thiếu (chưa tạm hoãn) |
| R2 | "Bổ sung sau" cần lý do không rỗng; ghi người + giờ; ghi một dòng nhật ký HĐ. | lý do trống ⇒ không lưu, báo lỗi |
| R3 | Cổng ghi chuyến (`shipmentGate`): mở khi HĐ còn mở + có bản hiệu lực + mọi loại bắt buộc là Có file HOẶC Bổ sung sau. Còn loại **Thiếu** ⇒ chặn như cũ. | — |
| R4 | Trạng thái HĐ "Chờ đính kèm" chỉ khi còn loại **Thiếu**; chỉ còn Bổ sung sau ⇒ theo luật 41 như đã đủ ("Đang ghi chuyến" / "Chờ duyệt cuối"). | — |
| R5 | Bước 1 của chuyến: xong khi mọi loại Có file; còn Bổ sung sau ⇒ Đang làm, chữ "chờ HĐ ký" / "chờ L/C"; còn Thiếu ⇒ như 41. | — |
| R6 | Duyệt cuối (đóng HĐ) bị chặn khi còn loại Bổ sung sau hoặc Thiếu. | "Chốt HĐ" tay của 41 cũng chặn như vậy |
| R7 | Đính file đúng loại ⇒ dấu Bổ sung sau của loại đó tự hết (không cần bấm gỡ); gỡ file sau đó ⇒ loại về **Thiếu** (không tự quay lại Bổ sung sau). | — |
| R8 | Người có quyền ghi gỡ được dấu Bổ sung sau bằng tay (về Thiếu), có Hoàn tác (QT 6). | — |
| R9 | HĐ cũ (R30 của 41 — duyệt kiểu cũ có file) vẫn tính Có file HĐ ký. | — |
| R10 | Lưu dấu Bổ sung sau trên HĐ (không theo bản): đổi bản sửa không xóa dấu. Cần **migration chỉ-thêm-cột** trên `export_contracts` (vd `attachment_deferrals jsonb default '{}'`), viết sẵn `drop`; thêm vào `DemoBundle` (QT 15). | DB chưa chạy migration ⇒ không ghi được dấu, cổng như cũ (fail-closed) |

## 9b. Kiểm kê nội dung (NV6)

| Khu vực | Mục người đọc gặp | Nội dung phải nói | Nguồn |
|---|---|---|---|
| Hồ sơ HĐ — bước Đính kèm | 3 tình trạng | Có file · Bổ sung sau (lý do) · Thiếu; chỉ Thiếu mới chặn ghi chuyến | R1, R3 |
| Hồ sơ HĐ — bước Đính kèm | điều kiện xong | bổ sung đủ file ⇒ tự gỡ; gỡ file ⇒ về Thiếu | R7 |
| Chuyến — bước 1 | chữ "chờ HĐ ký" / "chờ L/C" | bước đang làm vì hồ sơ HĐ chưa về; không chặn các bước sau | R5 |
| Duyệt cuối | câu chặn | "Còn thiếu hồ sơ bổ sung sau: …" ⇒ việc tiếp: đính file | R6 |
| Việc cần đốc | "Thiếu HĐ ký" / "Thiếu L/C" | HĐ đang làm tiếp nhưng phải đòi hồ sơ trước khi đóng | NV5 |

## 10. Acceptance Criteria

### AC-1 — Bổ sung sau mở cổng ghi chuyến · NV1 · Test: unit
- **Given** HĐ mở, có bản hiệu lực, thanh toán TT, chưa có file HĐ ký
- **When** ghi "bổ sung sau" cho HĐ ký với lý do "khách chưa gửi bản ký"
- **Then** cổng ghi chuyến mở, trạng thái HĐ không còn "Chờ đính kèm"
- **Assert** `shipmentGate(...).ok == true` · `contractState(...) != "attaching"`

### AC-2 — Thiếu mà chưa tạm hoãn vẫn chặn · NV1 · Test: unit
- **Given** HĐ thanh toán L/C, HĐ ký đã "bổ sung sau", L/C chưa có gì
- **When** xét cổng ghi chuyến
- **Then** vẫn chặn, lý do nêu L/C
- **Assert** `gate.ok == false` · `gate.missing` deep-equals `["lc"]`

### AC-3 — Lý do bắt buộc · NV1 · Test: unit
- **Given** HĐ thiếu HĐ ký
- **When** ghi "bổ sung sau" với lý do rỗng
- **Then** không lưu
- **Assert** kết quả kiểm có 1 lỗi khóa `reason`; số dấu tạm hoãn `== 0`

### AC-4 — Bước 1 của chuyến khi tạm hoãn · NV2 · Test: unit
- **Given** HĐ có HĐ ký "bổ sung sau", có 1 chuyến
- **When** tính tiến độ chuyến
- **Then** bước 1 Đang làm, chữ "chờ HĐ ký"; "Đủ hồ sơ" của chuyến vẫn theo bước 2–5
- **Assert** `steps[1] == "in-progress"` · nhãn chứa "chờ HĐ ký"

### AC-5 — Bổ sung file tự gỡ · NV3 · Test: unit
- **Given** HĐ ký đang "bổ sung sau"
- **When** đính file loại HĐ đã ký
- **Then** loại đó Có file, bước 1 xong
- **Assert** `attachmentStatus("signed-contract") == "has-file"` · `contractStepState(...) == "done"`

### AC-6 — Gỡ file về Thiếu · NV3 · Test: unit
- **Given** HĐ ký đã có file (trước đó từng "bổ sung sau")
- **When** gỡ file
- **Then** loại về Thiếu, cổng ghi chuyến chặn
- **Assert** `attachmentStatus(...) == "missing"` · `shipmentGate(...).ok == false`

### AC-7 — Duyệt cuối bị chặn khi còn tạm hoãn · NV4 · Test: unit
- **Given** HĐ đã xuất đủ trong dung sai, HĐ ký vẫn "bổ sung sau"
- **When** xét duyệt cuối
- **Then** không duyệt được, lý do nêu HĐ ký
- **Assert** `finalApprovalGate(...).ok == false` · lý do chứa "Hợp đồng đã ký"

### AC-8 — Nhắc việc · NV5 · Test: unit
- **Given** 1 HĐ mở có L/C "bổ sung sau"
- **When** dựng mục cần chú ý Xuất khẩu
- **Then** có đúng 1 việc "Thiếu L/C" mức Chưa làm
- **Assert** `attention.filter(a => a.kind === "deferred-attachment").length == 1`

### AC-9 — Nhật ký · NV1 · Test: unit
- **Given** HĐ thiếu HĐ ký
- **When** ghi "bổ sung sau"
- **Then** nhật ký HĐ có 1 dòng ghi loại + lý do
- **Assert** số dòng nhật ký mới `== 1`, tóm tắt chứa "bổ sung sau" và lý do

### AC-10 — Đổi bản sửa không mất dấu · NV1 · Test: unit
- **Given** HĐ ký "bổ sung sau"
- **When** ghi bản sửa HĐ (điều khoản vẫn TT)
- **Then** dấu vẫn còn, cổng vẫn mở
- **Assert** `shipmentGate(...).ok == true`

### AC-11 — Lời hướng dẫn đủ nhãn · NV6 · Test: unit
- **Given** nhãn tình trạng hồ sơ trong code ("Có file", "Bổ sung sau", "Thiếu", "chờ HĐ ký", "chờ L/C")
- **When** đọc tour + hộp "?" Xuất khẩu
- **Then** có đủ
- **Assert** số nhãn thiếu `== 0`

## 11. Assumptions / Open

- **Assumptions:** (a) nhãn hiển thị cụ thể ("Bổ sung sau", "chờ HĐ ký"…) do design-spec 42 chốt cuối; (b) không đặt hạn chót cho "bổ sung sau" — chỉ nhắc ở việc cần đốc; (c) migration số **0093** (rà origin trước khi đặt; 0080–0092 đang chưa chạy DB thật); (d) quyền ghi dấu = quyền sửa HĐ (`export-plans` update), không thêm quyền mới.
- **Open (RED):** không có — migration chỉ thêm cột là 🟡.

## History

- v1 (2026-11-02): khởi tạo — chủ dự án chốt: ghi "bổ sung sau" + lý do · L/C nới như HĐ ký · phải đủ mới duyệt cuối / đóng · bước 1 Đang làm "chờ HĐ ký".
