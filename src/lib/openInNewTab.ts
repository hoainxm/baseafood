// ============================================================
// Tên file: src/lib/openInNewTab.ts
// Tên tiếng Việt: Mở link ở tab mới — KHÔNG BAO GIỜ thay trang đang mở để xem
// Description: `openLinkInNewTab` follows a real `<a target="_blank">` synchronously (works where `window.open`
//              returns null: popup blockers, iPhone home-screen app, in-app browsers). `openInNewTab` opens a blank
//              tab inside the click, then points it at a URL fetched asynchronously (Safari iOS drops
//              `window.open` called after an await). If no tab could be opened, only a DOWNLOAD may use the
//              current tab (the page stays); viewing never replaces the page — that reloaded the app and lost
//              unsaved state (bug 2026-11-02).
// ============================================================

/** Mở một link ở tab mới bằng thẻ `<a target="_blank">` — gọi NGAY trong lúc bấm (không sau `await`). */
export function openLinkInNewTab(href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type OpenInNewTabResult = "opened" | "no-url" | "blocked";

/**
 * Mở tab trống NGAY trong lúc bấm (còn "cử chỉ người dùng"), lấy link xong mới trỏ tab tới link.
 * - Không lấy được link ⇒ đóng tab trống, `"no-url"`.
 * - Trình duyệt không cho mở tab (`window.open` trả null): `download` ⇒ tải bằng chính tab này (file tải xuống,
 *   trang KHÔNG rời đi); xem ⇒ `"blocked"`, trang giữ nguyên để màn báo lỗi.
 */
export async function openInNewTab(
  getUrl: () => Promise<string | null | undefined>,
  opts: { download?: boolean } = {},
): Promise<OpenInNewTabResult> {
  const w = window.open("", "_blank");
  const url = await getUrl();
  if (!url) {
    w?.close();
    return "no-url";
  }
  if (w) {
    w.opener = null;
    w.location.href = url;
    return "opened";
  }
  if (opts.download) {
    window.location.assign(url);
    return "opened";
  }
  return "blocked";
}

/** Câu báo khi trình duyệt chặn tab mới (dùng chung ở mọi màn mở file). */
export const NEW_TAB_BLOCKED_MESSAGE =
  "Trình duyệt đang chặn mở tab mới — cho phép cửa sổ bật lên cho trang này, hoặc xem ngay trong hộp / bấm Tải về.";
