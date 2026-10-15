// ============================================================
// Tên file cũ: src/features/users/QuanLyNguoiDung.tsx
// Tên tiếng Việt: Màn hình Quản lý Người dùng & Phân quyền Admin
// Description: User Accounts & Access Control Management Screen
// ============================================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppRole, UserProfile, Role } from "@/types";
import { rolesList } from "@/types";
import { useAppRoles, useUserProfiles } from "@/lib/catalogRepo";
import { listRoleOptions, roleNames } from "@/lib/permissions";
import { fullNameToUsername, normalizeUsername } from "@/lib/username";
import { useOrphanAccounts, type AccountUsage, type AuthResult, type OrphanAccount } from "@/lib/auth";
import {
  Tag,
  toneByName,
  RequiredLegend,
  Button,
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
  FormDialog,
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
  Calculator,
  Factory,
  Warehouse,
  ShieldCheck,
  UserRound,
  Search,
  type LucideIcon,
} from "lucide-react";

/**
 * Phòng ban & cấp bậc — gom vai trò theo bộ phận để danh sách người dùng trực
 * quan hơn (thay 1 list phẳng). Thứ tự trong `roles` = cấp bậc (cao → thấp).
 * ĐỂ CỤC BỘ ở màn này (KHÔNG nhét vào types.ts) — đây là cách TRÌNH BÀY, không
 * phải quy tắc phân quyền; phân quyền thật vẫn ở ROLES + lib/nav-access.ts.
 */
const DEPARTMENTS: { id: string; name: string; icon: LucideIcon; roles: Role[] }[] = [
  { id: "giam-doc", name: "Ban giám đốc", icon: Briefcase, roles: ["director", "vice-director"] },
  { id: "ke-toan", name: "Phòng kế toán", icon: Calculator, roles: ["chief-accountant", "accountant"] },
  {
    id: "san-xuat",
    name: "Phân xưởng sản xuất",
    icon: Factory,
    roles: ["manager-dong", "manager-ca", "manager-kho", "vice-manager", "team-leader"],
  },
  { id: "kho", name: "Kho & nhập hàng", icon: Warehouse, roles: ["warehouse-keeper"] },
  { id: "he-thong", name: "Quản trị hệ thống", icon: ShieldCheck, roles: ["admin"] },
];

/** Tên phòng ban của một vai trò (dòng phụ trong dropdown chọn vai trò). Vai trò
 * admin tự tạo (màn Vai trò & quyền) ⇒ "Vai trò tự tạo". */
function departmentOfRole(v: Role): string {
  return DEPARTMENTS.find((pb) => pb.roles.includes(v))?.name ?? "Vai trò tự tạo";
}

/** Xếp một người vào 1 phòng ban theo vai trò cấp CAO NHẤT họ có (rank nhỏ = cao). */
function rankDepartment(roles: Role[]): { idx: number; rank: number } {
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const hits = roles.map((r) => DEPARTMENTS[i].roles.indexOf(r)).filter((x) => x >= 0);
    if (hits.length) return { idx: i, rank: Math.min(...hits) };
  }
  return { idx: DEPARTMENTS.length, rank: 0 }; // chưa gán vai trò
}

/** Sắp vai trò của một người theo cấp bậc (cao → thấp) để hiện chức vụ chính trước. */
function sapTheoCap(roles: Role[]): Role[] {
  const key = (r: Role) => {
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      const j = DEPARTMENTS[i].roles.indexOf(r);
      if (j >= 0) return i * 100 + j;
    }
    return 9999;
  };
  return [...roles].sort((a, b) => key(a) - key(b));
}

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
    subLabel: departmentOfRole(r.value as Role),
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
export default function UserManagementScreen({
  createAccount,
}: {
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
  const [q, setQ] = useState("");

  const [creating, setCreating] = useState<NewUserForm | null>(null);
  const [createErrors, setCreateErrors] = useState<FieldError[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const save = () => {
    if (!editing) return;
    write(items.map((n) => (n.id === editing.id ? editing : n)));
    notify.saved(`Đã lưu người dùng ${editing.username || editing.id}`);
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
      render: (r) =>
        r.fullName || <span className="text-muted-foreground">Chưa đặt</span>,
      getSortValue: (r) => r.fullName,
    },
    {
      key: "vaiTro",
      header: "Chức vụ",
      render: (r) => {
        const vt = sapTheoCap(rolesList(r.roles));
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
  ];

  // Gom người dùng theo phòng ban (+ sắp theo cấp bậc) để danh sách trực quan.
  const query = q.trim().toLowerCase();
  const filtered = query
    ? items.filter((u) => `${u.username} ${u.fullName} ${roleLabel(u.roles)}`.toLowerCase().includes(query))
    : items;
  const userName = (u: UserProfile) => u.fullName || u.username || "";
  const thung: { u: UserProfile; rank: number }[][] = DEPARTMENTS.map(() => []);
  const unassigned: UserProfile[] = [];
  const customOnly: UserProfile[] = []; // chỉ giữ vai trò tự tạo
  for (const u of filtered) {
    const { idx, rank } = rankDepartment(rolesList(u.roles));
    if (idx < DEPARTMENTS.length) thung[idx].push({ u, rank });
    else if (u.roles.length) customOnly.push(u);
    else unassigned.push(u);
  }
  const visibleGroups = [
    ...DEPARTMENTS.map((pb, i) => ({
      id: pb.id,
      name: pb.name,
      icon: pb.icon,
      users: thung[i]
        .sort((a, b) => a.rank - b.rank || userName(a.u).localeCompare(userName(b.u), "vi"))
        .map((x) => x.u),
    })),
    {
      id: "custom",
      name: "Vai trò tự tạo",
      icon: KeyRound,
      users: [...customOnly].sort((a, b) => userName(a).localeCompare(userName(b), "vi")),
    },
    {
      id: "chua",
      name: "Chưa phân công",
      icon: UserRound,
      users: [...unassigned].sort((a, b) => userName(a).localeCompare(userName(b), "vi")),
    },
  ].filter((n) => n.users.length > 0);

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
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên đăng nhập / họ tên / vai trò…"
              aria-label="Tìm người dùng"
              className="pl-10"
            />
          </div>

          {visibleGroups.length === 0 ? (
            <p className="text-muted-foreground">Không tìm thấy người dùng nào khớp “{q}”.</p>
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
          if (!o) setEditing(null);
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
              <Field label="Họ tên">
                <Input
                  value={editing.fullName}
                  onChange={(e) =>
                    setEditing((d) => (d ? { ...d, fullName: e.target.value } : d))
                  }
                  placeholder="Họ tên đầy đủ"
                />
              </Field>
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
            <Button variant="outline" size="lg" onClick={() => setEditing(null)}>
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
