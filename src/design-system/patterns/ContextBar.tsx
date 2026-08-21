import * as React from "react";
import { cn } from "@/lib/utils";

export interface MucNguCanh {
  nhan: string;
  giaTri: React.ReactNode;
  /** Số → tabular-nums */
  so?: boolean;
}

/**
 * ContextBar — thanh dính "tôi đang ở đâu, đang làm cho ngày nào".
 *
 * Luôn hiện: Ngày · Phân xưởng · Tổng đã nhập — giữ bối cảnh khi nhập lâu.
 * Giá trị để text-lg cho nổi, đây là chỗ dễ đọc nhầm nhất.
 */
export function ContextBar({
  items,
  actions,
  className,
}: {
  items: MucNguCanh[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        /* Không dùng lề âm: nội dung đã bị giới hạn bề rộng nên lề âm
           kéo thanh này lệch khỏi cột, trông vênh so với phần dưới. */
        "sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 backdrop-blur",
        className
      )}
    >
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((m) => (
          <div key={m.nhan} className="flex items-baseline gap-2">
            <dt className="text-sm text-muted-foreground">{m.nhan}</dt>
            <dd
              className={cn(
                "text-lg font-semibold text-foreground",
                m.so && "tnum"
              )}
            >
              {m.giaTri}
            </dd>
          </div>
        ))}
      </dl>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
