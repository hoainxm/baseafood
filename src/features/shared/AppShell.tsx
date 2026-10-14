// ============================================================
// Tên file: src/features/shared/AppShell.tsx
// Tên tiếng Việt tương đương: Khung Giao diện MES BSF1 (Sidebar + Header + Content)
// Description: Main MES Layout App Shell with Navigation Sidebar
// ============================================================
// src/features/shared/AppShell.tsx
import { useEffect, useState, type ReactNode } from "react";
import {
  Tag,
  HoverHint,
  Logo,
  MEDIA_NARROW_SIDEBAR,
  DisplaySettingsButton,
  GuideButton,
  DataSyncStatusButton,
  ConfirmAction,
  useMediaQuery,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { readDevicePrefJson, writeDevicePrefJson } from "@/lib/devicePrefs";
import { UpdateBanner } from "./UpdateBanner";
import {
  LayoutDashboard,
  ClipboardCheck,
  QrCode,
  BarChart3,
  Truck,
  ShoppingCart,
  Snowflake,
  PackageCheck,
  Package,
  Scale,
  Library,
  Users,
  FileSpreadsheet,
  FileCheck2,
  Warehouse,
  Boxes,
  Factory,
  CalendarCheck,
  CalendarRange,
  Ship,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  RefreshCw,
  Bell,
  LogOut,
  ChevronDown,
  Search,
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

export interface ShellNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Câu hướng dẫn hiện khi rê chuột lên mục nav — màn này để làm gì (README §9). */
  description?: string;
  /** Màn còn dùng dữ liệu mẫu (chỉ admin thấy) — hiện cờ "DEMO" trên nav. */
  demo?: boolean;
}

/** id = path route. Danh sách phẳng (icon/nhãn/cờ demo) — thứ tự & gom nhóm do NAV_TREE quyết định. */
export const KIT_NAV: ShellNavItem[] = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard , description: "Trang tổng quan: số liệu nổi bật trong ngày và lối tắt sang các màn hay dùng." },
  { id: "wip", label: "Sản xuất thành phẩm", icon: Factory , description: "Ghi sản lượng thành phẩm làm ra mỗi ngày theo xưởng, chốt ngày và gửi báo cáo." },
  { id: "packaging", label: "Đóng gói", icon: Package , description: "Ghi phiếu đóng gói: trừ bán thành phẩm đem đóng, cộng thành phẩm ra, tính hao hụt." },
  { id: "qc", label: "Kiểm tra QC", icon: ClipboardCheck , description: "Bảng kiểm QC chấm điểm cuối ngày theo từng chỉ tiêu, có chốt ngày và ghi bù." },
  { id: "imports", label: "Nhập hàng", icon: Truck , description: "Ghi chuyến nguyên liệu mua về mỗi ngày, ghi bù chờ hóa đơn và chốt sổ ngày." },
  { id: "warehouse", label: "Kho dự trữ", icon: Snowflake , description: "Kho dự trữ: duyệt lô bán thành phẩm từ chờ sang đã nhập kho và xem tồn." },
  { id: "qr", label: "Mã lô QR", icon: QrCode , description: "Quét tem lô (hoặc gõ mã) để tra nguồn gốc; in tem QR hàng loạt cho nguyên liệu, bán thành phẩm, thành phẩm." },
  { id: "sales", label: "Bán hàng", icon: ShoppingCart , description: "Ghi phiếu bán hàng: khách, kênh bán, quy cách và các dòng mặt hàng." },
  { id: "orders", label: "Đơn đặt", icon: PackageCheck , description: "Đơn đặt hàng xuất khẩu và lệnh xuất lấy hàng theo FIFO từ tồn kho." },
  { id: "balancing", label: "Cân đối kỳ", icon: Scale , description: "Cân đối theo kỳ (~5 ngày): tính định mức nguyên liệu → thành phẩm và lãi lỗ." },
  { id: "production-report", label: "Báo cáo thành phẩm", icon: CalendarCheck , description: "Báo cáo sản lượng thành phẩm theo ngày, in A4 hoặc xuất Excel." },
  { id: "export-report", label: "Báo cáo đơn xuất", icon: Ship , description: "Báo cáo các đơn đã xuất, in A4 hoặc xuất Excel." },
  { id: "nxt-material", label: "Tồn kho nguyên liệu", icon: Boxes , description: "Tồn kho nguyên liệu theo kỳ cân đối: tồn đầu, đông gửi, xả đông, tồn cuối." },
  { id: "nxt", label: "Tồn kho thành phẩm", icon: FileSpreadsheet , description: "Tồn kho thành phẩm theo khoảng ngày: nhập, xuất, tồn từng mã." },
  { id: "nxt-warehouse", label: "Nhập xuất tồn kho", icon: Warehouse , description: "Sổ Nhập–Xuất–Tồn theo báo cáo thật của xí nghiệp, kèm cột hàng đang nằm ở kho nào." },
  { id: "monthly-stock", label: "Sổ kho theo tháng", icon: CalendarRange , description: "Sổ kho theo tháng dương lịch cho cả nguyên liệu, bán thành phẩm và thành phẩm — tồn cuối tháng này tự thành tồn đầu tháng sau." },
  { id: "reconciliation", label: "Đối soát hóa đơn điện tử", icon: FileCheck2 , description: "Đối soát sổ phần mềm với hóa đơn điện tử, tìm dòng lệch và lưu bản đối soát." },
  { id: "catalog", label: "Danh mục", icon: Library , description: "Danh mục dùng chung: mặt hàng, khách hàng, đại lý, loại nguyên liệu, bột tẩm, kho lưu trữ, thành phẩm." },
  { id: "users", label: "Người dùng", icon: Users , description: "Quản lý tài khoản đăng nhập và vai trò của từng người." },
  { id: "audit", label: "Nhật ký thao tác", icon: History , description: "Nhật ký thao tác: ai sửa gì, lúc nào, giá trị trước và sau." },
];

/**
 * CÂY ĐIỀU HƯỚNG module-centric (họp 2026-09-02 QĐ-9): mỗi nhánh = một module,
 * con của nhánh gồm các màn của module + **deep-link tra danh mục NGAY trong
 * module** (VD Nhập hàng → Đại lý / Loại NL). Danh mục vẫn là MỘT nguồn duy nhất
 * (`/catalog`), deep-link chỉ mở đúng tab qua `?tab=` — không nhân bản dữ liệu.
 *
 * Một mục con là:
 *  - `{ ref }`  → trỏ tới một mục trong `KIT_NAV` (màn có route thật; lấy
 *    nhãn/icon/cờ demo từ đó, kiểm quyền theo `ref`).
 *  - deep-link `{ to, gateId, label, icon }` → mở `/catalog?tab=…`; kiểm quyền
 *    theo `gateId` (= "catalog").
 */
export interface NavTreeChild {
  ref?: string;
  to?: string;
  gateId?: string;
  label?: string;
  icon?: LucideIcon;
}
export interface NavTreeGroup {
  name: string;
  icon: LucideIcon;
  children: NavTreeChild[];
}

/**
 * MỘT mục "Tra cứu" cho mỗi module — mở đúng danh mục liên quan (deep-link `?tab=`).
 * Gom về 1 mục thay vì 1-mục-mỗi-tab: danh mục vốn là MỘT trang nhiều tab, không
 * cần tách sidebar theo từng tab. Danh mục ĐẦY ĐỦ vẫn ở nhóm Hệ thống ("Danh mục").
 */
const TRACUU = (tab: string): NavTreeChild => ({
  to: `catalog?tab=${tab}`,
  gateId: "catalog",
  label: "Tra cứu",
  icon: Search,
});

export const NAV_TREE: NavTreeGroup[] = [
  { name: "Tổng quan", icon: LayoutDashboard, children: [{ ref: "dashboard" }] },
  {
    name: "Nhập hàng",
    icon: Truck,
    children: [{ ref: "imports" }, { ref: "nxt-material" }, TRACUU("suppliers")],
  },
  {
    name: "Sản xuất",
    icon: Factory,
    children: [
      { ref: "wip" },
      { ref: "packaging" },
      { ref: "qc" },
      TRACUU("products"),
    ],
  },
  {
    name: "Kho",
    icon: Warehouse,
    children: [
      { ref: "warehouse" },
      { ref: "monthly-stock" },
      { ref: "qr" },
      { ref: "nxt-warehouse" },
      TRACUU("storage-locations"),
    ],
  },
  {
    name: "Kinh doanh",
    icon: ShoppingCart,
    children: [{ ref: "sales" }, { ref: "orders" }, TRACUU("customers")],
  },
  {
    name: "Báo cáo & Cân đối",
    icon: BarChart3,
    children: [
      { ref: "balancing" },
      { ref: "production-report" },
      { ref: "export-report" },
      { ref: "nxt" },
      { ref: "reconciliation" },
    ],
  },
  {
    name: "Hệ thống",
    icon: Library,
    children: [{ ref: "catalog" }, { ref: "users" }, { ref: "audit" }],
  },
];

/** Một mục con đã phân giải để hiển thị (đã lọc quyền). */
interface NavChild {
  key: string; // định danh so khớp active
  target: string; // path để điều hướng (id hoặc "catalog?tab=…")
  label: string;
  description?: string;
  icon: LucideIcon;
  demo?: boolean;
  isCatalogLink: boolean; // deep-link danh mục (style phụ + ẩn khi thu gọn)
}
interface DisplayGroup {
  name: string;
  icon: LucideIcon;
  items: NavChild[];
}

/**
 * Phân giải cây theo danh sách nav đã lọc quyền (`items`).
 * - `ref`: giữ khi `items` có id đó (đã gồm lọc demo/vai trò ở App.tsx).
 * - deep-link: giữ khi `items` có `gateId` (VD "catalog").
 * Mục trong `items` không nằm trong cây rơi vào nhóm "Khác" để không mất.
 */
function groupTree(items: ShellNavItem[]): DisplayGroup[] {
  const con = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const nhom: DisplayGroup[] = [];

  for (const g of NAV_TREE) {
    const childItems: NavChild[] = [];
    for (const c of g.children) {
      if (c.ref) {
        const m = con.get(c.ref);
        if (!m) continue;
        childItems.push({
          key: m.id === "catalog" ? "catalog" : m.id,
          target: m.id,
          label: m.label,
          description: m.description,
          icon: m.icon,
          demo: m.demo,
          isCatalogLink: false,
        });
        used.add(c.ref);
      } else if (c.to && c.gateId && con.has(c.gateId)) {
        childItems.push({
          key: c.to,
          target: c.to,
          label: c.label ?? "",
          description: "Mở danh mục liên quan tới module này (cùng một trang Danh mục, chỉ nhảy đúng tab).",
          icon: c.icon ?? Library,
          isCatalogLink: true,
        });
      }
    }
    // Bỏ deep-link danh mục MỒ CÔI: nếu module không có MÀN thật nào người dùng
    // thấy (vai trò bộ phận), đừng hiện nhánh chỉ có shortcut danh mục — danh mục
    // đầy đủ vẫn vào được ở nhóm Hệ thống. (Admin có đủ màn nên không đụng.)
    const coMan = childItems.some((m) => !m.isCatalogLink);
    const keptItems = coMan ? childItems : [];
    if (keptItems.length) nhom.push({ name: g.name, icon: g.icon, items: keptItems });
  }

  const remaining = items.filter((i) => !used.has(i.id));
  if (remaining.length) {
    nhom.push({
      name: "Khác",
      icon: Library,
      items: remaining.map((m) => ({
        key: m.id,
        target: m.id,
        label: m.label,
        description: m.description,
        icon: m.icon,
        demo: m.demo,
        isCatalogLink: false,
      })),
    });
  }
  return nhom;
}

const ICON_BUTTON_CLASS =
  "press-feedback inline-flex size-tap shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function HeaderButton({
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
      className={cn(ICON_BUTTON_CLASS, className)}
    >
      <Icon className="size-icon" aria-hidden />
    </button>
  );
}

/** Một mục lá trong cây nav. */
function NavItemButton({
  m,
  isActive: isCurrent,
  collapsed: isCollapsed,
  onSelect,
}: {
  m: NavChild;
  isActive: boolean;
  collapsed: boolean;
  onSelect: (target: string) => void;
}) {
  const Icon = m.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(m.target)}
      aria-current={isCurrent ? "page" : undefined}
      title={isCollapsed ? [m.label, m.description].filter(Boolean).join(" — ") : m.description}
      className={cn(
        "press-feedback flex min-h-10 w-full items-center gap-3 rounded-lg border text-left",
        isCollapsed ? "justify-center px-0" : "px-3",
        m.isCatalogLink ? "text-sm font-medium" : "text-sm font-semibold",
        isCurrent
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : m.isCatalogLink
            ? "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            : "border-transparent text-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("shrink-0", m.isCatalogLink ? "size-icon-sm" : "size-icon")} aria-hidden />
      {!isCollapsed && (
        <span className="min-w-0 whitespace-normal break-words leading-tight">{m.label}</span>
      )}
      {!isCollapsed && m.demo && (
        <Tag variant="phu" className="ml-auto">
          DEMO
        </Tag>
      )}
    </button>
  );
}

/**
 * Cây nav dọc gập/mở theo nhóm module. `thuGon` (chỉ sidebar desktop) = icon-only:
 * bỏ nhãn + bỏ deep-link danh mục (còn nút Danh mục đầy đủ), bỏ qua trạng thái gập.
 */
function NavTree({
  groups,
  activeKey,
  onSelect,
  collapsed: isCollapsed = false,
  openGroups,
  onToggle,
}: {
  groups: DisplayGroup[];
  activeKey: string;
  onSelect: (target: string) => void;
  collapsed?: boolean;
  openGroups: Record<string, boolean>;
  onToggle: (ten: string) => void;
}) {
  return (
    <nav className="scroll-nice flex-1 overflow-y-auto p-3">
      {groups.map((g, i) => {
        if (isCollapsed) {
          const childItems = g.items.filter((m) => !m.isCatalogLink);
          if (!childItems.length) return null;
          return (
            <div key={g.name} className={cn(i > 0 && "mt-4")}>
              {i > 0 && <div className="mx-2 mb-3 border-t-2 border-border" />}
              <div className="space-y-1.5">
                {childItems.map((m) => (
                  <NavItemButton
                    key={m.key}
                    m={m}
                    isActive={activeKey === m.key}
                    collapsed
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        }
        // Nhóm chỉ một màn (VD Tổng quan) → hiện thẳng, khỏi tiêu đề gập cho đỡ lặp.
        if (g.items.length === 1) {
          return (
            <div key={g.name} className={cn(i > 0 && "mt-3")}>
              <NavItemButton
                m={g.items[0]}
                isActive={activeKey === g.items[0].key}
                collapsed={false}
                onSelect={onSelect}
              />
            </div>
          );
        }
        const mo = openGroups[g.name] !== false; // mặc định mở
        const GIcon = g.icon;
        const coActive = g.items.some((m) => m.key === activeKey);
        return (
          <div key={g.name} className={cn(i > 0 && "mt-2")}>
            {/* Tiêu đề nhóm module = 1 LỚP: chữ hoa nhỏ + gạch dưới nhạt cho tách
                lớp; đổi màu brand khi có màn con đang mở hoặc nhóm đang thu. */}
            <button
              title="Gập / mở nhóm menu này. Máy nhớ trạng thái cho lần vào sau."
              type="button"
              onClick={() => onToggle(g.name)}
              aria-expanded={mo}
              className={cn(
                "press-feedback",
                "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold uppercase tracking-wide transition-colors hover:bg-muted",
                coActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <GIcon className="size-icon-sm shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <ChevronDown
                className={cn(
                  "size-icon-sm shrink-0 transition-transform duration-base ease-soft",
                  mo ? "" : "-rotate-90"
                )}
                aria-hidden
              />
            </button>
            {mo && (
              // Rail dọc + thụt lề = con thuộc nhóm này (nhìn thấy rõ phân lớp).
              // enter-up: mở nhóm thì danh sách con nhích lên hiện vào.
              <div className="enter-up mt-1 ml-5 space-y-1 border-l-2 border-border pl-2">
                {g.items.map((m) => (
                  <NavItemButton
                    key={m.key}
                    m={m}
                    isActive={activeKey === m.key}
                    collapsed={false}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Initials(ten: string): string {
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

export interface ShellPageGuide {
  title: string;
  description?: string;
  content: ReactNode;
}

export interface AppShellProps {
  active: string;
  /** Tab danh mục đang mở (chỉ dùng khi active = "catalog") để tô sáng đúng deep-link. */
  activeTab?: string;
  onSelect: (id: string) => void;
  title: string;
  breadcrumb?: string;
  displayName: string;
  role: string;
  /** Username để lưu cấu hình giao diện theo người dùng. */
  account?: string;
  /** Nội dung hướng dẫn của trang đang mở; bỏ trống ⇒ không hiện nút. */
  guide?: ShellPageGuide | null;
  shift?: string;
  onChangeShift?: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
  /** Danh sách nav (đã lọc theo quyền). Mặc định KIT_NAV. */
  items?: ShellNavItem[];
  children: ReactNode;
}

const KEY_NAV_NHOM = "bsf1:nav-nhom";
const isGroupFlags = (v: unknown): v is Record<string, boolean> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export default function AppShell({
  active,
  activeTab,
  onSelect,
  title,
  breadcrumb,
  displayName: profile,
  role,
  account,
  guide,
  shift,
  onChangeShift,
  notificationCount,
  onOpenNotifications,
  onLogout: onSignOut,
  items = KIT_NAV,
  children,
}: AppShellProps) {
  // Thanh bên thu về dải icon: TỰ ĐỘNG ở màn hẹp (iPhone ngang, iPad dọc) để
  // nhường chỗ cho tiêu đề + bảng; người dùng bấm nút thu/mở thì theo ý họ —
  // nhưng chỉ trong cùng một cỡ màn: xoay máy sang cỡ khác là về lại mặc định.
  const isNarrowSidebar = useMediaQuery(MEDIA_NARROW_SIDEBAR);
  const [collapsePick, setCollapsePick] = useState<{ narrow: boolean; collapsed: boolean } | null>(null);
  const isCollapsed =
    collapsePick && collapsePick.narrow === isNarrowSidebar ? collapsePick.collapsed : isNarrowSidebar;
  const [moNav, setMoNav] = useState(false);
  const nhom = groupTree(items);

  // Deep-link danh mục tô sáng theo tab; các màn khác so theo id path.
  const activeKey =
    active === "catalog" ? (activeTab ? `catalog?tab=${activeTab}` : "catalog") : active;

  // Trạng thái gập/mở từng nhóm (mặc định mở), nhớ theo máy.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readDevicePrefJson(KEY_NAV_NHOM, {}, isGroupFlags),
  );
  const toggleNhom = (ten: string) =>
    setOpenGroups((m) => {
      const next = { ...m, [ten]: m[ten] === false };
      writeDevicePrefJson(KEY_NAV_NHOM, next);
      return next;
    });

  // Drawer: đóng bằng Escape (bàn phím vẫn phải thoát được).
  useEffect(() => {
    if (!moNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoNav(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moNav]);

  const select = (id: string) => {
    onSelect(id);
    setMoNav(false);
  };

  return (
    /* Desktop: khoá chiều cao khung (h-dvh + overflow-hidden) để THANH BÊN và
       VÙNG NỘI DUNG cuộn RIÊNG — trước đây cuộn chung, kéo bảng dài là nav trôi
       mất. Điện thoại giữ cuộn trang tự nhiên (nav là drawer, có scroll riêng). */
    <div className="px-safe flex min-h-full flex-col bg-background md:h-dvh md:flex-row md:overflow-hidden">
      {/* Gợi ý rê chuột cho MỌI phần tử có `title` — gắn một lần cho cả app. */}
      <HoverHint />
      {/* Sidebar dọc — chỉ desktop */}
      <aside
        className={cn(
          "pb-safe hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-base ease-soft md:flex md:h-full md:overflow-hidden",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        <div
          className={cn(
            "flex h-header shrink-0 items-center border-b border-border",
            isCollapsed ? "justify-center px-2" : "px-4"
          )}
        >
          <Logo heightClass="h-9" showWordmark={!isCollapsed} subtitle={isCollapsed ? undefined : "Xí nghiệp BSF1"} />
        </div>
        <NavTree
          groups={nhom}
          activeKey={activeKey}
          onSelect={onSelect}
          collapsed={isCollapsed}
          openGroups={openGroups}
          onToggle={toggleNhom}
        />
      </aside>

      {/* Drawer điện thoại — CÙNG cây nav dọc, thêm chân chứa nút toàn cục */}
      {moNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMoNav(false)}
            className="absolute inset-0 bg-overlay duration-fast animate-in fade-in-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
            className="pl-safe pb-safe absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl duration-base ease-soft animate-in slide-in-from-left"
          >
            <div className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Logo heightClass="h-9" subtitle="Xí nghiệp BSF1" />
              <HeaderButton label="Đóng menu" icon={X} onClick={() => setMoNav(false)} />
            </div>

            <NavTree
              groups={nhom}
              activeKey={activeKey}
              onSelect={select}
              openGroups={openGroups}
              onToggle={toggleNhom}
            />

            {/* Chân drawer: những gì KHÔNG còn chỗ trên header điện thoại. Máy xoay
                ngang thấp: bỏ dòng tên người dùng để menu còn chỗ (chân không được
                ăn quá nửa chiều cao drawer). */}
            <div className="shrink-0 space-y-3 border-t border-border p-3 short-landscape:p-2">
              <div className="flex items-center gap-3 short-landscape:hidden">
                <span
                  aria-hidden
                  className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
                >
                  {Initials(profile)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {profile}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{role}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DisplaySettingsButton account={account} />
                {shift && (
                  <button
                    title="Đổi ca làm việc đang chọn — số liệu trên màn lọc theo ca này."
                    type="button"
                    onClick={onChangeShift}
                    className="press-feedback inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <RefreshCw className="size-icon-sm" aria-hidden />
                    {shift}
                  </button>
                )}
                {typeof notificationCount === "number" && (
                  <button
                    title="Xem các thông báo và việc cần làm trong ngày."
                    type="button"
                    onClick={onOpenNotifications}
                    className="press-feedback inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <Bell className="size-icon-sm" aria-hidden />
                    Thông báo
                    {notificationCount > 0 && (
                      <span className="tnum rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground">
                        {notificationCount}
                      </span>
                    )}
                  </button>
                )}
                {onSignOut && (
                  <ConfirmAction
                    title="Đăng xuất khỏi máy này?"
                    description="Số liệu đã ghi vẫn còn. Vào lại phải nhập tên đăng nhập và mật khẩu."
                    detail={`${profile} · ${role}`}
                    confirmLabel="Đăng xuất"
                    cancelLabel="Ở lại"
                    icon={LogOut}
                    onConfirm={onSignOut}
                    trigger={
                      <button
                        title="Thoát tài khoản và quay về màn đăng nhập."
                        type="button"
                        className="press-feedback inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground hover:bg-muted hover:text-destructive"
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
      <div className="scroll-nice pb-safe flex min-w-0 flex-1 flex-col md:h-full md:overflow-y-auto">
        <header className="sticky top-0 z-40 flex h-header shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:gap-3 md:px-6">
          {/* Trái — ĐƯỢC ƯU TIÊN ngân sách ngang (flex-1, không shrink-0) */}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <HeaderButton
              label="Mở menu"
              icon={Menu}
              onClick={() => setMoNav(true)}
              className="md:hidden"
            />
            <HeaderButton
              label={isCollapsed ? "Mở thanh bên" : "Thu thanh bên"}
              icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
              onClick={() => setCollapsePick({ narrow: isNarrowSidebar, collapsed: !isCollapsed })}
              className="hidden md:inline-flex"
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground short-landscape:hidden">
                Baseafood MES{breadcrumb ? ` · ${breadcrumb}` : ""}
              </p>
              {/* KHÔNG phải h1: mỗi màn tự có một h1 trong nội dung (màn không hiện tiêu đề thì
                  đặt h1 sr-only). Hai h1 ⇒ trình đọc màn hình đọc hai tiêu đề cấp 1 trùng nhau. */}
              <p className="truncate text-lg font-semibold text-foreground md:text-xl">
                {title}
              </p>
            </div>
          </div>

          {/* Phải — điện thoại chỉ giữ trạng thái + hướng dẫn; phần còn lại ở drawer */}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {shift && (
              <button
                title="Đổi ca làm việc đang chọn — số liệu trên màn lọc theo ca này."
                type="button"
                onClick={onChangeShift}
                className="press-feedback hidden min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground hover:bg-muted xl:inline-flex"
              >
                <RefreshCw className="size-icon-sm" aria-hidden />
                {shift}
              </button>
            )}

            {typeof notificationCount === "number" && (
              <span className="relative hidden md:inline-flex">
                <HeaderButton
                  label={`Thông báo (${notificationCount} chưa đọc)`}
                  icon={Bell}
                  onClick={onOpenNotifications}
                />
                {notificationCount > 0 && (
                  <span
                    aria-hidden
                    className="tnum absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
                  >
                    {notificationCount}
                  </span>
                )}
              </span>
            )}

            {guide && (
              <GuideButton title={guide.title} description={guide.description}>
                {guide.content}
              </GuideButton>
            )}
            <span className="hidden md:inline-flex">
              <DisplaySettingsButton account={account} />
            </span>
            <DataSyncStatusButton />

            <div className="hidden items-center gap-2 border-l border-border pl-2 md:flex md:gap-3 md:pl-3">
              <span
                aria-hidden
                className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
              >
                {Initials(profile)}
              </span>
              <div className="hidden min-w-0 text-right xl:block">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile}
                </p>
                <p className="truncate text-sm text-muted-foreground">{role}</p>
              </div>
              {onSignOut && (
                <ConfirmAction
                  title="Đăng xuất khỏi máy này?"
                  description="Số liệu đã ghi vẫn còn. Vào lại phải nhập tên đăng nhập và mật khẩu."
                  detail={`${profile} · ${role}`}
                  confirmLabel="Đăng xuất"
                  cancelLabel="Ở lại"
                  icon={LogOut}
                  onConfirm={onSignOut}
                  trigger={
                    <button
                      type="button"
                      aria-label="Đăng xuất"
                      title="Đăng xuất"
                      className={cn(ICON_BUTTON_CLASS, "hover:text-destructive")}
                    >
                      <LogOut className="size-icon" aria-hidden />
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </header>

        <main className="w-full flex-1 p-5 md:p-8 short-landscape:p-4">
          {/* Nhắc tải lại khi có bản deploy mới — ĐẶT NGOÀI khối đổi-trang để
              không bị mất/khởi tạo lại mỗi lần chuyển màn. */}
          <div className="mx-auto w-full max-w-(--app-content-width)">
            <UpdateBanner />
          </div>
          {/* key theo màn đang mở → fade nhẹ mỗi lần đổi trang (reduced-motion tắt) */}
          <div
            key={active}
            className="enter-fade mx-auto w-full max-w-(--app-content-width)"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
