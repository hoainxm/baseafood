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
  Workshop,
} from "@/types";
import { RETAIL_WAREHOUSE, FG_WAREHOUSE, filterRetailSales, computeWipStock, computeFinishedGoodLotStock, collectWipDeductions } from "./inventory";
import { kg as kgVi, formatDateVN } from "./format";

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
  nhan: string;
  /** Là gì: loại NL / mặt hàng. */
  moTa: string;
  /** yyyy-mm-dd */
  ngay: string;
  xuong: Workshop | "";
  /** Khối lượng của lô: kg nhận (NL) · kg sản xuất (BTP) · kg ra (TP) · kg xuất (X). */
  kg: number;
  /** Dữ liệu then chốt (KDE) để hiện trên hộ chiếu lô. */
  chiTiet: { nhan: string; giaTri: string }[];
  /** Bản ghi nguồn không còn (bị xóa) — chỉ còn nhãn chụp lúc gắn. */
  mat: boolean;
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

export type ScannedCode = { kind: LotKind; id: string } | { ma: string };

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
  return { ma: t };
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
export const getShipmentLines = (dl: Pick<TraceData, "imports">, shipmentId: string) =>
  dl.imports.filter((m) => m.shipmentId === shipmentId).sort((a, b) => a.id.localeCompare(b.id));

// ---------- Dựng nút ----------

const productName = (dl: TraceData, id: string) => {
  const p = dl.products.find((x) => x.id === id);
  return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : id || "—";
};

/** kg hiển thị locale vi-VN (quy tắc 2): 7.842 kg. */
const kgChu = (v: number) => kgVi(Math.round(v * 100) / 100);
/** Ngày hiển thị dd/mm/yyyy (quy tắc 2 — locale vi-VN); trống thì "—". */
const formatDate = (iso: string | undefined) => (iso ? formatDateVN(iso) : "—");

/** Nhãn lô đã CHỤP lúc gắn / in (lot_inputs · lot_dispatches · label_prints) — cho lô đã bị xóa. */
function snapshotLabel(dl: TraceData, kind: LotKind, id: string): string {
  return (
    dl.lotInputs.find((l) => l.inputKind === kind && l.inputId === id)?.inputLabel ||
    (dl.lotDispatches ?? []).find((d) => d.lotKind === kind && d.lotId === id)?.lotLabel ||
    (dl.labelPrints ?? []).find((p) => p.lotKind === kind && p.lotId === id)?.label ||
    id
  );
}

/** Dựng một nút lô từ loại + id. Bản ghi đã mất thì trả nút `mat` với nhãn đã chụp. */
export function buildLotNode(kind: TraceNodeKind, id: string, dl: TraceData): LotNode {
  const mat = (label: string): LotNode => ({
    kind, id, nhan: label, moTa: "(bản ghi không còn)", ngay: "", xuong: "", kg: 0, chiTiet: [], mat: true,
  });
  if (kind === "S") {
    // Lô NL = một dòng loại NL của chuyến (chốt 2026-10-08).
    const m = dl.imports.find((x) => x.id === id);
    if (m) {
      const s = dl.shipments.find((x) => x.id === m.shipmentId);
      const siblingImports = dl.imports.filter((x) => x.shipmentId === m.shipmentId);
      const materialType = m.materialTypeName || m.category || "nguyên liệu";
      const date = s?.deliveryDate || m.deliveryDate;
      const workshop = s?.workshop || m.workshop;
      return {
        kind, id,
        nhan: s ? formatMaterialLotLabel(s) : `N${WORKSHOP_LETTER[workshop] ?? "X"}-${yymmdd(date)}-${idSuffix(m.id)}`,
        moTa: materialType, ngay: date, xuong: workshop, kg: m.quantityKg || 0, mat: false,
        chiTiet: [
          { nhan: "Loại NL", giaTri: materialType },
          { nhan: "Khối lượng", giaTri: kgChu(m.quantityKg || 0) },
          { nhan: "Đại lý", giaTri: s?.supplierName || m.supplierName || "—" },
          { nhan: "Ngày về", giaTri: formatDate(date) },
          { nhan: "Xe · tài xế", giaTri: [s?.licensePlate || m.licensePlate, s?.driverName || m.driverName].filter(Boolean).join(" · ") || "—" },
          ...(siblingImports.length > 1
            ? [{ nhan: "Cùng chuyến", giaTri: `${siblingImports.length} loại · ${kgChu(siblingImports.reduce((t, x) => t + (x.quantityKg || 0), 0))}` }]
            : []),
          ...(s?.ssccCode ? [{ nhan: "SSCC", giaTri: s.ssccCode }] : []),
          ...(s?.operator ? [{ nhan: "Người ghi", giaTri: s.operator }] : []),
        ],
      };
    }
    // Tương thích: `S:<id chuyến>` (tem / dây lô ghi trước khi tách lô theo loại) ⇒ nút cả chuyến.
    const s = dl.shipments.find((x) => x.id === id);
    if (!s) return mat(snapshotLabel(dl, "S", id));
    const dong = getShipmentLines(dl, id);
    const materialTypeNames = [...new Set(dong.map((m) => m.materialTypeName || m.category).filter(Boolean))];
    const kg = dong.reduce((t, m) => t + (m.quantityKg || 0), 0);
    return {
      kind, id, nhan: formatMaterialLotLabel(s), moTa: materialTypeNames.join(", ") || "nguyên liệu",
      ngay: s.deliveryDate, xuong: s.workshop, kg, mat: false,
      chiTiet: [
        { nhan: "Đại lý", giaTri: s.supplierName || "—" },
        { nhan: "Ngày về", giaTri: formatDate(s.deliveryDate) },
        { nhan: "Xe · tài xế", giaTri: [s.licensePlate, s.driverName].filter(Boolean).join(" · ") || "—" },
        ...dong.map((m) => ({ nhan: m.materialTypeName || m.category, giaTri: kgChu(m.quantityKg || 0) })),
        ...(s.ssccCode ? [{ nhan: "SSCC", giaTri: s.ssccCode }] : []),
        ...(s.operator ? [{ nhan: "Người ghi", giaTri: s.operator }] : []),
      ],
    };
  }
  if (kind === "W") {
    const w = dl.wips.find((x) => x.id === id);
    if (!w) return mat(snapshotLabel(dl, "W", id));
    return {
      kind, id, nhan: formatWipLotLabel(w), moTa: productName(dl, w.productId),
      ngay: w.productionDate, xuong: w.workshop, kg: w.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Mặt hàng", giaTri: productName(dl, w.productId) },
        ...(w.spec ? [{ nhan: "Quy cách", giaTri: w.spec }] : []),
        { nhan: "Ngày sản xuất", giaTri: formatDate(w.productionDate) },
        { nhan: "Sản lượng", giaTri: `${kgChu(w.quantityKg || 0)}${w.blocksCount ? ` · ${w.blocksCount} block` : ""}` },
        ...(w.warehouse ? [{ nhan: "Kho", giaTri: w.warehouse }] : []),
        ...(w.processingType ? [{ nhan: "Kiểu chế biến", giaTri: w.processingType }] : []),
        ...(w.operator ? [{ nhan: "Người ghi", giaTri: w.operator }] : []),
      ],
    };
  }
  if (kind === "P") {
    const p = dl.packagings.find((x) => x.id === id);
    if (!p) return mat(snapshotLabel(dl, "P", id));
    return {
      kind, id, nhan: formatFinishedGoodLotLabel(p), moTa: productName(dl, p.toProductId),
      ngay: p.date, xuong: p.workshop, kg: p.outputKg || 0, mat: false,
      chiTiet: [
        { nhan: "Thành phẩm", giaTri: productName(dl, p.toProductId) },
        ...(p.toSpec ? [{ nhan: "Quy cách", giaTri: p.toSpec }] : []),
        { nhan: "Ngày đóng gói", giaTri: formatDate(p.date) },
        { nhan: "Ra", giaTri: `${kgChu(p.outputKg || 0)}${p.outputUnits ? ` · ${p.outputUnits} đơn vị` : ""}` },
        { nhan: "Từ BTP", giaTri: `${productName(dl, p.fromProductId)} · ${kgChu(p.inputKg || 0)}` },
        ...(p.warehouse ? [{ nhan: "Kho", giaTri: p.warehouse }] : []),
      ],
    };
  }
  if (kind === "B") {
    const b = (dl.salesItems ?? []).find((r) => r.id === id);
    if (!b) return mat(id);
    const salesInvoice = (dl.salesInvoices ?? []).find((v) => v.id === b.invoiceId);
    const customer = salesInvoice ? dl.customers.find((c) => c.id === salesInvoice.customerId) : undefined;
    const source = b.sourceWarehouse === FG_WAREHOUSE ? "đóng gói" : b.sourceWarehouse === RETAIL_WAREHOUSE ? "block thô" : b.sourceWarehouse;
    return {
      kind, id, nhan: `Bán ${formatDate(b.deliveryDate)} → ${customer?.name ?? "khách ?"}`,
      moTa: productName(dl, b.productId), ngay: b.deliveryDate, xuong: salesInvoice?.workshop ?? "", kg: b.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Khách", giaTri: customer ? `${customer.name}${customer.market ? ` (${customer.market})` : ""}` : "—" },
        { nhan: "Ngày giao", giaTri: formatDate(b.deliveryDate) },
        { nhan: "Mặt hàng", giaTri: `${productName(dl, b.productId)}${b.spec ? ` · ${b.spec}` : ""}` },
        { nhan: "Khối lượng", giaTri: kgChu(b.quantityKg || 0) },
        ...(source ? [{ nhan: "Nguồn", giaTri: source }] : []),
        ...(salesInvoice?.channel ? [{ nhan: "Kênh", giaTri: salesInvoice.channel }] : []),
      ],
    };
  }
  if (kind === "N") {
    const n = (dl.domesticSales ?? []).find((r) => r.id === id);
    if (!n) return mat(id);
    return {
      kind, id, nhan: `Bán NĐ ${formatDate(n.saleDate)} → ${n.customerName || "khách ?"}`,
      moTa: n.materialTypeName || "nguyên liệu", ngay: n.saleDate, xuong: n.workshop, kg: n.quantityKg || 0, mat: false,
      chiTiet: [
        { nhan: "Khách", giaTri: n.customerName || "—" },
        { nhan: "Ngày bán", giaTri: formatDate(n.saleDate) },
        { nhan: "Loại NL", giaTri: n.materialTypeName || "—" },
        { nhan: "Khối lượng", giaTri: kgChu(n.quantityKg || 0) },
        ...(n.operator ? [{ nhan: "Người ghi", giaTri: n.operator }] : []),
      ],
    };
  }
  // X — một dòng lệnh xuất
  const x = dl.exportItems.find((e) => e.id === id);
  if (!x) return mat(id);
  const exportOrder = dl.exportOrders.find((o) => o.id === x.exportId);
  const don = exportOrder ? dl.salesOrders.find((o) => o.id === exportOrder.orderId) : undefined;
  const customer = don ? dl.customers.find((c) => c.id === don.customerId) : undefined;
  return {
    kind, id, nhan: `Xuất ${formatDate(exportOrder?.exportDate)} → ${customer?.name ?? "khách ?"}`,
    moTa: productName(dl, x.productId), ngay: exportOrder?.exportDate ?? "", xuong: "", kg: x.quantityKg || 0, mat: false,
    chiTiet: [
      { nhan: "Khách", giaTri: customer ? `${customer.name}${customer.market ? ` (${customer.market})` : ""}` : "—" },
      { nhan: "Ngày xuất", giaTri: formatDate(exportOrder?.exportDate) },
      { nhan: "Khối lượng", giaTri: `${kgChu(x.quantityKg || 0)}${x.blocksCount ? ` · ${x.blocksCount} block` : ""}` },
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
export function findLots(ma: ScannedCode, dl: TraceData): LotNode[] {
  // QR cũ `S:<id chuyến>` (trước khi tách lô theo loại) ⇒ trả các lô loại NL của chuyến để chọn.
  if ("kind" in ma && ma.kind === "S" && !dl.imports.some((m) => m.id === ma.id)) {
    const dong = getShipmentLines(dl, ma.id);
    if (dong.length) return dong.map((m) => buildLotNode("S", m.id, dl));
  }
  if ("kind" in ma) {
    const n = buildLotNode(ma.kind, ma.id, dl);
    const hasTrace =
      dl.lotInputs.some((l) => l.inputId === ma.id || l.outputId === ma.id) ||
      (dl.lotDispatches ?? []).some((d) => d.lotKind === ma.kind && d.lotId === ma.id);
    return n.mat && !hasTrace ? [] : [n];
  }
  const k = normalizeCode(ma.ma);
  return [
    // Mã lô in trên tem là mã CHUYẾN ⇒ trả mọi lô loại NL của chuyến đó cho người chọn.
    ...dl.shipments.filter((s) => normalizeCode(formatMaterialLotLabel(s)) === k).flatMap((s) => getShipmentLines(dl, s.id).map((m) => buildLotNode("S", m.id, dl))),
    ...dl.wips.filter((w) => normalizeCode(formatWipLotLabel(w)) === k).map((w) => buildLotNode("W", w.id, dl)),
    ...dl.packagings.filter((p) => normalizeCode(formatFinishedGoodLotLabel(p)) === k).map((p) => buildLotNode("P", p.id, dl)),
  ];
}

/**
 * Một mã ra NHIỀU lô thì nói đúng lý do: là các LOẠI NL của cùng một chuyến (gõ mã
 * chuyến / quét QR cũ theo chuyến — ca thường ngày từ khi lô NL tách theo loại) hay
 * mã cũ trùng thật giữa các bản ghi khác nhau. `cungChuyen` = ca thứ nhất.
 */
export function explainMultipleLots(ma: string, items: readonly LotNode[], dl: Pick<TraceData, "imports">): { cau: string; cungChuyen: boolean } {
  const shipments = new Set(items.map((n) => (n.kind === "S" ? dl.imports.find((m) => m.id === n.id)?.shipmentId : undefined)));
  const isSameShipment = items.length > 1 && items.every((n) => n.kind === "S") && shipments.size === 1 && !shipments.has(undefined);
  return isSameShipment
    ? { cau: `Chuyến ${items[0]!.nhan} có ${items.length} loại nguyên liệu, mỗi loại là một lô — chọn đúng loại`, cungChuyen: isSameShipment }
    : { cau: `Mã "${ma.trim()}" trùng ${items.length} lô — chọn đúng lô`, cungChuyen: isSameShipment };
}

// ---------- Cây gia phả lô ----------

export interface TraceBranch {
  nut: LotNode;
  /** kg của mối nối (đầu vào đã dùng / đầu ra đã nhận). null = chưa cân. */
  kg: number | null;
  con: TraceBranch[];
}

/**
 * Truy NGƯỢC: lô này làm từ những lô nào (nhiều tầng: TP → BTP → NL).
 * `sau` giới hạn độ sâu; `daQua` chặn vòng lặp nếu dữ liệu nhập sai thành vòng.
 */
export function traceBackward(kind: TraceNodeKind, id: string, dl: TraceData, depth = 5, visited = new Set<string>()): TraceBranch[] {
  if (depth <= 0 || (kind !== "W" && kind !== "P")) return [];
  const key = `${kind}:${id}`;
  if (visited.has(key)) return [];
  visited.add(key);
  return dl.lotInputs
    .filter((l) => l.outputKind === kind && l.outputId === id)
    .map((l) => ({
      nut: buildLotNode(l.inputKind, l.inputId, dl),
      kg: l.quantityKg,
      con: traceBackward(l.inputKind, l.inputId, dl, depth - 1, visited),
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
export function traceForward(kind: TraceNodeKind, id: string, dl: TraceData, depth = 5, visited = new Set<string>()): TraceBranch[] {
  if (depth <= 0 || isOutboundKind(kind)) return [];
  const key = `${kind}:${id}`;
  if (visited.has(key)) return [];
  visited.add(key);
  const viaTransform: TraceBranch[] =
    kind === "P"
      ? []
      : dl.lotInputs
          .filter((l) => l.inputKind === kind && l.inputId === id)
          .map((l) => ({
            nut: buildLotNode(l.outputKind, l.outputId, dl),
            kg: l.quantityKg,
            con: traceForward(l.outputKind, l.outputId, dl, depth - 1, visited),
          }));
  const viaExport: TraceBranch[] =
    kind === "W"
      ? dl.exportItems
          .filter((x) => x.wipId === id)
          .map((x) => ({ nut: buildLotNode("X", x.id, dl), kg: x.quantityKg || 0, con: [] }))
      : [];
  const viaSales: TraceBranch[] = (dl.lotDispatches ?? [])
    .filter((d) => isLeavingFactory(d) && d.lotKind === kind && d.lotId === id)
    .map((d) => ({ nut: buildLotNode(d.docKind === "domestic_sale" ? "N" : "B", d.docId, dl), kg: d.quantityKg, con: [] }));
  return [...viaTransform, ...viaExport, ...viaSales];
}

// ---------- Cân bằng khối lượng ----------

export interface CanBang {
  /** kg của lô (nhận / sản xuất). */
  vao: number;
  /** các ngả đã đi, có kg. */
  ra: { nhan: string; kg: number }[];
  /** số lần gắn lô chưa ghi kg — cân bằng chưa đầy đủ. */
  chuaCan: number;
  /** vao − Σ ra. Âm = dùng/xuất quá số có ⇒ nghi sai số hoặc gắn nhầm lô. */
  con: number;
}

/**
 * Cân bằng khối lượng theo lô (theo HỒ SƠ LÔ — chỉ cộng các mối nối có kg):
 *   NL : nhận ↔ đưa vào SX + bán nội địa
 *   BTP: sản xuất ↔ đóng gói + xuất theo lệnh + bán lẻ block thô
 *   TP : đóng gói ra ↔ bán lẻ
 */
export function computeLotMassBalance(kind: TraceNodeKind, id: string, dl: TraceData): CanBang | null {
  if (kind !== "S" && kind !== "W" && kind !== "P") return null;
  const n = buildLotNode(kind, id, dl);
  if (n.mat) return null;
  const ra: CanBang["ra"] = [];
  let unbalancedCount = 0;
  const addLine = (label: string, kgs: (number | null)[]) => {
    const co = kgs.filter((k): k is number => k != null);
    unbalancedCount += kgs.length - co.length;
    if (co.length) ra.push({ nhan: label, kg: co.reduce((s, k) => s + k, 0) });
  };
  if (kind !== "P") {
    addLine(
      kind === "S" ? "Đã đưa vào sản xuất" : "Đã đóng gói",
      dl.lotInputs.filter((l) => l.inputKind === kind && l.inputId === id).map((l) => l.quantityKg)
    );
  }
  if (kind === "W") {
    const exportItems = dl.exportItems.filter((x) => x.wipId === id);
    if (exportItems.length) ra.push({ nhan: "Đã xuất theo lệnh", kg: exportItems.reduce((t, x) => t + (x.quantityKg || 0), 0) });
  }
  const ban = (dl.lotDispatches ?? []).filter((d) => isLeavingFactory(d) && d.lotKind === kind && d.lotId === id);
  addLine(kind === "S" ? "Bán nội địa" : kind === "W" ? "Bán lẻ block thô" : "Bán lẻ", ban.map((d) => d.quantityKg));
  const totalOut = ra.reduce((t, r) => t + r.kg, 0);
  return { vao: n.kg, ra, chuaCan: unbalancedCount, con: n.kg - totalOut };
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
export function buildLotStockIndex(dl: TraceData): LotStockIndex {
  const wipStock = computeWipStock(
    [...dl.wips],
    [...dl.exportItems],
    collectWipDeductions([...(dl.salesItems ?? [])], [...dl.packagings], dl.lotInputs, dl.lotDispatches ?? [])
  );
  const finishedGoods = computeFinishedGoodLotStock([...dl.packagings], filterRetailSales([...(dl.salesItems ?? [])], FG_WAREHOUSE, dl.lotDispatches ?? []));
  return { W: new Map(wipStock.map((l) => [l.wipId, l.conLai])), P: new Map(finishedGoods.map((l) => [l.wipId, l.conLai])) };
}

/**
 * Kg CÒN TRONG KHO của lô theo SỔ TỒN (khác cân bằng theo hồ sơ lô: sổ tồn trừ cả
 * dòng bán/đóng gói CHƯA gắn lô theo FIFO). BTP chưa duyệt nhập kho ⇒ null.
 * NL ⇒ null (tồn NL theo lô chưa có — doc 38).
 * Tra nhiều lô ⇒ truyền `bang` dựng sẵn bằng `buildLotStockIndex(dl)` (không thì dựng lại mỗi lần).
 */
export function getLotStockKg(kind: TraceNodeKind, id: string, dl: TraceData, bang?: LotStockIndex): number | null {
  if (kind !== "W" && kind !== "P") return null;
  return (bang ?? buildLotStockIndex(dl))[kind].get(id) ?? null;
}

// ---------- Danh sách lô để CHỌN khi gắn ----------

/** Lùi `ngay` ngày lịch. Tính hết bằng UTC (như `getPeriodDates`) — giờ máy +07 mà đọc
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
export function listSelectableMaterialLots(dl: TraceData, workshop: Workshop, toDate: string, days = 45): LotNode[] {
  const tu = lui(toDate, days);
  const linesOf = (items: ImportShipment[]) => items.flatMap((s) => getShipmentLines(dl, s.id).map((m) => ({ s, m })));
  const recentLots = linesOf(
    dl.shipments
      .filter((s) => s.workshop === workshop && s.deliveryDate >= tu && s.deliveryDate <= toDate)
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id))
  );
  const batDau = dl.lotInputs.reduce<string>((m, l) => (!m || (l.recordedAt && l.recordedAt < m) ? l.recordedAt : m), "").slice(0, 10);
  const assigned = new Set(dl.lotInputs.filter((l) => l.inputKind === "S").map((l) => l.inputId));
  const oneYearAgo = lui(toDate, 365);
  const olderOpenLots = linesOf(
    dl.shipments
      .filter((s) => s.workshop === workshop && s.deliveryDate < tu && s.deliveryDate >= oneYearAgo)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.id.localeCompare(b.id))
  ).filter(
    ({ s, m }) =>
      (assigned.has(m.id) || (!!batDau && s.deliveryDate >= batDau)) && (computeLotMassBalance("S", m.id, dl)?.con ?? 0) > 0
  );
  return [...recentLots, ...olderOpenLots].map(({ m }) => buildLotNode("S", m.id, dl));
}

/** Lô BTP gần đây để chọn khi gắn cho phiếu đóng gói: cùng xưởng (hàng đông trữ lâu ⇒ cửa sổ rộng). */
export function listSelectableWipLots(dl: TraceData, workshop: Workshop, toDate: string, days = 120, productId?: string): LotNode[] {
  const tu = lui(toDate, days);
  return dl.wips
    .filter((w) => w.workshop === workshop && w.productionDate >= tu && w.productionDate <= toDate)
    .sort(
      (a, b) =>
        Number(b.productId === productId) - Number(a.productId === productId) ||
        b.productionDate.localeCompare(a.productionDate)
    )
    .map((w) => buildLotNode("W", w.id, dl));
}

// ---------- Danh sách lô để IN TEM hàng loạt ----------

export interface LabelPrintFilter {
  /** yyyy-mm-dd, tính cả hai đầu. */
  tu: string;
  den: string;
  /** "" = mọi xưởng. */
  xuong: Workshop | "";
  /** Loại lô cần in; rỗng ⇒ không lô nào. */
  loai: readonly LotKind[];
}

const KIND_ORDER: Record<LotKind, number> = { S: 0, W: 1, P: 2 };

/**
 * Mọi lô (NL · BTP · TP) trong khoảng ngày để in tem một lượt — MỚI trước, cùng
 * ngày thì theo chuỗi NL → BTP → TP. Ngày của lô: ngày hàng về · ngày SX · ngày đóng gói.
 */
export function listLotsToPrint(dl: TraceData, filter: LabelPrintFilter): LotNode[] {
  const isWithin = (date: string, workshop: Workshop) =>
    date >= filter.tu && date <= filter.den && (!filter.xuong || workshop === filter.xuong);
  const co = (k: LotKind) => filter.loai.includes(k);
  return [
    ...(co("S")
      ? dl.shipments.filter((s) => isWithin(s.deliveryDate, s.workshop)).flatMap((s) => getShipmentLines(dl, s.id).map((m) => buildLotNode("S", m.id, dl)))
      : []),
    ...(co("W") ? dl.wips.filter((w) => isWithin(w.productionDate, w.workshop)).map((w) => buildLotNode("W", w.id, dl)) : []),
    ...(co("P") ? dl.packagings.filter((p) => isWithin(p.date, p.workshop)).map((p) => buildLotNode("P", p.id, dl)) : []),
  ].sort(
    (a, b) =>
      b.ngay.localeCompare(a.ngay) ||
      KIND_ORDER[a.kind as LotKind] - KIND_ORDER[b.kind as LotKind] ||
      a.nhan.localeCompare(b.nhan)
  );
}

// ---------- Sổ in tem (mig 0049) ----------

export const lotKey = (kind: LotKind, id: string) => `${kind}:${id}`;

export interface LabelPrintSummary {
  /** số lượt bấm In */
  lan: number;
  /** tổng số tem đã in */
  tem: number;
  /** lượt in gần nhất */
  cuoi: LabelPrint;
}

/** Gom sổ in tem theo lô: khóa `loại:id` → số lượt, số tem, lần in gần nhất. */
export function summarizeLabelPrints(prints: readonly LabelPrint[]): Map<string, LabelPrintSummary> {
  const m = new Map<string, LabelPrintSummary>();
  for (const p of prints) {
    const k = lotKey(p.lotKind, p.lotId);
    const prev = m.get(k);
    if (!prev) m.set(k, { lan: 1, tem: p.copies, cuoi: p });
    else
      m.set(k, {
        lan: prev.lan + 1,
        tem: prev.tem + p.copies,
        cuoi: p.printedAt > prev.cuoi.printedAt ? p : prev.cuoi,
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
    .filter((n): n is LotNode & { kind: LotKind } => !isOutboundKind(n.kind) && !n.mat)
    .map((n) => ({
      id: newId(), lotKind: n.kind, lotId: n.id, label: n.nhan,
      copies: Math.max(1, Math.round(countLabels(n) || 1)), operator: printedBy, printedAt: luc,
    }));
}

// ---------- Gắn lô NL cho CẢ PHIÊN ghi sản xuất (đợt 2b) ----------

const normalize = (s: string | undefined) => (s ?? "").normalize("NFC").trim().toLowerCase();

/** Họ NL của một lô NL: tên loại NL + loài (category). Lô = một dòng; mã cũ theo chuyến ⇒ mọi dòng. */
function materialLotFamily(dl: TraceData, loId: string) {
  const importRow = dl.imports.find((m) => m.id === loId);
  const dong = importRow ? [importRow] : dl.imports.filter((m) => m.shipmentId === loId);
  const ten = new Set(dong.map((m) => normalize(m.materialTypeName)).filter(Boolean));
  const materialType = new Set(
    dong
      .flatMap((m) => [m.category, (dl.materialTypes ?? []).find((t) => normalize(t.name) === normalize(m.materialTypeName))?.category])
      .map((x) => normalize(x))
      .filter(Boolean)
  );
  return { ten, loai: materialType };
}

/** Tên loại NL gắn trên mặt hàng của mẻ ("" = mặt hàng chưa gắn loại NL). */
function batchMaterialName(dl: TraceData, w: Pick<WipProductionItem, "productId">): string {
  const p = dl.products.find((x) => x.id === w.productId);
  return normalize((dl.materialTypes ?? []).find((t) => t.id === p?.materialTypeId)?.name);
}

/** Loài của mặt hàng một mẻ ("" = không rõ): category mặt hàng, rồi tới loài của loại NL gắn trên mặt hàng. */
function materialTypeOfBatch(dl: TraceData, w: Pick<WipProductionItem, "productId">): string {
  const p = dl.products.find((x) => x.id === w.productId);
  if (!p) return "";
  return normalize(p.category) || normalize((dl.materialTypes ?? []).find((t) => t.id === p.materialTypeId)?.category);
}

export interface SessionLotInputResult {
  lotInputs: LotInput[];
  dispatches: LotDispatch[];
  /** Mẻ / dòng bán nội địa không khớp họ NL với lô nào của phiên — để người ghi tự gắn. */
  khongKhop: { kind: "W" | "N"; id: string }[];
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
  mes: readonly Pick<WipProductionItem, "id" | "productId">[];
  banNoiDia: readonly Pick<DomesticSaleItem, "id" | "materialTypeName">[];
  loNl: readonly { nut: LotNode; cach: LotInput["method"] }[];
  dl: TraceData;
  nguoiGhi: string;
  luc: string;
  taoId: () => string;
}): SessionLotInputResult {
  const lots = a.loNl.filter((l) => l.nut.kind === "S" && !l.nut.mat).map((l) => ({ ...l, ho: materialLotFamily(a.dl, l.nut.id) }));
  const lotInputs: LotInput[] = [];
  const dispatches: LotDispatch[] = [];
  const unmatched: SessionLotInputResult["khongKhop"] = [];
  if (!lots.length) return { lotInputs, dispatches, khongKhop: unmatched };

  for (const me of a.mes) {
    const materialType = materialTypeOfBatch(a.dl, me);
    const materialName = batchMaterialName(a.dl, me);
    const sameTypeLots = materialName ? lots.filter((l) => l.ho.ten.has(materialName)) : [];
    const hop = sameTypeLots.length ? sameTypeLots : lots.filter((l) => !materialType || l.ho.loai.size === 0 || l.ho.loai.has(materialType));
    if (!hop.length) unmatched.push({ kind: "W", id: me.id });
    for (const l of hop) {
      if (a.dl.lotInputs.some((x) => x.outputKind === "W" && x.outputId === me.id && x.inputKind === "S" && x.inputId === l.nut.id)) continue;
      lotInputs.push({
        id: a.taoId(), outputKind: "W", outputId: me.id, inputKind: "S", inputId: l.nut.id,
        inputLabel: l.nut.nhan, material: l.nut.moTa, quantityKg: null, method: l.cach,
        operator: a.nguoiGhi, recordedAt: a.luc,
      });
    }
  }
  for (const b of a.banNoiDia) {
    const ten = normalize(b.materialTypeName);
    const materialType = normalize((a.dl.materialTypes ?? []).find((t) => normalize(t.name) === ten)?.category);
    const sameTypeLots = lots.filter((l) => l.ho.ten.has(ten));
    const hop = sameTypeLots.length ? sameTypeLots : lots.filter((l) => !!materialType && l.ho.loai.has(materialType));
    if (!hop.length) unmatched.push({ kind: "N", id: b.id });
    for (const l of hop) {
      if ((a.dl.lotDispatches ?? []).some((x) => x.docKind === "domestic_sale" && x.docId === b.id && x.lotId === l.nut.id)) continue;
      dispatches.push({
        id: a.taoId(), lotKind: "S", lotId: l.nut.id, lotLabel: l.nut.nhan, docKind: "domestic_sale", docId: b.id,
        quantityKg: null, method: l.cach, operator: a.nguoiGhi, recordedAt: a.luc,
      });
    }
  }
  return { lotInputs, dispatches, khongKhop: unmatched };
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

export type TraceStageKey = "nhap" | "san-xuat" | "kho" | "dong-goi" | "xuat-ban";

/** Việc còn thiếu ở một mục: in tem · gắn lô · duyệt nhập kho · quét kiểm khi xếp xe. */
export type MissingTask = "tem" | "lo" | "duyet" | "quet";

export interface TraceStageItem {
  /** Lô (S/W/P) hoặc dòng hàng ra (X lệnh xuất · B bán lẻ · N bán nội địa). */
  nut: LotNode;
  /** Số tem đã in (lô S/W/P); undefined = không áp dụng. */
  daIn?: number;
  /** Số lô đầu vào đã gắn (W: lô NL · P: lô BTP) hoặc lô đã gắn cho hàng ra (B/N). */
  soLo?: number;
  /** W/P chưa gắn lô nhưng đã ghi lý do khi chốt ngày. */
  lyDo?: string;
  /** S: số mẻ / dòng bán nội địa đã dùng lô này. */
  daDung?: number;
  /** W: trạng thái kho. */
  kho?: "cho-nhap" | "da-nhap";
  /** Tồn trong kho theo sổ tồn (W đã nhập, P). */
  ton?: number | null;
  /** X: đã quét kiểm khi xếp xe. */
  daQuet?: boolean;
  /** X: lệnh xuất + đơn của dòng — để mở thẳng hộp kiểm lô. */
  lenhId?: string;
  donId?: string;
  /** B: lô gắn cho dòng bán lẻ là BTP (block thô) hay TP (đóng gói). */
  loaiLoBan?: "W" | "P";
  thieu: MissingTask[];
}

export interface TraceStage {
  khoa: TraceStageKey;
  ten: string;
  muc: TraceStageItem[];
}

/**
 * Chuỗi truy xuất xếp theo GIAI ĐOẠN (nhập NL → sản xuất → kho → đóng gói → xuất/bán)
 * cho một khoảng ngày × xưởng: mỗi lô / dòng hàng ra kèm trạng thái (tem, lô đã gắn,
 * kho, quét kiểm) và VIỆC CÒN THIẾU — để kiểm QR từng khâu ở MỘT chỗ thay vì đi 7 màn.
 * Ngày của mục: ngày hàng về · ngày SX · ngày đóng gói · ngày xuất / bán.
 */
export function groupByTraceStage(dl: TraceData, filter: { tu: string; den: string; xuong: Workshop | "" }): TraceStage[] {
  const isWithin = (date: string, workshop: Workshop | "" | undefined) =>
    !!date && date >= filter.tu && date <= filter.den && (!filter.xuong || workshop === filter.xuong);
  const disp = dl.lotDispatches ?? [];
  const waivers = dl.lotWaivers ?? [];
  const daIn = summarizeLabelPrints(dl.labelPrints ?? []);
  const countLabels = (k: LotKind, id: string) => daIn.get(lotKey(k, id))?.tem ?? 0;
  const waiverReason = (k: "W" | "P", id: string) => waivers.find((x) => x.outputKind === k && x.outputId === id)?.reason;
  const countInputLots = (k: "W" | "P", id: string) => dl.lotInputs.filter((l) => l.outputKind === k && l.outputId === id).length;
  const countDispatchLots = (doc: LotDispatch["docKind"], id: string) => disp.filter((d) => d.docKind === doc && d.docId === id).length;
  const missingLotLabels = (labelCount: number, lo: number, hasReason: boolean): MissingTask[] => [
    ...(lo === 0 && !hasReason ? (["lo"] as const) : []),
    ...(labelCount === 0 ? (["tem"] as const) : []),
  ];
  const newestFirst = <T extends { nut: LotNode }>(a: T, b: T) => b.nut.ngay.localeCompare(a.nut.ngay) || a.nut.nhan.localeCompare(b.nut.nhan);
  const lotStockTable = buildLotStockIndex(dl); // một lượt cho mọi lô — không tính lại sổ tồn từng dòng

  const importStages: TraceStageItem[] = dl.shipments
    .filter((s) => isWithin(s.deliveryDate, s.workshop))
    .flatMap((s) => getShipmentLines(dl, s.id))
    .map((m) => {
      const labelCount = countLabels("S", m.id);
      const expected =
        new Set(dl.lotInputs.filter((l) => l.inputKind === "S" && l.inputId === m.id).map((l) => l.outputId)).size +
        disp.filter((d) => d.lotKind === "S" && d.lotId === m.id && d.docKind === "domestic_sale").length;
      return { nut: buildLotNode("S", m.id, dl), daIn: labelCount, daDung: expected, thieu: labelCount === 0 ? (["tem"] as MissingTask[]) : [] };
    })
    .sort(newestFirst);

  const mes = dl.wips.filter((w) => isWithin(w.productionDate, w.workshop));
  const wips: TraceStageItem[] = mes
    .map((w) => {
      const labelCount = countLabels("W", w.id);
      const lo = countInputLots("W", w.id);
      const ld = waiverReason("W", w.id);
      return { nut: buildLotNode("W", w.id, dl), daIn: labelCount, soLo: lo, lyDo: ld, kho: w.status, thieu: missingLotLabels(labelCount, lo, !!ld) };
    })
    .sort(newestFirst);

  const warehouse: TraceStageItem[] = mes
    .map((w) => ({
      nut: buildLotNode("W", w.id, dl),
      kho: w.status,
      ton: w.status === "da-nhap" ? getLotStockKg("W", w.id, dl, lotStockTable) : null,
      daIn: countLabels("W", w.id),
      thieu: w.status === "cho-nhap" ? (["duyet"] as MissingTask[]) : [],
    }))
    .sort((a, b) => Number(b.kho === "cho-nhap") - Number(a.kho === "cho-nhap") || newestFirst(a, b));

  const packagingStages: TraceStageItem[] = dl.packagings
    .filter((p) => isWithin(p.date, p.workshop))
    .map((p) => {
      const labelCount = countLabels("P", p.id);
      const lo = countInputLots("P", p.id);
      const ld = waiverReason("P", p.id);
      return { nut: buildLotNode("P", p.id, dl), daIn: labelCount, soLo: lo, lyDo: ld, ton: getLotStockKg("P", p.id, dl, lotStockTable), thieu: missingLotLabels(labelCount, lo, !!ld) };
    })
    .sort(newestFirst);

  const exportOrder = new Map(dl.exportOrders.map((o) => [o.id, o]));
  const workshopByWip = new Map(dl.wips.map((w) => [w.id, w.workshop]));
  const salesInvoiceById = new Map((dl.salesInvoices ?? []).map((v) => [v.id, v]));
  const salesOutStages: TraceStageItem[] = [
    ...dl.exportItems
      .filter((x) => isWithin(exportOrder.get(x.exportId)?.exportDate ?? "", workshopByWip.get(x.wipId)))
      .map((x) => {
        const isScanned = countDispatchLots("export_item", x.id) > 0;
        return { nut: buildLotNode("X", x.id, dl), daQuet: isScanned, lenhId: x.exportId, donId: exportOrder.get(x.exportId)?.orderId, thieu: isScanned ? [] : (["quet"] as MissingTask[]) };
      }),
    ...(dl.salesItems ?? [])
      .filter((b) => (b.sourceWarehouse === RETAIL_WAREHOUSE || b.sourceWarehouse === FG_WAREHOUSE) && isWithin(b.deliveryDate, salesInvoiceById.get(b.invoiceId)?.workshop))
      .map((b) => {
        const lo = countDispatchLots("sales_item", b.id);
        return { nut: buildLotNode("B", b.id, dl), soLo: lo, loaiLoBan: (b.sourceWarehouse === FG_WAREHOUSE ? "P" : "W") as "W" | "P", thieu: lo ? [] : (["lo"] as MissingTask[]) };
      }),
    ...(dl.domesticSales ?? [])
      .filter((n) => isWithin(n.saleDate, n.workshop))
      .map((n) => {
        const lo = countDispatchLots("domestic_sale", n.id);
        return { nut: buildLotNode("N", n.id, dl), soLo: lo, thieu: lo ? [] : (["lo"] as MissingTask[]) };
      }),
  ].sort(newestFirst);

  return [
    { khoa: "nhap", ten: "Nhập nguyên liệu", muc: importStages },
    { khoa: "san-xuat", ten: "Sản xuất bán thành phẩm", muc: wips },
    { khoa: "kho", ten: "Nhập kho dự trữ", muc: warehouse },
    { khoa: "dong-goi", ten: "Đóng gói thành phẩm", muc: packagingStages },
    { khoa: "xuat-ban", ten: "Xuất theo đơn & bán", muc: salesOutStages },
  ];
}

// ---------- Danh sách thu hồi (đợt 2b) ----------

export interface RecallRow {
  loai: "X" | "B" | "N";
  /** id dòng hàng ra (lệnh xuất / bán lẻ / bán nội địa) — để bỏ trùng khi gộp nhiều lô. */
  id: string;
  khach: string;
  ngay: string;
  chungTu: string;
  matHang: string;
  /** kg của mối nối (đi ra từ lô liền trước); null = chưa cân. */
  kg: number | null;
  /** nhãn lô liền trước — hàng rời xưởng từ lô này */
  tuLo: string;
}

/**
 * Lô này nghi có vấn đề ⇒ ai đã nhận hàng (khách · ngày · chứng từ · kg) và
 * những lô BTP/TP còn trong xưởng cần khoanh lại. Đi hết cây truy xuôi.
 */
export function buildRecallList(kind: TraceNodeKind, id: string, dl: TraceData): { hangRa: RecallRow[]; loTrongXuong: LotNode[] } {
  const recallRows: RecallRow[] = [];
  const lotsInPlant: LotNode[] = [];
  const root = buildLotNode(kind, id, dl);
  if (root.kind === "W" || root.kind === "P") lotsInPlant.push(root);
  const exportCustomer = (xId: string) => {
    const x = dl.exportItems.find((e) => e.id === xId);
    const exportOrder = x ? dl.exportOrders.find((o) => o.id === x.exportId) : undefined;
    const don = exportOrder ? dl.salesOrders.find((o) => o.id === exportOrder.orderId) : undefined;
    return { khach: dl.customers.find((c) => c.id === don?.customerId)?.name ?? "", ngay: exportOrder?.exportDate ?? "" };
  };
  const salesCustomer = (bId: string) => {
    const b = (dl.salesItems ?? []).find((r) => r.id === bId);
    const salesInvoice = b ? (dl.salesInvoices ?? []).find((v) => v.id === b.invoiceId) : undefined;
    return dl.customers.find((c) => c.id === salesInvoice?.customerId)?.name ?? "";
  };
  const di = (tree: TraceBranch[], parent: LotNode) => {
    for (const nh of tree) {
      const n = nh.nut;
      if (n.kind === "X") {
        const k = exportCustomer(n.id);
        recallRows.push({ loai: "X", id: n.id, khach: k.khach, ngay: k.ngay, chungTu: `Lệnh xuất ${formatDate(k.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: parent.nhan });
      } else if (n.kind === "B") {
        recallRows.push({ loai: "B", id: n.id, khach: salesCustomer(n.id), ngay: n.ngay, chungTu: `Phiếu bán ${formatDate(n.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: parent.nhan });
      } else if (n.kind === "N") {
        const r = (dl.domesticSales ?? []).find((x) => x.id === n.id);
        recallRows.push({ loai: "N", id: n.id, khach: r?.customerName ?? "", ngay: n.ngay, chungTu: `Bán nội địa ${formatDate(n.ngay)}`, matHang: n.moTa, kg: nh.kg, tuLo: parent.nhan });
      } else {
        if ((n.kind === "W" || n.kind === "P") && !lotsInPlant.some((l) => l.kind === n.kind && l.id === n.id)) lotsInPlant.push(n);
        di(nh.con, n);
      }
    }
  };
  di(traceForward(kind, id, dl), root);
  recallRows.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.khach.localeCompare(b.khach));
  return { hangRa: recallRows, loTrongXuong: lotsInPlant };
}

/** Các lô NL CÙNG CHUYẾN với lô này (gồm chính nó) — để xem / thu hồi gộp theo chuyến. */
export function findSameShipmentLots(id: string, dl: TraceData): LotNode[] {
  const m = dl.imports.find((x) => x.id === id);
  return m ? getShipmentLines(dl, m.shipmentId).map((x) => buildLotNode("S", x.id, dl)) : [];
}

/**
 * Thu hồi GỘP nhiều lô (vd mọi loại NL của một chuyến): nối danh sách của từng lô,
 * mỗi dòng hàng ra chỉ một lần (lấy lần gặp đầu), lô trong xưởng cũng bỏ trùng.
 */
export function buildRecallListForLots(items: readonly LotNode[], dl: TraceData): { hangRa: RecallRow[]; loTrongXuong: LotNode[] } {
  const recallRows: RecallRow[] = [];
  const lotsInPlant: LotNode[] = [];
  for (const n of items) {
    const result = buildRecallList(n.kind, n.id, dl);
    for (const r of result.hangRa) if (!recallRows.some((x) => x.loai === r.loai && x.id === r.id)) recallRows.push(r);
    for (const l of result.loTrongXuong) if (!lotsInPlant.some((x) => x.kind === l.kind && x.id === l.id)) lotsInPlant.push(l);
  }
  recallRows.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.khach.localeCompare(b.khach));
  return { hangRa: recallRows, loTrongXuong: lotsInPlant };
}

// ---------- Số tem mặc định (đợt 2b) ----------

/** Mỗi block (BTP) / mỗi thùng-gói (TP) một tem; NL một tem cho chuyến. Sửa được khi in. */
export function getDefaultLabelCount(n: Pick<LotNode, "kind" | "id">, dl: Pick<TraceData, "wips" | "packagings">): number {
  const so =
    n.kind === "W" ? dl.wips.find((w) => w.id === n.id)?.blocksCount :
    n.kind === "P" ? dl.packagings.find((p) => p.id === n.id)?.outputUnits :
    1;
  return Math.min(500, Math.max(1, Math.round(so || 1)));
}
