// ============================================================
// Tên file: src/design-system/patterns/RowMarkToolbar.tsx
// Tên tiếng Việt: Tô màu dòng "đã dò" kiểu Excel — thanh thao tác dòng đang tick
// Description: Row highlight UI: palette + bold + clear for ticked rows
// ============================================================
import * as React from "react";
import { Bold, Check, ChevronDown, Eraser, PaintBucket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MARK_COLOR_GRID, getMarkColorName, type MarkColor, type RowMarkTools } from "./rowMarkSource";

/**
 * MỘT cách dùng, giống Excel: tick các dòng → thanh "Đã chọn N dòng" hiện ra →
 * Tô màu ▾ / In đậm / Bỏ tô áp cho mọi dòng đang tick. Bảng dùng chung
 * (`SummaryTable`, `RecordTable`, `EditableGrid`) tự có ô tick + thanh khi bật `rowMarkKey`.
 */

/** Ô màu nhỏ kiểu Excel — không chữ; tên màu nằm ở aria-label + title. */
function ColorSwatch({ code: ma, selected, onSelect }: { code: MarkColor; selected: boolean; onSelect: () => void }) {
  const ten = getMarkColorName(ma);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Tô ${ten}`}
      title={`Tô ${ten}`}
      onClick={onSelect}
      style={{ backgroundColor: `var(--to-${ma})` }}
      className={cn(
        "flex size-6 items-center justify-center rounded-sm ring-1 ring-foreground/15 hover:z-10 hover:scale-110 hover:ring-2 hover:ring-foreground/60",
        selected && "ring-2 ring-foreground"
      )}
    >
      {selected && <Check className="size-3.5 text-foreground" aria-hidden />}
    </button>
  );
}

/**
 * Cụm nút áp cho các dòng đang tick: **Tô màu ▾** (bảng màu 10 sắc × 5 mức) ·
 * **In đậm** (bấm lại = bỏ in đậm) · **Bỏ tô**. Dùng trong `RowMarkToolbar`, hoặc màn
 * tự đặt vào thanh "Đã chọn" riêng của nó (VD Sổ kho tháng).
 */
export function RowMarkActions({ marker: to, selectedKeys }: { marker: RowMarkTools; selectedKeys: string[] }) {
  const [mo, setMo] = React.useState(false);
  if (!to.enabled || selectedKeys.length === 0) return null;
  const items = selectedKeys.map((k) => to.getMark(k));
  const mau0 = items[0]?.color ?? "";
  const commonColor = mau0 && items.every((d) => (d?.color ?? "") === mau0) ? mau0 : "";
  const isAllBold = items.every((d) => d?.bold);
  const hasMarks = items.some(Boolean);
  const n = selectedKeys.length;
  return (
    <>
      <Popover open={mo} onOpenChange={setMo}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={`Chọn màu tô cho ${n} dòng đang tick (giữ nguyên in đậm). Lưu chung — máy khác cũng thấy.`}
          >
            <PaintBucket />
            {commonColor && (
              <span
                aria-hidden
                style={{ backgroundColor: `var(--to-${commonColor})` }}
                className="inline-block size-3.5 rounded-sm ring-1 ring-foreground/30"
              />
            )}
            Tô màu
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] p-3">
          <div className="grid w-max grid-cols-10 gap-1" role="group" aria-label="Bảng màu">
            {MARK_COLOR_GRID.flat().map((ma) => (
              <ColorSwatch
                key={ma}
                code={ma}
                selected={commonColor === ma}
                onSelect={() => {
                  to.patch(selectedKeys, { color: ma });
                  setMo(false);
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        variant={isAllBold ? "default" : "outline"}
        aria-pressed={isAllBold}
        title={
          isAllBold
            ? `Bỏ in đậm ${n} dòng đang tick (giữ nguyên màu).`
            : `In đậm ${n} dòng đang tick (giữ nguyên màu).`
        }
        onClick={() => to.patch(selectedKeys, { bold: !isAllBold })}
      >
        <Bold />
        {isAllBold ? "Bỏ in đậm" : "In đậm"}
      </Button>
      {hasMarks && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title={`Bỏ màu và bỏ in đậm của ${n} dòng đang tick. Số liệu không đổi.`}
          onClick={() => to.patch(selectedKeys, null)}
        >
          <Eraser />
          Bỏ tô
        </Button>
      )}
    </>
  );
}

/**
 * Thanh "Đã chọn N dòng" — bảng tự hiện khi có dòng tick. Dính đáy màn hình khi
 * bảng dài, để tick dòng tận dưới vẫn thấy nút.
 */
export function RowMarkToolbar({
  marker: to,
  selectedKeys,
  onClearSelection,
  className,
}: {
  marker: RowMarkTools;
  selectedKeys: string[];
  onClearSelection: () => void;
  className?: string;
}) {
  if (!to.enabled || selectedKeys.length === 0) return null;
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card px-3 py-2 shadow-md print:hidden",
        className
      )}
    >
      <span className="font-semibold text-foreground">Đã chọn {selectedKeys.length} dòng</span>
      <RowMarkActions marker={to} selectedKeys={selectedKeys} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ml-auto"
        title="Bỏ tick mọi dòng đang chọn."
        onClick={onClearSelection}
      >
        <X />
        Bỏ chọn
      </Button>
    </div>
  );
}
