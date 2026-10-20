// ============================================================
// Tên file: src/design-system/patterns/columnResize.tsx
// Tên tiếng Việt: Kéo giãn bề rộng cột kiểu Excel (nhớ theo máy)
// Description: Excel-like column resizing for tables (drag edge, double-click to fit)
// ============================================================
// Người dùng yêu cầu 2026-10-19: "tự điều chỉnh chiều ngang giống Excel". Kéo mép phải tên
// cột để đổi bề rộng, NHẤP ĐÚP mép để cột vừa nội dung dài nhất (như Excel), nút trả về mặc
// định. Bề rộng là cài đặt TRÌNH BÀY theo máy (lib/devicePrefs) — không ghi sổ, không toast
// (quy tắc 13). Cột cùng `widthKey` (VD mọi cột ngày) dùng chung một bề rộng.
import * as React from "react";
import { readDevicePrefJson, writeDevicePrefJson } from "@/lib/devicePrefs";
import { cn } from "@/lib/utils";

/** Bề rộng nhỏ / lớn nhất cho phép (px) — kéo lố tay không làm mất cột hay phình vô hạn. */
export const MIN_COLUMN_WIDTH = 40;
export const MAX_COLUMN_WIDTH = 640;

export type ColumnWidths = Record<string, number>;

export const clampColumnWidth = (px: number) =>
  Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, px)));

/** Đọc cài đặt cũ trên máy: chỉ giữ số hữu hạn dương, kẹp vào khoảng cho phép. */
export function sanitizeColumnWidths(value: unknown): ColumnWidths {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ColumnWidths = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = clampColumnWidth(v);
  }
  return out;
}

/* v2 (2026-10-20): bố cục Cân đối đổi (cột Ghi chú thôi giãn) — bề rộng đã KÉO ở bố cục cũ lưu
   theo máy giữ cột Ghi chú to + mảng trắng bên phải ⇒ đổi khoá để mọi máy về mặc định mới. */
const storageKey = (key: string) => `bsf.grid-column-widths.v2.${key}`;

/** Bề rộng cột đã chỉnh của một bảng (khoá ổn định). Không có khoá ⇒ tắt tính năng. */
export function useColumnWidths(key: string | undefined) {
  const [widths, setWidths] = React.useState<ColumnWidths>(() =>
    key ? sanitizeColumnWidths(readDevicePrefJson<unknown>(storageKey(key), {})) : {}
  );
  // Bản mới nhất để LƯU khi thả tay (kéo thì cập nhật liên tục, chỉ ghi máy một lần).
  const latest = React.useRef(widths);
  latest.current = widths;
  const setWidth = React.useCallback((columnKey: string, px: number) => {
    setWidths((prev) => ({ ...prev, [columnKey]: clampColumnWidth(px) }));
  }, []);
  const persist = React.useCallback(
    (next?: ColumnWidths) => {
      if (key) writeDevicePrefJson(storageKey(key), next ?? latest.current);
    },
    [key]
  );
  /**
   * GIỮ NGUYÊN bề rộng đang thấy của mọi cột chưa chỉnh (gọi khi bắt đầu kéo / nhấp đúp):
   * bảng đã có cột chỉnh thì co theo tổng bề rộng, cột chưa chỉnh mà không chốt lại sẽ tụt về
   * mức tối thiểu — kéo một cột làm cả bảng nhảy, không giống Excel.
   */
  const freeze = React.useCallback((current: ColumnWidths) => {
    const next = { ...current, ...latest.current };
    latest.current = next;
    setWidths(next);
  }, []);
  /** Đặt + lưu ngay (nhấp đúp vừa nội dung). */
  const fit = React.useCallback(
    (columnKey: string, px: number) => {
      const next = { ...latest.current, [columnKey]: clampColumnWidth(px) };
      setWidths(next);
      persist(next);
    },
    [persist]
  );
  const reset = React.useCallback(() => {
    setWidths({});
    if (key) writeDevicePrefJson(storageKey(key), {});
  }, [key]);
  return { enabled: Boolean(key), widths, setWidth, freeze, persist, fit, reset, isCustomized: Object.keys(widths).length > 0 };
}

/* ---------- Đo "vừa nội dung" (nhấp đúp mép cột) ---------- */

let measureCanvas: HTMLCanvasElement | null = null;
function textWidth(text: string, font: string): number {
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Bề rộng nội dung của MỘT ô (chữ dài nhất mỗi dòng, ô nhập theo giá trị đang có). */
function cellContentWidth(cell: HTMLTableCellElement): number {
  const cs = getComputedStyle(cell);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  let width = 0;
  const inputs = cell.querySelectorAll<HTMLInputElement>("input:not([type=checkbox])");
  inputs.forEach((input) => {
    const ics = getComputedStyle(input);
    const ipad = parseFloat(ics.paddingLeft) + parseFloat(ics.paddingRight);
    width = Math.max(width, textWidth(input.value || input.placeholder || "", ics.font) + ipad + 4);
  });
  const lines = (cell.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) width = Math.max(width, textWidth(line, cs.font));
  // Ô chọn (nút + mũi tên), ô tick đầu dòng — chừa chỗ.
  if (cell.querySelector("button")) width += 36;
  if (cell.querySelector("input[type=checkbox]")) width += 28;
  return width + pad + 4;
}

/** Bề rộng vừa nội dung dài nhất của cột chứa ô tên cột `th` (bỏ qua dòng gộp ô). */
export function measureFitWidth(th: HTMLTableCellElement): number {
  const table = th.closest("table");
  if (!table) return th.getBoundingClientRect().width;
  const index = th.cellIndex;
  const headCount = th.parentElement instanceof HTMLTableRowElement ? th.parentElement.cells.length : 0;
  let width = cellContentWidth(th);
  for (const row of Array.from(table.rows)) {
    if (row.cells.length !== headCount) continue; // dòng tiêu đề nhóm (colSpan) / dòng tổng khác cột
    const cell = row.cells[index];
    if (cell && cell !== th) width = Math.max(width, cellContentWidth(cell));
  }
  return clampColumnWidth(width);
}

/**
 * Mép kéo ở cạnh phải ô tên cột. Kéo = đổi bề rộng (thả tay mới lưu), nhấp đúp = vừa nội dung.
 * Đặt TRONG <th> có `position` (relative / sticky).
 */
export function ColumnResizeHandle({
  label,
  onStart,
  onResize,
  onCommit,
  onFit,
}: {
  /** Tên cột — cho trình đọc màn hình / tooltip. */
  label: string;
  /** Bắt đầu kéo / nhấp đúp — chốt bề rộng đang thấy của các cột khác. */
  onStart: (th: HTMLTableCellElement) => void;
  onResize: (px: number) => void;
  onCommit: () => void;
  onFit: (th: HTMLTableCellElement) => void;
}) {
  const start = React.useRef<{ x: number; width: number } | null>(null);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Đổi bề rộng cột ${label}`}
      title={`Kéo để đổi bề rộng cột ${label} · nhấp đúp để vừa nội dung`}
      // NẰM GỌN trong ô (không thò ra mép): thò ra dù 4px là bảng tưởng bị tràn ⇒ hiện thanh cuộn
      // ngang, thanh cuộn đòi bề rộng bằng bảng ⇒ khối Cân đối nở hết hàng, A–L vỡ hàng (lỗi 2026-10-19).
      className={cn(
        "absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none",
        "after:absolute after:inset-y-1 after:right-0 after:w-0.5 after:rounded-full after:bg-transparent hover:after:bg-primary/60"
      )}
      onPointerDown={(e) => {
        const th = e.currentTarget.closest("th");
        if (!th) return;
        e.preventDefault();
        e.stopPropagation();
        start.current = { x: e.clientX, width: th.getBoundingClientRect().width };
        onStart(th);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onResize(start.current.width + (e.clientX - start.current.x));
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        start.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onCommit();
      }}
      onDoubleClick={(e) => {
        const th = e.currentTarget.closest("th");
        if (!th) return;
        onStart(th);
        onFit(th);
      }}
    />
  );
}
