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
  if (words.length === 1) return normalizeUsername(words[0]);
  const initials = words
    .slice(0, -1)
    .map((t) => t[0])
    .join("");
  return normalizeUsername(initials + words[words.length - 1]);
}

/**
 * Chuẩn tên đăng nhập: CHỈ chữ thường không dấu + số (bỏ dấu chấm, khoảng trắng, gạch…).
 * Chốt 2026-10-15: từng cấp 2 tài khoản cho 1 người (`nnt.truc` / `nnttruc`) chỉ vì
 * khác dấu chấm ⇒ cấm dấu chấm ở MỌI chỗ nhập tên đăng nhập.
 */
export function normalizeUsername(v: string): string {
  return stripAccents(v).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Kiểm tên gõ ở màn đăng nhập: null = hợp lệ, chuỗi = lỗi hiện cho người dùng.
 * Chốt 2026-10-29: KHÔNG tự bỏ dấu chấm lúc đăng nhập nữa — gõ `nnt.truc` từng âm thầm
 * vào `nnttruc`, người dùng tưởng tài khoản đã xóa vẫn đăng nhập được. Chữ hoa + khoảng
 * trắng hai đầu vẫn cho (không đổi nghĩa tên). Gõ nguyên email (có @) thì không kiểm.
 */
export function loginUsernameError(input: string): string | null {
  const u = input.trim().toLowerCase();
  if (u.includes("@") || /^[a-z0-9]+$/.test(u)) return null;
  return "Sai tên đăng nhập — tên đăng nhập chỉ gồm chữ thường không dấu và số, không có dấu chấm hay khoảng trắng";
}

/** username → email tổng hợp để đưa vào Supabase Auth. KHÔNG chuẩn hoá (gõ "nnt.truc" ⇒
 *  `nnt.truc@…`, không vào `nnttruc`) — màn đăng nhập chặn trước bằng `loginUsernameError`.
 *  Gõ nguyên email (có @) thì giữ nguyên. */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}${EMAIL_SUFFIX}`;
}

/** email tổng hợp → username (phần trước @). */
export function emailToUsername(email: string): string {
  return (email || "").split("@")[0] || "";
}
