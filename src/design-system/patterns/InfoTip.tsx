import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * InfoTip — nút ⓘ nhỏ cạnh nhãn, bấm mở popover giải thích.
 *
 * Dùng để dời câu diễn giải dài ra khỏi thân form: nhãn tiêu đề vẫn LUÔN hiện
 * (không thay bằng placeholder), phần "vì sao / khi nào" gom vào đây cho gọn —
 * bấm mới xem. Nhờ vậy hai ô cùng một hàng không bị lệch chiều cao vì ô này có
 * câu giải thích dài hơn ô kia.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** Dùng cho screen-reader: "Giải thích: {label}" */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Giải thích: ${label}`}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className
          )}
        >
          <Info className="size-5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-base leading-snug">
        {children}
      </PopoverContent>
    </Popover>
  );
}
