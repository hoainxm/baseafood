// ============================================================
// Tên file: src/lib/shippingInstructionExcel.ts
// Tên tiếng Việt: Ghi SI vào file Excel theo mẫu SI FORM của Phòng Kế hoạch
// Description: ba-spec 72 R13 — fills the customer's own template (src/lib/templates/si-form.xlsx, sheet "SI Form",
//              A1:I42, 47 merged ranges) cell by cell with exceljs, so borders / merges / fonts stay as drawn.
//              Totals keep the template's SUM formulas (G37:I37) with a cached result. Browser loads the template by URL.
// ============================================================
import type { SiForm, SiLinked } from "./shippingInstruction";
import { BL_RELEASES, BL_TYPES, PAYMENT_TERMS, siTotals } from "./shippingInstruction";

type Worksheet = import("exceljs").Worksheet;

/** exceljs là gói CJS: tùy bundler mà nằm ở `default` hay ngay trên namespace (như exportInvoiceExcel). */
async function loadExcelJs(): Promise<typeof import("exceljs")> {
  const mod = (await import("exceljs")) as unknown as Record<string, unknown>;
  return ((mod.default as Record<string, unknown> | undefined)?.Workbook ? mod.default : mod) as typeof import("exceljs");
}

/** Ghi các dòng chữ vào một cột, từ hàng `from`, tối đa `max` hàng (dòng thừa gộp vào hàng cuối). */
function putLines(ws: Worksheet, col: string, from: number, max: number, text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  for (let i = 0; i < max; i++) ws.getCell(`${col}${from + i}`).value = i < max - 1 ? (lines[i] ?? "") : lines.slice(i).join(" ") || "";
}

const X = "X";

/** Điền SI vào workbook mẫu (đã nạp). Tách riêng để test đọc lại được bằng exceljs. */
export function fillShippingInstruction(ws: Worksheet, l: SiLinked, f: SiForm): void {
  const date = f.date ? `${f.date.slice(8, 10)}/${f.date.slice(5, 7)}/${f.date.slice(0, 4)}` : "";
  ws.getCell("H1").value = `Date : ${date}`;
  ws.getCell("H2").value = `Attn : ${f.attn}`;
  putLines(ws, "A", 4, 4, l.shipper.join("\n"));
  ws.getCell("F4").value = f.customerContact;
  ws.getCell("G5").value = l.bookingNo;
  // Ô đánh dấu nằm ngay dưới nhãn: G7 / H7 cho loại B/L, G9 / H9 / I9 cho cách phát hành, G40 / H40 / I40 cho cước.
  BL_TYPES.forEach((t, i) => (ws.getCell(`${"GH"[i]}7`).value = f.blType === t ? X : ""));
  BL_RELEASES.forEach((t, i) => (ws.getCell(`${"GHI"[i]}9`).value = f.blRelease === t ? X : ""));
  putLines(ws, "A", 11, 6, f.consignee);
  putLines(ws, "F", 11, 6, f.otherRequests);
  putLines(ws, "A", 18, 6, f.notifyParty);
  putLines(ws, "F", 18, 6, f.alsoNotifyParty);
  ws.getCell("A25").value = [l.vessel, l.voyage].filter(Boolean).join("     ");
  ws.getCell("D25").value = l.placeOfReceipt;
  ws.getCell("D27").value = l.portOfLoading;
  ws.getCell("A29").value = l.portOfDischarge;
  ws.getCell("D29").value = l.placeOfDelivery;
  ws.getCell("A33").value = l.containerNo;
  ws.getCell("A34").value = l.sealNo ? `SEAL: ${l.sealNo}` : "";
  ws.getCell("C33").value = l.sizeType;
  putLines(ws, "D", 33, 4, f.shippingMarks);
  // 4 hàng hàng hóa (33–36); quá 4 dòng ⇒ dòng 4 trở đi gộp vào hàng 36 (cộng số).
  const goods = f.goods;
  for (let i = 0; i < 4; i++) {
    const r = 33 + i;
    const part = i < 3 ? goods.slice(i, i + 1) : goods.slice(3);
    const text = part.map((g) => [g.description, g.hsCode && `HS CODE: ${g.hsCode}`].filter(Boolean).join(" — ")).join("\n");
    const pk = part.reduce((s, g) => s + (g.packages ?? 0), 0);
    const gr = part.reduce((s, g) => s + (g.grossKg ?? 0), 0);
    ws.getCell(`F${r}`).value = text;
    ws.getCell(`G${r}`).value = part.length && part.some((g) => g.packages != null) ? pk : null;
    ws.getCell(`H${r}`).value = part.length && part.some((g) => g.grossKg != null) ? Math.round(gr * 100) / 100 : null;
    ws.getCell(`I${r}`).value = i === 0 && f.cbm.trim() && !Number.isNaN(Number(f.cbm.replace(",", "."))) ? Number(f.cbm.replace(",", ".")) : null;
  }
  const t = siTotals(goods);
  const cbm = Number(f.cbm.replace(",", ".")) || 0;
  ws.getCell("G37").value = { formula: "SUM(G33:G36)", result: t.packages };
  ws.getCell("H37").value = { formula: "SUM(H33:H36)", result: t.grossKg };
  ws.getCell("I37").value = { formula: "SUM(I33:I36)", result: cbm };
  PAYMENT_TERMS.forEach((p, i) => (ws.getCell(`${"GHI"[i]}40`).value = f.payment === p ? X : ""));
  ws.getCell("I41").value = f.payment === "3rd COUNTRY" ? f.paymentPlace : "";
}

/** Mẫu (bytes) + SI ⇒ file .xlsx. */
export async function shippingInstructionBytes(template: ArrayBuffer, l: SiLinked, f: SiForm): Promise<Uint8Array> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template);
  const ws = wb.getWorksheet("SI Form") ?? wb.worksheets[0];
  fillShippingInstruction(ws, l, f);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Trình duyệt: nạp mẫu nhúng trong app (Vite đưa file ra URL riêng, chỉ tải khi xuất SI). */
export async function loadShippingInstructionTemplate(): Promise<ArrayBuffer> {
  const { default: url } = await import("./templates/si-form.xlsx?url");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được mẫu SI (${res.status})`);
  return res.arrayBuffer();
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Tải file .xlsx về máy (trình duyệt). */
export function downloadXlsx(file: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([file as BlobPart], { type: XLSX_MIME }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
