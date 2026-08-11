// ============================================================
// Tên file: src/features/shared/AppShell.tsx
// Tên tiếng Việt tương đương: Khung Giao diện MES BSF1 (Sidebar + Header + Content)
// Description: Main MES Layout App Shell with Navigation Sidebar
// ============================================================
// src/features/shared/AppShell.tsx
import { useState, type ReactNode } from "react";
import {
  Logo,
  NutGiaoDien,
  NutHuongDan,
  NutTrangThai,
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
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Bell,
  LogOut,
  type LucideIcon,
} from "lucide-react";

/**
 * AppShell — khung MES: sidebar trái (thu/mở) · header 80px · vùng nội dung ·
 * bottom-tab điện thoại. `id` của mỗi mục nav CHÍNH LÀ path route (khớp App.tsx).
 *
 * Header phải dùng component THẬT của design-system: NutHuongDan (theo trang),
 * NutGiaoDien (lưu theo tài khoản), NutTrangThai (kết nối máy chủ) — cộng thêm
 * đổi ca, chuông thông báo, avatar, đăng xuất. Desktop-first; dưới xl tự ẩn nhãn
 * tên/vai trò và rút gọn nút đổi ca về icon.
 */

export interface MucNavShell {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** id = path route. Thứ tự: 6 module MES trước, rồi nghiệp vụ gốc, cuối là admin. */
export const KIT_NAV: MucNavShell[] = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "production", label: "Lệnh sản xuất", icon: ClipboardList },
  { id: "quality", label: "Chất lượng", icon: ShieldCheck },
  { id: "cold-storage", label: "Kho lạnh", icon: ThermometerSnowflake },
  { id: "reports", label: "Báo cáo", icon: BarChart3 },
  { id: "traceability", label: "Truy xuất", icon: GitBranch },
  { id: "imports", label: "Nhập hàng", icon: Truck },
  { id: "sales", label: "Bán hàng", icon: ShoppingCart },
  { id: "warehouse", label: "Kho dự trữ", icon: Snowflake },
  { id: "nxt", label: "Báo cáo NXT", icon: FileSpreadsheet },
  { id: "orders", label: "Đơn đặt", icon: PackageCheck },
  { id: "balancing", label: "Cân đối", icon: Scale },
  { id: "catalog", label: "Danh mục", icon: Library },
  { id: "users", label: "Người dùng", icon: Users },
];

const CN_NUT_ICON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
      <Icon className="size-6" aria-hidden />
    </button>
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

  return (
    <div className="flex min-h-full flex-col bg-background md:flex-row">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r-2 border-border bg-card transition-[width] duration-200 md:flex",
          thuGon ? "w-20" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-20 shrink-0 items-center border-b-2 border-border",
            thuGon ? "justify-center px-2" : "px-4"
          )}
        >
          <Logo cao="h-11" hienChu={!thuGon} phuDe={thuGon ? undefined : "Xí nghiệp BSF1"} />
        </div>
        <nav className="scroll-nice flex-1 space-y-1.5 overflow-y-auto p-3">
          {items.map((n) => {
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
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border-2 text-left text-base font-semibold transition-colors",
                  thuGon ? "justify-center px-0" : "px-4",
                  chon
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-transparent text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-6 shrink-0" aria-hidden />
                {!thuGon && <span className="min-w-0 truncate">{n.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Cột nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-20 shrink-0 items-center justify-between gap-3 border-b-2 border-border bg-card px-4 sm:px-6">
          {/* Trái */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <HeaderNut
              label={thuGon ? "Mở thanh bên" : "Thu thanh bên"}
              icon={thuGon ? PanelLeftOpen : PanelLeftClose}
              onClick={() => setThuGon((v) => !v)}
              className="hidden md:inline-flex"
            />
            <Logo cao="h-9" hienChu={false} className="md:hidden" />
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                Baseafood MES{breadcrumb ? ` · ${breadcrumb}` : ""}
              </p>
              <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">
                {tieuDe}
              </h1>
            </div>
          </div>

          {/* Phải */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {ca && (
              <>
                <button
                  type="button"
                  onClick={onDoiCa}
                  className="hidden h-11 items-center gap-2 rounded-lg border-2 border-input px-3.5 text-base font-semibold text-foreground transition-colors hover:bg-muted xl:inline-flex"
                >
                  <RefreshCw className="size-5" aria-hidden />
                  {ca}
                </button>
                <HeaderNut
                  label={`Đổi ca kíp — đang là ${ca}`}
                  icon={RefreshCw}
                  onClick={onDoiCa}
                  className="xl:hidden"
                />
              </>
            )}

            {typeof soThongBao === "number" && (
              <span className="relative inline-flex">
                <HeaderNut
                  label={`Thông báo (${soThongBao} chưa đọc)`}
                  icon={Bell}
                  onClick={onThongBao}
                />
                {soThongBao > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground tnum"
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
            <NutGiaoDien taiKhoan={taiKhoan} />
            <NutTrangThai />

            <div className="flex items-center gap-2 border-l-2 border-border pl-2 sm:gap-3 sm:pl-3">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground"
              >
                {VietTat(nguoiDung)}
              </span>
              <div className="hidden min-w-0 text-right xl:block">
                <p className="truncate text-sm font-semibold text-foreground">
                  {nguoiDung}
                </p>
                <p className="truncate text-xs text-muted-foreground">{vaiTro}</p>
              </div>
              {onDangXuat && (
                <HeaderNut
                  label="Đăng xuất"
                  icon={LogOut}
                  onClick={onDangXuat}
                  className="hover:text-destructive"
                />
              )}
            </div>
          </div>
        </header>

        <main className="w-full flex-1 p-5 pb-28 sm:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-(--app-content-width)">{children}</div>
        </main>
      </div>

      {/* Bottom-tab điện thoại — nav dài nên cuộn ngang */}
      <nav className="scroll-nice fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t-2 border-border bg-card px-1 md:hidden">
        {items.map((n) => {
          const Icon = n.icon;
          const chon = active === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              aria-current={chon ? "page" : undefined}
              className={cn(
                "flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold transition-colors",
                chon ? "text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  chon && "bg-accent"
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="leading-tight">{n.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
