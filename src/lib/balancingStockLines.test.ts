import { describe, expect, test } from "vitest";
import type { BalancingInputItem, MonthlyStockLine } from "@/types";
import {
  DEFAULT_DEPOSIT_CATEGORY,
  depositLotCategory,
  LEGACY_FREEZE_DEPOSIT_CATEGORY,
  listDepositTargets,
  shortWarehouseLabel,
  ensureMonthOpened,
  listDepositLocationOptions,
  listThawLotOptions,
  syncMonthlyStockLedger,
  findLotLineInMonth,
  freezeDepositRowId,
  getBalancingShareInLot,
  countMonthlyStockMismatches,
  depositPriceOn,
  lastDepositPrice,
  normalizeDepositPrices,
  setDepositPriceAllDays,
  setDepositPricesOn,
  hasVaryingDepositPrices,
} from "./balancingStockLines";
import { deriveRow } from "./monthlyStock";

const lot = (id: string, period: string, p: Partial<MonthlyStockLine> = {}): MonthlyStockLine => ({
  id,
  period,
  category: "Nguyên liệu mua ngoài",
  warehouse: "Kho 1500 tấn",
  itemName: "B.TUỘC  2 DA",
  size: "",
  origin: "SBT001",
  importDate: "2026-08-12",
  storageLocation: "Kho Hồng Phú",
  kgPerCtn: null,
  unitPrice: 140000,
  openCtn: 0,
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

const stockRow = (
  id: string,
  kind: "lay" | "gui",
  daily: Record<string, number>,
  p: Partial<BalancingInputItem> = {}
): BalancingInputItem => ({
  id,
  periodId: "k1",
  groupName: "Xả đông",
  name: kind === "lay" ? "Lấy xả đông" : "Gửi đông",
  quantityKg: 0,
  unitPrice: 141000,
  ratioPercentage: null,
  sourceWarehouse: "Kho mình",
  dailyQuantities: daily,
  carryOverKg: 0,
  isReduction: kind === "gui",
  reductionWarehouseId: "",
  autoSource: "",
  ...p,
});

const ctx = { periodLabel: "Bạch tuộc 2 da 01/10/2026 – 05/10/2026", materialFamily: "Bạch tuộc 2 da" };
const stock = (l: MonthlyStockLine | null | undefined) => (l ? deriveRow(l).closeKg : NaN);

describe("ensureMonthOpened — tháng chưa mở tự kế thừa", () => {
  test("dồn qua từng tháng, id carry| tất định, chạy lại không nhân đôi", () => {
    const original = [lot("L1", "2026-08", { outKg: 200 })];
    const a = ensureMonthOpened(original, "2026-10");
    expect(a.carriedCount).toBe(2); // 08 → 09 → 10
    const t10 = a.lines.find((l) => l.period === "2026-10")!;
    expect(t10.id).toBe("carry|carry|L1");
    expect(t10.openKg).toBe(800);
    expect(ensureMonthOpened(a.lines, "2026-10")).toEqual({ lines: a.lines, carriedCount: 0 });
  });
  test("tháng đã có dòng thì để nguyên", () => {
    const items = [lot("L1", "2026-09"), lot("X", "2026-10")];
    expect(ensureMonthOpened(items, "2026-10").carriedCount).toBe(0);
  });
});

describe("findLotLineInMonth — theo chuỗi dồn kỳ", () => {
  test("tháng sau là carry|<id>", () => {
    const items = ensureMonthOpened([lot("L1", "2026-09")], "2026-10").lines;
    expect(findLotLineInMonth(items, "L1", "2026-10")?.id).toBe("carry|L1");
    expect(findLotLineInMonth(items, "L1", "2026-09")?.id).toBe("L1");
    expect(findLotLineInMonth(items, "L1", "2026-08")).toBeNull();
  });
});

describe("syncMonthlyStockLedger — Lấy xả đông = cột Xuất của lô chọn đích danh", () => {
  test("ghi xuất + vết; gõ lại số khác chỉ ghi phần chênh; xoá dòng trả lại sổ", () => {
    const s0 = [lot("L1", "2026-10", { outKg: 100 })];
    const r1 = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const a = syncMonthlyStockLedger(s0, [], [r1], ctx);
    expect(a.error).toBeNull();
    const l1 = a.lines.find((l) => l.id === "L1")!;
    expect(l1.outKg).toBe(400);
    expect(getBalancingShareInLot(l1, "d1")).toBe(300);
    expect(l1.note).toContain("lấy xả đông 300 kg");

    const r2 = { ...r1, dailyQuantities: { "2026-10-02": 300, "2026-10-03": 200 } };
    const b = syncMonthlyStockLedger(a.lines, [r1], [r2], ctx);
    expect(b.lines.find((l) => l.id === "L1")!.outKg).toBe(600);
    // Đặt lại cùng số ⇒ không đổi gì (chạy lại an toàn).
    expect(syncMonthlyStockLedger(b.lines, [r2], [r2], ctx).changed).toBe(false);

    const c = syncMonthlyStockLedger(b.lines, [r2], [], ctx);
    const l1c = c.lines.find((l) => l.id === "L1")!;
    expect(l1c.outKg).toBe(100);
    expect(l1c.note).toBe("");
  });

  test("vượt tồn lô ⇒ chặn, không ghi gì", () => {
    const s0 = [lot("L1", "2026-10", { openKg: 500 })];
    const r = stockRow("d1", "lay", { "2026-10-02": 600 }, { stockLineId: "L1" });
    const result = syncMonthlyStockLedger(s0, [], [r], ctx);
    expect(result.error).toMatch(/chỉ còn 500 kg/);
    expect(result.lines).toBe(s0);
  });

  test("chưa chọn lô mà có số ⇒ chặn", () => {
    const result = syncMonthlyStockLedger([], [], [stockRow("d1", "lay", { "2026-10-02": 5 })], ctx);
    expect(result.error).toMatch(/Chọn lô/);
  });

  test("dòng cũ có số mà chưa chọn lô KHÔNG làm kẹt lần ghi khác; chọn lô thì ghi đủ", () => {
    const prev = stockRow("d1", "lay", { "2026-10-02": 5 });
    const otherRow = stockRow("x", "lay", {}, { groupName: "Thủy sản", sourceWarehouse: "" });
    const result = syncMonthlyStockLedger([], [prev, otherRow], [prev, { ...otherRow, unitPrice: 1 }], ctx);
    expect(result.error).toBeNull();
    expect(result.changed).toBe(false);
    const s0 = [lot("L1", "2026-10")];
    const synced = syncMonthlyStockLedger(s0, [prev], [{ ...prev, stockLineId: "L1" }], ctx);
    expect(synced.lines[0].outKg).toBe(5);
  });

  test("đổi lô: trả lô cũ, ghi lô mới", () => {
    const s0 = [lot("L1", "2026-10"), lot("L2", "2026-10", { origin: "SBT002" })];
    const r1 = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const a = syncMonthlyStockLedger(s0, [], [r1], ctx).lines;
    const b = syncMonthlyStockLedger(a, [r1], [{ ...r1, stockLineId: "L2" }], ctx).lines;
    expect(b.find((l) => l.id === "L1")!.outKg).toBe(0);
    expect(b.find((l) => l.id === "L2")!.outKg).toBe(300);
  });

  test("kỳ vắt qua tháng chưa mở: tự kế thừa rồi ghi xuất vào dòng carry của lô", () => {
    const s0 = [lot("L1", "2026-09", { openKg: 1000 })];
    const r = stockRow(
      "d1",
      "lay",
      { "2026-09-30": 100, "2026-10-01": 50 },
      { stockLineId: "L1" }
    );
    const result = syncMonthlyStockLedger(s0, [], [r], ctx);
    expect(result.error).toBeNull();
    expect(result.carriedCount).toBeGreaterThan(0);
    expect(result.lines.find((l) => l.id === "L1")!.outKg).toBe(100);
    // Tháng 10 kế thừa tồn cuối tháng 9 SAU khi trừ 100 (= 900), rồi trừ 50 của tháng 10.
    expect(stock(result.lines.find((l) => l.id === "carry|L1"))).toBe(1000 - 100 - 50);
    // Thứ tự ngày trong object không quyết định kết quả.
    const dao = { ...r, dailyQuantities: { "2026-10-01": 50, "2026-09-30": 100 } };
    expect(stock(syncMonthlyStockLedger(s0, [], [dao], ctx).lines.find((l) => l.id === "carry|L1"))).toBe(850);
  });

  test("kiện theo kg/kiện của lô", () => {
    const s0 = [lot("L1", "2026-10", { kgPerCtn: 10, openCtn: 100 })];
    const r = stockRow("d1", "lay", { "2026-10-02": 30 }, { stockLineId: "L1" });
    expect(syncMonthlyStockLedger(s0, [], [r], ctx).lines[0].outCtn).toBe(3);
  });
});

describe("syncMonthlyStockLedger — Gửi đông = lô MỚI theo ngày gửi", () => {
  const warehouse = "Kho 1500 tấn|Kho Hồng Phú";
  test("mỗi ngày gửi một lô, nhóm mặc định NL mua ngoài, invoice GĐ-ngày; đổi kho đổi vị trí; xoá dòng gỡ lô", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -400, "2026-10-03": -100 }, { stockLocation: warehouse });
    const a = syncMonthlyStockLedger([lot("X", "2026-10")], [], [r], ctx);
    const l = a.lines.find((x) => x.id === freezeDepositRowId("g1", "2026-10-02"))!;
    expect(l).toMatchObject({
      period: "2026-10",
      category: DEFAULT_DEPOSIT_CATEGORY,
      warehouse: "Kho 1500 tấn",
      storageLocation: "Kho Hồng Phú",
      itemName: "Bạch tuộc 2 da",
      origin: "GĐ-20261002",
      importDate: "2026-10-02",
      inKg: 400,
      unitPrice: 141000,
    });
    expect(a.lines.filter((x) => x.id.startsWith("cd|g1|"))).toHaveLength(2);

    const r2 = { ...r, stockLocation: "Kho 1000 tấn|" };
    const b = syncMonthlyStockLedger(a.lines, [r], [r2], ctx).lines;
    expect(b.find((x) => x.id === freezeDepositRowId("g1", "2026-10-02"))).toMatchObject({
      warehouse: "Kho 1000 tấn",
      storageLocation: "",
    });

    const c = syncMonthlyStockLedger(b, [r2], [], ctx).lines;
    expect(c.some((x) => x.id.startsWith("cd|g1|"))).toBe(false);
  });

  test("chưa chọn kho mà có số ⇒ chặn", () => {
    expect(syncMonthlyStockLedger([], [], [stockRow("g1", "gui", { "2026-10-02": -5 })], ctx).error).toMatch(/Chọn kho/);
  });

  test("lấy xả đông từ chính lô gửi đông: vết không mất khi lô gửi được ghi lại", () => {
    const g = stockRow("g1", "gui", { "2026-10-02": -400 }, { stockLocation: warehouse });
    const a = syncMonthlyStockLedger([], [], [g], ctx).lines;
    const thawRow = stockRow("d1", "lay", { "2026-10-04": 150 }, { stockLineId: freezeDepositRowId("g1", "2026-10-02") });
    const b = syncMonthlyStockLedger(a, [], [thawRow], ctx).lines;
    const g2 = { ...g, unitPrice: 142000 };
    const c = syncMonthlyStockLedger(b, [g], [g2], ctx).lines;
    const freezeDepositRow = c.find((x) => x.id === freezeDepositRowId("g1", "2026-10-02"))!;
    expect(freezeDepositRow.outKg).toBe(150);
    expect(getBalancingShareInLot(freezeDepositRow, "d1")).toBe(150);
    expect(stock(freezeDepositRow)).toBe(250);
  });
});

describe("syncMonthlyStockLedger — tháng sau ĐÃ MỞ thì tồn đầu đi theo (audit 2026-10-15)", () => {
  const warehouse = "Kho 1500 tấn|Kho Hồng Phú";
  test("Gửi đông vào T10 khi T11 đã mở ⇒ T11 có tồn đầu lô gửi; bỏ gửi ⇒ dòng dồn sạch bị gỡ", () => {
    const s0 = [lot("X", "2026-10"), lot("carry|X", "2026-11", { carriedFromId: "X" })];
    const r = stockRow("g1", "gui", { "2026-10-02": -400 }, { stockLocation: warehouse });
    const a = syncMonthlyStockLedger(s0, [], [r], ctx).lines;
    const did = freezeDepositRowId("g1", "2026-10-02");
    expect(a.find((l) => l.id === `carry|${did}`)).toMatchObject({ period: "2026-11", openKg: 400 });
    const b = syncMonthlyStockLedger(a, [r], [], ctx).lines;
    expect(b.some((l) => l.id.includes(did))).toBe(false);
    expect(b.find((l) => l.id === "carry|X")!.openKg).toBe(1000); // lô khác không đụng
  });

  test("Lấy xả đông ở T10 khi T11 đã mở ⇒ tồn đầu T11 của lô giảm theo", () => {
    const s0 = [lot("L1", "2026-10"), lot("carry|L1", "2026-11", { carriedFromId: "L1" })];
    const r = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const a = syncMonthlyStockLedger(s0, [], [r], ctx);
    expect(a.changed).toBe(true);
    expect(a.lines.find((l) => l.id === "carry|L1")!.openKg).toBe(700);
    const back = syncMonthlyStockLedger(a.lines, [r], [], ctx).lines;
    expect(back.find((l) => l.id === "carry|L1")!.openKg).toBe(1000);
  });
});

describe("syncMonthlyStockLedger — Gửi đông chọn NGUYÊN LIỆU gửi (2026-10-16)", () => {
  const warehouse = "Kho 1500 tấn|Kho Hồng Phú";
  test("chọn NL ⇒ tên lô = NL đó; đổi NL ⇒ lô đổi tên; chưa chọn ⇒ tên họ NL của kỳ", () => {
    const base = stockRow("g1", "gui", { "2026-10-02": -400 }, { stockLocation: warehouse });
    const did = freezeDepositRowId("g1", "2026-10-02");
    const a = syncMonthlyStockLedger([], [], [base], ctx).lines;
    expect(a.find((l) => l.id === did)!.itemName).toBe("Bạch tuộc 2 da");
    const named = { ...base, name: "Bạch tuộc 2 da lớn (80↑)" };
    const b = syncMonthlyStockLedger(a, [base], [named], ctx);
    expect(b.changed).toBe(true);
    expect(b.lines.find((l) => l.id === did)).toMatchObject({ itemName: "Bạch tuộc 2 da lớn (80↑)", inKg: 400 });
  });
});

describe("countMonthlyStockMismatches — kiểm khớp, ghi lại sửa được", () => {
  test("sổ bị nạp đè mất xuất ⇒ báo lệch, ghi lại với truoc=[] thì khớp", () => {
    const r = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const synced = syncMonthlyStockLedger([lot("L1", "2026-10")], [], [r], ctx).lines;
    expect(countMonthlyStockMismatches(synced, [r])).toBe(0);
    const overwritten = [lot("L1", "2026-10")]; // nạp lại Excel: xuất 0, mất vết
    expect(countMonthlyStockMismatches(overwritten, [r])).toBe(1);
    const edit = syncMonthlyStockLedger(overwritten, [], [r], ctx).lines;
    expect(countMonthlyStockMismatches(edit, [r])).toBe(0);
    expect(edit[0].outKg).toBe(300);
  });
});

describe("danh sách chọn", () => {
  test("lô: còn tồn, khớp tên họ NL lên đầu, nhãn tên · invoice (không mở đầu bằng kho), dòng phụ còn kg · nhập · giá · kho", () => {
    const items = [
      lot("A", "2026-10", { itemName: "CÁ SÒNG", storageLocation: "Kho Ánh Dương" }),
      lot("B", "2026-10", { outKg: 1000 }), // hết hàng ⇒ ẩn
      lot("C", "2026-10"),
    ];
    const ch = listThawLotOptions(items, "2026-10", "Bạch tuộc 2 da");
    expect(ch.map((c) => c.value)).toEqual(["C", "A"]);
    expect(ch[0].label).toBe("B.TUỘC  2 DA · SBT001");
    // Có giá lô (giá lúc gửi với lô gửi đông) để kế toán thấy khi chọn lô lấy xả đông.
    expect(ch[0].subLabel).toMatch(/^còn 1\.000 kg · nhập 12\/08\/2026 · giá 140\.000 đ · Hồng Phú$/);
    // Lô đang chọn vẫn hiện dù đã hết.
    expect(listThawLotOptions(items, "2026-10", "Bạch tuộc 2 da", ["B"]).some((c) => c.value === "B")).toBe(true);
  });
  test("lô của tháng chưa mở: xem trước phần kế thừa (id carry|)", () => {
    expect(listThawLotOptions([lot("C", "2026-09")], "2026-10", "Bạch tuộc 2 da")[0].value).toBe("carry|C");
  });
  test("kho gửi: kho xí nghiệp + kho lưu; kho ngoài ghi vào sổ đang quản lý nó", () => {
    const ch = listDepositLocationOptions([lot("C", "2026-10")], ["Kho 1000 tấn", "Kho 1500 tấn"], ["Kho Ánh Dương"]);
    expect(ch.map((c) => c.value)).toEqual([
      "Kho 1000 tấn|",
      "Kho 1500 tấn|",
      "Kho 1500 tấn|Kho Ánh Dương",
      "Kho 1500 tấn|Kho Hồng Phú",
    ]);
  });
});

describe("Gửi đông vào BẢNG người dùng chọn (chốt 2026-10-16, bỏ nhóm riêng)", () => {
  const warehouse = "Kho 1000 tấn|";
  test("chọn nhóm ⇒ lô vào đúng nhóm; đổi nhóm ⇒ lô dời theo; giá gửi thành đơn giá lô", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -300 }, { stockLocation: warehouse, stockCategory: "Hàng tạm", unitPrice: 147267 });
    const a = syncMonthlyStockLedger([lot("X", "2026-10")], [], [r], ctx);
    const did = freezeDepositRowId("g1", "2026-10-02");
    expect(a.lines.find((x) => x.id === did)).toMatchObject({ category: "Hàng tạm", unitPrice: 147267, inKg: 300 });
    const r2 = { ...r, stockCategory: "Nguyên liệu nhập khẩu" };
    const b = syncMonthlyStockLedger(a.lines, [r], [r2], ctx);
    expect(b.changed).toBe(true);
    expect(b.lines.find((x) => x.id === did)!.category).toBe("Nguyên liệu nhập khẩu");
  });
  /* Kế toán 2026-10-20: "chỉ xài bảng có sẵn, không thêm vô ô nào hết" ⇒ KHÔNG còn ghi vào bảng cũ
     "Nguyên liệu gửi đông" (trước đây lô cũ chưa chọn nhóm giữ nguyên ở đó). */
  const did = freezeDepositRowId("g1", "2026-10-02");
  const legacyLot = () => ({ ...lot(did, "2026-10", { category: LEGACY_FREEZE_DEPOSIT_CATEGORY, openKg: 0, inKg: 300 }), origin: "GĐ-20261002" });
  test("dòng cũ chưa chọn nhóm: lô ở bảng cũ DỜI sang bảng mặc định khi ghi lại", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -300 }, { stockLocation: warehouse });
    const r2 = { ...r, dailyQuantities: { "2026-10-02": -350 } };
    const b = syncMonthlyStockLedger([legacyLot()], [r], [r2], ctx);
    expect(b.lines.find((x) => x.id === did)).toMatchObject({ category: DEFAULT_DEPOSIT_CATEGORY, inKg: 350 });
  });
  test("đã chọn Hàng tạm mà lô còn ở bảng cũ ⇒ lưu lại cùng nhóm vẫn dời (không bị coi là 'không đổi')", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -300 }, { stockLocation: warehouse, stockCategory: "Hàng tạm" });
    const b = syncMonthlyStockLedger([legacyLot()], [r], [{ ...r }], ctx);
    expect(b.changed).toBe(true);
    expect(b.lines.find((x) => x.id === did)).toMatchObject({ category: "Hàng tạm", inKg: 300 });
  });
  test("lô ở bảng cũ tính là LỆCH ⇒ nút 'Ghi lại vào sổ kho' dời về bảng đã chọn", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -300 }, { stockLocation: warehouse, stockCategory: "Hàng tạm" });
    expect(countMonthlyStockMismatches([legacyLot()], [r])).toBe(1);
    const fixed = syncMonthlyStockLedger([legacyLot()], [], [r], ctx);
    expect(fixed.lines.find((x) => x.id === did)!.category).toBe("Hàng tạm");
    expect(countMonthlyStockMismatches(fixed.lines, [r])).toBe(0);
  });
  test("depositLotCategory không bao giờ trả bảng cũ", () => {
    expect(depositLotCategory({ stockCategory: LEGACY_FREEZE_DEPOSIT_CATEGORY }, { category: LEGACY_FREEZE_DEPOSIT_CATEGORY })).toBe(DEFAULT_DEPOSIT_CATEGORY);
    expect(depositLotCategory(undefined, { category: "Nguyên liệu nhập khẩu" })).toBe("Nguyên liệu nhập khẩu");
    expect(depositLotCategory({ stockCategory: "Hàng tạm" }, { category: "Nguyên liệu nhập khẩu" })).toBe("Hàng tạm");
    // Ca thật 2026-10 (kỳ 01–05/10): dòng còn lưu bảng cũ, lô đã dời sang "mua ngoài" ⇒ nhãn ở
    // Cân đối phải chỉ đúng bảng lô đang nằm (MaterialGrid dùng chung hàm này).
    expect(depositLotCategory({ stockCategory: LEGACY_FREEZE_DEPOSIT_CATEGORY }, { category: DEFAULT_DEPOSIT_CATEGORY })).toBe(DEFAULT_DEPOSIT_CATEGORY);
    expect(depositLotCategory({ stockCategory: LEGACY_FREEZE_DEPOSIT_CATEGORY }, { category: "" })).toBe(DEFAULT_DEPOSIT_CATEGORY);
  });
});

describe("listDepositTargets — bảng của Sổ kho tháng để chọn chỗ gửi", () => {
  test("có nhóm gợi ý kể cả trống, bỏ nhóm cũ, dòng trùng họ NL lên đầu", () => {
    const lines = [
      lot("A", "2026-10", { itemName: "SABA", category: "Nguyên liệu nhập khẩu" }),
      lot("B", "2026-10", { itemName: "B.TUỘC 2 DA", category: "Nguyên liệu mua ngoài" }),
      lot("C", "2026-10", { itemName: "ABC", category: "Nguyên liệu mua ngoài" }),
      lot("D", "2026-10", { itemName: "Bạch tuộc 2 da", category: LEGACY_FREEZE_DEPOSIT_CATEGORY }),
      lot("E", "2026-09", { itemName: "tháng khác", category: "Hàng tạm", outKg: 1000 }),
    ];
    const g = listDepositTargets(lines, "2026-10", "Bạch tuộc 2 da");
    expect(g.map((x) => x.category)).toEqual(["Nguyên liệu nhập khẩu", "Nguyên liệu mua ngoài", "Hàng tạm", "Bán thành phẩm", "Thành phẩm đóng gói"]);
    expect(g[1].rows.map((x) => x.id)).toEqual(["B", "C"]);
    expect(g.flatMap((x) => x.rows).some((x) => x.id === "D")).toBe(false);
    expect(g[0].rows[0]).toMatchObject({ closeKg: 1000, unitPrice: 140000 });
  });
  test("tháng chưa mở ⇒ xem trước phần kế thừa", () => {
    const g = listDepositTargets([lot("L1", "2026-09", { outKg: 200 })], "2026-10", "Bạch tuộc 2 da");
    expect(g[1].rows[0]).toMatchObject({ id: "carry|L1", closeKg: 800 });
  });
});

describe("shortWarehouseLabel", () => {
  test("Kho <số> tấn ⇒ K<số>; kho ngoài bỏ chữ Kho", () => {
    expect(shortWarehouseLabel("Kho 1000 tấn")).toBe("K1000");
    expect(shortWarehouseLabel("Kho 1500 tấn")).toBe("K1500");
    expect(shortWarehouseLabel("Kho Phước Cơ")).toBe("Phước Cơ");
  });
});

describe("Giá gửi đông THEO NGÀY (mig 0071, kế toán yêu cầu 2026-10-19)", () => {
  const warehouse = "Kho 1000 tấn|";
  const d1 = "2026-10-01";
  const d2 = "2026-10-02";
  const d3 = "2026-10-03";

  test("dòng cũ (chưa có giá theo ngày): mọi ngày = đơn giá dòng, chuẩn hoá không đụng", () => {
    const r = stockRow("g1", "gui", { [d1]: -10, [d2]: -20 }, { unitPrice: 150000 });
    expect(depositPriceOn(r, d1)).toBe(150000);
    expect(normalizeDepositPrices(r)).toBe(r);
    expect(setDepositPriceAllDays(r, 155000)).toEqual({ unitPrice: 155000 });
  });

  test("10 kg × 150.000 + 20 kg × 160.000 ⇒ đơn giá BQ không làm tròn, T.tiền = 4.700.000", () => {
    const r = normalizeDepositPrices(
      stockRow("g1", "gui", { [d1]: -10, [d2]: -20 }, { unitPrice: 150000, dailyPrices: { [d1]: 150000, [d2]: 160000 } })
    );
    expect(r.unitPrice! * 30).toBeCloseTo(4_700_000, 6);
    expect(lastDepositPrice(r)).toBe(160000);
  });

  test("gõ kg ngày mới ⇒ giá tự lấy ngày gần nhất trước đó; ngày bỏ kg ⇒ bỏ giá", () => {
    const r = normalizeDepositPrices(
      stockRow("g1", "gui", { [d1]: -10, [d3]: -15 }, { dailyPrices: { [d1]: 150000, [d2]: 160000 } })
    );
    expect(r.dailyPrices).toEqual({ [d1]: 150000, [d3]: 150000 });
    // Ngày đầu chưa có giá ⇒ lấy ngày gần nhất SAU.
    const r2 = normalizeDepositPrices(stockRow("g1", "gui", { [d1]: -10, [d2]: -5 }, { dailyPrices: { [d2]: 158000 } }));
    expect(r2.dailyPrices).toEqual({ [d1]: 158000, [d2]: 158000 });
  });

  test("gõ giá một ngày ở dòng cũ ⇒ ngày khác giữ đơn giá dòng; xoá giá ⇒ lấy lại ngày trước", () => {
    const r = stockRow("g1", "gui", { [d1]: -10, [d2]: -20 }, { unitPrice: 150000 });
    expect(hasVaryingDepositPrices(r)).toBe(false);
    const r2 = normalizeDepositPrices({ ...r, ...setDepositPricesOn(r, { [d2]: 160000 }) });
    expect(r2.dailyPrices).toEqual({ [d1]: 150000, [d2]: 160000 });
    expect(hasVaryingDepositPrices(r2)).toBe(true);
    const r3 = normalizeDepositPrices({ ...r2, ...setDepositPricesOn(r2, { [d2]: null }) });
    expect(r3.dailyPrices).toEqual({ [d1]: 150000, [d2]: 150000 });
    expect(r3.unitPrice).toBe(150000);
  });

  test("gõ ô Đơn giá dòng ⇒ một giá cho mọi ngày gửi", () => {
    const r = stockRow("g1", "gui", { [d1]: -10, [d2]: -20 }, { dailyPrices: { [d1]: 150000, [d2]: 160000 } });
    expect(setDepositPriceAllDays(r, 155000)).toEqual({ dailyPrices: { [d1]: 155000, [d2]: 155000 }, unitPrice: 155000 });
  });

  test("mỗi lô GĐ-ngày mang giá đúng ngày; sửa giá một ngày chỉ đổi lô ngày đó", () => {
    const r = normalizeDepositPrices(
      stockRow("g1", "gui", { [d1]: -10, [d2]: -20 }, { stockLocation: warehouse, dailyPrices: { [d1]: 150000, [d2]: 160000 } })
    );
    const a = syncMonthlyStockLedger([lot("X", "2026-10")], [], [r], ctx);
    expect(a.lines.find((x) => x.id === freezeDepositRowId("g1", d1))!.unitPrice).toBe(150000);
    expect(a.lines.find((x) => x.id === freezeDepositRowId("g1", d2))!.unitPrice).toBe(160000);
    const r2 = normalizeDepositPrices({ ...r, dailyPrices: { ...r.dailyPrices, [d2]: 155000 } });
    const b = syncMonthlyStockLedger(a.lines, [r], [r2], ctx);
    expect(b.lines.find((x) => x.id === freezeDepositRowId("g1", d1))).toBe(a.lines.find((x) => x.id === freezeDepositRowId("g1", d1)));
    expect(b.lines.find((x) => x.id === freezeDepositRowId("g1", d2))!.unitPrice).toBe(155000);
  });

  test("Lấy xả đông sửa giá trên dòng KHÔNG đổi giá đã lưu của lô", () => {
    const l = lot("L1", "2026-10", { unitPrice: 150000 });
    const r = stockRow("x1", "lay", { [d1]: 100 }, { stockLineId: "L1", unitPrice: 150000 });
    const a = syncMonthlyStockLedger([l], [], [r], ctx);
    const b = syncMonthlyStockLedger(a.lines, [r], [{ ...r, unitPrice: 170000 }], ctx);
    expect(b.lines.find((x) => x.id === "L1")!.unitPrice).toBe(150000);
  });
});
