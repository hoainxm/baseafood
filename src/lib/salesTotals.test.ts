// Oracle: docs/app-map/33-ban-hang.md §4 — tiền Xuất khẩu (USD) và Nội địa (VND) không cộng chung.
import { describe, expect, it } from "vitest";
import { sumSalesAmountByChannel } from "./salesTotals";

const inv = (id: string, channel: "Xuất khẩu" | "Nội địa") => ({ id, channel });
const line = (invoiceId: string, quantityKg: number, unitPrice: number | null) => ({ invoiceId, quantityKg, unitPrice });

describe("Tổng tiền bán theo kênh", () => {
  it("tách USD và VND, không cộng chung", () => {
    const r = sumSalesAmountByChannel(
      [line("x1", 1000, 10.5), line("x1", 200, 4.05), line("n1", 50, 120000), line("x2", 100, 0.1), line("x2", 200, 0.1)],
      [inv("x1", "Xuất khẩu"), inv("x2", "Xuất khẩu"), inv("n1", "Nội địa")],
    );
    expect(r.byChannel).toEqual([
      { channel: "Xuất khẩu", unit: "USD", amount: 11340, lineCount: 4 },
      { channel: "Nội địa", unit: "đ", amount: 6000000, lineCount: 1 },
    ]);
    expect(r.orphanLineCount).toBe(0);
  });

  it("dòng chưa có giá tính 0 tiền nhưng vẫn đếm dòng; dòng mất phiếu đếm riêng", () => {
    const r = sumSalesAmountByChannel([line("x1", 500, null), line("gone", 10, 5)], [inv("x1", "Xuất khẩu")]);
    expect(r.byChannel[0]).toEqual({ channel: "Xuất khẩu", unit: "USD", amount: 0, lineCount: 1 });
    expect(r.byChannel[1].lineCount).toBe(0);
    expect(r.orphanLineCount).toBe(1);
  });
});
