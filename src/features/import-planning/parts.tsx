// ============================================================
// Tên file: src/features/import-planning/parts.tsx
// Tên tiếng Việt: Mảnh dùng chung của màn Nhập khẩu — nhãn trạng thái, xem file, danh sách file
// Description: Shared UI bits for the import planning screens: state tags, file preview (bucket
//              `import-files`), vertical file list.
// ============================================================
import { useEffect, useState } from "react";
import { Button, FormDialog, ProcessingState, Tag, type TagVariant } from "@/design-system";
import { CONTRACT_STATE_LABELS, RECEIPT_STATE_LABELS, type ImportContractState, type ReceiptState } from "@/lib/importPlanning";
import { DEMO_PLACEHOLDER_PREFIX, getImportFileUrl } from "@/lib/importFileStorage";
import { filePreviewKind } from "@/lib/documents";
import { formatDateVN } from "@/lib/format";
import type { ImportFile } from "@/types";
import { Download, ExternalLink, Eye, FileText, Trash2 } from "lucide-react";

const RECEIPT_STATE_TAG: Record<ReceiptState, TagVariant> = {
  "missing-docs": "warning",
  "awaiting-quantity": "pending",
  complete: "done",
  cancelled: "muted",
};
const CONTRACT_STATE_TAG: Record<ImportContractState, TagVariant> = {
  "no-receipts": "muted",
  receiving: "source",
  closed: "done",
  cancelled: "muted",
};

export function ReceiptStateTag({ state }: { state: ReceiptState }) {
  return <Tag variant={RECEIPT_STATE_TAG[state]}>{RECEIPT_STATE_LABELS[state]}</Tag>;
}
export function ContractStateTag({ state }: { state: ImportContractState }) {
  return <Tag variant={CONTRACT_STATE_TAG[state]}>{CONTRACT_STATE_LABELS[state]}</Tag>;
}

export interface ImportPreviewTarget {
  path: string;
  name: string;
  caption?: string;
}

async function openImportFile(path: string, downloadName?: string) {
  const url = await getImportFileUrl(path, 600, downloadName);
  if (url) window.open(url, "_blank", "noopener");
}

/** Xem file trong app (PDF / ảnh); loại khác ⇒ Tải về. File giữ chỗ của demo ⇒ câu giải thích. */
export function ImportFilePreview({ file, onClose }: { file: ImportPreviewTarget | null; onClose: () => void }) {
  const isPlaceholder = !!file?.path.startsWith(DEMO_PLACEHOLDER_PREFIX);
  const kind = file && !isPlaceholder ? filePreviewKind(file.path) : "download";
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!file || kind === "download") return;
    let isCancelled = false;
    void getImportFileUrl(file.path, 600).then((url) => {
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
        file &&
        !isPlaceholder && (
          <>
            <Button variant="outline" onClick={() => void openImportFile(file.path)} title="Mở file này trên tab mới của trình duyệt (để in hoặc xem toàn màn hình).">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở tab mới
            </Button>
            <Button variant="outline" onClick={() => void openImportFile(file.path, file.name)} title="Tải file này về máy.">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tải về
            </Button>
          </>
        )
      }
    >
      {file && (
        <div className="py-2">
          {isPlaceholder && <p className="rounded-lg bg-muted px-4 py-3">File giữ chỗ của bộ demo — trình diễn trạng thái, không có file thật.</p>}
          {!isPlaceholder && state === "loading" && <ProcessingState text="Đang mở file…" />}
          {!isPlaceholder && state === "error" && (
            <p role="alert" className="rounded-lg bg-destructive-surface px-4 py-3">
              Không mở được file: tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.
            </p>
          )}
          {state === "ready" && kind === "pdf" && url && <iframe title={file.name} src={url} className="h-[75dvh] w-full rounded-lg border border-border bg-muted" />}
          {state === "ready" && kind === "image" && url && (
            <img src={url} alt={file.name} className="mx-auto max-h-[75dvh] max-w-full rounded-lg border border-border object-contain" />
          )}
          {!isPlaceholder && state === "ready" && kind === "download" && (
            <p className="rounded-lg bg-muted px-4 py-3">File này không xem được ngay trong trình duyệt. Chọn Tải về để mở trên máy.</p>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/** Danh sách file DỌC (khuôn `FileList` của Xuất khẩu — design-spec 42 v5): đủ tên, Xem + Gỡ. */
export function ImportFileList({
  files,
  caption,
  onPreview,
  onRemove,
}: {
  files: readonly ImportFile[];
  caption: string;
  onPreview: (f: ImportPreviewTarget) => void;
  onRemove?: (f: ImportFile) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y divide-border rounded-lg border border-border">
      {files.map((f) => {
        const name = f.fileName || "file";
        const meta = [f.uploadedBy, f.createdAt ? formatDateVN(f.createdAt.slice(0, 10)) : ""].filter(Boolean).join(" · ");
        return (
          <li key={f.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium break-all">{name}</span>
              {meta && <span className="text-muted-foreground">{meta}</span>}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => onPreview({ path: f.path, name, caption })} title={`Xem file "${name}".`}>
                <Eye className="mr-1 h-4 w-4" aria-hidden />
                Xem
              </Button>
              {onRemove && (
                <Button size="sm" variant="danger" onClick={() => onRemove(f)} title={`Gỡ file "${name}" (có Hoàn tác).`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Gỡ {name}</span>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
