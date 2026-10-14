// ============================================================
// Tên file: src/lib/legacyValues.ts
// Tên tiếng Việt tương đương: Giá trị enum cũ (tiếng Việt) → mới, đọc cả hai
// Description: Enum values STORED in the database were Vietnamese slugs
// ("cho-nhap", "dat", "quet"…). Đợt 5 of docs/spec/quy-uoc-dat-ten.md moves them
// to English. Rows already saved — on the server before migration 0059 runs, in
// a device's local cache, or in an offline sync queue — still carry the old
// value, so every READ goes through `normalize*` (repo `fromRow` + `patchLegacy`);
// every WRITE uses the new value.
// ============================================================
import type { ExportOrderStatus, LotMethod, QcResult, SalesOrderStatus, StorageKind, WipWarehouseStatus } from "@/types";

/** Bảng cũ → mới, MỘT nguồn cho code đọc và cho migration 0059 (giữ khớp). */
export const LEGACY_VALUES = {
  qcResult: { dat: "pass", tam: "conditional", "khong-dat": "fail" },
  wipStatus: { "cho-nhap": "pending", "da-nhap": "stocked" },
  salesOrderStatus: { "dang-gom": "collecting", du: "complete", dong: "closed" },
  exportOrderStatus: { mo: "open", dong: "closed" },
  storageKind: { "noi-bo": "internal", "thue-ngoai": "external" },
  lotMethod: { quet: "scan", go: "typed", chon: "picked" },
  auditAction: { them: "create", sua: "update", xoa: "delete", "dang-nhap": "login", "dang-xuat": "logout", gui: "submit" },
  /** `reconciliation_runs.options.mode` — kiểu đối soát đang xem khi lưu. */
  reconciliationMode: { so: "ledger", haiBan: "twoVersion", kiemCong: "columnSum", cungNgay: "sameDay" },
} as const satisfies Record<string, Record<string, string>>;

type Family = keyof typeof LEGACY_VALUES;

/** Giá trị đọc được (cũ hoặc mới) → giá trị mới; rỗng ⇒ `fallback`. */
function normalize<T extends string>(family: Family, value: unknown, fallback: T): T {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return fallback;
  const map = LEGACY_VALUES[family] as Record<string, string>;
  return (map[v] ?? v) as T;
}

export const normalizeQcResult = (v: unknown): QcResult => normalize("qcResult", v, "pass");
export const normalizeWipStatus = (v: unknown): WipWarehouseStatus => normalize("wipStatus", v, "pending");
export const normalizeSalesOrderStatus = (v: unknown): SalesOrderStatus =>
  normalize("salesOrderStatus", v, "collecting");
export const normalizeExportOrderStatus = (v: unknown): ExportOrderStatus => normalize("exportOrderStatus", v, "open");
export const normalizeStorageKind = (v: unknown): StorageKind => normalize("storageKind", v, "internal");
export const normalizeLotMethod = <M extends LotMethod>(v: unknown): M => normalize("lotMethod", v, "picked") as M;
/** Nhật ký thao tác: lịch sử KHÔNG sửa (append-only) ⇒ đọc dòng cũ qua đây để hiển thị. */
export const normalizeAuditAction = (v: unknown): string => normalize("auditAction", v, "");
/** Kiểu đối soát đã lưu (cũ hoặc mới) → giá trị mới; rỗng ⇒ "" (màn tự chọn mặc định). */
export const normalizeReconciliationMode = (v: unknown): string => normalize("reconciliationMode", v, "");
/** Mọi giá trị lưu được của một thao tác (mới + cũ) — để lọc nhật ký trên máy chủ, nơi dòng cũ giữ nguyên. */
export function auditActionAliases(action: string): string[] {
  const next = normalizeAuditAction(action);
  const olds = Object.entries(LEGACY_VALUES.auditAction).filter(([, v]) => v === next).map(([k]) => k);
  return [next, ...olds];
}

/**
 * TÊN TRƯỜNG cũ → mới của dữ liệu ĐÃ LƯU (bộ đệm máy, hàng chờ, jsonb trên máy chủ).
 * Đổi tên trường trong `types.ts` (2026-10-14) nhưng dòng cũ vẫn mang tên cũ ⇒ đọc qua
 * `renameLegacyFields`. Ghi luôn dùng tên mới. Cột DB không đổi (`component_rau_kg`…).
 */
export const LEGACY_FIELDS = {
  wip: { componentRauKg: "tentacleKg", componentBaoTuKg: "stomachKg" },
  reconciliationSummary: {
    soHoaDon: "invoiceCount", // naming-ok: khóa bên TRÁI của LEGACY_FIELDS là tên CŨ đã lưu — cố ý
    khop: "matched", // naming-ok
    lech: "mismatched", // naming-ok
    thieu: "missing", // naming-ok
    ganKhop: "nearMatched", // naming-ok
    soDongPm: "ledgerRowCount", // naming-ok
    pmCo: "ledgerMatched", // naming-ok
    pmThieu: "ledgerMissing", // naming-ok
    tongChenh: "totalDifference", // naming-ok
    nguong: "threshold", // naming-ok
  },
  reconciliationOptions: { soChuanTen: "ledgerSheetName", benThue: "taxSideSheets", cheDo: "mode" },
} as const satisfies Record<string, Record<string, string>>;

/** Bản sao `obj` với tên cũ chuyển sang tên mới (tên mới đã có thì giữ tên mới); bỏ khóa cũ. */
export function renameLegacyFields<T extends object>(obj: T, fields: Readonly<Record<string, string>>): T {
  if (!obj || typeof obj !== "object") return obj;
  const src = obj as Record<string, unknown>;
  if (!Object.keys(fields).some((k) => k in src)) return obj;
  const out: Record<string, unknown> = { ...src };
  for (const [oldKey, newKey] of Object.entries(fields)) {
    if (!(oldKey in out)) continue;
    if (out[newKey] === undefined) out[newKey] = out[oldKey];
    delete out[oldKey];
  }
  return out as T;
}
