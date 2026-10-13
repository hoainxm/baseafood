import { describe, expect, it } from "vitest";
import { CATALOG_TABS, LEGACY_PATHS, normalizeCatalogTab, normalizeQrTab, readParam } from "./legacyUrls";

describe("LEGACY_PATHS", () => {
  it("mọi đường dẫn mới là tiếng Anh kebab-case, không trùng nhau", () => {
    const next = Object.values(LEGACY_PATHS);
    expect(new Set(next).size).toBe(next.length);
    for (const p of next) expect(p).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});

describe("normalizeCatalogTab", () => {
  it("nhận tab mới", () => {
    for (const t of CATALOG_TABS) expect(normalizeCatalogTab(t)).toBe(t);
  });
  it("link cũ vẫn mở đúng tab", () => {
    expect(normalizeCatalogTab("dai-ly")).toBe("suppliers");
    expect(normalizeCatalogTab("kho-luu")).toBe("storage-locations");
    expect(normalizeCatalogTab("tp-141")).toBe("finished-goods");
  });
  it("giá trị lạ ⇒ undefined (màn tự về tab mặc định)", () => {
    expect(normalizeCatalogTab("xyz")).toBeUndefined();
    expect(normalizeCatalogTab(null)).toBeUndefined();
  });
});

describe("normalizeQrTab", () => {
  it("tab mới + cũ + mặc định", () => {
    expect(normalizeQrTab("print")).toBe("print");
    expect(normalizeQrTab("in")).toBe("print");
    expect(normalizeQrTab("giai-doan")).toBe("stages");
    expect(normalizeQrTab("do-phu")).toBe("stages");
    expect(normalizeQrTab(null)).toBe("lookup");
  });
});

describe("readParam", () => {
  it("đọc tên mới trước, không có thì tên cũ (tem QR đã in dùng ?lo=)", () => {
    expect(readParam(new URLSearchParams("lot=W:1"), "lot")).toBe("W:1");
    expect(readParam(new URLSearchParams("lo=W:1"), "lot")).toBe("W:1");
    expect(readParam(new URLSearchParams("lot=A&lo=B"), "lot")).toBe("A");
    expect(readParam(new URLSearchParams("duyet=W:2"), "approve")).toBe("W:2");
    expect(readParam(new URLSearchParams("don=o1&kiem=x1"), "check")).toBe("x1");
    expect(readParam(new URLSearchParams(""), "order")).toBeNull();
  });
});
