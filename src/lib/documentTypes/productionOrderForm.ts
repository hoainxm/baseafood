// ============================================================
// Tên file: src/lib/documentTypes/productionOrderForm.ts
// Tên tiếng Việt: Loại văn bản "File Lệnh sản xuất" — mẫu QTI-KH-01-04
// Description: Document type #1 of the composer (ba-spec 54 §9a): the 42 form fields of paper LSX 19.10 with
//              defaults, mapping from a production order (R2, R7), template data + file name, the "same customer +
//              product" key for previous exports, and the compose gate for cancelled orders (R11).
// ============================================================
import type { ComposedDocument, ComposedDocumentExport, DocumentRow, DocumentValues, ProductionOrder, ProductionOrderLine } from "@/types";
import { formatDateVN, num } from "../format";
import { safeFileName } from "../documents";
import { formatProductionDates, lineCartons, orderLineKg } from "../productionOrder";
import { builtinTemplateId, makeExport, prefill, sumColumn, type DocumentField, type DocumentTypeDef } from "../documentComposer";

export const PRODUCTION_ORDER_FORM = "production-order-form";

export interface ProductionOrderFormSource {
  order: ProductionOrder;
  /** Dòng của chính lệnh này, theo thứ tự. */
  lines: readonly ProductionOrderLine[];
}

const YES_NO = ["Có", "Không"] as const;
const DATE_FORMATS = ["dd/mm/yyyy", "yyyy/mm/dd", "Không cần ghi"] as const;
const EXPIRY_FORMATS = ["dd/mm/yyyy", "yyyy/mm/dd", "Không cần ghi", "MM/YYYY", "YYYY/MM"] as const;
export const PACKAGING_READY_OPTIONS = ["ĐÃ CÓ SẴN", "CHƯA CÓ"] as const;

const G = {
  head: "Đầu lệnh",
  lines: "Bảng hàng",
  delivery: "Giao hàng",
  carton: "Thùng carton",
  strap: "Đai dây",
  pe: "Bao PE",
  cartonMark: "Ghi trên thùng carton",
  bagMark: "Thông tin trên bao PE hoặc rider",
  nafi: "Các yêu cầu về kiểm Nafi",
  end: "Cuối lệnh",
} as const;

/** Ô chữ chép từ lần trước (yêu cầu bao bì / Nafi lặp theo khách + mặt hàng). */
const keep = (key: string, label: string, group: string, defaultValue = ""): DocumentField => ({ key, label, group, kind: "text", carryOver: true, defaultValue });
const pick = (key: string, label: string, group: string, options: readonly string[], defaultValue: string, mapped = false): DocumentField => ({
  key,
  label,
  group,
  kind: "choice",
  options,
  defaultValue,
  carryOver: true,
  mapped,
});

/** §9a — thứ tự = thứ tự trên mẫu (R5 kê ô thiếu theo thứ tự này). Mặc định = giá trị trên LSX 19.10. */
export const PRODUCTION_ORDER_FIELDS: readonly DocumentField[] = [
  { key: "orderNo", label: "Số", group: G.head, kind: "text", required: true, mapped: true },
  { key: "orderDate", label: "Ngày lệnh", group: G.head, kind: "date", required: true, mapped: true },
  { key: "recipients", label: "Kính gởi", group: G.head, kind: "text", defaultValue: "BQĐ PHÂN XƯỞNG, PHÒNG KỸ THUẬT, PHÒNG KẾ HOẠCH" },
  {
    key: "lines",
    label: "Bảng hàng",
    group: G.lines,
    kind: "table",
    required: true,
    mapped: true,
    columns: [
      { key: "productName", label: "Tên hàng", kind: "text", required: true },
      { key: "spec", label: "Quy cách", kind: "multiline" },
      { key: "cartons", label: "Số lượng thùng", kind: "number", required: true },
      { key: "kg", label: "Số lượng (kg)", kind: "number", required: true },
    ],
  },
  { key: "lotCode", label: "Mã số lô", group: G.lines, kind: "text", mapped: true },
  { key: "productionDates", label: "Ngày SX", group: G.lines, kind: "text", mapped: true },
  { key: "packagingReady", label: "Dự kiến có bao bì", group: G.delivery, kind: "choice", options: PACKAGING_READY_OPTIONS, mapped: true },
  { key: "deliveryDate", label: "Ngày giao hàng", group: G.delivery, kind: "date", required: true, mapped: true },
  { key: "market", label: "Xuất vào thị trường", group: G.delivery, kind: "text", required: true, mapped: true },
  { key: "shelfLife", label: "Ngày hết hạn", group: G.delivery, kind: "text", mapped: true },
  { ...keep("process", "Quy trình sản xuất", G.delivery, "Theo quy trình SX của Phòng Kỹ thuật."), mapped: true },
  { ...keep("cartonLayers", "Số lớp", G.carton, "5 lớp"), mapped: true },
  pick("cartonPrintColors", "In", G.carton, ["mấy màu", "1", "2", "3"], "1"),
  keep("cartonColor", "Màu", G.carton),
  pick("strapKind", "Đai dây", G.strap, ["Bình thường", "Chỉ Dùng băng keo"], "Bình thường"),
  { ...keep("strapNote", "Ghi chú đai dây", G.strap, "Mỗi NSX đai màu dây khác nhau."), mapped: true },
  pick("peBagKind", "Bao PE", G.pe, ["Trắng không in", "In sẵn", "Có rider"], "Trắng không in"),
  pick("peSealing", "Yêu cầu hàn miệng", G.pe, ["Không", "Có"], "Không"),
  { ...keep("peNote", "Ghi chú bao PE", G.pe), mapped: true },
  pick("cartonLot", "Mã số lô", G.cartonMark, YES_NO, "Có"),
  keep("cartonLotNote", "Ghi chú mã số lô", G.cartonMark),
  pick("cartonMfg", "Ngày SX", G.cartonMark, YES_NO, "Có"),
  pick("cartonMfgFormat", "Cách ghi ngày SX", G.cartonMark, DATE_FORMATS, "yyyy/mm/dd"),
  keep("cartonMfgNote", "Ghi chú ngày SX", G.cartonMark),
  pick("cartonExp", "Ngày hết hạn", G.cartonMark, YES_NO, "Có"),
  pick("cartonExpFormat", "Cách ghi ngày hết hạn", G.cartonMark, EXPIRY_FORMATS, "yyyy/mm/dd"),
  keep("cartonExpNote", "Ghi chú ngày hết hạn", G.cartonMark),
  { ...keep("cartonOther", "Yêu cầu khác", G.cartonMark, "Không"), mapped: true },
  pick("bagLot", "Mã số lô", G.bagMark, YES_NO, "Không"),
  keep("bagLotNote", "Ghi chú mã số lô", G.bagMark),
  pick("bagMfg", "Ngày SX", G.bagMark, YES_NO, "Không"),
  pick("bagMfgFormat", "Cách ghi ngày SX", G.bagMark, DATE_FORMATS, "Không cần ghi"),
  keep("bagMfgNote", "Ghi chú ngày SX", G.bagMark),
  pick("bagExp", "Ngày hết hạn", G.bagMark, YES_NO, "Không"),
  pick("bagExpFormat", "Cách ghi ngày hết hạn", G.bagMark, EXPIRY_FORMATS, "Không cần ghi"),
  keep("bagExpNote", "Ghi chú ngày hết hạn", G.bagMark),
  { ...keep("bagOther", "Yêu cầu khác", G.bagMark, "Không"), mapped: true },
  { key: "nafiMicro", label: "Vi sinh theo quy định", group: G.nafi, kind: "check", mapped: true, carryOver: true, defaultValue: false },
  keep("nafiMicroNote", "Ghi chú vi sinh", G.nafi),
  pick("nafiAntibiotic", "Kháng sinh", G.nafi, YES_NO, "Không", true),
  keep("nafiAntibioticNote", "Ghi chú kháng sinh", G.nafi),
  pick("nafiHeavyMetal", "Kim loại nặng", G.nafi, YES_NO, "Không", true),
  keep("nafiHeavyMetalNote", "Ghi chú kim loại nặng", G.nafi),
  pick("nafiHistamine", "Histamine", G.nafi, YES_NO, "Không", true),
  keep("nafiHistamineNote", "Ghi chú histamine", G.nafi),
  pick("nafiOther", "Khác", G.nafi, YES_NO, "Không", true),
  { ...keep("nafiExtraTests", "Kiểm thêm chỉ tiêu", G.nafi), mapped: true },
  pick("microResult", "Lấy kết quả vi sinh", G.nafi, YES_NO, "Không"),
  keep("microResultNote", "Ghi chú lấy kết quả vi sinh", G.nafi),
  { key: "notes", label: "Các lưu ý khác", group: G.end, kind: "multiline", mapped: true, carryOver: true },
];

/** Hạn dùng như mẫu: tròn năm "2 năm", lẻ "18 tháng" (R7). */
export const shelfLifeText = (months: number): string => (!months ? "" : months % 12 === 0 ? `${months / 12} năm` : `${months} tháng`);

/** "Ngày 27 Tháng 10 Năm 2026" (R7). */
export const longDateText = (iso: string): string => (iso ? `Ngày ${Number(iso.slice(8, 10))} Tháng ${Number(iso.slice(5, 7))} Năm ${iso.slice(0, 4)}` : "");

const PACKAGING_READY: Record<ProductionOrder["requirements"]["packagingReady"], string> = { ready: "ĐÃ CÓ SẴN", pending: "CHƯA CÓ", "": "" };
const yesNo = (b: boolean) => (b ? "Có" : "Không");

/** R2 bước 1 — giá trị các ô có ánh xạ từ lệnh. */
export function productionOrderSourceValues({ order, lines }: ProductionOrderFormSource): DocumentValues {
  const r = order.requirements;
  const nafi = new Set(r.nafiTests);
  const rows: DocumentRow[] = lines.map((l) => ({
    productName: l.productName || l.description,
    spec: [l.spec.trim(), l.note.trim()].filter(Boolean).join("\n"),
    cartons: lineCartons(l),
    kg: orderLineKg(l),
  }));
  const dates = formatProductionDates(order.productionDates);
  return {
    orderNo: order.orderNo,
    orderDate: order.orderDate,
    lines: rows,
    lotCode: order.lotCode,
    productionDates: dates ? `NSX: ${dates}` : "",
    packagingReady: PACKAGING_READY[r.packagingReady] ?? "",
    deliveryDate: order.deliveryDate,
    market: [order.market.trim(), order.customerName.trim() && `(${order.customerName.trim()})`].filter(Boolean).join(" "),
    shelfLife: shelfLifeText(order.shelfLifeMonths),
    process: r.processNote,
    cartonLayers: r.cartonLayers,
    strapNote: r.strapNote,
    peNote: r.peBagNote,
    cartonOther: r.cartonMarking,
    bagOther: r.bagMarking,
    nafiMicro: nafi.has("Vi sinh"),
    nafiAntibiotic: yesNo(nafi.has("Kháng sinh")),
    nafiHeavyMetal: yesNo(nafi.has("Kim loại nặng")),
    nafiHistamine: yesNo(nafi.has("Histamine")),
    nafiOther: yesNo(nafi.has("Khác")),
    nafiExtraTests: r.nafiNote,
    notes: order.note,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numText = (v: unknown): string => (typeof v === "number" ? num(v) : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? num(Number(v)) : str(v));

/** Dữ liệu điền khuôn: ngày, số, dòng Tổng, STT; mã lô + ngày SX chỉ ở dòng đầu (ô gộp của mẫu). */
export function productionOrderTemplateData(values: DocumentValues): Record<string, unknown> {
  const rows = (values.lines as DocumentRow[] | undefined) ?? [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (typeof v === "string") out[k] = v;
  const colors = str(values.cartonPrintColors);
  return {
    ...out,
    orderDate: longDateText(str(values.orderDate)),
    deliveryDate: values.deliveryDate ? formatDateVN(str(values.deliveryDate)) : "",
    cartonPrintColors: /^\d+$/.test(colors) ? `${colors} màu` : colors,
    nafiMicro: values.nafiMicro === true ? "☒" : "☐",
    lines: rows.map((r, i) => ({
      stt: String(i + 1),
      productName: str(r.productName),
      spec: str(r.spec),
      cartons: numText(r.cartons),
      kg: numText(r.kg),
      lotCode: i === 0 ? str(values.lotCode) : "",
      productionDates: i === 0 ? str(values.productionDates) : "",
    })),
    totalCartons: num(sumColumn(rows, "cartons")),
    totalKg: num(sumColumn(rows, "kg")),
  };
}

const LINE_TAGS = ["lines", "lines.productName", "lines.cartons", "lines.kg"];

export const productionOrderForm: DocumentTypeDef<ProductionOrderFormSource> = {
  key: PRODUCTION_ORDER_FORM,
  name: "File Lệnh sản xuất",
  formCode: "QTI-KH-01-04",
  sourceType: "production-order",
  resource: "production-orders",
  labels: {
    source: "Từ lệnh",
    differs: "Khác lệnh",
    stale: "Lệnh đã sửa sau khi soạn",
    sourceCancelled: "Lệnh đã hủy",
    previous: (ref) => `Từ file LSX ${ref}`,
  },
  fields: PRODUCTION_ORDER_FIELDS,
  templateTags: {
    required: ["orderNo", "orderDate", ...LINE_TAGS, "deliveryDate", "market"].sort(),
    optional: [
      ...PRODUCTION_ORDER_FIELDS.filter((f) => !["orderNo", "orderDate", "lines", "lotCode", "productionDates", "deliveryDate", "market"].includes(f.key)).map((f) => f.key),
      "lines.stt",
      "lines.spec",
      "lines.lotCode",
      "lines.productionDates",
      "totalCartons",
      "totalKg",
    ].sort(),
  },
  sourceValues: productionOrderSourceValues,
  templateData: productionOrderTemplateData,
  fileName: (v) => {
    const customer = str(v.market).match(/\(([^)]+)\)/)?.[1] ?? str(v.market);
    return safeFileName(`LSX-${str(v.orderNo)}-${customer}-${str(v.orderDate).replace(/-/g, "")}.docx`);
  },
  builtinTemplateId: builtinTemplateId(PRODUCTION_ORDER_FORM),
};

/** R11: lệnh đã hủy ⇒ không soạn mới. */
export function canComposeFromOrder(order: Pick<ProductionOrder, "status">): { ok: true } | { ok: false; reason: "cancelled" } {
  return order.status === "cancelled" ? { ok: false, reason: "cancelled" } : { ok: true };
}

/** Khóa tìm "lần trước" (R2, A4): khách của lệnh + mặt hàng dòng 1; lưu kèm bản soạn mọi mặt hàng của lệnh. */
export function previousKeyOf({ order, lines }: ProductionOrderFormSource): { customerKey: string; productId: string; productIds: string[] } {
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  return { customerKey: order.customerName.trim(), productId: lines[0]?.productId ?? "", productIds };
}

/** Bản soạn mới (chưa lưu) của một lệnh — dùng ở bộ soạn và bộ demo. */
export function newComposedDocument(
  src: ProductionOrderFormSource,
  state: { values: DocumentValues; fieldSources: ComposedDocument["fieldSources"] },
  meta: { id: string; by: string; at: string },
): ComposedDocument {
  const k = previousKeyOf(src);
  return {
    id: meta.id,
    docType: PRODUCTION_ORDER_FORM,
    sourceType: productionOrderForm.sourceType,
    sourceId: src.order.id,
    sourceRef: src.order.orderNo,
    resource: productionOrderForm.resource,
    values: state.values,
    fieldSources: state.fieldSources,
    sourceRevisionNo: src.order.revisionNo,
    customerKey: k.customerKey,
    productIds: k.productIds,
    createdBy: meta.by,
    createdAt: meta.at,
    updatedBy: meta.by,
    updatedAt: meta.at,
  };
}

/** Bộ demo (QT 15): lệnh đã phát hành đầu tiên có 1 bản soạn đã xuất Word 1 lần — trình diễn "lần trước" + tải lại. */
export function buildProductionOrderFormDemo(
  orders: readonly ProductionOrder[],
  lines: readonly ProductionOrderLine[],
  at: string,
): { documents: ComposedDocument[]; exports: ComposedDocumentExport[] } {
  const order = orders.find((o) => o.status === "issued");
  if (!order) return { documents: [], exports: [] };
  const src = { order, lines: lines.filter((l) => l.orderId === order.id).sort((a, b) => a.lineNo - b.lineNo) };
  const st = prefill(productionOrderForm, src, null);
  const doc = newComposedDocument(src, { values: st.values, fieldSources: st.sources }, { id: `doc-${order.id}`, by: "Phòng Kế hoạch", at });
  return { documents: [doc], exports: [makeExport(doc, "docx", productionOrderForm.builtinTemplateId, "Phòng Kế hoạch", at, `doc-export-${order.id}`)] };
}
