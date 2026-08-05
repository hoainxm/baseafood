// Bộ đệm localStorage cấp thấp. Màn hình KHÔNG gọi trực tiếp — đi qua
// src/lib/repo.ts để chạy được cả hai chế độ (Supabase / chỉ máy này).
// Khóa localStorage khai báo trong repo.ts (AnhXaBang.localKey).

export function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function save<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Hết dung lượng / chế độ riêng tư: bỏ qua, máy chủ vẫn là nguồn chính.
  }
}

export function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
