import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/*
 * Canh luật MÀU NÚT THEO CHỨC NĂNG (README design-system § 8b, CLAUDE.md quy tắc 16):
 * nút Lưu phải xanh lá (`save`), Sửa / Mở lại xanh dương (`edit`), Xóa / Bỏ đỏ
 * (`danger`, hoặc `destructive` cho nút xác nhận), Chốt hổ phách (`lock`). Quét mã
 * nguồn mọi <Button> ở features + design-system, dò ý nghĩa qua icon và chữ đầu nhãn.
 * Nút mới quên variant ⇒ test đỏ, CI chặn.
 */
const ROOT = new URL("../../", import.meta.url).pathname; // src/
const SCAN_DIRS = ["features", "design-system"];

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTsx(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** Vị trí '>' đóng thẻ mở (bỏ qua '>' trong chuỗi và trong {…}). */
function openingTagEnd(src: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'" || c === "`")) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

type Intent = "save" | "edit" | "danger" | "lock";
const ALLOWED: Record<Intent, string[]> = {
  save: ["save"],
  edit: ["edit"],
  danger: ["danger", "destructive"],
  lock: ["lock"],
};

/** Ý nghĩa nút suy từ icon trước, rồi tới chữ đầu nhãn. null = nút trung tính. */
function intentOf(body: string): Intent | null {
  if (/<Pencil\b/.test(body) || /<LockOpen\b/.test(body)) return "edit";
  if (/<Trash2\b/.test(body)) return "danger";
  if (/<Lock\b(?!Open)/.test(body)) return "lock";
  if (/<Save\b/.test(body)) return "save";
  const label = body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^Lưu\b/.test(label)) return "save";
  if (/^Chốt\b/.test(label)) return "lock";
  if (/^(Xóa|Xoá)\b/.test(label)) return "danger";
  if (/^(Sửa|Mở lại ngày|Mở lại kỳ)\b/.test(label)) return "edit";
  return null;
}

function scan() {
  const issues: string[] = [];
  let checked = 0;
  for (const dir of SCAN_DIRS) {
    for (const file of listTsx(join(ROOT, dir))) {
      const src = readFileSync(file, "utf8");
      const tag = /<(Button|AlertDialogAction)\b/g;
      let m: RegExpExecArray | null;
      while ((m = tag.exec(src))) {
        const end = openingTagEnd(src, m.index);
        if (end < 0 || src[end - 1] === "/") continue;
        const close = src.indexOf(`</${m[1]}>`, end);
        if (close < 0) continue;
        const attrs = src.slice(m.index, end);
        const intent = intentOf(src.slice(end + 1, close));
        if (!intent) continue;
        checked++;
        const variant = attrs.match(/variant=(?:"([^"]*)"|\{([^}]*)\})/);
        const value = variant ? (variant[1] ?? variant[2]) : "default";
        // variant động ({cond ? "a" : "b"}) ⇒ chỉ cần có mặt variant đúng nghĩa
        const ok = ALLOWED[intent].some((v) => value === v || value.includes(`"${v}"`));
        if (!ok) {
          const line = src.slice(0, m.index).split("\n").length;
          issues.push(`${relative(ROOT, file)}:${line} — nút "${intent}" đang variant=${value}`);
        }
      }
    }
  }
  return { issues, checked };
}

describe("màu nút theo chức năng", () => {
  test("mọi nút Lưu / Sửa / Xóa / Chốt dùng đúng variant", () => {
    const { issues, checked } = scan();
    expect(checked).toBeGreaterThan(50); // bộ quét còn bắt được nút — tránh test xanh rỗng
    expect(issues).toEqual([]);
  });
});
