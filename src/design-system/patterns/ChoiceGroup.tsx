import { Combobox } from "./Combobox";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface LuaChon {
  value: string;
  label: string;
  /** Mô tả phụ hiện dưới nhãn khi ở dạng nút */
  moTa?: string;
}

/**
 * ChoiceGroup — chọn 1 trong N.
 *
 * ≤ nguongNut (mặc định 6): hiện NÚT TO, thấy hết lựa chọn, 1 lần chạm là xong.
 *   Dropdown bắt người dùng: chạm mở → đọc → chạm chọn (3 thao tác, panel che màn).
 * > nguongNut: mới dùng dropdown.
 *
 * Trạng thái chọn KHÔNG chỉ báo bằng màu — có thêm dấu ✓ và viền dày.
 */
export function ChoiceGroup({
  label,
  value,
  onChange,
  options,
  required,
  hint,
  error,
  nguongNut = 6,
  cot = 2,
  anNhanBatBuoc = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LuaChon[];
  required?: boolean;
  hint?: string;
  error?: string;
  nguongNut?: number;
  cot?: 2 | 3 | 4;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  anNhanBatBuoc?: boolean;
  className?: string;
}) {
  // Quá nhiều lựa chọn để bày hết thành nút → chuyển sang danh sách có ô tìm.
  if (options.length > nguongNut) {
    return (
      <Combobox
        label={label}
        required={required}
        hint={hint}
        error={error}
        anNhanBatBuoc={anNhanBatBuoc}
        className={className}
        value={value}
        onChange={onChange}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          phu: o.moTa,
        }))}
      />
    );
  }

  return (
    <fieldset className={cn("min-w-0 space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <legend className="text-base leading-snug font-semibold text-foreground">
          {label}
          {!anNhanBatBuoc && required && (
            <span aria-hidden className="ml-1 font-bold text-destructive">
              *
            </span>
          )}
        </legend>
      </div>
      {hint && <p className="text-base text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-base font-semibold text-destructive">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}

      {/* Lưới đều cột: mọi nút RỘNG BẰNG NHAU, không có nút lẻ ở hàng cuối bị kéo
          giãn hết chiều ngang (lỗi cũ của flex-wrap + flex-1 — "Khô" chiếm cả hàng). */}
      <div
        className={cn(
          "grid gap-3",
          cot === 2 && "grid-cols-1 sm:grid-cols-2",
          cot === 3 && "grid-cols-2 sm:grid-cols-3",
          cot === 4 && "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {options.map((o) => {
          const chon = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              data-slot="choice-option"
              aria-pressed={chon}
              onClick={() => onChange(o.value)}
              className={cn(
                /* 48px — bằng đúng chiều cao ô nhập, để hai cột cạnh nhau
                   (VD "Ngày nhập hàng" ↔ "Phân xưởng") thẳng hàng. */
                "flex min-h-12 w-full items-center justify-between gap-4 rounded-lg border-2 px-4 py-2 text-left text-base font-semibold transition-colors",
                chon
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted"
              )}
            >
              <span className="min-w-0">
                {o.label}
                {o.moTa && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    {o.moTa}
                  </span>
                )}
              </span>
              <Check
                aria-hidden
                className={cn(
                  "size-6 shrink-0 text-primary",
                  chon ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
