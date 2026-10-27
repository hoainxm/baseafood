import { describe, expect, test } from "vitest";
import type { MonthlyStockLine } from "@/types";
import {
  carryForwardIntoLedger,
  buildCarryForwardLines,
  deriveRow,
  idDon,
  propagateLotsForward,
  carryChainIds,
  followTableChange,
  moveLinesToTable,
  buildSpeciesLookup,
  groupByCategory,
  moveStockRow,
  resetStockRowOrder,
  speciesRank,
} from "./monthlyStock";

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

describe("moveLinesToTable — Chuyển bảng dòng đã tick, chuỗi dồn kỳ đi theo", () => {
  const BUY = "Nguyên liệu mua ngoài";
  const OLD = "Nguyên liệu gửi đông";
  // Lô X tháng 10, đã dồn sang tháng 11 và 12; lô Y cùng bảng cũ không bị chọn.
  const ledger = () => [
    row("X", "2026-10", { category: OLD, openKg: 30, openCtn: 0 }),
    row(idDon("X"), "2026-11", { category: OLD, openKg: 30, openCtn: 0, outKg: 5, note: "giữ", carriedFromId: "X" }),
    row(idDon(idDon("X")), "2026-12", { category: OLD, openKg: 25, openCtn: 0, carriedFromId: idDon("X") }),
    row("Y", "2026-10", { category: OLD }),
    row(idDon("Y"), "2026-11", { category: OLD, carriedFromId: "Y" }),
  ];

  test("đổi bảng ⇒ dòng chọn + mọi tháng sau đã mở theo sang; số kg, ghi chú, lô khác giữ nguyên", () => {
    const before = ledger();
    const r = moveLinesToTable(before, ["X"], { category: BUY });
    expect(r).toMatchObject({ moved: 1, followed: 2 });
    for (const id of ["X", idDon("X"), idDon(idDon("X"))]) expect(findLine(r.lines, id)?.category).toBe(BUY);
    expect(findLine(r.lines, idDon("X"))).toMatchObject({ openKg: 30, outKg: 5, note: "giữ", warehouse: "Kho 1500 tấn" });
    expect(findLine(r.lines, "Y")?.category).toBe(OLD);
    expect(findLine(r.lines, idDon("Y"))?.category).toBe(OLD);
    // Tổng kg từng tháng không đổi — chỉ đổi bảng hiển thị.
    const kg = (ls: MonthlyStockLine[]) => ls.map((l) => deriveRow(l).closeKg);
    expect(kg(r.lines)).toEqual(kg(before));
  });

  test("đổi kho, bỏ trống nhóm ⇒ giữ nhóm riêng từng dòng; dồn kỳ sau đó theo kho mới", () => {
    const r = moveLinesToTable(ledger(), ["X", "Y"], { warehouse: "Kho 1000 tấn" });
    expect(r).toMatchObject({ moved: 2, followed: 3 });
    expect(r.lines.filter((l) => l.warehouse === "Kho 1000 tấn")).toHaveLength(5);
    expect(r.lines.every((l) => l.category === OLD)).toBe(true);
    // Dồn lại tháng 11 theo kho mới: dòng dồn đã có chỉ cập nhật tồn đầu, không đẻ dòng trùng ở kho cũ.
    const again = carryForwardIntoLedger(r.lines, "2026-11", "Kho 1000 tấn");
    expect(again.added).toBe(0);
    expect(again.lines.filter((l) => l.period === "2026-11" && l.warehouse === "Kho 1500 tấn")).toHaveLength(0);
  });

  test("tháng sau người dùng đã tự dời sang bảng khác ⇒ giữ, và dừng chuỗi ở đó", () => {
    const ls = ledger().map((l) => (l.id === idDon("X") ? { ...l, category: "Hàng tạm" } : l));
    const r = moveLinesToTable(ls, ["X"], { category: BUY });
    expect(r.followed).toBe(0);
    expect(findLine(r.lines, idDon("X"))?.category).toBe("Hàng tạm");
    expect(findLine(r.lines, idDon(idDon("X")))?.category).toBe(OLD);
  });

  test("đổi một trường thì chỉ trường đó đi theo; dòng tháng sau khác kho vẫn theo nhóm", () => {
    const ls = ledger().map((l) => (l.id === idDon("X") ? { ...l, warehouse: "Kho 500 tấn" } : l));
    const r = moveLinesToTable(ls, ["X"], { category: BUY, warehouse: "Kho 1000 tấn" });
    expect(findLine(r.lines, idDon("X"))).toMatchObject({ category: BUY, warehouse: "Kho 500 tấn" });
    expect(findLine(r.lines, idDon(idDon("X")))).toMatchObject({ category: BUY, warehouse: "Kho 1000 tấn" });
  });

  test("không đổi gì (cùng bảng, cùng kho, hay trống cả hai) ⇒ trả đúng mảng cũ", () => {
    const ls = ledger();
    expect(moveLinesToTable(ls, ["X"], { category: OLD, warehouse: "Kho 1500 tấn" })).toEqual({ lines: ls, moved: 0, followed: 0 });
    expect(moveLinesToTable(ls, ["X"], {}).moved).toBe(0);
    expect(followTableChange(ls, "X", { category: OLD, warehouse: "Kho 1500 tấn" }, { category: OLD, warehouse: "Kho 1500 tấn" }).lines).toBe(ls);
  });

  test("chuyển dòng tháng 11 ⇒ tháng 10 (đã qua) không đổi, tháng 12 theo", () => {
    const r = moveLinesToTable(ledger(), [idDon("X")], { category: BUY });
    expect(findLine(r.lines, "X")?.category).toBe(OLD);
    expect(findLine(r.lines, idDon(idDon("X")))?.category).toBe(BUY);
  });
});

describe("loài trong bảng — cá trên, bạch tuộc dưới; xếp dòng tuỳ chỉnh", () => {
  const T = "Hàng tạm";
  // Đúng thứ tự ghi như ảnh kế toán (bạch tuộc trước, cá xen giữa).
  const ledger = () => [
    row("b80", "2026-10", { category: T, itemName: "Bạch tuộc 2 da 80up", origin: "HỒNG PHÚ", sortOrder: 0 }),
    row("song", "2026-10", { category: T, itemName: "CÁ SÒNG", sortOrder: 1 }),
    row("b250", "2026-10", { category: T, itemName: "Bạch tuộc 2 da 250up", sortOrder: 2 }),
    row("muc", "2026-10", { category: T, itemName: "Mực ống", sortOrder: 3 }),
    row("saba", "2026-10", { category: T, itemName: "Saba", sortOrder: 4 }),
    row("mada", "2026-10", { category: T, itemName: "MADA", sortOrder: 5 }),
  ];
  const speciesOf = buildSpeciesLookup([{ name: "MADA", category: "Bạch tuộc" }, { name: "Saba", category: "Khác" }]);
  const order = (ls: MonthlyStockLine[]) => groupByCategory(ls.map(deriveRow), speciesOf)[0].rows.map((r) => r.id);

  test("mặc định: cá lên trên, bạch tuộc dưới, rồi mực; trong loài giữ thứ tự ghi", () => {
    expect(order(ledger())).toEqual(["song", "saba", "b80", "b250", "mada", "muc"]);
    expect(speciesRank("Cá")).toBeLessThan(speciesRank("Bạch tuộc"));
    expect(speciesRank("Loài gõ tay")).toBeGreaterThan(speciesRank("Bào ngư"));
    expect(speciesRank("Loài gõ tay")).toBeLessThan(speciesRank("Khác"));
  });

  test("loài: danh mục thắng đoán tên; danh mục để 'Khác' thì vẫn đoán từ tên", () => {
    expect(speciesOf("MADA")).toBe("Bạch tuộc");
    expect(speciesOf("saba")).toBe("Cá"); // danh mục 'Khác' ⇒ đoán ra cá
    expect(speciesOf("Bạch tuộc 2 da lớn (80↑)")).toBe("Bạch tuộc");
  });

  test("đưa dòng lên / xuống trong cùng loài ⇒ thứ tự mới đứng yên khi gom lại", () => {
    const shown = order(ledger());
    const moved = moveStockRow(ledger(), shown, "b250", -1, speciesOf)!;
    expect(order(moved)).toEqual(["song", "saba", "b250", "b80", "mada", "muc"]);
    // Không đụng số kg / dòng khác bảng.
    expect(moved.map((l) => deriveRow(l).closeKg)).toEqual(ledger().map((l) => deriveRow(l).closeKg));
  });

  test("không vượt ranh giới loài: dòng đầu bạch tuộc không lên được vùng cá; đầu / cuối bảng ⇒ null", () => {
    const shown = order(ledger());
    expect(moveStockRow(ledger(), shown, "b80", -1, speciesOf)).toBeNull();
    expect(moveStockRow(ledger(), shown, "saba", 1, speciesOf)).toBeNull();
    expect(moveStockRow(ledger(), shown, "song", -1, speciesOf)).toBeNull();
    expect(moveStockRow(ledger(), shown, "muc", 1, speciesOf)).toBeNull();
  });

  test("đang lọc (dòng ẩn): đổi chỗ với dòng HIỆN liền kề, dòng ẩn giữ vị trí", () => {
    const shown = order(ledger()); // song saba b80 b250 mada muc
    const visible = shown.filter((id) => id !== "b250"); // b250 bị ẩn
    const moved = moveStockRow(ledger(), shown, "mada", -1, speciesOf, visible)!;
    expect(order(moved)).toEqual(["song", "saba", "mada", "b250", "b80", "muc"]);
  });

  test("về mặc định: loài rồi tên A → Z (số trong tên so theo giá trị); gọi lại không đổi gì", () => {
    const ls = resetStockRowOrder(ledger(), ledger().map((l) => l.id), speciesOf);
    expect(order(ls)).toEqual(["song", "saba", "b80", "b250", "mada", "muc"]);
    expect(resetStockRowOrder(ls, ls.map((l) => l.id), speciesOf)).toBe(ls);
  });

  test("dồn kỳ mang thứ tự xếp sang tháng sau", () => {
    const moved = moveStockRow(ledger(), order(ledger()), "b250", -1, speciesOf)!;
    const nov = carryForwardIntoLedger(moved, "2026-11").lines.filter((l) => l.period === "2026-11");
    expect(groupByCategory(nov.map(deriveRow), speciesOf)[0].rows.map((r) => r.carriedFromId)).toEqual(["song", "saba", "b250", "b80", "mada", "muc"]);
  });
});
