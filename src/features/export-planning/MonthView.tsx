// ============================================================
// Tên file: src/features/export-planning/MonthView.tsx
// Tên tiếng Việt: Xuất khẩu theo tháng — chuyến gom theo khách, 6 bước, HĐ chưa lên chuyến
// Description: Month plan (NV11): month navigation, customer filter, document-number search,
//              4 stat cards, shipments grouped by customer, pending contracts, Excel export.
// ============================================================
import { useMemo, useState } from "react";
import {
  Button,
  Combobox,
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
  buildMonthPlan,
  monthLabel,
  searchShipments,
  shipmentKindLabel,
  shipmentMonth,
  shiftMonth,
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
import { formatDateVN } from "@/lib/format";
import type { Customer, ExportItemState } from "@/types";
import { AlarmClock, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Container, Eye, FileSpreadsheet, ListChecks } from "lucide-react";
import { StepDots } from "./parts";

export function MonthView({
  data,
  customers,
  month,
  today,
  filesAvailable,
  canExport,
  onMonthChange,
  onOpenContract,
  onExportExcel,
}: {
  data: ExportData;
  customers: readonly Customer[];
  month: string;
  today: string;
  filesAvailable: boolean;
  canExport: boolean;
  onMonthChange: (m: string) => void;
  onOpenContract: (contractId: string, shipmentId?: string) => void;
  onExportExcel: (month: string) => void;
}) {
  const opts = { filesAvailable };
  const [customerFilter, setCustomerFilter] = useState("");
  const [query, setQuery] = useState("");
  const plan = useMemo(() => buildMonthPlan(month, data, customers, today, opts), [month, data, customers, today, filesAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = plan.groups.filter((g) => !customerFilter || g.customerId === customerFilter);
  const pending = plan.pendingContracts.filter((p) => !customerFilter || p.contract.customerId === customerFilter);
  const customerOptions: ComboboxOption[] = [
    { value: "", label: "Mọi khách" },
    ...[...new Set(data.contracts.map((c) => c.customerId))].map((id) => ({ value: id, label: customers.find((c) => c.id === id)?.name || "(khách chưa rõ)" })),
  ];

  const cards: StatCardData[] = [
    { label: "Chuyến trong tháng", value: plan.stats.shipments, numeric: true, icon: Container, color: "brand" },
    { label: "Đã khép kín", value: plan.stats.closed, numeric: true, icon: CircleCheck, color: "success" },
    { label: "Còn thiếu bước", value: plan.stats.missingSteps, numeric: true, icon: ListChecks, color: plan.stats.missingSteps ? "warning" : "neutral" },
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

  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";

  const columns = (withCustomer: boolean): RecordTableColumn<MonthShipmentRow>[] => [
    ...(withCustomer
      ? [{ key: "customer", header: "Khách", primary: true, render: (r: MonthShipmentRow) => nameOf(r.contract.customerId), getSortValue: (r: MonthShipmentRow) => nameOf(r.contract.customerId) }]
      : []),
    {
      key: "shipment",
      header: "Chuyến",
      primary: !withCustomer,
      render: (r) => (
        <span className="grid gap-0.5">
          <span className="font-semibold">{[r.shipment.lotCode && `Lô ${r.shipment.lotCode}`, shipmentKindLabel(r.shipment.kind)].filter(Boolean).join(" · ")}</span>
          <span className="text-sm text-muted-foreground">{r.shipment.goodsSummary || r.shipment.containerNo}</span>
        </span>
      ),
      getSortValue: (r) => r.shipment.lotCode,
    },
    { key: "contract", header: "Hợp đồng", render: (r) => r.contract.contractNo, getSortValue: (r) => r.contract.contractNo },
    {
      key: "dates",
      header: "Đóng · ETD",
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
      render: (r) => `${formatNumber(r.shipment.plannedKg)}${r.actuals.kg ? ` · ${formatNumber(r.actuals.kg)}` : ""}`,
      getSortValue: (r) => r.shipment.plannedKg ?? 0,
    },
    { key: "steps", header: "6 bước", render: (r) => <StepDots steps={r.steps} /> },
    {
      key: "state",
      header: "Tình trạng",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.closed ? <Tag variant="done">Khép kín</Tag> : <Tag variant="pending">Đang làm</Tag>}
          {r.late && <Tag variant="error">Trễ hạn {formatDateVN(r.deadline)}</Tag>}
          {!r.shipment.bookingNo && <Tag variant="muted">Chờ booking</Tag>}
        </div>
      ),
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

  const openButton = (contractId: string, shipmentId?: string) => (
    <Button size="sm" variant="outline" onClick={() => onOpenContract(contractId, shipmentId)} title="Mở hồ sơ hợp đồng và các bước của chuyến này.">
      <Eye className="mr-1 h-4 w-4" aria-hidden />
      Mở
    </Button>
  );

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => onMonthChange(shiftMonth(month, -1))} title="Xem tháng trước." aria-label="Tháng trước">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="flex items-center justify-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
            {monthLabel(month)}
          </span>
          <Button variant="outline" onClick={() => onMonthChange(shiftMonth(month, 1))} title="Xem tháng sau." aria-label="Tháng sau">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          {month !== today.slice(0, 7) && (
            <Button variant="ghost" onClick={() => onMonthChange(today.slice(0, 7))} title="Về tháng hiện tại.">
              Tháng này
            </Button>
          )}
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <Combobox label="Khách hàng" hideRequiredMark value={customerFilter} onChange={setCustomerFilter} options={customerOptions} clearable={false} />
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <Field label="Tra số giấy tờ" hint="Mã lô, booking, số cont, số invoice, số B/L, số HĐ">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
          </Field>
        </div>
        {canExport && (
          <Button variant="outline" onClick={() => onExportExcel(month)} title="Xuất Excel tháng này theo bố cục sổ Kế hoạch xuất hàng.">
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
            Xuất Excel
          </Button>
        )}
      </div>

      {query.trim() ? (
        <section className="grid gap-3">
          <h3 className="font-semibold">Kết quả tra "{query.trim()}" ({searchRows.length})</h3>
          <RecordTable
            columns={columns(true)}
            rows={searchRows}
            getKey={(r) => r.shipment.id}
            emptyText="Không thấy chuyến nào khớp."
            actions={(r) => openButton(r.contract.id, r.shipment.id)}
          />
        </section>
      ) : (
        <>
          <StatCardGrid cards={cards} />
          {!groups.length && !pending.length && (
            <EmptyState icon={Container} title={`${monthLabel(month)} chưa có chuyến nào`} description="Lập hợp đồng rồi Lên chuyến — chuyến hiện ở tháng của ngày đóng cont (chưa có thì ETD, rồi tháng kế hoạch)." />
          )}
          {groups.map((g) => (
            <section key={g.customerId} className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{g.customerName}</h3>
                <span className="tnum text-sm text-muted-foreground">
                  {g.rows.length} chuyến · KH {formatNumber(g.plannedKg)} kg{g.actualKg ? ` · thực xuất ${formatNumber(g.actualKg)} kg` : ""}
                </span>
              </div>
              <RecordTable
                columns={columns(false)}
                rows={g.rows}
                getKey={(r) => r.shipment.id}
                rowMarkKey={`export-plan:${month}:${g.customerId}`}
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
                rowMarkKey={`export-plan-pending:${month}`}
                actions={(p) => openButton(p.contract.id)}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
