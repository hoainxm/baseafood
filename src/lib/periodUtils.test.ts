import { describe, expect, it } from "vitest";
import { getViewPeriodRange, stepViewPeriod, viewPeriodLabel } from "./periodUtils";

describe("stepViewPeriod — nút lùi / tới kỳ của PeriodPicker", () => {
  it("ngày ±1, qua ranh tháng", () => {
    expect(stepViewPeriod("day", "2026-11-01", -1)).toBe("2026-10-31");
    expect(stepViewPeriod("day", "2026-12-31", 1)).toBe("2027-01-01");
  });
  it("tuần ±7", () => {
    expect(stepViewPeriod("week", "2026-11-03", 1)).toBe("2026-11-10");
  });
  it("tháng / năm về ngày đầu, không trượt khi ngày neo là 31", () => {
    expect(stepViewPeriod("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(stepViewPeriod("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(stepViewPeriod("year", "2026-11-03", -1)).toBe("2025-01-01");
  });
  it("khoảng tự chọn giữ nguyên", () => {
    expect(stepViewPeriod("custom", "2026-11-03", 1)).toBe("2026-11-03");
  });
});

describe("viewPeriodLabel", () => {
  it("nhãn theo kiểu kỳ", () => {
    const [f, t] = getViewPeriodRange("week", "2026-11-03", "", "");
    expect(viewPeriodLabel("week", f, t)).toBe("02/11/2026 – 08/11/2026");
    expect(viewPeriodLabel("month", "2026-11-01", "2026-11-30")).toBe("Tháng 11/2026");
    expect(viewPeriodLabel("year", "2026-01-01", "2026-12-31")).toBe("Năm 2026");
    expect(viewPeriodLabel("day", "2026-11-03", "2026-11-03")).toBe("03/11/2026");
    expect(viewPeriodLabel("custom", "", "")).toBe("");
  });
});
