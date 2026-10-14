// ============================================================
// Tên file: src/App.tsx
// Tên tiếng Việt tương đương: Chương trình chính & Điều hướng ứng dụng MES BSF1
// Description: Main Application Component & Router Setup
// ============================================================
// src/App.tsx
import { lazy, Suspense, useEffect } from "react";
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
import DangNhap from "@/features/auth";
import { NotFound } from "@/features/shared";
import AppShell, { KIT_NAV } from "@/features/shared/AppShell";
import { RowMarkProvider } from "@/features/shared/RowMarkProvider";
import { PAGE_GUIDES } from "@/features/shared/guideContent";
import { Toaster, applyDisplaySettings, ProcessingState, EmptyState } from "@/design-system";
import { Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setAuditOperator } from "@/lib/audit";
import { roleLabel } from "@/types";
import { allowedIds, homeFor } from "@/lib/nav-access";
import { LA_DEMO, setDemoMode } from "@/lib/demoMode";
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
const CanDoiScreen = lazy(() => import("@/features/balancing"));
const CatalogScreen = lazy(() => import("@/features/catalog"));
const UserManagementScreen = lazy(() => import("@/features/users"));
const AuditLogScreen = lazy(() => import("@/features/audit"));
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
  const isDemoDenied = LA_DEMO && auth.requiresLogin && !!auth.profile && !auth.isAdmin;
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
  const roles = auth.profile?.roles ?? [];
  // 2 giao diện bộ phận: vai trò bộ phận chỉ thấy nav của bộ phận đó (null = đầy đủ).
  const permittedIds = allowedIds(roles, auth.isAdmin);
  const base = permittedIds
    ? KIT_NAV.filter((n) => permittedIds.has(n.id))
    : auth.isAdmin
      ? KIT_NAV
      : KIT_NAV.filter((n) => n.id !== "users" && n.id !== "audit");
  const items = base;

  // Vào path ngoài bộ phận (gõ URL / link cũ) ⇒ đưa về trang chủ bộ phận.
  if (permittedIds && seg && !permittedIds.has(seg)) {
    return <Navigate to={`/${homeFor(roles)}`} replace />;
  }
  const current = KIT_NAV.find((n) => n.id === seg);
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
      role={roleLabel(auth.profile?.roles ?? [])}
      ca="Ca A"
      notificationCount={3}
      onLogout={
        auth.requiresLogin && auth.session ? auth.signOut : undefined
      }
      items={items}
    >
      {/* Tô màu dòng "đã dò" — một nguồn row_marks cho mọi bảng (prop `rowMarkKey`). */}
      <RowMarkProvider username={username ?? ""}>
        <DemoModeBanner />
        <DemoPackLoader />
        <Suspense fallback={<ProcessingState text="Đang mở màn hình…" />}>
          <Outlet />
        </Suspense>
      </RowMarkProvider>
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
        <DangNhap login={auth.signIn} />
        <Toaster position="bottom-center" richColors closeButton />
      </>
    );
  }

  return (
    <>
      <HashRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<Navigate to={`/${homeFor(roles)}`} replace />} />

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
            <Route path="/balancing" element={<CanDoiScreen />} />
            <Route path="/balancing/:periodId" element={<CanDoiScreen />} />
            <Route path="/catalog" element={<CatalogScreen />} />
            <Route path="/wip" element={<WipProductionScreen />} />
            <Route path="/packaging" element={<PackagingScreen />} />
            <Route path="/qc" element={<QcChecklistScreen />} />
            <Route path="/qr" element={<LotScanScreen />} />
            <Route path="/reconciliation" element={<ReconciliationScreen />} />
            <Route
              path="/users"
              element={
                auth.isAdmin && LA_DEMO ? (
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
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
