// ============================================================
// Tên tiếng Việt: Băng chuyền các khâu
// Description: Stage pipeline — kg through each stage, waiting kg, missing tasks
// ============================================================
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { CategoryTone } from "./Tag";

/**
 * PipelineStages — chuỗi khâu nối tiếp (nhập → SX → kho → đóng gói → xuất/bán), mỗi ô:
 * kg đã qua · kg đang chờ · số việc còn thiếu; giữa hai ô ghi % chuyển tiếp. Bản gọn
 * của sơ đồ dòng chảy, đọc được trên điện thoại.
 *
 * Xếp theo BỀ RỘNG VÙNG CHỨA (`@container`), không theo màn hình: vùng ≥ 48rem xếp
 * ngang, hẹp hơn xếp dọc với mũi tên xuống — laptop có thanh bên hay chữ 130% vẫn đúng.
 */
export interface PipelineStage {
  id: string;
  name: string;
  kg: number;
  pendingKg?: number;
  pendingTasks?: number;
  /** kg khâu này ÷ khâu trước; null = không ghi. */
  conversionRate?: number | null;
  /** Sắc của khâu (viền trái + số) — khớp màu thẻ số cùng loại trên màn. */
  tone?: CategoryTone;
}

/* Liệt kê TRỌN tên lớp để Tailwind quét thấy. */
const STAGE_TONES: Record<CategoryTone, { border: string; value: string }> = {
  purple: { border: "border-l-tone-purple", value: "text-tone-purple" },
  teal: { border: "border-l-tone-teal", value: "text-tone-teal" },
  blue: { border: "border-l-tone-blue", value: "text-tone-blue" },
  cyan: { border: "border-l-tone-cyan", value: "text-tone-cyan" },
  sand: { border: "border-l-tone-sand", value: "text-tone-sand" },
  pink: { border: "border-l-tone-pink", value: "text-tone-pink" },
  green: { border: "border-l-tone-green", value: "text-tone-green" },
  orange: { border: "border-l-tone-orange", value: "text-tone-orange" },
  gray: { border: "border-l-tone-gray", value: "text-tone-gray" },
};

export function PipelineStages({
  stages,
  formatValue = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  unit = "kg",
  onSelect,
  className,
}: {
  stages: PipelineStage[];
  formatValue?: (n: number) => string;
  unit?: string;
  /** Bấm một khâu ⇒ mở màn của khâu đó. */
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const pt = (x: number) => `${(x * 100).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%`;
  return (
    <div className={cn("@container", className)}>
      <ol className="flex flex-col gap-1 @3xl:flex-row @3xl:items-stretch">
        {stages.map((k, i) => {
          const missing = k.pendingTasks ?? 0;
          const content = (
            <>
              <span className="text-sm font-medium text-muted-foreground">
                {i + 1}. {k.name}
              </span>
              <span className={cn("tnum text-xl font-bold leading-tight", k.tone ? STAGE_TONES[k.tone].value : "text-foreground")}>
                {formatValue(k.kg)} <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
              </span>
              {(k.pendingKg ?? 0) > 0 && (
                <span className="tnum text-sm text-warning">Đang chờ {formatValue(k.pendingKg ?? 0)} {unit}</span>
              )}
              <span className={cn("text-sm", missing > 0 ? "font-semibold text-warning" : "text-success")}>
                {missing > 0 ? `${missing} việc còn thiếu` : "Đủ việc"}
              </span>
            </>
          );
          const cls = cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border-2 bg-card p-3 text-left",
            missing > 0 ? "border-warning/40" : "border-border",
            k.tone && cn("border-l-4", STAGE_TONES[k.tone].border),
          );
          return (
            <Fragment key={k.id}>
              {i > 0 && (
                <li aria-hidden className="flex shrink-0 items-center justify-center gap-1 text-muted-foreground @3xl:w-12 @3xl:flex-col">
                  <ChevronDown className="size-4 @3xl:hidden" />
                  <ChevronRight className="hidden size-5 @3xl:block" />
                  {k.conversionRate != null && <span className="tnum text-xs font-semibold">{pt(k.conversionRate)}</span>}
                </li>
              )}
              <li className="flex min-w-0 flex-1">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(k.id)}
                    title={`Mở màn ${k.name.toLowerCase()} để xem chi tiết và làm việc còn thiếu.`}
                    className={cn(cls, "press-feedback cursor-pointer hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
