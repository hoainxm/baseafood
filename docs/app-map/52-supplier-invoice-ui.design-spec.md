# 52 — design-spec: Nhập hàng · tab "Hóa đơn đại lý"

> Load khi: sửa giao diện phần gắn hóa đơn đại lý vào chuyến (tab "Hóa đơn" của Nhập hàng, nhãn trạng thái HĐ trên chuyến, ánh xạ mã kế toán). Hành vi ở ba-spec [51](51-supplier-invoice-matching.ba-spec.md).
covers: src/features/imports/SupplierInvoicePanel.tsx, src/features/imports/supplierInvoiceParts.tsx, src/features/imports/MaterialImportScreen.tsx, src/features/imports/importsTour.ts
last_verified: 2026-10-30
ttl_days: 90

> **Oracle giao diện** cho ba-spec 51. Luật UI chung: [`src/design-system/README.md`](../../src/design-system/README.md). Màn hình nằm TRONG Nhập hàng (không thêm mục menu): kế toán đã vào Nhập hàng để xem sổ, chứng từ nằm cạnh chuyến.

## 1. User-ladder
| Người | Thấy | Làm được |
|---|---|---|
| Kế toán, KTT, admin (`imports.invoices` Thêm/Sửa) | tab "Hóa đơn" + nhãn HĐ trên chuyến | nạp, ánh xạ, gắn, xử lệch, tạo chuyến từ HĐ, xếp "Không thuộc chuyến", mở file |
| BGĐ (`imports.invoices` Xem) | tab "Hóa đơn" chỉ đọc + nhãn | mở file |
| Tổ trưởng, thủ kho, quản đốc (không có `imports.invoices`) | **chỉ nhãn HĐ** trên chuyến ở sổ chi tiết + cột ngày | — |

## 2. Bố cục tab "Hóa đơn" (thứ ba, sau "Ghi nhập" · "Báo cáo")
Từ trên xuống, một cột:
1. **Thẻ số (`StatCardGrid`, 4 thẻ)** — chuyến Chờ HĐ · HĐ chưa có file · Lệch chưa xử · HĐ không có chuyến. Đếm theo **khoảng ngày hàng về** đang chọn (mặc định tháng hiện tại; ô `DateRangeField`/kỳ như Báo cáo). Bấm thẻ ⇒ lọc bảng dưới theo nhóm đó.
2. **Khối "Nạp sổ chi tiết + hóa đơn"** (`FormSection`): một ô chọn file nhận **nhiều file** (`.xlsx` sổ chi tiết + `.pdf` hóa đơn) — nhãn luôn hiện, dòng phụ "Chọn file Excel sổ chi tiết NL và các file PDF hóa đơn. Có thể nạp riêng PDF sau." Đọc xong hiện dòng tóm tắt: "Đọc 137 dòng / 64 hóa đơn · 12 PDF".
3. **Ánh xạ mã** (chỉ hiện khi có mã lạ): bảng hai cột "Mã kế toán · Đại lý trong danh mục" (và "Mã vật tư · Loại NL"). Mỗi ô là `Combobox` có **onCreate + bút chì** (luật 7, `useQuickCatalogEdit` với `suppliers` / `materialTypes` của màn). Gợi ý sẵn bằng tên/billingName gần nhất.
4. **Bảng xem trước** (`SummaryTable`, `groupBy` theo HĐ): cột Ngày hàng về · Loại · Kg · Đơn giá HĐ · Số chuyến (kg · giá) · Kết quả (`Tag`). Đầu nhóm: "HĐ 936 · Hồng Phú · phiếu 03/008/10 · 3 dòng" + cờ file + nhãn Mới/Đổi/Như cũ. Nút cuối khối: **"Gắn hóa đơn vào chuyến"** (`variant="save"`, không bao giờ disabled; chưa ánh xạ đủ ⇒ `ErrorSummary`).
5. **Bảng "Hóa đơn đã gắn"** (`SummaryTable rowMarkKey="supplier-invoices"`, sắp cột được): Số HĐ · Ký hiệu · Đại lý · Ngày lập · Ngày hàng về (khoảng) · Kg · Tiền hàng (ẩn khi không Xem giá) · Trạng thái · File. Dòng mở rộng (`groupBy` dòng HĐ) hiện từng dòng + thao tác.

### Thao tác trên dòng (chỉ người có Thêm/Sửa)
| Dòng ở trạng thái | Thao tác (`title` đủ) | Màu nút |
|---|---|---|
| Lệch giá / Lệch kg | "Cập nhật theo HĐ" · "Giữ số xưởng" (hộp nhỏ bắt lý do, `useDialogDraft`) | `edit` · `outline` |
| Không có chuyến | "Tạo chuyến từ HĐ" (hộp chọn phân xưởng, ngày hàng về + lý do xem trước) · "Không thuộc chuyến" | `save` · `outline` |
| Không thuộc chuyến | "Bỏ xếp" | `ghost` |
| Có file | "Mở file" | `ghost` |
| Chưa có file | ghi "Chưa có file — nạp PDF ở khối trên" | — |

Cập nhật theo HĐ ⇒ `notify.saved` + Hoàn tác (luật 13). Tạo chuyến ⇒ `notify.saved` có link "Xem chuyến".

## 3. Nhãn HĐ trên chuyến (mọi người xem Nhập hàng)
`Tag` nhỏ ở đầu chuyến trong **Sổ chi tiết các chuyến** và **cột "Đã ghi ngày"**: "Chờ HĐ" (muted) · "HĐ 936" (thành công) · "HĐ 936 · lệch" (cảnh báo) · "Thiếu HĐ một phần". Người không có `imports.invoices` chỉ thấy chữ, không có link mở file.

## 4. Trạng thái — chữ hiển thị (nguồn `SUPPLIER_INVOICE_LINE_STATE_LABELS`)
| Mã | Chữ | Tag |
|---|---|---|
| `matched` | Khớp | success |
| `price-mismatch` | Lệch giá | warning |
| `quantity-mismatch` | Lệch kg | warning |
| `no-trip` | Không có chuyến | danger |
| `not-trip` | Không thuộc chuyến | muted |
| `unmapped` | Chưa ánh xạ | muted |
| `updated` | Đã cập nhật theo HĐ | success |
| `explained` | Lệch đã giải trình | muted |

## 5. Hẹp (360px × 130%)
Thẻ số 2×2; bảng cuộn ngang trong `HorizontalScroll` (bảng chuẩn tự có thanh trên + dưới); nút thao tác xuống hàng dưới dòng; ô chọn file rộng hết.

## 6. Tour + hộp "?"
Thêm mốc `data-tour` cho tab "Hóa đơn", ô nạp file, bảng xem trước, bảng đã gắn. Hộp "?" giải thích **đủ 8 trạng thái §4**, điều kiện "xong" của một khoảng ngày (bốn thẻ số về 0), và nói rõ: hệ thống không tự đổi số chuyến; ghép theo "Ngày HĐ" = ngày hàng về.

## History
- v1 (2026-10-30): khởi tạo cùng build P1. Nhãn HĐ hiện ở **Sổ chi tiết các chuyến**; cột "Đã ghi ngày" của Ghi nhập CHƯA có nhãn (đợt sau). Ô chọn file là `Input type=file` nhiều file (chưa kéo thả).
