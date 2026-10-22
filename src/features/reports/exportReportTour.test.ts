// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3 (bước theo quyền), R10 (phủ nhãn trạng thái).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildExportReportTour } from "./exportReportTour";

const screen = readFileSync(new URL("./OrderExportReport.tsx", import.meta.url), "utf8");
const textOf = (t: ReturnType<typeof buildExportReportTour>) => t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");

/** Nhãn trạng thái đơn đọc thẳng từ hằng số STATUS_LABELS của màn (khuôn AC-10). */
function statusLabels(): string[] {
  const block = screen.match(/const STATUS_LABELS[^{]*\{([^}]*)\}/);
  if (!block) throw new Error("Không tìm thấy STATUS_LABELS trong OrderExportReport.tsx");
  return [...block[1].matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("buildExportReportTour", () => {
  it("AC-10: lời tour phủ đủ nhãn trạng thái đơn trong code (thêm trạng thái mà quên lời ⇒ đỏ)", () => {
    const labels = statusLabels();
    expect(labels.length).toBeGreaterThanOrEqual(3);
    const text = textOf(buildExportReportTour({ canExport: true }));
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("phủ nhãn đang hiện trên trang: kỳ, khách, chỉ số, dòng cộng", () => {
    const text = textOf(buildExportReportTour({ canExport: true }));
    const screenLabels = ["Tất cả khách", "Tổng xuất", "Tổng block", "Số đơn được xuất", "Cộng đơn", "TỔNG CỘNG", "(đơn đã xóa)", "Khoảng ngày xuất"];
    expect([...PERIOD_OPTIONS.map((o) => o.label), ...screenLabels].filter((l) => !text.includes(l))).toEqual([]);
    expect(screenLabels.filter((l) => !screen.includes(l))).toEqual([]);
  });

  it("không quyền xuất ⇒ bỏ bước In A4 / Xuất Excel; có quyền ⇒ có", () => {
    expect(buildExportReportTour({ canExport: false }).steps.some((s) => s.id === "export")).toBe(false);
    expect(buildExportReportTour({ canExport: true }).steps.some((s) => s.id === "export")).toBe(true);
  });
});
