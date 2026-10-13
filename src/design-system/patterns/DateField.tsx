import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CalendarDays, X } from "lucide-react";
import { InfoTip } from "./InfoTip";

/* ---- Chuyển đổi ISO (yyyy-mm-dd, dùng để lưu) ↔ Date ---- */

export function isoToDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function dateToIso(d: Date | undefined): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatWeekdayDate(iso: string | undefined): string {
  const d = isoToDate(iso);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Các ngày trong khoảng (bao gồm hai đầu), dạng ISO. */
export function getDatesInRange(tu: string, den: string): string[] {
  const a = isoToDate(tu);
  const b = isoToDate(den) ?? a;
  if (!a || !b) return [];
  const out: string[] = [];
  const d = new Date(a);
  while (d <= b) {
    out.push(dateToIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export const todayIso = () => dateToIso(new Date());

/* ---- Khối nhãn dùng chung ---- */

function LabelBlock({
  label,
  required,
  hint,
  info,
  error,
  htmlFor,
  hideRequiredMark,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  /** Câu diễn giải dài — gom vào nút ⓘ cạnh nhãn thay vì hiện thành dòng hint. */
  info?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  hideRequiredMark?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {!hideRequiredMark && required && (
            <span aria-hidden className="ml-1 font-bold text-destructive">
              *
            </span>
          )}
        </Label>
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-sm font-semibold text-destructive">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </>
  );
}

/* ---- Nút mở lịch (dùng cho cả 1 ngày và 2 đầu khoảng) ---- */

function CalendarButton({
  value,
  onChange,
  placeholder,
  min,
  max,
  id,
  required,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder: string;
  /** Giới hạn: không cho chọn trước ngày này (ISO) */
  min?: string;
  /** Giới hạn: không cho chọn sau ngày này (ISO) */
  max?: string;
  id?: string;
  /** Đánh dấu bắt buộc cho trình đọc màn hình + để form dò ra ô bắt buộc. */
  required?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const d = isoToDate(value);

  const setDate = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          data-slot="date-trigger"
          variant="outline"
          aria-required={required ? true : undefined}
          title="Mở lịch để chọn ngày. Có sẵn lối tắt Hôm nay / Hôm qua ở đầu lịch."
          className="h-10 w-full justify-start px-3 text-sm font-medium"
        >
          <CalendarDays className="shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !d && "text-muted-foreground")}>
            {d ? formatWeekdayDate(value) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Button variant="secondary" size="sm" onClick={() => setDate(todayIso())} title="Điền ngay ngày hôm nay, khỏi dò trên lịch.">
            Hôm nay
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate(addDays(todayIso(), -1))}
            title="Điền ngay ngày hôm qua — hay dùng khi ghi bù sổ của ngày trước."
          >
            Hôm qua
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={d}
          defaultMonth={d}
          disabled={[
            ...(min ? [{ before: isoToDate(min)! }] : []),
            ...(max ? [{ after: isoToDate(max)! }] : []),
          ]}
          onSelect={(x) => {
            if (x) setDate(dateToIso(x));
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * DateField — chọn MỘT ngày bằng lịch.
 *
 * Không dùng <input type="date"> vì trên desktop phải gõ dd/mm/yyyy bằng tay,
 * ô lịch nhỏ, định dạng phụ thuộc locale máy → người lớn tuổi gõ nhầm
 * ngày/tháng. Ở đây bấm nút to → lịch ô 48px → chạm ngày là xong.
 */
export function DateField({
  label,
  value,
  onChange,
  required,
  hint,
  info,
  error,
  clearable = false,
  hideRequiredMark = false,
  className,
}: {
  label: string;
  /** ISO yyyy-mm-dd */
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  hint?: string;
  /** Câu diễn giải dài — gom vào nút ⓘ cạnh nhãn (giữ nhãn 1 dòng, không đẩy ô lệch). */
  info?: React.ReactNode;
  error?: string;
  clearable?: boolean;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  hideRequiredMark?: boolean;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <LabelBlock
        label={label}
        required={required}
        hint={hint}
        info={info}
        error={error}
        htmlFor={id}
        hideRequiredMark={hideRequiredMark}
      />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CalendarButton
            id={id}
            value={value}
            onChange={onChange}
            placeholder="Bấm để chọn ngày"
            required={required && !hideRequiredMark}
          />
        </div>
        {clearable && value && (
          <Button
            variant="outline"
            size="icon"
            aria-label={`Xóa ${label}`}
            onClick={() => onChange("")}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * DateRangeField — chọn khoảng: HAI Ô RIÊNG "Từ ngày" và "Đến ngày".
 *
 * Cố tình KHÔNG dùng kiểu kéo-chọn-khoảng trên một lịch: thao tác đó yêu cầu
 * nhớ mình đang chọn đầu nào, chạm nhầm là mất cả khoảng. Hai ô riêng thì mỗi
 * lần chỉ trả lời một câu hỏi, và sửa lại một đầu không đụng đầu kia.
 * Ô "Đến ngày" tự chặn không cho chọn trước "Từ ngày".
 */
export function DateRangeField({
  label,
  startDate,
  endDate,
  onChange,
  required,
  hint,
  error,
  presets = true,
  hideRequiredMark = false,
  className,
}: {
  label: string;
  startDate: string;
  endDate: string;
  onChange: (tu: string, den: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Hiện nút nhanh 5 / 7 / 30 ngày gần đây */
  presets?: boolean;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  hideRequiredMark?: boolean;
  className?: string;
}) {
  const quickPick = (days: number) => {
    const den = todayIso();
    onChange(addDays(den, -(days - 1)), den);
  };

  const dayCount =
    startDate && endDate ? getDatesInRange(startDate, endDate).length : 0;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <LabelBlock
        label={label}
        required={required}
        hint={hint}
        error={error}
        hideRequiredMark={hideRequiredMark}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted-foreground">
            Từ ngày
          </span>
          <CalendarButton
            value={startDate}
            onChange={(v) => onChange(v, endDate && endDate < v ? v : endDate)}
            placeholder="Chọn ngày đầu"
            max={endDate || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted-foreground">
            Đến ngày
          </span>
          <CalendarButton
            value={endDate}
            onChange={(v) => onChange(startDate, v)}
            placeholder="Chọn ngày cuối"
            min={startDate || undefined}
          />
        </div>
      </div>

      {presets && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={() => quickPick(1)} title="Đặt khoảng xem = riêng ngày hôm nay.">
            Hôm nay
          </Button>
          <Button variant="secondary" size="sm" onClick={() => quickPick(5)} title="Đặt khoảng xem = 5 ngày gần nhất tính tới hôm nay.">
            5 ngày
          </Button>
          <Button variant="secondary" size="sm" onClick={() => quickPick(7)} title="Đặt khoảng xem = 7 ngày gần nhất tính tới hôm nay.">
            7 ngày
          </Button>
          <Button variant="secondary" size="sm" onClick={() => quickPick(30)} title="Đặt khoảng xem = 30 ngày gần nhất tính tới hôm nay.">
            30 ngày
          </Button>
          {dayCount > 0 && (
            <span className="ml-auto text-sm text-muted-foreground">
              Đang chọn{" "}
              <span className="tnum font-semibold text-foreground">
                {dayCount}
              </span>{" "}
              ngày
            </span>
          )}
        </div>
      )}
    </div>
  );
}
