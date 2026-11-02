// ============================================================
// Tên file: src/features/document-composer/DocumentComposerView.tsx
// Tên tiếng Việt: Bộ soạn văn bản từ mẫu — trang soạn dùng chung cho mọi loại văn bản
// Description: Generic composer page (ba-spec 54 DC1–DC4): prefill (R2) → edit with field sources (R3) → live A4
//              preview of the real Word file (R8) → export Word / PDF with an export record (R9), status + stale
//              source (R10), read-only when the source is cancelled (R11), export history with exact replay (R14),
//              admin template upload with tag check (R13). Unsaved edits autosave as a draft (QT 17).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, FileText, History, Printer, RefreshCw, Save } from "lucide-react";
import { Button, DocxPreview, DocxPrintSheet, EmptyState, ErrorSummary, Tag, notify, type FieldError } from "@/design-system";
import {
  COMPOSED_STATUS_LABELS,
  activeTemplateId,
  builtinTemplateId,
  canEditComposed,
  composedStatus,
  editCell,
  editField,
  fieldDiffs,
  isSourceStale,
  latestExport,
  makeExport,
  prefill,
  previousExportFor,
  refreshFromSource,
  stableStringify,
  validateComposed,
  type ComposedState,
  type DocumentTypeDef,
} from "@/lib/documentComposer";
import { downloadDocx, fillDocx } from "@/lib/docxTemplate";
import { BUILTIN_TEMPLATES } from "@/lib/documentTypes";
import { downloadTemplateFile } from "@/lib/documentTemplateStorage";
import { isMissingTableError, isServerConnected, useComposedDocumentExports, useComposedDocuments, useDocumentTemplates } from "@/lib/catalogRepo";
import { useDraftAccount, useFormDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import type { ComposedDocument, ComposedDocumentExport, DocumentValues } from "@/types";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { ComposerFields } from "./ComposerFields";
import { TemplatePanel } from "./TemplatePanel";
import { formatDateTimeVN } from "@/lib/format";

export interface ComposerSourceProps<T> {
  type: DocumentTypeDef<T>;
  source: T;
  sourceId: string;
  /** "Lệnh sản xuất 19.10" — tiêu đề trang. */
  sourceTitle: string;
  sourceRevisionNo: number;
  sourceLive: boolean;
  /** Khóa "lần trước cùng khách + mặt hàng" (R2). */
  previousKey: { customerKey: string; productId: string };
  isSourceLive: (sourceId: string) => boolean;
  newDocument: (state: { values: DocumentValues; fieldSources: ComposedDocument["fieldSources"] }, meta: { id: string; by: string; at: string }) => ComposedDocument;
}

const nowIso = () => new Date().toISOString();
const timeVN = (iso: string) => formatDateTimeVN(iso) || iso;

export function DocumentComposerView<T>({
  type,
  source,
  sourceId,
  sourceTitle,
  sourceRevisionNo,
  sourceLive,
  previousKey,
  isSourceLive,
  newDocument,
  canWrite,
  isAdmin,
  by,
  onBack,
}: ComposerSourceProps<T> & { canWrite: boolean; isAdmin: boolean; by: string; onBack: () => void }) {
  const [docs, saveDocs, docsMeta] = useComposedDocuments();
  const [exports, saveExports] = useComposedDocumentExports();
  const [templates, saveTemplates] = useDocumentTemplates();
  const isAvailable = !isServerConnected || (docsMeta.status !== "loading" && !isMissingTableError(docsMeta.error));

  const doc = docs.find((d) => d.docType === type.key && d.sourceId === sourceId) ?? null;
  const docExports = useMemo(
    () => (doc ? exports.filter((e) => e.documentId === doc.id).sort((a, b) => b.exportedAt.localeCompare(a.exportedAt)) : []),
    [doc, exports],
  );
  const previous = useMemo(
    () => (doc ? null : previousExportFor(docs, exports, { docType: type.key, ...previousKey, excludeSourceId: sourceId, isSourceLive })),
    [doc, docs, exports, type.key, previousKey, sourceId, isSourceLive],
  );
  const baseline: ComposedState = useMemo(
    () => (doc ? { values: doc.values, sources: doc.fieldSources } : prefill(type, source, previous)),
    [doc, type, source, previous],
  );

  const [edited, setEdited] = useState<ComposedState | null>(null);
  /** Lần sửa của nguồn sẽ ghi kèm bản soạn — đổi khi "Lấy lại số từ lệnh". */
  const [revisionNo, setRevisionNo] = useState<number | null>(null);
  const state = edited ?? baseline;
  const isDirty = edited != null && stableStringify(edited) !== stableStringify(baseline);

  const { account, accountReady } = useDraftAccount();
  const draft = useFormDraft({
    form: `compose.${type.key}.${sourceId}`,
    account,
    accountReady,
    value: edited,
    isEmpty: (v) => v == null || stableStringify(v) === stableStringify(baseline),
    onRestore: (v) => v && setEdited(v),
  });

  const canEdit = canWrite && canEditComposed(sourceLive);
  const diffs = useMemo(() => fieldDiffs(type, state, source), [type, state, source]);
  const missing = validateComposed(type, state.values);
  const [showMissing, setShowMissing] = useState(false);
  const stale = !!doc && revisionNo == null && isSourceStale(doc.sourceRevisionNo, sourceRevisionNo);
  const last = doc ? latestExport(exports, doc.id) : null;
  const status = composedStatus(state.values, last);

  /* ---------- Khuôn (R13, R14) ---------- */

  const templateCache = useRef(new Map<string, Uint8Array>());
  const builtinId = builtinTemplateId(type.key);
  const activeId = activeTemplateId(templates, type.key);
  async function templateBytes(id: string): Promise<{ id: string; bytes: Uint8Array }> {
    const hit = templateCache.current.get(id);
    if (hit) return { id, bytes: hit };
    const row = templates.find((t) => t.id === id);
    if (id !== builtinId && row) {
      const got = await downloadTemplateFile(row.filePath);
      if (got instanceof Uint8Array) {
        templateCache.current.set(id, got);
        return { id, bytes: got };
      }
      notify.error(`Không tải được khuôn "${row.fileName}" (${got.error}) — dùng khuôn gốc.`);
    }
    const bytes = BUILTIN_TEMPLATES[type.key].build();
    templateCache.current.set(builtinId, bytes);
    return { id: builtinId, bytes };
  }
  const render = (bytes: Uint8Array, values: DocumentValues) => fillDocx(bytes, type.templateData(values));

  /* ---------- Xem trước (R8): chính file Word sinh từ khuôn đang dùng ---------- */

  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const valuesKey = stableStringify(state.values);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      void templateBytes(activeId)
        .then(({ bytes }) => {
          if (!alive) return;
          setPreview(render(bytes, state.values));
          setPreviewError(null);
        })
        .catch((e: unknown) => alive && setPreviewError(e instanceof Error ? e.message : String(e)));
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey, activeId]);

  /* ---------- Lưu (DC1) ---------- */

  function saveDocument(silent = false): ComposedDocument | null {
    const at = nowIso();
    const row: ComposedDocument = doc
      ? { ...doc, values: state.values, fieldSources: state.sources, sourceRevisionNo: revisionNo ?? doc.sourceRevisionNo, updatedBy: by, updatedAt: at }
      : newDocument({ values: state.values, fieldSources: state.sources }, { id: newId(), by, at });
    if (!isAvailable) {
      notify.error("Máy chủ chưa có bảng bộ soạn văn bản (chưa chạy migration 0091) — chưa lưu được bản soạn. File vẫn xuất được.");
      return null;
    }
    if (doc && !isDirty && revisionNo == null) return doc;
    const prev = docs;
    if (!saveDocs([...docs.filter((d) => d.id !== row.id), row])) return null;
    setEdited(null);
    setRevisionNo(null);
    if (!silent) notify.saved(`Đã lưu bản soạn — ${sourceTitle}`, () => saveDocs(prev));
    return row;
  }

  /* ---------- Xuất (DC2, R9) ---------- */

  const [printing, setPrinting] = useState<{ file: Uint8Array; title: string; record?: () => void } | null>(null);
  const errors: FieldError[] = showMissing
    ? missing.map((k) => ({ field: type.fields.find((f) => f.key === k)?.label ?? k, message: "Còn trống — ghi trước khi xuất file" }))
    : [];

  async function exportAs(format: ComposedDocumentExport["format"]) {
    if (missing.length) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    const wasDirty = isDirty || !doc;
    const saved = saveDocument(true);
    if (saved && wasDirty) notify.saved(`Đã lưu bản soạn — ${sourceTitle}`);
    let file: Uint8Array;
    let templateId: string;
    try {
      const t = await templateBytes(activeId);
      templateId = t.id;
      file = render(t.bytes, state.values);
    } catch (e) {
      notify.error(`Khuôn Word lỗi, chưa xuất được: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const record = () => {
      if (saved) saveExports([...exports, makeExport(saved, format, templateId, by, nowIso(), newId())]);
    };
    if (format === "docx") {
      downloadDocx(file, type.fileName(state.values));
      record();
    } else setPrinting({ file, title: `${type.name} — ${sourceTitle}`, record });
  }

  /** R14: tải lại đúng ảnh chụp + khuôn của lần xuất — không ghi thêm lần xuất. */
  async function replay(e: ComposedDocumentExport, format: ComposedDocumentExport["format"]) {
    try {
      const t = await templateBytes(e.templateId);
      const file = render(t.bytes, e.snapshot);
      if (format === "docx") downloadDocx(file, type.fileName(e.snapshot));
      else setPrinting({ file, title: `${type.name} — ${sourceTitle} (lần xuất ${timeVN(e.exportedAt)})` });
    } catch (err) {
      notify.error(`Không dựng lại được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const templateLabel = (id: string) => (id === builtinId ? "Khuôn gốc" : `Khuôn bản ${templates.find((t) => t.id === id)?.versionNo ?? "?"}`);

  if (printing) return <DocxPrintSheet file={printing.file} title={printing.title} onClose={() => setPrinting(null)} onPrint={printing.record} note="Trong hộp in: khổ A4, hướng dọc, lề Không (lề đã có trong file), bỏ đầu trang / chân trang của trình duyệt." />;

  const viewOnly = !canEdit;
  if (viewOnly && !canWrite && !doc)
    return (
      <div className="grid gap-4">
        <div>
          <Button variant="ghost" onClick={onBack} title="Về hồ sơ lệnh.">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Quay lại
          </Button>
        </div>
        <EmptyState icon={FileText} title="Chưa có file" description={`Phòng Kế hoạch chưa xuất ${type.name.toLowerCase()} của ${sourceTitle.toLowerCase()}.`} />
      </div>
    );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack} title="Về hồ sơ lệnh. Chỉnh dở chưa lưu vẫn giữ trong nháp.">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Quay lại
          </Button>
          <h2 className="font-semibold">
            {type.name} · {sourceTitle}
          </h2>
          <span data-tour="compose-status" className="flex flex-wrap gap-1">
            <Tag variant={status === "exported" ? "done" : status === "draft" ? "muted" : "pending"}>{COMPOSED_STATUS_LABELS[status]}</Tag>
            {stale && <Tag variant="warning">{type.labels.stale}</Tag>}
            {!sourceLive && <Tag variant="error">{type.labels.sourceCancelled}</Tag>}
            {diffs.length > 0 && <Tag variant="warning">{`${type.labels.differs} · ${diffs.length} ô`}</Tag>}
          </span>
        </div>
        <div data-tour="compose-actions" className="flex flex-wrap items-center gap-2">
          {canEdit && stale && (
            <Button
              variant="edit"
              onClick={() => {
                setEdited(refreshFromSource(type, state, source));
                setRevisionNo(sourceRevisionNo);
              }}
              title="Lệnh đã sửa sau khi soạn: lấy lại số mới cho các ô lấy từ lệnh; ô đã sửa tay giữ nguyên."
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Lấy lại số từ lệnh
            </Button>
          )}
          {canEdit && (
            <Button variant="save" onClick={() => saveDocument()} title="Lưu bản soạn lên máy chủ (chưa xuất file). Sửa ở đây không đổi lệnh trên app.">
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Lưu
            </Button>
          )}
          {canEdit && (
            <>
              <Button onClick={() => void exportAs("docx")} title="Tải file Word (.docx) đúng mẫu, mở bằng Word sửa tiếp được. Ghi một lần xuất vào lịch sử.">
                <FileDown className="mr-2 h-4 w-4" aria-hidden />
                Xuất Word
              </Button>
              <Button variant="outline" onClick={() => void exportAs("pdf")} title="Mở trang in đúng file Word — chọn 'Lưu thành PDF' để ra file PDF. Ghi một lần xuất vào lịch sử.">
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Xuất PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {!isAvailable && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          Máy chủ chưa có bảng bộ soạn văn bản (chưa chạy migration 0091): soạn và xuất file được, nhưng chưa lưu bản soạn / lịch sử xuất. Báo quản trị.
        </p>
      )}
      {stale && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          {type.labels.stale}. {canEdit ? "Chọn Lấy lại số từ lệnh để cập nhật các ô lấy từ lệnh; ô đã sửa tay giữ nguyên." : ""}
        </p>
      )}
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={() => (draft.discard(), setEdited(null))} />
      <ErrorSummary errors={errors} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-tour="compose-fields" className="min-w-0">
          <ComposerFields
            type={type}
            values={state.values}
            sources={state.sources}
            diffs={diffs}
            readOnly={!canEdit}
            missing={showMissing ? missing : []}
            onEdit={(k, v) => setEdited(editField(state, k, v))}
            onEditCell={(k, r, c, v) => setEdited(editCell(state, k, r, c, v))}
          />
        </div>
        <div data-tour="compose-preview" className="grid min-w-0 content-start gap-2 xl:sticky xl:top-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">Xem trước — đúng file Word sẽ xuất</span>
            <Tag variant="source">{templateLabel(activeId)}</Tag>
          </div>
          {previewError ? <p className="text-sm text-destructive">Khuôn Word lỗi: {previewError}</p> : <DocxPreview file={preview} className="max-h-[80dvh]" />}
        </div>
      </div>

      <section data-tour="compose-history" className="grid min-w-0 gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <History className="h-4 w-4" aria-hidden />
          Lịch sử xuất file
        </h3>
        {docExports.length === 0 ? (
          <p className="text-muted-foreground">Chưa xuất lần nào.</p>
        ) : (
          <ul className="grid gap-2">
            {docExports.map((e, i) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-border px-3 py-2">
                <span className="min-w-0">
                  <b>{e.format === "docx" ? "Word" : "PDF"}</b> · {timeVN(e.exportedAt)} · {e.exportedBy || "—"} · {templateLabel(e.templateId)}
                  {i === 0 && " · lần gần nhất"}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void replay(e, "docx")} title="Tải lại đúng file Word của lần xuất này (giá trị + khuôn lúc xuất). Không ghi thêm lần xuất.">
                    <FileDown className="mr-1 h-4 w-4" aria-hidden />
                    Tải Word
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void replay(e, "pdf")} title="Mở trang in đúng lần xuất này để in hoặc lưu PDF. Không ghi thêm lần xuất.">
                    <Printer className="mr-1 h-4 w-4" aria-hidden />
                    In / PDF
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <TemplatePanel
          type={type}
          templates={templates}
          activeId={activeId}
          by={by}
          onSaveTemplates={saveTemplates}
          onDownloadActive={() => void templateBytes(activeId).then((t) => downloadDocx(t.bytes, BUILTIN_TEMPLATES[type.key].fileName.replace("Khuon-goc", t.id === builtinId ? "Khuon-goc" : "Khuon-dang-dung")))}
        />
      )}
    </div>
  );
}
