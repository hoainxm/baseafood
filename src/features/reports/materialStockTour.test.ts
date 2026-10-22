// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3 (bước theo quyền), R10 (phủ nhãn đang hiện).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildMaterialStockTour } from "./materialStockTour";

const screen = readFileSync(new URL("./MaterialNxtScreen.tsx", import.meta.url), "utf8");
const textOf = (t: ReturnType<typeof buildMaterialStockTour>) => t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");

describe("buildMaterialStockTour", () => {
  it("phủ nhãn đang hiện trên trang: kỳ, xưởng, thẻ số, thẻ dòng, cột kho đông", () => {
    const text = textOf(buildMaterialStockTour({ canCreateOpening: true }));
    const labels = [
      ...PERIOD_OPTIONS.map((o) => o.label),
      "Tất cả xưởng",
      "Tồn đầu kỳ",
      "Nhập trong kỳ",
      "Xuất SX (chờ)",
      "Bán nội địa",
      "Tồn cuối (chưa trừ SX)",
      "Tồn đầu khai tay",
      "Tồn âm",
      "Tồn theo ngày",
      "Tồn theo loại nguyên liệu",
      "Tồn cuối ngày (kg)",
      "Đông gửi (kho đông)",
      "Xả đông (kho đông)",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
    expect(labels.slice(PERIOD_OPTIONS.length).filter((l) => !screen.includes(l))).toEqual([]);
  });

  it("công thức tồn trong lời trùng công thức ghi trên màn", () => {
    const formula = "Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa";
    expect(screen).toContain(formula);
    expect(textOf(buildMaterialStockTour({ canCreateOpening: true }))).toContain(formula);
  });

  it("không quyền ⇒ không có lời khai tồn đầu; đủ quyền ⇒ có", () => {
    expect(textOf(buildMaterialStockTour({ canCreateOpening: false }))).not.toContain("Lưu tồn đầu");
    expect(textOf(buildMaterialStockTour({ canCreateOpening: true }))).toContain("Lưu tồn đầu");
  });
});
