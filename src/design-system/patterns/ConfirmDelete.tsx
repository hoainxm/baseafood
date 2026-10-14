import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

/**
 * ConfirmDelete — cổng bắt buộc trước MỌI thao tác xóa.
 *
 * Luật:
 *  - Nêu ĐÍCH DANH bản ghi sắp mất ("Bạch tuộc 2 da — 250 kg — đại lý H.Phú"),
 *    không hỏi chung chung "Bạn có chắc không?".
 *  - Nút an toàn ("Không xóa") đứng TRƯỚC và là mặc định khi nhấn Esc.
 *  - Nút xóa đặc màu đỏ + icon + chữ, không phải icon trần.
 *  - Sau khi xóa, màn gọi phải bắn toast có nút Hoàn tác (xem notify.ts).
 */
export function ConfirmDelete({
  recordDescription,
  onConfirm,
  title = "Xóa dòng này?",
  confirmLabel = "Xóa dòng",
  trigger,
}: {
  /** Mô tả bản ghi sắp xóa — hiện nguyên văn trong hộp thoại */
  recordDescription: string;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
  trigger?: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="danger"
            size="sm"
            title="Xóa bản ghi này. Có hỏi xác nhận trước, và xóa xong vẫn còn nút Hoàn tác."
          >
            <Trash2 />
            Xóa
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">
            Sắp xóa:
            <span className="mt-2 block rounded-lg bg-muted px-4 py-3 text-base font-semibold text-foreground">
              {recordDescription}
            </span>
            <span className="mt-3 block text-base text-muted-foreground">
              Xóa xong vẫn hoàn tác được trong vài giây.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg">Không xóa</AlertDialogCancel>
          <AlertDialogAction variant="destructive" size="lg" onClick={onConfirm}>
            <Trash2 />
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
