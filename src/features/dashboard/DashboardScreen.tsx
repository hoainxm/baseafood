// ============================================================
// Tên file: src/features/dashboard/DashboardScreen.tsx
// Tên tiếng Việt: Màn hình Tổng quan — số liệu THẬT đang có trong hệ thống
// Description: Operational overview built from real collections (no mock data)
// ============================================================
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  BangTong,
  Button,
  EmptyState,
  ThongKe,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import {
  useNxtSnapshots,
  useMaterialImports,
  useWipProductions,
  useSalesItems,
} from "@/lib/catalogRepo";
import { num, viDate } from "@/lib/format";
import {
  ArrowRight,
  Factory,
  FileSpreadsheet,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";

/**
 * Tổng quan — cửa vào MES, dựng HOÀN TOÀN từ dữ liệu thật đang có: tồn kho (báo
 * cáo Xuất–Nhập–Tồn), nhập hàng, sản xuất BTP, bán hàng. Domain nào chưa có số
 * thì hiện 0 / trạng thái rỗng trung thực — không bịa. Số vận hành sâu nằm ở màn
 * chuyên biệt; đây chỉ tổng hợp + lối tắt.
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

function Khoi({
  tieuDe,
  moTa,
  hanhDong,
  children,
}: {
  tieuDe: string;
  moTa?: string;
  hanhDong?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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
  const [snapshots] = useNxtSnapshots();
  const [imports] = useMaterialImports();
  const [wips] = useWipProductions();
  const [salesItems] = useSalesItems();

  // Các dòng NXT thuộc KỲ MỚI NHẤT của mỗi kho (tồn hiện hành).
  const latestRows = useMemo(() => {
    const latest = new Map<string, string>();
    for (const r of snapshots) {
      const p = latest.get(r.warehouseCode);
      if (!p || r.periodTo > p) latest.set(r.warehouseCode, r.periodTo);
    }
    return snapshots
      .filter((r) => latest.get(r.warehouseCode) === r.periodTo)
      .map((r) => ({ ...r, closingKg: r.openingKg + r.inKg - r.outKg }));
  }, [snapshots]);

  const khoTong: RowKho[] = useMemo(() => {
    const m = new Map<string, RowKho>();
    for (const r of latestRows) {
      const cur =
        m.get(r.warehouseCode) ??
        { kho: r.warehouseCode, periodFrom: r.periodFrom, periodTo: r.periodTo, tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0, soMH: 0 };
      cur.tonDau += r.openingKg;
      cur.nhap += r.inKg;
      cur.xuat += r.outKg;
      cur.tonCuoi += r.closingKg;
      cur.soMH += 1;
      m.set(r.warehouseCode, cur);
    }
    return [...m.values()].sort((a, b) => b.tonCuoi - a.tonCuoi);
  }, [latestRows]);

  const tonKho = khoTong.reduce((s, k) => s + k.tonCuoi, 0);
  const soDong = latestRows.length;
  const soKho = khoTong.length;

  const nhapKg = useMemo(() => imports.reduce((s, i) => s + (i.quantityKg || 0), 0), [imports]);
  const sxKg = useMemo(() => wips.reduce((s, w) => s + (w.quantityKg || 0), 0), [wips]);
  const banKg = useMemo(() => salesItems.reduce((s, x) => s + (x.quantityKg || 0), 0), [salesItems]);

  // Nhập hàng theo phân xưởng (Đông / Cá / Khô) — từ sổ nhập thật.
  const nhapXuong = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of imports) m.set(it.workshop, (m.get(it.workshop) ?? 0) + (it.quantityKg || 0));
    return [...m.entries()].map(([xuong, kg]) => ({ xuong, kg })).sort((a, b) => b.kg - a.kg);
  }, [imports]);

  // Biến động lớn trong kỳ (NXT) — top theo (nhập + xuất).
  const bienDong = useMemo(
    () =>
      [...latestRows]
        .filter((r) => r.inKg + r.outKg > 0)
        .sort((a, b) => b.inKg + b.outKg - (a.inKg + a.outKg))
        .slice(0, 6),
    [latestRows]
  );

  const the: TheThongTin[] = [
    {
      nhan: "Tồn kho (báo cáo NXT)",
      giaTri: `${num(tonKho)} kg`,
      so: true,
      icon: Warehouse,
      mau: "brand",
    },
    {
      nhan: "Nhập hàng đã ghi",
      giaTri: `${num(nhapKg)} kg`,
      so: true,
      icon: Truck,
      mau: nhapKg > 0 ? "success" : "trung-tinh",
    },
    {
      nhan: "Sản xuất thành phẩm (BTP)",
      giaTri: `${num(sxKg)} kg`,
      so: true,
      icon: Factory,
      mau: sxKg > 0 ? "brand" : "trung-tinh",
    },
    {
      nhan: "Bán hàng đã ghi",
      giaTri: `${num(banKg)} kg`,
      so: true,
      icon: ShoppingCart,
      mau: banKg > 0 ? "warning" : "trung-tinh",
    },
  ];

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
      tong: () => num(tonKho),
    },
  ];

  const cotBienDong: CotTong<(typeof bienDong)[number]>[] = [
    {
      key: "mh",
      header: "Mã hàng · tên",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.itemName}</div>
          <div className="font-mono text-sm text-muted-foreground">{r.itemCode}</div>
        </div>
      ),
    },
    { key: "nhap", header: "Nhập (kg)", so: true, render: (r) => (r.inKg ? <span className="text-success">+{num(r.inKg)}</span> : "—") },
    { key: "xuat", header: "Xuất (kg)", so: true, render: (r) => (r.outKg ? <span className="text-warning">−{num(r.outKg)}</span> : "—") },
    { key: "cuoi", header: "Tồn cuối (kg)", so: true, render: (r) => num(r.closingKg) },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan</h1>
        <p className="mt-1 text-muted-foreground">
          Số liệu thật đang có trong hệ thống — tồn kho, nhập hàng, sản xuất, bán hàng. Domain chưa có
          dữ liệu hiện 0.
        </p>
      </div>

      <ThongKe the={the} />

      <Khoi
        tieuDe="Tồn kho theo kho (báo cáo Xuất–Nhập–Tồn)"
        moTa="Tồn cuối của kỳ mới nhất mỗi kho. Nguồn: báo cáo NXT nhập từ hệ thống xí nghiệp."
        hanhDong={
          khoTong.length > 0 && (
            <Button variant="outline" onClick={() => navigate("/nxt-kho")}>
              Mở báo cáo XNT kho
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )
        }
      >
        {khoTong.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            tieuDe="Chưa có số liệu tồn kho"
            moTa="Nạp báo cáo Xuất–Nhập–Tồn ở màn 'XNT kho (số thật)' để thấy tồn theo kho tại đây."
          />
        ) : (
          <BangTong rows={khoTong} cot={cotKho} getKey={(r) => r.kho} />
        )}
      </Khoi>

      <div className="grid gap-6 lg:grid-cols-2">
        <Khoi
          tieuDe="Biến động lớn trong kỳ"
          moTa="Mặt hàng nhập/xuất nhiều nhất kỳ mới nhất (từ báo cáo NXT)."
        >
          {bienDong.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              tieuDe="Kỳ này chưa có biến động"
              moTa="Các mặt hàng đang chỉ giữ tồn, chưa phát sinh nhập/xuất trong kỳ."
            />
          ) : (
            <BangTong rows={bienDong} cot={cotBienDong} getKey={(r) => r.id} />
          )}
        </Khoi>

        <Khoi
          tieuDe="Nhập hàng theo phân xưởng"
          moTa="Tổng khối lượng đã ghi ở sổ Nhập hàng, tách theo xưởng."
          hanhDong={
            <Button variant="outline" onClick={() => navigate("/imports")}>
              Mở Nhập hàng
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          }
        >
          {nhapXuong.length === 0 ? (
            <EmptyState
              icon={Truck}
              tieuDe="Chưa ghi nhập hàng nào"
              moTa="Vào màn Nhập hàng để ghi chuyến nguyên liệu — số sẽ tổng hợp về đây."
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border-2 border-border">
              {nhapXuong.map((x) => (
                <li key={x.xuong} className="flex items-center justify-between gap-3 p-3">
                  <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Badge variant="outline">{x.xuong}</Badge>
                  </span>
                  <span className="tnum text-base font-semibold text-foreground">{num(x.kg)} kg</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 bg-muted/40 p-3">
                <span className="text-base font-semibold text-foreground">Tổng nhập</span>
                <span className="tnum text-base font-bold text-foreground">{num(nhapKg)} kg</span>
              </li>
            </ul>
          )}
        </Khoi>
      </div>

      <p className="text-sm text-muted-foreground">
        Cần con số theo dõi ({num(soDong)} dòng · {soKho} kho) chi tiết hơn? Mở{" "}
        <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => navigate("/nxt-kho")}>
          báo cáo Xuất–Nhập–Tồn kho
        </button>
        .
      </p>
    </div>
  );
}
