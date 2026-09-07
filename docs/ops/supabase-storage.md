# Hạ tầng lưu ảnh (Supabase Storage) — QĐ-8 ảnh QC + nền OCR (QĐ-1)

> **✅ ĐÃ BUILD ảnh QC (2026-09-07):** bucket tên **`qc`** (chủ dự án tạo, private +
> RLS authenticated đã chạy) · migration `0039_qc_photos.sql` (cột
> `qc_checklists.photo_paths jsonb`) · `src/lib/storage.ts` (nén→upload→signed URL,
> hằng `BUCKET="qc"`) · nút "Chụp / chọn ảnh" + xem/xóa ảnh mỗi chỉ tiêu ở màn `/qc`
> (`QcChecklistScreen`, ẩn khi `!supabase`). Đã verify end-to-end trên bucket thật.
> **Lưu ý:** bucket tên `qc` (KHÔNG phải `bsf-anh` như mẫu mục 1–2 bên dưới) —
> policy RLS check `bucket_id = 'qc'`. OCR phiếu tay (QĐ-1) vẫn để sau, dùng lại
> `lib/storage.ts` cùng bucket, thư mục `phieu-nhap/`.

> Load khi: cần lưu **ảnh** (ảnh QC chấm điểm cuối ngày, ảnh phiếu tay chụp để
> OCR, ảnh chứng từ). Dùng **Supabase Storage** — cùng dự án Supabase đang chạy,
> **không cần dịch vụ mới, không cần key mới**.

**Rủi ro:** 🔴 phần tạo bucket + RLS chạy trên **dashboard/SQL Editor Supabase của
xí nghiệp** — chủ dự án / người có quyền tự làm (agent không đụng key/dashboard).
Phần **wire client** (nén ảnh · upload · lưu path · xem) là 🟡, làm ở session build.

🔒 **Không ghi project ref / URL / key vào bất kỳ file nào trong repo** (rule 11).
Các URL `https://<project>.supabase.co` bên dưới là chỗ điền, không commit số thật.

---

## 0. Vì sao Storage (không nhét ảnh vào Postgres)

Ảnh nặng (0.3–3 MB/tấm). Nhét base64 vào cột Postgres làm phình DB, chậm query,
tốn băng thông mỗi lần đọc dòng. Chuẩn: **file ở Storage, DB chỉ giữ ĐƯỜNG DẪN**
(path) tới file. Xem ảnh bằng **signed URL** (link có hạn) vì bucket để **private**.

Áp cho: ảnh QC (QĐ-8), ảnh phiếu tay chụp OCR (QĐ-1), sau này ảnh chứng từ nhập.

---

## 1. Tạo bucket (Dashboard → Storage → New bucket)

Tạo **1 bucket dùng chung** cho gọn, chia thư mục bên trong theo nghiệp vụ:

| Trường | Giá trị |
|---|---|
| Name | `bsf-anh` |
| Public | **TẮT** (private — ảnh sổ sách, xem qua signed URL) |
| File size limit | `5 MB` (ảnh điện thoại nén còn ~0.3–1 MB) |
| Allowed MIME types | `image/jpeg, image/png, image/webp` |

> Muốn tách riêng cho dễ phân quyền sau: `qc-photos` + `phieu-scan`. Nhưng 1 bucket
> + thư mục con đủ dùng và ít việc hơn — **khuyến nghị 1 bucket**.

**Quy ước đường dẫn trong bucket** (path = khóa file, KHÔNG dấu, không space):
```
bsf1/qc/<yyyy>/<mm>/<qc_checklist_id>-<stt>.jpg      ← ảnh QC
bsf1/phieu-nhap/<yyyy>/<mm>/<chuyen_id>-<stt>.jpg    ← ảnh phiếu tay (OCR)
```
- `bsf1` = site_id (đa xí nghiệp sau này tách theo tiền tố này).
- Chia `yyyy/mm` để 1 thư mục không phình quá nhiều file.

---

## 2. RLS cho Storage (SQL Editor — chạy 1 lần)

Storage cũng đi qua RLS trên bảng `storage.objects`. Cho **authenticated** đọc/ghi
đúng bucket, chặn `anon` (đồng bộ vòng siết `0021`). Dán vào **SQL Editor**:

```sql
-- Cho người ĐÃ ĐĂNG NHẬP tải lên bucket bsf-anh
create policy "bsf_anh_insert_authenticated"
on storage.objects for insert to authenticated
with check ( bucket_id = 'bsf-anh' );

-- Cho người ĐÃ ĐĂNG NHẬP xem/tải file trong bucket (để tạo signed URL)
create policy "bsf_anh_select_authenticated"
on storage.objects for select to authenticated
using ( bucket_id = 'bsf-anh' );

-- (tùy chọn) cho phép xóa/sửa ảnh mình vừa tải nhầm — chỉ admin nếu muốn chặt
create policy "bsf_anh_delete_authenticated"
on storage.objects for delete to authenticated
using ( bucket_id = 'bsf-anh' );
```
- **Không** cấp policy cho `anon` — khách chưa đăng nhập không đụng được ảnh.
- Idempotent hoá khi chạy lại: `drop policy if exists "<ten>" on storage.objects;`
  trước mỗi `create policy` (Postgres không có `create policy if not exists`).

> Sau khi nhà nước bắt SSCC / cần chặt hơn, siết thêm theo `owner`/đường dẫn. Bản
> đầu để mức "authenticated" cho chạy được, giống cách `0011`/`0022` mở rồi siết.

---

## 3. Cột tham chiếu trong DB (migration đợt sau — chỉ-thêm-cột)

Ảnh của một bản ghi QC lưu đường dẫn ở cột jsonb (mảng path):

```sql
-- 0039_qc_photos.sql (mẫu — chạy khi build wire ảnh QC)
alter table public.qc_checklists
  add column if not exists photo_paths jsonb;   -- ["bsf1/qc/2026/09/<id>-1.jpg", ...]
-- ROLLBACK: alter table public.qc_checklists drop column if exists photo_paths;
```
Tương tự cho phiếu nhập (OCR) khi tới đó: `import_shipments.scan_path text`.

> Chỉ **thêm cột nullable** — dòng cũ không đổi (theo mẫu `0037`/`0038`). Map thêm
> ở `repo.ts` (`BANG_QC_CHECKLIST`) cùng commit.

---

## 4. Client — nén → upload → lưu path → xem (session build làm)

Dùng chính client `supabase` sẵn có (`src/lib/supabase.ts`), gói vào
`src/lib/storage.ts` (hàm thuần, không gọi thẳng từ màn):

```ts
// Nén ảnh phía client trước khi tải (tiết kiệm băng thông + quota)
async function nenAnh(file: File, maxW = 1600, chatLuong = 0.72): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxW / img.width);
  const cv = new OffscreenCanvas(img.width * scale, img.height * scale);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.convertToBlob({ type: "image/jpeg", quality: chatLuong });
}

// Tải lên → trả PATH để lưu vào DB
export async function taiAnhLen(path: string, file: File): Promise<string | null> {
  if (!supabase) return null;                 // chế độ localStorage: bỏ qua
  const blob = await nenAnh(file);
  const { error } = await supabase.storage.from("bsf-anh")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  return error ? null : path;
}

// Xem: bucket private → tạo signed URL có hạn (vd 1 giờ)
export async function urlAnh(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from("bsf-anh")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
```
- **Không cần env/key mới** — dùng `SUPABASE_URL` + `ANON_KEY` hiện có.
- Bắn `notify` khi tải xong; hỏng mạng thì cho lưu bản ghi trước, ảnh gắn sau
  (ảnh là phụ, không chặn chốt ngày — giống nhật ký `audit.ts`).
- Chế độ chưa cấu hình Supabase (`!supabase`): ẩn nút chụp ảnh, không vỡ.

---

## 5. Giới hạn cần biết

- **Free tier Supabase:** ~1 GB Storage + 2 GB băng thông/tháng. Ảnh nén ~0.5 MB
  ⇒ ~2000 ảnh. QC ~10 chỉ tiêu × 3 xưởng × 30 ngày ≈ 900 ảnh/tháng → **nén là bắt
  buộc**; theo dõi dung lượng, lên gói trả phí khi cần.
- **Xoá ảnh cũ:** cân nhắc job dọn ảnh > N tháng (khi lên realtime lâu dài).
- **Quyền riêng tư:** bucket private + signed URL hết hạn ⇒ link lộ ra ngoài cũng
  vô hiệu sau 1 giờ. Đừng để bucket public.

---

## 6. Thứ tự làm (khi bật tính năng ảnh)

1. **Chủ dự án (dashboard):** tạo bucket `bsf-anh` (mục 1) + chạy RLS (mục 2).
2. **Session build:** migration cột `photo_paths` (mục 3) + `lib/storage.ts` (mục 4)
   + nút "Chụp/Chọn ảnh" ở màn QC (`/qc`) → lưu path → xem qua signed URL.
3. **OCR (QĐ-1) sau:** cùng bucket, thư mục `phieu-nhap/`; ảnh phiếu tay → gọi
   dịch vụ OCR (Google Vision / tự host) → đổ vào các ô form. OCR là bước riêng
   sau khi ảnh chạy ổn.

## Cross-references
- Cutover Supabase, lấy URL/key: [`supabase-setup.md`](supabase-setup.md)
- Màn QC (QĐ-8): `src/features/quality-check` · migration `0036` · [`03-database.md`](../app-map/03-database.md)
- Form nhập + OCR (QĐ-1): [`hop-2026-09-02 §QĐ-1`](../trien-khai/hop-2026-09-02-form-nhap-trace-gia-qc.md)
