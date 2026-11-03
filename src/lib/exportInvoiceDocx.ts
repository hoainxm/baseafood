// ============================================================
// Tên file: src/lib/exportInvoiceDocx.ts
// Tên tiếng Việt: Ghi bộ Invoice / Packing list / Expiry list ra file Word (.docx)
// Description: Writes the invoice document (lib/exportInvoice.ts) to a .docx (WordprocessingML via pizzip)
// ============================================================
// Chủ dự án 2026-11-03: "chỗ invoice vừa làm bổ sung thêm chức năng xuất file dạng word". Cùng NGUỒN với
// Excel / PDF (`InvoiceDocument.sheets`) và cùng bố cục PDF mẫu 275/26 (lib/exportInvoicePdf.ts): logo + tên
// công ty, kẻ ngang, "Ba Ria, ngày" nghiêng phải, tiêu đề + số đóng khung, bên mua / chuyến, bảng kẻ lưới,
// "Says" đậm nghiêng, chữ ký công ty, khối ngân hàng đóng khung. Mỗi chứng từ một trang (ngắt trang).
// Word giữ được chữ Việt có dấu (khác PDF font chuẩn). Dựng XML tay — không cần khuôn .docx.
import PizZip from "pizzip";
import type { InvoiceCell } from "./invoiceReader";
import type { InvoiceDocument, InvoiceSheet, InvoiceSheetRow } from "./exportInvoice";
import { SELLER } from "./exportInvoice";
import { COLUMN_EDGES, pdfNumber } from "./exportInvoicePdf";

const FONT = "Times New Roman";
/** Bề rộng vùng in A4 với lề 0,5 inch (twip). */
const CONTENT_W = 11906 - 2 * 720;
const TW = 20; // 1 pt = 20 twip

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface RunOpts {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** pt */
  size?: number;
  font?: string;
}
function run(text: string, o: RunOpts = {}): string {
  const sz = Math.round((o.size ?? 11) * 2);
  const f = o.font ?? FONT;
  const pr = [
    `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`,
    o.bold ? "<w:b/>" : "",
    o.italic ? "<w:i/>" : "",
    o.underline ? '<w:u w:val="single"/>' : "",
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
  ].join("");
  // Xuống dòng trong ô (khối ngân hàng, ghi chú) ⇒ <w:br/>.
  return text
    .split("\n")
    .map((part, i) => `<w:r><w:rPr>${pr}</w:rPr>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(part)}</w:t></w:r>`)
    .join("");
}
function para(runs: string, o: { align?: "left" | "center" | "right"; after?: number; before?: number; borderBottom?: boolean } = {}): string {
  const pr = [
    o.borderBottom ? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="000000"/></w:pBdr>' : "",
    `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}"/>`,
    o.align && o.align !== "left" ? `<w:jc w:val="${o.align}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${pr}</w:pPr>${runs}</w:p>`;
}

type Border = "single" | "nil";
interface CellSpec {
  content: string;
  width: number;
  span?: number;
  borders?: { top?: Border; bottom?: Border; left?: Border; right?: Border };
  vAlign?: "top" | "center" | "bottom";
}
function cell(c: CellSpec): string {
  const b = c.borders ?? {};
  const side = (name: string, v: Border | undefined) => `<w:${name} w:val="${v ?? "nil"}"${v === "single" ? ' w:sz="6" w:color="000000"' : ""}/>`;
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${Math.round(c.width)}" w:type="dxa"/>${c.span && c.span > 1 ? `<w:gridSpan w:val="${c.span}"/>` : ""}` +
    `<w:tcBorders>${side("top", b.top)}${side("left", b.left)}${side("bottom", b.bottom)}${side("right", b.right)}</w:tcBorders>` +
    `<w:vAlign w:val="${c.vAlign ?? "top"}"/></w:tcPr>${c.content || para("")}</w:tc>`
  );
}
function table(widths: number[], rows: string[]): string {
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(widths.reduce((a, b) => a + b, 0))}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`
  );
}
const tr = (cells: string[]) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join("")}</w:tr>`;

const str = (c: InvoiceCell) => (c == null ? "" : String(c));
const filled = (c: InvoiceCell) => c != null && c !== "";

/** Logo (inline, 78 pt ngang như PDF) — `rId` của ảnh trong document.xml.rels. */
function logoRun(rId: string, w: number, h: number): string {
  const cx = Math.round(78 * 12700);
  const cy = Math.round((cx * h) / w);
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/** Kích thước JPEG (đọc khung SOF) — để logo đúng tỉ lệ. */
export function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + len;
  }
  return null;
}

function sheetXml(sheet: InvoiceSheet, first: boolean, logo: { rId: string; w: number; h: number } | null): string {
  const edgesPt = COLUMN_EDGES[sheet.name] ?? COLUMN_EDGES.INVOICE;
  const scale = CONTENT_W / ((edgesPt[edgesPt.length - 1] - edgesPt[0]) * TW);
  const widths = edgesPt.slice(1).map((x, i) => (x - edgesPt[i]) * TW * scale);
  const headWidths = COLUMN_EDGES.INVOICE.slice(1).map((x, i) => (x - COLUMN_EDGES.INVOICE[i]) * TW * (CONTENT_W / ((RIGHT_PT - LEFT_PT) * TW)));
  const rows = sheet.rows;
  const out: string[] = [];

  // Đầu trang: logo + tên công ty (bảng 2 cột không viền) + kẻ ngang.
  const company = rows.filter((r) => r.role === "company").map((r) => str(r.cells[1]));
  const logoW = 1700;
  // Mỗi chứng từ một trang: ngắt trang là đoạn RIÊNG (đặt trong ô bảng thì Word bỏ qua).
  if (!first) out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  out.push(
    table([logoW, CONTENT_W - logoW], [
      tr([
        cell({ width: logoW, content: para(logo ? logoRun(logo.rId, logo.w, logo.h) : ""), vAlign: "center" }),
        cell({
          width: CONTENT_W - logoW,
          vAlign: "center",
          content: company.map((t, k) => para(run(t, { bold: true, size: k === 0 ? 11 : 9.5, font: "Arial" }), { after: 60 })).join("") || para(""),
        }),
      ]),
    ]),
  );
  out.push(para("", { borderBottom: true, after: 120 }));

  // Bảng hàng hóa gom các hàng liền nhau; ngoài bảng thì đoạn văn / bảng không viền.
  const tableRows: string[] = [];
  let headSeen = 0;
  const flushTable = () => {
    if (tableRows.length) out.push(table(widths, tableRows.splice(0)));
  };
  const bankStart = rows.findIndex((r) => r.role === "text" && /^Please make TT to:/i.test(str(r.cells[0])));
  let signed = false;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === "company") continue;
    if (i === bankStart) {
      flushTable();
      const lines = rows.slice(bankStart).map((x) => str(x.cells[0])).filter(Boolean);
      const w = 4900;
      const all = { top: "single", bottom: "single", left: "single", right: "single" } as const;
      out.push(
        table([w], [tr([cell({ width: w, borders: all, content: lines.map((l, k) => para(run(l, { bold: true, italic: true, size: 9, underline: k === 0 }))).join("") })])]),
      );
      break;
    }
    const inTable = r.role === "table-head" || r.role === "item" || r.role === "line" || r.role === "packing" || r.role === "total";
    if (inTable) {
      const isHeader = r.role === "table-head" && headSeen < 2;
      const next = isHeader && headSeen === 0 ? rows[i + 1] : undefined;
      const cells: string[] = [];
      for (let k = 0; k < widths.length; k++) {
        const c = r.cells[k];
        const lastFilled = r.cells.slice(k + 1).every((x) => !filled(x));
        const spans =
          filled(c) && lastFilled && r.role === "table-head" && typeof c === "string" && ((next && next.cells.slice(k + 1).some(filled)) || /^Trade Terms:/i.test(c));
        const span = spans ? widths.length - k : 1;
        const w = widths.slice(k, k + span).reduce((a, b) => a + b, 0);
        const num = typeof c === "number";
        const text = num ? pdfNumber(c, sheet.numFmts[k] ?? null) : str(c);
        const bold = r.role === "item" || r.role === "total";
        const italic = r.role === "packing";
        const underline = r.role === "table-head" && !isHeader && k >= 2;
        const align = num ? "right" : r.role === "table-head" || (r.role === "total" && k === 1) ? "center" : "left";
        const borders = {
          left: "single" as const,
          right: "single" as const,
          top: i > 0 && (r.role === "total" || (r.role === "table-head" && headSeen === 0) || (isHeader && headSeen === 1 && spansPrev(rows[i - 1], k))) ? ("single" as const) : ("nil" as const),
          bottom: r.role === "total" || (r.role === "table-head" && headSeen === 1) ? ("single" as const) : ("nil" as const),
        };
        cells.push(cell({ width: w, span, borders, vAlign: isHeader ? "center" : "top", content: para(run(text, { bold, italic, underline, size: r.role === "table-head" ? (isHeader ? 9 : 10.5) : 10.5 }), { align, before: 40, after: 40 }) }));
        k += span - 1;
      }
      tableRows.push(tr(cells));
      if (r.role === "table-head") headSeen += 1;
      if (r.role === "total") flushTable();
      continue;
    }
    flushTable();
    if (r.role === "blank") {
      if (!signed) out.push(para("", { after: 0 }));
      continue;
    }
    if (r.role === "title") {
      const title = str(r.cells[0]);
      const no = str(r.cells[4]);
      if (!no) {
        out.push(para(run(title, { bold: true, size: 22 }), { align: "center", before: 120, after: 120 }));
        continue;
      }
      const leftW = CONTENT_W - 2000;
      const box = { top: "single", bottom: "single", left: "single", right: "single" } as const;
      out.push(
        table([leftW, 2000], [
          tr([
            cell({ width: leftW, vAlign: "center", content: para(run(title, { bold: true, size: 22 }), { align: "center" }) }),
            cell({ width: 2000, borders: box, vAlign: "center", content: para(run(no, { bold: true, size: 22 }), { align: "center" }) }),
          ]),
        ]),
      );
      out.push(para("", { after: 120 }));
      continue;
    }
    if (r.role === "signature") {
      out.push(para(run(str(r.cells.find(filled) ?? SELLER.signature), { bold: true, size: 11.5 }), { align: "right", before: 200, after: 120 }));
      signed = true;
      continue;
    }
    if (r.role === "head" && r.cells.some((c) => /^\s*(Ba Ria|BA RIA),\s*$/i.test(str(c)))) {
      out.push(para(run(r.cells.filter(filled).map(str).join(" "), { italic: true, size: 10.5 }), { align: "right", after: 120 }));
      continue;
    }
    if (r.role === "head") {
      // Bên mua trái · nhãn chuyến giữa · giá trị phải (cùng cột với Invoice): bảng không viền 3 khối.
      const blocks = r.cells.map((c, k) => ({ c, k })).filter((x) => filled(x.c));
      const cellsXml: string[] = [];
      let col = 0;
      blocks.forEach((b, idx) => {
        if (b.k > col) {
          const w = headWidths.slice(col, b.k).reduce((a, x) => a + x, 0);
          cellsXml.push(cell({ width: w, span: b.k - col, content: para("") }));
        }
        const end = blocks[idx + 1]?.k ?? headWidths.length;
        const w = headWidths.slice(b.k, end).reduce((a, x) => a + x, 0);
        cellsXml.push(cell({ width: w, span: end - b.k, content: para(run(str(b.c), { bold: /^Applicant:/i.test(str(b.c)), size: 10.5 }), { after: 40 }) }));
        col = end;
      });
      if (col < headWidths.length) cellsXml.push(cell({ width: headWidths.slice(col).reduce((a, x) => a + x, 0), span: headWidths.length - col, content: para("") }));
      out.push(table(headWidths, [tr(cellsXml)]));
      continue;
    }
    if (r.role === "text") {
      const cells = r.cells.filter((c) => c !== undefined);
      if (cells.filter(filled).length > 1) {
        // Ghi chú riêng của khách dạng bảng (khối *NOTE).
        const w = CONTENT_W / cells.length;
        const all = { top: "single", bottom: "single", left: "single", right: "single" } as const;
        out.push(table(cells.map(() => w), [tr(cells.map((c) => cell({ width: w, borders: all, content: para(run(str(c), { size: 9.5 })) })))]));
        continue;
      }
      const t = str(r.cells[0]);
      const m = /^(Says?:)\s*(.*)$/i.exec(t);
      if (m) out.push(para(run(`${m[1]}\t`, { bold: true, italic: true, size: 10.5 }) + run(m[2], { bold: true, italic: true, size: 10.5 }), { before: 200, after: 80 }));
      else out.push(para(run(t, { bold: /^\*?NOTE/i.test(t), size: 10.5 }), { before: 60, after: 40 }));
    }
  }
  flushTable();
  return out.join("");
}

const LEFT_PT = COLUMN_EDGES.INVOICE[0];
const RIGHT_PT = COLUMN_EDGES.INVOICE[COLUMN_EDGES.INVOICE.length - 1];

/** Dòng 2 của tiêu đề: ô nằm dưới phần phủ của dòng 1 ("IN US. DOLLARS") thì kẻ trên để chia hai cột tiền. */
function spansPrev(prev: InvoiceSheetRow | undefined, k: number): boolean {
  if (!prev) return false;
  let lastIdx = -1;
  prev.cells.forEach((c, idx) => {
    if (filled(c)) lastIdx = idx;
  });
  return lastIdx >= 0 && k >= lastIdx && typeof prev.cells[lastIdx] === "string";
}

/** Bytes .docx của bộ chứng từ. `logoJpeg` = public/invoice-logo.jpg; không có ⇒ chỉ in chữ. */
export function invoiceDocxBytes(doc: InvoiceDocument, logoJpeg?: Uint8Array | ArrayBuffer | null): Uint8Array {
  const logoBytes = logoJpeg ? Uint8Array.from(logoJpeg instanceof ArrayBuffer ? new Uint8Array(logoJpeg) : logoJpeg) : null;
  const size = logoBytes ? jpegSize(logoBytes) : null;
  const logo = logoBytes && size ? { rId: "rIdLogo", ...size } : null;
  const body = doc.sheets.map((s, i) => sheetXml(s, i === 0, logo)).join("");
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Default Extension="jpg" ContentType="image/jpeg"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<dc:title>${esc(doc.fileName.replace(/\.xlsx$/i, ""))}</dc:title><dc:creator>Baseafood MES</dc:creator></cp:coreProperties>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      (logo ? `<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpg"/>` : "") +
      `</Relationships>`,
  );
  if (logo && logoBytes) zip.file("word/media/logo.jpg", logoBytes);
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

/** Tên file Word cùng tên với file Excel: "INVOICE 275.26.docx". */
export const invoiceDocxFileName = (doc: InvoiceDocument) => doc.fileName.replace(/\.xlsx$/i, ".docx");
