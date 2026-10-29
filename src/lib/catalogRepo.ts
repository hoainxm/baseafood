// ============================================================
// Tên file cũ: src/lib/danhMuc.ts
// Tên tiếng Việt: React Hooks & Repository thao tác với dữ liệu Danh mục
// Description: Catalog Data Access Hooks & Local Storage / Supabase Repository
// ============================================================
import { uid } from "@/lib/db";
import {
  SALES_ITEM_TABLE,
  DAILY_LOCK_TABLE,
  PRODUCTION_LOCK_TABLE,
  IMPORT_SHIPMENT_TABLE,
  SUPPLIER_TABLE,
  SALES_ORDER_TABLE,
  ORDER_ITEM_TABLE,
  EXPORT_ITEM_TABLE,
  CUSTOMER_TABLE,
  BALANCING_PERIOD_TABLE,
  EXPORT_ORDER_TABLE,
  MATERIAL_TYPE_TABLE,
  PRODUCT_TABLE,
  USER_PROFILE_TABLE,
  MATERIAL_IMPORT_TABLE,
  BALANCING_INPUT_TABLE,
  SCRAP_TABLE,
  SALES_INVOICE_TABLE,
  WIP_PRODUCTION_TABLE,
  QC_CHECKLIST_TABLE,
  QC_LOCK_TABLE,
  PACKAGING_TABLE,
  FINISHED_GOOD_TABLE,
  BALANCING_OUTPUT_TABLE,
  OPENING_STOCK_TABLE,
  FINISHED_OPENING_STOCK_TABLE,
  NXT_SNAPSHOT_TABLE,
  STORAGE_LOCATION_TABLE,
  MONTHLY_STOCK_TABLE,
  RECONCILIATION_RUN_TABLE,
  LOT_INPUT_TABLE,
  LABEL_PRINT_TABLE,
  LOT_DISPATCH_TABLE,
  LOT_WAIVER_TABLE,
  TASK_ASSIGNMENT_TABLE,
  COMPANY_DOCUMENT_TABLE,
  DOCUMENT_VERSION_TABLE,
  EXPORT_CONTRACT_TABLE,
  EXPORT_CONTRACT_REVISION_TABLE,
  EXPORT_CONTRACT_APPROVAL_TABLE,
  EXPORT_DEADLINE_EXTENSION_TABLE,
  EXPORT_SHIPMENT_TABLE,
  EXPORT_STEP_ITEM_TABLE,
  EXPORT_FILE_TABLE,
  EXPORT_PAYMENT_TABLE,
  EXPORT_ACTIVITY_TABLE,
  CUSTOMER_PRODUCT_NAME_TABLE,
  EXPORT_DOCUMENT_KIND_TABLE,
  BATTER_TYPE_TABLE,
  ROW_MARK_TABLE,
  DOMESTIC_SALE_TABLE,
  APP_ROLE_TABLE,
  ROLE_PERMISSION_TABLE,
  USER_PERMISSION_TABLE,
  useTable,
  isServerConnected,
} from "@/lib/repo";
import type {
  BatterType,
  MaterialType,
  Product,
  FinishedGood,
  NxtSnapshotLine,
  StorageLocation,
} from "@/types";
import { DEFAULT_STORAGE_LOCATION } from "@/types";
import { BATTER_TYPE_SEED, inferBattersFromName } from "@/lib/batter";
import fgSeed from "@/data/finished-goods.json";
import octopusNxtSnapshot from "@/data/nxt-bachtuoc-2026-07.json";

/**
 * Các bảng dữ liệu của hệ thống, gói sẵn để màn hình gọi một dòng.
 * Chạy Supabase hay localStorage là do env quyết định — màn hình không cần biết.
 */

const MATERIAL_TYPE_SEED: { name: string; category: string }[] = [
  { name: "1 da nguyên liệu", category: "Bạch tuộc" },
  { name: "2 da nguyên liệu", category: "Bạch tuộc" },
  { name: "Bạch tuộc 1 da", category: "Bạch tuộc" },
  { name: "Bạch tuộc 2 da", category: "Bạch tuộc" },
  { name: "Mực ống 7cm", category: "Mực" },
  { name: "Mực nang", category: "Mực" },
  { name: "Đầu ống", category: "Mực" },
  { name: "Bao tử", category: "Mực" },
  { name: "Ghẹ lột", category: "Ghẹ" },
  { name: "Cá nục", category: "Cá" },
  { name: "Cá saba", category: "Cá" },
  { name: "Cá sòng", category: "Cá" },
];

/** Nạp sẵn các loại thường gặp trong sổ, để lần đầu mở đã có cái mà chọn. */
export const seedMaterialTypes = (): MaterialType[] =>
  MATERIAL_TYPE_SEED.map((x) => ({ id: uid(), name: x.name, category: x.category, note: "" }));

/** 141 mã kế toán — file JSON chỉ còn là SEED, nguồn thật là bảng finished_goods. */
export const seedFinishedGoods = (): FinishedGood[] =>
  (fgSeed as any[]).map((t) => ({
    code: t.ma,
    name: t.ten,
    unit: t.dvt,
    accountCode: t.maTk,
    groupName: t.nhom,
  }));

/**
 * Suy KIỂU CHẾ BIẾN (facet B, `0027`) từ TÊN thành phẩm — để dropdown "Kiểu chế
 * biến" ở màn ghi thành phẩm (`/wip`) có sẵn nhãn, khỏi rỗng. Bảo thủ: chỉ gắn
 * khi tên chứa từ khóa RÕ; không rõ thì để trống ("chưa phân loại"), KHÔNG đoán.
 * Thứ tự khớp có chủ đích — khớp trước thắng (VD "luộc màu" trước "luộc";
 * "cắt luộc" trước "luộc"/"cắt"). Nhãn theo spec bo-quy-cach-che-bien §2.2.
 * Từ vựng này của xưởng Đông (bạch tuộc); mã Cá/Mực/Tôm phần lớn rơi về "" — đúng
 * chủ ý, loài đó cần từ khóa riêng mới bổ sung (spec §5.1). Migration 0034 nhân
 * bản luật này bằng SQL để vá cả bản đã deploy.
 */
export const inferProcessingType = (name: string): string => {
  const t = name.toLowerCase();
  if (t.includes("ncls") || t.includes("nguyên con làm sạch"))
    return "Nguyên con làm sạch";
  if (t.includes("luộc màu")) return "Luộc màu";
  if (t.includes("cắt chần")) return "Cắt chần";
  if (t.includes("cắt luộc")) return "Cắt luộc";
  if (t.includes("tẩm bột")) return "Tẩm bột";
  if (t.includes("tẩm gia vị") || t.includes("tẩm muối")) return "Tẩm gia vị";
  if (t.includes("luộc")) return "Luộc";
  if (t.includes("chần")) return "Chần";
  if (t.includes("cắt")) return "Cắt";
  return "";
};

/**
 * Mặt hàng THẬT có trong file cân đối (bạch tuộc 2 da) nhưng THIẾU hẳn ở 141 mã
 * kế toán — bổ sung vào danh mục MỞ (`finishedGoodCode=""` = chưa ánh xạ; kế toán
 * cấp mã sau thì nối). Đặt tên theo lối kế toán 141 cho nhất quán. 6 dòng "lệch
 * tên" (VD "luộc 2g" = mã "cắt luộc 2gr") KHÔNG thêm — đã chốt là cùng thứ.
 * Mức GỘP (theo lựa chọn của chủ dữ liệu 2026-08-28). Migration 0034 nạp bản này
 * lên server (id tất định để chạy lại không đẻ trùng).
 */
const EXTRA_PRODUCTS: { id: string; name: string }[] = [
  { id: "mh-bs-cc-380-420", name: "Bạch tuộc 2 da cắt chần 380-420" },
  { id: "mh-bs-cc-455-555", name: "Bạch tuộc 2 da cắt chần 455-555" },
  { id: "mh-bs-cc-700-750", name: "Bạch tuộc 2 da cắt chần 700-750" },
  { id: "mh-bs-cl-600-900", name: "Bạch tuộc 2 da cắt luộc 600-900" },
  { id: "mh-bs-cl-1000-1300", name: "Bạch tuộc 2 da cắt luộc 1000-1300" },
  { id: "mh-bs-cl-5-5gr", name: "Bạch tuộc 2 da cắt luộc 5,5gr" },
  { id: "mh-bs-rau-16-20", name: "Bạch tuộc 2 da cắt râu luộc 16-20" },
  { id: "mh-bs-bot-nuoctuong", name: "Bạch tuộc 2 da tẩm bột nước tương" },
];

/** Mặt hàng nạp sẵn TỪ 141 thành phẩm (mỗi cái gắn loài = nhóm + kiểu chế biến suy
 *  từ tên) + các mặt hàng thật còn thiếu. Để lần đầu mở đã có cái mà chọn, lọc theo
 *  loài. `finishedGoodCode` trỏ về mã 141; `category` = nhóm; `processingType` = facet B;
 *  `batterIds` = bột đi kèm suy từ tên (chỉ 2 nhóm đã chốt — `inferBattersFromName`, khớp 0051). */
export const seedProducts = (): Product[] => [
  ...(fgSeed as any[]).map((t) => ({
    id: uid(),
    code: "",
    name: t.ten,
    finishedGoodCode: t.ma,
    category: t.nhom,
    processingType: inferProcessingType(t.ten),
    batterIds: inferBattersFromName(t.ten),
  })),
  ...EXTRA_PRODUCTS.map((m) => ({
    id: uid(),
    code: "",
    name: m.name,
    finishedGoodCode: "",
    category: "Bạch tuộc",
    processingType: inferProcessingType(m.name),
    batterIds: inferBattersFromName(m.name),
  })),
];

/**
 * Snapshot Xuất–Nhập–Tồn nạp sẵn từ báo cáo THẬT tháng 7 (KHO TP - KHO 1000,
 * 30 mã bạch tuộc). Số đã kiểm định khớp tổng của báo cáo gốc. `id` tất định
 * theo (kho × kỳ × mã) để nạp lại nhiều lần vẫn không đẻ dòng trùng.
 */
/**
 * Kho lưu mặc định — khớp seed của migration 0044 (id giống nhau nên chạy cả hai
 * chế độ đều ra một danh sách, không nhân đôi khi cutover sang Supabase).
 */
export const seedStorageLocations = (): StorageLocation[] => [
  {
    id: "kho-baseafood",
    code: "KBSF",
    name: "Kho Baseafood",
    kind: "internal",
    address: "",
    phone: "",
    note: "Kho của xí nghiệp — tổng hàng đang nằm trong kho nhà",
  },
  {
    id: "kho-hong-phu",
    code: "KHP",
    name: "Kho Hồng Phú",
    kind: "external",
    address: "",
    phone: "",
    note: "Kho lạnh thuê ngoài",
  },
  {
    id: "kho-anh-duong",
    code: "KAD",
    name: "Kho Ánh Dương",
    kind: "external",
    address: "",
    phone: "",
    note: "Kho lạnh thuê ngoài",
  },
];

export const seedNxtSnapshots = (): NxtSnapshotLine[] => {
  const h = octopusNxtSnapshot as {
    warehouseCode: string;
    periodFrom: string;
    periodTo: string;
    unit: string;
    items: { code: string; name: string; opening: number; in: number; out: number }[];
  };
  return h.items.map((it) => ({
    id: `nxt|${h.warehouseCode}|${h.periodFrom}|${h.periodTo}|${it.code}`,
    warehouseCode: h.warehouseCode,
    storageLocation: DEFAULT_STORAGE_LOCATION,
    periodFrom: h.periodFrom,
    periodTo: h.periodTo,
    itemCode: it.code,
    itemName: it.name,
    unit: h.unit || "KG",
    openingKg: it.opening,
    inKg: it.in,
    outKg: it.out,
    openingValue: 0,
    inValue: 0,
    outValue: 0,
    note: "",
  }));
};

/* --- Danh mục --- */
export const useProducts = () => useTable(PRODUCT_TABLE, seedProducts);
export const useCustomers = () => useTable(CUSTOMER_TABLE);
export const useSuppliers = () => useTable(SUPPLIER_TABLE);
export const useMaterialTypes = () => useTable(MATERIAL_TYPE_TABLE, seedMaterialTypes);
export const useFinishedGoods = () => useTable(FINISHED_GOOD_TABLE, seedFinishedGoods);

/* --- Nghiệp vụ --- */
export const useMaterialImports = () => useTable(MATERIAL_IMPORT_TABLE);
export const useImportShipments = () => useTable(IMPORT_SHIPMENT_TABLE);
export const useDailyLocks = () => useTable(DAILY_LOCK_TABLE);
export const useBalancingPeriods = () => useTable(BALANCING_PERIOD_TABLE);
export const useBalancingInputs = () => useTable(BALANCING_INPUT_TABLE);
export const useScraps = () => useTable(SCRAP_TABLE);
export const useBalancingOutputs = () => useTable(BALANCING_OUTPUT_TABLE);
export const useSalesInvoices = () => useTable(SALES_INVOICE_TABLE);
export const useSalesItems = () => useTable(SALES_ITEM_TABLE);
export const useUserProfiles = () => useTable(USER_PROFILE_TABLE);

/* --- QC checklist chấm điểm cuối ngày --- */
export const useQcChecklists = () => useTable(QC_CHECKLIST_TABLE);
export const useQcLocks = () => useTable(QC_LOCK_TABLE);

/* --- Module WIP: sản xuất BTP · kho · đơn đặt --- */
export const useWipProductions = () => useTable(WIP_PRODUCTION_TABLE);
export const useProductionLocks = () => useTable(PRODUCTION_LOCK_TABLE);
export const usePackagings = () => useTable(PACKAGING_TABLE);
export const useSalesOrders = () => useTable(SALES_ORDER_TABLE);
export const useOrderItems = () => useTable(ORDER_ITEM_TABLE);
export const useExportOrders = () => useTable(EXPORT_ORDER_TABLE);
export const useExportItems = () => useTable(EXPORT_ITEM_TABLE);

/* --- Tồn kho nguyên liệu (NXT nguyên liệu) --- */
export const useMaterialOpeningStock = () => useTable(OPENING_STOCK_TABLE);

/* --- Tồn đầu kho thành phẩm (NXT thành phẩm) --- */
export const useFinishedGoodsOpeningStock = () => useTable(FINISHED_OPENING_STOCK_TABLE);

/* --- Xuất–Nhập–Tồn kho (snapshot từ báo cáo thật) --- */
export const useNxtSnapshots = () => useTable(NXT_SNAPSHOT_TABLE, seedNxtSnapshots);

/* --- Sổ BÁN NỘI ĐỊA (mig 0054) — NL bán thẳng, ghi ở /wip, Cân đối lấy làm dòng giảm --- */
export const useDomesticSales = () => useTable(DOMESTIC_SALE_TABLE);

/* --- Danh mục LOẠI BỘT TẨM (mig 0051) — seed id tất định, khớp migration --- */
export const seedBatterTypes = (): BatterType[] => BATTER_TYPE_SEED.map((b) => ({ ...b }));
export const useBatterTypes = () => useTable(BATTER_TYPE_TABLE, seedBatterTypes);

/* --- Danh mục kho LƯU hàng (kho nhà + kho lạnh thuê ngoài) --- */
export const useStorageLocations = () => useTable(STORAGE_LOCATION_TABLE, seedStorageLocations);

/* --- Sổ kho theo tháng (dồn tồn cuối kỳ → đầu kỳ sau) --- */
export const useMonthlyStock = () => useTable(MONTHLY_STOCK_TABLE);
/** Bản đối soát hóa đơn đã lưu (màn /doi-soat) — nháp/chính thức theo tài khoản. */
export const useReconciliationRuns = () => useTable(RECONCILIATION_RUN_TABLE);
/** Sự kiện biến đổi lô — mẻ SX / đóng gói đã dùng lô nào (truy xuất QR, mig 0046). */
export const useLotInputs = () => useTable(LOT_INPUT_TABLE);
/** Sổ in tem QR — lô nào đã in tem, nhãn in ra, ai in, lúc nào (mig 0049). */
export const useLabelPrints = () => useTable(LABEL_PRINT_TABLE);
/** Lô đi ra — dòng bán lẻ / bán nội địa / quét kiểm lệnh xuất lấy từ lô nào (mig 0056). */
export const useLotDispatches = () => useTable(LOT_DISPATCH_TABLE);
/** Lý do chưa gắn lô khi chốt ngày SX (mig 0056). */
export const useLotWaivers = () => useTable(LOT_WAIVER_TABLE);
/** Giao việc — màn "Việc của tôi" (mig 0070). */
export const useTaskAssignments = () => useTable(TASK_ASSIGNMENT_TABLE);
/** Tài liệu công ty + lần ban hành — màn /documents (mig 0072). Lọc theo phòng ban ở lib/documents.ts. */
export const useCompanyDocuments = () => useTable(COMPANY_DOCUMENT_TABLE);
export const useDocumentVersions = () => useTable(DOCUMENT_VERSION_TABLE);
/** Phòng Kế hoạch · Xuất khẩu (mig 0075) — luật ở lib/exportPlanning.ts. */
export const useExportContracts = () => useTable(EXPORT_CONTRACT_TABLE);
export const useExportContractRevisions = () => useTable(EXPORT_CONTRACT_REVISION_TABLE);
export const useExportContractApprovals = () => useTable(EXPORT_CONTRACT_APPROVAL_TABLE);
export const useExportDeadlineExtensions = () => useTable(EXPORT_DEADLINE_EXTENSION_TABLE);
export const useExportShipments = () => useTable(EXPORT_SHIPMENT_TABLE);
export const useExportStepItems = () => useTable(EXPORT_STEP_ITEM_TABLE);
export const useExportFiles = () => useTable(EXPORT_FILE_TABLE);
export const useExportPayments = () => useTable(EXPORT_PAYMENT_TABLE);
/**
 * Nhật ký thao tác hợp đồng xuất khẩu (mig 0079) — chỉ thêm. `canLog`: máy chủ chưa chạy 0079 ⇒
 * không ghi (khỏi kẹt hàng chờ như bảng tên hàng theo khách), nghiệp vụ vẫn chạy.
 */
export const useExportActivities = () => useTable(EXPORT_ACTIVITY_TABLE);
export function useExportActivityStore() {
  const [activities, setActivities, meta] = useExportActivities();
  const canLog = !isServerConnected || (meta.status !== "loading" && !isMissingTableError(meta.error));
  return { activities, setActivities, canLog };
}
/** Tên hàng theo khách (mig 0077) — dùng qua `useCustomerProductNameStore` để biết máy chủ đã có bảng chưa. */
export const useCustomerProductNames = () => useTable(CUSTOMER_PRODUCT_NAME_TABLE);

/** Lỗi đọc vì máy chủ CHƯA có bảng (chưa chạy migration) — khác lỗi mạng tạm thời. */
export const isMissingTableError = (msg: string | null | undefined) => /does not exist|schema cache|PGRST205|42P01/i.test(msg ?? "");

/**
 * Tên hàng theo khách + cờ `isAvailable`: chạy không máy chủ ⇒ luôn có; có máy chủ ⇒ đọc xong và
 * KHÔNG phải lỗi thiếu bảng (chưa chạy 0077 thì không ghi gì — khỏi kẹt hàng chờ, ba-spec 41 AC-48).
 */
export function useCustomerProductNameStore() {
  const [names, setNames, meta] = useCustomerProductNames();
  const isAvailable = !isServerConnected || (meta.status !== "loading" && !isMissingTableError(meta.error));
  return { names, setNames, isAvailable, isLoading: meta.status === "loading" && names.length === 0 };
}
/** Danh mục loại chứng từ xuất khẩu (mig 0081) — dùng qua `useExportDocumentKindStore`. */
export const useExportDocumentKinds = () => useTable(EXPORT_DOCUMENT_KIND_TABLE);

/**
 * Loại chứng từ + cờ `isAvailable` (như tên hàng theo khách): có máy chủ mà chưa chạy 0081 ⇒ không
 * ghi (ô chọn vẫn đủ 10 loại hệ thống, không thêm / sửa được) — khỏi kẹt hàng chờ.
 */
export function useExportDocumentKindStore() {
  const [kinds, setKinds, meta] = useExportDocumentKinds();
  const isAvailable = !isServerConnected || (meta.status !== "loading" && !isMissingTableError(meta.error));
  return { kinds, setKinds, isAvailable, isLoading: meta.status === "loading" && kinds.length === 0 };
}
/** Tô màu dòng "đã dò" kiểu Excel — MỘT bảng dùng chung mọi bảng (mig 0055).
 *  Màn hình KHÔNG gọi thẳng: đi qua `RowMarkProvider` (features/shared) gắn một lần
 *  ở ShellLayout, bảng bật bằng prop `rowMarkKey` của design-system. */
export const useRowMarks = () => useTable(ROW_MARK_TABLE);

/** Phân quyền (mig 0062) — vai trò đã chỉnh/tự tạo, ô quyền vai trò, chỉnh riêng từng người.
 *  Đọc: ShellLayout (tính quyền thực) + màn Vai trò & quyền. Ghi: chỉ admin (RLS). */
export const useAppRoles = () => useTable(APP_ROLE_TABLE);
export const useRolePermissions = () => useTable(ROLE_PERMISSION_TABLE);
export const useUserPermissions = () => useTable(USER_PERMISSION_TABLE);

/** Nạp bộ demo hàng loạt không ghi nhật ký (lib/repo.ts) — chỉ DemoPackLoader dùng. */
export { setAuditPaused } from "@/lib/repo";
export { mergeProductsOnServer, undoProductMergeOnServer, isServerConnected } from "@/lib/repo";
