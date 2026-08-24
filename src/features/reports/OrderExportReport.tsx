// ============================================================
// Tên file: src/features/reports/OrderExportReport.tsx
// Tên tiếng Việt: Báo cáo Đơn đặt được xuất hàng (lệnh xuất theo kỳ)
// Description: Report of sales orders exported/shipped within a date range
// ============================================================
import { Fragment, useMemo, useState } from "react";
import type { SalesOrderStatus } from "@/types";
import {
  useCustomers,
  useExportItems,
  useExportOrders,
  useOrderItems,
  useProducts,
  useSalesOrders,
} from "@/lib/catalogRepo";
import {
  Badge,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  EmptyState,
  PhieuIn,
  SkeletonBang,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TdIn,
  ThIn,
  ThongKe,
  homNay,
  notify,
  type TheThongTin,
} from "@/design-system";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { num, viDate } from "@/lib/format";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import {
  CalendarRange,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  Printer,
  Scale,
} from "lucide-react";

const NHAN_TT: Record<SalesOrderStatus, string> = {
  "dang-gom": "Đang gom",
  du: "Đủ",
  dong: "Đã xuất",
};

interface DongXuat {
  exportDate: string;
  productName: string;
  spec: string;
  quantityKg: number;
  blocksCount: number;
}
interface NhomDon {
  orderId: string;
  customerName: string;
  orderDate: string;
  status: SalesOrderStatus;
  lines: DongXuat[];
  tongKg: number;
  tongBlock: number;
  requiredKg: number;
}

/**
 * Báo cáo Đơn đặt được xuất hàng — gom theo ĐƠN các lệnh xuất (container) có ngày
 * xuất trong kỳ. Nối lệnh xuất → đơn đặt → khách + mặt hàng thực xuất. Kèm số kg
 * đã đặt của đơn để thấy mức hoàn thành. Chỉ đọc; xuất được Excel.
 */
export default function OrderExportReport() {
  const [lenh, , { trangThai }] = useExportOrders();
  const [dongLenh] = useExportItems();
  const [don] = useSalesOrders();
  const [dongDon] = useOrderItems();
  const [khach] = useCustomers();
  const [matHang] = useProducts();
  const dangTai = trangThai === "dang-tai" && lenh.length === 0;

  const [ky, setKy] = useState<KyXem>("thang");
  const [moc, setMoc] = useState(homNay());
  const [tuTC, setTuTC] = useState(homNay());
  const [denTC, setDenTC] = useState(homNay());
  const [khachLoc, setKhachLoc] = useState("Tất cả");
  const [inPrint, setInPrint] = useState(false);
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const optKhach = [
    { value: "Tất cả", label: "Tất cả khách" },
    ...khach.map((k) => ({ value: k.id, label: k.name, phu: k.market || undefined })),
  ];

  const { nhom, tongKg, tongBlock } = useMemo(() => {
    const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
    const tenKH = (id: string) => khach.find((k) => k.id === id)?.name || "(đơn đã xóa)";
    const donCua = (id: string) => don.find((d) => d.id === id);

    const lenhKy = lenh.filter((l) => l.exportDate >= tu && l.exportDate <= den);

    // Gom dòng lệnh (thực xuất) theo ĐƠN.
    const map = new Map<string, NhomDon>();
    for (const l of lenhKy) {
      const d = donCua(l.orderId);
      if (khachLoc !== "Tất cả" && d?.customerId !== khachLoc) continue;
      let g = map.get(l.orderId);
      if (!g) {
        g = {
          orderId: l.orderId,
          customerName: d ? tenKH(d.customerId) : "(đơn đã xóa)",
          orderDate: d?.orderDate || "",
          status: d?.status || "dong",
          lines: [],
          tongKg: 0,
          tongBlock: 0,
          requiredKg: dongDon
            .filter((x) => x.orderId === l.orderId)
            .reduce((s, x) => s + (x.requiredQuantityKg || 0), 0),
        };
        map.set(l.orderId, g);
      }
      for (const dl of dongLenh.filter((x) => x.exportId === l.id)) {
        g.lines.push({
          exportDate: l.exportDate,
          productName: tenMH(dl.productId),
          spec: dl.spec,
          quantityKg: dl.quantityKg || 0,
          blocksCount: dl.blocksCount || 0,
        });
        g.tongKg += dl.quantityKg || 0;
        g.tongBlock += dl.blocksCount || 0;
      }
    }

    const nhom = [...map.values()]
      .filter((g) => g.lines.length > 0)
      .sort(
        (a, b) =>
          a.customerName.localeCompare(b.customerName, "vi") ||
          a.orderDate.localeCompare(b.orderDate)
      );
    for (const g of nhom)
      g.lines.sort(
        (a, b) =>
          a.exportDate.localeCompare(b.exportDate) ||
          a.productName.localeCompare(b.productName, "vi")
      );

    return {
      nhom,
      tongKg: nhom.reduce((s, g) => s + g.tongKg, 0),
      tongBlock: nhom.reduce((s, g) => s + g.tongBlock, 0),
    };
  }, [lenh, dongLenh, don, dongDon, khach, matHang, tu, den, khachLoc]);

  const the: TheThongTin[] = [
    { nhan: "Kỳ báo cáo", giaTri: `${viDate(tu)} – ${viDate(den)}`, icon: CalendarRange, mau: "trung-tinh" },
    { nhan: "Tổng xuất", giaTri: `${num(tongKg)} kg`, so: true, icon: Scale, mau: "brand" },
    { nhan: "Tổng block", giaTri: num(tongBlock), so: true, icon: Layers, mau: "trung-tinh" },
    { nhan: "Số đơn được xuất", giaTri: num(nhom.length), so: true, icon: PackageCheck, mau: "success" },
  ];

  const xuatExcel = () => {
    if (!nhom.length) {
      notify.canhBao("Không có lệnh xuất trong kỳ để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo đơn đặt được xuất hàng"]);
    aoa.push([`Kỳ: ${viDate(tu)} – ${viDate(den)} · Khách: ${khachLoc === "Tất cả" ? "Tất cả" : nhom[0]?.customerName ?? khachLoc}`]);
    aoa.push([]);
    aoa.push(["Khách", "Ngày đặt", "Ngày xuất", "Mặt hàng", "Quy cách", "Kg xuất", "Block", "Đã đặt (kg)"]);
    for (const g of nhom) {
      for (const l of g.lines)
        aoa.push([g.customerName, viDate(g.orderDate), viDate(l.exportDate), l.productName, l.spec, l.quantityKg, l.blocksCount, ""]);
      aoa.push([`Cộng đơn ${g.customerName}`, viDate(g.orderDate), "", "", "", g.tongKg, g.tongBlock, g.requiredKg]);
    }
    aoa.push(["TỔNG CỘNG", "", "", "", "", tongKg, tongBlock, ""]);
    exportAoaToXlsx({
      sheetName: "Đơn xuất",
      aoa,
      colWidths: [24, 12, 12, 30, 12, 12, 10, 12],
      fileName: `bao-cao-don-xuat_${tu}_${den}.xlsx`,
    });
    notify.daLuu("Đã xuất Excel báo cáo đơn xuất");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Báo cáo đơn đặt được xuất hàng
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" onClick={() => setInPrint(true)} disabled={!nhom.length}>
            <Printer />
            In A4
          </Button>
          <Button size="lg" variant="outline" onClick={xuatExcel} disabled={!nhom.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          {ky === "tuy-chon" ? (
            <DateRangeField
              label="Khoảng ngày xuất"
              anNhanBatBuoc
              presets={false}
              startDate={tuTC}
              endDate={denTC}
              onChange={(a, b) => {
                setTuTC(a);
                setDenTC(b);
              }}
            />
          ) : (
            <DateField
              label={ky === "ngay" ? "Ngày xuất" : "Ngày bất kỳ trong kỳ"}
              anNhanBatBuoc
              hint={ky === "ngay" ? undefined : `Kỳ: ${viDate(tu)} – ${viDate(den)}`}
              value={moc}
              onChange={setMoc}
            />
          )}
        </div>
        <div className="min-w-[12rem]">
          <Combobox
            label="Khách hàng"
            anNhanBatBuoc
            choPhepXoa={false}
            value={khachLoc}
            onChange={setKhachLoc}
            options={optKhach}
          />
        </div>
      </div>

      <ThongKe the={the} />

      {dangTai ? (
        <SkeletonBang />
      ) : nhom.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          tieuDe={`Chưa có đơn nào được xuất trong ${viDate(tu)} – ${viDate(den)}`}
          moTa="Tạo lệnh xuất ở màn Đơn đặt, số liệu xuất sẽ tổng hợp về đây."
        />
      ) : (
        <div className="scroll-nice overflow-x-auto rounded-xl border-2 border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Ngày xuất</TableHead>
                <TableHead>Mặt hàng</TableHead>
                <TableHead>Quy cách</TableHead>
                <TableHead className="text-right">Kg xuất</TableHead>
                <TableHead className="text-right">Block</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nhom.map((g) => (
                <Fragment key={g.orderId}>
                  <TableRow>
                    <TableCell colSpan={5} className="bg-muted">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
                        {g.customerName}
                        <span className="font-normal text-muted-foreground">
                          · đặt {g.orderDate ? viDate(g.orderDate) : "—"}
                        </span>
                        <Badge variant={g.status === "dong" ? "secondary" : "outline"}>
                          {NHAN_TT[g.status]}
                        </Badge>
                        {g.requiredKg > 0 && (
                          <span className="font-normal text-muted-foreground">
                            · đã đặt <span className="tnum">{num(g.requiredKg)}</span> kg
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  {g.lines.map((l, i) => (
                    <TableRow key={`${g.orderId}-${i}`}>
                      <TableCell className="whitespace-nowrap">{viDate(l.exportDate)}</TableCell>
                      <TableCell className="font-medium">{l.productName}</TableCell>
                      <TableCell>{l.spec || "—"}</TableCell>
                      <TableCell className="tnum text-right">{num(l.quantityKg)}</TableCell>
                      <TableCell className="tnum text-right">{num(l.blocksCount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold text-muted-foreground">
                      Cộng đơn {g.customerName}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">{num(g.tongKg)}</TableCell>
                    <TableCell className="tnum text-right font-semibold">{num(g.tongBlock)}</TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">TỔNG CỘNG</TableCell>
                <TableCell className="tnum text-right font-bold">{num(tongKg)}</TableCell>
                <TableCell className="tnum text-right font-bold">{num(tongBlock)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {inPrint && (
        <PhieuIn
          tieuDe="Báo cáo đơn đặt được xuất hàng"
          phuDe={`Kỳ: ${viDate(tu)} – ${viDate(den)}${khachLoc !== "Tất cả" ? ` · Khách ${nhom[0]?.customerName ?? ""}` : ""}`}
          onClose={() => setInPrint(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <ThIn>Ngày xuất</ThIn>
                <ThIn>Mặt hàng</ThIn>
                <ThIn>Quy cách</ThIn>
                <ThIn right>Kg xuất</ThIn>
                <ThIn right>Block</ThIn>
              </tr>
            </thead>
            <tbody>
              {nhom.map((g) => (
                <Fragment key={g.orderId}>
                  <tr>
                    <TdIn dam colSpan={5}>
                      {g.customerName} · đặt {g.orderDate ? viDate(g.orderDate) : "—"} · {NHAN_TT[g.status]}
                      {g.requiredKg > 0 ? ` · đã đặt ${num(g.requiredKg)} kg` : ""}
                    </TdIn>
                  </tr>
                  {g.lines.map((l, i) => (
                    <tr key={`${g.orderId}-${i}`}>
                      <TdIn>{viDate(l.exportDate)}</TdIn>
                      <TdIn>{l.productName}</TdIn>
                      <TdIn>{l.spec || "—"}</TdIn>
                      <TdIn right className="tnum">
                        {num(l.quantityKg)}
                      </TdIn>
                      <TdIn right className="tnum">
                        {num(l.blocksCount)}
                      </TdIn>
                    </tr>
                  ))}
                  <tr>
                    <TdIn dam colSpan={3}>
                      Cộng đơn {g.customerName}
                    </TdIn>
                    <TdIn dam right className="tnum">
                      {num(g.tongKg)}
                    </TdIn>
                    <TdIn dam right className="tnum">
                      {num(g.tongBlock)}
                    </TdIn>
                  </tr>
                </Fragment>
              ))}
              <tr>
                <TdIn dam colSpan={3}>
                  TỔNG CỘNG
                </TdIn>
                <TdIn dam right className="tnum">
                  {num(tongKg)}
                </TdIn>
                <TdIn dam right className="tnum">
                  {num(tongBlock)}
                </TdIn>
              </tr>
            </tbody>
          </table>
        </PhieuIn>
      )}
    </div>
  );
}
