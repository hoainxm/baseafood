# Baseafood UI Kit — luật dùng

Bộ giao diện cho hệ thống MES Baseafood — **web responsive, mật độ thường**, chạy
khít từ điện thoại (~360px) tới desktop. (Trước 2026-08-21 tối ưu cho người lớn
tuổi/tablet với cỡ chữ/nút ép lớn — **đã bỏ**; người mắt kém vẫn có lối phóng to
90–130% ở Cài đặt hiển thị, thang rem nên bố cục giãn theo không vỡ.)

Nền: **shadcn/ui (style `radix-nova`) + Tailwind v4 + React 19**.
Tương phản màu vẫn giữ chuẩn **WCAG 2.2 AA** (token trong `tokens.css`); riêng
target-size/cỡ-chữ-tối-thiểu đã nới về mật độ web thường (đánh đổi có chủ đích).

## Ba tầng

```
src/design-system/tokens.css   ← cỡ chữ, màu, chiều cao ô. NƠI DUY NHẤT.
src/components/ui/*            ← primitive shadcn, size theo mật độ web thường
src/design-system/patterns/*   ← pattern nghiệp vụ (Field, Combobox, RecordTable…)
src/features/*                 ← màn nghiệp vụ
```

## Luật bắt buộc

1. **Màn nghiệp vụ chỉ import từ `@/design-system`.**
   Cấm `import … from "@/components/ui/button"` trong `src/features/**`.
2. **Cấm viết class cỡ chữ / mã màu tay** trong màn nghiệp vụ
   (`text-sm`, `text-slate-400`, `bg-cyan-700`…). Muốn đổi → sửa `tokens.css`.
3. **Cấm chữ IN HOA cho nội dung** (chậm đọc). Thân chữ dùng `text-sm` (15px) /
   `text-base` (17px); `text-xs` (13px) chỉ cho chip · badge · phụ chú. Thân chữ đậm
   **500** (đặt ở `body`, tokens.css) — 2026-10-15 người dùng thấy chữ "nhỏ và mảnh"
   ⇒ thang `xs/sm/base/lg` +1px và bỏ 400. Nhấn mạnh dùng `font-semibold`/`font-bold`.
4. **Vùng chạm mật độ web thường**: ô/nút mặc định ~40px (`--size-control`), nút
   icon `size-tap` 40px. Cần to hơn → đổi mật độ **Thoáng** ở Cài đặt hiển thị.
5. **Nút chỉ-icon được phép** nhưng PHẢI có `aria-label` + `title` (vd nút toàn
   cục header). Nút hành động chính trong form vẫn nên kèm chữ.
5b. **Mọi nút THAO TÁC phải có hướng dẫn khi rê chuột** — `title` nói nút đó
    **làm gì, đụng tới chức năng nào**, không phải chép lại nhãn. Xem §9.
6. **Mọi ô nhập phải bọc `Field` / `NumberField` / `Combobox` / `DateField`.**
   Nhãn luôn hiện. Placeholder không bao giờ thay nhãn. Ô bắt buộc đánh dấu
   **`*` đỏ sau nhãn**; ô không bắt buộc không ghi gì. `*` là `aria-hidden`,
   thông tin bắt buộc đi qua `aria-required` trên chính ô — `FormDialog` và
   `StepForm` dò thuộc tính này để tự hiện `RequiredLegend` ("Ô có dấu * là
   bắt buộc"), không phải bật cờ tay.
7. **Nút Lưu không bao giờ `disabled`.** Thiếu dữ liệu thì bấm ra `ErrorSummary`.
8. **Thông báo theo MỨC ĐỘ thao tác** (chốt 2026-10-06 — người dùng than toast "Đã
   bỏ in đậm 3 dòng" làm phiền). Tự xếp thao tác vào một trong bốn mức:

   | Mức | Thao tác | Phản hồi |
   |---|---|---|
   | 0 · trình bày | KHÔNG đổi số sổ sách: tô màu / in đậm dòng, tick chọn, lọc, sắp xếp, gập/mở, đổi chế độ xem, lưu cài đặt giao diện, **xuất Excel / In / tải file** (trình duyệt đã báo tải xong) | **Không toast** — thay đổi trên màn là phản hồi |
   | 1 · ghi dữ liệu | Lưu / sửa sổ sách hay danh mục: ghi chuyến, phiếu bán, mẻ SX, thêm vào danh mục, dồn kỳ, gán kho, nạp Excel vào sổ, dán khối, Hoàn tác/Làm lại số liệu | `notify.saved` ngắn; ghi HÀNG LOẠT / ghi đè thì kèm **Hoàn tác** (tham số 2) |
   | 2 · xóa / hệ trọng | Xóa bản ghi · chốt sổ · ghi đè · lệnh xuất | `ConfirmDelete` / `ConfirmAction` (8b) **trước**, rồi toast + **Hoàn tác** |
   | — · lỗi, cảnh báo, kết quả kiểm | Ghi hụt, thiếu dữ liệu, kiểm lô đúng/sai, quét tem | `notify.error` / `canhBao` / `daLuu` — LUÔN báo |

   **Vị trí + thời gian (2026-10-14):** toast THẢ XUỐNG từ **giữa mép trên** ở cả web
   lẫn điện thoại (cấu hình một chỗ ở `components/ui/sonner.tsx`, có safe-area; nơi gắn
   `<Toaster />` không truyền `position`). Báo xong thường **2 giây**; toast có nút
   (Hoàn tác / In tem) **5 giây** cho kịp bấm; lỗi / cảnh báo **4 giây**. Rê chuột lên
   thì dừng đếm. Thời gian đặt ở `patterns/notify.ts` — đừng truyền `duration` riêng.

   Xuất file mà nội dung cần giải thích (VD đối soát: "giữ nguyên định dạng gốc, chỉ
   thêm cột…") được giữ toast — vì câu đó là hướng dẫn, không phải "đã xong". Việc
   nên làm NGAY sau khi lưu (vd in tem lô vừa ghi) truyền tham số thứ ba
   `notify.saved(msg, onUndo?, { label, onClick })` — nút hiện trên toast.
   In tem nhãn: `LabelPrintSheet` nhận `tems[]` để in nhiều tem một lượt (mỗi tem một trang đúng khổ).
   Mỗi tem có `copies` (số bản in, VD mỗi block một tem — mặc định 1): xem trước hiện MỘT tem
   kèm ô "Số tem" sửa được, bản sao ẩn trên màn (`.print-tem-sao`) chỉ hiện khi in; tem in
   cuối cùng mang `.print-tem-cuoi` để không thừa trang trắng. `onIn(copies[])` trả số bản
   từng tem để màn ghi sổ in (`label_prints.copies`).
8b. **Thao tác hệ trọng KHÔNG phải xóa đi qua `ConfirmAction`** — đúng ba nhóm:
    mất việc đang làm (đăng xuất, bỏ dữ liệu vừa nạp) · ghi đè dữ liệu đang có ·
    khóa sổ hay đổi trạng thái khó quay đầu (chốt ngày, lệnh xuất).
    **Lưu thường ngày KHÔNG hỏi** — tổ trưởng ghi 30 chuyến/ngày mà lần nào cũng
    hỏi thì họ bấm Đồng ý theo phản xạ, hộp xác nhận mất tác dụng đúng lúc cần.
    Lưu thường dùng toast + Hoàn tác.
9. **Màu không bao giờ là tín hiệu duy nhất.** Luôn kèm icon hoặc chữ.
10. **Danh mục thay nhập tự do.** Đại lý / loại NL / mặt hàng / khách hàng / kho
    lưu / bột tẩm đều chọn qua `Combobox` — có **cả** tạo mới tại chỗ **lẫn** bút
    chì sửa nhanh ở MỌI ô nhập liệu dùng danh mục, không gõ tay. Luật + ngoại lệ +
    mẫu code: mục [Ô chọn danh mục](#ô-chọn-danh-mục-luôn-có-thêm-mới--bút-chì-sửa-nhanh).
11. **Mọi dropdown phải cuộn được và THẤY thanh cuộn.** Luật đặt ở tầng
    primitive, không lặp ở chỗ gọi: `PopoverContent` giới hạn
    `max-h-(--radix-popover-content-available-height)`, `CommandList` /
    `SelectContent` cuộn với `scrollbar-width: auto`. **Cấm** dùng lại class
    `no-scrollbar` của shadcn cho danh sách chọn — nó ẩn thanh cuộn nên người
    dùng tưởng danh sách đã hết.
12. **Đơn vị trong ô nhập không dùng padding cố định.** `Field` đo bề rộng chữ
    đơn vị rồi chừa đúng chỗ — `pr-14` cứng làm "26.000" đè lên "đ/USD".
    **`Field` gắn `id` (cho `<label for>`), `aria-*` và khoảng chừa đơn vị lên CHÍNH
    `<input>`.** Con trực tiếp là ô nhập (`Input`, `Textarea`) ⇒ gắn thẳng. Con là
    THẺ BỌC có ô nhập bên trong (VD `NumberField`: `<div>` + dòng xem trước biểu
    thức) ⇒ khai `nestedInput` và ô bên trong trải `useFieldInput()` lên `<input>`.
    Quên `nestedInput` thì thẻ div nhận id: nhãn không trỏ tới ô nào (trình đọc màn
    hình đọc "ô không tên", bấm nhãn không vào ô) và đơn vị lòi ra NGOÀI viền ô —
    đúng lỗi `NumberField` dính tới 2026-10-06 (test: `NumberField.test.tsx`).
13. **Mọi chữ hiển thị theo chuẩn label.** Sentence case; nhãn field = danh từ
    trần (không "Chỉ xem…", không "… dòng", không `:`); nút = động từ đứng đầu.
    Chi tiết + before→after: [`noi-dung-va-label.md`](noi-dung-va-label.md).
14. **Mọi bảng nghiệp vụ tô màu dòng được** ("đánh dấu đã dò" kiểu Excel): tick
    các dòng → thanh "Đã chọn N dòng" → Tô màu ▾ (10 sắc × 5 mức) / In đậm / Bỏ tô;
    lưu chung mọi máy. Bảng dùng chung bật bằng MỘT prop `rowMarkKey="<khoá bảng>"`; bảng
    tự dựng dùng `useRowMarkTools` + `useRowSelection` + `RowMarkToolbar`. Luật + ngoại lệ + mẫu:
    mục [Tô màu dòng](#tô-màu-dòng-đã-dò-kiểu-excel).

**Ngoại lệ luật (bản in theo mẫu giấy):** `src/features/balancing/BalancingTable.tsx`,
`src/features/imports/DailyImportInvoice.tsx` và `src/features/shared/BlankSlipPrint.tsx` (biểu mẫu
trống để xưởng ghi tay, cùng cột với hai bản in kia) cố tình dùng chữ nhỏ, chữ hoa, màu slate cứng để
khớp khổ A4. Đừng áp luật cỡ chữ / màu / sentence case vào các file đó (hook pre-commit miễn đúng ba file này), và cũng
đừng lấy chúng làm mẫu cho màn mới.

## Quy chuẩn mobile

Thiết bị đích chỉ có **HAI**: điện thoại và web desktop. **Không** thiết kế
riêng cho tablet — vùng 768–1024px ăn luật desktop.

### 1. Một mốc duy nhất

| Tầng | Bề rộng | Viết thế nào |
|---|---|---|
| Điện thoại | < 768px | **mặc định**, không tiền tố |
| Desktop | ≥ 768px | tiền tố `md:` |

**Cấm mốc thứ ba cho bố cục khung.** Không `sm:` (640) — nó tạo một tầng
"tablet" mà ta không hề thiết kế, và là nguồn gốc của phần lớn lỗi vỡ cũ.
`lg:` / `xl:` chỉ dùng để **chia thêm cột** trong lưới đã chạy tốt ở cả hai mốc
(`grid gap-4 md:grid-cols-2 lg:grid-cols-4`).

### 1b. Xoay ngang: iPhone ngang · iPad (2026-10-12)

iPhone xoay ngang rộng 812–932px nên **ăn bố cục desktop** (`md:`) nhưng chỉ cao
320–440px. iPad ngang 1024–1366px là desktop thật. Không đẻ mốc bề rộng mới; khung
tự thích nghi ở ba chỗ, màn nghiệp vụ **không phải làm gì**:

| Tình huống | Khung tự làm | Ở đâu |
|---|---|---|
| Bề rộng 768–1023px (iPhone ngang, iPad dọc) | Thanh bên **tự thu về dải icon** (w-20) — tiêu đề + bảng có thêm ~200px. Nút thu/mở vẫn theo ý người dùng | `AppShell` + `useMediaQuery(MEDIA_NARROW_SIDEBAR)` |
| Cao ≤ 500px khi nằm ngang (biến thể **`short-landscape:`**) | Header 4rem→**3rem** (token `--spacing-header`), ẩn dòng breadcrumb, đệm trang 16px, hộp thoại cao `100dvh−1rem` + đệm đầu/chân gọn, chân drawer bỏ dòng tên | `tokens.css` · `AppShell` · `dialog.tsx` · `FormDialog` |
| Tai thỏ / Dynamic Island hai bên, thanh Home ở đáy | Đẩy nội dung vào trong bằng `env(safe-area-inset-*)` (`viewport-fit=cover` ở `index.html`) | `px-safe` (khung app) · `pb-safe` (cột nội dung, thanh bên, drawer) · `pl-safe` (drawer) |

- **`short-landscape:` KHÔNG phải mốc bố cục** — chỉ để thu chrome DỌC (đệm, ẩn dòng phụ).
  Đừng dùng nó để đổi số cột hay ẩn nội dung nghiệp vụ.
- **Chiều cao theo màn: dùng `dvh`, cấm `vh`** (`max-h-[92dvh]`, không `max-h-[92vh]`).
  Safari iOS tính `vh` theo màn KHI ẨN thanh địa chỉ ⇒ hộp `92vh` cao hơn phần nhìn
  thấy lúc xoay ngang, nút Lưu ở chân lọt xuống dưới mép (đã vá 19 chỗ 2026-10-12).
- Phần tử `fixed` mới bám mép màn (thanh dính đáy, nút nổi) ⇒ cộng `env(safe-area-inset-*)`
  hoặc dùng tiện ích `*-safe` (`px-safe`, `pl-safe`, `pb-safe`), không thì nằm dưới tai thỏ/thanh Home.
- Kiểm: 844×390 và 932×430 (iPhone ngang, thêm cỡ chữ 130%) · 667×375 (iPhone SE
  ngang — bố cục điện thoại + drawer) · 820×1180 (iPad dọc) · 1024×768 / 1180×820 /
  1366×1024 (iPad ngang).

### 2. Thang chạm và icon — một nguồn

| Dùng cho | Class | Giá trị |
|---|---|---|
| Nút icon vuông | `size-tap` | 40px |
| Nút có chữ | `min-h-10` | 40px |
| Icon trong nút chạm | `size-icon` | 20px |
| Icon phụ trong dòng chữ | `size-icon-sm` | 18px |

Định nghĩa ở `tokens.css` (`--size-tap`, `--size-icon`, `--size-icon-sm`). Tất
cả đều **rem** nên phóng/thu ĐỒNG BỘ khi đổi cỡ chữ 90→130%. Viết `size-10` +
`size-5` rời rạc là cách cũ: hai chỗ, đổi một chỗ là lệch tỉ lệ.
⚠️ Tailwind chỉ sinh `size-tap` từ `--size-*`; **không có `h-tap`** — nút có chữ
dùng `min-h-10`.

### 3. Ngân sách ngang của header thuộc về TIÊU ĐỀ

- Cụm trái (menu · logo · tiêu đề) = `min-w-0 flex-1`. Cụm phải = `shrink-0`
  nhưng **phải ít nút**.
- Điện thoại chỉ giữ: `☰` · `DataSyncStatusButton` (+ `GuideButton` nếu trang có).
  Đổi ca · thông báo · giao diện · tài khoản · đăng xuất nằm ở **chân drawer**.
- Lý do: 6 nút icon ở cỡ chữ 130% = 407px > màn 390px → tiêu đề bị bóp còn 0px
  và cả trang cuộn ngang.

### 4. Điều hướng: DỌC, gom nhóm, một cây dùng chung

`AppShell` có **một** cây nav (`CayNav`) module-centric gập/mở dựng từ `KIT_NAV`
(danh sách phẳng: icon/nhãn/cờ demo) + `CAY_NAV` (cây nhóm module; con = màn
`{ ref }` hoặc deep-link danh mục `catalog?tab=…`): desktop hiện làm sidebar,
điện thoại hiện làm **drawer trượt trái**. Thêm màn mới ⇒ thêm 1 dòng vào
`KIT_NAV` **và** xếp `{ ref: "<id>" }` vào đúng nhánh trong `CAY_NAV` — quên bước
sau thì mục rơi vào nhóm "Khác". Chi tiết: [`docs/app-map/02-pages-navigation.md`](../../docs/app-map/02-pages-navigation.md).

Không dùng bottom-tab cuộn ngang: 14 mục nhét vào thanh 390px thì 7 mục nằm
ngoài màn mà người dùng không biết là còn.

### 5. Bảng: mặc định đổi sang THẺ

| Loại bảng | Cách làm |
|---|---|
| Danh sách bản ghi (mặc định) | `RecordTable` — vùng chứa đủ rộng ra bảng, hẹp ra thẻ (xem **5a**). Đánh dấu `primary` cho cột tiêu đề thẻ, `hideOnMobile` cho cột ẩn trên thẻ, **`phu`** cho cột ẩn khỏi bảng — cả hai xem qua nút **Chi tiết**. Nhiều bảng cùng cột xếp chồng (VD mỗi khách một bảng) ⇒ đặt **`width`** (%) cho từng cột để cột các bảng thẳng hàng. Hàng nút "Sắp theo" trên thẻ chỉ hiện khi > 2 dòng; desktop không có ô tìm thì không có hàng công cụ (khỏi khoảng trống thừa trên bảng) |
| Báo cáo kiểu Excel, phải đối chiếu nhiều cột số | Giữ bảng rộng + `overflow-x-auto` + **`sticky-first-col`** trên `<table>` để khoá cột đầu |
| **Nhập số hàng loạt kiểu bảng tính** (hàng = mặt hàng, cột = ngày) | `EditableGrid` — xem mục 5b |
| Bản in A4 | Ngoại lệ, giữ nguyên bố cục giấy — không responsive hoá |

**Cấm** viết `<table className="min-w-[1120px]">` tay trong màn mới rồi bọc
`overflow-x-auto` và coi là xong.

### 5a. `RecordTable` — không bắt người dùng cuộn ngang để tìm nút

Bài học 2026-10-03: tab Đại lý (10 cột) ở laptop 1024px rộng ~2.400px, nút
Sửa nằm cách mép khung 1.400px, thanh cuộn ngang ở đáy bảng cao 1.559px ⇒
người dùng phải cuộn xuống tận đáy rồi kéo ngang mới bấm được Sửa. Luật:

- **Mốc thẻ ↔ bảng theo VÙNG CHỨA, không theo màn hình.** Gốc `RecordTable` là
  `@container`; bảng hiện khi vùng chứa ≥ `@3xl` (48rem), hẹp hơn ra thẻ. Laptop có
  thanh bên, bảng trong lưới 2 cột, chữ phóng 130%… tự ra thẻ khi không đủ chỗ.
  Thanh tìm/sắp xếp cũng đổi theo `@3xl:` (đừng trộn `md:` với `@3xl:` trong
  cùng khối — dính lỗi ô tìm bị bóp còn icon).
- **Bảng tối đa ~4–5 cột dữ liệu.** Cột còn lại đánh `phu` (với `CatalogCrud`:
  `hideInTable`) ⇒ ẩn khỏi bảng, xem qua nút **Chi tiết** (mở một dòng con
  `data-detail` ngay dưới). Thẻ cũng có nút Chi tiết cho cột `hideOnMobile`
  — ẩn cho gọn nhưng không bao giờ mất đường xem.
- **Cột đầu ghim trái, cột Thao tác ghim phải** (utility `table-pin-first` /
  `table-pin-last` trong `tokens.css`, nền ô ghim khớp sọc + hover). Nếu bảng
  vẫn phải cuộn ngang thì nút Sửa/Xóa vẫn luôn trong tầm nhìn.
- **Chữ dài xuống dòng** trong khung ≤ 18rem (ô dữ liệu không phải số), tiêu đề
  cột cũng được xuống dòng — không để một ô địa chỉ kéo cả bảng rộng ra.
- Cột số (`so`) giữ một dòng, căn phải `tnum`.

Bảng **báo cáo** nhiều cột số (`SummaryTable`) vẫn giữ dạng bảng: dài thì **`fullHeight`**
(sổ kế toán dò từng dòng — trang cuộn một mạch, hàng tên cột nổi dính dưới header
trang, thanh cuộn ngang dính đáy màn hình) hoặc `stickyHeader` (khung cuộn riêng ≤70dvh —
chỉ khi bảng nằm giữa nội dung khác cần thấy cùng lúc), cần dò ngang thì
`className="sticky-first-col"`. Người dùng sổ dài **than "bọc"** với `stickyHeader` (cuộn
lồng cuộn, khó nhìn tổng quát — Sổ kho tháng 2026-10-06) ⇒ sổ dài mặc định `fullHeight`.

**Bảng tràn ngang ⇒ thanh cuộn ngang ở CẢ TRÊN lẫn DƯỚI (2026-10-06).** Thanh cuộn
thật nằm ở đáy bảng — bảng dài thì phải cuộn xuống tận đáy mới kéo ngang được. Nay
mọi bảng tràn ngang có thêm thanh cuộn TRÊN đầu bảng, chạy đồng bộ hai chiều với
thanh dưới, CHỈ hiện khi bảng thật sự tràn:

| Bảng | Cách có |
|---|---|
| `SummaryTable` (mặc định · `stickyHeader` · `fullHeight`), `RecordTable` dạng bảng, `EditableGrid` | Tự có — không phải làm gì (`fullHeight` còn giữ thanh dưới DÍNH ĐÁY màn hình) |
| Bảng TỰ DỰNG ở features | Bọc bằng **`<HorizontalScroll viewportClassName="viền/bo góc">`** thay cho `<div className="overflow-x-auto">` — cấm tự viết `overflow-x-auto` cho bảng mới |
| Pattern mới tự quản khung cuộn | `const thanh = useTopScrollbar(() => phầnTửĐangCuộn)` rồi đặt `{thanh}` ngay trên khung (`patterns/topScrollbar.tsx`) |

Thanh trên dùng utility `table-scrollbar` (luôn hiện, kể cả Mac "chỉ hiện khi cuộn").
Ngoại lệ: bảng in A4, bảng trong hộp thoại hẹp đã có khung cuộn riêng, biểu đồ.

**Bớt khoảng trắng ngang (2026-10-06, người dùng than "thừa khoảng trắng, phải kéo
ngang nhiều"):** đệm ngang ô bảng theo **mật độ** — token `--cell-pad` (Gọn 10px ·
Vừa 12px · Thoáng 16px; trước cứng 16px) ở `TableHead`/`TableCell` + tiêu đề cột
sắp xếp của `RecordTable`. `SummaryTable`: tên cột **xuống dòng** (cột số rộng theo con
số, không theo tên cột dài) và chữ "Cộng …" ở dòng tổng **trải qua các cột đầu
không có tổng** (để chung ô với cột đầu thì nó đẩy cột đó rộng gấp rưỡi). Ô nhập
trong bảng đặt bề rộng vừa đủ số (`w-24` cho số tới hàng triệu), chữ dài (tên hàng)
xuống dòng trong khung `max-w-52`, cụm nút cuối dòng dùng `size="icon-sm"`. Sổ kho
tháng: 2.081px → 1.623px (−22%). Không nhét bảng báo cáo nhiều cột vào nửa màn
(`lg:grid-cols-2`) — Tổng quan từng tràn 263% vì thế.

### 5c. Vùng cuộn không được TRÀN ra ngoài (`overscroll-contain`)

Mọi vùng cuộn riêng (thanh bên, drawer điện thoại, cột nội dung, thân dialog)
dùng utility **`scroll-nice`** (`tokens.css`), đã gắn sẵn
`overscroll-behavior: contain`. Nhờ vậy cuộn hết một vùng thì DỪNG, không
"chuyền" (scroll-chaining) sang phần tử phía sau — trước đây thiếu dòng này nên
cuộn hết thanh bên / drawer là **nội dung trang phía sau trôi theo** (vi phạm
luật "thanh bên và vùng nội dung cuộn riêng" ở `AppShell`). Đặt một chỗ ở token
nên áp cho mọi nơi; **đừng gỡ** khi chỉnh `scroll-nice`. Cần một vùng cuộn mới
không tràn ⇒ thêm class `scroll-nice`, không tự viết `overflow` rời.

**Bảng/biểu đồ cuộn NGANG dùng `scroll-nice-x`, KHÔNG dùng `scroll-nice`.** Bẫy CSS:
`overflow-x:auto` ép `overflow-y` thành `auto` → vùng thành scroll-container CẢ HAI
trục. Với `scroll-nice` (`overscroll-behavior: contain` cả 2 trục), lăn chuột DỌC khi
con trỏ ĐANG TRÊN BẢNG bị **nuốt** — trang không cuộn (đã dính ở màn Danh mục). Utility
**`scroll-nice-x`** (`tokens.css`) chỉ `overscroll-behavior-x: contain`, để `-y: auto`
nên cuộn dọc trên bảng vẫn đẩy được trang. Áp cho `RecordTable`, `SummaryTable`, `EditableGrid`
(`EditableGrid`), biểu đồ cuộn ngang. `scroll-nice` (contain 2 trục) chỉ cho vùng cuộn
DỌC (thân `FormDialog`, nav sidebar/drawer, cột nội dung).

### 5a. Bẫy: dropdown đã đóng vẫn ăn click

Radix chỉ gỡ nội dung Popover/Select khỏi DOM khi **animation thoát kết thúc**.
Với bộ `tw-animate-css` đang dùng, animation `exit` mắc kẹt ở `playState:
running` nên `animationend` không bao giờ bắn ⇒ danh sách đã đóng vẫn nằm đó,
`opacity: 1`, `pointer-events: auto`, và **chặn click** ở đúng vị trí cũ.

Triệu chứng: bấm một Combobox nhưng giá trị nhảy vào Combobox KHÁC trên cùng
màn. Trên màn nhập số liệu, đây là lỗi ghi nhầm ô mà không ai truy ra được.

Vá ở `src/index.css`: ẩn cứng `[data-slot="popover-content"][data-state="closed"]`
và `[data-slot="select-content"][data-state="closed"]`. Mất hiệu ứng thoát, đổi
lại không mất số.

⇒ **Đừng gỡ luật này khi nâng cấp tw-animate-css** mà chưa kiểm lại: mở hai
Combobox trên cùng một hộp thoại, đóng cái đầu, đếm `document.querySelectorAll(
'[cmdk-root]')` — phải bằng 1.

### 5b. `EditableGrid` — lưới nhập kiểu bảng tính

- Prop `rowHeaderLabel` đổi tên cột đầu (cột tên dòng, dính trái) — mặc định "Mặt hàng"; VD khối NL ở Cân đối dùng "Loại hàng" theo bảng giấy kế toán.

Dùng khi người dùng phải gõ **nhiều ô số cùng lúc** và đang có sẵn thói quen làm
việc đó trên Excel (màn Cân đối kỳ). Mở hộp thoại cho từng ô thì Excel vẫn nhanh
hơn và người dùng sẽ quay về Excel — đó là lý do primitive này tồn tại.

Cho sẵn:

- Enter / mũi tên xuống → ô dưới; Tab → ô phải, hết hàng thì xuống dòng.
- Ô khoá tự bị bỏ qua khi di chuyển, không làm kẹt con trỏ; khai `lockReason` để
  người dùng biết vì sao không gõ được (đừng để ô câm).
- **Dán khối từ Excel** (TSV). Hiểu cả `(2.000)` = −2.000 kiểu kế toán. Ô rỗng
  trong khối dán **giữ nguyên** số cũ, không xoá về 0.
- Cột dính bên trái, `min-w-40` trên máy nhỏ → `sm:min-w-52` (thu từ 44/60 ngày
  2026-10-06 cho bớt kéo ngang); ô số `min-w-20`, đệm ngang 8px.
- Ô cao ≥ 44px, `tabular-nums`, số âm tô `text-destructive`.

Luật khi dùng:

- Ô nhập **ghi theo từng phím** (như `NumberField`), không đợi rời ô — cột tổng
  và khối kết quả phải nhúc nhích theo con số đang gõ.
- **Cột tổng phải là `kind: "computed"`** (ô tính, không gõ). Cho gõ tay vào cột tổng
  là cách chắc chắn nhất để bảng lệch — bảng cân đối giấy của xí nghiệp đã lệch
  1.109 kg đúng vì lý do đó.
- Khoá ô (`id`) chỉ dùng khi ô **thật sự không có nghĩa**, không dùng để
  "bảo vệ" số: ô khoá đọc ra là ô hỏng. Số đến từ sổ khác thì cho gõ rồi ghi
  ngược về sổ đó.
- Khai `onPasteBlock` nếu màn có ghi ra ngoài (state cha, sổ khác). Không khai thì
  lưới rải từng ô qua `onCellCommit`, và **nhiều `setState` liên tiếp trên cùng mảng
  sẽ ghi đè nhau** — chỉ ô cuối sống sót.
- Ô cần điều khiển (chọn khách, nút…): `GridColumn.oRieng`, KHÔNG phải `renderValue`.
  Combobox trong ô dùng `hideLabel` — tiêu đề cột đã nói ô đó là gì.
- **Bảng nhập tự dựng (không qua `EditableGrid`):** `Field` / `NumberField` cũng nhận
  `hideLabel` (giấu nhãn nhìn thấy, giữ `aria-label`) — dùng khi bảng có **hàng tiêu
  đề cột**. Ngoài bảng thì KHÔNG dùng, nhãn phải luôn hiện. Bảng phải cuộn ngang
  trong khung riêng — bọc `HorizontalScroll` (có sẵn thanh cuộn trên + dưới), không
  để cuộn ngang cả trang. VD: bảng
  ghi thành phẩm ngày (`WipProductionScreen` › `BangDongSX`).
- **Cấm `sr-only` cho nhãn nằm trong hộp cuộn.** `sr-only` là `position:absolute`;
  gặp tổ tiên không định vị thì rơi ra toạ độ trang, đội chiều cao trang lên và
  sinh thêm một thanh cuộn dọc + mảng trắng dưới cùng. Dùng `aria-label`.
- Dòng tiêu đề nhóm: `GridRow.groupTitle`. Dòng tổng cuối bảng tự dựng ở màn
  gọi qua `footer` (số cột phải khớp, kể cả khi nhóm cột đang thu).
- **Phần phụ dưới ô — `GridColumn.phuO(row)`**: nội dung nhỏ ngay dưới giá trị ô (ô gõ
  được hay ô khoá đều có), VD nút "🚚 3 chuyến" mở chi tiết nguồn của ô (Cân đối).
  Nút trong `phuO` để `tabIndex={-1}` — phím Enter/↑↓ của lưới không nhảy vào.
- **Dòng con chỉ đọc — `GridRow.kind = "con"`**: thụt vào, nền xám, mọi ô khoá, không
  ô tick tô màu (tô ở dòng cha). Màn tự chèn dòng con ngay dưới dòng cha khi người
  dùng mở (VD tách theo đại lý). Có dòng con thì `onPasteBlock` phải tính dòng theo
  THỨ TỰ TRÊN MÀN (kể cả dòng con) và bỏ qua ô dòng con — kẻo dán trượt số.
- **Lưới GỌN — prop `compact`** (2026-10-19): cho bảng phải đứng CẠNH bảng khác trên một
  màn (bảng chính Cân đối A–L). Cột tên không đòi bề rộng theo chữ dài nhất
  (`contain: inline-size`, tối thiểu `rowHeaderMinWidth` px, `px-2`), ô số co về `minWidth`
  của cột (ô `<input>` không đòi bề rộng mặc định ~20 ký tự). MỌI cột (kể cả cột tên) ĐẶT bề
  rộng = mức tối thiểu ⇒ tên cột dài tự xuống dòng, và khi khung chứa giãn thì phần dư chia
  THEO TỶ LỆ cho mọi cột (như kéo rộng bảng Excel) — đừng chặn cứng cột tên (ô chọn bị cắt)
  cũng đừng để cột tên ăn hết phần dư (cột số sát tối thiểu, tên cột gãy chữ). Ô điều khiển
  trong ô (Combobox) bọc `w-full min-w-* [contain:inline-size]` để giãn theo cột. Khối chứa lưới gọn co theo bảng: tiêu đề / nút đặt
  `w-0 min-w-full` để không kéo khối rộng hơn bảng. Lưới thường đừng bật (cột tên hẹp làm
  tên dài gãy dòng).
- **Kéo giãn cột kiểu Excel — prop `columnWidthsKey`** (2026-10-19, `patterns/columnResize.tsx`):
  truyền khoá ỔN ĐỊNH tiếng Anh của bảng ⇒ mỗi tên cột có mép kéo ở cạnh phải: KÉO để đổi bề
  rộng (thả tay mới lưu), NHẤP ĐÚP để vừa nội dung dài nhất, nút ↺ ở góc cột tên trả mọi cột
  về mặc định. Nhớ theo MÁY (`lib/devicePrefs`, khoá `bsf.grid-column-widths.v1.<khoá bảng>`)
  — cài đặt trình bày, KHÔNG toast, không ghi sổ. Bắt đầu kéo ⇒ chốt bề rộng ĐANG THẤY của mọi
  cột (kéo một cột không làm cột khác nhảy); bảng đã chỉnh thì co theo tổng bề rộng (`w-max`).
  Cột cùng `GridColumn.widthKey` dùng chung bề rộng (VD mọi cột ngày `"day"` — kỳ khác ngày vẫn
  giữ). Đang bật ở bốn lưới Cân đối. Đổi bố cục bảng làm bề rộng đã lưu lỗi thời ⇒ tăng
  phiên bản khoá (đang `v2`, 2026-10-20). Cột không nên phình: `GridColumn.fixedWidth`.
- **Một lưới, hai bảng:** cần bảng tổng + bảng chia ngày của CÙNG dòng thì dựng hai
  `EditableGrid` từ cùng `rows` / `onCellCommit`, chia `columns` (cùng `rowMarkKey` ⇒ màu dòng
  hiện cả hai). Bảng đặt ở chỗ khác của màn ⇒ `createPortal` vào chỗ màn đưa (VD Cân đối).
- **Nút thao tác của dòng — `GridRow.actions`** (2026-10-20): đặt cuối ô tên dòng, VD 🗑
  `InlineConfirmDelete` — XOÁ NGAY TẠI DÒNG đang nhìn thấy: ô hỏi nhỏ cạnh nút, KHÔNG lớp
  phủ / không làm mờ màn, nêu đích danh dòng, nút "Không" đứng trước (Esc = không xoá),
  màn gọi vẫn bắn toast Hoàn tác. Thay cho hộp liệt kê mọi dòng để xoá (người dùng không nhớ
  dòng nào là dòng nào). Xoá bản ghi ở nơi khác (danh mục, phiếu) vẫn `ConfirmDelete`.
- **Hàng phụ GÕ ĐƯỢC — `GridRow.kind = "detail"`** (2026-10-19): thụt vào như dòng con,
  không ô tick tô màu, nhưng ô vẫn gõ được (khoá từng ô bằng `isLocked` của cột). VD hàng
  "Giá gửi (đ/kg)" theo ngày dưới dòng Gửi đông ở Cân đối (id `<id dòng>::price`; màn tự
  định tuyến ghi / dán theo hậu tố id). Dùng khi một dòng cần thêm MỘT dãy số cùng cột
  (giá theo ngày…) mà không phải dòng nghiệp vụ riêng.

### 5d. Ô số: nhập biểu thức + điều hướng phím kiểu Excel

**Biểu thức số học kiểu Excel — áp cho MỌI ô số.** Một lõi chung, ba lớp:

| Lớp | File | Vai trò |
|---|---|---|
| Hàm thuần | `patterns/numberExpression.ts` (+ `numberExpression.test.ts`) | `parseVnNumber` · `formatNumber` · `isExpression` · `evaluateExpression` · `parseNumberOrExpression` |
| Hành vi ô | `patterns/useNumberInput.ts` | ghi theo phím, Esc trả số cũ, rời ô định dạng lại, trả `preview` |
| Ô dựng sẵn | `NumberField` (có nhãn) · ô lưới `EditableGrid` · `ONhapSo` (ô trần, không nhãn) | cùng gọi `useNumberInput` + `ExpressionPreview` |

- Gõ được: `250+300`, `=250+300` (dấu `=` đầu như Excel), `(3+4)*2`, `12x5` / `12×5`
  (`x` = nhân), `100:4` / `100÷4` (`:` = chia), `1000*5%` (`%` hậu tố = chia 100).
  Số theo vi-VN như cũ (`.` phân nghìn, `,` thập phân) nên `-5`, `1.234,5` vẫn là số
  thường. Tự tách token, **không `eval`**; chia 0 / ngoặc lệch ⇒ không tính.
- Đang gõ biểu thức: nhãn nổi **"= 550 kg"** ngay dưới ô (portal ra `body`, nên không
  bị khung cuộn bảng / hộp thoại cắt). Biểu thức **dở** ("250+") ⇒ **chưa ghi**, giữ số
  cũ — không ghi tạm 0/null làm mất số thật. **Esc** trả về số lúc vào ô.
- **Luật:** ô số mới **phải** là `NumberField` (có nhãn) hoặc `ONhapSo` (ô trần trong
  bảng / thanh cấu hình) — **cấm** `<Input inputMode="decimal">` / `type="number"` tự
  parse. Màn KHÔNG tự parse số. Ngoại lệ: ô **năm** (số nguyên không phân nghìn).

**Điều hướng ↑/↓/Enter theo cột** cho **bảng số TỰ DỰNG** (không qua `EditableGrid`,
VD `WipProductionScreen › BangDongSX`): bọc bảng trong `[data-grid-nav]`, mỗi
`NumberField` (hoặc ô trần `ONhapSo`) khai `navCol="<tên cột>"` (hàm chung `patterns/numberColumnNav.ts`). ↑/↓/Enter nhảy dọc trong cùng cột (theo
thứ tự DOM, tự bỏ ô ẩn của dòng chưa mở); Tab để trình duyệt lo đi ngang. `EditableGrid`
đã có sẵn nav đầy đủ (§ 5b) — `navCol` chỉ dành cho bảng dựng tay.

### 6. Các bẫy làm vỡ trang ở cỡ chữ 130%

1. **Ô lưới không co**: con của `grid`/`flex` mặc định `min-width:auto` = rộng
   theo chữ dài nhất. Thêm `min-w-0` (hoặc `[&>*]:min-w-0` trên lưới).
   `Field` · `Combobox` · `DateField` · `ChoiceGroup` đã có sẵn `min-w-0`.
2. **Cụm nút không xuống dòng**: mọi hàng nút phải có `flex-wrap`.
3. **Biểu đồ / SVG có bề rộng tối thiểu**: bọc `overflow-x-auto` và đặt
   `min-w` = đúng `W` của `viewBox`. Thu nhỏ SVG là thu nhỏ luôn chữ trục
   (680/900 → nhãn 16px còn 12px).
4. **`min-w-0` + `flex-1` trong hàng `flex-wrap` = không bao giờ xuống dòng** (bẫy
   ngược của mục 1): ô bị ép còn vài chục px, chữ bên trong tràn ra khỏi trang (đã
   gặp ở ô "Ngày bất kỳ trong kỳ" 6 màn báo cáo). Ô cần chỗ ⇒ đặt sàn co theo khung:
   `min-w-[min(12rem,100%)]` — đủ chỗ thì chung hàng, thiếu thì tự xuống dòng.
5. **Lưới theo breakpoint MÀN HÌNH** (`lg:grid-cols-5`) mà nội dung đã trừ thanh
   bên ⇒ thẻ bé tí, nhãn bị cắt. Lưới thẻ dùng
   `grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))]` (theo chỗ trống thật);
   lưới một cột chứa khối rộng dùng `grid-cols-[minmax(0,1fr)]`.
6. **Nút / nhãn chữ dài** (`whitespace-nowrap` mặc định): nhãn tên nhóm, tháng dài
   ("Dồn sang Tháng 10/2026", "Thêm dòng vào <nhóm>") ⇒ thêm
   `h-auto min-h-9 whitespace-normal text-left`; `Tag` dài ⇒ tách 2 nhãn ngắn.
7. **Kiểm đúng thứ tự người dùng**: đặt 130% TRƯỚC rồi mới mở màn (đổi cỡ chữ sau
   khi trang đã dựng có lúc đo ra "không tràn" dù thật ra có).

### 7. Checklist màn mới PHẢI qua

- [ ] 360px: `document.documentElement.scrollWidth === clientWidth` — trang
      **không** cuộn ngang (chỉ vùng bảng/biểu đồ được cuộn, có chủ đích)
- [ ] Thử thêm cỡ chữ **130%** (lối phóng to): vẫn không cuộn ngang, không đè chữ
- [ ] Xoay ngang **844×390** (iPhone) + **1024×768** (iPad): không cuộn ngang, hộp thoại thấy nút ở chân; chiều cao theo màn dùng `dvh`, không `vh` (§1b)
- [ ] Nút / ô tick chạm được thoải mái (~40px `size-tap`; ô tick nhỏ bọc `<label>`)
- [ ] Thân chữ ≥ **`text-sm`** (15px); `text-xs` (13px) CHỈ cho chip/badge/phụ chú
      (đo bằng TOKEN, không bằng px tuyệt đối). Không `fontSize` cứng < 12 trong SVG
- [ ] Bảng dài đã ra thẻ trên điện thoại (hoặc có `sticky-first-col` nếu là báo cáo Excel)
- [ ] Bảng tràn ngang có thanh cuộn TRÊN + DƯỚI (pattern dùng chung tự có; bảng tự dựng bọc `HorizontalScroll`)
- [ ] Chỉ dùng `md:` cho bố cục khung; không thêm `sm:`
- [ ] Màn mới đã vào `KIT_NAV` **và** `CAY_NAV`
- [ ] **Mọi nút thao tác có `title` giải thích nút làm gì** (§9) — nút chỉ-icon
      bắt buộc, kèm `aria-label`
- [ ] **Mọi bảng nghiệp vụ đã bật tô màu dòng** (`rowMarks`) hoặc nằm trong bảng ngoại
      lệ — mục [Tô màu dòng](#tô-màu-dòng-đã-dò-kiểu-excel)

## 8. Nhãn theo CHỨC NĂNG — `Tag` (từ 2026-09-30)

Mọi chip/nhãn nhỏ trong màn nghiệp vụ dùng `Tag`, **chọn theo Ý NGHĨA, không chọn
màu**. Trước đây `Badge` chỉ có xám/xanh thương hiệu/đỏ nên "Đã chốt" và "Nháp" trông
y hệt, cảnh báo "Chưa có giá" trông như nhãn thường. `Badge` giờ chỉ còn dùng cho
chip đếm/điều khiển của primitive; màn nghiệp vụ **không** dùng `Badge` làm nhãn.

| `variant` | Nghĩa | Màu | Ví dụ |
|---|---|---|---|
| `done` | đã xong · đạt · khớp · chính thức · đủ | xanh lá | Đã chốt · Đã nhập kho · Đủ · Khớp · Đạt |
| `pending` | đang chờ · chưa xong · nháp (viền **đứt**) | hổ phách | Chờ nhập kho · Chưa chốt · Đang gom · Nháp |
| `warning` | lưu ý, KHÔNG phải lỗi | hổ phách đặc | Ghi bù · Giá = kỳ trước · Đang thuộc kỳ khác |
| `error` | cần xử lý · sai | đỏ | Tồn âm · Lệch · Khác loại · Chưa có giá · Chưa vào sổ |
| `source` | nguồn dữ liệu | xanh thông tin (`--info`) | Sổ nhập · Sổ sản xuất · Nhập tay · Excel · Mẫu |
| `location` | vị trí / kho ngoài | xanh thương hiệu nhạt | Gửi: Kho Hồng Phú |
| `category` | phân loại nghiệp vụ, sắc theo `tone` | sắc nhạt | Kênh · nhóm NL · xưởng · kho · vai trò · ca |
| `muted` | phụ chú · đếm · DEMO | xám | Lô … · SL mặt hàng · DEMO |

- Sắc phân loại lấy từ hàm, **không tự chọn**: `channelTone` (Xuất khẩu tím · Nội địa
  ngọc) · `toneForMaterialGroup` (Thủy sản biển · Xả đông băng · Bột phụ gia cát · Giảm hồng) ·
  `toneForWorkshop` (Đông biển · Cá ngọc · Khô cam) · `toneByName` (phân loại mở — kho, nhóm
  TP, vai trò, ca, dây chuyền: băm tên ⇒ cùng tên cùng màu ở mọi màn).
- Luôn có chữ + chấm (hoặc `icon`, VD `Lock` cho "Đã chốt"): màu không bao giờ là tín
  hiệu duy nhất. `className` chỉ để căn bố cục, không đè màu/cỡ.
- Token: `--info*`, `--destructive-surface/-line`, `--success-line`, `--warning-line`,
  `--tone-<sắc>` / `-surface` / `-line` trong `tokens.css`; chữ `-ink`/nền đều ≥ 4,5:1.
- Trạng thái (đối soát, QC, hóa đơn…) dùng `Tag` (`done`/`warning`/`error`). (`StatusChip`
  — chip trạng thái máy/dây chuyền của màn DEMO Lệnh sản xuất — đã gỡ cùng màn 2026-10-12.)
- Nhãn phụ dưới tên dòng trong `EditableGrid` (`phu`) được đặt `Tag` (VD nguồn "sổ sản
  xuất", "mẫu · chưa có số", lưu ý "giá = kỳ trước").

### Hàng nhãn cao bằng nhau (2026-10-14)

Hàng nhãn của `Field` (và `NumberField`), `DateField`, `ChoiceGroup`, `Combobox` đều
`min-h-9` (bằng nút ⓘ) ⇒ các ô khác loại đứng cùng một hàng lưới có nhãn và ô nhập
thẳng hàng. Nút × bỏ chọn của `Combobox` (`data-slot="combobox-clear"`) cao theo
`--h-control` như ô nhập. Đừng thêm `min-h` khác hay tự kê `pt-*` để "chỉnh tay" nhãn.

## 8b. Màu NÚT theo chức năng — `Button variant` (từ 2026-10-14)

Người dùng xưởng phải nhìn màu là biết nút làm gì (yêu cầu 2026-10-14: "xóa, sửa,
lưu… tách riêng màu"). Giống `Tag`: **chọn variant theo Ý NGHĨA của nút, không chọn
theo màu**, không tự viết class màu lên nút.

| `variant` | Nghĩa | Màu | Ví dụ |
|---|---|---|---|
| `save` | ghi số liệu vào sổ / danh mục | xanh lá đặc (`--success`) | Lưu chuyến · Lưu · Lưu thay đổi · Lưu vào sổ rồi chốt · Ghi phế liệu |
| `edit` | mở ra để sửa / đổi / mở khóa sửa | viền + chữ xanh thông tin (`--info`) | Sửa · Sửa chuyến · bút chì Đổi loại · Đổi loại hàng loạt · Mở lại ngày |
| `danger` | NÚT KÍCH HOẠT xóa / bỏ | viền + chữ đỏ (`--destructive`) | Xóa (mặc định của `ConfirmDelete`) · Bỏ dòng |
| `destructive` | nút XÁC NHẬN xóa trong hộp hỏi | đỏ đặc | "Xóa chuyến" trong `ConfirmDelete` |
| `lock` | chốt / khóa sổ | hổ phách đặc (`--warning`) | Chốt ngày |
| `default` | hành động chính khác (thêm, chuyển bước, điền) | xanh thương hiệu | Thêm phế liệu · Điền vào phiếu |
| `outline` / `ghost` / `link` | phụ, trung tính | xám | Hủy · Báo cáo ngày · In · Xuất Excel |

- Chữ + icon vẫn bắt buộc (`<Save />`, `<Pencil />`, `<Trash2 />`, `<Lock />`): màu không
  bao giờ là tín hiệu duy nhất. Tương phản chữ/nền ≥ 4,5:1 với token hiện có.
- Đã áp cho MỌI màn (2026-10-14) + `ConfirmDelete` (trigger `danger`) + `CatalogCrud`
  (Sửa `edit`, Lưu `save`) + trang `/kit`. Nút mới PHẢI dùng đúng variant ngay.
- **Hàng tên cột NỔI ở MỌI bảng (2026-10-16):** `patterns/floatingTableHead.tsx` (`useFloatingTableHead`) — bảng trong khung cuộn ngang thì `sticky` thường không bám trang, nên đặt một hộp cao 0 dính `top-header` NGOÀI khung cuộn, khi hàng tên cột thật trôi khỏi tầm nhìn mà bảng còn trên màn thì hiện BẢN SAO (đúng bề rộng từng ô, cuộn ngang theo bảng, `inert`). Đã gắn sẵn: `HorizontalScroll` (mọi bảng tự dựng), `RecordTable`, `EditableGrid`; `SummaryTable` mặc định bật chế độ `fullHeight` (hàng nổi bấm được) trừ khi dùng `stickyHeader`. ⚠ Tổ tiên có `overflow: hidden/auto` chặn sticky ⇒ dùng **`overflow-clip`** để cắt góc bo (Card primitive đã đổi). Ngoại lệ: bản in A4, bảng trong hộp thoại nhỏ.
- **`EditableGrid` cột giãn (2026-10-16):** `GridColumn.fill` ⇒ cột đó ăn phần bề ngang còn lại, các cột khác co vừa nội dung (`width:1%` + `minWidth`), cột tên chặn 18rem; `align: "left"` cho cột chữ (VD Ghi chú).
- **Khóa cũ sau đổi tên (2026-10-15):** dòng phụ ô chọn là `subLabel`, dòng phụ thẻ thống kê `subtext`, số thẳng cột `numeric`. Khóa cũ `phu` / `so` trong object `.map(...)` TypeScript không bắt ⇒ chữ phụ mất lặng lẽ; `patterns/legacyPropKeySource.test.ts` quét features + design-system + lib, gặp lại là CI đỏ.
- **Cổng máy:** `patterns/buttonIntentSource.test.ts` quét mọi `<Button>` /
  `<AlertDialogAction>` ở `features/**` + `design-system/**`: icon `Pencil`/`LockOpen` ⇒
  `edit`, `Trash2` ⇒ `danger`/`destructive`, `Lock` ⇒ `lock`, `Save` ⇒ `save`; không có icon
  thì xét chữ đầu nhãn (Lưu ⇒ `save`, Chốt ⇒ `lock`, Xóa ⇒ `danger`, Sửa / Mở lại ngày-kỳ ⇒
  `edit`). Variant động (`{cond ? "edit" : "lock"}`) hợp lệ khi có mặt variant đúng nghĩa.
- Nút ghi dữ liệu mà nhãn không bắt đầu bằng "Lưu" (Tạo kỳ, Nạp N dòng, Xác nhận nhập
  kho, Thêm ‹…› ở chân hộp thoại) test không dò được — tự đặt `save`. Nút MỞ form
  (Ghi phiếu bán, Thêm phế liệu) là `default`, không phải `save`.

## Bảng chọn component

| Tình huống | Dùng |
|---|---|
| Ô chữ | `Field` + `Input` |
| Ô số (kg, tiền, %) | `NumberField` |
| Chọn 1 trong ≤ 6 | `ChoiceGroup` (nút to) |
| Chọn 1 trong danh mục dài / cần tạo mới | `Combobox` |
| Chọn trong danh mục **và cho sửa bản ghi danh mục ngay tại chỗ** | `Combobox` + `onEditItem` (bút chì trên từng mục; máy có chuột: hiện khi rê/trỏ phím, cảm ứng: luôn hiện) + `canEdit` (chỉ mục có trong danh mục). Màn nghiệp vụ KHÔNG tự viết hộp: dùng `useQuickCatalogEdit` (`features/catalog/QuickCatalogEdit.tsx`) — hộp là `CatalogEditDialog`, chung với `CatalogCrud`. Không gắn ở ô LỌC. **Bắt buộc ở mọi ô nhập liệu dùng danh mục, đi cùng `onCreate`** — xem mục "Ô chọn danh mục" ngay dưới bảng. |
| Chọn ngày | `DateField` |
| Chọn khoảng ngày | `DateRangeField` (hai ô riêng Từ / Đến) |
| Danh sách bản ghi | `RecordTable` — truyền `getSortValue` cho cột để bấm tiêu đề sắp xếp, truyền `getSearchText` để hiện ô tìm |
| Nhập nhiều ô số một lúc (lưới ngày) | `EditableGrid` — cột tổng luôn `kind: "computed"` |
| Danh mục có Thêm/Sửa/Xóa/Tìm | `CatalogCrud` — nhận `loading` để hiện `TableSkeleton` trong lúc tải, vẫn giữ header + nút Thêm. Hộp Thêm/Sửa (`CatalogEditDialog`) xếp trường thành **lưới** 2 cột (sm) / 3 cột (lg); danh mục nhiều trường ngắn khai `CatalogField.group` (tiêu đề nhóm) ⇒ 4 cột ở lg; trường chữ dài khai `span: "wide"` (2 ô) / `"full"` (trọn hàng) — đừng để form một cột dài phải cuộn (2026-10-15) |
| Xóa bất kỳ thứ gì | `ConfirmDelete` · xoá DÒNG đang hiện trong lưới/bảng ⇒ `InlineConfirmDelete` (ô hỏi nhỏ tại dòng, không lớp phủ) |
| Thao tác hệ trọng không phải xóa (đăng xuất · chốt sổ · ghi đè · lệnh xuất) | `ConfirmAction` — nêu đích danh việc sắp làm + hệ quả, nút an toàn đứng trước |
| Form > 5 ô, nhập không thường xuyên | `StepForm` |
| Form > 5 ô, nhập lặp nhiều lần/ngày | `Dialog` + nhóm ô, phần phụ gập lại |
| Báo lỗi cả form | `ErrorSummary` (đầu form, có link nhảy tới ô) |
| Cho biết đang làm cho ngày/xưởng nào | `ContextBar` |
| Danh sách rỗng | `EmptyState` (phải nói việc tiếp theo) |
| Câu diễn giải dài cạnh nhãn | `InfoTip` (nút ⓘ + popover). `DateField` **và** `Combobox` có sẵn prop `info` — dùng thay `hint` khi câu dài khiến hai ô cùng hàng lệch chiều cao. Nhãn tiêu đề vẫn luôn hiện. |
| Bảng tổng hợp cho trang Báo cáo | `SummaryTable` — prop **`stickyHeader`** (bảng dài): khung cuộn riêng cao ≤70dvh, hàng tên cột **dính đỉnh** + dòng tổng dính đáy (utility `table-sticky-head` trong `tokens.css`; sticky theo trang không chạy xuyên khung cuộn ngang nên phải cuộn trong khung). Cột số căn phải `tnum`, hàng TỔNG CỘNG ở chân tự cộng theo `total` từng cột. Component cha lo gom nhóm; `SummaryTable` chỉ hiển thị. Prop **`selection?: TableSelection<T>`** bật thêm cột ô tick ở đầu bảng (`{selectedKeys: Set<khóa>, doi(k), toggleAll(keys, bat), getRowLabel?(row)}`): ô tick ở header = chọn/bỏ mọi dòng ĐANG HIỆN của bảng đó, dòng đã tick tô `bg-primary/5`. `SummaryTable` **không giữ state** — màn hình giữ `Set` khóa và tự cộng tổng / in / xử theo lô (khuôn phần mềm kế toán kho). Nhiều bảng chia nhóm dùng CHUNG một `TableSelection` để tick xuyên nhóm. Prop **`addRow?: ReactNode`**: dòng THÊM MỚI cuối thân bảng (trải hết bề ngang, trước hàng tổng) — chỗ gõ tên hàng để ghi dòng mới ngay trên bảng (VD Sổ kho tháng); có `addRow` thì bảng rỗng vẫn hiện. Prop **`fullHeight`** (thay `stickyHeader` cho sổ dài): KHÔNG khung cuộn riêng — bảng trải hết, trang cuộn một mạch; hàng tên cột **nổi** (vẽ lại, đo bề rộng cột thật, đồng bộ cuộn ngang) dính dưới header trang (`top-header` = cùng token `--spacing-header` với `h-header` của `AppShell`) khi cuộn qua bảng; bảng rộng ⇒ thanh cuộn ngang **dính đáy màn hình** (`table-scrollbar`), thanh cuộn thật của bảng ẩn đi (`table-expanded`). Prop **`rowMarks`**: bật ô tick + thanh "Đã chọn N dòng" để tô màu / in đậm nhiều dòng — xem mục Tô màu dòng. |
| **Dialog/form thông tin hay thao tác** | `FormDialog` — khung CHUẨN: đầu cố định (icon + tiêu đề + mô tả) · thân cuộn `scroll-nice` · chân cố định chứa nút. `width`: sm/vua/rong/xl. Điều khiển bằng `open`/`onOpenChange` hoặc `trigger`. Nút đóng tiện dụng: `CloseButton`. |
| **`Dialog` trần** (không qua `FormDialog`) | Khung gốc (`components/ui/dialog.tsx`, 2026-09-29) tự **giới hạn cao `100dvh−2rem` + cuộn trong khung**, cột lưới `minmax(0,1fr)` (không nới theo phần tử rộng nhất ⇒ hết tràn ngang ở 360px), và `DialogFooter` **dính đáy** (`sticky`) khi thân cuộn. ⇒ **Nút xác nhận LUÔN đặt trong `DialogFooter`**, không để giữa thân dưới danh sách dài (từng bị cuộn mất ở Đồng bộ danh mục). Nhãn nút dài ⇒ `h-auto min-h-11 whitespace-normal` cho xuống dòng. |
| Các con số bối cảnh/tổng | `StatCardGrid` (lưới thẻ KPI: nhãn nhỏ + số TO + icon màu) — sinh động hơn nhồi một dòng. **Bỏ trống `columns` ⇒ tự suy theo số thẻ**: ≤4 một hàng · 5 thẻ một hàng ở xl (lg 3+2; từ lg thẻ hẹp: icon lên trên, số nhỏ một bậc) · 6 thẻ 3×2 · nhiều hơn 4 cột. Điện thoại: cột tối thiểu 9.5rem (chữ 130% tự về 1 cột), thẻ cuối lẻ trải hết hàng, **icon lên trên nhãn** (dưới md — để icon bên cạnh thì nhãn chỉ còn ~80 px, bẻ 3 dòng). Nhiều thẻ trên một màn: hoặc thẻ nào cũng có `subtext`, hoặc không thẻ nào — thẻ lệch khuôn trông cao thấp. Truyền `columns` chỉ khi cần ép. **`tone` (CategoryTone) theo LOẠI SỐ** ⇒ thẻ tô nền nhạt + viền trái đậm + số cùng màu (VD Tổng quan: nhập = `blue` · sản xuất = `purple` · kho = `teal` · đóng gói = `cyan` · bán = `green` · định mức = `sand`); dùng cùng sắc cho biểu đồ trên màn đó. Số mang nghĩa tốt/xấu (lãi/lỗ, việc tồn) vẫn dùng `color`, đừng truyền `tone`. `ContextBar` chỉ dùng cho thanh dính "đang xem ngày/xưởng nào" trong màn nhập liệu. |
| Biểu đồ trong Báo cáo | `BarChart` — thanh NGANG + đường trung bình nét đứt, một màu thương hiệu, thuần HTML + token (ăn theo cỡ chữ). Mặc định sắp giảm dần theo giá trị; chuỗi theo NGÀY thì bật `preserveOrder` để giữ trình tự thời gian (giá trị hiện cuối mỗi thanh, không cuộn ngang). Ưu tiên hơn `VerticalBarChart` (cột đứng) khi nhiều mục — cột đứng dễ tràn ngang phải cuộn. Mỗi mục có thể kèm `detail` (ReactNode) → hiện thẻ TÓM TẮT khi di chuột (thẻ tự xổ xuống/lên tùy vị trí để không trồi khỏi vùng chart; rộng tới **~26rem** ở desktop, hẹp lại **16rem** ở điện thoại, nội dung **xuống dòng — không cắt chữ**, để tóm tắt đủ thông tin trong ngày mà không tràn ngang mobile); thanh có animation mọc từ 0 + hiệu ứng hover. Prop `averageValue` truyền sẵn mốc vạch TB (VD bình quân **gia quyền** của định mức) thay trung bình cộng các thanh — có nó thì nhãn TB không làm tròn. KHÔNG thêm thư viện chart. |
| "X kg đi đâu" (chia phần một tổng) | `ProportionBar` — MỘT thanh 100% chia khúc theo phần + danh sách phần (chấm màu · tên · kg · % to), mỗi phần bấm được (`onSelect`). Kiểu đọc "cứ 100 kg nguyên liệu thì ra 42 kg bán thành phẩm…" — **thay sơ đồ sankey** (người dùng thử 2026-10-12 thấy sankey khó hiểu; đã gỡ cùng `d3-sankey`). Màu theo `tone` (bảng tone của `Tag`), khúc < 7% không ghi % trong thanh. Thuần HTML, không cuộn ngang. |
| Chuỗi khâu nối tiếp | `PipelineStages` — mỗi khâu một ô (kg qua · kg chờ · số việc thiếu), mũi tên ghi % chuyển tiếp. Xếp theo `@container`: vùng ≥ `@3xl` ngang, hẹp hơn dọc. Ô bấm được (`onSelect`) có `title` + `press-feedback`. `tone` từng khâu ⇒ viền trái + số cùng màu thẻ số cùng loại. |
| Số theo ngày (cùng đơn vị) | `TimeSeriesChart` — chuỗi `columns` (cột cạnh nhau) và `duong` (đường, `vung` tô mờ) trên MỘT trục. `color` nhận 4 màu nghĩa hoặc một `CategoryTone` (khớp thẻ cùng loại). Rê/chạm ngày ⇒ vạch dọc + thẻ số. Trục kg ghi theo tấn khi ≥ 1.000. Nhãn ngày tự thưa (≥ 44px/nhãn). Vẽ theo bề rộng khung đo thật; nhiều ngày thì khung cuộn ngang. Đừng truyền ngày tương lai (đường phẳng vô nghĩa). |
| **Khung lưới chứa biểu đồ** | Khối bọc biểu đồ / bảng rộng là lưới một cột ⇒ **bắt buộc `grid-cols-[minmax(0,1fr)]`** (cả khối ngoài lẫn khối trong). Thiếu nó, cột `auto` nở theo bề rộng tối thiểu của SVG (đo ra trang 1.086px ở 360px). |
| **Khung tải danh sách** (chờ dữ liệu về) | `TableSkeleton` — vài dòng nhấp nháy; hiện khi `status==="loading" && rows.length===0` (đọc phần tử thứ 3 của `useTable`), tránh chớp "Chưa có dữ liệu". |
| **Đang xử lý cả màn / tác vụ dài** | `ProcessingState` (chấm suy nghĩ + chữ). Fallback `Suspense` khi mở màn lazy cũng dùng cái này (thay "Đang tải…"). |
| **Chấm "đang suy nghĩ" nội tuyến** | `ThinkingDots` — ba chấm nhấp nháy so le, bám màu chữ hiện tại. |
| **Khối xương tuỳ biến** | `Skeleton` (primitive) — `<Skeleton className="h-4 w-32" />`. Ghép nên khung tải riêng khi `TableSkeleton` không hợp. |

## Phân quyền trên màn — ẨN nút, nhãn "Chỉ xem" (từ 2026-10-15)

Màn hỏi quyền bằng `useCan("<tài nguyên>")` (`features/shared/PermissionProvider.tsx`, spec [`role-permissions`](../../docs/spec/role-permissions.md) §5 lớp 2). Design-system **không biết quyền** — chỉ nhận cờ.

| Tình huống | Cách làm |
|---|---|
| Không có quyền làm việc của nút (Thêm, Sửa, Xóa, Chốt, Mở lại, Duyệt, Nạp, Xuất) | **Ẩn hẳn nút**, không làm mờ. Luật "nút Lưu không bao giờ `disabled`" giữ nguyên: không quyền thì không có nút. |
| Có Xem, không có Thêm lẫn Sửa | `ReadOnlyBadge` cạnh tiêu đề màn ("Chỉ xem", có `title` giải thích); ẩn form nhập / nút Lưu; `EditableGrid` đổi cột `kind: "input"` → `"computed"`. |
| Không có `view-price` | Ẩn cột / ô giá, thành tiền, lãi lỗ (ẩn cả cột, không để ô trống). |
| `CatalogCrud` | Prop `canCreate` / `canUpdate` / `canDelete` (mặc định `true`): ẩn "Thêm …", "Sửa", "Xóa"; không cả ba ⇒ `ReadOnlyBadge`. `CatalogScreen` truyền theo quyền từng tab `catalog.*`. |
| Ô chọn danh mục ở màn nghiệp vụ | `useQuickCatalogEdit` tự ẩn bút chì khi không có quyền Sửa tab đó (`canEdit` trả false) và trả `canCreate` ⇒ màn truyền `onCreate={editor.canCreate ? addX : undefined}`. |
| Tô màu dòng, lọc, chọn, cài đặt giao diện | Không gate. |

Lưới an toàn: màn nào sót, lượt ghi vẫn bị chốt ở `useTable.write` (`lib/writePermissions.ts`) và báo lỗi — nhưng đừng dựa vào đó thay cho ẩn nút.

## Ô chọn danh mục: luôn có Thêm mới + Bút chì sửa nhanh

(Chốt 2026-10-06.) **Mọi `Combobox` ĐỂ NHẬP LIỆU mà nguồn là một DANH MỤC có
CRUD ở `/catalog`** — mặt hàng · khách hàng · đại lý · loại NL · kho lưu trữ ·
bột tẩm — phải có **đủ hai thứ**, kể cả ô thêm về sau:

1. **Thêm mới tại chỗ — `onCreate`.** Lưu NGAY vào danh mục qua setter của màn
   (đúng instance `useTable` đang mở), báo `notify.saved("Đã thêm … vào danh mục")`,
   trả về value của mục đúng kiểu value của ô (id hay tên). **Trùng tên không phân
   hoa thường ⇒ trả lại bản có sẵn**, không đẻ bản trùng. `Combobox` tự ẩn nút
   "Thêm mới" khi NHÃN trùng chữ gõ, nhưng nhãn dạng `"12 · tên"` hay danh sách
   đã lọc (theo loài, gộp họ) thì không nhận ra ⇒ handler phải tự dò.
2. **Bút chì sửa nhanh — `useQuickCatalogEdit`.** `onEditItem={editor.openEdit}` +
   `editLabel={editor.editLabel}` + `canEdit={editor.canEdit}`, và render `{editor.dialog}` đúng
   một lần trong màn. Hộp là `CatalogEditDialog` dùng chung bộ trường + luật kiểm tra
   với màn Danh mục — màn nghiệp vụ KHÔNG tự viết hộp.
3. *(Tuỳ chọn, 2026-10-15)* **Thùng rác dọn danh mục — `onDeleteItem` + `canDelete` +
   `deleteLabel`.** Combobox chỉ đóng danh sách rồi gọi hàm; màn gọi TỰ kiểm "mục đã
   nằm trong sổ nào chưa" và mở `ConfirmDelete` (prop `open`/`onOpenChange` — mở theo
   lệnh, không cần nút kích hoạt) + toast **Hoàn tác**. Mẫu: `useQuickProductDelete`
   (`features/catalog/QuickProductDelete.tsx`, kiểm bằng `lib/productUsage.ts`) — đang
   bật ở ô Thành phẩm của `/wip` để dọn 263 mục; chỉ hiện khi có quyền Xóa tab đó.

**Không có giao diện tối — `dark:` bị khoá (2026-10-15).** tokens.css khai
`@custom-variant dark (&:where(.dark, .dark *))`: `dark:` chỉ ăn khi có lớp `.dark`
(app không dùng). Mặc định Tailwind v4 đọc chế độ tối của HỆ ĐIỀU HÀNH ⇒ máy để tối
thì primitive shadcn (`dark:bg-input/30` ở nút outline) làm ô chọn / ô ngày / nút phụ
ngả xám như bị khoá. Muốn làm giao diện tối thì gắn lớp `.dark` lên `<html>`.

Ô chọn nằm TRONG bảng đọc như bảng kê (VD cột Vị trí ở Sổ kho tháng) dùng prop
**`inline`**: nút không viền/không nền, khung chỉ hiện khi rê chuột / đang chọn.

**Ngoại lệ — không gắn:**

| Ô | Vì sao |
|---|---|
| Ô LỌC / bộ lọc xem sổ ("Tất cả …", `hideRequiredMark`) | Không nhập liệu |
| Danh sách cố định không phải danh mục: Phân xưởng, Loài (`CATEGORIES`), Kiểu chế biến, Thị trường, Loại kho, kho hệ thống (`BSF1_WAREHOUSES`, `KHO_TP_NAMES`, `KHO_XUONG`), vai trò, kỳ báo cáo, loại phế liệu gợi ý (`SCRAP_SUGGESTIONS`), nhóm hàng sổ kho | Không có bảng CRUD. Ô nào đang có `onCreate={(t) => t}` (gõ tự do) thì **để nguyên** |
| 141 mã kế toán TK 1551 (`finished-goods.json`) | Chỉ CHỌN — không thêm, không sửa |
| Màn DEMO (`WorkOrderScreen`, `QualityScreen`, `ReportsScreen`) | Dữ liệu mẫu |
| Ô chọn NẰM TRONG form danh mục (`CatalogCrud` / `CatalogEditDialog`) | Chỉ `onCreate` — không bút chì (tránh hộp lồng hộp). Hộp sửa nhanh ở màn nghiệp vụ không nắm instance danh mục con của màn ⇒ ô đó chỉ cho chọn (VD "Loại nguyên liệu" trong hộp sửa nhanh mặt hàng) |
| Ô chọn giá trị ĐANG CÓ trong sổ để tìm (VD "Đang ghi là loại" ở Đổi loại hàng loạt) | Không ghi danh mục |

**Mẫu:**

```tsx
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";

const [customers, setCustomers] = useCustomers(); // ĐÚNG instance của màn
const customerEditor = useQuickCatalogEdit("customer", customers, setCustomers); // value là TÊN ⇒ { matchBy: "name" }
const addCustomer = (name: string) => {
  const existing = customers.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) return existing.id; // trùng tên ⇒ dùng lại bản có sẵn
  const k: Customer = { id: newId(), code: "", name: name.trim(), market: "" };
  setCustomers([...customers, k]);
  notify.saved(`Đã thêm khách hàng "${k.name}" vào danh mục`);
  return k.id;
};
// <Combobox … options={customerOptions} onCreate={addCustomer}
//   onEditItem={customerEditor.openEdit} editLabel={customerEditor.editLabel} canEdit={customerEditor.canEdit} />
// {customerEditor.dialog}
// Loại danh mục ("customer", "supplier"…) + tùy chọn `theo` vẫn là chuỗi tiếng Việt cũ — chờ đợt đổi literal (spec đặt tên §5).
```

**Checklist khi thêm một ô chọn mới:**

- [ ] Nguồn có phải danh mục ở `/catalog`? Không ⇒ xem bảng ngoại lệ, dừng.
- [ ] `rows` / `setRows` là của hook `catalogRepo` **CỦA MÀN NÀY**. Component con
      KHÔNG tự gọi `useCustomers()`… rồi ghi (mỗi `useTable` giữ state riêng — màn
      không thấy, lần ghi kế tiếp của màn đè mất) ⇒ nhận qua prop (VD
      `onThemLoaiNL`, `suaLoai={suaNL}` ở `BulkTypeChange`).
- [ ] `matchBy: "name"` khi value của ô là TÊN (đại lý, loại NL, kho lưu, bột tẩm —
      và khách hàng ở `/wip`); mặc định là id.
- [ ] Options có mục ngoài danh mục (tên lấy từ sổ, kho hệ thống, mục gộp họ) ⇒
      bắt buộc `canEdit` để mục đó không có bút chì.
- [ ] `onCreate` dò trùng tên không phân hoa thường + `notify.saved`.
- [ ] Hook gọi trước mọi `return` sớm; `{patch.dialog}` render một lần (thường cuối JSX).
- [ ] Danh mục nối theo TÊN ⇒ hộp tự khoá ô tên (`noiTheoTen`). Mặt hàng nối id
      nên đổi được tên — màn nào giữ TÊN mặt hàng trong state thì dời theo qua
      `onDaLuu(moi, cu)` (VD ô "Ánh xạ … tới" ở Sổ kho tháng).

## Tô màu dòng "đã dò" kiểu Excel

(Chốt 2026-10-06 với kế toán.) **Mọi bảng nghiệp vụ** — kể cả bảng thêm về sau —
phải cho tô màu + in đậm dòng để đánh dấu đã dò. Dấu **lưu chung vào CSDL** (bảng
`row_marks`, mig 0055): mọi máy, mọi người cùng thấy. Chỉ là dấu trình bày —
**không đụng số sổ sách**.

**MỘT cách dùng duy nhất, giống Excel** (bản bút tô / nút 🪣 từng dòng đã bỏ vì
người dùng thấy rối):

1. **Tick ô vuông** đầu các dòng. **Shift+tick** = chọn cả khoảng; ô tick ở tiêu đề
   = chọn hết.
2. Hiện **thanh "Đã chọn N dòng"** (dính đáy màn khi bảng dài): **Tô màu ▾** (bảng
   màu 10 sắc × 5 mức nhạt → đậm, ô màu không chữ như Excel) · **In đậm** (mọi dòng
   đã đậm ⇒ nút thành **Bỏ in đậm**) · **Bỏ tô** · **Bỏ chọn**.
3. Bấm nút nào là áp cho **tất cả dòng đang tick** — **không toast** (mức 0 của luật
   8: dấu trình bày, màu đổi ngay là phản hồi; muốn gỡ thì **Bỏ tô**). Đổi màu giữ in
   đậm riêng từng dòng và ngược lại.

Nền mức đậm vẫn giữ chữ đen (như Excel): dòng nền "tối" (độ chói < 0,68) tự đổi
chữ phụ / chữ màu về màu chữ thường.

**Cách chạy (một lần cho cả app):**

| Tầng | Thứ | Vai trò |
|---|---|---|
| design-system | `patterns/rowMarkSource.ts` | hợp đồng `RowMarkSource` + `RowMarkContext` + `useRowMarkTools(maBang)` + `useRowSelection()` (tick + Shift) + bảng màu `MARK_COLORS`/`MARK_SHADES`/`MARK_COLOR_GRID` — KHÔNG gọi repo |
| design-system | `patterns/RowMarkToolbar.tsx` | `RowMarkToolbar` (thanh "Đã chọn N dòng") · `RowMarkActions` (cụm Tô màu ▾ / In đậm / Bỏ tô — cho màn tự đặt vào thanh "Đã chọn" riêng) |
| design-system | `SummaryTable` · `RecordTable` · `EditableGrid` · `CatalogCrud` | prop `rowMarkKey="<khoá bảng>"` ⇒ tự có ô tick + thanh + nền dòng |
| tokens | `--to-<sắc>-<1..5>` (+ `-line`) · khối `[data-marked]`/`[data-mark-dark]`/`[data-bold]` | nền phủ cả ô ghim/ô dính, vạch đậm mép trái, chữ đổi bản đậm trên nền đậm |
| app | `features/shared/RowMarkProvider.tsx` (gắn MỘT lần ở `ShellLayout`) | nối `useRowMarks()` → `row_marks`; hàm thuần `lib/rowMarks.ts` (+ test) |

`SummaryTable` mà màn đã truyền `selection` riêng (VD Sổ kho tháng, Nhập xuất tồn kho — có
thanh "Đã chọn" với cộng tổng / in / gán kho) thì bảng KHÔNG tự hiện thanh; màn đặt
`<RowMarkActions to={useRowMarkTools("<khoá>")} id={idsDangTick} />` vào thanh của nó.
**Thanh "Đã chọn" riêng của màn phải đặt SAU bảng và dính đáy từ desktop**
(`md:sticky md:bottom-8 md:z-30 md:shadow-lg`, nền đặc `bg-card`) — đặt trên đầu
trang thì tick dòng cuối bảng phải lăn ngược lên mới bấm được (người dùng than
2026-10-06). Điện thoại KHÔNG dính khi thanh nhiều nút + số tổng (cao tới ~3/4
màn ở 360px chữ 130%) — nằm ngay dưới bảng là đủ gần. `RowMarkToolbar` mặc định của
bảng chỉ 4 nút nên dính đáy cả trên điện thoại (~1/5 màn).

**Luật:**

1. **Khoá bảng (`rowMarks`) ổn định, kebab-case, đặt một lần** — đổi khoá là mất
   dấu cũ. Một khoá cho một bảng; hai chế độ xem CÙNG bản ghi (VD bảng xem + lưới
   Ghi của `/nxt-warehouse`) dùng chung khoá để dấu không mất khi đổi chế độ.
2. **Khoá dòng = id BẢN GHI** (`getKey` / `GridRow.id`), **cấm chỉ số dòng** —
   sắp xếp / lọc / thêm dòng sẽ làm dấu nhảy sang dòng khác.
3. **Bảng dòng GỘP theo kỳ/bộ lọc** (báo cáo: đại lý × loại, khách × kênh, mặt
   hàng × quy cách…) — khoá dòng là khoá nhóm, lặp lại ở mọi kỳ ⇒ **ghép kỳ + bộ
   lọc vào khoá bảng**: `` rowMarkKey={`bao-cao-nhap|${tu}|${den}|${xuong}`} ``. Không
   ghép thì "đã dò tháng 9" hiện luôn ở tháng 10.
4. Màn hình **không** tự viết class/mã màu dòng, **không** gọi `useRowMarks()`
   (mỗi `useTable` giữ state riêng — nhiều instance đè mất dấu nhau). Chỉ provider gọi.
5. Không có provider (trang `/kit`, test) ⇒ bảng chạy như cũ, không hiện ô tick tô màu.

**Ngoại lệ — không tô:**

| Bảng | Vì sao |
|---|---|
| Bản in A4 / phiếu in (`BalancingTable`, `DailyImportInvoice`, `PrintSheet`, `PhieuTrongIn`, khối in của báo cáo) | Giữ bố cục giấy; dấu dò là chuyện trên màn |
| Màn DEMO (`WorkOrderScreen`/`WorkOrderTable`, `QualityScreen`, `ReportsScreen`, `TraceabilityScreen`, `ColdStorageScreen`) | Dữ liệu mẫu |
| Bảng NHÁP đang gõ, chưa lưu (`BangDongSX` ở `/wip`) | Dòng chưa có id bản ghi; lưu xong dòng hiện ở sổ có tô |
| Bảng trong hộp thoại / xem trước (chọn dòng nhập vào kỳ, đổi loại hàng loạt, đối chiếu lệch, xem trước nạp Excel) | Bảng tạm để chọn, không phải sổ để dò |
| Bảng tóm tắt nhỏ trong thẻ (bột theo loại, báo cáo TP gom theo người ghi ở `/wip`) · tồn theo kho ở Tổng quan | Vài dòng gộp, số đổi liên tục — dấu "đã dò" không còn nghĩa |
| Bảng KẾT QUẢ đối soát HĐĐT (`/reconciliation`) | Khoá dòng `<sheet>#<dòng>` của file đang mở — đổi file là trùng khoá. Đợt sau: khoá theo id bản đối soát đã lưu. Danh sách "Bản đã lưu" thì có tô |

**Mẫu:**

```tsx
// Bảng dùng chung — MỘT prop (tự có ô tick + thanh "Đã chọn N dòng"):
<RecordTable columns={cot} rows={rows} getKey={(r) => r.id} toMau="ban-hang" />
<SummaryTable rows={rows} cot={cot} getKey={(r) => r.id} fullHeight toMau="ton-kho-thang" />
<EditableGrid cot={cot} hang={hang} onGhiO={ghiO} moTa="…" toMau="can-doi-nl" />
// Báo cáo dòng gộp — ghép kỳ + bộ lọc:
<SummaryTable rows={dong} cot={cot} getKey={(r) => `${r.customerName}|||${r.channel}`}
  toMau={`bao-cao-ban|${tu}|${den}`} />

// Màn có thanh "Đã chọn" riêng (SummaryTable nhận `selection` của màn):
const to = useRowMarkTools("ton-kho-thang"); // CÙNG khoá với bảng
<RowMarkActions to={to} khoa={rowsChon.map((r) => r.id)} />

// Bảng TỰ DỰNG (<Table> tay):
const to = useRowMarkTools(`bao-cao-sx-ngay|${tu}|${den}|${xuong}`);
const chonDong = useRowSelection();
<TableRow key={k} {...to.thuocTinh(k)}>
  <TableCell>
    <input type="checkbox" className="size-5" checked={chonDong.daChon.has(k)}
      onChange={() => {}} onClick={(e) => chonDong.doi(k, e.shiftKey, khoaDangHien)}
      aria-label={`Chọn dòng ${ten}`} />
    …
// sau bảng:
<RowMarkToolbar to={to} khoa={khoaDangHien.filter((k) => chonDong.daChon.has(k))}
  onBoChon={chonDong.boChon} />
```

**Checklist khi thêm một bảng mới:**

- [ ] Bảng có trong bảng ngoại lệ? Có ⇒ dừng. Không ⇒ phải tô được.
- [ ] Đặt khoá bảng mới (kebab-case, chưa trùng khoá nào — `grep -rn 'rowMarkKey=' src/features`).
- [ ] `getKey` / `GridRow.id` là id bản ghi, không phải chỉ số dòng.
- [ ] Dòng là dòng GỘP theo kỳ/bộ lọc ⇒ ghép kỳ + bộ lọc vào khoá bảng.
- [ ] Màn đã có thanh "Đã chọn" riêng ⇒ thêm `RowMarkActions` vào đó, đặt thanh SAU bảng + `md:sticky md:bottom-8`.
- [ ] Bảng tự dựng ⇒ ô tick `useRowSelection` + `{...to.getRowProps(k)}` lên `<tr>` + `RowMarkToolbar`.
- [ ] Thử: tick 3 dòng (Shift) → In đậm → Tô màu → Bỏ tô (không toast nào hiện); sắp xếp/lọc lại ⇒ dấu vẫn đúng dòng; 360px + 130% không tràn.

**Sửa/thêm màu:** mỗi mức = trộn sắc gốc với trắng (tỉ lệ 0,16 · 0,32 · 0,52 ·
0,76 · 1 của mức đậm nhất; mức đậm nhất chặn ở độ chói ≥ 0,25 để chữ đen ≥ 4,5:1).
Sửa token `--to-<sắc>-<mức>` / `--to-<sắc>-line` ở `tokens.css` + `MARK_COLORS`
(`rowMarkSource.ts`) + `SAC_TO_LIB` (`lib/rowMarks.ts`) + `DARK_MARK_COLORS` (ô độ chói < 0,68).
**Test `patterns/rowMarkSource.test.ts` canh hết:** đủ token, hai danh sách sắc khớp,
chữ thường ≥ 4,5:1 trên mọi ô, `DARK_MARK_COLORS` đúng, chữ phụ/chữ đỏ ≥ 4,5:1 trên ô sáng.
Không cần migration — cột `color` không có CHECK; mã lạ bị bỏ qua. 4 mã của bản
đầu (`vang`, `xanh-la`, `xanh-duong`, `do`) vẫn đọc được (ra mức 2). Dấu theo Ô
(`column_key`) từ bản bút tô cũ vẫn nằm trong DB nhưng không còn hiện / không còn
cách tạo.

## Animation & Loading → "Thinking"

Mục tiêu: tinh tế, không phô — giao diện *mượt* chứ không *ồn ào*.

**Luật animation (bắt buộc):**
- Thời lượng ngắn: **≤ 200–300ms**. Chỉ micro-interaction (fade/slide nhẹ, hover,
  toast, chuyển tab, chuyển màn). Tránh parallax / zoom lớn / confetti.
- Chỉ animate **`transform` / `opacity`** (chạy GPU). Tránh animate layout
  (width/height/top…) gây reflow, giật máy yếu.
- **Tôn trọng `prefers-reduced-motion`**: `tokens.css` có khối `@media` tắt gần
  hết animation/transition. Khi thêm hiệu ứng mới KHÔNG cần tự viết lại — nó bao
  toàn cục — nhưng đừng dựa vào animation để TRUYỀN THÔNG TIN (phải có trạng thái
  tĩnh tương đương).
- Chuyển màn: `AppShell` bọc `children` trong `<div key={active}
  className="enter-fade …">` → đổi menu là fade nhẹ (chỉ opacity). Nội dung tab
  (`TabsContent`) cũng `enter-fade`.
- **Khối LỚN chứa con `fixed`/`sticky` (nội dung màn, nội dung tab) chỉ được fade
  opacity** (`enter-fade`), cấm `animate-in`/`enter-up`: keyframe có `transform` biến
  khối thành gốc toạ độ của con `fixed` ⇒ thanh cuộn dính đáy, hàng tên cột nổi
  chạy sai chỗ trong lúc (hoặc sau khi, nếu fill-mode `both`) animation chạy.

**Token & utility chuyển động — MỘT nguồn, gọi theo tên (đừng viết transition rời ở feature):**

| Thời lượng / easing | Token (`tokens.css`) | Class dùng | Giá trị |
|---|---|---|---|
| Nhanh (hover · tab · route fade) | `--duration-fast` | `duration-fast` | 150ms |
| Chuẩn (dialog · dòng mới · banner · bước) | `--duration-base` | `duration-base` | 200ms |
| Easing ra dịu | `--ease-soft` | `ease-soft` | `cubic-bezier(.22,1,.36,1)` |

`duration-fast`/`duration-base` là `@utility` tự khai (Tailwind v4 không có namespace
`--duration-*`): đặt cả `--tw-duration` (cho `animate-in`/`animate-out` của
tw-animate-css đọc) LẪN `transition-duration` (cho `transition-*` thường) → dùng
được cho cả hai. **Đừng gõ `duration-150`/`duration-200` rời** ở màn mới — gọi token.

Utility "hiện vào" cho phần tử MỚI xuất hiện (chỉ `transform`/`opacity`, `both`
fill-mode nên reduced-motion tắt vẫn dừng ở trạng thái HIỆN RÕ):

| Utility | Hiệu ứng | Áp ở đâu (design-system, features chỉ dùng lại) |
|---|---|---|
| `enter-up` | mờ→rõ + `translateY(6px)→0` | `RecordTable` (dòng/thẻ mới, keyed nên chỉ dòng MỚI animate) · `DailyTaskReminder` · nhóm nav mở (`AppShell`) |
| `enter-side` | mờ→rõ + `translateX(10px)→0` | nội dung mỗi bước `StepForm` (keyed theo `i`) |
| `enter-down` | mờ→rõ + `translateY(-8px)→0` | `UpdateBanner` (băng nhắc tải lại) |
| `enter-fade` | chỉ mờ→rõ, 150ms, không fill-mode | nội dung màn khi đổi route (`AppShell`) · `TabsContent` |

**Phản hồi khi chạm — `press-feedback`** (2026-10-12): nút/mục tự dựng co nhẹ `scale(.97)`
lúc đang nhấn + chuyển màu theo `--duration-fast`, bỏ ô xám nháy của Safari. Trên
iPhone/iPad không có hover (Tailwind v4 gói `hover:` trong `@media (hover: hover)`)
nên đây là phản hồi DUY NHẤT trước khi màn đổi — thiếu nó người dùng bấm lần hai.
Dùng **thay** `transition-colors` cho nút tự dựng (không dựng trên `Button`; `Button`
đã có `active:translate-y-px`). Đã gắn: mục nav · tiêu đề nhóm nav · nút icon header
· nút chân drawer (`AppShell`) · `ChoiceGroup` · `InfoTip` · `GuideButton` ·
`DisplaySettingsButton` · `DataSyncStatusButton` · `DisplaySettingsPanel` · thẻ `StatCardGrid` bấm được. Nút tự
dựng mới ⇒ gắn `press-feedback`.

Drawer điện thoại (`AppShell`) dùng tw-animate-css `animate-in slide-in-from-left
duration-base`, overlay `animate-in fade-in-0 duration-fast`. **Không** làm
row-leave animation khi xóa (cần theo dõi presence → thêm framer-motion, nặng);
`ConfirmDelete` + toast Hoàn tác đã là phản hồi đủ.

**⚠️ Bẫy dropdown (đọc kỹ trước khi đụng animation Radix):** `index.css` ẩn cứng
`[data-slot="popover-content"][data-state="closed"]` và `select-content` đã đóng
(xem § 5a). **Giữ luật này** khi nâng cấp `tw-animate-css` — bỏ đi là tái phát lỗi
"ghi nhầm ô". Kiểm: mở 2 Combobox cùng dialog, đóng 1, `document.querySelectorAll(
'[cmdk-root]').length === 1`.

**Loading → Thinking:** thay spinner/"Đang tải" khô khan bằng cảm giác "hệ thống
đang suy nghĩ".
- Tải danh sách lần đầu → `TableSkeleton` (không chớp EmptyState). Màn đọc phần tử
  thứ 3 của `useTable`: `const [rows, write, { status }] = useX();` rồi
  `const loading = status === "loading" && rows.length === 0;`.
- Mở màn lazy / kết nối / tác vụ dài → `ProcessingState` (chấm suy nghĩ + chữ).
- Nhấn nút / đồng bộ → giữ toast; đèn `DataSyncStatusButton` đã phản ánh trạng thái đồng bộ.
- Định nghĩa ở `patterns/Loading.tsx` + primitive `components/ui/skeleton.tsx`.

## Nút toàn cục trên header (`features/shared/AppShell.tsx`)

Nút toàn cục là **nút icon `size-tap`** ở góc phải header. Trên **desktop** hiện
đủ; trên **điện thoại** header chỉ giữ `DataSyncStatusButton` (+ `GuideButton` nếu trang
có) — phần còn lại nằm ở **chân drawer**. Lý do: ngân sách ngang của header
thuộc về tiêu đề màn, xem § Quy chuẩn mobile.

| Component | Vai trò |
|---|---|
| Menu tài khoản (`features/shared/AccountMenu.tsx`) | **Avatar** ở góc phải header (mọi cỡ màn; tên + vai trò từ xl) → `Popover`: Tùy chỉnh giao diện · Đổi mật khẩu · Quản trị hệ thống (admin) · Đăng xuất. Gom MỌI việc của riêng người đăng nhập về một chỗ (2026-10-15); hộp thoại mở SAU khi đóng menu (không lồng hộp trong popover). Thêm việc cá nhân mới ⇒ thêm mục vào menu này, không thêm nút rời lên header. |
| `DisplaySettingsDialog` | Hộp "Tùy chỉnh giao diện" điều khiển từ ngoài (`open`/`onOpenChange`, `trigger` tùy chọn) — menu tài khoản mở nó. |
| `DisplaySettingsButton` | Icon 🎨 → `FormDialog` chứa `DisplaySettingsPanel` (không còn gắn trên header — đã vào menu tài khoản). Nhận `account` để **lưu theo người dùng**. Có **draft**: xem trước live, **Lưu** mới giữ, **Hủy**/đóng khôi phục ảnh chụp (`readDisplaySettings`/`writeDisplaySettings`). |
| `DataSyncStatusButton` | Icon theo màu store `ketNoi`. Popover chi tiết + nút **Thử kết nối lại** (`probeKetNoi`). |
| `GuideButton` | Icon "?" → hộp hướng dẫn của trang. Nội dung lấy từ `features/shared/guideContent.tsx`; trang có **hướng dẫn thao tác** (tour) thì đầu hộp có nút "Bắt đầu hướng dẫn thao tác" (prop `onStartTour`). Hiện khi trang có nội dung hướng dẫn HOẶC có tour. |

## Trang duyệt + cấu hình

`Bộ giao diện` (`src/design-system/kit/KitPage.tsx`) — trang demo component, vào
bằng URL `/kit` (đã gỡ khỏi sidebar), desktop-only.

**Cài đặt hiển thị** (`patterns/DisplaySettings.tsx`) giờ mở từ nút `DisplaySettingsButton`
trên header. Áp ngay và **nhớ theo từng tài khoản**:

| Cấu hình | Cách áp | Giá trị |
|---|---|---|
| Cỡ chữ | `--app-font-scale` trên `<html>` | 90 / **100 (mặc định)** / 110 / 120 / 130 % (nền token 17px từ 2026-10-15) |
| Mật độ | `data-density` trên `<html>` | thoáng 44px · vừa 40px · **gọn 36px (mặc định)** — kèm đệm ngang ô bảng `--cell-pad` 16 · 12 · 10px |
| Bề rộng nội dung | `--app-content-width` | 64rem / 80rem / 100% |

Khóa localStorage theo username: `bsf.<username>.<fontSize|density|contentWidth>`; chưa đăng
nhập ⇒ bucket mặc định `bsf.fontSize` (tương thích ngược). Đổi tài khoản →
`ShellLayout` trong `App.tsx` gọi `applyDisplaySettings(username)` nạp lại.
(`FontSizeQuickPicker` — nút cỡ chữ nhanh cũ — vẫn còn trong file nhưng không còn gắn
trên header.)

> Đầu thanh bên, đầu drawer và header nội dung cùng cao **`h-header`** — token
> `--spacing-header` trong `tokens.css` (4rem; máy xoay ngang thấp 3rem). Hàng tên
> cột nổi của `SummaryTable fullHeight` dính ở `top-header`. Đổi chiều cao ⇒ đổi MỘT token;
> đừng gõ `h-16`/`top-16` rời (lệch là trang vênh).

## Thêm component shadcn mới

CLI `npx shadcn add` có thể lỗi `EPERM: scandir …` trên Windows: CLI quét
ngược lên thư mục cha và đụng junction tương thích cũ bị khóa quyền
(`My Documents`, `Local Settings`…). Cách thay thế:

1. Tải trực tiếp từ registry:
   `https://ui.shadcn.com/r/styles/radix-nova/<tên>.json`, ghi `files[].content`
   vào `src/components/ui/`.
2. Sửa import: `@/registry/radix-nova/lib/utils` → `@/lib/utils`,
   `@/registry/radix-nova/ui/x` → `@/components/ui/x`,
   `@/app/(create)/components/icon-placeholder` → `@/components/ui/icon-placeholder`.
3. Thêm icon mới dùng đến vào `src/components/ui/icon-placeholder.tsx`.
4. **Đè size cho khớp mật độ hệ**: mặc định ~`h-10` + `text-sm`, chiều cao nên
   bám token density qua `data-slot` (xem override trong `tokens.css`). Đừng để
   lẫn `h-8`/`h-9` lạc cỡ giữa các primitive.

## Hướng dẫn thao tác — tour từng bước trên trang (`GuidedTour`, từ 2026-10-21)

Dẫn người dùng đi lần lượt từng khu vực của trang theo thứ tự công việc, ngay trên trang thật. Hành vi (oracle): [`docs/app-map/43-guided-tour.ba-spec.md`](../../docs/app-map/43-guided-tour.ba-spec.md). Áp dụng đầu tiên: Xuất khẩu.

- **Tour chỉ dẫn, không ghi** (R1): lớp phủ chặn mọi cú bấm lên trang; bước chỉ được đổi CHỖ XEM (đường dẫn, `replace`). Cấm bước tự bấm nút lưu / mở hộp form.
- **Khai tour ở màn**: `usePageTour(tour)` (features/shared/PageTourProvider — tour `useMemo`, `null` khi đang tải). Lối vào tự có: nút "?" ở thanh tiêu đề (`GuideButton onStartTour`). Muốn thêm nút trên trang: `usePageTourControl()` → `Button variant="outline"` "Hướng dẫn thao tác" (icon `Route`, thuộc tính `data-tour-start`), đặt trước nút chính.
- **Bước** (`TourStep`, `@/lib/guidedTour`): `target` = giá trị `data-tour="…"` gắn ở khu vực (trống ⇒ lời giữa trang) · `optional` ⇒ khu vực không có thì bỏ qua · `prepare` ⇒ đổi chỗ xem (bước cùng chỗ xem dùng CHUNG một hàm `prepare` — khung dò trước để đếm "Bước k/n" không nhảy cóc). Tên mốc tiếng Anh `kebab-case`, ổn định.
- **Lời** theo [`noi-dung-va-label.md`](noi-dung-va-label.md): tiêu đề bước = danh từ, không chấm cuối; lời gọi ĐÚNG chữ đang hiện trên trang, dùng "chọn", kết thúc bằng dấu chấm; gạch đầu dòng `•`, xuống dòng `\n`. Giải thích trạng thái lấy từ ba-spec của module, không tự đặt.
- **Khung tự lo**: đưa khu vực lên sát dưới thanh tiêu đề (cuộn đúng MỘT khung — không `scrollIntoView`, nó đẩy cả khung app); đặt khung lời dưới → trên → phải → trái, điện thoại nằm đáy màn và chừa đáy trang; phím → / Enter / ← / Esc; thoát ⇒ trả đường dẫn + vị trí cuộn. Không toast (luật 8 — thao tác trình bày).
- Thêm tour cho trang mới: gắn mốc `data-tour`, viết hàm thuần dựng bước + test (số bước, thứ tự, bước bỏ theo quyền), thử 360 px × 130 %.

## 9. Hướng dẫn khi rê chuột (`title`) — BẮT BUỘC cho nút thao tác

Người dùng là tổ trưởng / thủ kho / kế toán, phần lớn 45–60 tuổi, học phần mềm
bằng cách **rê thử rồi mới dám bấm**. Một nút không nói gì khi rê là một nút họ
né — rồi quay về ghi tay. Nên: **mọi nút THAO TÁC phải trả lời được câu "bấm
cái này thì chuyện gì xảy ra, ăn vào đâu"** ngay khi rê chuột.

### Viết `title` thế nào

`title` là **câu giải thích**, KHÔNG phải chép lại nhãn nút:

```tsx
// ✘ chép nhãn — rê chuột xong vẫn không biết gì thêm
<Button title="Dồn sang tháng sau">Dồn sang tháng sau</Button>

// ✔ nói việc nó làm + đụng tới đâu
<Button title="Lấy tồn cuối tháng này làm tồn đầu Tháng 10/2026. Chạy lại chỉ cập nhật, không nhân đôi dòng.">
  Dồn sang Tháng 10/2026
</Button>
```

Khuôn một câu: **{làm gì} + {ăn vào dữ liệu nào} + {lưu ý nếu có}**. Ngắn gọn,
một–hai câu, tiếng Việt thường ngày (xem [noi-dung-va-label.md](./noi-dung-va-label.md)).
Nút có hậu quả (chốt sổ, xóa, ghi đè, xuất file) thì **nói rõ hậu quả** ở đây —
đừng để người dùng biết sau khi đã bấm.

### Nút nào bắt buộc, nút nào không

| Loại nút | `title` |
|---|---|
| Chỉ-icon (✎ 🗑 🕘 ◀ ▶ …) | **BẮT BUỘC** + `aria-label`. Không có chữ thì hover là lối duy nhất để hiểu. |
| Thao tác nghiệp vụ (Lưu, Chốt ngày, Dồn kỳ, Gán, Đồng bộ, Nhập/Xuất Excel, In) | **BẮT BUỘC** |
| Đổi chế độ / bộ lọc (Ghi nhập/xuất, Chọn tất cả, Xem trước) | **BẮT BUỘC** |
| Hủy · Đóng · Quay lại trong hộp thoại | **Không** — thêm vào chỉ tổ nhiễu |
| Nút điều hướng có chữ rõ nghĩa trong `EmptyState` | Tuỳ, không bắt buộc |

### Cơ chế đỡ sẵn

`Button` (`components/ui/button.tsx`) **tự lấy `aria-label` làm `title`** khi
thiếu `title`. Nhờ vậy mọi nút chỉ-icon đã có `aria-label` đều có hover ngay,
không phải gõ hai lần cùng một câu. Nhưng `aria-label` thường chỉ là tên thao
tác ("Xóa 2 DA 250UP") — **câu giải thích đầy đủ vẫn nên viết vào `title`**.

Các pattern dùng lại đã tự gắn `title`, màn hình KHÔNG phải làm gì thêm:

| Pattern | Hover ra câu gì |
|---|---|
| `CatalogCrud` | nút Thêm / Sửa từng bản ghi (ghép sẵn `entityName` + mô tả bản ghi) |
| `ConfirmDelete` | nút Xóa mặc định — nói rõ có xác nhận và có Hoàn tác |
| `RecordTable` | tiêu đề cột sắp xếp (cả bản bảng lẫn nút sắp trên điện thoại) + nút bỏ lọc |
| `ChoiceGroup` | từng lựa chọn — lấy `o.description`, không có thì ghép "Chọn X cho {nhãn}" |
| `Combobox` · `DateField` · `NumberField` | nút mở danh sách / mở lịch / tăng giảm |
| `StepForm` · `PrintSheet` · `InfoTip` · `DisplaySettings` | nút điều hướng bước, In / Xuất PDF, ⓘ, Đặt lại |
| `RowMarkToolbar` · `RowMarkActions` (prop `rowMarks` của bảng) | Tô màu ▾ / In đậm / Bỏ in đậm / Bỏ tô / Bỏ chọn — nói rõ áp cho bao nhiêu dòng; từng ô màu ("Tô vàng rất đậm") |

Mục **điều hướng** lấy câu mô tả từ `KIT_NAV[].description` (`features/shared/AppShell.tsx`):
rê lên tên màn là biết màn đó để làm gì. **Thêm màn mới thì viết luôn `description`** —
xem [02-pages-navigation](../../docs/app-map/02-pages-navigation.md).

### Tốc độ hiện: `HoverHint` vẽ tooltip riêng, KHÔNG dùng của trình duyệt

Tooltip mặc định của `title` có **độ trễ do trình duyệt/OS quyết — trang web
không chỉnh được** (Chrome để ~1 giây). Chờ một giây mới thấy chữ thì người dùng
đã bấm đại hoặc bỏ đi rồi, gắn `title` coi như công cốc. Nên `HoverHint`
(`patterns/HoverHint.tsx`) **gắn MỘT lần ở `AppShell`** và tự vẽ:

- Trễ hiện = hằng **`HINT_DELAY_MS` (hiện tại 150ms)** — đổi một chỗ, cả app đổi theo.
- Nghe ở cấp document, bắt **mọi phần tử có `title`** (cả `<button>` thường,
  `TabsTrigger`, mục nav…). **Màn hình không phải import hay bọc gì** — cứ viết
  `title` như luật §9, phần còn lại tự chạy.
- Chống hiện HAI tooltip: lúc rê thì cất `title` sang `data-hint`, rời chuột trả
  lại. Đi bằng **bàn phím thì KHÔNG cất** — trình duyệt không bật tooltip khi
  focus, giữ `title` để trình đọc màn hình còn đọc được.
- Máy cảm ứng (`(hover: hover)` = false) **tự tắt** — không có rê chuột thì đừng
  bày tooltip nhảy lung tung. Nhắc lại cảnh báo ở trên: thông tin BẮT BUỘC mới
  thao tác đúng thì đừng giấu trong hover.
- Tự lật lên trên khi sát đáy, tự kéo vào trong khi sát mép.

⚠️ **Cạm bẫy đã dính, đừng lặp lại:** đừng dùng `transform` để căn giữa / lật
tooltip khi có class `animate-in` — keyframes của nó cũng đặt `transform` và đè
mất, làm tooltip **tràn mép phải và đè lên chính cái nút**. Tính thẳng
`left`/`top` bằng px trong `useLayoutEffect` (chạy trước khi vẽ nên không nhấp nháy).

⚠️ Gợi ý hover **không hiện trên điện thoại** (không có rê chuột). Thông tin mà
người dùng *bắt buộc* phải biết mới thao tác đúng thì đừng giấu trong `title` —
cho ra chữ phụ dưới nút, `InfoTip` cạnh nhãn, hoặc câu mô tả trong hộp thoại xác
nhận. Chữ vẫn viết vào `title`, nhưng app **không** để trình duyệt vẽ tooltip —
xem § Tốc độ hiện bên dưới.

### Cổng máy

`.githooks/pre-commit` **chặn** nút chỉ-icon (`size="icon…"`) thêm mới mà không
có `aria-label` / `title` — chỉ soi dòng THÊM MỚI, không bắt lỗi di sản.

## Kiểm tra trước khi giao

- [ ] Không `uppercase` cho nội dung; `text-xs` chỉ cho chip/badge/phụ chú
- [ ] Không còn `slate-400` / `slate-300` làm màu chữ
- [ ] Nút bấm được thoải mái (~40px `size-tap`)
- [ ] **Rê chuột lên từng nút thao tác đều ra câu hướng dẫn** (§9); không nút
      chỉ-icon nào câm
- [ ] Tab được hết màn bằng bàn phím, focus ring luôn thấy
- [ ] Dropdown danh sách dài: cuộn được và THẤY thanh cuộn
- [ ] **Chạy hết checklist ở § Quy chuẩn mobile · mục 7** (360px · thử 130% ·
      vùng chạm · bảng ra thẻ · chỉ dùng `md:`)
