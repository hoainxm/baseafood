// ============================================================
// Tên file cũ: src/features/users/QuanLyNguoiDung.tsx
// Tên tiếng Việt: Màn hình Quản lý Người dùng & Phân quyền Admin
// Description: User Accounts & Access Control Management Screen
// ============================================================
import { useState } from "react";
import type { UserProfile, Role } from "@/types";
import { ROLES, roleLabel, rolesList } from "@/types";
import { useUserProfiles } from "@/lib/catalogRepo";
import { hoTenToUsername } from "@/lib/username";
import type { KetQuaDangNhap } from "@/lib/auth";
import {
  Nhan,
  sacTheoTen,
  ChuThichBatBuoc,
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
  SkeletonBang,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
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
const PHONG_BAN: { id: string; ten: string; icon: LucideIcon; roles: Role[] }[] = [
  { id: "giam-doc", ten: "Ban giám đốc", icon: Briefcase, roles: ["director", "vice-director"] },
  { id: "ke-toan", ten: "Phòng kế toán", icon: Calculator, roles: ["chief-accountant", "accountant"] },
  {
    id: "san-xuat",
    ten: "Phân xưởng sản xuất",
    icon: Factory,
    roles: ["manager-dong", "manager-ca", "manager-kho", "vice-manager", "team-leader"],
  },
  { id: "kho", ten: "Kho & nhập hàng", icon: Warehouse, roles: ["warehouse-keeper"] },
  { id: "he-thong", ten: "Quản trị hệ thống", icon: ShieldCheck, roles: ["admin"] },
];

/** Tên phòng ban của một vai trò (dòng phụ trong dropdown chọn vai trò). */
function phongBanCuaRole(v: Role): string {
  return PHONG_BAN.find((pb) => pb.roles.includes(v))?.ten ?? "Khác";
}

/** Xếp một người vào 1 phòng ban theo vai trò cấp CAO NHẤT họ có (rank nhỏ = cao). */
function xepPhongBan(roles: Role[]): { idx: number; rank: number } {
  for (let i = 0; i < PHONG_BAN.length; i++) {
    const hits = roles.map((r) => PHONG_BAN[i].roles.indexOf(r)).filter((x) => x >= 0);
    if (hits.length) return { idx: i, rank: Math.min(...hits) };
  }
  return { idx: PHONG_BAN.length, rank: 0 }; // chưa gán vai trò
}

/** Sắp vai trò của một người theo cấp bậc (cao → thấp) để hiện chức vụ chính trước. */
function sapTheoCap(roles: Role[]): Role[] {
  const key = (r: Role) => {
    for (let i = 0; i < PHONG_BAN.length; i++) {
      const j = PHONG_BAN[i].roles.indexOf(r);
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
  chon,
  onDoi,
}: {
  chon: Role[];
  onDoi: (v: Role[]) => void;
}) {
  const remaining = ROLES.filter((r) => !chon.includes(r.value));
  const options: MucChon[] = remaining.map((r) => ({
    value: r.value,
    label: r.label,
    phu: phongBanCuaRole(r.value),
  }));
  return (
    <div className="space-y-3">
      {chon.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chon.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted py-1 pl-3 pr-1 font-medium"
            >
              {roleLabel([v])}
              <button
                type="button"
                onClick={() => onDoi(chon.filter((x) => x !== v))}
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
          anNhanBatBuoc
          value=""
          onChange={(v) => v && onDoi([...chon, v as Role])}
          options={options}
          placeholder="Gõ hoặc chọn vai trò để thêm…"
          emptyText="Đã thêm hết vai trò."
          choPhepXoa={false}
        />
      )}
    </div>
  );
}

interface NewUserForm {
  fullName: string;
  username: string;
  usernameTuSua: boolean;
  matKhau: string;
  roles: Role[];
}
const EMPTY_CREATE: NewUserForm = {
  fullName: "",
  username: "",
  usernameTuSua: false,
  matKhau: "",
  roles: [],
};

/** Màn quản lý người dùng — CHỈ admin. Đăng ký KHÔNG mở tự do: admin tạo tài
 * khoản ngay tại đây, và gán họ tên + vai trò. */
export default function QuanLyNguoiDungScreen({
  taoTaiKhoan,
}: {
  taoTaiKhoan: (
    fullName: string,
    username: string,
    matKhau: string,
    roles: Role[]
  ) => Promise<KetQuaDangNhap>;
}) {
  const [ds, write, { trangThai }] = useUserProfiles();
  const isLoading = trangThai === "dang-tai" && ds.length === 0;
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [q, setQ] = useState("");

  const [creating, setCreating] = useState<NewUserForm | null>(null);
  const [createErrors, setCreateErrors] = useState<LoiNhap[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const save = () => {
    if (!editing) return;
    write(ds.map((n) => (n.id === editing.id ? editing : n)));
    notify.daLuu(`Đã lưu người dùng ${editing.username || editing.id}`);
    setEditing(null);
  };

  const changeNewFullName = (v: string) =>
    setCreating((t) =>
      t
        ? { ...t, fullName: v, username: t.usernameTuSua ? t.username : hoTenToUsername(v) }
        : t
    );

  const saveCreate = async () => {
    if (!creating) return;
    const ls: LoiNhap[] = [];
    if (!creating.fullName.trim()) ls.push({ truong: "Họ tên", thongBao: "Chưa nhập họ tên" });
    if (!creating.username.trim())
      ls.push({ truong: "Tên đăng nhập", thongBao: "Chưa nhập tên đăng nhập" });
    if (creating.matKhau.length < 6)
      ls.push({ truong: "Mật khẩu", thongBao: "Tối thiểu 6 ký tự" });
    setCreateErrors(ls);
    if (ls.length > 0) return;

    setIsCreating(true);
    const kq = await taoTaiKhoan(
      creating.fullName,
      creating.username,
      creating.matKhau,
      creating.roles
    );
    setIsCreating(false);
    if (!kq.ok) {
      setCreateErrors([{ truong: "Tạo tài khoản", thongBao: kq.loi ?? "Thất bại" }]);
      return;
    }
    if (kq.nguoiDung) write([...ds, kq.nguoiDung]);
    notify.daLuu(`Đã tạo tài khoản ${creating.username}`);
    setCreating(null);
    setCreateErrors([]);
  };

  const cols: Cot<UserProfile>[] = [
    {
      key: "username",
      header: "Tên đăng nhập",
      chinh: true,
      render: (r) => r.username || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.username,
    },
    {
      key: "hoTen",
      header: "Họ tên",
      render: (r) =>
        r.fullName || <span className="text-muted-foreground">Chưa đặt</span>,
      sapXep: (r) => r.fullName,
    },
    {
      key: "vaiTro",
      header: "Chức vụ",
      render: (r) => {
        const vt = sapTheoCap(rolesList(r.roles));
        return vt.length ? (
          <span className="flex flex-wrap gap-1">
            {vt.map((v) => (
              <Nhan key={v} loai="phan-loai" sac={sacTheoTen(roleLabel([v]))}>
                {roleLabel([v])}
              </Nhan>
            ))}
          </span>
        ) : (
          <Nhan loai="loi">Chưa gán</Nhan>
        );
      },
      sapXep: (r) => roleLabel(r.roles),
    },
  ];

  // Gom người dùng theo phòng ban (+ sắp theo cấp bậc) để danh sách trực quan.
  const query = q.trim().toLowerCase();
  const filtered = query
    ? ds.filter((u) => `${u.username} ${u.fullName} ${roleLabel(u.roles)}`.toLowerCase().includes(query))
    : ds;
  const userName = (u: UserProfile) => u.fullName || u.username || "";
  const thung: { u: UserProfile; rank: number }[][] = PHONG_BAN.map(() => []);
  const unassigned: UserProfile[] = [];
  for (const u of filtered) {
    const { idx, rank } = xepPhongBan(rolesList(u.roles));
    if (idx < PHONG_BAN.length) thung[idx].push({ u, rank });
    else unassigned.push(u);
  }
  const visibleGroups = [
    ...PHONG_BAN.map((pb, i) => ({
      id: pb.id,
      ten: pb.ten,
      icon: pb.icon,
      users: thung[i]
        .sort((a, b) => a.rank - b.rank || userName(a.u).localeCompare(userName(b.u), "vi"))
        .map((x) => x.u),
    })),
    {
      id: "chua",
      ten: "Chưa phân công",
      icon: UserRound,
      users: [...unassigned].sort((a, b) => userName(a).localeCompare(userName(b), "vi")),
    },
  ].filter((n) => n.users.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Người dùng</h1>
          <p className="text-muted-foreground">{ds.length} tài khoản · gom theo phòng ban &amp; cấp bậc</p>
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
        <SkeletonBang />
      ) : ds.length === 0 ? (
        <EmptyState
          icon={Users}
          tieuDe="Chưa có người dùng nào"
          moTa="Bấm “Tạo tài khoản” để thêm người dùng đầu tiên, rồi gán vai trò."
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
            visibleGroups.map((nhom) => {
              const Icon = nhom.icon;
              return (
                <section key={nhom.id} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    {nhom.ten}
                    <Nhan loai="phu">{nhom.users.length}</Nhan>
                  </h2>
                  <RecordTable
                    columns={cols}
                    rows={nhom.users}
                    getKey={(r) => r.id}
                    toMau="nguoi-dung"
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
              <ErrorSummary loi={createErrors} />
              <ChuThichBatBuoc />
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
                      t ? { ...t, username: e.target.value, usernameTuSua: true } : t
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
                  value={creating.matKhau}
                  onChange={(e) =>
                    setCreating((t) => (t ? { ...t, matKhau: e.target.value } : t))
                  }
                  placeholder="Mật khẩu"
                />
              </Field>
              <Field
                label="Vai trò"
                hint="Chọn một hoặc nhiều từ danh sách. VD Phó giám đốc kiêm Quản đốc xưởng Đông = thêm cả hai. Bỏ trống cũng được, gán sau."
              >
                <RolePicker
                  chon={creating.roles}
                  onDoi={(v) => setCreating((t) => (t ? { ...t, roles: v } : t))}
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
                  chon={editing.roles}
                  onDoi={(v) => setEditing((d) => (d ? { ...d, roles: v } : d))}
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
