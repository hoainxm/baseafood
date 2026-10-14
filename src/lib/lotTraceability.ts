// ============================================================
// Tên file: src/lib/lotTraceability.ts
// Truy xuất theo LÔ: đọc mã QR, nhận diện lô, dựng cây truy NGƯỢC / truy XUÔI,
// cân bằng khối lượng. Hàm THUẦN — không đọc/ghi dữ liệu, không đụng giao diện.
// Thiết kế + căn cứ chuẩn (GS1 Digital Link · EPCIS · GDST · FSMA 204 · TT 02/2024):
// docs/spec/qr-truy-xuat-lo.md
//
// Ba loại lô dùng đúng bản ghi đang có, KHÔNG thêm cột:
//   S = lô NL  = MỘT DÒNG loại NL của chuyến nhập (material_imports), nhãn = lot_code
//              của chuyến (chốt 2026-10-08: mỗi tem đúng một loại + kg của loại đó;
//              `S:<id chuyến>` trước ngày đó vẫn đọc được — xem buildLotNode / findLots)
//   W = lô BTP = một dòng sản xuất (production_wips), nhãn SUY RA
//   P = lô TP  = một phiếu đóng gói (packagings),     nhãn SUY RA
// Mối nối giữa các tầng: bảng lot_inputs (mig 0046) + export_items.wip_id (đã có)
// + lot_dispatches (mig 0056: lô đi ra — bán lẻ, bán nội địa, quét kiểm lệnh xuất).
// ============================================================
import type {
  Customer,
  DomesticSaleItem,
  LabelPrint,
  ExportItem,
  ExportOrder,
  ImportShipment,
  LotDispatch,
  LotInput,
  LotKind,
  LotWaiver,
  MaterialImportItem,
  MaterialType,
  Packaging,
  Product,
  SalesInvoice,
  SalesItem,
  SalesOrder,
  WipProductionItem,
  WipWarehouseStatus,
  Workshop,
} from "@/types";
import { RETAIL_WAREHOUSE, FG_WAREHOUSE, filterRetailSales, computeWipStock, computeFinishedGoodLotStock, collectWipDeductions } from "./inventory";
import { kg as formatKg, formatDateVN } from "./format";

export interface TraceData {
  shipments: readonly ImportShipment[];
  imports: readonly MaterialImportItem[];
  wips: readonly WipProductionItem[];
  packagings: readonly Packaging[];
  lotInputs: readonly LotInput[];
  exportItems: readonly ExportItem[];
  exportOrders: readonly ExportOrder[];
  salesOrders: readonly SalesOrder[];
  products: readonly Product[];
  customers: readonly Customer[];
  // --- Đợt 2b (mig 0056) — tùy chọn để chỗ chỉ cần tra nhanh khỏi phải nạp hết ---
  salesItems?: readonly SalesItem[];
  salesInvoices?: readonly SalesInvoice[];
  domesticSales?: readonly DomesticSaleItem[];
  lotDispatches?: readonly LotDispatch[];
  lotWaivers?: readonly LotWaiver[];
  labelPrints?: readonly LabelPrint[];
  materialTypes?: readonly MaterialType[];
}

/**
 * Lá cuối của cây truy xuôi — hàng đã rời xưởng:
 *   X = một dòng lệnh xuất theo đơn · B = một dòng bán lẻ · N = một dòng bán nội địa NL.
 */
export type TraceNodeKind = LotKind | "X" | "B" | "N";

/** Lá "hàng đã ra khỏi xưởng" — dùng cho danh sách thu hồi. */
export const isOutboundKind = (k: TraceNodeKind): k is "X" | "B" | "N" => k === "X" || k === "B" || k === "N";

export interface LotNode {
  kind: TraceNodeKind;
  id: string;
  /** Nhãn đọc được, in trên tem. */
  label: string;
  /** Là gì: loại NL / mặt hàng. */
  description: string;
  /** yyyy-mm-dd */
  date: string;
  workshop: Workshop | "";
  /** Khối lượng của lô: kg nhận (NL) · kg sản xuất (BTP) · kg ra (TP) · kg xuất (X). */
  kg: number;
  /** Dữ liệu then chốt (KDE) để hiện trên hộ chiếu lô. */
  details: { label: string; value: string }[];
  /** Bản ghi nguồn không còn (bị xóa) — chỉ còn nhãn chụp lúc gắn. */
  isMissing: boolean;
}

export const TRACE_KIND_LABELS: Record<TraceNodeKind, string> = {
  S: "Nguyên liệu",
  W: "Bán thành phẩm",
  P: "Thành phẩm",
  X: "Xuất theo đơn",
  B: "Bán lẻ",
  N: "Bán nội địa",
};

const WORKSHOP_LETTER: Record<Workshop, string> = { Đông: "Đ", Cá: "C", Khô: "K" };

// ---------- Mã QR ----------

/**
 * Nội dung QR = một đường link (kiểu GS1 Digital Link): camera điện thoại nào quét
 * cũng mở thẳng hộ chiếu lô. `origin` lấy lúc IN từ chính địa chỉ app đang chạy —
 * không ghi cứng tên miền trong code.
 */
export function buildLotQrUrl(kind: LotKind, id: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/#/qr?lot=${kind}:${encodeURIComponent(id)}`;
}

export type ScannedCode = { kind: LotKind; id: string } | { code: string };

/**
 * Đọc chuỗi quét được / gõ vào. Nhận CẢ BA dạng:
 *  - đường link `…/#/qr?lot=W:<id>` (tem in trước 2026-10-13: `?lo=`)
 *  - mã trần `W:<id>`
 *  - mã lô trần của TEM CŨ (`Đ-260902-01`) — tem in trước đợt này vẫn dùng được.
 */
export function parseQrCode(text: string): ScannedCode | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const m = /[?&](?:lot|lo)=([^&#\s]+)/.exec(t); // ?lo= = tem in trước 2026-10-13
  if (m) return parseQrCode(decodeURIComponent(m[1]!));
  const k = /^([SWP]):(.+)$/.exec(t);
  if (k) return { kind: k[1] as LotKind, id: k[2]! };
  return { code: t };
}

// ---------- Nhãn lô ----------

const yymmdd = (iso: string) => (iso || "").replace(/-/g, "").slice(2, 8);
const idSuffix = (id: string) => id.replace(/[^0-9a-zA-Z]/g, "").slice(-4).toUpperCase();

/** Nhãn lô BTP suy ra từ mẻ SX: `BĐ-260918-7F3A`. Không lưu — luôn khớp bản ghi. */
export const formatWipLotLabel = (w: Pick<WipProductionItem, "id" | "workshop" | "productionDate">) =>
  `B${WORKSHOP_LETTER[w.workshop] ?? "X"}-${yymmdd(w.productionDate)}-${idSuffix(w.id)}`;

/** Nhãn lô TP suy ra từ phiếu đóng gói: `TĐ-260918-C21B`. */
export const formatFinishedGoodLotLabel = (p: Pick<Packaging, "id" | "workshop" | "date">) =>
  `T${WORKSHOP_LETTER[p.workshop] ?? "X"}-${yymmdd(p.date)}-${idSuffix(p.id)}`;

/** Nhãn lô NL = mã lô của CHUYẾN (mọi loại NL cùng chuyến in cùng mã to trên tem, loại
 *  NL ở dòng mô tả); chuyến cũ chưa có mã thì suy như BTP/TP. */
export const formatMaterialLotLabel = (s: Pick<ImportShipment, "id" | "workshop" | "deliveryDate" | "lotCode">) =>
  s.lotCode?.trim() || `N${WORKSHOP_LETTER[s.workshop] ?? "X"}-${yymmdd(s.deliveryDate)}-${idSuffix(s.id)}`;

/** Các dòng loại NL của một chuyến = các lô NL của chuyến đó, theo thứ tự ghi. */
export const getShipmentLines = (traceData: Pick<TraceData, "imports">, shipmentId: string) =>
  traceData.imports.filter((m) => m.shipmentId === shipmentId).sort((a, b) => a.id.localeCompare(b.id));

// ---------- Dựng nút ----------

const productName = (traceData: TraceData, id: string) => {
  const p = traceData.products.find((x) => x.id === id);
  return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : id || "—";
};

/** kg hiển thị locale vi-VN (quy tắc 2): 7.842 kg. */
const kgText = (v: number) => formatKg(Math.round(v * 100) / 100);
/** Ngày hiển thị dd/mm/yyyy (quy tắc 2 — locale vi-VN); trống thì "—". */
const formatDate = (iso: string | undefined) => (iso ? formatDateVN(iso) : "—");

/** Nhãn lô đã CHỤP lúc gắn / in (lot_inputs · lot_dispatches · label_prints) — cho lô đã bị xóa. */
function snapshotLabel(traceData: TraceData, kind: LotKind, id: string): string {
  return (
    traceData.lotInputs.find((l) => l.inputKind === kind && l.inputId === id)?.inputLabel ||
    (traceData.lotDispatches ?? []).find((d) => d.lotKind === kind && d.lotId === id)?.lotLabel ||
    (traceData.labelPrints ?? []).find((p) => p.lotKind === kind && p.lotId === id)?.label ||
    id
  );
}

/** Dựng một nút lô từ loại + id. Bản ghi đã mất thì trả nút `mat` với nhãn đã chụp. */
export function buildLotNode(kind: TraceNodeKind, id: string, traceData: TraceData): LotNode {
  const lost = (label: string): LotNode => ({
    kind, id, label, description: "(bản ghi không còn)", date: "", workshop: "", kg: 0, details: [], isMissing: true,
  });
  if (kind === "S") {
    // Lô NL = một dòng loại NL của chuyến (chốt 2026-10-08).
    const m = traceData.imports.find((x) => x.id === id);
    if (m) {
      const s = traceData.shipments.find((x) => x.id === m.shipmentId);
      const siblingImports = traceData.imports.filter((x) => x.shipmentId === m.shipmentId);
      const materialType = m.materialTypeName || m.category || "nguyên liệu";
      const date = s?.deliveryDate || m.deliveryDate;
      const workshop = s?.workshop || m.workshop;
      return {
        kind, id,
        label: s ? formatMaterialLotLabel(s) : `N${WORKSHOP_LETTER[workshop] ?? "X"}-${yymmdd(date)}-${idSuffix(m.id)}`,
        description: materialType, date, workshop, kg: m.quantityKg || 0, isMissing: false,
        details: [
          { label: "Loại NL", value: materialType },
          { label: "Khối lượng", value: kgText(m.quantityKg || 0) },
          { label: "Đại lý", value: s?.supplierName || m.supplierName || "—" },
          { label: "Ngày về", value: formatDate(date) },
          { label: "Xe · tài xế", value: [s?.licensePlate || m.licensePlate, s?.driverName || m.driverName].filter(Boolean).join(" · ") || "—" },
          ...(siblingImports.length > 1
            ? [{ label: "Cùng chuyến", value: `${siblingImports.length} loại · ${kgText(siblingImports.reduce((t, x) => t + (x.quantityKg || 0), 0))}` }]
            : []),
          ...(s?.ssccCode ? [{ label: "SSCC", value: s.ssccCode }] : []),
          ...(s?.operator ? [{ label: "Người ghi", value: s.operator }] : []),
        ],
      };
    }
    // Tương thích: `S:<id chuyến>` (tem / dây lô ghi trước khi tách lô theo loại) ⇒ nút cả chuyến.
    const s = traceData.shipments.find((x) => x.id === id);
    if (!s) return lost(snapshotLabel(traceData, "S", id));
    const row = getShipmentLines(traceData, id);
    const materialTypeNames = [...new Set(row.map((m) => m.materialTypeName || m.category).filter(Boolean))];
    const kg = row.reduce((t, m) => t + (m.quantityKg || 0), 0);
    return {
      kind, id, label: formatMaterialLotLabel(s), description: materialTypeNames.join(", ") || "nguyên liệu",
      date: s.deliveryDate, workshop: s.workshop, kg, isMissing: false,
      details: [
        { label: "Đại lý", value: s.supplierName || "—" },
        { label: "Ngày về", value: formatDate(s.deliveryDate) },
        { label: "Xe · tài xế", value: [s.licensePlate, s.driverName].filter(Boolean).join(" · ") || "—" },
        ...row.map((m) => ({ label: m.materialTypeName || m.category, value: kgText(m.quantityKg || 0) })),
        ...(s.ssccCode ? [{ label: "SSCC", value: s.ssccCode }] : []),
        ...(s.operator ? [{ label: "Người ghi", value: s.operator }] : []),
      ],
    };
  }
  if (kind === "W") {
    const w = traceData.wips.find((x) => x.id === id);
    if (!w) return lost(snapshotLabel(traceData, "W", id));
    return {
      kind, id, label: formatWipLotLabel(w), description: productName(traceData, w.productId),
      date: w.productionDate, workshop: w.workshop, kg: w.quantityKg || 0, isMissing: false,
      details: [
        { label: "Mặt hàng", value: productName(traceData, w.productId) },
        ...(w.spec ? [{ label: "Quy cách", value: w.spec }] : []),
        { label: "Ngày sản xuất", value: formatDate(w.productionDate) },
        { label: "Sản lượng", value: `${kgText(w.quantityKg || 0)}${w.blocksCount ? ` · ${w.blocksCount} block` : ""}` },
        ...(w.warehouse ? [{ label: "Kho", value: w.warehouse }] : []),
        ...(w.processingType ? [{ label: "Kiểu chế biến", value: w.processingType }] : []),
        ...(w.operator ? [{ label: "Người ghi", value: w.operator }] : []),
      ],
    };
  }
  if (kind === "P") {
    const p = traceData.packagings.find((x) => x.id === id);
    if (!p) return lost(snapshotLabel(traceData, "P", id));
    return {
      kind, id, label: formatFinishedGoodLotLabel(p), description: productName(traceData, p.toProductId),
      date: p.date, workshop: p.workshop, kg: p.outputKg || 0, isMissing: false,
      details: [
        { label: "Thành phẩm", value: productName(traceData, p.toProductId) },
        ...(p.toSpec ? [{ label: "Quy cách", value: p.toSpec }] : []),
        { label: "Ngày đóng gói", value: formatDate(p.date) },
        { label: "Ra", value: `${kgText(p.outputKg || 0)}${p.outputUnits ? ` · ${p.outputUnits} đơn vị` : ""}` },
        { label: "Từ BTP", value: `${productName(traceData, p.fromProductId)} · ${kgText(p.inputKg || 0)}` },
        ...(p.warehouse ? [{ label: "Kho", value: p.warehouse }] : []),
      ],
    };
  }
  if (kind === "B") {
    const b = (traceData.salesItems ?? []).find((r) => r.id === id);
    if (!b) return lost(id);
    const salesInvoice = (traceData.salesInvoices ?? []).find((v) => v.id === b.invoiceId);
    const customer = salesInvoice ? traceData.customers.find((c) => c.id === salesInvoice.customerId) : undefined;
    const source = b.sourceWarehouse === FG_WAREHOUSE ? "đóng gói" : b.sourceWarehouse === RETAIL_WAREHOUSE ? "block thô" : b.sourceWarehouse;
    return {
      kind, id, label: `Bán ${formatDate(b.deliveryDate)} → ${customer?.name ?? "khách ?"}`,
      description: productName(traceData, b.productId), date: b.deliveryDate, workshop: salesInvoice?.workshop ?? "", kg: b.quantityKg || 0, isMissing: false,
      details: [
        { label: "Khách", value: customer ? `${customer.name}${customer.market ? ` (${customer.market})` : ""}` : "—" },
        { label: "Ngày giao", value: formatDate(b.deliveryDate) },
        { label: "Mặt hàng", value: `${productName(traceData, b.productId)}${b.spec ? ` · ${b.spec}` : ""}` },
        { label: "Khối lượng", value: kgText(b.quantityKg || 0) },
        ...(source ? [{ label: "Nguồn", value: source }] : []),
        ...(salesInvoice?.channel ? [{ label: "Kênh", value: salesInvoice.channel }] : []),
      ],
    };
  }
  if (kind === "N") {
    const n = (traceData.domesticSales ?? []).find((r) => r.id === id);
    if (!n) return lost(id);
    return {
      kind, id, label: `Bán NĐ ${formatDate(n.saleDate)} → ${n.customerName || "khách ?"}`,
      description: n.materialTypeName || "nguyên liệu", date: n.saleDate, workshop: n.workshop, kg: n.quantityKg || 0, isMissing: false,
      details: [
        { label: "Khách", value: n.customerName || "—" },
        { label: "Ngày bán", value: formatDate(n.saleDate) },
        { label: "Loại NL", value: n.materialTypeName || "—" },
        { label: "Khối lượng", value: kgText(n.quantityKg || 0) },
        ...(n.operator ? [{ label: "Người ghi", value: n.operator }] : []),
      ],
    };
  }
  // X — một dòng lệnh xuất
  const x = traceData.exportItems.find((e) => e.id === id);
  if (!x) return lost(id);
  const exportOrder = traceData.exportOrders.find((o) => o.id === x.exportId);
  const don = exportOrder ? traceData.salesOrders.find((o) => o.id === exportOrder.orderId) : undefined;
  const customer = don ? traceData.customers.find((c) => c.id === don.customerId) : undefined;
  return {
    kind, id, label: `Xuất ${formatDate(exportOrder?.exportDate)} → ${customer?.name ?? "khách ?"}`,
    description: productName(traceData, x.productId), date: exportOrder?.exportDate ?? "", workshop: "", kg: x.quantityKg || 0, isMissing: false,
    details: [
      { label: "Khách", value: customer ? `${customer.name}${customer.market ? ` (${customer.market})` : ""}` : "—" },
      { label: "Ngày xuất", value: formatDate(exportOrder?.exportDate) },
      { label: "Khối lượng", value: `${kgText(x.quantityKg || 0)}${x.blocksCount ? ` · ${x.blocksCount} block` : ""}` },
    ],
  };
}

// ---------- Tìm lô từ mã quét ----------

const normalizeCode = (s: string) => s.normalize("NFC").trim().toUpperCase();

/**
 * Tìm lô từ mã đã đọc. Mã loại:id thì trúng đúng một. Mã TRẦN (tem cũ, hoặc gõ tay
 * nhãn) có thể trúng NHIỀU lô — mã lô cũ không đảm bảo duy nhất — nên trả MẢNG để
 * màn hình cho người chọn. Không bao giờ tự chọn bừa một cái.
 */
export function findLots(code: ScannedCode, traceData: TraceData): LotNode[] {
  // QR cũ `S:<id chuyến>` (trước khi tách lô theo loại) ⇒ trả các lô loại NL của chuyến để chọn.
  if ("kind" in code && code.kind === "S" && !traceData.imports.some((m) => m.id === code.id)) {
    const row = getShipmentLines(traceData, code.id);
    if (row.length) return row.map((m) => buildLotNode("S", m.id, traceData));
  }
  if ("kind" in code) {
    const n = buildLotNode(code.kind, code.id, traceData);
    const hasTrace =
      traceData.lotInputs.some((l) => l.inputId === code.id || l.outputId === code.id) ||
      (traceData.lotDispatches ?? []).some((d) => d.lotKind === code.kind && d.lotId === code.id);
    return n.isMissing && !hasTrace ? [] : [n];
  }
  const k = normalizeCode(code.code);
  return [
    // Mã lô in trên tem là mã CHUYẾN ⇒ trả mọi lô loại NL của chuyến đó cho người chọn.
    ...traceData.shipments.filter((s) => normalizeCode(formatMaterialLotLabel(s)) === k).flatMap((s) => getShipmentLines(traceData, s.id).map((m) => buildLotNode("S", m.id, traceData))),
    ...traceData.wips.filter((w) => normalizeCode(formatWipLotLabel(w)) === k).map((w) => buildLotNode("W", w.id, traceData)),
    ...traceData.packagings.filter((p) => normalizeCode(formatFinishedGoodLotLabel(p)) === k).map((p) => buildLotNode("P", p.id, traceData)),
  ];
}

/**
 * Một mã ra NHIỀU lô thì nói đúng lý do: là các LOẠI NL của cùng một chuyến (gõ mã
 * chuyến / quét QR cũ theo chuyến — ca thường ngày từ khi lô NL tách theo loại) hay
 * mã cũ trùng thật giữa các bản ghi khác nhau. `sameShipment` = ca thứ nhất.
 */
export function explainMultipleLots(code: string, items: readonly LotNode[], traceData: Pick<TraceData, "imports">): { message: string; sameShipment: boolean } {
  const shipments = new Set(items.map((n) => (n.kind === "S" ? traceData.imports.find((m) => m.id === n.id)?.shipmentId : undefined)));
  const isSameShipment = items.length > 1 && items.every((n) => n.kind === "S") && shipments.size === 1 && !shipments.has(undefined);
  return isSameShipment
    ? { message: `Chuyến ${items[0]!.label} có ${items.length} loại nguyên liệu, mỗi loại là một lô — chọn đúng loại`, sameShipment: isSameShipment }
    : { message: `Mã "${code.trim()}" trùng ${items.length} lô — chọn đúng lô`, sameShipment: isSameShipment };
}

// ---------- Cây gia phả lô ----------

export interface TraceBranch {
  node: LotNode;
  /** kg của mối nối (đầu vào đã dùng / đầu ra đã nhận). null = chưa cân. */
  kg: number | null;
  children: TraceBranch[];
}

/**
 * Truy NGƯỢC: lô này làm từ những lô nào (nhiều tầng: TP → BTP → NL).
 * `sau` giới hạn độ sâu; `daQua` chặn vòng lặp nếu dữ liệu nhập sai thành vòng.
 */
export function traceBackward(kind: TraceNodeKind, id: string, traceData: TraceData, depth = 5, visited = new Set<string>()): TraceBranch[] {
  if (depth <= 0 || (kind !== "W" && kind !== "P")) return [];
  const key = `${kind}:${id}`;
  if (visited.has(key)) return [];
  visited.add(key);
  return traceData.lotInputs
    .filter((l) => l.outputKind === kind && l.outputId === id)
    .map((l) => ({
      node: buildLotNode(l.inputKind, l.inputId, traceData),
      kg: l.quantityKg,
      children: traceBackward(l.inputKind, l.inputId, traceData, depth - 1, visited),
    }));
}

/** Dòng lô đi ra có nghĩa "hàng đã rời xưởng" (không gồm dấu quét kiểm lệnh xuất — trùng export_items). */
const isLeavingFactory = (d: LotDispatch) => d.docKind === "sales_item" || d.docKind === "domestic_sale";

/**
 * Truy XUÔI: lô này đã đi vào những đâu (NL → mẻ SX → đóng gói / lệnh xuất / bán → khách).
 * Cây này là thứ cần khi THU HỒI: chỉ ra đúng phạm vi hàng bị ảnh hưởng.
 * Ngả ra khỏi xưởng: lệnh xuất theo đơn (BTP, `export_items.wip_id`) · bán lẻ
 * (BTP block thô / TP đóng gói) · bán nội địa (NL bán thẳng) — hai ngả sau qua
 * `lot_dispatches` (mig 0056).
 */
export function traceForward(kind: TraceNodeKind, id: string, traceData: TraceData, depth = 5, visited = new Set<string>()): TraceBranch[] {
  if (depth <= 0 || isOutboundKind(kind)) return [];
  const key = `${kind}:${id}`;
  if (visited.has(key)) return [];
  visited.add(key);
  const viaTransform: TraceBranch[] =
    kind === "P"
      ? []
      : traceData.lotInputs
          .filter((l) => l.inputKind === kind && l.inputId === id)
          .map((l) => ({
            node: buildLotNode(l.outputKind, l.outputId, traceData),
            kg: l.quantityKg,
            children: traceForward(l.outputKind, l.outputId, traceData, depth - 1, visited),
          }));
  const viaExport: TraceBranch[] =
    kind === "W"
      ? traceData.exportItems
          .filter((x) => x.wipId === id)
          .map((x) => ({ node: buildLotNode("X", x.id, traceData), kg: x.quantityKg || 0, children: [] }))
      : [];
  const viaSales: TraceBranch[] = (traceData.lotDispatches ?? [])
    .filter((d) => isLeavingFactory(d) && d.lotKind === kind && d.lotId === id)
    .map((d) => ({ node: buildLotNode(d.docKind === "domestic_sale" ? "N" : "B", d.docId, traceData), kg: d.quantityKg, children: [] }));
  return [...viaTransform, ...viaExport, ...viaSales];
}

// ---------- Cân bằng khối lượng ----------

export interface MassBalance {
  /** kg của lô (nhận / sản xuất). */
  inKg: number;
  /** các ngả đã đi, có kg. */
  outputs: { label: string; kg: number }[];
  /** số lần gắn lô chưa ghi kg — cân bằng chưa đầy đủ. */
  unweighedCount: number;
  /** vao − Σ ra. Âm = dùng/xuất quá số có ⇒ nghi sai số hoặc gắn nhầm lô. */
  remainingKg: number;
}

/**
 * Cân bằng khối lượng theo lô (theo HỒ SƠ LÔ — chỉ cộng các mối nối có kg):
 *   NL : nhận ↔ đưa vào SX + bán nội địa
 *   BTP: sản xuất ↔ đóng gói + xuất theo lệnh + bán lẻ block thô
 *   TP : đóng gói ra ↔ bán lẻ
 */
export function computeLotMassBalance(kind: TraceNodeKind, id: string, traceData: TraceData): MassBalance | null {
  if (kind !== "S" && kind !== "W" && kind !== "P") return null;
  const n = buildLotNode(kind, id, traceData);
  if (n.isMissing) return null;
  const outputs: MassBalance["outputs"] = [];
  let unbalancedCount = 0;
  const addLine = (label: string, kgs: (number | null)[]) => {
    const known = kgs.filter((k): k is number => k != null);
    unbalancedCount += kgs.length - known.length;
    if (known.length) outputs.push({ label, kg: known.reduce((s, k) => s + k, 0) });
  };
  if (kind !== "P") {
    addLine(
      kind === "S" ? "Đã đưa vào sản xuất" : "Đã đóng gói",
      traceData.lotInputs.filter((l) => l.inputKind === kind && l.inputId === id).map((l) => l.quantityKg)
    );
  }
  if (kind === "W") {
    const exportItems = traceData.exportItems.filter((x) => x.wipId === id);
    if (exportItems.length) outputs.push({ label: "Đã xuất theo lệnh", kg: exportItems.reduce((t, x) => t + (x.quantityKg || 0), 0) });
  }
  const dispatches = (traceData.lotDispatches ?? []).filter((d) => isLeavingFactory(d) && d.lotKind === kind && d.lotId === id);
  addLine(kind === "S" ? "Bán nội địa" : kind === "W" ? "Bán lẻ block thô" : "Bán lẻ", dispatches.map((d) => d.quantityKg));
  const totalOut = outputs.reduce((t, r) => t + r.kg, 0);
  return { inKg: n.kg, outputs, unweighedCount: unbalancedCount, remainingKg: n.kg - totalOut };
}

/** Sổ tồn theo lô dựng MỘT lần: id lô → kg còn (W: mẻ đã duyệt nhập kho · P: phiếu đóng gói). */
export interface LotStockIndex {
  W: ReadonlyMap<string, number>;
  P: ReadonlyMap<string, number>;
}

/**
 * Dựng sổ tồn BTP + TP theo lô một lượt. Màn / hàm cần tồn của NHIỀU lô (danh sách
 * gắn lô, tab Theo giai đoạn, thu hồi) dựng bảng này một lần rồi truyền vào
 * `getLotStockKg` — gọi `computeWipStock` cho từng lô là O(n²), ~3.000 mẻ/năm treo vài giây.
 */
export function buildLotStockIndex(traceData: TraceData): LotStockIndex {
  const wipStock = computeWipStock(
    [...traceData.wips],
    [...traceData.exportItems],
    collectWipDeductions([...(traceData.salesItems ?? [])], [...traceData.packagings], traceData.lotInputs, traceData.lotDispatches ?? [])
  );
  const finishedGoods = computeFinishedGoodLotStock([...traceData.packagings], filterRetailSales([...(traceData.salesItems ?? [])], FG_WAREHOUSE, traceData.lotDispatches ?? []));
  return { W: new Map(wipStock.map((l) => [l.wipId, l.remainingKg])), P: new Map(finishedGoods.map((l) => [l.wipId, l.remainingKg])) };
}

/**
 * Kg CÒN TRONG KHO của lô theo SỔ TỒN (khác cân bằng theo hồ sơ lô: sổ tồn trừ cả
 * dòng bán/đóng gói CHƯA gắn lô theo FIFO). BTP chưa duyệt nhập kho ⇒ null.
 * NL ⇒ null (tồn NL theo lô chưa có — doc 38).
 * Tra nhiều lô ⇒ truyền `bang` dựng sẵn bằng `buildLotStockIndex(dl)` (không thì dựng lại mỗi lần).
 */
export function getLotStockKg(kind: TraceNodeKind, id: string, traceData: TraceData, stockIndex?: LotStockIndex): number | null {
  if (kind !== "W" && kind !== "P") return null;
  return (stockIndex ?? buildLotStockIndex(traceData))[kind].get(id) ?? null;
}

// ---------- Danh sách lô để CHỌN khi gắn ----------

/** Lùi `date` ngày lịch. Tính hết bằng UTC (như `getPeriodDates`) — giờ máy +07 mà đọc
 *  nửa đêm địa phương rồi `toISOString` sẽ lùi thêm một ngày. */
const lui = (iso: string, date: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - date);
  return d.toISOString().slice(0, 10);
};

/**
 * Lô NL (mỗi dòng loại NL của chuyến) để chọn khi gắn cho mẻ SX, cùng xưởng:
 *  1. chuyến về trong `soNgay` ngày tính tới ngày SX — MỚI trước (NL tươi vừa về);
 *  2. CỘNG lô cũ hơn (tới 1 năm) mà theo hồ sơ còn kg — CŨ trước (FIFO gợi ý):
 *     NL cấp đông kỳ trước đem xả đông. Chỉ lấy lô đã từng gắn, hoặc về từ ngày
 *     bắt đầu truy xuất (lần gắn lô đầu tiên) — lô trước đó chưa ai theo dõi,
 *     liệt kê ra chỉ làm rối.
 */
export function listSelectableMaterialLots(traceData: TraceData, workshop: Workshop, toDate: string, days = 45): LotNode[] {
  const fromDate = lui(toDate, days);
  const linesOf = (items: ImportShipment[]) => items.flatMap((s) => getShipmentLines(traceData, s.id).map((m) => ({ s, m })));
  const recentLots = linesOf(
    traceData.shipments
      .filter((s) => s.workshop === workshop && s.deliveryDate >= fromDate && s.deliveryDate <= toDate)
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id))
  );
  const start = traceData.lotInputs.reduce<string>((m, l) => (!m || (l.recordedAt && l.recordedAt < m) ? l.recordedAt : m), "").slice(0, 10);
  const assigned = new Set(traceData.lotInputs.filter((l) => l.inputKind === "S").map((l) => l.inputId));
  const oneYearAgo = lui(toDate, 365);
  const olderOpenLots = linesOf(
    traceData.shipments
      .filter((s) => s.workshop === workshop && s.deliveryDate < fromDate && s.deliveryDate >= oneYearAgo)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.id.localeCompare(b.id))
  ).filter(
    ({ s, m }) =>
      (assigned.has(m.id) || (!!start && s.deliveryDate >= start)) && (computeLotMassBalance("S", m.id, traceData)?.remainingKg ?? 0) > 0
  );
  return [...recentLots, ...olderOpenLots].map(({ m }) => buildLotNode("S", m.id, traceData));
}

/** Lô BTP gần đây để chọn khi gắn cho phiếu đóng gói: cùng xưởng (hàng đông trữ lâu ⇒ cửa sổ rộng). */
export function listSelectableWipLots(traceData: TraceData, workshop: Workshop, toDate: string, days = 120, productId?: string): LotNode[] {
  const fromDate = lui(toDate, days);
  return traceData.wips
    .filter((w) => w.workshop === workshop && w.productionDate >= fromDate && w.productionDate <= toDate)
    .sort(
      (a, b) =>
        Number(b.productId === productId) - Number(a.productId === productId) ||
        b.productionDate.localeCompare(a.productionDate)
    )
    .map((w) => buildLotNode("W", w.id, traceData));
}

// ---------- Danh sách lô để IN TEM hàng loạt ----------

export interface LabelPrintFilter {
  /** yyyy-mm-dd, tính cả hai đầu. */
  fromDate: string;
  toDate: string;
  /** "" = mọi xưởng. */
  workshop: Workshop | "";
  /** Loại lô cần in; rỗng ⇒ không lô nào. */
  kinds: readonly LotKind[];
}

const KIND_ORDER: Record<LotKind, number> = { S: 0, W: 1, P: 2 };

/**
 * Mọi lô (NL · BTP · TP) trong khoảng ngày để in tem một lượt — MỚI trước, cùng
 * ngày thì theo chuỗi NL → BTP → TP. Ngày của lô: ngày hàng về · ngày SX · ngày đóng gói.
 */
export function listLotsToPrint(traceData: TraceData, filter: LabelPrintFilter): LotNode[] {
  const isWithin = (date: string, workshop: Workshop) =>
    date >= filter.fromDate && date <= filter.toDate && (!filter.workshop || workshop === filter.workshop);
  const known = (k: LotKind) => filter.kinds.includes(k);
  return [
    ...(known("S")
      ? traceData.shipments.filter((s) => isWithin(s.deliveryDate, s.workshop)).flatMap((s) => getShipmentLines(traceData, s.id).map((m) => buildLotNode("S", m.id, traceData)))
      : []),
    ...(known("W") ? traceData.wips.filter((w) => isWithin(w.productionDate, w.workshop)).map((w) => buildLotNode("W", w.id, traceData)) : []),
    ...(known("P") ? traceData.packagings.filter((p) => isWithin(p.date, p.workshop)).map((p) => buildLotNode("P", p.id, traceData)) : []),
  ].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      KIND_ORDER[a.kind as LotKind] - KIND_ORDER[b.kind as LotKind] ||
      a.label.localeCompare(b.label)
  );
}

// ---------- Sổ in tem (mig 0049) ----------

export const lotKey = (kind: LotKind, id: string) => `${kind}:${id}`;

export interface LabelPrintSummary {
  /** số lượt bấm In */
  printCount: number;
  /** tổng số tem đã in */
  labelCount: number;
  /** lượt in gần nhất */
  lastPrint: LabelPrint;
}

/** Gom sổ in tem theo lô: khóa `loại:id` → số lượt, số tem, lần in gần nhất. */
export function summarizeLabelPrints(prints: readonly LabelPrint[]): Map<string, LabelPrintSummary> {
  const m = new Map<string, LabelPrintSummary>();
  for (const p of prints) {
    const k = lotKey(p.lotKind, p.lotId);
    const prev = m.get(k);
    if (!prev) m.set(k, { printCount: 1, labelCount: p.copies, lastPrint: p });
    else
      m.set(k, {
        printCount: prev.printCount + 1,
        labelCount: prev.labelCount + p.copies,
        lastPrint: p.printedAt > prev.lastPrint.printedAt ? p : prev.lastPrint,
      });
  }
  return m;
}

/**
 * Dòng sổ in cho một lượt in (mỗi lô một dòng). Bỏ nút không phải lô (hàng đã ra)
 * và lô đã mất. `soTem` = số tem đã in của từng lô (mặc định 1).
 */
export function buildLabelPrintRecords(
  nuts: readonly LotNode[],
  printedBy: string,
  luc: string,
  newId: () => string,
  countLabels: (n: LotNode) => number = () => 1
): LabelPrint[] {
  return nuts
    .filter((n): n is LotNode & { kind: LotKind } => !isOutboundKind(n.kind) && !n.isMissing)
    .map((n) => ({
      id: newId(), lotKind: n.kind, lotId: n.id, label: n.label,
      copies: Math.max(1, Math.round(countLabels(n) || 1)), operator: printedBy, printedAt: luc,
    }));
}

// ---------- Gắn lô NL cho CẢ PHIÊN ghi sản xuất (đợt 2b) ----------

const normalize = (s: string | undefined) => (s ?? "").normalize("NFC").trim().toLowerCase();

/** Họ NL của một lô NL: tên loại NL + loài (category). Lô = một dòng; mã cũ theo chuyến ⇒ mọi dòng. */
function materialLotFamily(traceData: TraceData, lotId: string) {
  const importRow = traceData.imports.find((m) => m.id === lotId);
  const row = importRow ? [importRow] : traceData.imports.filter((m) => m.shipmentId === lotId);
  const names = new Set(row.map((m) => normalize(m.materialTypeName)).filter(Boolean));
  const categories = new Set(
    row
      .flatMap((m) => [m.category, (traceData.materialTypes ?? []).find((t) => normalize(t.name) === normalize(m.materialTypeName))?.category])
      .map((x) => normalize(x))
      .filter(Boolean)
  );
  return { names, categories };
}

/** Tên loại NL gắn trên mặt hàng của mẻ ("" = mặt hàng chưa gắn loại NL). */
function batchMaterialName(traceData: TraceData, w: Pick<WipProductionItem, "productId">): string {
  const p = traceData.products.find((x) => x.id === w.productId);
  return normalize((traceData.materialTypes ?? []).find((t) => t.id === p?.materialTypeId)?.name);
}

/** Loài của mặt hàng một mẻ ("" = không rõ): category mặt hàng, rồi tới loài của loại NL gắn trên mặt hàng. */
function materialTypeOfBatch(traceData: TraceData, w: Pick<WipProductionItem, "productId">): string {
  const p = traceData.products.find((x) => x.id === w.productId);
  if (!p) return "";
  return normalize(p.category) || normalize((traceData.materialTypes ?? []).find((t) => t.id === p.materialTypeId)?.category);
}

export interface SessionLotInputResult {
  lotInputs: LotInput[];
  dispatches: LotDispatch[];
  /** Mẻ / dòng bán nội địa không khớp họ NL với lô nào của phiên — để người ghi tự gắn. */
  mismatches: { kind: "W" | "N"; id: string }[];
}

/**
 * Tổ trưởng khai MỘT lần "phiên này dùng lô NL nào" ⇒ gắn cho từng mẻ vừa lưu
 * (lot_inputs) và từng dòng bán nội địa (lot_dispatches), kg để trống (chưa cân).
 *
 * Chỉ gắn khi KHỚP, để mẻ bạch tuộc không dính lô mực, mẻ 2 da không dính lô 1 da:
 *  - mẻ: mặt hàng đã gắn LOẠI NL (Danh mục) và phiên có lô đúng loại đó ⇒ CHỈ gắn
 *    các lô đúng loại; không thì so LOÀI; không rõ loài (mặt hàng chưa gắn loài /
 *    chuyến không ghi loài) ⇒ VẪN gắn — gắn thừa chỉ làm phạm vi thu hồi rộng ra,
 *    không bao giờ hẹp lại (chiều an toàn);
 *  - bán nội địa: lô đúng loại NL đó; không có thì lô cùng loài.
 * Cặp đã gắn rồi thì bỏ qua (không nhân đôi).
 */
export function assignSessionLots(a: {
  wips: readonly Pick<WipProductionItem, "id" | "productId">[];
  domesticSales: readonly Pick<DomesticSaleItem, "id" | "materialTypeName">[];
  materialLots: readonly { node: LotNode; method: LotInput["method"] }[];
  traceData: TraceData;
  operator: string;
  recordedAt: string;
  newId: () => string;
}): SessionLotInputResult {
  const lots = a.materialLots.filter((l) => l.node.kind === "S" && !l.node.isMissing).map((l) => ({ ...l, family: materialLotFamily(a.traceData, l.node.id) }));
  const lotInputs: LotInput[] = [];
  const dispatches: LotDispatch[] = [];
  const unmatched: SessionLotInputResult["mismatches"] = [];
  if (!lots.length) return { lotInputs, dispatches, mismatches: unmatched };

  for (const wip of a.wips) {
    const materialType = materialTypeOfBatch(a.traceData, wip);
    const materialName = batchMaterialName(a.traceData, wip);
    const sameTypeLots = materialName ? lots.filter((l) => l.family.names.has(materialName)) : [];
    const box = sameTypeLots.length ? sameTypeLots : lots.filter((l) => !materialType || l.family.categories.size === 0 || l.family.categories.has(materialType));
    if (!box.length) unmatched.push({ kind: "W", id: wip.id });
    for (const l of box) {
      if (a.traceData.lotInputs.some((x) => x.outputKind === "W" && x.outputId === wip.id && x.inputKind === "S" && x.inputId === l.node.id)) continue;
      lotInputs.push({
        id: a.newId(), outputKind: "W", outputId: wip.id, inputKind: "S", inputId: l.node.id,
        inputLabel: l.node.label, material: l.node.description, quantityKg: null, method: l.method,
        operator: a.operator, recordedAt: a.recordedAt,
      });
    }
  }
  for (const b of a.domesticSales) {
    const name = normalize(b.materialTypeName);
    const materialType = normalize((a.traceData.materialTypes ?? []).find((t) => normalize(t.name) === name)?.category);
    const sameTypeLots = lots.filter((l) => l.family.names.has(name));
    const box = sameTypeLots.length ? sameTypeLots : lots.filter((l) => !!materialType && l.family.categories.has(materialType));
    if (!box.length) unmatched.push({ kind: "N", id: b.id });
    for (const l of box) {
      if ((a.traceData.lotDispatches ?? []).some((x) => x.docKind === "domestic_sale" && x.docId === b.id && x.lotId === l.node.id)) continue;
      dispatches.push({
        id: a.newId(), lotKind: "S", lotId: l.node.id, lotLabel: l.node.label, docKind: "domestic_sale", docId: b.id,
        quantityKg: null, method: l.method, operator: a.operator, recordedAt: a.recordedAt,
      });
    }
  }
  return { lotInputs, dispatches, mismatches: unmatched };
}

/** Mẻ SX CHƯA gắn lô NL và CHƯA ghi lý do bỏ qua — chốt ngày phải xử lý hết. */
export function findBatchesWithoutLot<T extends Pick<WipProductionItem, "id">>(
  mes: readonly T[],
  lotInputs: readonly LotInput[],
  lotWaivers: readonly LotWaiver[]
): T[] {
  return mes.filter(
    (w) =>
      !lotInputs.some((l) => l.outputKind === "W" && l.outputId === w.id) &&
      !lotWaivers.some((x) => x.outputKind === "W" && x.outputId === w.id)
  );
}

// ---------- Theo giai đoạn (đợt 2b) ----------

export type TraceStageKey = "imports" | "production" | "warehouse" | "packaging" | "outbound";

/** Việc còn thiếu ở một mục: in tem · gắn lô · duyệt nhập kho · quét kiểm khi xếp xe. */
export type MissingTask = "label" | "lot" | "approve" | "scan";

export interface TraceStageItem {
  /** Lô (S/W/P) hoặc dòng hàng ra (X lệnh xuất · B bán lẻ · N bán nội địa). */
  node: LotNode;
  /** Số tem đã in (lô S/W/P); undefined = không áp dụng. */
  printedCount?: number;
  /** Số lô đầu vào đã gắn (W: lô NL · P: lô BTP) hoặc lô đã gắn cho hàng ra (B/N). */
  lotCount?: number;
  /** W/P chưa gắn lô nhưng đã ghi lý do khi chốt ngày. */
  reason?: string;
  /** S: số mẻ / dòng bán nội địa đã dùng lô này. */
  usedKg?: number;
  /** W: trạng thái kho. */
  warehouseStatus?: WipWarehouseStatus;
  /** Tồn trong kho theo sổ tồn (W đã nhập, P). */
  stockKg?: number | null;
  /** X: đã quét kiểm khi xếp xe. */
  isScanned?: boolean;
  /** X: lệnh xuất + đơn của dòng — để mở thẳng hộp kiểm lô. */
  exportOrderId?: string;
  salesOrderId?: string;
  /** B: lô gắn cho dòng bán lẻ là BTP (block thô) hay TP (đóng gói). */
  soldLotKind?: "W" | "P";
  missing: MissingTask[];
}

export interface TraceStage {
  key: TraceStageKey;
  name: string;
  items: TraceStageItem[];
}

/**
 * Chuỗi truy xuất xếp theo GIAI ĐOẠN (nhập NL → sản xuất → kho → đóng gói → xuất/bán)
 * cho một khoảng ngày × xưởng: mỗi lô / dòng hàng ra kèm trạng thái (tem, lô đã gắn,
 * kho, quét kiểm) và VIỆC CÒN THIẾU — để kiểm QR từng khâu ở MỘT chỗ thay vì đi 7 màn.
 * Ngày của mục: ngày hàng về · ngày SX · ngày đóng gói · ngày xuất / bán.
 */
export function groupByTraceStage(traceData: TraceData, filter: { fromDate: string; toDate: string; workshop: Workshop | "" }): TraceStage[] {
  const isWithin = (date: string, workshop: Workshop | "" | undefined) =>
    !!date && date >= filter.fromDate && date <= filter.toDate && (!filter.workshop || workshop === filter.workshop);
  const disp = traceData.lotDispatches ?? [];
  const waivers = traceData.lotWaivers ?? [];
  const daIn = summarizeLabelPrints(traceData.labelPrints ?? []);
  const countLabels = (k: LotKind, id: string) => daIn.get(lotKey(k, id))?.labelCount ?? 0;
  const waiverReason = (k: "W" | "P", id: string) => waivers.find((x) => x.outputKind === k && x.outputId === id)?.reason;
  const countInputLots = (k: "W" | "P", id: string) => traceData.lotInputs.filter((l) => l.outputKind === k && l.outputId === id).length;
  const countDispatchLots = (doc: LotDispatch["docKind"], id: string) => disp.filter((d) => d.docKind === doc && d.docId === id).length;
  const missingLotLabels = (labelCount: number, lot: number, hasReason: boolean): MissingTask[] => [
    ...(lot === 0 && !hasReason ? (["lot"] as const) : []),
    ...(labelCount === 0 ? (["label"] as const) : []),
  ];
  const newestFirst = <T extends { node: LotNode }>(a: T, b: T) => b.node.date.localeCompare(a.node.date) || a.node.label.localeCompare(b.node.label);
  const lotStockTable = buildLotStockIndex(traceData); // một lượt cho mọi lô — không tính lại sổ tồn từng dòng

  const importStages: TraceStageItem[] = traceData.shipments
    .filter((s) => isWithin(s.deliveryDate, s.workshop))
    .flatMap((s) => getShipmentLines(traceData, s.id))
    .map((m) => {
      const labelCount = countLabels("S", m.id);
      const expected =
        new Set(traceData.lotInputs.filter((l) => l.inputKind === "S" && l.inputId === m.id).map((l) => l.outputId)).size +
        disp.filter((d) => d.lotKind === "S" && d.lotId === m.id && d.docKind === "domestic_sale").length;
      return { node: buildLotNode("S", m.id, traceData), printedCount: labelCount, usedKg: expected, missing: labelCount === 0 ? (["label"] as MissingTask[]) : [] };
    })
    .sort(newestFirst);

  const mes = traceData.wips.filter((w) => isWithin(w.productionDate, w.workshop));
  const wips: TraceStageItem[] = mes
    .map((w) => {
      const labelCount = countLabels("W", w.id);
      const lot = countInputLots("W", w.id);
      const ld = waiverReason("W", w.id);
      return { node: buildLotNode("W", w.id, traceData), printedCount: labelCount, lotCount: lot, reason: ld, warehouseStatus: w.status, missing: missingLotLabels(labelCount, lot, !!ld) };
    })
    .sort(newestFirst);

  const warehouse: TraceStageItem[] = mes
    .map((w) => ({
      node: buildLotNode("W", w.id, traceData),
      warehouseStatus: w.status,
      stockKg: w.status === "stocked" ? getLotStockKg("W", w.id, traceData, lotStockTable) : null,
      printedCount: countLabels("W", w.id),
      missing: w.status === "pending" ? (["approve"] as MissingTask[]) : [],
    }))
    .sort((a, b) => Number(b.warehouseStatus === "pending") - Number(a.warehouseStatus === "pending") || newestFirst(a, b));

  const packagingStages: TraceStageItem[] = traceData.packagings
    .filter((p) => isWithin(p.date, p.workshop))
    .map((p) => {
      const labelCount = countLabels("P", p.id);
      const lot = countInputLots("P", p.id);
      const ld = waiverReason("P", p.id);
      return { node: buildLotNode("P", p.id, traceData), printedCount: labelCount, lotCount: lot, reason: ld, stockKg: getLotStockKg("P", p.id, traceData, lotStockTable), missing: missingLotLabels(labelCount, lot, !!ld) };
    })
    .sort(newestFirst);

  const exportOrder = new Map(traceData.exportOrders.map((o) => [o.id, o]));
  const workshopByWip = new Map(traceData.wips.map((w) => [w.id, w.workshop]));
  const salesInvoiceById = new Map((traceData.salesInvoices ?? []).map((v) => [v.id, v]));
  const salesOutStages: TraceStageItem[] = [
    ...traceData.exportItems
      .filter((x) => isWithin(exportOrder.get(x.exportId)?.exportDate ?? "", workshopByWip.get(x.wipId)))
      .map((x) => {
        const isScanned = countDispatchLots("export_item", x.id) > 0;
        return { node: buildLotNode("X", x.id, traceData), isScanned, exportOrderId: x.exportId, salesOrderId: exportOrder.get(x.exportId)?.orderId, missing: isScanned ? [] : (["scan"] as MissingTask[]) };
      }),
    ...(traceData.salesItems ?? [])
      .filter((b) => (b.sourceWarehouse === RETAIL_WAREHOUSE || b.sourceWarehouse === FG_WAREHOUSE) && isWithin(b.deliveryDate, salesInvoiceById.get(b.invoiceId)?.workshop))
      .map((b) => {
        const lot = countDispatchLots("sales_item", b.id);
        return { node: buildLotNode("B", b.id, traceData), lotCount: lot, soldLotKind: (b.sourceWarehouse === FG_WAREHOUSE ? "P" : "W") as "W" | "P", missing: lot ? [] : (["lot"] as MissingTask[]) };
      }),
    ...(traceData.domesticSales ?? [])
      .filter((n) => isWithin(n.saleDate, n.workshop))
      .map((n) => {
        const lot = countDispatchLots("domestic_sale", n.id);
        return { node: buildLotNode("N", n.id, traceData), lotCount: lot, missing: lot ? [] : (["lot"] as MissingTask[]) };
      }),
  ].sort(newestFirst);

  return [
    { key: "imports", name: "Nhập nguyên liệu", items: importStages },
    { key: "production", name: "Sản xuất bán thành phẩm", items: wips },
    { key: "warehouse", name: "Nhập kho dự trữ", items: warehouse },
    { key: "packaging", name: "Đóng gói thành phẩm", items: packagingStages },
    { key: "outbound", name: "Xuất theo đơn & bán", items: salesOutStages },
  ];
}

// ---------- Danh sách thu hồi (đợt 2b) ----------

export interface RecallRow {
  kind: "X" | "B" | "N";
  /** id dòng hàng ra (lệnh xuất / bán lẻ / bán nội địa) — để bỏ trùng khi gộp nhiều lô. */
  id: string;
  customer: string;
  date: string;
  document: string;
  product: string;
  /** kg của mối nối (đi ra từ lô liền trước); null = chưa cân. */
  kg: number | null;
  /** nhãn lô liền trước — hàng rời xưởng từ lô này */
  fromLot: string;
}

/**
 * Lô này nghi có vấn đề ⇒ ai đã nhận hàng (khách · ngày · chứng từ · kg) và
 * những lô BTP/TP còn trong xưởng cần khoanh lại. Đi hết cây truy xuôi.
 */
export function buildRecallList(kind: TraceNodeKind, id: string, traceData: TraceData): { shippedItems: RecallRow[]; inPlantLots: LotNode[] } {
  const recallRows: RecallRow[] = [];
  const lotsInPlant: LotNode[] = [];
  const root = buildLotNode(kind, id, traceData);
  if (root.kind === "W" || root.kind === "P") lotsInPlant.push(root);
  const exportCustomer = (xId: string) => {
    const x = traceData.exportItems.find((e) => e.id === xId);
    const exportOrder = x ? traceData.exportOrders.find((o) => o.id === x.exportId) : undefined;
    const don = exportOrder ? traceData.salesOrders.find((o) => o.id === exportOrder.orderId) : undefined;
    return { customer: traceData.customers.find((c) => c.id === don?.customerId)?.name ?? "", date: exportOrder?.exportDate ?? "" };
  };
  const salesCustomer = (bId: string) => {
    const b = (traceData.salesItems ?? []).find((r) => r.id === bId);
    const salesInvoice = b ? (traceData.salesInvoices ?? []).find((v) => v.id === b.invoiceId) : undefined;
    return traceData.customers.find((c) => c.id === salesInvoice?.customerId)?.name ?? "";
  };
  const walk = (tree: TraceBranch[], parent: LotNode) => {
    for (const nh of tree) {
      const n = nh.node;
      if (n.kind === "X") {
        const k = exportCustomer(n.id);
        recallRows.push({ kind: "X", id: n.id, customer: k.customer, date: k.date, document: `Lệnh xuất ${formatDate(k.date)}`, product: n.description, kg: nh.kg, fromLot: parent.label });
      } else if (n.kind === "B") {
        recallRows.push({ kind: "B", id: n.id, customer: salesCustomer(n.id), date: n.date, document: `Phiếu bán ${formatDate(n.date)}`, product: n.description, kg: nh.kg, fromLot: parent.label });
      } else if (n.kind === "N") {
        const r = (traceData.domesticSales ?? []).find((x) => x.id === n.id);
        recallRows.push({ kind: "N", id: n.id, customer: r?.customerName ?? "", date: n.date, document: `Bán nội địa ${formatDate(n.date)}`, product: n.description, kg: nh.kg, fromLot: parent.label });
      } else {
        if ((n.kind === "W" || n.kind === "P") && !lotsInPlant.some((l) => l.kind === n.kind && l.id === n.id)) lotsInPlant.push(n);
        walk(nh.children, n);
      }
    }
  };
  walk(traceForward(kind, id, traceData), root);
  recallRows.sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer));
  return { shippedItems: recallRows, inPlantLots: lotsInPlant };
}

/** Các lô NL CÙNG CHUYẾN với lô này (gồm chính nó) — để xem / thu hồi gộp theo chuyến. */
export function findSameShipmentLots(id: string, traceData: TraceData): LotNode[] {
  const m = traceData.imports.find((x) => x.id === id);
  return m ? getShipmentLines(traceData, m.shipmentId).map((x) => buildLotNode("S", x.id, traceData)) : [];
}

/**
 * Thu hồi GỘP nhiều lô (vd mọi loại NL của một chuyến): nối danh sách của từng lô,
 * mỗi dòng hàng ra chỉ một lần (lấy lần gặp đầu), lô trong xưởng cũng bỏ trùng.
 */
export function buildRecallListForLots(items: readonly LotNode[], traceData: TraceData): { shippedItems: RecallRow[]; inPlantLots: LotNode[] } {
  const recallRows: RecallRow[] = [];
  const lotsInPlant: LotNode[] = [];
  for (const n of items) {
    const result = buildRecallList(n.kind, n.id, traceData);
    for (const r of result.shippedItems) if (!recallRows.some((x) => x.kind === r.kind && x.id === r.id)) recallRows.push(r);
    for (const l of result.inPlantLots) if (!lotsInPlant.some((x) => x.kind === l.kind && x.id === l.id)) lotsInPlant.push(l);
  }
  recallRows.sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer));
  return { shippedItems: recallRows, inPlantLots: lotsInPlant };
}

// ---------- Số tem mặc định (đợt 2b) ----------

/** Mỗi block (BTP) / mỗi thùng-gói (TP) một tem; NL một tem cho chuyến. Sửa được khi in. */
export function getDefaultLabelCount(n: Pick<LotNode, "kind" | "id">, traceData: Pick<TraceData, "wips" | "packagings">): number {
  const num =
    n.kind === "W" ? traceData.wips.find((w) => w.id === n.id)?.blocksCount :
    n.kind === "P" ? traceData.packagings.find((p) => p.id === n.id)?.outputUnits :
    1;
  return Math.min(500, Math.max(1, Math.round(num || 1)));
}
