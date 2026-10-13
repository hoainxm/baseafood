// ============================================================
// Tên file: src/features/dashboard/DashboardScreen.tsx
// Tên tiếng Việt tương đương: Màn hình Tổng quan — Dòng chảy số liệu
// Description: Flow overview — KPI cards, 5-stage pipeline, "where did the kg go" bars, chain alerts,
//              daily series, balancing periods, NXT stock (real collections only)
// ============================================================
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BangChuyen,
  BangTong,
  BieuDoCot,
  BieuDoTheoNgay,
  Button,
  DateRangeField,
  EmptyState,
  Nhan,
  Tabs,
  TabsList,
  TabsTrigger,
  ThanhChiaPhan,
  ThongKe,
  homNay,
  sacXuong,
  type CotTong,
  type LoaiNhan,
  type PhanChia,
  type SacPhanLoai,
  type TheThongTin,
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
import { useDuLieuTruyXuat } from "@/features/shared/useDuLieuTruyXuat";
import { KhoiCheDoDemo } from "@/features/shared/CheDoDemo";
import { useAuth } from "@/lib/auth";
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
  kho: string;
  periodFrom: string;
  periodTo: string;
  tonDau: number;
  nhap: number;
  xuat: number;
  tonCuoi: number;
  soMH: number;
}

const KY_NHANH: { value: ViewPeriod; label: string }[] = [
  { value: "ngay", label: "Ngày" },
  { value: "tuan", label: "Tuần" },
  { value: "thang", label: "Tháng" },
  { value: "nam", label: "Năm" },
  { value: "tuy-chon", label: "Tự chọn" },
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
  nhap: "bien",
  sanXuat: "tim",
  dinhMuc: "cat",
  kho: "ngoc",
  dongGoi: "bang",
  ban: "la",
  lo: "bang",
} as const satisfies Record<string, SacPhanLoai>;
const SAC_KHAU: Record<string, SacPhanLoai> = {
  nhap: KIND_TONES.nhap,
  "san-xuat": KIND_TONES.sanXuat,
  kho: KIND_TONES.kho,
  "dong-goi": KIND_TONES.dongGoi,
  "xuat-ban": KIND_TONES.ban,
};

/** Tên + sắc + câu phụ cho từng phần của hai thanh "đi đâu" (id nút ở lib/dataFlow). */
const MATERIAL_PARTS: Record<string, { nhan: string; sac: SacPhanLoai; moTa?: string }> = {
  btp: { nhan: "Thành bán thành phẩm", sac: KIND_TONES.sanXuat },
  nd: { nhan: "Bán thẳng nội địa", sac: KIND_TONES.ban },
  cd: { nhan: "Còn dở, gửi đông", sac: KIND_TONES.kho, moTa: "ghi lúc chốt ngày sản xuất" },
  pl: { nhan: "Phế liệu", sac: "cam" },
  hh: { nhan: "Hao hụt / chưa ghi ra", sac: "xam", moTa: "hao hụt chế biến hoặc NL chưa ghi dùng vào đâu" },
};
const WAREHOUSE_PARTS: Record<string, { nhan: string; sac: SacPhanLoai; moTa?: string }> = {
  goi: { nhan: "Đem đóng gói", sac: KIND_TONES.dongGoi },
  xd: { nhan: "Xuất theo đơn", sac: KIND_TONES.ban },
  bb: { nhan: "Bán block thô", sac: "hong" },
  tonBtp: { nhan: "Còn trong kho", sac: KIND_TONES.kho },
};

/** Lùi / tiến mốc kỳ một bước (ngày · tuần · tháng · năm). */
function stepPeriod(ky: ViewPeriod, moc: string, step: 1 | -1): string {
  const d = new Date(`${moc}T00:00:00Z`);
  if (ky === "ngay") d.setUTCDate(d.getUTCDate() + step);
  else if (ky === "tuan") d.setUTCDate(d.getUTCDate() + 7 * step);
  else if (ky === "thang") d.setUTCMonth(d.getUTCMonth() + step, 1);
  else if (ky === "nam") d.setUTCFullYear(d.getUTCFullYear() + step, 0, 1);
  return d.toISOString().slice(0, 10);
}

/** Nhãn kỳ đang xem, ngắn: "Tháng 10/2026" · "Năm 2026" · "06/10 – 12/10/2026". */
function periodLabel(ky: ViewPeriod, tu: string, den: string): string {
  if (ky === "ngay") return formatDateVN(tu);
  if (ky === "thang") return `Tháng ${tu.slice(5, 7)}/${tu.slice(0, 4)}`;
  if (ky === "nam") return `Năm ${tu.slice(0, 4)}`;
  return `${formatDateVN(tu)} – ${formatDateVN(den)}`;
}

const LEVEL_LABELS: Record<FlowWarning["muc"], { chu: string; loai: LoaiNhan }> = {
  loi: { chu: "Sổ sai", loai: "loi" },
  nhac: { chu: "Chưa làm", loai: "luu-y" },
  tin: { chu: "Để biết", loai: "phu" },
};

const formatMoney = (n: number) => `${n < 0 ? "−" : ""}${num(Math.abs(Math.round(n)))} đ`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Section({
  tieuDe,
  moTa,
  hanhDong,
  children,
  className,
}: {
  tieuDe: string;
  moTa?: ReactNode;
  hanhDong?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 rounded-xl border-2 border-border bg-card p-5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{tieuDe}</h2>
          {moTa && <p className="mt-1 text-sm text-muted-foreground">{moTa}</p>}
        </div>
        {hanhDong}
      </div>
      {children}
    </section>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { laAdmin, canDangNhap } = useAuth();
  const [ky, setKy] = useState<ViewPeriod>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [workshop, setWorkshop] = useState<Workshop | "">("");
  const [tu, den] = getViewPeriodRange(ky, moc, tuTC, denTC);
  const khoang: FlowRange = useMemo(() => ({ tu, den, xuong: workshop }), [tu, den, workshop]);
  const warningsRef = useRef<HTMLDivElement>(null);

  // ---- Nạp sổ ----
  const { dl } = useDuLieuTruyXuat();
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
    () => ({ ...dl, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening }),
    [dl, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening],
  );

  // ---- Gom số (lib/dataFlow) ----
  const dataFlow = useMemo(() => buildDataFlow(d, khoang), [d, khoang]);
  const khau = useMemo(() => buildFlowStages(d, khoang), [d, khoang]);
  // Chuỗi theo ngày dừng ở hôm nay — ngày tương lai chưa có số, vẽ ra chỉ là đường phẳng.
  const byDate = useMemo(() => {
    const today = homNay();
    return buildDailyFlowSeries(d, { ...khoang, den: khoang.den < today ? khoang.den : today });
  }, [d, khoang]);
  const yieldRatio = useMemo(() => computeYieldByProduct(d, khoang), [d, khoang]);
  const warnings = useMemo(() => buildChainWarnings(d, khoang, homNay()), [d, khoang]);
  const cacKy = useMemo(() => computeAllPeriodResults(d), [d]);

  const kgKhau = (k: string) => khau.find((x) => x.khoa === k)?.kg ?? 0;
  const inKg = kgKhau("nhap");
  const productionKg = kgKhau("san-xuat");
  const raKg = kgKhau("xuat-ban");
  const last = byDate[byDate.length - 1];
  const latestPeriod = cacKy.find((x) => x.coThanhPham);
  const soViec = warnings.filter((c) => c.muc !== "tin").length;
  const errorCount = warnings.filter((c) => c.muc === "loi").length;

  // % kg BTP trong khoảng đã có lô NL (hoặc lý do chưa gắn).
  const lotCoverageRatio = useMemo(() => {
    const mes = d.wips.filter((w) => w.productionDate >= tu && w.productionDate <= den && (!workshop || w.workshop === workshop));
    const total = mes.reduce((s, w) => s + (w.quantityKg || 0), 0);
    if (total <= 0) return null;
    const lottedWipIds = new Set([
      ...d.lotInputs.filter((l) => l.outputKind === "W").map((l) => l.outputId),
      ...(d.lotWaivers ?? []).filter((l) => l.outputKind === "W").map((l) => l.outputId),
    ]);
    return mes.filter((w) => lottedWipIds.has(w.id)).reduce((s, w) => s + (w.quantityKg || 0), 0) / total;
  }, [d, tu, den, workshop]);

  const the: TheThongTin[] = [
    {
      nhan: "Nguyên liệu nhập",
      giaTri: `${num(inKg)} kg`,
      phu: `${new Set(d.imports.filter((r) => r.deliveryDate >= tu && r.deliveryDate <= den && (!workshop || r.workshop === workshop)).map((r) => r.shipmentId)).size} chuyến`,
      so: true,
      icon: Truck,
      sac: KIND_TONES.nhap,
      onChon: () => navigate("/imports"),
      moTaChon: "Mở màn Nhập hàng để xem từng chuyến.",
    },
    {
      nhan: "Bán thành phẩm sản xuất",
      giaTri: `${num(productionKg)} kg`,
      phu: inKg > 0 ? `= ${num((productionKg / inKg) * 100)}% kg NL nhập` : undefined,
      so: true,
      icon: Factory,
      sac: KIND_TONES.sanXuat,
      onChon: () => navigate("/wip"),
      moTaChon: "Mở màn Sản xuất thành phẩm.",
    },
    {
      nhan: "Định mức NL/TP bình quân",
      giaTri: yieldRatio.binhQuan != null ? num(yieldRatio.binhQuan) : latestPeriod ? num(latestPeriod.kq.norm) : "—",
      phu:
        yieldRatio.binhQuan != null
          ? `từ ${yieldRatio.dong.length} mặt hàng có gắn lô cân kg`
          : latestPeriod
            ? `kỳ cân đối ${latestPeriod.period.materialTypeName} gần nhất`
            : "chưa có mẻ gắn lô cân kg",
      so: true,
      icon: Gauge,
      sac: KIND_TONES.dinhMuc,
    },
    {
      nhan: "Tồn BTP kho dự trữ cuối kỳ",
      giaTri: `${num(last?.tonBtp ?? 0)} kg`,
      phu: `TP đóng gói còn ${num(last?.tonTp ?? 0)} kg`,
      so: true,
      icon: Warehouse,
      sac: KIND_TONES.kho,
      onChon: () => navigate("/warehouse"),
      moTaChon: "Mở màn Kho dự trữ để xem tồn theo lô.",
    },
    {
      nhan: "Xuất + bán ra",
      giaTri: `${num(raKg)} kg`,
      phu: "xuất theo đơn · bán lẻ · bán nội địa",
      so: true,
      icon: ShoppingCart,
      sac: KIND_TONES.ban,
      onChon: () => navigate("/orders"),
      moTaChon: "Mở màn Đơn đặt để xem lệnh xuất.",
    },
    {
      nhan: "Lãi/lỗ kỳ cân đối gần nhất",
      giaTri: latestPeriod ? formatMoney(latestPeriod.kq.profitOrLoss) : "—",
      phu: latestPeriod ? `${latestPeriod.period.materialTypeName} · ${latestPeriod.period.dateRangeDescription}` : "chưa có kỳ có thành phẩm",
      so: true,
      icon: Scale,
      mau: !latestPeriod ? "trung-tinh" : latestPeriod.kq.profitOrLoss >= 0 ? "success" : "danger",
      onChon: latestPeriod ? () => navigate(`/balancing/${latestPeriod.period.id}`) : undefined,
      moTaChon: "Mở kỳ cân đối để xem bảng chi tiết.",
    },
    {
      nhan: "Mẻ đã gắn lô NL",
      giaTri: lotCoverageRatio == null ? "—" : `${num(lotCoverageRatio * 100)}%`,
      phu: "tính theo kg BTP (gồm mẻ đã ghi lý do)",
      so: true,
      icon: QrCode,
      sac: KIND_TONES.lo,
      onChon: () => navigate("/qr?tab=giai-doan"),
      moTaChon: "Mở Mã lô QR — tab Theo giai đoạn để gắn lô còn thiếu.",
    },
    {
      nhan: "Việc cần đốc",
      giaTri: `${num(soViec)} việc`,
      phu: errorCount > 0 ? `${errorCount} chỗ sổ sai cần sửa` : "không có sổ sai",
      so: true,
      icon: AlertTriangle,
      mau: errorCount > 0 ? "danger" : soViec > 0 ? "warning" : "success",
      onChon: () => warningsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      moTaChon: "Cuộn tới danh sách việc cần đốc.",
    },
  ];

  // ---- Hai thanh "đi đâu" (thay sơ đồ dòng chảy — dễ đọc hơn) ----
  const nodePaths = useMemo(
    () => Object.fromEntries(dataFlow.nut.filter((n) => n.duongDan).map((n) => [n.id, n.duongDan as string])),
    [dataFlow],
  );
  const toShares = (ds: ReturnType<typeof splitOutflows>, ten: typeof MATERIAL_PARTS): PhanChia[] =>
    ds.map((x) => ({ khoa: x.id, nhan: ten[x.id]?.nhan ?? x.nhan, sac: ten[x.id]?.sac ?? "xam", moTa: ten[x.id]?.moTa, giaTri: x.kg }));
  const materialOutflow = useMemo(
    () => splitOutflows(dataFlow, (id) => id.startsWith("x:"), Object.keys(MATERIAL_PARTS)),
    [dataFlow],
  );
  const outOfWarehouse = useMemo(() => splitOutflows(dataFlow, (id) => id === "kho", Object.keys(WAREHOUSE_PARTS)), [dataFlow]);
  const priorMaterialKg = dataFlow.canh.filter((c) => c.tu === "nlTruoc").reduce((s, c) => s + c.kg, 0);
  const priorWipStock = dataFlow.canh.filter((c) => c.tu === "tonBtpDau").reduce((s, c) => s + c.kg, 0);
  const wipRatio = materialOutflow.find((x) => x.id === "btp")?.tiLe ?? 0;

  // ---- Bảng việc cần đốc ----
  const warningColumns: CotTong<FlowWarning>[] = [
    {
      key: "muc",
      header: "Mức",
      render: (r) => (
        <Nhan loai={LEVEL_LABELS[r.muc].loai}>
          {LEVEL_LABELS[r.muc].chu}
        </Nhan>
      ),
    },
    {
      key: "viec",
      header: "Việc",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.tieuDe}</div>
          <div className="text-sm text-muted-foreground">
            {getWarningKindLabel(r.loai)} · {r.chiTiet}
          </div>
        </div>
      ),
    },
    { key: "ngay", header: "Ngày", render: (r) => (r.ngay ? formatDateVN(r.ngay) : "—") },
    {
      key: "xuong",
      header: "Xưởng",
      render: (r) => (r.xuong ? <Nhan loai="phan-loai" sac={sacXuong(r.xuong)}>{r.xuong}</Nhan> : "—"),
    },
    {
      key: "mo",
      header: "",
      render: (r) => (
        <Button title="Mở đúng màn để xử lý việc này." variant="outline" size="sm" onClick={() => navigate(r.duongDan)}>
          Mở
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ---- Kỳ cân đối ----
  const periodColumns: CotTong<PeriodBalancingResult>[] = [
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
    { key: "nl", header: "NL vào (kg)", so: true, render: (r) => num(r.kq.totalInputKg) },
    { key: "tp", header: "TP ra (kg)", so: true, render: (r) => num(r.kq.totalOutputKg) },
    { key: "dm", header: "Định mức", so: true, render: (r) => (r.coThanhPham ? num(r.kq.norm) : "chưa có TP") },
    {
      key: "lai",
      header: "Lãi/lỗ (đ)",
      so: true,
      render: (r) =>
        r.coThanhPham ? (
          <span className={r.kq.profitOrLoss >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
            {formatMoney(r.kq.profitOrLoss)}
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
        { kho: r.warehouseCode, periodFrom: r.periodFrom, periodTo: r.periodTo, tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0, soMH: 0 };
      cur.tonDau += r.openingKg;
      cur.nhap += r.inKg;
      cur.xuat += r.outKg;
      cur.tonCuoi += r.openingKg + r.inKg - r.outKg;
      cur.soMH += 1;
      m.set(r.warehouseCode, cur);
    }
    return [...m.values()].sort((a, b) => b.tonCuoi - a.tonCuoi);
  }, [snapshots]);
  const warehouseColumns: CotTong<WarehouseRow>[] = [
    {
      key: "kho",
      header: "Kho / chi nhánh",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.kho}</div>
          <div className="text-sm text-muted-foreground">
            kỳ {formatDateVN(r.periodFrom)} – {formatDateVN(r.periodTo)} · {r.soMH} mặt hàng
          </div>
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.tonDau), tong: () => num(warehouseTotals.reduce((s, k) => s + k.tonDau, 0)) },
    { key: "nhap", header: "Nhập (kg)", so: true, render: (r) => (r.nhap ? `+${num(r.nhap)}` : "—"), tong: () => num(warehouseTotals.reduce((s, k) => s + k.nhap, 0)) },
    { key: "xuat", header: "Xuất (kg)", so: true, render: (r) => (r.xuat ? `−${num(r.xuat)}` : "—"), tong: () => num(warehouseTotals.reduce((s, k) => s + k.xuat, 0)) },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.tonCuoi)}</span>,
      tong: () => num(warehouseTotals.reduce((s, k) => s + k.tonCuoi, 0)),
    },
  ];

  const dayLabels = byDate.map((x) => shortDate(x.ngay));
  const hasDailyFigures = byDate.some((x) => x.nhap > 0 || x.sanXuat > 0);
  const hasStock = byDate.some((x) => x.tonBtp !== 0 || x.tonTp !== 0);
  const khoaKy = `${tu}|${den}|${workshop || "tat-ca"}`;
  const duongKhau = Object.fromEntries(khau.map((k) => [k.khoa, k.duongDan]));
  const coloredStages = khau.map((k) => ({ ...k, sac: SAC_KHAU[k.khoa] }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan — dòng chảy số liệu</h1>
        <p className="mt-1 text-muted-foreground">
          Nguyên liệu vào đi qua 5 khâu ra sao, đang kẹt ở đâu, còn việc gì phải đốc. Mọi số lấy từ sổ đã ghi; sổ
          nào chưa có số thì hình để trống.
        </p>
      </div>

      {/* Chế độ demo — chỉ admin bật (hoặc máy chạy không đăng nhập: sandbox). */}
      {(laAdmin || !canDangNhap) && <KhoiCheDoDemo />}

      {/* Thanh lọc GỌN một hàng: kỳ (bấm nhanh) · lùi/tiến · xưởng. Tự chọn mới hiện ô ngày. */}
      <div className="grid gap-3 rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Tabs value={ky} onValueChange={(v) => setKy(v as ViewPeriod)}>
            <TabsList aria-label="Kỳ xem" className="flex-wrap group-data-horizontal/tabs:h-auto">
              {KY_NHANH.map((k) => (
                <TabsTrigger key={k.value} value={k.value} title={`Xem số theo ${k.label.toLowerCase()}.`}>
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {ky !== "tuy-chon" && (
            <div className="flex items-center gap-1">
              <Button title="Lùi về kỳ trước." variant="ghost" size="icon" aria-label="Kỳ trước" onClick={() => setMoc(stepPeriod(ky, moc, -1))}>
                <ChevronLeft />
              </Button>
              <span className="tnum min-w-[9rem] text-center text-base font-semibold text-foreground">{periodLabel(ky, tu, den)}</span>
              <Button title="Tới kỳ sau." variant="ghost" size="icon" aria-label="Kỳ sau" onClick={() => setMoc(stepPeriod(ky, moc, 1))}>
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
        {ky === "tuy-chon" && (
          <div className="max-w-md">
            <DateRangeField
              label="Khoảng ngày"
              anNhanBatBuoc
              presets={false}
              startDate={tuTC}
              endDate={denTC}
              onChange={(a2, b2) => {
                setTuTC(a2);
                setDenTC(b2);
              }}
            />
          </div>
        )}
      </div>

      <ThongKe the={the} />

      <Section
        tieuDe="Năm khâu của chuỗi"
        moTa="kg đã qua từng khâu trong kỳ và số lô / dòng còn thiếu việc (tem, gắn lô, duyệt, quét kiểm). Phần trăm trên mũi tên so với khâu nguồn: SX so với NL nhập, nhập kho so với SX, đóng gói và xuất/bán so với nhập kho. Bấm một khâu để mở màn của khâu đó."
      >
        <BangChuyen khau={coloredStages} onChon={(k) => navigate(duongKhau[k] ?? "/dashboard")} />
      </Section>

      <Section
        tieuDe="Nguyên liệu đi đâu"
        moTa="Mỗi thanh là 100% một khối hàng, chia theo nơi nó đi tới. Bấm một phần để mở màn liên quan."
      >
        {materialOutflow.length === 0 && outOfWarehouse.length === 0 ? (
          <EmptyState icon={Truck} tieuDe="Kỳ này chưa có số" moTa="Chưa ghi nhập hàng hay sản xuất nào trong kỳ đang xem." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {materialOutflow.length > 0 && (
              <div className="grid gap-3">
                <p className="text-base text-foreground">
                  Cứ <b className="tnum">100 kg</b> nguyên liệu vào xưởng thì ra{" "}
                  <b className="tnum text-xl text-tone-tim">{num(Math.round(wipRatio * 100))} kg</b> bán thành phẩm.
                  {priorMaterialKg > 0 && (
                    <span className="text-sm text-muted-foreground"> (Đã gồm {num(priorMaterialKg)} kg NL lấy từ kho / kỳ trước.)</span>
                  )}
                </p>
                <ThanhChiaPhan
                  phan={toShares(materialOutflow, MATERIAL_PARTS)}
                  moTa="Nguyên liệu vào xưởng chia theo nơi đi tới"
                  onChon={(k) => nodePaths[k] && navigate(nodePaths[k])}
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
                <ThanhChiaPhan
                  phan={toShares(outOfWarehouse, WAREHOUSE_PARTS)}
                  moTa="Hàng trong kho dự trữ chia theo nơi đi tới"
                  onChon={(k) => nodePaths[k] && navigate(nodePaths[k])}
                />
              </div>
            )}
          </div>
        )}
      </Section>

      <div ref={warningsRef} className="scroll-mt-header">
        <Section
          tieuDe={`Việc cần đốc (${warnings.length})`}
          moTa="Sổ sai đứng trước, rồi việc chưa làm, cuối cùng là các ghi bù để biết. Bấm Mở để tới đúng chỗ sửa."
        >
          {warnings.length === 0 ? (
            <EmptyState icon={AlertTriangle} tieuDe="Không có việc tồn đọng" moTa="Các ngày đã chốt, lô đã gắn, không có bán vượt tồn trong kỳ này." />
          ) : (
            <BangTong rows={warnings} cot={warningColumns} getKey={(r) => r.id} toMau={`tong-quan-canh-bao|${khoaKy}`} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Section tieuDe="Nhập và sản xuất theo ngày" moTa="Cột: kg nguyên liệu nhập và kg bán thành phẩm sản xuất mỗi ngày.">
          {hasDailyFigures ? (
            <BieuDoTheoNgay
              nhan={dayLabels}
              moTa="Biểu đồ kg nhập và sản xuất theo ngày"
              chuoi={[
                { khoa: "nhap", ten: "NL nhập", mau: KIND_TONES.nhap, dang: "cot", giaTri: byDate.map((x) => x.nhap) },
                { khoa: "sx", ten: "BTP sản xuất", mau: KIND_TONES.sanXuat, dang: "cot", giaTri: byDate.map((x) => x.sanXuat) },
              ]}
            />
          ) : (
            <EmptyState icon={Factory} tieuDe="Chưa có nhập / sản xuất trong kỳ" moTa="Ghi chuyến ở Nhập hàng và mẻ ở Sản xuất thành phẩm để thấy biểu đồ." />
          )}
        </Section>
        <Section
          tieuDe="Tồn kho theo ngày"
          moTa="Tồn bán thành phẩm kho dự trữ và thành phẩm đóng gói cuối mỗi ngày. Tồn nguyên liệu chưa vẽ: sổ NL chưa trừ phần đưa vào sản xuất."
        >
          {hasStock ? (
            <BieuDoTheoNgay
              nhan={dayLabels}
              moTa="Biểu đồ tồn kho theo ngày"
              chuoi={[
                { khoa: "btp", ten: "Tồn BTP kho dự trữ", mau: KIND_TONES.kho, dang: "duong", vung: true, giaTri: byDate.map((x) => x.tonBtp) },
                { khoa: "tp", ten: "Tồn TP đóng gói", mau: KIND_TONES.dongGoi, dang: "duong", giaTri: byDate.map((x) => x.tonTp) },
              ]}
            />
          ) : (
            <EmptyState icon={Warehouse} tieuDe="Chưa có tồn trong kỳ" moTa="Duyệt nhập kho bán thành phẩm ở Kho dự trữ để có tồn." />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Section
          tieuDe="Kết quả các kỳ cân đối"
          moTa="Định mức = NL vào ÷ TP ra; lãi/lỗ = giá trị xuất − giá thành. Kỳ chưa có thành phẩm thì chưa tính."
        >
          {cacKy.length === 0 ? (
            <EmptyState icon={Scale} tieuDe="Chưa có kỳ cân đối" moTa="Tạo kỳ ở màn Cân đối kỳ để thấy định mức và lãi/lỗ." />
          ) : (
            <BangTong rows={cacKy.slice(0, 8)} cot={periodColumns} getKey={(r) => r.period.id} className="cot-dau-dinh" toMau="tong-quan-ky-can-doi" />
          )}
        </Section>
        <Section
          tieuDe="Định mức theo mặt hàng"
          moTa={
            yieldRatio.binhQuan != null
              ? `Chỉ tính mẻ đã gắn lô NL có cân kg. Bình quân ${num(yieldRatio.binhQuan)} — mặt hàng lệch quá ±${YIELD_RATIO_THRESHOLD * 100}% được ghi chú.`
              : "Chỉ tính mẻ đã gắn lô NL có cân kg."
          }
        >
          {yieldRatio.dong.length === 0 ? (
            <EmptyState icon={Gauge} tieuDe="Chưa đủ số để tính" moTa="Khi gắn lô NL cho mẻ ở Sản xuất có ghi kg, định mức từng mặt hàng hiện ở đây." />
          ) : (
            <BieuDoCot
              data={yieldRatio.dong.map((r) => ({
                nhan: r.ten,
                giaTri: r.dinhMuc,
                phu: `${r.lech > 0 ? "+" : ""}${num(r.lech * 100)}% so bình quân${r.vuotNguong ? " · lệch" : ""}`,
              }))}
              dinhDang={(n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
              giaTriTrungBinh={yieldRatio.binhQuan ?? undefined}
            />
          )}
        </Section>
      </div>

      <Section
        tieuDe="Tồn kho theo kho (báo cáo Xuất–Nhập–Tồn)"
        moTa="Tồn cuối của kỳ mới nhất mỗi kho. Nguồn: báo cáo NXT nhập từ hệ thống xí nghiệp."
        hanhDong={
          warehouseTotals.length > 0 && (
            <Button title="Mở màn Nhập xuất tồn kho để xem số chi tiết theo từng mã hàng." variant="outline" onClick={() => navigate("/nxt-kho")}>
              Mở báo cáo XNT kho
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )
        }
      >
        {warehouseTotals.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} tieuDe="Chưa có số liệu tồn kho" moTa="Nạp báo cáo Xuất–Nhập–Tồn ở màn Nhập xuất tồn kho để thấy tồn theo kho tại đây." />
        ) : (
          <BangTong rows={warehouseTotals} cot={warehouseColumns} getKey={(r) => r.kho} className="cot-dau-dinh" />
        )}
      </Section>
    </div>
  );
}
