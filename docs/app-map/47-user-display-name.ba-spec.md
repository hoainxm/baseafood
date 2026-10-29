# 47 — ba-spec: Tên gọi (nickname) của người dùng — tách khỏi họ tên ghi sổ

> Load khi: người dùng muốn được gọi bằng tên khác họ tên (biệt danh, tên tiếng Anh…); thêm chỗ nào hiện tên người; thêm cột "người ghi / người lập / người ký"; đụng `scopeContextFor` / phạm vi `own`; làm chữ ký về sau.
covers: src/lib/personName.ts, src/types.ts, src/lib/auth.ts, src/lib/repo.ts, src/lib/permissions.ts, src/App.tsx, src/features/shared/AccountMenu.tsx, src/features/users/**, src/features/my-tasks/**, src/features/admin/**, supabase/migrations/0086_user_display_name.sql
last_verified: 2026-10-29
ttl_days: 180

> **Mục đích**: oracle HÀNH VI cho "tên gọi" — ai đặt, hiện ở đâu, và **chỗ nào TUYỆT ĐỐI dùng họ tên thật**. KHÔNG mô tả giao diện (design-spec làm sau nếu cần).

---

## 0. Bối cảnh — vì sao không sửa thẳng họ tên (đã kiểm 2026-10-29)

Kế toán `nnttruc` (Nguyễn Như Thanh Trúc) muốn cả hệ thống gọi mình là **"Alley"**. Sửa thẳng `user_profiles.full_name` thành "Alley" sẽ gây 3 hỏng thật:

| # | Hỏng | Bằng chứng trong code / DB |
|---|---|---|
| H1 | **Mất quyền sửa sổ cũ của chính mình.** Phạm vi `own` so cột người ghi (`operator`) với `[họ tên, tên đăng nhập]`. Đổi họ tên ⇒ dòng ghi bằng tên cũ không còn là "của mình" | app: `scopeContextFor` + `rowInScope` (`lib/permissions.ts`); máy chủ: trigger `0065` đọc `full_name` làm `identities`. Trúc đang có 76 chuyến nhập + 16 dòng SX ghi "Nguyễn Như Thanh Trúc" |
| H2 | **Sổ mới ghi "Alley", sổ cũ ghi họ tên** ⇒ một người hai tên trên sổ; lọc / đối chiếu theo người ghi bị tách đôi | mọi màn ghi chụp `profile.fullName` làm người ghi: Nhập hàng, SX, Xuất khẩu, Tài liệu, nhãn lô, Cân đối, giao việc |
| H3 | **Chứng từ kế toán phải mang họ tên thật** người lập / người ký (Luật Kế toán 2015 Đ.16 — nội dung chứng từ có "họ tên, chữ ký" người lập, người duyệt). Biệt danh trên chứng từ = chứng từ không hợp lệ | nhật ký `audit_log`, bản in A4, ký PDF tài liệu, chữ ký về sau |

Đổi **tên đăng nhập** (`nnttruc` → `alley`) không giải quyết nhu cầu (lời chào + danh sách người vẫn hiện họ tên) và kéo theo hỏng riêng (§7 OUT).

⇒ Giải pháp: thêm **tên gọi** riêng, chỉ dùng để **gọi / nhận diện** người; mọi chỗ **ghi sổ / định danh pháp lý / phân quyền** giữ họ tên thật.

## 1. Vấn đề & JTBD
- **Job**: Khi dùng app hằng ngày, người dùng muốn được gọi bằng tên mình chọn, để thấy app "của mình" — mà sổ sách, nhật ký, chứng từ vẫn đứng đúng họ tên pháp lý.
- **Vì sao làm bây giờ**: người dùng thật yêu cầu; nếu không có đường chính thức, admin dễ sửa thẳng họ tên ⇒ hỏng H1–H3.
- **Đo thành công bằng**: đặt tên gọi xong, số dòng sổ có người ghi = tên gọi == 0 và số dòng "của mình" người đó sửa được không đổi.

## 2. User registry
| User | Là ai | Vòng đời | Bối cảnh |
|---|---|---|---|
| Người dùng (mọi vai trò) | tổ trưởng, thủ kho, kế toán, kế hoạch… — người có tên gọi | quen | web, mọi cỡ màn |
| Admin | quản trị tài khoản ở màn Người dùng | quen | desktop |
| Người giao việc | quản đốc, phó QĐ, kế toán (trưởng) — chọn người nhận việc | quen | web |
| Hệ thống ghi sổ | các màn ghi + `audit_log` + trigger `0065` — chụp tên người ghi | — | nền |

## 3. User × Nghiệp vụ
| # | Nghiệp vụ | Owner-user | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Đặt / đổi / bỏ tên gọi của chính mình | Người dùng | Admin (thấy được, sửa được) | — | rất thấp | Must |
| NV2 | Sửa / bỏ tên gọi của người khác (tên không phù hợp, trùng gây nhầm) | Admin | Người dùng (bị sửa) | NV1 | rất thấp | Must |
| NV3 | Nhận diện người trong danh sách chọn người (giao việc, người giữ vai trò, quyền riêng) | Người giao việc / Admin | Người dùng có tên gọi | NV1 | trung | Must |
| NV4 | Ghi sổ, nhật ký, chứng từ, phân quyền theo dòng bằng **họ tên thật** | Hệ thống ghi sổ | — | — | cao | Must (bất biến) |

## 4. Cross-user handoff map
| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện | Khi không ai nhận |
|---|---|---|---|---|---|
| H1 | NV1→NV2 | Người dùng đặt tên gọi | Admin | luôn — admin thấy tên gọi cạnh họ tên ở danh sách Người dùng; nhật ký ghi lần đổi | không cần duyệt: tên gọi có hiệu lực ngay (chỉ là cách gọi, không đổi quyền / sổ) |
| H2 | NV1→NV3 | Người dùng có tên gọi | Người giao việc | người đó nằm trong danh sách chọn | — (danh sách luôn kèm họ tên thật nên không ai chọn nhầm) |

## 5. Flows

### Flow NV1 — Đặt tên gọi của mình · owner: Người dùng
- **Start**: đã đăng nhập, có hồ sơ
- **Input**: tên gọi mới (có thể rỗng = bỏ tên gọi)
- **Steps**: mở phần tài khoản của mình → nhập tên gọi → lưu → hệ thống kiểm R5 → ghi hồ sơ + nhật ký
- **Output**: hồ sơ có `tên gọi` mới; các chỗ "gọi người" (R2) hiện tên gọi ngay, kể cả ở máy khác sau khi tải lại; nhật ký có 1 dòng "đổi tên gọi: '<cũ>' → '<mới>'"
- **End**: lưu xong; hoặc bị chặn kèm lý do (R5) và không ghi gì

### Flow NV2 — Admin sửa / bỏ tên gọi người khác · owner: Admin
- **Start**: admin ở danh sách Người dùng, thấy cột tên gọi
- **Input**: người cần sửa + tên gọi mới (rỗng = bỏ)
- **Steps**: sửa trong form hồ sơ người đó (cùng chỗ sửa họ tên) → lưu → kiểm R5 → ghi + nhật ký
- **Output**: như NV1; nhật ký ghi người sửa là admin
- **End**: lưu xong hoặc bị chặn kèm lý do

### Flow NV3 — Chọn người · owner: Người giao việc
- **Start**: đang chọn người (giao việc, gán quyền riêng)
- **Input**: chữ gõ tìm (tên gọi, họ tên hoặc tên đăng nhập)
- **Steps**: gõ "alley" hoặc "trúc" hoặc "nnttruc" → cùng ra một người, mỗi lựa chọn kèm cả tên gọi lẫn họ tên thật
- **Output**: chọn đúng người; bản ghi việc chụp **họ tên thật** người nhận (R1)
- **End**: đã chọn

### Flow NV4 — Ghi sổ (bất biến) · owner: Hệ thống
- **Start**: bất kỳ thao tác ghi nào
- **Input**: hồ sơ người đang dùng
- **Steps**: lấy **họ tên** (rỗng thì tên đăng nhập) làm người ghi / người lập / người giao / người nhận; KHÔNG BAO GIỜ lấy tên gọi
- **Output**: dòng sổ, nhật ký, nhãn in, chứng từ mang họ tên thật
- **End**: dòng ghi xong

## 6. Flow optimization log
| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi | Conflict |
|---|---|---|---|---|---|
| tổng | A: admin sửa thẳng họ tên thành "Alley" | **Loại** | hỏng H1 (mất quyền sửa 92 dòng của chính mình), H2 (một người hai tên trên sổ), H3 (chứng từ sai luật) — rubric #3 (tạo dead-end: dòng cũ không ai sửa được ngoài quản lý) | Orchestrator + Domain-Specialist (kế toán / chứng từ) | Specialist veto (H3) |
| tổng | B: đổi tên đăng nhập `nnttruc` → `alley` | **Loại** cho nhu cầu này | không đổi chỗ hiện tên (vẫn hiện họ tên); tách lịch sử nhật ký (`actor_username`) làm đôi; cần hàm đổi email đăng nhập phía máy chủ — rubric #1 (không gắn đúng nhu cầu) | Orchestrator | — |
| tổng | C: thêm **tên gọi** riêng, chỉ dùng ở chỗ "gọi người"; ghi sổ giữ họ tên | **Chọn** | ít thay đổi nhất (1 cột + đổi chỗ hiện), không chạm sổ cũ, không chạm phân quyền | Optimizer + Specialist | — |
| tổng | D: như C nhưng thay luôn người ghi ở sổ cũ bằng tên gọi | **Loại** | H2 + H3; ghi đè sổ thật không đảo được | Specialist veto | — |
| tổng | E: chỉ đổi lời chào, lưu tên gọi dưới máy | **Loại** | không theo người sang máy khác; vi phạm quy tắc 4 (mọi đọc ghi qua repo) | Optimizer | — |
| NV1 | đặt tên gọi cần admin duyệt | **Loại** | thêm 1 handoff không cần (tên gọi không đổi quyền / sổ) — rubric #4; thay bằng admin thấy + sửa được (H1) | Optimizer | — |
| NV3 | danh sách chọn chỉ hiện tên gọi | **Loại** | người giao việc không biết "Alley" là ai ⇒ chọn nhầm; luôn kèm họ tên | Cross-User-Integrity | — |

## 7. Scope & Priority
- **IN**: NV1–NV4; tên gọi cho MỌI người dùng (không riêng Trúc).
- **OUT**:
  - Đổi tên đăng nhập. Nếu sau này vẫn cần: phải có hàm admin đổi email đăng nhập phía máy chủ, giữ tên cũ trong `identities` để phạm vi `own` không gãy, và nhật ký tra được cả tên cũ lẫn mới — làm ba-spec riêng.
  - Sửa sổ cũ, đổi người ghi hàng loạt.
  - Ảnh đại diện, chữ ký điện tử (khi làm, chữ ký theo R1).

## 8. Success metric
| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV1 | sau khi đặt tên gọi, số dòng sổ mới có người ghi = tên gọi | == 0 |
| NV1 | số dòng "của mình" người đó sửa được trước / sau khi đặt tên gọi | bằng nhau |
| NV3 | tìm bằng tên gọi, họ tên hoặc tên đăng nhập | cả 3 ra cùng 1 người |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | **Ghi sổ luôn dùng họ tên thật** (rỗng ⇒ tên đăng nhập), không bao giờ dùng tên gọi: người ghi / người lập / người giao / người nhận việc / người in nhãn / người sửa cân đối / nhật ký / bản in / chữ ký | người có tên gọi giao việc ⇒ người giao trong bản ghi việc vẫn là họ tên |
| R2 | **Chỗ "gọi người" ưu tiên tên gọi** (rỗng ⇒ họ tên ⇒ tên đăng nhập): lời chào, tên ở menu tài khoản, màn đặt mật khẩu riêng, "Việc cần làm của …" | người chưa đặt tên gọi ⇒ hiện y như hiện nay |
| R3 | **Chỗ người KHÁC nhận diện** (danh sách chọn người, người giữ vai trò, danh sách Người dùng của admin) hiện **cả hai**: tên gọi + họ tên thật; không bao giờ chỉ tên gọi | người không có tên gọi ⇒ chỉ họ tên |
| R4 | **Phân quyền theo dòng không xét tên gọi**: `identities` = `[họ tên, tên đăng nhập]`, ở cả app lẫn trigger máy chủ `0065` | ai đó đặt tên gọi trùng họ tên người khác ⇒ KHÔNG được quyền "của mình" trên dòng người kia |
| R5 | Tên gọi: cắt khoảng trắng hai đầu; dài ≤ 30 ký tự; không trùng họ tên hoặc tên gọi của **người khác** (không phân biệt hoa thường, bỏ dấu khi so); rỗng = không có tên gọi | đặt tên gọi = chính họ tên mình ⇒ cho, lưu như rỗng |
| R6 | Đổi tên gọi ghi 1 dòng nhật ký, có giá trị cũ và mới; không đụng dòng sổ nào khác | — |
| R7 | Chế độ demo: `user_profiles` là tài khoản THẬT, không thuộc bộ demo (`auth.ts` dùng `SITE_ID_THAT`; màn Người dùng chặn khi đang demo) ⇒ tên gọi không vào `DemoBundle` | đặt tên gọi lúc đang demo ⇒ ghi vào hồ sơ thật, như đổi mật khẩu |
| R8 | Tên gọi là dữ liệu người dùng gõ ⇒ hiện dạng chữ thuần, không diễn giải định dạng | tên gọi chứa ký tự `<`, `*` |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Đặt tên gọi đổi cách gọi · Maps to flow: NV1 · Test: e2e
- **Given** người dùng họ tên "Nguyễn Như Thanh Trúc", chưa có tên gọi
- **When** đặt tên gọi "Alley" rồi lưu
- **Then** lời chào và tên ở phần tài khoản của chính họ hiện "Alley"
- **Assert**: tên đang gọi người dùng == "Alley"; hồ sơ `displayName` == "Alley"; `fullName` == "Nguyễn Như Thanh Trúc" (không đổi)

### AC-2 — Ghi sổ sau khi có tên gọi vẫn là họ tên · Maps to flow: NV4 · Test: integration
- **Given** người dùng có tên gọi "Alley"
- **When** ghi 1 chuyến nhập, 1 dòng SX, 1 việc giao đi
- **Then** cả 3 bản ghi đứng tên "Nguyễn Như Thanh Trúc"
- **Assert**: `operator` / người ghi / người giao của 3 bản ghi == "Nguyễn Như Thanh Trúc"; số bản ghi chứa "Alley" == 0

### AC-3 — Hàm chọn tên ghi sổ không bao giờ trả tên gọi · Maps to flow: NV4 · Test: unit
- **Given** hồ sơ `{ fullName: "Nguyễn Như Thanh Trúc", displayName: "Alley", username: "nnttruc" }` và hồ sơ `{ fullName: "", displayName: "Alley", username: "nnttruc" }`
- **When** lấy tên ghi sổ và tên gọi
- **Then** tên ghi sổ lần lượt là họ tên và tên đăng nhập; tên gọi là "Alley"
- **Assert**: tên ghi sổ == "Nguyễn Như Thanh Trúc" rồi == "nnttruc"; tên gọi == "Alley" cả 2 ca; mọi màn ghi trong `covers` gọi hàm ghi sổ (test quét mã: số chỗ chụp người ghi đọc trực tiếp `displayName` == 0)

### AC-4 — Phạm vi "của mình" không đổi · Maps to flow: NV4 · Test: unit
- **Given** phạm vi `own`, dòng có `operator` = "Nguyễn Như Thanh Trúc"
- **When** người đó đặt tên gọi "Alley"
- **Then** vẫn sửa được dòng đó; người khác đặt tên gọi "Nguyễn Như Thanh Trúc" bị chặn bởi R5, và nếu dữ liệu cũ có trùng thì vẫn không sửa được dòng đó
- **Assert**: `rowInScope("own", ctx(Trúc có tên gọi), row)` == true; `scopeContextFor(...)`.identities không chứa tên gọi (length == 2 khi đủ họ tên + tên đăng nhập)

### AC-5 — Máy chủ không xét tên gọi · Maps to flow: NV4 · Test: integration (PGlite)
- **Given** trigger `0065` đang bật, hồ sơ có tên gọi
- **When** người đó sửa dòng có `operator` = họ tên của mình; người khác có tên gọi = họ tên đó sửa cùng dòng
- **Then** người đầu được, người sau bị chặn
- **Assert**: lần 1 không lỗi; lần 2 lỗi `42501`

### AC-6 — Chọn người hiện đủ và tìm được bằng cả 3 tên · Maps to flow: NV3 · Test: unit
- **Given** danh sách người gồm Trúc (tên gọi "Alley") và 1 người không có tên gọi
- **When** dựng danh sách chọn và tìm "alley", "trúc", "nnttruc"
- **Then** cả 3 lần tìm ra Trúc; nhãn của Trúc chứa cả "Alley" lẫn "Nguyễn Như Thanh Trúc"; nhãn người kia chỉ có họ tên
- **Assert**: số kết quả mỗi lần tìm == 1 và id == id Trúc; nhãn Trúc chứa 2 chuỗi trên; nhãn người kia không chứa dấu ngăn tên gọi

### AC-7 — Kiểm tên gọi · Maps to flow: NV1, NV2 · Test: unit
- **Given** đã có người khác họ tên "Trần Thị Mai" và người khác tên gọi "Bin"
- **When** đặt tên gọi lần lượt: "  Alley  ", chuỗi 31 ký tự, "tran thi mai", "BIN", chính họ tên mình, ""
- **Then** lần lượt: lưu "Alley"; chặn quá dài; chặn trùng họ tên người khác; chặn trùng tên gọi người khác; lưu như rỗng; lưu rỗng
- **Assert**: 3 ca chặn trả lỗi khác rỗng và hồ sơ không đổi; 3 ca lưu cho `displayName` lần lượt == "Alley", "", ""

### AC-8 — Admin sửa tên gọi người khác + nhật ký · Maps to flow: NV2 · Test: integration
- **Given** admin, người dùng có tên gọi "Alley"
- **When** admin đổi thành "" (bỏ)
- **Then** người dùng được gọi lại bằng họ tên; nhật ký có 1 dòng ghi người sửa là admin, cũ "Alley", mới ""
- **Assert**: `displayName` == ""; số dòng `audit_log` mới cho hồ sơ đó == 1 với `actor_username` == tên đăng nhập admin

### AC-9 — Người chưa có tên gọi không đổi gì · Maps to flow: NV1 · Test: unit
- **Given** hồ sơ không có tên gọi
- **When** dựng tên gọi, tên ghi sổ, nhãn chọn người
- **Then** cả 3 giống hệt bản hiện nay
- **Assert**: tên gọi == tên ghi sổ == họ tên; nhãn == họ tên

## 11. Assumptions / Open
- **Assumptions** (fail-closed, chủ dự án đổi được):
  - A1 Người dùng **tự đặt** tên gọi, không cần admin duyệt; admin thấy và sửa được (R3, NV2).
  - A2 Tên gọi hiện cho **cả người khác** ở danh sách chọn người, luôn kèm họ tên (R3).
  - A3 Dữ liệu: 1 cột mới trong hồ sơ người dùng, mặc định rỗng ⇒ migration chỉ-thêm-cột (🟡, viết sẵn `drop`). Số dự kiến `0086` — rà lại số trên origin lúc viết. Cũ không chạy migration ⇒ app coi như không ai có tên gọi, không hỏng.
  - A4 Bản in / chứng từ: phiếu trắng để ô ký tay (`BlankSlipPrint`); bản in nào lấy tên người từ hồ sơ thì theo R1 — lúc build rà hết chỗ in, chưa rà ở bước BA.
- **Open (RED)**: không có — không sửa sổ cũ, không đổi RLS, không đổi trigger `0065` (chỉ khóa hành vi bằng test AC-5).

## 12. Hiện thực (build 2026-10-29)
| Phần | Ở đâu |
|---|---|
| Cột + hàm tự đặt | `0086_user_display_name.sql`: `user_profiles.display_name` + `set_own_display_name(tên)` (security definer, chỉ cột này của `auth.uid()`; RLS sửa vẫn chỉ admin) |
| 3 hàm tên + kiểm R5 | `lib/personName.ts`: `recordName` (R1) · `callName` (R2) · `personLabel` + `personSearchText` (R3) · `checkDisplayName` (R5) · `isDisplayNameAvailable` (dò cột 0086) |
| Tự đặt (NV1) | menu tài khoản → "Đặt tên gọi" (`AccountMenu.tsx`, nháp `account-display-name`); `App.tsx` kiểm R5 rồi gọi `useAuth().setOwnDisplayName` (ghi nhật ký) |
| Admin sửa (NV2) | màn Người dùng → Sửa → ô Tên gọi; cột Họ tên hiện thêm "Tên gọi: …"; tìm theo tên gọi |
| Test | AC-3/4/6/7/9 + quét mã: `lib/personName.test.ts` · AC-5 + hàm + RLS: PGlite (14 phép, scratchpad, ghi ở 03-database) · AC-1/2/8: thử tay sau khi chạy 0086 (chưa làm — cần đăng nhập DB thật) |

## History
- v1.2 (2026-10-29): đổi tên đăng nhập (§7 OUT) chốt cách làm KHÔNG cần tính năng: đổi email Auth, giữ `user_profiles.username` + metadata làm tên nhật ký — quy trình ở 05 § Đổi tên đăng nhập. Áp cho Trúc: đăng nhập `alley`, nhật ký `nnttruc`.
- v1.1 (2026-10-29): ĐÃ BUILD (§12); R7 sửa theo thực tế — hồ sơ người dùng không thuộc bộ demo. 0086 chưa chạy trên DB thật.
- v1 (2026-10-29): khởi tạo — yêu cầu của `nnttruc` muốn được gọi "Alley"; chọn phương án tên gọi riêng (C), loại sửa họ tên / đổi tên đăng nhập.
