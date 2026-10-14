import { toast } from "sonner";

/**
 * notify — phản hồi sau MỌI hành động ghi dữ liệu.
 *
 * Không có phản hồi = người dùng không biết đã lưu chưa = nhập lại lần hai =
 * sai số liệu cuối kỳ. Đây chính là gốc của "tồn nguyên liệu cuối kỳ sai".
 *
 * Thời gian hiện (2026-10-14, người dùng: "để khoảng 2 giây"):
 * - Báo xong thường (không có nút): 2 giây — chỉ để biết đã lưu, không cản thao tác.
 * - Có nút (Hoàn tác / In tem): 5 giây — 2 giây không kịp bấm, mất đường lùi khi xóa.
 * - Lỗi / cảnh báo: 4 giây — phải kịp đọc câu giải thích.
 * Rê chuột lên thông báo thì đồng hồ dừng (sonner tự lo).
 */
const SHORT_MS = 2000;
const WITH_ACTION_MS = 5000;
const ALERT_MS = 4000;

export const notify = {
  /**
   * `thaoTac` = việc nên làm NGAY sau khi lưu (vd "In tem" cho lô vừa ghi). Có cả
   * Hoàn tác thì Hoàn tác giữ nút chính, thao tác kia đứng cạnh.
   */
  saved(message: string, onUndo?: () => void, action?: { label: string; onClick: () => void }) {
    const undo = onUndo ? { label: "Hoàn tác", onClick: onUndo } : undefined;
    toast.success(message, {
      duration: undo || action ? WITH_ACTION_MS : SHORT_MS,
      action: undo ?? action,
      cancel: undo ? action : undefined,
    });
  },

  deleted(message: string, onUndo?: () => void) {
    toast(message, {
      duration: onUndo ? WITH_ACTION_MS : SHORT_MS,
      action: onUndo ? { label: "Hoàn tác", onClick: onUndo } : undefined,
    });
  },

  error(message: string) {
    toast.error(message, { duration: ALERT_MS });
  },

  warning(message: string) {
    toast.warning(message, { duration: ALERT_MS });
  },
};
