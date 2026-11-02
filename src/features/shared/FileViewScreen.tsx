// ============================================================
// Tên file: src/features/shared/FileViewScreen.tsx
// Tên tiếng Việt: Trang xem file ở tab mới — route /file-view
// Description: Full-page viewer opened by "Mở tab mới" (ba-spec 61 N2). Reads src/path/name from the URL, fetches
//              through the existing signed-link getter (same login, same permissions) and renders every kind in
//              the app. It never navigates itself away: some browsers open "new tab" links in the same tab, and
//              leaving the app there made "back" reload it (bug 2026-11-02). PDF / image: "Mở file gốc" opens the
//              signed link in another tab (iPhone / iPad show every PDF page there).
// ============================================================
import { useSearchParams } from "react-router-dom";
import { Download, ExternalLink, FileWarning } from "lucide-react";
import { Button, EmptyState, notify } from "@/design-system";
import { filePreviewKind } from "@/lib/documents";
import { parseFileViewParams } from "@/lib/fileViewLink";
import { NEW_TAB_BLOCKED_MESSAGE, openInNewTab } from "@/lib/openInNewTab";
import { FileViewer } from "./FileViewer";
import { downloadFileFrom, FILE_VIEW_URL } from "./fileViewSources";

export default function FileViewScreen() {
  const [params] = useSearchParams();
  const target = parseFileViewParams(params);

  if (!target) {
    return <EmptyState icon={FileWarning} title="Không mở được file" description="Đường dẫn xem file thiếu hoặc sai. Mở lại file từ trang chứa nó." />;
  }
  const kind = filePreviewKind(target.name || target.path);
  const getUrl = () => FILE_VIEW_URL[target.source](target.path, 600);

  const openOriginal = async () => {
    const result = await openInNewTab(getUrl);
    if (result === "no-url") notify.error("Không mở được file — tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.");
    else if (result === "blocked") notify.error(NEW_TAB_BLOCKED_MESSAGE);
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" title={target.name}>
          {target.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          {(kind === "pdf" || kind === "image") && (
            <Button variant="outline" onClick={() => void openOriginal()} title="Mở file gốc bằng trình xem của trình duyệt ở tab khác — trên iPhone / iPad xem được đủ các trang PDF.">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở file gốc
            </Button>
          )}
          <Button variant="outline" onClick={() => void downloadFileFrom(target.source, target.path, target.name)} title="Tải file gốc này về máy.">
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Tải về
          </Button>
        </div>
      </div>
      <FileViewer fileKey={`${target.source}:${target.path}`} name={target.name} getUrl={getUrl} fullPage />
    </div>
  );
}
