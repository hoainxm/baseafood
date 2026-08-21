// ============================================================
// Tên file: src/features/shared/AppShell.tsx
// Tên tiếng Việt tương đương: Khung Giao diện MES BSF1 (Sidebar + Header + Content)
// Description: Main MES Layout App Shell with Navigation Sidebar
// ============================================================
// src/features/shared/AppShell.tsx
import { useEffect, useState, type ReactNode } from "react";
import {
  Logo,
  NutGiaoDien,
  NutHuongDan,
  NutTrangThai,
  XacNhan,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  ThermometerSnowflake,
  BarChart3,
  GitBranch,
  Truck,
  ShoppingCart,
  Snowflake,
  PackageCheck,
  Scale,
  Library,
  Users,
  FileSpreadsheet,
  Boxes,
  Factory,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  RefreshCw,
  Bell,
  LogOut,
  type LucideIcon,
} from "lucide-react";

/**
 * AppShell — khung MES: nav DỌC gom nhóm (sidebar trên desktop, drawer trượt
 * trái trên điện thoại) · header · vùng nội dung. `id` của mỗi mục nav CHÍNH LÀ
 * path route (khớp App.tsx).
 *
 * Luật mobile (chi tiết: src/design-system/README.md § Quy chuẩn mobile):
 *  - Chỉ HAI mốc: điện thoại (< md) và desktop (≥ md). Không thiết kế cho tablet.
 *  - Ngân sách ngang của header thuộc về TIÊU ĐỀ. Trên điện thoại header chỉ giữ
 *    ☰ · logo · tiêu đề · nút trạng thái (+ hướng dẫn nếu trang có). Mọi thứ
 *    khác — đổi ca, thông báo, giao diện, tài khoản, đăng xuất — nằm ở CHÂN
 *    DRAWER. Nhồi 6 nút icon vào header là lý do cũ khiến tiêu đề bị bóp còn
 *    0px khi bật cỡ chữ 130%.
 *  - Nút chạm dùng `size-tap`, icon bên trong dùng `size-icon` — cùng thang rem
 *    nên phóng/thu đồng bộ theo cỡ chữ.
 */

export interface MucNavShell {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** id = path route. Danh sách phẳng — thứ tự hiển thị do NHOM_NAV quyết định. */
export const KIT_NAV: MucNavShell[] = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "production", label: "Lệnh sản xuất", icon: ClipboardList },
  { id: "wip", label: "Sản xuất BTP", icon: Factory },
  { id: "quality", label: "Chất lượng", icon: ShieldCheck },
  { id: "imports", label: "Nhập hàng", icon: Truck },
  { id: "warehouse", label: "Kho dự trữ", icon: Snowflake },
  { id: "cold-storage", label: "Kho lạnh", icon: ThermometerSnowflake },
  { id: "sales", label: "Bán hàng", icon: ShoppingCart },
  { id: "orders", label: "Đơn đặt", icon: PackageCheck },
  { id: "balancing", label: "Cân đối", icon: Scale },
  { id: "nxt-nl", label: "Tồn kho NL", icon: Boxes },
  { id: "nxt", label: "Báo cáo NXT", icon: FileSpreadsheet },
  { id: "reports", label: "Báo cáo", icon: BarChart3 },
  { id: "traceability", label: "Truy xuất", icon: GitBranch },
  { id: "catalog", label: "Danh mục", icon: Library },
  { id: "users", label: "Người dùng", icon: Users },
];

/** Nav DỌC gom theo nhóm chức năng — dùng chung cho sidebar và drawer. */
export const NHOM_NAV: { ten: string; ids: string[] }[] = [
  { ten: "Tổng quan", ids: ["dashboard"] },
  { ten: "Sản xuất", ids: ["production", "wip", "quality"] },
  { ten: "Kho", ids: ["imports", "warehouse", "cold-storage"] },
  { ten: "Kinh doanh", ids: ["sales", "orders"] },
  { ten: "Báo cáo", ids: ["balancing", "nxt-nl", "nxt", "reports", "traceability"] },
  { ten: "Hệ thống", ids: ["catalog", "users"] },
];

interface NhomHienThi {
  ten: string;
  muc: MucNavShell[];
}

/** Gom danh sách đã lọc quyền vào nhóm; mục lạ rơi vào nhóm "Khác" để không mất. */
function gomNhom(items: MucNavShell[]): NhomHienThi[] {
  const con = new Map(items.map((i) => [i.id, i]));
  const daDung = new Set<string>();
  const nhom: NhomHienThi[] = [];

  for (const g of NHOM_NAV) {
    const muc: MucNavShell[] = [];
    for (const id of g.ids) {
      const m = con.get(id);
      if (m) {
        muc.push(m);
        daDung.add(id);
      }
    }
    if (muc.length) nhom.push({ ten: g.ten, muc });
  }

  const con_lai = items.filter((i) => !daDung.has(i.id));
  if (con_lai.length) nhom.push({ ten: "Khác", muc: con_lai });
  return nhom;
}

const CN_NUT_ICON =
  "inline-flex size-tap shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function HeaderNut({
  label,
  icon: Icon,
  onClick,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(CN_NUT_ICON, className)}
    >
      <Icon className="size-icon" aria-hidden />
    </button>
  );
}

/** Cây nav dọc gom nhóm. `thuGon` chỉ dùng cho sidebar desktop (icon-only). */
function CayNav({
  nhom,
  active,
  onSelect,
  thuGon = false,
}: {
  nhom: NhomHienThi[];
  active: string;
  onSelect: (id: string) => void;
  thuGon?: boolean;
}) {
  return (
    <nav className="scroll-nice flex-1 overflow-y-auto p-3">
      {nhom.map((g, i) => (
        <div key={g.ten} className={cn(i > 0 && "mt-4")}>
          {thuGon ? (
            i > 0 && <div className="mx-2 mb-3 border-t-2 border-border" />
          ) : (
            <p className="px-4 pb-1.5 text-sm font-semibold text-muted-foreground">
              {g.ten}
            </p>
          )}
          <div className="space-y-1.5">
            {g.muc.map((n) => {
              const Icon = n.icon;
              const chon = active === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n.id)}
                  aria-current={chon ? "page" : undefined}
                  title={thuGon ? n.label : undefined}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-lg border text-left text-sm font-semibold transition-colors",
                    thuGon ? "justify-center px-0" : "px-4",
                    chon
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-transparent text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-icon shrink-0" aria-hidden />
                  {!thuGon && <span className="min-w-0 truncate">{n.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function VietTat(ten: string): string {
  return (
    String(ten || "?")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export interface HuongDanTrang {
  tieuDe: string;
  moTa?: string;
  noiDung: ReactNode;
}

export interface AppShellProps {
  active: string;
  onSelect: (id: string) => void;
  tieuDe: string;
  breadcrumb?: string;
  nguoiDung: string;
  vaiTro: string;
  /** Username để lưu cấu hình giao diện theo người dùng. */
  taiKhoan?: string;
  /** Nội dung hướng dẫn của trang đang mở; bỏ trống ⇒ không hiện nút. */
  huongDan?: HuongDanTrang | null;
  ca?: string;
  onDoiCa?: () => void;
  soThongBao?: number;
  onThongBao?: () => void;
  onDangXuat?: () => void;
  /** Danh sách nav (đã lọc theo quyền). Mặc định KIT_NAV. */
  items?: MucNavShell[];
  children: ReactNode;
}

export default function AppShell({
  active,
  onSelect,
  tieuDe,
  breadcrumb,
  nguoiDung,
  vaiTro,
  taiKhoan,
  huongDan,
  ca,
  onDoiCa,
  soThongBao,
  onThongBao,
  onDangXuat,
  items = KIT_NAV,
  children,
}: AppShellProps) {
  const [thuGon, setThuGon] = useState(false);
  const [moNav, setMoNav] = useState(false);
  const nhom = gomNhom(items);

  // Drawer: đóng bằng Escape (bàn phím vẫn phải thoát được).
  useEffect(() => {
    if (!moNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoNav(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moNav]);

  const chon = (id: string) => {
    onSelect(id);
    setMoNav(false);
  };

  return (
    /* Desktop: khoá chiều cao khung (h-dvh + overflow-hidden) để THANH BÊN và
       VÙNG NỘI DUNG cuộn RIÊNG — trước đây cuộn chung, kéo bảng dài là nav trôi
       mất. Điện thoại giữ cuộn trang tự nhiên (nav là drawer, có scroll riêng). */
    <div className="flex min-h-full flex-col bg-background md:h-dvh md:flex-row md:overflow-hidden">
      {/* Sidebar dọc — chỉ desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex md:h-full md:overflow-hidden",
          thuGon ? "w-20" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            thuGon ? "justify-center px-2" : "px-4"
          )}
        >
          <Logo cao="h-9" hienChu={!thuGon} phuDe={thuGon ? undefined : "Xí nghiệp BSF1"} />
        </div>
        <CayNav nhom={nhom} active={active} onSelect={onSelect} thuGon={thuGon} />
      </aside>

      {/* Drawer điện thoại — CÙNG cây nav dọc, thêm chân chứa nút toàn cục */}
      {moNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMoNav(false)}
            className="absolute inset-0 bg-overlay"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Logo cao="h-9" phuDe="Xí nghiệp BSF1" />
              <HeaderNut label="Đóng menu" icon={X} onClick={() => setMoNav(false)} />
            </div>

            <CayNav nhom={nhom} active={active} onSelect={chon} />

            {/* Chân drawer: những gì KHÔNG còn chỗ trên header điện thoại */}
            <div className="shrink-0 space-y-3 border-t border-border p-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
                >
                  {VietTat(nguoiDung)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {nguoiDung}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{vaiTro}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <NutGiaoDien taiKhoan={taiKhoan} />
                {ca && (
                  <button
                    type="button"
                    onClick={onDoiCa}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <RefreshCw className="size-icon-sm" aria-hidden />
                    {ca}
                  </button>
                )}
                {typeof soThongBao === "number" && (
                  <button
                    type="button"
                    onClick={onThongBao}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Bell className="size-icon-sm" aria-hidden />
                    Thông báo
                    {soThongBao > 0 && (
                      <span className="tnum rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground">
                        {soThongBao}
                      </span>
                    )}
                  </button>
                )}
                {onDangXuat && (
                  <XacNhan
                    tieuDe="Đăng xuất khỏi máy này?"
                    moTa="Số liệu đã ghi vẫn còn. Vào lại phải nhập tên đăng nhập và mật khẩu."
                    chiTiet={`${nguoiDung} · ${vaiTro}`}
                    nhanNut="Đăng xuất"
                    nhanHuy="Ở lại"
                    icon={LogOut}
                    onConfirm={onDangXuat}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <LogOut className="size-icon-sm" aria-hidden />
                        Đăng xuất
                      </button>
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cột nội dung — cuộn riêng trên desktop */}
      <div className="scroll-nice flex min-w-0 flex-1 flex-col md:h-full md:overflow-y-auto">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:gap-3 md:px-6">
          {/* Trái — ĐƯỢC ƯU TIÊN ngân sách ngang (flex-1, không shrink-0) */}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <HeaderNut
              label="Mở menu"
              icon={Menu}
              onClick={() => setMoNav(true)}
              className="md:hidden"
            />
            <HeaderNut
              label={thuGon ? "Mở thanh bên" : "Thu thanh bên"}
              icon={thuGon ? PanelLeftOpen : PanelLeftClose}
              onClick={() => setThuGon((v) => !v)}
              className="hidden md:inline-flex"
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                Baseafood MES{breadcrumb ? ` · ${breadcrumb}` : ""}
              </p>
              <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">
                {tieuDe}
              </h1>
            </div>
          </div>

          {/* Phải — điện thoại chỉ giữ trạng thái + hướng dẫn; phần còn lại ở drawer */}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {ca && (
              <button
                type="button"
                onClick={onDoiCa}
                className="hidden min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted xl:inline-flex"
              >
                <RefreshCw className="size-icon-sm" aria-hidden />
                {ca}
              </button>
            )}

            {typeof soThongBao === "number" && (
              <span className="relative hidden md:inline-flex">
                <HeaderNut
                  label={`Thông báo (${soThongBao} chưa đọc)`}
                  icon={Bell}
                  onClick={onThongBao}
                />
                {soThongBao > 0 && (
                  <span
                    aria-hidden
                    className="tnum absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
                  >
                    {soThongBao}
                  </span>
                )}
              </span>
            )}

            {huongDan && (
              <NutHuongDan tieuDe={huongDan.tieuDe} moTa={huongDan.moTa}>
                {huongDan.noiDung}
              </NutHuongDan>
            )}
            <span className="hidden md:inline-flex">
              <NutGiaoDien taiKhoan={taiKhoan} />
            </span>
            <NutTrangThai />

            <div className="hidden items-center gap-2 border-l border-border pl-2 md:flex md:gap-3 md:pl-3">
              <span
                aria-hidden
                className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
              >
                {VietTat(nguoiDung)}
              </span>
              <div className="hidden min-w-0 text-right xl:block">
                <p className="truncate text-sm font-semibold text-foreground">
                  {nguoiDung}
                </p>
                <p className="truncate text-sm text-muted-foreground">{vaiTro}</p>
              </div>
              {onDangXuat && (
                <XacNhan
                  tieuDe="Đăng xuất khỏi máy này?"
                  moTa="Số liệu đã ghi vẫn còn. Vào lại phải nhập tên đăng nhập và mật khẩu."
                  chiTiet={`${nguoiDung} · ${vaiTro}`}
                  nhanNut="Đăng xuất"
                  nhanHuy="Ở lại"
                  icon={LogOut}
                  onConfirm={onDangXuat}
                  trigger={
                    <button
                      type="button"
                      aria-label="Đăng xuất"
                      title="Đăng xuất"
                      className={cn(CN_NUT_ICON, "hover:text-destructive")}
                    >
                      <LogOut className="size-icon" aria-hidden />
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </header>

        <main className="w-full flex-1 p-5 md:p-8">
          {/* key theo màn đang mở → fade nhẹ mỗi lần đổi trang (reduced-motion tắt) */}
          <div
            key={active}
            className="mx-auto w-full max-w-(--app-content-width) animate-in fade-in-0 duration-150"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
