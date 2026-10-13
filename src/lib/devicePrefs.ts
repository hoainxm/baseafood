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
