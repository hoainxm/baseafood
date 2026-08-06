> Load khi: thêm file mới, không biết đặt ở đâu, hay chuẩn bị import xuyên tầng.
covers: src/**
last_verified: 2026-08-06
ttl_days: 90

# Cấu trúc mã nguồn

```
src/
├── main.tsx                 điểm vào; nạp index.css + apDungCaiDatHienThi() TRƯỚC khi vẽ (tránh nhảy cỡ chữ)
├── App.tsx                  điều hướng 3 màn (xem 02-pages-navigation.md)
├── types.ts                 KIỂU + BẤT BIẾN nghiệp vụ (laGhiBu, thanhTien) — không phải file kiểu thuần
├── data/thanh-pham.json     141 mã TK 1551 — chỉ là SEED, không đọc trực tiếp trong màn
├── lib/
│   ├── repo.ts              tầng dữ liệu (Supabase↔localStorage) — 04-tang-du-lieu.md
│   ├── danhMuc.ts           hook từng bảng (useNhapNL, useKyCanDoi…) + seed
│   ├── db.ts                bộ đệm localStorage cấp thấp — MÀN HÌNH KHÔNG GỌI
│   ├── supabase.ts          client env-gated + SITE_ID
│   ├── ketNoi.ts            trạng thái kết nối dùng chung (đèn xanh/đỏ)
│   ├── canDoi.ts            công thức cân đối thuần — 31-can-doi-ky.md
│   ├── format.ts            num/kg/todayISO/viDate (locale vi-VN)
│   ├── store.ts             newId()
│   └── utils.ts             cn()
├── components/ui/           primitive shadcn (style radix-nova), ĐÃ đè size cho người lớn tuổi
├── design-system/           bộ giao diện — luật ở src/design-system/README.md
│   ├── tokens.css           NƠI DUY NHẤT định cỡ chữ / màu / chiều cao ô
│   ├── patterns/            Field, NumberField, Combobox, DateField, RecordTable, DanhMucCrud…
│   ├── kit/KitPage.tsx      trang duyệt bộ giao diện (đưa người dùng thật bấm thử)
│   └── index.ts             cửa import DUY NHẤT cho features
└── features/                5 màn nghiệp vụ (NhapNguyenLieu · CanDoi + BangCanDoi · DanhMuc · ThanhPham)
```

## Ranh giới import (cứng)

```
features → design-system → components/ui → tokens.css
features → lib/danhMuc → lib/repo → lib/db + lib/supabase
```

- `src/features/**` **chỉ** import từ `@/design-system`. Cấm `@/components/ui/*` trực tiếp — hook pre-commit chặn.
- `src/features/**` **không** gọi `localStorage`, không gọi `supabase` trực tiếp; luôn qua hook trong `lib/danhMuc.ts`.
- `lib/db.ts` chỉ có `repo.ts` được gọi.
- Alias `@/*` → `src/*` (`tsconfig.app.json` + `vite.config.ts`) — dùng alias, không dùng đường dẫn tương đối dài.

## Hai ngoại lệ, đừng lấy làm mẫu

| File | Vì sao ngoại lệ |
|---|---|
| `src/features/BangCanDoi.tsx` | Bản in theo mẫu giấy A4 — cố tình dùng `text-sm`, `uppercase`, màu `slate` cứng. Luật design-system KHÔNG áp vào đây. |
| `src/components/ui/**` | Tầng primitive, được phép viết class cỡ chữ/màu. Sửa size ở đây khi thêm component mới (mặc định shadcn `h-8`/`h-9` là quá nhỏ). |

## Nơi hay đặt sai

- Công thức nghiệp vụ mới → `src/lib/*.ts` thuần, không nhét vào component (xem `canDoi.ts` làm mẫu: không import React).
- Bất biến nghiệp vụ dùng ở ≥2 màn (`laGhiBu`, `thanhTien`) → `src/types.ts`, cạnh interface nó ràng buộc.
- Pattern UI mới → `design-system/patterns/` + export ở `design-system/index.ts`; **không** viết component dùng chung trong `features/`.
- Hai file sinh id: `lib/db.ts#uid` và `lib/store.ts#newId` — **cùng thuật toán, trùng nhau**. Dùng lại cái file bên cạnh đang dùng; đừng thêm cái thứ ba (cần dọn, chưa dọn).

## Cross-references

- Luật UI + bảng chọn component: [`src/design-system/README.md`](../../src/design-system/README.md)
- Điều hướng: [02-pages-navigation.md](02-pages-navigation.md)
- Tầng dữ liệu: [04-tang-du-lieu.md](04-tang-du-lieu.md)
