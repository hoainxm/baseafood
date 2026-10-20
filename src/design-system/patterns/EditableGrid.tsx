// ============================================================
// Tên file: src/design-system/patterns/EditableGrid.tsx
// Tên tiếng Việt: Lưới nhập liệu kiểu bảng tính
// Description: Spreadsheet-like editable grid (day columns, paste from Excel)
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumber, parseVnNumber } from "./numberExpression";
import { ExpressionPreview } from "./NumberInput";
import { useNumberInput } from "./useNumberInput";
import { RowMarkToolbar } from "./RowMarkToolbar";
import { useTopScrollbar } from "./topScrollbar";
import { useFloatingTableHead } from "./floatingTableHead";
import { useRowSelection, useRowMarkTools } from "./rowMarkSource";
import { ColumnResizeHandle, measureFitWidth, useColumnWidths } from "./columnResize";
import { RotateCcw } from "lucide-react";

/**
 * EditableGrid — lưới nhập liệu thay cho "mở hộp thoại, điền, bấm lưu" từng dòng.
 *
 * Vì sao cần: người dùng đang làm bảng cân đối trên Excel. Nếu phần mềm bắt mở
 * hộp thoại cho từng ô sản lượng ngày thì Excel vẫn nhanh hơn và họ sẽ quay về
 * Excel. Lưới này giữ ba thứ Excel làm tốt — gõ liên tục, di chuyển bằng phím,
 * dán cả khối số — và bỏ hai thứ Excel làm dở: cột tổng gõ tay được (nguồn sai
 * số kinh điển) và công thức vỡ khi chèn dòng.
 *
 * Vẫn theo luật giao diện cho người lớn tuổi: ô cao ≥44px, nhãn cột luôn hiện,
 * cột tên dính bên trái để cuộn ngang không lạc dòng.
 */

export type GridCellKind = "input" | "computed" | "text";

export interface GridColumn<R> {
  key: string;
  header: React.ReactNode;
  /** Nhãn đọc cho trình đọc màn hình + tiêu đề khi thu gọn. */
  label: string;
  kind: GridCellKind;
  /** Giá trị hiện tại của ô. */
  getValue: (row: R) => number | null;
  /** Chuỗi hiển thị thay cho số (dùng cho cột chữ / cột tính đặc biệt). */
  renderValue?: (row: R) => React.ReactNode;
  /**
   * Ô điều khiển riêng (Combobox chọn khách, nút…). Khác `hien` ở chỗ nội dung
   * TƯƠNG TÁC được: ô không bọc lớp căn phải cứng và không bị coi là ô số.
   */
  renderCell?: (row: R) => React.ReactNode;
  /**
   * Phần PHỤ dưới giá trị của ô (ô gõ được hay ô khoá đều có) — VD nút "2 chuyến"
   * mở danh sách đại lý/chuyến của ngày đó. Trả `null` thì ô như cũ.
   */
  renderCellNote?: (row: R) => React.ReactNode;
  /** Ô này có khoá không (dòng hút từ sổ khác, dòng tổng…). */
  isLocked?: (row: R) => boolean;
  /** Lý do khoá — hiện thành tooltip, đừng để người dùng gõ vào ô câm. */
  lockReason?: (row: R) => string;
  /** Nhóm cột để gập chung (VD "ngay" cho toàn bộ cột ngày). */
  group?: string;
  /** Tô nền riêng (VD cột Chuyển kỳ). */
  tint?: "carry-over" | "computed" | "pulled";
  /** Rộng tối thiểu, px. */
  minWidth?: number;
  /**
   * Cột GIÃN lấp phần bề ngang còn lại (VD cột Ghi chú cuối lưới). Có ít nhất một cột
   * `fill` ⇒ mọi cột khác CO VỪA NỘI DUNG (không kéo giãn đều cả bảng) — chốt 2026-10-16.
   */
  fill?: boolean;
  /**
   * Bề rộng CỐ ĐỊNH (px) — cột không nhận phần dư khi bảng giãn hết khung (phần dư sang các cột
   * khác). VD cột Ghi chú dòng ở Cân đối: không cần ưu tiên hiển thị, đừng để nó phình to.
   */
  fixedWidth?: number;
  /** Căn chữ của ô khoá + tiêu đề (mặc định phải — cột số). Cột chữ dùng "left". */
  align?: "left" | "right";
  /**
   * Khoá bề rộng khi kéo giãn cột (`columnWidthsKey`): các cột CÙNG khoá dùng chung một bề rộng
   * (VD mọi cột ngày "day" — kỳ khác ngày khác vẫn giữ bề rộng đã chỉnh). Mặc định = `key`.
   */
  widthKey?: string;
}

export interface GridRow<R> {
  id: string;
  data: R;
  /** Dòng tiêu đề nhóm — chỉ hiện chữ, không có ô nhập. */
  groupTitle?: string;
  /**
   * Kiểu dòng: dòng giảm tô đỏ nhạt, dòng tổng in đậm, dòng con (chỉ đọc) thụt vào.
   * `detail` = hàng PHỤ GÕ ĐƯỢC của dòng ngay trên (VD "Giá gửi" theo ngày dưới dòng Gửi
   * đông): thụt vào như dòng con nhưng ô vẫn gõ được; không tick tô màu riêng.
   */
  kind?: "normal" | "decrease" | "total" | "child" | "detail";
  /** Tên hiện ở cột dính bên trái. */
  label: React.ReactNode;
  /** Chú thích nhỏ dưới tên (VD "hút từ sổ nhập hàng"). */
  subLabel?: React.ReactNode;
  /**
   * Nút thao tác CỦA DÒNG đặt cuối ô tên (VD 🗑 `InlineConfirmDelete` — xoá ngay tại dòng
   * đang nhìn thấy, 2026-10-20). Không truyền ⇒ như cũ.
   */
  actions?: React.ReactNode;
}

const TINT_CLASSES: Record<NonNullable<GridColumn<unknown>["tint"]>, string> = {
  "carry-over": "bg-warning-surface",
  computed: "bg-muted",
  pulled: "bg-primary/8",
};

/** Khoá bề rộng cột TÊN dòng (cột dính trái) khi kéo giãn cột. */
const ROW_HEADER_WIDTH_KEY = "__row-header";

/** Khoá ô để định vị khi di chuyển bằng phím. */
const cellKey = (rowId: string, colKey: string) => `${rowId}|${colKey}`;

export function EditableGrid<R>({
  columns,
  rows,
  onCellCommit,
  onPasteBlock,
  collapsedGroups = [],
  footer,
  className,
  description,
  rowHeaderLabel = "Mặt hàng",
  rowMarkKey,
  compact = false,
  rowHeaderMinWidth = 128,
  columnWidthsKey,
}: {
  columns: GridColumn<R>[];
  rows: GridRow<R>[];
  /** Ghi một ô. Trả về false nếu bị từ chối (VD ngày đã chốt, chưa có lý do). */
  onCellCommit: (rowId: string, colKey: string, value: number | null) => void | boolean;
  /**
   * Dán một khối số từ Excel: `khoi[i][j]` là ô ở dòng thứ i, cột thứ j tính từ
   * ô đang đứng. Không có hàm này thì lưới vẫn dán được từng ô một.
   */
  onPasteBlock?: (rowId: string, colKey: string, block: (number | null)[][]) => void;
  /** Nhóm cột đang thu gọn (VD ["day"]). */
  collapsedGroups?: string[];
  /** Dòng tổng cuối bảng, tự dựng ở màn gọi. */
  footer?: React.ReactNode;
  className?: string;
  /** Câu mô tả cho trình đọc màn hình. */
  description: string;
  /** Tên cột đầu (cột tên dòng, dính trái). Mặc định "Mặt hàng". */
  rowHeaderLabel?: string;
  /**
   * Tô màu dòng "đã dò" (lưu chung, mọi máy thấy): khoá ỔN ĐỊNH của lưới, VD
   * "can-doi-nl". Nút tô nằm trong ô tên dính trái; khoá dòng = `GridRow.id`
   * (phải là id bản ghi). Dòng tiêu đề nhóm không tô. Luật: README § Tô màu dòng.
   */
  rowMarkKey?: string;
  /**
   * Lưới GỌN cho bảng phải đứng CẠNH bảng khác trên một màn (VD bảng chính Cân đối A–L:
   * Nguyên liệu · Xuất khẩu · Ghi chú cạnh nhau để chụp gửi): cột tên KHÔNG đòi bề rộng theo
   * chữ dài nhất (chỉ `rowHeaderMinWidth`); khung chứa rộng hơn thì MỌI cột giãn theo tỷ lệ
   * (cột tên giãn ⇒ ô chọn lô / kho hiện đủ chữ); ô số co về đúng `minWidth` của cột (ô nhập mặc định của
   * trình duyệt rộng ~20 ký tự, tự kéo cột nở to); tên cột được xuống dòng.
   */
  compact?: boolean;
  /** Lưới gọn: bề rộng TỐI THIỂU cột tên (px, gồm cả đệm). Mặc định 128. */
  rowHeaderMinWidth?: number;
  /**
   * Bật KÉO GIÃN CỘT kiểu Excel: kéo mép phải tên cột để đổi bề rộng, nhấp đúp mép để vừa
   * nội dung, nút ↺ ở góc trả về mặc định. Khoá ỔN ĐỊNH của bảng (tiếng Anh) — bề rộng nhớ
   * theo máy (lib/devicePrefs). Không truyền ⇒ tắt.
   */
  columnWidthsKey?: string;
}) {
  const to = useRowMarkTools(rowMarkKey);
  // Tick dòng để tô màu / in đậm nhiều dòng một lúc (chỉ khi bật rowMarkKey).
  const rowSelection = useRowSelection();
  // Thanh cuộn ngang TRÊN đầu lưới (README § 5a) — lưới ngày của Cân đối rất rộng.
  const frameRef = React.useRef<HTMLDivElement>(null);
  const topScrollBar = useTopScrollbar(() => frameRef.current);
  // Lưới dài (nhiều dòng NL / mặt hàng) ⇒ hàng tên cột (ngày) nổi dính dưới header trang.
  const floatingHead = useFloatingTableHead(() => frameRef.current);
  const oRef = React.useRef(new Map<string, HTMLInputElement>());
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !c.group || !collapsedGroups.includes(c.group)),
    [columns, collapsedGroups]
  );
  /** Có cột giãn ⇒ cột khác co vừa nội dung (width 1% + minWidth) để cột giãn ăn phần còn lại. */
  const hasFillColumn = visibleColumns.some((c) => c.fill);
  /* Bề rộng người dùng KÉO (kiểu Excel): cột đã chỉnh giữ ĐÚNG bề rộng đó; bảng đã có cột
     chỉnh thì co theo tổng bề rộng (w-max) thay vì giãn hết khung — giãn khung thì phần dư
     lại chia vào cột vừa chỉnh, kéo bao nhiêu cũng không ra đúng cỡ. */
  const resize = useColumnWidths(columnWidthsKey);
  const widthKeyOf = (c: GridColumn<R>) => c.widthKey ?? c.key;
  const customWidthStyle = (px: number | undefined): React.CSSProperties | undefined =>
    px ? { width: px, minWidth: px, maxWidth: px } : undefined;
  const columnWidthStyle = (c: GridColumn<R>): React.CSSProperties | undefined =>
    customWidthStyle(resize.widths[widthKeyOf(c)]) ??
    customWidthStyle(c.fixedWidth) ??
    (hasFillColumn
      ? c.fill
        ? { minWidth: c.minWidth ?? 160 }
        : { width: "1%", minWidth: c.minWidth }
      : c.minWidth
        ? // Lưới gọn: ĐẶT bề rộng ⇒ cột co đúng cỡ, tên cột dài tự xuống dòng (bảng co theo
          // nội dung thì tên cột không xuống dòng, cột nở theo cả câu tên).
          compact
          ? { width: c.minWidth, minWidth: c.minWidth }
          : { minWidth: c.minWidth }
        : undefined);
  /** Bề rộng đang thấy của mọi cột (đọc từ hàng tên cột) — chốt lại khi bắt đầu kéo. */
  const currentWidths = (th: HTMLTableCellElement): Record<string, number> => {
    const cells = th.parentElement instanceof HTMLTableRowElement ? Array.from(th.parentElement.cells) : [];
    const out: Record<string, number> = {};
    const keys = [ROW_HEADER_WIDTH_KEY, ...visibleColumns.map(widthKeyOf)];
    cells.forEach((cell, i) => {
      const k = keys[i];
      if (k && out[k] == null) out[k] = Math.round(cell.getBoundingClientRect().width);
    });
    return out;
  };
  const resizeHandle = (widthKey: string, label: string) =>
    resize.enabled ? (
      <ColumnResizeHandle
        label={label}
        onStart={(th) => resize.freeze(currentWidths(th))}
        onResize={(px) => resize.setWidth(widthKey, px)}
        onCommit={() => resize.persist()}
        onFit={(th) => resize.fit(widthKey, measureFitWidth(th))}
      />
    ) : null;
  /** Chỉ ô gõ được mới nằm trong đường đi của phím mũi tên. */
  const inputRows = React.useMemo(() => rows.filter((h) => !h.groupTitle), [rows]);
  // Dòng con (chỉ đọc, VD tách theo đại lý) không tick tô màu — tô ở dòng cha.
  const visibleKeys = inputRows.filter((h) => h.kind !== "child" && h.kind !== "detail").map((h) => h.id);
  const daTick = visibleKeys.filter((k) => rowSelection.selected.has(k));
  const isAllSelected = daTick.length > 0 && daTick.length === visibleKeys.length;

  /**
   * Nhảy sang ô gõ được kế tiếp theo hướng (dRow, dCol). Ô khoá bị bỏ qua chứ
   * không làm kẹt con trỏ; quét có giới hạn số bước để không treo khi cả lưới
   * chỉ toàn ô khoá.
   */
  const moveCell = (rowId: string, colKey: string, dRow: number, dCol: number) => {
    let r = inputRows.findIndex((h) => h.id === rowId);
    let c = visibleColumns.findIndex((x) => x.key === colKey);
    if (r < 0 || c < 0) return;
    const maxCount = inputRows.length * visibleColumns.length;
    for (let step = 0; step < maxCount; step++) {
      r += dRow;
      c += dCol;
      /* Đi hết hàng thì xuống dòng dưới, đúng thói quen Tab của Excel. */
      while (c >= visibleColumns.length) {
        c -= visibleColumns.length;
        r += 1;
      }
      while (c < 0) {
        c += visibleColumns.length;
        r -= 1;
      }
      const targetRow = inputRows[r];
      const targetColumn = visibleColumns[c];
      if (!targetRow || !targetColumn) return;
      const o = oRef.current.get(cellKey(targetRow.id, targetColumn.key));
      if (o) {
        o.focus();
        o.select();
        return;
      }
      /* Ô khoá: đi tiếp theo hàng ngang; đang đi dọc thì dừng ở cột này. */
      if (dRow !== 0 && dCol === 0) continue;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const k = e.key;
    if (k === "Enter" || k === "ArrowDown") {
      e.preventDefault();
      moveCell(rowId, colKey, 1, 0);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      moveCell(rowId, colKey, -1, 0);
    } else if (k === "Tab") {
      e.preventDefault();
      moveCell(rowId, colKey, 0, e.shiftKey ? -1 : 1);
    } else if (k === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault();
      moveCell(rowId, colKey, 0, 1);
    } else if (k === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      moveCell(rowId, colKey, 0, -1);
    }
  };

  /**
   * Dán từ Excel: clipboard là văn bản, dòng cách nhau bằng \n, cột bằng \t.
   * Ô rỗng giữ nguyên số cũ (null) thay vì xoá về 0 — dán nhầm một khối thưa
   * không được phép thổi bay số đã nhập.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n\r]/.test(text)) return; // dán một ô — để trình duyệt lo
    e.preventDefault();
    const block = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n+$/, "")
      .split("\n")
      .map((row) =>
        row.split("\t").map((o) => {
          const t = o.trim();
          if (!t) return null;
          /* Kế toán ghi số âm bằng ngoặc: (2.000) = −2.000 */
          const am = /^\(.*\)$/.test(t);
          const num = parseVnNumber(am ? t.slice(1, -1) : t);
          if (num == null) return null;
          return am ? -num : num;
        })
      );
    if (onPasteBlock) {
      onPasteBlock(rowId, colKey, block);
      return;
    }
    /* Không khai onDanKhoi → rải từng ô qua onGhiO. */
    const iH = inputRows.findIndex((h) => h.id === rowId);
    const iC = visibleColumns.findIndex((c) => c.key === colKey);
    block.forEach((row, i) =>
      row.forEach((v, j) => {
        if (v == null) return;
        const h = inputRows[iH + i];
        const c = visibleColumns[iC + j];
        if (h && c && c.kind === "input" && !c.isLocked?.(h.data)) onCellCommit(h.id, c.key, v);
      })
    );
  };

  return (
    <>
    {floatingHead}
    {topScrollBar}
    <div
      ref={frameRef}
      className={cn(
        "scroll-nice-x overflow-x-auto rounded-xl ring-1 ring-foreground/10",
        className
      )}
    >
      {/* Tên bảng đặt bằng aria-label, KHÔNG dùng <caption className="sr-only">:
          sr-only là position:absolute, mà hộp cuộn ngoài không phải khối định vị
          ⇒ caption rơi ra toạ độ trang, đội chiều cao trang lên và sinh thêm một
          thanh cuộn dọc + mảng trắng dưới cùng. */}
      <table className={cn("border-collapse text-sm", resize.isCustomized ? "w-max" : "w-full")} aria-label={description}>
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                ...(hasFillColumn ? { width: "1%" } : {}),
                // Lưới gọn: cột tên cũng ĐẶT bề rộng ⇒ mọi cột đều có bề rộng đặt, khung giãn thì
                // phần dư chia THEO TỶ LỆ cho mọi cột (như kéo rộng bảng Excel) — không dồn hết
                // vào cột tên để cột số vẫn sát mức tối thiểu.
                ...(compact ? { width: rowHeaderMinWidth, minWidth: rowHeaderMinWidth } : {}),
                // Bề rộng người dùng KÉO thắng mọi mặc định ở trên.
                ...customWidthStyle(resize.widths[ROW_HEADER_WIDTH_KEY]),
              }}
              className={cn(
                "sticky left-0 z-30 border-b-2 border-border bg-card py-3 text-left align-bottom text-sm font-semibold",
                compact ? "px-2" : "min-w-40 px-3 sm:min-w-52"
              )}
            >
              <span className="flex items-center gap-1">
                {to.enabled && (
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={isAllSelected}
                    onChange={() => rowSelection.toggleAll(visibleKeys, !isAllSelected)}
                    aria-label={isAllSelected ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
                    title={isAllSelected ? "Bỏ tick mọi dòng." : "Tick mọi dòng (để tô màu / in đậm cùng lúc)."}
                  />
                )}
                <span className="min-w-0 flex-1">{rowHeaderLabel}</span>
                {resize.isCustomized && (
                  <button
                    type="button"
                    onClick={resize.reset}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Trả bề rộng mọi cột của bảng này về mặc định."
                    aria-label="Trả bề rộng cột về mặc định"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                  </button>
                )}
              </span>
              {resizeHandle(ROW_HEADER_WIDTH_KEY, rowHeaderLabel)}
            </th>
            {visibleColumns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={columnWidthStyle(c)}
                className={cn(
                  "relative border-b-2 border-l border-border bg-card px-2 py-3 align-bottom text-sm font-semibold",
                  !compact && !resize.widths[widthKeyOf(c)] && "whitespace-nowrap",
                  c.align === "left" ? "text-left" : "text-right",
                  c.tint === "carry-over" && "text-warning"
                )}
              >
                {c.header}
                {resizeHandle(widthKeyOf(c), c.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) =>
            h.groupTitle ? (
              <tr key={h.id}>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="sticky left-0 border-b border-border bg-muted px-4 py-2 text-left text-sm font-semibold text-muted-foreground"
                >
                  {h.groupTitle}
                </td>
              </tr>
            ) : (
              <tr
                key={h.id}
                className={cn(
                  h.kind === "decrease" && "bg-warning-surface/40",
                  h.kind === "total" && "bg-muted font-semibold",
                  h.kind === "child" && "text-muted-foreground"
                )}
                {...(h.kind === "child" || h.kind === "detail" ? {} : to.getRowProps(h.id))}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-r-2 border-b border-border py-2 text-left align-middle font-normal",
                    compact ? "px-2" : "px-3",
                    h.kind === "total" ? "bg-muted font-semibold" : h.kind === "child" ? "bg-muted" : "bg-card",
                    h.kind === "decrease" && "bg-warning-surface/40",
                    // Dòng con / hàng phụ: thụt vào + vạch trái nhạt ⇒ đọc ra "thuộc dòng trên".
                    (h.kind === "child" || h.kind === "detail") && "pl-10 text-sm shadow-[inset_3px_0_0_var(--border)]"
                  )}
                >
                  {/* Có cột giãn ⇒ cột tên co vừa nội dung nhưng CHẶN 18rem: ô chọn lô / NL chữ dài
                      tự cắt "…" thay vì kéo cả cột rộng ra. Lưới gọn: `contain: inline-size` ⇒
                      chữ / ô chọn không đòi bề rộng (cột chỉ đòi rowHeaderMinWidth) nhưng vẫn
                      dùng HẾT bề rộng cột khi khung chứa giãn. */}
                  <div
                    className={cn(
                      "flex items-start gap-2",
                      // Đã kéo bề rộng cột tên ⇒ chữ / ô chọn theo đúng cột đó, không chặn 18rem.
                      compact || resize.widths[ROW_HEADER_WIDTH_KEY] ? "[contain:inline-size]" : hasFillColumn && "max-w-[18rem]"
                    )}
                  >
                    {to.enabled && h.kind !== "child" && h.kind !== "detail" && (
                      <input
                        type="checkbox"
                        className="mt-0.5 size-5 shrink-0"
                        checked={rowSelection.selected.has(h.id)}
                        onChange={() => {}}
                        onClick={(e) => rowSelection.toggle(h.id, e.shiftKey, visibleKeys)}
                        aria-label={`Chọn dòng ${typeof h.label === "string" ? h.label : h.id}`}
                        title="Tick để tô màu / in đậm dòng này (Shift+tick chọn cả khoảng)."
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block leading-tight">{h.label}</span>
                      {h.subLabel && (
                        <span className="block text-sm text-muted-foreground">{h.subLabel}</span>
                      )}
                    </div>
                    {h.actions && <span className="shrink-0">{h.actions}</span>}
                  </div>
                </th>
                {visibleColumns.map((c) => {
                  const isReadOnly = h.kind === "total" || h.kind === "child";
                  const oRieng = isReadOnly ? undefined : c.renderCell?.(h.data);
                  const bikhoa = c.kind !== "input" || Boolean(c.isLocked?.(h.data)) || isReadOnly;
                  const phu = c.renderCellNote?.(h.data);
                  const gt = c.getValue(h.data);
                  const tint = c.tint ? TINT_CLASSES[c.tint] : undefined;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-l border-border p-0 text-right align-middle",
                        tint,
                        c.kind === "computed" && !tint && "bg-muted",
                        h.kind === "child" && "bg-muted/40 text-sm"
                      )}
                    >
                      {oRieng ? (
                        <div className="px-2 py-1 text-left">{oRieng}</div>
                      ) : bikhoa ? (
                        <span
                          title={c.lockReason?.(h.data)}
                          className={cn(
                            "tnum flex min-h-11 items-center px-2 py-2",
                            c.align === "left" ? "justify-start text-left" : "justify-end",
                            c.kind === "computed" && "font-semibold",
                            gt != null && gt < 0 && "text-destructive"
                          )}
                        >
                          {c.renderValue
                            ? c.renderValue(h.data)
                            : gt == null || gt === 0
                              ? <span className="text-muted-foreground">—</span>
                              : formatNumber(gt)}
                        </span>
                      ) : (
                        <GridCell
                          value={gt}
                          label={`${c.label} — ${typeof h.label === "string" ? h.label : "dòng"}`}
                          inputRef={(el) => {
                            const k = cellKey(h.id, c.key);
                            if (el) oRef.current.set(k, el);
                            else oRef.current.delete(k);
                          }}
                          onCommit={(v) => onCellCommit(h.id, c.key, v)}
                          onKeyDown={(e) => handleKeyDown(e, h.id, c.key)}
                          onPaste={(e) => handlePaste(e, h.id, c.key)}
                          compact={compact}
                        />
                      )}
                      {phu && <div className="flex justify-end px-1 pb-1">{phu}</div>}
                    </td>
                  );
                })}
              </tr>
            )
          )}
          {footer}
        </tbody>
      </table>
    </div>
    <RowMarkToolbar marker={to} selectedKeys={daTick} onClearSelection={rowSelection.clearSelection} />
    </>
  );
}

/**
 * Một ô số.
 *
 * Ghi ngay theo TỪNG PHÍM (như `NumberField` của bộ giao diện), không đợi rời ô:
 * cột Tổng, dòng T.CỘNG và khối kết quả phải nhúc nhích theo con số đang gõ.
 * Chờ đến lúc blur mới tính thì người dùng phải gõ hết cả bảng rồi mới biết
 * mình gõ đúng hay sai — đúng cái khó chịu khiến họ quay về Excel.
 *
 * Chuỗi đang gõ vẫn giữ ở state riêng để gõ được "-" hay "1," dở dang mà ô
 * không tự nhảy số dưới tay; dấu chấm phần nghìn chỉ hiện khi rời ô.
 */
function GridCell({
  value,
  label,
  inputRef,
  onCommit,
  onKeyDown,
  onPaste,
  compact = false,
}: {
  value: number | null;
  label: string;
  /** Lưới gọn: ô không tự đòi bề rộng mặc định (~20 ký tự) — co theo cột. */
  compact?: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onCommit: (v: number | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  // Lõi chung với NumberField: gõ số / biểu thức ("250+300", "=12x5"), ra số hợp
  // lệ mới ghi (ô lưới ghi THẲNG về sổ nguồn — biểu thức dở không được ghi tạm),
  // Esc trả số cũ, đang gõ biểu thức hiện "= kết quả" dưới ô.
  const { props: o, preview } = useNumberInput({ value, onChange: onCommit, emptyIsZero: true });

  return (
    <span className="relative block">
    <input
      ref={inputRef}
      value={o.value}
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      size={compact ? 1 : undefined}
      onChange={o.onChange}
      onFocus={o.onFocus}
      onBlur={o.onBlur}
      onPaste={onPaste}
      onKeyDown={(e) => {
        o.onKeyDown(e);
        if (!e.defaultPrevented) onKeyDown(e);
      }}
      className={cn(
        "tnum h-11 w-full border-0 bg-transparent px-2 text-right text-sm",
        compact ? "min-w-12" : "min-w-20",
        "focus:ring-2 focus:ring-ring focus:ring-inset focus:outline-none",
        value != null && value < 0 && "text-destructive"
      )}
    />
    <ExpressionPreview preview={preview} />
    </span>
  );
}
