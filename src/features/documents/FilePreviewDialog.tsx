// ============================================================
// Tên file: src/features/documents/FilePreviewDialog.tsx
// Tên tiếng Việt: Khung xem file tài liệu ngay trong app (PDF / ảnh) + mở tab mới / tải về
// Description: In-app viewer for a document file on the private `documents` bucket via a
//              short-lived signed URL. PDF and images render inline; other types download.
// ============================================================
import { useEffect, useState } from "react";
import { Button, FormDialog, ProcessingState } from "@/design-system";
import { filePreviewKind } from "@/lib/documents";
import { getDocumentFileUrl } from "@/lib/documentStorage";
import { Download, ExternalLink, FileText } from "lucide-react";
import { openDocumentFile } from "./openDocumentFile";

export interface PreviewFile {
  path: string;
  /** Tên file gốc (hiện + đặt tên khi tải về). */
  name: string;
  /** Dòng phụ: mã tài liệu · lần ban hành. */
  caption: string;
}

export function FilePreviewDialog({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  const kind = file ? filePreviewKind(file.name || file.path) : "download";
  // Link có hạn của ĐÚNG file đang mở; khác file ⇒ coi như đang tải (không setState đồng bộ trong effect).
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!file || kind === "download") return;
    let isCancelled = false;
    void getDocumentFileUrl(file.path, 600).then((url) => {
      if (!isCancelled) setResult({ path: file.path, url });
    });
    return () => {
      isCancelled = true;
    };
  }, [file, kind]);

  const url = result && file && result.path === file.path ? result.url : null;
  const state: "loading" | "ready" | "error" =
    kind === "download" ? "ready" : !result || !file || result.path !== file.path ? "loading" : url ? "ready" : "error";

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
            <Button variant="outline" onClick={() => void openDocumentFile(file.path)} title="Mở file này trên tab mới của trình duyệt (để in hoặc xem toàn màn hình).">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở tab mới
            </Button>
            <Button variant="outline" onClick={() => void openDocumentFile(file.path, file.name)} title="Tải file này về máy.">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tải về
            </Button>
          </>
        )
      }
    >
      {file && (
        <div className="py-2">
          {state === "loading" && <ProcessingState text="Đang mở file…" />}
          {state === "error" && (
            <p role="alert" className="rounded-lg bg-destructive-surface px-4 py-3">
              Không mở được file: tài khoản không được xem tài liệu này, hoặc file đã bị gỡ khỏi máy chủ.
            </p>
          )}
          {state === "ready" && kind === "pdf" && url && (
            <iframe title={file.name} src={url} className="h-[75dvh] w-full rounded-lg border border-border bg-muted" />
          )}
          {state === "ready" && kind === "image" && url && (
            <img src={url} alt={file.name} className="mx-auto max-h-[75dvh] max-w-full rounded-lg border border-border object-contain" />
          )}
          {state === "ready" && kind === "download" && (
            <p className="rounded-lg bg-muted px-4 py-3">
              File Word / Excel không xem được ngay trong trình duyệt. Bấm <b>Tải về</b> để mở bằng Word / Excel trên máy.
            </p>
          )}
        </div>
      )}
    </FormDialog>
  );
}
