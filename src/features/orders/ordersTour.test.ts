// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3/AC-5 (bước ghi theo quyền), R4 (đơn minh họa),
// AC-4 (không có đơn), R10/AC-10 (phủ nhãn trạng thái của màn).
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ExportOrder, OrderItem, SalesOrder } from "@/types";
import { buildOrdersTour, pickTourOrder, type OrdersTourContext } from "./ordersTour";

const order = (id: string, over: Partial<SalesOrder> = {}): SalesOrder => ({ id, customerId: "k", orderDate: "2026-10-01", status: "collecting", note: "", ...over });
const item = (orderId: string): OrderItem => ({ id: `i-${orderId}`, orderId, productId: "p", spec: "", requiredQuantityKg: 100, requiredBlocksCount: 0 });
const exportOrder = (orderId: string): ExportOrder => ({ id: `l-${orderId}`, orderId, exportDate: "2026-10-02", status: "closed", note: "" });

/** Nhãn trạng thái đơn đọc thẳng từ màn (hằng `STATUS_LABELS`) — đổi nhãn mà quên lời tour ⇒ đỏ. */
function screenStatusLabels(): string[] {
  const src = readFileSync(new URL("./SalesOrderScreen.tsx", import.meta.url), "utf8");
  const block = src.match(/const STATUS_LABELS[^=]*=\s*\{([\s\S]*?)\};/);
  if (!block) throw new Error("không thấy STATUS_LABELS ở SalesOrderScreen.tsx");
  return [...block[1].matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
}

function ctx(over: Partial<OrdersTourContext> = {}): OrdersTourContext {
  return { pick: "o1", can: { create: true, update: true, delete: true }, openOrder: vi.fn(), restoreView: vi.fn(), ...over };
}

describe("pickTourOrder", () => {
  it("ưu tiên đơn chưa xuất xong, có dòng hàng, có lệnh xuất", () => {
    const orders = [order("xong", { status: "closed" }), order("trong"), order("co-dong"), order("co-lenh", { orderDate: "2026-09-01" })];
    const items = [item("xong"), item("co-dong"), item("co-lenh")];
    expect(pickTourOrder(orders, items, [exportOrder("co-lenh"), exportOrder("xong")])).toBe("co-lenh");
    expect(pickTourOrder(orders, items, [])).toBe("co-dong");
  });

  it("chỉ có đơn đã xuất ⇒ dùng đơn đó; không có đơn ⇒ null", () => {
    expect(pickTourOrder([order("xong", { status: "closed" })], [], [])).toBe("xong");
    expect(pickTourOrder([], [], [])).toBeNull();
  });
});

describe("buildOrdersTour", () => {
  it("bước chi tiết mở đúng đơn minh họa; bước danh sách và lời kết trả chỗ xem", () => {
    const c = ctx();
    const steps = buildOrdersTour(c).steps;
    steps.find((s) => s.id === "detail-lines")?.prepare?.();
    expect(c.openOrder).toHaveBeenCalledWith("o1");
    steps.find((s) => s.id === "outro")?.prepare?.();
    steps.find((s) => s.id === "stats")?.prepare?.();
    expect(c.restoreView).toHaveBeenCalledTimes(2);
  });

  it("không có đơn ⇒ không bước nào mở đơn, đúng 1 lời giữa trang kể chi tiết đơn", () => {
    const c = ctx({ pick: null });
    const steps = buildOrdersTour(c).steps;
    steps.forEach((s) => s.prepare?.());
    expect(c.openOrder).not.toHaveBeenCalled();
    const overview = steps.filter((s) => s.id === "detail-overview");
    expect(overview).toHaveLength(1);
    expect(overview[0].target ?? "").toBe("");
  });

  it("chỉ xem ⇒ không bước Tạo đơn / Xác nhận đủ – lệnh xuất, không nhắc Kiểm lô bằng quét", () => {
    const view = buildOrdersTour(ctx({ can: { create: false, update: false, delete: false } })).steps;
    expect(view.filter((s) => s.id === "create" || s.id === "detail-actions")).toHaveLength(0);
    expect(view.some((s) => s.body.includes("Kiểm lô bằng quét"))).toBe(false);
    const full = buildOrdersTour(ctx()).steps;
    expect(full.filter((s) => s.id === "create" || s.id === "detail-actions")).toHaveLength(2);
  });

  it("AC-10: lời tour gọi đủ nhãn trạng thái đơn và thẻ dòng hàng đang hiện trên trang", () => {
    const text = buildOrdersTour(ctx())
      .steps.map((s) => `${s.title}\n${s.body}`)
      .join("\n");
    const labels = [...screenStatusLabels(), "Còn thiếu", "Đã quét", "Chưa quét", "Đủ lô", "Thay lô", "Lệnh xuất (một phần được)", "Xác nhận đủ"];
    expect(screenStatusLabels().length).toBeGreaterThanOrEqual(3);
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });
});
