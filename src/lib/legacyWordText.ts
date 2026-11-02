// ============================================================
// Tên file: src/lib/legacyWordText.ts
// Tên tiếng Việt: Đọc chữ + bảng của file Word đời cũ (.doc, Word 97–2003) để xem trong app
// Description: Extracts the main-document text of a binary .doc (OLE compound file) through its piece table
//              (FIB → Clx → PlcPcd) and splits it into paragraphs / table rows. No formatting, no images —
//              browsers have no renderer for .doc and files must not leave the app (ba-spec 61 R2, R4).
// ============================================================

export type WordBlock = { type: "paragraph"; text: string } | { type: "row"; cells: string[] };

const FIB_IDENT = 0xa5ec;
const FIB_FLAGS = 0x0a;
const FLAG_ENCRYPTED = 0x0100;
const FLAG_TABLE_1 = 0x0200;
const FIB_CCP_TEXT = 0x4c;
const FIB_FC_CLX = 0x01a2;
const FIB_LCB_CLX = 0x01a6;

/** Byte → chuỗi của mảnh nén (1 byte / ký tự) — bảng mã Windows-1252 như Word ghi. */
const cp1252 = new TextDecoder("windows-1252");
const utf16 = new TextDecoder("utf-16le");

/**
 * Trích nội dung chính của file .doc thành các khối đoạn văn / dòng bảng (ba-spec 61 AC-2, AC-3).
 * Ném lỗi tiếng Việt khi không phải file Word 97–2003, file mã hóa, hoặc định dạng Word 6/95 (không có bảng mảnh).
 */
export async function readLegacyWordBlocks(bytes: Uint8Array): Promise<WordBlock[]> {
  const { CFB } = await import("xlsx");
  let container;
  try {
    container = CFB.read(bytes, { type: "array" });
  } catch {
    throw new Error("File không phải Word 97–2003 (.doc) hợp lệ.");
  }
  const word = streamBytes(CFB.find(container, "WordDocument"));
  if (!word || word.length < FIB_LCB_CLX + 4) throw new Error("File không phải Word 97–2003 (.doc) hợp lệ.");
  const view = new DataView(word.buffer, word.byteOffset, word.byteLength);
  if (view.getUint16(0, true) !== FIB_IDENT) throw new Error("File không phải Word 97–2003 (.doc) hợp lệ.");
  const flags = view.getUint16(FIB_FLAGS, true);
  if (flags & FLAG_ENCRYPTED) throw new Error("File Word có mật khẩu — tải về để mở bằng Word.");
  const table = streamBytes(CFB.find(container, flags & FLAG_TABLE_1 ? "1Table" : "0Table"));
  const fcClx = view.getUint32(FIB_FC_CLX, true);
  const lcbClx = view.getUint32(FIB_LCB_CLX, true);
  if (!table || !lcbClx || fcClx + lcbClx > table.length) throw new Error("Định dạng Word quá cũ (Word 6/95) — tải về để mở bằng Word.");
  const ccpText = view.getInt32(FIB_CCP_TEXT, true);
  return wordTextToBlocks(readPieces(word, table, fcClx, lcbClx, ccpText));
}

function streamBytes(entry: { content?: ArrayLike<number> } | null | undefined): Uint8Array | null {
  if (!entry?.content) return null;
  return entry.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry.content);
}

/** Ghép chữ theo bảng mảnh (PlcPcd trong Clx), chỉ lấy phần thân chính (`ccpText` ký tự đầu). */
function readPieces(word: Uint8Array, table: Uint8Array, fcClx: number, lcbClx: number, ccpText: number): string {
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  let pos = fcClx;
  const end = fcClx + lcbClx;
  // Bỏ các Prc (0x01 + cbGrpprl) đứng trước Pcdt (0x02).
  while (pos < end && table[pos] === 0x01) pos += 3 + tv.getInt16(pos + 1, true);
  if (table[pos] !== 0x02) throw new Error("Không đọc được bảng mảnh của file Word.");
  const lcb = tv.getUint32(pos + 1, true);
  const plc = pos + 5;
  const count = (lcb - 4) / 12;
  if (!Number.isInteger(count) || count < 1) throw new Error("Không đọc được bảng mảnh của file Word.");
  let out = "";
  for (let i = 0; i < count; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true);
    if (cpStart >= ccpText) break;
    const cpEnd = Math.min(tv.getUint32(plc + (i + 1) * 4, true), ccpText);
    const fc = tv.getUint32(plc + (count + 1) * 4 + i * 8 + 2, true);
    const length = cpEnd - cpStart;
    if (length <= 0) continue;
    if (fc & 0x40000000) {
      const at = (fc & 0x3fffffff) / 2;
      out += cp1252.decode(word.subarray(at, at + length));
    } else {
      out += utf16.decode(word.subarray(fc, fc + length * 2));
    }
  }
  return out;
}

/**
 * Chữ thô của Word → khối. `\r` hết đoạn, `\x07` hết ô (ô cuối dòng có thêm một `\x07` đánh dấu hết dòng),
 * `\x0b` xuống dòng trong đoạn, `\x0c` ngắt trang. Mã trường `\x13 lệnh \x14 kết quả \x15` chỉ giữ kết quả.
 * Ô trống ngay sau ô khác dễ bị hiểu là hết dòng (không đọc thuộc tính bảng) — chấp nhận, chữ vẫn đủ.
 */
export function wordTextToBlocks(raw: string): WordBlock[] {
  const blocks: WordBlock[] = [];
  const fieldStack: boolean[] = []; // true = đang ở phần KẾT QUẢ của trường
  let cur = "";
  let cellLines: string[] = [];
  let cells: string[] = [];
  let afterCell = false;

  const pushParagraph = (text: string) => {
    const t = text.replace(/[ \t]+$/g, "");
    if (t.trim()) blocks.push({ type: "paragraph", text: t });
  };

  for (const ch of raw) {
    if (ch === "\x13") {
      fieldStack.push(false);
      continue;
    }
    if (ch === "\x14") {
      if (fieldStack.length) fieldStack[fieldStack.length - 1] = true;
      continue;
    }
    if (ch === "\x15") {
      fieldStack.pop();
      continue;
    }
    if (fieldStack.some((isResult) => !isResult)) continue;

    if (ch === "\x07") {
      const content = [...cellLines, cur].join("\n").trim();
      if (afterCell && !content) {
        blocks.push({ type: "row", cells });
        cells = [];
        afterCell = false;
      } else {
        cells.push(content);
        afterCell = true;
      }
      cur = "";
      cellLines = [];
      continue;
    }
    if (ch === "\r" || ch === "\x0c") {
      if (cells.length) cellLines.push(cur);
      else pushParagraph(cur);
      cur = "";
      continue;
    }
    afterCell = false;
    if (ch === "\x0b") cur += "\n";
    else if (ch === "\x1e") cur += "-";
    else if (ch === "\t" || ch >= " ") cur += ch;
  }
  if (cells.length) blocks.push({ type: "row", cells: [...cells, ...(cur.trim() ? [cur.trim()] : [])] });
  else pushParagraph(cur);
  return blocks;
}
