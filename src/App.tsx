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
import { ToMauProvider } from "@/features/shared/ToMauProvider";
import { HUONG_DAN } from "@/features/shared/guideContent";
import { Toaster, apDungCaiDatHienThi, DangXuLy, EmptyState } from "@/design-system";
import { Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { datNguoiThaoTac } from "@/lib/audit";
import { roleLabel } from "@/types";
import { allowedIds, homeFor } from "@/lib/nav-access";
import { LA_DEMO, datCheDo } from "@/lib/cheDo";
import { DaiDemo, NapGoiDemo } from "@/features/shared/CheDoDemo";

// Tổng quan — dòng chảy số liệu
const DashboardScreen = lazy(() => import("@/features/dashboard/DashboardScreen"));

// Màn nghiệp vụ gốc
const MaterialImportScreen = lazy(() => import("@/features/imports"));
const SalesScreen = lazy(() => import("@/features/sales"));
const ReserveWarehouseScreen = lazy(() => import("@/features/warehouse"));
const InOutStockReportScreen = lazy(() => import("@/features/reports/NxtReportScreen"));
const MaterialStockScreen = lazy(() => import("@/features/reports/MaterialNxtScreen"));
const WarehouseNxtReportScreen = lazy(() => import("@/features/reports/WarehouseNxtScreen"));
const MonthlyStockLedgerScreen = lazy(() => import("@/features/monthly-stock")); // Sổ kho theo tháng, route /ton-kho-thang
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
const ReconciliationScreen = lazy(() => import("@/features/doi-soat")); // Đối soát HĐĐT ⇄ phần mềm kế toán, route /doi-soat
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
  const username = auth.nguoiDung?.username;

  useEffect(() => {
    apDungCaiDatHienThi(username);
  }, [username]);

  // Chế độ demo CHỈ admin bật. Cờ nằm theo máy (localStorage) ⇒ người khác đăng nhập
  // trên máy đó thì tự tắt, về số thật (không ai thấy số demo mà tưởng số xưởng).
  const isDemoDenied = LA_DEMO && auth.canDangNhap && !!auth.nguoiDung && !auth.laAdmin;
  useEffect(() => {
    if (isDemoDenied) datCheDo(false);
  }, [isDemoDenied]);

  // Ai đang thao tác — cho nhật ký (audit) gắn đúng người.
  useEffect(() => {
    datNguoiThaoTac(
      auth.nguoiDung
        ? { id: auth.nguoiDung.id, username: auth.nguoiDung.username }
        : null
    );
  }, [auth.nguoiDung]);

  const seg = location.pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const roles = auth.nguoiDung?.roles ?? [];
  // 2 giao diện bộ phận: vai trò bộ phận chỉ thấy nav của bộ phận đó (null = đầy đủ).
  const cacIdChoPhep = allowedIds(roles, auth.laAdmin);
  const base = cacIdChoPhep
    ? KIT_NAV.filter((n) => cacIdChoPhep.has(n.id))
    : auth.laAdmin
      ? KIT_NAV
      : KIT_NAV.filter((n) => n.id !== "users" && n.id !== "audit");
  const items = base;

  // Vào path ngoài bộ phận (gõ URL / link cũ) ⇒ đưa về trang chủ bộ phận.
  if (cacIdChoPhep && seg && !cacIdChoPhep.has(seg)) {
    return <Navigate to={`/${homeFor(roles)}`} replace />;
  }
  const current = KIT_NAV.find((n) => n.id === seg);
  const guide = HUONG_DAN[seg];

  return (
    <AppShell
      active={seg}
      activeTab={seg === "catalog" ? searchParams.get("tab") ?? undefined : undefined}
      onSelect={(id) => navigate(`/${id}`)}
      tieuDe={current?.label ?? ""}
      taiKhoan={username}
      huongDan={
        guide
          ? { tieuDe: guide.tieuDe, moTa: guide.moTa, noiDung: guide.noiDung }
          : null
      }
      nguoiDung={
        auth.nguoiDung?.fullName || auth.nguoiDung?.username || "Người dùng"
      }
      vaiTro={roleLabel(auth.nguoiDung?.roles ?? [])}
      ca="Ca A"
      soThongBao={3}
      onDangXuat={
        auth.canDangNhap && auth.session ? auth.dangXuat : undefined
      }
      items={items}
    >
      {/* Tô màu dòng "đã dò" — một nguồn row_marks cho mọi bảng (prop `toMau`). */}
      <ToMauProvider nguoi={username ?? ""}>
        <DaiDemo />
        <NapGoiDemo />
        <Suspense fallback={<DangXuLy chu="Đang mở màn hình…" />}>
          <Outlet />
        </Suspense>
      </ToMauProvider>
    </AppShell>
  );
}

export default function App() {
  const auth = useAuth();
  const roles = auth.nguoiDung?.roles ?? [];

  // Đang lấy phiên đăng nhập từ máy chủ → tránh nháy màn login.
  if (auth.dangTai) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <DangXuLy chu="Đang kết nối…" />
      </div>
    );
  }

  // Đã cấu hình máy chủ mà chưa đăng nhập → chặn bằng màn đăng nhập.
  if (auth.canDangNhap && !auth.session) {
    return (
      <>
        <DangNhap dangNhap={auth.dangNhap} />
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

            {/* Nghiệp vụ gốc */}
            <Route path="/imports" element={<MaterialImportScreen />} />
            <Route path="/sales" element={<SalesScreen />} />
            <Route path="/warehouse" element={<ReserveWarehouseScreen />} />
            <Route path="/nxt" element={<InOutStockReportScreen />} />
            <Route path="/nxt-nl" element={<MaterialStockScreen />} />
            <Route path="/nxt-kho" element={<WarehouseNxtReportScreen />} />
            <Route path="/ton-kho-thang" element={<MonthlyStockLedgerScreen />} />
            <Route path="/bc-thanh-pham" element={<FinishedGoodReportScreen />} />
            <Route path="/bc-don-xuat" element={<OrderExportReportScreen />} />
            <Route path="/orders" element={<SalesOrderScreen />} />
            <Route path="/balancing" element={<CanDoiScreen />} />
            <Route path="/balancing/:periodId" element={<CanDoiScreen />} />
            <Route path="/catalog" element={<CatalogScreen />} />
            <Route path="/wip" element={<WipProductionScreen />} />
            <Route path="/packaging" element={<PackagingScreen />} />
            <Route path="/qc" element={<QcChecklistScreen />} />
            <Route path="/qr" element={<LotScanScreen />} />
            <Route path="/doi-soat" element={<ReconciliationScreen />} />
            <Route
              path="/users"
              element={
                auth.laAdmin && LA_DEMO ? (
                  // Tài khoản + vai trò là THẬT (không thuộc bộ demo) — sửa ở đây dễ tưởng
                  // đang sửa demo. Bắt thoát demo trước.
                  <EmptyState
                    icon={Users}
                    tieuDe="Đang ở chế độ demo"
                    moTa="Người dùng và vai trò là tài khoản thật, không thuộc bộ demo. Thoát demo (nút trên dải vàng) để quản lý người dùng."
                  />
                ) : auth.laAdmin ? (
                  <UserManagementScreen taoTaiKhoan={auth.taoTaiKhoan} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/audit"
              element={
                auth.laAdmin ? <AuditLogScreen /> : <Navigate to="/dashboard" replace />
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
