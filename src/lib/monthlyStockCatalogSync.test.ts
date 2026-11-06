import { describe, expect, it } from "vitest";
import { buildCatalogSyncUsage, renameLedgerItems, revertCatalogSync, type CatalogSyncUsageSources } from "./monthlyStockCatalogSync";

const line = (id: string, itemName: string, openingKg = 0) => ({ id, itemName, openingKg });
const product = (id: string, name: string, finishedGoodCode = "") => ({ id, name, finishedGoodCode });
const material = (id: string, name: string) => ({ id, name, note: "Từ sổ kho theo tháng" });

const before = [line("l1", "BT 2DA <80GR"), line("l2", "BT 2DA <80GR"), line("l3", "Mực ống"), line("l4", "Cá đổng")];
const oldProducts = [product("p0", "Mực ống")];
const oldMaterials = [material("m0", "Cá đổng")];

function runSync() {
  const created = { p: product("p1", "Bạch tuộc 2 da <80gr"), m: material("m1", "Ghẹ") };
  const { lines, renamed } = renameLedgerItems(before, new Map([["BT 2DA <80GR", "Bạch tuộc 2 da <80gr"]]));
  return {
    lines,
    products: [...oldProducts, created.p],
    materials: [...oldMaterials, created.m],
    run: { createdProducts: [created.p], createdMaterials: [created.m], renamedLines: renamed },
  };
}

describe("Đồng bộ danh mục — ghi lại lần đồng bộ", () => {
  it("đổi tên đúng các dòng mang tên file, ghi từng dòng đã đổi", () => {
    const { lines, run } = runSync();
    expect(lines.map((l) => l.itemName)).toEqual(["Bạch tuộc 2 da <80gr", "Bạch tuộc 2 da <80gr", "Mực ống", "Cá đổng"]);
    expect(run.renamedLines).toEqual([
      { id: "l1", from: "BT 2DA <80GR", to: "Bạch tuộc 2 da <80gr" },
      { id: "l2", from: "BT 2DA <80GR", to: "Bạch tuộc 2 da <80gr" },
    ]);
  });
});

describe("Đồng bộ danh mục — Hoàn tác", () => {
  it("gỡ đủ: mục vừa tạo bị xóa, tên dòng sổ trả về như trước, mục cũ giữ nguyên", () => {
    const s = runSync();
    const r = revertCatalogSync(s, s.run);
    expect(r.lines).toEqual(before);
    expect(r.products).toEqual(oldProducts);
    expect(r.materials).toEqual(oldMaterials);
    expect([r.removedProducts, r.removedMaterials, r.revertedLines, r.skippedLines]).toEqual([1, 1, 2, 0]);
  });

  it("mục đã sửa sau đồng bộ (gắn mã kế toán) hoặc đang được dùng ⇒ giữ lại, báo tên", () => {
    const s = runSync();
    const products = s.products.map((p) => (p.id === "p1" ? { ...p, finishedGoodCode: "TP-01" } : p));
    const r = revertCatalogSync({ ...s, products }, s.run, { material: (m) => m.id === "m1" });
    expect(r.products.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(r.keptProducts).toEqual(["Bạch tuộc 2 da <80gr"]);
    expect(r.keptMaterials).toEqual(["Ghẹ"]);
    expect([r.removedProducts, r.removedMaterials]).toEqual([0, 0]);
  });

  it("dòng đã đổi tên tiếp / đã xóa sau đồng bộ ⇒ để nguyên; số vừa gõ ở dòng khác còn", () => {
    const s = runSync();
    const lines = s.lines
      .filter((l) => l.id !== "l2")
      .map((l) => (l.id === "l1" ? { ...l, openingKg: 42 } : l.id === "l3" ? { ...l, openingKg: 7 } : l));
    const r = revertCatalogSync({ ...s, lines }, s.run);
    expect(r.lines.find((l) => l.id === "l1")).toEqual({ id: "l1", itemName: "BT 2DA <80GR", openingKg: 42 });
    expect(r.lines.find((l) => l.id === "l3")?.openingKg).toBe(7);
    expect([r.revertedLines, r.skippedLines]).toEqual([1, 1]);

    const manual = s.lines.map((l) => (l.id === "l1" ? { ...l, itemName: "Bạch tuộc khác" } : l));
    expect(revertCatalogSync({ ...s, lines: manual }, s.run).lines.find((l) => l.id === "l1")?.itemName).toBe("Bạch tuộc khác");
  });

  it("mục đã bị xóa tay trước khi Hoàn tác ⇒ không lỗi, không đếm", () => {
    const s = runSync();
    const r = revertCatalogSync({ ...s, products: oldProducts }, s.run);
    expect(r.removedProducts).toBe(0);
    expect(r.products).toEqual(oldProducts);
  });
});

describe("Đồng bộ danh mục — Hoàn tác giữ mục đã được DÙNG trong lúc thông báo còn hiện", () => {
  const noSources = (ledger: { id: string; itemName: string }[]): CatalogSyncUsageSources => ({
    ledger,
    productSources: { wips: [], packagings: [], salesItems: [], orderItems: [], exportItems: [], balancingOutputs: [], finishedOpeningStock: [] },
    materialNamesInUse: [],
    products: [],
  });
  const syncWithBaseline = () => {
    const s = runSync();
    const ledgerAtSync = Object.fromEntries(s.lines.map((l) => [l.id, l.itemName]));
    return { ...s, run: { ...s.run, ledgerAtSync } };
  };

  it("không ai dùng thêm ⇒ gỡ hết như cũ (dòng vốn mang tên đó từ trước không tính là dùng)", () => {
    const s = syncWithBaseline();
    // "Ghẹ" vừa tạo, giả sử sổ có sẵn dòng tên "Ghẹ" từ TRƯỚC đồng bộ (tên file = tên chuẩn).
    const lines = [...s.lines, line("l5", "Ghẹ")];
    const run = { ...s.run, ledgerAtSync: { ...s.run.ledgerAtSync, l5: "Ghẹ" } };
    const r = revertCatalogSync({ ...s, lines }, run, buildCatalogSyncUsage(run, noSources(lines)));
    expect([r.removedProducts, r.removedMaterials, r.keptInUse]).toEqual([1, 1, 0]);
  });

  it("dòng sổ MỚI mang tên mục vừa tạo ⇒ giữ mục, đếm là đang dùng", () => {
    const s = syncWithBaseline();
    const lines = [...s.lines, line("l9", "  bạch tuộc 2 DA <80gr ", 12)];
    const r = revertCatalogSync({ ...s, lines }, s.run, buildCatalogSyncUsage(s.run, noSources(lines)));
    expect(r.products.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(r.keptProducts).toEqual(["Bạch tuộc 2 da <80gr"]);
    expect(r.keptInUse).toBe(1);
    // tên dòng sổ vẫn trả về như trước cho các dòng lần đó đổi
    expect(r.lines.filter((l) => l.id === "l1" || l.id === "l2").map((l) => l.itemName)).toEqual(["BT 2DA <80GR", "BT 2DA <80GR"]);
  });

  it("dòng có sẵn đổi tên SANG mục vừa tạo sau đồng bộ ⇒ cũng là dùng", () => {
    const s = syncWithBaseline();
    const lines = s.lines.map((l) => (l.id === "l3" ? { ...l, itemName: "Ghẹ" } : l));
    const r = revertCatalogSync({ ...s, lines }, s.run, buildCatalogSyncUsage(s.run, noSources(lines)));
    expect(r.keptMaterials).toEqual(["Ghẹ"]);
    expect(r.removedProducts).toBe(1);
  });

  it("sổ khác trỏ tới mặt hàng (sản xuất) / loại NL (sổ nhập theo tên, mặt hàng gắn loại NL) ⇒ giữ", () => {
    const s = syncWithBaseline();
    const src = noSources(s.lines);
    const usedByWip = { ...src, productSources: { ...src.productSources, wips: [{ productId: "p1" }] } };
    const r1 = revertCatalogSync(s, s.run, buildCatalogSyncUsage(s.run, usedByWip));
    expect([r1.removedProducts, r1.removedMaterials, r1.keptInUse]).toEqual([0, 1, 1]);

    const usedByImport = { ...src, materialNamesInUse: ["GHẸ"] };
    expect(revertCatalogSync(s, s.run, buildCatalogSyncUsage(s.run, usedByImport)).keptMaterials).toEqual(["Ghẹ"]);

    const linkedProduct = { ...src, products: [{ id: "p7", materialTypeId: "m1" }] };
    expect(revertCatalogSync(s, s.run, buildCatalogSyncUsage(s.run, linkedProduct)).removedMaterials).toBe(0);
  });

  it("mục vừa sửa VÀ đang dùng ⇒ giữ, chỉ đếm là đã sửa (không đếm đôi)", () => {
    const s = syncWithBaseline();
    const products = s.products.map((p) => (p.id === "p1" ? { ...p, finishedGoodCode: "TP-01" } : p));
    const src = noSources(s.lines);
    const used = { ...src, productSources: { ...src.productSources, salesItems: [{ productId: "p1" }] } };
    const r = revertCatalogSync({ ...s, products }, s.run, buildCatalogSyncUsage(s.run, used));
    expect([r.keptProducts.length, r.keptInUse]).toEqual([1, 0]);
  });
});
