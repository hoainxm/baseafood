// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3 (bước theo quyền), R10 (phủ nhãn đang hiện).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildProductionReportTour } from "./productionReportTour";

const screen = readFileSync(new URL("./DailyProductionReport.tsx", import.meta.url), "utf8");
const textOf = (t: ReturnType<typeof buildProductionReportTour>) => t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");

describe("buildProductionReportTour", () => {
  it("phủ nhãn đang hiện trên trang: kỳ, xưởng, chỉ số, dòng cộng", () => {
    const text = textOf(buildProductionReportTour({ canExport: true }));
    const screenLabels = [
      "Tất cả xưởng",
      "Tổng sản lượng",
      "Tổng block",
      "Số mặt hàng",
      "Sản lượng làm ra theo ngày",
      "Cộng xưởng",
      "TỔNG CỘNG",
      "Khoảng ngày sản xuất",
    ];
    expect([...PERIOD_OPTIONS.map((o) => o.label), ...screenLabels].filter((l) => !text.includes(l))).toEqual([]);
    expect(screenLabels.filter((l) => !screen.includes(l))).toEqual([]);
  });

  it("không quyền xuất ⇒ bỏ bước In A4 / Xuất Excel; có quyền ⇒ có", () => {
    expect(buildProductionReportTour({ canExport: false }).steps.some((s) => s.id === "export")).toBe(false);
    expect(buildProductionReportTour({ canExport: true }).steps.some((s) => s.id === "export")).toBe(true);
  });
});
