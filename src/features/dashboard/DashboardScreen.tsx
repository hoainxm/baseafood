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
  bangChuyen,
  canhBaoChuoi,
  chuoiTheoNgay,
  dinhMucTheoMatHang,
  dongChayKg,
  ketQuaCacKy,
  nhanLoaiCanhBao,
  phanBoRa,
  NGUONG_DINH_MUC,
  type CanhBao,
  type DuLieuDongChay,
  type KetQuaKy,
  type KhoangXem,
} from "@/lib/dongChay";
import { phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
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
 * vào ⇒ qua 5 khâu ⇒ ra đâu, kèm việc cần đốc. Mọi số tính ở `lib/dongChay.ts` (hàm
 * thuần có test) trên đúng các sổ thật — sổ nào trống thì hình trống trung thực.
 */

interface RowKho {
  kho: string;
  periodFrom: string;
  periodTo: string;
  tonDau: number;
  nhap: number;
  xuat: number;
  tonCuoi: number;
  soMH: number;
}

const KY_NHANH: { value: KyXem; label: string }[] = [
  { value: "ngay", label: "Ngày" },
  { value: "tuan", label: "Tuần" },
  { value: "thang", label: "Tháng" },
  { value: "nam", label: "Năm" },
  { value: "tuy-chon", label: "Tự chọn" },
];
const XUONG_NHANH = [
  { value: "tat-ca", label: "Cả 3 xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

/**
 * MÀU THEO LOẠI SỐ — một loại một sắc, dùng chung cho thẻ, băng chuyền và thanh chia
 * phần trên màn này để mắt nối được "thẻ xanh dương = nhập", "thẻ tím = sản xuất"…
 */
const SAC_LOAI = {
  nhap: "bien",
  sanXuat: "tim",
  dinhMuc: "cat",
  kho: "ngoc",
  dongGoi: "bang",
  ban: "la",
  lo: "bang",
} as const satisfies Record<string, SacPhanLoai>;
const SAC_KHAU: Record<string, SacPhanLoai> = {
  nhap: SAC_LOAI.nhap,
  "san-xuat": SAC_LOAI.sanXuat,
  kho: SAC_LOAI.kho,
  "dong-goi": SAC_LOAI.dongGoi,
  "xuat-ban": SAC_LOAI.ban,
};

/** Tên + sắc + câu phụ cho từng phần của hai thanh "đi đâu" (id nút ở lib/dongChay). */
const PHAN_NL: Record<string, { nhan: string; sac: SacPhanLoai; moTa?: string }> = {
  btp: { nhan: "Thành bán thành phẩm", sac: SAC_LOAI.sanXuat },
  nd: { nhan: "Bán thẳng nội địa", sac: SAC_LOAI.ban },
  cd: { nhan: "Còn dở, gửi đông", sac: SAC_LOAI.kho, moTa: "ghi lúc chốt ngày sản xuất" },
  pl: { nhan: "Phế liệu", sac: "cam" },
  hh: { nhan: "Hao hụt / chưa ghi ra", sac: "xam", moTa: "hao hụt chế biến hoặc NL chưa ghi dùng vào đâu" },
};
const PHAN_KHO: Record<string, { nhan: string; sac: SacPhanLoai; moTa?: string }> = {
  goi: { nhan: "Đem đóng gói", sac: SAC_LOAI.dongGoi },
  xd: { nhan: "Xuất theo đơn", sac: SAC_LOAI.ban },
  bb: { nhan: "Bán block thô", sac: "hong" },
  tonBtp: { nhan: "Còn trong kho", sac: SAC_LOAI.kho },
};

/** Lùi / tiến mốc kỳ một bước (ngày · tuần · tháng · năm). */
function buocKy(ky: KyXem, moc: string, buoc: 1 | -1): string {
  const d = new Date(`${moc}T00:00:00Z`);
  if (ky === "ngay") d.setUTCDate(d.getUTCDate() + buoc);
  else if (ky === "tuan") d.setUTCDate(d.getUTCDate() + 7 * buoc);
  else if (ky === "thang") d.setUTCMonth(d.getUTCMonth() + buoc, 1);
  else if (ky === "nam") d.setUTCFullYear(d.getUTCFullYear() + buoc, 0, 1);
  return d.toISOString().slice(0, 10);
}

/** Nhãn kỳ đang xem, ngắn: "Tháng 10/2026" · "Năm 2026" · "06/10 – 12/10/2026". */
function nhanKy(ky: KyXem, tu: string, den: string): string {
  if (ky === "ngay") return viDate(tu);
  if (ky === "thang") return `Tháng ${tu.slice(5, 7)}/${tu.slice(0, 4)}`;
  if (ky === "nam") return `Năm ${tu.slice(0, 4)}`;
  return `${viDate(tu)} – ${viDate(den)}`;
}

const NHAN_MUC: Record<CanhBao["muc"], { chu: string; loai: LoaiNhan }> = {
  loi: { chu: "Sổ sai", loai: "loi" },
  nhac: { chu: "Chưa làm", loai: "luu-y" },
  tin: { chu: "Để biết", loai: "phu" },
};

const dongTien = (n: number) => `${n < 0 ? "−" : ""}${num(Math.abs(Math.round(n)))} đ`;
const ngayNgan = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Khoi({
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
  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [xuong, setXuong] = useState<Workshop | "">("");
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);
  const khoang: KhoangXem = useMemo(() => ({ tu, den, xuong }), [tu, den, xuong]);
  const canhBaoRef = useRef<HTMLDivElement>(null);

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

  const d: DuLieuDongChay = useMemo(
    () => ({ ...dl, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening }),
    [dl, scraps, dailyLocks, productionLocks, periods, balancingInputs, balancingOutputs, materialOpening, finishedOpening],
  );

  // ---- Gom số (lib/dongChay) ----
  const dongChay = useMemo(() => dongChayKg(d, khoang), [d, khoang]);
  const khau = useMemo(() => bangChuyen(d, khoang), [d, khoang]);
  // Chuỗi theo ngày dừng ở hôm nay — ngày tương lai chưa có số, vẽ ra chỉ là đường phẳng.
  const theoNgay = useMemo(() => {
    const nay = homNay();
    return chuoiTheoNgay(d, { ...khoang, den: khoang.den < nay ? khoang.den : nay });
  }, [d, khoang]);
  const dinhMuc = useMemo(() => dinhMucTheoMatHang(d, khoang), [d, khoang]);
  const canhBao = useMemo(() => canhBaoChuoi(d, khoang, homNay()), [d, khoang]);
  const cacKy = useMemo(() => ketQuaCacKy(d), [d]);

  const kgKhau = (k: string) => khau.find((x) => x.khoa === k)?.kg ?? 0;
  const nhapKg = kgKhau("nhap");
  const sxKg = kgKhau("san-xuat");
  const raKg = kgKhau("xuat-ban");
  const cuoi = theoNgay[theoNgay.length - 1];
  const kyGanNhat = cacKy.find((x) => x.coThanhPham);
  const soViec = canhBao.filter((c) => c.muc !== "tin").length;
  const soSai = canhBao.filter((c) => c.muc === "loi").length;

  // % kg BTP trong khoảng đã có lô NL (hoặc lý do chưa gắn).
  const tiLeLo = useMemo(() => {
    const mes = d.wips.filter((w) => w.productionDate >= tu && w.productionDate <= den && (!xuong || w.workshop === xuong));
    const tong = mes.reduce((s, w) => s + (w.quantityKg || 0), 0);
    if (tong <= 0) return null;
    const coLo = new Set([
      ...d.lotInputs.filter((l) => l.outputKind === "W").map((l) => l.outputId),
      ...(d.lotWaivers ?? []).filter((l) => l.outputKind === "W").map((l) => l.outputId),
    ]);
    return mes.filter((w) => coLo.has(w.id)).reduce((s, w) => s + (w.quantityKg || 0), 0) / tong;
  }, [d, tu, den, xuong]);

  const the: TheThongTin[] = [
    {
      nhan: "Nguyên liệu nhập",
      giaTri: `${num(nhapKg)} kg`,
      phu: `${new Set(d.imports.filter((r) => r.deliveryDate >= tu && r.deliveryDate <= den && (!xuong || r.workshop === xuong)).map((r) => r.shipmentId)).size} chuyến`,
      so: true,
      icon: Truck,
      sac: SAC_LOAI.nhap,
      onChon: () => navigate("/imports"),
      moTaChon: "Mở màn Nhập hàng để xem từng chuyến.",
    },
    {
      nhan: "Bán thành phẩm sản xuất",
      giaTri: `${num(sxKg)} kg`,
      phu: nhapKg > 0 ? `= ${num((sxKg / nhapKg) * 100)}% kg NL nhập` : undefined,
      so: true,
      icon: Factory,
      sac: SAC_LOAI.sanXuat,
      onChon: () => navigate("/wip"),
      moTaChon: "Mở màn Sản xuất thành phẩm.",
    },
    {
      nhan: "Định mức NL/TP bình quân",
      giaTri: dinhMuc.binhQuan != null ? num(dinhMuc.binhQuan) : kyGanNhat ? num(kyGanNhat.kq.norm) : "—",
      phu:
        dinhMuc.binhQuan != null
          ? `từ ${dinhMuc.dong.length} mặt hàng có gắn lô cân kg`
          : kyGanNhat
            ? `kỳ cân đối ${kyGanNhat.period.materialTypeName} gần nhất`
            : "chưa có mẻ gắn lô cân kg",
      so: true,
      icon: Gauge,
      sac: SAC_LOAI.dinhMuc,
    },
    {
      nhan: "Tồn BTP kho dự trữ cuối kỳ",
      giaTri: `${num(cuoi?.tonBtp ?? 0)} kg`,
      phu: `TP đóng gói còn ${num(cuoi?.tonTp ?? 0)} kg`,
      so: true,
      icon: Warehouse,
      sac: SAC_LOAI.kho,
      onChon: () => navigate("/warehouse"),
      moTaChon: "Mở màn Kho dự trữ để xem tồn theo lô.",
    },
    {
      nhan: "Xuất + bán ra",
      giaTri: `${num(raKg)} kg`,
      phu: "xuất theo đơn · bán lẻ · bán nội địa",
      so: true,
      icon: ShoppingCart,
      sac: SAC_LOAI.ban,
      onChon: () => navigate("/orders"),
      moTaChon: "Mở màn Đơn đặt để xem lệnh xuất.",
    },
    {
      nhan: "Lãi/lỗ kỳ cân đối gần nhất",
      giaTri: kyGanNhat ? dongTien(kyGanNhat.kq.profitOrLoss) : "—",
      phu: kyGanNhat ? `${kyGanNhat.period.materialTypeName} · ${kyGanNhat.period.dateRangeDescription}` : "chưa có kỳ có thành phẩm",
      so: true,
      icon: Scale,
      mau: !kyGanNhat ? "trung-tinh" : kyGanNhat.kq.profitOrLoss >= 0 ? "success" : "danger",
      onChon: kyGanNhat ? () => navigate(`/balancing/${kyGanNhat.period.id}`) : undefined,
      moTaChon: "Mở kỳ cân đối để xem bảng chi tiết.",
    },
    {
      nhan: "Mẻ đã gắn lô NL",
      giaTri: tiLeLo == null ? "—" : `${num(tiLeLo * 100)}%`,
      phu: "tính theo kg BTP (gồm mẻ đã ghi lý do)",
      so: true,
      icon: QrCode,
      sac: SAC_LOAI.lo,
      onChon: () => navigate("/qr?tab=giai-doan"),
      moTaChon: "Mở Mã lô QR — tab Theo giai đoạn để gắn lô còn thiếu.",
    },
    {
      nhan: "Việc cần đốc",
      giaTri: `${num(soViec)} việc`,
      phu: soSai > 0 ? `${soSai} chỗ sổ sai cần sửa` : "không có sổ sai",
      so: true,
      icon: AlertTriangle,
      mau: soSai > 0 ? "danger" : soViec > 0 ? "warning" : "success",
      onChon: () => canhBaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      moTaChon: "Cuộn tới danh sách việc cần đốc.",
    },
  ];

  // ---- Hai thanh "đi đâu" (thay sơ đồ dòng chảy — dễ đọc hơn) ----
  const duongNut = useMemo(
    () => Object.fromEntries(dongChay.nut.filter((n) => n.duongDan).map((n) => [n.id, n.duongDan as string])),
    [dongChay],
  );
  const doiPhan = (ds: ReturnType<typeof phanBoRa>, ten: typeof PHAN_NL): PhanChia[] =>
    ds.map((x) => ({ khoa: x.id, nhan: ten[x.id]?.nhan ?? x.nhan, sac: ten[x.id]?.sac ?? "xam", moTa: ten[x.id]?.moTa, giaTri: x.kg }));
  const raNL = useMemo(
    () => phanBoRa(dongChay, (id) => id.startsWith("x:"), Object.keys(PHAN_NL)),
    [dongChay],
  );
  const raKho = useMemo(() => phanBoRa(dongChay, (id) => id === "kho", Object.keys(PHAN_KHO)), [dongChay]);
  const nlTruoc = dongChay.canh.filter((c) => c.tu === "nlTruoc").reduce((s, c) => s + c.kg, 0);
  const khoTruoc = dongChay.canh.filter((c) => c.tu === "tonBtpDau").reduce((s, c) => s + c.kg, 0);
  const tiLeBtp = raNL.find((x) => x.id === "btp")?.tiLe ?? 0;

  // ---- Bảng việc cần đốc ----
  const cotCanhBao: CotTong<CanhBao>[] = [
    {
      key: "muc",
      header: "Mức",
      render: (r) => (
        <Nhan loai={NHAN_MUC[r.muc].loai}>
          {NHAN_MUC[r.muc].chu}
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
            {nhanLoaiCanhBao(r.loai)} · {r.chiTiet}
          </div>
        </div>
      ),
    },
    { key: "ngay", header: "Ngày", render: (r) => (r.ngay ? viDate(r.ngay) : "—") },
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
  const cotKy: CotTong<KetQuaKy>[] = [
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
            {dongTien(r.kq.profitOrLoss)}
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
  const khoTong: RowKho[] = useMemo(() => {
    const latest = new Map<string, string>();
    for (const r of snapshots) {
      const p = latest.get(r.warehouseCode);
      if (!p || r.periodTo > p) latest.set(r.warehouseCode, r.periodTo);
    }
    const m = new Map<string, RowKho>();
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
  const cotKho: CotTong<RowKho>[] = [
    {
      key: "kho",
      header: "Kho / chi nhánh",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.kho}</div>
          <div className="text-sm text-muted-foreground">
            kỳ {viDate(r.periodFrom)} – {viDate(r.periodTo)} · {r.soMH} mặt hàng
          </div>
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.tonDau), tong: () => num(khoTong.reduce((s, k) => s + k.tonDau, 0)) },
    { key: "nhap", header: "Nhập (kg)", so: true, render: (r) => (r.nhap ? `+${num(r.nhap)}` : "—"), tong: () => num(khoTong.reduce((s, k) => s + k.nhap, 0)) },
    { key: "xuat", header: "Xuất (kg)", so: true, render: (r) => (r.xuat ? `−${num(r.xuat)}` : "—"), tong: () => num(khoTong.reduce((s, k) => s + k.xuat, 0)) },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.tonCuoi)}</span>,
      tong: () => num(khoTong.reduce((s, k) => s + k.tonCuoi, 0)),
    },
  ];

  const nhanNgay = theoNgay.map((x) => ngayNgan(x.ngay));
  const coSoNgay = theoNgay.some((x) => x.nhap > 0 || x.sanXuat > 0);
  const coTon = theoNgay.some((x) => x.tonBtp !== 0 || x.tonTp !== 0);
  const khoaKy = `${tu}|${den}|${xuong || "tat-ca"}`;
  const duongKhau = Object.fromEntries(khau.map((k) => [k.khoa, k.duongDan]));
  const khauMau = khau.map((k) => ({ ...k, sac: SAC_KHAU[k.khoa] }));

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
          <Tabs value={ky} onValueChange={(v) => setKy(v as KyXem)}>
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
              <Button title="Lùi về kỳ trước." variant="ghost" size="icon" aria-label="Kỳ trước" onClick={() => setMoc(buocKy(ky, moc, -1))}>
                <ChevronLeft />
              </Button>
              <span className="tnum min-w-[9rem] text-center text-base font-semibold text-foreground">{nhanKy(ky, tu, den)}</span>
              <Button title="Tới kỳ sau." variant="ghost" size="icon" aria-label="Kỳ sau" onClick={() => setMoc(buocKy(ky, moc, 1))}>
                <ChevronRight />
              </Button>
            </div>
          )}
          <Tabs value={xuong || "tat-ca"} onValueChange={(v) => setXuong(v === "tat-ca" ? "" : (v as Workshop))} className="ml-auto">
            <TabsList aria-label="Phân xưởng" className="flex-wrap group-data-horizontal/tabs:h-auto">
              {XUONG_NHANH.map((x) => (
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

      <Khoi
        tieuDe="Năm khâu của chuỗi"
        moTa="kg đã qua từng khâu trong kỳ và số lô / dòng còn thiếu việc (tem, gắn lô, duyệt, quét kiểm). Phần trăm trên mũi tên so với khâu nguồn: SX so với NL nhập, nhập kho so với SX, đóng gói và xuất/bán so với nhập kho. Bấm một khâu để mở màn của khâu đó."
      >
        <BangChuyen khau={khauMau} onChon={(k) => navigate(duongKhau[k] ?? "/dashboard")} />
      </Khoi>

      <Khoi
        tieuDe="Nguyên liệu đi đâu"
        moTa="Mỗi thanh là 100% một khối hàng, chia theo nơi nó đi tới. Bấm một phần để mở màn liên quan."
      >
        {raNL.length === 0 && raKho.length === 0 ? (
          <EmptyState icon={Truck} tieuDe="Kỳ này chưa có số" moTa="Chưa ghi nhập hàng hay sản xuất nào trong kỳ đang xem." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {raNL.length > 0 && (
              <div className="grid gap-3">
                <p className="text-base text-foreground">
                  Cứ <b className="tnum">100 kg</b> nguyên liệu vào xưởng thì ra{" "}
                  <b className="tnum text-xl text-tone-tim">{num(Math.round(tiLeBtp * 100))} kg</b> bán thành phẩm.
                  {nlTruoc > 0 && (
                    <span className="text-sm text-muted-foreground"> (Đã gồm {num(nlTruoc)} kg NL lấy từ kho / kỳ trước.)</span>
                  )}
                </p>
                <ThanhChiaPhan
                  phan={doiPhan(raNL, PHAN_NL)}
                  moTa="Nguyên liệu vào xưởng chia theo nơi đi tới"
                  onChon={(k) => duongNut[k] && navigate(duongNut[k])}
                />
              </div>
            )}
            {raKho.length > 0 && (
              <div className="grid gap-3">
                <p className="text-base text-foreground">
                  Hàng trong <b>kho dự trữ</b> đi đâu
                  {khoTruoc > 0 && (
                    <span className="text-sm text-muted-foreground"> (gồm {num(khoTruoc)} kg tồn từ trước kỳ)</span>
                  )}
                  :
                </p>
                <ThanhChiaPhan
                  phan={doiPhan(raKho, PHAN_KHO)}
                  moTa="Hàng trong kho dự trữ chia theo nơi đi tới"
                  onChon={(k) => duongNut[k] && navigate(duongNut[k])}
                />
              </div>
            )}
          </div>
        )}
      </Khoi>

      <div ref={canhBaoRef} className="scroll-mt-header">
        <Khoi
          tieuDe={`Việc cần đốc (${canhBao.length})`}
          moTa="Sổ sai đứng trước, rồi việc chưa làm, cuối cùng là các ghi bù để biết. Bấm Mở để tới đúng chỗ sửa."
        >
          {canhBao.length === 0 ? (
            <EmptyState icon={AlertTriangle} tieuDe="Không có việc tồn đọng" moTa="Các ngày đã chốt, lô đã gắn, không có bán vượt tồn trong kỳ này." />
          ) : (
            <BangTong rows={canhBao} cot={cotCanhBao} getKey={(r) => r.id} toMau={`tong-quan-canh-bao|${khoaKy}`} />
          )}
        </Khoi>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Khoi tieuDe="Nhập và sản xuất theo ngày" moTa="Cột: kg nguyên liệu nhập và kg bán thành phẩm sản xuất mỗi ngày.">
          {coSoNgay ? (
            <BieuDoTheoNgay
              nhan={nhanNgay}
              moTa="Biểu đồ kg nhập và sản xuất theo ngày"
              chuoi={[
                { khoa: "nhap", ten: "NL nhập", mau: SAC_LOAI.nhap, dang: "cot", giaTri: theoNgay.map((x) => x.nhap) },
                { khoa: "sx", ten: "BTP sản xuất", mau: SAC_LOAI.sanXuat, dang: "cot", giaTri: theoNgay.map((x) => x.sanXuat) },
              ]}
            />
          ) : (
            <EmptyState icon={Factory} tieuDe="Chưa có nhập / sản xuất trong kỳ" moTa="Ghi chuyến ở Nhập hàng và mẻ ở Sản xuất thành phẩm để thấy biểu đồ." />
          )}
        </Khoi>
        <Khoi
          tieuDe="Tồn kho theo ngày"
          moTa="Tồn bán thành phẩm kho dự trữ và thành phẩm đóng gói cuối mỗi ngày. Tồn nguyên liệu chưa vẽ: sổ NL chưa trừ phần đưa vào sản xuất."
        >
          {coTon ? (
            <BieuDoTheoNgay
              nhan={nhanNgay}
              moTa="Biểu đồ tồn kho theo ngày"
              chuoi={[
                { khoa: "btp", ten: "Tồn BTP kho dự trữ", mau: SAC_LOAI.kho, dang: "duong", vung: true, giaTri: theoNgay.map((x) => x.tonBtp) },
                { khoa: "tp", ten: "Tồn TP đóng gói", mau: SAC_LOAI.dongGoi, dang: "duong", giaTri: theoNgay.map((x) => x.tonTp) },
              ]}
            />
          ) : (
            <EmptyState icon={Warehouse} tieuDe="Chưa có tồn trong kỳ" moTa="Duyệt nhập kho bán thành phẩm ở Kho dự trữ để có tồn." />
          )}
        </Khoi>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
        <Khoi
          tieuDe="Kết quả các kỳ cân đối"
          moTa="Định mức = NL vào ÷ TP ra; lãi/lỗ = giá trị xuất − giá thành. Kỳ chưa có thành phẩm thì chưa tính."
        >
          {cacKy.length === 0 ? (
            <EmptyState icon={Scale} tieuDe="Chưa có kỳ cân đối" moTa="Tạo kỳ ở màn Cân đối kỳ để thấy định mức và lãi/lỗ." />
          ) : (
            <BangTong rows={cacKy.slice(0, 8)} cot={cotKy} getKey={(r) => r.period.id} className="cot-dau-dinh" toMau="tong-quan-ky-can-doi" />
          )}
        </Khoi>
        <Khoi
          tieuDe="Định mức theo mặt hàng"
          moTa={
            dinhMuc.binhQuan != null
              ? `Chỉ tính mẻ đã gắn lô NL có cân kg. Bình quân ${num(dinhMuc.binhQuan)} — mặt hàng lệch quá ±${NGUONG_DINH_MUC * 100}% được ghi chú.`
              : "Chỉ tính mẻ đã gắn lô NL có cân kg."
          }
        >
          {dinhMuc.dong.length === 0 ? (
            <EmptyState icon={Gauge} tieuDe="Chưa đủ số để tính" moTa="Khi gắn lô NL cho mẻ ở Sản xuất có ghi kg, định mức từng mặt hàng hiện ở đây." />
          ) : (
            <BieuDoCot
              data={dinhMuc.dong.map((r) => ({
                nhan: r.ten,
                giaTri: r.dinhMuc,
                phu: `${r.lech > 0 ? "+" : ""}${num(r.lech * 100)}% so bình quân${r.vuotNguong ? " · lệch" : ""}`,
              }))}
              dinhDang={(n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
              giaTriTrungBinh={dinhMuc.binhQuan ?? undefined}
            />
          )}
        </Khoi>
      </div>

      <Khoi
        tieuDe="Tồn kho theo kho (báo cáo Xuất–Nhập–Tồn)"
        moTa="Tồn cuối của kỳ mới nhất mỗi kho. Nguồn: báo cáo NXT nhập từ hệ thống xí nghiệp."
        hanhDong={
          khoTong.length > 0 && (
            <Button title="Mở màn Nhập xuất tồn kho để xem số chi tiết theo từng mã hàng." variant="outline" onClick={() => navigate("/nxt-kho")}>
              Mở báo cáo XNT kho
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )
        }
      >
        {khoTong.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} tieuDe="Chưa có số liệu tồn kho" moTa="Nạp báo cáo Xuất–Nhập–Tồn ở màn Nhập xuất tồn kho để thấy tồn theo kho tại đây." />
        ) : (
          <BangTong rows={khoTong} cot={cotKho} getKey={(r) => r.kho} className="cot-dau-dinh" />
        )}
      </Khoi>
    </div>
  );
}
