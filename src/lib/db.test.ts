import { describe, expect, it } from "vitest";
import { uid } from "@/lib/db";
import { newId } from "@/lib/store";

describe("uid — id bản ghi mới", () => {
  it("không trùng khi tạo hàng loạt trong cùng mili-giây", () => {
    const ids = Array.from({ length: 5000 }, () => uid());
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("sắp theo id vẫn đúng thứ tự tạo (tiền tố mốc ms tăng ngặt)", () => {
    const ids = Array.from({ length: 300 }, () => uid());
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });
  it("id mới vẫn xếp SAU id cũ dạng `ms-số` tạo trước đó", () => {
    const prev = `${Date.now() - 1000}-123456`;
    expect(prev.localeCompare(uid())).toBeLessThan(0);
  });
  it("dạng `<ms>-<uuid>`; newId ở store.ts là cùng một hàm", () => {
    expect(uid()).toMatch(/^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId).toBe(uid);
  });
});
