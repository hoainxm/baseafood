// Sinh id cho bản ghi mới.
// Đọc/ghi dữ liệu đi qua src/lib/repo.ts (Supabase hoặc localStorage) —
// không truy cập localStorage trực tiếp từ màn hình nữa.

export function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
