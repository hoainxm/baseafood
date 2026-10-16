import { beforeEach, describe, expect, test } from "vitest";
import { clearFormDraft, formDraftKey, readFormDraft, writeFormDraft } from "./formDraft";

/* Node không có localStorage — giả lập tối thiểu. */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("nháp form (quy tắc 17)", () => {
  test("khoá theo form + tài khoản, không phân hoa thường; không đăng nhập ⇒ 'local'", () => {
    expect(formDraftKey("imports", "NNTTruc")).toBe("bsf.draft.imports.nnttruc");
    expect(formDraftKey("wip", "")).toBe("bsf.draft.wip.local");
  });

  test("ghi rồi đọc lại đúng; mỗi tài khoản một nháp riêng", () => {
    writeFormDraft("imports", "a", { supplier: "Đại lý 01", kg: 1200 }, "2026-10-16T03:00:00.000Z");
    writeFormDraft("imports", "b", { supplier: "Đại lý 05", kg: 900 }, "2026-10-16T03:00:00.000Z");
    expect(readFormDraft("imports", "a", Date.parse("2026-10-16T04:00:00Z"))).toEqual({
      savedAt: "2026-10-16T03:00:00.000Z",
      value: { supplier: "Đại lý 01", kg: 1200 },
    });
    expect(readFormDraft<{ kg: number }>("imports", "b", Date.parse("2026-10-16T04:00:00Z"))?.value.kg).toBe(900);
  });

  test("xoá nháp; nháp quá 30 ngày bỏ qua; dữ liệu hỏng không làm vỡ", () => {
    writeFormDraft("wip", "a", { x: 1 }, "2026-09-01T00:00:00.000Z");
    expect(readFormDraft("wip", "a", Date.parse("2026-10-16T00:00:00Z"))).toBeNull();
    writeFormDraft("wip", "a", { x: 1 });
    clearFormDraft("wip", "a");
    expect(readFormDraft("wip", "a")).toBeNull();
    store.set("bsf.draft.wip.a", "{hỏng");
    expect(readFormDraft("wip", "a")).toBeNull();
  });
});
