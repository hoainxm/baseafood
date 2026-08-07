-- ============================================================
-- Baseafood MES — 0014: loài cho mặt hàng + nạp mặt hàng từ 141 thành phẩm
--
-- Chạy SAU 0001. An toàn (chỉ thêm cột + thêm mặt hàng chưa có). Idempotent.
--
-- Vì sao: khi ghi sản lượng / cân đối, mặt hàng = thành phẩm (theo loài) + quy
-- cách. Thêm cột `loai` để LỌC theo loài (Bạch tuộc / Mực / Cá…). Nạp sẵn mặt
-- hàng từ 141 thành phẩm (mỗi cái gắn `loai` = nhóm) để có cái mà chọn, khỏi
-- nhập tay. `repo.ts` chỉ gửi `loai` khi có giá trị ⇒ mặt hàng vẫn ghi được kể
-- cả khi chưa chạy 0014.
--
-- Lùi: alter table mat_hang drop column if exists loai;  (không gỡ mặt hàng seed)
-- QUY ƯỚC ĐẶT TÊN: tiếng Việt KHÔNG DẤU, snake_case, không tiền tố.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.mat_hang
  add column if not exists loai text not null default '';

-- Nạp mặt hàng từ thành phẩm 141 (nếu thanh_pham đã có trên server) — idempotent
-- theo tên; không nhân đôi mặt hàng đang có.
insert into public.mat_hang (id, xi_nghiep_id, ma, ten, ma_thanh_pham, loai)
select extensions.gen_random_uuid()::text, 'bsf1', '', t.ten, t.ma, t.nhom
from public.thanh_pham t
where not exists (
  select 1 from public.mat_hang m
  where m.xi_nghiep_id = 'bsf1' and lower(m.ten) = lower(t.ten)
);

-- Backfill loài cho mặt hàng đã ánh xạ 141 mà chưa có loài.
update public.mat_hang m
  set loai = t.nhom
from public.thanh_pham t
where m.ma_thanh_pham = t.ma and coalesce(m.loai, '') = '';
