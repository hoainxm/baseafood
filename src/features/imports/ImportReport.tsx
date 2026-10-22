// ============================================================
// Tên file cũ: src/features/imports/ImportReport.tsx
// Tên tiếng Việt: Báo cáo tổng hợp Nhập Nguyên liệu
// Description: Material Import Summary Report
// ============================================================
import { useMemo, useState } from "react";
import {
  SummaryTable,
  BarChart,
  Button,
  Combobox,
  DateField,
  DateRangeField,
  StatCardGrid,
  todayIso,
  notify,
  type BarChartItem,
  type SummaryTableColumn,
  type StatCardData,
} from "@/design-system";
import { useMaterialImports, useScraps } from "@/lib/catalogRepo";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { num, formatDateVN } from "@/lib/format";
import { calculateImportAmount } from "@/types";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { CalendarRange, Coins, FileClock, FileSpreadsheet, Scale } from "lucide-react";

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
/** Thứ trong tuần từ ngày ISO (yyyy-mm-dd) — tính theo UTC để không lệch múi giờ. */
function dayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

const WORKSHOP_OPTIONS = [
  { value: "Tất cả", label: "Tất cả xưởng" },
  { value: "Đông", label: "Đông" },
  { value: "Cá", label: "Cá" },
  { value: "Khô", label: "Khô" },
];

/** Dòng nguyên liệu MUA — gom theo đại lý × loại. */
interface PurchaseRow {
  supplierName: string;
  materialTypeName: string;
  quantityKg: number;
  unpricedKg: number; // kg chưa có đơn giá (chờ hóa đơn)
  amount: number; // giá trị theo đơn giá mua
}
/** Dòng phế liệu cân gộp trong kỳ — TÁCH RIÊNG, không cộng vào giá trị nhập mua. */
interface ScrapRow {
  name: string;
  quantityKg: number;
  saleValue: number; // theo giá bán phế liệu
}

/**
 * Báo cáo Nhập hàng — tổng nhập MUA theo kỳ, gom theo ĐẠI LÝ × LOẠI NGUYÊN LIỆU.
 * Phế liệu cân trong kỳ để RIÊNG (giá bán ≠ giá mua, không trộn vào "Giá trị nhập").
 * Chỉ đọc sổ nhập; xuất được Excel để kế toán đối chiếu.
 */
export default function ImportReport({
  canExport = true,
  showPrice = true,
}: {
  /** Quyền `imports.export` — không có thì ẩn nút Xuất Excel. */
  canExport?: boolean;
  /** Quyền `imports.view-price` — không có thì ẩn mọi cột / thẻ / tiền trong file xuất. */
  showPrice?: boolean;
} = {}) {
  const [rows] = useMaterialImports();
  const [scraps] = useScraps();

  const [period, setPeriod] = useState<ViewPeriod>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [workshop, setWorkshop] = useState("Tất cả");
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);

  const {
    purchaseRows,
    scrapRows,
    chart,
    totalKg,
    totalAmount,
    totalUnpricedKg: totalAwaitingPriceKg,
    totalScrapKg,
    totalScrapAmount,
  } = useMemo(() => {
    const filteredImports = rows.filter(
      (r) =>
        r.deliveryDate >= fromDate &&
        r.deliveryDate <= toDate &&
        (workshop === "Tất cả" || r.workshop === workshop)
    );
    const filteredScraps = scraps.filter(
      (r) =>
        r.source === "Nhập hàng" &&
        r.date >= fromDate &&
        r.date <= toDate &&
        (workshop === "Tất cả" || r.workshop === workshop)
    );

    // Gom nguyên liệu MUA
    const purchases = new Map<string, PurchaseRow>();
    for (const r of filteredImports) {
      const sup = r.supplierName || "(chưa có đại lý)";
      const mt = r.materialTypeName || "(chưa rõ loại)";
      const k = `${sup}|||${mt}`;
      let d = purchases.get(k);
      if (!d) {
        d = { supplierName: sup, materialTypeName: mt, quantityKg: 0, unpricedKg: 0, amount: 0 };
        purchases.set(k, d);
      }
      d.quantityKg += r.quantityKg || 0;
      if (r.unitPrice == null) d.unpricedKg += r.quantityKg || 0;
      d.amount += calculateImportAmount(r);
    }
    const purchaseRows = [...purchases.values()].sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName, "vi") ||
        a.materialTypeName.localeCompare(b.materialTypeName, "vi")
    );

    // Gom phế liệu RIÊNG
    const scrapByKey = new Map<string, ScrapRow>();
    for (const r of filteredScraps) {
      const nm = r.name || "(chưa rõ loại phế liệu)";
      let d = scrapByKey.get(nm);
      if (!d) {
        d = { name: nm, quantityKg: 0, saleValue: 0 };
        scrapByKey.set(nm, d);
      }
      d.quantityKg += r.quantityKg || 0;
      d.saleValue += (r.quantityKg || 0) * (r.sellingPrice ?? 0);
    }
    const scrapRows = [...scrapByKey.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));

    // Biểu đồ: nguyên liệu MUA theo ngày (không trộn phế liệu) + tóm tắt hover
    interface DayDetail {
      totalKg: number;
      totalAmount: number;
      shipmentIds: Set<string>;
      kgByMaterialType: Map<string, number>;
    }
    const ct = new Map<string, DayDetail>();
    for (const r of filteredImports) {
      let d = ct.get(r.deliveryDate);
      if (!d) {
        d = { totalKg: 0, totalAmount: 0, shipmentIds: new Set(), kgByMaterialType: new Map() };
        ct.set(r.deliveryDate, d);
      }
      d.totalKg += r.quantityKg || 0;
      d.totalAmount += calculateImportAmount(r);
      if (r.shipmentId) d.shipmentIds.add(r.shipmentId);
      const groupKey = `${r.supplierName || "(chưa có đại lý)"} · ${r.materialTypeName || "(chưa rõ loại)"}`;
      d.kgByMaterialType.set(groupKey, (d.kgByMaterialType.get(groupKey) ?? 0) + (r.quantityKg || 0));
    }
    const chart: BarChartItem[] = [...ct.keys()].sort().map((date) => {
      const d = ct.get(date)!;
      const typeEntries = [...d.kgByMaterialType.entries()].sort((a, b) => b[1] - a[1]);
      return {
        label: formatDateVN(date),
        value: d.totalKg,
        detail: (
          <div className="space-y-2">
            <div className="border-b border-border pb-1.5">
              <div className="font-semibold text-foreground">
                {formatDateVN(date)}
                {dayOfWeek(date) ? ` · ${dayOfWeek(date)}` : ""}
              </div>
              <div className="text-muted-foreground">
                {d.shipmentIds.size} chuyến ·{" "}
                <span className="tnum font-semibold text-foreground">{num(d.totalKg)} kg</span>
                {showPrice && d.totalAmount > 0 ? ` · ${num(d.totalAmount)} đ` : ""}
              </div>
            </div>
            <ul className="space-y-1">
              {typeEntries.slice(0, 16).map(([name, kg]) => (
                <li key={name} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 break-words text-muted-foreground">{name}</span>
                  <span className="tnum shrink-0 font-medium text-foreground">{num(kg)} kg</span>
                </li>
              ))}
              {typeEntries.length > 16 && (
                <li className="text-muted-foreground">… +{typeEntries.length - 16} loại khác</li>
              )}
            </ul>
          </div>
        ),
      };
    });

    return {
      purchaseRows,
      scrapRows,
      chart,
      totalKg: purchaseRows.reduce((s, d) => s + d.quantityKg, 0),
      totalAmount: purchaseRows.reduce((s, d) => s + d.amount, 0),
      totalUnpricedKg: purchaseRows.reduce((s, d) => s + d.unpricedKg, 0),
      totalScrapKg: scrapRows.reduce((s, d) => s + d.quantityKg, 0),
      totalScrapAmount: scrapRows.reduce((s, d) => s + d.saleValue, 0),
    };
  }, [rows, scraps, fromDate, toDate, workshop, showPrice]);

  const cards: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`, icon: CalendarRange, color: "neutral" },
    { label: "Nhập mua", value: `${num(totalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    ...(showPrice
      ? [{ label: "Giá trị mua", value: `${num(totalAmount)} đ`, numeric: true, icon: Coins, color: "success" } as StatCardData]
      : []),
    {
      label: "Chờ hóa đơn",
      value: `${num(totalAwaitingPriceKg)} kg`,
      numeric: true,
      icon: FileClock,
      color: totalAwaitingPriceKg > 0 ? "warning" : "neutral",
    },
  ];

  const purchaseColumns: SummaryTableColumn<PurchaseRow>[] = [
    { key: "dl", header: "Đại lý", render: (r) => r.supplierName },
    { key: "loai", header: "Loại nguyên liệu", render: (r) => r.materialTypeName },
    { key: "kg", header: "Số cân (kg)", numeric: true, render: (r) => num(r.quantityKg), total: () => num(totalKg) },
    {
      key: "chogia",
      header: "Chờ giá (kg)",
      numeric: true,
      render: (r) => (r.unpricedKg ? num(r.unpricedKg) : ""),
      total: () => (totalAwaitingPriceKg ? num(totalAwaitingPriceKg) : ""),
    },
    ...(showPrice
      ? [{ key: "tien", header: "Giá trị (đ)", numeric: true, render: (r) => num(r.amount), total: () => num(totalAmount) } as SummaryTableColumn<PurchaseRow>]
      : []),
  ];

  const scrapColumns: SummaryTableColumn<ScrapRow>[] = [
    { key: "loai", header: "Loại phế liệu", render: (r) => r.name },
    { key: "kg", header: "Số cân (kg)", numeric: true, render: (r) => num(r.quantityKg), total: () => num(totalScrapKg) },
    ...(showPrice
      ? [{ key: "tien", header: "Giá trị bán (đ)", numeric: true, render: (r) => num(r.saleValue), total: () => num(totalScrapAmount) } as SummaryTableColumn<ScrapRow>]
      : []),
  ];

  const exportExcel = () => {
    if (!purchaseRows.length && !scrapRows.length) {
      notify.warning("Không có số liệu để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo tổng hợp nhập hàng"]);
    aoa.push([`Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)} · Phân xưởng: ${workshop}`]);
    aoa.push([]);
    aoa.push(["NGUYÊN LIỆU MUA"]);
    // Không có quyền xem giá ⇒ file xuất cũng bỏ cột tiền (cột cuối mỗi bảng).
    const withPrice = (cells: OExcel[], price: OExcel): OExcel[] => (showPrice ? [...cells, price] : cells);
    aoa.push(withPrice(["Đại lý", "Loại nguyên liệu", "Số cân (kg)", "Chờ giá (kg)"], "Giá trị (đ)"));
    for (const r of purchaseRows)
      aoa.push(withPrice([r.supplierName, r.materialTypeName, r.quantityKg, r.unpricedKg], r.amount));
    aoa.push(withPrice(["Tổng cộng", "", totalKg, totalAwaitingPriceKg], totalAmount));
    if (scrapRows.length) {
      aoa.push([]);
      aoa.push([showPrice ? "PHẾ LIỆU (giá bán, không tính vào giá trị nhập mua)" : "PHẾ LIỆU"]);
      aoa.push(withPrice(["Loại phế liệu", "Số cân (kg)"], "Giá trị bán (đ)"));
      for (const r of scrapRows) aoa.push(withPrice([r.name, r.quantityKg], r.saleValue));
      aoa.push(withPrice(["Tổng cộng", totalScrapKg], totalScrapAmount));
    }
    exportAoaToXlsx({
      sheetName: "Nhập hàng",
      aoa,
      colWidths: [26, 26, 14, 14, 16],
      fileName: `bao-cao-nhap-hang_${fromDate}_${toDate}.xlsx`,
    });
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  return (
    <div className="space-y-6">
      <div data-tour="imports-report-filters" className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-end gap-4">
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
        {canExport && (
          <Button
            title="Tải báo cáo nhập hàng đang xem (hàng mua + phế liệu) ra file Excel."
            size="lg"
            variant="outline"
            onClick={exportExcel}
            disabled={!purchaseRows.length && !scrapRows.length}
          >
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        )}
      </div>

      <div data-tour="imports-report-summary">
        <StatCardGrid cards={cards} />
      </div>

      {chart.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              Nguyên liệu mua theo ngày
            </h3>
            <span className="text-sm text-muted-foreground">
              {chart.length} ngày có nhập · tổng {num(totalKg)} kg
            </span>
          </div>
          <BarChart data={chart} unit="kg" preserveOrder maxItems={62} />
        </section>
      )}

      <SummaryTable
        rows={purchaseRows}
        columns={purchaseColumns}
        getKey={(r) => `${r.supplierName}|||${r.materialTypeName}`}
        rowMarkKey={`bao-cao-nhap|${fromDate}|${toDate}|${workshop}`}
        emptyText="Không có nguyên liệu mua trong kỳ này."
      />

      {scrapRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-lg font-semibold text-foreground">Phế liệu cân trong kỳ</h3>
            {showPrice && (
              <span className="text-sm text-muted-foreground">
                (giá bán, tách riêng — không cộng vào giá trị nhập mua)
              </span>
            )}
          </div>
          <SummaryTable
            rows={scrapRows}
            columns={scrapColumns}
            getKey={(r) => r.name}
            rowMarkKey={`bao-cao-nhap-phe-lieu|${fromDate}|${toDate}|${workshop}`}
            emptyText="Không có phế liệu trong kỳ này."
          />
        </section>
      )}
    </div>
  );
}
