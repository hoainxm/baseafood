// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R2 (thứ tự công việc), AC-5 khuôn (người không có
// quyền không bị dẫn tới chỗ ghi), R9 (gọi đúng chữ trên trang), R1 (không bước nào đổi chỗ xem / ghi).
import { describe, expect, it } from "vitest";
import { buildPackagingTour, type PackagingTourContext } from "./packagingTour";

const full: PackagingTourContext = { can: { create: true, lot: true } };

describe("buildPackagingTour", () => {
  it("đủ quyền ⇒ 6–14 bước, id không trùng, mở đầu + kết thúc là lời giữa trang, không bước nào đổi chỗ xem", () => {
    const { steps } = buildPackagingTour(full);
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.length).toBeLessThanOrEqual(14);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
    expect(steps.filter((s) => s.prepare)).toEqual([]);
  });

  it("thứ tự công việc: bộ lọc → ghi phiếu → chỉ số → sổ phiếu → gắn lô BTP (R2)", () => {
    const ids = buildPackagingTour(full).steps.map((s) => s.id);
    const at = ["filter", "add-packaging", "stats", "packaging-table", "row-lot"].map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("bước nút ghi chỉ có khi có quyền: chỉ xem ⇒ 0; đủ quyền ⇒ 2, đều tùy chọn", () => {
    const writeIds = new Set(["add-packaging", "row-lot"]);
    const pick = (c: PackagingTourContext) => buildPackagingTour(c).steps.filter((s) => writeIds.has(s.id));
    expect(pick({ can: { create: false, lot: false } })).toEqual([]);
    expect(pick(full)).toHaveLength(2);
    expect(pick(full).every((s) => s.optional)).toBe(true);
  });

  it("lời tour gọi đúng nguyên văn nhãn đang hiện trên trang", () => {
    const text = buildPackagingTour(full)
      .steps.map((s) => `${s.title}\n${s.body}`)
      .join("\n");
    const labels = [
      "Ghi phiếu đóng gói",
      "Ghi đóng gói",
      "Tồn BTP khả dụng",
      "Hao hụt",
      "BTP vào",
      "TP ra",
      "Số phiếu",
      "Tồn thành phẩm đóng gói",
      "Gắn lô BTP",
      "Lô BTP (n)",
      "Tem",
      "In tem",
      "Kho chứa TP",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });
});
