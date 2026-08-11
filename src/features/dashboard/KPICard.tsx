// src/features/dashboard/KPICard.tsx
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPICard — thẻ chỉ số có viền trái 4px màu, số lớn font mono, so sánh với hôm
 * qua. Bấm được để mở chi tiết. Dáng lấy từ kpiCard của prototype (TheKPI).
 */
export interface SoSanh {
  tang: boolean;
  tot: boolean;
  chu: string;
}

export function KPICard({
  nhan,
  giaTri,
  phu,
  vienClass,
  soSanh,
  icon: Icon,
  onClick,
  children,
}: {
  nhan: string;
  giaTri: string;
  phu?: string;
  /** Class màu viền trái, VD "border-l-primary", "border-l-destructive". */
  vienClass: string;
  soSanh?: SoSanh;
  icon: LucideIcon;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[132px] flex-col gap-2.5 rounded-xl border-l-4 bg-card p-5 text-left ring-1 ring-foreground/10 transition-shadow hover:ring-2 hover:ring-primary/30",
        vienClass
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{nhan}</span>
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      </span>

      <span className="flex items-end gap-3">
        <span className="font-mono text-3xl font-bold leading-none tnum">
          {giaTri}
        </span>
        {children}
      </span>

      {phu && <span className="text-sm text-muted-foreground">{phu}</span>}

      {soSanh && (
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-semibold",
            soSanh.tot ? "text-success" : "text-destructive"
          )}
        >
          {soSanh.tang ? (
            <ArrowUp className="size-4" aria-hidden />
          ) : (
            <ArrowDown className="size-4" aria-hidden />
          )}
          {soSanh.chu}
          <span className="font-normal text-muted-foreground">so hôm qua</span>
        </span>
      )}
    </button>
  );
}
