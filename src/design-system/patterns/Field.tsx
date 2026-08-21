import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Field — bọc mọi ô nhập.
 *
 * Luật:
 *  - Nhãn LUÔN hiện, nằm TRÊN ô, không bao giờ thay bằng placeholder
 *    (placeholder biến mất khi gõ → người lớn tuổi quên đang nhập ô gì).
 *  - Ô bắt buộc đánh dấu bằng **dấu * đỏ** sau nhãn; form đặt `ChuThichBatBuoc`
 *    ở đầu để giải nghĩa. Dấu * là `aria-hidden` — trình đọc màn hình nhận
 *    thông tin bắt buộc qua `aria-required` trên chính ô nhập, không đọc "sao".
 *    (Khác GOV.UK — quyết định của chủ dự án 2026-08-17 vì chip "Bắt buộc"
 *    lặp trên mọi hàng làm form rối mắt.)
 *  - Ô KHÔNG bắt buộc không ghi gì thêm.
 *  - Gợi ý (hint) nằm TRƯỚC ô, không phải sau.
 *  - Lỗi hiện ngay dưới nhãn, kèm icon + viền đỏ ở ô.
 */
/**
 * Chú thích giải nghĩa dấu *. Đặt MỘT lần ở đầu form / đầu thân dialog có ô bắt
 * buộc — dấu * không tự nói lên điều gì với người chưa quen ký hiệu.
 */
export function ChuThichBatBuoc({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Ô có dấu <span className="font-bold text-destructive">*</span> là bắt buộc.
    </p>
  );
}

/**
 * Dò xem trong một vùng DOM có ô bắt buộc không (`aria-required="true"`), để
 * form tự quyết định có hiện `ChuThichBatBuoc` hay không — khỏi phải bật cờ tay
 * ở từng chỗ gọi và không bao giờ hiện thừa.
 */
export function useCoOBatBuoc(
  ref: React.RefObject<HTMLElement | null>,
  deps: React.DependencyList = []
) {
  const [co, setCo] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) {
      setCo(false);
      return;
    }
    const kiem = () => setCo(!!el.querySelector('[aria-required="true"]'));
    kiem();
    const mo = new MutationObserver(kiem);
    mo.observe(el, { subtree: true, childList: true, attributes: true });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return co;
}

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
      // Dấu * chỉ là tín hiệu THỊ GIÁC (aria-hidden). Trình đọc màn hình lấy
      // thông tin bắt buộc từ đây.
      "aria-required": required && !anNhanBatBuoc ? true : undefined,
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
        <Label htmlFor={id}>
          {label}
          {!anNhanBatBuoc && required && (
            <span aria-hidden className="ml-1 font-bold text-destructive">
              *
            </span>
          )}
        </Label>
      </div>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errId}
          className="flex items-start gap-2 text-sm font-semibold text-destructive"
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
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium whitespace-nowrap text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
