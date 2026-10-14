/** Kiểu đối soát xem trên màn /reconciliation (một lần chạy engine, nhiều cách xem). Giá trị được LƯU
 *  trong `reconciliation_runs.options.mode` — bản lưu cũ (`so`/`haiBan`…) đọc qua lib/legacyValues. */
export type ReconciliationMode = "ledger" | "twoVersion" | "columnSum" | "sameDay";

export const RECONCILIATION_MODES: readonly ReconciliationMode[] = ["ledger", "twoVersion", "columnSum", "sameDay"];

/** Kiểu mặc định theo nội dung file: có sổ → đối chiếu sổ; có hai bản → so hai bản; còn lại → kiểm cộng. */
export function getDefaultReconciliationMode(hasLedger: boolean, hasTwoVersions: boolean): ReconciliationMode {
  if (hasLedger) return "ledger";
  if (hasTwoVersions) return "twoVersion";
  return "columnSum";
}
