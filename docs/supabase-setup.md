# Nối Baseafood MES với Supabase

## Dữ liệu hiện đang nằm ở đâu

Khi **chưa** điền `.env`, toàn bộ số liệu nằm trong **localStorage của trình
duyệt trên đúng máy đó**, các khóa:

| Khóa | Nội dung |
|---|---|
| `bsf.nhap-nl.v1` | chuyến nhập nguyên liệu hàng ngày |
| `bsf.ky.v1` | kỳ cân đối |
| `bsf.nlvao.v1` · `bsf.phelieu.v1` · `bsf.tp.v1` | 3 khối trong kỳ cân đối |
| `bsf.mathang.v1` · `bsf.khachhang.v1` · `bsf.daily.v1` · `bsf.loainl.v1` · `bsf.thanhpham.v1` | danh mục |
| `bsf.coChu` · `bsf.matDo` · `bsf.beRong` | cài đặt hiển thị |

Hệ quả phải nói thẳng với người dùng:

- Máy khác **không thấy** số liệu này.
- Xóa lịch sử duyệt / dùng chế độ ẩn danh / đổi trình duyệt là **mất sạch**.
- Không có bản sao lưu nào.

Vì vậy localStorage chỉ dùng để chạy thử. Chạy thật thì phải nối Supabase.

## Project và hiện trạng

Project: dùng chung project Supabase mà SDFactory đang chạy. URL và anon key
lấy ở Dashboard → Project Settings → API — **không ghi vào file nào trong repo**.

Đang có sẵn của SDFactory (188 dòng SQL, 3 migration):

| Loại | Số lượng | Tên |
|---|---|---|
| Bảng | **3** | `sites`, `events`, `state_snapshots` |
| Function | 3 | `block_event_mutation`, `touch_updated_at`, `app_has_cap` |
| Trigger | 3 | `events_no_update`, `events_no_delete`, `snapshots_touch` |
| Policy | 6 | đọc/ghi cho 3 bảng trên |
| Index | 5 | trên `events` |

## Quy ước đặt tên: tiếng Việt KHÔNG DẤU

**Có nên đặt tên bảng bằng tiếng Việt không?** Có — nhưng **bỏ dấu**.

| Kiểu | Ví dụ | Kết luận |
|---|---|---|
| Tiếng Việt không dấu ✔ | `nhap_nguyen_lieu`, `so_luong_kg` | **Chọn cái này.** Người đọc sổ hiểu ngay, SQL viết trần không cần nháy |
| Tiếng Việt có dấu ✘ | `"nhập_nguyên_liệu"` | Postgres cho phép nhưng phải bọc `"…"` ở **mọi** câu lệnh. Nguy hiểm hơn: dấu tiếng Việt có 2 cách mã hóa Unicode (NFC/NFD) trông y hệt nhau nhưng là **hai định danh khác nhau** — copy từ Word/Chrome về là gặp `relation does not exist` không hiểu vì sao. Công cụ migration, export CSV, log lỗi đều rối theo |
| Tiếng Anh ✘ | `raw_materials` | Mất nghĩa nghiệp vụ với người dùng và kế toán |

Cũng **bỏ tiền tố `mes_`** vì project này giờ chỉ phục vụ MES.

## Schema mới — 11 bảng

[`supabase/migrations/0001_baseafood_mes.sql`](../supabase/migrations/0001_baseafood_mes.sql)

| Nhóm | Bảng |
|---|---|
| Tổ chức | `xi_nghiep` |
| Danh mục | `dai_ly` · `loai_nguyen_lieu` · `thanh_pham` (141 mã kế toán) · `mat_hang` · `khach_hang` |
| Nhập hàng | `nhap_nguyen_lieu` |
| Cân đối | `ky_can_doi` · `nguyen_lieu_vao` · `phe_lieu` · `thanh_pham_ra` |

Vài quyết định đáng nhớ:

- `nhap_nguyen_lieu.ten_dai_ly` / `ten_loai_nguyen_lieu` lưu **TÊN**, không phải
  khóa ngoại. Sổ sách phải giữ nguyên tên tại thời điểm nhập — đại lý đổi tên
  sau này không được làm sai bản ghi đã chốt.
- `thanh_pham` khóa chính là **`ma`** (mã kế toán), không phải id sinh tự động.
  141 mã trong `src/data/thanh-pham.json` giờ chỉ là **seed**: app tự đẩy lên
  lần đầu nếu bảng rỗng, sau đó DB là nguồn thật.
- `check` ràng buộc giá trị hợp lệ ngay ở DB: `phan_xuong ∈ (Đông, Cá, Khô)`,
  `kenh ∈ (Xuất khẩu, Nội địa)`, mọi khối lượng `>= 0`.
- Xóa `ky_can_doi` thì 3 khối con `cascade` theo.

## Các bước chạy

### Bước 1 — tạo schema MES

Supabase Dashboard → **SQL Editor** → dán toàn bộ `0001_baseafood_mes.sql` → Run.

File tự dọn bản nháp `mes_*` cũ nếu đã lỡ chạy migration trước đó.

### Bước 2 (tùy chọn, PHÁ HỦY) — gỡ bảng SDFactory

[`0002_go_bo_sdfactory.sql`](../supabase/migrations/0002_go_bo_sdfactory.sql)
xóa `events`, `state_snapshots`, `sites` + 3 function của SDFactory.

> ⚠️ **Không hoàn tác được.** `public.events` là spine append-only mà chính
> SDFactory thiết kế để không bao giờ xóa được (có trigger chặn UPDATE/DELETE).
> Trước khi chạy: tạo backup ở Dashboard → Database → Backups, và xác nhận
> SDFactory đã thật sự ngừng dùng project này.
>
> Không chạy cũng chẳng sao — tên bảng hai bên không trùng nhau, để yên không
> ảnh hưởng gì tới MES.

### Bước 3 — điền `.env`

```bash
cp .env.example .env
```

Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`, cả hai lấy ở
Dashboard → **Project Settings → API**.

`.env.example` cố tình để trống cả URL: repo private vẫn nên sạch, ai được thêm
vào repo về sau không cần biết ngay project nào để nhắm tới.

**Không bao giờ** đặt `service_role` key vào file này: Vite nhúng mọi biến
`VITE_*` thẳng vào bundle mà ai mở trình duyệt cũng đọc được.

`VITE_SITE_ID=bsf1` khớp `xi_nghiep.id`; mọi truy vấn lọc theo `xi_nghiep_id`
nên thêm xí nghiệp sau không phải đổi schema.

### Bước 4 — kiểm tra

`npm run dev` → góc dưới thanh bên hiện **"Đã nối máy chủ"** màu xanh.
Nếu hiện "Mất kết nối máy chủ" thì đọc câu lỗi ngay dưới đó.

Kiểm tra danh sách bảng còn lại:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

## Cách tầng dữ liệu hoạt động

[`src/lib/repo.ts`](../src/lib/repo.ts) — một API cho cả hai chế độ:

- Chưa có env → đọc/ghi localStorage như cũ.
- Có env → đọc/ghi Supabase, **đồng thời** ghi bản sao xuống localStorage. Mất
  mạng giữa ca vẫn còn số liệu để đối chiếu, không trắng màn hình.

Màn hình viết `const [rows, ghi] = useNhapNL()` và truyền nguyên danh sách mới;
tầng repo tự so danh sách cũ/mới để biết dòng nào `upsert`, dòng nào `delete`.

Muốn đẩy số liệu đang có trên máy lên máy chủ: mở màn tương ứng rồi sửa/lưu một
dòng bất kỳ — tầng repo sẽ đẩy toàn bộ danh sách lên. Bản nhập khẩu hàng loạt
chưa làm.

## Bảo mật

### Đang ở đâu

`0001` mở quyền `anon` đọc/ghi mọi bảng nghiệp vụ (`using (true)`) vì app chưa
có đăng nhập. Anon key nằm trong bundle JS, ai mở DevTools cũng lấy được →
**ai có key là sửa được số liệu sản xuất**.

Chấp nhận được khi và chỉ khi app chạy trong mạng nội bộ xí nghiệp.

### Phải làm gì trước khi mở ra ngoài

1. Thêm màn đăng nhập bằng Supabase Auth (chưa làm).
2. Chạy [`0003_siet_rls.sql`](../supabase/migrations/0003_siet_rls.sql) — thu
   hồi toàn bộ quyền của `anon`, chỉ còn `authenticated`.
   **Chạy trước bước 1 thì app ngừng đọc/ghi được** (không mất dữ liệu, nhưng
   người dùng không làm việc được).
3. Phân vai (chưa thiết kế): tổ trưởng chỉ ghi xưởng mình, kế toán đọc tất cả,
   giám đốc chỉ đọc.

### Không để lộ định danh trong repo

- `.env` nằm trong `.gitignore`; `.env.example` để trống cả URL lẫn key.
- Không ghi project ref / URL vào tài liệu, migration hay mã nguồn.
- Nếu anon key từng bị commit ở bất kỳ repo nào: rotate lại ở Dashboard →
  Project Settings → API → Rotate.
