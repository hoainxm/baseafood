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

/**
 * Tính biểu thức số học kiểu Excel trên chuỗi ĐÃ chuẩn hoá (chỉ còn số + toán tử
 * + - * / và ngoặc). Đệ quy giảm dần, tôn trọng ưu tiên nhân/chia và ngoặc.
 * KHÔNG dùng `eval`/`Function` — tự tách token nên an toàn với chuỗi bất kỳ.
 * Trả null khi chuỗi không hợp lệ (thừa ký tự, chia 0, ngoặc lệch).
 */
function danhGiaBieuThuc(s: string): number | null {
  let i = 0;
  const xem = () => s[i];
  const boQuaTrong = () => {
    while (s[i] === " ") i++;
  };

  function bieuThuc(): number | null {
    // cộng / trừ
    let v = hang();
    if (v == null) return null;
    boQuaTrong();
    while (xem() === "+" || xem() === "-") {
      const op = s[i++];
      const r = hang();
      if (r == null) return null;
      v = op === "+" ? v + r : v - r;
      boQuaTrong();
    }
    return v;
  }
  function hang(): number | null {
    // nhân / chia
    let v = thua();
    if (v == null) return null;
    boQuaTrong();
    while (xem() === "*" || xem() === "/") {
      const op = s[i++];
      const r = thua();
      if (r == null) return null;
      if (op === "/" && r === 0) return null; // chia 0
      v = op === "*" ? v * r : v / r;
      boQuaTrong();
    }
    return v;
  }
  function thua(): number | null {
    // dấu đơn / ngoặc / số
    boQuaTrong();
    if (xem() === "+") {
      i++;
      return thua();
    }
    if (xem() === "-") {
      i++;
      const v = thua();
      return v == null ? null : -v;
    }
    if (xem() === "(") {
      i++;
      const v = bieuThuc();
      boQuaTrong();
      if (xem() !== ")") return null;
      i++;
      return v;
    }
    let j = i;
    while (j < s.length && /[0-9.]/.test(s[j])) j++;
    if (j === i) return null;
    const num = Number(s.slice(i, j));
    i = j;
    return Number.isFinite(num) ? num : null;
  }

  const kq = bieuThuc();
  boQuaTrong();
  return i === s.length && kq != null && Number.isFinite(kq) ? kq : null;
}

/**
 * "1+2" → 3 · "1.000+250" → 1250 · "250,5*2" → 501 · "(3+4)*2" → 14.
 * Chỉ nhận diện là biểu thức khi có TOÁN TỬ ngoài dấu đầu (để "-5" hay "1.234,5"
 * vẫn là số thường). Số vi-VN: "." phân nghìn (bỏ), "," thập phân (→ ".").
 * Trả null nếu KHÔNG phải biểu thức hợp lệ ⇒ nơi gọi rơi về `parseSo`.
 */
export function tinhBieuThuc(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  if (!s) return null;
  if (!/[+\-*/()]/.test(s.slice(1))) return null; // không có toán tử ngoài dấu đầu
  if (!/^[-+*/().\d]+$/.test(s)) return null; // lẫn ký tự lạ ⇒ không tính
  return danhGiaBieuThuc(s);
}

/**
 * Ô số hiểu cả biểu thức: gõ "250+300" ra 550. Là biểu thức hợp lệ thì tính,
 * còn lại rơi về `parseSo` (số thường). Dùng cho `NumberField` và ô lưới.
 */
export function parseSoHoacBieuThuc(raw: string): number | null {
  const bt = tinhBieuThuc(raw);
  return bt != null ? bt : parseSo(raw);
}

/** 1234.5 → "1.234,5" (vi-VN) */
export function dinhDangSo(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

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
      data-navcol={navCol || undefined}
      onKeyDown={navCol ? (e) => dieuHuongCotSo(e, navCol) : undefined}
      onFocus={() => setDangGo(true)}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parseSoHoacBieuThuc(e.target.value));
      }}
      onBlur={() => {
        setDangGo(false);
        // Rời ô: chốt kết quả biểu thức ("250+300" → "550") rồi định dạng lại.
        setRaw(dinhDangSo(parseSoHoacBieuThuc(raw)));
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
