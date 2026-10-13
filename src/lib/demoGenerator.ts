// ============================================================
// Tên file: src/lib/demoGenerator.ts
// Tên tiếng Việt: Bộ sinh dữ liệu DEMO từ số thật
// Description: Pure generator — scans real books for parameters, synthesises a full
//              60-day chain (import → WIP → warehouse → packaging → sale/export → lots)
// ============================================================
/**
 * Spec docs/spec/che-do-demo.md §4 mục 6 + §5b "Bộ sinh demo phải tạo ra số có hình".
 *
 * KHÔNG chép giao dịch thật — số thật thưa (nửa sau chuỗi trống). Bộ sinh QUÉT sổ thật
 * để lấy THAM SỐ (danh mục, đại lý hay giao, loại NL từng xưởng, kg mỗi chuyến, giá NL,
 * tỉ lệ ra thành phẩm của các kỳ cân đối) rồi SINH chuỗi mới cân bằng kg ở mọi khâu,
 * ngày dời về sát hôm nay. Ẩn danh (mặc định): đại lý → "Đại lý 01…", khách → "Khách
 * hàng 01…", giá nhân một hệ số. Cài sẵn đúng một ca cho mỗi loại cảnh báo của Tổng quan.
 *
 * Hàm THUẦN, tất định theo `hat` (cùng đầu vào ⇒ cùng gói) — test ở demoGenerator.test.ts.
 * Id trong gói là id của app; lên máy chủ tầng repo tự thêm tiền tố `demo:` (lib/demoMode).
 */
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  BatterType,
  Customer,
  DailyLock,
  DomesticSaleItem,
  ExportItem,
  ExportOrder,
  FinishedGoodsOpeningStock,
  ImportShipment,
  LabelPrint,
  LotDispatch,
  LotInput,
  LotWaiver,
  MaterialImportItem,
  MaterialOpeningStock,
  MaterialType,
  MonthlyStockLine,
  NxtSnapshotLine,
  OrderItem,
  Packaging,
  Product,
  QcChecklistItem,
  QcResult,
  SalesInvoice,
  SalesItem,
  SalesOrder,
  ScrapItem,
  StorageLocation,
  Supplier,
  WipProductionItem,
  Workshop,
} from "@/types";
import { calculateBalancing } from "@/lib/balancingCalc";
import { RETAIL_WAREHOUSE, FG_WAREHOUSE } from "@/lib/inventory";
import { listDatesInRange, subtractDays } from "@/lib/dataFlow";

/** Sổ thật đưa vào để quét tham số (chỉ ĐỌC). */
export interface DemoSource {
  products: readonly Product[];
  materialTypes: readonly MaterialType[];
  suppliers: readonly Supplier[];
  customers: readonly Customer[];
  batterTypes: readonly BatterType[];
  storageLocations: readonly StorageLocation[];
  imports: readonly MaterialImportItem[];
  wips: readonly WipProductionItem[];
  periods: readonly BalancingPeriod[];
  balancingInputs: readonly BalancingInputItem[];
  balancingOutputs: readonly BalancingOutputItem[];
  nxtSnapshots: readonly NxtSnapshotLine[];
  monthlyStock: readonly MonthlyStockLine[];
}

/** Gói số demo — mỗi khóa là một bảng; nạp thẳng vào hook cùng tên ở chế độ demo. */
export interface GoiDemo {
  products: Product[];
  materialTypes: MaterialType[];
  suppliers: Supplier[];
  customers: Customer[];
  batterTypes: BatterType[];
  storageLocations: StorageLocation[];
  shipments: ImportShipment[];
  imports: MaterialImportItem[];
  dailyLocks: DailyLock[];
  scraps: ScrapItem[];
  wips: WipProductionItem[];
  productionLocks: DailyLock[];
  packagings: Packaging[];
  salesOrders: SalesOrder[];
  orderItems: OrderItem[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesInvoices: SalesInvoice[];
  salesItems: SalesItem[];
  domesticSales: DomesticSaleItem[];
  lotInputs: LotInput[];
  lotDispatches: LotDispatch[];
  lotWaivers: LotWaiver[];
  labelPrints: LabelPrint[];
  qcChecklists: QcChecklistItem[];
  qcLocks: DailyLock[];
  periods: BalancingPeriod[];
  balancingInputs: BalancingInputItem[];
  balancingOutputs: BalancingOutputItem[];
  materialOpening: MaterialOpeningStock[];
  finishedOpening: FinishedGoodsOpeningStock[];
  nxtSnapshots: NxtSnapshotLine[];
  monthlyStock: MonthlyStockLine[];
}

export interface DemoOptions {
  /** yyyy-mm-dd — ngày cuối của bộ demo. */
  homNay: string;
  /** Số ngày lùi về trước (mặc định 60). */
  soNgay?: number;
  /** Ẩn tên đại lý / khách + đổi giá (mặc định bật). */
  anDanh?: boolean;
  /** Hạt ngẫu nhiên — cùng hạt cùng gói. */
  hat?: number;
  /** Mốc giờ ghi (ISO) cho các trường recordedAt / lockedAt. */
  lucGhi?: string;
}

const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];
const EXCHANGE_RATE = 25_500;
const PROCESSING_COST = 8_000; // đ/kg TP
const QC_CRITERIA = ["Nhiệt độ bảo quản", "Vệ sinh dụng cụ", "Ngoại quan sản phẩm", "Kích cỡ đúng quy cách"];

/** PRNG mulberry32 — tất định theo hạt. */
function createRandom(hat: number) {
  let a = hat >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    tu: (a0: number, b0: number) => a0 + (b0 - a0) * r(),
    nguyen: (a0: number, b0: number) => Math.floor(a0 + (b0 - a0 + 1) * r()),
    chon: <T>(ds: readonly T[]) => ds[Math.floor(r() * ds.length)],
  };
}

const tron = (n: number, step = 1) => Math.round(n / step) * step;
const median = (xs: number[], fallback: number) => {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : fallback;
};
const percentile = (xs: number[], p: number, fallback: number) => {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : fallback;
};
const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const so2 = (i: number) => String(i).padStart(2, "0");

/**
 * THAM SỐ quét từ sổ thật — tách riêng để test + để màn hiện "đã quét được gì".
 */
export interface DemoParams {
  xuong: Workshop[];
  nlTheoXuong: Record<string, string[]>;
  daiLy: string[];
  kgDong: { thap: number; cao: number };
  giaNL: Record<string, number>;
  tiLeTP: number;
  matHangTheoNL: Record<string, string[]>;
  soDongNhapThat: number;
}

export function scanDemoParams(n: DemoSource): DemoParams {
  const workshop = WORKSHOPS.filter((x) => n.imports.some((r) => r.workshop === x));
  const workshopList = workshop.length ? workshop : WORKSHOPS;
  const materialsByWorkshop: Record<string, string[]> = {};
  for (const x of workshopList) {
    const dem = new Map<string, number>();
    for (const r of n.imports) if (r.workshop === x && r.materialTypeName) dem.set(r.materialTypeName, (dem.get(r.materialTypeName) ?? 0) + (r.quantityKg || 0));
    const ds = [...dem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    materialsByWorkshop[x] = ds.length ? ds : n.materialTypes.slice(0, 2).map((m) => m.name).filter(Boolean);
    if (materialsByWorkshop[x].length === 0) materialsByWorkshop[x] = [`Nguyên liệu ${x}`];
  }
  const supplierKg = new Map<string, number>();
  for (const r of n.imports) if (r.supplierName) supplierKg.set(r.supplierName, (supplierKg.get(r.supplierName) ?? 0) + (r.quantityKg || 0));
  const suppliers = [...supplierKg.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const kgs = n.imports.map((r) => r.quantityKg || 0);
  const materialPrices: Record<string, number> = {};
  for (const ten of new Set(Object.values(materialsByWorkshop).flat()))
    materialPrices[ten] = median(n.imports.filter((r) => r.materialTypeName === ten).map((r) => r.unitPrice ?? 0), 60_000);
  const tiLe = n.periods
    .map((p) =>
      calculateBalancing(
        p,
        n.balancingInputs.filter((x) => x.periodId === p.id),
        [],
        n.balancingOutputs.filter((x) => x.periodId === p.id),
      ),
    )
    .filter((k) => k.totalInputKg > 0 && k.totalOutputKg > 0)
    .map((k) => k.totalOutputKg / k.totalInputKg);
  const tenNLtheoId = new Map(n.materialTypes.map((m) => [m.id, m.name]));
  const productsByMaterial: Record<string, string[]> = {};
  for (const ten of new Set(Object.values(materialsByWorkshop).flat())) {
    let ds = n.products.filter((p) => p.materialTypeId && tenNLtheoId.get(p.materialTypeId) === ten);
    if (ds.length === 0) {
      const category = n.materialTypes.find((m) => m.name === ten)?.category;
      ds = n.products.filter((p) => category && p.category === category);
    }
    if (ds.length === 0) ds = n.products.slice(0, 6);
    productsByMaterial[ten] = ds.slice(0, 5).map((p) => p.id);
  }
  return {
    xuong: workshopList,
    nlTheoXuong: materialsByWorkshop,
    daiLy: suppliers.length ? suppliers.slice(0, 10) : ["Hồng Phú", "Bê 3", "Mậu H Tân"],
    kgDong: { thap: Math.max(200, percentile(kgs, 0.25, 600)), cao: Math.max(400, percentile(kgs, 0.75, 2_400)) },
    giaNL: materialPrices,
    tiLeTP: Math.min(0.75, Math.max(0.35, median(tiLe, 0.45))),
    matHangTheoNL: productsByMaterial,
    soDongNhapThat: n.imports.length,
  };
}

/** Sinh gói demo đầy đủ chuỗi. Xem chú thích đầu file. */
export function generateDemoBundle(n: DemoSource, tc: DemoOptions): GoiDemo {
  const anonymize = tc.anDanh ?? true;
  const days = Math.max(14, tc.soNgay ?? 60);
  const ng = createRandom(tc.hat ?? 20261012);
  const ts = scanDemoParams(n);
  const luc = tc.lucGhi ?? `${tc.homNay}T08:00:00.000Z`;
  const ngays = listDatesInRange(subtractDays(tc.homNay, days - 1), tc.homNay);
  const yesterday = subtractDays(tc.homNay, 1);
  const priceFactor = anonymize ? 1.07 : 1;
  const ten = (category: "dl" | "kh", i: number) => (category === "dl" ? `Đại lý ${so2(i + 1)}` : `Khách hàng ${so2(i + 1)}`);
  const supplierNames = new Map(ts.daiLy.map((t, i) => [t, anonymize ? ten("dl", i) : t]));
  const usedSuppliers = ts.daiLy.map((t) => supplierNames.get(t) as string);
  const sp = new Map(n.products.map((p) => [p.id, p]));

  // ---- Danh mục ----
  const suppliers: Supplier[] = ts.daiLy.map((t, i) => {
    const goc = n.suppliers.find((s0) => s0.shortName === t);
    return {
      id: `dm-dl-${i}`, // id mới: id thật có thể chứa tên đối tác
      code: String(i + 1),
      shortName: supplierNames.get(t) as string,
      billingName: anonymize ? (supplierNames.get(t) as string) : goc?.billingName || t,
      address: anonymize ? "" : goc?.address ?? "",
      nationalId: anonymize ? "" : goc?.nationalId ?? "",
      issuedDate: "",
      issuedPlace: "",
      phone: anonymize ? "" : goc?.phone ?? "",
      note: "Dữ liệu demo",
    };
  });
  const khGoc = n.customers.length
    ? n.customers.slice(0, 8)
    : (Array.from({ length: 6 }, (_, i) => ({ id: `dm-kh-${i}`, code: "", name: `KH ${i}`, market: i % 2 ? "Nội địa" : "Nhật Bản" })) as Customer[]);
  const customers: Customer[] = khGoc.map((c, i) => ({ ...c, id: `dm-kh-${i}`, code: String(i + 1), name: anonymize ? ten("kh", i) : c.name }));

  // ---- Tồn đầu (mốc = ngày đầu) ----
  const firstDate = ngays[0];
  const materialOpening: MaterialOpeningStock[] = ts.xuong.map((x, i) => ({
    id: `dm-tdnl-${i}`,
    workshop: x,
    materialTypeName: ts.nlTheoXuong[x][0],
    asOfDate: firstDate,
    quantityKg: tron(ng.tu(2_000, 5_000), 10),
    note: "Tồn đầu demo",
  }));
  const allProducts = [...new Set(Object.values(ts.matHangTheoNL).flat())];
  const finishedOpening: FinishedGoodsOpeningStock[] = allProducts.slice(0, 2).map((pid, i) => ({
    id: `dm-tdtp-${i}`,
    productId: pid,
    spec: "",
    asOfDate: firstDate,
    quantityKg: tron(ng.tu(300, 800), 5),
    blocksCount: 0,
    warehouse: RETAIL_WAREHOUSE,
    note: "Tồn đầu demo",
  }));

  // Mặt hàng "lệch định mức" cố ý (cảnh báo định mức) — mặt hàng thứ 2 của xưởng đầu.
  const mhLech = ts.matHangTheoNL[ts.nlTheoXuong[ts.xuong[0]][0]][1] ?? allProducts[1];

  const shipments: ImportShipment[] = [];
  const imports: MaterialImportItem[] = [];
  const dailyLocks: DailyLock[] = [];
  const scraps: ScrapItem[] = [];
  const wips: WipProductionItem[] = [];
  const productionLocks: DailyLock[] = [];
  const domesticSales: DomesticSaleItem[] = [];
  const lotInputs: LotInput[] = [];
  const lotWaivers: LotWaiver[] = [];
  const labelPrints: LabelPrint[] = [];
  const qcChecklists: QcChecklistItem[] = [];
  const qcLocks: DailyLock[] = [];
  const lotDispatches: LotDispatch[] = [];
  let dem = 0;
  const id = (t: string) => `dm-${t}-${++dem}`;
  /** kg NL còn chưa gắn cho mẻ / bán nội địa của từng dòng nhập (lô NL). */
  const remainingMaterial = new Map<string, number>();
  /** Lấy `can` kg NL từ các dòng còn hàng (nhiều nhất trước); trả các phần đã lấy,
   *  rỗng nếu không đủ — không bao giờ gắn quá số kg của lô. */
  const takeMaterial = (dong: MaterialImportItem[], can: number): { dong: MaterialImportItem; kg: number }[] => {
    const total = dong.reduce((s0, d) => s0 + (remainingMaterial.get(d.id) ?? 0), 0);
    if (can <= 0 || total < can) return [];
    const ra: { dong: MaterialImportItem; kg: number }[] = [];
    let thieu = can;
    for (const d of [...dong].sort((a0, b0) => (remainingMaterial.get(b0.id) ?? 0) - (remainingMaterial.get(a0.id) ?? 0))) {
      if (thieu <= 0) break;
      const k = Math.min(remainingMaterial.get(d.id) ?? 0, thieu);
      if (k <= 0) continue;
      remainingMaterial.set(d.id, (remainingMaterial.get(d.id) ?? 0) - k);
      ra.push({ dong: d, kg: k });
      thieu -= k;
    }
    return ra;
  };
  const printLabel = (k: LabelPrint["lotKind"], lotId: string, label: string, date: string) =>
    labelPrints.push({ id: id("tem"), lotKind: k, lotId, label, copies: 1, operator: "Demo", printedAt: `${date}T09:00:00.000Z` });

  ngays.forEach((date, i) => {
    if (dayOfWeek(date) === 0) return; // Chủ nhật nghỉ
    const isPast = date < tc.homNay;
    const progress = i / Math.max(1, ngays.length - 1); // 0 → 1: tỉ lệ gắn lô tăng dần
    ts.xuong.forEach((x) => {
      if (ng.r() < 0.12) return; // vài ngày xưởng không nhận hàng
      const materialList = ts.nlTheoXuong[x];
      let totalIn = 0;
      const todayRows: MaterialImportItem[] = [];
      const shipmentCount = ng.r() < 0.4 ? 2 : 1;
      for (let c = 0; c < shipmentCount; c++) {
        const sid = id("chuyen");
        const isBackdate = isPast && ng.r() < 0.04;
        const postingDate = isBackdate ? (subtractDays(date, -1) <= tc.homNay ? subtractDays(date, -1) : date) : date;
        const dl = ng.chon(usedSuppliers.slice(0, Math.max(3, usedSuppliers.length)));
        shipments.push({
          id: sid,
          deliveryDate: date,
          postingDate,
          backdateReason: postingDate > date ? "Phiếu cân về muộn, ghi bổ sung" : "",
          workshop: x,
          supplierName: dl,
          driverName: "",
          licensePlate: "",
          note: "",
          lotCode: `${x[0]}-${date.slice(2).replaceAll("-", "")}-${so2(c + 1)}`,
          operator: "Demo",
        });
        const rowCount = ng.r() < 0.35 && materialList.length > 1 ? 2 : 1;
        for (let d = 0; d < rowCount; d++) {
          const material = materialList[d % materialList.length];
          const kg = tron(ng.tu(ts.kgDong.thap, ts.kgDong.cao), 5);
          const dong: MaterialImportItem = {
            id: id("nhap"),
            shipmentId: sid,
            deliveryDate: date,
            workshop: x,
            category: "Khác",
            supplierName: dl,
            materialTypeName: material,
            quantityKg: kg,
            unitPrice: tron((ts.giaNL[material] ?? 60_000) * priceFactor * ng.tu(0.95, 1.05), 500),
            driverName: "",
            licensePlate: "",
            note: "",
          };
          imports.push(dong);
          todayRows.push(dong);
          remainingMaterial.set(dong.id, kg);
          totalIn += kg;
          if (ng.r() < 0.7) printLabel("S", dong.id, `${shipments[shipments.length - 1].lotCode} · ${material}`, date);
        }
      }
      // Chốt ngày nhập (ca "chưa chốt" / "sửa sau chốt" cài sau vòng sinh).
      if (isPast)
        dailyLocks.push({ id: `${date}|${x}`, lockDate: date, workshop: x, isLocked: true, lockedAt: `${date}T17:00:00.000Z`, totalKgAtLock: totalIn, reopenReason: "", note: "" });
      scraps.push({ id: id("phe"), periodId: "", name: "Nội tạng, đầu", quantityKg: tron(totalIn * ng.tu(0.05, 0.07), 1), sellingPrice: 4_000, date, workshop: x, source: "Nhập hàng" });

      // Bán nội địa NL thẳng
      if (ng.r() < 0.2) {
        const materialRow = ng.chon(todayRows);
        const nd: DomesticSaleItem = {
          id: id("nd"),
          saleDate: date,
          postingDate: date,
          backdateReason: "",
          workshop: x,
          materialTypeName: materialRow.materialTypeName,
          quantityKg: tron(totalIn * ng.tu(0.03, 0.06), 1),
          unitPrice: tron((materialRow.unitPrice ?? 60_000) * 0.8, 500),
          customerName: customers[customers.length - 1]?.name ?? "Chợ địa phương",
          note: "",
          operator: "Demo",
        };
        domesticSales.push(nd);
        if (ng.r() < 0.7)
          for (const p0 of takeMaterial([materialRow], nd.quantityKg))
            lotDispatches.push({ id: id("lr"), lotKind: "S", lotId: p0.dong.id, lotLabel: p0.dong.materialTypeName, docKind: "domestic_sale", docId: nd.id, quantityKg: p0.kg, method: "chon", operator: "Demo", recordedAt: luc });
      }

      // Sản xuất BTP: TP ≈ NL × tỉ lệ ra thành phẩm (± nhiễu), chia 2–3 mẻ.
      // ≤ 92% NL vào thành BTP (phần còn: phế liệu, còn dở, bán nội địa, hao hụt) ⇒ NL
      // của ngày đủ để gắn lô cho các mẻ, kể cả mặt hàng "lệch định mức" (+13%).
      const totalFinishedGood = totalIn * ts.tiLeTP * ng.tu(0.8, 0.9);
      const batchCount = ng.r() < 0.5 ? 3 : 2;
      const dsMH = ts.matHangTheoNL[todayRows[0].materialTypeName] ?? allProducts;
      for (let m = 0; m < batchCount; m++) {
        const pid = dsMH[(i + m) % dsMH.length];
        const kg = tron(totalFinishedGood / batchCount, 1);
        // Chờ duyệt: 2 ngày gần nhất (ca "chờ duyệt lâu" cài sau vòng sinh).
        const isPending = date >= subtractDays(tc.homNay, 1);
        const isBackdate = isPast && ng.r() < 0.03;
        const w: WipProductionItem = {
          id: id("me"),
          productionDate: date,
          postingDate: isBackdate ? subtractDays(date, -1) : date,
          backdateReason: isBackdate ? "Tổ trưởng nghỉ, ghi bổ sung hôm sau" : "",
          workshop: x,
          productId: pid,
          spec: "",
          quantityKg: kg,
          blocksCount: Math.max(1, tron(kg / 10)),
          warehouse: RETAIL_WAREHOUSE,
          status: isPending ? "cho-nhap" : "da-nhap",
          note: "",
          processingType: sp.get(pid)?.processingType ?? "",
          operator: "Demo",
        };
        wips.push(w);
        // Gắn lô NL: tỉ lệ tăng dần theo thời gian (kể chuyện "từ khi dùng QR").
        const heSo = pid === mhLech ? 1.13 : ng.tu(0.98, 1.02);
        const materialParts = ng.r() < 0.45 + 0.5 * progress ? takeMaterial(todayRows, tron((kg / ts.tiLeTP) * heSo, 1)) : [];
        if (materialParts.length > 0) {
          for (const p0 of materialParts)
            lotInputs.push({ id: id("gl"), outputKind: "W", outputId: w.id, inputKind: "S", inputId: p0.dong.id, inputLabel: p0.dong.materialTypeName, material: p0.dong.materialTypeName, quantityKg: p0.kg, method: "quet", operator: "Demo", recordedAt: `${date}T15:00:00.000Z` });
        } else if (isPast && ng.r() < 0.6) {
          lotWaivers.push({ id: id("ld"), outputKind: "W", outputId: w.id, reason: "Trộn NL nhiều chuyến trong mẻ", operator: "Demo", recordedAt: `${date}T17:00:00.000Z` });
        }
        if (ng.r() < 0.6) printLabel("W", w.id, `${sp.get(pid)?.name ?? "BTP"} · ${date}`, date);
      }
      // Chốt ngày SX (ghi còn dở theo loại NL) — ca "chưa chốt SX" cài sau vòng sinh.
      if (isPast) {
        const leftoverKg = tron(totalIn * ng.tu(0.05, 0.08), 1);
        productionLocks.push({ id: `${date}|${x}`, lockDate: date, workshop: x, isLocked: true, lockedAt: `${date}T17:30:00.000Z`, totalKgAtLock: tron(totalFinishedGood, 1), reopenReason: "", note: "", leftoverKg, leftoverByMaterial: { [todayRows[0].materialTypeName]: leftoverKg } });
      }
      // QC cuối ngày
      for (const criterion of QC_CRITERIA) {
        const r0 = ng.r();
        const kq: QcResult = r0 < 0.85 ? "dat" : r0 < 0.97 ? "tam" : "khong-dat";
        qcChecklists.push({ id: id("qc"), date, workshop: x, criterion, result: kq, score: kq === "dat" ? ng.nguyen(8, 10) : kq === "tam" ? ng.nguyen(6, 7) : ng.nguyen(3, 5), note: kq === "dat" ? "" : "Đã nhắc tổ khắc phục", backdateReason: "" });
      }
      if (isPast) qcLocks.push({ id: `${date}|${x}`, lockDate: date, workshop: x, isLocked: true, lockedAt: `${date}T18:00:00.000Z`, totalKgAtLock: 0, reopenReason: "", note: "" });
    });
  });

  // ---- Cài sẵn ca cảnh báo — chọn đúng ngày CÓ số (không phó mặc ngẫu nhiên) ----
  const newestFirst = (a0: DailyLock, b0: DailyLock) => b0.lockDate.localeCompare(a0.lockDate);
  const dayBeforeYesterday = subtractDays(tc.homNay, 1);
  // 1. Ngày nhập chưa chốt: ngày gần nhất (trước hôm qua) của xưởng đầu.
  const firstWorkshopLocks = dailyLocks.filter((l) => l.workshop === ts.xuong[0] && l.lockDate < dayBeforeYesterday).sort(newestFirst);
  if (firstWorkshopLocks[0]) dailyLocks.splice(dailyLocks.indexOf(firstWorkshopLocks[0]), 1);
  // 2. Sổ nhập sửa sau khi chốt: tổng lúc chốt lệch 37 kg, ngày cách ≥ 7 ngày.
  const staleLock = firstWorkshopLocks.find((l) => l.lockDate <= subtractDays(tc.homNay, 7));
  if (staleLock) staleLock.totalKgAtLock -= 37;
  // 3. Ngày sản xuất chưa chốt: ngày gần nhất của xưởng cuối.
  const lastWorkshopLocks = productionLocks.filter((l) => l.workshop === ts.xuong[ts.xuong.length - 1] && l.lockDate < dayBeforeYesterday).sort(newestFirst);
  if (lastWorkshopLocks[0]) productionLocks.splice(productionLocks.indexOf(lastWorkshopLocks[0]), 1);
  // 4. BTP chờ duyệt lâu: một mẻ 5–9 ngày trước quên duyệt nhập kho.
  const unapprovedWip = wips.find((w) => w.productionDate <= subtractDays(tc.homNay, 5) && w.productionDate >= subtractDays(tc.homNay, 9));
  if (unapprovedWip) unapprovedWip.status = "cho-nhap";

  // ---- Kho → đóng gói / xuất đơn / bán: theo dõi phần còn của từng mẻ (FIFO) ----
  const con = new Map(wips.filter((w) => w.status === "da-nhap").map((w) => [w.id, w.quantityKg]));
  const olderBatches = (date: string, filter?: (w: WipProductionItem) => boolean) =>
    wips.filter((w) => w.status === "da-nhap" && w.productionDate < date && (con.get(w.id) ?? 0) > 20 && (!filter || filter(w)));
  /** Lấy kg NGUYÊN (làm tròn XUỐNG) khỏi mẻ — làm tròn lên là dùng quá lô 1 kg,
   *  hộ chiếu lô báo đỏ "dùng quá" sai. Trả đúng số đã trừ. */
  const lay = (wid: string, kg: number) => {
    const c = con.get(wid) ?? 0;
    const k = Math.max(0, Math.floor(Math.min(c, kg)));
    con.set(wid, c - k);
    return k;
  };

  const packagings: Packaging[] = [];
  const remainingFinishedGood = new Map<string, number>();
  ngays.forEach((date, i) => {
    if (i < 3 || i % 2 === 1 || dayOfWeek(date) === 0) return;
    for (const x of ts.xuong) {
      const w = olderBatches(date, (m) => m.workshop === x)[0];
      if (!w) continue;
      const inputKg = lay(w.id, w.quantityKg * ng.tu(0.4, 0.6));
      if (inputKg <= 0) continue;
      const ra = tron(inputKg * ng.tu(0.95, 0.97), 1);
      const p: Packaging = { id: id("goi"), date, workshop: x, fromProductId: w.productId, fromSpec: "", inputKg, inputBlocks: 0, toProductId: w.productId, toSpec: "Khay 1 kg", outputKg: ra, outputUnits: Math.max(1, tron(ra / 10)), warehouse: FG_WAREHOUSE, note: "" };
      packagings.push(p);
      remainingFinishedGood.set(p.id, ra);
      lotInputs.push({ id: id("gl"), outputKind: "P", outputId: p.id, inputKind: "W", inputId: w.id, inputLabel: sp.get(w.productId)?.name ?? "", material: "", quantityKg: inputKg, method: "quet", operator: "Demo", recordedAt: `${date}T10:00:00.000Z` });
      if (ng.r() < 0.7) printLabel("P", p.id, `${sp.get(p.toProductId)?.name ?? "TP"} · Khay 1 kg`, date);
    }
  });

  // Đơn đặt xuất khẩu + lệnh xuất FIFO
  const salesOrders: SalesOrder[] = [];
  const orderItems: OrderItem[] = [];
  const exportOrders: ExportOrder[] = [];
  const exportItems: ExportItem[] = [];
  const soDon = Math.max(3, Math.floor(days / 12));
  // Đơn chọn mặt hàng ĐÃ có trong kho (sản xuất nhiều nhất trước) — đơn hàng chưa từng
  // làm thì lệnh xuất rỗng, demo không có gì để kể.
  const kgTheoMH = new Map<string, number>();
  for (const w of wips) if (w.status === "da-nhap") kgTheoMH.set(w.productId, (kgTheoMH.get(w.productId) ?? 0) + w.quantityKg);
  const productsWithStock = [...kgTheoMH.entries()].sort((a0, b0) => b0[1] - a0[1]).map(([k]) => k);
  for (let d = 0; d < soDon; d++) {
    const orderDate = ngays[Math.floor(((d + 0.5) * ngays.length) / soDon) - 3] ?? ngays[0];
    const exportDate = subtractDays(orderDate, -4) <= tc.homNay ? subtractDays(orderDate, -4) : tc.homNay;
    const kh = customers[d % customers.length];
    const pid = productsWithStock.length ? productsWithStock[d % productsWithStock.length] : allProducts[d % allProducts.length];
    const don: SalesOrder = { id: id("don"), customerId: kh?.id ?? "", orderDate, status: "dang-gom", note: "Đơn demo" };
    salesOrders.push(don);
    const can = tron(ng.tu(800, 2_000), 10);
    orderItems.push({ id: id("dongdon"), orderId: don.id, productId: pid, spec: "", requiredQuantityKg: can, requiredBlocksCount: tron(can / 10) });
    const exportOrder: ExportOrder = { id: id("lenh"), orderId: don.id, exportDate, status: exportDate < tc.homNay ? "dong" : "mo", note: "" };
    let canCon = can;
    for (const w of olderBatches(exportDate, (m) => m.productId === pid)) {
      if (canCon <= 0) break;
      const kg = lay(w.id, canCon);
      if (kg <= 0) continue;
      canCon -= kg;
      const di: ExportItem = { id: id("xuat"), exportId: exportOrder.id, wipId: w.id, productId: w.productId, spec: "", quantityKg: kg, blocksCount: Math.max(1, tron(kg / 10)) };
      exportItems.push(di);
      if (ng.r() < 0.8) lotDispatches.push({ id: id("lr"), lotKind: "W", lotId: w.id, lotLabel: sp.get(w.productId)?.name ?? "", docKind: "export_item", docId: di.id, quantityKg: kg, method: "quet", operator: "Demo", recordedAt: `${exportDate}T08:00:00.000Z` });
    }
    // Chỉ "đã xuất" khi thật có lệnh xuất (kho có hàng) và ngày xuất đã qua.
    if (exportItems.some((x) => x.exportId === exportOrder.id)) {
      exportOrders.push(exportOrder);
      if (exportDate < tc.homNay) don.status = "dong";
    }
  }

  // Bán lẻ: TP đóng gói + block thô, mỗi ~4 ngày
  const salesInvoices: SalesInvoice[] = [];
  const salesItems: SalesItem[] = [];
  ngays.forEach((date, i) => {
    if (i < 6 || i % 4 !== 2 || dayOfWeek(date) === 0) return;
    const kh = customers[(i / 4) % customers.length | 0];
    const kenh = i % 8 === 2 ? "Xuất khẩu" : "Nội địa";
    const salesInvoice: SalesInvoice = { id: id("phieu"), deliveryDate: date, postingDate: date, backdateReason: "", workshop: ts.xuong[i % ts.xuong.length], customerId: kh?.id ?? "", channel: kenh, note: "" };
    const p = packagings.filter((g) => g.date < date && (remainingFinishedGood.get(g.id) ?? 0) > 10)[0];
    if (p) {
      const kg = Math.floor((remainingFinishedGood.get(p.id) ?? 0) * ng.tu(0.5, 0.8));
      remainingFinishedGood.set(p.id, (remainingFinishedGood.get(p.id) ?? 0) - kg);
      const b: SalesItem = { id: id("ban"), invoiceId: salesInvoice.id, deliveryDate: date, productId: p.toProductId, spec: p.toSpec, quantityKg: kg, unitPrice: kenh === "Xuất khẩu" ? 7.5 : tron(180_000 * priceFactor, 1_000), sourceWarehouse: FG_WAREHOUSE };
      salesItems.push(b);
      lotDispatches.push({ id: id("lr"), lotKind: "P", lotId: p.id, lotLabel: sp.get(p.toProductId)?.name ?? "", docKind: "sales_item", docId: b.id, quantityKg: kg, method: "chon", operator: "Demo", recordedAt: `${date}T11:00:00.000Z` });
    }
    const w = olderBatches(date)[0];
    if (w) {
      const kg = lay(w.id, ng.tu(100, 200));
      if (kg > 0) {
        const b: SalesItem = { id: id("ban"), invoiceId: salesInvoice.id, deliveryDate: date, productId: w.productId, spec: "", quantityKg: kg, unitPrice: kenh === "Xuất khẩu" ? 5.2 : tron(125_000 * priceFactor, 1_000), sourceWarehouse: RETAIL_WAREHOUSE };
        salesItems.push(b);
        if (ng.r() < 0.75) lotDispatches.push({ id: id("lr"), lotKind: "W", lotId: w.id, lotLabel: sp.get(w.productId)?.name ?? "", docKind: "sales_item", docId: b.id, quantityKg: kg, method: "chon", operator: "Demo", recordedAt: `${date}T11:00:00.000Z` });
      }
    }
    if (salesItems.some((x) => x.invoiceId === salesInvoice.id)) salesInvoices.push(salesInvoice);
  });
  // Cố ý: một dòng bán block thô VƯỢT tồn (cảnh báo "bán vượt tồn") hôm qua.
  const mhVuot = allProducts[allProducts.length - 1];
  const productStock = wips.filter((w) => w.productId === mhVuot && w.status === "da-nhap").reduce((s0, w) => s0 + (con.get(w.id) ?? 0), 0);
  const fo = finishedOpening.filter((o) => o.productId === mhVuot).reduce((s0, o) => s0 + o.quantityKg, 0);
  const overSoldInvoice: SalesInvoice = { id: id("phieu"), deliveryDate: yesterday, postingDate: yesterday, backdateReason: "", workshop: ts.xuong[0], customerId: customers[0]?.id ?? "", channel: "Nội địa", note: "" };
  salesInvoices.push(overSoldInvoice);
  salesItems.push({ id: id("ban"), invoiceId: overSoldInvoice.id, deliveryDate: yesterday, productId: mhVuot, spec: "", quantityKg: tron(productStock + fo + 45, 1), unitPrice: tron(120_000 * priceFactor, 1_000), sourceWarehouse: RETAIL_WAREHOUSE });

  // ---- Kỳ cân đối: 4 kỳ × 5 ngày của NL chính xưởng đầu, có kỳ lãi + kỳ lỗ ----
  const mainMaterial = ts.nlTheoXuong[ts.xuong[0]][0];
  const xChinh = ts.xuong[0];
  const periods: BalancingPeriod[] = [];
  const balancingInputs: BalancingInputItem[] = [];
  const balancingOutputs: BalancingOutputItem[] = [];
  const marginFactors = [1.09, 0.94, 1.12, 1.04];
  marginFactors.forEach((heSo, k) => {
    const den = subtractDays(tc.homNay, 1 + k * 6);
    const tu = subtractDays(den, 4);
    const pid = id("ky");
    const periodImports = imports.filter((r) => r.workshop === xChinh && r.materialTypeName === mainMaterial && r.deliveryDate >= tu && r.deliveryDate <= den);
    const periodBatches = wips.filter((w) => w.workshop === xChinh && w.productionDate >= tu && w.productionDate <= den);
    if (periodImports.length === 0 || periodBatches.length === 0) return;
    const materialKg = periodImports.reduce((s0, r) => s0 + r.quantityKg, 0);
    const avgPrice = periodImports.reduce((s0, r) => s0 + r.quantityKg * (r.unitPrice ?? 0), 0) / materialKg;
    periods.push({ id: pid, materialTypeName: mainMaterial, dateRangeDescription: `${tu.split("-").reverse().join("/")} – ${den.split("-").reverse().join("/")}`, startDate: tu, endDate: den, totalInputKg: materialKg, exchangeRate: EXCHANGE_RATE, processingCostPerKg: PROCESSING_COST, createdAt: `${den}T18:00:00.000Z`, isLocked: k > 0, lockedAt: k > 0 ? `${den}T18:00:00.000Z` : undefined });
    // Lưới cân đối TÍNH LẠI tổng dòng từ sản lượng theo ngày (cột Tổng là ô tính) và
    // tự ghi đè quantityKg ⇒ dòng phải mang dailyQuantities, tổng = quantityKg.
    const materialByDate: Record<string, number> = {};
    for (const r of periodImports) materialByDate[r.deliveryDate] = (materialByDate[r.deliveryDate] ?? 0) + r.quantityKg;
    balancingInputs.push({ id: id("cdv"), periodId: pid, groupName: "Thủy sản", name: mainMaterial, quantityKg: materialKg, unitPrice: tron(avgPrice, 100), ratioPercentage: null, sourceWarehouse: "Mua về", dailyQuantities: materialByDate });
    const grouped = new Map<string, number>();
    const finishedGoodByDate = new Map<string, Record<string, number>>();
    for (const w of periodBatches) {
      grouped.set(w.productId, (grouped.get(w.productId) ?? 0) + w.quantityKg);
      const d0 = finishedGoodByDate.get(w.productId) ?? {};
      d0[w.productionDate] = (d0[w.productionDate] ?? 0) + w.quantityKg;
      finishedGoodByDate.set(w.productId, d0);
    }
    const finishedGoodKg = [...grouped.values()].reduce((s0, v) => s0 + v, 0);
    const costPrice = materialKg * avgPrice + finishedGoodKg * PROCESSING_COST;
    const pricePerKg = (costPrice * heSo) / finishedGoodKg; // đ/kg TP để ra đúng biên lãi/lỗ
    [...grouped.entries()].forEach(([productId, kg], j) => {
      const xk = j % 2 === 0;
      balancingOutputs.push({ id: id("cdr"), periodId: pid, productId, customerId: customers[j % customers.length]?.id ?? "", channel: xk ? "Xuất khẩu" : "Nội địa", quantityKg: kg, dailyQuantities: finishedGoodByDate.get(productId) ?? {}, unitPrice: xk ? Math.round((pricePerKg / EXCHANGE_RATE) * 100) / 100 : tron(pricePerKg, 100) });
    });
  });

  // ---- Báo cáo kho của xí nghiệp: chép 3 tháng gần nhất (không có tên đối tác) ----
  const recentMonths = [...new Set(n.monthlyStock.map((m) => m.period))].sort().slice(-3);
  const monthlyStock = n.monthlyStock.filter((m) => recentMonths.includes(m.period)).map((m) => ({ ...m }));
  const nxtSnapshots = n.nxtSnapshots.map((x) => ({ ...x }));

  return {
    products: n.products.map((p) => ({ ...p })),
    materialTypes: n.materialTypes.map((m) => ({ ...m })),
    suppliers,
    customers,
    batterTypes: n.batterTypes.map((b) => ({ ...b })),
    storageLocations: n.storageLocations.map((x) => ({ ...x })),
    shipments,
    imports,
    dailyLocks,
    scraps,
    wips,
    productionLocks,
    packagings,
    salesOrders,
    orderItems,
    exportOrders,
    exportItems,
    salesInvoices,
    salesItems,
    domesticSales,
    lotInputs,
    lotDispatches,
    lotWaivers,
    labelPrints,
    qcChecklists,
    qcLocks,
    periods,
    balancingInputs,
    balancingOutputs,
    materialOpening,
    finishedOpening,
    nxtSnapshots,
    monthlyStock,
  };
}

/** Đếm dòng từng bảng của gói — để màn hiện "sẽ nạp gì" trước khi bấm. */
export function countBundle(g: GoiDemo): { bang: keyof GoiDemo; so: number }[] {
  return (Object.keys(g) as (keyof GoiDemo)[]).map((bang) => ({ bang, so: g[bang].length }));
}
