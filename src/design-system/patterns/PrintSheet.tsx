// ============================================================
// Tên file: src/design-system/patterns/PrintSheet.tsx
// Tên tiếng Việt: Khung phiếu in A4 dùng chung (báo cáo)
// Description: Reusable A4 print sheet overlay + print table cells
// ============================================================
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

/**
 * PhieuIn — khung bản in A4 NGANG dùng chung cho các màn Báo cáo.
 *
 * Là lớp phủ toàn màn (`fixed inset-0`) nền trắng; khi bấm "In / Xuất PDF" thì
 * `@media print` (src/index.css) chỉ in vùng `.print-root`, ẩn thanh công cụ
 * `.no-print` và phần app còn lại. Toàn bộ style riêng cho bản in (slate, IN HOA,
 * cỡ nhỏ) nằm Ở ĐÂY (tầng design-system) để màn nghiệp vụ không phải viết
 * `text-xs`/`uppercase` — đúng ranh giới của CLAUDE.md §3.
 */
export function PhieuIn({
  tieuDe,
  phuDe,
  onClose,
  children,
}: {
  tieuDe: string;
  phuDe?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="print-root print-landscape fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10">
      <div className="no-print mx-auto mb-5 flex max-w-6xl items-center justify-between gap-4">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> In / Xuất PDF
        </Button>
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="text-sm font-semibold uppercase leading-tight">
          <div>Công ty TNHH Basefood I</div>
          <div>Xí nghiệp BSF1 — Bà Rịa</div>
        </div>
        <div className="mt-2 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{tieuDe}</h1>
          {phuDe ? <p className="text-sm font-semibold uppercase">{phuDe}</p> : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Ô tiêu đề bảng in (nền xám nhạt, IN HOA, viền). */
export function ThIn({
  children,
  right,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`border border-slate-400 bg-slate-100 px-2 py-1 text-xs font-semibold uppercase ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

/** Ô dữ liệu bảng in. `dam` = dòng cộng/tổng (in đậm + viền trên rõ). */
export function TdIn({
  children,
  right,
  dam,
  rowSpan,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  dam?: boolean;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-400 px-2 py-1 text-sm ${right ? "text-right" : "text-left"} ${
        dam ? "bg-slate-50 font-bold" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
