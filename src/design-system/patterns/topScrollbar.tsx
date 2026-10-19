// ============================================================
// Tên file: src/design-system/patterns/topScrollbar.tsx
// Tên tiếng Việt: Hook thanh cuộn ngang TRÊN đầu bảng (đồng bộ với thanh dưới)
// Description: Hook rendering a top scrollbar synced with a table's horizontal scroller
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bảng rộng hơn màn hình: thanh cuộn ngang thật nằm ở ĐÁY bảng — bảng dài thì
 * phải cuộn xuống tận đáy mới kéo ngang được. Luật (README § 5a): bảng tràn ngang
 * có thanh cuộn ở CẢ TRÊN lẫn DƯỚI, đồng bộ hai chiều. Hook này trả về `thanh` —
 * thanh TRÊN dựng sẵn (null khi bảng không tràn), đặt ngay trên khung bảng; thanh
 * dưới là thanh thật của khung (hoặc thanh dính đáy của `SummaryTable fullHeight`).
 *
 * `layKhung` trả về phần tử ĐANG cuộn ngang (thường là `[data-slot=table-container]`
 * của primitive `Table`, hoặc chính div `overflow-x-auto` của bảng tự dựng).
 */
export function useTopScrollbar(getFrame: () => HTMLElement | null, className?: string) {
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const [tran, setTran] = React.useState(false);
  const [width, setWidth] = React.useState(0);

  // Tìm lại khung sau mỗi lần vẽ (`layKhung` là hàm mới mỗi lần vẽ) — bảng rỗng →
  // có dòng thì khung mới xuất hiện; chỉ đặt state khi đổi phần tử.
  React.useLayoutEffect(() => {
    // Phần tử DOM là "hệ thống ngoài" của React — đọc sau khi vẽ rồi mới gắn đo.
    const refindFrame = () => {
      const k = getFrame();
      setContainer((prev) => (prev === k ? prev : k));
    };
    refindFrame();
  }, [getFrame]);

  // Đo bề rộng cuộn + có tràn không, mỗi khi khung / bảng đổi cỡ.
  React.useLayoutEffect(() => {
    if (!container) return;
    const remeasure = () => {
      const sw = container.scrollWidth;
      setWidth((prev) => (Math.abs(prev - sw) < 1 ? prev : sw));
      setTran(sw > container.clientWidth + 1);
    };
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(container);
    for (const child of Array.from(container.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [container]);

  // Đồng bộ hai chiều. Gán scrollLeft bằng giá trị đang có thì trình duyệt không
  // bắn sự kiện ⇒ không vòng lặp.
  React.useEffect(() => {
    const top = topBarRef.current;
    if (!container || !top || !tran) return;
    const syncFromFrame = () => {
      if (top.scrollLeft !== container.scrollLeft) top.scrollLeft = container.scrollLeft;
    };
    const syncFromTop = () => {
      if (container.scrollLeft !== top.scrollLeft) container.scrollLeft = top.scrollLeft;
    };
    container.addEventListener("scroll", syncFromFrame, { passive: true });
    top.addEventListener("scroll", syncFromTop, { passive: true });
    syncFromFrame();
    return () => {
      container.removeEventListener("scroll", syncFromFrame);
      top.removeEventListener("scroll", syncFromTop);
    };
  }, [container, tran]);

  return tran ? (
    <div
      ref={topBarRef}
      aria-hidden
      title="Kéo để cuộn bảng sang ngang (thanh này chạy cùng thanh cuộn dưới đáy bảng)."
      // contain: inline-size — vạch đệm bên trong (rộng bằng bảng) KHÔNG được đòi bề rộng cho khung
      // chứa: khối co theo nội dung (bảng Cân đối A–L) sẽ nở theo vạch ⇒ bảng w-full nở theo ⇒
      // vòng lặp tới hết hàng (lỗi 2026-10-19). Thanh vẫn rộng đúng bằng khung như cũ.
      className={cn("table-scrollbar mb-1 [contain:inline-size] print:hidden", className)}
    >
      <div style={{ width, height: 1 }} />
    </div>
  ) : null;
}
