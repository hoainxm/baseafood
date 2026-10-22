// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3/AC-5 (bước ghi theo quyền), R10/AC-10 (phủ nhãn).
import { describe, expect, it } from "vitest";
import { bucketStockByAge } from "@/lib/dataFlow";
import { buildWarehouseTour } from "./warehouseTour";

const text = (approve: boolean) =>
  buildWarehouseTour({ can: { approve } })
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildWarehouseTour", () => {
  it("không có quyền Duyệt ⇒ không bước quét tem / duyệt nhập kho; có quyền ⇒ đủ 2 bước", () => {
    const writeIds = new Set(["scan", "approve"]);
    const count = (approve: boolean) => buildWarehouseTour({ can: { approve } }).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count(false)).toBe(0);
    expect(count(true)).toBe(2);
  });

  it("bước 1 là lời giới thiệu giữa trang, bước cuối là lời kết", () => {
    const { steps } = buildWarehouseTour({ can: { approve: true } });
    expect(steps[0].id).toBe("intro");
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự theo công việc: chỉ số → chờ nhập → quét / duyệt → tuổi tồn → bảng tồn (R2)", () => {
    const ids = buildWarehouseTour({ can: { approve: true } }).steps.map((s) => s.id);
    const order = ["stats", "pending", "scan", "approve", "age", "capacity", "filter", "stock"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("AC-10: lời tour gọi đủ nhãn nhóm tuổi tồn và nhãn trạng thái lô đang hiện trên trang", () => {
    const all = text(true);
    const labels = [
      ...bucketStockByAge([], "2026-10-22").map((g) => g.label),
      "Chờ nhập",
      "chờ nhập kho",
      "đã nhập kho",
      "Bán vượt",
      "Tổng tồn",
      "Chưa có tồn trong kho",
    ];
    expect(labels.filter((l) => !all.includes(l))).toEqual([]);
  });
});
