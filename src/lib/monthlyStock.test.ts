import { describe, expect, test } from "vitest";
import type { MonthlyStockLine } from "@/types";
import { carryForwardIntoLedger, buildCarryForwardLines, deriveRow } from "./monthlyStock";

const row = (id: string, period: string, p: Partial<MonthlyStockLine> = {}): MonthlyStockLine => ({
  id,
  period,
  category: "Nguyên liệu nhập khẩu",
  warehouse: "Kho 1500 tấn",
  itemName: "SANMA",
  size: "",
  origin: "INV1",
  importDate: "2026-08-01",
  storageLocation: "",
  kgPerCtn: 10,
  unitPrice: 50000,
  openCtn: 100,
  openKg: 1000,
  inCtn: 0,
  inKg: 0,
  outCtn: 0,
  outKg: 0,
  carriedFromId: "",
  sortOrder: 1,
  note: "",
  ...p,
});

const findLine = (items: MonthlyStockLine[], id: string) => items.find((l) => l.id === id);

describe("carryForwardIntoLedger — dồn lại không xoá trắng số tháng sau (#26)", () => {
  test("ca A: dồn T9→T10, ghi nhập/xuất/vị trí/ghi chú ở T10, sửa T9 rồi dồn lại ⇒ chỉ tồn đầu đổi", () => {
    const t9 = [row("X", "2026-09")];
    const lan1 = carryForwardIntoLedger(t9, "2026-10");
    expect(lan1.added).toBe(1);
    // Người dùng ghi ở T10: nhập 500, xuất xả đông 200 (Cân đối), vị trí, ghi chú vết.
    const editedLines = lan1.lines.map((l) =>
      l.id === "carry|X"
        ? { ...l, inKg: 500, outKg: 200, storageLocation: "Kho Ánh Dương", note: "⟦CĐ:d1:200⟧ Cân đối kỳ 1" }
        : l
    );
    // Quay lại T9 sửa xuất 300 rồi dồn lại.
    const editedSep = editedLines.map((l) => (l.id === "X" ? { ...l, outKg: 300 } : l));
    const lan2 = carryForwardIntoLedger(editedSep, "2026-10");
    expect(lan2.updated).toBe(1);
    expect(lan2.added).toBe(0);
    const c = findLine(lan2.lines, "carry|X")!;
    expect(c.openKg).toBe(700);
    expect(c.inKg).toBe(500);
    expect(c.outKg).toBe(200);
    expect(c.storageLocation).toBe("Kho Ánh Dương");
    expect(c.note).toContain("⟦CĐ:d1:200⟧");
    expect(lan2.lines.filter((l) => l.id === "carry|X")).toHaveLength(1);
  });

  test("ca B: dòng T9 về 0 ⇒ carry ở T10 tồn đầu 0, còn nhập thì GIỮ dòng", () => {
    const items = [
      row("X", "2026-09", { outKg: 1000, outCtn: 100 }),
      row("carry|X", "2026-10", { carriedFromId: "X", openKg: 1000, openCtn: 100, inKg: 50 }),
    ];
    const result = carryForwardIntoLedger(items, "2026-10");
    const c = findLine(result.lines, "carry|X")!;
    expect(c.openKg).toBe(0);
    expect(c.openCtn).toBe(0);
    expect(c.inKg).toBe(50);
    expect(result.zeroed).toBe(1);
  });

  test("ca B: dòng T9 bị xoá, carry ở T10 không có số nào khác ⇒ bỏ dòng", () => {
    const items = [row("carry|X", "2026-10", { carriedFromId: "X", openKg: 1000 })];
    const result = carryForwardIntoLedger(items, "2026-10");
    expect(findLine(result.lines, "carry|X")).toBeUndefined();
    expect(result.removed).toBe(1);
  });

  test("carry về 0 mà còn ghi chú ⇒ giữ (không xoá chữ người dùng gõ)", () => {
    const items = [row("carry|X", "2026-10", { carriedFromId: "X", openKg: 1000, note: "đã kiểm" })];
    const result = carryForwardIntoLedger(items, "2026-10");
    expect(findLine(result.lines, "carry|X")?.openKg).toBe(0);
  });

  test("dòng nhập tay (không phải carry) ở tháng đích không bị đụng", () => {
    const tay = row("msl|2026-10|a", "2026-10", { openKg: 77 });
    const result = carryForwardIntoLedger([row("X", "2026-09"), tay], "2026-10");
    expect(findLine(result.lines, tay.id)).toBe(tay);
  });

  test("chạy lại khi không đổi gì ⇒ giữ nguyên tham chiếu dòng (không ghi thừa)", () => {
    const a = carryForwardIntoLedger([row("X", "2026-09")], "2026-10").lines;
    const b = carryForwardIntoLedger(a, "2026-10").lines;
    expect(b).toEqual(a);
    expect(findLine(b, "carry|X")).toBe(findLine(a, "carry|X"));
  });
});

describe("carryForwardIntoLedger — phạm vi kho (#27)", () => {
  test("chỉ dồn kho đang lọc: carry của kho khác giữ nguyên dù tháng trước đã đổi", () => {
    const items = [
      row("A", "2026-09", { warehouse: "Kho 1500 tấn", outKg: 400 }),
      row("B", "2026-09", { warehouse: "Kho 1000 tấn" }),
      row("carry|A", "2026-10", { warehouse: "Kho 1500 tấn", carriedFromId: "A", openKg: 1000, inKg: 9 }),
    ];
    const result = carryForwardIntoLedger(items, "2026-10", "Kho 1000 tấn");
    expect(findLine(result.lines, "carry|A")).toBe(items[2]);
    expect(findLine(result.lines, "carry|B")?.openKg).toBe(1000);
    expect(result.rowCount).toBe(1);
  });

  test("carry mất nguồn ở kho khác phạm vi ⇒ không về 0", () => {
    const keptLine = row("carry|Z", "2026-10", { warehouse: "Kho 1500 tấn", carriedFromId: "Z", openKg: 5 });
    const result = carryForwardIntoLedger([keptLine], "2026-10", "Kho 1000 tấn");
    expect(findLine(result.lines, "carry|Z")).toBe(keptLine);
  });
});

describe("buildCarryForwardLines — lọc theo kg (#30)", () => {
  test("hết kg mà còn lẻ kiện ⇒ không dồn", () => {
    const r = deriveRow(row("X", "2026-09", { outKg: 1000, outCtn: 99.5 }));
    expect(r.closeKg).toBe(0);
    expect(r.closeCtn).toBe(0.5);
    expect(buildCarryForwardLines([r], "2026-10")).toHaveLength(0);
  });
  test("còn kg ⇒ dồn cả kg lẫn kiện", () => {
    const r = deriveRow(row("X", "2026-09", { outKg: 400, outCtn: 40 }));
    expect(buildCarryForwardLines([r], "2026-10")[0]).toMatchObject({ id: "carry|X", openKg: 600, openCtn: 60 });
  });
});
