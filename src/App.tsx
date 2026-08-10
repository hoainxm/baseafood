import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import DangNhap from "@/features/auth";
import { AppLayout, NotFound } from "@/features/shared";
import { Toaster } from "@/design-system";
import { useAuth } from "@/lib/auth";

// Lazy loaded feature screens
const NhapNguyenLieuScreen = lazy(() => import("@/features/imports"));
const SanXuatBTPScreen = lazy(() => import("@/features/production"));
const BanHangScreen = lazy(() => import("@/features/sales"));
const KhoDuTruScreen = lazy(() => import("@/features/warehouse"));
const DonDatScreen = lazy(() => import("@/features/orders"));
const CanDoiScreen = lazy(() => import("@/features/balancing"));
const DanhMucScreen = lazy(() => import("@/features/catalog"));
const QuanLyNguoiDungScreen = lazy(() => import("@/features/users"));
const KitPage = lazy(() => import("@/design-system/kit/KitPage"));

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
    <HashRouter>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center p-6">
            <p className="text-base text-muted-foreground">Đang tải màn hình…</p>
          </div>
        }
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/imports" replace />} />
            <Route path="/imports" element={<NhapNguyenLieuScreen />} />
            <Route path="/production" element={<SanXuatBTPScreen />} />
            <Route path="/sales" element={<BanHangScreen />} />
            <Route path="/warehouse" element={<KhoDuTruScreen />} />
            <Route path="/orders" element={<DonDatScreen />} />
            <Route path="/balancing" element={<CanDoiScreen />} />
            <Route path="/balancing/:periodId" element={<CanDoiScreen />} />
            <Route path="/catalog" element={<DanhMucScreen />} />
            <Route
              path="/users"
              element={
                auth.laAdmin ? (
                  <QuanLyNguoiDungScreen taoTaiKhoan={auth.taoTaiKhoan} />
                ) : (
                  <Navigate to="/imports" replace />
                )
              }
            />
            <Route path="/kit" element={<KitPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
