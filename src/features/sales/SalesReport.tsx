// ============================================================
// Tên file cũ: src/features/sales/SalesReport.tsx
// Tên tiếng Việt: Báo cáo doanh số và sản lượng Bán hàng
// Description: Sales Volume & Revenue Report
// ============================================================
import { useMemo, useState } from "react";
import {
  SummaryTable,
  BarChart,
  ChoiceGroup,
  Combobox,
  FilterBar,
  DateField,
  DateRangeField,
  StatCardGrid,
  todayIso,
  type BarChartItem,
  type SummaryTableColumn,
  type StatCardData,
} from "@/design-system";
import { useSalesItems, useSalesInvoices, useCustomers } from "@/lib/catalogRepo";
import { useCan } from "@/features/shared/PermissionProvider";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import { SALES_CHANNELS, calculateSalesAmount, type SalesChannel } from "@/types";
import { ALL, activeFilterCount, matchesValue } from "@/lib/recordFilters";
import { SALES_CHANNEL_UNITS, sumSalesAmountByChannel } from "@/lib/salesTotals";
import { CalendarRange, Coins, Scale, Users } from "lucide-react";

interface TotalRow {
  customerName: string;
  channel: SalesChannel;
  quantityKg: number;
  amount: number;
}

/** Đơn vị tiền theo kênh: Xuất khẩu bằng USD, Nội địa bằng VND. */
function unitOf(channel: SalesChannel): string {
  return SALES_CHANNEL_UNITS[channel];
}

/**
 * Báo cáo Bán hàng — tổng bán theo kỳ, gom theo KHÁCH × KÊNH (Xuất khẩu / Nội
 * địa). Giá trị để theo từng kênh vì hai kênh khác đơn vị tiền (USD ≠ VND) —
 * KHÔNG cộng thẳng. Chỉ đọc sổ bán.
 */
export default function SalesReport() {
  const [items] = useSalesItems();
  const [invoices] = useSalesInvoices();
  const [customers] = useCustomers();
  const canViewPrice = useCan("sales")["view-price"];

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);
  // Bộ lọc (ba-spec 53 đợt 3): khách · kênh — số, biểu đồ, bảng theo phần đang lọc.
  const [customerFilter, setCustomerFilter] = useState(ALL);
  const [channelFilter, setChannelFilter] = useState(ALL);
  const filterCount = activeFilterCount([customerFilter, channelFilter]);
  const passes = (inv: { customerId: string; channel: string }) => matchesValue(customerFilter, inv.customerId) && matchesValue(channelFilter, inv.channel);
  const customerChoices = useMemo(() => {
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const ids = new Set(items.filter((it) => it.deliveryDate >= fromDate && it.deliveryDate <= toDate).map((it) => invById.get(it.invoiceId)?.customerId ?? ""));
    return [{ value: ALL, label: "Tất cả khách" }, ...[...ids].filter(Boolean).map((id) => ({ value: id, label: customers.find((c) => c.id === id)?.name || id })).sort((a, b) => a.label.localeCompare(b.label, "vi"))];
  }, [items, invoices, customers, fromDate, toDate]);

  const { rows: row, chart, customerCount, totalKg } = useMemo(() => {
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const tenKH = new Map(customers.map((c) => [c.id, c.name]));

    const map = new Map<string, TotalRow>();
    const theoKH = new Map<string, number>();
    for (const it of items) {
      if (it.deliveryDate < fromDate || it.deliveryDate > toDate) continue;
      const inv = invById.get(it.invoiceId);
      if (!inv || !passes(inv)) continue;
      const kh = tenKH.get(inv.customerId) || "(chưa có khách)";
      const k = `${inv.customerId}|||${inv.channel}`;
      let d = map.get(k);
      if (!d) {
        d = { customerName: kh, channel: inv.channel, quantityKg: 0, amount: 0 };
        map.set(k, d);
      }
      d.quantityKg += it.quantityKg || 0;
      d.amount += calculateSalesAmount(it);
      theoKH.set(inv.customerId, (theoKH.get(inv.customerId) ?? 0) + (it.quantityKg || 0));
    }
    const rows = [...map.values()].sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, "vi") ||
        a.channel.localeCompare(b.channel, "vi")
    );
    const chart: BarChartItem[] = [...theoKH.entries()].map(([id, value]) => ({
      label: tenKH.get(id) || "(chưa có khách)",
      value,
    }));
    return {
      rows,
      chart,
      customerCount: theoKH.size,
      totalKg: rows.reduce((s, d) => s + d.quantityKg, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passes đọc 2 ô lọc ở deps
  }, [items, invoices, customers, fromDate, toDate, customerFilter, channelFilter]);

  // Giá trị theo kênh — USD và VND không cộng chung (33 §4); chỉ kênh có dòng trong kỳ.
  const valueCards = useMemo(() => {
    if (!canViewPrice) return [];
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const inPeriod = items.filter((it) => {
      const inv = invById.get(it.invoiceId);
      return it.deliveryDate >= fromDate && it.deliveryDate <= toDate && !!inv && passes(inv);
    });
    return sumSalesAmountByChannel(inPeriod, invoices)
      .byChannel.filter((c) => c.lineCount > 0)
      .map((c): StatCardData => ({ label: `Giá trị ${c.channel}`, value: `${num(c.amount)} ${c.unit}`, numeric: true, icon: Coins, color: "success" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passes đọc 2 ô lọc ở deps
  }, [canViewPrice, items, invoices, fromDate, toDate, customerFilter, channelFilter]);

  const cards: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`, icon: CalendarRange, color: "neutral" },
    { label: filterCount ? "Tổng bán · theo bộ lọc" : "Tổng bán", value: `${num(totalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    { label: filterCount ? "Số khách · theo bộ lọc" : "Số khách", value: num(customerCount), numeric: true, icon: Users, color: "neutral" },
    ...valueCards,
  ];

  const columns: SummaryTableColumn<TotalRow>[] = [
    { key: "kh", header: "Khách hàng", render: (r) => r.customerName },
    { key: "kenh", header: "Kênh", render: (r) => r.channel },
    {
      key: "kg",
      header: "Số cân (kg)",
      numeric: true,
      render: (r) => num(r.quantityKg),
      total: () => num(totalKg),
    },
    // Không có quyền xem giá ⇒ ẩn hẳn cột giá trị (spec role-permissions §5 lớp 2).
    ...(canViewPrice
      ? [
          {
            key: "tien",
            header: "Giá trị",
            numeric: true,
            render: (r: TotalRow) => `${num(r.amount)} ${unitOf(r.channel)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <FilterBar
        data-tour="sales-report-filters"
        activeCount={filterCount}
        onClearAll={() => {
          setCustomerFilter(ALL);
          setChannelFilter(ALL);
        }}
      >
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
              label="Khoảng ngày"
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
        <div className="min-w-[14rem] flex-1">
          <Combobox label="Khách hàng" hideRequiredMark clearable={false} value={customerFilter} onChange={(v) => setCustomerFilter(v || ALL)} options={customerChoices} />
        </div>
        <ChoiceGroup
          label="Kênh bán"
          hideRequiredMark
          value={channelFilter}
          onChange={setChannelFilter}
          options={[{ value: ALL, label: "Tất cả" }, ...SALES_CHANNELS.map((k) => ({ value: k, label: k }))]}
          columns={3}
        />
      </FilterBar>

      <div data-tour="sales-report-stats">
        <StatCardGrid cards={cards} />
      </div>

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Sản lượng bán theo khách
          </h3>
          <BarChart data={chart} unit="kg" />
        </section>
      )}

      <div data-tour="sales-report-table">
      <SummaryTable
        rows={row}
        columns={columns}
        getKey={(r) => `${r.customerName}|||${r.channel}`}
        rowMarkKey={`sales-report|${fromDate}|${toDate}${filterCount ? `|${customerFilter}|${channelFilter}` : ""}`}
        emptyText={filterCount ? "Không có dòng nào khớp bộ lọc." : "Không có phiếu bán trong kỳ này."}
      />
      </div>
    </div>
  );
}
