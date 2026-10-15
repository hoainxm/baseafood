import { describe, expect, test } from "vitest";
import type { MonthlyStockLine } from "@/types";
import { carryForwardIntoLedger, buildCarryForwardLines, deriveRow, idDon, propagateLotsForward, carryChainIds } from "./monthlyStock";

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

describe("propagateLotsForward — đẩy tiếp ĐÚNG lô vừa ghi sang các tháng sau đã mở", () => {
  const nov = (id: string, p: Partial<MonthlyStockLine> = {}) => row(id, "2026-11", { openCtn: 0, ...p });

  test("lô mới tháng cũ ⇒ thêm dòng dồn ở mọi tháng sau đã mở; tháng chưa mở thì dừng", () => {
    const L = row("L", "2026-10", { openKg: 0, openCtn: 0, inKg: 25, inCtn: 0 });
    const ledger = [L, nov("x"), row("y", "2026-12", { openCtn: 0 })];
    const { lines, touched } = propagateLotsForward(ledger, ["L"]);
    expect(touched).toBe(2);
    expect(lines.find((l) => l.id === idDon("L"))).toMatchObject({ period: "2026-11", openKg: 25, carriedFromId: "L" });
    expect(lines.find((l) => l.id === idDon(idDon("L")))).toMatchObject({ period: "2026-12", openKg: 25 });
    expect(lines.some((l) => l.period === "2027-01")).toBe(false);
  });

  test("dòng dồn đã có ⇒ CHỈ đổi tồn đầu (giữ nhập/xuất/ghi chú); lô khác không đụng", () => {
    const L = row("L", "2026-10", { openKg: 100, outKg: 30, openCtn: 0 });
    const cL = nov(idDon("L"), { openKg: 100, outKg: 10, note: "giữ", carriedFromId: "L" });
    const other = nov(idDon("Z"), { openKg: 999, carriedFromId: "Z" }); // tồn đầu kế toán đã chốt
    const { lines } = propagateLotsForward([L, cL, row("Z", "2026-10", { openKg: 5 }), other], ["L"]);
    expect(lines.find((l) => l.id === idDon("L"))).toMatchObject({ openKg: 70, outKg: 10, note: "giữ" });
    expect(lines.find((l) => l.id === idDon("Z"))!.openKg).toBe(999);
  });

  test("lô bị xoá ⇒ dòng dồn sạch bị bỏ cả chuỗi; dòng có số thì về 0 và giữ", () => {
    const c1 = nov(idDon("L"), { openKg: 50, carriedFromId: "L" });
    const c2 = row(idDon(idDon("L")), "2026-12", { openKg: 50, openCtn: 0, carriedFromId: idDon("L") });
    expect(propagateLotsForward([c1, c2, nov("keep")], ["L"]).lines.map((l) => l.id)).toEqual(["keep"]);
    const used = { ...c1, outKg: 5 };
    const { lines } = propagateLotsForward([used, c2], ["L"]);
    expect(lines.find((l) => l.id === idDon("L"))).toMatchObject({ openKg: 0, outKg: 5 });
    expect(lines.find((l) => l.id === idDon(idDon("L")))!.openKg).toBe(-5);
  });

  test("đã khớp ⇒ không đổi gì (chạy lại idempotent); carryChainIds liệt kê chuỗi", () => {
    const L = row("L", "2026-10", { openKg: 40, openCtn: 0 });
    const once = propagateLotsForward([L, nov("x")], ["L"]).lines;
    const twice = propagateLotsForward(once, ["L"]);
    expect(twice.touched).toBe(0);
    expect(twice.lines).toEqual(once);
    expect(carryChainIds(once, "L")).toEqual([idDon("L")]);
  });
});
