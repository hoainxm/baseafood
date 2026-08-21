import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chỉ báo "hệ thống đang suy nghĩ" — thay spinner khô khan bằng thứ mềm hơn.
 *
 *  - `ThinkingDots`: ba chấm nhấp nháy so le (bám màu chữ hiện tại).
 *  - `DangXuLy`: khối giữa vùng trống, dùng khi chờ tải/đang xử lý cả màn.
 *  - `SkeletonBang`: khung xương của một bảng danh sách trong lúc dữ liệu về —
 *    tránh chớp "Chưa có dữ liệu" rồi mới nhảy ra danh sách.
 *
 * Mọi hiệu ứng chỉ dùng opacity nên nhẹ máy; người đặt hệ điều hành "giảm
 * chuyển động" sẽ thấy khối đứng yên (luật ở tokens.css).
 */

/** Ba chấm "đang suy nghĩ" — nhấp nháy so le. `bg-current` nên ăn theo màu chữ. */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${i * 180}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}

/** Khối "đang xử lý" giữa vùng trống — chờ tải cả màn hoặc tác vụ dài. */
export function DangXuLy({
  chu = "Đang xử lý…",
  className,
}: {
  chu?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      <ThinkingDots className="text-primary [&>span]:size-2.5" />
      <p className="text-sm font-medium text-muted-foreground">{chu}</p>
    </div>
  );
}

/** Khung xương của một bảng danh sách (RecordTable) trong lúc dữ liệu đang về. */
export function SkeletonBang({
  dong = 5,
  className,
}: {
  dong?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Đang tải danh sách"
      className={cn("space-y-4", className)}
    >
      {/* thanh công cụ giả */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* bảng giả */}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Skeleton className="h-11 rounded-none" />
        <div className="divide-y divide-border">
          {Array.from({ length: dong }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
