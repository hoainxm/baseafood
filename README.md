# Baseafood MES — Quản lý nguyên liệu & sản xuất

Hệ thống số hóa quản lý nguyên liệu và sản xuất cho Xí nghiệp Baseafood BSF1 (Bà Rịa).
Repo **mới, độc lập** — không liên quan tới bản demo SDFactory.

## Trọng tâm
Quản lý nguyên liệu trong sản xuất (vòng lặp sơ chế → cấp đông → tái sử dụng qua các kỳ),
kéo theo tồn kho. Xem phân tích nghiệp vụ đầy đủ ở kế hoạch Tuần 1 (repo tài liệu SDFactory,
`docs/trien-khai/ke-hoach-tuan-1-thu-thap-du-lieu.md`).

## Đã build (đợt 1 — master data + nhập liệu)
- **Danh mục thành phẩm**: 141 mã nạp từ danh mục kế toán (tài khoản 1551), tìm kiếm + lọc theo nhóm.
- **Nhập nguyên liệu hàng ngày**: form theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày"
  (đại lý · loại NL · kg · đơn giá · tài xế · biển số xe), danh sách theo ngày + phân xưởng, tổng ngày.

## Chưa build (chờ khảo sát thực địa)
- Định mức nguyên liệu → thành phẩm (tỷ lệ thu hồi).
- Báo cáo tháng 6 khối (mua · tồn · xả đông · đông gửi · BTP xưởng Đông · BTP xưởng Cá).
- Vòng lặp gối đầu (đông gửi ↔ xả đông) và tồn cuối kỳ.
- Danh mục nguyên liệu chuẩn hóa; danh mục đại lý/khách hàng.

## Tech stack
React + Vite + TypeScript + Tailwind v4 + primitive kiểu shadcn. Supabase env-gated
(giai đoạn đầu chạy localStorage, cutover sau).

## Chạy
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Cấu hình Supabase (khi cutover): sao chép `.env.example` thành `.env`, điền URL + anon key.
