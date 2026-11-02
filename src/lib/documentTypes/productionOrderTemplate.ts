// ============================================================
// Tên file: src/lib/documentTypes/productionOrderTemplate.ts
// Tên tiếng Việt: Khuôn Word gốc của file Lệnh sản xuất (QTI-KH-01-04)
// Description: Built-in .docx template rebuilt from paper LSX 19.10 (ba-spec 54 P0, Q6 = A): A4 portrait,
//              Times New Roman, header, 7-column line table with a row loop + total row, delivery / packaging /
//              Nafi blocks, form code. Each `{tag}` sits in its own run so docxtemplater reads it intact.
//              Admins download this, edit it in Word and upload a replacement (R13).
// ============================================================
import { buildDocx, xmlText } from "../docxTemplate";

type RunOpts = { b?: boolean; i?: boolean; sz?: number };

const run = (text: string, o: RunOpts = {}) => {
  const rpr = `${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}`;
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
};
const tab = "<w:r><w:tab/></w:r>";

/** Một đoạn: mảng phần tử — chuỗi = chữ thường, "\t" = tab, [chữ, kiểu] = chữ có kiểu. */
type Piece = string | [string, RunOpts];
function para(pieces: Piece[], o: { align?: "center" | "right"; tabs?: number[]; before?: number; after?: number; keep?: boolean } = {}) {
  const ppr =
    (o.keep ? "<w:keepNext/>" : "") +
    (o.tabs?.length ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join("")}</w:tabs>` : "") +
    (o.before || o.after ? `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}"/>` : "") +
    (o.align ? `<w:jc w:val="${o.align}"/>` : "");
  const body = pieces.map((p) => (p === "\t" ? tab : typeof p === "string" ? run(p) : run(p[0], p[1]))).join("");
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${body}</w:p>`;
}

const B = (t: string): Piece => [t, { b: true }];

/* Bảng hàng: rộng vùng in A4 (11906 − lề 1134 − 850 = 9922 twip). */
const COLS = [567, 2268, 2551, 1134, 1134, 850, 1418];
const border = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';

/** Ô bảng ở cột `col` (0-based), gộp `span` cột. */
function cell(col: number, content: string, o: { span?: number; align?: "center" | "right"; b?: boolean; vAlign?: "center" } = {}) {
  const w = COLS.slice(col, col + (o.span ?? 1)).reduce((s, x) => s + x, 0);
  const tcpr = `<w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : ""}`;
  return `<w:tc><w:tcPr>${tcpr}</w:tcPr><w:p>${o.align ? `<w:pPr><w:jc w:val="${o.align}"/></w:pPr>` : ""}${content ? run(content, { b: o.b }) : ""}</w:p></w:tc>`;
}

function linesTable(): string {
  const head = ["STT", "Tên hàng", "Quy cách", "Số lượng thùng", "Số lượng (kg)", "Mã số lô", "Ngày SX"];
  const headRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cell(i, h, { align: "center", b: true, vAlign: "center" })).join("")}</w:tr>`;
  // {#lines} ở ô đầu, {/lines} ở ô cuối ⇒ docxtemplater lặp cả dòng bảng.
  const loopRow =
    "<w:tr>" +
    cell(0, "{#lines}{stt}", { align: "center" }) +
    cell(1, "{productName}", { b: true }) +
    cell(2, "{spec}") +
    cell(3, "{cartons}", { align: "right" }) +
    cell(4, "{kg}", { align: "right" }) +
    cell(5, "{lotCode}", { align: "center" }) +
    cell(6, "{productionDates}{/lines}", { align: "center" }) +
    "</w:tr>";
  const totalRow =
    "<w:tr>" +
    cell(0, "Tổng", { span: 3, align: "center", b: true }) +
    cell(3, "{totalCartons}", { align: "right", b: true }) +
    cell(4, "{totalKg}", { align: "right", b: true }) +
    cell(5, "", { span: 2 }) +
    "</w:tr>";
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${COLS.reduce((s, x) => s + x, 0)}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${COLS.map((c) => `<w:gridCol w:w="${c}"/>`).join("")}</w:tblGrid>${headRow}${loopRow}${totalRow}</w:tbl>`
  );
}

/** Khối nhãn — bảng KHÔNG viền 2 cột (nhãn 6 cm · nội dung): thẳng cột ở mọi trình mở, không phụ thuộc điểm dừng tab. */
const LABEL_W = 3402;
const VALUE_W = COLS.reduce((s, x) => s + x, 0) - LABEL_W;
const gap = "    ";
const NO_BORDER = ["top", "left", "bottom", "right", "insideH", "insideV"].map((e) => `<w:${e} w:val="nil"/>`).join("");
const row = (label: string, pieces: Piece[]) =>
  `<w:tr><w:tc><w:tcPr><w:tcW w:w="${LABEL_W}" w:type="dxa"/></w:tcPr>${para(label ? [label] : [""])}</w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="${VALUE_W}" w:type="dxa"/></w:tcPr>${para(pieces)}</w:tc></w:tr>`;
/** Dòng tiêu đề khối, trải 2 cột. */
const heading = (text: string) =>
  `<w:tr><w:tc><w:tcPr><w:tcW w:w="${LABEL_W + VALUE_W}" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>${para([B(text)], { before: 80, keep: true })}</w:tc></w:tr>`;
/** MỘT bảng cho cả ba khối ⇒ cột nhãn thẳng hàng kể cả ở trình mở tự co cột theo chữ. */
const block = (rows: string[]) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${LABEL_W + VALUE_W}" w:type="dxa"/><w:tblBorders>${NO_BORDER}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
  `<w:tblGrid><w:gridCol w:w="${LABEL_W}"/><w:gridCol w:w="${VALUE_W}"/></w:tblGrid>${rows.join("")}</w:tbl>`;

export function productionOrderTemplateXml(): string {
  const body = [
    para([B("CÔNG TY BASEAFOOD 1")]),
    para([["LỆNH SẢN XUẤT", { b: true, sz: 32 }]], { align: "center", before: 120 }),
    para([B("SỐ: "), ["{orderNo}", { b: true }]], { align: "center" }),
    para([["{orderDate}", { i: true }]], { align: "right", after: 120 }),
    para([B("KÍNH GỞI:"), "\t", B("{recipients}")], { tabs: [1701] }),
    para(["\t", "Đề nghị các bộ phận triển khai sản xuất mặt hàng sau:"], { tabs: [1701], before: 60, after: 120 }),
    linesTable(),
    para([""], { after: 60 }),
    block([
      row("Dự kiến có bao bì:", [B("{packagingReady}")]),
      row("Ngày giao hàng:", [B("{deliveryDate}")]),
      row("Xuất vào thị trường:", [B("{market}")]),
      row("Ngày hết hạn:", ["{shelfLife}"]),
      row("Quy trình sản xuất:", ["{process}"]),
      heading("Các yêu cầu về bao bì:"),
      row("Thùng carton:", ["Số lớp: {cartonLayers}", gap, "In: {cartonPrintColors}", gap, "Màu: {cartonColor}"]),
      row("Đai dây:", ["{strapKind}", gap, "{strapNote}"]),
      row("Bao PE:", ["{peBagKind}", gap, "Yêu cầu hàn miệng: {peSealing}", gap, "{peNote}"]),
      row("Ghi trên thùng carton:", ["Mã số lô: {cartonLot}", gap, "{cartonLotNote}"]),
      row("", ["Ngày SX: {cartonMfg}", gap, "Cách ghi: {cartonMfgFormat}", gap, "{cartonMfgNote}"]),
      row("", ["Ngày hết hạn: {cartonExp}", gap, "Cách ghi: {cartonExpFormat}", gap, "{cartonExpNote}"]),
      row("", ["Yêu cầu khác: {cartonOther}"]),
      row("Thông tin trên bao PE hoặc rider:", ["Mã số lô: {bagLot}", gap, "{bagLotNote}"]),
      row("", ["Ngày SX: {bagMfg}", gap, "Cách ghi: {bagMfgFormat}", gap, "{bagMfgNote}"]),
      row("", ["Ngày hết hạn: {bagExp}", gap, "Cách ghi: {bagExpFormat}", gap, "{bagExpNote}"]),
      row("", ["Yêu cầu khác: {bagOther}"]),
      heading("Các yêu cầu về kiểm Nafi:"),
      row("Vi sinh theo quy định:", ["{nafiMicro}", gap, "{nafiMicroNote}"]),
      row("Kháng sinh:", ["{nafiAntibiotic}", gap, "{nafiAntibioticNote}"]),
      row("Kim loại nặng:", ["{nafiHeavyMetal}", gap, "{nafiHeavyMetalNote}"]),
      row("Histamine:", ["{nafiHistamine}", gap, "{nafiHistamineNote}"]),
      row("Khác:", ["{nafiOther}", gap, "Kiểm thêm chỉ tiêu: {nafiExtraTests}"]),
      row("Lấy kết quả vi sinh:", ["{microResult}", gap, "{microResultNote}"]),
    ]),
    para([B("Các lưu ý khác: "), "{notes}"], { before: 80 }),
    para([["QTI-KH-01-04", { sz: 18 }]], { align: "right", before: 360 }),
    // A4 dọc, lề trên/dưới 1,5 cm · trái 2 cm · phải 1,5 cm.
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="1134" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>',
  ];
  return body.join("");
}

/** Khuôn gốc (.docx) — dựng mỗi lần gọi, không có file nhị phân trong repo. */
export const buildProductionOrderTemplate = (): Uint8Array => buildDocx(productionOrderTemplateXml(), { sizeHalfPt: 22, title: "LỆNH SẢN XUẤT" });
