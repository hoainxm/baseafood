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
 * Tick chọn dòng (tuỳ chọn). Bật lên thì BangTong thêm một cột ô tick ở đầu bảng;
 * màn hình tự giữ tập khóa đã chọn để cộng tổng / thao tác theo lô — như các phần
 * mềm kế toán kho (chọn vài dòng → xem tổng, gán kho, in riêng).
 */
export interface ChonBang<T = unknown> {
  /** Khóa (getKey) của các dòng đang tick. */
  daChon: Set<string>;
  /** Bật/tắt MỘT dòng. */
  doi: (key: string) => void;
  /** Bật/tắt TOÀN BỘ dòng đang hiện trong bảng này. */
  doiTatCa: (keys: string[], bat: boolean) => void;
  /** Nhãn a11y cho ô tick từng dòng (VD "2 DA 250UP"). */
  nhanDong?: (row: T) => string;
}

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

/**
 * BangTong — bảng tổng hợp cho các trang Báo cáo. Cột số căn phải (`tnum`), có
 * hàng TỔNG CỘNG ở chân với con số tự cộng theo `tong` của từng cột.
 *
 * Chỉ hiển thị số đã tổng hợp sẵn (component cha lo gom nhóm) — không đọc/ghi dữ
 * liệu. Dùng chung cho báo cáo Nhập hàng, Bán hàng… để mọi bảng báo cáo cùng dáng.
 */
export function BangTong<T>({
  rows,
  cot,
  getKey,
  nhanTong = "Tổng cộng",
  emptyText = "Chưa có số liệu trong kỳ này.",
  className,
  chon,
  dinhDau,
}: {
  rows: T[];
  cot: CotTong<T>[];
  getKey: (row: T, i: number) => string;
  nhanTong?: string;
  emptyText?: string;
  className?: string;
  /** Bật cột ô tick để chọn dòng (cộng tổng / thao tác theo lô). */
  chon?: ChonBang<T>;
  /**
   * Giữ hàng tên cột dính trên cùng khi cuộn dọc. Bảng dài tự cuộn trong khung
   * cao tối đa ~70% màn hình (cần khung cuộn riêng vì bảng rộng đã cuộn ngang —
   * sticky theo trang không chạy xuyên qua khung cuộn ngang).
   */
  dinhDau?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const coTong = cot.some((c) => c.tong);
  const khoa = rows.map((r, i) => getKey(r, i));
  const soChon = chon ? khoa.filter((k) => chon.daChon.has(k)).length : 0;
  const chonHet = soChon > 0 && soChon === khoa.length;

  return (
    <div className={cn(dinhDau ? "bang-dinh-dau" : "scroll-nice-x overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {chon && (
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={chonHet}
                  onChange={() => chon.doiTatCa(khoa, !chonHet)}
                  aria-label={chonHet ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
                />
              </TableHead>
            )}
            {cot.map((c) => (
              <TableHead key={c.key} className={cn(c.so && "text-right")}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const k = getKey(r, i);
            const tick = !!chon?.daChon.has(k);
            return (
              <TableRow key={k} data-chon={tick || undefined} className={cn(tick && "bg-primary/5")}>
                {chon && (
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={tick}
                      onChange={() => chon.doi(k)}
                      aria-label={`Chọn dòng ${chon.nhanDong ? chon.nhanDong(r) : k}`}
                    />
                  </TableCell>
                )}
                {cot.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(c.so && "text-right tnum")}
                  >
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
        {coTong && (
          <TableFooter>
            <TableRow>
              {chon && <TableCell />}
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
