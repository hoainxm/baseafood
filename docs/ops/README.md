> Load khi: cài đặt, deploy, đổi cấu hình hệ thống, hoặc tiếp nhận dự án cần dựng bản chạy.

# Ops — Vận hành & Triển khai

Mọi việc **ngoài code**: cài đặt hạ tầng, deploy, cấu hình môi trường, cutover dữ liệu.
Khác với [`app-map/`](../app-map/README.md) (đọc khi *viết code*) — thư mục này đọc khi *đưa app lên chạy*.

| File | Nội dung |
|---|---|
| [supabase-setup.md](supabase-setup.md) | Cutover Supabase: schema, lấy URL/key, `.env`, RLS, tầng repo local↔server |
| [deploy-vercel.md](deploy-vercel.md) | Deploy Vercel từ đầu: 2 repo đồng bộ, env, Supabase Auth URL, kiểm tra |

Doc ops mới (backup, CI, monitoring, domain…) bỏ vào đây; đặt tên `<chủ-đề>.md` (không cần đánh số).
