import { uid } from "@/lib/db";
import {
  BANG_SALES_ITEM,
  BANG_DAILY_LOCK,
  BANG_PRODUCTION_LOCK,
  BANG_IMPORT_SHIPMENT,
  BANG_SUPPLIER,
  BANG_SALES_ORDER,
  BANG_ORDER_ITEM,
  BANG_EXPORT_ITEM,
  BANG_CUSTOMER,
  BANG_BALANCING_PERIOD,
  BANG_EXPORT_ORDER,
  BANG_MATERIAL_TYPE,
  BANG_PRODUCT,
  BANG_USER_PROFILE,
  BANG_MATERIAL_IMPORT,
  BANG_BALANCING_INPUT,
  BANG_SCRAP,
  BANG_SALES_INVOICE,
  BANG_WIP_PRODUCTION,
  BANG_FINISHED_GOOD,
  BANG_BALANCING_OUTPUT,
  useBang,
} from "@/lib/repo";
import type { MaterialType, Product, FinishedGood } from "@/types";
import fgSeed from "@/data/thanh-pham.json";

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

/** Mặt hàng nạp sẵn TỪ 141 thành phẩm (mỗi cái gắn loài = nhóm) — để lần đầu mở
 *  đã có cái mà chọn, lọc theo loài. `finishedGoodCode` trỏ về mã 141; `category` = nhóm. */
export const seedProducts = (): Product[] =>
  (fgSeed as any[]).map((t) => ({
    id: uid(),
    code: "",
    name: t.ten,
    finishedGoodCode: t.ma,
    category: t.nhom,
  }));

/* --- Danh mục --- */
export const useProducts = () => useBang(BANG_PRODUCT, seedProducts);
export const useCustomers = () => useBang(BANG_CUSTOMER);
export const useSuppliers = () => useBang(BANG_SUPPLIER);
export const useMaterialTypes = () => useBang(BANG_MATERIAL_TYPE, seedMaterialTypes);
export const useFinishedGoods = () => useBang(BANG_FINISHED_GOOD, seedFinishedGoods);

/* --- Nghiệp vụ --- */
export const useMaterialImports = () => useBang(BANG_MATERIAL_IMPORT);
export const useImportShipments = () => useBang(BANG_IMPORT_SHIPMENT);
export const useDailyLocks = () => useBang(BANG_DAILY_LOCK);
export const useBalancingPeriods = () => useBang(BANG_BALANCING_PERIOD);
export const useBalancingInputs = () => useBang(BANG_BALANCING_INPUT);
export const useScraps = () => useBang(BANG_SCRAP);
export const useBalancingOutputs = () => useBang(BANG_BALANCING_OUTPUT);
export const useSalesInvoices = () => useBang(BANG_SALES_INVOICE);
export const useSalesItems = () => useBang(BANG_SALES_ITEM);
export const useUserProfiles = () => useBang(BANG_USER_PROFILE);

/* --- Module WIP: sản xuất BTP · kho · đơn đặt --- */
export const useWipProductions = () => useBang(BANG_WIP_PRODUCTION);
export const useProductionLocks = () => useBang(BANG_PRODUCTION_LOCK);
export const useSalesOrders = () => useBang(BANG_SALES_ORDER);
export const useOrderItems = () => useBang(BANG_ORDER_ITEM);
export const useExportOrders = () => useBang(BANG_EXPORT_ORDER);
export const useExportItems = () => useBang(BANG_EXPORT_ITEM);
