import { describe, it, expect } from "vitest";
import type { MonthlyStockLine } from "@/types";
import {
  addFrozenStockToLedger,
  buildFrozenStockLines,
  frozenLineRemovalBlocker,
  frozenLinesOf,
  isFromProductionFrozen,
  productionFrozenWorkshop,
  TEMPORARY_GOODS_CATEGORY,
} from "./frozenStockLines";
import { idDon } from "./monthlyStock";

// Hàng đông lạnh ghi ở /wip ⇒ mỗi dòng là MỘT LÔ NHẬP nhóm "Hàng tạm" của Sổ kho tháng
// (tháng theo ngày SX). Tháng chưa mở thì kế thừa tồn tháng trước trước khi thêm.

const line = (p: Partial<MonthlyStockLine>): MonthlyStockLine => ({
  id: "msl|x",
  period: "2026-09",
  category: TEMPORARY_GOODS_CATEGORY,
  warehouse: "Kho 1500 tấn",
  itemName: "2 DA  <80GR",
  size: "",
  origin: "F34",
  importDate: "",
  storageLocation: "",
  kgPerCtn: null,
  unitPrice: null,
  openCtn: 0,
  openKg: 0,
  inCtn: 0,
  inKg: 0,
  outCtn: 0,
  outKg: 0,
  carriedFromId: "",
  sortOrder: 0,
  note: "",
  ...p,
});

let seq = 0;
const ctx = { productionDate: "2026-10-15", workshop: "Đông", operator: "Trúc", newId: () => `n${++seq}` };

describe("buildFrozenStockLines", () => {
  it("mỗi dòng đủ ⇒ một lô nhập Hàng tạm của tháng ngày SX, bỏ dòng thiếu", () => {
    const out = buildFrozenStockLines(
      [
        { itemName: " 2 DA  <80GR ", kg: 120, warehouse: "Kho 1000 tấn" },
        { itemName: "", kg: 50, warehouse: "" },
        { itemName: "BAO TỬ 2DA", kg: 0, warehouse: "" },
        { itemName: "BAO TỬ 2DA", kg: 30, warehouse: "" },
      ],
      ctx
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      period: "2026-10",
      category: "Hàng tạm",
      warehouse: "Kho 1000 tấn",
      itemName: "2 DA  <80GR",
      origin: "SX-20261015",
      importDate: "2026-10-15",
      inKg: 120,
      openKg: 0,
      outKg: 0,
    });
    expect(out[0].id.startsWith("wip|")).toBe(true);
    expect(out[1].warehouse).toBe("Kho 1500 tấn"); // trống ⇒ kho mặc định
    expect(productionFrozenWorkshop(out[0])).toBe("Đông");
  });
});

describe("addFrozenStockToLedger", () => {
  it("tháng chưa mở ⇒ kế thừa tồn cuối tháng trước rồi mới thêm lô", () => {
    const ledger = [line({ id: "a", period: "2026-09", openKg: 500, outKg: 100 })];
    const fresh = buildFrozenStockLines([{ itemName: "CỔ", kg: 40, warehouse: "" }], ctx);
    const { lines, carriedCount } = addFrozenStockToLedger(ledger, fresh);
    expect(carriedCount).toBe(1);
    const carried = lines.find((l) => l.id === idDon("a"));
    expect(carried).toMatchObject({ period: "2026-10", openKg: 400 });
    expect(lines.filter((l) => l.period === "2026-10" && l.inKg === 40)).toHaveLength(1);
  });

  it("tháng đã mở ⇒ chỉ nối thêm, không đụng dòng cũ", () => {
    const ledger = [line({ id: "b", period: "2026-10", openKg: 10 })];
    const fresh = buildFrozenStockLines([{ itemName: "CỔ", kg: 5, warehouse: "" }], ctx);
    const { lines, carriedCount } = addFrozenStockToLedger(ledger, fresh);
    expect(carriedCount).toBe(0);
    expect(lines).toEqual([...ledger, ...fresh]);
  });
});

describe("xóa lô ở /wip + lọc sổ ngày", () => {
  it("đã lấy ra hoặc đã dồn sang tháng sau ⇒ chặn", () => {
    const lot = line({ id: "wip|1", inKg: 50, importDate: "2026-10-15", note: "⟦SX:Đông⟧" });
    expect(frozenLineRemovalBlocker(lot, [lot])).toBe("");
    expect(frozenLineRemovalBlocker({ ...lot, outKg: 5 }, [lot])).toMatch(/lấy ra/);
    const carried = line({ id: idDon("wip|1"), period: "2026-11", openKg: 50, carriedFromId: "wip|1" });
    expect(frozenLineRemovalBlocker(lot, [lot, carried])).toMatch(/dồn sang tháng sau/);
  });

  it("lọc theo ngày SX + xưởng; dòng dồn kỳ vẫn nhận là từ SX", () => {
    const a = line({ id: "wip|a", importDate: "2026-10-15", note: "⟦SX:Đông⟧" });
    const b = line({ id: "wip|b", importDate: "2026-10-15", note: "⟦SX:Cá⟧" });
    const c = line({ id: "wip|c", importDate: "2026-10-14", note: "⟦SX:Đông⟧" });
    const manual = line({ id: "msl|d", importDate: "2026-10-15" });
    const ledger = [a, b, c, manual];
    expect(frozenLinesOf(ledger, "2026-10-15", "2026-10-15", "Đông").map((l) => l.id)).toEqual(["wip|a"]);
    expect(frozenLinesOf(ledger, "2026-10-14", "2026-10-15", "Tất cả")).toHaveLength(3);
    expect(isFromProductionFrozen({ id: "carry|carry|wip|a" })).toBe(true);
    expect(isFromProductionFrozen(manual)).toBe(false);
  });
});
