// ============================================================
// Tên file: src/lib/dataFlow.ts
// Tên tiếng Việt: Dòng chảy số liệu toàn chuỗi (nhập → SX → kho → đóng gói → bán)
// Description: Pure aggregations for the flow dashboard — sankey kg, 5-stage
//              pipeline, daily stock series, per-product norm, chain alerts.
// ============================================================
/**
 * Gom số cho màn Tổng quan "Dòng chảy số liệu" (spec docs/spec/che-do-demo.md §5b).
 * Hàm THUẦN: nhận dữ liệu qua tham số, không đọc/ghi repo. Tồn đi qua engine sẵn
 * có (`computeFinishedGoodNxt`, `computeFinishedGoodStock`, `computeWipStockDetail`, `groupByTraceStage`) để con số khớp
 * các màn chuyên biệt. CHỈ CỘNG KG — không cộng tiền khác tiền tệ (XK USD ≠ NĐ VND).
 */
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  DailyLock,
  FinishedGoodsOpeningStock,
  MaterialOpeningStock,
  QcResult,
  ScrapItem,
  Workshop,
} from "@/types";
import { isBackdatedImport, isBackdatedWip } from "@/types";
import { RETAIL_WAREHOUSE, FG_WAREHOUSE, filterRetailSales, computeWipStockDetail, computeFinishedGoodStock, collectWipDeductions } from "@/lib/inventory";
import { computeFinishedGoodNxt, sumFinishedGoodNxt } from "@/lib/inventoryFinished";
import { groupByTraceStage, type TraceData, type TraceStageKey } from "@/lib/lotTraceability";
import { calculateBalancing, type BalancingResult } from "@/lib/balancingCalc";

/** Mọi bảng màn Dòng chảy cần — TraceData + các sổ chốt/cân đối/tồn đầu. */
export interface DataFlowInput extends TraceData {
  scraps: readonly ScrapItem[];
  dailyLocks: readonly DailyLock[];
  productionLocks: readonly DailyLock[];
  periods: readonly BalancingPeriod[];
  balancingInputs: readonly BalancingInputItem[];
  balancingOutputs: readonly BalancingOutputItem[];
  materialOpening: readonly MaterialOpeningStock[];
  finishedOpening: readonly FinishedGoodsOpeningStock[];
}

export interface FlowRange {
  fromDate: string;
  toDate: string;
  /** Rỗng / undefined = cả 3 xưởng. */
  workshop?: Workshop | "";
}

/** Ngưỡng định mức lệch so với bình quân (chủ dự án chốt 2026-10-12: ±5%). */
export const YIELD_RATIO_THRESHOLD = 0.05;
/** BTP chờ duyệt nhập kho quá số ngày này thì cảnh báo. */
export const APPROVAL_WAIT_DAYS = 3;

const isInRange = (date: string | undefined, k: FlowRange) => !!date && date >= k.fromDate && date <= k.toDate;
const matchesWorkshop = (x: Workshop | "" | undefined, k: FlowRange) => !k.workshop || x === k.workshop;
const sum = <T>(items: readonly T[], lay: (x: T) => number) => items.reduce((s, x) => s + (lay(x) || 0), 0);

/** Các ngày yyyy-mm-dd từ `tu` tới `den` (gồm cả hai đầu), theo lịch UTC cho khỏi lệch múi giờ. */
export function listDatesInRange(tu: string, den: string): string[] {
  const ra: string[] = [];
  if (!tu || !den || tu > den) return ra;
  const d = new Date(`${tu}T00:00:00Z`);
  const last = new Date(`${den}T00:00:00Z`).getTime();
  while (d.getTime() <= last && ra.length < 1000) {
    ra.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ra;
}

/** Lùi `soNgay` ngày từ một ngày yyyy-mm-dd. */
export function subtractDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Lọc các sổ theo khoảng + xưởng — MỘT chỗ để mọi hình dùng chung một tập dòng. */
function filterByRange(d: DataFlowInput, k: FlowRange) {
  const workshopByWip = new Map(d.wips.map((w) => [w.id, w.workshop]));
  const salesInvoiceById = new Map((d.salesInvoices ?? []).map((v) => [v.id, v]));
  const exportDateById = new Map(d.exportOrders.map((o) => [o.id, o.exportDate]));
  return {
    imports: d.imports.filter((r) => isInRange(r.deliveryDate, k) && matchesWorkshop(r.workshop, k)),
    wips: d.wips.filter((w) => isInRange(w.productionDate, k) && matchesWorkshop(w.workshop, k)),
    domestic: (d.domesticSales ?? []).filter((r) => isInRange(r.saleDate, k) && matchesWorkshop(r.workshop, k)),
    scraps: d.scraps.filter((s) => isInRange(s.date, k) && !!s.workshop && matchesWorkshop(s.workshop, k)),
    leftovers: d.productionLocks.filter((l) => isInRange(l.lockDate, k) && matchesWorkshop(l.workshop, k)),
    packagings: d.packagings.filter((p) => isInRange(p.date, k) && matchesWorkshop(p.workshop, k)),
    exportItems: d.exportItems.filter(
      (x) => isInRange(exportDateById.get(x.exportId), k) && matchesWorkshop(workshopByWip.get(x.wipId), k),
    ),
    sales: (d.salesItems ?? []).filter(
      (b) => isInRange(b.deliveryDate, k) && matchesWorkshop(salesInvoiceById.get(b.invoiceId)?.workshop, k),
    ),
  };
}

// ---------- V3: sơ đồ dòng chảy kg (sankey) ----------

/** Nhóm nút — quyết định màu: nguồn vào · xưởng · khâu giữa · hàng ra · hao hụt · còn tồn. */
export type FlowNodeGroup = "nguon" | "xuong" | "giua" | "ra" | "hao" | "ton";

export interface FlowNode {
  id: string;
  label: string;
  /** Cột (0 = trái). Cố định theo khâu để sơ đồ luôn đọc trái → phải. */
  column: number;
  group: FlowNodeGroup;
  /** kg đi qua nút = max(vào, ra). */
  kg: number;
  /** Màn mở khi bấm nút (rỗng = không mở). */
  path?: string;
}

export interface FlowEdge {
  source: string;
  target: string;
  kg: number;
}

export interface DataFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Tổng kg NL nhập trong khoảng (đầu dòng chảy). */
  totalImportedKg: number;
}

/** Số đại lý lớn nhất được vẽ riêng; còn lại gộp "Đại lý khác". */
const SUPPLIER_COUNT = 5;

/**
 * Dòng chảy kg trong khoảng: đại lý → xưởng → {BTP · bán nội địa NL · phế liệu ·
 * còn dở · hao hụt} → kho dự trữ / chờ duyệt → {đóng gói · xuất đơn · bán block ·
 * tồn} → đóng gói → {bán hàng đóng gói · tồn TP · hao hụt}.
 *
 * BẤT BIẾN (có test): mọi nút giữa có Σ vào = Σ ra. Chỗ hụt được gọi tên bằng nút
 * cân bằng — vào > ra ⇒ "tồn / hao hụt"; ra > vào ⇒ "lấy từ tồn trước kỳ" — không
 * bao giờ nuốt số.
 */
export function buildDataFlow(d: DataFlowInput, k: FlowRange): DataFlow {
  const s = filterByRange(d, k);
  const node = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const addNode = (id: string, label: string, layer: number, nhom: FlowNodeGroup, path?: string) => {
    if (!node.has(id)) node.set(id, { id, label, column: layer, group: nhom, kg: 0, path });
  };
  /** Nối hai nút; cùng cặp thì cộng dồn — một cặp chỉ một dải trên sơ đồ. */
  const link = (tu: string, den: string, kg: number) => {
    if (!(kg > 0.0005)) return;
    const co = edges.find((c) => c.source === tu && c.target === den);
    if (co) co.kg += kg;
    else edges.push({ source: tu, target: den, kg });
  };

  // Tầng 0 → 1: đại lý → xưởng
  const bySupplier = new Map<string, number>();
  for (const r of s.imports) bySupplier.set(r.supplierName || "(chưa ghi đại lý)", (bySupplier.get(r.supplierName || "(chưa ghi đại lý)") ?? 0) + (r.quantityKg || 0));
  const lon = new Set([...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, SUPPLIER_COUNT).map(([t]) => t));
  const supplierNodeId = (ten: string) => (lon.has(ten) ? `dl:${ten}` : "dl:*");
  for (const r of s.imports) {
    const ten = r.supplierName || "(chưa ghi đại lý)";
    const id = supplierNodeId(ten);
    addNode(id, lon.has(ten) ? ten : "Đại lý khác", 0, "nguon", "/imports");
    addNode(`x:${r.workshop}`, `Xưởng ${r.workshop}`, 1, "xuong", "/wip");
    link(id, `x:${r.workshop}`, r.quantityKg || 0);
  }

  // Tầng 1 → 2: xưởng → kết quả xử lý NL
  addNode("btp", "Bán thành phẩm", 2, "giua", "/wip");
  const xuongs = new Set<Workshop>([
    ...s.imports.map((r) => r.workshop),
    ...s.wips.map((w) => w.workshop),
    ...s.domestic.map((r) => r.workshop),
  ]);
  for (const x of xuongs) {
    const id = `x:${x}`;
    addNode(id, `Xưởng ${x}`, 1, "xuong", "/wip");
    link(id, "btp", sum(s.wips.filter((w) => w.workshop === x), (w) => w.quantityKg));
    const nd = sum(s.domestic.filter((r) => r.workshop === x), (r) => r.quantityKg);
    if (nd > 0) addNode("nd", "Bán nội địa NL", 2, "ra", "/wip");
    link(id, "nd", nd);
    const pl = sum(s.scraps.filter((r) => r.workshop === x), (r) => r.quantityKg);
    if (pl > 0) addNode("pl", "Phế liệu", 2, "hao", "/imports");
    link(id, "pl", pl);
    const cd = sum(s.leftovers.filter((r) => r.workshop === x), (r) => r.leftoverKg ?? 0);
    if (cd > 0) addNode("cd", "Còn dở / đông gửi", 2, "ton", "/nxt-material");
    link(id, "cd", cd);
  }

  // Tầng 2 → 3: BTP → kho dự trữ / chờ duyệt
  const stockedInKg = sum(s.wips.filter((w) => w.status === "stocked"), (w) => w.quantityKg);
  const pendingApproval = sum(s.wips.filter((w) => w.status !== "stocked"), (w) => w.quantityKg);
  addNode("kho", "Kho dự trữ (BTP)", 3, "giua", "/warehouse");
  link("btp", "kho", stockedInKg);
  if (pendingApproval > 0) addNode("cho", "Chờ duyệt nhập kho", 3, "ton", "/warehouse");
  link("btp", "cho", pendingApproval);

  // Tầng 3 → 4: kho → đóng gói · xuất đơn · bán block thô
  const packagingIn = sum(s.packagings, (p) => p.inputKg);
  const packagingOut = sum(s.packagings, (p) => p.outputKg);
  if (packagingIn > 0 || packagingOut > 0) addNode("goi", "Đóng gói", 4, "giua", "/packaging");
  link("kho", "goi", packagingIn);
  const orderOutKg = sum(s.exportItems, (x) => x.quantityKg);
  if (orderOutKg > 0) addNode("xd", "Xuất theo đơn", 4, "ra", "/orders");
  link("kho", "xd", orderOutKg);
  const banBlock = sum(s.sales.filter((b) => b.sourceWarehouse === RETAIL_WAREHOUSE), (b) => b.quantityKg);
  if (banBlock > 0) addNode("bb", "Bán block thô", 4, "ra", "/sales");
  link("kho", "bb", banBlock);

  // Tầng 4 → 5: đóng gói → {bán hàng đóng gói · tồn TP · hao hụt đóng gói}. Không vẽ
  // riêng nút "TP đóng gói" (thêm một cột làm nhãn chật): TP ra đi thẳng tới đích.
  const finishedGoodSales = sum(s.sales.filter((b) => b.sourceWarehouse === FG_WAREHOUSE), (b) => b.quantityKg);
  if (finishedGoodSales > 0) addNode("btpb", "Bán hàng đóng gói", 5, "ra", "/sales");
  link("goi", "btpb", Math.min(finishedGoodSales, packagingOut));
  if (packagingOut > finishedGoodSales) addNode("tonTp", "Tồn TP cuối kỳ", 5, "ton", "/packaging");
  link("goi", "tonTp", packagingOut - finishedGoodSales);
  if (packagingIn > packagingOut) addNode("hdg", "Hao hụt đóng gói", 5, "hao", "/packaging");
  link("goi", "hdg", packagingIn - packagingOut);
  // Bán nhiều hơn TP đóng ra trong kỳ ⇒ phần dư lấy từ TP đóng gói trước kỳ.
  if (finishedGoodSales > packagingOut) addNode("tonTpDau", "Tồn TP đầu kỳ", 4, "ton", "/packaging");
  link("tonTpDau", "btpb", finishedGoodSales - packagingOut);

  // Cân bằng từng nút giữa, theo thứ tự trái → phải (nút cân bằng thêm sau không làm lệch nút trước).
  const canBang = (id: string, thua: [string, string, FlowNodeGroup, number], deficit: [string, string, FlowNodeGroup, number]) => {
    if (!node.has(id)) return;
    const inputKg = sum(edges.filter((c) => c.target === id), (c) => c.kg);
    const ra = sum(edges.filter((c) => c.source === id), (c) => c.kg);
    if (inputKg - ra > 0.0005) {
      addNode(thua[0], thua[1], thua[3], thua[2]);
      link(id, thua[0], inputKg - ra);
    } else if (ra - inputKg > 0.0005) {
      addNode(deficit[0], deficit[1], deficit[3], deficit[2]);
      link(deficit[0], id, ra - inputKg);
    }
  };
  for (const x of xuongs)
    canBang(`x:${x}`, ["hh", "Hao hụt / chưa ghi ra", "hao", 2], ["nlTruoc", "NL từ kho / kỳ trước", "ton", 0]);
  // Nút xưởng đã cân ⇒ "btp" luôn cân (vào = Σ mẻ = đã nhập + chờ duyệt).
  canBang("kho", ["tonBtp", "Tồn BTP cuối kỳ", "ton", 4], ["tonBtpDau", "Tồn BTP đầu kỳ", "ton", 2]);
  // Đóng gói ra nhiều hơn BTP vào (ghi nhầm) ⇒ phần dư gọi tên, không ẩn.
  if (packagingOut > packagingIn) {
    addNode("goiDu", "TP ra vượt BTP vào (soát lại)", 3, "hao", "/packaging");
    link("goiDu", "goi", packagingOut - packagingIn);
  }

  for (const n of node.values()) {
    const inputKg = sum(edges.filter((c) => c.target === n.id), (c) => c.kg);
    const ra = sum(edges.filter((c) => c.source === n.id), (c) => c.kg);
    n.kg = Math.max(inputKg, ra);
  }
  // Bỏ nút không có cạnh nào (vd xưởng chỉ có số 0).
  const connectedNodes = new Set(edges.flatMap((c) => [c.source, c.target]));
  return {
    nodes: [...node.values()].filter((n) => connectedNodes.has(n.id)),
    edges,
    totalImportedKg: sum(s.imports, (r) => r.quantityKg),
  };
}

// ---------- V3 bản dễ đọc: chia phần ra của một nhóm nút ----------

export interface FlowShare {
  /** id nút đích (vd "btp", "pl", "goi"). */
  id: string;
  label: string;
  group: FlowNodeGroup;
  kg: number;
  /** Phần của tổng (0–1). */
  share: number;
}

/**
 * Gom mọi dải ĐI RA từ các nút thoả `laNguon` theo nút đích — để vẽ "thanh chia phần"
 * thay cho sơ đồ dòng chảy: VD `laNguon = id bắt đầu "x:"` ⇒ "100 kg nguyên liệu vào
 * xưởng ra thành bao nhiêu BTP, phế liệu, hao hụt…". Thứ tự theo `thuTu` (id không có
 * trong `thuTu` xếp sau, kg giảm dần). Σ share = 1 khi tổng > 0.
 */
export function splitOutflows(dc: DataFlow, isSource: (id: string) => boolean, order: readonly string[] = []): FlowShare[] {
  const totals = new Map<string, number>();
  for (const c of dc.edges) if (isSource(c.source)) totals.set(c.target, (totals.get(c.target) ?? 0) + c.kg);
  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  const node = new Map(dc.nodes.map((n) => [n.id, n]));
  const orderIndex = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return [...totals.entries()]
    .map(([id, kg]) => ({ id, label: node.get(id)?.label ?? id, group: node.get(id)?.group ?? "giua", kg, share: total > 0 ? kg / total : 0 }))
    .sort((a, b) => orderIndex(a.id) - orderIndex(b.id) || b.kg - a.kg);
}

// ---------- V2: băng chuyền 5 khâu ----------

export interface FlowStage {
  key: TraceStageKey;
  name: string;
  /** kg đã đi qua khâu trong khoảng. */
  kg: number;
  /** kg đang chờ ở khâu (BTP chờ duyệt) — 0 nếu không áp dụng. */
  kgCho: number;
  /** Số lô / dòng còn thiếu việc (tem, gắn lô, duyệt, quét kiểm) — từ `groupByTraceStage`. */
  missingTaskCount: number;
  /** kg khâu này ÷ kg khâu nguồn (SX ÷ nhập · kho ÷ SX · đóng gói và xuất/bán ÷ kho); null ở khâu đầu. */
  conversionRate: number | null;
  path: string;
}

const STAGE_PATHS: Record<TraceStageKey, string> = {
  nhap: "/imports",
  "san-xuat": "/wip",
  kho: "/warehouse",
  "dong-goi": "/packaging",
  "xuat-ban": "/orders",
};

/** Năm khâu nhập → SX → kho → đóng gói → xuất/bán: kg qua, kg chờ, việc còn thiếu. */
export function buildFlowStages(d: DataFlowInput, k: FlowRange): FlowStage[] {
  const s = filterByRange(d, k);
  const stages = groupByTraceStage(d, { fromDate: k.fromDate, toDate: k.toDate, workshop: k.workshop ?? "" });
  const deficit = new Map(stages.map((g) => [g.key, g.items.filter((m) => m.missing.length > 0).length]));
  const ten = new Map(stages.map((g) => [g.key, g.name]));
  const kg: Record<TraceStageKey, [number, number]> = {
    nhap: [sum(s.imports, (r) => r.quantityKg), 0],
    "san-xuat": [sum(s.wips, (w) => w.quantityKg), 0],
    kho: [
      sum(s.wips.filter((w) => w.status === "stocked"), (w) => w.quantityKg),
      sum(s.wips.filter((w) => w.status !== "stocked"), (w) => w.quantityKg),
    ],
    "dong-goi": [sum(s.packagings, (p) => p.outputKg), 0],
    "xuat-ban": [sum(s.exportItems, (x) => x.quantityKg) + sum(s.sales, (b) => b.quantityKg) + sum(s.domestic, (r) => r.quantityKg), 0],
  };
  const order: TraceStageKey[] = ["nhap", "san-xuat", "kho", "dong-goi", "xuat-ban"];
  // Mẫu số = khâu NGUỒN thật: đóng gói và xuất/bán đều rút từ kho dự trữ (không phải
  // xuất/bán ÷ đóng gói — xuất theo đơn đi thẳng từ kho, chia vậy ra > 100% vô nghĩa).
  const source: Partial<Record<TraceStageKey, TraceStageKey>> = { "san-xuat": "nhap", kho: "san-xuat", "dong-goi": "kho", "xuat-ban": "kho" };
  return order.map((key) => {
    const prevRows = source[key] ? kg[source[key]][0] : 0;
    return {
      key,
      name: ten.get(key) ?? key,
      kg: kg[key][0],
      kgCho: kg[key][1],
      missingTaskCount: deficit.get(key) ?? 0,
      conversionRate: prevRows > 0 ? kg[key][0] / prevRows : null,
      path: STAGE_PATHS[key],
    };
  });
}

// ---------- V4 + V5: chuỗi theo ngày ----------

export interface DailyFlowPoint {
  date: string;
  /** kg NL nhập trong ngày. */
  importedKg: number;
  /** kg BTP sản xuất trong ngày. */
  producedKg: number;
  /** Tồn BTP kho dự trữ cuối ngày (engine sổ NXT BTP — gồm tồn đầu khai tay). */
  wipStockKg: number;
  /** Tồn TP đóng gói cuối ngày. */
  finishedStockKg: number;
}

/**
 * Mỗi ngày trong khoảng: nhập NL, sản xuất BTP, tồn BTP + TP cuối ngày. Tồn NL KHÔNG
 * vẽ: sổ NL chưa trừ lượng NL đưa vào sản xuất (cố ý từ 25/8) nên đường tồn NL chỉ
 * đi lên — vẽ ra là sai nghĩa.
 */
export function buildDailyFlowSeries(d: DataFlowInput, k: FlowRange): DailyFlowPoint[] {
  const s = filterByRange(d, k);
  const inByDay = new Map<string, number>();
  for (const r of s.imports) inByDay.set(r.deliveryDate, (inByDay.get(r.deliveryDate) ?? 0) + (r.quantityKg || 0));
  const productionByDate = new Map<string, number>();
  for (const w of s.wips) productionByDate.set(w.productionDate, (productionByDate.get(w.productionDate) ?? 0) + (w.quantityKg || 0));

  // Tồn theo xưởng: lọc mẻ/đóng gói theo xưởng; bán + xuất bám theo mẻ/phiếu nên lọc theo đó.
  const items = <T>(x: readonly T[]) => [...x];
  const wipsX = d.wips.filter((w) => matchesWorkshop(w.workshop, k));
  const meX = new Set(wipsX.map((w) => w.id));
  const goiX = d.packagings.filter((p) => matchesWorkshop(p.workshop, k));
  const salesInvoiceById = new Map((d.salesInvoices ?? []).map((v) => [v.id, v.workshop]));
  const banX = (d.salesItems ?? []).filter((b) => matchesWorkshop(salesInvoiceById.get(b.invoiceId), k));
  const workshopExports = d.exportItems.filter((x) => !k.workshop || meX.has(x.wipId));
  const finishedGoodSales = banX.filter((b) => b.sourceWarehouse === FG_WAREHOUSE);

  return listDatesInRange(k.fromDate, k.toDate).map((date) => {
    const wipStock = sumFinishedGoodNxt(
      computeFinishedGoodNxt({
        wips: items(wipsX),
        exportOrders: items(d.exportOrders),
        exportItems: items(workshopExports),
        salesItems: items(banX),
        packagings: items(goiX),
        opening: k.workshop ? [] : items(d.finishedOpening),
        products: items(d.products),
        fromDate: date,
        toDate: date,
      }),
    ).closingKg;
    const goiDen = goiX.filter((p) => p.date <= date);
    const banDen = filterRetailSales(finishedGoodSales.filter((b) => b.deliveryDate <= date), FG_WAREHOUSE, d.lotDispatches ?? []);
    const finishedGoodStock = sum(computeFinishedGoodStock(goiDen, banDen), (t) => t.remainingKg);
    return { date, importedKg: inByDay.get(date) ?? 0, producedKg: productionByDate.get(date) ?? 0, wipStockKg: wipStock, finishedStockKg: finishedGoodStock };
  });
}

// ---------- V8: định mức theo mặt hàng ----------

export interface ProductYieldRatio {
  productId: string;
  name: string;
  /** kg NL đã gắn (qua lô) cho các mẻ của mặt hàng. */
  materialKg: number;
  /** kg BTP của các mẻ đó. */
  finishedKg: number;
  /** NL ÷ TP. */
  yieldRatio: number;
  /** (định mức − bình quân) ÷ bình quân. */
  deviation: number;
  exceedsThreshold: boolean;
}

/**
 * Định mức NL/TP theo mặt hàng, CHỈ từ mẻ đã gắn lô NL có cân kg (`lot_inputs`) —
 * mẻ chưa gắn lô không biết NL vào bao nhiêu nên không đoán. Bình quân = Σ NL ÷ Σ TP
 * (gia quyền theo kg), lệch vượt `nguong` thì gắn cờ.
 */
export function computeYieldByProduct(d: DataFlowInput, k: FlowRange, threshold = YIELD_RATIO_THRESHOLD): {
  rows: ProductYieldRatio[];
  binhQuan: number | null;
} {
  const s = filterByRange(d, k);
  const materialByBatch = new Map<string, number>();
  for (const l of d.lotInputs) {
    if (l.outputKind !== "W" || l.inputKind !== "S" || l.quantityKg == null) continue;
    materialByBatch.set(l.outputId, (materialByBatch.get(l.outputId) ?? 0) + l.quantityKg);
  }
  const totals = new Map<string, { material: number; finished: number }>();
  for (const w of s.wips) {
    const material = materialByBatch.get(w.id);
    if (!material || !(w.quantityKg > 0)) continue;
    const g = totals.get(w.productId) ?? { material: 0, finished: 0 };
    g.material += material;
    g.finished += w.quantityKg;
    totals.set(w.productId, g);
  }
  const totalMaterial = sum([...totals.values()], (g) => g.material);
  const totalFinishedGood = sum([...totals.values()], (g) => g.finished);
  if (totalFinishedGood <= 0) return { rows: [], binhQuan: null };
  const binhQuan = totalMaterial / totalFinishedGood;
  const ten = new Map(d.products.map((p) => [p.id, p.name]));
  const dong = [...totals.entries()]
    .map(([productId, g]) => {
      const yieldRatio = g.material / g.finished;
      const deviation = (yieldRatio - binhQuan) / binhQuan;
      return {
        productId,
        name: ten.get(productId) ?? `Mặt hàng ${productId}`,
        materialKg: g.material,
        finishedKg: g.finished,
        yieldRatio,
        deviation,
        exceedsThreshold: Math.abs(deviation) > threshold,
      };
    })
    .sort((a, b) => b.yieldRatio - a.yieldRatio);
  return { rows: dong, binhQuan };
}

// ---------- V6 + V7: kết quả kỳ cân đối ----------

export interface PeriodBalancingResult {
  period: BalancingPeriod;
  result: BalancingResult;
  /** Chưa có thành phẩm ⇒ định mức + lãi/lỗ chưa có nghĩa (31-can-doi-ky §công thức). */
  hasFinishedGoods: boolean;
}

/** Mọi kỳ cân đối (mới nhất trước) kèm kết quả `calculateBalancing` — không đổi công thức. */
export function computeAllPeriodResults(d: DataFlowInput): PeriodBalancingResult[] {
  return [...d.periods]
    .sort((a, b) => (b.startDate || b.createdAt || "").localeCompare(a.startDate || a.createdAt || ""))
    .map((period) => {
      const result = calculateBalancing(
        period,
        d.balancingInputs.filter((r) => r.periodId === period.id),
        d.scraps.filter((r) => r.periodId === period.id),
        d.balancingOutputs.filter((r) => r.periodId === period.id),
      );
      return { period, result, hasFinishedGoods: result.totalOutputKg > 0 };
    });
}

// ---------- V9: cảnh báo chuỗi ----------

export type FlowWarningKind =
  | "chua-chot-nhap"
  | "chua-chot-sx"
  | "doi-sau-chot"
  | "ghi-bu"
  | "ban-vuot"
  | "lo-chua-gan"
  | "cho-duyet-lau"
  | "dinh-muc-lech"
  | "ky-dinh-muc-lech";

export interface FlowWarning {
  /** Khoá ổn định (tô màu dòng / React key). */
  id: string;
  kind: FlowWarningKind;
  /** "loi" = sổ sai cần sửa · "nhac" = việc chưa làm · "tin" = để biết. */
  level: "loi" | "nhac" | "tin";
  title: string;
  detail: string;
  date: string;
  workshop: Workshop | "";
  path: string;
}

const WARNING_KIND_LABELS: Record<FlowWarningKind, string> = {
  "chua-chot-nhap": "Ngày nhập chưa chốt",
  "chua-chot-sx": "Ngày sản xuất chưa chốt",
  "doi-sau-chot": "Sổ nhập đổi sau khi chốt",
  "ghi-bu": "Ghi bù",
  "ban-vuot": "Bán / xuất vượt tồn",
  "lo-chua-gan": "Chưa gắn lô",
  "cho-duyet-lau": "BTP chờ duyệt lâu",
  "dinh-muc-lech": "Định mức lệch",
  "ky-dinh-muc-lech": "Kỳ cân đối định mức lệch",
};
export const getWarningKindLabel = (l: FlowWarningKind) => WARNING_KIND_LABELS[l];

const fmtKg = (n: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n)} kg`;
const fmtPt = (n: number) => `${n > 0 ? "+" : ""}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n * 100)}%`;

/**
 * Việc cần đốc trong khoảng — mỗi dòng trỏ tới đúng màn sửa. Ngày "hôm nay" truyền
 * vào (không đọc đồng hồ) để test được. Sắp: lỗi → nhắc → tin, mới trước.
 */
export function buildChainWarnings(d: DataFlowInput, k: FlowRange, today: string, threshold = YIELD_RATIO_THRESHOLD): FlowWarning[] {
  const s = filterByRange(d, k);
  const ra: FlowWarning[] = [];
  const isLocked = (locks: readonly DailyLock[], date: string, x: Workshop) =>
    locks.some((l) => l.lockDate === date && l.workshop === x && l.isLocked);

  // 1. Ngày có nhập / sản xuất mà chưa chốt (không tính hôm nay — còn đang ghi).
  const importKgByDay = new Map<string, number>();
  for (const r of s.imports) importKgByDay.set(`${r.deliveryDate}|${r.workshop}`, (importKgByDay.get(`${r.deliveryDate}|${r.workshop}`) ?? 0) + (r.quantityKg || 0));
  for (const [key, kg] of importKgByDay) {
    const [date, x] = key.split("|") as [string, Workshop];
    if (date >= today) continue;
    const lock = d.dailyLocks.find((l) => l.lockDate === date && l.workshop === x && l.isLocked);
    if (!lock) {
      ra.push({ id: `ccn|${key}`, kind: "chua-chot-nhap", level: "nhac", title: `Nhập ${fmtKg(kg)} chưa chốt ngày`, detail: "Chốt ngày để khóa tổng nhập, kế toán mới lấy được số.", date, workshop: x, path: "/imports" });
    } else if (Math.abs(lock.totalKgAtLock - kg) > 0.01) {
      // 3. Sổ đổi sau khi chốt: tổng hiện tại ≠ tổng lúc chốt.
      ra.push({ id: `dsc|${key}`, kind: "doi-sau-chot", level: "loi", title: `Tổng nhập lệch ${fmtKg(kg - lock.totalKgAtLock)} so với lúc chốt`, detail: `Lúc chốt ${fmtKg(lock.totalKgAtLock)}, nay ${fmtKg(kg)}. Soát lại dòng sửa sau chốt.`, date, workshop: x, path: "/imports" });
    }
  }
  const productionKgByDay = new Map<string, number>();
  for (const w of s.wips) productionKgByDay.set(`${w.productionDate}|${w.workshop}`, (productionKgByDay.get(`${w.productionDate}|${w.workshop}`) ?? 0) + (w.quantityKg || 0));
  for (const [key, kg] of productionKgByDay) {
    const [date, x] = key.split("|") as [string, Workshop];
    if (date >= today || isLocked(d.productionLocks, date, x)) continue;
    ra.push({ id: `ccs|${key}`, kind: "chua-chot-sx", level: "nhac", title: `Sản xuất ${fmtKg(kg)} chưa chốt ngày`, detail: "Chốt ngày sản xuất để ghi còn dở và khóa lô.", date, workshop: x, path: "/wip" });
  }

  // 4. Ghi bù (nhập + sản xuất) — để biết, lý do đã bắt lúc ghi.
  const shipments = d.shipments.filter((c) => isInRange(c.deliveryDate, k) && matchesWorkshop(c.workshop, k) && isBackdatedImport(c));
  for (const c of shipments)
    ra.push({ id: `gbn|${c.id}`, kind: "ghi-bu", level: "tin", title: `Chuyến ${c.supplierName || ""} ghi bù ngày ${c.postingDate}`.trim(), detail: c.backdateReason ? `Lý do: ${c.backdateReason}` : "Chưa ghi lý do.", date: c.deliveryDate, workshop: c.workshop, path: "/imports" });
  for (const w of s.wips.filter(isBackdatedWip))
    ra.push({ id: `gbs|${w.id}`, kind: "ghi-bu", level: "tin", title: `Mẻ ${fmtKg(w.quantityKg)} ghi bù ngày ${w.postingDate}`, detail: w.backdateReason ? `Lý do: ${w.backdateReason}` : "Chưa ghi lý do.", date: w.productionDate, workshop: w.workshop, path: "/wip" });

  // 5. Bán / đóng gói vượt tồn BTP (toàn bộ sổ — vượt là vượt, không theo khoảng).
  const ten = new Map(d.products.map((p) => [p.id, p.name]));
  const oversold = computeWipStockDetail(
    [...d.wips],
    [...d.exportItems],
    collectWipDeductions([...(d.salesItems ?? [])], [...d.packagings], d.lotInputs, d.lotDispatches ?? []),
  ).oversales;
  for (const v of oversold)
    ra.push({ id: `bv|${v.productId}|${v.spec}`, kind: "ban-vuot", level: "loi", title: `${ten.get(v.productId) ?? v.productId}${v.spec ? ` · ${v.spec}` : ""} vượt tồn ${fmtKg(v.kg)}`, detail: "Bán / đóng gói nhiều hơn lượng đã nhập kho. Soát ngày nhập kho hoặc dòng bán.", date: today, workshop: "", path: "/warehouse" });

  // 6. Mẻ / phiếu đóng gói chưa gắn lô và chưa ghi lý do (đã qua ngày).
  const stages = groupByTraceStage(d, { fromDate: k.fromDate, toDate: k.toDate, workshop: k.workshop ?? "" });
  for (const g of stages) {
    if (g.key !== "san-xuat" && g.key !== "dong-goi") continue;
    for (const m of g.items) {
      if (!m.missing.includes("lo") || m.node.date >= today) continue;
      ra.push({ id: `lo|${m.node.kind}|${m.node.id}`, kind: "lo-chua-gan", level: "nhac", title: `${m.node.label} chưa gắn lô`, detail: g.key === "san-xuat" ? "Gắn lô NL cho mẻ, hoặc ghi lý do khi chốt ngày." : "Gắn lô BTP cho phiếu đóng gói.", date: m.node.date, workshop: m.node.workshop, path: g.key === "san-xuat" ? "/wip" : "/packaging" });
    }
  }

  // 7. BTP chờ duyệt nhập kho quá N ngày.
  const han = subtractDays(today, APPROVAL_WAIT_DAYS);
  for (const w of s.wips.filter((w) => w.status === "pending" && w.productionDate < han))
    ra.push({ id: `cd|${w.id}`, kind: "cho-duyet-lau", level: "nhac", title: `${ten.get(w.productId) ?? "BTP"} ${fmtKg(w.quantityKg)} chờ duyệt quá ${APPROVAL_WAIT_DAYS} ngày`, detail: "Thủ kho duyệt nhập kho để tồn dự trữ đủ.", date: w.productionDate, workshop: w.workshop, path: `/warehouse?approve=W:${w.id}` });

  // 8. Định mức mặt hàng lệch ngưỡng.
  const dm = computeYieldByProduct(d, k, threshold);
  for (const r of dm.rows.filter((x) => x.exceedsThreshold))
    ra.push({ id: `dm|${r.productId}`, kind: "dinh-muc-lech", level: r.deviation > 0 ? "loi" : "tin", title: `${r.name}: định mức ${r.yieldRatio.toFixed(2)} (${fmtPt(r.deviation)})`, detail: `Bình quân ${dm.binhQuan?.toFixed(2)}. ${r.deviation > 0 ? "Tốn NL hơn mức chung — soát cân hoặc hao hụt." : "Ít NL hơn mức chung — soát lô gắn có thiếu không."}`, date: k.toDate < today ? k.toDate : today, workshop: "", path: "/wip" });

  // 9. Kỳ cân đối có định mức lệch so với bình quân các kỳ cùng loại NL.
  const ky = computeAllPeriodResults(d).filter((x) => x.hasFinishedGoods);
  const byType = new Map<string, PeriodBalancingResult[]>();
  for (const x of ky) byType.set(x.period.materialTypeName, [...(byType.get(x.period.materialTypeName) ?? []), x]);
  for (const [kind, items] of byType) {
    if (items.length < 2) continue;
    const bq = sum(items, (x) => x.result.totalInputKg) / sum(items, (x) => x.result.totalOutputKg);
    for (const x of items) {
      const deviation = (x.result.norm - bq) / bq;
      const date = x.period.endDate || x.period.startDate || "";
      if (Math.abs(deviation) <= threshold || (date && !isInRange(date, k))) continue;
      ra.push({ id: `kdm|${x.period.id}`, kind: "ky-dinh-muc-lech", level: "tin", title: `${kind} · ${x.period.dateRangeDescription}: định mức ${x.result.norm.toFixed(2)} (${fmtPt(deviation)})`, detail: `Bình quân các kỳ ${kind}: ${bq.toFixed(2)}.`, date, workshop: "", path: `/balancing/${x.period.id}` });
    }
  }

  const order = { loi: 0, nhac: 1, tin: 2 } as const;
  return ra.sort((a, b) => order[a.level] - order[b.level] || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

// ---------- V12: tuổi tồn kho ----------

export interface StockAgeBucket {
  key: "duoi-30" | "30-60" | "60-90" | "tren-90";
  label: string;
  kg: number;
  lotCount: number;
}

/**
 * Chia kg tồn theo số ngày lô đã nằm kho (tính từ ngày sản xuất tới `todayIso`): dưới 30
 * · 30–60 · 60–90 · trên 90 ngày. Hàng nằm lâu phải đẩy trước (FIFO). Lô hết hàng bỏ qua.
 */
export function bucketStockByAge(los: readonly { productionDate: string; remainingKg: number }[], today: string): StockAgeBucket[] {
  const nhom: StockAgeBucket[] = [
    { key: "duoi-30", label: "Dưới 30 ngày", kg: 0, lotCount: 0 },
    { key: "30-60", label: "30–60 ngày", kg: 0, lotCount: 0 },
    { key: "60-90", label: "60–90 ngày", kg: 0, lotCount: 0 },
    { key: "tren-90", label: "Trên 90 ngày", kg: 0, lotCount: 0 },
  ];
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  for (const l of los) {
    if (!(l.remainingKg > 0) || !l.productionDate) continue;
    const date = Math.floor((todayMs - new Date(`${l.productionDate}T00:00:00Z`).getTime()) / 86_400_000);
    const g = nhom[date < 30 ? 0 : date < 60 ? 1 : date < 90 ? 2 : 3];
    g.kg += l.remainingKg;
    g.lotCount += 1;
  }
  return nhom;
}

// ---------- V16: QC theo ngày ----------

export interface DailyQcCount {
  date: string;
  pass: number;
  conditional: number;
  fail: number;
}

/** Đếm chỉ tiêu QC đạt / tạm / không đạt mỗi ngày trong [tu, den] của một xưởng ("" = mọi xưởng). */
export function countQcByDay(
  rows: readonly { date: string; workshop: Workshop; result: QcResult }[],
  workshop: Workshop | "",
  tu: string,
  den: string,
): DailyQcCount[] {
  const m = new Map(listDatesInRange(tu, den).map((date) => [date, { date, pass: 0, conditional: 0, fail: 0 }]));
  for (const r of rows) {
    if (workshop && r.workshop !== workshop) continue;
    const g = m.get(r.date);
    if (!g) continue;
    if (r.result === "pass") g.pass += 1;
    else if (r.result === "conditional") g.conditional += 1;
    else g.fail += 1;
  }
  return [...m.values()];
}
