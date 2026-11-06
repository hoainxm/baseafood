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

  it("thứ tự theo công việc: chờ nhập → quét / duyệt → lọc → chỉ số → bảng tồn → tuổi tồn, dung tích (R2)", () => {
    const ids = buildWarehouseTour({ can: { approve: true } }).steps.map((s) => s.id);
    // 2026-11-02 (Đầu trang gọn): tổng quan tuổi tồn + dung tích xuống SAU bảng tồn.
    // 2026-11-03 (rà UX): lọc → thẻ số → bảng, như mọi sổ; thẻ "Chờ nhập" bỏ (số đã ở đầu khối duyệt).
    const order = ["pending", "scan", "approve", "filter", "stats", "stock", "lot-detail", "age", "capacity"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("gỡ duyệt nhầm: có quyền Duyệt ⇒ bước chi tiết lô kể Hủy duyệt và các trường hợp bị chặn; không quyền ⇒ không kể", () => {
    const body = (approve: boolean) => buildWarehouseTour({ can: { approve } }).steps.find((s) => s.id === "lot-detail")?.body ?? "";
    expect(body(true)).toContain("Hủy duyệt nhập kho");
    expect(body(true)).toContain("Hủy lệnh xuất");
    expect(body(true)).toContain("Xưởng ghi");
    expect(body(false)).not.toContain("Hủy duyệt");
  });

  it("AC-10: lời tour gọi đủ nhãn nhóm tuổi tồn và nhãn trạng thái lô đang hiện trên trang", () => {
    const all = text(true);
    const labels = [
      ...bucketStockByAge([], "2026-10-22").map((g) => g.label),
      "chờ nhập kho",
      "đã nhập kho",
      "Bán vượt",
      "Tổng tồn",
      "Chưa có tồn trong kho",
    ];
    expect(labels.filter((l) => !all.includes(l))).toEqual([]);
  });
});
