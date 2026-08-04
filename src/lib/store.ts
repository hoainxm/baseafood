import type { DongNhapNL } from "@/types";

// Lưu tạm bằng localStorage (giai đoạn đầu, chưa cutover Supabase).
// Không xóa bản ghi — chỉ thêm/sửa; xóa dùng cờ ẩn ở bản sau.
const KEY = "bsf.nhap-nl.v1";

export function loadNhapNL(): DongNhapNL[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DongNhapNL[]) : [];
  } catch {
    return [];
  }
}

export function saveNhapNL(rows: DongNhapNL[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
