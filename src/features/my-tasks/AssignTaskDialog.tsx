// ============================================================
// Tên file: src/features/my-tasks/AssignTaskDialog.tsx
// Tên tiếng Việt: Hộp giao việc — giao việc máy phát hiện / việc tay / sửa việc đã giao
// Description: One dialog for assigning a detected task, creating a manual task, or
//              editing an assignment. Auto-saves a draft (rule 17).
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
  Textarea,
  todayIso,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { KIT_NAV } from "@/features/shared/AppShell";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { dayPath, type FlowWarning } from "@/lib/dataFlow";
import { canDoTask, defaultDueDate, type MyTaskItem } from "@/lib/myTasks";
import { resolvePermissions, roleNames, scopeContextFor } from "@/lib/permissions";
import type { TaskAssignment, UserProfile, Workshop } from "@/types";
import { Save, Send } from "lucide-react";

export type AssignTarget =
  | { kind: "system"; task: MyTaskItem }
  | { kind: "manual" }
  | { kind: "edit"; assignment: TaskAssignment };

interface AssignForm {
  /** Khóa nhận diện hộp đang mở — để lấy lại số gõ dở đúng việc (takeKept). */
  key: string;
  mode: AssignTarget["kind"];
  /** Bản đang sửa (mode "edit") hoặc việc máy gốc. */
  assignmentId: string;
  source: TaskAssignment["source"];
  taskKey: string;
  /** Loại cảnh báo của việc máy phát hiện ("" = việc tay / không rõ) — để báo người nhận thiếu quyền. */
  taskKind: FlowWarning["kind"] | "";
  /** Bản gốc khi sửa — nằm trong form để hộp mở lại từ nháp (sau tải lại trang) vẫn đủ. */
  original: TaskAssignment | null;
  title: string;
  detail: string;
  /** Màn cần mở (việc tay) — id nav. */
  screen: string;
  path: string;
  workshop: Workshop | "";
  taskDate: string;
  dueDate: string;
  assigneeId: string;
  note: string;
  /** Giá trị lúc mở hộp — so để biết người dùng đã gõ gì chưa (nháp rỗng thì không lưu). */
  initial: { assigneeId: string; dueDate: string; note: string; title: string };
}

/** Màn có ô ngày + xưởng đọc từ link (`?date=&workshop=`). */
const DAY_SCREENS = new Set(["imports", "wip", "packaging"]);
const HIDDEN_SCREENS = new Set(["my-tasks", "admin", "users", "roles", "audit"]);
const SCREEN_OPTIONS: ComboboxOption[] = KIT_NAV.filter((n) => !HIDDEN_SCREENS.has(n.id)).map((n) => ({ value: n.id, label: n.label }));
const WORKSHOP_OPTIONS = [
  { value: "", label: "Không theo xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

function formFor(t: AssignTarget, today: string): AssignForm {
  if (t.kind === "edit") {
    const a = t.assignment;
    return {
      key: `edit|${a.id}`,
      mode: "edit",
      assignmentId: a.id,
      source: a.source,
      taskKey: a.taskKey,
      taskKind: "",
      original: a,
      title: a.title,
      detail: a.detail,
      screen: a.path.replace(/^\//, "").split(/[?/]/)[0] ?? "",
      path: a.path,
      workshop: a.workshop,
      taskDate: a.taskDate,
      dueDate: a.dueDate,
      assigneeId: a.assigneeId,
      note: a.note,
      initial: { assigneeId: a.assigneeId, dueDate: a.dueDate, note: a.note, title: a.title },
    };
  }
  if (t.kind === "system") {
    const w = t.task;
    const due = w.dueDate || (w.kind === "manual" || w.kind === "system" ? "" : defaultDueDate({ kind: w.kind, date: w.date })) || today;
    return {
      key: `system|${w.id}`,
      mode: "system",
      assignmentId: "",
      source: "system",
      taskKey: w.id,
      taskKind: w.kind === "manual" || w.kind === "system" ? "" : w.kind,
      original: null,
      title: w.title,
      detail: w.detail,
      screen: "",
      path: w.path,
      workshop: w.workshop,
      taskDate: w.date,
      dueDate: due < today ? today : due,
      assigneeId: "",
      note: "",
      initial: { assigneeId: "", dueDate: due < today ? today : due, note: "", title: w.title },
    };
  }
  return {
    key: "manual",
    mode: "manual",
    assignmentId: "",
    source: "manual",
    taskKey: "",
    taskKind: "",
    original: null,
    title: "",
    detail: "",
    screen: "",
    path: "",
    workshop: "",
    taskDate: today,
    dueDate: today,
    assigneeId: "",
    note: "",
    initial: { assigneeId: "", dueDate: today, note: "", title: "" },
  };
}

const isUnchanged = (f: AssignForm) =>
  f.assigneeId === f.initial.assigneeId && f.dueDate === f.initial.dueDate && f.note.trim() === f.initial.note.trim() && f.title.trim() === f.initial.title.trim();

export function AssignTaskDialog({
  target,
  onClose,
  profiles,
  currentUser,
  onSave,
}: {
  target: AssignTarget | null;
  onClose: () => void;
  profiles: readonly UserProfile[];
  currentUser: { id: string; name: string };
  onSave: (row: TaskAssignment, message: string) => void;
}) {
  const today = todayIso();
  const [form, setForm] = useState<AssignForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "my-tasks-assign", value: form, setValue: setForm, isEmpty: isUnchanged });

  // Mở hộp: lấy lại số gõ dở của ĐÚNG việc này nếu vừa đóng ngang, không thì phiếu mới.
  useEffect(() => {
    if (!target) return;
    const fresh = formFor(target, today);
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp cho một việc mới
  }, [target]);

  // Người có vai trò; chế độ demo / chạy chỉ máy này không có danh sách ⇒ giao cho chính mình.
  const people = useMemo(() => {
    const xs = profiles.filter((p) => p.roles.length > 0);
    return xs.length ? xs : [{ id: currentUser.id, fullName: currentUser.name, username: "", roles: [] } as UserProfile];
  }, [profiles, currentUser]);
  const options: ComboboxOption[] = people.map((p) => ({
    value: p.id,
    label: `${p.fullName || p.username}${p.id === currentUser.id ? " (tôi)" : ""}`,
    subLabel: [p.username && `@${p.username}`, p.roles.length ? roleNames(p.roles, []) : ""].filter(Boolean).join(" · "),
  }));

  // Việc máy phát hiện: báo trước nếu người được chọn có vẻ không làm được (ma trận mặc định).
  const assignee = people.find((p) => p.id === form?.assigneeId);
  const lacksPermission =
    !!form?.taskKind &&
    !!assignee &&
    assignee.roles.length > 0 &&
    !canDoTask(
      { id: form.taskKey, kind: form.taskKind, level: "reminder", title: form.title, detail: "", date: form.taskDate, workshop: form.workshop, path: form.path },
      resolvePermissions({ roles: assignee.roles, isAdmin: assignee.roles.includes("admin") }),
      scopeContextFor(assignee.roles, assignee.fullName, assignee.username),
    );

  const set = <K extends keyof AssignForm>(k: K, v: AssignForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = () => {
    if (!form) return;
    const errs: FieldError[] = [];
    if (form.mode === "manual" && !form.title.trim()) errs.push({ field: "Việc cần làm", message: "Chưa ghi việc cần làm" });
    if (!form.assigneeId) errs.push({ field: "Người nhận", message: "Chưa chọn người nhận việc" });
    if (!form.dueDate) errs.push({ field: "Hạn", message: "Chưa chọn hạn" });
    setErrors(errs);
    if (errs.length) return;
    const person = people.find((p) => p.id === form.assigneeId);
    const path =
      form.mode === "manual"
        ? form.screen
          ? DAY_SCREENS.has(form.screen)
            ? dayPath(`/${form.screen}`, form.taskDate, form.workshop)
            : `/${form.screen}`
          : ""
        : form.path;
    const now = new Date().toISOString();
    const base: TaskAssignment = {
      id: form.assignmentId || newId(),
      source: form.source,
      taskKey: form.taskKey,
      title: form.title.trim(),
      detail: form.detail,
      path,
      workshop: form.workshop,
      taskDate: form.taskDate,
      dueDate: form.dueDate,
      assigneeId: form.assigneeId,
      assigneeName: person?.fullName || person?.username || "",
      assignedById: currentUser.id,
      assignedByName: currentUser.name,
      status: "open",
      note: form.note.trim(),
      doneAt: "",
      createdAt: now,
    };
    const o = form.original;
    const row: TaskAssignment = o ? { ...o, ...base, assignedById: o.assignedById, assignedByName: o.assignedByName, createdAt: o.createdAt } : base;
    draft.done();
    onSave(row, form.mode === "edit" ? `Đã sửa việc giao cho ${row.assigneeName}` : `Đã giao việc cho ${row.assigneeName}`);
  };

  const close = () => {
    draft.dismiss();
    onClose();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => !o && close()}
      title={form?.mode === "edit" ? "Sửa việc đã giao" : form?.mode === "manual" ? "Giao việc mới" : "Giao việc cho một người"}
      description={
        form?.mode === "system"
          ? "Người nhận thấy việc này ở mục \"Được giao cho tôi\". Sổ sửa xong thì việc tự hết."
          : "Người nhận thấy việc ở mục \"Được giao cho tôi\" và bấm Xong khi làm xong."
      }
      icon={Send}
      size="md"
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
          <Button title="Lưu việc giao — người nhận thấy ngay ở màn Việc của tôi." variant="save" onClick={save}>
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu việc giao
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="space-y-4 py-2">
          <ErrorSummary errors={errors} />
          {form.mode === "manual" ? (
            <Field label="Việc cần làm" required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} aria-required />
            </Field>
          ) : (
            <div className="rounded-lg border-2 border-border bg-muted/30 px-4 py-3">
              <div className="font-semibold text-foreground">{form.title}</div>
              {form.detail && <div className="text-sm text-muted-foreground">{form.detail}</div>}
            </div>
          )}
          <Combobox
            label="Người nhận"
            required
            value={form.assigneeId}
            onChange={(v) => set("assigneeId", v)}
            options={options}
            hint={lacksPermission ? "Người này có thể chưa có quyền làm việc này — kiểm lại vai trò ở Vai trò & quyền." : undefined}
          />
          <DateField label="Hạn" required value={form.dueDate} onChange={(v) => set("dueDate", v)} />
          {form.mode === "manual" && (
            <>
              <Combobox
                label="Màn cần mở"
                value={form.screen}
                onChange={(v) => set("screen", v)}
                options={SCREEN_OPTIONS}
                clearable
                hint="Người nhận bấm Mở việc là tới thẳng màn này."
              />
              {DAY_SCREENS.has(form.screen) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField label="Ngày cần xem" value={form.taskDate} onChange={(v) => set("taskDate", v)} hint="Mở màn đúng ngày này." />
                  <ChoiceGroup label="Xưởng" value={form.workshop} onChange={(v) => set("workshop", v as Workshop | "")} options={WORKSHOP_OPTIONS} columns={2} />
                </div>
              )}
            </>
          )}
          <Field label="Ghi chú cho người nhận">
            <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
