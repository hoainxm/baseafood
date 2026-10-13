import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SAC_TO_LIB, normalizeRowMarkColor } from "@/lib/rowMarks";
import { MARK_COLOR_GRID, DARK_MARK_COLORS, MARK_SHADES, MARK_COLORS, getMarkColorName } from "./rowMarkSource";

/*
 * Canh bảng màu tô (README design-system § Tô màu dòng): token trong tokens.css,
 * danh sách sắc ở design-system và lib, danh sách ô "tối" phải luôn khớp nhau —
 * sửa một chỗ quên chỗ kia là ô màu trắng trơn hoặc chữ không đọc được.
 */
const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

function token(ten: string): string {
  const m = css.match(new RegExp(`--${ten}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`Thiếu token --${ten} trong tokens.css`);
  return m[1];
}

/** Độ chói tương đối WCAG 2.x. */
function doChoi(hex: string): number {
  const kenh = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = kenh.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [doChoi(a), doChoi(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("bảng màu tô kiểu Excel", () => {
  const allColors = MARK_COLOR_GRID.flat();

  test("10 sắc × 5 mức, sắc ở design-system khớp lib", () => {
    expect(MARK_COLORS).toHaveLength(10);
    expect(MARK_SHADES).toHaveLength(5);
    expect(allColors).toHaveLength(50);
    expect(MARK_COLORS.map((s) => s.ma)).toEqual([...SAC_TO_LIB]);
  });

  test("mọi mã có token màu + tên đọc được, lib nhận mã", () => {
    for (const ma of allColors) {
      expect(token(`to-${ma}`)).toMatch(/^#/);
      expect(getMarkColorName(ma)).not.toBe("");
      expect(normalizeRowMarkColor(ma)).toBe(ma);
    }
    for (const s of MARK_COLORS) expect(token(`to-${s.ma}-line`)).toMatch(/^#/);
  });

  test("chữ thường luôn ≥ 4,5:1 trên mọi ô, kể cả mức đậm nhất", () => {
    const chu = token("foreground");
    for (const ma of allColors) expect(contrast(token(`to-${ma}`), chu), ma).toBeGreaterThanOrEqual(4.5);
  });

  test("DARK_MARK_COLORS đúng các ô độ chói < 0,68 (chữ phụ/chữ màu đổi về chữ thường)", () => {
    const darkCodes = allColors.filter((ma) => doChoi(token(`to-${ma}`)) < 0.68);
    expect([...DARK_MARK_COLORS].sort()).toEqual(darkCodes.sort());
  });

  test("ô không tối: chữ phụ + chữ đỏ vẫn ≥ 4,5:1", () => {
    const phu = token("muted-foreground");
    const loi = token("destructive");
    for (const ma of allColors.filter((m) => !DARK_MARK_COLORS.has(m))) {
      expect(contrast(token(`to-${ma}`), phu), ma).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(`to-${ma}`), loi), ma).toBeGreaterThanOrEqual(4.5);
    }
  });
});
