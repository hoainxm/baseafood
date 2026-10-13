import * as React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RequiredLegend, useHasRequiredField } from "./Field";

/**
 * FormDialog — khung dialog/form CHUẨN cho toàn hệ thống.
 *
 * Mọi form thông tin/thao tác (hướng dẫn, tùy chỉnh giao diện, form nhập…) nên
 * dùng khung này để cùng một dáng: đầu cố định (icon + tiêu đề + mô tả), THÂN
 * CUỘN riêng (không đẩy nút xuống khuất), CHÂN cố định chứa nút hành động.
 *
 * - Rộng theo `rong` — form nhiều cột để "rong"/"xl" cho dễ nhìn.
 * - Thân cuộn dùng `scroll-nice` (thanh cuộn bám token), cao tối đa theo màn hình
 *   nên cỡ chữ 130% vẫn không tràn.
 * - Điều khiển được (`open`/`onOpenChange`) hoặc tự mở bằng `trigger`.
 */

const WIDTHS: Record<string, string> = {
  sm: "sm:max-w-md", // ~28rem — xác nhận ngắn
  vua: "sm:max-w-xl", // ~36rem
  rong: "sm:max-w-3xl", // ~48rem — mặc định form
  xl: "sm:max-w-5xl", // ~64rem — nhiều cột / bảng / chart
};

export function FormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  icon: Icon,
  size = "rong",
  footer,
  hasRequiredFields = false,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nút mở (bọc DialogTrigger asChild). Bỏ trống ⇒ dùng open/onOpenChange. */
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  size?: keyof typeof WIDTHS;
  /** Nút hành động ở chân (VD Hủy / Lưu). Bỏ trống ⇒ không có chân. */
  footer?: React.ReactNode;
  /** Ép hiện chú thích dấu * kể cả khi không dò thấy `aria-required`. */
  hasRequiredFields?: boolean;
  children: React.ReactNode;
}) {
  /* Tự dò ô bắt buộc trong thân form (`aria-required`) rồi mới hiện chú thích
     dấu * — không phải đi bật cờ ở từng chỗ gọi, và không bao giờ hiện thừa ở
     dialog chỉ để xem. */
  const thanRef = React.useRef<HTMLDivElement>(null);
  const hasRequiredField = useHasRequiredField(thanRef, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          // dvh, không vh: Safari iOS tính vh theo màn KHI ẨN thanh địa chỉ ⇒ 88vh cao
          // hơn phần nhìn thấy lúc xoay ngang, chân hộp (nút Lưu) lọt xuống dưới mép.
          "flex max-h-[min(88dvh,calc(100dvh-2rem))] flex-col items-stretch gap-0 overflow-hidden p-0 short-landscape:max-h-[calc(100dvh-1rem)]",
          WIDTHS[size]
        )}
      >
        {/* Đầu — cố định */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-6 py-4 short-landscape:py-2.5">
          {Icon && (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg leading-tight font-semibold text-foreground">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        {/* Thân — cuộn riêng */}
        <div
          ref={thanRef}
          className="scroll-nice min-h-0 flex-1 overflow-y-auto px-6 py-5 short-landscape:py-3"
        >
          {(hasRequiredFields || hasRequiredField) && <RequiredLegend className="mb-4" />}
          {children}
        </div>

        {/* Chân — cố định */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/40 px-6 py-3.5 short-landscape:py-2">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Nút "Đóng" tiện dụng cho chân FormDialog (đóng dialog gần nhất). */
export function CloseButton({ children = "Đóng" }: { children?: React.ReactNode }) {
  return (
    <DialogClose asChild>
      <Button variant="outline">{children}</Button>
    </DialogClose>
  );
}
