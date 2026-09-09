// ============================================================
// Tên file: src/features/shared/AppShell.tsx
// Tên tiếng Việt tương đương: Khung Giao diện MES BSF1 (Sidebar + Header + Content)
// Description: Main MES Layout App Shell with Navigation Sidebar
// ============================================================
// src/features/shared/AppShell.tsx
import { useEffect, useState, type ReactNode } from "react";
import {
  Badge,
  Logo,
  NutGiaoDien,
  NutHuongDan,
  NutTrangThai,
  XacNhan,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { BangCapNhat } from "./UpdateBanner";
import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  QrCode,
  ShieldCheck,
  ThermometerSnowflake,
  BarChart3,
  GitBranch,
  Truck,
  ShoppingCart,
  Snowflake,
  PackageCheck,
  Package,
  Scale,
  Library,
  Users,
  FileSpreadsheet,
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

export interface MucNavShell {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Màn còn dùng dữ liệu mẫu (chỉ admin thấy) — hiện cờ "DEMO" trên nav. */
  demo?: boolean;
}

/** id = path route. Danh sách phẳng (icon/nhãn/cờ demo) — thứ tự & gom nhóm do CAY_NAV quyết định. */
export const KIT_NAV: MucNavShell[] = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "production", label: "Lệnh sản xuất", icon: ClipboardList, demo: true },
  { id: "wip", label: "Sản xuất thành phẩm", icon: Factory },
  { id: "packaging", label: "Đóng gói", icon: Package },
  { id: "quality", label: "Chất lượng", icon: ShieldCheck, demo: true },
  { id: "qc", label: "Kiểm tra QC", icon: ClipboardCheck },
  { id: "imports", label: "Nhập hàng", icon: Truck },
  { id: "warehouse", label: "Kho dự trữ", icon: Snowflake },
  { id: "cold-storage", label: "Kho lạnh", icon: ThermometerSnowflake, demo: true },
  { id: "qr", label: "Quét lô (QR)", icon: QrCode },
  { id: "sales", label: "Bán hàng", icon: ShoppingCart },
  { id: "orders", label: "Đơn đặt", icon: PackageCheck },
  { id: "balancing", label: "Cân đối", icon: Scale },
  { id: "bc-thanh-pham", label: "BC Thành phẩm", icon: CalendarCheck },
  { id: "bc-don-xuat", label: "BC Đơn xuất", icon: Ship },
  { id: "nxt-nl", label: "Tồn kho NL", icon: Boxes },
  { id: "nxt", label: "Báo cáo NXT", icon: FileSpreadsheet },
  { id: "nxt-kho", label: "XNT kho (số thật)", icon: Warehouse },
  { id: "ton-kho-thang", label: "Sổ kho theo tháng", icon: CalendarRange },
  { id: "reports", label: "Báo cáo", icon: BarChart3, demo: true },
  { id: "traceability", label: "Truy xuất", icon: GitBranch, demo: true },
  { id: "catalog", label: "Danh mục", icon: Library },
  { id: "users", label: "Người dùng", icon: Users },
  { id: "audit", label: "Nhật ký", icon: History },
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
export interface NavCon {
  ref?: string;
  to?: string;
  gateId?: string;
  label?: string;
  icon?: LucideIcon;
}
export interface NhomCay {
  ten: string;
  icon: LucideIcon;
  con: NavCon[];
}

/**
 * MỘT mục "Tra cứu" cho mỗi module — mở đúng danh mục liên quan (deep-link `?tab=`).
 * Gom về 1 mục thay vì 1-mục-mỗi-tab: danh mục vốn là MỘT trang nhiều tab, không
 * cần tách sidebar theo từng tab. Danh mục ĐẦY ĐỦ vẫn ở nhóm Hệ thống ("Danh mục").
 */
const TRACUU = (tab: string): NavCon => ({
  to: `catalog?tab=${tab}`,
  gateId: "catalog",
  label: "Tra cứu",
  icon: Search,
});

export const CAY_NAV: NhomCay[] = [
  { ten: "Tổng quan", icon: LayoutDashboard, con: [{ ref: "dashboard" }] },
  {
    ten: "Nhập hàng",
    icon: Truck,
    con: [{ ref: "imports" }, { ref: "nxt-nl" }, TRACUU("dai-ly")],
  },
  {
    ten: "Sản xuất",
    icon: Factory,
    con: [
      { ref: "wip" },
      { ref: "packaging" },
      { ref: "qc" },
      TRACUU("mat-hang"),
      { ref: "production" },
      { ref: "quality" },
    ],
  },
  {
    ten: "Kho",
    icon: Warehouse,
    con: [
      { ref: "warehouse" },
      { ref: "ton-kho-thang" },
      { ref: "qr" },
      { ref: "nxt-kho" },
      { ref: "cold-storage" },
    ],
  },
  {
    ten: "Kinh doanh",
    icon: ShoppingCart,
    con: [{ ref: "sales" }, { ref: "orders" }, TRACUU("khach-hang")],
  },
  {
    ten: "Báo cáo & Cân đối",
    icon: BarChart3,
    con: [
      { ref: "balancing" },
      { ref: "bc-thanh-pham" },
      { ref: "bc-don-xuat" },
      { ref: "nxt" },
      { ref: "reports" },
      { ref: "traceability" },
    ],
  },
  {
    ten: "Hệ thống",
    icon: Library,
    con: [{ ref: "catalog" }, { ref: "users" }, { ref: "audit" }],
  },
];

/** Một mục con đã phân giải để hiển thị (đã lọc quyền). */
interface MucCon {
  key: string; // định danh so khớp active
  target: string; // path để điều hướng (id hoặc "catalog?tab=…")
  label: string;
  icon: LucideIcon;
  demo?: boolean;
  laDanhMuc: boolean; // deep-link danh mục (style phụ + ẩn khi thu gọn)
}
interface NhomHienThi {
  ten: string;
  icon: LucideIcon;
  muc: MucCon[];
}

/**
 * Phân giải cây theo danh sách nav đã lọc quyền (`items`).
 * - `ref`: giữ khi `items` có id đó (đã gồm lọc demo/vai trò ở App.tsx).
 * - deep-link: giữ khi `items` có `gateId` (VD "catalog").
 * Mục trong `items` không nằm trong cây rơi vào nhóm "Khác" để không mất.
 */
function gomCay(items: MucNavShell[]): NhomHienThi[] {
  const con = new Map(items.map((i) => [i.id, i]));
  const daDung = new Set<string>();
  const nhom: NhomHienThi[] = [];

  for (const g of CAY_NAV) {
    const muc: MucCon[] = [];
    for (const c of g.con) {
      if (c.ref) {
        const m = con.get(c.ref);
        if (!m) continue;
        muc.push({
          key: m.id === "catalog" ? "catalog" : m.id,
          target: m.id,
          label: m.label,
          icon: m.icon,
          demo: m.demo,
          laDanhMuc: false,
        });
        daDung.add(c.ref);
      } else if (c.to && c.gateId && con.has(c.gateId)) {
        muc.push({
          key: c.to,
          target: c.to,
          label: c.label ?? "",
          icon: c.icon ?? Library,
          laDanhMuc: true,
        });
      }
    }
    // Bỏ deep-link danh mục MỒ CÔI: nếu module không có MÀN thật nào người dùng
    // thấy (vai trò bộ phận), đừng hiện nhánh chỉ có shortcut danh mục — danh mục
    // đầy đủ vẫn vào được ở nhóm Hệ thống. (Admin có đủ màn nên không đụng.)
    const coMan = muc.some((m) => !m.laDanhMuc);
    const mucGiu = coMan ? muc : [];
    if (mucGiu.length) nhom.push({ ten: g.ten, icon: g.icon, muc: mucGiu });
  }

  const conLai = items.filter((i) => !daDung.has(i.id));
  if (conLai.length) {
    nhom.push({
      ten: "Khác",
      icon: Library,
      muc: conLai.map((m) => ({
        key: m.id,
        target: m.id,
        label: m.label,
        icon: m.icon,
        demo: m.demo,
        laDanhMuc: false,
      })),
    });
  }
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

/** Một mục lá trong cây nav. */
function MucNut({
  m,
  chon,
  thuGon,
  onSelect,
}: {
  m: MucCon;
  chon: boolean;
  thuGon: boolean;
  onSelect: (target: string) => void;
}) {
  const Icon = m.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(m.target)}
      aria-current={chon ? "page" : undefined}
      title={thuGon ? m.label : undefined}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-lg border text-left transition-colors",
        thuGon ? "justify-center px-0" : "px-3",
        m.laDanhMuc ? "text-sm font-medium" : "text-sm font-semibold",
        chon
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : m.laDanhMuc
            ? "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            : "border-transparent text-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("shrink-0", m.laDanhMuc ? "size-icon-sm" : "size-icon")} aria-hidden />
      {!thuGon && <span className="min-w-0 truncate">{m.label}</span>}
      {!thuGon && m.demo && (
        <Badge variant="outline" className="ml-auto shrink-0">
          DEMO
        </Badge>
      )}
    </button>
  );
}

/**
 * Cây nav dọc gập/mở theo nhóm module. `thuGon` (chỉ sidebar desktop) = icon-only:
 * bỏ nhãn + bỏ deep-link danh mục (còn nút Danh mục đầy đủ), bỏ qua trạng thái gập.
 */
function CayNav({
  nhom,
  activeKey,
  onSelect,
  thuGon = false,
  moNhom,
  onToggle,
}: {
  nhom: NhomHienThi[];
  activeKey: string;
  onSelect: (target: string) => void;
  thuGon?: boolean;
  moNhom: Record<string, boolean>;
  onToggle: (ten: string) => void;
}) {
  return (
    <nav className="scroll-nice flex-1 overflow-y-auto p-3">
      {nhom.map((g, i) => {
        if (thuGon) {
          const muc = g.muc.filter((m) => !m.laDanhMuc);
          if (!muc.length) return null;
          return (
            <div key={g.ten} className={cn(i > 0 && "mt-4")}>
              {i > 0 && <div className="mx-2 mb-3 border-t-2 border-border" />}
              <div className="space-y-1.5">
                {muc.map((m) => (
                  <MucNut
                    key={m.key}
                    m={m}
                    chon={activeKey === m.key}
                    thuGon
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        }
        // Nhóm chỉ một màn (VD Tổng quan) → hiện thẳng, khỏi tiêu đề gập cho đỡ lặp.
        if (g.muc.length === 1) {
          return (
            <div key={g.ten} className={cn(i > 0 && "mt-3")}>
              <MucNut
                m={g.muc[0]}
                chon={activeKey === g.muc[0].key}
                thuGon={false}
                onSelect={onSelect}
              />
            </div>
          );
        }
        const mo = moNhom[g.ten] !== false; // mặc định mở
        const GIcon = g.icon;
        const coActive = g.muc.some((m) => m.key === activeKey);
        return (
          <div key={g.ten} className={cn(i > 0 && "mt-2")}>
            {/* Tiêu đề nhóm module = 1 LỚP: chữ hoa nhỏ + gạch dưới nhạt cho tách
                lớp; đổi màu brand khi có màn con đang mở hoặc nhóm đang thu. */}
            <button
              type="button"
              onClick={() => onToggle(g.ten)}
              aria-expanded={mo}
              className={cn(
                "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold uppercase tracking-wide transition-colors hover:bg-muted",
                coActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <GIcon className="size-icon-sm shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{g.ten}</span>
              <ChevronDown
                className={cn(
                  "size-icon-sm shrink-0 transition-transform",
                  mo ? "" : "-rotate-90"
                )}
                aria-hidden
              />
            </button>
            {mo && (
              // Rail dọc + thụt lề = con thuộc nhóm này (nhìn thấy rõ phân lớp).
              // hien-len: mở nhóm thì danh sách con nhích lên hiện vào.
              <div className="hien-len mt-1 ml-5 space-y-1 border-l-2 border-border pl-2">
                {g.muc.map((m) => (
                  <MucNut
                    key={m.key}
                    m={m}
                    chon={activeKey === m.key}
                    thuGon={false}
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
  /** Tab danh mục đang mở (chỉ dùng khi active = "catalog") để tô sáng đúng deep-link. */
  activeTab?: string;
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

const KEY_NAV_NHOM = "bsf1:nav-nhom";

export default function AppShell({
  active,
  activeTab,
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
  const nhom = gomCay(items);

  // Deep-link danh mục tô sáng theo tab; các màn khác so theo id path.
  const activeKey =
    active === "catalog" ? (activeTab ? `catalog?tab=${activeTab}` : "catalog") : active;

  // Trạng thái gập/mở từng nhóm (mặc định mở), nhớ theo máy.
  const [moNhom, setMoNhom] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY_NAV_NHOM) || "{}");
    } catch {
      return {};
    }
  });
  const toggleNhom = (ten: string) =>
    setMoNhom((m) => {
      const next = { ...m, [ten]: m[ten] === false };
      try {
        localStorage.setItem(KEY_NAV_NHOM, JSON.stringify(next));
      } catch {
        /* bộ nhớ đầy / chặn cookie — bỏ qua, mặc định mở */
      }
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
          "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-base md:flex md:h-full md:overflow-hidden",
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
        <CayNav
          nhom={nhom}
          activeKey={activeKey}
          onSelect={onSelect}
          thuGon={thuGon}
          moNhom={moNhom}
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
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl duration-base animate-in slide-in-from-left"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Logo cao="h-9" phuDe="Xí nghiệp BSF1" />
              <HeaderNut label="Đóng menu" icon={X} onClick={() => setMoNav(false)} />
            </div>

            <CayNav
              nhom={nhom}
              activeKey={activeKey}
              onSelect={chon}
              moNhom={moNhom}
              onToggle={toggleNhom}
            />

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
          {/* Nhắc tải lại khi có bản deploy mới — ĐẶT NGOÀI khối đổi-trang để
              không bị mất/khởi tạo lại mỗi lần chuyển màn. */}
          <div className="mx-auto w-full max-w-(--app-content-width)">
            <BangCapNhat />
          </div>
          {/* key theo màn đang mở → fade nhẹ mỗi lần đổi trang (reduced-motion tắt) */}
          <div
            key={active}
            className="mx-auto w-full max-w-(--app-content-width) duration-fast animate-in fade-in-0"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
