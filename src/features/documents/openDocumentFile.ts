// ============================================================
// Tên file: src/features/documents/openDocumentFile.ts
// Tên tiếng Việt: Mở / tải một file tài liệu trên tab mới qua link có hạn
// Description: Opens a signed URL of a `documents` bucket file in a new tab (or downloads it). Never replaces the
//              current page to VIEW a file (that reloaded the app on "back" — bug 2026-11-02).
// ============================================================
import { notify } from "@/design-system";
import { getDocumentFileUrl } from "@/lib/documentStorage";
import { NEW_TAB_BLOCKED_MESSAGE, openInNewTab } from "@/lib/openInNewTab";

/**
 * Mở file trên tab mới / tải về (có `downloadName`). Link có hạn 10 phút. Tab mới bị chặn: tải về thì tải bằng
 * tab này (trang không rời đi); xem thì báo lỗi, trang giữ nguyên.
 */
export async function openDocumentFile(path: string, downloadName?: string) {
  const result = await openInNewTab(() => getDocumentFileUrl(path, 600, downloadName), { download: !!downloadName });
  if (result === "no-url") notify.error("Không mở được file — tài khoản không được xem tài liệu này, hoặc file đã bị gỡ khỏi máy chủ.");
  else if (result === "blocked") notify.error(NEW_TAB_BLOCKED_MESSAGE);
}
