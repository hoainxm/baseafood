// src/features/dashboard/CanhBao.tsx
import { cn } from "@/lib/utils";
import { DASH_MUC_NHAN, type CanhBaoItem, type MucCanhBao } from "./duLieu";

/**
 * CanhBao — danh sách cảnh báo gần đây. Bấm một cảnh báo để xem chi tiết và xác
 * nhận đã nhận. Mức nghiêm trọng thể hiện bằng viền trái + chấm màu + nhãn chữ.
 */

const MUC_VIEN: Record<MucCanhBao, string> = {
  stopped: "border-l-status-stopped",
  idle: "border-l-status-idle",
  changeover: "border-l-status-changeover",
};

const MUC_CHAM: Record<MucCanhBao, string> = {
  stopped: "bg-status-stopped",
  idle: "bg-status-idle",
  changeover: "bg-status-changeover",
};

export function CanhBao({
  alerts,
  daNhan,
  onChon,
}: {
  alerts: CanhBaoItem[];
  daNhan: string[];
  onChon: (a: CanhBaoItem) => void;
}) {
  return (
    <ul className="grid list-none gap-2.5 p-0">
      {alerts.map((a) => {
        const xong = daNhan.includes(a.id);
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onChon(a)}
              className={cn(
                "flex min-h-16 w-full items-start gap-3 rounded-lg border-2 border-l-4 border-border px-3.5 py-3 text-left transition-colors hover:bg-muted",
                MUC_VIEN[a.muc],
                xong ? "bg-muted" : "bg-background"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-3 shrink-0 rounded-full",
                  MUC_CHAM[a.muc]
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold">{a.gio}</span>
                  <span>· {DASH_MUC_NHAN[a.muc]}</span>
                  {xong && (
                    <span className="font-semibold text-success">· đã nhận</span>
                  )}
                </span>
                <span className="mt-0.5 block text-base font-medium leading-snug text-foreground">
                  {a.chu}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
