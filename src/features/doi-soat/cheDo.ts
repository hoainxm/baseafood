/** Kiểu đối soát xem trên màn /doi-soat (một lần chạy engine, nhiều cách xem). */
export type CheDo = "so" | "haiBan" | "kiemCong" | "cungNgay";

export const DS_CHE_DO: readonly CheDo[] = ["so", "haiBan", "kiemCong", "cungNgay"];

/** Kiểu mặc định theo nội dung file: có sổ → đối chiếu sổ; có hai bản → so hai bản; còn lại → kiểm cộng. */
export function cheDoMacDinh(hasLedger: boolean, hasTwoVersions: boolean): CheDo {
  if (hasLedger) return "so";
  if (hasTwoVersions) return "haiBan";
  return "kiemCong";
}
