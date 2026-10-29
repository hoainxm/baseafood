// Bộ demo Nhập khẩu (ba-spec 45 R14): đủ các trạng thái để trình diễn, số tự đặt, file giữ chỗ.
import { describe, expect, it } from "vitest";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { contractState, monthView, receiptState, importMonth } from "./importPlanning";
import { buildImportDemo } from "./importPlanningDemo";

describe("bộ demo Nhập khẩu", () => {
  const d = buildImportDemo("2026-10-29");
  it("đủ 3 trạng thái lô + một HĐ đã đóng", () => {
    const states = d.receipts.map((r) => receiptState(d, r));
    expect(new Set(states)).toEqual(new Set(["complete", "missing-docs", "awaiting-quantity"]));
    expect(d.contracts.map((c) => contractState(d, c))).toEqual(["receiving", "receiving", "closed"]);
  });
  it("mọi đối tác có trong danh mục demo, mọi file là file giữ chỗ", () => {
    const ids = new Set(d.suppliers.map((s) => s.id));
    expect(d.contracts.every((c) => ids.has(c.supplierId))).toBe(true);
    expect(d.files.every((f) => f.path.startsWith(DEMO_PLACEHOLDER_PREFIX))).toBe(true);
  });
  it("lô rơi vào tháng gần đây (tháng này có lô để xem)", () => {
    expect(monthView(d, importMonth(d.receipts[1])).stats.total).toBeGreaterThan(0);
  });
  it("xác định: cùng ngày ⇒ cùng bộ", () => {
    expect(buildImportDemo("2026-10-29")).toEqual(d);
  });
});
