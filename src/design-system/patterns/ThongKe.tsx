import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Thẻ thông tin (KPI card) — thay cho việc nhồi mọi số vào một dòng chữ.
 *
 * Mỗi con số quan trọng đứng trong một thẻ riêng: nhãn nhỏ ở trên, số TO ở dưới,
 * icon màu để mắt bắt nhanh. Người 45–60 tuổi đọc "thẻ" nhanh hơn đọc một câu
 * dài gộp Ngày · Xưởng · Tổng. Màu chỉ để phân nhóm, luôn kèm nhãn chữ.
 */
export type MauThe = "brand" | "success" | "warning" | "danger" | "trung-tinh";

export interface TheThongTin {
  nhan: string;
  giaTri: React.ReactNode;
  /** Dòng phụ nhỏ dưới số (VD đơn vị, ghi chú). */
  phu?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  mau?: MauThe;
  /** Số → tabular-nums cho thẳng cột. */
  so?: boolean;
  /** Nếu có → thẻ bấm được (drill-down tới dữ liệu). Thêm con trỏ + viền nổi khi rê. */
  onChon?: () => void;
  /** Câu gợi ý khi rê chuột / cho screen-reader (dùng với onChon). */
  moTaChon?: string;
}

const MAU: Record<MauThe, { chip: string; vien: string }> = {
  brand: { chip: "bg-accent text-accent-foreground", vien: "border-border" },
  success: {
    chip: "bg-success-surface text-success",
    vien: "border-success/30",
  },
  warning: {
    chip: "bg-warning-surface text-warning",
    vien: "border-warning/30",
  },
  danger: { chip: "bg-destructive/10 text-destructive", vien: "border-destructive/30" },
  "trung-tinh": { chip: "bg-muted text-muted-foreground", vien: "border-border" },
};

const COT_LG: Record<number, string> = {
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
function cotTuDong(soThe: number): 2 | 3 | 4 | 5 {
  if (soThe <= 2) return 2;
  if (soThe === 3 || soThe === 6 || soThe === 9) return 3;
  if (soThe === 5) return 5;
  return 4;
}

export function ThongKe({
  the,
  cot,
  className,
}: {
  the: TheThongTin[];
  /** Số cột tối đa (màn rộng). Bỏ trống ⇒ tự suy theo số thẻ (xem `cotTuDong`). */
  cot?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const soCot = cot ?? cotTuDong(the.length);
  // 5 cột trên màn rộng: thẻ hẹp ⇒ icon lên trên nhãn, số nhỏ một bậc, để số dài
  // (1.478.897,83 kg · 29.535.327.023 đ) vẫn nằm trọn một dòng, không ngắt giữa số.
  const hep = soCot === 5;
  return (
    <div
      className={cn(
        // Điện thoại: bề ngang tối thiểu mỗi thẻ tính theo rem ⇒ cỡ chữ thường 2 cột,
        // phóng chữ 130% tự rơi về 1 cột (khỏi bẻ vụn số). Từ md giữ 2 cột như cũ.
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3 md:grid-cols-2 md:gap-4",
        COT_LG[soCot] ?? "lg:grid-cols-4",
        // Thẻ cuối lẻ trải hết hàng thay vì bỏ trống nửa hàng (1/-1 không đẻ cột ẩn).
        "[&>*:last-child:nth-child(odd)]:col-[1/-1] lg:[&>*:last-child:nth-child(odd)]:col-auto",
        className
      )}
    >
      {the.map((t) => {
        const mau = MAU[t.mau ?? "brand"];
        const Icon = t.icon;
        const isString = typeof t.giaTri === "string";
        const len = isString ? (t.giaTri as string).length : 0;
        // Chuỗi vừa (ngày "21/08/2026"…) để cỡ nhỏ đủ HIỆN TRỌN 1 dòng trong thẻ
        // hẹp nhất (mobile 2 cột) — không bẻ dòng giữa số, không cắt mất năm.
        // Chuỗi thật dài (>12) mới cho ngắt từ; số (t.so) luôn to.
        const fontSizeClass = t.so
          ? hep
            ? "text-xl md:text-2xl xl:text-lg 2xl:text-xl"
            : "text-xl md:text-2xl"
          : len > 12
            ? "text-sm font-semibold leading-snug lg:text-base"
            : len > 7
              ? "text-xs md:text-sm"
              : "text-base md:text-lg lg:text-xl";

        const noiDung = (
          <>
            {Icon && (
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  mau.chip
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            )}
            <div className="w-full min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground break-words">
                {t.nhan}
              </p>
              <p
                className={cn(
                  "min-w-0 text-foreground leading-tight",
                  // Số & chuỗi ngắn để bold cho nổi; chuỗi vừa/dài (ngày…) chỉ
                  // semibold để hẹp hơn, vừa thẻ mà không cắt chữ.
                  t.so || len <= 7 ? "font-bold" : "font-semibold",
                  // Số (tiền/kg) KHÔNG truncate — thà bẻ dòng còn hơn cắt mất chữ
                  // số. Chỉ chuỗi vừa (ngày…) mới truncate cho gọn 1 dòng.
                  t.so || len > 12 ? "break-words" : "truncate",
                  fontSizeClass,
                  t.so && "tnum"
                )}
              >
                {t.giaTri}
              </p>
              {t.phu && (
                <p className="text-sm text-muted-foreground break-words">{t.phu}</p>
              )}
            </div>
          </>
        );
        const cls = cn(
          "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3",
          hep && "xl:flex-col xl:items-start xl:gap-2",
          mau.vien
        );
        return t.onChon ? (
          <button
            key={t.nhan}
            type="button"
            onClick={t.onChon}
            title={t.moTaChon}
            aria-label={t.moTaChon ?? `Xem chi tiết: ${t.nhan}`}
            className={cn(
              cls,
              "cursor-pointer text-left transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            {noiDung}
          </button>
        ) : (
          <div key={t.nhan} className={cls}>
            {noiDung}
          </div>
        );
      })}
    </div>
  );
}
