// ============================================================
// Tên file: src/features/import-planning/parts.tsx
// Tên tiếng Việt: Mảnh dùng chung của màn Nhập khẩu — nhãn trạng thái, xem file, danh sách file
// Description: Shared UI bits for the import planning screens: state tags, file preview (bucket
//              `import-files`), vertical file list.
// ============================================================
import { Button, FormDialog, Tag, type TagVariant } from "@/design-system";
import { CONTRACT_STATE_LABELS, RECEIPT_STATE_LABELS, lineProduct, type ImportContractState, type ImportData, type ReceiptState } from "@/lib/importPlanning";
import { DEMO_PLACEHOLDER_PREFIX, getImportFileUrl } from "@/lib/importFileStorage";
import { FileViewer } from "@/features/shared/FileViewer";
import { downloadFileFrom, openFileView } from "@/features/shared/fileViewSources";
import { formatDateTimeVN } from "@/lib/format";
import type { ImportContractLine, ImportFile } from "@/types";
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

/** Mặt hàng danh mục đã nối của dòng hàng, hoặc "Chưa nối" (ba-spec 45 v3 R20). Máy chủ chưa chạy 0084 ⇒ không hiện. */
export function LineProductLabel({ data, line }: { data: Pick<ImportData, "products" | "productLinkAvailable">; line: Pick<ImportContractLine, "productId"> }) {
  if (data.productLinkAvailable === false) return null;
  const p = lineProduct(data, line);
  if (!p) return <Tag variant="warning">Chưa nối</Tag>;
  return <span className="text-sm text-muted-foreground break-words">{p.name || "Mặt hàng đã nối"}</span>;
}

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

/** Xem file trong app (ba-spec 61): PDF, ảnh, Word, Excel, văn bản hiện tại chỗ; loại khác ⇒ Tải về. File giữ chỗ của demo ⇒ câu giải thích. */
export function ImportFilePreview({ file, onClose }: { file: ImportPreviewTarget | null; onClose: () => void }) {
  const isPlaceholder = !!file?.path.startsWith(DEMO_PLACEHOLDER_PREFIX);
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
            <Button variant="outline" onClick={() => void openFileView("import", file.path, file.name)} title="Xem file này trên tab mới của trình duyệt (để in hoặc xem toàn màn hình) — không tải về.">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở tab mới
            </Button>
            <Button variant="outline" onClick={() => void downloadFileFrom("import", file.path, file.name)} title="Tải file này về máy.">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Tải về
            </Button>
          </>
        )
      }
    >
      {file && (
        <div className="py-2">
          {isPlaceholder ? (
            <p className="rounded-lg bg-muted px-4 py-3">File giữ chỗ của bộ demo — trình diễn trạng thái, không có file thật.</p>
          ) : (
            <FileViewer fileKey={file.path} name={file.name || file.path} getUrl={() => getImportFileUrl(file.path, 600)} />
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
        const meta = [f.uploadedBy, formatDateTimeVN(f.createdAt)].filter(Boolean).join(" · ");
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
