-- ============================================================
-- Baseafood MES — 0069: GỘP MẶT HÀNG TRÙNG TÊN (một giao dịch, có hoàn tác)
--
-- Vì sao (người dùng yêu cầu 2026-10-16): danh mục mặt hàng có cặp TRÙNG TÊN (VD hai
-- "Bạch tuộc 2 da cắt luộc 3gr" — mã BT-CAT3G và BT-CAT3GNĐ) đã có dòng sổ ghi ⇒ ô chọn
-- ở /wip hiện hai mục giống hệt, mà xoá thì bị chặn vì "đã có trong sổ". Mọi thành phẩm
-- ghi ra đều về kho thành phẩm ⇒ kế toán muốn GỘP: chuyển mọi dòng sổ sang mục giữ lại
-- rồi xoá mục trùng.
--
-- Làm gì — 2 hàm `security invoker` (RLS + trigger chốt quyền 0065 vẫn áp như ghi thường):
--   merge_products(p_site, p_keep, p_drop)  trong MỘT giao dịch (lỗi ở đâu bỏ cả):
--     1. Kiểm hai mục cùng site, CÙNG TÊN (không phân hoa thường / khoảng trắng) — khác
--        tên thì từ chối (không dùng hàm này để gộp bừa hai mặt hàng khác nhau).
--     2. Chuyển product_id ở 8 cột sổ (sản xuất, cân đối, bán, đơn đặt, lệnh xuất, đóng
--        gói từ/đến, tồn đầu TP) từ mục bỏ sang mục giữ — kỳ cân đối đã chốt VẪN đổi (cùng
--        tên, số kg không đổi ⇒ kết quả kỳ không lệch; chốt với người dùng).
--     3. Điền vào mục giữ các ô đang trống lấy từ mục bỏ (mã số, loài, kiểu chế biến,
--        loại NL, bột đi kèm, quy cách block).
--     4. Xoá mục bỏ. Mã kế toán (141 mã TK 1551, bảng finished_goods) KHÔNG bị xoá — chỉ
--        dòng mặt hàng; số liệu của mục bỏ từ nay tính vào mã của mục giữ.
--     5. Ghi audit_log. Trả jsonb {dropped, keepBefore, moved} để app hoàn tác.
--   undo_merge_products(p_site, p_payload)  trả lại đúng như trước: dựng lại mục bỏ, trả
--     các ô của mục giữ, trả product_id của đúng các dòng đã chuyển (theo id).
--
-- Chế độ demo (site 'site-demo'): khoá chính trên máy chủ có tiền tố `demo:` (lib/demoMode),
-- cột product_id thì KHÔNG (không khai refColumns) ⇒ hàm nhận id thô, tự thêm tiền tố khi
-- tra bảng products.
-- ⚠️ ĐÃ THAY bởi 0078 (2026-10-27): từ commit cdc0804 app KHAI product_id là refColumns ⇒ dòng
-- demo mới lưu `demo:<id>`, hàm bản này không chuyển được dòng đó. Đã chạy 0078 thì ĐỪNG chạy
-- lại file này (trả về hàm cũ).
--
-- Chỉ THÊM hàm. Không đổi bảng, dữ liệu, policy. Mức độ 🟡 (chạy file); gọi hàm là ghi sổ
-- thật — app hỏi xác nhận + có Hoàn tác. Idempotent (create or replace).
-- ROLLBACK:
--   drop function if exists public.merge_products(text, text, text);
--   drop function if exists public.undo_merge_products(text, jsonb);
-- ============================================================

create or replace function public.merge_products(p_site text, p_keep text, p_drop text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefix text := case when p_site = 'site-demo' then 'demo:' else '' end;
  v_keep public.products;
  v_drop public.products;
  v_moved jsonb := '{}'::jsonb;
  v_ids jsonb;
  v_actor text;
  r record;
begin
  if p_keep is null or p_drop is null or p_keep = p_drop then
    raise exception 'Chọn hai mặt hàng khác nhau để gộp.';
  end if;
  select * into v_keep from public.products where site_id = p_site and id = v_prefix || p_keep;
  if not found then raise exception 'Không thấy mặt hàng giữ lại (%).', p_keep; end if;
  select * into v_drop from public.products where site_id = p_site and id = v_prefix || p_drop for update;
  if not found then raise exception 'Không thấy mặt hàng cần gộp (%).', p_drop; end if;
  if lower(regexp_replace(btrim(v_keep.name), '\s+', ' ', 'g'))
     <> lower(regexp_replace(btrim(v_drop.name), '\s+', ' ', 'g')) then
    raise exception 'Chỉ gộp được hai mặt hàng TRÙNG TÊN ("%" khác "%").', v_drop.name, v_keep.name;
  end if;

  for r in
    select * from (values
      ('production_wips', 'product_id'),
      ('balancing_outputs', 'product_id'),
      ('sales_items', 'product_id'),
      ('order_items', 'product_id'),
      ('export_items', 'product_id'),
      ('finished_goods_opening_stock', 'product_id'),
      ('packagings', 'from_product_id'),
      ('packagings', 'to_product_id')
    ) as t(tbl, col)
  loop
    execute format(
      'with u as (update public.%I set %I = $1 where site_id = $2 and %I = $3 returning id) '
      || 'select coalesce(jsonb_agg(id), ''[]''::jsonb) from u',
      r.tbl, r.col, r.col)
      into v_ids using p_keep, p_site, p_drop;
    if jsonb_array_length(v_ids) > 0 then
      v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.col, v_ids);
    end if;
  end loop;

  update public.products k set
    code = case when coalesce(btrim(k.code), '') = '' then v_drop.code else k.code end,
    category = case when coalesce(btrim(k.category), '') = '' then v_drop.category else k.category end,
    processing_type = case when coalesce(btrim(k.processing_type), '') = '' then v_drop.processing_type else k.processing_type end,
    material_type_id = case when coalesce(btrim(k.material_type_id), '') = '' then v_drop.material_type_id else k.material_type_id end,
    batter_ids = case when coalesce(cardinality(k.batter_ids), 0) = 0 then v_drop.batter_ids else k.batter_ids end,
    block_spec_kg = coalesce(k.block_spec_kg, v_drop.block_spec_kg)
  where k.site_id = p_site and k.id = v_keep.id;

  delete from public.products where site_id = p_site and id = v_drop.id;

  select coalesce(nullif(up.username, ''), '') into v_actor
    from public.user_profiles up where up.id = (select auth.uid())::text;
  insert into public.audit_log (id, site_id, actor_id, actor_username, action, entity, entity_key, summary, diff, device_id)
  values (
    'merge-products-' || md5(random()::text || clock_timestamp()::text),
    p_site, coalesce((select auth.uid())::text, ''), coalesce(v_actor, ''), 'delete', 'products', p_drop,
    format('Gộp mặt hàng "%s"%s vào mục trùng tên%s', v_drop.name,
      case when coalesce(v_drop.finished_good_code, '') <> '' then ' (mã ' || v_drop.finished_good_code || ')' else '' end,
      case when coalesce(v_keep.finished_good_code, '') <> '' then ' (mã ' || v_keep.finished_good_code || ')' else '' end),
    jsonb_build_object('keep', p_keep, 'moved', v_moved),
    'merge_products');

  return jsonb_build_object('dropped', to_jsonb(v_drop), 'keepBefore', to_jsonb(v_keep), 'moved', v_moved,
    'keep', p_keep, 'drop', p_drop);
end;
$$;

create or replace function public.undo_merge_products(p_site text, p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_keep_before public.products := jsonb_populate_record(null::public.products, p_payload -> 'keepBefore');
  v_drop text := p_payload ->> 'drop';
  k text;
  v_tbl text;
  v_col text;
begin
  if v_drop is null or v_keep_before.id is null then raise exception 'Thiếu dữ liệu để hoàn tác gộp.'; end if;
  insert into public.products select * from jsonb_populate_record(null::public.products, p_payload -> 'dropped')
    on conflict do nothing;
  update public.products set
    code = v_keep_before.code,
    category = v_keep_before.category,
    processing_type = v_keep_before.processing_type,
    material_type_id = v_keep_before.material_type_id,
    batter_ids = v_keep_before.batter_ids,
    block_spec_kg = v_keep_before.block_spec_kg
  where site_id = p_site and id = v_keep_before.id;
  for k in select jsonb_object_keys(coalesce(p_payload -> 'moved', '{}'::jsonb)) loop
    v_tbl := split_part(k, '.', 1);
    v_col := split_part(k, '.', 2);
    if (v_tbl, v_col) not in (
      ('production_wips', 'product_id'), ('balancing_outputs', 'product_id'), ('sales_items', 'product_id'),
      ('order_items', 'product_id'), ('export_items', 'product_id'), ('finished_goods_opening_stock', 'product_id'),
      ('packagings', 'from_product_id'), ('packagings', 'to_product_id')
    ) then
      raise exception 'Cột lạ trong dữ liệu hoàn tác: %', k;
    end if;
    execute format('update public.%I set %I = $1 where site_id = $2 and id in (select jsonb_array_elements_text($3))', v_tbl, v_col)
      using v_drop, p_site, p_payload -> 'moved' -> k;
  end loop;
end;
$$;

revoke all on function public.merge_products(text, text, text) from public, anon;
revoke all on function public.undo_merge_products(text, jsonb) from public, anon;
grant execute on function public.merge_products(text, text, text) to authenticated;
grant execute on function public.undo_merge_products(text, jsonb) to authenticated;
