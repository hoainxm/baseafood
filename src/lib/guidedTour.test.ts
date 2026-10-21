// Oracle: docs/app-map/43-guided-tour.ba-spec.md — AC-2 (tới / lùi bỏ qua bước tùy chọn thiếu chỗ).
import { describe, expect, it } from "vitest";
import { nextStepIndex, tourTargetSelector, type TourStep } from "./guidedTour";

const step = (id: string, over: Partial<TourStep> = {}): TourStep => ({ id, target: id, title: id, body: "", ...over });

describe("nextStepIndex", () => {
  // Bước 2 và 4 (chỉ số 1, 3) tùy chọn, chỗ không có.
  const steps = [step("a"), step("b", { optional: true }), step("c"), step("d", { optional: true }), step("e")];
  const missing = new Set(["b", "d"]);
  const has = (s: TourStep) => !missing.has(s.id);

  it("tới từ bước 1 bỏ qua bước 2 tùy chọn thiếu chỗ ⇒ bước 3", () => {
    expect(nextStepIndex(steps, 0, 1, has)).toBe(2);
  });

  it("lùi từ bước 5 bỏ qua bước 4 ⇒ bước 3", () => {
    expect(nextStepIndex(steps, 4, -1, has)).toBe(2);
  });

  it("tới từ bước cuối ⇒ hết tour (-1); lùi từ bước đầu ⇒ -1", () => {
    expect(nextStepIndex(steps, 4, 1, has)).toBe(-1);
    expect(nextStepIndex(steps, 0, -1, has)).toBe(-1);
  });

  it("bước bắt buộc thiếu chỗ KHÔNG bị bỏ (hiện lời giữa trang)", () => {
    const required = [step("a"), step("b"), step("c")];
    expect(nextStepIndex(required, 0, 1, () => false)).toBe(1);
  });

  it("bước không gắn chỗ (lời giữa trang) luôn hiện, kể cả khi đánh dấu tùy chọn", () => {
    const s = [step("a"), step("intro", { target: "", optional: true })];
    expect(nextStepIndex(s, 0, 1, () => false)).toBe(1);
  });

  it("mọi bước còn lại đều tùy chọn và thiếu chỗ ⇒ -1", () => {
    expect(nextStepIndex([step("a"), step("b", { optional: true })], 0, 1, () => false)).toBe(-1);
  });
});

describe("tourTargetSelector", () => {
  it("bọc giá trị vào thuộc tính data-tour, thoát dấu nháy", () => {
    expect(tourTargetSelector("create-contract")).toBe('[data-tour="create-contract"]');
    expect(tourTargetSelector('a"b')).toBe('[data-tour="a\\"b"]');
  });
});
