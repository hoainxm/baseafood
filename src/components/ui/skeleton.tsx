import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton — khối giả lập nội dung đang tải. Nhấp nháy nhẹ (animate-pulse,
 * chỉ opacity nên nhẹ máy). Người đặt "giảm chuyển động" thì đứng yên.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
