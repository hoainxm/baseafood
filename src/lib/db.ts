// Kho localStorage dùng chung (giai đoạn đầu, chưa cutover Supabase).
// Không xóa bản ghi nghiệp vụ tùy tiện — xóa dòng nháp thì lọc bỏ theo id.

export const KEYS = {
  matHang: "bsf.mathang.v1",
  khachHang: "bsf.khachhang.v1",
  ky: "bsf.ky.v1",
  nlVao: "bsf.nlvao.v1",
  pheLieu: "bsf.phelieu.v1",
  tp: "bsf.tp.v1",
} as const;

export function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function save<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

export function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
