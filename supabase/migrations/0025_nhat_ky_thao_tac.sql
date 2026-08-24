-- ============================================================
-- Baseafood MES — 0025: Nhật ký thao tác (audit log) — CHỈ THÊM (append-only)
--
-- Vì sao: cần lưu vết ai · khi · sửa gì trên sổ sách (thêm/sửa/xóa bản ghi,
-- đăng nhập/xuất). App bắt tại chốt useBang (repo.ts) rồi đẩy vào bảng này.
--
-- BẤT BIẾN nghiệp vụ: nhật ký KHÔNG được sửa/xóa (nếu không thì vết mất giá
-- trị truy trách nhiệm). Vì vậy:
--   • RLS: authenticated chỉ INSERT + SELECT; KHÔNG có policy update/delete.
--   • SELECT chỉ cho ADMIN (đọc vai trò từ user_profiles).
--   • REVOKE update, delete ở tầng quyền (chặt hơn cả policy).
--
-- ⚠️ KHÔNG đưa audit_log vào vòng lặp siết của 0021 — 0021 tạo policy `for all`
-- sẽ MỞ update/delete cho authenticated, phá tính append-only. Bảng này tự giữ
-- policy riêng ở đây.
--
-- Mức độ rủi ro: 🟡 YELLOW — chỉ thêm bảng. Chạy SAU 0006 (cần user_profiles
-- cho policy đọc vai trò). Idempotent. Câu lùi ở khối ROLLBACK cuối file.
-- ============================================================

create table if not exists public.audit_log (
  id             text primary key,
  site_id        text not null default 'bsf1' references public.sites(id),
  at             timestamptz not null default now(),
  actor_id       text not null default '',
  actor_username text not null default '',
  action         text not null default '',   -- them | sua | xoa | dang-nhap | dang-xuat
  entity         text not null default '',   -- tên bảng, hoặc 'auth'
  entity_key     text not null default '',
  summary        text not null default '',
  diff           jsonb,
  device_id      text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists audit_log_at_idx on public.audit_log (site_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (site_id, actor_username, at desc);
create index if not exists audit_log_entity_idx on public.audit_log (site_id, entity, at desc);

alter table public.audit_log enable row level security;

-- Ghi: mọi tài khoản đã đăng nhập được INSERT (append-only).
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check ((select auth.uid()) is not null);

-- Đọc: chỉ ADMIN (đọc vai trò CSV từ user_profiles — khớp token 'admin' trọn vẹn).
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = (select auth.uid())::text
        and up.roles ~ '(^|,)\s*admin\s*(,|$)'
    )
  );

-- KHÔNG có policy update/delete ⇒ RLS chặn. Chặn thêm ở tầng quyền cho chắc.
revoke update, delete on public.audit_log from authenticated;
revoke all on public.audit_log from anon;
grant insert, select on public.audit_log to authenticated;

-- ============================================================
-- ROLLBACK — chép ra, bỏ comment để lùi 0025
--
-- DROP TABLE IF EXISTS public.audit_log;
-- ============================================================
