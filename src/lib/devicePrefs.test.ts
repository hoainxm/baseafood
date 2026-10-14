import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDevicePref, readDevicePrefJson, writeDevicePref, writeDevicePrefJson } from "./devicePrefs";

const isFlagMap = (v: unknown): v is Record<string, boolean> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("devicePrefs — có localStorage", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("ghi rồi đọc lại đúng chuỗi, giữ nguyên khóa", () => {
    writeDevicePref("bsf.wip-xuong.v1", "Cá");
    expect(readDevicePref("bsf.wip-xuong.v1")).toBe("Cá");
    expect(localStorage.getItem("bsf.wip-xuong.v1")).toBe("Cá");
  });

  it("JSON: ghi object rồi đọc lại", () => {
    writeDevicePrefJson("bsf1:nav-nhom", { "Sản xuất": false });
    expect(readDevicePrefJson("bsf1:nav-nhom", {}, isFlagMap)).toEqual({ "Sản xuất": false });
  });

  it("JSON: thiếu khóa / hỏng / sai hình ⇒ fallback", () => {
    expect(readDevicePrefJson("chua-co", { a: true })).toEqual({ a: true });
    writeDevicePref("k", "{không phải json");
    expect(readDevicePrefJson("k", {})).toEqual({});
    writeDevicePref("k", "[1,2]");
    expect(readDevicePrefJson("k", {}, isFlagMap)).toEqual({});
    writeDevicePref("k", "null");
    expect(readDevicePrefJson("k", { x: 1 })).toEqual({ x: 1 });
  });
});

describe("devicePrefs — localStorage hỏng/không có", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("không bao giờ throw khi getItem/setItem ném lỗi (chặn cookie, hết quota)", () => {
    const boom = () => {
      throw new Error("QuotaExceededError");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(() => writeDevicePref("k", "v")).not.toThrow();
    expect(() => writeDevicePrefJson("k", { a: 1 })).not.toThrow();
    expect(readDevicePref("k")).toBeNull();
    expect(readDevicePrefJson("k", "mac-dinh")).toBe("mac-dinh");
  });

  it("giá trị không tuần tự hóa được (vòng tham chiếu) ⇒ bỏ qua, không ghi", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const fakeStore: Record<string, unknown> = {};
    fakeStore.self = fakeStore;
    expect(() => writeDevicePrefJson("k", fakeStore)).not.toThrow();
    expect(store.getItem("k")).toBeNull();
  });
});
