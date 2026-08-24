// ============================================================
// Tên file: src/lib/reportXlsx.ts
// Tên tiếng Việt tương đương: Xuất bảng báo cáo ra Excel (.xlsx)
// Description: Generic array-of-arrays → .xlsx exporter for report screens
// ============================================================
import * as XLSX from "xlsx";

/** Một ô: chuỗi, số, hoặc trống. Ô số giữ dạng number để Excel tính/tổng được. */
export type OExcel = string | number | null;

/**
 * Xuất một bảng (mảng 2 chiều) ra file .xlsx và tải về.
 * Dùng chung cho các màn Báo cáo — không đụng logic nghiệp vụ, chỉ ghi file.
 * Số để dạng number (không format vi-VN) để kế toán còn cộng/lọc trong Excel.
 */
export function exportAoaToXlsx(opts: {
  sheetName: string;
  aoa: OExcel[][];
  colWidths?: number[];
  fileName: string;
}): void {
  const ws = XLSX.utils.aoa_to_sheet(opts.aoa);
  if (opts.colWidths) ws["!cols"] = opts.colWidths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  // Tên sheet Excel tối đa 31 ký tự.
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.slice(0, 31) || "Báo cáo");
  XLSX.writeFile(wb, opts.fileName);
}
