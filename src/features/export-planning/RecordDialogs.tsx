// ============================================================
// Tên file: src/features/export-planning/RecordDialogs.tsx
// Tên tiếng Việt: Hộp duyệt cuối · đính kèm hồ sơ · gia hạn · gửi chứng từ / tiền về · lý do hủy / đóng
// Description: Small record dialogs of the export dossier: paper approval of one revision,
//              customer-confirmed deadline extension, step 6 entries, reason prompt.
// ============================================================
// Luật: ba-spec 41 NV4 (duyệt gắn BẢN, không đồng ý thì bắt lý do), NV6 (gia hạn không cần BGĐ
// duyệt lại), NV10 (gửi bộ chứng từ + tiền về, cấp chuyến hoặc cấp HĐ). Nháp: luật 17.
import { useEffect, useState } from "react";
import {
  Button,
  ChoiceGroup,
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
import { CONTRACT_ATTACHMENT_LABELS, FINAL_REVIEW_LABELS } from "@/lib/exportPlanning";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile, type ExportFileArea } from "@/lib/exportFileStorage";
import type {
  ExportContractApproval,
  ExportContractAttachmentKind,
  ExportDeadlineExtension,
  ExportFile,
  ExportPayment,
  ExportPaymentKind,
} from "@/types";
import { CalendarClock, ClipboardCheck, Paperclip, Save, Wallet } from "lucide-react";
import { FilePicker } from "./parts";

/** Tải 0–1 file lên trước khi ghi dòng; lỗi ⇒ `{ error }`. */
async function uploadOne(file: File | undefined, contractId: string, area: ExportFileArea, id: string): Promise<{ path: string; fileName: string } | { error: string } | null> {
  if (!file || !hasExportStorage) return null;
  return uploadExportFile(exportFilePath(contractId, area, id, file.name), file);
}

export interface FinalReviewTarget {
  contractId: string;
  contractNo: string;
  /** Bản hiệu lực — lượt duyệt cuối gắn vào bản này. */
  revisionId: string;
  /** HĐ chưa xuất đủ trong dung sai (đóng sớm) ⇒ bắt lý do khi đồng ý. */
  needsReason: boolean;
  /** "Thực xuất 12.000 / 12.050 kg …" — cho người duyệt xem lại. */
  summary: string;
}

interface FinalReviewForm {
  key: string;
  decision: "approved" | "needs-revision";
  decidedOn: string;
  reason: string;
  initial: string;
}
const finalSnap = (f: FinalReviewForm) => JSON.stringify([f.decision, f.decidedOn, f.reason]);

export function FinalReviewDialog({
  target,
  approverName,
  onClose,
  onSave,
}: {
  target: FinalReviewTarget | null;
  approverName: string;
  onClose: () => void;
  onSave: (a: ExportContractApproval) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<FinalReviewForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "export-final-review", value: form, setValue: setForm, isEmpty: (f) => finalSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const f: FinalReviewForm = { key: target.contractId, decision: "approved", decidedOn: today, reason: "", initial: "" };
    const fresh = { ...f, initial: finalSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof FinalReviewForm>(k: K, v: FinalReviewForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = () => {
    if (!form || !target) return;
    const errs: FieldError[] = [];
    if (!form.decidedOn) errs.push({ field: "Ngày duyệt", message: "Chọn ngày duyệt" });
    if (form.decision === "needs-revision" && !form.reason.trim()) errs.push({ field: "Lý do", message: "Trả về thì phải ghi cần sửa gì" });
    if (form.decision === "approved" && target.needsReason && !form.reason.trim())
      errs.push({ field: "Lý do", message: "Hợp đồng chưa xuất đủ trong dung sai — ghi lý do đóng sớm (khách giảm lượng, phụ kiện…)" });
    setErrors(errs);
    if (errs.length) return;
    const ok = onSave({
      id: newId(),
      contractId: target.contractId,
      revisionId: target.revisionId,
      stage: "final",
      decision: form.decision,
      approverName,
      decidedOn: form.decidedOn,
      reason: form.reason.trim(),
      filePath: "",
      fileName: "",
      recordedBy: approverName,
      createdAt: new Date().toISOString(),
    });
    if (ok) draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Duyệt cuối · HĐ ${target?.contractNo ?? ""}`}
      description="Xem lại hồ sơ các chuyến. Đồng ý ⇒ đóng hợp đồng. Chưa ổn ⇒ trả về kèm lý do, Nhân viên Kế hoạch sửa rồi chờ duyệt cuối lại."
      icon={ClipboardCheck}
      size="md"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={save} title="Ghi kết quả duyệt cuối (tên bạn là người duyệt). Đồng ý thì hợp đồng đóng.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu kết quả duyệt cuối
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && target && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <p role="status" className={`rounded-lg px-4 py-2 text-sm ${target.needsReason ? "bg-warning-surface" : "bg-muted"}`}>
            {target.summary}
          </p>
          <ChoiceGroup
            label="Kết quả"
            required
            value={form.decision}
            onChange={(v) => set("decision", v as FinalReviewForm["decision"])}
            options={(["approved", "needs-revision"] as const).map((v) => ({ value: v, label: FINAL_REVIEW_LABELS[v] }))}
            columns={2}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Người duyệt" hint="Tài khoản đang đăng nhập.">
              <Input value={approverName} readOnly />
            </Field>
            <DateField label="Ngày duyệt" required value={form.decidedOn} onChange={(v) => set("decidedOn", v)} />
          </div>
          {(form.decision === "needs-revision" || target.needsReason) && (
            <Field label={form.decision === "needs-revision" ? "Cần sửa gì" : "Lý do đóng sớm"} required>
              <Textarea rows={2} value={form.reason} onChange={(e) => set("reason", e.target.value)} aria-required />
            </Field>
          )}
          {form.decision === "approved" && !target.needsReason && (
            <Field label="Ghi chú (nếu có)">
              <Textarea rows={2} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Đính kèm hồ sơ hợp đồng (bước Đính kèm, mig 0079) ---------- */

export interface AttachmentTarget {
  contractId: string;
  contractNo: string;
  /** Loại hồ sơ bắt buộc còn thiếu — chọn sẵn loại đầu tiên. */
  missing: ExportContractAttachmentKind[];
}

interface AttachmentForm {
  key: string;
  kind: ExportContractAttachmentKind;
  caption: string;
  initial: string;
}
const attachSnap = (f: AttachmentForm) => JSON.stringify([f.kind, f.caption]);

export function AttachmentDialog({
  target,
  recordedBy,
  onClose,
  onSave,
}: {
  target: AttachmentTarget | null;
  recordedBy: string;
  onClose: () => void;
  onSave: (rows: ExportFile[]) => boolean;
}) {
  const [form, setForm] = useState<AttachmentForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-contract-attachment", value: form, setValue: setForm, isEmpty: (f) => attachSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const f: AttachmentForm = { key: target.contractId, kind: target.missing[0] ?? "signed-contract", caption: "", initial: "" };
    const fresh = { ...f, initial: attachSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const save = async () => {
    if (!form || !target || busy) return;
    const errs: FieldError[] = [];
    if (!files.length) errs.push({ field: "File", message: "Chọn ít nhất một file" });
    if (!hasExportStorage) errs.push({ field: "Máy chủ", message: "Đang chạy không nối máy chủ — chưa tải file lên được" });
    for (const f of files) {
      const fe = checkExportFile(f);
      if (fe) errs.push({ field: f.name, message: fe });
    }
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const done: string[] = [];
    try {
      const rows: ExportFile[] = [];
      for (const f of files) {
        const id = newId();
        const up = await uploadOne(f, target.contractId, "contract", id);
        if (up && "error" in up) throw new Error(up.error);
        if (!up) continue;
        done.push(up.path);
        rows.push({
          id,
          contractId: target.contractId,
          shipmentId: "",
          stepItemId: "",
          step: "contract",
          attachmentKind: form.kind,
          path: up.path,
          fileName: up.fileName,
          layerNo: null,
          caption: [CONTRACT_ATTACHMENT_LABELS[form.kind], form.caption.trim()].filter(Boolean).join(" — "),
          uploadedBy: recordedBy,
          createdAt: new Date().toISOString(),
        });
      }
      if (!onSave(rows)) {
        void removeExportFiles(done);
        return;
      }
      draft.done();
    } catch (e) {
      void removeExportFiles(done);
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={`Đính kèm hồ sơ · HĐ ${target?.contractNo ?? ""}`}
      description="Hồ sơ bắt buộc: hợp đồng đã ký (và L/C nếu thanh toán L/C). Đủ hồ sơ bắt buộc mới ghi chuyến được."
      icon={Paperclip}
      size="md"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (busy) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Tải file lên và gắn vào hồ sơ hợp đồng.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang tải file…" : "Lưu file đính kèm"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && target && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <ChoiceGroup
            label="Loại hồ sơ"
            required
            value={form.kind}
            onChange={(v) => setForm((f) => (f ? { ...f, kind: v as ExportContractAttachmentKind } : f))}
            options={(Object.keys(CONTRACT_ATTACHMENT_LABELS) as ExportContractAttachmentKind[]).map((k) => ({
              value: k,
              label: `${CONTRACT_ATTACHMENT_LABELS[k]}${target.missing.includes(k) ? " (còn thiếu)" : ""}`,
            }))}
            columns={2}
          />
          <Field label="Ghi chú (nếu có)" hint="VD: bản ký hai bên ngày 12/10, L/C tu chỉnh lần 1.">
            <Input value={form.caption} onChange={(e) => setForm((f) => (f ? { ...f, caption: e.target.value } : f))} />
          </Field>
          <Field label="File" required nestedInput>
            <FilePicker files={files} onChange={setFiles} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Gia hạn giao hàng (NV6) ---------- */

export interface ExtensionTarget {
  contractId: string;
  contractNo: string;
  currentDeadline: string;
}

interface ExtensionForm {
  key: string;
  contractId: string;
  contractNo: string;
  currentDeadline: string;
  newDeadline: string;
  confirmedOn: string;
  note: string;
  initial: string;
}
const extSnap = (f: ExtensionForm) => JSON.stringify([f.newDeadline, f.confirmedOn, f.note]);

export function ExtensionDialog({
  target,
  recordedBy,
  onClose,
  onSave,
}: {
  target: ExtensionTarget | null;
  recordedBy: string;
  onClose: () => void;
  onSave: (e: ExportDeadlineExtension) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<ExtensionForm | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-extension", value: form, setValue: setForm, isEmpty: (f) => extSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const f: ExtensionForm = { key: target.contractId, ...target, newDeadline: "", confirmedOn: today, note: "", initial: "" };
    const fresh = { ...f, initial: extSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFile([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ExtensionForm>(k: K, v: ExtensionForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || busy) return;
    const errs: FieldError[] = [];
    if (!form.newDeadline) errs.push({ field: "Hạn giao mới", message: "Chọn hạn giao mới" });
    else if (form.currentDeadline && form.newDeadline <= form.currentDeadline)
      errs.push({ field: "Hạn giao mới", message: "Hạn mới phải sau hạn đang có" });
    if (!form.note.trim() && !file[0]) errs.push({ field: "Xác nhận của khách", message: "Đính email / thư khách xác nhận, hoặc ghi chú nội dung xác nhận" });
    const fe = file[0] ? checkExportFile(file[0]) : null;
    if (fe) errs.push({ field: "File", message: fe });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const id = newId();
    let uploaded = "";
    try {
      const up = await uploadOne(file[0], form.contractId, "contract", id);
      if (up && "error" in up) throw new Error(up.error);
      if (up) uploaded = up.path;
      const ok = onSave({
        id,
        contractId: form.contractId,
        newDeadline: form.newDeadline,
        confirmedOn: form.confirmedOn,
        note: form.note.trim(),
        filePath: up?.path ?? "",
        fileName: up?.fileName ?? "",
        recordedBy,
        createdAt: new Date().toISOString(),
      });
      if (!ok) {
        if (uploaded) void removeExportFiles([uploaded]);
        return;
      }
      draft.done();
    } catch (e) {
      if (uploaded) void removeExportFiles([uploaded]);
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={`Gia hạn giao hàng · HĐ ${form?.contractNo ?? ""}`}
      description="Khách đã đồng ý kéo hạn (quy trình KH-R11). Không cần duyệt lại; trễ hạn tính theo hạn mới."
      icon={CalendarClock}
      size="md"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (busy) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Ghi hạn giao mới khách đã xác nhận.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang tải file…" : "Lưu gia hạn"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Hạn giao mới" required value={form.newDeadline} onChange={(v) => set("newDeadline", v)} />
            <DateField label="Ngày khách xác nhận" value={form.confirmedOn} onChange={(v) => set("confirmedOn", v)} />
          </div>
          <Field label="Ghi chú xác nhận" hint="VD: email anh X ngày 01/09 đồng ý giao trước 30/09.">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {hasExportStorage && (
            <Field label="Email / thư xác nhận của khách">
              <FilePicker files={file} onChange={setFile} multiple={false} />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Bước 6: gửi bộ chứng từ / tiền về (NV10) ---------- */

export interface PaymentTarget {
  contractId: string;
  /** "" = ghi ở cấp hợp đồng (tiền cọc). */
  shipmentId: string;
  label: string;
  kind: ExportPaymentKind;
  currency: string;
  existing?: ExportPayment;
}

interface PaymentForm {
  key: string;
  id: string;
  contractId: string;
  shipmentId: string;
  label: string;
  kind: ExportPaymentKind;
  date: string;
  amount: number | null;
  currency: string;
  method: string;
  note: string;
  filePath: string;
  fileName: string;
  initial: string;
}
const paySnap = (f: PaymentForm) => JSON.stringify([f.kind, f.date, f.amount, f.currency, f.method, f.note]);

export function PaymentDialog({
  target,
  recordedBy,
  onClose,
  onSave,
}: {
  target: PaymentTarget | null;
  recordedBy: string;
  onClose: () => void;
  onSave: (p: ExportPayment) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-payment", value: form, setValue: setForm, isEmpty: (f) => paySnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const e = target.existing;
    const f: PaymentForm = {
      key: e?.id ?? `${target.contractId}:${target.shipmentId}:${target.kind}`,
      id: e?.id ?? newId(),
      contractId: target.contractId,
      shipmentId: target.shipmentId,
      label: target.label,
      kind: e?.kind ?? target.kind,
      date: e?.date ?? today,
      amount: e?.amount ?? null,
      currency: e?.currency ?? target.currency,
      method: e?.method ?? (target.kind === "documents-sent" ? "Email" : ""),
      note: e?.note ?? "",
      filePath: e?.filePath ?? "",
      fileName: e?.fileName ?? "",
      initial: "",
    };
    const fresh = { ...f, initial: paySnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFile([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof PaymentForm>(k: K, v: PaymentForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || busy) return;
    const errs: FieldError[] = [];
    if (!form.date) errs.push({ field: "Ngày", message: "Chọn ngày" });
    if (form.kind === "payment" && !(form.amount != null && form.amount > 0)) errs.push({ field: "Số tiền", message: "Ghi số tiền về (lớn hơn 0)" });
    const fe = file[0] ? checkExportFile(file[0]) : null;
    if (fe) errs.push({ field: "File", message: fe });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    let uploaded = "";
    try {
      const up = await uploadOne(file[0], form.contractId, "payment", form.id);
      if (up && "error" in up) throw new Error(up.error);
      if (up) uploaded = up.path;
      const ok = onSave({
        id: form.id,
        contractId: form.contractId,
        shipmentId: form.shipmentId,
        kind: form.kind,
        date: form.date,
        amount: form.kind === "payment" ? form.amount : null,
        currency: form.currency || "USD",
        method: form.method.trim(),
        note: form.note.trim(),
        filePath: up?.path ?? form.filePath,
        fileName: up?.fileName ?? form.fileName,
        recordedBy,
        createdAt: target?.existing?.createdAt ?? new Date().toISOString(),
      });
      if (!ok) {
        if (uploaded) void removeExportFiles([uploaded]);
        return;
      }
      draft.done();
    } catch (e) {
      if (uploaded) void removeExportFiles([uploaded]);
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={form?.kind === "documents-sent" ? `Gửi bộ chứng từ · ${form?.label ?? ""}` : `Tiền về · ${form?.label ?? ""}`}
      description="Không ảnh hưởng đủ hồ sơ của chuyến / hợp đồng — chỉ để theo dõi."
      icon={Wallet}
      size="md"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (busy) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Lưu dòng này vào bước 6.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang tải file…" : "Lưu"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <ChoiceGroup
            label="Loại"
            value={form.kind}
            onChange={(v) => set("kind", v as ExportPaymentKind)}
            options={[
              { value: "documents-sent", label: "Đã gửi bộ chứng từ" },
              { value: "payment", label: "Tiền về" },
            ]}
            columns={2}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label={form.kind === "payment" ? "Ngày tiền về" : "Ngày gửi"} required value={form.date} onChange={(v) => set("date", v)} />
            {form.kind === "payment" ? (
              <NumberField label="Số tiền" required unit={form.currency} value={form.amount} onChange={(v) => set("amount", v)} />
            ) : (
              <Field label="Cách gửi" hint="Email / chuyển phát / qua ngân hàng">
                <Input value={form.method} onChange={(e) => set("method", e.target.value)} />
              </Field>
            )}
          </div>
          {form.kind === "payment" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tiền tệ">
                <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Kênh nhận" hint="VD: TTR Vietinbank">
                <Input value={form.method} onChange={(e) => set("method", e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {hasExportStorage && (
            <Field label={form.kind === "payment" ? "Giấy báo có" : "Email / biên nhận gửi"} hint={form.fileName ? `Đang có: ${form.fileName}` : undefined}>
              <FilePicker files={file} onChange={setFile} multiple={false} />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Hỏi lý do (hủy hợp đồng / hủy chuyến / đóng tay) ---------- */

export interface ReasonTarget {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}

export function ReasonDialog({ target, onClose }: { target: ReasonTarget | null; onClose: () => void }) {
  // Mỗi lần mở cho một việc mới ⇒ ô lý do trống lại (đặt lại ngay khi vẽ, không qua effect).
  const [forTarget, setForTarget] = useState(target);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (forTarget !== target) {
    setForTarget(target);
    setReason("");
    setError("");
  }
  return (
    <FormDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={target?.title ?? ""}
      description={target?.description}
      size="sm"
      hasRequiredFields
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant={target?.destructive ? "destructive" : "default"}
            title="Xác nhận và ghi lý do."
            onClick={() => {
              if (!reason.trim()) {
                setError("Ghi lý do trước khi xác nhận");
                return;
              }
              target?.onConfirm(reason.trim());
              onClose();
            }}
          >
            {target?.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 py-2">
        <Field label="Lý do" required error={error}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-required />
        </Field>
      </div>
    </FormDialog>
  );
}
