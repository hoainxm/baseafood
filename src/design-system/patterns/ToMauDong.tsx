// ============================================================
// Tên file: src/design-system/patterns/ToMauDong.tsx
// Tên tiếng Việt: Tô màu dòng "đã dò" kiểu Excel — thanh thao tác dòng đang tick
// Description: Row highlight UI: palette + bold + clear for ticked rows
// ============================================================
import * as React from "react";
import { Bold, Check, ChevronDown, Eraser, PaintBucket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LUOI_MAU, tenMau, type MauTo, type ToMauBang } from "./toMauNguon";

/**
 * MỘT cách dùng, giống Excel: tick các dòng → thanh "Đã chọn N dòng" hiện ra →
 * Tô màu ▾ / In đậm / Bỏ tô áp cho mọi dòng đang tick. Bảng dùng chung
 * (`BangTong`, `RecordTable`, `LuoiNhap`) tự có ô tick + thanh khi bật `toMau`.
 */

/** Ô màu nhỏ kiểu Excel — không chữ; tên màu nằm ở aria-label + title. */
function OMau({ ma, chon, onChon }: { ma: MauTo; chon: boolean; onChon: () => void }) {
  const ten = tenMau(ma);
  return (
    <button
      type="button"
      aria-pressed={chon}
      aria-label={`Tô ${ten}`}
      title={`Tô ${ten}`}
      onClick={onChon}
      style={{ backgroundColor: `var(--to-${ma})` }}
      className={cn(
        "flex size-6 items-center justify-center rounded-sm ring-1 ring-foreground/15 hover:z-10 hover:scale-110 hover:ring-2 hover:ring-foreground/60",
        chon && "ring-2 ring-foreground"
      )}
    >
      {chon && <Check className="size-3.5 text-foreground" aria-hidden />}
    </button>
  );
}

/**
 * Cụm nút áp cho các dòng đang tick: **Tô màu ▾** (bảng màu 10 sắc × 5 mức) ·
 * **In đậm** (bấm lại = bỏ in đậm) · **Bỏ tô**. Dùng trong `ThanhToMau`, hoặc màn
 * tự đặt vào thanh "Đã chọn" riêng của nó (VD Sổ kho tháng).
 */
export function NutToMauChon({ to, khoa }: { to: ToMauBang; khoa: string[] }) {
  const [mo, setMo] = React.useState(false);
  if (!to.bat || khoa.length === 0) return null;
  const ds = khoa.map((k) => to.lay(k));
  const mau0 = ds[0]?.mau ?? "";
  const cungMau = mau0 && ds.every((d) => (d?.mau ?? "") === mau0) ? mau0 : "";
  const datHet = ds.every((d) => d?.dam);
  const coDau = ds.some(Boolean);
  const n = khoa.length;
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
            {cungMau && (
              <span
                aria-hidden
                style={{ backgroundColor: `var(--to-${cungMau})` }}
                className="inline-block size-3.5 rounded-sm ring-1 ring-foreground/30"
              />
            )}
            Tô màu
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] p-3">
          <div className="grid w-max grid-cols-10 gap-1" role="group" aria-label="Bảng màu">
            {LUOI_MAU.flat().map((ma) => (
              <OMau
                key={ma}
                ma={ma}
                chon={cungMau === ma}
                onChon={() => {
                  to.sua(khoa, { mau: ma });
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
        variant={datHet ? "default" : "outline"}
        aria-pressed={datHet}
        title={
          datHet
            ? `Bỏ in đậm ${n} dòng đang tick (giữ nguyên màu).`
            : `In đậm ${n} dòng đang tick (giữ nguyên màu).`
        }
        onClick={() => to.sua(khoa, { dam: !datHet })}
      >
        <Bold />
        {datHet ? "Bỏ in đậm" : "In đậm"}
      </Button>
      {coDau && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title={`Bỏ màu và bỏ in đậm của ${n} dòng đang tick. Số liệu không đổi.`}
          onClick={() => to.sua(khoa, null)}
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
export function ThanhToMau({
  to,
  khoa,
  onBoChon,
  className,
}: {
  to: ToMauBang;
  khoa: string[];
  onBoChon: () => void;
  className?: string;
}) {
  if (!to.bat || khoa.length === 0) return null;
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card px-3 py-2 shadow-md print:hidden",
        className
      )}
    >
      <span className="font-semibold text-foreground">Đã chọn {khoa.length} dòng</span>
      <NutToMauChon to={to} khoa={khoa} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ml-auto"
        title="Bỏ tick mọi dòng đang chọn."
        onClick={onBoChon}
      >
        <X />
        Bỏ chọn
      </Button>
    </div>
  );
}
