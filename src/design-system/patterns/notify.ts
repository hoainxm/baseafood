import { toast } from "sonner";

/**
 * notify — phản hồi sau MỌI hành động ghi dữ liệu.
 *
 * Không có phản hồi = người dùng không biết đã lưu chưa = nhập lại lần hai =
 * sai số liệu cuối kỳ. Đây chính là gốc của "tồn nguyên liệu cuối kỳ sai".
 *
 * Thời gian hiện 8 giây (mặc định sonner 4s là quá nhanh để đọc + bấm Hoàn tác).
 */
const THOI_GIAN = 8000;

export const notify = {
  /**
   * `thaoTac` = việc nên làm NGAY sau khi lưu (vd "In tem" cho lô vừa ghi). Có cả
   * Hoàn tác thì Hoàn tác giữ nút chính, thao tác kia đứng cạnh.
   */
  daLuu(message: string, onUndo?: () => void, thaoTac?: { label: string; onClick: () => void }) {
    const hoanTac = onUndo ? { label: "Hoàn tác", onClick: onUndo } : undefined;
    toast.success(message, {
      duration: THOI_GIAN,
      action: hoanTac ?? thaoTac,
      cancel: hoanTac ? thaoTac : undefined,
    });
  },

  daXoa(message: string, onUndo?: () => void) {
    toast(message, {
      duration: THOI_GIAN,
      action: onUndo ? { label: "Hoàn tác", onClick: onUndo } : undefined,
    });
  },

  loi(message: string) {
    toast.error(message, { duration: THOI_GIAN });
  },

  canhBao(message: string) {
    toast.warning(message, { duration: THOI_GIAN });
  },
};
