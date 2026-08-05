# CLAUDE.md — Baseafood MES

Hệ thống MES cho Xí nghiệp Baseafood BSF1 (Bà Rịa). **Repo mới, độc lập với SDFactory** (SDFactory chỉ là demo bán hàng — không kế thừa cấu trúc dữ liệu/phân quyền).

## Trọng tâm nghiệp vụ
Quản lý **nguyên liệu trong sản xuất** theo vòng lặp gối đầu (mua → sơ chế → cấp đông → tồn dự trữ → xả đông tái dùng kỳ sau), kéo theo tồn kho. Đau nhất: tồn nguyên liệu cuối kỳ sai do ghi chép tay → kế toán chốt số sai. Ba phân xưởng: Đông, Cá, Khô.

Nguồn phân tích: kế hoạch Tuần 1 + 2 record + 3 file Excel thật (danh mục 141 TP, báo cáo NL-BTP tháng, sổ nhập NL hàng ngày). Tài liệu ở repo SDFactory `docs/trien-khai/ke-hoach-tuan-1-thu-thap-du-lieu.md`.

## Người dùng
Phần lớn là tổ trưởng/thủ kho **45–60 tuổi**, dùng tablet ở xưởng lạnh, tay ướt, đeo kính lão. Giao diện tối ưu cho nhóm này — xem `src/design-system/README.md` (luật bắt buộc, bảng chọn component, checklist bàn giao).

## Cấu trúc
```
src/
├── data/thanh-pham.json     141 mã thành phẩm (TK 1551) — seed từ file kế toán
├── types.ts                 ThanhPham, DongNhapNL, MatHang, KhachHang, DaiLy, LoaiNguyenLieu, KyCanDoi…
├── lib/                     repo (tầng dữ liệu Supabase↔localStorage), danhMuc (hook từng bảng),
│                            format (vi-VN), db (bộ đệm cấp thấp), canDoi, supabase, store (newId), utils
├── components/ui/           primitive shadcn (style radix-nova) — ĐÃ đè size cho người lớn tuổi
├── design-system/
│   ├── tokens.css           NƠI DUY NHẤT định cỡ chữ / màu / chiều cao ô
│   ├── patterns/            Field, NumberField, Combobox, DateField, RecordTable, DanhMucCrud,
│   │                        ConfirmDelete, StepForm, ContextBar, ErrorSummary, EmptyState,
│   │                        CaiDatHienThi, TrangThaiDuLieu, notify, Logo
│   ├── kit/KitPage.tsx      trang duyệt bộ giao diện (đưa người dùng thật bấm thử)
│   └── index.ts             cửa import duy nhất cho features
├── features/                NhapNguyenLieu · CanDoi + BangCanDoi · DanhMuc (5 tab) · ThanhPham (141 mã, chỉ đọc)
└── App.tsx                  3 mục điều hướng: Nhập hàng · Cân đối · Danh mục
```

## Quy tắc code
1. TypeScript strict; function components.
2. Mọi khối lượng là **kg**; số hiển thị locale **vi-VN**, class `tnum` (tabular-nums).
3. Alias `@/*` → `src/*`.
4. Không xóa bản ghi nghiệp vụ — dùng trạng thái (bản sau); mọi xóa hiện tại đều qua `ConfirmDelete` + toast Hoàn tác.
5. **`src/features/**` chỉ import từ `@/design-system`.** Cấm import thẳng `@/components/ui/*`, cấm viết class cỡ chữ/mã màu tay — sửa `tokens.css` thay vì đè cục bộ.
6. Nhãn luôn hiện (không dùng placeholder thay nhãn); vùng chạm ≥ 44px; nút Lưu không bao giờ `disabled` (thiếu thì bắn `ErrorSummary`).
7. Danh mục thay nhập tự do: đại lý / loại NL / mặt hàng / khách hàng chọn qua `Combobox` (có tạo mới tại chỗ).
8. Brand `#17529c` rút từ logo Baseafood (`public/baseafood-logo.png`). Tailwind v4.
9. `npx shadcn add` **không chạy được** trên Windows (CLI quét ngược thư mục cha, đụng junction bị khóa quyền) — cách lấy component thủ công ghi trong `src/design-system/README.md`.

## Dữ liệu
Mọi màn đọc/ghi qua `src/lib/repo.ts` — **không** gọi localStorage trực tiếp. Chưa điền `.env` thì chạy localStorage; điền rồi thì chạy Supabase (URL/khóa lấy ở Dashboard, lọc theo `xi_nghiep_id` = `VITE_SITE_ID`).

**Đặt tên DB: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố** (`nhap_nguyen_lieu`, `so_luong_kg`). Cấm tên có dấu — Postgres bắt bọc nháy kép mọi nơi và dấu tiếng Việt có 2 dạng Unicode NFC/NFD trông giống hệt nhưng là 2 định danh khác nhau.

11 bảng: `xi_nghiep` · `dai_ly` · `loai_nguyen_lieu` · `thanh_pham` (141 mã, khóa chính là `ma`) · `mat_hang` · `khach_hang` · `nhap_nguyen_lieu` · `ky_can_doi` · `nguyen_lieu_vao` · `phe_lieu` · `thanh_pham_ra`. Migration `supabase/migrations/0001_baseafood_mes.sql`; `0002_go_bo_sdfactory.sql` gỡ 3 bảng cũ của SDFactory (**phá hủy, chạy thủ công**). Hướng dẫn: `docs/supabase-setup.md`.

`src/data/thanh-pham.json` giờ chỉ là **seed** cho bảng `thanh_pham`, không còn là nguồn đọc trực tiếp.

⚠️ RLS hiện mở cho `anon` (chưa có đăng nhập) → ai có anon key là sửa được số liệu. Chỉ chạy trong mạng nội bộ xí nghiệp. Trước khi mở ra ngoài: thêm đăng nhập rồi chạy `0003_siet_rls.sql`.

🔒 Không ghi project ref / URL / key vào bất kỳ file nào trong repo — `.env.example` để trống, `.env` đã gitignore.

## Trạng thái
- **Đã build**: nhập hàng (lọc ngày/khoảng ngày/xưởng/đại lý/loại), cân đối + in bảng, danh mục 5 tab, bộ giao diện cho người lớn tuổi + cài đặt hiển thị, tầng dữ liệu Supabase↔localStorage.
- **Backlog**: điền anon key + chạy migration, siết RLS theo người dùng, nhập khẩu số liệu cũ lên máy chủ, định mức NL→TP, báo cáo tháng 6 khối, vòng lặp đông gửi↔xả đông, tồn cuối kỳ, test thực địa với 5 người dùng ≥45 tuổi.

## Chạy
`npm run dev` (:5173) · `npm run build`
