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
  | "vice-manager"
  | "chief-accountant"
  | "accountant"
  | "team-leader"
  | "warehouse-keeper";

export const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Quản trị viên" },
  { value: "director", label: "Giám đốc" },
  { value: "vice-director", label: "Phó giám đốc" },
  { value: "manager-dong", label: "Quản đốc xưởng Đông" },
  { value: "manager-ca", label: "Quản đốc xưởng Cá" },
  { value: "manager-kho", label: "Quản đốc xưởng Khô" },
  { value: "vice-manager", label: "Phó quản đốc" },
  { value: "team-leader", label: "Tổ trưởng sản xuất" },
  { value: "warehouse-keeper", label: "Thủ kho nhập hàng" },
  { value: "chief-accountant", label: "Kế toán trưởng" },
  { value: "accountant", label: "Kế toán" },
];

/**
 * Ánh xạ slug vai trò CŨ (tiếng Việt không dấu, trước rename tiếng Anh 0016) →
 * slug CHUẨN hiện tại. Dữ liệu người dùng tạo trước rename vẫn lưu slug cũ trong
 * cột roles ⇒ chuẩn hoá lúc ĐỌC để hiện đúng nhãn + chạy đúng phân quyền. Ghi
 * lại (rolesToCsv) luôn ra slug chuẩn nên dữ liệu tự lành dần khi admin lưu lại.
 */
const LEGACY_ROLE_MAP: Record<string, Role> = {
  "giam-doc": "director",
  "pho-giam-doc": "vice-director",
  "quan-doc-dong": "manager-dong",
  "quan-doc-ca": "manager-ca",
  "quan-doc-kho": "manager-kho",
  "pho-quan-doc": "vice-manager",
  "ke-toan": "accountant",
  "ke-toan-truong": "chief-accountant",
  "to-truong": "team-leader",
  "thu-kho": "warehouse-keeper",
  "nhap-hang": "warehouse-keeper",
  // "admin" giữ nguyên (không đổi khi rename)
};

/** Chuẩn hoá một slug vai trò: slug cũ → chuẩn; slug đã chuẩn giữ nguyên. */
export function normalizeRole(v: string): Role {
  const t = v.trim();
  return (LEGACY_ROLE_MAP[t] ?? t) as Role;
}

export function rolesFromCsv(csv: string): Role[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeRole);
}

export function rolesToCsv(arr: Role[]): string {
  return arr.join(",");
}

export function rolesList(v: unknown): Role[] {
  if (Array.isArray(v)) return v.map((x) => normalizeRole(String(x)));
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
 * Vai trò ĐÃ CHỈNH ma trận (vai trò hệ thống) hoặc admin TỰ TẠO (mig 0062).
 * Vai trò không có dòng ở bảng `app_roles` ⇒ dùng ma trận mặc định trong
 * lib/permissions.ts. Spec: docs/spec/role-permissions.md.
 */
export interface AppRole {
  id: string; // slug vai trò (hệ thống: "accountant"…; tự tạo: "role-<ngẫu nhiên>")
  name: string;
  description: string;
  homeRoute: string; // "" = theo mặc định
  sortOrder: number;
}

/** Một ô quyền của vai trò đã chỉnh — id = `<roleId>|<resource>|<action>`. */
export interface RolePermission {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  scope: string; // "all" | "workshop" | "own"
}

/** Chỉnh riêng một người — id = `<userId>|<resource>|<action>`. */
export interface UserPermission {
  id: string;
  userId: string;
  resource: string;
  action: string;
  effect: "allow" | "deny";
  scope: string;
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

/** Kiểu chế biến của thành phẩm — facet thứ 3 (migration 0027). Danh mục MỞ, thêm tại chỗ.
 *  Dùng chung cho Danh mục mặt hàng và hộp sửa nhanh thành phẩm ở /wip. */
export const PROCESSING_TYPES = [
  "Nguyên con làm sạch",
  "Luộc",
  "Chần",
  "Cắt",
  "Cắt luộc",
  "Cắt chần",
  "Tẩm bột",
  "Tẩm gia vị",
];

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
  /** Mã lô nội bộ đọc được (vd "Đ-260902-01"). NHÃN hiển thị/trace, không phải khóa. */
  lotCode?: string;
  /** Mã SSCC do nhà nước cấp — chừa sẵn, thường để trống, điền sau. */
  ssccCode?: string;
  /** Đường dẫn ảnh phiếu tay chụp kèm (nền OCR). Rỗng = chưa chụp. */
  scanPath?: string;
  /** Người thao tác ghi chuyến (họ tên/username tài khoản lúc lưu). Rỗng = dữ liệu cũ. */
  operator?: string;
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
  /** Chỉ production_locks (migration 0028): nguyên liệu còn dở cuối ngày đem lưu kho (kg) — tổng. */
  leftoverKg?: number;
  /**
   * Chỉ production_locks (migration 0038): còn dở tách theo loại nguyên liệu
   * `{ "<tên loại NL>": kg }`. Sổ NXT nguyên liệu cộng phần này vào "đông gửi" kỳ
   * tương ứng (khép vòng G1). Tổng của map = leftoverKg.
   */
  leftoverByMaterial?: Record<string, number>;
}

/* ---------- QC checklist chấm điểm cuối ngày (họp 2026-09-02, QĐ-8) ---------- */

/** Kết quả một chỉ tiêu: đạt · tạm (cần khắc phục) · không đạt (cần kiểm tra lại). */
/** Giá trị lưu DB tiếng Anh từ mig 0059 (trước đó dat/tam/khong-dat — đọc qua lib/legacyValues). */
export type QcResult = "pass" | "conditional" | "fail";

export interface QcChecklistItem {
  id: string;
  date: string; // yyyy-mm-dd
  workshop: Workshop;
  criterion: string; // tên chỉ tiêu kiểm
  result: QcResult;
  score: number | null; // điểm tùy chọn (0–10), trống nếu không chấm điểm
  note: string;
  backdateReason: string; // bắt buộc khi ghi bù (ngày cũ hoặc ngày đã chốt)
  /** Đường dẫn ảnh trong Supabase Storage bucket "qc" (mảng path). Migration 0039.
   *  Ảnh là phụ — không chặn chốt ngày; xem qua signed URL (lib/storage.ts). */
  photoPaths?: string[];
}

/** Ghi QC cho ngày trước hôm nay = ghi bù (bắt buộc lý do). */
export function isBackdatedQc(date: string, today: string): boolean {
  return Boolean(date) && date < today;
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
   *  danh mục (CRUD lưu chuỗi) — đọc bằng `hasSplitComponents()`. */
  splitComponents?: boolean | string;
  /** Quy cách MỖI block (kg/khối). Migration 0031. Danh mục lưu chuỗi. */
  blockSpecKg?: number | string | null;
  /** BỘT ĐI KÈM (migration 0051): id các loại bột tẩm của mặt hàng — VD tẩm bột
   *  nước tương = [24V, 18V, 220H]. Màn /wip tự hiện ô kg cho từng loại. Danh mục
   *  (CRUD lưu chuỗi) giữ dạng "id1,id2" — đọc bằng `getProductBatterIds()` (lib/batter). */
  batterIds?: string[] | string;
}

/** Loại BỘT TẨM (migration 0051) — danh mục mở, VD "Bột 24V". Sổ nối theo TÊN. */
export interface BatterType {
  id: string;
  code: string; // mã số gõ nhanh, VD "24V"
  name: string;
  note: string;
}

/** Mặt hàng có tách râu/bao tử không (chịu cả boolean lẫn chuỗi "1"/"true"). */
export function hasSplitComponents(p: Pick<Product, "splitComponents"> | undefined): boolean {
  const v = p?.splitComponents;
  return v === true || v === "1" || v === "true";
}

/** Quy cách block (kg/khối) dạng số, 0/không hợp lệ → null. */
export function blockSpec(p: Pick<Product, "blockSpecKg"> | undefined): number | null {
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
  /** 0061 — liên hệ + chuyển khoản, chép từ hóa đơn GTGT của đại lý. */
  email: string;
  bankAccount: string;
  bankName: string;
  bankBranch: string;
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
  /**
   * Dòng LẤY XẢ ĐÔNG: id dòng Sổ kho tháng (LÔ) chọn đích danh để lấy (mig 0053).
   * Tháng sau của cùng lô theo chuỗi dồn kỳ `carry|<id>` — xem lib/balancingStockLines.ts.
   */
  stockLineId?: string;
  /** Dòng GỬI ĐÔNG: kho nhận `"<sổ kho>|<vị trí>"` (mig 0053), VD "Kho 1500 tấn|Kho Hồng Phú". */
  stockLocation?: string;
  /**
   * Dòng GỬI ĐÔNG: lô gửi ghi vào NHÓM (bảng) nào của Sổ kho tháng — người dùng chọn trong
   * hộp "Gửi vào sổ kho" (mig 0068). Rỗng ⇒ giữ nhóm của lô đã ghi, chưa có thì nhóm mặc
   * định (lib/balancingStockLines DEFAULT_DEPOSIT_CATEGORY).
   */
  stockCategory?: string;
  /**
   * Dòng GỬI ĐÔNG: giá gửi THEO NGÀY (đ/kg, mig 0071) — kế toán gõ ở hàng phụ "Giá gửi" dưới
   * dòng; mỗi ngày gửi là một lô GĐ-ngày mang đúng giá ngày đó. Có giá theo ngày thì
   * `unitPrice` = bình quân gia quyền (không làm tròn) nên công thức kỳ không đổi. Chưa có
   * (dòng cũ) ⇒ mọi ngày dùng `unitPrice`. Xem lib/balancingStockLines `depositPriceOn`.
   */
  dailyPrices?: DailyQuantities;
  /** Ghi chú của dòng (cột Ghi chú cuối lưới Cân đối, mig 0067). */
  note?: string;
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
  /**
   * Chuyển kỳ: âm = đẩy sang kỳ sau, dương = lấy từ kỳ trước. Từ 2026-10-06 lưới
   * tách thành hai cột Trả · Nợ, trường này giữ TỔNG (Trả + Nợ) để mọi công thức
   * đang đọc nó (Tổng dòng, nhận chuyển kỳ, bản in) không đổi.
   */
  carryOverKg?: number;
  /** Phần "Nợ" của chuyển kỳ (mig 0052). Trả = carryOverKg − debtKg. Chưa có ⇒ 0. */
  debtKg?: number;
  /** Kỳ nhận phần chuyển kỳ âm (dựng dòng đối ứng ở kỳ sau). */
  carryOverPeriodId?: string;
  autoSource?: GridAutoSource;
  /** Ghi chú của dòng (cột Ghi chú cuối lưới Bán thành phẩm, mig 0067). */
  note?: string;
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

/** pending = chờ nhập kho · stocked = đã nhập (trước mig 0059: cho-nhap / da-nhap). */
export type WipWarehouseStatus = "pending" | "stocked";

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
  /** KIỂU CHẾ BIẾN của nhóm (luộc/chần/cắt…) — trục gom sổ ngày (chế biến × khách),
   *  snapshot ngay trên dòng để dựng lại đúng bố cục sổ giấy (migration 0033). */
  processingType?: string;
  /** Thành phẩm tách 2 thành phần cùng giá (VD cắt chần: râu + bao tử).
   *  null = dòng KHÔNG tách. quantityKg vẫn giữ tổng để cân đối dùng. */
  tentacleKg?: number | null;
  stomachKg?: number | null;
  /** Kỳ cân đối đã hút dòng này (rỗng = chưa gắn kỳ nào). */
  balancingPeriodId?: string;
  /** Người thao tác ghi dòng này (họ tên tài khoản đăng nhập) — lưu vết ai gửi
   *  báo cáo thành phẩm ngày lên hệ thống (migration 0037). */
  operator?: string;
  /** Bột tẩm ĐÃ DÙNG cho dòng này theo loại `{ "<tên loại bột>": kg }` (migration
   *  0051). Phụ gia — KHÔNG cộng vào quantityKg. Lưu theo TÊN như còn-dở 0038. */
  batterKg?: Record<string, number>;
}

/**
 * BÁN NỘI ĐỊA (migration 0054) — nguyên liệu bán THẲNG cho khách trong nước, không
 * qua chế biến. Tổ trưởng ghi ở màn Sản xuất thành phẩm; Cân đối lấy làm dòng
 * "Bán nội địa" (dòng giảm khối 1). Sổ RIÊNG, không trộn vào production_wips (sổ
 * BTP — tồn kho đọc nó). Lưu TÊN loại NL / khách như các sổ khác.
 */
export interface DomesticSaleItem {
  id: string;
  saleDate: string; // yyyy-mm-dd — ngày bán (= ngày sản xuất của phiên ghi)
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  materialTypeName: string;
  quantityKg: number;
  unitPrice: number | null; // VND/kg
  customerName: string;
  note: string;
  operator: string;
}

/**
 * TÔ MÀU DÒNG (migration 0055) — dấu "đã dò" kiểu Excel, MỘT bảng dùng chung cho
 * mọi bảng trên app. Chỉ là dấu trình bày: không đụng số sổ sách. `rowId` là id
 * BẢN GHI (không phải chỉ số dòng) để sắp xếp/lọc không làm lệch dấu.
 */
export interface RowMark {
  id: string; // tất định: xem lib/rowMarks.ts#idDauTo
  tableKey: string; // khoá ổn định của bảng/màn — VD "ton-kho-thang"
  rowId: string;
  columnKey: string | null; // null = cả dòng (chừa cho tô ô lẻ)
  color: string; // "vang" | "xanh-la" | "xanh-duong" | "do" | "" (chỉ in đậm)
  bold: boolean;
  markedBy: string;
  markedAt: string; // ISO
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
export function computePackagingLoss(p: Pick<Packaging, "inputKg" | "outputKg">): number {
  return p.inputKg - p.outputKg;
}

/** collecting = đang gom · complete = đủ · closed = đóng (trước mig 0059: dang-gom / du / dong). */
export type SalesOrderStatus = "collecting" | "complete" | "closed";
/** open = mở · closed = đóng (trước mig 0059: mo / dong). */
export type ExportOrderStatus = "open" | "closed";

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
  status: ExportOrderStatus;
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

export type WarehouseType = "plant" | "workshop";

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
    type: "plant",
    capacityKg: 1000000,
    note: "Kho tổng BSF1 — dung tích 1.000 tấn",
  },
  {
    id: "kho-1500t",
    code: "K1500T",
    name: "Kho 1500 tấn",
    type: "plant",
    capacityKg: 1500000,
    note: "Kho tổng BSF1 — dung tích 1.500 tấn",
  },
  {
    id: "kho-dong",
    code: "KX-DONG",
    name: "Kho xưởng Đông",
    type: "workshop",
    capacityKg: 250000,
    workshop: "Đông",
    note: "Kho trong phân xưởng Đông — dung tích 250 tấn",
  },
  {
    id: "kho-ca",
    code: "KX-CA",
    name: "Kho xưởng Cá",
    type: "workshop",
    capacityKg: 150000,
    workshop: "Cá",
    note: "Kho trong phân xưởng Cá — dung tích 150 tấn",
  },
  {
    id: "kho-kho",
    code: "KX-KHO",
    name: "Kho xưởng Khô",
    type: "workshop",
    capacityKg: 150000,
    workshop: "Khô",
    note: "Kho trong phân xưởng Khô — dung tích 150 tấn",
  },
];

/* ---------- Danh mục KHO LƯU TRỮ (kho nhà + kho lạnh thuê ngoài) ---------- */

/** internal = kho nhà · external = kho thuê ngoài (trước mig 0059: noi-bo / thue-ngoai). */
export type StorageKind = "internal" | "external";

export const STORAGE_KIND_LABELS: Record<StorageKind, string> = {
  internal: "Kho nhà",
  external: "Kho thuê ngoài",
};

/**
 * Một kho LƯU hàng. Khác `WarehouseInfo` (5 kho vật lý BSF1 dùng cho sổ kho tháng
 * và lưới cân đối): đây là danh mục MỞ, kế toán/thủ kho tự thêm khi xí nghiệp gửi
 * hàng sang một kho lạnh thuê ngoài mới. Nối dữ liệu theo `name` (báo cáo và Excel
 * của xí nghiệp đi theo tên kho).
 */
export interface StorageLocation {
  id: string;
  code: string; // mã số gõ nhanh (VD "KHP") — có thể trống
  name: string;
  kind: StorageKind;
  address: string;
  phone: string;
  note: string;
}

/** Kho nhà — mặc định khi một dòng chưa gán kho lưu. */
export const DEFAULT_STORAGE_LOCATION = "Kho Baseafood";

export interface NxtReportItem {
  productId: string;
  productCode: string;
  productName: string;
  category: NxtGoodsCategory;
  unit: string;
  openingKg: number;
  inPeriodKg: number;
  outPeriodKg: number;
  closingKg: number;
  warehouse: string;
  note?: string;
}

/**
 * Một DÒNG snapshot Xuất–Nhập–Tồn nhập trực tiếp từ báo cáo THẬT của xí nghiệp
 * (file NXT xuất từ hệ thống đang dùng), theo đúng hạt (Kho × Mã hàng × Kỳ).
 * Đây là NGUỒN SỐ THẬT để dựng lại báo cáo khớp 100% trước khi nối giao dịch sống.
 * Tồn cuối = tồn đầu + nhập − xuất (suy ở tầng app, KHÔNG lưu — bất biến luôn đúng).
 * Cột giá trị (tiền) giữ theo file; báo cáo nguyên liệu phần lớn để 0.
 */
export interface NxtSnapshotLine {
  id: string;
  warehouseCode: string; // "KHO TP - KHO 1000" — đúng như in trên báo cáo
  /**
   * KHO LƯU thực tế của dòng hàng (TÊN trong danh mục `storage_locations`, migration
   * 0044): "Kho Baseafood" = kho nhà, "Kho Hồng Phú"/"Kho Ánh Dương" = kho thuê ngoài.
   * Rỗng = chưa gán ⇒ hiểu là kho nhà (dữ liệu nhập trước 0044 không bị ép sửa).
   */
  storageLocation: string;
  periodFrom: string; // yyyy-mm-dd
  periodTo: string; // yyyy-mm-dd
  itemCode: string; // "PXĐ.BTNL.TĐ 1001"
  itemName: string;
  unit: string; // "KG"
  openingKg: number;
  inKg: number;
  outKg: number;
  openingValue: number; // giá trị đầu kỳ (thường 0 với NL)
  inValue: number;
  outValue: number;
  note: string;
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

/* ---------- Sổ kho theo THÁNG (dồn tồn cuối kỳ → đầu kỳ sau) ---------- */

/**
 * Nhóm hàng trong sổ kho theo tháng. Danh mục MỞ (Combobox tạo mới tại chỗ);
 * đây chỉ là gợi ý mặc định, gom được cả NL, bán thành phẩm và thành phẩm.
 * Khớp hai nhóm gốc của "BẢNG KÊ NGUYÊN LIỆU KHO 1500 T" (nhập khẩu / mua ngoài).
 */
export const MONTHLY_STOCK_CATEGORIES: string[] = [
  "Nguyên liệu nhập khẩu",
  "Nguyên liệu mua ngoài",
  "Hàng tạm",
  "Bán thành phẩm",
  "Thành phẩm đóng gói",
];

/**
 * Một DÒNG sổ kho theo THÁNG DƯƠNG LỊCH (kỳ = tháng). Số hoá đúng "bảng kê kho"
 * kế toán/thủ kho đang giữ trên Excel, theo hạt (Tháng × Nhóm × Mặt hàng × Size ×
 * Xuất xứ). Theo dõi SONG SONG kiện (CTN) và kg.
 *
 * BẤT BIẾN (suy ở tầng app, KHÔNG lưu):
 *   Tồn cuối (kiện) = tồn đầu + nhập − xuất; Tồn cuối (kg) tương tự.
 *   Tiền còn lại   = Tồn cuối (kg) × đơn giá.
 * Tồn ĐẦU kỳ thì LƯU: là snapshot kế thừa từ tồn cuối tháng trước (đóng băng để
 * số không trôi khi sửa lại tháng cũ). Dồn kỳ tạo dòng mới với `openCtn/openKg` =
 * tồn cuối kỳ trước, nhập/xuất = 0, `carriedFromId` = id dòng nguồn (chống trùng).
 */
export interface MonthlyStockLine {
  id: string;
  period: string; // 'YYYY-MM' — kỳ = tháng dương lịch
  category: string; // nhóm hàng (MONTHLY_STOCK_CATEGORIES, danh mục mở)
  warehouse: string; // kho, VD "Kho 1500T"
  itemName: string;
  size: string; // rỗng nếu không có
  origin: string; // số INVOICE (cột DB cũ `origin` — trước gọi "xuất xứ"), rỗng nếu không rõ
  importDate: string; // yyyy-mm-dd — ngày nhập (tham chiếu), rỗng nếu không rõ
  /** VỊ TRÍ hàng đang nằm (TÊN kho, VD "Kho Ánh Dương"). Rỗng = ở chính kho của sổ (`warehouse`). Migration 0045. */
  storageLocation: string;
  kgPerCtn: number | null; // KG/kiện (cột "KG/GS")
  unitPrice: number | null; // đơn giá VNĐ
  openCtn: number;
  openKg: number;
  inCtn: number;
  inKg: number;
  outCtn: number;
  outKg: number;
  carriedFromId: string; // id dòng nguồn khi tạo bằng dồn kỳ; rỗng = nhập tay
  sortOrder: number;
  note: string;
}

/**
 * Bản đối soát hóa đơn đã LƯU theo tài khoản (màn /doi-soat). Lưu file gốc
 * (base64, để mở lại chạy lại) + tham số + ảnh chụp tóm tắt kết quả. Bản
 * `official` (chính thức) đóng băng `summary`. Logic đối soát ở `lib/einvoiceReconciliation.ts`
 * (không import ở đây để repo.ts không kéo xlsx vào bundle chính).
 */
/** Loại lô: S = nguyên liệu (chuyến nhập) · W = bán thành phẩm (mẻ SX) · P = thành phẩm (phiếu đóng gói). */
export type LotKind = "S" | "W" | "P";

/**
 * Sự kiện BIẾN ĐỔI lô (bảng `lot_inputs`, mig 0046): "đầu ra đã dùng đầu vào này".
 * Tương đương Transformation Event của EPCIS. Thiết kế: docs/spec/qr-truy-xuat-lo.md.
 */
/** Cách gắn lô: scan = quét tem · typed = gõ mã · picked = chọn trong danh sách · fifo = tự trừ
 *  (trước mig 0059: quet / go / chon). */
export type LotMethod = "scan" | "typed" | "picked" | "fifo";

export interface LotInput {
  id: string;
  /** W = mẻ SX BTP · P = phiếu đóng gói TP */
  outputKind: "W" | "P";
  outputId: string;
  /** S = lô NL (chuyến nhập) · W = lô BTP (mẻ SX) */
  inputKind: "S" | "W";
  inputId: string;
  /** Nhãn lô lúc ghi — còn tra được kể cả khi bản ghi nguồn bị sửa/xóa. */
  inputLabel: string;
  material: string;
  /** kg đã dùng; null = chưa cân. */
  quantityKg: number | null;
  method: Exclude<LotMethod, "fifo">;
  operator: string;
  recordedAt: string;
}

/**
 * LÔ ĐI RA (bảng `lot_dispatches`, mig 0056): "chứng từ ra này lấy từ lô này".
 * Nối truy xuôi tới khách ở các ngả bán lẻ / bán nội địa, và lưu kết quả quét
 * kiểm lô khi xếp xe theo lệnh xuất. Tương đương Object/Transaction Event (EPCIS).
 */
export type LotDispatchDoc = "sales_item" | "export_item" | "domestic_sale";

export interface LotDispatch {
  id: string;
  lotKind: LotKind;
  lotId: string;
  /** Nhãn lô lúc gắn — còn tra được kể cả khi bản ghi lô bị sửa/xóa. */
  lotLabel: string;
  /** sales_item = dòng bán lẻ · export_item = dòng lệnh xuất (quét kiểm) · domestic_sale = bán nội địa NL */
  docKind: LotDispatchDoc;
  docId: string;
  /** kg lấy từ lô; null = chưa cân. */
  quantityKg: number | null;
  method: LotMethod;
  operator: string;
  recordedAt: string;
}

/**
 * LÝ DO CHƯA GẮN LÔ (bảng `lot_waivers`, mig 0056): chốt ngày SX bắt mỗi mẻ phải
 * có lô NL hoặc ghi lý do (chốt chủ dự án 2026-10-08). Biết lỗ nào là có chủ ý.
 */
export interface LotWaiver {
  id: string;
  outputKind: "W" | "P";
  outputId: string;
  reason: string;
  operator: string;
  recordedAt: string;
}

/**
 * GIAO VIỆC (bảng `task_assignments`, mig 0070 — màn "Việc của tôi" `/my-tasks`).
 * - `system`: việc máy tự phát hiện (`FlowWarning` ở lib/dataFlow.ts — ngày chưa chốt,
 *   BTP chờ duyệt…) được giao cho MỘT người; `taskKey` = `FlowWarning.id`. Việc tự
 *   hết khi sổ đã sửa xong (cảnh báo biến mất) — không cần bấm "Xong".
 * - `manual`: việc giao tay (tiêu đề, hạn, màn cần mở) — người nhận bấm "Xong".
 * Hạn rỗng ⇒ việc máy theo hạn mặc định của loại việc (lib/myTasks.ts).
 */
export type TaskSource = "system" | "manual";
export type TaskStatus = "open" | "done" | "cancelled";

export interface TaskAssignment {
  id: string;
  source: TaskSource;
  /** Khóa việc máy phát hiện (vd "ccn|2026-10-12|Đông"); việc giao tay để "". */
  taskKey: string;
  title: string;
  detail: string;
  /** Link mở việc (vd "/imports?date=…&workshop=…"). */
  path: string;
  workshop: Workshop | "";
  /** Ngày nghiệp vụ của việc (yyyy-mm-dd); việc giao tay = ngày giao. */
  taskDate: string;
  /** Hạn (yyyy-mm-dd); "" = theo hạn mặc định của loại việc. */
  dueDate: string;
  /** `user_profiles.id` người nhận + tên lúc giao (còn đọc được khi hồ sơ đổi). */
  assigneeId: string;
  assigneeName: string;
  assignedById: string;
  assignedByName: string;
  status: TaskStatus;
  note: string;
  doneAt: string;
  createdAt: string;
}

/**
 * Một lần IN TEM QR cho một lô (bảng `label_prints`, mig 0049). `label` là nhãn
 * in ra LÚC IN — đông cứng, để so với nhãn hiện tại (nhãn BTP/TP suy từ bản ghi).
 */
export interface LabelPrint {
  id: string;
  lotKind: LotKind;
  lotId: string;
  label: string;
  copies: number;
  operator: string;
  printedAt: string;
}

export interface ReconciliationSummary {
  invoiceCount: number;
  matched: number;
  mismatched: number;
  missing: number;
  nearMatched: number;
  ledgerRowCount: number;
  ledgerMatched: number;
  ledgerMissing: number;
  totalDifference: number;
  threshold: number;
  savedAt: string; // ISO — thời điểm đóng băng ảnh chụp
}
export interface ReconciliationRun {
  id: string;
  userId: string; // id tài khoản tạo (chủ sở hữu)
  ownerUsername: string;
  ownerName: string;
  title: string;
  period: string; // VD "T02-2026"
  status: "draft" | "official";
  threshold: number;
  fileName: string;
  fileB64: string; // file Excel gốc, base64
  options: {
    ledgerSheetName?: string;
    edits?: Record<string, number>;
    /** Sheet hóa đơn thuộc bản thuế gửi — người dùng chỉ định (thiếu = máy tự nhận). */
    taxSideSheets?: string[];
    /** Kiểu đối soát đang xem khi lưu (so · haiBan · kiemCong · cungNgay). */
    mode?: string;
  };
  summary: ReconciliationSummary;
  createdAt: string;
  updatedAt: string;
}

