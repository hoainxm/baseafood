import { describe, expect, test } from "vitest";
import type { BalancingInputItem, BalancingOutputItem, BalancingPeriod, MaterialImportItem, WipProductionItem } from "@/types";
import { BALANCING_PERIOD_TABLE } from "./repo";
import {
  buildMaterialGridRows,
  importTripKey,
  isSalesItemPulled,
  mergePeriodFormEdit,
  filterEligibleImports,
  filterEligibleWips,
  importExclusionKey,
  isSourceExcluded,
  productionExclusionKey,
  salesExclusionKey,
  selectPeriodImports,
} from "./balancingGrid";
import { calculateBalancing } from "./balancingCalc";
import {
  addExcludedSourceKey,
  describeFinishedGoodLoss,
  parseExcludedSourceKey,
  planRemoveFinishedGoodRow,
  planRemoveMaterialRow,
  planRestoreImportFamily,
  planUndoAutoPull,
  removeExcludedSourceKey,
  normalizeRestoredPeriods,
} from "./balancingRemoval";

const period = (patch: Partial<BalancingPeriod> = {}): BalancingPeriod => ({
  id: "k1",
  materialTypeName: "Bạch tuộc 2 da",
  dateRangeDescription: "1–5/10",
  startDate: "2026-10-01",
  endDate: "2026-10-05",
  totalInputKg: null,
  exchangeRate: 26000,
  processingCostPerKg: 10000,
  createdAt: "",
  ...patch,
});

let n = 0;
const trip = (deliveryDate: string, materialTypeName: string, quantityKg: number, unitPrice: number | null, balancingPeriodId = ""): MaterialImportItem => ({
  id: `t${++n}`,
  shipmentId: "",
  deliveryDate,
  workshop: "Đông" as MaterialImportItem["workshop"],
  category: "" as MaterialImportItem["category"],
  supplierName: "",
  materialTypeName,
  quantityKg,
  unitPrice,
  driverName: "",
  licensePlate: "",
  note: "",
  balancingPeriodId,
});

const input = (patch: Partial<BalancingInputItem>): BalancingInputItem => ({
  id: `i${++n}`,
  periodId: "k1",
  groupName: "Thủy sản",
  name: "",
  quantityKg: 0,
  unitPrice: null,
  ratioPercentage: null,
  sourceWarehouse: "",
  dailyQuantities: {},
  carryOverKg: 0,
  carryOverPeriodId: "",
  isReduction: false,
  reductionWarehouseId: "",
  autoSource: "",
  ...patch,
});

const output = (patch: Partial<BalancingOutputItem>): BalancingOutputItem => ({
  id: `o${++n}`,
  periodId: "k1",
  productId: "p1",
  customerId: "c1",
  channel: "Xuất khẩu",
  quantityKg: 0,
  unitPrice: null,
  spec: "",
  salesItemId: "",
  dailyQuantities: {},
  carryOverKg: 0,
  carryOverPeriodId: "",
  autoSource: "",
  ...patch,
});

const wip = (productionDate: string, productId: string, quantityKg: number, balancingPeriodId = ""): WipProductionItem =>
  ({ id: `w${++n}`, productionDate, productId, spec: "", quantityKg, balancingPeriodId }) as WipProductionItem;

describe("khóa nguồn đã bỏ khỏi kỳ", () => {
  test("thêm không trùng · bỏ · tách khóa", () => {
    const keys = addExcludedSourceKey(addExcludedSourceKey(undefined, "imports:a"), "imports:a");
    expect(keys).toEqual(["imports:a"]);
    expect(removeExcludedSourceKey(keys, "imports:a")).toEqual([]);
    expect(parseExcludedSourceKey("production:p1|IQF")).toEqual({ kind: "production", value: "p1|IQF" });
    expect(parseExcludedSourceKey("rác")).toBeNull();
  });

  test("khóa sổ nhập theo HỌ, không phân biệt size / hoa thường", () => {
    expect(importExclusionKey("Bạch tuộc 2 da lớn (80↑)")).toBe(importExclusionKey("bạch tuộc 2 da"));
  });

  test("họ đã bỏ ⇒ không còn đủ điều kiện tự lấy, kỳ không dùng chuyến của họ đó", () => {
    const rows = [trip("2026-10-01", "Bạch tuộc 2 da lớn (80↑)", 100, 50000), trip("2026-10-02", "Bạch tuộc 2 da nhỏ (80↓)", 50, 40000)];
    const p = period({ excludedSourceKeys: [importExclusionKey("Bạch tuộc 2 da")] });
    expect(isSourceExcluded(p, importExclusionKey("Bạch tuộc 2 da nhỏ (80↓)"))).toBe(true);
    expect(filterEligibleImports(p, rows)).toEqual([]);
    expect(selectPeriodImports(p, rows)).toEqual([]);
    // Kỳ khác chồng ngày (không bỏ) vẫn lấy đủ — sổ nguồn không bị đụng.
    expect(selectPeriodImports(period({ id: "k2" }), rows)).toHaveLength(2);
  });

  test("mặt hàng sản xuất đã bỏ ⇒ nút Lấy từ sổ sản xuất không hút lại", () => {
    const rows = [wip("2026-10-01", "p1", 30), wip("2026-10-01", "p2", 20)];
    const p = period({ excludedSourceKeys: [productionExclusionKey("p1", "")] });
    expect(filterEligibleWips(p, rows).map((r) => r.productId)).toEqual(["p2"]);
  });
});

describe("Bỏ khỏi kỳ — dòng hút sổ nhập", () => {
  const twoDa = [trip("2026-10-01", "Bạch tuộc 2 da lớn (80↑)", 1000, 50000), trip("2026-10-03", "Bạch tuộc 2 da nhỏ (80↓)", 500, 40000)];
  // Chuyến khác loại người dùng tự tick vào kỳ (gắn balancingPeriodId).
  const oneDa = trip("2026-10-02", "Bạch tuộc 1 da", 300, 30000, "k1");
  const imports = [...twoDa, oneDa];
  const rowTwoDa = input({ id: "k1-imports-Bạch tuộc 2 da", name: "Bạch tuộc 2 da", autoSource: "imports", quantityKg: 1500 });
  const rowOneDa = input({ id: "k1-imports-Bạch tuộc 1 da", name: "Bạch tuộc 1 da", autoSource: "imports", quantityKg: 300 });
  const manual = input({ name: "Bột tẩm", groupName: "Phụ gia", quantityKg: 20, unitPrice: 15000 });
  const otherPeriodRow = input({ periodId: "k9", name: "Bạch tuộc 2 da", autoSource: "imports" });
  const inputs = [rowTwoDa, rowOneDa, manual, otherPeriodRow];

  test("bỏ họ tự lấy: bỏ dòng, ghi khóa, SỔ NHẬP KHÔNG ĐỔI", () => {
    const plan = planRemoveMaterialRow(period(), inputs, imports, rowTwoDa.id)!;
    expect(plan.kind).toBe("imports");
    expect(plan.inputs.map((r) => r.id)).toEqual([rowOneDa.id, manual.id, otherPeriodRow.id]);
    expect(plan.imports).toBeNull(); // chuyến cùng họ không gắn kỳ ⇒ sổ nhập giữ nguyên
    expect(plan.excludedSourceKeys).toEqual([importExclusionKey("Bạch tuộc 2 da")]); // không chuyến nào bị gỡ gắn kỳ
    expect(plan.tripCount).toBe(2);
    expect(plan.totalKg).toBe(1500);
  });

  test("bỏ họ đã tick tay: chỉ gỡ liên kết kỳ, kg / giá / ngày giữ nguyên", () => {
    const plan = planRemoveMaterialRow(period(), inputs, imports, rowOneDa.id)!;
    const after = plan.imports!.find((r) => r.id === oneDa.id)!;
    expect(after).toEqual({ ...oneDa, balancingPeriodId: "" });
    expect(plan.imports!.filter((r) => r.id !== oneDa.id)).toEqual(twoDa);
    // Họ khác loại không bao giờ tự lấy ⇒ không ghi "đã bỏ" (lấy lại ở hộp Chọn dòng nhập).
    expect(plan.excludedSourceKeys).toBeNull();
  });

  test("tổng kỳ sau khi bỏ đúng bằng phần còn lại", () => {
    const p = period();
    const plan = planRemoveMaterialRow(p, inputs, imports, rowTwoDa.id)!;
    const nextPeriod = { ...p, excludedSourceKeys: plan.excludedSourceKeys! };
    const periodInputs = plan.inputs.filter((r) => r.periodId === p.id);
    const grid = buildMaterialGridRows(periodInputs, selectPeriodImports(nextPeriod, imports));
    const forCalc = periodInputs.map((r) => {
      const h = grid.find((x) => x.id === r.id)!;
      return h.fromImports ? { ...r, quantityKg: h.total, unitPrice: h.unitPrice } : r;
    });
    const result = calculateBalancing(nextPeriod, forCalc, [], []);
    expect(result.totalInputKg).toBe(300 + 20);
    expect(result.materialValue).toBe(300 * 30000 + 20 * 15000);
  });

  test("dòng kỳ khác / id lạ ⇒ không làm gì", () => {
    expect(planRemoveMaterialRow(period(), inputs, imports, otherPeriodRow.id)).toBeNull();
    expect(planRemoveMaterialRow(period(), inputs, imports, "khong-co")).toBeNull();
  });

  test("hoàn tác tự lấy = bỏ dòng vừa thêm + ghi khóa (không thì tự lấy lại ngay)", () => {
    const plan = planUndoAutoPull(period(), inputs, [rowTwoDa.id]);
    expect(plan.inputs.map((r) => r.id)).not.toContain(rowTwoDa.id);
    expect(plan.excludedSourceKeys).toEqual([importExclusionKey("Bạch tuộc 2 da")]);
  });
});

describe("xoá dòng nhận chuyển kỳ ⇒ trả về kỳ trước", () => {
  test("khối NL: dòng nguồn kỳ trước bỏ đánh dấu đã nhận", () => {
    const source = input({ id: "src", periodId: "k0", name: "Bạch tuộc 2 da", carryOverKg: -200, carryOverPeriodId: "k1" });
    const received = input({ id: "recv", name: "Bạch tuộc 2 da", groupName: "Xả đông", quantityKg: 200, carryOverKg: 200 });
    const plan = planRemoveMaterialRow(period(), [source, received], [], "recv")!;
    expect(plan.kind).toBe("manual");
    expect(plan.inputs).toEqual([{ ...source, carryOverPeriodId: "" }]);
    expect(plan.releasedCarryOverIds).toEqual(["src"]);
  });

  test("còn dòng nhận khác cùng tên ⇒ chỉ trả phần dư", () => {
    const s1 = input({ id: "s1", periodId: "k0", name: "A", carryOverKg: -100, carryOverPeriodId: "k1" });
    const s2 = input({ id: "s2", periodId: "k0", name: "A", carryOverKg: -50, carryOverPeriodId: "k1" });
    const r1 = input({ id: "r1", name: "A", carryOverKg: 100 });
    const r2 = input({ id: "r2", name: "A", carryOverKg: 50 });
    const plan = planRemoveMaterialRow(period(), [s1, s2, r1, r2], [], "r2")!;
    expect(plan.releasedCarryOverIds).toEqual(["s2"]); // ưu tiên nguồn cùng số kg
  });

  test("dòng tay thường ⇒ chỉ xoá dòng", () => {
    const manual = input({ id: "m", name: "Bột", quantityKg: 5 });
    const plan = planRemoveMaterialRow(period(), [manual], [], "m")!;
    expect(plan.inputs).toEqual([]);
    expect(plan.releasedCarryOverIds).toEqual([]);
    expect(plan.excludedSourceKeys).toBeNull();
  });

  test("khối TP: dòng nhận chuyển kỳ trả về kỳ trước", () => {
    const source = output({ id: "src", periodId: "k0", carryOverKg: -80, carryOverPeriodId: "k1" });
    const received = output({ id: "recv", carryOverKg: 80, quantityKg: 80 });
    const plan = planRemoveFinishedGoodRow(period(), [source, received], [], "recv")!;
    expect(plan.outputs).toEqual([{ ...source, carryOverPeriodId: "" }]);
  });
});

describe("Bỏ khỏi kỳ — khối bán thành phẩm", () => {
  test("dòng hút sổ SX: gỡ liên kết kỳ của dòng SX, ghi khóa, kg không đổi", () => {
    const w1 = wip("2026-10-01", "p1", 30, "k1");
    const w2 = wip("2026-10-02", "p1", 20, "k1");
    const w3 = wip("2026-10-02", "p2", 10, "k1");
    const row = output({ id: "prod", productId: "p1", autoSource: "production", quantityKg: 50, unitPrice: 5 });
    const other = output({ id: "prod2", productId: "p2", autoSource: "production", quantityKg: 10, unitPrice: 5 });
    const plan = planRemoveFinishedGoodRow(period(), [row, other], [w1, w2, w3], "prod")!;
    expect(plan.kind).toBe("production");
    expect(plan.outputs.map((r) => r.id)).toEqual(["prod2"]);
    expect(plan.wips).toEqual([{ ...w1, balancingPeriodId: "" }, { ...w2, balancingPeriodId: "" }, w3]);
    expect(plan.releasedWipCount).toBe(2);
    expect(plan.excludedSourceKeys).toEqual([productionExclusionKey("p1", "")]);
    // Tổng kỳ sau khi bỏ = phần còn lại.
    const result = calculateBalancing(period(), [], [], plan.outputs);
    expect(result.totalOutputKg).toBe(10);
    expect(result.exportValue).toBe(10 * 5 * 26000);
  });

  test("dòng hút sổ bán: bỏ dòng + ghi khóa dòng bán", () => {
    const row = output({ id: "s", autoSource: "sales", salesItemId: "si1", quantityKg: 40 });
    const plan = planRemoveFinishedGoodRow(period(), [row], [], "s")!;
    expect(plan.outputs).toEqual([]);
    expect(plan.excludedSourceKeys).toEqual([salesExclusionKey("si1")]);
  });

  test("dòng hút sổ bán THẬT (salesItemToOutput không đặt autoSource) vẫn là Bỏ khỏi kỳ + ghi khóa", () => {
    const row = output({ id: "s2", autoSource: undefined, salesItemId: "si9", quantityKg: 40, dailyQuantities: { "2026-10-02": 40 } });
    const plan = planRemoveFinishedGoodRow(period(), [row], [], "s2")!;
    expect(plan.kind).toBe("sales");
    expect(plan.excludedSourceKeys).toEqual([salesExclusionKey("si9")]);
  });

  test("dòng thêm tay: xoá, không đụng sổ nào", () => {
    const row = output({ id: "m", quantityKg: 12, dailyQuantities: { "2026-10-01": 12 } });
    const plan = planRemoveFinishedGoodRow(period(), [row], [], "m")!;
    expect(plan).toMatchObject({ kind: "manual", outputs: [], wips: null, excludedSourceKeys: null });
  });

  test("ô hỏi xoá nói rõ mất gì; dòng trống ⇒ không có gì", () => {
    const f = (x: number) => String(x);
    expect(describeFinishedGoodLoss({ quantityKg: 0, unitPrice: null, carryOverKg: 0 }, 0, f)).toEqual([]);
    expect(
      describeFinishedGoodLoss({ quantityKg: 70, unitPrice: 3.2, carryOverKg: 20, debtKg: 5, note: "x" }, 50, f)
    ).toEqual(["50 kg theo ngày", "Trả 15 kg", "Nợ 5 kg", "đơn giá 3.2", "ghi chú dòng"]);
  });
});

describe("audit 2026-11-06 — Hoàn tác / Lấy lại không lệch số", () => {
  test("cột 0110 về [] ⇒ vẫn là [] và LUÔN gửi lại (Hoàn tác lần bỏ đầu tiên xoá được khóa trên máy chủ)", () => {
    const fromDb = BALANCING_PERIOD_TABLE.fromRow({ id: "k1", excluded_source_keys: [] });
    expect(fromDb.excludedSourceKeys).toEqual([]);
    expect(BALANCING_PERIOD_TABLE.toRow(fromDb).excluded_source_keys).toEqual([]);
    // DB chưa chạy 0110 (không có cột) ⇒ không gửi cột.
    const noColumn = BALANCING_PERIOD_TABLE.fromRow({ id: "k1" });
    expect(noColumn.excludedSourceKeys).toBeUndefined();
    expect("excluded_source_keys" in BALANCING_PERIOD_TABLE.toRow(noColumn)).toBe(false);
  });

  test("Hoàn tác sau lần bỏ đầu tiên: ảnh chụp chưa có khóa ⇒ ghi [] (dòng gửi lên mang [])", () => {
    const snap = [period(), period({ id: "k2" })];
    const now = [period({ excludedSourceKeys: [importExclusionKey("Bạch tuộc 2 da")] }), period({ id: "k2" })];
    const restored = normalizeRestoredPeriods(snap, now);
    expect(restored[0].excludedSourceKeys).toEqual([]);
    expect(BALANCING_PERIOD_TABLE.toRow(restored[0]).excluded_source_keys).toEqual([]);
    expect(restored[1]).toBe(snap[1]); // kỳ khác không đụng
  });

  test("Lấy lại dòng bán hai lần ⇒ lần hai bỏ qua (một dòng bán một dòng kỳ)", () => {
    const pulled = [output({ autoSource: "sales", salesItemId: "si1", quantityKg: 40, dailyQuantities: { "2026-10-02": 40 } })];
    expect(isSalesItemPulled(pulled, "si1")).toBe(true);
    expect(isSalesItemPulled(pulled, "si2")).toBe(false);
    // Dòng hút hỏng (0 kg) không tính là đã hút.
    expect(isSalesItemPulled([output({ autoSource: "sales", salesItemId: "si3", quantityKg: 0, dailyQuantities: {} })], "si3")).toBe(false);
  });

  test("Bỏ khỏi kỳ rồi Lấy lại: gắn lại ĐÚNG chuyến tự tick ngoài khoảng ngày ⇒ kg lấy lại = kg đã bỏ", () => {
    const p = period();
    const inRange = trip("2026-10-02", "Bạch tuộc 2 da lớn (80↑)", 1000, 50000);
    const outside = trip("2026-09-28", "Bạch tuộc 2 da nhỏ (80↓)", 400, 40000, "k1"); // tự tick, ngoài kỳ
    const other = trip("2026-10-03", "Bạch tuộc 1 da", 300, 30000);
    const imports = [inRange, outside, other];
    const row = input({ id: "k1-imports-Bạch tuộc 2 da", name: "Bạch tuộc 2 da", autoSource: "imports" });
    const removal = planRemoveMaterialRow(p, [row], imports, row.id)!;
    expect(removal.totalKg).toBe(1400);
    expect(removal.excludedSourceKeys).toEqual([importExclusionKey("Bạch tuộc 2 da"), importTripKey(outside.id)]);
    const afterRemove = { ...p, excludedSourceKeys: removal.excludedSourceKeys! };
    const restore = planRestoreImportFamily(afterRemove, removal.imports!, importExclusionKey("Bạch tuộc 2 da"));
    expect(restore.excludedSourceKeys).toEqual([]);
    expect(restore.imports!.find((r) => r.id === outside.id)!.balancingPeriodId).toBe("k1");
    expect(restore.trips.reduce((s, r) => s + r.quantityKg, 0)).toBe(1400);
    expect(restore.skippedTripIds).toEqual([]);
  });

  test("Lấy lại: chuyến đã gỡ mà nay thuộc kỳ khác ⇒ để yên, báo bỏ qua", () => {
    const outside = trip("2026-09-28", "Bạch tuộc 2 da nhỏ (80↓)", 400, 40000, "k9");
    const p = period({ excludedSourceKeys: [importExclusionKey("Bạch tuộc 2 da"), importTripKey(outside.id)] });
    const restore = planRestoreImportFamily(p, [outside], importExclusionKey("Bạch tuộc 2 da"));
    expect(restore.imports).toBeNull();
    expect(restore.skippedTripIds).toEqual([outside.id]);
    expect(restore.trips).toEqual([]);
  });

  test("Lưu hộp Sửa kỳ từ bản cũ / nháp: giữ nguồn đã bỏ + cờ chốt của kỳ đang có", () => {
    const live = period({ excludedSourceKeys: [importExclusionKey("Bạch tuộc 2 da")], isLocked: true });
    const staleForm = period({ exchangeRate: 25500, endDate: "2026-10-06" }); // mở hộp trước khi bỏ / chốt
    const saved = mergePeriodFormEdit(live, staleForm);
    expect(saved.excludedSourceKeys).toEqual(live.excludedSourceKeys);
    expect(saved.isLocked).toBe(true);
    expect(saved.exchangeRate).toBe(25500);
    expect(saved.endDate).toBe("2026-10-06");
  });
});
