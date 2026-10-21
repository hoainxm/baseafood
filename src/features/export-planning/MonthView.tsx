// ============================================================
// Tên file: src/features/export-planning/MonthView.tsx
// Tên tiếng Việt: Xuất khẩu theo tháng — chuyến gom theo khách, 6 bước, HĐ chưa lên chuyến
// Description: Period plan (NV11): view by month / week / date range, customer filter (cards follow it),
//              document-number search (shipments + contracts without shipments), 4 stat cards,
//              shipments grouped by customer, pending contracts, Excel export.
// ============================================================
import { useMemo, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  DateRangeField,
  EmptyState,
  Field,
  Input,
  RecordTable,
  StatCardGrid,
  Tag,
  formatNumber,
  type ComboboxOption,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import {
  buildPeriodPlan,
  monthLabel,
  monthPeriod,
  rangePeriod,
  searchContracts,
  searchShipments,
  shipmentKindLabel,
  shipmentMonth,
  shiftPeriod,
  weekPeriod,
  contractCoverage,
  contractStateLabel,
  contractState,
  openShipmentsOf,
  type Period,
  STEP_NOS,
  stepState,
  isShipmentClosed,
  isShipmentLate,
  shipmentActuals,
  effectiveDeadline,
  type ExportData,
  type MonthShipmentRow,
  type PendingContractRow,
  type StepNo,
} from "@/lib/exportPlanning";
import { progressText, shipmentProgress } from "./progress";
import { formatDateVN } from "@/lib/format";
import type { Customer, ExportContract, ExportItemState } from "@/types";
import { AlarmClock, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Container, Eye, FileSpreadsheet, ListChecks } from "lucide-react";
import { StepBar } from "./parts";

/** Kỳ hiện tại cùng loại với kỳ đang xem (tháng này / tuần này / hôm nay). */
function currentPeriodOf(kind: Period["kind"], today: string): Period {
  return kind === "month" ? monthPeriod(today.slice(0, 7)) : kind === "week" ? weekPeriod(today) : rangePeriod(today, today);
}

export function MonthView({
  data,
  customers,
  period,
  today,
  filesAvailable,
  canExport,
  onPeriodChange,
  onOpenContract,
  onExportExcel,
}: {
  data: ExportData;
  customers: readonly Customer[];
  period: Period;
  today: string;
  filesAvailable: boolean;
  canExport: boolean;
  onPeriodChange: (p: Period) => void;
  onOpenContract: (contractId: string, shipmentId?: string) => void;
  onExportExcel: (p: Period, customerId: string) => void;
}) {
  const opts = { filesAvailable };
  const [customerFilter, setCustomerFilter] = useState("");
  const [query, setQuery] = useState("");
  // Lọc khách tính TRONG lib ⇒ 4 thẻ số cũng theo khách (XK-15).
  const plan = useMemo(() => buildPeriodPlan(period, data, customers, today, opts, customerFilter), [period, data, customers, today, filesAvailable, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = plan.groups;
  const pending = plan.pendingContracts;
  const current = currentPeriodOf(period.kind, today);
  const isCurrent = current.from === period.from && current.to === period.to;
  const periodNoun = period.kind === "month" ? "tháng" : period.kind === "week" ? "tuần" : "khoảng";
  const customerOptions: ComboboxOption[] = [
    { value: "", label: "Mọi khách" },
    ...[...new Set(data.contracts.map((c) => c.customerId))].map((id) => ({ value: id, label: customers.find((c) => c.id === id)?.name || "(khách chưa rõ)" })),
  ];

  const plannedKg = groups.reduce((sum, g) => sum + g.plannedKg, 0);
  // Thẻ nào cũng có dòng phụ ⇒ 4 thẻ cùng một khuôn (nhãn · số · dòng phụ), không thẻ cao thẻ thấp.
  const cards: StatCardData[] = [
    { label: `Chuyến trong ${periodNoun}`, value: plan.stats.shipments, numeric: true, icon: Container, color: "brand", subtext: `kế hoạch ${formatNumber(plannedKg)} kg` },
    { label: "Chuyến đủ hồ sơ", value: plan.stats.closed, numeric: true, icon: CircleCheck, color: "success", subtext: "xong bước 1–5" },
    {
      label: "Chuyến còn thiếu",
      value: plan.stats.missingSteps,
      numeric: true,
      icon: ListChecks,
      color: plan.stats.missingSteps ? "warning" : "neutral",
      subtext: "chưa xong bước 1–5",
    },
    {
      label: "Trễ hạn giao",
      value: plan.stats.lateShipments,
      numeric: true,
      icon: AlarmClock,
      color: plan.stats.lateShipments || plan.stats.overdueContractsWithoutShipment ? "danger" : "neutral",
      subtext: plan.stats.overdueContractsWithoutShipment ? `+ ${plan.stats.overdueContractsWithoutShipment} HĐ quá hạn chưa lên chuyến` : "theo ngày on board / ETD",
    },
  ];

  const searchRows: MonthShipmentRow[] = useMemo(() => {
    if (!query.trim()) return [];
    const byId = new Map(data.contracts.map((c) => [c.id, c]));
    return searchShipments(data, query, customers).flatMap((s) => {
      const c = byId.get(s.contractId);
      if (!c) return [];
      return [
        {
          shipment: s,
          contract: c,
          steps: Object.fromEntries(STEP_NOS.map((n) => [n, stepState(data, s, n, opts)])) as Record<StepNo, ExportItemState>,
          closed: isShipmentClosed(data, s, opts),
          late: isShipmentLate(data, s),
          actuals: shipmentActuals(data, s.id),
          deadline: effectiveDeadline(data, c.id),
        },
      ];
    });
  }, [query, data, customers, filesAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  /** HĐ khớp tra cứu mà chưa có chuyến nào đang mở (chuyến thì đã nằm ở bảng chuyến) — XK-08. */
  const contractHits: ExportContract[] = useMemo(
    () => (query.trim() ? searchContracts(data, query, customers).filter((c) => !openShipmentsOf(data, c.id).length) : []),
    [query, data, customers],
  );

  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";

  const columns = (withCustomer: boolean): RecordTableColumn<MonthShipmentRow>[] => [
    ...(withCustomer
      ? [{ key: "customer", header: "Khách", primary: true, render: (r: MonthShipmentRow) => nameOf(r.contract.customerId), getSortValue: (r: MonthShipmentRow) => nameOf(r.contract.customerId) }]
      : []),
    {
      key: "shipment",
      header: "Chuyến",
      primary: !withCustomer,
      width: withCustomer ? undefined : "30%",
      render: (r) => (
        <span className="grid gap-0.5">
          <span className="font-semibold">{[r.shipment.lotCode && `Lô ${r.shipment.lotCode}`, shipmentKindLabel(r.shipment.kind)].filter(Boolean).join(" · ")}</span>
          <span className="text-sm text-muted-foreground">
            HĐ {r.contract.contractNo}
            {r.shipment.goodsSummary ? ` · ${r.shipment.goodsSummary}` : ""}
          </span>
        </span>
      ),
      getSortValue: (r) => r.shipment.lotCode,
    },
    {
      key: "dates",
      header: "Đóng · ETD",
      width: withCustomer ? undefined : "16%",
      render: (r) => (
        <span className="tnum">
          {[r.shipment.loadingDate && formatDateVN(r.shipment.loadingDate), r.shipment.etd && `ETD ${formatDateVN(r.shipment.etd)}`].filter(Boolean).join(" · ") ||
            (withCustomer ? monthLabel(shipmentMonth(r.shipment)) : "Chưa có ngày")}
        </span>
      ),
      getSortValue: (r) => r.shipment.loadingDate || r.shipment.etd || "9999",
    },
    {
      key: "kg",
      header: "Kg KH · thực xuất",
      numeric: true,
      width: withCustomer ? undefined : "17%",
      render: (r) => `${formatNumber(r.shipment.plannedKg)}${r.actuals.kg ? ` · ${formatNumber(r.actuals.kg)}` : ""}`,
      getSortValue: (r) => r.shipment.plannedKg ?? 0,
    },
    {
      key: "progress",
      header: "Tiến độ",
      // Mỗi khách một bảng: cố định % bề rộng để cột các bảng thẳng hàng nhau.
      width: withCustomer ? undefined : "29%",
      render: (r) => {
        const p = shipmentProgress(data, r.shipment, opts);
        return (
          <div className="grid min-w-0 gap-1.5 lg:min-w-56">
            <StepBar steps={p.steps} />
            <span className={`text-sm ${p.next === null ? "font-semibold text-success" : "text-foreground"}`}>{progressText(p)}</span>
            {(r.late || (!r.shipment.bookingNo && !r.shipment.containerNo)) && (
              <div className="flex flex-wrap gap-1">
                {r.late && <Tag variant="error">Trễ hạn {formatDateVN(r.deadline)}</Tag>}
                {!r.shipment.bookingNo && !r.shipment.containerNo && <Tag variant="muted">Chờ booking</Tag>}
              </div>
            )}
          </div>
        );
      },
      getSortValue: (r) => shipmentProgress(data, r.shipment, opts).settledCount,
    },
  ];

  const pendingColumns: RecordTableColumn<PendingContractRow>[] = [
    { key: "customer", header: "Khách", primary: true, render: (p) => p.customerName, getSortValue: (p) => p.customerName },
    { key: "contract", header: "Hợp đồng", render: (p) => p.contract.contractNo },
    { key: "deadline", header: "Hạn giao", render: (p) => <span className="tnum">{formatDateVN(p.deadline)}</span>, getSortValue: (p) => p.deadline },
    {
      key: "state",
      header: "Còn thiếu",
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {!p.hasShipments ? <Tag variant="warning">Chưa lên chuyến</Tag> : (
            <Tag variant="warning">
              {[p.coverage.missingKg > 0 && `${formatNumber(p.coverage.missingKg)} kg`, p.coverage.missingContainers > 0 && `${p.coverage.missingContainers} cont`].filter(Boolean).join(" / ")} chưa lên chuyến
            </Tag>
          )}
          {p.overdue && <Tag variant="error">Quá hạn</Tag>}
        </div>
      ),
    },
  ];

  const contractHitColumns: RecordTableColumn<ExportContract>[] = [
    { key: "customer", header: "Khách", primary: true, render: (c) => nameOf(c.customerId) },
    { key: "no", header: "Hợp đồng", render: (c) => c.contractNo },
    { key: "deadline", header: "Hạn giao", render: (c) => <span className="tnum">{formatDateVN(effectiveDeadline(data, c.id)) }</span> },
    {
      key: "state",
      header: "Trạng thái",
      render: (c) => {
        const st = contractState(data, c.id, opts);
        const dl = effectiveDeadline(data, c.id);
        return (
          <div className="flex flex-wrap gap-1">
            <Tag variant="muted">{contractStateLabel(st, c)}</Tag>
            {!contractCoverage(data, c.id).covered && <Tag variant="warning">Chưa lên chuyến</Tag>}
            {(st === "pending" || st === "approved") && dl && dl < today && <Tag variant="error">Quá hạn giao</Tag>}
          </div>
        );
      },
    },
  ];

  const openButton = (contractId: string, shipmentId?: string) => (
    <Button size="sm" variant="outline" onClick={() => onOpenContract(contractId, shipmentId)} title="Mở hồ sơ hợp đồng và các bước của chuyến này.">
      <Eye className="mr-1 h-4 w-4" aria-hidden />
      Mở
    </Button>
  );

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <ChoiceGroup
            label="Xem theo"
            hideRequiredMark
            value={period.kind}
            onChange={(v) => onPeriodChange(currentPeriodOf(v as Period["kind"], today))}
            options={[
              { value: "month", label: "Tháng" },
              { value: "week", label: "Tuần" },
              { value: "range", label: "Ngày" },
            ]}
            columns={3}
            className="w-full min-w-0 sm:w-[21rem] sm:shrink-0"
          />
          {period.kind === "range" ? (
            <DateRangeField
              label="Khoảng ngày xuất (ngày đóng cont, chưa có thì ETD)"
              hideRequiredMark
              presets={false}
              startDate={period.from}
              endDate={period.to}
              onChange={(a, b) => a && b && onPeriodChange(rangePeriod(a, b))}
              className="min-w-0 flex-1 basis-72"
            />
          ) : (
            <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
              <Button variant="ghost" onClick={() => onPeriodChange(shiftPeriod(period, -1))} title={`Xem ${periodNoun} trước.`} aria-label={`${periodNoun} trước`}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <span className="flex min-w-0 items-center justify-center gap-2 px-2 font-semibold">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {period.label}
              </span>
              <Button variant="ghost" onClick={() => onPeriodChange(shiftPeriod(period, 1))} title={`Xem ${periodNoun} sau.`} aria-label={`${periodNoun} sau`}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              {!isCurrent && (
                <Button variant="ghost" size="sm" onClick={() => onPeriodChange(current)} title={`Về ${periodNoun} hiện tại.`}>
                  <CalendarCheck className="mr-1 h-4 w-4" aria-hidden />
                  Nay
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <Combobox label="Khách hàng" hideRequiredMark value={customerFilter} onChange={setCustomerFilter} options={customerOptions} clearable={false} />
          </div>
          <div className="min-w-0 flex-1 basis-56">
            <Field label="Tra lô · booking · cont · số giấy tờ · số HĐ">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                title="Gõ mã lô (MSL), số booking, số container, số invoice, số B/L, số hợp đồng hoặc số đơn của khách — tra mọi kỳ."
              />
            </Field>
          </div>
          {canExport && (
            <Button variant="outline" onClick={() => onExportExcel(period, customerFilter)} title={`Xuất Excel ${period.label} theo bố cục sổ Kế hoạch xuất hàng.`}>
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
              Xuất Excel
            </Button>
          )}
        </div>
      </div>

      {query.trim() ? (
        <section className="grid gap-3">
          <h3 className="font-semibold">Kết quả tra "{query.trim()}" ({searchRows.length})</h3>
          <RecordTable
            columns={columns(true)}
            rows={searchRows}
            getKey={(r) => r.shipment.id}
            emptyText={contractHits.length ? "Không có chuyến nào khớp — xem hợp đồng bên dưới." : "Không thấy chuyến hay hợp đồng nào khớp."}
            actions={(r) => openButton(r.contract.id, r.shipment.id)}
          />
          {contractHits.length > 0 && (
            <>
              <h3 className="font-semibold">Hợp đồng khớp chưa có chuyến ({contractHits.length})</h3>
              <RecordTable
                columns={contractHitColumns}
                rows={contractHits}
                getKey={(c) => c.id}
                actions={(c) => openButton(c.id)}
              />
            </>
          )}
        </section>
      ) : (
        <>
          <StatCardGrid cards={cards} />
          {!groups.length && !pending.length && (
            <EmptyState
              icon={Container}
              title={`${period.label} chưa có chuyến nào${customerFilter ? " của khách này" : ""}`}
              description="Lập hợp đồng rồi Lên chuyến — chuyến xếp theo ngày đóng cont (chưa có thì ETD, rồi tháng kế hoạch)."
            />
          )}
          {groups.map((g) => (
            <section key={g.customerId} className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{g.customerName}</h3>
                <span className="tnum text-sm text-muted-foreground">
                  {g.rows.length} chuyến · {g.rows.filter((r) => r.closed).length} đủ hồ sơ · KH {formatNumber(g.plannedKg)} kg
                  {g.actualKg ? ` · thực xuất ${formatNumber(g.actualKg)} kg` : ""}
                </span>
              </div>
              <RecordTable
                columns={columns(false)}
                rows={g.rows}
                getKey={(r) => r.shipment.id}
                rowMarkKey={`export-plan:${period.kind === "month" ? period.from.slice(0, 7) : `${period.from}_${period.to}`}:${g.customerId}`}
                actions={(r) => openButton(r.contract.id, r.shipment.id)}
              />
            </section>
          ))}
          {pending.length > 0 && (
            <section className="grid gap-3">
              <h3 className="font-semibold">Hợp đồng chưa lên đủ chuyến</h3>
              <RecordTable
                columns={pendingColumns}
                rows={pending}
                getKey={(p) => p.contract.id}
                rowMarkKey={`export-plan-pending:${period.kind === "month" ? period.from.slice(0, 7) : `${period.from}_${period.to}`}`}
                actions={(p) => openButton(p.contract.id)}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
