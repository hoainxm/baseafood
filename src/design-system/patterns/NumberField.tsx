import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "./Field";
import { Minus, Plus } from "lucide-react";

/** "1.234,5" | "1234.5" | "1 234,5" → 1234.5 ; rỗng/không hợp lệ → null */
export function parseSo(raw: string): number | null {
  const s = raw.replace(/[\s.]/g, "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1.234,5" (vi-VN) */
export function dinhDangSo(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
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
  anNhanBatBuoc = false,
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
  anNhanBatBuoc?: boolean;
  className?: string;
}) {
  const [raw, setRaw] = React.useState(() => dinhDangSo(value));
  const [dangGo, setDangGo] = React.useState(false);

  // Đồng bộ khi giá trị bị đổi từ bên ngoài (reset form, nạp bản ghi để sửa).
  React.useEffect(() => {
    if (!dangGo) setRaw(dinhDangSo(value));
  }, [value, dangGo]);

  const buoc = (delta: number) => {
    const next = Math.max(0, (value ?? 0) + delta);
    onChange(next);
    setRaw(dinhDangSo(next));
  };

  const input = (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="tnum text-right"
      placeholder={placeholder}
      value={raw}
      onFocus={() => setDangGo(true)}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parseSo(e.target.value));
      }}
      onBlur={() => {
        setDangGo(false);
        setRaw(dinhDangSo(parseSo(raw)));
      }}
    />
  );

  return (
    <Field
      label={label}
      required={required}
      hint={hint}
      error={error}
      unit={step ? undefined : unit}
      anNhanBatBuoc={anNhanBatBuoc}
      className={className}
    >
      {step ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Giảm ${label}`}
            onClick={() => buoc(-step)}
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
            onClick={() => buoc(step)}
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
