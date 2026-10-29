// ============================================================
// Tên file: src/features/admin/RolePermissionsScreen.tsx
// Tên tiếng Việt: Vai trò & quyền (chỉ admin)
// Description: Role permission matrix editor + per-user overrides (spec role-permissions Đợt 2)
// ============================================================
// Hai cách nhìn (spec docs/spec/role-permissions.md §8):
//  • Theo vai trò — ma trận màn × 10 hành động; Lưu ⇒ vai trò thành "đã chỉnh"
//    (bảng app_roles + role_permissions). Khôi phục mặc định ⇒ xóa chỉnh, về ma
//    trận trong code. Thêm / sao chép / xóa vai trò tự tạo.
//  • Theo người dùng — quyền THỰC của một người, mỗi ô ghi nguồn; bấm ô để cho
//    riêng / chặn riêng (bảng user_permissions).
// Admin luôn toàn quyền, không hiện ma trận cho vai trò admin.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Combobox,
  ConfirmAction,
  ErrorSummary,
  Field,
  FormDialog,
  HorizontalScroll,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  Textarea,
  notify,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { useAppRoles, useRolePermissions, useUserPermissions, useUserProfiles } from "@/lib/catalogRepo";
import {
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_RESOURCES,
  RESOURCE_GROUP_LABELS,
  buildRolePermissions,
  buildUserOverrides,
  listRoleOptions,
  permissionKey,
  resolvePermissions,
  roleGrantSet,
  roleNames,
  rolePermissionId,
  userPermissionId,
  visibleNavIds,
  type PermissionAction,
  type PermissionResource,
  type ResourceGroup,
} from "@/lib/permissions";
import { KIT_NAV } from "@/features/shared/AppShell";
import { DEPARTMENTS, departmentLabel, departmentsOfRoles } from "@/lib/documents";
import type { AppRole, Role, RolePermission, UserPermission, UserProfile } from "@/types";
import { Check, Copy, KeyRound, Minus, Plus, RotateCcw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { personLabel, recordName } from "@/lib/personName";

/** Câu giải thích từng hành động — hiện khi rê tiêu đề cột (README §9). */
const ACTION_HINTS: Record<PermissionAction, string> = {
  view: "Thấy màn trong menu, mở được, đọc số.",
  create: "Thêm bản ghi mới (kể cả ghi bù có lý do).",
  update: "Sửa bản ghi chưa chốt.",
  delete: "Xóa / bỏ dòng (vẫn hỏi xác nhận và có Hoàn tác).",
  lock: "Chốt ngày / chốt kỳ.",
  unlock: "Mở lại ngày / kỳ đã chốt để sửa số. Nên để ít người.",
  approve: "Duyệt chuyển trạng thái (VD bán thành phẩm chờ → đã nhập kho).",
  import: "Nạp file Excel đè số vào sổ.",
  export: "In A4, xuất Excel, gửi báo cáo.",
  "view-price": "Thấy cột giá, thành tiền, lãi lỗ.",
};

const GRANTABLE = PERMISSION_RESOURCES.filter((r) => !r.adminOnly);
const GROUPS = (Object.keys(RESOURCE_GROUP_LABELS) as ResourceGroup[])
  .map((g) => ({ group: g, resources: GRANTABLE.filter((r) => r.group === g) }))
  .filter((g) => g.resources.length > 0);
const NAV_LABEL = new Map(KIT_NAV.map((n) => [n.id, n.label]));

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((k) => b.has(k));

const newRoleId = () => `role-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- Ma trận dùng chung cho hai tab ---------- */

type CellMark = "on" | "off" | "allow" | "deny";

function PermissionMatrix({
  cell,
  onToggle,
  onToggleRow,
}: {
  cell: (resource: string, action: PermissionAction) => CellMark;
  onToggle: (resource: PermissionResource, action: PermissionAction) => void;
  onToggleRow?: (resource: PermissionResource) => void;
}) {
  return (
    <HorizontalScroll className="rounded-xl border border-border">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">Màn / chức năng</th>
            {PERMISSION_ACTIONS.map((a) => (
              <th key={a} title={ACTION_HINTS[a]} className="px-1 py-2 text-center font-semibold whitespace-nowrap">
                {PERMISSION_ACTION_LABELS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map(({ group, resources }) => (
            <MatrixGroup key={group} label={RESOURCE_GROUP_LABELS[group]} resources={resources} cell={cell} onToggle={onToggle} onToggleRow={onToggleRow} />
          ))}
        </tbody>
      </table>
    </HorizontalScroll>
  );
}

function MatrixGroup({
  label,
  resources,
  cell,
  onToggle,
  onToggleRow,
}: {
  label: string;
  resources: PermissionResource[];
  cell: (resource: string, action: PermissionAction) => CellMark;
  onToggle: (resource: PermissionResource, action: PermissionAction) => void;
  onToggleRow?: (resource: PermissionResource) => void;
}) {
  return (
    <>
      <tr className="border-t border-border bg-muted/30">
        <td colSpan={PERMISSION_ACTIONS.length + 1} className="sticky left-0 px-3 py-1.5 text-sm font-semibold text-muted-foreground">
          {label}
        </td>
      </tr>
      {resources.map((r) => {
        const all = r.actions.every((a) => cell(r.id, a) !== "off" && cell(r.id, a) !== "deny");
        return (
          <tr key={r.id} className="border-t border-border hover:bg-muted/20">
            <td className="sticky left-0 z-10 bg-card px-3 py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{r.label}</span>
                {onToggleRow && (
                  <button
                    type="button"
                    onClick={() => onToggleRow(r)}
                    title={all ? `Bỏ mọi quyền ở ${r.label}` : `Cấp mọi quyền ở ${r.label}`}
                    className="press-feedback shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-accent"
                  >
                    {all ? "Bỏ hết" : "Tất cả"}
                  </button>
                )}
              </div>
            </td>
            {PERMISSION_ACTIONS.map((a) => (
              <td key={a} className="px-1 py-1 text-center">
                {r.actions.includes(a) ? <MatrixCell mark={cell(r.id, a)} label={`${PERMISSION_ACTION_LABELS[a]} · ${r.label}`} onClick={() => onToggle(r, a)} /> : null}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

const CELL_STYLES: Record<CellMark, string> = {
  on: "border-primary bg-primary text-primary-foreground",
  off: "border-input bg-background text-transparent hover:border-primary",
  allow: "border-success bg-success-surface text-success",
  deny: "border-destructive bg-destructive-surface text-destructive",
};
const CELL_HINTS: Record<CellMark, string> = {
  on: "Có quyền",
  off: "Không có quyền",
  allow: "Cho riêng người này (ngoài vai trò)",
  deny: "Chặn riêng người này",
};

function MatrixCell({ mark, label, onClick }: { mark: CellMark; label: string; onClick: () => void }) {
  const Icon = mark === "deny" ? X : mark === "allow" ? Plus : Check;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mark === "on" || mark === "allow"}
      aria-label={`${label}: ${CELL_HINTS[mark]}`}
      title={`${label} — ${CELL_HINTS[mark]}. Bấm để đổi.`}
      onClick={onClick}
      className={cn(
        "press-feedback inline-flex size-8 items-center justify-center rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        CELL_STYLES[mark]
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

/** Bật/tắt một ô, giữ bất biến: có hành động ⇒ có Xem; bỏ Xem ⇒ bỏ cả hàng. */
function toggleGrant(keys: ReadonlySet<string>, r: PermissionResource, a: PermissionAction): Set<string> {
  const next = new Set(keys);
  const k = permissionKey(r.id, a);
  if (next.has(k)) {
    next.delete(k);
    if (a === "view") for (const x of r.actions) next.delete(permissionKey(r.id, x));
  } else {
    next.add(k);
    next.add(permissionKey(r.id, "view"));
  }
  return next;
}

function toggleRowGrant(keys: ReadonlySet<string>, r: PermissionResource): Set<string> {
  const next = new Set(keys);
  const all = r.actions.every((a) => next.has(permissionKey(r.id, a)));
  for (const a of r.actions) {
    if (all) next.delete(permissionKey(r.id, a));
    else next.add(permissionKey(r.id, a));
  }
  return next;
}

/* ---------- Màn ---------- */

export default function RolePermissionsScreen() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "users" ? "users" : "roles";
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Vai trò &amp; quyền</h1>
        <p className="text-muted-foreground">
          Tick quyền của từng vai trò ở từng màn. Người giữ nhiều vai trò được cộng quyền; chỉnh riêng một người thì chặn thắng cho.
          Quản trị viên luôn toàn quyền.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParam({ tab: v === "users" ? "users" : null })}>
        <TabsList>
          <TabsTrigger value="roles" title="Chỉnh ma trận quyền của từng vai trò.">Theo vai trò</TabsTrigger>
          <TabsTrigger value="users" title="Xem và chỉnh riêng quyền của từng người.">Theo người dùng</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="pt-4">
          <RolesTab selectedId={params.get("role")} onSelect={(id) => setParam({ role: id })} />
        </TabsContent>
        <TabsContent value="users" className="pt-4">
          <UsersTab selectedId={params.get("user")} onSelect={(id) => setParam({ user: id })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Tab: theo vai trò ---------- */

function RolesTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [appRoles, writeAppRoles] = useAppRoles();
  const [rows, writeRows] = useRolePermissions();
  const [users] = useUserProfiles();
  const matrix = useMemo(() => buildRolePermissions(appRoles, rows), [appRoles, rows]);
  const options = listRoleOptions(appRoles);
  const roleId = options.some((o) => o.value === selectedId) ? selectedId! : (options.find((o) => o.value !== "admin")?.value ?? "admin");
  const option = options.find((o) => o.value === roleId)!;
  const appRole = appRoles.find((r) => r.id === roleId);
  const holders = users.filter((u) => u.roles.includes(roleId as Role));

  const base = roleGrantSet(matrix, roleId);
  const [draft, setDraft] = useState<{ roleId: string; keys: Set<string>; name: string; description: string; homeRoute: string; department: string } | null>(null);
  const current =
    draft?.roleId === roleId
      ? draft
      : {
          roleId,
          keys: base,
          name: appRole?.name || option.label,
          description: appRole?.description ?? "",
          homeRoute: appRole?.homeRoute ?? "",
          department: appRole?.department ?? "",
        };
  const isDirty =
    !sameSet(current.keys, base) ||
    current.name !== (appRole?.name || option.label) ||
    current.description !== (appRole?.description ?? "") ||
    current.homeRoute !== (appRole?.homeRoute ?? "") ||
    current.department !== (appRole?.department ?? "");
  // Cột phòng ban (mig 0072) đã có trên máy chủ chưa — chưa có thì ẩn ô, không gửi cột lạ.
  const hasDepartmentColumn = appRoles.some((r) => r.department !== undefined);
  const patch = (p: Partial<typeof current>) => setDraft({ ...current, ...p });

  const [dialog, setDialog] = useState<"create" | "copy" | "reset" | "delete" | null>(null);

  const snapshot = () => ({ prevRoles: appRoles, prevRows: rows });
  const undoTo = ({ prevRoles, prevRows }: ReturnType<typeof snapshot>) => () => {
    writeAppRoles(prevRoles);
    writeRows(prevRows);
  };

  const rowsFor = (id: string, keys: ReadonlySet<string>): RolePermission[] =>
    [...keys].map((k) => {
      const i = k.lastIndexOf(":");
      const resource = k.slice(0, i);
      const action = k.slice(i + 1);
      const old = rows.find((r) => r.roleId === id && r.resource === resource && r.action === action);
      return { id: rolePermissionId(id, resource, action), roleId: id, resource, action, scope: old?.scope ?? "all" };
    });

  const save = () => {
    const name = current.name.trim();
    if (!option.isSystem && !name) {
      notify.error("Vai trò tự tạo phải có tên");
      return;
    }
    const snap = snapshot();
    const role: AppRole = {
      id: roleId,
      name: option.isSystem ? option.label : name,
      description: current.description.trim(),
      homeRoute: current.homeRoute,
      sortOrder: appRole?.sortOrder ?? appRoles.length,
      ...(hasDepartmentColumn ? { department: current.department } : {}),
    };
    writeAppRoles(appRole ? appRoles.map((r) => (r.id === roleId ? role : r)) : [...appRoles, role]);
    writeRows([...rows.filter((r) => r.roleId !== roleId), ...rowsFor(roleId, current.keys)]);
    setDraft(null);
    notify.saved(`Đã lưu quyền của vai trò ${role.name}`, undoTo(snap));
  };

  const resetToDefault = () => {
    const snap = snapshot();
    writeAppRoles(appRoles.filter((r) => r.id !== roleId));
    writeRows(rows.filter((r) => r.roleId !== roleId));
    setDraft(null);
    notify.saved(`Đã khôi phục quyền mặc định cho ${option.label}`, undoTo(snap));
  };

  const removeRole = () => {
    if (holders.length) {
      notify.error(`Còn ${holders.length} người giữ vai trò "${option.label}" — bỏ vai trò khỏi họ ở màn Người dùng trước.`);
      return;
    }
    const snap = snapshot();
    writeAppRoles(appRoles.filter((r) => r.id !== roleId));
    writeRows(rows.filter((r) => r.roleId !== roleId));
    setDraft(null);
    onSelect(options.find((o) => o.value !== roleId && o.value !== "admin")?.value ?? "");
    notify.saved(`Đã xóa vai trò ${option.label}`, undoTo(snap));
  };

  const createRole = (name: string, description: string, keys: ReadonlySet<string>) => {
    const id = newRoleId();
    const snap = snapshot();
    writeAppRoles([
      ...appRoles,
      { id, name, description, homeRoute: "", sortOrder: appRoles.length, ...(hasDepartmentColumn ? { department: "" } : {}) },
    ]);
    writeRows([...rows, ...rowsFor(id, keys)]);
    setDraft(null);
    onSelect(id);
    notify.saved(`Đã tạo vai trò ${name}`, undoTo(snap));
  };

  const defaultDepartments = departmentsOfRoles([roleId]).map(departmentLabel).join(", ");
  const departmentOptions: ComboboxOption[] = [
    { value: "", label: defaultDepartments ? `Theo mặc định (${defaultDepartments})` : "Chưa thuộc phòng nào" },
    ...DEPARTMENTS.map((d) => ({ value: d.id, label: d.label })),
  ];

  const homeOptions: ComboboxOption[] = [
    { value: "", label: "Theo mặc định" },
    // Chỉ những màn vai trò này xem được (đúng bản đang tick, chưa cần Lưu).
    ...[...new Set(GRANTABLE.filter((r) => r.navId && current.keys.has(permissionKey(r.id, "view"))).map((r) => r.navId!))].map(
      (id) => ({ value: id, label: NAV_LABEL.get(id) ?? id })
    ),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Vai trò</h2>
          <Button size="sm" onClick={() => setDialog("create")} title="Tạo vai trò mới (VD một phòng ban) rồi tick quyền cho nó.">
            <Plus />
            Thêm vai trò
          </Button>
        </div>
        <ul className="space-y-1">
          {options.map((o) => {
            const isCustomized = appRoles.some((r) => r.id === o.value);
            const count = users.filter((u) => u.roles.includes(o.value as Role)).length;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    onSelect(o.value);
                  }}
                  title={`Xem và chỉnh quyền của vai trò ${o.label}`}
                  className={cn(
                    "press-feedback flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted",
                    o.value === roleId && "bg-accent text-accent-foreground hover:bg-accent"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.label}</span>
                    <span className="block text-sm text-muted-foreground">{count} người</span>
                  </span>
                  {o.value === "admin" ? (
                    <Tag variant="source">Toàn quyền</Tag>
                  ) : isCustomized ? (
                    <Tag variant="warning">{o.isSystem ? "Đã chỉnh" : "Tự tạo"}</Tag>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-foreground">{option.isSystem ? option.label : current.name || "(chưa đặt tên)"}</h2>
            <p className="text-sm text-muted-foreground">
              {holders.length ? `Người giữ: ${holders.map((u) => personLabel(u)).join(", ")}` : "Chưa ai giữ vai trò này."}
            </p>
          </div>
          {roleId !== "admin" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setDialog("copy")} title="Tạo vai trò mới có đúng các quyền đang tick ở đây.">
                <Copy />
                Sao chép
              </Button>
              {option.isSystem && appRole && (
                <Button variant="outline" onClick={() => setDialog("reset")} title="Bỏ mọi chỉnh sửa, dùng lại quyền mặc định của vai trò hệ thống này.">
                  <RotateCcw />
                  Khôi phục mặc định
                </Button>
              )}
              {!option.isSystem && (
                <Button variant="danger" onClick={() => setDialog("delete")} title="Xóa vai trò tự tạo này (chỉ khi không còn ai giữ).">
                  <Trash2 />
                  Xóa vai trò
                </Button>
              )}
              <Button variant="save" onClick={save} title="Ghi ma trận quyền này. Người giữ vai trò thấy thay đổi khi mở lại app hoặc quay lại tab.">
                <Save />
                Lưu quyền
              </Button>
            </div>
          )}
        </div>

        {roleId === "admin" ? (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-foreground">
            <ShieldCheck className="size-icon text-muted-foreground" aria-hidden />
            Quản trị viên luôn toàn quyền ở mọi màn, kể cả khu quản trị — không chỉnh được để không ai tự khóa mình.
          </p>
        ) : (
          <>
            {isDirty && <Tag variant="pending">Có thay đổi chưa lưu</Tag>}
            <div className="grid gap-4 md:grid-cols-2">
              {!option.isSystem && (
                <Field label="Tên vai trò" required>
                  <Input value={current.name} onChange={(e) => patch({ name: e.target.value })} />
                </Field>
              )}
              <Combobox
                label="Trang mở đầu"
                hideRequiredMark
                value={current.homeRoute}
                onChange={(v) => patch({ homeRoute: v })}
                options={homeOptions}
                clearable={false}
              />
              {hasDepartmentColumn && (
                <Combobox
                  label="Thuộc phòng ban"
                  hideRequiredMark
                  value={current.department}
                  onChange={(v) => patch({ department: v })}
                  options={departmentOptions}
                  clearable={false}
                  hint="Quyết người giữ vai trò này xem được tài liệu công ty của phòng nào."
                />
              )}
              <Field label="Mô tả" className="md:col-span-2" hint="Vai trò này dành cho ai, làm việc gì.">
                <Textarea rows={2} value={current.description} onChange={(e) => patch({ description: e.target.value })} />
              </Field>
            </div>
            <PermissionMatrix
              cell={(resource, action) => (current.keys.has(permissionKey(resource, action)) ? "on" : "off")}
              onToggle={(r, a) => patch({ keys: toggleGrant(current.keys, r, a) })}
              onToggleRow={(r) => patch({ keys: toggleRowGrant(current.keys, r) })}
            />
            {!appRole && option.isSystem && (
              <p className="text-sm text-muted-foreground">Đang dùng quyền mặc định. Bấm Lưu quyền để giữ bản đã chỉnh cho vai trò này.</p>
            )}
          </>
        )}
      </section>

      <RoleNameDialog
        open={dialog === "create" || dialog === "copy"}
        mode={dialog === "copy" ? "copy" : "create"}
        sourceLabel={option.label}
        existingNames={options.map((o) => o.label)}
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={(name, description) => {
          createRole(name, description, dialog === "copy" ? current.keys : new Set());
          setDialog(null);
        }}
      />
      <ConfirmAction
        open={dialog === "reset"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Khôi phục quyền mặc định cho ${option.label}?`}
        description="Mọi ô đã chỉnh của vai trò này bị bỏ, dùng lại ma trận mặc định. Có Hoàn tác ngay sau đó."
        detail={holders.length ? `${holders.length} người bị ảnh hưởng` : undefined}
        confirmLabel="Khôi phục"
        icon={RotateCcw}
        onConfirm={resetToDefault}
      />
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Xóa vai trò ${option.label}?`}
        description="Vai trò và mọi ô quyền của nó bị xóa. Có Hoàn tác ngay sau đó."
        confirmLabel="Xóa vai trò"
        destructive
        icon={Trash2}
        onConfirm={removeRole}
      />
    </div>
  );
}

function RoleNameDialog({
  open,
  mode,
  sourceLabel,
  existingNames,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "copy";
  sourceLabel: string;
  existingNames: string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const close = (o: boolean) => {
    if (!o) {
      setName("");
      setDescription("");
      setErrors([]);
    }
    onOpenChange(o);
  };
  const submit = () => {
    const n = name.trim();
    const ls: FieldError[] = [];
    if (!n) ls.push({ field: "Tên vai trò", message: "Chưa nhập tên" });
    else if (existingNames.some((x) => x.toLowerCase() === n.toLowerCase()))
      ls.push({ field: "Tên vai trò", message: "Trùng tên vai trò đã có" });
    setErrors(ls);
    if (ls.length) return;
    onSubmit(n, description.trim() || (mode === "copy" ? `Sao chép từ ${sourceLabel}` : ""));
    close(false);
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={mode === "copy" ? `Sao chép vai trò ${sourceLabel}` : "Thêm vai trò"}
      description={
        mode === "copy"
          ? "Vai trò mới có đúng các quyền đang tick. Chỉnh tiếp sau khi tạo."
          : "Vai trò mới bắt đầu không có quyền nào — tick quyền sau khi tạo."
      }
      icon={KeyRound}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            Hủy
          </Button>
          <Button variant="save" onClick={submit} title="Tạo vai trò mới với tên này.">
            Tạo vai trò
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorSummary errors={errors} />
        <Field label="Tên vai trò" required hint="VD: Phòng kế hoạch, Thủ kho lạnh.">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

/* ---------- Tab: theo người dùng ---------- */

function UsersTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const navigate = useNavigate();
  const [users] = useUserProfiles();
  const [appRoles] = useAppRoles();
  const [roleRows] = useRolePermissions();
  const [rows, writeRows] = useUserPermissions();
  const matrix = useMemo(() => buildRolePermissions(appRoles, roleRows), [appRoles, roleRows]);
  const user: UserProfile | undefined = users.find((u) => u.id === selectedId);

  const userOptions: ComboboxOption[] = [...users]
    .sort((a, b) => recordName(a).localeCompare(recordName(b), "vi"))
    .map((u) => ({ value: u.id, label: personLabel(u), subLabel: `@${u.username} · ${roleNames(u.roles, appRoles)}` }));

  const saved = useMemo(() => (user ? buildUserOverrides(user.id, rows) : []), [user, rows]);
  const savedMap = useMemo(() => new Map(saved.map((o) => [permissionKey(o.resource, o.action), o.effect])), [saved]);
  const [draft, setDraft] = useState<{ userId: string; map: Map<string, "allow" | "deny"> } | null>(null);
  const current = user && draft?.userId === user.id ? draft.map : savedMap;
  const isDirty = current.size !== savedMap.size || [...current].some(([k, v]) => savedMap.get(k) !== v);

  if (!user) {
    return (
      <div className="max-w-xl">
        <Combobox label="Người dùng" hideRequiredMark value="" onChange={(v) => v && onSelect(v)} options={userOptions} placeholder="Gõ tên để chọn người…" />
      </div>
    );
  }

  const isAdmin = user.roles.includes("admin" as Role);
  const fromRoles = resolvePermissions({ roles: user.roles, isAdmin: false, rolePermissions: matrix });
  const overrides = [...current].map(([k, effect]) => {
    const i = k.lastIndexOf(":");
    return { resource: k.slice(0, i), action: k.slice(i + 1) as PermissionAction, effect };
  });
  const effective = resolvePermissions({ roles: user.roles, isAdmin, rolePermissions: matrix, overrides });
  const screens = [...visibleNavIds(effective)].map((id) => NAV_LABEL.get(id) ?? id);

  const toggle = (r: PermissionResource, a: PermissionAction) => {
    const k = permissionKey(r.id, a);
    const next = new Map(current);
    if (next.has(k)) next.delete(k);
    else next.set(k, fromRoles.grants.has(k) ? "deny" : "allow");
    setDraft({ userId: user.id, map: next });
  };

  const save = () => {
    const prev = rows;
    const mine: UserPermission[] = overrides.map((o) => ({
      id: userPermissionId(user.id, o.resource, o.action),
      userId: user.id,
      resource: o.resource,
      action: o.action,
      effect: o.effect,
      scope: "all",
    }));
    writeRows([...rows.filter((r) => r.userId !== user.id), ...mine]);
    setDraft(null);
    notify.saved(`Đã lưu quyền riêng của ${personLabel(user)}`, () => writeRows(prev));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xl">
          <Combobox label="Người dùng" hideRequiredMark value={user.id} onChange={(v) => { setDraft(null); onSelect(v); }} options={userOptions} clearable={false} />
        </div>
        {!isAdmin && (
          <div className="flex flex-wrap gap-2">
            {current.size > 0 && (
              <Button variant="outline" onClick={() => setDraft({ userId: user.id, map: new Map() })} title="Bỏ mọi quyền cho riêng / chặn riêng của người này, chỉ còn quyền theo vai trò.">
                <Minus />
                Bỏ chỉnh riêng
              </Button>
            )}
            <Button variant="save" onClick={save} title="Ghi các ô cho riêng / chặn riêng của người này.">
              <Save />
              Lưu quyền riêng
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Vai trò:</span>
        {user.roles.length ? (
          user.roles.map((r) => (
            <Tag key={r} variant="category">
              {roleNames([r], appRoles)}
            </Tag>
          ))
        ) : (
          <Tag variant="error">Chưa gán</Tag>
        )}
        <Button variant="edit" size="sm" onClick={() => navigate("/users")} title="Mở màn Người dùng để thêm / bỏ vai trò của người này.">
          Sửa vai trò
        </Button>
      </div>

      {isAdmin ? (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-foreground">
          <ShieldCheck className="size-icon text-muted-foreground" aria-hidden />
          Người này là quản trị viên — luôn toàn quyền, không chỉnh riêng được.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {isDirty && <Tag variant="pending">Có thay đổi chưa lưu</Tag>}
            <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-primary" /> theo vai trò</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-success" /> cho riêng</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-destructive" /> chặn riêng</span>
            <span>Bấm ô để cho / chặn riêng; bấm lại để trả về theo vai trò.</span>
          </div>
          <PermissionMatrix
            cell={(resource, action) => {
              const own = current.get(permissionKey(resource, action));
              if (own) return own;
              const v = effective.grants.has(permissionKey(resource, action));
              return v ? "on" : "off";
            }}
            onToggle={toggle}
          />
          <div className="rounded-xl border border-border p-4">
            <p className="font-semibold text-foreground">Người này thấy {screens.length} màn</p>
            <p className="text-sm text-muted-foreground">{screens.length ? screens.join(" · ") : "Không màn nào — sẽ thấy “Chưa được cấp quyền”."}</p>
          </div>
        </>
      )}
    </div>
  );
}
