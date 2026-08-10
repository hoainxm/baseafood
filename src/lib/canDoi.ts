import type { BalancingPeriod, BalancingInputItem, ScrapItem, BalancingOutputItem } from "@/types";

export interface BalancingResult {
  totalInputKg: number; // kg
  materialValue: number; // VND
  totalOutputKg: number; // kg
  norm: number; // totalInputKg ÷ totalOutputKg
  exportValue: number; // VND (adjusted by exchange rate for USD channels)
  costOfGoods: number; // VND
  profitOrLoss: number; // VND ( + profit / − loss )
  avgProfitPerKgMaterial: number; // profitOrLoss ÷ totalInputKg — lãi bình quân mỗi kg NL (khớp "Bình quân /kg nl" của báo cáo giấy)
  yieldRate: number | null; // totalOutputKg ÷ totalInputKg (typically ~0.45)
  scrapValue: number; // VND
}

export function calculateBalancing(
  period: BalancingPeriod,
  inputs: BalancingInputItem[],
  scraps: ScrapItem[],
  outputs: BalancingOutputItem[],
): BalancingResult {
  const exchangeRate = period.exchangeRate ?? 0;
  const processingCostPerKg = period.processingCostPerKg ?? 0;

  const totalInputKg = inputs.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const materialValue = inputs.reduce((s, r) => s + r.quantityKg * (r.unitPrice ?? 0), 0);
  const totalOutputKg = outputs.reduce((s, r) => s + (r.quantityKg || 0), 0);

  const exportValue = outputs.reduce((s, r) => {
    const amount = r.quantityKg * (r.unitPrice ?? 0);
    return s + (r.channel === "Xuất khẩu" ? amount * exchangeRate : amount);
  }, 0);

  const costOfGoods = totalOutputKg * processingCostPerKg + materialValue;
  const profitOrLoss = exportValue - costOfGoods;

  const scrapValue = scraps.reduce(
    (s, r) => s + r.quantityKg * (r.sellingPrice ?? 0),
    0,
  );

  return {
    totalInputKg,
    materialValue,
    totalOutputKg,
    norm: totalOutputKg > 0 ? totalInputKg / totalOutputKg : 0,
    exportValue,
    costOfGoods,
    profitOrLoss,
    avgProfitPerKgMaterial: totalInputKg > 0 ? profitOrLoss / totalInputKg : 0,
    yieldRate:
      period.totalInputKg && period.totalInputKg > 0 ? totalOutputKg / period.totalInputKg : null,
    scrapValue,
  };
}
