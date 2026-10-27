// ============================================================
// Tên file cũ: src/design-system/patterns/SummaryTable.tsx
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
import { RowMarkToolbar } from "./RowMarkToolbar";
import { useTopScrollbar } from "./topScrollbar";
import { useRowSelection, useRowMarkTools } from "./rowMarkSource";
import { ariaSort, SortHeaderButton, useTableSort } from "./SortableHeader";
import { nodeText, type SortKind, type SortValue } from "./tableSort";

/**
 * Tick chọn dòng (tuỳ chọn). Bật lên thì SummaryTable thêm một cột ô tick ở đầu bảng;
 * màn hình tự giữ tập khóa đã chọn để cộng tổng / thao tác theo lô — như các phần
 * mềm kế toán kho (chọn vài dòng → xem tổng, gán kho, in riêng).
 */
export interface TableSelection<T = unknown> {
  /** Khóa (getKey) của các dòng đang tick. */
  selectedKeys: Set<string>;
  /** Bật/tắt MỘT dòng. */
  toggle: (key: string) => void;
  /** Bật/tắt TOÀN BỘ dòng đang hiện trong bảng này. */
  toggleAll: (keys: string[], bat: boolean) => void;
  /** Nhãn a11y cho ô tick từng dòng (VD "2 DA 250UP"). */
  getRowLabel?: (row: T) => string;
}

export interface SummaryTableColumn<T> {
  key: string;
  header: string;
  /** Ô của một dòng. */
  render: (row: T) => React.ReactNode;
  /** Cột số → căn phải + có ô tổng ở chân. */
  numeric?: boolean;
  /** Nội dung ô tổng cột (thường là tổng số). Bỏ trống ⇒ ô tổng để rỗng. */
  total?: (rows: T[]) => React.ReactNode;
  /**
   * Giá trị để sắp khi bấm tên cột (số thô / ngày ISO / chữ). Bỏ trống ⇒ lấy chữ đang hiện
   * trong ô. PHẢI khai khi ô là ô nhập / nút / huy hiệu không có chữ (README § Sắp xếp cột).
   */
  sortValue?: (row: T) => SortValue;
  /** Kiểu sắp: "text" A→Z · "number" bé→lớn · "date" cũ→mới. Bỏ trống ⇒ cột numeric là số, còn lại tự đoán. */
  sortKind?: SortKind;
  /** false ⇒ cột này không sắp được (cột nút, cột ảnh…). */
  sortable?: boolean;
}

/**
 * SummaryTable — bảng tổng hợp cho các trang Báo cáo. Cột số căn phải (`tnum`), có
 * hàng TỔNG CỘNG ở chân với con số tự cộng theo `tong` của từng cột.
 *
 * Chỉ hiển thị số đã tổng hợp sẵn (component cha lo gom nhóm) — không đọc/ghi dữ
 * liệu. Dùng chung cho báo cáo Nhập hàng, Bán hàng… để mọi bảng báo cáo cùng dáng.
 */
export function SummaryTable<T>({
  rows,
  columns,
  getKey,
  totalLabel = "Tổng cộng",
  emptyText = "Chưa có số liệu trong kỳ này.",
  className,
  selection,
  stickyHeader,
  fullHeight,
  addRow,
  rowMarkKey,
  sortable = true,
}: {
  rows: T[];
  columns: SummaryTableColumn<T>[];
  getKey: (row: T, i: number) => string;
  totalLabel?: string;
  emptyText?: string;
  className?: string;
  /** Bật cột ô tick để chọn dòng (cộng tổng / thao tác theo lô). */
  selection?: TableSelection<T>;
  /**
   * Giữ hàng tên cột dính trên cùng khi cuộn dọc. Bảng dài tự cuộn trong khung
   * cao tối đa ~70% màn hình (cần khung cuộn riêng vì bảng rộng đã cuộn ngang —
   * sticky theo trang không chạy xuyên qua khung cuộn ngang).
   */
  stickyHeader?: boolean;
  /**
   * XỔ bảng ra (thay cho `stickyHeader`): KHÔNG khung cuộn riêng — bảng dài trải hết,
   * trang cuộn một mạch. Hàng tên cột NỔI dính ngay dưới header trang khi cuộn
   * qua bảng; bảng rộng thì thanh cuộn ngang DÍNH ĐÁY màn hình (không phải cuộn
   * xuống tận đáy bảng mới kéo ngang được). Dùng cho sổ dài kế toán dò từng dòng.
   * MẶC ĐỊNH BẬT từ 2026-10-16 (mọi bảng phải giữ hàng tên cột khi cuộn dài) — trừ khi
   * màn chọn `stickyHeader` (khung cuộn riêng) hoặc truyền `fullHeight={false}`.
   */
  fullHeight?: boolean;
  /**
   * Tô màu dòng "đã dò" (lưu chung, mọi máy thấy): khoá ỔN ĐỊNH của bảng, VD
   * "ton-kho-thang". Bật ⇒ thêm nút tô ở đầu mỗi dòng. `getKey` phải là id bản
   * ghi (không dùng chỉ số dòng). Luật: README § Tô màu dòng.
   */
  rowMarkKey?: string;
  /**
   * Dòng THÊM MỚI cuối thân bảng (trước hàng tổng), trải hết bề ngang — VD ô gõ tên
   * hàng để ghi dòng mới ngay trên bảng. Có `addRow` thì bảng rỗng vẫn hiện (để
   * còn chỗ thêm dòng đầu tiên).
   */
  addRow?: React.ReactNode;
  /**
   * Bấm tên cột để sắp (MẶC ĐỊNH BẬT — README § Sắp xếp cột). Tắt chỉ cho bảng mà thứ tự
   * dòng là nghĩa nghiệp vụ (dòng tổng / dòng nhóm xen giữa, sổ phải đọc theo thứ tự ghi).
   */
  sortable?: boolean;
}) {
  // Sắp theo cột: hàng tổng không đổi (cộng trên cùng tập dòng); `getKey` vẫn nhận chỉ số GỐC.
  const originalIndex = React.useMemo(() => new Map(rows.map((r, i) => [r, i])), [rows]);
  const keyOf = (r: T) => getKey(r, originalIndex.get(r) ?? 0);
  const tableSort = useTableSort(
    rows,
    getKey,
    columns.map((c) => ({
      key: c.key,
      // Cột không tên (cột nút thao tác) không sắp.
      sortable: c.sortable ?? Boolean(c.header),
      sortKind: c.sortKind,
      numeric: c.numeric,
      getValue: c.sortValue ?? ((r: T) => nodeText(c.render(r))),
    })),
    sortable
  );
  const viewRows = tableSort.rows;
  const isExpanded = fullHeight ?? !stickyHeader;
  const to = useRowMarkTools(rowMarkKey);
  // Tick dòng: màn truyền `chon` thì dùng của màn (màn tự đặt nút tô vào thanh
  // "Đã chọn" riêng); không thì bảng tự giữ + tự hiện thanh tô màu khi bật rowMarkKey.
  const internalSelection = useRowSelection();
  const neoTick = React.useRef<string | null>(null);
  // Thanh cuộn ngang TRÊN đầu bảng (README § 5a) — vùng cuộn thật là table-container.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const topScrollBar = useTopScrollbar(
    () => rootRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]') ?? null
  );
  // Bảng rỗng không có dòng thêm thì không vẽ bảng ⇒ khỏi đo.
  const { tableRef, sentinelRef: floatHeadRef, barRef, columnWidths, tableWidth, scrollWidth, tran, showHeader: showFloatHead } = useFullHeight(
    isExpanded && (rows.length > 0 || Boolean(addRow))
  );

  if (rows.length === 0 && !addRow) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const hasTotal = columns.some((c) => c.total);
  const rowKey = viewRows.map(keyOf);
  const effectiveSelection: TableSelection<T> | undefined =
    selection ??
    (to.enabled
      ? { selectedKeys: internalSelection.selected as Set<string>, toggle: (k) => internalSelection.toggle(k), toggleAll: internalSelection.toggleAll }
      : undefined);
  const daTick = effectiveSelection ? rowKey.filter((k) => effectiveSelection.selectedKeys.has(k)) : [];
  const isAllSelected = daTick.length > 0 && daTick.length === rowKey.length;
  /** Bấm ô tick; Shift ⇒ cả khoảng từ dòng bấm trước (như Shift+bấm ở Excel). */
  const bamTick = (k: string, shift: boolean) => {
    if (!effectiveSelection) return;
    const a = neoTick.current ? rowKey.indexOf(neoTick.current) : -1;
    const b = rowKey.indexOf(k);
    if (shift && a >= 0 && b >= 0) {
      effectiveSelection.toggleAll(rowKey.slice(Math.min(a, b), Math.max(a, b) + 1), !effectiveSelection.selectedKeys.has(k));
    } else effectiveSelection.toggle(k);
    neoTick.current = k;
  };

  const hasLeadColumn = Boolean(effectiveSelection);
  const columnCount = columns.length + (hasLeadColumn ? 1 : 0);
  /* Chữ "Cộng …" ở dòng tổng trải qua cột đầu dòng + các cột đầu KHÔNG có tổng —
     để trong một ô riêng thì chữ dài ("Cộng Nguyên liệu mua ngoài") đẩy cột đầu
     (VD Ngày nhập) rộng gấp rưỡi, cả bảng phải kéo ngang thêm. */
  const firstTotalIdx = Math.max(0, columns.findIndex((c) => c.total));
  const labelColumnCount = columns.some((c) => c.total) ? firstTotalIdx : columns.length;

  /** Hàng tên cột — vẽ ở bảng thật và (chế độ fullHeight) ở hàng tên cột nổi. */
  const headerRow = (isSticky: boolean) => (
    <TableRow>
      {effectiveSelection && (
        <TableHead className="w-10">
          <input
            type="checkbox"
            className="size-5"
            checked={isAllSelected}
            tabIndex={isSticky ? -1 : undefined}
            onChange={() => effectiveSelection.toggleAll(rowKey, !isAllSelected)}
            aria-label={isAllSelected ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
            title={isAllSelected ? "Bỏ tick mọi dòng của bảng này." : "Tick mọi dòng của bảng này (để tô màu / in đậm / in / xử lý cùng lúc)."}
          />
        </TableHead>
      )}
      {/* Tên cột XUỐNG DÒNG ("Nhập trong kỳ (kg)" thành 2 dòng): cột số rộng theo
          con số, không theo tên cột dài — bớt kéo ngang. */}
      {columns.map((c) => {
        const dir = tableSort.directionOf(c.key);
        return (
          <TableHead
            key={c.key}
            className={cn("leading-tight whitespace-normal", c.numeric && "text-right")}
            aria-sort={isSticky ? undefined : ariaSort(dir)}
          >
            {tableSort.isSortable(c.key) ? (
              <SortHeaderButton
                label={c.header}
                kind={tableSort.kindOf(c.key)}
                direction={dir}
                onToggle={() => tableSort.toggle(c.key)}
                align={c.numeric ? "right" : "left"}
                tabIndex={isSticky ? -1 : undefined}
              />
            ) : (
              c.header
            )}
          </TableHead>
        );
      })}
    </TableRow>
  );

  return (
    <>
    <div
      ref={rootRef}
      className={cn(
        // fullHeight: gốc KHÔNG được là khung cuộn (sticky của hàng tên cột nổi và thanh
        // cuộn đáy bám theo khung cuộn của trang); cuộn ngang do khung của primitive.
        isExpanded ? "table-expanded relative" : stickyHeader ? "table-sticky-head" : "scroll-nice-x overflow-x-auto",
        className
      )}
    >
      {topScrollBar}
      {isExpanded && (
        // Hàng tên cột NỔI: hộp cao 0 dính dưới header trang (`top-header` = cùng
        // token `--spacing-header` với `h-header` của AppShell). Chỉ hiện khi hàng tên cột
        // thật đã trôi khỏi tầm nhìn mà bảng vẫn còn trên màn.
        <div className="pointer-events-none sticky top-header z-20 h-0 print:hidden" aria-hidden>
          <div
            ref={floatHeadRef}
            className={cn(
              "overflow-hidden bg-card shadow-sm ring-1 ring-border",
              showFloatHead ? "pointer-events-auto visible" : "invisible"
            )}
          >
            <table
              className="caption-bottom text-sm"
              style={{ width: tableWidth || undefined, tableLayout: "fixed" }}
            >
              <colgroup>
                {columnWidths.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <TableHeader>{headerRow(true)}</TableHeader>
            </table>
          </div>
        </div>
      )}
      <Table ref={tableRef}>
        <TableHeader>{headerRow(false)}</TableHeader>
        <TableBody>
          {viewRows.map((r) => {
            const k = keyOf(r);
            const tick = !!effectiveSelection?.selectedKeys.has(k);
            return (
              <TableRow
                key={k}
                data-picked={tick || undefined}
                className={cn(tick && "bg-primary/5")}
                {...to.getRowProps(k)}
              >
                {effectiveSelection && (
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={tick}
                      onChange={() => {}}
                      onClick={(e) => bamTick(k, e.shiftKey)}
                      aria-label={`Chọn dòng ${selection?.getRowLabel ? selection.getRowLabel(r) : k}`}
                    />
                  </TableCell>
                )}
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(c.numeric && "text-right tnum")}
                  >
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {addRow && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="bg-muted/30">
                {addRow}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {hasTotal && (
          <TableFooter>
            <TableRow>
              {(hasLeadColumn ? 1 : 0) + labelColumnCount > 0 && (
                <TableCell colSpan={(hasLeadColumn ? 1 : 0) + labelColumnCount} className="font-bold whitespace-normal">
                  {totalLabel}
                </TableCell>
              )}
              {columns.slice(labelColumnCount).map((c) => (
                <TableCell
                  key={c.key}
                  className={cn("font-bold", c.numeric && "text-right tnum")}
                >
                  {c.total ? c.total(rows) : null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
      {isExpanded && tran && (
        // Thanh cuộn ngang DÍNH ĐÁY màn hình, đồng bộ hai chiều với bảng.
        <div
          ref={barRef}
          className="table-scrollbar sticky bottom-0 z-20 bg-background/90 py-1 print:hidden"
          aria-hidden
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
    {/* Thanh tô màu cho dòng đang tick — chỉ khi BẢNG tự giữ tick (màn có `chon`
        riêng thì tự đặt RowMarkActions vào thanh "Đã chọn" của màn). */}
    {!selection && (
      <RowMarkToolbar
        marker={to}
        selectedKeys={daTick}
        onClearSelection={internalSelection.clearSelection}
        className={isExpanded ? "bottom-8" : undefined}
      />
    )}
    </>
  );
}

/**
 * Máy đo cho chế độ `fullHeight`: bề rộng từng cột (để hàng tên cột nổi khớp cột thật),
 * bảng có tràn ngang không, đồng bộ cuộn ngang bảng ⇄ hàng tên cột nổi ⇄ thanh
 * cuộn dính đáy, và lúc nào hiện hàng tên cột nổi.
 */
function useFullHeight(bat: boolean) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = React.useState<number[]>([]);
  const [tableWidth, setTableWidth] = React.useState(0);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const [isOverflowing, setTran] = React.useState(false);
  const [showHeader, setShowHeader] = React.useState(false);

  // Đo cột + tràn ngang mỗi khi bảng / khung đổi cỡ (gõ số, đổi cỡ chữ, thu thanh bên…).
  React.useLayoutEffect(() => {
    if (!bat) return;
    const table = tableRef.current;
    const container = table?.parentElement; // div[data-slot=table-container] của primitive
    if (!table || !container) return;
    const measure = () => {
      const o = table.tHead?.rows[0]?.cells;
      const ws = o ? Array.from(o, (c) => c.getBoundingClientRect().width) : [];
      setColumnWidths((prev) => (prev.length === ws.length && prev.every((w, i) => Math.abs(w - ws[i]) < 0.5) ? prev : ws));
      setTableWidth(table.getBoundingClientRect().width);
      setScrollWidth(container.scrollWidth);
      setTran(container.scrollWidth > container.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    ro.observe(container);
    for (const c of Array.from(table.tHead?.rows[0]?.cells ?? [])) ro.observe(c);
    return () => ro.disconnect();
  }, [bat]);

  // Đồng bộ cuộn ngang ba phía. Gán scrollLeft bằng giá trị đang có thì trình
  // duyệt không bắn sự kiện ⇒ không vòng lặp.
  React.useEffect(() => {
    if (!bat) return;
    const container = tableRef.current?.parentElement;
    if (!container) return;
    const theoBang = () => {
      if (sentinelRef.current) sentinelRef.current.scrollLeft = container.scrollLeft;
      if (barRef.current) barRef.current.scrollLeft = container.scrollLeft;
    };
    const syncFromBar = () => {
      if (barRef.current) container.scrollLeft = barRef.current.scrollLeft;
    };
    const bar = barRef.current;
    container.addEventListener("scroll", theoBang, { passive: true });
    bar?.addEventListener("scroll", syncFromBar, { passive: true });
    theoBang();
    return () => {
      container.removeEventListener("scroll", theoBang);
      bar?.removeEventListener("scroll", syncFromBar);
    };
  }, [bat, isOverflowing]);

  // Hiện hàng tên cột nổi khi hàng thật đã trôi lên dưới header trang và bảng
  // còn đủ cao bên dưới (gần đáy bảng thì ẩn để khỏi đè dòng tổng).
  React.useEffect(() => {
    if (!bat) return;
    const measure = () => {
      const table = tableRef.current;
      const head = table?.tHead;
      if (!table || !head) return;
      const top = sentinelRef.current?.parentElement?.getBoundingClientRect().top ?? 64;
      const r = table.getBoundingClientRect();
      const height = head.getBoundingClientRect().height;
      setShowHeader(r.top < top - 1 && r.bottom > top + height * 2);
    };
    measure();
    // capture: bắt cuộn của MỌI khung (cột nội dung desktop cuộn riêng, điện thoại cuộn trang).
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [bat]);

  return { tableRef, sentinelRef, barRef, columnWidths, tableWidth, scrollWidth, tran: isOverflowing, showHeader };
}
