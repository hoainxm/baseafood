import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "./Field";
import { useFieldInput } from "./fieldInput";
import { navigateNumberColumn } from "./numberColumnNav";
import { ExpressionPreview } from "./NumberInput";
import { useNumberInput } from "./useNumberInput";
import { Minus, Plus } from "lucide-react";

// Lõi đọc số / tính biểu thức ở `numberExpression.ts` (hàm thuần, có test); hành vi
// ô (ghi theo phím, Esc, xem trước "= kết quả") ở `NumberInput.tsx` — dùng chung
// với ô lưới `EditableGrid`.

/**
 * Ô `<input>` của NumberField. Tách component riêng để đọc thuộc tính của `Field`
 * (id cho nhãn, aria-*, khoảng chừa đơn vị) qua context và trải lên CHÍNH ô nhập —
 * con trực tiếp của `Field` là thẻ bọc (`<div>` + dòng xem trước biểu thức).
 */
function NumberInputInField(props: React.ComponentProps<typeof Input>) {
  const tt = useFieldInput();
  return <Input {...tt} {...props} style={{ ...tt?.style, ...props.style }} />;
}

/**
 * NumberField — ô nhập số cho người lớn tuổi.
 *
 *  - Gõ thô, rời ô (blur) mới hiện dấu chấm phần nghìn → nhìn ra "1.250" thay vì "1250".
 *  - type="text" + inputMode="decimal": bàn phím số trên tablet, nhưng KHÔNG bị
 *    lăn chuột đổi giá trị âm thầm như type="number".
 *  - Đơn vị hiện trong ô (kg / đ / %), không phải chỉ ở nhãn.
 *  - Nút −/+ tùy chọn cho ai không quen gõ số.
 */
export function NumberField({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  unit = "kg",
  step,
  placeholder = "0",
  hideRequiredMark = false,
  hideLabel = false,
  navCol,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  unit?: string;
  /** Có step → hiện nút −/+ */
  step?: number;
  placeholder?: string;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng cho ô sửa nhanh trong bảng thông số. */
  hideRequiredMark?: boolean;
  /** Giấu hẳn nhãn (aria-label), dùng trong bảng/lưới có tiêu đề cột. */
  hideLabel?: boolean;
  /**
   * Bật điều hướng ↑/↓/Enter kiểu Excel: nhảy dọc trong CỘT cùng tên này (mọi
   * ô cùng `navCol` trong khung `[data-grid-nav]`). Dùng cho bảng số TỰ DỰNG
   * (VD ghi thành phẩm). Bỏ trống ⇒ không đổi hành vi (form thường dùng Tab).
   */
  navCol?: string;
  className?: string;
}) {
  const { props: o, xemTruoc: preview } = useNumberInput({ value, onChange });

  const stepBy = (delta: number) => onChange(Math.max(0, (value ?? 0) + delta));

  const input = (
    <div className="relative">
      <NumberInputInField
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="tnum text-right"
        placeholder={placeholder}
        value={o.value}
        data-navcol={navCol || undefined}
        onKeyDown={(e) => {
          o.onKeyDown(e);
          if (navCol && !e.defaultPrevented) navigateNumberColumn(e, navCol);
        }}
        onFocus={o.onFocus}
        onChange={o.onChange}
        onBlur={o.onBlur}
      />
      <ExpressionPreview preview={preview} unit={unit} />
    </div>
  );

  return (
    <Field
      label={label}
      required={required}
      hint={hint}
      error={error}
      unit={step ? undefined : unit}
      hideRequiredMark={hideRequiredMark}
      hideLabel={hideLabel}
      nestedInput
      className={className}
    >
      {step ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Giảm ${label}`}
            onClick={() => stepBy(-step)}
          >
            <Minus />
          </Button>
          <div className="min-w-0 flex-1">{input}</div>
          <span className="shrink-0 text-sm font-medium whitespace-nowrap text-muted-foreground">
            {unit}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Tăng ${label}`}
            onClick={() => stepBy(step)}
          >
            <Plus />
          </Button>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
