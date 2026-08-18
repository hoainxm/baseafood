# Baseafood Senior Kit — luật dùng

Bộ giao diện cho hệ thống MES Baseafood. Người dùng chính là tổ trưởng / thủ kho
45–60 tuổi, thao tác trên tablet ở xưởng lạnh, tay ướt, đeo kính lão.

Nền: **shadcn/ui (style `radix-nova`) + Tailwind v4 + React 19**.
Sách luật tiếp cận: **WCAG 2.2 AA** + **GOV.UK Design System**.

## Ba tầng

```
src/design-system/tokens.css   ← cỡ chữ, màu, chiều cao ô. NƠI DUY NHẤT.
src/components/ui/*            ← primitive shadcn, ĐÃ đè size cho người lớn tuổi
src/design-system/patterns/*   ← pattern nghiệp vụ (Field, Combobox, RecordTable…)
src/features/*                 ← màn nghiệp vụ
```

## Luật bắt buộc

1. **Màn nghiệp vụ chỉ import từ `@/design-system`.**
   Cấm `import … from "@/components/ui/button"` trong `src/features/**`.
2. **Cấm viết class cỡ chữ / mã màu tay** trong màn nghiệp vụ
   (`text-sm`, `text-slate-400`, `bg-cyan-700`…). Muốn đổi → sửa `tokens.css`.
3. **Cấm `text-xs` và chữ IN HOA** cho nội dung. Nhỏ nhất là `text-sm` = 16px.
4. **Vùng chạm ≥ 44px**, mặc định 48px, hành động chính 56px.
5. **Không có nút chỉ-icon** trong màn nghiệp vụ. Icon luôn kèm chữ.
6. **Mọi ô nhập phải bọc `Field` / `NumberField` / `Combobox` / `DateField`.**
   Nhãn luôn hiện. Placeholder không bao giờ thay nhãn. Ô bắt buộc đánh dấu
   **`*` đỏ sau nhãn**; ô không bắt buộc không ghi gì. `*` là `aria-hidden`,
   thông tin bắt buộc đi qua `aria-required` trên chính ô — `FormDialog` và
   `StepForm` dò thuộc tính này để tự hiện `ChuThichBatBuoc` ("Ô có dấu * là
   bắt buộc"), không phải bật cờ tay.
7. **Nút Lưu không bao giờ `disabled`.** Thiếu dữ liệu thì bấm ra `ErrorSummary`.
8. **Mọi thao tác ghi dữ liệu phải bắn `notify`**, xóa phải qua `ConfirmDelete`
   và có nút Hoàn tác.
8b. **Thao tác hệ trọng KHÔNG phải xóa đi qua `XacNhan`** — đúng ba nhóm:
    mất việc đang làm (đăng xuất, bỏ dữ liệu vừa nạp) · ghi đè dữ liệu đang có ·
    khóa sổ hay đổi trạng thái khó quay đầu (chốt ngày, lệnh xuất).
    **Lưu thường ngày KHÔNG hỏi** — tổ trưởng ghi 30 chuyến/ngày mà lần nào cũng
    hỏi thì họ bấm Đồng ý theo phản xạ, hộp xác nhận mất tác dụng đúng lúc cần.
    Lưu thường dùng toast + Hoàn tác.
9. **Màu không bao giờ là tín hiệu duy nhất.** Luôn kèm icon hoặc chữ.
10. **Danh mục thay nhập tự do.** Đại lý / loại NL / mặt hàng / khách hàng đều
    chọn qua `Combobox` (có tạo mới tại chỗ), không gõ tay.
11. **Mọi dropdown phải cuộn được và THẤY thanh cuộn.** Luật đặt ở tầng
    primitive, không lặp ở chỗ gọi: `PopoverContent` giới hạn
    `max-h-(--radix-popover-content-available-height)`, `CommandList` /
    `SelectContent` cuộn với `scrollbar-width: auto`. **Cấm** dùng lại class
    `no-scrollbar` của shadcn cho danh sách chọn — nó ẩn thanh cuộn nên người
    dùng tưởng danh sách đã hết.
12. **Đơn vị trong ô nhập không dùng padding cố định.** `Field` đo bề rộng chữ
    đơn vị rồi chừa đúng chỗ — `pr-14` cứng làm "26.000" đè lên "đ/USD".
13. **Mọi chữ hiển thị theo chuẩn label.** Sentence case; nhãn field = danh từ
    trần (không "Chỉ xem…", không "… dòng", không `:`); nút = động từ đứng đầu.
    Chi tiết + before→after: [`noi-dung-va-label.md`](noi-dung-va-label.md).

**Ngoại lệ luật (bản in theo mẫu giấy):** `src/features/balancing/BalancingTable.tsx` và
`src/features/imports/DailyImportInvoice.tsx` cố tình dùng chữ nhỏ, chữ hoa, màu slate cứng để
khớp khổ A4. Đừng áp luật cỡ chữ / màu / sentence case vào hai file đó, và cũng
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

### 2. Thang chạm và icon — một nguồn

| Dùng cho | Class | Giá trị |
|---|---|---|
| Nút icon vuông | `size-tap` | 44px |
| Nút có chữ | `min-h-11` | 44px |
| Icon trong nút chạm | `size-icon` | 24px |
| Icon phụ trong dòng chữ | `size-icon-sm` | 20px |

Định nghĩa ở `tokens.css` (`--size-tap`, `--size-icon`, `--size-icon-sm`). Tất
cả đều **rem** nên phóng/thu ĐỒNG BỘ khi đổi cỡ chữ 100→130%. Viết `size-11` +
`size-6` rời rạc là cách cũ: hai chỗ, đổi một chỗ là lệch tỉ lệ.
⚠️ Tailwind chỉ sinh `size-tap` từ `--size-*`; **không có `h-tap`** — nút có chữ
dùng `min-h-11`.

### 3. Ngân sách ngang của header thuộc về TIÊU ĐỀ

- Cụm trái (menu · logo · tiêu đề) = `min-w-0 flex-1`. Cụm phải = `shrink-0`
  nhưng **phải ít nút**.
- Điện thoại chỉ giữ: `☰` · `NutTrangThai` (+ `NutHuongDan` nếu trang có).
  Đổi ca · thông báo · giao diện · tài khoản · đăng xuất nằm ở **chân drawer**.
- Lý do: 6 nút icon ở cỡ chữ 130% = 407px > màn 390px → tiêu đề bị bóp còn 0px
  và cả trang cuộn ngang.

### 4. Điều hướng: DỌC, gom nhóm, một cây dùng chung

`AppShell` có **một** cây nav (`CayNav`) dựng từ `KIT_NAV` + `NHOM_NAV`:
desktop hiện làm sidebar, điện thoại hiện làm **drawer trượt trái**. Thêm màn
mới ⇒ thêm 1 dòng vào `KIT_NAV` **và** xếp id vào đúng nhóm trong `NHOM_NAV` —
quên bước sau thì mục rơi vào nhóm "Khác".

Không dùng bottom-tab cuộn ngang: 14 mục nhét vào thanh 390px thì 7 mục nằm
ngoài màn mà người dùng không biết là còn.

### 5. Bảng: mặc định đổi sang THẺ

| Loại bảng | Cách làm |
|---|---|
| Danh sách bản ghi (mặc định) | `RecordTable` — desktop ra bảng, điện thoại ra thẻ. Đánh dấu `chinh` cho cột tiêu đề thẻ, `anTrenDienThoai` cho cột phụ |
| Báo cáo kiểu Excel, phải đối chiếu nhiều cột số | Giữ bảng rộng + `overflow-x-auto` + **`cot-dau-dinh`** trên `<table>` để khoá cột đầu |
| **Nhập số hàng loạt kiểu bảng tính** (hàng = mặt hàng, cột = ngày) | `LuoiNhap` — xem mục 5b |
| Bản in A4 | Ngoại lệ, giữ nguyên bố cục giấy — không responsive hoá |

**Cấm** viết `<table className="min-w-[1120px]">` tay trong màn mới rồi bọc
`overflow-x-auto` và coi là xong.

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

### 5b. `LuoiNhap` — lưới nhập kiểu bảng tính

Dùng khi người dùng phải gõ **nhiều ô số cùng lúc** và đang có sẵn thói quen làm
việc đó trên Excel (màn Cân đối kỳ). Mở hộp thoại cho từng ô thì Excel vẫn nhanh
hơn và người dùng sẽ quay về Excel — đó là lý do primitive này tồn tại.

Cho sẵn:

- Enter / mũi tên xuống → ô dưới; Tab → ô phải, hết hàng thì xuống dòng.
- Ô khoá tự bị bỏ qua khi di chuyển, không làm kẹt con trỏ; khai `lyDoKhoa` để
  người dùng biết vì sao không gõ được (đừng để ô câm).
- **Dán khối từ Excel** (TSV). Hiểu cả `(2.000)` = −2.000 kiểu kế toán. Ô rỗng
  trong khối dán **giữ nguyên** số cũ, không xoá về 0.
- Cột dính bên trái, `min-w-44` trên máy nhỏ → `sm:min-w-60`.
- Ô cao ≥ 44px, `tabular-nums`, số âm tô `text-destructive`.

Luật khi dùng:

- Ô nhập **ghi theo từng phím** (như `NumberField`), không đợi rời ô — cột tổng
  và khối kết quả phải nhúc nhích theo con số đang gõ.
- **Cột tổng phải là `kieu: "tinh"`** (ô tính, không gõ). Cho gõ tay vào cột tổng
  là cách chắc chắn nhất để bảng lệch — bảng cân đối giấy của xí nghiệp đã lệch
  1.109 kg đúng vì lý do đó.
- Khoá ô (`khoa`) chỉ dùng khi ô **thật sự không có nghĩa**, không dùng để
  "bảo vệ" số: ô khoá đọc ra là ô hỏng. Số đến từ sổ khác thì cho gõ rồi ghi
  ngược về sổ đó.
- Khai `onDanKhoi` nếu màn có ghi ra ngoài (state cha, sổ khác). Không khai thì
  lưới rải từng ô qua `onGhiO`, và **nhiều `setState` liên tiếp trên cùng mảng
  sẽ ghi đè nhau** — chỉ ô cuối sống sót.
- Ô cần điều khiển (chọn khách, nút…): `CotLuoi.oRieng`, KHÔNG phải `hien`.
  Combobox trong ô dùng `anNhan` — tiêu đề cột đã nói ô đó là gì.
- **Cấm `sr-only` cho nhãn nằm trong hộp cuộn.** `sr-only` là `position:absolute`;
  gặp tổ tiên không định vị thì rơi ra toạ độ trang, đội chiều cao trang lên và
  sinh thêm một thanh cuộn dọc + mảng trắng dưới cùng. Dùng `aria-label`.
- Dòng tiêu đề nhóm: `HangLuoi.tieuDeNhom`. Dòng tổng cuối bảng tự dựng ở màn
  gọi qua `cuoiBang` (số cột phải khớp, kể cả khi nhóm cột đang thu).

### 6. Ba cái bẫy làm vỡ trang ở cỡ chữ 130%

1. **Ô lưới không co**: con của `grid`/`flex` mặc định `min-width:auto` = rộng
   theo chữ dài nhất. Thêm `min-w-0` (hoặc `[&>*]:min-w-0` trên lưới).
   `Field` · `Combobox` · `DateField` · `ChoiceGroup` đã có sẵn `min-w-0`.
2. **Cụm nút không xuống dòng**: mọi hàng nút phải có `flex-wrap`.
3. **Biểu đồ / SVG có bề rộng tối thiểu**: bọc `overflow-x-auto` và đặt
   `min-w` = đúng `W` của `viewBox`. Thu nhỏ SVG là thu nhỏ luôn chữ trục
   (680/900 → nhãn 16px còn 12px).

### 7. Checklist màn mới PHẢI qua

- [ ] 390px: `document.documentElement.scrollWidth === 390` — trang **không**
      cuộn ngang (chỉ vùng bảng/biểu đồ được cuộn, có chủ đích)
- [ ] 390px + cỡ chữ **130%** + mật độ **Gọn**: vẫn không cuộn ngang, không đè chữ
- [ ] Mọi nút / ô tick chạm được ≥ 44×44px (ô tick nhỏ thì bọc `<label>` `size-tap`)
- [ ] Không chữ nào nhỏ hơn **`text-sm`** (16px ở thang gốc; người dùng để cỡ
      chữ 90% thì mọi thứ cùng nhỏ theo — đo bằng TOKEN, không bằng px tuyệt
      đối). `text-xs` = 15px chỉ cho chip/badge phụ chú, không cho nội dung.
      Không `fontSize` cứng trong SVG dưới 16
- [ ] Bảng dài đã ra thẻ trên điện thoại (hoặc có `cot-dau-dinh` nếu là báo cáo Excel)
- [ ] Chỉ dùng `md:` cho bố cục khung; không thêm `sm:`
- [ ] Màn mới đã vào `KIT_NAV` **và** `NHOM_NAV`

## Bảng chọn component

| Tình huống | Dùng |
|---|---|
| Ô chữ | `Field` + `Input` |
| Ô số (kg, tiền, %) | `NumberField` |
| Chọn 1 trong ≤ 6 | `ChoiceGroup` (nút to) |
| Chọn 1 trong danh mục dài / cần tạo mới | `Combobox` |
| Chọn ngày | `DateField` |
| Chọn khoảng ngày | `DateRangeField` (hai ô riêng Từ / Đến) |
| Danh sách bản ghi | `RecordTable` — truyền `sapXep` cho cột để bấm tiêu đề sắp xếp, truyền `timKiem` để hiện ô tìm |
| Nhập nhiều ô số một lúc (lưới ngày) | `LuoiNhap` — cột tổng luôn `kieu: "tinh"` |
| Danh mục có Thêm/Sửa/Xóa/Tìm | `DanhMucCrud` |
| Xóa bất kỳ thứ gì | `ConfirmDelete` |
| Thao tác hệ trọng không phải xóa (đăng xuất · chốt sổ · ghi đè · lệnh xuất) | `XacNhan` — nêu đích danh việc sắp làm + hệ quả, nút an toàn đứng trước |
| Form > 5 ô, nhập không thường xuyên | `StepForm` |
| Form > 5 ô, nhập lặp nhiều lần/ngày | `Dialog` + nhóm ô, phần phụ gập lại |
| Báo lỗi cả form | `ErrorSummary` (đầu form, có link nhảy tới ô) |
| Cho biết đang làm cho ngày/xưởng nào | `ContextBar` |
| Danh sách rỗng | `EmptyState` (phải nói việc tiếp theo) |
| Câu diễn giải dài cạnh nhãn | `InfoTip` (nút ⓘ + popover). `DateField` **và** `Combobox` có sẵn prop `info` — dùng thay `hint` khi câu dài khiến hai ô cùng hàng lệch chiều cao. Nhãn tiêu đề vẫn luôn hiện. |
| Bảng tổng hợp cho trang Báo cáo | `BangTong` — cột số căn phải `tnum`, hàng TỔNG CỘNG ở chân tự cộng theo `tong` từng cột. Component cha lo gom nhóm; `BangTong` chỉ hiển thị. |
| **Dialog/form thông tin hay thao tác** | `FormDialog` — khung CHUẨN: đầu cố định (icon + tiêu đề + mô tả) · thân cuộn `scroll-nice` · chân cố định chứa nút. `rong`: sm/vua/rong/xl. Điều khiển bằng `open`/`onOpenChange` hoặc `trigger`. Nút đóng tiện dụng: `NutDong`. |
| Các con số bối cảnh/tổng | `ThongKe` (lưới thẻ KPI: nhãn nhỏ + số TO + icon màu) — sinh động hơn nhồi một dòng. `ContextBar` chỉ dùng cho thanh dính "đang xem ngày/xưởng nào" trong màn nhập liệu. |
| Biểu đồ trong Báo cáo | `BieuDoCot` — thanh NGANG + đường trung bình nét đứt, một màu thương hiệu, thuần HTML + token (ăn theo cỡ chữ). KHÔNG thêm thư viện chart. |

## Nút toàn cục trên header (`features/shared/AppShell.tsx`)

Nút toàn cục là **nút icon `size-tap`** ở góc phải header. Trên **desktop** hiện
đủ; trên **điện thoại** header chỉ giữ `NutTrangThai` (+ `NutHuongDan` nếu trang
có) — phần còn lại nằm ở **chân drawer**. Lý do: ngân sách ngang của header
thuộc về tiêu đề màn, xem § Quy chuẩn mobile.

| Component | Vai trò |
|---|---|
| `NutGiaoDien` | Icon 🎨 → `FormDialog` chứa `CaiDatHienThi`. Nhận `taiKhoan` để **lưu theo người dùng**. Có **draft**: xem trước live, **Lưu** mới giữ, **Hủy**/đóng khôi phục ảnh chụp (`docCaiDatHienThi`/`ghiCaiDatHienThi`). |
| `NutTrangThai` | Icon theo màu store `ketNoi`. Popover chi tiết + nút **Thử kết nối lại** (`probeKetNoi`). |
| `NutHuongDan` | Icon "?" → hộp hướng dẫn của trang. Nội dung lấy từ `features/shared/guideContent.tsx`, chỉ hiện ở trang có trong registry. |

## Trang duyệt + cấu hình

`Bộ giao diện` (`src/design-system/kit/KitPage.tsx`) — trang demo component, vào
bằng URL `/kit` (đã gỡ khỏi sidebar), desktop-only.

**Cài đặt hiển thị** (`patterns/DisplaySettings.tsx`) giờ mở từ nút `NutGiaoDien`
trên header. Áp ngay và **nhớ theo từng tài khoản**:

| Cấu hình | Cách áp | Giá trị |
|---|---|---|
| Cỡ chữ | `--app-font-scale` trên `<html>` | **90 (mặc định)** / 100 / 110 / 120 / 130 % |
| Mật độ | `data-density` trên `<html>` | thoáng 48px · vừa 44px · gọn 40px |
| Bề rộng nội dung | `--app-content-width` | 64rem / 80rem / 100% |

Khóa localStorage theo username: `bsf.<username>.<coChu|matDo|beRong>`; chưa đăng
nhập ⇒ bucket mặc định `bsf.coChu` (tương thích ngược). Đổi tài khoản →
`ShellLayout` trong `App.tsx` gọi `apDungCaiDatHienThi(username)` nạp lại.
(`CoChuNhanh` — nút cỡ chữ nhanh cũ — vẫn còn trong file nhưng không còn gắn
trên header.)

> Đầu thanh bên và header nội dung cùng cao `h-20` trong `AppShell.tsx`. Đổi
> chiều cao thì đổi CẢ HAI, lệch một bên là cả trang trông vênh.

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
4. **Đè size ngay**: mặc định shadcn là `h-8`/`h-9` + `text-sm` — nhỏ hơn cả bản
   cũ. Không đè là tái phát toàn bộ vấn đề tiếp cận.

## Kiểm tra trước khi giao

- [ ] Không còn `text-xs` / `uppercase` trong `src/features/**`
- [ ] Không còn `slate-400` / `slate-300` làm màu chữ
- [ ] Mọi nút bấm được ≥ 44×44px
- [ ] Tab được hết màn bằng bàn phím, focus ring luôn thấy
- [ ] Dropdown danh sách dài: cuộn được và THẤY thanh cuộn
- [ ] **Chạy hết checklist ở § Quy chuẩn mobile · mục 7** (390px · 130% + Gọn ·
      vùng chạm · bảng ra thẻ · chỉ dùng `md:`)
