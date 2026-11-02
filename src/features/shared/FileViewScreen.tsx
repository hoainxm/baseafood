// ============================================================
// Tên file: src/features/shared/FileViewScreen.tsx
// Tên tiếng Việt: Trang xem file ở tab mới (Word / Excel / văn bản) — route /file-view
// Description: Full-page viewer opened by "Mở tab mới" for files a signed link would download (ba-spec 61 N2).
//              Reads src/path/name from the URL, fetches through the existing signed-link getter (same login,
//              same permissions); unknown source or missing path ⇒ error, no Storage call (AC-6).
// ============================================================
import { useSearchParams } from "react-router-dom";
import { Download, FileWarning } from "lucide-react";
import { Button, EmptyState } from "@/design-system";
import { parseFileViewParams } from "@/lib/fileViewLink";
import { FileViewer } from "./FileViewer";
import { downloadFileFrom, FILE_VIEW_URL } from "./fileViewSources";

export default function FileViewScreen() {
  const [params] = useSearchParams();
  const target = parseFileViewParams(params);

  if (!target) {
    return <EmptyState icon={FileWarning} title="Không mở được file" description="Đường dẫn xem file thiếu hoặc sai. Mở lại file từ trang chứa nó." />;
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" title={target.name}>
          {target.name}
        </h1>
        <Button variant="outline" onClick={() => void downloadFileFrom(target.source, target.path, target.name)} title="Tải file gốc này về máy.">
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Tải về
        </Button>
      </div>
      <FileViewer fileKey={`${target.source}:${target.path}`} name={target.name} getUrl={() => FILE_VIEW_URL[target.source](target.path, 600)} fullPage />
    </div>
  );
}
