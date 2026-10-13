/** Kiểu đối soát xem trên màn /doi-soat (một lần chạy engine, nhiều cách xem). */
export type ReconciliationMode = "so" | "haiBan" | "kiemCong" | "cungNgay";

export const RECONCILIATION_MODES: readonly ReconciliationMode[] = ["so", "haiBan", "kiemCong", "cungNgay"];

/** Kiểu mặc định theo nội dung file: có sổ → đối chiếu sổ; có hai bản → so hai bản; còn lại → kiểm cộng. */
export function getDefaultReconciliationMode(hasLedger: boolean, hasTwoVersions: boolean): ReconciliationMode {
  if (hasLedger) return "so";
  if (hasTwoVersions) return "haiBan";
  return "kiemCong";
}
