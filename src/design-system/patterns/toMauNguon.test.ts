import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SAC_TO_LIB, chuanMau } from "@/lib/toMau";
import { LUOI_MAU, MAU_TOI, MUC_TO, SAC_TO, tenMau } from "./toMauNguon";

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
const tuongPhan = (a: string, b: string) => {
  const [x, y] = [doChoi(a), doChoi(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("bảng màu tô kiểu Excel", () => {
  const tatCa = LUOI_MAU.flat();

  test("10 sắc × 5 mức, sắc ở design-system khớp lib", () => {
    expect(SAC_TO).toHaveLength(10);
    expect(MUC_TO).toHaveLength(5);
    expect(tatCa).toHaveLength(50);
    expect(SAC_TO.map((s) => s.ma)).toEqual([...SAC_TO_LIB]);
  });

  test("mọi mã có token màu + tên đọc được, lib nhận mã", () => {
    for (const ma of tatCa) {
      expect(token(`to-${ma}`)).toMatch(/^#/);
      expect(tenMau(ma)).not.toBe("");
      expect(chuanMau(ma)).toBe(ma);
    }
    for (const s of SAC_TO) expect(token(`to-${s.ma}-line`)).toMatch(/^#/);
  });

  test("chữ thường luôn ≥ 4,5:1 trên mọi ô, kể cả mức đậm nhất", () => {
    const chu = token("foreground");
    for (const ma of tatCa) expect(tuongPhan(token(`to-${ma}`), chu), ma).toBeGreaterThanOrEqual(4.5);
  });

  test("MAU_TOI đúng các ô độ chói < 0,68 (chữ phụ/chữ màu đổi về chữ thường)", () => {
    const toi = tatCa.filter((ma) => doChoi(token(`to-${ma}`)) < 0.68);
    expect([...MAU_TOI].sort()).toEqual(toi.sort());
  });

  test("ô không tối: chữ phụ + chữ đỏ vẫn ≥ 4,5:1", () => {
    const phu = token("muted-foreground");
    const loi = token("destructive");
    for (const ma of tatCa.filter((m) => !MAU_TOI.has(m))) {
      expect(tuongPhan(token(`to-${ma}`), phu), ma).toBeGreaterThanOrEqual(4.5);
      expect(tuongPhan(token(`to-${ma}`), loi), ma).toBeGreaterThanOrEqual(4.5);
    }
  });
});
