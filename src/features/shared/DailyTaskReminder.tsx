// ============================================================
// Tên file: src/features/shared/DailyTaskReminder.tsx
// Nhắc việc-hằng-ngày (daily-task) — 2 giao diện bộ phận, họp 2026-08-22.
// Presentational: màn tự tính `daChot` (hôm nay đã chốt chưa) rồi truyền vào.
// ============================================================
import { BellRing, CircleCheck } from "lucide-react";

export function DailyTaskReminder({ isLocked, task }: { isLocked: boolean; task: string }) {
  return isLocked ? (
    <div className="enter-up flex items-center gap-2 rounded-xl border-2 border-border bg-muted/30 px-4 py-3 text-base text-muted-foreground">
      <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden />
      <span>Hôm nay đã chốt — {task}</span>
    </div>
  ) : (
    <div className="enter-up flex items-center gap-2 rounded-xl border-2 border-primary/40 bg-accent/40 px-4 py-3 text-base font-medium text-foreground">
      <BellRing className="size-5 shrink-0 text-primary" aria-hidden />
      <span>Việc hôm nay: {task}</span>
    </div>
  );
}
