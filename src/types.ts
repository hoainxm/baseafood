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
  | "team-leader";

export const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Quản trị (full quyền)" },
  { value: "director", label: "Giám đốc" },
  { value: "vice-director", label: "Phó giám đốc" },
  { value: "manager-dong", label: "Quản đốc xưởng Đông" },
  { value: "manager-ca", label: "Quản đốc xưởng Cá" },
  { value: "manager-kho", label: "Quản đốc xưởng Khô" },
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

export const CATEGORIES = [
  "Bạch tuộc",
  "Mực",
  "Cá",
  "Tôm",
  "Ghẹ",
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
}

/* ---------- 5-Day Balancing (Dong workshop) ---------- */

export interface Product {
  id: string;
  code: string;
  name: string;
  finishedGoodCode: string;
  category?: string;
  materialTypeId?: string;
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
}

export interface BalancingInputItem {
  id: string;
  periodId: string;
  groupName: InputGroup;
  name: string;
  quantityKg: number;
  unitPrice: number | null; // VND
  ratioPercentage: number | null; // % (for additive powder)
  sourceWarehouse?: string; // "Mua về" | "Kho mình"
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
  sourceWarehouse: string; // "" | "SX" | "Lưu trữ"
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
  quantityKg: number;
  blocksCount: number;
  warehouse: string;
  status: WipWarehouseStatus;
  note: string;
}

export function isBackdatedWip(c: Pick<WipProductionItem, "productionDate" | "postingDate">): boolean {
  return Boolean(c.postingDate) && c.postingDate > c.productionDate;
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

