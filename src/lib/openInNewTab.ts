// ============================================================
// Tên file: src/lib/openInNewTab.ts
// Tên tiếng Việt: Mở file (link ký có hạn) ở tab mới — chạy được trên Safari iPhone / iPad
// Description: Opens a blank tab synchronously inside the click, then points it at a URL fetched
//              asynchronously. Safari iOS + popup blockers drop `window.open` called after an await.
// ============================================================

/**
 * Mở tab trống NGAY trong lúc bấm (còn "cử chỉ người dùng"), lấy link xong mới trỏ tab tới link.
 * Gọi `window.open` sau `await` thì Safari iOS và trình chặn popup bỏ qua — bấm không thấy gì.
 * Không lấy được link ⇒ đóng tab trống, trả `false` để màn báo lỗi. Tab bị chặn hẳn ⇒ mở ngay trang này.
 */
export async function openInNewTab(getUrl: () => Promise<string | null | undefined>): Promise<boolean> {
  const w = window.open("", "_blank");
  const url = await getUrl();
  if (!url) {
    w?.close();
    return false;
  }
  if (w) {
    w.opener = null;
    w.location.href = url;
  } else window.location.assign(url);
  return true;
}
