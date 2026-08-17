import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Thẻ thông tin (KPI card) — thay cho việc nhồi mọi số vào một dòng chữ.
 *
 * Mỗi con số quan trọng đứng trong một thẻ riêng: nhãn nhỏ ở trên, số TO ở dưới,
 * icon màu để mắt bắt nhanh. Người 45–60 tuổi đọc "thẻ" nhanh hơn đọc một câu
 * dài gộp Ngày · Xưởng · Tổng. Màu chỉ để phân nhóm, luôn kèm nhãn chữ.
 */
export type MauThe = "brand" | "success" | "warning" | "danger" | "trung-tinh";

export interface TheThongTin {
  nhan: string;
  giaTri: React.ReactNode;
  /** Dòng phụ nhỏ dưới số (VD đơn vị, ghi chú). */
  phu?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  mau?: MauThe;
  /** Số → tabular-nums cho thẳng cột. */
  so?: boolean;
}

const MAU: Record<MauThe, { chip: string; vien: string }> = {
  brand: { chip: "bg-accent text-accent-foreground", vien: "border-border" },
  success: {
    chip: "bg-success-surface text-success",
    vien: "border-success/30",
  },
  warning: {
    chip: "bg-warning-surface text-warning",
    vien: "border-warning/30",
  },
  danger: { chip: "bg-destructive/10 text-destructive", vien: "border-destructive/30" },
  "trung-tinh": { chip: "bg-muted text-muted-foreground", vien: "border-border" },
};

const COT_LG: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function ThongKe({
  the,
  cot = 4,
  className,
}: {
  the: TheThongTin[];
  /** Số cột tối đa (màn rộng). Mặc định 4. */
  cot?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:gap-4",
        COT_LG[cot] ?? "lg:grid-cols-4",
        className
      )}
    >
      {the.map((t) => {
        const mau = MAU[t.mau ?? "brand"];
        const Icon = t.icon;
        const isString = typeof t.giaTri === "string";
        const isLong = isString && (t.giaTri as string).length > 12;
        // Không bao giờ xuống dưới text-sm (16px) — kể cả chuỗi dài trên điện thoại.
        const fontSizeClass = t.so
          ? "text-xl md:text-2xl"
          : isLong
            ? "text-sm font-semibold leading-snug lg:text-base"
            : "text-base md:text-lg lg:text-xl";

        return (
          <div
            key={t.nhan}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 bg-card px-4 py-3",
              mau.vien
            )}
          >
            {Icon && (
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg",
                  mau.chip
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground break-words">
                {t.nhan}
              </p>
              <p
                className={cn(
                  "font-bold text-foreground break-words leading-tight",
                  fontSizeClass,
                  t.so && "tnum"
                )}
              >
                {t.giaTri}
              </p>
              {t.phu && (
                <p className="text-sm text-muted-foreground break-words">{t.phu}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
