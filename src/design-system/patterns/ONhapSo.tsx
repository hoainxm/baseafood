// ============================================================
// Tên file: src/design-system/patterns/ONhapSo.tsx
// Tên tiếng Việt: Lõi ô nhập số dùng chung — gõ số hoặc biểu thức kiểu Excel
// MỌI ô số trong app đi qua đây (NumberField, ô lưới LuoiNhap, ô số trần).
// ============================================================
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { dinhDangSo } from "./bieuThucSo";
import { useNhapSo } from "./useNhapSo";

/**
 * Nhãn nổi "= 550" ngay dưới ô khi đang gõ biểu thức. Đưa ra `document.body`
 * (portal) + `fixed` theo toạ độ ô để KHÔNG bị khung cuộn của bảng
 * (`overflow-x-auto`) hay hộp thoại (có `transform`) cắt/lệch, cũng không đẩy
 * dòng bảng nhảy cao thấp. Mốc toạ độ = phần tử cha của mốc ẩn (khung ô).
 */
export function XemTruocBieuThuc({
  xemTruoc,
  donVi,
}: {
  xemTruoc: { ketQua: number | null } | null;
  donVi?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [viTri, setViTri] = React.useState<{ top: number; right: number } | null>(null);
  const hien = xemTruoc != null;

  React.useLayoutEffect(() => {
    if (!hien) return;
    const cha = ref.current?.parentElement;
    if (!cha) return;
    const dat = () => {
      const r = cha.getBoundingClientRect();
      setViTri({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    dat();
    window.addEventListener("scroll", dat, true);
    window.addEventListener("resize", dat);
    return () => {
      window.removeEventListener("scroll", dat, true);
      window.removeEventListener("resize", dat);
    };
  }, [hien]);

  const { ketQua } = xemTruoc ?? { ketQua: null };
  return (
    <>
      <span ref={ref} hidden />
      {hien &&
        viTri &&
        createPortal(
          <span
            role="status"
            aria-live="polite"
            style={{ top: viTri.top, right: viTri.right }}
            className={cn(
              "tnum pointer-events-none fixed z-[100] rounded-md border px-2 py-0.5 text-sm font-semibold whitespace-nowrap shadow-sm",
              ketQua == null
                ? "border-border bg-popover text-muted-foreground"
                : "border-primary/40 bg-popover text-foreground"
            )}
          >
            {ketQua == null
              ? "Đang gõ phép tính…"
              : `= ${dinhDangSo(ketQua)}${donVi ? ` ${donVi}` : ""}`}
          </span>,
          document.body
        )}
    </>
  );
}

/**
 * Ô số TRẦN (không nhãn, không Field) — dùng khi cần ô số ở chỗ đã có nhãn riêng
 * (ô trong bảng tự dựng, thanh cấu hình). Có nhãn thì dùng `NumberField`.
 */
export const ONhapSo = React.forwardRef<
  HTMLInputElement,
  {
    value: number | null;
    onChange: (v: number | null) => void;
    donVi?: string;
    rong0?: boolean;
    className?: string;
    khungClassName?: string;
  } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "defaultValue"
  >
>(function ONhapSo(
  { value, onChange, donVi, rong0, className, khungClassName, onKeyDown, onFocus, onBlur, ...rest },
  ref
) {
  const { props, xemTruoc } = useNhapSo({ value, onChange, rong0 });
  return (
    <span className={cn("relative block", khungClassName)}>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        {...rest}
        value={props.value}
        onChange={props.onChange}
        onFocus={(e) => {
          props.onFocus(e);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          props.onBlur();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          props.onKeyDown(e);
          if (!e.defaultPrevented) onKeyDown?.(e);
        }}
        className={cn("tnum text-right", className)}
      />
      <XemTruocBieuThuc xemTruoc={xemTruoc} donVi={donVi} />
    </span>
  );
});
