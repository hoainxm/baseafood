// ============================================================
// Tên file: src/features/documents/FilePreviewDialog.tsx
// Tên tiếng Việt: Khung xem file tài liệu ngay trong app (PDF, ảnh, Word, Excel, văn bản) + mở tab mới / tải về
// Description: In-app viewer for a document file on the private `documents` bucket via a short-lived signed URL.
//              Rendering is the shared FileViewer (ba-spec 61); "Mở tab mới" never downloads.
// ============================================================
import { Button, FormDialog } from "@/design-system";
import { getDocumentFileUrl } from "@/lib/documentStorage";
import { Download, ExternalLink, FileText } from "lucide-react";
import { FileViewer } from "@/features/shared/FileViewer";
import { downloadFileFrom, openFileView } from "@/features/shared/fileViewSources";

export interface PreviewFile {
  path: string;
  /** Tên file gốc (hiện + đặt tên khi tải về). */
  name: string;
  /** Dòng phụ: mã tài liệu · lần ban hành. */
  caption: string;
}

export function FilePreviewDialog({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  return (
    <FormDialog
      open={!!file}
      onOpenChange={(o) => !o && onClose()}
      title={file?.name || "Xem file"}
      description={file?.caption}
      icon={FileText}
      size="xl"
      footer={
        file && (
          <>
            <Button variant="outline" onClick={() => openFileView("documents", file.path, file.name)} title="Xem file này trên tab mới của trình duyệt (để in hoặc xem toàn màn hình) — không tải về.">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở tab mới
            </Button>
            <Button variant="outline" onClick={() => void downloadFileFrom("documents", file.path, file.name)} title="Tải file này về máy.">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tải về
            </Button>
          </>
        )
      }
    >
      {file && (
        <div className="py-2">
          <FileViewer fileKey={file.path} name={file.name || file.path} getUrl={() => getDocumentFileUrl(file.path, 600)} />
        </div>
      )}
    </FormDialog>
  );
}
