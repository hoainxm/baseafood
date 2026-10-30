# CLAUDE.md — Baseafood MES

Cửa vào cho AI agent: **quy tắc + định tuyến**. Chi tiết nghiệp vụ ở [`docs/app-map/`](docs/app-map/README.md) — đọc đúng file cần dùng, đừng đọc cả codebase. **Trạng thái dự án, backlog, định hướng các buổi họp:** [`docs/BAN-GIAO-tiep-theo.md`](docs/BAN-GIAO-tiep-theo.md) (đọc trước khi làm việc lớn). Bối cảnh công ty + đầu mối: [`docs/BAN-GIAO.md`](docs/BAN-GIAO.md).

MES cho Xí nghiệp Baseafood BSF1 (Bà Rịa). **Repo độc lập với SDFactory** (chỉ là demo bán hàng — không kế thừa dữ liệu/phân quyền). Nghiệp vụ trọng tâm: nguyên liệu theo vòng **gối đầu** (mua → sơ chế → cấp đông → tồn dự trữ → xả đông dùng kỳ sau) kéo theo tồn kho; đau nhất là tồn NL cuối kỳ sai do ghi tay ⇒ kế toán chốt số sai. Ba phân xưởng **Đông · Cá · Khô**. Người dùng: tổ trưởng/thủ kho + kế toán, trên **web** mọi cỡ màn — responsive gọn, mật độ web thường (phóng to 90–130% ở Cài đặt hiển thị). Luật UI: [`src/design-system/README.md`](src/design-system/README.md).

> ⚠️ "Bán thành phẩm" (BTP/WIP, công đoạn SX) ≠ màn **Bán hàng** (bán TP cho khách). **Đơn đặt = xuất khẩu**; phí XK phòng kế hoạch tính riêng ⇒ Cân đối KHÔNG tính phí XK. Dữ liệu là **sổ sách thật của xưởng** — mất là không dựng lại được.

## Stack & lệnh

React 19 · Vite 8 · TypeScript strict · Tailwind v4 · primitive shadcn (`radix-nova`) · Supabase env-gated · oxlint · vitest. Alias `@/*` → `src/*`.

```bash
npm run dev           # :5173 — nhưng chạy preview bằng preview_start "baseafood-dev", KHÔNG bằng Bash
npm run build         # tsc -b && vite build — phải xanh
npm run lint          # oxlint
npm test              # vitest — hàm thuần, *.test.ts cạnh file
npm run naming:check  # chặn tên tiếng Việt MỚI
```

CI (`.github/workflows/ci.yml`) chạy lint + build + test mỗi push. Màn hình thử tay trên preview.

## Cấu trúc

```
src/
├── App.tsx · main.tsx   react-router v7 (HashRouter); khung features/shared/AppShell.tsx; nav cây CAY_NAV
├── types.ts             kiểu + BẤT BIẾN nghiệp vụ (laGhiBu, thanhTien)
├── data/finished-goods.json   141 mã TK 1551 — chỉ là SEED, chỉ chọn, đừng sửa
├── lib/                 tầng dữ liệu (repo · catalogRepo · db · supabase · connectivity) + hàm thuần nghiệp vụ
├── components/ui/       primitive shadcn (token-driven)
├── design-system/       tokens.css · patterns/ · kit/ · index.ts (cửa import duy nhất)
└── features/<khu>/      màn thật, mỗi khu một thư mục — route + nav: docs/app-map/02-pages-navigation.md
supabase/migrations/     0001 … 0078 — trạng thái từng file: docs/app-map/03-database.md
docs/                    README.md (bản đồ tài liệu, doc mới bỏ đâu) · app-map/ · ops/ · spec/ · trien-khai/
```

**Migration trên DB thật**: tới `0079` đã chạy hết (kiểm chỉ-đọc 2026-10-28; 0079 theo [`ops/export-v8-go-live.md`](docs/ops/export-v8-go-live.md)). `0080` (admin đặt lại mật khẩu / tạm ngưng tài khoản) · `0081` (danh mục loại chứng từ xuất khẩu) **CHƯA chạy**; `0082` (Nhập khẩu) ✅ đã chạy 2026-10-29; `0083` (danh mục NCC nhập khẩu) · `0084` (dòng hàng HĐ nhập nối mặt hàng) · `0085` (kiểm mẫu của kho theo lần nhập) · `0086` (tên gọi người dùng) · `0087` (slug quản đốc xưởng — chạy SAU 0083) · `0089` (danh mục Loại hàng) **CHƯA chạy**. ⛔ Đừng chạy lại `0073` / `0075` / `0079` / `0082` (xóa trọn ma trận quyền, chèn bản cũ). Viết migration mới ⇒ rà [`03-database`](docs/app-map/03-database.md) + số migration trên origin trước khi đặt số. ⛔ Đừng chạy `0002`, `0003`, `0023`.

Ranh giới import: [`01-app-structure.md`](docs/app-map/01-app-structure.md).

## Quy tắc code

Mỗi quy tắc một dòng; mẫu + ngoại lệ + checklist ở link. *(máy chặn)* = pre-commit hoặc test CI bắt lỗi.

1. TypeScript strict; function components.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN** qua `lib/format.ts`, class `tnum`.
3. **`src/features/**` chỉ import từ `@/design-system`.** Cấm `@/components/ui/*` trực tiếp; cấm class cỡ chữ/mã màu tay — sửa `tokens.css`. *(máy chặn)*
4. Mọi đọc/ghi dữ liệu qua hook `lib/catalogRepo.ts` → `lib/repo.ts`. **Không** gọi `localStorage` / `supabase` từ màn hình. *(máy chặn)*
5. Nhãn luôn hiện (không dùng placeholder thay nhãn); vùng chạm theo mật độ design-system (đừng ép cứng 44px; ô số `EditableGrid` ≥ 44px); nút Lưu **không bao giờ** `disabled` (thiếu ⇒ `ErrorSummary`); **mọi nút thao tác có `title`** (trừ Hủy/Đóng) — [README §4, §5b, §9](src/design-system/README.md).
6. Không xóa bản ghi nghiệp vụ lặng lẽ — dùng trạng thái; xóa qua `ConfirmDelete` + toast **Hoàn tác** (xóa dòng trong lưới/bảng: `InlineConfirmDelete`).
7. Ô dùng danh mục (đại lý, loại NL, mặt hàng, khách, kho lưu, bột tẩm…) = `Combobox` có **CẢ** `onCreate` **LẪN** bút chì sửa nhanh (`useQuickCatalogEdit`, truyền đúng rows/setRows của màn) — mọi ô, kể cả ô mới về sau — [README § Ô chọn danh mục](src/design-system/README.md#ô-chọn-danh-mục-luôn-có-thêm-mới--bút-chì-sửa-nhanh).
8. **Định danh kỹ thuật = tiếng Anh, chữ người dùng đọc = tiếng Việt có dấu**, mọi lớp (DB, enum, biến, file, route, `?tab=`, khóa localStorage/`rowMarks`, CSS). Cấm tiếng Việt không dấu cho thứ MỚI (tên cũ là nợ, không phải mẫu); cấm tên có dấu; dịch theo từ điển §2b — [`spec/quy-uoc-dat-ten.md`](docs/spec/quy-uoc-dat-ten.md). *(máy chặn)*
9. Brand `#17529c`.
10. `npx shadcn add` không chạy được trên Windows — lấy component thủ công theo README design-system.
11. 🔒 Không ghi project ref / URL / key vào bất kỳ file nào trong repo. *(máy chặn)*
12. **Mọi bảng nghiệp vụ tô màu dòng được** (bảng `row_marks`), **MỘT cách duy nhất**: tick dòng → thanh "Đã chọn N dòng" → Tô màu / In đậm / Bỏ tô (đừng thêm cách thứ hai). Bảng chuẩn bật bằng `rowMarkKey`; khóa dòng = id bản ghi; màn không gọi `useRowMarks()`; sổ dài dùng `SummaryTable fullHeight` — [README § Tô màu dòng](src/design-system/README.md#tô-màu-dòng-đã-dò-kiểu-excel).
13. **Thông báo theo mức**: trình bày (tô màu, lọc, xuất Excel/In, cài đặt) KHÔNG toast · ghi → `notify.saved` · xóa/chốt/ghi đè → xác nhận + toast Hoàn tác · lỗi luôn báo (README luật 8).
14. **Bảng tràn ngang có thanh cuộn ngang cả trên lẫn dưới**: bảng chuẩn tự có; bảng tự dựng bọc `HorizontalScroll` (cấm tự viết `overflow-x-auto`) — [README §5a](src/design-system/README.md).
15. **Demo = chế độ, không phải màn**: admin bật ⇒ cả app chạy `site_id='site-demo'`; cấm màn/bảng/số mẫu cứng để trình diễn. Bảng mới ⇒ cùng commit thêm vào `DemoBundle` + `DemoPackLoader` + checklist §5; khóa ngoại mới khai `TableMapping.refColumns`; code gọi Supabase/localStorage ngoài `repo.ts` phải qua 3 lớp của `lib/demoMode.ts`. Cấm chạy `docs/demo/seed_bt2da*.sql` lên DB thật — [`spec/che-do-demo.md`](docs/spec/che-do-demo.md). *(máy chặn khóa ngoại)*
16. **Màu nút theo chức năng**: `save` Lưu/ghi sổ · `edit` Sửa/Mở lại · `danger` mở hộp Xóa (nút xác nhận xóa: `destructive`) · `lock` Chốt · `default` hành động chính khác · `outline`/`ghost` phụ — [README §8b](src/design-system/README.md). *(máy chặn)*
17. **Mọi form ghi dữ liệu tự lưu NHÁP**: trên trang `useFormDraft`, trong hộp thoại `useDialogDraft`; mở lại nháp ⇒ `<DraftRestoredNotice>` (không toast); nháp không bao giờ tự ghi sổ; không lưu nháp mật khẩu — [`lib/formDraft.ts`](src/lib/formDraft.ts). *(máy chặn)*
18. **Mọi trang nghiệp vụ có "Hướng dẫn thao tác" + hộp "?"**, cùng commit với trang: `features/<khu>/<trang>Tour.ts` (`tourSpec`, mốc `data-tour`) + hộp trong `PAGE_GUIDES`. Khu vực có trạng thái phải giải thích trạng thái, điều kiện xong, việc tiếp; tour không ghi — [`43-guided-tour`](docs/app-map/43-guided-tour.ba-spec.md) + [README § Hướng dẫn thao tác](src/design-system/README.md). *(máy chặn)*
19. **Mọi bảng nghiệp vụ sắp được theo cột** (tăng → giảm → gốc; mỗi kiểu một cách xếp; ô trống cuối). Bảng chuẩn tự có — cột ô nhập/huy hiệu/trạng thái phải khai `sortValue` + `sortKind`; bảng tự dựng dùng `useTableSort` — [README § Sắp xếp cột](src/design-system/README.md#sắp-xếp-cột--bấm-tên-cột-mỗi-kiểu-dữ-liệu-một-cách-xếp-từ-2026-10-27). *(máy chặn)*

## Commit & deploy

Conventional Commits, scope = **tên khu tiếng Anh trùng thư mục** (`imports`, `balancing`, `design-system`, `docs`…), mô tả tiếng Việt có dấu, body giải thích **vì sao**. Kết bằng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

```
feat(imports): chuyến thật, ghi bù chờ hóa đơn, chốt ngày
```

- **Làm thẳng trên `main`**: không tách nhánh, không mở PR (trừ khi được yêu cầu), kể cả khi harness cấp nhánh `claude/...`. Chỉ commit khi người dùng yêu cầu. Nhiều phiên chung thư mục ⇒ đừng rebase tại chỗ.
- **Deploy = có mặt ở CẢ HAI repo**: nguồn thật `sdvico/baseafood`, Vercel build từ `hoainxm/baseafood` (giữ Vercel ở `hoainxm`, đừng tự đổi). Phiên web chỉ push được `sdvico` ⇒ push xong đưa người dùng lệnh mirror:
  ```bash
  git fetch origin main
  git push https://github.com/hoainxm/baseafood.git origin/main:main
  ```
  Máy local người dùng có `origin` 2 push URL ⇒ `git pull && git push` đẩy cả hai. Nhắc tải lại bản mới: [`ops/deploy-vercel.md`](docs/ops/deploy-vercel.md).

## Risk tier — xác định TRƯỚC khi làm

| Tier | Nghĩa | Cách xử |
|---|---|---|
| 🟢 GREEN | Hoàn tác được bằng `git` | Làm thẳng. Component, màn hình, doc, bộ lọc, chữ hiển thị. |
| 🟡 YELLOW | Hoàn tác được nhưng phải có chủ đích | Tự làm, không hỏi, kèm đường lùi: migration chỉ-thêm-cột (viết sẵn `drop`); đổi hình dạng dữ liệu `repo.ts` (kèm `patchLegacy`); đổi `localKey`; đổi công thức `balancingCalc.ts`. |
| 🔴 RED | Không quay đầu / nổ production | **Một câu xác nhận rồi ĐỢI.** `drop` trên bảng có số liệu; chạy `0002`/`0003`; đổi RLS; mở app ra ngoài mạng nội bộ; xóa hàng loạt bản ghi; `git push --force`; đụng `.env` / key. |

Chưa rõ tier ⇒ coi là 🔴.

## Code đổi → doc phải update

Sửa doc xong ⇒ cập nhật `last_verified:` trong frontmatter. Hook pre-commit cảnh báo khi code trong `covers:` của doc đổi mà doc đứng yên.

| Đụng vào | Update doc |
|---|---|
| `features/imports/**`, chuyến / chốt ngày | [`30-nhap-hang`](docs/app-map/30-nhap-hang.md) |
| `features/sales/**`, phiếu bán / quy cách | [`33-ban-hang`](docs/app-map/33-ban-hang.md) |
| `features/balancing/**`, `lib/balancingCalc.ts`, `lib/balancingStockLines.ts` | [`31-can-doi-ky`](docs/app-map/31-can-doi-ky.md) (+ [`36`](docs/app-map/36-so-kho-thang.md)) |
| `features/catalog/**`, `data/finished-goods.json` | [`32-danh-muc`](docs/app-map/32-danh-muc.md) |
| `features/production/**`, `packaging`, `warehouse`, `orders` | [`34`](docs/app-map/34-btp-san-xuat-kho.ba-spec.md) · [`35`](docs/app-map/35-btp-ui.design-spec.md) |
| `features/monthly-stock/**`, `lib/monthlyStock*.ts` | [`36-so-kho-thang`](docs/app-map/36-so-kho-thang.md) |
| `features/reconciliation/**`, `lib/*Reconciliation.ts`, `lib/reconciliation*.ts` | [`37-doi-soat-hddt`](docs/app-map/37-doi-soat-hddt.md) |
| Truy xuất lô: `lib/lotTraceability.ts`, `features/qr/**`, gắn lô ở SX/đóng gói/xuất, bảng `lot_*` | [`spec/qr-truy-xuat-lo`](docs/spec/qr-truy-xuat-lo.md) (+ [`34`](docs/app-map/34-btp-san-xuat-kho.ba-spec.md)) |
| `features/my-tasks/**`, `lib/myTasks.ts` | [`39-my-tasks`](docs/app-map/39-my-tasks.md) |
| `features/documents/**`, `lib/documents*.ts`, phòng ban | [`40-documents`](docs/app-map/40-documents.md) (+ [`spec/quan-ly-tai-lieu`](docs/spec/quan-ly-tai-lieu.md)) |
| `features/export-planning/**`, `lib/export*.ts`, `lib/customerProductNames.ts`, `lib/invoice*Reader.ts`, bảng `export_*`, vai trò `planner` | [`41`](docs/app-map/41-export-planning.ba-spec.md) (+ [`42`](docs/app-map/42-export-planning-ui.design-spec.md) nếu đổi giao diện) |
| `features/import-planning/**`, `lib/importPlanning*.ts`, `lib/importSample*.ts`, `lib/importFileStorage.ts`, bảng `import_contracts`/`import_receipt*`/`import_documents`/`import_files` (≠ `import_shipments` của Nhập hàng) | [`45`](docs/app-map/45-import-planning.ba-spec.md) (+ [`46`](docs/app-map/46-import-planning-ui.design-spec.md) nếu đổi giao diện) |
| Tour + hộp "?": `lib/guidedTour.ts`, `features/*/…Tour.ts`, `features/shared/guide*` — **kể cả thêm trang mới** | [`43-guided-tour`](docs/app-map/43-guided-tour.ba-spec.md) |
| `features/dashboard/**`, `lib/dataFlow.ts` | [`spec/che-do-demo` §5b](docs/spec/che-do-demo.md) |
| `lib/demoMode.ts`, `lib/demoGenerator.ts`, `features/shared/DemoMode.tsx` | [`spec/che-do-demo`](docs/spec/che-do-demo.md) |
| `supabase/migrations/**` | [`03-database`](docs/app-map/03-database.md) (+ [`04`](docs/app-map/04-tang-du-lieu.md) nếu đổi ánh xạ) |
| `lib/repo.ts`, `db.ts`, `catalogRepo.ts`, `connectivity.ts` | [`04-tang-du-lieu`](docs/app-map/04-tang-du-lieu.md) |
| Auth / quyền / RLS / `.env.example` | [`05-bao-mat-phan-quyen`](docs/app-map/05-bao-mat-phan-quyen.md) |
| `App.tsx` (thêm màn / đổi nav) | [`02-pages-navigation`](docs/app-map/02-pages-navigation.md) |
| Thêm thư mục / đổi ranh giới import | [`01-app-structure`](docs/app-map/01-app-structure.md) |
| `index.html`, `package.json`, `vite.config.ts`, env | [`ops/deploy-vercel`](docs/ops/deploy-vercel.md) |
| `design-system/**`, `components/ui/**`, `tokens.css`, tô màu dòng | [`src/design-system/README.md`](src/design-system/README.md) — canonical, không nhân bản |

## Code đổi → cổng kiểm bắt buộc

Chạy thật, không suy đoán.

| Đụng vào | Bắt buộc |
|---|---|
| Bất cứ `.ts` / `.tsx` | `npm run build` + `lint` + `test` + `naming:check` |
| Hàm thuần có `*.test.ts` cạnh nó (`balancingCalc`, `inventory`, `lotTraceability` + `.e2e`, `exportPlanning`, `demoMode`, `tableSort`…) | **Sửa test đi kèm** — AC = test |
| Trang mới / đổi khu vực, nhãn trạng thái, nút chính (QT 18) | Tour + hộp "?" + mốc; `pageTourCoverage.test.ts` xanh; đi hết tour ở 360px × 130%: không tràn, dữ liệu không đổi |
| Form ghi mới / sửa (QT 17) | Gõ dở → sang trang → quay lại còn nguyên → Lưu xong nháp biến mất |
| `lib/balancingCalc.ts` | Mở kỳ có số, đối chiếu tay: định mức = NL÷TP; lãi/lỗ = giá trị xuất − giá thành |
| `lib/repo.ts` / hàng chờ / `TableMapping` | Thử cả có `.env` lẫn không; ghi khi ngắt mạng rồi nối lại — dòng phải lên server, reload không nuốt dòng |
| Chế độ demo | Vòng kiểm spec §4b: đếm dòng `site_id <> 'site-demo'` mọi bảng trước/sau phải bằng nhau; khóa `bsf.*` dưới máy không đổi |
| Màn Nhập hàng | Ghi 1 chuyến 2 dòng → chốt ngày → ghi bù (phải bắt lý do) → mở lại; kiểm tổng ngày + cảnh báo lệch |
| Màn Cân đối | Tạo kỳ → hút phế liệu → xóa kỳ: dòng phế liệu `nguon="Nhập hàng"` phải còn ở sổ nhập |
| Đối soát HĐĐT, quy đổi ngoại tệ | Cổng thuế xuất tiền ngoại tệ TÙY BẢN (nguyên tệ hoặc đã quy VND) — KHÔNG mặc định nhân; engine tự dò (`detectForeignCurrencyMode`). Chạy trên file thật: tổng khối A ≈ tổng cột tiền thô, hóa đơn ngoại tệ khớp sổ ở số gốc |
| Bất kỳ màn nghiệp vụ | 360px → desktop: không cuộn ngang toàn trang, không đè chữ; thử cỡ chữ 130% |
| Migration | Chạy lại **hai lần** trên DB thật không lỗi; tên + định danh tiếng Anh |

## App-map — đọc file nào khi nào

Index đầy đủ + định tuyến theo task: [`docs/app-map/README.md`](docs/app-map/README.md).

| File | Load khi |
|---|---|
| [`01`](docs/app-map/01-app-structure.md) · [`02`](docs/app-map/02-pages-navigation.md) | thêm file/màn, không biết đặt đâu, đổi điều hướng |
| [`03-database`](docs/app-map/03-database.md) · [`04-tang-du-lieu`](docs/app-map/04-tang-du-lieu.md) | bảng/cột/migration, lỗi Postgres; "số liệu biến mất / không lên máy chủ" |
| [`05-bao-mat-phan-quyen`](docs/app-map/05-bao-mat-phan-quyen.md) | 🔴 auth, RLS, key, mở app ra ngoài |
| [`30-nhap-hang`](docs/app-map/30-nhap-hang.md) | chuyến, ngày giao/ghi sổ, ghi bù, chốt ngày, phế liệu |
| [`31-can-doi-ky`](docs/app-map/31-can-doi-ky.md) | kỳ, 3 khối, công thức, in A4, tồn kho NL |
| [`32-danh-muc`](docs/app-map/32-danh-muc.md) | danh mục, 141 mã thành phẩm |
| [`33-ban-hang`](docs/app-map/33-ban-hang.md) | phiếu bán, quy cách, hút bán vào cân đối |
| [`34`](docs/app-map/34-btp-san-xuat-kho.ba-spec.md) · [`35`](docs/app-map/35-btp-ui.design-spec.md) | sản xuất `/wip`, đóng gói, kho dự trữ, đơn/xuất, vòng gửi đông ↔ xả đông |
| [`36-so-kho-thang`](docs/app-map/36-so-kho-thang.md) | sổ kho theo tháng, dồn tồn, nhập Excel bảng kê |
| [`37-doi-soat-hddt`](docs/app-map/37-doi-soat-hddt.md) | đối soát HĐĐT — xuất Excel giữ nguyên định dạng file vào |
| [`39-my-tasks`](docs/app-map/39-my-tasks.md) | Việc của tôi, hạn, giao việc, chuông header |
| [`40-documents`](docs/app-map/40-documents.md) | tài liệu công ty, lần ban hành, xem theo phòng ban |
| [`41`](docs/app-map/41-export-planning.ba-spec.md) · [`42`](docs/app-map/42-export-planning-ui.design-spec.md) | Phòng Kế hoạch · Xuất khẩu |
| [`45`](docs/app-map/45-import-planning.ba-spec.md) · [`46`](docs/app-map/46-import-planning-ui.design-spec.md) | Phòng Kế hoạch · Nhập khẩu (≠ Nhập hàng) |
| [`43-guided-tour`](docs/app-map/43-guided-tour.ba-spec.md) | tour hướng dẫn + hộp "?" |
| [`spec/qr-truy-xuat-lo`](docs/spec/qr-truy-xuat-lo.md) | truy xuất lô QR, gắn lô |
| [`spec/che-do-demo`](docs/spec/che-do-demo.md) | chế độ demo, Tổng quan dòng chảy số liệu |
| [`trien-khai/flow-end-to-end-2-bo-phan`](docs/trien-khai/flow-end-to-end-2-bo-phan.md) | nối luồng nhập → sản xuất → kho → bán, 2 giao diện bộ phận |
