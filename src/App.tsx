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
} from "react-router-dom";
import DangNhap from "@/features/auth";
import { NotFound } from "@/features/shared";
import AppShell, { KIT_NAV } from "@/features/shared/AppShell";
import { HUONG_DAN } from "@/features/shared/huongDan";
import { Toaster, apDungCaiDatHienThi } from "@/design-system";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/types";

// Module MES (màn trưng bày)
const ManTongQuan = lazy(() => import("@/features/dashboard/ManTongQuan"));
const ManLenhSX = lazy(() => import("@/features/production/ManLenhSX"));
const ManChatLuong = lazy(() => import("@/features/quality/ManChatLuong"));
const ManTruyXuat = lazy(() => import("@/features/traceability/ManTruyXuat"));
const ManKhoLanh = lazy(() => import("@/features/cold-storage/ManKhoLanh"));
const ManBaoCao = lazy(() => import("@/features/reports/ManBaoCao"));

// Màn nghiệp vụ gốc
const NhapNguyenLieuScreen = lazy(() => import("@/features/imports"));
const BanHangScreen = lazy(() => import("@/features/sales"));
const KhoDuTruScreen = lazy(() => import("@/features/warehouse"));
const DonDatScreen = lazy(() => import("@/features/orders"));
const CanDoiScreen = lazy(() => import("@/features/balancing"));
const DanhMucScreen = lazy(() => import("@/features/catalog"));
const QuanLyNguoiDungScreen = lazy(() => import("@/features/users"));
const SanXuatBTPScreen = lazy(() => import("@/features/production")); // Sản xuất BTP (WIP), route /wip
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

  const seg = location.pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const items = auth.laAdmin ? KIT_NAV : KIT_NAV.filter((n) => n.id !== "users");
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
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-base text-muted-foreground">Đang tải màn hình…</p>
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  const auth = useAuth();

  // Đang lấy phiên đăng nhập từ máy chủ → tránh nháy màn login.
  if (auth.dangTai) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <p className="text-base text-muted-foreground">Đang tải…</p>
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* MES */}
            <Route path="/dashboard" element={<ManTongQuan />} />
            <Route path="/production" element={<ManLenhSX />} />
            <Route path="/quality" element={<ManChatLuong />} />
            <Route path="/cold-storage" element={<ManKhoLanh />} />
            <Route path="/reports" element={<ManBaoCao />} />
            <Route path="/traceability" element={<ManTruyXuat />} />

            {/* Nghiệp vụ gốc */}
            <Route path="/imports" element={<NhapNguyenLieuScreen />} />
            <Route path="/sales" element={<BanHangScreen />} />
            <Route path="/warehouse" element={<KhoDuTruScreen />} />
            <Route path="/orders" element={<DonDatScreen />} />
            <Route path="/balancing" element={<CanDoiScreen />} />
            <Route path="/balancing/:periodId" element={<CanDoiScreen />} />
            <Route path="/catalog" element={<DanhMucScreen />} />
            <Route path="/wip" element={<SanXuatBTPScreen />} />
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
            <Route path="/kit" element={<KitPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
