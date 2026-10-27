-- ============================================================
-- Baseafood MES — 0078: HÀM GỘP MẶT HÀNG nhận product_id có tiền tố demo
--
-- Vì sao (rà commit 2026-10-27): từ commit cdc0804 app khai `product_id` (và các cột
-- from/to_product_id) là khóa ngoại MỀM ⇒ ở chế độ demo (site 'site-demo') dòng sổ ghi lên
-- máy chủ lưu `demo:<id>`. Hàm 0069 so cột sổ với id THÔ ⇒ dòng mới không được chuyển
-- sang mục giữ, mà mục bỏ vẫn bị xoá ⇒ dòng sổ demo trỏ vào mặt hàng đã mất. Lệnh sửa dữ
-- liệu cũ ở spec che-do-demo §4c (thêm tiền tố cho mọi dòng demo) sẽ làm hàm 0069 không
-- chuyển được dòng nào ⇒ phải chạy file này TRƯỚC lệnh đó.
--
-- Làm gì — thay 2 hàm của 0069 (cùng chữ ký, cùng quyền), chỉ đổi 2 câu update cột sổ:
--   merge_products: bắt dòng có `product_id` = id thô HOẶC `demo:` || id (dòng demo cũ thiếu
--     tiền tố vẫn được chuyển), ghi mục giữ dạng `v_prefix || p_keep`.
--   undo_merge_products: trả cột sổ về `v_prefix || drop`.
--   Site thật: v_prefix = '' ⇒ `in ($3, $4)` là cùng một id ⇒ hành vi y hệt 0069.
-- Phần còn lại (kiểm trùng tên, điền ô trống, xoá mục bỏ, audit_log, payload hoàn tác) giữ
-- nguyên từng chữ. Payload hoàn tác tạo bởi hàm 0069 vẫn hoàn tác được bằng hàm này.
--
-- Chỉ THAY hàm. Không đổi bảng, dữ liệu, policy. Mức độ 🟡; idempotent (create or replace).
-- Sau khi chạy file này ĐỪNG chạy lại 0069 (sẽ trả về bản hàm cũ).
-- ROLLBACK (về bản 0069): chạy lại supabase/migrations/0069_merge_products.sql.
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
    -- 0078: dòng sổ ở site demo lưu product_id CÓ tiền tố `demo:` (app ghi từ 2026-10-27,
    -- refColumns) — dòng cũ thì thiếu. Bắt CẢ HAI dạng; ghi mục giữ theo dạng có tiền tố
    -- (app đọc về bỏ tiền tố nên hai dạng như nhau). Site thật: v_prefix = '' ⇒ y như 0069.
    execute format(
      'with u as (update public.%I set %I = $1 where site_id = $2 and %I in ($3, $4) returning id) '
      || 'select coalesce(jsonb_agg(id), ''[]''::jsonb) from u',
      r.tbl, r.col, r.col)
      into v_ids using v_prefix || p_keep, p_site, p_drop, v_prefix || p_drop;
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
  v_prefix text := case when p_site = 'site-demo' then 'demo:' else '' end;
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
    -- 0078: trả về id mục bỏ theo dạng có tiền tố ở site demo (cùng luật với lúc gộp).
    execute format('update public.%I set %I = $1 where site_id = $2 and id in (select jsonb_array_elements_text($3))', v_tbl, v_col)
      using v_prefix || v_drop, p_site, p_payload -> 'moved' -> k;
  end loop;
end;
$$;

revoke all on function public.merge_products(text, text, text) from public, anon;
revoke all on function public.undo_merge_products(text, jsonb) from public, anon;
grant execute on function public.merge_products(text, text, text) to authenticated;
grant execute on function public.undo_merge_products(text, jsonb) to authenticated;
