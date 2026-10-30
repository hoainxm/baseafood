// ============================================================
// Tên file: src/features/import-planning/ImportReportView.tsx
// Tên tiếng Việt: Tab Báo cáo của Nhập khẩu — lần nhập, kg thực nhập, trị giá theo kỳ
// Description: Read-only report tab of /planning-import (ba-spec 50 RP1): period + supplier filter,
//              4 stat cards, per month / supplier / product / import type tables, receipts needing
//              attention, Excel export. Figures from lib/importReports. Price only with view-price.
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
import { formatDateVN, formatMoney } from "@/lib/format";
import { IMPORT_DOCUMENT_KINDS, type ImportData } from "@/lib/importPlanning";
import {
  IMPORT_ATTENTION_LABELS,
  buildImportReport,
  currencyText,
  type CurrencyAmounts,
  type ImportAttentionRow,
  type ImportFigures,
  type ImportMonthRow,
  type ImportProductRow,
  type ImportSupplierRow,
  type ImportTypeRow,
} from "@/lib/importReports";
import type { ReportPeriod } from "@/lib/exportReports";
import { BarChart3, Container, Eye, FileCheck2, FileSpreadsheet, FileSignature, Wallet, Weight } from "lucide-react";

const monthLabel = (m: string) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const docName = (k: string) => IMPORT_DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? k;
const valueSort = (v: CurrencyAmounts) => Object.values(v).reduce((s, n) => s + n, 0);

export function ImportReportView({
  data,
  period,
  today,
  canSeePrice,
  canExport,
  onPeriodChange,
  onOpenReceipt,
  onExportExcel,
}: {
  data: ImportData;
  period: ReportPeriod;
  today: string;
  canSeePrice: boolean;
  canExport: boolean;
  onPeriodChange: (p: ReportPeriod) => void;
  onOpenReceipt: (contractId: string, receiptId: string) => void;
  onExportExcel: (p: ReportPeriod, supplierId: string, supplierName: string) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const report = useMemo(() => buildImportReport(data, period, { supplierId, today }), [data, period, supplierId, today]);
  const noun = PERIOD_NOUN[period.kind];
  const t = report.totals;
  const money = (v: CurrencyAmounts) => currencyText(v, formatMoney);
  const supplierOptions: ComboboxOption[] = [
    { value: "", label: "Mọi đối tác" },
    ...[...new Map(data.contracts.map((c) => [c.supplierId, c.supplierName])).entries()].map(([value, label]) => ({ value, label: label || "(chưa rõ)" })),
  ];
  const supplierName = supplierId ? (supplierOptions.find((o) => o.value === supplierId)?.label ?? "") : "";

  const cards: StatCardData[] = [
    { label: `Lần nhập trong ${noun}`, value: t.receipts, numeric: true, icon: Container, color: "brand", subtext: `${formatNumber(t.containers)} cont · ${formatNumber(t.loose)} hàng lẻ` },
    { label: "Thực nhập", value: `${formatNumber(t.receivedKg)} kg`, icon: Weight, color: "brand", subtext: `theo invoice của các lần nhập trong ${noun}` },
    canSeePrice
      ? { label: "Trị giá nhập", value: money(t.value), icon: Wallet, color: "success", subtext: "kg thực nhập × đơn giá HĐ, tách theo tiền tệ" }
      : { label: `HĐ ký trong ${noun}`, value: t.contractsSigned, numeric: true, icon: FileSignature, color: "brand", subtext: `${formatNumber(t.contractKgSigned)} kg` },
    {
      label: "Đủ hồ sơ",
      value: `${formatNumber(t.complete)} / ${formatNumber(t.receipts)}`,
      icon: FileCheck2,
      color: t.missingDocs + t.awaitingQuantity ? "warning" : "success",
      subtext: `thiếu chứng từ ${formatNumber(t.missingDocs)} · chờ thực nhập ${formatNumber(t.awaitingQuantity)}`,
    },
  ];

  const figureColumns = <T extends ImportFigures>(): RecordTableColumn<T>[] => [
    { key: "receipts", header: "Lần nhập", numeric: true, render: (r) => formatNumber(r.receipts), getSortValue: (r) => r.receipts },
    { key: "containers", header: "Cont", numeric: true, render: (r) => formatNumber(r.containers), getSortValue: (r) => r.containers, hideOnMobile: true },
    { key: "loose", header: "Hàng lẻ", numeric: true, render: (r) => formatNumber(r.loose), getSortValue: (r) => r.loose, hideOnMobile: true },
    { key: "kg", header: "Kg thực nhập", numeric: true, render: (r) => formatNumber(r.receivedKg), getSortValue: (r) => r.receivedKg },
    ...(canSeePrice ? ([{ key: "value", header: "Trị giá", numeric: true, render: (r) => money(r.value), getSortValue: (r) => valueSort(r.value) }] as RecordTableColumn<T>[]) : []),
  ];
  const monthColumns: RecordTableColumn<ImportMonthRow>[] = [{ key: "month", header: "Tháng", primary: true, render: (r) => monthLabel(r.month), getSortValue: (r) => r.month }, ...figureColumns<ImportMonthRow>()];
  const supplierColumns: RecordTableColumn<ImportSupplierRow>[] = [
    { key: "name", header: "Đối tác", primary: true, render: (r) => r.supplierName, getSortValue: (r) => r.supplierName },
    ...figureColumns<ImportSupplierRow>(),
    { key: "short", header: "HĐ còn chưa về (kg)", numeric: true, render: (r) => formatNumber(r.shortKg), getSortValue: (r) => r.shortKg },
  ];
  const productColumns: RecordTableColumn<ImportProductRow>[] = [
    { key: "name", header: "Mặt hàng", primary: true, render: (r) => <span className="break-words">{r.name}</span>, getSortValue: (r) => r.name },
    { key: "kg", header: "Kg thực nhập", numeric: true, render: (r) => formatNumber(r.receivedKg), getSortValue: (r) => r.receivedKg },
    ...(canSeePrice
      ? ([
          { key: "value", header: "Trị giá", numeric: true, render: (r) => money(r.value), getSortValue: (r) => valueSort(r.value) },
          {
            key: "avg",
            header: "Đơn giá bình quân",
            numeric: true,
            render: (r) => (r.receivedKg ? currencyText(Object.fromEntries(Object.entries(r.value).map(([c, n]) => [c, n / r.receivedKg])), formatMoney) : "—"),
            getSortValue: (r) => (r.receivedKg ? valueSort(r.value) / r.receivedKg : null),
            sortKind: "number",
          },
        ] as RecordTableColumn<ImportProductRow>[])
      : []),
  ];
  const typeColumns: RecordTableColumn<ImportTypeRow>[] = [
    { key: "type", header: "Loại hình", primary: true, render: (r) => r.label, getSortValue: (r) => r.label },
    { key: "receipts", header: "Lần nhập", numeric: true, render: (r) => formatNumber(r.receipts), getSortValue: (r) => r.receipts },
    { key: "kg", header: "Kg thực nhập", numeric: true, render: (r) => formatNumber(r.receivedKg), getSortValue: (r) => r.receivedKg },
  ];
  const attentionColumns: RecordTableColumn<ImportAttentionRow>[] = [
    { key: "no", header: "Hợp đồng", primary: true, render: (a) => <span className="font-semibold break-words">{a.contractNo}</span>, getSortValue: (a) => a.contractNo },
    { key: "supplier", header: "Đối tác", render: (a) => a.supplierName, getSortValue: (a) => a.supplierName },
    { key: "date", header: "Ngày về", sortKind: "date", render: (a) => <span className="tnum">{formatDateVN(a.date)}</span>, getSortValue: (a) => a.date },
    {
      key: "kind",
      header: "Vấn đề",
      sortKind: "rank",
      getSortValue: (a) => (a.kind === "missing-docs" ? 0 : 1),
      render: (a) => (
        <span className="grid gap-1">
          <span>
            <Tag variant={a.kind === "missing-docs" ? "warning" : "pending"}>{IMPORT_ATTENTION_LABELS[a.kind]}</Tag>
          </span>
          {a.missing.length > 0 && <span className="text-sm text-muted-foreground">Còn thiếu: {a.missing.map(docName).join(", ")}</span>}
        </span>
      ),
    },
  ];

  const isEmpty = !t.receipts && !t.contractsSigned && !report.bySupplier.length;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <ReportPeriodBar period={period} today={today} onChange={onPeriodChange}>
        <div className="min-w-0 flex-1 basis-48 sm:max-w-sm">
          <Combobox label="Đối tác" hideRequiredMark value={supplierId} onChange={setSupplierId} options={supplierOptions} clearable={false} />
        </div>
        {canExport && (
          <Button variant="outline" onClick={() => onExportExcel(period, supplierId, supplierName)} title={`Xuất Excel báo cáo nhập khẩu ${period.label}${supplierName ? ` của ${supplierName}` : ""}: tổng kỳ, theo tháng, đối tác, mặt hàng, loại hình, lần nhập cần chú ý.`}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden />
            Xuất Excel
          </Button>
        )}
      </ReportPeriodBar>

      {isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title={`${period.label} chưa có số nhập khẩu${supplierName ? ` của ${supplierName}` : ""}`}
          description="Chưa có lần nhập hay hợp đồng ký nào trong kỳ này. Đổi kỳ hoặc đối tác để xem số khác."
        />
      ) : (
        <>
          <div data-tour="import-report-stats">
            <StatCardGrid cards={cards} />
          </div>

          {report.byMonth.length > 1 && (
            <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
              <h3 className="font-semibold">Theo tháng</h3>
              <p className="text-sm text-muted-foreground">Lần nhập xếp vào tháng theo ngày về kho; chưa về thì theo ngày dự kiến.</p>
              <RecordTable columns={monthColumns} rows={report.byMonth} getKey={(r) => r.month} rowMarkKey={`import-report-months:${period.key}:${supplierId || "all"}`} emptyText="Không có tháng nào." />
            </section>
          )}

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Theo đối tác</h3>
            <p className="text-sm text-muted-foreground">HĐ còn chưa về = kg các hợp đồng đang mở còn chưa nhập, không theo kỳ.</p>
            <RecordTable columns={supplierColumns} rows={report.bySupplier} getKey={(r) => r.supplierName} rowMarkKey={`import-report-suppliers:${period.key}:${supplierId || "all"}`} emptyText={`Không đối tác nào có lần nhập trong ${noun}.`} />
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Theo mặt hàng</h3>
            <RecordTable columns={productColumns} rows={report.byProduct} getKey={(r) => r.key} rowMarkKey={`import-report-products:${period.key}:${supplierId || "all"}`} emptyText={`Chưa ghi thực nhập nào trong ${noun}.`} />
          </section>

          {report.byImportType.length > 0 && (
            <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
              <h3 className="font-semibold">Theo loại hình</h3>
              <RecordTable columns={typeColumns} rows={report.byImportType} getKey={(r) => r.importType || "none"} rowMarkKey={`import-report-types:${period.key}:${supplierId || "all"}`} emptyText="—" />
            </section>
          )}

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <h3 className="font-semibold">Lần nhập cần chú ý</h3>
            <p className="text-sm text-muted-foreground">Lần nhập của {noun} còn thiếu chứng từ bắt buộc, hoặc đã về kho mà chưa ghi thực nhập.</p>
            <RecordTable
              columns={attentionColumns}
              rows={report.attention}
              getKey={(a) => a.receiptId}
              rowMarkKey={`import-report-attention:${period.key}:${supplierId || "all"}`}
              emptyText={`Không lần nhập nào cần chú ý trong ${noun}.`}
              actions={(a) => (
                <Button size="sm" variant="ghost" onClick={() => onOpenReceipt(a.contractId, a.receiptId)} title={`Mở hồ sơ hợp đồng ${a.contractNo} tại lần nhập này.`}>
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
