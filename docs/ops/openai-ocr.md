> Load khi: đặt/đổi key OpenAI, deploy lại hàm đọc ảnh phiếu, OCR ở /imports "không dùng OpenAI", hay muốn tắt OpenAI.

covers: supabase/functions/ocr-import-slip/index.ts, src/lib/ocrCloud.ts
last_verified: 2026-10-14

# OCR phiếu nhập bằng OpenAI (Edge Function)

Nút **"Nhận diện từ ảnh phiếu"** ở `/imports` đọc ảnh bằng **OpenAI trước**, hỏng thì tự quay về **Tesseract** chạy trong trình duyệt (như trước 2026-10-14). Kết quả vẫn là NHÁP, người dùng soát từng ô — xem [30-nhap-hang](../app-map/30-nhap-hang.md).

## Vì sao key ở Edge Function

Biến `VITE_*` bị Vite nhúng thẳng vào JS gửi xuống trình duyệt ⇒ ai mở DevTools cũng lấy được. Key OpenAI vì vậy **chỉ** nằm ở Supabase secrets; trình duyệt gọi hàm `ocr-import-slip` bằng phiên đăng nhập. Luật key chung: [05-bao-mat-phan-quyen § Luật về key](../app-map/05-bao-mat-phan-quyen.md#luật-về-key--tuyệt-đối).

```
Trình duyệt (/imports) ──ảnh nén ≤1600px + tên danh mục──▶ Edge Function ocr-import-slip ──▶ OpenAI
        ▲                         (JWT người dùng)              │ kiểm co_vai_tro() (0057)
        └──────────── JSON nháp {text, date, supplier, lines} ◀─┘ key = secret OPENAI_API_KEY
```

- Cổng JWT của Supabase chặn người chưa đăng nhập (401). Trong hàm, `co_vai_tro()` chặn tài khoản tự đăng ký chưa có vai trò (403) ⇒ người lạ không đốt tiền key.
- Hàm **không ghi bảng nào, không lưu ảnh, không log ảnh**. Ảnh phiếu đã lưu riêng ở bucket `qc` ([supabase-storage](supabase-storage.md)).
- Ảnh phiếu thật của xưởng được gửi sang OpenAI — chủ dự án đồng ý 2026-10-14.

## Đặt key (chủ dự án tự làm — KHÔNG dán key vào repo/chat/commit)

1. Supabase Dashboard → project Baseafood → **Edge Functions → Secrets** (hoặc Project Settings → Edge Functions).
2. Thêm `OPENAI_API_KEY` = key OpenAI (nên tạo key riêng cho dự án này, đặt hạn mức chi tiêu ở OpenAI → Limits).
3. Tuỳ chọn `OPENAI_MODEL` (mặc định `gpt-4.1-mini`; phải là model đọc được ảnh và hỗ trợ structured outputs).
4. Không cần deploy lại hàm hay app — secret có hiệu lực ở lần gọi kế tiếp.

Chưa đặt key ⇒ hàm trả 503 `missing_key` ⇒ app dùng Tesseract, hộp thoại ghi "OpenAI chưa dùng được lúc này, đang dùng máy dự phòng".

## Deploy lại hàm

Mã nguồn: `supabase/functions/ocr-import-slip/index.ts`. Deploy lần đầu 2026-10-14 (qua Supabase MCP, `verify_jwt: true`). Lần sau: Supabase CLI `supabase functions deploy ocr-import-slip` (máy này chưa cài CLI) hoặc Dashboard → Edge Functions → sửa/deploy. **Luôn giữ bật Verify JWT.**

## Kiểm nhanh

- Gọi không đăng nhập: `POST …/functions/v1/ocr-import-slip` ⇒ **401** (đã kiểm 2026-10-14).
- Đăng nhập bằng tài khoản có vai trò → `/imports` → Nhận diện từ ảnh phiếu → hộp thoại hiện thẻ **"Đọc bằng OpenAI"**.
- Lỗi: Dashboard → Edge Functions → `ocr-import-slip` → Logs (hàm chỉ log mã lỗi HTTP của OpenAI, không log nội dung).

## Tắt / lùi

- Tắt OpenAI, giữ Tesseract: xoá secret `OPENAI_API_KEY` (hoặc xoá hàm) — app tự quay về Tesseract, không cần sửa code.
- Key lộ: **Revoke** ngay ở OpenAI → API keys, tạo key mới, đặt lại secret.
