// ============================================================
// Tên file: src/features/balancing/ChuyenTrongO.tsx
// Tên tiếng Việt: Nút "n chuyến" trong ô ngày của lưới Nguyên liệu vào (Cân đối)
// Description: In-cell trip count + popover (supplier → shipment) for a grid day cell
// ============================================================
import { useState } from "react";
import { Truck } from "lucide-react";
import type { MaterialImportItem } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system";
import { chuyenTrongNgay, soChuyenNgay } from "@/lib/chuyenTrongNgay";
import { num, viDate } from "@/lib/format";

/**
 * Kế toán dò ô ngày của lưới: "1.530 kg ngày 21/07 này gồm những chuyến nào, của
 * đại lý nào". Nút nhỏ ngay dưới số trong ô; bấm mở danh sách đại lý → chuyến →
 * loại NL · kg · giá của ĐÚNG các dòng sổ nhập làm nên ô đó. CHỈ XEM — sửa số vẫn
 * gõ thẳng vào ô (ghi về sổ nhập) hoặc ở màn Nhập hàng.
 */
export function ChuyenTrongO({
  dong,
  ngay,
  maLo,
}: {
  /** Dòng sổ nhập làm nên dòng lưới (cả kỳ) — lọc theo ngày ở đây. */
  dong: MaterialImportItem[];
  ngay: string;
  /** shipmentId → mã lô (import_shipments.lot_code). */
  maLo: Map<string, string>;
}) {
  const [mo, setMo] = useState(false);
  const n = soChuyenNgay(dong, ngay);
  if (n === 0) return null;
  const daiLy = mo
    ? chuyenTrongNgay(dong, ngay, [...maLo].map(([id, lotCode]) => ({ id, lotCode })))
    : [];
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Không để phím Enter/↑↓ của lưới nhảy vào đây — nút phụ, không phải ô số.
          tabIndex={-1}
          title={`Xem ${n} chuyến nhập ngày ${viDate(ngay)}: đại lý nào, chuyến nào, bao nhiêu kg, giá bao nhiêu.`}
          className="inline-flex items-center gap-1 rounded px-1 text-sm whitespace-nowrap text-primary underline decoration-dotted underline-offset-2 hover:bg-accent"
        >
          <Truck className="size-3.5" aria-hidden />
          {n} chuyến
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[min(26rem,calc(100vw-1rem))] p-3">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Ngày {viDate(ngay)} · {n} chuyến · {num(daiLy.reduce((s, d) => s + d.kg, 0))} kg
          </p>
          {daiLy.map((d) => (
            <div key={d.daiLy} className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {d.daiLy}{" "}
                <span className="font-normal text-muted-foreground">
                  · {d.chuyen.length} chuyến · {num(d.kg)} kg
                  {d.tien > 0 ? ` · ${num(Math.round(d.tien))} đ` : ""}
                </span>
              </p>
              <ul className="space-y-1 border-l-2 border-border pl-3">
                {d.chuyen.map((c) => (
                  <li key={c.shipmentId} className="text-sm">
                    <span className="font-medium text-foreground">{c.nhan}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {num(c.kg)} kg{c.xe ? ` · ${c.xe}` : ""}
                    </span>
                    <ul className="text-muted-foreground">
                      {c.dong.map((x) => (
                        <li key={x.id} className="tnum">
                          {x.loai}: {num(x.kg)} kg
                          {x.donGia != null ? ` × ${num(x.donGia)} đ` : " · chưa có giá"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
