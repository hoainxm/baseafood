// ============================================================
// Tên file: src/App.tsx
// Tên tiếng Việt tương đương: Chương trình chính & Điều hướng ứng dụng MES BSF1
// Description: Main Application Component & Router Setup
// ============================================================
// src/App.tsx
import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import LoginScreen from "@/features/auth";
import { NotFound } from "@/features/shared";
import AppShell, { KIT_NAV } from "@/features/shared/AppShell";
import { RowMarkProvider } from "@/features/shared/RowMarkProvider";
import { PermissionProvider } from "@/features/shared/PermissionProvider";
import { PAGE_GUIDES } from "@/features/shared/guideContent";
import { Toaster, applyDisplaySettings, ProcessingState, EmptyState } from "@/design-system";
import { KeyRound, ShieldOff, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setAuditOperator } from "@/lib/audit";
import { useAppRoles, useRolePermissions, useUserPermissions } from "@/lib/catalogRepo";
import { homeFor } from "@/lib/nav-access";
import {
  OFFLINE_PERMISSIONS,
  PERMISSION_NAV_IDS,
  buildRolePermissions,
  buildUserOverrides,
  homeRoutesFromAppRoles,
  resolvePermissions,
  roleNames,
  visibleNavIds,
} from "@/lib/permissions";
import { IS_DEMO, setDemoMode } from "@/lib/demoMode";
import { DemoModeBanner, DemoPackLoader } from "@/features/shared/DemoMode";
import { LEGACY_PATHS, normalizeCatalogTab } from "@/lib/legacyUrls";

// Tổng quan — dòng chảy số liệu
const DashboardScreen = lazy(() => import("@/features/dashboard/DashboardScreen"));

// Màn nghiệp vụ gốc
const MaterialImportScreen = lazy(() => import("@/features/imports"));
const SalesScreen = lazy(() => import("@/features/sales"));
const ReserveWarehouseScreen = lazy(() => import("@/features/warehouse"));
const InOutStockReportScreen = lazy(() => import("@/features/reports/NxtReportScreen"));
const MaterialStockScreen = lazy(() => import("@/features/reports/MaterialNxtScreen"));
const WarehouseNxtReportScreen = lazy(() => import("@/features/reports/WarehouseNxtScreen"));
const MonthlyStockLedgerScreen = lazy(() => import("@/features/monthly-stock")); // Sổ kho theo tháng, route /monthly-stock
const FinishedGoodReportScreen = lazy(() => import("@/features/reports/DailyProductionReport"));
const OrderExportReportScreen = lazy(() => import("@/features/reports/OrderExportReport"));
const SalesOrderScreen = lazy(() => import("@/features/orders"));
const BalancingScreen = lazy(() => import("@/features/balancing"));
const CatalogScreen = lazy(() => import("@/features/catalog"));
const UserManagementScreen = lazy(() => import("@/features/users"));
const AuditLogScreen = lazy(() => import("@/features/audit"));
const AdminHomeScreen = lazy(() => import("@/features/admin/AdminHomeScreen")); // Tổng quan quản trị, route /admin
const RolePermissionsScreen = lazy(() => import("@/features/admin/RolePermissionsScreen")); // Vai trò & quyền, route /roles
const WipProductionScreen = lazy(() => import("@/features/production")); // Sản xuất BTP (WIP), route /wip
const PackagingScreen = lazy(() => import("@/features/packaging")); // Đóng gói BTP → TP, route /packaging
const QcChecklistScreen = lazy(() => import("@/features/quality-check")); // QC checklist chấm điểm, route /qc
const LotScanScreen = lazy(() => import("@/features/qr")); // Quét/tra lô theo QR, route /qr
const ReconciliationScreen = lazy(() => import("@/features/reconciliation")); // Đối soát HĐĐT ⇄ phần mềm kế toán, route /reconciliation (cũ /doi-soat
const KitPage = lazy(() => import("@/design-system/kit/KitPage"));

/**
 * Layout dùng chung: khung `AppShell` điều khiển bằng react-router. `id` mục nav
 * = path, nên bấm sidebar/bottom-tab là điều hướng. Nạp lại giao diện theo tài
 * khoản khi đổi người đăng nhập.
 */
function ShellLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const username = auth.profile?.username;

  useEffect(() => {
    applyDisplaySettings(username);
  }, [username]);

  // Chế độ demo CHỈ admin bật. Cờ nằm theo máy (localStorage) ⇒ người khác đăng nhập
  // trên máy đó thì tự tắt, về số thật (không ai thấy số demo mà tưởng số xưởng).
  const isDemoDenied = IS_DEMO && auth.requiresLogin && !!auth.profile && !auth.isAdmin;
  useEffect(() => {
    if (isDemoDenied) setDemoMode(false);
  }, [isDemoDenied]);

  // Ai đang thao tác — cho nhật ký (audit) gắn đúng người.
  useEffect(() => {
    setAuditOperator(
      auth.profile
        ? { id: auth.profile.id, username: auth.profile.username }
        : null
    );
  }, [auth.profile]);

  const seg = location.pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const profile = auth.profile;
  // Quyền thực (lib/permissions.ts, spec docs/spec/role-permissions.md). Chạy
  // localStorage không đăng nhập, hoặc đọc hồ sơ LỖI (rớt mạng) ⇒ giữ hành vi cũ:
  // mọi màn trừ màn admin (máy chủ vẫn chặn bằng RLS).
  // Ma trận admin chỉnh (mig 0062). Chỉ tin khi CẢ HAI bảng đã nạp xong (hoặc lỗi ⇒
  // bản sao dưới máy): đang nạp dở mà dùng thì vai trò đã chỉnh có thể tạm thành
  // "không quyền" và bị đá về trang chủ. Bảng rỗng ⇒ ma trận mặc định (Đợt 1).
  const [appRoles, , { status: appRoleStatus }] = useAppRoles();
  const [rolePermissionRows, , { status: rolePermissionStatus }] = useRolePermissions();
  const [userPermissionRows] = useUserPermissions();
  const isMatrixLoaded = appRoleStatus !== "loading" && rolePermissionStatus !== "loading";
  const matrix = useMemo(
    () => (isMatrixLoaded ? buildRolePermissions(appRoles, rolePermissionRows) : undefined),
    [isMatrixLoaded, appRoles, rolePermissionRows]
  );
  const permissions = useMemo(
    () =>
      auth.requiresLogin && profile
        ? resolvePermissions({
            roles: profile.roles,
            isAdmin: auth.isAdmin,
            rolePermissions: matrix,
            overrides: buildUserOverrides(profile.id, userPermissionRows),
          })
        : OFFLINE_PERMISSIONS,
    [auth.requiresLogin, auth.isAdmin, profile, matrix, userPermissionRows]
  );
  const roles = profile?.roles ?? [];
  const visible = visibleNavIds(permissions);
  const items = KIT_NAV.filter((n) => visible.has(n.id));
  const home = homeFor(roles, permissions, homeRoutesFromAppRoles(appRoles));
  // Đã nạp hồ sơ mà chưa được gán vai trò (hoặc bị chặn hết) ⇒ màn báo, không nav.
  const hasNoAccess = !permissions.isAdmin && (!permissions.hasRoles || home === null);

  // Vào màn không có quyền xem (gõ URL / link cũ) ⇒ về trang chủ của người đó.
  if (!hasNoAccess && PERMISSION_NAV_IDS.includes(seg) && !visible.has(seg)) {
    return <Navigate to={`/${home}`} replace />;
  }
  const current = hasNoAccess ? undefined : KIT_NAV.find((n) => n.id === seg);
  const guide = PAGE_GUIDES[seg];

  return (
    <AppShell
      active={seg}
      activeTab={seg === "catalog" ? normalizeCatalogTab(searchParams.get("tab")) : undefined}
      onSelect={(id) => navigate(`/${id}`)}
      title={current?.label ?? ""}
      account={username}
      guide={
        guide
          ? { title: guide.title, description: guide.description, content: guide.content }
          : null
      }
      displayName={
        auth.profile?.fullName || auth.profile?.username || "Người dùng"
      }
      role={roleNames(auth.profile?.roles ?? [], appRoles)}
      shift="Ca A"
      notificationCount={3}
      onLogout={
        auth.requiresLogin && auth.session ? auth.signOut : undefined
      }
      username={profile?.username}
      onChangePassword={auth.requiresLogin && auth.session ? auth.changePassword : undefined}
      onOpenAdmin={auth.isAdmin ? () => navigate("/admin") : undefined}
      items={hasNoAccess ? [] : items}
    >
      {hasNoAccess ? (
        <EmptyState
          icon={ShieldOff}
          title="Chưa được cấp quyền"
          description={
            auth.profileIssue === "username-taken"
              ? `Tài khoản bạn vừa đăng nhập chưa có hồ sơ, và tên đăng nhập “${profile?.username ?? ""}” đang gắn với một tài khoản khác. Báo quản trị viên: vào Người dùng → mục “Tài khoản đăng nhập chưa có hồ sơ” để gắn đúng hồ sơ cho bạn.`
              : auth.profileIssue === "create-failed"
                ? "Tài khoản của bạn chưa có hồ sơ và hệ thống chưa tạo được (lỗi máy chủ). Thử tải lại trang; vẫn vậy thì báo quản trị viên."
                : "Tài khoản của bạn chưa được gán vai trò (hoặc vai trò chưa có quyền xem màn nào) nên chưa mở được màn nào. Báo quản trị viên gán vai trò, rồi đăng nhập lại."
          }
        />
      ) : (
        <PermissionProvider permissions={permissions}>
          {/* Tô màu dòng "đã dò" — một nguồn row_marks cho mọi bảng (prop `rowMarkKey`). */}
          <RowMarkProvider username={username ?? ""}>
            <DemoModeBanner />
            <DemoPackLoader />
            <Suspense fallback={<ProcessingState text="Đang mở màn hình…" />}>
              <Outlet />
            </Suspense>
          </RowMarkProvider>
        </PermissionProvider>
      )}
    </AppShell>
  );
}

/** Đường dẫn tiếng Việt cũ → đường dẫn mới, GIỮ query (?tab=…, ?lo=…) để link cũ mở đúng chỗ. */
function LegacyPathRedirect({ from }: { from: string }) {
  const { search } = useLocation();
  return <Navigate to={`/${LEGACY_PATHS[from]}${search}`} replace />;
}

export default function App() {
  const auth = useAuth();
  const roles = auth.profile?.roles ?? [];

  // Đang lấy phiên đăng nhập từ máy chủ → tránh nháy màn login.
  if (auth.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ProcessingState text="Đang kết nối…" />
      </div>
    );
  }

  // Đã cấu hình máy chủ mà chưa đăng nhập → chặn bằng màn đăng nhập.
  if (auth.requiresLogin && !auth.session) {
    return (
      <>
        <LoginScreen login={auth.signIn} />
        <Toaster />
      </>
    );
  }

  // Chờ hồ sơ (vai trò) — kẻo nháy màn "Chưa được cấp quyền" hay về nhầm trang chủ.
  if (auth.isProfileLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ProcessingState text="Đang tải quyền truy cập…" />
      </div>
    );
  }

  return (
    <>
      <HashRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<Navigate to={`/${homeFor(roles) ?? "dashboard"}`} replace />} />

            {/* MES */}
            <Route path="/dashboard" element={<DashboardScreen />} />
            {/* 5 màn DEMO dữ liệu mẫu đã GỠ (2026-10-12, spec che-do-demo) — link cũ
                chuyển sang màn THẬT tương ứng. Trình diễn ⇒ chế độ demo, không màn mẫu. */}
            <Route path="/production" element={<Navigate to="/wip" replace />} />
            <Route path="/quality" element={<Navigate to="/qc" replace />} />
            <Route path="/cold-storage" element={<Navigate to="/warehouse" replace />} />
            <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
            <Route path="/traceability" element={<Navigate to="/qr" replace />} />

            {/* Đường dẫn tiếng Việt CŨ (trước 2026-10-13) — giữ vĩnh viễn: bookmark, link đã gửi Zalo. */}
            {Object.keys(LEGACY_PATHS).map((old) => (
              <Route key={old} path={`/${old}`} element={<LegacyPathRedirect from={old} />} />
            ))}

            {/* Nghiệp vụ gốc */}
            <Route path="/imports" element={<MaterialImportScreen />} />
            <Route path="/sales" element={<SalesScreen />} />
            <Route path="/warehouse" element={<ReserveWarehouseScreen />} />
            <Route path="/nxt" element={<InOutStockReportScreen />} />
            <Route path="/nxt-material" element={<MaterialStockScreen />} />
            <Route path="/nxt-warehouse" element={<WarehouseNxtReportScreen />} />
            <Route path="/monthly-stock" element={<MonthlyStockLedgerScreen />} />
            <Route path="/production-report" element={<FinishedGoodReportScreen />} />
            <Route path="/export-report" element={<OrderExportReportScreen />} />
            <Route path="/orders" element={<SalesOrderScreen />} />
            <Route path="/balancing" element={<BalancingScreen />} />
            <Route path="/balancing/:periodId" element={<BalancingScreen />} />
            <Route path="/catalog" element={<CatalogScreen />} />
            <Route path="/wip" element={<WipProductionScreen />} />
            <Route path="/packaging" element={<PackagingScreen />} />
            <Route path="/qc" element={<QcChecklistScreen />} />
            <Route path="/qr" element={<LotScanScreen />} />
            <Route path="/reconciliation" element={<ReconciliationScreen />} />
            <Route
              path="/users"
              element={
                auth.isAdmin && IS_DEMO ? (
                  // Tài khoản + vai trò là THẬT (không thuộc bộ demo) — sửa ở đây dễ tưởng
                  // đang sửa demo. Bắt thoát demo trước.
                  <EmptyState
                    icon={Users}
                    title="Đang ở chế độ demo"
                    description="Người dùng và vai trò là tài khoản thật, không thuộc bộ demo. Thoát demo (nút trên dải vàng) để quản lý người dùng."
                  />
                ) : auth.isAdmin ? (
                  <UserManagementScreen createAccount={auth.createAccount} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={auth.isAdmin ? <AdminHomeScreen /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/roles"
              element={
                auth.isAdmin && IS_DEMO ? (
                  // Quyền là cấu hình THẬT, không thuộc bộ demo — như /users.
                  <EmptyState
                    icon={KeyRound}
                    title="Đang ở chế độ demo"
                    description="Vai trò và quyền là cấu hình thật, không thuộc bộ demo. Thoát demo (nút trên dải vàng) để chỉnh quyền."
                  />
                ) : auth.isAdmin ? (
                  <RolePermissionsScreen />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/audit"
              element={
                auth.isAdmin ? <AuditLogScreen /> : <Navigate to="/dashboard" replace />
              }
            />
            <Route path="/kit" element={<KitPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
      <Toaster />
    </>
  );
}
