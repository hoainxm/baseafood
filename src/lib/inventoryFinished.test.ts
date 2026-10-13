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
      sanXuat: [], exportOrders: [], exportItems: [], salesItems: [], packagings: [] as Packaging[],
      opening: [], products: [], tuNgay: fromDate, denNgay: toDate, ...p,
    })
  );

describe("computeFinishedGoodNxt — tồn đầu khai tay có mốc (cùng quy tắc với sổ NL)", () => {
  const opening = [makeOpening("2026-07-01", 500)];

  test("xem tháng 7 (mốc = đầu khoảng) và xem cả năm (mốc giữa khoảng) cùng ra 500", () => {
    expect(goi("2026-07-01", "2026-07-31", { opening }).tonCuoi).toBe(500);
    expect(goi("2026-01-01", "2026-12-31", { opening }).tonCuoi).toBe(500);
  });

  test("SX/bán TRƯỚC mốc đã nằm trong số khai tay ⇒ không cộng chồng; từ mốc mới tính", () => {
    const p = { opening, sanXuat: [me("w1", "2026-06-20", 200), me("w2", "2026-07-05", 80)], salesItems: [ban("b1", "2026-06-25", 30)] };
    const thang7 = goi("2026-07-01", "2026-07-31", p);
    expect(thang7.tonDau).toBe(500);
    expect(thang7.nhap).toBe(80);
    expect(thang7.tonCuoi).toBe(580);
    const nam = goi("2026-01-01", "2026-12-31", p);
    expect(nam.tonDau).toBe(500);
    expect(nam.nhap).toBe(80);
    expect(nam.xuatBan).toBe(0);
    expect(nam.tonCuoi).toBe(580);
    // Xem sau mốc: phát sinh từ mốc tới trước kỳ dồn vào tồn đầu.
    expect(goi("2026-08-01", "2026-08-31", p).tonDau).toBe(580);
  });

  test("xem TRƯỚC mốc: chưa áp khai tay, phát sinh tính bình thường", () => {
    const p = { opening, sanXuat: [me("w1", "2026-06-20", 200)] };
    expect(goi("2026-06-01", "2026-06-30", p).tonCuoi).toBe(200);
  });

  test("không khai tồn đầu ⇒ như cũ: mọi phát sinh trước kỳ dồn vào tồn đầu", () => {
    const p = { sanXuat: [me("w1", "2026-06-20", 200)], salesItems: [ban("b1", "2026-07-03", 50)] };
    const t = goi("2026-07-01", "2026-07-31", p);
    expect(t.tonDau).toBe(200);
    expect(t.xuatBan).toBe(50);
    expect(t.tonCuoi).toBe(150);
  });
});
