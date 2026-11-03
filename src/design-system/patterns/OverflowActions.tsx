/**
 * OverflowActions — nút của trang: máy tính hiện đủ một hàng; điện thoại chỉ hiện nút CHÍNH, nút phụ gom vào
 * "Thêm" (rà UX đợt 3, 2026-11-03: Nhập xuất tồn kho 5 nút chen trong khung lọc, chiếm trọn màn đầu ở 375px).
 * Đặt trong `FilterBar actions={…}` hoặc hàng nút của trang. Mỗi nút giữ `title` của nó (luật 5).
 */
import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "./mediaQuery";

export function OverflowActions({ primary, more }: { primary?: React.ReactNode; more: React.ReactNode }) {
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [open, setOpen] = React.useState(false);
  const hasMore = flatten(more).length > 0;
  if (!isPhone || !hasMore) {
    return (
      <>
        {primary}
        {more}
      </>
    );
  }
  return (
    <>
      {primary}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" title="Mở các thao tác khác của trang.">
            <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden />
            Thêm
          </Button>
        </PopoverTrigger>
        {/* Bấm một nút trong hộp ⇒ đóng hộp (nút tự mở hộp thoại của nó). */}
        <PopoverContent align="end" className="grid w-64 gap-2 p-2 [&_button]:w-full [&_button]:justify-start" onClick={() => setOpen(false)}>
          {more}
        </PopoverContent>
      </Popover>
    </>
  );
}

/** Bóc Fragment lồng nhau để biết còn nút phụ nào thật (không quyền ⇒ không hiện "Thêm" rỗng). */
function flatten(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node).flatMap((c) =>
    React.isValidElement<{ children?: React.ReactNode }>(c) && c.type === React.Fragment ? flatten(c.props.children) : [c],
  );
}
