import * as React from "react";
import { cn } from "@/lib/utils";
import type { CategoryTone } from "./Tag";

/**
 * Thẻ thông tin (KPI card) — thay cho việc nhồi mọi số vào một dòng chữ.
 *
 * Mỗi con số quan trọng đứng trong một thẻ riêng: nhãn nhỏ ở trên, số TO ở dưới,
 * icon màu để mắt bắt nhanh. Người 45–60 tuổi đọc "thẻ" nhanh hơn đọc một câu
 * dài gộp Ngày · Xưởng · Tổng. Màu chỉ để phân nhóm, luôn kèm nhãn chữ.
 */
export type StatCardColor = "brand" | "success" | "warning" | "danger" | "neutral";

export interface StatCardData {
  label: string;
  value: React.ReactNode;
  /** Dòng phụ nhỏ dưới số (VD đơn vị, ghi chú). */
  subtext?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  color?: StatCardColor;
  /**
   * SẮC THEO LOẠI SỐ (bảng tone dùng chung với `Tag`) — thẻ tô nền nhạt + viền trái
   * đậm + số cùng màu, để mỗi loại (nhập · sản xuất · kho · bán…) nhận ra ngay và khớp
   * màu với biểu đồ cùng màn. Có `sac` thì bỏ qua `mau` (trừ khi muốn báo tốt/xấu: khi
   * đó dùng `mau`, đừng truyền `sac`).
   */
  tone?: CategoryTone;
  /** Số → tabular-nums cho thẳng cột. */
  numeric?: boolean;
  /** Nếu có → thẻ bấm được (drill-down tới dữ liệu). Thêm con trỏ + viền nổi khi rê. */
  onSelect?: () => void;
  /** Câu gợi ý khi rê chuột / cho screen-reader (dùng với onChon). */
  selectHint?: string;
}

const CARD_COLORS: Record<StatCardColor, { chip: string; border: string }> = {
  brand: { chip: "bg-accent text-accent-foreground", border: "border-border" },
  success: {
    chip: "bg-success-surface text-success",
    border: "border-success/30",
  },
  warning: {
    chip: "bg-warning-surface text-warning",
    border: "border-warning/30",
  },
  danger: { chip: "bg-destructive/10 text-destructive", border: "border-destructive/30" },
  neutral: { chip: "bg-muted text-muted-foreground", border: "border-border" },
};

/* Liệt kê TRỌN tên lớp (không ghép chuỗi) để Tailwind quét thấy. */
const SAC_THE: Record<CategoryTone, { card: string; chip: string; value: string }> = {
  purple: { card: "border-tone-purple-line bg-tone-purple-surface", chip: "bg-tone-purple text-white", value: "text-tone-purple" },
  teal: { card: "border-tone-teal-line bg-tone-teal-surface", chip: "bg-tone-teal text-white", value: "text-tone-teal" },
  blue: { card: "border-tone-blue-line bg-tone-blue-surface", chip: "bg-tone-blue text-white", value: "text-tone-blue" },
  cyan: { card: "border-tone-cyan-line bg-tone-cyan-surface", chip: "bg-tone-cyan text-white", value: "text-tone-cyan" },
  sand: { card: "border-tone-sand-line bg-tone-sand-surface", chip: "bg-tone-sand text-white", value: "text-tone-sand" },
  pink: { card: "border-tone-pink-line bg-tone-pink-surface", chip: "bg-tone-pink text-white", value: "text-tone-pink" },
  green: { card: "border-tone-green-line bg-tone-green-surface", chip: "bg-tone-green text-white", value: "text-tone-green" },
  orange: { card: "border-tone-orange-line bg-tone-orange-surface", chip: "bg-tone-orange text-white", value: "text-tone-orange" },
  gray: { card: "border-tone-gray-line bg-tone-gray-surface", chip: "bg-tone-gray text-white", value: "text-tone-gray" },
};

const LG_GRID_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  // 5 thẻ: màn vừa chia 3+2, màn rộng gom ĐỦ 5 trên một hàng (không để 4+1 lẻ loi).
  5: "lg:grid-cols-3 xl:grid-cols-5",
};

/**
 * Số cột màn rộng tự suy theo SỐ THẺ để lưới cân: ≤4 thẻ một hàng; 5 thẻ một hàng
 * (màn đủ rộng); 6 thẻ 3×2; nhiều hơn thì 4 cột. Tránh cảnh 4+1 hay 4+2 lệch.
 */
function autoColumnCount(cardCount: number): 2 | 3 | 4 | 5 {
  if (cardCount <= 2) return 2;
  if (cardCount === 3 || cardCount === 6 || cardCount === 9) return 3;
  if (cardCount === 5) return 5;
  return 4;
}

export function StatCardGrid({
  cards,
  columns,
  className,
}: {
  cards: StatCardData[];
  /** Số cột tối đa (màn rộng). Bỏ trống ⇒ tự suy theo số thẻ (xem `cotTuDong`). */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const columnCount = columns ?? autoColumnCount(cards.length);
  // 5 cột trên màn rộng: thẻ hẹp ⇒ icon lên trên nhãn, số nhỏ một bậc, để số dài
  // (1.478.897,83 kg · 29.535.327.023 đ) vẫn nằm trọn một dòng, không ngắt giữa số.
  const isNarrow = columnCount === 5;
  return (
    <div
      className={cn(
        // Điện thoại: bề ngang tối thiểu mỗi thẻ tính theo rem ⇒ cỡ chữ thường 2 cột,
        // phóng chữ 130% tự rơi về 1 cột (khỏi bẻ vụn số). Từ md giữ 2 cột như cũ.
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3 md:grid-cols-2 md:gap-4",
        LG_GRID_COLS[columnCount] ?? "lg:grid-cols-4",
        // Thẻ cuối lẻ trải hết hàng thay vì bỏ trống nửa hàng (1/-1 không đẻ cột ẩn).
        "[&>*:last-child:nth-child(odd)]:col-[1/-1] lg:[&>*:last-child:nth-child(odd)]:col-auto",
        className
      )}
    >
      {cards.map((t) => {
        const color = CARD_COLORS[t.color ?? "brand"];
        const sac = t.tone ? SAC_THE[t.tone] : null;
        const Icon = t.icon;
        const isString = typeof t.value === "string";
        const len = isString ? (t.value as string).length : 0;
        // Chuỗi vừa (ngày "21/08/2026"…) để cỡ nhỏ đủ HIỆN TRỌN 1 dòng trong thẻ
        // hẹp nhất (mobile 2 cột) — không bẻ dòng giữa số, không cắt mất năm.
        // Chuỗi thật dài (>12) mới cho ngắt từ; số (t.so) luôn to.
        const fontSizeClass = t.numeric
          ? isNarrow
            ? "text-xl md:text-2xl lg:text-lg 2xl:text-xl"
            : "text-xl md:text-2xl"
          : len > 12
            ? "text-sm font-semibold leading-snug lg:text-base"
            : len > 7
              ? "text-xs md:text-sm"
              : "text-base md:text-lg lg:text-xl";

        const content = (
          <>
            {Icon && (
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  sac ? sac.chip : color.chip
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            )}
            <div className="w-full min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground break-words">
                {t.label}
              </p>
              <p
                className={cn(
                  "min-w-0 leading-tight",
                  sac ? sac.value : "text-foreground",
                  // Số & chuỗi ngắn để bold cho nổi; chuỗi vừa/dài (ngày…) chỉ
                  // semibold để hẹp hơn, vừa thẻ mà không cắt chữ.
                  t.numeric || len <= 7 ? "font-bold" : "font-semibold",
                  // Số (tiền/kg) KHÔNG truncate — thà bẻ dòng còn hơn cắt mất chữ
                  // số. Chỉ chuỗi vừa (ngày…) mới truncate cho gọn 1 dòng.
                  t.numeric || len > 12 ? "break-words" : "truncate",
                  fontSizeClass,
                  t.numeric && "tnum"
                )}
              >
                {t.value}
              </p>
              {t.subtext && (
                <p className="text-sm text-muted-foreground break-words">{t.subtext}</p>
              )}
            </div>
          </>
        );
        const cls = cn(
          "flex items-center gap-2.5 rounded-xl border px-3 py-3",
          // Điện thoại (2 thẻ một hàng): icon lên trên nhãn như thẻ hẹp 5 cột — để icon bên
          // cạnh thì nhãn chỉ còn ~80 px, "Chuyến trong tháng" bẻ 3 dòng, thẻ cao thấp lệch nhau.
          "max-md:flex-col max-md:items-start max-md:gap-2",
          sac ? cn("border-l-4", sac.card) : "bg-card",
          isNarrow && "lg:flex-col lg:items-start lg:gap-2",
          !sac && color.border
        );
        return t.onSelect ? (
          <button
            key={t.label}
            type="button"
            onClick={t.onSelect}
            title={t.selectHint}
            aria-label={t.selectHint ?? `Xem chi tiết: ${t.label}`}
            className={cn(
              cls,
              "cursor-pointer text-left press-feedback hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            {content}
          </button>
        ) : (
          <div key={t.label} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
