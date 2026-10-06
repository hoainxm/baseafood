// ============================================================
// Tên file: src/design-system/patterns/ToMauDong.tsx
// Tên tiếng Việt: Tô màu dòng/ô "đã dò" kiểu Excel — nút + bảng màu + bút tô
// Description: Shared row/cell highlight UI (palette, row button, brush)
// ============================================================
import * as React from "react";
import { Bold, Brush, Check, Eraser, PaintBucket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LUOI_MAU,
  datBut,
  moTaDau,
  tenMau,
  type DauDong,
  type MauTo,
  type ToMauBang,
  type VaDau,
  useButDangCam,
} from "./toMauNguon";

/**
 * Kế toán dò sổ trên app như dò bảng kê Excel: dò tới đâu tô màu + in đậm chỗ
 * đó. Design-system CHỈ vẽ (bảng màu, nút, nền dòng/ô) và định nghĩa hợp đồng
 * `NguonToMau`; đọc/ghi dấu do app cấp qua `ToMauContext` — provider ở
 * `features/shared/ToMauProvider.tsx` nối bảng `row_marks` (lưu chung mọi máy).
 * Không có provider (trang /kit, test) ⇒ bảng chạy như cũ, không hiện nút tô.
 *
 * Bảng dùng chung (`BangTong`, `RecordTable`, `LuoiNhap`) bật bằng một prop
 * `toMau="<khoá bảng>"`. Bảng tự dựng dùng thẳng `useToMau` + `NutToMau`.
 */

/** Nền theo token màu tô — không viết mã màu. */
const nenMau = (ma: string): React.CSSProperties => ({ backgroundColor: `var(--to-${ma})` });

/** Ô màu nhỏ kiểu Excel — không chữ; tên màu nằm ở aria-label + title. */
function OMau({ ma, chon, onChon, viec }: { ma: MauTo; chon: boolean; onChon: () => void; viec: string }) {
  const ten = tenMau(ma);
  return (
    <button
      type="button"
      aria-pressed={chon}
      aria-label={`${viec} ${ten}`}
      title={`${viec} ${ten}`}
      onClick={onChon}
      style={nenMau(ma)}
      className={cn(
        "flex size-6 items-center justify-center rounded-sm ring-1 ring-foreground/15 hover:z-10 hover:scale-110 hover:ring-2 hover:ring-foreground/60",
        chon && "ring-2 ring-foreground"
      )}
    >
      {chon && <Check className="size-3.5 text-foreground" aria-hidden />}
    </button>
  );
}

/** Lưới 10 sắc × 5 mức (hàng trên nhạt → hàng dưới đậm), như bảng màu Excel. */
function LuoiChonMau({ dang, onChon, viec }: { dang?: string; onChon: (ma: MauTo) => void; viec: string }) {
  return (
    <div className="grid w-max grid-cols-10 gap-1" role="group" aria-label="Bảng màu">
      {LUOI_MAU.flat().map((ma) => (
        <OMau key={ma} ma={ma} chon={dang === ma} onChon={() => onChon(ma)} viec={viec} />
      ))}
    </div>
  );
}

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
      <LuoiChonMau dang={dau?.mau} viec="Tô" onChon={(ma) => onChon({ mau: ma }, true)} />
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

const KHUNG_POPOVER = "w-auto max-w-[calc(100vw-1rem)] p-3";

/** Vạch màu nhỏ dưới icon nút — cho biết màu đang tô / bút đang cầm. */
function VachMau({ ma }: { ma?: string }) {
  if (!ma) return null;
  return (
    <span
      aria-hidden
      style={nenMau(ma)}
      className="absolute inset-x-2 bottom-1 h-1.5 rounded-full ring-1 ring-foreground/30"
    />
  );
}

/**
 * Nút tô màu một DÒNG (chuột + cảm ứng — không dựa vào chuột phải). Bấm mở
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
          <PaintBucket className="size-4 text-muted-foreground" aria-hidden />
          <VachMau ma={dau?.mau} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={KHUNG_POPOVER}>
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
      <PopoverContent align="start" className={KHUNG_POPOVER}>
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

/** Mô tả bút đang cầm: "vàng rất đậm", "vàng rất đậm + in đậm", "cục tẩy". */
function moTaBut(va: VaDau | null): string {
  if (!va) return "cục tẩy (bỏ tô)";
  if (!va.mau && va.dam === false) return "bỏ in đậm (giữ màu)";
  if (!va.mau && va.dam) return "chỉ in đậm (giữ màu)";
  return [va.mau ? tenMau(va.mau) : "", va.dam ? "in đậm" : ""].filter(Boolean).join(" + ");
}

/**
 * BÚT TÔ ở đầu bảng — tô NHIỀU Ô một lúc như Excel: chọn màu là cầm bút, rồi
 * bấm/kéo qua các ô để tô (bấm ô đầu dòng = cả dòng, Shift+bấm = cả vùng). Esc
 * hoặc nút "Thả bút" để thôi. Bút dùng chung cho mọi bảng CÙNG khoá.
 */
export function NutButTo({ to, maBang }: { to: ToMauBang; maBang: string }) {
  const [mo, setMo] = React.useState(false);
  const [dam, setDam] = React.useState(false);
  if (!to.bat) return null;
  const but = to.but;
  const cam = (va: VaDau | null) => {
    datBut({ maBang, va });
    setMo(false);
  };
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={but ? "default" : "ghost"}
          aria-pressed={Boolean(but)}
          className="relative size-[var(--h-control,2.25rem)] p-0 print:hidden"
          aria-label={but ? `Đang cầm bút tô: ${moTaBut(but.va)}` : "Bút tô nhiều ô"}
          title={
            but
              ? `Đang cầm bút tô (${moTaBut(but.va)}). Bấm để đổi màu hoặc thả bút (Esc).`
              : "Bút tô — chọn màu rồi bấm/kéo qua nhiều ô để tô một lượt như Excel; bấm ô đầu dòng để tô cả dòng, Shift+bấm để tô cả vùng."
          }
        >
          <Brush className="size-4" aria-hidden />
          <VachMau ma={but?.va?.mau} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={KHUNG_POPOVER}>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Bút tô nhiều ô</p>
          <p className="max-w-[17.5rem] text-sm text-muted-foreground">
            Chọn màu (hoặc bút in đậm) rồi bấm hoặc kéo qua các ô. Bấm ô đầu dòng để tô cả dòng,
            Shift+bấm để tô cả vùng.
          </p>
          <LuoiChonMau
            dang={but?.va?.mau}
            viec="Cầm bút"
            onChon={(ma) => cam({ mau: ma, ...(dam ? { dam: true } : {}) })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={dam ? "default" : "outline"}
              aria-pressed={dam}
              title={dam ? "Bút màu thôi in đậm (chỉ tô nền)." : "Bút màu tô kèm IN ĐẬM ô được tô."}
              onClick={() => {
                const moi = !dam;
                setDam(moi);
                // Đang cầm bút màu ⇒ áp ngay cho bút đó, khỏi phải chọn lại màu.
                if (but?.va?.mau) datBut({ maBang, va: { mau: but.va.mau, ...(moi ? { dam: true } : {}) } });
              }}
            >
              <Bold />
              Kèm in đậm
            </Button>
          </div>
          {/* In đậm / bỏ in đậm NHIỀU dòng/ô mà giữ nguyên màu đang có. */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={but?.va && !but.va.mau && but.va.dam ? "default" : "outline"}
              title="Cầm bút IN ĐẬM: bấm/kéo qua ô hoặc ô đầu dòng để in đậm nhiều dòng/ô một lượt — màu đang tô giữ nguyên."
              onClick={() => cam({ dam: true })}
            >
              <Bold />
              Chỉ in đậm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={but?.va && !but.va.mau && but.va.dam === false ? "default" : "outline"}
              title="Cầm bút BỎ IN ĐẬM: bấm/kéo qua ô hoặc ô đầu dòng để thôi in đậm nhiều dòng/ô — màu đang tô giữ nguyên."
              onClick={() => cam({ dam: false })}
            >
              <Bold />
              Bỏ in đậm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={but && !but.va ? "default" : "outline"}
              title="Cầm cục tẩy: bấm/kéo qua ô hoặc ô đầu dòng để BỎ màu tô + in đậm. Số liệu không đổi."
              onClick={() => cam(null)}
            >
              <Eraser />
              Cục tẩy
            </Button>
            {but && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Thả bút tô — bảng trở lại gõ số bình thường (phím Esc cũng được)."
                onClick={() => {
                  datBut(null);
                  setMo(false);
                }}
              >
                <X />
                Thả bút
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Dải nhắc NỔI ở đáy màn hình khi đang cầm bút — MỘT dải cho cả app (gắn một lần
 * ở ToMauProvider), không lặp ở từng bảng cùng khoá, không đẩy bảng xuống.
 */
export function GoiYButTo() {
  const but = useButDangCam();
  if (!but) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-2 bottom-4 z-50 mx-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/40 bg-card px-3 py-2 text-sm shadow-lg print:hidden"
    >
      <span className="flex items-center gap-2 font-semibold text-foreground">
        <Brush className="size-4 text-primary" aria-hidden />
        Đang cầm bút: {moTaBut(but.va)}
        {but.va?.mau && (
          <span aria-hidden style={nenMau(but.va.mau)} className="inline-block size-4 rounded-sm ring-1 ring-foreground/30" />
        )}
      </span>
      <span className="text-muted-foreground">
        Bấm/kéo qua ô để tô · ô đầu dòng = cả dòng · Shift+bấm = cả vùng · Esc để thôi.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-auto"
        title="Thả bút tô — bảng trở lại gõ số bình thường."
        onClick={() => datBut(null)}
      >
        <X />
        Thả bút
      </Button>
    </div>
  );
}
