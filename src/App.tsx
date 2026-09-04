// ============================================================
// Tên file: src/App.tsx
// Tên tiếng Việt tương đương: Chương trình chính & Điều hướng ứng dụng MES BSF1
// Description: Main Application Component & Router Setup
// ============================================================
// src/App.tsx
import { lazy, Suspense, useEffect, type ReactElement } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import DangNhap from "@/features/auth";
import { NotFound } from "@/features/shared";
import AppShell, { KIT_NAV } from "@/features/shared/AppShell";
import { HUONG_DAN } from "@/features/shared/guideContent";
import { Toaster, apDungCaiDatHienThi, DangXuLy } from "@/design-system";
import { useAuth } from "@/lib/auth";
import { datNguoiThaoTac } from "@/lib/audit";
import { roleLabel } from "@/types";
import { allowedIds, homeFor, laDemo } from "@/lib/nav-access";

// Module MES (màn trưng bày)
const ManTongQuan = lazy(() => import("@/features/dashboard/DashboardScreen"));
const ManLenhSX = lazy(() => import("@/features/production/WorkOrderScreen"));
const ManChatLuong = lazy(() => import("@/features/quality/QualityScreen"));
const ManTruyXuat = lazy(() => import("@/features/traceability/TraceabilityScreen"));
const ManKhoLanh = lazy(() => import("@/features/cold-storage/ColdStorageScreen"));
const ManBaoCao = lazy(() => import("@/features/reports/ReportsScreen"));

// Màn nghiệp vụ gốc
const NhapNguyenLieuScreen = lazy(() => import("@/features/imports"));
const BanHangScreen = lazy(() => import("@/features/sales"));
const KhoDuTruScreen = lazy(() => import("@/features/warehouse"));
const BaoCaoNhapXuatTonScreen = lazy(() => import("@/features/reports/NxtReportScreen"));
const TonKhoNguyenLieuScreen = lazy(() => import("@/features/reports/MaterialNxtScreen"));
const BaoCaoXuatNhapTonKhoScreen = lazy(() => import("@/features/reports/WarehouseNxtScreen"));
const BaoCaoThanhPhamScreen = lazy(() => import("@/features/reports/DailyProductionReport"));
const BaoCaoDonXuatScreen = lazy(() => import("@/features/reports/OrderExportReport"));
const DonDatScreen = lazy(() => import("@/features/orders"));
const CanDoiScreen = lazy(() => import("@/features/balancing"));
const DanhMucScreen = lazy(() => import("@/features/catalog"));
const QuanLyNguoiDungScreen = lazy(() => import("@/features/users"));
const NhatKyScreen = lazy(() => import("@/features/audit"));
const SanXuatBTPScreen = lazy(() => import("@/features/production")); // Sản xuất BTP (WIP), route /wip
const DongGoiScreen = lazy(() => import("@/features/packaging")); // Đóng gói BTP → TP, route /packaging
const KiemTraQcScreen = lazy(() => import("@/features/quality-check")); // QC checklist chấm điểm, route /qc
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
  const username = auth.nguoiDung?.username;

  useEffect(() => {
    apDungCaiDatHienThi(username);
  }, [username]);

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
  // Màn demo (dữ liệu mẫu) chỉ admin thấy — người dùng thường không thấy để khỏi
  // nhầm là số vận hành. Admin vẫn thấy, kèm cờ "DEMO" trong nav (AppShell).
  const items = auth.laAdmin ? base : base.filter((n) => !laDemo(n.id));

  // Vào path ngoài bộ phận (gõ URL / link cũ) ⇒ đưa về trang chủ bộ phận.
  if (cacIdChoPhep && seg && !cacIdChoPhep.has(seg)) {
    return <Navigate to={`/${homeFor(roles)}`} replace />;
  }
  const current = KIT_NAV.find((n) => n.id === seg);
  const guide = HUONG_DAN[seg];

  return (
    <AppShell
      active={seg}
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
      <Suspense fallback={<DangXuLy chu="Đang mở màn hình…" />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  const auth = useAuth();
  const roles = auth.nguoiDung?.roles ?? [];

  // Màn demo (dữ liệu mẫu) chỉ admin vào được; người khác gõ URL → về trang chủ.
  const demoGuard = (el: ReactElement) =>
    auth.laAdmin ? el : <Navigate to={`/${homeFor(roles)}`} replace />;

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
            <Route path="/dashboard" element={<ManTongQuan />} />
            {/* Màn DEMO (dữ liệu mẫu) — chỉ admin, xem lib/nav-access.ts DEMO_IDS */}
            <Route path="/production" element={demoGuard(<ManLenhSX />)} />
            <Route path="/quality" element={demoGuard(<ManChatLuong />)} />
            <Route path="/cold-storage" element={demoGuard(<ManKhoLanh />)} />
            <Route path="/reports" element={demoGuard(<ManBaoCao />)} />
            <Route path="/traceability" element={demoGuard(<ManTruyXuat />)} />

            {/* Nghiệp vụ gốc */}
            <Route path="/imports" element={<NhapNguyenLieuScreen />} />
            <Route path="/sales" element={<BanHangScreen />} />
            <Route path="/warehouse" element={<KhoDuTruScreen />} />
            <Route path="/nxt" element={<BaoCaoNhapXuatTonScreen />} />
            <Route path="/nxt-nl" element={<TonKhoNguyenLieuScreen />} />
            <Route path="/nxt-kho" element={<BaoCaoXuatNhapTonKhoScreen />} />
            <Route path="/bc-thanh-pham" element={<BaoCaoThanhPhamScreen />} />
            <Route path="/bc-don-xuat" element={<BaoCaoDonXuatScreen />} />
            <Route path="/orders" element={<DonDatScreen />} />
            <Route path="/balancing" element={<CanDoiScreen />} />
            <Route path="/balancing/:periodId" element={<CanDoiScreen />} />
            <Route path="/catalog" element={<DanhMucScreen />} />
            <Route path="/wip" element={<SanXuatBTPScreen />} />
            <Route path="/packaging" element={<DongGoiScreen />} />
            <Route path="/qc" element={<KiemTraQcScreen />} />
            <Route
              path="/users"
              element={
                auth.laAdmin ? (
                  <QuanLyNguoiDungScreen taoTaiKhoan={auth.taoTaiKhoan} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="/audit"
              element={
                auth.laAdmin ? <NhatKyScreen /> : <Navigate to="/dashboard" replace />
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
