// ============================================================
// Tên file: src/lib/documentTypes/exportOrderTemplate.ts
// Tên tiếng Việt: Khuôn Word gốc của Lệnh xuất hàng (QTI-KH-01-07)
// Description: Built-in .docx template rebuilt from the paper form "FORM LỆNH XUẤT HÀNG" (ba-spec 72 R7): A4
//              portrait, Times New Roman, form code + title + number/date, "Kính gửi" list, 8-column line table with
//              a row loop + total row, delivery block, loading notes, document requirements, company sign-off.
//              Each `{tag}` sits in its own run so docxtemplater reads it intact. Admins can replace it (ba-spec 54 R13).
// ============================================================
import { buildDocx, xmlText } from "../docxTemplate";

type RunOpts = { b?: boolean; i?: boolean; sz?: number };
const run = (text: string, o: RunOpts = {}) => {
  const rpr = `${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}`;
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
};
type Piece = string | [string, RunOpts];
function para(pieces: Piece[], o: { align?: "center" | "right"; before?: number; after?: number; keep?: boolean } = {}) {
  const ppr =
    (o.keep ? "<w:keepNext/>" : "") + (o.before || o.after ? `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}"/>` : "") + (o.align ? `<w:jc w:val="${o.align}"/>` : "");
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${pieces.map((p) => (typeof p === "string" ? run(p) : run(p[0], p[1]))).join("")}</w:p>`;
}
const B = (t: string): Piece => [t, { b: true }];

/* Bảng hàng 8 cột trên vùng in A4 (11906 − lề 1134 − 850 = 9922 twip). */
const COLS = [510, 2041, 1077, 1531, 794, 1361, 1191, 1417];
const TABLE_W = COLS.reduce((s, x) => s + x, 0);
const border = ["top", "left", "bottom", "right", "insideH", "insideV"].map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("");
const NO_BORDER = ["top", "left", "bottom", "right", "insideH", "insideV"].map((e) => `<w:${e} w:val="nil"/>`).join("");

function cell(col: number, content: string, o: { span?: number; align?: "center" | "right"; b?: boolean } = {}) {
  const w = COLS.slice(col, col + (o.span ?? 1)).reduce((s, x) => s + x, 0);
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p>${o.align ? `<w:pPr><w:jc w:val="${o.align}"/></w:pPr>` : ""}${content ? run(content, { b: o.b }) : ""}</w:p></w:tc>`
  );
}

function linesTable(): string {
  const head = ["STT", "Tên hàng", "Size", "Số lượng", "MSL", "Ngày sản xuất", "Ngày hết hạn", "Hs code"];
  const headRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cell(i, h, { align: "center", b: true })).join("")}</w:tr>`;
  // {#lines} ở ô đầu, {/lines} ở ô cuối ⇒ docxtemplater lặp cả dòng bảng.
  const loopRow =
    "<w:tr>" +
    cell(0, "{#lines}{stt}", { align: "center" }) +
    cell(1, "{productName}") +
    cell(2, "{size}", { align: "center" }) +
    cell(3, "{quantity}", { align: "center" }) +
    cell(4, "{lotCode}", { align: "center" }) +
    cell(5, "{productionDates}", { align: "center" }) +
    cell(6, "{expiry}", { align: "center" }) +
    cell(7, "{hsCode}{/lines}", { align: "center" }) +
    "</w:tr>";
  const totalRow = "<w:tr>" + cell(0, "Tổng cộng", { span: 3, align: "center", b: true }) + cell(3, "{totalQuantity}", { align: "center", b: true }) + cell(4, "", { span: 4 }) + "</w:tr>";
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_W}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${COLS.map((c) => `<w:gridCol w:w="${c}"/>`).join("")}</w:tblGrid>${headRow}${loopRow}${totalRow}</w:tbl>`
  );
}

/** Khối nhãn — bảng không viền 2 cột (nhãn · nội dung) để thẳng cột ở mọi trình mở. */
const LABEL_W = 3969;
const row = (label: string, value: Piece[], labelBold = false) =>
  `<w:tr><w:tc><w:tcPr><w:tcW w:w="${LABEL_W}" w:type="dxa"/></w:tcPr>${para([labelBold ? B(label) : label])}</w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="${TABLE_W - LABEL_W}" w:type="dxa"/></w:tcPr>${para(value)}</w:tc></w:tr>`;
const heading = (text: string) =>
  `<w:tr><w:tc><w:tcPr><w:tcW w:w="${TABLE_W}" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${para([B(text)], { before: 80, keep: true })}</w:tc></w:tr>`;
const block = (rows: string[]) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_W}" w:type="dxa"/><w:tblBorders>${NO_BORDER}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
  `<w:tblGrid><w:gridCol w:w="${LABEL_W}"/><w:gridCol w:w="${TABLE_W - LABEL_W}"/></w:tblGrid>${rows.join("")}</w:tbl>`;

export function exportOrderTemplateXml(): string {
  return [
    para([["QTI-KH-01-07", { sz: 18 }]], { align: "right" }),
    para([["LỆNH XUẤT HÀNG", { b: true, sz: 32 }]], { align: "center", before: 120 }),
    para([B("Số: "), ["{orderNo}", { b: true }]], { align: "center" }),
    para([["Bà Rịa, {orderDate}", { i: true }]], { align: "right", after: 120 }),
    block([
      row("Kính gửi:", [B("BAN GIÁM ĐỐC")], true),
      row("", [B("{workshops}")]),
      row("", [B("PHÒNG KẾ TOÁN")]),
      row("", [B("BỘ PHẬN KHO")]),
    ]),
    para(["Đề nghị các bộ phận triển khai xuất hàng mặt hàng sau:"], { before: 120, after: 120 }),
    linesTable(),
    para([""], { after: 60 }),
    block([
      heading("Thông tin giao hàng:"),
      row("Số lượng x Loại container:", ["{containers}"]),
      row("Ngày đóng hàng:", ["{loadingDate}"]),
      row("Doc cut-off:", ["{docCutoff}"]),
      row("VGM cut off:", ["{vgmCutoff}"]),
      row("Cảng hạ:", ["{dischargePort}"]),
      row("Thời hạn hạ bãi:", ["{cargoCutoff}"]),
      row("ETD:", ["{etd}"]),
      row("ETA:", ["{eta}"]),
      heading("Các lưu ý khi đóng hàng:"),
      row("Đóng hàng theo size:", ["{bySize}"]),
      row("Đóng hàng theo ngày sản xuất:", ["{byProductionDate}"]),
      row("Hàng mẫu:", ["{samples}"]),
      heading("Các yêu cầu về chứng từ:"),
      row("Yêu cầu kết quả kiểm tra vi sinh:", ["{microTest}"]),
      row("Yêu cầu kết quả kiểm tra hóa học:", ["{chemicalTest}"]),
      row("Yêu cầu khác:", ["{otherRequest}"]),
    ]),
    para([B("CÔNG TY TNHH BASEAFOOD 1")], { align: "right", before: 360 }),
    // A4 dọc, lề trên/dưới 1,5 cm · trái 2 cm · phải 1,5 cm.
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="1134" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>',
  ].join("");
}

/** Khuôn gốc (.docx) — dựng mỗi lần gọi, không có file nhị phân trong repo. */
export const buildExportOrderTemplate = (): Uint8Array => buildDocx(exportOrderTemplateXml(), { sizeHalfPt: 22, title: "LỆNH XUẤT HÀNG" });
