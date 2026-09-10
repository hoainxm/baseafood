-- ============================================================
-- SỬA DỮ LIỆU MỘT LẦN — 2026-09-10  (chạy trên Supabase SQL Editor)
--
--   (1) Swap TOÀN BỘ dữ liệu nhập 31/08/2026 ↔ 01/09/2026 (cả 3 phân xưởng):
--       chuyến + dòng nhập + phế liệu (nguồn Nhập hàng) + chốt ngày.
--   (5c) Ghi lại nhật ký thao tác nhập hàng: actor admin → nnttruc.
--
-- ⚠️ ĐỤNG DỮ LIỆU THẬT — không quay đầu được nếu chạy sai. ĐỌC HẾT trước khi chạy.
-- ⚠️ Chạy trong SUPABASE SQL EDITOR (role owner). audit_log chặn UPDATE với
--    'authenticated' (0025) nhưng owner ở SQL Editor vẫn update được — không cần
--    sửa RLS.
-- ⚠️ (5c) ghi ĐÈ nhật ký (append-only theo thiết kế). Chỉ chạy nếu admin đúng là
--    tài khoản tạm dùng thay nnttruc; sau khi chạy, không dựng lại actor cũ được.
-- ⚠️ BƯỚC 0 SAO LƯU trước. Cả khối bọc trong BEGIN … COMMIT: xem kết quả các câu
--    kiểm (SELECT) rồi mới COMMIT; thấy sai thì gõ ROLLBACK.
--
-- Thứ tự triển khai tổng thể:
--   1) Chạy migration 0042 (thêm cột operator + backfill nnttruc).
--   2) Chạy file này (swap ngày + ghi lại nhật ký).
--   3) Deploy app đã cập nhật (app mới ghi operator cho chuyến từ nay).
-- ============================================================


-- ---------- BƯỚC 0: SAO LƯU (chạy riêng, BẤM "Download CSV" lưu lại) ----------
-- select * from public.import_shipments where delivery_date in ('2026-08-31','2026-09-01')
--   or posting_date in ('2026-08-31','2026-09-01');
-- select * from public.material_imports where delivery_date in ('2026-08-31','2026-09-01');
-- select * from public.scraps where date in ('2026-08-31','2026-09-01') and source = 'Nhập hàng';
-- select * from public.daily_locks where lock_date in ('2026-08-31','2026-09-01');
-- select * from public.audit_log where actor_username = 'admin'
--   and entity in ('import_shipments','material_imports','daily_locks');


begin;

-- ================= (1) SWAP NGÀY 31/08 ↔ 01/09 =================

-- 1a. import_shipments — ĐỔI ngày hàng về (delivery_date). Ngày ghi sổ
--     (posting_date) đổi THEO chỉ khi nó ĐÚNG bằng ngày hàng về (chuyến ghi
--     đúng ngày ⇒ dời trọn); chuyến ghi bù (posting_date ≠ delivery_date) giữ
--     nguyên posting_date. Cả hai vế CASE đọc giá trị CŨ của dòng.
--     Bảng này không có unique theo ngày ⇒ một câu CASE là đủ, không kẹt.
update public.import_shipments
set delivery_date = case delivery_date
      when date '2026-08-31' then date '2026-09-01'
      when date '2026-09-01' then date '2026-08-31'
    end,
    posting_date = case
      when posting_date = delivery_date then case delivery_date
            when date '2026-08-31' then date '2026-09-01'
            when date '2026-09-01' then date '2026-08-31'
          end
      else posting_date
    end
where delivery_date in ('2026-08-31','2026-09-01');

-- 1b. material_imports — dòng hàng mang bản chép delivery_date. Đổi theo đúng
--     hai ngày ⇒ dòng khớp lại với chuyến cha (chuyến cũng vừa đổi ở 1a).
update public.material_imports
set delivery_date = case delivery_date
      when date '2026-08-31' then date '2026-09-01'
      when date '2026-09-01' then date '2026-08-31'
    end
where delivery_date in ('2026-08-31','2026-09-01');

-- 1c. scraps (phế liệu nguồn Nhập hàng) — đổi cột `date`. Dùng ngày trung gian
--     1900-01-01 phòng khi có unique (date,name,workshop,source) để không đụng
--     nhau giữa chừng. CHỈ đụng source = 'Nhập hàng' (không chạm phế liệu Cân đối).
update public.scraps set date = date '1900-01-01'
  where source = 'Nhập hàng' and date = '2026-08-31';
update public.scraps set date = date '2026-08-31'
  where source = 'Nhập hàng' and date = '2026-09-01';
update public.scraps set date = date '2026-09-01'
  where source = 'Nhập hàng' and date = '1900-01-01';

-- 1d. daily_locks (chốt ngày) — đổi lock_date. Bảng có unique (lock_date,
--     workshop) ⇒ BẮT BUỘC đi qua ngày trung gian 1900-01-01, không được CASE
--     một câu (sẽ vi phạm unique giữa chừng). total_kg_at_lock đi theo bản ghi:
--     dữ liệu ngày đó cũng vừa dời nên tổng vẫn khớp.
update public.daily_locks set lock_date = date '1900-01-01' where lock_date = '2026-08-31';
update public.daily_locks set lock_date = date '2026-08-31' where lock_date = '2026-09-01';
update public.daily_locks set lock_date = date '2026-09-01' where lock_date = '1900-01-01';


-- ================= (5c) GHI LẠI NHẬT KÝ admin → nnttruc =================
-- Chỉ các thao tác NHẬP HÀNG: chuyến, dòng nhập, chốt ngày. (KHÔNG đụng entity
-- 'scraps' vì phế liệu dùng chung với màn Cân đối — nếu muốn gộp cả phế liệu
-- nhập thì thêm 'scraps' vào danh sách entity, nhưng sẽ chạm luôn phế liệu Cân
-- đối do admin ghi.)
update public.audit_log
set actor_username = 'nnttruc',
    actor_id = coalesce(
      (select id from public.user_profiles where username = 'nnttruc' limit 1),
      actor_id
    )
where actor_username = 'admin'
  and entity in ('import_shipments','material_imports','daily_locks');


-- ---------- KIỂM TRƯỚC KHI COMMIT (đọc kết quả, thấy đúng mới COMMIT) ----------
-- Kỳ vọng: số dòng của 31/08 và 01/09 đã HOÁN cho nhau so với bản sao lưu BƯỚC 0.
select 'import_shipments' as bang, delivery_date, count(*)
  from public.import_shipments where delivery_date in ('2026-08-31','2026-09-01')
  group by delivery_date
union all
select 'material_imports', delivery_date, count(*)
  from public.material_imports where delivery_date in ('2026-08-31','2026-09-01')
  group by delivery_date
union all
select 'scraps(Nhập hàng)', date, count(*)
  from public.scraps where source='Nhập hàng' and date in ('2026-08-31','2026-09-01')
  group by date
union all
select 'daily_locks', lock_date, count(*)
  from public.daily_locks where lock_date in ('2026-08-31','2026-09-01')
  group by lock_date
order by bang, delivery_date;

-- Không còn thao tác nhập hàng nào mang actor 'admin' (kỳ vọng: 0 dòng).
select count(*) as con_admin_nhap_hang
  from public.audit_log
  where actor_username = 'admin'
    and entity in ('import_shipments','material_imports','daily_locks');

-- Đúng hết → gõ:   commit;
-- Sai         → gõ:   rollback;
commit;
