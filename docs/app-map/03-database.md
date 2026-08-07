> Load khi: thêm/sửa bảng, cột, migration, hay đọc lỗi Postgres lạ.
covers: supabase/migrations/**, docs/supabase-setup.md
last_verified: 2026-08-07
ttl_days: 90
<!-- updated: 2026-08-07 — thêm migration 0008 (nguyen_lieu_vao.nguon_kho, cờ nguồn xả đông) -->

# Cơ sở dữ liệu & migration

Postgres qua Supabase. **16 bảng**, không có view, không có RPC, không có edge function, không có cron.
Automation duy nhất: trigger `cap_nhat_thoi_diem_sua()` gắn cho mọi bảng nghiệp vụ để tự set `updated_at` — app không tự ghi cột này.

## Quy ước đặt tên — không thương lượng

**Tiếng Việt KHÔNG DẤU, snake_case, không tiền tố**: `nhap_nguyen_lieu`, `so_luong_kg`, `phan_xuong`.

- ❌ Tên **có dấu** (`"nhập_nguyên_liệu"`): Postgres bắt bọc nháy kép ở mọi câu lệnh, và dấu tiếng Việt có hai dạng Unicode NFC/NFD trông y hệt nhau nhưng là **hai định danh khác nhau** → copy từ Word/Chrome về là `relation does not exist` không hiểu vì sao.
- ❌ Tên tiếng Anh (`raw_materials`, `customers`): mất nghĩa với người đọc sổ.
- ❌ Tiền tố `mes_`: đã bỏ từ `0001` (bảng SDFactory dọn ở `0002`).

App dùng camelCase, DB dùng snake_case — cầu nối là `AnhXaBang.toRow/fromRow` trong `src/lib/repo.ts`. Thêm cột ⇒ phải sửa **cả hai chiều**, xem [04-tang-du-lieu.md](04-tang-du-lieu.md).

## 15 bảng

| Nhóm | Bảng | Khóa chính | Ghi chú |
|---|---|---|---|
| Site | `xi_nghiep` | `id` (`'bsf1'`) | multi-site; mọi bảng khác có `xi_nghiep_id` |
| Danh mục | `dai_ly` · `loai_nguyen_lieu` · `mat_hang` · `khach_hang` | `id` text | id sinh ở client |
| Danh mục | `thanh_pham` | **`ma`** | 141 mã kế toán TK 1551 — khóa chính là MÃ, không phải id |
| Nhập hàng | `chuyen_nhap` · `nhap_nguyen_lieu` · `chot_ngay` | `id` text | xem [30-nhap-hang.md](30-nhap-hang.md) |
| Bán hàng | `phieu_ban` · `ban_hang` | `id` text | phiếu bán TP ngày; xem [33-ban-hang.md](33-ban-hang.md) |
| Cân đối | `ky_can_doi` · `nguyen_lieu_vao` · `phe_lieu` · `thanh_pham_ra` | `id` text | xem [31-can-doi-ky.md](31-can-doi-ky.md) |
| Người dùng | `nguoi_dung` | `id` = auth user id | hồ sơ + vai trò; xem [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md) |

`thanh_pham_ra` có thêm `quy_cach` + `ban_hang_id` (từ `0005`) để nhận dòng hút từ sổ bán, chống hút trùng.

**Bất biến dữ liệu:**

- Mọi truy vấn của app lọc `.eq("xi_nghiep_id", SITE_ID)`. Bảng mới **phải** có cột này (`default 'bsf1'` + FK về `xi_nghiep`), nếu không dữ liệu xí nghiệp khác lẫn vào nhau.
- Khóa chính là **`text` sinh ở client** (`Date.now()-random`), không phải `uuid`/`serial` — vì app phải ghi được khi mất mạng rồi đẩy lên sau.
- Sổ nhập lưu **TÊN** đại lý / loại NL (`ten_dai_ly`, `ten_loai_nguyen_lieu`), **không phải khóa ngoại**: sổ sách giữ nguyên tên tại thời điểm nhập; đại lý đổi tên sau này không được làm sai bản ghi đã chốt.
- `nguyen_lieu_vao` / `thanh_pham_ra` FK `ky_id` **on delete cascade**. `phe_lieu.ky_id` thì **nullable, không cascade theo ý nghĩa nghiệp vụ** — xóa kỳ chỉ gỡ liên kết (app tự làm), số gốc thuộc về sổ nhập hàng.
- `phe_lieu.ky_id` rỗng phải ghi xuống DB là **NULL**, chuỗi rỗng vi phạm FK (`repo.ts` đã xử lý: `x.kyId || null`).

## 14 migration — thứ tự & rủi ro

| File | Tier | Việc |
|---|---|---|
| `0001_baseafood_mes.sql` | 🟡 | Tạo 11 bảng MES + trigger + RLS. Có `drop table … mes_*` ở đầu để dọn bản nháp cũ. |
| `0002_go_bo_sdfactory.sql` | 🔴 | **PHÁ HỦY** — gỡ 3 bảng cũ của SDFactory. Chạy thủ công, không hoàn tác. Không chạy cũng không ảnh hưởng MES. |
| `0003_siet_rls.sql` | 🔴 | Siết RLS về `authenticated`. Chạy **SAU** khi app có đăng nhập, nếu không app ngừng đọc/ghi ngay. Xem [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md). |
| `0004_chuyen_chot_ngay_phe_lieu.sql` | 🟡 | Thêm `chuyen_nhap`, `chot_ngay`, `nhap_nguyen_lieu.chuyen_id`; nới `phe_lieu`. Chỉ thêm, an toàn với dữ liệu đang có. **Chạy ngay** — xem cảnh báo dưới. |
| `0005_ban_thanh_pham.sql` | 🟡 | Thêm `phieu_ban`, `ban_hang`; nới `thanh_pham_ra` (`quy_cach`, `ban_hang_id`). Chỉ thêm, không phụ thuộc 0004. Đã chạy. |
| `0006_nguoi_dung.sql` | 🟡 | Thêm `nguoi_dung` (hồ sơ + vai trò, khóa = auth user id). Chỉ thêm. Xem [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md). |
| `0007_seed_admin.sql` | 🟡 | Seed `admin`/`admin` thẳng vào `auth.users` + `auth.identities` + `nguoi_dung` (idempotent). ⚠️ mật khẩu tạm rất yếu — đổi ngay. Con-gà-quả-trứng: đăng ký đã đóng. |
| `0008_nguon_kho.sql` | 🟡 | Thêm cột `nguyen_lieu_vao.nguon_kho` (`Mua về` / `Kho mình` / `""`) — cờ nguồn xả đông, seam tồn kho. Chỉ thêm, idempotent. **Không bắt buộc**: `repo.ts` chỉ gửi `nguon_kho` khi có giá trị ⇒ NL vào ghi được kể cả khi chưa chạy. Lùi: `alter table nguyen_lieu_vao drop column if exists nguon_kho`. |
| `0009_dai_ly_thong_tin.sql` | 🟡 | Thêm 5 cột `dai_ly`: `ten_ghi_phieu` · `dia_chi` · `cmnd` · `ngay_cap` · `noi_cap` — thông tin lập phiếu cho đại lý. Chỉ thêm, idempotent. **Không bắt buộc**: `repo.ts` chỉ gửi cột mới khi có giá trị. Lùi: `drop column if exists` từng cột. |
| `0010_email_domain_vn.sql` | 🔴 | Đổi đuôi email tổng hợp `@bsf1.local` → `@bsf1.vn` trong `auth.users` + `auth.identities` (GoTrue chặn TLD `.local` khi signUp). **Chạy SAU khi deploy code** đổi `DUOI_EMAIL`. Chỉ đụng tài khoản `.local` (thực tế chỉ admin seed). Idempotent. Không đụng mật khẩu. Lùi: xem đầu file. Đừng chạy lại `0007` trên DB đã seed `.local` — chạy `0010`. |
| `0011_wip_san_xuat_kho_don.sql` | 🟡 | Module WIP: thêm `san_xuat_btp` · `chot_san_xuat` · `don_dat` · `dong_don` · `lenh_xuat` · `dong_lenh`. Chỉ thêm bảng, idempotent, RLS mở cho anon (siết ở 0003). Nền cho 3 màn Sản xuất BTP / Kho dự trữ / Đơn đặt (ba-spec 34, design-spec 35). |
| `0012_seed_khach_hang.sql` | 🟢 | Seed 11 khách hàng từ bảng cân đối (Lucky · Seachemot · Daiko · Peacock · Hanwa · Matsuda · Hatchando · JFDA · Dairei · Orient · Sasano). Idempotent (so theo tên), `thi_truong` để trống. Chỉ thêm khách chưa có. |
| `0014_mat_hang_loai.sql` | 🟡 | Thêm cột `mat_hang.loai` (loài) + nạp mặt hàng từ 141 thành phẩm (mỗi cái gắn loài = nhóm), backfill loài cho mặt hàng đã ánh xạ. Idempotent theo tên. `repo.ts` chỉ gửi `loai` khi có giá trị ⇒ không bắt buộc để ghi. App cũng `seedMatHang` từ 141 khi mat_hang rỗng. |
| `0013_seed_dai_ly.sql` | 🟢 | Seed 10 đại lý từ ảnh người dùng (Hồng Phú · mậu · Trọng Hòa · Hương Pháp · Nam Tuyền · hiếu phấn · thuận pt · P Cơ · Hoàn Truyền · Tuấn Tô) — đủ tên ghi phiếu/địa chỉ/CMND/nơi cấp. **Chạy SAU 0009** (cần cột mới của dai_ly). Idempotent (so theo tên ghi phiếu). Ảnh bị cắt ở "Tuấn Tô" — còn đại lý dưới chưa seed. |

⚠️ **`0004` chưa chạy** ⇒ app báo *"Mất kết nối máy chủ — Could not find the 'chuyen_id' column"*. Số liệu vẫn ghi xuống máy và nằm trong hàng chờ, tự đẩy lên sau khi migration chạy — nhưng máy khác chưa thấy.

## Viết migration mới

1. Đánh số tiếp (`0005_…`), tên tiếng Việt không dấu mô tả việc.
2. Mở đầu bằng comment: **vì sao** đổi, chạy sau file nào, có phá hủy không.
3. Chỉ dùng `create table if not exists` / `add column if not exists` — file phải chạy lại được nhiều lần (không có công cụ migrate tự động, người ta dán tay vào SQL Editor).
4. Bảng mới: thêm `xi_nghiep_id`, `created_at`, `updated_at`, đăng ký trigger `cap_nhat_thoi_diem_sua`, bật RLS + policy (đang là mở cho `anon` — thêm luôn vào danh sách trong `0003` để sau này không sót).
5. Sửa `AnhXaBang` tương ứng trong `repo.ts` **cùng commit**, kèm `vaDongCu` nếu cột mới cần giá trị cho dòng cũ.
6. `numeric(14,3)` cho kg, `numeric(14,2)` cho tiền — giữ nguyên chuẩn này.

## Cross-references

- Cutover Supabase, lấy URL/key, đối chiếu: [`docs/supabase-setup.md`](../supabase-setup.md)
- Ánh xạ camelCase↔snake_case, hàng chờ: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- RLS & bảo mật: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md)
