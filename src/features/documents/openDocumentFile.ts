// ============================================================
// Tên file: src/features/documents/openDocumentFile.ts
// Tên tiếng Việt: Mở / tải một file tài liệu trên tab mới qua link có hạn
// Description: Opens a signed URL of a `documents` bucket file in a new tab (or downloads it)
// ============================================================
import { notify } from "@/design-system";
import { getDocumentFileUrl } from "@/lib/documentStorage";

/**
 * Mở file trên tab mới / tải về. Mở cửa sổ TRƯỚC khi chờ link (trình duyệt chặn cửa sổ mở
 * sau `await`), rồi trỏ sang link có hạn 10 phút.
 */
export async function openDocumentFile(path: string, downloadName?: string) {
  const w = window.open("", "_blank");
  const url = await getDocumentFileUrl(path, 600, downloadName);
  if (!url) {
    w?.close();
    notify.error("Không mở được file — tài khoản không được xem tài liệu này, hoặc file đã bị gỡ khỏi máy chủ.");
    return;
  }
  if (w) {
    w.opener = null;
    w.location.href = url;
  } else window.location.assign(url);
}
