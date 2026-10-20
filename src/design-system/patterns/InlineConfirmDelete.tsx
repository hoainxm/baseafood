// ============================================================
// Tên file: src/design-system/patterns/InlineConfirmDelete.tsx
// Tên tiếng Việt: Xoá NGAY TẠI DÒNG — hỏi gọn "Xoá dòng này?" cạnh nút, không làm mờ màn
// Description: Inline (non-modal) delete confirmation anchored to the row's trash button
// ============================================================
// VÌ SAO (người dùng báo 2026-10-20 ở lưới Cân đối): hộp "Dòng nhập tay" làm mờ cả màn và
// liệt kê mọi dòng ⇒ không nhớ dòng nào là dòng nào. Xoá ngay tại dòng đang nhìn thấy trên
// lưới: bấm 🗑 ⇒ ô hỏi nhỏ bật cạnh nút (KHÔNG lớp phủ, không che lưới) "Xoá dòng <tên>?"
// [Không] [Xoá]. Vẫn giữ luật ConfirmDelete: hỏi trước, nêu đích danh, nút an toàn đứng
// trước (Esc = không xoá), màn gọi bắn toast Hoàn tác sau khi xoá.
// Dùng cho XOÁ DÒNG TRONG LƯỚI / BẢNG mà dòng đang hiện ngay cạnh nút; xoá bản ghi ở chỗ
// khác (danh mục, phiếu) vẫn dùng ConfirmDelete.
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InlineConfirmDelete({
  recordDescription,
  onConfirm,
  title,
}: {
  /** Đích danh dòng sắp xoá, VD "Gửi đông · Bạch tuộc 2 da — 2.000 kg". */
  recordDescription: string;
  onConfirm: () => void;
  /** Tooltip nút 🗑 (luật §9: mọi nút có title). */
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="danger"
          size="icon-sm"
          className="shrink-0"
          title={title ?? `Xoá dòng "${recordDescription}" (hỏi lại trước, xoá xong vẫn Hoàn tác được).`}
          aria-label={`Xoá dòng ${recordDescription}`}
        >
          <Trash2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="text-sm font-semibold">Xoá dòng này?</p>
        <p className="mt-1 text-sm text-muted-foreground">{recordDescription}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} autoFocus>
            Không
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            <Trash2 />
            Xoá
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
