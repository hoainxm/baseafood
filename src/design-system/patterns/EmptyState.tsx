import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/**
 * EmptyState — màn trống phải NÓI VIỆC TIẾP THEO, không chỉ báo "không có dữ liệu".
 * Chữ 18px, màu muted-foreground đạt 7.4:1 (không dùng slate-400 như bản cũ).
 */
export function EmptyState({
  icon: Icon = Inbox,
  tieuDe,
  moTa,
  action,
}: {
  icon?: LucideIcon;
  tieuDe: string;
  moTa?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
      <Icon className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <p className="mt-4 text-xl font-semibold text-foreground">{tieuDe}</p>
      {moTa && (
        <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
          {moTa}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
