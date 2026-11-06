// ============================================================
// Tên file: src/lib/nxtPeriods.ts
// Tên tiếng Việt: Gỡ kỳ sổ Xuất–Nhập–Tồn kho (xóa cả kỳ tạo nhầm + Hoàn tác)
// Description: Pure helpers to remove a whole NXT snapshot period (when no later
//              period depends on it) and to put removed rows back on undo.
// ============================================================
// Rà 2026-11-06 ("thêm thừa / làm nhầm thì phải gỡ được"): "Tạo kỳ kế tiếp" sinh một
// dòng cho MỌI mã của kỳ đang xem — tạo nhầm khoảng ngày thì trước đây chỉ xóa được
// từng dòng. Kỳ đã có kỳ SAU (cùng kho, bắt đầu muộn hơn) thì KHÔNG cho xóa: kỳ sau có
// thể đã kế thừa tồn đầu từ kỳ này — phải gỡ kỳ mới nhất trước.
import type { NxtSnapshotLine } from "@/types";

export interface NxtPeriodRef {
  warehouseCode: string;
  periodFrom: string;
  periodTo: string;
}

export interface NxtPeriodSpan {
  from: string;
  to: string;
}

type PeriodLine = Pick<NxtSnapshotLine, "id" | "warehouseCode" | "periodFrom" | "periodTo">;

const samePeriod = (l: PeriodLine, p: NxtPeriodRef) =>
  l.warehouseCode === p.warehouseCode && l.periodFrom === p.periodFrom && l.periodTo === p.periodTo;

/** Các kỳ SAU kỳ `p` của cùng kho (bắt đầu muộn hơn) — kỳ có thể đã kế thừa tồn từ `p`. Sớm → muộn. */
export function laterNxtPeriods(lines: readonly PeriodLine[], p: NxtPeriodRef): NxtPeriodSpan[] {
  const spans = new Map<string, NxtPeriodSpan>();
  for (const l of lines) {
    if (l.warehouseCode !== p.warehouseCode || samePeriod(l, p)) continue;
    if (l.periodFrom <= p.periodFrom) continue;
    spans.set(`${l.periodFrom}|${l.periodTo}`, { from: l.periodFrom, to: l.periodTo });
  }
  return [...spans.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

export interface NxtPeriodRemoval<T> {
  /** Sổ sau khi gỡ (bị chặn thì giữ nguyên). */
  kept: T[];
  /** Các dòng của kỳ bị gỡ — giữ để Hoàn tác. */
  removed: T[];
  /** Kỳ sau đang chặn việc gỡ (rỗng = gỡ được). */
  blockers: NxtPeriodSpan[];
}

/**
 * Gỡ TRỌN một kỳ (mọi dòng của kho + kỳ, không theo bộ lọc đang xem). Có kỳ sau ⇒
 * không gỡ gì, trả `blockers` để màn giải thích.
 */
export function planNxtPeriodRemoval<T extends PeriodLine>(lines: readonly T[], p: NxtPeriodRef): NxtPeriodRemoval<T> {
  const blockers = laterNxtPeriods(lines, p);
  if (blockers.length) return { kept: [...lines], removed: [], blockers };
  const removed = lines.filter((l) => samePeriod(l, p));
  const kept = lines.filter((l) => !samePeriod(l, p));
  return { kept, removed, blockers };
}

/**
 * Hoàn tác: trả các dòng đã gỡ về sổ HIỆN TẠI (không chụp đè cả sổ — số ai vừa gõ ở
 * kỳ khác vẫn còn). Dòng cùng id đã có lại (nạp lại file, tạo lại kỳ) thì để nguyên bản mới.
 */
export function restoreNxtLines<T extends { id: string }>(current: readonly T[], removed: readonly T[]): T[] {
  const present = new Set(current.map((l) => l.id));
  return [...current, ...removed.filter((l) => !present.has(l.id))];
}
