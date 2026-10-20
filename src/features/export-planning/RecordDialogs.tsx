// ============================================================
// Tên file: src/features/export-planning/RecordDialogs.tsx
// Tên tiếng Việt: Hộp ghi kết quả duyệt giấy · gia hạn · gửi chứng từ / tiền về · lý do hủy / đóng
// Description: Small record dialogs of the export dossier: paper approval of one revision,
//              customer-confirmed deadline extension, step 6 entries, reason prompt.
// ============================================================
// Luật: ba-spec 41 NV4 (duyệt gắn BẢN, không đồng ý thì bắt lý do), NV6 (gia hạn không cần BGĐ
// duyệt lại), NV10 (gửi bộ chứng từ + tiền về, cấp chuyến hoặc cấp HĐ). Nháp: luật 17.
import { useEffect, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
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
import { APPROVAL_LABELS } from "@/lib/exportPlanning";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile, type ExportFileArea } from "@/lib/exportFileStorage";
import type { ExportApprovalDecision, ExportContractApproval, ExportDeadlineExtension, ExportPayment, ExportPaymentKind } from "@/types";
import { CalendarClock, FileSignature, Save, Wallet } from "lucide-react";
import { FilePicker } from "./parts";

/** Tải 0–1 file lên trước khi ghi dòng; lỗi ⇒ `{ error }`. */
async function uploadOne(file: File | undefined, contractId: string, area: ExportFileArea, id: string): Promise<{ path: string; fileName: string } | { error: string } | null> {
  if (!file || !hasExportStorage) return null;
  return uploadExportFile(exportFilePath(contractId, area, id, file.name), file);
}

/* ---------- Ghi kết quả BGĐ ký giấy (NV4) ---------- */

export interface ApprovalTarget {
  contractId: string;
  contractNo: string;
  revisionId: string;
  revisionNo: number;
}

/** Người ký duyệt lấy từ tài khoản có vai trò Giám đốc / Phó giám đốc. */
export interface Approver {
  name: string;
  role: "director" | "vice-director";
}
const APPROVER_ROLE_LABEL: Record<Approver["role"], string> = { director: "Giám đốc", "vice-director": "Phó giám đốc" };

interface ApprovalForm {
  key: string;
  /** PGĐ ký HĐ theo ủy quyền của Giám đốc ("" = chưa chọn). */
  onBehalf: "" | "yes" | "no";
  contractId: string;
  revisionId: string;
  revisionNo: number;
  contractNo: string;
  decision: ExportApprovalDecision;
  approverName: string;
  decidedOn: string;
  reason: string;
  initial: string;
}
const approvalSnap = (f: ApprovalForm) => JSON.stringify([f.decision, f.approverName, f.onBehalf, f.decidedOn, f.reason]);

export function ApprovalDialog({
  target,
  approvers,
  recordedBy,
  onClose,
  onSave,
}: {
  target: ApprovalTarget | null;
  /** Rỗng (chưa có tài khoản BGĐ / chạy không nối máy chủ) ⇒ tạm gõ tên, có dòng nhắc. */
  approvers: readonly Approver[];
  recordedBy: string;
  onClose: () => void;
  onSave: (a: ExportContractApproval) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<ApprovalForm | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-approval", value: form, setValue: setForm, isEmpty: (f) => approvalSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    // Mặc định Giám đốc (người đại diện ký HĐ) khi hệ thống có đúng một tài khoản Giám đốc.
    const directors = approvers.filter((a) => a.role === "director");
    const f: ApprovalForm = { key: target.revisionId, ...target, decision: "approved", approverName: directors.length === 1 ? directors[0].name : "", onBehalf: "", decidedOn: today, reason: "", initial: "" };
    const fresh = { ...f, initial: approvalSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFile([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ApprovalForm>(k: K, v: ApprovalForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || busy) return;
    const errs: FieldError[] = [];
    const picked = approvers.find((a) => a.name === form.approverName);
    if (!form.approverName.trim()) errs.push({ field: "Người ký duyệt", message: approvers.length ? "Chọn người ký trong Ban Giám đốc" : "Ghi họ tên người ký duyệt (BGĐ)" });
    else if (approvers.length && !picked) errs.push({ field: "Người ký duyệt", message: "Chọn người ký trong danh sách Ban Giám đốc" });
    if (picked?.role === "vice-director" && form.decision === "approved" && form.onBehalf !== "yes")
      errs.push({ field: "Ủy quyền", message: "Phó giám đốc ký hợp đồng phải có ủy quyền của Giám đốc — chọn \"Có\" nếu đã có giấy ủy quyền" });
    if (!form.decidedOn) errs.push({ field: "Ngày duyệt", message: "Chọn ngày duyệt" });
    if (form.decision !== "approved" && !form.reason.trim()) errs.push({ field: "Lý do", message: "Không đồng ý thì phải ghi lý do" });
    const fe = file[0] ? checkExportFile(file[0]) : null;
    if (fe) errs.push({ field: "File bản ký", message: fe });
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
        revisionId: form.revisionId,
        decision: form.decision,
        approverName: picked
          ? `${picked.name} — ${APPROVER_ROLE_LABEL[picked.role]}${picked.role === "vice-director" && form.onBehalf === "yes" ? " (ký theo ủy quyền)" : ""}`
          : form.approverName.trim(),
        decidedOn: form.decidedOn,
        reason: form.reason.trim(),
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
      title={`Ghi kết quả duyệt · HĐ ${form?.contractNo ?? ""} · bản ${form?.revisionNo ?? ""}`}
      description="BGĐ ký trên giấy; ghi lại kết quả và đính bản scan. Bản bị từ chối: bản đầu ⇒ hủy hợp đồng; bản sửa ⇒ chỉ bỏ bản sửa."
      icon={FileSignature}
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
          <Button variant="save" onClick={() => void save()} title="Ghi kết quả duyệt của bản hợp đồng này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang tải file…" : "Lưu kết quả duyệt"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <ChoiceGroup
            label="Kết quả"
            required
            value={form.decision}
            onChange={(v) => set("decision", v as ExportApprovalDecision)}
            options={(["approved", "needs-revision", "rejected"] as const).map((v) => ({ value: v, label: APPROVAL_LABELS[v] }))}
            columns={3}
          />
          {!approvers.length && (
            <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
              Chưa có tài khoản Giám đốc / Phó giám đốc trong hệ thống — admin gán vai trò ở màn Người dùng để chọn người ký từ danh sách. Tạm thời gõ đúng họ tên trên chữ ký.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {approvers.length ? (
              <Combobox
                label="Người ký duyệt"
                required
                value={form.approverName}
                onChange={(v) => set("approverName", v)}
                options={approvers.map((a) => ({ value: a.name, label: a.name, subLabel: APPROVER_ROLE_LABEL[a.role] }))}
                emptyText="Chưa có tài khoản Ban Giám đốc."
              />
            ) : (
              <Field label="Người ký duyệt" required>
                <Input value={form.approverName} onChange={(e) => set("approverName", e.target.value)} aria-required />
              </Field>
            )}
            <DateField label="Ngày duyệt" required value={form.decidedOn} onChange={(v) => set("decidedOn", v)} />
          </div>
          {approvers.find((a) => a.name === form.approverName)?.role === "vice-director" && form.decision === "approved" && (
            <ChoiceGroup
              label="Ký theo ủy quyền của Giám đốc?"
              required
              value={form.onBehalf}
              onChange={(v) => set("onBehalf", v as ApprovalForm["onBehalf"])}
              options={[
                { value: "yes", label: "Có — có giấy ủy quyền" },
                { value: "no", label: "Không" },
              ]}
              columns={2}
            />
          )}
          {form.decision !== "approved" && (
            <Field label="Lý do" required>
              <Textarea rows={2} value={form.reason} onChange={(e) => set("reason", e.target.value)} aria-required />
            </Field>
          )}
          {hasExportStorage && (
            <Field label="Bản ký (scan)" hint="Hợp đồng có chữ ký BGĐ — bước 1 chỉ xong khi bản hiệu lực có file ký.">
              <FilePicker files={file} onChange={setFile} multiple={false} />
            </Field>
          )}
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
      description="Khách đã đồng ý kéo hạn (quy trình KH-R11). Không cần BGĐ duyệt lại; trễ hạn tính theo hạn mới."
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
