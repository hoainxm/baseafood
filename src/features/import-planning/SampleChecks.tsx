// ============================================================
// Tên file: src/features/import-planning/SampleChecks.tsx
// Tên tiếng Việt: Kiểm mẫu của kho trong lần nhập — bảng xem + hộp nạp báo cáo / nhập tay
// Description: ba-spec 45 v4 NI11 (R23–R26): read-only sample table inside a receipt (rows = metrics,
//              columns = samples, same layout as the warehouse report) and the write dialog (read
//              Excel → pick columns for this invoice → review → save; image / PDF only attached).
// ============================================================
// CHỈ LƯU giá trị như báo cáo (R23) — không tính, không chặn gì. Luật đọc / chọn cột ở
// lib/importSampleChecks.ts; hộp chỉ gọi.
import { useEffect, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  ErrorSummary,
  Field,
  FormDialog,
  HorizontalScroll,
  Input,
  NumberField,
  Tag,
  formatNumber,
  notify,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { FilePicker } from "@/features/export-planning/parts";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { formatDateVN } from "@/lib/format";
import { IMPORT_FILE_ACCEPT, checkImportFile, removeImportFiles } from "@/lib/importFileStorage";
import { linesOf, type ImportData } from "@/lib/importPlanning";
import {
  SAMPLE_GROUP_LABELS,
  SAMPLE_METRICS,
  SIZE_BUCKETS,
  emptySample,
  metricValue,
  samplesOfReceipt,
  suggestLineForSize,
  suggestSampleColumns,
  type SampleMetric,
} from "@/lib/importSampleChecks";
import { isReadableSampleFile, readSampleReportFile } from "@/lib/importSampleFile";
import type { ImportContractLine, ImportFile, ImportReceipt, ImportSampleCheck } from "@/types";
import { ClipboardList, FileSpreadsheet, Pencil, Plus, Trash2, X } from "lucide-react";
import { DialogFooter } from "./ImportDialogs";
import { uploadAll } from "./importUpload";
import type { ImportPreviewTarget } from "./parts";

const GROUPS = ["head", "weight", "sensory", "type", "norm"] as const;
const unitOf = (m: SampleMetric) => (m.kind === "percent" ? "%" : m.key === "grossWeightG" || m.key === "netWeightG" ? "gr" : "");

function showValue(m: SampleMetric, v: string | number | null): string {
  if (v == null || v === "") return "";
  if (m.kind === "date") return formatDateVN(String(v));
  if (typeof v === "number") return m.kind === "percent" ? `${formatNumber(v)}%` : formatNumber(v);
  return String(v);
}

// Mẫu gõ tay không ghi STT ⇒ "Mẫu nhập tay" (đừng đánh số theo vị trí, dễ trùng "Mẫu 1" của báo cáo).
const sampleTitle = (s: ImportSampleCheck) => `${s.sampleNo ? `Mẫu ${s.sampleNo}` : "Mẫu nhập tay"}${s.size ? ` · ${s.size}` : ""}`;

/* ---------- Bảng xem trong lần nhập ---------- */

export function SampleCheckSection({
  data,
  receipt,
  canEdit,
  onImport,
  onEdit,
  onDelete,
  onPreview,
  tourTarget = false,
}: {
  data: ImportData;
  receipt: ImportReceipt;
  canEdit: boolean;
  /** Lần nhập đầu của hồ sơ mang mốc tour. */
  tourTarget?: boolean;
  onImport: (r: ImportReceipt) => void;
  onEdit: (r: ImportReceipt, s: ImportSampleCheck) => void;
  onDelete: (s: ImportSampleCheck) => void;
  onPreview: (f: ImportPreviewTarget) => void;
}) {
  const samples = samplesOfReceipt(data.sampleChecks ?? [], receipt.id);
  const lines = linesOf(data, receipt.contractId);
  const fileIds = [...new Set(samples.map((s) => s.fileId).filter(Boolean))];
  const files = data.files.filter((f) => fileIds.includes(f.id));
  const metrics = SAMPLE_METRICS.filter((m) => samples.some((s) => showValue(m, metricValue(s, m.key))));
  const buckets = SIZE_BUCKETS.filter((b) => samples.some((s) => s.sizeDistribution[b] != null));
  const extraKeys = [...new Set(samples.flatMap((s) => Object.keys(s.extra)))];
  return (
    <div data-tour={tourTarget ? "import-receipt-samples" : undefined} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">Kiểm mẫu của kho{samples.length ? ` (${samples.length} mẫu)` : ""}</h4>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => onImport(receipt)} title="Đính báo cáo kiểm mẫu của kho (Excel tự đọc số; ảnh chỉ đính kèm, gõ số tay).">
            <FileSpreadsheet className="mr-1 h-4 w-4" aria-hidden />
            Nạp báo cáo kiểm mẫu
          </Button>
        )}
      </div>
      {samples.length === 0 ? (
        <p className="text-muted-foreground">Chưa có báo cáo kiểm mẫu của kho cho lần nhập này.</p>
      ) : (
        <>
          <HorizontalScroll>
            <table className="relative w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-card px-2 py-1.5 text-left font-medium">Chỉ số</th>
                  {samples.map((s) => (
                    <th key={s.id} className="min-w-32 px-2 py-1.5 text-right align-bottom font-medium">
                      <div className="grid justify-items-end gap-1">
                        <span>{sampleTitle(s)}</span>
                        <span className="text-muted-foreground font-normal break-words">
                          {lines.find((l) => l.id === s.contractLineId)?.productName ?? (s.contractLineId ? "Dòng đã bỏ" : "Chưa gắn dòng hàng")}
                        </span>
                        {canEdit && (
                          <span className="flex gap-1">
                            <Button size="sm" variant="edit" onClick={() => onEdit(receipt, s)} title={`Sửa số của ${sampleTitle(s)}.`}>
                              <Pencil className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Sửa {sampleTitle(s)}</span>
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => onDelete(s)} title={`Xóa ${sampleTitle(s)} (có Hoàn tác).`}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Xóa {sampleTitle(s)}</span>
                            </Button>
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.key} className="border-b border-border/60">
                    <th scope="row" className="sticky left-0 bg-card px-2 py-1 text-left font-normal text-muted-foreground">
                      {m.parent ? `${m.parent} · ${m.label}` : m.label}
                    </th>
                    {samples.map((s) => (
                      <td key={s.id} className="tnum px-2 py-1 text-right">
                        {showValue(m, metricValue(s, m.key))}
                      </td>
                    ))}
                  </tr>
                ))}
                {buckets.map((b) => (
                  <tr key={b} className="border-b border-border/60">
                    <th scope="row" className="sticky left-0 bg-card px-2 py-1 text-left font-normal text-muted-foreground">
                      Size {b}
                    </th>
                    {samples.map((s) => (
                      <td key={s.id} className="tnum px-2 py-1 text-right">
                        {s.sizeDistribution[b] != null ? `${formatNumber(s.sizeDistribution[b] as number)}%` : ""}
                      </td>
                    ))}
                  </tr>
                ))}
                {extraKeys.map((k) => (
                  <tr key={k} className="border-b border-border/60">
                    <th scope="row" className="sticky left-0 bg-card px-2 py-1 text-left font-normal text-muted-foreground">
                      {k}
                    </th>
                    {samples.map((s) => (
                      <td key={s.id} className="px-2 py-1 text-right">
                        {s.extra[k] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScroll>
          <p className="text-sm text-muted-foreground">
            Số lưu đúng như báo cáo của kho{samples[0]?.reportDate ? ` ngày ${formatDateVN(samples[0].reportDate)}` : ""}, app không tính lại.
          </p>
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">File báo cáo:</span>
              {files.map((f) => (
                <Button key={f.id} size="sm" variant="ghost" onClick={() => onPreview({ path: f.path, name: f.fileName, caption: "Báo cáo kiểm mẫu của kho" })} title={`Xem ${f.fileName}.`}>
                  <ClipboardList className="mr-1 h-4 w-4" aria-hidden />
                  <span className="break-all">{f.fileName}</span>
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Hộp nạp báo cáo / nhập tay / sửa một mẫu ---------- */

export interface SampleDialogTarget {
  receipt: ImportReceipt;
  /** Sửa một mẫu đã lưu (không đổi file). */
  edit?: ImportSampleCheck;
}

export interface SampleSavePayload {
  receiptId: string;
  samples: ImportSampleCheck[];
  files: ImportFile[];
  /** Q4: thay mọi mẫu đang có của lần nhập. */
  replace: boolean;
  /** Đang sửa một mẫu ⇒ chỉ thay đúng mẫu này. */
  editId?: string;
}

interface SampleColumn {
  key: string;
  selected: boolean;
  /** Cột thêm tay (không đọc từ file) ⇒ bỏ được. */
  manual: boolean;
  sample: ImportSampleCheck;
  needsReview: string[];
}
interface SampleForm {
  key: string;
  mode: "import" | "edit";
  receiptId: string;
  contractId: string;
  reportDate: string;
  batchId: string;
  columns: SampleColumn[];
  replace: boolean;
  /** Ghi chú kết quả đọc file ("Đọc 5 mẫu…", "Ảnh chỉ đính kèm…"). */
  readNote: string;
  initial: string;
}
const formSnap = (f: SampleForm) => JSON.stringify([f.reportDate, f.columns, f.replace]);

const manualColumn = (f: Pick<SampleForm, "receiptId" | "contractId" | "reportDate" | "batchId">): SampleColumn => ({
  key: newId(),
  selected: true,
  manual: true,
  sample: emptySample(newId(), { contractId: f.contractId, receiptId: f.receiptId, reportDate: f.reportDate, batchId: f.batchId }),
  needsReview: [],
});

export function SampleCheckDialog({
  target,
  data,
  supplierNames,
  recordedBy,
  onClose,
  onSave,
}: {
  target: SampleDialogTarget | null;
  data: ImportData;
  /** Tên NCC của HĐ (tên gọi tắt + tên đầy đủ) — để chọn sẵn cột của invoice (R25). */
  supplierNames: (contractId: string) => string[];
  recordedBy: string;
  onClose: () => void;
  onSave: (p: SampleSavePayload) => boolean;
}) {
  const [form, setForm] = useState<SampleForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "import-sample-checks", value: form, setValue: setForm, isEmpty: (f) => formSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const r = target.receipt;
    let f: SampleForm;
    if (target.edit) {
      const s = target.edit;
      f = {
        key: s.id,
        mode: "edit",
        receiptId: r.id,
        contractId: r.contractId,
        reportDate: s.reportDate,
        batchId: s.batchId,
        columns: [{ key: s.id, selected: true, manual: false, sample: { ...s, sizeDistribution: { ...s.sizeDistribution }, extra: { ...s.extra } }, needsReview: [] }],
        replace: false,
        readNote: "",
        initial: "",
      };
    } else {
      f = { key: `new-${r.id}`, mode: "import", receiptId: r.id, contractId: r.contractId, reportDate: "", batchId: newId(), columns: [], replace: true, readNote: "", initial: "" };
    }
    const fresh = { ...f, initial: formSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const lines: ImportContractLine[] = form ? linesOf(data, form.contractId) : [];
  const existing = form ? samplesOfReceipt(data.sampleChecks ?? [], form.receiptId) : [];

  const setColumn = (key: string, patch: (c: SampleColumn) => SampleColumn) =>
    setForm((f) => (f ? { ...f, columns: f.columns.map((c) => (c.key === key ? patch(c) : c)) } : f));
  const setSample = (key: string, patch: Partial<ImportSampleCheck>) => setColumn(key, (c) => ({ ...c, sample: { ...c.sample, ...patch } }));

  const pickFiles = async (picked: File[]) => {
    setFiles(picked);
    const file = picked[0];
    if (!form || !file) return;
    if (!isReadableSampleFile(file.name)) {
      // Q1: ảnh / PDF chỉ đính kèm — mở sẵn một cột trống để gõ tay nếu chưa có cột nào.
      setForm((f) => (f ? { ...f, readNote: "Ảnh / PDF chỉ đính kèm, app không đọc số — gõ số theo báo cáo vào bảng dưới.", columns: f.columns.length ? f.columns : [manualColumn(f)] } : f));
      return;
    }
    try {
      const parsed = await readSampleReportFile(file);
      if (parsed.failure) {
        setForm((f) => (f ? { ...f, readNote: parsed.failure as string } : f));
        return;
      }
      const receipt = data.receipts.find((x) => x.id === form.receiptId);
      const docNos = data.documents.filter((d) => d.receiptId === form.receiptId).map((d) => d.docNo).filter(Boolean);
      const chosen = suggestSampleColumns(parsed.samples, { supplierNames: supplierNames(form.contractId), docNos, arrivalDate: receipt?.arrivalDate ?? "" });
      setForm((f) => {
        if (!f) return f;
        const columns: SampleColumn[] = parsed.samples.map((p) => ({
          key: newId(),
          selected: chosen.includes(p.column),
          manual: false,
          sample: {
            ...emptySample(newId(), { contractId: f.contractId, receiptId: f.receiptId, batchId: f.batchId }),
            ...p.values,
            contractLineId: suggestLineForSize(p.values.size, lines),
          },
          needsReview: p.needsReview,
        }));
        return {
          ...f,
          reportDate: parsed.reportDate || f.reportDate,
          columns,
          readNote: `Đọc được ${columns.length} mẫu, chọn sẵn ${chosen.length} mẫu của lần nhập này (theo nhà xuất khẩu${receipt?.arrivalDate ? " và ngày về kho" : ""}). Kiểm lại trước khi lưu.`,
        };
      });
    } catch (e) {
      setForm((f) => (f ? { ...f, readNote: `Không đọc được file: ${e instanceof Error ? e.message : "lỗi không rõ"}` } : f));
    }
  };

  const save = async () => {
    if (!form || busy) return;
    const chosen = form.columns.filter((c) => c.selected);
    const errs: FieldError[] = [];
    if (!chosen.length) errs.push({ field: "Mẫu", message: "Chọn ít nhất một mẫu để lưu, hoặc Thêm mẫu nhập tay." });
    chosen.forEach((c, i) => {
      if (!c.sample.size.trim() && !c.sample.sampleNo.trim()) errs.push({ field: `Mẫu ${i + 1}`, message: `Mẫu ${i + 1}: ghi size hoặc STT mẫu để biết là mẫu nào.` });
    });
    for (const f of files) {
      const fe = checkImportFile(f);
      if (fe) errs.push({ field: "File báo cáo", message: fe });
    }
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const up = form.mode === "import" ? await uploadAll(files, form.contractId, { contractId: form.contractId, receiptId: form.receiptId, documentId: "", uploadedBy: recordedBy }) : [];
      if ("error" in up) throw new Error(up.error);
      const now = new Date().toISOString();
      const samples = chosen.map((c) => ({
        ...c.sample,
        reportDate: form.reportDate,
        fileId: form.mode === "import" ? (up[0]?.id ?? "") : c.sample.fileId,
        createdAt: c.sample.createdAt || now,
      }));
      const ok = onSave({ receiptId: form.receiptId, samples, files: up, replace: form.mode === "import" && form.replace, editId: form.mode === "edit" ? form.key : undefined });
      if (!ok) {
        if (up.length) void removeImportFiles(up.map((x) => x.path));
        return;
      }
      draft.done();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  const shown = form?.columns ?? [];
  const flagged = shown.flatMap((c, i) => (c.selected ? c.needsReview.map((n) => `Mẫu ${c.sample.sampleNo || i + 1} · ${n}`) : []));

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={form?.mode === "edit" ? "Sửa mẫu kiểm của kho" : "Nạp báo cáo kiểm mẫu của kho"}
      description="Lưu đúng số trên báo cáo của kho, đi kèm lần nhập (invoice) này. App không tính lại."
      icon={ClipboardList}
      size="xl"
      footer={
        <DialogFooter
          busy={busy}
          onCancel={() => {
            if (busy) return;
            draft.cancel();
            onClose();
          }}
          onSave={() => void save()}
          label="Lưu kiểm mẫu"
          title="Lưu các mẫu đã chọn vào lần nhập."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 py-2">
          <ErrorSummary errors={errors} />
          {form.mode === "import" && (
            <Field label="File báo cáo (Excel tự đọc; ảnh / PDF chỉ đính kèm)">
              <FilePicker files={files} onChange={(f) => void pickFiles(f)} multiple={false} accept={IMPORT_FILE_ACCEPT} />
            </Field>
          )}
          {form.readNote && (
            <p role="status" className="rounded-lg bg-muted px-4 py-2 text-sm">
              {form.readNote}
            </p>
          )}
          {flagged.length > 0 && (
            <div role="alert" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              <p className="font-medium">Ô không đọc được, để trống — soát lại theo báo cáo:</p>
              <p>{flagged.join(" · ")}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ngày báo cáo">
              <Input type="date" value={form.reportDate} onChange={(e) => setForm((f) => (f ? { ...f, reportDate: e.target.value } : f))} />
            </Field>
            {form.mode === "import" && existing.length > 0 && (
              <ChoiceGroup
                label={`Lần nhập này đã có ${existing.length} mẫu`}
                value={form.replace ? "replace" : "keep"}
                onChange={(v) => setForm((f) => (f ? { ...f, replace: v === "replace" } : f))}
                options={[
                  { value: "replace", label: "Thay bằng mẫu mới" },
                  { value: "keep", label: "Giữ và thêm" },
                ]}
                columns={2}
              />
            )}
          </div>
          {shown.length > 0 && (
            <SampleEditGrid
              columns={shown}
              lines={lines}
              showPick={form.mode === "import"}
              onToggle={(key, v) => setColumn(key, (c) => ({ ...c, selected: v }))}
              onRemove={(key) => setForm((f) => (f ? { ...f, columns: f.columns.filter((c) => c.key !== key) } : f))}
              onSample={setSample}
            />
          )}
          {form.mode === "import" && (
            <div>
              <Button variant="outline" onClick={() => setForm((f) => (f ? { ...f, columns: [...f.columns, manualColumn(f)] } : f))} title="Thêm một cột mẫu trống để gõ số tay (khi báo cáo là ảnh).">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Thêm mẫu nhập tay
              </Button>
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Lưới soát: hàng = chỉ số, cột = mẫu (đúng khuôn báo cáo của kho) ---------- */

function SampleEditGrid({
  columns,
  lines,
  showPick,
  onToggle,
  onRemove,
  onSample,
}: {
  columns: SampleColumn[];
  lines: ImportContractLine[];
  showPick: boolean;
  onToggle: (key: string, v: boolean) => void;
  onRemove: (key: string) => void;
  onSample: (key: string, patch: Partial<ImportSampleCheck>) => void;
}) {
  const lineOptions = lines.map((l) => ({ value: l.id, label: l.productName || `Dòng ${l.lineNo}` }));
  const extraKeys = [...new Set(columns.flatMap((c) => Object.keys(c.sample.extra)))];
  const cellClass = (c: SampleColumn, label: string) => `px-1.5 py-1 align-top ${c.needsReview.includes(label) ? "bg-warning-surface" : ""} ${c.selected ? "" : "opacity-50"}`;
  return (
    <HorizontalScroll>
      <table className="relative w-max min-w-full border-collapse text-sm" data-grid-nav>
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-background px-2 py-1.5 text-left align-bottom font-medium">Chỉ số</th>
            {columns.map((c, i) => (
              <th key={c.key} className={`w-44 min-w-44 px-1.5 py-1.5 text-left align-bottom font-medium ${c.selected ? "" : "opacity-60"}`}>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    {showPick ? (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4" checked={c.selected} onChange={(e) => onToggle(c.key, e.target.checked)} />
                        <span>Mẫu {c.sample.sampleNo || i + 1}</span>
                      </label>
                    ) : (
                      <span>Mẫu {c.sample.sampleNo || i + 1}</span>
                    )}
                    {c.manual && (
                      <Button size="sm" variant="ghost" onClick={() => onRemove(c.key)} title={`Bỏ cột mẫu ${i + 1} (chưa lưu).`}>
                        <X className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Bỏ cột mẫu {i + 1}</span>
                      </Button>
                    )}
                  </div>
                  {c.sample.exporterName && <Tag variant="muted">{c.sample.exporterName}</Tag>}
                  <Combobox
                    label="Dòng hàng HĐ"
                    value={c.sample.contractLineId}
                    onChange={(v) => onSample(c.key, { contractLineId: v })}
                    options={lineOptions}
                    emptyText="Hợp đồng chưa có dòng hàng."
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => (
            <GroupRows key={g} group={g} columns={columns} cellClass={cellClass} onSample={onSample} />
          ))}
          <tr>
            <th colSpan={columns.length + 1} className="sticky left-0 bg-muted/50 px-2 py-1 text-left font-semibold">
              Size (gr/pc) · %
            </th>
          </tr>
          {SIZE_BUCKETS.map((b) => (
            <tr key={b} className="border-b border-border/60">
              <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-normal">
                {b}
              </th>
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c, `Size ${b}`)}>
                  <NumberField
                    label={`Size ${b} · mẫu ${c.sample.sampleNo}`}
                    hideLabel
                    unit="%"
                    navCol={`size-${b}`}
                    value={c.sample.sizeDistribution[b] ?? null}
                    onChange={(v) => onSample(c.key, { sizeDistribution: { ...c.sample.sizeDistribution, [b]: v } })}
                  />
                </td>
              ))}
            </tr>
          ))}
          {extraKeys.map((k) => (
            <tr key={k} className="border-b border-border/60">
              <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-normal">
                {k}
              </th>
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c, k)}>
                  <Input aria-label={`${k} · mẫu ${c.sample.sampleNo}`} value={c.sample.extra[k] ?? ""} onChange={(e) => onSample(c.key, { extra: { ...c.sample.extra, [k]: e.target.value } })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScroll>
  );
}

function GroupRows({
  group,
  columns,
  cellClass,
  onSample,
}: {
  group: (typeof GROUPS)[number];
  columns: SampleColumn[];
  cellClass: (c: SampleColumn, label: string) => string;
  onSample: (key: string, patch: Partial<ImportSampleCheck>) => void;
}) {
  const metrics = SAMPLE_METRICS.filter((m) => m.group === group);
  return (
    <>
      <tr>
        <th colSpan={columns.length + 1} className="sticky left-0 bg-muted/50 px-2 py-1 text-left font-semibold">
          {SAMPLE_GROUP_LABELS[group]}
        </th>
      </tr>
      {metrics.map((m) => (
        <tr key={m.key} className="border-b border-border/60">
          <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-normal">
            {m.label}
          </th>
          {columns.map((c) => {
            const v = metricValue(c.sample, m.key);
            const label = `${m.label} · mẫu ${c.sample.sampleNo}`;
            return (
              <td key={c.key} className={cellClass(c, m.label)}>
                {m.kind === "number" || m.kind === "percent" ? (
                  <NumberField label={label} hideLabel unit={unitOf(m)} navCol={m.key} value={typeof v === "number" ? v : null} onChange={(n) => onSample(c.key, { [m.key]: n } as Partial<ImportSampleCheck>)} />
                ) : (
                  <Input
                    aria-label={label}
                    type={m.kind === "date" ? "date" : "text"}
                    value={v == null ? "" : String(v)}
                    onChange={(e) => onSample(c.key, { [m.key]: e.target.value } as Partial<ImportSampleCheck>)}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
