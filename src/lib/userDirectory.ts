// ============================================================
// Tên file: src/lib/userDirectory.ts
// Tên tiếng Việt tương đương: Gom người dùng theo phòng ban & cấp bậc
// Description: Pure rules grouping user accounts by department and sorting by rank (head → deputy → staff)
// ============================================================
import type { AppRole, Role, UserProfile } from "@/types";
import { DEPARTMENTS, SYSTEM_ROLE_DEPARTMENTS, isDepartment, type Department } from "@/lib/documents";

/**
 * QUY TẮC (2026-10-29, docs/app-map/05 § Màn Người dùng):
 * - Phòng ban có MỘT nguồn: `DEPARTMENTS` + `SYSTEM_ROLE_DEPARTMENTS` (lib/documents.ts),
 *   vai trò tự tạo lấy `app_roles.department` (chọn ở "Vai trò & quyền"). Màn Người dùng
 *   KHÔNG tự khai danh sách phòng riêng nữa.
 * - Nhóm hiển thị (`USER_GROUPS`) gom một hay nhiều phòng (3 xưởng ⇒ "Phân xưởng sản xuất").
 *   Thêm phòng mới vào `DEPARTMENTS` ⇒ PHẢI xếp nó vào đúng một nhóm (test chặn).
 * - Cấp bậc: 0 Trưởng (Giám đốc, Trưởng phòng, Kế toán trưởng, Quản đốc) → 1 Phó →
 *   2 Nhân viên. Vai trò hệ thống khai ở `SYSTEM_ROLE_LEVELS` (thiếu ⇒ lỗi biên dịch);
 *   vai trò tự tạo suy từ tên: "Phó …" = Phó; "Trưởng …", "Giám đốc …", "Quản đốc …",
 *   "… trưởng" = Trưởng; còn lại = Nhân viên.
 * - Một người nhiều vai trò ⇒ nằm ở nhóm XẾP TRƯỚC trong `USER_GROUPS` (Ban giám đốc
 *   trước), cấp trong nhóm = cấp cao nhất của các vai trò thuộc nhóm đó.
 * - Trong nhóm: Trưởng → Phó → Nhân viên, cùng cấp theo thứ tự vai trò rồi theo tên.
 */

export type RoleLevel = 0 | 1 | 2;
export const ROLE_LEVEL_LABELS: Record<RoleLevel, string> = { 0: "Trưởng", 1: "Phó", 2: "Nhân viên" };

/** Cấp bậc vai trò hệ thống — `Record<Role, …>` ⇒ thêm vai trò mới mà quên khai là lỗi biên dịch. */
export const SYSTEM_ROLE_LEVELS: Record<Role, RoleLevel> = {
  admin: 0,
  director: 0,
  "vice-director": 1,
  "planning-head": 0,
  "planning-deputy": 1,
  planner: 2,
  "chief-accountant": 0,
  accountant: 2,
  "manager-dong": 0,
  "manager-ca": 0,
  "manager-kho": 0,
  "vice-manager": 1,
  "team-leader": 2,
  "warehouse-keeper": 2,
};

/** Nhóm hiển thị ở màn Người dùng — thứ tự = thứ tự hiện và thứ tự ưu tiên khi một người ở nhiều nhóm. */
export const USER_GROUPS: readonly { id: string; name: string; departments: readonly Department[] }[] = [
  { id: "board", name: "Ban giám đốc", departments: ["board"] },
  { id: "planning", name: "Phòng Kế hoạch", departments: ["planning"] },
  { id: "accounting", name: "Phòng Kế toán", departments: ["accounting"] },
  { id: "production", name: "Phân xưởng sản xuất", departments: ["production-frozen", "production-fish", "production-dried"] },
  { id: "warehouse", name: "Kho & nhập hàng", departments: ["purchasing", "warehouse"] },
  { id: "quality", name: "QC – Kỹ thuật", departments: ["quality"] },
  { id: "admin-hr", name: "Hành chính – Nhân sự", departments: ["admin-hr"] },
];

/** Nhóm đặc biệt: admin (không phải phòng ban) · vai trò tự tạo chưa chọn phòng · chưa gán vai trò. */
export const SYSTEM_ADMIN_GROUP = { id: "system-admin", name: "Quản trị hệ thống" } as const;
export const NO_DEPARTMENT_GROUP = { id: "no-department", name: "Vai trò tự tạo chưa chọn phòng" } as const;
export const UNASSIGNED_GROUP = { id: "unassigned", name: "Chưa phân công" } as const;

const ROLE_ORDER = new Map<string, number>(Object.keys(SYSTEM_ROLE_LEVELS).map((r, i) => [r, i]));

/** Cấp bậc của một vai trò (hệ thống: bảng khai; tự tạo: suy từ tên). */
export function roleLevel(role: string, appRoles: readonly AppRole[] = []): RoleLevel {
  if (role in SYSTEM_ROLE_LEVELS) return SYSTEM_ROLE_LEVELS[role as Role];
  const name = (appRoles.find((a) => a.id === role)?.name ?? "").trim().toLocaleLowerCase("vi");
  if (/^phó\s/.test(name)) return 1;
  if (/^(trưởng|giám đốc|quản đốc)\s/.test(name) || /\strưởng$/.test(name)) return 0;
  return 2;
}

/** Id nhóm hiển thị của MỘT vai trò; "" = không thuộc phòng nào (admin / tự tạo chưa chọn phòng). */
export function groupOfRole(role: string, appRoles: readonly AppRole[] = []): string {
  if (role === "admin") return SYSTEM_ADMIN_GROUP.id;
  const custom = appRoles.find((a) => a.id === role)?.department ?? "";
  const departments: readonly string[] = isDepartment(custom) ? [custom] : (SYSTEM_ROLE_DEPARTMENTS[role as Role] ?? []);
  const group = USER_GROUPS.find((g) => departments.some((d) => (g.departments as readonly string[]).includes(d)));
  return group?.id ?? "";
}

/** Khóa sắp vai trò: nhóm → cấp → thứ tự vai trò hệ thống. */
function roleSortKey(role: string, appRoles: readonly AppRole[]): [number, number, number] {
  const g = groupOfRole(role, appRoles);
  const gi = g === SYSTEM_ADMIN_GROUP.id ? USER_GROUPS.length : USER_GROUPS.findIndex((x) => x.id === g);
  return [gi < 0 ? USER_GROUPS.length + 1 : gi, roleLevel(role, appRoles), ROLE_ORDER.get(role) ?? 999];
}

const compareKeys = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

/** Vai trò của một người sắp theo nhóm rồi cấp — chức vụ chính hiện trước. */
export function sortRolesByRank(roles: readonly Role[], appRoles: readonly AppRole[] = []): Role[] {
  return [...roles].sort((a, b) => compareKeys(roleSortKey(a, appRoles), roleSortKey(b, appRoles)));
}

export interface UserGroupView {
  id: string;
  name: string;
  users: UserProfile[];
}

/** Gom + sắp người dùng (nhóm trống bị bỏ). */
export function groupUsersByDepartment(users: readonly UserProfile[], appRoles: readonly AppRole[] = []): UserGroupView[] {
  const buckets = new Map<string, { u: UserProfile; key: number[] }[]>();
  const nameOf = (u: UserProfile) => u.fullName || u.username || "";
  for (const u of users) {
    const ranked = sortRolesByRank(u.roles, appRoles);
    let groupId: string = UNASSIGNED_GROUP.id;
    let key = [0, 0];
    if (ranked.length) {
      const top = ranked[0];
      groupId = groupOfRole(top, appRoles) || NO_DEPARTMENT_GROUP.id;
      const k = roleSortKey(top, appRoles);
      key = [k[1], k[2]];
    }
    const list = buckets.get(groupId) ?? [];
    list.push({ u, key });
    buckets.set(groupId, list);
  }
  const order = [
    ...USER_GROUPS.map((g) => ({ id: g.id, name: g.name })),
    SYSTEM_ADMIN_GROUP,
    NO_DEPARTMENT_GROUP,
    UNASSIGNED_GROUP,
  ];
  return order
    .map((g) => ({
      id: g.id,
      name: g.name,
      users: (buckets.get(g.id) ?? [])
        .sort((a, b) => compareKeys(a.key, b.key) || nameOf(a.u).localeCompare(nameOf(b.u), "vi"))
        .map((x) => x.u),
    }))
    .filter((g) => g.users.length > 0);
}

/** Tên nhóm hiển thị của một vai trò (dòng phụ trong ô chọn vai trò). */
export function groupNameOfRole(role: string, appRoles: readonly AppRole[] = []): string {
  const id = groupOfRole(role, appRoles);
  if (id === SYSTEM_ADMIN_GROUP.id) return SYSTEM_ADMIN_GROUP.name;
  return USER_GROUPS.find((g) => g.id === id)?.name ?? NO_DEPARTMENT_GROUP.name;
}

/** Mọi phòng ban đều có nhóm hiển thị — dùng trong test. */
export const ungroupedDepartments = (): string[] =>
  DEPARTMENTS.map((d) => d.id).filter((id) => !USER_GROUPS.some((g) => (g.departments as readonly string[]).includes(id)));
