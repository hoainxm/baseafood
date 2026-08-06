> Load khi: đụng đọc/ghi dữ liệu, thêm bảng vào app, hay điều tra "số liệu biến mất / không lên máy chủ".
covers: src/lib/repo.ts, src/lib/db.ts, src/lib/danhMuc.ts, src/lib/ketNoi.ts, src/lib/supabase.ts, src/lib/store.ts, src/design-system/patterns/TrangThaiDuLieu.tsx
last_verified: 2026-08-06
ttl_days: 90

# Tầng dữ liệu & đồng bộ

Một API duy nhất cho hai chế độ. Màn hình chỉ viết:

```ts
const [rows, ghi] = useNhapNL();   // ghi(next) — truyền NGUYÊN danh sách mới
```

Chạy Supabase hay localStorage là do `.env` quyết định (`src/lib/supabase.ts`: thiếu URL **hoặc** anon key ⇒ `supabase = null`). Màn hình không được biết sự khác biệt này.

## Vì sao thiết kế "truyền cả danh sách"

Không có `add/update/delete` riêng. `useBang.ghi(next)` **so danh sách cũ với mới** để suy ra dòng nào thêm/sửa/xóa. Đổi lại:

- Màn hình viết code thuần (map/filter), không phải nghĩ về API mạng.
- **Bẫy:** repo trả về **toàn bộ** dòng của mọi kỳ/mọi ngày. Màn nào lọc ra tập con thì lúc ghi **phải ghép lại** với phần còn lại (`KyDetail.ghepLai` trong `CanDoi.tsx` là mẫu). Quên ghép = xóa sạch dữ liệu của kỳ khác.
- So sánh bằng `JSON.stringify` → thứ tự khóa trong object có ý nghĩa; đừng dựng lại object với thứ tự trường khác chỉ để "cho đẹp", sẽ tạo update thừa.

## Hàng chờ đồng bộ — đừng tháo

Ghi lên máy chủ hụt giữa ca là chuyện thường (wifi rớt, tablet ngủ). Mỗi bảng giữ một hàng chờ ở `localStorage` khóa `<localKey>.cho`:

- `them`: khóa các dòng thêm/sửa chưa lên server.
- `xoa`: tombstone các dòng đã xóa dưới máy nhưng chưa xóa được trên server.

Bất biến:

1. **Ghi hàng chờ TRƯỚC khi gọi server.** Hụt thì lần sau còn dấu để đẩy lại.
2. Lúc mở app, **hoà** server với local chưa đẩy — nền là server, dòng trong `them` thắng, dòng trong `xoa` bị gỡ. **Không đè mù**, nếu không reload sẽ nuốt chuyến hàng ghi hụt.
3. Mọi lần ghi *và* mọi lần mở app đều thử đẩy lại toàn bộ hàng chờ.
4. Bản sao localStorage luôn được ghi, kể cả khi đang chạy Supabase — mất mạng giữa ca vẫn còn số để đối chiếu.

Hệ quả cho người vận hành: chưa chạy migration mới ⇒ số liệu **không mất**, nằm trong hàng chờ, tự lên khi DB sẵn sàng. Nhưng máy khác chưa thấy.

## Thêm một bảng vào app

1. Migration DB ([03-database.md](03-database.md)).
2. Thêm `interface` + bất biến vào `src/types.ts`.
3. Thêm `BANG_X: AnhXaBang<T>` trong `repo.ts`: `table`, `localKey` (**đặt mới, đừng đổi khóa cũ** — đổi là mất dữ liệu đang có trên máy người dùng), `toRow`/`fromRow` đủ hai chiều, `khoaChinh` nếu không phải `id`.
4. Thêm `export const useX = () => useBang(BANG_X)` trong `lib/danhMuc.ts`.
5. Màn hình gọi hook đó — **không** import `repo.ts` trực tiếp trừ khi cần `AnhXaBang`.

## `vaDongCu` — vá dòng cũ, một chỗ

Bản sao localStorage được đọc thẳng bằng `JSON.parse`, **không đi qua `fromRow`** ⇒ dòng ghi từ bản app trước sẽ thiếu trường mới thêm. Vá ở `vaDongCu` (một chỗ) thay vì rải `?? ""` khắp màn hình. Ví dụ đang có: `chuyenId` (dòng trước khi có chuyến thật), `nguon`/`ngay`/`phanXuong` của `phe_lieu`, `quyCach`/`banHangId` của `thanh_pham_ra` (dòng trước khi có sổ bán).

Bán thành phẩm dùng `usePhieuBan()` / `useBanHang()` (`BANG_PHIEU_BAN` / `BANG_BAN_HANG`) — cùng khuôn `useBang`, xem [33-ban-hang.md](33-ban-hang.md).

## Seed

`useBang(bang, seed)` — seed chỉ chạy khi **cả** server lẫn local đều rỗng và hàng chờ rỗng; khi đó seed được đẩy lên server luôn. Đang seed: `loai_nguyen_lieu` (12 loại hay gặp) và `thanh_pham` (141 mã từ `src/data/thanh-pham.json`). File JSON đó **chỉ là seed** — nguồn thật là bảng `thanh_pham`.

## Đèn kết nối

`lib/ketNoi.ts` là store nhỏ dùng chung, quy ước **"lần gần nhất thắng"**: mỗi thao tác server (bảng nào cũng vậy) báo về; ghi lỗi → đỏ ngay, lần ghi sau thành công → xanh lại. Cố tình không phải "probe 1 bảng lúc mở app rồi xanh mãi" — đèn phải phản ánh sức khỏe ghi/đọc thật. `TrangThaiDuLieu` (góc thanh bên) đọc qua `useSyncExternalStore`; snapshot bất biến, đừng trả object mới mỗi lần gọi (render vô hạn).

## Cross-references

- Schema, quy ước tên cột: [03-database.md](03-database.md)
- Rủi ro anon key / RLS: [05-bao-mat-phan-quyen.md](05-bao-mat-phan-quyen.md)
- Mẫu ghép lại danh sách con: `KyDetail` trong [31-can-doi-ky.md](31-can-doi-ky.md)
