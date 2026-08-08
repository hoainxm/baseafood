import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import DangNhap from "@/features/auth";
import { AppLayout, NotFound } from "@/features/shared";
import { Toaster } from "@/design-system";
import { useAuth } from "@/lib/auth";

// Lazy loaded feature screens
const NhapNguyenLieuScreen = lazy(() => import("@/features/nhap-hang"));
const SanXuatBTPScreen = lazy(() => import("@/features/san-xuat"));
const BanHangScreen = lazy(() => import("@/features/ban-hang"));
const KhoDuTruScreen = lazy(() => import("@/features/kho"));
const DonDatScreen = lazy(() => import("@/features/don-dat"));
const CanDoiScreen = lazy(() => import("@/features/can-doi"));
const DanhMucScreen = lazy(() => import("@/features/danh-muc"));
const QuanLyNguoiDungScreen = lazy(() => import("@/features/nguoi-dung"));
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
            <Route path="/" element={<Navigate to="/nhap-hang" replace />} />
            <Route path="/nhap-hang" element={<NhapNguyenLieuScreen />} />
            <Route path="/san-xuat" element={<SanXuatBTPScreen />} />
            <Route path="/ban-hang" element={<BanHangScreen />} />
            <Route path="/kho" element={<KhoDuTruScreen />} />
            <Route path="/don-dat" element={<DonDatScreen />} />
            <Route path="/can-doi" element={<CanDoiScreen />} />
            <Route path="/can-doi/:kyId" element={<CanDoiScreen />} />
            <Route path="/danh-muc" element={<DanhMucScreen />} />
            <Route
              path="/nguoi-dung"
              element={
                auth.laAdmin ? (
                  <QuanLyNguoiDungScreen taoTaiKhoan={auth.taoTaiKhoan} />
                ) : (
                  <Navigate to="/nhap-hang" replace />
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
