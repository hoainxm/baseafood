// ============================================================
// Tên tiếng Việt: Biểu đồ theo ngày (đường + cột)
// Description: Time-series chart — lines and grouped bars on one kg axis, SVG + tokens
// ============================================================
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useContainerWidth } from "./useContainerWidth";
import type { CategoryTone } from "./Tag";

/**
 * TimeSeriesChart — nhiều chuỗi số trên CÙNG một trục (cùng đơn vị, VD kg): chuỗi
 * `cot` vẽ cột đứng xếp cạnh nhau theo ngày, chuỗi `duong` vẽ đường (có vùng mờ dưới
 * nếu `vung`). Rê chuột / chạm một ngày ⇒ vạch dọc + thẻ số của ngày đó.
 *
 * Bề rộng vẽ = khung đo thật (chữ trục không bị co); nhiều ngày quá thì khung cuộn
 * ngang. Nhãn ngày thưa tự động cho khỏi đè nhau. Chỉ vẽ số truyền vào.
 */
/** Màu chuỗi: 4 màu nghĩa + bảng tone theo loại (`CategoryTone`) để khớp thẻ số cùng màn. */
export type SeriesColor = "brand" | "success" | "warning" | "neutral" | CategoryTone;

export interface ChartSeries {
  id: string;
  name: string;
  color: SeriesColor;
  kind: "line" | "bar";
  /** Tô vùng dưới đường (chỉ với `duong`). */
  area?: boolean;
  values: number[];
}

const NET: Record<SeriesColor, string> = {
  brand: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  neutral: "stroke-muted-foreground",
  purple: "stroke-tone-purple",
  teal: "stroke-tone-teal",
  blue: "stroke-tone-blue",
  cyan: "stroke-tone-cyan",
  sand: "stroke-tone-sand",
  pink: "stroke-tone-pink",
  green: "stroke-tone-green",
  orange: "stroke-tone-orange",
  gray: "stroke-tone-gray",
};
const TONE_FILL: Record<SeriesColor, string> = {
  brand: "fill-primary",
  success: "fill-success",
  warning: "fill-warning",
  neutral: "fill-muted-foreground",
  purple: "fill-tone-purple",
  teal: "fill-tone-teal",
  blue: "fill-tone-blue",
  cyan: "fill-tone-cyan",
  sand: "fill-tone-sand",
  pink: "fill-tone-pink",
  green: "fill-tone-green",
  orange: "fill-tone-orange",
  gray: "fill-tone-gray",
};

/** Mốc trục tròn: 1 · 2 · 2,5 · 5 × 10ⁿ. */
function niceTicks(max: number, tickCount = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / tickCount;
  const mu = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((b) => b * mu).find((b) => b >= rawStep) ?? rawStep;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Nhãn trục gọn: kg ≥ 1.000 ghi theo tấn; đơn vị khác ghi nghìn / triệu. */
const compact = (n: number, unit: string) => {
  const fmt = (x: number) => x.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  if (unit === "kg") return n >= 1e3 ? `${fmt(n / 1e3)} tấn` : `${fmt(n)} kg`;
  return n >= 1e6 ? `${fmt(n / 1e6)} tr` : n >= 1e3 ? `${fmt(n / 1e3)} nghìn` : fmt(n);
};

export function TimeSeriesChart({
  labels,
  series,
  formatValue = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  unit = "kg",
  height = 280,
  minWidth = 560,
  description,
  className,
}: {
  /** Nhãn trục ngang (VD "02/09"), cùng độ dài với mỗi `giaTri`. */
  labels: string[];
  series: ChartSeries[];
  formatValue?: (n: number) => string;
  unit?: string;
  height?: number;
  minWidth?: number;
  description?: string;
  className?: string;
}) {
  const columnCount = series.filter((c) => c.kind === "bar").length;
  const n = labels.length;
  const { ref, width } = useContainerWidth<HTMLDivElement>(Math.max(minWidth, n * Math.max(14, columnCount * 10 + 6) + 64));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const max = Math.max(0, ...series.flatMap((c) => c.values));
  if (n === 0 || series.length === 0 || max <= 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để vẽ biểu đồ.
      </p>
    );
  }

  const left = 64;
  const padRight = 12;
  const top = 12;
  const bottom = 28;
  const anchor = niceTicks(max);
  const peak = anchor[anchor.length - 1] || 1;
  const w = width - left - padRight;
  const h = height - top - bottom;
  const bandWidth = w / n;
  const midX = (i: number) => left + bandWidth * (i + 0.5);
  const y = (v: number) => top + h - (v / peak) * h;
  // Nhãn ngày: tối thiểu ~44px một nhãn để không đè.
  const labelStep = Math.max(1, Math.ceil(44 / bandWidth));
  const barWidth = Math.max(3, Math.min(22, (bandWidth * 0.72) / Math.max(1, columnCount)));
  let columnIndex = 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div ref={ref} className="relative overflow-x-auto scroll-nice-x">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={description ?? "Biểu đồ theo ngày"}
          className="block"
          style={{ minWidth: width }}
          onMouseLeave={() => setSelectedIndex(null)}
        >
          {/* Lưới + trục dọc */}
          {anchor.map((v) => (
            <g key={v}>
              <line x1={left} x2={width - padRight} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={left - 6} y={y(v)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-xs tnum">
                {compact(v, unit)}
              </text>
            </g>
          ))}
          {/* Nhãn ngày */}
          {labels.map((t, i) =>
            i % labelStep === 0 ? (
              <text key={i} x={midX(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-xs tnum">
                {t}
              </text>
            ) : null,
          )}
          {/* Vạch ngày đang chọn */}
          {selectedIndex != null && <line x1={midX(selectedIndex)} x2={midX(selectedIndex)} y1={top} y2={top + h} className="stroke-foreground/30" />}
          {/* Cột */}
          {series.map((c) => {
            if (c.kind !== "bar") return null;
            const offset = (columnIndex++ - (columnCount - 1) / 2) * barWidth;
            return (
              <g key={c.id} className={TONE_FILL[c.color]}>
                {c.values.map((v, i) =>
                  v > 0 ? (
                    <rect key={i} x={midX(i) + offset - barWidth / 2} y={y(v)} width={barWidth - 1} height={top + h - y(v)} rx={2} opacity={selectedIndex == null || selectedIndex === i ? 0.9 : 0.45} />
                  ) : null,
                )}
              </g>
            );
          })}
          {/* Đường */}
          {series.map((c) => {
            if (c.kind !== "line") return null;
            const d = c.values.map((v, i) => `${i ? "L" : "M"}${midX(i)},${y(v)}`).join(" ");
            return (
              <g key={c.id}>
                {c.area && <path d={`${d} L${midX(n - 1)},${top + h} L${midX(0)},${top + h} Z`} className={TONE_FILL[c.color]} opacity={0.12} />}
                <path d={d} fill="none" className={NET[c.color]} strokeWidth={2.5} strokeLinejoin="round" />
                {selectedIndex != null && <circle cx={midX(selectedIndex)} cy={y(c.values[selectedIndex] ?? 0)} r={4} className={cn(TONE_FILL[c.color], "stroke-card")} strokeWidth={2} />}
              </g>
            );
          })}
          {/* Vùng bắt chuột theo ngày */}
          {labels.map((t, i) => (
            <rect
              key={i}
              x={left + bandWidth * i}
              y={top}
              width={bandWidth}
              height={h}
              fill="transparent"
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => setSelectedIndex(i)}
            >
              <title>{`${t}: ${series.map((c) => `${c.name} ${formatValue(c.values[i] ?? 0)} ${unit}`).join(" · ")}`}</title>
            </rect>
          ))}
        </svg>
        {selectedIndex != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 rounded-lg border-2 border-border bg-card p-2.5 text-sm shadow-lg"
            style={midX(selectedIndex) < width / 2 ? { left: midX(selectedIndex) + 12 } : { left: midX(selectedIndex) - 12, transform: "translateX(-100%)" }}
          >
            <p className="font-semibold text-foreground">{labels[selectedIndex]}</p>
            {series.map((c) => (
              <p key={c.id} className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                <svg width="10" height="10" aria-hidden>
                  <rect width="10" height="10" rx="2" className={TONE_FILL[c.color]} />
                </svg>
                {c.name}: <span className="tnum font-semibold text-foreground">{formatValue(c.values[selectedIndex] ?? 0)} {unit}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Chú giải">
        {series.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <svg width="16" height="10" aria-hidden>
              {c.kind === "bar" ? <rect width="10" height="10" rx="2" className={TONE_FILL[c.color]} /> : <line x1="0" x2="16" y1="5" y2="5" strokeWidth="3" className={NET[c.color]} />}
            </svg>
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
