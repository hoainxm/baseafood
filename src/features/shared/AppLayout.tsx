import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Logo,
  Toaster,
  NutGiaoDien,
  NutHuongDan,
  NutTrangThai,
  apDungCaiDatHienThi,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/types";
import { HUONG_DAN } from "./huongDan";
import {
  Truck,
  Factory,
  ShoppingCart,
  Snowflake,
  ClipboardList,
  Scale,
  Library,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

type Screen =
  | "imports"
  | "production"
  | "sales"
  | "warehouse"
  | "orders"
  | "balancing"
  | "catalog"
  | "users"
  | "kit";

interface MucNav {
  id: Screen;
  label: string;
  icon: typeof Truck;
}

const NAV: MucNav[] = [
  { id: "imports", label: "Nhập hàng", icon: Truck },
  { id: "production", label: "Sản xuất BTP", icon: Factory },
  { id: "sales", label: "Bán hàng", icon: ShoppingCart },
  { id: "warehouse", label: "Kho dự trữ", icon: Snowflake },
  { id: "orders", label: "Đơn đặt", icon: ClipboardList },
  { id: "balancing", label: "Cân đối", icon: Scale },
  { id: "catalog", label: "Danh mục", icon: Library },
];

const NAV_NGUOI_DUNG: MucNav = {
  id: "users",
  label: "Người dùng",
  icon: Users,
};

const CAO_HEADER = "h-20";
const KEY_THU_GON = "bsf.sidebarThu";

export default function AppLayout() {
  const auth = useAuth();
  const location = useLocation();

  // Thu/mở thanh bên (chỉ desktop) — nhớ lựa chọn qua localStorage.
  const [thuGon, setThuGon] = useState(
    () => localStorage.getItem(KEY_THU_GON) === "1"
  );
  const doiThuGon = () =>
    setThuGon((v) => {
      const n = !v;
      localStorage.setItem(KEY_THU_GON, n ? "1" : "0");
      return n;
    });

  const navList: MucNav[] = auth.laAdmin ? [...NAV, NAV_NGUOI_DUNG] : NAV;

  const activeNav = navList.find((n) => {
    if (n.id === "balancing") {
      return location.pathname.startsWith("/balancing");
    }
    return location.pathname === `/${n.id}`;
  });

  const screenThuc: string = activeNav
    ? activeNav.id
    : location.pathname === "/kit"
      ? "kit"
      : "";
  const tieuDeMan =
    screenThuc === "kit" ? "Bộ giao diện" : (activeNav?.label ?? "");

  const dangNhap = auth.canDangNhap && auth.session;
  const username = auth.nguoiDung?.username;
  const huongDan = HUONG_DAN[screenThuc];

  // Đổi tài khoản → nạp lại giao diện đã lưu của người vừa đăng nhập.
  useEffect(() => {
    apDungCaiDatHienThi(username);
  }, [username]);

  // Cụm nút bên phải header: hướng dẫn (theo trang) · giao diện · trạng thái.
  // Luôn hiện, kể cả trên điện thoại (tablet xưởng tay ướt bấm icon dễ hơn text).
  const nutHeader = (
    <div className="flex shrink-0 items-center gap-2">
      {huongDan && (
        <NutHuongDan tieuDe={huongDan.tieuDe} moTa={huongDan.moTa}>
          {huongDan.noiDung}
        </NutHuongDan>
      )}
      <NutGiaoDien taiKhoan={username} />
      <NutTrangThai />
    </div>
  );

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Thanh bên (desktop / tablet ngang) — thu/mở được, chỉ icon + nhãn */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r-2 border-border bg-card transition-[width] duration-200 md:flex",
          thuGon ? "w-20" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b-2 border-border",
            thuGon ? "justify-center px-2" : "px-5",
            CAO_HEADER
          )}
        >
          <Logo
            cao="h-11"
            hienChu={!thuGon}
            phuDe={thuGon ? undefined : "Xí nghiệp BSF1"}
          />
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          {navList.map((n) => {
            const Icon = n.icon;
            const active = screenThuc === n.id;
            return (
              <Link
                key={n.id}
                to={`/${n.id}`}
                aria-current={active ? "page" : undefined}
                title={thuGon ? n.label : undefined}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border-2 text-left text-base font-semibold transition-colors",
                  thuGon ? "justify-center px-0" : "px-4",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-transparent text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-6 shrink-0" aria-hidden />
                {!thuGon && <span className="min-w-0 truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-b-2 border-border bg-card px-4 sm:px-6",
            CAO_HEADER
          )}
        >
          {/* Trái: nút thu/mở (desktop) + logo (mobile) + tiêu đề màn */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={doiThuGon}
              aria-label={thuGon ? "Mở thanh bên" : "Thu thanh bên"}
              title={thuGon ? "Mở thanh bên" : "Thu thanh bên"}
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              {thuGon ? (
                <PanelLeftOpen className="size-6" aria-hidden />
              ) : (
                <PanelLeftClose className="size-6" aria-hidden />
              )}
            </button>
            <Logo cao="h-9" hienChu={false} className="md:hidden" />
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">
              {tieuDeMan}
            </h1>
          </div>

          {/* Phải: cụm nút + tài khoản */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {nutHeader}
            {dangNhap && (
              <div className="flex items-center gap-2 border-l-2 border-border pl-2 sm:pl-3">
                <div className="hidden min-w-0 text-right sm:block">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {auth.nguoiDung?.fullName ||
                      auth.nguoiDung?.username ||
                      "Người dùng"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {roleLabel(auth.nguoiDung?.roles ?? [])}
                  </p>
                </div>
                <button
                  onClick={auth.dangXuat}
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <LogOut className="size-6" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="w-full flex-1 p-5 pb-28 sm:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-(--app-content-width)">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Tab dưới cho điện thoại — số cột theo số mục (7 hoặc 8 khi có admin) */}
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
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
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
