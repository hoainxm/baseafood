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
): { rows: R[]; removed: number; kept: string[] } {
  const createdById = new Map(created.map((r) => [r.id, r]));
  const kept: string[] = [];
  let removed = 0;
  const rows = current.filter((r) => {
    const original = createdById.get(r.id);
    if (!original) return true;
    // Đã sửa (bút chì, gắn mã…) hoặc đã có sổ dùng ⇒ là dữ liệu người dùng rồi, giữ.
    if (!same(r, original) || isUsed?.(r)) {
      kept.push(r.name);
      return true;
    }
    removed++;
    return false;
  });
  return { rows, removed, kept };
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
    revertedLines,
    skippedLines: run.renamedLines.length - revertedLines,
  };
}
