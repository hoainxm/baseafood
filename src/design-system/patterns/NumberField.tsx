import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "./Field";
import { XemTruocBieuThuc } from "./ONhapSo";
import { useNhapSo } from "./useNhapSo";
import { Minus, Plus } from "lucide-react";

// Lõi đọc số / tính biểu thức ở `bieuThucSo.ts` (hàm thuần, có test); hành vi
// ô (ghi theo phím, Esc, xem trước "= kết quả") ở `ONhapSo.tsx` — dùng chung
// với ô lưới `LuoiNhap`.

/**
 * Điều hướng bàn phím kiểu Excel cho ô số trong BẢNG tự dựng (không qua
 * `LuoiNhap`): ↑ / ↓ / Enter nhảy DỌC trong cùng một CỘT (`navCol`), Tab để
 * trình duyệt lo đi NGANG. "Cùng cột" = mọi input mang `data-navcol` giống nhau
 * trong khung `[data-luoi-phim]` gần nhất, theo THỨ TỰ DOM (= thứ tự dòng nhìn
 * thấy) nên không cần khai toạ độ (hàng,cột) — hợp bảng dòng động, có dòng tách.
 */
function dieuHuongCotSo(e: React.KeyboardEvent<HTMLInputElement>, col: string) {
  const k = e.key;
  if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter") return;
  const el = e.currentTarget;
  if (k === "Enter") e.preventDefault(); // đừng để Enter submit form khi đang nhập bảng
  const khung: ParentNode = el.closest("[data-luoi-phim]") ?? document;
  const dsO = Array.from(
    khung.querySelectorAll<HTMLInputElement>(`[data-navcol="${CSS.escape(col)}"]`)
  ).filter((o) => !o.disabled && o.offsetParent !== null); // bỏ ô ẩn (dòng tách chưa mở)
  const i = dsO.indexOf(el);
  if (i < 0) return;
  const dich = dsO[k === "ArrowUp" ? i - 1 : i + 1];
  if (dich) {
    e.preventDefault();
    dich.focus();
    dich.select();
  }
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
  anNhan = false,
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
  anNhanBatBuoc?: boolean;
  /** Giấu hẳn nhãn (aria-label), dùng trong bảng/lưới có tiêu đề cột. */
  anNhan?: boolean;
  /**
   * Bật điều hướng ↑/↓/Enter kiểu Excel: nhảy dọc trong CỘT cùng tên này (mọi
   * ô cùng `navCol` trong khung `[data-luoi-phim]`). Dùng cho bảng số TỰ DỰNG
   * (VD ghi thành phẩm). Bỏ trống ⇒ không đổi hành vi (form thường dùng Tab).
   */
  navCol?: string;
  className?: string;
}) {
  const { props: o, xemTruoc } = useNhapSo({ value, onChange });

  const buoc = (delta: number) => onChange(Math.max(0, (value ?? 0) + delta));

  const input = (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="tnum text-right"
        placeholder={placeholder}
        value={o.value}
        data-navcol={navCol || undefined}
        onKeyDown={(e) => {
          o.onKeyDown(e);
          if (navCol && !e.defaultPrevented) dieuHuongCotSo(e, navCol);
        }}
        onFocus={o.onFocus}
        onChange={o.onChange}
        onBlur={o.onBlur}
      />
      <XemTruocBieuThuc xemTruoc={xemTruoc} donVi={unit} />
    </div>
  );

  return (
    <Field
      label={label}
      required={required}
      hint={hint}
      error={error}
      unit={step ? undefined : unit}
      anNhanBatBuoc={anNhanBatBuoc}
      anNhan={anNhan}
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
