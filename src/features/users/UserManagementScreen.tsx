// ============================================================
// Tên file cũ: src/features/users/QuanLyNguoiDung.tsx
// Tên tiếng Việt: Màn hình Quản lý Người dùng & Phân quyền Admin
// Description: User Accounts & Access Control Management Screen
// ============================================================
import { useState } from "react";
import type { UserProfile, Role } from "@/types";
import { ROLES, roleLabel, rolesList } from "@/types";
import { useUserProfiles } from "@/lib/catalogRepo";
import { fullNameToUsername } from "@/lib/username";
import type { AuthResult } from "@/lib/auth";
import {
  Tag,
  toneByName,
  RequiredLegend,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  RecordTable,
  TableSkeleton,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import {
  Pencil,
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

/** Tên phòng ban của một vai trò (dòng phụ trong dropdown chọn vai trò). */
function departmentOfRole(v: Role): string {
  return DEPARTMENTS.find((pb) => pb.roles.includes(v))?.name ?? "Khác";
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
}: {
  selected: Role[];
  onChange: (v: Role[]) => void;
}) {
  const remaining = ROLES.filter((r) => !selectedRoles.includes(r.value));
  const options: ComboboxOption[] = remaining.map((r) => ({
    value: r.value,
    label: r.label,
    subLabel: departmentOfRole(r.value),
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
  for (const u of filtered) {
    const { idx, rank } = rankDepartment(rolesList(u.roles));
    if (idx < DEPARTMENTS.length) thung[idx].push({ u, rank });
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
                      <Button
                        title="Sửa họ tên hoặc vai trò của tài khoản này."
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing({ ...r, roles: rolesList(r.roles) })}
                      >
                        <Pencil />
                        Sửa
                      </Button>
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
                hint="Gợi ý từ họ tên — sửa được. Người dùng dùng tên này để đăng nhập."
              >
                <Input
                  value={creating.username}
                  onChange={(e) =>
                    setCreating((t) =>
                      t ? { ...t, username: e.target.value, usernameEdited: true } : t
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
            <Button
              title="Tạo tài khoản với tên đăng nhập, mật khẩu và vai trò vừa khai." size="lg" onClick={saveCreate} disabled={isCreating}>
              {isCreating ? "Đang tạo…" : "Tạo tài khoản"}
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
            <Button
              title="Ghi lại thay đổi cho tài khoản này. Vai trò mới có hiệu lực ở lần vào màn kế tiếp." size="lg" onClick={save}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
