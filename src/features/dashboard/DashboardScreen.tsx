// ============================================================
// Tên file: src/features/dashboard/DashboardScreen.tsx
// Tên tiếng Việt tương đương: Màn hình Tổng quan — Dòng chảy số liệu
// Description: Flow overview — KPI cards, 5-stage pipeline, "where did the kg go" bars, chain alerts,
//              daily series, balancing periods, NXT stock (real collections only)
// ============================================================
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  PipelineStages,
  SummaryTable,
  BarChart,
  TimeSeriesChart,
  Button,
  DateRangeField,
  EmptyState,
  Tag,
  Tabs,
  TabsList,
  TabsTrigger,
  ProportionBar,
  StatCardGrid,
  todayIso,
  toneForWorkshop,
  type SummaryTableColumn,
  type TagVariant,
  type ProportionSegment,
  type CategoryTone,
  type StatCardData,
} from "@/design-system";
import {
  useBalancingInputs,
  useBalancingOutputs,
  useBalancingPeriods,
  useDailyLocks,
  useFinishedGoodsOpeningStock,
  useMaterialOpeningStock,
  useNxtSnapshots,
  useProductionLocks,
  useScraps,
} from "@/lib/catalogRepo";
import { useTraceData } from "@/features/shared/useTraceData";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { useAuth } from "@/lib/auth";
import { IS_DEMO } from "@/lib/demoMode";
import { buildDashboardTour } from "./dashboardTour";
import {
  buildFlowStages,
  buildChainWarnings,
  buildDailyFlowSeries,
  computeYieldByProduct,
  buildDataFlow,
  computeAllPeriodResults,
  getWarningKindLabel,
  splitOutflows,
  YIELD_RATIO_THRESHOLD,
  type FlowWarning,
  type DataFlowInput,
  type PeriodBalancingResult,
  type FlowRange,
} from "@/lib/dataFlow";
import { getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import type { Workshop } from "@/types";
import type { TraceStageKey } from "@/lib/lotTraceability";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileSpreadsheet,
  Gauge,
  QrCode,
  Scale,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";

/**
 * Tổng quan = "Dòng chảy số liệu" (spec docs/spec/che-do-demo.md §5b): kg nguyên liệu
 * vào ⇒ qua 5 khâu ⇒ ra đâu, kèm việc cần đốc. Mọi số tính ở `lib/dataFlow.ts` (hàm
 * thuần có test) trên đúng các sổ thật — sổ nào trống thì hình trống trung thực.
 */

interface WarehouseRow {
  warehouse: string;
  periodFrom: string;
  periodTo: string;
  openingKg: number;
  inKg: number;
  outKg: number;
  closingKg: number;
  productCount: number;
}

const QUICK_PERIODS: { value: ViewPeriod; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
  { value: "custom", label: "Tự chọn" },
];
const WORKSHOP_QUICK = [
  { value: "tat-ca", label: "Cả 3 xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

/**
 * MÀU THEO LOẠI SỐ — một loại một sắc, dùng chung cho thẻ, băng chuyền và thanh chia
 * phần trên màn này để mắt nối được "thẻ xanh dương = nhập", "thẻ tím = sản xuất"…
 */
const KIND_TONES = {
  imports: "blue",
  production: "purple",
  yieldRatio: "sand",
  warehouse: "teal",
  packaging: "cyan",
  sales: "green",
  lots: "cyan",
} as const satisfies Record<string, CategoryTone>;
const STAGE_TONES: Record<TraceStageKey, CategoryTone> = {
  imports: KIND_TONES.imports,
  production: KIND_TONES.production,
  warehouse: KIND_TONES.warehouse,
  packaging: KIND_TONES.packaging,
  outbound: KIND_TONES.sales,
};

/** Tên + sắc + câu phụ cho từng phần của hai thanh "đi đâu" (id nút ở lib/dataFlow). */
const MATERIAL_PARTS: Record<string, { label: string; tone: CategoryTone; description?: string }> = {
  wip: { label: "Thành bán thành phẩm", tone: KIND_TONES.production },
  "domestic-sale": { label: "Bán thẳng nội địa", tone: KIND_TONES.sales },
  leftover: { label: "Còn dở, gửi đông", tone: KIND_TONES.warehouse, description: "ghi lúc chốt ngày sản xuất" },
  scrap: { label: "Phế liệu", tone: "orange" },
  loss: { label: "Hao hụt / chưa ghi ra", tone: "gray", description: "hao hụt chế biến hoặc NL chưa ghi dùng vào đâu" },
};
const WAREHOUSE_PARTS: Record<string, { label: string; tone: CategoryTone; description?: string }> = {
  packaging: { label: "Đem đóng gói", tone: KIND_TONES.packaging },
  "export-order": { label: "Xuất theo đơn", tone: KIND_TONES.sales },
  "block-sale": { label: "Bán block thô", tone: "pink" },
  "wip-stock": { label: "Còn trong kho", tone: KIND_TONES.warehouse },
};

/** Lùi / tiến mốc kỳ một bước (ngày · tuần · tháng · năm). */
function stepPeriod(period: ViewPeriod, anchor: string, step: 1 | -1): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  if (period === "day") d.setUTCDate(d.getUTCDate() + step);
  else if (period === "week") d.setUTCDate(d.getUTCDate() + 7 * step);
  else if (period === "month") d.setUTCMonth(d.getUTCMonth() + step, 1);
  else if (period === "year") d.setUTCFullYear(d.getUTCFullYear() + step, 0, 1);
  return d.toISOString().slice(0, 10);
}

/** Nhãn kỳ đang xem, ngắn: "Tháng 10/2026" · "Năm 2026" · "06/10 – 12/10/2026". */
function periodLabel(period: ViewPeriod, fromDate: string, toDate: string): string {
  if (period === "day") return formatDateVN(fromDate);
  if (period === "month") return `Tháng ${fromDate.slice(5, 7)}/${fromDate.slice(0, 4)}`;
  if (period === "year") return `Năm ${fromDate.slice(0, 4)}`;
  return `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`;
}

const LEVEL_LABELS: Record<FlowWarning["level"], { text: string; variant: TagVariant }> = {
  error: { text: "Sổ sai", variant: "error" },
  reminder: { text: "Chưa làm", variant: "warning" },
  info: { text: "Để biết", variant: "muted" },
};

const formatMoney = (n: number) => `${n < 0 ? "−" : ""}${num(Math.abs(Math.round(n)))} đ`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Section({
  title,
  description,
  actions,
  children,
  className,
  tourTarget,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Mốc `data-tour` cho hướng dẫn thao tác. */
  tourTarget?: string;
}) {
  return (
    <section data-tour={tourTarget} className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-xl border-2 border-border bg-card p-5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [workshop, setWorkshop] = useState<Workshop | "">("");
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);
  const range: FlowRange = useMemo(() => ({ fromDate, toDate, workshop }), [fromDate, toDate, workshop]);
  const warningsRef = useRef<HTMLDivElement>(null);

  // ---- Nạp sổ ----
  const { traceData, isReady } = useTraceData();
  const [scraps] = useScraps();
  const [dailyLocks] = useDailyLocks();
  const [productionLocks] = useProductionLocks();
  const [periods] = useBalancingPeriods();
  const [balancingInputs] = useBalancingInputs();
  const [balancingOutputs] = useBalancingOutputs();
  const [materialOpening] = useMaterialOpeningStock();
  const [finishedOpening] = useFinishedGoodsOpeningStock();
  const [snapshots] = useNxtSnapshots();

  const d: DataFlowInput = useMemo(
    () => ({ ...traceData, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening }),
    [traceData, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening],
  );

  // ---- Hướng dẫn thao tác (ba-spec 43) — chỉ dẫn, không ghi. Nút Demo: cùng điều kiện hiện ở App.tsx. ----
  const auth = useAuth();
  const canDemo = auth.isAdmin || !auth.requiresLogin || IS_DEMO;
  const tour = useMemo(() => buildDashboardTour({ can: { demo: canDemo } }), [canDemo]);
  usePageTour(isReady ? tour : null);

  // ---- Gom số (lib/dataFlow) ----
  const dataFlow = useMemo(() => buildDataFlow(d, range), [d, range]);
  const stages = useMemo(() => buildFlowStages(d, range), [d, range]);
  // Chuỗi theo ngày dừng ở hôm nay — ngày tương lai chưa có số, vẽ ra chỉ là đường phẳng.
  const byDate = useMemo(() => {
    const today = todayIso();
    return buildDailyFlowSeries(d, { ...range, toDate: range.toDate < today ? range.toDate : today });
  }, [d, range]);
  const yieldRatio = useMemo(() => computeYieldByProduct(d, range), [d, range]);
  const warnings = useMemo(() => buildChainWarnings(d, range, todayIso()), [d, range]);
  const periodResults = useMemo(() => computeAllPeriodResults(d), [d]);

  const stageKg = (k: TraceStageKey) => stages.find((x) => x.key === k)?.kg ?? 0;
  const inKg = stageKg("imports");
  const productionKg = stageKg("production");
  const outKg = stageKg("outbound");
  const last = byDate[byDate.length - 1];
  const latestPeriod = periodResults.find((x) => x.hasFinishedGoods);
  const taskCount = warnings.filter((c) => c.level !== "info").length;
  const errorCount = warnings.filter((c) => c.level === "error").length;

  // % kg BTP trong khoảng đã có lô NL (hoặc lý do chưa gắn).
  const lotCoverageRatio = useMemo(() => {
    const mes = d.wips.filter((w) => w.productionDate >= fromDate && w.productionDate <= toDate && (!workshop || w.workshop === workshop));
    const total = mes.reduce((s, w) => s + (w.quantityKg || 0), 0);
    if (total <= 0) return null;
    const lottedWipIds = new Set([
      ...d.lotInputs.filter((l) => l.outputKind === "W").map((l) => l.outputId),
      ...(d.lotWaivers ?? []).filter((l) => l.outputKind === "W").map((l) => l.outputId),
    ]);
    return mes.filter((w) => lottedWipIds.has(w.id)).reduce((s, w) => s + (w.quantityKg || 0), 0) / total;
  }, [d, fromDate, toDate, workshop]);

  const cards: StatCardData[] = [
    {
      label: "Nguyên liệu nhập",
      value: `${num(inKg)} kg`,
      subtext: `${new Set(d.imports.filter((r) => r.deliveryDate >= fromDate && r.deliveryDate <= toDate && (!workshop || r.workshop === workshop)).map((r) => r.shipmentId)).size} chuyến`,
      numeric: true,
      icon: Truck,
      tone: KIND_TONES.imports,
      onSelect: () => navigate("/imports"),
      selectHint: "Mở màn Nhập hàng để xem từng chuyến.",
    },
    {
      label: "Bán thành phẩm sản xuất",
      value: `${num(productionKg)} kg`,
      subtext: inKg > 0 ? `= ${num((productionKg / inKg) * 100)}% kg NL nhập` : undefined,
      numeric: true,
      icon: Factory,
      tone: KIND_TONES.production,
      onSelect: () => navigate("/wip"),
      selectHint: "Mở màn Sản xuất thành phẩm.",
    },
    {
      label: "Định mức NL/TP bình quân",
      value: yieldRatio.binhQuan != null ? num(yieldRatio.binhQuan) : latestPeriod ? num(latestPeriod.result.norm) : "—",
      subtext:
        yieldRatio.binhQuan != null
          ? `từ ${yieldRatio.rows.length} mặt hàng có gắn lô cân kg`
          : latestPeriod
            ? `kỳ cân đối ${latestPeriod.period.materialTypeName} gần nhất`
            : "chưa có mẻ gắn lô cân kg",
      numeric: true,
      icon: Gauge,
      tone: KIND_TONES.yieldRatio,
    },
    {
      label: "Tồn BTP kho dự trữ cuối kỳ",
      value: `${num(last?.wipStockKg ?? 0)} kg`,
      subtext: `TP đóng gói còn ${num(last?.finishedStockKg ?? 0)} kg`,
      numeric: true,
      icon: Warehouse,
      tone: KIND_TONES.warehouse,
      onSelect: () => navigate("/warehouse"),
      selectHint: "Mở màn Kho dự trữ để xem tồn theo lô.",
    },
    {
      label: "Xuất + bán ra",
      value: `${num(outKg)} kg`,
      subtext: "xuất theo đơn · bán lẻ · bán nội địa",
      numeric: true,
      icon: ShoppingCart,
      tone: KIND_TONES.sales,
      onSelect: () => navigate("/orders"),
      selectHint: "Mở màn Đơn đặt để xem lệnh xuất.",
    },
    {
      label: "Lãi/lỗ kỳ cân đối gần nhất",
      value: latestPeriod ? formatMoney(latestPeriod.result.profitOrLoss) : "—",
      subtext: latestPeriod ? `${latestPeriod.period.materialTypeName} · ${latestPeriod.period.dateRangeDescription}` : "chưa có kỳ có thành phẩm",
      numeric: true,
      icon: Scale,
      color: !latestPeriod ? "neutral" : latestPeriod.result.profitOrLoss >= 0 ? "success" : "danger",
      onSelect: latestPeriod ? () => navigate(`/balancing/${latestPeriod.period.id}`) : undefined,
      selectHint: "Mở kỳ cân đối để xem bảng chi tiết.",
    },
    {
      label: "Mẻ đã gắn lô NL",
      value: lotCoverageRatio == null ? "—" : `${num(lotCoverageRatio * 100)}%`,
      subtext: "tính theo kg BTP (gồm mẻ đã ghi lý do)",
      numeric: true,
      icon: QrCode,
      tone: KIND_TONES.lots,
      onSelect: () => navigate("/qr?tab=stages"),
      selectHint: "Mở Mã lô QR — tab Theo giai đoạn để gắn lô còn thiếu.",
    },
    {
      label: "Việc cần đốc",
      value: `${num(taskCount)} việc`,
      subtext: errorCount > 0 ? `${errorCount} chỗ sổ sai cần sửa` : "không có sổ sai",
      numeric: true,
      icon: AlertTriangle,
      color: errorCount > 0 ? "danger" : taskCount > 0 ? "warning" : "success",
      onSelect: () => warningsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      selectHint: "Cuộn tới danh sách việc cần đốc.",
    },
  ];

  // ---- Hai thanh "đi đâu" (thay sơ đồ dòng chảy — dễ đọc hơn) ----
  const nodePaths = useMemo(
    () => Object.fromEntries(dataFlow.nodes.filter((n) => n.path).map((n) => [n.id, n.path as string])),
    [dataFlow],
  );
  const toShares = (items: ReturnType<typeof splitOutflows>, parts: typeof MATERIAL_PARTS): ProportionSegment[] =>
    items.map((x) => ({ id: x.id, label: parts[x.id]?.label ?? x.label, tone: parts[x.id]?.tone ?? "gray", description: parts[x.id]?.description, value: x.kg }));
  const materialOutflow = useMemo(
    () => splitOutflows(dataFlow, (id) => id.startsWith("workshop:"), Object.keys(MATERIAL_PARTS)),
    [dataFlow],
  );
  const outOfWarehouse = useMemo(() => splitOutflows(dataFlow, (id) => id === "warehouse", Object.keys(WAREHOUSE_PARTS)), [dataFlow]);
  const priorMaterialKg = dataFlow.edges.filter((c) => c.source === "material-prior").reduce((s, c) => s + c.kg, 0);
  const priorWipStock = dataFlow.edges.filter((c) => c.source === "wip-opening").reduce((s, c) => s + c.kg, 0);
  const wipRatio = materialOutflow.find((x) => x.id === "wip")?.share ?? 0;

  // ---- Bảng việc cần đốc ----
  const warningColumns: SummaryTableColumn<FlowWarning>[] = [
    {
      key: "muc",
      header: "Mức",
      render: (r) => (
        <Tag variant={LEVEL_LABELS[r.level].variant}>
          {LEVEL_LABELS[r.level].text}
        </Tag>
      ),
    },
    {
      key: "viec",
      header: "Việc",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.title}</div>
          <div className="text-sm text-muted-foreground">
            {getWarningKindLabel(r.kind)} · {r.detail}
          </div>
        </div>
      ),
    },
    { key: "ngay", header: "Ngày", render: (r) => (r.date ? formatDateVN(r.date) : "—") },
    {
      key: "xuong",
      header: "Xưởng",
      render: (r) => (r.workshop ? <Tag variant="category" tone={toneForWorkshop(r.workshop)}>{r.workshop}</Tag> : "—"),
    },
    {
      key: "mo",
      header: "",
      render: (r) => (
        <Button title="Mở đúng màn để xử lý việc này." variant="outline" size="sm" onClick={() => navigate(r.path)}>
          Mở
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ---- Kỳ cân đối ----
  const periodColumns: SummaryTableColumn<PeriodBalancingResult>[] = [
    {
      key: "ky",
      header: "Kỳ",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.period.materialTypeName}</div>
          <div className="text-sm text-muted-foreground">{r.period.dateRangeDescription}</div>
        </div>
      ),
    },
    { key: "nl", header: "NL vào (kg)", numeric: true, render: (r) => num(r.result.totalInputKg) },
    { key: "tp", header: "TP ra (kg)", numeric: true, render: (r) => num(r.result.totalOutputKg) },
    { key: "dm", header: "Định mức", numeric: true, render: (r) => (r.hasFinishedGoods ? num(r.result.norm) : "chưa có TP") },
    {
      key: "lai",
      header: "Lãi/lỗ (đ)",
      numeric: true,
      render: (r) =>
        r.hasFinishedGoods ? (
          <span className={r.result.profitOrLoss >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
            {formatMoney(r.result.profitOrLoss)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "mo",
      header: "",
      render: (r) => (
        <Button title="Mở kỳ cân đối này." variant="outline" size="sm" onClick={() => navigate(`/balancing/${r.period.id}`)}>
          Mở
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ---- Tồn kho theo kho (báo cáo NXT nhập từ xí nghiệp) — giữ như cũ ----
  const warehouseTotals: WarehouseRow[] = useMemo(() => {
    const latest = new Map<string, string>();
    for (const r of snapshots) {
      const p = latest.get(r.warehouseCode);
      if (!p || r.periodTo > p) latest.set(r.warehouseCode, r.periodTo);
    }
    const m = new Map<string, WarehouseRow>();
    for (const r of snapshots) {
      if (latest.get(r.warehouseCode) !== r.periodTo) continue;
      const cur =
        m.get(r.warehouseCode) ??
        { warehouse: r.warehouseCode, periodFrom: r.periodFrom, periodTo: r.periodTo, openingKg: 0, inKg: 0, outKg: 0, closingKg: 0, productCount: 0 };
      cur.openingKg += r.openingKg;
      cur.inKg += r.inKg;
      cur.outKg += r.outKg;
      cur.closingKg += r.openingKg + r.inKg - r.outKg;
      cur.productCount += 1;
      m.set(r.warehouseCode, cur);
    }
    return [...m.values()].sort((a, b) => b.closingKg - a.closingKg);
  }, [snapshots]);
  const warehouseColumns: SummaryTableColumn<WarehouseRow>[] = [
    {
      key: "kho",
      header: "Kho / chi nhánh",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.warehouse}</div>
          <div className="text-sm text-muted-foreground">
            kỳ {formatDateVN(r.periodFrom)} – {formatDateVN(r.periodTo)} · {r.productCount} mặt hàng
          </div>
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", numeric: true, render: (r) => num(r.openingKg), total: () => num(warehouseTotals.reduce((s, k) => s + k.openingKg, 0)) },
    { key: "nhap", header: "Nhập (kg)", numeric: true, render: (r) => (r.inKg ? `+${num(r.inKg)}` : "—"), total: () => num(warehouseTotals.reduce((s, k) => s + k.inKg, 0)) },
    { key: "xuat", header: "Xuất (kg)", numeric: true, render: (r) => (r.outKg ? `−${num(r.outKg)}` : "—"), total: () => num(warehouseTotals.reduce((s, k) => s + k.outKg, 0)) },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      numeric: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closingKg)}</span>,
      total: () => num(warehouseTotals.reduce((s, k) => s + k.closingKg, 0)),
    },
  ];

  const dayLabels = byDate.map((x) => shortDate(x.date));
  const hasDailyFigures = byDate.some((x) => x.importedKg > 0 || x.producedKg > 0);
  const hasStock = byDate.some((x) => x.wipStockKg !== 0 || x.finishedStockKg !== 0);
  const periodKey = `${fromDate}|${toDate}|${workshop || "tat-ca"}`;
  const stagePaths = Object.fromEntries(stages.map((k) => [k.key, k.path]));
  const coloredStages = stages.map((k) => ({
    id: k.key,
    name: k.name,
    kg: k.kg,
    pendingKg: k.kgCho,
    pendingTasks: k.missingTaskCount,
    conversionRate: k.conversionRate,
    tone: STAGE_TONES[k.key],
  }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan — dòng chảy số liệu</h1>
        <p className="mt-1 text-muted-foreground">
          Nguyên liệu vào đi qua 5 khâu ra sao, đang kẹt ở đâu, còn việc gì phải đốc. Mọi số lấy từ sổ đã ghi; sổ
          nào chưa có số thì hình để trống.
        </p>
      </div>

      {/* Thanh lọc GỌN một hàng: kỳ (bấm nhanh) · lùi/tiến · xưởng. Tự chọn mới hiện ô ngày. */}
      <div data-tour="dashboard-filters" className="grid gap-3 rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as ViewPeriod)}>
            <TabsList aria-label="Kỳ xem" className="flex-wrap group-data-horizontal/tabs:h-auto">
              {QUICK_PERIODS.map((k) => (
                <TabsTrigger key={k.value} value={k.value} title={`Xem số theo ${k.label.toLowerCase()}.`}>
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {period !== "custom" && (
            <div className="flex items-center gap-1">
              <Button title="Lùi về kỳ trước." variant="ghost" size="icon" aria-label="Kỳ trước" onClick={() => setAnchor(stepPeriod(period, anchor, -1))}>
                <ChevronLeft />
              </Button>
              <span className="tnum min-w-[9rem] text-center text-base font-semibold text-foreground">{periodLabel(period, fromDate, toDate)}</span>
              <Button title="Tới kỳ sau." variant="ghost" size="icon" aria-label="Kỳ sau" onClick={() => setAnchor(stepPeriod(period, anchor, 1))}>
                <ChevronRight />
              </Button>
            </div>
          )}
          <Tabs value={workshop || "tat-ca"} onValueChange={(v) => setWorkshop(v === "tat-ca" ? "" : (v as Workshop))} className="ml-auto">
            <TabsList aria-label="Phân xưởng" className="flex-wrap group-data-horizontal/tabs:h-auto">
              {WORKSHOP_QUICK.map((x) => (
                <TabsTrigger key={x.value} value={x.value} title={x.value === "tat-ca" ? "Gộp số cả 3 xưởng." : `Chỉ xem số xưởng ${x.label}.`}>
                  {x.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {period === "custom" && (
          <div className="max-w-md">
            <DateRangeField
              label="Khoảng ngày"
              hideRequiredMark
              presets={false}
              startDate={customFrom}
              endDate={customTo}
              onChange={(a2, b2) => {
                setCustomFrom(a2);
                setCustomTo(b2);
              }}
            />
          </div>
        )}
      </div>

      <div data-tour="dashboard-kpis">
        <StatCardGrid cards={cards} />
      </div>

      <Section
        tourTarget="dashboard-stages"
        title="Năm khâu của chuỗi"
        description="kg đã qua từng khâu trong kỳ và số lô / dòng còn thiếu việc (tem, gắn lô, duyệt, quét kiểm). Phần trăm trên mũi tên so với khâu nguồn: SX so với NL nhập, nhập kho so với SX, đóng gói và xuất/bán so với nhập kho. Bấm một khâu để mở màn của khâu đó."
      >
        <PipelineStages stages={coloredStages} onSelect={(k) => navigate(stagePaths[k] ?? "/dashboard")} />
      </Section>

      <Section
        tourTarget="dashboard-outflow"
        title="Nguyên liệu đi đâu"
        description="Mỗi thanh là 100% một khối hàng, chia theo nơi nó đi tới. Bấm một phần để mở màn liên quan."
      >
        {materialOutflow.length === 0 && outOfWarehouse.length === 0 ? (
          <EmptyState icon={Truck} title="Kỳ này chưa có số" description="Chưa ghi nhập hàng hay sản xuất nào trong kỳ đang xem." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {materialOutflow.length > 0 && (
              <div className="grid gap-3">
                <p className="text-base text-foreground">
                  Cứ <b className="tnum">100 kg</b> nguyên liệu vào xưởng thì ra{" "}
                  <b className="tnum text-xl text-tone-purple">{num(Math.round(wipRatio * 100))} kg</b> bán thành phẩm.
                  {priorMaterialKg > 0 && (
                    <span className="text-sm text-muted-foreground"> (Đã gồm {num(priorMaterialKg)} kg NL lấy từ kho / kỳ trước.)</span>
                  )}
                </p>
                <ProportionBar
                  segments={toShares(materialOutflow, MATERIAL_PARTS)}
                  description="Nguyên liệu vào xưởng chia theo nơi đi tới"
                  onSelect={(k) => nodePaths[k] && navigate(nodePaths[k])}
                />
              </div>
            )}
            {outOfWarehouse.length > 0 && (
              <div className="grid gap-3">
                <p className="text-base text-foreground">
                  Hàng trong <b>kho dự trữ</b> đi đâu
                  {priorWipStock > 0 && (
                    <span className="text-sm text-muted-foreground"> (gồm {num(priorWipStock)} kg tồn từ trước kỳ)</span>
                  )}
                  :
                </p>
                <ProportionBar
                  segments={toShares(outOfWarehouse, WAREHOUSE_PARTS)}
                  description="Hàng trong kho dự trữ chia theo nơi đi tới"
                  onSelect={(k) => nodePaths[k] && navigate(nodePaths[k])}
                />
              </div>
            )}
          </div>
        )}
      </Section>

      <div ref={warningsRef} data-tour="dashboard-warnings" className="scroll-mt-header">
        <Section
          title={`Việc cần đốc (${warnings.length})`}
          description="Sổ sai đứng trước, rồi việc chưa làm, cuối cùng là các ghi bù để biết. Bấm Mở để tới đúng chỗ sửa."
        >
          {warnings.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Không có việc tồn đọng" description="Các ngày đã chốt, lô đã gắn, không có bán vượt tồn trong kỳ này." />
          ) : (
            <SummaryTable rows={warnings} columns={warningColumns} getKey={(r) => r.id} rowMarkKey={`tong-quan-canh-bao|${periodKey}`} />
          )}
        </Section>
      </div>

      <div data-tour="dashboard-daily" className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Section title="Nhập và sản xuất theo ngày" description="Cột: kg nguyên liệu nhập và kg bán thành phẩm sản xuất mỗi ngày.">
          {hasDailyFigures ? (
            <TimeSeriesChart
              labels={dayLabels}
              description="Biểu đồ kg nhập và sản xuất theo ngày"
              series={[
                { id: "nhap", name: "NL nhập", color: KIND_TONES.imports, kind: "bar", values: byDate.map((x) => x.importedKg) },
                { id: "sx", name: "BTP sản xuất", color: KIND_TONES.production, kind: "bar", values: byDate.map((x) => x.producedKg) },
              ]}
            />
          ) : (
            <EmptyState icon={Factory} title="Chưa có nhập / sản xuất trong kỳ" description="Ghi chuyến ở Nhập hàng và mẻ ở Sản xuất thành phẩm để thấy biểu đồ." />
          )}
        </Section>
        <Section
          title="Tồn kho theo ngày"
          description="Tồn bán thành phẩm kho dự trữ và thành phẩm đóng gói cuối mỗi ngày. Tồn nguyên liệu chưa vẽ: sổ NL chưa trừ phần đưa vào sản xuất."
        >
          {hasStock ? (
            <TimeSeriesChart
              labels={dayLabels}
              description="Biểu đồ tồn kho theo ngày"
              series={[
                { id: "btp", name: "Tồn BTP kho dự trữ", color: KIND_TONES.warehouse, kind: "line", area: true, values: byDate.map((x) => x.wipStockKg) },
                { id: "tp", name: "Tồn TP đóng gói", color: KIND_TONES.packaging, kind: "line", values: byDate.map((x) => x.finishedStockKg) },
              ]}
            />
          ) : (
            <EmptyState icon={Warehouse} title="Chưa có tồn trong kỳ" description="Duyệt nhập kho bán thành phẩm ở Kho dự trữ để có tồn." />
          )}
        </Section>
      </div>

      <div data-tour="dashboard-periods" className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Section
          title="Kết quả các kỳ cân đối"
          description="Định mức = NL vào ÷ TP ra; lãi/lỗ = giá trị xuất − giá thành. Kỳ chưa có thành phẩm thì chưa tính."
        >
          {periodResults.length === 0 ? (
            <EmptyState icon={Scale} title="Chưa có kỳ cân đối" description="Tạo kỳ ở màn Cân đối kỳ để thấy định mức và lãi/lỗ." />
          ) : (
            <SummaryTable rows={periodResults.slice(0, 8)} columns={periodColumns} getKey={(r) => r.period.id} className="sticky-first-col" rowMarkKey="tong-quan-ky-can-doi" />
          )}
        </Section>
        <Section
          title="Định mức theo mặt hàng"
          description={
            yieldRatio.binhQuan != null
              ? `Chỉ tính mẻ đã gắn lô NL có cân kg. Bình quân ${num(yieldRatio.binhQuan)} — mặt hàng lệch quá ±${YIELD_RATIO_THRESHOLD * 100}% được ghi chú.`
              : "Chỉ tính mẻ đã gắn lô NL có cân kg."
          }
        >
          {yieldRatio.rows.length === 0 ? (
            <EmptyState icon={Gauge} title="Chưa đủ số để tính" description="Khi gắn lô NL cho mẻ ở Sản xuất có ghi kg, định mức từng mặt hàng hiện ở đây." />
          ) : (
            <BarChart
              data={yieldRatio.rows.map((r) => ({
                label: r.name,
                value: r.yieldRatio,
                subLabel: `${r.deviation > 0 ? "+" : ""}${num(r.deviation * 100)}% so bình quân${r.exceedsThreshold ? " · lệch" : ""}`,
              }))}
              formatValue={(n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
              averageValue={yieldRatio.binhQuan ?? undefined}
            />
          )}
        </Section>
      </div>

      <Section
        tourTarget="dashboard-nxt"
        title="Tồn kho theo kho (báo cáo Xuất–Nhập–Tồn)"
        description="Tồn cuối của kỳ mới nhất mỗi kho. Nguồn: báo cáo NXT nhập từ hệ thống xí nghiệp."
        actions={
          warehouseTotals.length > 0 && (
            <Button title="Mở màn Nhập xuất tồn kho để xem số chi tiết theo từng mã hàng." variant="outline" onClick={() => navigate("/nxt-warehouse")}>
              Mở báo cáo XNT kho
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )
        }
      >
        {warehouseTotals.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="Chưa có số liệu tồn kho" description="Nạp báo cáo Xuất–Nhập–Tồn ở màn Nhập xuất tồn kho để thấy tồn theo kho tại đây." />
        ) : (
          <SummaryTable rows={warehouseTotals} columns={warehouseColumns} getKey={(r) => r.warehouse} className="sticky-first-col" />
        )}
      </Section>
    </div>
  );
}
