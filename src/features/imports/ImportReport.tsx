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
import { KY_OPT, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
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
interface DongMua {
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
export default function ImportReport() {
  const [rows] = useMaterialImports();
  const [scraps] = useScraps();

  const [ky, setKy] = useState<ViewPeriod>("thang");
  const [moc, setMoc] = useState(todayIso());
  const [tuTC, setTuTC] = useState(todayIso());
  const [denTC, setDenTC] = useState(todayIso());
  const [workshop, setWorkshop] = useState("Tất cả");
  const [tu, den] = getViewPeriodRange(ky, moc, tuTC, denTC);

  const {
    dongMua,
    dongPhe: scrapRows,
    chart,
    tongKg: totalKg,
    tongTien: totalAmount,
    tongChoGia: totalAwaitingPriceKg,
    tongKgPhe: totalScrapKg,
    tongTienPhe: totalScrapAmount,
  } = useMemo(() => {
    const filteredImports = rows.filter(
      (r) =>
        r.deliveryDate >= tu &&
        r.deliveryDate <= den &&
        (workshop === "Tất cả" || r.workshop === workshop)
    );
    const filteredScraps = scraps.filter(
      (r) =>
        r.source === "Nhập hàng" &&
        r.date >= tu &&
        r.date <= den &&
        (workshop === "Tất cả" || r.workshop === workshop)
    );

    // Gom nguyên liệu MUA
    const mua = new Map<string, DongMua>();
    for (const r of filteredImports) {
      const sup = r.supplierName || "(chưa có đại lý)";
      const mt = r.materialTypeName || "(chưa rõ loại)";
      const k = `${sup}|||${mt}`;
      let d = mua.get(k);
      if (!d) {
        d = { supplierName: sup, materialTypeName: mt, quantityKg: 0, unpricedKg: 0, amount: 0 };
        mua.set(k, d);
      }
      d.quantityKg += r.quantityKg || 0;
      if (r.unitPrice == null) d.unpricedKg += r.quantityKg || 0;
      d.amount += calculateImportAmount(r);
    }
    const dongMua = [...mua.values()].sort(
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
      const nhomKey = `${r.supplierName || "(chưa có đại lý)"} · ${r.materialTypeName || "(chưa rõ loại)"}`;
      d.kgByMaterialType.set(nhomKey, (d.kgByMaterialType.get(nhomKey) ?? 0) + (r.quantityKg || 0));
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
                {d.totalAmount > 0 ? ` · ${num(d.totalAmount)} đ` : ""}
              </div>
            </div>
            <ul className="space-y-1">
              {typeEntries.slice(0, 16).map(([ten, kg]) => (
                <li key={ten} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 break-words text-muted-foreground">{ten}</span>
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
      dongMua,
      dongPhe: scrapRows,
      chart,
      tongKg: dongMua.reduce((s, d) => s + d.quantityKg, 0),
      tongTien: dongMua.reduce((s, d) => s + d.amount, 0),
      tongChoGia: dongMua.reduce((s, d) => s + d.unpricedKg, 0),
      tongKgPhe: scrapRows.reduce((s, d) => s + d.quantityKg, 0),
      tongTienPhe: scrapRows.reduce((s, d) => s + d.saleValue, 0),
    };
  }, [rows, scraps, tu, den, workshop]);

  const the: StatCardData[] = [
    { label: "Kỳ báo cáo", value: `${formatDateVN(tu)} – ${formatDateVN(den)}`, icon: CalendarRange, color: "trung-tinh" },
    { label: "Nhập mua", value: `${num(totalKg)} kg`, numeric: true, icon: Scale, color: "brand" },
    { label: "Giá trị mua", value: `${num(totalAmount)} đ`, numeric: true, icon: Coins, color: "success" },
    {
      label: "Chờ hóa đơn",
      value: `${num(totalAwaitingPriceKg)} kg`,
      numeric: true,
      icon: FileClock,
      color: totalAwaitingPriceKg > 0 ? "warning" : "trung-tinh",
    },
  ];

  const purchaseColumns: SummaryTableColumn<DongMua>[] = [
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
    { key: "tien", header: "Giá trị (đ)", numeric: true, render: (r) => num(r.amount), total: () => num(totalAmount) },
  ];

  const scrapColumns: SummaryTableColumn<ScrapRow>[] = [
    { key: "loai", header: "Loại phế liệu", render: (r) => r.name },
    { key: "kg", header: "Số cân (kg)", numeric: true, render: (r) => num(r.quantityKg), total: () => num(totalScrapKg) },
    { key: "tien", header: "Giá trị bán (đ)", numeric: true, render: (r) => num(r.saleValue), total: () => num(totalScrapAmount) },
  ];

  const exportExcel = () => {
    if (!dongMua.length && !scrapRows.length) {
      notify.warning("Không có số liệu để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Báo cáo tổng hợp nhập hàng"]);
    aoa.push([`Kỳ: ${formatDateVN(tu)} – ${formatDateVN(den)} · Phân xưởng: ${workshop}`]);
    aoa.push([]);
    aoa.push(["NGUYÊN LIỆU MUA"]);
    aoa.push(["Đại lý", "Loại nguyên liệu", "Số cân (kg)", "Chờ giá (kg)", "Giá trị (đ)"]);
    for (const r of dongMua)
      aoa.push([r.supplierName, r.materialTypeName, r.quantityKg, r.unpricedKg, r.amount]);
    aoa.push(["Tổng cộng", "", totalKg, totalAwaitingPriceKg, totalAmount]);
    if (scrapRows.length) {
      aoa.push([]);
      aoa.push(["PHẾ LIỆU (giá bán, không tính vào giá trị nhập mua)"]);
      aoa.push(["Loại phế liệu", "Số cân (kg)", "Giá trị bán (đ)"]);
      for (const r of scrapRows) aoa.push([r.name, r.quantityKg, r.saleValue]);
      aoa.push(["Tổng cộng", totalScrapKg, totalScrapAmount]);
    }
    exportAoaToXlsx({
      sheetName: "Nhập hàng",
      aoa,
      colWidths: [26, 26, 14, 14, 16],
      fileName: `bao-cao-nhap-hang_${tu}_${den}.xlsx`,
    });
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-end gap-4">
          <div className="min-w-[12rem]">
            <Combobox
              label="Kỳ báo cáo"
              hideRequiredMark
              clearable={false}
              value={ky}
              onChange={(v) => setKy(v as ViewPeriod)}
              options={KY_OPT}
            />
          </div>
          <div className="min-w-[min(12rem,100%)] flex-1 sm:min-w-[16rem]">
            {ky === "tuy-chon" ? (
              <DateRangeField
                label="Khoảng ngày"
                hideRequiredMark
                presets={false}
                startDate={tuTC}
                endDate={denTC}
                onChange={(a, b) => {
                  setTuTC(a);
                  setDenTC(b);
                }}
              />
            ) : (
              <DateField
                label={ky === "ngay" ? "Ngày" : "Ngày bất kỳ trong kỳ"}
                hideRequiredMark
                hint={ky === "ngay" ? undefined : `Kỳ: ${formatDateVN(tu)} – ${formatDateVN(den)}`}
                value={moc}
                onChange={setMoc}
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
        <Button
          title="Tải báo cáo nhập hàng đang xem (hàng mua + phế liệu) ra file Excel."
          size="lg"
          variant="outline"
          onClick={exportExcel}
          disabled={!dongMua.length && !scrapRows.length}
        >
          <FileSpreadsheet />
          Xuất Excel
        </Button>
      </div>

      <StatCardGrid cards={the} />

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
        rows={dongMua}
        columns={purchaseColumns}
        getKey={(r) => `${r.supplierName}|||${r.materialTypeName}`}
        rowMarkKey={`bao-cao-nhap|${tu}|${den}|${workshop}`}
        emptyText="Không có nguyên liệu mua trong kỳ này."
      />

      {scrapRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-lg font-semibold text-foreground">Phế liệu cân trong kỳ</h3>
            <span className="text-sm text-muted-foreground">
              (giá bán, tách riêng — không cộng vào giá trị nhập mua)
            </span>
          </div>
          <SummaryTable
            rows={scrapRows}
            columns={scrapColumns}
            getKey={(r) => r.name}
            rowMarkKey={`bao-cao-nhap-phe-lieu|${tu}|${den}|${workshop}`}
            emptyText="Không có phế liệu trong kỳ này."
          />
        </section>
      )}
    </div>
  );
}
