// ============================================================
// Tên file cũ: src/features/dashboard/TrangThaiLine.tsx
// Tên tiếng Việt: Trạng thái Dây chuyền sản xuất
// Description: Production Line Status Widget
// ============================================================
// src/features/dashboard/TrangThaiLine.tsx
import { StatusChip } from "@/design-system";
import type { DayChuyen } from "./mockDashboardData";

/**
 * TrangThaiLine — danh sách dây chuyền + trạng thái, bấm một dòng để xem OEE tách
 * ba yếu tố. Mỗi dòng: tên · StatusChip · nhãn+giá trị metric bên phải.
 */
export function TrangThaiLine({
  lines,
  onChon,
}: {
  lines: DayChuyen[];
  onChon: (line: DayChuyen) => void;
}) {
  return (
    <ul className="grid list-none gap-2.5 p-0">
      {lines.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onChon(l)}
            className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border-2 border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-foreground">
                {l.ten}
              </span>
              <span className="mt-1 block">
                <StatusChip trangThai={l.trang} />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-muted-foreground">
                {l.metricNhan}
              </span>
              <span className="block font-mono text-base font-bold tnum">
                {l.metric}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
