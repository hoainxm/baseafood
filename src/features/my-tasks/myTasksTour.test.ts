// Oracle: docs/app-map/43-guided-tour.ba-spec.md (R3 bước theo quyền · R10 phủ nhãn · AC-11 văn phong)
// + docs/app-map/39-my-tasks.md (loại việc, hạn, ba mục, giao việc).
import { describe, expect, it } from "vitest";
import { DUE_OFFSET_DAYS, taskKindLabel, type TaskKind } from "@/lib/myTasks";
import { buildMyTasksTour, type MyTasksTourContext } from "./myTasksTour";

const full: MyTasksTourContext = { can: { assign: true, editAssigned: true, viewAs: true } };
const viewOnly: MyTasksTourContext = { can: { assign: false, editAssigned: false } };
const textOf = (c: MyTasksTourContext) =>
  buildMyTasksTour(c)
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildMyTasksTour", () => {
  it("phủ đủ nhãn loại việc của lib (thêm loại việc mà quên lời ⇒ đỏ)", () => {
    const text = textOf(full);
    // Gồm 12 loại việc Kế hoạch / HĐ đại lý (ba-spec 59 AC-11).
    const kinds = Object.keys(DUE_OFFSET_DAYS) as TaskKind[];
    expect(kinds.length).toBeGreaterThanOrEqual(23);
    expect(kinds.map(taskKindLabel).filter((l) => !text.includes(l))).toEqual([]);
  });

  it("phủ đủ nhãn đang hiện trên màn: thẻ hạn, bộ lọc, loại việc giao, ba mục, thẻ số", () => {
    const text = textOf(full);
    const labels = [
      // URGENCY_TAGS + trạng thái dòng giao việc (MyTasksScreen.tsx).
      "Quá hạn",
      "Hạn hôm nay",
      "Để biết",
      "Đã xong",
      "Đã thu hồi",
      // FILTERS.
      "Cần làm",
      "Hôm nay",
      "Tất cả",
      // kindLabel việc giao (lib/myTasks.ts fromAssignment).
      "Việc giao",
      "Việc máy phát hiện",
      // Ba mục + thẻ số + nút.
      "Được giao cho tôi",
      "Việc theo quyền của tôi",
      "Tôi đã giao",
      "Mở việc",
      "Xong",
      "Thu hồi",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("bước ghi chỉ có khi được giao việc", () => {
    const writeIds = ["delegate", "assign-new"];
    const ids = (c: MyTasksTourContext) => buildMyTasksTour(c).steps.map((s) => s.id);
    expect(ids(full).filter((id) => writeIds.includes(id))).toEqual(writeIds);
    expect(ids(viewOnly).filter((id) => writeIds.includes(id))).toEqual([]);
    expect(textOf({ can: { assign: true, editAssigned: false } })).not.toContain("Sửa: đổi người nhận");
  });

  it("thứ tự công việc: thẻ số → lọc → ba mục → giao việc mới; mở đầu + kết thúc giữa trang", () => {
    const steps = buildMyTasksTour(full).steps;
    const ids = steps.map((s) => s.id);
    // view-as: chỉ quản trị viên, ngay sau lời chào (ba-spec 59).
    const order = ["intro", "view-as", "stats", "filter", "assigned", "mine", "task-row", "delegate", "delegated", "assign-new", "outro"];
    expect(ids).toEqual(order);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
    // Không bước nào đổi chỗ xem / ghi.
    expect(steps.filter((s) => s.prepare)).toEqual([]);
  });

  it("văn phong: tiêu đề không chấm cuối, lời kết bằng dấu chấm, không bấm / nhấn / click", () => {
    const steps = [...buildMyTasksTour(full).steps, ...buildMyTasksTour(viewOnly).steps];
    expect(steps.filter((s) => s.title.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => !s.body.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => /(^|[^\p{L}])(bấm|nhấn|click)(?!\p{L})/iu.test(`${s.title} ${s.body}`)).map((s) => s.id)).toEqual([]);
  });
});

describe("ba-spec 59 — bước Xem như chỉ với quản trị viên", () => {
  it("có bước view-as (tùy chọn) khi can.viewAs; không có khi không", () => {
    expect(buildMyTasksTour(full).steps.find((s) => s.id === "view-as")?.optional).toBe(true);
    expect(buildMyTasksTour(viewOnly).steps.map((s) => s.id)).not.toContain("view-as");
    expect(textOf(full)).toContain("Nhập khẩu · Lệnh sản xuất · Xuất khẩu");
  });
});
