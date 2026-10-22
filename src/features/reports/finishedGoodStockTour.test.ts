// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3 (bước theo quyền), R10 (phủ nhãn đang hiện).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildFinishedGoodStockTour } from "./finishedGoodStockTour";

const screen = readFileSync(new URL("./NxtReportScreen.tsx", import.meta.url), "utf8");
const textOf = (t: ReturnType<typeof buildFinishedGoodStockTour>) => t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");

describe("buildFinishedGoodStockTour", () => {
  it("phủ nhãn đang hiện trên trang: kỳ, thẻ dòng, cột, chỉ số (đổi nhãn ở màn mà quên lời ⇒ đỏ)", () => {
    const text = textOf(buildFinishedGoodStockTour({ canExport: true, canCreateOpening: true }));
    const labels = [
      ...PERIOD_OPTIONS.map((o) => o.label),
      "Tồn đầu khai tay",
      "Tồn âm",
      "Xuất đơn (kg)",
      "Xuất bán (kg)",
      "Đóng gói (kg)",
      "Tồn cuối (kg)",
      "Xuất (đơn+bán+gói)",
      "Tồn đầu kho",
      "Nhập kho",
      "Tồn cuối kho",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
    // Nhãn ngoài danh sách kỳ phải còn nguyên văn trên màn.
    expect(labels.slice(PERIOD_OPTIONS.length).filter((l) => !screen.includes(l))).toEqual([]);
  });

  it("không quyền ⇒ bỏ bước Xuất Excel và lời khai tồn đầu; đủ quyền ⇒ có", () => {
    const none = buildFinishedGoodStockTour({ canExport: false, canCreateOpening: false });
    expect(none.steps.some((s) => s.id === "export")).toBe(false);
    expect(textOf(none)).not.toContain("Lưu tồn đầu");
    const all = buildFinishedGoodStockTour({ canExport: true, canCreateOpening: true });
    expect(all.steps.some((s) => s.id === "export")).toBe(true);
    expect(textOf(all)).toContain("Lưu tồn đầu");
  });
});
