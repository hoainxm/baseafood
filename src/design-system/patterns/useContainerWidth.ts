// ============================================================
// Tên tiếng Việt: Đo bề rộng khung chứa biểu đồ
// Description: ResizeObserver width hook for SVG charts
// ============================================================
import { useEffect, useRef, useState } from "react";

/**
 * Bề rộng thật (px) của khung chứa — để biểu đồ SVG vẽ ĐÚNG cỡ khung thay vì phóng
 * to/thu nhỏ một viewBox cố định (thu viewBox là thu luôn chữ trục). Không nhỏ hơn
 * `toiThieu`: khung hẹp hơn thì khung ngoài cuộn ngang có chủ đích (README §5a).
 */
export function useBeRongKhung<T extends HTMLElement>(minWidth: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(minWidth);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      if (w > 0) setWidth(Math.max(minWidth, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);
  return { ref, rong: width };
}
