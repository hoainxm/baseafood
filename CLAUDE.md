# CLAUDE.md — Baseafood MES

Hệ thống MES cho Xí nghiệp Baseafood BSF1 (Bà Rịa). **Repo mới, độc lập với SDFactory** (SDFactory chỉ là demo bán hàng — không kế thừa cấu trúc dữ liệu/phân quyền).

## Trọng tâm nghiệp vụ
Quản lý **nguyên liệu trong sản xuất** theo vòng lặp gối đầu (mua → sơ chế → cấp đông → tồn dự trữ → xả đông tái dùng kỳ sau), kéo theo tồn kho. Đau nhất: tồn nguyên liệu cuối kỳ sai do ghi chép tay → kế toán chốt số sai. Ba phân xưởng: Đông, Cá, Khô.

Nguồn phân tích: kế hoạch Tuần 1 + 2 record + 3 file Excel thật (danh mục 141 TP, báo cáo NL-BTP tháng, sổ nhập NL hàng ngày). Tài liệu ở repo SDFactory `docs/trien-khai/ke-hoach-tuan-1-thu-thap-du-lieu.md`.

## Cấu trúc
```
src/
├── data/thanh-pham.json     141 mã thành phẩm (TK 1551) — seed từ file kế toán
├── types.ts                 ThanhPham, DongNhapNL, PhanXuong
├── lib/                     format (vi-VN), store (localStorage), supabase (env-gated), utils (cn)
├── components/ui.tsx        primitive kiểu shadcn (Button/Input/Select/Card/Badge/Label)
├── features/                ThanhPham (danh mục), NhapNguyenLieu (nhập hàng ngày)
└── App.tsx                  layout + điều hướng
```

## Quy tắc code
1. TypeScript strict; function components.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN**, class `tnum` (tabular-nums).
3. Alias `@/*` → `src/*`.
4. Không xóa bản ghi nghiệp vụ — dùng trạng thái (bản sau); hiện `remove` chỉ dùng khi sửa nháp.
5. Token màu: brand cyan-700. Tailwind v4 (`@import "tailwindcss"` trong `index.css`).

## Trạng thái
- **Đã build**: danh mục thành phẩm, nhập nguyên liệu hàng ngày (localStorage).
- **Backlog**: định mức NL→TP, báo cáo tháng 6 khối, vòng lặp đông gửi↔xả đông, tồn cuối kỳ, danh mục NL/đại lý, cutover Supabase.

## Chạy
`npm run dev` (:5173) · `npm run build`
