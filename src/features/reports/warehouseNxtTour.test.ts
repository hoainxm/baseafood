// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R3 (bước theo quyền), R10 (phủ nhãn đang hiện).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE_LOCATION, STORAGE_KIND_LABELS } from "@/types";
import { buildWarehouseNxtTour } from "./warehouseNxtTour";

const screen = readFileSync(new URL("./WarehouseNxtScreen.tsx", import.meta.url), "utf8");
const textOf = (t: ReturnType<typeof buildWarehouseNxtTour>) => t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");
const WRITE_IDS = ["import-file", "edit-mode", "next-period"];

describe("buildWarehouseNxtTour", () => {
  it("phủ nhãn đang hiện trên trang: kiểm bất biến, kho lưu, nút ghi", () => {
    const text = textOf(buildWarehouseNxtTour({ canWrite: true, canExport: true }));
    const screenLabels = [
      "Khớp bất biến",
      "Lệch bất biến",
      "Tất cả kho lưu",
      "Xem tất cả kho lưu",
      "Tồn cuối theo kho lưu",
      "Nhập Excel báo cáo",
      "Ghi nhập/xuất",
      "Xong · xem lại",
      "Thêm mã",
      "Tạo kỳ kế tiếp",
      "Tạo kỳ · kế thừa tồn",
      "Gán kho lưu",
      "SL mặt hàng",
    ];
    const labels = [...screenLabels, DEFAULT_STORAGE_LOCATION, ...Object.values(STORAGE_KIND_LABELS)];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
    expect(screenLabels.filter((l) => !screen.includes(l))).toEqual([]);
  });

  it("chỉ xem ⇒ 0 bước ghi, không nhắc Gán kho lưu, không bước xuất; đủ quyền ⇒ đủ", () => {
    const view = buildWarehouseNxtTour({ canWrite: false, canExport: false });
    expect(view.steps.filter((s) => WRITE_IDS.includes(s.id)).map((s) => s.id)).toEqual([]);
    expect(view.steps.some((s) => s.id === "export")).toBe(false);
    expect(textOf(view)).not.toContain("Gán kho lưu");
    const all = buildWarehouseNxtTour({ canWrite: true, canExport: true });
    expect(all.steps.filter((s) => WRITE_IDS.includes(s.id)).map((s) => s.id)).toEqual(WRITE_IDS);
    expect(all.steps.some((s) => s.id === "export")).toBe(true);
  });

  it("thứ tự công việc: nạp file → lọc → bảng → ghi → tạo kỳ → xuất", () => {
    const ids = buildWarehouseNxtTour({ canWrite: true, canExport: true }).steps.map((s) => s.id);
    const at = ["import-file", "filters", "table", "edit-mode", "next-period", "export"].map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
