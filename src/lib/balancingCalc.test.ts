import { describe, it, expect } from "vitest";
import { calculateBalancing } from "@/lib/balancingCalc";
import type {
  BalancingPeriod,
  BalancingInputItem,
  ScrapItem,
  BalancingOutputItem,
} from "@/types";

// Công thức cốt lõi của Cân đối kỳ — sai là kế toán chốt số sai. Số tròn để
// đối chiếu tay dễ.
const period = {
  exchangeRate: 25000,
  processingCostPerKg: 1000,
  totalInputKg: 1000, // dùng cho yieldRate (khác tổng NL của các dòng input)
} as BalancingPeriod;

const inputs = [
  { quantityKg: 100, unitPrice: 2000 }, // materialValue = 200.000
] as BalancingInputItem[];

const outputs = [
  { quantityKg: 40, unitPrice: 3, channel: "Xuất khẩu" }, // 40*3=120 *25000 = 3.000.000
  { quantityKg: 10, unitPrice: 5000, channel: "Nội địa" }, // 50.000 (không quy tỷ giá)
] as BalancingOutputItem[];

const scraps = [{ quantityKg: 5, sellingPrice: 1000 }] as ScrapItem[]; // 5.000

describe("calculateBalancing", () => {
  const r = calculateBalancing(period, inputs, scraps, outputs);

  it("tổng NL/TP và giá trị NL", () => {
    expect(r.totalInputKg).toBe(100);
    expect(r.totalOutputKg).toBe(50);
    expect(r.materialValue).toBe(200_000);
  });

  it("định mức = tổng NL ÷ tổng TP", () => {
    expect(r.norm).toBeCloseTo(2, 10); // 100 / 50
  });

  it("giá trị xuất: kênh Xuất khẩu quy tỷ giá, Nội địa để nguyên", () => {
    expect(r.exportValue).toBe(3_050_000); // 3.000.000 + 50.000
  });

  it("giá thành = TP × chi phí CB + giá trị NL", () => {
    expect(r.costOfGoods).toBe(250_000); // 50*1000 + 200.000
  });

  it("lãi/lỗ = giá trị xuất − giá thành", () => {
    expect(r.profitOrLoss).toBe(2_800_000); // 3.050.000 − 250.000
  });

  it("lãi bình quân mỗi kg NL", () => {
    expect(r.avgProfitPerKgMaterial).toBeCloseTo(28_000, 6); // 2.800.000 / 100
  });

  it("yieldRate = tổng TP ÷ period.totalInputKg", () => {
    expect(r.yieldRate).toBeCloseTo(0.05, 10); // 50 / 1000
  });

  it("giá trị phế liệu", () => {
    expect(r.scrapValue).toBe(5_000);
  });

  it("không chia cho 0: TP rỗng ⇒ norm 0, yieldRate null khi thiếu totalInputKg", () => {
    const empty = calculateBalancing(
      { exchangeRate: 0, processingCostPerKg: 0 } as BalancingPeriod,
      [] as BalancingInputItem[],
      [] as ScrapItem[],
      [] as BalancingOutputItem[],
    );
    expect(empty.norm).toBe(0);
    expect(empty.yieldRate).toBeNull();
    expect(empty.avgProfitPerKgMaterial).toBe(0);
  });
});
