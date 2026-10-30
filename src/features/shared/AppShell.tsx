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
  GuideButton,
  DataSyncStatusButton,
  useMediaQuery,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { readDevicePrefJson, writeDevicePrefJson } from "@/lib/devicePrefs";
import { UpdateBanner } from "./UpdateBanner";
import { usePageTourControl } from "./PageTourProvider";
import { AccountMenu, type AccountMenuProps } from "./AccountMenu";
import {
  LayoutDashboard,
  ListTodo,
  ClipboardCheck,
  ClipboardList,
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
  FolderOpen,
  Container,
  Warehouse,
  Boxes,
  Factory,
  CalendarCheck,
  CalendarRange,
  Ship,
  History,
  ShieldCheck,
  KeyRound,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  RefreshCw,
  Bell,
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
  /** Số đỏ cạnh nhãn (vd số việc đang được giao ở "Việc của tôi"); 0 / bỏ trống = không hiện. */
  badge?: number;
}

/** id = path route. Danh sách phẳng (icon/nhãn/cờ demo) — thứ tự & gom nhóm do NAV_TREE quyết định. */
export const KIT_NAV: ShellNavItem[] = [
  { id: "my-tasks", label: "Việc của tôi", icon: ListTodo, description: "Việc bạn cần làm và việc được giao, có hạn và cảnh báo quá hạn; bấm một việc là tới đúng màn, đúng ngày để làm." },
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
  { id: "planning-import", label: "Nhập khẩu", icon: Ship, description: "Hợp đồng nhập khẩu với nhà cung cấp nước ngoài: chứng từ từng lần hàng về (Invoice, Packing List, tờ khai nhập, C/O, kiểm dịch) và số lượng thực nhập. Khác Nhập hàng nguyên liệu trong nước." },
  { id: "planning-production", label: "Lệnh sản xuất", icon: ClipboardList, description: "Lệnh sản xuất của Phòng Kế hoạch: lập từ dòng hàng hợp đồng xuất, gắn nguyên liệu nhập khẩu dự kiến, phát hành tới Ban quản đốc phân xưởng và Thủ kho, gắn chuyến xuất, in mẫu QTI-KH-01-04." },
  { id: "planning-export", label: "Xuất khẩu", icon: Container, description: "Kế hoạch xuất khẩu theo tháng: từng khách, từng hợp đồng, từng chuyến container đang ở bước nào (hợp đồng → lệnh SX → bao bì → đóng cont → chứng từ) và còn thiếu gì." },
  { id: "documents", label: "Tài liệu công ty", icon: FolderOpen, description: "Quy trình, biểu mẫu, chứng nhận, hồ sơ năng lực của công ty: bản đang hiệu lực, các lần ban hành và file gốc. Chỉ thấy tài liệu của phòng mình." },
  { id: "catalog", label: "Danh mục", icon: Library , description: "Danh mục dùng chung: mặt hàng, khách hàng, đại lý, loại nguyên liệu, bột tẩm, kho lưu trữ, thành phẩm." },
  { id: "admin", label: "Tổng quan quản trị", icon: LayoutGrid , description: "Trang riêng của quản trị viên: tình trạng tài khoản, vai trò và lối vào các việc quản trị." },
  { id: "users", label: "Người dùng", icon: Users , description: "Quản lý tài khoản đăng nhập và vai trò của từng người." },
  { id: "roles", label: "Vai trò & quyền", icon: KeyRound , description: "Tick quyền xem · thêm · sửa · xóa · chốt · mở lại… của từng vai trò ở từng màn, và chỉnh riêng cho từng người." },
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
const LOOKUP_CHILD = (tab: string): NavTreeChild => ({
  to: `catalog?tab=${tab}`,
  gateId: "catalog",
  label: "Tra cứu",
  icon: Search,
});

export const NAV_TREE: NavTreeGroup[] = [
  // Một màn ⇒ hiện thẳng, không tiêu đề gập. Đứng đầu: việc cần làm là thứ mở app ra xem trước.
  { name: "Việc của tôi", icon: ListTodo, children: [{ ref: "my-tasks" }] },
  { name: "Tổng quan", icon: LayoutDashboard, children: [{ ref: "dashboard" }] },
  {
    name: "Nhập hàng",
    icon: Truck,
    children: [{ ref: "imports" }, { ref: "nxt-material" }, LOOKUP_CHILD("suppliers")],
  },
  {
    name: "Sản xuất",
    icon: Factory,
    children: [
      { ref: "wip" },
      { ref: "packaging" },
      { ref: "qc" },
      LOOKUP_CHILD("products"),
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
      LOOKUP_CHILD("storage-locations"),
    ],
  },
  {
    name: "Kinh doanh",
    icon: ShoppingCart,
    children: [{ ref: "sales" }, { ref: "orders" }, LOOKUP_CHILD("customers")],
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
  // Phòng Kế hoạch: Xuất khẩu · Nhập khẩu (ba-spec 45); "Khác" thêm vào nhánh này về sau. MỘT mục Tra cứu
  // (ba-spec 45 v2 R19, chủ dự án chọn): mở danh mục NCC nhập khẩu. Tra cứu Khách hàng ở nhóm Bán hàng.
  // Thứ tự theo dòng việc (chủ dự án 2026-10-30): Nhập khẩu (NL về) → Lệnh sản xuất → Xuất khẩu (chuyến).
  { name: "Kế hoạch", icon: Container, children: [{ ref: "planning-import" }, { ref: "planning-production" }, { ref: "planning-export" }, LOOKUP_CHILD("import-suppliers")] },
  { name: "Tài liệu công ty", icon: FolderOpen, children: [{ ref: "documents" }] },
  {
    name: "Hệ thống",
    icon: Library,
    children: [{ ref: "catalog" }],
  },
  {
    // Chỉ admin thấy (mọi mục là tài nguyên adminOnly — lib/permissions.ts).
    name: "Quản trị",
    icon: ShieldCheck,
    children: [{ ref: "admin" }, { ref: "users" }, { ref: "roles" }, { ref: "audit" }],
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
  badge?: number;
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
  const childById = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const group: DisplayGroup[] = [];

  for (const g of NAV_TREE) {
    const childItems: NavChild[] = [];
    for (const c of g.children) {
      if (c.ref) {
        const m = childById.get(c.ref);
        if (!m) continue;
        childItems.push({
          key: m.id === "catalog" ? "catalog" : m.id,
          target: m.id,
          label: m.label,
          description: m.description,
          icon: m.icon,
          demo: m.demo,
          badge: m.badge,
          isCatalogLink: false,
        });
        used.add(c.ref);
      } else if (c.to && c.gateId && childById.has(c.gateId)) {
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
    const hasScreens = childItems.some((m) => !m.isCatalogLink);
    const keptItems = hasScreens ? childItems : [];
    if (keptItems.length) group.push({ name: g.name, icon: g.icon, items: keptItems });
  }

  const remaining = items.filter((i) => !used.has(i.id));
  if (remaining.length) {
    group.push({
      name: "Khác",
      icon: Library,
      items: remaining.map((m) => ({
        key: m.id,
        target: m.id,
        label: m.label,
        description: m.description,
        icon: m.icon,
        demo: m.demo,
        badge: m.badge,
        isCatalogLink: false,
      })),
    });
  }
  return group;
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
      title={isCollapsed ? [m.badge ? `${m.label} (${m.badge})` : m.label, m.description].filter(Boolean).join(" — ") : m.description}
      className={cn(
        "press-feedback relative flex min-h-10 w-full items-center gap-3 rounded-lg border text-left",
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
        <Tag variant="muted" className="ml-auto">
          DEMO
        </Tag>
      )}
      {!!m.badge && (
        <span
          aria-label={`${m.badge} việc`}
          className={cn(
            "tnum rounded-full bg-destructive px-2 text-sm font-bold text-destructive-foreground",
            isCollapsed ? "absolute -right-1 -top-1" : "ml-auto"
          )}
        >
          {m.badge}
        </span>
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
  onToggle: (name: string) => void;
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
        const open = openGroups[g.name] !== false; // mặc định mở
        const GIcon = g.icon;
        const hasActive = g.items.some((m) => m.key === activeKey);
        return (
          <div key={g.name} className={cn(i > 0 && "mt-2")}>
            {/* Tiêu đề nhóm module = 1 LỚP: chữ hoa nhỏ + gạch dưới nhạt cho tách
                lớp; đổi màu brand khi có màn con đang mở hoặc nhóm đang thu. */}
            <button
              title="Gập / mở nhóm menu này. Máy nhớ trạng thái cho lần vào sau."
              type="button"
              onClick={() => onToggle(g.name)}
              aria-expanded={open}
              className={cn(
                "press-feedback",
                "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold uppercase tracking-wide transition-colors hover:bg-muted",
                hasActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <GIcon className="size-icon-sm shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <ChevronDown
                className={cn(
                  "size-icon-sm shrink-0 transition-transform duration-base ease-soft",
                  open ? "" : "-rotate-90"
                )}
                aria-hidden
              />
            </button>
            {open && (
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
  /** Có ⇒ menu tài khoản có "Đăng xuất khỏi mọi máy". */
  onLogoutEverywhere?: () => void;
  /** Tên đăng nhập hiện trong menu tài khoản. */
  username?: string;
  onChangePassword?: AccountMenuProps["onChangePassword"];
  /** Có ⇒ menu tài khoản có "Đặt tên gọi" (ba-spec 47). */
  nicknameEditor?: AccountMenuProps["nicknameEditor"];
  /** Có ⇒ menu tài khoản có lối vào khu quản trị (admin). */
  onOpenAdmin?: () => void;
  /** Danh sách nav (đã lọc theo quyền). Mặc định KIT_NAV. */
  items?: ShellNavItem[];
  /** Nút thêm ở header, đứng trước trạng thái đồng bộ (VD nút Chế độ demo của admin). */
  headerActions?: ReactNode;
  children: ReactNode;
}

const KEY_NAV_GROUPS = "bsf1:nav-nhom";
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
  onLogoutEverywhere,
  username,
  onChangePassword,
  nicknameEditor,
  onOpenAdmin,
  items = KIT_NAV,
  headerActions,
  children,
}: AppShellProps) {
  // Trang đang mở có khai "hướng dẫn từng bước" ⇒ nút "?" có lối bắt đầu (ba-spec 43).
  const pageTour = usePageTourControl();
  // Thanh bên thu về dải icon: TỰ ĐỘNG ở màn hẹp (iPhone ngang, iPad dọc) để
  // nhường chỗ cho tiêu đề + bảng; người dùng bấm nút thu/mở thì theo ý họ —
  // nhưng chỉ trong cùng một cỡ màn: xoay máy sang cỡ khác là về lại mặc định.
  const isNarrowSidebar = useMediaQuery(MEDIA_NARROW_SIDEBAR);
  const [collapsePick, setCollapsePick] = useState<{ narrow: boolean; collapsed: boolean } | null>(null);
  const isCollapsed =
    collapsePick && collapsePick.narrow === isNarrowSidebar ? collapsePick.collapsed : isNarrowSidebar;
  const [moNav, setMoNav] = useState(false);
  const group = groupTree(items);

  // Deep-link danh mục tô sáng theo tab; các màn khác so theo id path.
  const activeKey =
    active === "catalog" ? (activeTab ? `catalog?tab=${activeTab}` : "catalog") : active;

  // Trạng thái gập/mở từng nhóm (mặc định mở), nhớ theo máy.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readDevicePrefJson(KEY_NAV_GROUPS, {}, isGroupFlags),
  );
  const toggleGroup = (name: string) =>
    setOpenGroups((m) => {
      const next = { ...m, [name]: m[name] === false };
      writeDevicePrefJson(KEY_NAV_GROUPS, next);
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
          groups={group}
          activeKey={activeKey}
          onSelect={onSelect}
          collapsed={isCollapsed}
          openGroups={openGroups}
          onToggle={toggleGroup}
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
              groups={group}
              activeKey={activeKey}
              onSelect={select}
              openGroups={openGroups}
              onToggle={toggleGroup}
            />

            {/* Chân drawer: những gì KHÔNG còn chỗ trên header điện thoại. Tài khoản
                (giao diện, mật khẩu, đăng xuất) nằm ở menu avatar trên header. */}
            <div className="shrink-0 space-y-3 border-t border-border p-3 short-landscape:p-2">
              <div className="flex flex-wrap items-center gap-2">
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
                    title="Mở Việc của tôi: các việc đang được giao cho bạn."
                    type="button"
                    onClick={onOpenNotifications}
                    className="press-feedback inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <Bell className="size-icon-sm" aria-hidden />
                    Việc được giao
                    {notificationCount > 0 && (
                      <span className="tnum rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground">
                        {notificationCount}
                      </span>
                    )}
                  </button>
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

          {/* Phải — điện thoại chỉ giữ trạng thái + hướng dẫn; phần còn lại ở drawer.
              Điện thoại khít khoảng cách (gap-1) để tiêu đề trang còn chỗ ở cỡ chữ 130 %. */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
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
                  label={`Việc được giao cho bạn (${notificationCount} việc đang mở) — mở Việc của tôi`}
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

            {(guide || pageTour.available) && (
              <GuideButton
                title={guide?.title ?? title}
                description={guide?.description}
                onStartTour={pageTour.available ? pageTour.start : undefined}
              >
                {guide?.content}
              </GuideButton>
            )}
            {headerActions}
            <DataSyncStatusButton />

            {/* Menu tài khoản ở avatar — MỌI cỡ màn: giao diện · mật khẩu · quản trị ·
                đăng xuất (trước đây điện thoại chỉ có đăng xuất ở chân drawer). */}
            <div className="flex items-center md:border-l md:border-border md:pl-3">
              <AccountMenu
                displayName={profile}
                username={username}
                role={role}
                account={account}
                onChangePassword={onChangePassword}
                nicknameEditor={nicknameEditor}
                onOpenAdmin={onOpenAdmin}
                onSignOut={onSignOut}
                onSignOutEverywhere={onLogoutEverywhere}
              />
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
