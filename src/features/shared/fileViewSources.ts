// ============================================================
// Tên file: src/features/shared/fileViewSources.ts
// Tên tiếng Việt: Nguồn file đính kèm + mở file ở tab mới không bắt tải về
// Description: Maps each attachment source to its signed-link getter (existing permissions, no bucket change)
//              and opens a file in a NEW tab through the in-app viewer page `#/file-view` (ba-spec 61 N2). The
//              current page is never replaced — doing so reloaded the app on "back" and lost unsaved state.
// ============================================================
import { notify } from "@/design-system";
import { getDocumentFileUrl } from "@/lib/documentStorage";
import { getExportFileUrl } from "@/lib/exportFileStorage";
import { fileViewHref, type FileViewSource } from "@/lib/fileViewLink";
import { getImportFileUrl } from "@/lib/importFileStorage";
import { NEW_TAB_BLOCKED_MESSAGE, openInNewTab, openLinkInNewTab } from "@/lib/openInNewTab";

export const FILE_VIEW_URL: Record<FileViewSource, (path: string, seconds?: number, downloadName?: string) => Promise<string | null>> = {
  documents: getDocumentFileUrl,
  export: getExportFileUrl,
  import: getImportFileUrl,
};

/**
 * Mở file ở tab mới để XEM (không tải về). Luôn đi qua trang xem của app bằng liên kết `target="_blank"` mở
 * ngay trong lúc bấm — không chờ link có hạn, nên trình duyệt không chặn và trang đang mở không bao giờ bị thay.
 * PDF / ảnh: trang xem tự chuyển sang link có hạn (trình duyệt hiện đủ trang, kể cả iPhone / iPad).
 */
export function openFileView(source: FileViewSource, path: string, name: string): void {
  openLinkInNewTab(fileViewHref(source, path, name));
}

/** Tải file gốc về máy, đúng tên gốc. Tab mới bị chặn ⇒ tải bằng tab này (file tải xuống, trang không rời đi). */
export async function downloadFileFrom(source: FileViewSource, path: string, name: string): Promise<void> {
  const result = await openInNewTab(() => FILE_VIEW_URL[source](path, 600, name), { download: true });
  if (result === "no-url") notify.error("Không tải được file — tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.");
  else if (result === "blocked") notify.error(NEW_TAB_BLOCKED_MESSAGE);
}
