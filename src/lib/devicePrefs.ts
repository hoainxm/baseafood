// ============================================================
// Tên file: src/lib/devicePrefs.ts
// Tên tiếng Việt tương đương: Cài đặt theo máy (đọc/ghi an toàn)
// Description: Per-device UI preferences (last workshop picked, collapsed
// groups…). Screens must not touch localStorage directly (CLAUDE.md rule 4);
// these never throw — blocked cookies / full quota just mean "no preference".
// Business data does NOT go here: it goes through lib/repo.ts.
// ============================================================

export function readDevicePref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDevicePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* chặn cookie / hết quota — cài đặt theo máy chỉ là tiện lợi, bỏ qua */
  }
}

/**
 * Cài đặt dạng JSON (vd. nhóm nav gập/mở). Thiếu khóa, JSON hỏng hoặc không qua
 * `isValid` ⇒ trả `fallback` — giá trị cũ lạ trên máy không làm vỡ màn.
 */
export function readDevicePrefJson<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T,
): T {
  const raw = readDevicePref(key);
  if (raw == null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (isValid ? !isValid(value) : value == null) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

export function writeDevicePrefJson(key: string, value: unknown): void {
  let raw: string | undefined;
  try {
    raw = JSON.stringify(value);
  } catch {
    return; /* vòng tham chiếu / BigInt — không lưu được thì thôi */
  }
  if (raw !== undefined) writeDevicePref(key, raw);
}
