// Oracle: docs/app-map/43-guided-tour.ba-spec.md — chọn kỳ minh họa (khuôn AC-3), không có kỳ (khuôn AC-4),
// bước ghi theo quyền (khuôn AC-5), phủ nhãn (khuôn AC-10). Nội dung: docs/app-map/31-can-doi-ky.md.
import { describe, expect, it, vi } from "vitest";
import { BALANCING_STOCK_LINE_NAMES } from "@/lib/balancingGrid";
import { DOMESTIC_SALE_ROW_NAME } from "@/lib/domesticSales";
import { INPUT_GROUPS } from "@/types";
import { buildBalancingTour, pickTourPeriod, type BalancingTourContext } from "./balancingTour";

const period = (id: string, startDate: string, isLocked = false) => ({ id, startDate, isLocked });

describe("pickTourPeriod", () => {
  it("đang ở trong một kỳ ⇒ dùng chính kỳ đó", () => {
    expect(pickTourPeriod([period("a", "2026-10-01"), period("b", "2026-10-10")], "a")).toBe("a");
  });

  it("ưu tiên kỳ chưa chốt mới nhất, rồi mới tới kỳ đã chốt", () => {
    const ps = [period("cu", "2026-09-01"), period("chot-moi", "2026-10-15", true), period("mo", "2026-10-05")];
    expect(pickTourPeriod(ps, null)).toBe("mo");
    expect(pickTourPeriod([period("x", "2026-09-01", true), period("y", "2026-10-01", true)], "khong-co")).toBe("y");
  });

  it("không có kỳ ⇒ null", () => {
    expect(pickTourPeriod([], null)).toBeNull();
  });
});

function ctx(over: Partial<BalancingTourContext> = {}): BalancingTourContext {
  return {
    pick: "k1",
    can: { create: true, update: true, lock: true },
    toList: vi.fn(),
    openPeriod: vi.fn(),
    ...over,
  };
}

describe("buildBalancingTour", () => {
  it("đủ quyền, có kỳ minh họa ⇒ 3–22 bước, id không trùng, mở đầu + kết thúc là lời giữa trang", () => {
    const { steps } = buildBalancingTour(ctx());
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(22);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].id).toBe("intro");
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự công việc: danh sách → tạo kỳ → mở kỳ → nguyên liệu → bán thành phẩm → kết quả → chốt → in (R2)", () => {
    const ids = buildBalancingTour(ctx()).steps.map((s) => s.id);
    const order = ["create-period", "period-list", "open-period", "material", "stock-lines", "finished-goods", "result", "lock-status", "lock-action", "print"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("bước danh sách về danh sách; bước của kỳ mở đúng kỳ minh họa; mỗi chỗ xem một hàm prepare chung", () => {
    const c = ctx();
    const steps = buildBalancingTour(c).steps;
    steps.find((s) => s.id === "result")?.prepare?.();
    expect(c.openPeriod).toHaveBeenCalledWith("k1");
    steps.find((s) => s.id === "period-list")?.prepare?.();
    expect(c.toList).toHaveBeenCalledTimes(1);
    const prepares = new Set(steps.map((s) => s.prepare).filter(Boolean));
    expect(prepares.size).toBe(2);
  });

  it("không có kỳ ⇒ không bước nào mở kỳ, đúng 1 bước kể bảng cân đối không gắn chỗ", () => {
    const c = ctx({ pick: null });
    const steps = buildBalancingTour(c).steps;
    steps.forEach((s) => s.prepare?.());
    expect(c.openPeriod).not.toHaveBeenCalled();
    const overview = steps.filter((s) => s.id === "period-overview");
    expect(overview).toHaveLength(1);
    expect(overview[0].target ?? "").toBe("");
  });

  it("phủ nhãn: dòng kho, nhóm nguyên liệu, trạng thái kỳ, cảnh báo đang hiện trên trang có nguyên văn trong lời", () => {
    const text = (c: BalancingTourContext) =>
      buildBalancingTour(c)
        .steps.map((s) => `${s.title}\n${s.body}`)
        .join("\n");
    const labels = [
      ...Object.values(BALANCING_STOCK_LINE_NAMES),
      DOMESTIC_SALE_ROW_NAME,
      ...INPUT_GROUPS,
      // Trạng thái kỳ · cảnh báo · thẻ đối chiếu (BalancingScreen · MaterialGrid · WipGrid).
      "Kỳ đang mở",
      "Kỳ đã chốt",
      "Lần mở lại gần nhất",
      "Sổ kho tháng lệch",
      "Ghi lại vào sổ kho",
      "Chưa có đơn giá",
      "khớp sổ SX",
      "khớp còn dở SX",
      "khớp NL vào",
      "lệch NL vào",
      "Trả",
      "Nợ",
    ];
    expect(labels.filter((l) => !text(ctx()).includes(l))).toEqual([]);
    // Không có kỳ: lời giữa trang vẫn kể hai trạng thái kỳ.
    expect(["Kỳ đang mở", "Kỳ đã chốt"].filter((l) => !text(ctx({ pick: null })).includes(l))).toEqual([]);
  });

  it("văn phong cả khi không có kỳ: tiêu đề không chấm cuối, lời kết bằng dấu chấm, không bấm / nhấn / click", () => {
    const steps = buildBalancingTour(ctx()).steps.concat(buildBalancingTour(ctx({ pick: null })).steps);
    expect(steps.filter((s) => s.title.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => !s.body.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => /(^|[^\p{L}])(bấm|nhấn|click)(?!\p{L})/iu.test(`${s.title} ${s.body}`)).map((s) => s.id)).toEqual([]);
  });

  it("chỉ xem ⇒ 0 bước chỉ nút ghi; đủ quyền ⇒ đủ mọi bước ghi", () => {
    const writeIds = new Set(["create-period", "material-add", "carry-over", "lock-action"]);
    const count = (c: BalancingTourContext) => buildBalancingTour(c).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count(ctx({ can: { create: false, update: false, lock: false } }))).toBe(0);
    expect(count(ctx())).toBe(writeIds.size);
    expect(buildBalancingTour(ctx()).steps.filter((s) => writeIds.has(s.id) && !s.optional)).toEqual([]);
  });
});
