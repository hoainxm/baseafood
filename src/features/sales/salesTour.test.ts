// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3/AC-5 (bước ghi theo quyền), R10/AC-10 (phủ nhãn).
import { describe, expect, it } from "vitest";
import { SALES_CHANNELS } from "@/types";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildSalesTour, type SalesTourContext } from "./salesTour";

const FULL: SalesTourContext["can"] = { create: true, update: true, viewPrice: true };
const textOf = (can: SalesTourContext["can"]) =>
  buildSalesTour({ can })
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildSalesTour", () => {
  it("chỉ xem ⇒ không bước Ghi phiếu bán / Thêm mặt hàng / Gắn lô; đủ quyền ⇒ đủ 3", () => {
    const writeIds = new Set(["create", "add-item", "lot"]);
    const count = (can: SalesTourContext["can"]) => buildSalesTour({ can }).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count({ create: false, update: false, viewPrice: true })).toBe(0);
    expect(count(FULL)).toBe(3);
    // Chỉ quyền sửa: vẫn gắn lô được, không ghi phiếu mới.
    expect(count({ create: false, update: true, viewPrice: true })).toBe(1);
  });

  it("không quyền xem giá ⇒ lời tour không nhắc đơn giá, thành tiền, tổng tiền", () => {
    const text = textOf({ ...FULL, viewPrice: false });
    expect(["Đơn giá", "Thành tiền", "Chưa có giá", "Tổng tiền bán"].filter((l) => text.includes(l))).toEqual([]);
  });

  it("thứ tự theo công việc: tab → ghi phiếu → kỳ xem → phiếu → dòng → gắn lô → tổng (R2)", () => {
    const ids = buildSalesTour({ can: FULL }).steps.map((s) => s.id);
    const order = ["intro", "create", "add-item", "stats", "filter", "invoice", "items", "lot", "totals", "outro"];
    expect(ids).toEqual(order);
  });

  it("AC-10: lời tour gọi đủ nhãn kênh, kỳ xem, nguồn bán và thẻ trạng thái đang hiện trên trang", () => {
    const text = textOf(FULL);
    const labels = [
      ...SALES_CHANNELS,
      ...PERIOD_OPTIONS.map((o) => o.label),
      "Block thô (kho dự trữ)",
      "Đóng gói (kho thành phẩm)",
      "Ghi bù",
      "Lý do ghi bù",
      "Chưa có giá",
      "Tồn khả dụng",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });
});
