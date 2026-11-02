import { afterEach, describe, expect, it, vi } from "vitest";
import { openInNewTab, openLinkInNewTab } from "./openInNewTab";

/** Cửa sổ giả: `open` trả `popup` (null = trình duyệt chặn tab mới); ghi lại mọi lần trang hiện tại bị đổi. */
function fakeWindow(popup: { opener: unknown; location: { href: string }; close: () => void } | null) {
  const assigned: string[] = [];
  vi.stubGlobal("window", {
    open: vi.fn(() => popup),
    location: { assign: (u: string) => assigned.push(u) },
  });
  return assigned;
}

afterEach(() => vi.unstubAllGlobals());

describe("openInNewTab — không bao giờ thay trang đang mở để XEM (lỗi 2026-11-02)", () => {
  it("tab mới mở được ⇒ trỏ tab mới tới link, trang hiện tại đứng yên", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    const assigned = fakeWindow(popup);
    expect(await openInNewTab(async () => "https://x/file.pdf")).toBe("opened");
    expect(popup.location.href).toBe("https://x/file.pdf");
    expect(popup.opener).toBeNull();
    expect(assigned).toEqual([]);
  });

  it("tab mới bị chặn + XEM ⇒ 'blocked', trang hiện tại KHÔNG bị đổi", async () => {
    const assigned = fakeWindow(null);
    expect(await openInNewTab(async () => "https://x/file.pdf")).toBe("blocked");
    expect(assigned).toEqual([]);
  });

  it("tab mới bị chặn + TẢI VỀ ⇒ tải bằng tab này (file tải xuống, trang không rời đi)", async () => {
    const assigned = fakeWindow(null);
    expect(await openInNewTab(async () => "https://x/file.pdf?download=a.pdf", { download: true })).toBe("opened");
    expect(assigned).toEqual(["https://x/file.pdf?download=a.pdf"]);
  });

  it("không lấy được link ⇒ đóng tab trống, 'no-url'", async () => {
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    fakeWindow(popup);
    expect(await openInNewTab(async () => null)).toBe("no-url");
    expect(popup.close).toHaveBeenCalledTimes(1);
  });
});

describe("openLinkInNewTab", () => {
  it("bấm một thẻ <a target=_blank rel=noopener> rồi gỡ — không đụng location của trang", () => {
    const anchor = { href: "", target: "", rel: "", style: { display: "" }, click: vi.fn(), remove: vi.fn() };
    const appended: unknown[] = [];
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: (n: unknown) => appended.push(n) } });
    openLinkInNewTab("#/file-view?src=export&path=a.doc");
    expect(anchor).toMatchObject({ href: "#/file-view?src=export&path=a.doc", target: "_blank", rel: "noopener noreferrer" });
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(appended).toEqual([anchor]);
  });
});
