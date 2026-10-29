// Bộ demo Nhập khẩu (ba-spec 45 R14): đủ các trạng thái để trình diễn, số tự đặt, file giữ chỗ.
import { describe, expect, it } from "vitest";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { closeGate, contractState, monthView, receiptState, importMonth, unlinkedLines } from "./importPlanning";
import { buildImportDemo } from "./importPlanningDemo";

describe("bộ demo Nhập khẩu", () => {
  const products = [
    { id: "p-oct", name: "Bạch tuộc nguyên con", category: "Bạch tuộc" },
    { id: "p-skate", name: "Cá đuối cánh", category: "Cá" },
    { id: "p-squid", name: "Mực nguyên con", category: "Mực" },
  ];
  const d = buildImportDemo("2026-10-29", products);
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
  it("v3 R20: mọi dòng hàng nối mặt hàng của danh mục demo, HĐ đã đóng không vi phạm luật đóng", () => {
    const withProducts = { ...d, products };
    expect(d.lines.map((l) => l.productId)).toEqual(["p-oct", "p-oct", "p-skate", "p-squid"]);
    expect(d.contracts.flatMap((c) => unlinkedLines(withProducts, c.id))).toHaveLength(0);
    expect(closeGate(withProducts, "imp-c1").reason).not.toBe("unlinked-lines");
  });
  it("xác định: cùng ngày ⇒ cùng bộ", () => {
    expect(buildImportDemo("2026-10-29", products)).toEqual(d);
  });
});
