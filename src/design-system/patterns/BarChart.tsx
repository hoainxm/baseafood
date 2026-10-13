// ============================================================
// Tên file cũ: src/design-system/patterns/BarChart.tsx
// Tên tiếng Việt: Biểu đồ cột ngang
// Description: Horizontal Bar Chart Component
// ============================================================
import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

/**
 * BarChart — biểu đồ thanh NGANG cho trang Báo cáo, kèm ĐƯỜNG TRUNG BÌNH.
 *
 * Thanh ngang (không phải cột đứng) vì nhãn là tên đại lý/khách dài, để ngang mới
 * đọc được; và người lớn tuổi so sánh độ dài thanh nhanh hơn đọc trục số. Một màu
 * thương hiệu duy nhất (không cầu vồng), đường trung bình nét đứt để thấy ngay
 * cái nào trên/dưới mức bình quân. Thuần HTML + token màu ⇒ ăn theo cỡ chữ, không
 * vỡ khi phóng 130%.
 *
 * Trải nghiệm: thanh "mọc" từ 0 khi vào màn (transition width), sáng + đổ bóng khi
 * di chuột; nếu mục có `chiTiet` thì hiện thẻ TÓM TẮT (fade + trượt nhẹ) khi hover.
 *
 * Chỉ vẽ số truyền vào — không đọc/ghi dữ liệu.
 */
export interface BarChartItem {
  label: string;
  value: number;
  /** Dòng phụ nhỏ dưới nhãn (VD kênh, loại). */
  subLabel?: string;
  /** Nội dung tóm tắt hiện khi DI CHUỘT vào thanh (VD phân rã theo đại lý/loại). */
  detail?: ReactNode;
}

export function BarChart({
  data,
  formatValue = (n) => n.toLocaleString("vi-VN"),
  unit,
  showAverageLine = true,
  maxItems = 12,
  preserveOrder = false,
  averageValue,
  className,
}: {
  data: BarChartItem[];
  /** Định dạng số cho nhãn giá trị (mặc định vi-VN). */
  formatValue?: (n: number) => string;
  unit?: string;
  showAverageLine?: boolean;
  /** Cắt bớt còn N thanh lớn nhất (gọn màn). */
  maxItems?: number;
  /**
   * Giữ NGUYÊN thứ tự `data` truyền vào (VD chuỗi theo ngày) thay vì sắp giảm
   * dần theo giá trị. Khi bật, `soDongToiDa` cắt từ đầu danh sách.
   */
  preserveOrder?: boolean;
  /**
   * Mốc vạch trung bình truyền sẵn (VD bình quân GIA QUYỀN của định mức) thay cho
   * trung bình cộng các thanh. Có giá trị này thì nhãn TB không làm tròn.
   */
  averageValue?: number;
  className?: string;
}) {
  const sap = preserveOrder ? [...data] : [...data].sort((a, b) => b.value - a.value);
  const visibleItems = sap.slice(0, maxItems);
  const con = sap.length - visibleItems.length;

  const max = Math.max(1, ...visibleItems.map((d) => d.value));
  const tb =
    averageValue ??
    (data.length > 0
      ? data.reduce((s, d) => s + d.value, 0) / data.length
      : 0);
  const tbPct = Math.min(100, (tb / max) * 100);

  // Thanh "mọc" từ 0 → giá trị thật khi vào màn (và mượt theo khi số đổi).
  const [isShown, setIsShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (data.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để vẽ biểu đồ.
      </p>
    );
  }

  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <div className={cn("space-y-3 animate-in fade-in-0 duration-500", className)}>
      <div className="flex gap-3">
        {/* Cột nhãn */}
        <div className="w-28 shrink-0 space-y-2 sm:w-40">
          {visibleItems.map((d) => (
            <div key={d.label} className="flex h-10 flex-col justify-center">
              <span className="truncate text-sm font-medium text-foreground">
                {d.label}
              </span>
              {d.subLabel && (
                <span className="truncate text-xs text-muted-foreground">
                  {d.subLabel}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Cột thanh — đường trung bình phủ toàn cột này */}
        <div className="relative flex-1 space-y-2">
          {visibleItems.map((d, index) => {
            const pct = Math.max(2, (d.value / max) * 100);
            // Nửa trên: thẻ xổ XUỐNG; nửa dưới: thẻ xổ LÊN → luôn trong vùng chart.
            const isBottomHalf = index < visibleItems.length / 2;
            return (
              <div key={d.label} className="group relative h-10">
                <div className="absolute inset-0 rounded-md bg-muted transition-colors group-hover:bg-muted/70" />
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-primary shadow-sm transition-all duration-700 ease-out group-hover:bg-primary/90 group-hover:shadow-md"
                  style={{ width: isShown ? `${pct}%` : "0%" }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-sm font-semibold tnum text-foreground transition-transform duration-150 group-hover:scale-105">
                  {formatValue(d.value)}
                  {unitSuffix}
                </span>

                {/* Thẻ tóm tắt khi di chuột (fade + trượt nhẹ) */}
                {d.detail != null && (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute left-1/2 z-40 w-max max-w-[16rem] sm:max-w-[26rem] -translate-x-1/2 scale-95 rounded-lg border-2 border-border bg-card p-3.5 text-left text-sm text-foreground opacity-0 shadow-xl transition-all duration-150 ease-out group-hover:scale-100 group-hover:opacity-100",
                      isBottomHalf
                        ? "top-full mt-2 -translate-y-1 group-hover:translate-y-0"
                        : "bottom-full mb-2 translate-y-1 group-hover:translate-y-0"
                    )}
                  >
                    {d.detail}
                  </div>
                )}
              </div>
            );
          })}

          {/* Đường trung bình */}
          {showAverageLine && tb > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-warning transition-all duration-700 ease-out"
              style={{ left: `${isShown ? tbPct : 0}%` }}
              aria-hidden
            >
              <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-warning px-1.5 py-0.5 text-xs font-semibold text-warning-foreground">
                TB {formatValue(averageValue != null ? tb : Math.round(tb))}
                {unitSuffix}
              </span>
            </div>
          )}
        </div>
      </div>

      {con > 0 && (
        <p className="text-sm text-muted-foreground">
          … và {con} mục nhỏ hơn không hiển thị (đã gộp vào tổng ở bảng).
        </p>
      )}
    </div>
  );
}
