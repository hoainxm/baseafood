import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/*
 * Canh KHÓA CŨ sót sau đợt đổi tên tiếng Việt → tiếng Anh (docs/spec/quy-uoc-dat-ten.md):
 * dòng phụ của ô chọn là `subLabel` (cũ `phu`), dòng phụ thẻ thống kê là `subtext`, số
 * thẳng cột là `numeric` (cũ `so`). Khóa cũ nằm trong object `.map(...)` / mảng không khai
 * kiểu nên TypeScript KHÔNG bắt — dòng phụ mất lặng lẽ (2026-10-15 phát hiện 13 chỗ: lô xả
 * đông ở Cân đối không thấy tồn còn, ô mã 141 ở Danh mục gõ mã không tìm ra…).
 * Quét mã nguồn features + design-system + lib: gặp lại `phu:` / `so: true` ⇒ test đỏ.
 */
const ROOT = new URL("../../", import.meta.url).pathname; // src/
const SCAN_DIRS = ["features", "design-system", "lib"];

function listSource(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSource(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

/** Khóa object cũ: `phu:` / `phu?:` (ô chọn, thẻ) và `so: true` (thẻ thống kê). */
const LEGACY_KEY = /(?:^|[\s{,(])(phu\??:\s|so:\s*true\b)/;

describe("không còn khóa cũ phu / so trong object hiển thị", () => {
  const files = SCAN_DIRS.flatMap((d) => listSource(join(ROOT, d)));

  test("quét được mã nguồn", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("mọi option / thẻ dùng subLabel · subtext · numeric", () => {
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, "");
          if (/^\s*\*/.test(code)) return; // dòng chú thích khối
          if (LEGACY_KEY.test(code)) hits.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(hits, "Đổi phu → subLabel (ô chọn) / subtext (thẻ), so → numeric").toEqual([]);
  });
});
