/**
 * PeriodPicker — chọn KỲ XEM của sổ / báo cáo, MỘT kiểu cho mọi trang (rà UX 2026-11-03: trước đó 4 kiểu —
 * thanh nút ở Tổng quan, 3 nút ở Xuất khẩu, ô thả + ô ngày ở các sổ, ô khoảng ngày ở NXT).
 *
 * Hai ô, đặt thẳng trong `FilterBar` (trả về Fragment): "Kỳ xem" (Ngày · Tuần · Tháng · Năm · Khoảng tự chọn)
 * + ô ngày neo có nút ‹ › lùi / tới một kỳ. Khoảng tự chọn ⇒ hai ô Từ / Đến. Dưới nhãn ô ngày ghi kỳ đang xem
 * ("Tháng 11/2026") để chọn "ngày bất kỳ trong tháng" không phải tự suy.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS, getViewPeriodRange, stepViewPeriod, viewPeriodLabel, type ViewPeriod, type ViewPeriodOption } from "@/lib/periodUtils";
import { Combobox } from "./Combobox";
import { DateField, DateRangeField } from "./DateField";

const UNIT: Record<Exclude<ViewPeriod, "custom">, string> = { day: "ngày", week: "tuần", month: "tháng", year: "năm" };

export function PeriodPicker({
  period,
  onPeriodChange,
  anchor,
  onAnchorChange,
  customFrom,
  customTo,
  onCustomChange,
  kindLabel = "Kỳ xem",
  dayLabel = "Ngày",
  rangeLabel = "Khoảng ngày",
  options = PERIOD_OPTIONS,
}: {
  period: ViewPeriod;
  onPeriodChange: (period: ViewPeriod) => void;
  /** Ngày neo (ISO) — kỳ = ngày / tuần / tháng / năm chứa ngày này. */
  anchor: string;
  onAnchorChange: (iso: string) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (fromDate: string, toDate: string) => void;
  kindLabel?: string;
  /** Nhãn ô ngày khi xem theo NGÀY ("Ngày xuất bán"); kỳ khác ghi "Ngày bất kỳ trong tháng"… */
  dayLabel?: string;
  rangeLabel?: string;
  /** Bớt kiểu kỳ trang không dùng (vd chỉ Tháng · Năm). */
  options?: ViewPeriodOption[];
}) {
  const [fromDate, toDate] = getViewPeriodRange(period, anchor, customFrom, customTo);
  return (
    <>
      <Combobox
        label={kindLabel}
        hideRequiredMark
        clearable={false}
        value={period}
        onChange={(v) => onPeriodChange(v as ViewPeriod)}
        options={options}
        className="min-w-[10rem]"
      />
      {period === "custom" ? (
        <DateRangeField
          label={rangeLabel}
          hideRequiredMark
          presets={false}
          startDate={customFrom}
          endDate={customTo}
          onChange={onCustomChange}
          className="min-w-[min(16rem,100%)] flex-1"
        />
      ) : (
        <DateField
          label={period === "day" ? dayLabel : `Ngày bất kỳ trong ${UNIT[period]}`}
          hideRequiredMark
          hint={period === "day" ? undefined : `Đang xem: ${viewPeriodLabel(period, fromDate, toDate)}`}
          value={anchor}
          onChange={onAnchorChange}
          className="min-w-[min(15rem,100%)] flex-1"
          adornStart={
            <Button
              variant="outline"
              size="icon"
              title={`Lùi về ${UNIT[period]} trước.`}
              aria-label={`${UNIT[period]} trước`}
              onClick={() => onAnchorChange(stepViewPeriod(period, anchor, -1))}
            >
              <ChevronLeft />
            </Button>
          }
          adornEnd={
            <Button
              variant="outline"
              size="icon"
              title={`Tới ${UNIT[period]} sau.`}
              aria-label={`${UNIT[period]} sau`}
              onClick={() => onAnchorChange(stepViewPeriod(period, anchor, 1))}
            >
              <ChevronRight />
            </Button>
          }
        />
      )}
    </>
  );
}
