// ============================================================
// Tên file: src/features/export-planning/ReportView.tsx
// Tên tiếng Việt: Tab Báo cáo của Xuất khẩu — số theo kỳ tháng · quý · năm
// Description: Read-only report tab (design-spec 42 v5): period + customer filter, 4 stat cards,
//              per-month and per-customer tables, shipments stuck per step, contracts needing
//              attention, Excel export. Numbers from lib/exportReports (ba-spec 41 NV15 · R25).
// ============================================================
import { useMemo, useState } from "react";
import {
  BarChart,
  Button,
  ChoiceGroup,
  Combobox,
  EmptyState,
  HorizontalScroll,
  RecordTable,
  StatCardGrid,
  Tag,
  VerticalBarChart,
  formatNumber,
  type ComboboxOption,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import { deviationText, type ExportData } from "@/lib/exportPlanning";
import {
  ATTENTION_LABELS,
  REPORT_STEP_TITLES,
  attentionDetail,
  buildExportReport,
  onTimeRate,
  periodOfKind,
  shiftReportPeriod,
  type AttentionRow,
  type CustomerRow,
  type MonthRow,
  type ReportFigures,
  type ReportPeriod,
  type ReportPeriodKind,
} from "@/lib/exportReports";
import { formatDateVN, formatMoney } from "@/lib/format";
import type { Customer } from "@/types";
import { AlarmClock, BarChart3, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Container, Eye, FileSpreadsheet, FileSignature, Wallet, Weight } from "lucide-react";

const PERIOD_NOUN: Record<ReportPeriodKind, string> = { month: "tháng", quarter: "quý", year: "năm" };
const ATTENTION_TAG = { overdue: "error", "over-tolerance": "error", "under-tolerance": "warning", unpaid: "warning" } as const;

export function ReportView({
  data,
  customers,
  period,
  today,
  filesAvailable,
  canSeePrice,
  canExport,
  onPeriodChange,
  onOpenContract,
  onExportExcel,
}: {
  data: ExportData;
  customers: readonly Customer[];
  period: ReportPeriod;
  today: string;
  filesAvailable: boolean;
  canSeePrice: boolean;
  canExport: boolean;
  onPeriodChange: (p: ReportPeriod) => void;
  onOpenContract: (contractId: string) => void;
  onExportExcel: (p: ReportPeriod, customerId: string) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const report = useMemo(
    () => buildExportReport(data, period, { customers, customerId, today, evidence: { filesAvailable } }),
    [data, period, customers, customerId, today, filesAvailable],
  );
  const noun = PERIOD_NOUN[period.kind];
  const current = periodOfKind(period.kind, today);
  const t = report.totals;
  const rate = onTimeRate(t);
  const customerOptions: ComboboxOption[] = [
    { value: "", label: "Mọi khách" },
    ...[...new Set(data.contracts.map((c) => c.customerId))].map((id) => ({ value: id, label: customers.find((c) => c.id === id)?.name || "(khách chưa rõ)" })),
  ];
  const money = (n: number) => `${formatMoney(n)} USD`;

  const cards: StatCardData[] = [
    { label: `Chuyến trong ${noun}`, value: t.shipments, numeric: true, icon: Container, color: "brand", subtext: `${formatNumber(t.containers)} cont` },
    { label: "Thực xuất", value: `${formatNumber(t.actualKg)} kg`, icon: Weight, color: "brand", subtext: `kế hoạch ${formatNumber(t.plannedKg)} kg` },
    canSeePrice
      ? { label: "Giá trị thực xuất", value: money(t.actualAmount), icon: Wallet, color: "success", subtext: `tiền về trong ${noun} ${money(t.received)}` }
      : { label: `HĐ ký trong ${noun}`, value: t.contractsSigned, numeric: true, icon: FileSignature, color: "brand", subtext: `${formatNumber(t.contractKg)} kg` },
    {
      label: "Đúng hạn giao",
      value: rate == null ? "—" : `${formatNumber(Math.round(rate))}%`,
      icon: AlarmClock,
      color: t.late ? "danger" : "neutral",
      subtext: t.delivered ? `${t.late} trễ / ${t.delivered} chuyến đã giao` : "chưa chuyến nào giao",
    },
  ];

  /** Cột số dùng chung cho bảng tháng và bảng khách — cột tiền ẩn hẳn khi không quyền giá. */
  const figureColumns = <T extends ReportFigures>(): RecordTableColumn<T>[] => [
    { key: "shipments", header: "Chuyến", numeric: true, render: (r) => formatNumber(r.shipments), getSortValue: (r) => r.shipments },
    { key: "containers", header: "Cont", numeric: true, render: (r) => formatNumber(r.containers), getSortValue: (r) => r.containers, hideOnMobile: true },
    { key: "planned", header: "Kg KH", numeric: true, render: (r) => formatNumber(r.plannedKg), getSortValue: (r) => r.plannedKg, hideOnMobile: true },
    { key: "actual", header: "Kg xuất", numeric: true, render: (r) => formatNumber(r.actualKg), getSortValue: (r) => r.actualKg },
    ...(canSeePrice
      ? ([
          { key: "amount", header: "Giá trị", numeric: true, render: (r) => formatMoney(r.actualAmount), getSortValue: (r) => r.actualAmount },
          { key: "received", header: "Tiền về", numeric: true, render: (r) => formatMoney(r.received), getSortValue: (r) => r.received },
          { key: "outstanding", header: "Còn chưa về", numeric: true, render: (r) => formatMoney(r.outstanding), getSortValue: (r) => r.outstanding },
        ] as RecordTableColumn<T>[])
      : []),
  ];

  const monthColumns: RecordTableColumn<MonthRow>[] = [{ key: "month", header: "Tháng", primary: true, render: (r) => r.label, getSortValue: (r) => r.month }, ...figureColumns<MonthRow>()];
  const customerColumns: RecordTableColumn<CustomerRow>[] = [
    { key: "name", header: "Khách", primary: true, render: (r) => r.name, getSortValue: (r) => r.name },
    { key: "signed", header: "HĐ ký", numeric: true, render: (r) => formatNumber(r.contractsSigned), getSortValue: (r) => r.contractsSigned },
    ...figureColumns<CustomerRow>(),
  ];
  const attentionRows = report.attention.filter((a) => canSeePrice || a.kind !== "unpaid");
  const attentionColumns: RecordTableColumn<AttentionRow>[] = [
    { key: "no", header: "Hợp đồng", primary: true, render: (a) => <span className="font-semibold break-words">{a.contractNo}</span>, getSortValue: (a) => a.contractNo },
    { key: "customer", header: "Khách", render: (a) => a.customerName, getSortValue: (a) => a.customerName },
    { key: "kind", header: "Vấn đề", render: (a) => <Tag variant={ATTENTION_TAG[a.kind]}>{ATTENTION_LABELS[a.kind]}</Tag>, getSortValue: (a) => ATTENTION_LABELS[a.kind] },
    {
      key: "detail",
      header: "Chi tiết",
      render: (a) => <span className="tnum">{attentionDetail(a, { viewPrice: canSeePrice, deviationText, formatNumber, formatMoney, formatDate: formatDateVN })}</span>,
    },
  ];

  const footerOf = (f: ReportFigures, lead: string) => (
    <p className="tnum text-sm">
      <span className="font-semibold">{lead}:</span> {formatNumber(f.shipments)} chuyến · {formatNumber(f.containers)} cont · {formatNumber(f.actualKg)} / {formatNumber(f.plannedKg)} kg
      {canSeePrice ? ` · ${money(f.actualAmount)} · đã về ${money(f.received)} · còn ${money(f.outstanding)}` : ""}
    </p>
  );
  const isEmpty = !t.shipments && !t.contractsSigned && !report.attention.length && !t.received;
  const stuckTotal = ([1, 2, 3, 4, 5] as const).reduce((s, n) => s + report.stuck[n], 0);
  const customerLabel = customerId ? customerOptions.find((o) => o.value === customerId)?.label : "";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <ChoiceGroup
            label="Xem theo"
            hideRequiredMark
            value={period.kind}
            onChange={(v) => onPeriodChange(periodOfKind(v as ReportPeriodKind, today))}
            options={[
              { value: "month", label: "Tháng" },
              { value: "quarter", label: "Quý" },
              { value: "year", label: "Năm" },
            ]}
            columns={3}
            className="w-full min-w-0 sm:w-[21rem] sm:shrink-0"
          />
          <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" onClick={() => onPeriodChange(shiftReportPeriod(period, -1))} title={`Xem ${noun} trước.`} aria-label={`${noun} trước`}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="flex min-w-0 items-center justify-center gap-2 px-2 font-semibold">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {period.label}
            </span>
            <Button variant="ghost" onClick={() => onPeriodChange(shiftReportPeriod(period, 1))} title={`Xem ${noun} sau.`} aria-label={`${noun} sau`}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            {current.key !== period.key && (
              <Button variant="ghost" size="sm" onClick={() => onPeriodChange(current)} title={`Về ${noun} hiện tại.`}>
                <CalendarCheck className="mr-1 h-4 w-4" aria-hidden />
                Nay
              </Button>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48 sm:max-w-sm">
            <Combobox label="Khách hàng" hideRequiredMark value={customerId} onChange={setCustomerId} options={customerOptions} clearable={false} />
          </div>
          {canExport && (
            <Button variant="outline" onClick={() => onExportExcel(period, customerId)} title={`Xuất Excel báo cáo ${period.label}${customerLabel ? ` của ${customerLabel}` : ""}: tổng kỳ, theo tháng, theo khách, hồ sơ kẹt, hợp đồng cần chú ý.`}>
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
              Xuất Excel
            </Button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title={`${period.label} chưa có số xuất khẩu${customerLabel ? ` của ${customerLabel}` : ""}`}
          description="Chưa có chuyến, hợp đồng ký hay tiền về nào trong kỳ này. Đổi kỳ hoặc khách để xem số khác."
        />
      ) : (
        <>
          <StatCardGrid cards={cards} />

          {report.byMonth.length > 1 && (
            <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
              <h3 className="font-semibold">Theo tháng</h3>
              <p className="text-sm text-muted-foreground">Kg xuất = thực xuất theo Commercial Invoice; KH = kế hoạch.{canSeePrice ? " Tiền tính bằng USD; tiền về theo ngày nhận." : ""}</p>
              <HorizontalScroll>
                <VerticalBarChart data={report.byMonth.map((m) => ({ label: `T${Number(m.month.slice(5, 7))}`, value: m.actualKg, subLabel: m.shipments ? `${m.shipments} chuyến` : undefined }))} unit="kg" showAverageLine={false} />
              </HorizontalScroll>
              <RecordTable columns={monthColumns} rows={report.byMonth} getKey={(r) => r.month} rowMarkKey={`export-report-months:${period.key}:${customerId || "all"}`} emptyText="Không có tháng nào." />
              {footerOf(t, `Tổng ${noun}`)}
            </section>
          )}

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Theo khách</h3>
            {canSeePrice && <p className="text-sm text-muted-foreground">Tiền tính bằng USD. Còn chưa về = giá trị thực xuất của chuyến trong kỳ trừ tiền đã về của các chuyến đó.</p>}
            <RecordTable
              columns={customerColumns}
              rows={report.byCustomer}
              getKey={(r) => r.customerId}
              rowMarkKey={`export-report-customers:${period.key}:${customerId || "all"}`}
              emptyText={`Không khách nào có chuyến, HĐ ký hay tiền về trong ${noun}.`}
            />
            {report.byCustomer.length > 1 && footerOf(t, `Tổng ${noun}`)}
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Hồ sơ còn kẹt</h3>
            <p className="text-sm text-muted-foreground">Số chuyến của {noun} còn chưa xong từng bước bắt buộc (một chuyến có thể kẹt ở nhiều bước).</p>
            {stuckTotal ? (
              <BarChart
                data={([1, 2, 3, 4, 5] as const).map((n) => ({ label: REPORT_STEP_TITLES[n], value: report.stuck[n], subLabel: `bước ${n} · trên ${formatNumber(t.shipments)} chuyến` }))}
                unit="chuyến"
                preserveOrder
                showAverageLine={false}
              />
            ) : (
              <p className="text-sm text-success">Không chuyến nào kẹt — mọi chuyến của {noun} đã đủ hồ sơ bước 1–5.</p>
            )}
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Hợp đồng cần chú ý</h3>
            <RecordTable
              columns={attentionColumns}
              rows={attentionRows}
              getKey={(a) => `${a.contractId}:${a.kind}`}
              rowMarkKey={`export-report-attention:${period.key}:${customerId || "all"}`}
              emptyText={`Không hợp đồng nào cần chú ý trong ${noun}.`}
              actions={(a) => (
                <Button size="sm" variant="ghost" onClick={() => onOpenContract(a.contractId)} title={`Mở hồ sơ hợp đồng ${a.contractNo}.`}>
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
