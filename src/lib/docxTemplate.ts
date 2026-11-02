// ============================================================
// Tên file: src/lib/docxTemplate.ts
// Tên tiếng Việt: Khuôn Word — dựng, điền thẻ, đọc thẻ, lấy chữ của file .docx
// Description: Thin layer over docxtemplater + pizzip for the document composer (ba-spec 54 R8, R13):
//              build a minimal .docx from body XML (built-in templates), fill `{tags}` / `{#rows}…{/rows}`,
//              list the tags of an uploaded template, read back plain text (tests, checks). No I/O here.
// ============================================================
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Bytes = ArrayBuffer | Uint8Array;

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Chữ thường trong XML (không phải thẻ). */
export const xmlText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Dựng .docx tối thiểu từ phần thân `<w:body>` (đã có `w:sectPr`). Font mặc định do `font` + `sizeHalfPt`
 * (cỡ chữ tính nửa point như Word: 22 = 11 pt).
 */
export function buildDocx(bodyXml: string, opts: { font?: string; sizeHalfPt?: number; title?: string } = {}): Uint8Array {
  const font = opts.font ?? "Times New Roman";
  const sz = opts.sizeHalfPt ?? 22;
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
  );
  zip.file(
    "docProps/core.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      `<dc:title>${xmlText(opts.title ?? "")}</dc:title><dc:creator>Baseafood MES</dc:creator></cp:coreProperties>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
      `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="vi-VN"/>` +
      '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>',
  );
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${bodyXml}</w:body></w:document>`);
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

const toU8 = (b: Bytes): Uint8Array => (b instanceof Uint8Array ? b : new Uint8Array(b));

/** Điền thẻ `{khóa}`, vòng lặp bảng `{#lines}…{/lines}`; thiếu giá trị ⇒ chữ rỗng; "\n" ⇒ xuống dòng. */
export function fillDocx(template: Bytes, data: Record<string, unknown>): Uint8Array {
  const doc = new Docxtemplater(new PizZip(toU8(template)), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(data);
  return doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
}

/** Các phần của file có thể chứa thẻ: thân, đầu trang, chân trang. */
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;

/**
 * R13: thẻ trong khuôn, phẳng hóa — vòng lặp "lines" kèm thẻ con "lines.kg". Dựng thử docxtemplater trước:
 * khuôn hỏng (thẻ mở không đóng…) ⇒ ném lỗi để người tải biết sửa khuôn.
 */
export function readTemplateTags(template: Bytes): string[] {
  const zip = new PizZip(toU8(template));
  new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  const tags = new Set<string>();
  for (const name of Object.keys(zip.files).filter((n) => TEXT_PARTS.test(n)).sort()) {
    const scope: string[] = [];
    for (const m of xmlPlainText(zip.file(name)?.asText() ?? "").matchAll(/\{([#/^]?)\s*([^{}]+?)\s*\}/g)) {
      const [, mark, key] = m;
      if (mark === "/") {
        scope.pop();
        continue;
      }
      tags.add([...scope, key].join("."));
      if (mark === "#" || mark === "^") scope.push(key);
    }
  }
  return [...tags].sort();
}

/** Chữ của XML WordprocessingML: mỗi đoạn một dòng, ô bảng cách bằng tab. */
function xmlPlainText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Chữ của một phần trong file (mặc định thân văn bản). */
export const docxPlainText = (file: Bytes, part = "word/document.xml"): string => xmlPlainText(new PizZip(toU8(file)).file(part)?.asText() ?? "");

/** XML thô của một phần — cho kiểm khổ giấy, thẻ sót. */
export const docxPartXml = (file: Bytes, part = "word/document.xml"): string => new PizZip(toU8(file)).file(part)?.asText() ?? "";

/** Tải file .docx về máy (trình duyệt). */
export function downloadDocx(file: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([file as BlobPart], { type: DOCX_MIME }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
