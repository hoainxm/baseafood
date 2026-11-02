// ============================================================
// Tên file: src/features/shared/fileViewSources.ts
// Tên tiếng Việt: Nguồn file đính kèm + mở file ở tab mới không bắt tải về
// Description: Maps each attachment source to its signed-link getter (existing permissions, no bucket change)
//              and opens a file in a new tab: PDF / images go to the signed link, Word / Excel / text go to the
//              in-app viewer page `#/file-view` (ba-spec 61 N2).
// ============================================================
import { notify } from "@/design-system";
import { getDocumentFileUrl } from "@/lib/documentStorage";
import { getExportFileUrl } from "@/lib/exportFileStorage";
import { fileViewHref, needsAppViewer, type FileViewSource } from "@/lib/fileViewLink";
import { getImportFileUrl } from "@/lib/importFileStorage";
import { openInNewTab } from "@/lib/openInNewTab";

export const FILE_VIEW_URL: Record<FileViewSource, (path: string, seconds?: number, downloadName?: string) => Promise<string | null>> = {
  documents: getDocumentFileUrl,
  export: getExportFileUrl,
  import: getImportFileUrl,
};

/** Mở file ở tab mới để XEM (không tải về). Gọi ngay trong lúc bấm — trình duyệt chặn cửa sổ mở sau `await`. */
export async function openFileView(source: FileViewSource, path: string, name: string): Promise<void> {
  if (needsAppViewer(name || path)) {
    const href = fileViewHref(source, path, name);
    const w = window.open(href, "_blank");
    // "noopener" làm window.open luôn trả null — cắt opener tay. Bị chặn hẳn ⇒ mở ngay tab này.
    if (w) w.opener = null;
    else window.location.hash = href.slice(1);
    return;
  }
  if (!(await openInNewTab(() => FILE_VIEW_URL[source](path, 600)))) {
    notify.error("Không mở được file — tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.");
  }
}

/** Tải file gốc về máy, đúng tên gốc. */
export async function downloadFileFrom(source: FileViewSource, path: string, name: string): Promise<void> {
  if (!(await openInNewTab(() => FILE_VIEW_URL[source](path, 600, name)))) {
    notify.error("Không tải được file — tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.");
  }
}
