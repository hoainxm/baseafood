import { describe, expect, it } from "vitest";
import { CFB } from "xlsx";
import { readLegacyWordBlocks, wordTextToBlocks } from "./legacyWordText";

/**
 * Dựng một file .doc tối thiểu: FIB (bảng 1Table) + Clx hai mảnh — mảnh 1 UTF-16LE, mảnh 2 nén cp1252.
 * Đủ để kiểm đường đọc bảng mảnh như file Word thật.
 */
function buildDoc(unicodePart: string, compressedPart: string, opts: { encrypted?: boolean } = {}): Uint8Array {
  const textAt = 0x400;
  const asciiAt = 0x800;
  const word = new Uint8Array(0x1000);
  const wv = new DataView(word.buffer);
  wv.setUint16(0, 0xa5ec, true);
  wv.setUint16(0x0a, 0x0200 | (opts.encrypted ? 0x0100 : 0), true);
  const total = unicodePart.length + compressedPart.length;
  wv.setInt32(0x4c, total, true);
  for (let i = 0; i < unicodePart.length; i++) wv.setUint16(textAt + i * 2, unicodePart.charCodeAt(i), true);
  for (let i = 0; i < compressedPart.length; i++) word[asciiAt + i] = compressedPart.charCodeAt(i);

  const pieces = 2;
  const lcb = (pieces + 1) * 4 + pieces * 8;
  const table = new Uint8Array(5 + lcb);
  const tv = new DataView(table.buffer);
  table[0] = 0x02;
  tv.setUint32(1, lcb, true);
  tv.setUint32(5, 0, true);
  tv.setUint32(9, unicodePart.length, true);
  tv.setUint32(13, total, true);
  const pcd = 5 + (pieces + 1) * 4;
  tv.setUint32(pcd + 2, textAt, true);
  tv.setUint32(pcd + 8 + 2, (asciiAt * 2) | 0x40000000, true);
  wv.setUint32(0x01a2, 0, true);
  wv.setUint32(0x01a6, table.length, true);

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "/WordDocument", word);
  CFB.utils.cfb_add(cfb, "/1Table", table);
  return new Uint8Array(CFB.write(cfb, { type: "array" }) as ArrayLike<number>);
}

describe("readLegacyWordBlocks — Word 97–2003 (ba-spec 61)", () => {
  it("AC-2: 2 đoạn văn + 1 dòng bảng 2 ô, giữ dấu tiếng Việt", async () => {
    const bytes = buildDoc("Hợp đồng số 01\rĐiều khoản thanh toán\r", "A\x07B\x07\x07");
    const blocks = await readLegacyWordBlocks(bytes);
    expect(blocks.length).toBe(3);
    expect(blocks[0]).toEqual({ type: "paragraph", text: "Hợp đồng số 01" });
    expect(blocks[1]).toEqual({ type: "paragraph", text: "Điều khoản thanh toán" });
    expect(blocks[2]).toEqual({ type: "row", cells: ["A", "B"] });
  });

  it("AC-3: không phải file Word ⇒ báo lỗi tiếng Việt", async () => {
    await expect(readLegacyWordBlocks(new TextEncoder().encode("%PDF-1.7 không phải Word"))).rejects.toThrow(/Word 97–2003/);
    await expect(readLegacyWordBlocks(new Uint8Array())).rejects.toThrow(/Word 97–2003/);
  });

  it("file có mật khẩu ⇒ báo tải về", async () => {
    await expect(readLegacyWordBlocks(buildDoc("Bí mật\r", "x", { encrypted: true }))).rejects.toThrow(/mật khẩu/);
  });
});

describe("wordTextToBlocks", () => {
  it("mã trường chỉ giữ kết quả; xuống dòng mềm trong đoạn; bỏ đoạn rỗng", () => {
    const blocks = wordTextToBlocks('Trang \x13 PAGE \\* MERGEFORMAT \x143\x15\r\rDòng 1\x0bDòng 2\r');
    expect(blocks).toEqual([
      { type: "paragraph", text: "Trang 3" },
      { type: "paragraph", text: "Dòng 1\nDòng 2" },
    ]);
  });

  it("hai dòng bảng liên tiếp; ô nhiều đoạn gộp xuống dòng", () => {
    const blocks = wordTextToBlocks("Tên\x07Số lượng\x07\x07Mực\x07120\rkg\x07\x07Sau bảng\r");
    expect(blocks).toEqual([
      { type: "row", cells: ["Tên", "Số lượng"] },
      { type: "row", cells: ["Mực", "120\nkg"] },
      { type: "paragraph", text: "Sau bảng" },
    ]);
  });
});
