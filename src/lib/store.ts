// ============================================================
// Tên file: src/lib/store.ts
// Tên tiếng Việt tương đương: Lưu trữ Cấu hình Giao diện & User Profile
// Description: Display preferences and current active user persistence
// ============================================================
// Sinh id cho bản ghi mới.
// Đọc/ghi dữ liệu đi qua src/lib/repo.ts (Supabase hoặc localStorage) —
// không truy cập localStorage trực tiếp từ màn hình nữa.

// MỘT hàm sinh id cho cả app — xem `uid` ở db.ts (mốc ms + UUID, không trùng).
export { uid as newId } from "@/lib/db";
