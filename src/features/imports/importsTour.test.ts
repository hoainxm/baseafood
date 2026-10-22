// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R10 (phủ nhãn trạng thái, khuôn AC-10),
// AC-5 (bước ghi chỉ có khi được cấp quyền), R5 (bước cuối trả về chế độ lúc bắt đầu).
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PERIOD_OPTIONS } from "@/lib/periodUtils";
import { buildImportsTour, type ImportsTourContext } from "./importsTour";

const dir = new URL("./", import.meta.url).pathname;
const screenSource = ["MaterialImportScreen.tsx", "ImportSteps.tsx", "DailyScrapSection.tsx", "ImportReport.tsx", "OcrReviewPanel.tsx"]
  .map((f) => readFileSync(dir + f, "utf8"))
  .join("\n");

function ctx(over: Partial<ImportsTourContext> = {}): ImportsTourContext {
  return {
    can: { create: true, update: true, lock: true, unlock: true },
    hasOcr: true,
    startView: "entry",
    showView: vi.fn(),
    ...over,
  };
}

const textOf = (c: ImportsTourContext) =>
  buildImportsTour(c)
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildImportsTour", () => {
  it("đủ quyền ⇒ ≤ 22 bước, id không trùng, mở đầu + kết thúc là lời giữa trang", () => {
    const { steps } = buildImportsTour(ctx());
    expect(steps.length).toBeLessThanOrEqual(22);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự theo công việc: đầu chuyến → dòng hàng → lưu → đã ghi → phế liệu → chốt → báo cáo (R2)", () => {
    const ids = buildImportsTour(ctx()).steps.map((s) => s.id);
    const order = ["shipment-header", "backdate", "lines", "save-bar", "day-list", "scrap", "day-lock", "lock-action", "report-period", "ledger-filters", "ledger-shipments"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("R10: lời tour phủ đủ nhãn trạng thái đang hiện trên trang (nhãn có trong code + có trong lời)", () => {
    // Nhãn viết thẳng trên trang (chuỗi trong .tsx của khu imports).
    const pageLabels = [
      "Ghi bù",
      "Lý do ghi bù",
      "Đã chốt",
      "Chưa chốt",
      "lúc chốt",
      "sau chốt",
      "Dữ liệu cũ",
      "Chưa có giá",
      "Chưa cân",
      "Đã cân",
      "Chưa lưu",
      "Chưa lưu được — còn thiếu",
      "Chờ hóa đơn",
      "Chờ giá (kg)",
      "Khớp danh mục",
      "Đã có trong sổ",
      "Mới, kiểm kỹ",
      "Chưa khớp, chọn tay",
      "Lệch",
      "Không ghi xe",
    ];
    // Nhãn phải thật sự có trên trang (khỏi test xanh vì lời tour nói nhãn đã bỏ).
    expect(pageLabels.filter((l) => !screenSource.includes(l))).toEqual([]);
    // + hằng số kỳ xem (lib/periodUtils) và dải nhắc việc (features/shared/DailyTaskReminder).
    const labels = [...pageLabels, ...PERIOD_OPTIONS.map((o) => o.label), "Việc hôm nay", "Hôm nay đã chốt"];
    const text = textOf(ctx());
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("AC-5: không quyền ghi / chốt / mở lại ⇒ 0 bước ghi; đủ quyền ⇒ đủ", () => {
    const writeIds = new Set(["shipment-header", "ocr", "backdate", "lines", "lot", "save-bar", "lock-action", "bulk-type-change"]);
    const count = (c: ImportsTourContext) => buildImportsTour(c).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count(ctx({ can: { create: false, update: false, lock: false, unlock: false } }))).toBe(0);
    expect(count(ctx())).toBe(writeIds.size);
    expect(buildImportsTour(ctx({ hasOcr: false })).steps.some((s) => s.id === "ocr")).toBe(false);
  });

  it("bước chỉ đổi chế độ xem; bước cuối trả về chế độ lúc bắt đầu (R1 · R5)", () => {
    const c = ctx({ startView: "report" });
    const steps = buildImportsTour(c).steps;
    steps.find((s) => s.id === "ledger-filters")?.prepare?.();
    expect(c.showView).toHaveBeenLastCalledWith("ledger");
    steps.find((s) => s.id === "scrap")?.prepare?.();
    expect(c.showView).toHaveBeenLastCalledWith("entry");
    steps[steps.length - 1].prepare?.();
    expect(c.showView).toHaveBeenLastCalledWith("report");
  });

  it("các bước cùng chế độ xem dùng CHUNG một hàm prepare (GuidedTour dò trước bước tùy chọn theo hàm)", () => {
    const steps = buildImportsTour(ctx()).steps;
    const byView = (ids: string[]) => new Set(ids.map((id) => steps.find((s) => s.id === id)?.prepare)).size;
    expect(byView(["mode-tabs", "shipment-header", "day-list", "lock-action"])).toBe(1);
    expect(byView(["ledger-filters", "ledger-tools", "bulk-type-change", "ledger-shipments"])).toBe(1);
    // Lời mở và lời kết KHÔNG dùng chung hàm với bước nào (khỏi đánh dấu nhầm bước tùy chọn là thiếu).
    const intro = steps[0].prepare;
    const outro = steps[steps.length - 1].prepare;
    expect(steps.slice(1, -1).some((s) => s.prepare === intro || s.prepare === outro)).toBe(false);
  });
});
