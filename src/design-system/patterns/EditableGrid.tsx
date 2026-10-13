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
import { useRowSelection, useRowMarkTools } from "./rowMarkSource";

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

export type GridCellKind = "so" | "tinh" | "chu";

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
  tint?: "chuyen-ky" | "tinh" | "hut";
  /** Rộng tối thiểu, px. */
  minWidth?: number;
}

export interface GridRow<R> {
  id: string;
  data: R;
  /** Dòng tiêu đề nhóm — chỉ hiện chữ, không có ô nhập. */
  groupTitle?: string;
  /** Kiểu dòng: dòng giảm tô đỏ nhạt, dòng tổng in đậm. */
  kind?: "thuong" | "giam" | "tong" | "con";
  /** Tên hiện ở cột dính bên trái. */
  label: React.ReactNode;
  /** Chú thích nhỏ dưới tên (VD "hút từ sổ nhập hàng"). */
  subLabel?: React.ReactNode;
}

const TINT_CLASSES: Record<NonNullable<GridColumn<unknown>["tint"]>, string> = {
  "chuyen-ky": "bg-warning-surface",
  tinh: "bg-muted",
  hut: "bg-primary/8",
};

/** Khoá ô để định vị khi di chuyển bằng phím. */
const cellKey = (rowId: string, colKey: string) => `${rowId}|${colKey}`;

export function EditableGrid<R>({
  columns,
  rows: hang,
  onCellCommit,
  onPasteBlock,
  collapsedGroups = [],
  footer,
  className,
  description,
  rowHeaderLabel = "Mặt hàng",
  rowMarkKey,
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
  /** Nhóm cột đang thu gọn (VD ["ngay"]). */
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
}) {
  const to = useRowMarkTools(rowMarkKey);
  // Tick dòng để tô màu / in đậm nhiều dòng một lúc (chỉ khi bật rowMarkKey).
  const rowSelection = useRowSelection();
  // Thanh cuộn ngang TRÊN đầu lưới (README § 5a) — lưới ngày của Cân đối rất rộng.
  const frameRef = React.useRef<HTMLDivElement>(null);
  const topScrollBar = useTopScrollbar(() => frameRef.current);
  const oRef = React.useRef(new Map<string, HTMLInputElement>());
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !c.group || !collapsedGroups.includes(c.group)),
    [columns, collapsedGroups]
  );
  /** Chỉ ô gõ được mới nằm trong đường đi của phím mũi tên. */
  const inputRows = React.useMemo(() => hang.filter((h) => !h.groupTitle), [hang]);
  // Dòng con (chỉ đọc, VD tách theo đại lý) không tick tô màu — tô ở dòng cha.
  const visibleKeys = inputRows.filter((h) => h.kind !== "con").map((h) => h.id);
  const daTick = visibleKeys.filter((k) => rowSelection.daChon.has(k));
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

  const xuLyPhim = (e: React.KeyboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
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
      .map((dong) =>
        dong.split("\t").map((o) => {
          const t = o.trim();
          if (!t) return null;
          /* Kế toán ghi số âm bằng ngoặc: (2.000) = −2.000 */
          const am = /^\(.*\)$/.test(t);
          const so = parseVnNumber(am ? t.slice(1, -1) : t);
          if (so == null) return null;
          return am ? -so : so;
        })
      );
    if (onPasteBlock) {
      onPasteBlock(rowId, colKey, block);
      return;
    }
    /* Không khai onDanKhoi → rải từng ô qua onGhiO. */
    const iH = inputRows.findIndex((h) => h.id === rowId);
    const iC = visibleColumns.findIndex((c) => c.key === colKey);
    block.forEach((dong, i) =>
      dong.forEach((v, j) => {
        if (v == null) return;
        const h = inputRows[iH + i];
        const c = visibleColumns[iC + j];
        if (h && c && c.kind === "so" && !c.isLocked?.(h.data)) onCellCommit(h.id, c.key, v);
      })
    );
  };

  return (
    <>
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
      <table className="w-full border-collapse text-sm" aria-label={description}>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-30 min-w-40 border-b-2 border-border bg-card px-3 py-3 text-left align-bottom text-sm font-semibold sm:min-w-52"
            >
              <span className="flex items-center gap-1">
                {to.enabled && (
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={isAllSelected}
                    onChange={() => rowSelection.doiTatCa(visibleKeys, !isAllSelected)}
                    aria-label={isAllSelected ? "Bỏ chọn tất cả dòng" : "Chọn tất cả dòng"}
                    title={isAllSelected ? "Bỏ tick mọi dòng." : "Tick mọi dòng (để tô màu / in đậm cùng lúc)."}
                  />
                )}
                <span className="min-w-0 flex-1">{rowHeaderLabel}</span>
              </span>
            </th>
            {visibleColumns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                className={cn(
                  "border-b-2 border-l border-border bg-card px-2 py-3 text-right align-bottom text-sm font-semibold whitespace-nowrap",
                  c.tint === "chuyen-ky" && "text-warning"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hang.map((h) =>
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
                  h.kind === "giam" && "bg-warning-surface/40",
                  h.kind === "tong" && "bg-muted font-semibold",
                  h.kind === "con" && "text-muted-foreground"
                )}
                {...(h.kind === "con" ? {} : to.getRowProps(h.id))}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-r-2 border-b border-border px-3 py-2 text-left align-middle font-normal",
                    h.kind === "tong" ? "bg-muted font-semibold" : h.kind === "con" ? "bg-muted" : "bg-card",
                    h.kind === "giam" && "bg-warning-surface/40",
                    // Dòng con: thụt vào + vạch trái nhạt ⇒ đọc ra "thuộc dòng trên".
                    h.kind === "con" && "pl-10 text-sm shadow-[inset_3px_0_0_var(--border)]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {to.enabled && h.kind !== "con" && (
                      <input
                        type="checkbox"
                        className="mt-0.5 size-5 shrink-0"
                        checked={rowSelection.daChon.has(h.id)}
                        onChange={() => {}}
                        onClick={(e) => rowSelection.doi(h.id, e.shiftKey, visibleKeys)}
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
                  </div>
                </th>
                {visibleColumns.map((c) => {
                  const isReadOnly = h.kind === "tong" || h.kind === "con";
                  const oRieng = isReadOnly ? undefined : c.renderCell?.(h.data);
                  const bikhoa = c.kind !== "so" || Boolean(c.isLocked?.(h.data)) || isReadOnly;
                  const phu = c.renderCellNote?.(h.data);
                  const gt = c.getValue(h.data);
                  const tint = c.tint ? TINT_CLASSES[c.tint] : undefined;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-l border-border p-0 text-right align-middle",
                        tint,
                        c.kind === "tinh" && !tint && "bg-muted",
                        h.kind === "con" && "bg-muted/40 text-sm"
                      )}
                    >
                      {oRieng ? (
                        <div className="px-2 py-1 text-left">{oRieng}</div>
                      ) : bikhoa ? (
                        <span
                          title={c.lockReason?.(h.data)}
                          className={cn(
                            "tnum flex min-h-11 items-center justify-end px-2 py-2",
                            c.kind === "tinh" && "font-semibold",
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
                          onKeyDown={(e) => xuLyPhim(e, h.id, c.key)}
                          onPaste={(e) => handlePaste(e, h.id, c.key)}
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
    <RowMarkToolbar marker={to} selectedKeys={daTick} onClearSelection={rowSelection.boChon} />
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
  onKeyDown: onPhim,
  onPaste,
}: {
  value: number | null;
  label: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onCommit: (v: number | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  // Lõi chung với NumberField: gõ số / biểu thức ("250+300", "=12x5"), ra số hợp
  // lệ mới ghi (ô lưới ghi THẲNG về sổ nguồn — biểu thức dở không được ghi tạm),
  // Esc trả số cũ, đang gõ biểu thức hiện "= kết quả" dưới ô.
  const { props: o, xemTruoc: preview } = useNumberInput({ value, onChange: onCommit, emptyIsZero: true });

  return (
    <span className="relative block">
    <input
      ref={inputRef}
      value={o.value}
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      onChange={o.onChange}
      onFocus={o.onFocus}
      onBlur={o.onBlur}
      onPaste={onPaste}
      onKeyDown={(e) => {
        o.onKeyDown(e);
        if (!e.defaultPrevented) onPhim(e);
      }}
      className={cn(
        "tnum h-11 w-full min-w-20 border-0 bg-transparent px-2 text-right text-sm",
        "focus:ring-2 focus:ring-ring focus:ring-inset focus:outline-none",
        value != null && value < 0 && "text-destructive"
      )}
    />
    <ExpressionPreview preview={preview} />
    </span>
  );
}
