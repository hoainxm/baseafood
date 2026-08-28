> Load khi: thêm/sửa bảng, cột, migration, hay đọc lỗi Postgres lạ.
covers: supabase/migrations/**, docs/ops/supabase-setup.md
last_verified: 2026-08-27
ttl_days: 90
<!-- updated: 2026-08-27 — thêm 0033 (production_wips.processing_type, text default ''): KIỂU CHẾ BIẾN của nhóm ghi thành phẩm ngày /wip (gom theo chế biến × khách như sổ giấy). CHỈ-THÊM cột nullable/default, idempotent. Xem 34-btp ba-spec + repo.ts BANG_WIP_PRODUCTION. -->
<!-- updated: 2026-08-27 — thêm 0032 (nxt_snapshots: snapshot Xuất–Nhập–Tồn nhập từ báo cáo THẬT của xí nghiệp, hạt Kho × Mã hàng × Kỳ; cột opening/in/out + giá trị; tồn cuối SUY ở app không lưu). CHỈ-THÊM bảng, idempotent, RLS anon+authenticated (chưa vào vòng siết 0021). Xem 04-tang-du-lieu (BANG_NXT_SNAPSHOT) + màn /nxt-kho. -->
<!-- updated: 2026-08-24 — thêm 0025 (audit_log: nhật ký thao tác, append-only, admin đọc) — KHÔNG đưa vào vòng siết 0021; xem lib/audit.ts -->
<!-- updated: 2026-08-24 — thêm 0024 (finished_goods_opening_stock: tồn đầu kho THÀNH PHẨM, kg+block) cho sổ NXT thành phẩm khép vòng; xem lib/inventoryFinished.ts -->
<!-- updated: 2026-08-26 — thêm 0030 (production_wips: customer_name + component_rau/bao_tu_kg) & 0031 (products: split_components + block_spec_kg) cho màn ghi thành phẩm ngày /wip: gom nhóm THEO LOÀI (products.category, không theo loại NL — xem 34-btp), cờ tách râu/bao tử, quy cách block trên mặt hàng -->
<!-- updated: 2026-08-24 — hòa nhánh docs-flow: 0027 (products.processing_type), 0028 (production_locks.leftover_kg), 0029 (packagings: đóng gói BTP→TP, G3) — đổi số từ 0024/0025/0026 tránh trùng -->
<!-- updated: 2026-08-21 — thêm 0022 (material_opening_stock: tồn đầu kho nguyên liệu, kg thuần) cho sổ NXT nguyên liệu; xem 31-can-doi-ky.md § Tồn kho nguyên liệu -->
<!-- updated: 2026-08-07 — thêm migration 0008 (nguyen_lieu_vao.nguon_kho, cờ nguồn xả đông) -->
<!-- updated: 2026-08-14 — bổ sung dòng migration 0016/0017/0018 (trước đó bảng dừng ở 0015); 0018 cho NL vào âm -->
<!-- updated: 2026-08-18 — thêm 0020 (chốt kỳ cân đối + carry_over_period_id cho balancing_inputs) -->
<!-- updated: 2026-08-17 — thêm 0019 (lưới cân đối theo ngày: cột hút kỳ, Giảm, chuyển kỳ, tách size 2 da) -->

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

## 18 migration — thứ tự & rủi ro

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
| `0015_mat_hang_loai_nl.sql` | 🟡 | Thêm cột `mat_hang.loai_nguyen_lieu_id` (khóa chính loại NL) — thành phẩm THUỘC loại NL nào; ghi sản lượng lọc thành phẩm theo loại NL. Chỉ thêm cột, idempotent. `repo.ts` gửi có điều kiện. |
| `0013_seed_dai_ly.sql` | 🟢 | Seed 10 đại lý từ ảnh người dùng (Hồng Phú · mậu · Trọng Hòa · Hương Pháp · Nam Tuyền · hiếu phấn · thuận pt · P Cơ · Hoàn Truyền · Tuấn Tô) — đủ tên ghi phiếu/địa chỉ/CMND/nơi cấp. **Chạy SAU 0009** (cần cột mới của dai_ly). Idempotent (so theo tên ghi phiếu). Ảnh bị cắt ở "Tuấn Tô" — còn đại lý dưới chưa seed. |
| `0016_rename_to_english.sql` | 🔴 | **Đổi tên TOÀN BỘ bảng + cột sang tiếng Anh** (`nguyen_lieu_vao`→`balancing_inputs`, `so_luong_kg`→`quantity_kg`…). Reversible nhưng phải **deploy code dùng tên tiếng Anh cùng lúc** — app cũ ngừng đọc ngay. Ràng buộc CHECK giữ nguyên tên cũ (VD `nguyen_lieu_vao_so_luong_kg_check` vẫn dính vào `balancing_inputs`). |
| `0017_kho_bsf1_nxt.sql` | 🟡 | Thêm bảng kho BSF1 + báo cáo Nhập-Xuất-Tồn 5 kho. Chỉ thêm, idempotent. |
| `0018_nl_vao_cho_phep_am.sql` | 🟡 | Đổi CHECK `balancing_inputs.quantity_kg`: `>= 0` → `<> 0` (cho **NL vào ÂM** — điều chỉnh giảm / "bán nội địa", khớp luật app Khối 1). `NOT VALID` (không kiểm dòng cũ), idempotent, lùi được. Sửa bug 23514 khi ghi dòng NL âm lên Supabase. |
| `0019_can_doi_luoi_ngay.sql` | 🟡 | **Lưới cân đối theo ngày.** Thêm `balancing_period_id` vào `material_imports` + `production_wips` (hút = gán kỳ lên bản ghi gốc, không chép số); thêm `daily_quantities` (jsonb) · `carry_over_kg` · `auto_source` cho `balancing_inputs`/`balancing_outputs`; `is_reduction` + `reduction_warehouse_id` cho ô **Giảm**. Tách size: `Bạch tuộc 2 da` → **lớn (80↑)** (dữ liệu cũ đổi hết sang lớn) + thêm **nhỏ (80↓)**. **KHÔNG** đổi `balancing_periods.material_type_name` — kỳ giữ tên HỌ để gom cả hai size. Chỉ thêm cột, idempotent, có khối `ROLLBACK` sẵn trong file. |
| `0020_chot_ky_va_chuyen_ky.sql` | 🟡 | **Chốt kỳ cân đối**: `balancing_periods` thêm `is_locked` / `locked_at` / `lock_note` / `reopen_reason` (cùng luật chốt ngày: mở lại bắt lý do, KHÔNG xoá vết). **Chuyển kỳ**: `balancing_inputs` thêm `carry_over_period_id` (bảng outputs đã có từ 0019) + index cho cả hai — dòng đẩy sang kỳ sau nhớ đã được kỳ nào nhận, chống lấy hai lần. Chỉ thêm cột, idempotent, có khối `ROLLBACK`. |
| `0021_siet_rls_tieng_anh.sql` | 🔴 | **Siết RLS** — thay `0003` (đã lỗi thời sau rename `0016`). Thu hồi `anon` ở cả policy lẫn GRANT + `revoke usage on schema public`, policy `authenticated` cho đủ **23 bảng** tên hiện hành. Bỏ qua bảng chưa tồn tại thay vì gãy giữa chừng. Idempotent, có `ROLLBACK`. **Tiền kiểm bắt buộc**: mọi máy đăng nhập được, còn admin đăng nhập được — chạy sớm là cả xưởng đứng (401). Xem [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md). Danh sách nay **25 bảng** — đã gồm `material_opening_stock` (0022) + `finished_goods_opening_stock` (0024). |
| `0022_ton_dau_nguyen_lieu.sql` | 🟡 | **Tồn đầu kho nguyên liệu** — bảng `material_opening_stock` (site_id · workshop · material_type_name · as_of_date · quantity_kg, **kg thuần**). Số dư đông dự trữ có sẵn trước khi số hoá, làm tồn đầu cho kỳ ĐẦU của mỗi họ NL trong sổ NXT nguyên liệu (kỳ sau tự kế thừa). Chỉ thêm bảng, idempotent, RLS mở anon (siết sau ở `0021`), có `ROLLBACK`. Xem [31-can-doi-ky.md](31-can-doi-ky.md). |
| `0023_reset_seed_can_doi_bt2da.sql` | 🔴 | **PHÁ HỦY (seed demo/thật)** — XÓA mọi kỳ cân đối site `bsf1` rồi nạp lại 1 kỳ thật "Bạch tuộc 2 da" 21–29/07/2025 (8 khách, 21 mặt hàng, `daily_quantities` theo ngày; số chốt ncls 2.218 giữ nguyên). Chỉ chạy khi cố ý reset dữ liệu cân đối. |
| `0024_ton_dau_thanh_pham.sql` | 🟡 | **Tồn đầu kho thành phẩm** — bảng `finished_goods_opening_stock` (site_id · product_id · spec · as_of_date · quantity_kg · blocks_count · warehouse). Đối xứng `0022` nhưng cho THÀNH PHẨM, khóa theo (mặt hàng × quy cách). Làm tồn đầu cho sổ NXT thành phẩm (khép vòng nhập → SX → kho → xuất đơn/bán); kỳ sau suy tồn đầu từ lịch sử. Chỉ thêm bảng, idempotent, RLS mở anon (đã có trong danh sách siết của `0021`), có `ROLLBACK`. Xem `lib/inventoryFinished.ts`. |
| `0025_nhat_ky_thao_tac.sql` | 🟡 | **Nhật ký thao tác (audit_log)** — append-only: at · actor_id/username · action (them/sua/xoa/dang-nhap/dang-xuat) · entity (bảng) · entity_key · summary · diff(jsonb) · device_id. RLS RIÊNG: authenticated **chỉ INSERT + SELECT**, SELECT chỉ admin (đọc vai trò từ `user_profiles`), **cấm UPDATE/DELETE** (revoke + không có policy). ⚠️ **KHÔNG** đưa vào vòng lặp siết của `0021` (policy `for all` sẽ phá append-only). Chạy SAU `0006`. Idempotent, có `ROLLBACK`. Xem `lib/audit.ts`. |
| `0026_nl_vao_cho_phep_khong.sql` | 🟡 | **NL vào cho phép 0** — `drop constraint` `<> 0` trên `balancing_inputs.quantity_kg`. Sau `0019` (lưới ngày) dòng khung `quantity_kg = 0` là hợp lệ nhưng đụng CHECK của `0018` → lỗi 23514 đầu độc cả lô hàng chờ ("Mất kết nối máy chủ"). Chỉ nới ràng buộc, không đụng dữ liệu, idempotent, có `ROLLBACK`. |
| `0027_products_processing_type.sql` | 🟡 | Thêm cột `products.processing_type` (kiểu chế biến: luộc/chần/cắt/tẩm bột…) — facet thứ 3 bên cạnh `category` (loài) + `material_type_id` (nguyên liệu). Chỉ thêm cột, default `''`, idempotent, có `ROLLBACK`. Xem [spec/bo-quy-cach-che-bien-thanh-pham.md](../spec/bo-quy-cach-che-bien-thanh-pham.md). |
| `0028_production_leftover.sql` | 🟡 | Thêm cột `production_locks.leftover_kg` (numeric, default 0) — nguyên liệu còn dở đem lưu kho, ghi lúc chốt ngày SX (daily-task bộ phận Sản xuất). Chỉ thêm cột, idempotent, có `ROLLBACK`. Chỉ đụng `production_locks`, không đụng `daily_locks`. |
| `0030_production_customer_components.sql` | 🟡 | **Thành phẩm ngày — khách + râu/bao tử.** Thêm 3 cột vào `production_wips`: `customer_name` (mỗi dòng gắn 1 khách, làm theo đơn), `component_rau_kg` + `component_bao_tu_kg` (thành phẩm cắt chần tách 2 thành phần cùng giá; `quantity_kg` giữ TỔNG, null = không tách). Chỉ thêm cột, idempotent, có `ROLLBACK`. Chỉ đụng `production_wips`. |
| `0029_dong_goi_thanh_pham.sql` | 🟡 | **Đóng gói BTP → thành phẩm (G3)** — bảng `packagings` (from_product/from_spec + input_kg/blocks → to_product/to_spec + output_kg/units, warehouse). Ghi phiếu đóng gói: BTP tiêu hao → TP ra, hao hụt = input−output. Tồn BTP trừ thêm input, tồn TP cộng output — cả hai SUY runtime (`inventory.ts`: `dongGoiTruTon`, `tinhTonTP`). Chỉ thêm bảng, idempotent, RLS mở anon (siết ở `0021`), có `ROLLBACK`. Xem [flow §3 G3](../trien-khai/flow-end-to-end-2-bo-phan.md). |
| `0031_product_split_blockspec.sql` | 🟡 | **Mặt hàng — cờ tách + quy cách block.** Thêm 2 cột vào `products`: `split_components` (bool, default false — mã có tách râu/bao tử cùng giá hay không; CHỈ mã bật cờ mới hiện mũi tên tách ở màn ghi thành phẩm) + `block_spec_kg` (numeric, null — quy cách MỖI block kg/khối, VD 2/5; màn ghi tự tính kg gợi ý = số block × quy cách). Đẩy 2 thuộc tính về mặt hàng để `/wip` tự suy thay vì hỏi mỗi dòng. Chỉ thêm cột, idempotent, có `ROLLBACK`. Chỉ đụng `products`. Xem [34-btp-san-xuat-kho.ba-spec.md](34-btp-san-xuat-kho.ba-spec.md). |

⚠️ **`0004` chưa chạy** ⇒ app báo *"Mất kết nối máy chủ — Could not find the 'chuyen_id' column"*. Số liệu vẫn ghi xuống máy và nằm trong hàng chờ, tự đẩy lên sau khi migration chạy — nhưng máy khác chưa thấy.

## Viết migration mới

1. Đánh số tiếp (`0005_…`), tên tiếng Việt không dấu mô tả việc.
2. Mở đầu bằng comment: **vì sao** đổi, chạy sau file nào, có phá hủy không.
3. Chỉ dùng `create table if not exists` / `add column if not exists` — file phải chạy lại được nhiều lần (không có công cụ migrate tự động, người ta dán tay vào SQL Editor).
4. Bảng mới: thêm `xi_nghiep_id`, `created_at`, `updated_at`, đăng ký trigger `cap_nhat_thoi_diem_sua`, bật RLS + policy (đang là mở cho `anon` — thêm luôn vào danh sách trong `0003` để sau này không sót).
5. Sửa `AnhXaBang` tương ứng trong `repo.ts` **cùng commit**, kèm `vaDongCu` nếu cột mới cần giá trị cho dòng cũ.
6. `numeric(14,3)` cho kg, `numeric(14,2)` cho tiền — giữ nguyên chuẩn này.

## Cross-references

- Cutover Supabase, lấy URL/key, đối chiếu: [`docs/ops/supabase-setup.md`](../ops/supabase-setup.md)
- Deploy Vercel (env production, 2 repo đồng bộ): [`docs/ops/deploy-vercel.md`](../ops/deploy-vercel.md)
- Ánh xạ camelCase↔snake_case, hàng chờ: [04-tang-du-lieu.md](04-tang-du-lieu.md)
- RLS & bảo mật: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md)
