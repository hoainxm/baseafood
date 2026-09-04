// ============================================================
// Tên file cũ: src/lib/danhMuc.ts
// Tên tiếng Việt: React Hooks & Repository thao tác với dữ liệu Danh mục
// Description: Catalog Data Access Hooks & Local Storage / Supabase Repository
// ============================================================
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
  BANG_QC_CHECKLIST,
  BANG_QC_LOCK,
  BANG_PACKAGING,
  BANG_FINISHED_GOOD,
  BANG_BALANCING_OUTPUT,
  BANG_OPENING_STOCK,
  BANG_FINISHED_OPENING_STOCK,
  BANG_NXT_SNAPSHOT,
  useBang,
} from "@/lib/repo";
import type { MaterialType, Product, FinishedGood, NxtSnapshotLine } from "@/types";
import fgSeed from "@/data/thanh-pham.json";
import nxtBachTuoc from "@/data/nxt-bachtuoc-2026-07.json";

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
export const suyKieuCheBien = (ten: string): string => {
  const t = ten.toLowerCase();
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
const MAT_HANG_BO_SUNG: { id: string; name: string }[] = [
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
 *  loài. `finishedGoodCode` trỏ về mã 141; `category` = nhóm; `processingType` = facet B. */
export const seedProducts = (): Product[] => [
  ...(fgSeed as any[]).map((t) => ({
    id: uid(),
    code: "",
    name: t.ten,
    finishedGoodCode: t.ma,
    category: t.nhom,
    processingType: suyKieuCheBien(t.ten),
  })),
  ...MAT_HANG_BO_SUNG.map((m) => ({
    id: uid(),
    code: "",
    name: m.name,
    finishedGoodCode: "",
    category: "Bạch tuộc",
    processingType: suyKieuCheBien(m.name),
  })),
];

/**
 * Snapshot Xuất–Nhập–Tồn nạp sẵn từ báo cáo THẬT tháng 7 (KHO TP - KHO 1000,
 * 30 mã bạch tuộc). Số đã kiểm định khớp tổng của báo cáo gốc. `id` tất định
 * theo (kho × kỳ × mã) để nạp lại nhiều lần vẫn không đẻ dòng trùng.
 */
export const seedNxtSnapshots = (): NxtSnapshotLine[] => {
  const h = nxtBachTuoc as {
    warehouseCode: string;
    periodFrom: string;
    periodTo: string;
    unit: string;
    items: { code: string; name: string; opening: number; in: number; out: number }[];
  };
  return h.items.map((it) => ({
    id: `nxt|${h.warehouseCode}|${h.periodFrom}|${h.periodTo}|${it.code}`,
    warehouseCode: h.warehouseCode,
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

/* --- QC checklist chấm điểm cuối ngày --- */
export const useQcChecklists = () => useBang(BANG_QC_CHECKLIST);
export const useQcLocks = () => useBang(BANG_QC_LOCK);

/* --- Module WIP: sản xuất BTP · kho · đơn đặt --- */
export const useWipProductions = () => useBang(BANG_WIP_PRODUCTION);
export const useProductionLocks = () => useBang(BANG_PRODUCTION_LOCK);
export const usePackagings = () => useBang(BANG_PACKAGING);
export const useSalesOrders = () => useBang(BANG_SALES_ORDER);
export const useOrderItems = () => useBang(BANG_ORDER_ITEM);
export const useExportOrders = () => useBang(BANG_EXPORT_ORDER);
export const useExportItems = () => useBang(BANG_EXPORT_ITEM);

/* --- Tồn kho nguyên liệu (NXT nguyên liệu) --- */
export const useMaterialOpeningStock = () => useBang(BANG_OPENING_STOCK);

/* --- Tồn đầu kho thành phẩm (NXT thành phẩm) --- */
export const useFinishedGoodsOpeningStock = () => useBang(BANG_FINISHED_OPENING_STOCK);

/* --- Xuất–Nhập–Tồn kho (snapshot từ báo cáo thật) --- */
export const useNxtSnapshots = () => useBang(BANG_NXT_SNAPSHOT, seedNxtSnapshots);
