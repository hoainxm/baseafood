// ============================================================
// Tên file: src/lib/contractFileReader.ts
// Tên tiếng Việt: Mở file hợp đồng (Word .docx / PDF có chữ) thành các dòng chữ để đọc
// Description: Loaders for ba-spec 66 R1–R2. .docx = zip ⇒ word/document.xml (pizzip, already used by
//              the document composer) ⇒ rowsFromDocxXml (pure: paragraph = one-cell row, table row =
//              its cells, merged cells expanded so columns line up). PDF via rowsFromPdf (≤ 10 pages);
//              < 40 characters ⇒ scan, not read. Parsing + filling: contractReader.ts. Never uploads.
// ============================================================
import { CONTRACT_FAILURE_MESSAGES, contractFileProblem, parseContractRows, type ContractReadFailure, type ContractReadResult, type ContractRole } from "./contractReader";
import { rowsFromPdf } from "./invoiceFileReader";

const fail = (reason: ContractReadFailure, message = CONTRACT_FAILURE_MESSAGES[reason]): ContractReadResult => ({ ok: false, reason, message });

/** PDF hợp đồng dài hơn invoice (điều khoản, phụ lục kèm) ⇒ đọc tới 10 trang đầu. */
const MAX_PDF_PAGES = 10;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );

/**
 * Chữ của `word/document.xml` thành dòng: đoạn văn ngoài bảng = dòng một ô; mỗi dòng bảng = các ô
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
    if (!name) continue;
    if (name === "t") {
      inText = !end && !selfClose;
      continue;
    }
    if ((name === "tab" || name === "br" || name === "cr") && !end) {
      para.push(" ");
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
      const t = para.join("").replace(/\s+/g, " ").trim();
      para = [];
      if (!t) continue;
      if (cell) cell.push(t);
      else if (!tbl) rows.push([t]);
    }
  }
  return rows;
}

async function rowsFromDocx(data: ArrayBuffer): Promise<string[][]> {
  const { default: PizZip } = await import("pizzip");
  const xml = new PizZip(data).file("word/document.xml")?.asText();
  if (!xml) throw new Error("file .docx không có word/document.xml");
  return rowsFromDocxXml(xml);
}

/** Đọc một file hợp đồng / phụ lục (vừa chọn, hoặc tải về từ kho file). Không ghi gì, không gửi file đi đâu. */
export async function readContractFile(file: Blob, fileName: string, role: ContractRole): Promise<ContractReadResult> {
  const problem = contractFileProblem(fileName);
  if (problem) return fail(problem);
  try {
    const data = await file.arrayBuffer();
    if (/\.pdf$/i.test(fileName)) {
      const rows = await rowsFromPdf(data, MAX_PDF_PAGES);
      return rows === "scan" ? fail("scan") : parseContractRows(rows.map((r) => r.map((c) => (c == null ? "" : String(c)))), role);
    }
    return parseContractRows(await rowsFromDocx(data), role);
  } catch (e) {
    return fail("error", `${CONTRACT_FAILURE_MESSAGES.error}${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
  }
}
