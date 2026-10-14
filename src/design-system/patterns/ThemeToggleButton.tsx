// ============================================================
// Tên file cũ: src/design-system/patterns/DisplaySettingsButton.tsx
// Tên tiếng Việt: Nút chuyển đổi giao diện sáng/tối
// Description: Light/Dark Theme Toggle Button
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "./FormDialog";
import {
  DisplaySettingsPanel,
  readDisplaySettings,
  writeDisplaySettings,
  type DisplaySettingsSnapshot,
} from "./DisplaySettings";

/**
 * DisplaySettingsButton — nút icon ở header mở hộp "Tùy chỉnh giao diện" (cỡ chữ, mật độ,
 * bề rộng). Gom mọi cấu hình hiển thị về một chỗ.
 *
 * Có nút LƯU rõ ràng: thay đổi được xem trước ngay (áp live để người dùng thấy),
 * nhưng phải bấm **Lưu** mới giữ. Bấm **Hủy** / đóng ⇒ trả về như lúc mở (khôi
 * phục ảnh chụp `snap`). `taiKhoan` để cài đặt nhớ theo từng người dùng.
 */
export function DisplaySettingsButton({
  account,
  className,
}: {
  account?: string;
  className?: string;
}) {
  const [isOpen, setOpen] = React.useState(false);
  const snap = React.useRef<DisplaySettingsSnapshot | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Chụp trạng thái để có thể hoàn tác nếu người dùng Hủy.
      snap.current = readDisplaySettings(account);
    } else if (snap.current) {
      // Đóng mà chưa Lưu ⇒ trả về mốc đã chụp.
      writeDisplaySettings(account, snap.current);
    }
    setOpen(open);
  };

  const save = () => {
    snap.current = null; // đã đồng ý → không hoàn tác nữa
    setOpen(false);
    // Không toast: giao diện đổi ngay trước mắt là phản hồi (README luật 8 — cài đặt hiển thị).
  };

  // Nút Hủy tự đóng (không qua onOpenChange của hộp thoại) ⇒ phải tự khôi phục mốc đã chụp.
  const cancel = () => handleOpenChange(false);

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Tùy chỉnh giao diện"
      description="Xem trước ngay khi chỉnh. Bấm Lưu để giữ cho riêng tài khoản của bạn."
      icon={Palette}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={cancel}>
            Hủy
          </Button>
          <Button variant="save" onClick={save}>Lưu</Button>
        </>
      }
      trigger={
        <button
          type="button"
          aria-label="Tùy chỉnh giao diện"
          title="Tùy chỉnh giao diện"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-foreground press-feedback hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className
          )}
        >
          <Palette className="size-6" aria-hidden />
        </button>
      }
    >
      <DisplaySettingsPanel account={account} />
    </FormDialog>
  );
}
