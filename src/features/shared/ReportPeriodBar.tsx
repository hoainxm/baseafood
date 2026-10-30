// ============================================================
// Tên file: src/features/shared/ReportPeriodBar.tsx
// Tên tiếng Việt: Thanh chọn kỳ báo cáo (Tháng / Quý / Năm · ‹ kỳ › · Nay) dùng chung các tab Báo cáo
// Description: Period picker for report tabs (khuôn tab Báo cáo Xuất khẩu, design-spec 42 v5; ba-spec 50):
//              kind choice, previous / next, back to current. Second row holds the page's own filter
//              and export button (children).
// ============================================================
import { Button, ChoiceGroup } from "@/design-system";
import { periodOfKind, shiftReportPeriod, type ReportPeriod, type ReportPeriodKind } from "@/lib/exportReports";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PERIOD_NOUN } from "./reportPeriod";

export function ReportPeriodBar({
  period,
  today,
  onChange,
  children,
}: {
  period: ReportPeriod;
  today: string;
  onChange: (p: ReportPeriod) => void;
  /** Hàng thứ hai: ô lọc đối tượng + nút Xuất Excel của trang. */
  children?: React.ReactNode;
}) {
  const noun = PERIOD_NOUN[period.kind];
  const current = periodOfKind(period.kind, today);
  return (
    <div data-tour="report-period" className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <ChoiceGroup
          label="Xem theo"
          hideRequiredMark
          value={period.kind}
          onChange={(v) => onChange(periodOfKind(v as ReportPeriodKind, today))}
          options={[
            { value: "month", label: "Tháng" },
            { value: "quarter", label: "Quý" },
            { value: "year", label: "Năm" },
          ]}
          columns={3}
          className="w-full min-w-0 sm:w-[21rem] sm:shrink-0"
        />
        <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Button variant="ghost" onClick={() => onChange(shiftReportPeriod(period, -1))} title={`Xem ${noun} trước.`} aria-label={`${noun} trước`}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="flex min-w-0 items-center justify-center gap-2 px-2 font-semibold">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {period.label}
          </span>
          <Button variant="ghost" onClick={() => onChange(shiftReportPeriod(period, 1))} title={`Xem ${noun} sau.`} aria-label={`${noun} sau`}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          {current.key !== period.key && (
            <Button variant="ghost" size="sm" onClick={() => onChange(current)} title={`Về ${noun} hiện tại.`}>
              <CalendarCheck className="mr-1 h-4 w-4" aria-hidden />
              Nay
            </Button>
          )}
        </div>
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}
