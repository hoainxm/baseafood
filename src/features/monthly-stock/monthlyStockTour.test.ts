// Oracle: docs/app-map/43-guided-tour.ba-spec.md — phủ nhãn (khuôn AC-10), bước ghi theo quyền (khuôn AC-5),
// văn phong (AC-11). Nội dung: docs/app-map/36-so-kho-thang.md.
import { describe, expect, it } from "vitest";
import { MONTHLY_STOCK_CATEGORIES } from "@/types";
import { buildMonthlyStockTour, type MonthlyStockTourContext } from "./monthlyStockTour";

const FULL: MonthlyStockTourContext["can"] = { create: true, update: true, import: true };
const text = (can: MonthlyStockTourContext["can"]) =>
  buildMonthlyStockTour({ can })
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildMonthlyStockTour", () => {
  it("đủ quyền ⇒ 3–22 bước, id không trùng, mở đầu + kết thúc là lời giữa trang", () => {
    const { steps } = buildMonthlyStockTour({ can: FULL });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(22);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].id).toBe("intro");
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự công việc: tháng → mở sổ → tổng → bảng → ghi → dồn sang tháng sau (R2)", () => {
    const ids = buildMonthlyStockTour({ can: FULL }).steps.map((s) => s.id);
    const order = ["filters", "import-excel", "month-open", "stats", "carry-gap", "table", "inline-edit", "row-actions", "carry-next"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("phủ nhãn: mọi nhóm hàng gợi ý + trạng thái đang hiện trên trang có nguyên văn trong lời", () => {
    const labels = [
      ...MONTHLY_STOCK_CATEGORIES,
      // Thẻ tổng · trạng thái tháng · cảnh báo · thao tác một dòng (MonthlyStockScreen).
      "Tồn đầu kỳ",
      "Nhập trong kỳ",
      "Xuất trong kỳ",
      "Tồn cuối kỳ",
      "Tiền còn lại",
      "Xem trước tồn đầu",
      "CHƯA LƯU",
      "Kế thừa & lưu vào sổ",
      "Khớp bất biến",
      "Lệch bất biến",
      "Lệch dồn kỳ",
      "Đối chiếu & sửa lệch",
      "Gửi: <kho>",
      "Từ SX",
      "Lấy ra sử dụng",
      "Nhập thêm",
      "Gửi kho ngoài",
      "Ẩn dòng trống",
    ];
    const t = text(FULL);
    expect(labels.filter((l) => !t.includes(l))).toEqual([]);
  });

  it("chỉ xem ⇒ không bước nào chỉ nút ghi; đủ quyền ⇒ đủ mọi bước ghi", () => {
    const writeIds = new Set(["import-excel", "inline-edit", "add-row", "row-actions", "catalog-sync", "carry-next"]);
    const count = (can: MonthlyStockTourContext["can"]) => buildMonthlyStockTour({ can }).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count({ create: false, update: false, import: false })).toBe(0);
    expect(count(FULL)).toBe(writeIds.size);
    // Bước ghi luôn tùy chọn (nút có thể không hiện, VD đang xem trước tồn đầu).
    expect(buildMonthlyStockTour({ can: FULL }).steps.filter((s) => writeIds.has(s.id) && !s.optional)).toEqual([]);
  });

  it("không bước nào đổi chỗ xem (trang một màn, R1)", () => {
    expect(buildMonthlyStockTour({ can: FULL }).steps.filter((s) => s.prepare)).toEqual([]);
  });
});
