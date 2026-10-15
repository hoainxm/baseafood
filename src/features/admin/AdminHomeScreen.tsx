// ============================================================
// Tên file: src/features/admin/AdminHomeScreen.tsx
// Tên tiếng Việt: Tổng quan quản trị (chỉ admin)
// Description: Admin landing page — account/role health + entry points to admin tasks
// ============================================================
// Trang riêng của quản trị viên (yêu cầu 2026-10-15): nhìn một lượt tình trạng
// tài khoản + vai trò, rồi vào đúng việc. Không ghi dữ liệu.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  HorizontalScroll,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  type StatCardData,
} from "@/design-system";
import { useAppRoles, useRolePermissions, useUserPermissions, useUserProfiles } from "@/lib/catalogRepo";
import {
  PERMISSION_RESOURCES,
  buildRolePermissions,
  listRoleOptions,
  resolvePermissions,
  visibleNavIds,
} from "@/lib/permissions";
import type { Role } from "@/types";
import { ArrowRight, History, KeyRound, ShieldAlert, ShieldCheck, Users, UserX, type LucideIcon } from "lucide-react";

interface AdminLink {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const LINKS: AdminLink[] = [
  {
    to: "/users",
    icon: Users,
    title: "Người dùng",
    description: "Tạo tài khoản, sửa họ tên, gán một hoặc nhiều vai trò cho từng người.",
  },
  {
    to: "/roles",
    icon: KeyRound,
    title: "Vai trò & quyền",
    description: "Tick quyền xem · thêm · sửa · xóa · chốt · mở lại… của từng vai trò ở từng màn; chỉnh riêng cho một người.",
  },
  {
    to: "/audit",
    icon: History,
    title: "Nhật ký thao tác",
    description: "Ai sửa gì, lúc nào, giá trị trước và sau — kể cả các lần đổi quyền.",
  },
];

const SCREEN_COUNT = new Set(
  PERMISSION_RESOURCES.filter((r) => !r.adminOnly && r.navId).map((r) => r.navId)
).size;

export default function AdminHomeScreen() {
  const navigate = useNavigate();
  const [users] = useUserProfiles();
  const [appRoles] = useAppRoles();
  const [rolePermissionRows] = useRolePermissions();
  const [userPermissionRows] = useUserPermissions();

  const matrix = useMemo(() => buildRolePermissions(appRoles, rolePermissionRows), [appRoles, rolePermissionRows]);
  const roleOptions = listRoleOptions(appRoles);
  const customized = new Set(appRoles.map((r) => r.id));
  const unassigned = users.filter((u) => u.roles.length === 0);
  const withOverrides = new Set(userPermissionRows.map((r) => r.userId));

  const rows = roleOptions.map((o) => {
    const holders = users.filter((u) => u.roles.includes(o.value as Role));
    const isAdminRole = o.value === "admin";
    const perms = resolvePermissions({ roles: [o.value as Role], isAdmin: isAdminRole, rolePermissions: matrix });
    const screens = [...visibleNavIds(perms)].filter((id) => !["admin", "users", "roles", "audit"].includes(id)).length;
    return { ...o, holders, screens, isAdminRole, isCustomized: customized.has(o.value) };
  });

  const cards: StatCardData[] = [
    { label: "Tài khoản", value: users.length, numeric: true, icon: Users, onSelect: () => navigate("/users"), selectHint: "Mở danh sách người dùng" },
    {
      label: "Chưa gán vai trò",
      value: unassigned.length,
      numeric: true,
      icon: UserX,
      color: unassigned.length ? "warning" : "success",
      subtext: unassigned.length ? "Không mở được màn nào — gán vai trò" : "Mọi tài khoản đã có vai trò",
      onSelect: () => navigate("/users"),
      selectHint: "Mở danh sách người dùng để gán vai trò",
    },
    {
      label: "Vai trò",
      value: roleOptions.length,
      numeric: true,
      icon: ShieldCheck,
      subtext: `${customized.size} vai trò đã chỉnh / tự tạo`,
      onSelect: () => navigate("/roles"),
      selectHint: "Mở ma trận vai trò & quyền",
    },
    {
      label: "Người có quyền riêng",
      value: withOverrides.size,
      numeric: true,
      icon: ShieldAlert,
      subtext: "Cho thêm hoặc chặn riêng ngoài vai trò",
      onSelect: () => navigate("/roles?tab=users"),
      selectHint: "Mở quyền theo từng người",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan quản trị</h1>
        <p className="text-muted-foreground">Tình trạng tài khoản và phân quyền — chỉ quản trị viên thấy trang này.</p>
      </div>

      <StatCardGrid cards={cards} />

      <div className="grid gap-4 md:grid-cols-3">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Card key={l.to}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-icon text-muted-foreground" aria-hidden />
                  {l.title}
                </CardTitle>
                <CardDescription>{l.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate(l.to)} title={`Mở màn ${l.title}.`}>
                  Mở
                  <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Vai trò đang dùng</h2>
        <HorizontalScroll className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vai trò</TableHead>
                <TableHead>Quyền</TableHead>
                <TableHead className="text-right">Màn thấy được</TableHead>
                <TableHead>Người giữ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.value}
                  className="cursor-pointer"
                  title="Mở ma trận quyền của vai trò này"
                  onClick={() => navigate(`/roles?role=${encodeURIComponent(r.value)}`)}
                >
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell>
                    {r.isAdminRole ? (
                      <Tag variant="source">Toàn quyền</Tag>
                    ) : r.isCustomized ? (
                      <Tag variant="warning">{r.isSystem ? "Đã chỉnh" : "Tự tạo"}</Tag>
                    ) : (
                      <Tag variant="muted">Mặc định</Tag>
                    )}
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {r.screens}/{SCREEN_COUNT}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.holders.length ? r.holders.map((u) => u.fullName || u.username).join(", ") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </HorizontalScroll>
      </section>
    </div>
  );
}
