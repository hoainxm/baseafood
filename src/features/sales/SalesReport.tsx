// ============================================================
// Tên file cũ: src/features/sales/SalesReport.tsx
// Tên tiếng Việt: Báo cáo doanh số và sản lượng Bán hàng
// Description: Sales Volume & Revenue Report
// ============================================================
import { useMemo, useState } from "react";
import {
  SummaryTable,
  BarChart,
  Combobox,
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
import { calculateSalesAmount, type SalesChannel } from "@/types";
import { CalendarRange, Scale, Users } from "lucide-react";

interface TotalRow {
  customerName: string;
  channel: SalesChannel;
  quantityKg: number;
  amount: number;
}

/** Đơn vị tiền theo kênh: Xuất khẩu bằng USD, Nội địa bằng VND. */
function unitOf(channel: SalesChannel): string {
  return channel === "Xuất khẩu" ? "$" : "đ";
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

  const { rows: row, chart, customerCount, totalKg } = useMemo(() => {
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const tenKH = new Map(customers.map((c) => [c.id, c.name]));

    const map = new Map<string, TotalRow>();
    const theoKH = new Map<string, number>();
    for (const it of items) {
      if (it.deliveryDate < fromDate || it.deliveryDate > toDate) continue;
      const inv = invById.get(it.invoiceId);
      if (!inv) continue;
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
  }, [items, invoices, customers, fromDate, toDate]);

  const cards: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`, icon: CalendarRange, color: "neutral" },
    { label: "Tổng bán", value: `${num(totalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    { label: "Số khách", value: num(customerCount), numeric: true, icon: Users, color: "neutral" },
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
      <div className="flex flex-wrap items-end gap-4">
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
      </div>

      <StatCardGrid cards={cards} />

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Sản lượng bán theo khách
          </h3>
          <BarChart data={chart} unit="kg" />
        </section>
      )}

      <SummaryTable
        rows={row}
        columns={columns}
        getKey={(r) => `${r.customerName}|||${r.channel}`}
        rowMarkKey={`bao-cao-ban|${fromDate}|${toDate}`}
        emptyText="Không có phiếu bán trong kỳ này."
      />
    </div>
  );
}
