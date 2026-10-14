// ============================================================
// Tên file: src/design-system/patterns/useNumberInput.ts
// Tên tiếng Việt: Hook hành vi ô nhập số dùng chung (số / biểu thức kiểu Excel)
// ============================================================
import * as React from "react";
import { formatNumber, isExpression, parseNumberOrExpression } from "./numberExpression";

/**
 * Hành vi chung của ô số:
 *  - Gõ số thường hoặc biểu thức ("250+300", "=12x5", "1000*5%").
 *  - Ra số hợp lệ là GHI NGAY (cột tổng nhảy theo phím). Biểu thức còn dở
 *    ("250+") thì CHƯA ghi — giữ số cũ, không ghi tạm 0/null làm mất số thật.
 *  - Rời ô: hiện lại số đã chốt, có dấu chấm phần nghìn.
 *  - Esc: trả về số lúc vừa bấm vào ô.
 *  - Đang gõ biểu thức: trả `preview` để hiện "= 550" ngay dưới ô.
 *  - `rong0`: số 0 hiện ô trống (ô lưới — đỡ rối mắt).
 */
export function useNumberInput({
  value,
  onChange,
  emptyIsZero: rong0 = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  emptyIsZero?: boolean;
}) {
  const [isTyping, setIsTyping] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const rawValue = React.useRef<number | null>(value);

  const displayNumber = (v: number | null) => (v == null || (rong0 && v === 0) ? "" : formatNumber(v));
  const laBT = isTyping && isExpression(raw);
  const preview = laBT ? { result: parseNumberOrExpression(raw) } : null;

  const props = {
    value: isTyping ? raw : displayNumber(value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      rawValue.current = value;
      setRaw(displayNumber(value));
      setIsTyping(true);
      e.currentTarget.select();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value;
      setRaw(t);
      if (t.trim() === "") {
        onChange(null); // xoá ô
        return;
      }
      const v = parseNumberOrExpression(t);
      if (v != null) onChange(v);
    },
    onBlur: () => setIsTyping(false),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && isTyping) {
        e.preventDefault();
        e.stopPropagation(); // đừng để Esc đóng luôn hộp thoại
        onChange(rawValue.current);
        setRaw(displayNumber(rawValue.current));
      }
    },
  };

  return { props, preview, isTyping };
}

