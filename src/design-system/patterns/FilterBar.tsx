import * as React from "react";
import { FilterX, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Field } from "./Field";

/**
 * FilterBar — khung bộ lọc của một sổ / bảng (ba-spec 53, README § Bộ lọc).
 * Hàng ô lọc (kỳ xem, đối tượng, trạng thái, ô tra) + khi có điều kiện đang bật: số dòng khớp và
 * "Bỏ hết bộ lọc (N)" (R6). Lọc là trình bày — không toast, không lưu (R8).
 */
export function FilterBar({
  children,
  activeCount = 0,
  onClearAll,
  resultText,
  className,
  ...rest
}: {
  children: React.ReactNode;
  /** Số điều kiện đang khác mặc định (KHÔNG tính kỳ xem) — `activeFilterCount` của lib/recordFilters. */
  activeCount?: number;
  /** Đưa mọi điều kiện về mặc định, giữ kỳ xem. */
  onClearAll?: () => void;
  /** VD "Đang hiện 12 / 40 phiếu" — chỉ hiện khi có điều kiện đang bật. */
  resultText?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    // grid-cols-[minmax(0,1fr)] + max-w-full: ô lọc có min-w cố định không đẩy khung tràn ngang ở 360 px × 130 %.
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border-2 border-border p-4", className)} {...rest}>
      <div className="flex min-w-0 flex-wrap items-end gap-4 [&>*]:max-w-full">{children}</div>
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {resultText && <span className="tnum text-sm text-muted-foreground">{resultText}</span>}
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              title="Bỏ mọi điều kiện lọc, về sổ đầy đủ của kỳ đang xem (kỳ giữ nguyên)."
            >
              <FilterX className="mr-1 h-4 w-4" aria-hidden />
              Bỏ hết bộ lọc ({activeCount})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SearchField — ô tra có NHÃN (luật 5: chữ mờ không thay nhãn). So khớp bỏ dấu ở
 * `matchesSearch` (lib/recordFilters). Nhãn nói rõ tra được gì: "Tra khách, mặt hàng, số phiếu".
 */
export function SearchField({
  label,
  value,
  onChange,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} hideRequiredMark className={cn("min-w-[14rem] flex-1", className)}>
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** R7: lọc ra 0 dòng (kỳ CÓ dòng) — khác lời "kỳ này chưa có dòng nào". */
export function NoMatchState({ onClearAll }: { onClearAll?: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      title="Không có dòng nào khớp bộ lọc"
      description="Đổi điều kiện lọc, hoặc bỏ hết bộ lọc để xem cả sổ của kỳ."
      action={
        onClearAll ? (
          <Button variant="outline" onClick={onClearAll} title="Bỏ mọi điều kiện lọc, về sổ đầy đủ của kỳ đang xem.">
            <FilterX className="mr-1 h-4 w-4" aria-hidden />
            Bỏ hết bộ lọc
          </Button>
        ) : undefined
      }
    />
  );
}
