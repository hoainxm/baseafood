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
  Packaging,
  SalesOrder,
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
  TaskAssignment,
  CompanyDocument,
  DocumentVersion,
  ExportActivity,
  ImportContract,
  ImportContractLine,
  ImportDocument,
  ImportDocumentKind,
  ImportFile,
  ImportSampleCheck,
  ProductionOrder,
  ProductionOrderLine,
  ProductionOrderMaterial,
  ProductionOrderRequirements,
  ProductionOrderShipment,
  SupplierInvoice,
  SupplierInvoiceLine,
  AccountingCodeMap,
  ImportReceipt,
  ImportReceiptLine,
  ImportSupplier,
  ImportTransport,
  ImportType,
  ExportApprovalStage,
  ExportContract,
  ExportContractApproval,
  ExportContractAttachmentKind,
  ExportContractLine,
  ExportContractRevision,
  ExportContractTerms,
  ExportDeadlineExtension,
  ExportFile,
  ExportPayment,
  CustomerProductName,
  ExportDocumentKindRow,
  GoodsType,
  ExportShipment,
  ExportStepItem,
  BatterType,
  DomesticSaleItem,
  RowMark,
  AppRole,
  RolePermission,
  UserPermission,
} from "@/types";
import { rolesFromCsv, rolesToCsv } from "@/types";
import { getProductBatterIds, sanitizeBatterKg } from "@/lib/batter";
import { appendAuditEntries, type NewAuditEntry } from "@/lib/audit";
import {
  LEGACY_FIELDS,
  normalizeExportOrderStatus,
  normalizeLotMethod,
  normalizeQcResult,
  normalizeReconciliationMode,
  normalizeSalesOrderStatus,
  normalizeStorageKind,
  normalizeWipStatus,
  renameLegacyFields,
} from "@/lib/legacyValues";

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
  primaryKey?: string;
  /** Khóa localStorage (phiên bản v2 dùng Tiếng Anh) */
  localKey: string;
  /** Lấy khóa của một bản ghi ở phía app */
  getKey: (x: T) => string;
  toRow: (x: T) => Record<string, unknown>;
  fromRow: (r: Record<string, unknown>) => T;
  /**
   * Vá dòng cũ còn thiếu trường mới thêm về sau. Bản sao dưới localStorage được
   * đọc thẳng bằng JSON.parse (không qua `fromRow`), nên dữ liệu ghi từ bản
   * trước sẽ thiếu trường — vá ở một chỗ này thay vì rải `?? ""` khắp màn hình.
   */
  patchLegacy?: (x: T) => T;
  /**
   * Trường KHÔNG chép xuống bản sao localStorage khi chạy Supabase (vd file Excel
   * base64 ~MB của bản đối soát: chép xuống là đầy quota ~5MB ⇒ mọi bảng khác mất
   * bản sao + hàng chờ). Dòng còn nằm hàng chờ `them` vẫn GIỮ đủ (chưa lên server
   * thì bản dưới máy là bản duy nhất); lúc hoà với server, dòng local thiếu trường
   * này lấy lại từ server. Chế độ chỉ-máy-này: không bỏ gì (local là kho duy nhất).
   */
  uncachedFields?: (keyof T & string)[];
  /**
   * Cột (tên DB) là KHÓA NGOẠI trỏ tới khóa chính bảng khác — chế độ demo phải thêm
   * tiền tố `demo:` cho cả cột này như khóa chính (lib/demoMode.ts), không thì máy chủ
   * từ chối (23503). DB thật: `period_id → balancing_periods.id` ở balancing_inputs,
   * balancing_outputs, scraps. Khóa ngoại MỀM (cột lưu id bản ghi bảng khác, không có
   * `references` trong SQL — `customer_id`, `product_id`, `lot_id`…) cũng phải khai, không
   * thì máy chủ giữ id thiếu tiền tố ⇒ mồ côi (lọt 2026-10-21). Cột mảng id (`text[]`) được.
   * KHÔNG khai: id người dùng (auth), mã hằng (kho hệ thống), `row_marks.row_id` (đa hình).
   * Test `demoForeignKeys.test.ts` canh: cột `*_id` mới chưa khai ⇒ đỏ.
   */
  refColumns?: string[];
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
  const result: DailyQuantities = {};
  for (const [date, num] of Object.entries(raw as Record<string, unknown>)) {
    const x = Number(num);
    if (Number.isFinite(x)) result[date] = x;
  }
  return result;
}

/** Cột `type_notes` (jsonb, mig 0074) → `{ "<tên loại>": "ghi chú" }`; null / hỏng ⇒ undefined. */
function parseTypeNotes(v: unknown): Record<string, string> | undefined {
  let raw: unknown = v;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const result: Record<string, string> = {};
  for (const [typeName, text] of Object.entries(raw as Record<string, unknown>)) if (text != null) result[typeName] = String(text);
  return result;
}

/* ---------- Ánh xạ camelCase (app) ↔ snake_case (Postgres) ---------- */

export const SUPPLIER_TABLE: TableMapping<Supplier> = {
  table: "suppliers",
  localKey: "bsf.suppliers.v2",
  getKey: theoId,
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
    // 0061 — PHẢI chạy migration trước khi bản app gửi 4 cột này lên (cột lạ ⇒ kẹt hàng chờ).
    email: x.email ?? "",
    bank_account: x.bankAccount ?? "",
    bank_name: x.bankName ?? "",
    bank_branch: x.bankBranch ?? "",
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
    email: r.email == null ? "" : s(r.email),
    bankAccount: r.bank_account == null ? "" : s(r.bank_account),
    bankName: r.bank_name == null ? "" : s(r.bank_name),
    bankBranch: r.bank_branch == null ? "" : s(r.bank_branch),
    note: s(r.note),
  }),
  // Bản sao dưới máy ghi trước 0061 chưa có 4 trường liên hệ / ngân hàng.
  patchLegacy: (x) => ({
    ...x,
    email: x.email ?? "",
    bankAccount: x.bankAccount ?? "",
    bankName: x.bankName ?? "",
    bankBranch: x.bankBranch ?? "",
  }),
};

export const MATERIAL_TYPE_TABLE: TableMapping<MaterialType> = {
  table: "material_types",
  localKey: "bsf.material-types.v2",
  getKey: theoId,
  toRow: (x) => ({ id: x.id, name: x.name, category: x.category, note: x.note }),
  fromRow: (r) => ({
    id: s(r.id),
    name: s(r.name),
    category: s(r.category),
    note: s(r.note),
  }),
};

/** Danh mục 141 mã kế toán — khóa chính là CODE, không phải id sinh tự động. */
export const FINISHED_GOOD_TABLE: TableMapping<FinishedGood> = {
  table: "finished_goods",
  primaryKey: "code",
  localKey: "bsf.finished-goods.v2",
  getKey: (x) => x.code,
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

export const PRODUCT_TABLE: TableMapping<Product> = {
  table: "products",
  localKey: "bsf.products.v2",
  // Khóa ngoại MỀM → material_types.id + mảng id bột tẩm (batters) — chế độ demo thêm tiền tố.
  refColumns: ["material_type_id", "batter_ids"],
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    // Mig 0076: chỉ gửi khi đã đọc được cột / vừa gõ — DB chưa chạy 0076 vẫn lưu được.
    ...(x.tradeName !== undefined ? { trade_name: x.tradeName ?? "" } : {}),
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
    ...("trade_name" in r ? { tradeName: r.trade_name == null ? "" : s(r.trade_name) } : {}),
  }),
  // Dòng ghi trước 0031/0051 chưa có cờ tách / quy cách block / bột đi kèm → mặc định trống.
  patchLegacy: (x) => ({
    ...x,
    splitComponents: x.splitComponents ?? false,
    blockSpecKg: x.blockSpecKg ?? null,
    batterIds: x.batterIds ?? [],
  }),
};

/** Cột thông tin xuất khẩu của khách (mig 0075) — app ⇄ DB. */
const CUSTOMER_EXPORT_COLUMNS = [
  ["country", "country"],
  ["address", "address"],
  ["defaultPort", "default_port"],
  ["paymentTerms", "payment_terms"],
  ["contactName", "contact_name"],
  ["contactEmail", "contact_email"],
] as const;

/**
 * Khách hàng. Cột xuất khẩu (0075) chỉ GỬI khi đã có giá trị (đọc được cột từ máy chủ hoặc
 * người dùng vừa gõ) — máy chủ chưa chạy 0075 thì khách cũ vẫn ghi được, không kẹt hàng chờ.
 */
export const CUSTOMER_TABLE: TableMapping<Customer> = {
  table: "customers",
  localKey: "bsf.customers.v2",
  getKey: theoId,
  toRow: (x) => {
    const row: Record<string, unknown> = { id: x.id, code: x.code, name: x.name, market: x.market };
    for (const [k, col] of CUSTOMER_EXPORT_COLUMNS) if (x[k] !== undefined) row[col] = x[k] ?? "";
    return row;
  },
  fromRow: (r) => {
    const c: Customer = {
      id: s(r.id),
      code: s(r.code),
      name: s(r.name),
      market: s(r.market),
    };
    for (const [k, col] of CUSTOMER_EXPORT_COLUMNS) if (col in r) c[k] = s(r[col]);
    return c;
  },
};

/** Chuyến hàng — một đại lý, một lượt giao, nhiều dòng loại hàng. */
export const IMPORT_SHIPMENT_TABLE: TableMapping<ImportShipment> = {
  table: "import_shipments",
  localKey: "bsf.import-shipments.v2",
  getKey: theoId,
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
  patchLegacy: (x) => ({
    ...x,
    lotCode: x.lotCode ?? "",
    ssccCode: x.ssccCode ?? "",
    scanPath: x.scanPath ?? "",
    operator: x.operator ?? "",
  }),
};

/** Chốt số liệu một ngày của một phân xưởng. */
export const DAILY_LOCK_TABLE: TableMapping<DailyLock> = {
  table: "daily_locks",
  localKey: "bsf.daily-locks.v2",
  getKey: theoId,
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

export const MATERIAL_IMPORT_TABLE: TableMapping<MaterialImportItem> = {
  table: "material_imports",
  localKey: "bsf.material-imports.v2",
  // Khóa ngoại MỀM → import_shipments.id · balancing_periods.id — chế độ demo thêm tiền tố.
  refColumns: ["shipment_id", "balancing_period_id"],
  getKey: theoId,
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
  patchLegacy: (x) => ({
    ...x,
    shipmentId: x.shipmentId ?? "",
    balancingPeriodId: x.balancingPeriodId ?? "",
  }),
};

export const BALANCING_PERIOD_TABLE: TableMapping<BalancingPeriod> = {
  table: "balancing_periods",
  localKey: "bsf.balancing-periods.v2",
  getKey: theoId,
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
  patchLegacy: (x) => ({
    ...x,
    isLocked: x.isLocked ?? false,
    lockedAt: x.lockedAt ?? "",
    lockNote: x.lockNote ?? "",
    reopenReason: x.reopenReason ?? "",
  }),
};

export const BALANCING_INPUT_TABLE: TableMapping<BalancingInputItem> = {
  table: "balancing_inputs",
  localKey: "bsf.balancing-inputs.v2",
  getKey: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  // Khóa MỀM: carry_over_period_id → balancing_periods.id · stock_line_id → monthly_stock_ledger.id.
  // reduction_warehouse_id là mã kho hệ thống (WORKSHOP_WAREHOUSES), không phải id bản ghi ⇒ không khai.
  refColumns: ["period_id", "carry_over_period_id", "stock_line_id"],
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
    // Nhóm Sổ kho tháng của lô gửi đông (mig 0068) — chỉ gửi khi đã chọn, DB chưa có cột không vỡ.
    ...(x.stockCategory ? { stock_category: x.stockCategory } : {}),
    // Cột 0067 (ghi chú dòng): cùng khuôn — chỉ gửi khi dòng đã từng có ghi chú.
    ...(x.note != null ? { note: x.note } : {}),
    // Giá gửi đông theo ngày (mig 0071): chỉ dòng Gửi đông đã gõ giá theo ngày mới có.
    ...(x.dailyPrices != null ? { daily_prices: x.dailyPrices } : {}),
    // Ghi chú riêng từng loại (mig 0074): chỉ dòng đã gõ ghi chú loại mới có.
    ...(x.typeNotes != null ? { type_notes: x.typeNotes } : {}),
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
    stockCategory: r.stock_category == null || r.stock_category === "" ? undefined : s(r.stock_category),
    note: r.note == null ? undefined : s(r.note),
    dailyPrices: r.daily_prices == null ? undefined : parseDailyQuantities(r.daily_prices),
    typeNotes: parseTypeNotes(r.type_notes),
  }),
  // Dòng ghi trước 0019 chưa có cột lưới ngày → mặc định rỗng, không vỡ tổng.
  patchLegacy: (x) => ({
    ...x,
    dailyQuantities: x.dailyQuantities ?? {},
    carryOverKg: x.carryOverKg ?? 0,
    carryOverPeriodId: x.carryOverPeriodId ?? "",
    isReduction: x.isReduction ?? false,
    reductionWarehouseId: x.reductionWarehouseId ?? "",
    autoSource: x.autoSource ?? "",
  }),
};

export const SCRAP_TABLE: TableMapping<ScrapItem> = {
  table: "scraps",
  localKey: "bsf.scraps.v2",
  getKey: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  refColumns: ["period_id"],
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
  patchLegacy: (x) =>
    x.source == null
      ? { ...x, date: x.date ?? "", workshop: x.workshop ?? "", source: "Cân đối" }
      : x,
};

export const BALANCING_OUTPUT_TABLE: TableMapping<BalancingOutputItem> = {
  table: "balancing_outputs",
  localKey: "bsf.balancing-outputs.v2",
  getKey: theoId,
  // Khóa ngoại → balancing_periods.id (ON DELETE CASCADE) — chế độ demo thêm tiền tố.
  // Khóa MỀM: product_id → products.id · customer_id → customers.id · sales_item_id →
  // sales_items.id · carry_over_period_id → balancing_periods.id (thiếu customer_id: 2026-10-21).
  refColumns: ["period_id", "product_id", "customer_id", "sales_item_id", "carry_over_period_id"],
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
    // Cột 0067 (ghi chú dòng): chỉ gửi khi dòng đã từng có ghi chú (DB chưa chạy 0067 vẫn ghi được dòng cũ).
    ...(x.note != null ? { note: x.note } : {}),
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
    note: r.note == null ? undefined : s(r.note),
  }),
  // Dòng ghi trước 0005 không có quy cách / nguồn bán → coi là dòng nhập tay.
  // Dòng ghi trước 0019 chưa có lưới ngày / chuyển kỳ → mặc định rỗng.
  patchLegacy: (x) => ({
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
export const USER_PROFILE_TABLE: TableMapping<UserProfile> = {
  table: "user_profiles",
  localKey: "bsf.user-profiles.v2",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    full_name: x.fullName,
    // display_name (mig 0086): chỉ gửi khi hồ sơ có trường (máy chủ chưa có cột ⇒ không kẹt hàng chờ).
    ...(x.displayName !== undefined ? { display_name: x.displayName } : {}),
    username: x.username,
    roles: rolesToCsv(x.roles), // mảng → CSV (cột text)
  }),
  fromRow: (r) => ({
    id: s(r.id),
    fullName: s(r.full_name),
    ...("display_name" in r ? { displayName: s(r.display_name) } : {}),
    username: s(r.username),
    roles: rolesFromCsv(s(r.roles)), // CSV → mảng
  }),
};

/** Phiếu bán — một khách, một lượt, nhiều dòng mặt hàng. */
export const SALES_INVOICE_TABLE: TableMapping<SalesInvoice> = {
  table: "sales_invoices",
  localKey: "bsf.sales-invoices.v2",
  // Khóa ngoại MỀM → customers.id — chế độ demo thêm tiền tố.
  refColumns: ["customer_id"],
  getKey: theoId,
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
export const SALES_ITEM_TABLE: TableMapping<SalesItem> = {
  table: "sales_items",
  localKey: "bsf.sales-items.v2",
  // Khóa ngoại MỀM → sales_invoices.id · products.id — chế độ demo thêm tiền tố.
  refColumns: ["invoice_id", "product_id"],
  getKey: theoId,
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
export const WIP_PRODUCTION_TABLE: TableMapping<WipProductionItem> = {
  table: "production_wips",
  localKey: "bsf.production-wips.v2",
  // Khóa ngoại MỀM → products.id · balancing_periods.id — chế độ demo thêm tiền tố.
  refColumns: ["product_id", "balancing_period_id"],
  getKey: theoId,
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
    component_rau_kg: x.tentacleKg ?? null, // naming-ok: cột DB giữ nguyên (5d)
    component_bao_tu_kg: x.stomachKg ?? null, // naming-ok: cột DB giữ nguyên (5d)
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
    status: normalizeWipStatus(r.status),
    note: s(r.note),
    customerName: s(r.customer_name),
    processingType: r.processing_type == null ? "" : s(r.processing_type),
    tentacleKg: r.component_rau_kg == null ? null : Number(r.component_rau_kg),
    stomachKg:
      r.component_bao_tu_kg == null ? null : Number(r.component_bao_tu_kg),
    balancingPeriodId: s(r.balancing_period_id),
    operator: s(r.operator),
    batterKg: sanitizeBatterKg(r.batter_kg),
  }),
  // Dòng ghi trước 0019/0030/0033/0037/0051 chưa có cột kỳ / khách / chế biến / thành phần / người thao tác / bột → mặc định trống.
  // Bộ đệm / hàng chờ trước 2026-10-14 còn tên trường `componentRauKg/componentBaoTuKg` (lib/legacyValues).
  patchLegacy: (x0) => {
    const x = renameLegacyFields(x0, LEGACY_FIELDS.wip);
    return {
      ...x,
      customerName: x.customerName ?? "",
      processingType: x.processingType ?? "",
      tentacleKg: x.tentacleKg ?? null,
      stomachKg: x.stomachKg ?? null,
      balancingPeriodId: x.balancingPeriodId ?? "",
      operator: x.operator ?? "",
      batterKg: x.batterKg ?? {},
      status: normalizeWipStatus(x.status), // bộ đệm / hàng chờ trước Đợt 5 còn "cho-nhap"/"da-nhap" (lib/legacyValues)
    };
  },
};

/** Chốt ngày sản xuất (bảng riêng, cùng hình dạng DailyLock). */
export const PRODUCTION_LOCK_TABLE: TableMapping<DailyLock> = {
  table: "production_locks",
  localKey: "bsf.production-locks.v2",
  getKey: theoId,
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
export const QC_CHECKLIST_TABLE: TableMapping<QcChecklistItem> = {
  table: "qc_checklists",
  localKey: "bsf.qc-checklists.v1",
  // Bộ đệm / hàng chờ trước Đợt 5 còn giá trị tiếng Việt (lib/legacyValues).
  patchLegacy: (x) => ({ ...x, result: normalizeQcResult(x.result) }),
  getKey: theoId,
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
    result: normalizeQcResult(r.result),
    score: n(r.score),
    note: s(r.note),
    backdateReason: s(r.backdate_reason),
    photoPaths: Array.isArray(r.photo_paths) ? (r.photo_paths as string[]) : [],
  }),
};

/** Chốt ngày QC (cùng hình dạng DailyLock, migration 0036). */
export const QC_LOCK_TABLE: TableMapping<DailyLock> = {
  table: "qc_locks",
  localKey: "bsf.qc-locks.v1",
  getKey: theoId,
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
export const PACKAGING_TABLE: TableMapping<Packaging> = {
  table: "packagings",
  localKey: "bsf.packagings.v1",
  // Khóa ngoại MỀM → products.id — chế độ demo thêm tiền tố.
  refColumns: ["from_product_id", "to_product_id"],
  getKey: theoId,
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
export const SALES_ORDER_TABLE: TableMapping<SalesOrder> = {
  table: "sales_orders",
  localKey: "bsf.sales-orders.v2",
  // Khóa ngoại MỀM → customers.id — chế độ demo thêm tiền tố.
  refColumns: ["customer_id"],
  patchLegacy: (x) => ({ ...x, status: normalizeSalesOrderStatus(x.status) }),
  getKey: theoId,
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
    status: normalizeSalesOrderStatus(r.status),
    note: s(r.note),
  }),
};

/** Dòng cần của đơn. */
export const ORDER_ITEM_TABLE: TableMapping<OrderItem> = {
  table: "order_items",
  localKey: "bsf.order-items.v2",
  // Khóa ngoại MỀM → sales_orders.id · products.id — chế độ demo thêm tiền tố.
  refColumns: ["order_id", "product_id"],
  getKey: theoId,
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
export const EXPORT_ORDER_TABLE: TableMapping<ExportOrder> = {
  table: "export_orders",
  localKey: "bsf.export-orders.v2",
  // Khóa ngoại MỀM → sales_orders.id — chế độ demo thêm tiền tố.
  refColumns: ["order_id"],
  patchLegacy: (x) => ({ ...x, status: normalizeExportOrderStatus(x.status) }),
  getKey: theoId,
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
    status: normalizeExportOrderStatus(r.status),
    note: s(r.note),
  }),
};

/** Dòng thực xuất (trừ tồn theo lô). */
export const EXPORT_ITEM_TABLE: TableMapping<ExportItem> = {
  table: "export_items",
  localKey: "bsf.export-items.v2",
  // Khóa ngoại MỀM → export_orders.id · production_wips.id · products.id — chế độ demo thêm tiền tố.
  refColumns: ["export_id", "wip_id", "product_id"],
  getKey: theoId,
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
export const OPENING_STOCK_TABLE: TableMapping<MaterialOpeningStock> = {
  table: "material_opening_stock",
  localKey: "bsf.material-opening-stock.v2",
  getKey: theoId,
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
export const FINISHED_OPENING_STOCK_TABLE: TableMapping<FinishedGoodsOpeningStock> = {
  table: "finished_goods_opening_stock",
  localKey: "bsf.finished-opening-stock.v2",
  // Khóa ngoại MỀM → products.id — chế độ demo thêm tiền tố.
  refColumns: ["product_id"],
  getKey: theoId,
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
export const NXT_SNAPSHOT_TABLE: TableMapping<NxtSnapshotLine> = {
  table: "nxt_snapshots",
  localKey: "bsf.nxt-snapshots.v2",
  getKey: theoId,
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
  patchLegacy: (x) => ({ ...x, storageLocation: x.storageLocation ?? "" }),
};

/** Danh mục kho LƯU hàng (kho nhà + kho lạnh thuê ngoài) — nối dữ liệu theo TÊN. */
export const STORAGE_LOCATION_TABLE: TableMapping<StorageLocation> = {
  table: "storage_locations",
  localKey: "bsf.storage-locations.v1",
  patchLegacy: (x) => ({ ...x, kind: normalizeStorageKind(x.kind) }),
  getKey: theoId,
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
    kind: normalizeStorageKind(r.kind),
    address: s(r.address),
    phone: s(r.phone),
    note: s(r.note),
  }),
};

/** Sổ BÁN NỘI ĐỊA (migration 0054) — NL bán thẳng, ghi ở /wip, Cân đối lấy làm dòng giảm. */
export const DOMESTIC_SALE_TABLE: TableMapping<DomesticSaleItem> = {
  table: "domestic_sales",
  localKey: "bsf.domestic-sales.v1",
  getKey: theoId,
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
export const ROW_MARK_TABLE: TableMapping<RowMark> = {
  table: "row_marks",
  localKey: "bsf.row-marks.v1",
  getKey: theoId,
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

/** Vai trò đã chỉnh / tự tạo (mig 0062) — spec docs/spec/role-permissions.md. */
export const APP_ROLE_TABLE: TableMapping<AppRole> = {
  table: "app_roles",
  localKey: "bsf.app-roles.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    name: x.name,
    description: x.description,
    home_route: x.homeRoute,
    sort_order: x.sortOrder,
    // Cột phòng ban (0072): chỉ gửi khi đã đọc được cột này từ máy chủ — chưa chạy 0072 mà
    // gửi cột lạ là mọi lần lưu vai trò bị từ chối (bài học 0040 + 0028).
    ...(x.department !== undefined ? { department: x.department || null } : {}),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    name: s(r.name),
    description: s(r.description),
    homeRoute: s(r.home_route),
    sortOrder: Number(r.sort_order) || 0,
    ...("department" in r ? { department: s(r.department) } : {}),
  }),
};

/** Ô quyền của vai trò đã chỉnh (mig 0062). */
export const ROLE_PERMISSION_TABLE: TableMapping<RolePermission> = {
  table: "role_permissions",
  localKey: "bsf.role-permissions.v1",
  getKey: theoId,
  toRow: (x) => ({ id: x.id, role_id: x.roleId, resource: x.resource, action: x.action, scope: x.scope }),
  fromRow: (r) => ({
    id: s(r.id),
    roleId: s(r.role_id),
    resource: s(r.resource),
    action: s(r.action),
    scope: s(r.scope) || "all",
  }),
};

/** Chỉnh quyền riêng từng người (mig 0062). */
export const USER_PERMISSION_TABLE: TableMapping<UserPermission> = {
  table: "user_permissions",
  localKey: "bsf.user-permissions.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    user_id: x.userId,
    resource: x.resource,
    action: x.action,
    effect: x.effect,
    scope: x.scope,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    userId: s(r.user_id),
    resource: s(r.resource),
    action: s(r.action),
    effect: s(r.effect) === "deny" ? "deny" : "allow",
    scope: s(r.scope) || "all",
  }),
};

/** Danh mục LOẠI BỘT TẨM (migration 0051) — sổ sản lượng nối theo TÊN. */
export const BATTER_TYPE_TABLE: TableMapping<BatterType> = {
  table: "batter_types",
  localKey: "bsf.batter-types.v1",
  getKey: theoId,
  toRow: (x) => ({ id: x.id, code: x.code, name: x.name, note: x.note }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    name: s(r.name),
    note: s(r.note),
  }),
};

/** Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau. Tồn cuối suy ở app (kiện + kg). */
export const MONTHLY_STOCK_TABLE: TableMapping<MonthlyStockLine> = {
  table: "monthly_stock_ledger",
  localKey: "bsf.monthly-stock.v2",
  // Khóa ngoại MỀM → monthly_stock_ledger.id (dòng nguồn khi dồn kỳ) — chế độ demo thêm tiền tố.
  refColumns: ["carried_from_id"],
  getKey: theoId,
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
  patchLegacy: (x) => ({
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
  them: string[]; // naming-ok: hàng chờ LƯU dưới máy (khóa `.cho`) — đổi tên là mất số chờ gửi
  xoa: string[]; // naming-ok: như trên
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
  if (!raw) return { them: [], xoa: [] }; // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
  try {
    const p = JSON.parse(raw) as Partial<SyncQueue> | null;
    const items = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return { them: items(p?.them), xoa: items(p?.xoa) }; // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
  } catch {
    return { them: [], xoa: [] }; // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
  }
}

function loadQueue(localKey: string): SyncQueue {
  try {
    return docCho(localStorage.getItem(`${modeLocalKey(localKey)}.cho`));
  } catch {
    return { them: [], xoa: [] }; // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
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

/** Bỏ các trường không chép xuống bản sao (xem TableMapping.uncachedFields). */
function omitFields<T>(x: T, fields: readonly string[]): T {
  const o = { ...(x as Record<string, unknown>) };
  for (const f of fields) delete o[f];
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
  getKey: (x: T) => string,
  uncachedFields: readonly string[] = [],
): T[] {
  const localByKey = new Map(local.map((x) => [getKey(x), x]));
  const serverByKey = new Map(may.map((x) => [getKey(x), x]));
  for (const k of cho.them) {
    let r = localByKey.get(k);
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
  remove: (keys: string[]) => Promise<PushError | null>;
}

export interface QueuePushResult {
  /** khóa đã gửi xong → JSON toRow đã gửi (null = dòng không còn để gửi). */
  sentUpserts: Map<string, string | null>;
  deleted: string[];
  /** Dòng bị server từ chối vì DỮ LIỆU của chính nó, hoặc vì tài khoản KHÔNG ĐỦ QUYỀN
   *  (`permission`, 42501) — cả hai đều GIỮ LẠI trong hàng chờ (có quyền sẽ tự gửi). */
  rowErrors: { key: string; msg: string; permission?: boolean }[];
  /** Lỗi chung (mất mạng, bảng/cột chưa có…) — dừng lượt, giữ nguyên phần chưa gửi. */
  generalError?: string;
}

const pushErrorMessage = (e: PushError) => (e.code ? `${e.code} ${e.message}` : e.message);
/** Lỗi do dữ liệu một/vài dòng (SQLSTATE lớp 21 cardinality, 22 data, 23 ràng
 *  buộc: 23505 trùng khóa duy nhất, 23502 NOT NULL…) — gửi lại từng dòng thì các
 *  dòng lành vẫn lên. Lỗi khác (mạng, 42P01, 42703) dòng nào cũng hỏng như nhau. */
const isRowLevelError = (e: PushError) => /^2[123]/.test(e.code ?? "") || isPermissionError(e);
/**
 * 42501 insufficient_privilege — RLS / chốt quyền máy chủ từ chối (phân quyền Đợt 6, hoặc
 * tài khoản chưa có vai trò — 0057). Trước đây thuộc "lỗi chung" ⇒ MỘT dòng bị từ chối là
 * cả bảng dừng gửi, mọi dòng khác kẹt theo. Giờ tách từng dòng như lỗi dữ liệu: dòng được
 * phép vẫn lên; dòng bị từ chối Ở LẠI hàng chờ (KHÔNG bỏ — 12/10/2026 cả sổ của một tài
 * khoản mất hồ sơ bị từ chối, gắn lại hồ sơ là số phải tự lên).
 */
const isPermissionError = (e: PushError) => e.code === "42501";
/** Lượt gộp bị từ chối vì quyền: thử tối đa chừng này dòng lẻ; dòng nào cũng bị từ chối ⇒
 *  coi cả lượt bị từ chối, không bắn hàng trăm yêu cầu mỗi lần đồng bộ. */
const PERMISSION_PROBE_ROWS = 5;
const rowErrorOf = (key: string, e: PushError) =>
  isPermissionError(e) ? { key, msg: pushErrorMessage(e), permission: true } : { key, msg: pushErrorMessage(e) };

/**
 * Gửi hàng chờ của một bảng qua `cong`. Upsert GOM THEO BỘ CỘT: supabase-js gộp
 * nhiều dòng thì lấy HỢP các cột, dòng thiếu cột nhận DEFAULT (defaultToNull:false)
 * — kể cả ở nhánh UPDATE ⇒ đè mất giá trị đang có (vd file_b64 bỏ khỏi bản sao).
 * Lượt gộp bị từ chối vì dữ liệu ⇒ gửi lại TỪNG dòng: dòng lành lên, chỉ dòng
 * hỏng ở lại (trước đây một dòng 23505 làm kẹt vĩnh viễn cả bảng).
 */
export async function pushQueue<T>(
  mapping: Pick<TableMapping<T>, "getKey" | "toRow">,
  cho: SyncQueue,
  rows: T[],
  gateway: UploadPort,
): Promise<QueuePushResult> {
  const result: QueuePushResult = { sentUpserts: new Map(), deleted: [], rowErrors: [] };
  const byKey = new Map(rows.map((x) => [mapping.getKey(x), x]));
  const group = new Map<string, { key: string; row: Record<string, unknown>; json: string }[]>();
  for (const k of new Set(cho.them)) {
    const x = byKey.get(k);
    if (x === undefined) {
      result.sentUpserts.set(k, null);
      continue;
    }
    const row = mapping.toRow(x);
    const droppedColumns = Object.keys(row)
      .filter((c) => row[c] !== undefined)
      .sort()
      .join(",");
    const items = group.get(droppedColumns) ?? [];
    items.push({ key: k, row, json: JSON.stringify(row) });
    group.set(droppedColumns, items);
  }

  for (const items of group.values()) {
    const e = await gateway.upsert(items.map((g) => g.row));
    if (!e) {
      for (const g of items) result.sentUpserts.set(g.key, g.json);
      continue;
    }
    if (!isRowLevelError(e)) return { ...result, generalError: pushErrorMessage(e) };
    if (items.length === 1) {
      result.rowErrors.push(rowErrorOf(items[0].key, e));
      continue;
    }
    let deniedStreak = 0;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (isPermissionError(e) && deniedStreak >= PERMISSION_PROBE_ROWS && deniedStreak === i) {
        // Mấy dòng đầu đều bị từ chối vì quyền ⇒ phần còn lại cũng vậy; giữ chờ, không gửi.
        for (const rest of items.slice(i)) result.rowErrors.push(rowErrorOf(rest.key, e));
        break;
      }
      const e1 = await gateway.upsert([g.row]);
      if (!e1) result.sentUpserts.set(g.key, g.json);
      else if (isRowLevelError(e1)) {
        result.rowErrors.push(rowErrorOf(g.key, e1));
        if (isPermissionError(e1)) deniedStreak++;
      } else return { ...result, generalError: pushErrorMessage(e1) };
    }
  }

  const remove = [...new Set(cho.xoa)];
  if (remove.length > 0) {
    const e = await gateway.remove(remove);
    if (!e) result.deleted.push(...remove);
    else if (!isRowLevelError(e)) return { ...result, generalError: pushErrorMessage(e) };
    else if (remove.length === 1) result.rowErrors.push(rowErrorOf(remove[0], e));
    else {
      let deniedStreak = 0;
      for (let i = 0; i < remove.length; i++) {
        const k = remove[i];
        if (isPermissionError(e) && deniedStreak >= PERMISSION_PROBE_ROWS && deniedStreak === i) {
          for (const rest of remove.slice(i)) result.rowErrors.push(rowErrorOf(rest, e));
          break;
        }
        const e1 = await gateway.remove([k]);
        if (!e1) result.deleted.push(k);
        else if (isRowLevelError(e1)) {
          result.rowErrors.push(rowErrorOf(k, e1));
          if (isPermissionError(e1)) deniedStreak++;
        } else return { ...result, generalError: pushErrorMessage(e1) };
      }
    }
  }
  return result;
}

/**
 * Hàng chờ SAU khi gửi: đọc lại hàng chờ hiện tại (có thể đã thêm khóa trong lúc
 * gửi) rồi chỉ bỏ khóa đã gửi mà dòng CHƯA đổi tiếp (`hienTai` = JSON toRow của
 * bản mới nhất). Ghi chồng lúc đang gửi ⇒ JSON khác ⇒ khóa ở lại cho lượt sau.
 */
export function dropSentKeys(
  cho: SyncQueue,
  result: Pick<QueuePushResult, "sentUpserts" | "deleted">,
  currentJson: Map<string, string>,
): SyncQueue {
  const deleted = new Set(result.deleted);
  return {
    them: cho.them.filter( // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
      (k) => !(result.sentUpserts.has(k) && result.sentUpserts.get(k) === (currentJson.get(k) ?? null)),
    ),
    xoa: cho.xoa.filter((k) => !deleted.has(k)), // naming-ok
  };
}

/** Bản đang dùng mới nhất của mỗi bảng trong tab này (mọi lần gọi useBang chung). */
const latestSnapshot = new Map<string, unknown[]>();
/** Đếm lần ghi theo bảng — tải server mà có lần ghi xen giữa thì bản tải về đã cũ. */
const writeCounts = new Map<string, number>();
/** Chuỗi gửi theo bảng — các lượt gửi một bảng chạy tuần tự, không chồng nhau. */
const sendChains = new Map<string, Promise<unknown>>();

/** Dòng hiện tại để gửi: bản trong tab, bù dòng tab khác (cùng trình duyệt) đã
 *  đưa vào hàng chờ chung mà tab này chưa có — lấy từ bản sao localStorage. */
function currentRows<T>(mapping: TableMapping<T>, rows: T[], toAdd: string[]): T[] {
  const snapshot = (latestSnapshot.get(mapping.localKey) as T[] | undefined) ?? rows;
  const existing = new Set(snapshot.map((x) => mapping.getKey(x)));
  const missingKeys = new Set(toAdd.filter((k) => !existing.has(k)));
  if (missingKeys.size === 0) return snapshot;
  const missingRows = load<T>(mapping.localKey)
    .map((x) => (mapping.patchLegacy ? mapping.patchLegacy(x) : x))
    .filter((x) => missingKeys.has(mapping.getKey(x)));
  return [...snapshot, ...missingRows];
}

/** Ghi bản sao localStorage (bỏ trường không-cache ở dòng đã đồng bộ). */
function saveLocalCopy<T>(mapping: TableMapping<T>, rows: T[]): boolean {
  const dropFields = hasSupabase ? mapping.uncachedFields : undefined;
  if (!dropFields?.length) return save(mapping.localKey, rows);
  const cho = new Set(loadQueue(mapping.localKey).them);
  return save(
    mapping.localKey,
    rows.map((x) => (cho.has(mapping.getKey(x)) ? x : omitFields(x, dropFields))),
  );
}

async function extractError(
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
  mapping: TableMapping<T>,
  keyColumn: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  const db = supabase;
  if (!db) return { ok: true };
  const cho = loadQueue(mapping.localKey);
  if (cho.them.length === 0 && cho.xoa.length === 0) return { ok: true };

  const gateway: UploadPort = {
    /* defaultToNull: false ⇒ dòng THIẾU một cột (vd mặt hàng tạo nhanh ở /wip
       không có materialTypeId) dùng DEFAULT của cột thay vì NULL. Mặc định của
       supabase-js khi upsert NHIỀU dòng là điền NULL cho cột dòng khác có mà
       dòng này thiếu ⇒ cột NOT NULL (material_type_id…) từ chối CẢ LƯỢT (23502)
       ⇒ hàng chờ kẹt vĩnh viễn: products không lên máy chủ từ 28/08 tới
       02/10/2026 (mọi máy). Đừng bỏ cờ này. */
    upsert: (items) =>
      extractError(
        db
          .from(mapping.table)
          .upsert(
            // Khóa chính theo chế độ (demo ⇒ tiền tố `demo:`) + site — rào R1 (lib/demoMode.ts).
            items.map((r) => rowToServer(r, keyColumn, SITE_ID, undefined, mapping.refColumns)),
            { onConflict: keyColumn, defaultToNull: false },
          ),
      ),
    // Xóa luôn lọc site (rào R2) + khóa theo chế độ: không lệnh xóa nào chạm được site khác.
    remove: (keys) =>
      extractError(
        db
          .from(mapping.table)
          .delete()
          .eq("site_id", SITE_ID)
          .in(keyColumn, keys.map((k) => toServerKey(k))),
      ),
  };
  const result = await pushQueue(mapping, cho, currentRows(mapping, rows, cho.them), gateway);

  // Đọc LẠI hàng chờ + bản mới nhất: khóa ghi thêm/sửa tiếp trong lúc gửi phải còn.
  const freshQueue = loadQueue(mapping.localKey);
  const currentJson = new Map(
    currentRows(mapping, rows, freshQueue.them)
      .filter((x) => result.sentUpserts.has(mapping.getKey(x)))
      .map((x) => [mapping.getKey(x), JSON.stringify(mapping.toRow(x))]),
  );
  const okCho = saveQueue(mapping.localKey, dropSentKeys(freshQueue, result, currentJson));
  // Dòng vừa lên server thì bỏ trường không-cache khỏi bản sao (nhả dung lượng).
  if (mapping.uncachedFields?.length && result.sentUpserts.size > 0)
    saveLocalCopy(mapping, (latestSnapshot.get(mapping.localKey) as T[] | undefined) ?? rows);

  if (result.generalError) return { ok: false, msg: result.generalError };
  if (result.rowErrors.length > 0) {
    console.error(`[đồng bộ] ${mapping.table}: dòng bị máy chủ từ chối`, result.rowErrors);
    const label = TABLE_LABELS[mapping.table] ?? mapping.table;
    const denied = result.rowErrors.filter((d) => d.permission).length;
    if (denied === result.rowErrors.length)
      return {
        ok: false,
        msg: `${label}: ${denied} dòng chưa lên máy chủ vì tài khoản KHÔNG ĐỦ QUYỀN — số vẫn giữ dưới máy, được cấp quyền sẽ tự gửi. Báo quản trị viên. Các dòng khác đã lên.`,
      };
    const vd = result.rowErrors
      .slice(0, 3)
      .map((d) => `${d.key} (${d.msg})`)
      .join("; ");
    return {
      ok: false,
      msg: `${label}: ${result.rowErrors.length} dòng chưa lên máy chủ vì lỗi dữ liệu — ${vd}${result.rowErrors.length > 3 ? "…" : ""}. Các dòng khác đã lên.`,
    };
  }
  if (!okCho) return { ok: false, msg: STORAGE_FULL_ERROR };
  return { ok: true };
}

/** Đẩy hàng chờ của một bảng lên máy chủ — xếp hàng sau lượt đang chạy của bảng đó. */
function syncQueueFor<T>(
  mapping: TableMapping<T>,
  keyColumn: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  const prevPromise = sendChains.get(mapping.localKey) ?? Promise.resolve();
  const p = prevPromise.then(() => syncOnePass(mapping, keyColumn, rows));
  sendChains.set(
    mapping.localKey,
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
/** jsonb `options` / `summary` lưu trước 2026-10-14 mang tên trường tiếng Việt (`soChuanTen`, `khop`…)
 *  và giá trị chế độ cũ (`haiBan`…) ⇒ đọc cả hai, ghi tên mới (lib/legacyValues). */
function readRunOptions(raw: object): ReconciliationRun["options"] {
  const o = renameLegacyFields(raw as ReconciliationRun["options"], LEGACY_FIELDS.reconciliationOptions);
  return o.mode ? { ...o, mode: normalizeReconciliationMode(o.mode) } : o;
}
function readRunSummary(raw: object): ReconciliationRun["summary"] {
  return renameLegacyFields(raw as ReconciliationRun["summary"], LEGACY_FIELDS.reconciliationSummary);
}

export const RECONCILIATION_RUN_TABLE: TableMapping<ReconciliationRun> = {
  table: "reconciliation_runs",
  localKey: "bsf.reconciliation-runs.v1",
  getKey: theoId,
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
    options: readRunOptions(parseObj(r.options)),
    summary: readRunSummary(parseObj(r.summary)),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  }),
  patchLegacy: (x) => ({
    ...x,
    fileB64: x.fileB64 ?? "",
    options: readRunOptions(x.options ?? {}),
    summary: readRunSummary(x.summary ?? {}),
  }),
  uncachedFields: ["fileB64"],
};

/**
 * Sự kiện biến đổi lô (mig 0046) — "đầu ra đã dùng đầu vào này". Nối chuỗi truy
 * xuất NL → BTP → TP. KHÔNG thêm cột vào production_wips/packagings (xem 0046).
 */
export const LOT_INPUT_TABLE: TableMapping<LotInput> = {
  table: "lot_inputs",
  localKey: "bsf.lot-inputs.v1",
  // Khóa ngoại MỀM → id bản ghi lô (production_wips / packagings / material_imports) — chế độ demo thêm tiền tố.
  refColumns: ["output_id", "input_id"],
  patchLegacy: (x) => ({ ...x, method: normalizeLotMethod<LotInput["method"]>(x.method) }),
  getKey: theoId,
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
    method: normalizeLotMethod<LotInput["method"]>(r.method),
    operator: s(r.operator),
    recordedAt: s(r.recorded_at),
  }),
};

/**
 * Sổ in tem QR (mig 0049) — mỗi lần bấm In ghi một dòng cho mỗi lô. Chỉ THÊM
 * bảng; nhãn lô vẫn suy từ bản ghi, `label` ở đây là nhãn đã in (đông cứng).
 */
export const LABEL_PRINT_TABLE: TableMapping<LabelPrint> = {
  table: "label_prints",
  localKey: "bsf.label-prints.v1",
  // Khóa ngoại MỀM → id bản ghi lô — chế độ demo thêm tiền tố.
  refColumns: ["lot_id"],
  getKey: theoId,
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
export const LOT_DISPATCH_TABLE: TableMapping<LotDispatch> = {
  table: "lot_dispatches",
  localKey: "bsf.lot-dispatches.v1",
  // Khóa ngoại MỀM → id bản ghi lô · id chứng từ ra (sales_items / export_items / domestic_sales) — chế độ demo thêm tiền tố.
  refColumns: ["lot_id", "doc_id"],
  patchLegacy: (x) => ({ ...x, method: normalizeLotMethod<LotDispatch["method"]>(x.method) }),
  getKey: theoId,
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
    method: normalizeLotMethod<LotDispatch["method"]>(r.method),
    operator: s(r.operator),
    recordedAt: s(r.recorded_at),
  }),
};

/** Lý do chưa gắn lô khi chốt ngày (mig 0056). */
export const LOT_WAIVER_TABLE: TableMapping<LotWaiver> = {
  table: "lot_waivers",
  localKey: "bsf.lot-waivers.v1",
  // Khóa ngoại MỀM → production_wips.id — chế độ demo thêm tiền tố.
  refColumns: ["output_id"],
  getKey: theoId,
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

/** Giao việc — màn "Việc của tôi" (mig 0070). */
export const TASK_ASSIGNMENT_TABLE: TableMapping<TaskAssignment> = {
  table: "task_assignments",
  localKey: "bsf.task-assignments.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    source: x.source,
    task_key: x.taskKey,
    title: x.title,
    detail: x.detail,
    path: x.path,
    workshop: x.workshop,
    task_date: x.taskDate || null,
    due_date: x.dueDate || null,
    assignee_id: x.assigneeId,
    assignee_name: x.assigneeName,
    assigned_by_id: x.assignedById,
    assigned_by_name: x.assignedByName,
    status: x.status,
    note: x.note,
    done_at: x.doneAt || null,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    source: s(r.source) === "manual" ? "manual" : "system",
    taskKey: s(r.task_key),
    title: s(r.title),
    detail: s(r.detail),
    path: s(r.path),
    workshop: (["Đông", "Cá", "Khô"].includes(s(r.workshop)) ? s(r.workshop) : "") as TaskAssignment["workshop"],
    taskDate: s(r.task_date).slice(0, 10),
    dueDate: s(r.due_date).slice(0, 10),
    assigneeId: s(r.assignee_id),
    assigneeName: s(r.assignee_name),
    assignedById: s(r.assigned_by_id),
    assignedByName: s(r.assigned_by_name),
    status: s(r.status) === "done" ? "done" : s(r.status) === "cancelled" ? "cancelled" : "open",
    note: s(r.note),
    doneAt: s(r.done_at),
    createdAt: s(r.created_at),
  }),
};

/** Ngày yyyy-mm-dd (cột date) — rỗng ⇒ null khi gửi. */
const dateOrNull = (v: string) => (v ? v : null);
const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
const DOCUMENT_KIND_VALUES = new Set(["procedure", "instruction", "form", "certificate", "capability_profile", "other"]);
const VERSION_STATUS_VALUES = new Set(["draft", "in_review", "pending_approval", "active", "obsolete"]);

/** Tài liệu công ty (mig 0072 — màn /documents). Khóa ngoại mềm `parent_id` ⇒ khai refColumns cho chế độ demo. */
export const COMPANY_DOCUMENT_TABLE: TableMapping<CompanyDocument> = {
  table: "company_documents",
  localKey: "bsf.company-documents.v1",
  getKey: theoId,
  refColumns: ["parent_id"],
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    title: x.title,
    kind: x.kind,
    parent_id: x.parentId,
    owner_department: x.ownerDepartment,
    visibility: x.visibility,
    visible_departments: x.visibleDepartments,
    retention_years: x.retentionYears,
    expires_on: dateOrNull(x.expiresOn),
    is_withdrawn: x.isWithdrawn,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    title: s(r.title),
    kind: (DOCUMENT_KIND_VALUES.has(s(r.kind)) ? s(r.kind) : "other") as CompanyDocument["kind"],
    parentId: s(r.parent_id),
    ownerDepartment: s(r.owner_department),
    visibility: s(r.visibility) === "company" ? "company" : "departments",
    visibleDepartments: stringList(r.visible_departments),
    retentionYears: Number(r.retention_years) || 0,
    expiresOn: s(r.expires_on).slice(0, 10),
    isWithdrawn: r.is_withdrawn === true,
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

/** Lần ban hành của tài liệu (mig 0072). Khóa ngoại mềm `document_id` ⇒ refColumns. */
export const DOCUMENT_VERSION_TABLE: TableMapping<DocumentVersion> = {
  table: "document_versions",
  localKey: "bsf.document-versions.v1",
  getKey: theoId,
  refColumns: ["document_id"],
  toRow: (x) => ({
    id: x.id,
    document_id: x.documentId,
    revision_no: x.revisionNo,
    effective_date: dateOrNull(x.effectiveDate),
    change_summary: x.changeSummary,
    status: x.status,
    approval_mode: x.approvalMode,
    prepared_by_name: x.preparedByName,
    reviewed_by_name: x.reviewedByName,
    approved_by_name: x.approvedByName,
    reviewer_id: x.reviewerId,
    approver_id: x.approverId,
    reviewed_at: x.reviewedAt || null,
    approved_at: x.approvedAt || null,
    return_reason: x.returnReason,
    pdf_path: x.pdfPath,
    source_path: x.sourcePath,
    pdf_file_name: x.pdfFileName,
    source_file_name: x.sourceFileName,
    obsoleted_on: dateOrNull(x.obsoletedOn),
    recorded_by_name: x.recordedByName,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    documentId: s(r.document_id),
    revisionNo: Number(r.revision_no) || 0,
    effectiveDate: s(r.effective_date).slice(0, 10),
    changeSummary: s(r.change_summary),
    status: (VERSION_STATUS_VALUES.has(s(r.status)) ? s(r.status) : "draft") as DocumentVersion["status"],
    approvalMode: s(r.approval_mode) === "app" ? "app" : "paper",
    preparedByName: s(r.prepared_by_name),
    reviewedByName: s(r.reviewed_by_name),
    approvedByName: s(r.approved_by_name),
    reviewerId: s(r.reviewer_id),
    approverId: s(r.approver_id),
    reviewedAt: s(r.reviewed_at),
    approvedAt: s(r.approved_at),
    returnReason: s(r.return_reason),
    pdfPath: s(r.pdf_path),
    sourcePath: s(r.source_path),
    pdfFileName: s(r.pdf_file_name),
    sourceFileName: s(r.source_file_name),
    obsoletedOn: s(r.obsoleted_on).slice(0, 10),
    recordedByName: s(r.recorded_by_name),
    createdAt: s(r.created_at),
  }),
};

/* ---------- Phòng Kế hoạch · Xuất khẩu (mig 0075) ---------- */
// Không khóa ngoại (khuôn 0070 / 0072): contract_id / revision_id / shipment_id / step_item_id /
// shared_from_id là liên kết MỀM ⇒ khai refColumns để chế độ demo gắn tiền tố `demo:`.

const numOrNull = (v: unknown) => {
  const x = n(v);
  return x != null && Number.isFinite(x) ? x : null;
};
const jsonOf = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const PAYMENT_METHOD_VALUES = new Set(["ttr", "lc", "other"]);
const SHIPMENT_KIND_VALUES = new Set(["20RF", "40RF", "40HC-RF", "truck", "consolidated"]);
const STEP_VALUES = new Set(["production-order", "packaging", "loading-plan", "loading-photos", "customs-declaration", "export-order", "document"]);
const ITEM_STATE_VALUES = new Set(["not-started", "in-progress", "done", "not-applicable"]);
const DECISION_VALUES = new Set(["approved", "needs-revision", "rejected"]);
const ATTACHMENT_KIND_VALUES = new Set(["signed-contract", "lc", "proforma", "other"]);
const ACTIVITY_ACTION_VALUES = new Set(["create", "update", "delete", "approve", "return", "reject", "attach", "detach", "cancel", "restore", "close", "reopen", "undo"]);

function parseTerms(v: unknown): ExportContractTerms {
  const t = (jsonOf(v) ?? {}) as Record<string, unknown>;
  const docs = Array.isArray(t.requiredDocuments) ? (t.requiredDocuments as Record<string, unknown>[]) : [];
  return {
    incoterm: s(t.incoterm),
    portOfLoading: s(t.portOfLoading),
    portOfDischarge: s(t.portOfDischarge),
    paymentMethod: (PAYMENT_METHOD_VALUES.has(s(t.paymentMethod)) ? s(t.paymentMethod) : "ttr") as ExportContractTerms["paymentMethod"],
    paymentOther: s(t.paymentOther),
    depositPct: numOrNull(t.depositPct),
    lcNo: s(t.lcNo),
    lcExpiry: s(t.lcExpiry).slice(0, 10),
    lcLatestShipment: s(t.lcLatestShipment).slice(0, 10),
    currency: s(t.currency) || "USD",
    tolerancePct: numOrNull(t.tolerancePct),
    latestShipmentDate: s(t.latestShipmentDate).slice(0, 10),
    containerCount: numOrNull(t.containerCount),
    containerType: s(t.containerType),
    requiredDocuments: docs.map((d) => ({ kind: (s(d.kind) || "other") as ExportContractTerms["requiredDocuments"][number]["kind"], form: s(d.form), issuer: s(d.issuer) })),
  };
}

function parseLines(v: unknown): ExportContractLine[] {
  const xs = jsonOf(v);
  if (!Array.isArray(xs)) return [];
  return (xs as Record<string, unknown>[]).map((l) => ({
    id: s(l.id),
    description: s(l.description),
    hsCode: s(l.hsCode),
    size: s(l.size),
    packing: s(l.packing),
    unitKind: s(l.unitKind) === "bundle" ? "bundle" : "carton",
    cartonsPerUnit: Number(l.cartonsPerUnit) || 1,
    netKgPerCarton: numOrNull(l.netKgPerCarton),
    quantity: numOrNull(l.quantity),
    kg: numOrNull(l.kg),
    unitPrice: numOrNull(l.unitPrice),
    microSpec: s(l.microSpec),
    // Mặt hàng đã nối (R16) — thiếu dòng này thì tải lại trang mọi dòng thành "chưa nối" dù máy chủ đã lưu.
    ...(l.productId ? { productId: s(l.productId) } : {}),
    // Loại hàng (mig 0089) — như productId: thiếu dòng này thì tải lại trang mất loại đã chọn.
    ...(l.goodsTypeId ? { goodsTypeId: s(l.goodsTypeId) } : {}),
    // Yêu cầu NL của dòng (ba-spec 41 R38) — nằm trong JSON lines, không cần cột; bản cũ không có ⇒ bỏ qua.
    ...(l.pieceLength ? { pieceLength: s(l.pieceLength) } : {}),
    ...(l.partRatio ? { partRatio: s(l.partRatio) } : {}),
    ...(l.piecesPerKg ? { piecesPerKg: s(l.piecesPerKg) } : {}),
    ...(l.note ? { note: s(l.note) } : {}),
  }));
}

export const EXPORT_CONTRACT_TABLE: TableMapping<ExportContract> = {
  table: "export_contracts",
  localKey: "bsf.export-contracts.v1",
  // Khóa ngoại MỀM → customers.id — chế độ demo thêm tiền tố.
  refColumns: ["customer_id"],
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    customer_id: x.customerId,
    contract_no: x.contractNo,
    signed_on: dateOrNull(x.signedOn),
    order_ref: x.orderRef,
    status: x.status,
    cancel_reason: x.cancelReason,
    close_reason: x.closeReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    customerId: s(r.customer_id),
    contractNo: s(r.contract_no),
    signedOn: s(r.signed_on).slice(0, 10),
    orderRef: s(r.order_ref),
    status: s(r.status) === "cancelled" ? "cancelled" : s(r.status) === "closed" ? "closed" : "open",
    cancelReason: s(r.cancel_reason),
    closeReason: s(r.close_reason),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_CONTRACT_REVISION_TABLE: TableMapping<ExportContractRevision> = {
  table: "export_contract_revisions",
  localKey: "bsf.export-contract-revisions.v1",
  getKey: theoId,
  refColumns: ["contract_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    revision_no: x.revisionNo,
    revised_on: dateOrNull(x.revisedOn),
    change_summary: x.changeSummary,
    terms: x.terms,
    lines: x.lines,
    file_path: x.filePath,
    file_name: x.fileName,
    recorded_by: x.recordedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    revisionNo: Number(r.revision_no) || 0,
    revisedOn: s(r.revised_on).slice(0, 10),
    changeSummary: s(r.change_summary),
    terms: parseTerms(r.terms),
    lines: parseLines(r.lines),
    filePath: s(r.file_path),
    fileName: s(r.file_name),
    recordedBy: s(r.recorded_by),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_CONTRACT_APPROVAL_TABLE: TableMapping<ExportContractApproval> = {
  table: "export_contract_approvals",
  localKey: "bsf.export-contract-approvals.v1",
  getKey: theoId,
  refColumns: ["contract_id", "revision_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    revision_id: x.revisionId,
    // Cột của mig 0079 — chỉ gửi khi có, dòng cũ vẫn ghi được lên máy chủ chưa chạy 0079.
    ...(x.stage ? { stage: x.stage } : {}),
    decision: x.decision,
    approver_name: x.approverName,
    decided_on: dateOrNull(x.decidedOn),
    reason: x.reason,
    file_path: x.filePath,
    file_name: x.fileName,
    recorded_by: x.recordedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    revisionId: s(r.revision_id),
    ...(s(r.stage) === "contract" || s(r.stage) === "final" ? { stage: s(r.stage) as ExportApprovalStage } : {}),
    decision: (DECISION_VALUES.has(s(r.decision)) ? s(r.decision) : "needs-revision") as ExportContractApproval["decision"],
    approverName: s(r.approver_name),
    decidedOn: s(r.decided_on).slice(0, 10),
    reason: s(r.reason),
    filePath: s(r.file_path),
    fileName: s(r.file_name),
    recordedBy: s(r.recorded_by),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_DEADLINE_EXTENSION_TABLE: TableMapping<ExportDeadlineExtension> = {
  table: "export_deadline_extensions",
  localKey: "bsf.export-deadline-extensions.v1",
  getKey: theoId,
  refColumns: ["contract_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    new_deadline: x.newDeadline,
    confirmed_on: dateOrNull(x.confirmedOn),
    note: x.note,
    file_path: x.filePath,
    file_name: x.fileName,
    recorded_by: x.recordedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    newDeadline: s(r.new_deadline).slice(0, 10),
    confirmedOn: s(r.confirmed_on).slice(0, 10),
    note: s(r.note),
    filePath: s(r.file_path),
    fileName: s(r.file_name),
    recordedBy: s(r.recorded_by),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_SHIPMENT_TABLE: TableMapping<ExportShipment> = {
  table: "export_shipments",
  localKey: "bsf.export-shipments.v1",
  getKey: theoId,
  refColumns: ["contract_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    plan_month: x.planMonth,
    kind: x.kind,
    goods_summary: x.goodsSummary,
    planned_kg: x.plannedKg,
    lot_code: x.lotCode,
    port_of_discharge: x.portOfDischarge,
    booking_no: x.bookingNo,
    loading_date: dateOrNull(x.loadingDate),
    etd: dateOrNull(x.etd),
    eta: dateOrNull(x.eta),
    vessel_voyage: x.vesselVoyage,
    container_no: x.containerNo,
    seal_no: x.sealNo,
    status: x.status,
    cancel_reason: x.cancelReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    planMonth: s(r.plan_month),
    kind: (SHIPMENT_KIND_VALUES.has(s(r.kind)) ? s(r.kind) : "40RF") as ExportShipment["kind"],
    goodsSummary: s(r.goods_summary),
    plannedKg: numOrNull(r.planned_kg),
    lotCode: s(r.lot_code),
    portOfDischarge: s(r.port_of_discharge),
    bookingNo: s(r.booking_no),
    loadingDate: s(r.loading_date).slice(0, 10),
    etd: s(r.etd).slice(0, 10),
    eta: s(r.eta).slice(0, 10),
    vesselVoyage: s(r.vessel_voyage),
    containerNo: s(r.container_no),
    sealNo: s(r.seal_no),
    status: s(r.status) === "cancelled" ? "cancelled" : "open",
    cancelReason: s(r.cancel_reason),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_STEP_ITEM_TABLE: TableMapping<ExportStepItem> = {
  table: "export_step_items",
  localKey: "bsf.export-step-items.v1",
  getKey: theoId,
  refColumns: ["shipment_id", "shared_from_id"],
  toRow: (x) => ({
    id: x.id,
    shipment_id: x.shipmentId,
    step: x.step,
    doc_kind: x.docKind,
    doc_form: x.docForm,
    doc_issuer: x.docIssuer,
    state: x.state,
    number: x.number,
    issued_on: dateOrNull(x.issuedOn),
    note: x.note,
    na_reason: x.naReason,
    shared_from_id: x.sharedFromId,
    cartons: x.cartons,
    net_kg: x.netKg,
    amount: x.amount,
    on_board_date: dateOrNull(x.onBoardDate),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    shipmentId: s(r.shipment_id),
    step: (STEP_VALUES.has(s(r.step)) ? s(r.step) : "document") as ExportStepItem["step"],
    docKind: s(r.doc_kind) as ExportStepItem["docKind"],
    docForm: s(r.doc_form),
    docIssuer: s(r.doc_issuer),
    state: (ITEM_STATE_VALUES.has(s(r.state)) ? s(r.state) : "not-started") as ExportStepItem["state"],
    number: s(r.number),
    issuedOn: s(r.issued_on).slice(0, 10),
    note: s(r.note),
    naReason: s(r.na_reason),
    sharedFromId: s(r.shared_from_id),
    cartons: numOrNull(r.cartons),
    netKg: numOrNull(r.net_kg),
    amount: numOrNull(r.amount),
    onBoardDate: s(r.on_board_date).slice(0, 10),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_FILE_TABLE: TableMapping<ExportFile> = {
  table: "export_files",
  localKey: "bsf.export-files.v1",
  getKey: theoId,
  refColumns: ["contract_id", "shipment_id", "step_item_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    shipment_id: x.shipmentId,
    step_item_id: x.stepItemId,
    step: x.step,
    // Hồ sơ đính kèm cấp HĐ (mig 0079) — chỉ gửi với step "contract".
    ...(x.step === "contract" ? { attachment_kind: x.attachmentKind ?? "" } : {}),
    path: x.path,
    file_name: x.fileName,
    layer_no: x.layerNo,
    caption: x.caption,
    uploaded_by: x.uploadedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    shipmentId: s(r.shipment_id),
    stepItemId: s(r.step_item_id),
    step: (STEP_VALUES.has(s(r.step)) || s(r.step) === "contract" ? s(r.step) : "document") as ExportFile["step"],
    ...(s(r.step) === "contract" ? { attachmentKind: (ATTACHMENT_KIND_VALUES.has(s(r.attachment_kind)) ? s(r.attachment_kind) : "other") as ExportContractAttachmentKind } : {}),
    path: s(r.path),
    fileName: s(r.file_name),
    layerNo: numOrNull(r.layer_no),
    caption: s(r.caption),
    uploadedBy: s(r.uploaded_by),
    createdAt: s(r.created_at),
  }),
};

export const EXPORT_PAYMENT_TABLE: TableMapping<ExportPayment> = {
  table: "export_payments",
  localKey: "bsf.export-payments.v1",
  getKey: theoId,
  refColumns: ["contract_id", "shipment_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    shipment_id: x.shipmentId,
    kind: x.kind,
    date: dateOrNull(x.date),
    amount: x.amount,
    currency: x.currency,
    method: x.method,
    note: x.note,
    file_path: x.filePath,
    file_name: x.fileName,
    recorded_by: x.recordedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    shipmentId: s(r.shipment_id),
    kind: s(r.kind) === "documents-sent" ? "documents-sent" : "payment",
    date: s(r.date).slice(0, 10),
    amount: numOrNull(r.amount),
    currency: s(r.currency) || "USD",
    method: s(r.method),
    note: s(r.note),
    filePath: s(r.file_path),
    fileName: s(r.file_name),
    recordedBy: s(r.recorded_by),
    createdAt: s(r.created_at),
  }),
};

/** Nhật ký thao tác hợp đồng xuất khẩu (mig 0079) — chỉ thêm; RLS không cho sửa / xóa. */
export const EXPORT_ACTIVITY_TABLE: TableMapping<ExportActivity> = {
  table: "export_activity_log",
  localKey: "bsf.export-activity-log.v1",
  getKey: theoId,
  refColumns: ["contract_id", "shipment_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    shipment_id: x.shipmentId,
    action: x.action,
    summary: x.summary,
    actor: x.actor,
    created_at: x.createdAt || new Date().toISOString(),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    shipmentId: s(r.shipment_id),
    action: (ACTIVITY_ACTION_VALUES.has(s(r.action)) ? s(r.action) : "update") as ExportActivity["action"],
    summary: s(r.summary),
    actor: s(r.actor),
    createdAt: s(r.created_at),
  }),
};

/** Tên hàng theo khách (mig 0077) — tên in trên chứng từ xuất khẩu của từng khách cho từng mặt hàng. */
export const CUSTOMER_PRODUCT_NAME_TABLE: TableMapping<CustomerProductName> = {
  table: "customer_product_names",
  localKey: "bsf.customer-product-names.v1",
  getKey: theoId,
  refColumns: ["customer_id", "product_id"],
  toRow: (x) => ({
    id: x.id,
    customer_id: x.customerId,
    product_id: x.productId,
    trade_name: x.tradeName,
    size_text: x.sizeText ?? "",
    packing: x.packing ?? "",
    hs_code: x.hsCode ?? "",
    note: x.note ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    customerId: s(r.customer_id),
    productId: s(r.product_id),
    tradeName: s(r.trade_name),
    sizeText: s(r.size_text),
    packing: s(r.packing),
    hsCode: s(r.hs_code),
    note: s(r.note),
  }),
};

/** Danh mục loại chứng từ xuất khẩu (mig 0081) — đổi tên loại hệ thống + loại tự thêm. */
/** Loại hàng (mig 0089) — danh mục dùng chung dòng hàng HĐ xuất + nhập. */
export const GOODS_TYPE_TABLE: TableMapping<GoodsType> = {
  table: "goods_types",
  localKey: "bsf.goods-types.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    name: x.name,
    sort_order: Math.round(Number(x.sortOrder) || 0),
    note: x.note ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    name: s(r.name),
    sortOrder: Number(r.sort_order) || 0,
    note: s(r.note),
  }),
};

export const EXPORT_DOCUMENT_KIND_TABLE: TableMapping<ExportDocumentKindRow> = {
  table: "export_document_kinds",
  localKey: "bsf.export-document-kinds.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    name: x.name,
    sort_order: Math.round(Number(x.sortOrder) || 0),
    note: x.note ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    name: s(r.name),
    sortOrder: Number(r.sort_order) || 0,
    note: s(r.note),
  }),
};

/* ---------- Nhật ký thao tác (audit) ---------- */

/* ---------- Phòng Kế hoạch · Nhập khẩu (mig 0082, ba-spec 45) ---------- */

const IMPORT_TYPE_VALUES = new Set(["export-production", "trading", "processing"]);
const IMPORT_TRANSPORT_VALUES = new Set(["20RF", "40RF", "lcl"]);
const IMPORT_DOCUMENT_KIND_VALUES = new Set([
  "commercial-invoice",
  "packing-list",
  "import-declaration",
  "certificate-of-origin",
  "quarantine-certificate",
  "bill-of-lading",
  "other",
]);
const importTypeOf = (v: unknown): ImportType | "" => (IMPORT_TYPE_VALUES.has(s(v)) ? (s(v) as ImportType) : "");

/** Đơn giá theo id dòng (jsonb) — giá trị lạ ⇒ null (dòng không ghi giá). */
function parseLinePrices(v: unknown): Record<string, number | null> {
  const o = jsonOf(v);
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  const out: Record<string, number | null> = {};
  for (const [k, x] of Object.entries(o as Record<string, unknown>)) out[k] = numOrNull(x);
  return out;
}

/**
 * NCC nhập khẩu (mig 0083) — danh mục riêng, KHÔNG dùng bảng `suppliers` (đại lý Nhập hàng). Cột
 * `suppliers.country` của 0082 để yên trên máy chủ, app thôi gửi / đọc.
 */
export const IMPORT_SUPPLIER_TABLE: TableMapping<ImportSupplier> = {
  table: "import_suppliers",
  localKey: "bsf.import-suppliers.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    code: x.code,
    short_name: x.shortName,
    full_name: x.fullName,
    country: x.country,
    address: x.address,
    tax_id: x.taxId,
    main_products: x.mainProducts,
    loading_port: x.loadingPort,
    contact_name: x.contactName,
    contact_title: x.contactTitle,
    email: x.email,
    phone: x.phone,
    website: x.website,
    bank_name: x.bankName,
    bank_account: x.bankAccount,
    swift_code: x.swiftCode,
    bank_address: x.bankAddress,
    status: x.status,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    code: s(r.code),
    shortName: s(r.short_name),
    fullName: s(r.full_name),
    country: s(r.country),
    address: s(r.address),
    taxId: s(r.tax_id),
    mainProducts: s(r.main_products),
    loadingPort: s(r.loading_port),
    contactName: s(r.contact_name),
    contactTitle: s(r.contact_title),
    email: s(r.email),
    phone: s(r.phone),
    website: s(r.website),
    bankName: s(r.bank_name),
    bankAccount: s(r.bank_account),
    swiftCode: s(r.swift_code),
    bankAddress: s(r.bank_address),
    status: s(r.status) === "inactive" ? "inactive" : "active",
    note: s(r.note),
  }),
};

export const IMPORT_CONTRACT_TABLE: TableMapping<ImportContract> = {
  table: "import_contracts",
  localKey: "bsf.import-contracts.v1",
  getKey: theoId,
  refColumns: ["supplier_id"],
  toRow: (x) => ({
    id: x.id,
    supplier_id: x.supplierId,
    supplier_name: x.supplierName,
    contract_no: x.contractNo,
    signed_date: dateOrNull(x.signedDate),
    import_type: x.importType,
    currency: x.currency,
    line_prices: x.linePrices,
    status: x.status,
    close_reason: x.closeReason,
    cancel_reason: x.cancelReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    supplierId: s(r.supplier_id),
    supplierName: s(r.supplier_name),
    contractNo: s(r.contract_no),
    signedDate: s(r.signed_date).slice(0, 10),
    importType: importTypeOf(r.import_type),
    currency: s(r.currency) || "USD",
    linePrices: parseLinePrices(r.line_prices),
    status: s(r.status) === "closed" ? "closed" : s(r.status) === "cancelled" ? "cancelled" : "open",
    closeReason: s(r.close_reason),
    cancelReason: s(r.cancel_reason),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

export const IMPORT_CONTRACT_LINE_TABLE: TableMapping<ImportContractLine> = {
  table: "import_contract_lines",
  localKey: "bsf.import-contract-lines.v1",
  getKey: theoId,
  // product_id → products.id (mig 0084): chỉ gửi khi dòng có trường (máy chủ chưa có cột ⇒ không kẹt hàng chờ).
  // goods_type_id → goods_types.id (mig 0089): như product_id, chỉ gửi khi dòng có trường.
  refColumns: ["contract_id", "product_id", "goods_type_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    line_no: x.lineNo,
    product_name: x.productName,
    ...(x.productId !== undefined ? { product_id: x.productId || null } : {}),
    ...(x.goodsTypeId !== undefined ? { goods_type_id: x.goodsTypeId || null } : {}),
    kg: x.kg,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    lineNo: numOrNull(r.line_no) ?? 0,
    productName: s(r.product_name),
    ...("product_id" in r ? { productId: r.product_id == null ? "" : s(r.product_id) } : {}),
    ...("goods_type_id" in r ? { goodsTypeId: r.goods_type_id == null ? "" : s(r.goods_type_id) } : {}),
    kg: numOrNull(r.kg),
    note: s(r.note),
  }),
};

export const IMPORT_RECEIPT_TABLE: TableMapping<ImportReceipt> = {
  table: "import_receipts",
  localKey: "bsf.import-receipts.v1",
  getKey: theoId,
  refColumns: ["contract_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    contract_no: x.contractNo,
    supplier_name: x.supplierName,
    arrival_date: dateOrNull(x.arrivalDate),
    expected_date: dateOrNull(x.expectedDate),
    transport: x.transport,
    container_no: x.containerNo,
    bl_no: x.blNo,
    status: x.status,
    cancel_reason: x.cancelReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    contractNo: s(r.contract_no),
    supplierName: s(r.supplier_name),
    arrivalDate: s(r.arrival_date).slice(0, 10),
    expectedDate: s(r.expected_date).slice(0, 10),
    transport: (IMPORT_TRANSPORT_VALUES.has(s(r.transport)) ? s(r.transport) : "40RF") as ImportTransport,
    containerNo: s(r.container_no),
    blNo: s(r.bl_no),
    status: s(r.status) === "cancelled" ? "cancelled" : "open",
    cancelReason: s(r.cancel_reason),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

export const IMPORT_RECEIPT_LINE_TABLE: TableMapping<ImportReceiptLine> = {
  table: "import_receipt_lines",
  localKey: "bsf.import-receipt-lines.v1",
  getKey: theoId,
  refColumns: ["receipt_id", "contract_line_id"],
  toRow: (x) => ({ id: x.id, receipt_id: x.receiptId, contract_line_id: x.contractLineId, kg: x.kg, recorded_by: x.recordedBy }),
  fromRow: (r) => ({
    id: s(r.id),
    receiptId: s(r.receipt_id),
    contractLineId: s(r.contract_line_id),
    kg: numOrNull(r.kg),
    recordedBy: s(r.recorded_by),
    updatedAt: s(r.updated_at),
  }),
};

export const IMPORT_DOCUMENT_TABLE: TableMapping<ImportDocument> = {
  table: "import_documents",
  localKey: "bsf.import-documents.v1",
  getKey: theoId,
  refColumns: ["receipt_id"],
  toRow: (x) => ({
    id: x.id,
    receipt_id: x.receiptId,
    kind: x.kind,
    custom_name: x.customName,
    doc_no: x.docNo,
    doc_date: dateOrNull(x.docDate),
    import_type: x.importType,
    not_applicable: x.notApplicable,
    na_reason: x.naReason,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    receiptId: s(r.receipt_id),
    kind: (IMPORT_DOCUMENT_KIND_VALUES.has(s(r.kind)) ? s(r.kind) : "other") as ImportDocumentKind,
    customName: s(r.custom_name),
    docNo: s(r.doc_no),
    docDate: s(r.doc_date).slice(0, 10),
    importType: importTypeOf(r.import_type),
    notApplicable: Boolean(r.not_applicable),
    naReason: s(r.na_reason),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

export const IMPORT_FILE_TABLE: TableMapping<ImportFile> = {
  table: "import_files",
  localKey: "bsf.import-files.v1",
  getKey: theoId,
  refColumns: ["contract_id", "receipt_id", "document_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    receipt_id: x.receiptId,
    document_id: x.documentId,
    path: x.path,
    file_name: x.fileName,
    uploaded_by: x.uploadedBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    receiptId: s(r.receipt_id),
    documentId: s(r.document_id),
    path: s(r.path),
    fileName: s(r.file_name),
    uploadedBy: s(r.uploaded_by),
    createdAt: s(r.created_at),
  }),
};

function parseTextMap(v: unknown): Record<string, string> {
  const o = jsonOf(v);
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  return Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, x]) => [k, x == null ? "" : String(x)]));
}

/** Kiểm mẫu của kho theo lần nhập (mig 0085, ba-spec 45 v4) — chỉ lưu giá trị như báo cáo. */
export const IMPORT_SAMPLE_CHECK_TABLE: TableMapping<ImportSampleCheck> = {
  table: "import_sample_checks",
  localKey: "bsf.import-sample-checks.v1",
  getKey: theoId,
  // batch_id là mã nhóm của đợt đọc (không trỏ bảng nào) ⇒ không khai ở đây.
  refColumns: ["contract_id", "receipt_id", "contract_line_id", "file_id"],
  toRow: (x) => ({
    id: x.id,
    contract_id: x.contractId,
    receipt_id: x.receiptId,
    contract_line_id: x.contractLineId,
    batch_id: x.batchId,
    file_id: x.fileId,
    report_date: x.reportDate,
    sample_no: x.sampleNo,
    size: x.size,
    exporter_name: x.exporterName,
    import_date: x.importDate,
    packing: x.packing,
    production_date: x.productionDate,
    expiry_date: x.expiryDate,
    gross_weight_g: x.grossWeightG,
    net_weight_g: x.netWeightG,
    net_shortage_pct: x.netShortagePct,
    color: x.color,
    black_spot: x.blackSpot,
    odor: x.odor,
    moss_pct: x.mossPct,
    one_skin_pct: x.oneSkinPct,
    two_skin_pct: x.twoSkinPct,
    mada_pct: x.madaPct,
    size_distribution: x.sizeDistribution,
    thawing_norm: x.thawingNorm,
    preprocessing_norm: x.preprocessingNorm,
    blanching_norm: x.blanchingNorm,
    cutting_norm: x.cuttingNorm,
    surplus_norm: x.surplusNorm,
    material_to_finished_norm: x.materialToFinishedNorm,
    extra: x.extra,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    contractId: s(r.contract_id),
    receiptId: s(r.receipt_id),
    contractLineId: s(r.contract_line_id),
    batchId: s(r.batch_id),
    fileId: s(r.file_id),
    reportDate: s(r.report_date),
    sampleNo: s(r.sample_no),
    size: s(r.size),
    exporterName: s(r.exporter_name),
    importDate: s(r.import_date),
    packing: s(r.packing),
    productionDate: s(r.production_date),
    expiryDate: s(r.expiry_date),
    grossWeightG: numOrNull(r.gross_weight_g),
    netWeightG: numOrNull(r.net_weight_g),
    netShortagePct: numOrNull(r.net_shortage_pct),
    color: s(r.color),
    blackSpot: s(r.black_spot),
    odor: s(r.odor),
    mossPct: numOrNull(r.moss_pct),
    oneSkinPct: numOrNull(r.one_skin_pct),
    twoSkinPct: numOrNull(r.two_skin_pct),
    madaPct: numOrNull(r.mada_pct),
    sizeDistribution: parseLinePrices(r.size_distribution),
    thawingNorm: numOrNull(r.thawing_norm),
    preprocessingNorm: numOrNull(r.preprocessing_norm),
    blanchingNorm: numOrNull(r.blanching_norm),
    cuttingNorm: numOrNull(r.cutting_norm),
    surplusNorm: numOrNull(r.surplus_norm),
    materialToFinishedNorm: numOrNull(r.material_to_finished_norm),
    extra: parseTextMap(r.extra),
    note: s(r.note),
    createdAt: s(r.created_at),
  }),
};

/* ---------- Phòng Kế hoạch · Lệnh sản xuất (mig 0088, ba-spec 48) ---------- */
// Liên kết mềm như Xuất khẩu / Nhập khẩu ⇒ khai refColumns. `contract_line_id` là id dòng trong JSON `lines`
// của bản HĐ xuất (không phải khóa bảng) ⇒ miễn ở demoForeignKeys.test.ts.

const ORDER_STATUS_VALUES = new Set(["draft", "issued", "cancelled"]);

function parseRequirements(v: unknown): ProductionOrderRequirements {
  const o = (jsonOf(v) ?? {}) as Record<string, unknown>;
  const ready = s(o.packagingReady);
  return {
    packagingReady: ready === "ready" || ready === "pending" ? ready : "",
    cartonLayers: s(o.cartonLayers),
    strapNote: s(o.strapNote),
    peBagNote: s(o.peBagNote),
    cartonMarking: s(o.cartonMarking),
    bagMarking: s(o.bagMarking),
    nafiTests: Array.isArray(o.nafiTests) ? o.nafiTests.map(s).filter(Boolean) : [],
    nafiNote: s(o.nafiNote),
    processNote: s(o.processNote),
  };
}

function parseDateList(v: unknown): string[] {
  const o = jsonOf(v);
  return Array.isArray(o) ? o.map((x) => s(x).slice(0, 10)).filter(Boolean) : [];
}

export const PRODUCTION_ORDER_TABLE: TableMapping<ProductionOrder> = {
  table: "production_orders",
  localKey: "bsf.production-orders.v1",
  getKey: theoId,
  refColumns: ["contract_id", "contract_revision_id", "stale_ack_revision_id"],
  toRow: (x) => ({
    id: x.id,
    order_no: x.orderNo,
    order_date: dateOrNull(x.orderDate),
    contract_id: x.contractId,
    contract_revision_id: x.contractRevisionId,
    contract_no: x.contractNo,
    customer_name: x.customerName,
    market: x.market,
    lot_code: x.lotCode,
    production_dates: x.productionDates,
    delivery_date: dateOrNull(x.deliveryDate),
    shelf_life_months: x.shelfLifeMonths,
    requirements: x.requirements,
    note: x.note,
    status: x.status,
    issued_at: x.issuedAt || null,
    issued_by: x.issuedBy,
    revision_no: x.revisionNo,
    revision_reason: x.revisionReason,
    cancel_reason: x.cancelReason,
    stale_ack_revision_id: x.staleAckRevisionId,
    stale_ack_reason: x.staleAckReason,
    created_by: x.createdBy,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    orderNo: s(r.order_no),
    orderDate: s(r.order_date).slice(0, 10),
    contractId: s(r.contract_id),
    contractRevisionId: s(r.contract_revision_id),
    contractNo: s(r.contract_no),
    customerName: s(r.customer_name),
    market: s(r.market),
    lotCode: s(r.lot_code),
    productionDates: parseDateList(r.production_dates),
    deliveryDate: s(r.delivery_date).slice(0, 10),
    shelfLifeMonths: numOrNull(r.shelf_life_months) ?? 24,
    requirements: parseRequirements(r.requirements),
    note: s(r.note),
    status: (ORDER_STATUS_VALUES.has(s(r.status)) ? s(r.status) : "draft") as ProductionOrder["status"],
    issuedAt: s(r.issued_at),
    issuedBy: s(r.issued_by),
    revisionNo: numOrNull(r.revision_no) ?? 0,
    revisionReason: s(r.revision_reason),
    cancelReason: s(r.cancel_reason),
    staleAckRevisionId: s(r.stale_ack_revision_id),
    staleAckReason: s(r.stale_ack_reason),
    createdBy: s(r.created_by),
    createdAt: s(r.created_at),
  }),
};

export const PRODUCTION_ORDER_LINE_TABLE: TableMapping<ProductionOrderLine> = {
  table: "production_order_lines",
  localKey: "bsf.production-order-lines.v1",
  getKey: theoId,
  refColumns: ["order_id", "product_id"],
  toRow: (x) => ({
    id: x.id,
    order_id: x.orderId,
    line_no: x.lineNo,
    contract_line_id: x.contractLineId,
    product_id: x.productId,
    product_name: x.productName,
    description: x.description,
    spec: x.spec,
    unit_kind: x.unitKind,
    cartons_per_unit: x.cartonsPerUnit,
    net_kg_per_carton: x.netKgPerCarton,
    units: x.units,
    kg: x.kg,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    orderId: s(r.order_id),
    lineNo: numOrNull(r.line_no) ?? 1,
    contractLineId: s(r.contract_line_id),
    productId: s(r.product_id),
    productName: s(r.product_name),
    description: s(r.description),
    spec: s(r.spec),
    unitKind: s(r.unit_kind) === "bundle" ? "bundle" : "carton",
    cartonsPerUnit: numOrNull(r.cartons_per_unit) ?? 1,
    netKgPerCarton: numOrNull(r.net_kg_per_carton),
    units: numOrNull(r.units),
    kg: numOrNull(r.kg),
    note: s(r.note),
  }),
};

export const PRODUCTION_ORDER_MATERIAL_TABLE: TableMapping<ProductionOrderMaterial> = {
  table: "production_order_materials",
  localKey: "bsf.production-order-materials.v1",
  getKey: theoId,
  refColumns: ["order_id", "order_line_id", "receipt_id", "import_line_id"],
  toRow: (x) => ({
    id: x.id,
    order_id: x.orderId,
    order_line_id: x.orderLineId,
    receipt_id: x.receiptId,
    import_line_id: x.importLineId,
    label: x.label,
    kg: x.kg,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    orderId: s(r.order_id),
    orderLineId: s(r.order_line_id),
    receiptId: s(r.receipt_id),
    importLineId: s(r.import_line_id),
    label: s(r.label),
    kg: numOrNull(r.kg),
  }),
};

export const PRODUCTION_ORDER_SHIPMENT_TABLE: TableMapping<ProductionOrderShipment> = {
  table: "production_order_shipments",
  localKey: "bsf.production-order-shipments.v1",
  getKey: theoId,
  refColumns: ["order_id", "shipment_id"],
  toRow: (x) => ({ id: x.id, order_id: x.orderId, shipment_id: x.shipmentId }),
  fromRow: (r) => ({ id: s(r.id), orderId: s(r.order_id), shipmentId: s(r.shipment_id), createdAt: s(r.created_at) }),
};

/* ---------- Hóa đơn đại lý gắn chuyến (mig 0090, ba-spec 51) ---------- */

export const SUPPLIER_INVOICE_TABLE: TableMapping<SupplierInvoice> = {
  table: "supplier_invoices",
  localKey: "bsf.supplier-invoices.v1",
  getKey: theoId,
  toRow: (x) => ({
    id: x.id,
    supplier_name: x.supplierName,
    accounting_code: x.accountingCode,
    invoice_no: x.invoiceNo,
    invoice_year: x.invoiceYear,
    invoice_symbol: x.invoiceSymbol,
    issue_date: x.issueDate || null,
    posting_date: x.postingDate || null,
    voucher_no: x.voucherNo,
    seller_tax_id: x.sellerTaxId,
    subtotal: x.subtotal,
    vat_amount: x.vatAmount,
    total_amount: x.totalAmount,
    classification: x.classification,
    classification_note: x.classificationNote,
    pdf_lines: x.pdfLines,
    file_path: x.filePath,
    file_name: x.fileName,
    note: x.note,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    supplierName: s(r.supplier_name),
    accountingCode: s(r.accounting_code),
    invoiceNo: s(r.invoice_no),
    invoiceYear: Number(r.invoice_year ?? 0),
    invoiceSymbol: s(r.invoice_symbol),
    issueDate: s(r.issue_date).slice(0, 10),
    postingDate: s(r.posting_date).slice(0, 10),
    voucherNo: s(r.voucher_no),
    sellerTaxId: s(r.seller_tax_id),
    subtotal: numOrNull(r.subtotal),
    vatAmount: numOrNull(r.vat_amount),
    totalAmount: numOrNull(r.total_amount),
    classification: s(r.classification) === "not-trip" ? "not-trip" : "trip",
    classificationNote: s(r.classification_note),
    pdfLines: Array.isArray(r.pdf_lines) ? (r.pdf_lines as SupplierInvoice["pdfLines"]) : [],
    filePath: s(r.file_path),
    fileName: s(r.file_name),
    note: s(r.note),
  }),
};

export const SUPPLIER_INVOICE_LINE_TABLE: TableMapping<SupplierInvoiceLine> = {
  table: "supplier_invoice_lines",
  localKey: "bsf.supplier-invoice-lines.v1",
  getKey: theoId,
  // trip_line_id → material_imports.id (mềm). row_key là khóa dòng trong file, không trỏ bảng nào.
  refColumns: ["invoice_id", "trip_line_id"],
  toRow: (x) => ({
    id: x.id,
    invoice_id: x.invoiceId,
    delivery_date: x.deliveryDate || null,
    material_code: x.materialCode,
    quantity_kg: x.quantityKg,
    unit_price: x.unitPrice,
    amount: x.amount,
    driver_name: x.driverName,
    license_plate: x.licensePlate,
    row_key: x.rowKey,
    trip_line_id: x.tripLineId,
    resolution: x.resolution,
    resolution_reason: x.resolutionReason,
    resolved_by: x.resolvedBy,
    resolved_at: x.resolvedAt,
    missing_from_file: x.missingFromFile,
  }),
  fromRow: (r) => {
    const resolution = s(r.resolution);
    return {
      id: s(r.id),
      invoiceId: s(r.invoice_id),
      deliveryDate: s(r.delivery_date).slice(0, 10),
      materialCode: s(r.material_code),
      quantityKg: Number(r.quantity_kg ?? 0),
      unitPrice: Number(r.unit_price ?? 0),
      amount: Number(r.amount ?? 0),
      driverName: s(r.driver_name),
      licensePlate: s(r.license_plate),
      rowKey: s(r.row_key),
      tripLineId: s(r.trip_line_id),
      resolution: resolution === "updated" || resolution === "explained" ? resolution : "",
      resolutionReason: s(r.resolution_reason),
      resolvedBy: s(r.resolved_by),
      resolvedAt: s(r.resolved_at),
      missingFromFile: Boolean(r.missing_from_file),
    };
  },
};

export const ACCOUNTING_CODE_MAP_TABLE: TableMapping<AccountingCodeMap> = {
  table: "accounting_code_maps",
  localKey: "bsf.accounting-code-maps.v1",
  getKey: theoId,
  toRow: (x) => ({ id: x.id, kind: x.kind, code: x.code, target_name: x.targetName }),
  fromRow: (r) => ({ id: s(r.id), kind: s(r.kind) === "material" ? "material" : "supplier", code: s(r.code), targetName: s(r.target_name) }),
};

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
  task_assignments: "Giao việc",
  company_documents: "Tài liệu công ty",
  document_versions: "Lần ban hành tài liệu",
  export_contracts: "Hợp đồng xuất khẩu",
  export_contract_revisions: "Bản hợp đồng xuất khẩu",
  export_contract_approvals: "Kết quả duyệt cuối hợp đồng",
  export_deadline_extensions: "Gia hạn giao hàng",
  export_shipments: "Chuyến xuất khẩu",
  export_step_items: "Bước của chuyến xuất khẩu",
  export_files: "File hồ sơ xuất khẩu",
  export_payments: "Gửi chứng từ / tiền về",
  export_activity_log: "Nhật ký hợp đồng xuất khẩu",
  customer_product_names: "Tên hàng theo khách",
  export_document_kinds: "Loại chứng từ xuất khẩu",
  import_suppliers: "NCC nhập khẩu",
  goods_types: "Loại hàng",
  import_contracts: "Hợp đồng nhập khẩu",
  import_contract_lines: "Dòng hàng hợp đồng nhập khẩu",
  import_receipts: "Lần nhập khẩu",
  import_receipt_lines: "Số lượng thực nhập",
  import_documents: "Chứng từ nhập khẩu",
  import_files: "File hồ sơ nhập khẩu",
  import_sample_checks: "Kiểm mẫu hàng nhập khẩu",
  production_orders: "Lệnh sản xuất",
  production_order_lines: "Dòng lệnh sản xuất",
  production_order_materials: "NL nhập khẩu dự kiến của lệnh sản xuất",
  production_order_shipments: "Lệnh sản xuất gắn chuyến xuất",
  supplier_invoices: "Hóa đơn đại lý",
  supplier_invoice_lines: "Dòng hóa đơn đại lý",
  accounting_code_maps: "Ánh xạ mã kế toán",
  row_marks: "Tô màu dòng",
  app_roles: "Vai trò",
  role_permissions: "Quyền của vai trò",
  user_permissions: "Quyền riêng của người dùng",
};

/** Trường đổi giữa hai bản ghi → { trường: [trước, sau] }. */
function diffFields(a: unknown, b: unknown): Record<string, [unknown, unknown]> {
  const result: Record<string, [unknown, unknown]> = {};
  const oa = (a ?? {}) as Record<string, unknown>;
  const ob = (b ?? {}) as Record<string, unknown>;
  for (const k of new Set([...Object.keys(oa), ...Object.keys(ob)])) {
    if (JSON.stringify(oa[k]) !== JSON.stringify(ob[k])) result[k] = [oa[k], ob[k]];
  }
  return result;
}

/** Chuỗi dài hơn ngưỡng này không vào nhật ký (file base64 của bản đối soát
 *  ~2,7MB/dòng làm phình audit_log + buffer localStorage). */
const MAX_AUDIT_STRING = 10_000;
const FILE_FIELDS = new Set(["fileB64"]);

/** Thu gọn giá trị trước khi vào nhật ký: thay file / chuỗi quá dài bằng nhãn
 *  "[… ký tự — không ghi nhật ký]" (vẫn thấy là CÓ đổi, không chép nội dung). */
export function compactForAudit(v: unknown, field = ""): unknown {
  if (typeof v === "string") {
    if (v && FILE_FIELDS.has(field)) return `[file ${v.length} ký tự — không ghi nhật ký]`;
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
function logChanges<T>(mapping: TableMapping<T>, prev: T[], next: T[]): void {
  if (isAuditPaused) return;
  if (mapping.table === "audit_log") return; // không tự lưu vết chính mình
  // Tô màu dòng chỉ là dấu trình bày (đã có marked_by/marked_at) — kế toán dò cả
  // trăm dòng một buổi, ghi nhật ký từng cú tô chỉ làm ngập /audit.
  if (mapping.table === "row_marks") return;
  // Nhật ký hợp đồng xuất khẩu (mig 0079) đã LÀ nhật ký — chép sang audit_log chỉ nhân đôi.
  if (mapping.table === "export_activity_log") return;
  const label = TABLE_LABELS[mapping.table] ?? mapping.table;
  const prevByKey = new Map(prev.map((x) => [mapping.getKey(x), x]));
  const nextMap = new Map(next.map((x) => [mapping.getKey(x), x]));
  const entries: NewAuditEntry[] = [];
  for (const [k, x] of nextMap) {
    const c = prevByKey.get(k);
    if (c === undefined) {
      entries.push({ action: "create", entity: mapping.table, entityKey: k, summary: `Thêm ${label}`, diff: { _new: compactForAudit(x) } });
    } else if (JSON.stringify(c) !== JSON.stringify(x)) {
      const diff = Object.fromEntries(
        Object.entries(diffFields(c, x)).map(([f, [a, b]]) => [f, [compactForAudit(a, f), compactForAudit(b, f)]]),
      );
      entries.push({ action: "update", entity: mapping.table, entityKey: k, summary: `Sửa ${label}`, diff });
    }
  }
  for (const [k] of prevByKey) {
    if (!nextMap.has(k)) entries.push({ action: "delete", entity: mapping.table, entityKey: k, summary: `Xóa ${label}` });
  }
  appendAuditEntries(entries);
}

/* ---------- Hook ---------- */

export type LoadStatus = "loading" | "ready" | "error";

/**
 * CHỐT QUYỀN GHI (phân quyền lớp 3 — spec role-permissions §5). ShellLayout đặt hàm
 * kiểm theo quyền người đang đăng nhập; `null` = không chốt (chạy localStorage, chưa
 * đăng nhập, chưa nạp hồ sơ). Hàm trả `false` ⇒ lượt ghi bị BỎ NGUYÊN (không đổi
 * state, không vào hàng chờ, không lên máy chủ) — hàm tự báo người dùng. Chặn TRƯỚC
 * hàng chờ nên không bao giờ có dòng kẹt vì thiếu quyền.
 */
export type WriteChange = { kind: "create" | "update" | "delete"; prev?: Record<string, unknown>; next?: Record<string, unknown> };
export type WriteGuard = (table: string, changes: WriteChange[]) => boolean;
let writeGuard: WriteGuard | null = null;
export function setWriteGuard(guard: WriteGuard | null): void {
  writeGuard = guard;
}

/**
 * Đồng bộ CÙNG TAB giữa các lần gọi `useTable` của cùng một bảng. Mỗi lần gọi giữ
 * `rows` riêng: hộp con (VD gắn lô) ghi xong mà màn cha vẫn cầm bản cũ thì lần
 * ghi kế tiếp của màn cha sẽ coi dòng con vừa thêm là "đã xóa" và xóa luôn trên
 * máy chủ. Ghi xong phát sự kiện này để các bản khác nhận đúng `rows` mới — chỉ
 * cập nhật trạng thái, KHÔNG ghi lại, không đụng hàng chờ.
 */
const TABLE_CHANGE_EVENT = "bsf:bang-doi";
/** Yêu cầu các hook đang mở NẠP LẠI bảng từ máy chủ (sau một thao tác ghi thẳng trên máy chủ, VD gộp mặt hàng). */
const TABLE_RELOAD_EVENT = "bsf:table-reload";

/** Báo các bảng `tables` nạp lại từ máy chủ — bản sao dưới máy theo đúng số mới. */
export function reloadTables(tables: string[]): void {
  window.dispatchEvent(new CustomEvent(TABLE_RELOAD_EVENT, { detail: tables }));
}

/* ---------- Gộp mặt hàng trùng tên (hàm máy chủ 0069 → bản 0078, một giao dịch) ---------- */

/** Bảng có cột trỏ mặt hàng — nạp lại sau khi gộp / hoàn tác. */
export const PRODUCT_REFERENCE_TABLES = [
  "products",
  "production_wips",
  "balancing_outputs",
  "sales_items",
  "order_items",
  "export_items",
  "finished_goods_opening_stock",
  "packagings",
];

export type ProductMergeResult = { ok: true; payload: unknown; movedCount: number } | { ok: false; error: string };

/**
 * Gộp mặt hàng `dropId` vào `keepId` (cùng tên) TRÊN MÁY CHỦ — chuyển mọi dòng sổ rồi xoá
 * mục trùng trong một giao dịch (supabase/migrations/0069, bản 0078 nhận `product_id` có tiền tố
 * `demo:` ở site demo — refColumns). Chỉ chạy khi có máy chủ;
 * chế độ localStorage ⇒ màn gọi tự gộp qua các hook.
 */
export async function mergeProductsOnServer(keepId: string, dropId: string): Promise<ProductMergeResult> {
  if (!supabase) return { ok: false, error: "Chưa nối máy chủ." };
  const { data, error } = await supabase.rpc("merge_products", { p_site: SITE_ID, p_keep: keepId, p_drop: dropId });
  if (error) {
    const missing = /merge_products|function .* does not exist|PGRST202/i.test(`${error.code} ${error.message}`);
    return { ok: false, error: missing ? "Máy chủ chưa có hàm gộp (chạy migration 0069)." : error.message };
  }
  const moved = ((data as { moved?: Record<string, unknown[]> } | null)?.moved ?? {}) as Record<string, unknown[]>;
  reloadTables(PRODUCT_REFERENCE_TABLES);
  return { ok: true, payload: data, movedCount: Object.values(moved).reduce((n, ids) => n + ids.length, 0) };
}

/** Hoàn tác một lần gộp (payload trả về từ `mergeProductsOnServer`). */
export async function undoProductMergeOnServer(payload: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Chưa nối máy chủ." };
  const { error } = await supabase.rpc("undo_merge_products", { p_site: SITE_ID, p_payload: payload });
  if (error) return { ok: false, error: error.message };
  reloadTables(PRODUCT_REFERENCE_TABLES);
  return { ok: true };
}

export { hasSupabase as isServerConnected };
type TableChangeEvent = { localKey: string; source: string; rows: unknown[] };

export function useTable<T>(mapping: TableMapping<T>, seed: () => T[] = () => []) {
  const keyColumn = mapping.primaryKey ?? "id";
  const patch = mapping.patchLegacy;
  const loadLocal = (key: string) => {
    const xs = load<T>(key);
    return patch ? xs.map(patch) : xs;
  };

  const [rows, setRows] = useState<T[]>(() => {
    const existing = loadLocal(mapping.localKey);
    if (existing.length > 0) return existing;
    const s0 = seed();
    if (s0.length > 0 && !hasSupabase) save(mapping.localKey, s0);
    return s0;
  });
  const [status, setStatus] = useState<LoadStatus>(
    hasSupabase ? "loading" : "ready"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const prevRows = useRef<T[]>(rows);
  prevRows.current = rows;
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  /** Báo kết quả một lượt server lên hook + đèn kết nối ("lần gần nhất thắng"). */
  const reportResult = useCallback((result: { ok: boolean; msg?: string }, fallback: string) => {
    if (result.ok) {
      setLoadError(null);
      setStatus("ready");
      connectivity.reportOk();
    } else {
      const msg = result.msg ?? fallback;
      setStatus("error");
      setLoadError(msg);
      connectivity.reportError(msg);
    }
  }, []);

  /* Nhận bản mới từ lần gọi khác của cùng bảng (xem SU_KIEN_BANG). */
  useEffect(() => {
    const label = (e: Event) => {
      const d = (e as CustomEvent<TableChangeEvent>).detail;
      if (!d || d.localKey !== mapping.localKey || d.source === instanceId) return;
      prevRows.current = d.rows as T[];
      setRows(d.rows as T[]);
    };
    window.addEventListener(TABLE_CHANGE_EVENT, label);
    return () => window.removeEventListener(TABLE_CHANGE_EVENT, label);
  }, [mapping.localKey, instanceId]);

  /* Nạp từ máy chủ — lúc mở, và NẠP LẠI khi quay lại tab (máy khác có thể vừa
     sửa); có mạng lại thì đẩy hàng chờ. Cùng một đường hoà server + hàng chờ. */
  useEffect(() => {
    const db = supabase;
    if (!db) return;
    let isCancelled = false;
    let isLoading = false;
    let lastLoadAt = 0;

    const load = async (isFirstLoad: boolean) => {
      if (isLoading) return;
      isLoading = true;
      try {
        // Có lần ghi xen giữa lúc đang tải ⇒ bản tải về đã cũ (có thể thiếu dòng
        // vừa lên server rồi ra khỏi hàng chờ) ⇒ tải lại, tối đa 3 lần.
        for (let lan = 0; lan < 3; lan++) {
          const gen0 = writeCounts.get(mapping.localKey) ?? 0;
          // Nạp THEO TRANG: PostgREST mặc định trả tối đa 1000 dòng/‌lần. Bảng lớn
          // (VD sổ kho theo tháng >1000 dòng) sẽ bị cắt cụt nếu chỉ select một phát.
          // Lặp .range() tới khi trang trả về ít hơn cỡ trang → lấy đủ mọi dòng.
          const PAGE_SIZE = 1000;
          const rawRows: Record<string, unknown>[] = [];
          for (let fromDate = 0; ; fromDate += PAGE_SIZE) {
            const { data, error } = await db
              .from(mapping.table)
              .select("*")
              .eq("site_id", SITE_ID)
              .order(keyColumn)
              .range(fromDate, fromDate + PAGE_SIZE - 1);
            if (isCancelled) return;
            if (error) {
              reportResult({ ok: false, msg: error.message }, error.message);
              return;
            }
            const page = data ?? [];
            for (const r of page) rawRows.push(r as Record<string, unknown>);
            if (page.length < PAGE_SIZE) break;
          }
          // Bỏ tiền tố khóa demo; dòng không thuộc chế độ này (null) bỏ qua.
          const may = rawRows
            .map((r) => rowFromServer(r, keyColumn, undefined, mapping.refColumns))
            .filter((r): r is Record<string, unknown> => r != null)
            .map((r) => mapping.fromRow(r));

          // Bảng rỗng lần đầu + máy này cũng chưa có gì → đẩy seed lên danh mục.
          if (isFirstLoad && may.length === 0) {
            const cho0 = loadQueue(mapping.localKey);
            const prevLocal = loadLocal(mapping.localKey);
            const isEmpty =
              prevLocal.length === 0 && cho0.them.length === 0 && cho0.xoa.length === 0;
            if (isEmpty) {
              const s0 = seed();
              if (s0.length > 0) {
                const { error: e2 } = await db
                  .from(mapping.table)
                  .upsert(
                    s0.map((x) => rowToServer(mapping.toRow(x), keyColumn, SITE_ID, undefined, mapping.refColumns)),
                    { onConflict: keyColumn }
                  );
                if (isCancelled) return;
                if (e2) {
                  reportResult({ ok: false, msg: e2.message }, e2.message);
                  return;
                }
                prevRows.current = s0;
                setRows(s0);
                latestSnapshot.set(mapping.localKey, s0);
                save(mapping.localKey, s0);
                lastLoadAt = Date.now();
                reportResult({ ok: true }, "");
                return;
              }
            }
          }

          if (lan < 2 && (writeCounts.get(mapping.localKey) ?? 0) !== gen0) continue;

          /* HOÀ server với dòng local CHƯA đồng bộ — KHÔNG đè mù, nếu không reload
             sẽ nuốt chuyến hàng ghi hụt (dòng chỉ có dưới máy, chưa lên server).
             Bản dưới máy = bản trong tab (mới nhất) nếu có, không thì bản sao. */
          const local =
            (latestSnapshot.get(mapping.localKey) as T[] | undefined) ?? loadLocal(mapping.localKey);
          const pushResult = mergeServerAndLocal(
            may,
            local,
            loadQueue(mapping.localKey),
            mapping.getKey,
            mapping.uncachedFields,
          );
          prevRows.current = pushResult;
          setRows(pushResult);
          latestSnapshot.set(mapping.localKey, pushResult);
          const okMay = saveLocalCopy(mapping, pushResult);
          lastLoadAt = Date.now();

          // Thử đẩy hàng chờ lên server ngay khi vừa nối được.
          const result = await syncQueueFor(mapping, keyColumn, pushResult);
          if (isCancelled) return;
          reportResult(result.ok && !okMay ? { ok: false, msg: STORAGE_FULL_ERROR } : result, "Lỗi đồng bộ máy chủ");
          return;
        }
      } finally {
        isLoading = false;
      }
    };

    void load(true);

    // Có thao tác ghi thẳng trên máy chủ (VD gộp mặt hàng) ⇒ nạp lại ngay bảng liên quan.
    const onReloadRequest = (e: Event) => {
      const tables = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(tables) && tables.includes(mapping.table)) void load(false);
    };
    window.addEventListener(TABLE_RELOAD_EVENT, onReloadRequest);

    // Quay lại tab sau ≥30 giây ⇒ nạp lại (máy khác có thể đã sửa/xóa dòng).
    const onTabVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadAt > 30_000)
        void load(false);
    };
    // Vừa có mạng lại ⇒ đẩy hàng chờ (trước đây phải đợi lần ghi/mở app kế tiếp).
    const onOnline = () => {
      void syncQueueFor(mapping, keyColumn, prevRows.current).then((result) => {
        if (!isCancelled) reportResult(result, "Lỗi đồng bộ máy chủ");
      });
    };
    document.addEventListener("visibilitychange", onTabVisible);
    window.addEventListener("online", onOnline);
    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", onTabVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(TABLE_RELOAD_EVENT, onReloadRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping.table]);

  const write = useCallback(
    (next: T[]): boolean => {
      const prev = prevRows.current;

      // Diff MỘT lần — dùng chung cho chốt quyền và hàng chờ.
      const prevByKey = new Map(prev.map((x) => [mapping.getKey(x), x]));
      const newKeys = new Set(next.map((x) => mapping.getKey(x)));
      const upserted = next.filter((x) => {
        const c = prevByKey.get(mapping.getKey(x));
        return !c || JSON.stringify(c) !== JSON.stringify(x);
      });
      const deleted = prev.filter((x) => !newKeys.has(mapping.getKey(x)));

      if (writeGuard && (upserted.length || deleted.length)) {
        const asRow = (x: T | undefined) => x as unknown as Record<string, unknown> | undefined;
        const changes: WriteChange[] = [
          ...upserted.map((x) => {
            const old = prevByKey.get(mapping.getKey(x));
            return old
              ? { kind: "update" as const, prev: asRow(old), next: asRow(x) }
              : { kind: "create" as const, next: asRow(x) };
          }),
          ...deleted.map((x) => ({ kind: "delete" as const, prev: asRow(x) })),
        ];
        if (!writeGuard(mapping.table, changes)) return false;
      }

      prevRows.current = next; // hai lần ghi liền trong cùng thao tác vẫn so đúng bản trước
      setRows(next);
      latestSnapshot.set(mapping.localKey, next);
      writeCounts.set(mapping.localKey, (writeCounts.get(mapping.localKey) ?? 0) + 1);
      window.dispatchEvent(
        new CustomEvent<TableChangeEvent>(TABLE_CHANGE_EVENT, { detail: { localKey: mapping.localKey, source: instanceId, rows: next } })
      );

      // Nhật ký thao tác — chạy cả hai chế độ (server + localStorage).
      logChanges(mapping, prev, next);

      let okCho = true;
      if (supabase) {
        const upsertKeys = upserted.map((x) => mapping.getKey(x));
        const deleteKeys = deleted.map((x) => mapping.getKey(x));

        /* Ghi vào hàng chờ TRƯỚC khi gọi server: hụt thì vẫn còn dấu để đẩy lại
           lần sau. Gộp với hàng chờ cũ nên các dòng hụt trước cũng được đẩy kèm.
           (Ghi hàng chờ trước bản sao: bản sao giữ đủ trường cho dòng đang chờ.) */
        const cho = loadQueue(mapping.localKey);
        const toAdd = new Set([...cho.them, ...upsertKeys]);
        const remove = new Set([...cho.xoa, ...deleteKeys]);
        deleteKeys.forEach((k) => toAdd.delete(k)); // vừa xóa thì thôi thêm
        upsertKeys.forEach((k) => remove.delete(k)); // thêm/sửa lại thì thôi xóa
        okCho = saveQueue(mapping.localKey, { them: [...toAdd], xoa: [...remove] }); // naming-ok: dạng hàng chờ đã LƯU (SyncQueue)
      }
      const okMay = saveLocalCopy(mapping, next) && okCho; // luôn có bản sao dưới máy

      if (!supabase) {
        // Chỉ-máy-này: bản sao là kho DUY NHẤT — ghi hụt là mất khi tải lại.
        if (!okMay) reportResult({ ok: false, msg: STORAGE_FULL_ERROR }, STORAGE_FULL_ERROR);
        return true;
      }

      void syncQueueFor(mapping, keyColumn, next).then((result) =>
        reportResult(result.ok && !okMay ? { ok: false, msg: STORAGE_FULL_ERROR } : result, "Lỗi ghi máy chủ"),
      );
      return true;
    },
    [mapping, keyColumn, instanceId, reportResult]
  );

  return [rows, write, { status, error: loadError }] as const;
}
