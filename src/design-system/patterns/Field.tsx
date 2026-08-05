import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Field — bọc mọi ô nhập.
 *
 * Luật (GOV.UK Design System):
 *  - Nhãn LUÔN hiện, nằm TRÊN ô, không bao giờ thay bằng placeholder
 *    (placeholder biến mất khi gõ → người lớn tuổi quên đang nhập ô gì).
 *  - Ô bắt buộc ghi chữ "Bắt buộc", không dùng dấu * (người dùng không quen
 *    ký hiệu, và trình đọc màn hình đọc "sao").
 *  - Gợi ý (hint) nằm TRƯỚC ô, không phải sau.
 *  - Lỗi hiện ngay dưới nhãn, kèm icon + viền đỏ ở ô.
 */
export function Field({
  label,
  required,
  hint,
  error,
  unit,
  anNhanBatBuoc = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Đơn vị hiện chìm bên phải trong ô, vd "kg", "đ", "%" */
  unit?: string;
  /** Ẩn nhãn "Bắt buộc / (không bắt buộc)" — dùng khi đây là BỘ LỌC hoặc ô sửa nhanh. */
  anNhanBatBuoc?: boolean;
  className?: string;
  children: React.ReactElement;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  const describedBy =
    [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") ||
    undefined;

  /* Đơn vị dài ngắn khác nhau ("kg" vs "đ/USD") nên KHÔNG dùng padding cố định —
     đo bề rộng chữ đơn vị rồi chừa đúng chỗ, tránh số đè lên đơn vị. */
  const unitRef = React.useRef<HTMLSpanElement>(null);
  const [chuaCho, setChuaCho] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!unit) {
      setChuaCho(0);
      return;
    }
    const el = unitRef.current;
    if (!el) return;
    const do1 = () => setChuaCho(el.offsetWidth + 24);
    do1();
    // Đổi cỡ chữ hệ thống → đo lại
    const ro = new ResizeObserver(do1);
    ro.observe(el);
    return () => ro.disconnect();
  }, [unit]);

  const child = React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    {
      id,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
      className: (children.props as { className?: string }).className,
      style: {
        ...((children.props as { style?: React.CSSProperties }).style ?? {}),
        ...(chuaCho ? { paddingRight: chuaCho } : {}),
      },
    }
  );

  return (
    /* flex-col + h-full + mt-auto ở ô nhập: nhãn LUÔN thẳng hàng trên cùng,
       ô nhập LUÔN thẳng hàng dưới cùng — kể cả khi ô bên cạnh có thêm dòng gợi ý
       (VD "Số lượng" cạnh "Đơn giá" có hint → trước đây hai ô lệch nhau). */
    <div className={cn("flex h-full flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {anNhanBatBuoc ? null : required ? (
          <span className="rounded bg-secondary px-2 py-0.5 text-sm font-semibold text-secondary-foreground">
            Bắt buộc
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">(không bắt buộc)</span>
        )}
      </div>

      {hint && (
        <p id={hintId} className="text-base text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errId}
          className="flex items-start gap-2 text-base font-semibold text-destructive"
        >
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}

      <div className="relative mt-auto">
        {child}
        {unit && (
          <span
            ref={unitRef}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base font-medium whitespace-nowrap text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
