// ============================================================
// Tên file: src/lib/balancingRemoval.ts
// Tên tiếng Việt: Gỡ dòng khỏi kỳ cân đối — "Bỏ khỏi kỳ" / xoá dòng tay
// Description: Pure planners for removing rows from a balancing period
// ============================================================
//
// VÌ SAO (rà soát 2026-11-06 "thêm thừa / làm nhầm thì phải gỡ được"): dòng HÚT từ sổ khác
// (Nhập hàng, Sản xuất, Bán hàng) chỉ gỡ được bằng toast Hoàn tác ngay sau khi hút; dòng
// thành phẩm thêm tay không xoá được; dòng nhận chuyển kỳ xoá đi thì kỳ trước vẫn đánh dấu
// "đã nhận" nên không nhận lại được. Luật chung:
//   1. Gỡ dòng hút = "Bỏ khỏi kỳ": SỔ NGUỒN GIỮ NGUYÊN (kg, giá, ngày, ghi chú không đổi);
//      chỉ gỡ liên kết kỳ (`balancingPeriodId`) mà chính lần hút đã gắn.
//   2. Kỳ NHỚ nguồn đã bỏ (`excludedSourceKeys`, mig 0110) ⇒ tự lấy / nút "Lấy n dòng" không
//      kéo lại; muốn lấy lại thì bấm "Lấy lại" (gỡ khóa).
//   3. Xoá dòng nhận chuyển kỳ ⇒ trả phần chuyển kỳ về kỳ trước (bỏ đánh dấu đã nhận).
// Các hàm ở đây THUẦN (không đọc/ghi kho) — usePeriodGrid ghi qua repo + toast Hoàn tác.

import type { BalancingInputItem, BalancingOutputItem, BalancingPeriod, MaterialImportItem, WipProductionItem } from "@/types";
import {
  getMaterialFamily,
  importExclusionKey,
  isSameMaterialFamily,
  productSpecKey,
  productionExclusionKey,
  salesExclusionKey,
  selectPeriodImports,
} from "./balancingGrid";

/** Thêm một khóa nguồn đã bỏ (không trùng). */
export function addExcludedSourceKey(keys: string[] | undefined, key: string): string[] {
  const list = keys ?? [];
  return list.includes(key) ? list : [...list, key];
}

/** Bỏ một khóa nguồn (người dùng bấm "Lấy lại"). */
export function removeExcludedSourceKey(keys: string[] | undefined, key: string): string[] {
  return (keys ?? []).filter((k) => k !== key);
}

export type ExcludedSourceKind = "imports" | "production" | "sales";

/** Tách khóa `imports:…` / `production:…` / `sales:…` để màn hiện tên + nút Lấy lại. */
export function parseExcludedSourceKey(key: string): { kind: ExcludedSourceKind; value: string } | null {
  const i = key.indexOf(":");
  if (i <= 0) return null;
  const kind = key.slice(0, i);
  if (kind !== "imports" && kind !== "production" && kind !== "sales") return null;
  return { kind, value: key.slice(i + 1) };
}

/**
 * Trả phần chuyển kỳ về kỳ trước khi xoá dòng NHẬN chuyển kỳ (dòng dựng bởi "Nhận chuyển
 * từ kỳ trước"). Dòng nhận không lưu id dòng nguồn ⇒ dò theo: dòng kỳ KHÁC có
 * `carryOverPeriodId` = kỳ này + cùng tên/mặt hàng. Còn dòng nhận khác cùng tên ở kỳ này thì
 * chỉ trả phần dư (ưu tiên dòng nguồn cùng số kg với dòng vừa xoá).
 */
function releaseCarryOverSources<T extends { id: string; periodId: string; carryOverKg?: number; carryOverPeriodId?: string; autoSource?: string }>(
  allRows: T[],
  removed: T,
  periodId: string,
  sameItem: (a: T, b: T) => boolean
): { rows: T[]; releasedIds: string[] } {
  if ((removed.carryOverKg ?? 0) <= 0 || (removed.autoSource ?? "") !== "") return { rows: allRows, releasedIds: [] };
  const candidates = allRows
    .filter((r) => r.periodId !== periodId && r.carryOverPeriodId === periodId && (r.carryOverKg ?? 0) < 0 && sameItem(r, removed))
    .sort(
      (a, b) =>
        Number(Math.abs(a.carryOverKg ?? 0) !== removed.carryOverKg) - Number(Math.abs(b.carryOverKg ?? 0) !== removed.carryOverKg)
    );
  const stillReceived = allRows.filter(
    (r) => r.periodId === periodId && r.id !== removed.id && (r.autoSource ?? "") === "" && (r.carryOverKg ?? 0) > 0 && sameItem(r, removed)
  ).length;
  const release = new Set(candidates.slice(0, Math.max(0, candidates.length - stillReceived)).map((r) => r.id));
  if (release.size === 0) return { rows: allRows, releasedIds: [] };
  return { rows: allRows.map((r) => (release.has(r.id) ? { ...r, carryOverPeriodId: "" } : r)), releasedIds: [...release] };
}

/* ---------- Khối 1 — Nguyên liệu ---------- */

export interface MaterialRowRemoval {
  kind: "imports" | "manual";
  /** Dòng `balancing_inputs` của MỌI kỳ sau khi gỡ. */
  inputs: BalancingInputItem[];
  /** Sổ nhập sau khi gỡ liên kết kỳ — `null` = không đổi gì ở sổ nhập. */
  imports: MaterialImportItem[] | null;
  /** Khóa nguồn mới của kỳ — `null` = không đổi. */
  excludedSourceKeys: string[] | null;
  /** Số chuyến nhập của họ này đang vào kỳ (để báo) — 0 với dòng tay. */
  tripCount: number;
  /** Tổng kg kỳ mất đi khi gỡ dòng này. */
  totalKg: number;
  /** Dòng kỳ trước được trả lại phần chuyển kỳ (xoá dòng nhận chuyển kỳ). */
  releasedCarryOverIds: string[];
}

/**
 * Gỡ MỘT dòng khối nguyên liệu khỏi kỳ.
 * - Dòng hút sổ nhập (`autoSource = "imports"`) = "Bỏ khỏi kỳ": bỏ MỌI dòng hút cùng họ của kỳ,
 *   gỡ `balancingPeriodId` của chuyến đã chọn tay vào kỳ (cùng họ); họ của kỳ thì ghi vào
 *   `excludedSourceKeys` để kỳ không tự lấy lại. Kg / giá / ngày của chuyến KHÔNG đổi.
 * - Dòng tay: xoá dòng; là dòng nhận chuyển kỳ ⇒ trả phần chuyển kỳ về kỳ trước.
 * Trả `null` nếu không có dòng (hoặc dòng thuộc kỳ khác).
 */
export function planRemoveMaterialRow(
  period: BalancingPeriod,
  allInputs: BalancingInputItem[],
  allImports: MaterialImportItem[],
  rowId: string
): MaterialRowRemoval | null {
  const row = allInputs.find((r) => r.id === rowId && r.periodId === period.id);
  if (!row) return null;
  if (row.autoSource === "imports") {
    const family = getMaterialFamily(row.name);
    const sameFamily = (name: string) => isSameMaterialFamily(name, family);
    const trips = selectPeriodImports(period, allImports).filter((r) => sameFamily(r.materialTypeName));
    let importsChanged = false;
    const imports = allImports.map((r) => {
      if (r.balancingPeriodId !== period.id || !sameFamily(r.materialTypeName)) return r;
      importsChanged = true;
      return { ...r, balancingPeriodId: "" };
    });
    return {
      kind: "imports",
      inputs: allInputs.filter((r) => !(r.periodId === period.id && r.autoSource === "imports" && sameFamily(r.name))),
      imports: importsChanged ? imports : null,
      /* Chỉ họ CỦA KỲ mới tự lấy ⇒ chỉ họ đó cần nhớ "đã bỏ". Họ khác loại (tự tick ở "Chọn dòng
         nhập") gỡ gắn kỳ là đủ — lấy lại bằng chính hộp đó, không hiện "Lấy lại" vô tác dụng. */
      excludedSourceKeys: isSameMaterialFamily(family, period.materialTypeName)
        ? addExcludedSourceKey(period.excludedSourceKeys, importExclusionKey(family))
        : null,
      tripCount: trips.length,
      totalKg: trips.reduce((s, r) => s + r.quantityKg, 0),
      releasedCarryOverIds: [],
    };
  }
  const { rows, releasedIds } = releaseCarryOverSources(allInputs, row, period.id, (a, b) => a.name === b.name);
  return {
    kind: "manual",
    inputs: rows.filter((r) => r.id !== rowId),
    imports: null,
    excludedSourceKeys: null,
    tripCount: 0,
    totalKg: row.quantityKg,
    releasedCarryOverIds: releasedIds,
  };
}

/**
 * Hoàn tác tự lấy sổ nhập (toast "Đã tự lấy n chuyến…" → Hoàn tác): bỏ các dòng vừa tự thêm và
 * ghi họ vào `excludedSourceKeys` — không ghi khóa thì effect tự lấy sẽ thêm lại ngay vòng sau.
 */
export function planUndoAutoPull(
  period: BalancingPeriod,
  allInputs: BalancingInputItem[],
  addedRowIds: string[]
): { inputs: BalancingInputItem[]; excludedSourceKeys: string[] } {
  const added = new Set(addedRowIds);
  let keys = period.excludedSourceKeys ?? [];
  for (const r of allInputs) if (added.has(r.id)) keys = addExcludedSourceKey(keys, importExclusionKey(r.name));
  return { inputs: allInputs.filter((r) => !added.has(r.id)), excludedSourceKeys: keys };
}

/* ---------- Khối 2 — Bán thành phẩm ---------- */

export interface FinishedGoodRowRemoval {
  kind: "production" | "sales" | "manual";
  /** Dòng `balancing_outputs` của MỌI kỳ sau khi gỡ. */
  outputs: BalancingOutputItem[];
  /** Sổ sản xuất sau khi gỡ liên kết kỳ — `null` = không đổi. */
  wips: WipProductionItem[] | null;
  excludedSourceKeys: string[] | null;
  /** Số dòng sổ sản xuất được trả về (chưa gắn kỳ). */
  releasedWipCount: number;
  releasedCarryOverIds: string[];
}

/**
 * Gỡ MỘT dòng khối bán thành phẩm khỏi kỳ.
 * - Dòng hút sổ sản xuất = "Bỏ khỏi kỳ": bỏ mọi dòng hút cùng mặt hàng × quy cách, gỡ
 *   `balancingPeriodId` của các dòng sổ SX đã gắn kỳ này (kg / ngày không đổi), ghi khóa để nút
 *   "Lấy n dòng từ sổ sản xuất" không hút lại.
 * - Dòng hút sổ bán = "Bỏ khỏi kỳ": bỏ dòng, ghi khóa dòng bán (sổ bán không đổi).
 * - Dòng tay (kể cả "Thêm nhanh mặt hàng"): xoá; là dòng nhận chuyển kỳ ⇒ trả về kỳ trước.
 */
export function planRemoveFinishedGoodRow(
  period: BalancingPeriod,
  allOutputs: BalancingOutputItem[],
  allWips: WipProductionItem[],
  rowId: string
): FinishedGoodRowRemoval | null {
  const row = allOutputs.find((r) => r.id === rowId && r.periodId === period.id);
  if (!row) return null;
  if (row.autoSource === "production") {
    const key = productSpecKey(row.productId, row.spec ?? "");
    let released = 0;
    const wips = allWips.map((r) => {
      if (r.balancingPeriodId !== period.id || productSpecKey(r.productId, r.spec) !== key) return r;
      released++;
      return { ...r, balancingPeriodId: "" };
    });
    return {
      kind: "production",
      outputs: allOutputs.filter(
        (r) => !(r.periodId === period.id && r.autoSource === "production" && productSpecKey(r.productId, r.spec ?? "") === key)
      ),
      wips: released > 0 ? wips : null,
      excludedSourceKeys: addExcludedSourceKey(period.excludedSourceKeys, productionExclusionKey(row.productId, row.spec ?? "")),
      releasedWipCount: released,
      releasedCarryOverIds: [],
    };
  }
  if (row.autoSource === "sales") {
    return {
      kind: "sales",
      outputs: allOutputs.filter((r) => r.id !== rowId),
      wips: null,
      excludedSourceKeys: row.salesItemId ? addExcludedSourceKey(period.excludedSourceKeys, salesExclusionKey(row.salesItemId)) : null,
      releasedWipCount: 0,
      releasedCarryOverIds: [],
    };
  }
  const { rows, releasedIds } = releaseCarryOverSources(
    allOutputs,
    row,
    period.id,
    (a, b) => a.productId === b.productId && (a.spec ?? "") === (b.spec ?? "")
  );
  return {
    kind: "manual",
    outputs: rows.filter((r) => r.id !== rowId),
    wips: null,
    excludedSourceKeys: null,
    releasedWipCount: 0,
    releasedCarryOverIds: releasedIds,
  };
}

/**
 * Mô tả những gì MẤT khi xoá một dòng thành phẩm (đưa vào ô hỏi xoá — luật: dòng có số thì
 * nói rõ mất gì). Dòng chưa có số ⇒ mảng rỗng.
 */
export function describeFinishedGoodLoss(
  row: Pick<BalancingOutputItem, "quantityKg" | "unitPrice" | "carryOverKg" | "debtKg" | "note">,
  dailyKg: number,
  formatNumber: (n: number) => string
): string[] {
  const out: string[] = [];
  if (dailyKg !== 0) out.push(`${formatNumber(dailyKg)} kg theo ngày`);
  const debt = row.debtKg ?? 0;
  const repaid = (row.carryOverKg ?? 0) - debt;
  if (repaid !== 0) out.push(`Trả ${formatNumber(repaid)} kg`);
  if (debt !== 0) out.push(`Nợ ${formatNumber(debt)} kg`);
  if (row.unitPrice != null) out.push(`đơn giá ${formatNumber(row.unitPrice)}`);
  if (row.note?.trim()) out.push("ghi chú dòng");
  return out;
}
