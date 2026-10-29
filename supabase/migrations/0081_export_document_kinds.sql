-- ============================================================
-- Baseafood MES — 0081: DANH MỤC LOẠI CHỨNG TỪ XUẤT KHẨU (thêm / sửa ngay trong ô chọn)
--
-- Vì sao (2026-10-29, ba-spec 41 §0b): "Loại chứng từ" (Commercial Invoice, Packing List, B/L,
-- H/C, C/O…) viết cứng trong code (`DOCUMENT_KINDS`, lib/exportPlanning.ts) — khách đòi loại mới
-- (VD giấy chứng nhận Halal, phiếu kiểm dư lượng) thì phải nhờ sửa code. Bảng này cho Nhân viên
-- Kế hoạch thêm / đổi tên ngay trong ô chọn (giống mặt hàng, khách hàng) và ở Danh mục.
--
-- Làm gì — bảng MỚI `export_document_kinds` (`id` · `site_id` · `name` · `sort_order` · `note`):
--   - Dòng có `id` trùng loại HỆ THỐNG (`commercial-invoice`, `bill-of-lading`…) = ĐỔI TÊN HIỂN THỊ
--     loại đó; luật riêng của loại (CI bắt kg / tiền, B/L bắt ngày on board, bảo hiểm khi CIF/CIP)
--     gắn theo `id` nên không đổi.
--   - Dòng `id` khác = loại TỰ THÊM, luật như "Chứng từ khác" (số + ngày + file).
--   Chứng từ đã ghi (`export_step_items.doc_kind`, điều khoản HĐ) lưu `id` ⇒ đổi tên không tách sổ.
-- RLS theo phân quyền Xuất khẩu (`has_export_permission`, 0075): đọc = `export-plans` xem; thêm /
-- sửa = `export-plans` thêm hoặc sửa (app ghi bằng upsert ⇒ cần cả update); xóa = `export-plans` xóa.
-- KHÔNG đổi bảng / cột / policy nào đang có. Chỉ thêm. Idempotent.
-- ⚠ Chưa chạy ⇒ app tự tắt thêm / sửa loại chứng từ (ô chọn vẫn đủ 10 loại hệ thống), không kẹt hàng chờ.
-- ROLLBACK cuối file.
-- ============================================================

create table if not exists public.export_document_kinds (
  id          text primary key,
  site_id     text not null default 'bsf1' references public.sites(id),
  name        text not null default '',
  sort_order  integer not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists export_document_kinds_site_idx on public.export_document_kinds (site_id);

drop trigger if exists export_document_kinds_touch_updated_at on public.export_document_kinds;
create trigger export_document_kinds_touch_updated_at
  before update on public.export_document_kinds
  for each row execute function public.cap_nhat_thoi_diem_sua(); -- naming-ok: hàm 0001

alter table public.export_document_kinds enable row level security;
drop policy if exists export_document_kinds_select on public.export_document_kinds;
drop policy if exists export_document_kinds_insert on public.export_document_kinds;
drop policy if exists export_document_kinds_update on public.export_document_kinds;
drop policy if exists export_document_kinds_delete on public.export_document_kinds;
create policy export_document_kinds_select on public.export_document_kinds for select to authenticated
  using (public.has_export_permission('export-plans', 'view'));
create policy export_document_kinds_insert on public.export_document_kinds for insert to authenticated
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_document_kinds_update on public.export_document_kinds for update to authenticated
  using (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'))
  with check (public.has_export_permission('export-plans', 'create') or public.has_export_permission('export-plans', 'update'));
create policy export_document_kinds_delete on public.export_document_kinds for delete to authenticated
  using (public.has_export_permission('export-plans', 'delete'));

revoke all on public.export_document_kinds from anon;
grant select, insert, update, delete on public.export_document_kinds to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'ghi_vet_sua_truc_tiep') then -- naming-ok: hàm 0048
    execute 'drop trigger if exists export_document_kinds_sql_audit on public.export_document_kinds';
    execute 'create trigger export_document_kinds_sql_audit after insert or update or delete on public.export_document_kinds
             for each row execute function public.ghi_vet_sua_truc_tiep()'; -- naming-ok: hàm 0048
  else
    raise notice 'Chưa có hàm 0048 — bỏ qua trigger ghi vết';
  end if;
end $$;

-- KIỂM sau khi chạy (chỉ đọc):
--   select count(*) from pg_policies where tablename = 'export_document_kinds';  -- 4
--   select count(*) from public.export_document_kinds;                            -- 0 lúc mới chạy

-- ============================================================
-- ROLLBACK — chỉ khi chưa có loại chứng từ tự thêm nào được dùng (chứng từ đã ghi giữ `id` loại
-- đó, bỏ bảng thì tên hiện thành "Chứng từ khác"):
--   drop table if exists public.export_document_kinds;
-- ============================================================
