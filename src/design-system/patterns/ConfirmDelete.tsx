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
  moTaBanGhi,
  onConfirm,
  tieuDe = "Xóa dòng này?",
  nhanNut = "Xóa dòng",
  trigger,
}: {
  /** Mô tả bản ghi sắp xóa — hiện nguyên văn trong hộp thoại */
  moTaBanGhi: string;
  onConfirm: () => void;
  tieuDe?: string;
  nhanNut?: string;
  trigger?: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Trash2 />
            Xóa
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{tieuDe}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">
            Sắp xóa:
            <span className="mt-2 block rounded-lg bg-muted px-4 py-3 text-base font-semibold text-foreground">
              {moTaBanGhi}
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
            {nhanNut}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
