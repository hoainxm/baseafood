> Load khi: deploy app lên Vercel, đổi env production, nối repo cá nhân, hoặc người mới tiếp nhận cần dựng bản chạy thật.
covers: index.html, package.json, vite.config.ts, src/lib/supabase.ts
last_verified: 2026-08-10
ttl_days: 90

# Deploy Vercel — Baseafood MES

Hướng dẫn dựng bản chạy thật trên Vercel từ đầu. Dành cho người tiếp nhận dự án.

Nối cutover Supabase (URL/key/RLS): [`supabase-setup.md`](supabase-setup.md).

## Bức tranh tổng

- App là **Vite SPA** (React 19). Build ra thư mục tĩnh `dist/`, Vercel serve tĩnh — không có server runtime.
- Điều hướng bằng **HashRouter** (`#/...`) ⇒ **không cần** `vercel.json` rewrite; refresh route sâu không 404.
- Vercel **auto-detect preset Vite**: build `npm run build`, output `dist`. Không cần file cấu hình.
- Biến `VITE_*` được **nhúng lúc build** vào bundle ⇒ phải set env **trước** khi deploy; đổi env sau phải **redeploy**.

## Kiến trúc 2 repo (đồng bộ commit)

`origin` cấu hình **2 push URL**: mỗi `git push` đẩy cùng lúc lên repo công ty + repo cá nhân. Vercel theo dõi repo cá nhân.

```
origin  fetch → github.com/sdvico/baseafood        (repo công ty, nguồn thật)
origin  push  → github.com/sdvico/baseafood
              + github.com/hoainxm/baseafood        (repo cá nhân → Vercel build)
```

Xem/khôi phục cấu hình:
```bash
git remote -v                       # kiểm 2 dòng push
# gỡ push repo cá nhân nếu cần:
git remote set-url --delete --push origin https://github.com/hoainxm/baseafood.git
```

## Các bước deploy lần đầu

### 1. Đẩy code lên repo cá nhân
```bash
git push
```
Lần đầu tạo nhánh `main` trên repo cá nhân (đang trống). Kiểm: mở repo trên GitHub thấy code.

### 2. Import project vào Vercel
1. [vercel.com/new](https://vercel.com/new) → **Add New → Project** → nối GitHub.
2. Chọn repo cá nhân `hoainxm/baseafood`.
3. Vercel auto-detect **Vite**. Giữ nguyên: Build `npm run build` · Output `dist` · Install `npm install`.
4. **Đừng bấm Deploy vội** — set env ở bước 3 trước.

### 3. Environment Variables (BẮT BUỘC trước build)
Màn Import (hoặc **Settings → Environment Variables**), scope **Production** (+ Preview nếu muốn):

| Key | Value | Lấy ở |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key | Supabase → Settings → API |
| `VITE_SITE_ID` | `bsf1` | khớp `xi_nghiep.id` (migration 0001) |

> 🔴 **KHÔNG** thêm `service_role` key. Mọi biến `VITE_*` lộ ra bundle trình duyệt — ai mở DevTools cũng đọc được. Chỉ dùng anon key.
> Để trống `VITE_SUPABASE_ANON_KEY` → app tự chạy localStorage, không nối Supabase.

### 4. Deploy
Bấm **Deploy** (~1–2 phút) → có URL `baseafood-xxx.vercel.app`.

### 5. Cho phép domain Vercel ở Supabase (login mới chạy)
App dùng Supabase Auth. **Supabase → Authentication → URL Configuration**:
- **Site URL**: `https://baseafood-xxx.vercel.app`
- **Redirect URLs**: thêm `https://baseafood-xxx.vercel.app/**`

Bỏ bước này → đăng nhập trên bản deploy lỗi redirect. Giữ `localhost:5173` trong list để dev local vẫn login được.

## Kiểm tra sau deploy

- [ ] Tab trình duyệt hiện **logo Baseafood** (không phải trái tim tím — favicon cũ đã bỏ).
- [ ] Đăng nhập được (admin/admin nếu đã seed `0007` — **đổi mật khẩu ngay**).
- [ ] Ghi thử 1 chuyến nhập → reload → số liệu còn (đã lên Supabase, không phải localStorage).
- [ ] F12 → Console không đỏ; Network `/favicon.png` trả 200.

## Vòng lặp về sau (tự động)

```
git push  →  đẩy cả 2 repo  →  Vercel thấy commit repo cá nhân  →  auto build + deploy
```
Không thao tác thêm. Mỗi branch/PR khác sinh **Preview deploy** riêng.

## Cấu hình đáng nhớ

| Mục | Giá trị | Vì sao |
|---|---|---|
| `vercel.json` | **không có** | HashRouter không cần rewrite; Vite preset lo build |
| Node | mặc định Vercel (22) | hợp Vite 8, không cần pin `engines` |
| Env timing | build-time | đổi env ⇒ **Redeploy**, không nóng |
| Favicon | `public/favicon.png` + `?v=2` trong [`index.html`](../../index.html) | cache-bust; đã bỏ `favicon.svg` rác template |

## Custom domain (tùy chọn)

Vercel → project → **Settings → Domains** → add domain → trỏ DNS theo hướng dẫn.
Sau đó cập nhật lại **Site URL** ở Supabase (bước 5) sang domain thật.
