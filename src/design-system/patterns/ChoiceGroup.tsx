import { Combobox } from "./Combobox";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface ChoiceOption {
  value: string;
  label: string;
  /** Mô tả phụ hiện dưới nhãn khi ở dạng nút */
  description?: string;
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
  maxButtons = 6,
  columns = 2,
  hideRequiredMark = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ChoiceOption[];
  required?: boolean;
  hint?: string;
  error?: string;
  maxButtons?: number;
  columns?: 2 | 3 | 4;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC, không phải ô nhập. */
  hideRequiredMark?: boolean;
  className?: string;
}) {
  // Quá nhiều lựa chọn để bày hết thành nút → chuyển sang danh sách có ô tìm.
  if (options.length > maxButtons) {
    return (
      <Combobox
        label={label}
        required={required}
        hint={hint}
        error={error}
        hideRequiredMark={hideRequiredMark}
        className={className}
        value={value}
        onChange={onChange}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          subLabel: o.description,
        }))}
      />
    );
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <legend className="text-sm leading-snug font-semibold text-foreground">
          {label}
          {!hideRequiredMark && required && (
            <span aria-hidden className="ml-1 font-bold text-destructive">
              *
            </span>
          )}
        </legend>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-sm font-semibold text-destructive">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}

      {/* Lưới đều cột: mọi nút RỘNG BẰNG NHAU, không có nút lẻ ở hàng cuối bị kéo
          giãn hết chiều ngang (lỗi cũ của flex-wrap + flex-1 — "Khô" chiếm cả hàng). */}
      <div
        className={cn(
          // mt-auto: các nút chọn dồn đáy như ô nhập của Field khi ô cùng hàng có dòng gợi ý (2026-10-30).
          "mt-auto grid gap-3",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-2 sm:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {options.map((o) => {
          const isSelected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              data-slot="choice-option"
              aria-pressed={isSelected}
              onClick={() => onChange(o.value)}
              title={o.description ?? `Chọn "${o.label}" cho ${label.toLowerCase()}.`}
              className={cn(
                /* 40px — bằng đúng chiều cao ô nhập, để hai cột cạnh nhau
                   (VD "Ngày nhập hàng" ↔ "Phân xưởng") thẳng hàng.
                   Giữ border-2: viền dày là tín hiệu CHỌN (không chỉ dựa màu). */
                "flex min-h-10 w-full items-center justify-between gap-4 rounded-lg border-2 px-4 py-2 text-left text-sm font-semibold press-feedback",
                isSelected
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted"
              )}
            >
              <span className="min-w-0">
                {o.label}
                {o.description && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    {o.description}
                  </span>
                )}
              </span>
              <Check
                aria-hidden
                className={cn(
                  "size-5 shrink-0 text-primary",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
