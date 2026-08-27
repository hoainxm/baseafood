> Load khi: sửa bất cứ thứ gì ở màn Nhập hàng — chuyến, ngày, ghi bù, chốt ngày, phế liệu ngày, phiếu báo cáo ngày.
covers: src/features/imports/MaterialImportScreen.tsx, src/features/imports/DailyImportInvoice.tsx, src/features/imports/ImportReport.tsx, src/features/imports/ImportTab.tsx, src/types.ts
last_verified: 2026-08-27
ttl_days: 90
<!-- updated: 2026-08-27 — GỘP NHẬP NL + PHẾ LIỆU VÀO 1 CHỖ (đổi UI, GREEN): dialog ghi chuyến đổi tên "Ghi nhập trong ngày" và NHÚNG luôn khối KhoiPheLieuNgay (nguyên liệu + phế liệu cùng một dialog). Phế liệu lưu NGAY khi thêm (onChange=persistPheLieu, như cũ); nguyên liệu lưu khi bấm "Lưu vào sổ" (luuPhien GIỮ NGUYÊN — không đụng). Khối phế liệu ngoài trang thành CHỈ-XEM (prop chiXem: ẩn nút Thêm/Sửa/Xóa + badge "Ghi ở Ghi nhập trong ngày"). Nút mở dialog ở trang + empty-state đổi nhãn "Ghi nhập trong ngày". Model phế liệu KHÔNG đổi (vẫn gộp ngày×xưởng, source "Nhập hàng") nên Cân đối hút y nguyên. -->
<!-- re-verified: 2026-08-27 — cổng nhập: lưu 1 chuyến (2 da nguyên liệu 500kg) + phế liệu (Nội tạng 120kg) cùng ngày qua dialog gộp → material_imports + import_shipments + scraps đều ghi đúng; validation vẫn chặn dòng thiếu loại. -->

<!-- re-verified: 2026-08-06 — bộ lọc theo KỲ (ngày/tuần/tháng/năm/tùy chọn → phamViKy); loài/phân xưởng nhập bằng dropdown; báo cáo theo kỳ (mỗi ngày một khối, PhieuNLNgay nhận tuNgay/denNgay); phế liệu thêm nhiều loại/lần; chốt ngày cuối màn — khớp MaterialImportScreen.tsx + DailyImportInvoice.tsx -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: DailyImportInvoice.tsx/ImportReport.tsx/ImportTab.tsx (symbol PhieuNLNgay/BaoCaoNhap giữ nguyên) -->

<!-- updated: 2026-08-25 — GIẢM THAO TÁC (đổi UI, GREEN): (1) hộp Ghi/Sửa chuyến giờ NHẬP CẢ BẢNG loại hàng một lượt rồi LƯU MỘT LẦN — bỏ "thêm từng loại → bấm Thêm" + bỏ dialog "Sửa dòng hàng" (sửa/xóa dòng ngay trong bảng); thêm dòng bằng nút "Thêm loại hàng" ở cuối (themDongMoi) — dòng mới xuống cuối, KHÔNG tự nhảy (đã bỏ auto-grow chuanCuoiBang vì vừa chọn loại đã sinh dòng, gây rối); state DongBang[] (key + id|null), lưu qua luuPhien (batch persist rows+chuyến một lần) giữ nguyên bất biến "đầu chuyến áp mọi dòng"/"chuyến chỉ tạo khi có dòng"/"dữ liệu cũ không tự sinh chuyến"; đóng bằng X/Esc = luuPhien(imLang) đủ-thì-lưu-thiếu-thì-bỏ (thay dongPhienLai). (2) NGÀY: chọn ngày ghi sổ kéo ngày hàng về theo (state ngayLienNhau) tới khi tự sửa tay ngày hàng về (doiNgayGhiSo/doiNgayVe). (3) DROPDOWN ĐẠI LÝ: dòng phụ gộp code · billingName · phone · address ngăn bởi " – " (moTaDaiLy) — vừa hiện vừa nằm trong chuỗi tìm kiếm Combobox. Lưu ý: mô hình "nháp = đã lưu ngay" từng-dòng đổi thành lưu-một-lần; đóng nhanh vẫn giữ dòng đủ nhờ auto-save-khi-đóng. -->
<!-- updated: 2026-08-21 — GIẢM THAO TÁC (đổi UI, GREEN): Enter ở ô Số lượng/Đơn giá = "Thêm loại này vào sổ" (qua themDong nên ErrorSummary + kiểm đầu chuyến còn nguyên); loài mặc định = loài ghi gần nhất trong phiên (state loaiGanNhat) thay "Bạch tuộc" cứng, thêm loại vào chuyến cũ mặc định theo loài chuyến đó; prefill đại lý khi đang lọc 1 đại lý; "Lưu & thêm chuyến khác" GIỮ đại lý (chỉ reset xe/ghi chú). VÁ BUG: hộp phế liệu ngày (KhoiPheLieuNgay) onChange ghi sai key sau rename EN — loai→name, donGiaBan→sellingPrice — khiến KHÔNG lưu được loại phế liệu + đơn giá bán -->
<!-- updated: 2026-08-18 — thêm 'Đổi loại hàng loạt' (BulkTypeChange.tsx): tick nhiều chuyến đổi tên loại NL một lượt, dùng để gán lại size 80↓ sau migration 0019 -->
<!-- updated: 2026-08-17 — 0019: cột balancing_period_id (kỳ cân đối hút dòng nhập); loại NL 'Bạch tuộc 2 da' tách thành lớn (80↑)/nhỏ (80↓) -->

# Sổ nhập nguyên liệu hàng ngày

Số hóa sổ giấy *"Báo cáo tổng hợp nguyên liệu hàng ngày"*. Đây là màn dùng nhiều nhất, mỗi ngày, ở xưởng lạnh.

## State hiện tại

Đã có: chuyến thật · tách ngày giao / ngày ghi sổ + ghi bù có lý do · chốt ngày theo (ngày + phân xưởng) · phế liệu cân gộp cuối ngày · lọc theo ngày/khoảng ngày/xưởng/đại lý/loại NL/thiếu đơn giá · sổ nhóm theo chuyến · sửa đầu chuyến áp cho cả chuyến · **phiếu báo cáo tổng hợp NL ngày (in A4 ngang)**.

Bố cục lọc: **toolbar một hàng** (Kỳ xem sổ · Ngày/khoảng · Phân xưởng + nhóm nút Xem báo cáo / Ghi chuyến); lọc ít dùng (đại lý / loại NL / đơn giá) gom trong nút **"Bộ lọc thêm"**. Khối chốt ngày là **strip mỏng ở CUỐI màn**.

**Bộ lọc theo KỲ** — logic dùng chung ở [`src/lib/periodUtils.ts`](../../src/lib/periodUtils.ts) (`ky`: `ngay | tuan | thang | nam | tuy-chon`): `phamViKy()` suy ra `[từ, đến]` từ một **ngày neo** — tuần = Thứ 2→CN, tháng/năm = đầu→cuối; `tuy-chon` dùng `tuNgay/denNgay`. Mọi lọc/tổng/chốt tính theo khoảng này. `laMotNgay = từ === đến` mới cho chốt/phế liệu ngày. **Phiếu báo cáo mang cùng bộ chọn kỳ** (mirror `periodUtils.ts`) nên xem/in linh hoạt trong phiếu. Nhập bằng **dropdown** (`Combobox`) cho các trường ít lựa chọn: kỳ, phân xưởng, loài — có giá trị mặc định, `choPhepXoa={false}`.

Chưa có: **người chốt / người ghi bù** (chưa có đăng nhập — [05-bao-mat-phan-quyen](05-bao-mat-phan-quyen.md)); màn xem lại **lịch sử chốt/mở lại** (dữ liệu đã đủ: `chot_luc`, `tong_kg_luc_chot`, `ly_do_mo_lai`).

Bảng dùng: `chuyen_nhap`, `nhap_nguyen_lieu`, `chot_ngay`, `phe_lieu` (dòng `nguon = "Nhập hàng"`), đọc thêm danh mục `dai_ly` / `loai_nguyen_lieu`.

**Hai tab** (bọc ở `ImportTab.tsx`, tầng `index.ts`): **Sổ nhập hàng** = màn ghi (`NhapNguyenLieu`) · **Báo cáo** (`BaoCaoNhap`) = tổng nhập theo kỳ (`lib/periodUtils.ts`), gom **đại lý × loại NL**; chỉ đọc. Báo cáo trình bày bằng **thẻ `ThongKe`** (kỳ · tổng kg · giá trị · số đại lý) + **`BieuDoCot`** (sản lượng theo đại lý, có đường trung bình) + `BangTong`. Khác **phiếu A4** (`PhieuNLNgay`, in đúng tờ giấy) — báo cáo là màn phân tích, phiếu là bản in.

### Đổi loại nguyên liệu hàng loạt (`BulkTypeChange.tsx`)

Nút **"Đổi loại hàng loạt"** trên thanh công cụ: chọn loại đang ghi trong sổ → giới hạn khoảng ngày (tùy chọn) → tick chuyến → chọn loại đích → đổi.

Sinh ra vì migration `0019` đổi TOÀN BỘ dữ liệu cũ "Bạch tuộc 2 da" sang size **lớn (80↑)**; thực tế một phần là hàng nhỏ, mà sửa từng chuyến là hàng trăm lần mở hộp thoại.

Chỉ đụng cột `materialTypeName`. **Không** đụng kg, đơn giá, ngày, chuyến. Có Hoàn tác.

## Logic / Rules

### 1. Chuyến = một đại lý giao một lượt

Đại lý đổ 3 mặt hàng ⇒ **1 `chuyen_nhap` + 3 dòng `nhap_nguyen_lieu`** cùng `chuyen_id` (đúng sổ giấy: STT đánh theo đại lý).
Một đại lý giao **2 lượt trong ngày ⇒ 2 chuyến**. Đây chính là chỗ bản trước đếm sai vì gom ngầm theo (ngày + đại lý + xe).

Thuộc về chuyến: ngày, phân xưởng, đại lý, tài xế, biển số, ghi chú. Thuộc về dòng: loài, loại NL, kg, đơn giá.
⇒ **Sửa một dòng chỉ được đổi loại/loài/kg/giá.** Đổi ngày/đại lý/xe phải sửa ở đầu chuyến, và áp cho **mọi dòng** của chuyến.

**Chọn LOÀI trước, rồi LOẠI NL.** Ô loại NL lọc theo loài đang chọn (`optLoaiNLTheoLoai`): mục danh mục **chưa gán loài** (`loai` rỗng — gồm toàn bộ dữ liệu cũ) hiện cho **mọi** loài; mục đã gán chỉ hiện đúng loài. Tạo mới loại NL tại chỗ sẽ **đóng dấu loài đang chọn** (`themLoaiNL(ten, loai)`). Bộ lọc "Chỉ xem loại NL" vẫn dùng danh sách đầy đủ (`optLoaiNL`), không ràng loài.

**Một dialog dùng CHUNG cho ghi mới + sửa chuyến** (bỏ 2 bước "đầu chuyến → đổ hàng"; bỏ luôn `HopThoaiDauChuyen` sửa-đầu-riêng): đầu chuyến ở trên (sửa tại chỗ, luôn hiện) — dưới là **BẢNG loại hàng** (`BangDongHang`): mỗi loại một **HÀNG trải ngang** (Loài · Loại NL · Số lượng · Đơn giá · Bỏ trên desktop; xuống dòng gọn trên điện thoại) — bỏ kiểu "cụm 4 ô" cho đỡ rối, nhập **cả chuyến một lượt rồi LƯU MỘT LẦN**. Không còn "thêm từng loại → bấm Thêm" và không còn dialog "Sửa dòng hàng" lồng — sửa/bỏ dòng ngay trong bảng. Thêm dòng bằng **nút "Thêm loại hàng"** ở cuối bảng (`themDongMoi`): dòng mới xuống CUỐI, **không tự nhảy/không xô layout** khi đang gõ (đã bỏ auto-grow `chuanCuoiBang` vì gây rối lúc vừa chọn loại đã sinh dòng mới); mặc định loài của dòng mới = loài dòng cuối. Luôn còn ≥1 dòng để nhập (bỏ dòng cuối = làm trống lại). Nút "Bỏ dòng" chỉ hiện khi có >1 dòng.

- Bảng giữ ở state `DongBang[]` (`key` React + `id|null` = dòng đã lưu hay mới). Lưu qua **`luuPhien`** — một lần `persist` gộp: tạo/ghi `chuyen_nhap` + mọi dòng hợp lệ (loại + kg>0). Dòng cũ giữ `id` (cập nhật), dòng mới cấp `id` mới, dòng đã bỏ khỏi bảng thì **không đưa lại** (tức là xóa). `luuPhien` kiểm `loiDauChuyen` trước (tránh tạo chuyến thiếu đại lý) và áp đầu chuyến cho **mọi** dòng ⇒ giữ bất biến "đầu chuyến áp cả chuyến". Chuyến chỉ tạo khi có ≥1 dòng hợp lệ (không chuyến rỗng — không cần dọn chuyến rỗng nữa).
- **Đóng bằng X / Esc / bấm ra ngoài** = `dongKhongLuu` → `luuPhien(imLang=true)`: đủ thì vẫn LƯU (khỏi mất số đã gõ, thay cho "nháp = đã lưu ngay" của bản từng-dòng), chưa đủ (thiếu đại lý / chưa có dòng) thì bỏ lặng, không nài lỗi. Bấm nút footer thì báo lỗi như thường.
- **Sổ chỉ 1 nút "Sửa chuyến"/chuyến** (`moSuaChuyen`) mở đúng dialog trên ở chế độ sửa, nạp mọi dòng đã ghi vào bảng (giữ `id`) + một dòng trống cuối; bảng dòng trong sổ là **chỉ đọc** — mọi sửa/xóa dòng + **"Xóa cả chuyến"** nằm trong dialog. Chuyến đã chốt không hiện nút sửa.
- **Nhóm dòng khi sửa theo `suaRowIds` (id-set), không theo `chuyenId`** ⇒ sửa được CẢ dữ liệu cũ (chuyenId rỗng): dòng thêm khi sửa dữ liệu cũ vẫn để `chuyenId=""`, gom lại nhờ (ngày+xưởng+đại lý+xe) — **không tự sinh `chuyen_nhap`** cho dữ liệu cũ.
- Footer khi tạo mới: **"Lưu & thêm chuyến khác"** (`luuThemChuyenKhac`: lưu rồi giữ ngày+xưởng+đại lý, làm mới xe + bảng — cho một đại lý giao nhiều lượt, mỗi lượt một chuyến) + **"Lưu vào sổ"** (`xongChuyen`). Khi sửa: nút **"Lưu chuyến"** + **"Xóa chuyến"**.
- **Dropdown đại lý** (`optDaiLy`): dòng phụ dưới tên gộp `code · billingName · phone · address` ngăn bởi **" – "** (`moTaDaiLy`), lọc bỏ ô rỗng; chuỗi này vừa hiển thị vừa nằm trong bộ tìm của `Combobox` (tìm theo số điện thoại / tên hóa đơn được).

### 2. Hai ngày — đừng bao giờ lẫn

| Trường | Nghĩa | Dùng ở đâu |
|---|---|---|
| `ngayGiao` / `ngay_giao` (dòng hàng vẫn là cột `ngay`) | hàng **thực về xưởng** | **MỌI tổng hợp**: sổ ngày, kỳ cân đối, báo cáo tháng |
| `ngayGhiSo` / `ngay_ghi_so` | ngày ghi vào hệ thống | chỉ để giải trình + nhãn "Ghi bù" |

Dòng `nhap_nguyen_lieu.ngay` là **bản chép của `ngayGiao`** để tổng hợp nhanh. Sửa ngày giao của chuyến ⇒ phải cập nhật `ngay` của mọi dòng con, nếu không sổ và cân đối lệch nhau.

Trên UI hai ô này đứng cùng hàng, **"Ngày ghi sổ" đặt trước, "Ngày hàng về xưởng" đặt sau** (theo thứ tự thao tác: mở sổ hôm nay rồi mới chọn ngày hàng thật về). Câu diễn giải dài gom vào nút **ⓘ** cạnh nhãn (`DateField info` → pattern `InfoTip`) để hai ô cùng chiều cao, không lệch — nhãn tiêu đề vẫn luôn hiện.

**Hai ngày đi liền theo mặc định** (state `ngayLienNhau`): đổi **ngày ghi sổ** thì ngày hàng về **tự nhảy theo** (`doiNgayGhiSo`) — khớp ca thường gặp (hàng về đúng ngày ghi). Chỉ khi người dùng **tự sửa ngày hàng về** (`doiNgayVe`) thì hai ngày mới **tách** (đây là ghi bù) và ô ghi sổ thôi kéo theo. Khởi tạo: `moThem` liền khi ngày xem = hôm nay, tách sẵn khi đang xem ngày cũ; `moSuaChuyen` liền khi `postingDate === deliveryDate` của chuyến.

### 3. Ghi bù

`laGhiBu()` (`src/types.ts`) = `ngayGhiSo > ngayGiao`. **Bắt buộc `lyDoGhiBu`** khi ghi bù **hoặc** khi ngày đó đã chốt (`loiDauChuyen`). Ngày ghi sổ **không được trước** ngày hàng về.
Tình huống thật: hàng về 29/7, 31/7 mới có hóa đơn → `ngayGiao = 29/7`, tổng ngày 29/7 vẫn đúng, và giải trình được vì sao khác bản đã gửi hôm 29/7.
Đơn giá **được để trống** khi chưa có hóa đơn → nhãn *"Chưa có giá"* + bộ lọc riêng để đòi giá sau. `thanhTien` coi giá null là 0.

### 4. Chốt ngày

Khóa theo **(ngày + phân xưởng)**, một bản ghi duy nhất mỗi cặp (unique index).

- Chốt xong: khóa sửa/xóa/thêm chuyến thường **và** khóa khối phế liệu của ngày đó.
- Còn đúng hai đường: **ghi bù** (bắt buộc lý do) hoặc **mở lại ngày** (bắt buộc lý do).
- Mở lại là `daChot = false`, **KHÔNG xóa bản ghi** — giữ vết ai mở, vì sao. Chốt lại thì ghi đè cùng `id` (`tongKgLucChot` cập nhật theo tổng mới).
- `tongKgLucChot` giữ con số **tại thời điểm chốt**; sau đó ghi bù thì màn hình chỉ ngay `lechSauChot = tổng thực tế − tổng lúc chốt`. Đừng âm thầm đổi con số đã gửi đi.
- Thanh chốt **chỉ có nghĩa khi đang xem MỘT ngày của MỘT xưởng** — chế độ khoảng ngày hoặc "Tất cả xưởng" thì không hiện.
- **Đặt ở CUỐI màn** (sau sổ + khối phế liệu): người dùng xem hết số trong ngày rồi mới chốt, không chốt vội ở đầu.
- `tongNgayXuong()` tính **không phụ thuộc bộ lọc** đang xem — chốt phải là tổng thật của ngày, không phải tổng của cái đang lọc.

### 5. Phế liệu (nội tạng, dạt) — nhập MỘT chỗ

Cân **gộp cuối ngày** theo (ngày + phân xưởng), ngay lúc nhận hàng ⇒ nhập ở màn này, `nguon = "Nhập hàng"`, `kyId` rỗng.
Màn Cân đối chỉ **hút** vào kỳ (gán `kyId`), không nhập lại lần hai. Xem [31-can-doi-ky](31-can-doi-ky.md).
Hộp "Thêm phế liệu" cho **thêm nhiều loại trong một lần**: mỗi loại bấm *"Thêm loại này"* (lưu ngay + reset form, hộp thoại vẫn mở), xong bấm *"Xong"* — không phải mở lại hộp cho từng loại (nội tạng, dạt…).

### 6. Phiếu báo cáo tổng hợp — in A4 NGANG, theo KỲ (`DailyImportInvoice.tsx`)

Số hóa đúng tờ giấy *"Báo cáo tổng hợp nguyên liệu hàng ngày"*. Nút **"Xem báo cáo"** luôn hiện; mở overlay xem + `window.print()`. Nhận `tuNgay/denNgay` = kỳ đang lọc.
**Một ngày** ⇒ đúng một tờ. **Nhiều ngày** (tuần/tháng/năm/khoảng) ⇒ **mỗi ngày một khối** (`KhoiNgay`, sang trang khi in), cuối phiếu có **Tổng cộng cả kỳ**. Đổi khoảng ngay trong phiếu bằng `DateRangeField` (không cần đóng). Chỉ render ngày **có dữ liệu**.

- **Chỉ đọc** — dựng lại từ dữ liệu đã nhập của ngày, không tạo/sửa bản ghi nào.
- Phạm vi = **ngày đang xem**, theo **phân xưởng đang lọc** (`Tất cả` ⇒ gộp cả ba xưởng như tờ giấy). **Bỏ qua** lọc đại lý / loại NL / đơn giá — phiếu là tổng hợp cả ngày.
- **Đổi ngày ngay trong phiếu**: ô "Ngày xem báo cáo" ở thanh công cụ (`.no-print`) đổi `ngayXem` (state nội bộ, khởi tạo theo ngày lọc ngoài màn) — xem/in nhiều ngày mà không thoát phiếu. Phân xưởng vẫn theo bộ lọc ngoài.
- Cột: STT · Tên đại lý · Loại NL · Số lượng · Đơn giá · Ghi chú (tài xế − biển số). **Gộp ô** STT + đại lý + ghi chú khi một đại lý có nhiều loại (gom theo `daiLy`). Dòng **TỔNG CỘNG** = tổng khối lượng. Khối **phụ phẩm** (nội tạng, dạt) từ `phe_lieu nguon="Nhập hàng"` để góc dưới.
- In ngang: dùng chung `.print-root` / `.no-print` với bảng cân đối, **thêm class `.print-landscape`** → `@page landscape { size: A4 landscape }` (trong `src/index.css`). Bảng cân đối không mang class này nên vẫn in dọc.

## Edge cases

| Tình huống | Hành vi đúng |
|---|---|
| Điền đầu chuyến rồi bỏ ngang | **Không có chuyến rỗng**: `chuyen_nhap` chỉ được tạo lúc thêm dòng hàng ĐẦU TIÊN. Thêm dòng nào lưu ngay dòng đó — "nháp" tức là đã lưu, hàng chờ lo phần mất mạng. |
| Dòng cũ không có `chuyenId` | `gomChuyen()` gom ngầm theo `(ngay + phanXuong + daiLy + taiXe + bienSoXe)`, khóa `ngam\|…`, gắn nhãn *"Dữ liệu cũ"*. **Không** chuyển đổi dữ liệu, **không** tự sinh `chuyen_nhap` cho chúng. |
| Ghi chuyến vào ngày đã chốt | Cho phép, nhưng bắt buộc lý do; toast cảnh báo *"đã chốt X kg — sau khi ghi bù thành Y kg"*. |
| Ghi xong chuyến ở ngày khác ngày đang lọc | Màn tự kéo bộ lọc về chuyến vừa ghi. (Trước đây bảng trống trơn, người dùng tưởng mất hàng.) |
| Đại lý / loại NL chưa có trong danh mục | Tạo ngay tại chỗ trong `Combobox`, **lưu luôn vào danh mục** + toast. Không để tên mồ côi. |
| Sổ lưu theo tên hay id? | **Theo TÊN** (`daiLy`, `loaiNL` là chuỗi) — dữ liệu cũ đọc được và sổ giữ nguyên tên tại thời điểm nhập. Đừng "chuẩn hóa" thành khóa ngoại. |
| Đơn giá null | Hợp lệ. Mọi nơi tính tiền phải `?? 0`; hiển thị là badge *"Chưa có giá"*, không phải `0 đ`. |
| Chốt ngày rồi mở lại rồi chốt lại | Cùng một bản ghi `chot_ngay`, `chotLuc` và `tongKgLucChot` cập nhật; `lyDoMoLai` của lần mở trước vẫn còn (chưa có lịch sử nhiều lần). |
| Xóa dòng | Qua `ConfirmDelete` + toast **Hoàn tác** (`persist(truoc)`). Không xóa cứng lặng lẽ. |

## Cross-references

- Kiểu + bất biến (`laGhiBu`, `thanhTien`, `ChotNgay`): `src/types.ts`
- Bảng & migration `0004`: [03-database.md](03-database.md)
- Cách ghi dữ liệu, hàng chờ: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- Phế liệu phía kỳ cân đối: [31-can-doi-ky.md](31-can-doi-ky.md)
- Nghiệp vụ gốc (Q21, sổ giấy, quy ước "80 trên/80 dưới"): [`docs/trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md`](../trien-khai/bang-cau-hoi-xac-nhan-truoc-plan.md)
