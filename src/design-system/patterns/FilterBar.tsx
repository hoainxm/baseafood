import * as React from "react";
import { ChevronDown, ChevronUp, FilterX, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Field } from "./Field";
import { useMediaQuery } from "./mediaQuery";

/** Điện thoại: số ô lọc luôn hiện (thường là kỳ xem + đối tượng chính); các ô sau gập vào "Thêm bộ lọc". */
const PHONE_VISIBLE_FILTERS = 2;

/**
 * FilterBar — khung bộ lọc của một sổ / bảng (ba-spec 53, README § Bộ lọc).
 * Hàng ô lọc (kỳ xem, đối tượng, trạng thái, ô tra) + khi có điều kiện đang bật: số dòng khớp và
 * "Bỏ hết bộ lọc (N)" (R6). Lọc là trình bày — không toast, không lưu (R8).
 */
export function FilterBar({
  children,
  activeCount = 0,
  onClearAll,
  resultText,
  actions,
  className,
  ...rest
}: {
  children: React.ReactNode;
  /**
   * Nút thao tác của TRANG (Xuất Excel, In, Thêm…) khi trang không có hàng tab — đứng cuối hàng lọc, dạt phải,
   * thay vì chiếm một hàng riêng phía trên (README § Đầu trang gọn).
   */
  actions?: React.ReactNode;
  /** Số điều kiện đang khác mặc định (KHÔNG tính kỳ xem) — `activeFilterCount` của lib/recordFilters. */
  activeCount?: number;
  /** Đưa mọi điều kiện về mặc định, giữ kỳ xem. */
  onClearAll?: () => void;
  /** VD "Đang hiện 12 / 40 phiếu" — chỉ hiện khi có điều kiện đang bật. */
  resultText?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  // Rà UX đợt 3 (2026-11-03): điện thoại có > 2 ô lọc ⇒ các ô sau gập lại (NXT kho: 5 ô + nút chiếm trọn màn đầu,
  // bảng bắt đầu ở 1.359px). Đang có điều kiện bật thì mở sẵn để thấy mình đang lọc gì.
  const items = React.Children.toArray(children);
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [showMore, setShowMore] = React.useState(activeCount > 0);
  const collapsible = isPhone && items.length > PHONE_VISIBLE_FILTERS;
  const shown = collapsible && !showMore ? items.slice(0, PHONE_VISIBLE_FILTERS) : items;
  const hiddenCount = items.length - PHONE_VISIBLE_FILTERS;
  return (
    // grid-cols-[minmax(0,1fr)] + max-w-full: ô lọc không đẩy khung tràn ngang. Điện thoại: mỗi ô một hàng, bỏ
    // min-w cố định (min-width thắng max-width — ô min-w-[16rem] = 333 px ở 130 % vẫn tràn nếu chỉ chặn max-w).
    // [&>*]:h-auto: `Field` có h-full — trong hàng flex xuống dòng nằm ở ô lưới (chiều cao xác định) nó cao bằng CẢ
    // khung, hàng đầu phình ra và hàng sau tràn khỏi viền, đè lên khối bên dưới (trang Người dùng 2026-11-02).
    // Thẳng đáy các ô đã có items-end lo.
    // max-sm basis-full: ô `flex-1` có flex-basis 0 ⇒ w-full không ép xuống dòng, cả hàng bị bóp dẹt ở 360px
    // (Bán hàng 2026-11-02). Điện thoại: mỗi ô một hàng thật.
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border-2 border-border p-3", className)} {...rest}>
      <div className="flex min-w-0 flex-wrap items-end gap-3 [&>*]:h-auto [&>*]:max-w-full max-sm:[&>*]:w-full max-sm:[&>*]:min-w-0 max-sm:[&>*]:basis-full">
        {shown}
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            title={showMore ? "Gập các ô lọc phụ lại cho gọn." : "Mở thêm các ô lọc phụ."}
          >
            {showMore ? <ChevronUp className="mr-1 h-4 w-4" aria-hidden /> : <ChevronDown className="mr-1 h-4 w-4" aria-hidden />}
            {showMore ? "Thu gọn bộ lọc" : `Thêm bộ lọc (${hiddenCount} ô)`}
          </Button>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-end justify-end gap-2">{actions}</div>}
      </div>
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {resultText && <span className="tnum text-sm text-muted-foreground">{resultText}</span>}
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              title="Bỏ mọi điều kiện lọc, về sổ đầy đủ của kỳ đang xem (kỳ giữ nguyên)."
            >
              <FilterX className="mr-1 h-4 w-4" aria-hidden />
              Bỏ hết bộ lọc ({activeCount})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SearchField — ô tra có NHÃN (luật 5: chữ mờ không thay nhãn). So khớp bỏ dấu ở
 * `matchesSearch` (lib/recordFilters). Nhãn nói rõ tra được gì: "Tra khách, mặt hàng, số phiếu".
 */
export function SearchField({
  label,
  value,
  onChange,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} hideRequiredMark className={cn("min-w-[14rem] flex-1", className)}>
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** R7: lọc ra 0 dòng (kỳ CÓ dòng) — khác lời "kỳ này chưa có dòng nào". */
export function NoMatchState({ onClearAll }: { onClearAll?: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      title="Không có dòng nào khớp bộ lọc"
      description="Đổi điều kiện lọc, hoặc bỏ hết bộ lọc để xem cả sổ của kỳ."
      action={
        onClearAll ? (
          <Button variant="outline" onClick={onClearAll} title="Bỏ mọi điều kiện lọc, về sổ đầy đủ của kỳ đang xem.">
            <FilterX className="mr-1 h-4 w-4" aria-hidden />
            Bỏ hết bộ lọc
          </Button>
        ) : undefined
      }
    />
  );
}
