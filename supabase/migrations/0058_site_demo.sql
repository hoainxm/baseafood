-- ============================================================
-- Baseafood MES — 0058: SITE `site-demo` CHO CHẾ ĐỘ DEMO
--
-- ✅ ĐÃ CHẠY trên DB thật 2026-10-13.
-- 🟡 YELLOW — CHỈ THÊM một dòng vào `public.sites`. Không đổi bảng, cột, RLS hay
-- dữ liệu nào đang có. Chạy lại nhiều lần vẫn không lỗi (idempotent).
--
-- Vì sao: chế độ demo (docs/spec/che-do-demo.md, src/lib/cheDo.ts) ghi bộ số trình
-- diễn với `site_id = 'site-demo'`. Mọi bảng nghiệp vụ có `site_id ... references
-- public.sites(id)` ⇒ chưa có dòng này thì mọi lệnh ghi demo bị từ chối (23503),
-- đèn kết nối báo đỏ, số demo nằm chờ dưới máy — KHÔNG hỏng gì, chỉ chưa lên được.
--
-- An toàn số thật: dòng demo luôn có khóa chính tiền tố `demo:` (app tự thêm ở ranh
-- giới máy chủ) + `site_id = 'site-demo'`; app đọc/ghi/xóa đều lọc `site_id`. Truy
-- vấn SQL tay để báo cáo số THẬT phải thêm `where site_id = '<site thật>'`.
--
-- Bảng `sites` (0001 tạo tên `xi_nghiep`, 0016 đổi tên) có cột mã NOT NULL UNIQUE —
-- tên cột tùy DB (`ma` hay `code`) nên dò trước khi chèn.
--
-- LÙI (chỉ khi đã xóa hết số demo — còn dòng nào trỏ tới thì FK chặn, không mất gì):
--   delete from public.sites where id = 'site-demo';
-- ============================================================

do $$
begin
  if exists (select 1 from public.sites where id = 'site-demo') then
    return;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'sites' and column_name = 'ma') then
    insert into public.sites (id, ma, name)
    values ('site-demo', 'DEMO', 'Dữ liệu trình diễn (chế độ demo)')
    on conflict (id) do nothing;
  elsif exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'sites' and column_name = 'code') then
    insert into public.sites (id, code, name)
    values ('site-demo', 'DEMO', 'Dữ liệu trình diễn (chế độ demo)')
    on conflict (id) do nothing;
  else
    insert into public.sites (id, name)
    values ('site-demo', 'Dữ liệu trình diễn (chế độ demo)')
    on conflict (id) do nothing;
  end if;
end $$;

-- KIỂM SAU KHI CHẠY (phải ra 1 dòng):
--   select id, name from public.sites where id = 'site-demo';
