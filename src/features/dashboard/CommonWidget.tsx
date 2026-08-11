// ============================================================
// Tên file cũ: src/features/dashboard/ThanhPhanChung.tsx
// Tên tiếng Việt: Khối Widget tổng hợp chỉ số
// Description: Common Dashboard Widget Component
// ============================================================
// src/features/dashboard/ThanhPhanChung.tsx
import { cn } from "@/lib/utils";
import type { DiemGio } from "./mockDashboardData";

/**
 * Thành phần dùng chung cho màn Tổng quan: ThanhTienDo, GaugeOEE, BieuDoGio.
 * (StatusChip đã chuyển lên @/design-system để các màn MES khác dùng chung.)
 */

/** Thanh tiến độ ngang. `mau` là class nền Tailwind (bg-primary / bg-success…). */
export function ThanhTienDo({
  pct,
  mau = "bg-primary",
  cao = "h-2.5",
}: {
  pct: number;
  mau?: string;
  cao?: string;
}) {
  return (
    <span
      className={cn("block w-full overflow-hidden rounded-full bg-secondary", cao)}
    >
      <span
        className={cn("block h-full rounded-full", mau)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </span>
  );
}

/**
 * Đồng hồ OEE dạng vòng. Nền conic-gradient cần giá trị màu động ⇒ dùng inline
 * style cho riêng phần gradient (ngoại lệ hợp lý), màu lấy từ token CSS.
 */
export function GaugeOEE({
  pct,
  mau = "var(--primary)",
  size = 76,
}: {
  pct: number;
  mau?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${mau} ${pct}%, var(--secondary) ${pct}% 100%)`,
      }}
    >
      <span className="absolute inset-[9px] rounded-full bg-card" />
      <span className="relative font-mono text-sm font-bold tnum">{pct}%</span>
    </span>
  );
}

/**
 * Biểu đồ đường thuần SVG: Thực tế (primary) vs Kế hoạch (xám nét đứt). Vùng thực
 * tế thấp hơn kế hoạch tô đỏ nhạt để đọc ngay chỗ hụt. Màu dùng token qua SVG attr.
 */
export function BieuDoGio({ data }: { data: DiemGio[] }) {
  const W = 820;
  const H = 300;
  const pad = { t: 16, r: 16, b: 40, l: 64 };
  const max =
    Math.ceil(Math.max(...data.map((d) => Math.max(d.thuc, d.ke))) / 1000) * 1000;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = (key: "thuc" | "ke") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const vungHut =
    `${data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Math.min(d.thuc, d.ke)).toFixed(1)}`).join(" ")} ` +
    `${[...data].reverse().map((d, j) => { const i = data.length - 1 - j; return `L${x(i).toFixed(1)},${y(d.ke).toFixed(1)}`; }).join(" ")} Z`;

  return (
    <div className="scroll-nice w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block min-w-[640px]"
        role="img"
        aria-label="Sản lượng theo giờ, thực tế so với kế hoạch"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 10} y={y(max * f) + 5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="13" fill="var(--muted-foreground)">
              {(max * f).toLocaleString("vi-VN")}
            </text>
          </g>
        ))}
        <path d={vungHut} fill="color-mix(in srgb, var(--destructive) 12%, transparent)" />
        <path d={line("ke")} fill="none" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeDasharray="7 6" />
        <path d={line("thuc")} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.gio} cx={x(i)} cy={y(d.thuc)} r="4" fill="var(--primary)" />
        ))}
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <text key={d.gio} x={x(i)} y={H - 14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="13" fill="var(--muted-foreground)">
              {d.gio}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
