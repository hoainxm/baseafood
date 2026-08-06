# CLAUDE.md — Baseafood MES

Cửa vào cho AI agent. File này = quy tắc + định tuyến. **Chi tiết nghiệp vụ nằm ở [`docs/app-map/`](docs/app-map/README.md) — đọc đúng file cần dùng, đừng đọc cả codebase.**

Hệ thống MES cho Xí nghiệp Baseafood BSF1 (Bà Rịa). **Repo mới, độc lập với SDFactory** (SDFactory chỉ là demo bán hàng — không kế thừa cấu trúc dữ liệu/phân quyền).

**Nghiệp vụ trọng tâm:** quản lý nguyên liệu trong sản xuất theo vòng lặp gối đầu (mua → sơ chế → cấp đông → tồn dự trữ → xả đông tái dùng kỳ sau), kéo theo tồn kho. Đau nhất: tồn nguyên liệu cuối kỳ sai do ghi chép tay → kế toán chốt số sai. Ba phân xưởng: **Đông · Cá · Khô**.

**Người dùng:** tổ trưởng/thủ kho **45–60 tuổi**, tablet ở xưởng lạnh, tay ướt, đeo kính lão. Đây là ràng buộc thiết kế số 1 — luật UI ở [`src/design-system/README.md`](src/design-system/README.md).

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
├── App.tsx · main.tsx        điều hướng 4 màn (KHÔNG router, state trong App)
├── types.ts                  kiểu + BẤT BIẾN nghiệp vụ (laGhiBu, thanhTien)
├── data/thanh-pham.json      141 mã TK 1551 — chỉ là SEED
├── lib/                      repo · danhMuc · db · supabase · ketNoi · canDoi · format · store · utils
├── components/ui/            primitive shadcn — ĐÃ đè size cho người lớn tuổi
├── design-system/            tokens.css · patterns/ · kit/ · index.ts (cửa import duy nhất)
└── features/                 NhapNguyenLieu · BanHang · CanDoi + BangCanDoi · DanhMuc (5 tab) · ThanhPham (chỉ đọc)
supabase/migrations/          0001 … 0005
docs/app-map/                 bản đồ ngữ cảnh cho agent
docs/trien-khai/              nghiệp vụ gốc (phân tích, 28 câu hỏi đã chốt, thiết kế flow)
```

Chi tiết + ranh giới import: [`01-app-structure.md`](docs/app-map/01-app-structure.md).

## Quy tắc code

1. TypeScript strict; function components.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN** qua `lib/format.ts`, class `tnum` (tabular-nums).
3. **`src/features/**` chỉ import từ `@/design-system`.** Cấm `@/components/ui/*` trực tiếp; cấm viết class cỡ chữ/mã màu tay — sửa `tokens.css` thay vì đè cục bộ. *(hook pre-commit chặn)*
4. Mọi đọc/ghi dữ liệu qua hook trong `lib/danhMuc.ts` → `lib/repo.ts`. **Không** gọi `localStorage` hay `supabase` từ màn hình.
5. Nhãn luôn hiện (không dùng placeholder thay nhãn); vùng chạm ≥ 44px; nút Lưu **không bao giờ** `disabled` (thiếu thì bắn `ErrorSummary`).
6. Không xóa bản ghi nghiệp vụ theo kiểu lặng lẽ — dùng trạng thái; mọi xóa hiện tại qua `ConfirmDelete` + toast **Hoàn tác**.
7. Danh mục thay nhập tự do: đại lý / loại NL / mặt hàng / khách hàng chọn qua `Combobox` (tạo mới tại chỗ, lưu ngay vào danh mục).
8. Đặt tên DB: **tiếng Việt KHÔNG DẤU, snake_case, không tiền tố**. Cấm tên có dấu (NFC/NFD trông giống hệt nhưng là 2 định danh).
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
Repo này **commit thẳng vào `main`**, không tách nhánh feat. Chỉ commit khi người dùng yêu cầu.

## Risk tier — xác định TRƯỚC khi làm

| Tier | Nghĩa | Cách xử |
|---|---|---|
| 🟢 **GREEN** | Hoàn tác được bằng `git` | Làm thẳng. Sửa component, màn hình, doc, thêm bộ lọc, đổi chữ hiển thị. |
| 🟡 **YELLOW** | Hoàn tác được nhưng phải có chủ đích | Tự làm, **không hỏi**, nhưng phải kèm đường lùi. Migration chỉ-thêm-cột (viết sẵn câu `drop` để lùi); đổi hình dạng dữ liệu trong `repo.ts` (kèm `vaDongCu`); đổi `localKey`; đổi công thức `canDoi.ts`. |
| 🔴 **RED** | Không quay đầu được / nổ ở production | **Một câu xác nhận rồi ĐỢI.** `drop` / `alter … drop` trên bảng đang có số liệu; chạy `0002` hoặc `0003`; đổi RLS; mở app ra ngoài mạng nội bộ; xóa hàng loạt bản ghi nghiệp vụ; `git push --force`; đụng `.env` / key. |

Chưa rõ tier ⇒ coi là 🔴. Dữ liệu ở đây là **sổ sách thật của xưởng**, mất là không dựng lại được.

## Code đổi → doc phải update

| Đụng vào | Update doc |
|---|---|
| `features/NhapNguyenLieu.tsx`, quy tắc chuyến / chốt ngày | [`30-nhap-hang.md`](docs/app-map/30-nhap-hang.md) |
| `features/BanHang.tsx`, phiếu bán / quy cách / hút bán | [`33-ban-hang.md`](docs/app-map/33-ban-hang.md) |
| `features/CanDoi.tsx`, `BangCanDoi.tsx`, `lib/canDoi.ts` | [`31-can-doi-ky.md`](docs/app-map/31-can-doi-ky.md) |
| `features/DanhMuc.tsx`, `ThanhPham.tsx`, `data/thanh-pham.json` | [`32-danh-muc.md`](docs/app-map/32-danh-muc.md) |
| `supabase/migrations/**` | [`03-database.md`](docs/app-map/03-database.md) (+ [`04`](docs/app-map/04-tang-du-lieu.md) nếu đổi ánh xạ) |
| `lib/repo.ts`, `db.ts`, `danhMuc.ts`, `ketNoi.ts` | [`04-tang-du-lieu.md`](docs/app-map/04-tang-du-lieu.md) |
| `App.tsx` (thêm màn / đổi nav) | [`02-pages-navigation.md`](docs/app-map/02-pages-navigation.md) |
| Thêm thư mục / đổi ranh giới import | [`01-app-structure.md`](docs/app-map/01-app-structure.md) |
| `0003_siet_rls.sql`, auth, `.env.example` | [`05-bao-mat-phan-quyen.md`](docs/app-map/05-bao-mat-phan-quyen.md) |
| `design-system/**`, `components/ui/**`, `tokens.css` | [`src/design-system/README.md`](src/design-system/README.md) — canonical, **không** nhân bản sang app-map |

Sửa doc xong ⇒ cập nhật `last_verified:` trong frontmatter. Hook pre-commit cảnh báo khi code trong `covers:` đổi mà doc đứng yên.

## Code đổi → cổng kiểm bắt buộc

Chưa có test tự động ⇒ cổng là những cái này, **chạy thật, không suy đoán**:

| Đụng vào | Bắt buộc |
|---|---|
| Bất cứ file `.ts` / `.tsx` nào | `npm run build` + `npm run lint` |
| `lib/canDoi.ts` hay công thức | Mở một kỳ có số liệu, đối chiếu tay: định mức = NL÷TP; lãi/lỗ = giá trị xuất − giá thành |
| `lib/repo.ts` / hàng chờ / `AnhXaBang` | Thử **cả hai chế độ** (có `.env` và không); ghi khi ngắt mạng rồi nối lại — dòng phải lên server, reload không nuốt dòng |
| Màn Nhập hàng | Ghi 1 chuyến 2 dòng → chốt ngày → ghi bù (phải bắt lý do) → mở lại; kiểm tổng ngày + cảnh báo lệch |
| Màn Cân đối | Tạo kỳ → hút phế liệu → **xóa kỳ**: dòng phế liệu `nguon="Nhập hàng"` phải còn nguyên ở sổ nhập |
| Bất kỳ màn nghiệp vụ nào | Bật cỡ chữ **130%** + mật độ **Gọn**, thu còn **390px** — không vỡ bố cục, không đè chữ |
| Migration | Chạy lại file **hai lần** trên DB thật vẫn không lỗi (idempotent) |

Preview chạy qua `preview_start` với cấu hình `baseafood-dev` (`.claude/launch.json`) — **không** chạy dev server bằng Bash.

**Backlog đã biết:** thêm vitest cho `lib/canDoi.ts` + logic gom chuyến / chốt ngày (hàm thuần, dễ test nhất). Chưa cài package — đừng tự thêm nếu không được yêu cầu.

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

Ngoài app-map: [`src/design-system/README.md`](src/design-system/README.md) (UI) · [`docs/supabase-setup.md`](docs/supabase-setup.md) (cutover) · [`docs/trien-khai/`](docs/trien-khai/README.md) (nghiệp vụ gốc) · [`docs/BAN-GIAO.md`](docs/BAN-GIAO.md) (bối cảnh công ty, đầu mối, câu treo với xí nghiệp).

## Trạng thái

**Đã build:** nhập hàng (chuyến thật · ngày giao/ngày ghi sổ + ghi bù · chốt ngày · phế liệu cân trong ngày · bộ lọc), **bán thành phẩm ngày (phiếu bán · quy cách · 2 ngày + ghi bù · kênh XK/NĐ · hút vào cân đối)**, cân đối + in bảng, danh mục 5 tab, bộ giao diện người lớn tuổi + cài đặt hiển thị, tầng dữ liệu Supabase↔localStorage.

**Backlog:** ⚠️ chạy migration `0004` + `0005`; **chốt ngày bán + phiếu bán in A4** (bán v1 chưa có); siết RLS theo người dùng; nhập khẩu số liệu cũ lên máy chủ; định mức NL→TP; báo cáo tháng 6 khối; **vòng lặp đông gửi ↔ xả đông + tồn cuối kỳ** (vấn đề cốt lõi, chưa số hóa — cột `ban_hang.kho_nguon` để dành seam); test thực địa với 5 người dùng ≥45 tuổi.
