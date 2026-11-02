// ============================================================
// Tên file: src/lib/sheetPreview.ts
// Tên tiếng Việt: Đọc file Excel (.xls / .xlsx) thành bảng để xem trong app
// Description: Reads every sheet of a workbook into display rows (cell text as Excel formats it), capped per
//              sheet so a huge file does not freeze the page (ba-spec 61 R5). Read-only, never writes.
// ============================================================

export interface SheetPreview {
  name: string;
  /** Dòng đang hiện (đã cắt theo trần), mỗi ô là chữ như Excel hiện. */
  rows: string[][];
  /** Tổng số dòng có dữ liệu của sheet. */
  total: number;
}

/** Trần dòng mỗi sheet khi xem trong app — quá thì tải về để xem đủ. */
export const SHEET_PREVIEW_MAX_ROWS = 1000;

export async function readSheetPreview(bytes: Uint8Array, maxRows = SHEET_PREVIEW_MAX_ROWS): Promise<SheetPreview[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const all = ws ? (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: false }) as unknown[][]) : [];
    const rows = all.map((r) => r.map((c) => (c == null ? "" : String(c))));
    // Bỏ cột trống ở cuối mọi dòng (định dạng kéo dài tới cột xa).
    const width = rows.reduce((w, r) => Math.max(w, lastFilled(r) + 1), 0);
    return { name, total: rows.length, rows: rows.slice(0, maxRows).map((r) => r.slice(0, width)) };
  });
}

function lastFilled(row: string[]): number {
  for (let i = row.length - 1; i >= 0; i--) if (row[i].trim()) return i;
  return -1;
}
