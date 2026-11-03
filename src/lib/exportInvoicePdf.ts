// ============================================================
// Tên file: src/lib/exportInvoicePdf.ts
// Tên tiếng Việt: Vẽ bộ Invoice / Packing list / Expiry list ra PDF theo mẫu INVOICE 275/26
// Description: Renders the invoice document (lib/exportInvoice.ts) to an A4 PDF with pdf-lib
// ============================================================
// Chủ dự án 2026-11-03: "chức năng tải invoice cũng cần ra được bản PDF giống như file mẫu". Cùng NGUỒN với
// file Excel (`InvoiceDocument.sheets`) ⇒ hai bản luôn cùng số. Bố cục đo từ PDF mẫu 275/26 (A4 dọc,
// Times New Roman): logo + tên công ty, kẻ ngang, "Ba Ria, ngày" nghiêng bên phải, tiêu đề 20pt + số
// invoice đóng khung, bên mua trái / chuyến phải, bảng kẻ lưới (tiêu đề 2 dòng, dòng đơn vị gạch chân, TOTAL
// đóng khung), "Says" đậm nghiêng, tên công ty ký bên phải, khối ngân hàng 9pt đóng khung góc trái.
// Font chuẩn PDF (WinAnsi) không có chữ Việt ⇒ chữ có dấu bỏ dấu khi in (chứng từ xuất khẩu viết tiếng Anh).
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import type { InvoiceCell } from "./invoiceReader";
import type { InvoiceDocument, InvoiceSheet, InvoiceSheetRow } from "./exportInvoice";
import { SELLER } from "./exportInvoice";

const PAGE_W = 595.32;
const PAGE_H = 841.92;
const LEFT = 27;
const RIGHT = 568;
const BOTTOM = 40;
const PAD = 4;
/** Hệ số thu nhỏ thử lần lượt để chứng từ vừa một trang. */
const FIT_SCALES = [1, 0.9, 0.82, 0.75];

/** Ranh giới cột (pt) theo sheet — đo từ mẫu 275/26 (Invoice) và 236/26 (Packing list, Expiry list). */
export const COLUMN_EDGES: Record<string, number[]> = {
  INVOICE: [LEFT, 62, 285, 357, 413, 488, RIGHT],
  "PACKING LIST": [LEFT, 62, 262, 345, 408, 488, RIGHT],
  "EXPIRY DATE": [LEFT, 57, 222, 302, 362, 432, 500, RIGHT],
};

/** Chữ in được bằng font chuẩn: bỏ dấu tiếng Việt, đ ⇒ d, ký tự ngoài Latin-1 ⇒ "?". */
export function pdfSafeText(text: string): string {
  return text
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\t/g, " ")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/** Số in theo kiểu tiếng Anh như mẫu: "6,570.00", "42,376.50", đơn giá giữ tối đa 6 số lẻ ("6.45", "4.91097"). */
export function pdfNumber(v: number, numFmt: string | null): string {
  const m = /0\.(0*)(#*)/.exec(numFmt ?? "");
  const minD = m ? m[1].length : 0;
  const maxD = m ? m[1].length + m[2].length : 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: minD, maximumFractionDigits: maxD });
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  heading: PDFFont;
}

/** Ngắt chữ theo bề rộng (pt); từ quá dài thì để tràn, không cắt giữa chữ. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

class Painter {
  page!: PDFPage;
  y = 0;
  /** Hệ số thu nhỏ chữ + dòng (1 = như mẫu); chứng từ tràn trang thì vẽ lại với hệ số nhỏ hơn. */
  k = 1;
  z = (n: number) => n * this.k;
  private readonly doc: import("pdf-lib").PDFDocument;
  readonly fonts: Fonts;
  private readonly rgb: typeof import("pdf-lib").rgb;
  constructor(doc: import("pdf-lib").PDFDocument, fonts: Fonts, rgb: typeof import("pdf-lib").rgb) {
    this.doc = doc;
    this.fonts = fonts;
    this.rgb = rgb;
  }
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - 36;
  }
  /** Còn đủ chỗ cho `h` pt? Không ⇒ sang trang mới (bảng dài). */
  ensure(h: number): boolean {
    if (this.y - h >= BOTTOM) return false;
    this.newPage();
    return true;
  }
  text(t: string, x: number, baseline: number, font: PDFFont, size: number) {
    if (t) this.page.drawText(t, { x, y: baseline, font, size, color: this.rgb(0, 0, 0) });
  }
  line(x1: number, y1: number, x2: number, y2: number, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: this.rgb(0, 0, 0) });
  }
  box(x: number, y: number, w: number, h: number, thickness = 0.8) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderWidth: thickness, borderColor: this.rgb(0, 0, 0) });
  }
}

const str = (c: InvoiceCell) => (c == null ? "" : pdfSafeText(String(c)));
const isNum = (c: InvoiceCell): c is number => typeof c === "number";

/** Vẽ MỘT sheet (một chứng từ) bắt đầu ở trang mới. */
function drawSheet(p: Painter, sheet: InvoiceSheet, logo: PDFImage | null) {
  const edges = COLUMN_EDGES[sheet.name] ?? COLUMN_EDGES.INVOICE;
  const { regular, bold, italic, boldItalic, heading } = p.fonts;
  const rows = sheet.rows;
  const bankIdx = rows.findIndex((r) => r.role === "text" && /^Please make TT to:/i.test(str(r.cells[0])));
  const colX = (i: number) => edges[Math.min(i, edges.length - 1)];
  const colW = (i: number) => colX(i + 1) - colX(i);
  const z = p.z;

  p.newPage();

  // Đầu trang: logo + tên công ty + kẻ ngang.
  const companyRows = rows.filter((r) => r.role === "company");
  if (logo) {
    const w = z(78);
    p.page.drawImage(logo, { x: LEFT + 6, y: p.y - z(40), width: w, height: (w * logo.height) / logo.width });
  }
  companyRows.forEach((r, k) => p.text(str(r.cells[1]), LEFT + z(93), p.y - z(12) - k * z(18), heading, z(k === 0 ? 10.5 : 9.5)));
  p.y -= z(50);
  p.line(LEFT, p.y, RIGHT, p.y, 0.8);
  p.y -= 6;

  let inTable = false;
  let signed = false;
  const tableHeadRows = rows.filter((r) => r.role === "table-head").length;
  let headSeen = 0;
  /** Kẻ dọc theo ranh giới cột cho đoạn bảng [top, bottom]. */
  const verticals = (top: number, bottom: number, skip: (i: number) => boolean = () => false) => {
    edges.forEach((x, i) => {
      if (!skip(i)) p.line(x, top, x, bottom);
    });
  };

  for (let i = companyRows.length; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === "company") continue;
    if (i === bankIdx) {
      drawBank(p, rows.slice(bankIdx).map((x) => str(x.cells[0])));
      break;
    }

    // ---- Bảng hàng hóa ----
    if (r.role === "table-head" || r.role === "item" || r.role === "line" || r.role === "packing" || r.role === "total") {
      const isHeader = r.role === "table-head" && headSeen < 2;
      const size = z(r.role === "table-head" ? (isHeader ? 9 : 10.5) : 10.5);
      const font = r.role === "item" || r.role === "total" ? bold : r.role === "packing" ? boldItalic : regular;
      // Mỗi ô: chữ ngắt trong bề rộng cột (dòng "IN US. DOLLARS" phủ hai cột tiền).
      // Dòng 1 tiêu đề: ô không có chữ ở dòng 2 (ITEMS, DESCRIPTION) canh giữa theo chiều dọc hai dòng.
      const nextHead = isHeader && headSeen === 0 ? rows[i + 1] : undefined;
      const cells = r.cells.map((c, k) => {
        if (c == null || c === "") return null;
        const lastFilled = r.cells.slice(k + 1).every((x) => x == null || x === "");
        // "IN US. DOLLARS" (tiêu đề) và "Trade Terms" (dòng dưới tiêu đề) phủ hết các cột tiền như mẫu.
        // Ô cuối của dòng 1 tiêu đề mà dòng 2 có chữ ở các cột sau nó ("IN US. DOLLARS", "TOTAL WEIGHT") và
        // "Trade Terms" ở dòng dưới tiêu đề: phủ hết các cột bên phải như mẫu.
        const spansHeader = !!nextHead && nextHead.cells.slice(k + 1).some((x) => x != null && x !== "");
        const spanToEnd = typeof c === "string" && lastFilled && r.role === "table-head" && (spansHeader || /^Trade Terms:/i.test(c));
        const width = (spanToEnd ? RIGHT - colX(k) : colW(k)) - 2 * PAD;
        const t = isNum(c) ? pdfNumber(c, sheet.numFmts[k] ?? null) : str(c);
        const tt = /^(Trade Terms: \S+)\s+(.+)$/i.exec(t);
        const lines = isNum(c) ? [t] : tt ? [tt[1], ...wrap(tt[2], font, size, width)] : wrap(t, font, size, width);
        const drop = nextHead && (nextHead.cells[k] == null || nextHead.cells[k] === "") && !spanToEnd ? z(12) : 0;
        return { k, num: isNum(c), lines, width, spanToEnd, drop };
      });
      const lineH = size + z(3);
      const nLines = Math.max(1, ...cells.map((c) => c?.lines.length ?? 0));
      const h = isHeader ? z(24) : Math.max(z(17), nLines * lineH + z(5));
      if (!inTable) {
        inTable = true;
        p.line(LEFT, p.y, RIGHT, p.y);
      } else if (p.ensure(h)) {
        p.line(LEFT, p.y, RIGHT, p.y);
      }
      const top = p.y;
      const bottom = p.y - h;
      if (r.role === "total") p.line(LEFT, top, RIGHT, top);
      for (const c of cells) {
        if (!c) continue;
        c.lines.forEach((t, li) => {
          const w = font.widthOfTextAtSize(t, size);
          const base = top - z(isHeader ? 15 : 12) - li * lineH - c.drop;
          const centered = r.role === "table-head" || (r.role === "total" && !c.num);
          const x = c.num ? colX(c.k + 1) - PAD - w : centered ? colX(c.k) + (c.width + 2 * PAD - w) / 2 : colX(c.k) + PAD;
          p.text(t, x, base, font, size);
          // Dòng đơn vị (CTNS · KGS · USD/KG · USD) và "Trade Terms" gạch chân như mẫu.
          if (r.role === "table-head" && !isHeader && c.k >= 2) p.line(x, base - 1.5, x + w, base - 1.5, 0.5);
        });
      }
      if (r.role === "table-head") headSeen += 1;
      // Dòng 1 của tiêu đề: kẻ ngang dưới "IN US. DOLLARS" chia hai cột tiền.
      // Ô phủ nhiều cột ("IN US. DOLLARS", "Trade Terms"): không kẻ dọc xuyên chữ; dưới "IN US. DOLLARS"
      // kẻ ngang chia hai cột tiền. Hết khối tiêu đề thì kẻ ngang.
      const spanCell = cells.find((c) => c?.spanToEnd);
      if (spanCell && isHeader) p.line(colX(spanCell.k), bottom, RIGHT, bottom);
      verticals(top, bottom, (k) => !!spanCell && k > spanCell.k && k < edges.length - 1);
      p.y = bottom;
      if (headSeen === 2 && r.role === "table-head" && tableHeadRows >= 2) p.line(LEFT, p.y, RIGHT, p.y);
      if (r.role === "total") {
        p.line(LEFT, p.y, RIGHT, p.y);
        inTable = false;
      }
      continue;
    }

    // ---- Ngoài bảng ----
    if (r.role === "blank") {
      // Sau chữ ký: khối ngân hàng nằm ngay dưới, chừa bên phải cho dấu + chữ ký tay (mẫu 275/26).
      if (!signed) p.y -= z(8);
      continue;
    }
    if (r.role === "title") {
      p.ensure(z(44));
      p.y -= z(34);
      const title = str(r.cells[0]);
      const no = str(r.cells[4]);
      const size = z(22);
      const tw = bold.widthOfTextAtSize(title, size);
      // Có số chứng từ ⇒ tiêu đề canh giữa vùng cột A–D, số đóng khung bên phải; không ⇒ canh giữa trang.
      const titleRight = no ? colX(4) : RIGHT;
      p.text(title, LEFT + (titleRight - LEFT - tw) / 2, p.y, bold, size);
      if (no) {
        const nw = bold.widthOfTextAtSize(no, size);
        p.box(RIGHT - nw - 10, p.y - z(6), nw + 10, size + z(8));
        p.text(no, RIGHT - nw - 5, p.y, bold, size);
      }
      p.y -= z(14);
      continue;
    }
    if (r.role === "signature") {
      p.ensure(z(30));
      p.y -= z(16);
      const t = str(r.cells.find((c) => c != null) ?? SELLER.signature);
      const w = bold.widthOfTextAtSize(t, z(11.5));
      p.text(t, colX(3) + (RIGHT - colX(3) - w) / 2, p.y, bold, z(11.5));
      p.y -= z(6);
      signed = true;
      continue;
    }
    if (r.role === "head" && r.cells.some((c) => /^\s*(Ba Ria|BA RIA),\s*$/i.test(str(c)))) {
      // "Ba Ria, November 02, 2026": liền nhau, nghiêng, canh phải như mẫu.
      const t = r.cells.filter((c) => c != null && c !== "").map(str).join(" ");
      p.ensure(z(18));
      p.y -= z(14);
      p.text(t, 505 - italic.widthOfTextAtSize(t, z(10.5)), p.y, italic, z(10.5));
      p.y -= z(4);
      continue;
    }
    if (r.role === "head") {
      // Phần đầu (bên mua trái, chuyến phải) mọi chứng từ cùng bố cục với Invoice.
      drawFreeRow(p, r, COLUMN_EDGES.INVOICE, (k, cell) => {
        const t = str(cell);
        // "Ba Ria," + ngày: nghiêng như mẫu; "Applicant:" đậm.
        if (/,$/.test(t) && k >= 3) return italic;
        if (k > 0 && r.cells[k - 1] != null && /,$/.test(str(r.cells[k - 1]))) return italic;
        if (/^Applicant:/i.test(t)) return bold;
        return regular;
      });
      continue;
    }
    // Chữ thường: "Says:" đậm nghiêng; ghi chú riêng nhiều ô ⇒ lưới nhỏ.
    if (r.role === "text") {
      const filled = r.cells.filter((c) => c != null && c !== "");
      if (filled.length > 1) {
        drawNoteGrid(p, r);
        continue;
      }
      const t = str(r.cells[0]);
      const m = /^(Says?:)\s*(.*)$/i.exec(t);
      if (m) {
        p.ensure(z(30));
        p.y -= z(22);
        p.text(m[1], LEFT + 5, p.y, boldItalic, z(10.5));
        const lines = wrap(m[2], boldItalic, z(10.5), RIGHT - 74);
        lines.forEach((l, li) => p.text(l, 74, p.y - li * z(13), boldItalic, z(10.5)));
        p.y -= (lines.length - 1) * z(13) + z(4);
        continue;
      }
      const lines = wrap(t, regular, z(10.5), RIGHT - LEFT - 10);
      p.ensure(lines.length * z(13) + z(4));
      lines.forEach((l) => {
        p.y -= z(13);
        p.text(l, LEFT + 5, p.y, /^\*?NOTE/i.test(l) ? bold : regular, z(10.5));
      });
      p.y -= z(4);
      continue;
    }
  }
}

/** Hàng ngoài bảng: mỗi ô in từ cột của nó, ngắt dòng tới ô có chữ kế tiếp. */
function drawFreeRow(p: Painter, r: InvoiceSheetRow, edges: number[], fontOf: (k: number, cell: InvoiceCell) => PDFFont) {
  const size = p.z(10.5);
  const lineH = p.z(14);
  const filled = r.cells.map((c, k) => ({ c, k })).filter((x) => x.c != null && x.c !== "");
  const blocks = filled.map(({ c, k }, idx) => {
    const nextK = filled[idx + 1]?.k ?? edges.length - 1;
    const font = fontOf(k, c);
    const width = edges[Math.min(nextK, edges.length - 1)] - edges[k] - 2 * PAD;
    return { k, font, lines: wrap(str(c), font, size, width) };
  });
  const n = Math.max(1, ...blocks.map((b) => b.lines.length));
  p.ensure(n * lineH + p.z(4));
  const top = p.y;
  for (const b of blocks) b.lines.forEach((l, li) => p.text(l, edges[b.k] + PAD + (b.k === 0 ? 1 : 0), top - p.z(12) - li * lineH, b.font, size));
  p.y = top - n * lineH - p.z(4);
}

/** Ghi chú riêng của khách dạng bảng (khối *NOTE của 236/26): chia đều bề ngang, kẻ ô. */
function drawNoteGrid(p: Painter, r: InvoiceSheetRow) {
  const cells = r.cells.map(str);
  const n = cells.length;
  const w = (RIGHT - LEFT) / n;
  const size = p.z(9.5);
  const blocks = cells.map((t) => wrap(t, p.fonts.regular, size, w - 2 * PAD));
  const h = Math.max(1, ...blocks.map((b) => b.length)) * p.z(12) + p.z(6);
  p.ensure(h);
  const top = p.y;
  blocks.forEach((lines, k) => {
    lines.forEach((l, li) => p.text(l, LEFT + k * w + PAD, top - p.z(11) - li * p.z(12), p.fonts.regular, size));
    p.line(LEFT + k * w, top, LEFT + k * w, top - h);
  });
  p.line(RIGHT, top, RIGHT, top - h);
  p.line(LEFT, top, RIGHT, top);
  p.line(LEFT, top - h, RIGHT, top - h);
  p.y = top - h;
}

/** Khối "Please make TT to:" — 9pt đậm nghiêng, đóng khung, rộng ~ nửa trang (mẫu 275/26). */
function drawBank(p: Painter, lines: string[]) {
  const size = p.z(9);
  const width = 245;
  const wrapped = lines.flatMap((l) => wrap(l, p.fonts.boldItalic, size, width - 2 * PAD));
  const h = wrapped.length * p.z(11.4) + p.z(8);
  p.y -= p.z(6);
  p.ensure(h);
  const top = p.y;
  p.box(LEFT, top - h, width, h, 0.8);
  wrapped.forEach((l, li) => {
    const base = top - p.z(10) - li * p.z(11.4);
    p.text(l, LEFT + PAD + 1, base, p.fonts.boldItalic, size);
    if (li === 0) p.line(LEFT + PAD + 1, base - 1.2, LEFT + PAD + 1 + p.fonts.boldItalic.widthOfTextAtSize(l, size), base - 1.2, 0.5);
  });
  p.y = top - h;
}

async function embedLogo(pdf: import("pdf-lib").PDFDocument, bytes: Uint8Array | ArrayBuffer): Promise<PDFImage | null> {
  // Chép ra Uint8Array thường: Buffer của Node / ArrayBuffer khác realm làm pdf-lib đọc nhầm.
  const data = Uint8Array.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
  const isJpeg = data[0] === 0xff && data[1] === 0xd8;
  return (isJpeg ? pdf.embedJpg(data) : pdf.embedPng(data)).catch(() => null);
}

async function loadPdfLib(): Promise<typeof import("pdf-lib")> {
  const mod = (await import("pdf-lib")) as unknown as Record<string, unknown>;
  return ((mod.default as Record<string, unknown> | undefined)?.PDFDocument ? mod.default : mod) as typeof import("pdf-lib");
}

/**
 * Bytes PDF của bộ chứng từ: mỗi sheet (Invoice, Packing list, Expiry list) bắt đầu ở trang mới.
 * `logoImage` = ảnh logo JPEG / PNG (public/invoice-logo.jpg — 480 px, 32 KB, thu từ logo gốc docs/brand; PNG
 * nền trong suốt của khung app làm file nặng hơn nhiều); không có / ảnh hỏng ⇒ chỉ in chữ.
 */
export async function invoicePdfBytes(doc: InvoiceDocument, logoImage?: Uint8Array | ArrayBuffer | null): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.fileName.replace(/\.xlsx$/i, ""));
  pdf.setCreator("Baseafood MES");
  pdf.setProducer("Baseafood MES");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    boldItalic: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    heading: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = logoImage ? await embedLogo(pdf, logoImage) : null;
  const painter = new Painter(pdf, fonts, rgb);
  // Mỗi chứng từ cố vừa MỘT trang A4 như bản Excel in ra: tràn thì xóa trang vừa vẽ, vẽ lại nhỏ hơn.
  // Nhỏ tới 75 % vẫn tràn (chuyến rất nhiều dòng) ⇒ để sang trang.
  for (const sheet of doc.sheets) {
    for (const k of FIT_SCALES) {
      const before = pdf.getPageCount();
      painter.k = k;
      drawSheet(painter, sheet, logo);
      if (pdf.getPageCount() - before <= 1 || k === FIT_SCALES[FIT_SCALES.length - 1]) break;
      for (let i = pdf.getPageCount() - 1; i >= before; i--) pdf.removePage(i);
    }
  }
  return pdf.save();
}

/** Tên file PDF cùng tên với file Excel: "INVOICE 275.26.pdf". */
export const invoicePdfFileName = (doc: InvoiceDocument) => doc.fileName.replace(/\.xlsx$/i, ".pdf");
