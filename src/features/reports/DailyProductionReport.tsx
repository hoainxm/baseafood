// ============================================================
// Tên file: src/features/reports/DailyProductionReport.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Thành phẩm sản xuất hàng ngày
// Description: Daily finished-product (WIP) production summary report
// ============================================================
import { Fragment, useMemo, useState } from "react";
import type { Workshop } from "@/types";
import { useProducts, useWipProductions } from "@/lib/catalogRepo";
import {
  HorizontalScroll,
  VerticalBarChart,
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
  type VerticalBarChartItem,
  type StatCardData,
  RowMarkToolbar,
  useRowSelection,
  useRowMarkTools,
  useTableSort,
  type SortColumnSpec,
} from "@/design-system";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { useCan } from "@/features/shared/PermissionProvider";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { buildProductionReportTour } from "./productionReportTour";
import {
  CalendarRange,
  Factory,
  FileSpreadsheet,
  Layers,
  Package,
  Printer,
  Scale,
} from "lucide-react";

const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];
const WORKSHOP_OPTIONS = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  ...WORKSHOPS.map((p) => ({ value: p, label: p })),
];

/** Một dòng lưới: mặt hàng × quy cách của một phân xưởng, phân bổ theo ngày. */
interface PivotRow {
  workshop: Workshop;
  productId: string;
  productName: string;
  spec: string;
  byDate: Record<string, number>;
  totalKg: number;
  totalBlocks: number;
}

interface WorkshopGroup {
  workshop: Workshop;
  rows: PivotRow[];
  byDate: Record<string, number>;
  totalKg: number;
  totalBlocks: number;
}

/**
 * Báo cáo tổng hợp thành phẩm sản xuất hàng ngày — lưới MẶT HÀNG × NGÀY, gom theo
 * phân xưởng, cộng ngang (Tổng kg/block) và cộng dọc (mỗi ngày). Đọc thẳng sổ Sản
 * xuất BTP (mọi trạng thái — đây là sản lượng LÀM RA, không phải tồn kho). Chỉ đọc,
 * xuất được Excel để kế toán đối chiếu.
 */
export default function DailyProductionReport() {
  const [rows, , { status }] = useWipProductions();
  // Phân quyền lớp 2: In A4 / Xuất Excel theo quyền `export`.
  const allowed = useCan("production-report");
  const [products] = useProducts();
  const isLoading = status === "loading" && rows.length === 0;
  /* Hướng dẫn thao tác (ba-spec 43) — chỉ dẫn, không ghi; bước xuất theo quyền. */
  const tour = useMemo(() => buildProductionReportTour({ canExport: allowed.export }), [allowed.export]);
  usePageTour(isLoading ? null : tour);

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [workshop, setWorkshop] = useState("Tất cả");
  const [inPrint, setInPrint] = useState(false);
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);
  // Dòng là dòng GỘP (xưởng × mặt hàng × quy cách) ⇒ ghép kỳ + xưởng vào khoá
  // bảng để "đã dò" kỳ này không lan sang kỳ khác.
  const to = useRowMarkTools(`bao-cao-sx-ngay|${fromDate}|${toDate}|${workshop}`);
  const rowSelection = useRowSelection();

  const { days, groups, dailyGrandTotal: grandTotalByDay, grandTotalKg, grandTotalBlocks, productCount } =
    useMemo(() => {
      const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
      const filteredRows = rows.filter(
        (r) =>
          r.productionDate >= fromDate &&
          r.productionDate <= toDate &&
          (workshop === "Tất cả" || r.workshop === workshop)
      );

      const daySet = new Set<string>();
      const map = new Map<string, PivotRow>();
      for (const r of filteredRows) {
        daySet.add(r.productionDate);
        const key = `${r.workshop}|||${r.productId}|||${r.spec}`;
        let d = map.get(key);
        if (!d) {
          d = {
            workshop: r.workshop,
            productId: r.productId,
            productName: productNameOf(r.productId),
            spec: r.spec,
            byDate: {},
            totalKg: 0,
            totalBlocks: 0,
          };
          map.set(key, d);
        }
        d.byDate[r.productionDate] =
          (d.byDate[r.productionDate] ?? 0) + (r.quantityKg || 0);
        d.totalKg += r.quantityKg || 0;
        d.totalBlocks += r.blocksCount || 0;
      }

      const days = [...daySet].sort();
      const allRows = [...map.values()].sort(
        (a, b) =>
          WORKSHOPS.indexOf(a.workshop) - WORKSHOPS.indexOf(b.workshop) ||
          a.productName.localeCompare(b.productName, "vi") ||
          a.spec.localeCompare(b.spec, "vi")
      );

      const groups: WorkshopGroup[] = [];
      for (const w of WORKSHOPS) {
        const wr = allRows.filter((r) => r.workshop === w);
        if (!wr.length) continue;
        const byDate: Record<string, number> = {};
        let totalKg = 0;
        let totalBlocks = 0;
        for (const r of wr) {
          totalKg += r.totalKg;
          totalBlocks += r.totalBlocks;
          for (const d of days)
            byDate[d] = (byDate[d] ?? 0) + (r.byDate[d] ?? 0);
        }
        groups.push({ workshop: w, rows: wr, byDate, totalKg, totalBlocks });
      }

      const dailyGrandTotal: Record<string, number> = {};
      for (const d of days)
        dailyGrandTotal[d] = groups.reduce((s, g) => s + (g.byDate[d] ?? 0), 0);

      return {
        days,
        groups,
        dailyGrandTotal,
        grandTotalKg: groups.reduce((s, g) => s + g.totalKg, 0),
        grandTotalBlocks: groups.reduce((s, g) => s + g.totalBlocks, 0),
        productCount: allRows.length,
      };
    }, [rows, products, fromDate, toDate, workshop]);
  /** Khoá các dòng mặt hàng đang hiện — thứ tự cho Shift+tick chọn khoảng. */
  const pivotKey = (r: PivotRow) => `${r.workshop}|||${r.productId}|||${r.spec}`;
  // Sắp TRONG từng phân xưởng — dòng tiêu đề + "Cộng xưởng" giữ nguyên (README § Sắp xếp cột).
  const pivotSortColumns = useMemo<SortColumnSpec<PivotRow>[]>(
    () => [
      { key: "productName", sortKind: "text", getValue: (r) => r.productName },
      { key: "spec", sortKind: "text", getValue: (r) => r.spec },
      ...days.map<SortColumnSpec<PivotRow>>((d) => ({ key: `day:${d}`, sortKind: "number", getValue: (r) => r.byDate[d] ?? null })),
      { key: "totalKg", sortKind: "number", getValue: (r) => r.totalKg },
      { key: "totalBlocks", sortKind: "number", getValue: (r) => r.totalBlocks },
    ],
    [days]
  );
  const pivotSort = useTableSort(useMemo(() => groups.flatMap((g) => g.rows), [groups]), pivotKey, pivotSortColumns);
  const rowsOf = (w: Workshop) => pivotSort.rows.filter((r) => r.workshop === w);
  const rowKeys = groups.flatMap((g) => rowsOf(g.workshop).map(pivotKey));

  const chart: VerticalBarChartItem[] = days.map((d) => ({
    label: formatDateVN(d).slice(0, 5),
    value: grandTotalByDay[d] ?? 0,
    subLabel: formatDateVN(d),
  }));

  const cards: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`, icon: CalendarRange, color: "neutral" },
    { label: "Tổng sản lượng", value: `${num(grandTotalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    { label: "Tổng block", value: num(grandTotalBlocks), numeric: true, icon: Layers, color: "neutral" },
    { label: "Số mặt hàng", value: num(productCount), numeric: true, icon: Package, color: "success" },
  ];

  const exportExcel = () => {
    if (!groups.length) {
      notify.warning("Không có số liệu để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo tổng hợp thành phẩm sản xuất hàng ngày"]);
    aoa.push([`Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)} · Phân xưởng: ${workshop}`]);
    aoa.push([]);
    aoa.push(["Phân xưởng", "Mặt hàng", "Quy cách", ...days.map((d) => formatDateVN(d)), "Tổng kg", "Tổng block"]);
    for (const g of groups) {
      for (const r of g.rows)
        aoa.push([g.workshop, r.productName, r.spec, ...days.map((d) => r.byDate[d] ?? 0), r.totalKg, r.totalBlocks]);
      aoa.push([`Cộng xưởng ${g.workshop}`, "", "", ...days.map((d) => g.byDate[d] ?? 0), g.totalKg, g.totalBlocks]);
    }
    aoa.push(["TỔNG CỘNG", "", "", ...days.map((d) => grandTotalByDay[d] ?? 0), grandTotalKg, grandTotalBlocks]);
    exportAoaToXlsx({
      sheetName: "Thành phẩm ngày",
      aoa,
      colWidths: [12, 30, 12, ...days.map(() => 11), 12, 10],
      fileName: `bao-cao-thanh-pham-ngay_${fromDate}_${toDate}.xlsx`,
    });
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  const columnCount = days.length + 4;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Báo cáo thành phẩm hàng ngày
        </h1>
        {allowed.export && (
        <div data-tour="production-report-export" className="flex flex-wrap gap-2">
          <Button
            title="Xem trước bản in A4 báo cáo sản lượng ngày rồi in giấy hoặc lưu PDF." size="lg" variant="outline" onClick={() => setInPrint(true)} disabled={!groups.length}>
            <Printer />
            In A4
          </Button>
          <Button
            title="Tải báo cáo sản lượng đang xem ra file Excel." size="lg" variant="outline" onClick={exportExcel} disabled={!groups.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
        )}
      </div>

      <div data-tour="production-report-filters" className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
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
              label="Khoảng ngày sản xuất"
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
              label={period === "day" ? "Ngày" : "Ngày bất kỳ trong kỳ"}
              hideRequiredMark
              hint={period === "day" ? undefined : `Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`}
              value={anchor}
              onChange={setAnchor}
            />
          )}
        </div>
        <div className="min-w-[10rem]">
          <Combobox
            label="Phân xưởng"
            hideRequiredMark
            clearable={false}
            value={workshop}
            onChange={setWorkshop}
            options={WORKSHOP_OPTIONS}
          />
        </div>
      </div>

      <div data-tour="production-report-stats">
        <StatCardGrid cards={cards} />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Factory}
          title={`Chưa có thành phẩm sản xuất trong ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`}
          description="Ghi sản lượng ở màn Sản xuất BTP, số liệu sẽ tổng hợp về đây."
        />
      ) : (
        <>
          {chart.length > 1 && (
            <section data-tour="production-report-chart" className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground">
                Sản lượng làm ra theo ngày
              </h3>
              <VerticalBarChart data={chart} unit="kg" />
            </section>
          )}

          <div data-tour="production-report-table">
          <HorizontalScroll viewportClassName="rounded-xl border-2 border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead aria-sort={pivotSort.ariaSortOf("productName")}>{pivotSort.header("productName", "Mặt hàng")}</TableHead>
                  <TableHead aria-sort={pivotSort.ariaSortOf("spec")}>{pivotSort.header("spec", "Quy cách")}</TableHead>
                  {days.map((d) => (
                    <TableHead key={d} className="whitespace-nowrap text-right" aria-sort={pivotSort.ariaSortOf(`day:${d}`)}>
                      {pivotSort.header(`day:${d}`, formatDateVN(d).slice(0, 5), "right")}
                    </TableHead>
                  ))}
                  <TableHead className="text-right" aria-sort={pivotSort.ariaSortOf("totalKg")}>{pivotSort.header("totalKg", "Tổng kg", "right")}</TableHead>
                  <TableHead className="text-right" aria-sort={pivotSort.ariaSortOf("totalBlocks")}>{pivotSort.header("totalBlocks", "Block", "right")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <Fragment key={g.workshop}>
                    <TableRow>
                      <TableCell colSpan={columnCount} className="bg-muted font-semibold">
                        Phân xưởng {g.workshop}
                      </TableCell>
                    </TableRow>
                    {rowsOf(g.workshop).map((r) => {
                      const k = pivotKey(r);
                      return (
                      <TableRow key={k} {...to.getRowProps(k)}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {to.enabled && (
                              <input
                                type="checkbox"
                                className="size-5 shrink-0"
                                checked={rowSelection.selected.has(k)}
                                onChange={() => {}}
                                onClick={(e) => rowSelection.toggle(k, e.shiftKey, rowKeys)}
                                aria-label={`Chọn dòng ${r.productName} ${r.spec}`}
                                title="Tick để tô màu / in đậm dòng này (Shift+tick chọn cả khoảng)."
                              />
                            )}
                            {r.productName}
                          </span>
                        </TableCell>
                        <TableCell>{r.spec || "—"}</TableCell>
                        {days.map((d) => (
                          <TableCell key={d} className="tnum text-right">
                            {r.byDate[d] ? num(r.byDate[d]) : ""}
                          </TableCell>
                        ))}
                        <TableCell className="tnum text-right font-semibold">{num(r.totalKg)}</TableCell>
                        <TableCell className="tnum text-right">{num(r.totalBlocks)}</TableCell>
                      </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell className="font-semibold text-muted-foreground">
                        Cộng xưởng {g.workshop}
                      </TableCell>
                      <TableCell />
                      {days.map((d) => (
                        <TableCell key={d} className="tnum text-right font-semibold">
                          {g.byDate[d] ? num(g.byDate[d]) : ""}
                        </TableCell>
                      ))}
                      <TableCell className="tnum text-right font-semibold">{num(g.totalKg)}</TableCell>
                      <TableCell className="tnum text-right font-semibold">{num(g.totalBlocks)}</TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TỔNG CỘNG</TableCell>
                  <TableCell />
                  {days.map((d) => (
                    <TableCell key={d} className="tnum text-right font-bold">
                      {grandTotalByDay[d] ? num(grandTotalByDay[d]) : ""}
                    </TableCell>
                  ))}
                  <TableCell className="tnum text-right font-bold">{num(grandTotalKg)}</TableCell>
                  <TableCell className="tnum text-right font-bold">{num(grandTotalBlocks)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </HorizontalScroll>
          </div>
          <RowMarkToolbar marker={to} selectedKeys={rowKeys.filter((k) => rowSelection.selected.has(k))} onClearSelection={rowSelection.clearSelection} />
        </>
      )}

      {inPrint && (
        <PrintSheet
          title="Báo cáo tổng hợp thành phẩm hàng ngày"
          subtitle={`Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}${workshop !== "Tất cả" ? ` · Phân xưởng ${workshop}` : ""}`}
          onClose={() => setInPrint(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <PrintTh>Mặt hàng</PrintTh>
                <PrintTh>Quy cách</PrintTh>
                {days.map((d) => (
                  <PrintTh key={d} right>
                    {formatDateVN(d).slice(0, 5)}
                  </PrintTh>
                ))}
                <PrintTh right>Tổng kg</PrintTh>
                <PrintTh right>Block</PrintTh>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.workshop}>
                  <tr>
                    <PrintTd bold colSpan={columnCount}>
                      Phân xưởng {g.workshop}
                    </PrintTd>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={`${r.workshop}|||${r.productId}|||${r.spec}`}>
                      <PrintTd>{r.productName}</PrintTd>
                      <PrintTd>{r.spec || "—"}</PrintTd>
                      {days.map((d) => (
                        <PrintTd key={d} right className="tnum">
                          {r.byDate[d] ? num(r.byDate[d]) : ""}
                        </PrintTd>
                      ))}
                      <PrintTd right className="tnum">
                        {num(r.totalKg)}
                      </PrintTd>
                      <PrintTd right className="tnum">
                        {num(r.totalBlocks)}
                      </PrintTd>
                    </tr>
                  ))}
                  <tr>
                    <PrintTd bold>Cộng xưởng {g.workshop}</PrintTd>
                    <PrintTd bold />
                    {days.map((d) => (
                      <PrintTd key={d} bold right className="tnum">
                        {g.byDate[d] ? num(g.byDate[d]) : ""}
                      </PrintTd>
                    ))}
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
                <PrintTd bold>TỔNG CỘNG</PrintTd>
                <PrintTd bold />
                {days.map((d) => (
                  <PrintTd key={d} bold right className="tnum">
                    {grandTotalByDay[d] ? num(grandTotalByDay[d]) : ""}
                  </PrintTd>
                ))}
                <PrintTd bold right className="tnum">
                  {num(grandTotalKg)}
                </PrintTd>
                <PrintTd bold right className="tnum">
                  {num(grandTotalBlocks)}
                </PrintTd>
              </tr>
            </tbody>
          </table>
        </PrintSheet>
      )}
    </div>
  );
}
