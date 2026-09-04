# CLAUDE.md — Baseafood MES

Cửa vào cho AI agent. File này = quy tắc + định tuyến. **Chi tiết nghiệp vụ nằm ở [`docs/app-map/`](docs/app-map/README.md) — đọc đúng file cần dùng, đừng đọc cả codebase.**

Hệ thống MES cho Xí nghiệp Baseafood BSF1 (Bà Rịa). **Repo mới, độc lập với SDFactory** (SDFactory chỉ là demo bán hàng — không kế thừa cấu trúc dữ liệu/phân quyền).

**Nghiệp vụ trọng tâm:** quản lý nguyên liệu trong sản xuất theo vòng lặp gối đầu (mua → sơ chế → cấp đông → tồn dự trữ → xả đông tái dùng kỳ sau), kéo theo tồn kho. Đau nhất: tồn nguyên liệu cuối kỳ sai do ghi chép tay → kế toán chốt số sai. Ba phân xưởng: **Đông · Cá · Khô**.

**Người dùng:** tổ trưởng/thủ kho + kế toán, thao tác trên **web** ở nhiều cỡ màn (điện thoại → desktop). Ưu tiên thiết kế: **responsive gọn, mật độ web thường, chạy khít mọi cỡ màn** (bỏ lối ép cỡ lớn cho người lớn tuổi/tablet — quyết định 2026-08-21). Người mắt kém vẫn có lối phóng to 90–130% ở Cài đặt hiển thị. Luật UI ở [`src/design-system/README.md`](src/design-system/README.md).

## Stack & lệnh

React 19 · Vite 8 · TypeScript strict · Tailwind v4 · primitive shadcn (style `radix-nova`) · Supabase env-gated · oxlint. Alias `@/*` → `src/*`.

```bash
npm run dev      # :5173
npm run build    # tsc -b && vite build — cổng kiểu, phải xanh
npm run lint     # oxlint
```

**Không có test tự động** (không vitest/jest/CI). Cổng chất lượng hiện tại là `build` + `lint` + thử tay trên preview — xem bảng bên dưới.

## Cấu trúc

```
src/
├── App.tsx · main.tsx        điều hướng react-router-dom v7 (HashRouter) — ~17 route, khung ở features/shared/AppShell.tsx
├── types.ts                  kiểu + BẤT BIẾN nghiệp vụ (laGhiBu, thanhTien)
├── data/thanh-pham.json      141 mã TK 1551 — chỉ là SEED
├── lib/                      repo · catalogRepo · db · supabase · connectivity · balancingCalc · balancingGrid · periodUtils · inventory · inventoryMaterial · nxtExcel · auth · username · format · store · utils
├── components/ui/            primitive shadcn — size mật độ web thường (token-driven)
├── design-system/            tokens.css · patterns/ · kit/ · index.ts (cửa import duy nhất)
└── features/                 THẬT: imports · production/WipProductionScreen (/wip) · packaging (/packaging) · warehouse · orders · sales · balancing · catalog · reports/NXT · auth · users
                              DEMO (dữ liệu mẫu): production/WorkOrderScreen (/production) · cold-storage · reports · dashboard · quality · traceability
supabase/migrations/          0001 … 0026
docs/README.md                bản đồ tài liệu — doc nào ở đâu, doc mới bỏ đâu
docs/app-map/                 bản đồ ngữ cảnh cho agent (đọc khi CODE)
docs/ops/                     vận hành: cutover Supabase · deploy Vercel · env
docs/spec/                    đặc tả/ADR trước khi build
docs/trien-khai/              nghiệp vụ gốc (phân tích, 28 câu hỏi đã chốt, thiết kế flow)
```

Chi tiết + ranh giới import: [`01-app-structure.md`](docs/app-map/01-app-structure.md).

## Quy tắc code

1. TypeScript strict; function components.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN** qua `lib/format.ts`, class `tnum` (tabular-nums).
3. **`src/features/**` chỉ import từ `@/design-system`.** Cấm `@/components/ui/*` trực tiếp; cấm viết class cỡ chữ/mã màu tay — sửa `tokens.css` thay vì đè cục bộ. *(hook pre-commit chặn)*
4. Mọi đọc/ghi dữ liệu qua hook trong `lib/catalogRepo.ts` → `lib/repo.ts`. **Không** gọi `localStorage` hay `supabase` từ màn hình.
5. Nhãn luôn hiện (không dùng placeholder thay nhãn); vùng chạm ≥ 44px; nút Lưu **không bao giờ** `disabled` (thiếu thì bắn `ErrorSummary`).
6. Không xóa bản ghi nghiệp vụ theo kiểu lặng lẽ — dùng trạng thái; mọi xóa hiện tại qua `ConfirmDelete` + toast **Hoàn tác**.
7. Danh mục thay nhập tự do: đại lý / loại NL / mặt hàng / khách hàng chọn qua `Combobox` (tạo mới tại chỗ, lưu ngay vào danh mục).
8. Đặt tên DB: **tiếng Anh, snake_case, không tiền tố** (đã đổi từ tiếng Việt-không-dấu sang tiếng Anh ở migration `0016_rename_to_english.sql` — theo [`spec/routing-va-naming.md`](docs/spec/routing-va-naming.md)). Vẫn cấm tên có dấu (NFC/NFD trông giống hệt nhưng là 2 định danh). Bảng cũ tiếng Việt chỉ còn trong migration `0001…0015`.
9. Brand `#17529c` (từ `public/baseafood-logo.png`).
10. `npx shadcn add` **không chạy được trên Windows** (CLI quét ngược thư mục cha, đụng junction bị khóa quyền) — lấy component thủ công theo `src/design-system/README.md`.
11. 🔒 Không ghi project ref / URL / key vào bất kỳ file nào trong repo.

## Commit

Conventional Commits, scope **tiếng Việt không dấu**, mô tả tiếng Việt có dấu:

```
feat(nhap-hang): chuyến thật, ghi bù chờ hóa đơn, chốt ngày
fix(dong-bo): hàng chờ chống mất số liệu khi ghi máy chủ hụt
docs(app-map): bổ sung invariant phế liệu
```

Body giải thích **vì sao**, không liệt kê file đã sửa. Kết bằng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

### Workflow push & deploy — quy tắc chuẩn cho MỌI session (chốt với chủ dự án 2026-08-25)

- **Làm thẳng trên `main`.** Commit/push **trực tiếp vào `main`**, **KHÔNG** tách nhánh feature, **KHÔNG** mở PR (trừ khi người dùng yêu cầu rõ). Nếu harness cấp sẵn một nhánh `claude/...` ở đầu session, **vẫn ưu tiên quy tắc này** — chủ dự án đã chốt làm trên `main`. Chỉ commit khi người dùng yêu cầu.
- **Deploy = phải đẩy CẢ HAI repo.** Vercel build từ repo cá nhân **`hoainxm/baseafood`**; nguồn thật là **`sdvico/baseafood`**. Một commit **chỉ lên bản chạy khi có mặt ở cả hai**. **Giữ Vercel ở `hoainxm` — ĐỪNG tự đổi sang sdvico** (quyết định của chủ dự án).
- **Phiên Claude trên web chỉ push được `sdvico`** — proxy chặn `hoainxm` (khác chủ sở hữu; `add_repo` cross-owner bị từ chối, `git push` thẳng bị 403). ⇒ Sau khi push `sdvico/main`, **tự mình không mirror được** sang `hoainxm`.
- **Cách xử mỗi lần push:** push `sdvico/main` xong, **đưa người dùng lệnh mirror** để họ chạy ở máy local (máy họ có quyền cả hai repo). Nhắc **`pull` trước** kẻo "non-fast-forward":
  ```bash
  git fetch origin main
  git push https://github.com/hoainxm/baseafood.git origin/main:main
  ```
  (Máy local người dùng có `origin` 2 push URL, nên `git checkout main && git pull && git push` cũng đẩy **cả hai cùng lúc** — miễn là `pull` trước.)
- **Muốn agent tự đẩy cả hai:** mở session với **cả `sdvico` lẫn `hoainxm` làm nguồn ban đầu**, rồi cấu hình `origin` 2 push URL và push một phát cả hai.
- Cơ chế **nhắc tải lại khi có bản mới** (`version.json` + `UpdateBanner`): xem [`ops/deploy-vercel.md`](docs/ops/deploy-vercel.md).

## Risk tier — xác định TRƯỚC khi làm

| Tier | Nghĩa | Cách xử |
|---|---|---|
| 🟢 **GREEN** | Hoàn tác được bằng `git` | Làm thẳng. Sửa component, màn hình, doc, thêm bộ lọc, đổi chữ hiển thị. |
| 🟡 **YELLOW** | Hoàn tác được nhưng phải có chủ đích | Tự làm, **không hỏi**, nhưng phải kèm đường lùi. Migration chỉ-thêm-cột (viết sẵn câu `drop` để lùi); đổi hình dạng dữ liệu trong `repo.ts` (kèm `vaDongCu`); đổi `localKey`; đổi công thức `balancingCalc.ts`. |
| 🔴 **RED** | Không quay đầu được / nổ ở production | **Một câu xác nhận rồi ĐỢI.** `drop` / `alter … drop` trên bảng đang có số liệu; chạy `0002` hoặc `0003`; đổi RLS; mở app ra ngoài mạng nội bộ; xóa hàng loạt bản ghi nghiệp vụ; `git push --force`; đụng `.env` / key. |

Chưa rõ tier ⇒ coi là 🔴. Dữ liệu ở đây là **sổ sách thật của xưởng**, mất là không dựng lại được.

## Code đổi → doc phải update

| Đụng vào | Update doc |
|---|---|
| `features/MaterialImportScreen.tsx`, quy tắc chuyến / chốt ngày | [`30-nhap-hang.md`](docs/app-map/30-nhap-hang.md) |
| `features/SalesScreen.tsx`, phiếu bán / quy cách / hút bán | [`33-ban-hang.md`](docs/app-map/33-ban-hang.md) |
| `features/BalancingScreen.tsx`, `BalancingTable.tsx`, `lib/balancingCalc.ts` | [`31-can-doi-ky.md`](docs/app-map/31-can-doi-ky.md) |
| `features/CatalogScreen.tsx`, `FinishedGoodScreen.tsx`, `data/thanh-pham.json` | [`32-danh-muc.md`](docs/app-map/32-danh-muc.md) |
| `supabase/migrations/**` | [`03-database.md`](docs/app-map/03-database.md) (+ [`04`](docs/app-map/04-tang-du-lieu.md) nếu đổi ánh xạ) |
| `lib/repo.ts`, `db.ts`, `catalogRepo.ts`, `connectivity.ts` | [`04-tang-du-lieu.md`](docs/app-map/04-tang-du-lieu.md) |
| `App.tsx` (thêm màn / đổi nav) | [`02-pages-navigation.md`](docs/app-map/02-pages-navigation.md) |
| Thêm thư mục / đổi ranh giới import | [`01-app-structure.md`](docs/app-map/01-app-structure.md) |
| `lib/auth.ts`, `lib/username.ts`, `LoginScreen.tsx`, `UserManagementScreen.tsx`, `0006`, `0003_siet_rls.sql`, `.env.example` | [`05-bao-mat-phan-quyen.md`](docs/app-map/05-bao-mat-phan-quyen.md) |
| `index.html`, cấu hình build/deploy (`package.json`, `vite.config.ts`), env Supabase | [`ops/deploy-vercel.md`](docs/ops/deploy-vercel.md) |
| `design-system/**`, `components/ui/**`, `tokens.css` | [`src/design-system/README.md`](src/design-system/README.md) — canonical, **không** nhân bản sang app-map |

Sửa doc xong ⇒ cập nhật `last_verified:` trong frontmatter. Hook pre-commit cảnh báo khi code trong `covers:` đổi mà doc đứng yên.

## Code đổi → cổng kiểm bắt buộc

Chưa có test tự động ⇒ cổng là những cái này, **chạy thật, không suy đoán**:

| Đụng vào | Bắt buộc |
|---|---|
| Bất cứ file `.ts` / `.tsx` nào | `npm run build` + `npm run lint` |
| `lib/balancingCalc.ts` hay công thức | Mở một kỳ có số liệu, đối chiếu tay: định mức = NL÷TP; lãi/lỗ = giá trị xuất − giá thành |
| `lib/repo.ts` / hàng chờ / `AnhXaBang` | Thử **cả hai chế độ** (có `.env` và không); ghi khi ngắt mạng rồi nối lại — dòng phải lên server, reload không nuốt dòng |
| Màn Nhập hàng | Ghi 1 chuyến 2 dòng → chốt ngày → ghi bù (phải bắt lý do) → mở lại; kiểm tổng ngày + cảnh báo lệch |
| Màn Cân đối | Tạo kỳ → hút phế liệu → **xóa kỳ**: dòng phế liệu `nguon="Nhập hàng"` phải còn nguyên ở sổ nhập |
| Bất kỳ màn nghiệp vụ nào | Thu còn **360px** → giãn tới **desktop**: không cuộn ngang toàn trang, không đè chữ (bảng dài cuộn trong khung riêng). Thử thêm cỡ chữ **130%** vẫn không vỡ |
| Migration | Chạy lại file **hai lần** trên DB thật vẫn không lỗi (idempotent) |

Preview chạy qua `preview_start` với cấu hình `baseafood-dev` (`.claude/launch.json`) — **không** chạy dev server bằng Bash.

**Backlog đã biết:** thêm vitest cho `lib/balancingCalc.ts` + logic gom chuyến / chốt ngày (hàm thuần, dễ test nhất). Chưa cài package — đừng tự thêm nếu không được yêu cầu.

## App-map — đọc file nào khi nào

Index đầy đủ + bảng định tuyến theo task: [`docs/app-map/README.md`](docs/app-map/README.md).

| File | Load khi |
|---|---|
| [`01-app-structure`](docs/app-map/01-app-structure.md) | thêm file mới, không biết đặt đâu, import xuyên tầng |
| [`02-pages-navigation`](docs/app-map/02-pages-navigation.md) | thêm màn, đổi điều hướng |
| [`03-database`](docs/app-map/03-database.md) | thêm bảng/cột/migration, lỗi Postgres |
| [`04-tang-du-lieu`](docs/app-map/04-tang-du-lieu.md) | đọc/ghi dữ liệu, "số liệu biến mất / không lên máy chủ" |
| [`05-bao-mat-phan-quyen`](docs/app-map/05-bao-mat-phan-quyen.md) | 🔴 auth, RLS, key, mở app ra ngoài mạng nội bộ |
| [`30-nhap-hang`](docs/app-map/30-nhap-hang.md) | chuyến, ngày giao / ngày ghi sổ, ghi bù, chốt ngày, phế liệu ngày |
| [`33-ban-hang`](docs/app-map/33-ban-hang.md) | phiếu bán, dòng bán, quy cách, ghi bù, hút bán vào cân đối |
| [`31-can-doi-ky`](docs/app-map/31-can-doi-ky.md) | kỳ, 3 khối, công thức, bảng in A4 |
| [`32-danh-muc`](docs/app-map/32-danh-muc.md) | danh mục, 141 mã thành phẩm |
| [`34-btp-san-xuat-kho`](docs/app-map/34-btp-san-xuat-kho.ba-spec.md) · [`35-btp-ui`](docs/app-map/35-btp-ui.design-spec.md) | sản xuất BTP/WIP, **đóng gói BTP→TP** (`/packaging`), kho dự trữ, đơn/xuất, vòng đông gửi↔xả đông |
| [`trien-khai/flow-end-to-end-2-bo-phan`](docs/trien-khai/flow-end-to-end-2-bo-phan.md) | nối luồng nhập→sản xuất→kho→bán, 2 giao diện bộ phận, daily-task (họp 2026-08-22) |

Bản đồ tài liệu đầy đủ + luật "doc mới bỏ đâu": [`docs/README.md`](docs/README.md).
Ngoài app-map: [`src/design-system/README.md`](src/design-system/README.md) (UI) · [`docs/ops/deploy-vercel.md`](docs/ops/deploy-vercel.md) (deploy) · [`docs/ops/supabase-setup.md`](docs/ops/supabase-setup.md) (cutover) · [`docs/trien-khai/`](docs/trien-khai/README.md) (nghiệp vụ gốc) · [`docs/BAN-GIAO.md`](docs/BAN-GIAO.md) (bối cảnh công ty, đầu mối, câu treo với xí nghiệp).

## Trạng thái

> 📋 **Việc còn lại + go-live (cập nhật 2026-08-25):** [`docs/BAN-GIAO-tiep-theo.md`](docs/BAN-GIAO-tiep-theo.md) — đọc file này trước khi làm tiếp. Đã lên main: cụm báo cáo khép vòng + NXT thành phẩm + nhật ký thao tác (audit) + đóng gói BTP→TP + bán lẻ trừ tồn + phân quyền 2 bộ phận. Quy tắc: commit/push thẳng `main`, không tách nhánh.

> **Định hướng hiện hành — họp 2026-08-22:** số hóa TRỌN chuỗi nhập→sản xuất, tách **2 giao diện bộ phận** (nhập hàng / sản xuất) vận hành theo bước + daily-task, **cutover chạy realtime 01/09/2026** (baseline tồn 30/06, nhập báo cáo T7–T8). Cửa vào: [`trien-khai/hop-2026-08-22-so-hoa-flow-2-bo-phan.md`](docs/trien-khai/hop-2026-08-22-so-hoa-flow-2-bo-phan.md).

> **Bổ sung — họp 2026-09-02:** chốt số chạy realtime **từ tháng 9**; định hướng lớn cho vận hành: **một form nhập chuẩn + chụp ảnh phiếu tay → OCR** (giảm gõ tay ở xưởng), **định danh lô + QR** (trace nội bộ; SSCC nhà nước chừa ô trống làm sau), **giá & bình quân gia quyền theo ngày** (đang chốt PA), **QC chấm điểm + ảnh**, **khung nhân sự gắn từng khâu**. Cửa vào: [`trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md`](docs/trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md).

**Đã build (THẬT — nối dữ liệu):** nhập hàng (chuyến thật · 2 ngày + ghi bù · chốt ngày · phế liệu ngày · bộ lọc), **sản xuất BTP ngày `/wip`** (sản lượng theo ngày/xưởng/loại NL · chốt ngày SX · ghi bù), **kho dự trữ `/warehouse`** (duyệt BTP chờ→đã nhập · tồn), **đơn đặt `/orders`** (lệnh xuất FIFO từ tồn WIP), bán hàng (phiếu bán · quy cách · XK/NĐ · hút cân đối), cân đối + in A4 + chốt/chuyển kỳ, NXT + tồn NL, danh mục 5 tab, đăng nhập + vai trò `user_profiles` + màn Người dùng, bộ giao diện responsive, tầng dữ liệu Supabase↔localStorage. Điều hướng **react-router v7 (HashRouter)**, ~17 route.

**Màn DEMO (dữ liệu mẫu, chưa nối bảng — đừng coi là đã có):** Lệnh sản xuất `/production` · Kho lạnh `/cold-storage` · Báo cáo tổng `/reports` · Tổng quan `/dashboard` · Chất lượng `/quality` · Truy xuất `/traceability`.

**Backlog (cập nhật 2026-08-22):**
- ⚠️ Chạy đủ migration `0001…0026` trên DB thật; siết RLS `0021` **+ bổ sung `material_opening_stock`**; đổi mật khẩu admin (`0007` seed admin/admin) 🔴.
- **Chỗ đứt gãy chuỗi** (chi tiết [`flow §3`](docs/trien-khai/flow-end-to-end-2-bo-phan.md)): (G1) ✅ đối chiếu nhập↔SX ở `/wip` + lưu "còn dở" khi chốt SX (`production_locks.leftover_kg`, `0025`) — còn: ràng "còn dở" vào tồn/đông gửi ở Cân đối; (G2) ✅ hết chồng: `cold-storage` hút tồn thật (`tinhTon`) + nhãn nhiệt độ minh hoạ, `warehouse` canonical — còn: cảm biến thật; (G3) ✅ đóng gói BTP→TP đã build: màn `/packaging` (phiếu đóng gói BTP tiêu hao→TP ra + hao hụt, `0026`) + tồn TP suy (`tinhTonTP`); bán chọn nguồn Block thô (trừ BTP)/Đóng gói (trừ TP) — còn: tách kho TP theo nhiệt/vị trí; (G4) ✅ bán lẻ trừ tồn: dòng bán chọn **nguồn** (`KHO_BAN_LE` trừ BTP / `KHO_TP` trừ TP đóng gói), trừ suy FIFO qua `tinhTon(...,banLe)`/`tinhTonTP`, nhất quán warehouse/cold-storage/orders/packaging.
- **2 giao diện bộ phận:** ✅ route-guard + trang chủ theo vai trò (`lib/nav-access.ts`) + banner nhắc daily-task (`/imports`,`/wip`) — còn: siết RLS theo vai trò ở server.
- **Cutover 01/09 (mục tiêu tiên quyết):** baseline tồn 30/06 + nhập bù báo cáo T7–T8 → tồn đầu 01/09 đúng. Người dùng có **2 báo cáo** (tồn cuối T6 · báo cáo cuối T7/T8), **import khi có file thực tế** (cấu hình theo file, chưa build). Đọc [`ke-hoach-cutover §2b`](docs/trien-khai/ke-hoach-cutover-1-9-2026.md) trước khi làm import.
- **Bộ quy cách × chế biến:** ✅ Chiều B kiểu chế biến (`processing_type`, `0024` + combobox danh mục) — còn: chuẩn hoá quy cách (Chiều C) ([`spec`](docs/spec/bo-quy-cach-che-bien-thanh-pham.md)).
- Import file Excel + scan viết tay (**tay trước**, file/scan sau); chốt ngày bán + phiếu bán in A4; định mức NL→TP; báo cáo tháng 6 khối; ẩn/gắn nhãn màn DEMO trước khi chạy thật. Test thực địa 5 người dùng ≥45 tuổi.
- **Bổ sung họp 2026-09-02** (chi tiết [`hop-2026-09-02`](docs/trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md)) — **ĐÃ BUILD đợt 1 (2026-09-05):** (4) ✅ **mã số KH/đại lý** (tái dùng cột `code`, combobox gõ số ra tên, kiểm trùng — không migration); (3) ✅ **mã lô nội bộ + ô SSCC** ở Nhập hàng (`0035`, cột `import_shipments.lot_code`/`sscc_code`); (5) ✅ **màn QC checklist chấm điểm** `/qc` (`0036`, bảng `qc_checklists`+`qc_locks`; chốt ngày + ghi bù) — **ảnh để sau** (chưa có Storage). **CÒN CHỜ/ĐỂ SAU:** (2) 🟨 **giá bình quân gia quyền** — **CHỐT PA trước khi đụng `balancingCalc.ts`** (lô cao→SX/thấp→kho VS bình quân gia quyền ngày); (3b) QR in/quét mã lô; (1) form xưởng theo "tờ chị Trúc" + **OCR chụp phiếu** (cần Storage); (6) 🅿️ lương/BHXH/nghỉ phép, điện thoại xưởng.
- Lưu ý giữ nguyên: **đơn đặt = xuất khẩu**, phí XK phòng kế hoạch tính riêng (đã trừ trong giá báo) ⇒ cân đối KHÔNG tính phí XK.

> ⚠️ **Đừng nhầm thuật ngữ:** "bán thành phẩm" (WIP, công đoạn sản xuất, backlog trên) ≠ màn **Bán hàng** (bán thành phẩm RA cho khách, đã build — [33-ban-hang.md](docs/app-map/33-ban-hang.md)).
