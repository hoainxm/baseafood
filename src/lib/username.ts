// ============================================================
// Tên file: src/lib/username.ts
// Tên tiếng Việt tương đương: Tiện ích Chuẩn hóa Tên đăng nhập
// Description: Username formatting, sanitization, and display helpers
// ============================================================
/**
 * Sinh username từ họ tên: chữ đầu mỗi từ TRỪ từ cuối + từ cuối đầy đủ, bỏ dấu.
 * "Phan Nguyễn Hoài Nam" → "pnhnam". Một từ → chính nó.
 *
 * Email đăng nhập tổng hợp = `<username>@bsf1.vn` (Supabase Auth cần email;
 * người dùng chỉ gõ username, app ghép đuôi).
 *
 * ⚠️ KHÔNG dùng `.local` (hay `.test` / `.example` / `.invalid`): GoTrue chặn các
 * TLD dành riêng này khi signUp ("Email address ... is invalid"). Dùng TLD thật
 * `.vn` — email tổng hợp không nhận mail nên chỉ cần đúng định dạng, không cần MX.
 */
export const EMAIL_SUFFIX = "@bsf1.vn";

/** Bỏ dấu tiếng Việt + đổi đ→d, về chữ thường ASCII. */
export function stripAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu tổ hợp
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function fullNameToUsername(fullName: string): string {
  const words = stripAccents(fullName).toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  const initials = words
    .slice(0, -1)
    .map((t) => t[0])
    .join("");
  return initials + words[words.length - 1];
}

/** username → email tổng hợp để đưa vào Supabase Auth. */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}${EMAIL_SUFFIX}`;
}

/** email tổng hợp → username (phần trước @). */
export function emailToUsername(email: string): string {
  return (email || "").split("@")[0] || "";
}
