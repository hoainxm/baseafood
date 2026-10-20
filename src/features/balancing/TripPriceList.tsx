// ============================================================
// Tên file: src/features/balancing/TripPriceList.tsx
// Tên tiếng Việt: Bấm "theo chuyến" ở ô Đơn giá ⇒ xem giá từng chuyến của dòng
// Description: Clickable "per trip" price cell — popover listing every trip (date, supplier, kg, price, amount)
// ============================================================
// Người dùng hỏi 2026-10-20: giá "theo chuyến" muốn xem chi tiết thì làm sao? ⇒ bấm thẳng chữ
// "theo chuyến" ở ô Đơn giá là hiện ngay MỌI chuyến của dòng trong kỳ, có dòng cộng. Chỉ xem
// (không lớp phủ) — giá sửa ở màn Nhập hàng.
import { useState } from "react";
import type { MaterialImportItem } from "@/types";
import { calculateImportAmount } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system";
import { formatDayLabel } from "@/lib/balancingGrid";
import { num } from "@/lib/format";

export function TripPriceList({
  rowName,
  trips,
  label = "theo chuyến",
}: {
  rowName: string;
  trips: MaterialImportItem[];
  /** Chữ trên ô (2026-10-20: giá BÌNH QUÂN theo kg của dòng). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...trips]
    .filter((i) => i.quantityKg !== 0)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.supplierName.localeCompare(b.supplierName));
  const totalKg = sorted.reduce((s, i) => s + i.quantityKg, 0);
  const totalAmount = sorted.reduce((s, i) => s + calculateImportAmount(i), 0);
  /* Tên loại ngắn: bỏ phần LOÀI đứng trước con số đầu tiên của chính tên loại
     ("Bạch tuộc 2 da lớn (80↑)" ⇒ "2 da lớn (80↑)"); tên không có số thì giữ nguyên. */
  const shortType = (t: string) => t.replace(/^\D+?\s(?=\d)/u, "") || t;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tnum text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          title={`Giá bình quân theo kg của "${rowName}" — bấm xem giá từng chuyến (${sorted.length} chuyến).`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[min(32rem,calc(100vw-1rem))] p-3">
        <p className="mb-2 text-sm font-semibold">
          {rowName} · {sorted.length} chuyến
        </p>
        <table className="tnum w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 text-left font-medium">Ngày</th>
              <th className="py-1 pr-3 text-left font-medium">Đại lý · loại</th>
              <th className="py-1 pr-3 text-right font-medium">kg</th>
              <th className="py-1 pr-3 text-right font-medium">Giá</th>
              <th className="py-1 text-right font-medium">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-1 pr-3">{formatDayLabel(i.deliveryDate)}</td>
                <td className="py-1 pr-3">
                  {i.supplierName || "—"} · {shortType(i.materialTypeName)}
                </td>
                <td className="py-1 pr-3 text-right">{num(i.quantityKg)}</td>
                <td className="py-1 pr-3 text-right">
                  {i.unitPrice != null ? num(i.unitPrice) : <span className="text-destructive">chưa có giá</span>}
                </td>
                <td className="py-1 text-right">{i.unitPrice != null ? num(calculateImportAmount(i)) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-1 pr-3" colSpan={2}>
                Cộng
              </td>
              <td className="py-1 pr-3 text-right">{num(totalKg)}</td>
              <td />
              <td className="py-1 text-right">{num(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-sm text-muted-foreground">Chỉ xem — sửa giá ở màn Nhập hàng.</p>
      </PopoverContent>
    </Popover>
  );
}
