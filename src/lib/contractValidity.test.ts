// ba-spec 69 — AC = test.
import { describe, expect, it } from "vitest";
import { validityError, validityLabel, validityState, validityWarning } from "./contractValidity";

describe("ba-spec 69 — hạn hợp đồng", () => {
  it("AC-1 bỏ trống hạn HĐ vẫn lưu", () => {
    expect(validityError("2026-10-16", "")).toBe("");
    expect(validityError("2026-10-16", undefined)).toBe("");
  });

  it("AC-2 hạn trước ngày ký bị chặn", () => {
    expect(validityError("2026-10-16", "2026-10-01")).toContain("trước ngày ký");
    expect(validityError("2026-10-16", "2026-10-16")).toBe("");
  });

  it("AC-3 hạn giao sau hạn HĐ chỉ nhắc", () => {
    expect(validityWarning("2027-06-30", "2027-05-31")).not.toBe("");
    expect(validityWarning("2027-03-31", "2027-05-31")).toBe("");
    expect(validityWarning("2027-06-30", "")).toBe("");
  });

  it("AC-4 trạng thái hạn", () => {
    const today = "2026-11-03";
    expect(validityState("2026-11-01", today, true)).toEqual({ kind: "expired", days: 2 });
    expect(validityState("2026-11-10", today, true)).toEqual({ kind: "soon", days: 7 });
    expect(validityState("2027-05-31", today, true)).toEqual({ kind: "ok" });
    expect(validityState("2026-11-01", today, false)).toEqual({ kind: "none" });
    expect(validityState("", today, true)).toEqual({ kind: "none" });
    expect(validityLabel(validityState("2026-11-10", today, true))).toBe("Còn 7 ngày");
    expect(validityLabel(validityState("2026-11-01", today, true))).toBe("Đã hết hạn");
  });
});
