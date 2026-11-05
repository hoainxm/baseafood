// ============================================================
// Tên file: src/lib/documentTypes/exportOrderForm.ts
// Tên tiếng Việt: Loại văn bản "Lệnh xuất hàng" — mẫu QTI-KH-01-07
// Description: Document type #2 of the composer (ba-spec 72 NV1, R1–R7): the form fields of the paper export order,
//              line rows from the issued production orders of a shipment (fallback: the shipment's goods lines),
//              delivery block from the booking (ba-spec 71), Có / Không notes that need detail when "Có".
// ============================================================
import type {
  ComposedDocument,
  DocumentRow,
  DocumentValues,
  ExportContractLine,
  ExportShipment,
  ExportShipmentLine,
  ProductionOrder,
  ProductionOrderLine,
} from "@/types";
import { formatDateTimeVN, formatDateVN, num } from "../format";
import { safeFileName } from "../documents";
import { expiryDate, formatProductionDates, lineCartons, orderLineKg } from "../productionOrder";
import { shipmentKindLabel } from "../exportPlanning";
import { containerQuantityText, linesByContainer, type ContainerView } from "../exportContainers";
import { builtinTemplateId, sumColumn, type DocumentField, type DocumentTypeDef } from "../documentComposer";
import { longDateText } from "./productionOrderForm";

export const EXPORT_ORDER_FORM = "export-order-form";

/** Một dòng hàng của lệnh (R2, R3) — dựng từ LSX hoặc Hàng của chuyến. */
export interface ExportOrderRow {
  productName: string;
  size: string;
  cartons: number | null;
  kg: number | null;
  lotCode: string;
  productionDates: string;
  expiry: string;
  hsCode: string;
  /** Chuyến nhiều cont (ba-spec 73 R5): nhãn cont của dòng, VD "Cont 2 · 20RF". Chuyến một cont ⇒ không có. */
  container?: string;
}

export interface ExportOrderFormSource {
  shipment: ExportShipment;
  /** Loại của mọi cont trên chuyến (ba-spec 73 R7) — bỏ trống ⇒ chỉ cont của chuyến. */
  containerKinds?: readonly string[];
  contractNo: string;
  customerName: string;
  rows: readonly ExportOrderRow[];
}

/**
 * R2, R2b, R3b — dòng Lệnh xuất theo TỪNG HĐ trên chuyến (HĐ chính trước, rồi HĐ khác theo thứ tự Hàng của chuyến):
 *   • HĐ có LSX ĐÃ PHÁT HÀNH gắn chuyến ⇒ 1 dòng / dòng LSX (tên hàng LSX, size + HS theo dòng HĐ, MSL / ngày SX / hạn
 *     theo LSX); số thùng + kg theo Hàng của chuyến cùng dòng HĐ (một LSX gắn được nhiều chuyến). HĐ đã có Hàng của
 *     chuyến mà dòng LSX không có dòng cùng dòng HĐ ⇒ bỏ (không đi chuyến này); HĐ chưa nhập Hàng của chuyến ⇒ số cả
 *     lệnh + cảnh báo. Dòng Hàng của chuyến không thuộc dòng LSX nào ⇒ thêm như HĐ chưa có LSX.
 *   • HĐ chưa có LSX ⇒ Hàng của chuyến (tên, size, hạn dùng), MSL = mã lô chuyến, ngày SX trống.
 */
export function buildExportOrderLines(input: {
  shipment: Pick<ExportShipment, "id" | "lotCode" | "contractId">;
  orders: readonly ProductionOrder[];
  orderLines: readonly ProductionOrderLine[];
  contractLines: readonly ExportContractLine[];
  shipmentLines: readonly ExportShipmentLine[];
  /** Cont của chuyến (ba-spec 73). ≥ 2 cont ⇒ bảng hàng dựng theo từng cont, mỗi dòng mang nhãn cont. */
  containers?: readonly ContainerView[];
}): { rows: ExportOrderRow[]; notices: string[] } {
  const shipLines = input.shipmentLines.filter((l) => l.shipmentId === input.shipment.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const containers = input.containers ?? [];
  if (containers.length < 2) return buildOrderLinesFor(input, shipLines, null);
  const contractOf = (l: ExportShipmentLine) => l.contractId || input.shipment.contractId;
  const rows: ExportOrderRow[] = [];
  const notices: string[] = [];
  const groups = linesByContainer(containers, shipLines);
  // HĐ chưa có dòng nào trên chuyến (chỉ có LSX) ⇒ dựng ở cont 1, như chuyến một cont.
  const withGoods = new Set(shipLines.map(contractOf));
  groups.forEach(({ container, lines }, i) => {
    if (!lines.length && i > 0) return;
    const built = buildOrderLinesFor(input, lines, i === 0 ? null : withGoods);
    const label = `Cont ${container.no} · ${container.kind}`;
    rows.push(...built.rows.map((r) => ({ ...r, container: label })));
    for (const n of built.notices) if (!notices.includes(n)) notices.push(n);
  });
  return { rows, notices };
}

/** Dòng Lệnh xuất cho một nhóm Hàng của chuyến. `onlyWithGoods` ⇒ chỉ xét HĐ có dòng trong nhóm (cont 2…n). */
function buildOrderLinesFor(
  input: Parameters<typeof buildExportOrderLines>[0],
  shipLines: readonly ExportShipmentLine[],
  onlyWithGoods: ReadonlySet<string> | null,
): { rows: ExportOrderRow[]; notices: string[] } {
  const byLine = new Map(input.contractLines.map((l) => [l.id, l]));
  const issued = input.orders.filter((o) => o.status === "issued");
  const contractOf = (l: ExportShipmentLine) => l.contractId || input.shipment.contractId;
  const all = [...new Set([input.shipment.contractId, ...shipLines.map(contractOf), ...issued.map((o) => o.contractId)])];
  const inGroup = new Set(shipLines.map(contractOf));
  // Cont 1 của chuyến nhiều cont: HĐ có hàng ở cont khác mà không có ở cont 1 ⇒ không dựng ở đây.
  const contractIds = onlyWithGoods
    ? all.filter((id) => inGroup.has(id))
    : all.filter((id) => inGroup.has(id) || !(input.containers && input.containers.length > 1 && input.shipmentLines.some((l) => l.shipmentId === input.shipment.id && contractOf(l) === id)));
  const shipCartons = (l: ExportShipmentLine): number | null => {
    const units = l.loadedUnits ?? l.plannedUnits;
    return units == null ? null : l.unitKind === "bundle" ? units * Math.max(1, l.cartonsPerUnit || 1) : units;
  };
  const fromShipLine = (l: ExportShipmentLine): ExportOrderRow => {
    const cartons = shipCartons(l);
    return {
      productName: l.description,
      size: l.size || byLine.get(l.contractLineId)?.size || "",
      cartons,
      kg: cartons != null && l.netKgPerCarton != null ? round2(cartons * l.netKgPerCarton) : null,
      lotCode: input.shipment.lotCode,
      productionDates: "",
      expiry: l.expiry,
      hsCode: byLine.get(l.contractLineId)?.hsCode ?? "",
    };
  };
  const rows: ExportOrderRow[] = [];
  const notices: string[] = [];
  for (const contractId of contractIds) {
    const goods = shipLines.filter((l) => contractOf(l) === contractId);
    const orders = issued.filter((o) => o.contractId === contractId);
    if (!orders.length) {
      rows.push(...goods.map(fromShipLine));
      continue;
    }
    const lsxLines = orders.flatMap((o) =>
      input.orderLines
        .filter((l) => l.orderId === o.id)
        .sort((a, b) => a.lineNo - b.lineNo)
        .map((l) => ({ o, l })),
    );
    const sameLine = (id: string) => lsxLines.filter((x) => x.l.contractLineId === id).length;
    let wholeOrder = false;
    let shared = false;
    for (const { o, l } of lsxLines) {
      const cl = byLine.get(l.contractLineId);
      const exp = expiryDate(o.productionDates, o.shelfLifeMonths);
      let cartons = lineCartons(l);
      let kg: number | null = orderLineKg(l) || null;
      const onShip = goods.filter((g) => g.contractLineId === l.contractLineId);
      if (goods.length && !onShip.length) continue; // dòng LSX này không đi chuyến này (R3b)
      if (sameLine(l.contractLineId) > 1) shared = true;
      else if (onShip.some((g) => shipCartons(g) != null)) {
        const perCarton = cartons && kg ? kg / cartons : null;
        cartons = onShip.reduce((t, g) => t + (shipCartons(g) ?? 0), 0);
        const net = onShip.reduce<number | null>((t, g) => (t == null || g.netKgPerCarton == null ? null : t + (shipCartons(g) ?? 0) * g.netKgPerCarton), 0);
        kg = net ?? (perCarton != null ? round2(cartons * perCarton) : null);
      } else wholeOrder = true;
      rows.push({
        productName: l.productName || l.description,
        size: cl?.size ?? "",
        cartons,
        kg,
        lotCode: o.lotCode,
        productionDates: formatProductionDates(o.productionDates),
        expiry: exp ? formatDateVN(exp) : "",
        hsCode: cl?.hsCode ?? "",
      });
    }
    // Hàng của chuyến không thuộc dòng LSX nào của HĐ ⇒ thêm như HĐ chưa có LSX (R2b).
    rows.push(...goods.filter((g) => !lsxLines.some((x) => x.l.contractLineId === g.contractLineId)).map(fromShipLine));
    const no = orders.map((o) => o.orderNo).join(", ");
    if (wholeOrder) notices.push(`Lệnh sản xuất ${no}: số lượng lấy theo cả lệnh vì chuyến chưa nhập Hàng của chuyến — nhập Hàng của chuyến hoặc sửa tay ở bảng hàng.`);
    if (shared) notices.push(`Lệnh sản xuất ${no}: có dòng hàng hợp đồng nằm ở nhiều dòng lệnh — số lượng giữ theo từng dòng lệnh, kiểm lại số thùng đi chuyến này.`);
  }
  return { rows, notices };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Chỉ dòng hàng của Lệnh xuất (R2, R2b, R3b) — xem `buildExportOrderLines`. */
export const buildExportOrderRows = (input: Parameters<typeof buildExportOrderLines>[0]): ExportOrderRow[] => buildExportOrderLines(input).rows;

const G = { head: "Đầu lệnh", lines: "Bảng hàng", delivery: "Thông tin giao hàng", loading: "Các lưu ý khi đóng hàng", docs: "Các yêu cầu về chứng từ" } as const;
const YES_NO = ["Không", "Có"] as const;

/** Một mục Có / Không + ô ghi rõ (bắt buộc khi Có — R5). Nhớ theo lần lập trước của cùng khách. */
const yesNo = (key: string, label: string, group: string): DocumentField[] => [
  { key, label, group, kind: "choice", options: YES_NO, defaultValue: "Không", carryOver: true },
  { key: `${key}Note`, label: `${label} — ghi rõ`, group, kind: "text", carryOver: true, requiredWhen: (v) => v[key] === "Có" },
];

/** Ô Lệnh xuất theo thứ tự mẫu QTI-KH-01-07 (R1–R5). */
export const EXPORT_ORDER_FIELDS: readonly DocumentField[] = [
  // Định dạng số lệnh (chị Thảo 2026-11-04): STT/tháng-năm — lệnh số 01 tháng 10/2026 ghi "01/10-26".
  { key: "orderNo", label: "Số (STT/tháng-năm, VD 01/10-26)", group: G.head, kind: "text", required: true, carryOver: false },
  { key: "orderDate", label: "Ngày lệnh", group: G.head, kind: "date", required: true, mapped: true },
  // Khóa tiếng Anh (quy tắc 8; trước 2026-11-05 là toDong / toCa / toKho — DB thật chỉ 1 lệnh đã lưu, cả 3 ô false).
  { key: "workshopFrozen", label: "Phân xưởng Đông", group: G.head, kind: "check", defaultValue: false, carryOver: true },
  { key: "workshopFish", label: "Phân xưởng Cá", group: G.head, kind: "check", defaultValue: false, carryOver: true },
  { key: "workshopDried", label: "Phân xưởng Khô", group: G.head, kind: "check", defaultValue: false, carryOver: true },
  {
    key: "lines",
    label: "Bảng hàng",
    group: G.lines,
    kind: "table",
    required: true,
    mapped: true,
    columns: [
      { key: "productName", label: "Tên hàng", kind: "text", required: true },
      { key: "size", label: "Size", kind: "text" },
      { key: "cartons", label: "Số thùng", kind: "number", required: true },
      { key: "kg", label: "Số kg", kind: "number", required: true },
      { key: "lotCode", label: "MSL", kind: "text" },
      { key: "productionDates", label: "Ngày sản xuất", kind: "text" },
      { key: "expiry", label: "Ngày hết hạn", kind: "text" },
      { key: "hsCode", label: "Hs code", kind: "text" },
    ],
  },
  { key: "containers", label: "Số lượng x Loại container", group: G.delivery, kind: "text", mapped: true },
  { key: "loadingDate", label: "Ngày đóng hàng", group: G.delivery, kind: "date", mapped: true },
  { key: "docCutoff", label: "Doc cut-off", group: G.delivery, kind: "text", mapped: true },
  { key: "vgmCutoff", label: "VGM cut off", group: G.delivery, kind: "text", mapped: true },
  { key: "dischargePort", label: "Cảng hạ", group: G.delivery, kind: "text", mapped: true },
  { key: "cargoCutoff", label: "Thời hạn hạ bãi", group: G.delivery, kind: "text", mapped: true },
  { key: "etd", label: "ETD", group: G.delivery, kind: "text", mapped: true },
  { key: "eta", label: "ETA", group: G.delivery, kind: "text", mapped: true },
  ...yesNo("bySize", "Đóng hàng theo size", G.loading),
  ...yesNo("byProductionDate", "Đóng hàng theo ngày sản xuất", G.loading),
  ...yesNo("samples", "Hàng mẫu", G.loading),
  ...yesNo("microTest", "Yêu cầu kết quả kiểm tra vi sinh", G.docs),
  ...yesNo("chemicalTest", "Yêu cầu kết quả kiểm tra hóa học", G.docs),
  ...yesNo("otherRequest", "Yêu cầu khác", G.docs),
];

const CONTAINER_TEXT: Partial<Record<ExportShipment["kind"], string>> = { "20RF": "20RF", "40RF": "40RF", "40HC-RF": "40HC-RF" };

/** Ô có ánh xạ (R2–R4): dòng hàng + thông tin giao hàng theo chuyến / booking lúc soạn. */
export function exportOrderSourceValues({ shipment: s, rows, containerKinds }: ExportOrderFormSource, today = ""): DocumentValues {
  const b = s.booking;
  const lines: DocumentRow[] = rows.map((r) => ({ ...r }));
  return {
    orderDate: today,
    lines,
    // ba-spec 73 R7: chuyến nhiều cont ⇒ "1 x 40HC-RF + 1 x 20RF".
    containers: containerKinds && containerKinds.length > 1 ? containerQuantityText(containerKinds) : CONTAINER_TEXT[s.kind] ? `1 x ${CONTAINER_TEXT[s.kind]}` : shipmentKindLabel(s.kind),
    loadingDate: s.loadingDate,
    docCutoff: b?.docCutoff ? formatDateTimeVN(b.docCutoff) : "",
    vgmCutoff: b?.vgmCutoff ? formatDateTimeVN(b.vgmCutoff) : "",
    dischargePort: s.portOfDischarge,
    cargoCutoff: b?.cargoCutoff ? formatDateTimeVN(b.cargoCutoff) : "",
    etd: s.etd ? formatDateVN(s.etd) : "",
    eta: s.eta ? formatDateVN(s.eta) : "",
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numText = (v: unknown): string => (typeof v === "number" ? num(v) : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? num(Number(v)) : str(v));
const dots = (v: string) => v || "…";
const answer = (values: DocumentValues, key: string) => (values[key] === "Có" ? `Có: ${str(values[`${key}Note`])}` : "Không");

/** "PHÂN XƯỞNG ĐÔNG, CÁ" — chưa chọn xưởng nào ⇒ "PHÂN XƯỞNG ……" (R1). */
export function workshopLine(values: DocumentValues): string {
  const ws = [values.workshopFrozen === true && "ĐÔNG", values.workshopFish === true && "CÁ", values.workshopDried === true && "KHÔ"].filter(Boolean);
  return `PHÂN XƯỞNG ${ws.length ? ws.join(", ") : "……"}`;
}

/** Dữ liệu điền khuôn: ngày dài, số định dạng vi-VN, STT, dòng Tổng cộng, lưu ý "Có: …" / "Không". */
export function exportOrderTemplateData(values: DocumentValues): Record<string, unknown> {
  const rows = (values.lines as DocumentRow[] | undefined) ?? [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (typeof v === "string") out[k] = v;
  return {
    ...out,
    orderDate: longDateText(str(values.orderDate)),
    workshops: workshopLine(values),
    loadingDate: dots(values.loadingDate ? formatDateVN(str(values.loadingDate)) : ""),
    ...Object.fromEntries(["containers", "docCutoff", "vgmCutoff", "dischargePort", "cargoCutoff", "etd", "eta"].map((k) => [k, dots(str(values[k]))])),
    lines: rows.map((r, i) => ({
      stt: String(i + 1),
      // ba-spec 73 R5: chuyến nhiều cont ⇒ tên hàng mở đầu bằng nhãn cont của dòng.
      productName: str(r.container) ? `[${str(r.container)}] ${str(r.productName)}` : str(r.productName),
      size: str(r.size),
      quantity: [numText(r.cartons) && `${numText(r.cartons)} thùng`, numText(r.kg) && `${numText(r.kg)} kg`].filter(Boolean).join(" / "),
      lotCode: str(r.lotCode),
      productionDates: str(r.productionDates),
      expiry: str(r.expiry),
      hsCode: str(r.hsCode),
    })),
    totalQuantity: `${num(sumColumn(rows, "cartons"))} thùng / ${num(sumColumn(rows, "kg"))} kg`,
    bySize: answer(values, "bySize"),
    byProductionDate: answer(values, "byProductionDate"),
    samples: answer(values, "samples"),
    microTest: answer(values, "microTest"),
    chemicalTest: answer(values, "chemicalTest"),
    otherRequest: answer(values, "otherRequest"),
  };
}

const LINE_TAGS = ["lines", "lines.productName", "lines.quantity"];
const ANSWER_KEYS = ["bySize", "byProductionDate", "samples", "microTest", "chemicalTest", "otherRequest"];

export const exportOrderForm: DocumentTypeDef<ExportOrderFormSource> = {
  key: EXPORT_ORDER_FORM,
  name: "Lệnh xuất hàng",
  formCode: "QTI-KH-01-07",
  sourceType: "export-shipment",
  resource: "export-plans",
  labels: {
    source: "Từ chuyến",
    differs: "Khác chuyến",
    stale: "Chuyến đã sửa sau khi soạn",
    sourceCancelled: "Chuyến đã hủy",
    previous: (ref) => `Từ lệnh xuất ${ref}`,
  },
  fields: EXPORT_ORDER_FIELDS,
  templateTags: {
    required: ["orderNo", "orderDate", ...LINE_TAGS].sort(),
    optional: [
      "workshops",
      "lines.stt",
      "lines.size",
      "lines.lotCode",
      "lines.productionDates",
      "lines.expiry",
      "lines.hsCode",
      "totalQuantity",
      "containers",
      "loadingDate",
      "docCutoff",
      "vgmCutoff",
      "dischargePort",
      "cargoCutoff",
      "etd",
      "eta",
      ...ANSWER_KEYS,
    ].sort(),
  },
  sourceValues: (src) => exportOrderSourceValues(src, new Date().toISOString().slice(0, 10)),
  templateData: exportOrderTemplateData,
  fileName: (v) => safeFileName(`Lenh-xuat-${str(v.orderNo) || "chua-so"}-${str(v.orderDate).replace(/-/g, "")}.docx`),
  builtinTemplateId: builtinTemplateId(EXPORT_ORDER_FORM),
};

/** Khóa "lần trước" (R1 xưởng + R5 lưu ý nhớ theo lần trước): cùng khách, không xét mặt hàng. */
export const exportOrderPreviousKey = (src: ExportOrderFormSource) => ({ customerKey: src.customerName.trim(), productId: "" });

/** Bản soạn mới của một chuyến. */
export function newExportOrderDocument(
  src: ExportOrderFormSource,
  state: { values: DocumentValues; fieldSources: ComposedDocument["fieldSources"] },
  meta: { id: string; by: string; at: string },
): ComposedDocument {
  return {
    id: meta.id,
    docType: EXPORT_ORDER_FORM,
    sourceType: exportOrderForm.sourceType,
    sourceId: src.shipment.id,
    sourceRef: [src.contractNo, src.shipment.lotCode && `lô ${src.shipment.lotCode}`].filter(Boolean).join(" · "),
    resource: exportOrderForm.resource,
    values: state.values,
    fieldSources: state.fieldSources,
    sourceRevisionNo: 0,
    customerKey: src.customerName.trim(),
    productIds: [],
    createdBy: meta.by,
    createdAt: meta.at,
    updatedBy: meta.by,
    updatedAt: meta.at,
  };
}

/** R5: mục chọn "Có" mà chưa ghi rõ — nhãn để báo. */
export function exportOrderMissingDetails(values: DocumentValues): string[] {
  return EXPORT_ORDER_FIELDS.filter((f) => f.requiredWhen?.(values) && !str(values[f.key]).trim()).map((f) => f.label.replace(/ — ghi rõ$/, ""));
}
