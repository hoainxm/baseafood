// ============================================================
// Tên file: src/features/production-orders/OrderReportView.tsx
// Tên tiếng Việt: Tab Báo cáo của Lệnh sản xuất — lệnh, thùng, kg, NL nhập khẩu đã dành theo kỳ
// Description: Read-only report tab of /planning-production (ba-spec 50 RP2): period + customer filter,
//              4 stat cards, per month / customer / product tables, imported material reserved, orders
//              needing attention, Excel export. Figures from lib/productionOrderReports.
// ============================================================
import { useMemo, useState } from "react";
import {
  Button,
  Combobox,
  EmptyState,
  RecordTable,
  StatCardGrid,
  Tag,
  formatNumber,
  type ComboboxOption,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import { ReportPeriodBar } from "@/features/shared/ReportPeriodBar";
import { PERIOD_NOUN } from "@/features/shared/reportPeriod";
import { formatDateVN } from "@/lib/format";
import type { ReportPeriod } from "@/lib/exportReports";
import {
  ORDER_ATTENTION_LABELS,
  buildOrderReport,
  type OrderAttentionRow,
  type OrderCustomerRow,
  type OrderFigures,
  type OrderMaterialRow,
  type OrderMonthRow,
  type OrderProductRow,
} from "@/lib/productionOrderReports";
import type { ProductionOrder } from "@/types";
import { AlertTriangle, BarChart3, ClipboardList, Eye, FileSpreadsheet, Package, Wheat } from "lucide-react";
import { monthText } from "./orderText";
import type { ProductionOrderData } from "./useProductionOrderData";

export function OrderReportView({
  data,
  orders,
  period,
  today,
  canExport,
  onPeriodChange,
  onOpenOrder,
  onExportExcel,
}: {
  data: ProductionOrderData;
  /** Lệnh người xem thấy (`visibleOrders`). */
  orders: readonly ProductionOrder[];
  period: ReportPeriod;
  today: string;
  canExport: boolean;
  onPeriodChange: (p: ReportPeriod) => void;
  onOpenOrder: (orderId: string) => void;
  onExportExcel: (p: ReportPeriod, customerName: string) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const report = useMemo(
    () =>
      buildOrderReport(
        { orders, lines: data.lines, materials: data.materials, links: data.links, receiptLines: data.receiptLines, exportData: data.exportData },
        period,
        { customerName, today },
      ),
    [orders, data, period, customerName, today],
  );
  const noun = PERIOD_NOUN[period.kind];
  const t = report.totals;
  const customerOptions: ComboboxOption[] = [{ value: "", label: "Mọi khách" }, ...[...new Set(orders.map((o) => o.customerName).filter(Boolean))].sort().map((c) => ({ value: c, label: c }))];

  const cards: StatCardData[] = [
    { label: `Lệnh trong ${noun}`, value: t.orders, numeric: true, icon: ClipboardList, color: "brand", subtext: `đã phát hành ${formatNumber(t.issued)} · nháp ${formatNumber(t.drafts)} · đã hủy ${formatNumber(t.cancelled)}` },
    { label: "Kg ra lệnh", value: `${formatNumber(t.kg)} kg`, icon: Package, color: "brand", subtext: `${formatNumber(t.cartons)} thùng · ${formatNumber(t.revised)} lệnh đã sửa` },
    { label: "NL nhập khẩu đã dành", value: `${formatNumber(t.reservedKg)} kg`, icon: Wheat, color: "neutral", subtext: "dự kiến cho lệnh của kỳ, không trừ kho" },
    { label: "Cần chú ý", value: report.attention.length, numeric: true, icon: AlertTriangle, color: report.attention.length ? "warning" : "success", subtext: "nháp quá ngày SX · theo bản HĐ trước · chưa gắn chuyến" },
  ];

  const figureColumns = <T extends OrderFigures>(): RecordTableColumn<T>[] => [
    { key: "orders", header: "Lệnh", numeric: true, render: (r) => formatNumber(r.orders), getSortValue: (r) => r.orders },
    { key: "cartons", header: "Thùng", numeric: true, render: (r) => formatNumber(r.cartons), getSortValue: (r) => r.cartons },
    { key: "kg", header: "Kg", numeric: true, render: (r) => formatNumber(r.kg), getSortValue: (r) => r.kg },
  ];
  const monthColumns: RecordTableColumn<OrderMonthRow>[] = [{ key: "month", header: "Tháng", primary: true, render: (r) => monthText(r.month), getSortValue: (r) => r.month }, ...figureColumns<OrderMonthRow>()];
  const customerColumns: RecordTableColumn<OrderCustomerRow>[] = [
    { key: "name", header: "Khách", primary: true, render: (r) => r.customerName, getSortValue: (r) => r.customerName },
    { key: "contracts", header: "HĐ", numeric: true, render: (r) => formatNumber(r.contracts), getSortValue: (r) => r.contracts },
    ...figureColumns<OrderCustomerRow>(),
  ];
  const productColumns: RecordTableColumn<OrderProductRow>[] = [{ key: "name", header: "Mặt hàng", primary: true, render: (r) => <span className="break-words">{r.name}</span>, getSortValue: (r) => r.name }, ...figureColumns<OrderProductRow>()];
  const materialColumns: RecordTableColumn<OrderMaterialRow>[] = [
    { key: "label", header: "Lần nhập khẩu", primary: true, render: (r) => <span className="break-words">{r.label}</span>, getSortValue: (r) => r.label },
    { key: "reserved", header: "Dành trong kỳ (kg)", numeric: true, render: (r) => formatNumber(r.reservedKg), getSortValue: (r) => r.reservedKg },
    { key: "all", header: "Tổng đã dành (kg)", numeric: true, render: (r) => formatNumber(r.reservedAllKg), getSortValue: (r) => r.reservedAllKg, hideOnMobile: true },
    { key: "received", header: "Thực nhập (kg)", numeric: true, render: (r) => formatNumber(r.receivedKg), getSortValue: (r) => r.receivedKg },
    {
      key: "over",
      header: "Vượt",
      numeric: true,
      sortKind: "number",
      render: (r) => (r.overKg ? <Tag variant="warning">vượt {formatNumber(r.overKg)} kg</Tag> : "—"),
      getSortValue: (r) => r.overKg,
    },
  ];
  const attentionColumns: RecordTableColumn<OrderAttentionRow>[] = [
    { key: "no", header: "Lệnh", primary: true, render: (a) => <span className="font-semibold">{a.orderNo}</span>, getSortValue: (a) => a.orderNo },
    { key: "customer", header: "Khách", render: (a) => a.customerName, getSortValue: (a) => a.customerName },
    { key: "date", header: "Ngày SX đầu", sortKind: "date", render: (a) => <span className="tnum">{formatDateVN(a.firstProductionDate) || "—"}</span>, getSortValue: (a) => a.firstProductionDate },
    { key: "kind", header: "Vấn đề", render: (a) => <Tag variant={a.kind === "draft-overdue" ? "error" : "warning"}>{ORDER_ATTENTION_LABELS[a.kind]}</Tag>, getSortValue: (a) => ORDER_ATTENTION_LABELS[a.kind] },
  ];

  const isEmpty = !t.orders && !t.cancelled;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <ReportPeriodBar period={period} today={today} onChange={onPeriodChange}>
        <div className="min-w-0 flex-1 basis-48 sm:max-w-sm">
          <Combobox label="Khách hàng" hideRequiredMark value={customerName} onChange={setCustomerName} options={customerOptions} clearable={false} />
        </div>
        {canExport && (
          <Button variant="outline" onClick={() => onExportExcel(period, customerName)} title={`Xuất Excel báo cáo lệnh sản xuất ${period.label}${customerName ? ` của ${customerName}` : ""}: tổng kỳ, theo tháng, khách, mặt hàng, NL đã dành, lệnh cần chú ý.`}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
            Xuất Excel
          </Button>
        )}
      </ReportPeriodBar>

      {isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title={`${period.label} chưa có lệnh sản xuất${customerName ? ` của ${customerName}` : ""}`}
          description="Lệnh xếp vào kỳ theo ngày sản xuất đầu tiên. Đổi kỳ hoặc khách để xem số khác."
        />
      ) : (
        <>
          <div data-tour="order-report-stats">
            <StatCardGrid cards={cards} />
          </div>

          {report.byMonth.length > 1 && (
            <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
              <h3 className="font-semibold">Theo tháng</h3>
              <RecordTable columns={monthColumns} rows={report.byMonth} getKey={(r) => r.month} rowMarkKey={`order-report-months:${period.key}:${customerName || "all"}`} emptyText="Không có tháng nào." />
            </section>
          )}

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Theo khách</h3>
            <RecordTable columns={customerColumns} rows={report.byCustomer} getKey={(r) => r.customerName} rowMarkKey={`order-report-customers:${period.key}:${customerName || "all"}`} emptyText={`Không có lệnh nào trong ${noun}.`} />
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Theo mặt hàng</h3>
            <RecordTable columns={productColumns} rows={report.byProduct} getKey={(r) => r.key} rowMarkKey={`order-report-products:${period.key}:${customerName || "all"}`} emptyText={`Không có lệnh nào trong ${noun}.`} />
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">NL nhập khẩu đã dành</h3>
            <p className="text-sm text-muted-foreground">Kg NL dự kiến các lệnh của {noun} lấy từ từng lần nhập khẩu. Vượt = tổng đã dành (mọi lệnh chưa hủy) lớn hơn thực nhập.</p>
            <RecordTable columns={materialColumns} rows={report.materials} getKey={(r) => r.key} rowMarkKey={`order-report-materials:${period.key}:${customerName || "all"}`} emptyText={`Lệnh của ${noun} chưa gắn NL nhập khẩu nào.`} />
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Lệnh cần chú ý</h3>
            <RecordTable
              columns={attentionColumns}
              rows={report.attention}
              getKey={(a) => `${a.orderId}:${a.kind}`}
              rowMarkKey={`order-report-attention:${period.key}:${customerName || "all"}`}
              emptyText={`Không lệnh nào cần chú ý trong ${noun}.`}
              actions={(a) => (
                <Button size="sm" variant="ghost" onClick={() => onOpenOrder(a.orderId)} title={`Mở hồ sơ lệnh ${a.orderNo}.`}>
                  <Eye className="mr-1 h-4 w-4" aria-hidden />
                  Mở
                </Button>
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}
