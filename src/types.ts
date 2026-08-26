// ============================================================
// Tên file: src/types.ts
// Tên tiếng Việt tương đương: Định nghĩa Kiểu dữ liệu & Invariants Nghiệp vụ
// Description: TypeScript Types & Invariant Business Interfaces
// ============================================================
export interface FinishedGood {
  code: string;
  name: string;
  unit: string;
  accountCode: string;
  groupName: string;
}

export type Workshop = "Đông" | "Cá" | "Khô";

/* ---------- User & Permissions ---------- */

export type Role =
  | "admin"
  | "director"
  | "vice-director"
  | "manager-dong"
  | "manager-ca"
  | "manager-kho"
  | "accountant"
  | "team-leader"
  | "warehouse-keeper";

export const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Quản trị (full quyền)" },
  { value: "director", label: "Giám đốc" },
  { value: "vice-director", label: "Phó giám đốc" },
  { value: "manager-dong", label: "Quản đốc xưởng Đông" },
  { value: "manager-ca", label: "Quản đốc xưởng Cá" },
  { value: "manager-kho", label: "Quản đốc xưởng Khô" },
  { value: "team-leader", label: "Tổ trưởng sản xuất" },
  { value: "warehouse-keeper", label: "Thủ kho / nhập hàng" },
  { value: "accountant", label: "Kế toán" },
];

export function rolesFromCsv(csv: string): Role[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Role[];
}

export function rolesToCsv(arr: Role[]): string {
  return arr.join(",");
}

export function rolesList(v: unknown): Role[] {
  if (Array.isArray(v)) return v as Role[];
  if (typeof v === "string") return rolesFromCsv(v);
  return [];
}

export function roleLabel(arr: Role[] | string | null | undefined): string {
  const a = rolesList(arr);
  if (!a.length) return "Chưa gán";
  return a.map((v) => ROLES.find((x) => x.value === v)?.label ?? v).join(", ");
}

export interface UserProfile {
  id: string; // = auth.users.id
  fullName: string;
  username: string;
  roles: Role[]; // multiple roles; [] = unassigned
}

/**
 * Loài (nhóm thủy sản) — DANH SÁCH CHUẨN DUY NHẤT của toàn hệ thống.
 * Dùng cho cả loại nguyên liệu, mặt hàng và sổ nhập. Trước đây có 2 danh sách
 * lệch nhau (thiếu "Ghẹ" ở một nơi, thiếu "Bào ngư" ở nơi kia) → gộp về đây.
 */
export const CATEGORIES = [
  "Bạch tuộc",
  "Mực",
  "Cá",
  "Tôm",
  "Ghẹ",
  "Bào ngư",
  "Khác",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ImportShipment {
  id: string;
  deliveryDate: string; // yyyy-mm-dd
  postingDate: string; // yyyy-mm-dd
  backdateReason: string; // required when postingDate > deliveryDate
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
}

export function isBackdatedImport(c: Pick<ImportShipment, "deliveryDate" | "postingDate">): boolean {
  return Boolean(c.postingDate) && c.postingDate > c.deliveryDate;
}

export interface MaterialImportItem {
  id: string;
  shipmentId: string;
  deliveryDate: string; // yyyy-mm-dd
  workshop: Workshop;
  category: Category;
  supplierName: string;
  materialTypeName: string;
  quantityKg: number;
  unitPrice: number | null;
  driverName: string;
  licensePlate: string;
  note: string;
  /** Kỳ cân đối đã hút dòng này (rỗng = chưa gắn kỳ nào). */
  balancingPeriodId?: string;
}

export function calculateImportAmount(r: Pick<MaterialImportItem, "quantityKg" | "unitPrice">): number {
  return r.quantityKg * (r.unitPrice ?? 0);
}

export interface DailyLock {
  id: string;
  lockDate: string; // yyyy-mm-dd
  workshop: Workshop;
  isLocked: boolean;
  lockedAt: string; // ISO datetime
  totalKgAtLock: number;
  reopenReason: string;
  note: string;
  /** Chỉ production_locks (migration 0028): nguyên liệu còn dở cuối ngày đem lưu kho (kg). */
  leftoverKg?: number;
}

/* ---------- 5-Day Balancing (Dong workshop) ---------- */

export interface Product {
  id: string;
  code: string;
  name: string;
  finishedGoodCode: string;
  category?: string; // nhóm LOÀI (Bạch tuộc/Mực/Cá…)
  materialTypeId?: string; // nguyên liệu / loại NL
  processingType?: string; // KIỂU CHẾ BIẾN (luộc/chần/cắt/tẩm bột…) — facet thứ 3, migration 0027
  /** Mã tách 2 thành phần râu/bao tử (cùng giá) — chỉ mã này mới hiện ô tách ở
   *  màn ghi thành phẩm. Migration 0031. Nhận cả boolean lẫn chuỗi "1"/"" từ
   *  danh mục (CRUD lưu chuỗi) — đọc bằng `laCoTach()`. */
  splitComponents?: boolean | string;
  /** Quy cách MỖI block (kg/khối). Migration 0031. Danh mục lưu chuỗi. */
  blockSpecKg?: number | string | null;
}

/** Mặt hàng có tách râu/bao tử không (chịu cả boolean lẫn chuỗi "1"/"true"). */
export function laCoTach(p: Pick<Product, "splitComponents"> | undefined): boolean {
  const v = p?.splitComponents;
  return v === true || v === "1" || v === "true";
}

/** Quy cách block (kg/khối) dạng số, 0/không hợp lệ → null. */
export function quyCachBlock(p: Pick<Product, "blockSpecKg"> | undefined): number | null {
  const n = Number(p?.blockSpecKg);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  market: string; // e.g. Japan, EU, domestic
}

export interface Supplier {
  id: string;
  code: string;
  shortName: string;
  billingName: string;
  address: string;
  nationalId: string;
  issuedDate: string;
  issuedPlace: string;
  phone: string;
  note: string;
}

export interface MaterialType {
  id: string;
  name: string;
  category: string; // category belongs to Category
  note: string;
}

export type InputGroup = "Thủy sản" | "Xả đông" | "Bột phụ gia";
export const INPUT_GROUPS: InputGroup[] = ["Thủy sản", "Xả đông", "Bột phụ gia"];

export type SalesChannel = "Xuất khẩu" | "Nội địa";
export const SALES_CHANNELS: SalesChannel[] = ["Xuất khẩu", "Nội địa"];

export interface BalancingPeriod {
  id: string;
  materialTypeName: string;
  dateRangeDescription: string;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
  totalInputKg: number | null;
  exchangeRate: number | null; // VND/USD (e.g. 26000)
  processingCostPerKg: number | null; // VND
  createdAt: string;
  /** Chốt kỳ — khoá số sau khi gửi kế toán. Mở lại được nhưng phải ghi lý do. */
  isLocked?: boolean;
  lockedAt?: string;
  lockNote?: string;
  reopenReason?: string;
}

/** Nguồn dựng dòng lưới: rỗng = nhập tay, còn lại = dựng từ sổ khác. */
export type GridAutoSource = "" | "imports" | "production" | "sales";

/** Sản lượng theo ngày trong kỳ: { "2025-07-22": 5120 }. */
export type DailyQuantities = Record<string, number>;

export interface BalancingInputItem {
  id: string;
  periodId: string;
  groupName: InputGroup;
  name: string;
  quantityKg: number;
  unitPrice: number | null; // VND
  ratioPercentage: number | null; // % (for additive powder)
  sourceWarehouse?: string; // "Mua về" | "Kho mình"
  /** Chỉ dùng cho dòng nhập tay — dòng hút lấy ngày từ sổ nhập hàng. */
  dailyQuantities?: DailyQuantities;
  /** Chuyển kỳ: âm = đẩy sang kỳ sau, dương = lấy từ kỳ trước. */
  carryOverKg?: number;
  /** Kỳ đã nhận phần chuyển kỳ âm của dòng này (chống lấy hai lần). */
  carryOverPeriodId?: string;
  /** Dòng "Giảm": nguyên liệu không chế biến hết, nhập về kho xưởng. */
  isReduction?: boolean;
  reductionWarehouseId?: string;
  autoSource?: GridAutoSource;
}

export type ScrapSource = "Nhập hàng" | "Cân đối";

export interface ScrapItem {
  id: string;
  periodId: string; // empty = unassigned
  name: string; // e.g. organs, scrap
  quantityKg: number;
  sellingPrice: number | null; // VND
  date: string; // yyyy-mm-dd
  workshop: Workshop | "";
  source: ScrapSource;
}

export interface BalancingOutputItem {
  id: string;
  periodId: string;
  productId: string;
  customerId: string;
  channel: SalesChannel;
  quantityKg: number;
  unitPrice: number | null; // USD or VND
  spec?: string;
  salesItemId?: string;
  /** Chỉ dùng cho dòng nhập tay — dòng hút lấy ngày từ sổ sản xuất. */
  dailyQuantities?: DailyQuantities;
  /** Chuyển kỳ: âm = đẩy sang kỳ sau, dương = lấy từ kỳ trước. */
  carryOverKg?: number;
  /** Kỳ nhận phần chuyển kỳ âm (dựng dòng đối ứng ở kỳ sau). */
  carryOverPeriodId?: string;
  autoSource?: GridAutoSource;
}

/**
 * Tổng của một dòng lưới = tổng sản lượng các ngày + phần chuyển kỳ.
 * Cột Tổng là ô TÍNH, không cho gõ — đây là chỗ bảng Excel gốc sai
 * (mặt hàng chép hai lần, tổng lệch 1.109 kg).
 */
export function sumGridRow(daily: DailyQuantities | undefined, carryOverKg?: number): number {
  const days = daily ? Object.values(daily).reduce((s, v) => s + (v || 0), 0) : 0;
  return days + (carryOverKg ?? 0);
}

/* ---------- Daily Sales ---------- */

export interface SalesInvoice {
  id: string;
  deliveryDate: string; // yyyy-mm-dd
  postingDate: string; // yyyy-mm-dd
  backdateReason: string;
  workshop: Workshop;
  customerId: string;
  channel: SalesChannel;
  note: string;
}

export function isBackdatedSales(p: Pick<SalesInvoice, "deliveryDate" | "postingDate">): boolean {
  return Boolean(p.postingDate) && p.postingDate > p.deliveryDate;
}

export interface SalesItem {
  id: string;
  invoiceId: string;
  deliveryDate: string; // yyyy-mm-dd
  productId: string;
  spec: string;
  quantityKg: number;
  unitPrice: number | null; // USD or VND
  sourceWarehouse: string; // "" | "SX" | "Lưu trữ" | "Đơn đặt" (handoff từ lệnh xuất đơn — không đếm hai lần ở NXT)
}

export function calculateSalesAmount(r: Pick<SalesItem, "quantityKg" | "unitPrice">): number {
  return r.quantityKg * (r.unitPrice ?? 0);
}

/* ---------- WIP Production Module ---------- */

export type WipWarehouseStatus = "cho-nhap" | "da-nhap";

export interface WipProductionItem {
  id: string;
  productionDate: string; // yyyy-mm-dd
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  productId: string;
  spec: string;
  quantityKg: number; // TỔNG khối lượng dòng (khi tách = râu + bao tử)
  blocksCount: number;
  warehouse: string;
  status: WipWarehouseStatus;
  note: string;
  /** Khách hàng của dòng thành phẩm (làm theo đơn) — lưu theo TÊN. */
  customerName?: string;
  /** Thành phẩm tách 2 thành phần cùng giá (VD cắt chần: râu + bao tử).
   *  null = dòng KHÔNG tách. quantityKg vẫn giữ tổng để cân đối dùng. */
  componentRauKg?: number | null;
  componentBaoTuKg?: number | null;
  /** Kỳ cân đối đã hút dòng này (rỗng = chưa gắn kỳ nào). */
  balancingPeriodId?: string;
}

export function isBackdatedWip(c: Pick<WipProductionItem, "productionDate" | "postingDate">): boolean {
  return Boolean(c.postingDate) && c.postingDate > c.productionDate;
}

/* ---------- Đóng gói BTP → Thành phẩm (G3, migration 0029) ---------- */

/** Một phiếu đóng gói: BTP tiêu hao → TP đóng gói ra. Hao hụt = inputKg − outputKg. */
export interface Packaging {
  id: string;
  date: string; // yyyy-mm-dd
  workshop: Workshop;
  // BTP tiêu hao (định danh theo mặt hàng + quy cách, như tồn WIP)
  fromProductId: string;
  fromSpec: string;
  inputKg: number;
  inputBlocks: number;
  // TP đóng gói ra
  toProductId: string;
  toSpec: string;
  outputKg: number;
  outputUnits: number; // số thùng / gói
  warehouse: string; // kho chứa TP đóng gói
  note: string;
}

/** Hao hụt đóng gói (kg) = BTP vào − TP ra. Âm = ghi nhầm (TP ra > BTP vào). */
export function haoHutDongGoi(p: Pick<Packaging, "inputKg" | "outputKg">): number {
  return p.inputKg - p.outputKg;
}

export type SalesOrderStatus = "dang-gom" | "du" | "dong";

export interface SalesOrder {
  id: string;
  customerId: string;
  orderDate: string;
  status: SalesOrderStatus;
  note: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  spec: string;
  requiredQuantityKg: number;
  requiredBlocksCount: number;
}

export interface ExportOrder {
  id: string;
  orderId: string;
  exportDate: string;
  status: "mo" | "dong";
  note: string;
}

export interface ExportItem {
  id: string;
  exportId: string;
  wipId: string;
  productId: string;
  spec: string;
  quantityKg: number;
  blocksCount: number;
}

/* ---------- BSF1 Warehouse & NXT Report Types ---------- */

export type WarehouseType = "xi-nghiep" | "phan-xuong";

export interface WarehouseInfo {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  capacityKg: number; // (kg) e.g. 1,000,000 kg (1000 tấn), 1,500,000 kg (1500 tấn), 250,000 kg (250 tấn)
  workshop?: Workshop;
  note?: string;
}

export type NxtGoodsCategory = "Hàng nhập khẩu" | "Hàng trong nước" | "Hàng tạm";

export const NXT_GOODS_CATEGORIES: NxtGoodsCategory[] = [
  "Hàng nhập khẩu",
  "Hàng trong nước",
  "Hàng tạm",
];

export const BSF1_WAREHOUSES: WarehouseInfo[] = [
  {
    id: "kho-1000t",
    code: "K1000T",
    name: "Kho 1000 tấn",
    type: "xi-nghiep",
    capacityKg: 1000000,
    note: "Kho tổng BSF1 — dung tích 1.000 tấn",
  },
  {
    id: "kho-1500t",
    code: "K1500T",
    name: "Kho 1500 tấn",
    type: "xi-nghiep",
    capacityKg: 1500000,
    note: "Kho tổng BSF1 — dung tích 1.500 tấn",
  },
  {
    id: "kho-dong",
    code: "KX-DONG",
    name: "Kho xưởng Đông",
    type: "phan-xuong",
    capacityKg: 250000,
    workshop: "Đông",
    note: "Kho trong phân xưởng Đông — dung tích 250 tấn",
  },
  {
    id: "kho-ca",
    code: "KX-CA",
    name: "Kho xưởng Cá",
    type: "phan-xuong",
    capacityKg: 150000,
    workshop: "Cá",
    note: "Kho trong phân xưởng Cá — dung tích 150 tấn",
  },
  {
    id: "kho-kho",
    code: "KX-KHO",
    name: "Kho xưởng Khô",
    type: "phan-xuong",
    capacityKg: 150000,
    workshop: "Khô",
    note: "Kho trong phân xưởng Khô — dung tích 150 tấn",
  },
];

export interface NxtReportItem {
  productId: string;
  productCode: string;
  productName: string;
  category: NxtGoodsCategory;
  unit: string;
  tonDauKg: number;
  nhapTrongKyKg: number;
  xuatTrongKyKg: number;
  tonCuoiKg: number;
  warehouse: string;
  note?: string;
}

/* ---------- Tồn đầu kho nguyên liệu (NXT nguyên liệu) ---------- */

/**
 * Số dư tồn kho nguyên liệu (cấp đông dự trữ) có sẵn TRƯỚC khi số hoá.
 * Sổ NXT nguyên liệu suy tồn ra từ vòng chuyển kỳ của Cân đối; kỳ đầu tiên của
 * mỗi họ nguyên liệu không có kỳ trước để kế thừa nên cần con số khai tay này.
 * Chỉ kg — giá trị tiền vẫn tính riêng ở màn Cân đối.
 */
export interface MaterialOpeningStock {
  id: string;
  workshop: Workshop;
  materialTypeName: string; // theo TÊN loại NL (như sổ nhập), không phải khóa ngoại
  asOfDate: string; // yyyy-mm-dd — tồn đầu tính từ ngày này
  quantityKg: number;
  note: string;
}

/**
 * Tồn đầu kho THÀNH PHẨM (bán thành phẩm cấp đông dự trữ) có sẵn TRƯỚC khi số hoá.
 * Sổ NXT thành phẩm suy tồn từ lịch sử sản xuất − xuất; nhưng số dư đông dự trữ có
 * sẵn trước ngày dùng app (chưa có dòng sản xuất nào) phải khai tay một lần theo
 * (mặt hàng × quy cách). Chỉ kg — giá trị tiền tính riêng ở Cân đối.
 * Đối xứng với MaterialOpeningStock nhưng cho thành phẩm (khóa theo mặt hàng).
 */
export interface FinishedGoodsOpeningStock {
  id: string;
  productId: string;
  spec: string;
  asOfDate: string; // yyyy-mm-dd — tồn đầu tính từ ngày này
  quantityKg: number;
  blocksCount: number;
  warehouse: string;
  note: string;
}

