> Load khi: sửa danh mục (đại lý, loại NL, mặt hàng, khách hàng) hay danh mục 141 mã thành phẩm.
covers: src/features/catalog/CatalogScreen.tsx, src/features/catalog/FinishedGoodScreen.tsx, src/data/thanh-pham.json, src/design-system/patterns/CatalogCrudModal.tsx
last_verified: 2026-08-26
ttl_days: 90
<!-- updated: 2026-08-26 — tab Mặt hàng thêm 2 thuộc tính cho màn ghi thành phẩm /wip (migration 0031): split_components (ChoiceGroup "Có tách/Không tách" — mã cắt chần tách râu+bao tử cùng giá) + block_spec_kg (NumberField kg/khối). GỘP 1 danh sách LOÀI chuẩn: types.ts CATEGORIES thêm "Bào ngư", BỎ NHOM_TP — tab Mặt hàng + tab Loại NL dùng chung CATEGORIES (trước lệch: Mặt hàng có Bào ngư thiếu Ghẹ, Loại NL ngược lại). Màn /wip GOM THEO LOÀI (products.category có sẵn trên 141 mã), KHÔNG theo loại NL. Xem 34-btp-san-xuat-kho.ba-spec.md. -->
<!-- updated: 2026-08-23 — mat_hang thêm facet processing_type (kiểu chế biến, 0024); combobox "Kiểu chế biến" ở tab Mặt hàng -->
<!-- updated: 2026-08-07 — đại lý thêm tenGhiPhieu/diaChi/cmnd/ngayCap/noiCap (migration 0009) -->
<!-- re-verified: 2026-08-14 — đồng bộ tên file sau rename eadc360: patterns/CatalogCrudModal.tsx + FinishedGoodScreen.tsx (symbol DanhMucCrud giữ nguyên) -->

<!-- updated: 2026-08-17 — 0019 tách size bạch tuộc 2 da: 'Bạch tuộc 2 da' → 'Bạch tuộc 2 da lớn (80↑)' + thêm 'Bạch tuộc 2 da nhỏ (80↓)'. '1 da' KHÔNG tách. Kỳ cân đối gom theo HỌ tên (hoNguyenLieu) nên vẫn thấy cả hai size. -->

# Danh mục (master data)

Một màn, **5 tab**: Mặt hàng · Khách hàng · Đại lý · Loại nguyên liệu · Thành phẩm (141 mã).
Gộp làm một vì ba mục điều hướng cũ có tên gần giống nhau — người dùng 45–60 tuổi phải nhớ cái nào ở đâu.

## State hiện tại

4 tab đầu dùng chung pattern `DanhMucCrud` (thêm/sửa/xóa/tìm). Tab thứ 5 (`FinishedGoodScreen.tsx`) **chỉ đọc** — 141 mã kế toán TK 1551.

## Logic / Rules

- **Đại lý (đầu vào) ≠ khách hàng (đầu ra).** Hai danh mục tách riêng, không gộp. Đại lý cung cấp NL; khách hàng mua TP (có `thiTruong`: Nhật / EU / Nội địa…).
- **Đại lý có 2 tên:** `ten` = biệt danh gọi tắt trên sổ (VD "Hồng Phú", "mậu"); `tenGhiPhieu` = tên đầy đủ ghi hóa đơn/phiếu (VD "Công ty TNHH TM Hồng Phú"). Kèm `diaChi`, `cmnd` (CMND/CCCD người đại diện hoặc MST công ty), `ngayCap`, `noiCap` — thông tin lập phiếu. Lưu qua migration `0009`; `repo.ts` chỉ gửi cột mới khi có giá trị ⇒ đại lý ghi được **kể cả khi chưa chạy 0009**. Sổ nhập vẫn lưu theo `ten` (biệt danh), không hồi tố khi sửa.
- **`thanh_pham` khóa chính là `ma`**, không phải `id` sinh tự động (`AnhXaBang.khoaChinh = "ma"`). Mã kế toán là danh tính thật của bản ghi.
- **`mat_hang` có cột `loai` (loài)** + **nạp sẵn từ 141 thành phẩm** (`seedMatHang` khi mat_hang rỗng, mỗi mặt hàng gắn `loai` = nhóm 141, `maTP` = mã 141). Nhờ đó ghi sản lượng / cân đối / bán hàng có sẵn danh sách thành phẩm để chọn, **lọc theo loài** (bảng cân đối thường 1 loài). Migration `0014` thêm cột + nạp server. `mat_hang.loaiNLId` (khóa chính loại NL, migration `0015`) = thành phẩm **thuộc loại nguyên liệu nào** (VD "Bạch tuộc 2 da"), TRỐNG trên 141 mã seed (chỉ gán tay khi cần) — giữ cho các dùng khác, **KHÔNG** phải cấp gom màn ghi thành phẩm. Màn Sản xuất thành phẩm `/wip` **gom theo LOÀI** (`category`, có sẵn trên mọi mã) — xem [34-btp](34-btp-san-xuat-kho.ba-spec.md). Mô hình: **thành phẩm đã gồm quy cách/size trong tên** (VD "2 râu cắt sống 18-20" của loại NL Bạch tuộc 2 da) — màn Sản xuất BTP **bỏ ô quy cách riêng**. **Facet thứ 3 — `processing_type` (kiểu chế biến: luộc/chần/cắt/tẩm bột…), migration `0024`** — combobox "Kiểu chế biến" ở tab Mặt hàng (danh mục mở, thêm tại chỗ), tách kiểu chế biến ra khỏi tên; xem [spec/bo-quy-cach-che-bien-thanh-pham.md](../spec/bo-quy-cach-che-bien-thanh-pham.md).
- `src/data/thanh-pham.json` **chỉ là SEED** cho bảng `thanh_pham`, nạp lần đầu khi cả server lẫn local đều rỗng. **Không đọc trực tiếp file này trong màn** — nguồn thật là bảng.
- `mat_hang.maTP` ánh xạ **lỏng** sang `thanh_pham.ma`: được phép rỗng ("Chưa ánh xạ"). Mặt hàng thực tế chưa khớp hẳn 141 mã — danh mục mặt hàng là **danh mục mở**.
- `loai_nguyen_lieu` = quy cách/size ("2 da nguyên liệu", "Mực ống 7cm"), có trường `loai` = **loài** (Bạch tuộc / Mực / Cá…). Có danh mục để chống mỗi lần gõ một kiểu → tổng hợp cuối kỳ mới đúng.
- Sổ nghiệp vụ lưu **TÊN** chứ không phải id của danh mục (xem [30-nhap-hang.md](30-nhap-hang.md)). ⇒ **Đổi tên một đại lý KHÔNG hồi tố** vào các dòng đã ghi. Đó là chủ ý (sổ giữ nguyên tên tại thời điểm nhập), không phải bug.
- Mọi màn nghiệp vụ đều **tạo mới tại chỗ** được từ `Combobox` và phải lưu ngay vào danh mục — không để tên mồ côi ngoài danh mục.
- Quy ước ngầm của xưởng, giữ khi thiết kế: NL không ghi loài ⇒ mặc định **bạch tuộc**; "80 trên" = lớn, "80 dưới" = nhỏ (mốc ~80 g/con), định giá khác nhau.

## Edge cases

| Tình huống | Hành vi đúng |
|---|---|
| Xóa một đại lý đang có trong sổ nhập | Dòng sổ **không đổi** (lưu theo tên). Không có cascade, không cảnh báo — chấp nhận, vì sổ phải giữ nguyên. |
| Thành phẩm 141 mã | Chỉ đọc trong app. Sửa danh mục kế toán ⇒ sửa `src/data/thanh-pham.json` **và** cập nhật bảng `thanh_pham` trên server (seed không chạy lại khi bảng đã có dữ liệu). |
| Thêm trường cho một danh mục | Sửa `types.ts` → `AnhXaBang.toRow/fromRow` (+ `vaDongCu`) → migration cột → mảng `TruongDanhMuc` của tab. Thiếu bước nào cũng ra dữ liệu cụt. |
| Xóa bản ghi danh mục | Qua `ConfirmDelete` + toast Hoàn tác. |

## Cross-references

- Ánh xạ DB & seed: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- Bảng `thanh_pham`, `mat_hang`, `dai_ly`, `khach_hang`, `loai_nguyen_lieu`: [03-database.md](03-database.md)
- Nơi danh mục được tiêu thụ: [30-nhap-hang.md](30-nhap-hang.md) · [31-can-doi-ky.md](31-can-doi-ky.md)
- Pattern CRUD dùng chung: [`src/design-system/README.md`](../../src/design-system/README.md)
