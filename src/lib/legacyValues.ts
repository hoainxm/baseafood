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
/** Mọi giá trị lưu được của một thao tác (mới + cũ) — để lọc nhật ký trên máy chủ, nơi dòng cũ giữ nguyên. */
export function auditActionAliases(action: string): string[] {
  const next = normalizeAuditAction(action);
  const olds = Object.entries(LEGACY_VALUES.auditAction).filter(([, v]) => v === next).map(([k]) => k);
  return [next, ...olds];
}
