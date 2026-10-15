// ============================================================
// Tên file: src/design-system/patterns/ReadOnlyBadge.tsx
// Tên tiếng Việt: Nhãn "Chỉ xem" (phân quyền)
// Description: Badge shown when the viewer may read a screen but not change it
// ============================================================
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nhãn "Chỉ xem" — đặt cạnh tiêu đề màn / khu vực khi người dùng có quyền XEM mà
 * không có quyền thêm hay sửa (spec role-permissions §5 lớp 2). Nút không có quyền
 * thì ẨN hẳn (không làm mờ — luật nút Lưu không bao giờ disabled); nhãn này nói lý do
 * vì sao không thấy nút. Design-system không biết quyền: màn tự quyết khi nào hiện.
 */
export function ReadOnlyBadge({ className, label = "Chỉ xem" }: { className?: string; label?: string }) {
  return (
    <span
      title="Bạn có quyền xem màn này, không có quyền thêm hay sửa. Cần thêm quyền thì báo quản trị viên."
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground",
        className
      )}
    >
      <Eye className="size-icon-sm" aria-hidden />
      {label}
    </span>
  );
}
