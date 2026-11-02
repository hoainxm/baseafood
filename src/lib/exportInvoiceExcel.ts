// ============================================================
// Tên file: src/lib/exportInvoiceExcel.ts
// Tên tiếng Việt: Ghi file Excel Invoice / Packing list / Expiry list của chuyến xuất
// Description: Writes the invoice document (lib/exportInvoice.ts) to a styled .xlsx with exceljs
// ============================================================
// Bố cục theo mẫu phòng KH đang in (INV 236/26): Times New Roman, tên công ty + tiêu đề đậm, khung
// quanh bảng hàng hóa, số căn phải có phân nghìn, khổ A4 dọc vừa một trang ngang. Số ghi dạng number
// để phòng KH còn sửa / cộng tiếp trong Excel nếu khách đòi thêm chi tiết.
import type { InvoiceDocument, InvoiceSheet } from "./exportInvoice";

type Worksheet = import("exceljs").Worksheet;

const FONT = "Times New Roman";
const THIN = { style: "thin" as const };

function writeSheet(ws: Worksheet, sheet: InvoiceSheet): void {
  const cols = Math.max(sheet.widths.length, ...sheet.rows.map((r) => r.cells.length));
  ws.columns = Array.from({ length: cols }, (_, i) => ({ width: sheet.widths[i] ?? 12 }));
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  const firstTable = sheet.rows.findIndex((r) => r.role === "table-head");
  const total = sheet.rows.findIndex((r) => r.role === "total");
  let lastHead = firstTable;
  while (lastHead + 1 < sheet.rows.length && sheet.rows[lastHead + 1].role === "table-head") lastHead++;
  sheet.rows.forEach((row, i) => {
    const xr = ws.getRow(i + 1);
    row.cells.forEach((v, c) => {
      if (v == null || v === "") return;
      const cell = xr.getCell(c + 1);
      cell.value = v;
      if (typeof v === "number" && sheet.numFmts[c]) cell.numFmt = sheet.numFmts[c] as string;
    });
    const bold = row.role === "company" || row.role === "title" || row.role === "table-head" || row.role === "item" || row.role === "total" || row.role === "signature";
    const size = row.role === "title" ? 16 : row.role === "company" ? 13 : 11;
    for (let c = 1; c <= cols; c++) {
      const cell = xr.getCell(c);
      cell.font = { name: FONT, size, bold };
      if (row.role === "table-head") cell.alignment = { horizontal: c <= 2 ? "left" : "center", vertical: "middle", wrapText: true };
      else if (typeof cell.value === "number") cell.alignment = { horizontal: c === 1 ? "center" : "right" };
      // Khung bảng hàng hóa: từ dòng tiêu đề cột tới dòng TOTAL.
      if (firstTable >= 0 && total >= 0 && i >= firstTable && i <= total) {
        cell.border = {
          left: THIN,
          right: THIN,
          ...(i === firstTable || row.role === "total" ? { top: THIN } : {}),
          ...(i === total || i === lastHead ? { bottom: THIN } : {}),
        };
      }
    }
    if (row.role === "title") xr.height = 24;
  });
}

/** exceljs là gói CJS: tùy bundler mà nằm ở `default` hay ngay trên namespace (như reconciliationExport). */
async function loadExcelJs(): Promise<typeof import("exceljs")> {
  const mod = (await import("exceljs")) as unknown as Record<string, unknown>;
  return ((mod.default as Record<string, unknown> | undefined)?.Workbook ? mod.default : mod) as typeof import("exceljs");
}

/** Bytes .xlsx của bộ chứng từ (một sheet / chứng từ). */
export async function invoiceWorkbookBytes(doc: InvoiceDocument): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Baseafood MES";
  for (const sheet of doc.sheets) writeSheet(wb.addWorksheet(sheet.name), sheet);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Tải file về máy (trình duyệt). */
export async function downloadInvoiceWorkbook(doc: InvoiceDocument): Promise<void> {
  const bytes = await invoiceWorkbookBytes(doc);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
