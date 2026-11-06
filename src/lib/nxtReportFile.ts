/**
 * Đọc file báo cáo Xuất–Nhập–Tồn người dùng chọn (PDF in từ phần mềm kế toán, hoặc Excel cùng mẫu)
 * thành `NxtReport`. Phần bất đồng bộ / trình duyệt nằm ở đây; luật đọc là hàm thuần ở `nxtStockImport.ts`.
 */
import { pdfTextItems } from "./invoiceFileReader";
import { parseNxtExcelFile } from "./nxtExcel";
import { parseNxtPdfItems, reportFromNxtExcel, type NxtReport } from "./nxtStockImport";

/** Báo cáo dài nhất gặp tới nay 3 trang; 60 trang là trần an toàn. */
const MAX_PAGES = 60;

export const NXT_FILE_ACCEPT = ".pdf,.xlsx,.xls";

export async function readNxtReportFile(file: File): Promise<NxtReport> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const items = await pdfTextItems(await file.arrayBuffer(), MAX_PAGES);
    if (items === "scan")
      throw new Error("PDF này là ảnh chụp (scan), không có chữ để đọc. Xin kế toán bản PDF xuất thẳng từ phần mềm hoặc bản Excel.");
    return parseNxtPdfItems(items.map((i) => ({ str: i.str, x: i.x, y: i.y, width: i.width, page: i.page })));
  }
  if (/\.xlsx?$/i.test(file.name)) {
    const report = reportFromNxtExcel(await parseNxtExcelFile(file));
    if (!report.rows.length) throw new Error("File Excel không có dòng hàng nào theo mẫu \"Báo cáo xuất nhập tồn\".");
    return report;
  }
  throw new Error("Chỉ nhận file PDF hoặc Excel (.xlsx) của báo cáo xuất nhập tồn.");
}
