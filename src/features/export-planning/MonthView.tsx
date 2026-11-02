// ============================================================
// Tên file: src/features/export-planning/MonthView.tsx
// Tên tiếng Việt: Lịch xuất hàng — chuyến xếp theo NGÀY xuất, 6 bước, HĐ chưa ghi chuyến
// Description: Period plan (NV11): view by month / week / date range, customer filter (cards follow it),
//              document-number search (shipments + contracts without shipments), 4 stat cards,
//              shipments listed by export day (ba-spec 57: n customers · m shipments per day, open a day
//              to see its shipments grouped by customer), undated shipments, pending contracts, Excel export.
// ============================================================
import { useMemo, useState } from "react";
import { buildDaySchedule, defaultOpenDay, type ScheduleCustomer } from "@/lib/exportDaySchedule";
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
  shipmentLateInfo,
  shipmentMonth,
  shiftPeriod,
  weekPeriod,
  contractCoverage,
  contractStateLabel,
  isLiveContractState,
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

/** Khóa "ngày" của khối chuyến chưa có ngày đóng cont / ETD. */
const UNDATED = "undated";
const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
/** "Thứ 3, 03/11/2026" — tiêu đề một ngày của lịch. */
const dayHeading = (iso: string) => `${WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${formatDateVN(iso)}`;

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
  // ba-spec 57 v2 (phương án A): hai cột — danh sách ngày | chi tiết MỘT ngày đang chọn. Ngày chọn sẵn = ngày có
  // chuyến đầu tiên ≥ hôm nay, kỳ đã qua ⇒ ngày đầu của kỳ (R9). Đổi kỳ / lọc khách ⇒ chọn lại từ đầu.
  // Điện thoại: chỉ hiện một cột — danh sách, chạm ngày ⇒ chi tiết có Quay lại.
  const schedule = useMemo(() => buildDaySchedule(groups), [groups]);
  const scheduleKey = `${period.from}_${period.to}_${customerFilter}`;
  const [pick, setPick] = useState<{ key: string; day: string; phoneDetail: boolean } | null>(null);
  const defaultDay = defaultOpenDay(schedule.days, today) ?? schedule.days[0]?.date ?? (schedule.undated.length ? UNDATED : "");
  const picked = pick?.key === scheduleKey && (pick.day === UNDATED ? schedule.undated.length > 0 : schedule.days.some((d) => d.date === pick.day)) ? pick : null;
  const selectedDay = picked?.day ?? defaultDay;
  const phoneDetail = picked?.phoneDetail ?? false;
  const selectDay = (day: string) => setPick({ key: scheduleKey, day, phoneDetail: true });
  const backToDays = () => setPick({ key: scheduleKey, day: selectedDay, phoneDetail: false });
  const selected = schedule.days.find((d) => d.date === selectedDay);
  const selectedCustomers = selectedDay === UNDATED ? schedule.undated : (selected?.customers ?? []);
  /** Dòng đầu tiên của ngày đang chọn — mốc tour "Tiến độ" + "Mở". */
  const firstVisibleRow = selectedCustomers[0]?.rows[0];
  const markKey = period.kind === "month" ? period.from.slice(0, 7) : `${period.from}_${period.to}`;
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
      subtext: plan.stats.overdueContractsWithoutShipment ? `+ ${plan.stats.overdueContractsWithoutShipment} HĐ quá hạn chưa ghi chuyến` : "theo ngày on board / ETD",
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
      header: "Kg kế hoạch · thực xuất",
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
          <div data-tour={r === firstVisibleRow ? "shipment-progress" : undefined} className="grid min-w-0 gap-1.5 lg:min-w-56">
            <StepBar steps={p.steps} />
            <span className={`text-sm ${p.next === null ? "font-semibold text-success" : "text-foreground"}`}>{progressText(p)}</span>
            {(r.late || (!r.shipment.bookingNo && !r.shipment.containerNo)) && (
              <div className="flex flex-wrap gap-1">
                {r.late && (() => {
                  const li = shipmentLateInfo(data, r.shipment);
                  return (
                    <Tag variant="error" title={`Hạn giao ${formatDateVN(li.deadline)} · ngày giao (on board / ETD) ${formatDateVN(li.deliveredOn)}`}>
                      Trễ hạn giao {li.days} ngày
                    </Tag>
                  );
                })()}
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
          {!p.hasShipments ? <Tag variant="warning">Chưa ghi chuyến</Tag> : (
            <Tag variant="warning">
              {[p.coverage.missingKg > 0 && `${formatNumber(p.coverage.missingKg)} kg`, p.coverage.missingContainers > 0 && `${p.coverage.missingContainers} cont`].filter(Boolean).join(" / ")} chưa ghi chuyến
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
            {!contractCoverage(data, c.id).covered && <Tag variant="warning">Chưa ghi chuyến</Tag>}
            {isLiveContractState(st) && st !== "final-review" && dl && dl < today && <Tag variant="error">Quá hạn giao</Tag>}
          </div>
        );
      },
    },
  ];

  /** Một mục ngày ở cột trái: ngày đang chọn tô viền + nền nhấn; chọn ⇒ chi tiết bên phải (điện thoại: sang trang chi tiết). */
  const dayButton = (day: string, heading: string, counts: string, lateCount: number, missingCount: number, sub: string) => {
    const active = day === selectedDay;
    return (
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => selectDay(day)}
        title="Xem các chuyến của ngày này, gom theo khách."
        className={`grid w-full min-w-0 gap-0.5 rounded-lg border-2 px-3 py-2 text-left press-feedback ${
          active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-muted"
        }`}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tnum font-semibold">{heading}</span>
          {lateCount > 0 && <Tag variant="error">{lateCount} trễ</Tag>}
          {missingCount > 0 && <Tag variant="warning">{missingCount} còn thiếu</Tag>}
        </span>
        <span className="tnum text-sm">{counts}</span>
        <span className="truncate text-sm text-muted-foreground">{sub}</span>
      </button>
    );
  };

  /** Chuyến của một ngày (hoặc chưa có ngày) — mỗi khách một bảng nhỏ, đủ cột tiến độ như trước (R6). */
  const customerTables = (list: readonly ScheduleCustomer[], markPrefix: string) =>
    list.map((c) => (
      <div key={c.customerId} className="grid min-w-0 gap-2">
        <h4 className="font-semibold">
          {c.customerName} <span className="tnum font-normal text-muted-foreground">· {c.rows.length} chuyến</span>
        </h4>
        <RecordTable
          columns={columns(false)}
          rows={c.rows}
          getKey={(r) => r.shipment.id}
          rowMarkKey={`export-plan:${markPrefix}:${c.customerId}`}
          actions={(r) => openButton(r.contract.id, r.shipment.id, r === firstVisibleRow)}
        />
      </div>
    ));

  /** `tourMark`: nút Mở đầu tiên của lịch — chỗ "Mở hồ sơ" của hướng dẫn từng bước. */
  const openButton = (contractId: string, shipmentId?: string, tourMark = false) => (
    <Button
      size="sm"
      variant="outline"
      data-tour={tourMark ? "open-dossier" : undefined}
      onClick={() => onOpenContract(contractId, shipmentId)}
      title="Mở hồ sơ hợp đồng và các bước của chuyến này."
    >
      <Eye className="mr-1 h-4 w-4" aria-hidden />
      Mở
    </Button>
  );

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid min-w-0 gap-3">
        <div data-tour="period-filter" className="flex min-w-0 flex-wrap items-end gap-3">
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
        <div data-tour="customer-search" className="flex min-w-0 flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <Combobox label="Khách hàng" hideRequiredMark value={customerFilter} onChange={setCustomerFilter} options={customerOptions} clearable={false} />
          </div>
          <div className="min-w-0 flex-1 basis-56">
            <Field label="Tra lô · booking · cont · số chứng từ · số HĐ · số PO">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                title="Gõ mã lô (MSL), số booking, số container, số invoice, số B/L, số hợp đồng hoặc số PO của khách — tra mọi kỳ."
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
          <div data-tour="plan-stats">
            <StatCardGrid cards={cards} />
          </div>
          {!groups.length && !pending.length && (
            <EmptyState
              icon={Container}
              title={`${period.label} chưa có chuyến nào${customerFilter ? " của khách này" : ""}`}
              description="Lập hợp đồng → duyệt → đính kèm hồ sơ rồi Ghi chuyến — chuyến xếp theo ngày đóng cont (chưa có thì ETD, rồi tháng kế hoạch)."
            />
          )}
          {(schedule.days.length > 0 || schedule.undated.length > 0) && (
            <section data-tour="shipment-table" className="grid min-w-0 gap-4 md:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)] md:items-start">
              {/* Cột trái: các ngày có chuyến — chọn một ngày (không thu / mở). Điện thoại ẩn khi đang xem chi tiết. */}
              <nav aria-label="Ngày xuất trong kỳ" className={`grid min-w-0 gap-2 ${phoneDetail ? "max-md:hidden" : ""}`}>
                <h3 className="font-semibold">Ngày xuất</h3>
                <ol className="grid min-w-0 gap-2">
                  {schedule.days.map((day) => (
                    <li key={day.date}>
                      {dayButton(day.date, dayHeading(day.date), `${day.customerCount} khách · ${day.shipmentCount} chuyến`, day.lateCount, day.missingCount, day.customers.map((c) => c.customerName).join(" · "))}
                    </li>
                  ))}
                  {schedule.undated.length > 0 && (
                    <li>{dayButton(UNDATED, "Chưa có ngày", `${schedule.undated.length} khách · ${schedule.undated.reduce((n, c) => n + c.rows.length, 0)} chuyến`, 0, 0, "mới có tháng kế hoạch")}</li>
                  )}
                </ol>
              </nav>
              {/* Cột phải: chi tiết ngày đang chọn, gom theo khách. */}
              <div className={`grid min-w-0 gap-4 rounded-xl border border-border p-4 ${phoneDetail ? "" : "max-md:hidden"}`}>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <Button variant="ghost" size="sm" className="md:hidden" onClick={backToDays} title="Quay lại danh sách ngày.">
                    <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                    Quay lại
                  </Button>
                  <h3 className="tnum font-semibold">{selectedDay === UNDATED ? "Chuyến chưa có ngày" : dayHeading(selectedDay)}</h3>
                  {selected && (
                    <span className="tnum text-muted-foreground">
                      {selected.customerCount} khách · {selected.shipmentCount} chuyến · KH {formatNumber(selected.plannedKg)} kg
                    </span>
                  )}
                </div>
                {selectedDay === UNDATED && (
                  <p className="text-sm text-muted-foreground">Chuyến mới có tháng kế hoạch, chưa có ngày đóng cont hay ETD. Ghi ngày ở hồ sơ thì chuyến tự vào đúng ngày.</p>
                )}
                {customerTables(selectedCustomers, `${markKey}:${selectedDay}`)}
              </div>
            </section>
          )}
          {pending.length > 0 && (
            <section data-tour="pending-contracts" className="grid gap-3">
              <h3 className="font-semibold">Hợp đồng chưa ghi đủ chuyến</h3>
              <RecordTable
                columns={pendingColumns}
                rows={pending}
                getKey={(p) => p.contract.id}
                rowMarkKey={`export-plan-pending:${period.kind === "month" ? period.from.slice(0, 7) : `${period.from}_${period.to}`}`}
                actions={(p) => openButton(p.contract.id, undefined, !firstVisibleRow && p === pending[0])}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
