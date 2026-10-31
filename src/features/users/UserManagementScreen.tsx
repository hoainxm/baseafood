// ============================================================
// Tên file cũ: src/features/users/QuanLyNguoiDung.tsx
// Tên tiếng Việt: Màn hình Quản lý Người dùng & Phân quyền Admin
// Description: User Accounts & Access Control Management Screen
// ============================================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppRole, UserProfile, Role } from "@/types";
import { rolesList } from "@/types";
import { isServerConnected, useAppRoles, useUserProfiles } from "@/lib/catalogRepo";
import { DISPLAY_NAME_MAX, checkDisplayName, isDisplayNameAvailable, personSearchText } from "@/lib/personName";
import { listRoleOptions, roleNames } from "@/lib/permissions";
import { fullNameToUsername, normalizeUsername } from "@/lib/username";
import { ALL, activeFilterCount, countedLabel, filterRows, matchesSearch, matchesValue, statusOptions } from "@/lib/recordFilters";
import {
  generateTemporaryPassword,
  useAccountAdmin,
  useOrphanAccounts,
  type AccountStatus,
  type AccountUsage,
  type AuthResult,
  type OrphanAccount,
} from "@/lib/auth";
import {
  groupNameOfRole,
  groupUsersByDepartment,
  NO_DEPARTMENT_GROUP,
  sortRolesByRank,
  SYSTEM_ADMIN_GROUP,
  UNASSIGNED_GROUP,
} from "@/lib/userDirectory";
import {
  Tag,
  toneByName,
  RequiredLegend,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmAction,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  FilterBar,
  FormDialog,
  NoMatchState,
  SearchField,
  ProcessingState,
  Input,
  RecordTable,
  TableSkeleton,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import {
  KeyRound,
  Link2,
  Pencil,
  Trash2,
  UserPlus,
  UserX,
  Plus,
  Users,
  X,
  Briefcase,
  Building2,
  Copy,
  Dices,
  Calculator,
  ClipboardList,
  FlaskConical,
  LockKeyhole,
  UserCheck,
  Factory,
  Warehouse,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** Biểu tượng từng nhóm — nhóm lấy từ `lib/userDirectory.ts` (một nguồn phòng ban, quy tắc ở đó). */
const GROUP_ICONS: Record<string, LucideIcon> = {
  board: Briefcase,
  planning: ClipboardList,
  accounting: Calculator,
  production: Factory,
  warehouse: Warehouse,
  quality: FlaskConical,
  "admin-hr": Building2,
  [SYSTEM_ADMIN_GROUP.id]: ShieldCheck,
  [NO_DEPARTMENT_GROUP.id]: KeyRound,
  [UNASSIGNED_GROUP.id]: UserRound,
};

/**
 * Chọn NHIỀU vai trò: vai trò đã chọn hiện thành CHIP có nút ✕ để bỏ; thêm mới
 * qua DROPDOWN tìm-kiếm (gom theo phòng ban) — hợp khi danh sách vai trò dài dần.
 */
function RolePicker({
  selected: selectedRoles,
  onChange,
  appRoles,
}: {
  selected: Role[];
  onChange: (v: Role[]) => void;
  appRoles: AppRole[];
}) {
  const roleLabel = (v: Role[]) => roleNames(v, appRoles);
  const remaining = listRoleOptions(appRoles).filter((r) => !selectedRoles.includes(r.value as Role));
  const options: ComboboxOption[] = remaining.map((r) => ({
    value: r.value,
    label: r.label,
    subLabel: groupNameOfRole(r.value, appRoles),
  }));
  return (
    <div className="space-y-3">
      {selectedRoles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedRoles.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted py-1 pl-3 pr-1 font-medium"
            >
              {roleLabel([v])}
              <button
                type="button"
                onClick={() => onChange(selectedRoles.filter((x) => x !== v))}
                aria-label={`Bỏ vai trò ${roleLabel([v])}`}
                title={`Bỏ vai trò ${roleLabel([v])}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Chưa gán vai trò nào.</p>
      )}
      {remaining.length > 0 && (
        <Combobox
          label="Thêm vai trò"
          hideRequiredMark
          value=""
          onChange={(v) => v && onChange([...selectedRoles, v as Role])}
          options={options}
          placeholder="Gõ hoặc chọn vai trò để thêm…"
          emptyText="Đã thêm hết vai trò."
          clearable={false}
        />
      )}
    </div>
  );
}

/** "15/10/2026 09:45" theo giờ máy; rỗng ⇒ "chưa đăng nhập". */
function formatSignIn(iso: string): string {
  if (!iso) return "chưa đăng nhập";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Tài khoản đăng nhập CHƯA có hồ sơ (mig 0063, sự cố 2026-10-15): đăng nhập được mà
 * không mở được màn nào. Thường do một người có 2 tài khoản — hồ sơ gắn tài khoản kia.
 * Admin chọn: gắn hồ sơ có sẵn sang tài khoản này, hoặc tạo hồ sơ mới.
 */
/** Tài khoản đang giữ hồ sơ được dùng GẦN ĐÂY hơn tài khoản mồ côi ⇒ nhiều khả năng mồ
 *  côi là tài khoản bỏ đi; gắn hồ sơ sang đây sẽ khóa người đang dùng thật. */
const isHolderMoreRecent = (a: OrphanAccount) =>
  !!a.suggestedProfile?.accountLastSignInAt &&
  (!a.lastSignInAt || a.suggestedProfile.accountLastSignInAt > a.lastSignInAt);

function OrphanAccountsSection({
  accounts,
  appRoles,
  onRelink,
  onCreate,
  onDelete,
}: {
  accounts: OrphanAccount[];
  appRoles: AppRole[];
  onRelink: (a: OrphanAccount) => void;
  onCreate: (a: OrphanAccount) => void;
  /** Mở hộp xóa (kiểm dữ liệu trước) cho một hoặc nhiều tài khoản. */
  onDelete: (targets: OrphanAccount[]) => void;
}) {
  const [confirming, setConfirming] = useState<OrphanAccount | null>(null);
  if (!accounts.length) return null;
  const cols: RecordTableColumn<OrphanAccount>[] = [
    { key: "email", header: "Tài khoản đăng nhập", primary: true, render: (a) => a.email, getSortValue: (a) => a.email },
    { key: "name", header: "Họ tên lúc tạo", render: (a) => a.fullName || <span className="text-muted-foreground">—</span> },
    { key: "signIn", header: "Đăng nhập gần nhất", render: (a) => formatSignIn(a.lastSignInAt), getSortValue: (a) => a.lastSignInAt },
    {
      key: "suggested",
      header: "Hồ sơ có sẵn (gợi ý)",
      render: (a) =>
        a.suggestedProfile ? (
          <span>
            <span className="font-medium">@{a.suggestedProfile.username}</span> · {roleNames(a.suggestedProfile.roles, appRoles)}
            <span className="block text-sm text-muted-foreground">
              đang gắn tài khoản khác — đăng nhập gần nhất {formatSignIn(a.suggestedProfile.accountLastSignInAt)}
            </span>
            {isHolderMoreRecent(a) && (
              <Tag variant="warning">Tài khoản kia đang được dùng — thường KHÔNG cần gắn</Tag>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Không có</span>
        ),
    },
  ];
  return (
    <section className="space-y-3 rounded-xl border border-warning-line bg-warning-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <UserX className="size-5 text-warning" aria-hidden />
          Tài khoản đăng nhập chưa có hồ sơ
          <Tag variant="warning">{accounts.length}</Tag>
        </h2>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(accounts)}
          title="Kiểm dữ liệu liên quan của từng tài khoản trong danh sách, rồi xóa vĩnh viễn những tài khoản không còn dữ liệu gắn cứng."
        >
          <Trash2 />
          Dọn tất cả
        </Button>
      </div>
      <p className="text-sm text-foreground">
        Các tài khoản này đăng nhập được nhưng không có hồ sơ nên không mở được màn nào (máy chủ chặn mọi sổ). Thường do một người
        có hai tài khoản: hồ sơ và vai trò gắn tài khoản kia. Chọn <b>Gắn hồ sơ</b> nếu người đó đang dùng tài khoản này, hoặc{" "}
        <b>Tạo hồ sơ</b> cho người mới.
      </p>
      <RecordTable
        columns={cols}
        rows={accounts}
        getKey={(a) => a.id}
        actions={(a) => (
          <span className="flex flex-wrap gap-2">
            {a.suggestedProfile && (
              <Button
                size="sm"
                onClick={() => setConfirming(a)}
                title={`Chuyển hồ sơ @${a.suggestedProfile.username} (giữ vai trò) sang tài khoản ${a.email}.`}
              >
                <Link2 />
                Gắn hồ sơ
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreate(a)}
              title={`Tạo hồ sơ mới (họ tên, tên đăng nhập, vai trò) cho tài khoản ${a.email}.`}
            >
              <UserPlus />
              Tạo hồ sơ
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete([a])}
              title={`Kiểm dữ liệu liên quan rồi xóa vĩnh viễn tài khoản đăng nhập ${a.email}.`}
            >
              <Trash2 />
              Xóa
            </Button>
          </span>
        )}
      />
      <ConfirmAction
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Gắn hồ sơ @${confirming?.suggestedProfile?.username ?? ""} sang ${confirming?.email ?? ""}?`}
        description={
          confirming && isHolderMoreRecent(confirming)
            ? "⚠ Tài khoản đang giữ hồ sơ mới đăng nhập GẦN ĐÂY hơn tài khoản này — gắn sang đây thì người đang dùng tài khoản kia bị khóa ngay. Chỉ gắn khi chắc người đó chuyển sang dùng tài khoản này. Có Hoàn tác ngay sau đó."
            : "Hồ sơ (họ tên, vai trò, quyền riêng) chuyển sang tài khoản này. Tài khoản đang giữ hồ sơ sẽ không còn hồ sơ nên không vào được nữa. Có Hoàn tác ngay sau đó."
        }
        detail={
          confirming?.suggestedProfile
            ? `${confirming.suggestedProfile.fullName || confirming.suggestedProfile.username} · ${roleNames(confirming.suggestedProfile.roles, appRoles)}`
            : undefined
        }
        confirmLabel="Gắn hồ sơ"
        icon={Link2}
        onConfirm={() => {
          if (confirming) onRelink(confirming);
          setConfirming(null);
        }}
      />
    </section>
  );
}

/** Từ xác nhận phải gõ — xóa tài khoản KHÔNG hoàn tác được nên không dùng toast Hoàn tác. */
const DELETE_WORD = "xóa";
const isDeleteWord = (v: string) => ["xóa", "xoá", "xoa"].includes(v.trim().toLowerCase());
/** Dấu hiệu tài khoản CÓ THỂ còn được dùng — không chặn, nhưng tô vàng để admin cân nhắc. */
const CAUTION_USAGE = new Set(["recent_sign_in", "active_session", "recent_activity"]);

interface UsageResult {
  account: OrphanAccount;
  ok: boolean;
  rows: AccountUsage[];
  error?: string;
}

/**
 * Xóa tài khoản đăng nhập chưa có hồ sơ (mig 0064). Bước 1: nạp báo cáo dữ liệu liên
 * quan của TỪNG tài khoản (máy chủ). Tài khoản còn dữ liệu gắn cứng (hồ sơ, quyền riêng,
 * bản đối soát, file Storage, chính mình) bị loại kèm lý do. Bước 2: gõ "xóa" ⇒ xóa
 * lần lượt; máy chủ kiểm lại lần nữa lúc xóa. Lịch sử ghi bằng chữ giữ nguyên.
 */
function DeleteOrphansDialog({
  targets,
  onOpenChange,
  loadUsage,
  remove,
  onDone,
}: {
  targets: OrphanAccount[] | null;
  onOpenChange: (open: boolean) => void;
  loadUsage: (id: string) => Promise<{ ok: boolean; rows: AccountUsage[]; error?: string }>;
  remove: (a: OrphanAccount, seen: AccountUsage[]) => Promise<AuthResult>;
  onDone: () => void;
}) {
  const [results, setResults] = useState<UsageResult[] | null>(null);
  const [word, setWord] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isDeleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!targets) return;
    // Mỗi lần mở là một bản mới (key ở chỗ gọi) ⇒ không cần dọn state cũ ở đây.
    let isCancelled = false;
    Promise.all(targets.map(async (account) => ({ account, ...(await loadUsage(account.id)) }))).then((rs) => {
      if (!isCancelled) setResults(rs);
    });
    return () => {
      isCancelled = true;
    };
  }, [targets, loadUsage]);

  const deletable = (results ?? []).filter((r) => r.ok && !r.rows.some((u) => u.blocking));
  const blocked = (results ?? []).filter((r) => !r.ok || r.rows.some((u) => u.blocking));

  const submit = async () => {
    if (!results || isDeleting) return;
    const ls: FieldError[] = [];
    if (!deletable.length) ls.push({ field: "Xóa", message: "Không có tài khoản nào xóa được" });
    else if (!isDeleteWord(word)) ls.push({ field: "Xác nhận", message: `Gõ chữ “${DELETE_WORD}” để xác nhận xóa vĩnh viễn` });
    setErrors(ls);
    if (ls.length) return;
    setDeleting(true);
    const failed: string[] = [];
    let okCount = 0;
    for (const r of deletable) {
      const res = await remove(r.account, r.rows);
      if (res.ok) okCount++;
      else failed.push(`${r.account.email}: ${res.error ?? "lỗi máy chủ"}`);
    }
    setDeleting(false);
    onDone();
    if (okCount) notify.saved(`Đã xóa vĩnh viễn ${okCount} tài khoản đăng nhập chưa có hồ sơ`);
    if (failed.length) {
      setErrors(failed.map((m) => ({ field: "Không xóa được", message: m })));
      return;
    }
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={targets !== null}
      onOpenChange={(o) => !isDeleting && onOpenChange(o)}
      title={targets && targets.length > 1 ? `Dọn ${targets.length} tài khoản chưa có hồ sơ` : `Xóa tài khoản ${targets?.[0]?.email ?? ""}`}
      description="Kiểm dữ liệu liên quan trước khi xóa. Xóa tài khoản đăng nhập là VĨNH VIỄN — không hoàn tác; lịch sử ghi bằng chữ (nhật ký, người ghi, tô màu) vẫn giữ nguyên."
      icon={Trash2}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          {deletable.length > 0 && (
            <Button
              variant="destructive"
              onClick={submit}
              title="Xóa vĩnh viễn các tài khoản không còn dữ liệu gắn cứng (máy chủ kiểm lại lần nữa lúc xóa)."
            >
              <Trash2 />
              {isDeleting ? "Đang xóa…" : `Xóa vĩnh viễn ${deletable.length} tài khoản`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <ErrorSummary errors={errors} />
        {!results ? (
          <ProcessingState text="Đang kiểm dữ liệu liên quan…" />
        ) : (
          <>
            {results.map((r) => {
              const isBlocked = !r.ok || r.rows.some((u) => u.blocking);
              return (
                <div key={r.account.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{r.account.email}</span>
                    {isBlocked ? <Tag variant="error">Không xóa được</Tag> : <Tag variant="done">Xóa được</Tag>}
                  </div>
                  <p className="text-sm text-muted-foreground">Đăng nhập gần nhất: {formatSignIn(r.account.lastSignInAt)}</p>
                  {!r.ok ? (
                    <p className="text-sm text-destructive">Không đọc được dữ liệu liên quan: {r.error}</p>
                  ) : r.rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có dữ liệu nào liên quan.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {r.rows.map((u) => (
                        <li key={u.category} className="flex flex-wrap items-center gap-2">
                          <Tag variant={u.blocking ? "error" : CAUTION_USAGE.has(u.category) ? "warning" : "muted"}>
                            {u.blocking ? "Chặn xóa" : CAUTION_USAGE.has(u.category) ? "Lưu ý" : "Giữ nguyên"}
                          </Tag>
                          <span className="text-foreground">
                            {u.label}
                            {u.category === "active_session" ? (
                              <span className="tnum"> · {u.rowCount} phiên</span>
                            ) : u.category !== "recent_sign_in" ? (
                              <span className="tnum"> · {u.rowCount} dòng</span>
                            ) : null}
                            {u.lastAt && <span className="text-muted-foreground"> · gần nhất {formatSignIn(u.lastAt)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {blocked.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tài khoản “Không xóa được” còn dữ liệu gắn cứng với id đăng nhập — xử lý phần đó trước (VD Gắn hồ sơ, bỏ quyền riêng) hoặc để lại.
              </p>
            )}
            {deletable.length > 0 && (
              <Field label={`Gõ “${DELETE_WORD}” để xác nhận xóa vĩnh viễn ${deletable.length} tài khoản`} required>
                <Input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
            )}
          </>
        )}
      </div>
    </FormDialog>
  );
}

interface NewUserForm {
  fullName: string;
  username: string;
  usernameEdited: boolean;
  password: string;
  roles: Role[];
}
const EMPTY_CREATE: NewUserForm = {
  fullName: "",
  username: "",
  usernameEdited: false,
  password: "",
  roles: [],
};

/** Màn quản lý người dùng — CHỈ admin. Đăng ký KHÔNG mở tự do: admin tạo tài
 * khoản ngay tại đây, và gán họ tên + vai trò. */
/** Ô Trạng thái: tạm ngưng / chờ đổi mật khẩu tạm / lần đăng nhập cuối (mig 0080). */
function AccountStatusCell({ status }: { status?: AccountStatus }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      {status.isDisabled ? (
        <Tag variant="error">Tạm ngưng</Tag>
      ) : status.mustChangePassword ? (
        <Tag variant="warning">Chờ đổi mật khẩu tạm</Tag>
      ) : (
        <Tag variant="done">Đang dùng</Tag>
      )}
      <span className="text-sm text-muted-foreground tnum">Đăng nhập: {formatSignIn(status.lastSignInAt)}</span>
    </span>
  );
}

const statusSortValue = (st?: AccountStatus) => (!st ? "" : st.isDisabled ? "3" : st.mustChangePassword ? "2" : "1");

const REQUIRE_CHANGE_OPTIONS = [
  { value: "yes", label: "Bắt đổi", description: "Lần vào tới người đó phải tự đặt mật khẩu riêng (nên chọn)." },
  { value: "no", label: "Không bắt", description: "Dùng luôn mật khẩu này." },
];

/**
 * Admin đặt lại mật khẩu cho người khác (mig 0080) — người dùng quên mật khẩu. Email đăng
 * nhập là email tổng hợp (không có hòm thư) nên không gửi link qua email được. Mật khẩu
 * hiện chữ thường để admin đọc / gửi cho người đó; KHÔNG lưu nháp, KHÔNG ghi nhật ký.
 */
function ResetPasswordDialog({
  user,
  onOpenChange,
  onSubmit,
}: {
  user: UserProfile | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (user: UserProfile, password: string, requireChange: boolean) => Promise<AuthResult>;
}) {
  // Mỗi lần mở là một lần dựng mới (key theo người ở chỗ gọi) ⇒ mật khẩu tạm mới, không dính lần trước.
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [requireChange, setRequireChange] = useState("yes");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isSaving, setSaving] = useState(false);
  const [isCopied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true); // chép = thao tác trình bày ⇒ báo ngay trên nút, không toast (QT 13)
    } catch {
      notify.error("Máy không cho chép — đọc mật khẩu trên màn hình");
    }
  };

  const submit = async () => {
    if (!user || isSaving) return;
    const ls: FieldError[] = [];
    if (password.length < 6) ls.push({ field: "Mật khẩu mới", message: "Tối thiểu 6 ký tự" });
    setErrors(ls);
    if (ls.length) return;
    setSaving(true);
    const result = await onSubmit(user, password, requireChange === "yes");
    setSaving(false);
    if (!result.ok) {
      setErrors([{ field: "Đặt lại mật khẩu", message: result.error ?? "Không đặt lại được" }]);
      return;
    }
    notify.saved(`Đã đặt lại mật khẩu cho @${user.username} — gửi mật khẩu mới cho người đó`);
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={user !== null}
      onOpenChange={onOpenChange}
      title={`Đặt lại mật khẩu — ${user?.fullName || user?.username || ""}`}
      description="Dùng khi người này quên mật khẩu. Mọi máy đang đăng nhập tài khoản này bị đăng xuất. Không hoàn tác được: mật khẩu cũ mất hẳn."
      icon={LockKeyhole}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant="save"
            onClick={submit}
            title="Ghi mật khẩu mới lên máy chủ và đăng xuất mọi máy của người này."
          >
            {isSaving ? "Đang đặt…" : "Đặt lại mật khẩu"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorSummary errors={errors} />
        <Field
          label="Mật khẩu mới"
          required
          hint="Đã tạo sẵn ngẫu nhiên — sửa được. Tối thiểu 6 ký tự. Chép rồi gửi riêng cho người đó (Zalo / nói trực tiếp)."
        >
          <Input
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setCopied(false);
            }}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
              setPassword(generateTemporaryPassword());
              setCopied(false);
            }} title="Tạo mật khẩu ngẫu nhiên khác.">
            <Dices />
            Tạo mật khẩu khác
          </Button>
          <Button variant="outline" size="sm" onClick={copy} title="Chép mật khẩu vào bộ nhớ tạm để dán vào tin nhắn.">
            <Copy />
            {isCopied ? "Đã chép" : "Chép mật khẩu"}
          </Button>
        </div>
        <ChoiceGroup
          label="Lần đăng nhập tới"
          value={requireChange}
          onChange={setRequireChange}
          options={REQUIRE_CHANGE_OPTIONS}
          columns={2}
        />
      </div>
    </FormDialog>
  );
}

export default function UserManagementScreen({
  createAccount,
  currentUserId,
}: {
  /** Id tài khoản admin đang dùng — không tự tạm ngưng / tự đặt lại mật khẩu mình. */
  currentUserId?: string;
  createAccount: (
    fullName: string,
    username: string,
    password: string,
    roles: Role[]
  ) => Promise<AuthResult>;
}) {
  const [items, write, { status }] = useUserProfiles();
  const [appRoles] = useAppRoles();
  const navigate = useNavigate();
  const roleLabel = (v: Role[]) => roleNames(v, appRoles);
  const orphans = useOrphanAccounts(true);
  const accounts = useAccountAdmin(true);
  const [resetFor, setResetFor] = useState<UserProfile | null>(null);
  const [disableFor, setDisableFor] = useState<UserProfile | null>(null);

  const setAccountDisabled = async (u: UserProfile, disabled: boolean) => {
    const result = await accounts.setDisabled(u, disabled);
    if (!result.ok) {
      notify.error(`Không ${disabled ? "tạm ngưng" : "mở lại"} được: ${result.error ?? "lỗi máy chủ"}`);
      return;
    }
    notify.saved(
      disabled ? `Đã tạm ngưng @${u.username} — người đó không đăng nhập được nữa` : `Đã mở lại @${u.username}`,
      async () => {
        const back = await accounts.setDisabled(u, !disabled);
        if (!back.ok) notify.error(`Không hoàn tác được: ${back.error ?? "lỗi máy chủ"}`);
      }
    );
  };
  // Tạo hồ sơ cho tài khoản đăng nhập có sẵn (mồ côi) — khác "Tạo tài khoản" (đăng ký mới).
  const [profileFor, setProfileFor] = useState<{ account: OrphanAccount; form: UserProfile } | null>(null);
  const [profileErrors, setProfileErrors] = useState<FieldError[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<OrphanAccount[] | null>(null);

  /** Đổi id hồ sơ trong bản đang cầm cho khớp máy chủ (hàm SQL đã chuyển) — không thì lần
   *  lưu kế tiếp tạo lại dòng id cũ trùng tên đăng nhập, kẹt hàng chờ. */
  const swapProfileId = (from: string, to: string) => write(items.map((u) => (u.id === from ? { ...u, id: to } : u)));

  const relinkProfile = async (a: OrphanAccount) => {
    const from = a.suggestedProfile?.id;
    if (!from) return;
    const result = await orphans.relink(from, a.id);
    if (!result.ok) {
      notify.error(`Không gắn được hồ sơ: ${result.error ?? "lỗi máy chủ"}`);
      return;
    }
    swapProfileId(from, a.id);
    orphans.reload();
    notify.saved(`Đã gắn hồ sơ @${a.suggestedProfile?.username} sang ${a.email}`, async () => {
      const back = await orphans.relink(a.id, from);
      if (!back.ok) {
        notify.error(`Không hoàn tác được: ${back.error ?? "lỗi máy chủ"}`);
        return;
      }
      swapProfileId(a.id, from);
      orphans.reload();
    });
  };

  const saveOrphanProfile = () => {
    if (!profileFor) return;
    const f = profileFor.form;
    const username = normalizeUsername(f.username);
    const ls: FieldError[] = [];
    if (!f.fullName.trim()) ls.push({ field: "Họ tên", message: "Chưa nhập họ tên" });
    if (!username) ls.push({ field: "Tên đăng nhập", message: "Chưa nhập tên đăng nhập" });
    else if (items.some((u) => u.username.toLowerCase() === username))
      ls.push({
        field: "Tên đăng nhập",
        message: "Trùng hồ sơ đã có — nếu đó là cùng một người thì dùng Gắn hồ sơ thay vì tạo mới",
      });
    setProfileErrors(ls);
    if (ls.length) return;
    write([...items, { ...f, fullName: f.fullName.trim(), username }]);
    notify.saved(`Đã tạo hồ sơ cho ${profileFor.account.email}`);
    setProfileFor(null);
    orphans.reload();
  };
  const isLoading = status === "loading" && items.length === 0;
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editErrors, setEditErrors] = useState<FieldError[]>([]);
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState(ALL);
  const [roleFilter, setRoleFilter] = useState(ALL);
  // Tên gọi (ba-spec 47): máy chủ chưa chạy 0086 ⇒ ẩn ô, không gửi cột.
  const hasDisplayName = isDisplayNameAvailable(items, isServerConnected);

  const [creating, setCreating] = useState<NewUserForm | null>(null);
  const [createErrors, setCreateErrors] = useState<FieldError[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const save = () => {
    if (!editing) return;
    let next = editing;
    if (hasDisplayName) {
      // R5: kiểm tên gọi với người khác; bằng chính họ tên ⇒ lưu rỗng. Họ tên không đổi theo.
      const checked = checkDisplayName(editing.displayName ?? "", editing, items.filter((u) => u.id !== editing.id));
      if (checked.error !== undefined) {
        setEditErrors([{ field: "Tên gọi", message: checked.error }]);
        return;
      }
      next = { ...editing, displayName: checked.value };
    }
    setEditErrors([]);
    write(items.map((n) => (n.id === next.id ? next : n)));
    notify.saved(`Đã lưu người dùng ${next.username || next.id}`);
    setEditing(null);
  };

  const changeNewFullName = (v: string) =>
    setCreating((t) =>
      t
        ? { ...t, fullName: v, username: t.usernameEdited ? t.username : fullNameToUsername(v) }
        : t
    );

  const saveCreate = async () => {
    if (!creating) return;
    const ls: FieldError[] = [];
    if (!creating.fullName.trim()) ls.push({ field: "Họ tên", message: "Chưa nhập họ tên" });
    if (!creating.username.trim())
      ls.push({ field: "Tên đăng nhập", message: "Chưa nhập tên đăng nhập" });
    if (creating.password.length < 6)
      ls.push({ field: "Mật khẩu", message: "Tối thiểu 6 ký tự" });
    setCreateErrors(ls);
    if (ls.length > 0) return;

    setIsCreating(true);
    const result = await createAccount(
      creating.fullName,
      creating.username,
      creating.password,
      creating.roles
    );
    setIsCreating(false);
    if (!result.ok) {
      setCreateErrors([{ field: "Tạo tài khoản", message: result.error ?? "Thất bại" }]);
      return;
    }
    if (result.profile) write([...items, result.profile]);
    notify.saved(`Đã tạo tài khoản ${creating.username}`);
    setCreating(null);
    setCreateErrors([]);
  };

  const cols: RecordTableColumn<UserProfile>[] = [
    {
      key: "username",
      header: "Tên đăng nhập",
      primary: true,
      render: (r) => r.username || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.username,
    },
    {
      key: "hoTen",
      header: "Họ tên",
      // Họ tên thật trước, tên gọi (ba-spec 47 R3) bên dưới — admin luôn thấy cả hai.
      render: (r) =>
        r.fullName ? (
          <>
            {r.fullName}
            {r.displayName && <span className="block text-sm text-muted-foreground">Tên gọi: {r.displayName}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">Chưa đặt</span>
        ),
      getSortValue: (r) => r.fullName,
    },
    {
      key: "vaiTro",
      header: "Chức vụ",
      render: (r) => {
        const vt = sortRolesByRank(rolesList(r.roles), appRoles);
        return vt.length ? (
          <span className="flex flex-wrap gap-1">
            {vt.map((v) => (
              <Tag key={v} variant="category" tone={toneByName(roleLabel([v]))}>
                {roleLabel([v])}
              </Tag>
            ))}
          </span>
        ) : (
          <Tag variant="error">Chưa gán</Tag>
        );
      },
      getSortValue: (r) => roleLabel(r.roles),
    },
    ...(accounts.isAvailable
      ? [
          {
            key: "accountStatus",
            header: "Trạng thái",
            render: (r: UserProfile) => <AccountStatusCell status={accounts.statuses[r.id]} />,
            getSortValue: (r: UserProfile) => statusSortValue(accounts.statuses[r.id]),
            sortKind: "text" as const,
          },
        ]
      : []),
  ];

  // Gom theo phòng ban, trong phòng Trưởng → Phó → Nhân viên (quy tắc ở lib/userDirectory.ts).
  // Bộ lọc (ba-spec 53 đợt 3): ô tra · trạng thái tài khoản · vai trò.
  const accountStateOf = (u: UserProfile) => {
    const st = accounts.statuses[u.id];
    return !st ? "" : st.isDisabled ? "disabled" : st.mustChangePassword ? "temp-password" : "active";
  };
  const stateChoices = statusOptions(items, accountStateOf, [
    { value: "active", label: "Đang dùng" },
    { value: "temp-password", label: "Chờ đổi mật khẩu tạm" },
    { value: "disabled", label: "Tạm ngưng" },
  ]);
  const roleChoices = [
    { value: ALL, label: "Tất cả vai trò" },
    ...[...new Set(items.flatMap((u) => rolesList(u.roles)))].map((r) => ({ value: r, label: roleLabel([r]) })).sort((a, b) => a.label.localeCompare(b.label, "vi")),
  ];
  const filterCount = activeFilterCount([q, stateFilter, roleFilter]);
  const clearFilters = () => {
    setQ("");
    setStateFilter(ALL);
    setRoleFilter(ALL);
  };
  const filtered = filterRows(items, [
    (u) => matchesSearch(q, personSearchText(u), roleLabel(u.roles)),
    (u) => matchesValue(stateFilter, accountStateOf(u)),
    (u) => roleFilter === ALL || rolesList(u.roles).includes(roleFilter as Role),
  ]);
  const visibleGroups = groupUsersByDepartment(
    filtered.map((u) => ({ ...u, roles: rolesList(u.roles) })),
    appRoles
  ).map((g) => ({ ...g, icon: GROUP_ICONS[g.id] ?? Users }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Người dùng</h1>
          <p className="text-muted-foreground">{items.length} tài khoản · gom theo phòng ban &amp; cấp bậc</p>
        </div>
        <Button
          title="Tạo tài khoản đăng nhập mới và gán vai trò cho người đó."
          size="lg"
          onClick={() => {
            setCreating({ ...EMPTY_CREATE });
            setCreateErrors([]);
          }}
        >
          <Plus />
          Tạo tài khoản
        </Button>
      </div>

      <OrphanAccountsSection
        accounts={orphans.accounts}
        appRoles={appRoles}
        onRelink={relinkProfile}
        onDelete={setDeleteTargets}
        onCreate={(account) => {
          setProfileErrors([]);
          setProfileFor({
            account,
            form: { id: account.id, fullName: account.fullName, username: normalizeUsername(account.username), roles: [] },
          });
        }}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có người dùng nào"
          description="Bấm “Tạo tài khoản” để thêm người dùng đầu tiên, rồi gán vai trò."
          action={
            <Button
              title="Tạo tài khoản đăng nhập đầu tiên."
              size="lg"
              onClick={() => {
                setCreating({ ...EMPTY_CREATE });
                setCreateErrors([]);
              }}
            >
              <Plus />
              Tạo tài khoản
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <FilterBar
            activeCount={filterCount}
            onClearAll={clearFilters}
            resultText={`Đang hiện ${filtered.length.toLocaleString("vi-VN")} / ${items.length.toLocaleString("vi-VN")} tài khoản`}
          >
            <SearchField label="Tra tên đăng nhập, họ tên, vai trò" value={q} onChange={setQ} />
            <Combobox label="Vai trò" hideRequiredMark clearable={false} value={roleFilter} onChange={(v) => setRoleFilter(v || ALL)} options={roleChoices} className="min-w-[14rem] flex-1" />
            {accounts.isAvailable && (
              <ChoiceGroup
                label="Trạng thái tài khoản"
                hideRequiredMark
                value={stateFilter}
                onChange={setStateFilter}
                options={stateChoices.map((o) => ({ value: o.value, label: countedLabel(o) }))}
                columns={4}
              />
            )}
          </FilterBar>

          {visibleGroups.length === 0 ? (
            <NoMatchState onClearAll={clearFilters} />
          ) : (
            visibleGroups.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.id} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    {group.name}
                    <Tag variant="muted">{group.users.length}</Tag>
                  </h2>
                  <RecordTable
                    columns={cols}
                    rows={group.users}
                    getKey={(r) => r.id}
                    rowMarkKey="nguoi-dung"
                    actions={(r) => (
                      <span className="flex flex-wrap gap-2">
                        <Button
                          title="Sửa họ tên hoặc vai trò của tài khoản này."
                          variant="edit"
                          size="sm"
                          onClick={() => setEditing({ ...r, roles: rolesList(r.roles) })}
                        >
                          <Pencil />
                          Sửa
                        </Button>
                        <Button
                          title="Xem quyền thực của người này ở từng màn; cho thêm hoặc chặn riêng."
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/roles?tab=users&user=${encodeURIComponent(r.id)}`)}
                        >
                          <KeyRound />
                          Quyền
                        </Button>
                        {r.id !== currentUserId && (
                          <Button
                            title="Người này quên mật khẩu: đặt mật khẩu tạm mới, đăng xuất mọi máy của họ."
                            variant="outline"
                            size="sm"
                            onClick={() => setResetFor(r)}
                          >
                            <LockKeyhole />
                            Mật khẩu
                          </Button>
                        )}
                        {r.id !== currentUserId &&
                          (accounts.statuses[r.id]?.isDisabled ? (
                            <Button
                              title="Cho người này đăng nhập lại (vai trò, quyền giữ nguyên như trước khi tạm ngưng)."
                              variant="edit"
                              size="sm"
                              onClick={() => setAccountDisabled(r, false)}
                            >
                              <UserCheck />
                              Mở lại
                            </Button>
                          ) : (
                            <Button
                              title="Người nghỉ việc / tạm nghỉ: chặn đăng nhập, đăng xuất mọi máy. Hồ sơ và lịch sử ghi sổ giữ nguyên, mở lại được."
                              variant="danger"
                              size="sm"
                              onClick={() => setDisableFor(r)}
                            >
                              <UserX />
                              Tạm ngưng
                            </Button>
                          ))}
                      </span>
                    )}
                  />
                </section>
              );
            })
          )}
        </div>
      )}

      {/* Tạo tài khoản (admin) */}
      <Dialog
        open={creating !== null}
        onOpenChange={(o) => {
          if (!o) setCreating(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo tài khoản</DialogTitle>
          </DialogHeader>

          {creating && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={createErrors} />
              <RequiredLegend />
              <Field label="Họ tên" required>
                <Input
                  value={creating.fullName}
                  onChange={(e) => changeNewFullName(e.target.value)}
                  autoFocus
                  placeholder="VD: Nguyễn Văn A"
                />
              </Field>
              <Field
                label="Tên đăng nhập"
                required
                hint="Gợi ý từ họ tên — sửa được. Chỉ chữ thường không dấu và số (không dấu chấm, không khoảng trắng). Người dùng dùng tên này để đăng nhập."
              >
                <Input
                  value={creating.username}
                  onChange={(e) =>
                    setCreating((t) =>
                      t ? { ...t, username: normalizeUsername(e.target.value), usernameEdited: true } : t
                    )
                  }
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Tên đăng nhập"
                />
              </Field>
              <Field label="Mật khẩu" required hint="Tối thiểu 6 ký tự.">
                <Input
                  type="password"
                  value={creating.password}
                  onChange={(e) =>
                    setCreating((t) => (t ? { ...t, password: e.target.value } : t))
                  }
                  placeholder="Mật khẩu"
                />
              </Field>
              <Field
                label="Vai trò"
                hint="Chọn một hoặc nhiều từ danh sách. VD Phó giám đốc kiêm Quản đốc xưởng Đông = thêm cả hai. Bỏ trống cũng được, gán sau."
              >
                <RolePicker
                  appRoles={appRoles}
                  selected={creating.roles}
                  onChange={(v) => setCreating((t) => (t ? { ...t, roles: v } : t))}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setCreating(null)}>
              Hủy
            </Button>
            <Button variant="save"
              title="Tạo tài khoản với tên đăng nhập, mật khẩu và vai trò vừa khai." size="lg" onClick={saveCreate} disabled={isCreating}>
              {isCreating ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog key={resetFor?.id ?? "closed"} user={resetFor} onOpenChange={(o) => !o && setResetFor(null)} onSubmit={accounts.resetPassword} />

      <ConfirmAction
        open={disableFor !== null}
        onOpenChange={(o) => !o && setDisableFor(null)}
        title={`Tạm ngưng tài khoản ${disableFor?.fullName || disableFor?.username || ""}?`}
        description="Người này không đăng nhập được nữa; máy đang mở bị đăng xuất (chậm nhất khoảng 1 giờ). Hồ sơ, vai trò và mọi số đã ghi giữ nguyên. Mở lại bất cứ lúc nào bằng nút Mở lại."
        detail={disableFor ? `@${disableFor.username} · ${roleLabel(disableFor.roles) || "chưa gán vai trò"}` : undefined}
        confirmLabel="Tạm ngưng"
        cancelLabel="Thôi"
        icon={UserX}
        onConfirm={() => {
          if (disableFor) void setAccountDisabled(disableFor, true);
          setDisableFor(null);
        }}
      />

      <DeleteOrphansDialog
        key={deleteTargets ? deleteTargets.map((a) => a.id).join(",") : "closed"}
        targets={deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets(null)}
        loadUsage={orphans.usage}
        remove={orphans.remove}
        onDone={orphans.reload}
      />

      {/* Tạo hồ sơ cho tài khoản đăng nhập chưa có hồ sơ */}
      <Dialog
        open={profileFor !== null}
        onOpenChange={(o) => {
          if (!o) setProfileFor(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo hồ sơ cho {profileFor?.account.email}</DialogTitle>
          </DialogHeader>
          {profileFor && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={profileErrors} />
              <RequiredLegend />
              <Field label="Họ tên" required>
                <Input
                  value={profileFor.form.fullName}
                  onChange={(e) => setProfileFor((t) => (t ? { ...t, form: { ...t.form, fullName: e.target.value } } : t))}
                  autoFocus
                />
              </Field>
              <Field label="Tên đăng nhập" required hint="Tên hiển thị trong danh sách. Người dùng vẫn đăng nhập bằng tài khoản ở trên.">
                <Input
                  value={profileFor.form.username}
                  onChange={(e) => setProfileFor((t) => (t ? { ...t, form: { ...t.form, username: normalizeUsername(e.target.value) } } : t))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="Vai trò" hint="Chọn một hoặc nhiều. Bỏ trống thì người này vẫn chưa mở được màn nào.">
                <RolePicker
                  appRoles={appRoles}
                  selected={profileFor.form.roles}
                  onChange={(v) => setProfileFor((t) => (t ? { ...t, form: { ...t.form, roles: v } } : t))}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setProfileFor(null)}>
              Hủy
            </Button>
            <Button variant="save" size="lg" onClick={saveOrphanProfile} title="Tạo hồ sơ (họ tên, tên đăng nhập, vai trò) cho tài khoản đăng nhập này.">
              Tạo hồ sơ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sửa họ tên + vai trò */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setEditErrors([]);
          }
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Sửa người dùng {editing?.username}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={editErrors} />
              <Field label="Họ tên">
                <Input
                  value={editing.fullName}
                  onChange={(e) =>
                    setEditing((d) => (d ? { ...d, fullName: e.target.value } : d))
                  }
                  placeholder="Họ tên đầy đủ"
                />
              </Field>
              {hasDisplayName && (
                <Field
                  label="Tên gọi"
                  hint={`Tên gọi chỉ để gọi người, tối đa ${DISPLAY_NAME_MAX} ký tự; sổ sách, nhật ký, chứng từ vẫn ghi họ tên. Để trống = gọi bằng họ tên.`}
                >
                  <Input
                    value={editing.displayName ?? ""}
                    maxLength={DISPLAY_NAME_MAX + 10}
                    onChange={(e) => setEditing((d) => (d ? { ...d, displayName: e.target.value } : d))}
                  />
                </Field>
              )}
              <Field
                label="Vai trò"
                hint="Chọn từ danh sách để thêm; bấm ✕ trên vai trò để bỏ. Bỏ hết = Chưa gán."
              >
                <RolePicker
                  appRoles={appRoles}
                  selected={editing.roles}
                  onChange={(v) => setEditing((d) => (d ? { ...d, roles: v } : d))}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setEditing(null);
                setEditErrors([]);
              }}
            >
              Hủy
            </Button>
            <Button variant="save"
              title="Ghi lại thay đổi cho tài khoản này. Vai trò mới có hiệu lực ở lần vào màn kế tiếp." size="lg" onClick={save}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
