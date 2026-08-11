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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";

export interface Cot<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Cột số: căn phải + tabular-nums */
  so?: boolean;
  /** Trường chính, hiện làm tiêu đề thẻ trên điện thoại */
  chinh?: boolean;
  /** Ẩn khỏi thẻ trên điện thoại (thông tin phụ) */
  anTrenDienThoai?: boolean;
  /** Giá trị dùng để sắp xếp. Không có → cột không sắp xếp được. */
  sapXep?: (row: T) => string | number;
}

type Huong = "tang" | "giam";

/**
 * RecordTable — một nguồn dữ liệu, hai hình thức.
 *
 *  Desktop  : bảng, dòng 56px, sọc xen kẽ, header không in hoa, bấm header
 *             để sắp xếp (mũi tên chỉ rõ đang sắp theo cột nào, chiều nào).
 *  Điện thoại: MỖI BẢN GHI MỘT THẺ, nhãn–giá trị xếp dọc; sắp xếp bằng
 *             danh sách nút thay cho header bảng.
 *
 * Không bao giờ bắt người dùng cuộn ngang để đọc số — cuộn ngang là chỗ hay
 * đọc nhầm dòng nhất.
 */
export function RecordTable<T>({
  columns,
  rows,
  getKey,
  actions,
  footer,
  emptyText = "Chưa có dữ liệu.",
  timKiem,
  nhanTimKiem = "Tìm trong bảng…",
  className,
}: {
  columns: Cot<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** Nút hành động cuối dòng / cuối thẻ. Phải là nút CÓ NHÃN CHỮ. */
  actions?: (row: T) => React.ReactNode;
  footer?: React.ReactNode;
  emptyText?: string;
  /** Có hàm này → hiện ô tìm kiếm ngay trên bảng. */
  timKiem?: (row: T) => string;
  nhanTimKiem?: string;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [sapTheo, setSapTheo] = React.useState<string | null>(null);
  const [huong, setHuong] = React.useState<Huong>("tang");

  const cotSapDuoc = columns.filter((c) => c.sapXep);

  const daLoc = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw || !timKiem) return rows;
    return rows.filter((r) => timKiem(r).toLowerCase().includes(kw));
  }, [rows, q, timKiem]);

  const daSap = React.useMemo(() => {
    const cot = columns.find((c) => c.key === sapTheo);
    if (!cot?.sapXep) return daLoc;
    const fn = cot.sapXep;
    return [...daLoc].sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "vi");
      return huong === "tang" ? cmp : -cmp;
    });
  }, [daLoc, columns, sapTheo, huong]);

  const doiSap = (key: string) => {
    if (sapTheo === key) {
      setHuong((h) => (h === "tang" ? "giam" : "tang"));
    } else {
      setSapTheo(key);
      setHuong("tang");
    }
  };

  const thanhCongCu = (timKiem || cotSapDuoc.length > 0) && rows.length > 0 && (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {timKiem && (
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={nhanTimKiem}
            aria-label={nhanTimKiem}
            className="pl-12"
          />
        </div>
      )}
      {/* Sắp xếp trên điện thoại: header bảng không hiện nên cần nút riêng */}
      {cotSapDuoc.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <span className="text-base text-muted-foreground">Sắp theo</span>
          {cotSapDuoc.map((c) => (
            <Button
              key={c.key}
              variant={sapTheo === c.key ? "default" : "outline"}
              size="sm"
              onClick={() => doiSap(c.key)}
            >
              {c.header}
              {sapTheo === c.key ? (
                huong === "tang" ? (
                  <ArrowUp />
                ) : (
                  <ArrowDown />
                )
              ) : null}
            </Button>
          ))}
        </div>
      )}
      {(q || sapTheo) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ("");
            setSapTheo(null);
          }}
        >
          <X />
          Bỏ lọc
        </Button>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 border-dashed border-border px-6 py-12 text-center text-base text-muted-foreground",
          className
        )}
      >
        {emptyText}
      </div>
    );
  }

  const cotChinh = columns.find((c) => c.chinh) ?? columns[0];

  return (
    // min-w-0: khi RecordTable là con của lưới (VD dashboard 2 cột), không cho
    // bảng ép ô rộng theo nội-dung-tối-thiểu → tránh tràn đè khối bên cạnh.
    <div className={cn("min-w-0 space-y-4", className)}>
      {thanhCongCu}

      {daSap.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-base text-muted-foreground">
          Không có dòng nào khớp “{q}”.
        </div>
      ) : (
        <>
          {/* Desktop — cuộn ngang khi ô chứa hẹp (VD nằm trong lưới 2 cột) để bảng
              KHÔNG tràn đè khối bên cạnh; đủ rộng thì không có thanh cuộn. */}
          <div className="scroll-nice hidden overflow-x-auto rounded-xl ring-1 ring-foreground/10 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead
                      key={c.key}
                      className={cn(c.so && "text-right", "p-0")}
                      aria-sort={
                        sapTheo === c.key
                          ? huong === "tang"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {c.sapXep ? (
                        <button
                          type="button"
                          onClick={() => doiSap(c.key)}
                          className={cn(
                            "flex h-14 w-full items-center gap-2 px-4 text-base font-semibold hover:bg-accent",
                            c.so && "justify-end"
                          )}
                        >
                          {c.header}
                          {sapTheo === c.key ? (
                            huong === "tang" ? (
                              <ArrowUp className="size-5 text-primary" />
                            ) : (
                              <ArrowDown className="size-5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="size-5 text-muted-foreground/60" />
                          )}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "flex h-14 items-center px-4",
                            c.so && "justify-end"
                          )}
                        >
                          {c.header}
                        </span>
                      )}
                    </TableHead>
                  ))}
                  {actions && (
                    <TableHead className="text-right">Thao tác</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {daSap.map((r) => (
                  <TableRow key={getKey(r)}>
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={c.so ? "tnum text-right" : undefined}
                      >
                        {c.render(r)}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {actions(r)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              {footer && <TableFooter>{footer}</TableFooter>}
            </Table>
          </div>

          {/* Điện thoại / tablet dọc */}
          <ul className="space-y-3 md:hidden">
            {daSap.map((r) => (
              <li
                key={getKey(r)}
                className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              >
                <div className="mb-3 text-lg font-semibold text-foreground">
                  {cotChinh.render(r)}
                </div>
                <dl className="space-y-2">
                  {columns
                    .filter((c) => c !== cotChinh && !c.anTrenDienThoai)
                    .map((c) => (
                      <div
                        key={c.key}
                        className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-0"
                      >
                        <dt className="text-base text-muted-foreground">
                          {c.header}
                        </dt>
                        <dd
                          className={cn(
                            "text-right text-base font-medium",
                            c.so && "tnum"
                          )}
                        >
                          {c.render(r)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {actions && (
                  <div className="mt-4 flex flex-wrap gap-2">{actions(r)}</div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
