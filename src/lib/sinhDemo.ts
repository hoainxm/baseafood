// ============================================================
// Tên file: src/lib/sinhDemo.ts
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
 * Hàm THUẦN, tất định theo `hat` (cùng đầu vào ⇒ cùng gói) — test ở sinhDemo.test.ts.
 * Id trong gói là id của app; lên máy chủ tầng repo tự thêm tiền tố `demo:` (lib/cheDo).
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
import { KHO_BAN_LE, KHO_TP } from "@/lib/inventory";
import { cacNgay, luiNgay } from "@/lib/dongChay";

/** Sổ thật đưa vào để quét tham số (chỉ ĐỌC). */
export interface NguonDemo {
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

export interface TuyChonDemo {
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

const XUONG: Workshop[] = ["Đông", "Cá", "Khô"];
const TI_GIA = 25_500;
const CHI_PHI_CB = 8_000; // đ/kg TP
const TIEU_CHI_QC = ["Nhiệt độ bảo quản", "Vệ sinh dụng cụ", "Ngoại quan sản phẩm", "Kích cỡ đúng quy cách"];

/** PRNG mulberry32 — tất định theo hạt. */
function taoNgauNhien(hat: number) {
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

const tron = (n: number, buoc = 1) => Math.round(n / buoc) * buoc;
const trungVi = (xs: number[], macDinh: number) => {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : macDinh;
};
const phanVi = (xs: number[], p: number, macDinh: number) => {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : macDinh;
};
const thuTrongTuan = (ngay: string) => new Date(`${ngay}T00:00:00Z`).getUTCDay();
const so2 = (i: number) => String(i).padStart(2, "0");

/**
 * THAM SỐ quét từ sổ thật — tách riêng để test + để màn hiện "đã quét được gì".
 */
export interface ThamSoDemo {
  xuong: Workshop[];
  nlTheoXuong: Record<string, string[]>;
  daiLy: string[];
  kgDong: { thap: number; cao: number };
  giaNL: Record<string, number>;
  tiLeTP: number;
  matHangTheoNL: Record<string, string[]>;
  soDongNhapThat: number;
}

export function quetThamSo(n: NguonDemo): ThamSoDemo {
  const xuong = XUONG.filter((x) => n.imports.some((r) => r.workshop === x));
  const dsXuong = xuong.length ? xuong : XUONG;
  const nlTheoXuong: Record<string, string[]> = {};
  for (const x of dsXuong) {
    const dem = new Map<string, number>();
    for (const r of n.imports) if (r.workshop === x && r.materialTypeName) dem.set(r.materialTypeName, (dem.get(r.materialTypeName) ?? 0) + (r.quantityKg || 0));
    const ds = [...dem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    nlTheoXuong[x] = ds.length ? ds : n.materialTypes.slice(0, 2).map((m) => m.name).filter(Boolean);
    if (nlTheoXuong[x].length === 0) nlTheoXuong[x] = [`Nguyên liệu ${x}`];
  }
  const kgDaiLy = new Map<string, number>();
  for (const r of n.imports) if (r.supplierName) kgDaiLy.set(r.supplierName, (kgDaiLy.get(r.supplierName) ?? 0) + (r.quantityKg || 0));
  const daiLy = [...kgDaiLy.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const kgs = n.imports.map((r) => r.quantityKg || 0);
  const giaNL: Record<string, number> = {};
  for (const ten of new Set(Object.values(nlTheoXuong).flat()))
    giaNL[ten] = trungVi(n.imports.filter((r) => r.materialTypeName === ten).map((r) => r.unitPrice ?? 0), 60_000);
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
  const matHangTheoNL: Record<string, string[]> = {};
  for (const ten of new Set(Object.values(nlTheoXuong).flat())) {
    let ds = n.products.filter((p) => p.materialTypeId && tenNLtheoId.get(p.materialTypeId) === ten);
    if (ds.length === 0) {
      const loai = n.materialTypes.find((m) => m.name === ten)?.category;
      ds = n.products.filter((p) => loai && p.category === loai);
    }
    if (ds.length === 0) ds = n.products.slice(0, 6);
    matHangTheoNL[ten] = ds.slice(0, 5).map((p) => p.id);
  }
  return {
    xuong: dsXuong,
    nlTheoXuong,
    daiLy: daiLy.length ? daiLy.slice(0, 10) : ["Hồng Phú", "Bê 3", "Mậu H Tân"],
    kgDong: { thap: Math.max(200, phanVi(kgs, 0.25, 600)), cao: Math.max(400, phanVi(kgs, 0.75, 2_400)) },
    giaNL,
    tiLeTP: Math.min(0.75, Math.max(0.35, trungVi(tiLe, 0.45))),
    matHangTheoNL,
    soDongNhapThat: n.imports.length,
  };
}

/** Sinh gói demo đầy đủ chuỗi. Xem chú thích đầu file. */
export function sinhGoiDemo(n: NguonDemo, tc: TuyChonDemo): GoiDemo {
  const anDanh = tc.anDanh ?? true;
  const soNgay = Math.max(14, tc.soNgay ?? 60);
  const ng = taoNgauNhien(tc.hat ?? 20261012);
  const ts = quetThamSo(n);
  const luc = tc.lucGhi ?? `${tc.homNay}T08:00:00.000Z`;
  const ngays = cacNgay(luiNgay(tc.homNay, soNgay - 1), tc.homNay);
  const homQua = luiNgay(tc.homNay, 1);
  const heSoGia = anDanh ? 1.07 : 1;
  const ten = (loai: "dl" | "kh", i: number) => (loai === "dl" ? `Đại lý ${so2(i + 1)}` : `Khách hàng ${so2(i + 1)}`);
  const tenDaiLy = new Map(ts.daiLy.map((t, i) => [t, anDanh ? ten("dl", i) : t]));
  const daiLyDung = ts.daiLy.map((t) => tenDaiLy.get(t) as string);
  const sp = new Map(n.products.map((p) => [p.id, p]));

  // ---- Danh mục ----
  const suppliers: Supplier[] = ts.daiLy.map((t, i) => {
    const goc = n.suppliers.find((s0) => s0.shortName === t);
    return {
      id: `dm-dl-${i}`, // id mới: id thật có thể chứa tên đối tác
      code: String(i + 1),
      shortName: tenDaiLy.get(t) as string,
      billingName: anDanh ? (tenDaiLy.get(t) as string) : goc?.billingName || t,
      address: anDanh ? "" : goc?.address ?? "",
      nationalId: anDanh ? "" : goc?.nationalId ?? "",
      issuedDate: "",
      issuedPlace: "",
      phone: anDanh ? "" : goc?.phone ?? "",
      note: "Dữ liệu demo",
    };
  });
  const khGoc = n.customers.length
    ? n.customers.slice(0, 8)
    : (Array.from({ length: 6 }, (_, i) => ({ id: `dm-kh-${i}`, code: "", name: `KH ${i}`, market: i % 2 ? "Nội địa" : "Nhật Bản" })) as Customer[]);
  const customers: Customer[] = khGoc.map((c, i) => ({ ...c, id: `dm-kh-${i}`, code: String(i + 1), name: anDanh ? ten("kh", i) : c.name }));

  // ---- Tồn đầu (mốc = ngày đầu) ----
  const ngayDau = ngays[0];
  const materialOpening: MaterialOpeningStock[] = ts.xuong.map((x, i) => ({
    id: `dm-tdnl-${i}`,
    workshop: x,
    materialTypeName: ts.nlTheoXuong[x][0],
    asOfDate: ngayDau,
    quantityKg: tron(ng.tu(2_000, 5_000), 10),
    note: "Tồn đầu demo",
  }));
  const tatCaMatHang = [...new Set(Object.values(ts.matHangTheoNL).flat())];
  const finishedOpening: FinishedGoodsOpeningStock[] = tatCaMatHang.slice(0, 2).map((pid, i) => ({
    id: `dm-tdtp-${i}`,
    productId: pid,
    spec: "",
    asOfDate: ngayDau,
    quantityKg: tron(ng.tu(300, 800), 5),
    blocksCount: 0,
    warehouse: KHO_BAN_LE,
    note: "Tồn đầu demo",
  }));

  // Mặt hàng "lệch định mức" cố ý (cảnh báo định mức) — mặt hàng thứ 2 của xưởng đầu.
  const mhLech = ts.matHangTheoNL[ts.nlTheoXuong[ts.xuong[0]][0]][1] ?? tatCaMatHang[1];

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
  const conNL = new Map<string, number>();
  /** Lấy `can` kg NL từ các dòng còn hàng (nhiều nhất trước); trả các phần đã lấy,
   *  rỗng nếu không đủ — không bao giờ gắn quá số kg của lô. */
  const layNL = (dong: MaterialImportItem[], can: number): { dong: MaterialImportItem; kg: number }[] => {
    const tong = dong.reduce((s0, d) => s0 + (conNL.get(d.id) ?? 0), 0);
    if (can <= 0 || tong < can) return [];
    const ra: { dong: MaterialImportItem; kg: number }[] = [];
    let thieu = can;
    for (const d of [...dong].sort((a0, b0) => (conNL.get(b0.id) ?? 0) - (conNL.get(a0.id) ?? 0))) {
      if (thieu <= 0) break;
      const k = Math.min(conNL.get(d.id) ?? 0, thieu);
      if (k <= 0) continue;
      conNL.set(d.id, (conNL.get(d.id) ?? 0) - k);
      ra.push({ dong: d, kg: k });
      thieu -= k;
    }
    return ra;
  };
  const inTem = (k: LabelPrint["lotKind"], lotId: string, label: string, ngay: string) =>
    labelPrints.push({ id: id("tem"), lotKind: k, lotId, label, copies: 1, operator: "Demo", printedAt: `${ngay}T09:00:00.000Z` });

  ngays.forEach((ngay, i) => {
    if (thuTrongTuan(ngay) === 0) return; // Chủ nhật nghỉ
    const daQua = ngay < tc.homNay;
    const tienDo = i / Math.max(1, ngays.length - 1); // 0 → 1: tỉ lệ gắn lô tăng dần
    ts.xuong.forEach((x) => {
      if (ng.r() < 0.12) return; // vài ngày xưởng không nhận hàng
      const dsNL = ts.nlTheoXuong[x];
      let tongNhap = 0;
      const dongHomNay: MaterialImportItem[] = [];
      const soChuyen = ng.r() < 0.4 ? 2 : 1;
      for (let c = 0; c < soChuyen; c++) {
        const sid = id("chuyen");
        const ghiBu = daQua && ng.r() < 0.04;
        const ngayGhi = ghiBu ? (luiNgay(ngay, -1) <= tc.homNay ? luiNgay(ngay, -1) : ngay) : ngay;
        const dl = ng.chon(daiLyDung.slice(0, Math.max(3, daiLyDung.length)));
        shipments.push({
          id: sid,
          deliveryDate: ngay,
          postingDate: ngayGhi,
          backdateReason: ngayGhi > ngay ? "Phiếu cân về muộn, ghi bổ sung" : "",
          workshop: x,
          supplierName: dl,
          driverName: "",
          licensePlate: "",
          note: "",
          lotCode: `${x[0]}-${ngay.slice(2).replaceAll("-", "")}-${so2(c + 1)}`,
          operator: "Demo",
        });
        const soDong = ng.r() < 0.35 && dsNL.length > 1 ? 2 : 1;
        for (let d = 0; d < soDong; d++) {
          const nl = dsNL[d % dsNL.length];
          const kg = tron(ng.tu(ts.kgDong.thap, ts.kgDong.cao), 5);
          const dong: MaterialImportItem = {
            id: id("nhap"),
            shipmentId: sid,
            deliveryDate: ngay,
            workshop: x,
            category: "Khác",
            supplierName: dl,
            materialTypeName: nl,
            quantityKg: kg,
            unitPrice: tron((ts.giaNL[nl] ?? 60_000) * heSoGia * ng.tu(0.95, 1.05), 500),
            driverName: "",
            licensePlate: "",
            note: "",
          };
          imports.push(dong);
          dongHomNay.push(dong);
          conNL.set(dong.id, kg);
          tongNhap += kg;
          if (ng.r() < 0.7) inTem("S", dong.id, `${shipments[shipments.length - 1].lotCode} · ${nl}`, ngay);
        }
      }
      // Chốt ngày nhập (ca "chưa chốt" / "sửa sau chốt" cài sau vòng sinh).
      if (daQua)
        dailyLocks.push({ id: `${ngay}|${x}`, lockDate: ngay, workshop: x, isLocked: true, lockedAt: `${ngay}T17:00:00.000Z`, totalKgAtLock: tongNhap, reopenReason: "", note: "" });
      scraps.push({ id: id("phe"), periodId: "", name: "Nội tạng, đầu", quantityKg: tron(tongNhap * ng.tu(0.05, 0.07), 1), sellingPrice: 4_000, date: ngay, workshop: x, source: "Nhập hàng" });

      // Bán nội địa NL thẳng
      if (ng.r() < 0.2) {
        const dongNL = ng.chon(dongHomNay);
        const nd: DomesticSaleItem = {
          id: id("nd"),
          saleDate: ngay,
          postingDate: ngay,
          backdateReason: "",
          workshop: x,
          materialTypeName: dongNL.materialTypeName,
          quantityKg: tron(tongNhap * ng.tu(0.03, 0.06), 1),
          unitPrice: tron((dongNL.unitPrice ?? 60_000) * 0.8, 500),
          customerName: customers[customers.length - 1]?.name ?? "Chợ địa phương",
          note: "",
          operator: "Demo",
        };
        domesticSales.push(nd);
        if (ng.r() < 0.7)
          for (const p0 of layNL([dongNL], nd.quantityKg))
            lotDispatches.push({ id: id("lr"), lotKind: "S", lotId: p0.dong.id, lotLabel: p0.dong.materialTypeName, docKind: "domestic_sale", docId: nd.id, quantityKg: p0.kg, method: "chon", operator: "Demo", recordedAt: luc });
      }

      // Sản xuất BTP: TP ≈ NL × tỉ lệ ra thành phẩm (± nhiễu), chia 2–3 mẻ.
      // ≤ 92% NL vào thành BTP (phần còn: phế liệu, còn dở, bán nội địa, hao hụt) ⇒ NL
      // của ngày đủ để gắn lô cho các mẻ, kể cả mặt hàng "lệch định mức" (+13%).
      const tongTP = tongNhap * ts.tiLeTP * ng.tu(0.8, 0.9);
      const soMe = ng.r() < 0.5 ? 3 : 2;
      const dsMH = ts.matHangTheoNL[dongHomNay[0].materialTypeName] ?? tatCaMatHang;
      for (let m = 0; m < soMe; m++) {
        const pid = dsMH[(i + m) % dsMH.length];
        const kg = tron(tongTP / soMe, 1);
        // Chờ duyệt: 2 ngày gần nhất (ca "chờ duyệt lâu" cài sau vòng sinh).
        const choDuyet = ngay >= luiNgay(tc.homNay, 1);
        const ghiBu = daQua && ng.r() < 0.03;
        const w: WipProductionItem = {
          id: id("me"),
          productionDate: ngay,
          postingDate: ghiBu ? luiNgay(ngay, -1) : ngay,
          backdateReason: ghiBu ? "Tổ trưởng nghỉ, ghi bổ sung hôm sau" : "",
          workshop: x,
          productId: pid,
          spec: "",
          quantityKg: kg,
          blocksCount: Math.max(1, tron(kg / 10)),
          warehouse: KHO_BAN_LE,
          status: choDuyet ? "cho-nhap" : "da-nhap",
          note: "",
          processingType: sp.get(pid)?.processingType ?? "",
          operator: "Demo",
        };
        wips.push(w);
        // Gắn lô NL: tỉ lệ tăng dần theo thời gian (kể chuyện "từ khi dùng QR").
        const heSo = pid === mhLech ? 1.13 : ng.tu(0.98, 1.02);
        const phanNL = ng.r() < 0.45 + 0.5 * tienDo ? layNL(dongHomNay, tron((kg / ts.tiLeTP) * heSo, 1)) : [];
        if (phanNL.length > 0) {
          for (const p0 of phanNL)
            lotInputs.push({ id: id("gl"), outputKind: "W", outputId: w.id, inputKind: "S", inputId: p0.dong.id, inputLabel: p0.dong.materialTypeName, material: p0.dong.materialTypeName, quantityKg: p0.kg, method: "quet", operator: "Demo", recordedAt: `${ngay}T15:00:00.000Z` });
        } else if (daQua && ng.r() < 0.6) {
          lotWaivers.push({ id: id("ld"), outputKind: "W", outputId: w.id, reason: "Trộn NL nhiều chuyến trong mẻ", operator: "Demo", recordedAt: `${ngay}T17:00:00.000Z` });
        }
        if (ng.r() < 0.6) inTem("W", w.id, `${sp.get(pid)?.name ?? "BTP"} · ${ngay}`, ngay);
      }
      // Chốt ngày SX (ghi còn dở theo loại NL) — ca "chưa chốt SX" cài sau vòng sinh.
      if (daQua) {
        const conDo = tron(tongNhap * ng.tu(0.05, 0.08), 1);
        productionLocks.push({ id: `${ngay}|${x}`, lockDate: ngay, workshop: x, isLocked: true, lockedAt: `${ngay}T17:30:00.000Z`, totalKgAtLock: tron(tongTP, 1), reopenReason: "", note: "", leftoverKg: conDo, leftoverByMaterial: { [dongHomNay[0].materialTypeName]: conDo } });
      }
      // QC cuối ngày
      for (const tieuChi of TIEU_CHI_QC) {
        const r0 = ng.r();
        const kq: QcResult = r0 < 0.85 ? "dat" : r0 < 0.97 ? "tam" : "khong-dat";
        qcChecklists.push({ id: id("qc"), date: ngay, workshop: x, criterion: tieuChi, result: kq, score: kq === "dat" ? ng.nguyen(8, 10) : kq === "tam" ? ng.nguyen(6, 7) : ng.nguyen(3, 5), note: kq === "dat" ? "" : "Đã nhắc tổ khắc phục", backdateReason: "" });
      }
      if (daQua) qcLocks.push({ id: `${ngay}|${x}`, lockDate: ngay, workshop: x, isLocked: true, lockedAt: `${ngay}T18:00:00.000Z`, totalKgAtLock: 0, reopenReason: "", note: "" });
    });
  });

  // ---- Cài sẵn ca cảnh báo — chọn đúng ngày CÓ số (không phó mặc ngẫu nhiên) ----
  const moiTruoc = (a0: DailyLock, b0: DailyLock) => b0.lockDate.localeCompare(a0.lockDate);
  const truocHomQua = luiNgay(tc.homNay, 1);
  // 1. Ngày nhập chưa chốt: ngày gần nhất (trước hôm qua) của xưởng đầu.
  const chotX0 = dailyLocks.filter((l) => l.workshop === ts.xuong[0] && l.lockDate < truocHomQua).sort(moiTruoc);
  if (chotX0[0]) dailyLocks.splice(dailyLocks.indexOf(chotX0[0]), 1);
  // 2. Sổ nhập sửa sau khi chốt: tổng lúc chốt lệch 37 kg, ngày cách ≥ 7 ngày.
  const chotLech = chotX0.find((l) => l.lockDate <= luiNgay(tc.homNay, 7));
  if (chotLech) chotLech.totalKgAtLock -= 37;
  // 3. Ngày sản xuất chưa chốt: ngày gần nhất của xưởng cuối.
  const chotSX = productionLocks.filter((l) => l.workshop === ts.xuong[ts.xuong.length - 1] && l.lockDate < truocHomQua).sort(moiTruoc);
  if (chotSX[0]) productionLocks.splice(productionLocks.indexOf(chotSX[0]), 1);
  // 4. BTP chờ duyệt lâu: một mẻ 5–9 ngày trước quên duyệt nhập kho.
  const quenDuyet = wips.find((w) => w.productionDate <= luiNgay(tc.homNay, 5) && w.productionDate >= luiNgay(tc.homNay, 9));
  if (quenDuyet) quenDuyet.status = "cho-nhap";

  // ---- Kho → đóng gói / xuất đơn / bán: theo dõi phần còn của từng mẻ (FIFO) ----
  const con = new Map(wips.filter((w) => w.status === "da-nhap").map((w) => [w.id, w.quantityKg]));
  const meCu = (ngay: string, loc?: (w: WipProductionItem) => boolean) =>
    wips.filter((w) => w.status === "da-nhap" && w.productionDate < ngay && (con.get(w.id) ?? 0) > 20 && (!loc || loc(w)));
  /** Lấy kg NGUYÊN (làm tròn XUỐNG) khỏi mẻ — làm tròn lên là dùng quá lô 1 kg,
   *  hộ chiếu lô báo đỏ "dùng quá" sai. Trả đúng số đã trừ. */
  const lay = (wid: string, kg: number) => {
    const c = con.get(wid) ?? 0;
    const k = Math.max(0, Math.floor(Math.min(c, kg)));
    con.set(wid, c - k);
    return k;
  };

  const packagings: Packaging[] = [];
  const conTP = new Map<string, number>();
  ngays.forEach((ngay, i) => {
    if (i < 3 || i % 2 === 1 || thuTrongTuan(ngay) === 0) return;
    for (const x of ts.xuong) {
      const w = meCu(ngay, (m) => m.workshop === x)[0];
      if (!w) continue;
      const vao = lay(w.id, w.quantityKg * ng.tu(0.4, 0.6));
      if (vao <= 0) continue;
      const ra = tron(vao * ng.tu(0.95, 0.97), 1);
      const p: Packaging = { id: id("goi"), date: ngay, workshop: x, fromProductId: w.productId, fromSpec: "", inputKg: vao, inputBlocks: 0, toProductId: w.productId, toSpec: "Khay 1 kg", outputKg: ra, outputUnits: Math.max(1, tron(ra / 10)), warehouse: KHO_TP, note: "" };
      packagings.push(p);
      conTP.set(p.id, ra);
      lotInputs.push({ id: id("gl"), outputKind: "P", outputId: p.id, inputKind: "W", inputId: w.id, inputLabel: sp.get(w.productId)?.name ?? "", material: "", quantityKg: vao, method: "quet", operator: "Demo", recordedAt: `${ngay}T10:00:00.000Z` });
      if (ng.r() < 0.7) inTem("P", p.id, `${sp.get(p.toProductId)?.name ?? "TP"} · Khay 1 kg`, ngay);
    }
  });

  // Đơn đặt xuất khẩu + lệnh xuất FIFO
  const salesOrders: SalesOrder[] = [];
  const orderItems: OrderItem[] = [];
  const exportOrders: ExportOrder[] = [];
  const exportItems: ExportItem[] = [];
  const soDon = Math.max(3, Math.floor(soNgay / 12));
  // Đơn chọn mặt hàng ĐÃ có trong kho (sản xuất nhiều nhất trước) — đơn hàng chưa từng
  // làm thì lệnh xuất rỗng, demo không có gì để kể.
  const kgTheoMH = new Map<string, number>();
  for (const w of wips) if (w.status === "da-nhap") kgTheoMH.set(w.productId, (kgTheoMH.get(w.productId) ?? 0) + w.quantityKg);
  const mhCoHang = [...kgTheoMH.entries()].sort((a0, b0) => b0[1] - a0[1]).map(([k]) => k);
  for (let d = 0; d < soDon; d++) {
    const ngayDon = ngays[Math.floor(((d + 0.5) * ngays.length) / soDon) - 3] ?? ngays[0];
    const ngayXuat = luiNgay(ngayDon, -4) <= tc.homNay ? luiNgay(ngayDon, -4) : tc.homNay;
    const kh = customers[d % customers.length];
    const pid = mhCoHang.length ? mhCoHang[d % mhCoHang.length] : tatCaMatHang[d % tatCaMatHang.length];
    const don: SalesOrder = { id: id("don"), customerId: kh?.id ?? "", orderDate: ngayDon, status: "dang-gom", note: "Đơn demo" };
    salesOrders.push(don);
    const can = tron(ng.tu(800, 2_000), 10);
    orderItems.push({ id: id("dongdon"), orderId: don.id, productId: pid, spec: "", requiredQuantityKg: can, requiredBlocksCount: tron(can / 10) });
    const lenh: ExportOrder = { id: id("lenh"), orderId: don.id, exportDate: ngayXuat, status: ngayXuat < tc.homNay ? "dong" : "mo", note: "" };
    let canCon = can;
    for (const w of meCu(ngayXuat, (m) => m.productId === pid)) {
      if (canCon <= 0) break;
      const kg = lay(w.id, canCon);
      if (kg <= 0) continue;
      canCon -= kg;
      const di: ExportItem = { id: id("xuat"), exportId: lenh.id, wipId: w.id, productId: w.productId, spec: "", quantityKg: kg, blocksCount: Math.max(1, tron(kg / 10)) };
      exportItems.push(di);
      if (ng.r() < 0.8) lotDispatches.push({ id: id("lr"), lotKind: "W", lotId: w.id, lotLabel: sp.get(w.productId)?.name ?? "", docKind: "export_item", docId: di.id, quantityKg: kg, method: "quet", operator: "Demo", recordedAt: `${ngayXuat}T08:00:00.000Z` });
    }
    // Chỉ "đã xuất" khi thật có lệnh xuất (kho có hàng) và ngày xuất đã qua.
    if (exportItems.some((x) => x.exportId === lenh.id)) {
      exportOrders.push(lenh);
      if (ngayXuat < tc.homNay) don.status = "dong";
    }
  }

  // Bán lẻ: TP đóng gói + block thô, mỗi ~4 ngày
  const salesInvoices: SalesInvoice[] = [];
  const salesItems: SalesItem[] = [];
  ngays.forEach((ngay, i) => {
    if (i < 6 || i % 4 !== 2 || thuTrongTuan(ngay) === 0) return;
    const kh = customers[(i / 4) % customers.length | 0];
    const kenh = i % 8 === 2 ? "Xuất khẩu" : "Nội địa";
    const phieu: SalesInvoice = { id: id("phieu"), deliveryDate: ngay, postingDate: ngay, backdateReason: "", workshop: ts.xuong[i % ts.xuong.length], customerId: kh?.id ?? "", channel: kenh, note: "" };
    const p = packagings.filter((g) => g.date < ngay && (conTP.get(g.id) ?? 0) > 10)[0];
    if (p) {
      const kg = Math.floor((conTP.get(p.id) ?? 0) * ng.tu(0.5, 0.8));
      conTP.set(p.id, (conTP.get(p.id) ?? 0) - kg);
      const b: SalesItem = { id: id("ban"), invoiceId: phieu.id, deliveryDate: ngay, productId: p.toProductId, spec: p.toSpec, quantityKg: kg, unitPrice: kenh === "Xuất khẩu" ? 7.5 : tron(180_000 * heSoGia, 1_000), sourceWarehouse: KHO_TP };
      salesItems.push(b);
      lotDispatches.push({ id: id("lr"), lotKind: "P", lotId: p.id, lotLabel: sp.get(p.toProductId)?.name ?? "", docKind: "sales_item", docId: b.id, quantityKg: kg, method: "chon", operator: "Demo", recordedAt: `${ngay}T11:00:00.000Z` });
    }
    const w = meCu(ngay)[0];
    if (w) {
      const kg = lay(w.id, ng.tu(100, 200));
      if (kg > 0) {
        const b: SalesItem = { id: id("ban"), invoiceId: phieu.id, deliveryDate: ngay, productId: w.productId, spec: "", quantityKg: kg, unitPrice: kenh === "Xuất khẩu" ? 5.2 : tron(125_000 * heSoGia, 1_000), sourceWarehouse: KHO_BAN_LE };
        salesItems.push(b);
        if (ng.r() < 0.75) lotDispatches.push({ id: id("lr"), lotKind: "W", lotId: w.id, lotLabel: sp.get(w.productId)?.name ?? "", docKind: "sales_item", docId: b.id, quantityKg: kg, method: "chon", operator: "Demo", recordedAt: `${ngay}T11:00:00.000Z` });
      }
    }
    if (salesItems.some((x) => x.invoiceId === phieu.id)) salesInvoices.push(phieu);
  });
  // Cố ý: một dòng bán block thô VƯỢT tồn (cảnh báo "bán vượt tồn") hôm qua.
  const mhVuot = tatCaMatHang[tatCaMatHang.length - 1];
  const tonMH = wips.filter((w) => w.productId === mhVuot && w.status === "da-nhap").reduce((s0, w) => s0 + (con.get(w.id) ?? 0), 0);
  const fo = finishedOpening.filter((o) => o.productId === mhVuot).reduce((s0, o) => s0 + o.quantityKg, 0);
  const phieuVuot: SalesInvoice = { id: id("phieu"), deliveryDate: homQua, postingDate: homQua, backdateReason: "", workshop: ts.xuong[0], customerId: customers[0]?.id ?? "", channel: "Nội địa", note: "" };
  salesInvoices.push(phieuVuot);
  salesItems.push({ id: id("ban"), invoiceId: phieuVuot.id, deliveryDate: homQua, productId: mhVuot, spec: "", quantityKg: tron(tonMH + fo + 45, 1), unitPrice: tron(120_000 * heSoGia, 1_000), sourceWarehouse: KHO_BAN_LE });

  // ---- Kỳ cân đối: 4 kỳ × 5 ngày của NL chính xưởng đầu, có kỳ lãi + kỳ lỗ ----
  const nlChinh = ts.nlTheoXuong[ts.xuong[0]][0];
  const xChinh = ts.xuong[0];
  const periods: BalancingPeriod[] = [];
  const balancingInputs: BalancingInputItem[] = [];
  const balancingOutputs: BalancingOutputItem[] = [];
  const bienLai = [1.09, 0.94, 1.12, 1.04];
  bienLai.forEach((heSo, k) => {
    const den = luiNgay(tc.homNay, 1 + k * 6);
    const tu = luiNgay(den, 4);
    const pid = id("ky");
    const nhapKy = imports.filter((r) => r.workshop === xChinh && r.materialTypeName === nlChinh && r.deliveryDate >= tu && r.deliveryDate <= den);
    const meKy = wips.filter((w) => w.workshop === xChinh && w.productionDate >= tu && w.productionDate <= den);
    if (nhapKy.length === 0 || meKy.length === 0) return;
    const kgNL = nhapKy.reduce((s0, r) => s0 + r.quantityKg, 0);
    const giaTB = nhapKy.reduce((s0, r) => s0 + r.quantityKg * (r.unitPrice ?? 0), 0) / kgNL;
    periods.push({ id: pid, materialTypeName: nlChinh, dateRangeDescription: `${tu.split("-").reverse().join("/")} – ${den.split("-").reverse().join("/")}`, startDate: tu, endDate: den, totalInputKg: kgNL, exchangeRate: TI_GIA, processingCostPerKg: CHI_PHI_CB, createdAt: `${den}T18:00:00.000Z`, isLocked: k > 0, lockedAt: k > 0 ? `${den}T18:00:00.000Z` : undefined });
    // Lưới cân đối TÍNH LẠI tổng dòng từ sản lượng theo ngày (cột Tổng là ô tính) và
    // tự ghi đè quantityKg ⇒ dòng phải mang dailyQuantities, tổng = quantityKg.
    const nlNgay: Record<string, number> = {};
    for (const r of nhapKy) nlNgay[r.deliveryDate] = (nlNgay[r.deliveryDate] ?? 0) + r.quantityKg;
    balancingInputs.push({ id: id("cdv"), periodId: pid, groupName: "Thủy sản", name: nlChinh, quantityKg: kgNL, unitPrice: tron(giaTB, 100), ratioPercentage: null, sourceWarehouse: "Mua về", dailyQuantities: nlNgay });
    const gom = new Map<string, number>();
    const tpNgay = new Map<string, Record<string, number>>();
    for (const w of meKy) {
      gom.set(w.productId, (gom.get(w.productId) ?? 0) + w.quantityKg);
      const d0 = tpNgay.get(w.productId) ?? {};
      d0[w.productionDate] = (d0[w.productionDate] ?? 0) + w.quantityKg;
      tpNgay.set(w.productId, d0);
    }
    const kgTP = [...gom.values()].reduce((s0, v) => s0 + v, 0);
    const giaThanh = kgNL * giaTB + kgTP * CHI_PHI_CB;
    const giaKg = (giaThanh * heSo) / kgTP; // đ/kg TP để ra đúng biên lãi/lỗ
    [...gom.entries()].forEach(([productId, kg], j) => {
      const xk = j % 2 === 0;
      balancingOutputs.push({ id: id("cdr"), periodId: pid, productId, customerId: customers[j % customers.length]?.id ?? "", channel: xk ? "Xuất khẩu" : "Nội địa", quantityKg: kg, dailyQuantities: tpNgay.get(productId) ?? {}, unitPrice: xk ? Math.round((giaKg / TI_GIA) * 100) / 100 : tron(giaKg, 100) });
    });
  });

  // ---- Báo cáo kho của xí nghiệp: chép 3 tháng gần nhất (không có tên đối tác) ----
  const thangGanNhat = [...new Set(n.monthlyStock.map((m) => m.period))].sort().slice(-3);
  const monthlyStock = n.monthlyStock.filter((m) => thangGanNhat.includes(m.period)).map((m) => ({ ...m }));
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
export function demGoi(g: GoiDemo): { bang: keyof GoiDemo; so: number }[] {
  return (Object.keys(g) as (keyof GoiDemo)[]).map((bang) => ({ bang, so: g[bang].length }));
}
