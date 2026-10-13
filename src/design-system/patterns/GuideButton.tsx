// ============================================================
// Tên file cũ: src/design-system/patterns/GuideButton.tsx
// Tên tiếng Việt: Nút mở hướng dẫn sử dụng
// Description: Help Guide Trigger Button
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { FormDialog, CloseButton } from "./FormDialog";

/**
 * GuideButton — nút "?" ở header từng trang, mở hộp hướng dẫn dùng trang đó.
 *
 * Nội dung là JSX truyền vào (registry riêng theo route), viết theo giọng cho tổ
 * trưởng/thủ kho 45–60 tuổi: nói việc cần làm, không nói thuật ngữ. Trang nào
 * không có hướng dẫn (đăng nhập, quản trị) thì đơn giản là không render nút này.
 *
 * Dùng khung `FormDialog` chuẩn (đầu cố định · thân cuộn · chân có nút Đóng).
 */
export function GuideButton({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <FormDialog
      title={`Hướng dẫn: ${title}`}
      description={description}
      icon={HelpCircle}
      size="rong"
      footer={<CloseButton>Đã hiểu</CloseButton>}
      trigger={
        <button
          type="button"
          aria-label={`Hướng dẫn: ${title}`}
          title={`Hướng dẫn dùng ${title}`}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-foreground press-feedback hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className
          )}
        >
          <HelpCircle className="size-6" aria-hidden />
        </button>
      }
    >
      <div className="space-y-5 text-base leading-relaxed text-foreground">
        {children}
      </div>
    </FormDialog>
  );
}
