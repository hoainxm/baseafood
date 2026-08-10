import { Outlet, Link, useLocation } from "react-router-dom";
import { CoChuNhanh, Logo, Toaster, TrangThaiDuLieu } from "@/design-system";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/types";
import {
  Truck,
  Factory,
  ShoppingCart,
  Snowflake,
  ClipboardList,
  Scale,
  Library,
  Palette,
  Users,
  LogOut,
} from "lucide-react";

type Screen =
  | "imports"
  | "production"
  | "sales"
  | "kho"
  | "orders"
  | "balancing"
  | "catalog"
  | "users"
  | "kit";

interface MucNav {
  id: Screen;
  label: string;
  moTa: string;
  icon: typeof Truck;
}

const NAV: MucNav[] = [
  {
    id: "imports",
    label: "Nhập hàng",
    moTa: "Ghi chuyến nguyên liệu về xưởng",
    icon: Truck,
  },
  {
    id: "production",
    label: "Sản xuất BTP",
    moTa: "Ghi sản lượng bán thành phẩm ngày",
    icon: Factory,
  },
  {
    id: "sales",
    label: "Bán hàng",
    moTa: "Ghi phiếu bán thành phẩm hằng ngày",
    icon: ShoppingCart,
  },
  {
    id: "kho",
    label: "Kho dự trữ",
    moTa: "Duyệt nhập kho, theo dõi tồn đông",
    icon: Snowflake,
  },
  {
    id: "orders",
    label: "Đơn đặt",
    moTa: "Gom đủ đơn, xuất container",
    icon: ClipboardList,
  },
  {
    id: "balancing",
    label: "Cân đối",
    moTa: "Nguyên liệu vào ↔ bán thành phẩm sản xuất",
    icon: Scale,
  },
  {
    id: "catalog",
    label: "Danh mục",
    moTa: "Mặt hàng, khách, đại lý, loại NL",
    icon: Library,
  },
];

const NAV_NGUOI_DUNG: MucNav = {
  id: "users",
  label: "Người dùng",
  moTa: "Tài khoản & vai trò",
  icon: Users,
};

const CAO_HEADER = "h-20";

export default function AppLayout() {
  const auth = useAuth();
  const location = useLocation();

  const navList: MucNav[] = auth.laAdmin ? [...NAV, NAV_NGUOI_DUNG] : NAV;
  
  const activeNav = navList.find((n) => {
    if (n.id === "balancing") {
      return location.pathname.startsWith("/balancing");
    }
    return location.pathname === `/${n.id}`;
  });
  
  const screenThuc = activeNav ? activeNav.id : (location.pathname === "/kit" ? "kit" : "");
  const tieuDeMan = screenThuc === "kit" ? "Bộ giao diện" : (activeNav?.label ?? "");

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Thanh bên (desktop / tablet ngang) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r-2 border-border bg-card md:flex">
        <div
          className={cn(
            "flex shrink-0 items-center border-b-2 border-border px-5",
            CAO_HEADER,
          )}
        >
          <Logo cao="h-11" phuDe="Xí nghiệp BSF1" />
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {navList.map((n) => {
            const Icon = n.icon;
            const active = screenThuc === n.id;
            return (
              <Link
                key={n.id}
                to={`/${n.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-transparent text-foreground hover:bg-muted",
                )}
              >
                <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-base font-semibold">
                    {n.label}
                  </span>
                  <span
                    className={cn(
                      "block text-sm",
                      active
                        ? "text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {n.moTa}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border px-5 py-4">
          {auth.canDangNhap && auth.session && (
            <div className="space-y-2 rounded-lg bg-muted px-3 py-2.5">
              <p className="truncate text-base font-semibold text-foreground">
                {auth.nguoiDung?.fullName ||
                  auth.nguoiDung?.username ||
                  "Người dùng"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-muted-foreground">
                  {auth.nguoiDung?.username} ·{" "}
                  {roleLabel(auth.nguoiDung?.roles ?? [])}
                </span>
                <button
                  onClick={auth.dangXuat}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-card hover:text-destructive"
                >
                  <LogOut className="size-5" aria-hidden />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
          <Link
            to="/kit"
            className={cn(
              "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors",
              screenThuc === "kit"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Palette className="size-5" aria-hidden />
            Bộ giao diện
          </Link>
          <TrangThaiDuLieu />
        </div>
      </aside>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-4 border-b-2 border-border bg-card px-5 sm:px-8",
            CAO_HEADER,
          )}
        >
          <Logo cao="h-10" phuDe="Xí nghiệp BSF1" className="md:hidden" />
          <h1 className="hidden truncate text-xl font-semibold text-foreground md:block">
            {tieuDeMan}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {/* Đăng xuất cho điện thoại (thanh bên ẩn) */}
            {auth.canDangNhap && auth.session && (
              <button
                onClick={auth.dangXuat}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive md:hidden"
              >
                <LogOut className="size-5" aria-hidden />
                Đăng xuất
              </button>
            )}
            <CoChuNhanh />
          </div>
        </header>

        <main className="w-full flex-1 p-5 pb-28 sm:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-(--app-content-width)">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Tab dưới cho điện thoại — số cột theo số mục (4 hoặc 5 khi có admin) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t-2 border-border bg-card md:hidden"
        style={{
          gridTemplateColumns: `repeat(${navList.length}, minmax(0, 1fr))`,
        }}
      >
        {navList.map((n) => {
          const Icon = n.icon;
          const active = screenThuc === n.id;
          return (
            <Link
              key={n.id}
              to={`/${n.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" aria-hidden />
              <span className="leading-tight">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}
