-- ============================================================
-- Baseafood MES — 0006: hồ sơ người dùng + vai trò (đăng nhập)
--
-- Chạy SAU 0001. An toàn với dữ liệu đang có (chỉ THÊM bảng). Chạy lại nhiều
-- lần vẫn không lỗi.
--
-- Tài khoản đăng nhập (email + mật khẩu) do Supabase Auth quản lý — TẠO Ở
-- DASHBOARD (Auth → Add user), email dạng `<username>@bsf1.local`. Bảng này chỉ
-- giữ HỒ SƠ nghiệp vụ (họ tên, username, vai trò), khóa chính `id` = auth user
-- id. App tự upsert hồ sơ lần đầu đăng nhập; admin gán vai trò.
--
-- ⚠️ RLS vẫn MỞ (anon + authenticated) như 0001 — app chưa siết. `0003` siết
-- toàn hệ sang `authenticated` SAU khi đăng nhập chạy ổn (đừng chạy 0003 trước).
--
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

create table if not exists public.nguoi_dung (
  id           text primary key,                     -- = auth.users.id (uuid dạng text)
  xi_nghiep_id text not null default 'bsf1' references public.xi_nghiep(id),
  ho_ten       text not null default '',
  username     text not null default '',
  vai_tro      text not null default ''
    check (vai_tro in ('', 'admin', 'giam-doc', 'ke-toan', 'to-truong')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists nguoi_dung_username_idx
  on public.nguoi_dung (xi_nghiep_id, username);

-- updated_at + RLS (mở như 0001; siết ở 0003)
do $$
begin
  drop trigger if exists nguoi_dung_sua on public.nguoi_dung;
  create trigger nguoi_dung_sua before update on public.nguoi_dung
    for each row execute function public.cap_nhat_thoi_diem_sua();

  alter table public.nguoi_dung enable row level security;
  drop policy if exists nguoi_dung_toan_quyen on public.nguoi_dung;
  create policy nguoi_dung_toan_quyen on public.nguoi_dung
    for all to anon, authenticated using (true) with check (true);
end $$;

-- ============================================================
-- SEED admin đầu tiên:
--   1. Trong Supabase: Authentication → Providers → Email → TẮT "Confirm email"
--      (email tổng hợp @bsf1.local không nhận được mail xác nhận).
--   2. Mở app → "Chưa có tài khoản? Đăng ký": họ tên = Admin, tên đăng nhập =
--      admin, mật khẩu. (Hoặc Dashboard → Auth → Add user: admin@bsf1.local.)
--   3. Gán vai trò admin (SQL Editor):
--        update public.nguoi_dung set vai_tro = 'admin', ho_ten = 'Admin'
--        where username = 'admin';
--   4. Đăng xuất/đăng nhập lại → thấy nav "Người dùng", gán vai trò cho user khác.
-- ============================================================
