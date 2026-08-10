import * as React from "react";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "./FormDialog";
import {
  CaiDatHienThi,
  docCaiDatHienThi,
  ghiCaiDatHienThi,
  type AnhCaiDat,
} from "./CaiDatHienThi";
import { notify } from "./notify";

/**
 * NutGiaoDien — nút icon ở header mở hộp "Tùy chỉnh giao diện" (cỡ chữ, mật độ,
 * bề rộng). Gom mọi cấu hình hiển thị về một chỗ.
 *
 * Có nút LƯU rõ ràng: thay đổi được xem trước ngay (áp live để người dùng thấy),
 * nhưng phải bấm **Lưu** mới giữ. Bấm **Hủy** / đóng ⇒ trả về như lúc mở (khôi
 * phục ảnh chụp `snap`). `taiKhoan` để cài đặt nhớ theo từng người dùng.
 */
export function NutGiaoDien({
  taiKhoan,
  className,
}: {
  taiKhoan?: string;
  className?: string;
}) {
  const [mo, setMo] = React.useState(false);
  const snap = React.useRef<AnhCaiDat | null>(null);

  const doiMo = (open: boolean) => {
    if (open) {
      // Chụp trạng thái để có thể hoàn tác nếu người dùng Hủy.
      snap.current = docCaiDatHienThi(taiKhoan);
    } else if (snap.current) {
      // Đóng mà chưa Lưu ⇒ trả về mốc đã chụp.
      ghiCaiDatHienThi(taiKhoan, snap.current);
    }
    setMo(open);
  };

  const luu = () => {
    snap.current = null; // đã đồng ý → không hoàn tác nữa
    setMo(false);
    notify.daLuu("Đã lưu giao diện của bạn");
  };

  const huy = () => setMo(false); // onOpenChange(false) sẽ khôi phục snap

  return (
    <FormDialog
      open={mo}
      onOpenChange={doiMo}
      tieuDe="Tùy chỉnh giao diện"
      moTa="Xem trước ngay khi chỉnh. Bấm Lưu để giữ cho riêng tài khoản của bạn."
      icon={Palette}
      rong="xl"
      chan={
        <>
          <Button variant="outline" onClick={huy}>
            Hủy
          </Button>
          <Button onClick={luu}>Lưu</Button>
        </>
      }
      trigger={
        <button
          type="button"
          aria-label="Tùy chỉnh giao diện"
          title="Tùy chỉnh giao diện"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-input text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className
          )}
        >
          <Palette className="size-6" aria-hidden />
        </button>
      }
    >
      <CaiDatHienThi taiKhoan={taiKhoan} />
    </FormDialog>
  );
}
