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
  HorizontalScroll,
  Tag,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  EmptyState,
  PrintSheet,
  TableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  PrintTd,
  PrintTh,
  StatCardGrid,
  todayIso,
  notify,
  type StatCardData,
  RowMarkToolbar,
  useRowSelection,
  useRowMarkTools,
} from "@/design-system";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { useCan } from "@/features/shared/PermissionProvider";
import {
  CalendarRange,
  FileSpreadsheet,
  Layers,
  PackageCheck,
  Printer,
  Scale,
} from "lucide-react";

const STATUS_LABELS: Record<SalesOrderStatus, string> = {
  collecting: "Đang gom",
  complete: "Đủ",
  closed: "Đã xuất",
};

interface ExportRow {
  /** id dòng lệnh xuất (export_items) — khoá ổn định cho tô màu dòng. */
  id: string;
  exportDate: string;
  productName: string;
  spec: string;
  quantityKg: number;
  blocksCount: number;
}
interface OrderGroup {
  orderId: string;
  customerName: string;
  orderDate: string;
  status: SalesOrderStatus;
  lines: ExportRow[];
  totalKg: number;
  totalBlocks: number;
  requiredKg: number;
}

/**
 * Báo cáo Đơn đặt được xuất hàng — gom theo ĐƠN các lệnh xuất (container) có ngày
 * xuất trong kỳ. Nối lệnh xuất → đơn đặt → khách + mặt hàng thực xuất. Kèm số kg
 * đã đặt của đơn để thấy mức hoàn thành. Chỉ đọc; xuất được Excel.
 */
export default function OrderExportReport() {
  const [exportOrders, , { status }] = useExportOrders();
  // Phân quyền lớp 2: In A4 / Xuất Excel theo quyền `export`.
  const allowed = useCan("export-report");
  const [exportItems] = useExportItems();
  const [don] = useSalesOrders();
  const [orderItems] = useOrderItems();
  const [customers] = useCustomers();
  const [products] = useProducts();
  const isLoading = status === "loading" && exportOrders.length === 0;

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [customerFilter, setCustomerFilter] = useState("Tất cả");
  const [inPrint, setInPrint] = useState(false);
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);
  // Mỗi dòng là một dòng lệnh xuất (id bản ghi) ⇒ dấu "đã dò" khỏi ghép kỳ.
  const to = useRowMarkTools("bao-cao-xuat-don");
  const rowSelection = useRowSelection();

  const customerOptions = [
    { value: "Tất cả", label: "Tất cả khách" },
    ...customers.map((k) => ({ value: k.id, label: k.name, subLabel: k.market || undefined })),
  ];

  const { groups: group, totalKg, totalBlocks } = useMemo(() => {
    const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
    const tenKH = (id: string) => customers.find((k) => k.id === id)?.name || "(đơn đã xóa)";
    const orderById = (id: string) => don.find((d) => d.id === id);

    const periodExportOrders = exportOrders.filter((l) => l.exportDate >= fromDate && l.exportDate <= toDate);

    // Gom dòng lệnh (thực xuất) theo ĐƠN.
    const map = new Map<string, OrderGroup>();
    for (const l of periodExportOrders) {
      const d = orderById(l.orderId);
      if (customerFilter !== "Tất cả" && d?.customerId !== customerFilter) continue;
      let g = map.get(l.orderId);
      if (!g) {
        g = {
          orderId: l.orderId,
          customerName: d ? tenKH(d.customerId) : "(đơn đã xóa)",
          orderDate: d?.orderDate || "",
          status: d?.status || "closed",
          lines: [],
          totalKg: 0,
          totalBlocks: 0,
          requiredKg: orderItems
            .filter((x) => x.orderId === l.orderId)
            .reduce((s, x) => s + (x.requiredQuantityKg || 0), 0),
        };
        map.set(l.orderId, g);
      }
      for (const item of exportItems.filter((x) => x.exportId === l.id)) {
        g.lines.push({
          id: item.id,
          exportDate: l.exportDate,
          productName: productNameOf(item.productId),
          spec: item.spec,
          quantityKg: item.quantityKg || 0,
          blocksCount: item.blocksCount || 0,
        });
        g.totalKg += item.quantityKg || 0;
        g.totalBlocks += item.blocksCount || 0;
      }
    }

    const groups = [...map.values()]
      .filter((g) => g.lines.length > 0)
      .sort(
        (a, b) =>
          a.customerName.localeCompare(b.customerName, "vi") ||
          a.orderDate.localeCompare(b.orderDate)
      );
    for (const g of groups)
      g.lines.sort(
        (a, b) =>
          a.exportDate.localeCompare(b.exportDate) ||
          a.productName.localeCompare(b.productName, "vi")
      );

    return {
      groups,
      totalKg: groups.reduce((s, g) => s + g.totalKg, 0),
      totalBlocks: groups.reduce((s, g) => s + g.totalBlocks, 0),
    };
  }, [exportOrders, exportItems, don, orderItems, customers, products, fromDate, toDate, customerFilter]);
  /** Khoá dòng lệnh xuất đang hiện — thứ tự cho Shift+tick chọn khoảng. */
  const rowKeys = group.flatMap((g) => g.lines.map((l) => l.id));

  const cards: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`, icon: CalendarRange, color: "neutral" },
    { label: "Tổng xuất", value: `${num(totalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    { label: "Tổng block", value: num(totalBlocks), numeric: true, icon: Layers, color: "neutral" },
    { label: "Số đơn được xuất", value: num(group.length), numeric: true, icon: PackageCheck, color: "success" },
  ];

  const exportExcel = () => {
    if (!group.length) {
      notify.warning("Không có lệnh xuất trong kỳ để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo đơn đặt được xuất hàng"]);
    aoa.push([`Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)} · Khách: ${customerFilter === "Tất cả" ? "Tất cả" : group[0]?.customerName ?? customerFilter}`]);
    aoa.push([]);
    aoa.push(["Khách", "Ngày đặt", "Ngày xuất", "Mặt hàng", "Quy cách", "Kg xuất", "Block", "Đã đặt (kg)"]);
    for (const g of group) {
      for (const l of g.lines)
        aoa.push([g.customerName, formatDateVN(g.orderDate), formatDateVN(l.exportDate), l.productName, l.spec, l.quantityKg, l.blocksCount, ""]);
      aoa.push([`Cộng đơn ${g.customerName}`, formatDateVN(g.orderDate), "", "", "", g.totalKg, g.totalBlocks, g.requiredKg]);
    }
    aoa.push(["TỔNG CỘNG", "", "", "", "", totalKg, totalBlocks, ""]);
    exportAoaToXlsx({
      sheetName: "Đơn xuất",
      aoa,
      colWidths: [24, 12, 12, 30, 12, 12, 10, 12],
      fileName: `bao-cao-don-xuat_${fromDate}_${toDate}.xlsx`,
    });
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Báo cáo đơn đặt được xuất hàng
        </h1>
        {allowed.export && (
        <div className="flex flex-wrap gap-2">
          <Button
            title="Xem trước bản in A4 báo cáo đơn xuất rồi in giấy hoặc lưu PDF." size="lg" variant="outline" onClick={() => setInPrint(true)} disabled={!group.length}>
            <Printer />
            In A4
          </Button>
          <Button
            title="Tải báo cáo đơn xuất đang xem ra file Excel." size="lg" variant="outline" onClick={exportExcel} disabled={!group.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            hideRequiredMark
            clearable={false}
            value={period}
            onChange={(v) => setPeriod(v as ViewPeriod)}
            options={PERIOD_OPTIONS}
          />
        </div>
        <div className="min-w-[min(12rem,100%)] flex-1 sm:min-w-[16rem]">
          {period === "custom" ? (
            <DateRangeField
              label="Khoảng ngày xuất"
              hideRequiredMark
              presets={false}
              startDate={customFrom}
              endDate={customTo}
              onChange={(a, b) => {
                setCustomFrom(a);
                setCustomTo(b);
              }}
            />
          ) : (
            <DateField
              label={period === "day" ? "Ngày xuất" : "Ngày bất kỳ trong kỳ"}
              hideRequiredMark
              hint={period === "day" ? undefined : `Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`}
              value={anchor}
              onChange={setAnchor}
            />
          )}
        </div>
        <div className="min-w-[12rem]">
          <Combobox
            label="Khách hàng"
            hideRequiredMark
            clearable={false}
            value={customerFilter}
            onChange={setCustomerFilter}
            options={customerOptions}
          />
        </div>
      </div>

      <StatCardGrid cards={cards} />

      {isLoading ? (
        <TableSkeleton />
      ) : group.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title={`Chưa có đơn nào được xuất trong ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`}
          description="Tạo lệnh xuất ở màn Đơn đặt, số liệu xuất sẽ tổng hợp về đây."
        />
      ) : (
        <HorizontalScroll viewportClassName="rounded-xl border-2 border-border">
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
              {group.map((g) => (
                <Fragment key={g.orderId}>
                  <TableRow>
                    <TableCell colSpan={5} className="bg-muted">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
                        {g.customerName}
                        <span className="font-normal text-muted-foreground">
                          · đặt {g.orderDate ? formatDateVN(g.orderDate) : "—"}
                        </span>
                        <Tag variant={g.status === "collecting" ? "pending" : "done"}>
                          {STATUS_LABELS[g.status]}
                        </Tag>
                        {g.requiredKg > 0 && (
                          <span className="font-normal text-muted-foreground">
                            · đã đặt <span className="tnum">{num(g.requiredKg)}</span> kg
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                  {g.lines.map((l) => (
                    <TableRow key={l.id} {...to.getRowProps(l.id)}>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {to.enabled && (
                            <input
                              type="checkbox"
                              className="size-5 shrink-0"
                              checked={rowSelection.selected.has(l.id)}
                              onChange={() => {}}
                              onClick={(e) => rowSelection.toggle(l.id, e.shiftKey, rowKeys)}
                              aria-label={`Chọn dòng ${l.productName} ${formatDateVN(l.exportDate)}`}
                              title="Tick để tô màu / in đậm dòng này (Shift+tick chọn cả khoảng)."
                            />
                          )}
                          {formatDateVN(l.exportDate)}
                        </span>
                      </TableCell>
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
                    <TableCell className="tnum text-right font-semibold">{num(g.totalKg)}</TableCell>
                    <TableCell className="tnum text-right font-semibold">{num(g.totalBlocks)}</TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">TỔNG CỘNG</TableCell>
                <TableCell className="tnum text-right font-bold">{num(totalKg)}</TableCell>
                <TableCell className="tnum text-right font-bold">{num(totalBlocks)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </HorizontalScroll>
      )}
      <RowMarkToolbar marker={to} selectedKeys={rowKeys.filter((k) => rowSelection.selected.has(k))} onClearSelection={rowSelection.clearSelection} />

      {inPrint && (
        <PrintSheet
          title="Báo cáo đơn đặt được xuất hàng"
          subtitle={`Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}${customerFilter !== "Tất cả" ? ` · Khách ${group[0]?.customerName ?? ""}` : ""}`}
          onClose={() => setInPrint(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <PrintTh>Ngày xuất</PrintTh>
                <PrintTh>Mặt hàng</PrintTh>
                <PrintTh>Quy cách</PrintTh>
                <PrintTh right>Kg xuất</PrintTh>
                <PrintTh right>Block</PrintTh>
              </tr>
            </thead>
            <tbody>
              {group.map((g) => (
                <Fragment key={g.orderId}>
                  <tr>
                    <PrintTd bold colSpan={5}>
                      {g.customerName} · đặt {g.orderDate ? formatDateVN(g.orderDate) : "—"} · {STATUS_LABELS[g.status]}
                      {g.requiredKg > 0 ? ` · đã đặt ${num(g.requiredKg)} kg` : ""}
                    </PrintTd>
                  </tr>
                  {g.lines.map((l, i) => (
                    <tr key={`${g.orderId}-${i}`}>
                      <PrintTd>{formatDateVN(l.exportDate)}</PrintTd>
                      <PrintTd>{l.productName}</PrintTd>
                      <PrintTd>{l.spec || "—"}</PrintTd>
                      <PrintTd right className="tnum">
                        {num(l.quantityKg)}
                      </PrintTd>
                      <PrintTd right className="tnum">
                        {num(l.blocksCount)}
                      </PrintTd>
                    </tr>
                  ))}
                  <tr>
                    <PrintTd bold colSpan={3}>
                      Cộng đơn {g.customerName}
                    </PrintTd>
                    <PrintTd bold right className="tnum">
                      {num(g.totalKg)}
                    </PrintTd>
                    <PrintTd bold right className="tnum">
                      {num(g.totalBlocks)}
                    </PrintTd>
                  </tr>
                </Fragment>
              ))}
              <tr>
                <PrintTd bold colSpan={3}>
                  TỔNG CỘNG
                </PrintTd>
                <PrintTd bold right className="tnum">
                  {num(totalKg)}
                </PrintTd>
                <PrintTd bold right className="tnum">
                  {num(totalBlocks)}
                </PrintTd>
              </tr>
            </tbody>
          </table>
        </PrintSheet>
      )}
    </div>
  );
}
