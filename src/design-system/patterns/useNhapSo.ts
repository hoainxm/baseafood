// ============================================================
// Tên file: src/design-system/patterns/useNhapSo.ts
// Tên tiếng Việt: Hook hành vi ô nhập số dùng chung (số / biểu thức kiểu Excel)
// ============================================================
import * as React from "react";
import { dinhDangSo, laBieuThuc, parseSoHoacBieuThuc } from "./bieuThucSo";

/**
 * Hành vi chung của ô số:
 *  - Gõ số thường hoặc biểu thức ("250+300", "=12x5", "1000*5%").
 *  - Ra số hợp lệ là GHI NGAY (cột tổng nhảy theo phím). Biểu thức còn dở
 *    ("250+") thì CHƯA ghi — giữ số cũ, không ghi tạm 0/null làm mất số thật.
 *  - Rời ô: hiện lại số đã chốt, có dấu chấm phần nghìn.
 *  - Esc: trả về số lúc vừa bấm vào ô.
 *  - Đang gõ biểu thức: trả `xemTruoc` để hiện "= 550" ngay dưới ô.
 *  - `rong0`: số 0 hiện ô trống (ô lưới — đỡ rối mắt).
 */
export function useNhapSo({
  value,
  onChange,
  rong0 = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  rong0?: boolean;
}) {
  const [dangGo, setDangGo] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const goc = React.useRef<number | null>(value);

  const hienSo = (v: number | null) => (v == null || (rong0 && v === 0) ? "" : dinhDangSo(v));
  const laBT = dangGo && laBieuThuc(raw);
  const xemTruoc = laBT ? { ketQua: parseSoHoacBieuThuc(raw) } : null;

  const props = {
    value: dangGo ? raw : hienSo(value),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      goc.current = value;
      setRaw(hienSo(value));
      setDangGo(true);
      e.currentTarget.select();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = e.target.value;
      setRaw(t);
      if (t.trim() === "") {
        onChange(null); // xoá ô
        return;
      }
      const v = parseSoHoacBieuThuc(t);
      if (v != null) onChange(v);
    },
    onBlur: () => setDangGo(false),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && dangGo) {
        e.preventDefault();
        e.stopPropagation(); // đừng để Esc đóng luôn hộp thoại
        onChange(goc.current);
        setRaw(hienSo(goc.current));
      }
    },
  };

  return { props, xemTruoc, dangGo };
}

