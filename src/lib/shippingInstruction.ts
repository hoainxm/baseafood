// ============================================================
// Tên file: src/lib/shippingInstruction.ts
// Tên tiếng Việt: Shipping Instruction (SI) của chuyến xuất — luật thuần
// Description: ba-spec 72 NV3 (R10–R13): build the SI of a shipment from booking (ba-spec 71), company profile, the
//              customer, shipment goods lines (+ contract lines for HS code); carry customer-level choices from the
//              latest SI of the same customer; store as a composed document (mig 0091, doc_type shipping-instruction).
// ============================================================
import type { ComposedDocument, CompanyProfile, DocumentRow, DocumentValues, ExportContractLine, ExportParty, ExportShipment, ExportShipmentLine } from "@/types";
import { linesByContainer, type ContainerView } from "./exportContainers";

export const SHIPPING_INSTRUCTION_DOC = "shipping-instruction";

export const BL_TYPES = ["MASTER BL", "HOUSE BL"] as const;
export const BL_RELEASES = ["ORIGINAL", "SURRENDER", "SEAWAY"] as const;
export const PAYMENT_TERMS = ["PREPAID", "COLLECT", "3rd COUNTRY"] as const;

/** Một dòng hàng của SI (dòng 33–36 của mẫu): số kiện + gross sửa được. */
export interface SiGoodsRow {
  /** Dòng HĐ của dòng hàng — khóa giữ số kiện / gross đã sửa khi dựng lại dòng (R11, v1.5). "" = dòng thêm tay. */
  contractLineId?: string;
  description: string;
  hsCode: string;
  packages: number | null;
  grossKg: number | null;
}

/** Ô người dùng điền / chọn — nhớ theo SI gần nhất của cùng khách (R12). */
export interface SiCustomerFields {
  attn: string;
  customerContact: string;
  blType: string;
  blRelease: string;
  consignee: string;
  otherRequests: string;
  notifyParty: string;
  alsoNotifyParty: string;
  shippingMarks: string;
  payment: string;
  paymentPlace: string;
}

/** Nội dung SI lưu lại (ô nhớ theo khách + ngày + hàng + CBM). Ô theo booking / cont luôn đọc lại từ chuyến. */
export interface SiForm extends SiCustomerFields {
  date: string;
  cbm: string;
  goods: SiGoodsRow[];
}

/** Ô theo chuyến — chỉ xem ở hộp SI, lấy lúc xuất file (R11). */
export interface SiLinked {
  shipper: string[];
  bookingNo: string;
  vessel: string;
  voyage: string;
  placeOfReceipt: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  containerNo: string;
  sealNo: string;
  sizeType: string;
  /** Chuyến nhiều cont (ba-spec 73 R9): mỗi cont một dòng — số, seal, loại, số kiện, gross. Một cont ⇒ không có. */
  containers?: SiContainerRow[];
}

/** Một cont trên SI (ba-spec 73 R9). */
export interface SiContainerRow {
  containerNo: string;
  sealNo: string;
  sizeType: string;
  packages: number | null;
  grossKg: number | null;
}

/**
 * Dòng cont của SI: số kiện = Σ (thực đóng ?? kế hoạch) của dòng trong cont; gross = Σ kiện × kg cả bì (thiếu kg cả bì
 * ở một dòng ⇒ gross của cont trống, gõ tay trên file).
 */
export function siContainerRows(conts: readonly ContainerView[], lines: readonly ExportShipmentLine[]): SiContainerRow[] {
  return linesByContainer(conts, lines).map(({ container: c, lines: ls }) => {
    let packages: number | null = ls.length ? 0 : null;
    let gross: number | null = ls.length ? 0 : null;
    for (const l of ls) {
      const n = l.loadedUnits ?? l.plannedUnits;
      if (packages != null) packages = n == null ? packages : packages + n;
      gross = gross == null || n == null || l.grossKgPerUnit == null ? null : gross + n * l.grossKgPerUnit;
    }
    return { containerNo: c.containerNo, sealNo: c.sealNo, sizeType: SIZE_TYPE[c.kind] ?? c.kind, packages, grossKg: gross == null ? null : Math.round(gross * 100) / 100 };
  });
}

export const SI_CARRY_KEYS: readonly (keyof SiCustomerFields)[] = [
  "attn",
  "customerContact",
  "blType",
  "blRelease",
  "consignee",
  "otherRequests",
  "notifyParty",
  "alsoNotifyParty",
  "shippingMarks",
  "payment",
  "paymentPlace",
];

/** "BANGKOK BRIDGE 0518E(JTI)" ⇒ tàu "BANGKOK BRIDGE" · chuyến "0518E(JTI)" (tách ở khoảng trắng cuối). Một từ ⇒ chỉ tàu. */
export function splitVesselVoyage(v: string): { vessel: string; voyage: string } {
  const t = v.trim().replace(/\s+/g, " ");
  const i = t.lastIndexOf(" ");
  if (i < 0) return { vessel: t, voyage: "" };
  const voyage = t.slice(i + 1);
  // Chuyến thường có chữ số; từ cuối không có số (VD "EVER GIVEN") ⇒ cả chuỗi là tên tàu.
  return /\d/.test(voyage) ? { vessel: t.slice(0, i), voyage } : { vessel: t, voyage: "" };
}

const SIZE_TYPE: Partial<Record<ExportShipment["kind"], string>> = { "20RF": "20' RF", "40RF": "40' RF", "40HC-RF": "40' HC RF" };

/** Shipper: tên + địa chỉ tiếng Anh, địa chỉ bẻ 2 dòng ở dấu phẩy gần giữa (ô A5, A6 của mẫu). */
export function shipperLines(c: Pick<CompanyProfile, "nameEn" | "addressEn">): string[] {
  const addr = c.addressEn.trim();
  if (addr.length <= 45) return [c.nameEn.trim(), addr].filter(Boolean);
  const commas = [...addr.matchAll(/,/g)].map((m) => m.index ?? 0);
  const cut = commas.length ? commas.reduce((best, i) => (Math.abs(i - addr.length / 2) < Math.abs(best - addr.length / 2) ? i : best)) : -1;
  return [c.nameEn.trim(), ...(cut > 0 ? [addr.slice(0, cut + 1).trim(), addr.slice(cut + 1).trim()] : [addr])].filter(Boolean);
}

export function siLinked(
  s: ExportShipment,
  company: Pick<CompanyProfile, "nameEn" | "addressEn">,
  /** Cont của chuyến + Hàng của chuyến (ba-spec 73) — ≥ 2 cont ⇒ `containers`. */
  multi?: { containers: readonly ContainerView[]; lines: readonly ExportShipmentLine[] },
): SiLinked {
  const b = s.booking;
  const vv = splitVesselVoyage(s.vesselVoyage);
  return {
    shipper: shipperLines(company),
    bookingNo: s.bookingNo,
    vessel: vv.vessel,
    voyage: vv.voyage,
    placeOfReceipt: b?.placeOfReceipt ?? "",
    portOfLoading: b?.portOfLoading ?? "",
    portOfDischarge: s.portOfDischarge,
    placeOfDelivery: b?.placeOfDelivery ?? "",
    containerNo: s.containerNo,
    sealNo: s.sealNo,
    sizeType: SIZE_TYPE[s.kind] ?? s.kind,
    ...(multi && multi.containers.length > 1 ? { containers: siContainerRows(multi.containers, multi.lines.filter((l) => l.shipmentId === s.id)) } : {}),
  };
}

/**
 * Dòng hàng SI (R11): mỗi dòng Hàng của chuyến ⇒ tên tiếng Anh + HS của dòng HĐ; số kiện = thực đóng (chưa có ⇒ kế
 * hoạch); gross = kg cả bì mỗi kiện × số kiện. Thiếu kg cả bì ⇒ gross trống + cảnh báo đúng dòng.
 */
export function siGoodsRows(
  shipmentId: string,
  lines: readonly ExportShipmentLine[],
  contractLines: readonly ExportContractLine[],
): { rows: SiGoodsRow[]; warnings: string[] } {
  const byId = new Map(contractLines.map((l) => [l.id, l]));
  const warnings: string[] = [];
  const rows = lines
    .filter((l) => l.shipmentId === shipmentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l, i) => {
      const packages = l.loadedUnits ?? l.plannedUnits;
      const gross = packages != null && l.grossKgPerUnit != null ? Math.round(packages * l.grossKgPerUnit * 100) / 100 : null;
      if (gross == null) warnings.push(`Dòng ${i + 1} (${l.description || "chưa có tên"}): thiếu kg cả bì hoặc số kiện — gõ gross tay.`);
      // Tên + HS lấy theo dòng HĐ HIỆN TẠI (mẫu SI: "link từ hợp đồng") — sửa tên ở HĐ thì SI theo (v1.5).
      const cl = byId.get(l.contractLineId);
      return { contractLineId: l.contractLineId, description: cl?.description?.trim() || l.description, hsCode: cl?.hsCode ?? "", packages, grossKg: gross };
    });
  return { rows, warnings };
}

export const EMPTY_SI_CUSTOMER: SiCustomerFields = {
  attn: "",
  customerContact: "",
  blType: "MASTER BL",
  blRelease: "ORIGINAL",
  consignee: "",
  otherRequests: "",
  notifyParty: "",
  alsoNotifyParty: "",
  shippingMarks: "",
  payment: "PREPAID",
  paymentPlace: "",
};

/** SI gần nhất của cùng khách (R12), không tính chuyến đang lập. */
export function previousSiOf(docs: readonly ComposedDocument[], customerKey: string, excludeShipmentId: string): ComposedDocument | null {
  const k = customerKey.trim().toLowerCase();
  if (!k) return null;
  return (
    docs
      .filter((d) => d.docType === SHIPPING_INSTRUCTION_DOC && d.customerKey.trim().toLowerCase() === k && d.sourceId !== excludeShipmentId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOrNull = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

export function siFromValues(v: DocumentValues): SiForm {
  const goods = Array.isArray(v.goods)
    ? v.goods.map((r) => ({ contractLineId: str(r.contractLineId), description: str(r.description), hsCode: str(r.hsCode), packages: numOrNull(r.packages), grossKg: numOrNull(r.grossKg) }))
    : [];
  const carry = Object.fromEntries(SI_CARRY_KEYS.map((k) => [k, str(v[k]) || EMPTY_SI_CUSTOMER[k]])) as unknown as SiCustomerFields;
  return { ...carry, date: str(v.date), cbm: str(v.cbm), goods };
}

export function siToValues(f: SiForm): DocumentValues {
  const goods: DocumentRow[] = f.goods.map((r) => ({ ...r, contractLineId: r.contractLineId ?? "" }));
  return { ...Object.fromEntries(SI_CARRY_KEYS.map((k) => [k, f[k]])), date: f.date, cbm: f.cbm, goods };
}

/**
 * SI để mở hộp (R11, R12): đã có bản lưu của chuyến ⇒ dùng nó; chưa có ⇒ ô nhớ theo SI gần nhất cùng khách (lần đầu:
 * Consignee = tên + địa chỉ khách), ngày hôm nay, dòng hàng dựng từ chuyến.
 */
export function initialSi(input: {
  saved: ComposedDocument | null;
  previous: ComposedDocument | null;
  customer: { name: string; address?: string };
  goods: SiGoodsRow[];
  today: string;
  /** Người nhận hàng + Notify ghi ở HĐ (Phòng KH 2026-11-05) — SI MỚI lấy theo đây, hơn SI lần trước của khách. */
  parties?: SiContractParties;
}): SiForm {
  if (input.saved) {
    // Đã lưu: ô của khách + CBM giữ nguyên; dòng hàng dựng lại từ chuyến (tên + HS theo HĐ hiện tại), số kiện /
    // gross đã gõ ở lần trước giữ lại theo dòng HĐ (bản lưu cũ không có khóa ⇒ theo thứ tự dòng).
    const saved = siFromValues(input.saved.values);
    return { ...saved, goods: mergeSavedGoods(input.goods, saved.goods) };
  }
  const prev = input.previous ? siFromValues(input.previous.values) : null;
  const carry: SiCustomerFields = prev
    ? Object.fromEntries(SI_CARRY_KEYS.map((k) => [k, prev[k]])) as unknown as SiCustomerFields
    : { ...EMPTY_SI_CUSTOMER, consignee: partyText(input.customer) };
  const fromContract = siPartiesFromContract(input.customer, input.parties ?? {});
  return {
    ...carry,
    ...(input.parties?.consignee ? { consignee: fromContract.consignee } : {}),
    ...(fromContract.notifyParty != null ? { notifyParty: fromContract.notifyParty } : {}),
    date: input.today,
    cbm: "",
    goods: input.goods,
  };
}

export interface SiContractParties {
  consignee?: ExportParty;
  notifyParty?: ExportParty;
}

/** Tên + địa chỉ ⇒ chữ ô SI (tên dòng đầu, địa chỉ các dòng sau). */
export const partyText = (p: { name: string; address?: string }) => [p.name, p.address ?? ""].map((x) => x.trim()).filter(Boolean).join("\n");

/**
 * Consignee / Notify của SI theo HĐ: Consignee = người nhận hàng của HĐ, không ghi thì khách hàng; Notify = Notify của
 * HĐ, không ghi ⇒ null (giữ ô đang có). Dùng cho SI mới và nút Lấy theo hợp đồng.
 */
export function siPartiesFromContract(customer: { name: string; address?: string }, parties: SiContractParties): { consignee: string; notifyParty: string | null } {
  return {
    consignee: partyText(parties.consignee ?? customer),
    notifyParty: parties.notifyParty ? partyText(parties.notifyParty) : null,
  };
}

/** Dòng mới dựng từ chuyến + số kiện / gross đã lưu (khớp theo dòng HĐ, không có khóa thì theo thứ tự). */
export function mergeSavedGoods(fresh: readonly SiGoodsRow[], saved: readonly SiGoodsRow[]): SiGoodsRow[] {
  if (!fresh.length) return [...saved];
  const keyed = saved.some((s) => s.contractLineId);
  return fresh.map((r, i) => {
    const old = keyed ? saved.find((s) => s.contractLineId && s.contractLineId === r.contractLineId) : saved[i];
    return old ? { ...r, packages: old.packages, grossKg: old.grossKg } : r;
  });
}

/** Tổng số kiện / gross của các dòng (dòng TOTAL của mẫu). */
export function siTotals(goods: readonly SiGoodsRow[]): { packages: number; grossKg: number } {
  return {
    packages: goods.reduce((s, r) => s + (r.packages ?? 0), 0),
    grossKg: Math.round(goods.reduce((s, r) => s + (r.grossKg ?? 0), 0) * 100) / 100,
  };
}

/** Kiểm trước khi xuất (R13): chỉ cảnh báo, không chặn — SI thường gửi trước khi có seal. */
export function siWarnings(l: SiLinked, f: SiForm): string[] {
  const w: string[] = [];
  if (!l.bookingNo.trim()) w.push("Chuyến chưa có số booking.");
  if (l.containers) {
    l.containers.forEach((c, i) => {
      if (!c.containerNo.trim()) w.push(`Cont ${i + 1} chưa có số container.`);
      if (!c.sealNo.trim()) w.push(`Cont ${i + 1} chưa có số seal.`);
    });
  } else {
    if (!l.containerNo.trim()) w.push("Chưa có số container.");
    if (!l.sealNo.trim()) w.push("Chưa có số seal.");
  }
  if (!f.goods.length) w.push("Chuyến chưa có hàng — nhập Hàng của chuyến trước.");
  if (f.payment === "3rd COUNTRY" && !f.paymentPlace.trim()) w.push("Cước trả ở nước thứ ba: ghi rõ nơi trả.");
  return w;
}

/** Bản lưu SI của chuyến (composed_documents, mig 0091) — khóa theo khách để nhớ lần sau (R12). */
export function newSiDocument(
  shipment: Pick<ExportShipment, "id" | "lotCode">,
  ref: string,
  customerKey: string,
  values: DocumentValues,
  meta: { id: string; by: string; at: string },
): ComposedDocument {
  return {
    id: meta.id,
    docType: SHIPPING_INSTRUCTION_DOC,
    sourceType: "export-shipment",
    sourceId: shipment.id,
    sourceRef: ref,
    resource: "export-plans",
    values,
    fieldSources: {},
    sourceRevisionNo: 0,
    customerKey: customerKey.trim(),
    productIds: [],
    createdBy: meta.by,
    createdAt: meta.at,
    updatedBy: meta.by,
    updatedAt: meta.at,
  };
}

/**
 * Gross (kg) từng dòng Hàng của chuyến theo SI đã lưu — Packing list lấy gross theo SI (Phòng KH 2026-11-04). Khớp
 * theo dòng HĐ (`toCurrentLineId` nối id của bản HĐ cũ); dòng HĐ có nhiều dòng chuyến hoặc nhiều dòng SI ⇒ không lấy.
 * Dòng SI không có khóa (bản lưu cũ) ⇒ theo thứ tự khi số dòng bằng nhau. Không có SI / không khớp ⇒ null.
 */
export function siGrossByLine(
  siDoc: Pick<ComposedDocument, "values"> | null | undefined,
  lines: readonly ExportShipmentLine[],
  toCurrentLineId: (contractLineId: string) => string = (id) => id,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!siDoc) return out;
  const goods = siFromValues(siDoc.values).goods.filter((r) => r.grossKg != null);
  if (!goods.length) return out;
  if (goods.every((r) => !r.contractLineId)) {
    if (goods.length === lines.length) lines.forEach((l, i) => out.set(l.id, goods[i].grossKg as number));
    return out;
  }
  const count = (id: string) => lines.filter((l) => l.contractLineId === id).length;
  for (const l of lines) {
    if (!l.contractLineId || count(l.contractLineId) !== 1) continue;
    const rows = goods.filter((r) => r.contractLineId && toCurrentLineId(r.contractLineId) === l.contractLineId);
    if (rows.length === 1) out.set(l.id, rows[0].grossKg as number);
  }
  return out;
}
