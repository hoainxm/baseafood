// ============================================================
// Tên file: src/lib/contractFileReader.ts
// Tên tiếng Việt: Mở file hợp đồng (Word .docx / .doc, PDF có chữ) thành các dòng chữ để đọc
// Description: Loaders for ba-spec 66 R1–R2. .docx = zip ⇒ word/document.xml (pizzip, already used by
//              the document composer) ⇒ rowsFromDocxXml (pure: paragraph = row, tab = cell, table row =
//              its cells, merged cells expanded so columns line up). .doc ⇒ readLegacyWord (the reader of
//              the file viewer, ba-spec 61). Embedded Excel table (OLE "EMBED Excel.Sheet") ⇒ its rows in place.
//              PDF via pdfTextItems (≤ 10 pages; < 40 characters ⇒ scan, not read) ⇒ rowsFromPdfItems.
//              Parsing + filling: contractReader.ts. Never uploads.
// ============================================================
import { CONTRACT_FAILURE_MESSAGES, contractFileProblem, parseContractRows, rowsFromPdfItems, type ContractReadFailure, type ContractReadResult, type ContractRole } from "./contractReader";
import { pdfTextItems } from "./invoiceFileReader";
import { readLegacyWord, type WordBlock, type WordEmbedBlock } from "./legacyWordText";

type Xlsx = typeof import("xlsx");

/** Dòng đánh dấu chỗ một bảng Excel nhúng: [EMBED_MARKER, khóa] — loader thay bằng các dòng của bảng. */
export const EMBED_MARKER = "\u0000EMBED";

/** Khối của file .doc ⇒ dòng như rowsFromDocxXml: đoạn văn tách ô theo tab, dòng bảng giữ ô, bảng Excel nhúng ⇒ dòng đánh dấu (khóa = thứ tự). */
export function rowsFromWordBlocks(blocks: readonly (WordBlock | WordEmbedBlock)[]): string[][] {
  let excel = 0;
  const tidy = (t: string) => t.replace(/\s+/g, " ").trim();
  return blocks
    .flatMap((b) =>
      b.type === "embed" ? (/^Excel\./i.test(b.progId) ? [[EMBED_MARKER, String(excel++)]] : []) : b.type === "row" ? [b.cells.map(tidy)] : [b.text.split(/\t+/).map(tidy).filter(Boolean)],
    )
    .filter((r) => r.length);
}

const fail = (reason: ContractReadFailure, message = CONTRACT_FAILURE_MESSAGES[reason]): ContractReadResult => ({ ok: false, reason, message });

/** PDF hợp đồng dài hơn invoice (điều khoản, phụ lục kèm) ⇒ đọc tới 10 trang đầu. */
const MAX_PDF_PAGES = 10;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );

/**
 * Chữ của `word/document.xml` thành dòng (bảng Excel nhúng ⇒ dòng [EMBED_MARKER, r:id]): đoạn văn ngoài bảng = dòng, tab tách ô ("Size :⇥100/200⇥200/300"
 * ⇒ 3 ô, như PDF tách theo khoảng trống); mỗi dòng bảng = các ô
 * (ô gộp ngang `gridSpan` = n ⇒ thêm n − 1 ô trống để cột thẳng hàng; ô gộp dọc để trống — bộ đọc lấy
 * giá trị dòng trên). Bảng lồng trong ô ⇒ chữ vào ô ngoài. Không cần DOM (chạy được trong test).
 */
export function rowsFromDocxXml(xml: string): string[][] {
  const rows: string[][] = [];
  const tok = /<(\/?)w:(tbl|tr|tc|p|t|tab|br|cr|gridSpan)\b([^>]*?)(\/?)>|([^<]+)|<[^>]*>/g;
  let tbl = 0;
  let row: string[] | null = null;
  let cell: string[] | null = null;
  let span = 1;
  let para: string[] = [];
  let pDepth = 0;
  let inText = false;
  for (const m of xml.matchAll(tok)) {
    const [, end, name, attrs, selfClose, text] = m;
    if (text !== undefined) {
      if (inText) para.push(decode(text));
      continue;
    }
    if (!name) {
      // Bảng Excel nhúng (OLE) — loader thay bằng các dòng của bảng.
      const ole = m[0].match(/^<o:OLEObject\b[^>]*ProgID="Excel\.[^"]*"[^>]*r:id="([^"]+)"/) ?? m[0].match(/^<o:OLEObject\b[^>]*r:id="([^"]+)"[^>]*ProgID="Excel\./);
      if (ole && !tbl) rows.push([EMBED_MARKER, ole[1]]);
      continue;
    }
    if (name === "t") {
      inText = !end && !selfClose;
      continue;
    }
    if ((name === "tab" || name === "br" || name === "cr") && !end) {
      para.push(name === "tab" && !cell ? "\t" : " ");
      continue;
    }
    if (name === "gridSpan") {
      if (tbl === 1) span = Number(attrs.match(/w:val="(\d+)"/)?.[1] ?? 1) || 1;
      continue;
    }
    if (name === "tbl") {
      if (selfClose) continue;
      tbl += end ? -1 : 1;
      continue;
    }
    if (tbl === 1 && name === "tr") {
      if (end) {
        if (row) rows.push(row);
        row = null;
      } else if (!selfClose) row = [];
      continue;
    }
    if (tbl === 1 && name === "tc") {
      if (end) {
        row?.push((cell ?? []).join(" ").replace(/\s+/g, " ").trim(), ...Array<string>(Math.max(0, span - 1)).fill(""));
        cell = null;
      } else if (!selfClose) {
        cell = [];
        span = 1;
      }
      continue;
    }
    if (name === "p") {
      if (selfClose) continue;
      if (!end) {
        pDepth++;
        continue;
      }
      pDepth = Math.max(0, pDepth - 1);
      if (pDepth > 0) continue;
      const raw = para.join("");
      para = [];
      const t = raw.replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (cell) cell.push(t);
      else if (!tbl) rows.push(raw.split(/\t+/).map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean));
    }
  }
  return rows;
}

type Zip = typeof import("pizzip");

/**
 * Các dòng của một bảng Excel nhúng, ĐÚNG phần hợp đồng hiển thị: trong vùng `oleSize` của workbook (A1:G23)
 * và bỏ dòng / cột ẩn — bảng nhúng hay là cả bảng giá, chỉ vài dòng được hiện (17-26-NEWPOINT: 31 dòng, hiện 7).
 * Chữ giữ đúng định dạng ô ("14.0", "7,000.00").
 */
function workbookRows(XLSX: Xlsx, PizZip: Zip | null, data: Uint8Array): string[][] {
  let range: string | undefined;
  try {
    range = PizZip ? new PizZip(data).file("xl/workbook.xml")?.asText().match(/<oleSize\b[^>]*ref="([^"]+)"/)?.[1] : undefined;
  } catch {
    range = undefined; // .xls (BIFF) không phải zip — không có oleSize
  }
  const wb = XLSX.read(data, { type: "array", cellStyles: true });
  const active = (wb.Workbook as { WBView?: { activeTab?: number }[] } | undefined)?.WBView?.[0]?.activeTab ?? 0;
  const order = [wb.SheetNames[active], ...wb.SheetNames.filter((_, i) => i !== active)].filter(Boolean);
  for (const name of order) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false, skipHidden: true, ...(range && name === order[0] ? { range } : {}) });
    const text = rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()));
    if (text.some((r) => r.some(Boolean))) return text;
  }
  return [];
}

/** Thay dòng đánh dấu bảng nhúng bằng các dòng của bảng; không mở được ⇒ bỏ dòng đánh dấu. */
function spliceEmbeds(rows: string[][], load: (key: string) => string[][]): string[][] {
  return rows.flatMap((r) => {
    if (r[0] !== EMBED_MARKER) return [r];
    try {
      return load(r[1]);
    } catch {
      return [];
    }
  });
}

async function rowsFromDocx(data: ArrayBuffer): Promise<string[][]> {
  const { default: PizZip } = await import("pizzip");
  const zip = new PizZip(data);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("file .docx không có word/document.xml");
  const rows = rowsFromDocxXml(xml);
  if (!rows.some((r) => r[0] === EMBED_MARKER)) return rows;
  const XLSX = await import("xlsx");
  const rels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
  return spliceEmbeds(rows, (id) => {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${id}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${id}"`))?.[1];
    const file = target ? zip.file(`word/${target.replace(/^\.?\//, "")}`) : null;
    return file && /\.xlsx?$/i.test(target ?? "") ? workbookRows(XLSX, PizZip, file.asUint8Array()) : [];
  });
}

/** Word 97–2003 (.doc): chữ + bảng qua readLegacyWord; bảng Excel nhúng thứ k ⇒ workbook thứ k của ObjectPool. */
async function rowsFromDoc(data: ArrayBuffer): Promise<string[][]> {
  const { blocks, workbooks } = await readLegacyWord(new Uint8Array(data));
  const rows = rowsFromWordBlocks(blocks);
  if (!rows.some((r) => r[0] === EMBED_MARKER)) return rows;
  const [XLSX, { default: PizZip }] = await Promise.all([import("xlsx"), import("pizzip")]);
  return spliceEmbeds(rows, (k) => {
    const wb = workbooks[Number(k)];
    return wb ? workbookRows(XLSX, wb.kind === "xlsx" ? PizZip : null, wb.bytes) : [];
  });
}

/**
 * File Word (.docx / .doc) hoặc PDF có chữ ⇒ các dòng chữ (đoạn văn = dòng, dòng bảng = các ô). PDF ảnh quét ⇒ "scan".
 * Dùng chung cho đọc hợp đồng (ba-spec 66) và đọc file lệnh sản xuất (ba-spec 48 R21). Không ghi gì, không gửi file đi.
 */
export async function readDocumentRows(file: Blob, fileName: string, maxPdfPages = MAX_PDF_PAGES): Promise<string[][] | "scan"> {
  const data = await file.arrayBuffer();
  if (/\.pdf$/i.test(fileName)) {
    const items = await pdfTextItems(data, maxPdfPages);
    return items === "scan" ? "scan" : rowsFromPdfItems(items);
  }
  return /\.doc$/i.test(fileName) ? rowsFromDoc(data) : rowsFromDocx(data);
}

/** Đọc một file hợp đồng / phụ lục (vừa chọn, hoặc tải về từ kho file). Không ghi gì, không gửi file đi đâu. */
export async function readContractFile(file: Blob, fileName: string, role: ContractRole): Promise<ContractReadResult> {
  const problem = contractFileProblem(fileName);
  if (problem) return fail(problem);
  try {
    const rows = await readDocumentRows(file, fileName);
    return rows === "scan" ? fail("scan") : parseContractRows(rows, role);
  } catch (e) {
    return fail("error", `${CONTRACT_FAILURE_MESSAGES.error}${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
  }
}
