// ============================================================
// Tên file: src/design-system/patterns/CuonNgang.tsx
// Tên tiếng Việt: Khung cuộn ngang có thanh cuộn TRÊN + DƯỚI cho bảng tự dựng
// Description: Horizontal scroll frame with a synced top scrollbar
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { useThanhCuonTren } from "./thanhCuonTren";

/**
 * Khung cuộn ngang cho BẢNG TỰ DỰNG ở features (bảng dùng chung `BangTong` /
 * `RecordTable` / `LuoiNhap` đã có sẵn): thay cho `<div className="overflow-x-auto">`
 * — tự thêm thanh cuộn TRÊN khi bảng tràn (README § 5a), thanh dưới là thanh thật.
 * `className` = khung ngoài, `classNameKhung` = vùng cuộn (viền, bo góc…).
 */
export function KhungCuonNgang({
  children,
  className,
  classNameKhung,
}: {
  children: React.ReactNode;
  className?: string;
  classNameKhung?: string;
}) {
  const khungRef = React.useRef<HTMLDivElement>(null);
  const thanh = useThanhCuonTren(() => {
    const el = khungRef.current;
    if (!el) return null;
    // Bọc primitive `Table` ⇒ vùng cuộn thật là div table-container bên trong.
    return el.querySelector<HTMLElement>(':scope > [data-slot="table-container"]') ?? el;
  });
  return (
    <div className={cn("min-w-0", className)}>
      {thanh}
      <div ref={khungRef} className={cn("scroll-nice-x overflow-x-auto", classNameKhung)}>
        {children}
      </div>
    </div>
  );
}
