# 43 — ba-spec: Hướng dẫn thao tác trên trang (tour từng bước) — áp dụng đầu tiên: Xuất khẩu

> Load khi: thêm / sửa hướng dẫn từng bước của một trang (đi qua các nút và luồng việc ngay trên trang), hoặc trang Xuất khẩu đổi bố cục / luồng làm tour lệch.
covers: src/lib/exportPlanning.ts, src/lib/guidedTour.ts, src/design-system/patterns/GuidedTour.tsx, src/design-system/patterns/GuideButton.tsx, src/features/shared/PageTourProvider.tsx, src/features/export-planning/exportTour.ts
last_verified: 2026-10-21
ttl_days: 90
<!-- re-verified: 2026-10-21 — v3: áp nhánh nội dung của skill ba-flow-logic (references/06): §9b kiểm kê 9 nhóm mục có nguồn, R10–R12, AC-10/11 test đọc hằng số nhãn của lib/exportPlanning. -->
<!-- re-verified: 2026-10-21 — v2: nhãn "Hướng dẫn thao tác", 21 bước (thêm trạng thái HĐ · việc tiếp · cột Tiến độ · trạng thái mục và file), chạy thật trên preview demo 1366 px + 360 px × 100 / 130 %. -->

> **Mục đích**: oracle HÀNH VI cho tour — ai mở, đi qua những gì, kết thúc ra sao, KHÔNG được làm gì. Giao diện tour ở design-spec [42 § Hướng dẫn thao tác](42-export-planning-ui.design-spec.md) + README design-system § Hướng dẫn thao tác (`GuidedTour`). Luồng nghiệp vụ Xuất khẩu mà tour kể lại: ba-spec [41](41-export-planning.ba-spec.md) (KHÔNG đổi ở đây).

---

## 1. Vấn đề & JTBD
- **Job**: Khi lần đầu (hoặc lâu rồi mới) mở trang Xuất khẩu, nhân viên Kế hoạch muốn được **dẫn tận nơi** qua từng chỗ trên trang theo đúng thứ tự công việc (xem lịch → mở hồ sơ → việc tiếp → chuyến → bước còn thiếu), để tự làm được mà không phải hỏi người khác hay đọc tài liệu dài.
- **Vì sao làm bây giờ**: trang Xuất khẩu mới (đợt 1, 2026-10-20) nhiều khối, 6 bước, nhiều nút ẩn trong "Thao tác khác"; trang chưa có cả hộp hướng dẫn "?" như các trang khác. Chủ dự án muốn có lối "bấm vào là đi một vòng" thay vì hộp chữ tĩnh.
- **Đo thành công bằng**: người mới đi hết tour (≤ 20 bước, ≤ 3 phút) chỉ ra đúng nơi làm 3 việc chính (lập HĐ · ghi duyệt / lên chuyến · cập nhật mục còn thiếu) mà không cần người kèm.

## 2. User registry
| User (role/tier) | Là ai | Vòng đời | Thiết bị/bối cảnh chính |
|---|---|---|---|
| Nhân viên Kế hoạch (`planner`, quyền ghi `export-plans`) | lập HĐ, lên chuyến, cập nhật bước | mới → quen | desktop văn phòng |
| Người xem (BGĐ / kế toán — chỉ quyền xem `export-plans`) | theo dõi tiến độ, không ghi | quen | desktop / điện thoại |
| Người trình diễn (admin ở chế độ demo) | dùng tour để giới thiệu trang cho người khác | quen | desktop chiếu màn |
| Hệ thống (dữ liệu hiện có của trang) | cung cấp hợp đồng / chuyến để tour mở minh họa | — | nền |

> Người đóng hàng (chỉ quyền `.loading`, màn đóng hàng riêng) — OUT đợt này (§7).

## 3. User × Nghiệp vụ
| # | Nghiệp vụ | Owner-user | User liên quan | Phụ thuộc NV | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Đi một vòng hướng dẫn trang Xuất khẩu (xem lịch → hồ sơ → chuyến) | Nhân viên Kế hoạch | Người xem, Người trình diễn (cùng luồng, bớt bước ghi) | — | thấp (lần đầu / khi quên) | Must |
| NV2 | Dừng / quay lại / bỏ qua giữa chừng, trả trang về chỗ cũ | Nhân viên Kế hoạch | như NV1 | NV1 | mỗi lần tour | Must |
| NV3 | Đọc hướng dẫn tóm tắt của trang (hộp "?") | Nhân viên Kế hoạch | Người xem | — | thấp | Should |
| NV4 | Khung tour dùng lại cho trang khác (khai bước, không viết lại cơ chế) | Hệ thống (người phát triển khai bước) | — | NV1 | khi thêm trang | Must (cơ chế) / Could (trang khác) |

## 4. Cross-user handoff map
N/A — không cross. Tour chỉ ĐỌC và DẪN; không tạo bản ghi, không chuyển việc cho ai.

## 5. Flows
### Flow NV1 — Đi một vòng trang Xuất khẩu · owner: Nhân viên Kế hoạch
- **Start**: đang ở Xuất khẩu (lịch xuất hàng, danh sách HĐ hoặc một hồ sơ), dữ liệu trang đã tải xong.
- **Input**: quyền của người dùng (ghi / chỉ xem / xem tiền về), dữ liệu hợp đồng + chuyến hiện có (thật hoặc demo), vị trí hiện tại của trang (kỳ xem, tab, hồ sơ đang mở).
- **Steps**:
  1. Lời mở: trang dùng để làm gì, 6 bước của một chuyến.
  2. Phần lịch: chỗ chuyển Lịch xuất hàng ↔ Hợp đồng · chỗ Lập hợp đồng (chỉ người có quyền ghi) · chọn kỳ xem tháng / tuần / ngày · lọc khách + tra cứu số giấy tờ · 4 chỉ số của kỳ · bảng chuyến theo khách · **cách đọc cột Tiến độ** (màu 6 khúc, "Bước tiếp", thẻ Trễ hạn / Chờ booking) · HĐ chưa lên đủ chuyến · chỗ mở hồ sơ.
  3. Tour tự mở **một hồ sơ minh họa** (chọn theo R4) và đi tiếp: **trạng thái hợp đồng** (Chờ duyệt · Đã duyệt · Đã xuất đủ · Đã chốt HĐ · Đã hủy + thẻ cảnh báo) · việc tiếp theo + Thao tác khác · tóm tắt HĐ · danh sách chuyến (nếu ≥ 2) · thông tin và **trạng thái chuyến** (Đang làm k/5 · Đủ hồ sơ · Trễ hạn giao · Đã hủy) · bước đang làm · **trạng thái mục và điều kiện file / số để "Xong"** (theo bảng NV8 ba-spec 41) · cập nhật mục · bước 6 gửi chứng từ và tiền về (chỉ người xem được tiền về) · điều khoản / dòng hàng / các bản hợp đồng.
  4. Lời kết: cách mở lại tour.
- **Output**: người dùng đã thấy từng chỗ theo đúng thứ tự công việc; trang trở về đúng vị trí trước khi bắt đầu; **không một bản ghi nào đổi**.
- **End**: bấm Kết thúc ở bước cuối (hoặc NV2).

### Flow NV2 — Dừng / lùi / bỏ qua · owner: Nhân viên Kế hoạch
- **Start**: tour đang chạy ở bước k.
- **Input**: lệnh của người dùng: tới, lùi, thoát (kể cả phím Esc), đổi cỡ màn / cuộn.
- **Steps**: tới ⇒ bước k+1 (bỏ qua bước không áp dụng cho người này, R3) · lùi ⇒ bước k−1 (cũng bỏ qua như trên; bước thuộc hồ sơ thì hồ sơ minh họa được mở lại) · thoát ⇒ dừng ngay.
- **Output**: tour dừng; trang về vị trí lúc bắt đầu (R5).
- **End**: không còn lớp tour; trang dùng được bình thường.

### Flow NV3 — Hộp hướng dẫn "?" · owner: Nhân viên Kế hoạch
- **Start**: bấm "?" ở đầu trang.
- **Input**: nội dung hướng dẫn tĩnh của trang Xuất khẩu.
- **Steps**: đọc tóm tắt → (tuỳ chọn) bắt đầu tour từ đây.
- **Output**: hộp đóng; nếu chọn bắt đầu thì sang Flow NV1.
- **End**: hộp đóng.

### Flow NV4 — Khai tour cho một trang · owner: Hệ thống (khai bước)
- **Start**: trang muốn có tour.
- **Input**: danh sách bước (mỗi bước: chỗ trên trang hoặc không chỗ — lời giữa trang, tiêu đề, lời, có bỏ qua được không, việc chuẩn bị như mở hồ sơ).
- **Steps**: trang đăng ký tour khi đang mở → lối vào tour hiện → khi trang đóng, tour của trang tự gỡ.
- **Output**: lối vào tour chỉ có ở trang đã khai.
- **End**: rời trang ⇒ không còn lối vào tour của trang đó.

## 6. Flow optimization log
| Flow | Candidate đã cân nhắc | Chọn / Loại | Lý do (theo rubric) | Đánh giá bởi | Conflict & xử |
|---|---|---|---|---|---|
| NV1 | A: chỉ hộp chữ tĩnh "?" như trang khác | Loại (giữ làm NV3) | không "đi từ bước này sang bước kia trên trang" — trượt định hướng của yêu cầu | Optimizer | — |
| NV1 | B: tour tự BẤM nút thật (lập HĐ, lưu, duyệt) để trình diễn | Loại | ghi số vào sổ thật — vi phạm R1; huỷ ngang giữa chừng để lại bản ghi dở (dead-end) | Optimizer + Domain (sổ sách) veto | Specialist veto: sổ sách thật không được sinh bản ghi minh họa (quy tắc 15) |
| NV1 | C: tour tự bật chế độ demo rồi đi | Loại | chế độ demo chỉ admin bật, đổi số cả app cho người đó — cross-cutting thừa (rubric 4) | Optimizer | — |
| NV1 | D: tour chỉ dẫn + đổi chỗ xem (mở hồ sơ có sẵn), chặn mọi thao tác trên trang khi đang chạy | **Chọn** | đủ thấy luồng thật, 0 ghi, thoát lúc nào cũng trả trang về chỗ cũ | Optimizer + Domain | — |
| NV1 | D1: mở hộp Lập hợp đồng trong tour để chỉ 5 khối | Loại | hộp mở lẫn với nháp tự lưu (quy tắc 17) và chặn lớp tour; lời ở bước Lập hợp đồng đã kể 5 khối | Optimizer | — |
| NV2 | lùi qua ranh giới lịch ↔ hồ sơ: A giữ hồ sơ mở · B trả về lịch | Chọn B | bước lịch phải thấy đúng lịch (Input đủ / Output rõ) | Optimizer | — |

## 7. Scope & Priority
- **IN**: cơ chế tour dùng chung (NV2, NV4); tour + hộp "?" cho Xuất khẩu (NV1, NV3).
- **OUT**: tour cho màn đóng hàng (`.loading`) và các trang khác (khai sau bằng NV4); tự mở tour lần đầu vào trang; nhớ "đã xem tour"; mở hộp form trong tour; video / ảnh động.

## 8. Success metric
| Nghiệp vụ | Metric | Ngưỡng đạt |
|---|---|---|
| NV1 | số bước tour Xuất khẩu (đủ quyền, có hồ sơ minh họa) | 12 ≤ n ≤ 22 (hiện 21) |
| NV1 | bản ghi bị đổi sau một vòng tour | 0 |
| NV2 | vị trí trang sau khi thoát (đường dẫn) | == lúc bắt đầu |
| NV1 | khung lời tour ở điện thoại 360 px, chữ 130 % | nằm trọn trong màn (0 px tràn) |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | Tour KHÔNG ghi / sửa / xóa bất kỳ bản ghi nào; trong lúc tour chạy, mọi thao tác lên trang bị chặn (chỉ tới / lùi / thoát) | bấm vào chỗ đang được chỉ ⇒ không có gì xảy ra |
| R2 | Thứ tự bước = thứ tự công việc của ba-spec 41 (xem → lập HĐ → duyệt → lên chuyến → bước còn thiếu → tiền về) | — |
| R3 | Bước gắn với chỗ không có cho người này (thiếu quyền, chưa có dữ liệu, < 2 chuyến) được bỏ qua cả khi tới lẫn khi lùi; bước bắt buộc mà chỗ chưa hiện ⇒ hiện lời giữa trang, không treo | chỗ hiện chậm (đang tải) ⇒ đợi tối đa 3 giây rồi mới coi là không có |
| R4 | Hồ sơ minh họa chọn theo thứ tự: HĐ đang chạy có chuyến chưa đủ hồ sơ → HĐ có chuyến bất kỳ → HĐ bất kỳ (ưu tiên đã duyệt, hạn giao gần nhất); không có HĐ nào ⇒ phần hồ sơ thay bằng MỘT lời giữa trang kể luồng, không mở gì | HĐ đã hủy chỉ dùng khi không còn HĐ nào khác |
| R5 | Thoát (ở bước nào, cách nào) ⇒ trang về đúng vị trí lúc bắt đầu (tab, kỳ xem, hồ sơ đang mở, vị trí cuộn) | bắt đầu từ trong một hồ sơ ⇒ thoát về chính hồ sơ đó |
| R6 | Bước có số thứ tự "k/n" với n = số bước còn hiệu lực cho người này (bước tùy chọn cùng chỗ xem mà chỗ không có thì trừ ra ngay khi tới chỗ xem đó — số không nhảy cóc) | — |
| R7 | Lối vào tour chỉ có khi trang đã khai tour và dữ liệu trang đã tải | đang tải ⇒ chưa có lối vào |
| R8 | Tour không tự bật; chỉ chạy khi người dùng chọn | — |
| R9 | Lời tour = văn phong tài liệu hướng dẫn (`src/design-system/noi-dung-va-label.md`): gọi đúng chữ đang hiện trên trang (tên nút, nhãn trạng thái), "chọn" thay "bấm", tiêu đề bước là danh từ không chấm cuối, lời kết thúc bằng dấu chấm; điều kiện trạng thái lấy đúng luật ba-spec 41 (không tự đặt) | nhãn trạng thái đổi ở code ⇒ sửa lời tour cùng commit |
| R10 | **Phủ nội dung**: lời tour + hộp "?" phủ đủ mọi mục ở §9b — khu vực có trạng thái thì giải thích trạng thái, điều kiện "Xong", cảnh báo và việc tiếp theo, không chỉ gọi tên khu vực | thêm trạng thái mới ở code ⇒ AC-10 đỏ cho tới khi lời tour có |
| R11 | **Nguồn nội dung**: mọi điều kiện / cách tính trong lời trích từ luật của ba-spec 41 ghi ở cột Nguồn của §9b; không tự diễn đạt lại làm đổi nghĩa | luật 41 đổi ⇒ sửa dòng §9b và lời cùng commit |
| R12 | **Đồng bộ**: `covers` gồm cả `src/lib/exportPlanning.ts` (nơi giữ hằng số nhãn) — đổi nhãn ở đó thì soát lời tour | — |

## 9b. Kiểm kê nội dung (nhánh nội dung — skill ba-flow-logic references/06)
Mỗi dòng: người đọc gặp gì · lời phải nói gì · nguồn. Văn phong: `src/design-system/noi-dung-va-label.md` (R9).

| Khu vực / đối tượng | Mục người đọc gặp | Lời phải nói | Nguồn | Bước tour |
|---|---|---|---|---|
| Chuyến · 6 bước | Hợp đồng · Lệnh sản xuất · Bao bì · Đóng cont · Bộ chứng từ · Khác | tên 6 bước + bước 6 là gửi chứng từ và tiền về | `STEP_TITLES` · 41 NV8, NV10 | `intro` |
| Kỳ xem | Tháng · Tuần · Ngày | chuyến xếp vào kỳ theo ngày đóng ?? ETD ?? tháng kế hoạch | 41 R1, R18 | `period` |
| Bốn chỉ số | Chuyến trong kỳ · đủ hồ sơ · còn thiếu · trễ hạn giao | nghĩa từng số; trễ hạn = on board (hoặc ETD) sau hạn giao | 41 NV11, R15 | `stats` |
| Thanh tiến độ | màu từng khúc = Xong · Đang làm · Chưa làm · Không áp dụng; "Bước tiếp" / "Đủ hồ sơ"; thẻ Trễ hạn, Chờ booking | đọc khúc, đọc dòng bước tiếp, nghĩa 2 thẻ | `ITEM_STATE_LABELS` · design-spec 42 | `shipment-progress` |
| Hợp đồng · trạng thái | Chờ duyệt · Đã duyệt · Đã xuất đủ · Đã chốt HĐ · Đã hủy | nghĩa từng trạng thái; Đã xuất đủ = mọi chuyến đủ hồ sơ + thực xuất trong dung sai cả kg lẫn tiền | `CONTRACT_STATE_LABELS`, `contractStateLabel` · 41 R3, NV12, R7 | `contract-status` |
| Hợp đồng · cảnh báo | Quá hạn giao · Còn … chưa lên chuyến · dòng hàng chưa nối danh mục · Bản sửa chờ duyệt · Ngoài dung sai | tên từng thẻ | 41 R15, R16, R3, R7 | `contract-status` |
| Hợp đồng · việc tiếp | Ghi kết quả duyệt → Lên chuyến; Thao tác khác | khi nào hiện việc nào; việc ít dùng nằm ở Thao tác khác | 41 NV4, NV7, NV5, NV6, NV13 | `next-action` |
| Chuyến · trạng thái | Đang làm · k/5 bước · Đủ hồ sơ · Trễ hạn giao · Đã hủy | nghĩa từng thẻ | 41 NV12, R15 | `shipment-card` |
| Mục · trạng thái + điều kiện "Xong" | Chưa làm · Đang làm · Xong · Không áp dụng; điều kiện file / số / chữ ký từng loại; Dùng chung | đủ vế điều kiện theo bảng NV8 (Lệnh SX cần file + HĐ đã duyệt + dòng hàng đã nối; Tờ khai cần số + file; Lệnh xuất cần file có chữ ký BGĐ; chứng từ cần số + ngày + file, công ty tự cấp không bắt số; 4a/4b tự xong khi có file); Không áp dụng phải có lý do | `ITEM_STATE_LABELS` · 41 bảng NV8, R4, R5, R16, R20 | `item-status` |
| Tiền về | Ghi gửi chứng từ · Ghi tiền về · "Tiền về x / y" | số phải thu = tiền trên Commercial Invoice; bước 6 không tính vào đủ hồ sơ | 41 NV10, R7, H5 | `payments` |

## 10. Acceptance Criteria — ORACLE
> Repo chưa có harness E2E (màn hình thử tay trên preview — CLAUDE.md). Phần thuần (chọn hồ sơ, dựng bước, tính bước kế) = **unit**; phần trên trang = **manual** bằng script đo trên preview demo (lý do: không có e2e runner), Assert vẫn là số đo được.

### AC-1 — Bắt đầu tour hiện bước 1 và chặn thao tác · Maps to: NV1 · Test: manual
- **Given** người có quyền ghi đang ở lịch xuất hàng, dữ liệu đã tải
- **When** chọn bắt đầu hướng dẫn từng bước
- **Then** bước 1 / n hiện; mọi thao tác lên trang bị chặn
- **Assert** đúng 1 khung tour trong trang, chữ đếm `Bước 1/n` với 12 ≤ n ≤ 22; `document.elementFromPoint` tại tâm nút Lập hợp đồng trả về lớp chặn của tour (không phải nút)

### AC-2 — Tới / lùi đi đúng thứ tự, bỏ qua bước không áp dụng · Maps to: NV2 · Test: unit
- **Given** danh sách 5 bước, bước 2 và 4 tùy chọn và chỗ của chúng không có
- **When** tới từ bước 1, rồi lùi từ bước 5
- **Then** tới ra bước 3, lùi ra bước 3; tới từ bước cuối ⇒ hết tour
- **Assert** `nextStepIndex(steps, 0, 1, has) == 2`; `nextStepIndex(steps, 4, -1, has) == 2`; `nextStepIndex(steps, 4, 1, has) == -1`; bước bắt buộc thiếu chỗ KHÔNG bị bỏ (`nextStepIndex` trả đúng chỉ số của nó)

### AC-3 — Chọn hồ sơ minh họa đúng thứ tự ưu tiên · Maps to: NV1 · Test: unit
- **Given** dữ liệu có: HĐ đã hủy (có chuyến), HĐ chỉ có chuyến đã hủy, HĐ đang chạy có chuyến chưa đủ hồ sơ
- **When** chọn hồ sơ minh họa
- **Then** chọn HĐ đang chạy có chuyến chưa đủ hồ sơ, kèm chuyến đó
- **Assert** `pickTourContract(data, opts)` == `{ contractId: <HĐ đang chạy>, shipmentId: <chuyến chưa đủ> }`; dữ liệu rỗng ⇒ `null`; chỉ có HĐ đã hủy ⇒ trả HĐ đã hủy với `shipmentId == ""`

### AC-4 — Không có hợp đồng: phần hồ sơ gói thành một lời · Maps to: NV1 · Test: unit
- **Given** trang Xuất khẩu không có hợp đồng nào
- **When** dựng các bước tour
- **Then** không bước nào mở hồ sơ; đúng 1 bước kể luồng hồ sơ không gắn chỗ
- **Assert** `buildExportTour({ pick: null, ... })`: 0 bước có `prepare` mở hồ sơ; đúng 1 bước id `dossier-overview` với `target` rỗng

### AC-5 — Người chỉ xem không bị dẫn tới chỗ ghi · Maps to: NV1 · Test: unit
- **Given** người chỉ có quyền xem, không xem tiền về
- **When** dựng các bước tour
- **Then** bước Lập hợp đồng, bước cập nhật mục và bước tiền về không có
- **Assert** `buildExportTour({ can: { create: false, update: false, payments: false }, ... })`: số bước có id thuộc {`create-contract`, `step-update`, `payments`} == 0; với đủ quyền con số đó == 3

### AC-6 — Thoát giữa chừng trả trang về chỗ cũ · Maps to: NV2 · Test: manual
- **Given** đang ở lịch tháng khác tháng hiện tại, tab Lịch
- **When** đi tới một bước trong hồ sơ minh họa rồi thoát bằng phím Esc
- **Then** tour đóng, trang về lịch tháng cũ
- **Assert** `location.hash` sau khi thoát == trước khi bắt đầu; số khung tour trong trang == 0

### AC-7 — Một vòng tour không đổi bản ghi nào · Maps to: NV1 · Test: manual
- **Given** preview chế độ demo (dữ liệu dưới máy)
- **When** đi hết tour tới Kết thúc
- **Then** dữ liệu không đổi
- **Assert** băm (khóa + độ dài giá trị) mọi khóa `bsf*` trong localStorage trước == sau; 0 yêu cầu mạng ghi (POST/PATCH/DELETE) trong lúc tour

### AC-8 — Khung tour nằm trọn trong màn điện thoại · Maps to: NV1 · Test: manual
- **Given** cửa sổ 360 px, cỡ chữ 130 %
- **When** đi qua mọi bước
- **Then** khung lời không tràn, chỗ được chỉ nằm trong tầm nhìn
- **Assert** mỗi bước: khung tour `left >= 0`, `right <= 360`; `documentElement.scrollWidth == 360`; mép trên chỗ được chỉ ≥ mép dưới thanh tiêu đề và < mép trên khung lời; thanh tiêu đề không trôi (`top >= 0`)

### AC-9 — Lối vào chỉ có ở trang đã khai · Maps to: NV4 · Test: manual
- **Given** trang Xuất khẩu đã khai tour, trang Nhập hàng chưa
- **When** mở lần lượt hai trang
- **Then** Xuất khẩu có lối vào tour; Nhập hàng không
- **Assert** số phần tử lối vào tour (`[data-tour-start]`) ở `/planning-export` ≥ 1, ở `/imports` == 0

### AC-10 — Lời tour phủ đủ nhãn trạng thái · Maps to: NV1 · Test: unit
- **Given** hằng số nhãn trong code: 5 trạng thái hợp đồng (gồm "Đã chốt HĐ"), 4 trạng thái mục, 6 tên bước, 4 thẻ chuyến (Đủ hồ sơ · Trễ hạn · Chờ booking · Dùng chung)
- **When** dựng tour Xuất khẩu đủ quyền, có hồ sơ minh họa
- **Then** mỗi nhãn xuất hiện nguyên văn ít nhất một lần trong lời tour
- **Assert** số nhãn trong `CONTRACT_STATE_LABELS` ∪ {"Đã chốt HĐ"} ∪ `ITEM_STATE_LABELS` ∪ `STEP_TITLES` ∪ thẻ chuyến KHÔNG có trong lời == 0

### AC-11 — Văn phong lời tour · Maps to: NV1 · Test: unit
- **Given** mọi bước của tour (có và không có hồ sơ minh họa)
- **When** kiểm theo R9
- **Then** tiêu đề không chấm cuối, lời kết thúc bằng dấu chấm, không dùng động từ "bấm / nhấn / click"
- **Assert** số tiêu đề kết thúc "." == 0; số lời không kết thúc "." == 0; số lần xuất hiện "bấm" / "nhấn" / "click" (không phân hoa thường) == 0

## 11. Assumptions / Open
- **Assumptions**: tour không tự bật lần đầu và không nhớ "đã xem" (R8, OUT); lối vào ở cả hộp "?" của trang lẫn một nút phụ trên trang (cùng một tour); chữ tour viết theo giọng hướng dẫn hiện có (nói việc, không thuật ngữ); tour dùng dữ liệu đang có (thật hay demo đều được) — không sinh số mẫu (quy tắc 15).
- **Open (RED)**: không có.

## History
- v3 (2026-10-21): áp nhánh nội dung (skill ba-flow-logic references/06) — §9b kiểm kê có nguồn, R10–R12, AC-10 phủ nhãn + AC-11 văn phong (unit, đọc thẳng hằng số nhãn).
- v2 (2026-10-21): theo góp ý chủ dự án — tên "Hướng dẫn thao tác", lời viết lại theo văn phong tài liệu (R9), thêm bước giải thích trạng thái hợp đồng / chuyến / mục và điều kiện file; R5 trả cả vị trí cuộn; giới hạn 22 bước. Đã chạy: 21 bước đạt ở 1366 px và 360 px × 100 / 130 % (0 bước khuất / đè / tràn), dữ liệu dưới máy không đổi, đường dẫn trả về.
- v1 (2026-10-21): khởi tạo — cơ chế tour dùng chung + tour Xuất khẩu + hộp "?" Xuất khẩu.
