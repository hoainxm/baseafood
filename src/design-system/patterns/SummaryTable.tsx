// ============================================================
// Tên file cũ: src/design-system/patterns/BangTong.tsx
// Tên tiếng Việt: Bảng tổng hợp số liệu
// Description: Summary Table Pattern Component
// ============================================================
import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * BangTong — bảng tổng hợp cho các trang Báo cáo. Cột số căn phải (`tnum`), có
 * hàng TỔNG CỘNG ở chân với con số tự cộng theo `tong` của từng cột.
 *
 * Chỉ hiển thị số đã tổng hợp sẵn (component cha lo gom nhóm) — không đọc/ghi dữ
 * liệu. Dùng chung cho báo cáo Nhập hàng, Bán hàng… để mọi bảng báo cáo cùng dáng.
 */
export interface CotTong<T> {
  key: string;
  header: string;
  /** Ô của một dòng. */
  render: (row: T) => React.ReactNode;
  /** Cột số → căn phải + có ô tổng ở chân. */
  so?: boolean;
  /** Nội dung ô tổng cột (thường là tổng số). Bỏ trống ⇒ ô tổng để rỗng. */
  tong?: (rows: T[]) => React.ReactNode;
}

export function BangTong<T>({
  rows,
  cot,
  getKey,
  nhanTong = "Tổng cộng",
  emptyText = "Chưa có số liệu trong kỳ này.",
  className,
}: {
  rows: T[];
  cot: CotTong<T>[];
  getKey: (row: T, i: number) => string;
  nhanTong?: string;
  emptyText?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-base text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const coTong = cot.some((c) => c.tong);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {cot.map((c) => (
              <TableHead key={c.key} className={cn(c.so && "text-right")}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={getKey(r, i)}>
              {cot.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(c.so && "text-right tnum")}
                >
                  {c.render(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {coTong && (
          <TableFooter>
            <TableRow>
              {cot.map((c, i) => (
                <TableCell
                  key={c.key}
                  className={cn("font-bold", c.so && "text-right tnum")}
                >
                  {c.tong ? c.tong(rows) : i === 0 ? nhanTong : null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
