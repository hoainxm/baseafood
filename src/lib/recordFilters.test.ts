// Oracle: docs/app-map/53-filters.ba-spec.md §10 AC-1…3 (AC-4, 6 ở test màn + thử tay).
import { describe, expect, it } from "vitest";
import { ALL, activeFilterCount, countedLabel, filterRows, foldText, matchesSearch, matchesValue, statusOptions } from "./recordFilters";

describe("AC-1 — ô tra bỏ dấu, không phân hoa thường (R3)", () => {
  const names = ["Bạch tuộc cắt luộc", "Mực ống", "BẠCH TUỘC 2 da"];
  const hit = (q: string) => names.filter((n) => matchesSearch(q, n)).length;
  it("bach tuoc ⇒ 2; trống ⇒ 3; xyz ⇒ 0", () => {
    expect(hit("bach tuoc")).toBe(2);
    expect(hit("")).toBe(3);
    expect(hit("   ")).toBe(3);
    expect(hit("xyz")).toBe(0);
  });
  it("mọi từ phải có, không cần liền nhau; đ ≡ d; ghép nhiều cột", () => {
    expect(matchesSearch("tuoc luoc", "Bạch tuộc cắt luộc")).toBe(true);
    expect(matchesSearch("Đông", "dong lanh")).toBe(true);
    expect(matchesSearch("51C 123", "Xe 51C-12345", null, 0)).toBe(true);
    expect(foldText("  Đá   ĐỎ ")).toBe("da do");
  });
});

describe("AC-2 — nhiều điều kiện là AND, đếm điều kiện đang bật (R4, R6)", () => {
  const rows = [
    { c: "A", k: "Xuất khẩu" },
    { c: "A", k: "Xuất khẩu" },
    { c: "A", k: "Nội địa" },
    { c: "B", k: "Xuất khẩu" },
    { c: "B", k: "Nội địa" },
  ];
  it("khách A + kênh Xuất khẩu ⇒ 2 dòng, 2 điều kiện; bỏ lọc ⇒ 5 dòng, 0 điều kiện", () => {
    const run = (cust: string, ch: string) => filterRows(rows, [(r) => matchesValue(cust, r.c), (r) => matchesValue(ch, r.k)]);
    expect(run("A", "Xuất khẩu")).toHaveLength(2);
    expect(activeFilterCount(["A", "Xuất khẩu", ""])).toBe(2);
    expect(run(ALL, ALL)).toHaveLength(5);
    expect(activeFilterCount([ALL, ALL, "  ", false])).toBe(0);
    expect(activeFilterCount([true])).toBe(1);
  });
});

describe("AC-3 — lựa chọn trạng thái kèm số đếm (R2)", () => {
  const orders = ["collecting", "collecting", "collecting", "closed", "closed", "complete"].map((status) => ({ status }));
  const ORDER = [
    { value: "collecting", label: "Đang gom" },
    { value: "closed", label: "Đã chốt" },
    { value: "complete", label: "Đủ" },
    { value: "cancelled", label: "Đã hủy" },
  ];
  it("Tất cả 6 · đang gom 3 · đã chốt 2 · đủ 1 · đã hủy 0; chọn đã chốt ⇒ 2 dòng", () => {
    const opts = statusOptions(orders, (o) => o.status, ORDER);
    expect(Object.fromEntries(opts.map((o) => [o.label, o.count]))).toEqual({ "Tất cả": 6, "Đang gom": 3, "Đã chốt": 2, Đủ: 1, "Đã hủy": 0 });
    expect(filterRows(orders, [(o) => matchesValue("closed", o.status)])).toHaveLength(2);
    expect(countedLabel(opts[1])).toBe("Đang gom (3)");
  });
});
