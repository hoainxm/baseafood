import { describe, expect, test } from "vitest";
import type { FinishedGoodsOpeningStock, Packaging, SalesItem, WipProductionItem } from "@/types";
import { computeFinishedGoodNxt, sumFinishedGoodNxt, type FinishedGoodNxtArgs } from "./inventoryFinished";
import { RETAIL_WAREHOUSE } from "./inventory";

const me = (id: string, productionDate: string, quantityKg: number): WipProductionItem =>
  ({ id, productId: "p1", spec: "s1", productionDate, quantityKg, blocksCount: 0, status: "stocked", warehouse: "" }) as WipProductionItem;
const ban = (id: string, deliveryDate: string, quantityKg: number): SalesItem =>
  ({ id, productId: "p1", spec: "s1", deliveryDate, quantityKg, sourceWarehouse: RETAIL_WAREHOUSE }) as SalesItem;
const makeOpening = (asOfDate: string, quantityKg: number): FinishedGoodsOpeningStock => ({
  id: `o${asOfDate}`, productId: "p1", spec: "s1", asOfDate, quantityKg, blocksCount: 0, warehouse: "", note: "",
});

const goi = (fromDate: string, toDate: string, p: Partial<FinishedGoodNxtArgs> = {}) =>
  sumFinishedGoodNxt(
    computeFinishedGoodNxt({
      wips: [], exportOrders: [], exportItems: [], salesItems: [], packagings: [] as Packaging[],
      opening: [], products: [], fromDate, toDate, ...p,
    })
  );

describe("computeFinishedGoodNxt — tồn đầu khai tay có mốc (cùng quy tắc với sổ NL)", () => {
  const opening = [makeOpening("2026-07-01", 500)];

  test("xem tháng 7 (mốc = đầu khoảng) và xem cả năm (mốc giữa khoảng) cùng ra 500", () => {
    expect(goi("2026-07-01", "2026-07-31", { opening }).closingKg).toBe(500);
    expect(goi("2026-01-01", "2026-12-31", { opening }).closingKg).toBe(500);
  });

  test("SX/bán TRƯỚC mốc đã nằm trong số khai tay ⇒ không cộng chồng; từ mốc mới tính", () => {
    const p = { opening, wips: [me("w1", "2026-06-20", 200), me("w2", "2026-07-05", 80)], salesItems: [ban("b1", "2026-06-25", 30)] };
    const thang7 = goi("2026-07-01", "2026-07-31", p);
    expect(thang7.openingKg).toBe(500);
    expect(thang7.inKg).toBe(80);
    expect(thang7.closingKg).toBe(580);
    const nam = goi("2026-01-01", "2026-12-31", p);
    expect(nam.openingKg).toBe(500);
    expect(nam.inKg).toBe(80);
    expect(nam.retailOutKg).toBe(0);
    expect(nam.closingKg).toBe(580);
    // Xem sau mốc: phát sinh từ mốc tới trước kỳ dồn vào tồn đầu.
    expect(goi("2026-08-01", "2026-08-31", p).openingKg).toBe(580);
  });

  test("xem TRƯỚC mốc: chưa áp khai tay, phát sinh tính bình thường", () => {
    const p = { opening, wips: [me("w1", "2026-06-20", 200)] };
    expect(goi("2026-06-01", "2026-06-30", p).closingKg).toBe(200);
  });

  test("không khai tồn đầu ⇒ như cũ: mọi phát sinh trước kỳ dồn vào tồn đầu", () => {
    const p = { wips: [me("w1", "2026-06-20", 200)], salesItems: [ban("b1", "2026-07-03", 50)] };
    const t = goi("2026-07-01", "2026-07-31", p);
    expect(t.openingKg).toBe(200);
    expect(t.retailOutKg).toBe(50);
    expect(t.closingKg).toBe(150);
  });
});
