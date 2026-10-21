// ============================================================
// Tên file cũ: src/design-system/patterns/GuideButton.tsx
// Tên tiếng Việt: Nút mở hướng dẫn sử dụng
// Description: Help Guide Trigger Button
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { HelpCircle, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onStartTour,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Trang có hướng dẫn thao tác (GuidedTour) ⇒ đầu hộp có lối bắt đầu. */
  onStartTour?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Hướng dẫn: ${title}`}
      description={description}
      icon={HelpCircle}
      size="lg"
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
        {onStartTour && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent px-4 py-3 text-accent-foreground">
            <p className="min-w-0 flex-1 basis-56 text-sm">Hướng dẫn thao tác chỉ lần lượt từng khu vực trên trang này theo thứ tự công việc. Hướng dẫn không thay đổi dữ liệu.</p>
            <Button
              data-tour-start
              onClick={() => {
                setOpen(false);
                // Đợi hộp đóng xong rồi mới phủ lớp tour (khỏi tranh tiêu điểm với hộp).
                window.setTimeout(onStartTour, 200);
              }}
              title="Bắt đầu hướng dẫn thao tác trên trang này."
            >
              <Route aria-hidden />
              Bắt đầu hướng dẫn thao tác
            </Button>
          </div>
        )}
        {children}
      </div>
    </FormDialog>
  );
}
