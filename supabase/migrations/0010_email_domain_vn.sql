-- ============================================================
-- Baseafood MES — 0010: đổi đuôi email tổng hợp .local → .vn
--
-- 🔴 Đụng auth.users (tài khoản đang có). Chạy SAU khi deploy code đổi
--    DUOI_EMAIL = "@bsf1.vn" (src/lib/username.ts).
--
-- Vì sao: GoTrue chặn TLD dành riêng `.local` khi signUp ("Email address
-- <u>@bsf1.local is invalid") ⇒ admin KHÔNG tạo được tài khoản mới. Đổi toàn bộ
-- email tổng hợp sang `.vn` (TLD thật, hợp lệ). Tài khoản admin seed ở 0007 chèn
-- thẳng SQL nên đang mang `.local`; đổi ở đây để login (dẫn xuất email từ
-- username qua đuôi mới) khớp lại.
--
-- Chỉ ảnh hưởng các tài khoản đuôi `@bsf1.local` (thực tế chỉ có admin seed —
-- mọi signUp `.local` khác đều đã fail nên không tồn tại). Idempotent: chạy lại
-- không còn `.local` ⇒ không làm gì. KHÔNG đụng mật khẩu, KHÔNG reset
-- email_confirmed_at (update thẳng cột, không qua luồng đổi email của GoTrue).
--
-- Lùi (rollback) — chỉ khi buộc phải quay lại .local (sẽ lại vỡ signUp):
--   update auth.users
--     set email = regexp_replace(email, '@bsf1\.vn$', '@bsf1.local')
--     where email like '%@bsf1.vn';
--   update auth.identities
--     set identity_data = jsonb_set(identity_data, '{email}',
--       to_jsonb(regexp_replace(identity_data->>'email', '@bsf1\.vn$', '@bsf1.local')))
--     where identity_data->>'email' like '%@bsf1.vn';
-- ============================================================

update auth.users
  set email = regexp_replace(email, '@bsf1\.local$', '@bsf1.vn'),
      updated_at = now()
  where email like '%@bsf1.local';

update auth.identities
  set identity_data = jsonb_set(
        identity_data,
        '{email}',
        to_jsonb(regexp_replace(identity_data->>'email', '@bsf1\.local$', '@bsf1.vn'))
      ),
      updated_at = now()
  where identity_data->>'email' like '%@bsf1.local';
