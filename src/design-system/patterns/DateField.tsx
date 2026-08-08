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

export function viNgay(iso: string | undefined): string {
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
export function ngayTrongKhoang(tu: string, den: string): string[] {
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

export function congNgay(iso: string, soNgay: number): string {
  const d = isoToDate(iso) ?? new Date();
  d.setDate(d.getDate() + soNgay);
  return dateToIso(d);
}

export const homNay = () => dateToIso(new Date());

/* ---- Khối nhãn dùng chung ---- */

function KhoiNhan({
  label,
  required,
  hint,
  info,
  error,
  htmlFor,
  anNhanBatBuoc,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  /** Câu diễn giải dài — gom vào nút ⓘ cạnh nhãn thay vì hiện thành dòng hint. */
  info?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  anNhanBatBuoc?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {info && <InfoTip label={label}>{info}</InfoTip>}
        {anNhanBatBuoc ? null : required ? (
          <span className="rounded bg-secondary px-2 py-0.5 text-sm font-semibold text-secondary-foreground">
            Bắt buộc
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">(không bắt buộc)</span>
        )}
      </div>
      {hint && <p className="text-base text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-base font-semibold text-destructive">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </>
  );
}

/* ---- Nút mở lịch (dùng cho cả 1 ngày và 2 đầu khoảng) ---- */

function NutLich({
  value,
  onChange,
  chuMacDinh,
  min,
  max,
  id,
}: {
  value: string;
  onChange: (iso: string) => void;
  chuMacDinh: string;
  /** Giới hạn: không cho chọn trước ngày này (ISO) */
  min?: string;
  /** Giới hạn: không cho chọn sau ngày này (ISO) */
  max?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const d = isoToDate(value);

  const dat = (iso: string) => {
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
          className="h-12 w-full justify-start border-2 px-3.5 text-base font-medium"
        >
          <CalendarDays className="shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !d && "text-muted-foreground")}>
            {d ? viNgay(value) : chuMacDinh}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Button variant="secondary" size="sm" onClick={() => dat(homNay())}>
            Hôm nay
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dat(congNgay(homNay(), -1))}
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
            if (x) dat(dateToIso(x));
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
  choPhepXoa = false,
  anNhanBatBuoc = false,
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
  choPhepXoa?: boolean;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  anNhanBatBuoc?: boolean;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("space-y-2", className)}>
      <KhoiNhan
        label={label}
        required={required}
        hint={hint}
        info={info}
        error={error}
        htmlFor={id}
        anNhanBatBuoc={anNhanBatBuoc}
      />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <NutLich
            id={id}
            value={value}
            onChange={onChange}
            chuMacDinh="Bấm để chọn ngày"
          />
        </div>
        {choPhepXoa && value && (
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
  anNhanBatBuoc = false,
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
  anNhanBatBuoc?: boolean;
  className?: string;
}) {
  const nhanh = (soNgay: number) => {
    const den = homNay();
    onChange(congNgay(den, -(soNgay - 1)), den);
  };

  const soNgay =
    startDate && endDate ? ngayTrongKhoang(startDate, endDate).length : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <KhoiNhan
        label={label}
        required={required}
        hint={hint}
        error={error}
        anNhanBatBuoc={anNhanBatBuoc}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted-foreground">
            Từ ngày
          </span>
          <NutLich
            value={startDate}
            onChange={(v) => onChange(v, endDate && endDate < v ? v : endDate)}
            chuMacDinh="Chọn ngày đầu"
            max={endDate || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted-foreground">
            Đến ngày
          </span>
          <NutLich
            value={endDate}
            onChange={(v) => onChange(startDate, v)}
            chuMacDinh="Chọn ngày cuối"
            min={startDate || undefined}
          />
        </div>
      </div>

      {presets && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={() => nhanh(1)}>
            Hôm nay
          </Button>
          <Button variant="secondary" size="sm" onClick={() => nhanh(5)}>
            5 ngày
          </Button>
          <Button variant="secondary" size="sm" onClick={() => nhanh(7)}>
            7 ngày
          </Button>
          <Button variant="secondary" size="sm" onClick={() => nhanh(30)}>
            30 ngày
          </Button>
          {soNgay > 0 && (
            <span className="ml-auto text-base text-muted-foreground">
              Đang chọn{" "}
              <span className="tnum font-semibold text-foreground">
                {soNgay}
              </span>{" "}
              ngày
            </span>
          )}
        </div>
      )}
    </div>
  );
}
