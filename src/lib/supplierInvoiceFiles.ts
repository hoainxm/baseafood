// ============================================================
// Tên file: src/lib/supplierInvoiceFiles.ts
// Tên tiếng Việt: Mở file sổ chi tiết NL / PDF hóa đơn đại lý + lưu PDF lên kho file
// Description: Browser-only loaders for ba-spec 51: the accounting ledger (.xlsx/.xls via SheetJS, raw
//              date serials — no Date objects, avoids the timezone day-shift) and VAT-invoice PDFs (text
//              layer via pdf.js, read on this machine — R15). Storage helpers for the private
//              `supplier-invoice-files` bucket (mig 0090). Parsing rules live in supplierInvoice.ts.
// ============================================================
import { supabase } from "./supabase";
import { IS_DEMO, SITE_DEMO } from "./demoMode";
import { safeFileName } from "./documents";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { rowsFromPdf } from "./invoiceFileReader";
import { parseInvoiceFileName, parseLedgerSheets, parseVatInvoiceText, type LedgerParse, type PdfInvoice } from "./supplierInvoice";

export const SUPPLIER_INVOICE_BUCKET = "supplier-invoice-files";
export const hasSupplierInvoiceStorage = Boolean(supabase);
export const SUPPLIER_INVOICE_ACCEPT = ".xlsx,.xls,.pdf";
const MAX_BYTES = 20 * 1024 * 1024;

export const isLedgerFile = (name: string) => /\.xlsx?$/i.test(name);
export const isPdfFile = (name: string) => /\.pdf$/i.test(name);

/** Đọc file sổ chi tiết NL (mọi sheet). */
export async function readLedgerFile(file: Blob): Promise<LedgerParse> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return parseLedgerSheets(
    wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }),
    })),
  );
}

export type PdfRead = { ok: true; pdf: PdfInvoice } | { ok: false; message: string };

/** Đọc PDF hóa đơn: chữ trong file + số / ký hiệu / MST ở tên file bù chỗ thiếu. Bản scan không đọc. */
export async function readInvoicePdf(file: Blob, fileName: string): Promise<PdfRead> {
  if (file.size > MAX_BYTES) return { ok: false, message: `File "${fileName}" quá 20 MB.` };
  try {
    const rows = await rowsFromPdf(await file.arrayBuffer());
    if (rows === "scan") return { ok: false, message: `"${fileName}" là bản scan (không có chữ) — chỉ đọc được PDF hóa đơn điện tử.` };
    const pdf = parseVatInvoiceText(rows.map((r) => r.filter((c) => c != null && c !== "").join(" ")));
    const fromName = parseInvoiceFileName(fileName);
    const merged: PdfInvoice = {
      ...pdf,
      invoiceNo: pdf.invoiceNo || fromName?.invoiceNo || "",
      invoiceSymbol: pdf.invoiceSymbol || fromName?.invoiceSymbol || "",
      sellerTaxId: pdf.sellerTaxId || fromName?.sellerTaxId || "",
    };
    if (!merged.invoiceNo) return { ok: false, message: `"${fileName}": không thấy số hóa đơn trong file.` };
    return { ok: true, pdf: merged };
  } catch (e) {
    return { ok: false, message: `Không đọc được "${fileName}"${e instanceof Error && e.message ? ` (${e.message})` : ""}.` };
  }
}

export function supplierInvoiceFilePath(year: number, invoiceId: string, fileName: string): string {
  return `${IS_DEMO ? SITE_DEMO : "bsf1"}/supplier-invoice-files/${year || "none"}/${safeFileName(invoiceId)}-${safeFileName(fileName)}`;
}

function explainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return 'Máy chủ chưa có kho file "supplier-invoice-files" — báo quản trị tạo theo hướng dẫn trong migration 0090.';
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403"))
    return "Máy chủ từ chối: tài khoản chưa có quyền Hóa đơn đại lý (hoặc chưa chạy migration 0090).";
  if (m.includes("duplicate") || m.includes("exists")) return "File này đã có trên kho file.";
  return message;
}

/** Tải PDF lên ⇒ `{ path }` hoặc `{ error }`. Không có máy chủ ⇒ lỗi (HĐ vẫn ghi số, chưa có file). */
export async function uploadSupplierInvoiceFile(path: string, file: Blob): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Chưa nối máy chủ — chưa lưu được file." };
  const { error } = await supabase.storage.from(SUPPLIER_INVOICE_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: true });
  return error ? { error: explainError(error.message) } : { path };
}

/** Link xem có hạn (10 phút). File giữ chỗ của demo ⇒ null. */
export async function getSupplierInvoiceFileUrl(path: string, seconds = 600): Promise<string | null> {
  if (!supabase || !path || path.startsWith(DEMO_PLACEHOLDER_PREFIX)) return null;
  const { data } = await supabase.storage.from(SUPPLIER_INVOICE_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
