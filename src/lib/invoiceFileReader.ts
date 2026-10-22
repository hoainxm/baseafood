// ============================================================
// Tên file: src/lib/invoiceFileReader.ts
// Tên tiếng Việt: Mở file Commercial Invoice (Excel gốc / PDF xuất từ Excel) thành hàng để đọc
// Description: Browser-only loaders for ba-spec 41 v7 R27: .xlsx/.xls via SheetJS, .pdf via pdf.js
//              (lazy-loaded — only when a user attaches an invoice). A PDF with (almost) no text is a
//              scan ⇒ "scan" (scans are NOT read — owner's decision 2026-10-22). Parsing is pure:
//              invoiceReader.ts.
// ============================================================
import { INVOICE_FAILURE_MESSAGES, isReadableInvoiceFile, parseInvoiceRows, rowsFromTextItems, type InvoiceCell, type InvoiceReadResult, type PdfTextItem } from "./invoiceReader";

const fail = (reason: "scan" | "unsupported" | "error", message = INVOICE_FAILURE_MESSAGES[reason]): InvoiceReadResult => ({ ok: false, reason, message });

/** PDF có ít hơn chừng này ký tự chữ ⇒ coi là bản scan (ảnh). */
const MIN_PDF_TEXT = 40;

async function rowsFromExcel(data: ArrayBuffer): Promise<InvoiceCell[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json<InvoiceCell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }));
  // Nhiều sheet (invoice + packing list…) ⇒ lấy sheet có chữ "COMMERCIAL INVOICE", không có thì sheet có "DESCRIPTION".
  const has = (rows: InvoiceCell[][], re: RegExp) => rows.some((r) => r.some((c) => typeof c === "string" && re.test(c)));
  return sheets.find((s) => has(s, /commercial\s+invoice/i)) ?? sheets.find((s) => has(s, /description/i)) ?? sheets[0] ?? [];
}

async function rowsFromPdf(data: ArrayBuffer): Promise<InvoiceCell[][] | "scan"> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const items: (PdfTextItem & { page: number })[] = [];
  try {
    // Invoice 1–2 trang; đọc tối đa 5 trang đầu (file gộp cả bộ chứng từ thì invoice đứng đầu).
    for (let p = 1; p <= Math.min(doc.numPages, 5); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      for (const it of content.items) {
        if (!("str" in it) || !it.str) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height, page: p });
      }
    }
  } finally {
    void task.destroy();
  }
  if (items.reduce((n, i) => n + i.str.trim().length, 0) < MIN_PDF_TEXT) return "scan";
  return rowsFromTextItems(items);
}

/** Đọc một file invoice (vừa chọn, hoặc tải về từ kho file). Không ghi gì. */
export async function readInvoiceFile(file: Blob, fileName: string): Promise<InvoiceReadResult> {
  if (!isReadableInvoiceFile(fileName)) return fail("unsupported");
  try {
    const data = await file.arrayBuffer();
    if (/\.pdf$/i.test(fileName)) {
      const rows = await rowsFromPdf(data);
      return rows === "scan" ? fail("scan") : parseInvoiceRows(rows);
    }
    return parseInvoiceRows(await rowsFromExcel(data));
  } catch (e) {
    return fail("error", `${INVOICE_FAILURE_MESSAGES.error}${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
  }
}
