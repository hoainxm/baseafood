// ============================================================
// Tên file: src/App.tsx
// Tên tiếng Việt tương đương: Chương trình chính & Điều hướng ứng dụng MES BSF1
// Description: Main Application Component & Router Setup
// ============================================================
// src/App.tsx
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { PageTourProvider } from "@/features/shared/PageTourProvider";
import { PermissionProvider } from "@/features/shared/PermissionProvider";
import { PAGE_GUIDES } from "@/features/shared/guideContent";
import { Toaster, applyDisplaySettings, ProcessingState, EmptyState, notify } from "@/design-system";
import { KeyRound, ShieldOff, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setAuditOperator } from "@/lib/audit";
import { useAppRoles, useRolePermissions, useTaskAssignments, useUserPermissions } from "@/lib/catalogRepo";
import { countMyOpenAssignments } from "@/lib/myTasks";
import { todayIso } from "@/design-system";
import { homeFor } from "@/lib/nav-access";
import {
  OFFLINE_PERMISSIONS,
  PERMISSION_NAV_IDS,
  buildRolePermissions,
  buildUserOverrides,
  homeRoutesFromAppRoles,
  isPermissionLoading,
  resolvePermissions,
  roleNames,
  scopeContextFor,
  visibleNavIds,
  EMPTY_SCOPE_CONTEXT,
} from "@/lib/permissions";
import { IS_DEMO, setDemoMode } from "@/lib/demoMode";
import { setWriteGuard } from "@/lib/repo";
import { checkTableWrite } from "@/lib/writePermissions";
import { DemoModeBanner, DemoModeHeaderButton, DemoPackLoader } from "@/features/shared/DemoMode";
import { LEGACY_PATHS, normalizeCatalogTab } from "@/lib/legacyUrls";

// Việc của tôi — việc cần làm, hạn, giao việc
const MyTasksScreen = lazy(() => import("@/features/my-tasks"));
// Tài liệu công ty — quy trình, biểu mẫu, chứng nhận, hồ sơ năng lực (mig 0072)
const DocumentsScreen = lazy(() => import("@/features/documents"));
const ExportPlanningScreen = lazy(() => import("@/features/export-planning"));
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

/** Chờ bảng quyền tối đa bao lâu trước khi vẽ khung theo ma trận mặc định (mạng treo). */
const PERMISSION_WAIT_MS = 8000;

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
  const [userPermissionRows, , { status: userPermissionStatus }] = useUserPermissions();
  const isMatrixLoaded = appRoleStatus !== "loading" && rolePermissionStatus !== "loading";
  // Vẽ khung (sidebar) CHỈ khi quyền đã chốt: đang nạp dở mà vẽ thì dùng tạm ma trận mặc
  // định ⇒ vai trò đã chỉnh ở /roles hoặc người bị chặn riêng thấy mục nav thừa chớp lên rồi
  // mới ẩn (lỗi báo 2026-10-28). Admin không đọc ma trận ⇒ không phải chờ. Lỗi mạng ⇒ bảng
  // về "error" (dùng bản sao dưới máy) ⇒ hết chờ; treo quá 8 giây ⇒ vẽ theo cách cũ.
  const isPermissionPending = isPermissionLoading({
    requiresLogin: auth.requiresLogin,
    hasProfile: !!profile,
    isAdmin: auth.isAdmin,
    tableStatuses: [appRoleStatus, rolePermissionStatus, userPermissionStatus],
  });
  const [isPermissionWaitOver, setIsPermissionWaitOver] = useState(false);
  useEffect(() => {
    if (!isPermissionPending) return;
    const t = window.setTimeout(() => setIsPermissionWaitOver(true), PERMISSION_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [isPermissionPending]);
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
  // Chốt quyền GHI (lớp 3): chỉ khi đăng nhập máy chủ + đã có hồ sơ. Chạy localStorage /
  // đọc hồ sơ lỗi ⇒ không chốt (giữ hành vi cũ, máy chủ vẫn chặn bằng RLS).
  const isWriteGuarded = auth.requiresLogin && !!profile;
  // Phạm vi dòng (Đợt 5): xưởng của quản đốc + tên ở cột "người ghi".
  const scopeContext = useMemo(
    () => (profile ? scopeContextFor(profile.roles, profile.fullName, profile.username) : EMPTY_SCOPE_CONTEXT),
    [profile]
  );
  useEffect(() => {
    if (!isWriteGuarded) {
      setWriteGuard(null);
      return;
    }
    setWriteGuard((table, changes) => {
      const denial = checkTableWrite(permissions, table, changes, scopeContext);
      if (!denial) return true;
      console.warn("[permissions] Chặn ghi", denial.table, denial.resource, denial.action);
      notify.error(denial.message);
      return false;
    });
    return () => setWriteGuard(null);
  }, [isWriteGuarded, permissions, scopeContext]);

  // Số việc đang được giao cho tôi — chuông header + số trên mục "Việc của tôi". CHỈ đọc
  // bảng giao việc (một bảng nhỏ); danh sách đầy đủ (gồm việc máy phát hiện) tính ở màn.
  const [taskAssignments] = useTaskAssignments();
  const myOpenTasks = countMyOpenAssignments(taskAssignments, profile?.id ?? "local", todayIso());

  if (isPermissionPending && !isPermissionWaitOver) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ProcessingState text="Đang tải quyền truy cập…" />
      </div>
    );
  }

  const roles = profile?.roles ?? [];
  const visible = visibleNavIds(permissions);
  const items = KIT_NAV.filter((n) => visible.has(n.id)).map((n) => (n.id === "my-tasks" ? { ...n, badge: myOpenTasks.open } : n));
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
    // Hướng dẫn từng bước của trang đang mở (trang tự khai bằng usePageTour) — ba-spec 43.
    <PageTourProvider>
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
      notificationCount={hasNoAccess || !visible.has("my-tasks") ? undefined : myOpenTasks.open}
      onOpenNotifications={() => navigate("/my-tasks")}
      onLogout={
        auth.requiresLogin && auth.session ? auth.signOut : undefined
      }
      username={profile?.username}
      onChangePassword={auth.requiresLogin && auth.session ? auth.changePassword : undefined}
      onOpenAdmin={auth.isAdmin ? () => navigate("/admin") : undefined}
      items={hasNoAccess ? [] : items}
      // Chế độ demo: admin bật (hoặc máy không đăng nhập — sandbox); đang demo thì ai cũng thấy để thoát.
      headerActions={auth.isAdmin || !auth.requiresLogin || IS_DEMO ? <DemoModeHeaderButton /> : undefined}
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
        <PermissionProvider permissions={permissions} scopeContext={scopeContext}>
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
    </PageTourProvider>
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

            <Route path="/my-tasks" element={<MyTasksScreen />} />
            <Route path="/documents" element={<DocumentsScreen />} />
            <Route path="/planning-export" element={<ExportPlanningScreen />} />

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
