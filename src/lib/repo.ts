// ============================================================
// Tên file: src/lib/repo.ts
// Tên tiếng Việt tương đương: Tầng Repository Dữ liệu Supabase & Sync Queue
// Description: Data Access Layer bridging LocalStorage and Supabase backend
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, hasSupabase, SITE_ID } from "@/lib/supabase";
import { rowToServer, rowFromServer, toServerKey, modeLocalKey } from "@/lib/demoMode";
import { connectivity } from "@/lib/connectivity";
import { load, save } from "@/lib/db";
import type {
  FinishedGood,
  Workshop,
  UserProfile,
  Category,
  ImportShipment,
  MaterialImportItem,
  DailyLock,
  QcChecklistItem,
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
  NxtSnapshotLine,
  StorageLocation,
  MonthlyStockLine,
  ReconciliationRun,
  LotInput,
  LabelPrint,
  LotDispatch,
  LotWaiver,
  BatterType,
  DomesticSaleItem,
  RowMark,
} from "@/types";
import { rolesFromCsv, rolesToCsv } from "@/types";
import { getProductBatterIds, sanitizeBatterKg } from "@/lib/batter";
import { appendAuditEntries, type NewAuditEntry } from "@/lib/audit";

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

export interface TableMapping<T> {
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
  /**
   * Trường KHÔNG chép xuống bản sao localStorage khi chạy Supabase (vd file Excel
   * base64 ~MB của bản đối soát: chép xuống là đầy quota ~5MB ⇒ mọi bảng khác mất
   * bản sao + hàng chờ). Dòng còn nằm hàng chờ `them` vẫn GIỮ đủ (chưa lên server
   * thì bản dưới máy là bản duy nhất); lúc hoà với server, dòng local thiếu trường
   * này lấy lại từ server. Chế độ chỉ-máy-này: không bỏ gì (local là kho duy nhất).
   */
  truongKhongCache?: (keyof T & string)[];
  /**
   * Cột (tên DB) là KHÓA NGOẠI trỏ tới khóa chính bảng khác — chế độ demo phải thêm
   * tiền tố `demo:` cho cả cột này như khóa chính (lib/demoMode.ts), không thì máy chủ
   * từ chối (23503). DB thật: `period_id → balancing_periods.id` ở balancing_inputs,
   * balancing_outputs, scraps. Thêm khóa ngoại mới giữa hai bảng nghiệp vụ ⇒ khai ở đây.
   */
  cotThamChieu?: string[];
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const theoId = <T extends { id: string }>(x: T) => x.id;

/**
 * Cột `daily_quantities` (jsonb) → `{ "2025-07-22": 5120 }`.
 * Supabase trả về object; bản sao localStorage có thể là chuỗi JSON. Bỏ mọi ô
 * không phải số hữu hạn để một ô hỏng không làm tổng của cả kỳ thành NaN.
 */
function parseDailyQuantities(v: unknown): DailyQuantities {
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
  for (const [date, so] of Object.entries(raw as Record<string, unknown>)) {
    const x = Number(so);
    if (Number.isFinite(x)) ra[date] = x;
  }
  return ra;
}

/* ---------- Ánh xạ camelCase (app) ↔ snake_case (Postgres) ---------- */

export const BANG_SUPPLIER: TableMapping<Supplier> = {
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

export const BANG_MATERIAL_TYPE: TableMapping<MaterialType> = {
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
export const BANG_FINISHED_GOOD: TableMapping<FinishedGood> = {
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

export const BANG_PRODUCT: TableMapping<Product> = {
  table: "products",
  localKey: "bsf.products.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    finished_good_code: x.finishedGoodCode ?? "",
    // Trường tùy chọn ⇒ gửi chuỗi rỗng (cột NOT NULL default ''), không để undefined.
    category: x.category ?? "",
    material_type_id: x.materialTypeId ?? "",
    processing_type: x.processingType ?? "",
    // Danh mục (CRUD) lưu chuỗi "1"/"" cho cờ tách; chuẩn hoá về boolean.
    split_components: x.splitComponents === true || x.splitComponents === "1",
    block_spec_kg:
      x.blockSpecKg == null || x.blockSpecKg === "" || Number(x.blockSpecKg) <= 0
        ? null
        : Number(x.blockSpecKg),
    // Migration 0051 → gửi LUÔN (form danh mục lưu chuỗi "id1,id2" ⇒ chuẩn hoá về
    // mảng). Gửi có điều kiện sẽ KHÔNG xoá được về rỗng (upsert giữ giá trị cũ).
    batter_ids: getProductBatterIds(x),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    finishedGoodCode: s(r.finished_good_code),
    category: r.category == null ? "" : s(r.category),
    materialTypeId: r.material_type_id == null ? "" : s(r.material_type_id),
    processingType: r.processing_type == null ? "" : s(r.processing_type),
    splitComponents: Boolean(r.split_components),
    blockSpecKg: r.block_spec_kg == null ? null : Number(r.block_spec_kg),
    batterIds: Array.isArray(r.batter_ids) ? (r.batter_ids as string[]) : [],
  }),
  // Dòng ghi trước 0031/0051 chưa có cờ tách / quy cách block / bột đi kèm → mặc định trống.
  vaDongCu: (x) => ({
    ...x,
    splitComponents: x.splitComponents ?? false,
    blockSpecKg: x.blockSpecKg ?? null,
    batterIds: x.batterIds ?? [],
  }),
};

export const BANG_CUSTOMER: TableMapping<Customer> = {
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
export const BANG_IMPORT_SHIPMENT: TableMapping<ImportShipment> = {
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
    lot_code: x.lotCode ?? "",
    sscc_code: x.ssccCode ?? "",
    scan_path: x.scanPath ?? "",
    operator: x.operator ?? "",
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
    lotCode: s(r.lot_code),
    ssccCode: s(r.sscc_code),
    scanPath: s(r.scan_path),
    operator: s(r.operator),
  }),
  // Chuyến ghi trước 0035/0040/0042 chưa có mã lô/SSCC/ảnh/người ghi → để trống.
  vaDongCu: (x) => ({
    ...x,
    lotCode: x.lotCode ?? "",
    ssccCode: x.ssccCode ?? "",
    scanPath: x.scanPath ?? "",
    operator: x.operator ?? "",
  }),
};

/** Chốt số liệu một ngày của một phân xưởng. */
export const BANG_DAILY_LOCK: TableMapping<DailyLock> = {
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

export const BANG_MATERIAL_IMPORT: TableMapping<MaterialImportItem> = {
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

export const BANG_BALANCING_PERIOD: TableMapping<BalancingPeriod> = {
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

export const BANG_BALANCING_INPUT: TableMapping<BalancingInputItem> = {
  table: "balancing_inputs",
  localKey: "bsf.balancing-inputs.v2",
  layKhoa: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  cotThamChieu: ["period_id"],
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
    // Cột 0053 (lô lấy / kho gửi của 2 dòng kho): CHỈ gửi khi trường có giá trị —
    // DB chưa chạy 0053 thì dòng cũ vẫn lên máy chủ (khuôn 0052 / nguon_kho 0008).
    ...(x.stockLineId != null ? { stock_line_id: x.stockLineId } : {}),
    ...(x.stockLocation != null ? { stock_location: x.stockLocation } : {}),
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
    dailyQuantities: parseDailyQuantities(r.daily_quantities),
    carryOverKg: Number(r.carry_over_kg ?? 0),
    carryOverPeriodId: s(r.carry_over_period_id),
    isReduction: Boolean(r.is_reduction),
    reductionWarehouseId: s(r.reduction_warehouse_id),
    autoSource: s(r.auto_source) as GridAutoSource,
    stockLineId: r.stock_line_id == null ? undefined : s(r.stock_line_id),
    stockLocation: r.stock_location == null ? undefined : s(r.stock_location),
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

export const BANG_SCRAP: TableMapping<ScrapItem> = {
  table: "scraps",
  localKey: "bsf.scraps.v2",
  layKhoa: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  cotThamChieu: ["period_id"],
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

export const BANG_BALANCING_OUTPUT: TableMapping<BalancingOutputItem> = {
  table: "balancing_outputs",
  localKey: "bsf.balancing-outputs.v2",
  layKhoa: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  cotThamChieu: ["period_id"],
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
    // Cột 0052: CHỈ gửi khi dòng đã có phần Nợ — DB chưa chạy 0052 thì dòng cũ
    // vẫn lên máy chủ được (cùng cách nguon_kho với 0008).
    ...(x.debtKg != null ? { debt_kg: x.debtKg } : {}),
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
    dailyQuantities: parseDailyQuantities(r.daily_quantities),
    carryOverKg: Number(r.carry_over_kg ?? 0),
    debtKg: r.debt_kg == null ? undefined : Number(r.debt_kg),
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
export const BANG_USER_PROFILE: TableMapping<UserProfile> = {
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
export const BANG_SALES_INVOICE: TableMapping<SalesInvoice> = {
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
export const BANG_SALES_ITEM: TableMapping<SalesItem> = {
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
export const BANG_WIP_PRODUCTION: TableMapping<WipProductionItem> = {
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
    processing_type: x.processingType ?? "",
    component_rau_kg: x.componentRauKg ?? null,
    component_bao_tu_kg: x.componentBaoTuKg ?? null,
    balancing_period_id: x.balancingPeriodId ?? "",
    operator: x.operator ?? "",
    // Migration 0051 → gửi LUÔN (như leftover_by_material 0038): gửi có điều kiện
    // sẽ KHÔNG xoá được lượng bột khi sửa về rỗng.
    batter_kg: sanitizeBatterKg(x.batterKg),
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
    processingType: r.processing_type == null ? "" : s(r.processing_type),
    componentRauKg: r.component_rau_kg == null ? null : Number(r.component_rau_kg),
    componentBaoTuKg:
      r.component_bao_tu_kg == null ? null : Number(r.component_bao_tu_kg),
    balancingPeriodId: s(r.balancing_period_id),
    operator: s(r.operator),
    batterKg: sanitizeBatterKg(r.batter_kg),
  }),
  // Dòng ghi trước 0019/0030/0033/0037/0051 chưa có cột kỳ / khách / chế biến / thành phần / người thao tác / bột → mặc định trống.
  vaDongCu: (x) => ({
    ...x,
    customerName: x.customerName ?? "",
    processingType: x.processingType ?? "",
    componentRauKg: x.componentRauKg ?? null,
    componentBaoTuKg: x.componentBaoTuKg ?? null,
    balancingPeriodId: x.balancingPeriodId ?? "",
    operator: x.operator ?? "",
    batterKg: x.batterKg ?? {},
  }),
};

/** Chốt ngày sản xuất (bảng riêng, cùng hình dạng DailyLock). */
export const BANG_PRODUCTION_LOCK: TableMapping<DailyLock> = {
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
    // Migration 0038 đã chạy → gửi LUÔN (như leftover_kg). Gửi có điều kiện sẽ
    // KHÔNG xoá được còn-dở khi sửa về rỗng (upsert onConflict giữ giá trị cũ).
    leftover_by_material: x.leftoverByMaterial ?? {},
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
    leftoverByMaterial:
      r.leftover_by_material && typeof r.leftover_by_material === "object"
        ? (r.leftover_by_material as Record<string, number>)
        : {},
  }),
};

/** QC checklist chấm điểm cuối ngày (họp 2026-09-02, migration 0036). */
export const BANG_QC_CHECKLIST: TableMapping<QcChecklistItem> = {
  table: "qc_checklists",
  localKey: "bsf.qc-checklists.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    date: x.date,
    workshop: x.workshop,
    criterion: x.criterion,
    result: x.result,
    score: x.score,
    note: x.note,
    backdate_reason: x.backdateReason,
    // Migration 0039 đã chạy → gửi LUÔN (như leftover_by_material 0038). Gửi có
    // điều kiện sẽ KHÔNG xoá được ảnh khi bỏ hết (upsert onConflict giữ giá trị cũ).
    photo_paths: x.photoPaths ?? [],
  }),
  fromRow: (r) => ({
    id: s(r.id),
    date: s(r.date).slice(0, 10),
    workshop: s(r.workshop) as Workshop,
    criterion: s(r.criterion),
    result: (s(r.result) || "dat") as QcChecklistItem["result"],
    score: n(r.score),
    note: s(r.note),
    backdateReason: s(r.backdate_reason),
    photoPaths: Array.isArray(r.photo_paths) ? (r.photo_paths as string[]) : [],
  }),
};

/** Chốt ngày QC (cùng hình dạng DailyLock, migration 0036). */
export const BANG_QC_LOCK: TableMapping<DailyLock> = {
  table: "qc_locks",
  localKey: "bsf.qc-locks.v1",
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

/** Phiếu đóng gói BTP → thành phẩm (G3, migration 0029). */
export const BANG_PACKAGING: TableMapping<Packaging> = {
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
export const BANG_SALES_ORDER: TableMapping<SalesOrder> = {
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
export const BANG_ORDER_ITEM: TableMapping<OrderItem> = {
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
export const BANG_EXPORT_ORDER: TableMapping<ExportOrder> = {
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
export const BANG_EXPORT_ITEM: TableMapping<ExportItem> = {
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
export const BANG_OPENING_STOCK: TableMapping<MaterialOpeningStock> = {
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
export const BANG_FINISHED_OPENING_STOCK: TableMapping<FinishedGoodsOpeningStock> = {
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

/** Snapshot Xuất–Nhập–Tồn nhập từ báo cáo thật (Kho × Mã hàng × Kỳ). Tồn cuối suy ở app. */
export const BANG_NXT_SNAPSHOT: TableMapping<NxtSnapshotLine> = {
  table: "nxt_snapshots",
  localKey: "bsf.nxt-snapshots.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    warehouse_code: x.warehouseCode,
    storage_location: x.storageLocation,
    period_from: x.periodFrom || null,
    period_to: x.periodTo || null,
    item_code: x.itemCode,
    item_name: x.itemName,
    unit: x.unit,
    opening_kg: x.openingKg,
    in_kg: x.inKg,
    out_kg: x.outKg,
    opening_value: x.openingValue,
    in_value: x.inValue,
    out_value: x.outValue,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    warehouseCode: s(r.warehouse_code),
    storageLocation: s(r.storage_location),
    periodFrom: s(r.period_from).slice(0, 10),
    periodTo: s(r.period_to).slice(0, 10),
    itemCode: s(r.item_code),
    itemName: s(r.item_name),
    unit: s(r.unit) || "KG",
    openingKg: Number(r.opening_kg ?? 0),
    inKg: Number(r.in_kg ?? 0),
    outKg: Number(r.out_kg ?? 0),
    openingValue: Number(r.opening_value ?? 0),
    inValue: Number(r.in_value ?? 0),
    outValue: Number(r.out_value ?? 0),
    note: s(r.note),
  }),
  // Dòng ghi trước 0044 chưa có chiều kho lưu → rỗng (hiểu là kho nhà).
  vaDongCu: (x) => ({ ...x, storageLocation: x.storageLocation ?? "" }),
};

/** Danh mục kho LƯU hàng (kho nhà + kho lạnh thuê ngoài) — nối dữ liệu theo TÊN. */
export const BANG_STORAGE_LOCATION: TableMapping<StorageLocation> = {
  table: "storage_locations",
  localKey: "bsf.storage-locations.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    kind: x.kind,
    address: x.address,
    phone: x.phone,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    kind: (s(r.kind) === "thue-ngoai" ? "thue-ngoai" : "noi-bo") as StorageLocation["kind"],
    address: s(r.address),
    phone: s(r.phone),
    note: s(r.note),
  }),
};

/** Sổ BÁN NỘI ĐỊA (migration 0054) — NL bán thẳng, ghi ở /wip, Cân đối lấy làm dòng giảm. */
export const BANG_DOMESTIC_SALE: TableMapping<DomesticSaleItem> = {
  table: "domestic_sales",
  localKey: "bsf.domestic-sales.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    sale_date: x.saleDate,
    posting_date: x.postingDate || null,
    backdate_reason: x.backdateReason ?? "",
    workshop: x.workshop,
    material_type_name: x.materialTypeName,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice ?? null,
    customer_name: x.customerName ?? "",
    note: x.note ?? "",
    operator: x.operator ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    saleDate: s(r.sale_date).slice(0, 10),
    postingDate: s(r.posting_date).slice(0, 10),
    backdateReason: s(r.backdate_reason),
    workshop: (s(r.workshop) || "Đông") as Workshop,
    materialTypeName: s(r.material_type_name),
    quantityKg: Number(r.quantity_kg ?? 0),
    unitPrice: n(r.unit_price),
    customerName: s(r.customer_name),
    note: s(r.note),
    operator: s(r.operator),
  }),
};

/** TÔ MÀU DÒNG (migration 0055) — dấu "đã dò" kiểu Excel, dùng chung mọi bảng. */
export const BANG_ROW_MARK: TableMapping<RowMark> = {
  table: "row_marks",
  localKey: "bsf.row-marks.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    table_key: x.tableKey,
    row_id: x.rowId,
    column_key: x.columnKey ?? null,
    color: x.color ?? "",
    bold: Boolean(x.bold),
    marked_by: x.markedBy ?? "",
    marked_at: x.markedAt || new Date().toISOString(),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    tableKey: s(r.table_key),
    rowId: s(r.row_id),
    columnKey: r.column_key == null || r.column_key === "" ? null : s(r.column_key),
    color: s(r.color),
    bold: Boolean(r.bold),
    markedBy: s(r.marked_by),
    markedAt: s(r.marked_at),
  }),
};

/** Danh mục LOẠI BỘT TẨM (migration 0051) — sổ sản lượng nối theo TÊN. */
export const BANG_BATTER_TYPE: TableMapping<BatterType> = {
  table: "batter_types",
  localKey: "bsf.batter-types.v1",
  layKhoa: theoId,
  toRow: (x) => ({ id: x.id, code: x.code, name: x.name, note: x.note }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    note: s(r.note),
  }),
};

/** Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau. Tồn cuối suy ở app (kiện + kg). */
export const BANG_MONTHLY_STOCK: TableMapping<MonthlyStockLine> = {
  table: "monthly_stock_ledger",
  localKey: "bsf.monthly-stock.v2",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    period: x.period,
    category: x.category,
    warehouse: x.warehouse,
    item_name: x.itemName,
    size: x.size,
    origin: x.origin,
    import_date: x.importDate || null,
    // Migration 0045 phải chạy trước — gửi LUÔN để sửa về rỗng vẫn xoá được vị trí.
    storage_location: x.storageLocation ?? "",
    kg_per_ctn: n(x.kgPerCtn),
    unit_price: n(x.unitPrice),
    open_ctn: x.openCtn,
    open_kg: x.openKg,
    in_ctn: x.inCtn,
    in_kg: x.inKg,
    out_ctn: x.outCtn,
    out_kg: x.outKg,
    carried_from_id: x.carriedFromId,
    sort_order: x.sortOrder,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    period: s(r.period),
    category: s(r.category),
    warehouse: s(r.warehouse),
    itemName: s(r.item_name),
    size: s(r.size),
    origin: s(r.origin),
    importDate: s(r.import_date).slice(0, 10),
    storageLocation: s(r.storage_location),
    kgPerCtn: r.kg_per_ctn == null ? null : Number(r.kg_per_ctn),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    openCtn: Number(r.open_ctn ?? 0),
    openKg: Number(r.open_kg ?? 0),
    inCtn: Number(r.in_ctn ?? 0),
    inKg: Number(r.in_kg ?? 0),
    outCtn: Number(r.out_ctn ?? 0),
    outKg: Number(r.out_kg ?? 0),
    carriedFromId: s(r.carried_from_id),
    sortOrder: Number(r.sort_order ?? 0),
    note: s(r.note),
  }),
  // Dòng ghi từ bản app trước khi có sổ tháng: vá field mới để không NaN/undefined.
  vaDongCu: (x) => ({
    ...x,
    size: x.size ?? "",
    origin: x.origin ?? "",
    importDate: x.importDate ?? "",
    storageLocation: x.storageLocation ?? "",
    kgPerCtn: x.kgPerCtn ?? null,
    unitPrice: x.unitPrice ?? null,
    openCtn: x.openCtn ?? 0,
    inCtn: x.inCtn ?? 0,
    outCtn: x.outCtn ?? 0,
    carriedFromId: x.carriedFromId ?? "",
    sortOrder: x.sortOrder ?? 0,
    note: x.note ?? "",
  }),
};

/* ---------- Hàng chờ đồng bộ (chống mất số liệu khi ghi hụt) ----------
   Ghi lên máy chủ có thể hụt giữa ca (wifi rớt, tablet ngủ, server nghẽn).
   Mỗi bảng giữ một "hàng chờ" khóa các dòng chưa đẩy được:
     - them: dòng thêm/sửa chưa lên server
     - xoa : dòng đã xóa dưới máy nhưng chưa xóa được trên server (tombstone)
   Mọi lần ghi, mở app, quay lại tab, có mạng lại đều thử đẩy lại hàng chờ. Lúc
   nạp, HOÀ server với dòng local chưa đẩy thay vì đè mù — nên reload không nuốt
   chuyến hàng ghi hụt.
   Các lượt gửi của MỘT bảng chạy TUẦN TỰ (chuoiGui), và gửi xong chỉ bỏ đúng
   khóa vừa gửi mà dòng chưa đổi tiếp — ghi chồng lúc đang gửi vẫn còn trong hàng
   chờ cho lượt sau. Phần thuần (docCho/mergeServerAndLocal/pushQueue/dropSentKeys) có test
   ở repo.test.ts. */

export interface SyncQueue {
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

/** Đọc hàng chờ từ chuỗi localStorage. Dạng `{them, xoa}` từ trước tới nay; chịu
 *  chuỗi hỏng / thiếu mảng (ra rỗng) để không vỡ lúc mở app. */
export function docCho(raw: string | null): SyncQueue {
  if (!raw) return { them: [], xoa: [] };
  try {
    const p = JSON.parse(raw) as Partial<SyncQueue> | null;
    const ds = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return { them: ds(p?.them), xoa: ds(p?.xoa) };
  } catch {
    return { them: [], xoa: [] };
  }
}

function napCho(localKey: string): SyncQueue {
  try {
    return docCho(localStorage.getItem(`${modeLocalKey(localKey)}.cho`));
  } catch {
    return { them: [], xoa: [] };
  }
}

/** Ghi hàng chờ. `false` = không ghi được (hết dung lượng) — người gọi phải báo. */
function saveQueue(localKey: string, cho: SyncQueue): boolean {
  try {
    const k = `${modeLocalKey(localKey)}.cho`;
    if (cho.them.length === 0 && cho.xoa.length === 0) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(cho));
    return true;
  } catch {
    return false;
  }
}

const STORAGE_FULL_ERROR =
  "Bộ nhớ trình duyệt đầy — không lưu được bản sao/hàng chờ dưới máy. Số đã ghi vẫn hiện, nhưng rớt mạng lúc này có thể mất. Báo quản trị.";

/** Bỏ các trường không chép xuống bản sao (xem TableMapping.truongKhongCache). */
function boTruong<T>(x: T, truong: readonly string[]): T {
  const o = { ...(x as Record<string, unknown>) };
  for (const f of truong) delete o[f];
  return o as T;
}

/**
 * HOÀ dữ liệu server với bản dưới máy — nền là server; dòng có trong hàng chờ
 * `them` lấy bản dưới máy (chưa lên server ⇒ bản dưới máy mới hơn); dòng trong
 * `xoa` bị gỡ (đừng hồi sinh dòng đã xóa). Dòng local thiếu trường không-cache
 * (đã bỏ khỏi bản sao) thì lấy lại trường đó từ server.
 */
export function mergeServerAndLocal<T>(
  may: T[],
  local: T[],
  cho: SyncQueue,
  layKhoa: (x: T) => string,
  uncachedFields: readonly string[] = [],
): T[] {
  const localTheoKhoa = new Map(local.map((x) => [layKhoa(x), x]));
  const serverByKey = new Map(may.map((x) => [layKhoa(x), x]));
  for (const k of cho.them) {
    let r = localTheoKhoa.get(k);
    if (r === undefined) continue;
    const m = serverByKey.get(k) as Record<string, unknown> | undefined;
    for (const f of uncachedFields) {
      const v = (r as Record<string, unknown>)[f];
      if ((v == null || v === "") && m && m[f] != null) r = { ...r, [f]: m[f] };
    }
    serverByKey.set(k, r);
  }
  for (const k of cho.xoa) serverByKey.delete(k);
  return [...serverByKey.values()];
}

export interface PushError {
  message: string;
  code?: string;
}

/** Cổng gửi lên máy chủ — tách ra để test được không cần Supabase. */
export interface UploadPort {
  upsert: (rows: Record<string, unknown>[]) => Promise<PushError | null>;
  xoa: (keys: string[]) => Promise<PushError | null>;
}

export interface QueuePushResult {
  /** khóa đã gửi xong → JSON toRow đã gửi (null = dòng không còn để gửi). */
  daGuiThem: Map<string, string | null>;
  daXoa: string[];
  /** Dòng bị server từ chối vì DỮ LIỆU của chính nó (giữ lại trong hàng chờ). */
  dongLoi: { khoa: string; msg: string }[];
  /** Lỗi chung (mất mạng, bảng/cột chưa có…) — dừng lượt, giữ nguyên phần chưa gửi. */
  loiChung?: string;
}

const msgLoiGui = (e: PushError) => (e.code ? `${e.code} ${e.message}` : e.message);
/** Lỗi do dữ liệu một/vài dòng (SQLSTATE lớp 21 cardinality, 22 data, 23 ràng
 *  buộc: 23505 trùng khóa duy nhất, 23502 NOT NULL…) — gửi lại từng dòng thì các
 *  dòng lành vẫn lên. Lỗi khác (mạng, 42P01, 42703) dòng nào cũng hỏng như nhau. */
const isRowLevelError = (e: PushError) => /^2[123]/.test(e.code ?? "");

/**
 * Gửi hàng chờ của một bảng qua `cong`. Upsert GOM THEO BỘ CỘT: supabase-js gộp
 * nhiều dòng thì lấy HỢP các cột, dòng thiếu cột nhận DEFAULT (defaultToNull:false)
 * — kể cả ở nhánh UPDATE ⇒ đè mất giá trị đang có (vd file_b64 bỏ khỏi bản sao).
 * Lượt gộp bị từ chối vì dữ liệu ⇒ gửi lại TỪNG dòng: dòng lành lên, chỉ dòng
 * hỏng ở lại (trước đây một dòng 23505 làm kẹt vĩnh viễn cả bảng).
 */
export async function pushQueue<T>(
  bang: Pick<TableMapping<T>, "layKhoa" | "toRow">,
  cho: SyncQueue,
  rows: T[],
  gateway: UploadPort,
): Promise<QueuePushResult> {
  const kq: QueuePushResult = { daGuiThem: new Map(), daXoa: [], dongLoi: [] };
  const theoKhoa = new Map(rows.map((x) => [bang.layKhoa(x), x]));
  const nhom = new Map<string, { khoa: string; row: Record<string, unknown>; json: string }[]>();
  for (const k of new Set(cho.them)) {
    const x = theoKhoa.get(k);
    if (x === undefined) {
      kq.daGuiThem.set(k, null);
      continue;
    }
    const row = bang.toRow(x);
    const droppedColumns = Object.keys(row)
      .filter((c) => row[c] !== undefined)
      .sort()
      .join(",");
    const ds = nhom.get(droppedColumns) ?? [];
    ds.push({ khoa: k, row, json: JSON.stringify(row) });
    nhom.set(droppedColumns, ds);
  }

  for (const ds of nhom.values()) {
    const e = await gateway.upsert(ds.map((g) => g.row));
    if (!e) {
      for (const g of ds) kq.daGuiThem.set(g.khoa, g.json);
      continue;
    }
    if (!isRowLevelError(e)) return { ...kq, loiChung: msgLoiGui(e) };
    if (ds.length === 1) {
      kq.dongLoi.push({ khoa: ds[0].khoa, msg: msgLoiGui(e) });
      continue;
    }
    for (const g of ds) {
      const e1 = await gateway.upsert([g.row]);
      if (!e1) kq.daGuiThem.set(g.khoa, g.json);
      else if (isRowLevelError(e1)) kq.dongLoi.push({ khoa: g.khoa, msg: msgLoiGui(e1) });
      else return { ...kq, loiChung: msgLoiGui(e1) };
    }
  }

  const remove = [...new Set(cho.xoa)];
  if (remove.length > 0) {
    const e = await gateway.xoa(remove);
    if (!e) kq.daXoa.push(...remove);
    else if (!isRowLevelError(e)) return { ...kq, loiChung: msgLoiGui(e) };
    else if (remove.length === 1) kq.dongLoi.push({ khoa: remove[0], msg: msgLoiGui(e) });
    else {
      for (const k of remove) {
        const e1 = await gateway.xoa([k]);
        if (!e1) kq.daXoa.push(k);
        else if (isRowLevelError(e1)) kq.dongLoi.push({ khoa: k, msg: msgLoiGui(e1) });
        else return { ...kq, loiChung: msgLoiGui(e1) };
      }
    }
  }
  return kq;
}

/**
 * Hàng chờ SAU khi gửi: đọc lại hàng chờ hiện tại (có thể đã thêm khóa trong lúc
 * gửi) rồi chỉ bỏ khóa đã gửi mà dòng CHƯA đổi tiếp (`hienTai` = JSON toRow của
 * bản mới nhất). Ghi chồng lúc đang gửi ⇒ JSON khác ⇒ khóa ở lại cho lượt sau.
 */
export function dropSentKeys(
  cho: SyncQueue,
  kq: Pick<QueuePushResult, "daGuiThem" | "daXoa">,
  currentJson: Map<string, string>,
): SyncQueue {
  const deleted = new Set(kq.daXoa);
  return {
    them: cho.them.filter(
      (k) => !(kq.daGuiThem.has(k) && kq.daGuiThem.get(k) === (currentJson.get(k) ?? null)),
    ),
    xoa: cho.xoa.filter((k) => !deleted.has(k)),
  };
}

/** Bản đang dùng mới nhất của mỗi bảng trong tab này (mọi lần gọi useBang chung). */
const latestSnapshot = new Map<string, unknown[]>();
/** Đếm lần ghi theo bảng — tải server mà có lần ghi xen giữa thì bản tải về đã cũ. */
const writeCounts = new Map<string, number>();
/** Chuỗi gửi theo bảng — các lượt gửi một bảng chạy tuần tự, không chồng nhau. */
const chuoiGui = new Map<string, Promise<unknown>>();

/** Dòng hiện tại để gửi: bản trong tab, bù dòng tab khác (cùng trình duyệt) đã
 *  đưa vào hàng chờ chung mà tab này chưa có — lấy từ bản sao localStorage. */
function currentRows<T>(bang: TableMapping<T>, rows: T[], toAdd: string[]): T[] {
  const ban = (latestSnapshot.get(bang.localKey) as T[] | undefined) ?? rows;
  const co = new Set(ban.map((x) => bang.layKhoa(x)));
  const thieu = new Set(toAdd.filter((k) => !co.has(k)));
  if (thieu.size === 0) return ban;
  const missingRows = load<T>(bang.localKey)
    .map((x) => (bang.vaDongCu ? bang.vaDongCu(x) : x))
    .filter((x) => thieu.has(bang.layKhoa(x)));
  return [...ban, ...missingRows];
}

/** Ghi bản sao localStorage (bỏ trường không-cache ở dòng đã đồng bộ). */
function saveLocalCopy<T>(bang: TableMapping<T>, rows: T[]): boolean {
  const bo = hasSupabase ? bang.truongKhongCache : undefined;
  if (!bo?.length) return save(bang.localKey, rows);
  const cho = new Set(napCho(bang.localKey).them);
  return save(
    bang.localKey,
    rows.map((x) => (cho.has(bang.layKhoa(x)) ? x : boTruong(x, bo))),
  );
}

async function bocLoi(
  p: PromiseLike<{ error: { message: string; code?: string } | null }>,
): Promise<PushError | null> {
  try {
    const { error } = await p;
    return error ? { message: error.message, code: error.code } : null;
  } catch (e) {
    return { message: layMsg(e) };
  }
}

async function syncOnePass<T>(
  bang: TableMapping<T>,
  khoa: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  const db = supabase;
  if (!db) return { ok: true };
  const cho = napCho(bang.localKey);
  if (cho.them.length === 0 && cho.xoa.length === 0) return { ok: true };

  const gateway: UploadPort = {
    /* defaultToNull: false ⇒ dòng THIẾU một cột (vd mặt hàng tạo nhanh ở /wip
       không có materialTypeId) dùng DEFAULT của cột thay vì NULL. Mặc định của
       supabase-js khi upsert NHIỀU dòng là điền NULL cho cột dòng khác có mà
       dòng này thiếu ⇒ cột NOT NULL (material_type_id…) từ chối CẢ LƯỢT (23502)
       ⇒ hàng chờ kẹt vĩnh viễn: products không lên máy chủ từ 28/08 tới
       02/10/2026 (mọi máy). Đừng bỏ cờ này. */
    upsert: (ds) =>
      bocLoi(
        db
          .from(bang.table)
          .upsert(
            // Khóa chính theo chế độ (demo ⇒ tiền tố `demo:`) + site — rào R1 (lib/demoMode.ts).
            ds.map((r) => rowToServer(r, khoa, SITE_ID, undefined, bang.cotThamChieu)),
            { onConflict: khoa, defaultToNull: false },
          ),
      ),
    // Xóa luôn lọc site (rào R2) + khóa theo chế độ: không lệnh xóa nào chạm được site khác.
    xoa: (keys) =>
      bocLoi(
        db
          .from(bang.table)
          .delete()
          .eq("site_id", SITE_ID)
          .in(khoa, keys.map((k) => toServerKey(k))),
      ),
  };
  const kq = await pushQueue(bang, cho, currentRows(bang, rows, cho.them), gateway);

  // Đọc LẠI hàng chờ + bản mới nhất: khóa ghi thêm/sửa tiếp trong lúc gửi phải còn.
  const freshQueue = napCho(bang.localKey);
  const currentJson = new Map(
    currentRows(bang, rows, freshQueue.them)
      .filter((x) => kq.daGuiThem.has(bang.layKhoa(x)))
      .map((x) => [bang.layKhoa(x), JSON.stringify(bang.toRow(x))]),
  );
  const okCho = saveQueue(bang.localKey, dropSentKeys(freshQueue, kq, currentJson));
  // Dòng vừa lên server thì bỏ trường không-cache khỏi bản sao (nhả dung lượng).
  if (bang.truongKhongCache?.length && kq.daGuiThem.size > 0)
    saveLocalCopy(bang, (latestSnapshot.get(bang.localKey) as T[] | undefined) ?? rows);

  if (kq.loiChung) return { ok: false, msg: kq.loiChung };
  if (kq.dongLoi.length > 0) {
    console.error(`[đồng bộ] ${bang.table}: dòng bị máy chủ từ chối`, kq.dongLoi);
    const label = TABLE_LABELS[bang.table] ?? bang.table;
    const vd = kq.dongLoi
      .slice(0, 3)
      .map((d) => `${d.khoa} (${d.msg})`)
      .join("; ");
    return {
      ok: false,
      msg: `${label}: ${kq.dongLoi.length} dòng chưa lên máy chủ vì lỗi dữ liệu — ${vd}${kq.dongLoi.length > 3 ? "…" : ""}. Các dòng khác đã lên.`,
    };
  }
  if (!okCho) return { ok: false, msg: STORAGE_FULL_ERROR };
  return { ok: true };
}

/** Đẩy hàng chờ của một bảng lên máy chủ — xếp hàng sau lượt đang chạy của bảng đó. */
function syncQueueFor<T>(
  bang: TableMapping<T>,
  khoa: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  const prevPromise = chuoiGui.get(bang.localKey) ?? Promise.resolve();
  const p = prevPromise.then(() => syncOnePass(bang, khoa, rows));
  chuoiGui.set(
    bang.localKey,
    p.catch(() => undefined),
  );
  return p.catch((e) => ({ ok: false, msg: layMsg(e) }));
}

/** jsonb (Supabase trả object; localStorage có thể là chuỗi) → object an toàn. */
const parseObj = (v: unknown): Record<string, unknown> => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

/**
 * Bản đối soát hóa đơn đã lưu (màn /doi-soat). file_b64 = file Excel gốc để mở
 * lại chạy lại; options/summary là jsonb. Riêng tư theo tài khoản ép ở tầng app.
 */
export const BANG_RECONCILIATION_RUN: TableMapping<ReconciliationRun> = {
  table: "reconciliation_runs",
  localKey: "bsf.reconciliation-runs.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    user_id: x.userId,
    owner_username: x.ownerUsername,
    owner_name: x.ownerName,
    title: x.title,
    period: x.period,
    status: x.status,
    threshold: x.threshold,
    file_name: x.fileName,
    // Rỗng = bản sao dưới máy đã bỏ file (truongKhongCache) ⇒ KHÔNG gửi cột, để
    // upsert không đè mất file đang có trên server.
    ...(x.fileB64 ? { file_b64: x.fileB64 } : {}),
    options: x.options ?? {},
    summary: x.summary ?? {},
    created_at: x.createdAt || undefined,
    updated_at: x.updatedAt || undefined,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    userId: s(r.user_id),
    ownerUsername: s(r.owner_username),
    ownerName: s(r.owner_name),
    title: s(r.title),
    period: s(r.period),
    status: s(r.status) === "official" ? "official" : "draft",
    threshold: r.threshold == null ? 1 : Number(r.threshold),
    fileName: s(r.file_name),
    fileB64: s(r.file_b64),
    options: parseObj(r.options) as unknown as ReconciliationRun["options"],
    summary: parseObj(r.summary) as unknown as ReconciliationRun["summary"],
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  }),
  vaDongCu: (x) => ({ ...x, fileB64: x.fileB64 ?? "" }),
  truongKhongCache: ["fileB64"],
};

/**
 * Sự kiện biến đổi lô (mig 0046) — "đầu ra đã dùng đầu vào này". Nối chuỗi truy
 * xuất NL → BTP → TP. KHÔNG thêm cột vào production_wips/packagings (xem 0046).
 */
export const BANG_LOT_INPUT: TableMapping<LotInput> = {
  table: "lot_inputs",
  localKey: "bsf.lot-inputs.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    output_kind: x.outputKind,
    output_id: x.outputId,
    input_kind: x.inputKind,
    input_id: x.inputId,
    input_label: x.inputLabel,
    material: x.material,
    quantity_kg: x.quantityKg,
    method: x.method,
    operator: x.operator,
    recorded_at: x.recordedAt || undefined,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    outputKind: s(r.output_kind) === "P" ? "P" : "W",
    outputId: s(r.output_id),
    inputKind: s(r.input_kind) === "W" ? "W" : "S",
    inputId: s(r.input_id),
    inputLabel: s(r.input_label),
    material: s(r.material),
    quantityKg: r.quantity_kg == null || r.quantity_kg === "" ? null : Number(r.quantity_kg),
    method: s(r.method) === "quet" ? "quet" : s(r.method) === "go" ? "go" : "chon",
    operator: s(r.operator),
    recordedAt: s(r.recorded_at),
  }),
};

/**
 * Sổ in tem QR (mig 0049) — mỗi lần bấm In ghi một dòng cho mỗi lô. Chỉ THÊM
 * bảng; nhãn lô vẫn suy từ bản ghi, `label` ở đây là nhãn đã in (đông cứng).
 */
export const BANG_LABEL_PRINT: TableMapping<LabelPrint> = {
  table: "label_prints",
  localKey: "bsf.label-prints.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    lot_kind: x.lotKind,
    lot_id: x.lotId,
    label: x.label,
    copies: x.copies,
    operator: x.operator,
    printed_at: x.printedAt || undefined,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    lotKind: s(r.lot_kind) === "W" ? "W" : s(r.lot_kind) === "P" ? "P" : "S",
    lotId: s(r.lot_id),
    label: s(r.label),
    copies: Number(r.copies) || 1,
    operator: s(r.operator),
    printedAt: s(r.printed_at),
  }),
};

/**
 * Lô đi ra (mig 0056) — dòng bán lẻ / bán nội địa / quét kiểm lệnh xuất lấy từ
 * lô nào. Bảng RIÊNG, không thêm cột vào sales_items/domestic_sales/export_items.
 */
export const BANG_LOT_DISPATCH: TableMapping<LotDispatch> = {
  table: "lot_dispatches",
  localKey: "bsf.lot-dispatches.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    lot_kind: x.lotKind,
    lot_id: x.lotId,
    lot_label: x.lotLabel,
    doc_kind: x.docKind,
    doc_id: x.docId,
    quantity_kg: x.quantityKg,
    method: x.method,
    operator: x.operator,
    recorded_at: x.recordedAt || undefined,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    lotKind: s(r.lot_kind) === "W" ? "W" : s(r.lot_kind) === "P" ? "P" : "S",
    lotId: s(r.lot_id),
    lotLabel: s(r.lot_label),
    docKind: s(r.doc_kind) === "export_item" ? "export_item" : s(r.doc_kind) === "domestic_sale" ? "domestic_sale" : "sales_item",
    docId: s(r.doc_id),
    quantityKg: r.quantity_kg == null || r.quantity_kg === "" ? null : Number(r.quantity_kg),
    method: s(r.method) === "quet" ? "quet" : s(r.method) === "go" ? "go" : s(r.method) === "fifo" ? "fifo" : "chon",
    operator: s(r.operator),
    recordedAt: s(r.recorded_at),
  }),
};

/** Lý do chưa gắn lô khi chốt ngày (mig 0056). */
export const BANG_LOT_WAIVER: TableMapping<LotWaiver> = {
  table: "lot_waivers",
  localKey: "bsf.lot-waivers.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    output_kind: x.outputKind,
    output_id: x.outputId,
    reason: x.reason,
    operator: x.operator,
    recorded_at: x.recordedAt || undefined,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    outputKind: s(r.output_kind) === "P" ? "P" : "W",
    outputId: s(r.output_id),
    reason: s(r.reason),
    operator: s(r.operator),
    recordedAt: s(r.recorded_at),
  }),
};

/* ---------- Nhật ký thao tác (audit) ---------- */

/** Nhãn tiếng Việt của bảng — cho câu tóm tắt nhật ký dễ đọc. */
const TABLE_LABELS: Record<string, string> = {
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
  nxt_snapshots: "Xuất–Nhập–Tồn kho (báo cáo)",
  storage_locations: "Kho lưu trữ (danh mục)",
  monthly_stock_ledger: "Sổ kho theo tháng",
  reconciliation_runs: "Bản đối soát hóa đơn",
  lot_inputs: "Gắn lô đầu vào (truy xuất)",
  label_prints: "In tem QR",
  lot_dispatches: "Gắn lô cho hàng ra (truy xuất)",
  lot_waivers: "Lý do chưa gắn lô",
  row_marks: "Tô màu dòng",
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

/** Chuỗi dài hơn ngưỡng này không vào nhật ký (file base64 của bản đối soát
 *  ~2,7MB/dòng làm phình audit_log + buffer localStorage). */
const MAX_AUDIT_STRING = 10_000;
const TRUONG_FILE = new Set(["fileB64"]);

/** Thu gọn giá trị trước khi vào nhật ký: thay file / chuỗi quá dài bằng nhãn
 *  "[… ký tự — không ghi nhật ký]" (vẫn thấy là CÓ đổi, không chép nội dung). */
export function compactForAudit(v: unknown, truong = ""): unknown {
  if (typeof v === "string") {
    if (v && TRUONG_FILE.has(truong)) return `[file ${v.length} ký tự — không ghi nhật ký]`;
    return v.length > MAX_AUDIT_STRING ? `[chuỗi ${v.length} ký tự — không ghi nhật ký]` : v;
  }
  if (Array.isArray(v)) return v.map((x) => compactForAudit(x));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, compactForAudit(x, k)]),
    );
  return v;
}

/** Tạm tắt nhật ký thao tác — CHỈ khi nạp hàng loạt bộ demo (hàng nghìn dòng, không
 *  phải thao tác của người dùng). Bật lại ngay sau khi nạp xong. */
let isAuditPaused = false;
export function setAuditPaused(paused: boolean): void {
  isAuditPaused = paused;
}

/** So danh sách cũ↔mới của một bảng, phát entry nhật ký thêm/sửa/xóa. */
function logChanges<T>(bang: TableMapping<T>, prev: T[], next: T[]): void {
  if (isAuditPaused) return;
  if (bang.table === "audit_log") return; // không tự lưu vết chính mình
  // Tô màu dòng chỉ là dấu trình bày (đã có marked_by/marked_at) — kế toán dò cả
  // trăm dòng một buổi, ghi nhật ký từng cú tô chỉ làm ngập /audit.
  if (bang.table === "row_marks") return;
  const label = TABLE_LABELS[bang.table] ?? bang.table;
  const prevByKey = new Map(prev.map((x) => [bang.layKhoa(x), x]));
  const nextMap = new Map(next.map((x) => [bang.layKhoa(x), x]));
  const entries: NewAuditEntry[] = [];
  for (const [k, x] of nextMap) {
    const c = prevByKey.get(k);
    if (c === undefined) {
      entries.push({ action: "them", entity: bang.table, entityKey: k, summary: `Thêm ${label}`, diff: { _new: compactForAudit(x) } });
    } else if (JSON.stringify(c) !== JSON.stringify(x)) {
      const diff = Object.fromEntries(
        Object.entries(khacBiet(c, x)).map(([f, [a, b]]) => [f, [compactForAudit(a, f), compactForAudit(b, f)]]),
      );
      entries.push({ action: "sua", entity: bang.table, entityKey: k, summary: `Sửa ${label}`, diff });
    }
  }
  for (const [k] of prevByKey) {
    if (!nextMap.has(k)) entries.push({ action: "xoa", entity: bang.table, entityKey: k, summary: `Xóa ${label}` });
  }
  appendAuditEntries(entries);
}

/* ---------- Hook ---------- */

export type LoadStatus = "dang-tai" | "san-sang" | "loi";

/**
 * Đồng bộ CÙNG TAB giữa các lần gọi `useBang` của cùng một bảng. Mỗi lần gọi giữ
 * `rows` riêng: hộp con (VD gắn lô) ghi xong mà màn cha vẫn cầm bản cũ thì lần
 * ghi kế tiếp của màn cha sẽ coi dòng con vừa thêm là "đã xóa" và xóa luôn trên
 * máy chủ. Ghi xong phát sự kiện này để các bản khác nhận đúng `rows` mới — chỉ
 * cập nhật trạng thái, KHÔNG ghi lại, không đụng hàng chờ.
 */
const SU_KIEN_BANG = "bsf:bang-doi";
type SuKienBang = { localKey: string; tu: string; rows: unknown[] };

export function useBang<T>(bang: TableMapping<T>, seed: () => T[] = () => []) {
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
  const [status, setStatus] = useState<LoadStatus>(
    hasSupabase ? "dang-tai" : "san-sang"
  );
  const [loi, setLoi] = useState<string | null>(null);
  const prevRows = useRef<T[]>(rows);
  prevRows.current = rows;
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  /** Báo kết quả một lượt server lên hook + đèn kết nối ("lần gần nhất thắng"). */
  const reportResult = useCallback((kq: { ok: boolean; msg?: string }, fallback: string) => {
    if (kq.ok) {
      setLoi(null);
      setStatus("san-sang");
      connectivity.baoOK();
    } else {
      const msg = kq.msg ?? fallback;
      setStatus("loi");
      setLoi(msg);
      connectivity.baoLoi(msg);
    }
  }, []);

  /* Nhận bản mới từ lần gọi khác của cùng bảng (xem SU_KIEN_BANG). */
  useEffect(() => {
    const label = (e: Event) => {
      const d = (e as CustomEvent<SuKienBang>).detail;
      if (!d || d.localKey !== bang.localKey || d.tu === instanceId) return;
      prevRows.current = d.rows as T[];
      setRows(d.rows as T[]);
    };
    window.addEventListener(SU_KIEN_BANG, label);
    return () => window.removeEventListener(SU_KIEN_BANG, label);
  }, [bang.localKey, instanceId]);

  /* Nạp từ máy chủ — lúc mở, và NẠP LẠI khi quay lại tab (máy khác có thể vừa
     sửa); có mạng lại thì đẩy hàng chờ. Cùng một đường hoà server + hàng chờ. */
  useEffect(() => {
    const db = supabase;
    if (!db) return;
    let huy = false;
    let isLoading = false;
    let lastLoadAt = 0;

    const nap = async (laLanDau: boolean) => {
      if (isLoading) return;
      isLoading = true;
      try {
        // Có lần ghi xen giữa lúc đang tải ⇒ bản tải về đã cũ (có thể thiếu dòng
        // vừa lên server rồi ra khỏi hàng chờ) ⇒ tải lại, tối đa 3 lần.
        for (let lan = 0; lan < 3; lan++) {
          const gen0 = writeCounts.get(bang.localKey) ?? 0;
          // Nạp THEO TRANG: PostgREST mặc định trả tối đa 1000 dòng/‌lần. Bảng lớn
          // (VD sổ kho theo tháng >1000 dòng) sẽ bị cắt cụt nếu chỉ select một phát.
          // Lặp .range() tới khi trang trả về ít hơn cỡ trang → lấy đủ mọi dòng.
          const PAGE_SIZE = 1000;
          const thoRaw: Record<string, unknown>[] = [];
          for (let tu = 0; ; tu += PAGE_SIZE) {
            const { data, error } = await db
              .from(bang.table)
              .select("*")
              .eq("site_id", SITE_ID)
              .order(khoa)
              .range(tu, tu + PAGE_SIZE - 1);
            if (huy) return;
            if (error) {
              reportResult({ ok: false, msg: error.message }, error.message);
              return;
            }
            const page = data ?? [];
            for (const r of page) thoRaw.push(r as Record<string, unknown>);
            if (page.length < PAGE_SIZE) break;
          }
          // Bỏ tiền tố khóa demo; dòng không thuộc chế độ này (null) bỏ qua.
          const may = thoRaw
            .map((r) => rowFromServer(r, khoa, undefined, bang.cotThamChieu))
            .filter((r): r is Record<string, unknown> => r != null)
            .map((r) => bang.fromRow(r));

          // Bảng rỗng lần đầu + máy này cũng chưa có gì → đẩy seed lên danh mục.
          if (laLanDau && may.length === 0) {
            const cho0 = napCho(bang.localKey);
            const prevLocal = napLocal(bang.localKey);
            const isEmpty =
              prevLocal.length === 0 && cho0.them.length === 0 && cho0.xoa.length === 0;
            if (isEmpty) {
              const s0 = seed();
              if (s0.length > 0) {
                const { error: e2 } = await db
                  .from(bang.table)
                  .upsert(
                    s0.map((x) => rowToServer(bang.toRow(x), khoa, SITE_ID, undefined, bang.cotThamChieu)),
                    { onConflict: khoa }
                  );
                if (huy) return;
                if (e2) {
                  reportResult({ ok: false, msg: e2.message }, e2.message);
                  return;
                }
                prevRows.current = s0;
                setRows(s0);
                latestSnapshot.set(bang.localKey, s0);
                save(bang.localKey, s0);
                lastLoadAt = Date.now();
                reportResult({ ok: true }, "");
                return;
              }
            }
          }

          if (lan < 2 && (writeCounts.get(bang.localKey) ?? 0) !== gen0) continue;

          /* HOÀ server với dòng local CHƯA đồng bộ — KHÔNG đè mù, nếu không reload
             sẽ nuốt chuyến hàng ghi hụt (dòng chỉ có dưới máy, chưa lên server).
             Bản dưới máy = bản trong tab (mới nhất) nếu có, không thì bản sao. */
          const local =
            (latestSnapshot.get(bang.localKey) as T[] | undefined) ?? napLocal(bang.localKey);
          const ketQua = mergeServerAndLocal(
            may,
            local,
            napCho(bang.localKey),
            bang.layKhoa,
            bang.truongKhongCache,
          );
          prevRows.current = ketQua;
          setRows(ketQua);
          latestSnapshot.set(bang.localKey, ketQua);
          const okMay = saveLocalCopy(bang, ketQua);
          lastLoadAt = Date.now();

          // Thử đẩy hàng chờ lên server ngay khi vừa nối được.
          const kq = await syncQueueFor(bang, khoa, ketQua);
          if (huy) return;
          reportResult(kq.ok && !okMay ? { ok: false, msg: STORAGE_FULL_ERROR } : kq, "Lỗi đồng bộ máy chủ");
          return;
        }
      } finally {
        isLoading = false;
      }
    };

    void nap(true);

    // Quay lại tab sau ≥30 giây ⇒ nạp lại (máy khác có thể đã sửa/xóa dòng).
    const onTabVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadAt > 30_000)
        void nap(false);
    };
    // Vừa có mạng lại ⇒ đẩy hàng chờ (trước đây phải đợi lần ghi/mở app kế tiếp).
    const khiCoMang = () => {
      void syncQueueFor(bang, khoa, prevRows.current).then((kq) => {
        if (!huy) reportResult(kq, "Lỗi đồng bộ máy chủ");
      });
    };
    document.addEventListener("visibilitychange", onTabVisible);
    window.addEventListener("online", khiCoMang);
    return () => {
      huy = true;
      document.removeEventListener("visibilitychange", onTabVisible);
      window.removeEventListener("online", khiCoMang);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bang.table]);

  const write = useCallback(
    (next: T[]) => {
      const prev = prevRows.current;
      prevRows.current = next; // hai lần ghi liền trong cùng thao tác vẫn so đúng bản trước
      setRows(next);
      latestSnapshot.set(bang.localKey, next);
      writeCounts.set(bang.localKey, (writeCounts.get(bang.localKey) ?? 0) + 1);
      window.dispatchEvent(
        new CustomEvent<SuKienBang>(SU_KIEN_BANG, { detail: { localKey: bang.localKey, tu: instanceId, rows: next } })
      );

      // Nhật ký thao tác — chạy cả hai chế độ (server + localStorage).
      logChanges(bang, prev, next);

      let okCho = true;
      if (supabase) {
        const prevByKey = new Map(prev.map((x) => [bang.layKhoa(x), x]));
        const newKeys = new Set(next.map((x) => bang.layKhoa(x)));

        const upsertKeys = next
          .filter((x) => {
            const c = prevByKey.get(bang.layKhoa(x));
            return !c || JSON.stringify(c) !== JSON.stringify(x);
          })
          .map((x) => bang.layKhoa(x));
        const deleteKeys = prev
          .filter((x) => !newKeys.has(bang.layKhoa(x)))
          .map((x) => bang.layKhoa(x));

        /* Ghi vào hàng chờ TRƯỚC khi gọi server: hụt thì vẫn còn dấu để đẩy lại
           lần sau. Gộp với hàng chờ cũ nên các dòng hụt trước cũng được đẩy kèm.
           (Ghi hàng chờ trước bản sao: bản sao giữ đủ trường cho dòng đang chờ.) */
        const cho = napCho(bang.localKey);
        const toAdd = new Set([...cho.them, ...upsertKeys]);
        const remove = new Set([...cho.xoa, ...deleteKeys]);
        deleteKeys.forEach((k) => toAdd.delete(k)); // vừa xóa thì thôi thêm
        upsertKeys.forEach((k) => remove.delete(k)); // thêm/sửa lại thì thôi xóa
        okCho = saveQueue(bang.localKey, { them: [...toAdd], xoa: [...remove] });
      }
      const okMay = saveLocalCopy(bang, next) && okCho; // luôn có bản sao dưới máy

      if (!supabase) {
        // Chỉ-máy-này: bản sao là kho DUY NHẤT — ghi hụt là mất khi tải lại.
        if (!okMay) reportResult({ ok: false, msg: STORAGE_FULL_ERROR }, STORAGE_FULL_ERROR);
        return;
      }

      void syncQueueFor(bang, khoa, next).then((kq) =>
        reportResult(kq.ok && !okMay ? { ok: false, msg: STORAGE_FULL_ERROR } : kq, "Lỗi ghi máy chủ"),
      );
    },
    [bang, khoa, instanceId, reportResult]
  );

  return [rows, write, { trangThai: status, loi }] as const;
}
