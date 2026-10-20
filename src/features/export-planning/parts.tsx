// ============================================================
// Tên file: src/features/export-planning/parts.tsx
// Tên tiếng Việt: Mảnh dùng chung của màn Xuất khẩu — chấm 6 bước, xem file, chọn file
// Description: Shared UI bits for the export planning screens: step state dots, file preview,
//              multi-file picker, file chips.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Button, FormDialog, ProcessingState, Tag, notify, type TagVariant } from "@/design-system";
import { ITEM_STATE_LABELS, STEP_TITLES, type StepNo } from "@/lib/exportPlanning";
import { DEMO_PLACEHOLDER_PREFIX, EXPORT_FILE_ACCEPT, getExportFileUrl } from "@/lib/exportFileStorage";
import { filePreviewKind } from "@/lib/documents";
import type { ExportFile, ExportItemState } from "@/types";
import { Check, CircleDashed, Download, ExternalLink, FileText, Minus, Paperclip, X } from "lucide-react";

const STATE_TAG: Record<ExportItemState, TagVariant> = {
  done: "done",
  "in-progress": "pending",
  "not-started": "muted",
  "not-applicable": "muted",
};

/** Một chấm trạng thái bước (✓ xong · ◐ đang làm · ! thiếu · — không áp dụng). */
export function StepDot({ state, step, alert }: { state: ExportItemState; step: StepNo; alert?: boolean }) {
  const label = `Bước ${step} ${STEP_TITLES[step - 1]}: ${ITEM_STATE_LABELS[state]}`;
  const tone =
    state === "done"
      ? "bg-success-surface text-success border-success-line"
      : state === "in-progress"
        ? alert
          ? "bg-destructive-surface text-destructive border-destructive/40"
          : "bg-warning-surface text-warning border-warning/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span title={label} aria-label={label} className={`inline-grid size-7 shrink-0 place-items-center rounded-full border ${tone}`}>
      {state === "done" ? (
        <Check className="size-4" aria-hidden />
      ) : state === "in-progress" ? (
        <CircleDashed className="size-4" aria-hidden />
      ) : state === "not-applicable" ? (
        <Minus className="size-4" aria-hidden />
      ) : (
        <span className="text-sm font-semibold" aria-hidden>
          {step}
        </span>
      )}
    </span>
  );
}

export function StepDots({ steps, onlyUpTo = 6 }: { steps: Record<StepNo, ExportItemState>; onlyUpTo?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {([1, 2, 3, 4, 5, 6] as StepNo[])
        .filter((n) => n <= onlyUpTo)
        .map((n) => (
          <StepDot key={n} step={n} state={steps[n]} />
        ))}
    </div>
  );
}

export interface PreviewTarget {
  path: string;
  name: string;
  caption: string;
}

async function openExportFile(path: string, downloadName?: string) {
  if (path.startsWith(DEMO_PLACEHOLDER_PREFIX)) {
    notify.warning("Đây là file giữ chỗ của bộ demo — không có file thật để mở.");
    return;
  }
  const w = window.open("", "_blank");
  const url = await getExportFileUrl(path, 600, downloadName);
  if (!url) {
    w?.close();
    notify.error("Không mở được file — tài khoản không được xem file này, hoặc file đã bị gỡ khỏi máy chủ.");
    return;
  }
  if (w) {
    w.opener = null;
    w.location.href = url;
  } else window.location.assign(url);
}

/** Xem file ngay trong app: PDF / ảnh hiện tại chỗ, Word / Excel / zip tải về. */
export function ExportFilePreview({ file, onClose }: { file: PreviewTarget | null; onClose: () => void }) {
  const isPlaceholder = !!file?.path.startsWith(DEMO_PLACEHOLDER_PREFIX);
  const kind = file && !isPlaceholder ? filePreviewKind(file.path) : "download";
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!file || kind === "download") return;
    let isCancelled = false;
    void getExportFileUrl(file.path, 600).then((url) => {
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
            <Button variant="outline" onClick={() => void openExportFile(file.path)} title="Mở file này trên tab mới của trình duyệt (để in hoặc xem toàn màn hình).">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Mở tab mới
            </Button>
            <Button variant="outline" onClick={() => void openExportFile(file.path, file.name)} title="Tải file này về máy.">
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
            <p className="rounded-lg bg-muted px-4 py-3">File này không xem được ngay trong trình duyệt. Bấm Tải về để mở trên máy.</p>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/** Nút chọn file (nhiều file một lần) + danh sách file đã chọn, bỏ được từng file. */
export function FilePicker({
  files,
  onChange,
  multiple = true,
  accept = EXPORT_FILE_ACCEPT,
  label = "Chọn file",
  capture,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  /** Điện thoại: mở thẳng máy ảnh. */
  capture?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={ref}
          type="file"
          hidden
          multiple={multiple}
          accept={accept}
          {...(capture ? { capture: "environment" } : {})}
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} title="Chọn file từ máy (PDF, ảnh, Word, Excel, zip — tối đa 20 MB mỗi file).">
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          {label}
        </Button>
        {!files.length && <span className="text-sm text-muted-foreground">Chưa chọn file</span>}
      </div>
      {files.length > 0 && (
        <ul className="grid gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 break-all">{f.name}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                title={`Bỏ file "${f.name}" khỏi danh sách sẽ tải lên.`}
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Bỏ file</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Danh sách file đã lưu — bấm để xem. */
export function FileChips({ files, onPreview, caption }: { files: readonly ExportFile[]; onPreview: (f: PreviewTarget) => void; caption: string }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <Button
          key={f.id}
          size="sm"
          variant="outline"
          onClick={() => onPreview({ path: f.path, name: f.fileName || "file", caption: [caption, f.layerNo != null ? `lớp ${f.layerNo}` : "", f.caption].filter(Boolean).join(" · ") })}
          title={`Xem file "${f.fileName}"${f.uploadedBy ? ` — ${f.uploadedBy} đính` : ""}.`}
        >
          <FileText className="mr-1 h-4 w-4" aria-hidden />
          <span className="max-w-48 truncate">{f.layerNo != null ? `Lớp ${f.layerNo} · ` : ""}{f.fileName || "file"}</span>
        </Button>
      ))}
    </div>
  );
}

export function StateTag({ state }: { state: ExportItemState }) {
  return <Tag variant={STATE_TAG[state]}>{ITEM_STATE_LABELS[state]}</Tag>;
}
