// ============================================================
// Tên file: src/design-system/patterns/HorizontalScroll.tsx
// Tên tiếng Việt: Khung cuộn ngang có thanh cuộn TRÊN + DƯỚI cho bảng tự dựng
// Description: Horizontal scroll frame with a synced top scrollbar
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { useTopScrollbar } from "./topScrollbar";

/**
 * Khung cuộn ngang cho BẢNG TỰ DỰNG ở features (bảng dùng chung `SummaryTable` /
 * `RecordTable` / `EditableGrid` đã có sẵn): thay cho `<div className="overflow-x-auto">`
 * — tự thêm thanh cuộn TRÊN khi bảng tràn (README § 5a), thanh dưới là thanh thật.
 * `className` = khung ngoài, `classNameKhung` = vùng cuộn (viền, bo góc…).
 */
export function HorizontalScroll({
  children,
  className,
  viewportClassName,
}: {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const scrollBar = useTopScrollbar(() => {
    const el = frameRef.current;
    if (!el) return null;
    // Bọc primitive `Table` ⇒ vùng cuộn thật là div table-container bên trong.
    return el.querySelector<HTMLElement>(':scope > [data-slot="table-container"]') ?? el;
  });
  return (
    <div className={cn("min-w-0", className)}>
      {scrollBar}
      <div ref={frameRef} className={cn("scroll-nice-x overflow-x-auto", viewportClassName)}>
        {children}
      </div>
    </div>
  );
}
