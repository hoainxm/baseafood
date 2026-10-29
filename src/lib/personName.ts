// ============================================================
// Tên file: src/lib/personName.ts
// Tên tiếng Việt tương đương: Tên người — ghi sổ / tên gọi / nhãn chọn người
// Description: Which name of a user to show where (ba-spec 47)
// ============================================================
// Một người có 3 tên: họ tên thật · tên gọi (nickname, mig 0086) · tên đăng nhập.
// Luật (docs/app-map/47-user-display-name.ba-spec.md):
//   R1 GHI SỔ (người ghi / lập / giao / nhận, nhật ký, nhãn in, chứng từ) ⇒ `recordName` — họ tên,
//      KHÔNG BAO GIỜ tên gọi. Test quét mã chặn màn ghi đọc thẳng `displayName`.
//   R2 GỌI người đang dùng (lời chào, menu tài khoản) ⇒ `callName` — tên gọi trước.
//   R3 NGƯỜI KHÁC nhận diện (chọn người, danh sách người) ⇒ `personLabel` — tên gọi KÈM họ tên.
//   R4 phạm vi `own` không xét tên gọi — `scopeContextFor` nhận họ tên, đừng truyền tên gọi.
import type { UserProfile } from "@/types";
import { stripAccents } from "@/lib/username";

type Person = Pick<UserProfile, "fullName" | "username"> & { displayName?: string };

/** Tối đa ký tự của tên gọi (R5) — khớp kiểm ở hàm máy chủ `set_own_display_name` (0086). */
export const DISPLAY_NAME_MAX = 30;

const clean = (v: string | undefined) => (v ?? "").trim();

/** Tên GHI SỔ (R1): họ tên ⇒ tên đăng nhập. Không bao giờ là tên gọi. */
export function recordName(p: Person | null | undefined, fallback = ""): string {
  return clean(p?.fullName) || clean(p?.username) || fallback;
}

/** Tên GỌI người đang dùng (R2): tên gọi ⇒ họ tên ⇒ tên đăng nhập. */
export function callName(p: Person | null | undefined, fallback = ""): string {
  return clean(p?.displayName) || recordName(p, fallback);
}

/** Nhãn cho NGƯỜI KHÁC nhận diện (R3): "Alley · Nguyễn Như Thanh Trúc"; không tên gọi ⇒ họ tên. */
export function personLabel(p: Person | null | undefined, fallback = ""): string {
  const real = recordName(p, fallback);
  const nick = clean(p?.displayName);
  return nick && nick !== real ? `${nick} · ${real}` : real;
}

/** Chuỗi để tìm người: gõ tên gọi, họ tên hay tên đăng nhập đều ra (NV3). */
export function personSearchText(p: Person): string {
  return [p.displayName, p.fullName, p.username].map(clean).filter(Boolean).join(" ");
}

/** So tên: bỏ dấu, thường hóa, gộp khoảng trắng ("Trần  Thị Mai" ≡ "tran thi mai"). */
function fold(v: string): string {
  return stripAccents(v).toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Kiểm tên gọi trước khi lưu (R5). Trả `value` sẽ lưu ('' = bỏ tên gọi) hoặc `error`.
 * `others` = hồ sơ người KHÁC (không gồm chính người đó).
 */
export function checkDisplayName(
  input: string,
  self: Pick<Person, "fullName">,
  others: readonly Person[]
): { value: string; error?: undefined } | { value?: undefined; error: string } {
  const value = input.trim();
  if (!value) return { value: "" };
  if (value.length > DISPLAY_NAME_MAX) return { error: `Tên gọi tối đa ${DISPLAY_NAME_MAX} ký tự` };
  const key = fold(value);
  if (key === fold(self.fullName ?? "")) return { value: "" };
  const clash = others.find((o) => fold(o.fullName ?? "") === key || (!!o.displayName && fold(o.displayName) === key));
  if (clash) return { error: `Trùng tên của người khác (${personLabel(clash)}) — chọn tên gọi khác để khỏi nhầm người` };
  return { value };
}

/**
 * Máy chủ đã có cột tên gọi chưa (0086): hồ sơ đọc về có trường `displayName` ⇒ có.
 * Chạy localStorage (không máy chủ) ⇒ luôn có.
 */
export function isDisplayNameAvailable(profiles: readonly Pick<UserProfile, "displayName">[], isServerConnected: boolean): boolean {
  return !isServerConnected || profiles.some((p) => p.displayName !== undefined);
}
