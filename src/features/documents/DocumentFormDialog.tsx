// ============================================================
// Tên file: src/features/documents/DocumentFormDialog.tsx
// Tên tiếng Việt: Hộp thêm / sửa thông tin tài liệu công ty
// Description: Create or edit a company document's metadata (code, kind, parent,
//              owner department, who can view, retention, expiry). Draft autosave (rule 17).
// ============================================================
import { useEffect, useMemo, useState } from "react";
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
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  DEPARTMENTS,
  DOCUMENT_KINDS,
  departmentLabel,
  findDocumentByCode,
  kindHasExpiry,
  normalizeDocumentCode,
} from "@/lib/documents";
import type { CompanyDocument, DocumentKind, DocumentVisibility } from "@/types";
import { FilePlus2, Save } from "lucide-react";

export type DocumentFormTarget = { kind: "create"; parentId?: string } | { kind: "edit"; document: CompanyDocument };

interface DocumentForm {
  /** Khóa hộp đang mở — lấy lại số gõ dở đúng tài liệu (takeKept). */
  key: string;
  id: string;
  original: CompanyDocument | null;
  code: string;
  title: string;
  kind: DocumentKind;
  parentId: string;
  ownerDepartment: string;
  visibility: DocumentVisibility;
  visibleDepartments: string[];
  retentionYears: number | null;
  expiresOn: string;
  note: string;
}

function formFor(t: DocumentFormTarget, docs: readonly CompanyDocument[]): DocumentForm {
  if (t.kind === "edit") {
    const d = t.document;
    return {
      key: `edit|${d.id}`,
      id: d.id,
      original: d,
      code: d.code,
      title: d.title,
      kind: d.kind,
      parentId: d.parentId,
      ownerDepartment: d.ownerDepartment,
      visibility: d.visibility,
      visibleDepartments: d.visibleDepartments,
      retentionYears: d.retentionYears,
      expiresOn: d.expiresOn,
      note: d.note,
    };
  }
  // Biểu mẫu con: mặc định theo quy trình cha (phòng, phạm vi xem, thời hạn lưu).
  const parent = t.parentId ? docs.find((d) => d.id === t.parentId) : undefined;
  return {
    key: `create|${t.parentId ?? ""}`,
    id: "",
    original: null,
    code: parent ? `${parent.code}-` : "",
    title: "",
    kind: parent ? "form" : "procedure",
    parentId: parent?.id ?? "",
    ownerDepartment: parent?.ownerDepartment ?? "",
    visibility: parent?.visibility ?? "departments",
    visibleDepartments: parent?.visibleDepartments ?? [],
    retentionYears: parent?.retentionYears ?? 2,
    expiresOn: "",
    note: "",
  };
}

const isUnchanged = (f: DocumentForm) => {
  const o = f.original;
  if (!o) return !f.title.trim() && (!f.code.trim() || f.code.trim().endsWith("-"));
  return (
    f.code === o.code &&
    f.title === o.title &&
    f.kind === o.kind &&
    f.parentId === o.parentId &&
    f.ownerDepartment === o.ownerDepartment &&
    f.visibility === o.visibility &&
    f.visibleDepartments.join(",") === o.visibleDepartments.join(",") &&
    f.retentionYears === o.retentionYears &&
    f.expiresOn === o.expiresOn &&
    f.note === o.note
  );
};

const KIND_OPTIONS = DOCUMENT_KINDS.map((k) => ({ value: k.id, label: k.label }));
const DEPARTMENT_OPTIONS: ComboboxOption[] = DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }));
const VISIBILITY_OPTIONS = [
  { value: "departments", label: "Chỉ phòng được chọn" },
  { value: "company", label: "Cả công ty" },
];

export function DocumentFormDialog({
  target,
  documents,
  onClose,
  onSave,
}: {
  target: DocumentFormTarget | null;
  documents: readonly CompanyDocument[];
  onClose: () => void;
  onSave: (doc: CompanyDocument, isNew: boolean) => void;
}) {
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "documents-edit", value: form, setValue: setForm, isEmpty: isUnchanged });

  useEffect(() => {
    if (!target) return;
    const fresh = formFor(target, documents);
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp cho một tài liệu mới
  }, [target]);

  const set = <K extends keyof DocumentForm>(k: K, v: DocumentForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // Tài liệu cha: quy trình / hướng dẫn khác chính nó (không chọn con của chính nó).
  const parentOptions: ComboboxOption[] = useMemo(
    () =>
      documents
        .filter((d) => d.id !== form?.id && d.parentId !== form?.id && (d.kind === "procedure" || d.kind === "instruction"))
        .sort((a, b) => a.code.localeCompare(b.code, "vi"))
        .map((d) => ({ value: d.id, label: `${d.code} · ${d.title}` })),
    [documents, form?.id],
  );

  const toggleDepartment = (id: string) =>
    setForm((f) =>
      f
        ? {
            ...f,
            visibleDepartments: f.visibleDepartments.includes(id) ? f.visibleDepartments.filter((x) => x !== id) : [...f.visibleDepartments, id],
          }
        : f,
    );

  const save = () => {
    if (!form) return;
    const errs: FieldError[] = [];
    const code = normalizeDocumentCode(form.code);
    if (!code || code.endsWith("-")) errs.push({ field: "Mã tài liệu", message: "Chưa ghi mã tài liệu (VD QTI-KH-01)" });
    const dup = code ? findDocumentByCode(documents, code, form.id) : undefined;
    if (dup) errs.push({ field: "Mã tài liệu", message: `Mã ${dup.code} đã có: "${dup.title}" — mở tài liệu đó thay vì tạo trùng` });
    if (!form.title.trim()) errs.push({ field: "Tên tài liệu", message: "Chưa ghi tên tài liệu" });
    if (!form.ownerDepartment) errs.push({ field: "Phòng sở hữu", message: "Chưa chọn phòng sở hữu" });
    if (form.retentionYears != null && form.retentionYears < 0) errs.push({ field: "Thời hạn lưu", message: "Thời hạn lưu không được âm" });
    setErrors(errs);
    if (errs.length) return;
    const o = form.original;
    const doc: CompanyDocument = {
      id: form.id || newId(),
      code,
      title: form.title.trim(),
      kind: form.kind,
      parentId: form.parentId,
      ownerDepartment: form.ownerDepartment,
      visibility: form.visibility,
      // Phòng sở hữu luôn xem được — không lưu trùng trong danh sách thêm.
      visibleDepartments: form.visibility === "company" ? [] : form.visibleDepartments.filter((d) => d !== form.ownerDepartment),
      retentionYears: Math.max(0, Math.trunc(form.retentionYears ?? 0)),
      expiresOn: kindHasExpiry(form.kind) ? form.expiresOn : "",
      isWithdrawn: o?.isWithdrawn ?? false,
      note: form.note.trim(),
      createdAt: o?.createdAt ?? new Date().toISOString(),
    };
    draft.done();
    onSave(doc, !o);
  };

  const close = () => {
    draft.dismiss();
    onClose();
  };

  const isEdit = !!form?.original;
  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => !o && close()}
      title={isEdit ? `Sửa thông tin ${form?.original?.code ?? ""}` : "Thêm tài liệu"}
      description="Thông tin chung của tài liệu. File và người duyệt ghi ở từng lần ban hành."
      icon={FilePlus2}
      size="lg"
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
          <Button variant="save" onClick={save} title="Lưu thông tin tài liệu vào danh mục tài liệu công ty.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu tài liệu
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="space-y-4 py-2">
          <ErrorSummary errors={errors} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <Field label="Mã tài liệu" required hint="Theo mã của công ty, VD QTI-KH-01.">
              <Input value={form.code} onChange={(e) => set("code", e.target.value)} aria-required />
            </Field>
            <Field label="Tên tài liệu" required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} aria-required />
            </Field>
          </div>
          <ChoiceGroup label="Loại" required value={form.kind} onChange={(v) => set("kind", v as DocumentKind)} options={KIND_OPTIONS} columns={3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Combobox
              label="Thuộc tài liệu"
              value={form.parentId}
              onChange={(v) => set("parentId", v)}
              options={parentOptions}
              clearable
              hint="Biểu mẫu thì chọn quy trình chứa nó."
            />
            <Combobox
              label="Phòng sở hữu"
              required
              value={form.ownerDepartment}
              onChange={(v) => set("ownerDepartment", v)}
              options={DEPARTMENT_OPTIONS}
              hint="Phòng soạn và giữ tài liệu — luôn xem được."
            />
          </div>
          <ChoiceGroup
            label="Ai được xem"
            required
            value={form.visibility}
            onChange={(v) => set("visibility", v as DocumentVisibility)}
            options={VISIBILITY_OPTIONS}
            columns={2}
            hint="Ban giám đốc và quản trị viên luôn xem được mọi tài liệu."
          />
          {form.visibility === "departments" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Phòng được xem thêm</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEPARTMENTS.filter((d) => d.id !== "board").map((d) => {
                  const isOwner = d.id === form.ownerDepartment;
                  return (
                    <label key={d.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0"
                        checked={isOwner || form.visibleDepartments.includes(d.id)}
                        disabled={isOwner}
                        onChange={() => toggleDepartment(d.id)}
                      />
                      <span>
                        {d.label}
                        {isOwner && <span className="text-sm text-muted-foreground"> (phòng sở hữu)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Thời hạn lưu bản cũ"
              unit="năm"
              value={form.retentionYears}
              onChange={(v) => set("retentionYears", v)}
              hint="Hết hạn thì app chỉ đánh dấu, không tự xóa. 0 = không đặt."
            />
            {kindHasExpiry(form.kind) && (
              <DateField
                label="Ngày hết hạn"
                value={form.expiresOn}
                onChange={(v) => set("expiresOn", v)}
                hint={`Còn 60 ngày thì nhắc gia hạn ở Việc của tôi (${departmentLabel(form.ownerDepartment)}).`}
              />
            )}
          </div>
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
