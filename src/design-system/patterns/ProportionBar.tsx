// ============================================================
// Tên tiếng Việt: Thanh chia phần (100%)
// Description: 100% stacked bar + legend rows — "where did X kg go", plain HTML + tokens
// ============================================================
import { cn } from "@/lib/utils";
import type { CategoryTone } from "./Tag";

/**
 * ProportionBar — MỘT thanh dài = 100% của một tổng, chia khúc theo từng phần; dưới
 * thanh là danh sách phần (chấm màu · tên · kg · %), mỗi dòng bấm được. Kiểu đọc
 * "cứ 100 kg nguyên liệu thì ra 42 kg bán thành phẩm, 6 kg phế liệu…" — người xem
 * hiểu ngay, không cần học cách đọc sơ đồ.
 *
 * Màu theo `sac` (bảng tone dùng chung với `Tag`), luôn kèm tên + số — màu không
 * bao giờ là tín hiệu duy nhất. Khúc quá hẹp (< 7%) không ghi % trong thanh, số vẫn ở
 * danh sách. Thuần HTML ⇒ ăn theo cỡ chữ, không cuộn ngang.
 */
export interface ProportionSegment {
  id: string;
  label: string;
  value: number;
  tone: CategoryTone;
  /** Câu phụ dưới tên (VD "chưa ghi ra khâu nào"). */
  description?: string;
}

/* Liệt kê TRỌN tên lớp để Tailwind quét thấy. */
const TONE_BG: Record<CategoryTone, string> = {
  purple: "bg-tone-purple",
  teal: "bg-tone-teal",
  blue: "bg-tone-blue",
  cyan: "bg-tone-cyan",
  sand: "bg-tone-sand",
  pink: "bg-tone-pink",
  green: "bg-tone-green",
  orange: "bg-tone-orange",
  gray: "bg-tone-gray",
};
const TONE_TEXT: Record<CategoryTone, string> = {
  purple: "text-tone-purple",
  teal: "text-tone-teal",
  blue: "text-tone-blue",
  cyan: "text-tone-cyan",
  sand: "text-tone-sand",
  pink: "text-tone-pink",
  green: "text-tone-green",
  orange: "text-tone-orange",
  gray: "text-tone-gray",
};

export function ProportionBar({
  segments,
  formatValue = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  unit = "kg",
  onSelect,
  description,
  className,
}: {
  segments: ProportionSegment[];
  formatValue?: (n: number) => string;
  unit?: string;
  /** Bấm một phần ⇒ mở màn liên quan. */
  onSelect?: (id: string) => void;
  /** Câu cho trình đọc màn hình. */
  description?: string;
  className?: string;
}) {
  const items = segments.filter((p) => p.value > 0);
  const total = items.reduce((s, p) => s + p.value, 0);
  if (total <= 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để chia phần.
      </p>
    );
  }
  const pt = (v: number) => `${((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: v / total < 0.1 ? 1 : 0 })}%`;

  return (
    <div className={cn("grid gap-3", className)}>
      <div role="img" aria-label={description ?? items.map((p) => `${p.label} ${pt(p.value)}`).join(", ")} className="flex h-11 w-full overflow-hidden rounded-lg border-2 border-border">
        {items.map((p) => {
          const width = (p.value / total) * 100;
          return (
            <div
              key={p.id}
              title={`${p.label}: ${formatValue(p.value)} ${unit} (${pt(p.value)})`}
              className={cn("flex min-w-0 items-center justify-center border-r-2 border-card last:border-r-0", TONE_BG[p.tone])}
              style={{ width: `${width}%` }}
            >
              {width >= 7 && <span className="tnum truncate px-1 text-sm font-bold text-white">{pt(p.value)}</span>}
            </div>
          );
        })}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2">
        {items.map((p) => {
          const content = (
            <>
              <span aria-hidden className={cn("mt-1 size-3.5 shrink-0 rounded-sm", TONE_BG[p.tone])} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{p.label}</span>
                {p.description && <span className="block text-sm text-muted-foreground">{p.description}</span>}
                <span className="tnum block text-sm text-muted-foreground">
                  {formatValue(p.value)} {unit}
                </span>
              </span>
              <span className={cn("tnum shrink-0 text-xl font-bold", TONE_TEXT[p.tone])}>{pt(p.value)}</span>
            </>
          );
          const cls = "flex w-full items-start gap-2.5 rounded-lg border-2 border-border bg-card p-2.5 text-left";
          return (
            <li key={p.id} className="flex min-w-0">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  title={`Mở màn liên quan tới "${p.label}".`}
                  className={cn(cls, "press-feedback cursor-pointer hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
                >
                  {content}
                </button>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
