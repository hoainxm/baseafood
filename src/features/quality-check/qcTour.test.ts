// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R10 (phủ nhãn trạng thái, khuôn AC-10),
// AC-5 (bước ghi chỉ có khi được cấp quyền).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildQcTour, type QcTourContext } from "./qcTour";

const screenSource = readFileSync(new URL("./QcChecklistScreen.tsx", import.meta.url).pathname, "utf8");

/** Nhãn kết quả lấy THẲNG từ hằng số RESULT_OPTIONS của màn — thêm kết quả mà quên lời ⇒ đỏ. */
function resultLabels(): string[] {
  const block = screenSource.match(/const RESULT_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
  return [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
}

const full: QcTourContext = { can: { write: true, lock: true, unlock: true } };
const textOf = (c: QcTourContext) =>
  buildQcTour(c)
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildQcTour", () => {
  it("đọc được nhãn kết quả từ màn (khỏi test xanh vì quét hụt)", () => {
    expect(resultLabels().length).toBeGreaterThanOrEqual(3);
  });

  it("R10: lời tour phủ đủ nhãn kết quả + trạng thái ngày + nhãn biểu đồ", () => {
    const labels = [...resultLabels(), "Đã chốt", "Chưa chốt", "Lý do ghi bù", "Tạm (cần khắc phục)", "Chưa chấm QC ngày này"];
    expect(labels.filter((l) => !screenSource.includes(l))).toEqual([]);
    const text = textOf(full);
    expect(labels.filter((l) => l !== "Chưa chấm QC ngày này" && !text.includes(l))).toEqual([]);
    // Người chỉ xem: lời bảng kết quả nói cả nhãn kết quả và trạng thái chưa chấm.
    const viewText = textOf({ can: { write: false, lock: false, unlock: false } });
    expect([...resultLabels(), "Chưa chấm QC ngày này"].filter((l) => !viewText.includes(l))).toEqual([]);
  });

  it("thứ tự theo công việc: ngày → trạng thái → chấm → lưu → chốt (R2)", () => {
    const ids = buildQcTour(full).steps.map((s) => s.id);
    const order = ["filter", "status", "criteria", "save", "lock-action", "outro"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("AC-5: chỉ xem ⇒ 0 bước ghi; đủ quyền ⇒ đủ", () => {
    const writeIds = new Set(["backdate", "add-criterion", "save", "lock-action"]);
    const count = (c: QcTourContext) => buildQcTour(c).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count({ can: { write: false, lock: false, unlock: false } })).toBe(0);
    expect(count(full)).toBe(writeIds.size);
    expect(count({ can: { write: false, lock: true, unlock: false } })).toBe(1);
  });
});
