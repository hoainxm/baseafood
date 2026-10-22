// ============================================================
// Tên file: src/lib/salesTotals.ts
// Tên tiếng Việt: Tổng tiền bán theo kênh — Xuất khẩu (USD) và Nội địa (VND) không cộng chung
// Description: Pure helper for the sales ledger totals: amount per channel (channel lives on the
//              invoice, amount on each line). Lines whose invoice is missing are counted apart.
//              Oracle: docs/app-map/33-ban-hang.md §4 (bẫy hai kênh).
// ============================================================
import { SALES_CHANNELS, calculateSalesAmount, type SalesChannel, type SalesInvoice, type SalesItem } from "@/types";

export interface ChannelAmount {
  channel: SalesChannel;
  /** Đơn vị tiền của kênh: Xuất khẩu = USD, Nội địa = đ. */
  unit: "USD" | "đ";
  amount: number;
  /** Số dòng của kênh trong phần đang xem (0 ⇒ màn không cần hiện kênh này). */
  lineCount: number;
}

export const SALES_CHANNEL_UNITS: Record<SalesChannel, "USD" | "đ"> = { "Xuất khẩu": "USD", "Nội địa": "đ" };

/**
 * Cộng thành tiền theo kênh của phiếu. KHÔNG cộng USD với VND (33 §4). Dòng không tìm thấy phiếu
 * (phiếu đã xóa) không vào kênh nào — trả riêng ở `orphanLineCount`.
 */
export function sumSalesAmountByChannel(
  items: readonly Pick<SalesItem, "invoiceId" | "quantityKg" | "unitPrice">[],
  invoices: readonly Pick<SalesInvoice, "id" | "channel">[],
): { byChannel: ChannelAmount[]; orphanLineCount: number } {
  const channelOf = new Map(invoices.map((i) => [i.id, i.channel]));
  const acc = new Map<SalesChannel, { amount: number; lineCount: number }>(SALES_CHANNELS.map((c) => [c, { amount: 0, lineCount: 0 }]));
  let orphanLineCount = 0;
  for (const it of items) {
    const ch = channelOf.get(it.invoiceId);
    const slot = ch ? acc.get(ch) : undefined;
    if (!slot) {
      orphanLineCount += 1;
      continue;
    }
    slot.amount += calculateSalesAmount(it);
    slot.lineCount += 1;
  }
  return {
    byChannel: SALES_CHANNELS.map((channel) => {
      const a = acc.get(channel) as { amount: number; lineCount: number };
      // Làm tròn 2 số lẻ — khỏi vệt số thực (0,1 + 0,2).
      return { channel, unit: SALES_CHANNEL_UNITS[channel], amount: Math.round(a.amount * 100) / 100, lineCount: a.lineCount };
    }),
    orphanLineCount,
  };
}
