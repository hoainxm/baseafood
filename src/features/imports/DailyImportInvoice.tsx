// ============================================================
// Tên file cũ: src/features/imports/DailyImportInvoice.tsx
// Tên tiếng Việt: Phiếu nhập Nguyên liệu trong ngày
// Description: Daily Material Import Entry Invoice
// ============================================================
import { useState, type ReactNode } from "react";
import type { MaterialImportItem, ScrapItem, Workshop } from "@/types";
import {
  Button,
  Combobox,
  DateField,
  DateRangeField,
  getDatesInRange,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { Printer, X } from "lucide-react";

/** "2026-07-31" → "31 THÁNG 07 NĂM 2026" (đúng giọng phiếu giấy). */
function dateInWords(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "…";
  return `${d} THÁNG ${m} NĂM ${y}`;
}

/** Gom dòng theo đại lý — mỗi đại lý một cụm, giữ thứ tự xuất hiện. */
interface SupplierGroup {
  supplierName: string;
  rows: MaterialImportItem[];
  note: string[];
}

function groupBySupplier(rows: MaterialImportItem[]): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>();
  for (const r of rows) {
    const name = r.supplierName || "(chưa có đại lý)";
    let cum = map.get(name);
    if (!cum) {
      cum = { supplierName: name, rows: [], note: [] };
      map.set(name, cum);
    }
    cum.rows.push(r);
    const vehicleDescription = [r.driverName, r.licensePlate].filter(Boolean).join(" - ");
    if (vehicleDescription && !cum.note.includes(vehicleDescription)) cum.note.push(vehicleDescription);
  }
  return [...map.values()];
}

/**
 * DailyImportInvoice — "Báo cáo tổng hợp nguyên liệu", bản in A4 NGANG, theo KỲ.
 *
 * Linh hoạt theo bộ lọc ngoài màn: một ngày ⇒ đúng tờ giấy của xí nghiệp; nhiều
 * ngày (tuần/tháng/năm/khoảng) ⇒ mỗi ngày một khối (sang trang khi in), cuối có
 * tổng cộng cả kỳ. Đổi khoảng ngay trong phiếu, không cần đóng.
 *
 * Chỉ ĐỌC dữ liệu đã nhập — không tạo/sửa bản ghi nào.
 */
export default function DailyImportInvoice({
  period: initialPeriod,
  date: initialDate,
  startDate,
  endDate,
  workshop,
  rows,
  scraps,
  showPrice = true,
  onClose,
}: {
  /** Kỳ + ngày neo + khoảng tự chọn — khởi tạo theo bộ lọc ngoài màn. */
  period: ViewPeriod;
  date: string;
  startDate: string;
  endDate: string;
  /** Xưởng đang lọc; "Tất cả" ⇒ gộp cả ba xưởng như phiếu giấy. */
  workshop: Workshop | "Tất cả";
  rows: MaterialImportItem[];
  scraps: ScrapItem[];
  /** Không có quyền xem giá (`imports.view-price`) ⇒ bỏ cột Đơn giá. */
  showPrice?: boolean;
  onClose: () => void;
}) {
  // Bộ chọn kỳ NGAY trong phiếu — cùng cách với màn Nhập hàng.
  const [period, setPeriod] = useState<ViewPeriod>(initialPeriod);
  const [anchor, setAnchor] = useState(initialDate);
  const [customFrom, setCustomFrom] = useState(startDate);
  const [customTo, setCustomTo] = useState(endDate);
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);

  const isInWorkshop = (px: string) =>
    workshop === "Tất cả" || px === workshop;

  const isSingleDay = fromDate === toDate;

  const datesWithData = getDatesInRange(fromDate, toDate).filter(
    (d) =>
      rows.some((r) => r.deliveryDate === d && isInWorkshop(r.workshop)) ||
      scraps.some(
        (r) =>
          r.source === "Nhập hàng" && r.date === d && isInWorkshop(r.workshop)
      )
  );

  const periodTotal = rows
    .filter((r) => r.deliveryDate >= fromDate && r.deliveryDate <= toDate && isInWorkshop(r.workshop))
    .reduce((s, r) => s + (r.quantityKg || 0), 0);

  return (
    <div className="print-root print-landscape fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10">
      {/* Thanh công cụ — không in */}
      <div className="no-print mx-auto mb-5 flex max-w-6xl flex-wrap items-end gap-4">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>

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
              label={
                period === "day"
                  ? "Ngày"
                  : period === "week"
                    ? "Ngày bất kỳ trong tuần"
                    : period === "month"
                      ? "Ngày bất kỳ trong tháng"
                      : "Ngày bất kỳ trong năm"
              }
              hideRequiredMark
              hint={
                period === "day"
                  ? undefined
                  : `Kỳ: ${formatDateVN(fromDate)} – ${formatDateVN(toDate)}`
              }
              value={anchor}
              onChange={setAnchor}
            />
          )}
        </div>

        <Button
          title="Mở hộp in của trình duyệt cho phiếu này. Chọn máy in để in giấy, hoặc 'Lưu thành PDF' để ra file." onClick={() => window.print()}>
          <Printer className="size-4" /> In / Xuất PDF
        </Button>
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Tiêu đề chung */}
        <div className="text-sm font-semibold uppercase leading-tight">
          <div>Công ty TNHH Basefood I</div>
          <div>PXD</div>
        </div>

        <div className="mt-2 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Báo cáo tổng hợp nguyên liệu{isSingleDay ? " hàng ngày" : ""}
          </h1>
          <p className="text-sm font-semibold uppercase">
            {isSingleDay
              ? `Ngày ${dateInWords(fromDate)}`
              : `Từ ${dateInWords(fromDate)} đến ${dateInWords(toDate)}`}
            {workshop !== "Tất cả" ? ` · Phân xưởng ${workshop}` : ""}
          </p>
        </div>

        {datesWithData.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Không có nguyên liệu nhập trong khoảng này.
          </p>
        ) : (
          datesWithData.map((d, i) => (
            <DaySection
              key={d}
              date={d}
              workshop={workshop}
              rows={rows}
              scraps={scraps}
              showDayHeading={!isSingleDay}
              pageBreak={i > 0}
              showPrice={showPrice}
            />
          ))
        )}

        {!isSingleDay && datesWithData.length > 0 && (
          <div className="mt-5 flex justify-end border-t-2 border-slate-800 pt-2 text-sm font-bold uppercase">
            <span>
              Tổng cộng cả kỳ:{" "}
              <span className="tnum">{num(periodTotal)}</span> kg
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Một ngày = một khối như tờ giấy: STT theo đại lý + tổng cộng + phụ phẩm. */
function DaySection({
  date,
  workshop,
  rows,
  scraps,
  showDayHeading: showDateHeader,
  pageBreak,
  showPrice,
}: {
  date: string;
  workshop: Workshop | "Tất cả";
  rows: MaterialImportItem[];
  scraps: ScrapItem[];
  showDayHeading: boolean;
  pageBreak: boolean;
  showPrice: boolean;
}) {
  const isInWorkshop = (px: string) =>
    workshop === "Tất cả" || px === workshop;

  const dayRows = rows.filter(
    (r) => r.deliveryDate === date && isInWorkshop(r.workshop)
  );
  const dailyScraps = scraps.filter(
    (r) =>
      r.source === "Nhập hàng" && r.date === date && isInWorkshop(r.workshop)
  );
  const cum = groupBySupplier(dayRows);
  const totalKg = dayRows.reduce((s, r) => s + (r.quantityKg || 0), 0);

  let stt = 0;

  return (
    <section
      className="mt-5"
      style={pageBreak ? { breakBefore: "page" } : undefined}
    >
      {showDateHeader && (
        <p className="mb-1 text-sm font-bold uppercase">Ngày {dateInWords(date)}</p>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <Th className="w-12 text-center">STT</Th>
            <Th>Tên đại lý</Th>
            <Th>Loại nguyên liệu</Th>
            <Th right className="w-28">
              Số lượng
            </Th>
            {showPrice && (
              <Th right className="w-24">
                Đơn giá
              </Th>
            )}
            <Th className="w-64">Ghi chú</Th>
          </tr>
        </thead>
        <tbody>
          {cum.map((c) => {
            stt += 1;
            const n = c.rows.length;
            return c.rows.map((r, i) => (
              <tr key={r.id}>
                {i === 0 && (
                  <Td rowSpan={n} className="text-center align-top tnum">
                    {stt}
                  </Td>
                )}
                {i === 0 && (
                  <Td rowSpan={n} className="align-top font-medium">
                    {c.supplierName}
                  </Td>
                )}
                <Td>{r.materialTypeName}</Td>
                <Td right className="tnum">
                  {num(r.quantityKg)}
                </Td>
                {showPrice && (
                  <Td right className="tnum">
                    {r.unitPrice != null ? num(r.unitPrice) : ""}
                  </Td>
                )}
                {i === 0 && (
                  <Td rowSpan={n} className="align-top">
                    {c.note.join(" · ")}
                  </Td>
                )}
              </tr>
            ));
          })}
          <tr className="border-t-2 border-slate-700 bg-slate-50 font-bold">
            <Td colSpan={3}>Tổng cộng</Td>
            <Td right className="tnum">
              {num(totalKg)}
            </Td>
            {showPrice && <Td />}
            <Td />
          </tr>
        </tbody>
      </table>

      {dailyScraps.length > 0 && (
        <div className="mt-3 flex justify-end">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <Th className="w-40">Phụ phẩm</Th>
                <Th right className="w-28">
                  Số lượng
                </Th>
              </tr>
            </thead>
            <tbody>
              {dailyScraps.map((r) => (
                <tr key={r.id}>
                  <Td>{r.name}</Td>
                  <Td right className="tnum">
                    {num(r.quantityKg)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  right,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`border border-slate-400 px-2 py-1 text-xs font-semibold uppercase ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  rowSpan,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-400 px-2 py-1 ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
