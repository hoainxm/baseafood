// ============================================================
// Tên file: src/lib/monthlyStockCatalogSync.ts
// Tên tiếng Việt: Ghi lại + hoàn tác một lần "Đồng bộ danh mục" của Sổ kho theo tháng
// Description: Pure helpers: rename ledger rows for a catalog-sync run (recording each
//              rename), and revert exactly what that run did — created catalog rows are
//              removed only if still untouched/unused, renames reverted only where the
//              row still carries the new name.
// ============================================================
// Rà 2026-11-06 ("thêm thừa / làm nhầm thì phải gỡ được"): một lần Đồng bộ thêm hàng loạt
// mặt hàng / loại NL và đổi tên dòng sổ — trước đây không có đường lùi (từng lọt quy cách NL
// vào danh mục mặt hàng, xem QuickProductDelete). Hoàn tác KHÔNG chụp đè cả sổ / danh mục:
// chỉ gỡ đúng phần lần đó làm, để số ai vừa gõ trong lúc toast còn hiện không mất.
// Mục lần đó tạo mà trong lúc toast còn hiện đã được DÙNG (dòng sổ mới mang tên nó, sổ khác
// trỏ tới nó) thì giữ lại — `buildCatalogSyncUsage` (rà 2026-11-06, mục 7).
import { findProductUsage, type ProductUsageSources } from "@/lib/productUsage";

export interface LedgerRename {
  /** id dòng sổ bị đổi tên. */
  id: string;
  /** Tên trước khi đồng bộ (tên trong file). */
  from: string;
  /** Tên chuẩn đồng bộ đặt vào. */
  to: string;
}

/** Mọi thứ MỘT lần đồng bộ đã ghi — đủ để gỡ lại đúng phần đó. */
export interface CatalogSyncRun<P, M> {
  createdProducts: P[];
  createdMaterials: M[];
  renamedLines: LedgerRename[];
  /**
   * Tên từng dòng sổ (id → tên) NGAY SAU lần đồng bộ — mốc để biết dòng nào là dùng MỚI
   * (thêm sau, hoặc đổi sang tên mục vừa tạo sau đó). Thiếu ⇒ không xét dòng sổ.
   */
  ledgerAtSync?: Readonly<Record<string, string>>;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Các sổ màn thấy được, để biết mục vừa tạo đã được dùng chưa. */
export interface CatalogSyncUsageSources {
  /** Sổ kho tháng hiện tại (mọi tháng). */
  ledger: readonly { id: string; itemName: string }[];
  /** Bảy sổ trỏ tới mặt hàng theo id (sản xuất, đóng gói, bán, đơn, lệnh xuất, cân đối, tồn đầu TP). */
  productSources: ProductUsageSources;
  /** Tên loại NL các sổ đang dùng (sổ nhập, kỳ cân đối, bán nội địa, tồn đầu NL — theo TÊN). */
  materialNamesInUse: readonly string[];
  /** Mặt hàng hiện có (mặt hàng gắn `materialTypeId` = đang dùng loại NL đó). */
  products: readonly { id: string; materialTypeId?: string }[];
}

/**
 * Bộ kiểm "đang được dùng" cho `revertCatalogSync`. Dòng sổ tính là dùng MỚI khi mang tên
 * mục (không phân hoa thường / khoảng trắng) mà lúc đồng bộ chưa mang tên đó — dòng vốn đã
 * mang tên ấy trước khi đồng bộ (tên file = tên chuẩn) không giữ mục lại.
 */
export function buildCatalogSyncUsage<P extends CatalogRow, M extends CatalogRow>(
  run: Pick<CatalogSyncRun<P, M>, "ledgerAtSync">,
  sources: CatalogSyncUsageSources
): { product: (p: P) => boolean; material: (m: M) => boolean } {
  const baseline = run.ledgerAtSync;
  const ledgerUses = (name: string) => {
    if (!baseline) return false;
    const n = norm(name);
    return sources.ledger.some((l) => norm(l.itemName) === n && norm(baseline[l.id] ?? "") !== n);
  };
  const materialNames = new Set(sources.materialNamesInUse.map(norm));
  return {
    product: (p) => ledgerUses(p.name) || findProductUsage(p.id, sources.productSources).length > 0,
    material: (m) =>
      ledgerUses(m.name) || materialNames.has(norm(m.name)) || sources.products.some((x) => x.materialTypeId === m.id),
  };
}

/** Đổi tên dòng sổ theo bảng `renames` (tên file → tên chuẩn) và ghi lại từng dòng đã đổi. */
export function renameLedgerItems<L extends { id: string; itemName: string }>(
  lines: readonly L[],
  renames: ReadonlyMap<string, string>
): { lines: L[]; renamed: LedgerRename[] } {
  const renamed: LedgerRename[] = [];
  const next = lines.map((l) => {
    const to = renames.get(l.itemName);
    if (to === undefined || to === l.itemName) return l;
    renamed.push({ id: l.id, from: l.itemName, to });
    return { ...l, itemName: to };
  });
  return { lines: next, renamed };
}

export interface CatalogSyncRevert<L, P, M> {
  lines: L[];
  products: P[];
  materials: M[];
  removedProducts: number;
  removedMaterials: number;
  /** Mục do lần đồng bộ tạo nhưng đã bị sửa / đã được dùng ⇒ giữ lại (tên để báo). */
  keptProducts: string[];
  keptMaterials: string[];
  /** Trong số mục giữ lại: bao nhiêu mục giữ vì ĐANG ĐƯỢC DÙNG (còn lại là đã sửa). */
  keptInUse: number;
  revertedLines: number;
  /** Dòng đã đổi tên tiếp hoặc đã bị xóa sau lần đồng bộ ⇒ để nguyên. */
  skippedLines: number;
}

type CatalogRow = { id: string; name: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function dropUntouched<R extends CatalogRow>(
  current: readonly R[],
  created: readonly R[],
  isUsed: ((row: R) => boolean) | undefined
): { rows: R[]; removed: number; kept: string[]; inUse: number } {
  const createdById = new Map(created.map((r) => [r.id, r]));
  const kept: string[] = [];
  let removed = 0;
  let inUse = 0;
  const rows = current.filter((r) => {
    const original = createdById.get(r.id);
    if (!original) return true;
    // Đã sửa (bút chì, gắn mã…) hoặc đã có sổ dùng ⇒ là dữ liệu người dùng rồi, giữ.
    const edited = !same(r, original);
    if (edited || isUsed?.(r)) {
      kept.push(r.name);
      if (!edited) inUse++;
      return true;
    }
    removed++;
    return false;
  });
  return { rows, removed, kept, inUse };
}

/**
 * Gỡ đúng phần một lần đồng bộ đã làm, trên dữ liệu HIỆN TẠI:
 * - mục danh mục lần đó tạo: xóa nếu còn y nguyên và `isUsed` không báo đang dùng;
 * - dòng sổ lần đó đổi tên: trả tên cũ nếu dòng còn mang đúng tên mới.
 */
export function revertCatalogSync<L extends { id: string; itemName: string }, P extends CatalogRow, M extends CatalogRow>(
  current: { lines: readonly L[]; products: readonly P[]; materials: readonly M[] },
  run: CatalogSyncRun<P, M>,
  isUsed: { product?: (p: P) => boolean; material?: (m: M) => boolean } = {}
): CatalogSyncRevert<L, P, M> {
  const p = dropUntouched(current.products, run.createdProducts, isUsed.product);
  const m = dropUntouched(current.materials, run.createdMaterials, isUsed.material);
  const renameById = new Map(run.renamedLines.map((r) => [r.id, r]));
  let revertedLines = 0;
  const lines = current.lines.map((l) => {
    const r = renameById.get(l.id);
    if (!r) return l;
    if (l.itemName !== r.to) return l;
    revertedLines++;
    return { ...l, itemName: r.from };
  });
  return {
    lines,
    products: p.rows,
    materials: m.rows,
    removedProducts: p.removed,
    removedMaterials: m.removed,
    keptProducts: p.kept,
    keptMaterials: m.kept,
    keptInUse: p.inUse + m.inUse,
    revertedLines,
    skippedLines: run.renamedLines.length - revertedLines,
  };
}
