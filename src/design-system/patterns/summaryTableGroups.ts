// ============================================================
// Tên file: src/design-system/patterns/summaryTableGroups.ts
// Tên tiếng Việt: Chia nhóm dòng cho SummaryTable (prop `groupBy`)
// Hàm THUẦN — test ở summaryTableGroups.test.ts.
// ============================================================
import type * as React from "react";

/** Chia nhóm cho `SummaryTable` (prop `groupBy`). */
export interface SummaryTableGroupBy<T> {
  /** Khoá nhóm của một dòng (VD loài "Cá"). */
  key: (row: T) => string;
  /** Thứ tự nhóm — bé đứng trước; bỏ trống ⇒ theo lần xuất hiện đầu tiên. */
  rank?: (key: string) => number;
  /** Chữ ở dòng đầu nhóm; bỏ trống ⇒ "<nhóm> · n dòng". */
  label?: (key: string, rows: T[]) => React.ReactNode;
  /** Chữ dòng cộng của nhóm; bỏ trống ⇒ "Cộng <nhóm>"; false ⇒ không có dòng cộng nhóm. */
  totalLabel?: ((key: string) => string) | false;
}

/** Tách ổn định theo nhóm (giữ thứ tự dòng trong nhóm). < 2 nhóm ⇒ null (không chia). */
export function splitGroups<T>(rows: readonly T[], groupBy: Pick<SummaryTableGroupBy<T>, "key" | "rank">): { key: string; rows: T[] }[] | null {
  const byKey = new Map<string, T[]>();
  for (const r of rows) {
    const k = groupBy.key(r);
    const list = byKey.get(k);
    if (list) list.push(r);
    else byKey.set(k, [r]);
  }
  if (byKey.size < 2) return null;
  const firstSeen = new Map([...byKey.keys()].map((k, i) => [k, i]));
  return [...byKey.keys()]
    .sort((a, b) => (groupBy.rank ? groupBy.rank(a) - groupBy.rank(b) : 0) || (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0))
    .map((key) => ({ key, rows: byKey.get(key) as T[] }));
}
