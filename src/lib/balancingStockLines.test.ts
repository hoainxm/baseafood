import { describe, expect, test } from "vitest";
import type { BalancingInputItem, MonthlyStockLine } from "@/types";
import {
  FREEZE_DEPOSIT_CATEGORY,
  ensureMonthOpened,
  listDepositLocationOptions,
  listThawLotOptions,
  syncMonthlyStockLedger,
  findLotLineInMonth,
  freezeDepositRowId,
  getBalancingShareInLot,
  countMonthlyStockMismatches,
} from "./balancingStockLines";
import { suyDong } from "./monthlyStock";

const lo = (id: string, period: string, p: Partial<MonthlyStockLine> = {}): MonthlyStockLine => ({
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

const ctx = { nhanKy: "Bạch tuộc 2 da 01/10/2026 – 05/10/2026", hoNL: "Bạch tuộc 2 da" };
const stock = (l: MonthlyStockLine | null | undefined) => (l ? suyDong(l).closeKg : NaN);

describe("ensureMonthOpened — tháng chưa mở tự kế thừa", () => {
  test("dồn qua từng tháng, id carry| tất định, chạy lại không nhân đôi", () => {
    const goc = [lo("L1", "2026-08", { outKg: 200 })];
    const a = ensureMonthOpened(goc, "2026-10");
    expect(a.keThua).toBe(2); // 08 → 09 → 10
    const t10 = a.lines.find((l) => l.period === "2026-10")!;
    expect(t10.id).toBe("carry|carry|L1");
    expect(t10.openKg).toBe(800);
    expect(ensureMonthOpened(a.lines, "2026-10")).toEqual({ lines: a.lines, keThua: 0 });
  });
  test("tháng đã có dòng thì để nguyên", () => {
    const ds = [lo("L1", "2026-09"), lo("X", "2026-10")];
    expect(ensureMonthOpened(ds, "2026-10").keThua).toBe(0);
  });
});

describe("findLotLineInMonth — theo chuỗi dồn kỳ", () => {
  test("tháng sau là carry|<id>", () => {
    const ds = ensureMonthOpened([lo("L1", "2026-09")], "2026-10").lines;
    expect(findLotLineInMonth(ds, "L1", "2026-10")?.id).toBe("carry|L1");
    expect(findLotLineInMonth(ds, "L1", "2026-09")?.id).toBe("L1");
    expect(findLotLineInMonth(ds, "L1", "2026-08")).toBeNull();
  });
});

describe("syncMonthlyStockLedger — Lấy xả đông = cột Xuất của lô chọn đích danh", () => {
  test("ghi xuất + vết; gõ lại số khác chỉ ghi phần chênh; xoá dòng trả lại sổ", () => {
    const s0 = [lo("L1", "2026-10", { outKg: 100 })];
    const r1 = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const a = syncMonthlyStockLedger(s0, [], [r1], ctx);
    expect(a.loi).toBeNull();
    const l1 = a.lines.find((l) => l.id === "L1")!;
    expect(l1.outKg).toBe(400);
    expect(getBalancingShareInLot(l1, "d1")).toBe(300);
    expect(l1.note).toContain("lấy xả đông 300 kg");

    const r2 = { ...r1, dailyQuantities: { "2026-10-02": 300, "2026-10-03": 200 } };
    const b = syncMonthlyStockLedger(a.lines, [r1], [r2], ctx);
    expect(b.lines.find((l) => l.id === "L1")!.outKg).toBe(600);
    // Đặt lại cùng số ⇒ không đổi gì (chạy lại an toàn).
    expect(syncMonthlyStockLedger(b.lines, [r2], [r2], ctx).doi).toBe(false);

    const c = syncMonthlyStockLedger(b.lines, [r2], [], ctx);
    const l1c = c.lines.find((l) => l.id === "L1")!;
    expect(l1c.outKg).toBe(100);
    expect(l1c.note).toBe("");
  });

  test("vượt tồn lô ⇒ chặn, không ghi gì", () => {
    const s0 = [lo("L1", "2026-10", { openKg: 500 })];
    const r = stockRow("d1", "lay", { "2026-10-02": 600 }, { stockLineId: "L1" });
    const kq = syncMonthlyStockLedger(s0, [], [r], ctx);
    expect(kq.loi).toMatch(/chỉ còn 500 kg/);
    expect(kq.lines).toBe(s0);
  });

  test("chưa chọn lô mà có số ⇒ chặn", () => {
    const kq = syncMonthlyStockLedger([], [], [stockRow("d1", "lay", { "2026-10-02": 5 })], ctx);
    expect(kq.loi).toMatch(/Chọn lô/);
  });

  test("dòng cũ có số mà chưa chọn lô KHÔNG làm kẹt lần ghi khác; chọn lô thì ghi đủ", () => {
    const prev = stockRow("d1", "lay", { "2026-10-02": 5 });
    const khac = stockRow("x", "lay", {}, { groupName: "Thủy sản", sourceWarehouse: "" });
    const kq = syncMonthlyStockLedger([], [prev, khac], [prev, { ...khac, unitPrice: 1 }], ctx);
    expect(kq.loi).toBeNull();
    expect(kq.doi).toBe(false);
    const s0 = [lo("L1", "2026-10")];
    const synced = syncMonthlyStockLedger(s0, [prev], [{ ...prev, stockLineId: "L1" }], ctx);
    expect(synced.lines[0].outKg).toBe(5);
  });

  test("đổi lô: trả lô cũ, ghi lô mới", () => {
    const s0 = [lo("L1", "2026-10"), lo("L2", "2026-10", { origin: "SBT002" })];
    const r1 = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const a = syncMonthlyStockLedger(s0, [], [r1], ctx).lines;
    const b = syncMonthlyStockLedger(a, [r1], [{ ...r1, stockLineId: "L2" }], ctx).lines;
    expect(b.find((l) => l.id === "L1")!.outKg).toBe(0);
    expect(b.find((l) => l.id === "L2")!.outKg).toBe(300);
  });

  test("kỳ vắt qua tháng chưa mở: tự kế thừa rồi ghi xuất vào dòng carry của lô", () => {
    const s0 = [lo("L1", "2026-09", { openKg: 1000 })];
    const r = stockRow(
      "d1",
      "lay",
      { "2026-09-30": 100, "2026-10-01": 50 },
      { stockLineId: "L1" }
    );
    const kq = syncMonthlyStockLedger(s0, [], [r], ctx);
    expect(kq.loi).toBeNull();
    expect(kq.keThua).toBeGreaterThan(0);
    expect(kq.lines.find((l) => l.id === "L1")!.outKg).toBe(100);
    // Tháng 10 kế thừa tồn cuối tháng 9 SAU khi trừ 100 (= 900), rồi trừ 50 của tháng 10.
    expect(stock(kq.lines.find((l) => l.id === "carry|L1"))).toBe(1000 - 100 - 50);
    // Thứ tự ngày trong object không quyết định kết quả.
    const dao = { ...r, dailyQuantities: { "2026-10-01": 50, "2026-09-30": 100 } };
    expect(stock(syncMonthlyStockLedger(s0, [], [dao], ctx).lines.find((l) => l.id === "carry|L1"))).toBe(850);
  });

  test("kiện theo kg/kiện của lô", () => {
    const s0 = [lo("L1", "2026-10", { kgPerCtn: 10, openCtn: 100 })];
    const r = stockRow("d1", "lay", { "2026-10-02": 30 }, { stockLineId: "L1" });
    expect(syncMonthlyStockLedger(s0, [], [r], ctx).lines[0].outCtn).toBe(3);
  });
});

describe("syncMonthlyStockLedger — Gửi đông = lô MỚI theo ngày gửi", () => {
  const warehouse = "Kho 1500 tấn|Kho Hồng Phú";
  test("mỗi ngày gửi một lô, nhóm riêng, invoice GĐ-ngày; đổi kho đổi vị trí; xoá dòng gỡ lô", () => {
    const r = stockRow("g1", "gui", { "2026-10-02": -400, "2026-10-03": -100 }, { stockLocation: warehouse });
    const a = syncMonthlyStockLedger([lo("X", "2026-10")], [], [r], ctx);
    const l = a.lines.find((x) => x.id === freezeDepositRowId("g1", "2026-10-02"))!;
    expect(l).toMatchObject({
      period: "2026-10",
      category: FREEZE_DEPOSIT_CATEGORY,
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
    expect(syncMonthlyStockLedger([], [], [stockRow("g1", "gui", { "2026-10-02": -5 })], ctx).loi).toMatch(/Chọn kho/);
  });

  test("lấy xả đông từ chính lô gửi đông: vết không mất khi lô gửi được ghi lại", () => {
    const g = stockRow("g1", "gui", { "2026-10-02": -400 }, { stockLocation: warehouse });
    const a = syncMonthlyStockLedger([], [], [g], ctx).lines;
    const lay = stockRow("d1", "lay", { "2026-10-04": 150 }, { stockLineId: freezeDepositRowId("g1", "2026-10-02") });
    const b = syncMonthlyStockLedger(a, [], [lay], ctx).lines;
    const g2 = { ...g, unitPrice: 142000 };
    const c = syncMonthlyStockLedger(b, [g], [g2], ctx).lines;
    const dongGui = c.find((x) => x.id === freezeDepositRowId("g1", "2026-10-02"))!;
    expect(dongGui.outKg).toBe(150);
    expect(getBalancingShareInLot(dongGui, "d1")).toBe(150);
    expect(stock(dongGui)).toBe(250);
  });
});

describe("countMonthlyStockMismatches — kiểm khớp, ghi lại sửa được", () => {
  test("sổ bị nạp đè mất xuất ⇒ báo lệch, ghi lại với truoc=[] thì khớp", () => {
    const r = stockRow("d1", "lay", { "2026-10-02": 300 }, { stockLineId: "L1" });
    const da = syncMonthlyStockLedger([lo("L1", "2026-10")], [], [r], ctx).lines;
    expect(countMonthlyStockMismatches(da, [r])).toBe(0);
    const biDe = [lo("L1", "2026-10")]; // nạp lại Excel: xuất 0, mất vết
    expect(countMonthlyStockMismatches(biDe, [r])).toBe(1);
    const edit = syncMonthlyStockLedger(biDe, [], [r], ctx).lines;
    expect(countMonthlyStockMismatches(edit, [r])).toBe(0);
    expect(edit[0].outKg).toBe(300);
  });
});

describe("danh sách chọn", () => {
  test("lô: còn tồn, khớp tên họ NL lên đầu, nhãn có kho · tên · invoice · còn kg", () => {
    const ds = [
      lo("A", "2026-10", { itemName: "CÁ SÒNG", storageLocation: "Kho Ánh Dương" }),
      lo("B", "2026-10", { outKg: 1000 }), // hết hàng ⇒ ẩn
      lo("C", "2026-10"),
    ];
    const ch = listThawLotOptions(ds, "2026-10", "Bạch tuộc 2 da");
    expect(ch.map((c) => c.value)).toEqual(["C", "A"]);
    expect(ch[0].label).toBe("Hồng Phú · B.TUỘC  2 DA · SBT001");
    expect(ch[0].phu).toMatch(/^còn 1\.000 kg · nhập 12\/08\/2026$/);
    // Lô đang chọn vẫn hiện dù đã hết.
    expect(listThawLotOptions(ds, "2026-10", "Bạch tuộc 2 da", ["B"]).some((c) => c.value === "B")).toBe(true);
  });
  test("lô của tháng chưa mở: xem trước phần kế thừa (id carry|)", () => {
    expect(listThawLotOptions([lo("C", "2026-09")], "2026-10", "Bạch tuộc 2 da")[0].value).toBe("carry|C");
  });
  test("kho gửi: kho xí nghiệp + kho lưu; kho ngoài ghi vào sổ đang quản lý nó", () => {
    const ch = listDepositLocationOptions([lo("C", "2026-10")], ["Kho 1000 tấn", "Kho 1500 tấn"], ["Kho Ánh Dương"]);
    expect(ch.map((c) => c.value)).toEqual([
      "Kho 1000 tấn|",
      "Kho 1500 tấn|",
      "Kho 1500 tấn|Kho Ánh Dương",
      "Kho 1500 tấn|Kho Hồng Phú",
    ]);
  });
});
