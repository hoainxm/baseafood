// Oracle: docs/app-map/43-guided-tour.ba-spec.md — R1 (chỉ đổi chế độ xem), R2 (thứ tự công việc),
// AC-5 khuôn (người không có quyền không bị dẫn tới chỗ ghi), AC-10 khuôn (lời phủ nhãn trạng thái
// đang hiện trên trang /wip), R5 (bước cuối trả về chế độ lúc bắt đầu).
import { describe, expect, it, vi } from "vitest";
import { buildWipTour, type WipTourContext } from "./wipTour";

function ctx(over: Partial<WipTourContext> = {}): WipTourContext {
  return { can: { enter: true, lock: true, report: true }, startMode: "entry", setMode: vi.fn(), ...over };
}

const textOf = (c: WipTourContext) =>
  buildWipTour(c)
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildWipTour", () => {
  it("đủ quyền ⇒ 6–22 bước, id không trùng, mở đầu + kết thúc là lời giữa trang", () => {
    const { steps } = buildWipTour(ctx());
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.length).toBeLessThanOrEqual(22);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự công việc: phiếu ghi → lưu → sổ ngày → báo cáo → chốt ngày (R2)", () => {
    const ids = buildWipTour(ctx()).steps.map((s) => s.id);
    const order = ["session-header", "session-lots", "production-lines", "save-session", "ledger-filter", "ledger-table", "daily-report", "send-report", "day-lock", "lock-action"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("bước phiếu ghi chuyển sang Ghi nhập, bước sổ sang Sổ ngày, bước cuối trả về chế độ lúc bắt đầu", () => {
    const c = ctx({ startMode: "ledger" });
    const steps = buildWipTour(c).steps;
    steps.find((s) => s.id === "production-lines")?.prepare?.();
    expect(c.setMode).toHaveBeenLastCalledWith("entry");
    steps.find((s) => s.id === "ledger-table")?.prepare?.();
    expect(c.setMode).toHaveBeenLastCalledWith("ledger");
    steps[steps.length - 1].prepare?.();
    expect(c.setMode).toHaveBeenLastCalledWith("ledger");
  });

  it("không có phiếu Ghi nhập (chỉ xem sổ) ⇒ không bước phiếu ghi, không đổi chế độ", () => {
    const c = ctx({ can: { enter: false, lock: false, report: false }, startMode: "ledger" });
    const steps = buildWipTour(c).steps;
    const entryIds = ["mode-switch", "session-header", "session-lots", "production-lines", "domestic-sale", "frozen-stock", "save-session", "day-rows"];
    expect(steps.filter((s) => entryIds.includes(s.id))).toEqual([]);
    steps.forEach((s) => s.prepare?.());
    expect(c.setMode).not.toHaveBeenCalled();
  });

  it("bước nút ghi chỉ có khi có quyền: chỉ xem ⇒ 0; đủ quyền ⇒ 3 (Lưu vào sổ · Gửi báo cáo · Chốt / Mở lại ngày)", () => {
    const writeIds = new Set(["save-session", "send-report", "lock-action"]);
    const count = (c: WipTourContext) => buildWipTour(c).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count(ctx({ can: { enter: false, lock: false, report: false } }))).toBe(0);
    expect(count(ctx())).toBe(3);
    const steps = buildWipTour(ctx()).steps.filter((s) => writeIds.has(s.id));
    expect(steps.every((s) => s.optional)).toBe(true);
  });

  it("lời tour gọi đúng nguyên văn các nhãn trạng thái / thẻ đang hiện trên trang", () => {
    const text = textOf(ctx());
    const labels = [
      // Cột Trạng thái của sổ + thẻ số.
      "Chờ nhập kho",
      "Đã nhập kho",
      // Dải chốt ngày + nhắc việc hôm nay.
      "Chưa chốt",
      "Đã chốt",
      "Còn ghi bù",
      "Việc hôm nay",
      "Hôm nay đã chốt",
      // Lô nguyên liệu của phiên + hộp chốt.
      "Chưa khai lô — chốt ngày sẽ hỏi",
      "Chưa gắn lô",
      "Lý do chưa gắn lô",
      "Gắn lô NL",
      "Lô NL (n)",
      "Lý do ghi bù",
      "Lý do mở lại",
      // Sổ hàng đông lạnh.
      "Lô nhập Hàng tạm",
      "Đã lấy ra ở sổ kho",
      // Nút và khối chính.
      "Lưu vào sổ",
      "Gửi báo cáo lên hệ thống",
      "Đã gửi lúc",
      "Chốt ngày",
      "Mở lại ngày",
      "Nguyên liệu còn dở đem lưu kho",
      "Bột tẩm",
      "Bán nội địa",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });
});
