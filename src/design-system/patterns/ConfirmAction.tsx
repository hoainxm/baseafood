// ============================================================
// Tên file: src/design-system/patterns/ConfirmAction.tsx
// Tên tiếng Việt tương đương: Hộp xác nhận thao tác hệ trọng
// Description: Confirmation dialog for consequential (non-delete) actions
// ============================================================
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
import type { LucideIcon } from "lucide-react";

/**
 * XacNhan — cổng hỏi lại trước thao tác HỆ TRỌNG không phải xóa
 * (đăng xuất, chốt sổ, ghi đè dữ liệu, bỏ dữ liệu đang xem…).
 *
 * KHI NÀO DÙNG — chỉ 3 nhóm:
 *  1. Mất việc đang làm (đăng xuất, bỏ dữ liệu vừa nạp).
 *  2. Ghi đè / thay dữ liệu đang có.
 *  3. Khóa sổ, đổi trạng thái khó quay đầu (chốt ngày, chốt kỳ).
 *
 * KHI NÀO KHÔNG DÙNG: thao tác lưu thường ngày. Tổ trưởng ghi 30 chuyến/ngày mà
 * mỗi lần Lưu lại hỏi "Bạn có chắc?" thì họ bấm Đồng ý theo phản xạ — hộp xác
 * nhận mất hết tác dụng ở đúng lúc cần. Lưu thường dùng toast + Hoàn tác.
 *
 * Luật trình bày (giống ConfirmDelete):
 *  - Tiêu đề là CÂU HỎI nêu đích danh việc sắp làm, không "Bạn có chắc không?".
 *  - Nói rõ HỆ QUẢ: mất gì, khóa gì, còn sửa được không.
 *  - Nút an toàn đứng TRƯỚC và là mặc định khi nhấn Esc.
 */
export function XacNhan({
  tieuDe,
  moTa,
  chiTiet,
  nhanNut,
  nhanHuy = "Quay lại",
  nguyHiem = false,
  icon: Icon,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: {
  /** Câu hỏi nêu đích danh việc sắp làm. VD "Đăng xuất khỏi máy này?" */
  tieuDe: string;
  /** Hệ quả của thao tác — luôn nói rõ mất gì / khóa gì. */
  moTa: React.ReactNode;
  /** Số liệu hoặc tên bản ghi cụ thể, hiện trong khối nền xám. */
  chiTiet?: React.ReactNode;
  nhanNut: string;
  nhanHuy?: string;
  /** Thao tác gây mất dữ liệu ⇒ nút đỏ. */
  nguyHiem?: boolean;
  icon?: LucideIcon;
  onConfirm: () => void;
  /** Nút mở (bọc asChild). Bỏ trống ⇒ điều khiển bằng open/onOpenChange. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{tieuDe}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">
            {moTa}
            {chiTiet && (
              <span className="mt-2 block rounded-lg bg-muted px-4 py-3 text-base font-semibold text-foreground">
                {chiTiet}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg">{nhanHuy}</AlertDialogCancel>
          <AlertDialogAction
            size="lg"
            variant={nguyHiem ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {Icon && <Icon aria-hidden />}
            {nhanNut}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
