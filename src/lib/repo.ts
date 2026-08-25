// ============================================================
// Tên file: src/lib/repo.ts
// Tên tiếng Việt tương đương: Tầng Repository Dữ liệu Supabase & Sync Queue
// Description: Data Access Layer bridging LocalStorage and Supabase backend
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, hasSupabase, SITE_ID } from "@/lib/supabase";
import { ketNoi } from "@/lib/connectivity";
import { load, save } from "@/lib/db";
import type {
  FinishedGood,
  Workshop,
  UserProfile,
  Category,
  ImportShipment,
  MaterialImportItem,
  DailyLock,
  Product,
  Customer,
  Supplier,
  MaterialType,
  InputGroup,
  SalesChannel,
  BalancingPeriod,
  BalancingInputItem,
  ScrapSource,
  ScrapItem,
  BalancingOutputItem,
  SalesInvoice,
  SalesItem,
  WipProductionItem,
  WipWarehouseStatus,
  Packaging,
  SalesOrder,
  SalesOrderStatus,
  OrderItem,
  ExportOrder,
  ExportItem,
  DailyQuantities,
  GridAutoSource,
  MaterialOpeningStock,
  FinishedGoodsOpeningStock,
} from "@/types";
import { rolesFromCsv, rolesToCsv } from "@/types";
import { ghiNhatKy, type NhatKyMoi } from "@/lib/audit";

/**
 * Tầng dữ liệu dùng chung.
 *
 * Một API duy nhất cho cả hai chế độ:
 *   - Chưa cấu hình Supabase → đọc/ghi localStorage.
 *   - Đã cấu hình            → đọc/ghi Supabase, ĐỒNG THỜI ghi bản sao xuống
 *                              localStorage làm bộ đệm: mất mạng giữa ca vẫn
 *                              còn số liệu để đối chiếu, không trắng màn hình.
 *
 * Màn hình vẫn dùng `const [rows, ghi] = useMaterialImports()` và truyền NGUYÊN
 * danh sách mới; tầng này tự so danh sách cũ/mới để biết dòng nào thêm, dòng nào
 * sửa, dòng nào xóa rồi mới gọi Supabase.
 *
 * Tên bảng/cột trong DB: Tiếng Anh, snake_case.
 */

export interface AnhXaBang<T> {
  /** Tên bảng trong Supabase */
  table: string;
  /** Khóa chính trong DB — mặc định "id", danh mục thành phẩm dùng "code" */
  khoaChinh?: string;
  /** Khóa localStorage (phiên bản v2 dùng Tiếng Anh) */
  localKey: string;
  /** Lấy khóa của một bản ghi ở phía app */
  layKhoa: (x: T) => string;
  toRow: (x: T) => Record<string, unknown>;
  fromRow: (r: Record<string, unknown>) => T;
  /**
   * Vá dòng cũ còn thiếu trường mới thêm về sau. Bản sao dưới localStorage được
   * đọc thẳng bằng JSON.parse (không qua `fromRow`), nên dữ liệu ghi từ bản
   * trước sẽ thiếu trường — vá ở một chỗ này thay vì rải `?? ""` khắp màn hình.
   */
  vaDongCu?: (x: T) => T;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const theoId = <T extends { id: string }>(x: T) => x.id;

/**
 * Cột `daily_quantities` (jsonb) → `{ "2025-07-22": 5120 }`.
 * Supabase trả về object; bản sao localStorage có thể là chuỗi JSON. Bỏ mọi ô
 * không phải số hữu hạn để một ô hỏng không làm tổng của cả kỳ thành NaN.
 */
function doiSanLuongNgay(v: unknown): DailyQuantities {
  let raw: unknown = v;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const ra: DailyQuantities = {};
  for (const [ngay, so] of Object.entries(raw as Record<string, unknown>)) {
    const x = Number(so);
    if (Number.isFinite(x)) ra[ngay] = x;
  }
  return ra;
}

/* ---------- Ánh xạ camelCase (app) ↔ snake_case (Postgres) ---------- */

export const BANG_SUPPLIER: AnhXaBang<Supplier> = {
  table: "suppliers",
  localKey: "bsf.suppliers.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    short_name: x.shortName,
    phone: x.phone,
    note: x.note,
    billing_name: x.billingName,
    address: x.address,
    national_id: x.nationalId,
    issued_date: x.issuedDate,
    issued_place: x.issuedPlace,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    shortName: s(r.short_name),
    billingName: r.billing_name == null ? "" : s(r.billing_name),
    address: r.address == null ? "" : s(r.address),
    nationalId: r.national_id == null ? "" : s(r.national_id),
    issuedDate: r.issued_date == null ? "" : s(r.issued_date),
    issuedPlace: r.issued_place == null ? "" : s(r.issued_place),
    phone: s(r.phone),
    note: s(r.note),
  }),
};

export const BANG_MATERIAL_TYPE: AnhXaBang<MaterialType> = {
  table: "material_types",
  localKey: "bsf.material-types.v2",
  layKhoa: theoId,
  toRow: (x) => ({ id: x.id, name: x.name, category: x.category, note: x.note }),
  fromRow: (r) => ({
    id: s(r.id),
    name: s(r.name),
    category: s(r.category),
    note: s(r.note),
  }),
};

/** Danh mục 141 mã kế toán — khóa chính là CODE, không phải id sinh tự động. */
export const BANG_FINISHED_GOOD: AnhXaBang<FinishedGood> = {
  table: "finished_goods",
  khoaChinh: "code",
  localKey: "bsf.finished-goods.v2",
  layKhoa: (x) => x.code,
  toRow: (x) => ({
    code: x.code,
    name: x.name,
    unit: x.unit,
    account_code: x.accountCode,
    group_name: x.groupName,
  }),
  fromRow: (r) => ({
    code: s(r.code),
    name: s(r.name),
    unit: s(r.unit),
    accountCode: s(r.account_code),
    groupName: s(r.group_name),
  }),
};

export const BANG_PRODUCT: AnhXaBang<Product> = {
  table: "products",
  localKey: "bsf.products.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    finished_good_code: x.finishedGoodCode,
    category: x.category,
    material_type_id: x.materialTypeId,
    processing_type: x.processingType,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    finishedGoodCode: s(r.finished_good_code),
    category: r.category == null ? "" : s(r.category),
    materialTypeId: r.material_type_id == null ? "" : s(r.material_type_id),
    processingType: r.processing_type == null ? "" : s(r.processing_type),
  }),
};

export const BANG_CUSTOMER: AnhXaBang<Customer> = {
  table: "customers",
  localKey: "bsf.customers.v2",
  layKhoa: theoId,
  toRow: (x) => ({ id: x.id, code: x.code, name: x.name, market: x.market }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    market: s(r.market),
  }),
};

/** Chuyến hàng — một đại lý, một lượt giao, nhiều dòng loại hàng. */
export const BANG_IMPORT_SHIPMENT: AnhXaBang<ImportShipment> = {
  table: "import_shipments",
  localKey: "bsf.import-shipments.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    delivery_date: x.deliveryDate,
    posting_date: x.postingDate,
    backdate_reason: x.backdateReason,
    workshop: x.workshop,
    supplier_name: x.supplierName,
    driver_name: x.driverName,
    license_plate: x.licensePlate,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    deliveryDate: s(r.delivery_date).slice(0, 10),
    postingDate: s(r.posting_date).slice(0, 10),
    backdateReason: s(r.backdate_reason),
    workshop: s(r.workshop) as Workshop,
    supplierName: s(r.supplier_name),
    driverName: s(r.driver_name),
    licensePlate: s(r.license_plate),
    note: s(r.note),
  }),
};

/** Chốt số liệu một ngày của một phân xưởng. */
export const BANG_DAILY_LOCK: AnhXaBang<DailyLock> = {
  table: "daily_locks",
  localKey: "bsf.daily-locks.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    lock_date: x.lockDate,
    workshop: x.workshop,
    is_locked: x.isLocked,
    locked_at: x.lockedAt,
    total_kg_at_lock: x.totalKgAtLock,
    reopen_reason: x.reopenReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    lockDate: s(r.lock_date).slice(0, 10),
    workshop: s(r.workshop) as Workshop,
    isLocked: Boolean(r.is_locked),
    lockedAt: s(r.locked_at),
    totalKgAtLock: Number(r.total_kg_at_lock ?? 0),
    reopenReason: s(r.reopen_reason),
    note: s(r.note),
  }),
};

export const BANG_MATERIAL_IMPORT: AnhXaBang<MaterialImportItem> = {
  table: "material_imports",
  localKey: "bsf.material-imports.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    shipment_id: x.shipmentId,
    delivery_date: x.deliveryDate,
    workshop: x.workshop,
    category: x.category,
    supplier_name: x.supplierName,
    material_type_name: x.materialTypeName,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice,
    driver_name: x.driverName,
    license_plate: x.licensePlate,
    note: x.note,
    balancing_period_id: x.balancingPeriodId ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    shipmentId: s(r.shipment_id),
    deliveryDate: s(r.delivery_date).slice(0, 10),
    workshop: s(r.workshop) as Workshop,
    category: s(r.category) as Category,
    supplierName: s(r.supplier_name),
    materialTypeName: s(r.material_type_name),
    quantityKg: Number(r.quantity_kg ?? 0),
    unitPrice: n(r.unit_price),
    driverName: s(r.driver_name),
    licensePlate: s(r.license_plate),
    note: s(r.note),
    balancingPeriodId: s(r.balancing_period_id),
  }),
  // Dòng ghi trước khi có "chuyến thật" → chưa gắn chuyến, app gom ngầm.
  // Dòng ghi trước 0019 chưa có cột kỳ cân đối → coi như chưa gắn kỳ nào.
  vaDongCu: (x) => ({
    ...x,
    shipmentId: x.shipmentId ?? "",
    balancingPeriodId: x.balancingPeriodId ?? "",
  }),
};

export const BANG_BALANCING_PERIOD: AnhXaBang<BalancingPeriod> = {
  table: "balancing_periods",
  localKey: "bsf.balancing-periods.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    material_type_name: x.materialTypeName,
    date_range_description: x.dateRangeDescription,
    start_date: x.startDate || null,
    end_date: x.endDate || null,
    total_input_kg: x.totalInputKg,
    exchange_rate: x.exchangeRate,
    processing_cost_per_kg: x.processingCostPerKg,
    created_at: x.createdAt,
    is_locked: x.isLocked ?? false,
    locked_at: x.lockedAt || null,
    lock_note: x.lockNote ?? "",
    reopen_reason: x.reopenReason ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    materialTypeName: s(r.material_type_name),
    dateRangeDescription: s(r.date_range_description),
    startDate: r.start_date ? s(r.start_date).slice(0, 10) : undefined,
    endDate: r.end_date ? s(r.end_date).slice(0, 10) : undefined,
    totalInputKg: n(r.total_input_kg),
    exchangeRate: n(r.exchange_rate),
    processingCostPerKg: n(r.processing_cost_per_kg),
    createdAt: s(r.created_at),
    isLocked: Boolean(r.is_locked),
    lockedAt: s(r.locked_at),
    lockNote: s(r.lock_note),
    reopenReason: s(r.reopen_reason),
  }),
  // Kỳ ghi trước 0020 chưa có cờ chốt → coi như chưa chốt.
  vaDongCu: (x) => ({
    ...x,
    isLocked: x.isLocked ?? false,
    lockedAt: x.lockedAt ?? "",
    lockNote: x.lockNote ?? "",
    reopenReason: x.reopenReason ?? "",
  }),
};

export const BANG_BALANCING_INPUT: AnhXaBang<BalancingInputItem> = {
  table: "balancing_inputs",
  localKey: "bsf.balancing-inputs.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    period_id: x.periodId,
    group_name: x.groupName,
    name: x.name,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice,
    ratio_percentage: x.ratioPercentage,
    source_warehouse: x.sourceWarehouse,
    daily_quantities: x.dailyQuantities ?? {},
    carry_over_kg: x.carryOverKg ?? 0,
    carry_over_period_id: x.carryOverPeriodId ?? "",
    is_reduction: x.isReduction ?? false,
    reduction_warehouse_id: x.reductionWarehouseId ?? "",
    auto_source: x.autoSource ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    periodId: s(r.period_id),
    groupName: s(r.group_name) as InputGroup,
    name: s(r.name),
    quantityKg: Number(r.quantity_kg ?? 0),
    unitPrice: n(r.unit_price),
    ratioPercentage: n(r.ratio_percentage),
    sourceWarehouse: r.source_warehouse == null ? "" : s(r.source_warehouse),
    dailyQuantities: doiSanLuongNgay(r.daily_quantities),
    carryOverKg: Number(r.carry_over_kg ?? 0),
    carryOverPeriodId: s(r.carry_over_period_id),
    isReduction: Boolean(r.is_reduction),
    reductionWarehouseId: s(r.reduction_warehouse_id),
    autoSource: s(r.auto_source) as GridAutoSource,
  }),
  // Dòng ghi trước 0019 chưa có cột lưới ngày → mặc định rỗng, không vỡ tổng.
  vaDongCu: (x) => ({
    ...x,
    dailyQuantities: x.dailyQuantities ?? {},
    carryOverKg: x.carryOverKg ?? 0,
    carryOverPeriodId: x.carryOverPeriodId ?? "",
    isReduction: x.isReduction ?? false,
    reductionWarehouseId: x.reductionWarehouseId ?? "",
    autoSource: x.autoSource ?? "",
  }),
};

export const BANG_SCRAP: AnhXaBang<ScrapItem> = {
  table: "scraps",
  localKey: "bsf.scraps.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    // Chưa gắn kỳ thì phải là NULL — chuỗi rỗng vi phạm khóa ngoại balancing_periods.
    period_id: x.periodId || null,
    name: x.name,
    quantity_kg: x.quantityKg,
    selling_price: x.sellingPrice,
    date: x.date || null,
    workshop: x.workshop,
    source: x.source,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    periodId: s(r.period_id),
    name: s(r.name),
    quantityKg: Number(r.quantity_kg ?? 0),
    sellingPrice: n(r.selling_price),
    date: s(r.date).slice(0, 10),
    workshop: s(r.workshop) as Workshop | "",
    // Dòng cũ (trước 0004) không có cột nguồn → là dòng nhập tay trong kỳ.
    source: (s(r.source) || "Cân đối") as ScrapSource,
  }),
  vaDongCu: (x) =>
    x.source == null
      ? { ...x, date: x.date ?? "", workshop: x.workshop ?? "", source: "Cân đối" }
      : x,
};

export const BANG_BALANCING_OUTPUT: AnhXaBang<BalancingOutputItem> = {
  table: "balancing_outputs",
  localKey: "bsf.balancing-outputs.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    period_id: x.periodId,
    product_id: x.productId,
    customer_id: x.customerId,
    channel: x.channel,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice,
    spec: x.spec ?? "",
    sales_item_id: x.salesItemId ?? "",
    daily_quantities: x.dailyQuantities ?? {},
    carry_over_kg: x.carryOverKg ?? 0,
    carry_over_period_id: x.carryOverPeriodId ?? "",
    auto_source: x.autoSource ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    periodId: s(r.period_id),
    productId: s(r.product_id),
    customerId: s(r.customer_id),
    channel: s(r.channel) as SalesChannel,
    quantityKg: Number(r.quantity_kg ?? 0),
    unitPrice: n(r.unit_price),
    spec: s(r.spec),
    salesItemId: s(r.sales_item_id),
    dailyQuantities: doiSanLuongNgay(r.daily_quantities),
    carryOverKg: Number(r.carry_over_kg ?? 0),
    carryOverPeriodId: s(r.carry_over_period_id),
    autoSource: s(r.auto_source) as GridAutoSource,
  }),
  // Dòng ghi trước 0005 không có quy cách / nguồn bán → coi là dòng nhập tay.
  // Dòng ghi trước 0019 chưa có lưới ngày / chuyển kỳ → mặc định rỗng.
  vaDongCu: (x) => ({
    ...x,
    spec: x.spec ?? "",
    salesItemId: x.salesItemId ?? "",
    dailyQuantities: x.dailyQuantities ?? {},
    carryOverKg: x.carryOverKg ?? 0,
    carryOverPeriodId: x.carryOverPeriodId ?? "",
    autoSource: x.autoSource ?? "",
  }),
};

/** Hồ sơ người dùng — khóa `id` = auth user id (uuid). */
export const BANG_USER_PROFILE: AnhXaBang<UserProfile> = {
  table: "user_profiles",
  localKey: "bsf.user-profiles.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    full_name: x.fullName,
    username: x.username,
    roles: rolesToCsv(x.roles), // mảng → CSV (cột text)
  }),
  fromRow: (r) => ({
    id: s(r.id),
    fullName: s(r.full_name),
    username: s(r.username),
    roles: rolesFromCsv(s(r.roles)), // CSV → mảng
  }),
};

/** Phiếu bán — một khách, một lượt, nhiều dòng mặt hàng. */
export const BANG_SALES_INVOICE: AnhXaBang<SalesInvoice> = {
  table: "sales_invoices",
  localKey: "bsf.sales-invoices.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    delivery_date: x.deliveryDate,
    posting_date: x.postingDate,
    backdate_reason: x.backdateReason,
    workshop: x.workshop,
    customer_id: x.customerId,
    channel: x.channel,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    deliveryDate: s(r.delivery_date).slice(0, 10),
    postingDate: s(r.posting_date).slice(0, 10),
    backdateReason: s(r.backdate_reason),
    workshop: s(r.workshop) as Workshop,
    customerId: s(r.customer_id),
    channel: s(r.channel) as SalesChannel,
    note: s(r.note),
  }),
};

/** Dòng bán trong phiếu. */
export const BANG_SALES_ITEM: AnhXaBang<SalesItem> = {
  table: "sales_items",
  localKey: "bsf.sales-items.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    invoice_id: x.invoiceId,
    delivery_date: x.deliveryDate || null,
    product_id: x.productId,
    spec: x.spec,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice,
    source_warehouse: x.sourceWarehouse,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    invoiceId: s(r.invoice_id),
    deliveryDate: s(r.delivery_date).slice(0, 10),
    productId: s(r.product_id),
    spec: s(r.spec),
    quantityKg: Number(r.quantity_kg ?? 0),
    unitPrice: n(r.unit_price),
    sourceWarehouse: s(r.source_warehouse),
  }),
};

/* ---------- Module WIP ---------- */

/** Dòng BTP sản xuất ngày. */
export const BANG_WIP_PRODUCTION: AnhXaBang<WipProductionItem> = {
  table: "production_wips",
  localKey: "bsf.production-wips.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    production_date: x.productionDate,
    posting_date: x.postingDate || null,
    backdate_reason: x.backdateReason,
    workshop: x.workshop,
    product_id: x.productId,
    spec: x.spec,
    quantity_kg: x.quantityKg,
    blocks_count: x.blocksCount,
    warehouse: x.warehouse,
    status: x.status,
    note: x.note,
    customer_name: x.customerName ?? "",
    component_rau_kg: x.componentRauKg ?? null,
    component_bao_tu_kg: x.componentBaoTuKg ?? null,
    balancing_period_id: x.balancingPeriodId ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    productionDate: s(r.production_date).slice(0, 10),
    postingDate: s(r.posting_date).slice(0, 10),
    backdateReason: s(r.backdate_reason),
    workshop: s(r.workshop) as Workshop,
    productId: s(r.product_id),
    spec: s(r.spec),
    quantityKg: Number(r.quantity_kg ?? 0),
    blocksCount: Number(r.blocks_count ?? 0),
    warehouse: s(r.warehouse),
    status: (s(r.status) || "cho-nhap") as WipWarehouseStatus,
    note: s(r.note),
    customerName: s(r.customer_name),
    componentRauKg: r.component_rau_kg == null ? null : Number(r.component_rau_kg),
    componentBaoTuKg:
      r.component_bao_tu_kg == null ? null : Number(r.component_bao_tu_kg),
    balancingPeriodId: s(r.balancing_period_id),
  }),
  // Dòng ghi trước 0019/0030 chưa có cột kỳ / khách / thành phần → mặc định trống.
  vaDongCu: (x) => ({
    ...x,
    customerName: x.customerName ?? "",
    componentRauKg: x.componentRauKg ?? null,
    componentBaoTuKg: x.componentBaoTuKg ?? null,
    balancingPeriodId: x.balancingPeriodId ?? "",
  }),
};

/** Chốt ngày sản xuất (bảng riêng, cùng hình dạng DailyLock). */
export const BANG_PRODUCTION_LOCK: AnhXaBang<DailyLock> = {
  table: "production_locks",
  localKey: "bsf.production-locks.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    lock_date: x.lockDate,
    workshop: x.workshop,
    is_locked: x.isLocked,
    locked_at: x.lockedAt,
    total_kg_at_lock: x.totalKgAtLock,
    reopen_reason: x.reopenReason,
    note: x.note,
    leftover_kg: x.leftoverKg ?? 0,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    lockDate: s(r.lock_date).slice(0, 10),
    workshop: s(r.workshop) as Workshop,
    isLocked: Boolean(r.is_locked),
    lockedAt: s(r.locked_at),
    totalKgAtLock: Number(r.total_kg_at_lock ?? 0),
    reopenReason: s(r.reopen_reason),
    note: s(r.note),
    leftoverKg: Number(r.leftover_kg ?? 0),
  }),
};

/** Phiếu đóng gói BTP → thành phẩm (G3, migration 0029). */
export const BANG_PACKAGING: AnhXaBang<Packaging> = {
  table: "packagings",
  localKey: "bsf.packagings.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    date: x.date,
    workshop: x.workshop,
    from_product_id: x.fromProductId,
    from_spec: x.fromSpec,
    input_kg: x.inputKg,
    input_blocks: x.inputBlocks,
    to_product_id: x.toProductId,
    to_spec: x.toSpec,
    output_kg: x.outputKg,
    output_units: x.outputUnits,
    warehouse: x.warehouse,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    date: s(r.date).slice(0, 10),
    workshop: s(r.workshop) as Workshop,
    fromProductId: s(r.from_product_id),
    fromSpec: s(r.from_spec),
    inputKg: Number(r.input_kg ?? 0),
    inputBlocks: Number(r.input_blocks ?? 0),
    toProductId: s(r.to_product_id),
    toSpec: s(r.to_spec),
    outputKg: Number(r.output_kg ?? 0),
    outputUnits: Number(r.output_units ?? 0),
    warehouse: s(r.warehouse),
    note: s(r.note),
  }),
};

/** Đơn đặt. */
export const BANG_SALES_ORDER: AnhXaBang<SalesOrder> = {
  table: "sales_orders",
  localKey: "bsf.sales-orders.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    customer_id: x.customerId,
    order_date: x.orderDate,
    status: x.status,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    customerId: s(r.customer_id),
    orderDate: s(r.order_date).slice(0, 10),
    status: (s(r.status) || "dang-gom") as SalesOrderStatus,
    note: s(r.note),
  }),
};

/** Dòng cần của đơn. */
export const BANG_ORDER_ITEM: AnhXaBang<OrderItem> = {
  table: "order_items",
  localKey: "bsf.order-items.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    order_id: x.orderId,
    product_id: x.productId,
    spec: x.spec,
    required_quantity_kg: x.requiredQuantityKg,
    required_blocks_count: x.requiredBlocksCount,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    orderId: s(r.order_id),
    productId: s(r.product_id),
    spec: s(r.spec),
    requiredQuantityKg: Number(r.required_quantity_kg ?? 0),
    requiredBlocksCount: Number(r.required_blocks_count ?? 0),
  }),
};

/** Lệnh xuất. */
export const BANG_EXPORT_ORDER: AnhXaBang<ExportOrder> = {
  table: "export_orders",
  localKey: "bsf.export-orders.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    order_id: x.orderId,
    export_date: x.exportDate,
    status: x.status,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    orderId: s(r.order_id),
    exportDate: s(r.export_date).slice(0, 10),
    status: (s(r.status) || "mo") as "mo" | "dong",
    note: s(r.note),
  }),
};

/** Dòng thực xuất (trừ tồn theo lô). */
export const BANG_EXPORT_ITEM: AnhXaBang<ExportItem> = {
  table: "export_items",
  localKey: "bsf.export-items.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    export_id: x.exportId,
    wip_id: x.wipId,
    product_id: x.productId,
    spec: x.spec,
    quantity_kg: x.quantityKg,
    blocks_count: x.blocksCount,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    exportId: s(r.export_id),
    wipId: s(r.wip_id),
    productId: s(r.product_id),
    spec: s(r.spec),
    quantityKg: Number(r.quantity_kg ?? 0),
    blocksCount: Number(r.blocks_count ?? 0),
  }),
};

/** Tồn đầu kho nguyên liệu — số dư đông dự trữ có sẵn trước khi số hoá (kg). */
export const BANG_OPENING_STOCK: AnhXaBang<MaterialOpeningStock> = {
  table: "material_opening_stock",
  localKey: "bsf.material-opening-stock.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    workshop: x.workshop,
    material_type_name: x.materialTypeName,
    as_of_date: x.asOfDate || null,
    quantity_kg: x.quantityKg,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    workshop: s(r.workshop) as Workshop,
    materialTypeName: s(r.material_type_name),
    asOfDate: s(r.as_of_date).slice(0, 10),
    quantityKg: Number(r.quantity_kg ?? 0),
    note: s(r.note),
  }),
};

/** Tồn đầu kho thành phẩm — số dư BTP đông dự trữ có sẵn trước khi số hoá (kg + block). */
export const BANG_FINISHED_OPENING_STOCK: AnhXaBang<FinishedGoodsOpeningStock> = {
  table: "finished_goods_opening_stock",
  localKey: "bsf.finished-opening-stock.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    product_id: x.productId,
    spec: x.spec,
    as_of_date: x.asOfDate || null,
    quantity_kg: x.quantityKg,
    blocks_count: x.blocksCount,
    warehouse: x.warehouse,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    productId: s(r.product_id),
    spec: s(r.spec),
    asOfDate: s(r.as_of_date).slice(0, 10),
    quantityKg: Number(r.quantity_kg ?? 0),
    blocksCount: Number(r.blocks_count ?? 0),
    warehouse: s(r.warehouse),
    note: s(r.note),
  }),
};

/* ---------- Hàng chờ đồng bộ (chống mất số liệu khi ghi hụt) ----------
   Ghi lên máy chủ có thể hụt giữa ca (wifi rớt, tablet ngủ, server nghẽn).
   Mỗi bảng giữ một "hàng chờ" khóa các dòng chưa đẩy được:
     - them: dòng thêm/sửa chưa lên server
     - xoa : dòng đã xóa dưới máy nhưng chưa xóa được trên server (tombstone)
   Mọi lần ghi HAY mở app đều thử đẩy lại hàng chờ. Lúc mở, HOÀ server với dòng
   local chưa đẩy thay vì đè mù — nên reload không nuốt chuyến hàng ghi hụt. */

interface ChoDongBo {
  them: string[];
  xoa: string[];
}

function layMsg(e: unknown): string {
  // Lỗi Supabase là object thường (có .message), không phải Error →
  // String(e) ra "[object Object]". Rút .message cho người dùng đọc được.
  return e instanceof Error
    ? e.message
    : e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);
}

function napCho(localKey: string): ChoDongBo {
  try {
    const raw = localStorage.getItem(`${localKey}.cho`);
    if (!raw) return { them: [], xoa: [] };
    const p = JSON.parse(raw) as Partial<ChoDongBo>;
    return {
      them: Array.isArray(p.them) ? p.them : [],
      xoa: Array.isArray(p.xoa) ? p.xoa : [],
    };
  } catch {
    return { them: [], xoa: [] };
  }
}

function luuCho(localKey: string, cho: ChoDongBo) {
  try {
    if (cho.them.length === 0 && cho.xoa.length === 0)
      localStorage.removeItem(`${localKey}.cho`);
    else localStorage.setItem(`${localKey}.cho`, JSON.stringify(cho));
  } catch {
    // Hết dung lượng: bỏ qua, lần ghi sau thử lại.
  }
}

/** Đẩy toàn bộ hàng chờ của một bảng lên máy chủ. Sạch chờ nếu thành công. */
async function dongBoCho<T>(
  bang: AnhXaBang<T>,
  khoa: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  if (!supabase) return { ok: true };
  const cho = napCho(bang.localKey);
  if (cho.them.length === 0 && cho.xoa.length === 0) return { ok: true };

  const theoKhoa = new Map(rows.map((x) => [bang.layKhoa(x), x]));
  const capNhat = cho.them
    .map((k) => theoKhoa.get(k))
    .filter((x): x is T => x !== undefined)
    .map((x) => ({ ...bang.toRow(x), site_id: SITE_ID }));

  try {
    if (capNhat.length > 0) {
      const { error } = await supabase
        .from(bang.table)
        .upsert(capNhat, { onConflict: khoa });
      if (error) throw error;
    }
    if (cho.xoa.length > 0) {
      const { error } = await supabase
        .from(bang.table)
        .delete()
        .in(khoa, cho.xoa);
      if (error) throw error;
    }
    luuCho(bang.localKey, { them: [], xoa: [] });
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: layMsg(e) };
  }
}

/* ---------- Nhật ký thao tác (audit) ---------- */

/** Nhãn tiếng Việt của bảng — cho câu tóm tắt nhật ký dễ đọc. */
const NHAN_BANG: Record<string, string> = {
  material_imports: "Nhập nguyên liệu",
  import_shipments: "Chuyến nhập",
  daily_locks: "Chốt ngày nhập",
  scraps: "Phế liệu",
  production_wips: "Sản xuất BTP",
  production_locks: "Chốt ngày sản xuất",
  packagings: "Đóng gói BTP → TP",
  balancing_periods: "Kỳ cân đối",
  balancing_inputs: "Nguyên liệu vào (cân đối)",
  balancing_outputs: "Thành phẩm ra (cân đối)",
  sales_invoices: "Phiếu bán",
  sales_items: "Dòng bán",
  sales_orders: "Đơn đặt",
  order_items: "Dòng đơn đặt",
  export_orders: "Lệnh xuất",
  export_items: "Dòng lệnh xuất",
  products: "Mặt hàng",
  customers: "Khách hàng",
  suppliers: "Đại lý",
  material_types: "Loại nguyên liệu",
  finished_goods: "Thành phẩm (danh mục)",
  user_profiles: "Người dùng",
  material_opening_stock: "Tồn đầu nguyên liệu",
  finished_goods_opening_stock: "Tồn đầu thành phẩm",
};

/** Trường đổi giữa hai bản ghi → { trường: [trước, sau] }. */
function khacBiet(a: unknown, b: unknown): Record<string, [unknown, unknown]> {
  const ra: Record<string, [unknown, unknown]> = {};
  const oa = (a ?? {}) as Record<string, unknown>;
  const ob = (b ?? {}) as Record<string, unknown>;
  for (const k of new Set([...Object.keys(oa), ...Object.keys(ob)])) {
    if (JSON.stringify(oa[k]) !== JSON.stringify(ob[k])) ra[k] = [oa[k], ob[k]];
  }
  return ra;
}

/** So danh sách cũ↔mới của một bảng, phát entry nhật ký thêm/sửa/xóa. */
function nhatKyThayDoi<T>(bang: AnhXaBang<T>, cu: T[], next: T[]): void {
  if (bang.table === "audit_log") return; // không tự lưu vết chính mình
  const nhan = NHAN_BANG[bang.table] ?? bang.table;
  const cuMap = new Map(cu.map((x) => [bang.layKhoa(x), x]));
  const nextMap = new Map(next.map((x) => [bang.layKhoa(x), x]));
  const entries: NhatKyMoi[] = [];
  for (const [k, x] of nextMap) {
    const c = cuMap.get(k);
    if (c === undefined) {
      entries.push({ action: "them", entity: bang.table, entityKey: k, summary: `Thêm ${nhan}`, diff: { _new: x } });
    } else if (JSON.stringify(c) !== JSON.stringify(x)) {
      entries.push({ action: "sua", entity: bang.table, entityKey: k, summary: `Sửa ${nhan}`, diff: khacBiet(c, x) });
    }
  }
  for (const [k] of cuMap) {
    if (!nextMap.has(k)) entries.push({ action: "xoa", entity: bang.table, entityKey: k, summary: `Xóa ${nhan}` });
  }
  ghiNhatKy(entries);
}

/* ---------- Hook ---------- */

export type TrangThai = "dang-tai" | "san-sang" | "loi";

export function useBang<T>(bang: AnhXaBang<T>, seed: () => T[] = () => []) {
  const khoa = bang.khoaChinh ?? "id";
  const va = bang.vaDongCu;
  const napLocal = (key: string) => {
    const xs = load<T>(key);
    return va ? xs.map(va) : xs;
  };

  const [rows, setRows] = useState<T[]>(() => {
    const co = napLocal(bang.localKey);
    if (co.length > 0) return co;
    const s0 = seed();
    if (s0.length > 0 && !hasSupabase) save(bang.localKey, s0);
    return s0;
  });
  const [trangThai, setTrangThai] = useState<TrangThai>(
    hasSupabase ? "dang-tai" : "san-sang"
  );
  const [loi, setLoi] = useState<string | null>(null);
  const truoc = useRef<T[]>(rows);
  truoc.current = rows;

  /* Nạp từ máy chủ */
  useEffect(() => {
    if (!supabase) return;
    let huy = false;
    (async () => {
      const { data, error } = await supabase
        .from(bang.table)
        .select("*")
        .eq("site_id", SITE_ID);
      if (huy) return;
      if (error) {
        setTrangThai("loi");
        setLoi(error.message);
        ketNoi.baoLoi(error.message);
        return;
      }
      const may = (data ?? []).map((r) =>
        bang.fromRow(r as Record<string, unknown>)
      );

      // Bảng rỗng lần đầu + máy này cũng chưa có gì → đẩy seed lên danh mục.
      if (may.length === 0) {
        const cho0 = napCho(bang.localKey);
        const localCu = napLocal(bang.localKey);
        const chuaCoGi =
          localCu.length === 0 && cho0.them.length === 0 && cho0.xoa.length === 0;
        if (chuaCoGi) {
          const s0 = seed();
          if (s0.length > 0) {
            const { error: e2 } = await supabase
              .from(bang.table)
              .upsert(
                s0.map((x) => ({ ...bang.toRow(x), site_id: SITE_ID })),
                { onConflict: khoa }
              );
            if (huy) return;
            if (e2) {
              setTrangThai("loi");
              setLoi(e2.message);
              ketNoi.baoLoi(e2.message);
              return;
            }
            setRows(s0);
            save(bang.localKey, s0);
            setTrangThai("san-sang");
            ketNoi.baoOK();
            return;
          }
        }
      }

      /* HOÀ server với dòng local CHƯA đồng bộ — KHÔNG đè mù, nếu không reload
         sẽ nuốt chuyến hàng ghi hụt (dòng chỉ có dưới máy, chưa lên server). */
      const cho = napCho(bang.localKey);
      const local = napLocal(bang.localKey);
      const localTheoKhoa = new Map(local.map((x) => [bang.layKhoa(x), x]));
      const hoa = new Map(may.map((x) => [bang.layKhoa(x), x])); // nền = server
      for (const k of cho.them) {
        const r = localTheoKhoa.get(k); // bản local chưa đẩy → thắng server
        if (r !== undefined) hoa.set(k, r);
      }
      for (const k of cho.xoa) hoa.delete(k); // đã xóa dưới máy → đừng hồi sinh
      const ketQua = [...hoa.values()];
      setRows(ketQua);
      save(bang.localKey, ketQua);

      // Thử đẩy hàng chờ lên server ngay khi vừa nối được.
      const kq = await dongBoCho(bang, khoa, ketQua);
      if (huy) return;
      if (kq.ok) {
        setLoi(null);
        setTrangThai("san-sang");
        ketNoi.baoOK();
      } else {
        setTrangThai("loi");
        setLoi(kq.msg ?? "Lỗi đồng bộ máy chủ");
        ketNoi.baoLoi(kq.msg ?? "Lỗi đồng bộ máy chủ");
      }
    })();
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bang.table]);

  const ghi = useCallback(
    (next: T[]) => {
      const cu = truoc.current;
      setRows(next);
      save(bang.localKey, next); // luôn có bản sao dưới máy

      // Nhật ký thao tác — chạy cả hai chế độ (server + localStorage).
      nhatKyThayDoi(bang, cu, next);

      if (!supabase) return;

      const cuTheoKhoa = new Map(cu.map((x) => [bang.layKhoa(x), x]));
      const khoaMoi = new Set(next.map((x) => bang.layKhoa(x)));

      const themKeys = next
        .filter((x) => {
          const c = cuTheoKhoa.get(bang.layKhoa(x));
          return !c || JSON.stringify(c) !== JSON.stringify(x);
        })
        .map((x) => bang.layKhoa(x));
      const xoaKeys = cu
        .filter((x) => !khoaMoi.has(bang.layKhoa(x)))
        .map((x) => bang.layKhoa(x));

      /* Ghi vào hàng chờ TRƯỚC khi gọi server: hụt thì vẫn còn dấu để đẩy lại
         lần sau. Gộp với hàng chờ cũ nên các dòng hụt trước cũng được đẩy kèm. */
      const cho = napCho(bang.localKey);
      const them = new Set([...cho.them, ...themKeys]);
      const xoa = new Set([...cho.xoa, ...xoaKeys]);
      xoaKeys.forEach((k) => them.delete(k)); // vừa xóa thì thôi thêm
      themKeys.forEach((k) => xoa.delete(k)); // thêm/sửa lại thì thôi xóa
      luuCho(bang.localKey, { them: [...them], xoa: [...xoa] });

      (async () => {
        const kq = await dongBoCho(bang, khoa, next);
        if (kq.ok) {
          setLoi(null);
          setTrangThai("san-sang");
          ketNoi.baoOK();
        } else {
          const msg = kq.msg ?? "Lỗi ghi máy chủ";
          setTrangThai("loi");
          setLoi(msg);
          ketNoi.baoLoi(msg);
        }
      })();
    },
    [bang, khoa]
  );

  return [rows, ghi, { trangThai, loi }] as const;
}
