// ============================================================
// Tên file: src/lib/legacyUrls.ts
// Tên tiếng Việt tương đương: Ánh xạ đường dẫn / tham số cũ (tiếng Việt) → mới
// Description: Route paths, `?tab=` values and query-param names were renamed to
// English (docs/spec/quy-uoc-dat-ten.md, Đợt 4). Old links keep working FOREVER:
// bookmarks, links sent over Zalo, and QR labels already printed with `?lo=`.
// Writers always produce the new form; readers accept both.
// ============================================================

/** Đường dẫn cũ → mới (không có dấu "/"). App.tsx gắn redirect cho từng khóa. */
export const LEGACY_PATHS: Readonly<Record<string, string>> = {
  "doi-soat": "reconciliation",
  "ton-kho-thang": "monthly-stock",
  "nxt-nl": "nxt-material",
  "nxt-kho": "nxt-warehouse",
  "bc-thanh-pham": "production-report",
  "bc-don-xuat": "export-report",
};

/** Tab của màn Danh mục (`/catalog?tab=…`). Tab đầu là mặc định. */
export const CATALOG_TABS = [
  "products",
  "customers",
  "suppliers",
  "import-suppliers",
  "material-types",
  "batters",
  "storage-locations",
  "document-kinds",
  "finished-goods",
] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

const LEGACY_CATALOG_TABS: Readonly<Record<string, CatalogTab>> = {
  "mat-hang": "products",
  "khach-hang": "customers",
  "dai-ly": "suppliers",
  "loai-nl": "material-types",
  "bot-tam": "batters",
  "kho-luu": "storage-locations",
  "tp-141": "finished-goods",
};

/** `?tab=` của Danh mục (mới hoặc cũ) → tab hợp lệ; không nhận ra ⇒ undefined. */
export function normalizeCatalogTab(value: string | null | undefined): CatalogTab | undefined {
  if (!value) return undefined;
  if ((CATALOG_TABS as readonly string[]).includes(value)) return value as CatalogTab;
  return LEGACY_CATALOG_TABS[value];
}

/** Tab của màn Mã lô QR (`/qr?tab=…`). */
export type QrTab = "lookup" | "stages" | "print";
const LEGACY_QR_TABS: Readonly<Record<string, QrTab>> = {
  tra: "lookup",
  "giai-doan": "stages",
  "do-phu": "stages", // tab Độ phủ cũ — đã gộp vào Theo giai đoạn
  in: "print",
};

export function normalizeQrTab(value: string | null | undefined): QrTab {
  if (value === "lookup" || value === "stages" || value === "print") return value;
  return (value && LEGACY_QR_TABS[value]) || "lookup";
}

/** Tên tham số mới → tên cũ còn phải đọc được (`lo` đã in trên tem QR thật). */
const LEGACY_PARAMS: Readonly<Record<string, string>> = {
  lot: "lo",
  approve: "duyet",
  order: "don",
  check: "kiem",
};

/** Đọc tham số theo tên MỚI, không có thì thử tên cũ. */
export function readParam(params: URLSearchParams, name: string): string | null {
  const v = params.get(name);
  if (v !== null) return v;
  const legacy = LEGACY_PARAMS[name];
  return legacy ? params.get(legacy) : null;
}
