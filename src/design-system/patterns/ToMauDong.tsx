// ============================================================
// Tên file: src/design-system/patterns/ToMauDong.tsx
// Tên tiếng Việt: Tô màu dòng "đã dò" kiểu Excel
// Description: Shared row highlight (color + bold) for every table
// ============================================================
import * as React from "react";
import { Bold, Check, Eraser, PaintBucket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MAU_TO, moTaDau, type DauDong, type ToMauBang, type VaDau } from "./toMauNguon";

/**
 * Kế toán dò sổ trên app như dò bảng kê Excel: dò tới đâu tô màu + in đậm dòng
 * đó. Design-system CHỈ vẽ (nút, bảng màu, nền dòng) và định nghĩa hợp đồng
 * `NguonToMau`; đọc/ghi dấu do app cấp qua `ToMauContext` — provider ở
 * `features/shared/ToMauProvider.tsx` nối bảng `row_marks` (lưu chung mọi máy).
 * Không có provider (trang /kit, test) ⇒ bảng chạy như cũ, không hiện nút tô.
 *
 * Bảng dùng chung (`BangTong`, `RecordTable`, `LuoiNhap`) bật bằng một prop
 * `toMau="<khoá bảng>"`. Bảng tự dựng dùng thẳng `useToMau` + `NutToMau`.
 */

/** Bảng chọn màu + in đậm + bỏ tô — dùng chung cho nút từng dòng và nút hàng loạt. */
function BangChonMau({
  dau,
  doiTuong,
  onChon,
}: {
  dau: DauDong | undefined;
  /** "dòng này" / "12 dòng đã chọn" — ghép vào câu hướng dẫn. */
  doiTuong: string;
  /** Vá dấu (null = bỏ tô); `dong` = đóng bảng chọn sau khi bấm. */
  onChon: (va: VaDau | null, dong: boolean) => void;
}) {
  const dam = Boolean(dau?.dam);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">Tô màu {doiTuong}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Màu tô">
        {MAU_TO.map((m) => {
          const dangChon = dau?.mau === m.ma;
          return (
            <button
              key={m.ma}
              type="button"
              aria-pressed={dangChon}
              aria-label={`Tô ${m.nhan}`}
              title={`Tô nền ${m.nhan} cho ${doiTuong} để đánh dấu đã dò. Lưu chung — máy khác cũng thấy.`}
              onClick={() => onChon({ mau: m.ma }, true)}
              className={cn(
                "flex size-[var(--h-control,2.25rem)] items-center justify-center rounded-md ring-1 ring-foreground/20 hover:ring-2 hover:ring-foreground/50",
                m.nen,
                dangChon && "ring-2 ring-foreground"
              )}
            >
              {dangChon && <Check className="size-4 text-foreground" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={dam ? "default" : "outline"}
          aria-pressed={dam}
          title={
            dam
              ? `Bỏ in đậm ${doiTuong} (giữ nguyên màu tô).`
              : `In đậm cả ${doiTuong} (giữ nguyên màu tô).`
          }
          onClick={() => onChon({ dam: !dam }, false)}
        >
          <Bold />
          In đậm
        </Button>
        {dau && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title={`Bỏ màu tô và bỏ in đậm của ${doiTuong}. Số liệu không đổi.`}
            onClick={() => onChon(null, true)}
          >
            <Eraser />
            Bỏ tô
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Nút tô màu cuối/đầu dòng (chuột + cảm ứng — không dựa vào chuột phải). Bấm mở
 * bảng màu; chọn màu là đóng, bấm "In đậm" giữ mở để chọn tiếp.
 */
export function NutToMau({
  to,
  khoa,
  nhan,
  className,
}: {
  to: ToMauBang;
  /** Khoá dòng — id BẢN GHI, không phải chỉ số dòng. */
  khoa: string;
  /** Tên dòng cho trình đọc màn hình (VD "2 DA 250UP"). */
  nhan?: string;
  className?: string;
}) {
  const [mo, setMo] = React.useState(false);
  if (!to.bat) return null;
  const dau = to.lay(khoa);
  const mau = MAU_TO.find((m) => m.ma === dau?.mau);
  const trangThai = moTaDau(dau);
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn("relative size-[var(--h-control,2.25rem)] p-0 print:hidden", className)}
          aria-label={`Tô màu dòng${nhan ? ` ${nhan}` : ""}${trangThai ? ` (đang ${trangThai})` : ""}`}
          title={
            trangThai
              ? `Dòng đang ${trangThai}. Bấm để đổi màu, in đậm hoặc bỏ tô.`
              : "Tô màu / in đậm dòng này để đánh dấu đã dò (như tô trên Excel). Lưu chung — máy khác cũng thấy."
          }
        >
          <PaintBucket className={cn("size-4", mau ? mau.vach : "text-muted-foreground")} aria-hidden />
          {mau && (
            <span
              aria-hidden
              className={cn("absolute inset-x-2 bottom-1 h-1 rounded-full ring-1 ring-foreground/30", mau.nen)}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-3">
        <BangChonMau
          dau={dau}
          doiTuong="dòng này"
          onChon={(va, dong) => {
            to.sua(khoa, va);
            if (dong) setMo(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Nút tô HÀNG LOẠT cho các dòng đang tick (thanh "Đã chọn N dòng"). Ghi một lượt,
 * có toast + Hoàn tác.
 */
export function NutToMauNhieu({ to, khoa }: { to: ToMauBang; khoa: string[] }) {
  const [mo, setMo] = React.useState(false);
  if (!to.bat || khoa.length === 0) return null;
  // Dấu đại diện: màu chỉ sáng khi MỌI dòng cùng màu; "In đậm" sáng khi mọi
  // dòng đều đậm (bấm ⇒ đậm hết / bỏ đậm hết, màu từng dòng giữ nguyên).
  const ds = khoa.map((k) => to.lay(k));
  const mau0 = ds[0]?.mau ?? "";
  const daiDien: DauDong | undefined = ds.some(Boolean)
    ? { mau: ds.every((d) => (d?.mau ?? "") === mau0) ? mau0 : "", dam: ds.every((d) => d?.dam) }
    : undefined;
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          title={`Tô màu / in đậm ${khoa.length} dòng đang tick để đánh dấu đã dò. Lưu chung — máy khác cũng thấy; có nút Hoàn tác.`}
        >
          <PaintBucket />
          Tô màu {khoa.length} dòng
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-3">
        <BangChonMau
          dau={daiDien}
          doiTuong={`${khoa.length} dòng đã chọn`}
          onChon={(va, dong) => {
            to.sua(khoa, va, true);
            if (dong) setMo(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
