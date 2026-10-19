// ============================================================
// Tên file: src/features/documents/VersionFormDialog.tsx
// Tên tiếng Việt: Hộp ghi lần ban hành ĐÃ KÝ GIẤY (đính PDF đã ký + file gốc)
// Description: Record a paper-signed revision: effective date, change summary, people,
//              signed PDF (required when storage is on) + optional source file.
// ============================================================
// Luật (spec docs/spec/quan-ly-tai-lieu.md): DOC-R3b — bắt buộc PDF đã ký khi đã nối máy chủ;
// lưu xong lần này có hiệu lực ngay, lần cũ tự hết hiệu lực (lib/documents.ts recordPaperVersion).
// Nháp (luật 17) giữ phần CHỮ; file đã chọn không giữ được qua tải lại trang — chọn lại.
import { useEffect, useRef, useState } from "react";
import {
  Button,
  DateField,
  ErrorSummary,
  Field,
  FormDialog,
  Input,
  NumberField,
  Textarea,
  notify,
  todayIso,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  DOCUMENT_PDF_ACCEPT,
  DOCUMENT_SOURCE_ACCEPT,
  activeVersionOf,
  checkDocumentFile,
  formatRevision,
  nextRevisionNo,
  versionsOf,
} from "@/lib/documents";
import { documentFilePath, hasDocumentStorage, removeDocumentFiles, uploadDocumentFile } from "@/lib/documentStorage";
import type { CompanyDocument, DocumentVersion } from "@/types";
import { FileSignature, Paperclip, Save } from "lucide-react";

interface VersionForm {
  key: string;
  documentId: string;
  revisionNo: number | null;
  effectiveDate: string;
  changeSummary: string;
  preparedByName: string;
  reviewedByName: string;
  approvedByName: string;
  /** Giá trị lúc mở — nháp rỗng thì không lưu. */
  initial: string;
}

const snapshot = (f: VersionForm) =>
  JSON.stringify([f.revisionNo, f.effectiveDate, f.changeSummary, f.preparedByName, f.reviewedByName, f.approvedByName]);

function formFor(doc: CompanyDocument, versions: readonly DocumentVersion[], today: string): VersionForm {
  const prev = activeVersionOf(versions, doc.id);
  const f: VersionForm = {
    key: doc.id,
    documentId: doc.id,
    revisionNo: nextRevisionNo(versions, doc.id),
    effectiveDate: today,
    changeSummary: "",
    preparedByName: prev?.preparedByName ?? "",
    reviewedByName: prev?.reviewedByName ?? "",
    approvedByName: prev?.approvedByName ?? "",
    initial: "",
  };
  return { ...f, initial: snapshot(f) };
}

/** Một ô chọn file — nút + tên file đã chọn (input file ẩn). */
function FilePick({
  label,
  required,
  accept,
  file,
  onPick,
  hint,
}: {
  label: string;
  required?: boolean;
  accept: string;
  file: File | null;
  onPick: (f: File | null) => void;
  hint: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} title={`Chọn file cho ô "${label}" từ máy.`}>
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          {file ? "Chọn file khác" : "Chọn file"}
        </Button>
        <span className="min-w-0 break-all text-sm text-muted-foreground">{file ? file.name : "Chưa chọn file"}</span>
      </div>
    </Field>
  );
}

export function VersionFormDialog({
  document: doc,
  versions,
  recordedByName,
  onClose,
  onSave,
}: {
  document: CompanyDocument | null;
  versions: readonly DocumentVersion[];
  recordedByName: string;
  onClose: () => void;
  /** Ghi dòng lần ban hành; trả false nếu ghi bị chặn (để gỡ file vừa tải). */
  onSave: (v: Omit<DocumentVersion, "status" | "approvalMode" | "obsoletedOn">) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<VersionForm | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [source, setSource] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const busy = useRef(false);
  const draft = useDialogDraft({ form: "documents-version", value: form, setValue: setForm, isEmpty: (f) => snapshot(f) === f.initial });

  useEffect(() => {
    if (!doc) return;
    const fresh = formFor(doc, versions, today);
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setPdf(null);
    setSource(null);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp cho một tài liệu
  }, [doc]);

  const set = <K extends keyof VersionForm>(k: K, v: VersionForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || !doc || busy.current) return;
    const errs: FieldError[] = [];
    const rev = Math.trunc(form.revisionNo ?? 0);
    if (rev <= 0) errs.push({ field: "Lần ban hành", message: "Lần ban hành phải từ 1 trở lên" });
    else if (versionsOf(versions, doc.id).some((v) => v.revisionNo === rev))
      errs.push({ field: "Lần ban hành", message: `Lần ${formatRevision(rev)} đã có — mỗi lần ban hành ghi một lần` });
    if (!form.effectiveDate) errs.push({ field: "Ngày hiệu lực", message: "Chưa chọn ngày hiệu lực" });
    if (!form.approvedByName.trim()) errs.push({ field: "Người phê duyệt", message: "Chưa ghi người phê duyệt (tên trên bản ký)" });
    if (hasDocumentStorage && !pdf) errs.push({ field: "PDF đã ký", message: "Chưa đính bản PDF đã ký" });
    for (const [f, kind] of [
      [pdf, "pdf"],
      [source, "source"],
    ] as const) {
      const e = f ? checkDocumentFile(f, kind) : null;
      if (e) errs.push({ field: kind === "pdf" ? "PDF đã ký" : "File gốc", message: e });
    }
    setErrors(errs);
    if (errs.length) return;

    busy.current = true;
    setIsUploading(true);
    const versionId = newId();
    const uploaded: string[] = [];
    try {
      let pdfPath = "";
      let sourcePath = "";
      if (hasDocumentStorage && pdf) {
        const r = await uploadDocumentFile(documentFilePath(doc.id, versionId, "pdf", pdf.name), pdf);
        if ("error" in r) throw new Error(r.error);
        pdfPath = r.path;
        uploaded.push(r.path);
      }
      if (hasDocumentStorage && source) {
        const r = await uploadDocumentFile(documentFilePath(doc.id, versionId, "source", source.name), source);
        if ("error" in r) throw new Error(r.error);
        sourcePath = r.path;
        uploaded.push(r.path);
      }
      const ok = onSave({
        id: versionId,
        documentId: doc.id,
        revisionNo: rev,
        effectiveDate: form.effectiveDate,
        changeSummary: form.changeSummary.trim(),
        preparedByName: form.preparedByName.trim(),
        reviewedByName: form.reviewedByName.trim(),
        approvedByName: form.approvedByName.trim(),
        reviewerId: "",
        approverId: "",
        reviewedAt: "",
        approvedAt: "",
        returnReason: "",
        pdfPath,
        sourcePath,
        pdfFileName: pdfPath ? (pdf?.name ?? "") : "",
        sourceFileName: sourcePath ? (source?.name ?? "") : "",
        recordedByName,
        createdAt: new Date().toISOString(),
      });
      if (!ok) {
        void removeDocumentFiles(uploaded);
        return;
      }
      draft.done();
    } catch (e) {
      void removeDocumentFiles(uploaded);
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      busy.current = false;
      setIsUploading(false);
    }
  };

  const close = () => {
    if (busy.current) return;
    draft.dismiss();
    onClose();
  };

  return (
    <FormDialog
      open={!!form && !!doc}
      onOpenChange={(o) => !o && close()}
      title={`Ghi lần ban hành ${form?.revisionNo ? formatRevision(form.revisionNo) : ""} · ${doc?.code ?? ""}`}
      description="Ghi lại bản đã ký giấy. Lưu xong lần này có hiệu lực ngay, lần đang hiệu lực trước đó chuyển Hết hiệu lực (vẫn mở xem được)."
      icon={FileSignature}
      size="lg"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (busy.current) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Tải file lên và ghi lần ban hành này — có hiệu lực ngay.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {isUploading ? "Đang tải file…" : "Lưu lần ban hành"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && doc && (
        <div className="space-y-4 py-2">
          <ErrorSummary errors={errors} />
          {!hasDocumentStorage && (
            <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              Đang chạy không nối máy chủ: chỉ ghi thông tin lần ban hành, chưa lưu được file.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Lần ban hành" required unit="" value={form.revisionNo} onChange={(v) => set("revisionNo", v)} hint="Số in trên tài liệu (01, 02…)." />
            <DateField label="Ngày hiệu lực" required value={form.effectiveDate} onChange={(v) => set("effectiveDate", v)} />
          </div>
          <Field label="Nội dung sửa đổi" hint="VD: Cập nhật theo BRC 9.">
            <Textarea rows={2} value={form.changeSummary} onChange={(e) => set("changeSummary", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Người soạn">
              <Input value={form.preparedByName} onChange={(e) => set("preparedByName", e.target.value)} />
            </Field>
            <Field label="Người xem xét">
              <Input value={form.reviewedByName} onChange={(e) => set("reviewedByName", e.target.value)} />
            </Field>
            <Field label="Người phê duyệt" required>
              <Input value={form.approvedByName} onChange={(e) => set("approvedByName", e.target.value)} aria-required />
            </Field>
          </div>
          {hasDocumentStorage && (
            <div className="grid gap-4">
              <FilePick label="PDF đã ký" required accept={DOCUMENT_PDF_ACCEPT} file={pdf} onPick={setPdf} hint="Bản scan / PDF có chữ ký — tối đa 20 MB." />
              <FilePick
                label="File gốc"
                accept={DOCUMENT_SOURCE_ACCEPT}
                file={source}
                onPick={setSource}
                hint="Word / Excel để sửa lần sau (không bắt buộc)."
              />
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}
